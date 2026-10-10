// The game's planet skins (src/data/planetSkins.json, made by
// scripts/bf2017-planets.mjs) on the galaxy's bodies: the shader's part, and
// the rule for how much of the skin shows. From orbit a skinned world wears
// the game's colour, relief and clouds; as the ship comes down into its air
// the skin gives way to the procedural ground and the scans, so the close
// ground stays the site's. A body without a skin compiles exactly the shader
// it did before: withSkin is only spliced in for one with a skin.
//
// The game lays its planet maps on as three lays a map on a sphere: its
// planet meshes (levels/space/*/planet/planet_*_mesh, objects/planets/
// _planetmeshes/planet_01_mesh) carry UVs once round (u) and pole to pole once
// (v), and the maps, though stored square, are seamless round the planet. So
// the shader works out those UVs on the unit sphere itself (no mesh UVs:
// the site's sphere is its own), `tiles` times round for a gas giant's bands.

// skinMixAt(dist, atmoTop) → 0..1: 1 from atmoTop × 1.5 radii out, 0 at atmoTop
// withSkin(frag) → the surface shader with the SKIN chunk and its two calls
// skinFile(stem, tier, kind) → the tier's file for a map's stem, or null (low: none)
// SKIN_FRAG: the chunk (#ifdef SKIN; SKIN_NORMAL, SKIN_CLOUDS, SKIN_SEAS)

// (smoothstep: no step where the skin starts to give way)
export function skinMixAt(dist, atmoTop = 1.05) {
  const t = Math.min(1, Math.max(0, (dist - atmoTop) / (atmoTop * 0.5)));
  return t * t * (3 - 2 * t);
}

// the tiers the import writes (scripts/lib/bf2017-planets.mjs's sizesFor): the
// ultra colour and normal UASTC, everything else WebP; rings one size
const TIERS = ['mid', 'high', 'ultra'];
export function skinFile(stem, tier, kind = 'color') {
  if (!stem || !TIERS.includes(tier)) return null;
  if (kind === 'rings') return `${stem}-mid.webp`;
  return `${stem}-${tier}.${tier === 'ultra' && (kind === 'color' || kind === 'normal') ? 'ktx2' : 'webp'}`;
}

// uSkinK = (times round, normal strength, the normal's green sign, the
// colour's alpha at which the ground is water); uSkinC = (the clouds' times
// round, the coverage under which there's no cloud, -, -)
export const SKIN_FRAG = /* glsl */ `
#ifdef SKIN
uniform sampler2D uSkinColor;
uniform sampler2D uSkinNormal;
uniform sampler2D uSkinClouds;
uniform float uSkinMix; // 1 from orbit .. 0 in the air (and 0 until the colour's in)
uniform vec4 uSkinK;
uniform vec4 uSkinC;
// three's sphere UVs for a point on the unit sphere (u from the seam at -x,
// v up), and their slopes across the pixel: the u that doesn't jump at the
// seam lends its slope, so the seam's pixels take the mip their neighbours
// do (worked out before any branch: a derivative needs every pixel to reach it)
vec2 gSkinUv;
vec2 gSkinDx;
vec2 gSkinDy;
vec2 skinUv(vec3 P) {
  return vec2(atan(P.z, -P.x) / 6.2831853, 1.0 - acos(clamp(P.y, -1.0, 1.0)) / 3.14159265);
}
void skinUvs(vec3 P) {
  gSkinUv = skinUv(P);
  float a = gSkinUv.x;
  float b = fract(a + 0.5);
  vec2 ua = vec2(dFdx(a), dFdy(a));
  vec2 ub = vec2(dFdx(b), dFdy(b));
  vec2 du = dot(ua, ua) < dot(ub, ub) ? ua : ub;
  gSkinDx = vec2(du.x, dFdx(gSkinUv.y));
  gSkinDy = vec2(du.y, dFdy(gSkinUv.y));
}
// a map at uv, n times round, turned that much of the way round
vec4 skinAt(sampler2D t, vec2 uv, float turn, float n) {
  vec2 k = vec2(n, 1.0);
  return textureGrad(t, (uv + vec2(turn, 0.0)) * k, gSkinDx * k, gSkinDy * k);
}
void skin(vec3 P, inout Surf s) {
  skinUvs(P);
  float k = uSkinMix;
  if (k <= 0.0) return;
  vec4 c = skinAt(uSkinColor, gSkinUv, 0.0, uSkinK.x);
  s.alb = mix(s.alb, c.rgb, k);
  #ifdef SKIN_SEAS
  // (the game's smoothness, kept in the alpha: its seas are the smooth part)
  s.wet = mix(s.wet, smoothstep(uSkinK.w - 0.06, uSkinK.w + 0.06, c.a), k);
  #else
  s.wet *= 1.0 - k;
  #endif
  s.emit *= 1.0 - k;
  vec3 g = vec3(0.0);
  #ifdef SKIN_NORMAL
  // the map's tilt along the map's east and north (east: the way u grows)
  vec3 n = skinAt(uSkinNormal, gSkinUv, 0.0, uSkinK.x).xyz * 2.0 - 1.0;
  vec3 east = normalize(vec3(P.z, 0.0, -P.x) + vec3(1e-5, 0.0, 0.0));
  g = -(east * n.x + cross(P, east) * n.y * uSkinK.z) * uSkinK.y;
  #endif
  s.grad = mix(s.grad, g, k);
}
// the game's clouds as the cover (their light stays the site's), drifting
// at the look's own rate, and their shadow a little toward the sun
void skinClouds(vec3 P, inout Surf s, inout float thick) {
  #ifdef SKIN_CLOUDS
  float k = uSkinMix;
  if (k <= 0.0) return;
  float turn = uTime * uCloud.z / 6.2831853;
  float cov = smoothstep(uSkinC.y, 1.0, skinAt(uSkinClouds, gSkinUv, turn, uSkinC.x).r);
  s.cloud = mix(s.cloud, cov, k);
  s.shade = mix(s.shade, smoothstep(uSkinC.y, 1.0, skinAt(uSkinClouds, skinUv(normalize(P + gSunObj * 0.015)), turn, uSkinC.x).r) * 0.7, k);
  thick = mix(thick, cov, k);
  #endif
}
#endif`;

// where the two calls go in the surface shader's main (bodyShaders.js)
const AFTER_SURFACE = '  surface(P, s);\n';
const BEFORE_LIGHT = '  vec3 Gt = s.grad - P * dot(s.grad, P);\n  vec3 N = normalize';
const MAIN = 'void main() {\n  vec3 P = normalize(vObj);';

export function withSkin(frag) {
  for (const at of [AFTER_SURFACE, BEFORE_LIGHT, MAIN]) if (frag.split(at).length !== 2) throw new Error(`the surface shader has moved: no one place for ${JSON.stringify(at.slice(0, 24))}`);
  return frag
    .replace(MAIN, `${SKIN_FRAG}\n${MAIN}`)
    .replace(AFTER_SURFACE, `${AFTER_SURFACE}  #ifdef SKIN\n  skin(P, s);\n  #endif\n`)
    .replace(BEFORE_LIGHT, `  #ifdef SKIN\n  skinClouds(P, s, thick);\n  #endif\n${BEFORE_LIGHT}`);
}
