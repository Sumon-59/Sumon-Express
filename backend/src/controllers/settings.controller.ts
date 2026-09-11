import { Request, Response } from "express";
import { Types } from "mongoose";
import StoreSettings, {
  IStoreSettings,
  IShippingMethod,
} from "../models/StoreSettings.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

// ---------------------------------------------------------------
// The singleton accessor — the ONLY way settings are written (and
// created). The identity is a FIXED _id, not an empty filter: an
// upsert is only race-safe when its filter fields carry a unique
// index (Mongo retries the duplicate-key loser since 4.2) — {} has
// none, so two concurrent first-touches could each insert. The _id
// index is what makes "one document, ever" a real guarantee.
// setDefaultsOnInsert fills every schema default at creation.
// ---------------------------------------------------------------
export const SETTINGS_ID = new Types.ObjectId("000000000000000000000001");

const theSettings = (patch: Partial<IStoreSettings> = {}) =>
  StoreSettings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    Object.keys(patch).length ? { $set: patch } : {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

// ---------------------------------------------------------------
// Validation choke point for settings — the settings sibling of
// validateProductData. Every field is optional (partial merge);
// what IS sent must be valid. 400 names the field. Add settings
// rules here, nowhere else.
// ---------------------------------------------------------------
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// http(s) only — a javascript: "logo" must never reach an <img src>.
const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

interface SettingsBody {
  storeName?: unknown;
  logoUrl?: unknown;
  accentColor?: unknown;
  heroHeadline?: unknown;
  heroSubtitle?: unknown;
  heroImageUrl?: unknown;
  announcement?: unknown;
  footerText?: unknown;
  shippingMethods?: unknown;
}

// Shipping methods (Slice 12) — full-array replace, the variants-axis
// convention. Whole-taka fees (the Slice 5 money rule), unique keys.
const validateShippingMethods = (value: unknown): IShippingMethod[] => {
  if (!Array.isArray(value) || value.length < 1)
    throw httpError("Shipping needs at least one method", 400);
  if (value.length > 5)
    throw httpError("Shipping allows at most 5 methods", 400);

  const seen = new Set<string>();
  return value.map((raw) => {
    const m = (raw ?? {}) as Record<string, unknown>;
    const key = typeof m.key === "string" ? m.key.trim().toLowerCase() : "";
    if (!key) throw httpError("Every shipping method needs a key", 400);
    if (!/^[a-z0-9-]{1,40}$/.test(key))
      throw httpError("Shipping method keys use only letters, digits and dashes", 400);
    if (seen.has(key)) throw httpError(`Duplicate shipping method key: ${key}`, 400);
    seen.add(key);

    const label = textField(m.label, "Shipping method label", 60, { required: true });
    const fee = m.fee;
    if (typeof fee !== "number" || !Number.isInteger(fee) || fee < 0)
      throw httpError("Shipping fee must be a whole non-negative amount in taka", 400);

    const eta = textField(m.eta ?? "", "Shipping ETA", 40);
    return { key, label, fee, eta };
  });
};

const textField = (
  value: unknown,
  label: string,
  max: number,
  { required = false } = {}
) => {
  if (typeof value !== "string") throw httpError(`${label} must be text`, 400);
  const trimmed = value.trim();
  if (required && !trimmed) throw httpError(`${label} is required`, 400);
  if (trimmed.length > max)
    throw httpError(`${label} must be at most ${max} characters`, 400);
  return trimmed;
};

const urlField = (value: unknown, label: string) => {
  if (typeof value !== "string") throw httpError(`${label} must be text`, 400);
  const trimmed = value.trim();
  if (trimmed && !isHttpUrl(trimmed))
    throw httpError(`${label} must be an http(s) URL`, 400);
  return trimmed; // empty string clears the field
};

export const validateSettingsData = (data: SettingsBody): Partial<IStoreSettings> => {
  const out: Partial<IStoreSettings> = {};

  if (data.storeName !== undefined)
    out.storeName = textField(data.storeName, "Store name", 60, { required: true });

  if (data.accentColor !== undefined) {
    if (typeof data.accentColor !== "string" || !HEX_COLOR.test(data.accentColor.trim()))
      throw httpError("Accent color must be a hex color like #ea580c", 400);
    out.accentColor = data.accentColor.trim().toLowerCase();
  }

  if (data.heroHeadline !== undefined)
    out.heroHeadline = textField(data.heroHeadline, "Hero headline", 120);
  if (data.heroSubtitle !== undefined)
    out.heroSubtitle = textField(data.heroSubtitle, "Hero subtitle", 300);
  if (data.announcement !== undefined)
    out.announcement = textField(data.announcement, "Announcement", 300);
  if (data.footerText !== undefined)
    out.footerText = textField(data.footerText, "Footer text", 300);

  if (data.logoUrl !== undefined) out.logoUrl = urlField(data.logoUrl, "Logo URL");
  if (data.heroImageUrl !== undefined)
    out.heroImageUrl = urlField(data.heroImageUrl, "Hero image URL");

  if (data.shippingMethods !== undefined)
    out.shippingMethods = validateShippingMethods(data.shippingMethods);

  return out;
};

// The read every consumer shares (public GET, order pricing): a true
// read, with the upsert only as the not-yet-created fallback.
export const readStoreSettings = async (): Promise<IStoreSettings> =>
  (await StoreSettings.findById(SETTINGS_ID)) ?? (await theSettings());

// GET /api/settings — PUBLIC: the storefront brands itself before any
// auth exists; nothing secret lives here. A read must BE a read — the
// upsert runs only when the document doesn't exist yet (otherwise
// every storefront visit would be a DB write, and timestamps would
// bump updatedAt into meaning "last page view").
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await readStoreSettings());
});

// PUT /api/admin/settings — partial merge: only sent fields change.
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const patch = validateSettingsData(req.body ?? {});
  res.json(await theSettings(patch));
});
