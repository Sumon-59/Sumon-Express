// Integration tests for the auth seam: /api/auth/*
//
// "Integration" means: we call the real HTTP API with a fake browser
// (supertest) and assert only on what a real client could see —
// status codes, JSON bodies, cookies. We never peek into controllers
// or the database. If we refactor the internals tomorrow, these tests
// should still pass untouched. That's what makes them worth keeping.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

// A tiny helper: register a user and keep the cookie jar (the "jwt"
// httpOnly cookie) so later requests are authenticated — exactly what
// a browser does automatically.
async function registerUser(overrides = {}) {
  const user = {
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    ...overrides,
  };
  const res = await request(app).post("/api/auth/register").send(user);
  return { res, user, cookies: res.headers["set-cookie"] };
}

describe("POST /api/auth/register", () => {
  it("registers a new user and starts a session", async () => {
    const { res, cookies } = await registerUser();

    expect(res.status).toBe(201);
    // The session cookie is the contract the frontend depends on:
    expect(cookies.join(";")).toContain("jwt=");
    expect(cookies.join(";")).toContain("HttpOnly");
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser();
    const { res } = await registerUser(); // same email again

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects a registration with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-name@example.com" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the logged-in user when the session cookie is present", async () => {
    const { cookies, user } = await registerUser();

    const res = await request(app).get("/api/auth/me").set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    // The password must NEVER travel to the client:
    expect(res.body.user.password).toBeUndefined();
  });

  it("returns 401 with no cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session: /me stops working after logout", async () => {
    const { cookies } = await registerUser();

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookies);
    expect(logout.status).toBe(204);

    // The OLD cookie must now be useless — this is the exact bug we
    // fixed in v2 (logout didn't really revoke the session).
    const me = await request(app).get("/api/auth/me").set("Cookie", cookies);
    expect(me.status).toBe(401);
  });
});
