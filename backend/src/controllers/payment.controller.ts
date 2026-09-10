import { Request, Response } from "express";
import crypto from "crypto";
import { Types } from "mongoose";
import Order from "../models/Order.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { sessionUser } from "../middleware/requireAuth";
import { getPaymentProvider, PaymentUrls } from "../payments/provider";

// isPaid has exactly TWO writers in this codebase: the admin delivered
// rule (Slice 3 — ANY method: delivery implies collection, the
// cash-on-handover fallback even for unpaid online orders) and the
// verified IPN below. Keep it that way — the redirect endpoints
// deliberately write nothing.

// Unique per ATTEMPT (≤30 chars per gateway rules). It doesn't need to
// encode the order — the order stores it, and lookup goes the other
// way. A retry mints a fresh one; only the latest is honored.
const makeTranId = (orderId: string) =>
  `${orderId.slice(-8)}-${crypto.randomBytes(8).toString("hex")}`;

const clientUrl = () => process.env.CLIENT_URL ?? "http://localhost:3000";

// Absolute callback URLs, derived from the request the same way the
// gateway will reach us (Render terminates TLS in front — trust the
// proto header it forwards).
const callbackUrls = (req: Request, orderId: string): PaymentUrls => {
  const base = `${req.protocol}://${req.get("host")}/api/payments`;
  return {
    successUrl: `${base}/redirect/success?order=${orderId}`,
    failUrl: `${base}/redirect/fail?order=${orderId}`,
    cancelUrl: `${base}/redirect/cancel?order=${orderId}`,
    ipnUrl: `${base}/ipn`,
  };
};

// POST /api/payments/init (auth) — start (or retry) an online payment.
export const initPayment = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const orderId = String(req.body?.orderId ?? "");
  if (!Types.ObjectId.isValid(orderId)) throw httpError("Order not found", 404);

  const order = await Order.findOne({ _id: orderId, user: user._id });
  if (!order) throw httpError("Order not found", 404);
  if (order.paymentMethod !== "online")
    throw httpError("Only online orders can be paid through the gateway", 400);
  if (order.isPaid) throw httpError("This order is already paid", 400);
  if (order.status !== "pending")
    throw httpError("Only pending orders can be paid", 400);

  const provider = getPaymentProvider();
  const tranId = makeTranId(orderId);
  const { redirectUrl } = await provider.createSession(
    order,
    tranId,
    callbackUrls(req, orderId)
  );

  // Recorded AFTER the gateway accepted the session — a refused session
  // leaves no trace. A retry overwrites the previous attempt: the old
  // tranId stops matching anything, so its late IPNs die at lookup.
  // GUARDED write (the stock/discount doctrine): an IPN that paid the
  // order during the gateway round-trip above makes this a no-op — the
  // shopper must not be sent to pay an already-paid order.
  const recorded = await Order.findOneAndUpdate(
    { _id: order._id, user: user._id, isPaid: false, status: "pending" },
    { $set: { payment: { provider: provider.name, tranId, status: "initiated" } } }
  );
  if (!recorded) throw httpError("This order can no longer be paid", 400);

  res.json({ redirectUrl });
});

// Guarded failure receipt: never clobbers a superseded attempt or an
// order that got paid in the meantime.
const recordFailure = (orderId: unknown, tranId: string, reason: string) =>
  Order.updateOne(
    { _id: orderId, "payment.tranId": tranId, isPaid: false },
    { $set: { "payment.status": "failed", "payment.failureReason": reason } }
  );

// POST /api/payments/ipn (PUBLIC — the gateway has no auth to give).
// The body is untrusted; the provider's server-to-server verification
// is the gateway's word, and the checks below are OUR judgment of it.
export const handleIpn = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const claimedTranId = String(body.tran_id ?? "");

  const order = await Order.findOne({ "payment.tranId": claimedTranId });
  if (!order || !order.payment) throw httpError("Unknown payment attempt", 404);

  // Idempotency first: gateways retry webhooks — a duplicate for an
  // already-paid order acknowledges and changes nothing.
  if (order.isPaid) {
    res.json({ message: "Already paid" });
    return;
  }

  // A cancelled order can never become paid — its stock is restored and
  // its lifecycle is over. A late-but-genuine payment is receipted as
  // failed; the money question is handled out of band.
  if (order.status === "cancelled") {
    await recordFailure(order._id, claimedTranId, "order was cancelled before payment");
    res.json({ message: "Order was cancelled" });
    return;
  }

  const verdict = await getPaymentProvider().verifyIpn(body);

  if (!verdict.verified) {
    await recordFailure(order._id, claimedTranId, `verification failed (${verdict.status})`);
    res.json({ message: "Attempt recorded as failed" });
    return;
  }

  // Verified but the gateway says the money didn't move (FAILED /
  // CANCELLED / EXPIRED reach here only if a validator ever verifies
  // them; belt-and-braces since verified requires VALID/VALIDATED).
  if (verdict.status !== "VALID" && verdict.status !== "VALIDATED") {
    await recordFailure(order._id, claimedTranId, `gateway status ${verdict.status}`);
    res.json({ message: "Attempt recorded as failed" });
    return;
  }

  // THE identity check (review finding): the validator's word names
  // which transaction the money belongs to — it must be the very
  // attempt this order is waiting for. Without this, one genuinely
  // paid val_id could mark ANY equal-priced order paid (the body's
  // tran_id chose the order; nothing tied the payment to it).
  if (verdict.tranId !== order.payment.tranId) {
    await recordFailure(
      order._id,
      claimedTranId,
      `transaction id mismatch: validator attests ${verdict.tranId}`
    );
    throw httpError("Transaction does not belong to this order", 400);
  }

  // THE money check: the gateway attests what was actually paid; only
  // an exact match against OUR stored total marks the order paid.
  if (verdict.amount !== order.totalPrice) {
    await recordFailure(
      order._id,
      claimedTranId,
      `amount mismatch: gateway says ${verdict.amount}, order is ${order.totalPrice}`
    );
    throw httpError("Paid amount does not match the order", 400);
  }

  // Guarded atomic transition (the stock/discount doctrine): exactly
  // one winner may flip isPaid, and only while this attempt is still
  // the live one and the order wasn't cancelled mid-flight. A null
  // result means a race got there first — acknowledge, change nothing.
  const paid = await Order.findOneAndUpdate(
    {
      _id: order._id,
      "payment.tranId": claimedTranId,
      isPaid: false,
      status: { $ne: "cancelled" },
    },
    { $set: { isPaid: true, paidAt: new Date(), "payment.status": "paid" } }
  );
  res.json({ message: paid ? "Payment verified" : "Attempt superseded" });
});

// POST|GET /api/payments/redirect/:outcome — the shopper's BROWSER
// lands here from the gateway (as a POST, which a Next page can't
// receive) and is bounced to the storefront. Pure UX: writes nothing,
// decides nothing — the order page reads truth from the API.
const REDIRECT_OUTCOMES = new Set(["success", "fail", "cancel"]);

export const paymentRedirect = asyncHandler(async (req: Request, res: Response) => {
  const outcome = String(req.params.outcome);
  if (!REDIRECT_OUTCOMES.has(outcome)) throw httpError("Unknown outcome", 404);

  const orderId = String(req.query.order ?? "");
  const target = new URL("/orders", clientUrl());
  target.searchParams.set("paid", outcome);
  if (Types.ObjectId.isValid(orderId)) target.searchParams.set("order", orderId);

  res.redirect(303, target.toString());
});
