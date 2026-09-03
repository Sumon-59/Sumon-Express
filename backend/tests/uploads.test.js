// Slice 2b — the signature endpoint (signed direct upload).
//
// The browser never gets the Cloudinary API secret; it gets a SHA-1
// signature computed WITH the secret on the server. These tests prove
// the endpoint is admin-gated and that the signature matches
// Cloudinary's documented scheme — recomputed here byte-for-byte with
// the fake test secret, no network involved.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import request from "supertest";
import app from "../app";
import { registerUser, registerAdmin } from "./helpers";

const SIGNATURE_URL = "/api/admin/uploads/signature";

describe("POST /api/admin/uploads/signature", () => {
  it("requires login", async () => {
    const res = await request(app).post(SIGNATURE_URL);
    expect(res.status).toBe(401);
  });

  it("rejects non-admins", async () => {
    const { auth } = await registerUser();
    const res = await request(app).post(SIGNATURE_URL).set("Authorization", auth);
    expect(res.status).toBe(403);
  });

  it("gives an admin everything the browser needs for a direct upload", async () => {
    const { auth } = await registerAdmin();
    const res = await request(app).post(SIGNATURE_URL).set("Authorization", auth);

    expect(res.status).toBe(200);
    // Public identifiers echo the environment (fakes set in setup.js).
    expect(res.body.cloudName).toBe("test-cloud");
    expect(res.body.apiKey).toBe("test-api-key");
    // The folder is chosen by the SERVER (it is signed — the browser
    // cannot redirect uploads elsewhere).
    expect(res.body.folder).toBe("sumon-express/products");
    // Timestamp is unix SECONDS and fresh (Cloudinary rejects stale ones).
    const now = Math.floor(Date.now() / 1000);
    expect(res.body.timestamp).toBeGreaterThan(now - 60);
    expect(res.body.timestamp).toBeLessThanOrEqual(now + 5);
    // The secret itself must never be in the response.
    expect(JSON.stringify(res.body)).not.toContain("test-cloudinary-secret");
  });

  it("signs folder+timestamp exactly as Cloudinary will verify it", async () => {
    const { auth } = await registerAdmin();
    const res = await request(app).post(SIGNATURE_URL).set("Authorization", auth);

    // Cloudinary's scheme: sorted key=value pairs joined by "&", secret
    // appended, SHA-1 hex. Recomputing it independently proves our
    // server implements the contract — without calling Cloudinary.
    const expected = createHash("sha1")
      .update(
        `folder=${res.body.folder}&timestamp=${res.body.timestamp}` +
          "test-cloudinary-secret"
      )
      .digest("hex");
    expect(res.body.signature).toBe(expected);
  });
});
