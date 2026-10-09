import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LEAF, layLeaves, makeLeafSim } from '../../../lib/three/leafSim';
import { seeded } from '../../../lib/seeded';
import { METRE, place } from '../foot';
import { LEAF_LEVELS, chartOf, createLitter, fromChart, leafCount, leafLevel, litterShader, rechart, toChart } from './litter';

const R = 55.44; // (Middle-earth's: 2053 m)
const frame = { n: [0, 1, 0], f: [0, 0, 1] };
const SPEC = { colours: ['#7f8a2e', '#d1a23c', '#b4622c'], density: 0.35, size: 0.2, shed: 0.7 };
// (a point x, z metres out on the frame, on the ground, the planet's space)
const ground = (x, z) => place(frame, x, z, R).n.map((a) => a * R);

describe('how many leaves', () => {
  it('lie about you by the landing’s density, in 32s, as many as the device can step', () => {
    const at = (d) => ['high', 'mid', 'low'].map((l) => leafCount(d, LEAF_LEVELS[l]));
    expect(at(0.35)).toEqual([288, 192, 128]); // (the Shire)
    expect(at(0.75)).toEqual([576, 320, 160]); // (the old forest)
    expect(at(0.12)).toEqual([96, 64, 64]); // (a lawn)
    expect(at(0.001)).toEqual([32, 32, 32]);
  });

  it('are the high level’s on a desktop, the middle’s on anything less, the low’s on a weak device', () => {
    expect(leafLevel({ tier: 'high', small: false })).toBe('high');
    expect(leafLevel({ tier: 'high', small: true })).toBe('mid');
    expect(leafLevel({ tier: 'mid', small: true })).toBe('mid');
    expect(leafLevel({ tier: 'low', small: true })).toBe('low');
  });
});

describe('the leaves’ chart', () => {
  const c = chartOf(frame, R);
  it('goes there and back to a tenth of a millimetre, a kilometre out', () => {
    const out = { x: 0, y: 0, z: 0 };
    for (const [x, z] of [[0, 0], [30, -40], [-1000, 1000], [700, 20]]) {
      toChart(c, fromChart(c, x, 0.5, z), out);
      expect(Math.abs(out.x - x)).toBeLessThan(1e-4);
      expect(Math.abs(out.z - z)).toBeLessThan(1e-4);
      expect(out.y).toBeCloseTo(0.5, 6);
    }
    expect(fromChart(c, 0, 0, 0).toArray()).toEqual([0, R, 0]);
  });

  it('is the frame the landing’s things are laid on (place’s), to 5 mm at 50 m', () => {
    const p = toChart(c, ground(30, 40));
    expect(Math.abs(p.x - 30)).toBeLessThan(0.005);
    expect(Math.abs(p.z - 40)).toBeLessThan(0.005);
    expect(Math.abs(p.y)).toBeLessThan(1e-6);
  });

  it('is laid again elsewhere with every leaf left where it was on the ground', () => {
    const s = layLeaves(makeLeafSim(64), 64, { half: 14, focus: { x: 400, z: 0 }, rand: seeded(2) });
    const before = Array.from({ length: s.count }, (_, i) => fromChart(c, s.p[4 * i], 0, s.p[4 * i + 2]));
    const next = chartOf({ n: before[0].clone().normalize().toArray(), f: [0, 0, 1] }, R);
    rechart(s, c, next);
    for (let i = 0; i < s.count; i++) expect(fromChart(next, s.p[4 * i], 0, s.p[4 * i + 2]).distanceTo(before[i]) / METRE).toBeLessThan(1e-3);
  });
});

describe('the leaves’ shader', () => {
  it('stands each leaf where it is, its colour its own, both faces lit as its front', () => {
    const out = litterShader({ vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader });
    expect(out.swapped).toEqual({ leaf: true, colour: true, faceless: true });
    const count = (s, x) => s.split(x).length - 1;
    expect(count(out.vertexShader, 'vec3 objectNormal =')).toBe(1);
    expect(count(out.vertexShader, 'vec3 transformed =')).toBe(1);
    expect(out.vertexShader).not.toContain('#include <beginnormal_vertex>');
    expect(out.vertexShader).not.toContain('#include <begin_vertex>');
    for (const name of ['uLeafN', 'uLeafE1', 'uLeafE2', 'uLeafPlanet', 'uLeafFocus', 'uLeafClock', 'uLeafHole', 'uLeafA', 'uLeafB', 'uLeafC']) {
      const decl = new RegExp(`uniform \\w+ ${name};`, 'g');
      expect((out.vertexShader.match(decl) ?? []).length + (out.fragmentShader.match(decl) ?? []).length, name).toBe(1);
    }
    expect(out.fragmentShader).not.toContain('normal *= faceDirection;');
    expect(out.fragmentShader).toContain('mix(uLeafA, uLeafB, vLeafMix)');
  });
});

describe('the leaves on a landing', () => {
  const begun = (opts = {}) => {
    const l = createLitter({ level: 'high', ...opts });
    l.begin({ spec: SPEC, R, frame, seed: 7, crowns: [], focus: frame.n });
    return l;
  };
  // (someone walking along +z through the middle of the box, a frame at a time)
  const walk = (l, frames, { speed = 1.8, from = -3 } = {}) => {
    for (let k = 0; k < frames; k++) {
      const z = from + (speed * k) / 60;
      l.update(1 / 60, { focusN: frame.n, facing: null, walkers: [{ key: 'me', n: ground(0.05, z), h: 0 }] });
    }
  };

  it('is one instanced draw, its leaves’ places sent from the sim as they are', () => {
    const l = createLitter({ level: 'high' });
    expect(l.mesh.isMesh && !l.mesh.isInstancedMesh).toBe(true);
    expect(l.mesh.geometry.isInstancedBufferGeometry).toBe(true);
    const a = l.mesh.geometry.attributes.aLeaf;
    expect(a.array).toBe(l.sim.p);
    expect(a.usage).toBe(THREE.DynamicDrawUsage);
    expect(l.mesh.frustumCulled).toBe(false);
    expect(l.mesh.material.customProgramCacheKey()).toBe('foot-leaves');
    expect(l.on).toBe(false);
    l.begin({ spec: SPEC, R, frame, seed: 7, crowns: [], focus: frame.n });
    expect(l.on).toBe(true);
    expect(l.mesh.geometry.instanceCount).toBe(288);
    expect(l.info()).toMatchObject({ on: true, count: 288, half: 14, airborne: 0, asleep: 288 });
    l.end();
    expect(l.on).toBe(false);
    expect(l.mesh.geometry.instanceCount).toBe(0);
    l.dispose();
  });

  it('kicks the leaves you walk through along, and sends them', () => {
    const l = begun();
    // (a leaf right in your way)
    l.sim.p[0] = 0;
    l.sim.p[2] = 0;
    const was = l.sim.p.slice();
    const version = l.mesh.geometry.attributes.aLeaf.version;
    walk(l, 240);
    expect(Math.hypot(l.sim.p[0] - was[0], l.sim.p[2] - was[2])).toBeGreaterThan(0.3);
    expect(l.mesh.geometry.attributes.aLeaf.version).toBeGreaterThan(version);
  });

  it('throws them out from a blast in the box, and not from one far off', () => {
    const l = begun();
    expect(l.blast(ground(400, 0), 3)).toBe(0);
    expect(l.sim.v.every((v) => v === 0)).toBe(true);
    expect(l.blast(ground(1, 1), 3)).toBeGreaterThan(0);
    for (let k = 0; k < 20; k++) l.update(1 / 60, { focusN: frame.n });
    expect(l.info().airborne).toBeGreaterThan(0);
  });

  it('shakes leaves loose from a crown a bolt goes through, from nowhere else', () => {
    const l = createLitter({ level: 'high' });
    const crowns = [{ x: 4, z: 4, r: 2, lo: 3, hi: 8 }];
    l.begin({ spec: SPEC, R, frame, seed: 7, crowns, focus: frame.n });
    const up = (x, z, h) => place(frame, x, z, R).n.map((a) => a * (R + h * METRE));
    expect(l.shake(up(4, 4, 1), [1, 0, 0])).toBe(false);
    expect(l.shake(up(9, 4, 5), [1, 0, 0])).toBe(false);
    expect(l.shake(up(4.5, 4, 5), [1, 0, 0])).toBe(true);
    expect(l.info().airborne).toBeGreaterThan(0);
  });

  it('lays them again round you when you’ve jumped (out of the ship’s door), not as you walk', () => {
    const l = begun();
    // (the ship down: a patch cleared round it)
    l.blast(ground(0, 0), 7, 12);
    for (let k = 0; k < 600; k++) l.update(1 / 30, { focusN: frame.n });
    expect(l.info(ground(0, 0), 3).near).toBe(0);
    // (walked a step: where each leaf lies kept)
    const was = l.sim.p.slice();
    l.update(1 / 60, { focusN: place(frame, 0, 0.3, R).n });
    let kept = 0;
    for (let i = 0; i < l.sim.count; i++) if (Math.hypot(l.sim.p[4 * i] - was[4 * i], l.sim.p[4 * i + 2] - was[4 * i + 2]) < 0.1) kept += 1;
    expect(kept / l.sim.count).toBeGreaterThan(0.9);
    // (out of the door 24 m off, a box away: not the cleared patch, wrapped, round you)
    const door = place(frame, 0, 24, R).n;
    l.update(1 / 60, { focusN: door });
    expect(l.info(door.map((a) => a * R), 3).near).toBeGreaterThan(0);
  });

  it('sends each leaf’s turn and size whenever they’re laid, not only the first time', () => {
    const l = createLitter({ level: 'high' });
    const seed = l.mesh.geometry.attributes.aLeafSeed;
    expect(seed.array).toBe(l.sim.seed);
    const v0 = seed.version;
    l.begin({ spec: SPEC, R, frame, seed: 7, crowns: [], focus: frame.n });
    const v1 = seed.version;
    expect(v1).toBeGreaterThan(v0);
    l.update(1 / 60, { focusN: place(frame, 0, 24, R).n });
    expect(seed.version).toBeGreaterThan(v1);
  });

  it('keeps a blast thrown in the frame the box is laid again (the ship down as you step out)', () => {
    const l = begun();
    expect(l.blast(ground(0, 4), 3)).toBeGreaterThan(0);
    l.update(1 / 60, { focusN: place(frame, 0, 10, R).n });
    for (let k = 0; k < 10; k++) l.update(1 / 60, { focusN: place(frame, 0, 10, R).n });
    expect(l.info().airborne).toBeGreaterThan(0);
  });

  it('isn’t laid again by a turn, which swings the look-ahead, only by a move', () => {
    const l = begun();
    const was = l.sim.p.slice();
    l.update(1 / 60, { focusN: frame.n, facing: frame.f });
    l.update(1 / 60, { focusN: frame.n, facing: frame.f.map((a) => -a) });
    let kept = 0;
    for (let i = 0; i < l.sim.count; i++) if (Math.hypot(l.sim.p[4 * i] - was[4 * i], l.sim.p[4 * i + 2] - was[4 * i + 2]) < 1e-6) kept += 1;
    // (a few wrapped round to the new side of the box, none laid again)
    expect(kept / l.sim.count).toBeGreaterThan(0.6);
  });

  it('leaves the parked ship’s ground clear with motion turned down too', () => {
    const l = begun({ reduced: true });
    l.update(1 / 60, { focusN: frame.n, hole: { n: frame.n, r: 4 * METRE } });
    expect(l.mesh.material.onBeforeCompile).toBeTypeOf('function');
    const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
    l.mesh.material.onBeforeCompile(sh);
    expect(sh.uniforms.uLeafHole.value.z).toBeCloseTo(4, 6);
  });

  it('with motion turned down lies still where it was laid, kept round you', () => {
    const l = begun({ reduced: true });
    walk(l, 120);
    expect(l.blast(ground(0, 0), 3)).toBe(0);
    expect(l.sim.v.every((v) => v === 0)).toBe(true);
    for (let i = 0; i < l.sim.count; i++) expect(l.sim.p[4 * i + 1]).toBeCloseTo(LEAF.floor, 6);
    // (you walk 30 m on: the leaves come round with you)
    const far = place(frame, 0, 30, R).n;
    l.update(1 / 60, { focusN: far });
    for (let i = 0; i < l.sim.count; i++) expect(Math.abs(l.sim.p[4 * i + 2] - 30)).toBeLessThanOrEqual(14 + 1e-3);
  });
});
