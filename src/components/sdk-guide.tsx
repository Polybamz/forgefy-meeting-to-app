import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { HighlightedCode } from "@/components/highlighted-code";

/**
 * Detailed, language-toggled usage guide for the official Forgefy SDKs
 * (@forgefy/sdk on npm, forgefy on PyPI). Snippets are interpolated with the
 * deployment's real origin so they run as-is once the reader adds their key.
 */

type Lang = "ts" | "py";

function CodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="relative">
      <pre className="font-mono-ui text-[12px] leading-relaxed text-ink bg-surface border border-border rounded-xl p-4 pr-12 overflow-x-auto max-h-[400px] overflow-y-auto">
        <HighlightedCode code={code} />
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

function Block({
  title,
  children,
  ts,
  py,
  lang,
}: {
  title: string;
  children?: React.ReactNode;
  ts: string;
  py: string;
  lang: Lang;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[14px] font-semibold text-ink pt-1">{title}</h4>
      {children}
      <CodeCard code={lang === "ts" ? ts : py} />
    </div>
  );
}

export function SdkGuide({ apiOrigin }: { apiOrigin: string }) {
  const [lang, setLang] = useState<Lang>("ts");

  return (
    <div className="space-y-4">
      {/* language toggle */}
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
        {(
          [
            ["ts", "TypeScript"],
            ["py", "Python"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setLang(id)}
            className={[
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              lang === id ? "bg-card text-accent shadow-warm-xs" : "text-text-muted hover:text-ink",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <Block
        title="Install"
        lang={lang}
        ts={`npm install @forgefy/sdk\n# Node 18+ — zero runtime dependencies`}
        py={`pip install forgefy\n# Python 3.10+`}
      />

      <Block
        title="Initialize the client"
        lang={lang}
        ts={`import Forgefy from "@forgefy/sdk";

const forgefy = new Forgefy({
  apiKey: process.env.FORGEFY_API_KEY!, // fgy_live_… from the Developers page
  baseUrl: "${apiOrigin}", // optional — this is the default
});`}
        py={`import os
from forgefy import Forgefy

client = Forgefy(
    api_key=os.environ["FORGEFY_API_KEY"],  # fgy_live_… from the Developers page
    base_url="${apiOrigin}",                # optional — or set $FORGEFY_API_URL
)`}
      >
        <p className="text-[13px] text-text-secondary">
          Keep the API key on a server — never ship it in browser or mobile code. Options also
          accept <code className="font-mono-ui">maxRetries</code> (default 2),{" "}
          <code className="font-mono-ui">timeoutMs</code>/
          <code className="font-mono-ui">timeout</code> (default 120s).
        </p>
      </Block>

      <Block
        title="Extract from a transcript"
        lang={lang}
        ts={`const result = await forgefy.extract({
  transcript: "We need Google login before launch. Sarah owns billing.",
  extractors: ["features", "action_items"], // optional — omit to run all four
});

for (const f of result.features) console.log(\`[\${f.priority}] \${f.title}\`);
for (const a of result.action_items) console.log(\`TODO (\${a.owner}): \${a.task}\`);
console.log(result.usage); // { input_tokens, output_tokens }
console.log(result.model_tier); // "standard" | "economy"`}
        py={`result = client.extract(
    "We need Google login before launch. Sarah owns billing.",
    extractors=["features", "action_items"],  # optional — omit to run all four
)

for f in result["features"]:
    print(f"[{f['priority']}] {f['title']}")
for a in result["action_items"]:
    print(f"TODO ({a['owner']}): {a['task']}")
print(result["usage"])       # {"input_tokens": ..., "output_tokens": ...}
print(result["model_tier"])  # "standard" | "economy"`}
      >
        <p className="text-[13px] text-text-secondary">
          Synchronous, for transcripts up to 50,000 characters. Returns{" "}
          <code className="font-mono-ui">features</code>,{" "}
          <code className="font-mono-ui">questions</code>,{" "}
          <code className="font-mono-ui">conflicts</code>,{" "}
          <code className="font-mono-ui">action_items</code>, plus{" "}
          <code className="font-mono-ui">usage</code>.
        </p>
      </Block>

      <Block
        title="Long transcripts — async jobs"
        lang={lang}
        ts={`// Up to 200k characters. Queue it, then wait (the SDK polls for you).
const job = await forgefy.jobs.create({
  transcript: longTranscript,
  // webhookUrl: "https://yourapp.com/hooks/forgefy", // optional, instead of polling
});

const done = await forgefy.jobs.waitFor(job.job_id); // resolves when status === "done"
console.log(done.result); // { features, questions, conflicts, action_items, usage }`}
        py={`# Up to 200k characters. Queue it, then wait (the SDK polls for you).
job = client.jobs.create(
    long_transcript,
    # webhook_url="https://yourapp.com/hooks/forgefy",  # optional, instead of polling
)

done = client.jobs.wait_for(job["job_id"])  # returns when status == "done"
print(done["result"])  # {"features", "questions", "conflicts", "action_items", "usage"}`}
      >
        <p className="text-[13px] text-text-secondary">
          <code className="font-mono-ui">jobs.create</code> auto-sends an idempotency key, so a
          network retry can never run the same job twice.{" "}
          <code className="font-mono-ui">waitFor</code>/
          <code className="font-mono-ui">wait_for</code> throws a typed timeout/failure error rather
          than hanging.
        </p>
      </Block>

      <Block
        title="Verify webhook deliveries"
        lang={lang}
        ts={`import { verifySignature } from "@forgefy/sdk";

// Express — verify the RAW body before parsing JSON.
app.post("/hooks/forgefy", express.raw({ type: "application/json" }), (req, res) => {
  const ok = verifySignature(
    req.body,                              // raw bytes
    req.headers["x-forgefy-signature"],    // "sha256=…"
    process.env.FORGEFY_WEBHOOK_SECRET!,   // job.webhook_secret from jobs.create()
  );
  if (!ok) return res.status(401).end();

  const event = JSON.parse(req.body.toString());
  // { type: "extract.job.completed" | "extract.job.failed", job_id, status, result?, error? }
  res.status(200).end();
});`}
        py={`from forgefy import verify_signature

# FastAPI — verify the RAW body before parsing JSON.
@app.post("/hooks/forgefy")
async def forgefy_hook(request: Request):
    raw = await request.body()  # raw bytes
    ok = verify_signature(
        raw,
        request.headers.get("x-forgefy-signature"),  # "sha256=…"
        os.environ["FORGEFY_WEBHOOK_SECRET"],         # job["webhook_secret"]
    )
    if not ok:
        return Response(status_code=401)

    event = json.loads(raw)
    # {"type": "extract.job.completed" | "extract.job.failed", "job_id", "status", "result"?, "error"?}
    return Response(status_code=200)`}
      >
        <p className="text-[13px] text-text-secondary">
          Always verify against the raw body — parsing and re-serializing JSON can reorder keys and
          break the signature. Comparison is constant-time.
        </p>
      </Block>

      <Block
        title="Handle errors"
        lang={lang}
        ts={`import {
  QuotaExceededError,
  RateLimitError,
  ValidationError,
  ForgefyError,
} from "@forgefy/sdk";

try {
  await forgefy.extract({ transcript });
} catch (err) {
  if (err instanceof QuotaExceededError) {
    console.log("Out of tokens:", err.detail); // includes the reset date
  } else if (err instanceof RateLimitError) {
    // already retried automatically; back off further
  } else if (err instanceof ValidationError) {
    console.log("Bad request:", err.detail);
  } else if (err instanceof ForgefyError) {
    console.log("API error", err.status, err.detail);
  }
}`}
        py={`from forgefy import (
    QuotaExceededError,
    RateLimitError,
    ValidationError,
    ForgefyError,
)

try:
    client.extract(transcript)
except QuotaExceededError as err:
    print("Out of tokens:", err.detail)  # includes the reset date
except RateLimitError:
    pass  # already retried automatically; back off further
except ValidationError as err:
    print("Bad request:", err.detail)
except ForgefyError as err:
    print("API error", err.status, err.detail)`}
      >
        <p className="text-[13px] text-text-secondary">
          Every failure is a typed subclass of <code className="font-mono-ui">ForgefyError</code>{" "}
          with <code className="font-mono-ui">.status</code> and{" "}
          <code className="font-mono-ui">.detail</code>. 429s and network errors are retried
          automatically (exponential backoff, <code className="font-mono-ui">Retry-After</code>{" "}
          honored); the sync <code className="font-mono-ui">extract</code> is never retried on 5xx,
          so tokens are never double-billed.
        </p>
      </Block>

      <Block
        title="Check your quota"
        lang={lang}
        ts={`const usage = await forgefy.usage();
// { tier, monthly_tokens, tokens_used, tokens_remaining, resets_at }`}
        py={`usage = client.usage()
# {"tier", "monthly_tokens", "tokens_used", "tokens_remaining", "resets_at"}`}
      >
        <p className="text-[13px] text-text-secondary">
          Paid accounts over budget aren't blocked — requests fall back to the free{" "}
          <code className="font-mono-ui">economy</code> model. Check{" "}
          <code className="font-mono-ui">result.model_tier</code> to see which tier answered.
        </p>
      </Block>
    </div>
  );
}
