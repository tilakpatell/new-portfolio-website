import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LEAF } from './leafSim';
import { createWind } from './wind';
import { createFlatLitter, flatLeafCount, flatLitterShader } from './flatLitter';

const SPEC = { colours: ['#a39c34', '#d8a83c', '#b4622c'], density: 0.55, size: 0.28, shed: 0.7 };
// (a rolling floor, as a world's height function is, counting how often it's asked)
const rolling = () => {
  const f = (x, z) => {
    f.calls += 1;
    return 0.4 * Math.sin(x * 0.3) + 0.25 * Math.cos(z * 0.2) + 1;
  };
  f.calls = 0;
  return f;
};
const made = (opts = {}) => createFlatLitter({ max: 512, half: 14, spec: SPEC, floorAt: rolling(), seed: 3, ...opts });
// (someone walking along +z through the middle of the box, a frame at a time)
const walk = (l, frames, { speed = 1.8, from = -3, x = 0.05, focus = { x: 0, z: 0 } } = {}) => {
  const me = { key: 'me', x, z: from, y: 0 };
  for (let k = 0; k < frames; k++) {
    me.z = from + (speed * k) / 60;
    l.update(1 / 60, { focus, walkers: [me] });
  }
};
// (how far each leaf's ground is from the floor where it now lies, at most)
const off = (l, floorAt) => {
  let worst = 0;
  for (let i = 0; i < l.sim.count; i++) worst = Math.max(worst, Math.abs(l.ground[i] - floorAt(l.sim.p[4 * i], l.sim.p[4 * i + 2])));
  return worst;
};

describe('how many leaves', () => {
  it('lie about you by the place’s density, in 32s, as many as the device can step', () => {
    const at = (d) => [512, 256, 128].map((max) => flatLeafCount(d, { max, half: 14 }));
    expect(at(0.55)).toEqual([416, 256, 128]); // (the Shire)
    expect(at(0.35)).toEqual([288, 256, 128]);
    expect(at(0.001)).toEqual([32, 32, 32]);
  });
});

describe('the leaves’ shader', () => {
  it('stands each leaf on the ground where it is, its colour its own, both faces lit as its front', () => {
    const out = flatLitterShader({ vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader });
    expect(out.swapped).toEqual({ leaf: true, colour: true, faceless: true });
    const count = (s, x) => s.split(x).length - 1;
    expect(count(out.vertexShader, 'vec3 objectNormal =')).toBe(1);
    expect(count(out.vertexShader, 'vec3 transformed =')).toBe(1);
    expect(out.vertexShader).not.toContain('#include <beginnormal_vertex>');
    expect(out.vertexShader).not.toContain('#include <begin_vertex>');
    for (const name of ['aLeaf', 'aLeafSeed', 'aLeafGround']) expect(count(out.vertexShader, `attribute ${name === 'aLeafGround' ? 'float' : 'vec4'} ${name};`), name).toBe(1);
    for (const name of ['uLeafFocus', 'uLeafLook', 'uLeafClock', 'uLeafA', 'uLeafB', 'uLeafC']) {
      const decl = new RegExp(`uniform \\w+ ${name};`, 'g');
      expect((out.vertexShader.match(decl) ?? []).length + (out.fragmentShader.match(decl) ?? []).length, name).toBe(1);
    }
    // (on the ground, no sphere: x and z as they are, its height the ground's and its own)
    expect(out.vertexShader).toContain('transformed += vec3(aLeaf.x, aLeafGround + uLeafLook.y + aLeaf.y, aLeaf.z);');
    expect(out.vertexShader).not.toMatch(/uLeafPlanet|uLeafN\b|lfBasis/);
    expect(out.fragmentShader).not.toContain('normal *= faceDirection;');
    expect(out.fragmentShader).toContain('mix(uLeafA, uLeafB, vLeafMix)');
    expect(out.fragmentShader).toContain('discard;'); // (cut to a leaf)
  });

  it('leaves a shader without the lines it looks for as it was', () => {
    const out = flatLitterShader({ vertexShader: 'void main() {}', fragmentShader: 'void main() {}' });
    expect(out.swapped.leaf).toBe(false);
    expect(out.swapped.colour).toBe(false);
    expect(out.vertexShader).toBe('void main() {}');
  });
});

describe('the leaves on level ground', () => {
  it('are one instanced draw, laid at rest, their places sent from the sim as they are', () => {
    const l = made();
    expect(l.mesh.isMesh && !l.mesh.isInstancedMesh).toBe(true);
    expect(l.mesh.geometry.isInstancedBufferGeometry).toBe(true);
    const { aLeaf, aLeafSeed, aLeafGround } = l.mesh.geometry.attributes;
    expect(aLeaf.array).toBe(l.sim.p);
    expect(aLeafSeed.array).toBe(l.sim.seed);
    expect(aLeafGround.array).toBe(l.ground);
    expect(aLeaf.usage).toBe(THREE.DynamicDrawUsage);
    expect(aLeafGround.usage).toBe(THREE.DynamicDrawUsage);
    expect(l.mesh.frustumCulled).toBe(false);
    expect(l.mesh.visible).toBe(true);
    expect(l.material.customProgramCacheKey()).toBe('flat-leaves');
    expect(l.mesh.geometry.instanceCount).toBe(416);
    expect(made({ max: 128 }).mesh.geometry.instanceCount).toBe(128);
    expect(l.info()).toMatchObject({ count: 416, half: 14, airborne: 0, asleep: 416 });
    for (let i = 0; i < l.sim.count; i++) {
      expect(Math.abs(l.sim.p[4 * i])).toBeLessThanOrEqual(14);
      expect(Math.abs(l.sim.p[4 * i + 2])).toBeLessThanOrEqual(14);
    }
  });

  it('lie each on the ground where it is, looked at again only once it’s moved', () => {
    const floorAt = rolling();
    const l = made({ floorAt });
    expect(off(l, floorAt)).toBeLessThan(1e-6);
    // (nothing moving, nothing looked at, nothing sent)
    const version = l.mesh.geometry.attributes.aLeafGround.version;
    floorAt.calls = 0;
    for (let k = 0; k < 30; k++) l.update(1 / 60, { focus: { x: 0, z: 0 } });
    expect(floorAt.calls).toBe(0);
    expect(l.mesh.geometry.attributes.aLeafGround.version).toBe(version);
    // (kicked about: the ones kicked follow the ground, and only they're looked at)
    l.sim.p[0] = 0;
    l.sim.p[2] = 0;
    walk(l, 240);
    expect(floorAt.calls).toBeGreaterThan(0);
    expect(floorAt.calls).toBeLessThan(240 * l.sim.count * 0.1);
    expect(l.mesh.geometry.attributes.aLeafGround.version).toBeGreaterThan(version);
    // (within a centimetre's worth of the slope of where it lies)
    expect(off(l, floorAt)).toBeLessThan(0.01);
  });

  it('kicks the leaves you walk through along, and sends them', () => {
    const l = made();
    l.sim.p[0] = 0;
    l.sim.p[2] = 0;
    const was = l.sim.p.slice();
    const version = l.mesh.geometry.attributes.aLeaf.version;
    walk(l, 240);
    expect(Math.hypot(l.sim.p[0] - was[0], l.sim.p[2] - was[2])).toBeGreaterThan(0.3);
    expect(l.mesh.geometry.attributes.aLeaf.version).toBeGreaterThan(version);
  });

  it('keeps them round you as you go, each on the ground where it’s come round to', () => {
    const floorAt = rolling();
    const l = made({ floorAt });
    const to = { x: 0, z: 0 };
    for (let k = 0; k < 600; k++) {
      to.x = (40 * k) / 600;
      to.z = (-25 * k) / 600;
      l.update(1 / 60, { focus: to });
    }
    for (let i = 0; i < l.sim.count; i++) {
      expect(Math.abs(l.sim.p[4 * i] - to.x)).toBeLessThanOrEqual(14 + 1e-3);
      expect(Math.abs(l.sim.p[4 * i + 2] - to.z)).toBeLessThanOrEqual(14 + 1e-3);
    }
    expect(off(l, floorAt)).toBeLessThan(0.01);
  });

  it('throws them out from a blast in the box, and not from one far off', () => {
    const l = made();
    expect(l.blast(400, 0, 3)).toBe(0);
    expect(l.sim.v.every((v) => v === 0)).toBe(true);
    expect(l.blast(1, 1, 3)).toBeGreaterThan(0);
    for (let k = 0; k < 20; k++) l.update(1 / 60, { focus: { x: 0, z: 0 } });
    expect(l.info().airborne).toBeGreaterThan(0);
    // (and they all come down again)
    for (let k = 0; k < 60 * 30; k++) l.update(1 / 60, { focus: { x: 0, z: 0 } });
    expect(l.info().airborne).toBe(0);
  });

  it('lets leaves go from the crowns in the box, from none outside it', () => {
    const crowns = [{ x: 4, z: 4, r: 2, lo: 3, hi: 8 }];
    const l = made({ crowns, spec: { ...SPEC, shed: 20 } });
    for (let k = 0; k < 30; k++) l.update(1 / 60, { focus: { x: 0, z: 0 } });
    let high = 0;
    for (let i = 0; i < l.sim.count; i++) if (l.sim.p[4 * i + 1] > 2) high += 1;
    expect(high).toBeGreaterThan(0);
    const far = made({ crowns: [{ x: 40, z: 0, r: 2, lo: 3, hi: 8 }], spec: { ...SPEC, shed: 20 } });
    for (let k = 0; k < 30; k++) far.update(1 / 60, { focus: { x: 0, z: 0 } });
    expect(far.info().airborne).toBe(0);
  });

  it('lets the world’s gusts take them, its way', () => {
    const wind = createWind({ strength: 1, angle: 0 });
    const l = made({ wind });
    const was = l.sim.p.slice();
    for (let k = 0; k < 120; k++) {
      wind.update(1 / 60);
      l.update(1 / 60, { focus: { x: 0, z: 0 } });
    }
    let along = 0;
    let moved = 0;
    for (let i = 0; i < l.sim.count; i++) {
      const dx = l.sim.p[4 * i] - was[4 * i];
      if (Math.abs(dx) > 1e-3 && Math.abs(dx) < 14) {
        moved += 1;
        along += Math.sign(dx);
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(along).toBeGreaterThan(0); // (downwind, +x)
    wind.dispose();
  });

  it('with motion turned down lies still where it was laid, kept round you', () => {
    const floorAt = rolling();
    const l = made({ reduced: true, floorAt, wind: createWind({ strength: 1 }), crowns: [{ x: 4, z: 4, r: 2, lo: 3, hi: 8 }] });
    walk(l, 120);
    expect(l.blast(0, 0, 3)).toBe(0);
    expect(l.sim.v.every((v) => v === 0)).toBe(true);
    for (let i = 0; i < l.sim.count; i++) expect(l.sim.p[4 * i + 1]).toBeCloseTo(LEAF.floor, 6);
    expect(l.info()).toMatchObject({ airborne: 0, asleep: l.sim.count });
    // (you walk 30 m on: the leaves come round with you, onto the ground there)
    l.update(1 / 60, { focus: { x: 0, z: 30 } });
    for (let i = 0; i < l.sim.count; i++) expect(Math.abs(l.sim.p[4 * i + 2] - 30)).toBeLessThanOrEqual(14 + 1e-3);
    expect(off(l, floorAt)).toBeLessThan(1e-6);
  });

  it('frees its geometry and material', () => {
    const l = made();
    let freed = 0;
    l.mesh.geometry.addEventListener('dispose', () => (freed += 1));
    l.material.addEventListener('dispose', () => (freed += 1));
    l.dispose();
    expect(freed).toBe(2);
  });
});
