import { describe, expect, it } from 'vitest';
import { EXPECTED, audit, drawnAs, slipped, table } from './galaxy-figures-audit.mjs';

const tables = {
  WALKERS: { atrt: {} },
  CREW: { atrt: { name: 'atrt' }, luke: { url: '/l.glb' }, hutt: { name: 'jabba', still: true }, vader: { url: '/v.glb', rig: 'walrus' }, battledroid: { url: '/b.glb', rig: 'own', ownRig: 'b1' } },
  SURFACE_MODELS: {
    atat: { anim: { walk: 'Walk' } },
    ewok: { legs: { crotch: 0.33 } },
    ithorian: { rig: true },
    yoda: {},
    luke: {},
    villager: { legs: { crotch: 0.4 }, anim: { idle: 'idle' } },
  },
  FIGURES: ['villager', 'farmer', 'yoda'],
};

describe('drawnAs', () => {
  it('resolves as figureFor does: walker, crew, model, built', () => {
    expect(drawnAs('atrt', tables)).toBe('walker');
    expect(drawnAs('luke', tables)).toBe('crew');
    expect(drawnAs('hutt', tables)).toBe('crew-still');
    expect(drawnAs('atat', tables)).toBe('own-clips');
    expect(drawnAs('ewok', tables)).toBe('legs');
    expect(drawnAs('ithorian', tables)).toBe('rig-noanim');
    expect(drawnAs('yoda', tables)).toBe('still');
    expect(drawnAs('villager', tables)).toBe('own-clips');
    expect(drawnAs('farmer', tables)).toBe('built');
    // (a 2017 figure: on the game's humanoid skeleton, or on one of its own)
    expect(drawnAs('vader', tables)).toBe('walrus');
    expect(drawnAs('battledroid', tables)).toBe('own-rig');
    expect(drawnAs('shaak', tables)).toBe('none');
  });
});

describe('audit', () => {
  const SITES = {
    hoth: { life: [{ kind: 'yoda' }, { kind: 'luke', n: 2 }], zones: [{ life: [{ kind: 'farmer' }] }] },
    endor: { life: [{ kind: 'ewok' }, { kind: 'luke' }] },
  };
  it('lists each kind once, sorted, with the worlds it is on', () => {
    expect(audit(SITES, tables)).toEqual([
      { kind: 'ewok', how: 'legs', worlds: ['endor'] },
      { kind: 'farmer', how: 'built', worlds: ['hoth'] },
      { kind: 'luke', how: 'crew', worlds: ['endor', 'hoth'] },
      { kind: 'yoda', how: 'still', worlds: ['hoth'] },
    ]);
  });
  it('makes a Markdown table with the counts', () => {
    const md = table(audit(SITES, tables));
    expect(md).toMatch(/\| legs \| 1 \| ewok \|/);
    expect(md).toMatch(/\| ewok \| legs \| endor \|/);
  });
  it('names the kinds that slipped from where a phase moved them', () => {
    const rows = audit(SITES, tables);
    expect(slipped(rows, { ewok: 'legs', yoda: 'legs' })).toEqual([{ kind: 'yoda', want: 'legs', how: 'still' }]);
    expect(typeof EXPECTED).toBe('object');
  });
});
