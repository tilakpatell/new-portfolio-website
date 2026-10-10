// The grid the game's modular pieces are cut on (Battlefront II, 2017: Echo
// Base's hangar, corridor and wall systems). Each piece's name carries its
// size in centimetres and its origin sits at a corner or an edge, not the
// middle, so pieces laid at multiples of their size meet edge to edge.
// Pure: the names, the sizes, the snapping; props/ice.js and sites/
// echoLayout.js lay the pieces.
//
// Names come in two shapes:
//   WxHxD                      corridor_01_s_256x512x512_a: across, up, along
//   DxW (the hangar's)         hangarlargewall_01_3072x2048: along, across; how
//                              tall is the system's (30.72 m large, 10.24 medium)

export const GRID = 2.56; // metres: the smallest step any piece's size is a multiple of

export function sizeFromName(name) {
  const three = /_(\d{3,4})x(\d{3,4})x(\d{3,4})(?:_|$)/.exec(name);
  if (three) return [three[1], three[2], three[3]].map((cm) => Number(cm) / 100);
  const two = /_(\d{3,4})x(\d{3,4})(?:_|$)/.exec(name);
  if (two) return [Number(two[2]) / 100, null, Number(two[1]) / 100];
  return null;
}

// a number, or each of a position's, to the nearest line of the grid
export function snap(v, grid = GRID) {
  if (Array.isArray(v)) return v.map((x) => snap(x, grid));
  return Math.round(v / grid) * grid;
}

// what the kit file calls a piece: its manifest name's last part, without
// the drop's `_mesh`
export const pieceName = (name) => name.split('/').pop().replace(/_mesh$/, '');
