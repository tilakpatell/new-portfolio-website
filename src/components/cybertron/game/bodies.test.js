import { describe, expect, it } from 'vitest';
import { GESTURES, GREET, aimAt, createFoeBody, createGait, createHips, createPersonBody, fallTime, footPath, gesture, hashSeed, lineLength, localMotion, standPose, stridePose, strideLength, topple, wingBeat } from './bodies';

const TAU = Math.PI * 2;

describe('a robot’s stride', () => {
  it('is longer the further the legs swing, and longest at a run', () => {
    expect(strideLength(4, 0, 1)).toBeCloseTo(16 * Math.sin(0.42), 6);
    expect(strideLength(4, 1, 1)).toBeGreaterThan(strideLength(4, 0, 1) * 1.7);
    expect(strideLength(4, 0, 0.5)).toBeLessThan(strideLength(4, 0, 1));
    // (never so short its pace runs away)
    expect(strideLength(4, 0, 0)).toBeGreaterThan(1.8);
  });

  it('turns over once for every stride of ground, whatever the pace', () => {
    const leg = 4.2;
    const g = createGait({ leg, height: 9.5, seed: 3 });
    for (let i = 0; i < 200; i++) g.step(1 / 60, 7); // (settled at a walk)
    let last = g.step(1 / 60, 7);
    let turned = 0;
    for (let i = 0; i < 120; i++) {
      const s = g.step(1 / 60, 7);
      turned += (((s.phase - last.phase) % TAU) + TAU) % TAU;
      last = s;
    }
    expect(turned / TAU).toBeCloseTo((7 * 2) / last.stride, 2);
  });

  it('walks backward with the phase going back, and stands still when stopped', () => {
    const g = createGait({ leg: 4, height: 9.5 });
    let s = g.step(1 / 60, 0);
    const start = s.phase;
    for (let i = 0; i < 3; i++) s = g.step(1 / 60, -5);
    const back = (((start - s.phase) % TAU) + TAU) % TAU;
    expect(back).toBeGreaterThan(0.1);
    expect(back).toBeLessThan(Math.PI);
    for (let i = 0; i < 60; i++) s = g.step(1 / 60, 0);
    const held = s.phase;
    expect(s.amount).toBe(0);
    expect(g.step(1 / 60, 0).phase).toBe(held);
  });

  it('eases into a run between its walk and its run pace, never at once', () => {
    const g = createGait({ leg: 4, height: 9.5 });
    let s = g.step(1 / 60, 15);
    expect(s.run).toBeLessThan(0.1);
    for (let i = 0; i < 60; i++) s = g.step(1 / 60, 16);
    expect(s.run).toBeCloseTo(1, 6);
    for (let i = 0; i < 60; i++) s = g.step(1 / 60, 7);
    expect(s.run).toBe(0);
  });

  it('starts each figure somewhere of its own in its stride', () => {
    const phases = [1, 2, 3, 4, 5].map((seed) => createGait({ seed }).step(0, 0).phase);
    expect(new Set(phases.map((p) => p.toFixed(3))).size).toBe(5);
  });
});

describe('a foot’s path', () => {
  it('goes back at an even pace while it’s down, and comes up and through in between', () => {
    const at = (u) => footPath(u * TAU);
    expect(at(0.25).reach).toBeCloseTo(1, 6);
    expect(at(0.75).reach).toBeCloseTo(-1, 6);
    expect(at(0.5).down).toBe(true);
    expect(at(0.5).reach).toBeCloseTo(0, 6);
    expect(at(0).down).toBe(false);
    expect(at(0).lift).toBeCloseTo(1, 6);
    // the same either side of a footfall and a toe-off
    expect(at(0.2499).reach).toBeCloseTo(at(0.2501).reach, 2);
    expect(at(0.7499).reach).toBeCloseTo(at(0.7501).reach, 2);
    const rate = (u) => (at(u + 0.001).reach - at(u).reach) / 0.001;
    expect(rate(0.3)).toBeCloseTo(-4, 3);
    expect(rate(0.6)).toBeCloseTo(-4, 3);
  });

  it('keeps a planted foot still on the ground as the body goes over it', () => {
    // a figure walking at 7 m/s on its gait: the foot that's down, where it
    // is in the world, from where the hips are and where its thigh points
    const leg = 4.2;
    const g = createGait({ leg, height: 9.5, seed: 1 });
    for (let i = 0; i < 300; i++) g.step(1 / 60, 7);
    let x = 0;
    let worst = 0;
    let prev = null;
    for (let i = 0; i < 240; i++) {
      const s = g.step(1 / 60, 7);
      x += 7 / 60;
      const pose = stridePose(s.phase, s.amount, s.run);
      const down = footPath(s.phase).down;
      const foot = x + leg * pose.thighL[2] / Math.hypot(pose.thighL[1], pose.thighL[2]);
      if (down && prev?.down) worst = Math.max(worst, Math.abs(foot - prev.foot) * 60);
      prev = { down, foot };
    }
    // (well under the site's bar of 0.15 m/s, against 7 m/s of travel)
    expect(worst).toBeLessThan(0.15);
  });

  it('breathes standing, each figure on its own breath', () => {
    const a = standPose(1, 1);
    const b = standPose(1, 2);
    expect(a.torso.pitch).not.toBeCloseTo(b.torso.pitch, 5);
    expect(standPose(0, 1, 0).torso.pitch).toBeCloseTo(0, 9);
  });
});

describe('turning to where it goes', () => {
  it('turns the legs to a strafe, and walks backward away from what it faces', () => {
    const h = createHips();
    let s;
    for (let i = 0; i < 120; i++) s = h.step(1 / 60, 0, 4); // (4 m/s to its right)
    expect(s.yaw).toBeLessThan(-1.4);
    expect(s.dir).toBe(1);
    expect(s.ground).toBeGreaterThan(3.9);
    for (let i = 0; i < 120; i++) s = h.step(1 / 60, -4, 0);
    expect(s.dir).toBe(-1);
    expect(Math.abs(s.yaw)).toBeLessThan(0.05);
    for (let i = 0; i < 120; i++) s = h.step(1 / 60, 0, 0);
    expect(s.dir).toBe(1);
    expect(Math.abs(s.yaw)).toBeLessThan(0.01);
  });

  it('reads a velocity in the figure’s own frame', () => {
    expect(localMotion(0, 5, 0)).toEqual({ speed: 5, side: 0 });
    const r = localMotion(-5, 0, 0); // (−x is its right, facing +z)
    expect(r.speed).toBeCloseTo(0, 9);
    expect(r.side).toBeCloseTo(5, 9);
  });

  it('aims ahead, up and to the left in its own frame, and never behind it', () => {
    const a = aimAt({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 10 });
    expect(a[2]).toBeCloseTo(1, 6);
    const left = aimAt({ x: 0, y: 0, z: 0 }, 0, { x: 10, y: 10, z: 10 });
    expect(left[0]).toBeGreaterThan(0.4);
    expect(left[1]).toBeGreaterThan(0.4);
    const behind = aimAt({ x: 0, y: 0, z: 0 }, 0, { x: 0.1, y: 0, z: -10 });
    expect(behind[2]).toBeGreaterThan(0.3);
  });
});

describe('going over', () => {
  it('tips slowly, then all at once, lands and settles flat', () => {
    const dur = fallTime(7);
    expect(dur).toBeGreaterThan(0.9);
    expect(fallTime(10.5)).toBeGreaterThan(dur);
    expect(topple(0, dur)).toBe(0);
    let last = 0;
    for (let t = 0.05; t < dur; t += 0.05) {
      const a = topple(t, dur);
      expect(a).toBeGreaterThan(last);
      last = a;
    }
    expect(topple(dur * 0.5, dur)).toBeLessThan(Math.PI / 6);
    expect(topple(dur + 3, dur)).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('a big flyer’s wings', () => {
  it('beat for a while and glide for a while', () => {
    let beating = 0;
    let gliding = 0;
    for (let t = 0; t < 60; t += 0.1) {
      const w = wingBeat(t, { seed: 4 });
      expect(Math.abs(w.flap)).toBeLessThanOrEqual(1);
      if (w.env > 0.9) beating++;
      if (w.env < 0.1) gliding++;
    }
    expect(beating).toBeGreaterThan(60);
    expect(gliding).toBeGreaterThan(30);
  });
});

describe('gestures', () => {
  it('has a body for every gesture it times, and none for one it doesn’t know', () => {
    for (const name of Object.keys(GESTURES)) {
      const g = gesture(name, 0.5);
      expect(g, name).not.toBeNull();
      expect(g.targets || g.head, name).toBeTruthy();
    }
    expect(gesture('moonwalk', 0.5)).toBeNull();
  });

  it('throws a robot back from a shot from in front', () => {
    const g = gesture('stagger', 0.2, { dir: [0, 0, -1] });
    expect(g.targets.torso.pitch).toBeLessThan(-0.1);
  });

  it('gives each its own: Bumblebee waves, Starscream bows, Soundwave only watches', () => {
    expect(GREET['bumblebee-wfc']).toBe('wave');
    expect(GREET['starscream-foc']).toBe('bow');
    expect(GREET['soundwave-foc']).toBeNull();
    expect(gesture('bow', 1.1).targets.torso.pitch).toBeGreaterThan(0.4);
  });

  it('takes a line as long as its words', () => {
    expect(lineLength('Me Grimlock hold gate.')).toBeLessThan(lineLength('The Hall remembers every Prime. It will remember what you do here.'));
    expect(lineLength('')).toBeGreaterThanOrEqual(1.6);
  });
});

describe('someone standing about', () => {
  const run = (body, frames, ctx) => {
    let out;
    for (let i = 0; i < frames; i++) out = body.step(1 / 60, typeof ctx === 'function' ? ctx(i) : ctx);
    return out;
  };

  it('greets you once as you come up, and again only after you’ve gone and come back', () => {
    const b = createPersonBody({ kind: 'bumblebee-wfc', home: 0, seed: hashSeed('bumblebee') });
    const me = { x: 0, z: 0 };
    expect(run(b, 10, { me, you: { x: 0, z: 60 } }).gesture).toBeNull();
    const near = run(b, 2, { me, you: { x: 0, z: 20 } });
    expect(near.gesture?.name).toBe('wave');
    expect(near.look).toBe(true);
    const later = run(b, 300, { me, you: { x: 0, z: 20 } });
    expect(later.gesture).toBeNull();
    run(b, 10, { me, you: { x: 0, z: 80 } });
    // (a reaction keeps its cooldown, so it's not straight back)
    const back = run(b, 2400, (i) => ({ me, you: { x: 0, z: i < 1200 ? 80 : 20 } }));
    expect(back.look).toBe(true);
    let waved = false;
    const c = createPersonBody({ kind: 'jazz', home: 0, seed: 9 });
    for (let i = 0; i < 4; i++) {
      const o = run(c, 1, { me, you: { x: 0, z: i % 2 ? 80 : 20 } });
      if (o.gesture?.name === 'point') waved = true;
    }
    expect(waved).toBe(true);
  });

  it('never greets when it’s Soundwave', () => {
    const b = createPersonBody({ kind: 'soundwave-foc', seed: 1 });
    expect(run(b, 30, { me: { x: 0, z: 0 }, you: { x: 0, z: 10 } }).gesture).toBeNull();
  });

  it('talks with its hands for as long as its line', () => {
    const b = createPersonBody({ kind: 'grimlock', seed: 2 });
    const say = { token: {}, line: 'Me Grimlock hold gate. You help. Then me Grimlock smash more.' };
    const out = run(b, 2, { me: { x: 0, z: 0 }, you: { x: 0, z: 8 }, say });
    expect(out.gesture.name).toBe('talk');
    expect(out.gesture.hold).toBeCloseTo(lineLength(say.line), 6);
    const after = run(b, Math.ceil(lineLength(say.line) * 60) + 5, { me: { x: 0, z: 0 }, you: { x: 0, z: 8 }, say });
    expect(after.gesture).toBeNull();
  });

  it('turns its head first, and its feet only once you’re well round, slowly, stepping as it goes', () => {
    const b = createPersonBody({ kind: 'jazz', home: 0, seed: 3 });
    const me = { x: 0, z: 0 };
    const small = run(b, 30, { me, you: { x: 10, z: 30 } }); // (18° round)
    expect(small.yaw).toBe(0);
    let turning = run(b, 20, { me, you: { x: 30, z: -5 } }); // (well round to its left)
    expect(turning.yaw).toBeGreaterThan(0);
    expect(turning.yaw).toBeLessThan(1.3 * (50 / 60) + 1e-6);
    expect(turning.stepSpeed).toBeGreaterThan(0.3);
    turning = run(b, 300, { me, you: { x: 30, z: -5 } });
    // (the last of it the head takes)
    expect(Math.abs(turning.yaw - Math.atan2(30, -5))).toBeLessThan(0.13);
    expect(turning.stepSpeed).toBe(0);
  });
});

describe('a Decepticon’s body', () => {
  const foe = (o = {}) => ({ id: 'a', kind: 'trooper', x: 0, y: 0, z: 0, yaw: 0, h: 7, state: 'strafe', cooldown: 1, dead: false, ...o });

  it('walks where its brain moves it, sideways as a strafe', () => {
    const b = createFoeBody({ seed: 1 });
    const e = foe();
    let out;
    for (let i = 0; i < 60; i++) {
      e.x -= 3.6 / 60; // (to its right)
      out = b.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 } });
    }
    expect(out.state).toBe('walk');
    expect(out.side).toBeCloseTo(3.6, 1);
    expect(Math.abs(out.speed)).toBeLessThan(0.1);
    expect(out.aim[2]).toBeGreaterThan(0.9);
  });

  it('stands, its gun low, when it’s lost you and holds', () => {
    const b = createFoeBody({ seed: 1 });
    const e = foe({ state: 'hold' });
    let out;
    for (let i = 0; i < 30; i++) out = b.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 } });
    expect(out.state).toBe('idle');
    expect(out.aim[1]).toBeLessThan(-0.3);
    expect(out.look).toBeNull();
  });

  it('taunts once, as a boss, when it first sees you; braces before a heavy shot', () => {
    const b = createFoeBody({ kind: 'shockwave', boss: true, seed: 2, cooldown: 1.7 });
    const e = foe({ kind: 'shockwave', model: 'shockwave-foc', boss: true, cooldown: 1.2 });
    const first = b.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 } });
    expect(first.gesture?.name).toBe('taunt.cannon');
    let out;
    for (let i = 0; i < 200; i++) out = b.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 } });
    expect(out.gesture).toBeNull();
    e.cooldown = 0.2;
    expect(b.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 } }).brace).toBe(true);
  });

  it('flinches from a hit, a boss only now and then', () => {
    const t = createFoeBody({ seed: 3 });
    const e = foe();
    const hit = t.step(1 / 60, { e, you: { x: 0, y: 6, z: 40 }, hit: [0, -1] });
    expect(hit.gesture?.name).toBe('stagger');
    expect(hit.gesture.dir[2]).toBeCloseTo(-1, 6); // (from in front: thrown back)
    const boss = createFoeBody({ boss: true, kind: 'megatron', seed: 4, cooldown: 0.5 });
    const m = foe({ kind: 'megatron', model: 'megatron-foc', boss: true, state: 'hold' });
    expect(boss.step(1 / 60, { e: m, hit: [0, -1] }).gesture?.name).toBe('stagger');
    for (let i = 0; i < 40; i++) boss.step(1 / 60, { e: m });
    expect(boss.step(1 / 60, { e: m, hit: [0, -1] }).gesture).toBeNull();
  });

  it('goes over the way the shot that killed it was going', () => {
    const b = createFoeBody({ seed: 5 });
    const e = foe();
    b.step(1 / 60, { e, you: { x: 0, y: 6, z: -40 }, hit: [1, 0] });
    e.dead = true;
    const out = b.step(1 / 60, { e, you: { x: 0, y: 6, z: -40 } });
    expect(out.state).toBe('dead');
    expect(out.fall[0]).toBeCloseTo(1, 6);
    expect(out.recoil).toBe(false);
  });

  it('kicks back when it fires', () => {
    const b = createFoeBody({ seed: 6 });
    expect(b.step(1 / 60, { e: foe(), you: { x: 0, y: 6, z: 40 }, fired: true }).recoil).toBe(true);
  });
});
