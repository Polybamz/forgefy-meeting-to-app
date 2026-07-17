import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { apiFetch, type BillingStatus } from "@/lib/api";
import { useApiOrigin } from "@/hooks/use-api-origin";
import { ApiExamples } from "@/components/api-examples";
import { HighlightedCode } from "@/components/highlighted-code";
import { SdkGuide } from "@/components/sdk-guide";

export const Route = createFileRoute("/_auth/developers")({
  component: DevelopersPage,
  head: () => ({ meta: [{ title: "Developers — Forgefy" }] }),
});

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface CreatedKey extends ApiKey {
  key: string;
}

// ---------------------------------------------------------------------------
// Layout helpers (same visual language as Settings)
// ---------------------------------------------------------------------------
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-warm-xs overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && <p className="text-[13px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the key manually.");
    }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-secondary hover:border-accent hover:text-accent transition-colors btn-press shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// New-key banner — the only time the full key is ever visible
// ---------------------------------------------------------------------------
function CreatedKeyBanner({ created, onDismiss }: { created: CreatedKey; onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 mb-4">
      <p className="text-[13px] font-semibold text-ink mb-1">
        “{created.name}” created — copy it now
      </p>
      <p className="text-[12px] text-text-muted mb-3">
        This is the only time the full key is shown. Store it securely; only a hash is kept on our
        servers.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate font-mono-ui text-[12px] text-ink bg-surface border border-border rounded-lg px-3 py-2">
          {created.key}
        </code>
        <CopyButton value={created.key} />
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg text-[12px] text-text-muted hover:text-ink transition-colors shrink-0"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API keys section
// ---------------------------------------------------------------------------
function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/keys");
      if (res.ok) setKeys(await res.json());
      else setKeys([]);
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/v1/keys", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data: CreatedKey = await res.json();
        setCreated(data);
        setName("");
        void load();
      } else {
        const detail = (await res.json().catch(() => null))?.detail;
        toast.error(typeof detail === "string" ? detail : "Could not create the key.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (revoking) return;
    setRevoking(true);
    try {
      const res = await apiFetch(`/api/v1/keys/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast.success("Key revoked. Takes effect within ~30 seconds.");
        setConfirmRevoke(null);
        void load();
      } else {
        toast.error("Could not revoke the key.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRevoking(false);
    }
  }

  const active = keys?.filter((k) => !k.revoked_at) ?? [];
  const revoked = keys?.filter((k) => k.revoked_at) ?? [];

  return (
    <Section
      title="API Keys"
      description="Authenticate requests to the Forgefy Developer API. Keys inherit your plan's monthly token budget."
    >
      {created && <CreatedKeyBanner created={created} onDismiss={() => setCreated(null)} />}

      {keys === null ? (
        <div className="skeleton h-20 w-full rounded-xl" />
      ) : active.length === 0 && revoked.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border mb-3">
            <KeyRound className="h-4.5 w-4.5 text-text-muted" />
          </span>
          <p className="text-[13px] text-text-secondary">No API keys yet.</p>
          <p className="text-[12px] text-text-muted mt-0.5">
            Create one below to start extracting requirements from your own app.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {[...active, ...revoked].map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] text-ink truncate">{k.name}</p>
                  {k.revoked_at && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-destructive bg-destructive/10 px-2 py-0.5 rounded-md shrink-0">
                      Revoked
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-text-muted mt-0.5 font-mono-ui">
                  {k.prefix}… · created {fmtDate(k.created_at)} · last used{" "}
                  {fmtDate(k.last_used_at)}
                </p>
              </div>
              {!k.revoked_at &&
                (confirmRevoke === k.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => revokeKey(k.id)}
                      disabled={revoking}
                      className="px-3 py-1.5 rounded-lg bg-destructive text-white text-[12px] font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 btn-press"
                    >
                      {revoking ? "Revoking…" : "Confirm revoke"}
                    </button>
                    <button
                      onClick={() => setConfirmRevoke(null)}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] text-text-muted hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(k.id)}
                    className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-secondary hover:border-destructive hover:text-destructive transition-colors btn-press shrink-0"
                  >
                    Revoke
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {/* create form */}
      <div className="flex items-center gap-2 pt-4 mt-1 border-t border-border/60">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void createKey()}
          placeholder="Key name (e.g. CI pipeline)"
          maxLength={100}
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface text-[13px] text-ink placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={createKey}
          disabled={!name.trim() || creating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 btn-press shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Usage section — API calls draw from the same bucket as builds
// ---------------------------------------------------------------------------
function UsageSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  const pct =
    status && status.monthly_tokens > 0
      ? Math.min(100, (status.tokens_used / status.monthly_tokens) * 100)
      : 0;

  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return String(n);
  }

  return (
    <Section
      title="Usage"
      description="API requests and app builds share your plan's monthly token budget."
    >
      {status === null ? (
        <div className="skeleton h-12 w-full rounded-xl" />
      ) : (
        <div className="py-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] text-text-secondary">
              <span className="font-semibold text-ink">{fmt(status.tokens_used)}</span> of{" "}
              {fmt(status.monthly_tokens)} tokens used
            </p>
            <p className="text-[12px] text-text-muted capitalize">{status.tier_name} plan</p>
          </div>
          <div className="w-full h-2 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// SDK section — the recommended integration path
// ---------------------------------------------------------------------------
function SdkSection() {
  const apiOrigin = useApiOrigin();

  return (
    <Section
      title="Official SDKs"
      description="Typed clients with automatic retries, idempotent jobs, job polling, and webhook verification built in — the recommended way to integrate."
    >
      <SdkGuide apiOrigin={apiOrigin} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Quickstart section — raw HTTP fallback for languages without an SDK
// ---------------------------------------------------------------------------
function QuickstartSection() {
  const apiOrigin = useApiOrigin();
  const base = `${apiOrigin}/api/v1`;

  return (
    <Section
      title="Or call the API directly"
      description="No SDK for your language? Every endpoint is plain REST — pick a language below."
    >
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[12px] text-text-muted shrink-0">Base URL</p>
        <code className="flex-1 min-w-0 truncate font-mono-ui text-[12px] text-ink bg-surface border border-border rounded-lg px-3 py-1.5">
          {base}
        </code>
        <CopyButton value={base} />
      </div>
      <ApiExamples base={base} />
      <p className="text-[12px] text-text-muted mt-3">
        Paste your key in and these run as-is. Long transcripts (up to 200k characters) belong on{" "}
        <code className="font-mono-ui text-ink">POST {base}/extract/jobs</code> — async with signed
        webhooks. Full guide in the{" "}
        <a href="/documentation#developer-api" className="text-accent hover:underline">
          documentation
        </a>
        .
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// MCP section — use Forgefy from Claude Code / Claude Desktop / Cursor
// ---------------------------------------------------------------------------
const MCP_TOOLS = [
  {
    name: "extract_requirements",
    desc: "Transcript → features, questions, conflicts, action items",
  },
  { name: "create_extract_job", desc: "Queue a long transcript (up to 200k chars) asynchronously" },
  { name: "get_extract_job", desc: "Poll a job's status and fetch its result" },
  { name: "get_usage", desc: "Check your remaining monthly token budget" },
];

function McpStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5 border-b border-border/60 last:border-0">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink mb-2">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 text-accent text-[11px] font-mono-ui">
          {n}
        </span>
        {title}
      </p>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  );
}

function McpCode({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="font-mono-ui text-[12px] leading-relaxed text-ink bg-surface border border-border rounded-xl p-3 pr-12 overflow-x-auto max-h-[400px] overflow-y-auto">
        <HighlightedCode code={children} />
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={children} />
      </div>
    </div>
  );
}

function McpSection() {
  const apiOrigin = useApiOrigin();

  const claudeCodeSnippet = `claude mcp add forgefy \\
  -e FORGEFY_API_KEY=fgy_live_... \\
  -e FORGEFY_API_URL=${apiOrigin} \\
  -- python /path/to/mcp_server.py`;

  const jsonConfigSnippet = `{
  "mcpServers": {
    "forgefy": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "FORGEFY_API_KEY": "fgy_live_...",
        "FORGEFY_API_URL": "${apiOrigin}"
      }
    }
  }
}`;

  return (
    <Section
      title="Use Forgefy from Claude Code, Claude Desktop, or Cursor (MCP)"
      description="Instead of writing HTTP calls, install a small local connector — then AI agents in your editor can extract requirements from transcripts by themselves."
    >
      <McpStep n={1} title="Download the connector and install its dependency">
        <p className="text-[12px] text-text-secondary">
          The connector is a single Python file (needs Python 3.10+). Save it anywhere — you'll
          point your editor at its path in the next step.
        </p>
        <div className="flex items-center gap-2">
          <a
            href="/mcp_server.py"
            download
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity btn-press shrink-0"
          >
            Download mcp_server.py
          </a>
        </div>
        <McpCode>{`pip install "mcp[cli]" httpx`}</McpCode>
      </McpStep>

      <McpStep n={2} title="Register it with your editor">
        <p className="text-[12px] text-text-secondary">
          Replace <code className="font-mono-ui text-ink">fgy_live_...</code> with a key from above,
          and <code className="font-mono-ui text-ink">/path/to/mcp_server.py</code> with where you
          saved the file.
        </p>
        <p className="text-[12px] text-text-muted">Claude Code — run in a terminal:</p>
        <McpCode>{claudeCodeSnippet}</McpCode>
        <p className="text-[12px] text-text-muted">
          Claude Desktop / Cursor — add to the MCP settings JSON (
          <code className="font-mono-ui">claude_desktop_config.json</code> or{" "}
          <code className="font-mono-ui">.cursor/mcp.json</code>):
        </p>
        <McpCode>{jsonConfigSnippet}</McpCode>
      </McpStep>

      <McpStep n={3} title="Use it — just ask">
        <p className="text-[12px] text-text-secondary">
          Restart your editor (in Claude Code, <code className="font-mono-ui text-ink">/mcp</code>{" "}
          should list <strong>forgefy</strong> as connected). Then ask in plain language — no code
          needed:
        </p>
        <McpCode>{`Use forgefy to extract the requirements from this transcript: <paste transcript>`}</McpCode>
        <p className="text-[12px] text-text-muted">
          The agent picks the right tool on its own. Available tools:
        </p>
        <ul className="space-y-1.5">
          {MCP_TOOLS.map((t) => (
            <li key={t.name} className="flex items-baseline gap-2 text-[12px]">
              <code className="font-mono-ui text-ink bg-surface border border-border rounded-md px-1.5 py-0.5 shrink-0">
                {t.name}
              </code>
              <span className="text-text-muted">{t.desc}</span>
            </li>
          ))}
        </ul>
      </McpStep>

      <p className="text-[12px] text-text-muted pt-3">
        The connector runs locally and is a plain client of this API — your key, your quota, and
        nothing else stored anywhere.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function DevelopersPage() {
  return (
    <div className="px-2  md:px-2 py-10 max-w-2xl mx-auto page-enter">
      <div className="mb-8">
        <p className="label-eyebrow mb-1">Developers</p>
        <h1 className="font-display text-[32px] md:text-[40px] text-ink leading-[1.1]">
          Developer API
        </h1>
        <p className="text-[14px] text-text-secondary mt-2">
          Integrate Forgefy's requirement extraction into your own product.
        </p>
      </div>

      <div className="space-y-4">
        <ApiKeysSection />
        <UsageSection />
        <SdkSection />
        <QuickstartSection />
        <McpSection />
      </div>
    </div>
  );
}
