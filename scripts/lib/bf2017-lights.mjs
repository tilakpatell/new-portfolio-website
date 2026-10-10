// A level's placed lights, from the game's map extras to the site's
// lights.json (the galaxy engine's design, "The light", placed.js).
//
// The input is `web/maps/<level>/<name>.extras.json`'s `lights[]`, as the
// bucket's maps README describes it: `type` sphere | spot | rect | tube,
// `Color` (linear, already tinted by the temperature, often above 1),
// `Intensity` with `LightUnit` (LuminousPower: lumens), `Dimmer`,
// `ExposureCompensation`, `AttenuationRadius` (the range), `InnerAngle` and
// `OuterAngle` (a spot's full cone, degrees), `Texture` (a rect's cookie),
// `Enabled`, `AffectDiffuse` and `AffectSpecular`, and `position`,
// `quaternion` (x, y, z, w), `sub` (the manifest's subworld). Spots and
// rects shine along their local -Z, as three's lights do.
//
// The output, per 128 m cell of the level pack's frame:
//   { format: 1, cell, count, kinds, cells: { "cx,cz": [{ kind: 'point' |
//     'spot', pos, color, candela, range, cone: [inner, outer], dir,
//     cookie? }] } }
// candela in the game's units: the runtime scales them by the weather's
// gameToSite with the sun (src/lib/three/light/entry.js), so a lamp keeps
// its strength against the sun.
//
// Read as: a sphere or a tube is a point (a tube's length is lost); a spot
// is a spot; a rect is a spot over the whole hemisphere at its Lambertian
// peak, lm / π (three's SpotLight at a half angle of 90° with a full
// penumbra is the nearest it has). A light that is off, dimmed to nothing,
// lights neither diffuse nor specular, or is in another unit is left out
// and counted.
//
// readLight(raw) → light | { skip } ; rebase(light, origin, yaw) ;
// cellOf(pos, cell) ; keepSub(name) ; lightsJson(extras, pack, { subworlds }) → json

import { cellOf as cellKey, lumensToCandela } from '../../src/lib/three/light/placed.js';

export const CELL = 128;
const RAD = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// the subworlds that are not the playable map: the lobby, the end of round,
// the cinematics and outros, the other modes' set dressing and the other
// times of day (a level keeps one weather's lights)
const NOT_ARENA = /lobby|splitscreen|eor|cinematic|outro|intro|mode\d|gamemodes|deathmatch|missions|arena|fantasybattle|automation|cloudy|sunset|night|dawn|dusk/i;
export const keepSub = (name) => !NOT_ARENA.test(String(name ?? '').split('/').pop());

export const cellOf = (pos, cell = CELL) => cellKey(pos, cell);

// a vector turned by a unit quaternion [x, y, z, w]: v + 2w(q × v) + 2q × (q × v)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function turn(v, [x, y, z, w]) {
  const q = [x, y, z];
  const t = cross(q, v).map((c) => 2 * c);
  const u = cross(q, t);
  return [v[0] + w * t[0] + u[0], v[1] + w * t[1] + u[1], v[2] + w * t[2] + u[2]];
}

export function readLight(raw) {
  if (!raw || raw.Enabled === false) return { skip: 'off' };
  if (raw.AffectDiffuse === false && raw.AffectSpecular === false) return { skip: 'unlit' };
  if (raw.LightUnit && raw.LightUnit !== 'LightUnitType_LuminousPower') return { skip: 'unit' };
  const color = Array.isArray(raw.Color) ? raw.Color.map(Number) : [1, 1, 1];
  const peak = Math.max(...color);
  const lm = Number(raw.Intensity ?? 0) * Number(raw.Dimmer ?? 1) * 2 ** Number(raw.ExposureCompensation ?? 0) * peak;
  if (!(lm > 0)) return { skip: 'dark' };
  const q = raw.quaternion ?? [0, 0, 0, 1];
  const base = { pos: raw.position.map(Number), color: color.map((c) => c / peak), range: Number(raw.AttenuationRadius ?? 10) };
  if (raw.type === 'spot') {
    const outer = Number(raw.OuterAngle ?? 60) * RAD;
    const inner = Math.min(outer, Number(raw.InnerAngle ?? 0) * RAD);
    return { ...base, kind: 'spot', cone: [inner, outer], dir: turn([0, 0, -1], q), candela: lumensToCandela(lm, 'spot', outer) };
  }
  if (raw.type === 'rect') {
    const out = { ...base, kind: 'spot', cone: [0, Math.PI], dir: turn([0, 0, -1], q), candela: lm / Math.PI };
    if (raw.Texture) out.cookie = raw.Texture;
    return out;
  }
  return { ...base, kind: 'point', candela: lumensToCandela(lm, 'point') };
}

// The game's frame to the pack's: the origin taken away, then turned by yaw
// (radians) about +Y, as lane L's rebase does the instances.
export function rebase(light, origin = [0, 0, 0], yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const p = light.pos.map((v, i) => v - origin[i]);
  const out = { ...light, pos: rot(p) };
  if (light.dir) out.dir = rot(light.dir);
  return out;
}

const tidy = (l) => {
  const out = { kind: l.kind, pos: l.pos.map(r2), color: l.color.map(r4), candela: Math.round(l.candela * 10) / 10, range: r2(l.range) };
  if (l.kind === 'spot') Object.assign(out, { cone: l.cone.map(r4), dir: l.dir.map(r4) });
  if (l.cookie) out.cookie = l.cookie;
  return out;
};

// pack: lane L's level.json, or { origin, yaw, cell, arena } (arena: the
// half-size in metres kept round the origin, a cell's margin added; 0 or
// none keeps everything)
export function lightsJson(extras, pack = {}, { subworlds = null } = {}) {
  const cell = pack.cell ?? CELL;
  const reach = pack.arena ? pack.arena + cell : Infinity;
  const skipped = {};
  const kinds = { point: 0, spot: 0 };
  const cells = {};
  let count = 0;
  for (const raw of extras?.lights ?? []) {
    if (subworlds && !keepSub(subworlds[raw.sub])) {
      skipped.sub = (skipped.sub ?? 0) + 1;
      continue;
    }
    const l = readLight(raw);
    if (l.skip) {
      skipped[l.skip] = (skipped[l.skip] ?? 0) + 1;
      continue;
    }
    const at = rebase(l, pack.origin, pack.yaw);
    if (Math.abs(at.pos[0]) > reach || Math.abs(at.pos[2]) > reach) {
      skipped.outside = (skipped.outside ?? 0) + 1;
      continue;
    }
    (cells[cellOf(at.pos, cell)] ??= []).push(tidy(at));
    kinds[at.kind]++;
    count++;
  }
  return { format: 1, cell, count, kinds, skipped, cells };
}
