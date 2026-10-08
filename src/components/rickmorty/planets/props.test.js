import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake } from '../../universe/trafficKit';
import { PROPS as GALAXY_PROPS, SCATTER as GALAXY_SCATTER } from '../../galaxy/surface/props';
import { SCATTER as MOON_SCATTER } from '../../universe/landings/rmmoons';
import { PROPS, RIDE_RADIUS, SCATTER } from './props';

// a kit that only bakes (no canvas, no scans), as the galaxy's prop tests
// have it, and that keeps every part it was asked to build
const kitOf = () => {
  const built = [];
  return {
    built,
    geometry: (list) => bake(list, 1),
    mats: new Proxy({}, { get: (_, name) => ({ name }) }),
    own: (x) => x,
    build(parts, { name = 'prop' } = {}) {
      built.push(...parts);
      const g = new THREE.Group();
      g.name = name;
      g.add(new THREE.Mesh(bake(parts, 1), { name: 'baked' }));
      return g;
    },
  };
};
const meshes = (o) => {
  let n = 0;
  o.traverse((m) => {
    if (m.isMesh) {
      n += 1;
      const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) expect(Number.isFinite(a.getX(i)) && Number.isFinite(a.getY(i)) && Number.isFinite(a.getZ(i))).toBe(true);
    }
  });
  return n;
};
const KINDS = ['rocksled', 'gearbike', 'purgeskiff', 'birdglider', 'womenswall', 'womenstower', 'fightpit', 'cogtower', 'oilcanal', 'minemouth', 'rallystage', 'snakedome', 'snaketunnel', 'launchgantry', 'hut', 'lighthouse', 'brokenhouse', 'deadtree', 'shelling'];

describe('the planets’ props', () => {
  it('has every kind the planets build, none of them the galaxy’s', () => {
    expect(Object.keys(PROPS).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect(GALAXY_PROPS[kind], kind).toBeUndefined();
  });

  for (const kind of KINDS)
    it(`${kind}: builds to something drawn, nothing broken`, () => {
      const made = PROPS[kind](kitOf(), {});
      expect(made.object).toBeInstanceOf(THREE.Object3D);
      expect(meshes(made.object), kind).toBeGreaterThan(0);
      for (const s of made.solids ?? []) expect(s.circle ?? s.box, JSON.stringify(s)).toBeTruthy();
    });

  it('stands each ride on a circle as wide as it rides', () => {
    for (const kind of ['rocksled', 'gearbike', 'purgeskiff', 'birdglider']) {
      expect(PROPS[kind](kitOf(), {}).solids, kind).toEqual([{ circle: [0, 0, RIDE_RADIUS[kind]] }]);
      expect(PROPS[kind](kitOf(), { color: '#123456', look: '#654321' }).object, kind).toBeTruthy();
    }
  });

  it('lets you walk into the oil canal and onto the rally stage', () => {
    expect(PROPS.oilcanal(kitOf(), {}).solids ?? []).toHaveLength(0);
    expect(PROPS.rallystage(kitOf(), {}).floors?.length).toBeGreaterThan(0);
  });

  it('runs a wall to its length and a cog tower to its height', () => {
    const wall = new THREE.Box3().setFromObject(PROPS.womenswall(kitOf(), { len: 30 }).object);
    expect(wall.max.x - wall.min.x).toBeCloseTo(30, 0);
    const tower = new THREE.Box3().setFromObject(PROPS.cogtower(kitOf(), { h: 40 }).object);
    expect(tower.max.y).toBeGreaterThan(38);
  });

  it('builds a burnt hut with no window lit, and burns a standing one on its quest’s signal', () => {
    const lit = kitOf();
    PROPS.hut(lit, {});
    expect(lit.built.some((p) => p.to === 'glow')).toBe(true);
    const burnt = kitOf();
    PROPS.hut(burnt, { burnt: true });
    expect(burnt.built.some((p) => p.to === 'glow')).toBe(false);
    const hut = PROPS.hut(kitOf(), { i: 2 });
    const [standing, ash] = hut.object.children;
    expect(standing.visible).toBe(true);
    hut.signal('burn-1', true);
    expect(standing.visible).toBe(true);
    hut.signal('burn-2', true);
    expect(standing.visible).toBe(false);
    expect(ash.visible).toBe(true);
  });

  it('draws a broken house in each of its looks', () => {
    for (const look of ['colonial', 'ranch', 'diner', 'nonsense']) expect(meshes(PROPS.brokenhouse(kitOf(), { look }).object), look).toBeGreaterThan(0);
  });

  it('shells about you, and never throws with nobody there', () => {
    const shell = PROPS.shelling(kitOf(), { r: 30, every: 4 });
    expect(shell.follows).toBe(true);
    for (let t = 0; t < 30; t += 0.1) expect(() => shell.update(t, 0.1, null)).not.toThrow();
    const you = { x: 100, y: 2, z: -40 };
    let seen = false;
    for (let t = 0; t < 60; t += 0.05) {
      shell.update(t, 0.05, you);
      const blast = shell.object.getObjectByName('blast');
      if (blast.visible) {
        seen = true;
        expect(Math.hypot(blast.position.x - you.x, blast.position.z - you.z)).toBeLessThanOrEqual(30 + 1e-6);
      }
    }
    expect(seen).toBe(true);
  });
});

describe('the planets’ scattered kinds', () => {
  const KINDS = ['redrock', 'bone', 'cattree', 'feather', 'bolt', 'iceshard', 'egg', 'lantern'];
  it('are each drawn instanced, with a footprint or none', () => {
    expect(Object.keys(SCATTER).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) {
      const made = SCATTER[kind](kitOf(), {});
      expect(made.parts.length, kind).toBeGreaterThan(0);
      for (const p of made.parts) expect(p.geometry.attributes.position.count, kind).toBeGreaterThan(0);
      expect(made.radius === null || made.radius > 0, kind).toBe(true);
      expect(GALAXY_SCATTER[kind], kind).toBeUndefined();
    }
  });

  it('are the moons’ landings’ own, moved here', () => {
    for (const kind of ['bone', 'cattree', 'feather', 'bolt']) expect(MOON_SCATTER[kind], kind).toBe(SCATTER[kind]);
  });
});
