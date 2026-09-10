import mongoose, { Schema, Model, Types } from "mongoose";

export interface IReview {
  user: Types.ObjectId;
  product: Types.ObjectId;
  rating: number; // integer 1–5
  comment?: string;
  // Stored although currently implied by the write rule (delivered
  // order required) — the badge reads this flag, not the rule, so the
  // rule can loosen someday without rewriting history.
  verifiedPurchase: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    rating: { type: Number, required: true },
    comment: { type: String, trim: true },
    verifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// THE one-review-per-buyer rule — enforced by the database itself, so
// even a race produces E11000 (mapped to a friendly 400), never a dupe.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema);

export default Review;
