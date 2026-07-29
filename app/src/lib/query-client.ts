import { onlineManager, QueryClient } from "@tanstack/react-query";

import { API_URL } from "./api";

/**
 * One client for all server data. Components never call fetch directly —
 * API hooks (Phase 3+) sit on top of this and inherit retry, caching and
 * offline behaviour. Boot sales have terrible signal; the cache is the app.
 */
/**
 * Teach react-query how to tell if we're online. Its default listener is
 * built on browser events that never fire in React Native, so without this
 * it assumes we're always connected — and both the offline banner and
 * refetch-on-reconnect would be dead code.
 *
 * A HEAD request to our own health endpoint is the honest test: what
 * matters is whether the API is reachable, not whether wifi is associated.
 */
onlineManager.setEventListener((setOnline) => {
  let cancelled = false;

  const check = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_URL}/healthz`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!cancelled) setOnline(res.ok);
    } catch {
      if (!cancelled) setOnline(false);
    }
  };

  void check();
  const interval = setInterval(() => void check(), 20_000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
});

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
