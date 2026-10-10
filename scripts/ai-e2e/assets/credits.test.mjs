// Tier 2: every credit is for a file the site ships, and every model the
// site ships has a credit. The models that predate the credits are listed in
// allow-uncredited.json: the list only shrinks (a model credited since, or
// gone, must leave it), and what is on it is a finding for the owner.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../contract/repo.mjs';
import { audit, covers, stem } from './credits.mjs';

const ALLOWED = JSON.parse(readFileSync(new URL('./allow-uncredited.json', import.meta.url), 'utf8'));
// (a listed model's cuts are listed with it, as a credited model's are credited with it: its .ultra.glb beside it)
const listed = (f) => ALLOWED.files.some((a) => stem(a) === stem(f));

describe('the credits as shipped', () => {
  const { dead, uncredited } = audit(REPO);

  it('are each for a file that exists', () => {
    expect(dead.map((c) => `${c.list}: ${c.key}`)).toEqual([]);
  });

  it('cover every model under public/models/, but the few on the allow-list', () => {
    expect(uncredited.filter((f) => !listed(f))).toEqual([]);
  });

  it('keep the allow-list to models that are still there and still uncredited', () => {
    const stale = ALLOWED.files.filter((f) => !existsSync(join(REPO, f)) || !uncredited.includes(f));
    expect(stale, 'credited or gone since: take these off allow-uncredited.json').toEqual([]);
  });
});

describe('reading a credit', () => {
  it('finds a CC0 kit’s file under its own folder, and a model’s cuts and smaller copies with it', () => {
    const credit = { key: 'meshy/rm/fart', name: 'rm/fart' };
    expect(covers(credit, 'public/models/c137/rm/fart.glb')).toBe(true);
    expect(covers(credit, 'public/models/c137/rm/fart.lo.glb')).toBe(true);
    expect(covers(credit, 'public/models/c137/rm/lod/fart.glb')).toBe(true);
    expect(covers(credit, 'public/models/c137/rm/fart.lod1.glb')).toBe(true);
    expect(covers(credit, 'public/models/c137/rm/fart.far.glb')).toBe(true);
    expect(covers(credit, 'public/models/c137/rm/farter.glb')).toBe(false);
    expect(covers({ key: 'tex/armour', name: 'armour' }, 'public/games/tex/armour/arm.webp')).toBe(true);
    expect(covers({ key: 'x', file: 'public/models/sketchfab/x.glb' }, 'public/models/sketchfab/x.glb')).toBe(true);
    expect(covers({ key: 'x', file: 'public/models/sketchfab/x.glb' }, 'public/models/other/x.glb')).toBe(false);
  });
  it('finds a pack’s files where its credit says it was rebuilt to', () => {
    const pack = { key: 'mc/pixel-perfection', name: 'pixel-perfection', paths: ['public/mc/'] };
    expect(covers(pack, 'public/mc/blocks.webp')).toBe(true);
    expect(covers(pack, 'public/mc/skins/cow.webp')).toBe(true);
    expect(covers(pack, 'public/models/mc.glb')).toBe(false);
  });
  it('finds a cast’s model by the name the cast gives it, in its own folder only', () => {
    const civA = { key: 'civA', dir: 'public/models/invincible/', name: 'civ-a' };
    expect(covers(civA, 'public/models/invincible/civ-a.glb')).toBe(true);
    expect(covers(civA, 'public/models/invincible/civ-b.glb')).toBe(false);
    expect(covers(civA, 'public/models/other/civ-a.glb')).toBe(false);
    expect(covers({ key: 'omni', dir: 'public/models/invincible/', name: 'omni' }, 'public/models/invincible/omni-man.glb')).toBe(true);
  });
});
