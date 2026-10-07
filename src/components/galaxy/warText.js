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

import { BATTLE_KINDS } from './battles';
import { rankOf } from './ranks';
import { AREAS, SIDES, WARS } from './sides';

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
