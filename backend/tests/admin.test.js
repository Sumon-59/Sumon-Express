// Integration tests for the admin seam: /api/admin/*
//
// The role boundary is SERVER-side: 401 for anonymous callers, 403 for
// authenticated non-admins, 200 for admins. The frontend guard is only
// UX; these tests pin the real security line.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

describe("GET /api/admin/orders", () => {
  it("answers 401 to anonymous callers", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("answers 403 to an authenticated non-admin", async () => {
    const { res: reg } = await registerUser();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin/i);
  });

  it("answers 200 with the paginated wrapper to an admin", async () => {
    const { auth } = await registerAdmin();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", auth);

    expect(res.status).toBe(200);
    // Slice 3: the bare array became {orders, total, page, pages} —
    // the same wrapper the products listing uses.
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body).toMatchObject({ total: 0, page: 1, pages: 0 });
  });

  it("rejects a garbage access token with 401", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/orders — filtering and pagination (Slice 3)", () => {
  // Five orders from one shopper against one well-stocked product.
  async function fiveOrders() {
    const { auth: userAuth } = await registerUser({ email: "shopper@example.com" });
    const { auth: adminAuth } = await registerAdmin();
    const product = await plantProduct({ stock: 100 });
    const orders = [];
    for (let i = 0; i < 5; i++) {
      orders.push(await placeOrder(userAuth, product, 1));
    }
    return { userAuth, adminAuth, product, orders };
  }

  it("carries the populated customer and the items snapshot on each row", async () => {
    const { adminAuth } = await fiveOrders();

    const res = await request(app).get("/api/admin/orders").set("Authorization", adminAuth);

    expect(res.status).toBe(200);
    const row = res.body.orders[0];
    expect(row.user.name).toBe("Test User");
    expect(row.user.email).toBe("shopper@example.com");
    expect(row.items).toHaveLength(1);
    expect(row.items[0].name).toBe("Test Widget");
  });

  it("lists newest first", async () => {
    const { adminAuth, orders } = await fiveOrders();

    const res = await request(app).get("/api/admin/orders").set("Authorization", adminAuth);

    // The LAST order placed is the FIRST row.
    expect(res.body.orders[0]._id).toBe(orders[4]._id);
    expect(res.body.orders[4]._id).toBe(orders[0]._id);
  });

  it("paginates: limit 2 over 5 orders makes 3 pages, page 2 holds the middle", async () => {
    const { adminAuth, orders } = await fiveOrders();

    const res = await request(app)
      .get("/api/admin/orders?page=2&limit=2")
      .set("Authorization", adminAuth);

    expect(res.body.total).toBe(5);
    expect(res.body.pages).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.orders).toHaveLength(2);
    // Newest-first over pages: page 1 = orders 5,4; page 2 = orders 3,2.
    expect(res.body.orders.map((o) => o._id)).toEqual([orders[2]._id, orders[1]._id]);
  });

  it("filters by status", async () => {
    const { adminAuth, orders } = await fiveOrders();
    // Advance one order so the statuses differ:
    await request(app)
      .put(`/api/admin/orders/${orders[0]._id}`)
      .set("Authorization", adminAuth)
      .send({ status: "shipped" });

    const shipped = await request(app)
      .get("/api/admin/orders?status=shipped")
      .set("Authorization", adminAuth);
    expect(shipped.body.total).toBe(1);
    expect(shipped.body.orders[0]._id).toBe(orders[0]._id);

    const pending = await request(app)
      .get("/api/admin/orders?status=pending")
      .set("Authorization", adminAuth);
    expect(pending.body.total).toBe(4);
  });

  it("clamps garbage pagination instead of computing negative skips", async () => {
    const { adminAuth } = await fiveOrders();

    const res = await request(app)
      .get("/api/admin/orders?page=-3&limit=-1")
      .set("Authorization", adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.orders).toHaveLength(1); // limit clamped to 1
  });

  it("refuses an unknown status filter with 400", async () => {
    const { auth } = await registerAdmin();

    const res = await request(app)
      .get("/api/admin/orders?status=teleported")
      .set("Authorization", auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/status/i);
  });
});
