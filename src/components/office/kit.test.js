import { describe, expect, it, vi } from 'vitest';
import { makeKit } from './kit';

// (node has no canvas to paint the screens, the nameplates and the sign on)
vi.mock('./paint', async (real) => {
  const blank = () => ({ width: 1, height: 1 });
  return { ...(await real()), screens: blank, nameplate: blank, mugBand: blank, sign: blank, paper: blank, speckle: blank, paperBox: blank };
});

// the kit as it is when nothing it loads has come (every texture and scanned
// model missing, so their stand-ins and plain colours)
const kit = makeKit({}, {}, null);

describe('the office kit', () => {
  it('sets Dwight’s stapler in lime Jell-O that three doesn’t draw the office twice to see through', () => {
    const g = kit.jello();
    const see = [];
    g.traverse((o) => o.isMesh && [o.material].flat().forEach((m) => m.transparent && see.push(m)));
    expect(see).toHaveLength(1);
    const [m] = see;
    expect(m.transmission).toBe(0);
    expect(m.opacity).toBeGreaterThan(0.6);
    expect(m.opacity).toBeLessThan(0.9);
    expect(m.roughness).toBeLessThan(0.2);
    expect(m.depthWrite).toBe(false);
    expect(m.color.g).toBeGreaterThan(m.color.r); // (lime)
    expect(m.color.g).toBeGreaterThan(m.color.b);
    expect(m.sheen + m.emissiveIntensity * m.emissive.getHex()).toBeGreaterThan(0);
  });
});
