import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getWsUrl, updateStoredSession } from "@/lib/api";

export const Route = createFileRoute("/_auth/sessions/$sessionId")({
  component: SessionPage,
  head: () => ({ meta: [{ title: "Session — Forgefy" }] }),
});

// ---------------------------------------------------------------------------
// Types mirroring the backend schemas
// ---------------------------------------------------------------------------
type SessionStatus =
  | "WAITING"
  | "JOINING"
  | "LISTENING"
  | "PROCESSING"
  | "BLUEPRINT_READY"
  | "APPROVED"
  | "BUILDING";

interface SessionEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

interface Session {
  id: string;
  user_id: string;
  status: SessionStatus;
  platform: string;
  meeting_url: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  recent_events: SessionEvent[];
}

interface Blueprint {
  id: string;
  session_id: string;
  json_output: Record<string, unknown> | null;
  approved: boolean;
  created_at: string;
}

interface TranscriptLine {
  text: string;
  speaker?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const STATUS_LABEL: Record<SessionStatus, string> = {
  WAITING: "Waiting to join",
  JOINING: "Joining meeting…",
  LISTENING: "Listening",
  PROCESSING: "Generating blueprint…",
  BLUEPRINT_READY: "Blueprint ready",
  APPROVED: "Approved",
  BUILDING: "Building apps…",
};

const PLATFORM_LABEL: Record<string, string> = {
  meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  physical: "Physical",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SessionStatus }) {
  const isActive = ["JOINING", "LISTENING", "PROCESSING", "BUILDING"].includes(status);
  const isReady = ["BLUEPRINT_READY", "APPROVED"].includes(status);
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium",
        isActive
          ? "bg-accent/10 text-accent"
          : isReady
            ? "bg-[oklch(0.55_0.18_145)]/10 text-[oklch(0.45_0.18_145)]"
            : "bg-surface text-text-muted",
      ].join(" ")}
    >
      {isActive && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

function BlueprintSection({
  sessionId,
  onApproved,
}: {
  sessionId: string;
  onApproved: () => void;
}) {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [bpLoading, setBpLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  const fetchBlueprint = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/voxa/blueprint/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBlueprint(data);
    }
    setBpLoading(false);
  }, []);

  useEffect(() => {
    apiFetch(`/api/v1/voxa/session/${sessionId}`)
      .then((r) => r.json())
      .then((session: Session) => {
        const ev = session.recent_events.find(
          (e) =>
            e.event_type === "blueprint_ready" ||
            e.event_type === "BLUEPRINT_READY",
        );
        const bpId =
          (ev?.payload?.blueprint_id as string | undefined) ??
          (ev?.payload?.id as string | undefined);
        if (bpId) {
          fetchBlueprint(bpId);
        } else {
          setBpLoading(false);
          setError("Blueprint ID not found in session events.");
        }
      })
      .catch(() => {
        setBpLoading(false);
        setError("Failed to load blueprint.");
      });
  }, [sessionId, fetchBlueprint]);

  async function handleApprove() {
    if (!blueprint) return;
    setApproving(true);
    try {
      const res = await apiFetch(
        `/api/v1/voxa/blueprint/${blueprint.id}/approve`,
        { method: "POST" },
      );
      if (res.ok) {
        setBlueprint({ ...blueprint, approved: true });
        onApproved();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Approval failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setApproving(false);
    }
  }

  if (bpLoading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-text-muted py-8">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        Loading blueprint…
      </div>
    );
  }

  if (error && !blueprint) {
    return <p className="text-[13px] text-destructive py-4">{error}</p>;
  }

  if (!blueprint?.json_output) {
    return (
      <p className="text-[14px] text-text-muted py-4">
        Blueprint is empty. The AI may still be generating it.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[22px] text-ink">App Blueprint</h3>
        {!blueprint.approved && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
          >
            {approving ? "Approving…" : "✓ Approve & build"}
          </button>
        )}
        {blueprint.approved && (
          <span className="text-[13px] font-medium text-[oklch(0.45_0.18_145)]">
            ✓ Approved
          </span>
        )}
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-[#0f0d0b] overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#222]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="ml-3 text-[11px] font-mono-ui text-[#7A6F65]">
            blueprint.json
          </span>
        </div>
        <pre className="px-5 py-5 text-[12px] leading-[1.7] font-mono-ui text-[#E8DFD3] overflow-x-auto max-h-[480px]">
          {JSON.stringify(blueprint.json_output, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function TranscriptPanel({ lines }: { lines: TranscriptLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (lines.length === 0) {
    return (
      <p className="text-[13px] text-text-muted italic">
        Transcript will appear here as the meeting progresses…
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {lines.map((l, i) => (
        <div key={i} className="text-[13px] leading-[1.6]">
          {l.speaker && (
            <span className="font-medium text-accent mr-2">{l.speaker}:</span>
          )}
          <span className="text-text-secondary">{l.text}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function SessionPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/voxa/session/${sessionId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Session not found." : "Failed to load session.");
        return null;
      }
      const data: Session = await res.json();
      setSession(data);
      updateStoredSession(data.id, { status: data.status });
      return data;
    } catch {
      setError("Network error.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // WebSocket — connect when JOINING or LISTENING
  useEffect(() => {
    if (!session) return;
    const liveStatuses: SessionStatus[] = ["JOINING", "LISTENING"];
    if (!liveStatuses.includes(session.status)) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    if (wsRef.current && wsRef.current.readyState < 2) return;

    const ws = new WebSocket(getWsUrl("/ws/voxa"));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "joinSession", session_id: sessionId }));
      const ping = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
      }, 25_000);
      ws.addEventListener("close", () => clearInterval(ping));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as Record<string, unknown>;
        switch (msg.type) {
          case "transcript":
            setTranscript((prev) => [
              ...prev,
              { text: (msg.text as string) ?? "", speaker: msg.speaker as string | undefined, timestamp: Date.now() },
            ]);
            break;
          case "featureDetected":
            setFeatures((prev) => [...prev, (msg.feature as string) ?? JSON.stringify(msg)]);
            break;
          case "blueprintReady":
          case "meetingStatus":
            fetchSession();
            break;
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => { /* backend may not be running */ };

    return () => { ws.close(); };
  }, [session?.status, sessionId, fetchSession]);

  // Poll when PROCESSING
  useEffect(() => {
    if (session?.status !== "PROCESSING") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchSession, 5_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.status, fetchSession]);

  async function handleJoin() {
    if (!session) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await apiFetch("/api/v1/voxa/session/join", {
        method: "POST",
        body: JSON.stringify({ session_id: session.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.detail ?? "Failed to join.");
        return;
      }
      await fetchSession();
    } catch {
      setActionError("Network error.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnd() {
    if (!session) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await apiFetch("/api/v1/voxa/session/end", {
        method: "POST",
        body: JSON.stringify({ session_id: session.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.detail ?? "Failed to end session.");
        return;
      }
      wsRef.current?.close();
      await fetchSession();
    } catch {
      setActionError("Network error.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted text-[14px]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse mr-2" />
        Loading session…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-3xl mx-auto">
        <p className="text-destructive text-[14px]">{error || "Session not found."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-[13px] text-accent underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const isLive = ["JOINING", "LISTENING"].includes(session.status);
  const isProcessing = session.status === "PROCESSING";
  const isBlueprintReady = ["BLUEPRINT_READY", "APPROVED"].includes(session.status);
  const isBuilding = session.status === "BUILDING";

  return (
    <div className="px-6 md:px-[8vw] py-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/dashboard" className="text-[13px] text-text-muted hover:text-ink transition-colors">
          ← Dashboard
        </Link>
        <div className="mt-4 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">
              {PLATFORM_LABEL[session.platform] ?? session.platform} session
            </h1>
            {session.meeting_url && (
              <p className="mt-1 text-[13px] font-mono-ui text-text-muted truncate max-w-sm">
                {session.meeting_url}
              </p>
            )}
          </div>
          <StatusBadge status={session.status} />
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mb-4 text-[13px] text-destructive">{actionError}</p>
      )}

      {/* WAITING */}
      {session.status === "WAITING" && (
        <div className="rounded-xl border border-border bg-warm-white p-8 text-center space-y-4">
          <p className="text-[15px] text-text-secondary">
            Forgefy is ready. Click below to dispatch the bot into your call.
          </p>
          <button
            onClick={handleJoin}
            disabled={actionLoading}
            className="px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
          >
            {actionLoading ? "Joining…" : "Join meeting →"}
          </button>
        </div>
      )}

      {/* LIVE */}
      {isLive && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-warm-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium text-ink flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Live transcript
              </p>
              <button
                onClick={handleEnd}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-text-secondary hover:border-destructive hover:text-destructive transition-colors disabled:opacity-60"
              >
                {actionLoading ? "Ending…" : "End meeting"}
              </button>
            </div>
            <TranscriptPanel lines={transcript} />
          </div>
          {features.length > 0 && (
            <div className="rounded-xl border border-border bg-warm-white p-6">
              <p className="label-eyebrow mb-3">Detected features</p>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROCESSING */}
      {isProcessing && (
        <div className="rounded-xl border border-border bg-warm-white p-8 text-center space-y-3">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[15px] text-text-secondary">
            Analysing the transcript and generating your app blueprint…
          </p>
          <p className="text-[12px] text-text-muted">Usually takes 30–90 seconds.</p>
        </div>
      )}

      {/* BLUEPRINT_READY / APPROVED */}
      {isBlueprintReady && (
        <BlueprintSection sessionId={sessionId} onApproved={fetchSession} />
      )}

      {/* BUILDING */}
      {isBuilding && (
        <div className="rounded-xl border border-border bg-warm-white p-8 text-center space-y-3">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-[oklch(0.55_0.18_145)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[15px] text-text-secondary">
            Building your Flutter, React Native, and Next.js apps…
          </p>
        </div>
      )}

      {/* Event log */}
      {session.recent_events.length > 0 && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="label-eyebrow mb-4">Event log</p>
          <div className="space-y-2">
            {session.recent_events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-[12px] text-text-muted font-mono-ui">
                <span className="shrink-0 text-text-muted/60">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-accent">{ev.event_type}</span>
                {ev.payload && (
                  <span className="text-text-muted/80 truncate">
                    {JSON.stringify(ev.payload).slice(0, 80)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
