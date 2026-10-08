import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUTS, forgetUltra, gen3dFile, gen3dUrl, gen3dUrlChecked } from './gen3d';
import { budget } from '../budgets';

describe('which cut of a made model a level loads', () => {
  beforeEach(forgetUltra);

  it('follows the budget table’s cut for every level', () => {
    for (const level of ['low', 'mid', 'high', 'ultra']) expect(CUTS[level]).toBe(budget(level).cut);
  });

  it('names the files', () => {
    expect(gen3dFile('x-wing', 'low')).toBe('x-wing.lo.glb');
    expect(gen3dFile('x-wing', 'mid')).toBe('x-wing.glb');
    expect(gen3dFile('x-wing', 'high')).toBe('x-wing.hq.glb');
    expect(gen3dFile('x-wing', 'ultra')).toBe('x-wing.ultra.glb');
  });

  it('gives ultra the .hq cut until an ultra file is known to be there', () => {
    expect(gen3dUrl('x-wing', 'ultra')).toMatch(/models\/gen3d\/x-wing\.hq\.glb$/);
  });

  it('asks once whether the ultra file is there, and uses it when it is', async () => {
    const fetch = vi.fn(async () => ({ ok: true }));
    expect(await gen3dUrlChecked('x-wing', 'ultra', fetch)).toMatch(/x-wing\.ultra\.glb$/);
    expect(await gen3dUrlChecked('x-wing', 'ultra', fetch)).toMatch(/x-wing\.ultra\.glb$/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'HEAD' });
    expect(gen3dUrl('x-wing', 'ultra')).toMatch(/x-wing\.ultra\.glb$/);
  });

  it('falls back to .hq where there is no ultra file, and remembers it', async () => {
    const missing = vi.fn(async () => ({ ok: false, status: 404 }));
    expect(await gen3dUrlChecked('tie-fighter', 'ultra', missing)).toMatch(/tie-fighter\.hq\.glb$/);
    await gen3dUrlChecked('tie-fighter', 'ultra', missing);
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('counts only a missing file as missing: a failed ask is asked again next time', async () => {
    const flaky = vi.fn(async () => ({ ok: false, status: 503 }));
    expect(await gen3dUrlChecked('x-wing', 'ultra', flaky)).toMatch(/x-wing\.hq\.glb$/);
    const offline = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await gen3dUrlChecked('x-wing', 'ultra', offline)).toMatch(/x-wing\.hq\.glb$/);
    const up = vi.fn(async () => ({ ok: true }));
    expect(await gen3dUrlChecked('x-wing', 'ultra', up)).toMatch(/x-wing\.ultra\.glb$/);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('asks once for a name however many ask at the same time', async () => {
    let answer;
    const fetch = vi.fn(() => new Promise((r) => (answer = r)));
    const both = Promise.all([gen3dUrlChecked('x-wing', 'ultra', fetch), gen3dUrlChecked('x-wing', 'ultra', fetch)]);
    answer({ ok: true });
    expect(await both).toEqual([expect.stringMatching(/\.ultra\.glb$/), expect.stringMatching(/\.ultra\.glb$/)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('forgets an answer still on its way when told to forget', async () => {
    let answer;
    const fetch = vi.fn(() => new Promise((r) => (answer = r)));
    const p = gen3dUrlChecked('x-wing', 'ultra', fetch);
    forgetUltra();
    answer({ ok: true });
    await p;
    expect(gen3dUrl('x-wing', 'ultra')).toMatch(/x-wing\.hq\.glb$/);
  });

  it('asks nothing below ultra', async () => {
    const fetch = vi.fn();
    expect(await gen3dUrlChecked('x-wing', 'high', fetch)).toMatch(/x-wing\.hq\.glb$/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
