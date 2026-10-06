import { describe, expect, it } from 'vitest';
import { mendCollapsed } from './meshy-mend.mjs';

// Two triangles making a square, laid out on the atlas, and a third beside
// them in 3D (its own vertices, as a chart's are) that the atlas has laid down
// to a point somewhere else.
const square = () => ({
  position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, /* the third: */ 1, 0, 0, 2, 0, 0, 1, 1, 0]),
  uv: new Float32Array([0.1, 0.1, 0.3, 0.1, 0.3, 0.3, 0.1, 0.3, /* collapsed: */ 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]),
  index: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6]),
});

describe('mending triangles an atlas laid down to nothing', () => {
  it('gives one the colour of the triangle it meets in 3D', () => {
    const m = square();
    expect(mendCollapsed(m.index, m.uv, m.position, 1024)).toBe(1);
    // its corners all at the middle of the triangle it shares an edge with
    // (the first: corners 0, 1, 2), which has a colour of its own
    for (let c = 4; c < 7; c++) {
      expect(m.uv[c * 2]).toBeCloseTo((0.1 + 0.3 + 0.3) / 3, 6);
      expect(m.uv[c * 2 + 1]).toBeCloseTo((0.1 + 0.1 + 0.3) / 3, 6);
    }
  });

  it('leaves a mesh whose every triangle has room on the atlas as it was', () => {
    const m = square();
    m.uv.set([0.5, 0.5, 0.7, 0.5, 0.5, 0.7], 8);
    const before = Float32Array.from(m.uv);
    expect(mendCollapsed(m.index, m.uv, m.position, 1024)).toBe(0);
    expect(m.uv).toEqual(before);
  });

  it('never moves a vertex a good triangle also uses', () => {
    // the collapsed triangle shares vertex 2 with the square
    const m = square();
    m.index.set([4, 5, 2], 6);
    m.uv.set([0.3, 0.3], 8); // (vertex 4 laid on vertex 2: the triangle is a line)
    m.uv.set([0.3, 0.3], 10);
    expect(mendCollapsed(m.index, m.uv, m.position, 1024)).toBe(1);
    expect([m.uv[2 * 2], m.uv[2 * 2 + 1]]).toEqual([Math.fround(0.3), Math.fround(0.3)]);
    // (its own two go to the square's middle)
    expect(m.uv[4 * 2]).toBeCloseTo((0.1 + 0.3 + 0.3) / 3, 6);
  });

  it('ignores a triangle with no area in 3D either, which shows nothing', () => {
    const m = square();
    m.position.set([1, 0, 0, 1, 0, 0, 1, 0, 0], 12);
    expect(mendCollapsed(m.index, m.uv, m.position, 1024)).toBe(0);
  });

  it('reaches past other collapsed triangles to the nearest good one', () => {
    // a strip: the square, then two collapsed triangles each beside the last
    const m = square();
    const position = new Float32Array([...m.position, 2, 0, 0, 3, 0, 0, 2, 1, 0]);
    const uv = new Float32Array([...m.uv, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]);
    const index = new Uint32Array([...m.index, 7, 8, 9]);
    expect(mendCollapsed(index, uv, position, 1024)).toBe(2);
    expect(uv[9 * 2]).toBeCloseTo((0.1 + 0.3 + 0.3) / 3, 6);
  });
});
