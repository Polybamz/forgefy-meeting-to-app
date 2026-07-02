import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch, type BillingStatus } from "@/lib/api";

export const Route = createFileRoute("/_auth/billing")({
  component: BillingPage,
  head: () => ({ meta: [{ title: "Billing — Forgefy" }] }),
});

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    tokens: 500_000,
    builds: "~1",
    updates: "~10",
    features: ["500K tokens/mo", "~1 full build", "~10 updates", "1 active project"],
  },
  {
    key: "starter",
    name: "Starter",
    price: 19,
    tokens: 5_000_000,
    builds: "~16",
    updates: "~100",
    features: ["5M tokens/mo", "~16 full builds", "~100 updates", "Unlimited projects"],
  },
  {
    key: "pro",
    name: "Pro",
    price: 49,
    tokens: 20_000_000,
    builds: "~66",
    updates: "~400",
    features: ["20M tokens/mo", "~66 full builds", "~400 updates", "Priority processing", "Unlimited projects"],
    highlight: true,
  },
  {
    key: "team",
    name: "Team",
    price: 149,
    tokens: 75_000_000,
    builds: "~250",
    updates: "~1 500",
    features: ["75M tokens/mo", "~250 full builds", "~1,500 updates", "Priority processing", "Unlimited projects", "Team seats"],
  },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/billing/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("Failed to load billing info."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubscribe(tierKey: string) {
    setError("");
    setCheckingOut(tierKey);
    try {
      const res = await apiFetch("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier: tierKey }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Checkout failed.");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCheckingOut(null);
    }
  }

  if (loading) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-10 w-40 rounded-xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const usedPct = status
    ? Math.min(100, (status.tokens_used / status.monthly_tokens) * 100)
    : 0;

  const expiresDate = status?.expires_at
    ? new Date(status.expires_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-[8vw] py-12 space-y-10 page-enter">
      {/* Header */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-ink transition-colors mb-4"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Dashboard
        </Link>
        <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">Billing</h1>
        <p className="text-[14px] text-text-secondary mt-1">Manage your plan and track token usage.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-400/20 text-[13px] text-amber-700 dark:text-amber-400">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {error}
        </div>
      )}

      {/* Current usage */}
      {status && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-warm-xs slide-up">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="label-eyebrow mb-1">Current plan</p>
              <p className="font-display text-[24px] text-ink">{status.tier_name}</p>
            </div>
            {expiresDate && (
              <div className="text-right">
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">Renews</p>
                <p className="text-[14px] font-medium text-ink">{expiresDate}</p>
              </div>
            )}
          </div>

          {/* Token usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-text-muted">
              <span>Tokens used this month</span>
              <span className="font-medium text-ink">
                {formatTokens(status.tokens_used)} / {formatTokens(status.monthly_tokens)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-surface border border-border/50 overflow-hidden shadow-warm-xs">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  usedPct >= 90 ? "bg-destructive" : usedPct >= 70 ? "bg-amber-500" : "bg-accent"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>
                {formatTokens(status.tokens_remaining)} remaining
              </span>
              <span>
                ~{Math.floor(status.tokens_remaining / 300_000)} builds · ~{Math.floor(status.tokens_remaining / 50_000)} updates left
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="font-display text-[20px] text-ink mb-5">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => {
            const isCurrent = status?.tier === plan.key;
            const isFree = plan.key === "free";
            return (
              <div
                key={plan.key}
                className={[
                  "relative flex flex-col rounded-2xl border p-5 transition-all",
                  `stagger-${Math.min(8, i + 5)}`,
                  plan.highlight
                    ? "border-accent bg-accent/[0.03] shadow-warm-sm"
                    : isCurrent
                      ? "border-accent/60 bg-card shadow-warm-xs"
                      : "border-border bg-card",
                ].join(" ")}
              >
                {plan.highlight && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full bg-accent text-accent-foreground whitespace-nowrap shadow-warm-xs">
                    Most popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-3.5 right-3.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                    Current
                  </span>
                )}

                <p className="font-display text-[17px] text-ink mb-1">{plan.name}</p>
                <div className="mb-4">
                  <span className="text-[26px] font-bold text-ink">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-[13px] text-text-muted ml-1">/mo</span>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-text-secondary">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>

                {!isFree && (
                  <button
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={isCurrent || checkingOut === plan.key}
                    className={[
                      "w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors btn-press",
                      isCurrent
                        ? "bg-accent/15 text-accent cursor-default"
                        : plan.highlight
                          ? "bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 shadow-warm-xs"
                          : "border border-border text-ink hover:border-accent hover:bg-surface disabled:opacity-60",
                    ].join(" ")}
                  >
                    {checkingOut === plan.key ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-current/40 border-t-current animate-spin" />
                        Redirecting…
                      </span>
                    ) : isCurrent ? (
                      expiresDate ? "Renew" : "Active"
                    ) : (
                      "Subscribe"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-[12px] text-text-muted">
          Payments processed by Notchpay. Accepts cards, MTN Mobile Money, and Orange Money.
          Token limits reset on the 1st of each month.
        </p>
      </div>
    </div>
  );
}
