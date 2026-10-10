import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MESHY_MASKS, createAnimator } from './animator';
import { forFigure } from './clipLibrary';
import { RIGHT_ANGLE, meshyRig, swingClip } from './meshyRig.fixture';

// (the library's copies as they are, unless a test makes them slow)
vi.mock('./clipLibrary', async (orig) => {
  const lib = await orig();
  return { ...lib, forFigure: vi.fn(lib.forFigure) };
});

const V = THREE.Vector3;
const DT = 1 / 60;
const FRAME = { forward: new V(0, 0, 1), up: new V(0, 1, 0) };
const STILL = { move: 0 };
const WALK = { move: 0.5, speed: 1.2 };
const RUN = { move: 1, speed: 3.5 };
const flush = () => new Promise((r) => setTimeout(r, 0));

// the one-shots and base states the tests play, made on `rig`
function extras(rig) {
  const sit = (k) => (n) => (/UpLeg$/.test(n) ? -1.5 * k : /Leg$/.test(n) ? 1.5 * k : 0);
  return {
    wave: swingClip(rig, 'wave', 1.2, (n, t) => (n === 'RightArm' ? -1.2 * Math.sin((Math.PI * t) / 1.2) : 0)),
    cheer: swingClip(rig, 'cheer', 1, (n, t) => (/Arm$/.test(n) ? -2 * Math.sin(Math.PI * t) : 0)),
    punch: swingClip(rig, 'punch', 0.6, (n, t) => (n === 'RightForeArm' ? -1.4 * Math.sin((Math.PI * t) / 0.6) : 0)),
    flex: swingClip(rig, 'flex', 1, () => RIGHT_ANGLE),
    'sit.enter': swingClip(rig, 'sit.enter', 1, (n, t) => sit(t)(n)),
    'sit.idle': swingClip(rig, 'sit.idle', 2, (n) => sit(1)(n)),
    'sit.exit': swingClip(rig, 'sit.exit', 1, (n, t) => sit(1 - t)(n)),
  };
}

function make({ seed = 1, without = [], drop = [], clips: more = {} } = {}) {
  const rig = meshyRig({ without });
  const clips = { ...rig.clips, ...extras(rig), ...more };
  for (const n of drop) delete clips[n];
  const anim = createAnimator(rig.model, { clips, hipsY: rig.hipsY, seed });
  return { rig, anim, clips };
}

// `secs` of frames: the motion, the mixer, the bones on top
function run(anim, secs, { motion = STILL, frame = FRAME, each = null } = {}) {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    anim.locomote(motion);
    anim.update(DT);
    anim.after(DT, motion, frame);
    each?.(i);
  }
}

// the weights of every action the mixer's applying
const baseSum = (anim) =>
  Object.values(anim.actions)
    .filter((a) => a.isScheduled())
    .reduce((s, a) => s + a.getEffectiveWeight(), 0);
const valueOf = (clip, bone) => clip.tracks.find((t) => t.name === `${bone}.quaternion`).values.slice(0, 4);
const expectQuat = (q, want, digits = 6) => {
  const w = want.isQuaternion ? want : new THREE.Quaternion(...want);
  // (q and −q are the same turn; the clips' keys are only near unit length)
  expect(Math.abs(q.dot(w)) / (q.length() * w.length())).toBeCloseTo(1, digits);
};
const worldQ = (b) => b.getWorldQuaternion(new THREE.Quaternion());
// how far a's bone is turned about the up axis from b's, in the world
const yawOf = (a, b) => {
  const r = worldQ(a).multiply(worldQ(b).invert());
  return 2 * Math.atan2(r.y, r.w);
};
const DEG = Math.PI / 180;

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(forFigure).mockReset();
});

describe('the base: locomotion, base states and full-body one-shots on the mixer', () => {
  it('names the bones each layer may move', () => {
    expect(MESHY_MASKS.upper).toEqual(expect.arrayContaining(['Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']));
    expect(MESHY_MASKS.lower).toEqual(expect.arrayContaining(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']));
    expect(MESHY_MASKS.upper.some((n) => MESHY_MASKS.lower.includes(n))).toBe(false);
  });

  it('base weights sum to 1 in every state', () => {
    const check = (anim) => () => expect(Math.abs(baseSum(anim) - 1)).toBeLessThan(1e-6);
    const { anim } = make();
    const each = check(anim);
    each();
    run(anim, 0.5, { motion: STILL, each });
    run(anim, 0.5, { motion: WALK, each });
    run(anim, 0.5, { motion: RUN, each });
    // a full one-shot fading in and out, walking
    anim.play('wave');
    run(anim, 1.6, { motion: WALK, each });
    // one cut by another, cut by a third
    anim.play('wave');
    run(anim, 0.1, { each });
    anim.play('cheer');
    run(anim, 0.05, { each });
    anim.play('punch');
    run(anim, 1, { each });
    // a base state, in through its clip and out through its own
    anim.base('sit.idle');
    run(anim, 2.5, { each });
    anim.play('wave');
    run(anim, 0.4, { each });
    anim.base(null);
    run(anim, 2.5, { each });
    // and a figure missing a clip
    for (const drop of [['run'], ['walk'], ['walk', 'run'], ['idle']]) {
      const lame = make({ drop });
      const c = check(lame.anim);
      for (const m of [STILL, WALK, RUN, STILL]) run(lame.anim, 0.4, { motion: m, each: c });
    }
  });

  it('replaying a full one-shot restarts it in place, never cuts it', async () => {
    const { anim } = make();
    let first = null;
    const p1 = anim.play('wave');
    p1.then((r) => (first = r));
    run(anim, 0.4);
    const a = anim.actions.wave;
    const w = a.getEffectiveWeight();
    expect(w).toBeGreaterThan(0.9);
    const p2 = anim.play('wave');
    expect(p2).toBe(p1); // (the two wait on the one end)
    expect(a.time).toBe(0);
    expect(a.getEffectiveWeight()).toBe(w);
    run(anim, 0.05);
    expect(a.isRunning()).toBe(true);
    expect(a.getEffectiveWeight()).toBeGreaterThanOrEqual(w);
    await flush();
    expect(first).toBe(null);
    // a punch chain: each replay restarts it, none leaves it at nothing
    const fists = make().anim;
    let ended = null;
    fists.play('punch').then((r) => (ended = r));
    for (let i = 0; i < 6; i++) {
      run(fists, 0.08);
      fists.play('punch');
      expect(fists.actions.punch.time).toBe(0);
      run(fists, 0.02);
      expect(fists.actions.punch.isRunning()).toBe(true);
      expect(fists.actions.punch.getEffectiveWeight()).toBeGreaterThan(0.3);
    }
    await flush();
    expect(ended).toBe(null);
  });

  it('a replayed one-shot resolves done, both asks, when it ends', async () => {
    const { anim } = make();
    const p1 = anim.play('wave');
    run(anim, 0.4);
    const p2 = anim.play('wave');
    run(anim, 1.3);
    expect(await p1).toBe('done');
    expect(await p2).toBe('done');
    expect(anim.playing('full')).toBe(null);
  });

  it('a new one-shot cuts the last, and fades it out all the way', async () => {
    const { anim } = make();
    const p1 = anim.play('wave');
    run(anim, 0.3);
    const p2 = anim.play('cheer');
    expect(await p1).toBe('cut');
    run(anim, 0.1);
    expect(anim.playing('full')).toBe('cheer');
    run(anim, 1);
    expect(anim.actions.wave.getEffectiveWeight()).toBe(0);
    expect(anim.actions.wave.isScheduled()).toBe(false);
    expect(await p2).toBe('done');
    // three in a row: the first two left at nothing
    anim.play('wave');
    run(anim, 0.1);
    anim.play('cheer');
    run(anim, 0.05);
    anim.play('punch');
    run(anim, 1);
    for (const n of ['wave', 'cheer']) {
      expect(anim.actions[n].getEffectiveWeight()).toBe(0);
      expect(anim.actions[n].isScheduled()).toBe(false);
    }
  });

  it('hold keeps a clip on its last frame until it’s stopped; at starts it part way in', async () => {
    const { anim } = make();
    const held = anim.play('wave', { hold: true });
    run(anim, 1.5);
    expect(await held).toBe('done');
    expect(anim.playing('full')).toBe('wave');
    expect(anim.actions.wave.getEffectiveWeight()).toBe(1);
    anim.stop('full', 0.25);
    expect(anim.playing('full')).toBe(null);
    run(anim, 0.1);
    expect(anim.actions.wave.getEffectiveWeight()).toBeGreaterThan(0);
    run(anim, 0.3);
    expect(anim.actions.wave.isScheduled()).toBe(false);
    expect(anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 6);
    anim.play('cheer', { at: 0.6 });
    expect(anim.actions.cheer.time).toBe(0.6);
    // a looped one never ends by itself; a stop cuts it
    const looped = anim.play('flex', { layer: 'upper', loop: true });
    run(anim, 2.5);
    expect(anim.playing('upper')).toBe('flex');
    anim.stop('upper');
    expect(await looped).toBe('cut');
    expect(anim.playing('upper')).toBe(null);
  });

  it('a clip it can’t have resolves cut and plays nothing', async () => {
    const { anim } = make();
    expect(await anim.play('no.such.clip')).toBe('cut');
    expect(anim.playing('full')).toBe(null);
  });

  it('base("sit.idle") enters through sit.enter when it exists and leaves through sit.exit', async () => {
    const { anim } = make();
    run(anim, 0.2);
    const down = anim.base('sit.idle');
    run(anim, 0.1);
    expect(anim.actions['sit.enter'].getEffectiveWeight()).toBeGreaterThan(0);
    expect(anim.actions['sit.idle']?.getEffectiveWeight() ?? 0).toBe(0);
    run(anim, 1.5);
    expect(anim.actions['sit.idle'].getEffectiveWeight()).toBeCloseTo(1, 6);
    expect(anim.actions['sit.enter'].isScheduled()).toBe(false);
    expect(await down).toBe('done');
    const up = anim.base(null);
    run(anim, 0.1);
    expect(anim.actions['sit.exit'].getEffectiveWeight()).toBeGreaterThan(0);
    expect(anim.actions.idle.getEffectiveWeight()).toBe(0);
    run(anim, 1.5);
    expect(anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 6);
    expect(anim.actions['sit.idle'].isScheduled()).toBe(false);
    expect(anim.actions['sit.exit'].isScheduled()).toBe(false);
    expect(await up).toBe('done');
    // without clips in and out (and none in the library), it fades straight in
    const bare = make();
    bare.anim.base('perch.idle'); // (not a clip it has: it stays as it is)
    run(bare.anim, 0.1);
    expect(bare.anim.actions.idle.getEffectiveWeight()).toBe(1);
    const perch = make({ clips: { 'perch.idle': bare.clips['sit.idle'] } });
    const there = perch.anim.base('perch.idle');
    run(perch.anim, 0.1);
    expect(perch.anim.actions['perch.idle'].getEffectiveWeight()).toBeGreaterThan(0);
    run(perch.anim, 0.3);
    expect(await there).toBe('done');
  });

  it('a base whose clips are still coming is done only once they’ve come and it’s faded in', async () => {
    const { anim } = make({ drop: ['sit.enter', 'sit.idle', 'sit.exit'] });
    const made = extras(meshyRig());
    // the library slow: each clip handed over only when the test says
    const waiting = new Map();
    vi.mocked(forFigure).mockImplementation((name) => new Promise((resolve) => waiting.set(name, () => resolve(made[name] ?? null))));
    let result = null;
    anim.base('sit.idle').then((r) => (result = r));
    run(anim, 1);
    await flush();
    expect(result).toBe(null); // (still fetching: nowhere near sat)
    expect([...waiting.keys()].sort()).toEqual(['sit.enter', 'sit.idle']);
    expect(anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 6);
    for (const give of waiting.values()) give();
    await flush();
    run(anim, 0.3);
    await flush();
    expect(result).toBe(null); // (on its way in through sit.enter)
    expect(anim.actions['sit.enter'].getEffectiveWeight()).toBeGreaterThan(0);
    run(anim, 1.5);
    await flush();
    expect(result).toBe('done');
    expect(anim.actions['sit.idle'].getEffectiveWeight()).toBeCloseTo(1, 6);
  });

  it('a clip added by hand is played as its own, never fetched', async () => {
    const { anim, clips } = make();
    const rig = meshyRig();
    const salute = swingClip(rig, 'salute', 0.8, (n, t) => (n === 'RightArm' ? -1.5 * Math.sin((Math.PI * t) / 0.8) : 0));
    expect(anim.add('salute', salute)).toBe(true);
    const p = anim.play('salute', { layer: 'upper' });
    expect(anim.playing('upper')).toBe('salute'); // (at once: nothing to wait for)
    run(anim, 1);
    expect(await p).toBe('done');
    // one it already has stays its own; nothing's no clip at all
    expect(anim.add('wave', salute)).toBe(false);
    anim.play('wave');
    expect(anim.actions.wave.getClip()).toBe(clips.wave);
    expect(anim.add('nothing', null)).toBe(false);
    // a base state from one, no way in or out of its own
    expect(anim.add('perch.idle', clips['sit.idle'])).toBe(true);
    const there = anim.base('perch.idle');
    run(anim, 0.5);
    expect(await there).toBe('done');
    expect(forFigure).not.toHaveBeenCalled();
  });

  it('a base asked for again before it’s there cuts the first ask', async () => {
    const { anim } = make();
    const down = anim.base('sit.idle');
    run(anim, 0.3);
    const up = anim.base(null);
    expect(await down).toBe('cut');
    run(anim, 2);
    expect(await up).toBe('done');
    expect(anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 6);
  });

  it('seeded figures start their idles apart', () => {
    const a = make({ seed: 1 }).anim;
    const b = make({ seed: 2 }).anim;
    expect(Math.abs(a.actions.idle.time - b.actions.idle.time)).toBeGreaterThan(0.1);
    expect(make({ seed: 1 }).anim.actions.idle.time).toBe(a.actions.idle.time);
    // a crowd's spread over the clip
    const times = Array.from({ length: 20 }, (_, i) => make({ seed: i }).anim.actions.idle.time);
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(2);
  });

  it('a 1 s frame is clamped, and a frame of 0 is a frame of 0', () => {
    const { anim, rig } = make();
    const spy = vi.spyOn(anim.mixer, 'update');
    anim.update(1);
    expect(spy).toHaveBeenLastCalledWith(0.1);
    anim.update(0);
    expect(spy).toHaveBeenLastCalledWith(0);
    anim.update(NaN);
    expect(spy).toHaveBeenLastCalledWith(0);
    for (const b of Object.values(rig.bones)) expect(Number.isFinite(b.quaternion.w)).toBe(true);
    expect(Math.abs(baseSum(anim) - 1)).toBeLessThan(1e-6);
  });

  it('lodRate is the share of frames it’s stepped on, by the frames’ time', () => {
    const { anim } = make();
    const spy = vi.spyOn(anim.mixer, 'update');
    for (let i = 0; i < 12; i++) anim.update(DT, { lodRate: 0.25 });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[2][0]).toBeCloseTo(4 * DT, 9);
    // off screen: not at all, and the time missed let go
    spy.mockClear();
    for (let i = 0; i < 30; i++) anim.update(DT, { lodRate: 0 });
    expect(spy).not.toHaveBeenCalled();
    anim.update(DT);
    expect(spy).toHaveBeenLastCalledWith(DT);
  });
});

describe('the layers, the look, the idles and the queue', () => {
  it('an upper layer moves only upper bones, and the legs keep the walk', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // (locomotion's start in the stride, the same for both)
    const A = make();
    const B = make();
    vi.restoreAllMocks();
    A.anim.play('flex', { layer: 'upper', fade: 0.1 });
    for (let i = 0; i < 30; i++)
      for (const { anim } of [A, B]) {
        anim.locomote(WALK);
        anim.update(DT);
        anim.after(DT, WALK, FRAME);
      }
    for (const n of MESHY_MASKS.lower) expectQuat(A.rig.bones[n].quaternion, B.rig.bones[n].quaternion);
    for (const n of ['RightArm', 'LeftForeArm', 'Spine', 'Head']) expectQuat(A.rig.bones[n].quaternion, valueOf(A.clips.flex, n));
    expect(A.anim.playing('upper')).toBe('flex');
    expect(A.anim.playing('full')).toBe(null);
  });

  it('a lower layer moves the legs and only turns the hips', () => {
    const rig = meshyRig();
    const lunge = swingClip(rig, 'lunge', 1, () => 0.5, { hips: () => -20 });
    const { anim, rig: own } = make({ clips: { lunge } });
    const at = own.bones.Hips.position.y;
    anim.play('lunge', { layer: 'lower', fade: 0.05 });
    run(anim, 0.3);
    expect(anim.playing('lower')).toBe('lunge');
    expectQuat(own.bones.LeftUpLeg.quaternion, valueOf(lunge, 'LeftUpLeg'));
    expectQuat(own.bones.Hips.quaternion, valueOf(lunge, 'Hips'));
    expect(own.bones.Hips.position.y).toBeCloseTo(at, 6);
    expect(Math.abs(own.bones.RightArm.quaternion.dot(new THREE.Quaternion(...valueOf(lunge, 'RightArm'))))).toBeLessThan(0.9999);
  });

  it('layers skip bones the figure lacks', () => {
    const full = meshyRig();
    const flex = swingClip(full, 'flex', 1, () => RIGHT_ANGLE);
    const { anim, rig } = make({ without: ['Spine02', 'LeftArm', 'RightArm'], clips: { flex } });
    expect(() => {
      anim.play('flex', { layer: 'upper', fade: 0.05 });
      run(anim, 0.3, { motion: WALK });
      anim.look(new V(2, 1.5, 2));
      run(anim, 0.3, { motion: STILL });
    }).not.toThrow();
    expectQuat(rig.bones.Spine01.quaternion, valueOf(flex, 'Spine01'));
    expectQuat(rig.bones.RightForeArm.quaternion, valueOf(flex, 'RightForeArm'));
  });

  it('look turns the head toward a target within its clamp, the neck a third', () => {
    const A = make();
    const B = make(); // (never looks)
    A.rig.model.updateMatrixWorld(true);
    const head = A.rig.bones.Head.getWorldPosition(new V());
    const toward = (deg) => head.clone().add(new V(Math.sin(deg * DEG), 0, Math.cos(deg * DEG)).multiplyScalar(3));
    A.anim.look(toward(45));
    for (let i = 0; i < 120; i++)
      for (const { anim } of [A, B]) {
        anim.update(DT);
        anim.after(DT, STILL, FRAME);
      }
    expect(yawOf(A.rig.bones.Head, B.rig.bones.Head)).toBeCloseTo(45 * DEG, 1);
    expect(Math.abs(yawOf(A.rig.bones.Head, B.rig.bones.Head) - 45 * DEG)).toBeLessThan(2 * DEG);
    expect(Math.abs(yawOf(A.rig.bones.neck, B.rig.bones.neck) - 15 * DEG)).toBeLessThan(2 * DEG);
    // behind, beyond the clamp: the head stops at `yaw` and the chest takes a little more
    A.anim.look(toward(170), { yaw: 1.1 });
    for (let i = 0; i < 180; i++)
      for (const { anim } of [A, B]) {
        anim.update(DT);
        anim.after(DT, STILL, FRAME);
      }
    const chest = yawOf(A.rig.bones.Spine, B.rig.bones.Spine);
    expect(Math.abs(yawOf(A.rig.bones.Head, B.rig.bones.Head) - chest - 1.1)).toBeLessThan(2 * DEG);
    expect(chest).toBeGreaterThan(0);
    expect(chest).toBeLessThanOrEqual(0.35);
    // and null brings it back
    A.anim.look(null);
    for (let i = 0; i < 180; i++)
      for (const { anim } of [A, B]) {
        anim.update(DT);
        anim.after(DT, STILL, FRAME);
      }
    expect(Math.abs(yawOf(A.rig.bones.Head, B.rig.bones.Head))).toBeLessThan(0.5 * DEG);
  });

  it('a figure never asked to look skips the head’s sums, frame after frame', () => {
    const { anim, rig } = make();
    const spy = vi.spyOn(rig.model, 'getWorldQuaternion');
    anim.play('flex', { layer: 'upper' });
    run(anim, 0.5, { motion: WALK });
    expect(spy).not.toHaveBeenCalled();
    // asked, it turns; let go and eased back, it stops working it out again
    anim.look(new V(3, 1.5, 3));
    run(anim, 0.1);
    expect(spy).toHaveBeenCalled();
    anim.look(null);
    run(anim, 6);
    spy.mockClear();
    run(anim, 0.5);
    expect(spy).not.toHaveBeenCalled();
  });

  it('look eases at its rate', () => {
    const A = make();
    const B = make();
    A.rig.model.updateMatrixWorld(true);
    const head = A.rig.bones.Head.getWorldPosition(new V());
    A.anim.look(head.clone().add(new V(3, 0, 3)));
    for (const { anim } of [A, B]) {
      anim.update(DT);
      anim.after(DT, STILL, FRAME);
    }
    const turned = yawOf(A.rig.bones.Head, B.rig.bones.Head) / (45 * DEG);
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(0.15);
  });

  it('a 1 s frame steps the layers and the look by a tenth of a second, and frames of 0 change nothing', () => {
    const A = make();
    const B = make();
    A.rig.model.updateMatrixWorld(true);
    const head = A.rig.bones.Head.getWorldPosition(new V());
    A.anim.look(head.clone().add(new V(3, 0, 3)));
    A.anim.play('flex', { layer: 'upper' });
    for (let i = 0; i < 5; i++)
      for (const { anim } of [A, B]) {
        anim.update(1);
        anim.after(1, STILL, FRAME);
      }
    // five 1 s frames are half a second: the flex (1 s long) still playing
    expect(A.anim.playing('upper')).toBe('flex');
    const k = 1 - Math.exp(-6 * 0.5);
    expect(yawOf(A.rig.bones.Head, B.rig.bones.Head)).toBeCloseTo(45 * DEG * k, 1);
    // part way through a layer's fade and a look's turn, frames of 0 hold the pose exactly
    const C = make();
    C.anim.play('flex', { layer: 'upper', fade: 0.5 });
    C.anim.look(head.clone().add(new V(3, 0.5, 3)));
    run(C.anim, 0.1, { motion: WALK });
    const pose = Object.values(C.rig.bones).map((b) => b.quaternion.clone());
    for (let i = 0; i < 5; i++) {
      C.anim.update(0);
      C.anim.after(0, WALK, FRAME);
    }
    Object.values(C.rig.bones).forEach((b, i) => b.quaternion.toArray().forEach((v, k) => expect(v).toBeCloseTo(pose[i].toArray()[k], 12)));
  });

  it('idles fire a fidget on the upper layer only while still', () => {
    const fidgets = (motion) => {
      const { anim } = make({ seed: 3 });
      anim.idles({ fidgets: ['flex'], every: [1, 1] });
      let starts = 0;
      let was = null;
      run(anim, 1.5, {
        motion,
        each: () => {
          const now = anim.playing('upper');
          if (now && now !== was) starts++;
          was = now;
          expect(anim.playing('full')).toBe(null);
        },
      });
      return starts;
    };
    expect(fidgets(STILL)).toBe(1);
    expect(fidgets(WALK)).toBe(0);
  });

  it('a queue runs its steps in order, and a play on its layer cuts it', async () => {
    const { anim } = make();
    anim.base('sit.idle');
    run(anim, 2.5);
    const seen = [];
    let t = 0;
    const q = anim.queue([{ base: null }, { play: 'wave' }, { wait: 0.3 }, { look: new V(0, 1.5, 5) }, { play: 'cheer' }]);
    run(anim, 5, {
      each: () => {
        t += DT;
        const now = anim.playing('full');
        if (now && seen.at(-1)?.name !== now) seen.push({ name: now, t });
      },
    });
    expect(seen.map((s) => s.name)).toEqual(['wave', 'cheer']);
    expect(seen[0].t).toBeGreaterThanOrEqual(1); // (once sit.exit's second was through)
    expect(seen[1].t - seen[0].t).toBeGreaterThanOrEqual(1.2 + 0.3 - DT);
    expect(await q).toBe('done');
    // cut by a play on its layer: its later steps never run
    const q2 = anim.queue([{ play: 'wave' }, { play: 'cheer' }]);
    run(anim, 0.2);
    anim.play('punch');
    expect(await q2).toBe('cut');
    const after = [];
    run(anim, 3, { each: () => after.push(anim.playing('full')) });
    expect(after).not.toContain('cheer');
    // a play on another layer leaves it be
    const q3 = anim.queue([{ play: 'wave' }]);
    run(anim, 0.2);
    anim.play('flex', { layer: 'upper' });
    run(anim, 1.5);
    expect(await q3).toBe('done');
  });

  it('dispose stops everything and settles what was waiting', async () => {
    const { anim } = make();
    const p = anim.play('wave');
    const q = anim.queue([{ wait: 5 }, { play: 'cheer' }]);
    run(anim, 0.1);
    anim.dispose();
    expect(await p).toBe('cut');
    expect(await q).toBe('cut');
  });
});

describe('the arm layers', () => {
  const ARM_R = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
  const ARM_L = ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'];

  it('names each arm’s bones', () => {
    expect(MESHY_MASKS['arm.r']).toEqual(ARM_R);
    expect(MESHY_MASKS['arm.l']).toEqual(ARM_L);
  });

  it('an arm layer over a standing idle moves only that arm’s four bones', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const A = make();
    const B = make();
    vi.restoreAllMocks();
    A.anim.play('flex', { layer: 'arm.r', loop: true, fade: 0.1 });
    for (let i = 0; i < 30; i++) for (const { anim } of [A, B]) run(anim, DT);
    for (const n of Object.keys(A.rig.bones)) {
      if (ARM_R.includes(n)) expectQuat(A.rig.bones[n].quaternion, valueOf(A.clips.flex, n));
      else expectQuat(A.rig.bones[n].quaternion, B.rig.bones[n].quaternion);
    }
    expect(A.anim.playing('arm.r')).toBe('flex');
    expect(A.anim.playing('upper')).toBe(null);
  });

  it('a walk on the right arm’s layer over standing swings that arm and nothing else', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const A = make();
    const B = make();
    vi.restoreAllMocks();
    A.anim.play('walk', { layer: 'arm.r', loop: true, fade: 0.05 });
    let swung = 0;
    for (let i = 0; i < 40; i++) {
      for (const { anim } of [A, B]) run(anim, DT);
      for (const n of Object.keys(A.rig.bones)) if (!ARM_R.includes(n)) expectQuat(A.rig.bones[n].quaternion, B.rig.bones[n].quaternion);
      swung = Math.max(swung, A.rig.bones.RightArm.quaternion.angleTo(B.rig.bones.RightArm.quaternion));
    }
    expect(swung).toBeGreaterThan(0.1);
  });

  it('the two arms hold different clips at once, each its own slot', () => {
    const { anim, rig, clips } = make();
    anim.play('flex', { layer: 'arm.r', loop: true, fade: 0.05 });
    anim.play('cheer', { layer: 'arm.l', hold: true, fade: 0.05 });
    run(anim, 1.2);
    expect(anim.playing('arm.r')).toBe('flex');
    expect(anim.playing('arm.l')).toBe('cheer');
    expectQuat(rig.bones.RightArm.quaternion, valueOf(clips.flex, 'RightArm'));
    const last = clips.cheer.tracks.find((t) => t.name === 'LeftArm.quaternion').values.slice(-4);
    expectQuat(rig.bones.LeftArm.quaternion, last, 4);
  });

  it('a full-body play cuts both arm layers', async () => {
    const { anim } = make();
    const r = anim.play('flex', { layer: 'arm.r', loop: true });
    const l = anim.play('flex', { layer: 'arm.l', loop: true });
    run(anim, 0.2);
    anim.play('cheer');
    expect(await r).toBe('cut');
    expect(await l).toBe('cut');
    expect(anim.playing('arm.r')).toBe(null);
    expect(anim.playing('arm.l')).toBe(null);
    expect(anim.playing('full')).toBe('cheer');
  });

  it('weight(layer, w) scales how far a layer is laid on, 0 not at all', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const A = make();
    const B = make();
    const C = make();
    vi.restoreAllMocks();
    A.anim.play('flex', { layer: 'arm.r', loop: true, fade: 0.05 });
    C.anim.play('flex', { layer: 'arm.r', loop: true, fade: 0.05 });
    A.anim.weight('arm.r', 0);
    C.anim.weight('arm.r', 0.5);
    expect(C.anim.weight('arm.r')).toBe(0.5);
    run(A.anim, 0.5);
    run(B.anim, 0.5);
    run(C.anim, 0.5);
    for (const n of ARM_R) expectQuat(A.rig.bones[n].quaternion, B.rig.bones[n].quaternion);
    const full = new THREE.Quaternion(...valueOf(C.clips.flex, 'RightArm'));
    const half = B.rig.bones.RightArm.quaternion.angleTo(full) / 2;
    expect(C.rig.bones.RightArm.quaternion.angleTo(full)).toBeGreaterThan(half * 0.5);
    expect(C.rig.bones.RightArm.quaternion.angleTo(B.rig.bones.RightArm.quaternion)).toBeGreaterThan(half * 0.5);
  });
});
