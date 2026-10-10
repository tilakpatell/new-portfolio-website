// The map rulebook (maps/<level>.json): where a level's modes put their
// spawns, spawn areas, objective and out-of-bounds volumes, the walkers'
// paths, locators and cameras, read from the level's mode layers
// (`Levels/MP/<Level>/<Layer>_*`, LayerData records), with the terrain and
// the vehicle spawns from the web build's map manifest.
//
//   AlternateSpawnEntityData       spawn points: Team, Priority, Enabled, Transform
//   SpawnLocationFinderShapeData   spawn areas: Team, Enabled, Points, Height
//   VolumeVectorShapeData          volumes: Points (on XZ, Y the floor), Height
//   SphereData, OBBData            spheres and boxes
//   AIWaypointsShapeData           paths: Points (the walkers' path). The
//                                  VehicleWaypointData it points at hold speeds
//                                  and stops, no positions.
//   Locator/LocalLocator/CameraEntityData   named transforms, cameras
//   CheckedLocalizedStringEntityData        the objective and stage strings (Sid)
//   Spatial/LogicPrefabReferenceObjectData  the mode's prefabs (capture points…)
//
// Ids are `<layer>:<object index>`, stable while the export is.

import { follow, pointsOf, readWebJson, shortName, transformOf } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

export const MODE_LAYERS = { galacticAssault: 'FantasyBattle', hvv: 'HeroArena', blast: 'TeamDeathmatch', strike: 'Mode9', supremacy: 'Mode1', extraction: 'Mode6', ewokHunt: 'Mode8', arcade: 'PlanetaryMissions' };

// The layers a mode's rules read, by suffix (art, automation, sound, the
// living world's ambient paths and the cinematics are not rules).
const RULE_LAYER = /_(Logic|Spawns|Spawns_Team\d|Shapes|Inf_Shapes_\w+|OOBTeam\d|Gameplay|Global|DefendAreas|CaptureAreas|Skirmish_DefendAreas)$/;
const EXTRA_LAYERS = { Mode9: ['ModeDefend_Spawns_Team1', 'ModeDefend_Spawns_Team2'] };

const teamOf = (t) => Number(String(t ?? '').replace(/^Team/, '')) || 0;
// (to a tenth of a millimetre)
const r3 = (v) => Math.round(v * 10000) / 10000;
const vec = (p) => [r3(p.x), r3(p.y), r3(p.z)];
const where = (layer, o) => `${layer}#${o.$type}`;

function kindOf(layer) {
  if (/OOB/.test(layer)) return 'oob';
  if (/Capture/.test(layer)) return 'capture';
  if (/Defend/.test(layer)) return 'defend';
  return 'shape';
}

// A quaternion [x, y, z, w]'s yaw: the heading of its forward (+Z) axis.
const yawOfQuat = ([x, y, z, w]) => Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));

export function levelName(root, level) {
  const want = `levels/mp/${level}/${level}`.toLowerCase();
  return [...indexOf(root).keys()].find((n) => n.toLowerCase() === want) ?? null;
}

export function mapRow(root, level, { modes = MODE_LAYERS } = {}) {
  const name = levelName(root, level);
  const dir = name ? name.slice(0, name.lastIndexOf('/') + 1) : `Levels/MP/${level}/`;
  const names = [...indexOf(root).keys()].filter((n) => n.startsWith(dir) && !n.slice(dir.length).includes('/'));
  const row = { level: name, modes: [], spawns: [], polygons: [], volumes: [], spheres: [], boxes: [], waypoints: [], oob: { team1: [], team2: [] }, locators: [], cameras: [], prefabs: [], strings: [], _missing: [] };
  const seen = new Set();
  for (const [mode, layer] of Object.entries(modes)) {
    if (!names.includes(`${dir}${layer}`)) continue;
    row.modes.push(mode);
    const layers = names.filter((n) => shortName(n).startsWith(`${layer}_`) && RULE_LAYER.test(shortName(n))).concat((EXTRA_LAYERS[layer] ?? []).map((l) => `${dir}${l}`).filter((n) => names.includes(n)));
    for (const ln of layers) {
      const asset = follow(root, ln);
      if (!asset) {
        row._missing.push(`layer: ${ln}`);
        continue;
      }
      const lay = shortName(ln);
      asset.objects.forEach((o, i) => {
        if (!o) return;
        const id = `${lay}:${i}`;
        const base = { id, mode, layer: lay, _source: where(ln, o) };
        switch (o.$type) {
          case 'AlternateSpawnEntityData': {
            const t = transformOf(o);
            const key = `${mode}|${o.Team}|${vec(o.Transform.trans).map((v) => v.toFixed(2)).join(',')}`;
            if (seen.has(key)) return;
            seen.add(key);
            row.spawns.push({ ...base, team: teamOf(o.Team), priority: o.Priority, enabled: Boolean(o.Enabled), at: vec(o.Transform.trans), yaw: r3(t.yaw) });
            return;
          }
          case 'SpawnLocationFinderShapeData': {
            const p = pointsOf(o);
            row.polygons.push({ ...base, team: teamOf(o.Team), enabled: Boolean(o.Enabled), points: p.points.map(([x, z]) => [r3(x), r3(z)]), y: r3(p.y), height: p.height });
            return;
          }
          case 'VolumeVectorShapeData': {
            const p = pointsOf(o);
            const kind = kindOf(lay);
            row.volumes.push({ ...base, kind, points: p.points.map(([x, z]) => [r3(x), r3(z)]), y: r3(p.y), height: p.height, closed: p.closed });
            const team = lay.match(/OOBTeam(\d)/)?.[1];
            if (team) row.oob[`team${team}`]?.push(id);
            return;
          }
          case 'SphereData': {
            const p = pointsOf(o);
            row.spheres.push({ ...base, at: p.at.map(r3), r: r3(p.r) });
            return;
          }
          case 'OBBData': {
            const p = pointsOf(o);
            row.boxes.push({ ...base, at: p.at.map(r3), half: p.half.map(r3), yaw: r3(p.yaw) });
            return;
          }
          case 'AIWaypointsShapeData':
            row.waypoints.push({ ...base, points: (o.Points ?? []).map(vec), closed: Boolean(o.IsClosed) });
            return;
          case 'LocatorEntityData':
          case 'LocalLocatorEntityData': {
            const t = transformOf(o);
            if (t) row.locators.push({ ...base, at: t.at.map(r3), yaw: r3(t.yaw) });
            return;
          }
          case 'CameraEntityData': {
            const t = transformOf(o);
            if (t) row.cameras.push({ ...base, at: t.at.map(r3), yaw: r3(t.yaw), pitch: r3(Math.asin(Math.max(-1, Math.min(1, o.Transform.forward.y)))), focalLength: o.FocalLength, aperture: o.Aperture, fov: o.Fov });
            return;
          }
          case 'CheckedLocalizedStringEntityData':
            if (o.Sid && !row.strings.includes(o.Sid)) row.strings.push(o.Sid);
            return;
          case 'SpatialPrefabReferenceObjectData':
          case 'LogicPrefabReferenceObjectData': {
            const t = transformOf(o);
            const bp = o.Blueprint?.$asset;
            if (bp && /_(Logic|Gameplay)$/.test(lay)) row.prefabs.push({ ...base, name: shortName(bp), blueprint: bp, ...(t && /Spatial/.test(o.$type) ? { at: t.at.map(r3), yaw: r3(t.yaw) } : {}) });
            return;
          }
          default:
        }
      });
    }
  }

  const manifest = readWebJson(root, `maps/${(name ?? '').toLowerCase()}.json`);
  if (manifest) {
    const rel = `web/maps/${name.toLowerCase()}.json`;
    const t = manifest.terrain?.[0];
    if (t) row.terrain = { ...t, _source: `${rel}#terrain.0` };
    row.vehicleSpawns = (manifest.vehicleSpawns ?? []).map((v, i) => ({ blueprint: v.blueprint, at: v.position.map(r3), yaw: r3(yawOfQuat(v.quaternion)), sub: v.sub ?? null, _source: `${rel}#vehicleSpawns.${i}` }));
  } else row._missing.push(`map manifest: maps/${(name ?? level).toLowerCase()}.json`);

  const xs = [...row.spawns.map((s) => [s.at[0], s.at[2]]), ...row.volumes.flatMap((v) => v.points)];
  if (xs.length) {
    const pad = 50;
    row.bounds = {
      min: [Math.min(...xs.map((p) => p[0])) - pad, Math.min(...xs.map((p) => p[1])) - pad],
      max: [Math.max(...xs.map((p) => p[0])) + pad, Math.max(...xs.map((p) => p[1])) + pad],
      _source: 'derived: the spawns and volumes on XZ, padded 50 m',
    };
  }
  return row;
}
