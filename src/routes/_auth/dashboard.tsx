import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { apiFetch, getWsUrl, type StoredSession, type Project } from "@/lib/api";

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

function GitHubConnectBanner() {
  const [status, setStatus] = useState<{ linked: boolean } | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/auth/github/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setStatus({ linked: true });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function connect() {
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

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      to={href}
      className="flex flex-col gap-1 rounded-xl border border-border bg-warm-white p-5 hover:border-accent transition-colors group"
    >
      <p className="text-[28px] font-display text-ink">{value}</p>
      <p className="text-[12px] text-text-muted group-hover:text-accent transition-colors">{label}</p>
    </Link>
  );
}

function RecentSessionRow({ session }: { session: StoredSession }) {
  const label = STATUS_LABELS[session.status] ?? session.status;
  const color = STATUS_COLORS[session.status] ?? "text-text-muted";
  const isActive = ["JOINING", "LISTENING", "PROCESSING"].includes(session.status);

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-surface transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
        <p className="text-[13px] text-ink group-hover:text-accent transition-colors truncate">
          {PLATFORM_LABELS[session.platform] ?? session.platform}
        </p>
      </div>
      <span className={`text-[12px] font-medium shrink-0 ${color}`}>{label}</span>
    </Link>
  );
}

function RecentProjectRow({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-surface transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-[13px] text-ink group-hover:text-accent transition-colors truncate">
          {project.app_name}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {project.is_updating && !project.build_error && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        )}
        <span className="text-[12px] text-text-muted">
          {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
        </span>
      </div>
    </Link>
  );
}

function NewSessionCard() {
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
      className="rounded-xl border border-border bg-warm-white p-6 mb-8"
    >
      <div className="flex max-md:flex-col items-start justify-between gap-6 flex-wrap">
        <div className="shrink-0">
          <p className="label-eyebrow mb-0.5">New session</p>
          <p className="text-[12px] text-text-muted">
            Forgefy joins your call and builds a product blueprint.
          </p>
        </div>

        <div className="flex flex-1 items-end gap-3 flex-wrap min-w-0">
          <div className="shrink-0">
            <label htmlFor="db-platform" className="label-eyebrow block mb-1">Platform</label>
            <select
              id="db-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink outline-none focus:border-accent transition-colors"
            >
              <option value="meet">Google Meet</option>
              <option value="zoom">Zoom</option>
              <option value="teams">Teams</option>
              <option value="physical">Physical / mic</option>
            </select>
          </div>

          {platform !== "physical" && (
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="db-meeting-url" className="label-eyebrow block mb-1">Meeting URL</label>
              <input
                id="db-meeting-url"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                placeholder="https://meet.google.com/abc-defg-hij"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="shrink-0 h-9 px-5 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating…" : "Start →"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-[12px] text-destructive">{error}</p>}
    </form>
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
        const msg = JSON.parse(e.data as string);
        if (msg.type === "sessions") setSessions(msg.data);
      } catch {}
    };
    sessWs.onerror = () => sessWs.close();

    const projWs = new WebSocket(getWsUrl("/ws/projects"));
    wsProjectsRef.current = projWs;
    projWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "projects") setProjects(msg.data);
      } catch {}
    };
    projWs.onerror = () => projWs.close();

    return () => {
      sessWs.close();
      projWs.close();
    };
  }, []);

  const recentSessions = sessions.slice(0, 3);
  const recentProjects = projects.slice(0, 3);
  const activeSessions = sessions.filter((s) =>
    ["JOINING", "LISTENING", "PROCESSING"].includes(s.status),
  ).length;

  return (
    <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Dashboard</p>
        <h1 className="font-display text-[32px] text-ink leading-tight">Overview</h1>
      </div>

      <GitHubConnectBanner />

      <NewSessionCard />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <StatCard label="Total sessions" value={sessions.length} href="/sessions" />
        <StatCard label="Active sessions" value={activeSessions} href="/sessions" />
        <StatCard label="Total projects" value={projects.length} href="/projects" />
        <StatCard
          label="Building"
          value={projects.filter((p) => p.is_updating && !p.build_error).length}
          href="/projects"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent sessions */}
        <div className="rounded-xl border border-border bg-warm-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="label-eyebrow">Recent sessions</p>
            <Link to="/sessions" className="text-[12px] text-accent hover:underline">
              View all →
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-text-muted">
              No sessions yet.{" "}
              <Link to="/sessions" className="text-accent hover:underline">
                Start one →
              </Link>
            </div>
          ) : (
            <div className="-mx-1">
              {recentSessions.map((s) => (
                <RecentSessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>

        {/* Recent projects */}
        <div className="rounded-xl border border-border bg-warm-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="label-eyebrow">Recent projects</p>
            <Link to="/projects" className="text-[12px] text-accent hover:underline">
              View all →
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-text-muted">
              No projects yet. Approve a blueprint to build your first app.
            </div>
          ) : (
            <div className="-mx-1">
              {recentProjects.map((p) => (
                <RecentProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
