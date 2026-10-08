import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STEEP, bakeSize, createSky, nebulaeOf, starCount, starLaw } from './sky';
import FIXTURE from './__fixtures__/sky.json';
import { SYSTEMS, systemById } from './systems';

// a renderer as far as the bake uses it: where it draws to, what it draws
const fakeRenderer = () => {
  const before = new THREE.WebGLRenderTarget(4, 4);
  return {
    before,
    coordinateSystem: THREE.WebGLCoordinateSystem,
    autoClear: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    xr: { enabled: false },
    target: before,
    getRenderTarget() {
      return this.target;
    },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: vi.fn(function (t) {
      this.target = t;
    }),
    render: vi.fn(function () {
      this.drew = { autoClear: this.autoClear, toneMapping: this.toneMapping };
    }),
  };
};

describe('the nebulae', () => {
  it('gives each system three nebulae of its own, the same every time', () => {
    const a = nebulaeOf(systemById('hoth')), b = nebulaeOf(systemById('hoth')), c = nebulaeOf(systemById('naboo'));
    expect(a).toHaveLength(3); expect(a).toEqual(b); expect(a).not.toEqual(c);
    for (const n of a) { expect(Math.hypot(...n.dir)).toBeCloseTo(1, 5); expect(n.size).toBeGreaterThanOrEqual(0.18); expect(n.size).toBeLessThanOrEqual(0.45); }
  });

  it('gives every system colours and warps in range', () => {
    for (const s of SYSTEMS) {
      for (const n of nebulaeOf(s)) {
        expect(n.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(n.warp).toBeGreaterThanOrEqual(0.6);
        expect(n.warp).toBeLessThanOrEqual(1.6);
        expect(n.size).toBeGreaterThanOrEqual(0.18);
        expect(n.size).toBeLessThanOrEqual(0.45);
      }
    }
  });
});

describe('the bake', () => {
  it('sizes its bake by the tier', () => { expect(bakeSize({ small: false })).toBe(1024); expect(bakeSize({ small: true })).toBe(512); });

  it('draws black until it is baked, then the cube; six faces, and the renderer left as it was', () => {
    const sky = createSky({ small: true });
    const look = sky.group.children[0].material.uniforms.uSky;
    expect(look.value).toBe(null);
    sky.setSystem(systemById('hoth'));
    const r = fakeRenderer();
    sky.bake(r);
    expect(r.render).toHaveBeenCalledTimes(6);
    expect(r.drew).toEqual({ autoClear: true, toneMapping: THREE.NoToneMapping });
    expect(look.value?.isCubeTexture).toBe(true);
    expect(look.value.image[0].width).toBe(512);
    expect(r.target).toBe(r.before);
    expect(r.autoClear).toBe(false);
    expect(r.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    sky.dispose();
  });

  it('bakes into the renderer it was made with, and not at all once disposed', () => {
    const r = fakeRenderer();
    const sky = createSky({ renderer: r });
    sky.setSystem(systemById('tatooine'));
    sky.bake();
    expect(r.render).toHaveBeenCalledTimes(6);
    sky.dispose();
    sky.bake();
    sky.bake(fakeRenderer());
    expect(r.render).toHaveBeenCalledTimes(6);
  });

  it('has its shader made and linking before the first bake, against the cube it bakes into', async () => {
    const r = fakeRenderer();
    let into = null;
    r.compile = vi.fn((scene) => {
      into = r.target;
      const mats = new Set();
      scene.traverse((o) => o.material && mats.add(o.material));
      return mats;
    });
    r.properties = { get: () => ({ currentProgram: { isReady: () => true } }) };
    r.getContext = () => ({ isContextLost: () => false });
    const sky = createSky({ small: true, renderer: r });
    await sky.prepare();
    expect(r.compile).toHaveBeenCalledTimes(1);
    expect(into?.isWebGLCubeRenderTarget).toBe(true); // (the shader it bakes with: drawn to a target, no tone mapping)
    expect([...r.compile.mock.results[0].value].map((m) => m.isShaderMaterial)).toEqual([true]);
    expect(r.target).toBe(r.before); // (the renderer left as it was)
    expect(r.render).not.toHaveBeenCalled(); // (nothing drawn)
    sky.dispose();
    await sky.prepare();
    expect(r.compile).toHaveBeenCalledTimes(1);
  });
});

// the sky as it was before its fidelity went up (__fixtures__/sky.json: the
// bake's uniforms, and a hash of the first 4,200 stars, rounded)
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r2 = (v) => Math.round(v * 100) / 100;
const fnv = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
};
const starsOf = (sky) => sky.group.children.find((c) => c.isPoints && c.geometry.attributes.position.count > 1000).geometry.attributes;
const hashStars = (g, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = [g.position.getX(i), g.position.getY(i), g.position.getZ(i), g.aSize.getX(i), g.aColor.getX(i), g.aColor.getY(i), g.aColor.getZ(i)].map(r4);
    out.push([r2(s[0]), r2(s[1]), r2(s[2]), r2(s[3] * 100) / 100, r2(s[4] * 100) / 100, r2(s[5] * 100) / 100, r2(s[6] * 100) / 100]);
  }
  return fnv(JSON.stringify(out));
};
const SYSTEM_OF = { hoth: () => systemById('hoth'), tatooine: () => systemById('tatooine'), 'kashyyyk-borrowed': () => ({ ...systemById('kashyyyk'), suns: [] }) };
const ser = (v) => (Array.isArray(v) ? v.map(ser) : typeof v === 'number' ? r4(v) : v.toArray().map(r4));

describe('its fidelity', () => {
  it('sizes the bake by level', () => {
    expect(bakeSize({ small: true, level: 'ultra' })).toBe(512);
    expect(bakeSize({ level: 'ultra' })).toBe(2048);
    expect(bakeSize({ level: 'high' })).toBe(1536);
    expect(bakeSize({ level: 'mid' })).toBe(1024);
    expect(bakeSize({ level: 'low' })).toBe(512);
    expect(bakeSize({ small: false })).toBe(1024);
    expect(bakeSize({ small: true })).toBe(512);
  });

  it('counts the stars by level', () => {
    expect(starCount({ level: 'ultra' })).toBe(12000);
    expect(starCount({ level: 'high' })).toBe(12000);
    expect(starCount({ level: 'mid' })).toBe(7000);
    expect(starCount({ level: 'low' })).toBe(3000);
    expect(starCount({ small: true, level: 'high' })).toBe(3000);
  });

  it('looks as it did: the same bake, and the same first 4,200 stars', () => {
    for (const [id, want] of Object.entries(FIXTURE)) {
      const sky = createSky({ level: 'high' });
      sky.setSystem(SYSTEM_OF[id]());
      const r = fakeRenderer();
      let scene = null;
      r.render = vi.fn((s) => (scene = s));
      sky.bake(r);
      const un = scene.children[0].material.uniforms;
      for (const [k, v] of Object.entries(want.uniforms)) expect(ser(un[k].value), `${id} ${k}`).toEqual(v);
      const g = starsOf(sky);
      expect(g.position.count).toBe(12000);
      expect(hashStars(g, 4200), id).toBe(want.stars.hash);
      sky.dispose();
    }
  });

  it('bakes without mipmaps (the sky is only ever magnified)', () => {
    const sky = createSky({ level: 'ultra' });
    sky.setSystem(systemById('hoth'));
    sky.bake(fakeRenderer());
    const tex = sky.group.children[0].material.uniforms.uSky.value;
    expect(tex.generateMipmaps).toBe(false);
    expect(tex.minFilter).toBe(THREE.LinearFilter);
    expect(tex.image[0].width).toBe(2048);
    sky.dispose();
  });

  it('draws the stars past today\'s fainter, for depth rather than a new pattern', () => {
    const sky = createSky({ level: 'high' });
    sky.setSystem(systemById('hoth'));
    const g = starsOf(sky);
    const mean = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += g.aColor.getX(i) + g.aColor.getY(i) + g.aColor.getZ(i);
      return s / (b - a);
    };
    expect(mean(4200, 12000)).toBeLessThan(mean(0, 4200) * 0.8);
    sky.dispose();
  });
});

// the universe map borrows this sky dimmed (scene.js: dim 0.4, starsPast
// 0.25); the galaxy's own stays exactly as it is
const fullHash = (sky) => {
  const g = starsOf(sky);
  return fnv(JSON.stringify([...g.position.array, ...g.aSize.array, ...g.aColor.array].map(r4)));
};
const bakeUniforms = (sky) => {
  const r = fakeRenderer();
  let scene = null;
  r.render = vi.fn((s) => (scene = s));
  sky.bake(r);
  return scene.children[0].material.uniforms;
};
const topFifthShare = (b) => {
  const s = [...b].sort((x, y) => y - x);
  const sum = (a) => a.reduce((t, v) => t + v, 0);
  return sum(s.slice(0, Math.round(s.length / 5))) / sum(s);
};

describe('its dim, for the map', () => {
  it("keeps the galaxy's law: today's values, the stars past 4,200 at 0.7", () => {
    expect(starLaw(0, 0)).toBeCloseTo(0.18, 6);
    expect(starLaw(0.5, 1000)).toBeCloseTo(0.18 + 0.125 * 0.9, 6);
    expect(starLaw(1, 4199)).toBeCloseTo(1.08, 6);
    expect(starLaw(1, 4200)).toBeCloseTo(1.08 * 0.7, 6);
    expect(starLaw(0.3, 11999)).toBeCloseTo((0.18 + 0.027 * 0.9) * 0.7, 6);
  });

  it("draws the galaxy's sky as it was, every one of its 12,000 stars, and the bake at full strength", () => {
    for (const [id, hash] of [['hoth', '1c39423c'], ['kashyyyk', '9c11b810']]) {
      const sky = createSky({ level: 'high' });
      sky.setSystem(systemById(id));
      expect(fullHash(sky), id).toBe(hash);
      const u = bakeUniforms(sky);
      expect(u.uDim.value).toBe(1);
      expect(u.uGrain.value).toBe(1);
      sky.dispose();
    }
  });

  it('dims the bake and leaves its grain out when asked', () => {
    const sky = createSky({ level: 'ultra', dim: 0.4 });
    sky.setSystem(systemById('kashyyyk'));
    const u = bakeUniforms(sky);
    expect(u.uDim.value).toBe(0.4);
    expect(u.uGrain.value).toBe(0);
    sky.dispose();
  });

  it('steepens the law so the brightest fifth carry 70 % of the light', () => {
    const b = Array.from({ length: 4200 }, (_, i) => starLaw((i + 0.5) / 4200, i, { steep: true }));
    expect(topFifthShare(b)).toBeGreaterThan(0.68);
    expect(topFifthShare(b)).toBeLessThan(0.72);
    expect(starLaw(1, 0, { steep: true })).toBeCloseTo(1.08, 6); // (the brightest as bright as ever)
    expect(starLaw(0, 0, { steep: true })).toBeCloseTo(STEEP.floor, 6);
  });

  it('puts the dimmed sky\'s stars where they were, steeper, and those past 4,200 at starsPast', () => {
    const was = createSky({ level: 'high' });
    const now = createSky({ level: 'high', dim: 0.4, starsPast: 0.25 });
    was.setSystem(systemById('kashyyyk'));
    now.setSystem(systemById('kashyyyk'));
    const a = starsOf(was);
    const b = starsOf(now);
    expect([...b.position.array]).toEqual([...a.position.array]);
    expect([...b.aSize.array]).toEqual([...a.aSize.array]);
    const lum = (g, i) => g.aColor.getX(i) + g.aColor.getY(i) + g.aColor.getZ(i);
    const first = Array.from({ length: 4200 }, (_, i) => lum(b, i));
    expect(topFifthShare(first)).toBeGreaterThan(0.66);
    // past 4,200, the same law at 0.25 rather than 1: the brightest of them under 0.3 of the first's
    let most = 0;
    for (let i = 4200; i < 12000; i++) most = Math.max(most, b.aColor.getX(i), b.aColor.getY(i), b.aColor.getZ(i));
    expect(most).toBeLessThanOrEqual(1.08 * 0.25 + 1e-6);
    was.dispose();
    now.dispose();
  });

  it('can thin the stars past 4,200 without dimming the bake', () => {
    const sky = createSky({ level: 'high', starsPast: 0.25 });
    sky.setSystem(systemById('hoth'));
    const ref = createSky({ level: 'high' });
    ref.setSystem(systemById('hoth'));
    const a = starsOf(ref);
    const b = starsOf(sky);
    expect(b.aColor.getX(0)).toBe(a.aColor.getX(0));
    expect(b.aColor.getX(5000)).toBeCloseTo((a.aColor.getX(5000) / 0.7) * 0.25, 5);
    expect(bakeUniforms(sky).uDim.value).toBe(1);
    sky.dispose();
    ref.dispose();
  });
});
