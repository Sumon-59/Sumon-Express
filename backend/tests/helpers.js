// Shared test fixtures.
//
// Planting SETUP data via models is fine; ASSERTING via models is not —
// assertions always go through the public HTTP API.

import request from "supertest";
import app from "../app";
import Product from "../src/models/Product.model";
import User from "../src/models/User.model";
import Discount from "../src/models/Discount.model";

// Register a user through the public API and keep the cookie jar (the
// "jwt" httpOnly cookie) so later requests are authenticated — exactly
// what a browser does automatically.
export async function registerUser(overrides = {}) {
  const user = {
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    ...overrides,
  };
  const res = await request(app).post("/api/auth/register").send(user);
  return {
    res,
    user,
    cookies: res.headers["set-cookie"],
    accessToken: res.body.accessToken,
    // Convenience: the header protected routes now expect (Slice 1)
    auth: `Bearer ${res.body.accessToken}`,
  };
}

// Register through the public API, then (fixture, not assertion) flip
// the role in the database — there is deliberately no public route that
// grants admin.
export async function registerAdmin(overrides = {}) {
  const result = await registerUser({ email: "admin@example.com", ...overrides });
  await User.updateOne({ email: result.user.email }, { role: "admin" });
  return result;
}

// Place an order through the public API, exactly like a shopper would.
// Returns the created order body (status starts as "pending").
// `extra` merges into the payload (e.g. { discountCode: "EID10" }).
export async function placeOrder(auth, product, quantity = 2, extra = {}) {
  const res = await request(app)
    .post("/api/orders")
    .set("Authorization", auth)
    .send({
      items: [{ product: product._id.toString(), quantity }],
      shippingAddress: { address: "House 1, Road 2", city: "Dhaka", phone: "01700000000" },
      ...extra,
    });
  if (res.status !== 201) {
    throw new Error(`placeOrder fixture failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// Plant a discount code directly (fixture, like plantProduct). Defaults
// to a live 10% code with no minimum, no expiry, no usage limit.
export async function plantDiscount(overrides = {}) {
  return Discount.create({
    code: "EID10",
    type: "percent",
    value: 10,
    ...overrides,
  });
}

// Plant a product directly in the in-memory database (creating a
// product via API needs admin auth, which isn't under test here).
export async function plantProduct(overrides = {}) {
  let owner = await User.findOne();
  if (!owner) {
    owner = await User.create({
      name: "Owner",
      email: "owner@example.com",
      password: "not-a-real-hash",
    });
  }
  return Product.create({
    name: "Test Widget",
    description: "A widget for testing",
    price: 100,
    stock: 10,
    createdBy: owner._id,
    ...overrides,
  });
}
