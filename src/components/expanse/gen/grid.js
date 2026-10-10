// The expanse's grid: square sectors SECTOR across, sector (sx, sz) centred
// on (sx * SECTOR, sz * SECTOR) and reaching SECTOR / 2 each way. Sector
// (0, 0) is the authored map. Pure, no imports.
//
// SECTOR
// sectorAt(x, z) → [sx, sz]
// sectorId(sx, sz) → 'E:sx,sz'; parseSector(id) → [sx, sz] or null
// sectorCentre(sx, sz) → [x, 0, z]

// (120,000 since the universe's spread to six, scale.js's SPREAD: the authored
// map's edge is 54,000 out, so sector (0, 0) has to reach past it)
export const SECTOR = 120000;

// (+ 0 turns -0 into 0)
export const sectorAt = (x, z) => [
  Math.round(x / SECTOR) + 0,
  Math.round(z / SECTOR) + 0,
];
export const sectorId = (sx, sz) => `E:${sx},${sz}`;
export function parseSector(id) {
  const m = typeof id === "string" && /^E:(-?\d+),(-?\d+)$/.exec(id);
  return m ? [Number(m[1]) + 0, Number(m[2]) + 0] : null;
}
export const sectorCentre = (sx, sz) => [sx * SECTOR, 0, sz * SECTOR];
