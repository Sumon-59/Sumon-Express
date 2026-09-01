// Integration tests for admin catalog management (Slice 2).
//
// Same seam discipline as always: everything through the HTTP API.
// Public visibility is proven through the PUBLIC endpoints — if the
// admin deactivates a product, shoppers' listing and detail must not
// show it, and that's exactly what we assert.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct } from "./helpers";

describe("product validation (create/update)", () => {
  let auth;
  beforeEach(async () => {
    ({ auth } = await registerAdmin());
  });

  const validBody = {
    name: "Test Gadget",
    description: "A gadget for testing",
    price: 500,
    stock: 10,
  };

  it("rejects a negative price with 400 naming the field", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ ...validBody, price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/price/i);
  });

  it("rejects fractional and negative stock", async () => {
    const fractional = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ ...validBody, stock: 2.5 });
    expect(fractional.status).toBe(400);
    expect(fractional.body.message).toMatch(/stock/i);

    const negative = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ ...validBody, stock: -1 });
    expect(negative.status).toBe(400);
  });

  it("rejects a discount equal to or above the price", async () => {
    const equal = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ ...validBody, discountPrice: 500 });
    expect(equal.status).toBe(400);
    expect(equal.body.message).toMatch(/discount/i);

    const above = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ ...validBody, discountPrice: 600 });
    expect(above.status).toBe(400);
  });

  it("rejects a partial update whose discount would exceed the UNCHANGED price", async () => {
    const product = await plantProduct({ price: 100 });

    // Only discountPrice is sent — it must be validated against the
    // existing price of 100, not waved through.
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", auth)
      .send({ discountPrice: 150 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/discount/i);
  });
});

describe("PUT /api/products/:id (partial update)", () => {
  it("changes only the provided fields", async () => {
    const { auth } = await registerAdmin();
    const product = await plantProduct({ name: "Original Name", price: 100, stock: 10 });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", auth)
      .send({ stock: 42 });

    expect(res.status).toBe(200);
    expect(res.body.stock).toBe(42);
    expect(res.body.name).toBe("Original Name");
    expect(res.body.price).toBe(100);
  });

  it("requires the admin role", async () => {
    const { auth } = await registerUser();
    const product = await plantProduct();

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", auth)
      .send({ stock: 1 });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/products/:id (soft delete)", () => {
  it("deactivates: the product vanishes from public listing and detail", async () => {
    const { auth } = await registerAdmin();
    const product = await plantProduct({ name: "Vanishing Widget" });

    const del = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", auth);
    expect(del.status).toBe(200);

    // Shoppers' view — both the listing and the direct link:
    const listing = await request(app).get("/api/products");
    expect(listing.body.products.map((p) => p.name)).not.toContain("Vanishing Widget");

    const detail = await request(app).get(`/api/products/${product._id}`);
    expect(detail.status).toBe(404);
  });

  it("answers 401 anonymous and 403 non-admin", async () => {
    const product = await plantProduct();

    const anon = await request(app).delete(`/api/products/${product._id}`);
    expect(anon.status).toBe(401);

    const { auth } = await registerUser();
    const nonAdmin = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", auth);
    expect(nonAdmin.status).toBe(403);
  });
});
