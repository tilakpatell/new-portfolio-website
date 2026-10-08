// 3D value noise for shaders, with analytic derivatives: sampled on a
// sphere's own unit surface it has no seams and no pinching at the poles.
// The galaxy's planets (galaxy/bodyShaders.js) are drawn with it; here so
// the universe map's can be too.

export const NOISE = /* glsl */ `
uniform vec3 uSeed; // whole numbers: each world reads its own stretch of the noise
// hashes of lattice points (Dave Hoskins' "hash without sine": IQ's
// fract(x * y * z) one goes to nothing along whole planes of points, and
// those show as streaks)
float hash13(vec3 p) {
  p = fract((p + uSeed) * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract((p + uSeed) * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// value noise in -1..1 and its gradient (xyz of .yzw)
vec4 noised(vec3 x) {
  vec3 i = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
  float a = hash13(i);
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float f = hash13(i + vec3(1.0, 0.0, 1.0));
  float g = hash13(i + vec3(0.0, 1.0, 1.0));
  float h = hash13(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + g;
  float k6 = a - b - e + f;
  float k7 = -a + b + c - d + e - f - g + h;
  return vec4(-1.0 + 2.0 * (a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z),
              2.0 * du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
// value noise alone (cheaper: clouds, colour variation), -1..1
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// each octave turned (so the lattice never lines up) and doubled
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
const mat3 M3T = mat3(0.00, -0.80, -0.60, 0.80, 0.36, -0.48, 0.60, -0.48, 0.64);
// fbm with its gradient; n octaves, the last one faded in by its fraction
// (at most FBM_OCT: ten, unless a shader asks for more, the galaxy's worlds at ultra)
#ifndef FBM_OCT
#define FBM_OCT 10
#endif
vec4 fbmd(vec3 p, float n, float gain) {
  float a = 0.5;
  float v = 0.0;
  vec3 g = vec3(0.0);
  mat3 J = mat3(1.0);
  for (int i = 0; i < FBM_OCT; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float w = a * clamp(n - fi, 0.0, 1.0);
    vec4 k = noised(p);
    v += w * k.x;
    g += w * (J * k.yzw);
    p = M3 * p * 2.03;
    J = J * M3T * 2.03;
    a *= gain;
  }
  return vec4(v, g);
}
// two octaves of value noise turned against each other (one alone shows its
// lattice, squared off, wherever it's cut into lines or coasts)
vec4 noised2(vec3 p) {
  vec4 a = noised(p);
  vec4 b = noised(M3 * p * 1.7 + 7.3);
  return vec4(0.8 * a.x + 0.55 * b.x, 0.8 * a.yzw + 0.55 * 1.7 * (M3T * b.yzw));
}
float fbm(vec3 p, float n) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    if (fi >= n) break;
    v += a * clamp(n - fi, 0.0, 1.0) * noise(p);
    p = M3 * p * 2.03;
    a *= 0.5;
  }
  return v;
}
`;
