import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../chapters';
import { firstStep, nextUnfinished } from './hubState';

describe('the first step the hub offers', () => {
  it('begins at the Shire with nothing won', () => {
    expect(firstStep([])).toEqual({ kind: 'begin', id: 'shire', label: 'Begin at the Shire' });
    expect(firstStep()).toEqual({ kind: 'begin', id: 'shire', label: 'Begin at the Shire' });
    expect(nextUnfinished([])).toBe('shire');
  });
  it('carries on at the first chapter not won, even when a later one has seals', () => {
    expect(firstStep(['eagles'])).toEqual({ kind: 'carry', id: 'shire', label: 'Carry on · The Shire' });
    expect(nextUnfinished(['eagles'])).toBe('shire');
  });
  it('carries on to Bree once the Shire is won', () => {
    expect(firstStep(CHAPTERS[0].seals)).toEqual({ kind: 'carry', id: 'bree', label: 'Carry on · Bree' });
    expect(nextUnfinished(CHAPTERS[0].seals)).toBe('bree');
  });
  it('offers the road again once every chapter is won', () => {
    const all = CHAPTERS.flatMap((c) => c.seals);
    expect(firstStep(all)).toEqual({ kind: 'again', id: 'shire', label: 'The road again' });
    expect(nextUnfinished(all)).toBe(null);
  });
});
