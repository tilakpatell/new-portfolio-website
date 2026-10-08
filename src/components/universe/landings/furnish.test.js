import { describe, expect, it } from 'vitest';
import { within } from './furnish';

describe('within', () => {
  it("is what the promise gives, when it's in time", async () => {
    await expect(within(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('gives up waiting after so long, and resolves all the same', async () => {
    const never = new Promise(() => {});
    const t0 = Date.now();
    await expect(within(never, 30)).resolves.toBeUndefined();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it("never rejects: a promise that fails is waited for as one that's in", async () => {
    await expect(within(Promise.reject(new Error('no scans')), 50)).resolves.toBeUndefined();
  });
});
