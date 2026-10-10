import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAST } from './cast';

const at = (path) => new URL(`../../../${path}`, import.meta.url);
const credits = JSON.parse(readFileSync(at('public/models/invincible/credits.json'), 'utf8'));
// the world's sources, as text
const sources = (dir = 'src/components/invincible') =>
  readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) && !e.name.includes('.test.') ? [readFileSync(at(`${dir}/${e.name}`), 'utf8')] : []));

describe('the Invincible cast', () => {
  it('each names a model that is there, a size and a credit', () => {
    for (const [name, c] of Object.entries(CAST)) {
      expect(existsSync(at(`public${c.file}`)), c.file).toBe(true);
      expect(c.h, name).toBeGreaterThan(0);
      expect(typeof c.rig, name).toBe('boolean');
      expect(credits[name]?.name, `${name}: credit`).toBeTruthy();
      expect(credits[name].license, name).toBeTruthy();
    }
  });

  it('has everyone the world asks for by name', () => {
    const code = sources().join('\n');
    const used = new Set([...code.matchAll(/CAST\.([a-zA-Z]+)/g), ...code.matchAll(/CAST\[['"]([a-zA-Z]+)['"]\]/g)].map((m) => m[1]));
    // and the names handed to loadCast
    for (const m of code.matchAll(/loadCast\(\[([^\]]*)\]/g)) for (const n of m[1].matchAll(/'([a-zA-Z]+)'/g)) used.add(n[1]);
    expect(used.size).toBeGreaterThan(0);
    for (const n of used) expect(CAST[n], n).toBeTruthy();
  });

  it('stands in the heights the show gives them', () => {
    expect(CAST.omni.h).toBeGreaterThan(CAST.mark.h);
    expect(CAST.thragg.h).toBeGreaterThan(CAST.omni.h);
    expect(CAST.mauler.h).toBeGreaterThan(CAST.allen.h);
    expect(CAST.debbie.h).toBeLessThan(CAST.mark.h);
  });
});
