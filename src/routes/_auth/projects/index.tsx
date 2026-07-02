import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getWsUrl, type Project } from "@/lib/api";

export const Route = createFileRoute("/_auth/projects/")({
  component: ProjectsPage,
  head: () => ({ meta: [{ title: "Projects — Forgefy" }] }),
});

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

const TEMPLATE_COLORS: Record<string, string> = {
  flutter: "bg-[oklch(0.88_0.08_230)] text-[oklch(0.35_0.12_230)]",
  react_native: "bg-[oklch(0.88_0.08_200)] text-[oklch(0.35_0.12_200)]",
  next: "bg-surface text-text-secondary border border-border",
};

// GitHub SVG inline so we don't need lucide import
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const updatedAt = new Date(project.updated_at);
  const templateLabel = TEMPLATE_LABELS[project.template_key] ?? project.template_key;
  const templateColor = TEMPLATE_COLORS[project.template_key] ?? "bg-surface text-text-secondary";
  const initials = project.app_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const AVATAR_COLORS = [
    "bg-[oklch(0.88_0.08_30)] text-[oklch(0.4_0.12_30)]",
    "bg-[oklch(0.88_0.08_200)] text-[oklch(0.4_0.12_200)]",
    "bg-[oklch(0.88_0.08_280)] text-[oklch(0.4_0.12_280)]",
    "bg-[oklch(0.88_0.08_145)] text-[oklch(0.4_0.12_145)]",
    "bg-[oklch(0.88_0.08_60)] text-[oklch(0.4_0.12_60)]",
  ];
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className={[
        "flex flex-col rounded-2xl border border-border bg-card p-5 transition-all group",
        "card-hover shadow-warm-xs",
        `stagger-${Math.min(8, (index % 4) + 5)}`,
      ].join(" ")}
    >
      {/* Card top */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-xl text-[14px] font-bold shrink-0 ${avatarColor}`}
          >
            {initials || "A"}
          </div>
          <p className="text-[14px] font-semibold text-ink group-hover:text-accent transition-colors truncate">
            {project.app_name}
          </p>
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${templateColor}`}
        >
          {templateLabel}
        </span>
      </div>

      {/* Repo */}
      {project.repo_full_name && (
        <p className="text-[11px] font-mono-ui text-text-muted truncate mb-3 flex items-center gap-1">
          <GithubIcon className="h-2.5 w-2.5 shrink-0" />
          {project.repo_full_name}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-3.5 border-t border-border/60">
        <p className="text-[11px] text-text-muted">
          {updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
        <div className="flex items-center gap-3">
          {project.build_error && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Failed
            </span>
          )}
          {project.is_updating && !project.build_error && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Building
            </span>
          )}
          {project.preview_url && (
            <a
              href={project.preview_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-accent hover:text-accent/80 transition-colors"
            >
              Preview ↗
            </a>
          )}
          {project.github_url && project.repo_owner === "user" && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-ink transition-colors"
              title={project.repo_full_name}
            >
              <GithubIcon className="h-3 w-3" />
              GitHub ↗
            </a>
          )}
          {project.github_url && project.repo_owner === "platform" && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-text-muted/60"
              title="Repo is on Forgefy's account — open project to transfer"
            >
              <GithubIcon className="h-3 w-3" />
              Forgefy's repo
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-9 h-9 rounded-xl" />
        <div className="skeleton h-4 flex-1 rounded" />
      </div>
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="pt-3 border-t border-border/60 flex justify-between">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </div>
  );
}

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [wsReady, setWsReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setShowSkeleton(false), 2000);
    const ws = new WebSocket(getWsUrl("/ws/projects"));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "projects") {
          setProjects(msg.data);
          setWsReady(true);
          setShowSkeleton(false);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      ws.close();
      setShowSkeleton(false);
      setWsReady(true);
      toast.error("Live project updates unavailable — refresh to see latest state.");
    };
    return () => {
      clearTimeout(timeout);
      ws.close();
    };
  }, []);

  const isLoading = showSkeleton && !wsReady;
  const building = projects.filter((p) => p.is_updating && !p.build_error);
  const failed = projects.filter((p) => p.build_error);
  const done = projects.filter((p) => !p.is_updating && !p.build_error);

  return (
    <div className="px-6 md:px-[8vw] py-10 max-w-5xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="label-eyebrow mb-1">Projects</p>
          <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">
            Your apps
          </h1>
        </div>
        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            {building.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent bg-accent/10 px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {building.length} building
              </span>
            )}
            <span className="text-[13px] text-text-muted">{projects.length} total</span>
          </div>
        )}
      </div>

      {/* Skeleton state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-24 rounded-2xl border border-dashed border-border">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface text-text-muted">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-ink mb-1">No apps yet</p>
            <p className="text-[13px] text-text-muted max-w-xs">
              Approve a blueprint in a{" "}
              <Link
                to="/sessions"
                className="text-accent hover:text-accent/80 underline underline-offset-2 transition-colors"
              >
                session
              </Link>{" "}
              to generate your first app.
            </p>
          </div>
          <Link
            to="/sessions"
            className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors btn-press shadow-warm-xs"
          >
            Start a session →
          </Link>
        </div>
      )}

      {/* Project sections */}
      {!isLoading && projects.length > 0 && (
        <div className="space-y-10">
          {building.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <p className="label-eyebrow">Building</p>
                <span className="text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  {building.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {building.map((p, i) => (
                  <ProjectCard key={p.id} project={p} index={i} />
                ))}
              </div>
            </section>
          )}

          {failed.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <p className="label-eyebrow text-amber-600 dark:text-amber-400">Failed</p>
                <span className="text-[11px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {failed.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {failed.map((p, i) => (
                  <ProjectCard key={p.id} project={p} index={i} />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              {(building.length > 0 || failed.length > 0) && (
                <div className="flex items-center gap-2 mb-4">
                  <p className="label-eyebrow">Complete</p>
                  <span className="text-[11px] font-medium text-text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
                    {done.length}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {done.map((p, i) => (
                  <ProjectCard key={p.id} project={p} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
