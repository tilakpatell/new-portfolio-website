// A 64 m cell's ground as a Rapier heightfield: the same heights it is
// drawn from (src/lib/land/cell.js), so the wheels' rays meet what you see.
//
// Ours are row-major (heights[iz × n + ix], +x along a row); Rapier's are
// a column-major matrix whose rows run along z, so the array is transposed
// on the way in. The body stands at the cell's middle (Rapier centres a
// heightfield on its body). heightfield.test.js shoots 200 rays to prove it.
// A floor: it meets everything but the car's bumper. No three.js, no DOM.
//
//   addHeightfield(physics, { heights, n = 65, size = 64, x, z, friction =
//     0.2, restitution = 0.15 }) → Body (remove it with physics.remove)

export function addHeightfield(physics, { heights, n = 65, size = 64, x = 0, z = 0, friction = 0.2, restitution = 0.15 }) {
  const cols = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) cols[ix * n + iz] = heights[iz * n + ix];
  return physics.add({
    type: 'fixed',
    position: [x + size / 2, 0, z + size / 2],
    group: 'floor',
    friction,
    restitution,
    colliders: [{ shape: 'heightfield', args: [n - 1, n - 1, cols, [size, 1, size]] }],
  });
}
