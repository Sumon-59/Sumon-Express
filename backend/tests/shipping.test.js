// Slice 12 — shipping options & order history at the HTTP seam.
// Fees are configured in settings, priced SERVER-side, and SNAPSHOTTED
// onto the order (a receipt is about the past; settings are about now).
// Status history is appended by one door — recordStatus — so it can
// never diverge from status.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import {
  registerUser,
  registerAdmin,
  plantProduct,
  plantDiscount,
  placeOrder,
} from "./helpers";

const putSettings = (auth, body) =>
  request(app).put("/api/admin/settings").set("Authorization", auth).send(body);

const METHODS = [
  { key: "inside-dhaka", label: "Inside Dhaka", fee: 60, eta: "1-2 days" },
  { key: "outside-dhaka", label: "Outside Dhaka", fee: 120, eta: "3-5 days" },
];

const myOrder = async (auth, id) => {
  const res = await request(app).get("/api/orders/my-orders").set("Authorization", auth);
  return res.body.orders.find((o) => o._id === String(id));
};

describe("shipping methods in settings", () => {
  it("fresh settings carry the two default methods", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.shippingMethods).toHaveLength(2);
    expect(res.body.shippingMethods[0]).toMatchObject({
      key: "inside-dhaka",
      fee: 60,
    });
  });

  it("PUT replaces the whole array; the matrix of bad arrays answers named 400s", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });

    const ok = await putSettings(auth, {
      shippingMethods: [{ key: "flat", label: "Flat rate", fee: 99, eta: "2 days" }],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.shippingMethods).toHaveLength(1);

    const bad = [
      [[], /at least one/i], // empty array
      [Array.from({ length: 6 }, (_, i) => ({ key: `m${i}`, label: `M${i}`, fee: 1, eta: "x" })), /at most/i],
      [[{ key: "a", label: "", fee: 10, eta: "x" }], /label/i],
      [[{ key: "a", label: "A", fee: -5, eta: "x" }], /fee/i],
      [[{ key: "a", label: "A", fee: 10.5, eta: "x" }], /fee/i],
      [
        [
          { key: "same", label: "A", fee: 1, eta: "x" },
          { key: "same", label: "B", fee: 2, eta: "x" },
        ],
        /duplicate/i,
      ],
    ];
    for (const [shippingMethods, pattern] of bad) {
      const res = await putSettings(auth, { shippingMethods });
      expect(res.status, JSON.stringify(shippingMethods)).toBe(400);
      expect(res.body.message).toMatch(pattern);
    }
  });
});

describe("server-priced fee and the snapshot", () => {
  it("prices total = subtotal + fee and snapshots the method onto the order", async () => {
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    await putSettings(admin, { shippingMethods: METHODS });
    const product = await plantProduct({ price: 100, stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });

    const order = await placeOrder(auth, product, 2, { shippingMethod: "outside-dhaka" });
    expect(order.totalPrice).toBe(320); // 200 goods + 120 fee
    expect(order.shipping).toMatchObject({
      key: "outside-dhaka",
      label: "Outside Dhaka",
      fee: 120,
      eta: "3-5 days",
    });
  });

  it("discount applies to GOODS only, then the fee is added", async () => {
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    await putSettings(admin, { shippingMethods: METHODS });
    await plantDiscount({ code: "EID10", type: "percent", value: 10 });
    const product = await plantProduct({ price: 100, stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });

    const order = await placeOrder(auth, product, 2, {
      shippingMethod: "inside-dhaka",
      discountCode: "EID10",
    });
    // (200 − 20) + 60 — the minimum/cap math never sees the fee.
    expect(order.totalPrice).toBe(240);
    expect(order.discount.amount).toBe(20);
  });

  it("the snapshot HOLDS when the owner edits fees later", async () => {
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    await putSettings(admin, { shippingMethods: METHODS });
    const product = await plantProduct({ price: 100, stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });

    const order = await placeOrder(auth, product, 1, { shippingMethod: "inside-dhaka" });

    await putSettings(admin, {
      shippingMethods: [{ key: "inside-dhaka", label: "Inside Dhaka", fee: 999, eta: "next year" }],
    });

    const view = await myOrder(auth, order._id);
    expect(view.shipping.fee).toBe(60);
    expect(view.totalPrice).toBe(160);
  });

  it("refuses unknown and missing methods with named 400s, before any side effect", async () => {
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    await putSettings(admin, { shippingMethods: METHODS });
    const product = await plantProduct({ price: 100, stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });

    const payload = (extra) => ({
      items: [{ product: product._id.toString(), quantity: 2 }],
      shippingAddress: { address: "H1", city: "Dhaka", phone: "01700000000" },
      ...extra,
    });

    const unknown = await request(app)
      .post("/api/orders")
      .set("Authorization", auth)
      .send(payload({ shippingMethod: "by-drone" }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/shipping/i);

    const missing = await request(app)
      .post("/api/orders")
      .set("Authorization", auth)
      .send(payload({}));
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/shipping/i);

    // No stock moved by either refusal:
    const fresh = (await request(app).get(`/api/products/${product._id}`)).body;
    expect(fresh.stock).toBe(10);
  });

  it("payments regression: the online flow prices the fee-inclusive total", async () => {
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    await putSettings(admin, { shippingMethods: METHODS });
    const product = await plantProduct({ price: 500, stock: 10 });
    const { auth } = await registerUser({ email: "payer@example.com" });

    const order = await placeOrder(auth, product, 1, {
      shippingMethod: "inside-dhaka",
      paymentMethod: "online",
    });
    expect(order.totalPrice).toBe(560);

    await request(app).post("/api/payments/init").set("Authorization", auth).send({ orderId: order._id });
    const { payment } = await myOrder(auth, order._id);

    // Paying the fee-inclusive total marks paid; the goods-only total fails.
    const short = await request(app)
      .post("/api/payments/ipn")
      .send({ tran_id: payment.tranId, fake_verdict: "valid", amount: "500", status: "VALID" });
    expect(short.status).toBe(400);

    const full = await request(app)
      .post("/api/payments/ipn")
      .send({ tran_id: payment.tranId, fake_verdict: "valid", amount: "560", status: "VALID" });
    expect(full.status).toBe(200);
    expect((await myOrder(auth, order._id)).isPaid).toBe(true);
  });
});

describe("status history (one door: recordStatus)", () => {
  it("seeds [pending] and appends each legal transition in order", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    const order = await placeOrder(auth, product, 1);

    let view = await myOrder(auth, order._id);
    expect(view.history.map((h) => h.status)).toEqual(["pending"]);

    for (const status of ["processing", "shipped", "delivered"]) {
      await request(app)
        .put(`/api/admin/orders/${order._id}`)
        .set("Authorization", admin)
        .send({ status });
    }
    view = await myOrder(auth, order._id);
    expect(view.history.map((h) => h.status)).toEqual([
      "pending",
      "processing",
      "shipped",
      "delivered",
    ]);
    const times = view.history.map((h) => new Date(h.at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("both cancel doors end history with cancelled; illegal moves append nothing", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth } = await registerUser({ email: "s@example.com" });
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });

    // User cancel:
    const a = await placeOrder(auth, product, 1);
    await request(app).put(`/api/orders/${a._id}/cancel`).set("Authorization", auth);
    expect((await myOrder(auth, a._id)).history.map((h) => h.status)).toEqual([
      "pending",
      "cancelled",
    ]);

    // Admin cancel:
    const b = await placeOrder(auth, product, 1);
    await request(app)
      .put(`/api/admin/orders/${b._id}/cancel`)
      .set("Authorization", admin);
    expect((await myOrder(auth, b._id)).history.map((h) => h.status)).toEqual([
      "pending",
      "cancelled",
    ]);

    // Illegal move (backwards) refused AND unrecorded:
    const c = await placeOrder(auth, product, 1);
    await request(app)
      .put(`/api/admin/orders/${c._id}`)
      .set("Authorization", admin)
      .send({ status: "delivered" });
    const refused = await request(app)
      .put(`/api/admin/orders/${c._id}`)
      .set("Authorization", admin)
      .send({ status: "processing" });
    expect(refused.status).toBe(400);
    expect((await myOrder(auth, c._id)).history.map((h) => h.status)).toEqual([
      "pending",
      "delivered",
    ]);
  });
});
