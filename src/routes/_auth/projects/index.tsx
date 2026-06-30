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
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Build failed</span>
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
          {project.github_url && project.repo_owner === "user" && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-ink transition-colors"
              title={project.repo_full_name}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub ↗
            </a>
          )}
          {project.github_url && project.repo_owner === "platform" && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-text-muted/60"
              title="Repo is on Forgefy's account — open project to transfer"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Forgefy's repo
            </span>
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
              <p className="label-eyebrow mb-3 text-amber-600 dark:text-amber-400">Failed ({failed.length})</p>
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
