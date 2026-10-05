import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS } from './fleet';
import { HUNTER_GLB, MODELS, STAND_IN, createModels } from './models';

const at = (path) => new URL(`../../../public${path}`, import.meta.url);

describe('the galaxy’s models', () => {
  it('are each in the site', () => {
    for (const [kind, m] of Object.entries({ ...MODELS, ...HUNTER_GLB })) expect(existsSync(at(m.url)), `${kind}: ${m.url}`).toBe(true);
  });

  it('gives every loaded kind with no built version a stand-in that is built', () => {
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const k of Object.keys(MODELS)) {
      if (built.includes(k) || k === 'deathstar') continue; // (the Death Star has its own sphere in the world)
      expect(built, `${k} → ${STAND_IN[k]}`).toContain(STAND_IN[k]);
    }
  });

  describe('building a stand-in', () => {
    // (the ships' lights and panels are drawn on canvases; there isn't one here, so a canvas that takes any drawing)
    beforeEach(() => {
      const ctx = new Proxy(function draw() {}, { get: (_, k) => (k === 'canvas' ? null : ctx), set: () => true, apply: () => ctx });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('shows a stand-in in the slot of a kind that has no built version, until it loads', () => {
      const models = createModels();
      for (const k of Object.keys(STAND_IN)) {
        const slot = models.slot(k, 10);
        expect(slot.ready, k).toBe(true);
        expect(slot.model, k).toBeTruthy();
        expect(slot.real, k).toBe(false); // (so the model that loads swaps in)
      }
      models.dispose();
    });
  });
});
