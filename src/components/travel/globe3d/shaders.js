// GLSL for the WebGL globe. Every colour arrives as a uniform from the page's
// theme, and every pass ends in the renderer's sRGB output, so the dots and
// arcs blend the way the 2D canvas version does.

// Shared by the passes that lie on the sphere: a unit normal in world space
// and how squarely it faces the camera (1 dead ahead, 0 at the rim, negative
// round the back). A sphere is convex, so this is also exact occlusion for
// anything on its surface, with no depth test.
const FACING = /* glsl */ `
  float facingOf(vec3 n) {
    return dot(n, normalize(cameraPosition - n));
  }
  // two directions in the plane touching the sphere at n
  void tangents(vec3 n, out vec3 t1, out vec3 t2) {
    vec3 up = abs(n.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    t1 = normalize(cross(up, n));
    t2 = cross(n, t1);
  }
`;

// Coverage of a disc edge, about a pixel wide whatever the zoom.
const EDGE = /* glsl */ `
  float inside(float edge, float d, float fw) {
    return clamp((edge - d) / max(fw, 1e-6) + 0.5, 0.0, 1.0);
  }
`;

// ── The sphere itself: matte, lit from the upper left, with the atmosphere's
// inner edge as an accent tint toward the rim and a hairline silhouette. ──
export const bodyVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
export const bodyFrag = /* glsl */ `
  uniform vec3 uSurface;
  uniform vec3 uSurface2;
  uniform vec3 uAccent;
  uniform vec3 uBorder;
  uniform vec3 uLight;
  uniform float uRim;
  uniform float uLine;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float lam = dot(n, uLight) * 0.5 + 0.5;
    vec3 col = mix(uSurface2, uSurface, smoothstep(0.3, 1.0, lam));
    float fres = pow(1.0 - facing, 4.0);
    col = mix(col, uAccent, fres * uRim);
    float fw = fwidth(facing);
    col = mix(col, uBorder, (1.0 - smoothstep(0.0, fw * 1.6, facing)) * uLine);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// ── The halo outside the rim: a flat card behind the sphere, faded by
// distance from the silhouette (1 = the rim). ──
export const haloVert = /* glsl */ `
  uniform float uExtent;
  varying vec2 vP;
  void main() {
    vP = position.xy * uExtent;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const haloFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uHalo;
  uniform float uWidth;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    float x = clamp((r - 1.0) / uWidth, 0.0, 1.0);
    float a = pow(1.0 - x, 2.4) * uHalo;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uAccent, a);
    #include <colorspace_fragment>
  }
`;

// ── Land: one small disc per lattice point, lying on the surface so it
// foreshortens toward the rim. Drawn twice: the near side, and the far side
// faintly, as if through glass. ──
export const dotsVert = /* glsl */ `
  attribute vec3 aPos;
  attribute float aCountry;
  attribute float aVisited;
  uniform float uSize;
  uniform float uSide;
  uniform float uHover;
  uniform float uSel;
  uniform float uPrevSel;
  uniform float uSelT;
  uniform float uDim;
  uniform float uLand;
  uniform vec3 uLight;
  varying vec2 vCorner;
  varying float vAlpha;
  varying float vAccent;
  ${FACING}
  float same(float a, float b) { return 1.0 - step(0.5, abs(a - b)); }
  void main() {
    vec3 n = normalize(mat3(modelMatrix) * aPos);
    float side = facingOf(n) * uSide;
    if (side <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // round the other side: not this pass
      return;
    }
    float hov = same(aCountry, uHover);
    float sel = clamp(same(aCountry, uSel) * uSelT + same(aCountry, uPrevSel) * (1.0 - uSelT), 0.0, 1.0);

    // plain land in the text colour; lit countries in the accent, dimmed
    // while another place is chosen; the chosen one brightest and largest
    float a = mix(uLand, 0.75, hov);
    float size = mix(1.0, 1.1, hov);
    float lit = mix(mix(0.9, 0.55, uDim), 1.0, hov);
    a = mix(a, lit, aVisited);
    size = mix(size, mix(1.15, 1.3, hov), aVisited);
    a = mix(a, 1.0, sel);
    size = mix(size, 1.45, sel);

    // depth: fainter and smaller toward the rim, and a touch of the key light
    float depth = smoothstep(0.0, 0.85, side);
    a *= mix(0.3, 1.0, depth);
    size *= mix(0.8, 1.0, depth);
    if (uSide > 0.0) a *= mix(0.72, 1.0, clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0));

    // lying on the surface, but foreshortened only by the square root of
    // how far it's tilted, so the land near the rim keeps its ink
    vec3 toCam = normalize(cameraPosition - n);
    vec3 tilt = toCam - n * dot(toCam, n);
    vec3 t1;
    vec3 t2;
    tangents(n, t1, t2);
    float tl = length(tilt);
    vec3 ta = tl > 1e-4 ? tilt / tl : t1;
    vec3 tb = cross(n, ta);
    float f = max(abs(facingOf(n)), 0.12);
    vec3 p = n + (ta * position.x * inversesqrt(f) + tb * position.y) * uSize * size;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vCorner = position.xy;
    vAlpha = a;
    vAccent = max(aVisited, sel);
  }
`;
export const dotsFrag = /* glsl */ `
  uniform vec3 uText;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying vec2 vCorner;
  varying float vAlpha;
  varying float vAccent;
  ${EDGE}
  void main() {
    float d = length(vCorner);
    float cov = inside(1.0, d, fwidth(d) * 1.1);
    float a = vAlpha * cov * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(mix(uText, uAccent, vAccent), a);
    #include <colorspace_fragment>
  }
`;

// ── Routes: every arc in one ribbon mesh, widened in screen space so the
// line keeps its pixel width at any zoom. Each arc draws in up to its own
// progress, and a comet runs along it: a tail that brightens and thickens
// toward the head. The same mesh is drawn once more where it is hidden by
// the sphere, faintly. ──
export const arcsVert = /* glsl */ `
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aT;
  attribute float aArc;
  uniform vec2 uRes;
  uniform vec4 uArcs[MAX_ARCS]; // per arc: progress, alpha, width, comet head (-1 none)
  varying float vT;
  varying float vSide;
  varying float vProgress;
  varying float vAlpha;
  varying float vHead;
  varying float vHalf;
  vec2 screen(vec4 c) { return c.xy / c.w * uRes * 0.5; }
  void main() {
    vec4 arc = uArcs[int(aArc + 0.5)];
    mat4 mvp = projectionMatrix * modelViewMatrix;
    vec4 c = mvp * vec4(position, 1.0);
    vec2 dir = screen(mvp * vec4(aNext, 1.0)) - screen(mvp * vec4(aPrev, 1.0));
    float len = length(dir);
    dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
    float hw = 0.5 * arc.z + 2.0; // room for the comet's head and the smoothing
    c.xy += vec2(-dir.y, dir.x) * aSide * hw * 2.0 / uRes * c.w;
    gl_Position = c;
    vT = aT;
    vSide = aSide * hw;
    vProgress = arc.x;
    vAlpha = arc.y;
    vHead = arc.w;
    vHalf = 0.5 * arc.z;
  }
`;
export const arcsFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform float uTail;
  varying float vT;
  varying float vSide;
  varying float vProgress;
  varying float vAlpha;
  varying float vHead;
  varying float vHalf;
  void main() {
    if (vT > vProgress) discard;
    float tail = 0.0;
    if (vHead >= 0.0 && vT <= vHead) {
      float k = clamp(1.0 - (vHead - vT) / uTail, 0.0, 1.0);
      // it fades in leaving home and out on arrival
      tail = k * k * clamp(min(vHead / 0.06, (1.0 - vHead) / 0.1), 0.0, 1.0);
    }
    float halfW = vHalf + tail * 0.9;
    float cov = clamp(halfW + 0.5 - abs(vSide), 0.0, 1.0);
    float a = mix(vAlpha, 1.0, tail) * cov * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uAccent, a);
    #include <colorspace_fragment>
  }
`;

// ── The comets' heads: round points, hidden behind the sphere by depth. ──
export const sparkVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uDpr;
  varying float vAlpha;
  varying float vSize;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vSize = aSize * uDpr;
    gl_PointSize = aAlpha > 0.0 ? vSize : 0.0;
    vAlpha = aAlpha;
  }
`;
export const sparkFrag = /* glsl */ `
  uniform vec3 uAccent;
  varying float vAlpha;
  varying float vSize;
  void main() {
    float d = length(gl_PointCoord - 0.5) * vSize;
    float a = clamp(vSize * 0.5 - d, 0.0, 1.0) * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uAccent, a);
    #include <colorspace_fragment>
  }
`;

// ── Pulse rings on home and the chosen place: a ripple lying on the
// surface, easing out as it grows. ──
export const ringVert = /* glsl */ `
  attribute vec3 aPos;
  attribute float aPhase;
  attribute float aOn;
  uniform float uRadius;
  varying vec2 vLocal;
  varying float vFade;
  varying float vPhase;
  varying float vOn;
  ${FACING}
  void main() {
    vec3 n = normalize(mat3(modelMatrix) * aPos);
    float f = facingOf(n);
    if (f <= 0.05 || aOn <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 t1;
    vec3 t2;
    tangents(n, t1, t2);
    vec3 p = n * 1.002 + (t1 * position.x + t2 * position.y) * uRadius;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vLocal = position.xy;
    vFade = smoothstep(0.05, 0.3, f);
    vPhase = aPhase;
    vOn = aOn;
  }
`;
export const ringFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uTime;
  varying vec2 vLocal;
  varying float vFade;
  varying float vPhase;
  varying float vOn;
  void main() {
    float t = fract(uTime + vPhase);
    float r = mix(0.22, 1.0, 1.0 - pow(1.0 - t, 3.0));
    float d = length(vLocal);
    float px = fwidth(d);
    float line = 1.0 - smoothstep(0.55 * px, 1.25 * px, abs(d - r * 0.96));
    float a = (1.0 - t) * 0.8 * line * vFade * vOn;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uAccent, a);
    #include <colorspace_fragment>
  }
`;

// ── Markers: a disc in the surface colour with an accent ring, sized in
// pixels like the 2D globe's; home and the chosen place get a dot inside. ──
export const markerVert = /* glsl */ `
  attribute float aIdx;
  attribute float aHome;
  uniform float uDpr;
  uniform float uSel;
  uniform float uPrevSel;
  uniform float uSelT;
  uniform float uHover;
  varying float vR;
  varying float vStroke;
  varying float vDot;
  varying float vAlpha;
  varying float vRing;
  varying float vSize;
  ${FACING}
  float same(float a, float b) { return 1.0 - step(0.5, abs(a - b)); }
  void main() {
    vec3 n = normalize(mat3(modelMatrix) * normalize(position));
    float f = facingOf(n);
    float sel = clamp(same(aIdx, uSel) * uSelT + same(aIdx, uPrevSel) * (1.0 - uSelT), 0.0, 1.0);
    float hov = same(aIdx, uHover);
    vR = mix(mix(3.2, 4.2, aHome), 5.0, sel) + hov * 0.8;
    vStroke = mix(mix(1.4, 2.0, aHome), 2.0, sel);
    vDot = max(aHome * 1.8, sel * 2.2);
    vAlpha = smoothstep(0.02, 0.14, f);
    vRing = min(1.0, 0.4 + f);
    vSize = (vR + 1.5) * 2.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = f > 0.02 ? vSize * uDpr : 0.0;
  }
`;
export const markerFrag = /* glsl */ `
  uniform vec3 uSurface;
  uniform vec3 uAccent;
  varying float vR;
  varying float vStroke;
  varying float vDot;
  varying float vAlpha;
  varying float vRing;
  varying float vSize;
  ${EDGE}
  void main() {
    float d = length(gl_PointCoord - 0.5) * vSize;
    float fw = fwidth(d);
    float disc = inside(vR, d, fw);
    float fill = inside(vR - vStroke, d, fw);
    float dotc = vDot > 0.0 ? inside(vDot, d, fw) : 0.0;
    vec3 col = mix(uSurface, uAccent, (1.0 - fill) * vRing);
    col = mix(col, uAccent, dotc);
    float a = disc * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;
