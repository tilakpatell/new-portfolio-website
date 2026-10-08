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
});
