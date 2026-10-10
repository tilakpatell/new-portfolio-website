import { describe, expect, it } from "vitest";
import { BLOCKLIST, CULTURES, designation, nameOf } from "./names";
import { rngOf } from "./seed";

describe("nameOf", () => {
  it("is deterministic per seed", () => {
    const a = rngOf(1n),
      b = rngOf(1n);
    for (const c of CULTURES) expect(nameOf(a, c)).toBe(nameOf(b, c));
  });
  it("is mostly unique, title case, and clean", () => {
    for (const c of CULTURES) {
      const r = rngOf(77n);
      const names = Array.from({ length: 1000 }, () => nameOf(r, c));
      expect(new Set(names).size).toBeGreaterThanOrEqual(950);
      for (const n of names) expect(n).toMatch(/^[A-Z][a-z']+$/);
    }
  });
  it("never makes a blocklisted word", () => {
    const r = rngOf(5n);
    for (let i = 0; i < 5000; i++) {
      const n = nameOf(r, CULTURES[i % CULTURES.length]).toLowerCase();
      for (const w of BLOCKLIST) expect(n.includes(w)).toBe(false);
    }
  });
});

describe("designation", () => {
  it("looks like KX-417", () => {
    const r = rngOf(3n);
    for (let i = 0; i < 200; i++)
      expect(designation(r)).toMatch(/^[A-Z]{2}-\d{3}$/);
  });
});
