// Slice 8 — search, filters, related products at the public seam.
//
// The teach moment lives here: $text (index: stemming, weights,
// relevance) vs regex (scan: partials, no ranking). The listing uses
// each for what it's good at; these tests pin both behaviors, plus the
// slice's trap — price filters must mean the EFFECTIVE price.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import Category from "../src/models/Category.model";
import { plantProduct } from "./helpers";

const list = (query = "") => request(app).get(`/api/products${query}`);
const names = (res) => res.body.products.map((p) => p.name);

describe("search: text index with regex fallback", () => {
  it("finds a word that lives only in the description", async () => {
    await plantProduct({ name: "Blue Shirt", description: "soft cotton comfort" });
    await plantProduct({ name: "Steel Mug", description: "keeps coffee hot" });

    const res = await list("?q=cotton");
    expect(names(res)).toEqual(["Blue Shirt"]);
  });

  it("ranks a name match above a description match for the same term", async () => {
    await plantProduct({ name: "Coffee Beans", description: "rich flavor" });
    await plantProduct({ name: "Steel Mug", description: "keeps coffee hot" });

    const res = await list("?q=coffee");
    expect(names(res)).toEqual(["Coffee Beans", "Steel Mug"]);
  });

  it("falls back to name regex for a partial the text index cannot match", async () => {
    await plantProduct({ name: "Blue Shirt", description: "soft cotton" });

    const res = await list("?q=shir");
    expect(names(res)).toEqual(["Blue Shirt"]);
  });

  it("never surfaces inactive products", async () => {
    await plantProduct({ name: "Ghost Shirt", description: "cotton", isActive: false });

    expect(names(await list("?q=cotton"))).toEqual([]);
    expect(names(await list("?q=ghost"))).toEqual([]);
  });
});

describe("filters: effective price and stock", () => {
  it("price bounds compare the SALE price, inclusive at both edges", async () => {
    // Sticker 600, on sale for 450 — a "under 500" shopper must see it.
    await plantProduct({ name: "Sale Item", price: 600, discountPrice: 450 });
    await plantProduct({ name: "Full Price", price: 500 });

    const under500 = await list("?maxPrice=450");
    expect(names(under500)).toEqual(["Sale Item"]); // inclusive at 450

    const over500 = await list("?minPrice=500");
    expect(names(over500)).toEqual(["Full Price"]); // 450 sale excluded, 500 inclusive
  });

  it("rejects non-numeric bounds with 400; min > max is a legal empty page", async () => {
    await plantProduct();

    expect((await list("?minPrice=abc")).status).toBe(400);
    expect((await list("?maxPrice=")).status).toBe(400);

    const empty = await list("?minPrice=900&maxPrice=100");
    expect(empty.status).toBe(200);
    expect(empty.body.products).toEqual([]);
    expect(empty.body.total).toBe(0);
  });

  it("inStock=true hides zero-stock but keeps variant products with any value in stock", async () => {
    await plantProduct({ name: "Gone", stock: 0 });
    await plantProduct({ name: "Here", stock: 3 });
    await plantProduct({
      name: "Shirt",
      stock: 2, // sum
      optionName: "Size",
      variants: [{ name: "S", stock: 0 }, { name: "M", stock: 2 }],
    });

    const res = await list("?inStock=true");
    expect(names(res).sort()).toEqual(["Here", "Shirt"]);
  });

  it("composes: q + category + price + inStock in one request", async () => {
    const cat = await Category.create({ name: "Apparel" });
    await plantProduct({ name: "Cotton Shirt", description: "cotton", price: 400, category: cat._id, stock: 5 });
    await plantProduct({ name: "Cotton Jacket", description: "cotton", price: 900, category: cat._id, stock: 5 });
    await plantProduct({ name: "Cotton Socks", description: "cotton", price: 300, stock: 0 }); // out of stock, no category

    const res = await list(`?q=cotton&category=${cat._id}&maxPrice=500&inStock=true`);
    expect(names(res)).toEqual(["Cotton Shirt"]);
  });
});

describe("GET /api/products/:id/related", () => {
  it("answers same-category active siblings, self excluded, capped at 4, newest first", async () => {
    const cat = await Category.create({ name: "Mugs" });
    const self = await plantProduct({ name: "My Mug", category: cat._id });
    for (let i = 1; i <= 5; i++) {
      await plantProduct({ name: `Sibling ${i}`, category: cat._id });
    }
    await plantProduct({ name: "Hidden", category: cat._id, isActive: false });
    await plantProduct({ name: "Other Cat" }); // no category

    const res = await request(app).get(`/api/products/${self._id}/related`);
    expect(res.status).toBe(200);
    const got = res.body.map((p) => p.name);
    expect(got).toHaveLength(4);
    expect(got).toEqual(["Sibling 5", "Sibling 4", "Sibling 3", "Sibling 2"]); // newest first
    expect(got).not.toContain("My Mug");
    expect(got).not.toContain("Hidden");
  });

  it("answers an empty list for an uncategorized product", async () => {
    const loner = await plantProduct({ name: "Loner" });
    await plantProduct({ name: "Unrelated" });

    const res = await request(app).get(`/api/products/${loner._id}/related`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("404s unknown and inactive products", async () => {
    const dead = await plantProduct({ isActive: false });

    expect((await request(app).get(`/api/products/${dead._id}/related`)).status).toBe(404);
    expect(
      (await request(app).get("/api/products/64b000000000000000000000/related")).status
    ).toBe(404);
  });
});
