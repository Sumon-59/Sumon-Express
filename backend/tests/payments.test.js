// Slice 11 — online payments: the trust boundary at the HTTP seam.
// The PROVIDER (faked here, mirroring the real contract) answers "what
// does the gateway say happened"; the CONTROLLER decides "does that
// match MY order". isPaid has exactly two writers: the admin delivered
// rule (any method — delivery implies collection) and the verified IPN
// below — these tests pin the second.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

const initPay = (auth, orderId) =>
  request(app).post("/api/payments/init").set("Authorization", auth).send({ orderId });

// The fake provider's documented convention: it attests whatever the
// IPN body carries — fake_verdict decides verification, amount/status
// are echoed as the gateway's answer. The controller must not care
// whether the attestation came from the fake or from SSLCommerz.
const sendIpn = (tranId, { verdict = "valid", amount, status = "VALID", validatorTranId }) =>
  request(app)
    .post("/api/payments/ipn")
    .send({
      tran_id: tranId,
      fake_verdict: verdict,
      amount: String(amount),
      status,
      // What the VALIDATOR attests the transaction to be (defaults to
      // the body's tran_id in the fake) — the replay-attack dial.
      ...(validatorTranId ? { fake_validator_tran_id: validatorTranId } : {}),
    });

// Shoppers read orders through the my-orders listing (there is
// deliberately no single-order endpoint) — assert through that seam.
const orderView = async (auth, id) => {
  const res = await request(app).get("/api/orders/my-orders").set("Authorization", auth);
  return res.body.orders.find((o) => o._id === String(id));
};

async function onlineOrder() {
  const product = await plantProduct({ price: 500, stock: 50 });
  const { auth } = await registerUser({ email: "payer@example.com" });
  const order = await placeOrder(auth, product, 2, { paymentMethod: "online" });
  return { auth, order, product };
}

// Init and pull the tranId off the order (the IPN needs it, like the
// gateway would).
async function initiated() {
  const ctx = await onlineOrder();
  const res = await initPay(ctx.auth, ctx.order._id);
  expect(res.status).toBe(200);
  expect(res.body.redirectUrl).toMatch(/^https?:\/\//);
  const view = await orderView(ctx.auth, ctx.order._id);
  expect(view.payment.status).toBe("initiated");
  return { ...ctx, tranId: view.payment.tranId };
}

describe("payment initiation", () => {
  it("initiates an online order: redirectUrl answered, attempt recorded", async () => {
    await initiated(); // asserts inside
  });

  it("refuses anonymous, foreign, unknown, COD, and already-paid orders", async () => {
    const { auth, order, tranId } = await initiated();

    expect((await request(app).post("/api/payments/init").send({ orderId: order._id })).status).toBe(401);

    const { auth: other } = await registerUser({ email: "other@example.com" });
    expect((await initPay(other, order._id)).status).toBe(404);
    expect((await initPay(auth, "64b000000000000000000000")).status).toBe(404);

    const product = await plantProduct({ stock: 50 });
    const cod = await placeOrder(auth, product, 1); // paymentMethod defaults to cod
    const codRes = await initPay(auth, cod._id);
    expect(codRes.status).toBe(400);
    expect(codRes.body.message).toMatch(/online/i);

    await sendIpn(tranId, { amount: order.totalPrice });
    const paidRes = await initPay(auth, order._id);
    expect(paidRes.status).toBe(400);
    expect(paidRes.body.message).toMatch(/paid/i);
  });

  it("re-initiation issues a fresh tranId; only the LATEST is honored", async () => {
    const { auth, order, tranId: oldTranId } = await initiated();

    await initPay(auth, order._id); // retry — supersedes the first attempt
    const view = await orderView(auth, order._id);
    expect(view.payment.tranId).not.toBe(oldTranId);

    // A late IPN for the superseded attempt must be refused.
    const late = await sendIpn(oldTranId, { amount: order.totalPrice });
    expect(late.status).toBe(404);
    expect((await orderView(auth, order._id)).isPaid).toBe(false);
  });
});

describe("the verified IPN (the ONLY online path to paid)", () => {
  it("verified + amount match → paid, receipted, idempotent", async () => {
    const { auth, order, tranId } = await initiated();

    expect((await sendIpn(tranId, { amount: order.totalPrice })).status).toBe(200);
    const paid = await orderView(auth, order._id);
    expect(paid.isPaid).toBe(true);
    expect(paid.paidAt).toBeDefined();
    expect(paid.payment.status).toBe("paid");

    // The gateway retries webhooks — a duplicate must change nothing.
    expect((await sendIpn(tranId, { amount: order.totalPrice })).status).toBe(200);
    const again = await orderView(auth, order._id);
    expect(again.paidAt).toBe(paid.paidAt);
  });

  it("TAMPERED amount: gateway attests a different sum → refused, not paid, still payable", async () => {
    const { auth, order, tranId } = await initiated();

    const res = await sendIpn(tranId, { amount: order.totalPrice - 999 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/amount/i);

    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("failed");
    expect(view.payment.failureReason).toMatch(/amount/i);

    // The order is not stranded — a fresh attempt can still be made.
    expect((await initPay(auth, order._id)).status).toBe(200);
  });

  it("unverified attestation → not paid", async () => {
    const { auth, order, tranId } = await initiated();
    await sendIpn(tranId, { verdict: "invalid", amount: order.totalPrice });
    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("failed");
  });

  it("gateway FAILED/CANCELLED status → recorded, not paid", async () => {
    const { auth, order, tranId } = await initiated();
    expect((await sendIpn(tranId, { amount: order.totalPrice, status: "FAILED" })).status).toBe(200);
    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("failed");
  });

  it("unknown tranId → 404 and nothing changes", async () => {
    const { auth, order } = await initiated();
    expect((await sendIpn("no-such-attempt", { amount: 1000 })).status).toBe(404);

    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("initiated");
  });

  it("CROSS-TRANSACTION REPLAY: a genuine payment for another transaction cannot pay this order", async () => {
    // The attack the review caught: attacker holds a real val_id whose
    // validator record is VALID for the right AMOUNT — but for a
    // different transaction. The body's tran_id picks the victim
    // order; only the validator's tran_id ties the money to it.
    const { auth, order, tranId } = await initiated();

    const res = await sendIpn(tranId, {
      amount: order.totalPrice, // amount matches perfectly
      validatorTranId: "someone-elses-transaction",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/transaction/i);

    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("failed");
    expect(view.payment.failureReason).toMatch(/transaction id mismatch/i);
  });

  it("an IPN for a CANCELLED order is receipted as failed, never paid", async () => {
    const { auth, order, tranId } = await initiated();
    await request(app).put(`/api/orders/${order._id}/cancel`).set("Authorization", auth);

    expect((await sendIpn(tranId, { amount: order.totalPrice })).status).toBe(200);
    const view = await orderView(auth, order._id);
    expect(view.isPaid).toBe(false);
    expect(view.payment.status).toBe("failed");
    expect(view.payment.failureReason).toMatch(/cancelled/i);
  });

  it("init refuses a non-pending order with a named 400", async () => {
    const { auth, order } = await initiated();
    const { auth: adminAuth } = await registerAdmin({ email: "ops@example.com" });
    await request(app)
      .put(`/api/admin/orders/${order._id}`)
      .set("Authorization", adminAuth)
      .send({ status: "processing" });

    const res = await initPay(auth, order._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pending/i);
  });
});

describe("browser redirects (UX only — they decide nothing)", () => {
  it("303s every outcome to the client, writing nothing", async () => {
    const { auth, order } = await initiated();

    for (const outcome of ["success", "fail", "cancel"]) {
      const res = await request(app).post(
        `/api/payments/redirect/${outcome}?order=${order._id}`
      );
      expect(res.status).toBe(303);
      // The host is CLIENT_URL's — no user input can steer it.
      expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/orders\?/);
      expect(res.headers.location).toContain(`paid=${outcome}`);
      expect(res.headers.location).toContain(String(order._id));
    }
    // The success redirect did NOT mark anything paid — only the IPN can.
    expect((await orderView(auth, order._id)).isPaid).toBe(false);
  });
});
