// Shared test fixtures.
//
// Planting SETUP data via models is fine; ASSERTING via models is not —
// assertions always go through the public HTTP API.

import request from "supertest";
import app from "../app";
import Product from "../src/models/Product.model";
import User from "../src/models/User.model";

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
