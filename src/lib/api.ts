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

async function attemptRefresh(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined"
      ? localStorage.getItem("forgefy_refresh_token")
      : null;
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

export async function apiFetch(
  path: string,
  init?: RequestInit,
  _retry = true,
): Promise<Response> {
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
  preview_url: string | null;
  artifact_url: string | null;
  is_updating: boolean;
  build_error: string | null;
  session_id: string | null;
  blueprint_id: string | null;
  created_at: string;
  updated_at: string;
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
  const updated = [
    session,
    ...existing.filter((s) => s.id !== session.id),
  ].slice(0, 20);
  localStorage.setItem("forgefy_sessions", JSON.stringify(updated));
}

export function updateStoredSession(
  id: string,
  patch: Partial<StoredSession>,
): void {
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
