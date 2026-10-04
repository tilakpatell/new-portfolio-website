// Rick's space cruiser, the classic one, from the driver's seat (Rick rides
// beside you, on the right). Drawn the way the show draws it: flat colour in
// two or three steps of light and a dark ink line round everything. The
// grey hood runs away in front of you with its two orange stripes and the
// headlights up on their stalks, under the bubble of the glass dome; on the
// dash, a wheel, a few big knobs, a little screen of Rick's squiggles, a
// can in the holder and a hank of wires. You're hovering over the street
// outside the Smiths' house at dusk. Going: Rick raises the portal gun and
// fires, the portal opens in the air ahead, you floor it, the houses stream
// past, the swirl fills the glass, and the green flash.
//
// The cruiser's floor is y = 0, its nose down −z; units are metres.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createMeshyCast } from '../../rickmorty/portal/meshyCast';
import { portalGun } from '../../rickmorty/portal/cast';
import { toon, toonify } from '../../rickmorty/portal/toon';
import { SWIRL_GLSL } from '../../rickmorty/swirl';
import { glowSprite, rng, roundedBox, screen, tubeAlong } from '../kit';
import { clamp01, smooth } from '../timeline';

const INK = 0x1b1424;
const EYE = [-0.36, 1.42, 0.38];
const HOVER = 3.4; // how high over the street the cruiser hangs
const PORTAL_Z = -38; // where the portal opens, ahead
const KENNEY = '/games/kenney';
const MODELS = '/games/models';

export function prefetch() {
  for (const f of ['/games/meshy/rick.glb', '/games/meshy/rick-sit.glb', '/games/meshy/rick-walk.glb', `${KENNEY}/house-a.glb`, `${KENNEY}/house-c.glb`, `${KENNEY}/house-f.glb`, `${KENNEY}/house-k.glb`, `${KENNEY}/oak.glb`])
    fetch(f).catch(() => {});
}

// The ink line: each mesh's back faces drawn flat dark, pushed out along
// the normals in view space (so `width` is in metres whatever the scale),
// skinned meshes included.
function ink(root, width, { skip = () => false } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        #ifdef USE_SKINNING
          vec3 inkN = normalize(transformedNormal);
        #else
          vec3 inkN = normalize(normalMatrix * normal);
        #endif
        mvPosition.xyz += inkN * ${width.toFixed(4)} * max(1.0, -mvPosition.z * 0.35);
        gl_Position = projectionMatrix * mvPosition;
      }`,
    );
  };
  mat.customProgramCacheKey = () => `cockpit-ink-${width}`;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink && !skip(o)) meshes.push(o);
  });
  for (const o of meshes) {
    let h;
    if (o.isSkinnedMesh) {
      h = new THREE.SkinnedMesh(o.geometry, mat);
      h.bind(o.skeleton, o.bindMatrix);
      h.bindMode = o.bindMode;
    } else h = new THREE.Mesh(o.geometry, mat);
    h.userData.ink = true;
    h.userData.shared = true; // the geometry is the mesh's own
    h.frustumCulled = false;
    h.position.copy(o.position);
    h.quaternion.copy(o.quaternion);
    h.scale.copy(o.scale);
    h.renderOrder = o.renderOrder;
    o.parent.add(h);
  }
  return mat;
}

// the show's portal on a disc: `open` grows it from a point
function portalDisc() {
  const PAD = 1.22;
  const u = { t: { value: 0 }, open: { value: 0 }, seed: { value: 3.7 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: u,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, open, seed;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * ${PAD.toFixed(2)}, t, open, seed);
        if (c.a < 0.004) discard;
        gl_FragColor = c;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat);
  return { mesh, u };
}

// a dusk sky in a few flat bands, as the show paints one, with the first stars
function duskSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uNight: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uNight;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        float h = vDir.y;
        // horizon peach, rose, violet, deep indigo: stepped, not smooth
        vec3 c = vec3(0.98, 0.72, 0.52);
        c = mix(c, vec3(0.93, 0.52, 0.55), step(0.04, h));
        c = mix(c, vec3(0.62, 0.38, 0.62), step(0.12, h));
        c = mix(c, vec3(0.32, 0.24, 0.52), step(0.24, h));
        c = mix(c, vec3(0.14, 0.12, 0.33), step(0.42, h));
        // the glow where the sun went down, behind you
        c += vec3(0.25, 0.12, 0.02) * smoothstep(0.6, 1.0, -vDir.z) * smoothstep(0.3, 0.0, h);
        // stars, up high
        vec3 g = floor(vDir * 260.0);
        float s = step(0.997, hash(g)) * smoothstep(0.18, 0.5, h);
        c += vec3(s);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  dome.renderOrder = -10;
  return dome;
}

// a model from a folder, or null
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const loadModel = (url) => loader.loadAsync(url).then((g) => g.scene).catch(() => null);

export async function build({ rich, coarse }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const r = rng(13);
  const disposers = [];

  // ── the cruiser: toon materials ──
  const M = {
    hull: toon(0xbcc4c9),
    hullDark: toon(0x939ca3),
    stripe: toon(0xf0a238),
    dash: toon(0x6b737a),
    dashTop: toon(0x585f66),
    seat: toon(0x9a6440),
    seatDark: toon(0x6e4429),
    black: toon(0x2b2b33),
    chrome: toon(0xdfe5e8),
    red: toon(0xe0453a),
    yellow: toon(0xf2d14a),
    blue: toon(0x4a8fe0),
    can: toon(0xd9d4c6),
    lamp: toon(0xfff3b0, { emissive: new THREE.Color(0xfff0a0), emissiveIntensity: 1.4 }),
    wire: [toon(0xe0453a), toon(0x3f8fd8), toon(0xf2d14a), toon(0x3a3a3a)],
  };
  Object.values(M)
    .flat()
    .forEach((m) => disposers.push(m));

  const ship = new THREE.Group();
  inside.add(ship);

  // the hood: the top front of the saucer, running away and down from the
  // rim of the cabin (you sit above it, so its ink line draws round it)
  const HOOD = { y: 0.6, rx: 2.4, ry: 0.42, rz: 2.8 };
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 36, Math.PI * 1.04, Math.PI * 0.92, 0.5, 1.25), M.hull);
  hood.scale.set(HOOD.rx, HOOD.ry, HOOD.rz);
  hood.position.set(0, HOOD.y, 0.12);
  ship.add(hood);
  // its two orange stripes, laid on it
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.006, 6, 30, Math.PI * 1.5 + sx * 0.13 - 0.04, 0.08, 0.5, 1.0), M.stripe);
    stripe.scale.copy(hood.scale);
    stripe.position.copy(hood.position);
    ship.add(stripe);
  }
  // the rim round the cabin, where the dome sits
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.065, 12, 72), M.hullDark);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.16, 1.24, 1);
  rim.position.set(0, 0.97, 0.12);
  ship.add(rim);
  // the inside of the tub, and its floor
  const tubIn = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 0.95, 0.97, 48, 1, true), toon(0x7c858c, { side: THREE.BackSide }));
  disposers.push(tubIn.material);
  tubIn.scale.set(1, 1, 1.07);
  tubIn.position.set(0, 0.485, 0.12);
  tubIn.userData.noInk = true;
  ship.add(tubIn);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), M.black);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(1, 1.1, 1);
  floor.position.set(0, 0.02, 0.12);
  floor.userData.noInk = true;
  ship.add(floor);

  // the headlights, up on their stalks at the front of the hood
  const onHood = (x, t) => {
    // a point on the hood at height angle t (0 top, π/2 the widest), x across
    const rr = Math.sin(t);
    const zz = -Math.sqrt(Math.max(0, rr * rr - (x / HOOD.rx) ** 2)) * HOOD.rz + 0.12;
    return new THREE.Vector3(x, HOOD.y + HOOD.ry * Math.cos(t), zz);
  };
  for (const sx of [-1, 1]) {
    const base = onHood(sx * 0.95, 1.3);
    const stalk = new THREE.Mesh(
      tubeAlong(
        [
          [base.x, base.y - 0.05, base.z + 0.05],
          [base.x, base.y + 0.16, base.z - 0.02],
          [base.x, base.y + 0.26, base.z - 0.16],
        ],
        0.04,
        { segs: 10, radial: 8 },
      ),
      M.hullDark,
    );
    ship.add(stalk);
    const lampCan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 20), M.hull);
    lampCan.rotation.x = Math.PI / 2;
    lampCan.position.set(base.x, base.y + 0.28, base.z - 0.26);
    ship.add(lampCan);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), M.lamp);
    lens.position.set(base.x, base.y + 0.28, base.z - 0.372);
    lens.rotation.y = Math.PI;
    lens.userData.noInk = true;
    ship.add(lens);
    const beam = glowSprite('#fff2b0', 1.1, 0.4);
    beam.position.set(base.x, base.y + 0.28, base.z - 0.5);
    ship.add(beam);
  }

  // ── the dash: a curved panel round the front of the cabin, facing you ──
  const DASH = { r: 0.98, y: 0.76, h: 0.3, z: 0.12 };
  const dash = new THREE.Mesh(new THREE.CylinderGeometry(DASH.r, DASH.r * 1.04, DASH.h, 48, 1, true, Math.PI * 0.64, Math.PI * 0.72), toon(0x6b737a, { side: THREE.BackSide }));
  disposers.push(dash.material);
  dash.position.set(0, DASH.y, DASH.z);
  dash.userData.noInk = true;
  ship.add(dash);
  const dashTop = new THREE.Mesh(new THREE.RingGeometry(0.74, DASH.r + 0.02, 48, 1, Math.PI * 1.14, Math.PI * 0.72), M.dashTop);
  dashTop.rotation.x = -Math.PI / 2;
  dashTop.position.set(0, DASH.y + DASH.h / 2 + 0.005, DASH.z);
  dashTop.userData.noInk = true;
  ship.add(dashTop);
  const dashLip = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.022, 8, 48, Math.PI * 0.72), M.black);
  dashLip.rotation.set(Math.PI / 2, 0, Math.PI * 1.14);
  dashLip.position.set(0, DASH.y + DASH.h / 2 + 0.01, DASH.z);
  ship.add(dashLip);
  // big knobs and buttons, in flat colours: `a` runs round from straight ahead
  const onDash = (a, y, inset = 0) => new THREE.Vector3(Math.sin(a) * (DASH.r - inset), y, DASH.z - Math.cos(a) * (DASH.r - inset));
  // turned to face the middle of the cabin
  const facing = (obj, y) => obj.lookAt(0, y, DASH.z);
  const knob = (mat, a, y, rad) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.12, 0.05, 20), mat);
    k.position.copy(onDash(a, y, 0.02));
    facing(k, y);
    k.rotateX(Math.PI / 2);
    ship.add(k);
    return k;
  };
  knob(M.red, 0.2, 0.79, 0.04);
  knob(M.yellow, 0.33, 0.8, 0.03);
  knob(M.blue, 0.45, 0.79, 0.034);
  knob(M.chrome, -0.62, 0.79, 0.03);
  knob(M.red, -0.72, 0.8, 0.022);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.026, 0.02), [M.red, M.yellow, M.blue][i % 3]);
    const a = 0.16 + i * 0.055;
    b.position.copy(onDash(a, 0.69, 0.01));
    facing(b, 0.69);
    ship.add(b);
  }
  // Rick's screen: squiggles, a sine, a counter
  const scr = screen(
    0.2,
    0.12,
    (g, w, h, t) => {
      g.fillStyle = '#0c2a14';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8cff6a';
      g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h * 0.5 + Math.sin(x * 0.07 + t * 5) * h * 0.18 + Math.sin(x * 0.19 - t * 9) * h * 0.06;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#8cff6a';
      g.font = `bold ${Math.round(h * 0.2)}px monospace`;
      g.fillText(`C-137 ${(Math.floor(t * 13) % 1000).toString().padStart(3, '0')}`, 8, h * 0.24);
      g.strokeStyle = '#1b1424';
      g.lineWidth = 6;
      g.strokeRect(0, 0, w, h);
    },
    { px: 192, fps: 15, glow: 1.2 },
  );
  const scrA = -0.1;
  scr.mesh.position.copy(onDash(scrA, 0.78, 0.012));
  scr.mesh.lookAt(0, 0.78, DASH.z);
  ship.add(scr.mesh);
  // a can in the holder, and a hank of wires hanging under the dash
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), M.can);
  can.position.set(0.16, 0.97, -0.6);
  ship.add(can);
  const canBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.05, 16), M.red);
  canBand.position.set(0.16, 0.97, -0.6);
  ship.add(canBand);
  for (let i = 0; i < 4; i++) {
    const x = -0.05 + i * 0.05;
    const w = new THREE.Mesh(
      tubeAlong(
        [
          [x + 0.2, 0.62, -0.78],
          [x + 0.2 + (r() - 0.5) * 0.1, 0.42, -0.66],
          [x + 0.2 + (r() - 0.5) * 0.15, 0.36, -0.52],
          [x + 0.2 + (r() - 0.5) * 0.1, 0.46, -0.4],
        ],
        0.006,
        { segs: 16, radial: 6 },
      ),
      M.wire[i],
    );
    ship.add(w);
  }

  // the wheel, before you: click it to go
  const wheel = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 40), M.black);
  wheel.add(ring);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.016), M.hullDark);
    sp.position.x = 0.075;
    const arm = new THREE.Group();
    arm.rotation.z = Math.PI / 2 + (i * Math.PI * 2) / 3;
    arm.add(sp);
    wheel.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 16), M.red);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.scale.setScalar(0.8);
  wheel.position.set(EYE[0], 0.94, -0.3);
  wheel.rotation.x = -0.85;
  ship.add(wheel);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.34, 10), M.hullDark);
  column.position.set(EYE[0], 0.86, -0.44);
  column.rotation.x = -0.85 - Math.PI / 2;
  ship.add(column);

  // the seats
  const seat = (x) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(roundedBox(0.5, 0.14, 0.5, 0.05), M.seat);
    base.position.set(0, 0.42, 0.42);
    const back = new THREE.Mesh(roundedBox(0.5, 0.62, 0.13, 0.05), M.seat);
    back.position.set(0, 0.78, 0.72);
    back.rotation.x = -0.18;
    const stitch = new THREE.Mesh(roundedBox(0.36, 0.42, 0.02, 0.01), M.seatDark);
    stitch.position.set(0, 0.8, 0.645);
    stitch.rotation.x = -0.18;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.36, 10), M.black);
    post.position.set(0, 0.18, 0.45);
    g.add(base, back, stitch, post);
    g.position.x = x;
    return g;
  };
  ship.add(seat(0.36), seat(EYE[0]));

  // ── Rick, beside you, with the portal gun ──
  const cast = createMeshyCast();
  await cast.load(null, ['rick'], { clips: ['sit', 'walk'] });
  const rick = cast.make('rick');
  let gun = null;
  if (rick) {
    rick.group.scale.setScalar(1.8 / rick.height);
    rick.group.rotation.y = Math.PI;
    for (const [n, a] of Object.entries(rick.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    rick.mixer?.update(0.01);
    ship.add(rick.group);
    // sat on his seat: his hips just above the cushion
    ship.updateMatrixWorld(true);
    const hips = rick.group.getObjectByName('Hips');
    if (hips) {
      const at = hips.getWorldPosition(new THREE.Vector3());
      ship.worldToLocal(at);
      rick.group.position.add(new THREE.Vector3(0.4, 0.62, 0.5).sub(at));
    } else rick.group.position.set(0.4, 0.35, 0.4);
    gun = portalGun();
    if (rick.hand) {
      // in his right hand, pointing out of it
      rick.hand.add(gun);
      gun.scale.setScalar(0.5 / rick.hand.getWorldScale(new THREE.Vector3()).x);
      gun.rotation.set(Math.PI / 2, 0, 0);
    } else {
      gun.scale.setScalar(0.5);
      gun.position.set(0.6, 1.0, -0.2);
      ship.add(gun);
    }
  }
  disposers.push({ dispose: () => cast.dispose() });

  // the dome: a bubble of glass, faintly cyan, white where it turns away
  const domeMat = new THREE.MeshBasicMaterial({ color: 0xc8f4f4, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  domeMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('void main() {', 'varying vec3 vV;\nvarying vec3 vN;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvV = -mvPosition.xyz;\nvN = normalize(normalMatrix * normal);');
    s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying vec3 vV;\nvarying vec3 vN;\nvoid main() {').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      diffuseColor.a = 0.05 + f * f * 0.5;`,
    );
  };
  domeMat.customProgramCacheKey = () => 'cruiser-dome';
  disposers.push(domeMat);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.scale.set(1.04, 0.95, 1.2);
  dome.position.set(0, 0.95, 0.12);
  dome.renderOrder = 10;
  ship.add(dome);
  // two highlights painted on the glass, as the show does
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  disposers.push(shine);
  for (const [a, w] of [[0.9, 0.05]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.003, 32, 4, Math.PI * 1.55 + a * 0.3, 0.6, 0.55 + w, 0.035), shine);
    s.scale.copy(dome.scale);
    s.position.copy(dome.position);
    s.renderOrder = 11;
    ship.add(s);
  }

  // ink round everything but the glass and the screen
  const inkMat = ink(ship, 0.007, { skip: (o) => o.userData.noInk || o === dome || o.material === shine || o === scr.mesh });
  disposers.push(inkMat);

  // ── light: dusk ──
  const hemi = new THREE.HemisphereLight(0xffd9e8, 0x4a4060, 1.6);
  const sun = new THREE.DirectionalLight(0xffc49a, 2.2);
  sun.position.set(1.5, 2.5, 4);
  const front = new THREE.DirectionalLight(0xc8b8ff, 0.8);
  front.position.set(-1, 2, -3);
  const green = new THREE.PointLight(0x8cff6a, 0, 30, 1.2);
  green.position.set(0, 1.4, -4);
  inside.add(hemi, sun, front, green);

  // ── outside: the street ──
  const street = new THREE.Group();
  street.position.y = -HOVER;
  outside.add(street);
  outside.add(duskSky());
  const grass = toon(0x6fae5a);
  const tar = toon(0x5a5d66);
  const walk = toon(0xc9c3b8);
  const line = toon(0xf2d14a);
  disposers.push(grass, tar, walk, line);
  const LEN = 420;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, LEN), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -LEN / 2 + 60;
  street.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, LEN), tar);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, ground.position.z);
  street.add(road);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, LEN), walk);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(sx * 6.4, 0.03, ground.position.z);
    street.add(sw);
  }
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 2.4), line, 60);
  for (let i = 0; i < 60; i++) dashes.setMatrixAt(i, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.04, 40 - i * 7));
  street.add(dashes);

  // the houses either side, and their trees and fences
  const [houses, oak, lamp] = await Promise.all([
    Promise.all(['house-a', 'house-c', 'house-f', 'house-k'].map((n) => loadModel(`${KENNEY}/${n}.glb`))),
    loadModel(`${KENNEY}/oak.glb`),
    loadModel(`${MODELS}/street-lamp.glb`),
  ]);
  const kinds = houses.filter(Boolean).map((h) => toonify(h));
  if (oak) toonify(oak);
  if (lamp) toonify(lamp);
  const SPACING = 15;
  const ROWS = coarse ? 10 : 16;
  for (let i = 0; i < ROWS; i++) {
    for (const sx of [-1, 1]) {
      const z = 30 - i * SPACING + (sx > 0 ? 6 : 0);
      if (kinds.length) {
        const h = kinds[Math.floor(r() * kinds.length)].clone();
        h.scale.setScalar(8 + r() * 1.5);
        h.position.set(sx * (17 + r() * 2), 0, z);
        h.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        street.add(h);
      }
      if (oak && r() < 0.7) {
        const tr = oak.clone();
        tr.scale.setScalar(6 + r() * 2.5);
        tr.position.set(sx * (10 + r() * 2), 0, z - 6 - r() * 3);
        tr.rotation.y = r() * Math.PI * 2;
        street.add(tr);
      }
      if (lamp && i % 2 === 0) {
        const l = lamp.clone();
        l.scale.setScalar(1.6);
        l.position.set(sx * 5.4, 0, z + 3);
        l.rotation.y = sx > 0 ? Math.PI : 0;
        street.add(l);
        const g = glowSprite('#ffe0a0', 3.2, 0.7);
        g.position.set(sx * 5.4 - sx * 0.4, 6.0, z + 3);
        street.add(g);
      }
    }
  }
  // lit windows as the evening comes on: the houses' own, a touch warmer
  street.traverse((o) => {
    if (o.isMesh && o.material?.isMeshToonMaterial && /window|glass/i.test(o.material.name ?? '')) o.material.emissive = new THREE.Color(0x553a10);
  });
  // ink on the houses, a little heavier for the distance
  if (rich) disposers.push(ink(street, 0.02, { skip: (o) => o === ground || o === road || o.isInstancedMesh || o.geometry?.type === 'PlaneGeometry' }));
  const outLight = [new THREE.HemisphereLight(0xffd9e8, 0x4a4060, 1.7), new THREE.DirectionalLight(0xffc49a, 1.8)];
  outLight[1].position.set(20, 30, 60);
  outside.add(...outLight);

  // the portal, and the shot that opens it
  const portal = portalDisc();
  portal.mesh.position.set(0, 1.4, PORTAL_Z);
  portal.mesh.visible = false;
  outside.add(portal.mesh);
  disposers.push(portal.mesh.material);
  const shot = glowSprite('#9dff6e', 0.9, 1);
  shot.visible = false;
  outside.add(shot);
  const shotFrom = new THREE.Vector3(0.6, 1.25, -0.6);

  return {
    inside,
    outside,
    eye: EYE,
    rest: [-0.06, -0.24],
    range: [1.5, 0.5],
    hfov: 90,
    vmin: 56,
    vmax: 98,
    exposure: 1.0,
    // flat colours as painted: no filmic curve
    toneMapping: THREE.NoToneMapping,
    envIntensity: 0.15,
    bloom: [0.45, 0.4, 0.86],
    flash: '#b4f36c',
    glance: -0.8, // over at Rick
    rumble: 0.6,
    triggers: [wheel],
    resize() {},
    launch() {},
    update(dt, t, { launching, t: lt, plan, throttle }) {
      scr.tick(t);
      rick?.update?.(t, 0, 0);
      // Rick: sat up, glancing over at you now and then; the gun arm up and
      // forward from the start of the launch
      if (rick) {
        rick.mixer?.update(0);
        const g = rick.group;
        const spine = g.getObjectByName('Spine01');
        const head = g.getObjectByName('Head');
        const arm = g.getObjectByName('RightArm');
        const fore = g.getObjectByName('RightForeArm');
        const up = launching ? smooth(lt / 350) : 0;
        const glance = launching ? 0 : smooth(Math.sin(t * 0.45) * 2 - 0.6);
        spine?.rotateX(-0.5);
        head?.rotateY(0.55 * glance + (launching ? -0.1 : 0));
        head?.rotateX(0.22);
        if (arm) {
          arm.rotateX(-1.25 * up);
          arm.rotateZ(0.35 * up);
        }
        fore?.rotateX(-0.35 * up);
      }
      // the shot, then the portal opening
      const fired = launching ? clamp01((lt - 300) / 420) : 0;
      shot.visible = launching && lt > 300 && lt < 760;
      if (shot.visible) shot.position.lerpVectors(shotFrom, portal.mesh.position, smooth(fired));
      const open = launching ? smooth((lt - 700) / 650) : 0;
      portal.mesh.visible = open > 0.001;
      portal.u.open.value = open;
      portal.u.t.value = t;
      const R = 5.2;
      portal.mesh.scale.set(R, R * 1.25, 1);
      // floor it: the street comes at you, the portal with it
      let travel = 0;
      if (launching && lt > plan.spool) {
        const k = clamp01((lt - plan.spool) / (plan.peak - plan.spool));
        travel = -PORTAL_Z * Math.pow(k, 2.2);
      }
      street.position.z = travel;
      // hovering: a slow bob, settling as you go
      street.position.y = -HOVER + Math.sin(t * 1.3) * 0.07 * (1 - throttle) + Math.sin(t * 0.7) * 0.03;
      portal.mesh.position.z = PORTAL_Z + travel;
      green.intensity = launching ? 30 * open * (0.3 + 0.7 * throttle) : 0;
      green.position.z = Math.min(-1.5, PORTAL_Z + travel);
    },
    dispose() {
      for (const d of disposers) d.dispose?.();
    },
  };
}
