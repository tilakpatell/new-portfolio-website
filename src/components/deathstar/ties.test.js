import { describe, expect, it } from 'vitest';
import { TRENCH, newRun, portZ, stepRun } from './trench';
import { CAMERA_BACK, JINK, createTieLife, jinkRoll, nearMiss, tieAim, vaderFlight } from './ties';

const ship = (o = {}) => ({ z: 50, px: 0, py: 1.9, ...o });

describe('a TIE fighter, drawn', () => {
  it('turns its window (and the guns under it) toward the X-wing as it closes, so far and no further', () => {
    const g = ship({ px: 0.8 });
    const ahead = tieAim({ x: 0, y: 1.9, z: g.z + 20 }, g);
    expect(ahead.yaw).toBeGreaterThan(0); // toward the ship's side
    expect(ahead.pitch).toBeCloseTo(0, 5);
    const close = tieAim({ x: -2, y: 2.4, z: g.z + 2 }, g);
    expect(Math.abs(close.yaw)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(close.pitch)).toBeLessThanOrEqual(0.5);
    // dead ahead and level: straight at it
    const level = tieAim({ x: 0, y: 1.9, z: g.z + 10 }, ship());
    expect(level.yaw).toBeCloseTo(0);
  });

  it('sees a laser go close by, but not one that hits or one far off', () => {
    const tie = { x: 0, y: 2, z: 80 };
    expect(nearMiss(tie, [{ x: 0.6, y: 2, z: 80.2, life: 0.5 }])).toBe(true);
    expect(nearMiss(tie, [{ x: 0.1, y: 2, z: 80.2, life: 0.5 }])).toBe(false); // (that one hits)
    expect(nearMiss(tie, [{ x: 0.6, y: 2, z: 70, life: 0.5 }])).toBe(false);
    expect(nearMiss(tie, [])).toBe(false);
  });

  it('jinks: a quick roll out and back, over in a moment', () => {
    expect(jinkRoll(-1)).toBe(0);
    expect(Math.abs(jinkRoll(JINK / 2))).toBeGreaterThan(0.8);
    expect(jinkRoll(JINK + 0.01)).toBe(0);
  });

  it('eases its turn and rolls away from a near miss, flashing its guns when it fires', () => {
    const life = createTieLife();
    const tie = { x: 0, y: 1.9, z: 80, phase: 0, fire: 1.5, alive: true };
    const g = ship({ px: 1 });
    let s = life.step(tie, g, [], 1 / 60);
    const first = s.yaw;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(tieAim(tie, g).yaw);
    for (let i = 0; i < 120; i++) s = life.step(tie, g, [], 1 / 60);
    expect(s.yaw).toBeCloseTo(tieAim(tie, g).yaw, 2);
    expect(s.flash).toBe(0);
    // a laser close by: a roll
    s = life.step(tie, g, [{ x: 0.6, y: 1.9, z: 80, life: 0.5 }], 1 / 60);
    let most = 0;
    for (let i = 0; i < 20; i++) most = Math.max(most, Math.abs(life.step(tie, g, [], 1 / 60).jink));
    expect(most).toBeGreaterThan(0.5);
    // it fires: its timer starts again from the top
    tie.fire = 0.01;
    life.step(tie, g, [], 1 / 60);
    tie.fire = 2.2;
    expect(life.step(tie, g, [], 1 / 60).flash).toBeGreaterThan(0);
  });
});

describe('Vader, seen', () => {
  const at = ship({ z: portZ() - 40, px: 0.1, py: 0.1 });
  const seen = (f) => f.vader.visible && f.vader.z - at.z > -CAMERA_BACK + 0.2;

  it('is nowhere before he joins', () => {
    const f = vaderFlight({ on: false, gone: false, away: 0, spin: 0 }, 0, at);
    expect(f.vader.visible).toBe(false);
    expect(f.wings.every((w) => !w.visible)).toBe(true);
  });

  it('swoops in over the X-wing with his two wingmen as he joins, then drops back onto your tail', () => {
    const v = { on: true, gone: false, away: 0, spin: 0 };
    expect(seen(vaderFlight(v, 0, at))).toBe(false); // (coming from behind)
    const mid = vaderFlight(v, 1.2, at);
    expect(seen(mid)).toBe(true);
    expect(mid.vader.y).toBeGreaterThan(at.py);
    expect(mid.wings.filter((w) => w.visible)).toHaveLength(2);
    // in a V: the wingmen either side of him, a little behind
    expect(Math.sign(mid.wings[0].x - mid.vader.x)).toBe(-Math.sign(mid.wings[1].x - mid.vader.x));
    expect(seen(vaderFlight(v, 6, at))).toBe(false); // (behind you, firing: the rear view shows him)
  });

  it('spins away up out of the trench when Han clears him, one wingman gone', () => {
    const v = { on: false, gone: true, away: 0.5, spin: 4 };
    const f = vaderFlight(v, 30, at);
    expect(seen(f)).toBe(true);
    expect(f.vader.y).toBeGreaterThan(at.py + 0.8);
    expect(f.vader.spin).toBe(4);
    expect(f.wings[0].visible).toBe(false);
    expect(vaderFlight({ ...v, away: 0 }, 30, at).vader.visible).toBe(false);
  });

  it('changes nothing in the run: the rules go the same way drawn or not', () => {
    const play = (draw) => {
      const g = newRun({ seed: 9 });
      const life = createTieLife();
      for (let i = 0; i < 60 * 20; i++) {
        g.keys = { fire: i % 3 === 0, left: i % 200 < 100 };
        stepRun(g, 1 / 60);
        if (draw) {
          for (const t of g.ties) if (t.alive) life.step(t, g, g.lasers, 1 / 60);
          vaderFlight(g.vader, g.t, g);
        }
      }
      return [g.score, g.shields, g.z, g.kills.tie, g.status];
    };
    expect(play(true)).toEqual(play(false));
    expect(TRENCH.vaderAt).toBeGreaterThan(TRENCH.hanAt);
  });
});
