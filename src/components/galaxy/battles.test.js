import { describe, expect, it } from 'vitest';
import { createBattle } from '../universe/battle';
import { SUBSYSTEMS } from '../universe/wars';
import { GALAXY_KINDS } from './fleet';
import { MODELS } from './models';
import { BUILT_KINDS } from '../universe/trafficModels';
import { WAR_SYSTEMS } from './gcw';
import { systemById } from './systems';
import { SIZE, TEMPLATES, layBattle, obstacles, templateFor } from './battles';

const KNOWN = new Set([...Object.keys(MODELS), ...GALAXY_KINDS, ...BUILT_KINDS]);
const fake = (sys, attacker = 'rebel', seed = 7) => ({ id: `c0.${sys}.3`, sys, step: 3, seed, attacker, start: 0, fightEnd: 600e3, end: 720e3, fighting: true });

describe('the battles’ templates', () => {
  it('has the set pieces’ own, and one for every system in the war', () => {
    for (const id of ['endor', 'hoth', 'scarif', 'yavin', 'coruscant']) expect(TEMPLATES[id], id).toBeTruthy();
    for (const id of WAR_SYSTEMS) expect(templateFor(id).name, id).toMatch(/\S/);
  });
  it('builds every ship from a model the galaxy has, at the galaxy’s sizes', () => {
    for (const id of WAR_SYSTEMS)
      for (const side of ['rebels', 'empire']) {
        const t = templateFor(id)[side];
        for (const c of [t.flagship, ...t.escorts]) {
          expect(KNOWN.has(c.kind), `${id} ${side} ${c.kind}`).toBe(true);
          expect(c.size, `${id} ${c.kind}`).toBe(c.size ?? SIZE[c.kind]);
          expect(c.size).toBeGreaterThan(0);
        }
        for (const f of templateFor(id).fighters[side]) expect(KNOWN.has(f.kind), `${id} ${f.kind}`).toBe(true);
      }
  });
  it('puts in a flagship with objectives, and four to seven escorts', () => {
    for (const id of WAR_SYSTEMS)
      for (const side of ['rebels', 'empire']) {
        const t = templateFor(id)[side];
        expect(SUBSYSTEMS[t.flagship.kind], `${id} ${side}`).toBeTruthy();
        expect(t.escorts.length, `${id} ${side}`).toBeGreaterThanOrEqual(4);
        expect(t.escorts.length).toBeLessThanOrEqual(7);
      }
  });
  it('has the Executor at Endor and Hoth, two Star Destroyers at Scarif', () => {
    expect(TEMPLATES.endor.empire.flagship.kind).toBe('executor');
    expect(TEMPLATES.hoth.empire.flagship.kind).toBe('executor');
    expect([TEMPLATES.scarif.empire.flagship, ...TEMPLATES.scarif.empire.escorts].filter((c) => c.kind === 'destroyer')).toHaveLength(2);
  });
});

describe('obstacles', () => {
  it('has the planet, a little over its size', () => {
    const sys = systemById('hoth');
    const o = obstacles(sys);
    expect(o[0].c).toEqual({ x: 0, y: 0, z: 0 });
    expect(o[0].r).toBeGreaterThan(sys.body.r);
  });
  it('has the second Death Star’s shield at Endor', () => {
    const o = obstacles(systemById('endor'));
    expect(o.some((s) => s.r > 80 && Math.hypot(s.c.x, s.c.y, s.c.z) > systemById('endor').body.r)).toBe(true);
  });
});

describe('layBattle', () => {
  it('is laid out alike for everyone, from the battle’s seed', () => {
    expect(layBattle(systemById('endor'), fake('endor'))).toEqual(layBattle(systemById('endor'), fake('endor')));
  });
  it('has the Rebels attacking at a front and the Empire at an attack', () => {
    expect(layBattle(systemById('scarif'), fake('scarif', 'rebel')).attacker).toBe(0);
    expect(layBattle(systemById('hoth'), fake('hoth', 'empire')).attacker).toBe(1);
  });
  it('fights it off the planet: every capital ship clear of the planet and its stations', () => {
    for (const id of WAR_SYSTEMS) {
      const sys = systemById(id);
      for (const seed of [1, 2, 3]) {
        const o = layBattle(sys, fake(id, 'rebel', seed));
        const b = createBattle({ ...o, perSide: 0 });
        for (const cap of b.capitals)
          for (const ob of obstacles(sys)) {
            const d = Math.hypot(cap.pos.x - ob.c.x, cap.pos.y - ob.c.y, cap.pos.z - ob.c.z);
            expect(d - cap.size * 0.55, `${id} ${seed} ${cap.kind}`).toBeGreaterThan(ob.r);
          }
      }
    }
  });
  it('sizes the battle to its ships, and gives it the shared clock', () => {
    const o = layBattle(systemById('endor'), { ...fake('endor'), start: 1000, fightEnd: 601000 }, { now: 61000 });
    expect(o.lines).toBeGreaterThanOrEqual(110 * 0.5 + 30);
    expect(o.radius).toBeGreaterThan(o.lines);
    expect(o.clock).toBe(600);
    expect(o.elapsed).toBe(60);
    expect(o.war.sides[0].capitals[0].role).toBe('flagship');
    expect(o.war.name).toBe('The Battle of Endor');
  });
});
