// Slice 7 — variants: one option axis per product, per-value stock,
// price overrides, and the stock engine's variant-aware claim/restore.
// The whole matrix runs at the HTTP seam; stock proofs go through the
// public product endpoint, as always.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct } from "./helpers";

// A t-shirt in S/M/L: 5 + 3 + 2 = 10 total.
const shirtVariants = () => ({
  optionName: "Size",
  variants: [
    { name: "S", stock: 5 },
    { name: "M", stock: 3 },
    { name: "L", stock: 2, price: 120 }, // L costs more
  ],
});

const plantShirt = (extra = {}) =>
  plantProduct({ name: "Shirt", price: 100, ...shirtVariants(), ...extra });

const orderBody = (lines) => ({
  items: lines,
  shippingAddress: { address: "H1", city: "Dhaka", phone: "01700000000" },
});

const postOrder = (auth, lines) =>
  request(app).post("/api/orders").set("Authorization", auth).send(orderBody(lines));

const publicView = async (product) =>
  (await request(app).get(`/api/products/${product._id}`)).body;

describe("ordering variant products", () => {
  let auth;
  beforeEach(async () => {
    ({ auth } = await registerUser());
  });

  it("decrements the chosen value AND the sum; siblings untouched", async () => {
    const shirt = await plantShirt();

    const res = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 2, variant: "M" },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.items[0].variantName).toBe("M");
    expect(res.body.totalPrice).toBe(200);

    const view = await publicView(shirt);
    expect(view.stock).toBe(8); // 10 - 2
    const byName = Object.fromEntries(view.variants.map((v) => [v.name, v.stock]));
    expect(byName).toEqual({ S: 5, M: 1, L: 2 });
  });

  it("charges the value's price override; sale price applies where no override", async () => {
    const shirt = await plantShirt({ discountPrice: 80 });

    // L has an override (120) — it beats the sale price:
    const l = await postOrder(auth, [{ product: shirt._id.toString(), quantity: 1, variant: "L" }]);
    expect(l.body.totalPrice).toBe(120);

    // S has no override — the sale price (80) applies:
    const s = await postOrder(auth, [{ product: shirt._id.toString(), quantity: 1, variant: "S" }]);
    expect(s.body.totalPrice).toBe(80);
  });

  it("allows S and M of one shirt in one order; refuses a repeated product+value pair", async () => {
    const shirt = await plantShirt();

    const ok = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 1, variant: "S" },
      { product: shirt._id.toString(), quantity: 1, variant: "M" },
    ]);
    expect(ok.status).toBe(201);

    const dup = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 1, variant: "S" },
      { product: shirt._id.toString(), quantity: 2, variant: "S" },
    ]);
    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/duplicate/i);
  });

  it("refuses a missing value on a variant product, naming the axis", async () => {
    const shirt = await plantShirt();
    const res = await postOrder(auth, [{ product: shirt._id.toString(), quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/size/i);
    expect((await publicView(shirt)).stock).toBe(10);
  });

  it("refuses an unknown value", async () => {
    const shirt = await plantShirt();
    const res = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 1, variant: "XL" },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/XL/);
  });

  it("refuses a value sent for a plain product", async () => {
    const plain = await plantProduct();
    const res = await postOrder(auth, [
      { product: plain._id.toString(), quantity: 1, variant: "M" },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/variant|option/i);
  });

  it("refuses insufficient stock on the chosen value even when siblings have plenty", async () => {
    const shirt = await plantShirt(); // L has 2

    const res = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 3, variant: "L" },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stock/i);
    expect((await publicView(shirt)).stock).toBe(10);
  });

  it("rolls back variant AND plain decrements when a later line fails", async () => {
    const shirt = await plantShirt();
    const plain = await plantProduct({ name: "Mug", price: 50, stock: 4 });

    // Last line asks for more mugs than exist → whole order fails:
    const res = await postOrder(auth, [
      { product: shirt._id.toString(), quantity: 2, variant: "S" },
      { product: plain._id.toString(), quantity: 5 },
    ]);
    expect(res.status).toBe(400);

    const shirtView = await publicView(shirt);
    expect(shirtView.stock).toBe(10);
    expect(shirtView.variants.find((v) => v.name === "S").stock).toBe(5);
    expect((await publicView(plain)).stock).toBe(4);
  });
});

describe("cancelling variant orders restores the right value", () => {
  it("user cancel restores the value and the sum", async () => {
    const { auth } = await registerUser();
    const shirt = await plantShirt();
    const order = (
      await postOrder(auth, [{ product: shirt._id.toString(), quantity: 2, variant: "M" }])
    ).body;

    await request(app).put(`/api/orders/${order._id}/cancel`).set("Authorization", auth);

    const view = await publicView(shirt);
    expect(view.stock).toBe(10);
    expect(view.variants.find((v) => v.name === "M").stock).toBe(3);
  });

  it("admin cancel restores the value and the sum", async () => {
    const { auth } = await registerUser();
    const { auth: adminAuth } = await registerAdmin();
    const shirt = await plantShirt();
    const order = (
      await postOrder(auth, [{ product: shirt._id.toString(), quantity: 1, variant: "L" }])
    ).body;

    await request(app)
      .put(`/api/admin/orders/${order._id}/cancel`)
      .set("Authorization", adminAuth);

    const view = await publicView(shirt);
    expect(view.stock).toBe(10);
    expect(view.variants.find((v) => v.name === "L").stock).toBe(2);
  });

  it("axis replaced before cancel: stock returns to the top-level counter", async () => {
    const { auth } = await registerUser();
    const { auth: adminAuth } = await registerAdmin();
    const shirt = await plantShirt();
    const order = (
      await postOrder(auth, [{ product: shirt._id.toString(), quantity: 2, variant: "M" }])
    ).body;
    // Admin replaces the whole axis — "M" no longer exists:
    await request(app)
      .put(`/api/products/${shirt._id}`)
      .set("Authorization", adminAuth)
      .send({ optionName: "Size", variants: [{ name: "Small", stock: 5 }, { name: "Large", stock: 3 }] });

    await request(app).put(`/api/orders/${order._id}/cancel`).set("Authorization", auth);

    const view = await publicView(shirt);
    // Sum after replace was 8; the fallback restores the 2 to the top:
    expect(view.stock).toBe(10);
    // No value called M reappeared:
    expect(view.variants.map((v) => v.name).sort()).toEqual(["Large", "Small"]);
  });
});

describe("variant validation at the choke point", () => {
  let adminAuth;
  beforeEach(async () => {
    ({ auth: adminAuth } = await registerAdmin());
  });

  const create = (body) =>
    request(app)
      .post("/api/products")
      .set("Authorization", adminAuth)
      .send({ name: "Shirt", description: "d", price: 100, stock: 0, ...body });

  it("creates a variant product; top-level stock is the server-computed sum", async () => {
    const res = await create(shirtVariants());
    expect(res.status).toBe(201);
    expect(res.body.stock).toBe(10); // 5+3+2, whatever the client sent
    expect(res.body.optionName).toBe("Size");
  });

  it("names the field on every bad axis", async () => {
    const cases = [
      [{ variants: shirtVariants().variants }, /option/i], // values without a name
      [{ optionName: "Size", variants: [] }, /value|variant/i],
      [{ optionName: "Size", variants: [{ name: "S", stock: 1 }, { name: "S", stock: 2 }] }, /unique|duplicate/i],
      [{ optionName: "Size", variants: [{ name: "S", stock: -1 }] }, /stock/i],
      [{ optionName: "Size", variants: [{ name: "S", stock: 1.5 }] }, /stock/i],
      [{ optionName: "Size", variants: [{ name: "S", stock: 1, price: -5 }] }, /price/i],
      [{ optionName: "Size", variants: [{ name: "", stock: 1 }] }, /name/i],
    ];
    for (const [body, pattern] of cases) {
      const res = await create(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(pattern);
    }
  });

  it("plain products create and update exactly as before (regression)", async () => {
    const res = await create({});
    expect(res.status).toBe(201);
    expect(res.body.stock).toBe(0);
    expect(res.body.optionName).toBeUndefined();

    const upd = await request(app)
      .put(`/api/products/${res.body._id}`)
      .set("Authorization", adminAuth)
      .send({ stock: 7 });
    expect(upd.status).toBe(200);
    expect(upd.body.stock).toBe(7);
  });
});
