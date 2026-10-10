// Cover as the game's queries choose it (`AI/BattleAI/Cover/Queries/*` in the
// selection form, ai.json's `coverQueries`, with their shared score asset,
// `coverScores`): the slots round the bot inside the query's radius, each
// scored by the query's scores and the score asset's, every score a curve
// (`curve.js`, clamped to its range) times its scale. A score whose curve
// reads −1 or less rejects the slot (the records' "[-] Reject …" curves).
// The scores read, and what each one's x is:
//
//   AngleToActor               the angle at the slot between the solid's face and the target (or the bot);
//                              the cover-shape variants (a RuntimeFilter's low bits) count by their best
//   AngleFromReferenceDirection  the angle at RefDirFromPos between its line to RefDirToPos and its line to the slot
//   DistanceToActor            the slot to the target (or the bot)
//   PathDistance               the bot to the slot, straight (the navgrid's path is the brain's to find)
//   DistanceToMultiTargets     the slot to the enemies inside MaxDistanceToTarget (nearest, or their mean)
//   DistanceToClosestEnemyCover  the slot to the nearest enemy (the enemies' cover, where they stand)
//   DistanceToClosestFriendly  the slot to the nearest friend
//   PreferredWeaponRange       the slot to the target, against the weapon's PreferredRange (Start, Ideal, End):
//                              a curve over −1…1 is centred on the ideal, one over 0…1 runs Start → End
//   LineOfFire                 1 with a line to the target from the slot (standing, or round the side), else 0
//   ProjectedDistance          the bot → slot along the bot → target line, over that line's length
//   CoverFilter                MatchingScore for a protected slot (full height: `PROTECTED`)
//   CurrentCoverBonus          BonusScore for the slot the bot holds
//   DistanceToCorpse           the slot to the nearest corpse (none: the curve's far end)
//   RejectUnreachableCover     (every navgrid slot is reachable: 0)
//
// Every other score (path avoidance, nav probes, the follow and exposure
// scores) adds nothing and is counted once in `unreadScores`. A slot must
// shield from the target and its solid stand between them (`cover.js`'s
// `covered`); a slot another bot holds is not offered. The best slot above
// nothing wins; none, and the brain falls back to `cover.js`'s pickCover. Pure.
//
//   queryFor(ai, tactics, state) → a coverQueries row | null      state: attack | hide | flee | protective
//   runQuery(query, ctx) → slot | null
//     ctx: { common (ai.coverScores), nav, me: [x, z], meY, threat: [x, z], threatY, enemies: [[x, z]],
//            friends: [[x, z]], corpses: [[x, z]], preferred: { Start, Ideal, End }, current, taken, who }
//   unreadScores: Set of score kinds met and not read

import { coverSlots, shields } from '../nav.js';
import { covered, lineOfFire } from './cover.js';
import { curveAt } from './curve.js';

export const unreadScores = new Set();

// The farthest a query looks, whatever its radius (Attack_PvE's 70 m), by hand: the brain's budget.
export const MAX_SEARCH = 40;
// The cover-filter mask the records mark "[+] Protected Covers Additional Score": a full-height slot.
export const PROTECTED = 3801088;
// A RuntimeFilter whose low 20 bits are set names a cover shape (left, right, top blocked).
const SHAPE_BITS = 0xfffff;

// Each state's queries in the tactics row, the first in the selection form taken.
const ASKS = {
  attack: ['attack.goalCoverQuery'],
  hide: ['hide.coverQuery', 'attack.hideCoverQuery'],
  flee: ['flee.coverQuery'],
  protective: ['attack.protectionCoverQuery'],
};

export function queryFor(ai, tactics, state) {
  for (const k of ASKS[state] ?? []) {
    const name = tactics?.queries?.[k];
    if (name && ai.coverQueries?.[name]) return ai.coverQueries[name];
  }
  return null;
}

const DEG = 180 / Math.PI;
const angle = (ax, az, bx, bz) => Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * DEG;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (p, list) => (list?.length ? Math.min(...list.map((q) => dist(p, q))) : null);

function where(name, ctx) {
  if (name === 'Soldier' || name === 'ActorPosition') return ctx.me;
  return ctx.threat; // Target, CriticalThreat, TargetPosition
}

// a score's x for a slot; undefined: the score is not read
function xOf(s, ctx, slot, p) {
  switch (s.type) {
    case 'AngleToActor': {
      const to = where(s.ref, ctx);
      return angle(-slot.normal[0], -slot.normal[1], to[0] - p[0], to[1] - p[1]);
    }
    case 'AngleFromReferenceDirection': {
      const from = where(s.refDirFromPos, ctx);
      const to = where(s.refDirToPos, ctx);
      return angle(to[0] - from[0], to[1] - from[1], p[0] - from[0], p[1] - from[1]);
    }
    case 'DistanceToActor':
      return dist(p, where(s.ref, ctx));
    case 'PathDistance':
      return dist(ctx.me, p);
    case 'DistanceToMultiTargets': {
      const near = (ctx.enemies ?? []).filter((e) => !(s.excludePrimaryTarget && dist(e, ctx.threat) < 0.5)).map((e) => dist(p, e)).filter((d) => d <= s.maxDistanceToTarget);
      if (!near.length) return null;
      return s.scoringMode === 'Average' ? near.reduce((a, b) => a + b, 0) / near.length : Math.min(...near);
    }
    case 'DistanceToClosestEnemyCover':
      return nearest(p, ctx.enemies);
    case 'DistanceToClosestFriendly':
      return nearest(p, ctx.friends);
    case 'PreferredWeaponRange': {
      const P = ctx.preferred;
      if (!P || !(P.End > P.Start)) return null;
      const d = dist(p, ctx.threat);
      const ideal = P.Start + P.Ideal * (P.End - P.Start);
      return s.curve.min < 0 ? (d - ideal) / ((P.End - P.Start) / 2) : (d - P.Start) / (P.End - P.Start);
    }
    case 'LineOfFire':
      return lineOfFire(ctx.nav, slot, ctx.threat, ctx.threatY) ? 1 : 0;
    case 'ProjectedDistance': {
      const ax = ctx.threat[0] - ctx.me[0];
      const az = ctx.threat[1] - ctx.me[1];
      const L = Math.hypot(ax, az) || 1;
      const x = ((p[0] - ctx.me[0]) * ax + (p[1] - ctx.me[1]) * az) / (L * L);
      return s.flipRefDirection ? -x : x;
    }
    case 'DistanceToCorpse':
      return nearest(p, ctx.corpses) ?? s.curve.max;
    default:
      return undefined;
  }
}

// a slot's score under the query and its score asset; null rejects it
function scoreSpot(scores, ctx, slot) {
  const p = [slot.at[0], slot.at[2]];
  let total = 0;
  let shape = null;
  for (const s of scores) {
    let v;
    if (s.type === 'CoverFilter') {
      if (s.runtimeFilter !== PROTECTED) {
        unreadScores.add(`CoverFilter:${s.runtimeFilter}`);
        continue;
      }
      v = slot.height === 'stand' ? s.matchingScore : 0;
    } else if (s.type === 'CurrentCoverBonus') v = slot === ctx.current ? s.bonusScore : 0;
    else if (s.type === 'RejectUnreachableCover') continue;
    else {
      const x = xOf(s, ctx, slot, p);
      if (x === undefined || !s.curve) {
        unreadScores.add(s.type);
        continue;
      }
      if (x === null) continue;
      const y = curveAt(s.curve, x);
      if (y <= -1) return null;
      v = y * (s.scale ?? 1);
    }
    if (s.type === 'AngleToActor' && s.runtimeFilter & SHAPE_BITS) shape = Math.max(shape ?? -Infinity, v);
    else total += v;
  }
  return total + (shape ?? 0);
}

export function runQuery(query, ctx) {
  if (!query || !ctx.threat || !ctx.nav) return null;
  const scores = [...query.scores, ...(ctx.common?.[query.common]?.scores ?? [])];
  const r = Math.min(query.radius ?? query.pathSearch ?? MAX_SEARCH, MAX_SEARCH);
  let best = null;
  let bestScore = 0;
  let bestD = Infinity;
  for (const slot of coverSlots(ctx.nav, ctx.me, r)) {
    if (!shields(slot, ctx.threat) || !covered(ctx, slot)) continue;
    if (ctx.taken?.has(slot) && ctx.taken.get(slot) !== ctx.who) continue;
    const score = scoreSpot(scores, ctx, slot);
    if (score === null) continue;
    const d = Math.hypot(slot.at[0] - ctx.me[0], slot.at[2] - ctx.me[1]);
    if (score > bestScore || (score === bestScore && best && d < bestD)) {
      best = slot;
      bestScore = score;
      bestD = d;
    }
  }
  return best;
}
