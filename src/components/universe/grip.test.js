import { expect, it } from 'vitest';

it('the old path re-exports the library’s grip, the same functions', async () => {
  expect(await import('./grip')).toEqual(await import('../../lib/three/grip'));
});
