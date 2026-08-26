import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom = a fake browser DOM, so components can render in tests
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      // keep the "@/..." imports working in tests, same as tsconfig paths
      "@": rootDir,
    },
  },
});
