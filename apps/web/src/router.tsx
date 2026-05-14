import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { ThemeProvider } from "@/components/theme-provider";
import { setUnauthorizedHandler } from "@/lib/api";
import { authKeys } from "@/queries/auth";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof Error && "status" in error) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <HotkeysProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </HotkeysProvider>
        {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    ),
  });

  setUnauthorizedHandler(() => {
    queryClient.setQueryData(authKeys.session, null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      router.navigate({ to: "/login" });
    }
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
