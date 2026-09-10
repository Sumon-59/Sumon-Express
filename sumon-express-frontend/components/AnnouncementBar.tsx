"use client";

import { useSettings } from "@/context/SettingsContext";

// Renders only when the owner has written an announcement — an empty
// bar never appears (same convention as RelatedProducts/Stars).
export default function AnnouncementBar() {
  const { settings } = useSettings();
  if (!settings.announcement) return null;

  return (
    <div className="bg-foreground text-background">
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-center text-sm">
        {settings.announcement}
      </p>
    </div>
  );
}
