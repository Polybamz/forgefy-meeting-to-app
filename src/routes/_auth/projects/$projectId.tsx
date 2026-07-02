import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getWsUrl, type Project } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  validating: "◈",
};

const LOG_COLORS: Record<string, string> = {
  started: "text-accent",
  info: "text-[#7A6F65]",
  thinking: "text-[#9A8F85]",
  tool: "text-[oklch(0.6_0.18_145)]",
  text: "text-[#C8BFB5]",
  warning: "text-[oklch(0.65_0.18_60)]",
  error: "text-red-400",
  done: "text-[oklch(0.6_0.18_145)]",
  validating: "text-[oklch(0.65_0.15_280)]",
};

interface PlanFile { path: string; purpose?: string; changes?: string }
interface PlanDep  { package: string; reason?: string }
interface PlanData {
  summary: string;
  files_to_create: PlanFile[];
  files_to_modify: PlanFile[];
  dependencies: PlanDep[];
  steps: string[];
  constraints?: string[];
}

// ---------------------------------------------------------------------------
// AgentActivityBlock
// ---------------------------------------------------------------------------
function AgentActivityBlock({
  logs,
  isActive,
  plan,
  writtenFiles,
}: {
  logs: LogEntry[];
  isActive: boolean;
  plan: PlanData | null;
  writtenFiles: Set<string>;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [planOpen, setPlanOpen] = useState(true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0 && !isActive && !plan) return null;

  const fileItems = plan ? [
    ...plan.files_to_create.map((f: PlanFile) => ({ path: f.path, badge: "+", done: !isActive || writtenFiles.has(f.path) })),
    ...plan.files_to_modify.map((f: PlanFile) => ({ path: f.path, badge: "~", done: !isActive || writtenFiles.has(f.path) })),
  ] : [];

  return (
    <div className="flex justify-start">
      <div className="w-full text-[11px] font-mono-ui border border-[#2a2522] rounded-xl bg-[#100e0c] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2522]">
          {isActive
            ? <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            : <span className="text-[oklch(0.6_0.18_145)]">✓</span>
          }
          <span className="text-[#7A6F65]">forgefy agent</span>
          {isActive && (
            <span className="ml-auto text-[10px] text-[#5a5249]">running</span>
          )}
        </div>

        {/* Plan section */}
        {plan && (
          <>
            <button
              onClick={() => setPlanOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1a1714] transition-colors border-b border-[#2a2522]"
            >
              <span className="text-[#5a5249] uppercase tracking-wider text-[9px]">
                plan · {fileItems.filter((f) => f.done).length}/{fileItems.length} files
              </span>
              <span className="text-[#3a3633] text-[9px]">{planOpen ? "▲" : "▼"}</span>
            </button>
            {planOpen && (
              <div className="px-3 py-2 space-y-1 border-b border-[#2a2522]">
                <p className="text-[#7A6F65] leading-snug pb-1">{plan.summary}</p>
                {fileItems.map((f) => (
                  <div key={f.path} className="flex items-center gap-2 leading-[1.6]">
                    <span className={f.done ? "text-[oklch(0.6_0.18_145)]" : "text-[#5a5249]"}>
                      {f.done ? "✓" : "○"}
                    </span>
                    <span className={`break-all ${f.done ? "text-[#5a5249] line-through" : "text-[#C8BFB5]"}`}>
                      {f.path}
                    </span>
                    <span className={`shrink-0 text-[9px] ${f.badge === "+" ? "text-[oklch(0.6_0.18_145)]" : "text-[oklch(0.65_0.18_60)]"}`}>
                      {f.badge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Log stream */}
        <div className="max-h-52 overflow-y-auto px-3 py-2 space-y-0.5">
          {logs.length === 0 && isActive && (
            <span className="text-[#5a5249] italic">Connecting…</span>
          )}
          {logs.map((entry) => (
            <div key={entry.ts} className="flex items-start gap-2 leading-[1.6]">
              <span className={`shrink-0 ${LOG_COLORS[entry.type] ?? "text-[#7A6F65]"}`}>
                {LOG_ICONS[entry.type] ?? "·"}
              </span>
              {entry.type === "text" || entry.type === "done" ? (
                <Md className={`${LOG_COLORS[entry.type] ?? "text-[#7A6F65]"} text-[11px] break-words`}>
                  {entry.message}
                </Md>
              ) : (
                <span className={`${LOG_COLORS[entry.type] ?? "text-[#7A6F65]"} break-words`}>
                  {entry.message}
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border">
          <svg className="h-7 w-7 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-ink mb-1">No preview yet</p>
          <p className="text-[12px] text-text-muted max-w-[200px]">A preview URL will appear once the app is deployed.</p>
        </div>
        {canBuildPreview && (
          <button
            onClick={onBuildPreview}
            disabled={buildingPreview}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 btn-press shadow-warm-xs"
          >
            {buildingPreview ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
                Building…
              </>
            ) : "Build Preview"}
          </button>
        )}
      </div>
    );
  }

  const isAppetize = previewUrl.includes("appetize.io");
  const iframeUrl = isAppetize
    ? previewUrl.replace("appetize.io/app/", "appetize.io/embed/")
    : previewUrl;

  return (
    <div className="flex flex-col h-full rounded-xl border border-border overflow-hidden shadow-warm-xs">
      {/* Browser chrome */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
        </div>
        <p className="text-[11px] font-mono-ui text-text-muted truncate max-w-[200px]">{previewUrl}</p>
        <div className="flex items-center gap-2">
          {!isAppetize && (
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh"
              className="flex items-center justify-center w-6 h-6 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            className="flex items-center justify-center w-6 h-6 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center w-full flex-1 overflow-hidden bg-[#f5f5f5] dark:bg-[#1a1a1a]">
        <iframe
          key={refreshKey}
          src={iframeUrl}
          className="flex justify-center item-center w-[50%] h-full border-0"
          title="App preview"
          allow="camera; microphone"
          sandbox={isAppetize ? "allow-scripts allow-same-origin allow-forms allow-popups allow-modals" : "allow-scripts allow-same-origin allow-forms allow-popups"}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodePanel — file tree + syntax-highlighted viewer
// ---------------------------------------------------------------------------
const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  dart: "dart", py: "python", json: "json", yaml: "yaml", yml: "yaml",
  md: "markdown", css: "css", html: "html", sh: "bash", gradle: "gradle",
  xml: "xml", kt: "kotlin", swift: "swift", toml: "toml",
};

function fileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    ts: "📘", tsx: "⚛", js: "📒", jsx: "⚛", dart: "🎯",
    json: "📋", yaml: "📋", yml: "📋", md: "📝", css: "🎨",
    html: "🌐", sh: "⚙", gradle: "🐘", xml: "📄", py: "🐍",
    kt: "📗", swift: "🍎", toml: "⚙",
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
          active ? "bg-accent/20 text-accent font-medium" : "text-[#9A9A9A] hover:bg-[#2a2a2a] hover:text-[#D4D4D4]"
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
              <TreeNode key={k} name={k} node={v} depth={depth + 1} selected={selected} onSelect={onSelect} />
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
      const r = await apiFetch(`/api/v1/projects/${projectId}/code/file?path=${encodeURIComponent(path)}`);
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
          <p className="text-[10px] font-mono-ui text-[#858585] uppercase tracking-wider">Explorer</p>
        </div>
        {loadingTree ? (
          <div className="flex items-center justify-center flex-1 text-[11px] text-[#858585] gap-2">
            <span className="h-1 w-1 rounded-full bg-[#858585] animate-pulse" />
            Loading…
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[11px] text-[#858585]">No files yet</div>
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
                <TreeNode key={k} name={k} node={v} depth={0} selected={selected} onSelect={openFile} />
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
            <span className="px-4 py-1.5 text-[11px] font-mono-ui text-[#858585]">No file open</span>
          )}
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto">
          {!selected && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[#858585]">
              <svg className="w-8 h-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
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
function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={className}
      components={{
        p:      ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
        ul:     ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol:     ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
        li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
        em:     ({ children }) => <em className="italic text-inherit">{children}</em>,
        code:   ({ children, className: cls }) => {
          const isBlock = cls?.includes("language-");
          return isBlock
            ? <code className="block bg-black/20 rounded px-2 py-1.5 text-[10px] font-mono overflow-x-auto my-1">{children}</code>
            : <code className="bg-black/20 rounded px-1 py-0.5 text-[10px] font-mono">{children}</code>;
        },
        pre:    ({ children }) => <pre className="overflow-x-auto my-1">{children}</pre>,
        h1:     ({ children }) => <h1 className="font-semibold text-[14px] mb-1">{children}</h1>,
        h2:     ({ children }) => <h2 className="font-semibold text-[13px] mb-1">{children}</h2>,
        h3:     ({ children }) => <h3 className="font-medium text-[12px] mb-0.5">{children}</h3>,
        a:      ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 opacity-80 hover:opacity-100">{children}</a>,
        hr:     () => <hr className="border-current opacity-20 my-2" />,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-current opacity-70 pl-2 my-1">{children}</blockquote>,
      }}
    >
      {children}
    </ReactMarkdown>
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
        "max-w-[88%] px-4 py-3 text-[13px] leading-[1.65]",
        isUser
          ? "bg-accent text-accent-foreground rounded-2xl rounded-br-sm shadow-warm-xs"
          : isError
            ? "bg-amber-500/[0.07] border border-amber-400/20 text-amber-700 dark:text-amber-400 rounded-2xl rounded-bl-sm"
            : "bg-card border border-border text-text-secondary rounded-2xl rounded-bl-sm shadow-warm-xs",
      ].join(" ")}>
        {isUser
          ? <p className="whitespace-pre-wrap">{message.text}</p>
          : <Md className="text-[13px]">{message.text}</Md>
        }
        <p className={`text-[10px] mt-2 ${isUser ? "text-accent-foreground/50" : "text-text-muted"}`}>
          {message.timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

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
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">{transferError}</p>
      )}
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
      className="flex items-center justify-center w-5 h-5 rounded-lg bg-destructive text-white hover:bg-[oklch(0.5_0.2_25)] transition-colors disabled:opacity-50"
    >
      {stopping
        ? <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        : <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
      }
    </button>
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
  const [stopping, setStopping] = useState(false);
  const [sendError, setSendError] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<Set<string>>(new Set());

  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [buildingPreview, setBuildingPreview] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const navigate = useNavigate();
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
      .catch(() => { /* keep localStorage version */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-100)));
    } catch { /* ignore quota errors */ }
  }, [messages, chatStorageKey]);

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

          if (wasUpdating && !updated.is_updating) {
            setBuildingPreview(false);
          }

          if (wasUpdating && !updated.is_updating && !updated.build_error && prevUpdatedAt !== updated.updated_at) {
            setMessages((prev) => [...prev, {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: (updated as { last_summary?: string }).last_summary || "Your app has been updated successfully!",
              timestamp: new Date(),
            }]);
          }

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

          if (entry.type === "plan") {
            try {
              setCurrentPlan(JSON.parse(entry.message) as PlanData);
              setWrittenFiles(new Set());
            } catch { /* ignore malformed plan */ }
            return;
          }

          if (entry.type === "file_written") {
            if (entry.message) setWrittenFiles((prev) => new Set([...prev, entry.message as string]));
            return;
          }

          const newEntry = { ...entry, ts: Date.now() + Math.random() };
          setLogs((prev) => {
            const sliced = prev.slice(-200);
            if (entry.type === "thinking" && sliced.length > 0 && sliced[sliced.length - 1].type === "thinking") {
              return [...sliced.slice(0, -1), newEntry];
            }
            return [...sliced, newEntry];
          });
        } catch { /* ignore */ }
      };

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
      const res = await apiFetch(`/api/v1/projects/${projectId}/transfer-github`, { method: "POST" });
      if (res.ok) {
        setProject(await res.json());
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
    localStorage.setItem("forgefy_github_pending_return", `${window.location.pathname}?pending_transfer=true`);
    const res = await apiFetch("/api/v1/auth/github/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

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
    setLogs([]);
    setCurrentPlan(null);
    setWrittenFiles(new Set());

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
        if (data.response) {
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: data.response,
            timestamp: new Date(),
          }]);
        }
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

  async function handleStop() {
    if (stopping) return;
    setStopping(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/stop`, { method: "POST" });
      setProject((prev) => prev ? { ...prev, is_updating: false } : prev);
    } catch {
      // swallow
    } finally {
      setStopping(false);
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
      <div className="flex h-screen">
        <div className="w-[380px] shrink-0 border-r border-border p-4 space-y-3">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
          <div className="mt-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-2xl" />)}
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
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent/80 transition-colors">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isBuilding = project.is_updating && !project.github_url;
  const isUpdating = project.is_updating && !!project.github_url;
  const hasBuildError = !!project.build_error && !errorDismissed;
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
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
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
            onClick={() => navigate({ to: "/projects/$projectId/settings", params: { projectId } })}
            title="Project settings"
            className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-text-muted hover:text-ink hover:border-text-muted transition-colors btn-press"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Split body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Chat ── */}
        <div className="flex flex-col w-full md:w-[380px] md:max-w-[380px] shrink-0 border-r border-border bg-background">

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
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="text-[12px] text-amber-700/75 dark:text-amber-400/75 break-words">{project.build_error}</p>

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
                  onClick={() => { setErrorDismissed(true); fetchProject(); }}
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
              <p className="text-[12px] text-accent/70">The agent is writing your code. Usually takes 1–3 minutes.</p>
            </div>
          )}

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !isBuilding && !isUpdating ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted py-12">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface border border-border">
                  <svg className="h-5 w-5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-ink mb-1">Ask Forgefy to make a change</p>
                  <p className="text-[12px] text-text-muted max-w-[200px]">e.g. "Change the primary colour to blue"</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
            )}
            {logs.length > 0 && (
              <AgentActivityBlock
                logs={logs}
                isActive={isUpdating}
                plan={currentPlan}
                writtenFiles={writtenFiles}
              />
            )}
            <div ref={chatEndRef} />
          </div>

          {sendError && (
            <p role="alert" className="px-4 pb-1 text-[12px] text-amber-600 dark:text-amber-400">{sendError}</p>
          )}

          {/* Input */}
          {!isBuilding && (
            <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border">
              <div className={[
                "flex flex-col gap-1 rounded-2xl border transition-all",
                inputDisabled ? "border-border bg-surface/50" : "border-border bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10",
              ].join(" ")}>
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
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <p className="text-[11px] text-text-muted">⌘↵ to send</p>
                  {project?.is_updating ? (
                    <button
                      onClick={handleStop}
                      disabled={stopping}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-destructive text-white transition-colors hover:bg-[oklch(0.5_0.2_25)] disabled:opacity-50 disabled:cursor-not-allowed btn-press"
                      title="Stop agent"
                    >
                      {stopping ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!prompt.trim() || inputDisabled}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent text-accent-foreground transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                      title="Send (⌘↵)"
                    >
                      {sending ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
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
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
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
