import { describe, expect, it } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import m64 from './module';

describe('Mario 64, the world module', () => {
  it('is a world module, and says what it downloads as the worlds list does', () => {
    expect(m64).toMatchObject({ id: 'mario64', shading: 'glsl', mb: WORLD_MB['/dot-matrix/64'] });
    expect(typeof m64.create).toBe('function');
  });
});
