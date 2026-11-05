import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Radix form controls measure their hidden input in real browsers.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
