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
// Chat types
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// PreviewPanel
// ---------------------------------------------------------------------------
function PreviewPanel({ previewUrl }: { previewUrl: string | null }) {
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <p className="text-[13px]">No preview available yet.</p>
        <p className="text-[12px] text-text-muted/70">A preview URL will appear here once the app is deployed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
        </div>
        <p className="text-[11px] font-mono-ui text-text-muted truncate max-w-[200px]">{previewUrl}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            title="Refresh preview"
            className="text-text-muted hover:text-ink transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            className="text-text-muted hover:text-ink transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
      <iframe
        key={refreshKey}
        src={previewUrl}
        className="flex-1 w-full border-0 rounded-b-xl"
        title="App preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-[1.6]",
          isUser
            ? "bg-accent text-accent-foreground rounded-br-sm"
            : "bg-surface border border-border text-text-secondary rounded-bl-sm",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        <p className={`text-[10px] mt-1.5 ${isUser ? "text-accent-foreground/60" : "text-text-muted"}`}>
          {message.timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UpdatingBanner
// ---------------------------------------------------------------------------
function UpdatingBanner() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-[13px] text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
      Updating your app… this usually takes 1–3 minutes.
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevUpdatingRef = useRef(false);
  const prevUpdatedAtRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // WebSocket — subscribe to project updates
  useEffect(() => {
    const ws = new WebSocket(getWsUrl("/ws/projects"));
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

          // When is_updating flips false→false after a change, inject assistant message
          if (wasUpdating && !updated.is_updating && prevUpdatedAt !== updated.updated_at) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                text: "Done! Your app has been updated and pushed to GitHub.",
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => ws.close();

    return () => ws.close();
  }, [projectId]);

  async function handleSend() {
    const text = prompt.trim();
    if (!text || sending || project?.is_updating) return;

    setSendError("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/update`, {
        method: "POST",
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const errText = (d as { detail?: string }).detail ?? "Update request failed.";
        setSendError(errText);
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", text: `Error: ${errText}`, timestamp: new Date() },
        ]);
      } else {
        // Mark project as updating optimistically
        setProject((prev) => prev ? { ...prev, is_updating: true } : prev);
        prevUpdatingRef.current = true;
      }
    } catch {
      setSendError("Network error. Please try again.");
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", text: "Network error. Please try again.", timestamp: new Date() },
      ]);
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
        <Link to="/dashboard" className="mt-4 inline-block text-[13px] text-accent underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const isUpdating = project.is_updating;
  const inputDisabled = sending || isUpdating;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-warm-white">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="text-[13px] text-text-muted hover:text-ink transition-colors shrink-0"
          >
            ← Dashboard
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-[18px] text-ink truncate">{project.app_name}</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] text-text-muted font-medium">
            {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
          </span>
          {isUpdating && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] text-accent font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Updating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {project.preview_url && (
            <a
              href={project.preview_url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-accent hover:underline"
            >
              Preview ↗
            </a>
          )}
          <a
            href={project.github_url}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-text-muted hover:text-ink transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      {/* ── Split body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Chat panel ── */}
        <div className="flex flex-col w-full md:w-[380px] md:max-w-[380px] shrink-0 border-r border-border bg-background">
          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted py-12">
                <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-[13px] text-center">
                  Describe a change and Forgefy will update your app.
                </p>
                <p className="text-[11px] text-text-muted/70 text-center">
                  e.g. "Change the primary colour to blue" or "Add a settings screen"
                </p>
              </div>
            ) : (
              messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
            )}
            {isUpdating && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-surface border border-border">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Updating banner */}
          {isUpdating && (
            <div className="px-4 pb-2">
              <UpdatingBanner />
            </div>
          )}

          {/* Send error */}
          {sendError && (
            <p role="alert" className="px-4 pb-1 text-[12px] text-destructive">
              {sendError}
            </p>
          )}

          {/* Input */}
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
        </div>

        {/* ── Right: Preview panel ── */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 p-4 bg-surface">
          <PreviewPanel previewUrl={project.preview_url} />
        </div>
      </div>
    </div>
  );
}
