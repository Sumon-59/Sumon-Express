import mongoose, { Schema, Model } from "mongoose";

export const DISCOUNT_TYPES = ["percent", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const isDiscountType = (s: string): s is DiscountType =>
  (DISCOUNT_TYPES as readonly string[]).includes(s);

export interface IDiscount {
  code: string; // stored uppercase; unique
  type: DiscountType;
  value: number; // percent: 1–100; fixed: whole taka > 0
  minOrder: number; // 0 = no minimum
  expiresAt?: Date | null; // absent = never expires
  usageLimit?: number | null; // absent = unlimited
  usedCount: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const discountSchema = new Schema<IDiscount>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Discount: Model<IDiscount> =
  mongoose.models.Discount || mongoose.model<IDiscount>("Discount", discountSchema);

export default Discount;
