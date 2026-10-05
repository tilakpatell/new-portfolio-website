import { describe, expect, it } from 'vitest';
import { inPoly } from '../compound/plan';
import {
  ANCHORS,
  ARMOUR,
  BODY,
  BUILDINGS,
  CAST,
  DOOR_R,
  HERO,
  HERO_R,
  LAWN_W,
  PLACES,
  PORTAL,
  SOLIDS,
  START,
  SWING,
  aimWeb,
  behindYaw,
  camRoom,
  cameraMove,
  collide,
  floorAt,
  linesFor,
  nearCast,
  nearestEdge,
  nearPlace,
  newHero,
  outside,
  pastAnchor,
  progress,
  solidById,
  stepHero,
  underPortal,
  walkable,
} from './rules';
import { LAWN_TREES } from './rules';

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

  it('has a door for each of the eight games, each on the lawn and clear of everything', () => {
    expect(PLACES.map((p) => p.id)).toEqual(['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'spidey', 'vault']);
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
    expect(near('gate', 'spidey')).toBe(true);
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

  it('puts the cast and the armour on the lawn, clear of the buildings, and the portal over open ground', () => {
    for (const c of CAST) {
      expect(inPoly(c.x, c.z, LAWN_W), c.id).toBe(true);
      expect(inBuilding(c.x, c.z), c.id).toBe(false);
    }
    expect(inPoly(ARMOUR.x, ARMOUR.z, LAWN_W)).toBe(true);
    expect(inBuilding(ARMOUR.x, ARMOUR.z)).toBe(false);
    // the armour stands beside the workshop's door, not in front of it
    const stark = PLACES.find((p) => p.id === 'stark');
    expect(Math.hypot(ARMOUR.x - stark.x, ARMOUR.z - stark.z)).toBeGreaterThan(2.5);
    expect(walkable(stark.x, stark.z)).toBe(true);
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
    // a spider's jump: well over a metre, under two
    expect(top).toBeGreaterThan(1.3);
    expect(top).toBeLessThan(2);
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
    // (Spider-Man's gate has a game but no stone, so it's never in the way)
    expect(all.places.find((p) => p.id === 'spidey').done).toBe(false);
    expect(all.stones).toBe(6);
    expect(all.next).toBe(null);
    expect(all.objective).toMatch(/Thanos/);
  });
});

// ── swinging, climbing and the roofs ──

const solidAt = (x, y, z) => SOLIDS.find((s) => y < s.h - 0.05 && y + 0.05 > s.y0 && inPoly(x, z, s.foot));
// The tests' own swinger: holds the web while he's coming down (or low),
// lets go on the upswing past the anchor, and steers round the lawn.
const MID = { x: 60 * 1.6, z: 52 * 1.6 };
function pilot(h, t) {
  const a = t * 0.12;
  const tx = MID.x + Math.cos(a) * 55 - h.x;
  const tz = MID.z + Math.sin(a) * 45 - h.z;
  const d = Math.hypot(tx, tz) || 1;
  let web;
  if (h.mode === 'ground') web = true;
  else if (h.mode === 'swing') web = !(pastAnchor(h) > 0.45 && h.vy > 0);
  else web = h.vy < -1 || h.y < 3;
  return { x: tx / d, z: tz / d, run: true, jump: h.mode === 'ground' || h.mode === 'wall', web };
}

describe('The compound, the world: what a web can catch', () => {
  it('has roof edges to swing from on every tall building, and firs round the lawn', () => {
    for (const id of ['hangar', 'prow', 'wing', 'training', 'lab', 'bridge']) expect(ANCHORS.filter((a) => a.id === id).length, id).toBeGreaterThan(6);
    expect(ANCHORS.filter((a) => a.kind === 'tree').length).toBeGreaterThan(LAWN_TREES.length + 20);
  });

  it('swings him about points over the lawn, clear of the buildings, under where the web sticks', () => {
    for (const an of ANCHORS) {
      expect(inPoly(an.a[0], an.a[2], LAWN_W)).toBe(true);
      expect(inBuilding(an.a[0], an.a[2])).toBe(false);
      expect(an.at[1]).toBeGreaterThanOrEqual(an.a[1] - 0.01);
    }
  });

  it('finds an anchor ahead of him and over him, in reach, with nothing in the way', () => {
    // running at the main building from the start
    const h = { ...newHero(START), vx: 0, vz: -9.5, y: 1.5 };
    const w = aimWeb(h);
    expect(w).not.toBe(null);
    expect(w.a[1] - h.y).toBeGreaterThanOrEqual(SWING.minUp);
    expect(w.len).toBeLessThanOrEqual(SWING.reach);
    // ahead: up the drive, not behind him
    expect(w.a[2]).toBeLessThan(h.z);
  });
});

describe('The compound, the world: swinging', () => {
  it('turns a jump held from the ground into a web, after a moment', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    h = stepHero(h, { jump: true, web: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < SWING.arm - 0.05; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < 0.2; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(h.ev.length + 1).toBeGreaterThan(0);
  });

  it('is a rope: never longer than it is, and off the ground while he hangs on', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    h = stepHero(h, { jump: true, web: true, run: true, z: -1 }, DT);
    let swung = 0;
    for (let t = 0; t < 4; t += DT) {
      h = stepHero(h, { web: true, z: -1 }, DT);
      if (h.mode !== 'swing') continue;
      swung += DT;
      const a = h.web.a;
      expect(Math.hypot(h.x - a[0], h.y - a[1], h.z - a[2])).toBeLessThan(h.web.len + 0.01);
      expect(h.y).toBeGreaterThan(0.3);
    }
    expect(swung).toBeGreaterThan(0.5);
  });

  it('flies on when he lets go, faster than he can run, and comes down on his feet', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    let top = 0;
    let best = 0;
    let released = null;
    for (let t = 0; t < 10 && !released; t += DT) {
      h = stepHero(h, pilot(h, t), DT);
      top = Math.max(top, Math.hypot(h.vx, h.vy, h.vz));
      if (h.ev.some((e) => e.type === 'release' || e.type === 'perfect')) released = { ...h };
    }
    expect(released).not.toBe(null);
    for (let t = 0; t < 8 && h.mode !== 'ground'; t += DT) {
      h = stepHero(h, {}, DT);
      best = Math.max(best, Math.hypot(h.vx, h.vz));
    }
    expect(best).toBeGreaterThan(HERO.run);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(floorAt(h.x, h.z, h.y));
  });

  it('a perfect release, on the upswing past the anchor: faster, higher, and a flip', () => {
    const a = [START.x, 30, START.z - 40];
    // under and a little past the anchor, going up and on
    const h = { ...newHero(START), x: a[0], z: a[2] - 6, y: 12, vx: 0, vy: 9, vz: -22, mode: 'swing', fly: true, web: { a, at: a, len: 20 } };
    expect(pastAnchor(h)).toBeGreaterThan(SWING.perfect.from);
    const after = stepHero(h, { web: false }, DT);
    expect(after.ev.map((e) => e.type)).toContain('perfect');
    expect(after.flip).toBeGreaterThan(0);
    expect(Math.hypot(after.vx, after.vy, after.vz)).toBeGreaterThan(Math.hypot(h.vx, h.vy, h.vz));
    // too early, coming down: just a release
    const early = stepHero({ ...h, z: a[2] + 6, vy: -6 }, { web: false }, DT);
    expect(early.ev.map((e) => e.type)).toContain('release');
  });

  it('swings round the compound for half a minute without going through a wall or off the lawn', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    let webs = 0;
    let fastest = 0;
    let highest = 0;
    for (let t = 0; t < 30; t += DT) {
      h = stepHero(h, pilot(h, t), DT);
      webs += h.ev.filter((e) => e.type === 'web').length;
      fastest = Math.max(fastest, Math.hypot(h.vx, h.vy, h.vz));
      highest = Math.max(highest, h.y);
      expect(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.z)).toBe(true);
      expect(inPoly(h.x, h.z, LAWN_W)).toBe(true);
      expect(solidAt(h.x, h.y + 0.1, h.z)?.id ?? null).toBe(null);
    }
    expect(webs).toBeGreaterThan(5);
    expect(fastest).toBeGreaterThan(16);
    expect(fastest).toBeLessThanOrEqual(SWING.maxSpeed + 0.01);
    expect(highest).toBeGreaterThan(8);
  });
});

describe('The compound, the world: climbing and the roofs', () => {
  const widow = PLACES.find((p) => p.id === 'widow');
  const prow = solidById('prow');
  const inward = { x: -Math.cos(widow.face), z: Math.sin(widow.face) };

  it('sticks to a wall he jumps at, climbs it, and comes out on the roof', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    expect(h.mode).toBe('wall');
    // facing it
    expect(Math.cos(h.face - widow.face)).toBeLessThan(-0.9);
    const y0 = h.y;
    h = walk(h, inward, 1);
    expect(h.y).toBeGreaterThan(y0 + 3);
    expect(inBuilding(h.x, h.z)).toBe(false);
    let mantled = false;
    for (let t = 0; t < 20 && h.mode === 'wall'; t += DT) {
      h = stepHero(h, { ...inward, run: true }, DT);
      mantled ||= h.ev.some((e) => e.type === 'mantle');
    }
    expect(mantled).toBe(true);
    expect(h.mode).toBe('ground');
    expect(h.y).toBeCloseTo(prow.h, 5);
    expect(inPoly(h.x, h.z, prow.foot)).toBe(true);
    // and walks about up there
    const on = walk(h, inward, 1);
    expect(on.y).toBeCloseTo(prow.h, 5);
    expect(on.mode).toBe('ground');
  });

  it('kicks off a wall with a jump, and doesn’t stick straight back to it', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    h = walk(h, inward, 1.5);
    const high = h.y;
    h = stepHero(h, { jump: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < 0.3; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('air');
    expect(nearestEdge(h.x, h.z, prow.foot).d).toBeGreaterThan(1.5);
    for (let t = 0; t < 6 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(high).toBeGreaterThan(5);
  });

  it('climbs back down a wall to the lawn', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    h = walk(h, inward, 0.6);
    h = walk(h, { x: -inward.x, z: -inward.z }, 4);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(0);
  });

  it('lands on a roof he comes down on, and falls off its edge', () => {
    const hangar = solidById('hangar');
    // over the hangar's roof, by the A, coming down
    let h = { ...newHero(START), x: 18 * 1.6, z: 58 * 1.6, y: hangar.h + 6, mode: 'air', fly: true };
    for (let t = 0; t < 3 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(h.y).toBeCloseTo(hangar.h, 5);
    expect(walkable(h.x, h.z, HERO_R, h.y)).toBe(true);
    // walk off its south end
    for (let t = 0; t < 6 && h.y > 1; t += DT) h = stepHero(h, { x: 0, z: 1, run: true }, DT);
    for (let t = 0; t < 4 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(0);
  });

  it('can’t come up through the bridge', () => {
    const bridge = solidById('bridge');
    const [x0, z0, x1, z1] = bridge.box;
    let h = { ...newHero(START), x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: 6, vy: 18, mode: 'air', fly: true };
    let top = 0;
    for (let t = 0; t < 2 && h.mode !== 'ground'; t += DT) {
      h = stepHero(h, {}, DT);
      top = Math.max(top, h.y);
    }
    expect(top + BODY).toBeLessThanOrEqual(bridge.y0 + 0.01);
  });

  it('knows a roof from the lawn', () => {
    const prowC = prow.foot.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    expect(floorAt(prowC[0], prowC[1], prow.h + 1)).toBeCloseTo(prow.h, 5);
    expect(floorAt(prowC[0], prowC[1], 0)).toBe(0);
    expect(floorAt(START.x, START.z, 50)).toBe(0);
    // what's on the lawn doesn't stop him once he's over it
    expect(collide(widow.x, widow.z, HERO_R, 0)).toEqual(collide(widow.x, widow.z, HERO_R, 0));
  });
});

describe('The compound, the world: swinging, the way Insomniac do it', () => {
  // swinging at 18 m/s, 12 m up, northward through the middle of the lawn
  const flying = (over = {}) => ({ ...newHero(START), x: 60 * 1.6, z: 70 * 1.6, y: 12, vx: 0, vy: 0, vz: -18, mode: 'air', fly: true, face: Math.PI / 2, ...over });
  const heading = (h) => Math.atan2(h.vz, h.vx);

  it('swings where you steer: the swing comes round toward it, keeping its speed', () => {
    let h = stepHero(flying(), { web: true }, DT);
    expect(h.mode).toBe('swing');
    const before = heading(h);
    const speed0 = Math.hypot(h.vx, h.vy, h.vz);
    // steer east (+x)
    for (let t = 0; t < 0.6 && h.mode === 'swing'; t += DT) h = stepHero(h, { x: 1, z: 0, web: true }, DT);
    let d = heading(h) - before;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    expect(Math.abs(d)).toBeGreaterThan(0.4);
    expect(Math.cos(heading(h))).toBeGreaterThan(Math.cos(before));
    expect(Math.hypot(h.vx, h.vy, h.vz)).toBeGreaterThan(speed0 * 0.6);
  });

  it('pushes him off a wall he swings alongside, rather than letting him grind along it', () => {
    const hangar = solidById('hangar');
    // beside the hangar's east wall (x = 30 units), going north along it, a metre and a half off it
    const x = 30 * 1.6 + 1.5;
    let h = { ...flying({ x, z: 50 * 1.6, y: 8, vz: -16 }) };
    const w = { a: [x + 2, 20, 40 * 1.6], at: [x + 2, 20, 40 * 1.6], len: 15, target: 15, entry: 8, hand: 'R' };
    h = { ...h, mode: 'swing', web: w };
    for (let t = 0; t < 0.5; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(nearestEdge(h.x, h.z, hangar.foot).d).toBeGreaterThan(1.5 - HERO_R);
    expect(h.x).toBeGreaterThan(x);
  });

  it('keeps a chain of swings at its height: the bottom of a swing is never far under where it caught', () => {
    // (up by the main building, where there are roofs over him to swing from)
    let h = stepHero(flying({ y: 18, z: 75 }), { web: true }, DT);
    expect(h.mode).toBe('swing');
    let low = h.y;
    for (let t = 0; t < 1.6 && h.mode === 'swing'; t += DT) {
      h = stepHero(h, { web: true }, DT);
      low = Math.min(low, h.y);
    }
    expect(low).toBeGreaterThan(18 - SWING.dip - 1);
  });

  it('turns a dive into speed when a web catches it', () => {
    const h0 = flying({ y: 22, z: 75, vz: -6, vy: -22 });
    const h = stepHero(h0, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(h.ev.map((e) => e.type)).toContain('dive');
    expect(-h.vz).toBeGreaterThan(6 + (22 - 8) * SWING.dive * 0.8);
  });

  it('zips: a burst along the way he’s going, twice a flight, and back once he’s on something', () => {
    let h = flying({ vz: -10 });
    h = stepHero(h, { zip: true }, DT);
    expect(h.ev.map((e) => e.type)).toContain('zip');
    expect(-h.vz).toBeGreaterThan(10 + SWING.zip.speed * 0.9);
    for (let t = 0; t < SWING.zip.cool + 0.05; t += DT) h = stepHero(h, {}, DT);
    h = stepHero(h, { zip: true }, DT);
    expect(h.zips).toBe(0);
    for (let t = 0; t < SWING.zip.cool + 0.05; t += DT) h = stepHero(h, {}, DT);
    const third = stepHero(h, { zip: true }, DT);
    expect(third.ev.map((e) => e.type)).not.toContain('zip');
    for (let t = 0; t < 8 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.zips).toBe(SWING.zip.charges);
  });

  it('waits a beat after letting go before a held button webs again', () => {
    let h = stepHero(flying(), { web: true }, DT);
    for (let t = 0; t < 0.3; t += DT) h = stepHero(h, { web: true }, DT);
    h = stepHero(h, { web: false }, DT);
    expect(h.web).toBe(null);
    h = stepHero(h, { web: true }, DT);
    expect(h.web).toBe(null);
    for (let t = 0; t < SWING.rearm + 0.05; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
  });

  it('flings him on and up when he lets go on the way up, and drops him on the way down', () => {
    const a = [START.x, 30, START.z - 40];
    const up = { ...newHero(START), x: a[0], z: a[2] + 8, y: 12, vx: 0, vy: 6, vz: -20, mode: 'swing', fly: true, web: { a, at: a, len: 20, target: 20, entry: 12 } };
    const out = stepHero(up, { web: false }, DT);
    expect(out.vy).toBeGreaterThan(6);
    const down = stepHero({ ...up, vy: -6 }, { web: false }, DT);
    expect(down.vy).toBeLessThan(-6);
  });

  it('runs up a wall he hits fast, with the speed he hit it with', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    const inward = { x: -Math.cos(widow.face), z: Math.sin(widow.face) };
    let h = { ...newHero(widow), y: 3, vx: inward.x * 20, vz: inward.z * 20, vy: 0, mode: 'air', fly: true };
    for (let t = 0; t < 0.5 && h.mode !== 'wall'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('wall');
    expect(h.runUp).toBeGreaterThan(SWING.climb);
    const y0 = h.y;
    for (let t = 0; t < 0.5; t += DT) h = stepHero(h, {}, DT);
    // up it with no keys held, faster than he climbs
    expect(h.y - y0).toBeGreaterThan(SWING.climb * 0.5 * 1.5);
  });
});
