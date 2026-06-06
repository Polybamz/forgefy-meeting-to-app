import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getWsUrl, updateStoredSession } from "@/lib/api";

export const Route = createFileRoute("/_auth/sessions/$sessionId")({
  component: SessionPage,
  head: () => ({ meta: [{ title: "Session — Forgefy" }] }),
});

// ---------------------------------------------------------------------------
// Types
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
  WAITING: "Waiting",
  JOINING: "Joining meeting…",
  LISTENING: "Listening",
  PROCESSING: "Processing…",
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
// StatusBadge
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

// ---------------------------------------------------------------------------
// TranscriptPanel
// ---------------------------------------------------------------------------
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
// TranscriptDebugSection — always-visible raw transcript for testing
// ---------------------------------------------------------------------------
function TranscriptDebugSection({
  sessionId,
  liveLines,
}: {
  sessionId: string;
  liveLines: TranscriptLine[];
}) {
  const [open, setOpen] = useState(false);
  const [dbText, setDbText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (dbText !== null) return; // already loaded
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/session/${sessionId}/transcript`);
      if (res.ok) {
        const data = await res.json() as { transcript: string };
        setDbText(data.transcript);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function toggle() {
    if (!open) load();
    setOpen((v) => !v);
  }

  const displayText = liveLines.length > 0
    ? liveLines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n")
    : (dbText ?? "");

  return (
    <div className="mt-6 rounded-xl border border-border bg-warm-white overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface transition-colors"
      >
        <span className="text-[13px] font-medium text-ink flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Raw transcript
          <span className="text-[11px] text-text-muted font-normal">(test)</span>
        </span>
        <svg
          className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {loading && (
            <p className="text-[12px] text-text-muted italic">Loading transcript…</p>
          )}
          {!loading && !displayText && (
            <p className="text-[12px] text-text-muted italic">No transcript stored yet.</p>
          )}
          {!loading && displayText && (
            <pre className="text-[12px] leading-[1.7] font-mono-ui text-text-secondary whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
              {displayText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlueprintSection
// ---------------------------------------------------------------------------
const TEMPLATE_OPTIONS = [
  { value: "flutter", label: "Flutter" },
  { value: "react_native", label: "React Native" },
  { value: "next", label: "Next.js" },
];

function BlueprintSection({
  sessionId,
  onApproved,
}: {
  sessionId: string;
  onApproved: () => void;
}) {
  const navigate = useNavigate();
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [bpLoading, setBpLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editAppName, setEditAppName] = useState("");
  const [editTemplate, setEditTemplate] = useState("next");
  const [editFeatures, setEditFeatures] = useState<{ title: string; description: string }[]>([]);

  useEffect(() => {
    apiFetch(`/api/v1/voxa/blueprint/session/${sessionId}`)
      .then(async (res) => {
        if (res.ok) setBlueprint(await res.json());
        else setError("Blueprint not ready yet.");
        setBpLoading(false);
      })
      .catch(() => { setBpLoading(false); setError("Failed to load blueprint."); });
  }, [sessionId]);

  function startEdit() {
    if (!blueprint?.json_output) return;
    const j = blueprint.json_output;
    setEditAppName((j.app_name as string) ?? "");
    setEditTemplate((j.template as string) ?? "next");
    setEditFeatures(
      ((j.features ?? []) as { title: string; description: string }[]).map((f) => ({ title: f.title ?? "", description: f.description ?? "" }))
    );
    setEditing(true);
  }

  async function saveEdit() {
    if (!blueprint) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/voxa/blueprint/${blueprint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ app_name: editAppName, template_key: editTemplate, features: editFeatures }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBlueprint(updated);
        setEditing(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Save failed.");
      }
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  async function handleApprove() {
    if (!blueprint) return;
    setApproving(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/blueprint/${blueprint.id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBlueprint({ ...blueprint, approved: true });
        onApproved();
        if (data.project_id) {
          navigate({ to: "/projects/$projectId", params: { projectId: data.project_id } });
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setError((d as { detail?: string }).detail ?? "Approval failed.");
      }
    } catch { setError("Network error."); }
    finally { setApproving(false); }
  }

  if (bpLoading) return (
    <div className="flex items-center gap-2 text-[14px] text-text-muted py-8">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      Loading blueprint…
    </div>
  );

  if (error && !blueprint) return <p className="text-[13px] text-destructive py-4">{error}</p>;

  if (!blueprint?.json_output) return (
    <p className="text-[14px] text-text-muted py-4">Blueprint is empty. The AI may still be generating it.</p>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-[22px] text-ink">App Blueprint</h3>
        <div className="flex items-center gap-2">
          {!blueprint.approved && !editing && (
            <button
              onClick={startEdit}
              className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-text-secondary hover:border-accent hover:text-ink transition-colors"
            >
              Edit
            </button>
          )}
          {!blueprint.approved && (
            <button
              onClick={handleApprove}
              disabled={approving || editing}
              className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
            >
              {approving ? "Approving…" : "✓ Approve & build"}
            </button>
          )}
          {blueprint.approved && (
            <span className="text-[13px] font-medium text-[oklch(0.45_0.18_145)]">✓ Approved</span>
          )}
        </div>
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      {editing ? (
        <div className="space-y-5 rounded-xl border border-border bg-warm-white p-6">
          {/* App name */}
          <div>
            <label className="label-eyebrow block mb-1.5">App name</label>
            <input
              value={editAppName}
              onChange={(e) => setEditAppName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Template */}
          <div>
            <label className="label-eyebrow block mb-1.5">Template</label>
            <select
              value={editTemplate}
              onChange={(e) => setEditTemplate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink outline-none focus:border-accent transition-colors"
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-eyebrow">Features</label>
              <button
                onClick={() => setEditFeatures((f) => [...f, { title: "", description: "" }])}
                className="text-[12px] text-accent hover:underline"
              >
                + Add feature
              </button>
            </div>
            <div className="space-y-3">
              {editFeatures.map((feat, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={feat.title}
                      onChange={(e) => setEditFeatures((f) => f.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Feature title"
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink outline-none focus:border-accent transition-colors"
                    />
                    <input
                      value={feat.description}
                      onChange={(e) => setEditFeatures((f) => f.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                      placeholder="Description"
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border text-[13px] text-ink outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => setEditFeatures((f) => f.filter((_, j) => j !== i))}
                    className="mt-1 text-[12px] text-text-muted hover:text-destructive transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:border-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#0f0d0b] overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#222]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
            <span className="ml-3 text-[11px] font-mono-ui text-[#7A6F65]">blueprint.json</span>
          </div>
          <pre className="px-5 py-5 text-[12px] leading-[1.7] font-mono-ui text-[#E8DFD3] overflow-x-auto max-h-[480px]">
            {JSON.stringify(blueprint.json_output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadForm  (physical — file upload path)
// ---------------------------------------------------------------------------
function UploadForm({
  sessionId,
  onUploaded,
}: {
  sessionId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setUploading(true);
    setProgress(0);

    const form = new FormData();
    form.append("file", file);
    const token = getToken();

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 202 || xhr.status === 200) resolve();
          else {
            try { reject(new Error((JSON.parse(xhr.responseText) as { detail?: string }).detail ?? `Upload failed (${xhr.status})`)); }
            catch { reject(new Error(`Upload failed (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.open("POST", `/api/v1/voxa/session/${sessionId}/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(form);
      });
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      <p className="text-[12px] text-text-muted">
        Supported: MP3, MP4, M4A, WAV, WEBM, OGG · max 500 MB
      </p>
      <label className="block">
        <div className={[
          "flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
          file ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
        ].join(" ")}>
          <span className="text-[13px] text-text-muted">{file ? file.name : "Click to choose a file"}</span>
          {file && <span className="text-[11px] text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
          <input
            type="file"
            accept="audio/*,video/mp4,video/webm"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </div>
      </label>
      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-text-muted text-right">{progress}%</p>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full h-[42px] rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Upload & analyse →"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// MicCapture  (physical — live microphone path)
// Captures mic audio as PCM16 @ 16 kHz via Web Audio API and streams
// base64-encoded chunks through the WebSocket as `streamAudio` events.
// ---------------------------------------------------------------------------
function MicCapture({
  sessionId,
  wsRef,
  onStop,
}: {
  sessionId: string;
  wsRef: React.RefObject<WebSocket | null>;
  onStop: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "stopping">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function sendChunk(pcm16: Int16Array) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    const bytes = new Uint8Array(pcm16.buffer);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: "streamAudio", session_id: sessionId, chunk: btoa(bin) }));
  }

  async function startRecording() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      // 2048-sample buffer @ 16 kHz ≈ 128 ms per callback
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (ev) => {
        const float32 = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        sendChunk(int16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setMicError("Microphone access denied. Please allow it in your browser and try again.");
    }
  }

  async function stopRecording() {
    setPhase("stopping");
    if (timerRef.current) clearInterval(timerRef.current);

    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Signal Deepgram to flush final transcripts, then hand off to parent
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "endMeeting", session_id: sessionId }));
    }
    // Brief pause so the last few Deepgram results can arrive
    await new Promise((r) => setTimeout(r, 1500));
    await onStop();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      processorRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {micError && <p className="text-[13px] text-destructive">{micError}</p>}

      {phase === "idle" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-[14px] text-text-secondary text-center">
            Click the button below to start capturing your meeting audio.
          </p>
          <button
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)] transition-colors shadow-lg"
            aria-label="Start recording"
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </svg>
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[13px] font-medium text-ink">Recording</span>
              <span className="text-[13px] font-mono-ui text-text-muted">{fmt(elapsed)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-text-secondary hover:border-destructive hover:text-destructive transition-colors"
            >
              Stop & analyse →
            </button>
          </div>
          {/* Animated waveform bars */}
          <div className="flex gap-0.5 h-10 items-end overflow-hidden rounded-lg">
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-accent"
                style={{
                  height: `${30 + Math.abs(Math.sin(elapsed * 2.5 + i * 0.7)) * 70}%`,
                  opacity: 0.5 + Math.abs(Math.sin(elapsed + i * 0.3)) * 0.5,
                  transition: "height 0.25s ease, opacity 0.25s ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "stopping" && (
        <div className="flex items-center gap-2 py-4 text-[14px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Finalising transcript…
        </div>
      )}
    </div>
  );
}

// need getToken for UploadForm XHR
import { getToken } from "@/lib/api";

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
  const [blueprintError, setBlueprintError] = useState("");
  // For physical WAITING: which sub-panel to show
  const [physicalMode, setPhysicalMode] = useState<"choose" | "upload" | "live">("choose");

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

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // WebSocket — connect when JOINING, LISTENING, or PROCESSING
  useEffect(() => {
    if (!session) return;
    const liveStatuses: SessionStatus[] = ["JOINING", "LISTENING", "PROCESSING"];
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
            setFeatures((prev) => [...prev, (msg.feature as string) ?? JSON.stringify(msg.payload ?? msg)]);
            break;
          case "blueprintReady":
          case "meetingStatus":
            fetchSession();
            break;
          case "blueprintError":
            setBlueprintError((msg.error as string) ?? "Blueprint generation failed.");
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { /* handled silently */ };
    return () => { ws.close(); };
  }, [session?.status, sessionId, fetchSession]);

  // Poll every 5 s when PROCESSING (catches blueprint completion)
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.detail ?? "Failed to join."); return; }
      await fetchSession();
    } catch { setActionError("Network error."); }
    finally { setActionLoading(false); }
  }

  async function handleStartLive() {
    if (!session) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await apiFetch(`/api/v1/voxa/session/${session.id}/start-live`, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.detail ?? "Failed to start live transcription."); return; }
      await fetchSession(); // session now LISTENING
    } catch { setActionError("Network error."); }
    finally { setActionLoading(false); }
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.detail ?? "Failed to end session."); return; }
      wsRef.current?.close();
      await fetchSession();
    } catch { setActionError("Network error."); }
    finally { setActionLoading(false); }
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
        <Link to="/dashboard" className="mt-4 inline-block text-[13px] text-accent underline">← Back to dashboard</Link>
      </div>
    );
  }

  const isPhysical = session.platform === "physical";
  const isLive = ["JOINING", "LISTENING"].includes(session.status);
  const isProcessing = session.status === "PROCESSING";
  const isBlueprintReady = ["BLUEPRINT_READY", "APPROVED"].includes(session.status);
  const isBuilding = session.status === "BUILDING";

  return (
    <div className="px-6 md:px-[8vw] py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/dashboard" className="text-[13px] text-text-muted hover:text-ink transition-colors">← Dashboard</Link>
        <div className="mt-4 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">
              {PLATFORM_LABEL[session.platform] ?? session.platform} session
            </h1>
            {session.meeting_url && (
              <p className="mt-1 text-[13px] font-mono-ui text-text-muted truncate max-w-sm">{session.meeting_url}</p>
            )}
          </div>
          <StatusBadge status={session.status} />
        </div>
      </div>

      {actionError && <p role="alert" className="mb-4 text-[13px] text-destructive">{actionError}</p>}

      {/* ── WAITING ── */}
      {session.status === "WAITING" && !isPhysical && (
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

      {/* ── WAITING (physical) — choose between upload or live mic ── */}
      {session.status === "WAITING" && isPhysical && (
        <div className="rounded-xl border border-border bg-warm-white p-8 space-y-6">
          {physicalMode === "choose" && (
            <>
              <div>
                <p className="label-eyebrow mb-1">How do you want to capture this meeting?</p>
                <p className="text-[13px] text-text-muted">Choose to upload a recording you already have, or transcribe live using your microphone.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setPhysicalMode("upload")}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border p-5 text-left hover:border-accent transition-colors group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-text-secondary group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-ink">Upload recording</p>
                    <p className="text-[12px] text-text-muted mt-0.5">MP3, MP4, WAV, WEBM — up to 500 MB</p>
                  </div>
                </button>

                <button
                  onClick={() => { setPhysicalMode("live"); handleStartLive(); }}
                  disabled={actionLoading}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border p-5 text-left hover:border-accent transition-colors group disabled:opacity-60"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-text-secondary group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
                      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-ink">Live transcription</p>
                    <p className="text-[12px] text-text-muted mt-0.5">Use your microphone in real time</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {physicalMode === "upload" && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setPhysicalMode("choose")} className="text-[13px] text-text-muted hover:text-ink transition-colors">← Back</button>
                <p className="label-eyebrow">Upload recording</p>
              </div>
              <UploadForm sessionId={sessionId} onUploaded={fetchSession} />
            </>
          )}

          {physicalMode === "live" && actionLoading && (
            <div className="flex items-center gap-2 py-4 text-[14px] text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Starting live transcription…
            </div>
          )}
        </div>
      )}

      {/* ── LIVE (non-physical bot sessions) ── */}
      {isLive && !isPhysical && (
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
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LISTENING (physical — mic capture UI) ── */}
      {isLive && isPhysical && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-warm-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium text-ink">Live transcription</p>
            </div>
            <MicCapture
              sessionId={sessionId}
              wsRef={wsRef}
              onStop={handleEnd}
            />
          </div>
          {transcript.length > 0 && (
            <div className="rounded-xl border border-border bg-warm-white p-6 space-y-3">
              <p className="text-[13px] font-medium text-ink flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Live transcript
              </p>
              <TranscriptPanel lines={transcript} />
            </div>
          )}
          {features.length > 0 && (
            <div className="rounded-xl border border-border bg-warm-white p-6">
              <p className="label-eyebrow mb-3">Detected features</p>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROCESSING ── */}
      {isProcessing && (
        <div className="space-y-4">
          {blueprintError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
              <p className="text-[15px] font-medium text-destructive">Blueprint generation failed</p>
              <p className="text-[13px] text-destructive/80 max-w-md mx-auto">{blueprintError}</p>
              <p className="text-[12px] text-text-muted">
                This usually happens when the recording is too short, silent, or doesn't contain product discussion.
                Try uploading a clearer recording.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-warm-white p-8 text-center space-y-3">
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <p className="text-[15px] text-text-secondary">
                {isPhysical ? "Transcribing and analysing your recording…" : "Analysing the transcript and generating your app blueprint…"}
              </p>
              <p className="text-[12px] text-text-muted">Usually takes 30–120 seconds.</p>
            </div>
          )}
          {transcript.length > 0 && (
            <div className="rounded-xl border border-border bg-warm-white p-6 space-y-3">
              <p className="text-[13px] font-medium text-ink">Transcript</p>
              <TranscriptPanel lines={transcript} />
            </div>
          )}
          {features.length > 0 && (
            <div className="rounded-xl border border-border bg-warm-white p-6">
              <p className="label-eyebrow mb-3">Detected features</p>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BLUEPRINT_READY / APPROVED ── */}
      {isBlueprintReady && <BlueprintSection sessionId={sessionId} onApproved={fetchSession} />}

      {/* ── BUILDING ── */}
      {isBuilding && (
        <div className="rounded-xl border border-border bg-warm-white p-8 text-center space-y-3">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-[oklch(0.55_0.18_145)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[15px] text-text-secondary">Building your Flutter, React Native, and Next.js apps…</p>
        </div>
      )}

      {/* ── Raw transcript (test) ── */}
      <TranscriptDebugSection sessionId={sessionId} liveLines={transcript} />

      {/* ── Event log ── */}
      {session.recent_events.length > 0 && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="label-eyebrow mb-4">Event log</p>
          <div className="space-y-2">
            {session.recent_events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-[12px] text-text-muted font-mono-ui">
                <span className="shrink-0 text-text-muted/60">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                <span className="text-accent">{ev.event_type}</span>
                {ev.payload && <span className="text-text-muted/80 truncate">{JSON.stringify(ev.payload).slice(0, 80)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
