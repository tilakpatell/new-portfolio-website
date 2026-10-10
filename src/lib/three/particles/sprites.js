// The quad an emitter's particles are drawn as: one mesh a pool, `n`
// instances of a unit quad, every corner placed in the vertex stage from
// the pool's per-instance vec4s (gpu.js's nodes: storage on WebGPU,
// instanced attributes on WebGL 2), so the whole emitter is one draw.
//
// What the record asks, and how it is drawn:
// - alignment: `screen` faces the camera, turned by the rotation curve
//   (degrees over EfNormTime); `motionStretchScreen` lies along the
//   particle's velocity across the screen (the camera's own velocity taken
//   off, so falling snow streaks when the camera pans), its length
//   emitter.js's `stretchLength` (MotionStretchMultiplier and the clamps);
//   `velocity` the same without the camera's; `world` flat on the ground.
// - colour: the sheet's texel times the colour curve, HDR as stored (12.7
//   on Hoth's powder: scaled, never clamped, so it blooms as the game's
//   does); alpha the sheet's alpha to UpdateAlphaLevelScaleData's exponent
//   times its curve, times UpdateTransparencyData's.
// - light (alpha-blended sheets; additive ones glow unlit): the sky's
//   ambient plus the sun's colour times its n·l wrapped by
//   LightWrapAroundFactor (emitter.js's `wrapLight`), n the quad's facing
//   (towards the camera), times the sun's shadow when a shadow node is
//   given (lane S's sunShadowNode once it is on main), so a sprite in a dark
//   corridor is dark.
// - frames: UpdateTextureCoordsData's frame count over the sheet's grid,
//   at FramesPerSecond (from a random start where the record says), or once
//   over the life when it gives no rate.
// - soft against the depth buffer (three's softParticles) where the record
//   gives SoftParticleDistance; the scene's fog node applies to the
//   alpha-blended ones (the corners are in world space, so positionView and
//   positionWorld are the particle's).
//
// The positions are world space: the mesh stays at the origin and is never
// frustum-culled (effects.js culls by the blueprint's CullDistance).
//
// curveNode(tsl, curve, t, r) → a float node, curves.js's evalCurve in TSL
// createShared() → Promise<shared uniforms>: { sunDir, sunColor, ambient, camVel, shadow }
// createSpriteMesh(em, sim, { shared, map }) → Promise<THREE.Mesh>

import { loadThree } from '../light/three.js';

export function curveNode(tsl, c, t, r) {
  const { float } = tsl;
  if (typeof c === 'number') return float(c);
  if (c?.poly) {
    const [x, y, z, w] = c.poly;
    return t.mul(w).add(z).mul(t).add(y).mul(t).add(x).mul(c.scale ?? 1);
  }
  if (c?.random) return float(c.random[0]).add(r.mul(c.random[1] - c.random[0]));
  return float(0);
}

// the uniforms every effect's quads share; effects.js keeps them current
export async function createShared() {
  const { THREE, tsl } = await loadThree();
  return {
    sunDir: tsl.uniform(new THREE.Vector3(0.3, 0.8, 0.5).normalize()),
    sunColor: tsl.uniform(new THREE.Color(1, 1, 1)),
    ambient: tsl.uniform(new THREE.Color(0.35, 0.38, 0.42)),
    camVel: tsl.uniform(new THREE.Vector3()),
    // (a function of the world position to a float node, 1 lit and 0 in shadow)
    shadow: null,
  };
}

let soft = null;
const softParticles = () => (soft ??= import('three/addons/tsl/utils/SoftParticles.js').then((m) => m.softParticles));

// where on the sheet: frame k of a [columns, rows] grid, counted from the top row
function frameUv(tsl, uvNode, frame, [cols, rows]) {
  const { vec2, floor, float } = tsl;
  const col = frame.mod(cols);
  const row = floor(frame.div(cols));
  return vec2(uvNode.x.add(col).div(cols), uvNode.y.add(float(rows - 1).sub(row)).div(rows));
}

export async function createSpriteMesh(em, sim, { shared, map = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const { float, vec3, vec4, clamp, max, min, cos, sin, floor, pow, select, length, normalize, cross, dot, positionGeometry, cameraWorldMatrix, texture, uv, radians } = tsl;
  const { posAge, velLife, extra } = sim.nodes;
  const age = posAge.w;
  const life = velLife.w;
  const t = clamp(age.div(max(life, 1e-3)), 0, 1);
  const r = extra.z;
  const alive = select(age.lessThan(life), float(1), float(0));
  const size = extra.x.mul(curveNode(tsl, em.size ?? 1, t, r)).mul(alive);
  const center = posAge.xyz;
  const right = cameraWorldMatrix.element(0).xyz;
  const up = cameraWorldMatrix.element(1).xyz;
  const back = cameraWorldMatrix.element(2).xyz;
  const c = positionGeometry.xy;

  let corner;
  if (em.alignment === 'motionStretchScreen' || em.alignment === 'velocity') {
    const rel = em.alignment === 'velocity' ? velLife.xyz : velLife.xyz.sub(shared.camVel);
    const across = rel.sub(back.mul(dot(rel, back)));
    const speed = length(across);
    const axis = select(speed.greaterThan(1e-4), across.div(max(speed, 1e-4)), up);
    const side = normalize(cross(axis, back));
    const s = em.stretch ?? { mult: 0, min: 1, max: null };
    let len = size.add(speed.mul(s.mult));
    len = max(len, size.mul(s.min ?? 1));
    if (s.max !== null && s.max !== undefined && Number.isFinite(s.max)) len = min(len, size.mul(s.max));
    corner = center.add(axis.mul(c.y).mul(len)).add(side.mul(c.x).mul(size));
  } else if (em.alignment === 'world') {
    corner = center.add(vec3(c.x, 0, c.y).mul(size));
  } else {
    const a = radians(curveNode(tsl, em.rotation ?? 0, t, r));
    const rx = c.x.mul(cos(a)).sub(c.y.mul(sin(a)));
    const ry = c.x.mul(sin(a)).add(c.y.mul(cos(a)));
    corner = center.add(right.mul(rx).add(up.mul(ry)).mul(size));
  }

  // the sheet's frame
  const grid = em.uv?.grid ?? [1, 1];
  const frames = Math.max(1, Math.min(em.uv?.frames ?? 1, grid[0] * grid[1]));
  let frame = float(0);
  if (frames > 1) {
    const start = em.uv?.randomStart ? floor(r.mul(frames)) : float(0);
    const run = em.uv?.fps > 0 ? floor(age.mul(em.uv.fps)) : em.uv?.randomStart ? float(0) : floor(t.mul(frames - 0.001));
    frame = start.add(run).mod(frames);
  }
  const texel = map ? texture(map, frameUv(tsl, uv(), frame, grid)) : vec4(1);

  const col = (em.color ?? [1, 1, 1]).map((ch) => curveNode(tsl, ch, t, r));
  let rgb = texel.rgb.mul(vec3(col[0], col[1], col[2]));
  if (!em.additive) {
    const w = em.lightWrap ?? 0;
    const sun = max(dot(back, shared.sunDir).add(w).div(1 + w), 0);
    const shade = shared.shadow ? shared.shadow(corner) : float(1);
    rgb = rgb.mul(shared.ambient.add(shared.sunColor.mul(sun).mul(shade)));
  }
  let alpha = pow(max(texel.a, 0), em.alpha?.exponent ?? 1)
    .mul(clamp(curveNode(tsl, em.alpha?.curve ?? 1, t, r), 0, 1))
    .mul(clamp(curveNode(tsl, em.transparency ?? 1, t, r), 0, 1))
    .mul(alive);
  if (em.soft > 0) {
    const fade = await softParticles();
    alpha = fade({ opacity: alpha, distance: em.soft });
  }

  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.positionNode = corner;
  material.colorNode = rgb;
  material.opacityNode = alpha;
  material.blending = em.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  // (fog would add its colour to a glow: the additive ones go without)
  material.fog = !em.additive;
  material.toneMapped = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.count = sim.n;
  mesh.frustumCulled = false;
  mesh.renderOrder = em.additive ? 2 : 1;
  mesh.name = `fx:${String(em.name).split('/').pop()}`;
  return mesh;
}

// A stand-in sheet while the game's are not on the machine: a soft round
// flake in every cell of the grid, white, its alpha falling off from the
// middle (the fixture's and a missing sheet's)
const sheets = new Map();
export async function placeholderSheet([cols, rows] = [1, 1], px = 32) {
  const key = `${cols}x${rows}`;
  if (sheets.has(key)) return sheets.get(key);
  const { THREE } = await loadThree();
  const w = cols * px;
  const h = rows * px;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((x % px) + 0.5) / px - 0.5;
      const dy = ((y % px) + 0.5) / px - 0.5;
      const a = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
      data.set([255, 255, 255, Math.round(a * a * 255)], (y * w + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  sheets.set(key, tex);
  return tex;
}
