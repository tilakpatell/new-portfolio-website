import { afterEach, describe, expect, it, vi } from 'vitest';

// (its own file: the engine's import is cached for the module's life)
describe('createPhysics, when the engine will not load', () => {
  afterEach(() => {
    vi.doUnmock('@dimforge/rapier3d-compat');
    vi.resetModules();
  });

  it('fails, then loads it on the next try', async () => {
    vi.resetModules();
    vi.doMock('@dimforge/rapier3d-compat', () => {
      throw new Error('offline');
    });
    const { createPhysics } = await import('./world');
    await expect(createPhysics()).rejects.toThrow();
    vi.doUnmock('@dimforge/rapier3d-compat');
    const p = await createPhysics();
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
  });

  it('R18 a failed engine load is retried', async () => {
    vi.resetModules();
    let calls = 0;
    vi.doMock('@dimforge/rapier3d-compat', async (orig) => {
      const real = await orig();
      const R = real.default ?? real;
      return { default: { ...R, init: async () => { if (calls++ === 0) throw new Error('offline'); return R.init(); } } };
    });
    const { createPhysics: fresh } = await import('./world');
    await expect(fresh()).rejects.toThrow('offline');
    const p = await fresh();
    expect(p.world).toBeTruthy();
    p.dispose();
    vi.doUnmock('@dimforge/rapier3d-compat');
  });
});
