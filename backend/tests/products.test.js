// Integration tests for the products seam: GET /api/products
//
// The catalog is public (no login), so these tests are the simplest in
// the suite: plant products, ask the API, check what a shopper sees.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { plantProduct } from "./helpers";

describe("GET /api/products", () => {
  it("lists only active products", async () => {
    await plantProduct({ name: "Visible One" });
    await plantProduct({ name: "Visible Two" });
    await plantProduct({ name: "Hidden", isActive: false });

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const names = res.body.products.map((p) => p.name);
    expect(names).toContain("Visible One");
    expect(names).not.toContain("Hidden");
  });

  it("paginates: 3 products with limit=2 gives 2 pages", async () => {
    await plantProduct({ name: "A" });
    await plantProduct({ name: "B" });
    await plantProduct({ name: "C" });

    const res = await request(app).get("/api/products?limit=2&page=1");

    expect(res.body.products).toHaveLength(2);
    expect(res.body.pages).toBe(2);
    expect(res.body.total).toBe(3);
  });

  it("searches by name with ?q=", async () => {
    await plantProduct({ name: "Red Shirt" });
    await plantProduct({ name: "Blue Pant" });

    const res = await request(app).get("/api/products?q=shirt");

    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe("Red Shirt");
  });
});
