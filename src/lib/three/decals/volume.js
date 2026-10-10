// Volume decals (the surfaces design, §5, lane Q4): the game's box
// projectors, drawn as the box itself on the node renderer. The box's back
// faces are drawn with no depth test; each fragment reads the depth the
// opaque world left there (viewportDepthTexture), takes that point back to
// the world and into the box's own frame (the unit cube), discards it
// outside, and samples the decal's texture by the box's xz: whatever the
// box holds wears the decal, whatever its geometry (three's
// webgpu_volume_* examples' shape).
//
// The colour and coverage are the decal's look (look.js); the normal is the
// surface's own, from the depth's slopes, so the sun lights the decal as it
// lights what it lies on. (The light's position is still the box face's
// fragment: a placed lamp lights a volume decal from slightly off. The sun
// does not care.) Where the surface turns away from the box's Y (a wall's
// face under a ground decal) the decal fades out between CLIP_MIN and
// CLIP_MAX, rather than smear the texture down it; and it softens over the
// last EDGE of the box toward its sides, so a box reads as a patch, not a
// square.
//
// VOLUME_BACKENDS: the backends whose depth this reads. The node renderer
// on WebGL 2 ('nodes-webgl') is in when the lit fixture's --decals shot
// shows it drawing (Review Focus 3); decalScene.js falls a volume decal to
// a projected one over the box's footprint everywhere else.
//
// volumeMaterial(texture, opacity, { THREE, tsl }, look?) → node material
// volumeMesh(decal, material, box, { THREE }) → Mesh ; volumeOk(backend) → bool

import { decalNodes } from './look.js';

export const VOLUME_BACKENDS = ['webgpu', 'nodes-webgl'];
// the cosine between the surface's normal and the box's Y below which the
// decal is gone (about 75°) and above which it is whole (60°)
export const CLIP_MIN = 0.25;
export const CLIP_MAX = 0.5;
// the share of the box's half-width over which a volume decal fades out at
// its sides (the records carry no falloff)
export const EDGE = 0.15;
// half the unit cube: the box's local extent
const HALF = 0.5;

export const volumeOk = (backend) => VOLUME_BACKENDS.includes(backend);

export function volumeMaterial(map, opacity, { THREE, tsl }, look = { mask: 'a', color: null }) {
  const { Fn, float, vec4, screenUV, viewportDepthTexture, getViewPosition, cameraProjectionMatrixInverse, cameraWorldMatrix, modelWorldMatrixInverse, modelViewMatrix, abs, max, mul, sub, Discard, normalize, cross, dFdx, dFdy, dot, sign, negate, smoothstep } = tsl;
  // the opaque world's point under this pixel, in view space, the world and the box
  const view = getViewPosition(screenUV, viewportDepthTexture(screenUV).x, cameraProjectionMatrixInverse);
  const world = cameraWorldMatrix.mul(vec4(view, float(1))).xyz;
  const local = modelWorldMatrixInverse.mul(vec4(world, float(1))).xyz;
  const inside = Fn(() => {
    const a = abs(local);
    Discard(max(max(a.x, a.y), a.z).greaterThan(float(HALF)));
    return local.xz.add(float(HALF));
  })();
  const nodes = decalNodes(map, look, inside, opacity, tsl);
  // the surface's normal from the depth's slopes, turned to face the camera
  // (screen y runs up on WebGL 2 and down on WebGPU, so the cross's sign
  // differs; the camera is at the view's origin)
  const raw = normalize(cross(dFdx(view), dFdy(view)));
  const n = mul(raw, sign(dot(raw, negate(view))));
  const up = normalize(modelViewMatrix.mul(vec4(float(0), float(1), float(0), float(0))).xyz);
  const m = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide, roughness: 0.8 });
  m.colorNode = nodes.colorNode;
  const side = max(abs(local.x), abs(local.z));
  const edge = sub(float(1), smoothstep(float(HALF * (1 - EDGE)), float(HALF), side));
  m.opacityNode = mul(mul(nodes.opacityNode, smoothstep(float(CLIP_MIN), float(CLIP_MAX), dot(n, up))), edge);
  m.normalNode = n;
  return m;
}

export function volumeMesh(decal, material, box, { THREE }) {
  const mesh = new THREE.Mesh(box, material);
  mesh.position.fromArray(decal.position);
  mesh.quaternion.fromArray(decal.quaternion);
  mesh.scale.fromArray(decal.size);
  mesh.userData.texture = decal.texture;
  return mesh;
}
