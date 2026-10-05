import { describe, expect, it } from 'vitest';
import { inPoly } from '../compound/plan';
import {
  BUILDINGS,
  CAST,
  DOOR_R,
  HERO,
  HERO_R,
  LAWN_W,
  PLACES,
  PORTAL,
  START,
  behindYaw,
  camRoom,
  cameraMove,
  collide,
  linesFor,
  nearCast,
  nearPlace,
  newHero,
  outside,
  progress,
  stepHero,
  underPortal,
  walkable,
} from './rules';

const DT = 1 / 60;
const walk = (h, move, seconds) => {
  for (let t = 0; t < seconds; t += DT) h = stepHero(h, move, DT);
  return h;
};
// a walk to (x, z) as the crow flies, giving up after `seconds`
const walkTo = (h, x, z, seconds = 40, run = true) => {
  for (let t = 0; t < seconds; t += DT) {
    const dx = x - h.x;
    const dz = z - h.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) break;
    h = stepHero(h, { x: dx / d, z: dz / d, run }, DT);
  }
  return h;
};
const inBuilding = (x, z) => BUILDINGS.some((b) => inPoly(x, z, b.foot));

describe('The compound, the world: the map', () => {
  it('starts you on the lawn, in the clear', () => {
    expect(inPoly(START.x, START.z, LAWN_W)).toBe(true);
    expect(walkable(START.x, START.z)).toBe(true);
  });

  it('has a door for each of the seven games, each on the lawn and clear of everything', () => {
    expect(PLACES.map((p) => p.id)).toEqual(['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'vault']);
    for (const p of PLACES) {
      expect(inPoly(p.x, p.z, LAWN_W), p.id).toBe(true);
      expect(walkable(p.x, p.z), p.id).toBe(true);
    }
  });

  it('puts each door in front of its own building', () => {
    const near = (id, place) => {
      const b = BUILDINGS.find((x) => x.id === id);
      const p = PLACES.find((x) => x.id === place);
      // a few metres in from the door is inside the building
      const ix = p.x - Math.cos(p.face) * 4;
      const iz = p.z + Math.sin(p.face) * 4;
      return inPoly(ix, iz, b.foot);
    };
    expect(near('wing', 'stark')).toBe(true);
    expect(near('training', 'cap')).toBe(true);
    expect(near('stalls', 'hawkeye')).toBe(true);
    expect(near('prow', 'widow')).toBe(true);
    expect(near('lab', 'banner')).toBe(true);
    expect(near('hangar', 'vault')).toBe(true);
  });

  it('keeps the doors apart, so only one is ever offered', () => {
    for (const a of PLACES)
      for (const b of PLACES) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}–${b.id}`).toBeGreaterThan(DOOR_R * 2);
  });

  it('can walk from the start to every door', () => {
    for (const p of PLACES) {
      // round the buildings by way of the middle of the lawn, as a visitor would
      let h = newHero(START);
      h = walkTo(h, p.x, START.z);
      h = walkTo(h, p.x, p.z);
      expect(Math.hypot(h.x - p.x, h.z - p.z), p.id).toBeLessThan(DOOR_R);
    }
  });

  it('puts the cast on the lawn, clear of the buildings, and the portal over open ground', () => {
    for (const c of CAST) {
      expect(inPoly(c.x, c.z, LAWN_W), c.id).toBe(true);
      expect(inBuilding(c.x, c.z), c.id).toBe(false);
    }
    expect(inPoly(PORTAL.x, PORTAL.z, LAWN_W)).toBe(true);
    expect(walkable(PORTAL.x, PORTAL.z)).toBe(true);
  });
});

describe('The compound, the world: walking', () => {
  it('walks, runs faster, and stops when you let go', () => {
    const h0 = newHero(START);
    const walked = walk(h0, { x: 0, z: 1 }, 1.5);
    const ran = walk(h0, { x: 0, z: 1, run: true }, 1.5);
    expect(walked.speed).toBeGreaterThan(HERO.walk * 0.8);
    expect(walked.speed).toBeLessThan(HERO.walk + 0.2);
    expect(ran.speed).toBeGreaterThan(HERO.walk * 1.8);
    expect(ran.running).toBe(true);
    const stopped = walk(walked, {}, 1);
    expect(stopped.speed).toBeLessThan(0.05);
  });

  it('turns to face the way he walks', () => {
    const h = walk(newHero({ ...START, face: 0 }), { x: 0, z: -1 }, 1);
    expect(Math.cos(h.face - Math.PI / 2)).toBeGreaterThan(0.99);
  });

  it('jumps and comes back down, once per press', () => {
    let h = stepHero(newHero(START), { jump: true }, DT);
    expect(h.air).toBe(true);
    let top = 0;
    for (let t = 0; t < 2; t += DT) {
      h = stepHero(h, { jump: true }, DT);
      top = Math.max(top, h.y);
      if (!h.air) break;
    }
    expect(top).toBeGreaterThan(0.8);
    expect(top).toBeLessThan(1.5);
    expect(h.y).toBe(0);
  });

  it('can’t walk into a building', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    // straight at the main building's front, for a long time
    const h = walk(newHero(widow), { x: -Math.cos(widow.face), z: Math.sin(widow.face), run: true }, 5);
    expect(inBuilding(h.x, h.z)).toBe(false);
    const prow = BUILDINGS.find((b) => b.id === 'prow');
    // right up against it: a hand's breadth past his shoulder is wall
    expect(inPoly(h.x - Math.cos(widow.face) * (HERO_R + 0.25), h.z + Math.sin(widow.face) * (HERO_R + 0.25), prow.foot)).toBe(true);
  });

  it('can’t leave the lawn, whichever way he runs', () => {
    for (const [x, z] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, -0.7],
    ]) {
      const h = walk(newHero(START), { x, z, run: true }, 40);
      expect(inPoly(h.x, h.z, LAWN_W), `${x},${z}`).toBe(true);
      expect(inBuilding(h.x, h.z), `${x},${z}`).toBe(false);
    }
  });

  it('pushes anything that ends up inside a building back out', () => {
    for (const b of BUILDINGS) {
      const cx = b.foot.reduce((s, p) => s + p[0], 0) / b.foot.length;
      const cz = b.foot.reduce((s, p) => s + p[1], 0) / b.foot.length;
      const [x, z] = collide(cx, cz, HERO_R);
      expect(inPoly(x, z, b.foot), b.id).toBe(false);
    }
  });

  it('turns the keys by the camera: forward is away from the camera', () => {
    const face = 0.7;
    const yaw = behindYaw(face);
    const m = cameraMove(yaw, 1, 0);
    // forward is the way he faces
    expect(m.x).toBeCloseTo(Math.cos(face), 5);
    expect(m.z).toBeCloseTo(-Math.sin(face), 5);
  });
});

describe('The compound, the world: the camera', () => {
  it('has all the room it wants out on the lawn', () => {
    expect(camRoom(START.x, START.z, START.x, 3, START.z + 7)).toBe(1);
  });

  it('comes in rather than go inside a building', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    // a camera behind someone with his back to the main building's front
    const k = camRoom(widow.x, widow.z, widow.x - Math.cos(widow.face) * 8, 3, widow.z + Math.sin(widow.face) * 8);
    expect(k).toBeLessThan(0.4);
    // but over the roof is fine
    expect(camRoom(widow.x, widow.z, widow.x - Math.cos(widow.face) * 8, 60, widow.z + Math.sin(widow.face) * 8)).toBe(1);
  });
});

describe('The compound, the world: doors and people', () => {
  it('offers a door when you’re at it, and not from across the lawn', () => {
    for (const p of PLACES) expect(nearPlace(p.x, p.z)?.id, p.id).toBe(p.id);
    expect(nearPlace(START.x, START.z)).toBe(null);
  });

  it('brings you out a step outside the door, facing away from it, still at it', () => {
    for (const p of PLACES) {
      const h = outside(p);
      expect(walkable(h.x, h.z), p.id).toBe(true);
      expect(nearPlace(h.x, h.z)?.id, p.id).toBe(p.id);
      expect(h.face).toBe(p.face);
    }
  });

  it('has someone to talk to by four of the doors, with new lines once their game is won', () => {
    for (const c of CAST) expect(nearCast(c.x + 1, c.z)?.id).toBe(c.id);
    const thor = CAST.find((c) => c.id === 'thor');
    expect(linesFor(thor, [])).toBe(thor.lines);
    expect(linesFor(thor, ['thor'])).toContain('I knew it!');
  });

  it('knows when you’re under the portal', () => {
    expect(underPortal(PORTAL.x, PORTAL.z)).toBe(true);
    expect(underPortal(START.x, START.z)).toBe(false);
  });
});

describe('The compound, the world: the heist', () => {
  it('starts with nothing done, the workshop next, and the portal shut', () => {
    const p = progress([]);
    expect(p.next).toBe('stark');
    expect(p.stones).toBe(0);
    expect(p.portal).toBe(false);
    expect(p.finished).toBe(false);
    expect(p.objective).toMatch(/workshop/);
  });

  it('counts the Soul Stone only with both halves, though each half finishes its own place', () => {
    const half = progress(['power', 'soul-clint']);
    expect(half.stones).toBe(1);
    expect(half.done).toEqual(['stark', 'hawkeye']);
    expect(half.next).toBe('thor');
    const both = progress(['soul-clint', 'soul-natasha', 'soul']);
    expect(both.stones).toBe(1);
    expect(both.done).toEqual(['hawkeye', 'widow']);
  });

  it('opens the portal with the Space Stone, and sends you through it once every stone is back', () => {
    expect(progress(['space']).portal).toBe(true);
    expect(progress(['space']).objective).toMatch(/portal/);
    const all = progress(['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space']);
    expect(all.finished).toBe(true);
    expect(all.stones).toBe(6);
    expect(all.next).toBe(null);
    expect(all.objective).toMatch(/Thanos/);
  });
});
