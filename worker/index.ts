/**
 * Cloudflare Worker entry point.
 *
 * Reproduces the two things vercel.json does that static hosting cannot:
 *
 *   1. Proxies /api/* and /ws/* to the backend origin, so the browser only ever
 *      talks to one host. Keeping them same-origin is what lets the CSP stay on
 *      `connect-src 'self'` and avoids CORS preflights entirely.
 *   2. Falls back to _shell.html for client-side routes. Cloudflare's built-in
 *      "single-page-application" mode serves /index.html, which this build does
 *      not produce — TanStack Start's SPA mode emits _shell.html instead.
 */

interface Env {
  ASSETS: Fetcher;
  API_ORIGIN: string;
}

/** Paths proxied to the backend, mirroring the vercel.json rewrites. */
const PROXY_PREFIXES = ["/api/", "/ws/"];

function isProxied(pathname: string): boolean {
  // Match the prefix itself too ("/api"), not just "/api/...".
  return PROXY_PREFIXES.some((p) => pathname.startsWith(p) || pathname === p.slice(0, -1));
}

/**
 * Forward a request to the backend, preserving method, headers and body.
 *
 * WebSocket upgrades pass straight through: returning the origin's 101 response
 * hands the socket pair back to the client, so /ws works the same as it does
 * behind Vercel's rewrite.
 */
function proxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.API_ORIGIN);
  return fetch(target.toString(), request);
}

/**
 * True for requests the browser makes when navigating, as opposed to fetching a
 * missing asset. Only navigations should receive the SPA shell — answering a
 * missing .js or .png with HTML produces confusing MIME-type errors instead of
 * an honest 404.
 */
function isNavigation(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("Sec-Fetch-Mode") === "navigate") return true;
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isProxied(url.pathname)) {
      return proxy(request, env);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) {
      return asset;
    }

    if (!isNavigation(request)) {
      return asset; // a genuinely missing file — let the 404 stand
    }

    // Client-side route: serve the shell and let the router resolve it.
    const shell = await env.ASSETS.fetch(new URL("/_shell.html", url.origin));
    return new Response(shell.body, {
      status: 200,
      headers: shell.headers,
    });
  },
} satisfies ExportedHandler<Env>;
