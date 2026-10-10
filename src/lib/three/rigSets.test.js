import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RIGS, RIG_SET, clipFor, deathFor } from './rigSets';

// an excerpt of the drop's clip manifest (web/anims.jsonl): every clip on the
// five rigs, as the bucket listed them on 2026-10-10
const ANIMS = readFileSync(new URL('../../../scripts/fixtures/bf2017/anims-walkers.jsonl', import.meta.url), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

describe('the walkers’ clip sets', () => {
  it('names every rig the lane packs, and not the AT-M6 (the sequel era’s)', () => {
    expect(Object.keys(RIGS).sort()).toEqual(['atat', 'atrt', 'atst', 'atte', 'droideka']);
    expect(RIG_SET('atm6')).toBeNull();
  });

  it('gives the AT-AT the tow cable’s own fall', () => {
    expect(RIG_SET('atat')['die.cable']).toBe('A_ATAT_Stand_Death_TowCable_Fwd_01');
    expect(RIG_SET('atat').die).toBe('A_ATAT_Stand_Death_Fwd_01');
  });

  it('names only clips the game has, on the rig’s own skeleton, additive only where the rig says it lays one over', () => {
    for (const [rig, r] of Object.entries(RIGS))
      for (const [site, game] of Object.entries(r.set)) {
        const e = ANIMS.find((a) => a.name === game);
        expect(e, `${rig} ${site} → ${game}`).toBeTruthy();
        expect(e.skeleton, `${rig} ${site}`).toBe(r.skeleton);
        expect(e.additive, `${rig} ${site}`).toBe((r.additive ?? []).includes(site));
      }
  });

  it('gives every rig an idle, a walk and a death', () => {
    for (const r of Object.values(RIGS)) for (const n of ['idle', 'walk', 'die']) expect(r.set[n]).toBeTruthy();
  });

  it('falls back within the rig, never to another’s', () => {
    expect(clipFor('atat', 'run')).toBe('C_ATAT_Stand_Walk_FWD');
    expect(clipFor('atst', 'die.cable')).toBe('A_ATST_Stand_Idle_Death_04');
    expect(clipFor('atat', 'fire.start')).toBeNull();
    expect(clipFor('atrt', 'sword.block')).toBe('C_ATRT_Stand_Idle_01');
    expect(clipFor('nothing', 'walk')).toBeNull();
  });

  it('brings a walker down by the cable’s fall when the cable tripped it, else its plain death', () => {
    expect(deathFor('atat', { cable: true })).toBe('die.cable');
    expect(deathFor('atat', {})).toBe('die');
    expect(deathFor('atat', { side: 'right' })).toBe('die.right');
    expect(deathFor('atst', { cable: true })).toBe('die');
    expect(deathFor('atte', { side: 'right' })).toBe('die');
  });
});
