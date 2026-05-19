import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { getToken, setTokens } from "@/lib/api";

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

  async function onSubmit(e: FormEvent) {
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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="font-display text-[36px] text-ink hover:text-accent transition-colors">
            Forgefy
          </Link>
          <p className="mt-1 text-[14px] text-text-secondary">Sign in to your account</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-warm-white p-8 space-y-4"
          aria-label="Sign in"
        >
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            className="w-full h-[42px] rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>

          <p className="text-center text-[13px] text-text-muted">
            No account?{" "}
            <Link to="/register" className="text-accent underline-offset-2 underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
