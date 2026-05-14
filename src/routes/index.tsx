import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Forgefy — Your meeting just became an app." },
      {
        name: "description",
        content:
          "Forgefy joins your planning calls, extracts what your team decided, and builds Flutter, React Native, and Next.js apps simultaneously.",
      },
      { property: "og:title", content: "Forgefy — Your meeting just became an app." },
      {
        property: "og:description",
        content:
          "An AI agent that turns planning meetings into shipped Flutter, React Native, and Next.js apps.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const items = el.querySelectorAll<HTMLElement>(".reveal");
            items.forEach((item, i) => {
              setTimeout(() => item.classList.add("is-visible"), i * 80);
            });
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

const TERMINAL_LINES: string[] = [
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
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let li = 0;
    let ci = 0;
    const buffer: string[] = [];

    const tick = () => {
      if (cancelled) return;
      if (li >= TERMINAL_LINES.length) {
        setDone(true);
        return;
      }
      const line = TERMINAL_LINES[li];
      if (ci === 0) buffer.push("");
      buffer[buffer.length - 1] = line.slice(0, ci + 1);
      setTyped([...buffer]);
      ci++;
      if (ci > line.length) {
        li++;
        ci = 0;
        setTimeout(tick, line === "" ? 40 : 90);
      } else {
        setTimeout(tick, 8 + Math.random() * 22);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [started]);

  return (
    <div ref={ref} className="w-full max-w-[680px]">
      <div className="rounded-lg border border-[#333] bg-[#0f0d0b] overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#222]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" />
          <span className="ml-3 text-[11px] font-mono-ui text-[#7A6F65]">
            forgefy ~ build
          </span>
        </div>
        <pre
          className="px-5 py-5 text-[13px] leading-[1.7] font-mono-ui text-[#E8DFD3] whitespace-pre overflow-x-auto"
          style={{ minHeight: 380 }}
        >
{typed.map((l, i) => {
  const isLast = i === typed.length - 1 && !done;
  return (
    <div key={i} className={isLast ? "caret" : ""}>
      {l || "\u00A0"}
    </div>
  );
})}
        </pre>
        {done && (
          <div className="px-5 pb-5 pt-1 flex gap-3 reveal is-visible">
            <button className="px-3 py-1.5 text-[12px] font-mono-ui rounded-md bg-accent text-accent-foreground">
              ✓ Approve and build
            </button>
            <button className="px-3 py-1.5 text-[12px] font-mono-ui rounded-md border border-[#333] text-[#A89F94]">
              Edit blueprint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type FormState = "idle" | "loading" | "success" | "error";

function WaitlistForm({ variant }: { variant: "card" | "inline" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    const payload =
      variant === "card"
        ? { name: name.trim(), email: email.trim(), role: role || null }
        : { name: email.split("@")[0] || "Builder", email: email.trim(), role: null };
    if (!payload.email || !/^\S+@\S+\.\S+$/.test(payload.email)) {
      setState("error");
      setErrorMsg("Please enter a valid email.");
      return;
    }
    if (variant === "card" && !payload.name) {
      setState("error");
      setErrorMsg("Please enter your name.");
      return;
    }
    const { error } = await supabase.from("waitlist_signups").insert(payload);
    if (error) {
      setState("error");
      setErrorMsg(
        error.code === "23505"
          ? "You're already on the list."
          : "Something went wrong. Try again.",
      );
      return;
    }
    setState("success");
  }

  if (state === "success") {
    return (
      <div
        className={
          variant === "card"
            ? "rounded-xl border border-border bg-warm-white p-8"
            : "py-2"
        }
      >
        <div className="label-eyebrow mb-2">You're in</div>
        <p className="font-display text-[26px] leading-tight text-ink">
          You're on the list.
        </p>
        <p className="mt-2 text-[14px] text-text-secondary">
          We'll be in touch.
        </p>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-border bg-warm-white p-8"
        aria-label="Request early access"
      >
        <div className="label-eyebrow">Request early access</div>
        <p className="mt-2 text-[13px] text-text-secondary">
          Be among the first builders to use Forgefy.
        </p>
        <div className="mt-5 space-y-2.5">
          <input
            aria-label="Your name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full h-10 px-3 rounded-xl bg-warm-white border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
          />
          <input
            aria-label="Your work email"
            type="email"
            placeholder="Your work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            className="w-full h-10 px-3 rounded-xl bg-warm-white border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
          />
          <select
            aria-label="What best describes you?"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-warm-white border border-border text-[14px] text-ink outline-none focus:border-accent transition-colors"
          >
            <option value="">What best describes you?</option>
            <option>Founder / CEO</option>
            <option>Freelance developer</option>
            <option>Agency owner</option>
            <option>Product manager</option>
            <option>Other</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={state === "loading"}
          className="mt-4 w-full h-[42px] rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
        >
          {state === "loading" ? "Joining…" : "Join the waitlist →"}
        </button>
        <p className="mt-3 text-center text-[12px] text-text-muted">
          No spam. Ever. Unsubscribe anytime.
        </p>
        {errorMsg && (
          <p className="mt-2 text-center text-[12px] text-destructive">{errorMsg}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full" aria-label="Secure my spot">
      <input
        aria-label="Your work email"
        type="email"
        placeholder="Your work email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        maxLength={255}
        className="w-full h-11 px-3 rounded-xl bg-warm-white border border-border text-[14px] text-ink placeholder:text-text-muted outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="mt-2.5 w-full h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-medium transition-colors hover:bg-[oklch(0.55_0.135_45)] disabled:opacity-60"
      >
        {state === "loading" ? "Joining…" : "Secure my spot →"}
      </button>
      <p className="mt-3 text-[12px] text-text-muted">
        Joining 847 others. No spam, ever.
      </p>
      {errorMsg && <p className="mt-2 text-[12px] text-destructive">{errorMsg}</p>}
    </form>
  );
}

function Index() {
  const problemRef = useReveal<HTMLDivElement>();
  const howRef = useReveal<HTMLDivElement>();
  const dividerRef = useReveal<HTMLDivElement>();
  const bottomRef = useReveal<HTMLDivElement>();

  return (
    <main className="min-h-screen bg-background text-ink antialiased">
      {/* 01 — top bar */}
      <header className="h-12 border-b border-border">
        <div className="h-full mx-auto flex items-center justify-between px-[6vw] md:px-[8vw]">
          <span className="font-display text-[18px] text-ink">Forgefy</span>
          <span className="font-mono-ui text-[12px] text-text-muted">
            forgefy.dev
          </span>
        </div>
      </header>

      {/* 02 — hero */}
      <section className="px-[6vw] md:pl-[9vw] md:pr-[6vw] min-h-[calc(100vh-48px)] flex items-start md:items-center pt-16 md:pt-0">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-7 md:pt-[8vh]">
            <div className="flex items-center gap-3 label-eyebrow">
              <span className="h-px w-8 bg-text-muted/60" />
              Coming soon
            </div>

            <h1 className="mt-4 font-display text-[44px] md:text-[80px] leading-[1.05] text-ink font-normal tracking-[-0.01em]">
              <span className="block hero-line" style={{ animationDelay: "0ms" }}>
                Your meeting
              </span>
              <span className="block hero-line" style={{ animationDelay: "120ms" }}>
                just became
              </span>
              <span className="block hero-line" style={{ animationDelay: "240ms" }}>
                an app.
              </span>
            </h1>

            <p className="mt-7 text-[17px] leading-[1.65] text-text-secondary max-w-[480px]">
              Forgefy joins your planning calls, extracts what your team actually
              decided, and builds Flutter, React Native, and Next.js apps —
              simultaneously.
            </p>

            <div className="mt-10 flex items-center gap-4 text-[12px] text-text-muted">
              <span>Flutter</span>
              <span className="h-3 w-px bg-border" />
              <span>React Native</span>
              <span className="h-3 w-px bg-border" />
              <span>Next.js</span>
            </div>
          </div>

          <div className="md:col-span-5 flex md:items-center">
            <div className="w-full">
              <WaitlistForm variant="card" />
              <div className="mt-5 flex items-center gap-2 text-[12px] text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />
                847 builders already waiting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 — pull quote divider */}
      <div
        ref={dividerRef}
        className="border-y border-border bg-surface py-5 px-6"
      >
        <p className="reveal text-center font-display italic text-[18px] md:text-[22px] leading-snug text-text-secondary">
          “From messy discussion to shipped product — in the time it takes to end the call.”
        </p>
      </div>

      {/* 04 — the problem */}
      <section
        ref={problemRef}
        className="px-[6vw] md:pl-[9vw] md:pr-[6vw] py-28 md:py-36"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-5">
            <div className="reveal label-eyebrow">01 — The problem</div>
            <h2 className="reveal mt-6 font-display text-[36px] md:text-[52px] leading-[1.1] text-accent font-normal">
              <span className="block">6 months.</span>
              <span className="block">3 codebases.</span>
              <span className="block">1 broken team.</span>
            </h2>
          </div>
          <div className="md:col-span-7">
            <div className="max-w-[480px] space-y-6 text-[15px] leading-[1.75] text-text-secondary">
              <p className="reveal">
                Building for iOS, Android, and web means three separate teams,
                three separate timelines, and a budget that kills most products
                before a single user sees them.
              </p>
              <p className="reveal">
                Every planning meeting produces great ideas and zero code. The
                whiteboard fills up. The notes app fills up. The product stays
                empty. Forgefy fixes that.
              </p>
              <div className="reveal pt-4 border-t border-border">
                <p className="text-[14px] font-medium text-accent">
                  Forgefy was built for this exact problem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — how it works */}
      <section
        ref={howRef}
        className="px-[6vw] md:pl-[9vw] md:pr-[6vw] pb-28 md:pb-36"
      >
        <div className="reveal label-eyebrow">02 — How it works</div>
        <div className="mt-10 max-w-[820px]">
          {[
            {
              n: "01",
              title: "Invite Forgefy to your meeting",
              body: "Add Forgefy to your Zoom, Google Meet, or Teams call. It joins silently, listens, and begins building a picture of what your team is actually deciding.",
            },
            {
              n: "02",
              title: "It extracts what matters",
              body: "Forgefy identifies features, entities, constraints, and conflicts in real time. Not a transcript. A structured product blueprint — the kind a senior PM would write after the meeting.",
            },
            {
              n: "03",
              title: "Review the blueprint",
              body: "Before anything is built, you see exactly what Forgefy understood. Edit it, approve it, or send it back. You stay in control.",
            },
            {
              n: "04",
              title: "Three apps, simultaneously",
              body: "Flutter for iOS and Android. React Native for cross-platform. Next.js for web. All three generated at once, from the same blueprint, in under 60 seconds.",
            },
          ].map((step, i) => (
            <div
              key={step.n}
              className={`reveal grid grid-cols-[44px_1fr] md:grid-cols-[64px_1fr] gap-6 py-8 ${
                i === 0 ? "border-t" : ""
              } border-b border-border`}
            >
              <div className="font-mono-ui text-[13px] text-accent pt-1">
                {step.n}
              </div>
              <div>
                <h3 className="text-[18px] font-medium text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.7] text-text-secondary max-w-[520px]">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 06 — terminal moment */}
      <section className="bg-[#1A1714] text-[#E8DFD3] py-24 md:py-32">
        <div className="px-[6vw] md:pl-[9vw] md:pr-[6vw] grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <Terminal />
          </div>
          <div className="md:col-span-5">
            <p className="font-display text-[64px] md:text-[96px] leading-[0.95] font-light text-[#E8DFD3]">
              43min
              <br />
              <span className="text-accent">→</span> 3 apps
            </p>
            <p className="mt-6 text-[13px] text-[#A89F94] max-w-[280px]">
              average time from meeting to build-ready
            </p>
          </div>
        </div>
      </section>

      {/* 07 — second waitlist */}
      <section
        ref={bottomRef}
        className="bg-surface py-28 md:py-36 px-[6vw] md:pl-[9vw] md:pr-[6vw]"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-7">
            <h2 className="reveal font-display text-[36px] md:text-[44px] leading-[1.1] text-ink font-normal">
              The waitlist
              <br />
              is open.
            </h2>
            <p className="reveal mt-5 text-[15px] leading-[1.7] text-text-secondary max-w-[480px]">
              We're onboarding the first 500 builders in Q3 2025. Early access
              includes direct contact with the founding team and influence over
              the roadmap.
            </p>
            <ul className="reveal mt-6 space-y-2 text-[14px] text-text-secondary">
              <li>— Free during beta</li>
              <li>— Export your code, own it forever</li>
              <li>— Priority access to Meeting Mode on launch</li>
            </ul>
          </div>
          <div className="md:col-span-5 md:pt-3">
            <div className="reveal">
              <WaitlistForm variant="inline" />
            </div>
          </div>
        </div>
      </section>

      {/* 08 — footer */}
      <footer className="border-t border-border bg-background">
        <div className="px-[6vw] md:px-[8vw] py-6 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:justify-between text-[12px] text-text-muted">
          <span>Forgefy © 2025</span>
          <span className="font-mono-ui">
            forgefy.dev · Privacy · Twitter/X
          </span>
        </div>
      </footer>
    </main>
  );
}
