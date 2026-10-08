import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SURFACE_MODELS } from '../../galaxy/surface/catalog';
import { MESHY, RIGGED } from '../portal/meshyCast';
import { RM_MODELS } from './catalog';

const publicFile = (url) => new URL(`../../../../public${url}`, import.meta.url);

describe('the planets’ models', () => {
  it('are every one a file the site already has', () => {
    expect(Object.keys(RM_MODELS).length).toBeGreaterThan(20);
    for (const [kind, m] of Object.entries(RM_MODELS)) {
      expect(m.url, kind).toMatch(/^\/(models\/c137\/rm|games\/meshy)\/.+\.glb$/);
      expect(existsSync(publicFile(m.url)), `${kind}: ${m.url}`).toBe(true);
    }
  });

  it('each have one size to be brought to, in metres', () => {
    for (const [kind, m] of Object.entries(RM_MODELS)) {
      const sizes = ['tall', 'wide', 'long'].filter((s) => m[s] != null);
      expect(sizes, kind).toHaveLength(1);
      expect(m[sizes[0]], kind).toBeGreaterThan(0);
    }
  });

  it('are rigged only where the Meshy cast has the figure rigged, and as tall as it stands', () => {
    const rigged = Object.entries(RM_MODELS).filter(([, m]) => m.rigged);
    expect(rigged.map(([k]) => k)).toEqual(expect.arrayContaining(['gazorpian', 'marsha', 'mortyjr', 'squanchy', 'birdperson', 'gearhead', 'arthricia']));
    for (const [kind, m] of rigged) {
      expect(RIGGED.has(kind), kind).toBe(true);
      expect(MESHY[kind]?.a, kind).toBe(kind);
      expect(m.url, kind).toBe(`/games/meshy/${kind}.glb`);
      expect(m.tall, kind).toBe(MESHY[kind].h);
    }
  });

  it('never takes a galaxy kind’s name', () => {
    for (const kind of Object.keys(RM_MODELS)) expect(SURFACE_MODELS[kind], kind).toBeUndefined();
  });
});
