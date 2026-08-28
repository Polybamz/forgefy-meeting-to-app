import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Database,
  Loader2,
  Maximize2,
  Monitor,
  Pencil,
  RotateCw,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { apiFetch, connectWs, type BillingStatus, type Project } from "@/lib/api";
import {
  formatDuration,
  groupBySeverity,
  newId,
  parseFindings,
  parseTodos,
  parseToolEvent,
  type ChatMessage,
  type FindingSeverity,
  type FindingsReport,
  type LogEntry,
  type PlanData,
  type PlanFile,
  type TodoItem,
  type ToolEvent,
} from "@/lib/chat";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import { useChat } from "@/hooks/use-chat";
import { useProjectIntegrations } from "@/hooks/use-project-integrations";
import { playAlertSound } from "@/lib/sound";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: ProjectEditorPage,
  head: () => ({ meta: [{ title: "Project — Forgefy" }] }),
});

// Chat pane width. 380px was fixed, and markdown with code blocks and file
// paths does not fit in it — break-all on the plan rows was the symptom.
const CHAT_WIDTH_KEY = "forgefy_chat_width";
const CHAT_WIDTH_DEFAULT = 380;
const CHAT_WIDTH_MIN = 320;
const CHAT_WIDTH_MAX = 720;

function loadChatWidth(): number {
  try {
    const saved = Number(localStorage.getItem(CHAT_WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= CHAT_WIDTH_MIN && saved <= CHAT_WIDTH_MAX) {
      return saved;
    }
  } catch {
    /* private mode / storage disabled */
  }
  return CHAT_WIDTH_DEFAULT;
}

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

const LOG_ICONS: Record<string, string> = {
  started: "▶",
  info: "·",
  thinking: "◌",
  tool: "⚙",
  text: "✦",
  warning: "⚠",
  error: "✕",
  done: "✓",
  validating: "◈",
};

// Every colour resolves to an --agent-log-* token defined for BOTH themes in
// src/styles.css. Values are chosen for >= 4.5:1 on --agent-surface in each
// theme; do not reintroduce a literal here.
const LOG_COLORS: Record<string, string> = {
  started: "text-accent",
  info: "text-agent-log-info",
  thinking: "text-agent-log-thinking",
  tool: "text-agent-log-tool",
  text: "text-agent-log-text",
  warning: "text-agent-log-warning",
  error: "text-agent-log-error",
  done: "text-agent-log-done",
  validating: "text-agent-log-validating",
};

const LOG_FALLBACK_COLOR = "text-agent-text-muted";

// ---------------------------------------------------------------------------
// Typed log rows
// ---------------------------------------------------------------------------
// The backend emits structure — plan JSON, todo JSON, findings JSON, and tool
// labels that name their subject. Flattening all of it to "<emoji> <string>"
// threw that away. Each renderer below handles one kind; anything unrecognised
// falls through to PlainRow, so an event is never dropped for lacking one.

const TOOL_BADGES: Record<string, { badge: string; className: string }> = {
  create: { badge: "+", className: "text-agent-log-done" },
  edit: { badge: "~", className: "text-agent-log-warning" },
  delete: { badge: "−", className: "text-agent-log-error" },
  move: { badge: "→", className: "text-agent-log-warning" },
  read: { badge: "", className: "text-agent-text-dim" },
  run: { badge: "$", className: "text-agent-log-validating" },
  other: { badge: "", className: "text-agent-text-dim" },
};

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: "text-agent-log-error",
  high: "text-agent-log-error",
  medium: "text-agent-log-warning",
  low: "text-agent-text-muted",
};

/** The generic one-line row. Also the fallback for unknown event types. */
function PlainRow({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 leading-[1.6]">
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <span className={`${color} break-words min-w-0`}>{children}</span>
    </div>
  );
}

/** A tool call that named a file: path, action badge, status dot. */
function ToolRow({ event, done }: { event: ToolEvent; done: boolean }) {
  const { badge, className } = TOOL_BADGES[event.action] ?? TOOL_BADGES.other;
  const isRead = event.action === "read";

  return (
    <div className="flex items-start gap-2 leading-[1.6]">
      <span className={`shrink-0 ${done ? "text-agent-log-done" : "text-agent-text-dim"}`}>
        {done ? "✓" : "○"}
      </span>
      <div className="min-w-0 flex-1">
        {event.isPath && event.subject ? (
          <>
            <span className={isRead ? "text-agent-text-dim" : "text-agent-text"}>
              {event.subject}
            </span>
            {event.detail && (
              <span className="block text-[9px] text-agent-text-dim">{event.detail}</span>
            )}
          </>
        ) : (
          <span className={isRead ? "text-agent-text-dim" : "text-agent-text"}>{event.label}</span>
        )}
      </div>
      {badge && <span className={`shrink-0 text-[9px] ${className}`}>{badge}</span>}
    </div>
  );
}

/** report_findings, grouped by severity rather than rendered as prose. */
function FindingsRow({ report }: { report: FindingsReport }) {
  const groups = groupBySeverity(report.findings);

  if (groups.length === 0) {
    return (
      <PlainRow icon="✓" color="text-agent-log-done">
        Review clean — no issues found.
      </PlainRow>
    );
  }

  return (
    <div className="my-1 rounded-lg border border-agent-border overflow-hidden">
      <div className="px-2 py-1 border-b border-agent-border">
        <span className="text-[9px] uppercase tracking-wider text-agent-text-dim">
          review · {report.findings.length} {report.findings.length === 1 ? "finding" : "findings"}
        </span>
      </div>
      <div className="px-2 py-1.5 space-y-1.5">
        {groups.map(([severity, list]) => (
          <div key={severity}>
            <span
              className={`text-[9px] uppercase tracking-wider font-medium ${SEVERITY_STYLES[severity]}`}
            >
              {severity} · {list.length}
            </span>
            <div className="mt-0.5 space-y-1">
              {list.map((f, i) => (
                <div key={`${f.file}-${f.line}-${i}`} className="pl-2">
                  <span className="text-agent-text block leading-snug">{f.summary}</span>
                  {f.file && (
                    <span className="text-[9px] text-agent-text-dim break-all">
                      {f.file}
                      {f.line > 0 && `:${f.line}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The agent's own task list, which already arrives as JSON. */
function TodoRow({ todos }: { todos: TodoItem[] }) {
  const done = todos.filter((t) => t.status === "completed").length;
  return (
    <div className="my-1 rounded-lg border border-agent-border px-2 py-1.5">
      <span className="text-[9px] uppercase tracking-wider text-agent-text-dim">
        tasks · {done}/{todos.length}
      </span>
      <div className="mt-1 space-y-0.5">
        {todos.map((t, i) => (
          <div key={`${t.content}-${i}`} className="flex items-start gap-2 leading-[1.6]">
            <span
              className={`shrink-0 ${
                t.status === "completed"
                  ? "text-agent-log-done"
                  : t.status === "in_progress"
                    ? "text-agent-log-validating"
                    : "text-agent-text-dim"
              }`}
            >
              {t.status === "completed" ? "✓" : t.status === "in_progress" ? "▸" : "○"}
            </span>
            <span
              className={
                t.status === "completed"
                  ? "text-agent-text-dim line-through"
                  : "text-agent-text min-w-0"
              }
            >
              {t.status === "in_progress" ? (t.active_form ?? t.content) : t.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Reasoning, collapsed by default.
 *
 * Thinking used to sit at the same visual weight as the actions, which is
 * backwards: it is the least consequential thing in the stream and there is a
 * lot of it.
 */
function ThinkingRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const oneLine = text.replace(/\s+/g, " ").trim();
  const preview = oneLine.length > 60 ? `${oneLine.slice(0, 60)}…` : oneLine;

  return (
    <div className="leading-[1.6]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-start gap-2 text-left hover:opacity-80 transition-opacity"
      >
        <span className="shrink-0 text-agent-log-thinking">◌</span>
        <span className="text-agent-log-thinking italic min-w-0 flex-1 break-words">
          {open ? oneLine : preview}
        </span>
        <span className="shrink-0 text-[9px] text-agent-text-dim">{open ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentActivityBlock
// ---------------------------------------------------------------------------
// A finished run marks every planned file done, so a frozen block never reads
// this set. One shared empty instance keeps it out of the render path.
const NO_FILES: Set<string> = new Set();

function AgentActivityBlock({
  logs,
  isActive,
  plan,
  writtenFiles,
  stats,
}: {
  logs: LogEntry[];
  isActive: boolean;
  plan: PlanData | null;
  writtenFiles: Set<string>;
  /** Present only on a finished run. */
  stats?: { filesChanged: number; durationMs: number };
}) {
  const [planOpen, setPlanOpen] = useState(true);
  // null = follow the run. The stream is open while the agent works and folds
  // away when it finishes, unless the reader has said otherwise.
  const [logsOpenOverride, setLogsOpenOverride] = useState<boolean | null>(null);
  const logsOpen = logsOpenOverride ?? isActive;

  if (logs.length === 0 && !isActive && !plan) return null;

  const fileItems = plan
    ? [
        ...(plan.files_to_create ?? []).map((f: PlanFile) => ({
          path: f.path,
          desc: f.purpose,
          badge: "+",
          done: !isActive || writtenFiles.has(f.path),
        })),
        ...(plan.files_to_modify ?? []).map((f: PlanFile) => ({
          path: f.path,
          desc: f.changes,
          badge: "~",
          done: !isActive || writtenFiles.has(f.path),
        })),
      ]
    : [];

  return (
    <div className="flex justify-start">
      <div className="w-full text-[11px] font-mono-ui border border-agent-border rounded-xl bg-agent-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-agent-border">
          {isActive ? (
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
          ) : (
            <span className="text-agent-log-done">✓</span>
          )}
          <span className="text-agent-text-muted">forgefy agent</span>
          {isActive && <span className="ml-auto text-[10px] text-agent-text-dim">running</span>}
        </div>

        {/* Plan section */}
        {plan && (
          <>
            <button
              onClick={() => setPlanOpen((o) => !o)}
              aria-expanded={planOpen}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-agent-border/40 transition-colors border-b border-agent-border"
            >
              <span className="text-agent-text-dim uppercase tracking-wider text-[9px]">
                plan · {fileItems.filter((f) => f.done).length}/{fileItems.length} files
              </span>
              <span className="text-agent-text-dim text-[9px]">{planOpen ? "▲" : "▼"}</span>
            </button>
            {planOpen && (
              <div className="px-3 py-2 space-y-1 border-b border-agent-border">
                <p className="text-agent-text-muted leading-snug pb-1">{plan.summary}</p>
                {fileItems.map((f) => (
                  <div key={f.path} className="flex items-start gap-2 leading-[1.6]">
                    <span
                      className={`shrink-0 ${f.done ? "text-agent-log-done" : "text-agent-text-dim"}`}
                    >
                      {f.done ? "✓" : "○"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={f.done ? "text-agent-text-dim line-through" : "text-agent-text"}
                      >
                        {f.desc || f.path}
                      </span>
                      {f.desc && (
                        <span className="block text-[9px] text-agent-text-dim break-all">
                          {f.path}
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-[9px] ${f.badge === "+" ? "text-agent-log-done" : "text-agent-log-warning"}`}
                    >
                      {f.badge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Log stream. No nested scroller: one inside the chat's own scroller
            captured the wheel and read as the page refusing to scroll. The
            block grows inline and collapses when the run finishes instead. */}
        {!isActive && logs.length > 0 && (
          <button
            onClick={() => setLogsOpenOverride(!logsOpen)}
            aria-expanded={logsOpen}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-agent-border/40 transition-colors"
          >
            <span className="text-agent-text-dim uppercase tracking-wider text-[9px]">
              activity · {logs.length} {logs.length === 1 ? "event" : "events"}
            </span>
            <span className="text-agent-text-dim text-[9px]">{logsOpen ? "▲" : "▼"}</span>
          </button>
        )}
        <div className={`px-3 py-2 space-y-0.5 ${logsOpen ? "" : "hidden"}`}>
          {logs.length === 0 && isActive && (
            <span className="text-agent-text-dim italic">Connecting…</span>
          )}
          {logs.map((entry, i) => {
            // The last line while the agent is running is the step in progress —
            // show a spinning loader for it, whatever its type (covers every
            // status verb and any process not in LOG_ICONS).
            const isProcessing = isActive && i === logs.length - 1;
            const color = LOG_COLORS[entry.type] ?? LOG_FALLBACK_COLOR;
            const spinner = (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle"
                role="status"
                aria-label="Processing"
              />
            );
            const icon = isProcessing ? spinner : (LOG_ICONS[entry.type] ?? "·");

            // ── Render by kind ──
            switch (entry.type) {
              case "thinking":
                return <ThinkingRow key={entry.ts} text={entry.message} />;

              case "tool": {
                const parsed = parseToolEvent(entry.message);
                return <ToolRow key={entry.ts} event={parsed} done={!isProcessing} />;
              }

              case "findings": {
                const report = parseFindings(entry.message);
                // Unparseable JSON falls through to the plain row rather than
                // vanishing.
                if (report) return <FindingsRow key={entry.ts} report={report} />;
                break;
              }

              case "todo": {
                const todos = parseTodos(entry.message);
                if (todos) return <TodoRow key={entry.ts} todos={todos} />;
                break;
              }

              case "text":
              case "done":
                return (
                  <div key={entry.ts} className="flex items-start gap-2 leading-[1.6]">
                    <span className={`shrink-0 ${color}`}>{icon}</span>
                    <Md className={`${color} text-[11px] break-words min-w-0`}>{entry.message}</Md>
                  </div>
                );
            }

            // Fallback: errors and warnings keep full weight here, and so does
            // any event type this build has never seen.
            return (
              <PlainRow key={entry.ts} icon={icon} color={color}>
                {entry.message}
              </PlainRow>
            );
          })}
        </div>

        {/* Per-turn stats. No token count: the backend does not put one on the
            log socket, so showing a number here would mean inventing it. */}
        {stats && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-agent-border text-[10px] text-agent-text-dim">
            <span>
              {stats.filesChanged} {stats.filesChanged === 1 ? "file" : "files"} changed
            </span>
            <span>·</span>
            <span>{formatDuration(stats.durationMs)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewPanel
// ---------------------------------------------------------------------------
// The preview is presented differently per template:
//   • flutter / react_native → a phone device frame (mobile apps)
//   • next                    → a browser frame with a resizable viewport
// Appetize URLs already render their own device, so they are shown frame-less.
type PreviewDevice = "ios" | "android";

const DEVICE_FRAMES: Record<
  PreviewDevice,
  { label: string; w: number; h: number; radius: string }
> = {
  ios: { label: "iPhone", w: 300, h: 620, radius: "2.6rem" },
  android: { label: "Android", w: 300, h: 620, radius: "1.9rem" },
};

// Viewport presets for the Next.js (web) preview. `w: null` = fill the panel.
type WebWidth = "desktop" | "tablet" | "mobile";

const WEB_WIDTHS: Record<WebWidth, { label: string; w: number | null }> = {
  desktop: { label: "Desktop", w: null },
  tablet: { label: "Tablet", w: 834 },
  mobile: { label: "Mobile", w: 400 },
};

const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups";

function PreviewPanel({
  previewUrl,
  buildingPreview,
  canBuildPreview,
  onBuildPreview,
  templateKey,
}: {
  previewUrl: string | null;
  buildingPreview: boolean;
  canBuildPreview: boolean;
  onBuildPreview: () => void;
  templateKey: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [device, setDevice] = useState<PreviewDevice>("ios");
  const [webWidth, setWebWidth] = useState<WebWidth>("desktop");

  const isWeb = templateKey === "next";

  // No deployed URL yet and nothing building → the empty call-to-action.
  if (!previewUrl && !buildingPreview) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border">
          {isWeb ? (
            <Monitor className="h-7 w-7 opacity-40" />
          ) : (
            <Smartphone className="h-7 w-7 opacity-40" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-ink mb-1">No preview yet</p>
          <p className="text-[12px] text-text-muted max-w-[200px]">
            {isWeb
              ? "Build a live preview to see your site running in the browser."
              : "Build a live preview to see your app running in a phone."}
          </p>
        </div>
        {canBuildPreview && (
          <button
            onClick={onBuildPreview}
            disabled={buildingPreview}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 btn-press shadow-warm-xs"
          >
            Build Preview
          </button>
        )}
      </div>
    );
  }

  const isAppetize = !!previewUrl?.includes("appetize.io");
  const iframeUrl = isAppetize
    ? previewUrl!.replace("appetize.io/app/", "appetize.io/embed/")
    : previewUrl;

  const buildingScreen = (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted bg-gradient-to-br from-surface to-card">
      <Loader2 className="h-9 w-9 text-accent animate-spin" />
      <p className="text-[12px] font-medium text-ink">
        {isWeb ? "Building your site…" : "Building your app…"}
      </p>
      <p className="text-[11px] text-text-muted max-w-[180px] text-center">
        Compiling and deploying to Cloudflare
      </p>
    </div>
  );

  const reloadButton = previewUrl && (
    <button
      onClick={() => setRefreshKey((k) => k + 1)}
      title="Reload preview"
      aria-label="Reload preview"
      className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
    >
      <RotateCw className="h-3.5 w-3.5" />
    </button>
  );

  const openButton = previewUrl && (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      title="Open in new tab"
      aria-label="Open preview in a new tab"
      className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </a>
  );

  const statusBar = (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface shrink-0 text-[11px]">
      <span className="font-mono-ui text-text-muted truncate max-w-[70%]">{previewUrl ?? "—"}</span>
      <span
        className={buildingPreview ? "text-[oklch(0.65_0.18_60)]" : "text-[oklch(0.6_0.18_145)]"}
      >
        ● {buildingPreview ? "Building" : "Connected"}
      </span>
    </div>
  );

  // -------------------------------------------------------------------------
  // Next.js → browser frame with a resizable viewport
  // -------------------------------------------------------------------------
  if (isWeb) {
    const width = WEB_WIDTHS[webWidth];
    return (
      <div className="flex flex-col h-full rounded-xl border border-border overflow-hidden shadow-warm-xs bg-card/60">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-1 rounded-md bg-card border border-border">
            <p className="text-[11px] font-mono-ui text-text-muted truncate">
              {previewUrl ?? "building…"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Viewport width selector */}
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(Object.keys(WEB_WIDTHS) as WebWidth[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setWebWidth(w)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    webWidth === w ? "bg-accent/15 text-accent" : "text-text-muted hover:text-ink"
                  }`}
                >
                  {WEB_WIDTHS[w].label}
                </button>
              ))}
            </div>
            {reloadButton}
            {openButton}
          </div>
        </div>

        {/* Stage */}
        <div className="flex-1 min-h-0 flex justify-center overflow-hidden p-3 bg-[#f5f5f5] dark:bg-[#151312]">
          <div
            className="h-full overflow-hidden rounded-lg border border-border bg-white shadow-warm-xs transition-[width] duration-200"
            style={{ width: width.w ?? "100%", maxWidth: "100%" }}
          >
            {previewUrl ? (
              <iframe
                key={refreshKey}
                src={previewUrl}
                className="w-full h-full border-0"
                title="App preview"
                allow="camera; microphone"
                sandbox={IFRAME_SANDBOX}
              />
            ) : (
              buildingScreen
            )}
          </div>
        </div>

        {statusBar}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Flutter / React Native → phone device frame
  // -------------------------------------------------------------------------
  const frame = DEVICE_FRAMES[device];

  return (
    <div className="flex flex-col h-full rounded-xl border border-border overflow-hidden shadow-warm-xs bg-card/60">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              buildingPreview
                ? "bg-[oklch(0.65_0.18_60)] animate-pulse"
                : "bg-[oklch(0.6_0.18_145)]"
            }`}
          />
          <span className="text-[12px] font-medium text-ink truncate">
            {buildingPreview ? "Deploying preview…" : "Live Preview"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device selector — not shown for Appetize (it picks its own device) */}
          {!isAppetize && previewUrl && (
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(Object.keys(DEVICE_FRAMES) as PreviewDevice[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    device === d ? "bg-accent/15 text-accent" : "text-text-muted hover:text-ink"
                  }`}
                >
                  {DEVICE_FRAMES[d].label}
                </button>
              ))}
            </div>
          )}
          {!isAppetize && reloadButton}
          {openButton}
        </div>
      </div>

      {/* Device stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-4 bg-[radial-gradient(circle_at_center,theme(colors.surface),transparent)]">
        {isAppetize ? (
          // Appetize renders its own device — show it edge to edge.
          <iframe
            key={refreshKey}
            src={iframeUrl!}
            className="w-full h-full border-0 rounded-xl"
            title="App preview"
            allow="camera; microphone"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          // Height-driven: the phone fills the available height and derives its
          // width from the device aspect ratio, so it always fits the panel
          // without scrolling. maxWidth keeps it inside a narrow panel too.
          <div
            className="relative h-full max-h-full"
            style={{ aspectRatio: `${frame.w} / ${frame.h}`, maxWidth: "100%" }}
          >
            {/* Phone body */}
            <div
              className="relative w-full h-full bg-[#0b0a09] border-[6px] border-[#1c1917] shadow-warm-lg overflow-hidden"
              style={{ borderRadius: frame.radius }}
            >
              {/* Notch / camera */}
              {device === "ios" && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[3.5%] bg-[#0b0a09] rounded-b-2xl z-20" />
              )}
              {device === "android" && (
                <div className="absolute top-[1.2%] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#0b0a09] ring-2 ring-black/40 rounded-full z-20" />
              )}

              {/* Screen */}
              <div className="w-full h-full bg-white dark:bg-[#111] overflow-hidden">
                {previewUrl ? (
                  <iframe
                    key={refreshKey}
                    src={iframeUrl!}
                    className="w-full h-full border-0"
                    title="App preview"
                    allow="camera; microphone"
                    sandbox={IFRAME_SANDBOX}
                  />
                ) : (
                  buildingScreen
                )}
              </div>

              {/* Home indicator (iOS) */}
              {device === "ios" && (
                <div className="absolute bottom-[1%] left-1/2 -translate-x-1/2 w-[26%] h-[0.7%] min-h-[3px] bg-black/30 rounded-full z-20" />
              )}
            </div>

            {/* Side buttons (visual only) — percentage offsets so they scale */}
            <div className="absolute -right-1.5 top-[22%] w-1.5 h-[11%] bg-[#1c1917] rounded-r-md" />
            <div className="absolute -left-1.5 top-[16%] w-1.5 h-[7%] bg-[#1c1917] rounded-l-md" />
            <div className="absolute -left-1.5 top-[26%] w-1.5 h-[7%] bg-[#1c1917] rounded-l-md" />
          </div>
        )}
      </div>

      {statusBar}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodePanel — file tree + syntax-highlighted viewer
// ---------------------------------------------------------------------------
const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  dart: "dart",
  py: "python",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  css: "css",
  html: "html",
  sh: "bash",
  gradle: "gradle",
  xml: "xml",
  kt: "kotlin",
  swift: "swift",
  toml: "toml",
};

function fileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    ts: "📘",
    tsx: "⚛",
    js: "📒",
    jsx: "⚛",
    dart: "🎯",
    json: "📋",
    yaml: "📋",
    yml: "📋",
    md: "📝",
    css: "🎨",
    html: "🌐",
    sh: "⚙",
    gradle: "🐘",
    xml: "📄",
    py: "🐍",
    kt: "📗",
    swift: "🍎",
    toml: "⚙",
  };
  return icons[ext] ?? "📄";
}

function buildTree(files: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const path of files) {
    const parts = path.split("/");
    let node: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = path;
  }
  return root;
}

function TreeNode({
  name,
  node,
  depth,
  selected,
  onSelect,
}: {
  name: string;
  node: unknown;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isFile = typeof node === "string";

  if (isFile) {
    const active = selected === node;
    return (
      <button
        onClick={() => onSelect(node as string)}
        className={`w-full flex items-center gap-1.5 py-[3px] rounded text-left text-[11px] font-mono-ui transition-colors ${
          active
            ? "bg-accent/20 text-accent font-medium"
            : "text-[#9A9A9A] hover:bg-[#2a2a2a] hover:text-[#D4D4D4]"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: "8px" }}
      >
        <span className="shrink-0 text-[10px]">{fileIcon(name)}</span>
        <span className="truncate">{name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 py-[3px] rounded text-left text-[11px] font-mono-ui text-[#858585] hover:text-[#D4D4D4] hover:bg-[#2a2a2a] transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: "8px" }}
      >
        <span className="shrink-0 text-[9px]">{open ? "▾" : "▸"}</span>
        <span className="shrink-0">📁</span>
        <span className="truncate font-medium">{name}</span>
      </button>
      {open && (
        <div>
          {Object.entries(node as Record<string, unknown>)
            .sort(([, a], [, b]) => {
              const aFile = typeof a === "string";
              const bFile = typeof b === "string";
              if (aFile !== bFile) return aFile ? 1 : -1;
              return 0;
            })
            .map(([k, v]) => (
              <TreeNode
                key={k}
                name={k}
                node={v}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function CodePanel({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    setLoadingTree(true);
    apiFetch(`/api/v1/projects/${projectId}/code/tree`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => setFiles(d.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoadingTree(false));
  }, [projectId]);

  async function openFile(path: string) {
    if (path === selected) return;
    setSelected(path);
    setContent(null);
    setLoadingFile(true);
    try {
      const r = await apiFetch(
        `/api/v1/projects/${projectId}/code/file?path=${encodeURIComponent(path)}`,
      );
      const d = await r.json();
      setContent(r.ok ? (d.content ?? "") : `Error: ${d.detail ?? "Could not load file"}`);
    } catch {
      setContent("Network error loading file.");
    } finally {
      setLoadingFile(false);
    }
  }

  const tree = buildTree(files);
  const ext = selected?.split(".").pop()?.toLowerCase() ?? "";
  const lang = LANG_MAP[ext] ?? "plaintext";

  return (
    <div className="flex h-full rounded-xl border border-[#1e1e1e] overflow-hidden shadow-warm-md">
      {/* File tree */}
      <div className="w-56 shrink-0 flex flex-col border-r border-[#252526] bg-[#1e1e1e] overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-[#252526]">
          <p className="text-[10px] font-mono-ui text-[#858585] uppercase tracking-wider">
            Explorer
          </p>
        </div>
        {loadingTree ? (
          <div className="flex items-center justify-center flex-1 text-[11px] text-[#858585] gap-2">
            <span className="h-1 w-1 rounded-full bg-[#858585] animate-pulse" />
            Loading…
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[11px] text-[#858585]">
            No files yet
          </div>
        ) : (
          <div className="py-1 overflow-y-auto">
            {Object.entries(tree)
              .sort(([, a], [, b]) => {
                const aFile = typeof a === "string";
                const bFile = typeof b === "string";
                if (aFile !== bFile) return aFile ? 1 : -1;
                return 0;
              })
              .map(([k, v]) => (
                <TreeNode
                  key={k}
                  name={k}
                  node={v}
                  depth={0}
                  selected={selected}
                  onSelect={openFile}
                />
              ))}
          </div>
        )}
      </div>

      {/* Editor pane */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-[#252526] bg-[#2d2d2d] min-h-[32px] shrink-0">
          {selected ? (
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e1e1e] border-t border-t-accent text-[11px] font-mono-ui text-[#ccc]">
              <span>{fileIcon(selected)}</span>
              <span>{selected.split("/").pop()}</span>
            </div>
          ) : (
            <span className="px-4 py-1.5 text-[11px] font-mono-ui text-[#858585]">
              No file open
            </span>
          )}
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto">
          {!selected && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[#858585]">
              <svg
                className="w-8 h-8 opacity-30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <p className="text-[12px]">Select a file to view</p>
            </div>
          )}
          {selected && loadingFile && (
            <div className="flex items-center justify-center h-32 gap-2 text-[11px] text-[#858585]">
              <span className="h-1 w-1 rounded-full bg-[#858585] animate-pulse" />
              Loading…
            </div>
          )}
          {selected && !loadingFile && content !== null && (
            <pre className="p-4 text-[11.5px] font-mono-ui text-[#d4d4d4] leading-relaxed whitespace-pre overflow-x-auto">
              <code>{content}</code>
            </pre>
          )}
        </div>

        {/* Status bar */}
        {selected && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-1 border-t border-[#252526] bg-accent text-accent-foreground text-[10px] font-mono-ui">
            <span>{lang}</span>
            <span className="opacity-60">·</span>
            <span className="truncate opacity-70">{selected}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared markdown renderer
// ---------------------------------------------------------------------------
// react-markdown v9 dropped the `className` prop — passing it is silently
// ignored. The wrapper div is what carries the caller's classes now.
function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-inherit">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-inherit">{children}</em>,
          code: ({ children, className: cls }) => {
            const isBlock = cls?.includes("language-");
            return isBlock ? (
              <code className="block bg-black/20 rounded px-2 py-1.5 text-[10px] font-mono overflow-x-auto my-1">
                {children}
              </code>
            ) : (
              <code className="bg-black/20 rounded px-1 py-0.5 text-[10px] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="overflow-x-auto my-1">{children}</pre>,
          h1: ({ children }) => <h1 className="font-semibold text-[14px] mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="font-semibold text-[13px] mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="font-medium text-[12px] mb-0.5">{children}</h3>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-current opacity-20 my-2" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-current opacity-70 pl-2 my-1">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatBubble
// ---------------------------------------------------------------------------
// memo, because every bubble re-parses its markdown on render and `messages`
// changes on every log flush of every turn. The callbacks below are all
// useCallback'd at the call site, so the memo actually holds.
const ChatBubble = React.memo(function ChatBubble({
  message,
  canEdit,
  onAddDatabase,
  onDeclineDatabase,
  onSelectOption,
  onRetry,
  onEdit,
}: {
  message: ChatMessage;
  /** True for the user's most recent message — the only one worth re-editing. */
  canEdit?: boolean;
  onAddDatabase?: () => void;
  onDeclineDatabase?: () => void;
  onSelectOption?: (messageId: string, option: string) => void;
  onRetry?: (text: string) => void;
  onEdit?: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be denied; silently leave the button unchanged rather
      // than throwing an error bubble for a copy.
    }
  }

  const actions = (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      {!isUser && !isError && (
        <button
          onClick={copy}
          title={copied ? "Copied" : "Copy message"}
          aria-label={copied ? "Copied" : "Copy message"}
          className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-ink hover:bg-surface transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      {isError && message.retryPrompt && (
        <button
          onClick={() => onRetry?.(message.retryPrompt!)}
          title="Retry"
          aria-label="Retry sending this message"
          className="flex items-center justify-center gap-1 h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-ink hover:bg-surface transition-colors"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </button>
      )}
      {isUser && canEdit && (
        <button
          onClick={() => onEdit?.(message.text)}
          title="Edit and resend"
          aria-label="Edit and resend this message"
          className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-ink hover:bg-surface transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className={`group flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      <div className={`flex w-full items-end gap-1 ${isUser ? "justify-end" : "justify-start"}`}>
        {isUser && actions}
        <div
          className={[
            "max-w-[88%] px-4 py-3 text-[13px] leading-[1.65]",
            isUser
              ? "bg-accent text-accent-foreground rounded-2xl rounded-br-sm shadow-warm-xs"
              : isError
                ? "bg-amber-500/[0.07] border border-amber-400/20 text-amber-700 dark:text-amber-400 rounded-2xl rounded-bl-sm"
                : "bg-card border border-border text-text-secondary rounded-2xl rounded-bl-sm shadow-warm-xs",
          ].join(" ")}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : (
            <Md className="text-[13px]">{message.text}</Md>
          )}
          <p
            className={`text-[10px] mt-2 ${isUser ? "text-accent-foreground/50" : "text-text-muted"}`}
          >
            {message.timestamp.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {!isUser && actions}
      </div>
      {message.needsDatabase && !isUser && (
        <div className="flex items-center gap-2 pl-1">
          <button
            onClick={onAddDatabase}
            className="h-7 px-3 rounded-lg bg-accent text-accent-foreground text-[12px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors btn-press"
          >
            Add a database
          </button>
          <button
            onClick={onDeclineDatabase}
            className="h-7 px-3 rounded-lg border border-border text-[12px] text-text-secondary hover:text-ink transition-colors btn-press"
          >
            No thanks
          </button>
        </div>
      )}
      {!message.needsDatabase && message.clarifyOptions && !isUser && (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          {message.clarifyOptions.map((option) => {
            // Once one option is chosen the whole row locks. Leaving it live
            // meant a double click sent the answer twice.
            const answered = !!message.answeredOption;
            const chosen = message.answeredOption === option;
            return (
              <button
                key={option}
                onClick={() => onSelectOption?.(message.id, option)}
                disabled={answered}
                aria-pressed={chosen}
                className={[
                  "h-7 px-3 rounded-lg border text-[12px] transition-colors btn-press",
                  chosen
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-text-secondary hover:text-ink hover:border-text-secondary",
                  answered && !chosen ? "opacity-40" : "",
                  answered ? "cursor-default" : "",
                ].join(" ")}
              >
                {chosen && "✓ "}
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// GitHub sync button
// ---------------------------------------------------------------------------
const GH_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

function GitHubSyncButton({
  project,
  githubLinked,
  transferring,
  transferError,
  onConnect,
  onSync,
}: {
  project: Project;
  githubLinked: boolean | null;
  transferring: boolean;
  transferError: string;
  onConnect: () => void;
  onSync: () => void;
}) {
  if (project.repo_owner === "user" && project.github_url) {
    return (
      <a
        href={project.github_url}
        target="_blank"
        rel="noreferrer"
        title={project.repo_full_name ?? undefined}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {GH_ICON}
        <span className="hidden sm:block max-w-[140px] truncate">
          {project.repo_full_name ?? "GitHub"}
        </span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (githubLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border text-[12px] text-text-muted/50">
        {GH_ICON}
        <span>…</span>
      </div>
    );
  }

  if (!githubLinked) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors btn-press"
      >
        {GH_ICON}
        Connect GitHub
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onSync}
        disabled={transferring}
        title={transferError || "Push this project to your GitHub account"}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {GH_ICON}
        {transferring ? "Syncing…" : "Sync to GitHub"}
      </button>
      {transferError && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {transferError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supabase connect button
// ---------------------------------------------------------------------------
const SUPABASE_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path
      d="M13.3 23.6c-.5.6-1.5.3-1.5-.5v-8.4H4.9c-1 0-1.6-1.2-.9-2l9.7-11.7c.5-.6 1.5-.3 1.5.5v8.4h6.9c1 0 1.6 1.2.9 2L13.3 23.6Z"
      fill="currentColor"
    />
  </svg>
);

function SupabaseConnectButton({
  project,
  supabaseLinked,
  connecting,
  error,
  orgs,
  onConnectAccount,
  onStartConnect,
  onPickOrg,
  onDismissOrgPicker,
}: {
  project: Project;
  supabaseLinked: boolean | null;
  connecting: boolean;
  error: string;
  orgs: { id: string; name: string }[] | null;
  onConnectAccount: () => void;
  onStartConnect: () => void;
  onPickOrg: (organizationId: string) => void;
  onDismissOrgPicker: () => void;
}) {
  if (project.supabase_project_ref) {
    return (
      <a
        href={`https://supabase.com/dashboard/project/${project.supabase_project_ref}`}
        target="_blank"
        rel="noreferrer"
        title="Open in Supabase"
        aria-label="Open this project in Supabase"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {SUPABASE_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (supabaseLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border text-[12px] text-text-muted/50">
        {SUPABASE_ICON}
        <span>…</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-0.5">
      <button
        onClick={supabaseLinked ? onStartConnect : onConnectAccount}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#3ecf8e] hover:bg-[#34b87b] text-[#1c1c1c] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {SUPABASE_ICON}
        {connecting ? "Connecting…" : supabaseLinked ? "Connect Database" : "Connect Supabase"}
      </button>
      {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
      {orgs && (
        <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-border bg-card p-1.5 shadow-warm-lg">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-text-muted">
            Choose an organization
          </p>
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => onPickOrg(org.id)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface transition-colors"
            >
              {org.name}
            </button>
          ))}
          <button
            onClick={onDismissOrgPicker}
            className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-text-muted hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Neon connect button — embedded model: no account linking, single click
// ---------------------------------------------------------------------------
const NEON_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M4 3h16v9.5c0 5-3.5 8.5-8 8.5V13H8v8c-2.5-1-4-3.5-4-6.5V3Z" fill="currentColor" />
  </svg>
);

function NeonConnectButton({
  project,
  connecting,
  error,
  onConnect,
}: {
  project: Project;
  connecting: boolean;
  error: string;
  onConnect: () => void;
}) {
  if (project.neon_project_id) {
    return (
      <a
        href={`https://console.neon.tech/app/projects/${project.neon_project_id}`}
        target="_blank"
        rel="noreferrer"
        title="Open in Neon console"
        aria-label="Open this project in the Neon console"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {NEON_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onConnect}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#00e599] hover:bg-[#00cc89] text-[#003524] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {NEON_ICON}
        {connecting ? "Connecting…" : "Connect Neon"}
      </button>
      {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Firebase connect button — Google OAuth account link, then per-project
// Firestore provisioning (single click, no org picker)
// ---------------------------------------------------------------------------
const FIREBASE_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 20.5 8 3.2c.1-.7 1-.9 1.4-.3l2 3.1-1.9 3.5-4 11Z" fill="currentColor" />
    <path d="M5.5 20.5 12.2 8l2.2 4.1-4.9 8.4Z" fill="currentColor" opacity="0.7" />
    <path d="M5.5 20.5 15.8 14l2.7 5-8 3Z" fill="currentColor" opacity="0.5" />
  </svg>
);

function FirebaseConnectButton({
  project,
  firebaseLinked,
  connecting,
  error,
  onConnectAccount,
  onConnectProject,
}: {
  project: Project;
  firebaseLinked: boolean | null;
  connecting: boolean;
  error: string;
  onConnectAccount: () => void;
  onConnectProject: () => void;
}) {
  if (project.firebase_project_id) {
    return (
      <a
        href={`https://console.firebase.google.com/project/${project.firebase_project_id}/firestore`}
        target="_blank"
        rel="noreferrer"
        title="Open in Firebase console"
        aria-label="Open this project in the Firebase console"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {FIREBASE_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (firebaseLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border text-[12px] text-text-muted/50">
        {FIREBASE_ICON}
        <span>…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={firebaseLinked ? onConnectProject : onConnectAccount}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#ffca28] hover:bg-[#ffc107] text-[#1c1c1c] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {FIREBASE_ICON}
        {connecting ? "Connecting…" : firebaseLinked ? "Connect Database" : "Connect Firebase"}
      </button>
      {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Database connect modal — single entry point for all three DB providers
// ---------------------------------------------------------------------------
function DatabaseConnectModal({
  project,
  supabaseLinked,
  connectingSupabase,
  supabaseError,
  supabaseOrgs,
  onConnectSupabaseAccount,
  onStartSupabaseConnect,
  onPickSupabaseOrg,
  onDismissSupabaseOrgPicker,
  connectingNeon,
  neonError,
  onConnectNeon,
  firebaseLinked,
  connectingFirebase,
  firebaseError,
  onConnectFirebaseAccount,
  onConnectFirebaseProject,
  onClose,
}: {
  project: Project;
  supabaseLinked: boolean | null;
  connectingSupabase: boolean;
  supabaseError: string;
  supabaseOrgs: { id: string; name: string }[] | null;
  onConnectSupabaseAccount: () => void;
  onStartSupabaseConnect: () => void;
  onPickSupabaseOrg: (organizationId: string) => void;
  onDismissSupabaseOrgPicker: () => void;
  connectingNeon: boolean;
  neonError: string;
  onConnectNeon: () => void;
  firebaseLinked: boolean | null;
  connectingFirebase: boolean;
  firebaseError: string;
  onConnectFirebaseAccount: () => void;
  onConnectFirebaseProject: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-warm-xl overflow-hidden slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-ink">Connect a database</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-2.5">
          <p className="text-[12px] text-text-muted">
            Give your generated app a real database. Pick a provider below.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {SUPABASE_ICON} Supabase
            </span>
            <SupabaseConnectButton
              project={project}
              supabaseLinked={supabaseLinked}
              connecting={connectingSupabase}
              error={supabaseError}
              orgs={supabaseOrgs}
              onConnectAccount={onConnectSupabaseAccount}
              onStartConnect={onStartSupabaseConnect}
              onPickOrg={onPickSupabaseOrg}
              onDismissOrgPicker={onDismissSupabaseOrgPicker}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {NEON_ICON} Neon
            </span>
            <NeonConnectButton
              project={project}
              connecting={connectingNeon}
              error={neonError}
              onConnect={onConnectNeon}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {FIREBASE_ICON} Firebase
            </span>
            <FirebaseConnectButton
              project={project}
              firebaseLinked={firebaseLinked}
              connecting={connectingFirebase}
              error={firebaseError}
              onConnectAccount={onConnectFirebaseAccount}
              onConnectProject={onConnectFirebaseProject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Database decision modal — shown once when the initial build was withheld
// pending this exact question (see db_decision_pending on Project)
// ---------------------------------------------------------------------------
function DbDecisionModal({
  reason,
  skipping,
  error,
  onChooseProvider,
  onSkip,
}: {
  reason: string | null | undefined;
  skipping: boolean;
  error: string;
  onChooseProvider: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-warm-xl overflow-hidden slide-up">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-ink">
            This app looks like it needs a database
          </h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {reason && <p className="text-[13px] text-text-secondary leading-relaxed">{reason}</p>}
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Want to connect one now? The build will start as soon as you decide.
          </p>
          {error && (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 leading-tight">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onSkip}
              disabled={skipping}
              className="h-8 px-3 rounded-xl border border-border text-[12px] text-text-secondary hover:text-ink transition-colors disabled:opacity-60 btn-press"
            >
              {skipping ? "Continuing…" : "No, continue without one"}
            </button>
            <button
              onClick={onChooseProvider}
              disabled={skipping}
              className="h-8 px-3 rounded-xl bg-accent text-accent-foreground text-[12px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 btn-press"
            >
              Choose a provider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wire-in confirmation — shown after ANY successful database connect on an
// already-built project. Connecting only provisions the database; rewriting
// app code to use it needs this separate, explicit confirmation.
// ---------------------------------------------------------------------------
function WireInPromptModal({
  provider,
  wiringIn,
  error,
  onConfirm,
  onDismiss,
}: {
  provider: string;
  wiringIn: boolean;
  error: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-warm-xl overflow-hidden slide-up">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-ink">{provider} connected</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Want me to wire it into the app now? I'll scan the app and replace any mock/local data
            with real reads and writes through it.
          </p>
          {error && (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 leading-tight">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onDismiss}
              disabled={wiringIn}
              className="h-8 px-3 rounded-xl border border-border text-[12px] text-text-secondary hover:text-ink transition-colors disabled:opacity-60 btn-press"
            >
              Not now
            </button>
            <button
              onClick={onConfirm}
              disabled={wiringIn}
              className="h-8 px-3 rounded-xl bg-accent text-accent-foreground text-[12px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 btn-press"
            >
              {wiringIn ? "Wiring in…" : "Wire it in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stop button (inline SVG)
// ---------------------------------------------------------------------------
function StopButton({ stopping, onClick }: { stopping: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={stopping}
      title="Stop agent"
      aria-label={stopping ? "Stopping agent" : "Stop agent"}
      className="flex items-center justify-center w-5 h-5 rounded-lg bg-destructive text-white hover:bg-[oklch(0.5_0.2_25)] transition-colors disabled:opacity-50"
    >
      {stopping ? (
        <svg
          className="w-2.5 h-2.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function ProjectEditorPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<BillingStatus | null>(null);
  const [buildingPreview, setBuildingPreview] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [chatWidth, setChatWidth] = useState(loadChatWidth);
  const [draggingSplit, setDraggingSplit] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  // Shared with useChat: a send that queues an update sets this so the socket
  // does not miss the leading edge of the run.
  const prevUpdatingRef = useRef(false);
  const prevUpdatedAtRef = useRef<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}`);
      if (!res.ok) {
        setPageError(res.status === 404 ? "Project not found." : "Failed to load project.");
        return null;
      }
      const data: Project = await res.json();
      setProject(data);
      return data;
    } catch {
      setPageError("Network error.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const loadTokenBalance = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/billing/status");
      if (res.ok) setTokenBalance(await res.json());
    } catch {
      // non-critical — just skip showing the balance this time
    }
  }, []);

  useEffect(() => {
    loadTokenBalance();
  }, [loadTokenBalance]);

  // ── Feature hooks ─────────────────────────────────────────────────────────
  const activity = useAgentActivity(projectId);
  const chat = useChat({ projectId, project, setProject, activity, prevUpdatingRef });
  const integrations = useProjectIntegrations({
    projectId,
    project,
    setProject,
    fetchProject,
  });

  const {
    logs,
    currentPlan,
    writtenFiles,
    runOwnerId,
    startRun,
    takeActivitySnapshot,
    claimRunOwner,
  } = activity;

  const {
    messages,
    setMessages,
    prompt,
    setPrompt,
    sending,
    stopping,
    queue,
    lastUserMessageId,
    pinnedToBottom,
    hasUnseenActivity,
    textareaRef,
    chatEndRef,
    chatScrollRef,
    handleSend,
    handleStop,
    handleKeyDown,
    autoResize,
    cancelQueued,
    clearQueue,
    handleChatScroll,
    scrollToBottom,
    handleDeclineDatabase,
    handleRetry,
    handleEditMessage,
    handleSelectOption,
  } = chat;

  const {
    githubLinked,
    transferring,
    transferError,
    transferToGitHub,
    connectGitHubForTransfer,
    supabaseLinked,
    connectingSupabase,
    supabaseError,
    supabaseOrgs,
    connectSupabaseAccount,
    startSupabaseConnect,
    connectSupabaseProject,
    dismissSupabaseOrgPicker,
    connectingNeon,
    neonError,
    connectNeon,
    firebaseLinked,
    connectingFirebase,
    firebaseError,
    connectFirebaseAccount,
    connectFirebaseProject,
    dbModalOpen,
    openDbModal,
    closeDbModal,
    skippingDb,
    skipDbError,
    skipDatabase,
    wireInPrompt,
    wiringIn,
    wireInError,
    wireDatabaseIn,
    dismissWireInPrompt,
  } = integrations;

  useEffect(() => {
    return connectWs("/ws/projects", (ws) => {
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "projects") {
            const updated: Project | undefined = (msg.data as Project[]).find(
              (p) => p.id === projectId,
            );
            if (!updated) return;

            const wasUpdating = prevUpdatingRef.current;
            const prevUpdatedAt = prevUpdatedAtRef.current;

            prevUpdatingRef.current = updated.is_updating;
            prevUpdatedAtRef.current = updated.updated_at;

            setProject(updated);

            if (!wasUpdating || updated.is_updating) return;

            // ── The run just finished ──
            setBuildingPreview(false);
            loadTokenBalance();
            playAlertSound();

            // Freeze the activity onto the message that owns this run before
            // anything clears it. Runs with no owner (the first build, a
            // preview build, a database wire-in) hand it to the message the
            // completion itself appends, so the record still has a home.
            const snapshot = takeActivitySnapshot();
            const owner = claimRunOwner();
            if (owner) {
              setMessages((prev) =>
                prev.map((m) => (m.id === owner ? { ...m, activity: snapshot } : m)),
              );
            }

            if (!updated.build_error && prevUpdatedAt !== updated.updated_at) {
              setMessages((prev) => [
                ...prev,
                {
                  id: newId("assistant"),
                  role: "assistant",
                  text:
                    (updated as { last_summary?: string }).last_summary ||
                    "Your app has been updated successfully!",
                  timestamp: new Date(),
                  activity: owner ? undefined : snapshot,
                },
              ]);
            }

            if (updated.build_error) {
              setErrorDismissed(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: newId("err"),
                  role: "error",
                  text: `Update failed: ${updated.build_error}`,
                  timestamp: new Date(),
                  activity: owner ? undefined : snapshot,
                },
              ]);
            }
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => ws.close();
    });
  }, [projectId, loadTokenBalance, takeActivitySnapshot, claimRunOwner, setMessages]);

  async function handleBuildPreview() {
    if (buildingPreview || project?.is_updating) return;
    setBuildingPreview(true);
    startRun(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/build-preview`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const errText = (d as { detail?: string }).detail ?? "Preview build failed.";
        setMessages((prev) => [
          ...prev,
          { id: newId("err"), role: "error", text: errText, timestamp: new Date() },
        ]);
        setBuildingPreview(false);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newId("err"),
          role: "error",
          text: "Network error starting preview build.",
          timestamp: new Date(),
        },
      ]);
      setBuildingPreview(false);
    }
  }

  // Split drag. Pointer capture on the handle means the drag survives the
  // pointer crossing the iframe in the preview pane, which would otherwise
  // swallow the move events.
  const startSplitDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDraggingSplit(true);

    const move = (ev: PointerEvent) => {
      const next = Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, ev.clientX));
      setChatWidth(next);
    };
    const up = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      setDraggingSplit(false);
      setChatWidth((w) => {
        try {
          localStorage.setItem(CHAT_WIDTH_KEY, String(w));
        } catch {
          /* ignore */
        }
        return w;
      });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="w-[380px] shrink-0 border-r border-border p-4 space-y-3">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
          <div className="mt-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 bg-surface flex items-center justify-center">
          <div className="skeleton h-full w-full" />
        </div>
      </div>
    );
  }

  if (pageError || !project) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-3xl mx-auto">
        <p className="text-destructive text-[14px] mb-4">{pageError || "Project not found."}</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent/80 transition-colors"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isBuilding = project.is_updating && !project.github_url;
  const isUpdating = project.is_updating && !!project.github_url;
  const hasBuildError = !!project.build_error && !errorDismissed;
  // The composer stays live while the agent works — a message typed now is
  // queued, not refused, so the only moment the input is dead is the brief
  // POST itself.
  const inputDisabled = sending;

  function handleAskToFix() {
    if (!project?.build_error) return;
    setErrorDismissed(true);
    const fixPrompt = `The previous build failed with this error: "${project.build_error}". Please diagnose and fix the issue.`;
    setPrompt(fixPrompt);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border bg-card shadow-warm-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/projects"
            className="flex items-center gap-1 text-[12px] text-text-muted hover:text-ink transition-colors shrink-0"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Projects
          </Link>
          <span className="h-4 w-px bg-border shrink-0" />
          <h1 className="font-display text-[17px] text-ink truncate">{project.app_name}</h1>
          <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-surface border border-border text-[11px] text-text-muted font-medium">
            {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
          </span>
          {isBuilding && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] text-accent font-medium bg-accent/10 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Building…
              <StopButton stopping={stopping} onClick={handleStop} />
            </span>
          )}
          {isUpdating && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] text-accent font-medium bg-accent/10 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Updating…
              <StopButton stopping={stopping} onClick={handleStop} />
            </span>
          )}
          {hasBuildError && (
            <span className="shrink-0 text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Build failed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tokenBalance && (
            <Link
              to="/billing"
              title={`${tokenBalance.tokens_used.toLocaleString()} of ${tokenBalance.monthly_tokens.toLocaleString()} tokens used this month`}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
            >
              <Zap
                className={`h-3.5 w-3.5 ${
                  tokenBalance.tokens_remaining <= 0
                    ? "text-destructive"
                    : tokenBalance.tokens_remaining < tokenBalance.monthly_tokens * 0.1
                      ? "text-amber-500"
                      : "text-text-muted"
                }`}
              />
              <span className="font-mono-ui">
                {tokenBalance.tokens_remaining.toLocaleString()} left
              </span>
            </Link>
          )}
          {project.preview_url && (
            <a
              href={project.preview_url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-accent hover:text-accent/80 transition-colors"
            >
              Preview ↗
            </a>
          )}
          {project.github_url && !isBuilding && (
            <button
              onClick={handleBuildPreview}
              disabled={buildingPreview || project.is_updating}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-accent text-[12px] text-text-secondary hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              title={project.preview_url ? "Rebuild the preview" : "Build a live preview"}
            >
              {buildingPreview ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-text-muted/30 border-t-accent animate-spin" />
                  <span className="hidden sm:block">Building…</span>
                </>
              ) : (
                <span>{project.preview_url ? "Rebuild Preview" : "Build Preview"}</span>
              )}
            </button>
          )}
          <GitHubSyncButton
            project={project}
            githubLinked={githubLinked}
            transferring={transferring}
            transferError={transferError}
            onConnect={connectGitHubForTransfer}
            onSync={transferToGitHub}
          />
          <button
            onClick={openDbModal}
            title="Connect a database"
            aria-label="Connect a database"
            className="relative flex items-center justify-center w-8 h-8 rounded-xl border border-border text-text-muted hover:text-ink hover:border-text-muted transition-colors btn-press"
          >
            <Database className="w-4 h-4" />
            {(project.supabase_project_ref ||
              project.neon_project_id ||
              project.firebase_project_id) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-card" />
            )}
          </button>
          <button
            onClick={() => navigate({ to: "/projects/$projectId/settings", params: { projectId } })}
            title="Project settings"
            aria-label="Project settings"
            className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-text-muted hover:text-ink hover:border-text-muted transition-colors btn-press"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {dbModalOpen && (
        <DatabaseConnectModal
          project={project}
          supabaseLinked={supabaseLinked}
          connectingSupabase={connectingSupabase}
          supabaseError={supabaseError}
          supabaseOrgs={supabaseOrgs}
          onConnectSupabaseAccount={connectSupabaseAccount}
          onStartSupabaseConnect={startSupabaseConnect}
          onPickSupabaseOrg={connectSupabaseProject}
          onDismissSupabaseOrgPicker={dismissSupabaseOrgPicker}
          connectingNeon={connectingNeon}
          neonError={neonError}
          onConnectNeon={connectNeon}
          firebaseLinked={firebaseLinked}
          connectingFirebase={connectingFirebase}
          firebaseError={firebaseError}
          onConnectFirebaseAccount={connectFirebaseAccount}
          onConnectFirebaseProject={connectFirebaseProject}
          onClose={closeDbModal}
        />
      )}

      {project.db_decision_pending && !dbModalOpen && (
        <DbDecisionModal
          reason={project.db_decision_reason}
          skipping={skippingDb}
          error={skipDbError}
          onChooseProvider={openDbModal}
          onSkip={skipDatabase}
        />
      )}

      {wireInPrompt && (
        <WireInPromptModal
          provider={wireInPrompt}
          wiringIn={wiringIn}
          error={wireInError}
          onConfirm={wireDatabaseIn}
          onDismiss={dismissWireInPrompt}
        />
      )}

      {/* ── Split body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Chat ── */}
        <div
          className="flex flex-col w-full shrink-0 border-r border-border bg-background md:w-(--chat-w) md:max-w-(--chat-w)"
          style={{ "--chat-w": `${chatWidth}px` } as React.CSSProperties}
        >
          {/* Error banner */}
          {hasBuildError && (
            <div className="shrink-0 mx-3 mt-3 px-4 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-400/20 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  Build failed
                </p>
                <button
                  onClick={() => setErrorDismissed(true)}
                  className="text-amber-600/40 hover:text-amber-600 dark:text-amber-400/40 dark:hover:text-amber-400 transition-colors shrink-0"
                  title="Dismiss"
                  aria-label="Dismiss the build error"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="text-[12px] text-amber-700/75 dark:text-amber-400/75 break-words">
                {project.build_error}
              </p>

              {project.build_error_action === "support" && (
                <a
                  href="mailto:support@forgefy.dev"
                  className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 text-[12px] font-medium transition-colors"
                >
                  Contact Support ↗
                </a>
              )}
              {project.build_error_action === "retry" && (
                <button
                  onClick={() => {
                    setErrorDismissed(true);
                    fetchProject();
                  }}
                  className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 text-[12px] font-medium transition-colors"
                >
                  Try Again
                </button>
              )}
              {project.build_error_action === "user_fix" && (
                <div className="flex items-center gap-2 mt-0.5">
                  <button
                    onClick={handleAskToFix}
                    disabled={!!project.is_updating}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    Ask agent to fix
                  </button>
                  <button
                    onClick={() => setErrorDismissed(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-400/20 hover:bg-amber-500/[0.07] text-amber-600/70 dark:text-amber-400/60 text-[12px] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Building state */}
          {isBuilding && (
            <div className="shrink-0 mx-3 mt-3 px-4 py-3 rounded-xl bg-accent/8 border border-accent/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <p className="text-[12px] font-semibold text-accent">Building your app…</p>
              </div>
              <p className="text-[12px] text-accent/70">
                The agent is writing your code. Usually takes 1–3 minutes.
              </p>
            </div>
          )}

          {/* Chat history */}
          <div className="relative flex-1 min-h-0 flex flex-col">
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {messages.length === 0 && !isBuilding && !isUpdating ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted py-12">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface border border-border">
                    <svg
                      className="h-5 w-5 opacity-40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-ink mb-1">
                      Ask Forgefy to make a change
                    </p>
                    <p className="text-[12px] text-text-muted max-w-[200px]">
                      e.g. "Change the primary colour to blue"
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    <ChatBubble
                      message={msg}
                      canEdit={msg.id === lastUserMessageId}
                      onAddDatabase={openDbModal}
                      onDeclineDatabase={handleDeclineDatabase}
                      onSelectOption={handleSelectOption}
                      onRetry={handleRetry}
                      onEdit={handleEditMessage}
                    />
                    {/* The run this message owns, rendered in place. Live while it
                      is in flight, then frozen onto the message forever. */}
                    {msg.id === runOwnerId && (logs.length > 0 || currentPlan) ? (
                      <AgentActivityBlock
                        logs={logs}
                        isActive={!!project?.is_updating}
                        plan={currentPlan}
                        writtenFiles={writtenFiles}
                      />
                    ) : msg.activity ? (
                      <AgentActivityBlock
                        logs={msg.activity.logs}
                        isActive={false}
                        plan={msg.activity.plan}
                        writtenFiles={NO_FILES}
                        stats={{
                          filesChanged: msg.activity.writtenFiles.length,
                          durationMs: msg.activity.endedAt - msg.activity.startedAt,
                        }}
                      />
                    ) : null}
                  </div>
                ))
              )}
              {/* Runs with no owning message yet — the very first build, or a
                preview build started from the header. */}
              {!runOwnerId && (logs.length > 0 || currentPlan) && (
                <AgentActivityBlock
                  logs={logs}
                  isActive={!!project?.is_updating || buildingPreview}
                  plan={currentPlan}
                  writtenFiles={writtenFiles}
                />
              )}
              {/* Queued follow-ups, shown where they will land. */}
              {queue.map((q) => (
                <div key={q.id} className="flex justify-end">
                  <div className="group max-w-[88%] flex items-start gap-1.5">
                    <div className="px-4 py-3 rounded-2xl rounded-br-sm border border-dashed border-accent/40 bg-accent/[0.06] text-[13px] leading-[1.65] text-text-secondary">
                      <p className="whitespace-pre-wrap">{q.text}</p>
                      <p className="text-[10px] mt-2 text-text-muted">
                        Queued — sends when the agent finishes
                      </p>
                    </div>
                    <button
                      onClick={() => cancelQueued(q.id)}
                      aria-label="Cancel queued message"
                      title="Cancel queued message"
                      className="mt-1 flex items-center justify-center w-6 h-6 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Shown only when the user has scrolled away from the bottom, so
                new output announces itself instead of hijacking the view. */}
            {!pinnedToBottom && hasUnseenActivity && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-7 px-3 rounded-full bg-card border border-border shadow-warm-md text-[11px] text-text-secondary hover:text-ink transition-colors btn-press"
              >
                ↓ New activity
              </button>
            )}
          </div>

          {/* Input */}
          {!isBuilding && (
            <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border">
              {/* Queue dock */}
              {queue.length > 0 && (
                <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-xl bg-accent/[0.07] border border-accent/20">
                  <p className="text-[11px] text-text-secondary">
                    <span className="font-medium text-accent">{queue.length}</span>{" "}
                    {queue.length === 1 ? "message" : "messages"} queued
                  </p>
                  <button
                    onClick={clearQueue}
                    className="text-[11px] text-text-muted hover:text-ink transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div
                className={[
                  "flex flex-col gap-1 rounded-2xl border transition-all",
                  inputDisabled
                    ? "border-border bg-surface/50"
                    : "border-border bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10",
                ].join(" ")}
              >
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={autoResize}
                  onKeyDown={handleKeyDown}
                  disabled={inputDisabled}
                  rows={2}
                  className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[13px] text-ink placeholder:text-text-muted outline-none disabled:opacity-50"
                  placeholder={isUpdating ? "Queue a follow-up…" : "Describe a change…"}
                  aria-label="Describe a change"
                />
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <p className="text-[11px] text-text-muted">↵ to send · Shift+↵ newline</p>
                  <div className="flex items-center gap-1.5">
                    {/* While the agent runs, Stop and the composer coexist:
                        sending now queues rather than interrupting. */}
                    {project?.is_updating && (
                      <button
                        onClick={handleStop}
                        disabled={stopping}
                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-destructive text-white transition-colors hover:bg-[oklch(0.5_0.2_25)] disabled:opacity-50 disabled:cursor-not-allowed btn-press"
                        title="Stop agent"
                        aria-label="Stop agent"
                      >
                        {stopping ? (
                          <svg
                            className="w-3.5 h-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="5" y="5" width="14" height="14" rx="2" />
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleSend}
                      disabled={!prompt.trim() || inputDisabled}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent text-accent-foreground transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                      title={project?.is_updating ? "Queue message (↵)" : "Send (↵)"}
                      aria-label={project?.is_updating ? "Queue message" : "Send message"}
                    >
                      {sending ? (
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Split handle */}
        <div
          onPointerDown={startSplitDrag}
          onDoubleClick={() => {
            setChatWidth(CHAT_WIDTH_DEFAULT);
            try {
              localStorage.setItem(CHAT_WIDTH_KEY, String(CHAT_WIDTH_DEFAULT));
            } catch {
              /* ignore */
            }
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
          title="Drag to resize · double-click to reset"
          className={`hidden md:block relative w-1 shrink-0 cursor-col-resize transition-colors ${
            draggingSplit ? "bg-accent" : "bg-transparent hover:bg-accent/40"
          }`}
        >
          {/* Widen the grab target without widening the visual line. */}
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* ── Right: Preview / Code ── */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 bg-surface">
          {/* Tab bar */}
          <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border bg-background">
            {(["preview", "code"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  rightTab === tab ? "bg-accent/10 text-accent" : "text-text-muted hover:text-ink",
                ].join(" ")}
              >
                {tab === "preview" ? (
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                )}
                {tab === "preview" ? "Preview" : "Code"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 p-4">
            {rightTab === "preview" ? (
              <PreviewPanel
                previewUrl={project.preview_url}
                buildingPreview={buildingPreview}
                canBuildPreview={!!project.github_url && !isBuilding}
                onBuildPreview={handleBuildPreview}
                templateKey={project.template_key}
              />
            ) : (
              <CodePanel projectId={projectId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
