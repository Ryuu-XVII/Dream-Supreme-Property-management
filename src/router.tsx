import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Without a default staleTime, every query is considered stale the instant it
// lands, so every route navigation, tab focus, or hover-preload refetches
// data that may be seconds old. 30s keeps the app feeling live (deals,
// notifications, etc. still refresh routinely) while cutting out redundant
// re-fetches on quick back-and-forth navigation.
const DEFAULT_STALE_TIME_MS = 30_000;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: DEFAULT_STALE_TIME_MS,
  });

  return router;
};
