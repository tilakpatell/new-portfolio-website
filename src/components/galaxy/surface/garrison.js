// Who holds a world in the galaxy's war decides who stands guard on it
// (galaxy/warEffects.js's `troops`): the troopers a site's life names
// (sites/*.js) are its holder's, a Rebel trooper where the Empire's
// stormtrooper stood, a clone where the droids were. A trooper of the
// holder's own kind stays as the site has it (a sandtrooper on Tatooine
// for the Empire); one swapped takes the new side's name and leaves the old
// side's words behind. Everyone else (a Jawa, a bantha) is untouched. Pure,
// tested; surface/scene.js hands the site's life through it.
//
// troopKind(kind, troops) → the kind to draw; garrisonLife(life, troops,
// uniforms) → the site's life with its troopers the holder's, in the world's
// own kit (a site's `uniforms`; the same array if nothing changes); TROOP_NAMES[kind]; garrisonProbe(site, effects, faction) → a
// probe droid for an Imperial search party on a world that isn't the
// Empire's own, as a life entry marked `garrison`; garrisonLines(standing,
// rank) → what the holder's soldiers say to you (ground/standing.js: they
// salute their own by rank, tell everyone else to move along).

import { FAMILIES, dressOf } from './ground/troops';

export { FAMILIES };

// the troopers of each side's look, as the sites name them
// (ground/troops.js's: the one table)
const FAMILY_OF = Object.fromEntries(Object.entries(FAMILIES).flatMap(([f, kinds]) => kinds.map((k) => [k, f])));

export const TROOP_NAMES = { stormtrooper: 'Stormtrooper', rebel: 'Rebel trooper', clone: 'Clone trooper', battledroid: 'Battle droid', mercenary: 'Hutt enforcer', snowtrooper: 'Snowtrooper', hothtrooper: 'Rebel trooper' };

export function troopKind(kind, troops) {
  const family = FAMILY_OF[kind];
  if (!family || !troops || !FAMILIES[troops] || family === troops) return kind;
  return troops;
}

export function garrisonLife(life, troops, uniforms = null) {
  if (!life || !troops) return life;
  let changed = false;
  const mapped = life.map((entry) => {
    // (a named person, a quest giver, anyone the site calls by id keeps their kind and words)
    if (entry.id || entry.named || entry.quest) return entry;
    const kind = troopKind(entry.kind, troops);
    if (kind === entry.kind) return entry;
    const dressed = dressOf(kind, uniforms);
    if (dressed === entry.kind) return entry;
    changed = true;
    const out = { ...entry, kind: dressed, name: TROOP_NAMES[dressed] ?? TROOP_NAMES[kind] };
    delete out.says;
    return out;
  });
  return changed ? mapped : life;
}

export function garrisonLines(standing, rank = 0) {
  if (standing === 'ally') return rank >= 3 ? ['General.', 'Good to have you back, General.'] : ['Commander.', 'Good to have you back.'];
  if (standing === 'neutral') return ['Move along.'];
  return ['Move along.', 'This world is under our protection.'];
}

// a search party's probe droid, on a world the Empire (or what's left of it)
// holds that isn't its own (the soldiers round the pad are the ground
// war's now: ground/turf.js's pad turf, placed where the landing party stood)
const IMPERIAL = new Set(['empire', 'remnant']);
export function garrisonProbe(site, effects, faction = null) {
  if (!effects?.troops || !site?.land?.at || !IMPERIAL.has(effects.owner) || faction === effects.owner) return [];
  const [x, z] = site.land.at;
  return [{ kind: 'probe', at: [x + 60, z + 40], y: 2.2, roam: 50, speed: 1.6, r: 0.6, name: 'Probe droid', garrison: true, says: ['(A burst of Imperial code, crackling and urgent.)', '(It stops, turns its lenses on you, and transmits.)'] }];
}
