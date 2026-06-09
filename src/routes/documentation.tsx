import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/documentation")({
  component: Documentation,
  head: () => ({
    meta: [{ title: "Forgefy — Documentation" }],
  }),
});

export default function Documentation() {
  return (
    <main className="min-h-screen page-gradient text-ink antialiased">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-text-muted hover:text-ink">← Home</Link>
          <h1 className="text-2xl font-semibold">Documentation</h1>
        </div>

        <p className="text-text-muted mb-6">A short reference for the Forgefy demo frontend and integration notes.</p>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Local development</h2>
            <p className="text-text-muted mt-2">Run the frontend from the project root using Vite.</p>
            <pre className="mt-2 rounded-md bg-surface border border-border p-3 text-sm">
{`npm install
npm run dev`}
            </pre>
          </div>

          <div>
            <h2 className="text-lg font-medium">Routes</h2>
            <p className="text-text-muted mt-2">This app uses file-based routes — add new pages under <code>src/routes/</code> to register them automatically.</p>
          </div>

          <div>
            <h2 className="text-lg font-medium">API</h2>
            <p className="text-text-muted mt-2">The frontend talks to the Forgefy backend using the helpers in <code>src/lib/api.ts</code>. Update <code>FRONTEND_URL</code> and backend env vars when deploying.</p>
          </div>

          <div>
            <h2 className="text-lg font-medium">Styling</h2>
            <p className="text-text-muted mt-2">Tailwind-like utility classes and a small design system are used across components in <code>src/components/</code>.</p>
          </div>

          <div>
            <h2 className="text-lg font-medium">Want more?</h2>
            <p className="text-text-muted mt-2">Tell me which docs you'd like (API reference, auth flows, or component guide) and I will add them.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
