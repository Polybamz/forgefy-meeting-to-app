import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch, getWsUrl, type Project } from "@/lib/api";

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
  next: "bg-surface text-text-secondary",
};

function ProjectCard({ project }: { project: Project }) {
  const updatedAt = new Date(project.updated_at);
  const templateLabel = TEMPLATE_LABELS[project.template_key] ?? project.template_key;
  const templateColor = TEMPLATE_COLORS[project.template_key] ?? "bg-surface text-text-secondary";

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="flex flex-col rounded-xl border border-border bg-warm-white p-5 hover:border-accent transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[14px] font-medium text-ink group-hover:text-accent transition-colors truncate">
          {project.app_name}
        </p>
        <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${templateColor}`}>
          {templateLabel}
        </span>
      </div>

      {project.repo_full_name && (
        <p className="text-[11px] font-mono-ui text-text-muted truncate mb-3">
          {project.repo_full_name}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-border/60">
        <p className="text-[11px] text-text-muted">
          Updated {updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
        <div className="flex items-center gap-3">
          {project.build_error && (
            <span className="text-[11px] font-medium text-destructive">Build failed</span>
          )}
          {project.is_updating && !project.build_error && (
            <span className="flex items-center gap-1.5 text-[11px] text-accent">
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
    </Link>
  );
}

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl("/ws/projects"));
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "projects") setProjects(msg.data);
      } catch { /* ignore */ }
    };
    ws.onerror = () => {
      ws.close();
      toast.error("Live project updates unavailable — refresh to see latest state.");
    };
    return () => ws.close();
  }, []);

  const building = projects.filter((p) => p.is_updating && !p.build_error);
  const failed = projects.filter((p) => p.build_error);
  const done = projects.filter((p) => !p.is_updating && !p.build_error);

  return (
    <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Projects</p>
        <h1 className="font-display text-[32px] text-ink leading-tight">Your apps</h1>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border gap-3">
          <p className="text-[14px] text-text-muted">No projects yet.</p>
          <p className="text-[13px] text-text-muted">
            Approve a blueprint in a{" "}
            <Link to="/sessions" className="text-accent hover:underline">session</Link>{" "}
            to build your first app.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {building.length > 0 && (
            <section>
              <p className="label-eyebrow mb-3">Building ({building.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {building.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {failed.length > 0 && (
            <section>
              <p className="label-eyebrow mb-3 text-destructive">Failed ({failed.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {failed.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <p className="label-eyebrow mb-3">
                {building.length > 0 || failed.length > 0 ? `Complete (${done.length})` : `All apps (${projects.length})`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {done.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
