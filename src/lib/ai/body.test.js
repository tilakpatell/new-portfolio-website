import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODE_BODY, bodyFrom } from './body';

const at = (x, z, yaw = 0, over = {}) => ({ x, z, yaw, ...over });

describe('motion, in the figure’s own frame', () => {
  it('a step straight ahead is speed, sideways is side, in the figure’s frame', () => {
    // facing +x (yaw π/2): ahead is +x, its right is +z
    const yaw = Math.PI / 2;
    const ahead = bodyFrom(at(0, 0, yaw), at(0.5, 0, yaw), 0.5).motion;
    expect(ahead.speed).toBeCloseTo(1);
    expect(ahead.side).toBeCloseTo(0);
    const right = bodyFrom(at(0, 0, yaw), at(0, 1, yaw), 0.5).motion;
    expect(right.speed).toBeCloseTo(0);
    expect(right.side).toBeCloseTo(2);
    const back = bodyFrom(at(0, 0, yaw), at(-1, 0, yaw), 1).motion;
    expect(back.speed).toBeCloseTo(-1);
    // and facing +z (yaw 0) its right is −x
    expect(bodyFrom(at(0, 0), at(-1, 0), 1).motion.side).toBeCloseTo(1);
  });

  it('speed is in metres: the world’s units over `unit`', () => {
    expect(bodyFrom(at(0, 0), at(0, 4), 1, { unit: 2 }).motion.speed).toBeCloseTo(2);
  });

  it('a yaw change is a turn rate', () => {
    // + to the left: yaw grows from +z toward +x, which is the figure's left
    expect(bodyFrom(at(0, 0, 0), at(0, 0, 0.5), 0.25).motion.turn).toBeCloseTo(2);
    expect(bodyFrom(at(0, 0, 0.5), at(0, 0, 0), 0.5).motion.turn).toBeCloseTo(-1);
    // the short way round across ±π
    expect(bodyFrom(at(0, 0, Math.PI - 0.1), at(0, 0, -Math.PI + 0.1), 1).motion.turn).toBeCloseTo(0.2);
  });

  it('dt 0 gives zero motion, never NaN', () => {
    const m = bodyFrom(at(0, 0, 0), at(3, 4, 1), 0).motion;
    expect(m).toEqual({ speed: 0, side: 0, turn: 0, down: 0, hurt: 0 });
    // and so does a first step, with nothing before it
    const first = bodyFrom(null, at(3, 4, 1), 1 / 60).motion;
    expect(first.speed).toBe(0);
    expect(first.turn).toBe(0);
    for (const v of Object.values(bodyFrom(at(0, 0), at(0, 0), -1).motion)) expect(Number.isNaN(v)).toBe(false);
  });

  it('down and hurt come from the step', () => {
    const m = bodyFrom(at(0, 0), at(0, 0, 0, { down: 0.4, hurt: 1 }), 1 / 60).motion;
    expect(m.down).toBe(0.4);
    expect(m.hurt).toBe(1);
  });
});

describe('modes', () => {
  const you = { at: { x: 30, y: 0, z: 0 }, confidence: 0.5 };

  it('search scans, suspicious stares at the belief, cover crouches, strafe keeps the look on the aim', () => {
    const search = bodyFrom(at(0, 0), at(0, 0.02, 0, { mode: 'search' }), 1 / 60);
    expect(search.scan).toBe(true);
    expect(search.base).toBeNull();
    // (a belief far beyond range: suspicious stares at where it heard you all the same)
    const sus = bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'suspicious', belief: you }), 1 / 60);
    expect(sus.look).toEqual({ x: 30, z: 0 });
    expect(sus.scan).toBe(false);
    const cover = bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'cover' }), 1 / 60);
    expect(cover.base).toBe('crouch');
    // up to fire
    expect(bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'cover', fire: true }), 1 / 60).base).toBeNull();
    const strafe = bodyFrom(at(0, 0), at(0.02, 0, 0, { mode: 'strafe', look: { x: 1, z: 1 }, aim: { x: 5, y: 1, z: -2 } }), 1 / 60);
    expect(strafe.look).toEqual({ x: 5, z: -2 });
    expect(bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'back', look: { x: 1, z: 1 }, aim: { x: 5, z: -2 } }), 1 / 60).look).toEqual({ x: 5, z: -2 });
  });

  it('chase looks at its belief, talk talks, hold and watch are idle', () => {
    expect(bodyFrom(at(0, 0), at(0, 0.1, 0, { mode: 'chase', belief: you }), 1 / 60).look).toEqual({ x: 30, z: 0 });
    const talk = bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'talk', look: { x: 1, z: 0 } }), 1 / 60);
    expect(talk.action).toBe('talk');
    expect(talk.look).toEqual({ x: 1, z: 0 });
    for (const mode of ['hold', 'watch']) {
      const b = bodyFrom(at(0, 0), at(0, 0, 0, { mode, look: { x: 2, z: 2 } }), 1 / 60);
      expect(b.base).toBeNull();
      expect(b.action).toBeNull();
      expect(b.look).toEqual({ x: 2, z: 2 });
    }
  });

  it('use:<want> plays the place’s advertised clip, as a base or a loop', () => {
    const bench = bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'use:rest', use: { clip: 'sit.enter', base: 'sit.idle' } }), 1 / 60);
    expect(bench.base).toBe('sit.idle');
    expect(bench.action).toBeNull();
    const bar = bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'use:food', use: { clip: 'drink' } }), 1 / 60);
    expect(bar.base).toBeNull();
    expect(bar.action).toBe('drink');
    // a world's own row for a want wins over the default
    const table = { ...MODE_BODY, 'use:work': { base: 'kneel.fix' } };
    expect(bodyFrom(at(0, 0), at(0, 0, 0, { mode: 'use:work' }), 1 / 60, { table }).base).toBe('kneel.fix');
  });

  it('an unknown mode is just its feet', () => {
    const b = bodyFrom(at(0, 0), at(0, 0.02, 0, { mode: 'patrol' }), 1 / 60);
    expect(b).toMatchObject({ look: null, base: null, action: null, scan: false });
    expect(b.motion.speed).toBeCloseTo(1.2);
  });

  it('the default table has a row for every mode the spec names', () => {
    for (const mode of ['hold', 'watch', 'suspicious', 'search', 'chase', 'strafe', 'back', 'cover', 'flee', 'talk', 'use:']) expect(MODE_BODY[mode]).toBeTruthy();
  });
});

describe('where it looks', () => {
  const near = { at: { x: 0, y: 0, z: 8 } };
  const far = { at: { x: 0, y: 0, z: 20 } };

  it('look priority: look, then aim, then a belief within range, else null', () => {
    const go = (over, opts) => bodyFrom(at(0, 0), at(0, 0, 0, over), 1 / 60, opts).look;
    expect(go({ look: { x: 1, z: 2 }, aim: { x: 3, z: 4 }, belief: near })).toEqual({ x: 1, z: 2 });
    expect(go({ aim: { x: 3, z: 4 }, belief: near })).toEqual({ x: 3, z: 4 });
    expect(go({ belief: near })).toEqual({ x: 0, z: 8 });
    expect(go({ belief: far })).toBeNull();
    expect(go({})).toBeNull();
    // a belief given as a bare point counts too
    expect(go({ belief: { x: 0, z: 5 } })).toEqual({ x: 0, z: 5 });
    // the range is in metres
    expect(go({ belief: far }, { range: 25 })).toEqual({ x: 0, z: 20 });
    expect(go({ belief: near }, { unit: 2, range: 3 })).toBeNull();
  });
});

describe('the module', () => {
  it('neither module imports three', () => {
    for (const f of ['body.js', 'react.js']) {
      const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
      expect(src).not.toMatch(/from ['"]three/);
      expect(src).not.toMatch(/Math\.random/);
    }
  });
});
