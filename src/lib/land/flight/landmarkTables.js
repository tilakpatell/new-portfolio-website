// The flight's landmarks as data: the POIs each named world has besides
// Hoth's (from docs/research/2026-10-09-planet-geographies.md's rows: a flat
// the land eases into, as Echo Base is), which walkable site's places stand
// on each, what stands on the ones with no site place (catalog kinds and kit
// models), and the kit models each planet's clutter is drawn as.
//
// Why here and not in the walkable sites: a site's places are a few hundred
// metres apart round a landing spot; the flight's POIs are kilometres apart
// on a planet. Each POI takes the things of the places named for it, kept
// where they stand relative to the first place's middle.
//
// Pure: plain data, no three.js.
//
//   POIS[planetId] → [{ id, name, at: [x, z], r, edge, h? }] (planetSpec.js
//     adds them to the authored worlds' own)
//   SITE_PLACES[planetId][poiId] → { site, places: [placeId…] | '*', centre?,
//     extra? } (centre: [x, z] in the site, for '*': the whole site round
//     that point; extra: rows as LANDMARKS', for a place the site keeps bare)
//   LANDMARKS[planetId][poiId] → [{ kind | kit: { kit, name }, at: [x, z]
//     (relative to the POI), yaw, scale, opts? }]
//   CLUTTER_KIT[type], CLUTTER_KIT_OF[planetId] → { [kind]: { kit, name, size } }
//     (size: the model's scale for a row of scale 1, so it stands as tall
//     as the code-built shape it replaces)
//   clutterKitOf(spec) → that planet's, its own over its type's

export const LANDMARK_NEAR = 6000; // m: a landmark is drawn within this of its POI
export const LANDMARK_FREE = 1.3; // …and freed past this many times it
export const LANDMARK_PREFETCH = 2; // …and its files fetched from this many times it
export const LANDMARK_CAP = 4; // the nearest this many at once
export const LANDMARK_MIN = 3; // a POI stands with at least this many things…
export const LANDMARK_MAX = 80; // …and at most this many, the nearest its middle
export const DROP_Y = 3; // m: a site's thing standing this far off the flight's ground goes

export const POIS = {
  tatooine: [
    { id: 'mos-eisley', name: 'Mos Eisley', at: [900, 600], r: 260, edge: 120 },
    { id: 'lars-homestead', name: 'The Lars homestead', at: [-1400, 300], r: 60, edge: 40 },
    { id: 'jabbas-palace', name: 'Jabba’s palace', at: [-2600, -1200], r: 90, edge: 60 },
  ],
  endor: [
    // (r 280, not the note's 140: the site's generator stands 240 m from its bunker, and both are this POI's)
    { id: 'bunker', name: 'The shield bunker', at: [600, -400], r: 280, edge: 90 },
    { id: 'bright-tree', name: 'Bright Tree Village', at: [-900, 500], r: 80, edge: 60 },
  ],
  yavin: [
    { id: 'great-temple', name: 'The Great Temple', at: [0, 400], r: 180, edge: 120, h: 8 },
    { id: 'ruined-temple', name: 'A ruined temple', at: [-1500, -900], r: 60, edge: 50 },
  ],
  bespin: [
    { id: 'cloud-city', name: 'Cloud City', at: [0, 0], r: 420, edge: 200, h: 0 },
    { id: 'gas-platform', name: 'A gas platform', at: [2200, 900], r: 60, edge: 40, h: -60 },
  ],
  mustafar: [
    { id: 'mining-facility', name: 'The mining facility', at: [300, 380], r: 70, edge: 40 },
    { id: 'vader-fortress', name: 'Vader’s fortress', at: [-390, 80], r: 80, edge: 50, h: 32 },
    { id: 'collection-arm', name: 'A collection arm', at: [1600, -600], r: 40, edge: 30 },
  ],
  kamino: [
    { id: 'tipoca', name: 'Tipoca City', at: [0, 0], r: 240, edge: 0, h: 5 },
    { id: 'landing-platform', name: 'A landing platform', at: [900, 400], r: 40, edge: 0, h: 5 },
  ],
  dagobah: [{ id: 'yoda-hut', name: 'Yoda’s hut', at: [120, -80], r: 30, edge: 24, h: 3 }],
};

// (Yavin's landing field, 240 m from the temple in the note, is the site's
// own field beside its temple here: the two flats would overlap)
export const SITE_PLACES = {
  hoth: { 'echo-base': { site: 'hoth', places: ['echobase', 'ioncannon', 'shieldgen', 'trenches'] } },
  tatooine: {
    'mos-eisley': { site: 'tatooine', places: ['moseisley'] },
    'lars-homestead': { site: 'tatooine', places: ['homestead'] },
    // (the site's palace is its gate and its walls: the skiff and its crates are the flight's)
    'jabbas-palace': {
      site: 'tatooine',
      places: ['palace'],
      extra: [
        { kind: 'skiff', at: [70, 40], yaw: 0.8, scale: 1 },
        { kind: 'crates', at: [60, -50], yaw: 0.2, scale: 1 },
        { kind: 'barrel', at: [66, -40], yaw: 0, scale: 1 },
      ],
    },
  },
  endor: {
    bunker: { site: 'endor', places: ['bunker', 'generator'] },
    'bright-tree': { site: 'endor', places: ['village'] },
  },
  yavin: {
    'great-temple': { site: 'yavin', places: ['temple', 'hangar', 'field'] },
    'ruined-temple': { site: 'yavin', places: ['ruin'] },
  },
  bespin: { 'cloud-city': { site: 'bespin', places: '*', centre: [0, 0] } },
  mustafar: {
    'mining-facility': { site: 'mustafar', places: ['facility'] },
    'vader-fortress': { site: 'mustafar', places: ['fortress'] },
  },
  kamino: { tipoca: { site: 'kamino', places: '*', centre: [0, 0] } },
  dagobah: { 'yoda-hut': { site: 'dagobah', places: ['hut', 'camp', 'training'] } },
};

const kit = (name, pack = 'space') => ({ kit: pack, name });

export const LANDMARKS = {
  bespin: {
    'gas-platform': [
      { kind: 'bespinplatform', at: [0, 0], yaw: 0, scale: 1 },
      { kind: 'cloudcar', at: [14, -6], yaw: 1.2, scale: 1 },
      { kind: 'crates', at: [-10, 8], yaw: 0.4, scale: 1 },
      { kind: 'lamp', at: [-16, -12], yaw: 0, scale: 1 },
      { kind: 'lamp', at: [16, 12], yaw: 0, scale: 1 },
    ],
  },
  mustafar: {
    'collection-arm': [
      { kind: 'lavacollector', at: [0, 0], yaw: 0.6, scale: 1 },
      { kind: 'droidplatform', at: [22, 8], yaw: -0.3, scale: 1 },
      { kit: kit('MetalSupport'), at: [-18, 10], yaw: 0, scale: 3 },
      { kit: kit('MetalSupport'), at: [-18, -10], yaw: 0, scale: 3 },
      { kind: 'barrel', at: [10, -16], yaw: 0, scale: 1 },
      { kind: 'lamp', at: [-6, 20], yaw: 0, scale: 1 },
    ],
  },
  kamino: {
    'landing-platform': [
      { kind: 'kpad', at: [0, 0], yaw: 0, scale: 1 },
      { kind: 'cratecube', at: [12, 6], yaw: 0.3, scale: 1 },
      { kind: 'barrel', at: [-10, 9], yaw: 0, scale: 1 },
      { kind: 'lamp', at: [14, -14], yaw: 0, scale: 1 },
    ],
  },
};

// Each kind's kit model where the planet type has one; a kind left out
// keeps its code-built shape (Hoth's ice spires, the snowspeeder debris).
// Sizes put a row of scale 1 at about the code shape's size (ground.js:
// a rock 7 m across, a spire 26 m tall).
export const CLUTTER_KIT = {
  ice: { rock: { ...kit('Rock_Large_2'), size: 1.4 } },
  rock: { rock: { ...kit('Rock_Large_1'), size: 1.5 } },
  lava: { rock: { ...kit('Rock_Large_3'), size: 1.5 } },
  desert: { rock: { ...kit('Rock_Big_1', 'naturemega'), size: 1 } },
  ocean: { rock: { ...kit('Rock_Big_2', 'naturemega'), size: 1 } },
  forest: { rock: { ...kit('Rock_Big_2', 'naturemega'), size: 1 }, spire: { ...kit('GiantPine_2', 'naturemega'), size: 1.6 } },
};

// a world's own trees where its fiction has them
export const CLUTTER_KIT_OF = {
  endor: { spire: { ...kit('TallThick_5', 'naturemega'), size: 2.6 } },
  yavin: { spire: { ...kit('TallThick_2', 'naturemega'), size: 2 } },
  dagobah: { spire: { ...kit('TwistedTree_1', 'naturemega'), size: 1.6 }, debris: { ...kit('DeadTree_2', 'naturemega'), size: 0.8 } },
};

export function clutterKitOf(spec) {
  return { ...(CLUTTER_KIT[spec?.type] ?? {}), ...(CLUTTER_KIT_OF[spec?.id] ?? {}) };
}
