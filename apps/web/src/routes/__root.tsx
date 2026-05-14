import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { makeAppHead } from "@/lib/seo";
import { ApiError } from "@/lib/api";
import { BUSINESS_NAME } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { getPublicOrigin } from "@/lib/public";
import appCss from "@/styles/globals.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem('theme');
    const theme = stored || 'system';
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {}
})();
`;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => {
    const seo = makeAppHead({
      title: BUSINESS_NAME,
      siteName: BUSINESS_NAME,
      baseUrl: getPublicOrigin(),
      path: "/",
    });

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...seo.meta,
      ],
      links: [...seo.links, { rel: "stylesheet", href: appCss }],
      scripts: [{ children: themeInitScript }],
    };
  },
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const userMessage =
      error instanceof ApiError
        ? error.message
        : "An unexpected error occurred. Please try again, or contact support if it keeps happening.";
    if (!(error instanceof ApiError) && import.meta.env.DEV) {
      console.error("[root errorComponent]", error);
    }
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{userMessage}</p>
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    );
  },
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
