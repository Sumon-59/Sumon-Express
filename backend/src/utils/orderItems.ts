import Product from "../models/Product.model";
import { IOrderItem } from "../models/Order.model";
import { httpError } from "../types/http.types";

export interface OrderItemInput {
  product: string;
  quantity: number;
  variant?: string; // required iff the product has an option axis
}

// Shared by order creation AND discount preview: resolve cart lines to
// snapshot items plus the server-computed subtotal from DB prices
// (discountPrice ?? price). The client's own totals are never trusted.
// Includes the stock check, so a preview never promises an order that
// creation would refuse.
export const buildOrderItems = async (
  items?: OrderItemInput[]
): Promise<{ orderItems: IOrderItem[]; subtotal: number }> => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw httpError("Order must contain at least one item", 400);
  }

  // Line identity is product+variant (Slice 7): S and M of one shirt
  // are two legal lines; the same pair twice is still a client bug.
  const lineKeys = items.map((i) => `${String(i.product)}::${i.variant ?? ""}`);
  if (new Set(lineKeys).size !== items.length) {
    throw httpError("Duplicate products in order items", 400);
  }

  const productIds = [...new Set(items.map((i) => String(i.product)))];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });

  if (products.length !== productIds.length) {
    throw httpError("One or more products not found", 404);
  }

  let subtotal = 0;

  const orderItems: IOrderItem[] = items.map((i) => {
    const p = products.find((x) => x._id.toString() === i.product);

    if (!p) {
      throw httpError(`Product not found: ${i.product}`, 404);
    }

    const quantity = Number(i.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw httpError(`Invalid quantity for product: ${p.name}`, 400);
    }

    const hasAxis = Boolean(p.optionName && p.variants?.length);

    if (!hasAxis) {
      if (i.variant !== undefined) {
        throw httpError(`${p.name} has no variants — do not send one`, 400);
      }
      if (p.stock < quantity) {
        throw httpError(`Insufficient stock for product: ${p.name}`, 400);
      }
      const unitPrice = p.discountPrice ?? p.price;
      subtotal += unitPrice * quantity;
      return { product: p._id, name: p.name, price: unitPrice, quantity };
    }

    // Variant product: the value is required and must exist.
    if (typeof i.variant !== "string" || !i.variant.trim()) {
      throw httpError(`Choose a ${p.optionName} for ${p.name}`, 400);
    }
    const value = p.variants!.find((v) => v.name === i.variant);
    if (!value) {
      throw httpError(`${p.name} has no ${p.optionName} "${i.variant}"`, 400);
    }
    if (value.stock < quantity) {
      throw httpError(`Insufficient stock for product: ${p.name} (${value.name})`, 400);
    }

    // Pinned resolution order: override beats the sale price.
    const unitPrice = value.price ?? p.discountPrice ?? p.price;
    subtotal += unitPrice * quantity;

    return {
      product: p._id,
      name: p.name,
      price: unitPrice,
      quantity,
      variantName: value.name,
    };
  });

  return { orderItems, subtotal };
};

// ---------------------------------------------------------------
// THE stock engine (Slice 7): claim and restore live here, used by
// order creation AND both cancel paths. On a variant product both
// counters (the value and the top-level sum) move in ONE atomic
// update on one document — nothing to drift.
// ---------------------------------------------------------------

export interface StockClaim {
  claimed: boolean;
  // Post-claim stock of the UNIT that moved — the variant value's own
  // stock on a variant line, the top-level counter on a plain product.
  // Never the variant-product aggregate sum: that's not what a low-stock
  // alert should name, because it's not what gets restocked. Present
  // only when claimed.
  stock?: number;
}

// Claim stock for one line.
export const claimItemStock = async (item: IOrderItem): Promise<StockClaim> => {
  if (item.variantName) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.product,
        variants: { $elemMatch: { name: item.variantName, stock: { $gte: item.quantity } } },
      },
      { $inc: { "variants.$.stock": -item.quantity, stock: -item.quantity } },
      { new: true }
    );
    if (!updated) return { claimed: false };
    const value = updated.variants!.find((v) => v.name === item.variantName);
    return { claimed: true, stock: value?.stock };
  }
  const updated = await Product.findOneAndUpdate(
    { _id: item.product, stock: { $gte: item.quantity } },
    { $inc: { stock: -item.quantity } },
    { new: true }
  );
  return updated ? { claimed: true, stock: updated.stock } : { claimed: false };
};

// Restore stock for one line. If the value no longer exists (the axis
// was replaced with open orders), the quantity returns to the
// top-level counter alone — aggregate stock preserved, the per-value
// split accepted as lost (documented in the Slice 7 spec).
export const restoreItemStock = async (item: IOrderItem): Promise<void> => {
  if (item.variantName) {
    const restored = await Product.updateOne(
      { _id: item.product, "variants.name": item.variantName },
      { $inc: { "variants.$.stock": item.quantity, stock: item.quantity } }
    );
    if (restored.matchedCount > 0) return;
  }
  await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
};

export const restoreOrderStock = async (items: IOrderItem[]): Promise<void> => {
  for (const item of items) {
    await restoreItemStock(item);
  }
};
