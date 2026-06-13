import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Code2, Terminal } from "lucide-react";
import {
  BROADCAST_TIERS,
  FREE_SEAT_CAP,
  FREE_WEEKLY_SENDS,
  type PlanPricing,
  TEAM_BENEFITS,
  TEAM_INCLUDED_SEATS,
} from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicPricingQueryOptions } from "@/queries/public";
import { MarketingFooter, MarketingHeader } from "./marketing-chrome";

type Interval = "monthly" | "annual";

const REPO_URL = "https://github.com/peteqian/booking-mate";
const SELF_HOST_GUIDE_URL = `${REPO_URL}/tree/main/examples/self-host`;

// cents → "$50" (drop cents when whole, else "$50.50").
function money(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function PricingPage() {
  const { data: pricing } = useSuspenseQuery(publicPricingQueryOptions);
  const [interval, setInterval] = useState<Interval>("monthly");

  const team = interval === "annual" ? pricing.annual : pricing.monthly;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-20">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing that scales with you
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free, upgrade when your team grows. No setup fees, cancel anytime.
          </p>
        </header>

        <IntervalToggle
          interval={interval}
          setInterval={setInterval}
          hasAnnual={!!pricing.annual}
        />

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          <FreeCard />
          <TeamCard team={team} interval={interval} />
          <EnterpriseCard />
        </div>

        <SelfHostBand />

        <BroadcastAddOns />
      </main>
      <MarketingFooter />
    </div>
  );
}

function IntervalToggle({
  interval,
  setInterval,
  hasAnnual,
}: {
  interval: Interval;
  setInterval: (i: Interval) => void;
  hasAnnual: boolean;
}) {
  if (!hasAnnual) return <div className="mt-10" />;
  return (
    <div className="mt-10 flex justify-center">
      <div className="inline-flex rounded-full border border-border bg-muted/40 p-1 text-sm">
        {(["monthly", "annual"] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium capitalize transition-colors",
              interval === i
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i}
            {i === "annual" ? <span className="ml-1.5 text-xs text-primary">Save</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  highlight,
  children,
}: {
  name: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-7",
        highlight
          ? "border-primary shadow-lg shadow-primary/5 ring-1 ring-primary"
          : "border-border",
      )}
    >
      {highlight ? (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      ) : null}
      <h2 className="font-heading text-lg font-semibold tracking-tight">{name}</h2>
      {children}
    </div>
  );
}

function BenefitList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3 text-sm">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">{b}</span>
        </li>
      ))}
    </ul>
  );
}

function FreeCard() {
  return (
    <PlanCard name="Free">
      <p className="mt-2 text-sm text-muted-foreground">For trying things out and small teams.</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-heading text-4xl font-semibold tracking-tight">$0</span>
        <span className="text-sm text-muted-foreground">/ month</span>
      </div>
      <Button
        className="mt-6 w-full"
        variant="outline"
        nativeButton={false}
        render={<Link to="/signup" />}
      >
        Start free
      </Button>
      <BenefitList
        items={[
          `Up to ${FREE_SEAT_CAP} admin seats`,
          "Unlimited managers & viewers",
          "Unlimited events & registrations",
          "Payments via Stripe Connect",
          `${FREE_WEEKLY_SENDS.toLocaleString("en-US")} broadcast sends per week`,
          "Publish to the shared events feed",
        ]}
      />
    </PlanCard>
  );
}

function TeamCard({ team, interval }: { team: PlanPricing | null; interval: Interval }) {
  return (
    <PlanCard name="Team" highlight>
      <p className="mt-2 text-sm text-muted-foreground">For organizers running events at scale.</p>

      <div className="mt-5 flex items-baseline gap-1">
        {team ? (
          <>
            <span className="font-heading text-4xl font-semibold tracking-tight">
              {money(team.basePriceCents)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {interval === "annual" ? "year" : "month"}
            </span>
          </>
        ) : (
          <span className="font-heading text-3xl font-semibold tracking-tight">
            Flexible pricing
          </span>
        )}
      </div>
      <p className="mt-1 h-5 text-xs text-muted-foreground">
        {team
          ? `Includes ${team.includedSeats} seats · ${money(team.extraSeatPriceCents)} per extra seat`
          : "Talk to us for current rates"}
      </p>

      <Button className="mt-6 w-full" nativeButton={false} render={<Link to="/signup" />}>
        Get started
        <ArrowRight className="size-4" />
      </Button>
      <BenefitList
        items={[`${TEAM_INCLUDED_SEATS} admin seats included`, ...TEAM_BENEFITS.slice(1)]}
      />
    </PlanCard>
  );
}

function EnterpriseCard() {
  return (
    <PlanCard name="Enterprise">
      <p className="mt-2 text-sm text-muted-foreground">For larger orgs with custom needs.</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-heading text-4xl font-semibold tracking-tight">Custom</span>
      </div>
      <p className="mt-1 h-5 text-xs text-muted-foreground">Contracted seats & send limits</p>
      <Button
        className="mt-6 w-full"
        variant="outline"
        nativeButton={false}
        render={<Link to="/signup" />}
      >
        Contact sales
      </Button>
      <BenefitList
        items={[
          "Everything in Team",
          "Contracted admin seats",
          "Unlimited broadcast sends",
          "Priority support",
          "Custom onboarding",
        ]}
      />
    </PlanCard>
  );
}

function SelfHostBand() {
  const points = [
    "Free & open source",
    "One-host Docker Compose deploy",
    "Your own database — full data ownership",
    "No per-seat fees",
  ];
  return (
    <section className="mt-20 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Code2 className="size-3.5 text-primary" />
            Open source
          </span>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Prefer to run it yourself?
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Self-host on your own infrastructure with Docker. You keep full control of your data and
            pay nothing for the software — bring your own server and Postgres.
          </p>

          <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              render={<a href={SELF_HOST_GUIDE_URL} target="_blank" rel="noreferrer" />}
            >
              Self-host guide
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={REPO_URL} target="_blank" rel="noreferrer" />}
            >
              <Code2 className="size-4" />
              View source
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-foreground/95 p-5 font-mono text-xs text-background/90 shadow-sm">
          <div className="mb-3 flex items-center gap-1.5 text-background/50">
            <Terminal className="size-3.5" />
            <span>deploy in minutes</span>
          </div>
          <pre className="overflow-x-auto leading-relaxed">
            <code>
              {`cp .env.example .env
# set BETTER_AUTH_SECRET + POSTGRES_PASSWORD
docker compose pull
docker compose up -d

# → http://localhost:5678`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function BroadcastAddOns() {
  return (
    <section className="mt-20 rounded-2xl border border-border bg-muted/20 p-7 sm:p-10">
      <div className="max-w-2xl">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Need to send more email?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every plan includes a weekly broadcast allowance. Sending to your own event guests is
          always free — add capacity when your newsletters grow.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BROADCAST_TIERS.map((tier) => (
          <div key={tier.slug} className="rounded-xl border border-border bg-card p-4 text-center">
            <div className="font-heading text-xl font-semibold tracking-tight">
              {(tier.weeklyCap / 1000).toLocaleString("en-US")}k
            </div>
            <div className="text-xs text-muted-foreground">sends / week</div>
            <div className="mt-2 text-sm font-medium text-primary">
              {money(tier.monthlyPriceCents)}
              <span className="text-muted-foreground">/mo</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
