// The game's planet skins (src/data/planetSkins.json, made by
// scripts/bf2017-planets.mjs) on the galaxy's bodies: the shader's part, and
// the rule for how much of the skin shows. From orbit a skinned world wears
// the game's colour, relief and clouds; as the ship comes down into its air
// the skin gives way to the procedural ground and the scans, so the close
// ground stays the site's. A body without a skin compiles exactly the shader
// it did before: withSkin is only spliced in for one with a skin.
//
// skinMixAt(dist, atmoTop) → 0..1: 1 from atmoTop × 1.5 radii out, 0 at atmoTop
// withSkin(frag) → the surface shader with the SKIN chunk and its two calls
// skinFile(stem, tier) → the tier's file for a map's stem, or null (low: none)
// SKIN_FRAG: the chunk (#ifdef SKIN; SKIN_NORMAL, SKIN_CLOUDS, SKIN_SEAS)

// (smoothstep: no step where the skin starts to give way)
export function skinMixAt(dist, atmoTop = 1.05) {
  const lo = atmoTop;
  const hi = atmoTop * 1.5;
  const t = Math.min(1, Math.max(0, (dist - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

// the sizes the import writes (scripts/lib/bf2017-planets.mjs's sizesFor):
// the clouds and rings half the colour's, the ultra colour and normal UASTC
const SIZES = { mid: 1024, high: 2048, ultra: 4096 };
export function skinFile(stem, tier, kind = "color") {
  const w = SIZES[tier];
  if (!stem || !w) return null;
  const half = kind === "clouds" || kind === "rings";
  return `${stem}-${half ? w / 2 : w}.${tier === "ultra" && !half ? "ktx2" : "webp"}`;
}

// uSkinK = (normal strength, the normal's green sign, -, -)
export const SKIN_FRAG = /* glsl */ `
#ifdef SKIN
uniform sampler2D uSkinColor;
uniform sampler2D uSkinNormal;
uniform sampler2D uSkinClouds;
uniform float uSkinMix;   // 1 from orbit .. 0 in the air (and 0 until the colour's in)
uniform float uSeamShift; // turns the map is turned about the axis
uniform vec4 uSkinK;
vec2 gSkinUv;
vec2 gSkinDx;
vec2 gSkinDy;
// three's sphere UVs for a point on the unit sphere (the seam at -x, v up),
// and their slopes across the pixel: the u that doesn't jump at the seam
// lends its slope, so the seam's pixels take the mip their neighbours do
// (computed before any branch: a derivative needs every pixel to reach it)
void skinUvs(vec3 P) {
  float a = atan(P.z, -P.x) / 6.2831853 + uSeamShift;
  gSkinUv = vec2(fract(a), 1.0 - acos(clamp(P.y, -1.0, 1.0)) / 3.14159265);
  float b = fract(a + 0.5);
  vec2 ua = vec2(dFdx(gSkinUv.x), dFdy(gSkinUv.x));
  vec2 ub = vec2(dFdx(b), dFdy(b));
  vec2 du = dot(ua, ua) < dot(ub, ub) ? ua : ub;
  gSkinDx = vec2(du.x, dFdx(gSkinUv.y));
  gSkinDy = vec2(du.y, dFdy(gSkinUv.y));
}
vec4 skinAt(sampler2D t, vec2 uv) {
  return textureGrad(t, uv, gSkinDx, gSkinDy);
}
void skin(vec3 P, inout Surf s) {
  skinUvs(P);
  float k = uSkinMix;
  if (k <= 0.0) return;
  vec4 c = skinAt(uSkinColor, gSkinUv);
  s.alb = mix(s.alb, c.rgb, k);
  #ifdef SKIN_SEAS
  // (the game's smoothness, kept in the alpha: its seas are the smooth part)
  s.wet = mix(s.wet, smoothstep(0.5, 0.8, c.a), k);
  #else
  s.wet *= 1.0 - k;
  #endif
  s.emit *= 1.0 - k;
  vec3 g = vec3(0.0);
  #ifdef SKIN_NORMAL
  // the map's tilt along the map's east and north (east: the way u grows)
  vec3 n = skinAt(uSkinNormal, gSkinUv).xyz * 2.0 - 1.0;
  vec3 east = normalize(vec3(P.z, 0.0, -P.x) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(P, east);
  g = -(east * n.x + north * n.y * uSkinK.y) / max(n.z, 0.25) * uSkinK.x;
  #endif
  s.grad = mix(s.grad, g, k);
}
// the game's clouds as the cover (their light stays the site's), drifting
// at the look's own rate, and their shadow a little toward the sun
void skinClouds(vec3 P, inout Surf s, inout float thick) {
  #ifdef SKIN_CLOUDS
  float k = uSkinMix;
  if (k <= 0.0) return;
  float turn = -uTime * uCloud.z / 6.2831853;
  float cov = skinAt(uSkinClouds, vec2(fract(gSkinUv.x + turn), gSkinUv.y)).r;
  vec3 Q = normalize(P + gSunObj * 0.015);
  vec2 uq = vec2(fract(atan(Q.z, -Q.x) / 6.2831853 + uSeamShift + turn), 1.0 - acos(clamp(Q.y, -1.0, 1.0)) / 3.14159265);
  s.cloud = mix(s.cloud, cov, k);
  s.shade = mix(s.shade, skinAt(uSkinClouds, uq).r * 0.7, k);
  thick = mix(thick, cov, k);
  #endif
}
#endif`;

// where the two calls go in the surface shader's main (bodyShaders.js)
const AFTER_SURFACE = "  surface(P, s);\n";
const BEFORE_LIGHT =
  "  vec3 Gt = s.grad - P * dot(s.grad, P);\n  vec3 N = normalize";
const MAIN = "void main() {\n  vec3 P = normalize(vObj);";

export function withSkin(frag) {
  for (const at of [AFTER_SURFACE, BEFORE_LIGHT, MAIN])
    if (frag.split(at).length !== 2)
      throw new Error(
        `the surface shader has moved: no one place for ${JSON.stringify(at.slice(0, 24))}`,
      );
  return frag
    .replace(MAIN, `${SKIN_FRAG}\n${MAIN}`)
    .replace(
      AFTER_SURFACE,
      `${AFTER_SURFACE}  #ifdef SKIN\n  skin(P, s);\n  #endif\n`,
    )
    .replace(
      BEFORE_LIGHT,
      `  #ifdef SKIN\n  skinClouds(P, s, thick);\n  #endif\n${BEFORE_LIGHT}`,
    );
}
