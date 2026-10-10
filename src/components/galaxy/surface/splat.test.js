import { describe, expect, it } from 'vitest';
import { SPLAT, splatOf } from './splat';
import { siteOf } from './sites';
import { coreOf } from '../../../lib/three/core';

describe("the layered ground's scans", () => {
  it("gives Tatooine's sand a patch scan, rock on its slopes and gravel scattered over it", () => {
    const s = splatOf(siteOf('tatooine'));
    expect(s.base).toBe('sand');
    expect(s.steep).toBe('rock');
    expect(s.macro).toBeTruthy();
    expect(s.decal).toBeTruthy();
  });

  it("has a scan that's there for every layer of every role it knows", () => {
    for (const [base, layers] of Object.entries(SPLAT)) {
      expect(coreOf(base)).toBeTruthy();
      // (each layer has a scan that's made today, whatever's still to be made)
      for (const [layer, roles] of Object.entries(layers)) expect(roles.some(coreOf), `${base}: ${layer}`).toBe(true);
    }
  });

  it('drops a layer whose scan is missing, and keeps the rest', () => {
    const s = splatOf({ ground: { detail: 'sand' } }, (role) => (role === 'rock' || role === 'aerialrock' ? null : coreOf(role)));
    expect(s.steep).toBeNull();
    expect(s.base).toBe('sand');
    expect(s.macro).toBeTruthy();
  });

  it('wears the first of a list that has been made', () => {
    const has = (role) => (role === 'dryground' ? null : coreOf(role));
    expect(splatOf({ ground: { detail: 'sand' } }, has).macro).toBe('redsoil');
    expect(splatOf({ ground: { detail: 'sand' } }, (r) => (r === 'dryground' ? { metres: 2 } : coreOf(r))).macro).toBe('dryground');
  });

  it('takes a site’s own layers over its biome’s', () => {
    expect(splatOf({ ground: { detail: 'sand', splat: { steep: 'redrock' } } }).steep).toBe('redrock');
  });

  it('has nothing for a ground with no scan', () => {
    expect(splatOf({ ground: {} })).toBeNull();
    expect(splatOf({ ground: { detail: 'sand' } }, () => null)).toBeNull();
  });
});
