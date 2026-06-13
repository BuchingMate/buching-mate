import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Globe,
  Mail,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { BUSINESS_NAME } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { MarketingFooter, MarketingHeader } from "./marketing-chrome";

// Main-domain marketing home. Always rendered at `/` on the main domain (org
// custom domains redirect their root to the events feed instead).
export function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_-10%,oklch(0.62_0.21_38.4/0.12),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Events, registrations & payments in one place
          </span>

          <h1 className="mt-5 font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Run events people
            <br />
            actually show up to.
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {BUSINESS_NAME} gives every organizer a polished event page, painless registration, and
            built-in payments — so you can fill seats instead of wrangling spreadsheets.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link to="/signup" />}>
              Start free
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg" nativeButton={false} render={<Link to="/events" />}>
              Browse live events
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No card required · Up to 3 organizers on the free plan
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

// A lightweight, on-brand product mock — no external image asset needed.
function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-primary/5 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/60" />
          <span className="ml-3 truncate text-xs text-muted-foreground">
            yourbrand.events/ceramics-night
          </span>
        </div>

        <div className="aspect-[16/9] bg-gradient-to-br from-primary/80 via-primary/55 to-primary/35" />

        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary">
                Workshop
              </div>
              <h3 className="mt-2 font-heading text-lg font-semibold tracking-tight">
                Hand-Building Ceramics Night
              </h3>
              <p className="text-sm text-muted-foreground">Thu, Jun 18 · 6:30 PM · Studio 4</p>
            </div>
            <div className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-center text-background">
              <div className="text-[10px] uppercase tracking-wide opacity-70">From</div>
              <div className="text-sm font-semibold">$45</div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {["bg-primary/30", "bg-info/30", "bg-success/30", "bg-warning/40"].map((c, i) => (
                <span key={i} className={`size-7 rounded-full border-2 border-card ${c}`} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">28 going · 4 spots left</span>
          </div>

          <div className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            Reserve a seat
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const stats = [
    { value: "5 min", label: "to your first event page" },
    { value: "0%", label: "platform fee on the free plan" },
    { value: "1 link", label: "to share, register & pay" },
  ];
  return (
    <section className="border-y border-border/60 bg-muted/20">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <div className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Beautiful event pages",
    body: "Every event gets a fast, shareable page with images, location, and a clear call to action — no design work needed.",
  },
  {
    icon: UserRoundCheck,
    title: "Registration & approval",
    body: "Collect sign-ups, cap capacity, and gate spots behind reviewer approval when an event needs a closer look.",
  },
  {
    icon: CreditCard,
    title: "Payments built in",
    body: "Take payment at checkout with Stripe Connect. Money lands in your own connected account, not ours.",
  },
  {
    icon: Mail,
    title: "Email that does the work",
    body: "Confirmations, reminders, and cancellations go out automatically — with add-to-calendar and manage links baked in.",
  },
  {
    icon: CalendarDays,
    title: "Calendar subscriptions",
    body: "Attendees subscribe once and every new event from you shows up in their calendar, always in sync.",
  },
  {
    icon: Globe,
    title: "Your own domain",
    body: "Publish to the shared feed or bring a custom domain so the whole experience lives under your brand.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <div className="max-w-2xl">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything you need to fill the room
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          From the first invite to the final headcount, {BUSINESS_NAME} handles the busywork so you
          can focus on the event itself.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Create your event",
    body: "Add the details, set a price and capacity, and pick whether sign-ups need approval. Publish in minutes.",
  },
  {
    title: "Share one link",
    body: "Drop your event link anywhere. Attendees register, pay, and get a calendar invite without leaving the page.",
  },
  {
    title: "Show up prepared",
    body: "Track registrations live, message attendees, and walk in knowing exactly who's coming.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Live in three steps
        </h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-background font-heading text-sm font-semibold text-primary">
                {i + 1}
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  const points = ["Free for up to 3 organizers", "No setup fees", "Cancel anytime"];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-14 text-primary-foreground sm:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next event is one link away
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            Spin up a page, open registrations, and start taking payments today.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              nativeButton={false}
              render={<Link to="/signup" />}
            >
              Start free
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              nativeButton={false}
              render={<Link to="/events" />}
            >
              Browse events
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/85">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
