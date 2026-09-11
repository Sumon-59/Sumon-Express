"use client";

import React from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { useSettings } from "@/context/SettingsContext";
import { StoreSettings, ShippingMethod, isHexColor } from "@/types/settings";
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
      onChange(await uploadImage(file));
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

  // Shipping editor (Slice 12): rows of label/fee/eta. Keys are derived
  // from the label at save for NEW rows only — existing keys never
  // change (in-flight checkouts hold them; order snapshots keep their
  // own copy regardless).
  const patchShipping = (i: number, patch: Partial<ShippingMethod>) =>
    setDraft((d) => ({
      ...d,
      shippingMethods: d.shippingMethods.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
  const addShipping = () =>
    setDraft((d) => ({
      ...d,
      shippingMethods: [...d.shippingMethods, { key: "", label: "", fee: 0, eta: "" }],
    }));
  const removeShipping = (i: number) =>
    setDraft((d) => ({
      ...d,
      shippingMethods: d.shippingMethods.filter((_, j) => j !== i),
    }));
  const slug = (label: string) =>
    label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const accentIsHex = isHexColor(draft.accentColor);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSaved(false);
      // New rows get slugified-label keys; a label that slugifies to
      // nothing (Bangla, punctuation) falls back to a positional key,
      // and collisions get a numeric suffix — no confusing 400s.
      const usedKeys = new Set<string>();
      const withKeys = draft.shippingMethods.map((m, i) => {
        let key = m.key || slug(m.label) || `method-${i + 1}`;
        while (usedKeys.has(key)) key = `${key}-${i + 1}`;
        usedKeys.add(key);
        return { ...m, key, fee: Number(m.fee) };
      });
      await api.put("/admin/settings", { ...draft, shippingMethods: withKeys });
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
        <form onSubmit={onSave}>
          {/* Disabled until the saved values arrive: typing into the
              defaults during a cold-start fetch would be clobbered when
              the adopt-effect fires (review finding). */}
          <fieldset disabled={loading} className="space-y-5">
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

          <div className="space-y-2">
            <Label>Shipping methods (1–5)</Label>
            <div className="space-y-2">
              {draft.shippingMethods.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Shipping label ${i + 1}`}
                    value={m.label}
                    onChange={(e) => patchShipping(i, { label: e.target.value })}
                    placeholder="Inside Dhaka"
                  />
                  <Input
                    aria-label={`Shipping fee ${i + 1}`}
                    type="number"
                    min={0}
                    step={1}
                    value={m.fee}
                    onChange={(e) => patchShipping(i, { fee: Number(e.target.value) })}
                    className="w-24"
                    placeholder="৳"
                  />
                  <Input
                    aria-label={`Shipping ETA ${i + 1}`}
                    value={m.eta}
                    onChange={(e) => patchShipping(i, { eta: e.target.value })}
                    className="w-28"
                    placeholder="1-2 days"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeShipping(i)}
                    disabled={draft.shippingMethods.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            {draft.shippingMethods.length < 5 && (
              <Button type="button" variant="outline" size="sm" onClick={addShipping}>
                Add method
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lowStockThreshold">Low-stock alert threshold (0 disables)</Label>
            <Input
              id="lowStockThreshold"
              type="number"
              min={0}
              max={10000}
              step={1}
              value={draft.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", Number(e.target.value))}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              An email goes out the moment a product or variant drops to or below this many units left.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-green-600">Saved — the storefront is rebranded.</p>
          )}

          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Saving…" : "Save settings"}
          </Button>
          </fieldset>
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
