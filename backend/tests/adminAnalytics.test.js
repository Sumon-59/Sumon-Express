// Slice 6 — the analytics endpoint: every dashboard number pinned
// against a known world. Orders reach their statuses through the REAL
// routes (the state machine, the cancel endpoint), so the metrics are
// tested against the same lifecycle production runs.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, plantDiscount, placeOrder } from "./helpers";

// The world:
//   delivered:  Alice, 2×Widget(100)          = 200  → realized
//   shipped:    Bob,   1×Gadget(250)          = 250  → pending value
//   processing: Alice, 3×Widget with EID10    = 270  → pending value (discounted!)
//   pending:    Bob,   1×Widget               = 100  → pending value
//   cancelled:  Alice, 4×Widget               = 400  → counts for NOTHING
// Realized 200 · Pending 620 · Non-cancelled orders 4 · AOV floor(820/4) = 205
// Top products (non-cancelled quantities): Widget 6, Gadget 1. Customers: 2.
async function world() {
  const { auth: alice } = await registerUser({ name: "Alice", email: "a@example.com" });
  const { auth: bob } = await registerUser({ name: "Bob", email: "b@example.com" });
  const { auth: adminAuth } = await registerAdmin();

  const widget = await plantProduct({ name: "Widget", price: 100, stock: 100 });
  const gadget = await plantProduct({ name: "Gadget", price: 250, stock: 100 });
  await plantDiscount(); // EID10, 10%

  const advance = (orderId, status) =>
    request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set("Authorization", adminAuth)
      .send({ status });

  const delivered = await placeOrder(alice, widget, 2);
  await advance(delivered._id, "delivered");

  const shipped = await placeOrder(bob, gadget, 1);
  await advance(shipped._id, "shipped");

  const processing = await placeOrder(alice, widget, 3, { discountCode: "EID10" });
  await advance(processing._id, "processing");

  await placeOrder(bob, widget, 1); // stays pending

  const cancelled = await placeOrder(alice, widget, 4);
  await request(app)
    .put(`/api/admin/orders/${cancelled._id}/cancel`)
    .set("Authorization", adminAuth);

  return { adminAuth };
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("GET /api/admin/analytics", () => {
  it("computes the tiles: realized vs pending, counts, floored AOV", async () => {
    const { adminAuth } = await world();

    const res = await request(app).get("/api/admin/analytics").set("Authorization", adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      realizedRevenue: 200, // only the delivered order
      pendingValue: 620, // 250 + 270 (discounted total!) + 100
      orders: 4, // cancelled not counted
      customers: 2, // admin excluded
      avgOrderValue: 205, // floor(820 / 4)
      newCustomers30d: 2,
    });
  });

  it("counts every status in the pipeline breakdown (cancelled visible as churn)", async () => {
    const { adminAuth } = await world();

    const res = await request(app).get("/api/admin/analytics").set("Authorization", adminAuth);

    expect(res.body.ordersByStatus).toEqual({
      pending: 1,
      processing: 1,
      shipped: 1,
      delivered: 1,
      cancelled: 1,
    });
  });

  it("ranks top products by non-cancelled quantity using the snapshot names", async () => {
    const { adminAuth } = await world();

    const res = await request(app).get("/api/admin/analytics").set("Authorization", adminAuth);

    expect(res.body.topProducts[0]).toMatchObject({ name: "Widget", quantity: 6 });
    expect(res.body.topProducts[1]).toMatchObject({ name: "Gadget", quantity: 1 });
  });

  it("buckets the 30-day series by day: today carries the whole world", async () => {
    const { adminAuth } = await world();

    const res = await request(app).get("/api/admin/analytics").set("Authorization", adminAuth);

    const series = res.body.revenueByDay;
    expect(series).toHaveLength(30);
    // Continuous calendar — empty days are zeros, not gaps:
    const today = series[series.length - 1];
    expect(today).toEqual({ date: TODAY, realized: 200, pending: 620 });
    expect(series[0].realized).toBe(0);
    expect(series[0].pending).toBe(0);
  });

  it("an empty store answers zeros, not errors", async () => {
    const { auth } = await registerAdmin();

    const res = await request(app).get("/api/admin/analytics").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      realizedRevenue: 0,
      pendingValue: 0,
      orders: 0,
      avgOrderValue: 0,
    });
    expect(res.body.topProducts).toEqual([]);
  });

  it("is admin-gated", async () => {
    const { auth } = await registerUser();
    expect((await request(app).get("/api/admin/analytics")).status).toBe(401);
    expect(
      (await request(app).get("/api/admin/analytics").set("Authorization", auth)).status
    ).toBe(403);
  });
});
