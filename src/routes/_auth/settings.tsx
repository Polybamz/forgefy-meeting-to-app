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

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-warm-xs overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && <p className="text-[13px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border/60 last:border-0">
      <div>
        <p className="text-[14px] text-ink">{label}</p>
        {sublabel && <p className="text-[12px] text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub section
// ---------------------------------------------------------------------------
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
    <Section
      title="GitHub"
      description="Connect your GitHub account to have new apps created in your own repositories."
    >
      <Row
        label="Connection status"
        sublabel={
          status?.linked
            ? "New apps will be created under your account."
            : "Connect to use your own repositories."
        }
      >
        {status === null ? (
          <span className="text-[13px] text-text-muted">Checking…</span>
        ) : status.linked ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[oklch(0.45_0.18_145)] bg-[oklch(0.55_0.18_145)]/10 px-3 py-1.5 rounded-xl">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {status.username ? `@${status.username}` : "Connected"}
          </span>
        ) : (
          <button
            onClick={connect}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#24292e] text-white text-[13px] font-medium hover:bg-[#1a1e22] transition-colors disabled:opacity-60 btn-press"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Connect GitHub
              </>
            )}
          </button>
        )}
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Build model section
// ---------------------------------------------------------------------------
const BUILD_MODEL_OPTIONS = [
  { value: "gemini", label: "Gemini", sub: "Google · fast & capable" },
  { value: "claude", label: "Claude", sub: "Anthropic · precise reasoning" },
  { value: "gpt", label: "GPT-4o", sub: "OpenAI" },
  { value: "Qwen3", label: "Qwen3", sub: "Local / Ollama" },
] as const;

function BuildModelSection() {
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/account/build-model")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCurrent(d.model))
      .catch(() => {});
  }, []);

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
          `Build model switched to ${BUILD_MODEL_OPTIONS.find((o) => o.value === d.model)?.label ?? d.model}.`,
        );
      } else {
        toast.error("Failed to update build model.");
      }
    } catch {
      toast.error("Network error. Please try again.");
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
        <div className="skeleton h-28 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {BUILD_MODEL_OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => select(opt.value)}
                disabled={saving}
                className={[
                  "flex flex-col items-start gap-1 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-60 btn-press",
                  active
                    ? "border-accent bg-accent/5 shadow-warm-xs"
                    : "border-border hover:border-accent/50 hover:bg-surface",
                ].join(" ")}
              >
                <span
                  className={`flex items-center gap-1.5 text-[13px] font-semibold ${active ? "text-accent" : "text-ink"}`}
                >
                  {active && (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
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

// ---------------------------------------------------------------------------
// Appearance section
// ---------------------------------------------------------------------------
function AppearanceSection() {
  return (
    <Section title="Appearance" description="Customize how Forgefy looks to you.">
      <Row label="Theme" sublabel="Switch between light and dark mode">
        <ThemeToggle />
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Account section
// ---------------------------------------------------------------------------
function AccountSection({ onSignOut }: { onSignOut: () => void }) {
  const token = getToken();
  const payload = token ? decodeJwtPayload(token) : {};
  const email = (payload.sub as string) ?? (payload.email as string) ?? "Unknown";

  return (
    <Section title="Account">
      <Row label="Email address" sublabel="Your login email">
        <span className="text-[13px] font-mono-ui text-ink bg-surface px-3 py-1.5 rounded-lg border border-border">
          {email}
        </span>
      </Row>
      <Row label="Sign out" sublabel="You will be returned to the login page">
        <button
          onClick={onSignOut}
          className="px-4 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors btn-press"
        >
          Sign out
        </button>
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
function SettingsPage() {
  const navigate = useNavigate();

  function handleSignOut() {
    clearTokens();
    navigate({ to: "/login" });
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto page-enter">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Settings</p>
        <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">Settings</h1>
      </div>

      <div className="space-y-4">
        <GitHubSection />
        <BuildModelSection />
        <AppearanceSection />
        <AccountSection onSignOut={handleSignOut} />
      </div>
    </div>
  );
}
