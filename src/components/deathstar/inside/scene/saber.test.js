import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { STROKES, createFighter } from '../rules/saber';
import { SEG, arcPath, bladeHues, createSabers, hum, swing, trailLevel } from './saber';

const at = (x = 0, y = 1, z = 0) => ({ x, y, z });
const len = (v) => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const degrees = (a, b) => (Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (len(a) * len(b))))) * 180) / Math.PI;

// everything the sabers hang in the scene: objects, geometries, materials
function inventory(scene) {
  const objects = [];
  const geometries = new Set();
  const materials = new Set();
  scene.traverse((o) => {
    objects.push(o);
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [o.material].flat()) if (m) materials.add(m);
  });
  return { objects: objects.length, geometries: geometries.size, materials: materials.size };
}

// a hand in the scene, where a blade can be attached
function handAt(scene, x = 0, y = 1, z = 0) {
  const hand = new THREE.Object3D();
  hand.position.set(x, y, z);
  scene.add(hand);
  hand.updateMatrixWorld(true);
  return hand;
}

// the arc’s segments as points: [{ a, b, w }]
function segments(out, n) {
  const segs = [];
  for (let i = 0; i < n; i++) {
    const j = i * SEG;
    segs.push({ a: { x: out[j], y: out[j + 1], z: out[j + 2] }, b: { x: out[j + 3], y: out[j + 4], z: out[j + 5] }, w: out[j + 6] });
  }
  return segs;
}

// how far a point lies from the straight line through a and b
function offLine(p, a, b) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const l = len(d);
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  const t = dot(ap, d) / (l * l);
  return len({ x: ap.x - d.x * t, y: ap.y - d.y * t, z: ap.z - d.z * t });
}

describe('the colour of a blade', () => {
  it('glows red round Vader’s blade, blue round Obi-Wan’s and green round Luke’s', () => {
    const red = bladeHues('red').glow;
    const blue = bladeHues('blue').glow;
    const green = bladeHues('green').glow;
    expect(red[0]).toBeGreaterThan(5 * Math.max(red[1], red[2]));
    expect(blue[2]).toBeGreaterThan(2 * Math.max(blue[0], blue[1]));
    expect(green[1]).toBeGreaterThan(5 * Math.max(green[0], green[2]));
  });

  it('takes a colour from the cast as it is given there, a number', () => {
    const vader = bladeHues(0xff2a1f);
    expect(vader.glow[0]).toBeGreaterThan(5 * Math.max(vader.glow[1], vader.glow[2]));
    expect(vader.light).toBe(0xff2a1f);
  });

  it('has a white-hot core, brighter than white so the bloom takes it, only tinted with the colour', () => {
    for (const c of ['red', 'green', 'blue', 0x3f8cff]) {
      const core = bladeHues(c).core;
      expect(Math.min(...core)).toBeGreaterThan(1);
      expect(Math.min(...core)).toBeGreaterThan(0.6 * Math.max(...core));
    }
  });
});

describe('a blade’s hum', () => {
  it('flickers a little about its full strength, never dimming much and never still', () => {
    const samples = Array.from({ length: 120 }, (_, i) => hum(i / 120, 3));
    expect(Math.min(...samples)).toBeGreaterThan(0.88);
    expect(Math.max(...samples)).toBeLessThan(1.12);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.02);
  });

  it('is out of step between two blades', () => {
    expect(hum(0.25, 1)).not.toBeCloseTo(hum(0.25, 2), 3);
  });
});

describe('where a fighter’s blade points', () => {
  const fighter = (more = {}) => Object.assign(createFighter({ id: 'vader', x: 0, z: 0, yaw: 0, side: 'imperial' }), more);

  it('is up and forward at rest, on the sword hand’s side', () => {
    const d = swing(fighter());
    expect(len(d)).toBeCloseTo(1, 5);
    expect(d.y).toBeGreaterThan(0.3);
    expect(d.z).toBeLessThan(-0.3); // yaw 0 looks along −z
    expect(d.x).toBeGreaterThan(0);
  });

  it('points straight ahead and level as a light stroke’s blow lands', () => {
    const d = swing(fighter({ stroke: { kind: 'light', t: STROKES.light.at, hit: true } }));
    expect(degrees(d, { x: 0, y: 0, z: -1 })).toBeLessThan(15);
  });

  it('cuts through its blow at speed, never slowing to a stop on it', () => {
    const way = (kind, t) => swing(fighter({ stroke: { kind, t, hit: false } }));
    for (const kind of ['light', 'heavy']) {
      const blow = STROKES[kind].at;
      expect(degrees(way(kind, blow - 0.005), way(kind, blow))).toBeGreaterThan(6);
      expect(degrees(way(kind, blow), way(kind, blow + 0.005))).toBeGreaterThan(2);
    }
  });

  it('is raised over the head as a heavy stroke winds up, and comes down through the blow', () => {
    const up = swing(fighter({ stroke: { kind: 'heavy', t: STROKES.heavy.at * 0.75, hit: false } }));
    expect(up.y).toBeGreaterThan(0.6);
    expect(up.z).toBeGreaterThan(0); // back over the shoulder
    const blow = swing(fighter({ stroke: { kind: 'heavy', t: STROKES.heavy.at, hit: true } }));
    expect(degrees(blow, { x: 0, y: 0, z: -1 })).toBeLessThan(15);
  });

  it('is held across the body behind a raised guard', () => {
    const d = swing(fighter({ guard: true }));
    expect(d.x).toBeLessThan(-0.5);
    expect(d.y).toBeGreaterThan(0.2);
  });

  it('turns with the fighter', () => {
    const d = swing(fighter({ yaw: Math.PI / 2, stroke: { kind: 'light', t: STROKES.light.at, hit: true } }));
    expect(degrees(d, { x: 1, y: 0, z: 0 })).toBeLessThan(15);
  });

  it('carries a stroke on by the time since the last step, so it sweeps smoothly between steps', () => {
    const later = swing(fighter({ stroke: { kind: 'light', t: STROKES.light.at, hit: true } }));
    const carried = swing(fighter({ stroke: { kind: 'light', t: STROKES.light.at - 0.05, hit: false } }), 0.05);
    expect(degrees(carried, later)).toBeLessThan(0.01);
  });

  it('is back at rest as a stroke ends, so the next one starts where this one left the blade', () => {
    for (const kind of ['light', 'heavy']) {
      const end = swing(fighter({ stroke: { kind, t: STROKES[kind].s - 1e-4, hit: true } }));
      expect(degrees(end, swing(fighter()))).toBeLessThan(2);
    }
  });
});

describe('a swung blade’s trail', () => {
  it('is left only by a blade moving fast: a still or slow one leaves none', () => {
    expect(trailLevel(0, 0)).toBe(0);
    expect(trailLevel(0, 2)).toBe(0);
    expect(trailLevel(0, 20)).toBe(1);
  });

  it('fades as it ages, and is gone in a moment', () => {
    expect(trailLevel(0.05, 20)).toBeGreaterThan(0);
    expect(trailLevel(0.05, 20)).toBeLessThan(1);
    expect(trailLevel(0.5, 20)).toBe(0);
  });
});

describe('a Force lightning arc', () => {
  const from = at(0, 1.4, 0);
  const to = at(0, 1.2, -6);
  const run = (seed, opts = { depth: 4, branches: 3, jag: 0.2 }, out = new Float32Array(SEG * 64)) => {
    const n = arcPath(from, to, seeded(seed), opts, out);
    return segments(out, n);
  };

  it('is drawn the same from the same seed, and differently from another', () => {
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it('runs unbroken from the hand to the target, in as many pieces as its depth makes', () => {
    const main = run(7).filter((s) => s.w === 1);
    expect(main).toHaveLength(16);
    for (const k of ['x', 'y', 'z']) {
      expect(main[0].a[k]).toBeCloseTo(from[k], 5);
      expect(main.at(-1).b[k]).toBeCloseTo(to[k], 5);
    }
    for (let i = 1; i < main.length; i++) expect(main[i].a).toEqual(main[i - 1].b);
  });

  it('wanders off the straight line, but no further than its jag allows', () => {
    const length = len({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z });
    for (let seed = 1; seed <= 60; seed++) {
      const main = run(seed).filter((s) => s.w === 1);
      const worst = Math.max(...main.map((s) => offLine(s.b, from, to)));
      expect(worst).toBeGreaterThan(0.02 * length);
      expect(worst).toBeLessThanOrEqual(2 * 0.2 * length);
    }
    const straight = run(11, { depth: 4, branches: 0, jag: 0 });
    for (const s of straight) expect(offLine(s.b, from, to)).toBeLessThan(1e-5);
  });

  it('bends finer as its pieces get shorter: a smallest piece’s bend is within its jag of the piece it split', () => {
    const length = len({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z });
    for (let seed = 1; seed <= 30; seed++) {
      const main = run(seed).filter((s) => s.w === 1);
      // the odd bends are the last made, each splitting a piece two-sixteenths of the whole
      for (let i = 1; i < main.length; i += 2) {
        const [a, p, b] = [main[i - 1].a, main[i].a, main[i].b];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
        expect(len({ x: p.x - mid.x, y: p.y - mid.y, z: p.z - mid.z })).toBeLessThanOrEqual((0.2 * length * 2) / 16 + 1e-5);
      }
    }
  });

  it('forks into fainter branches, each leaving from a bend in the main arc (never the hand or the target)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const segs = run(seed);
      const main = segs.filter((s) => s.w === 1);
      const branches = segs.filter((s) => s.w < 1);
      expect(branches.length).toBe(3 * 4);
      const bends = main.slice(0, -1).map((s) => s.b);
      // each branch starts at a bend and runs on unbroken from there
      for (let i = 0; i < branches.length; i += 4) {
        expect(bends.some((p) => p.x === branches[i].a.x && p.y === branches[i].a.y && p.z === branches[i].a.z)).toBe(true);
        for (let k = 1; k < 4; k++) expect(branches[i + k].a).toEqual(branches[i + k - 1].b);
      }
    }
  });

  it('never writes past the room it is given', () => {
    const out = new Float32Array(SEG * 5);
    expect(arcPath(from, to, seeded(3), { depth: 4, branches: 3, jag: 0.2 }, out)).toBe(5);
    const fuller = new Float32Array(SEG * 30);
    expect(arcPath(from, to, seeded(3), { depth: 4, branches: 3, jag: 0.2 }, fuller, 20)).toBe(10);
  });
});

describe('the sabers', () => {
  it('make everything they draw at the start, so a duel adds nothing to the scene', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const hand = handAt(scene);
    const before = inventory(scene);
    const h = sabers.blade('vader', 'red');
    h.attach(hand);
    h.on(true);
    sabers.clash(at(), 'parry');
    sabers.clash(at(), 'deflect', { x: 0, y: 0, z: 1 });
    sabers.lightning([at(0, 1.4, 0), at(0.3, 1.4, 0)], at(0, 1.2, -5), true);
    sabers.push(at(), { x: 0, y: 0, z: -1 });
    sabers.choke(at(0, 1.5, -4), true);
    for (let i = 0; i < 20; i++) {
      hand.rotation.z += 0.3;
      hand.updateMatrixWorld(true);
      sabers.update(1 / 60);
    }
    expect(inventory(scene)).toEqual(before);
    sabers.dispose();
    expect(scene.getObjectByName('sabers')).toBeUndefined();
  });

  it('light a blade over a moment and put it away the same way', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const h = sabers.blade('obiwan', 'blue');
    h.attach(handAt(scene));
    expect(sabers.live().blades).toBe(0);
    h.on(true);
    sabers.update(0.05);
    const early = h.along(1, new THREE.Vector3()).y;
    sabers.update(0.5);
    const full = h.along(1, new THREE.Vector3()).y;
    expect(sabers.live().blades).toBe(1);
    expect(early).toBeLessThan(full);
    h.on(false);
    sabers.update(0.5);
    expect(sabers.live().blades).toBe(0);
  });

  it('keep a blade in its hand: along the hand’s way, or along a way it is given', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const hand = handAt(scene, 2, 1, -3);
    const h = sabers.blade('vader', 'red');
    h.attach(hand);
    h.on(true);
    sabers.update(1);
    const base = h.along(0, new THREE.Vector3());
    const tip = h.along(1, new THREE.Vector3());
    expect(tip.x).toBeCloseTo(2, 5);
    expect(tip.z).toBeCloseTo(-3, 5);
    expect(tip.y - base.y).toBeGreaterThan(0.8); // a blade nearly a metre long, up out of the fist
    expect(base.y).toBeGreaterThan(1);
    h.aim({ x: 0, y: 0, z: -2 });
    h.update(1 / 60);
    const ahead = h.along(1, new THREE.Vector3());
    expect(ahead.y).toBeCloseTo(1, 5);
    expect(ahead.z).toBeLessThan(-3.8);
  });

  it('give the same blade back for the same name', () => {
    const sabers = createSabers(new THREE.Scene(), { tier: 'low' });
    expect(sabers.blade('luke', 'green')).toBe(sabers.blade('luke', 'green'));
  });

  it('leave a trail behind a swung blade, and none behind a still one', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const hand = handAt(scene);
    const h = sabers.blade('luke', 'green');
    h.attach(hand);
    h.on(true);
    for (let i = 0; i < 30; i++) sabers.update(1 / 60);
    expect(sabers.live().trails).toBe(0);
    for (let i = 0; i < 4; i++) {
      hand.rotation.x -= 0.5;
      hand.updateMatrixWorld(true);
      sabers.update(1 / 60);
    }
    expect(sabers.live().trails).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) sabers.update(1 / 60);
    expect(sabers.live().trails).toBe(0);
  });

  it('throw sparks and a flash at a clash, more at a parry than a block, all gone within a second', () => {
    const sparksAfter = (kind) => {
      const sabers = createSabers(new THREE.Scene(), { tier: 'high' });
      sabers.clash(at(), kind);
      sabers.update(1 / 60);
      const live = sabers.live();
      sabers.update(1.2);
      expect(sabers.live()).toMatchObject({ sparks: 0, flashes: 0 });
      return live;
    };
    const block = sparksAfter('block');
    const parry = sparksAfter('parry');
    expect(block.flashes).toBe(1);
    expect(block.sparks).toBeGreaterThan(0);
    expect(parry.sparks).toBeGreaterThan(block.sparks);
  });

  it('throw a few sparks where a blade turns a bolt', () => {
    const sabers = createSabers(new THREE.Scene(), { tier: 'mid' });
    sabers.clash(at(), 'deflect', { x: 1, y: 0, z: 0 });
    sabers.update(1 / 60);
    expect(sabers.live().sparks).toBeGreaterThan(0);
  });

  it('arc lightning from each hand to its target while it burns, and let it die away once stopped', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const hands = [at(-0.2, 1.4, 0), at(0.2, 1.4, 0)];
    sabers.lightning(hands, at(0, 1.2, -6), true);
    sabers.update(1 / 60);
    const both = sabers.live().arcs;
    expect(both).toBeGreaterThan(0);
    sabers.lightning(hands.slice(0, 1), at(0, 1.2, -6), true);
    sabers.update(0.2);
    expect(sabers.live().arcs).toBeLessThan(both);
    expect(sabers.live().arcs).toBeGreaterThan(0);
    sabers.lightning(hands, at(0, 1.2, -6), false);
    sabers.update(0.5);
    expect(sabers.live().arcs).toBe(0);
  });

  it('strike lightning anew at once when it is thrown again, at its new target, not where it last burned', () => {
    const sabers = createSabers(new THREE.Scene(), { tier: 'high' });
    const sprites = sabers.meshes.find((m) => m.name === 'saber-sprites').geometry;
    const furthest = () => Math.max(...Array.from({ length: sprites.instanceCount }, (_, i) => sprites.attributes.aAt.getX(i)));
    const hand = [at(0, 1.4, 0)];
    // (an arc 6 m long strays up to 2 × its jag of that to either side: under 3 m)
    sabers.lightning(hand, at(0, 1.2, -6), true);
    sabers.update(1 / 60);
    expect(furthest()).toBeLessThan(4);
    sabers.lightning(hand, at(0, 1.2, -6), false);
    sabers.update(1 / 60);
    sabers.lightning(hand, at(12, 1.2, -6), true);
    sabers.update(1 / 60);
    expect(furthest()).toBeGreaterThan(10);
  });

  it('send a ripple along a push that fades, and keep one at a gripped throat until let go', () => {
    const sabers = createSabers(new THREE.Scene(), { tier: 'high' });
    sabers.push(at(), { x: 0, y: 0, z: -1 });
    sabers.update(1 / 60);
    expect(sabers.live().ripples).toBeGreaterThan(0);
    sabers.update(1.5);
    expect(sabers.live().ripples).toBe(0);
    sabers.choke(at(0, 1.5, -4), true);
    for (let i = 0; i < 90; i++) sabers.update(1 / 60);
    expect(sabers.live().ripples).toBeGreaterThan(0);
    sabers.choke(at(0, 1.5, -4), false);
    sabers.update(1.5);
    expect(sabers.live().ripples).toBe(0);
  });

  it('light the room round a lit blade in its own colour, and nothing round a dark one', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'high' });
    const h = sabers.blade('vader', 0xff2a1f);
    h.attach(handAt(scene, 1, 1, 1));
    sabers.update(1 / 60);
    expect(sabers.lamps()).toHaveLength(0);
    h.on(true);
    sabers.update(1);
    const lamps = sabers.lamps();
    expect(lamps).toHaveLength(1);
    expect(lamps[0]).toMatchObject({ color: 0xff2a1f });
    expect(lamps[0].intensity).toBeGreaterThan(0);
    expect(lamps[0].x).toBeCloseTo(1, 5);
    expect(lamps[0].y).toBeGreaterThan(1.3);
  });
});
