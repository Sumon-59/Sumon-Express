"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

/**
 * Minimal user shape used by the frontend.
 * Keep it minimal; you can expand later if needed.
 */
type User = {
  _id: string;
  email: string;
  role: "user" | "admin";
  name?: string;
};

/**
 * Inputs for auth actions.
 * Adjust fields if your backend expects different keys.
 */
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
 */
type AuthContextType = {
  user: User | null;
  loading: boolean;

  /** Re-check session from backend (cookie-based). */
  checkAuth: () => Promise<void>;

  /** Register and then restore session from backend. */
  register: (data: RegisterInput) => Promise<void>;

  /** Login and then restore session from backend. */
  login: (data: LoginInput) => Promise<void>;

  /** Logout (revoke refresh cookie on backend) and clear frontend state. */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  /**
   * loading=true means we are currently checking session state (e.g. on app load).
   * This prevents UI flicker and helps route guards later.
   */
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Backend is the single source of truth.
   * If cookies are valid, /auth/me returns the user.
   * If not, it fails (401) and we set user=null.
   */
  const checkAuth = async () => {
    try {
      setLoading(true);

      // Your confirmed endpoint:
      // baseURL: .../api  => final URL: .../api/auth/me
      const res = await api.get("/auth/me");

      // Support both shapes:
      // 1) { user: {...} }
      // 2) direct user object
      const currentUser = res.data?.user ?? res.data;

      setUser(currentUser ?? null);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register:
   * Do NOT trust response shape. After register, ask backend who we are.
   * This works whether backend returns user or not.
   */
  const register = async (data: RegisterInput) => {
    await api.post("/auth/register", data);
    await checkAuth();
  };

  /**
   * Login:
   * Same strategy as register. After login, confirm session via /auth/me.
   */
  const login = async (data: LoginInput) => {
    await api.post("/auth/login", data);
    await checkAuth();
  };

  /**
   * Logout:
   * Always clear frontend user state even if backend fails.
   */
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  };

  /**
   * On first app load, restore session (cookie-based auth).
   * This is what makes page refresh keep the user logged in.
   */
  useEffect(() => {
    checkAuth();
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

/**
 * Safe hook to consume auth context.
 * Throws early if used outside <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
