import { describe, expect, it } from 'vitest';
import * as here from './clips';
import * as lib from '../../../lib/three/clipLibrary';

// (the clips themselves are tested in lib/three/clipLibrary.test.js)
describe('Rick’s clips, where they were', () => {
  it('are the clip library’s, every name the callers import', () => {
    for (const n of ['RICK_HIPS', 'borrowClips', 'retarget', 'faceAhead', 'faceForward', 'heading', 'CLIPS', 'loadClip', 'forFigure', 'preload']) expect(here[n], n).toBe(lib[n]);
    expect(here.RICK_HIPS).toBe(90.233);
  });
});
