// The ultra lane's remakes (docs/superpowers/evidence/ultra-models/plan.md):
// the kinds of the twenty whose plain model had the wrong shape on its judge
// sheet, each made again for the ultra level only, from a better
// three-quarter picture of the thing, by scripts/meshy-galaxy-buildings.mjs
// like its own and in its format (that script's header has the fields). Only
// `models --ultra` and `fetch --ultra` are run here, so each writes
// <kind>.ultra.glb beside the plain file and the plain file stays exactly as
// it is. A kind remade here takes over from its earlier lane's entry (as the
// audit's do), with the same size and cut as there. Their tasks go in
// scripts/meshy-galaxy-ultra-tasks.json (MESHY_TASKS), their lifts and raw
// models in lab/meshy/ultra (MESHY_REVIEW), made on the account whose key is
// MESHY_API_KEY_ACC_3 (a task is read back with the key that made it).
//
//   MESHY_API_KEY=$MESHY_API_KEY_ACC_3 MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs <lift | models --ultra | fetch --ultra | sheet --ultra> <kind …>
export const BUILDINGS = {
  // Kamino: one of Tipoca City's domes (the Clone Wars shot of the city; the
  // fill lane lifted a saucer with a tall flared spire out of the same shot,
  // and the city's domes are rounded, on thin stilts, with slim needles): the
  // round dome at the front right, on its own
  tipocadome: {
    ref: 'File:TipocaCity-CC.png',
    crop: [0.7, 0.43, 0.2, 0.31],
    lift: 'the one rounded domed building on thin stilts (a wide low rounded dome of dark grey metal plates in two steps, a ring of small lit windows round its rim and a flat ring deck under it, three slim antenna needles on its top, standing on a ring of many thin pylons with small lit windows down them), whole, on its own, without the other domes, the walkway or the sea',
    metres: 60,
    along: 'w',
    tris: 30000,
    tex: 2048,
    hero: true,
  },
  // Kashyyyk: a great wroshyr (the film's shot of Kachirho; the fill lane's
  // was lifted from the leaning tree at the left and came out a bonsai on a
  // short trunk): the tall straight-trunked tree at the far right, its crown
  // far above
  wroshyrgreat: {
    ref: 'File:Kachirho BF2.jpg',
    crop: [0.72, 0.03, 0.17, 0.72],
    lift: 'the one tall tree in the middle (a colossal straight trunk of rough grey-brown bark rising hundreds of metres, much taller than it is wide, dozens of small dark-brown wooden pods shaped like downward-pointing cones hanging on it, wooden platforms and walkways round its foot, a broad dense dark-green canopy of spreading branches only at its very top), whole, on its own, without the other trees, the vehicles, the mist, the hills or the water',
    metres: 230,
    along: 'h',
    tris: 45000,
    tex: 2048,
    hero: true,
  },
  // Bespin: the plaza's terraces (the game's shot of Cloud City's streets;
  // the three lane's came out a plain half-ring): the curved stepped
  // terraces round the tower's foot, without the tower
  cloudplaza: {
    ref: 'File:Cloud City Streets SWB.png',
    crop: [0.46, 0.26, 0.4, 0.32],
    lift: 'the curved stepped terraces (concentric curved cream-white walls in three tiers stepping down to a sunken round court, wide flights of steps between the tiers, low railings and planters along them, walkways leading off), whole, on their own, with the court in the middle left open and empty: without the tall round tower, the other buildings or the people',
    metres: 48,
    along: 'w',
    tris: 20000,
    tex: 2048,
    hero: true,
  },
  // Endor: the second Death Star over the forest (the film's picture of it
  // half built; the Sketchfab plain model is a noisy black shell with the
  // trench and the dish barely legible): the catalogue's cut (forest.js:
  // 14,000 triangles) sets its ultra cut. Asked from the picture itself,
  // Meshy's mesh repair failed to close the open superstructure, so it is
  // lifted first with that side rendered as one solid mass
  ds2sky: {
    ref: 'File:DeathStar2.jpg',
    lift: 'the great unfinished grey battle-station sphere (a huge sphere of grey panelled metal, a wide round concave dish set into its upper half, a trench round its equator, its right-hand side still open with its inner decks and girders showing as one dense solid jagged mass, not hollow)',
    shot: 'The whole station in frame, seen as in the picture, isolated on a plain light grey background, no stars, no text.',
    metres: 640,
    along: 'w',
    tris: 14000,
    tex: 2048,
    hero: true,
  },
};
