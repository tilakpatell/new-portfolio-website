// The wardrobe: how you'd like your Rick and your Morty. Each wears one of
// the bodies the site has rigged for him (the one from the show, or a Rick
// from the Citadel: Cowboy Rick, Cop Rick, a Councillor…; Evil Morty, Cop
// Morty), any of its regions (a coat, a shirt, trousers, hair, trainers)
// recoloured from the show's own colours, and gear on his bones: something
// on his head, on his face, in his hand.
//
// A look: { body, colors: { region: swatch id }, gear: { head, face, hand } }.
// Kept as { rick: look, morty: look } under LOOK_KEY, and sent online as a
// list of ids (writeLook); whatever comes back is read by the tables here,
// so nothing but their ids is ever believed, never a colour or a shape.
// Pure data, tested in Node: dress.js and gear.js put a look on a figure,
// Wardrobe.jsx offers it.

export const LOOK_KEY = 'tp-wardrobe';
export const WHO = ['rick', 'morty'];

// the parts of a body that take a colour, and what they're called on it
export const REGIONS = ['outer', 'inner', 'legs', 'hair', 'shoes'];

// each body: { id, name, asset (meshyCast's), h (metres), regions: {
// region: its name on this body }, hat (it has one of its own: no head gear) }
export const BODIES = {
  rick: [
    { id: 'rick', name: 'Rick C-137', asset: 'rick', h: 1.85, regions: { outer: 'Lab coat', inner: 'Shirt', legs: 'Trousers', hair: 'Hair' } },
    { id: 'tinyrick', name: 'Tiny Rick', asset: 'tinyrick', h: 1.6, regions: { outer: 'Lab coat', inner: 'Shirt', legs: 'Trousers', hair: 'Hair' } },
    { id: 'cowboyrick', name: 'Cowboy Rick', asset: 'cowboyrick', h: 1.97, hat: true, regions: { outer: 'Waistcoat', inner: 'Shirt', legs: 'Jeans' } },
    { id: 'cop', name: 'Cop Rick', asset: 'cop', h: 1.85, hat: true, regions: { outer: 'Uniform', hair: 'Hair' } },
    { id: 'detectiverick', name: 'Detective Rick', asset: 'detectiverick', h: 1.92, hat: true, regions: { outer: 'Trench coat', legs: 'Trousers' } },
    { id: 'sweaterrick', name: 'Doctor Rick', asset: 'sweaterrick', h: 1.85, regions: { outer: 'Cardigan', legs: 'Trousers', hair: 'Hair' } },
    { id: 'suitrick', name: 'Office Rick', asset: 'suitrick', h: 1.85, regions: { outer: 'Suit', hair: 'Hair' } },
    { id: 'factoryrick', name: 'Wafer-line Rick', asset: 'factoryrick', h: 1.85, regions: { outer: 'Jumpsuit' } },
    { id: 'constructionrick', name: 'Construction Rick', asset: 'constructionrick', h: 1.9, hat: true, regions: { outer: 'Jumpsuit' } },
    { id: 'councilrick-a', name: 'Councillor Rick (white)', asset: 'councilrick-a', h: 1.85, regions: { outer: 'Robe', hair: 'Hair' } },
    { id: 'councilrick-b', name: 'Councillor Rick (bearded)', asset: 'councilrick-b', h: 1.9, regions: { outer: 'Robe', hair: 'Hair' } },
    { id: 'councilrick-c', name: 'Councillor Rick (bald)', asset: 'councilrick-c', h: 1.82, regions: { outer: 'Dress coat', legs: 'Trousers' } },
  ],
  morty: [
    { id: 'morty', name: 'Morty C-137', asset: 'morty', h: 1.5, regions: { inner: 'T-shirt', legs: 'Jeans', hair: 'Hair', shoes: 'Trainers' } },
    { id: 'evilmorty', name: 'Evil Morty', asset: 'evilmorty', h: 1.5, regions: { inner: 'T-shirt', legs: 'Jeans', hair: 'Hair' } },
    { id: 'copmorty', name: 'Cop Morty', asset: 'copmorty', h: 1.5, hat: true, regions: { outer: 'Uniform', hair: 'Hair' } },
  ],
};

// the show's colours, by name
export const SWATCHES = [
  { id: 'labwhite', name: 'Lab coat white', hex: '#eef3f4' },
  { id: 'ricksblue', name: 'Rick’s hair blue', hex: '#a9d6e5' },
  { id: 'mortyyellow', name: 'Morty yellow', hex: '#f3d84b' },
  { id: 'portalgreen', name: 'Portal green', hex: '#97ce4c' },
  { id: 'meeseeksblue', name: 'Meeseeks blue', hex: '#6fc3ea' },
  { id: 'plumbuspink', name: 'Plumbus pink', hex: '#e79bb0' },
  { id: 'squanchyorange', name: 'Squanchy orange', hex: '#e98a3a' },
  { id: 'summerpink', name: 'Summer pink', hex: '#e2468f' },
  { id: 'bethred', name: 'Beth red', hex: '#b8323b' },
  { id: 'jerrygreen', name: 'Jerry green', hex: '#5b6b3a' },
  { id: 'birdbrown', name: 'Birdperson brown', hex: '#8a5a34' },
  { id: 'unitypurple', name: 'Unity purple', hex: '#7b4bb5' },
  { id: 'gazorpteal', name: 'Gazorpazorp teal', hex: '#2f8f87' },
  { id: 'cromulonpeach', name: 'Cromulon peach', hex: '#f0b49a' },
  { id: 'councilgrey', name: 'Council grey', hex: '#7d8590' },
  { id: 'voidblack', name: 'Void black', hex: '#24222b' },
];

// gear, by where it goes: { id, name, bone }
export const GEAR_SLOTS = ['head', 'face', 'hand'];
export const GEAR = {
  head: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'partyhat', name: 'Party hat', bone: 'Head' },
    { id: 'beanie', name: 'Beanie', bone: 'Head' },
    { id: 'tophat', name: 'Top hat', bone: 'Head' },
    { id: 'crown', name: 'Crown', bone: 'Head' },
    { id: 'headphones', name: 'Headphones', bone: 'Head' },
  ],
  face: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'shades', name: 'Shades', bone: 'Head' },
    { id: 'goggles', name: 'Flight goggles', bone: 'Head' },
    { id: 'eyepatch', name: 'Eyepatch', bone: 'Head' },
  ],
  hand: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'portalgun', name: 'Portal gun', bone: 'RightHand', file: '/models/wardrobe/portalgun.glb' }, // (someone else's model: see modelCredits.json)
    { id: 'plumbus', name: 'Plumbus', bone: 'RightHand' },
    { id: 'laserpistol', name: 'Laser pistol', bone: 'RightHand' },
  ],
};

const SWATCH = new Map(SWATCHES.map((s) => [s.id, s]));
export const swatchById = (id) => SWATCH.get(id) ?? null;
export const bodyOf = (who, id) => BODIES[who]?.find((b) => b.id === id) ?? null;
export const gearById = (slot, id) => GEAR[slot]?.find((g) => g.id === id) ?? null;
// the model files a pair of looks wears, for the credits of what's on screen
export const wornFiles = (looks) => [...new Set(WHO.flatMap((who) => GEAR_SLOTS.map((slot) => gearById(slot, looks[who]?.gear[slot])?.file).filter(Boolean)))];

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export const defaultLook = (who) => ({ body: BODIES[who][0].id, colors: {}, gear: { head: 'none', face: 'none', hand: 'none' } });

// A look from storage (or anything): the body if it's one of his, the
// colours its regions take, the gear there is (and nothing on a hat).
export function readLook(who, raw) {
  const out = defaultLook(who);
  if (!isObject(raw)) return out;
  const body = (typeof raw.body === 'string' && bodyOf(who, raw.body)) || bodyOf(who, out.body);
  out.body = body.id;
  if (isObject(raw.colors)) for (const r of Object.keys(body.regions)) if (typeof raw.colors[r] === 'string' && SWATCH.has(raw.colors[r])) out.colors[r] = raw.colors[r];
  if (isObject(raw.gear)) for (const slot of GEAR_SLOTS) if (typeof raw.gear[slot] === 'string' && gearById(slot, raw.gear[slot])) out.gear[slot] = raw.gear[slot];
  if (body.hat) out.gear.head = 'none';
  return out;
}

export function readLooks(raw) {
  return Object.fromEntries(WHO.map((who) => [who, readLook(who, isObject(raw) ? raw[who] : null)]));
}

// The wire: [body, outer, inner, legs, hair, shoes, head, face, hand], a
// region with no colour of its own as null.
export const writeLook = (look) => [look.body, ...REGIONS.map((r) => look.colors[r] ?? null), ...GEAR_SLOTS.map((s) => look.gear[s])];
export function readLookWire(who, data) {
  if (!Array.isArray(data) || data.length !== 1 + REGIONS.length + GEAR_SLOTS.length) return null;
  if (!data.every((v) => v === null || (typeof v === 'string' && v.length <= 24))) return null;
  const [body, ...rest] = data;
  if (!bodyOf(who, body)) return null;
  const colors = Object.fromEntries(REGIONS.map((r, i) => [r, rest[i]]).filter(([, v]) => v !== null));
  const gear = Object.fromEntries(GEAR_SLOTS.map((s, i) => [s, rest[REGIONS.length + i]]));
  return readLook(who, { body, colors, gear });
}
