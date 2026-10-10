import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLOW, MARK, createBoltDraw, fitPx, glowAt, luminance } from './battleFx';
import { WARS } from './wars';

describe('the bolts', () => {
  it('are drawn on along their way by the time the battle’s step still owes', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 4 });
    const bolt = { on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0 };
    const at = () => {
      const mesh = parent.children.find((o) => o.isInstancedMesh);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    draw.sync([bolt], () => [1, 1, 1]);
    const still = at();
    draw.sync([bolt], () => [1, 1, 1], null, 0.01);
    expect(at() - still).toBeCloseTo(0.6, 6);
    draw.dispose();
  });
});

describe('the objective markers', () => {
  it('shrink a name to fit the card, never past the smallest that reads', () => {
    expect(fitPx(200, 244)).toBe(20); // (fits as it is)
    expect(fitPx(300, 244)).toBe(16); // ('Destroy: Shield generator' at 20px is about 300 wide)
    expect(fitPx(1000, 244)).toBe(12);
  });

  it('are wide enough for the longest name at its full size', () => {
    // (a monospace 20px is about 12px a letter)
    expect(MARK.w - 2 * MARK.pad).toBeGreaterThanOrEqual('Destroy: Shield generator'.length * 12);
  });
});

describe('the light of a shot', () => {
  it('keeps a colour’s hue and sets how bright it reads', () => {
    const red = glowAt([5.8, 0.75, 0.55], 3);
    expect(luminance(red)).toBeCloseTo(3, 6);
    expect(red[1] / red[0]).toBeCloseTo(0.75 / 5.8, 6);
    expect(red[2] / red[0]).toBeCloseTo(0.55 / 5.8, 6);
    expect(glowAt([0, 0, 0], 3)).toEqual([0, 0, 0]);
  });

  it('is as bright on every side, so neither side’s fire floods the glow', () => {
    // (the universe map's wars, and the galaxy's own: the Republic's, the Separatists' and the Hutts')
    const sides = [...Object.values(WARS).flatMap((w) => w.sides ?? []), { laser: [5.8, 0.75, 0.55], turbo: [0.6, 2.2, 6.5] }, { laser: [6.0, 2.5, 0.5], turbo: [0.6, 5.5, 1.2] }, { laser: [6.0, 3.0, 0.6], turbo: [6.5, 3.4, 0.8] }];
    expect(sides.length).toBeGreaterThan(6);
    for (const side of sides) {
      if (side.laser) expect(luminance(glowAt(side.laser, GLOW.laser))).toBeCloseTo(GLOW.laser, 5);
      if (side.turbo) expect(luminance(glowAt(side.turbo, GLOW.turbo))).toBeCloseTo(GLOW.turbo, 5);
    }
  });
});
