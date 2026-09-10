// Slice 9 — reviews & ratings: the eligibility matrix, the one-review
// rule, and honest denormalized averages, all at the HTTP seam.
// Fixtures drive orders through the REAL status routes: eligibility
// means a DELIVERED order containing the product.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

// A user whose order for `product` sits at `status`.
async function buyerAt(status, product, email) {
  const { auth } = await registerUser({ email });
  const { auth: adminAuth } = await registerAdmin({ email: `admin-${email}` });
  const order = await placeOrder(auth, product, 1);
  if (status === "cancelled") {
    await request(app).put(`/api/orders/${order._id}/cancel`).set("Authorization", auth);
  } else if (status !== "pending") {
    await request(app)
      .put(`/api/admin/orders/${order._id}`)
      .set("Authorization", adminAuth)
      .send({ status });
  }
  return auth;
}

const postReview = (auth, product, body) =>
  request(app)
    .post(`/api/products/${product._id}/reviews`)
    .set("Authorization", auth)
    .send(body);

const productView = async (product) =>
  (await request(app).get(`/api/products/${product._id}`)).body;

describe("review eligibility (the verified-purchase rule)", () => {
  it("a delivered-order buyer can review; the review is verified", async () => {
    const product = await plantProduct({ stock: 50 });
    const auth = await buyerAt("delivered", product, "d@example.com");

    const res = await postReview(auth, product, { rating: 5, comment: "Great!" });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.verifiedPurchase).toBe(true);
  });

  it("refuses in-pipeline, cancelled, never-bought, and anonymous", async () => {
    const product = await plantProduct({ stock: 50 });

    const pending = await buyerAt("pending", product, "p@example.com");
    expect((await postReview(pending, product, { rating: 4 })).status).toBe(403);

    const shipped = await buyerAt("shipped", product, "s@example.com");
    expect((await postReview(shipped, product, { rating: 4 })).status).toBe(403);

    const cancelled = await buyerAt("cancelled", product, "c@example.com");
    expect((await postReview(cancelled, product, { rating: 4 })).status).toBe(403);

    const { auth: never } = await registerUser({ email: "n@example.com" });
    const res = await postReview(never, product, { rating: 4 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deliver/i);

    expect(
      (await request(app).post(`/api/products/${product._id}/reviews`).send({ rating: 4 }))
        .status
    ).toBe(401);
  });

  it("one review per buyer per product", async () => {
    const product = await plantProduct({ stock: 50 });
    const auth = await buyerAt("delivered", product, "d@example.com");

    await postReview(auth, product, { rating: 5 });
    const dup = await postReview(auth, product, { rating: 1 });
    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/already/i);
  });

  it("validates rating and comment with named 400s", async () => {
    const product = await plantProduct({ stock: 50 });
    const auth = await buyerAt("delivered", product, "d@example.com");

    for (const rating of [0, 6, 3.5, undefined]) {
      const res = await postReview(auth, product, { rating, comment: "x" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/rating/i);
    }
    const long = await postReview(auth, product, { rating: 4, comment: "x".repeat(1001) });
    expect(long.status).toBe(400);
    expect(long.body.message).toMatch(/comment/i);
  });
});

describe("denormalized average (recomputed, never incremented)", () => {
  it("create → second reviewer → edit → delete, avg honest at every step", async () => {
    const product = await plantProduct({ stock: 50 });
    const alice = await buyerAt("delivered", product, "a@example.com");
    const bob = await buyerAt("delivered", product, "b@example.com");

    const first = await postReview(alice, product, { rating: 5 });
    expect(first.status).toBe(201);
    let view = await productView(product);
    expect(view.ratingAvg).toBe(5);
    expect(view.ratingCount).toBe(1);

    await postReview(bob, product, { rating: 2 });
    view = await productView(product);
    expect(view.ratingAvg).toBe(3.5); // (5+2)/2
    expect(view.ratingCount).toBe(2);

    // Alice edits down to 3 → (3+2)/2 = 2.5
    await request(app)
      .put(`/api/reviews/${first.body._id}`)
      .set("Authorization", alice)
      .send({ rating: 3 });
    view = await productView(product);
    expect(view.ratingAvg).toBe(2.5);

    // Alice deletes → only Bob's 2 remains
    await request(app).delete(`/api/reviews/${first.body._id}`).set("Authorization", alice);
    view = await productView(product);
    expect(view.ratingAvg).toBe(2);
    expect(view.ratingCount).toBe(1);
  });

  it("deleting the last review returns the product to the zero state", async () => {
    const product = await plantProduct({ stock: 50 });
    const alice = await buyerAt("delivered", product, "a@example.com");

    const r = await postReview(alice, product, { rating: 4 });
    await request(app).delete(`/api/reviews/${r.body._id}`).set("Authorization", alice);

    const view = await productView(product);
    expect(view.ratingCount).toBe(0);
    expect(view.ratingAvg).toBe(0);
  });
});

describe("ownership and listing", () => {
  it("only the author edits or deletes; unknown 404", async () => {
    const product = await plantProduct({ stock: 50 });
    const alice = await buyerAt("delivered", product, "a@example.com");
    const { auth: mallory } = await registerUser({ email: "m@example.com" });

    const r = await postReview(alice, product, { rating: 4 });

    expect(
      (await request(app).put(`/api/reviews/${r.body._id}`).set("Authorization", mallory).send({ rating: 1 })).status
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/reviews/${r.body._id}`).set("Authorization", mallory)).status
    ).toBe(403);
    expect(
      (await request(app).put("/api/reviews/64b000000000000000000000").set("Authorization", alice).send({ rating: 1 })).status
    ).toBe(404);
  });

  it("lists publicly, newest first, with names but never emails", async () => {
    const product = await plantProduct({ stock: 50 });
    const alice = await buyerAt("delivered", product, "a@example.com");
    const bob = await buyerAt("delivered", product, "b@example.com");
    await postReview(alice, product, { rating: 5, comment: "First!" });
    await postReview(bob, product, { rating: 3, comment: "Second." });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.reviews[0].comment).toBe("Second."); // newest first
    expect(res.body.reviews[0].user.name).toBe("Test User");
    expect(res.body.reviews[0].user.email).toBeUndefined();
  });

  it("eligibility read answers all states", async () => {
    const product = await plantProduct({ stock: 50 });
    const alice = await buyerAt("delivered", product, "a@example.com");
    const { auth: never } = await registerUser({ email: "n@example.com" });

    const url = `/api/products/${product._id}/reviews/eligibility`;
    expect((await request(app).get(url)).status).toBe(401);

    const can = await request(app).get(url).set("Authorization", alice);
    expect(can.body).toEqual({ canReview: true, alreadyReviewed: false });

    await postReview(alice, product, { rating: 4 });
    const already = await request(app).get(url).set("Authorization", alice);
    expect(already.body).toEqual({ canReview: true, alreadyReviewed: true });

    const cant = await request(app).get(url).set("Authorization", never);
    expect(cant.body).toEqual({ canReview: false, alreadyReviewed: false });
  });
});
