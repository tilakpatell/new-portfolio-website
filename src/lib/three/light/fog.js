// The fog as a node: the record's curve over distance and its height fog
// (entry.js's `fog`), set as `scene.fogNode`. The curve and the height fog
// switch on and off by uniforms, so a weather without either is the same
// shader and a crossfade compiles nothing.
//
// Distance fog: with a record, its cubic, x t³ + y t² + z t + w over
// t = (d − Start) / (End − Start), clamped to 0…1 (Hoth's day rises to 0.58
// by the far end; its sunset to 0.81); with lane G's derived shape only,
// 1 − e^(−density · d). Height fog: full below HeightFogAltitude, gone
// HeightFogDepth above it, and through it 95% opaque at
// HeightFogVisibilityRange (1 − e^(−3d / range)). The two together: the
// thicker. d is the view depth, as three's own fog takes it.
//
// fogAt(fog, d, y) → 0…1    (pure: the same sum, for the tests and a CPU
//   reading such as a HUD's visibility)
// createFog(entry, { origin }) → Promise<{ node, uniforms, set(params) }>

import { readEntry } from './entry.js';
import { loadThree } from './three.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function fogAt(fog, d, y = 0) {
  let f;
  if (fog.curve) {
    const t = clamp01((d - fog.start) / Math.max(1e-3, fog.end - fog.start));
    const [a, b, c, w] = fog.curve;
    f = clamp01(((a * t + b) * t + c) * t + w);
  } else f = 1 - Math.exp(-fog.density * d);
  if (fog.height) {
    const h = clamp01((fog.height.altitude + fog.height.depth - y) / fog.height.depth);
    f = Math.max(f, h * (1 - Math.exp((-3 * d) / fog.height.visibility)));
  }
  return f;
}

const values = (fog) => ({
  color: fog.color.slice(),
  useCurve: fog.curve ? 1 : 0,
  curve: fog.curve ? fog.curve.slice() : [0, 0, 0, 0],
  start: fog.start,
  end: fog.end,
  density: fog.density,
  useHeight: fog.height ? 1 : 0,
  altitude: fog.height?.altitude ?? 0,
  depth: fog.height?.depth ?? 1,
  visibility: fog.height?.visibility ?? 1,
});

export async function createFog(entry, { origin } = {}) {
  const { THREE, tsl } = await loadThree();
  const { uniform, float, clamp, exp, max, mix, positionView, positionWorld, fog } = tsl;
  const v = values(readEntry(entry, { origin }).fog);
  const u = {
    color: uniform(new THREE.Color(...v.color)),
    useCurve: uniform(v.useCurve),
    curve: uniform(new THREE.Vector4(...v.curve)),
    start: uniform(v.start),
    end: uniform(v.end),
    density: uniform(v.density),
    useHeight: uniform(v.useHeight),
    altitude: uniform(v.altitude),
    depth: uniform(v.depth),
    visibility: uniform(v.visibility),
  };
  const d = positionView.z.negate();
  const t = clamp(d.sub(u.start).div(max(u.end.sub(u.start), 1e-3)), 0, 1);
  const cubic = clamp(u.curve.x.mul(t).add(u.curve.y).mul(t).add(u.curve.z).mul(t).add(u.curve.w), 0, 1);
  const expo = float(1).sub(exp(u.density.mul(d).negate()));
  const distance = mix(expo, cubic, u.useCurve);
  const h = clamp(u.altitude.add(u.depth).sub(positionWorld.y).div(u.depth), 0, 1);
  const height = h.mul(float(1).sub(exp(d.mul(-3).div(u.visibility)))).mul(u.useHeight);
  const node = fog(u.color, max(distance, height));
  return {
    node,
    uniforms: u,
    set(p) {
      const w = values(p.fog);
      u.color.value.setRGB(...w.color);
      u.curve.value.set(...w.curve);
      for (const k of ['useCurve', 'start', 'end', 'density', 'useHeight', 'altitude', 'depth', 'visibility']) u[k].value = w[k];
    },
  };
}
