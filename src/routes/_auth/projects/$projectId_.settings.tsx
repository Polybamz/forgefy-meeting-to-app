import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  apiFetch,
  fetchAgents,
  updateProjectAgent,
  type CodingAgentOption,
  type Project,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Code, Database, GitBranch, Loader2, Rocket, Settings } from "lucide-react";
import { GitHubSyncButton, IntegrationsTabContent } from "@/components/integrations-ui";
import type { UseProjectIntegrationsReturn } from "@/hooks/use-project-integrations";

export const Route = createFileRoute("/_auth/projects/$projectId_/settings")({
  component: ProjectSettingsPage,
  head: () => ({ meta: [{ title: "Project Settings — Forgefy" }] }),
});

const TEMPLATE_LABELS: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

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

function RepositorySection({
  project,
  integrations,
}: {
  project: Project;
  integrations?: UseProjectIntegrationsReturn;
}) {
  if (!project.repo_full_name && !integrations) return null;
  return (
    <Section
      title="Repository"
      description="The GitHub repository where your app's source code lives."
    >
      <Row label="Repository">
        {integrations ? (
          <GitHubSyncButton
            project={project}
            githubLinked={integrations.githubLinked}
            transferring={integrations.transferring}
            transferError={integrations.transferError}
            onConnect={integrations.connectGitHubForTransfer}
            onSync={integrations.transferToGitHub}
          />
        ) : (
          <a
            href={project.github_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent hover:underline font-mono-ui"
          >
            {project.repo_full_name} ↗
          </a>
        )}
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

function CodingAgentSection({ project }: { project: Project }) {
  const [agents, setAgents] = useState<CodingAgentOption[]>([]);
  const [selected, setSelected] = useState<string>(project.agent ?? "forgefy");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchAgents()
      .then((opts) => {
        if (alive) setAgents(opts);
      })
      .catch(() => {
        /* fall back to the two known agents so the UI still works offline */
        if (alive) {
          setAgents([
            {
              key: "forgefy",
              display_name: "Forgefy Agent",
              available: true,
              status: "available",
              label: "Available",
            },
            {
              key: "claude_code",
              display_name: "Claude Code",
              available: false,
              status: "not_configured",
              label: "Not configured",
            },
          ]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleAgentSelect(key: string) {
    if (key === selected || saving) return;
    setSaving(true);
    setError("");
    const prev = selected;
    setSelected(key); // optimistic
    try {
      const ok = await updateProjectAgent(project.id, key);
      if (!ok) throw new Error("Request failed.");
      toast.success(
        `Coding agent set to ${key === "claude_code" ? "Claude Code" : "Forgefy Agent"}.`,
      );
    } catch {
      setSelected(prev); // roll back on failure
      setError("Could not save the coding agent. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Coding Agent" description="Which agent writes and updates this project's code.">
      <div className="flex flex-col gap-2">
        {agents.length === 0 ? (
          <p className="text-[12px] text-text-muted">Loading agents…</p>
        ) : (
          agents.map((opt) => {
            const active = opt.key === selected;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => void handleAgentSelect(opt.key)}
                disabled={saving}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-lg border text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  active
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-border hover:border-text-muted bg-warm-white"
                }`}
              >
                <span className={`text-[13px] font-medium ${active ? "text-accent" : "text-ink"}`}>
                  {active && <span className="mr-1">✓</span>}
                  {opt.display_name}
                </span>
                <span className="text-[11px] text-text-muted">
                  {opt.available ? opt.label : `${opt.label} — select to configure`}
                </span>
              </button>
            );
          })
        )}
      </div>

      {error && <p className="text-[12px] text-destructive mt-2">{error}</p>}
    </Section>
  );
}

function PublishSection({ project, projectId }: { project: Project; projectId: string }) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const canPublish = project.template_key === "next" || project.template_key === "react_native";
  const hasGithub = !!project.github_url;

  async function handlePublish() {
    if (publishing || project.is_updating || !canPublish || !hasGithub) return;
    setPublishing(true);
    setPublishError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("Publish queued — your app is being deployed to production.");
      } else {
        const d = await res.json().catch(() => ({}));
        setPublishError((d as { detail?: string }).detail ?? "Publish failed.");
      }
    } catch {
      setPublishError("Network error. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Section
      title="Publish"
      description="Deploy your app to a stable production URL via Cloudflare Pages."
    >
      {project.is_updating && (
        <div className="mb-4 flex items-center gap-2 text-[12px] text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>A build is already in progress.</span>
        </div>
      )}
      <Row label="Published URL">
        {project.published_url ? (
          <a
            href={project.published_url}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent hover:underline font-mono-ui"
          >
            {project.published_url} ↗
          </a>
        ) : (
          <span className="text-[12px] text-text-muted">Not published yet.</span>
        )}
      </Row>
      {project.published_domain && (
        <Row label="Custom domain">
          <span className="text-[13px] text-ink">{project.published_domain}</span>
        </Row>
      )}
      {project.published_at && (
        <Row label="Published at">
          <span className="text-[12px] text-text-secondary">
            {new Date(project.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        </Row>
      )}
      {!canPublish && (
        <p className="text-[12px] text-text-muted">Only web projects (Next.js) can be published.</p>
      )}
      {!hasGithub && (
        <p className="text-[12px] text-text-muted">Connect your GitHub repository first.</p>
      )}
      {canPublish && hasGithub && !project.is_updating && (
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed btn-press shadow-warm-xs"
        >
          {publishing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Publishing…
            </>
          ) : (
            "Publish to production"
          )}
        </button>
      )}
      {publishError && <p className="text-[12px] text-destructive mt-2">{publishError}</p>}
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

interface SettingsTab {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Tab order is deliberate: the destructive "Danger Zone" sits last so the
// regular management tabs don't end with a delete button. The Integrations
// tab lives next to Github because connecting a GitHub repo and a database
// are the same "where does this app live / persist data" concern.
const SETTINGS_TABS: SettingsTab[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "github", label: "Github", icon: GitBranch },
  { id: "integrations", label: "Integrations", icon: Database },
  { id: "coding-agent", label: "Coding Agent", icon: Code },
  { id: "publish", label: "Publish", icon: Rocket },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

// ---------------------------------------------------------------------------
// Shared content — rendered inside a side drawer by both this route and the
// project page's own settings drawer. The sections are exposed as a tabbed
// surface rather than one tall stacked scroll, so the wide coding-agent
// picker doesn't push the later sections — and the danger-zone buttons — off-
// canvas in a narrow drawer.
// ---------------------------------------------------------------------------
export function ProjectSettingsContent({
  project,
  projectId,
  onDeleted,
  integrations,
}: {
  project: Project;
  projectId: string;
  onDeleted: () => void;
  integrations?: UseProjectIntegrationsReturn;
}) {
  // The Integrations tab drives the live connect flow: its buttons mutate
  // `integrations` state that the project page renders as modals. Only the
  // project page runs those modals, so the tab is omitted on the standalone
  // /settings route (which passes no `integrations`) rather than rendering
  // connect buttons that can't open their follow-up modals.
  const tabs = integrations ? SETTINGS_TABS : SETTINGS_TABS.filter((t) => t.id !== "integrations");

  return (
    <Tabs defaultValue={tabs[0].id} className="w-full">
      <div className="border-b border-border overflow-x-scroll scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-border/20">
        <TabsList className="h-auto w-max justify-start  gap-1.5 py-1.5 pl-1 pr-2 text-[12px] font-medium uppercase tracking-wider text-text-secondary ">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="flex items-center gap-2 whitespace-nowrap hover:text-primary transition-colors hover:border-1 border-green-800"
            >
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="general" className="mt-0">
        <GeneralSection project={project} />
      </TabsContent>
      <TabsContent value="github" className="mt-0">
        <RepositorySection project={project} integrations={integrations} />
      </TabsContent>
      {integrations && (
        <TabsContent value="integrations" className="mt-0">
          <IntegrationsTabContent project={project} integrations={integrations} />
        </TabsContent>
      )}
      <TabsContent value="coding-agent" className="mt-0">
        <CodingAgentSection project={project} />
      </TabsContent>
      <TabsContent value="publish" className="mt-0">
        <PublishSection project={project} projectId={projectId} />
      </TabsContent>
      <TabsContent value="danger" className="mt-0">
        <DangerZone project={project} onDeleted={onDeleted} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Route — the same settings, presented as a side drawer over the app shell.
// Closing it returns to the project page.
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

  const close = () => navigate({ to: "/projects/$projectId", params: { projectId } });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>{project?.app_name ?? "Project settings"}</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-text-muted text-[13px]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Loading…
            </div>
          ) : error || !project ? (
            <div className="space-y-3">
              <p className="text-destructive text-[13px]">{error || "Project not found."}</p>
              <Link
                to="/projects/$projectId"
                params={{ projectId }}
                className="inline-block text-[13px] text-accent underline"
              >
                ← Back to project
              </Link>
            </div>
          ) : (
            <ProjectSettingsContent
              project={project}
              projectId={projectId}
              onDeleted={() => navigate({ to: "/dashboard" })}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
