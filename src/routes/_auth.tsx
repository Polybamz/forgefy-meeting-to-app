import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { clearTokens, getToken, getWsUrl } from "@/lib/api";
import { ThemeToggle } from "@/hooks/use-theme";
import { LayoutDashboard, Mic2, FolderKanban, CreditCard, Settings, Menu, X, LogOut } from "lucide-react";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-8 flex flex-col gap-5">
        {/* icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mx-auto">
          <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* heading */}
        <div className="text-center">
          <h2 className="font-display text-xl text-ink mb-1">Tokens exhausted</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            You've used all{" "}
            <span className="font-medium text-ink">{fmt(event.limit)}</span> tokens in your{" "}
            <span className="font-medium text-ink capitalize">{event.tier}</span> plan this month.
            Upgrade to keep building.
          </p>
        </div>

        {/* usage bar */}
        <div className="w-full h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-accent rounded-full w-full" />
        </div>

        {/* actions */}
        <div className="flex flex-col gap-2 mt-1">
          <Link
            to="/billing"
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-accent text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
            onClick={onDismiss}
          >
            Upgrade plan
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
      activeProps={{ className: "!bg-accent/10 !text-accent !font-medium" }}
      activeOptions={{ exact: to === "/dashboard" }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-text-secondary hover:text-ink hover:bg-surface transition-colors w-full"
    >
      <Icon className="h-4 w-4 shrink-0" />
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
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(getWsUrl("/ws/user/events"));
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "quota_exceeded") {
            setQuotaEvent({ message: msg.message, tier: msg.tier ?? "free", limit: msg.limit ?? 0 });
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onclose = () => { reconnectTimer = setTimeout(connect, 5_000); };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => { clearTimeout(reconnectTimer); wsRef.current?.close(); };
  }, []);

  // Close sidebar whenever the route changes
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  function handleLogout() {
    clearTokens();
    navigate({ to: "/login" });
  }

  if (hideNav) {
    return (
      <>
        <Outlet />
        {quotaEvent && <TokenExhaustedModal event={quotaEvent} onDismiss={() => setQuotaEvent(null)} />}
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 w-[220px] flex flex-col border-r border-border bg-background",
          "transition-transform duration-200 ease-in-out",
          "lg:static lg:h-screen lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-border shrink-0">
          <Link to="/dashboard" className="font-display text-[17px] text-ink hover:text-accent transition-colors">
            Forgefy
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-muted hover:text-ink transition-colors p-1"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
          <NavItem to="/sessions" icon={Mic2}>Sessions</NavItem>
          <NavItem to="/projects" icon={FolderKanban}>Projects</NavItem>
        </nav>

        {/* Footer nav */}
        <div className="px-3 py-4 border-t border-border space-y-0.5 shrink-0">
          <NavItem to="/billing" icon={CreditCard}>Billing</NavItem>
          <NavItem to="/settings" icon={Settings}>Settings</NavItem>
          <div className="mt-3 flex items-center justify-between px-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-ink transition-colors"
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
        <div className="h-12 border-b border-border flex items-center gap-3 px-4 lg:hidden shrink-0 bg-background">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-muted hover:text-ink transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="font-display text-[17px] text-ink">Forgefy</Link>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {quotaEvent && (
        <TokenExhaustedModal event={quotaEvent} onDismiss={() => setQuotaEvent(null)} />
      )}
    </div>
  );
}
