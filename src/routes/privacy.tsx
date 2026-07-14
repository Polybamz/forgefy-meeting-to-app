import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "./__root";

const DESCRIPTION =
  "How Forgefy collects, uses, and protects your meeting content, generated code, and account data.";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Forgefy" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Privacy Policy — Forgefy" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { name: "twitter:title", content: "Privacy Policy — Forgefy" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
});

const LAST_UPDATED = "July 14, 2026";

export default function Privacy() {
  return (
    <main className="min-h-screen page-gradient text-ink antialiased">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-text-muted hover:text-ink">
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        </div>
        <p className="text-text-muted mb-2">Last updated: {LAST_UPDATED}</p>
        <p className="text-[13px] text-text-muted mb-10 rounded-xl border border-border bg-surface p-4">
          This is a general-purpose draft template describing the data Forgefy actually collects and
          the third-party services it actually uses. It is provided as a starting point, not legal
          advice — have it reviewed by a lawyer (and adjust for GDPR/CCPA/local law as needed)
          before relying on it for a live product.
        </p>

        <section className="space-y-8 text-[14px] leading-relaxed text-text-secondary">
          <div>
            <h2 className="text-lg font-medium text-ink">1. Information we collect</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account information</strong> — your email address and a securely hashed
                password (or your Google account identifier, if you sign in with Google).
              </li>
              <li>
                <strong>Meeting content</strong> — audio, transcripts, and any decisions, features,
                or requirements our systems extract from meetings you connect Forgefy to (via a bot
                joining Google Meet, Zoom, or Microsoft Teams, or a recording you upload).
              </li>
              <li>
                <strong>Generated content</strong> — the application blueprints and source code
                Forgefy generates for you, and the GitHub repository metadata associated with it.
              </li>
              <li>
                <strong>Usage data</strong> — how many meetings, builds, and updates you've run, and
                how much AI processing ("tokens") you've consumed each billing month.
              </li>
              <li>
                <strong>Payment data</strong> — your subscription tier and billing status. Card and
                mobile-money details are handled directly by our payment processor and are never
                stored on our servers.
              </li>
              <li>
                <strong>Third-party integration tokens</strong> — if you connect GitHub, Supabase,
                Neon, or Firebase to a generated app, we store the access tokens/credentials needed
                to provision and maintain that connection, encrypted at rest.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">2. How we use your information</h2>
            <p className="mt-2">
              We use this information to: operate and improve the Service; transcribe and analyze
              your meetings; generate application code on your behalf; provision databases or other
              integrations you explicitly connect; process payments and enforce your plan's usage
              limits; and communicate with you about your account.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">3. AI processing</h2>
            <p className="mt-2">
              Meeting transcripts, extracted requirements, and code-generation requests are sent to
              third-party AI providers (currently Anthropic, Google, and/or OpenAI, depending on
              configuration) for processing. These providers process the data under their own terms
              and do not use it to train their models on Forgefy's behalf beyond what's necessary to
              return a response.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">4. Third-party service providers</h2>
            <p className="mt-2">
              We share data with the following categories of providers, only as needed to run the
              Service:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>Meeting-bot and transcription providers, to join and transcribe meetings.</li>
              <li>AI providers, to analyze transcripts and generate code (see above).</li>
              <li>GitHub, to host the source code of apps you generate.</li>
              <li>
                Database providers (Supabase, Neon, Firebase) — only for apps where you explicitly
                connect one.
              </li>
              <li>Our cloud database and hosting providers, to store your account and app data.</li>
              <li>A payment processor, to handle subscription billing.</li>
            </ul>
            <p className="mt-2">We do not sell your personal information.</p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">5. Data security</h2>
            <p className="mt-2">
              Passwords are hashed, never stored in plain text. OAuth tokens and other credentials
              for connected third-party services are encrypted at rest. Access to production data is
              restricted to what's needed to operate the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">6. Data retention</h2>
            <p className="mt-2">
              We retain your account, meeting, and generated-app data for as long as your account is
              active. If you delete a project or your account, associated data is removed from our
              systems within a reasonable period, except where we're required to retain it (e.g.
              billing records) or where it has already been synced to a third-party service you
              connected (e.g. your own GitHub repository).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">7. Your rights and choices</h2>
            <p className="mt-2">
              Wherever you live, Forgefy gives you self-service control over your data. From{" "}
              <strong>Settings → Privacy &amp; Data</strong> you can:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong>Export your data</strong> — download a JSON copy of your profile, meeting
                sessions and transcripts, blueprints, projects, and usage records.
              </li>
              <li>
                <strong>Delete your account</strong> — permanently remove your account and all
                associated data (meetings, transcripts, blueprints, projects, chats, and usage
                records), including your sign-in credential. Code already pushed to your own GitHub
                repositories remains yours and is not touched.
              </li>
            </ul>
            <p className="mt-2">
              You can also delete individual meetings and projects from within the app, or email{" "}
              privacy@forgefy.dev to make any of these requests instead. We respond to verified
              requests within 45 days.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">
              8. California privacy rights (CCPA/CPRA)
            </h2>
            <p className="mt-2">
              If you are a California resident, the California Consumer Privacy Act, as amended by
              the CPRA, gives you the following rights:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong>Right to know / access</strong> — request the categories and specific pieces
                of personal information we have collected about you, the sources, the purposes, and
                the categories of third parties we share it with.
              </li>
              <li>
                <strong>Right to delete</strong> — request deletion of your personal information,
                subject to legal exceptions (e.g. billing records we must retain).
              </li>
              <li>
                <strong>Right to correct</strong> — request correction of inaccurate personal
                information.
              </li>
              <li>
                <strong>Right to data portability</strong> — receive your data in a portable,
                machine-readable format (the JSON export above).
              </li>
              <li>
                <strong>Right to opt out of sale or sharing</strong> — Forgefy{" "}
                <strong>does not sell your personal information and does not share it for
                cross-context behavioral advertising</strong>, and has not done so in the preceding
                12 months, so there is nothing to opt out of.
              </li>
              <li>
                <strong>Right to limit use of sensitive personal information</strong> — the only
                sensitive personal information we process is your login credential, used solely to
                authenticate you; we do not use sensitive information for any other purpose.
              </li>
              <li>
                <strong>Right to non-discrimination</strong> — we will never deny you service,
                charge you a different price, or degrade your experience for exercising any of these
                rights.
              </li>
            </ul>
            <p className="mt-2">
              In CCPA terms, the categories we collect are: identifiers (email address),
              commercial information (subscription tier, billing status), internet activity (usage
              counts), audio/electronic information (meeting recordings and transcripts you choose
              to process), and professional information incidentally contained in those meetings.
            </p>
            <p className="mt-2">
              To exercise any right, use <strong>Settings → Privacy &amp; Data</strong> or email
              privacy@forgefy.dev. You may use an authorized agent; we will verify the request
              (and, for agents, written authorization) before acting on it. We will confirm receipt
              within 10 business days and respond within 45 days, extendable once by a further 45
              days with notice.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">9. Children's privacy</h2>
            <p className="mt-2">
              The Service is not directed to children under 16, and we do not knowingly collect
              personal information from them. We do not sell or share the personal information of
              consumers we know to be under 16.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">10. Changes to this policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. Material changes will be
              reflected by updating the "Last updated" date above.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">11. Contact</h2>
            <p className="mt-2">
              Questions about this Privacy Policy, or a request to access/delete your data? Contact
              us at privacy@forgefy.dev.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
