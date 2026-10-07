// Which pull requests the render tier runs on: one that touches a model or
// the code that draws one. The rest don't pay for a browser.
import { describe, expect, it } from 'vitest';
import { touches } from './changed.mjs';

describe('a pull request the render tier runs on', () => {
  it('touches a model or the 3D library', () => {
    expect(touches(['public/models/gen3d/x-wing.glb'])).toBe(true);
    expect(touches(['README.md', 'src/lib/three/gen3d.js'])).toBe(true);
    expect(touches(['scripts/glb-shot.mjs'])).toBe(true);
    expect(touches(['scripts/preview/glb-shot.html'])).toBe(true);
    expect(touches(['scripts/ai-e2e/render/coverage.mjs'])).toBe(true);
  });
  it('is not one that only changes pages, words or other scripts', () => {
    expect(touches(['src/pages/Home.jsx', 'docs/architecture.md', 'scripts/voices/generate.py'])).toBe(false);
    expect(touches([])).toBe(false);
  });
});
