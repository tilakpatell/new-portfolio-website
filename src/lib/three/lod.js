// Levels of detail for a crowd of instanced things (a city's trees): each
// thing drawn at the level its distance from the camera calls for, every
// level one InstancedMesh, so a few draws cover a few hundred things at three
// levels. THREE.LOD is one object per thing, which a few hundred trees can't
// afford; here the scene keeps the things and a matrix of each at each level,
// and re-sorts which level each is drawn at now and then, not every frame.
// (docs/superpowers/specs/2026-10-06-ground-grass-foliage-design.md, 5)
//
//   lodBand(dist, bands, prev, hysteresis) → the band (pure)
//   createLodSet({ items, levels, bands, hysteresis, every, move }) → { update(camera, dt), stats }

import * as THREE from 'three';

// Which band a distance falls in: 0 nearer than bands[0], 1 between it and
// bands[1], and so on. With `prev` (the band it was in) a boundary has a dead
// zone `hysteresis` of its distance wide: a thing goes out past it only a
// little beyond it, and back in only a little short of it, so one sitting on
// a boundary doesn't flick between two levels as the camera breathes.
export function lodBand(dist, bands, prev = -1, hysteresis = 0) {
  let band = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const edge = prev < 0 ? b : prev <= i ? b * (1 + hysteresis / 2) : b * (1 - hysteresis / 2);
    if (dist > edge) band = i + 1;
  }
  return band;
}

// `items` [{ x, y, z }] (where each thing is: its distance is from there),
// `levels` [{ mesh, bands, matrices, colors }]: a level's InstancedMesh (as
// many instances as there are items), the bands it's drawn in, and each
// item's matrix (16 floats an item) and colour (3, optional) at that level.
// A level drawn in two bands (a trunk under both the near and the mid crown)
// says both. Re-sorts every `every` seconds, or at once when the camera has
// moved `move` metres since the last.
export function createLodSet({ items, levels, bands, hysteresis = 0.1, every = 0.5, move = 20 }) {
  const band = new Int8Array(items.length).fill(-1);
  const last = new THREE.Vector3(Infinity, Infinity, Infinity);
  let wait = 0;
  const stats = { bands: new Array(bands.length + 1).fill(0) };
  for (const l of levels) {
    l.mesh.count = 0;
    l.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  const sort = (camera) => {
    const cx = camera.position.x;
    const cz = camera.position.z;
    stats.bands.fill(0);
    for (let i = 0; i < items.length; i++) {
      // (across the ground: a tree's band shouldn't change as the camera rises over it)
      const d = Math.hypot(items[i].x - cx, items[i].z - cz);
      band[i] = lodBand(d, bands, band[i], hysteresis);
      stats.bands[band[i]]++;
    }
    for (const l of levels) {
      const dst = l.mesh.instanceMatrix.array;
      const col = l.colors && l.mesh.instanceColor ? l.mesh.instanceColor.array : null;
      let n = 0;
      for (let i = 0; i < items.length; i++) {
        if (!l.bands.includes(band[i])) continue;
        dst.set(l.matrices.subarray(i * 16, i * 16 + 16), n * 16);
        if (col) col.set(l.colors.subarray(i * 3, i * 3 + 3), n * 3);
        n++;
      }
      l.mesh.count = n;
      l.mesh.instanceMatrix.needsUpdate = true;
      if (col) l.mesh.instanceColor.needsUpdate = true;
      // (the mesh's own bounds no longer say where its instances are)
      l.mesh.boundingSphere = null;
    }
    last.copy(camera.position);
    wait = every;
  };

  return {
    stats,
    update(camera, dt = 0) {
      wait -= dt;
      const moved = Math.hypot(camera.position.x - last.x, camera.position.z - last.z);
      if (wait <= 0 || !(moved < move)) sort(camera);
    },
  };
}
