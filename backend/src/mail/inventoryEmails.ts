import { dispatch } from "./dispatch";

// One crossing = one line item that dropped from above the configured
// threshold to at-or-below it, in a SINGLE committed order (Slice 15).
export interface LowStockCrossing {
  name: string;
  variantName?: string;
  stock: number;
  threshold: number;
}

const crossingLine = (c: LowStockCrossing) =>
  `  ${c.name}${c.variantName ? ` · ${c.variantName}` : ""} — ${c.stock} left (threshold ${
    c.threshold
  })`;

// Batched per order, per admin: a big order that empties three products
// sends three admins one email each, not nine. Recipients are resolved
// by the CALLER (an inline DB read, like the admin-order buyerEmail
// lookup) — this function only dispatches, so it stays exactly as
// synchronous and throw-proof as notifyOrderPlaced/notifyStatusChange.
export const notifyLowStock = (crossings: LowStockCrossing[], adminEmails: string[]): void => {
  if (crossings.length === 0 || adminEmails.length === 0) return;

  const subject =
    crossings.length === 1
      ? `Low stock: ${crossings[0].name}${
          crossings[0].variantName ? ` (${crossings[0].variantName})` : ""
        } — Sumon Express`
      : `Low stock: ${crossings.length} items — Sumon Express`;
  const text =
    `The following item${crossings.length > 1 ? "s have" : " has"} crossed its ` +
    `low-stock threshold:\n\n${crossings.map(crossingLine).join("\n")}\n\n` +
    `Restock soon to avoid a stockout.`;

  for (const email of adminEmails) {
    dispatch(email, subject, text);
  }
};
