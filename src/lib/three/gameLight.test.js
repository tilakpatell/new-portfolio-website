import { describe, expect, it } from 'vitest';
import { lutShape, sunFromProbe, weatherEntry } from './gameLight';

const SIZE = 16;
function cube() {
  const faces = {};
  for (const f of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) faces[f] = new Float32Array(SIZE * SIZE * 3).fill(0.2);
  return faces;
}
function light(faces, face, x, y, v = 50) {
  const i = (y * SIZE + x) * 3;
  faces[face][i] = faces[face][i + 1] = faces[face][i + 2] = v;
}
const deg = (a, b) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };

describe('the sun read from a probe', () => {
  it('finds a bright texel straight up', () => {
    const f = cube();
    light(f, 'py', 7, 7); light(f, 'py', 8, 7); light(f, 'py', 7, 8); light(f, 'py', 8, 8);
    expect(deg(sunFromProbe(f, SIZE), [0, 1, 0])).toBeLessThan(2);
  });

  it('finds one off the middle of a side face within 2°', () => {
    const f = cube();
    light(f, 'pz', 12, 3);
    // the texel's centre on +z, in the cube map's own frame: u right, v down
    const u = (2 * 12.5) / SIZE - 1;
    const v = (2 * 3.5) / SIZE - 1;
    expect(deg(sunFromProbe(f, SIZE), unit([u, -v, 1]))).toBeLessThan(2);
  });

  it('reads +x and -z the way three.js samples them', () => {
    const f = cube();
    light(f, 'px', 7, 7); light(f, 'px', 8, 8); light(f, 'px', 7, 8); light(f, 'px', 8, 7);
    expect(deg(sunFromProbe(f, SIZE), [1, 0, 0])).toBeLessThan(2);
    const g = cube();
    light(g, 'nz', 7, 7); light(g, 'nz', 8, 8); light(g, 'nz', 7, 8); light(g, 'nz', 8, 7);
    expect(deg(sunFromProbe(g, SIZE), [0, 0, -1])).toBeLessThan(2);
  });

  it('gives null for a probe with no light in it', () => {
    const f = cube();
    for (const k in f) f[k].fill(0);
    expect(sunFromProbe(f, SIZE)).toBeNull();
  });
});

describe('the weather a world is under', () => {
  const hoth = { weathers: { sunny: { n: 's' }, sunset: { n: 'd' }, cloudy: { n: 'c' }, blizzard: { n: 'b' }, interior: { n: 'i' } } };

  it('maps the four states to the level’s weathers', () => {
    expect(weatherEntry(hoth, 'clear').n).toBe('s');
    expect(weatherEntry(hoth, 'dusk').n).toBe('d');
    expect(weatherEntry(hoth, 'overcast').n).toBe('c');
    expect(weatherEntry(hoth, 'storm').n).toBe('b');
  });

  it('falls back to sunny, and a world with one weather keeps it', () => {
    expect(weatherEntry(hoth, undefined).n).toBe('s');
    expect(weatherEntry(hoth, 'fog').n).toBe('s');
    expect(weatherEntry({ weathers: { night: { n: 'x' } } }, 'storm').n).toBe('x');
  });

  it('gives null for a world without a record', () => {
    expect(weatherEntry(undefined, 'clear')).toBeNull();
    expect(weatherEntry({ weathers: {} }, 'clear')).toBeNull();
  });
});

describe('the grading LUT’s shape', () => {
  it('reads a strip either way round as its cube', () => {
    expect(lutShape(1024, 32)).toBe(32);
    expect(lutShape(32, 1024)).toBe(32);
    expect(lutShape(256, 16)).toBe(16);
    expect(lutShape(16, 256)).toBe(16);
  });

  it('refuses anything else', () => {
    expect(lutShape(256, 1)).toBeNull();
    expect(lutShape(512, 512)).toBeNull();
    expect(lutShape(1024, 16)).toBeNull();
  });
});
