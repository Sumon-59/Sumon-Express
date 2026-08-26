// Runs before every test file (see vitest.config.mjs).
//
// Job 1: set env vars so the app never sees real secrets or the real
//        database. (Note: ESM imports hoist above these lines, so the
//        modules imported *here* load first — that's fine, because none
//        of them read env at import time, and this whole setup file
//        finishes before any TEST file imports the app.)
// Job 2: give each test file its own throwaway in-memory MongoDB.
// Job 3: wipe all data between tests, so no test depends on another.

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

import { beforeAll, afterEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
