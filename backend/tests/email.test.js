// Slice 13 — transactional email at the HTTP seam, mailer faked at
// the mailer interface (the payments-provider philosophy for mail).
// The fake records what crossed the boundary; fire-and-forget means a
// mail failure can NEVER fail a request — pinned below.

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { outbox, failNext } from "../src/mail/fake";
import {
  registerUser,
  registerAdmin,
  plantProduct,
  plantDiscount,
  placeOrder,
} from "./helpers";

beforeEach(() => {
  outbox.length = 0;
});

describe("order confirmation email", () => {
  it("one email to the buyer: items, shipping, discount, total", async () => {
    await plantDiscount({ code: "EID10", type: "percent", value: 10 });
    const product = await plantProduct({ name: "Blue Mug", price: 100, stock: 10 });
    const { auth, user } = await registerUser({ email: "buyer@example.com" });

    await placeOrder(auth, product, 2, { discountCode: "EID10" });

    expect(outbox).toHaveLength(1);
    const mail = outbox[0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toMatch(/order/i);
    expect(mail.text).toContain("Blue Mug");
    expect(mail.text).toMatch(/× 2|x 2/);
    expect(mail.text).toContain("Standard"); // shipping label
    expect(mail.text).toContain("EID10");
    expect(mail.text).toContain("180"); // (200 − 20) + 0
  });

  it("a refused order sends nothing", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", auth)
      .send({
        items: [{ product: product._id.toString(), quantity: 1 }],
        shippingMethod: "by-drone",
      });
    expect(res.status).toBe(400);
    expect(outbox).toHaveLength(0);
  });
});

describe("status change and cancellation emails", () => {
  it("each status move sends one email naming the new status", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth, user } = await registerUser({ email: "buyer@example.com" });
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    const order = await placeOrder(auth, product, 1);
    outbox.length = 0; // drop the confirmation

    for (const status of ["processing", "shipped", "delivered"]) {
      await request(app)
        .put(`/api/admin/orders/${order._id}`)
        .set("Authorization", admin)
        .send({ status });
    }

    expect(outbox).toHaveLength(3);
    expect(outbox.map((m) => m.to)).toEqual([user.email, user.email, user.email]);
    expect(outbox[0].text).toMatch(/processing/i);
    expect(outbox[1].text).toMatch(/shipped/i);
    expect(outbox[2].text).toMatch(/delivered/i);
  });

  it("user cancel and admin cancel each send one email saying who cancelled", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth } = await registerUser({ email: "buyer@example.com" });
    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });

    const a = await placeOrder(auth, product, 1);
    outbox.length = 0;
    await request(app).put(`/api/orders/${a._id}/cancel`).set("Authorization", auth);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].text).toMatch(/cancelled/i);
    expect(outbox[0].text).toMatch(/you cancelled|by you/i);

    const b = await placeOrder(auth, product, 1);
    outbox.length = 0;
    await request(app).put(`/api/admin/orders/${b._id}/cancel`).set("Authorization", admin);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].text).toMatch(/store|admin/i);
  });
});

describe("failure isolation (fire-and-forget is the contract)", () => {
  it("a throwing mailer never fails the request; the order still exists", async () => {
    const product = await plantProduct({ stock: 10 });
    const { auth } = await registerUser({ email: "buyer@example.com" });

    failNext();
    const order = await placeOrder(auth, product, 1); // throws internally if not 201

    const mine = await request(app).get("/api/orders/my-orders").set("Authorization", auth);
    expect(mine.body.orders.find((o) => o._id === order._id)).toBeTruthy();
  });
});

describe("mail-status diagnostic", () => {
  it("admin-only; answers the configured mailer", async () => {
    expect((await request(app).get("/api/admin/mail-status")).status).toBe(401);

    const { auth } = await registerUser({ email: "u@example.com" });
    expect(
      (await request(app).get("/api/admin/mail-status").set("Authorization", auth)).status
    ).toBe(403);

    const { auth: admin } = await registerAdmin({ email: "admin@example.com" });
    const res = await request(app).get("/api/admin/mail-status").set("Authorization", admin);
    expect(res.status).toBe(200);
    expect(res.body.mailer).toBe("fake");
    expect(res.body.from).toBeDefined();
  });
});
