import { describe, expect, it } from 'vitest';
import * as here from './clips';
import * as library from '../../../lib/three/clips';

// Rick’s clips live in the library now (src/lib/three/clips.js, tested
// there); this path stays so the portal’s cast and the worlds that borrow
// from it load what they always did.
describe('the portal’s clips', () => {
  it('are the library’s own, so every world shares one fetch of each', () => {
    const names = ['RICK_HIPS', 'borrowClips', 'retarget', 'heading', 'faceForward', 'faceAhead'];
    for (const n of names) expect(here[n], n).toBe(library[n]);
    expect(Object.keys(here).sort()).toEqual(Object.keys(library).sort());
  });
});
