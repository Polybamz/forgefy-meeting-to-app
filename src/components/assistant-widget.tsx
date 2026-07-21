import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, X, ArrowUp, Trash2, Loader2, SquarePen, MessagesSquare, ArrowLeft } from "lucide-react";
import { apiFetch, getToken, setTokens } from "@/lib/api";
import { oauthErrorMessage, signInWithOAuth, type OAuthProviderName } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Global "help me with my task" assistant.
//
// A floating launcher + chat panel mounted app-wide. It talks to
// POST /api/v1/assistant/chat, which serves both signed-in and anonymous
// visitors: it advises, deep-links around the app, and can start a session.
// Anything that needs an account, when the visitor is logged out, comes back as
// an `auth_required` action — the widget then shows an inline sign-in panel and
// replays the original request once the user is authenticated.
// ---------------------------------------------------------------------------

interface AssistantLink {
  label: string;
  to: string;
}

interface AssistantAction {
  type: "none" | "start_session" | "auth_required";
  platform?: string | null;
  meeting_url?: string | null;
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  links?: AssistantLink[];
}

interface Conversation {
  id: string;
  title: string;
  updated_at?: string | null;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Routes where the widget shouldn't appear: the auth screens (which own the
// sign-in flow) and the full-screen project editor (which has its own chat).
function isHidden(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register" || /^\/projects\/[^/]+/.test(pathname);
}

const GREETING: AssistantMessage = {
  id: "greeting",
  role: "assistant",
  text: "Hi! I'm your Forgefy assistant. Ask me how to turn a meeting into an app, start a session, or find your way around.",
};

const PLATFORM_LABELS: Record<string, string> = {
  meet: "Google Meet",
  zoom: "Zoom",
  teams: "Teams",
  physical: "physical",
};

// Platforms Forgefy joins with a bot; "physical" instead records/uploads on the
// session page, so it is never auto-joined.
const ONLINE_PLATFORMS = new Set(["meet", "zoom", "teams"]);

function Md({ children }: { children: string }) {
  return (
    <div className="text-[13px] leading-relaxed [&_a]:underline [&_a]:underline-offset-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="bg-black/10 rounded px-1 py-0.5 text-[11px] font-mono">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="opacity-90 hover:opacity-100"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline auth panel — shown when the backend returns an `auth_required` action.
// Mirrors the login/register pages: Google, GitHub, and email + password.
// ---------------------------------------------------------------------------
function AuthPanel({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProviderName | null>(null);

  async function onOAuth(provider: OAuthProviderName) {
    setError("");
    setOauthLoading(provider);
    try {
      const idToken = await signInWithOAuth(provider);
      const res = await fetch("/api/v1/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Sign-in failed.");
        return;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      onAuthed();
    } catch (err: unknown) {
      const message = oauthErrorMessage(err, provider === "github" ? "GitHub" : "Google");
      if (message) setError(message);
    } finally {
      setOauthLoading(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const reg = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!reg.ok) {
          const d = await reg.json().catch(() => ({}));
          setError((d as { detail?: string }).detail ?? "Registration failed.");
          return;
        }
      }
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Invalid credentials.");
        return;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      onAuthed();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || oauthLoading !== null;

  return (
    <div className="p-3 space-y-3">
      <p className="text-[12px] text-text-secondary text-center">
        {mode === "login" ? "Sign in to continue" : "Create a free account to continue"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOAuth("google")}
          disabled={busy}
          className="h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-ink hover:bg-surface disabled:opacity-60 btn-press"
        >
          {oauthLoading === "google" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Google"}
        </button>
        <button
          type="button"
          onClick={() => onOAuth("github")}
          disabled={busy}
          className="h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-[12px] font-medium text-ink hover:bg-surface disabled:opacity-60 btn-press"
        >
          {oauthLoading === "github" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "GitHub"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-text-muted">or email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent"
        />
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-9 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:opacity-90 disabled:opacity-60 btn-press"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : mode === "login" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "register" : "login"));
          setError("");
        }}
        className="w-full text-[12px] text-text-muted hover:text-ink transition-colors"
      >
        {mode === "login" ? "No account? Create one free" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
export function AssistantWidget() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [open, setOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  // Conversation threads (signed-in only).
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [view, setView] = useState<"chat" | "list">("chat");
  const pendingRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auth state comes from the stored token (client-only).
  useEffect(() => {
    setAuthed(!!getToken());
  }, [open, pathname]);

  // Fetch the thread list; returns it so callers can act on the newest.
  async function loadConversations(): Promise<Conversation[]> {
    if (!getToken()) return [];
    try {
      const res = await apiFetch("/api/v1/assistant/conversations");
      if (!res.ok) return [];
      const data = (await res.json()) as { conversations?: Conversation[] };
      const list = data.conversations ?? [];
      setConversations(list);
      return list;
    } catch {
      return [];
    }
  }

  // Open a thread and load its messages into the chat view.
  async function switchTo(id: string) {
    setView("chat");
    try {
      const res = await apiFetch(`/api/v1/assistant/conversations/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        id: string;
        messages?: { role: string; text: string }[];
      };
      const loaded = (data.messages ?? [])
        .filter((m) => m.text && (m.role === "user" || m.role === "assistant"))
        .map((m, i) => ({
          id: `hist-${i}`,
          role: m.role as "user" | "assistant",
          text: m.text,
        }));
      setConversationId(id);
      setMessages(loaded.length ? loaded : [GREETING]);
    } catch {
      /* leave the current view untouched on failure */
    }
  }

  // Start a fresh thread — created server-side on the first message.
  function newChat() {
    setConversationId(null);
    setMessages([GREETING]);
    setView("chat");
    setShowAuth(false);
    setInput("");
  }

  async function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
    try {
      await apiFetch(`/api/v1/assistant/conversations/${id}`, { method: "DELETE" });
    } catch {
      /* list already updated locally */
    }
  }

  // On first open for a signed-in user, resume the most recent thread.
  useEffect(() => {
    if (!open || loadedOnce) return;
    setLoadedOnce(true);
    if (!getToken()) return;
    void (async () => {
      const list = await loadConversations();
      if (list.length) await switchTo(list[0].id);
    })();
  }, [open, loadedOnce]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open, showAuth]);

  useEffect(() => {
    if (open && !showAuth) inputRef.current?.focus();
  }, [open, showAuth]);

  // Send a turn and handle the reply's action. Does NOT add the user bubble —
  // callers do that so an auth-gated retry doesn't duplicate it.
  async function runChat(text: string) {
    setSending(true);
    try {
      const loggedIn = !!getToken();
      const body: Record<string, unknown> = { message: text, page: pathname };
      if (loggedIn) {
        if (conversationId) body.conversation_id = conversationId;
      } else {
        // Anonymous visitors have no server history, so pass recent turns along.
        body.history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-8)
          .map((m) => ({ role: m.role, text: m.text }));
      }

      const res = await apiFetch("/api/v1/assistant/chat", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "error", text: "Something went wrong. Please try again." },
        ]);
        return;
      }
      const data = (await res.json()) as {
        response: string;
        links?: AssistantLink[];
        action?: AssistantAction | null;
        conversation_id?: string | null;
      };
      // Adopt the thread id (a new thread is created on the first message) and
      // refresh the switcher so its title/ordering stays current.
      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
      }
      if (loggedIn) void loadConversations();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.response,
          links: data.links?.length ? data.links : undefined,
        },
      ]);

      const action = data.action;
      if (action?.type === "auth_required") {
        pendingRef.current = text;
        setShowAuth(true);
      } else if (action?.type === "start_session" && getToken()) {
        await startSession(action);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "error", text: "Network error. Please try again." },
      ]);
    } finally {
      setSending(false);
      if (!showAuth) inputRef.current?.focus();
    }
  }

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
    await runChat(trimmed);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await submit(text);
  }

  // Create the session, join the meeting automatically (for online platforms),
  // then open its live page. The backend only sends start_session once it has
  // everything needed to create (platform, plus a URL for online meetings), so
  // there's no form fallback — missing details are gathered in the conversation.
  async function startSession(action: AssistantAction) {
    const platform = action.platform ?? undefined;
    const url = action.meeting_url ?? undefined;
    if (!platform) return;

    try {
      const res = await apiFetch("/api/v1/voxa/session/create", {
        method: "POST",
        body: JSON.stringify({ platform, meeting_url: url ?? null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "error",
            text: (d as { detail?: string }).detail ?? "Couldn't start the session.",
          },
        ]);
        return;
      }
      const session = (await res.json()) as { id: string };

      // Online meetings get joined automatically; physical sessions record or
      // upload on the session page, so there's nothing to join there.
      if (ONLINE_PLATFORMS.has(platform)) {
        try {
          await apiFetch("/api/v1/voxa/session/join", {
            method: "POST",
            body: JSON.stringify({ session_id: session.id }),
          });
        } catch {
          /* the session page still offers a manual join if this fails */
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `sess-${Date.now()}`,
          role: "assistant",
          text: `✓ Session started — opening your ${PLATFORM_LABELS[platform] ?? platform} session…`,
        },
      ]);
      setOpen(false);
      navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "error", text: "Network error starting the session." },
      ]);
    }
  }

  function onAuthed() {
    setAuthed(true);
    setShowAuth(false);
    void loadConversations();
    const pending = pendingRef.current;
    pendingRef.current = null;
    setMessages((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, role: "assistant", text: "You're signed in — let me handle that." },
    ]);
    if (pending) void runChat(pending);
  }

  function followLink(to: string) {
    setOpen(false);
    // Links are validated server-side against the real route list, so this
    // runtime string is a safe destination even though `to` is typed as a
    // route literal.
    navigate({ to: to as never });
  }

  if (isHidden(pathname)) return null;

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-warm-lg hover:shadow-warm-xl transition-all btn-press"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[84px] right-5 z-40 w-[min(calc(100vw-2.5rem),380px)] h-[min(70vh,560px)] flex flex-col rounded-2xl border border-border bg-card shadow-warm-xl overflow-hidden slide-up">
          {/* Header */}
          <div className="h-[52px] shrink-0 flex items-center justify-between px-3 border-b border-border/60 frost">
            {view === "list" ? (
              <button
                onClick={() => setView("chat")}
                className="flex items-center gap-1.5 px-1.5 h-8 rounded-lg text-[15px] font-display text-ink hover:bg-surface transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Chats
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="font-display text-[15px] text-ink">Assistant</span>
              </div>
            )}
            {authed && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={newChat}
                  aria-label="New chat"
                  title="New chat"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
                {view === "chat" && (
                  <button
                    onClick={() => {
                      void loadConversations();
                      setView("list");
                    }}
                    aria-label="Your chats"
                    title="Your chats"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
                  >
                    <MessagesSquare className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-3 py-2",
                    m.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : m.role === "error"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-surface text-ink",
                  ].join(" ")}
                >
                  {m.role === "assistant" ? (
                    <Md>{m.text}</Md>
                  ) : (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.links && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.links.map((l) => (
                        <button
                          key={l.to}
                          onClick={() => followLink(l.to)}
                          className="text-[12px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors btn-press"
                        >
                          {l.label} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 bg-surface text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Composer or inline auth */}
          {showAuth ? (
            <div className="shrink-0 border-t border-border/60">
              <AuthPanel onAuthed={onAuthed} />
            </div>
          ) : (
            <div className="shrink-0 border-t border-border/60 p-2.5">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  placeholder="Ask anything…"
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  className="flex-1 resize-none bg-transparent text-[13px] text-ink placeholder:text-text-muted outline-none max-h-[120px] py-1"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity btn-press shrink-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
