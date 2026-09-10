import Product from "../models/Product.model";
import { IOrderItem } from "../models/Order.model";
import { httpError } from "../types/http.types";

export interface OrderItemInput {
  product: string;
  quantity: number;
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

  const productIds = [...new Set(items.map((i) => String(i.product)))];
  if (productIds.length !== items.length) {
    throw httpError("Duplicate products in order items", 400);
  }

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

    if (p.stock < quantity) {
      throw httpError(`Insufficient stock for product: ${p.name}`, 400);
    }

    const unitPrice = p.discountPrice ?? p.price;
    subtotal += unitPrice * quantity;

    return {
      product: p._id,
      name: p.name,
      price: unitPrice,
      quantity,
    };
  });

  return { orderItems, subtotal };
};
