import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig, swingClip, withHands } from '../../lib/three/meshyRig.fixture';
import { gripFrame } from '../../lib/three/held';
import { attend, castDo, drawWatcher, fight, followDrawn, releaseCast, setCastSource, tickCast, upgrade } from './cast3d';
import { makeToyFigure, pose } from './mapFigures';
import { makePerson, sit } from './shire/people';

// The cast's files, as the fixture's figure on Meshy's skeleton (its own
// idle, walk and run): a box at its feet so it has a size, its head where
// Meshy's are.
function source({ fail = false, hands = false } = {}) {
  const rigs = new Map();
  const rigOf = (name) => {
    if (!rigs.has(name)) {
      const r = hands ? withHands(meshyRig()) : meshyRig();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), new THREE.MeshStandardMaterial());
      box.position.y = 0.025;
      r.model.add(box);
      rigs.set(name, r);
    }
    return rigs.get(name);
  };
  return async (url) => {
    if (fail) throw new Error('404');
    const m = /cast\/(\w+?)(?:-(idle|walk|run))?\.glb$/.exec(url);
    const r = rigOf(m[1]);
    if (!m[2]) return { scene: r.model, animations: [] };
    return { scene: new THREE.Group(), animations: [r.clips[m[2]]] };
  };
}
const ready = (f) => new Promise((r) => f.cast.onReady(r));
const DT = 1 / 60;

describe('the cast on the toys', () => {
  beforeEach(() => setCastSource({ load: source(), on: true }));
  afterEach(() => {
    releaseCast(null);
    setCastSource({ on: false });
  });

  it('a toy at once, and the cast in its place once its model is here, as tall', async () => {
    const f = makePerson('frodo');
    expect(f.cast.name).toBe('frodo');
    expect(f.cast.ready).toBe(false);
    expect(f.body.visible).toBe(true);
    // the toy still poses while it waits
    pose(f, 0.1, { moving: true });
    expect(f.legs[0].rotation.z).not.toBe(0);
    await ready(f);
    expect(f.body.visible).toBe(false);
    expect(f.legs.every((l) => !l.visible)).toBe(true);
    // the head's top where the toy's was
    const { model } = f.cast.body;
    model.updateMatrixWorld(true);
    const crown = model.getObjectByName('head_end').getWorldPosition(new THREE.Vector3());
    f.group.updateMatrixWorld(true);
    const toyTop = f.head.getWorldPosition(new THREE.Vector3()).y + 0.29;
    expect(crown.y).toBeCloseTo(toyTop, 1);
  });

  it('faces the toy’s way (+x)', async () => {
    const f = makePerson('sam');
    await ready(f);
    const q = f.cast.body.holder.getWorldQuaternion(new THREE.Quaternion());
    const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(ahead.x).toBeCloseTo(1, 5);
  });

  it('walks by the ground it covers: idle standing, the walk going, the stride paced to the ground', async () => {
    const scene = new THREE.Scene();
    const f = makePerson('pippin');
    scene.add(f.group);
    await ready(f);
    const { anim } = f.cast.body;
    for (let i = 0; i < 30; i++) tickCast(scene, null, DT);
    expect(anim.actions.idle.getEffectiveWeight()).toBeGreaterThan(0.95);
    // a walk's pace along +x
    const v = f.cast.body.walkV;
    const at = [];
    for (let i = 0; i < 90; i++) {
      f.group.position.x += v * DT;
      tickCast(scene, null, DT);
      at.push(anim.actions.walk.time);
    }
    expect(anim.actions.walk.getEffectiveWeight()).toBeGreaterThan(0.5);
    expect(f.cast.body.m.speed).toBeCloseTo(v, 1);
    // the clip held where the ground says (not run on its own clock)
    expect(anim.actions.walk.timeScale).toBe(0);
    expect(new Set(at.slice(-10)).size).toBeGreaterThan(5);
  });

  it('two of one figure don’t step or breathe together', async () => {
    const a = makePerson('guest', { guest: 0 });
    const b = makePerson('guest', { guest: 3 });
    await Promise.all([ready(a), ready(b)]);
    expect(a.cast.body.anim.actions.idle.time).not.toBeCloseTo(b.cast.body.anim.actions.idle.time, 3);
  });

  it('a jump to somewhere new isn’t a run, and a turn is read', async () => {
    const scene = new THREE.Scene();
    const f = makePerson('merry');
    scene.add(f.group);
    await ready(f);
    tickCast(scene, null, DT);
    f.group.position.x += 30;
    tickCast(scene, null, DT);
    expect(Math.abs(f.cast.body.m.speed)).toBeLessThan(0.01);
    for (let i = 0; i < 30; i++) {
      f.group.rotation.y += 2 * DT;
      tickCast(scene, null, DT);
    }
    expect(f.cast.body.m.turn).toBeGreaterThan(1.5);
  });

  it('a line plays: talk on the upper body while it lasts; a wave on the map’s greeting', async () => {
    const scene = new THREE.Scene();
    const f = makePerson('bilbo');
    scene.add(f.group);
    await ready(f);
    const { anim } = f.cast.body;
    const clip = swingClip({ bones: {}, rest: {} }, 'x', 1, () => 0);
    for (const n of ['talk', 'talk.open', 'talk.right', 'wave']) anim.add(n, clip.clone());
    pose(f, 0, { talk: 1 });
    tickCast(scene, null, DT);
    await null;
    expect(anim.playing('upper')).toBe(f.cast.talkClip);
    pose(f, 0, { talk: 0 });
    for (let i = 0; i < 30; i++) tickCast(scene, null, DT);
    expect(anim.playing('upper')).toBeNull();
    pose(f, 0, { wave: 1 });
    tickCast(scene, null, DT);
    expect(anim.playing('upper')).toBe('wave');
  });

  it('sits where the toy sat: its hips at the toy’s hips', async () => {
    const scene = new THREE.Scene();
    const f = makePerson('sam');
    scene.add(f.group);
    await ready(f);
    const { anim, model, holder } = f.cast.body;
    // a sit that drops the hips 70 cm (lower than the toy's seat: it's lifted to it)
    const rig = { bones: {}, rest: {} };
    model.traverse((o) => {
      if (o.isBone) {
        rig.bones[o.name] = o;
        rig.rest[o.name] = { turn: o.quaternion.clone(), at: o.position.clone(), parent: o.parent.getWorldQuaternion(new THREE.Quaternion()) };
      }
    });
    anim.add('sit.idle', swingClip(rig, 'sit.idle', 2, () => 0, { hips: () => -70 }));
    sit(f, true);
    // (the library's way in is asked for and doesn't come, in Node: a moment)
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < 60; i++) tickCast(scene, null, DT);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(anim.loco).toBeTruthy();
    model.updateMatrixWorld(true);
    const hips = model.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
    // within a few centimetres above the toy's hip (the cushion it sits on)
    expect(hips.y - f.baseY).toBeGreaterThan(0);
    expect(hips.y - f.baseY).toBeLessThan(0.15);
    expect(holder.position.y).toBeGreaterThan(0);
    sit(f, false);
    for (let i = 0; i < 120; i++) tickCast(scene, null, DT);
    expect(holder.position.y).toBeCloseTo(0, 2);
  });

  it('Frodo’s Ring goes to the cast’s chest, still shown and hidden by the towns', async () => {
    const f = makePerson('frodo');
    const ring = f.ringMesh;
    await ready(f);
    let o = ring.parent;
    while (o && !o.isBone) o = o.parent;
    expect(o?.name).toBe('Spine02');
    ring.visible = false;
    expect(f.ringMesh.visible).toBe(false);
  });

  it('turns its head to the walker and the body only past what a neck can do; a toy turns itself', async () => {
    const toy = makeToyFigure();
    attend(toy, { x: 0, z: -3 }, 0, 0.1);
    expect(toy.group.rotation.y).toBeGreaterThan(0); // round toward −z
    const f = makePerson('rosie');
    await ready(f);
    // a little off its facing: the head goes, the body stays
    attend(f, { x: 3, z: -1 }, 0, 0.1);
    expect(f.group.rotation.y).toBe(0);
    expect(f.cast.want.look).toEqual({ x: 3, z: -1 });
    // behind it: the body comes round, over time
    attend(f, { x: -3, z: 0.2 }, 0, 0.1);
    const y1 = f.group.rotation.y;
    expect(Math.abs(y1)).toBeGreaterThan(0);
    expect(Math.abs(y1)).toBeLessThan(1.2);
    // gone: the look let go
    attend(f, { x: 30, z: 0 }, 0, 0.1);
    expect(f.cast.want.look).toBeNull();
  });

  it('the toy stays when the model doesn’t come', async () => {
    setCastSource({ load: source({ fail: true }), on: true });
    const f = makePerson('sam');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(f.cast.ready).toBe(false);
    expect(f.body.visible).toBe(true);
    pose(f, 0.2, { moving: true });
    expect(f.legs[0].rotation.z).not.toBe(0);
  });

  it('nobody’s on the cast when it’s off (Node, ?cast=0, a phone saving data)', () => {
    setCastSource({ on: false });
    expect(makePerson('frodo').cast).toBeUndefined();
  });

  it('let go with its scene', async () => {
    const scene = new THREE.Scene();
    const f = upgrade(makeToyFigure(), 'elf');
    scene.add(f.group);
    await ready(f);
    releaseCast(scene);
    expect(f.cast.disposed).toBe(true);
    expect(f.cast.body).toBeNull();
  });

  // clips a figure can play here (Node fetches no library files): a still pose by each name
  const give = (f, names) => {
    const clip = swingClip({ bones: {}, rest: {} }, 'x', 0.5, () => 0);
    for (const n of names) f.cast.body.anim.add(n, clip.clone());
  };

  it('what the toy held goes to the cast’s hands: Gandalf’s staff', async () => {
    const f = makePerson('gandalf');
    const staff = f.arms[1].children.find((o) => !o.isMesh && o.children.length);
    expect(staff).toBeTruthy();
    await ready(f);
    expect(staff.parent?.name).toBe('RightHand');
    expect(staff.visible).toBe(true);
    expect(f.cast.holds.map((h) => h.kind)).toEqual(['staff']);
  });

  describe('in the cast’s hands (a figure whose hands have skin)', () => {
    beforeEach(() => setCastSource({ load: source({ hands: true }), on: true }));
    const V = THREE.Vector3;
    const staffOf = (f) => f.arms[1].children.find((o) => o.userData.held?.kind === 'staff');
    // the right palm's middle in the world, from the cast's own hand
    const palm = (f, side = 'RightHand') => {
      const { model } = f.cast.body;
      const hand = model.getObjectByName(side);
      model.updateMatrixWorld(true);
      return gripFrame(model, hand, { left: side === 'LeftHand' }).mean.clone().applyMatrix4(hand.matrixWorld);
    };
    const gripAt = (o) => o.getObjectByName('grip').getWorldPosition(new V());
    // the shaft's length in the world: its mesh's own y, as far as the world sees it
    const lengthOf = (o) => {
      const shaft = o.children.find((m) => m.isMesh);
      return new V(0, shaft.geometry.parameters.height, 0).applyMatrix4(shaft.matrixWorld).distanceTo(new V().applyMatrix4(shaft.matrixWorld));
    };

    it('Gandalf’s staff: its grip in the cast’s right palm, standing and walking', async () => {
      const scene = new THREE.Scene();
      const f = makePerson('gandalf');
      scene.add(f.group);
      const staff = staffOf(f);
      await ready(f);
      tickCast(scene, null, DT);
      expect(gripAt(staff).distanceTo(palm(f))).toBeLessThan(0.01 + 0.012);
      const v = f.cast.body.walkV;
      for (let i = 0; i < 30; i++) {
        f.group.position.x += v * DT;
        tickCast(scene, null, DT);
      }
      expect(gripAt(staff).distanceTo(palm(f))).toBeLessThan(0.01 + 0.012);
    });

    it('the staff stays near upright while walking (a still, upright carry)', async () => {
      const scene = new THREE.Scene();
      const f = makePerson('gandalf');
      scene.add(f.group);
      const staff = staffOf(f);
      await ready(f);
      const v = f.cast.body.walkV;
      let worst = 0;
      for (let i = 0; i < 60; i++) {
        f.group.position.x += v * DT;
        tickCast(scene, null, DT);
        if (i > 20) worst = Math.max(worst, new V(0, 1, 0).transformDirection(staff.matrixWorld).angleTo(new V(0, 1, 0)));
      }
      expect(worst).toBeLessThan(0.25);
    });

    it('as long in the cast’s hand as in the toy’s', async () => {
      const f = makePerson('gandalf');
      const staff = staffOf(f);
      f.group.updateMatrixWorld(true);
      const toy = lengthOf(staff);
      await ready(f);
      f.cast.body.model.updateMatrixWorld(true);
      expect(lengthOf(staff)).toBeCloseTo(toy, 2);
    });

    it('Legolas’s bow goes to his left hand', async () => {
      const f = upgrade(makeToyFigure({ item: 'bow' }), 'legolas');
      const bow = f.arms[1].children.find((o) => o.userData.held?.kind === 'bow');
      expect(bow).toBeTruthy();
      await ready(f);
      expect(bow.parent?.name).toBe('LeftHand');
    });

    it('let go, the staff goes back to the toy’s arm', async () => {
      const f = makePerson('gandalf');
      const staff = staffOf(f);
      const arm = staff.parent;
      const at = staff.position.clone();
      await ready(f);
      expect(staff.parent?.name).toBe('RightHand');
      f.cast.dispose();
      expect(staff.parent).toBe(arm);
      expect(staff.position.distanceTo(at)).toBeLessThan(1e-9);
      expect(staff.userData.held.kind).toBe('staff');
    });
  });

  it('a toy whose model doesn’t come keeps its staff in its own hand', async () => {
    setCastSource({ load: source({ fail: true }), on: true });
    const f = makePerson('gandalf');
    const staff = f.arms[1].children.find((o) => o.userData.held?.kind === 'staff');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(f.cast.ready).toBe(false);
    expect(staff.parent).toBe(f.arms[1]);
    expect(f.cast.holds).toEqual([]);
  });

  it('every toy’s item says what kind it is and where it’s held', () => {
    for (const item of ['staff', 'white-staff', 'bow', 'axe', 'sword', 'horn']) {
      const f = makeToyFigure({ item });
      const it = f.arms[1].children.find((o) => o.userData.held);
      expect(it?.userData.held.kind).toBe(item);
      expect(it.getObjectByName('grip')).toBeTruthy();
    }
  });

  it('a greeting once as the walker comes near, again only after they’ve gone', async () => {
    const scene = new THREE.Scene();
    const f = makePerson('merry');
    scene.add(f.group);
    await ready(f);
    give(f, ['wave']);
    const played = [];
    const play = f.cast.play;
    f.cast.play = (clip, o) => (played.push(clip), play(clip, o));
    attend(f, { x: 2, z: 0 }, 0, 0.1);
    attend(f, { x: 1.8, z: 0 }, 0, 0.1);
    expect(played).toEqual(['wave']);
    attend(f, { x: 9, z: 0 }, 0, 0.1);
    for (let i = 0; i < 40; i++) tickCast(scene, null, 0.05);
    await new Promise((r) => setTimeout(r, 0));
    attend(f, { x: 2, z: 0 }, 0, 0.1);
    expect(played).toEqual(['wave', 'wave']);
  });

  it('knocked down: a flinch first, then the fall, held; up again after', async () => {
    const scene = new THREE.Scene();
    const f = upgrade(makeToyFigure(), 'breeman');
    scene.add(f.group);
    await ready(f);
    give(f, ['hit.chest', 'knockdown', 'arise']);
    const { anim } = f.cast.body;
    castDo(f, { down: true, flinch: 'hit.chest', fall: 'knockdown' });
    tickCast(scene, null, 0.02);
    await null;
    expect(anim.playing('full')).toBe('hit.chest');
    for (let i = 0; i < 40; i++) {
      tickCast(scene, null, 0.05);
      await null;
    }
    expect(anim.playing('full')).toBe('knockdown');
    // never tipped over as a whole: the group stays upright
    expect(f.group.rotation.z).toBe(0);
    castDo(f, { down: false });
    tickCast(scene, null, 0.02);
    await null;
    expect(anim.playing('full')).toBe('arise');
  });

  it('a fighter turns to its foe over time and strikes on its own beat, only drawn', async () => {
    const scene = new THREE.Scene();
    const a = upgrade(makeToyFigure(), 'goblin');
    const b = upgrade(makeToyFigure(), 'aragorn');
    b.group.position.set(0, 0, -2); // (to a's left)
    scene.add(a.group, b.group);
    await Promise.all([ready(a), ready(b)]);
    give(a, ['jab', 'cross', 'kick', 'jab.guard']);
    let struck = 0;
    for (let i = 0; i < 120; i++) {
      if (fight(a, b, 1 / 30)) struck++;
      tickCast(scene, null, 1 / 30);
    }
    expect(a.group.rotation.y).toBeCloseTo(Math.PI / 2, 1);
    expect(struck).toBeGreaterThan(0);
    expect(struck).toBeLessThan(5);
    expect(a.cast.want.look).toBe(b.group);
    // a toy doesn't fight
    expect(fight(makeToyFigure(), b, 0.1)).toBe(false);
  });

  it('two of a kind in one scrap keep their own beats', async () => {
    const scene = new THREE.Scene();
    const foe = makeToyFigure();
    const gs = [upgrade(makeToyFigure(), 'goblin', { seed: 1 }), upgrade(makeToyFigure(), 'goblin', { seed: 2 })];
    scene.add(foe.group, ...gs.map((g) => g.group));
    await Promise.all(gs.map(ready));
    gs.forEach((g) => give(g, ['jab', 'cross', 'kick', 'jab.guard']));
    const at = [[], []];
    for (let i = 0; i < 300; i++) {
      gs.forEach((g, k) => fight(g, foe, 1 / 30) && at[k].push(i));
      tickCast(scene, null, 1 / 30);
      await null;
    }
    expect(at[0].length).toBeGreaterThan(1);
    expect(at[0]).not.toEqual(at[1]);
  });

  it('a watcher on the cast: searching walks with its head going, a shout on seeing you, a blow on catching you', async () => {
    const f = upgrade(makeToyFigure(), 'uruk');
    await ready(f);
    const you = makeToyFigure();
    const seen = [];
    const play = f.cast.play;
    f.cast.play = (clip, o) => (seen.push([clip, o.layer]), play(clip, o));
    expect(drawWatcher(f, { mode: 'search', goal: [3, 3] }, 0.1)).toBe(true);
    expect(f.cast.want.upper).toBe('walk.search');
    drawWatcher(f, { mode: 'patrol', wait: 1, look: 0.8 }, 0.1);
    expect(f.cast.want.look).toMatchObject({ x: expect.any(Number), z: expect.any(Number) });
    drawWatcher(f, { mode: 'alert' }, 0.1, { you });
    drawWatcher(f, { mode: 'chase' }, 0.1, { you });
    drawWatcher(f, { mode: 'chase' }, 0.1, { you });
    drawWatcher(f, { mode: 'caught' }, 0.1, { you });
    drawWatcher(f, { mode: 'caught' }, 0.1, { you });
    expect(seen).toEqual([
      ['shout', 'upper'],
      ['cross', 'full'],
    ]);
    expect(f.cast.want.look).toBe(you);
    expect(drawWatcher(makeToyFigure(), { mode: 'chase' }, 0.1)).toBe(false);
  });

  it('a follower is drawn walking to its place in the line, not set on it', () => {
    const p = makeToyFigure();
    p.group.name = 'sam';
    followDrawn(p, { x: 0, z: 0, face: 0 }, 1 / 60);
    let d = null;
    for (let i = 1; i <= 30; i++) d = followDrawn(p, { x: i * 0.05, z: 0, face: 0 }, 1 / 60);
    // behind its place, catching up at about the line's pace
    expect(d.x).toBeLessThan(1.5);
    expect(d.x).toBeGreaterThan(0.6);
    // somewhere new, far off: there at once
    d = followDrawn(p, { x: 50, z: 0, face: 0 }, 1 / 60);
    expect(d.x).toBe(50);
  });

  it('shows the toy in its place when asked (the hobbits as rocks under their cloaks), and the cast after', async () => {
    const f = makePerson('sam');
    await ready(f);
    f.cast.showToy(true);
    expect(f.body.visible).toBe(true);
    expect(f.cast.body.holder.visible).toBe(false);
    f.cast.showToy(false);
    expect(f.body.visible).toBe(false);
    expect(f.cast.body.holder.visible).toBe(true);
  });
});
