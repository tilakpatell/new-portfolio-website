// Scarif's shield's shaders (bodies.js builds it round the planet; bodyShaders.js
// re-exports them under the names they always had).

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
uniform float uHit; // a ship's bump into it: 1 as it lands, dying away
uniform vec3 uHitAt; // where, on the unit sphere (object space)
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
  // the bump: a flash where the ship hit, the cells round it lit up, and a
  // ring running out from it across the shell as the flash dies
  if (uHit > 0.001) {
    float ang = acos(clamp(dot(P, uHitAt), -1.0, 1.0));
    float age = 1.0 - uHit;
    float ring = 1.0 - smoothstep(0.0, 0.05 + age * 0.08, abs(ang - age * 0.9));
    float flash = exp(-ang * 14.0) * uHit;
    float cells = exp(-ang * 5.0) * edge * 6.0 * uHit;
    col += vec3(0.55, 0.8, 1.0) * (flash * 1.6 + ring * uHit * 0.9 + cells) * uShield;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
