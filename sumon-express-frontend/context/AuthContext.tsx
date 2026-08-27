"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  api,
  setAccessToken,
  refreshAccessToken,
  setOnAuthFailure,
} from "@/lib/api";

/**
 * Minimal user shape used by the frontend.
 */
type User = {
  _id: string;
  email: string;
  role: "user" | "admin";
  name?: string;
};

type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

/**
 * Auth context contract: what the app can access from anywhere.
 * (Same public surface as before Slice 1 — the engine underneath is
 * now the canonical JWT pattern: in-memory access token + refresh.)
 */
type AuthContextType = {
  user: User | null;
  loading: boolean;

  /** Re-check session from backend (refresh → me). */
  checkAuth: () => Promise<void>;

  /** Register and then load the session user. */
  register: (data: RegisterInput) => Promise<void>;

  /** Login and then load the session user. */
  login: (data: LoginInput) => Promise<void>;

  /** Logout (revoke refresh cookie) and clear frontend state. */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMe = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data?.user ?? null);
  };

  /**
   * Bootstrap / re-check: the access token lives only in memory, so on
   * a fresh page load we first exchange the httpOnly refresh cookie for
   * a new access token, then ask who we are.
   */
  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = await refreshAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      await fetchMe();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterInput) => {
    const res = await api.post("/auth/register", data);
    setAccessToken(res.data?.accessToken ?? null);
    await fetchMe();
  };

  const login = async (data: LoginInput) => {
    const res = await api.post("/auth/login", data);
    setAccessToken(res.data?.accessToken ?? null);
    await fetchMe();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    // If a refresh definitively fails mid-session, the session is over.
    setOnAuthFailure(() => {
      setAccessToken(null);
      setUser(null);
    });

    checkAuth();

    return () => setOnAuthFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      checkAuth,
      register,
      login,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
