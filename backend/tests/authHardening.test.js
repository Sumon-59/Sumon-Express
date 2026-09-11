// Slice 14 — auth & authorization hardening at the HTTP seam.
// The threat matrix: no enumeration, tokens hashed at rest and
// single-use, global revocation on credential change, login
// notifications, and the staff role held to EXACTLY orders.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { outbox, resetMailFake } from "../src/mail/fake";
import User from "../src/models/User.model";
import { registerUser, registerAdmin, plantProduct, placeOrder } from "./helpers";

beforeEach(resetMailFake);

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

// Pull the raw reset token out of the emailed link (the fake outbox is
// the only place the raw token ever exists after the response).
const tokenFromMail = () => {
  const match = outbox
    .map((m) => m.text.match(/reset-password\?token=([a-f0-9]+)/))
    .find(Boolean);
  return match ? match[1] : null;
};

describe("forgot-password (no enumeration)", () => {
  it("answers the SAME 200 for real and unknown emails; mails only the real one", async () => {
    await registerUser({ email: "real@example.com" });
    resetMailFake();

    const real = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "real@example.com" });
    const fake = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(real.status).toBe(200);
    expect(fake.status).toBe(200);
    expect(real.body).toEqual(fake.body); // identical — nothing to enumerate

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("real@example.com");
    expect(tokenFromMail()).toBeTruthy();
  });

  it("stores only a HASH of the token — the raw token never touches the DB", async () => {
    const { user } = await registerUser({ email: "real@example.com" });
    resetMailFake();
    await request(app).post("/api/auth/forgot-password").send({ email: user.email });

    const raw = tokenFromMail();
    const doc = await User.findOne({ email: user.email }).select("+resetTokenHash");
    expect(doc.resetTokenHash).toBeTruthy();
    expect(doc.resetTokenHash).not.toBe(raw);
    expect(doc.resetTokenHash).toHaveLength(64); // sha256 hex
  });
});

describe("reset-password", () => {
  async function requestReset(email) {
    resetMailFake();
    await request(app).post("/api/auth/forgot-password").send({ email });
    return tokenFromMail();
  }

  it("the emailed token resets the password ONCE; old sessions die; confirmation sent", async () => {
    const { user, cookies } = await registerUser({ email: "r@example.com" });
    const token = await requestReset(user.email);
    resetMailFake();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "new-password-9" });
    expect(res.status).toBe(200);

    expect((await login(user.email, user.password)).status).toBe(401); // old refused
    expect((await login(user.email, "new-password-9")).status).toBe(200); // new works

    // Global revocation: the pre-reset refresh cookie can't mint tokens.
    const refresh = await request(app).get("/api/auth/refresh").set("Cookie", cookies);
    expect(refresh.status).toBeGreaterThanOrEqual(401);

    // Confirmation email (not the reset link — a changed notice):
    expect(outbox.some((m) => /changed/i.test(m.subject + m.text))).toBe(true);

    // Single-use: the same token again → the one named 400.
    const again = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "another-pass-9" });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/invalid or expired/i);
  });

  it("garbage and expired tokens get the SAME named 400", async () => {
    const { user } = await registerUser({ email: "r@example.com" });
    const token = await requestReset(user.email);

    const garbage = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "deadbeef".repeat(8), password: "whatever-99" });
    expect(garbage.status).toBe(400);

    // Force expiry (fixture, not a wait):
    await User.updateOne(
      { email: user.email },
      { resetTokenExpires: new Date(Date.now() - 1000) }
    );
    const expired = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "whatever-99" });
    expect(expired.status).toBe(400);
    expect(expired.body.message).toBe(garbage.body.message); // indistinguishable
  });

  it("applies the password policy", async () => {
    const { user } = await registerUser({ email: "r@example.com" });
    const token = await requestReset(user.email);
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
  });
});

describe("password change (authenticated)", () => {
  it("proves the current password; rotates the session; emails a confirmation", async () => {
    const { auth, user } = await registerUser({ email: "c@example.com" });
    resetMailFake();

    const wrong = await request(app)
      .put("/api/auth/password")
      .set("Authorization", auth)
      .send({ currentPassword: "nope-nope-1", newPassword: "brand-new-99" });
    expect(wrong.status).toBe(400);
    expect((await login(user.email, user.password)).status).toBe(200); // unchanged

    const res = await request(app)
      .put("/api/auth/password")
      .set("Authorization", auth)
      .send({ currentPassword: user.password, newPassword: "brand-new-99" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy(); // caller keeps a session
    expect(res.headers["set-cookie"]?.join("")).toContain("jwt="); // fresh cookie

    expect((await login(user.email, user.password)).status).toBe(401);
    expect((await login(user.email, "brand-new-99")).status).toBe(200);
    expect(outbox.some((m) => /changed/i.test(m.subject + m.text))).toBe(true);
  });

  it("refuses a weak new password with the shared policy", async () => {
    const { auth, user } = await registerUser({ email: "c@example.com" });
    const res = await request(app)
      .put("/api/auth/password")
      .set("Authorization", auth)
      .send({ currentPassword: user.password, newPassword: "tiny" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
  });

  it("register now enforces the same policy", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "X", email: "weak@example.com", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
  });
});

describe("login notification", () => {
  it("one email on success, none on failure", async () => {
    const { user } = await registerUser({ email: "n@example.com" });
    resetMailFake();

    await login(user.email, "wrong-password");
    expect(outbox).toHaveLength(0);

    await login(user.email, user.password);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    expect(outbox[0].subject).toMatch(/sign.?in|login/i);
  });
});

describe("RBAC: staff manage orders and NOTHING else", () => {
  async function registerStaff(email = "staff@example.com") {
    const result = await registerUser({ email });
    await User.updateOne({ email }, { role: "staff" });
    // Fresh login so the token's session reflects the role.
    const res = await login(email, result.user.password);
    return { auth: `Bearer ${res.body.accessToken}` };
  }

  it("staff can list orders, advance status, and cancel", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth: shopper } = await registerUser({ email: "s@example.com" });
    const order = await placeOrder(shopper, product, 1);
    const { auth: staff } = await registerStaff();

    expect(
      (await request(app).get("/api/admin/orders").set("Authorization", staff)).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(`/api/admin/orders/${order._id}`)
          .set("Authorization", staff)
          .send({ status: "processing" })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(`/api/admin/orders/${order._id}/cancel`)
          .set("Authorization", staff)
      ).status
    ).toBe(200);
  });

  it("staff are refused everywhere else; plain users refused on orders", async () => {
    const { auth: staff } = await registerStaff();

    const refusals = [
      ["put", "/api/admin/settings", { storeName: "X" }],
      ["get", "/api/admin/discounts", null],
      ["get", "/api/admin/products", null],
      ["get", "/api/admin/customers", null],
      ["get", "/api/admin/analytics", null],
      ["post", "/api/admin/uploads/signature", {}],
      ["get", "/api/admin/mail-status", null],
      ["get", "/api/admin/dashboard", null],
      // Admin-gated routes OUTSIDE admin.routes.ts — exactly where a
      // future regression would slip past an admin-router-only matrix:
      ["post", "/api/products", { name: "X" }],
      ["post", "/api/categories", { name: "X" }],
    ];
    for (const [method, url, body] of refusals) {
      const req = request(app)[method](url).set("Authorization", staff);
      const res = await (body ? req.send(body) : req);
      expect(res.status, `${method} ${url}`).toBe(403);
    }

    const { auth: user } = await registerUser({ email: "plain@example.com" });
    expect(
      (await request(app).get("/api/admin/orders").set("Authorization", user)).status
    ).toBe(403);
  });

  it("admins set roles within the closed set; no admin-minting; no self-demotion", async () => {
    const { auth: admin } = await registerAdmin({ email: "boss@example.com" });
    const { res: created } = await registerUser({ email: "emp@example.com" });
    void created;
    const emp = await User.findOne({ email: "emp@example.com" });
    const adminDoc = await User.findOne({ email: "boss@example.com" });

    const promote = await request(app)
      .put(`/api/admin/customers/${emp._id}/role`)
      .set("Authorization", admin)
      .send({ role: "staff" });
    expect(promote.status).toBe(200);
    expect((await User.findById(emp._id)).role).toBe("staff");

    // Staff REMAIN in the census (they shop too), row carries the role:
    const census = await request(app)
      .get("/api/admin/customers")
      .set("Authorization", admin);
    const row = census.body.customers.find((c) => c.email === "emp@example.com");
    expect(row).toBeTruthy();
    expect(row.role).toBe("staff");

    const demote = await request(app)
      .put(`/api/admin/customers/${emp._id}/role`)
      .set("Authorization", admin)
      .send({ role: "user" });
    expect(demote.status).toBe(200);

    const mint = await request(app)
      .put(`/api/admin/customers/${emp._id}/role`)
      .set("Authorization", admin)
      .send({ role: "admin" });
    expect(mint.status).toBe(400);

    const garbage = await request(app)
      .put(`/api/admin/customers/${emp._id}/role`)
      .set("Authorization", admin)
      .send({ role: "superuser" });
    expect(garbage.status).toBe(400);

    // Staff shop too: analytics customer counts must not lose them.
    await User.updateOne({ email: "emp@example.com" }, { role: "staff" });
    const analytics = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", admin);
    // boss (admin) excluded; emp (staff) + any shoppers counted:
    expect(analytics.body.totals.customers).toBe(
      await User.countDocuments({ role: { $ne: "admin" } })
    );

    const self = await request(app)
      .put(`/api/admin/customers/${adminDoc._id}/role`)
      .set("Authorization", admin)
      .send({ role: "user" });
    expect(self.status).toBe(400);

    // Staff cannot reach the role route at all:
    await User.updateOne({ email: "emp@example.com" }, { role: "staff" });
    const staffLogin = await login("emp@example.com", "password123");
    const staffTry = await request(app)
      .put(`/api/admin/customers/${adminDoc._id}/role`)
      .set("Authorization", `Bearer ${staffLogin.body.accessToken}`)
      .send({ role: "user" });
    expect(staffTry.status).toBe(403);
  });
});
