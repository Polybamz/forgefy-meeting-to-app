import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, type Project } from "@/lib/api";

export interface SupabaseOrg {
  id: string;
  name: string;
}

interface UseProjectIntegrationsOptions {
  projectId: string;
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  fetchProject: () => Promise<Project | null>;
}

/**
 * The GitHub / Supabase / Neon / Firebase connect flows.
 *
 * All four are near-identical: check link status on mount, read the OAuth
 * return out of the query string, POST a connect, then either dispatch the
 * withheld first build or ask for wire-in confirmation. They are grouped here
 * because they share `handleDbConnectResponse` and the database modal, and
 * because none of it is chat.
 */
export function useProjectIntegrations({
  projectId,
  project,
  setProject,
  fetchProject,
}: UseProjectIntegrationsOptions) {
  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const [supabaseLinked, setSupabaseLinked] = useState<boolean | null>(null);
  const [connectingSupabase, setConnectingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState("");
  const [supabaseOrgs, setSupabaseOrgs] = useState<SupabaseOrg[] | null>(null);

  const [connectingNeon, setConnectingNeon] = useState(false);
  const [neonError, setNeonError] = useState("");

  const [firebaseLinked, setFirebaseLinked] = useState<boolean | null>(null);
  const [connectingFirebase, setConnectingFirebase] = useState(false);
  const [firebaseError, setFirebaseError] = useState("");

  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [skippingDb, setSkippingDb] = useState(false);
  const [skipDbError, setSkipDbError] = useState("");
  const [wireInPrompt, setWireInPrompt] = useState<string | null>(null);
  const [wiringIn, setWiringIn] = useState(false);
  const [wireInError, setWireInError] = useState("");

  const pendingTransferRef = useRef(false);

  // ── Link status + OAuth returns ───────────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/v1/auth/github/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setGithubLinked(d.linked))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setGithubLinked(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("pending_transfer") === "true") {
      setGithubLinked(true);
      pendingTransferRef.current = true;
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    apiFetch("/api/v1/auth/supabase/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSupabaseLinked(d.linked))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("supabase") === "connected") {
      setSupabaseLinked(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("supabase_error")) {
      setSupabaseError("Could not connect your Supabase account. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    apiFetch("/api/v1/auth/firebase/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFirebaseLinked(d.linked))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("firebase") === "connected") {
      setFirebaseLinked(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("firebase_error")) {
      setFirebaseError("Could not connect your Google account. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── GitHub ────────────────────────────────────────────────────────────────
  async function transferToGitHub() {
    setTransferring(true);
    setTransferError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/transfer-github`, {
        method: "POST",
      });
      if (res.ok) {
        setProject(await res.json());
      } else {
        const d = await res.json().catch(() => ({}));
        setTransferError((d as { detail?: string }).detail ?? "Transfer failed. Please try again.");
      }
    } catch {
      setTransferError("Network error. Please try again.");
    } finally {
      setTransferring(false);
    }
  }

  async function connectGitHubForTransfer() {
    localStorage.setItem(
      "forgefy_github_pending_return",
      `${window.location.pathname}?pending_transfer=true`,
    );
    const res = await apiFetch("/api/v1/auth/github/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  // A transfer requested before the project finished building runs as soon as
  // it is idle.
  useEffect(() => {
    if (pendingTransferRef.current && project && !project.is_updating) {
      pendingTransferRef.current = false;
      transferToGitHub();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // ── Shared connect result ─────────────────────────────────────────────────
  async function handleDbConnectResponse(res: Response, providerLabel: string) {
    const data = (await res.json().catch(() => ({}))) as {
      build_queued?: boolean;
      prompt_wire_in?: boolean;
    };
    await fetchProject();
    if (data.prompt_wire_in) {
      setDbModalOpen(false);
      setWireInPrompt(providerLabel);
    } else if (data.build_queued) {
      setDbModalOpen(false);
    }
  }

  // ── Supabase ──────────────────────────────────────────────────────────────
  async function connectSupabaseAccount() {
    const res = await apiFetch("/api/v1/auth/supabase/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  async function connectSupabaseProject(organizationId: string) {
    setConnectingSupabase(true);
    setSupabaseError("");
    setSupabaseOrgs(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/supabase/connect`, {
        method: "POST",
        body: JSON.stringify({ organization_id: organizationId }),
      });
      if (res.ok) {
        await handleDbConnectResponse(res, "Supabase");
      } else {
        const d = await res.json().catch(() => ({}));
        setSupabaseError(
          (d as { detail?: string }).detail ?? "Could not provision a database. Please try again.",
        );
      }
    } catch {
      setSupabaseError("Network error. Please try again.");
    } finally {
      setConnectingSupabase(false);
    }
  }

  async function startSupabaseConnect() {
    setSupabaseError("");
    setConnectingSupabase(true);
    try {
      const res = await apiFetch("/api/v1/auth/supabase/organizations");
      if (!res.ok) {
        setSupabaseError("Could not list your Supabase organizations. Please try again.");
        return;
      }
      const orgs: SupabaseOrg[] = await res.json();
      if (orgs.length === 0) {
        setSupabaseError("No Supabase organizations found on your account.");
      } else if (orgs.length === 1) {
        await connectSupabaseProject(orgs[0].id);
        return;
      } else {
        setSupabaseOrgs(orgs);
      }
    } catch {
      setSupabaseError("Network error. Please try again.");
    } finally {
      setConnectingSupabase(false);
    }
  }

  // ── Neon ──────────────────────────────────────────────────────────────────
  async function connectNeon() {
    setConnectingNeon(true);
    setNeonError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/neon/connect`, {
        method: "POST",
      });
      if (res.ok) {
        await handleDbConnectResponse(res, "Neon");
      } else {
        const d = await res.json().catch(() => ({}));
        setNeonError(
          (d as { detail?: string }).detail ?? "Could not provision a database. Please try again.",
        );
      }
    } catch {
      setNeonError("Network error. Please try again.");
    } finally {
      setConnectingNeon(false);
    }
  }

  // ── Firebase ──────────────────────────────────────────────────────────────
  async function connectFirebaseAccount() {
    const res = await apiFetch("/api/v1/auth/firebase/authorize");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  async function connectFirebaseProject() {
    setConnectingFirebase(true);
    setFirebaseError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/firebase/connect`, {
        method: "POST",
      });
      if (res.ok) {
        await handleDbConnectResponse(res, "Firebase");
      } else {
        const d = await res.json().catch(() => ({}));
        setFirebaseError(
          (d as { detail?: string }).detail ?? "Could not provision a database. Please try again.",
        );
      }
    } catch {
      setFirebaseError("Network error. Please try again.");
    } finally {
      setConnectingFirebase(false);
    }
  }

  // ── Skip / wire-in ────────────────────────────────────────────────────────
  async function skipDatabase() {
    setSkippingDb(true);
    setSkipDbError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/skip-database`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchProject();
      } else {
        const d = await res.json().catch(() => ({}));
        setSkipDbError(
          (d as { detail?: string }).detail ?? "Could not continue. Please try again.",
        );
      }
    } catch {
      setSkipDbError("Network error. Please try again.");
    } finally {
      setSkippingDb(false);
    }
  }

  async function wireDatabaseIn() {
    setWiringIn(true);
    setWireInError("");
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/wire-database`, {
        method: "POST",
      });
      if (res.ok) {
        setWireInPrompt(null);
        await fetchProject();
      } else {
        const d = await res.json().catch(() => ({}));
        setWireInError(
          (d as { detail?: string }).detail ?? "Could not queue the update. Please try again.",
        );
      }
    } catch {
      setWireInError("Network error. Please try again.");
    } finally {
      setWiringIn(false);
    }
  }

  // Stable, because it is handed to the memoised ChatBubble.
  const openDbModal = useCallback(() => setDbModalOpen(true), []);
  const closeDbModal = useCallback(() => setDbModalOpen(false), []);
  const dismissSupabaseOrgPicker = useCallback(() => setSupabaseOrgs(null), []);
  const dismissWireInPrompt = useCallback(() => setWireInPrompt(null), []);

  return {
    // GitHub
    githubLinked,
    transferring,
    transferError,
    transferToGitHub,
    connectGitHubForTransfer,
    // Supabase
    supabaseLinked,
    connectingSupabase,
    supabaseError,
    supabaseOrgs,
    connectSupabaseAccount,
    startSupabaseConnect,
    connectSupabaseProject,
    dismissSupabaseOrgPicker,
    // Neon
    connectingNeon,
    neonError,
    connectNeon,
    // Firebase
    firebaseLinked,
    connectingFirebase,
    firebaseError,
    connectFirebaseAccount,
    connectFirebaseProject,
    // Database modal / decision
    dbModalOpen,
    openDbModal,
    closeDbModal,
    skippingDb,
    skipDbError,
    skipDatabase,
    wireInPrompt,
    wiringIn,
    wireInError,
    wireDatabaseIn,
    dismissWireInPrompt,
  };
}
