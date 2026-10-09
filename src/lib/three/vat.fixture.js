// A two-bone chain skinning a quad, for vat.test.js: the smallest thing that
// bends. Bone 0 stands at the origin, bone 1 a metre above it; the quad's
// foot is bone 0's alone, its top half bone 1's, its middle shared. Two
// frames: the bind pose, and the chain bent (bone 0 turned 30° about z, bone
// 1 a further 45° about its own joint).
//
//   positions, joints, weights        the quad's six vertices (JOINTS_0, WEIGHTS_0)
//   inverseBinds                      each bone's inverse bind matrix
//   worlds[frame][bone]               each bone's world matrix in that frame
//   frames[frame][bone]               the matrices a bake stores: world × inverse bind
//   mul4(a, b), rotZ(deg), translate(x, y, z)   the column-major maths it is built with
//
// No root and no bind matrix to fold in: both are the identity here.

export function mul4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}

export function rotZ(deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function translate(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

export const positions = new Float32Array([
  -0.25, 0, 0,
  0.25, 0, 0,
  -0.25, 1, 0,
  0.25, 1, 0,
  -0.25, 2, 0,
  0.25, 2, 0,
]);

export const joints = new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

export const weights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

export const inverseBinds = [translate(0, 0, 0), translate(0, -1, 0)];

const bent0 = rotZ(30);
export const worlds = [
  [translate(0, 0, 0), translate(0, 1, 0)],
  [bent0, mul4(bent0, mul4(translate(0, 1, 0), rotZ(45)))],
];

export const frames = worlds.map((bones) => bones.map((w, j) => mul4(w, inverseBinds[j])));
