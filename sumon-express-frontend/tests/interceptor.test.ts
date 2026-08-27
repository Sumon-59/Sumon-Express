// Tests for the auth engine seam: the axios interceptors in lib/api.ts.
//
// We mock the HTTP layer (axios "adapters") — no real server. The api
// instance's adapter plays the backend for normal calls; the global
// axios adapter plays the refresh endpoint (lib/api.ts deliberately
// calls refresh with plain axios so it is never intercepted itself).

import { describe, it, expect, beforeEach, vi } from "vitest";
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api, setAccessToken, getAccessToken, setOnAuthFailure } from "@/lib/api";

type Config = InternalAxiosRequestConfig;

// A faithful fake adapter: like axios's real adapters, it REJECTS with
// an AxiosError for non-2xx statuses (that judgment is the adapter's
// job, not axios core's) — otherwise the error interceptor never runs.
const respond = (config: Config, status: number, data: unknown): Promise<AxiosResponse> => {
  const response: AxiosResponse = {
    config,
    status,
    statusText: String(status),
    headers: {},
    data,
  };
  if (status >= 200 && status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      String(status),
      config,
      null,
      response
    )
  );
};

const authHeaderOf = (config: Config): string | undefined => {
  const value = config.headers?.Authorization;
  return typeof value === "string" ? value : undefined;
};

beforeEach(() => {
  setAccessToken(null);
  setOnAuthFailure(null);
});

describe("api auth interceptors", () => {
  it("on 401: refreshes once, retries with the new token, succeeds", async () => {
    let apiCalls = 0;
    api.defaults.adapter = async (config: Config) => {
      apiCalls++;
      // The backend accepts only the fresh token:
      if (authHeaderOf(config) === "Bearer fresh-token") {
        return respond(config, 200, { ok: true });
      }
      return respond(config, 401, { message: "Not authorized" });
    };

    const refresh = vi.fn(async (config: Config) =>
      respond(config, 200, { accessToken: "fresh-token" })
    );
    axios.defaults.adapter = refresh;

    setAccessToken("stale-token");
    const res = await api.get("/orders/my-orders");

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("fresh-token");
    // original attempt + one retry, no more:
    expect(apiCalls).toBe(2);
  });

  it("when refresh fails: signals logout and rejects the original request", async () => {
    api.defaults.adapter = async (config: Config) =>
      respond(config, 401, { message: "Not authorized" });
    axios.defaults.adapter = async (config: Config) =>
      respond(config, 401, { message: "Not authorized" });

    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    setAccessToken("stale-token");

    await expect(api.get("/orders/my-orders")).rejects.toThrow();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("N concurrent 401s share exactly ONE refresh call (single-flight)", async () => {
    api.defaults.adapter = async (config: Config) => {
      if (authHeaderOf(config) === "Bearer fresh-token") {
        return respond(config, 200, { ok: true });
      }
      return respond(config, 401, { message: "Not authorized" });
    };

    let refreshCalls = 0;
    axios.defaults.adapter = async (config: Config) => {
      refreshCalls++;
      // Slow refresh, so all three 401s are in flight before it resolves:
      await new Promise((r) => setTimeout(r, 25));
      return respond(config, 200, { accessToken: "fresh-token" });
    };

    setAccessToken("stale-token");
    const results = await Promise.all([
      api.get("/a"),
      api.get("/b"),
      api.get("/c"),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it("a TRANSIENT refresh failure (5xx / cold start) does NOT log the user out", async () => {
    api.defaults.adapter = async (config: Config) =>
      respond(config, 401, { message: "Not authorized" });
    // The refresh endpoint is down / cold-starting — not a revoked session:
    axios.defaults.adapter = async (config: Config) =>
      respond(config, 503, { message: "Service unavailable" });

    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    setAccessToken("stale-token");

    await expect(api.get("/orders/my-orders")).rejects.toThrow();
    expect(onFail).not.toHaveBeenCalled();
  });

  it("a 401 from login is a real answer — no refresh attempt", async () => {
    api.defaults.adapter = async (config: Config) =>
      respond(config, 401, { message: "Invalid credentials" });

    const refresh = vi.fn();
    axios.defaults.adapter = refresh;

    await expect(api.post("/auth/login", { email: "x", password: "y" })).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });
});
