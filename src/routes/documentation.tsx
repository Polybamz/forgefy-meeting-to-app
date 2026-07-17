import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useApiOrigin } from "@/hooks/use-api-origin";
import { ApiExamples } from "@/components/api-examples";
import { HighlightedCode } from "@/components/highlighted-code";
import { SdkGuide } from "@/components/sdk-guide";
import { SITE_URL } from "./__root";

const DESCRIPTION =
  "Learn how Forgefy turns your meetings into working apps — sessions, blueprints, builds, databases, GitHub, and billing.";

export const Route = createFileRoute("/documentation")({
  component: Documentation,
  head: () => ({
    meta: [
      { title: "Documentation — Forgefy" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Documentation — Forgefy" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/documentation` },
      { name: "twitter:title", content: "Documentation — Forgefy" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/documentation` }],
  }),
});

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------
const TOC = [
  { id: "overview", label: "What is Forgefy?" },
  { id: "quick-start", label: "Quick start" },
  { id: "sessions", label: "Starting a session" },
  { id: "listening", label: "While Forgefy is listening" },
  { id: "blueprint", label: "Reviewing your blueprint" },
  { id: "workspace", label: "The project workspace" },
  { id: "database", label: "Connecting a database" },
  { id: "github", label: "Publishing to GitHub" },
  { id: "billing", label: "Plans & billing" },
  { id: "developer-api", label: "Developer API" },
  { id: "settings", label: "Account settings" },
  { id: "privacy", label: "Privacy & consent" },
  { id: "faq", label: "Troubleshooting" },
];

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Doc({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 pt-2">
      <h2 className="font-display text-[22px] md:text-[26px] text-ink mb-3">{title}</h2>
      <div className="space-y-3 text-[14px] leading-[1.75] text-text-secondary">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-text-secondary">
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select the text */
    }
  }

  return (
    <div className="relative group">
      <pre className="font-mono-ui text-[12px] leading-relaxed text-ink bg-surface border border-border rounded-xl p-4 pr-12 overflow-x-auto max-h-[400px] overflow-y-auto">
        <HighlightedCode code={children} />
      </pre>
      <button
        onClick={copy}
        aria-label="Copy to clipboard"
        className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-card text-text-muted hover:text-accent hover:border-accent transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 text-accent text-[11px] font-mono-ui font-medium mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Developer API section — snippets show the real base URL of this deployment
// ---------------------------------------------------------------------------
function EndpointRow({ method, url, desc }: { method: string; url: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-border/60 last:border-0">
      <span
        className={`shrink-0 w-12 text-[11px] font-mono-ui font-semibold ${
          method === "GET" ? "text-accent" : "text-ink"
        }`}
      >
        {method}
      </span>
      <code className="font-mono-ui text-[12px] text-ink break-all">{url}</code>
      <span className="text-[12px] text-text-muted sm:ml-auto sm:text-right sm:shrink-0">
        {desc}
      </span>
    </div>
  );
}

function DeveloperApiDoc() {
  const apiOrigin = useApiOrigin();
  const base = `${apiOrigin}/api/v1`;

  return (
    <Doc id="developer-api" title="Developer API">
      <p>
        The same extraction engine that powers Forgefy's meetings is available as a REST API: send
        any transcript, get back structured <strong>features</strong>,{" "}
        <strong>open questions</strong>, <strong>conflicting requirements</strong>, and{" "}
        <strong>action items</strong> as JSON — for your own meeting tool, project tracker, or
        agent.
      </p>

      <p>
        All endpoints live under this base URL (copy it — every example below uses it already filled
        in):
      </p>
      <CodeBlock>{base}</CodeBlock>

      <h3 className="text-[15px] font-semibold text-ink pt-2">Step 1 — Create an API key</h3>
      <p>
        Go to the{" "}
        <Link to="/developers" className="text-accent hover:underline">
          Developers
        </Link>{" "}
        page in your dashboard, give the key a name, and copy the{" "}
        <code className="font-mono-ui">fgy_live_…</code> value it shows you.{" "}
        <strong>It is shown exactly once</strong> — Forgefy stores only a hash. If you lose it,
        revoke it and create a new one.
      </p>

      <h3 className="text-[15px] font-semibold text-ink pt-2">
        Step 2 — Install an SDK (recommended)
      </h3>
      <p>
        Official SDKs for <strong>TypeScript</strong> (
        <code className="font-mono-ui">@forgefy/sdk</code> on npm) and <strong>Python</strong> (
        <code className="font-mono-ui">forgefy</code> on PyPI) wrap every endpoint with typed
        responses, automatic retries, idempotent jobs, built-in job polling, and webhook signature
        verification — so you don't hand-roll any of it.
      </p>
      <SdkGuide apiOrigin={apiOrigin} />

      <h3 className="text-[15px] font-semibold text-ink pt-2">Or call the API directly</h3>
      <p>
        No SDK for your language? Every endpoint is plain REST. Each example below is complete and
        already uses this deployment's URL — the only thing to replace is the API key:
      </p>
      <ApiExamples base={base} />
      <p>You get grouped, structured JSON back:</p>
      <CodeBlock>{`{
  "model_tier": "standard",
  "features": [
    {"title": "Google OAuth login", "description": "...", "priority": "high"}
  ],
  "action_items": [
    {"task": "Build the billing page", "owner": "Sarah", "due": null}
  ],
  "usage": {"input_tokens": 412, "output_tokens": 188}
}`}</CodeBlock>
      <Callout>
        Transcripts up to <strong>50,000 characters</strong> work synchronously like this. The{" "}
        <code className="font-mono-ui">extractors</code> field is optional — leave it out to run all
        four; you're only metered for the ones you request.
      </Callout>

      <h3 className="text-[15px] font-semibold text-ink pt-2">Endpoint reference</h3>
      <div className="rounded-xl border border-border px-4 py-1">
        <EndpointRow method="POST" url={`${base}/extract`} desc="Sync, ≤50k chars" />
        <EndpointRow method="POST" url={`${base}/extract/jobs`} desc="Async, ≤200k chars" />
        <EndpointRow method="GET" url={`${base}/extract/jobs/{id}`} desc="Job status + result" />
        <EndpointRow method="GET" url={`${base}/usage`} desc="Your remaining token budget" />
      </div>

      <h4 className="text-[14px] font-semibold text-ink pt-1">Long transcripts (async jobs)</h4>
      <p>
        Queue a job, then poll it — or pass a <code className="font-mono-ui">webhook_url</code>{" "}
        (https) and the result is POSTed to you when it finishes:
      </p>
      <CodeBlock>{`# Queue the job (the Idempotency-Key makes retries safe)
curl -X POST "${base}/extract/jobs" \\
  -H "Authorization: Bearer fgy_live_..." \\
  -H "Idempotency-Key: my-import-42" \\
  -H "Content-Type: application/json" \\
  -d '{"transcript": "...", "webhook_url": "https://yourapp.com/hooks/forgefy"}'
# → {"job_id": "...", "status": "queued", "webhook_secret": "..."}

# Poll until status is "done"
curl "${base}/extract/jobs/JOB_ID" \\
  -H "Authorization: Bearer fgy_live_..."`}</CodeBlock>
      <p>
        Webhook deliveries carry an{" "}
        <code className="font-mono-ui">X-Forgefy-Signature: sha256=…</code> header — an HMAC-SHA256
        of the raw body using the <code className="font-mono-ui">webhook_secret</code> from the
        queue response. Verify it before trusting the payload. Failed deliveries are retried three
        times with backoff.
      </p>

      <h4 className="text-[14px] font-semibold text-ink pt-1">Quotas, limits &amp; errors</h4>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          API usage draws from the <strong>same monthly token allowance</strong> as builds and
          updates (see{" "}
          <a href="#billing" className="text-accent hover:underline">
            Plans &amp; billing
          </a>
          ) — check it any time with <code className="font-mono-ui">GET {base}/usage</code>.
        </li>
        <li>
          Over budget? Free plans get a <code className="font-mono-ui">402</code> with the reset
          date. Paid plans keep working — requests are served by the free{" "}
          <code className="font-mono-ui">economy</code> model instead, and the response's{" "}
          <code className="font-mono-ui">model_tier</code> tells you which one answered.
        </li>
        <li>
          Rate limit: <strong>60 requests/minute per API key</strong>. Errors are RFC 7807{" "}
          <code className="font-mono-ui">application/problem+json</code> with a human-readable{" "}
          <code className="font-mono-ui">detail</code>.
        </li>
      </ul>

      <h4 className="text-[14px] font-semibold text-ink pt-1">MCP server (use from agents)</h4>
      <p>
        Prefer tools over HTTP? A small local connector exposes Forgefy inside Claude Code, Claude
        Desktop, or Cursor, so the agent in your editor can call{" "}
        <code className="font-mono-ui">extract_requirements</code> itself. Three steps:
      </p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          <a href="/mcp_server.py" download className="text-accent hover:underline">
            Download mcp_server.py
          </a>{" "}
          (a single Python 3.10+ file — save it anywhere) and install its dependency:{" "}
          <code className="font-mono-ui">pip install "mcp[cli]" httpx</code>
        </li>
        <li>
          Register it — for Claude Code, run this in a terminal (swap in your key and the file's
          path):
          <div className="mt-2">
            <CodeBlock>{`claude mcp add forgefy \\
  -e FORGEFY_API_KEY=fgy_live_... \\
  -e FORGEFY_API_URL=${apiOrigin} \\
  -- python /path/to/mcp_server.py`}</CodeBlock>
          </div>
          For Claude Desktop or Cursor, add the equivalent entry to the MCP settings JSON (
          <code className="font-mono-ui">claude_desktop_config.json</code> /{" "}
          <code className="font-mono-ui">.cursor/mcp.json</code>) with the same two environment
          variables.
        </li>
        <li>
          Restart the editor and just ask:{" "}
          <em>"Use forgefy to extract the requirements from this transcript: …"</em> — the agent
          calls the tool and gets structured JSON back. The exact client config snippets are on the{" "}
          <Link to="/developers" className="text-accent hover:underline">
            Developers
          </Link>{" "}
          page.
        </li>
      </ol>
      <Callout>
        Interactive API reference with every request/response schema:{" "}
        <a
          href={`${apiOrigin}/docs`}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline break-all"
        >
          {apiOrigin}/docs
        </a>{" "}
        (available on development builds). Key management lives on the{" "}
        <Link to="/developers" className="text-accent hover:underline">
          Developers
        </Link>{" "}
        page.
      </Callout>
    </Doc>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Documentation() {
  return (
    <main className="min-h-screen page-gradient text-ink antialiased">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link to="/" className="text-text-muted hover:text-ink transition-colors text-[13px]">
            ← Home
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-display text-[20px] text-ink">Documentation</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12">
        {/* TOC */}
        <nav className="hidden lg:block">
          <div className="sticky top-8 space-y-1">
            <p className="label-eyebrow mb-3">On this page</p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block py-1 text-[13px] text-text-muted hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-14 max-w-2xl">
          <Doc id="overview" title="What is Forgefy?">
            <p>
              Forgefy turns a planning conversation into a working app. Invite it to a call on
              Google Meet, Zoom, or Microsoft Teams — or record in person — and it listens, figures
              out what your team decided (features, entities, constraints, conflicts, action items),
              and builds a real Flutter, React Native, or Next.js app from that understanding.
              Nothing gets built without your approval, and the source code is pushed to GitHub
              automatically.
            </p>
            <p>
              After the first build, the same conversational workflow keeps going: open the project,
              describe a change in plain language, and Forgefy's agent edits the code, shows you a
              live preview, and keeps a running log of what it did.
            </p>
          </Doc>

          <Doc id="quick-start" title="Quick start">
            <Steps
              items={[
                "Create a free account and open your Dashboard.",
                "Start a new session — pick Meet, Zoom, Teams, or your microphone.",
                "Let Forgefy join or record the conversation. It transcribes as you talk.",
                "Review the blueprint it extracted, edit anything that's off, and approve it.",
                "Your app builds automatically and is pushed to a GitHub repository.",
                "Open the project to chat with the build agent and request changes any time.",
              ]}
            />
          </Doc>

          <Doc id="sessions" title="Starting a session">
            <p>
              From the Dashboard, click <strong>New session</strong> and choose how the meeting will
              be captured:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Google Meet, Zoom, or Teams</strong> — paste the meeting link. Forgefy joins
                as a silent participant and starts listening once you tell it to join.
              </li>
              <li>
                <strong>Physical / in-person</strong> — no link needed. On the session page, choose
                to either <strong>upload a recording</strong> you already have (MP3, MP4, M4A, WAV,
                WEBM, or OGG, up to 500 MB) or use <strong>live transcription</strong> through your
                device's microphone.
              </li>
            </ul>
            <Callout>
              Live microphone capture needs browser permission to use your microphone — allow it
              when prompted, and speak clearly; a warning appears if your input is too quiet.
            </Callout>
          </Doc>

          <Doc id="listening" title="While Forgefy is listening">
            <p>
              During a live or in-person session you'll see a real-time transcript and a stream of
              detected features as they come up in conversation — new features, open questions,
              conflicts, and action items each get their own marker. When you end the meeting (or
              finish uploading a recording), Forgefy moves to a short processing step — usually
              30–120 seconds — where it turns the transcript into a structured blueprint.
            </p>
          </Doc>

          <Doc id="blueprint" title="Reviewing your blueprint">
            <p>
              The blueprint is the plan for your app: an app name, a target stack (Flutter, React
              Native, or Next.js), and the list of features Forgefy extracted from the conversation.
              Nothing is built until you approve it.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Edit</strong> the app name, template, or feature list before approving if
                something doesn't match what your team decided.
              </li>
              <li>
                <strong>Approve &amp; build</strong> to kick off the build — you're taken straight
                to the new project once it starts.
              </li>
              <li>
                If your conversation implies both a mobile app and a companion web experience,
                Forgefy generates <strong>two blueprints</strong> and lets you choose which to build
                first; you can build the other one later.
              </li>
            </ul>
          </Doc>

          <Doc id="workspace" title="The project workspace">
            <p>
              Once a build starts, the project page becomes your workspace for that app. It has
              three parts:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Chat</strong> — describe any change in plain language ("add a login screen",
                "make the button red") and the build agent plans the change, shows which files it's
                writing, and applies it.
              </li>
              <li>
                <strong>Preview</strong> — a live, embedded preview of the running app so you can
                see changes as they land.
              </li>
              <li>
                <strong>Code</strong> — a file explorer and viewer over the generated project, if
                you want to read the actual source.
              </li>
            </ul>
            <p>
              Each request you send counts against your monthly token allowance (see{" "}
              <a href="#billing" className="text-accent hover:underline">
                Plans &amp; billing
              </a>
              ). You can stop an in-progress agent run at any time from the chat panel.
            </p>
          </Doc>

          <Doc id="database" title="Connecting a database">
            <p>
              If your app needs persistent data, Forgefy can provision one for you. If it detects
              the need during the first build, it will ask before continuing — you can pick a
              provider then, or skip and connect one later from the project page.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Supabase</strong>, <strong>Neon</strong>, or <strong>Firebase</strong> —
                connect the provider account once; new databases are provisioned per project with a
                single click afterward.
              </li>
              <li>
                Connecting a database only provisions it. If you connect one on a project that's
                already built, Forgefy will ask whether to <strong>wire it in</strong> — scanning
                the app and replacing mock or local data with real reads and writes through the new
                database.
              </li>
            </ul>
          </Doc>

          <Doc id="github" title="Publishing to GitHub">
            <p>
              Every app Forgefy builds is pushed to GitHub. Connect your GitHub account from the
              Dashboard banner or from Settings, and new apps are created directly in your own
              repositories. From then on, each update to a project can be pushed with{" "}
              <strong>Sync to GitHub</strong> on the project page.
            </p>
          </Doc>

          <Doc id="billing" title="Plans & billing">
            <p>
              Forgefy runs on a monthly token allowance that resets on the 1st of each month. Tokens
              are consumed by building and updating apps — roughly:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-surface text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Plan</th>
                    <th className="px-4 py-2.5 font-medium">Price</th>
                    <th className="px-4 py-2.5 font-medium">Tokens/mo</th>
                    <th className="px-4 py-2.5 font-medium">~Builds</th>
                    <th className="px-4 py-2.5 font-medium">~Updates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2.5">Free</td>
                    <td className="px-4 py-2.5">$0</td>
                    <td className="px-4 py-2.5">500K</td>
                    <td className="px-4 py-2.5">~1</td>
                    <td className="px-4 py-2.5">~10</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Starter</td>
                    <td className="px-4 py-2.5">$19/mo</td>
                    <td className="px-4 py-2.5">5M</td>
                    <td className="px-4 py-2.5">~16</td>
                    <td className="px-4 py-2.5">~100</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Pro</td>
                    <td className="px-4 py-2.5">$49/mo</td>
                    <td className="px-4 py-2.5">20M</td>
                    <td className="px-4 py-2.5">~66</td>
                    <td className="px-4 py-2.5">~400</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Team</td>
                    <td className="px-4 py-2.5">$149/mo</td>
                    <td className="px-4 py-2.5">75M</td>
                    <td className="px-4 py-2.5">~250</td>
                    <td className="px-4 py-2.5">~1,500</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Paid plans also get priority processing. Payments are handled by Notchpay and accept
              cards, MTN Mobile Money, and Orange Money. If you exhaust your monthly tokens, further
              builds and updates pause until the next billing cycle or until you upgrade — you'll
              see a prompt to upgrade from anywhere in the app when this happens. Manage or change
              your plan any time from <strong>Billing</strong>.
            </p>
          </Doc>

          <DeveloperApiDoc />

          <Doc id="settings" title="Account settings">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Build model</strong> — choose which AI model powers your builds and updates
                (Gemini, Claude, GPT-4o, or a local Qwen3 model). Takes effect on your next build or
                update.
              </li>
              <li>
                <strong>GitHub</strong> — connect or check the status of your linked GitHub account.
              </li>
              <li>
                <strong>Appearance</strong> — switch between light and dark mode.
              </li>
              <li>
                <strong>Account</strong> — view your login email and sign out.
              </li>
            </ul>
          </Doc>

          <Doc id="privacy" title="Privacy & consent">
            <p>
              Many places require the consent of meeting participants before recording or
              transcribing a conversation. You're responsible for getting any consent your
              jurisdiction or organization requires before starting a Forgefy session. See our{" "}
              <Link to="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>{" "}
              for details on how meeting content and generated code are handled.
            </p>
          </Doc>

          <Doc id="faq" title="Troubleshooting">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>"Blueprint generation failed"</strong> — this usually means the recording
                was too short or too quiet for Forgefy to extract anything useful. Try again with a
                longer, clearer recording.
              </li>
              <li>
                <strong>Microphone seems too quiet</strong> — move closer to your microphone or
                increase your input volume; Forgefy will warn you if it can't hear you clearly.
              </li>
              <li>
                <strong>Meeting bot won't join</strong> — double-check the meeting link is correct
                and that the meeting has started, then try joining again from the session page.
              </li>
              <li>
                <strong>Build failed</strong> — open the project's chat and describe the problem;
                the agent can usually retry or fix the issue directly.
              </li>
            </ul>
          </Doc>
        </div>
      </div>
    </main>
  );
}
