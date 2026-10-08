import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LANDMARKS, LANDMARK_IDS, createLandmarks, drawnAngle, landK } from './landmarks';
import { FAR_STARS } from './farStars';
import { WONDERS, binaryAt } from './deep';

const deg = (d) => (d * Math.PI) / 180;
const camAt = (x, y, z) => {
  const c = new THREE.PerspectiveCamera(34, 1, 1, 30000);
  c.position.set(x, y, z);
  c.updateMatrixWorld(true);
  return c;
};
const byId = (id) => LANDMARKS.find((l) => l.id === id);

describe('the rules', () => {
  it('lists the big things', () => {
    expect([...LANDMARK_IDS].sort()).toEqual(['cradle', 'curvesun', 'ember', 'halcyon', 'lantern', 'maw', 'sun', 'twins', 'veil']);
  });

  it('leaves the far stars to everything else', () => {
    for (const p of FAR_STARS) expect(LANDMARK_IDS.has(p.id), p.id).toBe(false);
  });

  it('draws at least the least size, then the true size', () => {
    const least = deg(4);
    expect(drawnAngle(500, 100000, least)).toBeCloseTo(least);
    expect(drawnAngle(500, 5000, least)).toBeCloseTo(2 * Math.atan(500 / 5000));
  });

  it('hands over where the true size meets the least', () => {
    expect(byId('maw').real).toBeCloseTo(500 / Math.tan(deg(2)), -1);
    expect(byId('veil').real).toBeCloseTo(700 / Math.tan(deg(7)), -1);
    expect(byId('cradle').real).toBeCloseTo(600 / Math.tan(deg(7)), -1);
    expect(byId('ember').real).toBe(180 * 40);
    expect(byId('lantern').real).toBeCloseTo(168 * 20, 0);
    for (const l of LANDMARKS.filter((x) => x.kind === 'hole' || x.kind === 'nebula')) expect(drawnAngle(l.r, l.real, l.least), l.id).toBeCloseTo(l.least, 6);
  });

  it('crossfades over a fifth either side', () => {
    expect(landK(0.79 * 1e4, 1e4)).toBe(0);
    expect(landK(1.21 * 1e4, 1e4)).toBe(1);
    expect(landK(1e4, 1e4)).toBeCloseTo(0.5);
  });

  it('puts the Twins in two parts', () => {
    const parts = LANDMARKS.filter((l) => l.group === 'twins');
    expect(parts.map((l) => l.part)).toEqual([0, 1]);
    const w = WONDERS.find((x) => x.id === 'twins');
    expect(parts[1].colors[0]).toBe(w.pair.color);
  });

  it('keeps the curve\'s sun to its sector', () => {
    expect(byId('curvesun').sector).toBe('rickmorty');
    expect(byId('maw').sector).toBe('main');
    expect(byId('sun').sector).toBe('main');
  });
});

describe('drawn', () => {
  const groups = () => {
    const made = {};
    return { made, of: (id) => (made[id] ??= new THREE.Group()) };
  };
  const at = (lm) => lm.mesh.geometry.attributes;

  it('stands in for the real thing far off, and gives it back near', () => {
    const parent = new THREE.Group();
    const g = groups();
    const lm = createLandmarks(parent, { skyFar: 24000 });
    const maw = WONDERS.find((w) => w.id === 'maw');
    const i = LANDMARKS.findIndex((l) => l.id === 'maw');
    lm.update(camAt(maw.at[0] + 30000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    expect(at(lm).aK.getX(i)).toBe(1);
    expect(g.made.maw.visible).toBe(false);
    expect(at(lm).aSize.getX(i)).toBeCloseTo(deg(4));
    lm.update(camAt(maw.at[0] + 3000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    expect(at(lm).aK.getX(i)).toBe(0);
    expect(g.made.maw.visible).toBe(true);
    lm.update(camAt(maw.at[0] + 30000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    lm.dispose();
    expect(g.made.maw.visible).toBe(true);
    expect(parent.children).toHaveLength(0);
  });

  it('shows nothing of the other sector', () => {
    const g = groups();
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    lm.update(camAt(3000, 0, -52000), 0, { sector: 'rickmorty', groups: g.of }); // (in the Curve, well off its sun)
    const k = (id) => at(lm).aK.getX(LANDMARKS.findIndex((l) => l.id === id));
    expect(k('maw')).toBe(0);
    expect(k('veil')).toBe(0);
    expect(k('curvesun')).toBeGreaterThan(0);
    expect(g.made.maw.visible).toBe(false);
    lm.dispose();
  });

  it('puts each of the Twins where binaryAt has it', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    lm.update(camAt(0, 0, 0), 120, { sector: 'main', groups: () => null });
    const w = WONDERS.find((x) => x.id === 'twins');
    const { a, b } = binaryAt(w, 120);
    const c = at(lm).aCenter;
    LANDMARKS.forEach((l, i) => {
      if (l.group !== 'twins') return;
      const want = l.part === 0 ? a : b;
      const d = Math.hypot(...want);
      expect(c.getX(i) * d / 24000).toBeCloseTo(want[0], 0);
      expect(c.getZ(i) * d / 24000).toBeCloseTo(want[2], 0);
    });
    lm.dispose();
  });
});

describe('its shaders', () => {
  // (GLSL ES keeps these back for later: a variable named one doesn't compile)
  const RESERVED = ['half', 'fixed', 'input', 'output', 'sample', 'filter', 'sizeof', 'cast', 'namespace', 'using', 'common', 'partition', 'active', 'superp', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4', 'long', 'short', 'double', 'unsigned', 'external', 'interface', 'union', 'enum', 'typedef', 'template', 'this', 'goto', 'inline', 'noinline', 'volatile', 'public', 'static', 'extern', 'asm'];
  it('names nothing with a reserved word', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    const { vertexShader, fragmentShader } = lm.mesh.material;
    for (const src of [vertexShader, fragmentShader])
      for (const w of RESERVED) expect(src, w).not.toMatch(new RegExp(`\\b(float|int|bool|vec[234]|mat[234])\\s+${w}\\b`));
    lm.dispose();
  });
});

describe('on foot', () => {
  it('is never cut by the far plane (on foot it is the landing sky, well short of the landmarks)', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    expect(lm.mesh.material.vertexShader).toMatch(/gl_Position\.z = min\(gl_Position\.z, gl_Position\.w \* 0\.999999\)/);
    lm.dispose();
  });
});
