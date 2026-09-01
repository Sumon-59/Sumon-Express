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

describe("GET /api/admin/products", () => {
  it("answers 401 anonymous and 403 non-admin", async () => {
    const anon = await request(app).get("/api/admin/products");
    expect(anon.status).toBe(401);

    const { auth } = await registerUser();
    const nonAdmin = await request(app)
      .get("/api/admin/products")
      .set("Authorization", auth);
    expect(nonAdmin.status).toBe(403);
  });

  it("shows every status, and the status filter narrows it", async () => {
    const { auth } = await registerAdmin();
    await plantProduct({ name: "Active One" });
    await plantProduct({ name: "Hidden One", isActive: false });

    const all = await request(app).get("/api/admin/products").set("Authorization", auth);
    expect(all.body.total).toBe(2);

    const inactive = await request(app)
      .get("/api/admin/products?status=inactive")
      .set("Authorization", auth);
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.products[0].name).toBe("Hidden One");

    const active = await request(app)
      .get("/api/admin/products?status=active")
      .set("Authorization", auth);
    expect(active.body.total).toBe(1);
    expect(active.body.products[0].name).toBe("Active One");
  });

  it("searches by name and paginates like the public listing", async () => {
    const { auth } = await registerAdmin();
    await plantProduct({ name: "Red Shirt" });
    await plantProduct({ name: "Red Hat", isActive: false });
    await plantProduct({ name: "Blue Pant" });

    const search = await request(app)
      .get("/api/admin/products?q=red")
      .set("Authorization", auth);
    expect(search.body.total).toBe(2); // finds the inactive one too

    const paged = await request(app)
      .get("/api/admin/products?limit=2&page=2")
      .set("Authorization", auth);
    expect(paged.body.pages).toBe(2);
    expect(paged.body.products).toHaveLength(1);
  });
});

describe("the catalog lifecycle story", () => {
  it("create → edit → deactivate → admin-only → reactivate → public again", async () => {
    const { auth } = await registerAdmin();

    // Create through the API, like the form will:
    const created = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({
        name: "Story Widget",
        description: "Lives a full life",
        price: 1000,
        discountPrice: 800,
        stock: 5,
      });
    expect(created.status).toBe(201);
    const id = created.body._id;

    // Edit: restock and cut the price.
    const edited = await request(app)
      .put(`/api/products/${id}`)
      .set("Authorization", auth)
      .send({ stock: 20, discountPrice: 700 });
    expect(edited.status).toBe(200);
    expect(edited.body.stock).toBe(20);

    // Deactivate: shoppers lose it…
    await request(app).delete(`/api/products/${id}`).set("Authorization", auth);
    const publicView = await request(app).get(`/api/products/${id}`);
    expect(publicView.status).toBe(404);

    // …but the admin still sees it, marked inactive:
    const adminView = await request(app)
      .get("/api/admin/products?status=inactive")
      .set("Authorization", auth);
    expect(adminView.body.products.map((p) => p.name)).toContain("Story Widget");

    // Reactivate: back on sale.
    const revived = await request(app)
      .put(`/api/products/${id}`)
      .set("Authorization", auth)
      .send({ isActive: true });
    expect(revived.status).toBe(200);

    const backPublic = await request(app).get(`/api/products/${id}`);
    expect(backPublic.status).toBe(200);
    expect(backPublic.body.name).toBe("Story Widget");
  });
});

describe("GET /api/admin/products/:id", () => {
  it("returns an INACTIVE product to the admin (public detail would 404)", async () => {
    const { auth } = await registerAdmin();
    const product = await plantProduct({ name: "Archived Widget", isActive: false });

    const publicView = await request(app).get(`/api/products/${product._id}`);
    expect(publicView.status).toBe(404);

    const adminView = await request(app)
      .get(`/api/admin/products/${product._id}`)
      .set("Authorization", auth);
    expect(adminView.status).toBe(200);
    expect(adminView.body.name).toBe("Archived Widget");
  });
});

describe("validation closes the review-found bypass paths", () => {
  let auth;
  beforeEach(async () => {
    ({ auth } = await registerAdmin());
  });

  it("rejects an update clearing the name (400 naming the field, not a 500)", async () => {
    const product = await plantProduct();
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", auth)
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  it("rejects a create without a description, naming the field", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", auth)
      .send({ name: "No Description", price: 100, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/description/i);
  });

  it("rejects a malformed category id with 400, not a cast crash", async () => {
    const product = await plantProduct();
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", auth)
      .send({ category: "not-an-object-id" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/category/i);
  });
});
