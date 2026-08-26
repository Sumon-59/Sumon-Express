import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.js"],
    // first run downloads a mongod binary; be generous
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});
