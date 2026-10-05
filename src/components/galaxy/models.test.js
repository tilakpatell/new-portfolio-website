import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HUNTER_GLB, MODELS } from './models';

const at = (path) => new URL(`../../../public${path}`, import.meta.url);

describe('the galaxy’s models', () => {
  it('are each in the site', () => {
    for (const [kind, m] of Object.entries({ ...MODELS, ...HUNTER_GLB })) expect(existsSync(at(m.url)), `${kind}: ${m.url}`).toBe(true);
  });
});
