import { IOrder } from "../models/Order.model";
import { getMailer } from "./mailer";

// Order emails (Slice 13). Every body is built SYNCHRONOUSLY from the
// order SNAPSHOT — items, shipping, discount, total — never re-reading
// products or settings (receipts doctrine: the email describes what
// was bought, at the prices it was bought at).
//
// Every notify* is FIRE-AND-FORGET: sendMail's promise is caught and
// logged, never awaited by a request handler and never thrown. A slow
// or dead mail service cannot block checkout or fail a request.

type OrderLike = IOrder & { _id: unknown };

const shortId = (order: OrderLike) => String(order._id).slice(-8);

const orderLines = (order: OrderLike): string => {
  const lines = order.items.map(
    (i) =>
      `  ${i.name}${i.variantName ? ` · ${i.variantName}` : ""} × ${i.quantity} — ৳${
        i.price * i.quantity
      }`
  );
  if (order.discount) {
    lines.push(`  Discount (${order.discount.code}): −৳${order.discount.amount}`);
  }
  if (order.shipping) {
    lines.push(
      `  Delivery (${order.shipping.label}${
        order.shipping.eta ? `, ${order.shipping.eta}` : ""
      }): ${order.shipping.fee === 0 ? "free" : `৳${order.shipping.fee}`}`
    );
  }
  lines.push(`  Total: ৳${order.totalPrice}`);
  return lines.join("\n");
};

const dispatch = (to: string, subject: string, text: string) => {
  getMailer()
    .sendMail({ to, subject, text })
    .catch((err) => {
      console.error(`[mail] failed to send "${subject}" to ${to}:`, err);
    });
};

export const notifyOrderPlaced = (order: OrderLike, email: string) => {
  dispatch(
    email,
    `Order #${shortId(order)} confirmed — Sumon Express`,
    `Thank you for your order!\n\nOrder #${shortId(order)}\n${orderLines(order)}\n\n` +
      `Payment: ${order.paymentMethod === "online" ? "online (pay via the gateway)" : "cash on delivery"}\n` +
      `We'll email you as it moves.`
  );
};

export const notifyStatusChange = (order: OrderLike, email: string) => {
  const extra =
    order.status === "delivered"
      ? "\nPayment is collected — enjoy your purchase!"
      : "";
  dispatch(
    email,
    `Order #${shortId(order)} is now ${order.status} — Sumon Express`,
    `Your order #${shortId(order)} is now ${order.status}.${extra}\n\n${orderLines(order)}`
  );
};

export const notifyCancelled = (
  order: OrderLike,
  email: string,
  by: "user" | "admin"
) => {
  dispatch(
    email,
    `Order #${shortId(order)} cancelled — Sumon Express`,
    `Your order #${shortId(order)} has been cancelled ` +
      (by === "user" ? "by you, as requested." : "by the store.") +
      ` Any reserved stock has been released.\n\n${orderLines(order)}`
  );
};
