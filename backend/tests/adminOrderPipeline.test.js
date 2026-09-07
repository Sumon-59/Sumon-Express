// Slice 3 — the order status pipeline as an enforced state machine.
//
// The machine: pending → processing → shipped → delivered (forward
// only, skips allowed), plus "cancelled" reachable ONLY through the
// cancel endpoint — the one door that restores stock. Terminal states
// (delivered, cancelled) are immutable. Every rule below is one test.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

// Fixture bundle: a shopper with a pending order for 2 of a 10-stock
// product, and an admin to drive the pipeline.
async function pendingOrder() {
  const { auth: userAuth } = await registerUser({ email: "shopper@example.com" });
  const { auth: adminAuth } = await registerAdmin();
  const product = await plantProduct(); // stock 10
  const order = await placeOrder(userAuth, product, 2); // stock now 8
  return { userAuth, adminAuth, product, order };
}

const setStatus = (adminAuth, orderId, status) =>
  request(app)
    .put(`/api/admin/orders/${orderId}`)
    .set("Authorization", adminAuth)
    .send({ status });

const cancelAsAdmin = (adminAuth, orderId) =>
  request(app).put(`/api/admin/orders/${orderId}/cancel`).set("Authorization", adminAuth);

describe("PUT /api/admin/orders/:id — the status route", () => {
  it("drives the happy pipeline: pending → processing → shipped → delivered", async () => {
    const { adminAuth, order } = await pendingOrder();

    for (const status of ["processing", "shipped"]) {
      const res = await setStatus(adminAuth, order._id, status);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }

    const delivered = await setStatus(adminAuth, order._id, "delivered");
    expect(delivered.status).toBe(200);
    expect(delivered.body.status).toBe("delivered");
    // Delivered settles payment (cash on delivery):
    expect(delivered.body.isPaid).toBe(true);
    expect(delivered.body.paidAt).toBeTruthy();
  });

  it("allows a forward skip: pending → shipped", async () => {
    const { adminAuth, order } = await pendingOrder();
    const res = await setStatus(adminAuth, order._id, "shipped");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("shipped");
  });

  it("refuses a backwards move: shipped → processing", async () => {
    const { adminAuth, order } = await pendingOrder();
    await setStatus(adminAuth, order._id, "shipped");

    const res = await setStatus(adminAuth, order._id, "processing");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/forward/i);
  });

  it("refuses re-setting the current status (no-op moves are not forward)", async () => {
    const { adminAuth, order } = await pendingOrder();
    await setStatus(adminAuth, order._id, "processing");

    const res = await setStatus(adminAuth, order._id, "processing");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/forward/i);
  });

  it("refuses any update to a delivered order", async () => {
    const { adminAuth, order } = await pendingOrder();
    await setStatus(adminAuth, order._id, "delivered");

    const res = await setStatus(adminAuth, order._id, "shipped");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/delivered/i);
  });

  it("refuses any update to a cancelled order", async () => {
    const { adminAuth, order } = await pendingOrder();
    await cancelAsAdmin(adminAuth, order._id);

    const res = await setStatus(adminAuth, order._id, "processing");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancelled/i);
  });

  it("refuses 'cancelled' as a target — cancellation has one door", async () => {
    const { adminAuth, order, product } = await pendingOrder();

    const res = await setStatus(adminAuth, order._id, "cancelled");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancel endpoint/i);

    // The rule exists to protect stock: it must NOT have been restored.
    const view = await request(app).get(`/api/products/${product._id}`);
    expect(view.body.stock).toBe(8);
  });

  it("refuses 'pending' as a target — nothing returns to pending", async () => {
    const { adminAuth, order } = await pendingOrder();
    await setStatus(adminAuth, order._id, "processing");

    const res = await setStatus(adminAuth, order._id, "pending");
    expect(res.status).toBe(400);
  });

  it("refuses an unknown status naming the valid set", async () => {
    const { adminAuth, order } = await pendingOrder();
    const res = await setStatus(adminAuth, order._id, "teleported");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pending, processing, shipped, delivered, cancelled/);
  });

  it("answers 401 anonymous and 403 non-admin", async () => {
    const { userAuth, order } = await pendingOrder();

    const anon = await request(app)
      .put(`/api/admin/orders/${order._id}`)
      .send({ status: "processing" });
    expect(anon.status).toBe(401);

    const nonAdmin = await request(app)
      .put(`/api/admin/orders/${order._id}`)
      .set("Authorization", userAuth)
      .send({ status: "processing" });
    expect(nonAdmin.status).toBe(403);
  });
});

describe("PUT /api/admin/orders/:id/cancel — the one door to cancelled", () => {
  it("cancels a pending order and restores stock", async () => {
    const { adminAuth, order, product } = await pendingOrder();

    const res = await cancelAsAdmin(adminAuth, order._id);
    expect(res.status).toBe(200);

    // Stock 8 → back to 10, proven through the public product API.
    const view = await request(app).get(`/api/products/${product._id}`);
    expect(view.body.stock).toBe(10);
  });

  it("cancels a processing order and restores stock", async () => {
    const { adminAuth, order, product } = await pendingOrder();
    await setStatus(adminAuth, order._id, "processing");

    const res = await cancelAsAdmin(adminAuth, order._id);
    expect(res.status).toBe(200);

    const view = await request(app).get(`/api/products/${product._id}`);
    expect(view.body.stock).toBe(10);
  });

  it("refuses to cancel a shipped order — it can only complete", async () => {
    const { adminAuth, order, product } = await pendingOrder();
    await setStatus(adminAuth, order._id, "shipped");

    const res = await cancelAsAdmin(adminAuth, order._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/shipped/i);

    // And stock must be untouched by the refused cancel:
    const view = await request(app).get(`/api/products/${product._id}`);
    expect(view.body.stock).toBe(8);
  });

  it("refuses to cancel a delivered order", async () => {
    const { adminAuth, order } = await pendingOrder();
    await setStatus(adminAuth, order._id, "delivered");

    const res = await cancelAsAdmin(adminAuth, order._id);
    expect(res.status).toBe(400);
  });

  it("refuses a double cancel (stock must not restore twice)", async () => {
    const { adminAuth, order, product } = await pendingOrder();
    await cancelAsAdmin(adminAuth, order._id);

    const res = await cancelAsAdmin(adminAuth, order._id);
    expect(res.status).toBe(400);

    const view = await request(app).get(`/api/products/${product._id}`);
    expect(view.body.stock).toBe(10); // restored once, not twice
  });
});
