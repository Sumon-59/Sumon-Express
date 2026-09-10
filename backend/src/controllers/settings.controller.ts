import { Request, Response } from "express";
import { Types } from "mongoose";
import StoreSettings, { IStoreSettings } from "../models/StoreSettings.model";
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
}

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

  return out;
};

// GET /api/settings — PUBLIC: the storefront brands itself before any
// auth exists; nothing secret lives here. A read must BE a read — the
// upsert runs only when the document doesn't exist yet (otherwise
// every storefront visit would be a DB write, and timestamps would
// bump updatedAt into meaning "last page view").
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const existing = await StoreSettings.findById(SETTINGS_ID);
  res.json(existing ?? (await theSettings()));
});

// PUT /api/admin/settings — partial merge: only sent fields change.
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const patch = validateSettingsData(req.body ?? {});
  res.json(await theSettings(patch));
});
