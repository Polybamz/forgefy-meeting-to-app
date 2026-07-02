import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch, type BillingStatus } from "@/lib/api";

export const Route = createFileRoute("/_auth/billing/success")({
  component: BillingSuccessPage,
  head: () => ({ meta: [{ title: "Payment successful — Forgefy" }] }),
});

function BillingSuccessPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    // Poll once after a short delay to give the webhook time to process
    const t = setTimeout(() => {
      apiFetch("/api/v1/billing/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => null);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-5">
      <div className="h-14 w-14 rounded-full bg-[oklch(0.55_0.18_145)]/15 flex items-center justify-center">
        <svg
          className="h-7 w-7 text-[oklch(0.55_0.18_145)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h1 className="font-display text-[26px] text-ink">Payment successful</h1>
        {status && status.tier !== "free" ? (
          <p className="text-[14px] text-text-muted mt-1">
            You're now on the <span className="text-ink font-medium">{status.tier_name}</span> plan.
          </p>
        ) : (
          <p className="text-[14px] text-text-muted mt-1">Your subscription is being activated…</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          to="/billing"
          className="px-4 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:text-ink transition-colors"
        >
          View billing
        </Link>
      </div>
    </div>
  );
}
