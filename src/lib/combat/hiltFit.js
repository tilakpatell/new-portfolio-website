// A lightsaber hilt from the 2017 game, fitted to the length the site's
// hilt row says: scaled along the blade's axis and nothing else moved. The
// game modelled each hilt for its Wep_Root socket, so the model's origin is
// the grip point and must stay where it is (no recentring); the blade
// leaves from the scaled box's top along that axis. Pure: plain arrays.
//
//   hiltFit({ min, max }, length, axis = 1) → { scale, bladeY }
//     axis: which of x, y, z (0, 1, 2) the blade runs along (y: the site's
//     gun frame, gunplay.js's GUNS.saber, the blade up its +y)

export function hiltFit(box, length, axis = 1) {
  const extent = box.max[axis] - box.min[axis];
  const scale = extent > 1e-9 ? length / extent : 1;
  return { scale, bladeY: box.max[axis] * scale };
}
