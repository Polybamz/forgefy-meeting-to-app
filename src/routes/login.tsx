import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getToken, setTokens } from "@/lib/api";
import { signInWithGoogle } from "@/lib/firebase";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Forgefy" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Invalid credentials.");
        return;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      navigate({ to: "/dashboard" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen page-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-warm-md group-hover:shadow-warm-lg transition-shadow">
              <svg className="w-4.5 h-4.5 text-accent-foreground" viewBox="0 0 16 16" fill="currentColor" style={{ width: 18, height: 18 }}>
                <path d="M8 1L2 4.5v7L8 15l6-3.5v-7L8 1zm0 1.8l4.2 2.45v4.9L8 12.6 3.8 10.15V5.25L8 2.8z"/>
              </svg>
            </div>
            <span className="font-display text-[28px] text-ink group-hover:text-accent transition-colors">Forgefy</span>
          </Link>
          <h1 className="text-[22px] font-display text-ink">Welcome back</h1>
          <p className="mt-1 text-[14px] text-text-secondary">Sign in to continue building</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-warm-lg p-8 space-y-5">
          {/* Google sign-in */}
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-border bg-background text-[14px] font-medium text-ink transition-all hover:bg-surface hover:border-text-muted disabled:opacity-60 btn-press"
          >
            {googleLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span>Signing in…</span>
              </div>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-text-muted">or continue with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / password form */}
          <form onSubmit={onSubmit} className="space-y-4" aria-label="Sign in">
            <div className="space-y-1.5">
              <label htmlFor="email" className="label-eyebrow block">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="label-eyebrow block">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-[13px] text-destructive">
                <svg className="w-4 h-4 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-all hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press shadow-warm-sm mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground animate-spin" />
                  Signing in…
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          <p className="text-center text-[13px] text-text-muted">
            No account?{" "}
            <Link to="/register" className="text-accent hover:text-accent/80 underline-offset-2 underline transition-colors">
              Create one free
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
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
