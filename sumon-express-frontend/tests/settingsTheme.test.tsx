// Slice 10 — the theming mechanism, pinned: SettingsProvider fetches
// the singleton and writes its accent into the document-root --primary
// CSS variable (what every bg-primary/text-primary utility resolves
// to). HTTP faked at the adapter level, the established pattern.

import { describe, it, expect, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { DEFAULT_SETTINGS } from "@/types/settings";

type Config = InternalAxiosRequestConfig;

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  document.documentElement.style.removeProperty("--primary");
});

const serveSettings = (overrides: Record<string, string>) => {
  api.defaults.adapter = async (config: Config): Promise<AxiosResponse> => ({
    config,
    status: 200,
    statusText: "200",
    headers: {},
    data: { ...DEFAULT_SETTINGS, ...overrides },
  });
};

function ShowName() {
  const { settings } = useSettings();
  return <span data-testid="name">{settings.storeName}</span>;
}

describe("SettingsProvider theming", () => {
  it("sets the root --primary variable from the fetched accent", async () => {
    serveSettings({ accentColor: "#2563eb", storeName: "Rebranded" });

    const { getByTestId } = render(
      <SettingsProvider>
        <ShowName />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("name").textContent).toBe("Rebranded");
      expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#2563eb");
    });
  });

  it("keeps the complete default brand when the fetch fails", async () => {
    api.defaults.adapter = async () => Promise.reject(new Error("network down"));

    const { getByTestId } = render(
      <SettingsProvider>
        <ShowName />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("name").textContent).toBe(DEFAULT_SETTINGS.storeName);
      expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
        DEFAULT_SETTINGS.accentColor
      );
    });
  });
});
