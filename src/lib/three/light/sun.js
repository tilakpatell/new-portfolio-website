// The sun: three's SunLight (three/addons/lights/SunLight.js) with its
// cascaded shadow maps fitted to the view, its colour, strength and
// direction from the weather's entry (entry.js), its shadow from the
// record's settings.
//
// Read from the r186 source: SunLightShadow draws exactly two cascades
// (`_cascadeCount = 2`, "must match the cascade count in the sun shadow
// shader chunks"), split by the practical scheme at lambda 0.5 and blended
// over a tenth of each cascade's depth, out to the smaller of
// `shadow.camera.far` and the view's far plane. So the design's four
// cascades on ultra and high (CSM_CASCADES) are two here: `far` is honoured
// through `shadow.camera.far` and the count is clamped to SUN_CASCADES. Four
// would take three/addons/csm/CSMShadowNode on a DirectionalLight instead;
// the hand-off says so.
//
// GodraysNode marches a DirectionalLight's or a PointLight's shadow map
// only (it does not know SunLight's two-cascade atlas), so a chain with god
// rays asks for `rays`: a DirectionalLight that casts and adds no light,
// following the camera, whose one shadow map the rays read.
//
// cascadesFor(tier) → { n, far }             (pure)
// splitsFor(near, far, n, lambda = 0.5) → n + 1 distances  (pure)
// createSun(entry, { tier, rays }) → Promise<{ light, rays, set(params), update(camera), dispose }>

import { readEntry } from './entry.js';
import { loadThree } from './three.js';

export const CSM_CASCADES = 4; // the design's cascades on ultra and high
export const CSM_MAX_FAR = 600; // m: the last cascade's far edge on ultra and high
export const SUN_CASCADES = 2; // what r186's SunLightShadow draws, whatever is asked
const SUN_DISTANCE = 1; // SunLight shines from its position to the origin: only the direction counts
const RAYS_BOX = 80; // m: half the side of the god rays' shadow box round the camera
const RAYS_FAR = 400; // m

const TIERS = {
  ultra: { n: CSM_CASCADES, far: CSM_MAX_FAR, map: 2048 },
  high: { n: CSM_CASCADES, far: CSM_MAX_FAR, map: 2048 },
  mid: { n: 2, far: 300, map: 1024 },
  low: { n: 0, far: 0, map: 0 },
};

export function cascadesFor(tier) {
  const t = TIERS[tier] ?? TIERS.high;
  return { n: t.n, far: t.far };
}

// The practical split: each inner edge the average, weighted by lambda, of
// the logarithmic and the uniform split (SunLightShadow's own at 0.5).
export function splitsFor(near, far, n, lambda = 0.5) {
  if (!(n > 0)) return [near];
  const out = [near];
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const uniform = near + (far - near) * f;
    const log = near > 0 ? near * (far / near) ** f : uniform;
    out.push(lambda * log + (1 - lambda) * uniform);
  }
  out.push(far);
  return out;
}

export async function createSun(entry, { tier = 'high', rays = false } = {}) {
  const { THREE, SunLight } = await loadThree();
  const { n, far } = cascadesFor(tier);
  const params = readEntry(entry);
  const light = new SunLight(new THREE.Color(...params.sun.color), params.sun.intensity);
  light.name = 'sun';
  light.castShadow = n > 0;
  if (light.castShadow) {
    const size = Math.min(TIERS[tier]?.map ?? 2048, params.shadow.mapSize);
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = params.shadow.bias;
    light.shadow.normalBias = params.shadow.normalBias;
    light.shadow.camera.far = Math.min(far, params.shadow.far ?? far);
  }
  let raysLight = null;
  if (rays && light.castShadow) {
    raysLight = new THREE.DirectionalLight(0xffffff, 0);
    raysLight.name = 'sun-rays';
    raysLight.castShadow = true;
    raysLight.shadow.mapSize.set(1024, 1024);
    Object.assign(raysLight.shadow.camera, { left: -RAYS_BOX, right: RAYS_BOX, top: RAYS_BOX, bottom: -RAYS_BOX, near: 1, far: RAYS_FAR });
    raysLight.shadow.camera.updateProjectionMatrix();
  }
  const dir = new THREE.Vector3();
  const set = (p) => {
    dir.set(...p.sun.dir).normalize();
    light.position.copy(dir).multiplyScalar(SUN_DISTANCE);
    light.color.setRGB(...p.sun.color);
    light.intensity = p.sun.intensity;
    light.updateMatrixWorld();
  };
  set(params);
  return {
    light,
    rays: raysLight,
    set,
    // (the cascades fit themselves to the view each frame; only the rays'
    // box has to follow the camera)
    update(camera) {
      if (!raysLight || !camera) return;
      raysLight.target.position.copy(camera.position);
      raysLight.position.copy(camera.position).addScaledVector(dir, RAYS_FAR / 2);
      raysLight.target.updateMatrixWorld();
      raysLight.updateMatrixWorld();
    },
    dispose() {
      light.removeFromParent();
      light.dispose();
      raysLight?.removeFromParent();
      raysLight?.target.removeFromParent();
      raysLight?.dispose();
    },
  };
}
