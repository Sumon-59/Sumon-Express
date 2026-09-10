import { Request, Response } from "express";
import crypto from "crypto";
import { Types } from "mongoose";
import Order from "../models/Order.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { sessionUser } from "../middleware/requireAuth";
import { getPaymentProvider, PaymentUrls } from "../payments/provider";

// isPaid has exactly TWO writers in this codebase: the delivered-COD
// rule (Slice 3, admin status route) and the verified IPN below. Keep
// it that way — the redirect endpoints deliberately write nothing.

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
  order.payment = { provider: provider.name, tranId, status: "initiated" };
  await order.save();

  res.json({ redirectUrl });
});

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

  const verdict = await getPaymentProvider().verifyIpn(body);

  if (!verdict.verified) {
    order.payment.status = "failed";
    order.payment.failureReason = `verification failed (${verdict.status})`;
    await order.save();
    res.json({ message: "Attempt recorded as failed" });
    return;
  }

  // Verified but the gateway says the money didn't move (FAILED /
  // CANCELLED / EXPIRED reach here only if a validator ever verifies
  // them; belt-and-braces since verified requires VALID/VALIDATED).
  if (verdict.status !== "VALID" && verdict.status !== "VALIDATED") {
    order.payment.status = "failed";
    order.payment.failureReason = `gateway status ${verdict.status}`;
    await order.save();
    res.json({ message: "Attempt recorded as failed" });
    return;
  }

  // THE money check: the gateway attests what was actually paid; only
  // an exact match against OUR stored total marks the order paid.
  if (verdict.amount !== order.totalPrice) {
    order.payment.status = "failed";
    order.payment.failureReason = `amount mismatch: gateway says ${verdict.amount}, order is ${order.totalPrice}`;
    await order.save();
    throw httpError("Paid amount does not match the order", 400);
  }

  order.isPaid = true;
  order.paidAt = new Date();
  order.payment.status = "paid";
  await order.save();
  res.json({ message: "Payment verified" });
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
