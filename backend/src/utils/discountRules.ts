import { Types } from "mongoose";
import Discount, { IDiscount } from "../models/Discount.model";
import { httpError } from "../types/http.types";

// THE rules choke point for discount codes (the discount sibling of
// validateProductData): both the preview endpoint and order creation
// resolve codes here, nowhere else. Exactly one reason per refusal,
// each a 400 naming it — the shopper must know whether to fix the cart
// or drop the code.

export type ResolvedDiscount = {
  discount: IDiscount & { _id: Types.ObjectId };
  amount: number; // whole taka, floored — always in the shopper's favor
};

export const resolveDiscount = async (
  codeInput: string,
  subtotal: number
): Promise<ResolvedDiscount> => {
  const code = codeInput.trim().toUpperCase();
  const discount = await Discount.findOne({ code });

  if (!discount) {
    throw httpError("Unknown discount code", 400);
  }
  if (!discount.isActive) {
    throw httpError("This discount code is no longer active", 400);
  }
  if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
    throw httpError("This discount code has expired", 400);
  }
  if (subtotal < discount.minOrder) {
    throw httpError(`Order must be at least ৳${discount.minOrder} to use this code`, 400);
  }
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    throw httpError("This discount code has reached its usage limit", 400);
  }

  // Floor BOTH paths: a fractional subtotal hitting the fixed cap would
  // otherwise produce a fractional discount (review catch — the money
  // rule is "whole taka, always", not "whole taka for percent").
  const amount = Math.floor(
    discount.type === "percent"
      ? (subtotal * discount.value) / 100
      : Math.min(discount.value, subtotal) // never below a zero total
  );

  return { discount, amount };
};

// Claim one use atomically — the same claim-don't-count pattern as
// stock. The guard re-checks the limit inside the update, so two
// simultaneous orders can never both take the last slot.
export const claimDiscountUsage = async (discountId: Types.ObjectId): Promise<boolean> => {
  const claimed = await Discount.findOneAndUpdate(
    {
      _id: discountId,
      isActive: true,
      $and: [
        // matches null AND missing:
        { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
        // expiry re-checked at claim time, like the limit (spec rule):
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  return claimed !== null;
};

// Roll a claim back (order creation failed after the claim succeeded).
export const releaseDiscountUsage = async (discountId: Types.ObjectId): Promise<void> => {
  await Discount.updateOne({ _id: discountId }, { $inc: { usedCount: -1 } });
};
