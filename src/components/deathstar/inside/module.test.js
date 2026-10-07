import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateModule, validateWorld } from '../../../runtime/module';
import { WORLD_MB, worldAt } from '../../worlds/worlds';
import { byPath } from '../../universe/universes';
import { placeName } from '../../universe/online/where';
import { guideFor } from '../../guide/pages';
import { keyTokens } from '../../guide/keys';
import { briefKeyFor } from '../../tour/brief';
import { ACHIEVEMENTS } from '../../Achievements';
import inside, { KEYS } from './module';

const PATH = '/deathstar/inside';

describe('aboard the Death Star, the world module', () => {
  it('is a GLSL world that downloads what the phone gate says it does', () => {
    expect(inside).toMatchObject({ id: 'deathstar-inside', shading: 'glsl', mb: 6 });
    expect(inside.mb).toBe(WORLD_MB[PATH]);
    expect(inside.label).toBe('Aboard the Death Star');
    expect(validateModule(inside).id).toBe('deathstar-inside');
    expect(KEYS).toBeTypeOf('object');
  });

  it('makes a world the runtime can draw and put away', async () => {
    const world = await inside.create({}, {});
    expect(validateWorld(world)).toBe(world);
    expect(() => world.dispose()).not.toThrow();
  });
});

describe('aboard the Death Star, on the site', () => {
  it('is a world of its own inside the Death Star’s address, in Star Wars', () => {
    expect(WORLD_MB[PATH]).toBe(6);
    expect(worldAt(PATH).to).toBe(PATH);
    expect(worldAt('/deathstar').to).toBe('/deathstar');
    expect(byPath(PATH).id).toBe('starwars');
  });

  it('has a route of its own, with no footer over the station', () => {
    const app = readFileSync(new URL('../../../App.jsx', import.meta.url), 'utf8');
    expect(app).toContain(`<Route path="${PATH}" element={<DeathStarInside />} />`);
    expect(app).toMatch(new RegExp(`pathname !== '${PATH}'[^\\n]*<Footer />`));
  });

  it('is named for the other pilots, the guide and the tour', () => {
    // (read as “went to …” and “Go to …”, so a place, not “aboard”)
    expect(placeName(PATH)).toBe('the Death Star’s corridors');
    expect(guideFor(PATH).key).toBe(PATH);
    expect(guideFor(PATH).title).toBe('Aboard the Death Star');
    expect(briefKeyFor(PATH)).toBe(PATH);
  });

  it('tells both pause keys in the guide, P for while the pointer is held', () => {
    // (Esc first lets go of a held pointer, so P is the key that pauses then)
    const pause = guideFor(PATH).keys.flatMap((g) => g.rows).find(([, what]) => what === 'Pause');
    expect(keyTokens(pause[0]).map((t) => t.key).filter(Boolean)).toEqual(['Esc', 'P']);
  });

  it('has an achievement for coming aboard, earned on arrival', () => {
    expect(ACHIEVEMENTS['ds-aboard'].name).toBeTruthy();
    const achievements = readFileSync(new URL('../../Achievements.jsx', import.meta.url), 'utf8');
    expect(achievements).toContain(`if (pathname === '${PATH}') unlock('ds-aboard');`);
  });

  it('is in the command palette', () => {
    const palette = readFileSync(new URL('../../CommandPalette.jsx', import.meta.url), 'utf8');
    expect(palette).toMatch(new RegExp(`id: 'w-dsin'[^\\n]*run: go\\('${PATH}'\\)`));
  });
});
