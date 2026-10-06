import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS } from './fleet';
import { HUNTER_GLB, MODELS, STAND_IN, createModels } from './models';
import { SYSTEMS, kindsIn } from './systems';

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

  it('knows every kind a system flies: a model, or one built in code', () => {
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const s of SYSTEMS) for (const k of kindsIn(s)) expect(Boolean(MODELS[k]) || built.includes(k), `${s.id}: ${k}`).toBe(true);
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

    it('prebuilds the kinds it is given, a slice at a time, the ones that load as their stand-ins', async () => {
      const models = createModels();
      models.prebuild(['tie', 'destroyer', 'tie', 'venator', 'nowhere']); // (once each; a stand-in for the one with no built version, nothing for the one that doesn’t exist)
      expect(models.builtCount).toBe(0); // (not in this one)
      await new Promise((r) => setTimeout(r, 400));
      expect(models.builtCount).toBe(2); // (the venator’s stand-in is the destroyer, built already)
      const slot = models.slot('tie', 1);
      expect(slot.ready).toBe(true);
      models.dispose();
    });

    it('prebuilds nothing once disposed', async () => {
      const models = createModels();
      models.dispose();
      expect(() => models.prebuild(['tie'])).not.toThrow();
      await new Promise((r) => setTimeout(r, 40));
      expect(models.builtCount).toBe(0);
    });

    it('stops prebuilding when disposed part-way', async () => {
      const models = createModels();
      models.prebuild(['tie', 'destroyer', 'xwing', 'freighter']);
      models.dispose();
      await new Promise((r) => setTimeout(r, 400));
      expect(models.builtCount).toBe(0);
    });
  });
});
