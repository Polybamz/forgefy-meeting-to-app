import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  apiFetch,
  storeSession,
  listStoredSessions,
  type StoredSession,
} from "@/lib/api";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Forgefy" }] }),
});

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

function NewSessionForm({ onCreated }: { onCreated: (s: StoredSession) => void }) {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/voxa/session/create", {
        method: "POST",
        body: JSON.stringify({
          platform,
          meeting_url: meetingUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Failed to create session.");
        return;
      }
      const session = await res.json();
      const stored: StoredSession = {
        id: session.id,
        platform: session.platform,
        meeting_url: session.meeting_url,
        status: session.status,
        created_at: session.created_at,
      };
      storeSession(stored);
      onCreated(stored);
      navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const needsUrl = platform !== "physical";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-warm-white p-8 space-y-4"
      aria-label="Create new session"
    >
      <div className="label-eyebrow mb-1">New session</div>
      <p className="text-[13px] text-text-secondary -mt-2">
        Forgefy will join your call and extract a product blueprint.
      </p>

      <div>
        <label htmlFor="platform" className="label-eyebrow block mb-1.5">
          Platform
        </label>
        <select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink outline-none focus:border-accent transition-colors"
        >
          <option value="meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="teams">Microsoft Teams</option>
          <option value="physical">Physical (upload recording)</option>
        </select>
      </div>

      {needsUrl && (
        <div>
          <label htmlFor="meeting_url" className="label-eyebrow block mb-1.5">
            Meeting URL
          </label>
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

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}

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

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className="block rounded-xl border border-border bg-warm-white p-5 hover:border-accent transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-ink group-hover:text-accent transition-colors">
            {PLATFORM_LABELS[session.platform] ?? session.platform}
          </p>
          {session.meeting_url && (
            <p className="mt-0.5 text-[12px] font-mono-ui text-text-muted truncate max-w-[260px]">
              {session.meeting_url}
            </p>
          )}
        </div>
        <span className={`text-[12px] font-medium shrink-0 ${color}`}>{label}</span>
      </div>
      <p className="mt-3 text-[12px] text-text-muted">
        {date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </Link>
  );
}

function DashboardPage() {
  const [sessions, setSessions] = useState<StoredSession[]>(() =>
    listStoredSessions(),
  );

  return (
    <div className="px-6 md:px-[8vw] py-12 max-w-5xl mx-auto">
      <div className="mb-10">
        <div className="label-eyebrow mb-2">Dashboard</div>
        <h1 className="font-display text-[36px] md:text-[48px] text-ink leading-[1.1]">
          Your sessions
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <NewSessionForm onCreated={(s) => setSessions([s, ...sessions])} />
        </div>

        <div className="md:col-span-8">
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border text-[14px] text-text-muted">
              No sessions yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="label-eyebrow mb-4">Recent sessions</p>
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
