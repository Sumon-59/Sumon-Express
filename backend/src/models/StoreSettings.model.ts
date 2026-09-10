import mongoose, { Schema, Model } from "mongoose";

// The store's brand — a SINGLETON: this collection holds exactly one
// document, ever, at the controller's fixed SETTINGS_ID (upserts are
// only race-safe on uniquely-indexed filter fields, and _id is the
// index that makes the guarantee real). All access goes through the
// controller — writes via `theSettings`, reads via findById first.
// Defaults reproduce the storefront's pre-Slice-10 hardcoded look, so
// a fresh database renders unchanged.
export interface IStoreSettings {
  storeName: string;
  logoUrl: string; // empty = text logo
  accentColor: string; // #rrggbb, stored lowercase
  heroHeadline: string;
  heroSubtitle: string;
  heroImageUrl: string; // empty = gradient-only hero
  announcement: string; // empty = no announcement bar
  footerText: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const storeSettingsSchema = new Schema<IStoreSettings>(
  {
    storeName: { type: String, default: "Sumon Express", trim: true },
    logoUrl: { type: String, default: "" },
    accentColor: { type: String, default: "#ea580c", lowercase: true },
    heroHeadline: {
      type: String,
      default: "Everything you need, delivered express.",
      trim: true,
    },
    heroSubtitle: {
      type: String,
      default:
        "Shop electronics, accessories and more — with cash on delivery across Bangladesh.",
      trim: true,
    },
    heroImageUrl: { type: String, default: "" },
    announcement: { type: String, default: "", trim: true },
    footerText: { type: String, default: "Sumon Express", trim: true },
  },
  { timestamps: true }
);

const StoreSettings: Model<IStoreSettings> =
  (mongoose.models.StoreSettings as Model<IStoreSettings>) ||
  mongoose.model<IStoreSettings>("StoreSettings", storeSettingsSchema);

export default StoreSettings;
