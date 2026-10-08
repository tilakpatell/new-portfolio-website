import { describe, expect, it } from 'vitest';
import { createWar } from './war';

// fronts at one spot each: every burst goes off there
const at = (x, y, z) => ({ dirs: new Float32Array([x, y, z]), sum: new Float32Array([1]), spread: 0 });
// where each burst is, as a unit direction
const spots = (war) => {
  const a = war.group.children[0].geometry.getAttribute('aAt').array;
  const out = [];
  for (let i = 0; i < a.length; i += 4) {
    const l = Math.hypot(a[i], a[i + 1], a[i + 2]);
    out.push([a[i], a[i + 1], a[i + 2]].map((v) => Math.round((v / l) * 1000) / 1000));
  }
  return out;
};

describe('the war’s fronts', () => {
  it('moves them when told, each burst on its next round', () => {
    const war = createWar({ radius: 2, zones: at(0, 1, 0), count: 4, flares: 1 });
    war.update(0);
    expect(new Set(spots(war).map(String))).toEqual(new Set(['0,1,0']));
    war.setZones(at(1, 0, 0));
    war.update(0.001); // (none has come round yet)
    expect(new Set(spots(war).map(String))).toEqual(new Set(['0,1,0']));
    war.update(30); // (every one has)
    expect(new Set(spots(war).map(String))).toEqual(new Set(['1,0,0']));
    war.dispose();
  });
});
