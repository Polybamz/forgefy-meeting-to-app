import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, getWsUrl, updateStoredSession } from "@/lib/api";
import { ChevronDown, Mic, Upload, CheckCircle2, X, Plus, ArrowLeft } from "lucide-react";

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
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium",
        isActive
          ? "bg-accent/10 text-accent"
          : isReady
            ? "bg-[oklch(0.55_0.18_145)]/10 text-[oklch(0.45_0.18_145)]"
            : "bg-surface text-text-muted border border-border",
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
      <p className="text-[13px] text-text-muted italic py-2">
        Transcript will appear here as the meeting progresses…
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {lines.map((l, i) => (
        <div key={i} className="text-[13px] leading-[1.6]">
          {l.speaker && (
            <span className="font-semibold text-accent mr-2">{l.speaker}:</span>
          )}
          <span className="text-text-secondary">{l.text}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranscriptDebugSection
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
    if (dbText !== null) return;
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
    <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden shadow-warm-xs">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface transition-colors"
      >
        <span className="text-[13px] font-medium text-text-secondary flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
          </svg>
          Raw transcript
          <span className="text-[11px] text-text-muted font-normal">(debug)</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {loading && <p className="text-[12px] text-text-muted italic">Loading transcript…</p>}
          {!loading && !displayText && <p className="text-[12px] text-text-muted italic">No transcript stored yet.</p>}
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

const TEMPLATE_LABEL: Record<string, string> = {
  flutter: "Flutter",
  react_native: "React Native",
  next: "Next.js",
};

function SingleBlueprintPanel({
  blueprint,
  onUpdated,
  onApproved,
  showHeader = true,
}: {
  blueprint: Blueprint;
  onUpdated: (bp: Blueprint) => void;
  onApproved: () => void;
  showHeader?: boolean;
}) {
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editAppName, setEditAppName] = useState("");
  const [editTemplate, setEditTemplate] = useState("next");
  const [editFeatures, setEditFeatures] = useState<{ title: string; description: string }[]>([]);

  function startEdit() {
    if (!blueprint.json_output) return;
    const j = blueprint.json_output;
    setEditAppName((j.app_name as string) ?? "");
    setEditTemplate((j.template as string) ?? "next");
    setEditFeatures(
      ((j.features ?? []) as { title: string; description: string }[]).map((f) => ({
        title: f.title ?? "",
        description: f.description ?? "",
      }))
    );
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/blueprint/${blueprint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ app_name: editAppName, template_key: editTemplate, features: editFeatures }),
      });
      if (res.ok) {
        onUpdated(await res.json());
        setEditing(false);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { detail?: string }).detail ?? "Failed to save changes.");
      }
    } catch { toast.error("Network error — changes not saved."); }
    finally { setSaving(false); }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/blueprint/${blueprint.id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onUpdated({ ...blueprint, approved: true });
        onApproved();
        if (data.project_id) {
          navigate({ to: "/projects/$projectId", params: { projectId: data.project_id } });
        }
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { detail?: string }).detail ?? "Approval failed.");
      }
    } catch { toast.error("Network error — approval not sent."); }
    finally { setApproving(false); }
  }

  if (!blueprint.json_output) return (
    <p className="text-[14px] text-text-muted py-4">Blueprint is empty. The AI may still be generating it.</p>
  );

  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-display text-[22px] text-ink">App Blueprint</h3>
          <div className="flex items-center gap-2">
            {!blueprint.approved && !editing && (
              <button
                onClick={startEdit}
                className="px-3.5 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:border-accent hover:text-ink transition-colors btn-press"
              >
                Edit
              </button>
            )}
            {!blueprint.approved && (
              <button
                onClick={handleApprove}
                disabled={approving || editing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press shadow-warm-sm"
              >
                {approving ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground animate-spin" />
                    Approving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve &amp; build
                  </>
                )}
              </button>
            )}
            {blueprint.approved && (
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-[oklch(0.45_0.18_145)] px-3 py-2 bg-[oklch(0.55_0.18_145)]/10 rounded-xl">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved
              </span>
            )}
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-warm-xs">
          <div className="space-y-1.5">
            <label className="label-eyebrow block">App name</label>
            <input
              value={editAppName}
              onChange={(e) => setEditAppName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="label-eyebrow block">Template</label>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label-eyebrow">Features</label>
              <button
                type="button"
                onClick={() => setEditFeatures((f) => [...f, { title: "", description: "" }])}
                className="flex items-center gap-1 text-[12px] text-accent hover:text-accent/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add feature
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
                    type="button"
                    onClick={() => setEditFeatures((f) => f.filter((_, j) => j !== i))}
                    className="mt-1 flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 transition-colors btn-press"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:border-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {!showHeader && !blueprint.approved && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="px-3.5 py-2 rounded-xl border border-border text-[13px] text-text-secondary hover:border-accent hover:text-ink transition-colors btn-press"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press"
              >
                {approving ? "Building…" : "Build this first →"}
              </button>
            </div>
          )}
          <div className="rounded-xl border border-[#2a2522] bg-[#0f0d0b] overflow-hidden shadow-warm-md">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1e1c1a]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
              <span className="ml-3 text-[11px] font-mono-ui text-[#7A6F65]">blueprint.json</span>
            </div>
            <pre className="px-5 py-5 text-[12px] leading-[1.7] font-mono-ui text-[#E8DFD3] overflow-x-auto max-h-[480px]">
              {JSON.stringify(blueprint.json_output, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function DualBlueprintChooser({
  blueprints,
  onBlueprintUpdated,
  onApproved,
}: {
  blueprints: Blueprint[];
  onBlueprintUpdated: (bp: Blueprint) => void;
  onApproved: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...blueprints].sort((a, b) => {
    const va = (a.json_output?.platform_variant as string) ?? "";
    const vb = (b.json_output?.platform_variant as string) ?? "";
    return va === "mobile" ? -1 : vb === "mobile" ? 1 : 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-[22px] text-ink">App Blueprint</h3>
        <p className="mt-1 text-[13px] text-text-muted max-w-md">
          Your app needs both a mobile app and a web experience. Choose which to build first — you can build the other later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {sorted.map((bp) => {
          const j = bp.json_output ?? {};
          const template = (j.template as string) ?? "flutter";
          const variant = (j.platform_variant as string) ?? "";
          const appName = (j.app_name as string) ?? "";
          const description = (j.app_description as string) ?? "";
          const featureCount = ((j.features ?? []) as unknown[]).length;
          const isExpanded = expandedId === bp.id;

          return (
            <div
              key={bp.id}
              className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col shadow-warm-xs card-hover"
            >
              <div className="px-5 pt-5 pb-4 space-y-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium uppercase tracking-wide">
                    {TEMPLATE_LABEL[template] ?? template}
                  </span>
                  {variant && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface text-text-muted text-[11px] font-medium capitalize border border-border">
                      {variant}
                    </span>
                  )}
                </div>
                {appName && <p className="text-[15px] font-semibold text-ink">{appName}</p>}
                {description && (
                  <p className="text-[12px] text-text-secondary leading-[1.6] line-clamp-3">{description}</p>
                )}
                {featureCount > 0 && (
                  <p className="text-[11px] text-text-muted">{featureCount} feature{featureCount !== 1 ? "s" : ""} detected</p>
                )}
              </div>

              <div className="px-5 pb-5 pt-2 space-y-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : bp.id)}
                  className="w-full flex items-center justify-center gap-1 text-[12px] text-text-muted hover:text-ink transition-colors py-1"
                >
                  {isExpanded ? "Hide details" : "View full blueprint"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <SingleBlueprintPanel
                    blueprint={bp}
                    onUpdated={onBlueprintUpdated}
                    onApproved={onApproved}
                    showHeader={false}
                  />
                )}
                {!isExpanded && !bp.approved && (
                  <_ApproveButton blueprintId={bp.id} onApproved={onApproved} onUpdated={onBlueprintUpdated} />
                )}
                {bp.approved && (
                  <p className="text-center text-[13px] font-medium text-[oklch(0.45_0.18_145)] flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Building…
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function _ApproveButton({
  blueprintId,
  onApproved,
  onUpdated,
}: {
  blueprintId: string;
  onApproved: () => void;
  onUpdated: (bp: Blueprint) => void;
}) {
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/blueprint/${blueprintId}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onUpdated({ ...data, approved: true });
        onApproved();
        if (data.project_id) {
          navigate({ to: "/projects/$projectId", params: { projectId: data.project_id } });
        }
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { detail?: string }).detail ?? "Approval failed.");
      }
    } catch { toast.error("Network error — approval not sent."); }
    finally { setApproving(false); }
  }

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={approving}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press"
    >
      {approving ? (
        <>
          <div className="w-3.5 h-3.5 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground animate-spin" />
          Building…
        </>
      ) : "Build this first →"}
    </button>
  );
}

function BlueprintSection({ sessionId, onApproved }: { sessionId: string; onApproved: () => void }) {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [bpLoading, setBpLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/v1/voxa/blueprint/session/${sessionId}/all`)
      .then(async (res) => {
        if (res.ok) setBlueprints(await res.json());
        else setError("Blueprint not ready yet.");
        setBpLoading(false);
      })
      .catch(() => { setBpLoading(false); setError("Failed to load blueprint."); });
  }, [sessionId]);

  function handleUpdated(updated: Blueprint) {
    setBlueprints((prev) => prev.map((bp) => bp.id === updated.id ? updated : bp));
  }

  if (bpLoading) return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-warm-xs">
      <div className="space-y-3">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-3 w-64 rounded" />
        <div className="skeleton h-3 w-52 rounded" />
        <div className="mt-4 skeleton h-48 w-full rounded-xl" />
      </div>
    </div>
  );

  if (error && blueprints.length === 0) return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-warm-xs">
      <p className="text-[13px] text-amber-600 dark:text-amber-400">{error}</p>
    </div>
  );

  if (blueprints.length === 0) return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-warm-xs">
      <p className="text-[14px] text-text-muted">Blueprint is empty. The AI may still be generating it.</p>
    </div>
  );

  if (blueprints.length >= 2) {
    return (
      <DualBlueprintChooser
        blueprints={blueprints}
        onBlueprintUpdated={handleUpdated}
        onApproved={onApproved}
      />
    );
  }

  return (
    <SingleBlueprintPanel
      blueprint={blueprints[0]}
      onUpdated={handleUpdated}
      onApproved={onApproved}
      showHeader
    />
  );
}

// ---------------------------------------------------------------------------
// UploadForm
// ---------------------------------------------------------------------------
function UploadForm({ sessionId, onUploaded }: { sessionId: string; onUploaded: () => void }) {
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
      <label className="block cursor-pointer">
        <div className={[
          "flex flex-col items-center justify-center gap-2.5 h-32 rounded-2xl border-2 border-dashed transition-colors",
          file ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-surface",
        ].join(" ")}>
          <Upload className={`h-6 w-6 ${file ? "text-accent" : "text-text-muted"}`} />
          <div className="text-center">
            <span className="text-[13px] text-text-secondary">{file ? file.name : "Click to choose a file"}</span>
            {file && <p className="text-[11px] text-text-muted mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          </div>
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
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-surface overflow-hidden shadow-warm-xs">
            <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-text-muted text-right">{progress}%</p>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press shadow-warm-xs"
      >
        {uploading ? "Uploading…" : "Upload & analyse →"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// MicCapture
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
  const [audioLevel, setAudioLevel] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lowVolWarnedRef = useRef(false);

  function sendChunk(pcm16: Int16Array) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    const bytes = new Uint8Array(pcm16.buffer);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: "streamAudio", session_id: sessionId, chunk: btoa(bin) }));
  }

  function startLevelPolling(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    function poll() {
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
      const level = Math.min(100, Math.round((rms / 40) * 100));
      setAudioLevel(level);

      if (level < 5) {
        if (silenceStartRef.current === null) silenceStartRef.current = Date.now();
        else if (!lowVolWarnedRef.current && Date.now() - silenceStartRef.current > 5000) {
          toast.warning("Your mic seems very quiet — try speaking louder or moving closer.", { duration: 6000 });
          lowVolWarnedRef.current = true;
        }
      } else {
        silenceStartRef.current = null;
      }

      rafRef.current = requestAnimationFrame(poll);
    }
    rafRef.current = requestAnimationFrame(poll);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;
      source.connect(analyser);
      startLevelPolling(analyser);

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
      toast.error("Microphone access denied — please allow it in your browser and try again.");
    }
  }

  async function stopRecording() {
    setPhase("stopping");
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "endMeeting", session_id: sessionId }));
    }
    await new Promise((r) => setTimeout(r, 1500));
    await onStop();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      processorRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const levelColor =
    audioLevel > 25 ? "bg-[oklch(0.55_0.18_145)]"
    : audioLevel > 8  ? "bg-amber-400"
    : "bg-red-500";

  return (
    <div className="space-y-4">
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-5 py-8">
          <p className="text-[14px] text-text-secondary text-center">
            Click the button below to start capturing your meeting audio.
          </p>
          <button
            type="button"
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)] transition-colors shadow-warm-lg pulse-ring btn-press"
            aria-label="Start recording"
          >
            <Mic className="h-7 w-7" />
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[13px] font-semibold text-ink">Recording</span>
              <span className="text-[13px] font-mono-ui text-text-muted">{fmt(elapsed)}</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-xl border border-border text-[13px] text-text-secondary hover:border-destructive hover:text-destructive transition-colors btn-press"
            >
              Stop & analyse →
            </button>
          </div>

          <div className="flex gap-0.5 h-10 items-end overflow-hidden rounded-xl bg-surface p-1">
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-accent"
                style={{
                  height: `${Math.max(6, audioLevel * (0.35 + Math.abs(Math.sin(i * 0.9)) * 0.65))}%`,
                  opacity: 0.35 + (audioLevel / 100) * 0.65,
                  transition: "height 0.08s ease, opacity 0.08s ease",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Mic className="h-3 w-3 text-text-muted shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden shadow-warm-xs">
              <div
                className={`h-full rounded-full transition-all duration-75 ${levelColor}`}
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            {audioLevel < 8 && (
              <span className="text-[11px] text-amber-500 shrink-0 font-medium">Too quiet</span>
            )}
          </div>
        </div>
      )}

      {phase === "stopping" && (
        <div className="flex items-center gap-2 py-6 text-[14px] text-text-muted justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
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
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [physicalMode, setPhysicalMode] = useState<"choose" | "upload" | "live">("choose");

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbTranscriptLoadedRef = useRef(false);

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
          case "featureDetected": {
            const subState = msg.sub_state as string;
            const p = msg.payload as Record<string, unknown> | null | undefined;
            let label: string;
            if (subState === "FEATURE_FOUND") {
              label = (p?.title as string) ?? "Feature detected";
            } else if (subState === "QUESTION_FOUND") {
              label = `? ${(p?.text as string) ?? "Open question"}`;
            } else if (subState === "CONFLICT_FOUND") {
              label = `⚠ ${(p?.description as string) ?? "Conflict"}`;
            } else if (subState === "ACTION_ITEM_FOUND") {
              label = `→ ${(p?.task as string) ?? "Action item"}`;
            } else {
              label = (p?.title as string) ?? (p?.text as string) ?? subState ?? "Detected";
            }
            setFeatures((prev) => [...prev, label]);
            break;
          }
          case "blueprintReady":
          case "meetingStatus":
            fetchSession();
            break;
          case "blueprintError":
            toast.error((msg.error as string) ?? "Blueprint generation failed.", {
              description: "The recording may be too short or silent. Try uploading a clearer file.",
              duration: 8000,
            });
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { /* handled silently */ };
    return () => { ws.close(); };
  }, [session?.status, sessionId, fetchSession]);

  useEffect(() => {
    if (session?.status !== "PROCESSING") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchSession, 5_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.status, fetchSession]);

  useEffect(() => {
    if (!session) return;
    const postLiveStates: SessionStatus[] = ["BLUEPRINT_READY", "APPROVED", "BUILDING"];
    if (!postLiveStates.includes(session.status)) return;
    if (dbTranscriptLoadedRef.current) return;
    dbTranscriptLoadedRef.current = true;

    apiFetch(`/api/v1/voxa/session/${sessionId}/transcript`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { transcript: string };
        if (data.transcript) {
          setTranscript((prev) => prev.length > 0 ? prev : [{ text: data.transcript, timestamp: 0 }]);
        }
      })
      .catch(() => {});
  }, [session?.status, sessionId]);

  async function handleJoin() {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/v1/voxa/session/join", {
        method: "POST",
        body: JSON.stringify({ session_id: session.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.detail ?? "Failed to join."); return; }
      await fetchSession();
    } catch { toast.error("Network error — could not join meeting."); }
    finally { setActionLoading(false); }
  }

  async function handleStartLive() {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/v1/voxa/session/${session.id}/start-live`, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.detail ?? "Failed to start live transcription."); return; }
      await fetchSession();
    } catch { toast.error("Network error — could not start transcription."); }
    finally { setActionLoading(false); }
  }

  async function handleEnd() {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/v1/voxa/session/end", {
        method: "POST",
        body: JSON.stringify({ session_id: session.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.detail ?? "Failed to end session."); return; }
      wsRef.current?.close();
      await fetchSession();
    } catch { toast.error("Network error — could not end session."); }
    finally { setActionLoading(false); }
  }

  if (loading) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-10 w-56 rounded-xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-6 md:px-[8vw] py-12 max-w-3xl mx-auto">
        <p className="text-destructive text-[14px] mb-4">{error || "Session not found."}</p>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent/80 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isPhysical = session.platform === "physical";
  const isLive = ["JOINING", "LISTENING"].includes(session.status);
  const isProcessing = session.status === "PROCESSING";
  const isBlueprintReady = ["BLUEPRINT_READY", "APPROVED"].includes(session.status);
  const isBuilding = session.status === "BUILDING";

  return (
    <div className="px-6 md:px-[8vw] py-10 max-w-4xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sessions
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
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

      {/* ── WAITING (non-physical) ── */}
      {session.status === "WAITING" && !isPhysical && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-warm-xs slide-up">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mx-auto">
            <svg className="h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.9L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/>
            </svg>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-ink mb-1">Ready to join</p>
            <p className="text-[14px] text-text-secondary max-w-sm mx-auto">
              Forgefy will join your call, listen silently, and extract your product blueprint.
            </p>
          </div>
          <button
            type="button"
            onClick={handleJoin}
            disabled={actionLoading}
            className="px-7 py-3 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60 btn-press shadow-warm-sm"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground animate-spin" />
                Joining…
              </span>
            ) : "Join meeting →"}
          </button>
        </div>
      )}

      {/* ── WAITING (physical) ── */}
      {session.status === "WAITING" && isPhysical && (
        <div className="rounded-2xl border border-border bg-card p-8 space-y-6 shadow-warm-xs slide-up">
          {physicalMode === "choose" && (
            <>
              <div>
                <p className="text-[15px] font-semibold text-ink mb-1">How do you want to capture this meeting?</p>
                <p className="text-[13px] text-text-muted">Upload a recording you already have, or transcribe live using your microphone.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPhysicalMode("upload")}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-border p-5 text-left hover:border-accent transition-all card-hover group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-text-secondary group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">Upload recording</p>
                    <p className="text-[12px] text-text-muted mt-0.5">MP3, MP4, WAV, WEBM — up to 500 MB</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setPhysicalMode("live"); handleStartLive(); }}
                  disabled={actionLoading}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-border p-5 text-left hover:border-accent transition-all card-hover group disabled:opacity-60"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-text-secondary group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">Live transcription</p>
                    <p className="text-[12px] text-text-muted mt-0.5">Use your microphone in real time</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {physicalMode === "upload" && (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPhysicalMode("choose")}
                  className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-ink transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <span className="text-[14px] font-semibold text-ink">Upload recording</span>
              </div>
              <UploadForm sessionId={sessionId} onUploaded={fetchSession} />
            </>
          )}

          {physicalMode === "live" && actionLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-[14px] text-text-muted">
              <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              Starting live transcription…
            </div>
          )}
        </div>
      )}

      {/* ── LIVE (non-physical bot sessions) ── */}
      {isLive && !isPhysical && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-warm-xs">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-ink flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Live transcript
              </p>
              <button
                type="button"
                onClick={handleEnd}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-xl border border-border text-[13px] text-text-secondary hover:border-destructive hover:text-destructive transition-colors disabled:opacity-60 btn-press"
              >
                {actionLoading ? "Ending…" : "End meeting"}
              </button>
            </div>
            <TranscriptPanel lines={transcript} />
          </div>
          {features.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-xs">
              <p className="label-eyebrow mb-3">Detected features</p>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[12px] font-medium badge-pop" style={{ animationDelay: `${i * 60}ms` }}>{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LISTENING (physical — mic capture UI) ── */}
      {isLive && isPhysical && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-warm-xs">
            <p className="text-[14px] font-semibold text-ink">Live transcription</p>
            <MicCapture sessionId={sessionId} wsRef={wsRef} onStop={handleEnd} />
          </div>
          {transcript.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-warm-xs">
              <p className="text-[13px] font-semibold text-ink flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Live transcript
              </p>
              <TranscriptPanel lines={transcript} />
            </div>
          )}
          {features.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-xs">
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
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4 shadow-warm-xs">
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <div>
              <p className="text-[16px] font-semibold text-ink mb-1">
                {isPhysical ? "Transcribing your recording…" : "Analysing transcript…"}
              </p>
              <p className="text-[14px] text-text-secondary">
                {isPhysical ? "Extracting features and building your product blueprint." : "Generating your app blueprint from the meeting."}
              </p>
            </div>
            <p className="text-[12px] text-text-muted">Usually takes 30–120 seconds.</p>
          </div>
          {transcript.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-warm-xs">
              <p className="text-[13px] font-semibold text-ink">Transcript</p>
              <TranscriptPanel lines={transcript} />
            </div>
          )}
          {features.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-xs">
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
      {isBlueprintReady && (
        <>
          <BlueprintSection sessionId={sessionId} onApproved={fetchSession} />
          {transcript.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-3 shadow-warm-xs">
              <p className="text-[13px] font-semibold text-ink">Meeting transcript</p>
              <TranscriptPanel lines={transcript} />
            </div>
          )}
        </>
      )}

      {/* ── BUILDING ── */}
      {isBuilding && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4 shadow-warm-xs">
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-[oklch(0.55_0.18_145)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <div>
            <p className="text-[16px] font-semibold text-ink mb-1">Building your apps</p>
            <p className="text-[14px] text-text-secondary">Flutter, React Native, and Next.js — all from your blueprint.</p>
          </div>
        </div>
      )}

      {/* ── Raw transcript (debug) ── */}
      <TranscriptDebugSection sessionId={sessionId} liveLines={transcript} />

      {/* ── Event log ── */}
      {session.recent_events.length > 0 && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="label-eyebrow mb-4">Event log</p>
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-warm-xs">
            {session.recent_events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-[12px] font-mono-ui">
                <span className="shrink-0 text-text-muted/60 w-20">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                <span className="text-accent shrink-0">{ev.event_type}</span>
                {ev.payload && (
                  <span className="text-text-muted/80 truncate">{JSON.stringify(ev.payload).slice(0, 80)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
