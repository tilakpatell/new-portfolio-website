import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import CREDITS from '../../../data/modelCredits.json';
import { CAST } from './cast';
import { MODELS } from './catalog';
import { PROPS, THINGS } from './things';

const publicFile = (url) => fileURLToPath(new URL(`../../../../public${url}`, import.meta.url));

describe('Mario 64: the loaded models', () => {
  it('are each in the site, under a couple of MB between them', () => {
    let bytes = 0;
    for (const [kind, m] of Object.entries(MODELS)) {
      expect(existsSync(publicFile(m.file)), kind).toBe(true);
      bytes += statSync(publicFile(m.file)).size;
    }
    expect(bytes).toBeLessThan(2.5e6);
  });

  it('each stand in for something the code makes too, so a model that can’t load leaves its code-made one', () => {
    for (const [kind, m] of Object.entries(MODELS)) {
      if (m.role === 'mario') continue;
      const made = m.role === 'prop' ? PROPS[m.for] : (THINGS[m.for] ?? CAST[m.for]);
      expect(typeof made, kind).toBe('function');
    }
  });

  it('are each credited to who made it, under a licence the site can use', () => {
    for (const [kind, m] of Object.entries(MODELS)) {
      const c = CREDITS[`m64-${kind}`];
      expect(c, kind).toBeTruthy();
      expect(c.where).toBe('mario64');
      expect(c.file).toBe(m.file);
      expect(c.license).toMatch(/^CC-BY/);
      expect(c.source).toContain(m.uid);
    }
  });
});
