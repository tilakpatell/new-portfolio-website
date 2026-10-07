import { describe, expect, it } from 'vitest';
import { MODELS, boxFaces, uvFor } from './shapes';

const FRONT = 4;
const head = MODELS.player.parts.find((p) => p.name === 'head').boxes[0];

describe('the mobs’ box models', () => {
  it('the player’s head front face maps to (8,8)-(16,16) of 64 × 64', () => {
    const uv = uvFor(head, MODELS.player.texture).slice(FRONT * 8, FRONT * 8 + 8);
    const us = [uv[0], uv[2], uv[4], uv[6]].map((u) => u * 64);
    const vs = [uv[1], uv[3], uv[5], uv[7]].map((v) => v * 64);
    expect([Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]).toEqual([8, 16, 8, 16]);
  });

  it('the front face looks along −z, its texture’s left on the mob’s right (−x)', () => {
    const front = boxFaces(head)[FRONT];
    expect(front.every(({ p }) => p[2] === -4)).toBe(true);
    // the texel column 8 (the picture's left edge) sits at x −4, the mob's right
    expect(front.filter(({ uv }) => uv[0] === 8).every(({ p }) => p[0] === -4)).toBe(true);
  });

  it('a mirrored part reverses u', () => {
    const b = { tex: [40, 16], at: [-1, -2, -2], size: [4, 12, 4] };
    const plain = boxFaces(b)[FRONT];
    const mirrored = boxFaces({ ...b, mirror: true })[FRONT];
    const uAt = (face, x, y) => face.find(({ p }) => p[0] === x && p[1] === y).uv[0];
    expect(uAt(plain, -1, -2)).toBe(44);
    expect(uAt(mirrored, -1, -2)).toBe(48);
    expect(uAt(plain, 3, -2)).toBe(48);
    expect(uAt(mirrored, 3, -2)).toBe(44);
  });

  it('every part’s net fits inside its texture', () => {
    for (const [kind, m] of Object.entries(MODELS))
      for (const part of m.parts)
        for (const b of part.boxes) {
          const [u, v] = b.tex;
          const [w, h, d] = b.size;
          expect(u + 2 * d + 2 * w, `${kind} ${part.name}`).toBeLessThanOrEqual(m.texture[0]);
          expect(v + d + h, `${kind} ${part.name}`).toBeLessThanOrEqual(m.texture[1]);
        }
  });

  it('stands on the ground: every mob’s lowest point is at y 24 (a pixel’s give)', () => {
    for (const [kind, m] of Object.entries(MODELS)) {
      if (kind === 'sheep_wool' || kind === 'spider') continue; // (the fleece rides the sheep; the spider stands on its splayed legs)
      let low = -Infinity;
      for (const part of m.parts) {
        if (part.rot) continue; // (turned parts lie along z: their boxes' y isn't their height)
        for (const b of part.boxes) low = Math.max(low, part.pivot[1] + b.at[1] + b.size[1]);
      }
      expect(Math.abs(low - 24), kind).toBeLessThanOrEqual(1);
    }
  });
});
