"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { StoreSettings, DEFAULT_SETTINGS } from "@/types/settings";

// The whole theming trick lives here: shadcn components already paint
// their accents with `bg-primary`/`text-primary`, which resolve to the
// CSS variable --primary (globals.css). Overriding that ONE variable at
// the document root recolors every accent on the site — compile-time
// utility classes, runtime color.
export const applyAccent = (accentColor: string) => {
  document.documentElement.style.setProperty("--primary", accentColor);
};

type SettingsContextType = {
  settings: StoreSettings;
  loading: boolean;
  /** Re-fetch after an admin save so the storefront updates in place. */
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await api.get<StoreSettings>("/settings");
      if (res.data?.storeName !== undefined) setSettings(res.data);
    } catch {
      // Defaults already render a complete brand; a failed fetch
      // (cold start, offline) must never blank the storefront.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyAccent(settings.accentColor);
  }, [settings.accentColor]);

  const value = useMemo(() => ({ settings, loading, refresh }), [settings, loading]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
