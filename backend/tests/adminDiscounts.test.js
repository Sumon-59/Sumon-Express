// Slice 5 — the preview endpoint and admin discount CRUD.
//
// Preview answers "what would this code do to this cart?" without
// consuming anything; the server recomputes the subtotal from DB
// prices (the client's math is never trusted). CRUD validation mirrors
// the product choke point: 400 naming the field.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, plantDiscount, placeOrder } from "./helpers";

const preview = (auth, code, product, quantity = 1) =>
  request(app)
    .post("/api/discounts/preview")
    .set("Authorization", auth)
    .send({ code, items: [{ product: product._id.toString(), quantity }] });

describe("POST /api/discounts/preview", () => {
  it("answers the server-computed numbers for a percent code", async () => {
    const { auth } = await registerUser();
    const product = await plantProduct({ price: 999 });
    await plantDiscount(); // EID10, 10%

    const res = await preview(auth, "eid10", product);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: "EID10",
      subtotal: 999,
      discountAmount: 99,
      total: 900,
    });
  });

  it("rejects with the named rule, like order creation would", async () => {
    const { auth } = await registerUser();
    const product = await plantProduct();
    await plantDiscount({ expiresAt: new Date(Date.now() - 86400000) });

    const res = await preview(auth, "EID10", product);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("consumes nothing: preview twice, the limit-1 code still works at order time", async () => {
    const { auth } = await registerUser();
    const product = await plantProduct({ price: 100 });
    await plantDiscount({ usageLimit: 1 });

    expect((await preview(auth, "EID10", product)).status).toBe(200);
    expect((await preview(auth, "EID10", product)).status).toBe(200);

    // The one real use is still available:
    const order = await placeOrder(auth, product, 1, { discountCode: "EID10" });
    expect(order.discount.amount).toBe(10);
  });

  it("requires login", async () => {
    const product = await plantProduct();
    const res = await request(app)
      .post("/api/discounts/preview")
      .send({ code: "EID10", items: [{ product: product._id.toString(), quantity: 1 }] });
    expect(res.status).toBe(401);
  });
});

describe("admin discount CRUD", () => {
  const create = (auth, body) =>
    request(app).post("/api/admin/discounts").set("Authorization", auth).send(body);

  it("creates a code, stored uppercase", async () => {
    const { auth } = await registerAdmin();

    const res = await create(auth, { code: "eid10", type: "percent", value: 10 });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("EID10");
    expect(res.body.isActive).toBe(true);
    expect(res.body.usedCount).toBe(0);
  });

  it("rejects invalid creates with 400s naming the field", async () => {
    const { auth } = await registerAdmin();

    const cases = [
      [{ type: "percent", value: 10 }, /code/i],
      [{ code: "X", type: "bogo", value: 10 }, /type/i],
      [{ code: "X", type: "percent", value: 0 }, /value/i],
      [{ code: "X", type: "percent", value: 150 }, /value/i],
      [{ code: "X", type: "fixed", value: 0 }, /value/i],
      [{ code: "X", type: "fixed", value: 500, minOrder: -1 }, /minimum|minOrder/i],
      [{ code: "X", type: "fixed", value: 500, usageLimit: 0 }, /usage/i],
    ];
    for (const [body, pattern] of cases) {
      const res = await create(auth, body);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(pattern);
    }
  });

  it("refuses a duplicate code even across casing", async () => {
    const { auth } = await registerAdmin();
    await plantDiscount(); // EID10

    const res = await create(auth, { code: "eid10", type: "fixed", value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exists/i);
  });

  it("updates partially, validating against effective values", async () => {
    const { auth } = await registerAdmin();
    const discount = await plantDiscount(); // percent 10

    const ok = await request(app)
      .put(`/api/admin/discounts/${discount._id}`)
      .set("Authorization", auth)
      .send({ value: 25 });
    expect(ok.status).toBe(200);
    expect(ok.body.value).toBe(25);

    // Still a percent code — 150 is out of range for the EFFECTIVE type:
    const bad = await request(app)
      .put(`/api/admin/discounts/${discount._id}`)
      .set("Authorization", auth)
      .send({ value: 150 });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/value/i);
  });

  it("deactivate is an update; shoppers are refused until reactivation", async () => {
    const { auth: adminAuth } = await registerAdmin();
    const { auth: userAuth } = await registerUser({ email: "shopper@example.com" });
    const product = await plantProduct();
    const discount = await plantDiscount();

    await request(app)
      .put(`/api/admin/discounts/${discount._id}`)
      .set("Authorization", adminAuth)
      .send({ isActive: false });

    const refused = await preview(userAuth, "EID10", product);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/active/i);

    await request(app)
      .put(`/api/admin/discounts/${discount._id}`)
      .set("Authorization", adminAuth)
      .send({ isActive: true });

    expect((await preview(userAuth, "EID10", product)).status).toBe(200);
  });

  it("404s an unknown id and 400s a malformed one", async () => {
    const { auth } = await registerAdmin();

    const unknown = await request(app)
      .put("/api/admin/discounts/64b000000000000000000000")
      .set("Authorization", auth)
      .send({ value: 5 });
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .put("/api/admin/discounts/nope")
      .set("Authorization", auth)
      .send({ value: 5 });
    expect(malformed.status).toBe(400);
  });

  it("fetches one discount by id (the edit page's read)", async () => {
    const { auth } = await registerAdmin();
    const discount = await plantDiscount();

    const res = await request(app)
      .get(`/api/admin/discounts/${discount._id}`)
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("EID10");

    const unknown = await request(app)
      .get("/api/admin/discounts/64b000000000000000000000")
      .set("Authorization", auth);
    expect(unknown.status).toBe(404);
  });

  it("lists newest first with the standard wrapper and usage counts", async () => {
    const { auth } = await registerAdmin();
    await plantDiscount({ code: "FIRST" });
    await plantDiscount({ code: "SECOND", usedCount: 7, usageLimit: 100 });

    const res = await request(app).get("/api/admin/discounts").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.discounts[0].code).toBe("SECOND"); // newest first
    expect(res.body.discounts[0].usedCount).toBe(7);
    expect(res.body.discounts[0].usageLimit).toBe(100);
  });

  it("answers 401 anonymous and 403 non-admin on every admin route", async () => {
    const { auth: userAuth } = await registerUser();

    expect((await request(app).get("/api/admin/discounts")).status).toBe(401);
    expect(
      (await request(app).get("/api/admin/discounts").set("Authorization", userAuth)).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/admin/discounts")
          .set("Authorization", userAuth)
          .send({ code: "X", type: "fixed", value: 5 })
      ).status
    ).toBe(403);
  });
});
