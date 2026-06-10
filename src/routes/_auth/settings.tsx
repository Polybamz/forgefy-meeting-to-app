import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch, clearTokens, getToken } from "@/lib/api";
import { ThemeToggle } from "@/hooks/use-theme";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Forgefy" }] }),
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-warm-white p-6">
      <p className="label-eyebrow mb-4">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <p className="text-[13px] text-text-secondary">{label}</p>
      <div className="text-right">{children}</div>
    </div>
  );
}

function GitHubSection() {
  const [status, setStatus] = useState<{ linked: boolean; username?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/auth/github/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setStatus({ linked: true });
      window.history.replaceState({}, "", window.location.pathname);
      toast.success("GitHub connected successfully.");
    }
  }, []);

  async function connect() {
    setLoading(true);
    localStorage.setItem("forgefy_github_pending_return", "/settings?github=connected");
    try {
      const res = await apiFetch("/api/v1/auth/github/authorize");
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      } else {
        localStorage.removeItem("forgefy_github_pending_return");
        toast.error("Could not start GitHub OAuth. Please try again.");
      }
    } catch {
      localStorage.removeItem("forgefy_github_pending_return");
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="GitHub">
      <Row label="Status">
        {status === null ? (
          <span className="text-[13px] text-text-muted">Loading…</span>
        ) : status.linked ? (
          <span className="text-[13px] font-medium text-[oklch(0.55_0.18_145)]">
            {status.username ? `Connected as @${status.username}` : "Connected"}
          </span>
        ) : (
          <button
            onClick={connect}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-[#24292e] text-white text-[13px] font-medium hover:bg-[#1a1e22] transition-colors disabled:opacity-60"
          >
            {loading ? "Connecting…" : "Connect GitHub"}
          </button>
        )}
      </Row>
      {status?.linked && (
        <p className="mt-2 text-[12px] text-text-muted">
          New apps will be created under your GitHub account.
        </p>
      )}
      {!status?.linked && status !== null && (
        <p className="mt-2 text-[12px] text-text-muted">
          Connect GitHub to have new apps created in your own repositories.
        </p>
      )}
    </Section>
  );
}

function AppearanceSection() {
  return (
    <Section title="Appearance">
      <Row label="Theme">
        <ThemeToggle />
      </Row>
    </Section>
  );
}

function AccountSection({ onSignOut }: { onSignOut: () => void }) {
  const token = getToken();
  const payload = token ? decodeJwtPayload(token) : {};
  const email = (payload.sub as string) ?? (payload.email as string) ?? "Unknown";

  return (
    <Section title="Account">
      <Row label="Email">
        <span className="text-[13px] font-mono-ui text-ink">{email}</span>
      </Row>
      <Row label="Sign out">
        <button
          onClick={onSignOut}
          className="px-4 py-1.5 rounded-lg border border-border text-[13px] text-text-secondary hover:text-ink hover:border-text-secondary transition-colors"
        >
          Sign out
        </button>
      </Row>
    </Section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();

  function handleSignOut() {
    clearTokens();
    navigate({ to: "/login" });
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Settings</p>
        <h1 className="font-display text-[32px] text-ink leading-tight">Settings</h1>
      </div>

      <div className="space-y-4">
        <GitHubSection />
        <AppearanceSection />
        <AccountSection onSignOut={handleSignOut} />
      </div>
    </div>
  );
}
