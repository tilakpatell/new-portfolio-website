// The game's planet skins (src/data/planetSkins.json, made by
// scripts/bf2017-planets.mjs) on the galaxy's bodies: the shader's part, and
// the rule for how much of the skin shows. From orbit a skinned world wears
// the game's colour, relief and clouds; as the ship comes down into its air
// the skin gives way to the procedural ground and the scans, so the close
// ground stays the site's. A body without a skin compiles exactly the shader
// it did before: withSkin is only spliced in for one with a skin.
//
// The game's planet maps are seamless tiles, not maps of a whole sphere
// (scripts/lib/bf2017-planets.mjs says what the drop holds), so they're laid
// on as the game lays them, repeated: triplanar on the unit sphere, `tiles`
// repeats to a radius (no seam, no pinch at the poles); a gas giant's bands
// (SKIN_BANDS) round the planet `tiles` times and pole to pole once.
//
// skinMixAt(dist, atmoTop) → 0..1: 1 from atmoTop × 1.5 radii out, 0 at atmoTop
// withSkin(frag) → the surface shader with the SKIN chunk and its two calls
// skinFile(stem, tier, kind) → the tier's file for a map's stem, or null (low: none)
// SKIN_FRAG: the chunk (#ifdef SKIN; SKIN_NORMAL, SKIN_CLOUDS, SKIN_SEAS, SKIN_BANDS, SKIN_LAND)

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

// uSkinK = (repeats to a radius, normal strength, the normal's green sign,
// the colour's alpha at which the ground is water); uSkinC = (the clouds'
// repeats to a radius, the coverage under which there's no cloud, -, -).
// SKIN_LAND: the skin is the land's (a tile has no continents: the site's
// seas and coasts stay, the game's ground fills the land between)
export const SKIN_FRAG = /* glsl */ `
#ifdef SKIN
uniform sampler2D uSkinColor;
uniform sampler2D uSkinNormal;
uniform sampler2D uSkinClouds;
uniform float uSkinMix; // 1 from orbit .. 0 in the air (and 0 until the colour's in)
uniform vec4 uSkinK;
uniform vec4 uSkinC;
#ifdef SKIN_BANDS
// round the planet uSkinK.x times (u from three's seam at -x), pole to pole
// once; the slope across the pixel taken from the u that doesn't jump at
// the seam, so the seam's pixels take the mip their neighbours do
// (worked out before any branch: a derivative needs every pixel to reach it)
vec2 gBandUv;
vec2 gBandDx;
vec2 gBandDy;
void skinUvs(vec3 P) {
  float a = atan(P.z, -P.x) / 6.2831853 * uSkinK.x;
  gBandUv = vec2(a, 1.0 - acos(clamp(P.y, -1.0, 1.0)) / 3.14159265);
  float b = fract(a / uSkinK.x + 0.5) * uSkinK.x;
  vec2 ua = vec2(dFdx(a), dFdy(a));
  vec2 ub = vec2(dFdx(b), dFdy(b));
  vec2 du = dot(ua, ua) < dot(ub, ub) ? ua : ub;
  gBandDx = vec2(du.x, dFdx(gBandUv.y));
  gBandDy = vec2(du.y, dFdy(gBandUv.y));
}
vec4 skinAt(sampler2D t, vec3 P, float turn, float f) {
  float k = f / uSkinK.x;
  return textureGrad(t, (gBandUv + vec2(turn * uSkinK.x, 0.0)) * vec2(k, 1.0), gBandDx * vec2(k, 1.0), gBandDy * vec2(k, 1.0));
}
#else
void skinUvs(vec3 P) {}
// three planes' worth, weighted by how squarely the ground faces each
vec4 skinAt(sampler2D t, vec3 P, float turn, float f) {
  vec3 q = spinY(P, turn * 6.2831853) * f;
  vec3 w = pow(abs(P), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(t, q.yz) * w.x + texture2D(t, q.zx) * w.y + texture2D(t, q.xy) * w.z;
}
#endif
void skin(vec3 P, inout Surf s) {
  skinUvs(P);
  float k = uSkinMix;
  #ifdef SKIN_LAND
  k *= 1.0 - clamp(s.wet, 0.0, 1.0);
  #endif
  if (uSkinMix <= 0.0) return;
  vec4 c = skinAt(uSkinColor, P, 0.0, uSkinK.x);
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
  #ifdef SKIN_BANDS
  vec3 n = skinAt(uSkinNormal, P, 0.0, uSkinK.x).xyz * 2.0 - 1.0;
  vec3 east = normalize(vec3(P.z, 0.0, -P.x) + vec3(1e-5, 0.0, 0.0));
  g = -(east * n.x + cross(P, east) * n.y * uSkinK.z) * uSkinK.y;
  #else
  // each plane's tilt, carried onto the sphere's axes (DETAIL's triTilt)
  vec3 q = P * uSkinK.x;
  vec3 w = pow(abs(P), vec3(4.0));
  w /= w.x + w.y + w.z;
  vec2 a = texture2D(uSkinNormal, q.yz).xy * 2.0 - 1.0;
  vec2 b = texture2D(uSkinNormal, q.zx).xy * 2.0 - 1.0;
  vec2 d = texture2D(uSkinNormal, q.xy).xy * 2.0 - 1.0;
  a.y *= uSkinK.z;
  b.y *= uSkinK.z;
  d.y *= uSkinK.z;
  g = -(vec3(0.0, a.x, a.y) * w.x + vec3(b.y, 0.0, b.x) * w.y + vec3(d.x, d.y, 0.0) * w.z) * uSkinK.y;
  #endif
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
  float cov = smoothstep(uSkinC.y, 1.0, skinAt(uSkinClouds, P, turn, uSkinC.x).r);
  s.cloud = mix(s.cloud, cov, k);
  s.shade = mix(s.shade, smoothstep(uSkinC.y, 1.0, skinAt(uSkinClouds, normalize(P + gSunObj * 0.015), turn, uSkinC.x).r) * 0.7, k);
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
