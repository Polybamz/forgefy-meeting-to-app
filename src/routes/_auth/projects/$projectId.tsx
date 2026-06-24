import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getWsUrl, type Project } from "@/lib/api";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: ProjectEditorPage,
  head: () => ({ meta: [{ title: "Project — Forgefy" }] }),
});

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  timestamp: Date;
}

interface LogEntry {
  type: string;
  message: string;
  ts: number;
}

const LOG_ICONS: Record<string, string> = {
  started: "▶",
  info: "·",
  thinking: "◌",
  tool: "⚙",
  text: "✦",
  warning: "⚠",
  error: "✕",
  done: "✓",
};

const LOG_COLORS: Record<string, string> = {
  started: "text-accent",
  info: "text-text-muted",
  thinking: "text-text-secondary",
  tool: "text-[oklch(0.55_0.18_145)]",
  text: "text-text-secondary",
  warning: "text-[oklch(0.6_0.18_60)]",
  error: "text-destructive",
  done: "text-[oklch(0.55_0.18_145)]",
};

// ---------------------------------------------------------------------------
// PlanChecklist
// ---------------------------------------------------------------------------
interface PlanFile { path: string; purpose?: string; changes?: string }
interface PlanDep { package: string; reason?: string }
interface PlanData {
  summary: string;
  files_to_create: PlanFile[];
  files_to_modify: PlanFile[];
  dependencies: PlanDep[];
  steps: string[];
  constraints?: string[];
}

function PlanChecklist({ plan, writtenFiles, isDone }: { plan: PlanData; writtenFiles: Set<string>; isDone: boolean }) {
  const [open, setOpen] = useState(true);

  const fileItems = [
    ...plan.files_to_create.map(f => ({ path: f.path, label: f.purpose ?? f.path, badge: "+" })),
    ...plan.files_to_modify.map(f => ({ path: f.path, label: f.changes ?? f.path, badge: "~" })),
  ];
  const totalFiles = fileItems.length;
  const doneFiles = fileItems.filter(f => isDone || writtenFiles.has(f.path)).length;

  return (
    <div className="shrink-0 border-t border-[#222] bg-[#0c0b09]">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] hover:bg-[#111] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono-ui text-[#7A6F65]">plan</span>
          {totalFiles > 0 && (
            <span className="text-[10px] font-mono-ui text-text-muted">
              {doneFiles}/{totalFiles} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isDone && <span className="text-[10px] font-mono-ui text-[oklch(0.55_0.18_145)]">done</span>}
          <span className="text-[10px] text-text-muted">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3 max-h-56 overflow-y-auto">
          {/* Summary */}
          <p className="text-[11px] text-text-secondary leading-snug">{plan.summary}</p>

          {/* Files */}
          {fileItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono-ui text-[#5a5249] uppercase tracking-wider">Files</p>
              {fileItems.map(f => {
                const done = isDone || writtenFiles.has(f.path);
                return (
                  <div key={f.path} className="flex items-start gap-2 text-[11px] font-mono-ui leading-[1.5]">
                    <span className={`shrink-0 mt-0.5 ${done ? "text-[oklch(0.55_0.18_145)]" : "text-[#3a3633]"}`}>
                      {done ? "✓" : "○"}
                    </span>
                    <span className={`break-all ${done ? "text-[#3a3633] line-through" : "text-text-secondary"}`}>
                      {f.path}
                    </span>
                    <span className={`shrink-0 text-[9px] px-1 rounded ${f.badge === "+" ? "text-[oklch(0.55_0.18_145)] bg-[oklch(0.55_0.18_145)]/10" : "text-[oklch(0.6_0.18_60)] bg-[oklch(0.6_0.18_60)]/10"}`}>
                      {f.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Steps */}
          {plan.steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono-ui text-[#5a5249] uppercase tracking-wider">Steps</p>
              {plan.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono-ui leading-[1.5]">
                  <span className="shrink-0 text-[#3a3633]">{i + 1}.</span>
                  <span className="text-text-muted break-words">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Dependencies */}
          {plan.dependencies?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono-ui text-[#5a5249] uppercase tracking-wider">Dependencies</p>
              {plan.dependencies.map(d => (
                <div key={d.package} className="text-[11px] font-mono-ui text-text-muted">
                  + {d.package}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildLogPanel
// ---------------------------------------------------------------------------
function BuildLogPanel({ logs, isActive }: { logs: LogEntry[]; isActive: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0 && !isActive) return null;

  return (
    <div className="shrink-0 border-t border-border bg-[#0f0d0b]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#222]">
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
        <span className="text-[11px] font-mono-ui text-[#7A6F65]">build log</span>
      </div>
      <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-0.5">
        {logs.map((entry) => (
          <div key={entry.ts} className="flex items-start gap-2 text-[11px] font-mono-ui leading-[1.6]">
            <span className={`shrink-0 ${LOG_COLORS[entry.type] ?? "text-text-muted"}`}>
              {LOG_ICONS[entry.type] ?? "·"}
            </span>
            <span className={`${LOG_COLORS[entry.type] ?? "text-text-muted"} break-words`}>
              {entry.message}
            </span>
          </div>
        ))}
        {isActive && logs.length === 0 && (
          <p className="text-[11px] font-mono-ui text-[#7A6F65] italic">Connecting…</p>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewPanel
// ---------------------------------------------------------------------------
function PreviewPanel({
  previewUrl,
  buildingPreview,
  canBuildPreview,
  onBuildPreview,
}: {
  previewUrl: string | null;
  buildingPreview: boolean;
  canBuildPreview: boolean;
  onBuildPreview: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <p className="text-[13px]">No preview available yet.</p>
        <p className="text-[12px] text-text-muted/70">A preview URL will appear once the app is deployed.</p>
        {canBuildPreview && (
          <button
            onClick={onBuildPreview}
            disabled={buildingPreview}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {buildingPreview ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
                Building preview…
              </>
            ) : (
              "Build Preview"
            )}
          </button>
        )}
      </div>
    );
  }

  // Appetize.io blocks iframes on the /app/ path — /embed/ is their designated iframe URL.
  const isAppetize = previewUrl.includes("appetize.io");
  const iframeUrl = isAppetize
    ? previewUrl.replace("appetize.io/app/", "appetize.io/embed/")
    : previewUrl;

  return (
    <div className="flex flex-col  h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
        </div>
        <p className="text-[11px] font-mono-ui text-text-muted truncate max-w-[200px]">{previewUrl}</p>
        <div className="flex items-center gap-2">
          {!isAppetize && (
            <button onClick={() => setRefreshKey((k) => k + 1)} title="Refresh" className="text-text-muted hover:text-ink transition-colors">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          <a href={previewUrl} target="_blank" rel="noreferrer" title="Open in new tab" className="text-text-muted hover:text-ink transition-colors">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center w-full border-6 h-full overflow-hidden">
        <iframe
          key={refreshKey}
          src={iframeUrl}
          className="flex justify-center item-center w-[50%] h-full border-0   rounded-b-xl"
          title="App preview"
          allow="camera; microphone"
          sandbox={isAppetize ? "allow-scripts allow-same-origin allow-forms allow-popups allow-modals" : "allow-scripts allow-same-origin allow-forms allow-popups"}
        />
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatBubble
// ---------------------------------------------------------------------------
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={[
        "max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-[1.6]",
        isUser ? "bg-accent text-accent-foreground rounded-br-sm" :
          isError ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-sm" :
            "bg-surface border border-border text-text-secondary rounded-bl-sm",
      ].join(" ")}>
        <p className="whitespace-pre-wrap">{message.text}</p>
        <p className={`text-[10px] mt-1.5 ${isUser ? "text-accent-foreground/60" : "text-text-muted"}`}>
          {message.timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub sync button — always visible in the header
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
  // Already on user's account — show linked repo
  if (project.repo_owner === "user" && project.github_url) {
    return (
      <a
        href={project.github_url}
        target="_blank"
        rel="noreferrer"
        title={project.repo_full_name ?? undefined}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {GH_ICON}
        <span className="hidden sm:block max-w-[140px] truncate">
          {project.repo_full_name ?? "GitHub"}
        </span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  // Still checking GitHub status
  if (githubLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] text-text-muted/50">
        {GH_ICON}
        <span>…</span>
      </div>
    );
  }

  // GitHub not connected — prompt OAuth
  if (!githubLinked) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors"
      >
        {GH_ICON}
        Connect GitHub
      </button>
    );
  }

  // Connected but repo still on Forgefy's account — sync button
  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onSync}
        disabled={transferring}
        title={transferError || "Push this project to your GitHub account"}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors disabled:opacity-60"
      >
        {GH_ICON}
        {transferring ? "Syncing…" : "Sync to GitHub"}
      </button>
      {transferError && (
        <p className="text-[10px] text-destructive max-w-[180px] text-right leading-tight">{transferError}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function ProjectEditorPage() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const chatStorageKey = `forgefy_chat_${projectId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ id: string; role: string; text: string; timestamp: string }>;
        return arr.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })) as ChatMessage[];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<Set<string>>(new Set());

  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [buildingPreview, setBuildingPreview] = useState(false);
  const pendingTransferRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wsLogsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevUpdatingRef = useRef(false);
  const prevUpdatedAtRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On mount: fetch authoritative history from the server (overwrites the localStorage cache)
  useEffect(() => {
    apiFetch(`/api/v1/projects/${projectId}/chat-history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages: Array<{ id: string; role: string; text: string; timestamp: string }> } | null) => {
        if (data?.messages?.length) {
          const serverMsgs = data.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })) as ChatMessage[];
          setMessages(serverMsgs);
          localStorage.setItem(chatStorageKey, JSON.stringify(serverMsgs));
        }
      })
      .catch(() => { /* keep localStorage version on network failure */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Write to localStorage immediately on every change
  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-100)));
    } catch { /* ignore quota errors */ }
  }, [messages, chatStorageKey]);

  // Write to the server 1 s after the last change (debounced to avoid flooding)
  useEffect(() => {
    if (messages.length === 0) return;
    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      apiFetch(`/api/v1/projects/${projectId}/chat-history`, {
        method: "POST",
        body: JSON.stringify({ messages: messages.slice(-100) }),
      }).catch(() => { });
    }, 1000);
    return () => { if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current); };
  }, [messages, projectId]);

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

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    apiFetch("/api/v1/auth/github/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setGithubLinked(d.linked))
      .catch(() => { });

    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setGithubLinked(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("pending_transfer") === "true") {
      setGithubLinked(true);
      pendingTransferRef.current = true;
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // WebSocket for project state updates
  useEffect(() => {
    const ws = new WebSocket(getWsUrl("/ws/projects"));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "projects") {
          const updated: Project | undefined = (msg.data as Project[]).find((p) => p.id === projectId);
          if (!updated) return;

          const wasUpdating = prevUpdatingRef.current;
          const prevUpdatedAt = prevUpdatedAtRef.current;

          prevUpdatingRef.current = updated.is_updating;
          prevUpdatedAtRef.current = updated.updated_at;

          setProject(updated);

          // Any is_updating → false transition: clear preview-build spinner
          if (wasUpdating && !updated.is_updating) {
            setBuildingPreview(false);
          }

          // Update done (no error): inject assistant message
          // Clear the plan checklist 2 s after the update finishes (success or failure)
          if (wasUpdating && !updated.is_updating) {
            setTimeout(() => { setCurrentPlan(null); setWrittenFiles(new Set()); }, 2000);
          }

          if (wasUpdating && !updated.is_updating && !updated.build_error && prevUpdatedAt !== updated.updated_at) {
            setMessages((prev) => [...prev, {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: (updated as { last_summary?: string }).last_summary || "Your app has been updated successfully!",
              timestamp: new Date(),
            }]);
          }

          // Update failed: inject error message and reset dismiss state
          if (wasUpdating && !updated.is_updating && updated.build_error) {
            setErrorDismissed(false);
            setMessages((prev) => [...prev, {
              id: `err-${Date.now()}`,
              role: "error",
              text: `Update failed: ${updated.build_error}`,
              timestamp: new Date(),
            }]);
          }
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => ws.close();

    return () => ws.close();
  }, [projectId]);

  // WebSocket for build logs — reconnects on close/error so a token refresh
  // mid-session (30 min expiry) doesn't leave the panel stuck on "Connecting…"
  useEffect(() => {
    let ws: WebSocket;
    let dead = false;

    function connect() {
      if (dead) return;
      ws = new WebSocket(getWsUrl(`/ws/projects/${projectId}/logs`));
      wsLogsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const entry = JSON.parse(e.data);
          if (entry.type === "ping") return;

          // Structured plan event — render as checklist, not a log line
          if (entry.type === "plan") {
            try {
              setCurrentPlan(JSON.parse(entry.message) as PlanData);
              setWrittenFiles(new Set());
            } catch { /* ignore malformed plan */ }
            return;
          }

          // Track file writes for the plan checklist
          if (entry.type === "file_written") {
            if (entry.message) setWrittenFiles(prev => new Set([...prev, entry.message as string]));
            return;
          }

          const newEntry = { ...entry, ts: Date.now() + Math.random() };
          setLogs((prev) => {
            const sliced = prev.slice(-200);
            // Overwrite the last entry if it was also a thinking chunk — shows live progress
            // without flooding the log with hundreds of small lines.
            if (entry.type === "thinking" && sliced.length > 0 && sliced[sliced.length - 1].type === "thinking") {
              return [...sliced.slice(0, -1), newEntry];
            }
            return [...sliced, newEntry];
          });
        } catch { /* ignore */ }
      };

      // On any close/error, wait 2 s then reconnect with the latest token
      // (apiFetch may have refreshed it in the meantime).
      ws.onclose = () => { if (!dead) setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => { dead = true; ws?.close(); };
  }, [projectId]);

  async function transferToGitHub() {
    setTransferring(true);
    setTransferError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/transfer-github`, {
        method: "POST",
      });
      if (res.ok) {
        const updated: Project = await res.json();
        setProject(updated);
      } else {
        const d = await res.json().catch(() => ({}));
        setTransferError((d as { detail?: string }).detail ?? "Transfer failed. Please try again.");
      }
    } catch {
      setTransferError("Network error. Please try again.");
    } finally {
      setTransferring(false);
    }
  }

  async function connectGitHubForTransfer() {
    localStorage.setItem(
      "forgefy_github_pending_return",
      `${window.location.pathname}?pending_transfer=true`,
    );
    const res = await apiFetch("/api/v1/auth/github/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  // Auto-trigger transfer after returning from OAuth
  useEffect(() => {
    if (pendingTransferRef.current && project && !project.is_updating) {
      pendingTransferRef.current = false;
      transferToGitHub();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function handleBuildPreview() {
    if (buildingPreview || project?.is_updating) return;
    setBuildingPreview(true);
    setLogs([]);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/build-preview`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const errText = (d as { detail?: string }).detail ?? "Preview build failed.";
        setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "error", text: errText, timestamp: new Date() }]);
        setBuildingPreview(false);
      }
      // On success the backend sets is_updating=true; keep buildingPreview=true
      // until the WebSocket tells us is_updating went back to false.
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "error", text: "Network error starting preview build.", timestamp: new Date() }]);
      setBuildingPreview(false);
    }
  }

  async function handleSend() {
    const text = prompt.trim();
    if (!text || sending || project?.is_updating) return;

    setSendError("");
    setSending(true);
    setLogs([]); // clear previous log so new activity shows from the top

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const errText = (d as { detail?: string }).detail ?? "Request failed.";
        setSendError(errText);
        setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "error", text: errText, timestamp: new Date() }]);
      } else {
        const data = await res.json() as { type: string; response: string; update_queued: boolean };
        // Always show the assistant's reply immediately
        if (data.response) {
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: data.response,
            timestamp: new Date(),
          }]);
        }
        // Only enter "updating" state when an actual build was queued
        // (don't clear logs here — the "Analysing…" entry already arrived via WebSocket)
        if (data.update_queued) {
          setProject((prev) => prev ? { ...prev, is_updating: true, build_error: null } : prev);
          prevUpdatingRef.current = true;
        }
      }
    } catch {
      const errText = "Network error. Please try again.";
      setSendError(errText);
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "error", text: errText, timestamp: new Date() }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted text-[14px]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse mr-2" />
        Loading project…
      </div>
    );
  }

  if (pageError || !project) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-3xl mx-auto">
        <p className="text-destructive text-[14px]">{pageError || "Project not found."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-[13px] text-accent underline">← Back to dashboard</Link>
      </div>
    );
  }

  const isBuilding = project.is_updating && !project.github_url;
  const isUpdating = project.is_updating && !!project.github_url;
  const hasBuildError = !!project.build_error && !errorDismissed;
  const inputDisabled = sending || project.is_updating;

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
      <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-warm-white">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-[13px] text-text-muted hover:text-ink transition-colors shrink-0">← Dashboard</Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-[18px] text-ink truncate">{project.app_name}</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] text-text-muted font-medium">
            {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
          </span>
          {isBuilding && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] text-accent font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Building…
            </span>
          )}
          {isUpdating && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] text-accent font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Updating…
            </span>
          )}
          {hasBuildError && (
            <span className="shrink-0 text-[12px] font-medium text-destructive">Build failed</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {project.preview_url && (
            <a href={project.preview_url} target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">Preview ↗</a>
          )}
          {project.github_url && !isBuilding && (
            <button
              onClick={handleBuildPreview}
              disabled={buildingPreview || project.is_updating}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border hover:border-accent text-[12px] text-text-secondary hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </header>

      {/* ── Split body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Chat + log panel ── */}
        <div className="flex flex-col w-full md:w-[380px] md:max-w-[380px] shrink-0 border-r border-border bg-background">

          {/* Error banner with action buttons */}
          {hasBuildError && (
            <div className="shrink-0 mx-4 mt-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-medium text-destructive">Build failed</p>
                <button
                  onClick={() => setErrorDismissed(true)}
                  className="text-destructive/50 hover:text-destructive transition-colors shrink-0"
                  title="Dismiss"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="text-[12px] text-destructive/80 break-words">{project.build_error}</p>

              {/* action = "support" */}
              {project.build_error_action === "support" && (
                <a
                  href="mailto:support@forgefy.dev"
                  className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-[12px] font-medium transition-colors"
                >
                  Contact Support ↗
                </a>
              )}

              {/* action = "retry" */}
              {project.build_error_action === "retry" && (
                <button
                  onClick={() => { setErrorDismissed(true); fetchProject(); }}
                  className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-[12px] font-medium transition-colors"
                >
                  Try Again
                </button>
              )}

              {/* action = "user_fix" */}
              {project.build_error_action === "user_fix" && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={handleAskToFix}
                    disabled={!!project.is_updating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    Ask agent to fix
                  </button>
                  <button
                    onClick={() => setErrorDismissed(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/20 hover:bg-destructive/10 text-destructive/70 text-[12px] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Building state (initial build, no github_url yet) */}
          {isBuilding && (
            <div className="shrink-0 mx-4 mt-4 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <p className="text-[12px] font-medium text-accent">Building your app…</p>
              </div>
              <p className="text-[11px] text-accent/80">The agent is writing your code. This usually takes 1–3 minutes. Watch the log below.</p>
            </div>
          )}

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !isBuilding ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted py-12">
                <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-[13px] text-center">Describe a change and Forgefy will update your app.</p>
                <p className="text-[11px] text-text-muted/70 text-center">e.g. "Change the primary colour to blue"</p>
              </div>
            ) : (
              messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
            )}
            {isUpdating && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-surface border border-border">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Send error */}
          {sendError && <p role="alert" className="px-4 pb-1 text-[12px] text-destructive">{sendError}</p>}

          {/* Input (hidden during initial build) */}
          {!isBuilding && (
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border">
              <div className={`flex flex-col gap-2 rounded-xl border ${inputDisabled ? "border-border bg-surface/50" : "border-border bg-warm-white focus-within:border-accent"} transition-colors`}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={autoResize}
                  onKeyDown={handleKeyDown}
                  disabled={inputDisabled}
                  rows={2}
                  className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[13px] text-ink placeholder:text-text-muted outline-none disabled:opacity-50"
                  placeholder={isUpdating ? "Updating app…" : "Describe a change…"}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <p className="text-[11px] text-text-muted">⌘↵ to send</p>
                  <button
                    onClick={handleSend}
                    disabled={!prompt.trim() || inputDisabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-[12px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? "Sending…" : "Send →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plan checklist — shown while an update is running */}
          {currentPlan && (
            <PlanChecklist
              plan={currentPlan}
              writtenFiles={writtenFiles}
              isDone={!project.is_updating}
            />
          )}

          {/* Build log panel */}
          <BuildLogPanel logs={logs} isActive={project.is_updating} />
        </div>

        {/* ── Right: Preview ── */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 p-4 bg-surface  ">
          <PreviewPanel
            previewUrl={project.preview_url}
            buildingPreview={buildingPreview}
            canBuildPreview={!!project.github_url && !isBuilding}
            onBuildPreview={handleBuildPreview}
          />
        </div>
      </div>
    </div>
  );
}
