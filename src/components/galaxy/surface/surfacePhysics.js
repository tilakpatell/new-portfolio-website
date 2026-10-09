// The surface's world as Rapier sees it: the ground (heightfield tiles
// sampled from the same `heightAt` the walker reads), every solid the
// walker stops at (placer's circles as cylinders, its boxes as cuboids,
// each standing from its base to its top), the floors over the land
// (discs and boxes at their height), a floor at knee depth under any
// water, with the queries over them (the
// eyes: lib/physics/queries.js, on the tier's budget) and the one line of
// sight every brain asks (`seesThrough`: a ray from eyes to chest; a ray
// the budget refuses answers what it answered last for that pair, never
// "clear"). A solid added after building (placer places some late) is
// added through the solids' `onAdd`. Tagged solids and floors can be
// turned off and on (`toggle`: a gate lifted, a trapdoor opened). Stepped
// once after building, since Rapier answers nothing before its first
// step. Wiring beside scene.js; tested in Node against the engine.
//
//   createSurfacePhysics(world, { reach = world.reach ?? 160, spacing = 2, tier, budget }) → Promise<sp>
//     world: scene.js's { heightAt, normalAt, solids (walker's createSolids), floors, reach }
//   sp: { world, phys, q, qb (the bolts' queries, 96 rays a frame), SIGHT, step(dt), seesThrough(a, b) → bool, addSolid(s) → Body, byTag (Map tag → [Body]),
//     toggle(tag, on), dispose() }
//   budgetFor(tier) → { rays, sweeps, overlaps }

import { createPhysics } from '../../../lib/physics/world';
import { addHeightfield } from '../../../lib/physics/heightfield';
import { createQueries } from '../../../lib/physics/queries';
import { createBudget } from '../../../lib/physics/budget';
import { filterOf } from '../../../lib/physics/groups';
import { CHARACTER } from '../../../lib/physics/character';

const TILE = 64; // m: a heightfield tile
const TALL = 50; // m: a solid with no top stands this high
const FLOOR_T = 0.05; // m: half a floor's thickness
const WADE = 0.85; // m: how deep anyone wades (walker.js's WALK.wade)
const EYES = 1.5;
const CHEST = 1.1;
const KEPT = 256; // sight answers remembered for refused rays
const FRICTION = 0.6;
const SIGHT = filterOf('floor', 'object');
const BOLT_RAYS = 96; // a frame: every live bolt's, and the aim's
const BUDGETS = { high: { rays: 24, sweeps: 8, overlaps: 4 }, mid: { rays: 16, sweeps: 6, overlaps: 3 }, low: { rays: 10, sweeps: 4, overlaps: 2 } };

export const budgetFor = (tier) => ({ ...(BUDGETS[tier] ?? BUDGETS.mid) });
const yawQ = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

export async function createSurfacePhysics(world, { reach = world.reach ?? 160, spacing = 2, tier = 'mid', budget = null } = {}) {
  const phys = await createPhysics({ gravity: -CHARACTER.gravity, maxSubsteps: 4, lost: (p) => p[1] < world.heightAt(p[0], p[2]) - 50 });
  const q = createQueries(phys, { budget: createBudget(budget ?? budgetFor(tier)) });
  // (the bolts' own rays, on their own budget: a bolt's flight is never refused for a brain's look)
  const qb = createQueries(phys, { budget: createBudget({ rays: BOLT_RAYS, sweeps: 0, overlaps: 0 }) });
  const byTag = new Map();
  const tagged = (tag, body) => {
    if (tag == null) return;
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(body);
  };

  // the ground, a tile at a time
  const n = Math.round(TILE / spacing) + 1;
  const tiles = Math.max(1, Math.ceil((2 * reach) / TILE));
  const x0 = -tiles * (TILE / 2);
  for (let tz = 0; tz < tiles; tz++)
    for (let tx = 0; tx < tiles; tx++) {
      const ox = x0 + tx * TILE;
      const oz = x0 + tz * TILE;
      const heights = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) heights[iz * n + ix] = world.heightAt(ox + ix * spacing, oz + iz * spacing);
      addHeightfield(phys, { heights, n, size: TILE, x: ox, z: oz, friction: FRICTION });
    }

  const ground = (x, z) => world.heightAt(x, z);
  function addSolid(s) {
    const g = ground(s.x, s.z);
    const base = s.base ?? g - 1; // (a little under the ground: nothing slips beneath a trunk)
    const top = s.top ?? g + TALL;
    const h = Math.max(0.01, (top - base) / 2);
    const desc = { type: 'fixed', position: [s.x, base + h, s.z], group: 'object', friction: FRICTION, enabled: !s.off };
    if (s.type === 'circle') desc.colliders = [{ shape: 'cylinder', args: [h, s.r] }];
    else {
      desc.rotation = yawQ(Math.atan2(s.s, s.c));
      desc.colliders = [{ shape: 'cuboid', args: [s.hw, h, s.hd] }];
    }
    const body = phys.add(desc);
    tagged(s.tag, body);
    return body;
  }
  function addFloor(f) {
    const desc = { type: 'fixed', position: [f.x, f.y - FLOOR_T, f.z], group: 'floor', friction: FRICTION, enabled: !f.off };
    if (f.r != null) desc.colliders = [{ shape: 'cylinder', args: [FLOOR_T, f.r] }];
    else {
      desc.rotation = yawQ(f.yaw ?? 0);
      desc.colliders = [{ shape: 'cuboid', args: [f.hw, FLOOR_T, f.hd] }];
    }
    const body = phys.add(desc);
    tagged(f.tag, body);
    return body;
  }
  for (const s of world.solids?.all ?? []) addSolid(s);
  for (const f of world.floors ?? []) addFloor(f);
  // water: a floor at knee depth under it, so nobody walks the seabed (the walker's clamp)
  if (world.water != null) phys.add({ type: 'fixed', position: [0, world.water - WADE - FLOOR_T, 0], group: 'floor', friction: FRICTION, colliders: [{ shape: 'cuboid', args: [tiles * TILE, FLOOR_T, tiles * TILE] }] });
  const offAdd = world.solids?.onAdd?.(addSolid) ?? null;
  phys.step(1 / 60);

  // the line of sight, with what it last said for a pair the budget refuses
  const kept = new Map();
  const keyOf = (a, b) => `${Math.round(a.x * 2)},${Math.round(a.z * 2)}:${Math.round(b.x * 2)},${Math.round(b.z * 2)}`;
  const from = [0, 0, 0];
  const dir = [0, 0, 0];
  // (from the ground under each: the brains' points carry y 0 as a placeholder, lib/ai's way)
  function seesThrough(a, b) {
    const ay = ground(a.x, a.z) + EYES;
    const by = ground(b.x, b.z) + CHEST;
    from[0] = a.x;
    from[1] = ay;
    from[2] = a.z;
    dir[0] = b.x - a.x;
    dir[1] = by - ay;
    dir[2] = b.z - a.z;
    const d = Math.hypot(dir[0], dir[1], dir[2]);
    if (d < 1e-6) return true;
    dir[0] /= d;
    dir[1] /= d;
    dir[2] /= d;
    const key = keyOf(a, b);
    const h = q.ray(from, dir, d, { groups: SIGHT });
    if (h === undefined) return kept.get(key) ?? false;
    const clear = h === null;
    kept.set(key, clear);
    if (kept.size > KEPT) kept.delete(kept.keys().next().value);
    return clear;
  }

  return {
    world,
    phys,
    q,
    qb,
    SIGHT,
    byTag,
    addSolid,
    seesThrough,
    step(dt) {
      q.frame();
      qb.frame();
      return phys.step(dt);
    },
    toggle(tag, on) {
      for (const body of byTag.get(tag) ?? []) body.enable(on);
    },
    dispose() {
      offAdd?.();
      kept.clear();
      byTag.clear();
      phys.dispose();
    },
  };
}
