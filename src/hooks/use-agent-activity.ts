import { useCallback, useEffect, useRef, useState } from "react";
import { connectWs } from "@/lib/api";
import { appendLog, type LogEntry, type PlanData, type TurnActivity } from "@/lib/chat";

// Coalesce log-driven repaints over this many animation frames. Log ticks
// arrive several per second; one setState each re-rendered the transcript per
// message.
const LOG_FLUSH_FRAMES = 3;

export interface AgentActivity {
  /** Throttled render copy of the live log stream. */
  logs: LogEntry[];
  currentPlan: PlanData | null;
  writtenFiles: Set<string>;
  /** The message this run belongs to, or null for an unowned run. */
  runOwnerId: string | null;
  /** Clear the buffers and begin a run owned by `ownerId`. */
  startRun: (ownerId: string | null) => void;
  /** Hand an in-flight run to a different message. */
  setRunOwner: (ownerId: string | null) => void;
  /** Everything the run produced, for freezing onto its message. */
  takeActivitySnapshot: () => TurnActivity;
  /** Read and clear the current owner. Called once, when a run ends. */
  claimRunOwner: () => string | null;
}

/**
 * The live agent activity for one project: the log socket, the plan, the files
 * written, and which message the current run belongs to.
 *
 * The run/message association is the point. Activity used to be one block
 * pinned to the bottom of the panel that the next send wiped out; tying it to
 * an owner is what lets the transcript keep a record per turn.
 */
export function useAgentActivity(projectId: string): AgentActivity {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<Set<string>>(new Set());
  const [runOwnerId, setRunOwnerId] = useState<string | null>(null);

  // logsRef is the source of truth, not a mirror: events land here immediately
  // and are flushed to state at most once per LOG_FLUSH_FRAMES frames, so a
  // snapshot taken at any moment is complete even if a flush is pending.
  const logsRef = useRef<LogEntry[]>([]);
  const planRef = useRef<PlanData | null>(null);
  const writtenFilesRef = useRef<Set<string>>(new Set());
  const runOwnerIdRef = useRef<string | null>(null);
  const runStartedAtRef = useRef<number>(0);
  const flushHandleRef = useRef<number | null>(null);
  const framesWaitedRef = useRef(0);
  const wsLogsRef = useRef<WebSocket | null>(null);

  const scheduleLogFlush = useCallback(() => {
    if (flushHandleRef.current !== null) return;
    framesWaitedRef.current = 0;
    const tick = () => {
      framesWaitedRef.current += 1;
      if (framesWaitedRef.current < LOG_FLUSH_FRAMES) {
        flushHandleRef.current = requestAnimationFrame(tick);
        return;
      }
      flushHandleRef.current = null;
      setLogs(logsRef.current);
    };
    flushHandleRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (flushHandleRef.current !== null) cancelAnimationFrame(flushHandleRef.current);
    };
  }, []);

  useEffect(() => {
    planRef.current = currentPlan;
  }, [currentPlan]);

  useEffect(() => {
    writtenFilesRef.current = writtenFiles;
  }, [writtenFiles]);

  // Begin a new run: the previous run's activity is already frozen onto its own
  // message, so clearing the live buffers here loses nothing.
  const startRun = useCallback((ownerId: string | null) => {
    runOwnerIdRef.current = ownerId;
    runStartedAtRef.current = Date.now();
    if (flushHandleRef.current !== null) {
      cancelAnimationFrame(flushHandleRef.current);
      flushHandleRef.current = null;
    }
    logsRef.current = [];
    setRunOwnerId(ownerId);
    setLogs([]);
    setCurrentPlan(null);
    setWrittenFiles(new Set());
  }, []);

  const setRunOwner = useCallback((ownerId: string | null) => {
    runOwnerIdRef.current = ownerId;
    setRunOwnerId(ownerId);
  }, []);

  const takeActivitySnapshot = useCallback(
    (): TurnActivity => ({
      logs: logsRef.current,
      plan: planRef.current,
      writtenFiles: [...writtenFilesRef.current],
      startedAt: runStartedAtRef.current || Date.now(),
      endedAt: Date.now(),
    }),
    [],
  );

  const claimRunOwner = useCallback(() => {
    const owner = runOwnerIdRef.current;
    runOwnerIdRef.current = null;
    setRunOwnerId(null);
    return owner;
  }, []);

  useEffect(() => {
    return connectWs(`/ws/projects/${projectId}/logs`, (ws) => {
      wsLogsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const entry = JSON.parse(e.data);
          if (entry.type === "ping") return;

          if (entry.type === "plan") {
            try {
              setCurrentPlan(JSON.parse(entry.message) as PlanData);
              setWrittenFiles(new Set());
            } catch {
              /* ignore malformed plan */
            }
            return;
          }

          if (entry.type === "file_written") {
            if (entry.message) {
              setWrittenFiles((prev) => new Set([...prev, entry.message as string]));
            }
            return;
          }

          const newEntry = { ...entry, ts: Date.now() + Math.random() };
          // Straight into the ref, then coalesce the repaint.
          logsRef.current = appendLog(logsRef.current, newEntry);
          scheduleLogFlush();
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => ws.close();
    });
  }, [projectId, scheduleLogFlush]);

  return {
    logs,
    currentPlan,
    writtenFiles,
    runOwnerId,
    startRun,
    setRunOwner,
    takeActivitySnapshot,
    claimRunOwner,
  };
}
