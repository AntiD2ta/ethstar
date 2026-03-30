import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

// Node 25 exposes a stub `localStorage` global that shadows happy-dom's
// implementation and lacks setItem/clear. Install a simple Map-backed
// polyfill so tests can use localStorage/sessionStorage reliably.
class MapStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// A single MapStorage instance is installed on both `globalThis` and `window`
// so that production code (which reads `window.localStorage`) and test helpers
// (which may use `globalThis.localStorage`) share the same backing store.
beforeAll(() => {
  const localStore = new MapStorage();
  const sessionStore = new MapStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: localStore,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: sessionStore,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: localStore,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      value: sessionStore,
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
