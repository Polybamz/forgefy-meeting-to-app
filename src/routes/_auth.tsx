import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { clearTokens, connectWs, getToken } from "@/lib/api";
import { ThemeToggle } from "@/hooks/use-theme";
import {
  LayoutDashboard,
  Mic2,
  FolderKanban,
  CreditCard,
  Code2,
  Settings,
  Menu,
  X,
  LogOut,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

// ---------------------------------------------------------------------------
// Token-exhausted modal
// ---------------------------------------------------------------------------

interface QuotaEvent {
  message: string;
  tier: string;
  limit: number;
}

function TokenExhaustedModal({ event, onDismiss }: { event: QuotaEvent; onDismiss: () => void }) {
  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return String(n);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm fade-in" onClick={onDismiss} />

      {/* panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-warm-xl slide-up p-8 flex flex-col gap-5">
        {/* icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mx-auto shadow-warm-sm">
          <Zap className="w-6 h-6 text-destructive" />
        </div>

        {/* heading */}
        <div className="text-center">
          <h2 className="font-display text-[22px] text-ink mb-2">Tokens exhausted</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            You've used all <span className="font-semibold text-ink">{fmt(event.limit)}</span>{" "}
            tokens in your <span className="font-semibold text-ink capitalize">{event.tier}</span>{" "}
            plan this month. Upgrade to keep building.
          </p>
        </div>

        {/* usage bar */}
        <div className="w-full h-2 rounded-full bg-border overflow-hidden shadow-warm-xs">
          <div className="h-full bg-destructive rounded-full w-full" />
        </div>

        {/* actions */}
        <div className="flex flex-col gap-2 mt-1">
          <Link
            to="/billing"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-accent text-primary-foreground text-[14px] font-medium hover:opacity-90 transition-opacity btn-press shadow-warm-sm"
            onClick={onDismiss}
          >
            Upgrade plan →
          </Link>
          <button
            onClick={onDismiss}
            className="w-full h-10 rounded-xl text-[13px] text-text-muted hover:text-ink transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------

function NavItem({
  to,
  icon: Icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeProps={{ className: "!bg-accent/10 !text-accent !font-semibold shadow-warm-xs" }}
      activeOptions={{ exact: to === "/dashboard" }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-text-secondary hover:text-ink hover:bg-surface transition-all duration-150 w-full group"
    >
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-lg bg-transparent group-hover:bg-border/50 transition-colors shrink-0">
        <Icon className="h-[14px] w-[14px]" />
      </span>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Auth layout
// ---------------------------------------------------------------------------

function AuthLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Project editor is full-screen — hide the sidebar there
  const hideNav = /^\/projects\/[^/]+/.test(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [quotaEvent, setQuotaEvent] = useState<QuotaEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return connectWs("/ws/user/events", (ws) => {
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "quota_exceeded") {
            setQuotaEvent({
              message: msg.message,
              tier: msg.tier ?? "free",
              limit: msg.limit ?? 0,
            });
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => ws.close();
    });
  }, []);

  // Close sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearTokens();
    navigate({ to: "/login" });
  }

  if (hideNav) {
    return (
      <>
        <Outlet />
        {quotaEvent && (
          <TokenExhaustedModal event={quotaEvent} onDismiss={() => setQuotaEvent(null)} />
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 w-[240px] flex flex-col border-r border-border frost",
          "transition-transform duration-300 ease-out",
          "lg:static lg:h-screen lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="h-[56px] flex items-center justify-between px-4 border-b border-border/60 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-warm-sm group-hover:shadow-warm-md transition-shadow shrink-0">
              <svg
                className="w-3.5 h-3.5 text-accent-foreground"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1L2 4.5v7L8 15l6-3.5v-7L8 1zm0 1.8l4.2 2.45v4.9L8 12.6 3.8 10.15V5.25L8 2.8z" />
              </svg>
            </div>
            <span className="font-display text-[18px] text-ink group-hover:text-accent transition-colors leading-none">
              Forgefy
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section label */}
        <div className="px-4 pt-5 pb-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.10em] text-text-muted">
            Workspace
          </p>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard}>
            Dashboard
          </NavItem>
          <NavItem to="/sessions" icon={Mic2}>
            Sessions
          </NavItem>
          <NavItem to="/projects" icon={FolderKanban}>
            Projects
          </NavItem>
          <NavItem to="/developers" icon={Code2}>
            Developers
          </NavItem>
        </nav>

        {/* Footer nav */}
        <div className="border-t border-border/60 shrink-0">
          <div className="px-4 pt-4 pb-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.10em] text-text-muted">
              Account
            </p>
          </div>
          <div className="px-3 pb-4 space-y-0.5">
            <NavItem to="/billing" icon={CreditCard}>
              Billing
            </NavItem>
            <NavItem to="/settings" icon={Settings}>
              Settings
            </NavItem>
          </div>
          <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-surface"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="h-[56px] border-b border-border flex items-center gap-3 px-4 lg:hidden shrink-0 frost">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
              <svg
                className="w-3 h-3 text-accent-foreground"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1L2 4.5v7L8 15l6-3.5v-7L8 1zm0 1.8l4.2 2.45v4.9L8 12.6 3.8 10.15V5.25L8 2.8z" />
              </svg>
            </div>
            <span className="font-display text-[17px] text-ink">Forgefy</span>
          </Link>
        </div>

        <main className="flex-1 overflow-auto">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {quotaEvent && (
        <TokenExhaustedModal event={quotaEvent} onDismiss={() => setQuotaEvent(null)} />
      )}
    </div>
  );
}
