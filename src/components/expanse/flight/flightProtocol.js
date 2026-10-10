// The flight world's wire: what pilots over one planet say to each other in
// its room (`fly-v1:<planetId>`, heard by cell, nostr.js's `cells`), and how
// what comes in is read. Pure, so it's tested in Node, and as wary as the
// universe's (protocol.js): every number finite and clamped, anything that
// isn't what it says is null, and the rates are protocol.js's limiter's.
//
// The wire, by action:
//   hi     { n: name, k: ship kind }  on joining, and on any change
//   pose   [x, y, z, pitch, yaw, roll, speed, flags]  ten times a second
//   shot   [x, y, z, vx, vy, vz]  a bolt fired
//   hit    { d }  to the pilot a bolt hit (theirs to believe, as the universe's)
//   built  { id, cell }  a hint: I placed `id` in `cell`; fetch that cell again
//   gone   { id }  the same for a removal
//   event  { id, kind, at: [x, z], t, seed }  something happening (lib/land/flight/director.js):
//          `t` is how long it has run, so a late joiner starts it part-way
//
// A built or a gone is never believed as the thing: it names what to fetch,
// and the durable world (under its database's rules) answers. A pose comes
// with the cell its event was tagged with, and one further than
// NET_CELL × 2 from that cell's middle is dropped: a pilot who tags one cell
// and flies in another would be heard where they aren't (a tag lie).

import { cleanName, createLimiter } from '../../universe/shared/online';
import { NET_CELL, parseTag } from '../../../lib/net/cells';

export const APP_ID = 'tilakpatel-portfolio-flight';
export const ROOM = (planetId) => `fly-v1:${planetId}`;
// [per second, at most at once], by action (pose ten a second with room for a burst)
export const RATES = { pose: [20, 30], shot: [10, 12], hit: [10, 12], built: [1, 3], gone: [1, 3], hi: [1, 4], event: [0.5, 3] };
export const flightLimiter = () => createLimiter(RATES);

const FAR = 1e6; // metres from the planet's origin, at most (the ground streams on; this is sanity, not a border)
const ALT = [-1000, 40000]; // metres, below and above the datum
const SPEED_MAX = 400; // metres a second: the fastest ship flat out, and a margin
const SHOT_MAX = 1500; // a bolt's speed, the ship's under it
const DAMAGE_MAX = 30; // one hit, at most (the universe's heavy round)
const LIE = NET_CELL * 2; // a pose this far from its tag's cell is a lie
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KIND = /^[a-z0-9-]{1,24}$/;

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (v) => Math.round((v || 0) * 100) / 100;
const r3 = (v) => Math.round((v || 0) * 1000) / 1000;
const uuid = (v) => (typeof v === 'string' && UUID.test(v.toLowerCase()) ? v.toLowerCase() : null);

export const writeHi = ({ name, kind }) => ({ n: name, k: kind });
export function readHi(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return { name: cleanName(data.n) ?? 'Pilot', kind: typeof data.k === 'string' && KIND.test(data.k) ? data.k : null };
}

export const writePose = (s) => [r2(s.x), r2(s.y), r2(s.z), r2(wrap(s.pitch || 0)), r2(wrap(s.yaw || 0)), r2(wrap(s.roll || 0)), r2(s.speed), (s.flags | 0) & 255];

// a pose as it came in, with its event's cell tag (and the planet it must
// name, when given): { x, y, z, pitch, yaw, roll, speed, flags }, or null
export function readPose(data, tag, planetId = null) {
  if (!Array.isArray(data) || data.length < 8) return null;
  const at = parseTag(tag);
  if (planetId !== null && at?.planetId !== planetId) return null;
  const n = [num(data[0], -FAR, FAR), num(data[1], ...ALT), num(data[2], -FAR, FAR), ...data.slice(3, 8).map((v) => num(v, -1e3, 1e3))];
  if (!at || n.some((v) => v === null)) return null;
  const [x, y, z, pitch, yaw, roll, speed, flags] = n;
  if (Math.hypot(x - (at.cx + 0.5) * NET_CELL, z - (at.cz + 0.5) * NET_CELL) > LIE) return null;
  return { x, y, z, pitch: wrap(pitch), yaw: wrap(yaw), roll: wrap(roll), speed: Math.min(SPEED_MAX, Math.max(0, speed)), flags: Math.floor(Math.max(0, Math.min(255, flags))) };
}

export const writeShot = (p, v) => [p.x, p.y, p.z, v[0], v[1], v[2]].map(r3);

// a shot as it came in: { p: [x, y, z], v: [vx, vy, vz] }, or null; it has
// to start near where its pilot was last seen (`from`, a pose, if known)
export function readShot(data, from = null) {
  if (!Array.isArray(data) || data.length < 6) return null;
  const n = data.slice(0, 6).map((v, i) => (i < 3 ? num(v, -FAR, FAR) : num(v, -SHOT_MAX * 2, SHOT_MAX * 2)));
  if (n.some((v) => v === null) || Math.hypot(n[3], n[4], n[5]) > SHOT_MAX) return null;
  // (as far as it could have gone since that pose)
  if (from && Math.hypot(n[0] - from.x, n[1] - from.y, n[2] - from.z) > 6 + Math.abs(from.speed ?? 0) * 0.3) return null;
  return { p: n.slice(0, 3), v: n.slice(3) };
}

export function readHit(data) {
  const d = num(data?.d, 0, DAMAGE_MAX);
  return d === null || d <= 0 ? null : d;
}

export function readBuilt(data) {
  const id = uuid(data?.id);
  return id && parseTag(data.cell) ? { id, cell: data.cell } : null;
}

export function readGone(data) {
  const id = uuid(data?.id);
  return id ? { id } : null;
}

const EVENT_ID = /^\d{10}:[a-z]{2,16}:(-?\d{1,6},-?\d{1,6}|day\d{1,9})$/;
const EVENT_T = 240; // s an event may have run, at most (every kind's ttl is under it)

export const writeEvent = (ev) => ({ id: ev.id, kind: ev.kind, at: [r2(ev.at[0]), r2(ev.at[1])], t: r2(ev.t), seed: ev.seed >>> 0 });

// an event as it came in: { id, kind, at: [x, z], t, seed }, or null; its
// kind has to be one of `known` (the planet's), the rest the director weighs
export function readEvent(data, known) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (typeof data.id !== 'string' || !EVENT_ID.test(data.id) || typeof data.kind !== 'string' || !known?.has(data.kind)) return null;
  if (data.id.split(':')[1] !== data.kind || !Array.isArray(data.at)) return null;
  const x = num(data.at[0], -FAR, FAR);
  const z = num(data.at[1], -FAR, FAR);
  const t = num(data.t, 0, EVENT_T);
  if (x === null || z === null || t === null || data.t > EVENT_T || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) return null;
  return { id: data.id, kind: data.kind, at: [x, z], t, seed: data.seed };
}
