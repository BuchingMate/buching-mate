import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { BUSINESS_NAME } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/queries/auth";

// Shared header/footer for the public marketing surfaces (landing, pricing).
// Nav uses `to="/"` + hash so the anchors work from any marketing page.
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          <img src="/logo-mark.svg" alt="" className="size-7 rounded-md" />
          {BUSINESS_NAME}
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link to="/" hash="features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link to="/" hash="how" className="transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/events" className="transition-colors hover:text-foreground">
            Browse events
          </Link>
        </nav>

        <HeaderActions />
      </div>
    </header>
  );
}

function HeaderActions() {
  const { data: session } = useQuery(sessionQueryOptions);

  if (session) {
    return (
      <Button size="sm" nativeButton={false} render={<Link to="/admin" />}>
        Dashboard
        <ArrowRight className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
        nativeButton={false}
        render={<Link to="/login" />}
      >
        Sign in
      </Button>
      <Button size="sm" nativeButton={false} render={<Link to="/signup" />}>
        Get started
      </Button>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <img src="/logo-mark.svg" alt="" className="size-5 rounded" />
          <span className="font-heading font-semibold text-foreground">{BUSINESS_NAME}</span>
          <span>· Event booking & registration</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/events" className="transition-colors hover:text-foreground">
            Events
          </Link>
          <Link to="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link to="/signup" className="transition-colors hover:text-foreground">
            Get started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
