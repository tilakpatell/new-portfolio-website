// Albuquerque, the city, drawn: everything plan.js stood on the blocks and
// everything along the streets.
//
// The buildings are all one mesh: every one an instance of a shell (four
// walls, a parapet with a cap, a cornice that's there or isn't, the roof
// deck inside), sized in the shader, its walls painted there too from what
// it's made of: adobe with deep-set windows under wooden lintels, plaster
// shopfronts with their glass and sign bands, brick, glass towers that
// reflect the sky, concrete, corrugated sheds with roller doors, houses with
// a front door and maybe a garage, a parking structure. The windows light up
// after dark, one by one, and the shopfronts and signs glow.
//
// Round them: hip roofs on some of the houses, swamp coolers and air
// handlers on the flat roofs, vigas out of the adobe walls, awnings, the
// shops' signs, yard walls, trees, street lamps, traffic lights that run
// the rules' cycle, stop signs, street-name blades at every corner, bus
// shelters on Central, fire hydrants, fountains, and the power line out
// along Route 66.
//
// createCity({ noise }) → { object, lamps, update(t, night, sky), dispose }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../../lib/seeded';
import { FRONT, KIND, SIGNS } from './plan';
import { CITY, EDGES, GRID, NODES, ROADS, groundHeight, signalAt } from './rules';
import { sharpen } from '../../../lib/three/textures';

const K = GRID.kerb;

// ── the shell every building is one of ──

// Its corners (x and z ±½, y 0 or 1, scaled by the building's size in the
// shader), each lifted by the parapet or not, pushed out (cornice) or in
// (inside the parapet), and which part it's on: 0 wall, 1 inside of the
// parapet, 2 its cap, 3 the roof, 4 the cornice's face, 5 its underside.
function shellGeometry() {
  const corner = [];
  const lift = [];
  const out = [];
  const cor = [];
  const drop = [];
  const part = [];
  const normal = [];
  const SAMPLE = { w: 10, h: 10, d: 10, p: 1, c: 0.3 };
  const at = (v) => {
    const o = v.out + v.cor * SAMPLE.c;
    return new THREE.Vector3(v.c[0] * SAMPLE.w + Math.sign(v.c[0]) * o, v.c[1] * SAMPLE.h + v.lift * SAMPLE.p - v.drop, v.c[2] * SAMPLE.d + Math.sign(v.c[2]) * o);
  };
  // a quad from four corners, wound to face `n`
  const quad = (vs, n, p) => {
    const [a, b, c] = vs.map(at);
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const face = new THREE.Vector3().crossVectors(ab, ac);
    const order = face.dot(new THREE.Vector3(...n)) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of order) {
      const v = vs[k];
      corner.push(...v.c);
      lift.push(v.lift);
      out.push(v.out);
      cor.push(v.cor);
      drop.push(v.drop);
      part.push(p);
      normal.push(...n);
    }
  };
  const V = (c, o = {}) => ({ c, lift: 0, out: 0, cor: 0, drop: 0, ...o });
  // the four sides, each with its outward direction and its two corners (left, right) as seen from outside
  const sides = [
    { n: [0, 0, 1], l: [-0.5, 0.5], r: [0.5, 0.5] },
    { n: [0, 0, -1], l: [0.5, -0.5], r: [-0.5, -0.5] },
    { n: [1, 0, 0], l: [0.5, 0.5], r: [0.5, -0.5] },
    { n: [-1, 0, 0], l: [-0.5, -0.5], r: [-0.5, 0.5] },
  ];
  for (const s of sides) {
    const [lx, lz] = s.l;
    const [rx, rz] = s.r;
    const inward = s.n.map((x) => -x);
    // the wall, from the ground to the top of the parapet
    quad([V([lx, 0, lz]), V([rx, 0, rz]), V([rx, 1, rz], { lift: 1 }), V([lx, 1, lz], { lift: 1 })], s.n, 0);
    // the cornice: a band pushed out at the top, and its underside
    quad([V([lx, 1, lz], { lift: 1, cor: 1, drop: 0.5 }), V([rx, 1, rz], { lift: 1, cor: 1, drop: 0.5 }), V([rx, 1, rz], { lift: 1, cor: 1 }), V([lx, 1, lz], { lift: 1, cor: 1 })], s.n, 4);
    quad([V([lx, 1, lz], { lift: 1, drop: 0.5 }), V([rx, 1, rz], { lift: 1, drop: 0.5 }), V([rx, 1, rz], { lift: 1, cor: 1, drop: 0.5 }), V([lx, 1, lz], { lift: 1, cor: 1, drop: 0.5 })], [0, -1, 0], 5);
    // the cap along the top, from the cornice's edge in over the parapet
    quad([V([lx, 1, lz], { lift: 1, cor: 1 }), V([rx, 1, rz], { lift: 1, cor: 1 }), V([rx, 1, rz], { lift: 1, out: -0.32 }), V([lx, 1, lz], { lift: 1, out: -0.32 })], [0, 1, 0], 2);
    // the parapet's inside face, down to the roof
    quad([V([lx, 1, lz], { out: -0.32 }), V([rx, 1, rz], { out: -0.32 }), V([rx, 1, rz], { lift: 1, out: -0.32 }), V([lx, 1, lz], { lift: 1, out: -0.32 })], inward, 1);
  }
  // the roof
  quad([V([-0.5, 1, 0.5], { out: -0.32 }), V([0.5, 1, 0.5], { out: -0.32 }), V([0.5, 1, -0.5], { out: -0.32 }), V([-0.5, 1, -0.5], { out: -0.32 })], [0, 1, 0], 3);
  const g = new THREE.BufferGeometry();
  // (the position is the corner, and the four ways it bends are one vec4:
  // as a second copy of the corner and four attributes of their own, the
  // shell asked for more than the 16 attributes a graphics chip has, and a
  // chip that counted them all drew no buildings at all)
  const bend = new Float32Array(lift.length * 4);
  lift.forEach((_, i) => bend.set([lift[i], out[i], cor[i], drop[i]], i * 4));
  g.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('aBend', new THREE.BufferAttribute(bend, 4));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

// The walls, worked out per pixel from what each building is (see the top).
function facadeMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aBend; // lift, out, cornice, drop
        attribute float aPart;
        attribute vec3 aSize;
        attribute vec4 aStyle;
        attribute vec4 aShape;
        attribute vec3 aWallC;
        attribute vec3 aTrimC;
        varying vec3 vLocal;
        varying vec3 vLN;
        varying vec3 vSize;
        varying vec4 vStyle;
        varying vec4 vShape;
        varying vec3 vWallC;
        varying vec3 vTrimC;
        varying float vPart;
        varying vec3 vWorldP;`,
      )
      .replace(
        '#include <begin_vertex>',
        `float cOut = aBend.y + aBend.z * aShape.y;
        vec3 transformed = vec3(
          position.x * aSize.x + sign(position.x) * cOut,
          position.y * aSize.y + aBend.x * aShape.x - aBend.w * step(0.001, aShape.y),
          position.z * aSize.z + sign(position.z) * cOut);
        vLocal = transformed;
        vLN = normal;
        vSize = aSize;
        vStyle = aStyle;
        vShape = aShape;
        vWallC = aWallC;
        vTrimC = aTrimC;
        vPart = aPart;
        {
          vec4 wq = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
          #endif
          vWorldP = (modelMatrix * wq).xyz;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform sampler2D uNoise;
        uniform vec3 uSkyTop, uSkyLow, uGroundC;
        varying vec3 vLocal;
        varying vec3 vLN;
        varying vec3 vSize;
        varying vec4 vStyle;
        varying vec4 vShape;
        varying vec3 vWallC;
        varying vec3 vTrimC;
        varying float vPart;
        varying vec3 vWorldP;
        float abqHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // a rect in a cell, its edges softened by how big a pixel is there
        float abqRect(vec2 f, vec4 r, vec2 fw) {
          vec2 a = smoothstep(r.xz - fw, r.xz + fw, f);
          vec2 b = 1.0 - smoothstep(r.yw - fw, r.yw + fw, f);
          return a.x * a.y * b.x * b.y;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 N = normalize(vLN);
        float kind = vStyle.x;
        float seed = vStyle.z;
        float H = vSize.y;
        float floors = max(1.0, vShape.z);
        float isAdobe = 1.0 - step(0.5, kind);
        float isStucco = step(0.5, kind) * (1.0 - step(1.5, kind));
        float isBrick = step(1.5, kind) * (1.0 - step(2.5, kind));
        float isGlass = step(2.5, kind) * (1.0 - step(3.5, kind));
        float isConc = step(3.5, kind) * (1.0 - step(4.5, kind));
        float isMetal = step(4.5, kind) * (1.0 - step(5.5, kind));
        float isHouse = step(5.5, kind) * (1.0 - step(6.5, kind));
        float isGarage = step(6.5, kind) * (1.0 - step(7.5, kind));
        float isPlain = step(7.5, kind);
        float shopKind = isAdobe + isStucco + isBrick;
        bool side = abs(N.x) > 0.5;
        float faceW = side ? vSize.z : vSize.x;
        float u = (side ? -vLocal.z * sign(N.x) : vLocal.x * sign(N.z)) + faceW * 0.5;
        float y = vLocal.y;
        float bit = N.z > 0.5 ? 1.0 : (N.z < -0.5 ? 2.0 : (N.x > 0.5 ? 4.0 : 8.0));
        float isFront = mod(floor(vStyle.w / bit + 0.01), 2.0);
        float wallK = 1.0 - step(0.5, vPart);
        // the walls' own texture: plaster, brick courses, ribs
        vec2 wp = side ? vWorldP.zy : vWorldP.xy;
        float n1 = texture2D(uNoise, wp * 0.045 + seed).r;
        float n2 = texture2D(uNoise, wp * 0.33).a;
        float n3 = texture2D(uNoise, wp * 0.012 + seed * 3.1).g;
        vec3 wall = vWallC * (0.86 + 0.2 * n1 + 0.06 * n2);
        {
          float row = floor(y / 0.31);
          float bxk = (u + mod(row, 2.0) * 0.6) / 1.2;
          float mortar = max(step(fract(y / 0.31), 0.1), step(fract(bxk), 0.04));
          wall *= mix(1.0, mix(0.86 + 0.24 * abqHash(vec2(floor(bxk), row) + seed), 0.72, mortar), isBrick);
          wall *= mix(1.0, 0.84 + 0.16 * smoothstep(0.0, 0.6, abs(sin(u * 10.47))), isMetal);
          // the garage's concrete pours, and the towers' panel joints
          wall *= mix(1.0, 0.92 + 0.08 * step(0.06, fract(y / 1.2)), isConc + isGarage);
        }
        // weather: grime at the foot, streaks down from the top, rounder corners on the adobe
        wall *= mix(0.74, 1.0, smoothstep(0.0, 1.3, y));
        wall *= 1.0 - 0.07 * smoothstep(0.55, 0.9, n3) * smoothstep(H - 4.0, H, y);
        float edge = min(u, faceW - u);
        wall *= mix(mix(0.9, 1.0, smoothstep(0.0, 0.3, edge)), mix(0.74, 1.0, smoothstep(0.0, 0.9, edge)), isAdobe + isHouse * 0.5);

        // ── the windows ──
        float G = floors > 1.5 ? (H / floors) * 1.16 : H;
        float fh = floors > 1.5 ? (H - G) / (floors - 1.0) : H;
        float bay = isGlass * 1.55 + isConc * 2.9 + isBrick * 2.6 + isAdobe * 3.3 + isStucco * 3.1 + isHouse * 3.4 + isMetal * 8.0 + isGarage * 5.8 + isPlain * 999.0;
        float nb = max(1.0, floor(faceW / bay + 0.2));
        float bw = faceW / nb;
        vec2 cell = vec2(u / bw, y < G ? y / G : 1.0 + (y - G) / fh);
        vec2 cid = floor(cell);
        vec2 f = fract(cell);
        vec2 fw = fwidth(cell) * 0.85 + 0.0001;
        // when a window's only a few pixels, it's drawn as the average of itself
        float farK = smoothstep(0.18, 0.5, max(fw.x, fw.y));
        vec4 R = isGlass * vec4(0.03, 0.97, 0.09, 0.96) + isConc * vec4(0.07, 0.93, 0.3, 0.8) + isBrick * vec4(0.27, 0.73, 0.22, 0.82) + isAdobe * vec4(0.34, 0.66, 0.3, 0.72)
          + isStucco * vec4(0.22, 0.78, 0.28, 0.8) + isHouse * vec4(0.3, 0.7, 0.36, 0.74) + isMetal * vec4(0.15, 0.85, 0.82, 0.93) + isGarage * vec4(0.04, 0.96, 0.3, 0.8) + isPlain * vec4(2.0);
        float glass = abqRect(f, R, fw);
        float frameK = abqRect(f, R + vec4(-0.05, 0.05, -0.05, 0.05), fw) - glass;
        // lintels over the adobe's and the houses' windows: a beam of wood
        float lintel = (isAdobe + isHouse) * abqRect(f, vec4(R.x - 0.06, R.y + 0.06, R.w + 0.02, R.w + 0.09), fw);
        // the garage's openings are dark, not glass
        float opening = glass * isGarage;
        glass *= 1.0 - isGarage;
        // street level
        float ground = step(y, G) * wallK;
        float shop = ground * isFront * (shopKind + isGlass + isConc) * (1.0 - isHouse);
        float doorU = abs(u - faceW * 0.5);
        if (shop > 0.5) {
          // a shopfront: a run of glass over a low wall, piers between, a sign band over it, the door in the middle
          float top = max(2.6, G - 1.3);
          float pier = step(0.5, isGlass + isConc) * 0.12 + 0.3;
          float fu = fract(u / bw);
          float run = smoothstep(pier / bw - fw.x, pier / bw + fw.x, fu) * smoothstep(1.0 - pier / bw + fw.x, 1.0 - pier / bw - fw.x, fu);
          float bulk = step(0.55, y) + step(doorU, 0.95);
          glass = run * min(bulk, 1.0) * step(y, top) * (1.0 - step(edge, 0.25));
          frameK = (1.0 - glass) * step(y, top + 0.12) * step(0.45, y) * run * 0.6;
          lintel = 0.0;
          // mullions
          glass *= 1.0 - step(abs(fract(u / 1.3) - 0.5), 0.02) * step(0.5, y) * (1.0 - step(doorU, 0.95));
          wall = mix(wall, vTrimC * (0.8 + 0.3 * n1), step(top + 0.22, y) * step(y, G - 0.15) * (0.55 + 0.45 * vShape.w));
        }
        // a house's front: its door, and maybe a garage door at one end
        float isDoor = 0.0;
        float garageDoor = 0.0;
        if (isHouse * isFront * ground > 0.5) {
          float hasGarage = step(0.45, abqHash(vec2(seed, 3.7)));
          float gx = abqHash(vec2(seed, 9.1)) < 0.5 ? 2.0 : faceW - 2.0;
          garageDoor = hasGarage * step(abs(u - gx), 1.45) * step(y, 2.3) * step(4.6, faceW);
          float dx = hasGarage > 0.5 ? (gx < faceW * 0.5 ? faceW * 0.62 : faceW * 0.38) : faceW * 0.5;
          isDoor = step(abs(u - dx), 0.5) * step(y, 2.15);
          glass *= (1.0 - step(abs(u - dx), 0.9)) * (1.0 - step(abs(u - gx), 1.9) * hasGarage);
          lintel *= (1.0 - step(abs(u - gx), 1.9) * hasGarage);
        }
        // a shed's roller doors, one every bay, on its front
        float roller = isMetal * isFront * ground * step(y, min(4.4, H - 1.6)) * step(abs(fract(u / bw) - 0.5) * bw, 1.9);
        // an adobe's or an office's own front door
        isDoor = max(isDoor, (isAdobe + isConc + isBrick) * isFront * ground * (1.0 - shop) * step(doorU, 0.6) * step(y, 2.3));
        glass *= 1.0 - roller;
        glass *= wallK * step(y, H - 0.2);
        frameK *= wallK * step(y, H - 0.2);
        lintel *= wallK;
        glass = mix(glass, (R.y - R.x) * (R.w - R.z) * (1.0 - isGarage), farK * wallK * (1.0 - shop));
        frameK *= 1.0 - farK;
        lintel *= 1.0 - farK * 0.6;

        vec3 col = wall;
        col = mix(col, vTrimC * 0.75, frameK * (0.5 + 0.5 * (isAdobe + isHouse + isStucco)));
        col = mix(col, vec3(0.32, 0.21, 0.13) * (0.8 + 0.3 * n2), lintel);
        // the glass: dark, a little blue or bronze for the towers (they take the sky in, below)
        float pane = abqHash(cid + seed * 17.0);
        vec3 glassC = mix(vec3(0.05, 0.07, 0.09), vec3(0.11, 0.14, 0.17), pane);
        glassC = mix(glassC, vWallC * 0.42, isGlass * 0.75);
        col = mix(col, glassC, glass);
        col = mix(col, vec3(0.06, 0.06, 0.065), opening);
        col = mix(col, mix(vTrimC, vec3(0.36, 0.24, 0.15), isHouse) * 0.85, isDoor);
        col = mix(col, vec3(0.86, 0.85, 0.8) * (0.92 + 0.08 * step(0.5, fract(y / 0.38))), garageDoor);
        col = mix(col, vec3(0.62, 0.64, 0.64) * (0.88 + 0.12 * step(0.5, fract(y / 0.28))), roller);
        // a tower's spandrels between the floors
        col *= 1.0 - isGlass * wallK * (1.0 - shop) * 0.25 * (1.0 - step(0.12, fract(cell.y)));

        // ── the roof and the parapet ──
        float deck = step(2.5, vPart) * (1.0 - step(3.5, vPart));
        float cap = step(1.5, vPart) * (1.0 - step(2.5, vPart));
        float inner = step(0.5, vPart) * (1.0 - step(1.5, vPart));
        float cornice = step(3.5, vPart) * (1.0 - step(4.5, vPart));
        float under = step(4.5, vPart);
        vec3 roofC = mix(vec3(0.34, 0.33, 0.32), vec3(0.8, 0.79, 0.75), isHouse * step(0.4, seed) + isPlain * 0.4);
        roofC = mix(roofC, vec3(0.5, 0.49, 0.47), isGlass + isConc + isGarage);
        roofC *= 0.82 + 0.3 * texture2D(uNoise, vWorldP.xz * 0.11).r;
        // (and darker into the corners, against the parapet)
        float inset = min(min(vLocal.x + vSize.x * 0.5, vSize.x * 0.5 - vLocal.x), min(vLocal.z + vSize.z * 0.5, vSize.z * 0.5 - vLocal.z));
        roofC *= mix(0.7, 1.0, smoothstep(0.3, 1.4, inset));
        col = mix(col, roofC, deck);
        col = mix(col, vWallC * 0.82 * (0.9 + 0.2 * n1), cap);
        col = mix(col, vWallC * 0.7 * (0.9 + 0.2 * n1), inner * mix(1.0, 0.75, 1.0 - smoothstep(H, H + 0.6, y)));
        col = mix(col, mix(vWallC * 1.06, vTrimC, 0.35 * isStucco), cornice);
        col = mix(col, vWallC * 0.5, under);
        diffuseColor.rgb = col;
        float cityGlass = glass;
        float cityTower = isGlass;
        // what's lit after dark: some windows, every shopfront, the sign bands
        float lit = step(abqHash(cid * vec2(1.0, 1.37) + seed * 7.0), 0.25 + 0.3 * isHouse + 0.15 * (isAdobe + isStucco) + 0.1 * isBrick + 0.2 * isGlass);
        vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.84, 1.0), step(0.78, abqHash(cid + seed)));
        vec3 cityLit = uNight * (glass * (lit * (1.0 - shop) + shop * 0.95) * warm * mix(0.85, 1.15, shop)); // (lit, not glaring: only the brightest catch the bloom)
        cityLit += uNight * isDoor * isHouse * 0.0;
        cityLit += uNight * vTrimC * 1.0 * shop * vShape.w * step(G - 1.05, y) * step(y, G - 0.2) * wallK;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, cityGlass);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // the glass takes in the sky, more of it at a glancing angle
          vec3 vd = normalize(vViewPosition);
          vec3 wr = normalize((vec4(reflect(-vd, normal), 0.0) * viewMatrix).xyz); // (back to the world: the view matrix is a rotation)
          vec3 skyC = wr.y > 0.0 ? mix(uSkyLow, uSkyTop, smoothstep(0.0, 0.55, wr.y)) : mix(uSkyLow, uGroundC, smoothstep(0.0, -0.2, wr.y));
          float fres = 0.06 + 0.94 * pow(1.0 - max(dot(normal, vd), 0.0), 4.0);
          totalEmissiveRadiance += skyC * cityGlass * (0.12 + 0.62 * fres) * mix(0.45, 1.0, cityTower) * (1.0 - uNight * 0.85);
          totalEmissiveRadiance += cityLit;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'abq-facade';
  return m;
}

// The depth material for the shells' shadows (the same sizing, nothing
// else): what the floor masks are baked with (lib/three/grounding-bake).
function shellDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aBend;\nattribute vec3 aSize;\nattribute vec4 aShape;')
      .replace(
        '#include <begin_vertex>',
        `float cOut = aBend.y + aBend.z * aShape.y;
        vec3 transformed = vec3(position.x * aSize.x + sign(position.x) * cOut, position.y * aSize.y + aBend.x * aShape.x - aBend.w * step(0.001, aShape.y), position.z * aSize.z + sign(position.z) * cOut);`,
      );
  };
  m.customProgramCacheKey = () => 'abq-facade-depth';
  return m;
}

// A building's front: the face toward the street that matters most (for its sign).
function mainFront(b) {
  if (!b.front || b.front === 15) return b.z < 0 ? [0, 1] : [0, -1];
  if (b.front & FRONT.s) return [0, 1];
  if (b.front & FRONT.n) return [0, -1];
  if (b.front & FRONT.e) return [1, 0];
  return [-1, 0];
}

// ── text on boards: an atlas of names, each cell 512 by 64 ──
function atlas(names, draw) {
  const W = 1024;
  const cells = Math.ceil(names.length / 2);
  const H = 64 * Math.max(1, 2 ** Math.ceil(Math.log2(cells)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const e = document.createElement('canvas');
  e.width = W;
  e.height = H;
  const g = c.getContext('2d');
  const eg = e.getContext('2d');
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, W, H);
  const rects = names.map((name, i) => {
    const x = (i % 2) * 512;
    const y = Math.floor(i / 2) * 64;
    draw(g, eg, name, x, y, i);
    return [x / W, 1 - (y + 64) / H, 512 / W, 64 / H];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharpen(tex);
  const glow = new THREE.CanvasTexture(e);
  glow.colorSpace = THREE.SRGBColorSpace;
  return { tex, glow, rects };
}
// planes that each show one cell of an atlas: { x, y, z, yaw, w, h, cell }
function atlasPlanes(at, list, { emissive = 0.15, double = true } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const uv = new Float32Array(list.length * 4);
  list.forEach((p, i) => uv.set(at.rects[p.cell], i * 4));
  geo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(uv, 4));
  const uniforms = { uGlow: { value: emissive } };
  const mat = new THREE.MeshStandardMaterial({ map: at.tex, emissiveMap: at.glow, emissive: 0xffffff, emissiveIntensity: emissive, roughness: 0.6, side: double ? THREE.DoubleSide : THREE.FrontSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aUvRect;').replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = aUvRect.xy + uv * aUvRect.zw;
      #endif
      #ifdef USE_EMISSIVEMAP
        vEmissiveMapUv = aUvRect.xy + uv * aUvRect.zw;
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'abq-atlas-plane';
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y, p.z);
    o.rotation.set(0, p.yaw, 0);
    o.scale.set(p.w, p.h, 1);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  });
  return { mesh: inst, mat, geo, uniforms };
}

// instanced copies of one geometry, each { x, y, z, yaw, sx, sy, sz, color }
function many(geo, mat, list) {
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y ?? 0, p.z);
    o.rotation.set(p.rx ?? 0, p.yaw ?? 0, p.rz ?? 0, 'YXZ');
    o.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
    if (p.color !== undefined) inst.setColorAt(i, c.set(p.color));
  });
  inst.count = list.length;
  return inst;
}

const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

export function createCity({ noise } = {}) {
  const root = new THREE.Group();
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const r = seeded(808);
  const range = (a, b) => a + r() * (b - a);
  const B = CITY.buildings;
  const lit = []; // materials that glow more after dark: { m, base, k }

  // ── the buildings ──
  const uniforms = {
    uNight: { value: 0 },
    uNoise: { value: noise },
    uSkyTop: { value: new THREE.Color(0x6f9bd0) },
    uSkyLow: { value: new THREE.Color(0xe9c9a0) },
    uGroundC: { value: new THREE.Color(0x8a6a4a) },
  };
  // (and the penthouses on the towers: plain boxes on their roofs)
  const shells = B.map((b) => ({ ...b, y: K })).concat(
    B.filter((b) => b.h > 26 && b.kind !== KIND.garage).map((b) => ({ id: `${b.id}-top`, x: b.x + (r() - 0.5) * b.w * 0.2, y: K + b.h, z: b.z + (r() - 0.5) * b.d * 0.2, w: b.w * range(0.3, 0.45), d: b.d * range(0.3, 0.45), h: range(3, 4.5), kind: 8, wall: tint(b.kind === KIND.glass ? 0xa8a49a : b.wall, 1), trim: 0x3a3028, front: 0, floors: 1, parapet: 0.6, tone: 0.5, roof: 'flat' })),
  );
  {
    const geo = own(shellGeometry());
    const n = shells.length;
    const size = new Float32Array(n * 3);
    const style = new Float32Array(n * 4);
    const shape = new Float32Array(n * 4);
    const wallC = new Float32Array(n * 3);
    const trimC = new Float32Array(n * 3);
    const c = new THREE.Color();
    shells.forEach((b, i) => {
      size.set([b.w, b.h, b.d], i * 3);
      style.set([b.kind, b.tone ?? 0.5, (i * 0.618) % 1, b.front ?? 0], i * 4);
      // a cornice on the brick, the offices and the towers; none on adobe or houses
      const cornice = b.kind === KIND.brick || b.kind === KIND.concrete || b.kind === KIND.glass ? range(0.12, 0.3) : b.kind === KIND.stucco && r() < 0.5 ? 0.14 : 0;
      shape.set([b.parapet ?? 0.6, cornice, b.floors ?? 1, b.sign !== undefined ? 1 : 0], i * 4);
      c.set(b.wall).toArray(wallC, i * 3);
      c.set(b.trim ?? 0x3a3028).toArray(trimC, i * 3);
    });
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 4));
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4));
    geo.setAttribute('aWallC', new THREE.InstancedBufferAttribute(wallC, 3));
    geo.setAttribute('aTrimC', new THREE.InstancedBufferAttribute(trimC, 3));
    const mat = own(facadeMaterial(uniforms));
    const inst = many(
      geo,
      mat,
      shells.map((b) => ({ x: b.x, y: b.y, z: b.z })),
    );
    inst.customDepthMaterial = own(shellDepth());
    inst.frustumCulled = false;
    root.add(inst);
  }

  // ── hip roofs on the houses that have them ──
  {
    const g = new THREE.BufferGeometry();
    // a unit hip roof: eaves at y 0 round the ±½ square, the ridge along x at y 1
    const p = [
      [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.25, 1, 0, -0.5, 0, 0.5, 0.25, 1, 0, -0.25, 1, 0],
      [0.5, 0, -0.5, -0.5, 0, -0.5, -0.25, 1, 0, 0.5, 0, -0.5, -0.25, 1, 0, 0.25, 1, 0],
      [0.5, 0, 0.5, 0.5, 0, -0.5, 0.25, 1, 0],
      [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.25, 1, 0],
      [-0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, 0.5],
    ].flat();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    const fixed = g;
    // the tiles: rows of shadow, by height
    const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }));
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRoofY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoofY = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRoofY;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 0.25, fract(vRoofY * 7.0));');
    };
    mat.customProgramCacheKey = () => 'abq-hip';
    own(fixed);
    const TILE = [0xa8442b, 0xb5562f, 0x8f3a24, 0x5a4f48, 0x6b5d50, 0x4a4643, 0x7b6a5a];
    const list = B.filter((b) => b.roof === 'hip').map((b) => {
      const along = b.w >= b.d;
      const rise = Math.min(b.w, b.d) * 0.3;
      return { x: b.x, y: K + b.h, z: b.z, yaw: along ? 0 : Math.PI / 2, sx: (along ? b.w : b.d) + 0.9, sy: rise, sz: (along ? b.d : b.w) + 0.9, color: TILE[Math.floor(r() * TILE.length)] };
    });
    root.add(many(fixed, mat, list));
  }

  // ── on the flat roofs: swamp coolers, air handlers, vents ──
  {
    const geo = own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35 }));
    const list = [];
    for (const b of B) {
      if (b.roof === 'hip' || b.kind === KIND.garage) continue;
      const top = K + b.h;
      const spot = () => [b.x + (r() - 0.5) * Math.max(0, b.w - 3), b.z + (r() - 0.5) * Math.max(0, b.d - 3)];
      if (b.kind === KIND.house) {
        if (r() < 0.75) {
          const [x, z] = spot();
          list.push({ x, y: top, z, yaw: r() * 0.3, sx: 1.05, sy: 0.9, sz: 1.05, color: r() < 0.6 ? 0x9aa0a2 : 0xc8bfa8 });
        }
        continue;
      }
      const n = b.h > 26 ? 4 : Math.max(1, Math.round((b.w * b.d) / 160));
      for (let k = 0; k < Math.min(6, n); k++) {
        const [x, z] = spot();
        const big = b.h > 26 || b.kind === KIND.metal;
        list.push({ x, y: top, z, yaw: Math.floor(r() * 4) * (Math.PI / 2), sx: big ? range(2, 3.2) : range(1.3, 1.8), sy: big ? range(1.4, 2.2) : range(0.9, 1.2), sz: big ? range(1.6, 2.4) : range(1.1, 1.4), color: r() < 0.5 ? 0xb8bab6 : 0x8e9396 });
      }
    }
    root.add(many(geo, mat, list));
  }

  // ── vigas: the roof beams' ends, out through the adobe walls ──
  {
    const geo = own(new THREE.CylinderGeometry(0.1, 0.11, 0.62, 6).rotateX(Math.PI / 2));
    const mat = own(new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.95 }));
    const list = [];
    for (const b of B) {
      const adobe = b.kind === KIND.adobe || (b.kind === KIND.house && b.roof === 'flat' && (b.x * 7 + b.z * 13) % 3 < 1);
      if (!adobe) continue;
      const y = K + b.h - 0.32;
      for (const [nx, nz, len] of [
        [0, 1, b.w],
        [0, -1, b.w],
        [1, 0, b.d],
        [-1, 0, b.d],
      ]) {
        const n = Math.floor((len - 1) / 1.15);
        for (let i = 0; i <= n; i++) {
          const s = -len / 2 + 0.5 + (i * (len - 1)) / Math.max(1, n);
          list.push({ x: b.x + (nz ? s : nx * (b.w / 2 + 0.24)), y, z: b.z + (nx ? s : nz * (b.d / 2 + 0.24)), yaw: Math.atan2(nx, nz) });
        }
      }
    }
    root.add(many(geo, mat, list));
  }

  // ── the shops' signs and awnings ──
  {
    const signs = atlas(SIGNS, (g, eg, name, x, y, i) => {
      const bg = ['#1f6f73', '#a8231c', '#2a5f8a', '#f4ead2', '#1c1a17', '#c98a1f', '#2f6f3a', '#6b3fa0'][i % 8];
      const fg = ['#fff3d6', '#fff3d6', '#fff3d6', '#a8231c', '#ffd23a', '#1c1a17', '#fff3d6', '#fff3d6'][i % 8];
      const glow = ['#7fffe6', '#ff6a5a', '#8fd0ff', '#ff5a4a', '#ffd23a', '#ffb347', '#a6ff7a', '#e18aff'][i % 8];
      const font = ['Georgia, serif', '"Arial Black", Arial, sans-serif', '"Courier New", monospace', '"Trebuchet MS", sans-serif'][i % 4];
      g.fillStyle = bg;
      g.fillRect(x, y, 512, 64);
      g.strokeStyle = fg;
      g.lineWidth = 3;
      g.strokeRect(x + 4, y + 4, 504, 56);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let s = 40;
      g.font = `800 ${s}px ${font}`;
      const tw = g.measureText(name).width;
      if (tw > 470) s *= 470 / tw;
      g.font = `800 ${s}px ${font}`;
      g.fillStyle = fg;
      g.fillText(name, x + 256, y + 33);
      eg.font = g.font;
      eg.textAlign = 'center';
      eg.textBaseline = 'middle';
      eg.fillStyle = glow;
      eg.fillText(name, x + 256, y + 33);
    });
    own(signs.tex);
    own(signs.glow);
    const boards = [];
    const awnings = [];
    for (const b of B) {
      if (b.sign === undefined) continue;
      const [fx, fz] = mainFront(b);
      const faceW = fx ? b.d : b.w;
      const floors = Math.max(1, b.floors ?? 1);
      const G = floors > 1 ? (b.h / floors) * 1.16 : b.h;
      const w = Math.min(faceW * 0.72, 8.5);
      const h = w / 8;
      const ox = b.x + fx * (b.w / 2 + 0.07);
      const oz = b.z + fz * (b.d / 2 + 0.07);
      boards.push({ x: ox, y: K + G - 0.72, z: oz, yaw: Math.atan2(fx, fz), w, h, cell: b.sign });
      if (r() < 0.55 && b.kind !== KIND.glass) {
        const top = Math.max(2.6, G - 1.3);
        awnings.push({ x: b.x + fx * (b.w / 2 + 0.75), y: K + top + 0.12, z: b.z + fz * (b.d / 2 + 0.75), yaw: Math.atan2(fx, fz), rx: 0.36, sx: Math.min(faceW * 0.86, faceW - 1), sy: 0.07, sz: 1.6, color: b.trim });
      }
    }
    const p = atlasPlanes(signs, boards, { double: false });
    owned.push(p.mat, p.geo);
    root.add(p.mesh);
    // a sign's glow is turned up after dark (update)
    lit.push({ m: p.mat, base: 0.12, k: 1.3 });
    const geo = own(new THREE.BoxGeometry(1, 1, 1));
    const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
    root.add(many(geo, mat, awnings));
  }

  // ── the walls between the back yards ──
  {
    const geo = own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    const BLOCK = [0xc9b08a, 0xbfa27c, 0xd2bc98, 0xa89a88];
    root.add(many(geo, mat, CITY.walls.map((w, i) => ({ x: w.x, y: K, z: w.z, sx: w.w, sy: w.h, sz: w.d + 0.05, color: BLOCK[i % BLOCK.length] }))));
  }

  // ── trees ──
  {
    const trunk = own(new THREE.CylinderGeometry(0.13, 0.21, 2.8, 6).translate(0, 1.4, 0));
    const canopy = (narrow) => {
      const parts = [];
      const rr = seeded(narrow ? 5 : 3);
      const n = narrow ? 5 : 7;
      for (let i = 0; i < n; i++) {
        const s = narrow ? 0.9 + rr() * 0.4 : 1.2 + rr() * 0.9;
        const g = new THREE.IcosahedronGeometry(s, 1);
        if (narrow) g.scale(0.75, 1.5, 0.75);
        const a = (i / n) * Math.PI * 2;
        const rad = narrow ? 0.35 : 1.1 + rr() * 0.6;
        g.translate(Math.cos(a) * rad * (i ? 1 : 0), (narrow ? 2.4 + i * 0.75 : 3.4 + rr() * 1.4) + (i ? 0 : 0.6), Math.sin(a) * rad * (i ? 1 : 0));
        // a little lighter on top, where the sun gets it
        const pos = g.attributes.position;
        const col = new Float32Array(pos.count * 3);
        for (let k = 0; k < pos.count; k++) {
          const t = 0.72 + 0.4 * Math.min(1, Math.max(0, (pos.getY(k) - 2.5) / 3.5)) + (rr() - 0.5) * 0.12;
          col.set([t, t, t], k * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        parts.push(g.index ? g.toNonIndexed() : g.clone());
        g.dispose();
      }
      const m = mergeGeometries(parts);
      for (const p of parts) p.dispose();
      m.computeVertexNormals();
      return own(m);
    };
    const leaf = own(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, flatShading: true }));
    const bark = own(new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 }));
    const broad = CITY.trees.filter((t) => t.kind === 0);
    const tall = CITY.trees.filter((t) => t.kind === 1);
    const GREENS = [0x5a7a32, 0x6b8a3a, 0x4f6e2e, 0x7a8f42, 0x627f3c];
    const DARKS = [0x3d5a2e, 0x34502a, 0x46633a];
    root.add(many(trunk, bark, CITY.trees.map((t) => ({ x: t.x, y: K, z: t.z, sx: t.s, sy: t.kind ? t.s * 0.9 : t.s, sz: t.s }))));
    root.add(many(canopy(false), leaf, broad.map((t, i) => ({ x: t.x, y: K, z: t.z, yaw: i * 2.4, sx: t.s, sy: t.s, sz: t.s, color: GREENS[i % GREENS.length] }))));
    root.add(many(canopy(true), leaf, tall.map((t, i) => ({ x: t.x, y: K, z: t.z, yaw: i * 1.7, sx: t.s, sy: t.s, sz: t.s, color: DARKS[i % DARKS.length] }))));
  }

  // ── along the streets ──
  const steel = own(new THREE.MeshStandardMaterial({ color: 0x6f747a, roughness: 0.45, metalness: 0.6 }));
  const lampHeads = [];
  // street lamps: down both sides of every stretch, staggered, arms out over the road
  {
    const geo = own(
      mergeGeometries([
        new THREE.CylinderGeometry(0.08, 0.13, 8.4, 7).translate(0, 4.2, 0),
        new THREE.BoxGeometry(0.1, 0.1, 2.3).translate(0, 8.25, 1.1),
        new THREE.BoxGeometry(0.42, 0.16, 0.8).translate(0, 8.18, 2.25),
      ]),
    );
    const list = [];
    const ns = (a, b) => [NODES[a], NODES[b]];
    let stagger = 0;
    for (const e of EDGES) {
      const [A, Bn] = ns(e.a, e.b);
      const len = Math.hypot(Bn.x - A.x, Bn.z - A.z);
      const fx = (Bn.x - A.x) / len;
      const fz = (Bn.z - A.z) / len;
      const half = e.w / 2;
      const clearA = (e.axis === 'x' ? A.hw : A.hd) + 9;
      const clearB = (e.axis === 'x' ? Bn.hw : Bn.hd) + 9;
      for (let s = clearA, k = stagger++; s <= len - clearB; s += 26, k++) {
        const side = k % 2 ? 1 : -1;
        const off = side * (half + 0.7);
        const x = A.x + fx * s - fz * off;
        const z = A.z + fz * s + fx * off;
        // facing the road: its arm toward the middle
        const yaw = Math.atan2(fz * side, -fx * side);
        list.push({ x, y: K, z, yaw });
        lampHeads.push({ x: x + Math.sin(yaw) * 2.25, y: K + 8.05, z: z + Math.cos(yaw) * 2.25 });
      }
    }
    root.add(many(geo, steel, list));
  }

  // traffic lights at the corners that have them: a mast on the far right
  // corner of each way in, its arm over the lanes, the heads facing whoever's coming
  const lampsBy = { ew: [], ns: [] }; // which instance of the lamps is which, by who they're for and their colour
  let lampMesh = null;
  {
    const mast = [];
    const arm = [];
    const head = [];
    const lamps = [];
    for (const n of NODES) {
      if (!n.signal) continue;
      for (const [fx, fz] of [
        [0, -1],
        [0, 1],
        [1, 0],
        [-1, 0],
      ]) {
        const axis = fx ? 'ew' : 'ns';
        const cross = fx ? n.hw : n.hd; // the half-width of the street being crossed
        const own2 = fx ? n.hd : n.hw; // and of the one coming in
        const rx = -fz;
        const rz = fx;
        const px = n.x + fx * (cross + 1.1) + rx * (own2 + 1.0);
        const pz = n.z + fz * (cross + 1.1) + rz * (own2 + 1.0);
        mast.push({ x: px, y: K, z: pz });
        const reach = own2 + 0.6;
        const yaw = Math.atan2(-rx, -rz);
        arm.push({ x: px - rx * reach * 0.5, y: K + 6.0, z: pz - rz * reach * 0.5, yaw, sx: 0.16, sy: 0.16, sz: reach });
        // a head over each lane in, facing back down it
        const face = Math.atan2(-fx, -fz);
        const lanes = own2 >= 8 ? [2.2, 5.8] : [own2 / 2];
        for (const off of lanes) {
          const hx = n.x + fx * (cross + 1.1) + rx * off;
          const hz = n.z + fz * (cross + 1.1) + rz * off;
          head.push({ x: hx, y: K + 5.25, z: hz, yaw: face });
          for (const [k, dy] of [
            [0, 0.38],
            [1, 0],
            [2, -0.38],
          ]) {
            lampsBy[axis].push({ i: lamps.length, k });
            lamps.push({ x: hx - fx * 0.2, y: K + 5.25 + dy, z: hz - fz * 0.2, yaw: face });
          }
        }
      }
    }
    root.add(many(own(new THREE.CylinderGeometry(0.14, 0.18, 6.2, 8).translate(0, 3.1, 0)), steel, mast));
    root.add(many(own(new THREE.BoxGeometry(1, 1, 1)), steel, arm));
    root.add(many(own(new THREE.BoxGeometry(0.44, 1.2, 0.34)), own(new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 })), head));
    lampMesh = many(own(new THREE.CircleGeometry(0.13, 12)), own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), lamps);
    root.add(lampMesh);
  }

  // stop signs, on the right of every way in that has to stop
  {
    const stop = document.createElement('canvas');
    stop.width = stop.height = 128;
    const g = stop.getContext('2d');
    g.fillStyle = '#b3121c';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
    }
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '800 38px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('STOP', 64, 66);
    const tex = own(new THREE.CanvasTexture(stop));
    tex.colorSpace = THREE.SRGBColorSpace;
    const posts = [];
    const faces = [];
    for (const n of NODES) {
      if (n.signal) continue;
      for (const [fx, fz] of [
        [0, -1],
        [0, 1],
        [1, 0],
        [-1, 0],
      ]) {
        const axis = fx ? 'ew' : 'ns';
        if (!(n.stop === 'both' || n.stop === axis)) continue;
        // (only where there's a street coming in from that side)
        const back = { x: n.x - fx * 30, z: n.z - fz * 30 };
        if (Math.abs(back.x) > GRID.xs.at(-1) || Math.abs(back.z) > GRID.zs.at(-1)) continue;
        const cross = fx ? n.hw : n.hd;
        const own2 = fx ? n.hd : n.hw;
        const rx = -fz;
        const rz = fx;
        const x = n.x - fx * (cross + 4.4) + rx * (own2 + 1.1);
        const z = n.z - fz * (cross + 4.4) + rz * (own2 + 1.1);
        posts.push({ x, y: K, z });
        faces.push({ x: x - fx * 0.05, y: K + 2.25, z: z - fz * 0.05, yaw: Math.atan2(-fx, -fz) });
      }
    }
    root.add(many(own(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 5).translate(0, 1.15, 0)), steel, posts));
    root.add(many(own(new THREE.CircleGeometry(0.38, 8).rotateZ(Math.PI / 8)), own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide })), faces));
  }

  // the street names, a blade for each street at every corner
  {
    const names = [...new Set(ROADS.filter((x) => !x.dirt).map((x) => x.name))];
    const at = atlas(names, (g, eg, name, x, y) => {
      g.fillStyle = '#1d6b3f';
      g.fillRect(x, y, 512, 64);
      g.strokeStyle = '#f3f3ee';
      g.lineWidth = 3;
      g.strokeRect(x + 3, y + 3, 506, 58);
      g.fillStyle = '#f3f3ee';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let s = 34;
      g.font = `700 ${s}px Arial, sans-serif`;
      const tw = g.measureText(name).width;
      if (tw > 480) s *= 480 / tw;
      g.font = `700 ${s}px Arial, sans-serif`;
      g.fillText(name, x + 256, y + 34);
    });
    own(at.tex);
    own(at.glow);
    const posts = [];
    const blades = [];
    const roadOf = (id) => ROADS.find((x) => x.id === id);
    for (const n of NODES) {
      // on the corner to the north-east (the south-west where that's a mast's)
      const sx = n.signal ? -1 : 1;
      const k = n.signal ? 2.4 : 1.4;
      const x = n.x + sx * (n.hw + k);
      const z = n.z - sx * (n.hd + k);
      posts.push({ x, y: K, z });
      // two faces back to back, so it reads from either way
      for (const flip of [0, Math.PI]) {
        blades.push({ x, y: K + 3.05, z, yaw: flip, w: 1.9, h: 0.24, cell: names.indexOf(roadOf(n.ew).name) });
        blades.push({ x, y: K + 3.32, z, yaw: Math.PI / 2 + flip, w: 1.9, h: 0.24, cell: names.indexOf(roadOf(n.ns).name) });
      }
    }
    root.add(many(own(new THREE.CylinderGeometry(0.04, 0.045, 3.4, 5).translate(0, 1.7, 0)), steel, posts));
    const p = atlasPlanes(at, blades, { double: false });
    owned.push(p.mat, p.geo);
    root.add(p.mesh);
  }

  // bus shelters on Central, fire hydrants on the corners
  {
    const parts = mergeGeometries([
      new THREE.BoxGeometry(3.6, 0.1, 1.5).translate(0, 2.55, 0),
      new THREE.BoxGeometry(3.6, 2.0, 0.05).translate(0, 1.5, -0.68),
      new THREE.BoxGeometry(0.08, 2.5, 0.08).translate(-1.75, 1.25, 0.65),
      new THREE.BoxGeometry(0.08, 2.5, 0.08).translate(1.75, 1.25, 0.65),
      new THREE.BoxGeometry(2.2, 0.08, 0.45).translate(0, 0.48, -0.4),
    ]);
    const list = [
      [-150, -1],
      [-45, 1],
      [48, -1],
      [196, 1],
    ].map(([x, s]) => ({ x, y: K, z: s * 9.55, yaw: s < 0 ? 0 : Math.PI }));
    root.add(many(own(parts), own(new THREE.MeshStandardMaterial({ color: 0x2f6f8a, roughness: 0.4, metalness: 0.4 })), list));
    const hyd = [];
    for (const b of CITY.blocks) for (const [x, z] of [[b.kerb.x0 + 0.6, b.kerb.z0 + 1.6], [b.kerb.x1 - 0.6, b.kerb.z1 - 1.6]]) hyd.push({ x, y: K, z });
    const hg = own(mergeGeometries([new THREE.CylinderGeometry(0.15, 0.18, 0.62, 8).translate(0, 0.31, 0), new THREE.SphereGeometry(0.15, 8, 6).translate(0, 0.62, 0), new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6).rotateZ(Math.PI / 2).translate(0, 0.42, 0)]));
    root.add(many(hg, own(new THREE.MeshStandardMaterial({ color: 0xe0b520, roughness: 0.5 })), hyd));
  }

  // fountains in the plazas
  for (const f of CITY.features.filter((x) => x.kind === 'fountain')) {
    const g = new THREE.Group();
    const stone = own(new THREE.MeshStandardMaterial({ color: 0xc9b9a0, roughness: 0.8 }));
    const rim = new THREE.Mesh(own(new THREE.CylinderGeometry(3.3, 3.5, 0.55, 28, 1, true)), stone);
    rim.position.y = 0.28;
    const lip = new THREE.Mesh(own(new THREE.TorusGeometry(3.3, 0.16, 6, 28).rotateX(Math.PI / 2)), stone);
    lip.position.y = 0.56;
    const water = new THREE.Mesh(own(new THREE.CircleGeometry(3.25, 28).rotateX(-Math.PI / 2)), own(new THREE.MeshStandardMaterial({ color: 0x2f5a66, roughness: 0.05, metalness: 0.3 })));
    water.position.y = 0.42;
    const column = new THREE.Mesh(own(new THREE.CylinderGeometry(0.32, 0.5, 1.6, 12)), stone);
    column.position.y = 0.8;
    const bowl = new THREE.Mesh(own(new THREE.CylinderGeometry(1.2, 0.35, 0.4, 16)), stone);
    bowl.position.y = 1.7;
    g.add(rim, lip, water, column, bowl);
    g.position.set(f.x, K, f.z);
    root.add(g);
  }

  // the power line out along Route 66 and 4th, into the desert
  {
    const poleGeo = own(mergeGeometries([new THREE.CylinderGeometry(0.14, 0.2, 9, 6).translate(0, 4.5, 0), new THREE.BoxGeometry(2.4, 0.16, 0.16).translate(0, 8.4, 0)]));
    const runs = [];
    for (const s of [-1, 1]) {
      runs.push({ pts: Array.from({ length: 6 }, (_, i) => ({ x: s * (258 + i * 30), z: -11 })), along: 'x' });
      runs.push({ pts: Array.from({ length: 6 }, (_, i) => ({ x: 10, z: s * (198 + i * 34) })), along: 'z' });
    }
    const poles = [];
    const wire = [];
    for (const run of runs) {
      run.pts = run.pts.filter((p) => Math.hypot(p.x, p.z) < 412);
      run.pts.forEach((p, i) => {
        poles.push({ x: p.x, y: groundHeight(p.x, p.z), z: p.z, yaw: run.along === 'x' ? 0 : Math.PI / 2 });
        const q = run.pts[i + 1];
        if (!q) return;
        for (const off of [-1.05, 0, 1.05])
          for (let k = 0; k < 8; k++) {
            const a = k / 8;
            const b = (k + 1) / 8;
            const h0 = groundHeight(p.x, p.z);
            const h1 = groundHeight(q.x, q.z);
            const yA = h0 + (h1 - h0) * a + 8.5 - Math.sin(a * Math.PI) * 0.9;
            const yB = h0 + (h1 - h0) * b + 8.5 - Math.sin(b * Math.PI) * 0.9;
            const ox = run.along === 'x' ? 0 : off;
            const oz = run.along === 'x' ? off : 0;
            wire.push(p.x + (q.x - p.x) * a + ox, yA, p.z + (q.z - p.z) * a + oz, p.x + (q.x - p.x) * b + ox, yB, p.z + (q.z - p.z) * b + oz);
          }
      });
    }
    root.add(many(poleGeo, own(new THREE.MeshStandardMaterial({ color: 0x6b5440, roughness: 0.9 })), poles));
    const wg = own(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    root.add(new THREE.LineSegments(wg, own(new THREE.LineBasicMaterial({ color: 0x2b2420 }))));
  }

  // the lights' colours, by what each set of lamps is showing
  const RED = new THREE.Color(0xff2a1a);
  const AMBER = new THREE.Color(0xffa31a);
  const GREEN = new THREE.Color(0x2aff8a);
  const LAMP = [RED, AMBER, GREEN];
  const c = new THREE.Color();
  let shown = '';
  const showLights = (t) => {
    const s = signalAt(t);
    const key = `${s.ew}${s.ns}`;
    if (key === shown || !lampMesh) return;
    shown = key;
    for (const axis of ['ew', 'ns']) {
      const on = { red: 0, amber: 1, green: 2 }[s[axis]];
      for (const { i, k } of lampsBy[axis]) lampMesh.setColorAt(i, c.copy(LAMP[k]).multiplyScalar(k === on ? 1.8 : 0.07));
    }
    lampMesh.instanceColor.needsUpdate = true;
  };
  showLights(0);

  return {
    object: root,
    lamps: lampHeads,
    // t: the lights' clock; night 0..1; sky: { top, low, ground } colours for the glass to take in
    update(t, night, sky) {
      uniforms.uNight.value = night;
      if (sky) {
        uniforms.uSkyTop.value.copy(sky.top);
        uniforms.uSkyLow.value.copy(sky.low);
        uniforms.uGroundC.value.copy(sky.ground);
      }
      for (const l of lit) l.m.emissiveIntensity = l.base + night * l.k;
      showLights(t);
    },
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}

