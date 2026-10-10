import { describe, expect, it, vi } from 'vitest';
import { createProbeEnv } from './probeEnv';

function fakes() {
  const made = [];
  const cube = () => ({ dispose: vi.fn() });
  const pmrem = { fromCubemap: vi.fn(() => { const t = { dispose: vi.fn() }; made.push(t); return { texture: t }; }), dispose: vi.fn() };
  let release = [];
  const load = vi.fn(() => new Promise((res) => release.push(() => res(cube()))));
  const go = () => { const r = release; release = []; r.forEach((f) => f()); };
  return { made, pmrem, load, go };
}

describe('the probe as the environment', () => {
  it('gives an environment and disposes the last on the next', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']); f.go(); const envA = await a;
    expect(envA).toBe(f.made[0]);
    const b = probes.load(['b']); f.go(); const envB = await b;
    expect(envB).toBe(f.made[1]);
    expect(f.made[0].dispose).toHaveBeenCalledTimes(1);
    expect(f.made[1].dispose).not.toHaveBeenCalled();
    probes.dispose();
    expect(f.made[1].dispose).toHaveBeenCalledTimes(1);
    expect(f.pmrem.dispose).toHaveBeenCalledTimes(1);
  });

  it('never keeps two alive when loads cross', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']);
    const b = probes.load(['b']);
    f.go();
    expect(await a).toBeNull();
    expect(await b).toBe(f.made[1]);
    expect(f.made[0].dispose).toHaveBeenCalledTimes(1);
    expect(probes.current()).toBe(f.made[1]);
  });

  it('reuses the one it has for the same probe', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']); f.go(); await a;
    expect(await probes.load(['a'])).toBe(f.made[0]);
    expect(f.load).toHaveBeenCalledTimes(1);
  });
});
