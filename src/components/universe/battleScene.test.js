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
