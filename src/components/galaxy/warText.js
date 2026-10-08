// A system's place in one of the galaxy's wars, in words and a colour, for
// the holotable (HoloMap.jsx) and the galaxy panel. Pure, tested. A row is
// gcw.js's warTable row: `control` is its holder's hold of it, so a front's
// progress is how much of that hold is gone, and an attacked system's is how
// much is left.
//
// progressOf(row) → 0..1; standing(row, now) → a line; heldColour(side);
// areaLines(areas, side) → [{ id, name, text, yours }]; recordLine(side,
// record) → your rank and record (warState.js's mine) | null; oathOf(war,
// current, suggested) → the war's two sides for the oath's buttons;
// battleLine(row, now, side) → a system's battle, its kind for your part in it.
//
// And the battle you're in, as warfront.js's info has it (WarHud.jsx's lines
// under its own, BattleEnd.jsx's card): stageLine(info) → 'Stage 2 of 3 ·
// Destroy: Bridge' (or what opens next, and when); objectiveBars(info) → up
// to three [{ id, name, k, down }]; nextLine(next) → 'Bomber wave in 0:40';
// whyLine(result) → why it ended, in words; resultTitle(result, team) →
// 'Victory' | 'Defeat' | 'Battle over'; yoursLine(yours) → what you did in
// it; afterLine(info, sysName, now) → 'Victory at Hoth · next battle in
// 4:05' (a battle decided early: the rest of its window's the end card's and
// that line's); endCard(info) → { title, tone, why, yours, points } | null;
// cardTime(info) → the seconds BattleEnd.jsx's card is still to show (END.show
// from the end; none to a pilot who came after).

import { BATTLE_KINDS } from './battles';
import { rankOf } from './ranks';
import { AREAS, SIDES, WARS } from './sides';
import { typeOf } from '../universe/battleObjectives';

// how long, as the war table says it: 4:05, 1h 12m, 2d 3h
export const span = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(s / 3600);
  return h < 48 ? `${h}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};
const pctOf = (k) => `${Math.round(k * 100)}%`;
const rateOf = (r) => `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(1)}%/h`;

export const progressOf = (row) => (row.attack ? row.control : 1 - row.control);

export function standing(row, now) {
  if (row.attack) {
    const by = row.attack.by === 'hutt' ? 'The Hutts raid' : `The ${SIDES[row.attack.by].short} attacks`;
    return `${by}: ${pctOf(row.control)} held, ${span(row.attack.until - now)} to hold out`;
  }
  if (row.front) return `${pctOf(progressOf(row))} liberated · ${rateOf(row.rate)}`;
  if (row.owner === 'hutt') return 'Hutt space';
  return `Held by the ${SIDES[row.owner].short}`;
}

export const heldColour = (side) => SIDES[side]?.colour;

const theSide = (side) => (side === 'hutt' ? 'Hutt space' : `The ${SIDES[side].short}’s`);
const ofThe = (side) => (side === 'hutt' ? 'the Hutts’' : `the ${SIDES[side].short}’s`);

export function areaLines(areas, side) {
  return AREAS.filter((a) => areas[a.id]).map((a) => {
    const r = areas[a.id];
    if (r.holder) return { id: a.id, name: a.name, text: `${theSide(r.holder)}, all ${r.total}`, yours: r.holder === side };
    return { id: a.id, name: a.name, text: side ? `${r[side] ?? 0} of ${r.total} ${ofThe(side)}` : `Contested, ${r.total} systems`, yours: false };
  });
}

export function recordLine(side, record) {
  const rank = rankOf(side, record?.points ?? 0);
  if (!rank) return null;
  if (!record?.battles) return `${rank.name} · no battles yet`;
  return `${rank.name} · ${Math.round(record.points)} points · ${record.wins} won of ${record.battles} ${record.battles === 1 ? 'battle' : 'battles'}`;
}

export function oathOf(war, current, suggested) {
  const w = WARS[war];
  return { war, sides: [w.liberator, w.raider].map((id) => ({ id, name: SIDES[id].name, colour: SIDES[id].colour, sworn: current?.side === id, suggested: suggested === id })) };
}

export function battleLine(row, now, side) {
  const b = row.battle;
  if (!b) return null;
  const kind = BATTLE_KINDS[row.kind] ?? BATTLE_KINDS.assault;
  const role = side && side === b.attacker ? 'attack' : side && side === b.defender ? 'defend' : null;
  if (!b.fighting) return `${kind.name}: regrouping, the next in ${span(b.end - now)}`;
  return `${role ? kind.text[role] : kind.name} · ${span(b.fightEnd - now)} left`;
}

// ── the battle you're in ──
const plural = (name) => (/s$/.test(name) ? name : `${name}s`);
const NUMBERS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const counted = (n, word) => `${NUMBERS[n] ?? n} ${n === 1 ? word : plural(word)}`;
const RUNNERS = { transport: 'transport', corvette: 'corvette', gozanti: 'Gozanti', nubian: 'Nubian', shuttle: 'shuttle' };
const attacking = (info) => (info.team === null || info.team === undefined ? null : info.team === info.laid?.attacker);

export function stageLine(info) {
  const st = info?.stage;
  if (!st || st.index >= st.count) return null;
  const head = `Stage ${st.index + 1} of ${st.count}`;
  const left = (info.objectives ?? []).filter((o) => !o.down);
  const all = info.objectives ?? [];
  if (!all.length) return head;
  // (all of a name: how many, or how many of them to take; else the first still standing)
  const same = all.every((o) => o.name === all[0].name);
  const o = same ? all[0] : (left[0] ?? all[0]);
  const need = st.need ?? all.length;
  const what = same && all.length > 1 ? (need < all.length ? `${need} of ${all.length} ${plural(o.name)}` : `${o.name} ×${all.length}`) : o.name;
  if (!st.open) return `${head} · ${what} opens in ${span((st.opensIn ?? 0) * 1000)}`;
  const att = attacking(info);
  if (att === null) return `${head} · ${what}`;
  const verbs = o.verbs ?? typeOf(o).verbs;
  return `${head} · ${verbs[att ? 0 : 1]}: ${what}`;
}

export const objectiveBars = (info) => (info?.objectives ?? []).slice(0, 3).map((o) => ({ id: o.id, name: o.name, k: o.down ? 0 : Math.max(0, Math.min(1, o.hp / (o.hpMax || 1))), down: Boolean(o.down) }));

const NEXT = { wave: 'Bomber wave', push: 'Final push', reserve: 'Their reserve squadron' };
export function nextLine(next) {
  if (!next) return null;
  const name = NEXT[next.type] ?? (next.name ? next.name.charAt(0).toUpperCase() + next.name.slice(1) : 'More');
  return `${name} in ${span(Math.max(0, next.in) * 1000)}`;
}

const WHY = {
  flagship: 'The reactor went',
  interdictor: 'The Interdictor went down',
  deathstar: 'The Death Star’s reactor went',
  gate: 'The Shield Gate fell',
  objectives: 'Every objective fell',
  clock: 'Held out to the end',
  tickets: 'Out of fighters',
  forced: 'Called off',
};
export function whyLine(result) {
  if (!result) return null;
  if (result.why === 'runners' && result.runners) {
    const r = result.runners;
    const kind = RUNNERS[r.kind] ?? r.kind;
    return result.winner === r.team ? `${counted(r.out, kind)} got away` : `${counted(r.down, kind)} were stopped`;
  }
  return WHY[result.why] ?? 'It’s over';
}

export const resultTitle = (result, team) => (team === null || team === undefined ? 'Battle over' : result.winner === team ? 'Victory' : 'Defeat');

export function yoursLine(yours) {
  const parts = [];
  if (yours?.kills) parts.push(`${yours.kills} ${yours.kills === 1 ? 'kill' : 'kills'}`);
  if (yours?.objectives) parts.push(`${yours.objectives} ${yours.objectives === 1 ? 'objective' : 'objectives'}`);
  if (yours?.intercepts) parts.push(`${yours.intercepts} ${yours.intercepts === 1 ? 'intercept' : 'intercepts'}`);
  return parts.length ? parts.join(' · ') : 'You weren’t in among it';
}

export function afterLine(info, sysName, now) {
  const r = info.result;
  const att = attacking(info);
  const who = att === null ? `The ${SIDES[info.on?.sides?.[r.winner]]?.short ?? 'other side'} won` : resultTitle(r, info.team);
  return `${who} at ${sysName} · next battle in ${span((info.on?.end ?? now) - now)}`;
}

export function endCard(info) {
  const r = info?.result;
  if (!r) return null;
  const team = info.team ?? null;
  const points = Math.round(r.yours?.points ?? 0);
  return { title: resultTitle(r, team), tone: team === null ? null : r.winner === team ? 'won' : 'lost', why: whyLine(r), yours: yoursLine(r.yours), points: `+${points} ${points === 1 ? 'point' : 'points'}` };
}

// the end card's time on screen, and how often BattleEnd.jsx looks for an end
export const END = { show: 8, every: 500 };
export const cardTime = (info) => (info?.result ? Math.max(0, END.show - (info.result.ago ?? 0)) : 0);
