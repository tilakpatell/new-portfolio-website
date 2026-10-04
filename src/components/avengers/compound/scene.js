// The Avengers compound in 3D, for the top of the Avengers page: the same
// plan as the drawing (./plan.js), built in real materials under a real sun,
// seen through an orthographic camera set to exactly the drawing's isometric
// view, so the drawing fades into it without a jump and the pins stay where
// they are. The woods, the river and the lawn under drifting cloud shadows;
// a Quinjet that spins up on the pad, lifts off, flies out over the river and
// comes back round to land.

import * as THREE from 'three';
import { createEngine, hot } from '../hq/engine';
import { pbr, preload } from '../hq/assets';
import { instanced } from '../hq/kit/instanced';
import { logoTexture } from '../hq/kit/world';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../hq/kit/shapes';
import { createVfx } from '../hq/vfx';
import { carGeometries, carMaterials, meterBox } from '../smash/models';
import { APRON, BERM, BRIDGE, C, CLEAR, CRES, GATE, HANGAR, K, LAB, LAWN, OX, OY, PROW, RIVER, ROADS, SHORE, SPOTS, STALLS, TRAINING, TREES, VH, VW, arcPt, inPoly, onScreen, rng } from './plan';
import { U, W, apronMarks, buildQuinjet, canopyGeometry, coniferGeometry, curtainTexture, flatShape, groundPaint, leafNormal, panelNormal, prismTop, prismWalls, solarTexture } from './models';

// pixels of the drawing (720 × 480) per metre across the screen
const S = (C * K) / (U * Math.SQRT1_2);
// the sun: from the south-west, high, as the drawing has it
const SUN = new THREE.Vector3(-0.55, 1.45, 0.85).normalize();
// the ground the AO map covers, in plan units
const AO = [-150, -140, 280, 240];

// ── cloud shadows, shared by every lit material ──
const cloudU = { value: new THREE.Vector2() };
function cloudy(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCloud = cloudU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCloudPos;').replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      {
        vec4 cp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cp = instanceMatrix * cp;
        #endif
        vCloudPos = (modelMatrix * cp).xyz;
      }`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCloudPos;
        uniform vec2 uCloud;
        float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y);
        }
        float cloudShade(vec3 p) {
          // the sun comes from the south-west: a cloud's shadow falls where the sun's ray through it meets the ground
          vec2 q = p.xz * 0.0024 + uCloud;
          float n = cNoise(q) * 0.55 + cNoise(q * 2.1 + 3.7) * 0.3 + cNoise(q * 4.3 - 1.3) * 0.15;
          return 1.0 - smoothstep(0.56, 0.74, n) * 0.42;
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float cs = cloudShade(vCloudPos);
          reflectedLight.directDiffuse *= cs;
          reflectedLight.directSpecular *= cs;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'cloudy';
  return mat;
}

// A path in the plan's SVG syntax (M, L, C only) as points, every `step` units.
function samplePath(d, step = 1) {
  const tok = d.match(/[MLC]|-?\d*\.?\d+/g);
  const out = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = 'M';
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[MLC]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      out.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      const b = [num(), num()];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step));
      for (let k = 1; k <= n; k++) out.push([cur[0] + ((b[0] - cur[0]) * k) / n, cur[1] + ((b[1] - cur[1]) * k) / n]);
      cur = b;
    } else {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const b = [num(), num()];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step) * 2);
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s = 1 - t;
        out.push([s * s * s * cur[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * b[0], s * s * s * cur[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * b[1]]);
      }
      cur = b;
    }
  }
  return out;
}

// A flat ribbon along points (plan units), `w` units wide, at height y
// (metres); uv: u across, v along in metres over `tile`.
function ribbon(points, w, y, tile = 8) {
  const pos = [];
  const uv = [];
  const idx = [];
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const nx = -ty;
    const ny = tx;
    if (i) run += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) * U;
    for (const s of [-1, 1]) {
      pos.push((points[i][0] + (nx * w * s) / 2) * U, y, (points[i][1] + (ny * w * s) / 2) * U);
      uv.push((s + 1) / 2, run / tile);
    }
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // keep them facing up whichever way the path runs
  const n = g.attributes.normal;
  if (n.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// texture coordinates over the AO map, from world x and z
function withAoUv(g) {
  const p = g.attributes.position;
  const uv1 = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv1[i * 2] = (p.getX(i) / U - AO[0]) / (AO[2] - AO[0]);
    uv1[i * 2 + 1] = 1 - (p.getZ(i) / U - AO[1]) / (AO[3] - AO[1]);
  }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  return g;
}

// The ground's ambient occlusion: soft dark round everything that stands on
// it, painted once (the compound doesn't move).
function aoTexture(trees, size) {
  const [x0, y0, x1, y1] = AO;
  const k = size / (x1 - x0);
  const h = Math.round((y1 - y0) * k);
  const t = canvasTexture(
    size,
    h,
    (x) => {
      x.fillStyle = '#fff';
      x.fillRect(0, 0, size, h);
      x.save();
      x.scale(k, k);
      x.translate(-x0, -y0);
      x.shadowColor = 'rgba(0,0,0,0.75)';
      x.shadowBlur = 4 * k;
      x.fillStyle = 'rgba(0,0,0,0.55)';
      const poly = (foot) => {
        x.beginPath();
        foot.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fill();
      };
      const cres = [];
      for (let i = 0; i <= 14; i++) cres.push(arcPt(CRES.rOut, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / 14));
      for (let i = 14; i >= 0; i--) cres.push(arcPt(CRES.rIn, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / 14));
      for (const f of [HANGAR, PROW, cres, TRAINING, LAB, GATE, BERM, STALLS, APRON]) poly(f);
      x.shadowBlur = 2.5 * k;
      x.fillStyle = 'rgba(0,0,0,0.4)';
      for (const tr of trees) {
        x.beginPath();
        x.arc(tr.x, tr.y, tr.r * 0.9, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    },
    { srgb: false },
  );
  t.channel = 1;
  return t;
}

// gentle waves for the river, as a tiling normal map
function waterNormal() {
  const t = canvasTexture(
    256,
    256,
    (x, w, h) => {
      const img = x.createImageData(w, h);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const u = (i / w) * Math.PI * 2;
          const v = (j / h) * Math.PI * 2;
          const dx = Math.cos(u * 3 + v * 2) * 0.5 + Math.cos(u * 7 - v * 3) * 0.3 + Math.cos(u * 11 + v * 9) * 0.2;
          const dy = Math.sin(v * 4 + u) * 0.5 + Math.sin(v * 9 - u * 5) * 0.3 + Math.sin(v * 13 + u * 7) * 0.2;
          const k = (j * w + i) * 4;
          img.data[k] = 128 + dx * 60;
          img.data[k + 1] = 128 + dy * 60;
          img.data[k + 2] = 255;
          img.data[k + 3] = 255;
        }
      x.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: [1, 1] },
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a target face for the range
function targetTexture() {
  return canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    const rings = ['#f4f1e6', '#1d1d1d', '#2a7fd0', '#c43b2b', '#e8c03a'];
    for (let i = 0; i < 10; i++) {
      x.fillStyle = rings[Math.floor(i / 2)];
      x.beginPath();
      x.arc(c, c, c * (1 - i / 10), 0, Math.PI * 2);
      x.fill();
    }
  });
}

export async function create(canvas, { onLost, onSlow, calm = false } = {}) {
  const engine = createEngine(canvas, { exposure: 0.98, near: 1, far: 6000, bloom: { strength: 0.25, radius: 0.4, threshold: 1.2 }, onLost, onSlow });
  const { scene, sun } = engine;
  const small = engine.small;
  const sets = ['aerial-grass', 'forest-floor', 'asphalt', 'concrete-floor', 'concrete-wall', 'corrugated', 'rock', 'painted-metal'];
  await preload({ sets, skies: ['pines'], small, backgrounds: false });

  // ── the camera: the drawing's isometric view, exactly ──
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
  // screen right is (1, 0, -1)/√2 and screen up (-1, 2, -1)/√6 for a camera
  // looking down (−1, −1, −1); find the ground point at the middle of the
  // drawing, given that the plan's origin is drawn at (OX, OY)
  const dir = new THREE.Vector3(1, 1, 1).normalize(); // from the ground up to the camera
  const along = (VW / 2 - OX) / S; // target · right
  const rise = (OY - VH / 2) / S; // target · up
  const a = along * Math.SQRT2; // tx − tz
  const b = -rise * Math.sqrt(6); // tx + tz
  const target = new THREE.Vector3((a + b) / 2, 0, (b - a) / 2);
  cam.position.copy(target).addScaledVector(dir, 2500);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  engine.setCamera(cam);
  const frame = (w, h) => {
    const halfH = VH / 2 / S;
    const halfW = halfH * (w / Math.max(1, h));
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.updateProjectionMatrix();
  };
  frame(VW, VH);

  // ── light: a high summer sun from the south-west, the sky's light all round ──
  // the sky (overcast) only fills the shade; the sun does the lighting
  await engine.setSky('pines', { background: false, envIntensity: 0.2, sunDir: SUN.toArray(), sunIntensity: 3.8, sunColor: [1, 0.95, 0.86], fill: 0.13 });
  scene.background = new THREE.Color(0x2c4a2b);
  // three.js ignores a material's own envMapIntensity when it borrows the
  // scene's environment: the shiny things get the map themselves, so the
  // glass and the water can reflect more than the sky lights the rest
  const env = scene.environment;
  engine.setShadowBox(target.clone().add(new THREE.Vector3(-40, 0, -60)), small ? 380 : 420, 1400);
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  // haze over the far woods, as the drawing has at its top: the ground at the
  // top edge is about 350 m further from the camera than the middle
  scene.fog = new THREE.Fog(0xdde6e8, 2600, 3450);

  // ── where the trees are ──
  const rand = rng(11);
  const forest = [];
  for (const t of TREES) forest.push({ ...t, kind: rand() < 0.22 ? 'conifer' : 'leaf' });
  const spacing = small ? 4.6 : 3.7;
  for (let y = -140; y < 240; y += spacing)
    for (let x = -150; x < 280; x += spacing) {
      const px = x + (rand() - 0.5) * spacing * 0.9;
      const py = y + (rand() - 0.5) * spacing * 0.9;
      if (!onScreen(px, py, 60)) continue;
      if (inPoly(px, py, LAWN) || inPoly(px, py, RIVER)) continue;
      // keep clear of the lawn's edge trees a little, so the edge reads
      const r = 2.2 + rand() * 1.5;
      if (CLEAR.some(([x0, y0, x1, y1]) => px > x0 - r && px < x1 + r && py > y0 - r && py < y1 + r)) continue;
      forest.push({ x: px, y: py, r, tone: rand(), kind: rand() < 0.3 ? 'conifer' : 'leaf' });
    }

  // ── the ground ──
  const aoMap = aoTexture(forest, small ? 1024 : 2048);
  const floorMat = cloudy(await pbr('forest-floor', { repeat: [1, 1], small, roughness: 1, metalness: 0, color: 0x3f5a33 }));
  floorMat.aoMap = aoMap;
  floorMat.aoMapIntensity = 1;
  for (const t of [floorMat.map, floorMat.normalMap]) t?.repeat.set(1 / 12, 1 / 12);
  const floorGeo = withAoUv(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2).translate(target.x, -1.5, target.z));
  {
    const uv = floorGeo.attributes.uv;
    const p = floorGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);

  // the lawn, mown in stripes
  const lawnMat = cloudy(await pbr('aerial-grass', { repeat: [1, 1], small, roughness: 0.95, metalness: 0, color: 0x6c9c47, normalScale: 0.6 }));
  lawnMat.map = null; // its photo is olive: keep its relief, paint the green
  lawnMat.aoMap = aoMap;
  for (const t of [lawnMat.map, lawnMat.normalMap, lawnMat.roughnessMap]) t?.repeat.set(1 / 34, 1 / 34);
  const stripe = lawnMat.onBeforeCompile;
  lawnMat.onBeforeCompile = (sh, r) => {
    stripe(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        // mowing stripes, 12 m wide, along the plan's x
        float s = smoothstep(0.46, 0.54, abs(fract(vCloudPos.z / 24.0) - 0.5) * 2.0);
        diffuseColor.rgb *= mix(0.94, 1.045, s);
        // patches: drier here, lusher there
        float n = cNoise(vCloudPos.xz * 0.018) * 0.6 + cNoise(vCloudPos.xz * 0.07 + 7.0) * 0.4;
        diffuseColor.rgb *= mix(vec3(1.06, 1.02, 0.86), vec3(0.9, 1.04, 0.94), n);
      }`,
    );
  };
  lawnMat.customProgramCacheKey = () => 'lawn';
  const lawn = new THREE.Mesh(withAoUv(flatShape(LAWN, 0.02)), lawnMat);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // the river, its bank
  const waterN = waterNormal();
  // (it reflects the dark woods round it, so its own colour carries it: the drawing's teal)
  const water = cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x4f7c84, roughness: 0.22, metalness: 0, normalMap: waterN, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
  waterN.repeat.set(1 / 40, 1 / 40);
  const river = new THREE.Mesh(flatShape(RIVER, -0.35), water);
  river.receiveShadow = true;
  scene.add(river);
  // the bank: a strip of sand and stones, fading out into the water and the grass
  const bankTex = canvasTexture(
    64,
    8,
    (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(120,138,110,0)');
      g.addColorStop(0.25, 'rgba(176,164,128,0.9)');
      g.addColorStop(0.6, 'rgba(196,184,150,1)');
      g.addColorStop(0.85, 'rgba(150,170,160,0.6)');
      g.addColorStop(1, 'rgba(110,150,150,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    },
    { repeat: [1, 1] },
  );
  bankTex.wrapT = THREE.RepeatWrapping;
  const bankMat = cloudy(new THREE.MeshStandardMaterial({ map: bankTex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const shore = samplePath(`M${SHORE.map((p) => p.join(' ')).join(' L')}`, 1.5);
  const bank = new THREE.Mesh(
    ribbon(
      shore.map(([x, y]) => [x - 0.3, y - 0.5]),
      4.2,
      0.05,
      6,
    ),
    bankMat,
  );
  bank.receiveShadow = true;
  bank.renderOrder = 1;
  scene.add(bank);

  // the drives: concrete, with a darker kerb either side
  const roadTex = await pbr('concrete-floor', { repeat: [1, 1], small, roughness: 0.85, metalness: 0 });
  // light concrete, as the drawing has: the texture's relief, not its dark colour
  const roadMat = cloudy(new THREE.MeshStandardMaterial({ color: 0xc9ccc4, roughness: 0.85, metalness: 0, normalMap: roadTex.normalMap ?? null, normalScale: new THREE.Vector2(0.5, 0.5) }));
  roadMat.aoMap = aoMap;
  const kerbMat = cloudy(new THREE.MeshStandardMaterial({ color: 0x9a9f98, roughness: 0.9 }));
  for (const d of ROADS) {
    const pts = samplePath(d, 0.8);
    const kerb = new THREE.Mesh(ribbon(pts, 4.6, 0.12), kerbMat);
    const road = new THREE.Mesh(withAoUv(ribbon(pts, 3.7, 0.2)), roadMat);
    kerb.receiveShadow = road.receiveShadow = true;
    scene.add(kerb, road);
  }

  // what's painted on the ground: one decal each
  for (const [box, px] of [
    [[60, 42, 80, 62], 512],
    [[97, 45, 127, 63], 1024],
    [[-19, 15, -5, 65], 512],
    [[49, 96, 73, 106], 512],
  ]) {
    const { tex } = groundPaint(box, small ? px / 2 : px);
    const [x0, y0, x1, y1] = box;
    const g = new THREE.PlaneGeometry((x1 - x0) * U, (y1 - y0) * U).rotateX(-Math.PI / 2).translate(((x0 + x1) / 2) * U, 0.28, ((y0 + y1) / 2) * U);
    const m = new THREE.Mesh(g, cloudy(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ── the buildings ──
  const white = cloudy(new THREE.MeshPhysicalMaterial({ color: 0xf1f3f5, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, normalMap: panelNormal({ pw: 2, ph: 1.2 }), normalScale: new THREE.Vector2(0.7, 0.7) }));
  const hangarWall = cloudy(await pbr('corrugated', { repeat: [1, 1], small, roughness: 0.45, metalness: 0.4, color: 0xf2f4f6 }));
  const doorMat = cloudy(await pbr('corrugated', { repeat: [1, 1], small, roughness: 0.5, metalness: 0.5, color: 0xa9b1bb, rotation: Math.PI / 2 }));
  // the main building's grey: smooth panels, a little sheen
  const grey = cloudy(new THREE.MeshPhysicalMaterial({ color: 0xbcc4cd, roughness: 0.4, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.35, normalMap: panelNormal({ pw: 1.6, ph: 1.25 }), normalScale: new THREE.Vector2(0.6, 0.6) }));
  // a pale roof membrane, faintly mottled
  const roofMat = cloudy(new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.88, metalness: 0, normalMap: panelNormal({ pw: 4, ph: 4 }), normalScale: new THREE.Vector2(0.25, 0.25) }));
  const darkMetal = cloudy(new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.45, metalness: 0.8 }));
  const red = cloudy(new THREE.MeshStandardMaterial({ color: 0xb8332c, roughness: 0.55, metalness: 0.2 }));
  const earth = cloudy(await pbr('rock', { repeat: [1, 1], small: true, roughness: 1, metalness: 0, color: 0x9a8a66 }));
  const curtain = curtainTexture({ cols: 8, rows: 4, seed: 5, lit: 0.1 });
  const glass = cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, map: curtain.map, emissiveMap: curtain.emissiveMap, emissive: 0xfff0d8, emissiveIntensity: 0.3, color: 0xb9cfe6, roughness: 0.08, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 0.95 }));
  const band = curtainTexture({ cols: 12, rows: 1, seed: 9, lit: 0.08 });
  const glassBand = cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, map: band.map, emissiveMap: band.emissiveMap, emissive: 0xfff0d8, emissiveIntensity: 0.25, color: 0xb9cfe6, roughness: 0.08, metalness: 0.1, clearcoat: 0.8, envMapIntensity: 0.9 }));
  for (const t of [white.normalMap, hangarWall.map, hangarWall.normalMap, hangarWall.aoMap, doorMat.map, doorMat.normalMap, grey.normalMap, roofMat.map, roofMat.normalMap, earth.map, earth.normalMap]) if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping;

  // the buildings stand still: their parts are gathered here and merged into
  // one mesh per material (and shadow setting) when they're all made
  const statics = [];
  const add = (geo, mat, { cast = true, receive = true } = {}) => statics.push({ geo, mat, cast, receive });
  // the edge of a footprint pushed out by `d` units (for bands proud of a wall)
  const grow = (foot, d) => {
    const cx = foot.reduce((s, p) => s + p[0], 0) / foot.length;
    const cy = foot.reduce((s, p) => s + p[1], 0) / foot.length;
    return foot.map(([x, y]) => {
      const l = Math.hypot(x - cx, y - cy) || 1;
      return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d];
    });
  };
  // a box between plan corners [x0, y0]–[x1, y1], from z0 to z1 (units)
  const box = (x0, y0, x1, y1, z0, z1, mat, opts) => add(meterBox((x1 - x0) * U, (z1 - z0) * U, (y1 - y0) * U, 4).translate(((x0 + x1) / 2) * U, ((z0 + z1) / 2) * U, ((y0 + y1) / 2) * U), mat, opts);

  // the hangar: corrugated white, its door to the south, a window band to the
  // east, solar panels and the A on its roof
  add(prismWalls(HANGAR, 0, 9, 3), hangarWall);
  add(prismTop(HANGAR, 9, 8), roofMat);
  box(6, 16, 30, 16.6, 9, 9.35, white); // the parapet
  box(6, 65.4, 30, 66, 9, 9.35, white);
  box(6, 16, 6.6, 66, 9, 9.35, white);
  box(29.4, 16, 30, 66, 9, 9.35, white);
  box(9, 66, 27, 66.25, 0, 6.7, doorMat); // the door, in its frame
  box(8.6, 66, 27.4, 66.45, 6.7, 7.1, darkMetal);
  for (const xx of [8.6, 27.1]) box(xx, 66, xx + 0.3, 66.45, 0, 6.7, darkMetal);
  box(30, 17.5, 30.15, 64.5, 6.1, 7.8, glassBand); // the window band
  box(30, 18, 30.15, 36, 0.2, 4.6, glass); // offices at the north end
  const solar = cloudy(new THREE.MeshStandardMaterial({ envMap: env, map: solarTexture(), roughness: 0.25, metalness: 0.6, envMapIntensity: 1.1 }));
  for (let i = 0; i < 5; i++)
    for (const x0 of [9.5, 18.9]) {
      const g = new THREE.BoxGeometry(7.6 * U, 0.25, 4.8 * U);
      g.rotateX(-0.12);
      g.translate((x0 + 3.8) * U, 9 * U + 1.2, (19 + i * 6.6 + 2.4) * U);
      add(g, solar);
    }
  const roofLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(13 * U, 13 * U).rotateX(-Math.PI / 2),
    cloudy(new THREE.MeshStandardMaterial({ color: 0x59616b, alphaMap: logoTexture(1024), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
  );
  roofLogo.position.set(18 * U, 9 * U + 0.05, 58.2 * U);
  roofLogo.receiveShadow = true;
  scene.add(roofLogo);

  // the bridge to the main building
  add(prismWalls(BRIDGE, 4.6, 7, 4), glassBand);
  add(prismTop(BRIDGE, 7, 4), white);
  add(prismTop(BRIDGE, 4.6, 4), white);
  box(36.6, 25.6, 37.6, 26.6, 0, 4.6, grey);

  // the main building's prow: grey, banded by its floors, the A on its face
  add(prismWalls(PROW, 0, 13, 4), grey);
  add(prismTop(PROW, 13, 8), roofMat);
  for (let f = 1; f <= 10; f++) add(prismWalls(grow(PROW, 0.06), f * 1.25 - 0.05, f * 1.25 + 0.05, 4), white, { cast: false });
  add(prismWalls(grow(PROW, 0.1), 12.7, 13.4, 4), white);
  {
    // the A, brushed steel standing proud of the south face
    const [a, b] = [PROW[3], PROW[2]];
    const mid = W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 6.85);
    const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(8.4 * U, 8.4 * U), cloudy(new THREE.MeshPhysicalMaterial({ color: 0x323943, metalness: 0.9, roughness: 0.3, alphaMap: logoTexture(1024), transparent: true, depthWrite: false, clearcoat: 0.6 })));
    logo.position.copy(mid);
    logo.rotation.y = -yaw;
    logo.position.z += 0.25;
    logo.position.x += 0.02;
    scene.add(logo);
  }
  for (const [x, y] of [
    [48, 23],
    [55, 27],
  ])
    box(x, y, x + 3, y + 2.4, 13, 14.1, white);

  // the curved glass wing, banded with white slabs a little proud of the glass
  {
    const n = small ? 20 : 32;
    const foot = [];
    for (let i = 0; i <= n; i++) foot.push(arcPt(CRES.rOut, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n));
    for (let i = n; i >= 0; i--) foot.push(arcPt(CRES.rIn, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n));
    const curtainWing = cloudy(glass.clone());
    curtainWing.map = curtain.map.clone();
    curtainWing.emissiveMap = curtain.emissiveMap.clone();
    for (const t of [curtainWing.map, curtainWing.emissiveMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 12.8, 1 / 14.8); // 8 panes of 1.6 m, 4 floors of 3.7 m
      t.needsUpdate = true;
    }
    add(prismWalls(foot, 0, CRES.h, 1), curtainWing);
    add(prismTop(foot, CRES.h + 0.6, 8), roofMat);
    // the slabs: an arc of white, from inside the glass to 0.7 units out
    const slab = (z) => {
      const sh = new THREE.Shape();
      const steps = n;
      for (let i = 0; i <= steps; i++) {
        const [x, y] = arcPt(CRES.rOut + 0.7, CRES.a0 - 0.012 + ((CRES.a1 - CRES.a0 + 0.024) * i) / steps);
        if (i) sh.lineTo(x * U, -y * U);
        else sh.moveTo(x * U, -y * U);
      }
      for (let i = steps; i >= 0; i--) {
        const [x, y] = arcPt(CRES.rIn - 0.3, CRES.a0 - 0.012 + ((CRES.a1 - CRES.a0 + 0.024) * i) / steps);
        sh.lineTo(x * U, -y * U);
      }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6 * U, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, z * U, 0);
      return g;
    };
    for (const z of [0, 3.7, 7.5, 11]) add(slab(z), white);
    // fins down the glass at each bay
    const fins = [];
    for (let i = 0; i <= n; i += 2) {
      const a = CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n;
      const [x, y] = arcPt(CRES.rOut + 0.25, a);
      const g = new THREE.BoxGeometry(0.12 * U, CRES.h * U, 0.5 * U);
      g.rotateY(-a);
      g.translate(x * U, (CRES.h / 2) * U, y * U);
      fins.push(g);
    }
    for (const g of fins) add(g, white);
    // its ends, closed in white
    for (const a of [CRES.a0, CRES.a1]) {
      const [xa, ya] = arcPt(CRES.rIn, a);
      const [xb, yb] = arcPt(CRES.rOut, a);
      const len = Math.hypot(xb - xa, yb - ya) * U;
      const g = new THREE.BoxGeometry(len, (CRES.h + 0.6) * U, 0.5 * U);
      g.rotateY(-Math.atan2(yb - ya, xb - xa));
      g.translate(((xa + xb) / 2) * U, ((CRES.h + 0.6) / 2) * U, ((ya + yb) / 2) * U);
      add(g, white);
    }
    for (const k of [0.25, 0.5, 0.75]) {
      const a = CRES.a0 + (CRES.a1 - CRES.a0) * k;
      const [x, y] = arcPt((CRES.rIn + CRES.rOut) / 2, a);
      box(x - 1.6, y - 1.2, x + 1.6, y + 1.2, CRES.h + 0.6, CRES.h + 1.7, white);
    }
  }

  // the training center, the lab, the gatehouse
  add(prismWalls(TRAINING, 0, 7, 8), white);
  add(prismTop(TRAINING, 7, 8), roofMat);
  for (const [z0, z1] of [
    [1.4, 2.6],
    [4.2, 5.4],
  ])
    add(prismWalls(grow(TRAINING, 0.05), z0, z1, 1), glassBand, { cast: false });
  const clere = [
    [100, 21],
    [119, 19],
    [120, 24],
    [101, 26],
  ];
  add(prismWalls(clere, 7, 8.4, 1), glassBand);
  add(prismTop(clere, 8.4, 8), white);
  add(prismWalls(LAB, 0, 6, 8), white);
  add(prismTop(LAB, 6, 8), roofMat);
  add(prismWalls(grow(LAB, 0.05), 1.6, 3.4, 1), glassBand, { cast: false });
  for (let k = 0; k < 3; k++) {
    const f = [
      [84, 72.5 + k * 5],
      [101.5, 71 + k * 5],
      [101.7, 72.6 + k * 5],
      [84.2, 74.1 + k * 5],
    ];
    add(prismWalls(f, 6, 7.2, 1), glassBand);
    add(prismTop(f, 7.2, 8), white);
  }
  add(prismWalls(GATE, 0, 3.2, 4), white);
  add(prismTop(GATE, 3.2, 4), roofMat);
  add(prismWalls(grow(GATE, 0.05), 2.5, 3.2, 4), red);
  add(prismWalls(grow(GATE, 0.04), 0.8, 2, 1), glassBand, { cast: false });
  box(46.4, 99.6, 52, 99.9, 1, 1.25, red); // the barrier arm
  // the range: the berm behind the targets, the shooting stalls, the targets
  add(prismWalls(BERM, 0, 2.2, 4), earth);
  add(prismTop(BERM, 2.2, 4), earth);
  add(prismWalls(STALLS, 0, 3, 4), white);
  add(prismTop(STALLS, 3, 4), roofMat);
  const tMat = cloudy(new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.8 }));
  for (const x of [-16, -12, -8]) {
    add(new THREE.CylinderGeometry(1.5 * U * 0.5, 1.5 * U * 0.5, 0.3, 24).rotateX(Math.PI / 2).rotateZ(0).translate(x * U, 1.6 * U, 16.6 * U), tMat);
    box(x - 0.08, 16.5, x + 0.08, 16.7, 0, 1, darkMetal);
  }

  // the landing pad, raised, its markings
  const apronTop = await pbr('asphalt', { repeat: [1, 1], small, roughness: 0.85, metalness: 0, color: 0x5d636a });
  for (const t of [apronTop.map, apronTop.normalMap, apronTop.aoMap]) t?.repeat.set(1 / 6, 1 / 6);
  add(prismWalls(APRON, 0, 0.8, 4), cloudy(grey.clone()));
  add(prismTop(APRON, 0.8, 1), cloudy(apronTop));
  {
    const box2 = [-1, 66, 38, 99];
    const g = new THREE.PlaneGeometry(39 * U, 33 * U).rotateX(-Math.PI / 2).translate(18.5 * U, 0.8 * U + 0.06, 82.5 * U);
    const m = new THREE.Mesh(g, cloudy(new THREE.MeshStandardMaterial({ map: apronMarks(box2, small ? 512 : 1024), transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    m.receiveShadow = true;
    scene.add(m);
  }

  {
    const groups = new Map();
    for (const p of statics) {
      const key = `${p.mat.uuid}|${p.cast}|${p.receive}`;
      if (!groups.has(key)) groups.set(key, { ...p, geos: [] });
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.normal) g.computeVertexNormals();
      groups.get(key).geos.push(g);
    }
    for (const { mat, cast, receive, geos } of groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      scene.add(m);
    }
  }

  // ── cars in the car park, and two on the drive ──
  const carMats = carMaterials();
  for (const m of Object.values(carMats)) cloudy(m);
  const cars = { sedan: instanced(carGeometries('sedan'), carMats, 6), suv: instanced(carGeometries('suv'), carMats, 4) };
  for (const p of Object.values(cars)) scene.add(p.group);
  const parked = [
    ['sedan', 52.8, 99, 0xc0392b],
    ['suv', 57.2, 99, 0xf2f2f2],
    ['sedan', 63.7, 99, 0x22304a],
    ['sedan', 65.9, 103.3, 0x8a949e],
    ['suv', 53.9, 103.3, 0xf2f2f2],
  ];
  const drive = samplePath(ROADS[0], 0.5);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const CAR = 1.5; // drawn a little large, as the drawing does
  const placeCars = (t) => {
    for (const p of Object.values(cars)) p.begin();
    for (const [k, x, y, c] of parked) {
      m4.compose(W(x, y, 0.07), q.setFromEuler(new THREE.Euler(0, x > 60 ? 0 : Math.PI, 0)), v3.set(CAR, CAR, CAR));
      cars[k].set(m4, { paint: new THREE.Color(c) });
    }
    // two cars up and down the main drive
    for (const [k, off, c] of [
      ['sedan', 0, 0x1e2a44],
      ['suv', 0.5, 0x2a2e34],
    ]) {
      const f = (t / 38 + off) % 1;
      const back = f > 0.5;
      const s = back ? (1 - f) * 2 : f * 2;
      const i = Math.min(drive.length - 2, Math.floor(s * (drive.length - 1)));
      const [ax, ay] = drive[i];
      const [bx, by] = drive[i + 1];
      const side = back ? -0.9 : 0.9;
      const tx = bx - ax;
      const ty = by - ay;
      const l = Math.hypot(tx, ty) || 1;
      const yaw = Math.atan2(tx, ty) + (back ? Math.PI : 0);
      m4.compose(W(ax + (-ty / l) * side, ay + (tx / l) * side, 0.06), q.setFromEuler(new THREE.Euler(0, yaw, 0)), v3.set(CAR, CAR, CAR));
      cars[k].set(m4, { paint: new THREE.Color(c) });
    }
    for (const p of Object.values(cars)) p.end();
  };

  // ── the woods ──
  const leaf = leafNormal();
  const treeMat = cloudy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, normalMap: leaf, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.5 }));
  const sway = treeMat.onBeforeCompile;
  const windU = { value: 0 };
  treeMat.onBeforeCompile = (sh, r) => {
    sway(sh, r);
    sh.uniforms.uWind = windU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        // the crowns sway a little, each at its own pace
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3][0] * 0.013 + instanceMatrix[3][2] * 0.017;
        #endif
        float k = max(0.0, transformed.y - 0.3);
        transformed.x += sin(uWind * 1.3 + ph) * 0.03 * k;
        transformed.z += cos(uWind * 1.1 + ph * 1.3) * 0.025 * k;
      }`,
    );
  };
  treeMat.customProgramCacheKey = () => 'tree';
  const detail = small ? 1 : 2;
  const kinds = [canopyGeometry(1, detail), canopyGeometry(2.7, detail), canopyGeometry(4.1, detail), coniferGeometry()];
  const byKind = [[], [], [], []];
  forest.forEach((t, i) => byKind[t.kind === 'conifer' ? 3 : i % 3].push(t));
  const greens = [
    [0x2f5a2f, 0x3f7440],
    [0x36633a, 0x4a8247],
    [0x3d6b34, 0x56893f],
    [0x2b5233, 0x3b6c45],
  ];
  const col = new THREE.Color();
  byKind.forEach((list, k) => {
    const mesh = new THREE.InstancedMesh(kinds[k], treeMat, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    list.forEach((t, i) => {
      // a canopy t.r units in radius; conifers taller and narrower
      const r = t.r * U * (k === 3 ? 1.5 : 2.1);
      const h = k === 3 ? r * 1.9 : r * (0.85 + (t.tone % 0.3));
      m4.compose(W(t.x, t.y, 0), q.setFromEuler(new THREE.Euler(0, t.tone * 6.28, 0)), v3.set(r, h, r));
      mesh.setMatrixAt(i, m4);
      const [a, b] = greens[Math.floor(t.tone * greens.length) % greens.length];
      col.set(a).lerp(new THREE.Color(b), (t.tone * 7.3) % 1);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  });

  // ── the Quinjets: one parked, one that comes and goes ──
  const jetMats = {
    body: cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, envMapIntensity: 0.7, color: 0x5d6774, metalness: 0.65, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 })),
    panel: cloudy(new THREE.MeshStandardMaterial({ color: 0x7a8490, metalness: 0.55, roughness: 0.45 })),
    glass: new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x0f1a28, metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 }),
    dark: cloudy(new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.6, roughness: 0.5 })),
    glow: new THREE.MeshBasicMaterial({ color: hot(0x8fd8ff, 0.2), toneMapped: false }),
  };
  const JET = 1.15;
  const parkedJet = buildQuinjet(jetMats);
  parkedJet.group.scale.setScalar(JET);
  parkedJet.group.position.copy(W(12, 80, 0.8));
  parkedJet.group.rotation.y = Math.PI + (22 * Math.PI) / 180;
  scene.add(parkedJet.group);
  const flyMats = { ...jetMats, glow: new THREE.MeshBasicMaterial({ color: hot(0x8fd8ff, 0.2), toneMapped: false }) };
  const jet = buildQuinjet(flyMats);
  jet.group.scale.setScalar(JET);
  scene.add(jet.group);
  const PAD = W(26, 84, 0.8);
  const PAD_YAW = Math.PI - (14 * Math.PI) / 180;
  // out: up off the pad, round over the compound, away over the river;
  // back: in from the woods to the west, over the hangar, down onto the pad
  const outPath = new THREE.CatmullRomCurve3([W(26, 84, 10), W(34, 70, 16), W(56, 44, 26), W(92, 6, 36), W(140, -50, 46), W(210, -140, 60)]);
  const backPath = new THREE.CatmullRomCurve3([W(-170, -60, 55), W(-90, 10, 40), W(-20, 50, 26), W(10, 76, 16), W(26, 84, 10)]);
  const CYCLE = 52;
  const vfx = createVfx(scene, { calm, maxSparks: 200, maxPuffs: 160, maxDebris: 8 });
  const tangent = new THREE.Vector3();
  let yawNow = PAD_YAW;
  let lastDust = 0;
  const ease = (k) => k * k * (3 - 2 * k);
  function placeJet(t, dt) {
    const c = t % CYCLE;
    let pos;
    let yaw = PAD_YAW;
    let pitch = 0;
    let bank = 0;
    let fans = 0; // 0..1, the VTOL fans' glow
    let thrust = 0; // the engines' glow
    let gear = true;
    if (c < 4) {
      // on the pad, spinning up
      pos = PAD.clone();
      fans = c / 4;
    } else if (c < 9) {
      // straight up to ten units
      const k = ease((c - 4) / 5);
      pos = PAD.clone().lerp(outPath.getPoint(0), k);
      fans = 1;
      gear = k < 0.4;
      outPath.getTangent(0.02, tangent);
      yaw = PAD_YAW + (Math.atan2(tangent.x, tangent.z) - PAD_YAW) * k;
    } else if (c < 21) {
      // forward flight, faster and faster
      const k = (c - 9) / 12;
      const s = k * k * 0.6 + k * 0.4;
      pos = outPath.getPoint(Math.min(1, s));
      outPath.getTangent(Math.min(0.999, s), tangent);
      yaw = Math.atan2(tangent.x, tangent.z);
      pitch = -0.08 - 0.06 * k;
      fans = Math.max(0, 1 - k * 2.5);
      thrust = Math.min(1, k * 3);
      gear = false;
    } else if (c < 33) {
      // gone, beyond the trees
      pos = null;
    } else if (c < 45) {
      // in from the west, slowing
      const k = (c - 33) / 12;
      const s = 1 - (1 - k) * (1 - k);
      pos = backPath.getPoint(s);
      backPath.getTangent(Math.min(0.999, s), tangent);
      yaw = Math.atan2(tangent.x, tangent.z);
      pitch = 0.06 * k;
      fans = Math.min(1, Math.max(0, (k - 0.55) * 2.5));
      thrust = 1 - k;
      gear = k > 0.75;
    } else if (c < 50) {
      // down onto the pad, turning to face as it parks
      const k = ease((c - 45) / 5);
      pos = backPath.getPoint(1).lerp(PAD, k);
      backPath.getTangent(0.999, tangent);
      const from = Math.atan2(tangent.x, tangent.z);
      let d = PAD_YAW - from;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw = from + d * k;
      fans = 1;
    } else {
      pos = PAD.clone();
      fans = 1 - (c - 50) / 2;
    }
    jet.group.visible = !!pos;
    if (!pos) return;
    // bank into turns
    let dy = yaw - yawNow;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    bank = THREE.MathUtils.clamp((-dy / Math.max(dt, 1e-3)) * 0.35, -0.5, 0.5);
    yawNow = yaw;
    jet.group.position.copy(pos);
    jet.group.rotation.set(pitch, yaw, bank * (c > 9 && c < 45 ? 1 : 0), 'YXZ');
    jet.gear.visible = gear;
    flyMats.glow.color.copy(hot(0x8fd8ff, 0.2 + fans * 3 + thrust * 2));
    // dust off the pad and the lawn when the fans are near the ground
    const height = pos.y - PAD.y;
    if (!calm && fans > 0.5 && height < 30 && t - lastDust > 0.12) {
      lastDust = t;
      vfx.smoke(v3.set(pos.x, PAD.y + 0.5, pos.z), { size: 9, count: 2, life: 1.6, rise: 2, opacity: 0.18 * (1 - height / 30), color: 0x9a9890, to: 0xc8c6c0, spread: 6 });
    }
  }

  // ── the stones won back: a gem hanging over each building that gave one up ──
  const gemGeo = new THREE.OctahedronGeometry(1, 0).scale(0.7, 1.1, 0.7);
  const gems = new Map(); // spot id → mesh
  const setStones = (list) => {
    const want = new Set(list.map((s) => s.id));
    for (const [id, g] of gems)
      if (!want.has(id)) {
        scene.remove(g);
        gems.delete(id);
      }
    for (const { id, color } of list) {
      if (gems.has(id) || !SPOTS[id]) continue;
      const g = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 3.2, roughness: 0.2, metalness: 0.1 }));
      const [x, y, z] = SPOTS[id];
      g.position.copy(W(x + 3.2, y - 3.2, z + 3.5));
      g.scale.setScalar(5.5);
      g.userData.base = g.position.y;
      g.castShadow = true;
      scene.add(g);
      gems.set(id, g);
    }
  };

  // ── per frame ──
  let clock = 0;
  const render = (dt) => {
    const d = Math.min(0.05, dt);
    clock += d;
    cloudU.value.set(clock * 0.006, clock * -0.004);
    windU.value = clock;
    for (const t of [waterN]) t.offset.set(clock * 0.004, clock * 0.0065);
    placeJet(clock, d);
    placeCars(clock);
    for (const g of gems.values()) {
      g.rotation.y = clock * 0.8;
      g.position.y = g.userData.base + Math.sin(clock * 1.4 + g.userData.base) * 1.2;
    }
    vfx.update(d, cam, engine.size.h);
    engine.render();
  };
  placeCars(0);
  placeJet(0, 1 / 60);

  return {
    engine,
    render,
    // the first few frames: a quinjet already on its way in, for a still
    still(t = 38) {
      clock = t;
      render(1 / 60);
    },
    resize(w, h) {
      engine.resize(w, h);
      frame(w, h);
    },
    setStones,
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}

