// The planets' shaders (bodies.js builds the meshes and feeds them). One
// surface shader, specialised per family of looks with #defines (desert,
// ice, lush, city, lava, storm, gas, moon) so no world pays for another's
// features: 3D value noise with analytic derivatives sampled on the
// object-space unit sphere (no seams, no pinching at the poles), FBM whose
// octave count follows each pixel's footprint (a few octaves for a disc in
// the sky, up to uMaxOct skimming the surface), relief by tilting the normal
// with the noise's gradient (the sphere itself stays smooth: it's what the
// ship collides with), clouds in the same pass, lit by one or two suns,
// with the atmosphere's haze between the eye and the ground. Then the
// atmosphere's own shell (the glow round the limb, the sky when you're
// down in it) and Scarif's shield.
//
// Everything's in linear light: lit ground tops out ~1.0–1.4, the things
// that glow (lava, city lights, Starkiller's trench) go well past the
// bloom's 1.7.

// ── Noise ──
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
vec4 fbmd(vec3 p, float n, float gain) {
  float a = 0.5;
  float v = 0.0;
  vec3 g = vec3(0.0);
  mat3 J = mat3(1.0);
  for (int i = 0; i < 10; i++) {
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

// ── The surface: vertex shader ──
export const SURFACE_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// what every surface shader declares, and the helpers they share
export const SURFACE_HEAD = /* glsl */ `
uniform float uTime;
uniform float uR;
uniform float uPix;
uniform float uMaxOct;
uniform float uBump;
uniform vec3 uCenter;
uniform mat3 uRot;
uniform vec3 uSunDir[2];
uniform vec3 uSunCol[2];
uniform vec3 uPal[8];
uniform vec4 uP0;
uniform vec4 uP1;
uniform vec3 uAtmo;
uniform vec4 uAtmoP;
uniform vec3 uSunset;
uniform vec4 uCloud;
uniform vec3 uCloudCol;
uniform float uCharge;
uniform float uFlash;
varying vec3 vObj;
varying vec3 vWorld;

float gFoot;  // how much of the unit sphere one pixel covers, here
float gNight; // 0 in sunlight .. 1 on the night side
vec3 gSunObj; // the main sun's direction in the planet's own frame
float gCloudThick; // how thick the cloud is, here (thicker: brighter tops)

// octaves of an fbm starting at frequency f this pixel can show
float octs(float f) { return clamp(log2(0.45 / (gFoot * f)), 1.0, uMaxOct); }
// 1 while a pattern of frequency f is resolved here, fading to 0 before it'd alias
float fade(float f) { return 1.0 - smoothstep(0.1, 0.45, gFoot * f); }

struct Surf {
  vec3 alb;    // albedo
  vec3 grad;   // height gradient on the unit sphere (tilts the normal)
  float wet;   // 0..1: water (a sun glint)
  vec3 emit;   // light of its own
  float cloud; // 0..1 cloud cover over it
  float shade; // cloud shadow on the ground (0 none)
};

// the slope of smoothstep(a, b, x) at x
float dss(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return 6.0 * t * (1.0 - t) / (b - a);
}
// the planet's frame turned about its own axis by angle a
vec3 spinY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
// a whirl: p turned about the axis c by up to k radians, the most at its eye (radius w)
vec3 whirl(vec3 p, vec3 c, float w, float k) {
  float d = 1.0 - dot(p, c);
  float a = k * exp(-d / w);
  vec3 par = c * dot(p, c);
  vec3 x = p - par;
  return par + x * cos(a) + cross(c, x) * sin(a);
}
// craters: the 8 cells round p, a crater in some of them; height and gradient
vec4 craters(vec3 p, float density, float depth) {
  vec3 base = floor(p - 0.5);
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    vec3 cell = base + vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    vec3 h = hash33(cell);
    if (h.x > density) continue;
    vec3 c = cell + 0.5 + (h - 0.5) * 0.4;
    float rr = 0.12 + 0.22 * h.y * h.y;
    vec3 dv = p - c;
    float dl = length(dv) + 1e-5;
    float d = dl / rr;
    if (d > 1.8) continue;
    float bowl = d < 1.0 ? d * d - 1.0 : 0.0;
    float dbowl = d < 1.0 ? 2.0 * d : 0.0;
    float rim = 0.35 * exp(-(d - 1.0) * (d - 1.0) * 14.0);
    float drim = -28.0 * (d - 1.0) * rim;
    float fall = 1.0 - smoothstep(1.4, 1.8, d);
    float dep = depth * (0.6 + 0.6 * h.z);
    acc.x += (bowl + rim) * dep * fall;
    acc.yzw += (dbowl + drim) * dep * fall * dv / (dl * rr);
  }
  return acc;
}
`;

// clouds, drawn inside the surface shader: drifting, wind-stretched,
// warped; uCloud = (cover, sharpness, drift, scale)
export const CLOUDS = /* glsl */ `
float cloudAt(vec3 P, float n) {
  vec3 q = spinY(P, uTime * uCloud.z);
  #ifdef STORMS
  // Kamino: cyclones, their arms wound round them
  q = whirl(q, normalize(vec3(0.6, 0.45, 0.66)), 0.06, 3.2);
  q = whirl(q, normalize(vec3(-0.7, -0.35, 0.6)), 0.05, -2.8);
  q = whirl(q, normalize(vec3(-0.2, 0.55, -0.8)), 0.045, 3.0);
  q = whirl(q, normalize(vec3(0.5, -0.6, -0.6)), 0.04, -2.6);
  #endif
  q *= uCloud.w;
  q.y *= 1.8;
  vec3 w = vec3(noise(q * 0.7 + 3.1), noise(q * 0.7 + 7.7), noise(q * 0.7 + 1.3));
  float big = noise(q * 0.3 + 5.0);
  float v = fbm(q * 1.3 + w * 1.2 + vec3(0.0, uTime * uCloud.z * 0.3, 0.0), n) + big * 0.3;
  float th = mix(0.42, -0.42, uCloud.x);
  gCloudThick = smoothstep(th, th + 1.2 / uCloud.y, v);
  return smoothstep(th - 0.05, th + 0.4 / uCloud.y, v) * 0.95;
}
`;

// the atmosphere between the eye and a point: light scattered toward the eye
// and how much of what's behind gets through. Planet-centred, in radii.
// uAtmoP = (shell radius, falloff, density, forward glow)
export const ATMO = /* glsl */ `
vec3 inscatter(vec3 ro, vec3 rd, float tMax, out float trans) {
  trans = 1.0;
  float Ra = uAtmoP.x;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - Ra * Ra;
  float disc = b * b - c;
  if (disc <= 0.0) return vec3(0.0);
  float sq = sqrt(disc);
  float t0 = max(0.0, -b - sq);
  float t1 = min(tMax, -b + sq);
  if (t1 <= t0) return vec3(0.0);
  float dt = (t1 - t0) / 7.0;
  vec3 sum = vec3(0.0);
  float od = 0.0;
  float glow0 = pow(max(dot(rd, uSunDir[0]), 0.0), 12.0) * uAtmoP.w;
  float glow1 = pow(max(dot(rd, uSunDir[1]), 0.0), 12.0) * uAtmoP.w;
  for (int i = 0; i < 7; i++) {
    vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
    float l = length(p);
    float h = max(l - 1.0, 0.0) / (Ra - 1.0);
    float dens = exp(-h * uAtmoP.y) * (1.0 - smoothstep(0.85, 1.0, h));
    vec3 n = p / l;
    float m0 = dot(n, uSunDir[0]);
    float m1 = dot(n, uSunDir[1]);
    vec3 l0 = uSunCol[0] * smoothstep(-0.14, 0.12, m0) * mix(uSunset, vec3(1.0), smoothstep(-0.06, 0.25, m0)) * (1.0 + glow0);
    vec3 l1 = uSunCol[1] * smoothstep(-0.14, 0.12, m1) * mix(uSunset, vec3(1.0), smoothstep(-0.06, 0.25, m1)) * (1.0 + glow1);
    sum += dens * (l0 + l1);
    od += dens;
  }
  float k = dt * uAtmoP.z;
  trans = exp(-od * k * 0.9);
  return sum * k * uAtmo;
}
`;

// ── The families: each a surface(P, s) filling in albedo, relief, water,
// light of its own, clouds. P is the point on the unit sphere in the
// planet's own frame; every gradient is with respect to P, in radii. ──

// Deserts (Tatooine, Jakku, Geonosis): sand seas of sharp-crested dunes
// bent by the land, rock country terraced into mesas and cut by canyons,
// salt pans in the low ground, craters, crash scars.
// pal: sand, sand2, rock, dark, salt, crest
// uP0 = (dunes, rock threshold, craters, salt), uP1 = (scars, dune frequency, canyons, mesas)
const DESERT = /* glsl */ `
uniform vec3 uDir;
void surface(vec3 P, inout Surf s) {
  float o = octs(2.2);
  vec4 b = fbmd(P * 2.2, o, 0.47);
  vec4 reg = fbmd(P * 1.3 + 5.3, min(o, 4.0), 0.5);
  float rocky = smoothstep(-0.07, 0.07, reg.x + b.x * 0.3 - uP0.y);
  float sand = 1.0 - rocky;
  // mesas: the rock country in flat-topped steps with cliffs between
  float x = b.x * 3.2 + 3.0;
  float st = clamp((fract(x) - 0.55) / 0.3, 0.0, 1.0);
  float terr = (floor(x) + st * st * (3.0 - 2.0 * st)) / 3.2 - 1.0;
  float dst = 6.0 * st * (1.0 - st) / 0.3;
  float hr = mix(b.x, terr, uP1.w);
  vec3 gr = b.yzw * 2.2 * mix(1.0, dst, uP1.w);
  // gullies and canyons cut through it (Beggar's Canyon), two sizes of crease
  vec4 n1 = noised(P * 9.0 + vec3(b.x * 0.5) + 9.1);
  vec4 n2 = noised(P * 31.0 + vec3(b.x) + 2.7);
  float k1 = max(0.08, gFoot * 9.0 * 2.5);
  float k2 = max(0.08, gFoot * 31.0 * 2.5);
  float r1 = 1.0 - abs(n1.x);
  float r2 = 1.0 - abs(n2.x);
  float a1 = min(1.0, 0.08 / k1);
  float a2 = min(1.0, 0.08 / k2) * 0.35 * fade(31.0 * 2.0);
  float can1 = smoothstep(1.0 - k1, 1.0 - k1 * 0.25, r1) * a1;
  float can2 = smoothstep(1.0 - k2, 1.0 - k2 * 0.25, r2) * a2;
  float cm = uP1.z * smoothstep(0.3, 0.8, rocky);
  float can = max(can1, can2) * cm;
  vec3 gcan = cm * (dss(1.0 - k1, 1.0 - k1 * 0.25, r1) * a1 * -sign(n1.x) * n1.yzw * 9.0 + dss(1.0 - k2, 1.0 - k2 * 0.25, r2) * a2 * -sign(n2.x) * n2.yzw * 31.0);
  // salt pans in the lowest sand
  float salt = uP0.w * smoothstep(-0.3, -0.42, b.x + reg.x * 0.2) * sand;
  float h = mix(b.x * 0.35, hr, rocky) - can * 0.5;
  vec3 g = (mix(b.yzw * 2.2 * 0.35, gr, rocky) - gcan * 0.12) * (1.0 - salt * 0.9);
  vec3 G = g * uBump;
  // dunes: crests across the sand seas, the wind's way, bent by the land,
  // in fields and chains with flat sand between. Two sets of crests at right
  // angles, each taking over round the other's poles (where its crests
  // would close into rings)
  float F = uP1.y;
  vec3 D2 = normalize(cross(uDir, vec3(0.3, 0.1, -0.95)));
  float wd = smoothstep(0.55, 0.85, abs(dot(P, uDir)));
  vec3 D = normalize(mix(uDir, D2, wd));
  float bend = 0.22 * reg.x + 0.05 * b.x;
  vec3 gbend = 0.22 * reg.yzw * 1.3 + 0.05 * b.yzw * 2.2;
  float phiA = F * (dot(P, uDir) + bend);
  float phiB = F * (dot(P, D2) + bend) + 0.37;
  float spA = fract(phiA);
  float spB = fract(phiB);
  float duneA = spA < 0.75 ? spA / 0.75 : (1.0 - spA) / 0.25;
  float duneB = spB < 0.75 ? spB / 0.75 : (1.0 - spB) / 0.25;
  vec3 gA = F * (uDir + gbend) * (spA < 0.75 ? 1.0 / 0.75 : -1.0 / 0.25);
  vec3 gB = F * (D2 + gbend) * (spB < 0.75 ? 1.0 / 0.75 : -1.0 / 0.25);
  float dune = mix(duneA, duneB, wd);
  vec3 gdune = mix(gA, gB, wd);
  float field = noise(P * F * 0.16 + 3.0) * 0.7 + noise(P * F * 0.05 + 7.0) * 0.5;
  float damp = uP0.x * sand * (1.0 - salt) * smoothstep(-0.25, 0.25, field + 0.1) * smoothstep(-0.5, 0.1, -reg.x - b.x * 0.3);
  float fd = fade(F * 3.0);
  G += gdune * (0.15 / F) * damp * fd;
  // and ripples on them, up close
  float phi2 = mix(phiA, phiB, step(0.5, wd)) * 9.0 + noise(P * 300.0) * 2.0;
  float sp2 = fract(phi2);
  G += D * F * 9.0 * (sp2 < 0.7 ? 1.0 / 0.7 : -1.0 / 0.3) * (0.04 / (F * 9.0)) * uP0.x * sand * (1.0 - salt) * fade(F * 12.0);
  #ifdef CRATERS
  vec4 c1 = craters(P * 6.0, 0.5 * uP0.z, 0.05 / 6.0);
  vec4 c2 = craters(P * 17.0 + 3.0, 0.45 * uP0.z, 0.05 / 17.0) * fade(17.0 * 3.0);
  G += c1.yzw * 6.0 + c2.yzw * 17.0;
  h += (c1.x + c2.x) * 30.0;
  #endif
  // colour: sand mottled paler and darker; rock in strata, darker down the cliffs and gullies
  float mott = fbm(P * 8.0 + 2.0, min(octs(8.0), 4.0));
  vec3 sandC = mix(SAND, SAND2, smoothstep(-0.4, 0.45, reg.x * 0.9 + mott * 0.7 + b.x * 0.4));
  sandC *= 1.0 + (dune - 0.6) * 0.3 * damp * fd;
  sandC = mix(sandC, CREST, smoothstep(0.1, 0.5, field) * damp * 0.25);
  float cliff = uP1.w * smoothstep(0.1, 0.6, st * (1.0 - st) * 4.0);
  vec3 rockC = mix(ROCK, DARK, clamp(cliff * 0.5 + 0.35 * (0.5 + 0.5 * sin(h * 24.0 + mott * 3.0)) - 0.12, 0.0, 1.0));
  rockC = mix(rockC, SAND2, smoothstep(0.2, 0.6, mott) * 0.35);
  rockC *= 0.88 + 0.24 * mott;
  vec3 alb = mix(sandC, rockC, rocky);
  alb = mix(alb, DARK * 0.85, can * 0.7);
  alb = mix(alb, SALT * (0.93 + 0.1 * mott), salt);
  #ifdef CRATERS
  alb = mix(alb, DARK, clamp(-(c1.x * 6.0 + c2.x * 17.0) / 0.05, 0.0, 1.0) * 0.35);
  #endif
  #ifdef SCARS
  // crash sites: a long dark gouge ploughed into the sand, a crater at its end
  vec3 sq = P * 9.0;
  vec3 base = floor(sq - 0.5);
  float scar = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 hh = hash33(cell + 41.0);
    if (hh.x > 0.3 * uP1.x) continue;
    vec3 c = cell + 0.5 + (hh - 0.5) * 0.4;
    vec3 e = normalize(hash33(cell + 77.0) - 0.5);
    vec3 dv = sq - c;
    float al = dot(dv, e);
    float ac = length(dv - e * al);
    float len = 0.2 + 0.25 * hh.y;
    float w0 = 0.012 + 0.03 * hh.z * clamp(1.0 + al / len, 0.0, 1.0);
    float w = max(w0, gFoot * 9.0 * 1.5);
    float gouge = (1.0 - smoothstep(w * 0.5, w, ac)) * smoothstep(-len, -len * 0.7, al) * step(al, 0.0) * (w0 / w);
    float r0 = 0.05 + 0.04 * hh.z;
    float rw = max(r0, gFoot * 9.0 * 1.5);
    float pit = (1.0 - smoothstep(rw * 0.6, rw, length(dv))) * (r0 / rw);
    scar = max(scar, max(gouge, pit));
  }
  alb = mix(alb, DARK * 0.55, scar * 0.9);
  #endif
  s.alb = alb;
  s.grad = G;
}`;

// Ice (Hoth, Crait, Starkiller Base): snow plains, blue glacial ice and
// crevasses, dark rock ranges; Crait's red under its salt; Starkiller's
// forests and its trench.
// pal: snow, ice, rock, deep, accent, accent2, glow
// uP0 = (ice, mountains, crevasses, red streaks), uP1 = (forest, trench width, -, -)
const ICE = /* glsl */ `
uniform vec3 uDir;
void surface(vec3 P, inout Surf s) {
  float o = octs(2.4);
  vec4 b = fbmd(P * 2.4, o, 0.48);
  // mountain ranges: long spines along the crests of a ridged field
  vec4 r1 = noised(P * 2.6 + 17.0);
  vec4 r2 = noised(P * 5.3 + 4.0);
  float rv = (1.0 - abs(r1.x)) * 0.7 + (1.0 - abs(r2.x)) * 0.3;
  vec3 grv = -sign(r1.x) * r1.yzw * 2.6 * 0.7 - sign(r2.x) * r2.yzw * 5.3 * 0.3;
  float zone = smoothstep(-0.15, 0.25, noise(P * 1.4 + 8.0)) * uP0.y;
  float spine = smoothstep(0.7, 0.95, rv) * zone;
  float mtn = zone * smoothstep(0.55, 0.9, rv);
  float h = b.x * 0.35 + spine * 0.9;
  vec3 G = (b.yzw * 2.4 * 0.35 + grv * dss(0.7, 0.95, rv) * zone * 0.9) * uBump;
  float rock = smoothstep(0.3, 0.55, spine) * (0.55 + 0.45 * smoothstep(-0.2, 0.25, b.x));
  G += b.yzw * 2.4 * spine * 1.8 * uBump;
  // glaciers in the low ground, streaming along the wind
  vec3 sq = P * 6.0 - uDir * dot(P, uDir) * 4.5;
  float flow = fbm(sq + 4.0, min(octs(6.0), 5.0));
  float ice = uP0.x * smoothstep(0.05, -0.3, b.x + flow * 0.35) * (1.0 - rock);
  // crevasses: thin dark-blue cracks across the ice and the snow round the ranges
  vec4 cv = noised(P * 38.0 + vec3(flow * 2.0));
  float kc = max(0.04, gFoot * 38.0 * 2.5);
  float crev = smoothstep(1.0 - kc, 1.0 - kc * 0.3, 1.0 - abs(cv.x)) * min(1.0, 0.04 / kc) * uP0.z * clamp(ice * 1.5 + mtn * 0.6, 0.0, 1.0);
  vec4 cv2 = noised(P * 160.0 + 3.0);
  crev = max(crev, smoothstep(0.96, 0.99, 1.0 - abs(cv2.x)) * fade(160.0 * 3.0) * uP0.z * clamp(ice * 1.5 + mtn, 0.0, 1.0));
  // sastrugi: wind ripples in the snow, up close
  float sp = fract(dot(P, uDir) * 420.0 + flow * 6.0);
  G += uDir * (sp < 0.75 ? 1.0 / 0.75 : -1.0 / 0.25) * 0.004 * fade(420.0 * 1.5) * (1.0 - rock);
  float sparkle = noise(P * 700.0) * fade(700.0);
  vec3 snow = SNOW * (0.94 + 0.06 * flow + 0.04 * sparkle);
  vec3 alb = mix(snow, ICE, ice * (0.65 + 0.35 * smoothstep(-0.3, 0.3, flow)));
  alb = mix(alb, mix(ICE, DEEP, 0.3), smoothstep(0.1, 0.5, flow) * ice * 0.5);
  vec3 rockC = mix(ROCK, ROCK * 1.5, smoothstep(-0.3, 0.5, flow));
  // snow lies on the ledges, the rock shows on the steep faces
  float steep = smoothstep(0.08, 0.25, length(G - P * dot(G, P)));
  alb = mix(alb, rockC, rock * mix(0.6, 1.0, steep));
  alb = mix(alb, mix(SNOW, ROCK, 0.25), mtn * (1.0 - rock) * 0.5);
  alb = mix(alb, DEEP, crev * 0.85);
  #ifdef STREAKS
  // Crait: the white's a crust of salt; scuff it and the red shows
  vec3 tq = P * 7.0 - uDir * dot(P, uDir) * 6.4;
  float st1 = fbm(tq + 2.0, min(octs(7.0), 6.0));
  float red = smoothstep(0.14, 0.3, st1 + mtn * 0.15 + noise(P * 2.0) * 0.12) * uP0.w;
  vec4 sc = noised(P * 22.0 + vec3(st1));
  float ks = max(0.03, gFoot * 22.0 * 2.5);
  float scar = smoothstep(1.0 - ks, 1.0 - ks * 0.3, 1.0 - abs(sc.x)) * min(1.0, 0.03 / ks);
  red = max(red, scar * 0.9 * uP0.w);
  red = max(red, rock * 0.6);
  alb = mix(alb, mix(ACCENT, ACCENT2, smoothstep(-0.2, 0.4, flow + sparkle * 0.3)), red);
  #endif
  #ifdef FOREST
  // dark conifer forest in the lowlands, snow caught in it
  float fz = fbm(P * 3.5 + 3.0, min(octs(3.5), 4.0)) + fbm(P * 30.0, min(octs(30.0), 3.0)) * 0.15;
  float forest = uP1.x * smoothstep(0.02, 0.12, fz + 0.08 - mtn * 0.8 - abs(P.y) * 0.3) * (1.0 - ice * 0.7);
  float tree = noise(P * 900.0) * fade(900.0);
  alb = mix(alb, ACCENT * (0.8 + 0.4 * tree + 0.3 * fz) + SNOW * 0.05 * max(tree, 0.0), forest);
  #endif
  #ifdef TRENCH
  // Starkiller: a trench cut round the whole equator, the weapon's glow inside it
  float W = uP1.y;
  float y = P.y + 0.012 * noise(P * 14.0) + 0.004 * noise(P * 60.0);
  float ay = abs(y);
  float tw = max(W * 0.12, gFoot * 2.0);
  float tr = 1.0 - smoothstep(W - tw, W, ay);
  float tt = clamp((ay - (W - tw)) / tw, 0.0, 1.0);
  G += vec3(0.0, sign(y), 0.0) * 0.006 * 6.0 * tt * (1.0 - tt) / tw;
  // inside: dark rock in machined segments
  float seg = fract(atan(P.z, P.x) * 180.0 / 3.14159);
  float ribs = smoothstep(0.42, 0.5, abs(seg - 0.5)) * fade(360.0);
  vec3 floorC = ACCENT2 * (0.8 + 0.4 * ribs);
  alb = mix(alb, floorC, tr);
  float core = 1.0 - smoothstep(0.0, W * 0.32, ay);
  float ch = uCharge * uCharge;
  float pulse = 0.85 + 0.15 * sin(uTime * (2.0 + ch * 10.0) - atan(P.z, P.x) * 8.0);
  s.emit += GLOW * (core * core * (0.45 + 7.0 * ch) + tr * (0.02 + 0.5 * ch)) * pulse * (1.0 - ribs * 0.4);
  // the snow along its rim lit orange as it charges
  s.emit += GLOW * exp(-max(ay - W, 0.0) / (W * 0.6)) * (1.0 - tr) * ch * 0.25;
  #endif
  s.alb = alb;
  s.grad = G;
}`;

// Living worlds (Endor, Yavin 4, Kashyyyk, Dagobah, Naboo, Scarif, Ahch-To,
// Kamino): oceans deep and shallow, coasts bent by a warp, forest and
// grassland by how wet it is, mountains, snow, polar caps; Scarif's island
// chains, Dagobah's pools, Yavin's rivers.
// pal: deep, shallow, forest, grass, rock, snow, beach, murk
// uP0 = (sea level, forest, mountains, polar caps), uP1 = (island chains, swamp, rivers, scale)
const LUSH = /* glsl */ `
void surface(vec3 P, inout Surf s) {
  float F = uP1.w;
  float o = octs(F);
  vec3 wq = P * F * 0.45;
  vec3 warp = vec3(noise(wq + 1.7), noise(wq + 9.2), noise(wq + 4.4)) * 0.4;
  vec4 b = fbmd(P * F + warp, o, 0.5);
  float h = b.x;
  vec3 g = b.yzw * F;
  #ifdef ISLANDS
  // chains of islands strung along the crests of a ridged field
  vec4 ch = noised(P * 3.2 + 3.3 + warp * 1.4);
  float chain = 1.0 - abs(ch.x);
  vec4 bead = noised(P * 16.0 + warp * 2.0 + 1.0);
  h = h * 0.45 + uP1.x * ((chain * chain - 0.55) * 0.9 + 0.3 * bead.x * chain);
  g = g * 0.45 + uP1.x * (0.9 * 2.0 * chain * -sign(ch.x) * ch.yzw * 3.2 + 0.3 * chain * bead.yzw * 16.0);
  #endif
  float sea = uP0.x;
  float depth = sea - h;
  float cw = max(0.006, gFoot * length(g) * 1.2);
  float land = smoothstep(-cw, cw, -depth);
  float alt = max(-depth, 0.0);
  float moist = fbm(P * 3.7 + 11.0, min(o, 4.0));
  float detail = fbm(P * 40.0 + 2.0, min(octs(40.0), 4.0));
  // the land: forest where it's wet, grass or savanna where it isn't
  vec3 landC = mix(GRASS, FOREST, smoothstep(-0.2, 0.2, moist + uP0.y - 0.5 + detail * 0.15));
  landC *= 0.88 + 0.24 * detail;
  float canopy = noise(P * 1100.0) * fade(1100.0);
  landC *= 1.0 + canopy * 0.18;
  float rockK = smoothstep(0.16, 0.34, alt * uP0.z + detail * 0.04);
  landC = mix(landC, ROCK * (0.85 + 0.3 * detail), rockK);
  landC = mix(landC, SNOW, smoothstep(0.4, 0.5, alt * uP0.z + detail * 0.05));
  landC = mix(BEACH, landC, smoothstep(0.0, 0.025, alt));
  vec3 G = g * uBump * (0.15 + 0.85 * smoothstep(0.0, 0.1, alt)) * land;
  float wet = 1.0 - land;
  #ifdef RIVERS
  // rivers winding to the sea through the lowlands
  vec4 rv = noised(P * 7.0 + warp * 2.0 + 21.0);
  float kr = max(0.025, gFoot * 7.0 * 2.5);
  float river = smoothstep(1.0 - kr, 1.0 - kr * 0.3, 1.0 - abs(rv.x)) * min(1.0, 0.025 / kr) * land * (1.0 - smoothstep(0.1, 0.3, alt)) * uP1.z;
  landC = mix(landC, SHALLOW * 0.7, river);
  wet = max(wet, river);
  #endif
  #ifdef SWAMP
  // Dagobah: the low ground all pools and channels of murky water
  float pz = noise(P * 30.0 + warp * 3.0) * 0.6 + noise(P * 110.0) * 0.4 * fade(110.0);
  float pool = smoothstep(0.05, 0.2, pz) * (1.0 - smoothstep(0.05, 0.25, alt)) * uP1.y * land;
  landC = mix(landC, MURK, pool);
  wet = max(wet, pool * 0.6);
  G *= 1.0 - pool;
  #endif
  // the sea: shallow over the shelves, deep beyond
  float shelf = 0.06 + 0.25 * uP1.x;
  vec3 seaC = mix(SHALLOW, DEEP, smoothstep(0.0, shelf, depth));
  seaC = mix(seaC, DEEP * 0.8, smoothstep(shelf, shelf * 4.0, depth) * 0.6);
  // waves, up close
  vec4 wv = noised(P * 700.0 + vec3(uTime * 0.6, 0.0, uTime * 0.4));
  vec4 sw = noised(P * 90.0 + vec3(0.0, uTime * 0.05, uTime * 0.04));
  G += (wv.yzw * 700.0 * 0.000012 * fade(700.0) + sw.yzw * 90.0 * 0.00012 * fade(90.0)) * (1.0 - land);
  vec3 alb = mix(seaC, landC, land);
  // polar caps over land and sea alike
  float cap = smoothstep(1.0 - uP0.w - 0.02, 1.0 - uP0.w + 0.02, abs(P.y) + moist * 0.06 + detail * 0.02) * step(0.001, uP0.w);
  alb = mix(alb, SNOW, cap);
  wet *= 1.0 - cap;
  s.alb = alb;
  s.grad = G;
  s.wet = wet;
}`;

// The city that covers a world (Coruscant): blocks, streets and avenues on a
// grid (laid on a cube's faces, so it's square everywhere), districts darker
// and lighter, plazas; at night the streets a web of light.
// pal: steel, brown, dark, plaza, warm, white
// uP0 = (lights, -, districts, plazas)
const CITY = /* glsl */ `
// blocks of frequency f raised between streets (street: their width, of a
// cell): .x the height 0..1, .yz its gradient in uv; id: the block's hash
vec3 blocks(vec2 uv, float f, float street, float seed, out float id) {
  vec2 q = uv * f;
  vec2 e = fract(q) - 0.5;
  id = hash13(vec3(floor(q), seed));
  vec2 ae = abs(e);
  float d = 0.5 - max(ae.x, ae.y);
  float tall = 0.25 + 0.75 * id * id;
  float hgt = smoothstep(0.0, street, d) * tall;
  vec2 gd = ae.x > ae.y ? vec2(-sign(e.x), 0.0) : vec2(0.0, -sign(e.y));
  return vec3(hgt, gd * dss(0.0, street, d) * tall * f);
}
// a grid's lines: 1 on a street, 0 on a block; their average when too fine to draw
float streets(vec3 b, float f, float street) {
  float line = 1.0 - smoothstep(0.0, 0.5, b.x / (0.25 + 0.75 * 0.5));
  return mix(line, 2.0 * street, smoothstep(0.25, 0.9, gFoot * f * 1.5));
}
void surface(vec3 P, inout Surf s) {
  // the grid's laid on a cube's faces: which face, its uv, which way u and v run
  vec3 a = abs(P);
  vec2 uv;
  vec3 U;
  vec3 V;
  float k;
  float face;
  if (a.x > a.y && a.x > a.z) { uv = P.yz / a.x; U = vec3(0.0, 1.0, 0.0); V = vec3(0.0, 0.0, 1.0); k = a.x; face = sign(P.x); }
  else if (a.y > a.z) { uv = P.xz / a.y; U = vec3(1.0, 0.0, 0.0); V = vec3(0.0, 0.0, 1.0); k = a.y; face = 3.0 + sign(P.y); }
  else { uv = P.xy / a.z; U = vec3(1.0, 0.0, 0.0); V = vec3(0.0, 1.0, 0.0); k = a.z; face = 6.0 + sign(P.z); }
  float o = octs(3.0);
  float dist = fbm(P * 3.0 + 7.0, min(o, 5.0));
  float dist2 = fbm(P * 11.0 + 1.0, min(octs(11.0), 4.0));
  // districts between the avenues, blocks between the streets, towers on the blocks
  float i1;
  float i2;
  float i3;
  float i4;
  vec3 b1 = blocks(uv, 9.0, 0.04, face, i1);
  vec3 b2 = blocks(uv, 70.0, 0.1, face + 10.0, i2);
  vec3 b3 = blocks(uv, 480.0, 0.16, face + 20.0, i3);
  vec3 b4 = blocks(uv, 2600.0, 0.22, face + 30.0, i4);
  float f2 = fade(70.0 * 1.4);
  float f3 = fade(480.0 * 1.4);
  float f4 = fade(2600.0 * 1.4);
  float av = streets(b1, 9.0, 0.04);
  float st = streets(b2, 70.0, 0.1);
  float bl = streets(b3, 480.0, 0.16);
  vec2 gu = b2.yz * 0.0016 * f2 + b3.yz * 0.0005 * f3 + b4.yz * 0.00008 * f4;
  vec3 G = (gu.x * U + gu.y * V) / k;
  // by day: steel and brown, districts darker and lighter, each block and tower its own tone
  vec3 alb = mix(STEEL, BROWN, smoothstep(-0.3, 0.3, dist2 + (i2 - 0.5) * 0.5 * f2));
  alb *= 0.85 + 0.3 * mix(0.5, i2, f2);
  alb *= 0.8 + 0.4 * mix(0.5, i3, f3);
  alb *= 0.9 + 0.2 * mix(0.5, i4, f4);
  alb = mix(alb, DARK, smoothstep(0.05, 0.35, dist) * uP0.z * 0.75);
  float plaza = step(i3, 0.02 * uP0.w) * step(0.5, i2) * f3;
  alb = mix(alb, PLAZA, plaza * 0.7);
  alb *= 1.0 - av * 0.3 - st * 0.25 - bl * 0.2;
  // by night: avenues and streets lit, windows in the towers, districts brighter and dimmer
  float dens = smoothstep(-0.25, 0.35, -dist + dist2 * 0.7);
  dens = dens * dens * (0.3 + 0.7 * smoothstep(-0.3, 0.3, noise(P * 24.0 + 3.0)));
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + i4 * 3.0) + i4 * 40.0);
  float artery = av * smoothstep(-0.2, 0.4, noise(P * 40.0 + 9.0)) * 1.3;
  float lights = artery + st * 1.0 * mix(0.6, step(0.25, i2), f2) + bl * 0.6 * mix(0.5, step(0.35, i3), f3);
  lights += mix(0.12, step(0.72, i4) * 1.4 * twinkle, f4) * (1.0 - bl);
  lights += plaza * 1.2;
  vec3 lc = mix(WARM, WHITE, smoothstep(0.2, 0.9, i2 * 0.6 + dist2 + 0.25));
  s.emit = lc * lights * dens * gNight * uP0.x;
  s.alb = alb;
  s.grad = G;
  s.wet = plaza * 0.15;
}`;

// Volcanic (Mustafar): black crust, rivers and lakes of lava glowing
// through it, the crust beside them lit red.
// pal: crust, ash, hot, lava, ember
// uP0 = (rivers, lakes, glow, pulse)
const LAVA = /* glsl */ `
void surface(vec3 P, inout Surf s) {
  float o = octs(2.6);
  vec4 b = fbmd(P * 2.6, o, 0.5);
  vec4 rough = noised(P * 260.0 + 5.0);
  vec3 G = b.yzw * 2.6 * uBump + rough.yzw * 260.0 * 0.00004 * fade(260.0);
  vec4 r1 = noised(P * 4.0 + vec3(b.x * 0.7));
  vec4 r2 = noised(P * 13.0 + vec3(b.x * 1.3) + 5.0);
  float k1 = max(0.03, gFoot * 4.0 * 3.0);
  float k2 = max(0.025, gFoot * 13.0 * 3.0);
  float v1 = 1.0 - abs(r1.x);
  float v2 = 1.0 - abs(r2.x);
  float riv = smoothstep(1.0 - k1, 1.0 - k1 * 0.3, v1) * min(1.0, 0.03 / k1);
  riv = max(riv, smoothstep(1.0 - k2, 1.0 - k2 * 0.3, v2) * min(1.0, 0.025 / k2) * smoothstep(0.6, 0.9, v1 + b.x * 0.3) * 0.9);
  riv *= uP0.x;
  float lake = smoothstep(-0.4, -0.47, b.x) * uP0.y;
  // and cracks in the crust glowing through, seen close
  vec4 r3 = noised(P * 70.0 + vec3(b.x * 2.0) + 11.0);
  float k3 = max(0.04, gFoot * 70.0 * 3.0);
  float crack = smoothstep(1.0 - k3, 1.0 - k3 * 0.3, 1.0 - abs(r3.x)) * min(1.0, 0.04 / k3) * smoothstep(0.3, 0.75, v1 + b.x * 0.2) * 0.8;
  float lava = max(max(riv, lake), crack * uP0.x);
  // the lava's skin: crusted rafts drifting on it
  float skin = noise(P * 60.0 + vec3(uTime * 0.03, 0.0, uTime * 0.02)) * 0.5 + noise(P * 220.0 - vec3(uTime * 0.05)) * 0.5 * fade(220.0);
  float core = smoothstep(0.0, 0.7, lava) * (0.75 + 0.25 * skin);
  float pulse = 1.0 + uP0.w * 0.25 * sin(uTime * 1.3 + noise(P * 5.0) * 6.0);
  vec3 crust = mix(CRUST, ASH, smoothstep(-0.2, 0.5, fbm(P * 18.0 + 4.0, min(octs(18.0), 5.0)) + b.x * 0.3));
  float near = smoothstep(0.7, 0.96, v1) * uP0.x + smoothstep(-0.18, -0.3, b.x) * uP0.y;
  crust = mix(crust, EMBER * 0.4, clamp(near, 0.0, 1.0) * 0.5);
  s.alb = mix(crust, EMBER * 0.3, lava);
  s.emit = mix(LAVA, HOT, core * core) * lava * (1.9 + 1.2 * core) * pulse * uP0.z;
  s.emit += EMBER * clamp(near, 0.0, 1.0) * 0.1 * pulse * uP0.z;
  s.grad = G * (1.0 - lava);
}`;

// The Sith world (Exegol): nothing but storm, dark cloud tops whirling, and
// lightning flickering inside them.
// pal: dark, mid, light, bolt
// uP0 = (bolts, swirl, speed, -)
const STORM = /* glsl */ `
void surface(vec3 P, inout Surf s) {
  vec3 q = spinY(P, uTime * uP0.z);
  q = whirl(q, normalize(vec3(0.3, 0.8, 0.5)), 0.1, 2.6 * uP0.y);
  q = whirl(q, normalize(vec3(-0.6, -0.3, -0.7)), 0.08, -2.2 * uP0.y);
  q = whirl(q, normalize(vec3(0.7, -0.5, 0.2)), 0.07, 2.4 * uP0.y);
  float o = octs(3.0);
  vec3 w = vec3(noise(q * 2.0 + 1.0), noise(q * 2.0 + 5.0), noise(q * 2.0 + 9.0));
  vec4 c = fbmd(q * 3.0 + w * 0.6 + vec3(0.0, uTime * 0.012, 0.0), o, 0.52);
  float dens = clamp(c.x * 0.8 + 0.5, 0.0, 1.0);
  vec3 alb = mix(DARK, MID, smoothstep(0.25, 0.75, dens));
  alb = mix(alb, LIGHT, smoothstep(0.7, 1.0, dens) * 0.7);
  // lightning: cells of cloud flaring at their own random moments
  vec3 lq = q * 6.0;
  vec3 base = floor(lq - 0.5);
  float bolt = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 hh = hash33(cell + 13.0);
    if (hh.x > uP0.x) continue;
    vec3 cp = cell + 0.5 + (hash33(cell + 51.0) - 0.5) * 0.5;
    float ph = fract(uTime * (0.07 + 0.12 * hh.y) + hh.z * 7.0);
    float on = smoothstep(0.0, 0.004, ph) * (1.0 - smoothstep(0.006, 0.05, ph)) * (0.55 + 0.45 * sin(uTime * 70.0 + hh.y * 30.0));
    vec3 dv = lq - cp;
    bolt += on * exp(-dot(dv, dv) * 9.0);
  }
  float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.5, noise(q * 1.7 + floor(uTime * 4.0) * 3.1));
  s.emit = BOLT * (bolt * (0.4 + dens * 1.2) * 4.0 + uFlash * (0.04 + dens * dens * 0.9) * lit);
  s.alb = alb;
  s.grad = c.yzw * 3.0 * uBump;
}`;

// Gas giants (Yavin, Endor's giant, Bespin): bands at their own speeds,
// turbulent where they meet, a great storm.
// pal: a, b, c, d, e (the bands), storm
// uP0 = (bands, turbulence, flow, fine), uP1 = (storm size, storm latitude, storm longitude, -)
const GAS = /* glsl */ `
vec3 bandCol(float x) {
  float v = clamp(0.5 + 0.26 * sin(x) + 0.16 * sin(x * 2.31 + 1.7) + 0.08 * sin(x * 5.13 + 0.3), 0.0, 0.999) * 4.0;
  int i = int(v);
  float t = smoothstep(0.15, 0.85, fract(v));
  return mix(uPal[i], uPal[i + 1], t);
}
void surface(vec3 P, inout Surf s) {
  float lat = P.y;
  vec3 q = spinY(P, uTime * uP0.z * (0.6 + 0.4 * sin(lat * 9.0)));
  float sl = uP1.y;
  vec3 S = vec3(cos(sl) * cos(uP1.z), sin(sl), cos(sl) * sin(uP1.z));
  float storm = 0.0;
  if (uP1.x > 0.0) {
    q = whirl(q, S, uP1.x, 5.0);
    storm = exp(-(1.0 - dot(normalize(q), S)) / (uP1.x * 0.5));
  }
  float o = octs(4.0);
  vec3 sq = q * vec3(2.0, 10.0, 2.0);
  vec3 w = vec3(noise(sq + 4.0), noise(sq + 8.0), noise(sq * 1.3 + 2.0));
  float turb = fbm(q * vec3(3.0, 12.0, 3.0) + w * 0.9, min(o, 6.0));
  float x = q.y * uP0.x + turb * uP0.y;
  vec3 alb = bandCol(x);
  vec4 fine = fbmd(q * vec3(9.0, 30.0, 9.0) + w * 1.5, max(o - 1.5, 1.0), 0.5);
  alb *= 1.0 + fine.x * 0.18 * uP0.w;
  // close to, the cloud tops billow
  vec4 puff = fbmd(q * 45.0 + w * 3.0 + vec3(0.0, uTime * 0.01, 0.0), clamp(octs(45.0), 1.0, uMaxOct - 3.0), 0.42);
  float fp = fade(45.0);
  alb *= 1.0 + puff.x * 0.3 * fp;
  alb = mix(alb, STORM, smoothstep(0.35, 0.9, storm) * (0.75 + 0.25 * fine.x));
  alb = mix(alb, alb * 0.75, smoothstep(0.2, 0.4, storm) * (1.0 - smoothstep(0.4, 0.6, storm)));
  s.alb = alb;
  s.grad = fine.yzw * vec3(9.0, 30.0, 9.0) * uBump + puff.yzw * 45.0 * 0.004 * fp;
}`;

// Moons: grey, ice, dust, rust; craters on craters, darker seas, cracks in the ice.
// pal: base, dark, bright, crack
// uP0 = (craters, maria, cracks, -)
const MOON = /* glsl */ `
void surface(vec3 P, inout Surf s) {
  float o = octs(2.0);
  vec4 b = fbmd(P * 2.0, o, 0.5);
  vec3 G = b.yzw * 2.0 * uBump;
  float d = uP0.x;
  vec4 c1 = craters(P * 3.0, 0.7 * d, 0.06 / 3.0);
  vec4 c2 = craters(P * 9.0 + 1.0, 0.6 * d, 0.05 / 9.0) * fade(9.0 * 2.5);
  vec4 c3 = craters(P * 27.0 + 2.0, 0.5 * d, 0.05 / 27.0) * fade(27.0 * 2.5);
  vec4 c4 = craters(P * 80.0 + 3.0, 0.5 * d, 0.05 / 80.0) * fade(80.0 * 2.5);
  G += c1.yzw * 3.0 + c2.yzw * 9.0 + c3.yzw * 27.0 + c4.yzw * 80.0;
  float cr = c1.x / 0.02 + c2.x / (0.05 / 9.0) * 0.6 + c3.x / (0.05 / 27.0) * 0.4;
  float mar = smoothstep(0.05, -0.25, fbm(P * 1.6 + 3.0, min(o, 4.0))) * uP0.y;
  float mott = fbm(P * 12.0, min(octs(12.0), 4.0));
  vec3 alb = mix(BASE, DARK, mar) * (0.9 + 0.2 * mott);
  alb = mix(alb, BRIGHT, clamp(cr, 0.0, 1.0) * 0.35);
  alb *= 1.0 - clamp(-cr, 0.0, 1.0) * 0.15;
  vec4 ck = noised(P * 5.0 + 2.0);
  float kk = max(0.018, gFoot * 5.0 * 2.5);
  float crack = smoothstep(1.0 - kk, 1.0 - kk * 0.3, 1.0 - abs(ck.x)) * min(1.0, 0.018 / kk);
  vec4 ck2 = noised(P * 17.0 + 7.0);
  float kk2 = max(0.02, gFoot * 17.0 * 2.5);
  crack = max(crack, smoothstep(1.0 - kk2, 1.0 - kk2 * 0.3, 1.0 - abs(ck2.x)) * min(1.0, 0.02 / kk2) * 0.8);
  alb = mix(alb, CRACK, crack * uP0.z);
  s.alb = alb;
  s.grad = G;
}`;

const FAMILIES = { desert: DESERT, ice: ICE, lush: LUSH, city: CITY, lava: LAVA, storm: STORM, gas: GAS, moon: MOON };

// relief, clouds, sunlight (one or two suns), the sea's glint, a faint
// light on the night side, the look's own light, then the haze
const SURFACE_MAIN = /* glsl */ `
void main() {
  vec3 P = normalize(vObj);
  float dist = length(vWorld - cameraPosition);
  gFoot = max(dist * uPix / uR, 1e-7);
  mat3 R = uRot;
  vec3 Ng = normalize(R * P);
  gSunObj = normalize(transpose(R) * uSunDir[0]);
  gNight = 1.0 - smoothstep(-0.14, 0.1, max(dot(Ng, uSunDir[0]), dot(Ng, uSunDir[1])));
  Surf s = Surf(vec3(0.5), vec3(0.0), 0.0, vec3(0.0), 0.0, 0.0);
  surface(P, s);
  float thick = 0.0;
  #ifdef CLOUDS
  // (down under them, skimming the ground, they're overhead: only their shadows show)
  float under = smoothstep(0.03, 0.12, length(cameraPosition - uCenter) / uR - 1.0);
  float co = min(octs(uCloud.w), uMaxOct > 6.0 ? 6.0 : 4.0);
  if (under > 0.0) {
    s.cloud = cloudAt(P, co) * under;
    thick = gCloudThick;
  }
  s.shade = cloudAt(normalize(P + gSunObj * 0.015), min(co, 3.0)) * 0.7;
  #endif
  vec3 Gt = s.grad - P * dot(s.grad, P);
  vec3 N = normalize(R * normalize(P - Gt));
  vec3 V = normalize(cameraPosition - vWorld);
  float nv = max(dot(N, V), 0.0);
  vec3 col = vec3(0.0);
  vec3 ccol = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 L = uSunDir[i];
    float mu = dot(Ng, L);
    vec3 sunC = uSunCol[i] * mix(mix(uSunset, vec3(1.0), 0.45), vec3(1.0), smoothstep(-0.02, 0.2, mu));
    float lit = smoothstep(-0.05, 0.12, mu);
    float ndl = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V + Ng * 1e-4);
    float nh = max(dot(N, H), 0.0);
    float spec = (pow(nh, 900.0) * 3.0 + pow(nh, 90.0) * 0.25 + pow(nh, 12.0) * 0.015) * (0.04 + 0.96 * pow(1.0 - nv, 5.0) + 0.3);
    col += sunC * lit * (1.0 - s.shade) * (s.alb * ndl + s.wet * spec);
    ccol += sunC * smoothstep(-0.15, 0.45, mu) * (0.4 + 0.6 * smoothstep(-0.05, 0.7, mu));
  }
  col += s.alb * 0.018;
  col = mix(col, uCloudCol * (ccol * (0.62 + 0.38 * thick) + 0.012), s.cloud);
  col += s.emit * (1.0 - s.cloud * 0.75);
  #ifdef ATMO
  vec3 ro = (cameraPosition - uCenter) / uR;
  vec3 rd = (vWorld - uCenter) / uR - ro;
  float tm = length(rd);
  float tr;
  vec3 sc = inscatter(ro, rd / tm, tm, tr);
  // (the ground right under you stays clear: the haze is for the distance)
  float near = mix(0.35, 1.0, smoothstep(0.0, 0.25, tm));
  col = col * mix(1.0, tr, near) + sc * near;
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the surface shader for a family, its colour slots named (#define SAND uPal[0]…)
export function surfaceFrag(family, slots) {
  const names = slots.map((n, i) => `#define ${n.toUpperCase()} uPal[${i}]`).join('\n');
  return [NOISE, SURFACE_HEAD, CLOUDS, ATMO, names, FAMILIES[family], SURFACE_MAIN].join('\n');
}

// ── The atmosphere's shell: drawn from inside (back faces), so it's there
// whether you're out in space (the glow round the limb) or down in it (the
// sky); the ground hides the part behind the planet ──
export const SHELL_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const SHELL_FRAG = /* glsl */ `
uniform float uR;
uniform vec3 uCenter;
uniform vec3 uSunDir[2];
uniform vec3 uSunCol[2];
uniform vec3 uAtmo;
uniform vec4 uAtmoP;
uniform vec3 uSunset;
uniform float uFlash;
uniform float uInner;
varying vec3 vWorld;
${ATMO}
void main() {
  vec3 ro = (cameraPosition - uCenter) / uR;
  vec3 rd = normalize(vWorld - cameraPosition);
  float b = dot(ro, rd);
  float c = dot(ro, ro) - uInner * uInner;
  float disc = b * b - c;
  float tMax = 1e4;
  if (disc > 0.0) {
    float t = -b - sqrt(disc);
    if (t > 0.0) tMax = t;
  }
  float tr;
  vec3 col = inscatter(ro, rd, tMax, tr);
  col += uAtmo * uFlash * (1.0 - tr) * 1.2;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ── Scarif's shield: a faint blue shell of hexagons, brighter edge-on ──
export const SHIELD_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = mat3(modelMatrix) * normalize(position);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const SHIELD_FRAG = /* glsl */ `
uniform float uShield;
uniform float uTime;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 P = normalize(vObj);
  vec3 a = abs(P);
  vec2 uv = a.x > a.y && a.x > a.z ? P.yz / a.x : a.y > a.z ? P.xz / a.y : P.xy / a.z;
  vec2 q = uv * 9.0;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 hr = r * 0.5;
  vec2 ga = mod(q, r) - hr;
  vec2 gb = mod(q - hr, r) - hr;
  vec2 gv = dot(ga, ga) < dot(gb, gb) ? ga : gb;
  vec2 id = q - gv;
  vec2 ap = abs(gv);
  float hd = max(dot(ap, normalize(r)), ap.x);
  float y = 0.5 - hd;
  float w = fwidth(y) * 1.5;
  float edge = (1.0 - smoothstep(0.0, 0.035 + w, y)) * (0.035 / (0.035 + w));
  float hcell = hash12(id + floor(P.x * 3.0 + P.y * 5.0 + P.z * 7.0));
  float glint = smoothstep(0.92, 1.0, sin(uTime * (0.6 + hcell) + hcell * 40.0)) * 0.6;
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);
  float shimmer = 0.75 + 0.25 * sin(uTime * 1.7 + dot(P, vec3(9.0, 13.0, 7.0)));
  vec3 col = vec3(0.3, 0.6, 1.0) * (0.003 + edge * (0.07 + glint) * shimmer * (0.4 + fres) + fres * 0.08 + glint * 0.03) * uShield;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
