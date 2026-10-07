// A battle at the front: Battlefront 2's Fleet Assault, as plain rules.
// Pure (no three.js), so it's tested in Node; battleScene.js draws it and
// front.js runs it on the map. The design:
// docs/superpowers/specs/2026-10-06-fleet-war-design.md.
//
// Two fleets face each other across the front, the attacker's line on one
// side of the middle and the defender's on the other, along `axis`. Each
// side has its capital ships (wars.js: a flagship and its escorts) and its
// fighters, as many as the device can draw a side (perSide), brought back
// from the side's tickets when they're shot down.
//
// - The fighters: a fighter dogfights the nearest of the other side's (a
//   pull toward one going after a friend, and toward you); an interceptor
//   goes after bombers first; a bomber flies torpedo runs at the defender's
//   flagship (at the objective of the phase) or, for the defender, at the
//   attacker's ships. They lead their shots, break off a head-on pass, extend
//   after an overshoot, jink with someone on their tail, steer round the
//   capital ships' hulls and turn back into the fight at its edge.
// - The capital ships: every battery fires turbolasers at the other side's
//   capital ships, and point-defence at fighters (you too) that come close.
// - The objectives: the defender's flagship has two shield generators
//   (phase 1: its shield holds everything else off), then its bridge
//   (phase 2), then its reactor (phase 3). When the reactor goes, the
//   flagship breaks up and the attacker has won. Your shots on them count
//   `youShare` times, the AI's `aiShare`: a battle left to itself still
//   moves, slowly, and you're what decides it.
// - The end: the attacker wins when the defender's flagship goes; the
//   defender wins when the attacker's flagship goes, when the attacker's out
//   of tickets and fighters, or when the clock runs out.
//
// In the galaxy (galaxy/warfront.js) a battle is sized to its ships (`lines`,
// `radius`), kept off its planet and out of a Death Star's shield (`avoid`:
// spheres its fighters steer clear of), on the clock every pilot shares
// (`clock` its length, `elapsed` how far in it is already), with the damage
// other pilots did to its objectives counted (`shared(id)` → theirs) and
// yours told (`onMine(id, damage)`), and a defender that can't run out of
// tickets (`tickets: false`: holding out to the end is how it wins).
//
// The galaxy's set pieces (galaxy/warpieces/) reach in: an ion cannon
// disables a capital ship a while (disable: its guns quiet, hits on it count
// more), its batteries are targets of their own (a run down its hull shoots
// them out), a capital ship can be moved and turned (a Hammerhead's ram:
// moveCapital, turnCapital), and runners fly for the jump through the battle
// (addRunner: gone after by the other side, and by you).
//
// The galaxy's kinds of battle (galaxy/battles.js) ask for three more: the
// defender's objectives on an Interdictor among its escorts instead of its
// flagship (`objectivesOn: 'interdictor'`: its fall wins the battle, the
// flagship keeps its hull), an ace on either side (`ace: { [team]: { kind,
// name, hp } }`: one fighter flown as that kind, named on its bracket, gone
// for good once down), and runners that decide the battle (`runners`: an
// evacuation's or a blockade's, launched through it, `need` of them out
// winning it for their side, all of them down losing it).
//
// createBattle({ war, attacker, at, axis, perSide, rand, lines, radius,
//   avoid, clock, elapsed, shared, onMine, tickets, objectivesOn, ace,
//   runners }) → battle (with
//   runners, disable(id, s), wreck(id), moveCapital(cap, d), turnCapital(cap, axis, a),
//   addRunner({ team, kind, size, hp, from, to, speed })):
//   { teams, capitals, fighters, bolts, phase, clock, over, you, defender, lines, radius, length,
//   attacker, setYou(team | null), update(dt, you) → events, hit(from, to,
//   damage) → hit | null, fire(team, from, dir, kind, target), targets,
//   info, end(winner) }
// `you`: { x, y, z, alive } (the ship, as the scene has it), or null.
// Events: { type: 'down', team, kind, role, at, mine, ace? }, { type: 'hurt', damage,
// kind }, { type: 'sub', sub, kind, phase, at, mine }, { type: 'phase',
// phase }, { type: 'shield', down: true }, { type: 'capital', id, kind,
// team, at }, { type: 'arrive', team, kind, at }, { type: 'impact', at,
// size, shield }, { type: 'over', winner, why }, { type: 'turret', id, cap,
// at, mine }, { type: 'disabled', id, at, size }, { type: 'escaped', id,
// team, kind, at }, { type: 'runner', id, team, kind, at, mine? } (one shot down).

import { sweptHit } from './targeting';
import { FIGHTERS, HULLS, NAMES, SUBSYSTEMS, TURRETS } from './wars';

export const BATTLE = {
  radius: 125, // how far from the middle the fight goes before the fighters turn back in
  lines: 70, // how far each side's capital ships sit from the middle
  tickets: 220, // fighters a side can lose
  clock: 720, // seconds the attacker has
  respawn: [3, 6], // seconds before a fighter shot down comes back
  dying: 6, // seconds a flagship takes to break up
  youShare: 4, // how much more your damage counts on the objectives and hulls
  aiShare: 0.22, // and the AI's
  hullShare: { laser: 0.02, flak: 0, turbo: 0.03, torpedo: 0.06 }, // of a bolt's damage a capital's hull takes
  youHull: 0.25, // and of yours (times youShare)
  youHurt: { laser: 5, flak: 3, turbo: 18, torpedo: 22 }, // shields a hit takes off you
  turretHp: 6, // a battery's, in your shots (a run down a hull takes them out one by one)
  turretsNear: 45, // how near a battery must be to be on the lock's list
  ionHull: 3, // how much more a disabled ship's hull takes
  ionSubs: 2, // and its objectives
  onYou: 4, // fighters at most after you at once
  flak: 25, // how near a fighter must come to a battery for its point-defence
  bolts: {
    laser: { speed: 60, life: 0.6, damage: 1 },
    flak: { speed: 70, life: 0.35, damage: 0.5 },
    turbo: { speed: 45, life: 4.5, damage: 6 },
    torpedo: { speed: 18, life: 4, damage: 9 },
  },
};

// how wide each capital ship is, as a share of its length (for laying a line out)
export const WIDTH = { destroyer: 0.58, executor: 0.26, interdictor: 0.58, moncal: 0.32, nebulon: 0.28, corvette: 0.3, hammerhead: 0.3, lightcruiser: 0.36, gozanti: 0.62, transport: 0.32, councildread: 0.36, fedbattleship: 0.8, gearship: 0.5, saucer: 1, federation: 0.4, hauler: 0.5, superlab: 0.28, madrigal: 0.5, pestvan: 0.5, hacienda: 1, pollostruck: 0.5, pickup: 0.5 };
const widthOf = (c) => (WIDTH[c.kind] ?? 0.4) * c.size;

const TIERS = { high: 32, mid: 20, low: 10 };
export const perSide = (tier) => TIERS[tier] ?? 20;

// ── vector bits, on plain { x, y, z } ──
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const set = (o, x, y, z) => ((o.x = x), (o.y = y), (o.z = z), o);
const copy = (o, p) => set(o, p.x, p.y, p.z);
const len = (o) => Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
const norm = (o) => {
  const l = len(o) || 1;
  return set(o, o.x / l, o.y / l, o.z / l);
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const cross = (a, b, o = v3()) => set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const UP = v3(0, 1, 0);
const ZERO = v3();

// The nose turned toward `want` by at most `max` radians (a new unit vector).
export function turnToward(fwd, want, max) {
  const w = norm(copy(v3(), want));
  const c = Math.max(-1, Math.min(1, dot(fwd, w)));
  const ang = Math.acos(c);
  if (ang <= max) return w;
  // about the axis between them (any at all when it's straight behind)
  const ax = cross(fwd, w);
  if (len(ax) < 1e-6) cross(fwd, Math.abs(fwd.y) < 0.9 ? UP : v3(1, 0, 0), ax);
  norm(ax);
  const s = Math.sin(max);
  const k = Math.cos(max);
  const t = cross(ax, fwd);
  return norm(v3(fwd.x * k + t.x * s, fwd.y * k + t.y * s, fwd.z * k + t.z * s));
}

// whether something `to` away (from the nose's root) is in range and inside
// the fighter's cone of fire
export function inSights(fwd, to, type) {
  const d = len(to);
  return d > 1e-6 && d <= type.range && dot(fwd, to) / d >= Math.cos(type.cone);
}

// a weighted pick from [{ weight }…]
const pick = (list, rand) => {
  let r = rand() * list.reduce((s, o) => s + o.weight, 0);
  for (const o of list) if ((r -= o.weight) <= 0) return o;
  return list[list.length - 1];
};

export function createBattle({ war, attacker = 0, at = [0, 0, 0], axis = [1, 0], perSide: n = 20, rand = Math.random, lines = BATTLE.lines, radius = BATTLE.radius, avoid = [], clock = BATTLE.clock, elapsed = 0, shared = null, onMine = null, tickets = true, objectivesOn = 'flagship', ace = {}, runners = null }) {
  const defender = 1 - attacker;
  const C = v3(...at);
  const A = norm(v3(axis[0], 0, axis[1])); // from the first side's line to the second's
  const S = cross(UP, A); // across the lines
  const between = ([a, b]) => a + rand() * (b - a);
  let nextId = 2e6; // (numbered apart from the hunters' and the skirmish's: the lock follows a number)
  const events = [];
  const pending = []; // what your shots did, told on the next update

  const b = {
    teams: war.sides.map((side) => ({ side, tickets: BATTLE.tickets })),
    capitals: [],
    fighters: [],
    bolts: Array.from({ length: 320 }, () => ({ on: false, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0, target: null })),
    phase: 1,
    clock: elapsed,
    length: clock,
    lines,
    radius,
    over: null,
    attacker,
    defender,
    you: { pos: v3(), prev: v3(), vel: v3(), alive: false, team: null, on: 0 },
    runners: [],
  };

  // ── the capital ships, in their lines ──
  // a point on a capital ship's hull, from its own frame (shares of its length) into the battle's
  const place = (cap, l, o = v3()) => set(o, cap.pos.x + (cap.right.x * l[0] + cap.up.x * l[1] + cap.fwd.x * l[2]) * cap.size, cap.pos.y + (cap.right.y * l[0] + cap.up.y * l[1] + cap.fwd.y * l[2]) * cap.size, cap.pos.z + (cap.right.z * l[0] + cap.up.z * l[1] + cap.fwd.z * l[2]) * cap.size);
  b.teams.forEach(({ side }, team) => {
    const dir = team === 0 ? 1 : -1; // the way to the other side
    // the ship the defender's objectives are on: its flagship, or (an
    // interdiction) the first Interdictor among its escorts, if it has one
    const inter = objectivesOn === 'interdictor' ? side.capitals.findIndex((c) => c.kind === 'interdictor') : -1;
    const objective = team === defender ? (inter >= 0 ? inter : 0) : -1;
    const line = v3(C.x - A.x * lines * dir, C.y, C.z - A.z * lines * dir);
    let flank = 0;
    // how far out each side of the line is taken, so far (the flagship's half, and a gap)
    const edge = [widthOf(side.capitals[0]) / 2 + 6, widthOf(side.capitals[0]) / 2 + 6];
    side.capitals.forEach((c, i) => {
      const flag = c.role === 'flagship';
      // the flagship in the middle of the line, the escorts out to each side by their widths, a little forward
      let out = 0;
      if (!flag) {
        const k = flank % 2;
        const w = widthOf(c);
        out = (k ? -1 : 1) * (edge[k] + w / 2);
        edge[k] += w + 6;
        flank += 1;
      }
      const fwd = v3(A.x * dir, 0, A.z * dir);
      const cap = {
        id: nextId++,
        team,
        kind: c.kind,
        role: c.role,
        size: c.size,
        pos: v3(line.x + S.x * out + fwd.x * (flag ? 0 : 12 + 4 * (i % 2)), line.y + (flag ? 0 : (i % 2 ? 7 : -6)), line.z + S.z * out + fwd.z * (flag ? 0 : 12 + 4 * (i % 2))),
        fwd,
        up: v3(0, 1, 0),
        right: cross(UP, fwd),
        hull: c.hull,
        hullMax: c.hull,
        alive: true,
        dying: 0,
        disabled: 0, // seconds left of an ion cannon's hit
        objective: i === objective,
        tracked: i !== objective, // (the ship with the defender's objectives falls by them, not its hull)
        subs: [],
        spheres: [],
        turrets: [],
      };
      cap.spheres = (HULLS[c.kind] ?? [[0, 0.1]]).map(([z, r]) => ({ c: place(cap, [0, 0, z]), r: r * c.size }));
      cap.reach = c.size * 0.55;
      cap.turrets = (TURRETS[c.kind] ?? []).map((l) => ({ num: nextId++, at: place(cap, l), r: Math.max(0.35, 0.012 * c.size), turbo: between([0.5, 3.5]), flak: between([0, 0.6]), hp: BATTLE.turretHp, alive: true, cap }));
      if (i === objective)
        cap.subs = (SUBSYSTEMS[c.kind] ?? []).map((s, k) => ({ id: s.id, num: 3e6 + k, kind: s.kind, phase: s.phase, pos: place(cap, s.at), r: Math.max(0.6, s.r * c.size), hp: s.hp, hpMax: s.hp, dealt: 0, alive: true, cap }));
      b.capitals.push(cap);
    });
  });
  const flagOf = (team) => b.capitals.find((c) => c.team === team && c.role === 'flagship');
  const objOf = () => b.capitals.find((c) => c.objective);

  // ── the fighters ──
  const kinds = b.teams.map(({ side }) => side.fighters);
  const spawn = (f, first) => {
    const dir = f.team === 0 ? 1 : -1;
    const home = flagOf(f.team);
    const lineX = C.x - A.x * lines * dir;
    const lineZ = C.z - A.z * lines * dir;
    // in front of its own line (launched, or out of hyperspace), further out to begin with
    const ahead = first ? 22 + rand() * 50 : 22 + rand() * 14;
    const across = (rand() - 0.5) * (first ? 90 : 60);
    set(f.pos, lineX + A.x * dir * ahead + S.x * across, (home?.pos.y ?? C.y) + (rand() - 0.5) * 24, lineZ + A.z * dir * ahead + S.z * across);
    // (never in among what it's to keep out of: out to its edge)
    for (const o of avoid) {
      set(f.away, f.pos.x - o.c.x, f.pos.y - o.c.y, f.pos.z - o.c.z);
      const d = len(f.away);
      if (d < o.r + 6) set(f.pos, o.c.x + (f.away.x / (d || 1)) * (o.r + 6), o.c.y + (f.away.y / (d || 1)) * (o.r + 6) + (d ? 0 : o.r + 6), o.c.z + (f.away.z / (d || 1)) * (o.r + 6));
    }
    copy(f.prev, f.pos);
    norm(set(f.fwd, A.x * dir + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.2, A.z * dir + (rand() - 0.5) * 0.4));
    f.speed = f.type.speed;
    set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
    f.hp = f.type.hp;
    f.alive = true;
    f.mode = f.role === 'bomber' ? 'run' : 'engage';
    f.modeT = 0;
    f.target = null;
    f.retarget = rand() * 0.4;
    f.cool = rand() * f.type.burst[1];
    f.shots = 0;
    f.bank = 0;
  };
  const makeFighter = (team) => {
    const k = pick(kinds[team], rand);
    const type = FIGHTERS[k.kind];
    const f = { id: nextId++, team, kind: k.kind, role: k.role, type, size: type.size, pos: v3(), prev: v3(), vel: v3(), fwd: v3(0, 0, 1), speed: 0, hp: 0, alive: false, mode: 'engage', modeT: 0, target: null, retarget: 0, cool: 0, shots: 0, bank: 0, respawn: 0, chased: -1, away: v3(), aim: v3() };
    f.tgt = { id: f.id, at: f.pos, vel: f.vel, size: f.size, kind: f.kind, name: NAMES[f.kind] ?? f.kind, hp: 0, hpMax: type.hp, threat: 0 };
    spawn(f, true);
    return f;
  };
  for (const team of [0, 1]) for (let i = 0; i < n; i++) b.fighters.push(makeFighter(team));
  // an ace: one of its side's, flown as its own kind, named, with its own hull
  for (const team of [0, 1]) {
    const a = ace?.[team];
    if (!a || !FIGHTERS[a.kind]) continue;
    let f = b.fighters.find((o) => o.team === team);
    if (!f) b.fighters.push((f = makeFighter(team)));
    f.kind = a.kind;
    f.type = { ...FIGHTERS[a.kind], hp: a.hp };
    f.size = f.type.size;
    f.hp = a.hp;
    f.ace = true;
    Object.assign(f.tgt, { kind: a.kind, name: a.name, size: f.size, hpMax: a.hp });
  }

  // ── the bolts ──
  let cursor = 0;
  b.fire = (team, from, dir, kind, target = null) => {
    const spec = BATTLE.bolts[kind];
    let o = null;
    for (let i = 0; i < b.bolts.length && !o; i++) {
      const c = b.bolts[(cursor + i) % b.bolts.length];
      if (!c.on) o = c;
    }
    if (!o) return null; // (all in flight: this one's lost in the din)
    cursor = (b.bolts.indexOf(o) + 1) % b.bolts.length;
    const l = len(dir) || 1;
    o.on = true;
    o.team = team;
    o.kind = kind;
    o.x = from.x;
    o.y = from.y;
    o.z = from.z;
    o.vx = (dir.x / l) * spec.speed;
    o.vy = (dir.y / l) * spec.speed;
    o.vz = (dir.z / l) * spec.speed;
    o.life = spec.life;
    o.damage = spec.damage;
    o.target = target;
    return o;
  };

  // ── what's hit ──
  const kill = (f, mine) => {
    f.alive = false;
    const t = b.teams[f.team];
    if (f.ace) f.respawn = Infinity; // (an ace down is gone for the battle)
    else if (t.tickets > 0) {
      t.tickets -= 1;
      f.respawn = between(BATTLE.respawn);
    } else f.respawn = Infinity;
    if (b.you.on && f.target === b.you) b.you.on -= 1;
    return { type: 'down', team: f.team, kind: f.kind, role: f.role, at: copy(v3(), f.pos), mine, ...(f.ace ? { ace: true } : {}) };
  };
  const subDown = (s, mine) => {
    s.alive = false;
    return { type: 'sub', sub: s.id, kind: s.kind, phase: s.phase, at: copy(v3(), s.pos), mine };
  };
  // damage to a capital's hull (the defender's flagship takes none: it falls by its objectives)
  const hullHit = (cap, dmg, out) => {
    if (!cap.tracked || !cap.alive || cap.dying > 0) return;
    cap.hull -= dmg * (cap.disabled > 0 ? BATTLE.ionHull : 1);
    if (cap.hull <= 0) {
      cap.hull = 0;
      cap.dying = cap.role === 'flagship' ? BATTLE.dying : 2.5;
      out.push({ type: 'impact', at: copy(v3(), cap.pos), size: cap.size * 0.3, shield: false });
    }
  };
  const shielded = (cap) => cap.objective && b.phase === 1;

  // the first of the other side's capital ships (its objectives, then its
  // hull) a segment from p0 to p1 meets: { cap, sub, k, at } or null
  const capitalHit = (p0, p1, team) => {
    let best = null;
    for (const cap of b.capitals) {
      if (cap.team === team || !cap.alive) continue;
      if (dist2(cap.pos, p1) > (cap.reach + 30) ** 2 && dist2(cap.pos, p0) > (cap.reach + 30) ** 2) continue;
      for (const s of cap.subs) {
        if (!s.alive || s.hidden) continue;
        const k = sweptHit(p0, p1, s.pos, s.pos, s.r);
        if (k !== null && (!best || k < best.k)) best = { cap, sub: s, k };
      }
      for (const sp of cap.spheres) {
        const k = sweptHit(p0, p1, sp.c, sp.c, sp.r);
        if (k !== null && (!best || k < best.k)) best = { cap, sub: null, k };
      }
    }
    if (best) best.at = v3(p0.x + (p1.x - p0.x) * best.k, p0.y + (p1.y - p0.y) * best.k, p0.z + (p1.z - p0.z) * best.k);
    return best;
  };
  // a hit on an objective: only those of the phase, and only once the shield's down for the rest
  // (its hp: what it started with, less what's been dealt it here and what other pilots did: shared)
  const subHp = (s) => s.hpMax - s.dealt - (shared ? shared(s.id) : 0);
  const subHit = (s, dmg, mine, out) => {
    if (s.phase !== b.phase) return false;
    if (s.cap.disabled > 0) dmg *= BATTLE.ionSubs;
    s.dealt += dmg;
    if (mine) onMine?.(s.id, dmg);
    s.hp = Math.max(0, subHp(s));
    if (s.hp <= 0) out.push(subDown(s, mine));
    return true;
  };
  // what other pilots have done, as it's heard of
  const sharedSubs = (out) => {
    if (!shared) return;
    for (const cap of b.capitals)
      for (const s of cap.subs) {
        if (!s.alive) continue;
        s.hp = Math.max(0, subHp(s));
        if (s.hp <= 0 && s.phase <= b.phase) out.push(subDown(s, false));
      }
  };

  // ── you ──
  b.setYou = (team) => {
    b.you.team = team === 0 || team === 1 ? team : null;
    for (const f of b.fighters) if (f.target === b.you) f.target = null;
    b.you.on = 0;
  };

  // ── choosing what to go after ──
  const youIn = () => b.you.alive && b.you.team !== null && dist2(b.you.pos, C) < (radius * 1.4) ** 2;
  const bomberTarget = (f) => {
    const enemy = 1 - f.team;
    // a runner of the other side's, half the time there's one
    const runs = b.runners.filter((r) => r.alive && r.team === enemy);
    if (runs.length && rand() < 0.5) return runs[Math.floor(rand() * runs.length)];
    if (f.team === attacker) {
      const flag = objOf();
      const subs = flag?.alive ? flag.subs.filter((s) => s.alive && s.phase === b.phase) : [];
      if (subs.length) return subs[Math.floor(rand() * subs.length)];
    }
    // a point on one of the other side's capital ships
    const caps = b.capitals.filter((c) => c.team === enemy && c.alive && c.dying <= 0 && c.tracked);
    if (!caps.length) return null;
    const cap = caps[Math.floor(rand() * caps.length)];
    const sp = cap.spheres[Math.floor(rand() * cap.spheres.length)];
    return { pos: sp.c, alive: true, cap, r: sp.r };
  };
  const fighterTarget = (f) => {
    let best = null;
    let score = Infinity;
    for (const o of b.fighters) {
      if (!o.alive || o.team === f.team) continue;
      let d = dist2(o.pos, f.pos);
      if (f.role === 'interceptor' && o.role === 'bomber') d *= 0.12;
      else if (o.target && o.target !== b.you && o.target.team === f.team) d *= 0.5; // (going after a friend)
      if (d < score) {
        score = d;
        best = o;
      }
    }
    // runners for the jump: the other side's go after them first
    for (const r of b.runners) {
      if (!r.alive || r.team === f.team) continue;
      const d = dist2(r.pos, f.pos) * 0.3;
      if (d < score) {
        score = d;
        best = r;
      }
    }
    if (youIn() && b.you.team !== f.team && b.you.on < BATTLE.onYou) {
      const d = dist2(b.you.pos, f.pos);
      // always a couple on you while you're anywhere near (Battlefront's
      // fights come to the player), more if you're the nearest
      if ((b.you.on < 2 && d < 70 * 70) || d * 0.35 < score) best = b.you;
    }
    return best;
  };
  const targetAlive = (t) => t && (t === b.you ? youIn() : t.alive);

  // ── one fighter, one step ──
  const want = v3();
  const tmp = v3();
  const oldFwd = v3();
  const flyFighter = (f, dt) => {
    // a new target now and then, or when the last one's gone
    f.retarget -= dt;
    if (!targetAlive(f.target) || f.retarget <= 0) {
      const was = f.target;
      f.target = f.role === 'bomber' ? bomberTarget(f) : fighterTarget(f);
      if (was === b.you && f.target !== b.you) b.you.on = Math.max(0, b.you.on - 1);
      if (f.target === b.you && was !== b.you) b.you.on += 1;
      f.retarget = 0.35 + rand() * 0.25;
    }
    const t = f.target;
    const tp = t === b.you ? b.you.pos : t?.pos;
    const tv = t === b.you ? b.you.vel : t?.vel ?? ZERO;
    let dist = Infinity;
    if (tp) {
      // where to point: where it'll be by the time a bolt gets there
      dist = Math.sqrt(dist2(tp, f.pos));
      const lead = f.role === 'bomber' ? dist / BATTLE.bolts.torpedo.speed : dist / BATTLE.bolts.laser.speed;
      set(f.aim, tp.x + tv.x * lead, tp.y + tv.y * lead, tp.z + tv.z * lead);
      if (t !== b.you && t.team !== undefined && dist < 10) t.chased = b.clock; // (someone on its tail)
    }
    f.modeT -= dt;
    if (f.modeT <= 0 && f.mode !== 'engage' && f.mode !== 'run') f.mode = f.role === 'bomber' ? 'run' : 'engage';
    // what it wants: at its target, or away from it for a while
    if (f.mode === 'break' || f.mode === 'jink' || f.mode === 'extend') copy(want, f.away);
    else if (tp) set(want, f.aim.x - f.pos.x, f.aim.y - f.pos.y, f.aim.z - f.pos.z);
    else set(want, C.x - f.pos.x, C.y - f.pos.y, C.z - f.pos.z);
    norm(want);
    if (tp && f.mode === 'engage') {
      set(tmp, tp.x - f.pos.x, tp.y - f.pos.y, tp.z - f.pos.z);
      const ahead = dot(f.fwd, tmp) / (dist || 1);
      // head-on and about to meet: break off, to one side
      if (dist < 3 && ahead > 0.5 && t !== b.you && t.fwd && dot(t.fwd, f.fwd) < -0.5) {
        f.mode = 'break';
        f.modeT = 1.2 + rand();
        norm(cross(f.fwd, rand() < 0.5 ? UP : f.away.y > 0 ? S : A, f.away));
      } else if (dist < 6 && ahead < -0.2) {
        // overshot: straight on a while, then round again
        f.mode = 'extend';
        f.modeT = 1.2 + rand() * 0.8;
        norm(set(f.away, f.fwd.x, f.fwd.y + (rand() - 0.5) * 0.6, f.fwd.z));
      } else if (b.clock - f.chased < 0.6 && rand() < dt * 0.8) {
        // someone on its tail: jink
        f.mode = 'jink';
        f.modeT = 0.8 + rand() * 0.6;
        norm(set(f.away, f.fwd.x + (rand() - 0.5) * 1.6, f.fwd.y + (rand() - 0.5) * 1.6, f.fwd.z + (rand() - 0.5) * 1.6));
      }
    }
    // round the capital ships' hulls, looking a second ahead
    for (const cap of b.capitals) {
      if (!cap.alive || dist2(cap.pos, f.pos) > (cap.reach + f.speed * 1.2 + 4) ** 2) continue;
      for (const sp of cap.spheres) {
        set(tmp, f.pos.x + f.vel.x * 1.0 - sp.c.x, f.pos.y + f.vel.y * 1.0 - sp.c.y, f.pos.z + f.vel.z * 1.0 - sp.c.z);
        const d = len(tmp);
        const room = sp.r + 2.5;
        if (d < room) {
          const push = ((room - d) / room) * 4;
          want.x += (tmp.x / (d || 1)) * push;
          want.y += (tmp.y / (d || 1)) * push + push * 0.3;
          want.z += (tmp.z / (d || 1)) * push;
        }
      }
    }
    // clear of the planet, a Death Star's shield…
    // (looking a second and a half ahead; nothing it's after counts for more)
    for (const o of avoid) {
      set(tmp, f.pos.x + f.vel.x * 1.5 - o.c.x, f.pos.y + f.vel.y * 1.5 - o.c.y, f.pos.z + f.vel.z * 1.5 - o.c.z);
      const d = len(tmp);
      const room = o.r + 12;
      if (d < room) {
        const push = 2 + ((room - d) / 12) * 10;
        want.x += (tmp.x / (d || 1)) * push;
        want.y += (tmp.y / (d || 1)) * push;
        want.z += (tmp.z / (d || 1)) * push;
      }
    }
    // back into the fight at its edge
    const out = Math.sqrt(dist2(f.pos, C)) - radius;
    if (out > 0) {
      set(tmp, C.x - f.pos.x, C.y - f.pos.y, C.z - f.pos.z);
      norm(tmp);
      const k = Math.min(3, out / 20);
      want.x += tmp.x * k;
      want.y += tmp.y * k;
      want.z += tmp.z * k;
    }
    copy(oldFwd, f.fwd);
    copy(f.fwd, turnToward(f.fwd, want, f.type.turn * dt));
    // leaning into the turn (for the drawing)
    const side = dot(cross(oldFwd, f.fwd, tmp), UP) / Math.max(dt, 1e-4);
    f.bank += (Math.max(-1.2, Math.min(1.2, side * 0.45)) - f.bank) * Math.min(1, dt * 4);
    const top = f.type.speed * (f.mode === 'break' ? 1.1 : 1);
    f.speed += Math.max(-f.type.accel * dt, Math.min(f.type.accel * dt, top - f.speed));
    set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
    copy(f.prev, f.pos);
    f.pos.x += f.vel.x * dt;
    f.pos.y += f.vel.y * dt;
    f.pos.z += f.vel.z * dt;
    // its guns, or its torpedoes
    f.cool -= dt;
    if (!tp || f.cool > 0 || b.over) return;
    set(tmp, f.aim.x - f.pos.x, f.aim.y - f.pos.y, f.aim.z - f.pos.z);
    if (f.role === 'bomber') {
      if (f.mode === 'run' && dist < 12 && dot(f.fwd, tmp) / (len(tmp) || 1) > 0.95) {
        b.fire(f.team, f.pos, tmp, 'torpedo', t);
        f.cool = f.type.reload ?? 1.2;
        // pull out and away, then round for another run
        f.mode = 'extend';
        f.modeT = 2.5 + rand();
        norm(set(f.away, f.fwd.x - tmp.x * 0.02, 0.8, f.fwd.z - tmp.z * 0.02));
      }
      return;
    }
    if (!inSights(f.fwd, tmp, f.type)) return;
    const spread = 0.02;
    set(tmp, tmp.x / len(tmp) + (rand() - 0.5) * spread * 2, tmp.y / len(tmp) + (rand() - 0.5) * spread * 2, tmp.z / len(tmp) + (rand() - 0.5) * spread * 2);
    b.fire(f.team, { x: f.pos.x + f.fwd.x * f.size * 0.6, y: f.pos.y + f.fwd.y * f.size * 0.6, z: f.pos.z + f.fwd.z * f.size * 0.6 }, tmp, 'laser');
    f.shots += 1;
    if (f.shots >= 3) {
      f.shots = 0;
      f.cool = f.type.burst[1] * (0.8 + rand() * 0.4);
    } else f.cool = f.type.burst[0];
  };

  // ── the capital ships' batteries ──
  const aimAt = v3();
  const fireBatteries = (cap, dt) => {
    if (!cap.alive || cap.dying > 0 || cap.disabled > 0) return;
    const enemy = 1 - cap.team;
    for (const tu of cap.turrets) {
      if (!tu.alive) continue;
      tu.turbo -= dt;
      tu.flak -= dt;
      if (tu.turbo <= 0) {
        tu.turbo = between([1.2, 2.6]);
        const foes = b.capitals.filter((c) => c.team === enemy && c.alive && c.dying <= 0);
        if (foes.length) {
          const foe = foes[Math.floor(rand() * foes.length)];
          const sp = foe.spheres[Math.floor(rand() * foe.spheres.length)];
          // somewhere on it, or a near miss
          const miss = rand() < 0.4 ? foe.size * 0.25 : 0;
          set(aimAt, sp.c.x + (rand() - 0.5) * (sp.r + miss), sp.c.y + (rand() - 0.5) * (sp.r + miss), sp.c.z + (rand() - 0.5) * (sp.r + miss));
          b.fire(cap.team, tu.at, set(tmp, aimAt.x - tu.at.x, aimAt.y - tu.at.y, aimAt.z - tu.at.z), 'turbo');
        }
      }
      if (tu.flak <= 0) {
        tu.flak = between([0.35, 0.7]);
        // point-defence at the nearest of the other side's fighters (or you) close by
        let near = null;
        let nd = BATTLE.flak * BATTLE.flak;
        for (const f of b.fighters) {
          if (!f.alive || f.team === cap.team) continue;
          const d = dist2(f.pos, tu.at);
          if (d < nd) {
            nd = d;
            near = f;
          }
        }
        const youNear = youIn() && b.you.team !== cap.team && dist2(b.you.pos, tu.at) < nd;
        const tp = youNear ? b.you.pos : near?.pos;
        if (tp) {
          const s = 0.1;
          set(tmp, tp.x - tu.at.x, tp.y - tu.at.y, tp.z - tu.at.z);
          const l = len(tmp);
          set(tmp, tmp.x / l + (rand() - 0.5) * s, tmp.y / l + (rand() - 0.5) * s, tmp.z / l + (rand() - 0.5) * s);
          b.fire(cap.team, tu.at, tmp, 'flak');
        }
      }
    }
  };

  // ── the bolts in flight ──
  const p0 = v3();
  const p1 = v3();
  const moveBolts = (dt, out) => {
    const youOk = youIn() && !b.over;
    for (const o of b.bolts) {
      if (!o.on) continue;
      o.life -= dt;
      if (o.life <= 0) {
        o.on = false;
        continue;
      }
      // a torpedo homes in a little on what it was fired at
      if (o.kind === 'torpedo' && o.target?.pos && (o.target.alive ?? true)) {
        const tp = o.target.pos;
        set(tmp, tp.x - o.x, tp.y - o.y, tp.z - o.z);
        norm(tmp);
        const sp = BATTLE.bolts.torpedo.speed;
        const nd = turnToward(norm(set(want, o.vx, o.vy, o.vz)), tmp, 1.2 * dt);
        o.vx = nd.x * sp;
        o.vy = nd.y * sp;
        o.vz = nd.z * sp;
      }
      set(p0, o.x, o.y, o.z);
      set(p1, o.x + o.vx * dt, o.y + o.vy * dt, o.z + o.vz * dt);
      const step = Math.sqrt(dist2(p0, p1));
      let done = false;
      // a fighter of the other side (not the capitals' turbolasers: they're after ships)
      if (o.kind !== 'turbo') {
        let hitF = null;
        let first = Infinity;
        for (const f of b.fighters) {
          if (!f.alive || f.team === o.team) continue;
          if (dist2(f.pos, p1) > (step + 3) ** 2) continue;
          const k = sweptHit(p0, p1, f.prev, f.pos, f.size * 0.6);
          if (k !== null && k < first) {
            first = k;
            hitF = f;
          }
        }
        if (hitF) {
          hitF.hp -= o.damage;
          if (hitF.hp <= 0) out.push(kill(hitF, false));
          done = true;
        }
      }
      // a runner of the other side
      if (!done) {
        for (const r of b.runners) {
          if (!r.alive || r.team === o.team) continue;
          if (sweptHit(p0, p1, r.prev, r.pos, r.size * 0.5) === null) continue;
          r.hp -= o.damage;
          r.hitBy += 1;
          if (r.hp <= 0) {
            r.alive = false;
            out.push({ type: 'runner', id: r.id, team: r.team, kind: r.kind, at: copy(v3(), r.pos) });
          }
          done = true;
          break;
        }
      }
      // you
      if (!done && youOk && o.team !== b.you.team && sweptHit(p0, p1, b.you.prev, b.you.pos, 0.3) !== null) {
        out.push({ type: 'hurt', damage: BATTLE.youHurt[o.kind], kind: o.kind });
        done = true;
      }
      // a capital ship of the other side: an objective, or its hull
      if (!done) {
        const h = capitalHit(p0, p1, o.team);
        if (h) {
          done = true;
          if (h.sub && subHit(h.sub, o.damage * BATTLE.aiShare, false, out)) {
            // (counted on the objective)
          } else if (shielded(h.cap)) out.push({ type: 'impact', at: h.at, size: o.kind === 'turbo' ? 1.6 : 0.6, shield: true });
          else {
            hullHit(h.cap, o.damage * BATTLE.hullShare[o.kind], out);
            if (o.kind !== 'laser' && o.kind !== 'flak') out.push({ type: 'impact', at: h.at, size: o.kind === 'turbo' ? 1.4 : 1, shield: false });
          }
        }
      }
      if (done) o.on = false;
      else {
        o.x = p1.x;
        o.y = p1.y;
        o.z = p1.z;
      }
    }
  };

  // ── the phases and the end ──
  const checkPhase = (out) => {
    const flag = objOf();
    if (!flag) return;
    // (other pilots may have taken more than one phase's down since the last frame)
    while (b.phase <= 3 && !flag.subs.some((s) => s.phase === b.phase && s.alive)) {
      b.phase += 1;
      if (b.phase === 2) out.push({ type: 'shield', down: true });
      if (b.phase <= 3) out.push({ type: 'phase', phase: b.phase });
      else if (flag.dying <= 0) flag.dying = BATTLE.dying;
    }
  };
  const finish = (winner, why, out) => {
    if (b.over) return;
    b.over = { winner, why };
    out.push({ type: 'over', winner, why });
  };
  const ageCapitals = (dt, out) => {
    for (const cap of b.capitals) {
      if (!cap.alive || cap.dying <= 0) continue;
      cap.dying -= dt;
      if (cap.dying > 0) continue;
      cap.dying = 0;
      cap.alive = false;
      out.push({ type: 'capital', id: cap.id, kind: cap.kind, team: cap.team, at: copy(v3(), cap.pos) });
      if (cap.objective && cap.role !== 'flagship') finish(attacker, cap.kind, out);
      else if (cap.role === 'flagship') finish(cap.team === defender ? attacker : defender, 'flagship', out);
    }
  };

  // ── runners for the jump ──
  // (a battle's own: `runners` { team, kind, size, hp, count, need, speed,
  // every, from, to, spread }: one launched every `every` seconds from about
  // `from` for about `to`; `need` of them out wins it for their side, all of
  // them down with fewer out loses it)
  const run = runners ? { ...runners, launched: 0, out: 0, wait: 0 } : null;
  const launchRunners = (dt) => {
    if (!run || b.over || run.launched >= run.count) return;
    run.wait -= dt;
    if (run.wait > 0) return;
    run.wait = run.every;
    const sp = run.spread ?? 6;
    const jitter = (p) => ({ x: p[0] + (rand() - 0.5) * sp, y: p[1] + (rand() - 0.5) * sp * 0.4, z: p[2] + (rand() - 0.5) * sp });
    b.addRunner({ team: run.team, kind: run.kind, size: run.size, hp: run.hp, from: jitter(run.from), to: jitter(run.to), speed: run.speed });
    run.launched += 1;
  };
  const judgeRunners = (out, from) => {
    if (!run || b.over) return;
    for (let i = from; i < out.length; i++) if (out[i].type === 'escaped' && out[i].team === run.team) run.out += 1;
    if (run.out >= run.need) finish(run.team, 'runners', out);
    else if (run.launched >= run.count && !b.runners.some((r) => r.alive && r.team === run.team)) finish(1 - run.team, 'runners', out);
  };
  const flyRunners = (dt, out) => {
    for (const r of b.runners) {
      if (!r.alive) continue;
      copy(r.prev, r.pos);
      set(tmp, r.to.x - r.pos.x, r.to.y - r.pos.y, r.to.z - r.pos.z);
      const d = len(tmp);
      const step = r.speed * dt;
      if (d <= step) {
        copy(r.pos, r.to);
        r.alive = false;
        r.escaped = true;
        out.push({ type: 'escaped', id: r.id, team: r.team, kind: r.kind, at: copy(v3(), r.pos) });
        continue;
      }
      set(r.fwd, tmp.x / d, tmp.y / d, tmp.z / d);
      set(r.vel, r.fwd.x * r.speed, r.fwd.y * r.speed, r.fwd.z * r.speed);
      r.pos.x += r.vel.x * dt;
      r.pos.y += r.vel.y * dt;
      r.pos.z += r.vel.z * dt;
    }
  };
  b.addRunner = ({ team, kind, size, hp, from, to, speed }) => {
    const r = { id: nextId++, team, kind, size, hp, hpMax: hp, role: 'runner', pos: v3(from.x, from.y, from.z), prev: v3(from.x, from.y, from.z), vel: v3(), fwd: v3(0, 0, 1), to: v3(to.x, to.y, to.z), speed, alive: true, escaped: false, hitBy: 0, chased: -1 };
    r.tgt = { id: r.id, at: r.pos, vel: r.vel, size, kind, name: NAMES[kind] ?? kind, hp, hpMax: hp, threat: 0 };
    b.runners.push(r);
    return r;
  };

  // ── an ion cannon's hit, and a capital ship moved or turned (the set pieces') ──
  // a capital ship gone (the second Death Star's superlaser, a reactor blown from inside)
  b.wreck = (id) => {
    const cap = b.capitals.find((c) => c.id === id);
    if (!cap || !cap.alive || cap.dying > 0) return;
    cap.hull = 0;
    cap.dying = cap.role === 'flagship' ? BATTLE.dying : 2.5;
    pending.push({ type: 'impact', at: copy(v3(), cap.pos), size: cap.size * 0.3, shield: false });
  };
  b.disable = (id, seconds) => {
    const cap = b.capitals.find((c) => c.id === id);
    if (!cap || !cap.alive) return;
    cap.disabled = Math.max(cap.disabled, seconds);
    pending.push({ type: 'disabled', id, at: copy(v3(), cap.pos), size: cap.size });
  };
  const points = (cap) => [cap.pos, ...cap.spheres.map((sp) => sp.c), ...cap.turrets.map((tu) => tu.at), ...cap.subs.map((sb) => sb.pos)];
  b.moveCapital = (cap, d) => {
    for (const p of points(cap)) set(p, p.x + d.x, p.y + d.y, p.z + d.z);
    cap.moved = true;
  };
  const rotate = (o, ax, c, sn) => {
    // Rodrigues: about the unit axis `ax`
    const k = dot(ax, o);
    const cx = ax.y * o.z - ax.z * o.y;
    const cy = ax.z * o.x - ax.x * o.z;
    const cz = ax.x * o.y - ax.y * o.x;
    return set(o, o.x * c + cx * sn + ax.x * k * (1 - c), o.y * c + cy * sn + ax.y * k * (1 - c), o.z * c + cz * sn + ax.z * k * (1 - c));
  };
  b.turnCapital = (cap, axis, angle) => {
    cap.moved = true;
    const ax = norm(copy(v3(), axis));
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    for (const dir of [cap.fwd, cap.up, cap.right]) norm(rotate(dir, ax, c, sn));
    const o = cap.pos;
    for (const p of points(cap).slice(1)) {
      set(tmp, p.x - o.x, p.y - o.y, p.z - o.z);
      rotate(tmp, ax, c, sn);
      set(p, o.x + tmp.x, o.y + tmp.y, o.z + tmp.z);
    }
  };

  b.update = (dt, you) => {
    dt = Math.min(dt, 0.1);
    const out = events;
    out.length = 0;
    out.push(...pending);
    pending.length = 0;
    if (!b.over) b.clock += dt;
    // where you are, and how fast you're going
    if (you) {
      copy(b.you.prev, b.you.alive ? b.you.pos : you);
      set(b.you.pos, you.x, you.y, you.z);
      set(b.you.vel, (b.you.pos.x - b.you.prev.x) / Math.max(dt, 1e-4), (b.you.pos.y - b.you.prev.y) / Math.max(dt, 1e-4), (b.you.pos.z - b.you.prev.z) / Math.max(dt, 1e-4));
      b.you.alive = you.alive !== false;
    } else b.you.alive = false;
    for (const f of b.fighters) {
      if (f.alive) flyFighter(f, dt);
      else if (Number.isFinite(f.respawn) && !b.over) {
        f.respawn -= dt;
        if (f.respawn <= 0) {
          spawn(f, false);
          out.push({ type: 'arrive', team: f.team, kind: f.kind, at: copy(v3(), f.pos) });
        }
      }
    }
    for (const cap of b.capitals) if (cap.disabled > 0) cap.disabled = Math.max(0, cap.disabled - dt);
    launchRunners(dt);
    const before = out.length;
    flyRunners(dt, out);
    judgeRunners(out, before);
    if (!b.over) for (const cap of b.capitals) fireBatteries(cap, dt);
    moveBolts(dt, out);
    if (!b.over) sharedSubs(out);
    checkPhase(out);
    ageCapitals(dt, out);
    if (!b.over) {
      const t = b.teams[attacker];
      if (tickets && t.tickets <= 0 && !b.fighters.some((f) => f.alive && f.team === attacker)) finish(defender, 'tickets', out);
      else if (b.clock >= clock) finish(defender, 'clock', out);
    }
    return out;
  };

  // your shot, from `from` to `to` this frame: the first of the other side's
  // fighters, objectives or hulls it meets
  b.hit = (from, to, damage = 1) => {
    if (b.you.team === null || b.over) return null;
    let hitF = null;
    let first = Infinity;
    for (const f of b.fighters) {
      if (!f.alive || f.team === b.you.team) continue;
      const k = sweptHit(from, to, f.prev, f.pos, Math.max(0.35, f.size * 0.9));
      if (k !== null && k < first) {
        first = k;
        hitF = f;
      }
    }
    // (or a runner of the other side's, nearer)
    let hitR = null;
    for (const r of b.runners) {
      if (!r.alive || r.team === b.you.team) continue;
      const k = sweptHit(from, to, r.prev, r.pos, Math.max(0.5, r.size * 0.5));
      if (k !== null && k < first) {
        first = k;
        hitR = r;
        hitF = null;
      }
    }
    const h = capitalHit(from, to, b.you.team);
    // a battery on one of the other side's capital ships, if it's nearer than either
    let tu = null;
    let tk = Infinity;
    for (const cap of b.capitals) {
      if (cap.team === b.you.team || !cap.alive || cap.dying > 0) continue;
      if (dist2(cap.pos, to) > (cap.reach + 10) ** 2) continue;
      for (const t of cap.turrets) {
        if (!t.alive) continue;
        const k = sweptHit(from, to, t.at, t.at, t.r);
        if (k !== null && k < tk) {
          tk = k;
          tu = t;
        }
      }
    }
    if (tu && tk <= first && (!h || tk <= h.k)) {
      tu.hp -= damage;
      const down = tu.hp <= 0;
      if (down) {
        tu.alive = false;
        pending.push({ type: 'turret', id: tu.num, cap: tu.cap.id, at: copy(v3(), tu.at), mine: true });
      }
      return { id: tu.num, kind: 'turret', at: copy(v3(), tu.at), size: tu.r, down, turret: true };
    }
    if (hitR && (!h || first <= h.k)) {
      hitR.hp -= damage;
      hitR.hitBy += 1;
      const down = hitR.hp <= 0;
      if (down) {
        hitR.alive = false;
        pending.push({ type: 'runner', id: hitR.id, team: hitR.team, kind: hitR.kind, at: copy(v3(), hitR.pos), mine: true });
      }
      return { id: hitR.id, kind: hitR.kind, at: copy(v3(), hitR.pos), size: hitR.size, down };
    }
    if (hitF && (!h || first <= h.k)) {
      hitF.hp -= damage;
      const down = hitF.hp <= 0;
      if (down) pending.push(kill(hitF, true));
      return { id: hitF.id, kind: hitF.kind, at: copy(v3(), hitF.pos), size: hitF.size, down };
    }
    if (!h) return null;
    if (h.sub && subHit(h.sub, damage * BATTLE.youShare, true, pending)) return { id: h.sub.num, kind: 'subsystem', sub: h.sub.id, at: h.at, size: 1, down: !h.sub.alive };
    if (shielded(h.cap)) {
      pending.push({ type: 'impact', at: h.at, size: 0.6, shield: true });
      return { id: h.cap.id, kind: 'shield', at: h.at, size: 0.4, down: false, shield: true };
    }
    hullHit(h.cap, damage * BATTLE.youShare * BATTLE.youHull, pending);
    return { id: h.cap.id, kind: h.cap.kind, at: h.at, size: 0.4, down: false, capital: true };
  };

  // what your guns can lock on to: the other side's fighters, then the
  // objectives of the phase (when you're the attacker)
  const targets = [];
  const near = [];
  Object.defineProperty(b, 'targets', {
    get() {
      targets.length = 0;
      if (b.you.team === null || b.over) return targets;
      for (const f of b.fighters) {
        if (!f.alive || f.team === b.you.team) continue;
        f.tgt.hp = f.hp;
        f.tgt.threat = f.target === b.you ? 1 : 0;
        targets.push(f.tgt);
      }
      // the other side's runners, and the batteries near you (a run down a hull)
      for (const r of b.runners) if (r.alive && r.team !== b.you.team) targets.push(Object.assign(r.tgt, { hp: r.hp }));
      if (b.you.alive) {
        near.length = 0;
        for (const cap of b.capitals) {
          if (cap.team === b.you.team || !cap.alive || cap.dying > 0 || dist2(cap.pos, b.you.pos) > (cap.reach + BATTLE.turretsNear) ** 2) continue;
          for (const t of cap.turrets) {
            if (!t.alive) continue;
            const d = dist2(t.at, b.you.pos);
            if (d < BATTLE.turretsNear ** 2) near.push([d, t]);
          }
        }
        near.sort((p, q) => p[0] - q[0]);
        for (const [, t] of near.slice(0, 10)) {
          t.tgt ??= { id: t.num, at: t.at, vel: ZERO, size: t.r, kind: 'turret', name: NAMES.turret ?? 'Turbolaser battery', threat: 0, hp: 0, hpMax: BATTLE.turretHp };
          t.tgt.hp = t.hp;
          targets.push(t.tgt);
        }
      }
      if (b.you.team === attacker) {
        const flag = objOf();
        for (const s of flag?.subs ?? []) {
          if (!s.alive || s.hidden || s.phase !== b.phase) continue;
          s.tgt ??= { id: s.num, at: s.pos, vel: ZERO, size: s.r, kind: 'subsystem', name: NAMES[s.kind], sub: s.id, threat: 0, hp: 0, hpMax: s.hpMax };
          s.tgt.hp = s.hp;
          targets.push(s.tgt);
        }
      }
      return targets;
    },
  });

  // for the HUD and for checking from a browser
  Object.defineProperty(b, 'info', {
    get() {
      const flag = objOf();
      const own = flagOf(attacker);
      return {
        phase: b.phase,
        clock: +b.clock.toFixed(1),
        left: Math.max(0, clock - b.clock),
        tickets: b.teams.map((t) => t.tickets),
        fighters: [0, 1].map((team) => b.fighters.filter((f) => f.alive && f.team === team).length),
        objectives: (flag?.subs ?? []).map((s) => ({ id: s.id, kind: s.kind, phase: s.phase, hp: s.hp / s.hpMax })),
        hull: [own ? own.hull / own.hullMax : 0, flag ? (flag.alive ? 1 - (b.phase - 1) / 3 : 0) : 0],
        over: b.over,
      };
    },
  });

  b.end = (winner, why = 'forced') => finish(winner, why, pending);
  return b;
}
