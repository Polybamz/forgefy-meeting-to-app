import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch, type Project } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/projects/$projectId_/settings")({
  component: ProjectSettingsPage,
  head: () => ({ meta: [{ title: "Project Settings — Forgefy" }] }),
});

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

const BUILD_MODEL_OPTIONS = [
  { value: "gemini", label: "Gemini", sub: "Google — fast & capable" },
  { value: "claude", label: "Claude", sub: "Anthropic — precise reasoning" },
  { value: "gpt", label: "GPT-4o", sub: "OpenAI" },
  { value: "Qwen3", label: "Qwen3", sub: "Open models — OpenRouter / Ollama" },
] as const;

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border p-6 space-y-5 ${
        danger ? "border-destructive/40 bg-destructive/3" : "border-border bg-warm-white"
      }`}
    >
      <div>
        <h2 className={`text-[15px] font-semibold ${danger ? "text-destructive" : "text-ink"}`}>
          {title}
        </h2>
        {description && <p className="text-[12px] text-text-muted mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] text-text-secondary">{label}</p>
        {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function GeneralSection({ project }: { project: Project }) {
  return (
    <Section title="General" description="Basic information about this project.">
      <Row label="App name">
        <span className="text-[13px] font-medium text-ink">{project.app_name}</span>
      </Row>
      <Row label="Framework">
        <span className="text-[13px] text-ink">
          {TEMPLATE_LABELS[project.template_key] ?? project.template_key}
        </span>
      </Row>
      <Row label="Project ID">
        <span className="text-[11px] font-mono-ui text-text-muted">{project.id}</span>
      </Row>
      <Row label="Created">
        <span className="text-[13px] text-text-secondary">
          {new Date(project.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </span>
      </Row>
      <Row label="Last updated">
        <span className="text-[13px] text-text-secondary">
          {new Date(project.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </span>
      </Row>
    </Section>
  );
}

function RepositorySection({ project }: { project: Project }) {
  if (!project.repo_full_name) return null;
  return (
    <Section
      title="Repository"
      description="The GitHub repository where your app's source code lives."
    >
      <Row label="Repository">
        <a
          href={project.github_url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-accent hover:underline font-mono-ui"
        >
          {project.repo_full_name} ↗
        </a>
      </Row>
      {project.preview_url && (
        <Row label="Preview URL">
          <a
            href={project.preview_url}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent hover:underline"
          >
            {project.preview_url} ↗
          </a>
        </Row>
      )}
      {project.artifact_url && (
        <Row label="Artifact">
          <a
            href={project.artifact_url}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent hover:underline"
          >
            Download ↗
          </a>
        </Row>
      )}
    </Section>
  );
}

function BuildModelSection({ projectId }: { projectId: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/account/build-model")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCurrent(d.model))
      .catch(() => {});
  }, [projectId]);

  async function select(value: string) {
    if (saving || value === current) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/account/build-model", {
        method: "PATCH",
        body: JSON.stringify({ model: value }),
      });
      if (res.ok) {
        const d = await res.json();
        setCurrent(d.model);
        toast.success(
          `Build model set to ${BUILD_MODEL_OPTIONS.find((o) => o.value === d.model)?.label ?? d.model}.`,
        );
      } else {
        toast.error("Failed to update build model.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Build Model"
      description="The AI model used to generate and update your app code. Takes effect on the next build or update."
    >
      {current === null ? (
        <p className="text-[12px] text-text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {BUILD_MODEL_OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => select(opt.value)}
                disabled={saving}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-lg border text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  active
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-border hover:border-text-muted bg-warm-white"
                }`}
              >
                <span className={`text-[13px] font-medium ${active ? "text-accent" : "text-ink"}`}>
                  {active && <span className="mr-1">✓</span>}
                  {opt.label}
                </span>
                <span className="text-[11px] text-text-muted">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function DangerZone({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const nameMatch = confirmName.trim() === project.app_name.trim();

  async function handleDelete() {
    if (!nameMatch || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted.");
        onDeleted();
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError((d as { detail?: string }).detail ?? "Failed to delete project.");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Section
      title="Danger Zone"
      description="These actions are irreversible. Proceed with caution."
      danger
    >
      {/* Delete project */}
      <div className="rounded-lg border border-destructive/30 bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Delete this project</p>
            <p className="text-[12px] text-text-muted mt-0.5">
              Permanently removes the project from Forgefy and attempts to delete the GitHub
              repository.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] text-text-secondary block">
            Type <span className="font-mono-ui font-semibold text-ink">{project.app_name}</span> to
            confirm
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => {
              setConfirmName(e.target.value);
              setDeleteError("");
            }}
            placeholder={project.app_name}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-[13px] text-ink placeholder:text-text-muted outline-none focus:border-destructive transition-colors font-mono-ui"
          />
        </div>

        {deleteError && <p className="text-[12px] text-destructive">{deleteError}</p>}

        <button
          onClick={handleDelete}
          disabled={!nameMatch || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-[12px] font-medium transition-colors hover:bg-[oklch(0.5_0.2_25)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Deleting…
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              Delete Project
            </>
          )}
        </button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/v1/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setProject(d as Project))
      .catch(() => setError("Project not found or access denied."))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted text-[14px]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse mr-2" />
        Loading…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <p className="text-destructive text-[14px]">{error || "Project not found."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-[13px] text-accent underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-warm-white/90 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="text-[13px] text-text-muted hover:text-ink transition-colors shrink-0"
        >
          ← {project.app_name}
        </Link>
        <span className="text-border">|</span>
        <h1 className="font-display text-[16px] text-ink">Settings</h1>
      </header>

      {/* Content */}
      <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto space-y-6">
        <div>
          <p className="label-eyebrow mb-1">Project Settings</p>
          <h2 className="font-display text-[28px] text-ink leading-tight">{project.app_name}</h2>
        </div>

        <GeneralSection project={project} />
        <RepositorySection project={project} />
        <BuildModelSection projectId={projectId} />
        <DangerZone project={project} onDeleted={() => navigate({ to: "/dashboard" })} />
      </div>
    </div>
  );
}
