// Slice 5 — the discount rules engine at the order seam.
//
// The matrix: each rule is one cell, one test, one named 400. Time is
// fixture-controlled (a code that expired YESTERDAY, one expiring
// TOMORROW) — no sleeps, no Date mocks. Money always floors to whole
// taka in the shopper's favor.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, plantProduct, plantDiscount, placeOrder } from "./helpers";

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);

// A raw order attempt (placeOrder throws on non-201; here we often WANT
// the 400).
const tryOrder = (auth, product, quantity, discountCode) =>
  request(app)
    .post("/api/orders")
    .set("Authorization", auth)
    .send({
      items: [{ product: product._id.toString(), quantity }],
      shippingAddress: { address: "House 1, Road 2", city: "Dhaka", phone: "01700000000" },
      discountCode,
    });

const stockOf = async (product) =>
  (await request(app).get(`/api/products/${product._id}`)).body.stock;

describe("discount codes at order creation", () => {
  let auth;
  beforeEach(async () => {
    ({ auth } = await registerUser());
  });

  it("applies a percent code with whole-taka floor (999 × 10% → 99, not 99.9)", async () => {
    const product = await plantProduct({ price: 999 });
    await plantDiscount(); // EID10, 10%

    const order = await placeOrder(auth, product, 1, { discountCode: "EID10" });

    expect(order.totalPrice).toBe(900); // 999 − floor(99.9)
    expect(order.discount).toMatchObject({
      code: "EID10",
      type: "percent",
      value: 10,
      amount: 99,
    });
  });

  it("applies a fixed code", async () => {
    const product = await plantProduct({ price: 999 });
    await plantDiscount({ code: "FLAT500", type: "fixed", value: 500 });

    const order = await placeOrder(auth, product, 1, { discountCode: "FLAT500" });

    expect(order.totalPrice).toBe(499);
    expect(order.discount.amount).toBe(500);
  });

  it("caps a fixed code at the subtotal — totals never go negative", async () => {
    const product = await plantProduct({ price: 100 });
    await plantDiscount({ code: "FLAT500", type: "fixed", value: 500 });

    const order = await placeOrder(auth, product, 3, { discountCode: "FLAT500" }); // subtotal 300

    expect(order.discount.amount).toBe(300);
    expect(order.totalPrice).toBe(0);
  });

  it("finds the code case-insensitively (eid10 = EID10)", async () => {
    const product = await plantProduct({ price: 100 });
    await plantDiscount();

    const order = await placeOrder(auth, product, 1, { discountCode: "eid10" });
    expect(order.discount.code).toBe("EID10");
  });

  it("rejects an unknown code and leaves stock untouched", async () => {
    const product = await plantProduct(); // stock 10

    const res = await tryOrder(auth, product, 2, "NOSUCHCODE");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unknown/i);
    expect(await stockOf(product)).toBe(10);
  });

  it("rejects an inactive code", async () => {
    const product = await plantProduct();
    await plantDiscount({ isActive: false });

    const res = await tryOrder(auth, product, 1, "EID10");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/active/i);
  });

  it("rejects a code that expired yesterday, and stock survives", async () => {
    const product = await plantProduct(); // stock 10
    await plantDiscount({ expiresAt: YESTERDAY });

    const res = await tryOrder(auth, product, 2, "EID10");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
    expect(await stockOf(product)).toBe(10);
  });

  it("accepts a code that expires tomorrow", async () => {
    const product = await plantProduct({ price: 100 });
    await plantDiscount({ expiresAt: TOMORROW });

    const order = await placeOrder(auth, product, 1, { discountCode: "EID10" });
    expect(order.discount.amount).toBe(10);
  });

  it("rejects an order below the minimum, naming the minimum", async () => {
    const product = await plantProduct({ price: 999 });
    await plantDiscount({ code: "FLAT500", type: "fixed", value: 500, minOrder: 3000 });

    const res = await tryOrder(auth, product, 1, "FLAT500");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/3000/);
  });

  it("rejects an exhausted code", async () => {
    const product = await plantProduct();
    await plantDiscount({ usageLimit: 5, usedCount: 5 });

    const res = await tryOrder(auth, product, 1, "EID10");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/i);
  });

  it("consumes usage: a limit-1 code works once, then never again", async () => {
    const product = await plantProduct({ price: 100, stock: 100 });
    await plantDiscount({ usageLimit: 1 });

    const first = await placeOrder(auth, product, 1, { discountCode: "EID10" });
    expect(first.discount.amount).toBe(10);

    const second = await tryOrder(auth, product, 1, "EID10");
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/limit/i);
  });

  it("an order without a code is exactly as before (regression)", async () => {
    const product = await plantProduct({ price: 100 });

    const order = await placeOrder(auth, product, 2);
    expect(order.totalPrice).toBe(200);
    expect(order.discount).toBeUndefined();
  });
});
