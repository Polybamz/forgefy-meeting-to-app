import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({
    meta: [{ title: "Terms of Service — Forgefy" }],
  }),
});

const LAST_UPDATED = "July 6, 2026";

export default function Terms() {
  return (
    <main className="min-h-screen page-gradient text-ink antialiased">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-text-muted hover:text-ink">
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold">Terms of Service</h1>
        </div>
        <p className="text-text-muted mb-2">Last updated: {LAST_UPDATED}</p>
        <p className="text-[13px] text-text-muted mb-10 rounded-xl border border-border bg-surface p-4">
          This is a general-purpose draft template covering Forgefy's actual features (meeting
          recording/transcription, AI processing, generated code, subscriptions, and third-party
          integrations). It is provided as a starting point, not legal advice — have it reviewed by
          a lawyer before relying on it for a live product.
        </p>

        <section className="space-y-8 text-[14px] leading-relaxed text-text-secondary">
          <div>
            <h2 className="text-lg font-medium text-ink">1. Acceptance of terms</h2>
            <p className="mt-2">
              By creating an account or using Forgefy ("the Service"), you agree to these Terms of
              Service and our{" "}
              <Link to="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">2. What Forgefy does</h2>
            <p className="mt-2">
              Forgefy joins meetings (via a bot, on Google Meet, Zoom, Microsoft Teams, or an
              in-person recording you upload), transcribes and analyzes the conversation using
              third-party AI models, extracts a structured summary of decisions and features, and
              uses that summary to generate a working Flutter, React Native, or Next.js application,
              including source code pushed to a GitHub repository on your behalf.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">
              3. Recording consent is your responsibility
            </h2>
            <p className="mt-2">
              Many jurisdictions require the consent of some or all participants before a meeting is
              recorded or transcribed. <strong>You are solely responsible</strong> for obtaining any
              consent required by law or by your organization's policies before starting a session
              with Forgefy. Do not use the Service to record a meeting without the legally required
              consent of its participants.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">4. Accounts</h2>
            <p className="mt-2">
              You must provide a valid email address and keep your password secure. You are
              responsible for all activity under your account. Notify us immediately of any
              unauthorized use.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">5. Subscriptions and billing</h2>
            <p className="mt-2">
              Forgefy offers a free tier and paid tiers (Starter, Pro, Team) billed monthly, each
              with a fixed monthly allowance of AI processing ("tokens"). Payments are processed by
              a third-party payment provider; Forgefy does not store your card or mobile-money
              details. Once your monthly token allowance is exhausted, further builds/updates are
              paused until the next billing period or until you upgrade. Fees are non-refundable
              except where required by law. You may cancel a paid plan at any time; access continues
              until the end of the current billing period, after which your account reverts to the
              free tier.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">6. Your content and generated code</h2>
            <p className="mt-2">
              You retain ownership of the meeting content you provide and the application code
              generated for you. Forgefy claims no ownership over your generated apps. You grant
              Forgefy a limited license to process your meeting content and generated code solely to
              provide the Service (including sending it to the third-party AI providers described in
              our Privacy Policy).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">7. AI-generated content — no warranty</h2>
            <p className="mt-2">
              Generated applications are produced automatically by AI models and may contain bugs,
              security issues, or behavior that doesn't match your intent. Review, test, and secure
              any generated code before relying on it or deploying it to production — Forgefy makes
              no warranty as to its correctness, security, or fitness for any purpose.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">8. Third-party integrations</h2>
            <p className="mt-2">
              You may connect third-party accounts to your generated apps (e.g. GitHub, Supabase,
              Neon, Firebase) or to Forgefy itself (e.g. Google sign-in). Your use of those
              third-party services is governed by their own terms — Forgefy is not responsible for
              their availability, pricing, or data handling.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">9. Acceptable use</h2>
            <p className="mt-2">
              You agree not to use the Service to record or process meetings without required
              consent, to violate any law, to infringe another person's rights, to upload malicious
              code, or to attempt to disrupt or gain unauthorized access to the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">10. Termination</h2>
            <p className="mt-2">
              You may stop using the Service and delete your account at any time. We may suspend or
              terminate accounts that violate these Terms or applicable law.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">
              11. Disclaimers and limitation of liability
            </h2>
            <p className="mt-2">
              The Service is provided "as is" without warranties of any kind. To the maximum extent
              permitted by law, Forgefy is not liable for indirect, incidental, or consequential
              damages, or for any loss arising from generated code, third-party services, or meeting
              content processed through the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">12. Changes to these terms</h2>
            <p className="mt-2">
              We may update these Terms from time to time. Continued use of the Service after a
              change constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-ink">13. Contact</h2>
            <p className="mt-2">Questions about these Terms? Contact us at legal@forgefy.dev.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
