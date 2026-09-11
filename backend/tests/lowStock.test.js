// Slice 15 — low-stock alerts. Two surfaces: an edge-triggered email
// fired from the SAME stock engine order creation already uses (never a
// second, hand-rolled decrement path), and a static survey endpoint for
// everything currently at/below the threshold regardless of how it got
// there.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { outbox, resetMailFake } from "../src/mail/fake";
import {
  registerUser,
  registerAdmin,
  plantProduct,
  plantDiscount,
  placeOrder,
  ensureShipping,
} from "./helpers";

beforeEach(() => {
  resetMailFake();
});

// ensureShipping plants the free "standard" method only on the settings
// document's FIRST insert ($setOnInsert) — called here, before any admin
// settings PUT, so the low-stock threshold write below doesn't create
// the singleton first and silently skip it.
// Every order ALSO sends the Slice 13 buyer confirmation — filter it
// out so these assertions read the low-stock alert specifically.
const lowStockMails = () => outbox.filter((m) => m.subject.startsWith("Low stock:"));

const stockOf = async (product) =>
  (await request(app).get(`/api/products/${product._id}`)).body.stock;

async function setThreshold(admin, threshold) {
  await ensureShipping();
  const res = await request(app)
    .put("/api/admin/settings")
    .set("Authorization", admin)
    .send({ lowStockThreshold: threshold });
  if (res.status !== 200) {
    throw new Error(`setThreshold fixture failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

describe("lowStockThreshold validation", () => {
  it("accepts 0 (disables) and positive integers up to 10000", async () => {
    const { auth: admin } = await registerAdmin();
    for (const value of [0, 1, 5, 10000]) {
      const body = await setThreshold(admin, value);
      expect(body.lowStockThreshold).toBe(value);
    }
  });

  it("rejects negative, non-integer, and over-range values (named 400)", async () => {
    const { auth: admin } = await registerAdmin();
    for (const bad of [-1, 1.5, 10001, "5"]) {
      const res = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", admin)
        .send({ lowStockThreshold: bad });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/threshold/i);
    }
  });

  it("omitted in a PUT leaves the stored value untouched", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 7);
    const res = await request(app)
      .put("/api/admin/settings")
      .set("Authorization", admin)
      .send({ storeName: "Renamed" });
    expect(res.body.lowStockThreshold).toBe(7);
  });
});

describe("edge-triggered low-stock email on order creation", () => {
  it("a claim that drops a plain product from above to at/below threshold alerts once", async () => {
    const { auth: admin, user: adminUser } = await registerAdmin();
    await setThreshold(admin, 5);
    const product = await plantProduct({ name: "Blue Mug", price: 100, stock: 7 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 3); // 7 -> 4, crosses 5

    expect(lowStockMails()).toHaveLength(1);
    expect(lowStockMails()[0].to).toBe(adminUser.email);
    expect(lowStockMails()[0].subject).toContain("Blue Mug");
    expect(lowStockMails()[0].text).toContain("Blue Mug");
    expect(lowStockMails()[0].text).toContain("4 left");
  });

  it("a further claim that stays below threshold does NOT alert again (edge, not level)", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    const product = await plantProduct({ name: "Blue Mug", price: 100, stock: 7 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 3); // 7 -> 4, crosses — alerts
    expect(lowStockMails()).toHaveLength(1);
    outbox.length = 0;

    await placeOrder(auth, product, 1); // 4 -> 3, already below — silent
    expect(lowStockMails()).toHaveLength(0);
  });

  it("a variant claim crossing the threshold names the variant, not just the product", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    const product = await plantProduct({
      name: "Shirt",
      price: 100,
      optionName: "Size",
      variants: [{ name: "M", stock: 6 }, { name: "L", stock: 20 }],
      stock: 26,
    });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 2, {
      items: [{ product: product._id.toString(), quantity: 2, variant: "M" }],
    });

    expect(lowStockMails()).toHaveLength(1);
    expect(lowStockMails()[0].text).toContain("Shirt · M");
    expect(lowStockMails()[0].text).toContain("4 left"); // the VALUE's own stock, 6 - 2
    expect(lowStockMails()[0].text).not.toMatch(/Shirt · L/);
  });

  it("lands exactly on the boundary: a single-unit order dropping stock to == threshold alerts", async () => {
    // The tightest edge the crossing formula (`stock <= threshold &&
    // stock + quantity > threshold`) implies: pre-claim 6 > 5, one unit
    // claimed lands post-claim stock at EXACTLY 5 — still a crossing.
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    const product = await plantProduct({ name: "Mug", price: 100, stock: 6 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 1); // 6 -> 5

    expect(lowStockMails()).toHaveLength(1);
    expect(lowStockMails()[0].text).toContain("5 left");
  });

  it("one order crossing two lines sends ONE email per admin, not two", async () => {
    const { auth: admin1, user: adminUser1 } = await registerAdmin({ email: "admin1@example.com" });
    await setThreshold(admin1, 5);
    const { user: adminUser2 } = await registerAdmin({ email: "admin2@example.com" });
    const mug = await plantProduct({ name: "Mug", price: 50, stock: 6 });
    const plate = await plantProduct({ name: "Plate", price: 30, stock: 6 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, mug, 2, {
      items: [
        { product: mug._id.toString(), quantity: 2 },
        { product: plate._id.toString(), quantity: 2 },
      ],
    });

    expect(lowStockMails()).toHaveLength(2); // one per admin
    for (const email of [adminUser1.email, adminUser2.email]) {
      const mail = lowStockMails().find((m) => m.to === email);
      expect(mail, `expected an alert addressed to ${email}`).toBeTruthy();
      expect(mail.text).toContain("Mug");
      expect(mail.text).toContain("Plate");
      expect(mail.subject).toContain("2 items");
    }
  });

  it("staff and plain users are never recipients (admin-only)", async () => {
    const { auth: admin, user: adminUser } = await registerAdmin();
    await setThreshold(admin, 5);
    const { user: staffUser } = await registerUser({ email: "staff@example.com" });
    await request(app)
      .put(`/api/admin/customers/${staffUser._id}/role`)
      .set("Authorization", admin)
      .send({ role: "staff" });
    const product = await plantProduct({ name: "Mug", price: 50, stock: 6 });
    const { auth: buyerAuth, user: buyerUser } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(buyerAuth, product, 2);

    // Not just "staff wasn't included" — the recipient set is EXACTLY
    // the admins, nothing more and nothing less.
    expect(lowStockMails().map((m) => m.to)).toEqual([adminUser.email]);
    expect(lowStockMails().every((m) => m.to !== staffUser.email && m.to !== buyerUser.email)).toBe(
      true
    );
    expect(outbox.some((m) => m.to === staffUser.email)).toBe(false);
  });

  it("lowStockThreshold: 0 sends nothing regardless of resulting stock", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 0);
    const product = await plantProduct({ name: "Mug", price: 50, stock: 1 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 1); // 1 -> 0

    expect(lowStockMails()).toHaveLength(0);
  });

  it("a crossing whose order fails BEFORE any stock claim (discount already exhausted) sends NO email", async () => {
    // resolveDiscount runs before the claim loop (order.controller.ts) —
    // an already-exhausted code refuses cheaply, with nothing to roll
    // back. This pins the cheap-refusal path; the genuine ROLLBACK path
    // (stock claimed, a LATER step fails) is the next test.
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    await plantDiscount({ code: "ONCE", type: "percent", value: 10, usageLimit: 1, usedCount: 1 });
    const product = await plantProduct({ name: "Mug", price: 100, stock: 6 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", auth)
      .send({
        items: [{ product: product._id.toString(), quantity: 3 }], // would cross 5, but never claimed
        shippingAddress: { address: "House 1, Road 2", city: "Dhaka", phone: "01700000000" },
        shippingMethod: "standard",
        discountCode: "ONCE", // already exhausted — refused before the claim loop even runs
      });

    expect(res.status).toBe(400);
    expect(await stockOf(product)).toBe(6); // untouched — there was nothing to roll back
    expect(outbox).toHaveLength(0);
  });

  it("a crossing that IS claimed, then rolled back by a later save failure, sends NO email", async () => {
    // The Slice 5 rollback lever, reused: a plain OBJECT where the phone
    // STRING belongs fails Mongoose's cast at order.save() — AFTER the
    // stock claim loop has already run and recorded a crossing. This is
    // the genuine "claimed, then undone" path the earlier test (above)
    // does not exercise, since that one never reaches the claim loop.
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    const product = await plantProduct({ name: "Mug", price: 100, stock: 6 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", auth)
      .send({
        items: [{ product: product._id.toString(), quantity: 3 }], // 6 -> 3, crosses 5 — claimed
        shippingAddress: { address: "H1", city: "Dhaka", phone: { evil: true } }, // save() throws
        shippingMethod: "standard",
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await stockOf(product)).toBe(6); // claimed, THEN restored
    expect(outbox).toHaveLength(0); // the crossing never survived to a committed order
  });
});

describe("GET /api/admin/products/low-stock", () => {
  it("plain products at/below threshold, one row per low variant value, sorted ascending", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    await plantProduct({ name: "Low Mug", stock: 3 });
    await plantProduct({ name: "Fine Mug", stock: 50 });
    await plantProduct({
      name: "Shirt",
      optionName: "Size",
      variants: [{ name: "S", stock: 1 }, { name: "M", stock: 4 }, { name: "L", stock: 50 }],
      stock: 55,
    });

    const res = await request(app)
      .get("/api/admin/products/low-stock")
      .set("Authorization", admin);

    expect(res.status).toBe(200);
    expect(res.body.threshold).toBe(5);
    const names = res.body.items.map((i) => `${i.name}${i.variantName ? ` · ${i.variantName}` : ""}`);
    expect(names).toEqual(["Shirt · S", "Low Mug", "Shirt · M"]); // ascending by stock: 1, 3, 4
    expect(names).not.toContain("Fine Mug");
    expect(names).not.toContain("Shirt · L");
    // Variant products never get a bare product-level row.
    expect(res.body.items.some((i) => i.name === "Shirt" && !i.variantName)).toBe(false);
  });

  it("staff and plain users are refused (401/403)", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 5);
    const { auth: userAuth } = await registerUser({ email: "buyer@example.com" });

    const asUser = await request(app)
      .get("/api/admin/products/low-stock")
      .set("Authorization", userAuth);
    expect(asUser.status).toBe(403);

    const anon = await request(app).get("/api/admin/products/low-stock");
    expect(anon.status).toBe(401);
  });

  it("threshold 0 returns an empty list, not a 400 or a crash", async () => {
    const { auth: admin } = await registerAdmin();
    await setThreshold(admin, 0);
    await plantProduct({ name: "Empty Mug", stock: 0 });

    const res = await request(app)
      .get("/api/admin/products/low-stock")
      .set("Authorization", admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ threshold: 0, items: [] });
  });
});
