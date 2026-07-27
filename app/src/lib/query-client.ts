import { QueryClient } from "@tanstack/react-query";

/**
 * One client for all server data. Components never call fetch directly —
 * API hooks (Phase 3+) sit on top of this and inherit retry, caching and
 * offline behaviour. Boot sales have terrible signal; the cache is the app.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
