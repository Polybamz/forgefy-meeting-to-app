import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { clearTokens, getToken, getWsUrl } from "@/lib/api";
import { ThemeToggle } from "@/hooks/use-theme";

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
// Auth layout
// ---------------------------------------------------------------------------

function AuthLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = /^\/projects\//.test(pathname);

  const [quotaEvent, setQuotaEvent] = useState<QuotaEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to the user-events WS once for the lifetime of the auth session.
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
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        // Reconnect after 5 s so the modal fires even if the connection drops mid-build.
        reconnectTimer = setTimeout(connect, 5_000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  function handleLogout() {
    clearTokens();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      {!hideNav && (
        <header className="h-12 border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <div className="h-full mx-auto flex items-center justify-between px-6">
            <Link to="/dashboard" className="font-display text-[18px] text-ink hover:text-accent transition-colors">
              Forgefy
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/billing"
                className="text-[13px] text-text-muted hover:text-ink transition-colors"
              >
                Billing
              </Link>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="text-[13px] text-text-muted hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
      )}
      <Outlet />

      {quotaEvent && (
        <TokenExhaustedModal
          event={quotaEvent}
          onDismiss={() => setQuotaEvent(null)}
        />
      )}
    </div>
  );
}
