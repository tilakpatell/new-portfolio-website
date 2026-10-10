// The portal, as the show draws it: an opaque green swirl you can't see
// through. A lumpy oval of goo with a bright lime lip, mid-green streaks
// sheared into a spiral that winds down to a deep green eye, flecks of light
// drifting in, and a soft green haze round the outside. One GLSL function,
// `portal()`, shared by the raw WebGL canvases on the site (the hero, the
// card, the theme change: rickmorty/swirl.js), by Portal panic's Three.js
// material, by the universe map's C-137 planet and by the portal a kill
// opens (portalFx.js).
//
// portal(o, t, open, seed): o is the point in portal space (the rim sits
// near length 1), t seconds, open 0…1 (it grows from a point, winding
// faster as it opens), seed varies the goo. Returns premultiplied colour and
// alpha.

export const SWIRL_GLSL = `
float sw_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sw_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sw_hash(i), sw_hash(i + vec2(1.0, 0.0)), f.x), mix(sw_hash(i + vec2(0.0, 1.0)), sw_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sw_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * sw_noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return s;
}
vec2 sw_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
vec4 portal(vec2 o, float t, float open, float seed) {
  float e = max(open, 0.001);
  vec2 q = o / e;
  float r = length(q);
  float a = atan(q.y, q.x);
  // the goo's edge: slow lumps that wander round the rim, a faster ripple on them
  vec2 ring = vec2(cos(a), sin(a));
  float lump = (sw_fbm(ring * 1.3 + vec2(seed * 3.1, t * 0.28)) - 0.5) * 0.15 + 0.014 * sin(a * 13.0 + t * 2.6);
  float edge = 1.0 + lump;
  float d = r / edge; // 0 at the eye, 1 at the lip
  // the swirl: everything turns, the middle faster, so blobs of noise shear
  // into streaks that spiral down; opening winds it up harder
  float spin = t * 0.85 + (1.0 - e) * 5.0;
  float twist = 4.2 * (1.0 - d) * (1.0 - d) + 1.1 * (1.0 - d);
  vec2 w = sw_rot(q, twist + spin);
  float n1 = sw_fbm(w * 2.3 + seed);
  float n2 = sw_fbm(sw_rot(q, twist * 1.35 + spin * 1.3) * 3.4 - seed);
  float s = n1 * 0.7 + n2 * 0.3;
  // the show's greens: a lime body, darker arms, a pale yellow-green lip, and
  // light coming up through the middle
  vec3 arm = vec3(0.11, 0.42, 0.07);
  vec3 body = vec3(0.42, 0.78, 0.16);
  vec3 lime = vec3(0.64, 0.92, 0.24);
  vec3 lip = vec3(0.86, 1.0, 0.46);
  vec3 core = vec3(0.90, 0.95, 0.36);
  vec3 c = mix(body, lime, smoothstep(0.55, 0.95, d) * 0.6);
  // dark arms and light arms wound into the spiral, in a few flat tones like a cel
  c = mix(arm, c, smoothstep(0.40, 0.48, s));
  c = mix(c, lime * 1.06, smoothstep(0.60, 0.67, s) * 0.8);
  // the glow at the eye
  c = mix(c, core, smoothstep(0.42, 0.0, d) * (0.55 + 0.45 * smoothstep(0.35, 0.6, s)));
  // a brushed highlight that rides round with the swirl
  c += vec3(0.10, 0.16, 0.05) * smoothstep(0.55, 1.0, sin(atan(w.y, w.x) * 2.0 + d * 6.0) * 0.5 + 0.5) * d;
  // the lip: a bright band just inside the edge, brightest at the very rim
  c = mix(c, lip, smoothstep(0.80, 0.95, d));
  c = mix(c, vec3(0.96, 1.0, 0.78), smoothstep(0.955, 0.995, d) * 0.8);
  // flecks of light, drifting inward with the swirl
  vec2 g = sw_rot(q, twist * 0.7 + spin * 0.6) * 11.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5 - (vec2(sw_hash(id + 3.1), sw_hash(id + 7.7)) - 0.5) * 0.6;
  float fleck = smoothstep(0.17, 0.07, length(f)) * step(0.64, sw_hash(id + seed)) * smoothstep(0.5, 0.93, d);
  c = mix(c, vec3(0.97, 1.0, 0.88), fleck);
  // solid inside, a short soft edge, then a green haze outside
  float inside = smoothstep(1.02, 0.985, d);
  float haze = exp(-max(d - 1.0, 0.0) * 7.0) * 0.55 * (1.0 - inside) * smoothstep(0.0, 0.3, open) * smoothstep(1.32, 1.04, d * e);
  vec3 glow = vec3(0.45, 0.95, 0.25);
  return vec4(c * inside + glow * haze, max(inside, haze));
}
`;
