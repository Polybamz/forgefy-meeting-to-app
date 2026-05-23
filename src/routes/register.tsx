import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getToken, setTokens } from "@/lib/api";
import { signInWithGoogle } from "@/lib/firebase";

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Create account — Forgefy" }] }),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch("/api/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Google sign-in failed.");
        return;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed") || msg.includes("cancelled")) return;
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const registerRes = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!registerRes.ok) {
        const data = await registerRes.json().catch(() => ({}));
        setError(data.detail ?? "Registration failed.");
        return;
      }

      // Auto-login after register
      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        setTokens(data.access_token, data.refresh_token);
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/login" });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="font-display text-[36px] text-ink hover:text-accent transition-colors">
            Forgefy
          </Link>
          <p className="mt-1 text-[14px] text-text-secondary">Create your account</p>
        </div>

        <div className="rounded-xl border border-border bg-warm-white p-8 space-y-4">
          {/* Google sign-in */}
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-[42px] flex items-center justify-center gap-2.5 rounded-xl border border-border bg-background text-[14px] font-medium text-ink transition-colors hover:bg-border/40 disabled:opacity-60"
          >
            {googleLoading ? (
              <span>Signing in…</span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Divider this is gretatevvv */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / password form */}
          <form onSubmit={onSubmit} className="space-y-4" aria-label="Create account">
            <div>
              <label htmlFor="email" className="label-eyebrow block mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-eyebrow block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                placeholder="min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="label-eyebrow block mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full h-[42px] rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          <p className="text-center text-[13px] text-text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-accent underline-offset-2 underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
