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
  },
  {
    key: "starter",
    name: "Starter",
    price: 19,
    tokens: 5_000_000,
    builds: "~16",
    updates: "~100",
  },
  {
    key: "pro",
    name: "Pro",
    price: 49,
    tokens: 20_000_000,
    builds: "~66",
    updates: "~400",
  },
  {
    key: "team",
    name: "Team",
    price: 149,
    tokens: 75_000_000,
    builds: "~250",
    updates: "~1 500",
  },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
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
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted text-[14px]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse mr-2" />
        Loading billing info…
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
    <div className="max-w-4xl mx-auto px-6 md:px-[8vw] py-12 space-y-10">
      {/* Header */}
      <div>
        <Link to="/dashboard" className="text-[13px] text-text-muted hover:text-ink transition-colors">
          ← Dashboard
        </Link>
        <h1 className="font-display text-[28px] text-ink mt-3">Billing</h1>
        <p className="text-[14px] text-text-muted mt-1">
          Manage your plan and track token usage.
        </p>
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-amber-500/[0.07] border border-amber-400/20 text-[13px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Current usage */}
      {status && (
        <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-text-muted uppercase tracking-wide mb-0.5">Current plan</p>
              <p className="font-display text-[20px] text-ink">{status.tier_name}</p>
            </div>
            {expiresDate && (
              <div className="text-right">
                <p className="text-[12px] text-text-muted">Renews / expires</p>
                <p className="text-[13px] text-ink font-medium">{expiresDate}</p>
              </div>
            )}
          </div>

          {/* Token usage bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-text-muted">
              <span>Tokens used this month</span>
              <span>
                {formatTokens(status.tokens_used)} / {formatTokens(status.monthly_tokens)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 90 ? "bg-destructive" : "bg-accent"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted">
              {formatTokens(status.tokens_remaining)} remaining
              {" · "}~{Math.floor(status.tokens_remaining / 300_000)} builds or ~{Math.floor(status.tokens_remaining / 50_000)} updates left
            </p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-[14px] font-medium text-ink mb-4">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = status?.tier === plan.key;
            const isFree = plan.key === "free";
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl border p-5 ${
                  isCurrent
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface"
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                    Current
                  </span>
                )}

                <p className="font-display text-[16px] text-ink">{plan.name}</p>
                <p className="text-[22px] font-semibold text-ink mt-1">
                  {plan.price === 0 ? "Free" : `$${plan.price}`}
                  {plan.price > 0 && (
                    <span className="text-[13px] font-normal text-text-muted">/mo</span>
                  )}
                </p>

                <ul className="mt-4 space-y-1.5 flex-1">
                  <li className="text-[12px] text-text-muted">
                    <span className="text-ink font-medium">{formatTokens(plan.tokens)}</span> tokens/mo
                  </li>
                  <li className="text-[12px] text-text-muted">
                    <span className="text-ink font-medium">{plan.builds}</span> builds
                  </li>
                  <li className="text-[12px] text-text-muted">
                    <span className="text-ink font-medium">{plan.updates}</span> updates
                  </li>
                </ul>

                {!isFree && (
                  <button
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={isCurrent || checkingOut === plan.key}
                    className={`mt-5 w-full py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isCurrent
                        ? "bg-accent/20 text-accent cursor-default"
                        : "bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-50"
                    }`}
                  >
                    {checkingOut === plan.key
                      ? "Redirecting…"
                      : isCurrent
                      ? expiresDate ? "Renew" : "Active"
                      : "Subscribe"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-text-muted">
          Payments processed by Notchpay. Accepts cards, MTN Mobile Money, and Orange Money.
          Token limits reset on the 1st of each month.
        </p>
      </div>
    </div>
  );
}
