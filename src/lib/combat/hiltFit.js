// A lightsaber hilt from the 2017 game fitted to the site's saber: the
// scale that makes its extent along the blade's axis (+y: the game models
// its hilts up the Wep_Root socket's +y, its grip at the origin) the hilt's
// length, and where the blade comes out, the top of the scaled hilt. Nothing
// is recentred: the origin is the game's grip point, which is what the
// socket holds (surface/saber.js wears the model; heroes.js's HILTS name it).
//
//   hiltFit({ min, max }, length) → { scale, bladeY }

export function hiltFit(box, length) {
  const extent = box.max[1] - box.min[1];
  const scale = extent > 1e-6 ? length / extent : 1;
  return { scale, bladeY: box.max[1] * scale };
}
