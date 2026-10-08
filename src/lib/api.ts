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
  // Same-origin: the Worker/Vercel rewrite proxies /ws/* to the backend.
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

/**
 * Poll a GET endpoint, calling onData whenever the response body changes.
 *
 * Replaces the old push-over-WebSocket pattern (see connectWs above) for
 * data that doesn't need sub-second latency: a project/session list changes
 * on user action, not continuously, so polling is strictly simpler and
 * doesn't hold a Firestore-backed connection open per browser tab. Same
 * backoff shape as the old server-side pollers (5s while changing, up to
 * 60s once idle) so perceived responsiveness is unchanged.
 */
export function pollJson<T>(path: string, onData: (data: T) => void): () => void {
  let disposed = false;
  let last: string | null = null;
  let delay = 5_000;
  const pollMax = 60_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick(): Promise<void> {
    if (disposed) return;
    try {
      const res = await apiFetch(path);
      if (res.ok) {
        const text = await res.text();
        if (text !== last) {
          last = text;
          delay = 5_000;
          onData(JSON.parse(text) as T);
        } else {
          delay = Math.min(delay * 2, pollMax);
        }
      }
    } catch {
      // Network hiccup — retry on the next tick at the current delay.
    }
    if (!disposed) timer = setTimeout(() => void tick(), delay);
  }

  void tick();
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined" ? localStorage.getItem("forgefy_refresh_token") : null;
  if (!refreshToken) return false;
  try {
    const res = await fetch("/api/v1/auth/refresh", {
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
  const res = await fetch(path, {
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
  /** Live production URL after a publish — a <slug>.<base-domain> subdomain when
   *  PUBLISH_BASE_DOMAIN is configured, otherwise the project's *.pages.dev URL. */
  published_url?: string | null;
  /** The attached subdomain, e.g. "bun.forgefy.dev". Null when publishing fell
   *  back to the *.pages.dev address (no base domain / name unavailable). */
  published_domain?: string | null;
  published_at?: string | null;
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
  /** "forgefy" | "claude_code" — which coding agent builds this project. Defaults to "forgefy". */
  agent?: string;
  /** Claude Code backend override: "anthropic" | "openrouter" | "ollama" | "litellm" | "custom". */
  claude_code_backend?: string;
  /** Claude Code model name (e.g. "claude-sonnet-4-5", "deepseek-coder"). */
  claude_code_model?: string;
}

export interface CodingAgentOption {
  key: "forgefy" | "claude_code";
  display_name: string;
  available: boolean;
  status: string;
  label: string;
}

export async function fetchAgents(): Promise<CodingAgentOption[]> {
  const res = await apiFetch("/api/v1/agents");
  if (!res.ok) return [];
  return (await res.json()) as CodingAgentOption[];
}

/** A build model offered to the user for selection. */
export interface BuildModelOption {
  /** The value stored against the project/user (e.g. "claude"). */
  value: string;
  /** Display name (e.g. "Claude"). */
  label: string;
  /** Provider name (e.g. "Anthropic"), used to build the subtitle. */
  provider: string;
  /** Short descriptor (e.g. "precise reasoning"). */
  sub: string;
}

/**
 * The build models an admin has offered for selection, from
 * GET /api/v1/account/build-models. This is the single source of truth for the
 * model picker — adding a model in the dashboard makes it show up here, with no
 * frontend deploy. Returns an empty list if the request fails so the caller can
 * render its own empty state.
 */
export async function fetchBuildModels(): Promise<BuildModelOption[]> {
  const res = await apiFetch("/api/v1/account/build-models");
  if (!res.ok) return [];
  const models = (await res.json()) as Array<{
    model: string;
    label?: string;
    provider?: string;
    sub?: string;
  }>;
  return models.map((m) => ({
    value: m.model,
    label: m.label || m.model,
    provider: m.provider ?? "",
    sub: m.sub ?? "",
  }));
}

/** "Google · fast & capable" — the subtitle line for a build-model card. */
export function buildModelSubtitle(opt: BuildModelOption): string {
  return [opt.provider, opt.sub].filter(Boolean).join(" · ");
}

export async function updateProjectAgent(projectId: string, agent: string): Promise<boolean> {
  const res = await apiFetch(`/api/v1/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ agent }),
  });
  return res.ok;
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
