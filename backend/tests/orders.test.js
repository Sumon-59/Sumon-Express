// Integration tests for the orders seam: /api/orders/*
//
// The one rule of seams applies here too: we prove stock changed by
// asking the PUBLIC product endpoint (GET /api/products/:id), not by
// reading the database. If the API says stock went down, a real
// customer would see it too — that's the behavior we care about.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, plantProduct } from "./helpers";

describe("POST /api/orders", () => {
  let cookies;
  beforeEach(async () => {
    ({ cookies } = await registerUser());
  });

  it("creates an order with item snapshot, server-side total, and decrements stock", async () => {
    // price 100, discountPrice 80 → the server must charge 80.
    const product = await plantProduct({ discountPrice: 80 });

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", cookies)
      .send({
        items: [{ product: product._id.toString(), quantity: 2 }],
        shippingAddress: { address: "House 1, Road 2", city: "Dhaka", phone: "01700000000" },
        // A malicious client claims the order is worth 1 taka:
        totalPrice: 1,
      });

    expect(res.status).toBe(201);

    // The v2 bug: orders were saved with NO items. Never again:
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("Test Widget");
    expect(res.body.items[0].quantity).toBe(2);

    // Server-side pricing: 80 × 2 = 160. The client's "1" is ignored.
    // (160 is a worked-example literal, not recomputed from the code.)
    expect(res.body.totalPrice).toBe(160);
    expect(res.body.shippingAddress.city).toBe("Dhaka");

    // Stock: 10 - 2 = 8, proven through the public product endpoint.
    const productView = await request(app).get(`/api/products/${product._id}`);
    expect(productView.body.stock).toBe(8);
  });

  it("rejects an order that exceeds stock and leaves stock untouched", async () => {
    const product = await plantProduct({ stock: 3 });

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", cookies)
      .send({ items: [{ product: product._id.toString(), quantity: 5 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    const productView = await request(app).get(`/api/products/${product._id}`);
    expect(productView.body.stock).toBe(3);
  });

  it("requires login", async () => {
    const product = await plantProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ product: product._id.toString(), quantity: 1 }] });

    expect(res.status).toBe(401);
  });
  it("rejects an order for an inactive product", async () => {
    // Arrange: a product that is switched off
    const product = await plantProduct({ isActive: false });

    // Act: try to order it, logged in
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", cookies)
      .send({ items: [{ product: product._id.toString(), quantity: 1 }] });

    // Assert: the server must refuse as if the product doesn't exist
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe("PUT /api/orders/:id/cancel", () => {
  it("cancels a pending order and restores stock", async () => {
    const { cookies } = await registerUser();
    const product = await plantProduct({ stock: 10 });

    const order = await request(app)
      .post("/api/orders")
      .set("Cookie", cookies)
      .send({ items: [{ product: product._id.toString(), quantity: 4 }] });
    expect(order.status).toBe(201);

    const cancel = await request(app)
      .put(`/api/orders/${order.body._id}/cancel`)
      .set("Cookie", cookies);
    expect(cancel.status).toBe(200);

    // Stock is back: 10 - 4 + 4 = 10.
    const productView = await request(app).get(`/api/products/${product._id}`);
    expect(productView.body.stock).toBe(10);

    // And the order shows as cancelled in the user's order list:
    const myOrders = await request(app).get("/api/orders/my-orders").set("Cookie", cookies);
    expect(myOrders.body.orders[0].status).toBe("cancelled");
  });

  it("does not let one user cancel another user's order", async () => {
    const alice = await registerUser({ email: "alice@example.com" });
    const bob = await registerUser({ email: "bob@example.com" });
    const product = await plantProduct();

    const order = await request(app)
      .post("/api/orders")
      .set("Cookie", alice.cookies)
      .send({ items: [{ product: product._id.toString(), quantity: 1 }] });

    const cancel = await request(app)
      .put(`/api/orders/${order.body._id}/cancel`)
      .set("Cookie", bob.cookies);

    expect(cancel.status).toBe(403);
  });
});
