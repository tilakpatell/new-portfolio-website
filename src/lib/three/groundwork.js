// A world put on baked floor light in one call: Bruno Simon's grounding (his
// folio-2019, bruno-simon.com; docs/research/2026-10-06-bruno-simon-folio.md),
// for any world built in code.
//
// Bruno's folio looks rich for almost nothing because its light lives in
// textures: a soft shadow mask under each area, a warm bounce on the
// underside of everything, a blob under whatever moves, and no shadow pass
// at all. This does the same for a world here, with the masks rendered by
// the world's own scene on the GPU when it's built (lib/three/grounding-bake's
// bakeFloorTexture) instead of in Blender:
//
//   - the shadow pass goes (every cast and received shadow off): a whole
//     render of the world a frame, and 9–18 pixels a metre of hard grey edge
//   - the floor reads the mask: the sun cut where the static world shades it
//     (soft-edged, a penumbra), the sky cut in corners and at wall feet, and
//     what's left in the dark warmed toward the world's shade (floorShadow)
//   - every lit thing's lower, downward faces take the floor's colour, by how
//     near the floor they are, wherever the floor is (bounce, from the mask's
//     baked height)
//   - what moves dims where it stands in the floor's shade (standIn) and
//     stands on a soft blob slid away from the sun (createBlobShadows)
//   - optionally, far and scattered things are painted with matcaps made
//     from the world's own light (lib/three/matcap)
//
// groundWorld({ renderer, scene, floor, area, sun, casters, skip, movers,
//   shade, bounce, height, tier, matcap, lights })
//   → { bake(), rebake(sun), update(), track(object, size, opts),
//       untrack(object), blobs, mask, stats, dispose() }
//
// `floor` the meshes that are the floor; `area` { x0, z0, w, d } the part of
// it to bake (the play space); `sun` a DirectionalLight or a direction to the
// sun; `casters` what shadows the floor (the whole scene by default; movers,
// skipped things, see-through and tiny things are left out of the bake);
// `movers` [{ object, size: [w, d], lift }] what gets a blob and stands in
// the shade; `height(x, z)` the floor's height, for the blobs; `tier` the
// device's (lib/device), for the bake's cost.

import * as THREE from 'three';
import { BAKE_TIERS, bakeFloorTexture } from './grounding-bake';
import { bounce as bounceOn, createBlobShadows, floorShadow, setFloorMask, setFloorTime, standIn } from './grounding';
import { matcapFor } from './matcap';

const LIT = (m) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshMatcapMaterial);
const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);

// the floor's world box: where a default area and the height's range come from
function floorBox(floor) {
  const box = new THREE.Box3();
  for (const root of floor) box.expandByObject(root);
  return box;
}

// the direction to the sun, from a light (where it is, to where it points)
// or as given
function sunDirection(sun, out = new THREE.Vector3()) {
  if (sun?.isDirectionalLight) {
    const a = sun.getWorldPosition(new THREE.Vector3());
    const b = sun.target.getWorldPosition(new THREE.Vector3());
    out.subVectors(a, b);
  } else if (sun?.isVector3) out.copy(sun);
  else out.set(0.4, 0.8, 0.3);
  if (out.lengthSq() < 1e-9) out.set(0, 1, 0);
  return out.normalize();
}

// every mesh under `roots`, but none under `but`
function meshesUnder(roots, but) {
  const out = [];
  const visit = (o) => {
    if (but.has(o)) return;
    if (o.isMesh) out.push(o);
    for (const c of o.children) visit(c);
  };
  for (const r of roots) visit(r);
  return out;
}

// One blank picture stands in for the mask until the bake lands: the sun
// everywhere, the sky everywhere, and no height (the bounce falls back to
// its one height).
function blankMask() {
  const t = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

export function groundWorld({ renderer, scene, floor = [], area = null, sun = null, casters = null, skip = [], movers = [], shade = 0x3a2c22, bounce = {}, height = () => 0, tier = 'mid', matcap = [], lights = null, blobOpacity = 0.75 } = {}) {
  const box = floorBox(floor);
  if (!area) {
    // the floor's own extent, at most 240 m a side about its middle
    const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const s = box.isEmpty() ? new THREE.Vector3(100, 0, 100) : box.getSize(new THREE.Vector3());
    const w = Math.min(240, s.x || 100);
    const d = Math.min(240, s.z || 100);
    area = { x0: c.x - w / 2, z0: c.z - d / 2, w, d };
  }
  const range = box.isEmpty() ? [-1, 1] : [box.min.y - 0.5, box.max.y + 0.5];
  const roots = casters ?? [scene];
  const hemi = (() => {
    let h = null;
    scene.traverse((o) => (!h && o.isHemisphereLight ? (h = o) : null));
    return h;
  })();
  const sunLight = sun?.isDirectionalLight ? sun : null;

  // ── the shadow pass goes ──
  const hadShadows = renderer.shadowMap?.enabled;
  if (renderer.shadowMap) renderer.shadowMap.enabled = false;
  scene.traverse((o) => {
    if (o.isLight && o.castShadow) o.castShadow = false;
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (hadShadows) for (const m of materialsOf(o)) m.needsUpdate = true;
    }
  });

  // ── the mask, blank until the bake lands ──
  const blank = blankMask();
  const mask = { areas: [{ texture: blank, ...area }], times: [{ tod: 0.5, channel: 0 }], shade: new THREE.Color(shade), range };
  setFloorTime(mask, 0.5, 1);

  const floorMeshes = new Set();
  for (const r of floor) r.traverse((o) => o.isMesh && floorMeshes.add(o));
  const moverRoots = new Set(movers.map((m) => m.object).filter(Boolean));
  const skipRoots = new Set(skip.filter(Boolean));

  // ── matcaps, where asked for (before the bounce, which goes on them too) ──
  if (matcap.length) {
    const rig = lights ?? { sun: sunLight, hemi };
    const swapped = new Map();
    for (const o of meshesUnder(matcap, new Set([...floorMeshes, ...moverRoots]))) {
      if (floorMeshes.has(o)) continue;
      const mats = materialsOf(o).map((m) => {
        if (!swapped.has(m)) swapped.set(m, matcapFor(m, renderer, rig));
        return swapped.get(m);
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
    }
  }

  // ── the floor, the statics, the movers ──
  for (const o of floorMeshes) for (const m of materialsOf(o)) floorShadow(m, mask);
  const bounceColor = bounce === false ? null : bounce.color?.isColor ? bounce.color : new THREE.Color(bounce.color ?? hemi?.groundColor ?? 0x8a6a4a);
  const bounced = [];
  const bounceMat = (m) => {
    if (!bounceColor || !LIT(m) || m.userData?.bounce) return;
    bounceOn(m, { color: bounceColor, strength: bounce.strength, height: bounce.height, mask });
    bounced.push(m.userData.bounce);
  };
  const staticMats = new Set();
  const notStatic = new Set([...floorMeshes, ...moverRoots, ...skipRoots]);
  for (const o of meshesUnder(roots, notStatic)) for (const m of materialsOf(o)) staticMats.add(m);
  for (const m of staticMats) bounceMat(m);
  for (const o of meshesUnder([...moverRoots], new Set())) {
    for (const m of materialsOf(o)) {
      bounceMat(m);
      // (a material a static shares would read its own footprint: left lit)
      if (LIT(m) && !staticMats.has(m)) standIn(m, mask);
    }
  }

  // ── blobs under what moves ──
  const blobs = createBlobShadows({ color: mask.shade, max: Math.max(16, movers.length + 16), ground: height, opacity: blobOpacity });
  scene.add(blobs.mesh);
  const tracked = movers.filter((m) => m.object).map((m) => ({ object: m.object, size: m.size ?? [1, 1], lift: m.lift ?? 0 }));
  const sunDir = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const shown = (o) => {
    for (let x = o; x; x = x.parent) if (!x.visible) return false;
    return true;
  };

  let disposed = false;
  let job = null;
  let landed = null;
  let abort = null;
  const stats = { ms: 0, passes: 0, baked: false };

  const land = (result) => {
    if (disposed) {
      result.dispose();
      return false;
    }
    const old = landed;
    landed = result;
    setFloorMask(mask, 0, result.texture);
    for (const u of bounced) {
      if (u.uBounceMask) u.uBounceMask.value = result.texture;
      u.uBounceRange?.value.set(result.range[0], result.range[1]);
    }
    old?.dispose();
    Object.assign(stats, { ms: result.ms, passes: result.passes, baked: true });
    return true;
  };

  const bake = () => {
    if (job) return job;
    if (disposed) return Promise.resolve(false);
    abort = { aborted: false };
    const preset = BAKE_TIERS[tier] ?? BAKE_TIERS.mid;
    job = bakeFloorTexture(renderer, scene, {
      area,
      floor,
      casters: roots,
      skip: [...skipRoots, ...moverRoots, blobs.mesh],
      sun: sunDirection(sun, new THREE.Vector3()),
      size: preset.size,
      sunSamples: preset.sun,
      skySamples: preset.sky,
      shadowSize: preset.shadow,
      range,
      signal: abort,
    })
      .then((result) => (result ? land(result) : false))
      .catch(() => false)
      .finally(() => {
        job = null;
      });
    return job;
  };

  return {
    mask,
    blobs,
    stats,
    bake,
    // the sun moved (a mood, a time of day): bake again for where it is now
    rebake(next) {
      if (next) sun = next;
      if (abort) abort.aborted = true;
      const pending = job;
      return (pending ?? Promise.resolve()).then(() => bake());
    },
    track(object, size = [1, 1], { lift = 0 } = {}) {
      if (object && !tracked.some((t) => t.object === object)) tracked.push({ object, size, lift });
    },
    untrack(object) {
      const i = tracked.findIndex((t) => t.object === object);
      if (i >= 0) tracked.splice(i, 1);
    },
    // once a frame: each blob under its mover, slid away from the sun by how
    // high the mover is over the floor
    update() {
      blobs.setSun(sunDirection(sun, sunDir), sunDir.y > 0.05 ? 1 : 0.5);
      blobs.clear();
      let i = 0;
      for (const t of tracked) {
        if (!shown(t.object)) continue;
        t.object.getWorldPosition(p);
        t.object.getWorldQuaternion(q);
        e.setFromQuaternion(q, 'YXZ');
        const h = Math.max(0, p.y - height(p.x, p.z) - t.lift);
        blobs.set(i++, p, h, 0, t.size, e.y);
      }
    },
    dispose() {
      disposed = true;
      if (abort) abort.aborted = true;
      blobs.mesh.removeFromParent();
      blobs.dispose();
      landed?.dispose();
      landed = null;
      blank.dispose();
    },
  };
}
