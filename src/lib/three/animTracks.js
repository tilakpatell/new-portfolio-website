// The game's curve tracks (`web/animtracks/`: asteroid spins, gadgets,
// doors, cranes, the small creatures' circles), as a level pack's
// tracks.json holds them (scripts/lib/bf2017-level-tracks.mjs): one curve a
// channel, each key [time, value, inX, inY, outX, outY], the tangents as the
// game stores them (a direction in time and value: the slope is y / x).
// (src/lib/three/tracks.js is the wheels' tracks in the snow; this is not.)
//
//   evalTrack(keys, t, { loop }) → value (pure: cubic Hermite between keys;
//     before the first key its value; past the last, held, or wrapped when
//     `loop`)
//   createTracks(list, { nodeOf(track) → Object3D | null, warn })
//     → { update(seconds), dispose() }: each track's channel ('rotation.y'
//     in degrees, 'position.x' in metres, 'scale.z') added to the node's own
//     at rest; a track with no node does nothing and says so once

const slope = (x, y) => (Math.abs(x) > 1e-9 ? y / x : 0);

export function evalTrack(keys, t, { loop = false } = {}) {
  if (!keys?.length) return 0;
  const first = keys[0][0];
  const last = keys[keys.length - 1][0];
  if (keys.length === 1 || last <= first) return keys[0][1];
  let at = t;
  if (loop) at = first + ((((t - first) % (last - first)) + (last - first)) % (last - first));
  if (at <= first) return keys[0][1];
  if (at >= last) return keys[keys.length - 1][1];
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] <= at) i++;
  const [t0, v0, , , ox, oy] = keys[i];
  const [t1, v1, ix, iy] = keys[i + 1];
  const dt = t1 - t0;
  if (dt <= 0) return v1;
  const s = (at - t0) / dt;
  const m0 = slope(ox, oy) * dt;
  const m1 = slope(ix, iy) * dt;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
}

const DEG = Math.PI / 180;

export function createTracks(list, { nodeOf, warn = (m) => console.warn(m) } = {}) {
  const bound = list.map((track) => {
    const node = nodeOf?.(track) ?? null;
    const [part, axis] = String(track.channel).split('.');
    const target = node && ['position', 'rotation', 'scale'].includes(part) && axis ? node[part] : null;
    return { track, node, target, axis, part, rest: target ? target[axis] : 0 };
  });
  const said = new Set();
  return {
    update(seconds) {
      for (const b of bound) {
        if (!b.target) {
          const why = `${b.track.owner ?? 'a track'} (${b.track.channel})`;
          if (!said.has(why) && !said.has(b.track.owner)) {
            said.add(b.track.owner ?? why);
            warn(`animTracks: ${why} has nothing placed to drive`);
          }
          continue;
        }
        const v = evalTrack(b.track.keys, seconds, { loop: b.track.loop });
        b.target[b.axis] = b.part === 'rotation' ? b.rest + v * DEG : b.part === 'scale' ? b.rest * v : b.rest + v;
      }
    },
    dispose() {
      for (const b of bound) if (b.target) b.target[b.axis] = b.rest;
    },
  };
}
