import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The one door to the server. Components never call this directly — the
 * hooks in src/api/ wrap it so every request gets react-query's caching,
 * retry and offline behaviour.
 *
 * Auth is invisible: on first use the app silently creates an anonymous
 * device account, keeps the refresh token in the Keychain, and transparently
 * refreshes a stale access token on the first 401. The user never sees a
 * login wall — Sign in with Apple is an upgrade, not an entry fee.
 */
/**
 * Defaults to the deployed API so scanning the Expo Go QR code Just Works
 * on a real phone — `localhost` there means the phone itself, which is the
 * classic "why is my app not loading" afternoon. Point at a local server
 * with EXPO_PUBLIC_API_URL (use your machine's LAN IP, not localhost, if
 * you're testing on a device).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://boot-sale-buddy-api.fly.dev";

const ACCESS_KEY = "bsb.accessToken";
const REFRESH_KEY = "bsb.refreshToken";

/**
 * Nothing waits forever.
 *
 * A scan is the slow one: identifying the item, then a live web search for
 * what it goes for, which can legitimately run half a minute. But without a
 * ceiling a request that never answers leaves the result sheet shimmering
 * indefinitely, and a skeleton that never resolves is indistinguishable from
 * a broken app — the exact failure this codebase keeps trying to avoid.
 * Sixty seconds is well clear of the honest worst case and well inside
 * anyone's patience.
 */
const REQUEST_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** SecureStore (Keychain) where available; AsyncStorage on web. */
const store = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Out of scans — the UI shows the paywall rather than an error. */
  get isQuota(): boolean {
    return this.code === "quota_exceeded";
  }

  /** Nothing reached the server: no signal, airplane mode, server down. */
  get isOffline(): boolean {
    return this.code === "offline";
  }
}

type Session = { accessToken: string; refreshToken: string };

let accessToken: string | null = null;
// Collapses concurrent cold starts into one anonymous signup.
let sessionPromise: Promise<string> | null = null;

async function createAnonymousSession(): Promise<string> {
  const res = await fetch(`${API_URL}/v1/auth/anonymous`, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, "signup_failed", "Couldn't set up your account.");
  const session = (await res.json()) as Session;
  await store.set(REFRESH_KEY, session.refreshToken);
  await store.set(ACCESS_KEY, session.accessToken);
  accessToken = session.accessToken;
  return session.accessToken;
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = await store.get(REFRESH_KEY);
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    // Refresh token rejected (expired, or rotated-family burned) — start over.
    await store.remove(REFRESH_KEY);
    await store.remove(ACCESS_KEY);
    return null;
  }
  const session = (await res.json()) as Session;
  await store.set(REFRESH_KEY, session.refreshToken);
  await store.set(ACCESS_KEY, session.accessToken);
  accessToken = session.accessToken;
  return session.accessToken;
}

async function ensureAccessToken(): Promise<string> {
  if (accessToken) return accessToken;
  sessionPromise ??= (async () => {
    const stored = await store.get(ACCESS_KEY);
    if (stored) {
      accessToken = stored;
      return stored;
    }
    return (await refreshSession()) ?? (await createAnonymousSession());
  })().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

/**
 * Authenticated JSON request. Retries exactly once after re-authenticating,
 * so an expired access token is invisible to the caller.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { retryOnAuthFailure?: boolean } = {},
): Promise<T> {
  const { retryOnAuthFailure = true, ...requestInit } = init;
  const token = await ensureAccessToken();

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}${path}`, {
      ...requestInit,
      headers: {
        ...(requestInit.body ? { "content-type": "application/json" } : {}),
        ...requestInit.headers,
        authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw (error as Error)?.name === "AbortError"
      ? new ApiError(0, "timeout", "That took too long. Give it another go?")
      : new ApiError(0, "offline", "Couldn't reach the shops. Check your signal?");
  }

  if (res.status === 401 && retryOnAuthFailure) {
    accessToken = null;
    const fresh = (await refreshSession()) ?? (await createAnonymousSession());
    if (fresh) {
      return apiFetch<T>(path, { ...init, retryOnAuthFailure: false });
    }
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? "Something went wrong. Try again?",
      body,
    );
  }
  return body as T;
}

/**
 * Same auth handling as apiFetch, but for endpoints that return something
 * other than JSON (the CSV export). Kept separate rather than adding a flag
 * so the common path stays typed as JSON.
 */
export async function apiFetchText(path: string): Promise<string> {
  const token = await ensureAccessToken();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (error) {
    throw (error as Error)?.name === "AbortError"
      ? new ApiError(0, "timeout", "That took too long. Give it another go?")
      : new ApiError(0, "offline", "Couldn't reach the shops. Check your signal?");
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? "Something went wrong. Try again?",
    );
  }
  return res.text();
}

/**
 * Adopt a session issued by another flow (Sign in with Apple). Replaces the
 * anonymous one in place, so the app carries straight on with the same
 * account the server just linked.
 */
export async function setSession(access: string, refresh: string): Promise<void> {
  await store.set(ACCESS_KEY, access);
  await store.set(REFRESH_KEY, refresh);
  accessToken = access;
}

/** The current access token, for flows that must present it themselves. */
export async function currentAccessToken(): Promise<string | null> {
  try {
    return await ensureAccessToken();
  } catch {
    return null;
  }
}

/** Settings → Delete account, and the dev menu's "reset device account". */
export async function clearSession(): Promise<void> {
  accessToken = null;
  await store.remove(ACCESS_KEY);
  await store.remove(REFRESH_KEY);
}
