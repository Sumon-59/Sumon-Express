// Integration tests for the admin seam: /api/admin/*
//
// The role boundary is SERVER-side: 401 for anonymous callers, 403 for
// authenticated non-admins, 200 for admins. The frontend guard is only
// UX; these tests pin the real security line.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import User from "../src/models/User.model";
import { registerUser } from "./helpers";

// Register through the public API, then (fixture, not assertion) flip
// the role in the database — there is deliberately no public route that
// grants admin.
async function registerAdmin() {
  const { res, user } = await registerUser({ email: "admin@example.com" });
  await User.updateOne({ email: user.email }, { role: "admin" });
  return { accessToken: res.body.accessToken };
}

describe("GET /api/admin/orders", () => {
  it("answers 401 to anonymous callers", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("answers 403 to an authenticated non-admin", async () => {
    const { res: reg } = await registerUser();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin/i);
  });

  it("answers 200 with the order list to an admin", async () => {
    const { accessToken } = await registerAdmin();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects a garbage access token with 401", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
  });
});
