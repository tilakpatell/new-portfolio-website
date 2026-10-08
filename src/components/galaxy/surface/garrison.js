// Who holds a world in the galaxy's war decides who stands guard on it
// (galaxy/warEffects.js's `troops`): the troopers a site's life names
// (sites/*.js) are its holder's, a Rebel trooper where the Empire's
// stormtrooper stood, a clone where the droids were. A trooper of the
// holder's own kind stays as the site has it (a sandtrooper on Tatooine
// for the Empire); one swapped takes the new side's name and leaves the old
// side's words behind. Someone with a name or a quest of their own (Gree,
// Sefla, Hoth's deck officer) is never re-dressed: they keep their kind,
// their name and their lines. Everyone else (a Jawa, a bantha) is
// untouched. Pure, tested; surface/scene.js hands the site's life through it.
//
// And the landing party knows your side (standing.js): on your side's world
// it salutes you by rank; unsworn, or on a world of nobody's side, it's as
// it always was ("Move along."); on the other side's world it hunts you,
// the same party put out as hostiles (activity.js's standing groups), and
// says nothing.
//
// troopKind(kind, troops) → the kind to draw; garrisonLife(life, troops) →
// the site's life with its troopers the holder's (the same array if nothing
// changes); TROOP_NAMES[kind]; garrisonAt(site, effects, faction, standing)
// → { life, hostiles }: the holder's party at the landing (six to ten of
// its troops on a beat round it and at posts, and a probe droid for an
// Imperial search party on a world that isn't the Empire's own), as life
// entries marked `garrison`, or, when it's your enemy, as hostile spawns
// tagged 'garrison' (`standing`: 'ally' | 'enemy' | 'neutral', else worked
// out from `effects`).

import { WARS, warOfSide } from '../sides.js';
import { RANKS } from '../ranks.js';
import { FAMILIES, standingOf } from './standing.js';

export { FAMILIES };
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
    // (someone in particular, or with a quest to give: as the site has them)
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

// What the party says to you when you're one of theirs: by your rank
// (galaxy/ranks.js's ladder, `effects.rank` a step up it), the higher the
// smarter the salute
function salutes(effects, troops) {
  const ladder = RANKS[effects.side] ?? [];
  const title = ladder[Math.min(effects.rank ?? 0, ladder.length - 1)]?.name ?? null;
  const droid = troops === 'battledroid' ? ['Roger, roger.'] : [];
  const rank = effects.rank ?? 0;
  if (!title) return { beat: [...droid, 'Good to have you back, sir.'], post: ['(It salutes you.)'], rest: ['Good to have you back, sir.'] };
  if (rank >= 4) return { beat: [...droid, `${title}!`, `Good to have you back, ${title}.`, 'The landing is yours, sir.'], post: ['(It snaps to attention.)', `${title}.`], rest: [`Good to have you back, ${title}.`, 'Nothing gets near your ship, sir. Not while we’re here.'] };
  if (rank >= 2) return { beat: [...droid, `${title}.`, 'Good to have you back, sir.', 'Perimeter’s secure, sir.'], post: ['(It salutes you.)', `${title}.`], rest: ['Good to have you back, sir.', 'Quiet posting, this. We like it that way.'] };
  return { beat: [...droid, `Welcome down, ${title}.`, 'All quiet round the landing, sir.'], post: ['(It nods to you.)', `${title}.`], rest: [`Welcome down, ${title}. Stay close to the ship.`, 'Quiet posting, this.'] };
}

// the standing a world's troops have with you, as their holder's (a world's
// effects without its war, a test's, take the war of the side you swore to)
export function garrisonStanding(effects) {
  if (!effects?.troops) return 'neutral';
  const war = effects.war ?? warOfSide(effects.side);
  if (!WARS[war]) return 'neutral';
  return standingOf({ kind: effects.troops, side: effects.owner }, { ...effects, war });
}

// a party's entry put out to hunt you: where it stood (a beat at its first
// point), the same number of them, wandering round there
const HUNT = { spread: 6, roam: 14, leash: 40, hp: 2, tag: 'garrison', hostile: { range: 42, every: 1.8, damage: 8, memory: 6 } };
const hunting = (e) => ({ kind: e.kind, n: e.n ?? 1, at: e.at ?? e.path[0], ...HUNT, ...(e.y != null ? { y: e.y } : {}), ...(e.face != null ? { face: e.face } : {}) });

// the landing party: a beat round the landing on each side, a post at each
// corner, the rest at ease by the ship (seeded by the world's name, so the
// same world gets the same party)
const IMPERIAL = new Set(['empire', 'remnant']);
export function garrisonAt(site, effects, faction = null, standing = garrisonStanding(effects)) {
  const troops = effects?.troops;
  if (!troops || !site?.land?.at) return { life: [], hostiles: [] };
  const [x, z] = site.land.at;
  const name = TROOP_NAMES[troops] ?? troops;
  const seed = [...(site.id ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = 6 + (seed % 5); // 6..10
  const out = [];
  const beat = (dx, dz) => ({ kind: troops, n: 2, path: [[x + dx, z + dz], [x - dz, z + dx], [x - dx, z - dz], [x + dz, z - dx]], speed: 1.2, name, garrison: true, says: ['Move along.', 'This world is under our protection.'] });
  out.push(beat(34, 0));
  if (n >= 8) out.push(beat(0, 48));
  const posts = n >= 8 ? 4 : 2;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2 + 0.6;
    out.push({ kind: troops, at: [x + Math.cos(a) * 26, z + Math.sin(a) * 26], still: true, face: a + Math.PI, name, garrison: true, says: ['(It watches you, and says nothing.)'] });
  }
  const rest = n - 2 * (n >= 8 ? 2 : 1) - posts;
  if (rest > 0) out.push({ kind: troops, n: rest, at: [x + 18, z - 14], spread: 6, roam: 8, speed: 0.9, name, garrison: true, says: ['Papers. No, I\'m joking. Papers.', 'Quiet posting, this.'] });
  if (IMPERIAL.has(effects.owner) && faction !== effects.owner) out.push({ kind: 'probe', at: [x + 60, z + 40], y: 2.2, roam: 50, speed: 1.6, r: 0.6, name: 'Probe droid', garrison: true, says: ['(A burst of Imperial code, crackling and urgent.)', '(It stops, turns its lenses on you, and transmits.)'] });
  if (standing === 'enemy') return { life: [], hostiles: out.map(hunting) };
  if (standing === 'ally') {
    const said = salutes(effects, troops);
    return { life: out.map((e) => (e.kind !== troops ? e : { ...e, says: e.path ? said.beat : e.still ? said.post : said.rest })), hostiles: [] };
  }
  return { life: out, hostiles: [] };
}
