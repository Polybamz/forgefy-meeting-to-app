import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/hooks/use-theme";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: "/dashboard" });
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Forgefy — Your meeting just became an app." },
      {
        name: "description",
        content:
          "Forgefy joins your planning calls, extracts what your team decided, and builds Flutter, React Native, and Next.js apps automatically.",
      },
      { property: "og:title", content: "Forgefy — Your meeting just became an app." },
      { property: "og:type", content: "website" },
    ],
  }),
});

// ---------------------------------------------------------------------------
// Scroll reveal hook — observes each .reveal element individually so that
// tall sections (like the apps grid) don't require 12% of the whole section
// to be visible before anything appears.
// ---------------------------------------------------------------------------
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".reveal"));
    if (!items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        visible.forEach((entry, i) => {
          io.unobserve(entry.target);
          setTimeout(() => entry.target.classList.add("is-visible"), i * 70);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);
  return ref;
}

// ---------------------------------------------------------------------------
// Blueprint card (hero visual)
// ---------------------------------------------------------------------------
const FEATURES = [
  "User authentication",
  "Real-time GPS tracking",
  "Payment integration",
  "Push notifications",
  "Driver onboarding",
];

function BlueprintCard() {
  const [count, setCount] = useState(0);
  const [showApprove, setShowApprove] = useState(false);
  const [pushed, setPushed] = useState(false);

  // Sequential feature reveal starting 1.2s after mount
  useEffect(() => {
    const t = setTimeout(
      () => setCount((c) => Math.min(c + 1, FEATURES.length)),
      count === 0 ? 1200 : 380,
    );
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count < FEATURES.length) return;
    const t1 = setTimeout(() => setShowApprove(true), 400);
    const t2 = setTimeout(() => setPushed(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [count]);

  return (
    <div className="relative w-full max-w-[360px] mx-auto lg:ml-auto">
      {/* Ambient glow behind card */}
      <div
        className="absolute inset-0 -z-10 rounded-2xl"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.598 0.135 45 / 0.12) 0%, transparent 70%)",
          transform: "scale(1.3)",
        }}
      />

      {/* Floating tech badges */}
      <div className="absolute -top-4 -right-6 float-a z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-md text-[11px] font-mono-ui text-text-secondary whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.18_210)]" />
          Flutter
        </span>
      </div>
      <div className="absolute top-1/3 -left-8 float-b z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-md text-[11px] font-mono-ui text-text-secondary whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.15_25)]" />
          Firebase
        </span>
      </div>
      <div className="absolute -bottom-5 right-1/4 float-c z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-md text-[11px] font-mono-ui text-text-secondary whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.18_145)]" />
          Next.js
        </span>
      </div>

      {/* Main blueprint card */}
      <div className="card-enter rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/40">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <span className="ml-1 font-mono-ui text-[11px] text-text-muted">blueprint.json</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.18_145)] animate-pulse" />
            <span className="font-mono-ui text-[10px] text-text-muted">live</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Product + stack */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-mono-ui text-text-muted uppercase tracking-widest mb-1">Product</p>
              <p className="text-[14px] font-semibold text-ink">QuickDeliver</p>
            </div>
            <div>
              <p className="text-[10px] font-mono-ui text-text-muted uppercase tracking-widest mb-1.5">Stack</p>
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono-ui border border-accent/20">Flutter</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono-ui border border-accent/20">Firebase</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono-ui border border-accent/20">Next.js</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Features */}
          <div>
            <p className="text-[10px] font-mono-ui text-text-muted uppercase tracking-widest mb-2">Extracted features</p>
            <div className="space-y-1.5">
              {FEATURES.map((f, i) => (
                <div
                  key={f}
                  className={`flex items-center gap-2 transition-all duration-300 ${
                    i < count ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                  }`}
                >
                  <svg className="h-3.5 w-3.5 text-[oklch(0.55_0.18_145)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[13px] text-text-secondary">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Approve button */}
          <div className={`transition-all duration-500 ${showApprove ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <button className="w-full py-2 rounded-lg bg-accent text-accent-foreground text-[13px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors">
              Approve &amp; Build →
            </button>
          </div>
        </div>
      </div>

      {/* GitHub pushed toast */}
      <div
        className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-[12px] shadow-sm transition-all duration-500 ${
          pushed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <svg className="h-3.5 w-3.5 text-[oklch(0.55_0.18_145)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-ink font-medium">Pushed to GitHub</span>
        <span className="text-text-muted ml-auto font-mono-ui">· just now</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal demo
// ---------------------------------------------------------------------------
const TERMINAL_LINES = [
  "Meeting transcript — product-team-standup.txt",
  "Duration: 43 minutes · 4 speakers",
  "",
  "Forgefy extracted:",
  "",
  "Entities ........... Users, Drivers, Restaurants, Admins",
  "Features ........... Auth, Realtime tracking, Payments,",
  "                     Driver onboarding, Push notifications",
  "Stack .............. Firebase, Flutter, Next.js",
  "Conflicts found .... 1 (payment provider — unresolved)",
  "Action items ....... 3",
  "",
  "─────────────────────────────────────────",
  "Ready to build. Awaiting your approval.",
  "─────────────────────────────────────────",
];

function Terminal() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [typed, setTyped] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setStarted(true); io.disconnect(); } },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let li = 0, ci = 0;
    const buffer: string[] = [];
    const tick = () => {
      if (cancelled) return;
      if (li >= TERMINAL_LINES.length) { setDone(true); return; }
      const line = TERMINAL_LINES[li];
      if (ci === 0) buffer.push("");
      buffer[buffer.length - 1] = line.slice(0, ci + 1);
      setTyped([...buffer]);
      ci++;
      if (ci > line.length) { li++; ci = 0; setTimeout(tick, line === "" ? 40 : 90); }
      else { setTimeout(tick, 8 + Math.random() * 22); }
    };
    tick();
    return () => { cancelled = true; };
  }, [started]);

  return (
    <div ref={ref} className="w-full max-w-[680px]">
      <div className="rounded-xl border border-[#333] bg-[#0f0d0b] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#222]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="ml-3 text-[11px] font-mono-ui text-[#7A6F65]">forgefy ~ build</span>
        </div>
        <pre className="px-5 py-5 text-[13px] leading-[1.7] font-mono-ui text-[#E8DFD3] whitespace-pre overflow-x-auto" style={{ minHeight: 340 }}>
          {typed.map((l, i) => (
            <div key={i} className={i === typed.length - 1 && !done ? "caret" : ""}>{l || " "}</div>
          ))}
        </pre>
        {done && (
          <div className="px-5 pb-5 pt-1 flex gap-3">
            <Link to="/register" className="px-3 py-1.5 text-[12px] font-mono-ui rounded-md bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)] transition-colors">
              ✓ Try it yourself →
            </Link>
            <button className="px-3 py-1.5 text-[12px] font-mono-ui rounded-md border border-[#333] text-[#A89F94]">
              Edit blueprint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const COMPANIES = [
  "Velocity Labs", "NovaBuild", "Arclight Studio", "ByteForge",
  "Pixel & Co", "Launchpad HQ", "Stackwave", "Orbit Digital",
];

const APPS = [
  { name: "QuickDeliver", desc: "Food delivery with real-time driver tracking and push notifications.", stack: "Flutter", hue: 60 },
  { name: "MeetMind", desc: "AI meeting assistant that summarises calls and creates action items.", stack: "Next.js", hue: 200 },
  { name: "ShipTrack", desc: "Logistics dashboard for tracking packages across multiple carriers.", stack: "Next.js", hue: 145 },
  { name: "PocketCoach", desc: "Personalised fitness app with workout plans and progress charts.", stack: "React Native", hue: 300 },
  { name: "TaskFlow", desc: "Project management tool built from a 30-minute team call.", stack: "Next.js", hue: 30 },
  { name: "StoreBase", desc: "E-commerce storefront with inventory and order management.", stack: "Flutter", hue: 250 },
];

const STEPS = [
  { n: "01", title: "Invite Forgefy to your meeting", body: "Add Forgefy to your Zoom, Google Meet, or Teams call. It joins silently, listens, and builds a structured picture of what your team is deciding." },
  { n: "02", title: "It extracts what matters", body: "Features, entities, constraints, and conflicts — extracted in real time. Not a transcript. A proper product blueprint a senior PM would be proud of." },
  { n: "03", title: "Review and approve", body: "Before anything is built you see exactly what Forgefy understood. Edit, approve, or send it back. You stay in control at every step." },
  { n: "04", title: "Your app ships", body: "Flutter for iOS and Android. React Native for cross-platform. Next.js for web. All generated from the same blueprint, pushed to GitHub automatically." },
];

const PLANS = [
  { key: "free", name: "Free", price: 0, tokens: "500k", builds: "~1 build", updates: "~10 updates" },
  { key: "starter", name: "Starter", price: 19, tokens: "5M", builds: "~16 builds", updates: "~100 updates" },
  { key: "pro", name: "Pro", price: 49, tokens: "20M", builds: "~66 builds", updates: "~400 updates", popular: true },
  { key: "team", name: "Team", price: 149, tokens: "75M", builds: "~250 builds", updates: "~1,500 updates" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function Index() {
  const howRef = useReveal<HTMLDivElement>();
  const appsRef = useReveal<HTMLDivElement>();
  const pricingRef = useReveal<HTMLDivElement>();
  const bottomRef = useReveal<HTMLDivElement>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen page-gradient text-ink antialiased">

      {/* ── Nav ── */}
      <header className="h-14 border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
        <div className="h-full max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10">
          <span className="font-display text-[19px] text-ink">Forgefy</span>

          <nav className="hidden md:flex items-center gap-7 text-[13px] text-text-muted">
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#apps" className="hover:text-ink transition-colors">Examples</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <a href="#demo" className="px-3.5 py-1.5 text-[13px] text-text-secondary border border-border rounded-lg hover:border-accent hover:text-ink transition-colors">
              Watch demo
            </a>
            <ThemeToggle />
            <Link to="/login" className="px-3.5 py-1.5 text-[13px] text-text-secondary hover:text-ink transition-colors">
              Log in
            </Link>
            <Link to="/register" className="px-4 py-1.5 text-[13px] font-medium bg-accent text-accent-foreground rounded-lg hover:bg-[oklch(0.55_0.135_45)] transition-colors">
              Get started →
            </Link>
          </div>

          {/* Mobile: theme toggle + burger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button className="text-text-muted hover:text-ink p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/></>}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-3 text-[14px]">
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="block text-text-muted hover:text-ink">How it works</a>
            <a href="#apps" onClick={() => setMobileMenuOpen(false)} className="block text-text-muted hover:text-ink">Examples</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-text-muted hover:text-ink">Pricing</a>
            <div className="pt-2 flex flex-col gap-2 border-t border-border">
              <Link to="/login" className="text-center py-2 border border-border rounded-lg text-text-secondary">Log in</Link>
              <Link to="/register" className="text-center py-2 bg-accent text-accent-foreground rounded-lg font-medium">Get started →</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative px-6 md:px-10 max-w-7xl mx-auto pt-20 pb-28 md:pt-28 md:pb-36 overflow-hidden">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">

          {/* Left: text */}
          <div className="lg:col-span-6 xl:col-span-7">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface text-[12px] text-text-muted mb-8"
              style={{ animation: "hero-rise 500ms ease-out forwards", opacity: 0 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse inline-block" />
              Now live — build your first app free
            </div>

            {/* Headline */}
            <h1 className="font-display font-normal leading-[1.03] tracking-[-0.025em]"
              style={{ fontSize: "clamp(48px, 7.5vw, 88px)" }}>
              <span className="block hero-line" style={{ animationDelay: "80ms" }}>Your meeting</span>
              <span className="block hero-line italic text-text-secondary" style={{ animationDelay: "180ms" }}>just became</span>
              <span className="hero-line inline-block relative" style={{ animationDelay: "280ms" }}>
                <span className="text-accent relative">
                  an app.
                  {/* Wavy underline */}
                  <svg
                    className="absolute left-0 w-full text-accent"
                    style={{ bottom: "-0.18em", height: "0.18em" }}
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path
                      d="M2 9 C28 3 58 12 88 6 C118 0 148 11 175 6 C185 4 193 7 198 6"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                  </svg>
                </span>
              </span>
            </h1>

            <p
              className="mt-8 text-[17px] md:text-[18px] leading-[1.7] text-text-secondary max-w-[520px]"
              style={{ animation: "hero-rise 500ms ease-out forwards 420ms", opacity: 0 }}
            >
              Forgefy joins your planning calls, extracts what your team decided, and ships Flutter, React Native, and Next.js apps — automatically.
            </p>

            {/* CTAs */}
            <div
              className="mt-9 flex flex-col sm:flex-row gap-3"
              style={{ animation: "hero-rise 500ms ease-out forwards 540ms", opacity: 0 }}
            >
              <Link
                to="/register"
                className="sm:w-auto px-7 py-3 rounded-xl bg-accent text-accent-foreground text-[15px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors text-center"
              >
                Get started free →
              </Link>
              <a
                href="#demo"
                className="sm:w-auto px-7 py-3 rounded-xl border border-border text-[15px] text-text-secondary hover:border-accent hover:text-ink transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Watch demo
              </a>
              <Link
                to="/login"
                className="sm:w-auto px-7 py-3 rounded-xl border border-border text-[15px] text-text-secondary hover:text-ink transition-colors text-center"
              >
                Log in
              </Link>
            </div>

            {/* Tech tags */}
            <div
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-text-muted"
              style={{ animation: "hero-rise 500ms ease-out forwards 640ms", opacity: 0 }}
            >
              {["Flutter", "React Native", "Next.js", "GitHub auto-push"].map((t, i, arr) => (
                <span key={t} className="flex items-center gap-5">
                  {t}
                  {i < arr.length - 1 && <span className="h-3 w-px bg-border ml-0" />}
                </span>
              ))}
            </div>
          </div>

          {/* Right: blueprint card */}
          <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
            <BlueprintCard />
          </div>
        </div>
      </section>

      {/* ── Company logos ── */}
      <div className="border-y border-border bg-surface/70 backdrop-blur-sm py-6 px-6 md:px-10">
        <p className="text-center text-[11px] font-medium text-text-muted uppercase tracking-widest mb-5">
          Trusted by teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {COMPANIES.map((name) => (
            <span key={name} className="font-display text-[16px] text-text-muted/50 hover:text-text-muted transition-colors whitespace-nowrap select-none">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Apps built with Forgefy ── */}
      <section id="apps" ref={appsRef} className="px-6 md:px-10 max-w-7xl mx-auto py-24 md:py-32">
        <div className="reveal label-eyebrow mb-3">Built with Forgefy</div>
        <h2 className="reveal font-display text-[32px] md:text-[44px] leading-[1.1] text-ink font-normal max-w-xl">
          Real apps, shipped from real meetings.
        </h2>
        <p className="reveal mt-4 text-[15px] text-text-muted max-w-[480px]">
          These products were described in planning calls and built by Forgefy — no developer needed for the first version.
        </p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {APPS.map((app) => (
            <div key={app.name} className="reveal group rounded-xl border border-border bg-surface hover:border-accent/40 transition-all duration-200 overflow-hidden hover:shadow-md">
              <div
                className="h-28 flex items-center justify-center relative overflow-hidden"
                style={{ background: `oklch(0.93 0.03 ${app.hue})` }}
              >
                <span
                  className="font-display text-[52px] font-light"
                  style={{ color: `oklch(0.70 0.06 ${app.hue})` }}
                >
                  {app.name[0]}
                </span>
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, transparent 60%, oklch(0 0 0 / 0.04))" }} />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-[14px] text-ink">{app.name}</p>
                  <span className="text-[10px] font-mono-ui text-text-muted px-2 py-0.5 rounded-full border border-border bg-background">
                    {app.stack}
                  </span>
                </div>
                <p className="text-[13px] text-text-muted leading-[1.6]">{app.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" ref={howRef} className="bg-surface/75 backdrop-blur-sm border-y border-border px-6 md:px-10 py-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="reveal label-eyebrow mb-3">How it works</div>
          <h2 className="reveal font-display text-[32px] md:text-[44px] leading-[1.1] text-ink font-normal max-w-xl mb-12">
            From call to code in four steps.
          </h2>
          <div className="max-w-3xl">
            {STEPS.map((step, i) => (
              <div key={step.n} className={`reveal grid grid-cols-[52px_1fr] gap-6 py-7 ${i === 0 ? "border-t" : ""} border-b border-border`}>
                <div className="font-mono-ui text-[13px] text-accent pt-0.5">{step.n}</div>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.7] text-text-secondary max-w-[500px]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo terminal ── */}
      <section id="demo" className="bg-[#1A1714] text-[#E8DFD3] py-24 md:py-32">
        <div className="px-6 md:px-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <Terminal />
          </div>
          <div className="md:col-span-5">
            <p className="font-display leading-[0.95] font-light text-[#E8DFD3]"
              style={{ fontSize: "clamp(56px, 8vw, 88px)" }}>
              43min
              <br />
              <span className="text-accent">→</span> 3 apps
            </p>
            <p className="mt-5 text-[14px] text-[#A89F94] max-w-[260px]">
              Average time from meeting end to build-ready code on GitHub.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors"
            >
              Start building free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" ref={pricingRef} className="px-6 md:px-10 max-w-7xl mx-auto py-24 md:py-32">
        <div className="reveal label-eyebrow mb-3">Pricing</div>
        <h2 className="reveal font-display text-[32px] md:text-[44px] leading-[1.1] text-ink font-normal max-w-lg mb-3">
          Pay for what you use. Reset every month.
        </h2>
        <p className="reveal text-[15px] text-text-muted mb-12">
          Token limits reset on the 1st of each month. No hidden fees.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`reveal relative flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-md ${
                plan.popular ? "border-accent bg-accent/5" : "border-border bg-surface"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-medium px-3 py-0.5 rounded-full bg-accent text-accent-foreground whitespace-nowrap">
                  Most popular
                </span>
              )}
              <p className="font-display text-[17px] text-ink">{plan.name}</p>
              <p className="mt-2 font-semibold text-ink" style={{ fontSize: 28 }}>
                {plan.price === 0 ? "Free" : `$${plan.price}`}
                {plan.price > 0 && <span className="text-[14px] font-normal text-text-muted">/mo</span>}
              </p>
              <ul className="mt-5 space-y-2 flex-1 text-[13px] text-text-muted">
                <li><span className="text-ink font-semibold">{plan.tokens}</span> tokens/month</li>
                <li>{plan.builds}</li>
                <li>{plan.updates}</li>
                <li>GitHub auto-push</li>
              </ul>
              <Link
                to="/register"
                className={`mt-6 w-full py-2 rounded-lg text-[13px] font-medium text-center transition-colors block ${
                  plan.popular
                    ? "bg-accent text-accent-foreground hover:bg-[oklch(0.55_0.135_45)]"
                    : "border border-border text-text-secondary hover:border-accent hover:text-ink"
                }`}
              >
                {plan.price === 0 ? "Start free" : "Get started"}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-text-muted text-center">
          Payments via Notchpay — cards, MTN Mobile Money, Orange Money accepted.
        </p>
      </section>

      {/* ── Bottom CTA ── */}
      <section ref={bottomRef} className="bg-[#1A1714] py-24 md:py-32 px-6 md:px-10 text-center">
        <h2 className="reveal font-display font-normal text-[#E8DFD3] max-w-2xl mx-auto leading-[1.08]"
          style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
          Your next meeting could ship your next product.
        </h2>
        <p className="reveal mt-5 text-[15px] text-[#A89F94] max-w-md mx-auto">
          Free to start. No credit card required. First build on us.
        </p>
        <div className="reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent text-accent-foreground text-[15px] font-medium hover:bg-[oklch(0.55_0.135_45)] transition-colors"
          >
            Get started free →
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3 rounded-xl border border-[#3a3633] text-[15px] text-[#A89F94] hover:text-[#E8DFD3] hover:border-[#555] transition-colors text-center"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 text-[12px] text-text-muted">
          <div>
            <span className="font-display text-[16px] text-ink block mb-1">Forgefy</span>
            <span>Your meeting just became an app.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#apps" className="hover:text-ink transition-colors">Examples</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-ink transition-colors">Log in</Link>
            <Link to="/register" className="hover:text-ink transition-colors">Sign up</Link>
          </div>
          <span className="font-mono-ui">© 2025 Forgefy</span>
        </div>
      </footer>
    </main>
  );
}
