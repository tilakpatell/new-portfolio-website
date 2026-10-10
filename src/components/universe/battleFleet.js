// A battle's capital ships fought as fleets (battleCapitals.js lays them out
// and fires their batteries; this is how the galaxy's battles fight them,
// under createBattle's `tactics`, and the universe map's wars don't). Pure
// (no three.js), tested in Node through battle.js.
//
// Each battery fired at a random ship of the other side's and a random
// point on it, two in five of them near misses on purpose, and no ship ever
// moved: two lines trading fire at nothing in particular. So:
// - every FLEET.every seconds each side picks its focus: the attacker the
//   ship the objectives are on, the defender the attacker's most hurt ship
//   (its flagship, while none is); FLEET.share of each ship's batteries fire
//   at the focus, every shot meant, and the rest at the nearest of the other
//   side's ships, with the near misses as before;
// - at the final push (FLEET.push, or the plan's), the attacker's escorts
//   come forward FLEET.advance units a second for FLEET.pushFor seconds, and
//   both lines' escorts turn up to FLEET.turn to bring a flank to bear.
//   Where each is is worked out from the battle's clock, so a pilot arriving
//   late sees them where one there all along does; each move is told
//   (`onMove`, warfront.js's ctx.moveHull, so the ship's hull you bump into
//   moves with it). Not a ship a set piece has moved (`held`: the Scarif
//   ram), nor the one the objectives are on, nor a flagship;
// - an escort down to FLEET.jump of its hull jumps out (a 'jumped' event:
//   a flash, and gone; not destroyed);
// - once the battle's over, the losing fleet jumps out, a ship every
//   FLEET.jumpEvery seconds from the end (its fighters go home:
//   battleFlights.js). One arriving after it's over sees them gone already
//   (said `late`, no flash).
//
// createFleet(k, { push, onMove, clock }) → { focusOf(team), aim(cap, tu) → { foe,
// focus } | null, step(dt, out) }. `k` is the battle's inner context
// (battle.js's createBattle).

import { UP, copy, dist2, v3 } from './battleKit';
import { shiftCapital, turnCapitalBy } from './battleCapitals';

export const FLEET = {
  every: 15, // seconds between a fleet's choice of its focus
  share: 0.6, // of its batteries on the focus
  push: 480, // the final push, unless the plan says
  advance: 1.2, // units a second the attacker's escorts come forward in it
  pushFor: 40, // for this many seconds
  turn: (25 * Math.PI) / 180, // the most both lines' escorts turn to bring a flank to bear
  jump: 0.15, // an escort with less of its hull than this jumps out
  jumpEvery: 3, // and once it's over, a ship of the losing fleet every this many seconds
};

const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

export function createFleet(k, { push = FLEET.push, onMove = null, clock = null } = {}) {
  const { b } = k;
  // (the push on the clock every pilot shares, in the galaxy: `clock`; else the battle's own)
  const now = clock ?? (() => b.clock);
  const focus = [null, null];
  let chosen = -1; // the last FLEET.every the focus was chosen in
  let gone = 0; // ships of the losing fleet jumped out since it ended
  let overAt = null; // when it ended, on the clock (the shared one, in the galaxy)

  // FLEET.share of each ship's batteries are on the focus (three in five, in turn down its length)
  for (const cap of b.capitals) cap.turrets.forEach((tu, i) => (tu.focus = i % 5 < 5 * FLEET.share));
  // the way each ship's line faces (it comes forward along it), and how far it's come and turned
  for (const cap of b.capitals) {
    cap.toward = copy(v3(), cap.fwd);
    cap.advanced = 0;
    cap.swung = 0;
  }

  const up = (c) => c.alive && c.dying <= 0;
  const choose = (team) => {
    if (team === k.attacker) {
      const ship = k.objOf();
      return ship && up(ship) ? ship : (b.capitals.find((c) => c.team !== team && up(c) && c.role === 'flagship') ?? b.capitals.find((c) => c.team !== team && up(c)) ?? null);
    }
    // (the attacker's most hurt ship, or its flagship while none is)
    let worst = null;
    for (const c of b.capitals) if (c.team !== team && up(c) && c.tracked && c.hull < c.hullMax && (!worst || c.hull / c.hullMax < worst.hull / worst.hullMax)) worst = c;
    return worst ?? b.capitals.find((c) => c.team !== team && up(c) && c.role === 'flagship') ?? b.capitals.find((c) => c.team !== team && up(c)) ?? null;
  };
  const jump = (cap, out, late = false) => {
    cap.alive = false;
    cap.jumped = true;
    out.push({ type: 'jumped', id: cap.id, kind: cap.kind, team: cap.team, at: copy(v3(), cap.pos), size: cap.size, ...(late ? { late: true } : {}) });
  };
  // (the ships the push moves and turns)
  const free = (c) => c.role === 'escort' && !c.objective && !c.held && up(c);

  return {
    focusOf: (team) => focus[team],
    // what a battery fires at: the focus, every shot meant, or the nearest of the other side's ships
    aim(cap, tu) {
      const f = focus[cap.team];
      if (tu.focus && f && up(f)) return { foe: f, focus: true };
      let foe = null;
      let fd = Infinity;
      for (const c of b.capitals) {
        if (c.team === cap.team || !up(c)) continue;
        const d = dist2(c.pos, tu.at);
        if (d < fd) (fd = d), (foe = c);
      }
      return foe ? { foe, focus: false } : null;
    },
    step(dt, out) {
      // the focus, chosen again every FLEET.every seconds, or when it's gone
      const n = Math.floor(b.clock / FLEET.every);
      for (const team of [0, 1]) if (n !== chosen || !focus[team] || !up(focus[team])) focus[team] = choose(team);
      chosen = n;
      if (b.over) {
        // the losing fleet out, a ship every few seconds from the end (on the
        // shared clock, in the galaxy: a slow screen steps its battle slower
        // than the clock runs, and would see the fleet go after everyone else)
        overAt ??= now() - (b.since ?? 0);
        const since = clock ? now() - overAt : (b.since ?? 0);
        const due = Math.floor(since / FLEET.jumpEvery + 1e-9);
        for (const cap of b.capitals) {
          if (gone >= due) break;
          if (cap.team === b.over.winner || !up(cap)) continue;
          // (one that went more than a few seconds before you'd have seen it: no flash)
          jump(cap, out, since - (gone + 1) * FLEET.jumpEvery > FLEET.jumpEvery);
          gone += 1;
        }
        return;
      }
      // an escort nearly gone, out
      for (const cap of b.capitals) if (cap.role === 'escort' && !cap.objective && up(cap) && cap.tracked && cap.hull < cap.hullMax * FLEET.jump) jump(cap, out);
      // the push: where each escort is by now, and how far it's turned
      const p = clamp01((now() - push) / FLEET.pushFor);
      if (p <= 0) return;
      for (const cap of b.capitals) {
        if (!free(cap)) continue;
        let moved = false;
        if (cap.team === k.attacker) {
          const d = FLEET.advance * FLEET.pushFor * p - cap.advanced;
          if (d > 1e-9) {
            shiftCapital(cap, v3(cap.toward.x * d, cap.toward.y * d, cap.toward.z * d));
            cap.advanced += d;
            moved = true;
          }
        }
        const a = FLEET.turn * p - cap.swung;
        if (a > 1e-9) {
          turnCapitalBy(cap, UP, cap.team === 0 ? a : -a);
          cap.swung += a;
          moved = true;
        }
        if (moved) onMove?.(cap);
      }
    },
  };
}
