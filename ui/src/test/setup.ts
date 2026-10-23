import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { JSDOM } from "jsdom";
import { afterEach, vi } from "vitest";

// Node 25+ has its own localStorage/sessionStorage globals, which stop Vitest from installing
// jsdom's. Put jsdom's back so tests see real browser storage.
const dom = (globalThis as { jsdom?: JSDOM }).jsdom;
if (dom) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});
