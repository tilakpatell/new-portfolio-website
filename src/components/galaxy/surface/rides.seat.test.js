import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEATS } from './riders';
import { RIDES } from './rides';

// The rides on the game's vehicles (the X-34, the 74-Z: catalog/
// bf2017-vehicles.js), their seats measured once off the models and held to
// them here: the hips sit on something just under them, the hands are on
// something, the feet stand on something. Read from the files themselves,
// in the model's frame (+z its nose, +x its left, y up from its underside).
async function points(kind) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(fileURLToPath(new URL(`../../../../public/models/galaxy/surface/${kind}.glb`, import.meta.url)));
  const out = [];
  const v = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const a = p.getAttribute('POSITION');
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        out.push([0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]));
      }
    }
  }
  return out;
}
const near = (pts, p, r) => pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < r);
// the highest of the model under a point, within a hand's breadth across
const under = (pts, p, r = 0.12) => Math.max(-Infinity, ...pts.filter((q) => Math.abs(q[0] - p[0]) < r && Math.abs(q[2] - p[2]) < r && q[1] <= p[1] + 0.02).map((q) => q[1]));
const mirror = (a) => [-a[0], a[1], a[2]];

describe('the rides’ seats, on the game’s vehicles', () => {
  for (const kind of ['speederbike', 'landspeeder'])
    it(`seats the ${kind}’s rider on its model`, { timeout: 20000 }, async () => {
      const pts = await points(kind);
      const seat = SEATS[kind];
      // (on the seat, not in it, not over it)
      expect(seat.hips[1] - under(pts, seat.hips)).toBeLessThan(0.15);
      expect(RIDES[kind].seat[1] - under(pts, RIDES[kind].seat)).toBeLessThan(0.12);
      const hands = [seat.hands[0], seat.hands[1] ?? mirror(seat.hands[0])];
      const feet = [seat.feet[0], seat.feet[1] ?? mirror(seat.feet[0])];
      for (const h of hands) expect(near(pts, h, 0.12), `hand at ${h}`).toBe(true);
      for (const f of feet) expect(f[1] - under(pts, f, 0.1), `foot at ${f}`).toBeLessThan(0.12);
    });
});
