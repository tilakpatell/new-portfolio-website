// Who holds a world in the galaxy's war decides who stands guard on it
// (galaxy/warEffects.js's `troops`): the troopers a site's life names
// (sites/*.js) are its holder's, a Rebel trooper where the Empire's
// stormtrooper stood, a clone where the droids were. A trooper of the
// holder's own kind stays as the site has it (a sandtrooper on Tatooine
// for the Empire); one swapped takes the new side's name and leaves the old
// side's words behind. Everyone else (a Jawa, a bantha) is untouched. Pure,
// tested; surface/scene.js hands the site's life through it.
//
// troopKind(kind, troops) → the kind to draw; garrisonLife(life, troops) →
// the site's life with its troopers the holder's (the same array if nothing
// changes); TROOP_NAMES[kind]; garrisonAt(site, effects, faction) → the
// holder's party at the landing (six to ten of its troops on a beat round
// it and at posts, and a probe droid for an Imperial search party on a
// world that isn't the Empire's own), as life entries marked `garrison`;
// garrisonLines(standing, rank) → what it says to you (ground/standing.js:
// it salutes its own by rank, tells everyone else to move along).

import { standingOf } from './ground/standing';
import { FAMILIES } from './ground/troops';

export { FAMILIES };

// the troopers of each side's look, as the sites name them
// (ground/troops.js's: the one table)
const FAMILY_OF = Object.fromEntries(Object.entries(FAMILIES).flatMap(([f, kinds]) => kinds.map((k) => [k, f])));

export const TROOP_NAMES = { stormtrooper: 'Stormtrooper', rebel: 'Rebel trooper', clone: 'Clone trooper', battledroid: 'Battle droid', mercenary: 'Hutt enforcer' };

export function troopKind(kind, troops) {
  const family = FAMILY_OF[kind];
  if (!family || !troops || !FAMILIES[troops] || family === troops) return kind;
  return troops;
}

export function garrisonLife(life, troops) {
  if (!life || !troops) return life;
  let changed = false;
  const mapped = life.map((entry) => {
    // (a named person, a quest giver, anyone the site calls by id keeps their kind and words)
    if (entry.id || entry.named || entry.quest) return entry;
    const kind = troopKind(entry.kind, troops);
    if (kind === entry.kind) return entry;
    changed = true;
    const out = { ...entry, kind, name: TROOP_NAMES[kind] };
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

// the landing party: a beat round the landing on each side, a post at each
// corner, the rest at ease by the ship (seeded by the world's name, so the
// same world gets the same party)
const IMPERIAL = new Set(['empire', 'remnant']);
export function garrisonAt(site, effects, faction = null) {
  const troops = effects?.troops;
  if (!troops || !site?.land?.at) return [];
  const [x, z] = site.land.at;
  const name = TROOP_NAMES[troops] ?? troops;
  const seed = [...(site.id ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = 6 + (seed % 5); // 6..10
  const out = [];
  // (what you are to them: by the oath you swore in the ground's war, or the old words without one)
  const standing = 'side' in effects ? standingOf(effects.owner, { side: effects.side, war: effects.war }) : 'enemy';
  const says = garrisonLines(standing, effects.rank);
  const beat = (dx, dz) => ({ kind: troops, n: 2, path: [[x + dx, z + dz], [x - dz, z + dx], [x - dx, z - dz], [x + dz, z - dx]], speed: 1.2, name, garrison: true, says });
  out.push(beat(34, 0));
  if (n >= 8) out.push(beat(0, 48));
  const posts = n >= 8 ? 4 : 2;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2 + 0.6;
    out.push({ kind: troops, at: [x + Math.cos(a) * 26, z + Math.sin(a) * 26], still: true, face: a + Math.PI, name, garrison: true, says: standing === 'ally' ? says : ['(It watches you, and says nothing.)'] });
  }
  const rest = n - 2 * (n >= 8 ? 2 : 1) - posts;
  if (rest > 0) out.push({ kind: troops, n: rest, at: [x + 18, z - 14], spread: 6, roam: 8, speed: 0.9, name, garrison: true, says: standing === 'ally' ? says : ['Papers. No, I\'m joking. Papers.', 'Quiet posting, this.'] });
  if (IMPERIAL.has(effects.owner) && faction !== effects.owner) out.push({ kind: 'probe', at: [x + 60, z + 40], y: 2.2, roam: 50, speed: 1.6, r: 0.6, name: 'Probe droid', garrison: true, says: ['(A burst of Imperial code, crackling and urgent.)', '(It stops, turns its lenses on you, and transmits.)'] });
  return out;
}
