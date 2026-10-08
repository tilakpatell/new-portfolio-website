// The desert outside Jasper, Nevada, drawn the way Transformers: Prime has
// it: red-rock mesas and buttes standing out of the sand, banded and
// eroded; the road running east to west through it with its lines; the edge
// of town to the east; the Decepticons' energon mine dug into a canyon, its
// crystals glowing blue out of the rock; the ground bridge's green vortex by
// the road; Soundwave on the rocks over the mine, his head following you;
// and Predaking (his wings beating, then gliding) and Dreadwing going over
// now and then.
//
// buildStage(area, { renderer, tier }) → Promise<{ group, update(t, dt, camera, sim), dispose }>

import * as THREE from 'three';
import { createLibrary } from '../../../../lib/cc0';
import { makeFigure, makeThing } from '../bots';
import { flyer, watcher } from './living';
import { makeSky, makeStrips, merged, platedMaterial, slab } from './common';

const VORTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float a = atan(q.y, q.x);
    float spiral = sin(a * 3.0 + log(r + 0.02) * 9.0 - uTime * 5.0);
    vec3 col = vec3(0.36, 1.0, 0.6) * (0.6 + 0.4 * spiral) * (1.2 + 2.4 * smoothstep(0.9, 0.0, r)) + vec3(1.0) * pow(smoothstep(0.5, 0.0, r), 3.0) * 2.0;
    float alpha = smoothstep(1.0, 0.92, r);
    gl_FragColor = vec4(col * alpha, alpha);
  }`;

// A mesa: a column of rock in bands, narrowing a little as it rises, its
// sides broken up so it doesn't read as a can
function mesa(s, seed) {
  const g = new THREE.CylinderGeometry(s.r * 0.86, s.r * 1.04, s.top, 14, 6);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const band = Math.sin((v.y / s.top) * 18 + seed * 7) * 0.04;
    const k = 1 + Math.sin(a * 5 + seed * 11) * 0.07 + Math.sin(a * 13 + seed * 3) * 0.04 + band;
    if (Math.abs(v.y) < s.top / 2 - 0.01) pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  g.translate(s.x, s.top / 2, s.z);
  const c = new Float32Array(pos.count * 3).fill(seed);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export async function buildStage(area, { renderer, tier = 'high' } = {}) {
  const S = area.stage;
  const B = area.bounds;
  const look = area.look;
  const group = new THREE.Group();
  const own = [];
  const keep = (x) => (own.push(x), x);

  // the sky and the sun
  const sky = makeSky('desert', { sun: look.sun.dir });
  group.add(sky);
  group.add(new THREE.HemisphereLight('#bcd4ff', '#a07850', 1.1));
  const sun = new THREE.DirectionalLight(look.sun.color, look.sun.intensity);
  sun.position.set(...look.sun.dir.map((v) => v * 600));
  sun.target.position.set(0, 0, 0);
  group.add(sun, sun.target);
  if (tier === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -160;
    sc.right = sc.top = 160;
    sc.far = 1600;
    sun.shadow.normalBias = 0.6;
  }

  // the ground, the rock and the road, from the CC0 scans where they load
  const lib = createLibrary(renderer);
  const [sand, rock, asphalt] = await Promise.all([lib.load('desert-ground'), lib.load('mesa-rock'), lib.load('asphalt-desert')]);
  const groundMat = keep(sand ? lib.material(sand, { repeat: [160, 160] }) : platedMaterial({ base: '#b27c4e', alt: '#bd885a', windows: 0, panel: [30, 30], metalness: 0, roughness: 0.95 }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(B.maxX * 2 + 1600, B.maxZ * 2 + 1600)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const rockMat = keep(rock ? lib.material(rock, { repeat: [6, 3], vertexColors: false }) : platedMaterial({ base: '#9a5a36', alt: '#ad6a40', windows: 0, panel: [14, 6], metalness: 0, roughness: 0.95 }));
  const rocks = new THREE.Mesh(keep(merged(area.solids.filter((s) => s.kind === 'circle').map((s, i) => mesa(s, (i * 0.137) % 1)))), rockMat);
  rocks.castShadow = tier === 'high';
  rocks.receiveShadow = true;
  group.add(rocks);
  // the town's buildings
  const townMat = keep(platedMaterial({ base: '#c9b49a', alt: '#a8927a', trim: '#6a5a4a', windows: 0.25, warm: '#ffd9a0', cool: '#bfe0ff', glow: 0.8, panel: [3, 3], metalness: 0, roughness: 0.85 }));
  const town = new THREE.Mesh(keep(merged(area.solids.filter((s) => s.kind === 'box').map((s, i) => slab(s.x, s.z, s.hw, s.hd, 0, s.top, s.yaw ?? 0, i / 5)))), townMat);
  group.add(town);
  // the road, with its lines
  const roadMat = keep(asphalt ? lib.material(asphalt, { repeat: [120, 2] }) : new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.9 }));
  const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(B.maxX * 2 + 1200, S.road.half * 2)), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.04;
  road.receiveShadow = true;
  group.add(road);
  const dashes = [];
  for (let x = B.minX - 600; x < B.maxX + 600; x += 14) dashes.push([x, -0.3, x + 7, -0.3, 0.06, 0.35, 0.01]);
  const lines = makeStrips(dashes, '#e8c43a', 0.9);
  group.add(lines);

  // the mine: energon crystals glowing out of the canyon's floor
  const crystals = new THREE.Group();
  group.add(crystals);
  makeThing('energon').then((e) => {
    e.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color('#3fd2ff');
        o.material.emissiveIntensity = 1.2;
        own.push(o.material);
      }
    });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const r = 20 + (k % 3) * 14;
      const c = e.clone();
      c.position.set(S.mine.x + Math.cos(a) * r, 0, S.mine.z + Math.sin(a) * r);
      c.scale.setScalar(1.4 + (k % 4) * 0.5);
      c.rotation.y = a * 3;
      crystals.add(c);
    }
  });
  const mineGlow = new THREE.PointLight('#3fd2ff', 3000, 120, 1.5);
  mineGlow.position.set(S.mine.x, 12, S.mine.z);
  group.add(mineGlow);
  // the Decepticons' rig over the pit
  const rig = new THREE.Mesh(keep(merged([slab(S.mine.x, S.mine.z, 3, 3, 0, 26, 0, 0.2), slab(S.mine.x, S.mine.z, 12, 2, 24, 27, 0.5, 0.2)])), keep(platedMaterial({ base: '#2a2630', alt: '#3a3046', trim: '#7b2fb0', windows: 0.2, warm: '#b06bff', cool: '#b06bff', panel: [3, 3] })));
  group.add(rig);

  // the ground bridge by the road
  const vu = { uTime: { value: 0 } };
  const portal = new THREE.Mesh(keep(new THREE.CircleGeometry(11, 64)), keep(new THREE.ShaderMaterial({ uniforms: vu, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: VORTEX, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
  portal.position.set(S.portal.x - 8, 11, S.portal.z);
  portal.rotation.y = Math.PI / 2;
  group.add(portal);

  // where the pod came down: a scorched crater
  const crater = new THREE.Mesh(keep(new THREE.RingGeometry(4, 16, 32)), keep(new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 1, transparent: true, opacity: 0.8 })));
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(S.pod.x, 0.05, S.pod.z);
  group.add(crater);

  // Soundwave, on top of the rocks over the mine, watching whoever comes
  let soundwave = null;
  let watch = null;
  const perch = S.watcher && area.solids.filter((s) => s.tag === 'rock').sort((a, b) => Math.hypot(a.x - S.watcher.near.x, a.z - S.watcher.near.z) - Math.hypot(b.x - S.watcher.near.x, b.z - S.watcher.near.z))[0];
  if (perch)
    makeFigure(S.watcher.kind, { seed: 11 }).then((f) => {
      soundwave = f;
      f.group.position.set(perch.x, perch.top, perch.z);
      f.group.rotation.y = Math.atan2(0 - perch.x, 0 - perch.z);
      f.play('idle');
      group.add(f.group);
      watch = watcher(f, { seed: 2 });
    });

  // what flies over: Predaking, and Dreadwing
  const flyers = [];
  for (const [i, kind] of S.flyovers.entries())
    makeThing(kind).then((m) => {
      // (a rigged one, Predaking, flies on its bones; a jet as it is)
      flyers.push({ m, i, fly: flyer(m, { seed: i + 1 }) });
      group.add(m);
    });

  return {
    group,
    floor: [ground, road], // what the area's light is baked on (lib/three/groundwork)
    update(t, dt = 1 / 60, camera, sim = null) {
      sky.userData.uniforms.uTime.value = t;
      vu.uTime.value = t;
      for (const { m, i, fly } of flyers) {
        const a = t * (0.05 + i * 0.03) + i * 2;
        m.position.set(Math.cos(a) * (500 - i * 120), 160 + i * 60, Math.sin(a) * (500 - i * 120));
        m.rotation.set(0, -a, -0.3);
        m.position.y += fly(t).lift;
      }
      mineGlow.intensity = 2600 + 500 * Math.sin(t * 2.3);
      watch?.(t, dt, sim);
    },
    dispose() {
      for (const x of own) x.dispose?.();
      soundwave?.dispose();
      lib.dispose();
    },
  };
}
