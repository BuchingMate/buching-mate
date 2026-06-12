import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { BUSINESS_NAME } from "@/lib/branding";
import { attendeeSessionQueryOptions } from "@/queries/auth";

// Main-domain header for the public events surface. Quiet by design: the
// events are the page, the chrome stays out of the way. `width` matches the
// page's content column so the wordmark lines up with it.
export function PlatformBrandBar({ width = "narrow" }: { width?: "narrow" | "wide" }) {
  return (
    <header className="bg-background">
      <div
        className={`mx-auto flex items-center justify-between px-6 py-5 ${
          width === "wide" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <Link
          to="/events"
          className="font-heading text-base font-semibold tracking-tight text-foreground hover:opacity-80"
        >
          {BUSINESS_NAME}
        </Link>
        <AttendeeAuthSlot />
      </div>
    </header>
  );
}

function AttendeeAuthSlot() {
  const { data: session, isPending } = useQuery(attendeeSessionQueryOptions);

  if (isPending) {
    return <span className="text-sm text-muted-foreground/60">…</span>;
  }

  if (session) {
    return (
      <Link
        to="/me"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <UserRound className="size-3.5" />
        <span className="hidden max-w-[160px] truncate sm:inline">{session.user.email}</span>
        <span className="sm:hidden">Account</span>
      </Link>
    );
  }

  return (
    <Link
      to="/login"
      search={{ as: "attendee" }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <UserRound className="size-3.5" />
      Sign in
    </Link>
  );
}
