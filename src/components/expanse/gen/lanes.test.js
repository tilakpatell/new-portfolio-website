import { describe, expect, it } from "vitest";
import { LANES } from "../../universe/hyperlanes";
import { makeSector } from "./sector";
import { UNIVERSE } from "./seed";
import { sectorLanes, trunkBetween } from "./lanes";

const TESTED = [];
for (let sx = -3; sx <= 3; sx++)
  for (let sz = -2; sz <= 2; sz++)
    if ((sx || sz) && TESTED.length < 30) TESTED.push([sx, sz]);
const sectors = TESTED.map(([sx, sz]) => makeSector(UNIVERSE, sx, sz));
const lanesBefore = LANES.length;
const t0 = performance.now();
const webs = sectors.map(sectorLanes);
const took = performance.now() - t0;

// the nodes reachable from `from` over the lanes, either way along each
function reach(lanes, from) {
  const seen = new Set([from]);
  const todo = [from];
  while (todo.length) {
    const id = todo.pop();
    for (const l of lanes)
      for (const [a, b] of [
        [l.from, l.to],
        [l.to, l.from],
      ])
        if (a === id && !seen.has(b)) (seen.add(b), todo.push(b));
  }
  return seen;
}

describe("sectorLanes", () => {
  it("covers 30 sectors in under 3 s", () => {
    expect(sectors.length).toBe(30);
    expect(took).toBeLessThan(3000);
  });
  it("has a ramp for every system, the hub and the four edge beacons", () => {
    sectors.forEach((s, k) => {
      const { nodes } = webs[k];
      for (const sys of s.systems) {
        const ramp = nodes.find((n) => n.id === `ramp:${sys.id}`);
        expect(ramp).toMatchObject({
          kind: "ramp",
          place: sys.id,
          region: s.id,
          name: sys.name,
        });
        expect(ramp.at[1]).toBe(sys.at[1]);
      }
      expect(nodes.find((n) => n.id === `beacon:${s.id}:hub`)).toMatchObject({
        kind: "beacon",
        region: s.id,
      });
      for (const side of ["n", "e", "s", "w"])
        expect(nodes.find((n) => n.id === s.beacons[side].id)).toMatchObject({
          kind: "beacon",
          at: s.beacons[side].at,
        });
      expect(nodes.length).toBe(s.systems.length + 5);
      expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    });
  });
  it("joins every node to the hub", () => {
    sectors.forEach((s, k) => {
      const { nodes, lanes } = webs[k];
      expect(lanes.every(Boolean)).toBe(true);
      expect(lanes.length).toBe(s.systems.length + 4);
      const ids = new Set(nodes.map((n) => n.id));
      for (const l of lanes) {
        expect(ids.has(l.from) && ids.has(l.to)).toBe(true);
        expect(l.pts).toHaveLength(3);
        expect(l.length).toBeGreaterThan(0);
      }
      const seen = reach(lanes, `beacon:${s.id}:hub`);
      for (const n of nodes) expect(seen.has(n.id)).toBe(true);
      expect(lanes.filter((l) => l.tier === "trunk")).toHaveLength(4);
    });
  });
  it("joins up a sector whose hub has a star between it and a beacon", () => {
    // (E:-9,-9's east trunk can't get round the star by its hub)
    const s = makeSector(UNIVERSE, -9, -9);
    const { nodes, lanes } = sectorLanes(s);
    expect(lanes.every(Boolean)).toBe(true);
    const seen = reach(lanes, `beacon:${s.id}:hub`);
    for (const n of nodes) expect(seen.has(n.id)).toBe(true);
    expect(lanes.find((l) => l.to === s.beacons.e.id).from).toMatch(/^ramp:/);
  });
  it("keeps the hub and ramps off the stars", () => {
    sectors.forEach((s, k) => {
      for (const n of webs[k].nodes)
        for (const sys of s.systems)
          expect(
            Math.hypot(...n.at.map((v, i) => v - sys.at[i])),
          ).toBeGreaterThan(sys.star.size * 2);
    });
  });
  it("is deterministic", () => {
    expect(sectorLanes(makeSector(UNIVERSE, 2, -1))).toEqual(
      sectorLanes(makeSector(UNIVERSE, 2, -1)),
    );
  });
  it("is empty for the authored map", () => {
    expect(sectorLanes(makeSector(UNIVERSE, 0, 0))).toEqual({
      nodes: [],
      lanes: [],
    });
  });
  it("leaves the authored map's lanes alone", () => {
    expect(LANES.length).toBe(lanesBefore);
  });
});

describe("trunkBetween", () => {
  const pairs = [
    [
      [2, 1],
      [3, 1],
    ],
    [
      [-1, -2],
      [-1, -1],
    ],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, -1],
    ],
  ];
  for (const [p, q] of pairs)
    it(`is the same lane both ways between ${p} and ${q}`, () => {
      const a = makeSector(UNIVERSE, ...p),
        b = makeSector(UNIVERSE, ...q);
      const ab = trunkBetween(a, b),
        ba = trunkBetween(b, a);
      expect(ab.tier).toBe("trunk");
      expect(ab.id).toBe(ba.id);
      expect(ab.from).toBe(
        Object.values(a.beacons).find((x) => x.id === ab.from).id,
      );
      expect(ab.to).toBe(
        Object.values(b.beacons).find((x) => x.id === ab.to).id,
      );
      expect(ba).toEqual({
        ...ab,
        from: ab.to,
        to: ab.from,
        pts: [ab.pts[2], ab.pts[1], ab.pts[0]],
      });
      expect(ab.pts[0]).toEqual(
        Object.values(a.beacons).find((x) => x.id === ab.from).at,
      );
      expect(ab.length).toBeGreaterThan(0);
      expect(trunkBetween(a, b)).toEqual(ab);
    });
  it("picks the beacons that face each other", () => {
    const a = makeSector(UNIVERSE, 2, 1),
      b = makeSector(UNIVERSE, 2, 2);
    const t = trunkBetween(a, b);
    expect(t.from).toBe(a.beacons.s.id);
    expect(t.to).toBe(b.beacons.n.id);
  });
  it("throws for sectors that don't share an edge", () => {
    const a = makeSector(UNIVERSE, 2, 1);
    expect(() => trunkBetween(a, makeSector(UNIVERSE, 3, 2))).toThrow();
    expect(() => trunkBetween(a, makeSector(UNIVERSE, 4, 1))).toThrow();
    expect(() => trunkBetween(a, a)).toThrow();
  });
});
