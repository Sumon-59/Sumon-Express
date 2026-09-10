// Slice 10 — store settings: the singleton lifecycle (one document, ever),
// choke-point validation, public read / admin-only partial write.

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin } from "./helpers";

const getSettings = () => request(app).get("/api/settings");
const putSettings = (auth, body) =>
  request(app).put("/api/admin/settings").set("Authorization", auth).send(body);

describe("settings singleton lifecycle", () => {
  it("first GET answers complete defaults (today's hardcoded brand)", async () => {
    const res = await getSettings();
    expect(res.status).toBe(200);
    expect(res.body.storeName).toBe("Sumon Express");
    expect(res.body.accentColor).toBe("#ea580c");
    // Every documented field is present — the storefront can trust the shape.
    for (const field of [
      "storeName",
      "logoUrl",
      "accentColor",
      "heroHeadline",
      "heroSubtitle",
      "heroImageUrl",
      "announcement",
      "footerText",
    ]) {
      expect(res.body[field], field).toBeDefined();
    }
  });

  it("PUT changes what it sends and ONLY what it sends (partial merge)", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });

    await putSettings(auth, { storeName: "Rebranded", accentColor: "#2563EB" });
    let view = (await getSettings()).body;
    expect(view.storeName).toBe("Rebranded");
    expect(view.accentColor).toBe("#2563eb"); // stored lowercase

    // A second PUT touching one field leaves the first change intact.
    await putSettings(auth, { announcement: "Eid sale — free shipping!" });
    view = (await getSettings()).body;
    expect(view.storeName).toBe("Rebranded");
    expect(view.announcement).toBe("Eid sale — free shipping!");
  });

  it("the collection holds exactly ONE document after reads and writes", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });
    await getSettings();
    await putSettings(auth, { footerText: "hello" });
    await putSettings(auth, { heroHeadline: "New drop" });
    await getSettings();

    const { default: StoreSettings } = await import("../src/models/StoreSettings.model");
    expect(await StoreSettings.countDocuments()).toBe(1);
  });
});

describe("settings validation (the choke point)", () => {
  it("refuses bad accent colors with a named 400; accepts 3- and 6-digit hex", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });

    for (const accentColor of ["red", "#12345", "ea580c", "#ggg", ""]) {
      const res = await putSettings(auth, { accentColor });
      expect(res.status, `accent ${JSON.stringify(accentColor)}`).toBe(400);
      expect(res.body.message).toMatch(/accent/i);
    }
    expect((await putSettings(auth, { accentColor: "#ABC" })).status).toBe(200);
    expect((await getSettings()).body.accentColor).toBe("#abc");
  });

  it("caps lengths and refuses an empty store name, naming the field", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });

    const name = await putSettings(auth, { storeName: "x".repeat(61) });
    expect(name.status).toBe(400);
    expect(name.body.message).toMatch(/name/i);

    const headline = await putSettings(auth, { heroHeadline: "x".repeat(121) });
    expect(headline.status).toBe(400);
    expect(headline.body.message).toMatch(/headline/i);

    const empty = await putSettings(auth, { storeName: "   " });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toMatch(/name/i);
  });

  it("URL fields must be http(s) when non-empty; empty string clears", async () => {
    const { auth } = await registerAdmin({ email: "admin@example.com" });

    const bad = await putSettings(auth, { logoUrl: "not a url" });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/logo/i);

    expect(
      (await putSettings(auth, { logoUrl: "https://cdn.example.com/logo.png" })).status
    ).toBe(200);
    expect((await putSettings(auth, { logoUrl: "" })).status).toBe(200);
    expect((await getSettings()).body.logoUrl).toBe("");
  });
});

describe("settings auth", () => {
  it("GET is public; PUT is admin-only", async () => {
    expect((await getSettings()).status).toBe(200);

    expect(
      (await request(app).put("/api/admin/settings").send({ storeName: "x" })).status
    ).toBe(401);

    const { auth } = await registerUser({ email: "user@example.com" });
    expect((await putSettings(auth, { storeName: "x" })).status).toBe(403);
  });
});
