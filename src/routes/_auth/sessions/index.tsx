import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch, connectWs, type StoredSession } from "@/lib/api";
import { Mic2, Upload, Radio, Globe, Trash2, X } from "lucide-react";

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

const STATUS_PILL: Record<string, string> = {
  WAITING: "text-text-muted bg-surface border border-border",
  JOINING: "text-accent bg-accent/10",
  LISTENING: "text-accent bg-accent/10",
  PROCESSING: "text-accent bg-accent/10",
  BLUEPRINT_READY: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
  APPROVED: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
  BUILDING: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
};

// ---------------------------------------------------------------------------
// New session form
// ---------------------------------------------------------------------------
function NewSessionForm({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PLATFORMS = [
    { value: "meet", label: "Google Meet", icon: Globe },
    { value: "zoom", label: "Zoom", icon: Radio },
    { value: "teams", label: "Teams", icon: Radio },
    { value: "physical", label: "Physical / mic", icon: Upload },
  ];

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
      className="rounded-2xl border border-border bg-card shadow-warm-sm p-6 space-y-5"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10">
            <Mic2 className="h-3.5 w-3.5 text-accent" />
          </div>
          <p className="text-[14px] font-semibold text-ink">New session</p>
        </div>
        <p className="text-[13px] text-text-muted pl-9">
          Forgefy joins your call and extracts a product blueprint.
        </p>
      </div>

      {/* Platform */}
      <div>
        <label className="label-eyebrow block mb-2">Platform</label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlatform(p.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all btn-press ${
                  platform === p.value
                    ? "border-accent bg-accent/5 text-accent shadow-warm-xs"
                    : "border-border bg-background text-text-secondary hover:border-text-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[12px] font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* URL */}
      {platform !== "physical" && (
        <div>
          <label htmlFor="meeting_url" className="label-eyebrow block mb-1.5">
            Meeting URL
          </label>
          <input
            id="meeting_url"
            type="url"
            required
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
            placeholder={
              platform === "meet"
                ? "https://meet.google.com/abc-def-ghi"
                : platform === "zoom"
                  ? "https://zoom.us/j/123456789"
                  : "https://teams.microsoft.com/l/meetup-join/…"
            }
          />
        </div>
      )}

      {platform === "physical" && (
        <div className="rounded-xl border border-border bg-surface p-3 text-[12px] text-text-muted">
          You can upload a recording or use your microphone after the session is created.
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12px] text-destructive flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press shadow-warm-xs"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground animate-spin" />
            Creating…
          </span>
        ) : (
          "Start session →"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete modal
// ---------------------------------------------------------------------------
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-warm-xl overflow-hidden slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-ink">Delete session</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-[13px] text-text-secondary leading-relaxed">
            This will permanently delete the{" "}
            <span className="font-semibold text-ink">
              {PLATFORM_LABELS[session.platform] ?? session.platform}
            </span>{" "}
            session and all its data. This cannot be undone.
          </p>

          <div className="space-y-1.5">
            <label className="label-eyebrow block">
              Reason{" "}
              <span className="text-text-muted normal-case font-normal tracking-normal text-[11px]">
                (optional)
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="e.g. Duplicate session, wrong meeting, test run…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all resize-none"
            />
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:text-ink hover:border-text-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-white text-[13px] font-medium hover:bg-[oklch(0.5_0.2_25)] disabled:opacity-50 transition-colors btn-press"
          >
            {deleting ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------
function SessionCard({
  session,
  index,
  onDeleted,
}: {
  session: StoredSession;
  index: number;
  onDeleted: (id: string) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const date = new Date(session.created_at);
  const label = STATUS_LABELS[session.status] ?? session.status;
  const pillClass = STATUS_PILL[session.status] ?? "text-text-muted bg-surface";
  const isActive = ["JOINING", "LISTENING", "PROCESSING"].includes(session.status);

  const staggerClass = index < 8 ? `stagger-${Math.min(index + 1, 8)}` : "";

  return (
    <>
      <div className={`relative group page-enter ${staggerClass}`}>
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId: session.id }}
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:border-accent transition-all card-hover shadow-warm-xs group"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0 pulse-ring" />
              )}
              <p className="text-[14px] font-semibold text-ink group-hover:text-accent transition-colors truncate">
                {PLATFORM_LABELS[session.platform] ?? session.platform}
              </p>
            </div>
            {session.meeting_url && (
              <p className="text-[12px] font-mono-ui text-text-muted truncate max-w-[280px]">
                {session.meeting_url}
              </p>
            )}
            <p className="mt-1 text-[11px] text-text-muted">
              {date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${pillClass}`}>
              {label}
            </span>
          </div>
        </Link>

        {/* Delete button on hover */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDelete(true);
          }}
          title="Delete session"
          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {showDelete && (
        <DeleteSessionModal
          session={session}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {
            setShowDelete(false);
            onDeleted(session.id);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SessionSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border bg-card">
      <div className="space-y-2 flex-1">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-48 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
      <div className="skeleton h-6 w-20 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function SessionsPage() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  function handleSessionDeleted(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => {
    let errorToasted = false;
    return connectWs("/ws/sessions", (ws) => {
      wsRef.current = ws;
      ws.onopen = () => setWsReady(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type === "sessions") setSessions(msg.data);
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        ws.close();
        if (!errorToasted) {
          errorToasted = true;
          toast.error("Live session updates unavailable — reconnecting…");
        }
      };
    });
  }, []);

  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (wsReady) {
      setShowSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowSkeleton(false), 2000);
    return () => clearTimeout(t);
  }, [wsReady]);

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl mx-auto page-enter">
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
        <div className="grid lg:grid-cols-2 md:grid-cols-1 gap-4 md:col-span-8 space-y-3 min-lg:h-[70vh] min-lg:overflow-y-auto   p-4 space-y-3 max-lg:min-h-[400px]">
          {showSkeleton ? (
            <>
              <div className="skeleton h-3 w-28 rounded mb-4" />
              {[0, 1, 2].map((i) => (
                <SessionSkeleton key={i} />
              ))}
            </>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-border gap-3 text-center px-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface">
                <Mic2 className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-[14px] font-medium text-ink">No sessions yet</p>
              <p className="text-[13px] text-text-muted">Create one to get started.</p>
            </div>
          ) : (
            <>
              <p className="label-eyebrow mb-1">All sessions ({sessions.length})</p>
              {sessions.map((s, i) => (
                <SessionCard key={s.id} session={s} index={i} onDeleted={handleSessionDeleted} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
