import { describe, expect, it } from "vitest";
import { SECTOR, parseSector, sectorAt, sectorCentre, sectorId } from "./grid";

describe("grid", () => {
  it("sectors are 80,000 across, centred on multiples", () => {
    expect(SECTOR).toBe(80000);
    expect(sectorAt(0, 0)).toEqual([0, 0]);
    expect(sectorAt(39999, 0)).toEqual([0, 0]);
    expect(sectorAt(40001, 0)).toEqual([1, 0]);
    expect(sectorAt(-40001, 0)).toEqual([-1, 0]);
    expect(sectorAt(0, -120001)).toEqual([0, -2]);
    expect(sectorAt(160000, 79000)).toEqual([2, 1]);
  });
  it("never gives -0", () => {
    const [sx, sz] = sectorAt(-100, -39999);
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
    expect(sectorCentre(2, -1)).toEqual([160000, 0, -80000]);
    expect(sectorCentre(...sectorAt(...[123456, 0].slice(0, 2)))).toEqual([
      160000, 0, 0,
    ]);
  });
});
