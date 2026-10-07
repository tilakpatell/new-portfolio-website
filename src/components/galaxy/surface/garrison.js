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
// changes); TROOP_NAMES[kind].

// the troopers of each side's look, as the sites name them
const FAMILIES = {
  stormtrooper: ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper'],
  rebel: ['rebel', 'hothtrooper'],
  clone: ['clone'],
  battledroid: ['battledroid', 'superdroid'],
  mercenary: ['mercenary'],
};
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
    const kind = troopKind(entry.kind, troops);
    if (kind === entry.kind) return entry;
    changed = true;
    const out = { ...entry, kind, name: TROOP_NAMES[kind] };
    delete out.says;
    return out;
  });
  return changed ? mapped : life;
}
