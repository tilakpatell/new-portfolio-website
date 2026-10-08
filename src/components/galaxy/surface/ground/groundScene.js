// The ground war on a world, composed: who holds which turf (turf.js), the
// soldiers made round you cell by cell (population.js), each stepped by the
// fight (fight.js) on its own body (groundFigures.js), their shots at you
// handed back to the scene for blaster.enemy (so the dodge, the saber and
// the shield rules are yours as ever), and what you can shoot at in the
// same shape as the quests' targets. scene.js makes one and updates it each
// frame. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, sections 4
// to 6 and 10.
//
// createGround({ parent, world, site, effects, tier, kit, warm, blaster,
//   standable, seesThrough, rand }) → { posts, turfs, landed(covertAt),
//   targets, update(dt, you, t, { mate, camera }) → shots at you ({ from,
//   to: [x, z], spread, damage, who }), hit(t, damage, { push, at }),
//   parry(t), knock(t, v), stagger(t, secs), debug(), dispose() }

import { createTokens } from '../../../../lib/ai/squad';
import { liveCount, lodPick } from '../../../../lib/three/lodPick';
import { pushOut } from '../walker';
import { weaponOf } from '../weaponRules';
import { aimError, fightStep, grudge, squadsOf } from './fight';
import { createFigures } from './groundFigures';
import { createPopulation } from './population';
import { damageOf, hurt } from './troops';
import { turfsOf } from './turf';

export const BRAINS = 120; // metres from you past which nobody is stepped (its cell holds it)
export const YOURS = 34; // a soldier's hp a point of your gun's damage is worth (the assault's)
const SQUADS = 0.5; // seconds between the squads' looks at their nerve
const AIM = 2.5; // how wide blaster.enemy's spread is to the fight's aim error
const GAP = 0.15; // seconds between a burst's shots
const PAUSE = [1.1, 2]; // seconds between bursts
// a side's bolts
const BOLT = {
  empire: '#ff3b30',
  remnant: '#ff3b30',
  rebel: '#ff7a3a',
  newrepublic: '#ff7a3a',
  republic: '#4aa8ff',
  separatists: '#ff5a2a',
  hutt: '#ffb34a',
};
const SHOTS = { shot: 3, melee: 1 };
const SCALE = { ultra: 1, high: 1, mid: 0.67, low: 0.67 }; // (the difficulty: every pool at once)

const inert = {
  posts: [],
  turfs: [],
  targets: [],
  landed() {},
  update: () => [],
  hit() {},
  parry: () => ({ parried: false, broke: false }),
  knock() {},
  stagger() {},
  debug: () => [],
  dispose() {},
};

export function createGround({ parent, world, site, effects, tier = 'high', kit = null, warm, blaster = null, standable = () => true, seesThrough = null, rand = Math.random }) {
  if (!effects?.owner || !site?.land?.at || site.noGround) return inert;
  const turfs = turfsOf(site, effects, { standable, height: world.heightAt });
  const figures = createFigures({ parent, world, warm, kit, tier });
  const tokens = createTokens({
    pools: SHOTS,
    scale: SCALE[tier] ?? 1,
    timeout: 0.9,
  });
  let pop = null;
  let squads = null;
  let covertAt = null;
  let clock = 0;
  let squadAt = 0;
  let lastYou = null;
  const lod = new Map();
  const items = [];

  const population = () => {
    if (pop) return pop;
    pop = createPopulation({
      site,
      turfs,
      effects: { ...effects, covertAt },
      tier,
      seed: site.ground?.seed ?? 1,
      rand,
      standable,
    });
    squads = squadsOf(pop.soldiers, { reach: 18, war: effects.war });
    return pop;
  };
  const down = (t, push = null) => {
    figures.fell(t, { push, from: lastYou });
    pop?.died(t.id);
    squads?.died(t.id);
  };
  // (the walk it took, slid along what's solid and never into the water)
  const moved = (s, x, z) => {
    for (const sol of world.solids?.near?.(x, z, 1) ?? []) {
      const p = pushOut(sol, x, z, 0.4);
      if (p) {
        x += p[0];
        z += p[1];
      }
    }
    return standable([x, z]) ? [x, z] : [s.b.x, s.b.z];
  };
  // a soldier's shot at another: a bolt between them, and a hit by its aim (PR 3 flies it)
  const between = (t, v, from, spread, dist) => {
    const s = t.soldier;
    const to = [v.soldier.b.x, v.holder.position.y + 1.1, v.soldier.b.z];
    blaster?.tracer(from, to, BOLT[s.side] ?? '#ff3b30');
    if (rand() >= 1 - Math.min(0.9, spread / 0.1)) return;
    const r = hurt(v.soldier, damageOf(s.weapon, dist));
    if (r === 'down') down(v, { x: to[0] - from[0], z: to[2] - from[2] });
    else figures.flinch(v, { y: to[1] });
  };

  const api = {
    posts: turfs[0]?.posts ?? [],
    turfs,
    // where a covert landing put you (nobody's made within 25 m of it)
    landed(at) {
      if (!pop) covertAt = at;
    },
    get targets() {
      const out = [];
      for (const t of figures.all()) if (!t.down && t.fig && t.soldier.alive) out.push(t);
      return out;
    },
    hit(t, damage = 1, { push = null, at = null } = {}) {
      if (t.down || !t.soldier.alive) return;
      if (squads) grudge(t.soldier, squads, clock);
      const r = hurt(t.soldier, damage * YOURS);
      if (r === 'down') down(t, push);
      else figures.flinch(t, at);
    },
    parry: () => ({ parried: false, broke: false }),
    knock(t, v) {
      t.soldier.staggerUntil = clock + 1.4;
      if (v) {
        t.soldier.b.x += v.vx * 0.15;
        t.soldier.b.z += v.vz * 0.15;
      }
      figures.flinch(t);
    },
    stagger(t, secs) {
      t.soldier.staggerUntil = clock + secs;
      figures.flinch(t);
    },
    // (what an update costs, in milliseconds, smoothed: scripts/galaxy-check.mjs reads it)
    ms: 0,
    update(dt, you, time, opts = {}) {
      const t0 = performance.now();
      const shots = step(dt, you, time, opts);
      api.ms += (performance.now() - t0 - api.ms) * 0.05;
      return shots;
    },
    debug: () =>
      [...figures.all()].map((t) => ({
        id: t.id,
        kind: t.soldier.kind,
        side: t.soldier.side,
        role: t.soldier.role,
        hp: t.soldier.hp,
        down: t.down > 0,
        fig: Boolean(t.fig),
        at: [+t.soldier.b.x.toFixed(1), +t.soldier.b.z.toFixed(1)],
        mode: t.pose ? (t.soldier.head?.mind?.mode ?? null) : null,
        target: t.soldier.target ?? null,
        mark: t.pose?.mark ?? null,
      })),
    dispose() {
      figures.dispose();
    },
  };
  function step(dt, you, time, { mate = null, camera = null } = {}) {
    clock = time;
    figures.frame();
    const shots = [];
    if (!you) return shots;
    lastYou = { x: you.x, z: you.z };
    const p = population();
    const speed = Math.hypot(you.vx ?? 0, you.vz ?? 0);
    const { make, drop } = p.update({
      x: you.x,
      z: you.z,
      heading: speed > 0.5 ? [Math.sign(you.vx) || 0, Math.sign(you.vz) || 0] : null,
    });
    for (const id of drop) figures.remove(id);
    for (const s of make) figures.add(s).ground = api;
    if (time - squadAt >= SQUADS) {
      squads.update(time - squadAt);
      squadAt = time;
    }
    const bodies = [];
    for (const s of p.soldiers.values())
      if (s.alive)
        bodies.push({
          id: s.id,
          x: s.b.x,
          z: s.b.z,
          vel: s.vel ?? null,
          side: s.side,
          kind: s.kind,
          squad: s.squad,
          firingAt: time - (s.firedAt ?? -9) < 1 ? s.firingAt : null,
        });
    bodies.push({
      id: 'you',
      x: you.x,
      z: you.z,
      vel: [you.vx ?? 0, you.vz ?? 0],
      side: effects.side ?? null,
      kind: 'you',
      you: true,
    });
    if (mate)
      bodies.push({
        id: 'mate',
        x: mate.x,
        z: mate.z,
        vel: [mate.vx ?? 0, mate.vz ?? 0],
        side: effects.side ?? null,
        kind: 'mate',
        you: true,
      });
    const fw = {
      t: time,
      war: effects.war,
      bodies,
      seesThrough,
      tokens,
      squads,
    };
    // who's live, still and hidden by where the camera stands
    items.length = 0;
    for (const t of figures.all())
      items.push({
        id: t.id,
        x: t.soldier.b.x,
        y: t.holder.position.y,
        z: t.soldier.b.z,
        falling: t.down > 0,
      });
    const eye = camera?.position ?? { x: you.x, y: you.y ?? 0, z: you.z };
    lodPick(items, eye, { count: liveCount(tier), far: BRAINS }, lod);
    for (const t of [...figures.all()]) {
      const s = t.soldier;
      const seen = lod.get(t.id) !== 'hidden';
      if (t.fig) t.fig.model.visible = seen;
      if (t.down) {
        if (figures.dying(t, dt)) figures.remove(t.id);
        continue;
      }
      const d = Math.hypot(s.b.x - you.x, s.b.z - you.z);
      if (d > BRAINS) continue;
      const was = { x: s.b.x, z: s.b.z };
      const out =
        (s.staggerUntil ?? 0) > time
          ? {
              x: s.b.x,
              z: s.b.z,
              yaw: s.b.yaw,
              mode: 'hold',
              moving: 0,
              aim: null,
              fire: false,
              target: null,
            }
          : fightStep(s, fw, dt, rand);
      const [x, z] = moved(s, out.x, out.z);
      s.b.x = x;
      s.b.z = z;
      s.b.yaw = out.yaw;
      s.vel = [(x - was.x) / Math.max(dt, 1e-3), (z - was.z) / Math.max(dt, 1e-3)];
      t.aim = out.target ? out.aim : null;
      t.watchesYou = out.target === 'you';
      t.hostile = t.watchesYou || out.target === 'mate'; // (your mate's foe: one that's at you or it)
      figures.body(
        t,
        {
          ...out,
          x,
          z,
          belief: out.target ? (s.me?.beliefs?.[out.target] ?? null) : null,
          sees: Boolean(out.target) && !out.guessed,
        },
        dt,
        time,
        { you, camera, live: lod.get(t.id) === 'live' },
      );
      // its gun: bursts while the fight says fire
      s.cool = (s.cool ?? 0) - dt;
      if (out.fire && s.cool <= 0 && !(s.burst > 0)) s.burst = weaponOf(s.weapon).burst ?? 3;
      if (s.burst > 0 && s.cool <= 0 && out.aim) {
        s.burst -= 1;
        s.cool = s.burst > 0 ? Math.max(GAP, weaponOf(s.weapon).every) : PAUSE[0] + rand() * (PAUSE[1] - PAUSE[0]);
        const first = s.burst === (weaponOf(s.weapon).burst ?? 3) - 1;
        const body = bodies.find((b) => b.id === out.target);
        const dist = Math.hypot(out.aim.x - x, out.aim.z - z);
        const spread = aimError(s, body ?? { vel: null }, dist, { first, now: time }) * AIM;
        const from = figures.fire(t, time);
        s.firedAt = time;
        s.firingAt = out.target;
        if (out.target === 'you')
          shots.push({
            from,
            to: [out.aim.x, out.aim.z],
            spread,
            damage: damageOf(s.weapon, dist),
            who: t,
            guessed: Boolean(out.guessed),
          });
        else if (out.target === 'mate') blaster?.tracer(from, [mate.x, (mate.y ?? 0) + 1.1, mate.z], BOLT[s.side] ?? '#ff3b30');
        else {
          const v = figures.get(out.target);
          if (v && !v.down) between(t, v, from, spread, dist);
        }
      }
    }
    tokens.audit(dt, (who) => Boolean(pop.soldiers.get(who)?.alive));
    return shots;
  }
  return api;
}
