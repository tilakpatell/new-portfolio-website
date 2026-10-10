// Who you play down on the galaxy's worlds, and how their lightsaber's
// made: the roster (each a rigged figure the site already has, with the
// weapon they carry), the blade colours and hilts to pick from, and the
// choice kept in the browser. Pure data and parsing, so it's tested in
// Node; HeroPanel.jsx offers it, pages/GalaxySurface.jsx reads it, and
// surface/scene.js walks the hero in the lead of the party.
//
//   HEROES                   the roster, in order: { id, name, tall, src, weapon ('saber' | a gun kind), bolt, saber?, abilities { power, second } (surface/abilityRules.js's kinds, on G and V), blurb, film, side ('galaxy' | 'elsewhere': the crews from other universes walk here too), lean ('light' | 'dark' | null: the side of the galaxy's wars they'd pick, allegiance.js), lines { ours, theirs } (said as a ground assault starts on their side, or against it) }
//   SABER_COLORS, HILTS      what a saber can be: { id, name, hex } and { id, name, ... }
//   HERO_KEY                 the localStorage key
//   readHero(raw, ship)      the choice, made good: { id, color, hilt, stance, gun, mods, perks } (the ship's own lead when nothing's kept or it's nonsense; the stance is combatRules.js's, the gun and mods weaponRules.js's)
//   heroSpec(hero, ship)     the party spec for them (universe/footScene.js's PARTY shape), the saber (with its stance) on it where they carry one, else the gun they picked with its mods
//   partyFor(spec, crew)     the two who walk: the hero, and the ship's crewmate who isn't them (the crew as it is with no hero)
//   loadoutLine(hero)        the choice in a line: a Jedi's blade, hilt and stance, or the gun and its mods; the perks counted
//   refitOf(was, next)       what a figure needs for a change of spec: 'same', 'arms' (another gun, blade or mods in the same hands) or 'body' (another person)
//   defaultHeroId(ship)      who flies that ship
//   leanText(lean)           a hero's lean, for their card (or null)

import { STANCES } from './surface/combatRules';
import { MODS, MAX_MODS, PICKABLE, WEAPONS } from './surface/weaponRules';
import { readPerks } from './perks';

export const HERO_KEY = 'tp-galaxy-hero';

// (the crew's own files: Luke and Leia are Sketchfab figures rigged with Meshy onto the crew's skeleton)
const crew = (name) => `/models/galaxy/crew/${name}.glb`;

export const SABER_COLORS = [
  { id: 'blue', name: 'Blue', hex: '#4aa8ff' },
  { id: 'green', name: 'Green', hex: '#5cff6a' },
  { id: 'purple', name: 'Purple', hex: '#b36aff' },
  { id: 'yellow', name: 'Yellow', hex: '#ffe066' },
  { id: 'white', name: 'White', hex: '#f4f8ff' },
  { id: 'orange', name: 'Orange', hex: '#ff9a3c' },
  { id: 'red', name: 'Red', hex: '#ff3b3b' },
];

// a hilt: its length (metres), the emitter's shape, the grip's look
export const HILTS = [
  { id: 'skywalker', name: 'Skywalker', about: 'Anakin’s, then Luke’s: a plain steel hilt with a black ribbed grip.', length: 0.28, emitter: 'cup', grip: 'ribbed', metal: '#b8bcc4', trim: '#2a2c30' },
  { id: 'luke', name: 'Luke’s own', about: 'The one he built on Tatooine: slimmer, a black sleeve and a thin emitter.', length: 0.26, emitter: 'thin', grip: 'sleeve', metal: '#9a9ea6', trim: '#141518' , lean: 'light', lines: { ours: 'We hold this line. Nobody gets past while I’m standing.', theirs: 'I’m on the wrong side of this one. I’ll do what I have to.' } },
  { id: 'ahsoka', name: 'Ahsoka’s', about: 'A curved white hilt, the way she carries two.', length: 0.24, emitter: 'shroud', grip: 'curved', metal: '#e8e6e0', trim: '#5a5c60' , lean: 'light', lines: { ours: 'Stay close and trust each other. That’s how we win.', theirs: 'I’ve fought for the wrong people before. Never again. Except today.' } },
  { id: 'dooku', name: 'Curved', about: 'A fencer’s hilt, bent for the wrist.', length: 0.27, emitter: 'cup', grip: 'curved', metal: '#8a7a5a', trim: '#2a2420' },
  { id: 'temple', name: 'Temple guard', about: 'A long hilt in Jedi gold and bronze.', length: 0.3, emitter: 'shroud', grip: 'ribbed', metal: '#c8a860', trim: '#4a3a20' },
];

// (each hero's own two abilities, G then V: what the films give them)
export const HEROES = [
  { id: 'luke', name: 'Luke Skywalker', tall: 1.72, src: { url: crew('luke') }, weapon: 'saber', bolt: '#5cff6a', saber: { color: 'green', hilt: 'luke', stance: 'single' }, abilities: { power: 'push', second: 'pull' }, blurb: 'A farm boy from Tatooine, a Jedi by the end.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'We hold this line. Nobody gets past while I’m standing.', theirs: 'I’m on the wrong side of this one. I’ll do what I have to.' } },
  { id: 'leia', name: 'Leia Organa', tall: 1.5, src: { url: crew('leia') }, weapon: 'blaster', bolt: '#ff3b30', abilities: { power: 'overcharge', second: 'medpack' }, blurb: 'A princess, a senator, a general. Shoots better than the boys.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'Hold your positions. They’ve never beaten us when we stand together.', theirs: 'This isn’t my cause. I’ll fight it anyway, and remember who I am.' } },
  { id: 'han', name: 'Han Solo', tall: 1.85, src: { url: crew('han') }, weapon: 'blaster', bolt: '#ff4a3d', abilities: { power: 'detonator', second: 'overcharge' }, blurb: 'Captain of the Millennium Falcon. Shot first, with the DL-44.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'All right, let’s show these guys how it’s done.', theirs: 'I’m only here for the money. Remember that when it goes bad.' } },
  { id: 'chewie', name: 'Chewbacca', tall: 2.28, src: { url: '/models/cockpit/chewie.glb' }, weapon: 'bowcaster', bolt: '#ff4a3d', abilities: { power: 'roar', second: 'overcharge' }, blurb: 'Two hundred years old and still winning arguments.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: '[a battle roar, ready for anything]', theirs: '[an unhappy growl: he doesn’t like whose side this is]' } },
  { id: 'ahsoka', name: 'Ahsoka Tano', tall: 1.85, src: { url: crew('ahsoka') }, weapon: 'saber', bolt: '#f4f8ff', saber: { color: 'white', hilt: 'ahsoka', stance: 'dual' }, abilities: { power: 'push', second: 'pull' }, blurb: 'No longer a Jedi. Still the best of them.', film: 'The Clone Wars, Ahsoka', side: 'galaxy' , lean: 'light', lines: { ours: 'Stay close and trust each other. That’s how we win.', theirs: 'I’ve fought for the wrong people before. Never again. Except today.' } },
  { id: 'bobafett', name: 'Boba Fett', tall: 1.83, src: { url: crew('bobafett') }, weapon: 'ee3', bolt: '#ff6a3d', abilities: { power: 'jetpack', second: 'rocket' }, blurb: 'The best bounty hunter in the galaxy, and he knows it. Flies.', film: 'The Original Trilogy, The Book of Boba Fett', side: 'galaxy' , lean: 'dark', lines: { ours: 'The contract’s good. Nobody gets through.', theirs: 'Different employer, same result. They’ll pay double.' } },
  // (the crews from elsewhere, as the universe's foot party has them: universe/footScene.js's PARTY)
  { id: 'rick', name: 'Rick Sanchez', tall: 1.88, src: { meshy: 'rick' }, weapon: 'portal', bolt: '#8dff5a', abilities: { power: 'hop', second: 'overcharge' }, blurb: 'The smartest man in the multiverse, with a portal gun and no patience.', film: 'Rick and Morty', side: 'elsewhere' , lean: null, lines: { ours: 'Sure, whatever, I’ll defend the thing. Wubba lubba dub dub.', theirs: 'Switching sides mid-war is a Tuesday for me, Morty.' } },
  { id: 'morty', name: 'Morty Smith', tall: 1.6, src: { meshy: 'morty' }, weapon: 'laser', bolt: '#8dff5a', abilities: { power: 'sprint', second: 'medpack' }, blurb: 'Fourteen, nervous, and still here after everything.', film: 'Rick and Morty', side: 'elsewhere' , lean: 'light', lines: { ours: 'Okay, okay, we’re the good guys this time, right? Right?', theirs: 'Oh geez, are we the bad guys? I think we’re the bad guys.' } },
  { id: 'walt', name: 'Walter White', tall: 1.79, src: { url: '/models/albuquerque/walt.glb' }, weapon: 'revolver', bolt: '#ffd36b', abilities: { power: 'fulminate', second: 'overcharge' }, blurb: 'A chemistry teacher. The one who knocks.', film: 'Breaking Bad', side: 'elsewhere' , lean: 'dark', lines: { ours: 'This is our territory now. We hold it, with discipline.', theirs: 'Loyalty is for amateurs. I chose the better organisation.' } },
  { id: 'jesse', name: 'Jesse Pinkman', tall: 1.73, src: { url: '/models/albuquerque/jesse.glb' }, weapon: 'pistol', bolt: '#ffd36b', abilities: { power: 'sprint', second: 'overcharge' }, blurb: 'Yeah, science. Quick on his feet, quicker to run.', film: 'Breaking Bad', side: 'elsewhere' , lean: null, lines: { ours: 'Yo, let’s hold this place! Science, yeah!', theirs: 'Yo, I don’t even know whose side we’re on anymore.' } },
];

const BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const heroById = (id) => BY_ID[id] ?? null;

// which side of the galaxy's wars a hero leans to (allegiance.js suggests it;
// `lean`, since `stance` is how a Jedi holds a saber), in a line for their card
export const leanText = (lean) => (lean === 'light' ? 'Fights for the Republic and the Rebellion' : lean === 'dark' ? 'Takes the Empire’s contracts' : null);

// who flies which ship, as the party has it: you walk in as them until you
// pick someone else
const LEADS = { xwing: 'luke', falcon: 'han', cruiser: 'rick', rv: 'walt' };
export const defaultHeroId = (ship) => LEADS[ship] ?? 'luke';

// the choice, from what's kept (a JSON string, an object, or nothing)
export function readHero(raw, ship = 'xwing') {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const hero = BY_ID[v?.id] ?? BY_ID[defaultHeroId(ship)];
  const color = SABER_COLORS.some((c) => c.id === v?.color) ? v.color : (hero.saber?.color ?? 'blue');
  const hilt = HILTS.some((h) => h.id === v?.hilt) ? v.hilt : (hero.saber?.hilt ?? 'skywalker');
  const stance = STANCES[v?.stance] ? v.stance : (hero.saber?.stance ?? 'single');
  // (a gun hero carries their own, or one of the pickable ones; a Jedi's gun is their saber)
  const gun = hero.weapon !== 'saber' && (v?.gun === hero.weapon || PICKABLE.includes(v?.gun)) && WEAPONS[v.gun] ? v.gun : hero.weapon;
  const mods = Array.isArray(v?.mods) ? [...new Set(v.mods.filter((m) => MODS[m]))].slice(0, MAX_MODS) : [];
  return { id: hero.id, color, hilt, stance, gun, mods, perks: readPerks(v?.perks) };
}
export const writeHero = (hero) => JSON.stringify({ id: hero.id, color: hero.color, hilt: hero.hilt, stance: hero.stance, gun: hero.gun, mods: hero.mods ?? [], perks: hero.perks ?? [] });

// the spec the scene walks: a saber hero carries no gun (the saber's its
// own thing, surface/saber.js), the others their gun
export function heroSpec(hero) {
  const h = BY_ID[hero.id] ?? BY_ID.luke;
  const saber = h.weapon === 'saber' ? { color: SABER_COLORS.find((c) => c.id === hero.color)?.hex ?? '#4aa8ff', hilt: HILTS.find((x) => x.id === hero.hilt) ?? HILTS[0], stance: STANCES[hero.stance] ? hero.stance : (h.saber?.stance ?? 'single') } : null;
  const gun = saber ? 'saber' : WEAPONS[hero.gun] && hero.gun !== 'saber' ? hero.gun : h.weapon;
  // (a gun from elsewhere fires yellow; the galaxy's keep the hero's own colour)
  const bolt = saber ? saber.color : WEAPONS[gun]?.side === 'elsewhere' ? '#ffd36b' : h.bolt;
  return { id: h.id, name: h.name.split(' ')[0], tall: h.tall, src: h.src, ...(h.rig ? { rig: h.rig } : {}), gun, bolt, saber, abilities: h.abilities, mods: saber ? [] : (hero.mods ?? []).filter((m) => MODS[m]).slice(0, MAX_MODS), perks: readPerks(hero.perks), hero: true };
}

// the two who walk down here: the hero in the lead, and the ship's
// crewmate who isn't them (its second, or its first when the hero is the second)
export const partyFor = (spec, crew) => (spec ? [spec, crew[1].id === spec.id ? crew[0] : crew[1]] : crew);

// what a change of choice asks of a figure already walking (surface/scene.js
// swaps it there and then): another person is a new body; another gun, its
// mods or the blade (colour, hilt, stance) is new arms in the same hands;
// anything else (perks, abilities) is only numbers
const armsOf = (s) => JSON.stringify([s.gun ?? null, s.saber ? [s.saber.color, s.saber.hilt?.id ?? null, s.saber.stance] : null, s.mods ?? []]);
export function refitOf(was, next) {
  if (!was || was.id !== next.id || JSON.stringify(was.src) !== JSON.stringify(next.src)) return 'body';
  return armsOf(was) === armsOf(next) ? 'same' : 'arms';
}

// the choice in a line, for the panel's summary and the note as it goes on
export function loadoutLine(hero) {
  const h = BY_ID[hero.id] ?? BY_ID.luke;
  const parts =
    h.weapon === 'saber'
      ? [`${SABER_COLORS.find((c) => c.id === hero.color)?.name ?? 'Blue'} blade`, `${HILTS.find((x) => x.id === hero.hilt)?.name ?? HILTS[0].name} hilt`, STANCES[hero.stance]?.name ?? STANCES.single.name]
      : [[WEAPONS[hero.gun]?.name ?? WEAPONS[h.weapon]?.name, (hero.mods ?? []).filter((m) => MODS[m]).map((m) => MODS[m].name).join(', ')].filter(Boolean).join(' · ')];
  const n = (hero.perks ?? []).length;
  return [...parts, ...(n ? [`${n} perk${n === 1 ? '' : 's'}`] : [])].join(' · ');
}
