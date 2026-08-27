// Integration tests for the auth seam: /api/auth/*
//
// "Integration" means: we call the real HTTP API with a fake browser
// (supertest) and assert only on what a real client could see —
// status codes, JSON bodies, cookies. We never peek into controllers
// or the database. If we refactor the internals tomorrow, these tests
// should still pass untouched. That's what makes them worth keeping.

import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { registerUser } from "./helpers";

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

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials and starts a session", async () => {
    const { user } = await registerUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"].join(";")).toContain("jwt=");
  });

  it("rejects a wrong password with 401 and no session cookie", async () => {
    const { user } = await registerUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("GET /api/auth/me", () => {
  it("returns the logged-in user for a valid access token", async () => {
    const { auth, user } = await registerUser();

    const res = await request(app).get("/api/auth/me").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    // The password must NEVER travel to the client:
    expect(res.body.user.password).toBeUndefined();
  });

  it("returns 401 with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a garbage token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer definitely-not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an EXPIRED access token", async () => {
    await registerUser();
    // Correctly signed with the real test secret, but already expired:
    const expired = jwt.sign({ userId: "0".repeat(24) }, "test-access-secret", {
      expiresIn: -10,
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/refresh", () => {
  it("issues a new working access token and rotates the cookie", async () => {
    const { cookies } = await registerUser();

    const refresh = await request(app).get("/api/auth/refresh").set("Cookie", cookies);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    // The new access token really works:
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`);
    expect(me.status).toBe(200);

    // Rotation: the OLD cookie has been replaced server-side, so using
    // it again must fail — a stolen old cookie dies at first reuse.
    const reuse = await request(app).get("/api/auth/refresh").set("Cookie", cookies);
    expect(reuse.status).toBe(403);
  });

  it("rejects a refresh with no cookie", async () => {
    const res = await request(app).get("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh path: no new access tokens after logout", async () => {
    const { cookies } = await registerUser();

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookies);
    expect(logout.status).toBe(204);

    // Canonical JWT: the in-memory access token dies with the tab and
    // expires within 15 minutes regardless. What logout must guarantee
    // is that the refresh cookie can never mint a new one.
    const refresh = await request(app).get("/api/auth/refresh").set("Cookie", cookies);
    expect([401, 403]).toContain(refresh.status);
  });
});
