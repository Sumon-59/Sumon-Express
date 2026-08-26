// Runs before every test file (see vitest.config.mts).
// Adds matchers like expect(...).toBeInTheDocument() and cleans up
// rendered components + localStorage between tests.

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
