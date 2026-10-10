import { describe, expect, it } from "vitest";
import { SECTOR, parseSector, sectorAt, sectorCentre, sectorId } from "./grid";

describe("grid", () => {
  it("sectors are 120,000 across, centred on multiples", () => {
    expect(SECTOR).toBe(120000);
    expect(sectorAt(0, 0)).toEqual([0, 0]);
    expect(sectorAt(59999, 0)).toEqual([0, 0]);
    expect(sectorAt(60001, 0)).toEqual([1, 0]);
    expect(sectorAt(-60001, 0)).toEqual([-1, 0]);
    expect(sectorAt(0, -180001)).toEqual([0, -2]);
    expect(sectorAt(240000, 119000)).toEqual([2, 1]);
  });
  it("never gives -0", () => {
    const [sx, sz] = sectorAt(-100, -59999);
    expect(Object.is(sx, 0)).toBe(true);
    expect(Object.is(sz, 0)).toBe(true);
  });
  it("names and parses sectors", () => {
    expect(sectorId(3, -2)).toBe("E:3,-2");
    expect(parseSector("E:3,-2")).toEqual([3, -2]);
    expect(parseSector(sectorId(-7, 0))).toEqual([-7, 0]);
    for (const bad of [
      "",
      "E:",
      "E:1",
      "E:1,2,3",
      "X:1,2",
      "E:a,2",
      "E:1.5,2",
      " E:1,2",
      null,
      undefined,
      5,
    ])
      expect(parseSector(bad)).toBeNull();
  });
  it("gives the centre", () => {
    expect(sectorCentre(2, -1)).toEqual([240000, 0, -120000]);
    expect(sectorCentre(...sectorAt(...[185184, 0].slice(0, 2)))).toEqual([
      240000, 0, 0,
    ]);
  });
});
