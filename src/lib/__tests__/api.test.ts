import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  clearTokens,
  getToken,
  listStoredSessions,
  setTokens,
  storeSession,
  updateStoredSession,
} from "@/lib/api";

describe("token storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when no token is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("round-trips access and refresh tokens", () => {
    setTokens("access-123", "refresh-456");
    expect(getToken()).toBe("access-123");
    expect(localStorage.getItem("forgefy_refresh_token")).toBe("refresh-456");
  });

  it("clears both tokens", () => {
    setTokens("access-123", "refresh-456");
    clearTokens();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("forgefy_refresh_token")).toBeNull();
  });
});

/**
 * Build a JWT-shaped token whose `exp` is `secondsFromNow` in the future.
 *
 * apiFetch proactively refreshes via ensureFreshToken() whenever the access
 * token is unparseable or within 60s of expiry, and that refresh is itself a
 * fetch call. Opaque strings like "access-123" always look stale, so tests that
 * aren't about the proactive path must use a real, comfortably-fresh JWT —
 * otherwise the extra refresh consumes a mockResolvedValueOnce and every later
 * assertion shifts by one call.
 */
function jwt(secondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
  return `header.${payload}.signature`;
}

const FRESH = jwt(3600);

describe("apiFetch", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
    // jsdom throws "Not implemented: navigation" on window.location.href
    // assignment — stub it out so the 401-redirect path is observable.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("attaches a Bearer token when one is stored", async () => {
    setTokens(FRESH, "refresh-456");
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiFetch("/api/v1/projects");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FRESH}`);
  });

  it("omits the Authorization header when unauthenticated", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await apiFetch("/api/v1/projects");

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("refreshes the token and retries once on a 401", async () => {
    // Fresh by `exp`, but rejected server-side (revoked) — this is the reactive
    // 401 path, not the proactive-expiry one covered below.
    setTokens(FRESH, "refresh-456");
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // initial call
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh" }), {
          status: 200,
        }),
      ) // refresh call
      .mockResolvedValueOnce(new Response(null, { status: 200 })); // retried call

    const res = await apiFetch("/api/v1/projects");

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(getToken()).toBe("new-access");
  });

  it("clears tokens and redirects to /login when refresh fails", async () => {
    setTokens(FRESH, "refresh-456");
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // initial call
      .mockResolvedValueOnce(new Response(null, { status: 401 })); // refresh call fails

    await apiFetch("/api/v1/projects");

    expect(getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("refreshes proactively when the stored token is near expiry", async () => {
    // 30s of life left — inside the 60s staleness window, so the refresh should
    // happen *before* the request rather than after a wasted 401 round-trip.
    setTokens(jwt(30), "refresh-456");
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh" }), {
          status: 200,
        }),
      ) // proactive refresh
      .mockResolvedValueOnce(new Response(null, { status: 200 })); // the actual request

    const res = await apiFetch("/api/v1/projects");

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain("/api/v1/auth/refresh");

    // The request must carry the refreshed token, not the stale one.
    const [, init] = vi.mocked(global.fetch).mock.calls[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer new-access");
  });
});

describe("stored sessions", () => {
  beforeEach(() => localStorage.clear());

  const session = {
    id: "s1",
    platform: "meet",
    meeting_url: null,
    status: "WAITING",
    created_at: "2026-01-01T00:00:00Z",
  };

  it("starts empty", () => {
    expect(listStoredSessions()).toEqual([]);
  });

  it("stores and lists a session most-recent-first", () => {
    storeSession(session);
    storeSession({ ...session, id: "s2" });

    const sessions = listStoredSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("s2");
  });

  it("replaces an existing session with the same id instead of duplicating", () => {
    storeSession(session);
    storeSession({ ...session, status: "JOINING" });

    const sessions = listStoredSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("JOINING");
  });

  it("patches a stored session by id", () => {
    storeSession(session);
    updateStoredSession("s1", { status: "PROCESSING" });

    expect(listStoredSessions()[0].status).toBe("PROCESSING");
  });

  it("caps stored sessions at 20", () => {
    for (let i = 0; i < 25; i++) {
      storeSession({ ...session, id: `s${i}` });
    }
    expect(listStoredSessions()).toHaveLength(20);
  });
});
