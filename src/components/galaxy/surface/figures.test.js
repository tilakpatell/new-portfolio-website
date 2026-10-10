import { describe, expect, it } from 'vitest';
import { buildFigure } from './figures';

const mats = (f) => {
  const s = new Set();
  f.model.traverse((o) => o.isMesh && s.add(o.material));
  return s;
};

describe('the built people', () => {
  it('dresses two of the same people in the same materials', () => {
    const a = buildFigure('stormtrooper');
    const b = buildFigure('stormtrooper');
    expect([...mats(a)].every((m) => mats(b).has(m))).toBe(true);
  });

  it("leaves the shared materials alone when one goes", () => {
    const a = buildFigure('stormtrooper');
    const b = buildFigure('stormtrooper');
    let gone = 0;
    for (const m of mats(b)) m.addEventListener('dispose', () => gone++);
    a.dispose();
    expect(gone).toBe(0);
  });
});

describe('a built figure says so', () => {
  it('carries the built mark, a person, a droid and a beast alike', () => {
    for (const kind of ['stormtrooper', 'droid', 'tauntaun']) expect(buildFigure(kind).model.userData.built, kind).toBe(true);
  });
});
