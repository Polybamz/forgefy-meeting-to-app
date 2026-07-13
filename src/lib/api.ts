// Empty base — Vite's dev proxy forwards /api/* and /ws/* to the backend.
// For production, set VITE_API_URL to the backend's absolute origin.
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("forgefy_access_token");
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem("forgefy_access_token", access);
  localStorage.setItem("forgefy_refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("forgefy_access_token");
  localStorage.removeItem("forgefy_refresh_token");
}

export function getWsUrl(path: string): string {
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  if (API_BASE) {
    // Absolute base configured (production) — convert http → ws
    return `${API_BASE.replace(/^http/, "ws")}${path}${query}`;
  }
  // Dev proxy: derive ws URL from current page origin
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${path}${query}`;
  }
  return path + query;
}

function tokenExpiresSoon(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Treat tokens within 60s of expiry as stale so we never connect with one
    // that dies mid-handshake.
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

export async function ensureFreshToken(): Promise<void> {
  if (tokenExpiresSoon()) await attemptRefresh();
}

/**
 * Open a WebSocket that survives access-token expiry.
 *
 * Refreshes the token before connecting when it is expired/near expiry,
 * reconnects with exponential backoff, and force-refreshes when the server
 * closes with code 4001 (auth failure). `setup` runs once per connection
 * attempt to attach handlers. Returns a dispose function that stops the loop.
 */
export function connectWs(path: string, setup: (ws: WebSocket) => void): () => void {
  let disposed = false;
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = 2_000;

  async function open(forceRefresh: boolean): Promise<void> {
    if (forceRefresh) await attemptRefresh();
    else await ensureFreshToken();
    if (disposed) return;

    ws = new WebSocket(getWsUrl(path));
    setup(ws);

    ws.addEventListener("open", () => {
      delay = 2_000;
    });
    ws.addEventListener("close", (e) => {
      if (disposed) return;
      timer = setTimeout(() => void open(e.code === 4001), delay);
      delay = Math.min(delay * 2, 30_000);
    });
  }

  void open(false);
  return () => {
    disposed = true;
    clearTimeout(timer);
    ws?.close();
  };
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined" ? localStorage.getItem("forgefy_refresh_token") : null;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch(path: string, init?: RequestInit, _retry = true): Promise<Response> {
  // Refresh proactively when the token is at/near expiry so requests don't
  // burn a round-trip on a guaranteed 401 (the reactive path below still
  // covers tokens revoked server-side).
  if (_retry) await ensureFreshToken();
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401 && _retry) {
    const refreshed = await attemptRefresh();
    if (refreshed) return apiFetch(path, init, false);
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  return res;
}

// ---------------------------------------------------------------------------
// Session helpers stored in localStorage so the dashboard can list them
// without a backend list endpoint.
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  owner_id: string;
  app_name: string;
  template_key: string;
  repo_full_name: string;
  github_url: string;
  /** "platform" = repo is on Forgefy's GitHub account; "user" = repo is on the user's account */
  repo_owner?: "platform" | "user";
  preview_url: string | null;
  artifact_url: string | null;
  is_updating: boolean;
  build_error: string | null;
  /** "retry" | "user_fix" | "support" */
  build_error_action?: string | null;
  session_id: string | null;
  blueprint_id: string | null;
  created_at: string;
  updated_at: string;
  supabase_project_ref?: string | null;
  supabase_url?: string | null;
  supabase_anon_key?: string | null;
  neon_project_id?: string | null;
  neon_data_api_url?: string | null;
  firebase_project_id?: string | null;
  firebase_api_key?: string | null;
  firebase_auth_domain?: string | null;
  firebase_storage_bucket?: string | null;
  firebase_messaging_sender_id?: string | null;
  firebase_app_id?: string | null;
  db_decision_pending?: boolean;
  db_decision_reason?: string | null;
}

export interface BillingStatus {
  tier: string;
  tier_name: string;
  price_usd: number;
  monthly_tokens: number;
  tokens_used: number;
  tokens_remaining: number;
  expires_at: string | null;
}

export interface StoredSession {
  id: string;
  platform: string;
  meeting_url: string | null;
  status: string;
  created_at: string;
}

export function storeSession(session: StoredSession): void {
  const existing = listStoredSessions();
  const updated = [session, ...existing.filter((s) => s.id !== session.id)].slice(0, 20);
  localStorage.setItem("forgefy_sessions", JSON.stringify(updated));
}

export function updateStoredSession(id: string, patch: Partial<StoredSession>): void {
  const existing = listStoredSessions();
  const updated = existing.map((s) => (s.id === id ? { ...s, ...patch } : s));
  localStorage.setItem("forgefy_sessions", JSON.stringify(updated));
}

export function listStoredSessions(): StoredSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("forgefy_sessions") ?? "[]");
  } catch {
    return [];
  }
}
