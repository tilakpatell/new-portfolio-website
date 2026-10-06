// The Galactic Civil War's battles, at their planets (gcw.js says where
// they're on; warfront.js fights them, through universe/battle.js): which
// fleets and fighters each system's is fought with, and where it's fought, off
// the planet on its sunlit side, clear of its surface, its stations and a
// Death Star's shield. Pure (tested).
//
// Every ship's size is the galaxy's (a ship's real length at SIZE's scale,
// 53 metres to a map unit: the Star Destroyer 30, the MC80 22.5, the X-wing
// about a quarter; the Executor's held to 110, short of its 19 kilometres,
// and the worlds are grown to be wider still: fit.js).
//
// TEMPLATES[id]: { name, rebels, empire, fighters: { rebels, empire } }, a
// side { flagship, escorts: [{ kind, size, name? }] }; templateFor(id) →
// the system's, or the line of battle the war fights anywhere else.
// obstacles(sys) → [{ c: { x, y, z }, r }]: the planet and what's built round
// it, for the fighters to keep out of and the line to be laid clear of.
// layBattle(sys, battle, { now, tier }) → createBattle's options for the
// battle gcw.js has on there.

import { WARS } from '../universe/wars';
import { WIDTH, createBattle, perSide } from '../universe/battle';
import { seeded } from './gcw';
import { systemById } from './systems';

const M = 53.3; // metres to a map unit (the Star Destroyer's 1,600 m is 30)
const m = (metres) => +(metres / M).toFixed(2);
export const SIZE = {
  destroyer: 30,
  executor: 110, // (19,000 m, held to this: a world is grown wider than it, fit.js)
  interdictor: m(600),
  lightcruiser: m(450),
  gozanti: 2.4, // (64 m; a little bigger, to read as a ship of the line)
  moncal: m(1200),
  nebulon: m(300),
  corvette: m(150),
  hammerhead: m(315),
  transport: 2.2, // (a GR-75's 90 m, a little bigger)
};
const ship = (kind, name = null, size = SIZE[kind]) => ({ kind, size, ...(name ? { name } : {}) });

const FIGHTERS = {
  rebels: [
    { kind: 'xwing', role: 'fighter', weight: 3 },
    { kind: 'awing', role: 'interceptor', weight: 2 },
    { kind: 'ywing', role: 'bomber', weight: 1.5 },
    { kind: 'bwing', role: 'bomber', weight: 1 },
  ],
  empire: [
    { kind: 'tie', role: 'fighter', weight: 4 },
    { kind: 'interceptor', role: 'interceptor', weight: 2 },
    { kind: 'tiebomber', role: 'bomber', weight: 1.5 },
  ],
};
const withVader = [...FIGHTERS.empire, { kind: 'tieadvanced', role: 'fighter', weight: 0.4 }];

// the line of battle the war fights anywhere without one of its own
const DEFAULT = {
  rebels: { flagship: ship('moncal'), escorts: [ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette'), ship('nebulon'), ship('transport')] },
  empire: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('lightcruiser'), ship('gozanti'), ship('gozanti'), ship('interdictor')] },
  fighters: FIGHTERS,
};

export const TEMPLATES = {
  // under the second Death Star: Death Squadron against the whole Rebel fleet
  endor: {
    name: 'The Battle of Endor',
    rebels: { flagship: ship('moncal', 'Home One', 26), escorts: [ship('moncal', 'Liberty'), ship('nebulon'), ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette')] },
    empire: { flagship: ship('executor', 'Executor'), escorts: [ship('destroyer'), ship('destroyer'), ship('destroyer'), ship('interdictor'), ship('lightcruiser')] },
    fighters: { rebels: [...FIGHTERS.rebels, { kind: 'bwing', role: 'bomber', weight: 1 }], empire: withVader },
  },
  // Death Squadron over Echo Base, and the Rebellion holding them off while the transports run
  hoth: {
    name: 'The Battle of Hoth',
    rebels: { flagship: ship('moncal'), escorts: [ship('transport'), ship('transport'), ship('transport'), ship('corvette'), ship('nebulon')] },
    empire: { flagship: ship('executor', 'Executor'), escorts: [ship('destroyer', 'Avenger'), ship('destroyer', 'Tyrant'), ship('destroyer', 'Stalker'), ship('destroyer'), ship('interdictor')] },
    fighters: { rebels: FIGHTERS.rebels, empire: withVader },
  },
  // the Shield Gate: the Persecutor and the Intimidator, and the Profundity's fleet
  scarif: {
    name: 'The Battle of Scarif',
    rebels: { flagship: ship('moncal', 'Profundity'), escorts: [ship('hammerhead', 'Lightmaker'), ship('corvette', 'Tantive IV'), ship('corvette'), ship('nebulon'), ship('hammerhead')] },
    empire: { flagship: ship('destroyer', 'Persecutor'), escorts: [ship('destroyer', 'Intimidator'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { rebels: [...FIGHTERS.rebels, { kind: 'uwing', role: 'fighter', weight: 1.5 }], empire: FIGHTERS.empire },
  },
  yavin: {
    name: 'The Battle of Yavin',
    rebels: { flagship: ship('moncal'), escorts: [ship('corvette'), ship('corvette'), ship('nebulon'), ship('hammerhead'), ship('transport')] },
    empire: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { rebels: FIGHTERS.rebels, empire: withVader },
  },
  coruscant: {
    name: 'The Battle of Coruscant',
    rebels: { flagship: ship('moncal', 'Home One', 26), escorts: [ship('moncal'), ship('moncal'), ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette')] },
    empire: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('destroyer'), ship('destroyer'), ship('interdictor'), ship('lightcruiser'), ship('lightcruiser')] },
    fighters: FIGHTERS,
  },
};

const NAMES = { kashyyyk: 'The liberation of Kashyyyk', mandalore: 'The Battle of Mandalore', lothal: 'The Battle of Lothal' };
export function templateFor(id) {
  if (TEMPLATES[id]) return TEMPLATES[id];
  return { ...DEFAULT, name: NAMES[id] ?? `The Battle of ${systemById(id)?.name ?? id}` };
}

const v = (x, y, z) => ({ x, y, z });
const len = (p) => Math.hypot(p.x, p.y, p.z);

// the planet and what's built round it: a Death Star (its shield, at Endor),
// the Shield Gate, the Death Star that drops in over Scarif, a field of rocks
export function obstacles(sys) {
  const out = [{ c: v(0, 0, 0), r: (sys.body?.r ?? 10) + 6 }];
  for (const p of sys.pieces) {
    if (p.type === 'station') out.push({ c: v(...p.at), r: p.size * (p.kind === 'deathstar2' && p.shield ? 0.7 : 0.55) });
    else if (p.type === 'deathstar') out.push({ c: v(...p.at), r: p.r * 1.2 });
    else if (p.type === 'superlaser') out.push({ c: v(...p.from), r: 40 });
    else if (p.type === 'rocks' && p.kind === 'field') out.push({ c: v(...p.at), r: p.radius });
  }
  return out;
}

const sideOf = (base, t) => ({
  ...base,
  fighters: t.fighters,
  capitals: [
    { kind: t.side.flagship.kind, role: 'flagship', size: t.side.flagship.size, hull: Math.round(18 * t.side.flagship.size + 40), ...(t.side.flagship.name ? { name: t.side.flagship.name } : {}) },
    ...t.side.escorts.map((c) => ({ kind: c.kind, role: 'escort', size: c.size, hull: Math.round(18 * c.size + 40), ...(c.name ? { name: c.name } : {}) })),
  ],
});

export function layBattle(sys, battle, { now = battle.start, tier = 'high' } = {}) {
  const t = templateFor(sys.id);
  const [rebelsBase, empireBase] = WARS.starwars.sides;
  const war = {
    id: 'gcw',
    name: t.name,
    sides: [sideOf(rebelsBase, { side: t.rebels, fighters: t.fighters.rebels }), sideOf(empireBase, { side: t.empire, fighters: t.fighters.empire })],
  };
  const biggest = Math.max(...war.sides.flatMap((s) => s.capitals.map((c) => c.size)));
  const lines = Math.max(70, biggest * 0.5 + 40);
  const radius = lines + 60;
  const R = sys.body?.r ?? 30;
  const avoid = obstacles(sys);
  // which way from the planet: where the system's own battle is, or toward its sun, a little above its equator
  const own = sys.pieces.find((p) => p.type === 'battle');
  const sun = sys.suns[0].dir;
  let base = own ? v(...own.at) : v(sun[0], Math.max(0.15, Math.min(0.45, sun[1])), sun[2]);
  const bl = len(base) || 1;
  base = v(base.x / bl, base.y / bl, base.z / bl);
  const rand = seeded(`lay-${battle.seed}`);
  const yaw0 = (rand() - 0.5) * 0.5;
  // round from there till the line's clear of everything (the same tries in the same order for everyone)
  let chosen = null;
  for (let i = 0; i < 36 && !chosen; i++) {
    const yaw = yaw0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 0.35;
    const lift = i < 18 ? 0 : (i % 3) * 0.12;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const d = v(base.x * c - base.z * s, Math.min(0.7, base.y + lift), base.x * s + base.z * c);
    const dl = len(d);
    const dir = v(d.x / dl, d.y / dl, d.z / dl);
    for (const out of [0.85, 1.1, 1.4]) {
      const dist = R + radius * out + biggest * 0.2;
      const at = [dir.x * dist, dir.y * dist, dir.z * dist];
      // the line across the planet's way out, level
      const h = Math.hypot(dir.x, dir.z) || 1;
      const axis = [-dir.z / h, dir.x / h];
      const trial = createBattle({ war, attacker: 0, at, axis, perSide: 0, lines, radius });
      const reach = (cap) => Math.max(cap.size * 0.55, (WIDTH[cap.kind] ?? 0.4) * cap.size * 0.5);
      const clear = trial.capitals.every((cap) => avoid.every((o) => Math.hypot(cap.pos.x - o.c.x, cap.pos.y - o.c.y, cap.pos.z - o.c.z) - reach(cap) > o.r + 4));
      if (clear) {
        chosen = { at, axis };
        break;
      }
    }
  }
  // (never yet: far out, if nothing's clear)
  if (!chosen) {
    const dist = R + radius * 2 + biggest;
    chosen = { at: [base.x * dist, base.y * dist, base.z * dist], axis: [1, 0] };
  }
  return {
    war,
    attacker: battle.attacker === 'rebel' ? 0 : 1,
    at: chosen.at.map((x) => +x.toFixed(3)),
    axis: chosen.axis.map((x) => +x.toFixed(6)),
    lines,
    radius,
    avoid,
    clock: Math.round((battle.fightEnd - battle.start) / 1000),
    elapsed: Math.max(0, Math.round((now - battle.start) / 1000)),
    perSide: perSide(tier),
    seed: battle.seed,
  };
}
