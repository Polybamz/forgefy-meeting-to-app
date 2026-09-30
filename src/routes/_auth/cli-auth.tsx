import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Confirms a `forgefy login` device-code request (see forgefy-cli's `login`
// command and forgefy-backend's app/api/v1/device_auth.py). The CLI opens
// this page with ?user_code=XXXX-XXXX prefilled; the code is also always
// editable so a person can type it in by hand instead — the same fallback
// GitHub's own device-login page (github.com/login/device) uses, in case the
// query param doesn't survive a login redirect.
export const Route = createFileRoute("/_auth/cli-auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    user_code: typeof search.user_code === "string" ? search.user_code : undefined,
  }),
  component: CliAuthPage,
  head: () => ({ meta: [{ title: "Authorize the CLI — Forgefy" }] }),
});

type Status = "idle" | "authorizing" | "done" | "error";

function CliAuthPage() {
  const { user_code } = Route.useSearch();
  const [code, setCode] = useState((user_code ?? "").toUpperCase());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || status === "authorizing") return;
    setStatus("authorizing");
    setError(null);
    try {
      const res = await apiFetch("/api/v1/auth/device/approve", {
        method: "POST",
        body: JSON.stringify({ user_code: trimmed }),
      });
      if (res.ok || res.status === 204) {
        setStatus("done");
        return;
      }
      const detail = (await res.json().catch(() => null))?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : res.status === 404
            ? "That code doesn't match a pending CLI login — it may have expired. Run 'forgefy login' again."
            : "Could not authorize the CLI. Please try again."
      );
      setStatus("error");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="px-2 md:px-2 py-10 max-w-md mx-auto page-enter">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mx-auto mb-4 shadow-warm-sm">
          <KeyRound className="w-6 h-6 text-accent" />
        </div>
        <h1 className="font-display text-[28px] text-ink leading-[1.1]">Authorize the CLI</h1>
        <p className="text-[13px] text-text-secondary mt-2">
          The forgefy-cli tool on your machine is asking to sign in as you.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-warm-xs p-6 space-y-5">
        {status === "done" ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-[14px] font-semibold text-ink">CLI authorized</p>
            <p className="text-[13px] text-text-secondary">
              Return to your terminal — <code className="font-mono-ui text-ink">forgefy login</code> should
              finish in a few seconds. You can close this tab.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-[12px] text-text-muted mb-1.5 block">
                Confirmation code from your terminal
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                maxLength={9}
                className="w-full font-mono-ui text-[20px] tracking-widest text-center text-ink bg-surface border border-border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
                autoFocus
              />
            </div>

            {status === "error" && error && (
              <div className="flex items-start gap-2 text-[12px] text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={authorize}
              disabled={!code.trim() || status === "authorizing"}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity btn-press disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "authorizing" ? "Authorizing…" : "Authorize CLI"}
            </button>

            <p className="text-[12px] text-text-muted text-center">
              Only approve this if you just ran{" "}
              <code className="font-mono-ui text-ink">forgefy login</code> yourself. This grants the CLI an
              API key with the same access as one created on the{" "}
              <Link to="/developers" className="text-accent hover:underline">
                Developers
              </Link>{" "}
              page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
