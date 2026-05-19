import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { clearTokens, getToken } from "@/lib/api";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearTokens();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="h-full mx-auto flex items-center justify-between px-6">
          <Link to="/dashboard" className="font-display text-[18px] text-ink hover:text-accent transition-colors">
            Forgefy
          </Link>
          <button
            onClick={handleLogout}
            className="text-[13px] text-text-muted hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
