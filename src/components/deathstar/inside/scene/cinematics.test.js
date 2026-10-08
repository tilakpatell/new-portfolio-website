// The stories' scenes: every scene the stories play has shots framed on
// places the stations have, and the shot maths puts the camera where a
// shot says.
import { describe, expect, it } from 'vitest';
import { SCENE_SECONDS } from '../rules/play/plot';
import { STATIONS } from '../rules/stations';
import { SCENES, ease, offsetIn, shotAt, swingAt } from './cinematics';

const spots = { ...STATIONS.ds1.spots, ...STATIONS.ds2.spots };

describe('the scenes', () => {
  it('has shots for every scene the stories play, lasting as long as the scene does', () => {
    for (const [id, seconds] of Object.entries(SCENE_SECONDS)) {
      expect(SCENES[id], id).toBeDefined();
      const total = SCENES[id].shots.reduce((s, x) => s + x.s, 0);
      expect(total, id).toBeCloseTo(seconds, 5);
    }
  });

  it('frames every shot on a spot the stations have, someone tagged, or you', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
      for (const shot of scene.shots) {
        for (const place of [shot.at, shot.look].filter(Boolean)) {
          if (place.spot) expect(spots[place.spot], `${id}: ${place.spot}`).toBeDefined();
          else expect(Boolean(place.tag || place.you), id).toBe(true);
        }
        expect(shot.from).toHaveLength(3);
        expect(shot.to).toHaveLength(3);
      }
    }
  });
});

describe('the shot maths', () => {
  it('puts back behind a place facing −z at +z, and right at +x', () => {
    expect(offsetIn({ x: 0, y: 0, z: 0, yaw: 0 }, [0, 1, 2])).toEqual({ x: 0, y: 1, z: 2 });
    expect(offsetIn({ x: 0, y: 0, z: 0, yaw: 0 }, [3, 0, 0])).toMatchObject({ x: 3, z: 0 });
    // facing +x (yaw π/2), behind is −x
    const p = offsetIn({ x: 0, y: 0, z: 0, yaw: Math.PI / 2 }, [0, 0, 2]);
    expect(p.x).toBeCloseTo(-2);
    expect(p.z).toBeCloseTo(0);
  });

  it('finds the shot a time falls in, and how far through it', () => {
    const scene = { shots: [{ s: 2 }, { s: 3 }] };
    expect(shotAt(scene, 1)).toMatchObject({ shot: scene.shots[0], k: 0.5 });
    expect(shotAt(scene, 3.5)).toMatchObject({ shot: scene.shots[1], k: 0.5 });
    expect(shotAt(scene, 9)).toMatchObject({ shot: scene.shots[1], k: 1 });
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
  });

  it('swings out from the ledge, dips the sag at the bottom, and lands on the far side', () => {
    const w = { t0: 1, s: 2, sag: 2.4, from: { x: 0, y: 3, z: 0 }, to: { x: 14, y: 3, z: 0 } };
    expect(swingAt(w, 0)).toEqual({ x: 0, y: 3, z: 0 });
    expect(swingAt(w, 2).x).toBeCloseTo(7);
    expect(swingAt(w, 2).y).toBeCloseTo(3 - 2.4);
    expect(swingAt(w, 9).x).toBeCloseTo(14);
    expect(swingAt(w, 9).y).toBeCloseTo(3);
    // (fastest across at the bottom of the dip)
    expect(swingAt(w, 2.1).x - swingAt(w, 1.9).x).toBeGreaterThan(swingAt(w, 1.2).x - swingAt(w, 1).x);
  });
});
