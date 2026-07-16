import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * The absolute origin of the backend API, for display in docs and snippets.
 *
 * Production builds bake in VITE_API_URL; with the dev proxy (empty base) the
 * API shares the page's origin. The placeholder only exists for the
 * prerendered HTML — the real origin replaces it after hydration (set in an
 * effect so server and first client render match).
 */
export function useApiOrigin(): string {
  const [origin, setOrigin] = useState(API_BASE || "https://<your-forgefy-host>");

  useEffect(() => {
    if (!API_BASE && typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  return origin;
}
