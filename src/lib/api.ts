const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

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
  const wsBase = API_BASE.replace(/^http/, "ws");
  const token = getToken();
  return `${wsBase}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
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
