"use client";

import React from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { uploadProductImage, validateImageFile } from "@/lib/uploads";
import { useSettings } from "@/context/SettingsContext";
import { StoreSettings } from "@/types/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// One image slot: paste a URL or upload through the Slice 2b signed
// pipeline — the form can't tell the difference, by design.
function ImageField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    try {
      setProblem(null);
      setUploading(true);
      onChange(await uploadProductImage(file));
    } catch (err) {
      setProblem(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… (or upload)"
        />
        <Button asChild type="button" variant="outline" disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? "Uploading…" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
        </Button>
      </div>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { settings, loading, refresh } = useSettings();
  const [draft, setDraft] = React.useState<StoreSettings>(settings);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // Adopt the saved values once they arrive (the provider starts on
  // defaults while the fetch is in flight).
  React.useEffect(() => {
    if (!loading) setDraft(settings);
  }, [loading, settings]);

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const accentIsHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft.accentColor);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSaved(false);
      await api.put("/admin/settings", draft);
      await refresh(); // the live storefront re-brands in place
      setSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save settings"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Store settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Rebrand the storefront — no code involved. The preview follows your draft;
        nothing changes for shoppers until you save.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input
              id="storeName"
              value={draft.storeName}
              onChange={(e) => set("storeName", e.target.value)}
            />
          </div>

          <ImageField
            id="logoUrl"
            label="Logo (optional — replaces the text name)"
            value={draft.logoUrl}
            onChange={(url) => set("logoUrl", url)}
          />

          <div className="space-y-2">
            <Label htmlFor="accentColor">Accent color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick accent color"
                value={accentIsHex ? draft.accentColor : "#ea580c"}
                onChange={(e) => set("accentColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-card p-1"
              />
              <Input
                id="accentColor"
                value={draft.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                placeholder="#ea580c"
                className="w-32 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="heroHeadline">Hero headline</Label>
            <Input
              id="heroHeadline"
              value={draft.heroHeadline}
              onChange={(e) => set("heroHeadline", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Hero subtitle</Label>
            <textarea
              id="heroSubtitle"
              value={draft.heroSubtitle}
              onChange={(e) => set("heroSubtitle", e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <ImageField
            id="heroImageUrl"
            label="Hero image (optional — shown under a dark overlay)"
            value={draft.heroImageUrl}
            onChange={(url) => set("heroImageUrl", url)}
          />

          <div className="space-y-2">
            <Label htmlFor="announcement">Announcement bar (empty = hidden)</Label>
            <Input
              id="announcement"
              value={draft.announcement}
              onChange={(e) => set("announcement", e.target.value)}
              placeholder="Eid sale — free shipping until Friday!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footerText">Footer text</Label>
            <Input
              id="footerText"
              value={draft.footerText}
              onChange={(e) => set("footerText", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-green-600">Saved — the storefront is rebranded.</p>
          )}

          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Saving…" : "Save settings"}
          </Button>
        </form>

        {/* Live preview — driven by the DRAFT, not the saved values.
            The accent is scoped here via an inline --primary override,
            so the preview recolors without touching the real page. */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Live preview</p>
          <div
            className="mt-2 overflow-hidden rounded-lg border shadow-sm"
            style={
              accentIsHex
                ? ({ "--primary": draft.accentColor } as React.CSSProperties)
                : undefined
            }
          >
            {draft.announcement && (
              <div className="bg-foreground px-4 py-1.5 text-center text-xs text-background">
                {draft.announcement}
              </div>
            )}
            <div className="flex items-center justify-between bg-primary px-4 py-3">
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt={draft.storeName} className="h-6 w-auto" />
              ) : (
                <span className="font-bold text-primary-foreground">
                  {draft.storeName || "Store name"}
                </span>
              )}
              <span className="text-xs text-primary-foreground/80">Cart · Login</span>
            </div>
            <div
              className="relative bg-gradient-to-r from-primary to-primary/75 bg-cover bg-center px-4 py-8"
              style={
                draft.heroImageUrl
                  ? { backgroundImage: `url(${draft.heroImageUrl})` }
                  : undefined
              }
            >
              {draft.heroImageUrl && <div className="absolute inset-0 bg-black/50" />}
              <div className="relative">
                <p className="max-w-sm text-lg font-bold text-white">
                  {draft.heroHeadline || "Hero headline"}
                </p>
                <p className="mt-1 max-w-sm text-sm text-white/85">{draft.heroSubtitle}</p>
                <span className="mt-3 inline-block rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-primary">
                  Shop Now
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t bg-card px-4 py-3 text-xs text-muted-foreground">
              <span>
                © {new Date().getFullYear()} {draft.footerText}
              </span>
              <span className="font-medium text-primary">A themed link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
