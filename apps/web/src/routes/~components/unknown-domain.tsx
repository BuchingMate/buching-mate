import { getPublicSiteOrigin } from "@/lib/public";

// Shown when a hostname reaches the app but no active custom domain matches it
// (e.g. the org removed its domain or it hasn't finished provisioning).
export function UnknownDomain() {
  const mainEventsUrl = `${getPublicSiteOrigin()}/events`;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold">This domain isn't set up</h1>
        <p className="text-muted-foreground">
          No event page is configured for this address. Browse all events at{" "}
          <a href={mainEventsUrl} className="font-medium underline">
            {mainEventsUrl}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
