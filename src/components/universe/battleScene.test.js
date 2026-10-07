import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { createBattleScene } from './battleScene';
import { WARS } from './wars';

// galaxy/models.js's face, with a box for every ship
const stubModels = () => {
  const slots = [];
  return {
    slots,
    slot(kind, size) {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.2, size), new THREE.MeshBasicMaterial()));
      const s = { kind, size, holder, ready: true };
      slots.push(s);
      return s;
    },
    want() {},
    drop(s) {
      s.holder.removeFromParent();
      slots.splice(slots.indexOf(s), 1);
    },
    update() {},
  };
};

describe('createBattleScene', () => {
  it('draws a battle: a slot for every ship, placed where the battle has it', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 6 });
    draw.show(battle, WARS.starwars);
    expect(models.slots).toHaveLength(battle.fighters.length + battle.capitals.length);
    const cam = new THREE.PerspectiveCamera();
    const events = battle.update(1 / 30, null);
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), events, 0);
    const f = battle.fighters[0];
    const slot = models.slots.find((s) => s.kind === f.kind && s.holder.position.distanceTo(new THREE.Vector3(f.pos.x, f.pos.y, f.pos.z)) < 1e-6);
    expect(slot).toBeTruthy();
    draw.hide();
    expect(models.slots).toHaveLength(0);
    draw.dispose();
  });

  // (the battle steps 1/30 s at a time: drawn where it was at the last step, a
  // fighter would stutter on a faster screen, so it's carried on along its way
  // by the time the step still owes, as the guns' lock has it)
  it('draws a fighter on along its way by the time the battle’s step still owes', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 6 });
    draw.show(battle, WARS.starwars);
    const events = battle.update(0.05, null);
    expect(battle.ahead).toBeGreaterThan(0);
    draw.update(0.05, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), events, 0);
    const f = battle.fighters[0];
    const want = new THREE.Vector3(f.pos.x + f.vel.x * battle.ahead, f.pos.y + f.vel.y * battle.ahead, f.pos.z + f.vel.z * battle.ahead);
    expect(models.slots.some((s) => s.kind === f.kind && s.holder.position.distanceTo(want) < 1e-6)).toBe(true);
    draw.dispose();
  });

  it('shields and marks the ship the objectives are on: an interdiction’s Interdictor, not the flagship', () => {
    const war = WARS.starwars;
    const withInterdictor = { ...war, sides: [war.sides[0], { ...war.sides[1], capitals: [...war.sides[1].capitals, { kind: 'interdictor', role: 'escort', size: 11, hull: 220 }] }] };
    const parent = new THREE.Group();
    const draw = createBattleScene(parent, { models: stubModels(), small: true });
    const battle = createBattle({ war: withInterdictor, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 2, objectivesOn: 'interdictor' });
    const inter = battle.capitals.find((c) => c.kind === 'interdictor');
    draw.show(battle, withInterdictor);
    const shield = parent.children.find((o) => o.material?.uniforms?.uHits);
    expect(shield.visible).toBe(true);
    expect(shield.position.distanceTo(new THREE.Vector3(inter.pos.x, inter.pos.y, inter.pos.z))).toBeLessThan(1e-6);
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), [], 0);
    const marks = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    expect(marks).toHaveLength(2);
    for (const s of inter.subs.filter((x) => x.phase === 1)) expect(marks.some((m) => m.position.distanceTo(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z)) < 1e-6), s.id).toBe(true);
    draw.dispose();
  });

  it('marks every battle’s runners, yours to protect and theirs to stop, where they’re drawn', () => {
    // (only Hoth's transports were marked, by Hoth's set piece: an evacuation
    // at Lothal or a blockade at Bespin had runners nobody could find)
    const parent = new THREE.Group();
    const draw = createBattleScene(parent, { models: stubModels(), small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 0 });
    const ours = battle.addRunner({ team: 0, kind: 'corvette', size: 2.8, hp: 60, from: { x: -40, y: 0, z: 0 }, to: { x: -40, y: 0, z: -150 }, speed: 8 });
    const theirs = battle.addRunner({ team: 1, kind: 'transport', size: 2.2, hp: 34, from: { x: 40, y: 0, z: 0 }, to: { x: 40, y: 0, z: -150 }, speed: 8 });
    draw.show(battle, WARS.starwars);
    const events = battle.update(1 / 30, null);
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), events, 0);
    const marks = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    for (const r of [ours, theirs]) expect(marks.some((m) => m.position.distanceTo(new THREE.Vector3(r.seen.x, r.seen.y, r.seen.z)) < 1e-6), r.kind).toBe(true);
    theirs.alive = false;
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), [], 0);
    const after = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    expect(after.some((m) => m.position.distanceTo(new THREE.Vector3(theirs.seen.x, theirs.seen.y, theirs.seen.z)) < 1e-6)).toBe(false);
    draw.dispose();
  });

  it('breaks the defender’s flagship in two when it goes', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 4 });
    draw.show(battle, WARS.starwars);
    const flag = battle.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    const cam = new THREE.PerspectiveCamera();
    draw.update(0.1, 0, cam, new THREE.Vector3(), [{ type: 'capital', id: flag.id, kind: flag.kind, team: 1, at: { ...flag.pos } }], 0);
    expect(draw.halves).toBe(2);
    draw.dispose();
  });
});
