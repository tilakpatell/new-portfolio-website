import { describe, expect, it } from "vitest";
import { MAP_RADIUS, SECTORS, SECTOR_RADIUS } from "../../universe/layout";
import { REGIONS } from "../../universe/regions";
import { SECTOR, facing, makeSector, neighbours } from "./sector";
import { UNIVERSE, universeOf } from "./seed";
import { HAZARDS, PLANET_TYPES, STAR_CLASSES, WONDER_KINDS } from "./tables";

const level = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const TESTED = [];
for (let sx = -7; sx <= 7; sx++)
  for (let sz = -7; sz <= 7; sz++)
    if ((sx || sz) && TESTED.length < 200) TESTED.push([sx, sz]);
const sectors = TESTED.map(([sx, sz]) => makeSector(UNIVERSE, sx, sz));

describe("makeSector", () => {
  it("is a pure function of its arguments", () => {
    expect(makeSector(UNIVERSE, 3, -2)).toEqual(makeSector(UNIVERSE, 3, -2));
    expect(makeSector(UNIVERSE, -1, 0)).toEqual(makeSector(UNIVERSE, -1, 0));
  });
  it("differs by universe", () => {
    const a = makeSector(UNIVERSE, 3, -2),
      b = makeSector(universeOf("elsewhere"), 3, -2);
    expect(a.systems.map((s) => s.at)).not.toEqual(b.systems.map((s) => s.at));
  });
  it("has its id, origin and seed", () => {
    const s = makeSector(UNIVERSE, 3, -2);
    expect(s.id).toBe("E:3,-2");
    expect([s.sx, s.sz]).toEqual([3, -2]);
    expect(s.origin).toEqual([3 * SECTOR, 0, -2 * SECTOR]);
    expect(typeof s.seed).toBe("bigint");
  });
  it("places 8 to 24 systems, apart, in its square", () => {
    expect(sectors.length).toBe(200);
    for (const s of sectors) {
      expect(s.systems.length).toBeGreaterThanOrEqual(8);
      expect(s.systems.length).toBeLessThanOrEqual(24);
      for (const sys of s.systems) {
        expect(Math.abs(sys.at[0] - s.origin[0])).toBeLessThanOrEqual(
          SECTOR / 2 - 2000,
        );
        expect(Math.abs(sys.at[2] - s.origin[2])).toBeLessThanOrEqual(
          SECTOR / 2 - 2000,
        );
      }
      for (let i = 0; i < s.systems.length; i++)
        for (let j = i + 1; j < s.systems.length; j++)
          expect(
            level(s.systems[i].at, s.systems[j].at),
          ).toBeGreaterThanOrEqual(6000);
      for (const w of s.wonders)
        for (const sys of s.systems)
          expect(level(w.at, sys.at)).toBeGreaterThanOrEqual(3000);
      expect(s.wonders.length).toBeLessThanOrEqual(3);
    }
  });
  it("keeps clear of the authored map and the Rick and Morty pocket", () => {
    for (const [sx, sz] of neighbours(0, 0).concat([
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])) {
      const s = makeSector(UNIVERSE, sx, sz);
      for (const b of [...s.systems, ...s.wonders]) {
        expect(level(b.at, [0, 0, 0])).toBeGreaterThanOrEqual(
          MAP_RADIUS + 4000,
        );
        expect(level(b.at, SECTORS.rickmorty.origin)).toBeGreaterThanOrEqual(
          SECTOR_RADIUS.rickmorty + 4000,
        );
      }
    }
  });
  it("leaves the authored sector empty, with the home beacons", () => {
    const s = makeSector(UNIVERSE, 0, 0);
    expect(s.id).toBe("E:0,0");
    expect(s.systems).toEqual([]);
    expect(s.wonders).toEqual([]);
    const out = Math.hypot(REGIONS[0].hub[0], REGIONS[0].hub[2]);
    const at = (a) => [Math.sin(a) * out, REGIONS[0].hub[1], Math.cos(a) * out];
    expect(s.beacons.s.at).toEqual(at(0));
    expect(s.beacons.e.at).toEqual(at(Math.PI / 2));
    expect(s.beacons.n.at).toEqual(at(Math.PI));
    expect(s.beacons.w.at).toEqual(at(-Math.PI / 2));
  });
  it("puts a beacon in the middle of each side", () => {
    const s = makeSector(UNIVERSE, 2, 5);
    const [cx, , cz] = s.origin,
      edge = SECTOR / 2 - 2000;
    expect(s.beacons.n).toMatchObject({ id: "beacon:E:2,5:n", side: "n" });
    expect(s.beacons.n.at[2]).toBe(cz - edge);
    expect(s.beacons.s.at[2]).toBe(cz + edge);
    expect(s.beacons.e.at[0]).toBe(cx + edge);
    expect(s.beacons.w.at[0]).toBe(cx - edge);
    for (const side of ["n", "s"])
      expect(Math.abs(s.beacons[side].at[0] - cx)).toBeLessThanOrEqual(3000);
    for (const side of ["e", "w"])
      expect(Math.abs(s.beacons[side].at[2] - cz)).toBeLessThanOrEqual(3000);
    for (const b of Object.values(s.beacons))
      expect(Math.abs(b.at[1])).toBeLessThanOrEqual(200);
  });
  it("gives each system a star, 1 to 7 planets and the rest", () => {
    const types = PLANET_TYPES.map((p) => p.type),
      classes = STAR_CLASSES.map((c) => c.class);
    for (const s of sectors.slice(0, 40))
      for (const sys of s.systems) {
        expect(sys.id).toBe(`${s.id}:${sys.i}`);
        expect(classes).toContain(sys.star.class);
        expect(sys.star.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(["core", "rim", "drift"]).toContain(sys.culture);
        expect(sys.name).toMatch(/^[A-Z]/);
        expect(sys.designation).toMatch(/^[A-Z]{2}-\d{3}$/);
        expect(sys.traffic >= 0 && sys.traffic <= 1).toBe(true);
        expect(HAZARDS).toContain(sys.hazard);
        expect(sys.faction).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
        });
        expect(sys.planets.length).toBeGreaterThanOrEqual(1);
        expect(sys.planets.length).toBeLessThanOrEqual(7);
        let last = 0,
          lastR = 0;
        sys.planets.forEach((p, j) => {
          expect(p.id).toBe(`${sys.id}:${j}`);
          expect(types).toContain(p.type);
          expect(p.orbit).toBeGreaterThanOrEqual(sys.star.size * 3);
          expect(p.orbit).toBeLessThanOrEqual(2600);
          if (j)
            expect(p.orbit - last).toBeGreaterThanOrEqual(
              2 * Math.max(p.radius, lastR),
            );
          expect(
            Math.hypot(p.at[0] - sys.at[0], p.at[2] - sys.at[2]),
          ).toBeCloseTo(p.orbit, 6);
          expect(Number.isInteger(p.moons)).toBe(true);
          expect(typeof p.rings).toBe("boolean");
          last = p.orbit;
          lastR = p.radius;
        });
      }
  });
  it("gives wonders known kinds", () => {
    for (const s of sectors)
      for (const w of s.wonders) expect(WONDER_KINDS).toContain(w.kind);
    expect(sectors.some((s) => s.wonders.length)).toBe(true);
  });
  it("has unique ids", () => {
    const ids = sectors.flatMap((s) => [
      s.id,
      ...s.systems.flatMap((sys) => [sys.id, ...sys.planets.map((p) => p.id)]),
      ...s.wonders.map((w) => w.id),
      ...Object.values(s.beacons).map((b) => b.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("is quick", () => {
    const t = performance.now();
    for (const [sx, sz] of TESTED) makeSector(UNIVERSE, sx + 100, sz);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("neighbours and facing", () => {
  it("lists the four edge neighbours", () => {
    expect(neighbours(2, -1)).toEqual([
      [2, -2],
      [3, -1],
      [2, 0],
      [1, -1],
    ]);
  });
  it("names the side a faces b by", () => {
    expect(facing([0, 0], [0, -1])).toBe("n");
    expect(facing([0, 0], [0, 1])).toBe("s");
    expect(facing([0, 0], [1, 0])).toBe("e");
    expect(facing([0, 0], [-1, 0])).toBe("w");
    expect(() => facing([0, 0], [1, 1])).toThrow();
    expect(() => facing([0, 0], [0, 2])).toThrow();
  });
});
