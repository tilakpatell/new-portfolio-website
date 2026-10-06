import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHONE } from './phone';
import { HOME_RADIUS } from './layout';
import { SOLIDS, ceilingAt } from './ship';
import { PLACES } from './deep';
import { UNIVERSES } from './universes';
import { WONDERS } from './deep';
import { DESTINATIONS } from './nav';

const at = (path) => new URL(`../../../${path}`, import.meta.url);
// every .js and .jsx under src, by path
const sources = (dir = 'src') =>
  readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) && !e.name.includes('.test.') ? [[`${dir}/${e.name}`, readFileSync(at(`${dir}/${e.name}`), 'utf8')]] : []));

describe('the phone out past the home system', () => {
  const [x, y, z] = PHONE.at;
  const half = PHONE.scale * 1.15; // half its height

  it('floats clear of the home system, every solid and the ceiling, where the ship can reach it', () => {
    expect(Math.hypot(x, z)).toBeGreaterThan(HOME_RADIUS + half);
    expect(y + half + 2).toBeLessThan(ceilingAt(x, z));
    for (const s of SOLIDS) expect(Math.hypot(x - s.at[0], y - s.at[1], z - s.at[2]), s.id).toBeGreaterThan(s.reach + half + PHONE.reach);
  });

  it('is off every way out to the worlds and the wonders, so no trip goes through it', () => {
    // (the straight line from the home system's middle out to each, past its edge)
    for (const p of PLACES.filter((q) => q.kind !== 'station')) {
      const len = Math.hypot(p.at[0], p.at[2]);
      const [ux, uz] = [p.at[0] / len, p.at[2] / len];
      const along = Math.max(0, Math.min(len, x * ux + z * uz));
      const off = Math.hypot(x - ux * along, z - uz * along);
      expect(off, p.id).toBeGreaterThan(PHONE.touch + half);
    }
  });

  it('is on no list: not a universe, a wonder or anywhere to fly to', () => {
    const ids = [...UNIVERSES.map((u) => u.id), ...WONDERS.map((w) => w.id), ...DESTINATIONS.map((d) => d.id)];
    expect(ids).not.toContain('phone');
    expect(UNIVERSES.some((u) => u.to === '/dickansh')).toBe(false);
  });

  it('keeps where it leads to out of everything but its own few files', () => {
    const allowed = /^src\/(components\/dickansh\/|pages\/Dickansh\.jsx$|App\.jsx$|components\/universe\/online\/where\.js$|components\/universe\/phone\.js$|pages\/Universe\.jsx$)/;
    const telling = sources().filter(([path, code]) => /dickansh/i.test(code) && !allowed.test(path)).map(([path]) => path);
    expect(telling).toEqual([]);
  });
});
