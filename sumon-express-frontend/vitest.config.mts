import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const rootDir = path.dirname(new URL(import.meta.url).pathname);

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
