import { Request, Response } from "express";
import { Types } from "mongoose";
import Discount, { IDiscount, isDiscountType } from "../models/Discount.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { resolveDiscount } from "../utils/discountRules";
import { buildOrderItems, OrderItemInput } from "../utils/orderItems";
import { parsePagination, pageMeta } from "../utils/pagination";

// ---------------------------------------------------------------
// Validation choke point for discount documents — the discount
// sibling of validateProductData. Partial updates validate against
// the EFFECTIVE values (current merged with the patch). 400 names
// the field.
// ---------------------------------------------------------------
interface DiscountBody {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  minOrder?: unknown;
  expiresAt?: unknown;
  usageLimit?: unknown;
  isActive?: unknown;
}

const validateDiscountData = (data: DiscountBody, current?: IDiscount) => {
  const out: Partial<IDiscount> = {};

  if (data.code !== undefined || !current) {
    if (typeof data.code !== "string" || !data.code.trim()) {
      throw httpError("Discount code is required", 400);
    }
    out.code = data.code.trim().toUpperCase();
  }

  const effectiveType = (() => {
    if (data.type !== undefined || !current) {
      if (typeof data.type !== "string" || !isDiscountType(data.type)) {
        throw httpError("Discount type must be percent or fixed", 400);
      }
      out.type = data.type;
      return data.type;
    }
    return current.type;
  })();

  if (data.value !== undefined || !current) {
    const value = Number(data.value);
    if (Number.isNaN(value)) throw httpError("Discount value must be a number", 400);
    if (effectiveType === "percent" && (value < 1 || value > 100)) {
      throw httpError("Discount value must be between 1 and 100 percent", 400);
    }
    if (effectiveType === "fixed" && (!Number.isInteger(value) || value <= 0)) {
      throw httpError("Discount value must be a positive whole-taka amount", 400);
    }
    out.value = value;
  } else if (data.type !== undefined && current) {
    // Type changed without a new value — the old value must still fit.
    const value = current.value;
    if (effectiveType === "percent" && (value < 1 || value > 100)) {
      throw httpError("Discount value must be between 1 and 100 percent for a percent code", 400);
    }
  }

  if (data.minOrder !== undefined) {
    const minOrder = Number(data.minOrder);
    if (Number.isNaN(minOrder) || minOrder < 0) {
      throw httpError("Minimum order (minOrder) cannot be negative", 400);
    }
    out.minOrder = minOrder;
  }

  if (data.expiresAt !== undefined) {
    if (data.expiresAt === null) {
      out.expiresAt = null;
    } else {
      const expiresAt = new Date(String(data.expiresAt));
      if (Number.isNaN(expiresAt.getTime())) {
        throw httpError("expiresAt must be a valid date or null", 400);
      }
      out.expiresAt = expiresAt;
    }
  }

  if (data.usageLimit !== undefined) {
    if (data.usageLimit === null) {
      out.usageLimit = null;
    } else {
      const usageLimit = Number(data.usageLimit);
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        throw httpError("usageLimit must be a positive whole number or null", 400);
      }
      out.usageLimit = usageLimit;
    }
  }

  if (data.isActive !== undefined) {
    out.isActive = Boolean(data.isActive);
  }

  return out;
};

// ---------------------------------------------------------------
// Shopper-facing preview: recompute the subtotal from DB prices, run
// the same rules order creation runs, consume NOTHING.
// ---------------------------------------------------------------
export const previewDiscount = asyncHandler(async (req: Request, res: Response) => {
  const { code, items } = req.body as { code?: string; items?: OrderItemInput[] };

  if (!code || !String(code).trim()) {
    throw httpError("Discount code is required", 400);
  }

  const { subtotal } = await buildOrderItems(items);
  const { discount, amount } = await resolveDiscount(String(code), subtotal);

  res.json({
    code: discount.code,
    subtotal,
    discountAmount: amount,
    total: subtotal - amount,
  });
});

// ---------------------------------------------------------------
// Admin CRUD. No hard delete — deactivate via update (snapshots and
// campaign history outlive campaigns).
// ---------------------------------------------------------------
export const getAdminDiscounts = asyncHandler(async (req: Request, res: Response) => {
  const paging = parsePagination(req);
  const [discounts, total] = await Promise.all([
    // _id tiebreak: two codes created in the same millisecond still
    // list deterministically (ObjectIds are monotonic) — a test caught
    // the ambiguity.
    Discount.find().sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit),
    Discount.countDocuments(),
  ]);
  res.json({ ...pageMeta(total, paging), discounts });
});

export const getAdminDiscountById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) {
    throw httpError("Invalid discount id", 400);
  }
  const discount = await Discount.findById(id);
  if (!discount) {
    throw httpError("Discount not found", 404);
  }
  res.json(discount);
});

export const createDiscount = asyncHandler(async (req: Request, res: Response) => {
  const data = validateDiscountData(req.body as DiscountBody);

  const existing = await Discount.findOne({ code: data.code });
  if (existing) {
    throw httpError("A discount with this code already exists", 400);
  }

  const discount = await Discount.create(data);
  res.status(201).json(discount);
});

export const updateDiscount = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) {
    throw httpError("Invalid discount id", 400);
  }

  const discount = await Discount.findById(id);
  if (!discount) {
    throw httpError("Discount not found", 404);
  }

  const data = validateDiscountData(req.body as DiscountBody, discount);

  if (data.code && data.code !== discount.code) {
    const clash = await Discount.findOne({ code: data.code, _id: { $ne: discount._id } });
    if (clash) {
      throw httpError("A discount with this code already exists", 400);
    }
  }

  Object.assign(discount, data);
  await discount.save();
  res.json(discount);
});
