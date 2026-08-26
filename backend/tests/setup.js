// Runs before every test file (see vitest.config.mjs).
//
// Job 1: set env vars BEFORE the app is imported, so nothing in the app
//        ever sees real secrets or the real database.
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
