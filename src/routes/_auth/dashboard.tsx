import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  apiFetch,
  getWsUrl,
  type StoredSession,
  type Project,
} from "@/lib/api";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Forgefy" }] }),
});

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

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

function NewSessionForm({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: SubmitEvent) {
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
      onCreated();
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

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="block rounded-xl border border-border bg-warm-white p-5 hover:border-accent transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink group-hover:text-accent transition-colors truncate">
            {project.app_name}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {project.build_error && (
            <span className="text-[11px] font-medium text-destructive">Build failed</span>
          )}
          {project.is_updating && !project.build_error && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          )}
          {project.preview_url && (
            <a
              href={project.preview_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-accent hover:underline"
            >
              Preview ↗
            </a>
          )}
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-text-muted hover:text-ink transition-colors"
            >
              GitHub ↗
            </a>
          )}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-text-muted">
        Updated{" "}
        {new Date(project.updated_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </Link>
  );
}

function GitHubConnectBanner() {
  const [status, setStatus] = useState<{ linked: boolean; username?: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/auth/github/status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});

    // Handle callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setStatus({ linked: true });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function connect() {
    console.log("Connecting GitHub...");
    const res = await apiFetch("/api/v1/auth/github/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  if (!status || status.linked) return null;

  return (
    <div className="mb-8 rounded-xl border border-border bg-warm-white p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium text-ink">Connect your GitHub</p>
        <p className="text-[12px] text-text-muted mt-0.5">
          New apps will be created under your personal GitHub account.
        </p>
      </div>
      <button
        onClick={connect}
        className="shrink-0 px-4 py-2 rounded-xl bg-[#24292e] text-white text-[13px] font-medium hover:bg-[#1a1e22] transition-colors"
      >
        Connect GitHub
      </button>
    </div>
  );
}

function DashboardPage() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const wsSessionsRef = useRef<WebSocket | null>(null);
  const wsProjectsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sessWs = new WebSocket(getWsUrl("/ws/sessions"));
    wsSessionsRef.current = sessWs;
    sessWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "sessions") setSessions(msg.data);
      } catch {}
    };
    sessWs.onerror = () => sessWs.close();

    const projWs = new WebSocket(getWsUrl("/ws/projects"));
    wsProjectsRef.current = projWs;
    projWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "projects") setProjects(msg.data);
      } catch {}
    };
    projWs.onerror = () => projWs.close();

    return () => {
      sessWs.close();
      projWs.close();
    };
  }, []);

  return (
    <div className="px-6 md:px-[8vw] py-12 max-w-5xl mx-auto">
      <div className="mb-10">
        <div className="label-eyebrow mb-2">Dashboard</div>
        <h1 className="font-display text-[36px] md:text-[48px] text-ink leading-[1.1]">
          Your workspace
        </h1>
      </div>

      <GitHubConnectBanner />

      {/* Projects */}
      {projects.length > 0 && (
        <div className="mb-12">
          <p className="label-eyebrow mb-4">Your apps</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <NewSessionForm onCreated={() => {}} />
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
