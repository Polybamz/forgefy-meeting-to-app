import { Project } from "@/lib/api";
import { UseProjectIntegrationsReturn } from "@/hooks/use-project-integrations";

// ---------------------------------------------------------------------------
// Icon constants — shared between the project header toolbar, the DB connect
// modal, and the settings drawer's Integrations tab.
// ---------------------------------------------------------------------------
export const GH_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export const SUPABASE_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path
      d="M13.3 23.6c-.5.6-1.5.3-1.5-.5v-8.4H4.9c-1 0-1.6-1.2-.9-2l9.7-11.7c.5-.6 1.5-.3 1.5.5v8.4h6.9c1 0 1.6 1.2.9 2L13.3 23.6Z"
      fill="currentColor"
    />
  </svg>
);

export const NEON_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M4 3h16v9.5c0 5-3.5 8.5-8 8.5V13H8v8c-2.5-1-4-3.5-4-6.5V3Z" fill="currentColor" />
  </svg>
);

export const FIREBASE_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 20.5 8 3.2c.1-.7 1-.9 1.4-.3l2 3.1-1.9 3.5-4 11Z" fill="currentColor" />
    <path d="M5.5 20.5 12.2 8l2.2 4.1-4.9 8.4Z" fill="currentColor" opacity="0.7" />
    <path d="M5.5 20.5 15.8 14l2.7 5-8 3Z" fill="currentColor" opacity="0.5" />
  </svg>
);

// ---------------------------------------------------------------------------
// GitHub sync button
// ---------------------------------------------------------------------------
interface GitHubSyncButtonProps {
  project: Project;
  githubLinked: boolean | null;
  transferring: boolean;
  transferError: string;
  onConnect: () => void;
  onSync: () => void;
}

export function GitHubSyncButton({
  project,
  githubLinked,
  transferring,
  transferError,
  onConnect,
  onSync,
}: GitHubSyncButtonProps) {
  if (project.repo_owner === "user" && project.github_url) {
    return (
      <a
        href={project.github_url}
        target="_blank"
        rel="noreferrer"
        title={project.repo_full_name ?? undefined}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {GH_ICON}
        <span className="hidden sm:block max-w-[140px] truncate">
          {project.repo_full_name ?? "GitHub"}
        </span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (githubLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border text-[12px] text-text-muted/50">
        {GH_ICON}
        <span>…</span>
      </div>
    );
  }

  if (!githubLinked) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors btn-press"
      >
        {GH_ICON}
        Connect GitHub
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onSync}
        disabled={transferring}
        title={transferError || "Push this project to your GitHub account"}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] text-white text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {GH_ICON}
        {transferring ? "Syncing…" : "Sync to GitHub"}
      </button>
            {transferError && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {transferError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supabase connect button
// ---------------------------------------------------------------------------
interface SupabaseConnectButtonProps {
  project: Project;
  supabaseLinked: boolean | null;
  connecting: boolean;
  error: string;
  orgs: { id: string; name: string }[] | null;
  onConnectAccount: () => void;
  onStartConnect: () => void;
  onPickOrg: (organizationId: string) => void;
  onDismissOrgPicker: () => void;
}

export function SupabaseConnectButton({
  project,
  supabaseLinked,
  connecting,
  error,
  orgs,
  onConnectAccount,
  onStartConnect,
  onPickOrg,
  onDismissOrgPicker,
}: SupabaseConnectButtonProps) {
  if (project.supabase_project_ref) {
    return (
      <a
        href={`https://supabase.com/dashboard/project/${project.supabase_project_ref}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {SUPABASE_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (!supabaseLinked) {
    return (
      <button
        onClick={onConnectAccount}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#3ecf8e] hover:bg-[#34b87b] text-[#1c1c1c] text-[12px] font-medium transition-colors btn-press"
      >
        {SUPABASE_ICON}
        Connect Supabase
      </button>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-0.5">
      <button
        onClick={supabaseLinked ? onStartConnect : onConnectAccount}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#3ecf8e] hover:bg-[#34b87b] text-[#1c1c1c] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {SUPABASE_ICON}
        {connecting ? "Connecting…" : supabaseLinked ? "Connect Database" : "Connect Supabase"}
      </button>
      {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
      {orgs && (
        <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-border bg-card p-1.5 shadow-warm-lg">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-text-muted">
            Choose an organization
          </p>
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => onPickOrg(org.id)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface transition-colors"
            >
                          {org.name}
            </button>
          ))}
          <button
            onClick={onDismissOrgPicker}
            className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-text-muted hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Neon connect button — embedded model: no account linking, single click
// ---------------------------------------------------------------------------
interface NeonConnectButtonProps {
  project: Project;
  connecting: boolean;
  error: string;
  onConnect: () => void;
}

export function NeonConnectButton({
  project,
  connecting,
  error,
  onConnect,
}: NeonConnectButtonProps) {
  if (project.neon_project_id) {
    return (
      <a
        href={`https://console.neon.tech/app/projects/${project.neon_project_id}`}
        target="_blank"
        rel="noreferrer"
        title="Open in Neon console"
        aria-label="Open this project in the Neon console"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {NEON_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onConnect}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#00e599] hover:bg-[#00cc89] text-[#003524] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {NEON_ICON}
        {connecting ? "Connecting…" : "Connect Neon"}
      </button>
            {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Firebase connect button — Google OAuth account link, then per-project
// Firestore provisioning (single click, no org picker)
// ---------------------------------------------------------------------------
interface FirebaseConnectButtonProps {
  project: Project;
  firebaseLinked: boolean | null;
  connecting: boolean;
  error: string;
  onConnectAccount: () => void;
  onConnectProject: () => void;
}

export function FirebaseConnectButton({
  project,
  firebaseLinked,
  connecting,
  error,
  onConnectAccount,
  onConnectProject,
}: FirebaseConnectButtonProps) {
  if (project.firebase_project_id) {
    return (
      <a
        href={`https://console.firebase.google.com/project/${project.firebase_project_id}/firestore`}
        target="_blank"
        rel="noreferrer"
        title="Open in Firebase console"
        aria-label="Open this project in the Firebase console"
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:border-text-secondary text-[12px] text-text-secondary hover:text-ink transition-colors"
      >
        {FIREBASE_ICON}
        <span className="hidden sm:block">Database connected</span>
        <span className="text-text-muted">↗</span>
      </a>
    );
  }

  if (firebaseLinked === null) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border text-[12px] text-text-muted/50">
        {FIREBASE_ICON}
        <span>…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={firebaseLinked ? onConnectProject : onConnectAccount}
        disabled={connecting}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#ffca28] hover:bg-[#ffc107] text-[#1c1c1c] text-[12px] font-medium transition-colors disabled:opacity-60 btn-press"
      >
        {FIREBASE_ICON}
        {connecting ? "Connecting…" : firebaseLinked ? "Connect Database" : "Connect Firebase"}
      </button>
      {error && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[180px] text-right leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integrations tab content — renders the database provider rows. GitHub
// lives in the settings drawer's own Github tab, not here.
// Used by the settings drawer's Integrations tab in both the inline
// ($projectId) and standalone (/settings) surfaces.
// ---------------------------------------------------------------------------
export function IntegrationsTabContent({
  project,
  integrations,
}: {
  project: Project;
  integrations: UseProjectIntegrationsReturn;
}) {
  return (
    <div className="space-y-6">
      {/* Databases */}
      <div>
        <p className="label-eyebrow mb-1">Databases</p>
        <p className="text-[12px] text-text-muted mb-2">
          Give your generated app a real database. Pick a provider below.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {SUPABASE_ICON} Supabase
            </span>
            <SupabaseConnectButton
              project={project}
              supabaseLinked={integrations.supabaseLinked}
              connecting={integrations.connectingSupabase}
              error={integrations.supabaseError}
              orgs={integrations.supabaseOrgs}
              onConnectAccount={integrations.connectSupabaseAccount}
              onStartConnect={integrations.startSupabaseConnect}
              onPickOrg={integrations.connectSupabaseProject}
              onDismissOrgPicker={integrations.dismissSupabaseOrgPicker}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {NEON_ICON} Neon
            </span>
            <NeonConnectButton
              project={project}
              connecting={integrations.connectingNeon}
              error={integrations.neonError}
              onConnect={integrations.connectNeon}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink font-medium">
              {FIREBASE_ICON} Firebase
            </span>
            <FirebaseConnectButton
              project={project}
              firebaseLinked={integrations.firebaseLinked}
              connecting={integrations.connectingFirebase}
              error={integrations.firebaseError}
              onConnectAccount={integrations.connectFirebaseAccount}
              onConnectProject={integrations.connectFirebaseProject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
