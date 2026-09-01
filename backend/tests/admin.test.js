// Integration tests for the admin seam: /api/admin/*
//
// The role boundary is SERVER-side: 401 for anonymous callers, 403 for
// authenticated non-admins, 200 for admins. The frontend guard is only
// UX; these tests pin the real security line.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin } from "./helpers";

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
    const { auth } = await registerAdmin();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", auth);

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
