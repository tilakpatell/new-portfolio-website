// Titan's models: Thanos (the kit's humanoid in his own build), the Infinity
// Gauntlet with hinged fingers and its six sockets, and Titan itself: the
// dusk sky with the broken moon, spires of rock, and debris hanging in the air.

import * as THREE from 'three';
import { PartBuilder, canvasTexture, lathe, limb, rbox, taper } from '../hq/kit/shapes';

// ── Thanos ──

// His joints: a head taller than the kit's 1.9 m figure and far broader
// (scaled by 1.45 in the scene, about 2.8 m).
export const THANOS_JOINTS = {
  hips: [null, 0, 1.0, 0],
  spine: ['hips', 0, 0.14, 0],
  chest: ['spine', 0, 0.22, 0],
  neck: ['chest', 0, 0.34, 0.02],
  head: ['neck', 0, 0.09, 0.01],
  shoulderL: ['chest', 0.31, 0.24, 0],
  elbowL: ['shoulderL', 0, -0.32, 0],
  handL: ['elbowL', 0, -0.29, 0],
  shoulderR: ['chest', -0.31, 0.24, 0],
  elbowR: ['shoulderR', 0, -0.32, 0],
  handR: ['elbowR', 0, -0.29, 0],
  thighL: ['hips', 0.13, -0.05, 0],
  kneeL: ['thighL', 0, -0.45, 0],
  footL: ['kneeL', 0, -0.45, 0],
  thighR: ['hips', -0.13, -0.05, 0],
  kneeR: ['thighR', 0, -0.45, 0],
  footR: ['kneeR', 0, -0.45, 0],
};

// His body, as the kit's styles are written: add(bone, material, geometry,
// placement). Materials: skin (purple), suit (the dark blue tunic), gold
// (the harness, the pauldrons, the bracer and the knee guards), dark (belt,
// boots, eyes). The left forearm and hand are the gauntlet's, made apart.
export function thanosStyle(add) {
  const ball = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
  // hips: the tunic's skirt over the trousers, a broad gold belt
  add('hips', 'suit', taper(rbox(0.52, 0.3, 0.36, 0.1), 1.06, 1), { p: [0, -0.04, 0] });
  add('hips', 'gold', taper(rbox(0.56, 0.1, 0.39, 0.035), 1, 1.02), { p: [0, 0.07, 0] });
  add('hips', 'gold', rbox(0.16, 0.12, 0.05, 0.02), { p: [0, 0.06, 0.19] });
  // the torso: a great wedge, broad at the shoulders
  add('spine', 'suit', taper(rbox(0.48, 0.3, 0.34, 0.1), 0.98, 1.12), { p: [0, 0.1, 0] });
  add('chest', 'suit', taper(rbox(0.74, 0.5, 0.44, 0.15), 0.72, 1), { p: [0, 0.2, 0] });
  for (const sd of [-1, 1]) add('chest', 'skin', taper(rbox(0.2, 0.14, 0.26, 0.06), 1, 0.7), { p: [sd * 0.15, 0.42, -0.02], r: [0, 0, sd * -0.3] }); // the trapezius
  // the gold harness: a collar; straps crossing over the back and chest
  add('chest', 'gold', new THREE.TorusGeometry(0.2, 0.04, 10, 30), { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0], s: [1.3, 1.05, 1] });
  for (const fz of [-1, 1])
    for (const sd of [-1, 1]) add('chest', 'gold', rbox(0.075, 0.62, 0.025, 0.01), { p: [0, 0.18, fz * 0.225], r: [fz * 0.04, 0, sd * 0.62] });
  add('chest', 'gold', new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2), { p: [0, 0.18, -0.24] }); // where they cross, behind
  add('chest', 'gold', new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2), { p: [0, 0.18, 0.24] });
  // the pauldrons: overlapping lames of gold over each shoulder
  for (const sd of [-1, 1])
    for (let k = 0; k < 3; k++) add('chest', 'gold', taper(rbox(0.26 - k * 0.03, 0.05, 0.34 - k * 0.03, 0.02), 1, 0.85, { axis: 'x' }), { p: [sd * (0.32 + k * 0.035), 0.39 - k * 0.06, 0], r: [0, 0, sd * (-0.45 - k * 0.12)] });
  // a thick neck, the head: bald, a heavy brow, the long ridged chin
  add('neck', 'skin', new THREE.CylinderGeometry(0.11, 0.145, 0.16, 18), { p: [0, 0.04, 0] });
  add('head', 'skin', ball(0.125, 24, 18), { p: [0, 0.14, -0.01], s: [0.94, 1.08, 1.06] });
  add('head', 'skin', taper(rbox(0.19, 0.16, 0.16, 0.05), 0.82, 1), { p: [0, 0.02, 0.035] }); // the jaw
  add('head', 'skin', rbox(0.2, 0.04, 0.06, 0.018), { p: [0, 0.155, 0.09], r: [-0.3, 0, 0] }); // brow
  for (let i = 0; i < 6; i++) add('head', 'skin', rbox(0.012, 0.075, 0.02, 0.005), { p: [-0.05 + i * 0.02, -0.035, 0.11], r: [-0.1, 0, 0] }); // the chin's ridges
  for (const sd of [-1, 1]) {
    add('head', 'dark', ball(0.012, 8, 6), { p: [sd * 0.045, 0.12, 0.105] });
    add('head', 'skin', ball(0.028, 10, 8), { p: [sd * 0.115, 0.1, 0], s: [0.5, 1, 0.8] }); // ears
  }
  // arms: bare and huge above; the right forearm in a gold bracer, the right fist
  for (const [sh, sd] of [
    ['shoulderL', 1],
    ['shoulderR', -1],
  ]) {
    add(sh, 'skin', limb(0.13, 0.36, 0.105, 18), { p: [sd * 0.01, -0.36, 0] });
    add(sh, 'skin', ball(0.105, 16, 12), { p: [0, -0.15, 0.045], s: [0.95, 1.5, 0.85] }); // biceps
    add(sh, 'skin', ball(0.1, 16, 12), { p: [0, -0.17, -0.045], s: [1, 1.55, 0.8] }); // triceps
  }
  add('elbowR', 'skin', ball(0.095, 14, 10));
  add('elbowR', 'gold', lathe([
    [0.1, -0.3],
    [0.108, -0.27],
    [0.104, -0.2],
    [0.112, -0.06],
    [0.118, -0.02],
    [0.11, 0],
  ]), { p: [0, 0, 0] });
  for (let k = 0; k < 3; k++) add('elbowR', 'dark', new THREE.TorusGeometry(0.107, 0.008, 6, 22), { p: [0, -0.07 - k * 0.07, 0], r: [Math.PI / 2, 0, 0] });
  add('handR', 'skin', rbox(0.11, 0.13, 0.1, 0.04), { p: [0, -0.07, 0.01] });
  add('handR', 'skin', rbox(0.11, 0.05, 0.06, 0.02), { p: [0, -0.12, 0.05] });
  // legs: the trousers, gold knee guards, dark boots
  for (const [th, kn, ft] of [
    ['thighL', 'kneeL', 'footL'],
    ['thighR', 'kneeR', 'footR'],
  ]) {
    add(th, 'suit', limb(0.155, 0.46, 0.12, 16), { p: [0, -0.46, 0] });
    add(kn, 'gold', taper(rbox(0.16, 0.16, 0.08, 0.03), 1, 0.8), { p: [0, 0, 0.09] });
    add(kn, 'suit', limb(0.115, 0.42, 0.09, 14), { p: [0, -0.42, 0] });
    add(kn, 'dark', taper(rbox(0.17, 0.26, 0.18, 0.05), 1.1, 0.92), { p: [0, -0.33, 0] });
    add(ft, 'dark', rbox(0.16, 0.1, 0.33, 0.04), { p: [0, -0.02, 0.06] });
  }
}

// ── the Infinity Gauntlet ──

// The stones' sockets, as the films set them: Power on the index finger's
// knuckle, Space the middle's, Reality the ring's, Soul the little finger's,
// Time on the thumb, Mind in the back of the hand.
export const SOCKETS = ['power', 'space', 'reality', 'soul', 'time', 'mind'];

// Engraving for the gauntlet's gold: scrolls and borders pressed into the
// metal, as a normal map (tiles round the cuff).
export function engravingNormal() {
  return canvasTexture(
    512,
    512,
    (x, w, h) => {
      x.fillStyle = 'rgb(128,128,255)';
      x.fillRect(0, 0, w, h);
      // a groove: dark on one side, light on the other, so it reads as cut
      const groove = (draw, lw) => {
        x.lineCap = 'round';
        x.lineJoin = 'round';
        x.lineWidth = lw;
        x.strokeStyle = 'rgb(96,110,250)';
        x.save();
        x.translate(-1.2, -1.2);
        draw();
        x.stroke();
        x.restore();
        x.strokeStyle = 'rgb(160,146,250)';
        x.save();
        x.translate(1.2, 1.2);
        draw();
        x.stroke();
        x.restore();
      };
      // borders round the tile
      groove(() => {
        x.beginPath();
        x.rect(10, 10, w - 20, h - 20);
      }, 4);
      // scrolls: spirals off a central stem
      for (let k = 0; k < 4; k++) {
        const cx = w * (k % 2 ? 0.7 : 0.3);
        const cy = h * (k < 2 ? 0.3 : 0.7);
        groove(() => {
          x.beginPath();
          for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const a = t * Math.PI * 3.2 + k;
            const r = 70 * (1 - t * 0.85);
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            if (i) x.lineTo(px, py);
            else x.moveTo(px, py);
          }
        }, 5);
      }
      groove(() => {
        x.beginPath();
        x.moveTo(w / 2, 14);
        x.bezierCurveTo(w * 0.35, h * 0.35, w * 0.65, h * 0.65, w / 2, h - 14);
      }, 6);
      // hammered: faint dimples everywhere
      let sd = 3;
      const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 500; i++) {
        const px = r() * w;
        const py = r() * h;
        const g = x.createRadialGradient(px - 2, py - 2, 0, px, py, 7);
        g.addColorStop(0, 'rgba(150,150,255,0.5)');
        g.addColorStop(1, 'rgba(128,128,255,0)');
        x.fillStyle = g;
        x.fillRect(px - 7, py - 7, 14, 14);
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
}

// The gauntlet for a left hand, built from the elbow (the origin) down the
// forearm (−y) to the wrist and fingers; the back of the hand faces +x, the
// thumb +z. Scale it with the figure. Returns { group, wrist, fingers, thumb,
// sockets: { stone: Object3D }, stones: { stone: Mesh } }.
export function buildGauntlet(mats, stoneMats) {
  const group = new THREE.Group();
  const FORE = 0.29;
  // ── the cuff: a flared sleeve of overlapping plates, engraved ──
  const cuff = new PartBuilder();
  cuff.add(
    'gold',
    lathe(
      [
        [0.118, -FORE + 0.005],
        [0.11, -FORE + 0.03],
        [0.112, -0.2],
        [0.124, -0.1],
        [0.138, -0.03],
        [0.146, 0.0],
        [0.14, 0.012],
      ],
      36,
    ),
  );
  // raised bands where the plates overlap, each with a bead
  for (const [y, r] of [
    [-0.035, 0.141],
    [-0.115, 0.127],
    [-0.195, 0.116],
    [-0.265, 0.112],
  ]) {
    cuff.add('gold', new THREE.TorusGeometry(r, 0.007, 8, 40), { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    cuff.add('dark', new THREE.TorusGeometry(r - 0.004, 0.003, 6, 40), { p: [0, y - 0.009, 0], r: [Math.PI / 2, 0, 0] });
  }
  // a keel down the back of the forearm, shield plates either side of it
  cuff.add('gold', taper(rbox(0.04, 0.24, 0.05, 0.016, 2), 1, 0.65), { p: [0.118, -0.15, 0] });
  for (const sz of [-1, 1]) {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.05, 0.06, 0.0, 0.2);
    leaf.quadraticCurveTo(-0.025, 0.08, 0, 0);
    const g = new THREE.ExtrudeGeometry(leaf, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    g.rotateZ(Math.PI); // pointing down the arm
    g.rotateY(Math.PI / 2);
    cuff.add('gold', g, { p: [0.124, -0.04, sz * 0.045], r: [0, 0, 0], s: [1, 1, sz] });
  }
  group.add(cuff.build(mats));

  // ── the hand ──
  const wrist = new THREE.Group();
  wrist.position.y = -FORE;
  group.add(wrist);
  const hand = new PartBuilder();
  // a hinge ring at the wrist
  hand.add('gold', new THREE.TorusGeometry(0.1, 0.016, 10, 32), { p: [0, -0.005, 0], r: [Math.PI / 2, 0, 0], s: [0.78, 1, 1] });
  // the back of the hand: a shield of gold, domed, pointed toward the knuckles
  const shield = new THREE.Shape();
  shield.moveTo(-0.068, 0);
  shield.bezierCurveTo(-0.075, -0.06, -0.07, -0.12, -0.062, -0.15);
  shield.lineTo(0.062, -0.15);
  shield.bezierCurveTo(0.07, -0.12, 0.075, -0.06, 0.068, 0);
  shield.quadraticCurveTo(0, 0.018, -0.068, 0);
  const shieldGeo = new THREE.ExtrudeGeometry(shield, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.009, bevelSegments: 4, curveSegments: 16 });
  // its x across the hand (z), its y down the hand, extruded out of the back (+x)
  shieldGeo.rotateY(Math.PI / 2);
  hand.add('gold', shieldGeo, { p: [0.012, -0.012, 0] });
  // under it, the hand's body and the palm
  hand.add('gold', taper(rbox(0.06, 0.15, 0.13, 0.025, 2), 1.05, 0.95), { p: [-0.005, -0.08, 0] });
  hand.add('dark', rbox(0.03, 0.13, 0.115, 0.012, 2), { p: [-0.035, -0.08, 0] });
  // filigree: raised ribs from the Mind Stone out to each knuckle
  const rib = (to) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.05, -0.075, 0), new THREE.Vector3(0.053, -0.11, to * 0.6), new THREE.Vector3(0.048, -0.145, to)), 12, 0.0035, 6, false);
  for (const z of [0.046, 0.015, -0.016, -0.046]) hand.add('gold', rib(z));
  for (const z of [0.03, -0.03]) hand.add('gold', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.05, -0.075, 0), new THREE.Vector3(0.054, -0.03, z * 1.5), new THREE.Vector3(0.046, -0.01, z * 2)), 10, 0.003, 6, false));
  wrist.add(hand.build(mats));

  const sockets = {};
  const stones = {};
  // a cut stone: a long octahedron with its table flattened
  const gem = (r) => {
    const g = new THREE.OctahedronGeometry(r, 1);
    g.scale(0.7, 1.15, 0.9);
    return g;
  };
  // a setting: a raised bezel ring, four claws, a dark well; the stone in it
  const seat = (parent, id, at, r) => {
    const sk = new THREE.Object3D();
    sk.position.copy(at);
    parent.add(sk);
    sockets[id] = sk;
    const b = new PartBuilder();
    b.add('gold', lathe([[r * 1.05, -r * 0.3], [r * 1.32, -r * 0.1], [r * 1.25, r * 0.22], [r * 1.0, r * 0.32]], 24).rotateZ(-Math.PI / 2));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.add('gold', new THREE.ConeGeometry(r * 0.16, r * 0.55, 6), { p: [r * 0.3, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95], r: [0, 0, -Math.PI / 2 + 0.6] });
    }
    b.add('dark', new THREE.CircleGeometry(r * 1.0, 20).rotateY(Math.PI / 2), { p: [r * 0.05, 0, 0] });
    sk.add(b.build(mats));
    const stone = new THREE.Mesh(gem(r), stoneMats[id]);
    stone.rotation.z = Math.PI / 2;
    stone.position.x = r * 0.45;
    stone.visible = false;
    sk.add(stone);
    stones[id] = stone;
  };
  seat(wrist, 'mind', new THREE.Vector3(0.05, -0.075, 0), 0.036);

  // ── the fingers: plated segments that bend toward the palm (−x) ──
  const fingers = {};
  const FINGERS = [
    ['index', 0.046, [0.062, 0.044, 0.036], 'power'],
    ['middle', 0.015, [0.068, 0.049, 0.038], 'space'],
    ['ring', -0.016, [0.064, 0.046, 0.036], 'reality'],
    ['pinky', -0.046, [0.052, 0.038, 0.031], 'soul'],
  ];
  const plate = (len, wdt, t) => {
    const b = new PartBuilder();
    b.add('gold', rbox(t, len, wdt, Math.min(t, wdt) * 0.45, 2), { p: [0.004, -len / 2, 0] });
    b.add('gold', rbox(t * 0.5, len * 0.8, wdt * 0.32, t * 0.2, 1), { p: [t * 0.55, -len / 2, 0] }); // its ridge
    b.add('dark', new THREE.TorusGeometry(wdt * 0.52, 0.0025, 4, 14), { r: [Math.PI / 2, 0, 0], p: [0, -len + 0.002, 0], s: [t / wdt, 1, 1] });
    return b;
  };
  for (const [name, z, lens, stone] of FINGERS) {
    let parent = wrist;
    const segs = [];
    lens.forEach((len, i) => {
      const seg = new THREE.Group();
      seg.position.set(0, i ? -lens[i - 1] : -0.155, i ? 0 : z);
      parent.add(seg);
      const wdt = 0.03 - i * 0.003;
      const b = plate(len, wdt, 0.026 - i * 0.002);
      if (i === lens.length - 1) b.add('gold', new THREE.ConeGeometry(wdt * 0.42, 0.014, 10), { p: [0.002, -len - 0.004, 0], r: [Math.PI, 0, 0] });
      seg.add(b.build(mats));
      segs.push(seg);
      parent = seg;
    });
    seat(wrist, stone, new THREE.Vector3(0.042, -0.152, z), 0.021);
    fingers[name] = segs;
  }
  // the thumb, from the front of the wrist, out and down
  const thumb = [];
  {
    let parent = wrist;
    [0.048, 0.036, 0.03].forEach((len, i) => {
      const seg = new THREE.Group();
      if (i === 0) {
        seg.position.set(-0.005, -0.045, 0.062);
        seg.rotation.set(0.75, 0, -0.25);
      } else seg.position.set(0, -[0.048, 0.036][i - 1], 0);
      parent.add(seg);
      const b = plate(len, 0.033 - i * 0.003, 0.028 - i * 0.002);
      seg.add(b.build(mats));
      thumb.push(seg);
      parent = seg;
    });
    seat(thumb[0], 'time', new THREE.Vector3(0.024, -0.022, 0), 0.02);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, wrist, fingers, thumb, sockets, stones };
}

// ── Titan ──

// The sky: dust-orange at the horizon going up to a bruised violet, the sun
// low behind its haze, and across it the broken moon's ring of debris.
export function titanSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 horizon = vec3(0.95, 0.52, 0.27);
        vec3 mid = vec3(0.56, 0.27, 0.24);
        vec3 top = vec3(0.13, 0.07, 0.13);
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
        col = mix(col, top, smoothstep(0.2, 0.75, h));
        // the sun, low and hazed
        float sd = max(0.0, dot(d, uSun));
        col += vec3(1.0, 0.72, 0.4) * pow(sd, 18.0) * 0.9 + vec3(1.0, 0.85, 0.6) * pow(sd, 400.0) * 3.0;
        // streaks of dust across the sky
        vec2 q = vec2(atan(d.z, d.x) * 3.0, h * 9.0);
        float dust = fbm(q * vec2(1.0, 2.5) + vec2(uTime * 0.01, 0.0));
        col = mix(col, col * vec3(1.08, 0.92, 0.85), smoothstep(0.45, 0.8, dust) * 0.6 * (1.0 - smoothstep(0.1, 0.6, h)));
        // the broken moon's ring: a tilted band of dust and rubble
        vec3 n = normalize(vec3(0.15, 1.0, 0.55));
        float band = abs(dot(d, n));
        float ring = smoothstep(0.08, 0.0, band) * smoothstep(-0.05, 0.12, h);
        float grit = fbm(vec2(atan(d.x, d.z) * 40.0, band * 120.0));
        col = mix(col, vec3(0.78, 0.6, 0.48) * (0.7 + grit * 0.6), ring * 0.55);
        // below the horizon, the haze over the plains
        col = mix(col, horizon * 0.8, smoothstep(0.0, -0.1, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(1500);
  mesh.renderOrder = -10;
  return { mesh, mat };
}

// A rock spire, wind-cut: a tapering, leaning column, lumpy; 1 m across at
// the base and `h` metres tall.
export function spireGeometry(seed = 1, h = 10) {
  const g = new THREE.CylinderGeometry(0.22, 0.5, h, 10, 14, false);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  const lean = Math.sin(seed * 3.1) * 0.18;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.25 * Math.sin(a * 3 + seed + y * 0.7) + 0.12 * Math.sin(a * 7 - seed * 2 + y * 1.9);
    p.setX(i, p.getX(i) * k + lean * y);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

// A chunk of rubble, for the debris in the sky and on the ground.
export function rubbleGeometry(seed = 1, detail = 1) {
  const g = new THREE.DodecahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.3 * Math.sin(v.x * 2.3 + seed) * Math.sin(v.y * 1.9 - seed) + 0.15 * Math.sin(v.z * 4.1 + seed * 2);
    v.multiplyScalar(k);
    v.y *= 0.7;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
