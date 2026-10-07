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
// And the war's news, from the table (gcw.js's warTable): ago(ms); eventLine(e,
// now) → one of its events; strengthLine(table, side) | null; phaseLine(table,
// now); orderLine(order, now) | null; resultLine(table) → the campaign's
// result | null.

import { BATTLE_KINDS } from './battles';
import { rankOf } from './ranks';
import { AREAS, SIDES, WARS } from './sides';
import { systemById } from './systems';

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
  if (row.front) return `${pctOf(progressOf(row))} liberated · ${rateOf(row.effRate ?? row.rate)}`;
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

// ── The war's news ──

const nameOf = (id) => systemById(id)?.name ?? id;
const The = (side) => (side === 'hutt' ? 'The Hutts' : `The ${SIDES[side].short}`);
const the = (side) => (side === 'hutt' ? 'the Hutts' : `the ${SIDES[side].short}`);
// (the Separatists’, the Rebellion’s)
const whose = (side) => `${The(side)}${The(side).endsWith('s') ? '’' : '’s'}`;
const PHASE_NEWS = { Opening: 'The campaign opens', Escalation: 'The war escalates', Decisive: 'The decisive phase', Climax: 'The climax' };
const PHASE_NEXT = { Escalation: 'escalation', Decisive: 'the decisive phase', Climax: 'the climax' };
const VERBS = { liberate: 'Liberate', hold: 'Hold', take: 'Take' };

// how long ago, as the news says it: just now, 12m ago, 2h ago, 2d ago
export function ago(ms) {
  const m = Math.floor(Math.max(0, ms) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function news(e) {
  const from = e.origin ? ` from ${nameOf(e.origin)}` : '';
  if (e.type === 'captured') return `${nameOf(e.sys)} fell to ${the(e.by)}`;
  if (e.type === 'capital') return `${nameOf(e.sys)}, ${the(e.from)}’${the(e.from).endsWith('s') ? '' : 's'} capital, fell to ${the(e.by)}`;
  if (e.type === 'attack') return `${The(e.by)} ${e.counter ? 'strikes back at' : 'attacks'} ${nameOf(e.sys)}${from}`;
  if (e.type === 'raid') return `${The(e.by)} raid ${nameOf(e.sys)}${from}`;
  if (e.type === 'repelled') return `${The(e.holder)} held ${nameOf(e.sys)}`;
  if (e.type === 'area') return `${The(e.by)} holds all of ${AREAS.find((a) => a.id === e.area)?.name.replace(/^The /, 'the ') ?? e.area}`;
  if (e.type === 'lastStand') return `${whose(e.by)} last stand, at ${nameOf(e.sys)}`;
  if (e.type === 'phase') return e.phase === 'Climax' && e.sys ? `The climax: the decisive battle, at ${nameOf(e.sys)}` : (PHASE_NEWS[e.phase] ?? e.phase);
  return e.type;
}
export const eventLine = (e, now) => `${news(e)} · ${ago(now - e.at)}`;

export function strengthLine(table, side) {
  const r = table.strength?.[side];
  if (!r) return null;
  const trend = r.trend6h > 0 ? ` · ▲${r.trend6h} in 6h` : r.trend6h < 0 ? ` · ▼${-r.trend6h} in 6h` : '';
  return `${r.systems} ${r.systems === 1 ? 'system' : 'systems'} · ${pctOf(r.share)} of the galaxy’s worth${trend}`;
}

export const phaseLine = ({ phase }, now) => `${phase.name} · ${phase.next ? `${PHASE_NEXT[phase.next] ?? phase.next} in ${span(phase.until - now)}` : `${span(phase.until - now)} to the end`}`;

export const orderLine = (order, now) => (order ? `${VERBS[order.verb] ?? order.verb} ${nameOf(order.sys)} · ${span(order.until - now)} left` : null);

export function resultLine(table) {
  const r = table.result;
  if (!r) return null;
  const decisive = r.decisive ? ` · decisive at ${nameOf(r.decisive)}` : '';
  if (r.over) return `${The(r.winner)} won campaign ${table.campaign + 1} outright: every system theirs${decisive}`;
  const second = Math.max(...Object.entries(r.vp).filter(([side]) => side !== r.winner).map(([, v]) => v));
  return `${The(r.winner)} won campaign ${table.campaign + 1} · ${r.vp[r.winner]}–${second} on victory points${decisive}`;
}
