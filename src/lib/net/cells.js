// The grid the shared world is heard by: a pilot's events carry the cell
// they're in (Nostr tag `g`), and a room listens only for the cells round
// its pilot, so a busy planet costs each browser the few ships near it, not
// all of them. The durable world (src/lib/durable) fetches by the same
// cells, so this is the one place NET_CELL is said.
//
// A cell's key is 'cx,cz' (whole cells from the planet's origin, floored,
// so the cell holds its west and south edges); its tag is the planet's id
// and the key, 'hoth/0,0', since one relay carries every planet's room.
//
// NET_CELL; netCellOf(x, z) → [cx, cz]; netCellsAround(cx, cz, r = 1) →
// keys, nearest first (a list cut short still holds the cells that matter);
// cellTag(planetId, key) → tag; parseTag(tag) → { planetId, cx, cz } | null;
// sameCells(a, b) → whether two lists hold the same tags, order aside.

export const NET_CELL = 2048; // metres a side: a ship at 300 m/s crosses one in about seven seconds

const TAG = /^([A-Za-z0-9_-]{1,64})\/(-?\d{1,6}),(-?\d{1,6})$/;

export const netCellOf = (x, z) => [Math.floor(x / NET_CELL), Math.floor(z / NET_CELL)];

export function netCellsAround(cx, cz, r = 1) {
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push([dx * dx + dz * dz, `${cx + dx},${cz + dz}`]);
  return out.sort((a, b) => a[0] - b[0]).map((c) => c[1]);
}

export const cellTag = (planetId, key) => `${planetId}/${key}`;

export function parseTag(tag) {
  const m = typeof tag === 'string' ? TAG.exec(tag) : null;
  return m ? { planetId: m[1], cx: Number(m[2]), cz: Number(m[3]) } : null;
}

export function sameCells(a, b) {
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((t, i) => t === y[i]);
}
