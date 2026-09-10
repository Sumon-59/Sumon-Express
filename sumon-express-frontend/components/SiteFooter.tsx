"use client";

import { useSettings } from "@/context/SettingsContext";

export default function SiteFooter() {
  const { settings } = useSettings();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {settings.footerText}
        </span>
        <span>Cash on delivery across Bangladesh</span>
      </div>
    </footer>
  );
}
