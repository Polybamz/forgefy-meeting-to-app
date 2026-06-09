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

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

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

function SessionCard({ session }: { session: StoredSession }) {
  const date = new Date(session.created_at);
  const label = STATUS_LABELS[session.status] ?? session.status;
  const color = STATUS_COLORS[session.status] ?? "text-text-muted";
  const isActive = ["JOINING", "LISTENING", "PROCESSING"].includes(session.status);

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SessionsPage() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

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
                <SessionCard key={s.id} session={s} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
