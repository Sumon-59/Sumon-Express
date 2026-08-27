import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send the httpOnly refresh cookie
});

// ---------------------------------------------------------------
// The access token lives in MEMORY ONLY — a module-level variable.
// Never localStorage (XSS can read storage; it cannot enumerate a
// closed-over variable). Page reload = token gone = we refresh.
// ---------------------------------------------------------------
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

// AuthContext registers this: called when a refresh definitively fails,
// meaning the session is over (logout the UI).
let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (fn: (() => void) | null): void => {
  onAuthFailure = fn;
};

// Request interceptor: attach the Bearer header to every call.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ---------------------------------------------------------------
// Single-flight refresh: if five requests fail with 401 at once,
// they must all await ONE refresh call, not five. The shared promise
// is the whole trick.
// ---------------------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    // Plain axios (not `api`): the refresh call itself must never be
    // intercepted, or a failing refresh would try to refresh, forever.
    refreshPromise = axios
      .get(`${BASE_URL}/auth/refresh`, { withCredentials: true })
      .then((res) => {
        const token: string | null = res.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .catch((err) => {
        const status = err?.response?.status;
        // 401/403 = the cookie is truly dead: session over.
        if (status === 401 || status === 403) {
          setAccessToken(null);
          return null;
        }
        // Network blip / 5xx / server cold start: NOT a logout — let
        // the caller fail this one request and try again later.
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Auth endpoints where a 401 is a real answer, not an expired token.
const NO_RETRY_URLS = ["/auth/login", "/auth/register", "/auth/refresh"];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Response interceptor: on 401 — refresh once, retry once, then give up.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";

    const shouldTryRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !NO_RETRY_URLS.some((u) => url.endsWith(u));

    if (shouldTryRefresh) {
      original._retried = true;
      let token: string | null = null;
      let transient = false;
      try {
        token = await refreshAccessToken();
      } catch {
        transient = true; // refresh couldn't run — not a revoked session
      }
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      if (!transient) {
        onAuthFailure?.();
      }
    }

    return Promise.reject(error);
  }
);
