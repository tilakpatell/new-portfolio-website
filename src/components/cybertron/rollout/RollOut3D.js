// Roll out in WebGL: draws the simulation (./rules.js) and nothing else
// decides anything here. Built once per game: the player's rig, pools for
// traffic, Decepticons, debris, roadblocks, cubes, fire and effects, the
// stage's world (./world.js), and a chase camera. Loaded only behind the
// hardware acceleration gate.

import * as THREE from 'three';
import { canvasTexture, createStage, hot } from '../../../lib/stage3d';
import { createLibrary } from '../../../lib/cc0';
import { createModels } from '../../../lib/models';
import { houseOn } from '../../../lib/three/house';
import { createFeel, feelGroups } from '../../../lib/three/feel';
import { LOOK } from './look';
import { buildWorld, sharedSurfaces } from './world';
import { BOSS_LOOK, BREAKDOWN, KNOCKOUT, SENTRY, buildBoss, buildBumblebee, buildCar, buildJet, buildOptimus, buildVehicon, materials } from './models';
import { createRollOutCast } from './meshyCast';
import { chevronSprite, fireSprite, glowSprite, paintEnergon, paintInsignia, paintPanels, paintRim, paintTread, ringSprite, smokeSprite } from './paint';
import { ROLL, armed, bodyOf, stagesFor } from './rules';
import { localMotion } from '../game/bodies';
import { createBossBody } from './bossBody';
import { turn as easeTurn } from '../../../lib/three/gait';

const stageIds = (side) => stagesFor(side).map((s) => s.id);
// each bot's optics, and the jets that fly at you: Decepticon seekers, or
// the Autobots' Aerialbots; the flying bosses: Starscream, or Wheeljack's
// Jackhammer
const OPTICS = { optimus: 0x6fd8ff, bumblebee: 0x61c8ff, knockout: 0xff3b3b, breakdown: 0xffcc33 };
const SEEKER = { body: 0x55596a, accent: 0x5a2a86 };
const AERIALBOT = { body: 0xd9dde3, accent: 0xb3121f, accent2: 0x1f4aa8, mark: 'autobot' };
const FLYERS = { starscream: { body: 0x9aa1ad, accent: 0xc8282e, accent2: 0x2a52b8 }, wheeljack: { body: 0xe4e6ea, accent: 0x2f9e44, accent2: 0xc8102e, mark: 'autobot' } };
const TAU = Math.PI * 2;

// ── particles: one draw call per blend mode ──

class Particles {
  constructor(max, map, additive) {
    this.max = max;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 400 } },
      vertexShader: `uniform float scale; attribute float size; attribute vec4 color; varying vec4 vC;
        void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    // simulation state
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c = new Float32Array(max * 4);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.next = 0;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, gr, b, a = 1, drag = 1, grav = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.c.set([r, gr, b, a], i * 4);
    this.drag[i] = drag;
    this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = Math.min(1, this.age[i] / this.life[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= d;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt;
      this.v[i * 3 + 2] *= d;
      this.pos[i * 3] += this.v[i * 3] * dt;
      this.pos[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      this.col[i * 4] = this.c[i * 4];
      this.col[i * 4 + 1] = this.c[i * 4 + 1];
      this.col[i * 4 + 2] = this.c[i * 4 + 2];
      this.col[i * 4 + 3] = this.c[i * 4 + 3] * fade;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

// Which pooled visual stands for which simulated thing this frame.
class Assign {
  constructor(items) {
    this.items = items;
    this.map = new Map();
  }

  begin() {
    for (const it of this.items) it.seen = false;
  }

  get(ent, key) {
    let it = this.map.get(ent);
    if (!it) {
      it = this.items.find((x) => !x.ent && (key == null || x.key === key));
      if (!it) return null;
      it.ent = ent;
      this.map.set(ent, it);
    }
    it.seen = true;
    it.obj.visible = true;
    return it;
  }

  end() {
    for (const it of this.items) {
      if (!it.seen) {
        it.obj.visible = false;
        if (it.ent) this.map.delete(it.ent);
        it.ent = null;
      }
    }
  }
}

export async function createRollOut3D(canvas, { soft = false, bot = 'optimus', alive = () => true, onLost, onSlow, onProgress } = {}) {
  const stage = createStage(canvas, { soft, shadows: true, bloom: LOOK.bloom, fov: 62, near: 0.1, far: 900, onLost, onSlow });
  const { renderer, scene, camera } = stage;
  const big = !soft && renderer.capabilities.maxTextureSize >= 4096 && !(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const lib = createLibrary(renderer);
  const models = createModels();
  const cast = createRollOutCast();
  const T = (c, o) => canvasTexture(c, renderer, o);
  // stop building if the game went away while we were loading
  const progress = (k, label) => {
    if (!alive()) {
      stage.dispose();
      lib.dispose();
      models.dispose();
      cast.dispose();
      throw new Error('unmounted');
    }
    onProgress?.(k, label);
  };

  // ── materials and textures everyone uses ──
  progress(0.05, 'Painting the Autobots');
  const armourSet = await lib.load('armour');
  let panels;
  if (armourSet) panels = lib.detail(armourSet, { repeat: [1, 1] });
  else {
    const p = paintPanels({ size: 256 });
    panels = { normal: T(p.normal, { srgb: false }), rough: T(p.rough, { srgb: false }) };
  }
  const tex = {
    tread: T(paintTread(), {}),
    rim: T(paintRim(), { wrap: false }),
    autobot: T(paintInsignia('autobot', '#c8102e'), { wrap: false }),
    decepticon: T(paintInsignia('decepticon', '#8a3fd0'), { wrap: false }),
  };
  // the Decepticons' worn plate (Kaon's road surface, so no extra download there)
  const wornSet = await lib.load('plate-road');
  const M = materials(null, panels, wornSet ? lib.detail(wornSet, { repeat: [1, 1] }) : null);
  const shared = await sharedSurfaces(renderer, big, panels, lib);
  progress(0.25, 'Fetching the props');
  const [barrierModel, crateModel, barrelModel, tyreModel, rockModel] = await Promise.all(['barrier', 'crate', 'barrel', 'tyre', 'rock'].map((n) => models.load(n)));
  // the cast modelled with Meshy, where the site has it (./meshyCast.js)
  await cast.load((k) => onProgress?.(0.25 + k * 0.12, 'Rolling out the cast'));
  progress(0.37, 'Rolling out the cast');

  // ── lights that travel with you ──
  const blast = new THREE.PointLight(0xffa860, 0, 30, 2);
  scene.add(blast);
  const muzzle = new THREE.PointLight(0x7fd8ff, 0, 8, 2);
  scene.add(muzzle);
  const heads = new THREE.SpotLight(0xfff2d6, 0, 70, 0.5, 0.5, 1.4);
  scene.add(heads, heads.target);

  // ── the player ──
  let player = null;
  let playerBot = null;
  const setBot = (who) => {
    if (playerBot === who && player) return;
    if (player) {
      player.rig.dispose?.();
      scene.remove(player.group);
      player.group.traverse((o) => !o.userData.shared && o.geometry?.dispose());
    }
    player =
      cast.player(who) ??
      (who === 'bumblebee' ? buildBumblebee(M, tex) : who === 'knockout' ? buildBumblebee(M, tex, KNOCKOUT) : who === 'breakdown' ? buildVehicon(M, tex, BREAKDOWN) : buildOptimus(M, tex));
    playerBot = who;
    scene.add(player.group);
  };
  setBot(bot);
  // a shell that flickers while you can't be hurt
  const shellMat = new THREE.MeshBasicMaterial({ color: hot(0x7fd8ff, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), shellMat);
  scene.add(shell);

  // ── pools ──
  const pool = (n, make) =>
    Array.from({ length: n }, (_, i) => {
      const made = make(i);
      const obj = made.isObject3D ? made : made.group;
      obj.visible = false;
      scene.add(obj);
      const item = { obj, key: made.isObject3D ? null : (made.key ?? null), ent: null, seen: false };
      if (!made.isObject3D) Object.assign(item, made, { obj });
      return item;
    });
  progress(0.4, 'Building traffic');
  const cars = new Assign(pool(16, (i) => ({ ...buildCar(M, tex, i % 8), key: 'road', look: i % 8 })).concat(pool(10, (i) => ({ ...buildCar(M, tex, i + 2, true), key: 'hover' }))));
  // who comes at you: Vehicons and seekers for an Autobot, the Autobots'
  // sentries and Aerialbots for a Decepticon (built the first time they're needed)
  const foes = {};
  const foesFor = (side) =>
    (foes[side] ??=
      side === 'decepticon'
        ? { troopers: new Assign(pool(8, () => buildVehicon(M, tex, SENTRY))), jets: new Assign(pool(4, () => buildJet(M, { ...AERIALBOT, tex }))) }
        : { troopers: new Assign(pool(8, () => cast.vehicon() ?? buildVehicon(M, tex))), jets: new Assign(pool(4, () => cast.jet('seeker') ?? buildJet(M, { ...SEEKER, tex }))) });
  foesFor(bot === 'knockout' || bot === 'breakdown' ? 'decepticon' : 'autobot');
  let foeSide = null;

  // debris: scanned crates, barrels, tyres, a rock; scrap metal in Kaon
  const scrapMat = M.scarred(0x5a4a44, { roughness: 0.6 });
  const debrisMake = (kind) => {
    const g = new THREE.Group();
    if (kind === 0 && crateModel) {
      const s = 2.0;
      const a = models.single(crateModel, s);
      const b = models.single(crateModel, s);
      b.position.set(0.15, crateModel.size.y * s, 0.1);
      b.rotation.y = 0.5;
      const c = models.single(crateModel, s);
      c.position.set(0.1, 0, crateModel.size.z * s + 0.05);
      c.rotation.y = -0.2;
      g.add(a, b, c);
    } else if (kind === 1 && barrelModel) {
      for (const [x, z, lie] of [[-0.45, 0, false], [0.35, -0.2, false], [0, 0.5, true]]) {
        const b = models.single(barrelModel, 1.15);
        b.position.set(x, lie ? barrelModel.size.x * 0.55 : 0, z);
        if (lie) b.rotation.set(0, 0.4, Math.PI / 2);
        g.add(b);
      }
    } else if (kind === 2 && tyreModel) {
      for (let k = 0; k < 4; k++) {
        const t = models.single(tyreModel, 1.3);
        t.rotation.set(Math.PI / 2, 0, k * 0.7);
        t.position.set((k % 2) * 0.1 - 0.05, 0.1 + k * 0.24, (k % 3) * 0.05);
        g.add(t);
      }
      const lean = models.single(tyreModel, 1.3);
      lean.rotation.set(0.25, 0.3, 0);
      lean.position.set(0.75, 0, -0.1);
      g.add(lean);
    } else if (kind === 3 && rockModel) {
      const r = models.single(rockModel, 5);
      r.rotation.y = 0.8;
      g.add(r);
    } else {
      for (let k = 0; k < 6; k++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7 + (k % 3) * 0.3, 0.1, 0.8), scrapMat);
        plate.position.set((k - 2.5) * 0.22, 0.1 + k * 0.13, ((k * 37) % 5) * 0.08 - 0.15);
        plate.rotation.set(0.12 * k, k, 0.16 * (k - 2.5));
        plate.castShadow = true;
        g.add(plate);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.18), M.steel);
      beam.position.y = 0.6;
      beam.rotation.set(0, 0.5, 0.3);
      g.add(beam);
    }
    return { group: g, key: kind };
  };
  const debris = new Assign(pool(20, (i) => debrisMake(i % 5)));

  // roadblocks: a row of scanned jersey barriers with warning lamps; in Kaon,
  // a Decepticon energy fence
  const warnLamp = new THREE.MeshBasicMaterial({ color: hot(0xff7a1a, 3) });
  const fenceGlow = new THREE.MeshBasicMaterial({ color: hot(0xb070ff, 2.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const barricadeMake = (kaon) => {
    const g = new THREE.Group();
    const lamps = [];
    if (kaon) {
      for (let i = 0; i < 6; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), M.dark);
        post.position.set(-6.25 + i * 2.5, 0.7, 0);
        post.castShadow = true;
        g.add(post);
      }
      for (const y of [0.3, 0.65, 1.0]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.08, 0.06), fenceGlow);
        bar.position.y = y;
        g.add(bar);
      }
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1.1), new THREE.MeshBasicMaterial({ color: hot(0x8a40ff, 0.5), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      sheet.position.y = 0.55;
      g.add(sheet);
    } else if (barrierModel) {
      const len = barrierModel.size.x;
      const n = Math.ceil(12.8 / len);
      for (let i = 0; i < n; i++) {
        const b = models.single(barrierModel, 1);
        b.position.set(-6.4 + len / 2 + i * len, 0, (i % 2) * 0.12);
        b.rotation.y = (i % 2 ? 1 : -1) * 0.04;
        g.add(b);
        if (i % 2 === 0) {
          const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), warnLamp.clone());
          lamp.position.set(b.position.x, barrierModel.size.y + 0.08, b.position.z);
          g.add(lamp);
          lamps.push(lamp);
        }
      }
    }
    return { group: g, lamps, key: kaon ? 'kaon' : 'road' };
  };
  const barricades = new Assign(pool(3, () => barricadeMake(false)).concat(pool(3, () => barricadeMake(true))));

  // energon cubes, instanced, and the Allspark shard
  const energonTex = T(paintEnergon(), { wrap: false });
  const cubeMat = new THREE.MeshStandardMaterial({ map: energonTex, emissiveMap: energonTex, emissive: new THREE.Color(1.5, 0.65, 1.4), roughness: 0.15, metalness: 0.1 });
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), cubeMat, 160);
  cubes.frustumCulled = false;
  scene.add(cubes);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: hot(0x5fd0ff, 2.2), roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.92 });
  const shards = new Assign(pool(2, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), shardMat)));

  // shots, bolts, bombs, beams
  const shotGeo = new THREE.CapsuleGeometry(0.07, 1.4, 4, 8).rotateX(Math.PI / 2);
  const shotMat = new THREE.MeshBasicMaterial({ color: hot(0x8fe8ff, 4), toneMapped: false });
  const shotPool = pool(40, () => new THREE.Mesh(shotGeo, shotMat));
  const boltGeo = new THREE.CapsuleGeometry(0.12, 0.9, 4, 8).rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ color: hot(0xff3a5a, 3.6), toneMapped: false });
  const bigBoltMat = new THREE.MeshBasicMaterial({ color: hot(0xff8a2a, 3.2), toneMapped: false });
  const boltPool = pool(48, () => new THREE.Mesh(boltGeo, boltMat));
  const ringTex = T(ringSprite(), { wrap: false });
  const markMat = new THREE.MeshBasicMaterial({ map: ringTex, color: hot(0xff3a2a, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const markPool = pool(16, () => new THREE.Mesh(markGeo, markMat.clone()));
  const fillMat = new THREE.MeshBasicMaterial({ color: hot(0xff3a2a, 1), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const fillPool = pool(16, () => new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), fillMat));
  const bombGeo = new THREE.CapsuleGeometry(0.16, 0.5, 4, 8);
  const bombPool = pool(16, () => new THREE.Mesh(bombGeo, M.dark));
  const waveGeo = new THREE.BoxGeometry(12.6, 1, 0.35);
  const wavePool = pool(4, () => new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: hot(0xb070ff, 3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).rotateX(Math.PI / 2);
  const beamPool = pool(2, () => new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: hot(0xff6a2a, 4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  const chevTex = T(chevronSprite(), { repeat: [1, 6] });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chevTex, color: hot(0xff3a2a, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  warn.visible = false;
  scene.add(warn);

  // particles: fire, sparks and glows add up; smoke and dust don't
  const glowTex = T(glowSprite(64), { wrap: false });
  const fireTex = T(fireSprite(128), { wrap: false });
  const smokeTex = T(smokeSprite(128), { wrap: false });
  const add = new Particles(soft ? 600 : 1400, glowTex, true);
  const fire = new Particles(soft ? 200 : 420, fireTex, true);
  const smoke = new Particles(soft ? 300 : 700, smokeTex, false);
  scene.add(add.points, fire.points, smoke.points);

  // the ground bridge: a green vortex you drive into
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, k: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t, k; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float swirl = sin(a * 6.0 + r * 14.0 - t * 9.0) * 0.5 + 0.5;
        float band = sin(a * 3.0 - r * 9.0 + t * 6.0) * 0.5 + 0.5;
        vec3 c = mix(vec3(0.05, 0.55, 0.38), vec3(0.6, 1.6, 1.0), swirl * band);
        c += vec3(1.4, 2.2, 1.8) * smoothstep(0.35, 0.0, r);
        float edge = smoothstep(1.0, 0.82, r);
        gl_FragColor = vec4(c, edge * k);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(1, 48), vortexMat);
  vortex.renderOrder = 10;
  vortex.visible = false;
  scene.add(vortex);

  // ── the world for each stage, built when needed ──
  let world = null;
  let pending = null;
  const worldFor = (id) => buildWorld(id, renderer, { big, M, shared, lib, models });
  progress(0.55, 'Laying the road');
  world = await worldFor(stageIds(ROLL.bots[bot]?.side)[0]);
  world.attach(scene, stage);
  // the house look (lib/three/house): the house tone mapper on each stage's
  // own exposure (set under ACES), the shade one colour from the stage's
  // light and its HDRI. The look reads the stage's sun and sky light
  // through these two, copied from whichever stage is on; each stage keeps
  // its own fog and sky.
  const lookSun = { color: new THREE.Color(), intensity: 0 };
  const lookSky = { color: new THREE.Color(), intensity: 0 };
  const lightsOf = (w) => {
    lookSun.color.copy(w.sun.color);
    lookSun.intensity = w.sun.intensity;
    lookSky.color.copy(w.hemi.color);
    lookSky.intensity = w.hemi.intensity;
  };
  lightsOf(world);
  const house = houseOn({ renderer, scene, sun: lookSun, hemi: lookSky, env: { get texture() { return scene.environment; }, intensity: () => scene.environmentIntensity }, look: { fog: false } });
  let houseFrames = 0;
  progress(0.9, 'Warming up');
  // by stage id: the Autobots' third stage is Kaon, the Decepticons' Iacon
  const want = (id) => {
    if (!pending || pending.id !== id) {
      const old = pending;
      // one being built that's no longer wanted is freed when it's done
      old?.promise.then((w) => pending !== old && w !== world && w.dispose(scene)).catch(() => {});
      const p = { id, ready: null };
      p.promise = worldFor(id).then((w) => {
        p.ready = w;
        return w;
      });
      pending = p;
    }
    return pending;
  };
  const swapTo = (w) => {
    world.dispose(scene);
    world = w;
    world.attach(scene, stage);
    // (its exposure is set under ACES: the house's on top; its materials taken on)
    renderer.toneMappingExposure *= house.exposure;
    lightsOf(world);
    house.adopt(scene);
    pending = null;
    // the new world's shaders link in the background; the stage holds its last frame till then
    stage.precompile();
  };

  // ── the boss, built when it comes out ──
  let boss = null;
  const buildBossModel = (kind) => {
    if (boss?.kind === kind) return boss;
    if (boss) {
      boss.rig?.dispose?.();
      scene.remove(boss.group);
      boss.group.traverse((o) => !o.userData.shared && o.geometry?.dispose()); // its materials include shared ones
    }
    const m = FLYERS[kind]
      ? ((kind === 'starscream' ? cast.jet('starscream') : null) ?? buildJet(M, { ...FLYERS[kind], scale: 3.2, tex }))
      : (cast.boss(kind) ?? buildBoss(M, kind, tex));
    boss = { kind, ...m };
    scene.add(boss.group);
    house.adopt(boss.group);
    stage.precompile(boss.group); // its shaders link before it's drawn (the stage holds a frame or two)
    return boss;
  };

  // ── the camera ──
  const cam = { x: 0, y: 4, lookY: 1.5, fov: 62, shake: 0 };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const seenFx = new WeakSet();
  const seenShots = new WeakSet();
  let time = 0;
  // what your robot's body last saw, to tell what's changed (the run's
  // events are drained before a frame's drawn): the run and the rig it was,
  // your shields, whether you'd lost, the outro, when the gun arm was last
  // asked up, where you were across the road (the boss's is bossBody.js's)
  const was = { g: null, rig: null, shields: null, status: null, outro: 0, armAt: -1, x: 0, side: 0 };
  const playerLook = new THREE.Vector3();
  const bossLook = new THREE.Vector3();
  let prevMorphT = -1;
  let smokeAcc = 0;

  const burst = (x, y, z, { big: large = false, huge = false } = {}) => {
    const n = huge ? 90 : large ? 40 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const u = Math.random() * 2 - 1;
      const sp = (huge ? 14 : large ? 8 : 5) * (0.4 + Math.random());
      const r = Math.sqrt(1 - u * u);
      fire.emit(x, y, z, Math.cos(a) * r * sp, Math.abs(u) * sp * 0.8 + 1, Math.sin(a) * r * sp, 0.5 + Math.random() * (huge ? 1.2 : 0.5), huge ? 2 : 1, huge ? 6 : large ? 3.5 : 1.6, 3, 1.6, 0.8, 1, 2.5, -1);
    }
    for (let i = 0; i < n * 0.8; i++) {
      add.emit(x, y, z, (Math.random() - 0.5) * 22, Math.random() * 14, (Math.random() - 0.5) * 22, 0.4 + Math.random() * 0.5, 0.25, 0.05, 4, 2.6, 1.2, 1, 1.2, 18);
    }
    for (let i = 0; i < n * 0.6; i++) {
      smoke.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3, 1.4 + Math.random() * 1.4, 1, huge ? 9 : large ? 5 : 2.6, 0.16, 0.14, 0.13, 0.75, 0.8, -0.4);
    }
    blast.position.set(x, y + 1, z);
    blast.intensity = huge ? 400 : large ? 120 : 40;
    blast.distance = huge ? 80 : 30;
  };

  // the position in the world of a point inside the player's model
  const worldOf = (obj, x, y, z) => tmp.set(x, y, z).applyMatrix4(obj.matrixWorld);

  // the shake (lib/three/feel), from the rules' g.shake as it rises: a hit
  // is 1, ±0.25 m as it was, gone at the rules' own 2.5 a second
  const feel = createFeel({ offset: 0.25, baseFov: 62 });
  feel.set({ decay: 2.5 });
  stage.tune(feelGroups(feel));
  let lastShake = 0;
  function render(g, ms = 16, { calm = false } = {}) {
    if (stage.lost) return;
    const dt = Math.min(0.05, Math.max(0, ms / 1000));
    time += dt;
    const Z = -g.z; // world z of the player

    // the right world for the stage; the next one built while the boss fights
    const ids = stageIds(g.side);
    const id = ids[g.stage];
    if (world.id !== id) {
      const p = want(id);
      if (p.ready) swapTo(p.ready);
    } else if (g.boss && g.stage + 1 < ids.length) want(ids[g.stage + 1]);
    world.update(g, camera, time);
    const kaon = world.kind === 'kaon';
    const night = world.night;

    // ── the player ──
    setBot(g.bot);
    const P = player;
    const body = bodyOf(g);
    const steer = g.tx - g.x;
    P.group.position.set(g.x, Math.max(-6, g.y), Z);
    const robot = g.morph;
    P.group.rotation.set(g.grounded ? 0 : -g.vy * 0.025 * (1 - robot), -steer * 0.06, steer * (0.03 - robot * 0.07));
    // the robot's feet on the road it covers, its legs still in the air (a
    // Meshy robot's own run, paced by its stride; the shapes' swing by the phase)
    if (was.g !== g || was.rig !== P.rig) {
      // a run begun again (or another bot): up off the road, nothing held
      if (was.rig === P.rig) {
        P.rig.stop?.('full');
        P.rig.stop?.('upper');
      }
      Object.assign(was, { g, rig: P.rig, shields: g.shields, status: g.status, outro: g.outro, armAt: -1, x: g.x, side: 0 });
    }
    // (across the road as it changes lanes: to its right is +x, facing down the road)
    if (dt > 0) was.side += ((g.x - was.x) / dt - was.side) * (1 - Math.exp(-dt * 10));
    was.x = g.x;
    const onFeet = g.grounded && g.status === 'running';
    P.rig.animate(g.morph, g.z * 0.55, -g.z / 0.36, g.grounded ? 1 : 0.2, { dt, move: 1, speed: onFeet ? g.speed : 0, side: onFeet ? was.side : 0, air: g.grounded ? 0 : Math.max(0.05, g.y) });
    if (P.rig.clips && robot > 0.5) {
      const running = g.status === 'running';
      // hit: thrown back a moment, the legs still going; the boss beaten:
      // a fist up as the road runs on
      if (g.shields < was.shields && running) P.rig.play('hit', { layer: 'upper' });
      else if (g.outro > 0 && !(was.outro > 0) && running) P.rig.play('cheer', { layer: 'upper' });
      // the gun arm up while it fires (it always does, on its feet), and
      // back up once a hit or a cheer is done (not asked again every frame
      // if the clip can't be had)
      const up = armed(g) && running;
      const on = P.rig.playing('upper');
      if (up && !on && time - was.armAt > 0.5) {
        was.armAt = time;
        P.rig.play('aim.pistol', { layer: 'upper', loop: true });
      } else if (!up && on === 'aim.pistol') P.rig.stop('upper');
      // down: over on its back, and stays there
      if (g.status === 'lost' && was.status !== 'lost') {
        P.rig.stop('upper');
        P.rig.play('fall', { hold: true });
      }
    }
    was.shields = g.shields;
    was.status = g.status;
    was.outro = g.outro;
    P.group.visible = g.status !== 'lost' || Math.floor(time * 10) % 2 === 0;
    // flicker while you can't be hurt; glow with the shard
    const inv = g.invuln > 0 ? 0.25 + 0.25 * Math.sin(time * 30) : 0;
    const spark = g.spark > 0 ? 0.35 + 0.15 * Math.sin(time * 12) : 0;
    shell.visible = inv > 0 || spark > 0;
    if (shell.visible) {
      shell.position.set(g.x, g.y + body.h / 2, Z);
      shell.scale.set(body.hw * 2.2, body.h * 0.8, body.hl * 1.6 + 0.6);
      shellMat.opacity = Math.max(inv, spark);
      shellMat.color.copy(spark ? hot(0x7fd8ff, 1.6) : hot(0xff6a5a, 1.2));
    }
    P.eye.color.copy(hot(OPTICS[g.bot] ?? 0x6fd8ff, 2 + robot * 2));

    // transforming: a crackle of sparks and steam
    if (g.morphT >= 0 && prevMorphT < 0) {
      for (let i = 0; i < 50; i++) add.emit(g.x + (Math.random() - 0.5) * 2, g.y + Math.random() * 2.4, Z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8 + g.speed * 0.2, 0.3 + Math.random() * 0.4, 0.18, 0.04, 3, 2.4, 1.4, 1, 2, 14);
      for (let i = 0; i < 14; i++) smoke.emit(g.x + (Math.random() - 0.5) * 2, g.y + 0.5 + Math.random(), Z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.2, 2, 0.9, 0.8, 2.6, 0.7, 0.72, 0.75, 0.45, 1.2, -0.3);
    }
    prevMorphT = g.morphT;

    // exhaust, dust and the boost flame
    smokeAcc += dt;
    if (!calm && smokeAcc > 0.04 && g.status === 'running') {
      smokeAcc = 0;
      if (robot < 0.3) {
        if (g.bot === 'optimus') {
          for (const sd of [-1, 1]) {
            const p = worldOf(P.group, sd * 0.74, 1.9, -0.62);
            smoke.emit(p.x, p.y, p.z, sd * 0.3, 1.6, 6, 0.9, 0.25, 1.4, 0.18, 0.18, 0.2, g.boosting ? 0.6 : 0.35, 1.4, -0.6);
          }
        }
        if (world.kind === 'desert' && g.grounded) {
          for (const sd of [-1, 1]) smoke.emit(g.x + sd * 0.8, 0.2, Z + 1.6, sd * 1.5, 0.6, 3, 1.1, 0.6, 2.4, 0.62, 0.48, 0.34, 0.35, 1, -0.2);
        }
        if (g.boosting) {
          for (const sd of [-1, 1]) {
            const p = worldOf(P.group, sd * 0.4, 0.55, 1.8);
            fire.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 10, 0.18, 0.9, 0.2, 0.9, 1.6, 3, 1, 3);
          }
          // streaks rushing by
          for (let i = 0; i < 3; i++) add.emit(g.x + (Math.random() - 0.5) * 14, Math.random() * 4, Z - 20 - Math.random() * 10, 0, 0, g.speed * 1.8, 0.4, 0.12, 0.06, 0.8, 0.9, 1.2, 0.6, 0);
        }
      } else if (g.grounded && Math.abs(Math.sin(g.z * 0.55)) < 0.12) {
        // footfalls
        smoke.emit(g.x, 0.15, Z, 0, 0.5, 1, 0.6, 0.5, 1.4, 0.55, 0.5, 0.45, 0.25, 1, 0);
      }
    }

    // muzzle flashes for new shots
    muzzle.intensity *= 0.82;
    for (const s of g.shots) {
      if (seenShots.has(s)) continue;
      seenShots.add(s);
      add.emit(s.x, s.y, -s.z, 0, 0, 0, 0.08, 0.9, 1.6, 1.4, 2.6, 3, 1, 0);
      muzzle.position.set(s.x, s.y, -s.z);
      muzzle.intensity = 30;
    }
    shotPool.forEach((it, i) => {
      const s = g.shots[i];
      it.obj.visible = Boolean(s);
      if (!s) return;
      it.obj.position.set(s.x, s.y, -s.z);
      tmp2.set(s.vx, s.vy, -s.vz).normalize();
      it.obj.quaternion.setFromUnitVectors(tmp.set(0, 0, 1), tmp2);
    });

    // ── traffic ──
    cars.begin();
    for (const c of g.cars) {
      if (c.z > g.z + 240) break;
      if (!c.alive || c.z < g.z - 50) continue;
      const it = cars.get(c, kaon ? 'hover' : 'road');
      if (!it) continue;
      it.obj.position.set(c.x, kaon ? 0.25 + Math.sin(time * 2 + c.z) * 0.08 : 0, -c.z);
      it.obj.rotation.set(0, c.hit ? c.spin ?? 0 : c.toX != null ? (c.x - c.toX) * -0.12 : 0, 0);
      const blink = (c.blink > 0 || c.pull) && Math.floor(time * 3) % 2 === 0;
      for (const b of it.blinkers ?? []) b.visible = blink && (c.toX != null ? Math.sign(c.toX - c.x) === b.userData.side : false);
    }
    cars.end();

    // ── debris ──
    debris.begin();
    for (const d of g.debris) {
      if (d.z > g.z + 220) break;
      if (!d.alive || d.z < g.z - 20) continue;
      const it = debris.get(d, kaon ? 4 : (d.look ?? 0) % 4);
      if (!it) continue;
      it.obj.position.set(d.x, 0, -d.z);
      it.obj.rotation.y = (d.look ?? 0) * 0.9;
    }
    debris.end();

    // ── roadblocks ──
    fenceGlow.color.copy(world.id === 'iacon' ? hot(0x4fd8ff, 2.6) : hot(0xb070ff, 2.6));
    barricades.begin();
    for (const b of g.barricades) {
      if (b.z > g.z + 260) break;
      if (b.z < g.z - 30) continue;
      const it = barricades.get(b, kaon ? 'kaon' : 'road');
      if (!it) continue;
      it.obj.position.set(0, 0, -b.z);
      // smashed: knocked askew
      it.obj.children.forEach((ch, i) => {
        ch.userData.home ??= ch.position.clone();
        if (b.broken) {
          ch.position.set(ch.userData.home.x + Math.sin(i * 7.1) * 0.6, Math.max(0, ch.userData.home.y - 0.02), ch.userData.home.z - 1 - Math.abs(Math.cos(i * 3.3)) * 2);
          ch.rotation.y = Math.sin(i * 5.3) * 0.8;
        } else {
          ch.position.copy(ch.userData.home);
        }
      });
      const on = Math.floor(time * 2.5) % 2 === 0;
      for (const l of it.lamps ?? []) l.material.color.copy(on && !b.broken ? hot(0xff7a1a, 4) : hot(0x3a1a08, 1));
    }
    barricades.end();

    // ── energon and shards ──
    let ci = 0;
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const c of g.cubes) {
      if (c.z > g.z + 200) break;
      if (c.taken || c.z < g.z - 10 || ci >= 160) continue;
      q.setFromEuler(new THREE.Euler(time * 0.9 + c.z, time * 1.3 + c.x, 0.4));
      mtx.compose(tmp.set(c.x, c.y + Math.sin(time * 3 + c.z) * 0.12, -c.z), q, tmp2.set(1, 1, 1));
      cubes.setMatrixAt(ci++, mtx);
    }
    cubes.count = ci;
    cubes.instanceMatrix.needsUpdate = true;
    for (const c of g.cubes) {
      if (c.taken && !c.burst && Math.abs(c.z - g.z) < 6) {
        c.burst = true;
        for (let i = 0; i < 16; i++) add.emit(c.x, c.y, -c.z, (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6 - g.speed * 0.6, 0.45, 0.3, 0.04, 2.2, 0.8, 2, 1, 2, 4);
      }
    }
    shards.begin();
    for (const s of g.sparks) {
      if (s.taken || s.z > g.z + 200 || s.z < g.z - 10) continue;
      const it = shards.get(s);
      if (!it) continue;
      it.obj.position.set(s.x, s.y + Math.sin(time * 2) * 0.2, -s.z);
      it.obj.rotation.set(0, time * 2, 0);
      if (Math.random() < 0.3) add.emit(s.x + (Math.random() - 0.5), s.y + (Math.random() - 0.5), -s.z, 0, 1.2, 0, 0.6, 0.3, 0.05, 1.4, 2.6, 3.2, 1, 0.5);
    }
    shards.end();

    // ── Decepticons ──
    // the other side's foes, if it just changed, go
    if (foeSide !== g.side) {
      for (const f of Object.values(foes)) {
        f.troopers.begin();
        f.troopers.end();
        f.jets.begin();
        f.jets.end();
      }
      foeSide = g.side;
    }
    const { troopers: vehicons, jets } = foesFor(g.side);
    vehicons.begin();
    jets.begin();
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.kind === 'vehicon') {
        const it = vehicons.get(e);
        if (!it) continue;
        const k = e.state === 'pass' ? 0 : e.state === 'turn' ? Math.min(1, e.t / 0.7) : 1;
        // (what this one was doing last frame: a pooled body may be another Vehicon's now)
        const b = it.body?.ent === e ? it.body : (it.body = { ent: e, x: e.x, z: e.z, vx: 0, vz: 0, cool: e.cool, flash: e.flash ?? 0, state: e.state, yaw: 0, phase: 0, amount: 0 });
        if (dt > 0) {
          const ease = 1 - Math.exp(-dt * 8);
          b.vx += ((e.x - b.x) / dt - b.vx) * ease;
          b.vz += (-(e.z - b.z) / dt - b.vz) * ease;
        }
        b.x = e.x;
        b.z = e.z;
        it.obj.position.set(e.x, 0, -e.z);
        // stands up facing you, and keeps turning (slowly: a robot that size)
        // to wherever you are on the road
        const face = Math.PI + Math.atan2(Math.sin(Math.atan2(e.x - g.x, g.z - e.z) - Math.PI), Math.cos(Math.atan2(e.x - g.x, g.z - e.z) - Math.PI));
        b.yaw = easeTurn(b.yaw, k * face, dt, 3);
        it.obj.rotation.y = b.yaw;
        // its feet as it edges into your lane: a step to the side, not a slide
        const standing = e.state === 'stand';
        const m = localMotion(standing ? b.vx : 0, standing ? b.vz : 0, b.yaw + Math.PI);
        const pace = Math.hypot(m.speed, m.side);
        b.phase += pace * dt * 2.6;
        b.amount += ((standing && pace > 0.15 ? 0.25 : 0) - b.amount) * (1 - Math.exp(-dt * 6));
        it.rig.animate(k, b.phase, -e.z / 0.33, b.amount, { dt, move: Math.min(0.5, pace / 2.5), speed: m.speed, side: m.side });
        if (it.rig.clips && k > 0.5) {
          it.rig.look(standing ? playerLook.set(g.x, Math.max(0, g.y) + 1.6, -g.z) : null);
          // up on its feet: every other one squares up to you first
          if (b.state === 'turn' && standing && Math.floor(Math.abs(e.x * 3.7 + e.z)) % 2 === 0) it.rig.play('taunt', { layer: 'upper' });
          if (e.cool > b.cool + 0.05) it.rig.play('shoot', { layer: 'upper' }); // (a shot: its cooldown just went back up)
          else if ((e.flash ?? 0) > b.flash + 0.3) it.rig.play('hit', { layer: 'upper' });
        }
        b.cool = e.cool;
        b.flash = e.flash ?? 0;
        b.state = e.state;
        const flash = e.flash ?? 0;
        for (const m of it.mats) m.emissive?.setRGB(flash * 1.2, flash * 0.4, flash * 0.3);
        // headlights or visor
        it.eye.color.copy(hot(0xff2b3a, 2 + Math.sin(time * 8) * 0.8));
      } else {
        const it = jets.get(e);
        if (!it) continue;
        it.obj.position.set(e.x, e.y, -e.z);
        it.obj.rotation.set(0.08, Math.PI, Math.sin(e.t * 1.7) * 0.4);
        it.flame.color.copy(hot(0x8fc8ff, 2.4 + Math.random()));
        const flash = e.flash ?? 0;
        for (const m of it.mats) m.emissive?.setRGB(flash, flash * 0.3, flash * 0.2);
      }
    }
    vehicons.end();
    jets.end();

    // ── bolts, bombs, beams ──
    boltPool.forEach((it, i) => {
      const b = g.bolts[i];
      it.obj.visible = Boolean(b);
      if (!b) return;
      it.obj.position.set(b.x, b.y, -b.z);
      tmp2.set(b.vx, 0, -b.vz).normalize();
      it.obj.quaternion.setFromUnitVectors(tmp.set(0, 0, 1), tmp2);
      it.obj.material = b.big ? bigBoltMat : boltMat;
      it.obj.scale.setScalar(b.big ? 2.6 : 1);
      if (b.big && Math.random() < 0.6) fire.emit(b.x, b.y, -b.z, 0, 0, 0, 0.25, 1.5, 0.4, 2.4, 1, 0.4, 1, 0);
    });
    markPool.forEach((it, i) => {
      const m = g.bombs[i];
      const fill = fillPool[i];
      const bomb = bombPool[i];
      const on = Boolean(m) && !m.done && m.t < m.fuse;
      it.obj.visible = on;
      fill.obj.visible = on;
      bomb.obj.visible = on;
      if (!on) return;
      const k = m.t / m.fuse;
      it.obj.position.set(m.x, 0.04, -m.z);
      it.obj.scale.setScalar(m.r * 2.2);
      it.obj.rotation.y = time * 2;
      it.obj.material.opacity = 0.5 + 0.5 * Math.sin(time * (8 + k * 20));
      fill.obj.position.set(m.x, 0.035, -m.z);
      fill.obj.scale.setScalar(m.r * k);
      bomb.obj.position.set(m.x, 6.5 * (1 - k * k), -m.z);
    });
    for (const f of g.fx) {
      if (seenFx.has(f)) continue;
      seenFx.add(f);
      if (f.kind === 'boom') burst(f.x, f.y, -f.z, { big: f.big, huge: f.huge });
      else for (let i = 0; i < 8; i++) add.emit(f.x, f.y, -f.z, (Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10, 0.25, 0.25, 0.05, 3, 2.2, 1.2, 1, 3, 12);
    }
    blast.intensity *= Math.exp(-dt * 7);
    // the Autobots' bosses fire blue: Magnus's hammer, Optimus's ion cannon
    const blue = BOSS_LOOK[g.boss?.kind]?.mark === 'autobot';
    wavePool.forEach((it, i) => {
      const w = g.waves[i];
      it.obj.visible = Boolean(w);
      if (!w) return;
      it.obj.position.set(0, w.h / 2, -w.z);
      it.obj.scale.set(1, w.h, 1);
      it.obj.material.color.copy(blue ? hot(0x7fd0ff, 3) : w.kind === 'wave' ? hot(0xff6a2a, 3) : hot(0xb070ff, 3));
      const [wr, wg, wb] = blue ? [1, 2.2, 3.2] : w.kind === 'wave' ? [3, 1.4, 0.6] : [2, 1.2, 3];
      if (Math.random() < 0.8) add.emit((Math.random() - 0.5) * 12, Math.random() * w.h, -w.z, 0, 1, 0, 0.3, 0.6, 0.1, wr, wg, wb, 1, 1);
    });
    beamPool.forEach((it, i) => {
      const bm = g.beams[i];
      it.obj.visible = Boolean(bm) && Boolean(g.boss);
      if (!it.obj.visible) return;
      const k = bm.t / bm.life;
      const len = g.boss.dz + 40;
      it.obj.position.set(bm.x, 1.2, -(g.z + g.boss.dz) + len / 2);
      it.obj.scale.set(1.6 * (1 - k * 0.6), 1.6 * (1 - k * 0.6), len);
      it.obj.material.opacity = 1 - k;
      it.obj.material.color.copy(blue ? hot(0x6fc8ff, 4) : hot(0xff6a2a, 4));
    });
    warn.visible = Boolean(g.warn);
    if (g.warn) {
      const len = 70;
      warn.position.set(g.warn.x, 0.05, Z - len / 2 + 6);
      warn.scale.set(g.warn.w * 2, 1, len);
      warn.material.opacity = 0.35 + 0.35 * Math.sin(time * 14);
      chevTex.offset.y = -time * 1.5;
    }

    // ── the boss ──
    const B = g.boss;
    if (B) {
      const m = buildBossModel(B.kind);
      m.group.visible = true;
      const bz = -(g.z + B.dz);
      if (FLYERS[B.kind]) {
        m.group.position.set(B.x, B.y, bz);
        m.group.rotation.set(0.1, Math.PI, Math.sin(B.t * 1.3) * 0.35);
        m.flame.color.copy(hot(0x8fc8ff, 2.4 + Math.random()));
      } else {
        // its body from the run's state (bossBody.js): backward at the
        // road's pace, a taunt as it comes out, the cannon arm up at you
        // through a charge and a kick each shot, thrown back and dazed when
        // its charge breaks, over on its back when it's beaten
        m.mind ??= createBossBody({ taunt: m.taunt });
        const body = m.mind.step(dt, B, g);
        const clipped = Boolean(m.rig.clips);
        m.group.position.set(B.x, B.alive ? 0 : -B.dying * 1.5, bz);
        // (one on clips goes over on them; one of shapes tips back as it always did)
        m.group.rotation.set(B.alive || clipped ? 0 : Math.min(0.6, B.dying * 0.4), 0, 0);
        if (clipped) {
          for (const layer of body.stop) m.rig.stop(layer);
          for (const p of body.plays) m.rig.play(p.name, { layer: p.layer, loop: p.loop, hold: p.hold });
          bossLook.set(g.x, Math.max(0, g.y) + 1.6, Z);
          m.rig.look(body.look ? bossLook : null);
          m.rig.aim(body.aim, bossLook);
        }
        m.rig.animate(1, body.phase, 0, 0.6, { dt, ...body.motion });
        // charging the cannon or the optic
        const charging = B.attack && (B.attack.charge ?? 0) > B.attack.t;
        const look = BOSS_LOOK[B.kind] ?? BOSS_LOOK.megatron;
        m.glow.color.copy(hot(look.glow, charging ? 4 + Math.sin(time * 30) * 2 : 2));
        if (charging && Math.random() < 0.7) {
          const tip = m.cannonTip.getWorldPosition(tmp);
          const [cr, cg, cb] = look.mark === 'autobot' ? [1, 2.2, 3.4] : [3, 1.4, 0.8];
          add.emit(tip.x + (Math.random() - 0.5) * 3, tip.y + (Math.random() - 0.5) * 3, tip.z + (Math.random() - 0.5) * 3, 0, 0, 0, 0.3, 0.6, 0.1, cr, cg, cb, 1, 0);
        }
        m.eye.color.copy(hot(look.eye, 3 + Math.sin(time * 6)));
      }
      // a hit is a quick, dim pop, so steady fire doesn't wash the paint out
      // (the sparks say it hit); staggered, it pulses cold while every hit
      // counts double
      const fl = (B.flash ?? 0) ** 4;
      const ex = B.exposed > 0 ? 0.3 + 0.25 * Math.sin(time * 18) : 0;
      for (const mat of m.mats) mat.emissive?.setRGB(fl * 0.45 + ex * 0.15, fl * 0.18 + ex * 0.55, fl * 0.12 + ex * 0.9);
      if (!B.alive && Math.random() < 0.5) burst(B.x + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, bz + (Math.random() - 0.5) * 3, { big: true });
    } else if (boss) boss.group.visible = false;

    // ── the ground bridge ──
    if (g.bridge > 0) {
      const k = 1 - g.bridge / ROLL.bridgeTime;
      vortex.visible = true;
      vortexMat.uniforms.t.value = time;
      const grow = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5;
      vortexMat.uniforms.k.value = Math.min(1, grow * 1.6);
      const d = 8;
      vortex.position.copy(camera.position).add(tmp.set(0, 0, -d).applyQuaternion(camera.quaternion));
      vortex.quaternion.copy(camera.quaternion);
      vortex.scale.setScalar(1 + grow * 9);
    } else vortex.visible = false;

    // headlights at night
    heads.intensity = night && robot < 0.5 ? 120 * (1 - robot * 2) : 0;
    heads.position.set(g.x, 1, Z - 1.6);
    heads.target.position.set(g.x + steer * 0.5, 0, Z - 30);

    // ── particles ──
    add.update(dt);
    fire.update(dt);
    smoke.update(dt);

    // ── the camera: behind and above, a little to the side you steer ──
    const ease = 1 - Math.exp(-dt * 5);
    cam.x += (g.x * 0.82 - cam.x) * ease;
    const wantY = 3.1 + robot * 0.9 + Math.max(0, g.y) * 0.55 + (g.boss ? 0.8 : 0);
    cam.y += (wantY - cam.y) * ease;
    cam.lookY += (1.3 + robot * 0.8 + Math.max(0, g.y) * 0.4 - cam.lookY) * ease;
    // keep the road's width in view whatever the screen's shape: a tall phone
    // gets a taller field of view and a camera further back
    const portrait = Math.max(0, Math.min(1, (1.25 - camera.aspect) / 0.6));
    const base = 2 * Math.atan(Math.tan((70 * Math.PI) / 360) / Math.max(0.5, camera.aspect)) * (180 / Math.PI);
    const fovWant = Math.min(92, Math.max(62, base)) + (calm ? 0 : (g.boosting ? 10 : 0) + Math.min(6, Math.max(0, g.speed - g.vehicleSpeed) * 0.4));
    cam.fov += (fovWant - cam.fov) * ease;
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
    if (g.shake > lastShake + 1e-6) feel.trauma(g.shake - lastShake);
    lastShake = g.shake;
    camera.position.set(cam.x * (1 - portrait * 0.4), cam.y + portrait * 1.6, Z + 7.4 + (g.boss ? 1.5 : 0) + robot * 0.6 + portrait * 2.5);
    camera.lookAt(g.x * 0.6, cam.lookY, Z - 14);
    camera.rotateZ(-steer * 0.018);
    feel.setBaseFov(camera.fov);
    if (!calm) feel.update(dt, camera);

    // particle size follows the viewport
    const scale = stage.size.h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    add.mat.uniforms.scale.value = scale;
    fire.mat.uniforms.scale.value = scale;
    smoke.mat.uniforms.scale.value = scale;

    lightsOf(world);
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    stage.render(ms);
  }

  // Every material's shader (and the passes'), linked in the background before
  // play (lib/stage3d's precompile), so neither the first frame nor the run stalls.
  await stage.precompile();
  progress(1, 'Ready');

  // where a point in the world is on screen, in CSS pixels
  const project = (x, y, z) => {
    tmp.set(x, y, -z).project(camera);
    return [((tmp.x + 1) / 2) * stage.size.w, ((1 - tmp.y) / 2) * stage.size.h, tmp.z < 1];
  };

  const dispose = () => {
    world?.dispose(scene);
    pending?.promise.then((w) => w.dispose(scene)).catch(() => {});
    stage.dispose();
    lib.dispose();
    models.dispose();
    cast.dispose();
  };

  return {
    render,
    resize: stage.resize,
    project,
    dispose,
    setBot,
    get lost() {
      return stage.lost;
    },
    get quality() {
      return stage.quality;
    },
    get loadingStage() {
      return pending != null && !pending.ready && world.id !== pending.id;
    },
    debug: () => { const c = renderer.getContext(); return { size: stage.size, canvas: [canvas.width, canvas.height], viewport: renderer.getViewport(new THREE.Vector4()).toArray(), glViewport: Array.from(c.getParameter(c.VIEWPORT)), drawing: [c.drawingBufferWidth, c.drawingBufferHeight], quality: stage.quality }; },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, quality: stage.quality }),
    scene,
    stage,
    landUniforms: () => {
      let u = null;
      scene.traverse((o) => {
        if (o.material?.userData?.uniforms?.uRock) u = o.material.userData.uniforms;
      });
      return u;
    },
    // what's drawn, heaviest first: triangles times instances
    weigh: () => {
      const rows = [];
      scene.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry) return;
        const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        const n = o.isInstancedMesh ? o.count : 1;
        rows.push([o.geometry.name || o.material?.name || o.material?.type, Math.round(tris), n, Math.round(tris * n), !!o.castShadow]);
      });
      return rows.sort((a, b) => b[3] - a[3]).slice(0, 25);
    },
  };
}
