// Who you play down on the galaxy's worlds, and how their lightsaber's
// made: the roster (each a rigged figure the site already has, with the
// weapon they carry), the blade colours and hilts to pick from, and the
// choice kept in the browser. Pure data and parsing, so it's tested in
// Node; HeroPanel.jsx offers it, pages/GalaxySurface.jsx reads it, and
// surface/scene.js walks the hero in the lead of the party.
//
//   HEROES                   the roster, in order: { id, name, tall, src, weapon ('saber' | a gun kind), bolt, saber?, blurb, film }
//   SABER_COLORS, HILTS      what a saber can be: { id, name, hex } and { id, name, ... }
//   HERO_KEY                 the localStorage key
//   readHero(raw, ship)      the choice, made good: { id, color, hilt } (the ship's own lead when nothing's kept or it's nonsense)
//   heroSpec(hero, ship)     the party spec for them (universe/footScene.js's PARTY shape), the saber on it where they carry one
//   defaultHeroId(ship)      who flies that ship

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
  { id: 'luke', name: 'Luke’s own', about: 'The one he built on Tatooine: slimmer, a black sleeve and a thin emitter.', length: 0.26, emitter: 'thin', grip: 'sleeve', metal: '#9a9ea6', trim: '#141518' },
  { id: 'ahsoka', name: 'Ahsoka’s', about: 'A curved white hilt, the way she carries two.', length: 0.24, emitter: 'shroud', grip: 'curved', metal: '#e8e6e0', trim: '#5a5c60' },
  { id: 'dooku', name: 'Curved', about: 'A fencer’s hilt, bent for the wrist.', length: 0.27, emitter: 'cup', grip: 'curved', metal: '#8a7a5a', trim: '#2a2420' },
  { id: 'temple', name: 'Temple guard', about: 'A long hilt in Jedi gold and bronze.', length: 0.3, emitter: 'shroud', grip: 'ribbed', metal: '#c8a860', trim: '#4a3a20' },
];

export const HEROES = [
  { id: 'luke', name: 'Luke Skywalker', tall: 1.72, src: { url: crew('luke') }, weapon: 'saber', bolt: '#5cff6a', saber: { color: 'green', hilt: 'luke' }, blurb: 'A farm boy from Tatooine, a Jedi by the end.', film: 'The Original Trilogy' },
  { id: 'leia', name: 'Leia Organa', tall: 1.5, src: { url: crew('leia') }, weapon: 'blaster', bolt: '#ff3b30', blurb: 'A princess, a senator, a general. Shoots better than the boys.', film: 'The Original Trilogy' },
  { id: 'han', name: 'Han Solo', tall: 1.85, src: { url: crew('han') }, weapon: 'blaster', bolt: '#ff4a3d', blurb: 'Captain of the Millennium Falcon. Shot first.', film: 'The Original Trilogy' },
  { id: 'chewie', name: 'Chewbacca', tall: 2.28, src: { url: '/models/cockpit/chewie.glb' }, weapon: 'bowcaster', bolt: '#ff4a3d', blurb: 'Two hundred years old and still winning arguments.', film: 'The Original Trilogy' },
  { id: 'ahsoka', name: 'Ahsoka Tano', tall: 1.85, src: { url: crew('ahsoka') }, weapon: 'saber', bolt: '#f4f8ff', saber: { color: 'white', hilt: 'ahsoka' }, blurb: 'No longer a Jedi. Still the best of them.', film: 'The Clone Wars, Ahsoka' },
  { id: 'bobafett', name: 'Boba Fett', tall: 1.83, src: { url: crew('bobafett') }, weapon: 'rifle', bolt: '#ff6a3d', blurb: 'The best bounty hunter in the galaxy, and he knows it.', film: 'The Original Trilogy, The Book of Boba Fett' },
];

const BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const heroById = (id) => BY_ID[id] ?? null;

// who flies which ship, as the party has it
const LEADS = { xwing: 'luke', falcon: 'han', cruiser: 'luke', rv: 'luke' };
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
  return { id: hero.id, color, hilt };
}
export const writeHero = (hero) => JSON.stringify({ id: hero.id, color: hero.color, hilt: hero.hilt });

// the spec the scene walks: a saber hero carries no gun (the saber's its
// own thing, surface/saber.js), the others their gun
export function heroSpec(hero) {
  const h = BY_ID[hero.id] ?? BY_ID.luke;
  const saber = h.weapon === 'saber' ? { color: SABER_COLORS.find((c) => c.id === hero.color)?.hex ?? '#4aa8ff', hilt: HILTS.find((x) => x.id === hero.hilt) ?? HILTS[0] } : null;
  return { id: h.id, name: h.name.split(' ')[0], tall: h.tall, src: h.src, gun: saber ? 'saber' : h.weapon, bolt: saber ? saber.color : h.bolt, saber, hero: true };
}
