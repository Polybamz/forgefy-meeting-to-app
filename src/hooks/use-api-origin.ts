import { useEffect, useState } from "react";

/**
 * The origin developers should call for the API, for display in docs and
 * snippets. /api/* is proxied same-origin (Worker in production, Vite in
 * dev), so the page's own origin is always the right value. The placeholder
 * only exists for the prerendered HTML — the real origin replaces it after
 * hydration (set in an effect so server and first client render match).
 */
export function useApiOrigin(): string {
  const [origin, setOrigin] = useState("https://<your-forgefy-host>");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  return origin;
}
