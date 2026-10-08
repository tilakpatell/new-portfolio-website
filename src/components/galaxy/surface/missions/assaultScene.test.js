import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSolids } from '../walker';
import { FALL, createAssaultMission, faceFor, fallPose, fallWay, postureOf, runInFrom } from './assaultScene';
import { RULES } from './assault';

// The battle's figures, faked: the attackers' (snowtroopers) on an animator,
// their calls written down; the defenders' (Hoth's troopers) statues, their
// updates written down.
const figs = [];
vi.mock('../actors', () => ({
  anyFigure: async (kind) => {
    const calls = [];
    const fig =
      kind === 'snowtrooper'
        ? {
            model: new THREE.Group(),
            tall: 1.8,
            anim: {},
            calls,
            update: (dt, move, motion) => calls.push(['update', motion]),
            react: (event, ctx) => (calls.push(['react', event, ctx]), { clip: event === 'down' ? 'die.fwd' : event }),
            base: (name) => calls.push(['base', name]),
            look: (at) => calls.push(['look', at]),
            stop: (fade, layer) => calls.push(['stop', layer]),
            play: () => Promise.resolve(true),
          }
        : { model: new THREE.Group(), tall: 1.8, calls, update: (dt, move, motion) => calls.push(['update', motion]) };
    figs.push({ kind, fig });
    return fig;
  },
}));

describe('a statue going down (fallPose)', () => {
  it('goes over slowly off the mark and quickly at the end, as a body falls, and lies there', () => {
    const at = (k) => fallPose(k, { tall: 1.8, way: 1 }).pitch;
    expect(at(0)).toBe(0);
    // (a quarter of the way through the time it's well under a quarter of the way over)
    expect(at(FALL.over / 4)).toBeLessThan((Math.PI / 2) * 0.1);
    expect(at(FALL.over / 2)).toBeLessThan(at(FALL.over) / 2);
    // on the ground, past a bounce, lying all but flat and never through it
    for (let k = FALL.over + 0.3; k < FALL.gone; k += 0.1) {
      expect(at(k)).toBeGreaterThan((Math.PI / 2) * 0.9);
      expect(at(k)).toBeLessThanOrEqual(Math.PI / 2);
    }
  });

  it('falls the way the shot pushed it, rolled toward the side it was hit from', () => {
    expect(fallPose(1, { way: 1 }).pitch).toBeGreaterThan(1.3);
    expect(fallPose(1, { way: -1 }).pitch).toBeLessThan(-1.3);
    expect(fallPose(1, { way: -1, side: 1 }).roll).toBeGreaterThan(0.2);
    expect(fallPose(1, { way: -1, side: -1 }).roll).toBeLessThan(-0.2);
    expect(fallPose(1, { way: -1 }).roll).toBe(0);
  });

  it('crumples: its knees go as it tips, its feet slip back, it lies on the ground, then sinks out of sight and goes', () => {
    const mid = fallPose(FALL.over / 2, { tall: 1.8 });
    expect(mid.lift).toBeLessThan(-0.05);
    const lying = fallPose(FALL.over + 0.5, { tall: 1.8 });
    expect(lying.lift).toBeGreaterThan(0);
    expect(lying.slide).toBeGreaterThan(0.3);
    expect(lying.gone).toBe(false);
    expect(lying.sunk).toBe(0);
    expect(fallPose(FALL.gone - 0.05, { tall: 1.8 }).sunk).toBeGreaterThan(0.4);
    expect(fallPose(FALL.gone, { tall: 1.8 }).gone).toBe(true);
  });

  it('is pushed the way the shot went: onto its face from behind, onto its back from in front', () => {
    // facing +z (yaw 0), its right toward −x
    expect(fallWay([0, -10], [0, 0], 0)).toMatchObject({ way: 1 });
    expect(fallWay([0, 10], [0, 0], 0)).toMatchObject({ way: -1 });
    // (shot from its left, +x: pushed to its right)
    expect(fallWay([10, 2], [0, 0], 0).side).toBeGreaterThan(0.9);
    // (nowhere it came from: onto its back)
    expect(fallWay(null, [0, 0], 0)).toEqual({ way: -1, side: 0 });
    // turned round, the same shot pushes it the other way
    expect(fallWay([0, -10], [0, 0], Math.PI)).toMatchObject({ way: -1 });
  });
});

describe('a statue’s posture (postureOf)', () => {
  it('is down behind its cover and up to fire, and hunched running to it', () => {
    const down = postureOf('cover', { tall: 1.8 });
    expect(down.sink).toBeGreaterThan(0.3);
    expect(down.lean).toBeGreaterThan(0.05);
    expect(postureOf('cover', { tall: 1.8, firing: true }).sink).toBe(0);
    expect(postureOf('cover', { tall: 1.8, moving: true })).toMatchObject({ sink: 0 });
    expect(postureOf('cover', { tall: 1.8, moving: true }).lean).toBeGreaterThan(down.lean);
  });

  it('covers its half’s going from a knee, firing or not; kept down in the open, its head’s down; standing to fight, upright', () => {
    expect(postureOf('covering', { tall: 1.8 }).sink).toBeGreaterThan(0);
    expect(postureOf('covering', { tall: 1.8, firing: true }).sink).toBeGreaterThan(0);
    expect(postureOf('pinned', { tall: 1.8 }).lean).toBeGreaterThan(0.15);
    expect(postureOf('fight', { tall: 1.8 })).toEqual({ sink: 0, lean: 0 });
    expect(postureOf('advance', { tall: 1.8, moving: true }).lean).toBeGreaterThan(0);
    // (no sinking anyone into the ground on the move: its feet would show it)
    for (const mode of ['cover', 'covering', 'pinned', 'retreat', 'flank', 'fight', 'advance']) expect(postureOf(mode, { tall: 1.8, moving: true }).sink, mode).toBe(0);
  });
});

describe('which way a soldier faces (faceFor)', () => {
  it('stands facing what the rules face it to (its target, or where it’s going)', () => {
    expect(faceFor({ yaw: 0.4, travel: 2, speed: 0.2, mode: 'fight' })).toBe(0.4);
    expect(faceFor({ yaw: 0.4, travel: 0.4, speed: 3, mode: 'advance' })).toBe(0.4);
  });

  it('a half falling back turns and goes, and turns back to fire', () => {
    expect(faceFor({ yaw: 0, travel: Math.PI, speed: 2, mode: 'retreat', aim: 0 })).toBe(Math.PI);
    expect(faceFor({ yaw: 0, travel: Math.PI, speed: 2, mode: 'retreat', aim: 0.1, firing: true })).toBe(0.1);
  });

  it('one running in faces where it runs', () => {
    expect(faceFor({ yaw: 0, travel: 1.2, speed: 6, mode: 'fight', runIn: true })).toBe(1.2);
  });

  it('a statue doesn’t crab: going sideways it turns part way to its travel, going away from its target it turns to go, unless it’s firing', () => {
    expect(faceFor({ yaw: 0, travel: Math.PI / 2, speed: 2, mode: 'fight' })).toBeCloseTo(0.6);
    expect(faceFor({ yaw: 0, travel: -Math.PI / 2, speed: 2, mode: 'fight' })).toBeCloseTo(-0.6);
    expect(faceFor({ yaw: 0, travel: Math.PI, speed: 2, mode: 'fight' })).toBe(Math.PI);
    expect(faceFor({ yaw: 0, travel: Math.PI, speed: 2, mode: 'fight', firing: true })).toBeCloseTo(0.6);
  });

  it('a rigged figure keeps facing its target (its hips turn to its travel, its clips walk it sideways)', () => {
    expect(faceFor({ yaw: 0, travel: Math.PI / 2, speed: 2, mode: 'fight', rigged: true })).toBe(0);
  });
});

describe('where a soldier coming back runs in from (runInFrom)', () => {
  it('a way back from where it comes on, behind the way it faces', () => {
    const [x, z] = runInFrom(5, 5, 0, { back: 10 });
    expect(x).toBeCloseTo(5);
    expect(z).toBeCloseTo(-5);
  });

  it('never from inside a wall, a rock or past the world’s edge', () => {
    const solids = createSolids();
    solids.box(0, -4, 6, 0.5);
    const [, z] = runInFrom(0, 0, 0, { solids, back: 10 });
    expect(z).toBeGreaterThan(-3.5);
    expect(z).toBeLessThanOrEqual(0);
    const [ex, ez] = runInFrom(95, 0, -Math.PI / 2, { reach: 100, back: 10 });
    expect(Math.hypot(ex, ez)).toBeLessThanOrEqual(100);
  });
});

// ── the scene's bodies, on a flat world with the figures above ──
const MAP = {
  id: 'assault',
  kind: 'assault',
  name: 'A test battle',
  sides: {
    attack: { id: 'empire', name: 'The Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] },
    defend: { id: 'rebels', name: 'The Rebellion', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] },
  },
  posts: [
    { id: 'line', name: 'The line', at: [-60, 0], r: 20, fixed: 'attack' },
    { id: 'a', name: 'Post A', at: [0, 0], r: 16 },
    { id: 'base', name: 'The base', at: [120, 0], r: 20, fixed: 'defend' },
  ],
  phases: [{ name: 'The front', posts: ['a'], tickets: 60 }],
  tickets: { attack: 60, defend: 90 },
  forward: 20,
  stars: [300, 480],
};

describe('the battle’s bodies, drawn (createAssaultMission)', () => {
  const was = globalThis.document;
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => {} });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  });
  afterAll(() => {
    globalThis.document = was;
  });

  const make = async () => {
    figs.length = 0;
    const world = { heightAt: () => 0, solids: createSolids(), reach: 600 };
    const m = createAssaultMission({ parent: new THREE.Group(), world, blaster: { tracer() {}, enemy() {} }, mission: MAP, emit() {}, say() {}, sounds: {}, tier: 'low' });
    m.begin();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    m.chooseSide('attack');
    return m;
  };
  const holderOf = (fig) => fig.model.parent;
  const DT = 1 / 30;

  it('moves every figure’s feet by the ground it covers: the motion each is given is what it’s drawn doing', async () => {
    const m = await make();
    expect(figs.length).toBe(12);
    const last = new Map();
    let checked = 0;
    for (let i = 0; i < 30 * 20; i++) {
      for (const { fig } of figs) fig.calls.length = 0;
      m.update(DT, { x: -40, z: 0 });
      for (const { fig } of figs) {
        const h = holderOf(fig);
        const was = last.get(fig);
        last.set(fig, h.visible ? h.position.clone() : null);
        const u = fig.calls.find((c) => c[0] === 'update');
        if (!u || !was || !h.visible) continue;
        const moved = Math.hypot(h.position.x - was.x, h.position.z - was.z) / DT;
        const said = Math.hypot(u[1].speed, u[1].side);
        expect(Math.abs(moved - said), `${moved} drawn, ${said} told`).toBeLessThan(0.05);
        // (and nobody's ever seen to leap: running in, at most the walk and the catching up)
        expect(moved).toBeLessThan(RULES.walk + 4.5 + 2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('a figure with clips fires with its arms (react fire) and looks at what it fires at; one shot falls by its own clip, upright, and is gone', async () => {
    const m = await make();
    for (let i = 0; i < 30 * 40; i++) m.update(DT, { x: -40, z: 0 });
    const troopers = figs.filter((f) => f.kind === 'snowtrooper').map((f) => f.fig);
    const all = troopers.flatMap((f) => f.calls);
    expect(all.some((c) => c[0] === 'react' && c[1] === 'fire' && Number.isFinite(c[2].target.x))).toBe(true);
    expect(all.some((c) => c[0] === 'look' && c[1] && Number.isFinite(c[1].x))).toBe(true);
    // one of them shot down, aiming: its arms let go first, then its fall
    const lastOf = (x, test) => x.calls.findLastIndex(test);
    const aiming = (x) => lastOf(x, (c) => c[0] === 'react' && c[1] === 'fire') > lastOf(x, (c) => c[0] === 'stop' && c[1] === 'upper');
    const f = troopers.find((x) => holderOf(x).visible && aiming(x));
    expect(f).toBeTruthy();
    const id = figs.findIndex((x) => x.fig === f);
    f.calls.length = 0;
    m.hit({ id }, 999);
    const down = f.calls.find((c) => c[0] === 'react' && c[1] === 'down');
    expect(down).toBeTruthy();
    expect(f.calls.findIndex((c) => c[0] === 'stop' && c[1] === 'upper')).toBeGreaterThan(-1);
    expect(f.calls.findIndex((c) => c[0] === 'stop' && c[1] === 'upper')).toBeLessThan(f.calls.indexOf(down));
    expect(Number.isFinite(down[2].yaw)).toBe(true);
    for (let k = 0; k < 30; k++) m.update(DT, null);
    expect(holderOf(f).rotation.x).toBe(0);
    expect(holderOf(f).visible).toBe(true);
    for (let k = 0; k < 30 * FALL.gone; k++) m.update(DT, null);
    expect(holderOf(f).visible).toBe(false);
  });

  it('a statue shot falls away from the shot about its own side, whichever way it faces, and isn’t moved while it lies', async () => {
    const m = await make();
    const me = m.deploy('line');
    expect(me).toBeTruthy();
    for (let i = 0; i < 30 * 30; i++) m.update(DT, me);
    const statues = figs.filter((f) => f.kind === 'hothtrooper' && holderOf(f.fig).visible).map((f) => f.fig);
    expect(statues.length).toBeGreaterThan(1);
    for (const f of statues.slice(0, 3)) {
      const id = figs.findIndex((x) => x.fig === f);
      const h = holderOf(f);
      const at = h.position.clone();
      m.hit({ id }, 999);
      f.calls.length = 0;
      for (let k = 0; k < 30; k++) m.update(DT, me);
      expect(h.rotation.order).toBe('YXZ');
      expect(Math.abs(h.rotation.x)).toBeGreaterThan(1.3);
      // (its head away from you, who shot it)
      const head = new THREE.Vector3(0, 1, 0).applyEuler(h.rotation);
      expect(head.x * (at.x - me.x) + head.z * (at.z - me.z)).toBeGreaterThan(0);
      expect(f.calls.some((c) => c[0] === 'update')).toBe(false);
    }
  });
});
