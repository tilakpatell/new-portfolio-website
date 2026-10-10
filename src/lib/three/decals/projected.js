// Projected decals (the surfaces design, §5, lane Q4): a level cell's
// decals cut out of the static geometry they fall on with three's
// DecalGeometry, then merged, one mesh per texture per cell (Review Focus
// 4: never a mesh per decal).
//
// A decal is a row of decals.json (scripts/lib/bf2017-decals.mjs): a box
// at `position` and `quaternion`, `size` its scale, projecting along its
// local X if projected and its Y if a volume box (AXIS there).
// DecalGeometry projects along its own Z, its image its X by Y, so the
// frame is turned onto it first (decalFrame): a projected box's X, Y, Z
// become the projector's Z, X, Y; a volume box's Y, −Z the projector's Z, Y. A target is
// `{ geometry, matrix }`: a placed mesh's geometry and its instance matrix
// (lane L's packCell draws, or a fixture's wall), so instanced parts need
// no Mesh of their own.
//
// Z-fighting (Review Focus 5): each cut vertex is pushed PUSH along the
// surface's own normal (the record's axis has no sign to trust), and the
// material carries a polygon offset (decalScene.js makes
// it); the decals draw after the opaque world (renderOrder).
//
// groupByTexture(decals) → Map ; decalFrame(decal) → { quaternion, size } ;
// reaches(decal, sphere) → bool (pure)
// loadDecalThree() → { THREE, tsl, DecalGeometry, mergeGeometries }
// buildProjected(decals, targets, { THREE, DecalGeometry, mergeGeometries, materialFor }) →
//   { meshes, drawn, empty }

import { loadThree } from '../light/three.js';

// metres a decal's cut is lifted off the surface it lies on
export const PUSH = 0.002;
// drawn after the opaque world and the sky
export const DECAL_ORDER = 10;
// the box's frame onto the projector's, as [x, y, z, w]: a projected box
// by 120° about (1, 1, 1) (x → y, y → z, z → x), a volume box by −90° about X
const TO_PROJECTOR = { projected: [0.5, 0.5, 0.5, 0.5], volume: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] };

const qmul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];

export function groupByTexture(decals) {
  const out = new Map();
  for (const d of decals) {
    if (!out.has(d.texture)) out.set(d.texture, []);
    out.get(d.texture).push(d);
  }
  return out;
}

// the projector's frame and size: its image the box's Y by Z and its depth
// the X (projected), or its image X by Z and its depth Y (volume)
export function decalFrame(decal) {
  const [sx, sy, sz] = decal.size;
  if (decal.kind === 'volume') return { quaternion: qmul(decal.quaternion, TO_PROJECTOR.volume), size: [sx, sz, sy] };
  return { quaternion: qmul(decal.quaternion, TO_PROJECTOR.projected), size: [sy, sz, sx] };
}

export function reaches(decal, { center, radius }) {
  const d = Math.hypot(decal.position[0] - center[0], decal.position[1] - center[1], decal.position[2] - center[2]);
  return d <= radius + Math.hypot(...decal.size) / 2;
}

let addons = null;
export function loadDecalThree() {
  addons ??= Promise.all([loadThree(), import('three/addons/geometries/DecalGeometry.js'), import('three/addons/utils/BufferGeometryUtils.js')]).then(([t, { DecalGeometry }, { mergeGeometries }]) => ({ ...t, DecalGeometry, mergeGeometries }));
  return addons;
}

// a target's bounding sphere in the world, once
function sphereOf(target) {
  if (target.sphere) return target.sphere;
  if (!target.geometry.boundingSphere) target.geometry.computeBoundingSphere();
  const s = target.geometry.boundingSphere.clone().applyMatrix4(target.matrix);
  target.sphere = { center: s.center.toArray(), radius: s.radius };
  return target.sphere;
}

// one decal's cut over every target it reaches, its UVs onto its atlas
// tile and lifted off the surface; null when it falls on nothing
function cut(decal, targets, { THREE, DecalGeometry, mergeGeometries }, probe) {
  const f = decalFrame(decal);
  const position = new THREE.Vector3(...decal.position);
  const orientation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...f.quaternion));
  const size = new THREE.Vector3(...f.size);
  const parts = [];
  for (const t of targets) {
    if (!reaches(decal, sphereOf(t))) continue;
    probe.geometry = t.geometry;
    probe.matrixWorld.copy(t.matrix);
    const g = new DecalGeometry(probe, position, orientation, size);
    if (g.attributes.position.count) parts.push(g);
    else g.dispose();
  }
  if (!parts.length) return null;
  const g = parts.length === 1 ? parts[0] : mergeGeometries(parts);
  if (parts.length > 1) for (const p of parts) p.dispose();
  if (decal.tile) {
    const [ix, iy, cx, cy] = decal.tile;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (ix + uv.getX(i)) / cx, (iy + uv.getY(i)) / cy);
  }
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * PUSH, p.getY(i) + n.getY(i) * PUSH, p.getZ(i) + n.getZ(i) * PUSH);
  return g;
}

export function buildProjected(decals, targets, three) {
  const { THREE, mergeGeometries, materialFor } = three;
  const probe = new THREE.Mesh();
  probe.matrixAutoUpdate = false;
  const meshes = [];
  let drawn = 0;
  let empty = 0;
  for (const [texture, list] of groupByTexture(decals)) {
    const cuts = [];
    for (const d of list) {
      const g = cut(d, targets, three, probe);
      if (g) cuts.push(g), drawn++;
      else empty++;
    }
    if (!cuts.length) continue;
    const geometry = cuts.length === 1 ? cuts[0] : mergeGeometries(cuts);
    if (cuts.length > 1) for (const c of cuts) c.dispose();
    const mesh = new THREE.Mesh(geometry, materialFor(texture));
    mesh.userData.texture = texture;
    mesh.renderOrder = DECAL_ORDER;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return { meshes, drawn, empty };
}
