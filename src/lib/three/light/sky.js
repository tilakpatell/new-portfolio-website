// The sky as a node material: the record's Rayleigh and Mie scattering
// (entry.js's `sky`) lit by the sun, drawn on a sphere round the camera,
// and rendered once into a cube for the environment where a level has no
// outdoor probe. Every number is a uniform, so a weather crossfade moves
// them without a recompile.
//
// The model is single scattering through a flat atmosphere: the in-scatter
// along the view, (βR·phaseR + βM·phaseM)/(βR + βM) · (1 − e^−(βR·sR + βM·sM)),
// over the optical air mass of the view's zenith angle (Kasten and Young),
// lit by the sun through its own air mass, so a low sun reddens what it
// lights. Normalised to the green channel at the zenith and scaled by the
// record's LuminanceScale (in the site's units), so the record's numbers
// set the sky's brightness and its colour comes from the coefficients;
// the horizon's long path is compressed by a square root (single
// scattering alone puts it at twelve times the zenith; a real sky's
// extinction and second bounce keep it near three). Below the horizon,
// the ground colour; the record's first cloud layer tints the upper sky by
// the entry's cover.
//
// createSky(entry, { radius }) → Promise<{ mesh, uniforms, set(params), update(camera), envTexture(renderer), dispose }>
// skyUniforms(params) → the uniforms' plain values   (pure)

import { readEntry } from './entry.js';
import { loadThree } from './three.js';

export const SUN_DISC = 20; // the disc's brightness over the sky beside it
const ENV_SIZE = 64; // px: a face of the environment's cube

export function skyUniforms(p) {
  return {
    sunDir: p.sun.dir.slice(),
    sunColor: p.sun.color.slice(),
    betaR: p.sky.rayleigh.slice(),
    betaM: p.sky.mie,
    mieG: p.sky.mieG,
    heightR: p.sky.heightR,
    heightM: p.sky.heightM,
    luminance: p.sky.luminance,
    sunSize: p.sky.sunSize,
    cloud: p.sky.cloud.slice(),
    cover: p.sky.cover,
    ground: p.sky.ground.slice(),
  };
}

export async function createSky(entry, { radius = 1000 } = {}) {
  const { THREE, tsl } = await loadThree();
  const { Fn, uniform, vec3, float, positionLocal, normalize, dot, exp, pow, acos, clamp, smoothstep, mix, max, cos } = tsl;
  const v = skyUniforms(readEntry(entry));
  const u = {
    sunDir: uniform(new THREE.Vector3(...v.sunDir)),
    sunColor: uniform(new THREE.Color(...v.sunColor)),
    betaR: uniform(new THREE.Vector3(...v.betaR)),
    betaM: uniform(v.betaM),
    mieG: uniform(v.mieG),
    heightR: uniform(v.heightR),
    heightM: uniform(v.heightM),
    luminance: uniform(v.luminance),
    sunSize: uniform(v.sunSize),
    cloud: uniform(new THREE.Color(...v.cloud)),
    cover: uniform(v.cover),
    ground: uniform(new THREE.Color(...v.ground)),
  };
  // the optical air mass toward a direction's zenith cosine (Kasten–Young)
  const airMass = (c) => {
    const z = acos(clamp(c, 0, 1));
    return float(1).div(cos(z).add(float(0.15).mul(pow(float(93.885).sub(z.mul(180 / Math.PI)).max(0.01), -1.253))));
  };
  const skyColor = Fn(([dir]) => {
    const betaR = u.betaR;
    const betaM = vec3(u.betaM);
    const m = airMass(dir.y);
    const fex = exp(betaR.mul(u.heightR).add(betaM.mul(u.heightM)).mul(m).negate());
    const zen = float(1).sub(exp(betaR.y.mul(u.heightR).add(u.betaM.mul(u.heightM)).negate()));
    const depth = pow(vec3(1).sub(fex).div(zen), 0.5);
    const c = dot(dir, u.sunDir);
    const phaseR = c.mul(c).add(1).mul(0.75);
    const g = u.mieG;
    const phaseM = g.mul(g).oneMinus().div(pow(g.mul(c).mul(-2).add(g.mul(g)).add(1), 1.5));
    const scatter = betaR.mul(phaseR).add(betaM.mul(phaseM)).div(betaR.add(betaM));
    // the sunlight through its own air mass, against a sun at the zenith
    const ms = airMass(max(u.sunDir.y, 0.02));
    const ext = betaR.mul(u.heightR).add(betaM.mul(u.heightM));
    const sunT = exp(ext.mul(ms).negate()).div(exp(ext.negate()));
    const sky = scatter.mul(depth).mul(sunT).mul(u.sunColor).mul(u.luminance);
    const disc = smoothstep(cos(u.sunSize.mul(1.5)), cos(u.sunSize), c).mul(SUN_DISC).mul(u.luminance);
    const lit = sky.add(fex.mul(u.sunColor).mul(disc));
    const clouds = mix(lit, u.cloud.mul(u.luminance).mul(sunT.y.mul(0.5).add(0.3)), u.cover.mul(smoothstep(0, 0.4, dir.y)));
    const below = smoothstep(0.02, -0.08, dir.y);
    return mix(clouds, u.ground.mul(u.luminance).mul(0.25), below);
  });
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  material.colorNode = skyColor(normalize(positionLocal));
  const geometry = new THREE.SphereGeometry(1, 48, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  mesh.scale.setScalar(radius);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  let cube = null;
  const set = (p) => {
    const w = skyUniforms(p);
    u.sunDir.value.set(...w.sunDir).normalize();
    u.sunColor.value.setRGB(...w.sunColor);
    u.betaR.value.set(...w.betaR);
    for (const k of ['betaM', 'mieG', 'heightR', 'heightM', 'luminance', 'sunSize', 'cover']) u[k].value = w[k];
    u.cloud.value.setRGB(...w.cloud);
    u.ground.value.setRGB(...w.ground);
  };
  return {
    mesh,
    material,
    uniforms: u,
    set,
    // the sphere stays round the camera, inside its far plane
    update(camera) {
      if (!camera) return;
      mesh.position.copy(camera.position);
      mesh.scale.setScalar(Math.min(radius, camera.far * 0.9));
    },
    // the sky drawn into a cube for scene.environment (PMREMNode filters
    // it); the same texture again after a weather change, re-filtered
    envTexture(renderer) {
      if (!cube) {
        const target = new THREE.CubeRenderTarget(ENV_SIZE, { type: THREE.HalfFloatType });
        const camera = new THREE.CubeCamera(0.1, 10, target);
        const scene = new THREE.Scene();
        const copy = new THREE.Mesh(geometry, material);
        copy.scale.setScalar(5);
        scene.add(copy, camera);
        cube = { target, camera, scene };
      }
      cube.camera.update(renderer, cube.scene);
      cube.target.texture.needsPMREMUpdate = true;
      return cube.target.texture;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      cube?.target.dispose();
    },
  };
}
