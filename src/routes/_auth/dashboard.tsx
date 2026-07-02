import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { apiFetch, getWsUrl, type StoredSession, type Project } from "@/lib/api";
import { LayoutDashboard, Mic2, FolderKanban, Github, ArrowRight, Circle } from "lucide-react";

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

const PLATFORM_ICONS: Record<string, string> = {
  meet: "M",
  zoom: "Z",
  teams: "T",
  physical: "🎙",
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
  WAITING: "text-text-muted bg-surface",
  JOINING: "text-accent bg-accent/10",
  LISTENING: "text-accent bg-accent/10",
  PROCESSING: "text-accent bg-accent/10",
  BLUEPRINT_READY: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
  APPROVED: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
  BUILDING: "text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10",
};

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="skeleton h-8 w-16 rounded-lg" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="skeleton h-7 w-7 rounded-lg shrink-0" />
        <div className="skeleton h-3.5 w-28 rounded" />
      </div>
      <div className="skeleton h-3 w-16 rounded" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub connect banner
// ---------------------------------------------------------------------------
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
      const returnUrl = localStorage.getItem("forgefy_github_pending_return");
      if (returnUrl) {
        localStorage.removeItem("forgefy_github_pending_return");
        window.location.replace(returnUrl);
      }
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
    <div className="mb-6 rounded-2xl border border-border bg-card shadow-warm-sm overflow-hidden slide-up">
      <div className="flex items-center gap-4 p-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#24292e] shrink-0">
          <Github className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-ink">Connect your GitHub</p>
          <p className="text-[12px] text-text-muted mt-0.5">
            New apps will be pushed to your personal GitHub account.
          </p>
        </div>
        <button
          onClick={connect}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#24292e] text-white text-[13px] font-medium hover:bg-[#1a1e22] transition-colors btn-press"
        >
          Connect
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  href,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ElementType;
  accent?: boolean;
  loading?: boolean;
}) {
  if (loading) return <SkeletonCard />;

  return (
    <Link
      to={href}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 hover:border-accent transition-all duration-200 card-hover shadow-warm-xs"
    >
      <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${accent ? "bg-accent/10" : "bg-surface"} transition-colors group-hover:bg-accent/10`}>
        <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-text-secondary"} group-hover:text-accent transition-colors`} />
      </div>
      <div>
        <p className="text-[30px] font-display text-ink leading-none counter-pop">{value}</p>
        <p className="text-[12px] text-text-muted mt-1 group-hover:text-accent transition-colors">{label}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Recent session row
// ---------------------------------------------------------------------------
function RecentSessionRow({ session }: { session: StoredSession }) {
  const label = STATUS_LABELS[session.status] ?? session.status;
  const colorClass = STATUS_COLORS[session.status] ?? "text-text-muted bg-surface";
  const isActive = ["JOINING", "LISTENING", "PROCESSING"].includes(session.status);
  const platformIcon = PLATFORM_ICONS[session.platform] ?? "·";

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-surface transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface text-[11px] font-mono-ui text-text-secondary shrink-0 group-hover:bg-border/50 transition-colors">
          {platformIcon}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink group-hover:text-accent transition-colors truncate">
            {PLATFORM_LABELS[session.platform] ?? session.platform}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Recent project row
// ---------------------------------------------------------------------------
function RecentProjectRow({ project }: { project: Project }) {
  const templateLabel = TEMPLATE_LABELS[project.template_key] ?? project.template_key;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-surface transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 shrink-0">
          <span className="text-[11px] font-semibold text-accent">
            {project.app_name?.[0]?.toUpperCase() ?? "A"}
          </span>
        </div>
        <p className="text-[13px] font-medium text-ink group-hover:text-accent transition-colors truncate">
          {project.app_name}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {project.is_updating && !project.build_error && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        )}
        {project.build_error && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Failed</span>
        )}
        <span className="text-[11px] text-text-muted bg-surface px-2 py-0.5 rounded-full">{templateLabel}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// New session card
// ---------------------------------------------------------------------------
function NewSessionCard() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PLATFORMS = [
    { value: "meet", label: "Meet", icon: "M" },
    { value: "zoom", label: "Zoom", icon: "Z" },
    { value: "teams", label: "Teams", icon: "T" },
    { value: "physical", label: "Mic", icon: "🎙" },
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
      className="rounded-2xl border border-border bg-card shadow-warm-sm p-6 mb-6"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[15px] font-semibold text-ink">New session</p>
          <p className="text-[13px] text-text-muted mt-0.5">
            Forgefy joins your call and builds a product blueprint.
          </p>
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 shrink-0">
          <Mic2 className="h-4 w-4 text-accent" />
        </div>
      </div>

      {/* Platform selector — pill buttons */}
      <div className="flex gap-2 flex-wrap mb-4">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlatform(p.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all btn-press ${
              platform === p.value
                ? "bg-accent text-accent-foreground shadow-warm-xs"
                : "bg-surface text-text-secondary border border-border hover:border-text-muted"
            }`}
          >
            <span className="text-[11px]">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3">
        {platform !== "physical" && (
          <div className="flex-1 min-w-0">
            <label htmlFor="db-meeting-url" className="label-eyebrow block mb-1.5">Meeting URL</label>
            <input
              id="db-meeting-url"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              placeholder={
                platform === "meet" ? "https://meet.google.com/abc-def-ghi" :
                platform === "zoom" ? "https://zoom.us/j/123456789" :
                "https://teams.microsoft.com/l/meetup-join/…"
              }
            />
          </div>
        )}
        {platform === "physical" && (
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-text-muted py-2">
              Use your microphone or upload a recording after creating the session.
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 h-10 px-5 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 transition-colors btn-press shadow-warm-xs"
        >
          {loading ? "Creating…" : "Start →"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12px] text-destructive flex items-center gap-1.5">
          <Circle className="h-3 w-3 fill-current" />
          {error}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
function DashboardPage() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wsReady, setWsReady] = useState(false);
  const wsSessionsRef = useRef<WebSocket | null>(null);
  const wsProjectsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sessWs = new WebSocket(getWsUrl("/ws/sessions"));
    wsSessionsRef.current = sessWs;
    sessWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "sessions") { setSessions(msg.data); setWsReady(true); }
      } catch {}
    };
    sessWs.onerror = () => sessWs.close();
    sessWs.onopen = () => setWsReady(true);

    const projWs = new WebSocket(getWsUrl("/ws/projects"));
    wsProjectsRef.current = projWs;
    projWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "projects") setProjects(msg.data);
      } catch {}
    };
    projWs.onerror = () => projWs.close();

    return () => { sessWs.close(); projWs.close(); };
  }, []);

  const recentSessions = sessions.slice(0, 4);
  const recentProjects = projects.slice(0, 4);
  const activeSessions = sessions.filter((s) =>
    ["JOINING", "LISTENING", "PROCESSING"].includes(s.status),
  ).length;
  const buildingProjects = projects.filter((p) => p.is_updating && !p.build_error).length;

  // Show skeletons until first WS message arrives — cap at ~2s
  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (wsReady) { setShowSkeleton(false); return; }
    const t = setTimeout(() => setShowSkeleton(false), 2000);
    return () => clearTimeout(t);
  }, [wsReady]);

  return (
    <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Dashboard</p>
        <h1 className="font-display text-[32px] text-ink leading-tight">Overview</h1>
      </div>

      <GitHubConnectBanner />

      <NewSessionCard />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Total sessions"
          value={sessions.length}
          href="/sessions"
          icon={Mic2}
          loading={showSkeleton}
        />
        <StatCard
          label="Active sessions"
          value={activeSessions}
          href="/sessions"
          icon={Circle}
          accent={activeSessions > 0}
          loading={showSkeleton}
        />
        <StatCard
          label="Total projects"
          value={projects.length}
          href="/projects"
          icon={FolderKanban}
          loading={showSkeleton}
        />
        <StatCard
          label="Building now"
          value={buildingProjects}
          href="/projects"
          icon={LayoutDashboard}
          accent={buildingProjects > 0}
          loading={showSkeleton}
        />
      </div>

      {/* Recent items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent sessions */}
        <div className="rounded-2xl border border-border bg-card shadow-warm-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <p className="text-[13px] font-semibold text-ink">Recent sessions</p>
            <Link to="/sessions" className="text-[12px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {showSkeleton ? (
            <div className="divide-y divide-border/40 px-2 py-1">
              {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-3">
                <Mic2 className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-[13px] text-text-muted mb-1">No sessions yet</p>
              <Link to="/sessions" className="text-[12px] text-accent hover:underline">
                Create your first session →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40 px-2 py-1">
              {recentSessions.map((s) => (
                <RecentSessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>

        {/* Recent projects */}
        <div className="rounded-2xl border border-border bg-card shadow-warm-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <p className="text-[13px] font-semibold text-ink">Recent projects</p>
            <Link to="/projects" className="text-[12px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {showSkeleton ? (
            <div className="divide-y divide-border/40 px-2 py-1">
              {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-3">
                <FolderKanban className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-[13px] text-text-muted mb-1">No projects yet</p>
              <p className="text-[12px] text-text-muted">Approve a blueprint in a session to build your first app.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 px-2 py-1">
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
