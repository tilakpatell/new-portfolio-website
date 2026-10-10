// A level's curve tracks (lane E0; lane Q reads the same for its space
// levels): the bucket's `web/animtracks/<owner>/animtrackdata/<id>_<name>.json`
// ({ name, keys: [[time, value, inX, inY, outX, outY], …] }) to the pack's
// tracks.json, kept only where the pack places the owner (the model whose
// folder the track sits under). src/lib/three/animTracks.js evaluates them.
// Pure.
//
//   tracksJson(animtracks, pack) → { tracks: [{ owner, mesh, name, channel,
//     loop, keys }], unplaced: [owner] }
//   ownerOf(name) → the owner's folder; channelsOf(name, keys) → [{ channel, keys }]

export const ownerOf = (name) => String(name).split('/animtrackdata/')[0];

// The keys are the track's curves one after another; a curve starts again
// where time does. Six are a transform (position x, y, z, rotation x, y, z
// in degrees, as Naboo's lift and the asteroids show: a 45° tilt, a 0 to 360
// turn); one named for turning is a turn about y.
const SIX = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z'];
export function channelsOf(name, keys) {
  const curves = [];
  for (const k of keys) {
    const cur = curves[curves.length - 1];
    if (!cur || k[0] <= cur[cur.length - 1][0]) curves.push([k]);
    else cur.push(k);
  }
  const tail = String(name).split('/').pop();
  const names = curves.length === 6 ? SIX : curves.length === 1 && /rotat|spin/i.test(tail) ? ['rotation.y'] : curves.map((_, i) => `value.${i}`);
  return curves.map((c, i) => ({ channel: names[i], keys: c }));
}

// (what turns or circles for ever; a gate, a hatch, a push or a lift plays once)
const LOOPS = /rotat|spin|asteroid|flying|engine|driving|_animation/i;

export function tracksJson(animtracks, pack) {
  const meshes = pack.meshes ?? pack.json?.meshes ?? [];
  const byOwner = new Map();
  meshes.forEach((m, i) => {
    const folder = String(m.name).replace(/^models\//, '').split('/').slice(0, -1).join('/');
    if (!byOwner.has(folder)) byOwner.set(folder, i);
  });
  const tracks = [];
  const unplaced = new Set();
  for (const t of animtracks) {
    const owner = ownerOf(t.name);
    const mesh = byOwner.get(owner);
    if (mesh === undefined) {
      unplaced.add(owner);
      continue;
    }
    const name = String(t.name).split('/').pop();
    for (const c of channelsOf(t.name, t.keys ?? [])) tracks.push({ owner, mesh, name, channel: c.channel, loop: LOOPS.test(name), keys: c.keys });
  }
  return { tracks, unplaced: [...unplaced].sort() };
}
