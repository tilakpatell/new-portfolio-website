import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHONE } from './phone';
import { BELT } from './layout';
import { SHIP, SOLIDS } from './ship';
import { UNIVERSES } from './universes';
import { WONDERS } from './deep';
import { DESTINATIONS } from './nav';

const at = (path) => new URL(`../../../${path}`, import.meta.url);
// every .js and .jsx under src, by path
const sources = (dir = 'src') =>
  readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) && !e.name.includes('.test.') ? [[`${dir}/${e.name}`, readFileSync(at(`${dir}/${e.name}`), 'utf8')]] : []));

describe('the phone out past the belt', () => {
  const [x, y, z] = PHONE.at;
  const half = PHONE.scale * 1.15; // half its height

  it('floats clear of the belt, every solid and the ceiling, where the ship can reach it', () => {
    expect(Math.hypot(x, z)).toBeGreaterThan(BELT.outer + half);
    expect(y - half).toBeGreaterThan(BELT.height);
    expect(y + half + 2).toBeLessThan(SHIP.ceiling);
    for (const s of SOLIDS) expect(Math.hypot(x - s.at[0], y - s.at[1], z - s.at[2]), s.id).toBeGreaterThan(s.reach + half + PHONE.reach);
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
