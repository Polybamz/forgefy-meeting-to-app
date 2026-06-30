import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch, getWsUrl, type StoredSession } from "@/lib/api";

export const Route = createFileRoute("/_auth/sessions/")({
  component: SessionsPage,
  head: () => ({ meta: [{ title: "Sessions — Forgefy" }] }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  meet: "Google Meet",
  zoom: "Zoom",
  teams: "Teams",
  physical: "Physical",
};

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting",
  JOINING: "Joining…",
  LISTENING: "Listening",
  PROCESSING: "Processing",
  BLUEPRINT_READY: "Blueprint ready",
  APPROVED: "Approved",
  BUILDING: "Building",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "text-text-muted",
  JOINING: "text-accent",
  LISTENING: "text-accent",
  PROCESSING: "text-accent",
  BLUEPRINT_READY: "text-[oklch(0.55_0.18_145)]",
  APPROVED: "text-[oklch(0.55_0.18_145)]",
  BUILDING: "text-[oklch(0.55_0.18_145)]",
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function NewSessionForm({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/voxa/session/create", {
        method: "POST",
        body: JSON.stringify({ platform, meeting_url: meetingUrl.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Failed to create session.");
        return;
      }
      const session = await res.json();
      onCreated();
      navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-warm-white p-6 space-y-4"
    >
      <div>
        <p className="label-eyebrow mb-0.5">New session</p>
        <p className="text-[13px] text-text-muted">
          Forgefy joins your call and extracts a product blueprint.
        </p>
      </div>

      <div>
        <label htmlFor="platform" className="label-eyebrow block mb-1.5">Platform</label>
        <select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink outline-none focus:border-accent transition-colors"
        >
          <option value="meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="teams">Microsoft Teams</option>
          <option value="physical">Physical (upload / mic)</option>
        </select>
      </div>

      {platform !== "physical" && (
        <div>
          <label htmlFor="meeting_url" className="label-eyebrow block mb-1.5">Meeting URL</label>
          <input
            id="meeting_url"
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            placeholder="https://meet.google.com/abc-defg-hij"
          />
        </div>
      )}

      {error && <p role="alert" className="text-[13px] text-amber-600 dark:text-amber-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-[42px] rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
      >
        {loading ? "Creating…" : "Start session →"}
      </button>
    </form>
  );
}

function DeleteSessionModal({
  session,
  onClose,
  onDeleted,
}: {
  session: StoredSession;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/voxa/session/${session.id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        toast.success("Session deleted.");
        onDeleted();
      } else {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Failed to delete session.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-warm-white rounded-2xl border border-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-ink">Delete Session</h2>
          <button onClick={onClose} className="text-text-muted hover:text-ink transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-[13px] text-text-secondary">
            This will permanently delete the{" "}
            <span className="font-medium text-ink">
              {PLATFORM_LABELS[session.platform] ?? session.platform}
            </span>{" "}
            session and all its data. This cannot be undone.
          </p>

          <div className="space-y-1.5">
            <label className="text-[12px] text-text-secondary block">
              Reason for deleting <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              placeholder="e.g. Duplicate session, wrong meeting, test run…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {error && <p className="text-[12px] text-amber-600 dark:text-amber-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:text-ink hover:border-text-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-white text-[13px] font-medium hover:bg-[oklch(0.5_0.2_25)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Deleting…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  onDeleted,
}: {
  session: StoredSession;
  onDeleted: (id: string) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const date = new Date(session.created_at);
  const label = STATUS_LABELS[session.status] ?? session.status;
  const color = STATUS_COLORS[session.status] ?? "text-text-muted";
  const isActive = ["JOINING", "LISTENING", "PROCESSING"].includes(session.status);

  return (
    <>
      <div className="relative group">
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId: session.id }}
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-border bg-warm-white hover:border-accent transition-colors group"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
              <p className="text-[14px] font-medium text-ink group-hover:text-accent transition-colors truncate">
                {PLATFORM_LABELS[session.platform] ?? session.platform}
              </p>
            </div>
            {session.meeting_url && (
              <p className="mt-0.5 text-[12px] font-mono-ui text-text-muted truncate max-w-[300px]">
                {session.meeting_url}
              </p>
            )}
            <p className="mt-1 text-[11px] text-text-muted">
              {date.toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <span className={`text-[12px] font-medium shrink-0 ${color}`}>{label}</span>
        </Link>

        {/* Delete button — appears on hover */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDelete(true); }}
          title="Delete session"
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      {showDelete && (
        <DeleteSessionModal
          session={session}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { setShowDelete(false); onDeleted(session.id); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SessionsPage() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  function handleSessionDeleted(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => {
    const ws = new WebSocket(getWsUrl("/ws/sessions"));
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "sessions") setSessions(msg.data);
      } catch { /* ignore */ }
    };
    ws.onerror = () => {
      ws.close();
      toast.error("Live session updates unavailable — refresh to see latest state.");
    };
    return () => ws.close();
  }, []);

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Sessions</p>
        <h1 className="font-display text-[32px] text-ink leading-tight">Your sessions</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* New session form */}
        <div className="md:col-span-4">
          <NewSessionForm onCreated={() => {}} />
        </div>

        {/* Session list */}
        <div className="md:col-span-8 space-y-2.5">
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border text-[14px] text-text-muted">
              No sessions yet. Create one to get started.
            </div>
          ) : (
            <>
              <p className="label-eyebrow mb-3">All sessions ({sessions.length})</p>
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} onDeleted={handleSessionDeleted} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
