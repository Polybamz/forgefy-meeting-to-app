import { createFileRoute, Link } from "@tanstack/react-router";
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
  { id: "settings", label: "Account settings" },
  { id: "privacy", label: "Privacy & consent" },
  { id: "faq", label: "Troubleshooting" },
];

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Doc({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
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
              out what your team decided (features, entities, constraints, conflicts, action
              items), and builds a real Flutter, React Native, or Next.js app from that
              understanding. Nothing gets built without your approval, and the source code is
              pushed to GitHub automatically.
            </p>
            <p>
              After the first build, the same conversational workflow keeps going: open the
              project, describe a change in plain language, and Forgefy's agent edits the code,
              shows you a live preview, and keeps a running log of what it did.
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
              From the Dashboard, click <strong>New session</strong> and choose how the meeting
              will be captured:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Google Meet, Zoom, or Teams</strong> — paste the meeting link. Forgefy
                joins as a silent participant and starts listening once you tell it to join.
              </li>
              <li>
                <strong>Physical / in-person</strong> — no link needed. On the session page,
                choose to either <strong>upload a recording</strong> you already have (MP3, MP4,
                M4A, WAV, WEBM, or OGG, up to 500 MB) or use <strong>live transcription</strong>{" "}
                through your device's microphone.
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
              Native, or Next.js), and the list of features Forgefy extracted from the
              conversation. Nothing is built until you approve it.
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
                Forgefy generates <strong>two blueprints</strong> and lets you choose which to
                build first; you can build the other one later.
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
                <strong>Chat</strong> — describe any change in plain language ("add a login
                screen", "make the button red") and the build agent plans the change, shows which
                files it's writing, and applies it.
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
                connect the provider account once; new databases are provisioned per project with
                a single click afterward.
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
              cards, MTN Mobile Money, and Orange Money. If you exhaust your monthly tokens,
              further builds and updates pause until the next billing cycle or until you upgrade —
              you'll see a prompt to upgrade from anywhere in the app when this happens. Manage or
              change your plan any time from <strong>Billing</strong>.
            </p>
          </Doc>

          <Doc id="settings" title="Account settings">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Build model</strong> — choose which AI model powers your builds and
                updates (Gemini, Claude, GPT-4o, or a local Qwen3 model). Takes effect on your next
                build or update.
              </li>
              <li>
                <strong>GitHub</strong> — connect or check the status of your linked GitHub
                account.
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
