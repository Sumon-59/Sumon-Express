// Slice 4 — the customer census: aggregation-computed columns asserted
// through the HTTP API against known fixtures. The pipeline is an
// implementation detail; these numbers are the contract.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import User from "../src/models/User.model";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

// The census fixture: A spent 200 over two orders, B spent 300 over
// one, C never ordered, and one admin who must not appear.
async function census() {
  const { auth: aAuth } = await registerUser({ name: "Alice", email: "a@example.com" });
  const { auth: bAuth } = await registerUser({ name: "Bob", email: "b@example.com" });
  await registerUser({ name: "Carol", email: "c@example.com" });
  const { auth: adminAuth } = await registerAdmin();

  const product = await plantProduct({ stock: 100 }); // price 100
  const a1 = await placeOrder(aAuth, product, 1); // 100
  const a2 = await placeOrder(aAuth, product, 1); // 100 → A total 200
  const b1 = await placeOrder(bAuth, product, 3); // 300 → B total 300

  const ids = {};
  for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
    ids[email] = (await User.findOne({ email }))._id.toString();
  }
  return { aAuth, bAuth, adminAuth, product, orders: { a1, a2, b1 }, ids };
}

const getCensus = (adminAuth, query = "") =>
  request(app).get(`/api/admin/customers${query}`).set("Authorization", adminAuth);

describe("GET /api/admin/customers — the census", () => {
  it("computes orderCount, totalSpent, and lastOrderAt per customer, biggest spender first", async () => {
    const { adminAuth, orders } = await census();

    const res = await getCensus(adminAuth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);

    const [bob, alice, carol] = res.body.customers;

    expect(bob.email).toBe("b@example.com");
    expect(bob.orderCount).toBe(1);
    expect(bob.totalSpent).toBe(300);
    expect(bob.lastOrderAt).toBe(orders.b1.createdAt);

    expect(alice.email).toBe("a@example.com");
    expect(alice.orderCount).toBe(2);
    expect(alice.totalSpent).toBe(200);
    expect(alice.lastOrderAt).toBe(orders.a2.createdAt);

    // The census, not a leaderboard: Carol appears with zeroes.
    expect(carol.email).toBe("c@example.com");
    expect(carol.orderCount).toBe(0);
    expect(carol.totalSpent).toBe(0);
    expect(carol.lastOrderAt).toBeNull();
  });

  it("excludes admin accounts from the census", async () => {
    const { adminAuth } = await census();
    const res = await getCensus(adminAuth);
    expect(res.body.customers.map((c) => c.email)).not.toContain("admin@example.com");
  });

  it("counts a cancelled order for nothing", async () => {
    const { adminAuth, orders } = await census();

    // Cancel Bob's only order through the API:
    await request(app)
      .put(`/api/admin/orders/${orders.b1._id}/cancel`)
      .set("Authorization", adminAuth);

    const res = await getCensus(adminAuth);
    const bob = res.body.customers.find((c) => c.email === "b@example.com");
    expect(bob.orderCount).toBe(0);
    expect(bob.totalSpent).toBe(0);
    expect(bob.lastOrderAt).toBeNull();

    // And the ranking reflects it: Alice is now the best customer.
    expect(res.body.customers[0].email).toBe("a@example.com");
  });

  it("sort=newest lists most recent signups first", async () => {
    const { adminAuth } = await census();

    const res = await getCensus(adminAuth, "?sort=newest");
    // Registration order was Alice, Bob, Carol → newest first reverses it.
    expect(res.body.customers.map((c) => c.email)).toEqual([
      "c@example.com",
      "b@example.com",
      "a@example.com",
    ]);
  });

  it("refuses an unknown sort with 400", async () => {
    const { auth } = await registerAdmin();
    const res = await request(app)
      .get("/api/admin/customers?sort=alphabetical")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sort/i);
  });

  it("paginates with the standard wrapper", async () => {
    const { adminAuth } = await census();

    const res = await getCensus(adminAuth, "?page=2&limit=2");
    expect(res.body.total).toBe(3);
    expect(res.body.pages).toBe(2);
    expect(res.body.page).toBe(2);
    expect(res.body.customers).toHaveLength(1); // Carol, the zero-spender
    expect(res.body.customers[0].email).toBe("c@example.com");
  });

  it("answers 401 anonymous and 403 non-admin", async () => {
    const { aAuth } = await census();

    expect((await request(app).get("/api/admin/customers")).status).toBe(401);
    expect(
      (await request(app).get("/api/admin/customers").set("Authorization", aAuth)).status
    ).toBe(403);
  });
});

describe("GET /api/admin/customers/:id — one customer's numbers", () => {
  it("answers identity plus the computed columns", async () => {
    const { adminAuth, ids, orders } = await census();

    const res = await request(app)
      .get(`/api/admin/customers/${ids["a@example.com"]}`)
      .set("Authorization", adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice");
    expect(res.body.email).toBe("a@example.com");
    expect(res.body.orderCount).toBe(2);
    expect(res.body.totalSpent).toBe(200);
    expect(res.body.lastOrderAt).toBe(orders.a2.createdAt);
  });

  it("404s an unknown id and an admin id; 400s a malformed id", async () => {
    const { adminAuth } = await census();
    const adminUser = await User.findOne({ email: "admin@example.com" });

    const unknown = await request(app)
      .get("/api/admin/customers/64b000000000000000000000")
      .set("Authorization", adminAuth);
    expect(unknown.status).toBe(404);

    const admin = await request(app)
      .get(`/api/admin/customers/${adminUser._id}`)
      .set("Authorization", adminAuth);
    expect(admin.status).toBe(404);

    const malformed = await request(app)
      .get("/api/admin/customers/not-an-id")
      .set("Authorization", adminAuth);
    expect(malformed.status).toBe(400);
  });
});

describe("GET /api/admin/orders?user= — one customer's history", () => {
  it("returns only that customer's orders", async () => {
    const { adminAuth, ids } = await census();

    const res = await request(app)
      .get(`/api/admin/orders?user=${ids["a@example.com"]}`)
      .set("Authorization", adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    for (const order of res.body.orders) {
      expect(order.user.email).toBe("a@example.com");
    }
  });

  it("refuses a malformed user id with 400", async () => {
    const { auth } = await registerAdmin();
    const res = await request(app)
      .get("/api/admin/orders?user=not-an-id")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });
});
