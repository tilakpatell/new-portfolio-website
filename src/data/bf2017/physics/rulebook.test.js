import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = dirname(fileURLToPath(import.meta.url));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// (scripts/lib/bf2017-physics-rules.mjs's checkSources, copied: src/data imports nothing from scripts)
function checkSources(json, path = '', hand = false) {
  const bad = [];
  if (!json || typeof json !== 'object') return bad;
  const isHand = hand || json.source === 'hand';
  for (const [k, v] of Object.entries(json)) {
    if (k.endsWith('_source')) continue;
    const here = path ? `${path}.${k}` : k;
    const numeric = finite(v) || (Array.isArray(v) && v.length && v.every(finite));
    if (numeric) {
      if (!isHand && !Array.isArray(json) && typeof json[`${k}_source`] !== 'string') bad.push(here);
    } else if (v && typeof v === 'object') bad.push(...checkSources(v, here, isHand));
  }
  return bad;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('the physics rulebooks', () => {
  it('has the soldier’s', () => {
    expect(files).toContain('soldier.json');
  });

  it.each(files)('%s gives every number its source, or says it is the site’s', (file) => {
    const json = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    expect(checkSources(json)).toEqual([]);
  });

  it('names the hand values in NOTES.md', () => {
    const notes = readFileSync(join(DIR, 'NOTES.md'), 'utf8');
    for (const file of files) {
      const text = readFileSync(join(DIR, file), 'utf8');
      if (text.includes('"source":"hand"') || text.includes('"source": "hand"')) expect(notes).toContain(file);
    }
  });

  it('the soldier’s default row is the 2017 soldier', () => {
    const book = JSON.parse(readFileSync(join(DIR, 'soldier.json'), 'utf8'));
    const row = book.rows[book.default];
    expect(Object.keys(book.rows)).toHaveLength(13);
    expect(row.radius).toBe(0.3);
    expect(row.poses.stand.height).toBe(1.7);
    expect(row.states.onGround.poses.stand.velocity).toBe(3.8);
  });
});
