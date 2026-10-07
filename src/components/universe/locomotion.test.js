import { describe, expect, it } from 'vitest';
import * as here from './locomotion';
import * as lib from '../../lib/three/locomotion';

// (the locomotion itself is tested in lib/three/locomotion.test.js)
describe('locomotion, where it was', () => {
  it('is lib/three’s, every name footScene imports', () => {
    for (const n of ['strideOf', 'createLocomotion', 'fallTurn', 'strideCache']) expect(here[n], n).toBe(lib[n]);
  });
});
