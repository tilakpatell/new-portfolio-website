// Minecraft, the farm animals' minds (1.12's tasks, in the game's order of
// priority): swim; panic when hit (EntityAIPanic: run 1.25 × to a spot
// within 5 until there); follow a player holding what they eat (EntityAITempt:
// wheat for cows and sheep, seeds for chickens, within 10, stopping 2.5
// off); a sheep grazing (EntityAIEatGrass: 1 in 1000 a tick, 40 ticks head
// down, and the grass under it is dirt and its wool is back); wander; look.
// A chicken lays an egg every 6000 to 12000 ticks.

import { byName } from '../blocks.js';
import { setBlock } from '../build.js';
import { held } from '../inventory.js';
import { look, swim, walkTo, wander, wanderSpot, speedOf } from './ai.js';

const GRASS = byName.get('grass_block').id;
const DIRT = byName.get('dirt').id;
const TALL = new Set(['short_grass', 'fern'].map((n) => byName.get(n).id));
const TEMPT = { cow: ['wheat'], sheep: ['wheat'], pig: ['carrot'], chicken: ['wheat_seeds'] };
const TEMPT_SPEED = { cow: 1.25, sheep: 1.1, pig: 1.2, chicken: 1 };

export function stepAnimal(g, m, events) {
  const a = m.ai;
  const jump = swim(g, m);
  // the hen's egg
  if (m.kind === 'chicken') {
    a.egg ??= 6000 + Math.floor(g.rand() * 6000);
    if (--a.egg <= 0) {
      a.egg = 6000 + Math.floor(g.rand() * 6000);
      events.push({ type: 'lay', id: m.id, x: m.x, y: m.y, z: m.z });
      g.drops.push({ item: 'egg', count: 1, damage: 0, x: m.x, y: m.y + 0.2, z: m.z, vx: 0, vy: 0.1, vz: 0, age: 0 });
    }
  }
  if (a.still) {
    grazing(g, m, events);
    look(g, m);
    return { forward: 0, jump };
  }
  // hit: run
  if (a.panic) {
    a.panicTo ??= { ...(wanderSpot(g, m, 5, 4) ?? { x: m.x, z: m.z }), until: g.ticks + 100 };
    const go = walkTo(g, m, a.panicTo.x, a.panicTo.z, speedOf(m, 1.25));
    if (!go || g.ticks > a.panicTo.until) {
      a.panic = null;
      a.panicTo = null;
    } else return { ...go, jump: go.jump || jump };
  }
  // a player holding what it eats
  const p = g.player;
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  if (!g.dead && d < 10 && TEMPT[m.kind]?.includes(held(g.inventory)?.item)) {
    look.at(m, Math.atan2(-(p.x - m.x), -(p.z - m.z)), 0);
    const go = walkTo(g, m, p.x, p.z, speedOf(m, TEMPT_SPEED[m.kind]), { near: 2.5 });
    return { forward: go?.forward ?? 0, jump: (go?.jump ?? false) || jump };
  }
  if (m.kind === 'sheep' && grazing(g, m, events)) return { forward: 0, jump };
  const go = wander(g, m, speedOf(m));
  look(g, m);
  return { forward: go?.forward ?? 0, jump: (go?.jump ?? false) || jump };
}

// a sheep's head down in the grass; says whether it's grazing
function grazing(g, m, events) {
  if (m.kind !== 'sheep') return false;
  const a = m.ai;
  const x = Math.floor(m.x);
  const y = Math.floor(m.y);
  const z = Math.floor(m.z);
  if (!a.eat) {
    if (g.rand() < 1 / 1000 && (TALL.has(g.world.get(x, y, z)) || g.world.get(x, y - 1, z) === GRASS)) a.eat = 40;
    else return false;
  }
  a.eat--;
  if (a.eat === 4) {
    if (TALL.has(g.world.get(x, y, z))) setBlock(g, x, y, z, 0);
    else if (g.world.get(x, y - 1, z) === GRASS) setBlock(g, x, y - 1, z, DIRT);
    m.sheared = false;
    events.push({ type: 'graze', id: m.id, x: m.x, y: m.y, z: m.z });
  }
  return true;
}
