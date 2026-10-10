import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREW, filesOf } from './crewList';
import { SURFACE_MODELS, modelUrlFor } from './catalog';

const onDisk = (url) => existsSync(new URL(`../../../../public${url}`, import.meta.url));

describe('the kinds the worlds built in code, as models', () => {
  it('the astromechs are R2’s model, gliding', () => {
    expect(SURFACE_MODELS.droid).toMatchObject({ machine: true, uid: SURFACE_MODELS.r2d2.uid });
    expect(onDisk(modelUrlFor('droid', 'high'))).toBe(true);
  });
  it('the Hutts’ men take Jabba’s court’s faces in turn, every file there', () => {
    expect(filesOf(CREW.mercenary)).toHaveLength(5);
    for (const f of filesOf(CREW.mercenary)) expect(onDisk(f), f).toBe(true);
  });
  it('every crew file is on disk', () => {
    for (const [k, c] of Object.entries(CREW)) for (const f of filesOf(c)) expect(onDisk(f), `${k}: ${f}`).toBe(true);
  });
});
