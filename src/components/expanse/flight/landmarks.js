// A POI's buildings as a placement list: what stands on it, where, how high,
// in the galaxy placer's spec (galaxy/surface/placer.js), every height
// given (`abs`), so the placer reads no ground of its own.
//
// Where a walkable galaxy site has the place (lib/land/flight/
// landmarkTables.js's SITE_PLACES), its things are the site's own: the
// places' `things` and the site's loose ones nearest them, kept where they
// stand relative to the first place's middle, within the POI's r + edge. A
// thing the site stood on a rise or in a hollow the flight's ground hasn't
// got (its height off the place's middle differs from the flight's by more
// than DROP_Y) is dropped and counted: a wall following a river the flight
// has no river for would hang in the air. Where no site has it, the POI's
// own list (LANDMARKS) stands on the flight's ground.
//
// No three.js: the sites and the galaxy's terrain are data and pure code.
//
//   siteFor(spec, poi) → the walkable site (siteOf's) | null
//   placementsFor(spec, poi, { heightAt, site }) → { list: [{ kind, model?,
//     opts?, at: [x, z], y, yaw, pitch?, roll?, scale, abs: true, solid:
//     false }], dropped }

import { siteOf } from '../../galaxy/surface/sites';
import { makeHeight } from '../../galaxy/surface/terrain';
import { DROP_Y, LANDMARKS, LANDMARK_MAX, SITE_PLACES } from '../../../lib/land/flight/landmarkTables';

const sites = new Map(); // id → { site, height }: made once a page
function siteData(id) {
  if (!sites.has(id)) {
    const site = siteOf(id);
    // (a site with no ground, Bespin's, stands everything at its own heights)
    sites.set(id, site ? { site, height: site.noGround ? () => 0 : makeHeight(site.ground) } : null);
  }
  return sites.get(id);
}

const mapOf = (spec, poi) => SITE_PLACES[spec?.id]?.[poi?.id] ?? null;

export function siteFor(spec, poi) {
  const m = mapOf(spec, poi);
  return m ? (siteData(m.site)?.site ?? null) : null;
}

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// the site's things for a POI, and the middle they're measured from
function siteThings(site, m) {
  if (m.places === '*') {
    const centre = m.centre ?? site.land.at;
    return { centre, things: site.things_all.map((t) => ({ t, ref: centre })) };
  }
  const ids = new Set(m.places);
  const places = m.places.map((id) => site.places.find((p) => p.id === id)).filter(Boolean);
  if (!places.length) return { centre: [0, 0], things: [] };
  const at = new Map(site.places.map((p) => [p.id, p.at]));
  // (a loose thing goes with the place nearest it, ours or another's, or
  // with the landing spot: the crates round where you set down are no place's)
  const spots = [...site.places, { id: '@land', at: site.land.at }];
  const nearest = (at) => spots.reduce((best, p) => (d2(p.at, at) < d2(best.at, at) ? p : best)).id;
  // (each thing measured from its own place's middle: two places on flats
  // at different heights in the site are each level on the flight's one)
  const things = [];
  for (const t of site.things_all) {
    const id = t.place ?? nearest(t.at);
    if (ids.has(id)) things.push({ t, ref: at.get(id) });
  }
  return { centre: places[0].at, things };
}

const spec4 = (t, at, y) => {
  const out = { kind: t.kind, at, y, yaw: t.yaw ?? 0, scale: t.scale ?? 1, abs: true, solid: false };
  for (const k of ['model', 'opts', 'pitch', 'roll']) if (t[k] != null) out[k] = t[k];
  return out;
};

// the nearest LANDMARK_MAX to the POI's middle, in a fixed order
function capped(list, poi) {
  if (list.length <= LANDMARK_MAX) return list;
  return list
    .map((p, i) => ({ p, i, d: d2(p.at, poi.at) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, LANDMARK_MAX)
    .sort((a, b) => a.i - b.i)
    .map((e) => e.p);
}

function fromSite({ site, height }, m, poi, heightAt) {
  const { centre, things } = siteThings(site, m);
  const reach2 = (poi.r + poi.edge) ** 2;
  const siteBase = height(centre[0], centre[1]);
  const base = poi.h ?? heightAt(poi.at[0], poi.at[1]);
  const moved = (p) => [poi.at[0] + p[0] - centre[0], poi.at[1] + p[1] - centre[1]];
  const list = [];
  let dropped = 0;
  for (const { t, ref } of things) {
    // (a room's furniture, and what hangs in the sky past the fog, aren't the place's buildings)
    if (t.zone || t.fog === false) continue;
    const dx = t.at[0] - centre[0], dz = t.at[1] - centre[1];
    if (dx * dx + dz * dz > reach2) continue;
    const at = [poi.at[0] + dx, poi.at[1] + dz];
    if (t.abs) {
      list.push(spec4(t, at, base + (t.y ?? 0) - siteBase));
      continue;
    }
    const ground = heightAt(at[0], at[1]);
    const r = moved(ref);
    if (Math.abs(height(t.at[0], t.at[1]) - height(ref[0], ref[1]) - (ground - heightAt(r[0], r[1]))) > DROP_Y) {
      dropped++;
      continue;
    }
    list.push(spec4(t, at, ground + (t.y ?? 0) - (t.sink ?? 0)));
  }
  for (const t of m.extra ?? []) list.push(fromRow(t, poi, heightAt));
  return { list: capped(list, poi), dropped };
}

function fromRow(t, poi, heightAt) {
  const at = [poi.at[0] + t.at[0], poi.at[1] + t.at[1]];
  return spec4(t.kit ? { ...t, kind: 'kit', model: `kit:${t.kit.kit}/${t.kit.name}` } : t, at, heightAt(at[0], at[1]));
}

function fromTable(rows, poi, heightAt) {
  return { list: capped(rows.map((t) => fromRow(t, poi, heightAt)), poi), dropped: 0 };
}

export function placementsFor(spec, poi, { heightAt, site = null } = {}) {
  const m = mapOf(spec, poi);
  const data = site ? { site, height: site.noGround ? () => 0 : makeHeight(site.ground) } : m ? siteData(m.site) : null;
  if (m && data) return fromSite(data, m, poi, heightAt);
  const rows = LANDMARKS[spec?.id]?.[poi?.id];
  return rows ? fromTable(rows, poi, heightAt) : { list: [], dropped: 0 };
}
