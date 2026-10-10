// Dunder Mifflin Scranton in WebGL: the set (./set.js) under the office's
// fluorescent light and its HDRI, the Scranton branch at their desks (the
// page's rigged cast, ../people.js), Jim walking about among them with the
// third-person camera the towns use, kept inside the walls and under the
// drop ceiling, and the documentary's look: a little flat, a little warm,
// a little grain. The state it draws comes from ./OfficeWorld.jsx.
//
// createOfficeWorld(canvas, { onLost }) → Promise<{ render(state, ms),
// fx(type, at?), screenOf(id), resize, dispose, lost, suggestYaw, info }>

import * as THREE from 'three';
import { createStage } from '../../../lib/stage3d';
import { houseOn } from '../../../lib/three/house';
import { createFeel, feelGroups } from '../../../lib/three/feel';
import { damp } from '../../../lib/ease';
import { LOOK } from './look';
import { device } from '../../../lib/device';
import { createFx } from '../../middleearth/shire/fx';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { loadKit } from '../kit';
import { CAST as STAFF_HEIGHTS, loadPeople } from '../people';
import { HABITS, createManner } from '../motion';
import { makeProps } from '../props';
import { buildSet } from './set';
import { buildWarehouse } from './warehouse';
import { buildOutside } from './outside';
import { buildContactShade } from './ao';
import { bakeStatic } from './batch';
import { collidersFor, findPath, seatWay } from './paths';
import { createOfficeDay, panicAt } from './day';
import { AMBLERS, TALK_CLIP, officePlaces } from './places';
import { preload } from '../../../lib/three/clipLibrary';
import { turn as easeTurn } from '../../../lib/three/gait';
import { CEILING, CAST, COLLIDERS, DWIGHT_BACK, ERIN_BREAK, FIRE_BIN, PANIC, WALLS, inWarehouse, seatOf, spot } from './layout';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SHADOW_R = 12; // half the shadows' box (m)
const NEAR_SHADOW = 5; // the seated cast shadows within this of the camera's focus (m)

// ── the camera keeps inside the walls and under the ceiling ──
const BLOCKERS = COLLIDERS.filter((c) => c.top).map((c) => ({ ...c }));
function boxDist(b, x, z) {
  return Math.max(Math.abs(x - b.x) - b.w / 2, Math.abs(z - b.z) - b.d / 2);
}
function segHits(walls, ax, az, bx, bz) {
  for (const [x0, z0, x1, z1] of walls) {
    const d1 = (bx - ax) * (z0 - az) - (bz - az) * (x0 - ax);
    const d2 = (bx - ax) * (z1 - az) - (bz - az) * (x1 - ax);
    const d3 = (x1 - x0) * (az - z0) - (z1 - z0) * (ax - x0);
    const d4 = (x1 - x0) * (bz - z0) - (z1 - z0) * (bx - x0);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  }
  return false;
}
function nearWall(walls, x, z, pad) {
  for (const [x0, z0, x1, z1] of walls) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < pad) return true;
  }
  return false;
}
// the walls and the furniture near a line from `from` to `to` (only those can stop it)
const nearWalls = [];
const nearBlockers = [];
function gather(from, to, pad) {
  const x0 = Math.min(from.x, to.x) - pad;
  const x1 = Math.max(from.x, to.x) + pad;
  const z0 = Math.min(from.z, to.z) - pad;
  const z1 = Math.max(from.z, to.z) + pad;
  nearWalls.length = 0;
  nearBlockers.length = 0;
  for (const w of WALLS) if (Math.max(w[0], w[2]) >= x0 && Math.min(w[0], w[2]) <= x1 && Math.max(w[1], w[3]) >= z0 && Math.min(w[1], w[3]) <= z1) nearWalls.push(w);
  for (const c of BLOCKERS) {
    const r = c.kind === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2;
    if (c.x + r >= x0 && c.x - r <= x1 && c.z + r >= z0 && c.z - r <= z1) nearBlockers.push(c);
  }
}
// how far from `from` to `to` the camera can go, as a fraction
function clearance(from, to) {
  const N = 14;
  gather(from, to, 0.5);
  let px = from.x;
  let pz = from.z;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k;
    const z = from.z + (to.z - from.z) * k;
    let bad = y > CEILING - 0.18 || segHits(nearWalls, px, pz, x, z) || nearWall(nearWalls, x, z, 0.22);
    if (!bad) for (const c of nearBlockers) if (y < c.top + 0.1 && (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.18 : boxDist(c, x, z) < 0.18)) bad = true;
    if (bad) return Math.max(0.12, (i - 1) / N);
    px = x;
    pz = z;
  }
  return 1;
}

export async function createOfficeWorld(canvas, { onLost } = {}) {
  const tier = device().tier;
  const soft = tier === 'low';
  const stage = createStage(canvas, { soft, shadows: tier === 'high', fov: 58, near: 0.05, far: 170, exposure: 0.94, bloom: LOOK.bloom, onLost });
  // the show's look: fluorescent, a touch green and flat, with a little grain
  stage.grade({ contrast: 0.02, saturation: 0.92, vignette: 0.22, grain: 0.022, shadow: [0.0, 0.01, 0.006], high: [0.012, 0.012, 0.0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  scene.background = new THREE.Color(0xd8d4c8);

  let kit;
  let props;
  let set;
  let cast;
  let wh;
  let out;
  try {
    kit = await loadKit(renderer);
    props = makeProps(kit);
    set = await buildSet(kit, props, { tier });
    wh = buildWarehouse(kit);
    out = buildOutside();
  } catch (e) {
    set?.dispose();
    kit?.dispose();
    stage.dispose();
    throw e;
  }
  // the soft dark where things meet the floor and the walls meet both
  const shade = buildContactShade();
  scene.add(set.group, wh.group, out.group, shade.group);
  // everything that stays put, merged by material a patch of floor at a time
  const baked = [
    bakeStatic(set.group, { keep: [set.stapler, set.jelloOnDesk, set.carried, set.pot, set.fireGlow, set.flicker?.mesh], shadowMin: 0.45 }),
    bakeStatic(wh.group, { keep: [wh.ball], shadowMin: 0.45 }),
    bakeStatic(out.group, { cell: 40 }),
  ];
  if (import.meta.env.DEV) console.info('office: baked', baked.map((b) => `${b.before}→${b.after}`).join(' '));
  const LAMPS = [...set.lights, ...wh.lights];
  const ballHome = wh.ball.position.clone();

  // ── light: the HDRI's office for the fill and reflections, the troffers'
  // cool overhead light, a soft daylight from the windows, and a pool of
  // the nearest troffers round Jim ──
  if (kit.env) {
    scene.environment = kit.env;
    scene.environmentIntensity = 0.6;
  }
  const hemi = new THREE.HemisphereLight(0xf6f8ff, 0x6a6458, 1.15);
  const key = new THREE.DirectionalLight(0xf3f6ff, 1.1);
  key.position.set(1.5, 14, 2.5); // nearly overhead, as under a grid of troffers
  key.target.position.set(0, 0, 0);
  if (tier === 'high') {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    // (a box round what the camera sees, following it: see `follow` below)
    const c = key.shadow.camera;
    c.left = -SHADOW_R;
    c.right = SHADOW_R;
    c.top = SHADOW_R;
    c.bottom = -SHADOW_R;
    c.near = 1;
    c.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
  }
  // The shadows' box follows the camera: 24 m across, centred 8 m ahead of
  // it, its centre moved only in whole texels of the shadow map (so the
  // edges don't crawl as you walk). A smaller box than the whole floor: fewer
  // things drawn into it each frame, and sharper shadows.
  const KEY_OFF = key.position.clone();
  const kz = KEY_OFF.clone().normalize();
  const kx = new THREE.Vector3(0, 1, 0).cross(kz).normalize();
  const ky = kz.clone().cross(kx);
  const texel = (2 * SHADOW_R) / 2048;
  const centre = new THREE.Vector3();
  const follow = (cx, cz) => {
    centre.set(cx, 0, cz);
    const u = Math.round(centre.dot(kx) / texel) * texel - centre.dot(kx);
    const v = Math.round(centre.dot(ky) / texel) * texel - centre.dot(ky);
    centre.addScaledVector(kx, u).addScaledVector(ky, v);
    key.target.position.copy(centre);
    key.position.copy(centre).add(KEY_OFF);
  };
  const day = new THREE.DirectionalLight(0xfff4e2, 0.35);
  day.position.set(-6, 5, -10);
  scene.add(hemi, key, key.target, day);
  // the house look (lib/three/house): the shade under the troffers one colour
  // from their light, as in every world, under the house tone mapper
  const house = houseOn({ renderer, scene, sun: key, hemi });
  // the troffers nearest Jim, as lights: each a wide cone straight down
  // from the fixture, so it pools on the desks and the carpet and leaves the
  // ceiling tiles round it alone (a point light there burnt them white)
  const POOL = tier === 'high' ? 6 : tier === 'mid' ? 4 : 2;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.SpotLight(0xf4f6ff, 0, 9, 1.18, 0.85, 2);
    scene.add(l, l.target);
    return l;
  });
  const alarm = new THREE.PointLight(0xff3a2a, 0, 30, 1.2);
  alarm.position.set(0, CEILING - 0.3, -2);
  scene.add(alarm);

  // smoke and sparks
  const fxRoot = new THREE.Group();
  scene.add(fxRoot);
  const fx = createFx(fxRoot, { scale: tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35 });

  // ── the people: everyone at their desk as their model comes, at it as the
  // show has them (typing, on the phone, at the crossword); Jim on his
  // feet; the ones who get up, standing copies on clips (../people.js:
  // borrowed walks and the clip library's, their feet paced to the ground) ──
  const seated = new Map(); // who → person, in their chair
  const standing = new Map(); // who → person, on their feet (made when needed)
  const manners = new Map(); // who → how they talk with their hands (../motion.js)
  let jim = null;
  let gone = false;
  const SIT_TYPING = new Set(['dwight', 'oscar', 'angela', 'kelly', 'ryan', 'toby', 'andy', 'erin']);
  const sitDown = (id) => {
    const seat = set.seats.get(id);
    const p = cast?.person(id, { pose: 'sit', typing: SIT_TYPING.has(id), idle: !SIT_TYPING.has(id), habit: SIT_TYPING.has(id) ? null : (HABITS[id] ?? null), shadows: tier === 'high', keys: id === 'erin' ? 0.4 : 0.49, cull: true });
    if (!seat || !p) return;
    p.group.position.copy(seat.chair.position);
    p.group.rotation.y = seat.chair.rotation.y;
    seat.group.add(p.group);
    // where they are, for leaving them be while they're out of view, and
    // their meshes, for their shadows
    p.group.updateWorldMatrix(true, false);
    p.seen = new THREE.Sphere(p.group.getWorldPosition(V(0, 0, 0)).add(V(0, 0.8, 0)), 1.2);
    p.casters = [];
    p.group.traverse((o) => o.isMesh && o.castShadow && p.casters.push(o));
    seated.set(id, p);
  };
  const stand = (id) => {
    if (standing.has(id)) return standing.get(id);
    const p = cast?.person(id, { pose: 'stand', idle: true, anim: true, shadows: tier === 'high', cull: true });
    if (!p) return null;
    p.group.visible = false;
    scene.add(p.group);
    standing.set(id, p);
    return p;
  };
  // a standing copy put away: the chair, a talk or a clip it was in let go of
  const putAway = (p) => {
    if (!p?.group.visible) return;
    p.group.visible = false;
    p.stand();
  };
  // Jim first, then everyone else as they come
  const order = ['jim', 'dwight', 'erin', 'michael', 'pam', 'kevin', 'andy', 'stanley', 'phyllis', 'angela', 'oscar', 'creed', 'meredith', 'darryl', 'ryan', 'toby', 'kelly'].filter((id) => STAFF_HEIGHTS[id]);
  const loading = loadPeople(
    order,
    (id, c) => {
      cast = c;
      if (gone) return;
      if (id === 'jim') {
        jim = c.person('jim', { pose: 'stand', idle: true, anim: true, shadows: tier === 'high', cull: true });
        if (jim) scene.add(jim.group);
      } else sitDown(id);
    },
    { clips: true },
  );
  // the clips getting up and sitting down take, and talking, fetched now
  // (the rest as they're first wanted)
  preload(['sit.exit', 'sit.enter', 'talk', 'wave', 'drink', 'interact']).catch(() => {});
  // wait for Jim at least, a few seconds at most, so the office opens with him in it
  await Promise.race([
    loading,
    new Promise((r) => {
      const t0 = performance.now();
      const poll = () => (jim || performance.now() - t0 > 6000 ? r() : setTimeout(poll, 60));
      poll();
    }),
  ]);
  // others online here (OfficeWorld's useTravellers), as the Middle-earth
  // towns and the Avengers compound show theirs: each a pale, shimmering Jim
  // from another branch, with their name over him. Nothing here bumps into
  // them, and they can't touch your jobs, nor you theirs.
  const ghosts = createGhosts({
    make: () => {
      const p = cast?.person('jim', { pose: 'stand', anim: true, shadows: false, cull: true });
      const group = new THREE.Group();
      if (!p) {
        // (Jim's model not to hand: a plain shape of him)
        group.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 10).translate(0, 0.86, 0), new THREE.MeshStandardMaterial()));
        return { group, top: 1.75 };
      }
      p.group.rotation.y = Math.PI / 2; // (a ghost's face, like Jim's, is measured from +x; a figure faces +z)
      group.add(p.group);
      // (his mesh and its materials are the cast's, shared with the real Jim:
      // not the ghost's to dispose; only his own skeleton is)
      return {
        group,
        top: 1.9,
        person: p,
        shared: true,
        dispose: () => {
          p.anim?.dispose();
          p.group.traverse((o) => o.skeleton?.dispose());
        },
      };
    },
    animate: (f, t, p, dt) => {
      if (!f.person) return;
      // (on clips, its feet paced to where the ghost's taken; else the old stride)
      f.person.walk(p.moving, Math.max(0.6, (p.speed ?? 1.4) / 2.3));
      f.person.update(t, dt);
      f.person.group.position.y = f.person.bob();
    },
    tag: 0.3,
    halo: 0.8,
  });
  scene.add(ghosts.group);

  // the runners in the fire drill: these get up and go (Stanley at a walk:
  // he doesn't run for anyone)
  const RUNNERS = ['michael', 'angela', 'kevin', 'oscar', 'andy', 'phyllis', 'stanley', 'dwight'];
  const runYaw = new Map(); // who → the way they're facing, eased round at each end
  // the working day (./day.js): who gets up for what, where (./places.js),
  // and the ways round the desks there, each found the first time it's
  // wanted and kept (./paths.js)
  const SEATS_OUT = Object.fromEntries(AMBLERS.map((a) => [a.who, seatOf(a.who)]).filter(([, s]) => s).map(([who, s]) => [who, seatWay(s)]));
  const ways = new Map();
  const BOUNDS = { x0: -15, x1: 15, z0: -8.5, z1: 8.5 };
  const workday = createOfficeDay({
    seats: SEATS_OUT,
    places: officePlaces(),
    people: AMBLERS,
    seed: 1105,
    route: (who, place, slot) => {
      const key = `${who}:${place.id}:${slot}`;
      if (!ways.has(key)) {
        const out = SEATS_OUT[who].exit;
        ways.set(key, findPath(out[out.length - 1], place.spots[slot] ?? place.spots[0], { colliders: collidersFor(seatOf(who)), walls: WALLS, radius: 0.26, bounds: BOUNDS }));
      }
      return ways.get(key);
    },
  });
  const was = new Map(); // who → the day's state for them last frame, and their talk
  const HOLD_DWIGHT = new Set(['dwight']);
  const CLOSED_MICHAEL = new Set(['michael']); // (Jim's in with him)
  const lookPoint = V(0, 0, 0);
  // where someone's head is: on their feet if they're up, else at their desk
  const headOf = (id, out) => {
    const p = standing.get(id)?.group.visible ? standing.get(id) : seated.get(id);
    if (p) return p.headAt(out);
    const c = CAST.find((x) => x.id === id);
    return c ? out.set(c.x, 1.25, c.z) : null;
  };

  // ── where to go next: a marker over each, bobbing, and a ring on the floor ──
  const markers = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: 0x9cc8ff, emissive: 0x4a9bff, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.1 }));
    gem.scale.y = 1.55;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    ring.renderOrder = 2;
    g.add(gem, ring);
    g.visible = false;
    scene.add(g);
    return { g, gem, ring };
  });

  // the shake (lib/three/feel: still under reduced motion). The old ones
  // were metres, ±k/2, a catch's 0.18 the biggest: `jolt(k)` gives each its
  // old size at its peak, and it's gone in about as long
  const JOLT = 0.18;
  const feel = createFeel({ offset: JOLT / 2, baseFov: 58 });
  feel.set({ decay: 4 });
  const jolt = (k) => feel.trauma(Math.sqrt(Math.min(1, k / JOLT)));
  stage.tune(feelGroups(feel));
  const A = { t: 0, cam: { at: V(0, 2, 6), look: V(0, 1.4, 0) }, mode: null, suggest: null, nearAt: -1, near: [], fire: 0, smokeAt: 0, castAt: -1, focus: V(0, 0, 0), view: new THREE.Frustum() };
  const viewMat = new THREE.Matrix4();
  const tmp = V(0, 0, 0);
  const tmp2 = V(0, 0, 0);
  const look = V(0, 0, 0);
  const head = V(0, 0, 0);
  const graded = { vignette: 0.22, high: [0.012, 0.012, 0], shadow: [0, 0.01, 0.006] };

  // someone standing moved to (x, z) facing `face`, walking or not
  const place = (p, x, z, face, walking, rate = 1) => {
    p.group.visible = true;
    p.group.position.set(x, 0, z);
    p.group.rotation.y = face + Math.PI / 2; // (face: 0 is +x, as the walker has it; a figure faces +z)
    p.walk(walking, rate);
    p.group.position.y = p.bob();
  };
  const along = (path, k) => {
    // a point k (0..1) of the way along a path of points, and its heading
    const segs = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const l = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      segs.push(l);
      total += l;
    }
    let d = Math.max(0, Math.min(1, k)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const a = path[i];
        const b = path[i + 1];
        const f = segs[i] ? Math.min(1, d / segs[i]) : 1;
        return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, face: Math.atan2(-(b.z - a.z), b.x - a.x) };
      }
      d -= segs[i];
    }
    return { ...path[path.length - 1], face: 0 };
  };

  const render = (s, ms) => {
    const dt = Math.min(0.05, ms / 1000);
    A.t += dt;
    if (import.meta.env.DEV && s.warp) A.t += s.warp; // (a dev hook: skip the clock ahead)
    const t = A.t;
    const h = s.jim;

    ghosts.update(s.travellers ?? [], t, dt);

    // ── Jim ──
    if (jim) {
      place(jim, h.x, h.z, h.face, h.speed > 0.3, h.running ? 1.45 : Math.max(0.6, h.speed / 2.3));
      jim.update(t, dt);
    }
    // what he's carrying: the Jell-O or the chili, held out in front
    const carrying = s.carry;
    set.jelloCarry.visible = carrying === 'jello';
    set.carried.visible = carrying === 'jello';
    if (carrying === 'jello' || carrying === 'chili') {
      const fwdX = Math.cos(h.face);
      const fwdZ = -Math.sin(h.face);
      const tip = carrying === 'chili' ? Math.sin(t * 9) * (s.slosh ?? 0) * 0.12 : 0;
      const target = carrying === 'chili' ? set.pot : set.carried;
      target.visible = true;
      target.position.set(h.x + fwdX * 0.42, 1.0 + (jim?.bob() ?? 0), h.z + fwdZ * 0.42);
      target.rotation.set(tip, h.face + Math.PI / 2, tip * 0.6);
      if (jim) {
        const hand = target.position;
        jim.reach('left', tmp.set(hand.x - fwdZ * 0.16, hand.y + 0.08, hand.z + fwdX * 0.16));
        jim.reach('right', tmp2.set(hand.x + fwdZ * 0.16, hand.y + 0.08, hand.z - fwdX * 0.16));
      }
    } else if (jim) {
      jim.reach('left', null);
      jim.reach('right', null);
    }
    // the pot where it is when it's not carried
    if (carrying !== 'chili') {
      if (s.chiliDone) {
        const k = spot('kitchen');
        set.pot.position.set(k.x, 0.92, k.z - 0.45);
      } else set.pot.position.set(set.potHome.x, 0, set.potHome.z);
      set.pot.rotation.set(0, 0, 0);
    }
    // the stapler, in Jell-O or not
    set.jelloOnDesk.visible = !!s.jelloSet;
    set.stapler.visible = !s.jelloSet;

    // ── who's where ──
    const away = new Set();
    head.set(h.x, 1.55, h.z);
    const near = (x, z, r) => Math.hypot(x - h.x, z - h.z) < r;
    // Erin on her break: at the vending machines
    if (s.erinBreak) {
      away.add('erin');
      const e = stand('erin');
      if (e) {
        place(e, ERIN_BREAK.at.x, ERIN_BREAK.at.z, ERIN_BREAK.face, false);
        e.look(near(ERIN_BREAK.at.x, ERIN_BREAK.at.z, 2.6) ? head : null);
        e.update(t, dt);
      }
    } else putAway(standing.get('erin'));
    // Dwight in the men's room, then on his way back (turning his corners)
    const dw = standing.get('dwight') ?? (s.dwight !== 'desk' ? stand('dwight') : null);
    if (s.dwight === 'away') {
      away.add('dwight');
      putAway(dw);
      A.dwYaw = null;
    } else if (s.dwight === 'back') {
      away.add('dwight');
      if (dw) {
        const p = along(DWIGHT_BACK, s.dwightK ?? 0);
        const want = p.face + Math.PI / 2;
        A.dwYaw = A.dwYaw == null ? want : easeTurn(A.dwYaw, want, dt, 8);
        place(dw, p.x, p.z, A.dwYaw - Math.PI / 2, (s.dwightK ?? 0) < 1);
        // (and if Jim's near his desk, Dwight's eyes are on him)
        dw.look(near(p.x, p.z, 4) ? head : null);
        dw.update(t, dt);
      }
    } else if (dw && !s.fire) putAway(dw);
    // the fire drill: everyone who can, running about, up and down a line
    // each, slowing to turn at its ends; arms up, waving for help
    if (s.fire) {
      RUNNERS.forEach((id, i) => {
        const p = stand(id);
        if (!p) return;
        away.add(id);
        const [a, b] = PANIC[i % PANIC.length];
        const speed = id === 'stanley' ? 1.4 : 2.6 + (i % 3) * 0.5;
        const r = panicAt(a, b, { speed, phase: (i * 0.37) % 1, t: s.fireT, side: i >= PANIC.length ? 0.35 : -0.1 });
        const before = runYaw.get(id);
        const yaw = before == null ? r.yaw : easeTurn(before, r.yaw, dt, 9);
        runYaw.set(id, yaw);
        if (!p.group.visible) {
          // (out of the chair in a panic)
          p.stand();
          p.play('scared', { layer: 'upper' });
        }
        p.group.visible = true;
        p.group.position.set(r.x, 0, r.z);
        p.group.rotation.y = yaw;
        p.walk(true, 1.6);
        p.group.position.y = p.bob();
        if (i % 3 === 0 && p.anim) {
          if (p.anim.playing('upper') !== 'wave.help') p.play('wave.help', { layer: 'upper', loop: true });
        } else if (i % 3 === 0) p.gesture('cheer'); // arms in the air
        p.update(t, dt);
        s.runners?.push({ x: r.x, z: r.z });
      });
    } else {
      runYaw.clear();
      // (once, as it ends: back at their desks, those of them the day has up shown again by it)
      if (A.fired) for (const id of RUNNERS) if (!(id === 'dwight' && s.dwight === 'back') && !(id === 'erin' && s.erinBreak)) putAway(standing.get(id));
    }
    A.fired = Boolean(s.fire);
    // the working day (./day.js): up from the desk, the way round the desks
    // to the kitchen or the copier or the cooler, a moment there (two there
    // talk), and back and sat down again; stopping for Jim, and turning to
    // him when he talks to them. In the fire drill, everyone's at their desk.
    const dayAt = { jim: { x: h.x, z: h.z }, talkTo: s.talkTo, hold: s.dwight !== 'desk' ? HOLD_DWIGHT : null, closed: s.talkTo === 'michael' ? CLOSED_MICHAEL : null, stop: Boolean(s.fire) };
    // (the dev hook's skip ahead, a tenth of a second at a time)
    if (import.meta.env.DEV && s.warp > 0) for (let k = 0; k < Math.min(600, s.warp / 0.1); k++) workday.step(0.1, dayAt);
    const entries = workday.step(dt, dayAt);
    const visitors = new Map(); // a sitter → whoever's come to talk to them
    for (const e of entries) {
      const before = was.get(e.who) ?? { state: 'seated', talk: false };
      was.set(e.who, { state: e.state, talk: e.talk });
      if (e.state === 'seated') {
        if (before.state !== 'seated' && !(s.fire && RUNNERS.includes(e.who))) putAway(standing.get(e.who));
        continue;
      }
      const p = stand(e.who);
      if (!p) continue;
      // what changed: up out of the chair, down into it, a clip at a place
      if (e.state !== before.state) {
        if (e.state === 'rising') {
          p.stand();
          p.rise();
        } else if (e.state === 'sitting') p.sit();
        else if (e.state === 'using' && e.clip) p.play(e.clip, { layer: 'full', loop: e.loop, lasts: e.loop ? 30 : null });
        if (before.state === 'using') p.stop('full');
      }
      // shown once it's sat in the chair on clips (a frame or two, for the
      // clip to begin), and only then is the one at the desk put away
      const up = e.state !== 'rising' || !p.anim || p.anim.playing('full') === 'sit.exit' || e.age > 0.25;
      if (!up) {
        p.update(t, dt);
        continue;
      }
      away.add(e.who);
      p.group.visible = true;
      p.group.position.set(e.x, 0, e.z);
      p.group.rotation.y = e.yaw;
      // a talk: their own, standing; a listener just looks
      if (e.talk && !before.talk) p.play(TALK_CLIP[e.who] ?? 'talk', { layer: 'upper', loop: true });
      else if (!e.talk && before.talk) p.stop('upper');
      // where the eyes go: Jim, whoever's talking, what the place is for,
      // or Jim if he's close
      let at = null;
      if (e.look === 'jim') at = head;
      else if (typeof e.look === 'string') at = headOf(e.look, lookPoint);
      else if (e.look) at = lookPoint.set(e.look.x, 1.1, e.look.z);
      if (!at && near(e.x, e.z, 2.6)) at = head;
      p.look(at);
      if (e.with && e.state === 'using') visitors.set(e.with, e.who);
      p.update(t, dt);
      s.runners?.push({ x: e.x, z: e.z });
      s.ambling?.push({ id: e.who, x: e.x, z: e.z });
    }
    // the seated: in their chairs unless they're up; heads turning to Jim
    // when he's close, to whoever's come to their desk; their hands going
    // as they talk, each in their way (../motion.js)
    // (out of view, as of the last frame, they're left as they were; only
    // those near what the camera's on cast shadows)
    const shadowsNow = tier === 'high' && t - A.castAt > 0.4;
    if (shadowsNow) A.castAt = t;
    for (const [id, p] of seated) {
      p.group.visible = !away.has(id);
      if (!p.group.visible) continue;
      if (shadowsNow) {
        const close = Math.hypot(p.seen.center.x - A.focus.x, p.seen.center.z - A.focus.z) < NEAR_SHADOW;
        for (const m of p.casters) m.castShadow = close;
      }
      const visitor = visitors.get(id);
      if (!A.view.intersectsSphere(p.seen) && s.wave !== id && !visitor) continue;
      const c = CAST.find((x) => x.id === id);
      const close = c && Math.hypot(c.x - h.x, c.z - h.z) < 3.2;
      const talking = s.talkTo === id || Boolean(visitor);
      p.look(s.talkTo === id || (close && !visitor) ? head : visitor ? headOf(visitor, lookPoint) : null);
      if (s.wave === id) p.wave();
      else {
        if (!manners.has(id)) manners.set(id, createManner(id));
        const g = manners.get(id).step(dt, talking);
        // (Toby at the door: Michael has one thing to say to him)
        if (g) p.gesture(visitor === 'toby' && id === 'michael' ? 'shake' : g);
      }
      p.update(t, dt);
    }

    // ── light: the nearest troffers to Jim, picked now and then ──
    if (t - A.nearAt > 0.4) {
      A.nearAt = t;
      A.near = LAMPS
        .map((p) => [p, Math.hypot(p[0] - h.x, p[2] - h.z)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, POOL)
        .map((p) => p[0]);
    }
    // the warehouse: its lamps are higher and brighter
    const down = inWarehouse(h.x, h.z);
    // the basketball
    if (s.ballAt) wh.ball.position.set(s.ballAt.x, s.ballAt.y, s.ballAt.z);
    else wh.ball.position.copy(ballHome);
    if (s.ballAt?.spin) wh.ball.rotation.z += dt * 9;
    const red = s.fire ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
    A.fire += ((s.fire ? 1 : 0) - A.fire) * Math.min(1, dt * 2);
    // the markers over where to go next: the nearest three on Jim's floor,
    // not over where he already is (the corner map shows them all)
    const next = (s.markers ?? [])
      .filter((at) => (at.x > 25) === (h.x > 25) && Math.hypot(at.x - h.x, at.z - h.z) > 1.3)
      .sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))
      .slice(0, 3);
    markers.forEach((m, i) => {
      const at = next[i];
      const show = !!at;
      m.g.visible = !!show;
      if (!show) return;
      m.g.position.set(at.x, 0, at.z);
      m.gem.position.y = 2.05 + Math.sin(t * 2.2 + i) * 0.07;
      m.gem.rotation.y = t * 1.4 + i;
      const pulse = (t * 0.8 + i * 0.3) % 1;
      m.ring.scale.setScalar(0.8 + pulse * 0.5);
      m.ring.material.opacity = 0.55 * (1 - pulse);
      m.ring.position.y = 0.015;
    });
    // the annex's tired tube: steady, then a stutter now and then
    let flick = 1;
    if (set.flicker) {
      const c = t % 9.3;
      flick = c < 0.9 ? (Math.sin(c * 61) * Math.sin(c * 23) > -0.1 ? 1 : 0.08) : c < 1.2 ? 0.35 : 1;
      set.flicker.material.emissiveIntensity = 2.4 * flick;
    }
    pool.forEach((l, i) => {
      const v = A.near[i];
      if (!v) return (l.intensity = 0);
      l.position.set(v[0], v[1] + 0.15, v[2]);
      l.target.position.set(v[0], 0, v[2]);
      l.intensity = (down ? 60 : 9) * (1 - A.fire * 0.4) * (set.flicker && v === set.lights[set.flicker.index] ? flick : 1);
      l.distance = down ? 16 : 9;
      return undefined;
    });
    alarm.intensity = A.fire * red * 60;
    alarm.position.set(h.x, CEILING - 0.3, h.z);
    hemi.intensity = 1.15 * (1 - A.fire * 0.25);
    graded.vignette = 0.22 + A.fire * 0.2;
    graded.high[0] = 0.012 + A.fire * red * 0.06;
    stage.grade(graded);
    // the fire in Dwight's bin, and its smoke
    set.fireGlow.intensity = A.fire * (6 + Math.sin(t * 17) * 2);
    if (s.fire && t - A.smokeAt > 0.06) {
      A.smokeAt = t;
      fx.flame(V(FIRE_BIN.x, 0.35, FIRE_BIN.z), 0.12);
      fx.chimney(V(FIRE_BIN.x, 0.6, FIRE_BIN.z));
    }

    // ── the camera: behind Jim, kept inside the walls and under the ceiling ──
    let camAt;
    let camLook;
    if (s.deskCam && s.mode !== 'walk') {
      camAt = tmp.set(...s.deskCam.at);
      camLook = look.set(...s.deskCam.look);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.24;
      const dist = s.mode === 'talk' ? 2.4 : (s.camDist ?? 3.4);
      look.set(h.x, 1.5, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, 1.5 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const k = clearance(look, camAt);
      A.suggest = null;
      if (k < 0.55) {
        let best = k;
        for (const dy of [0.6, -0.6, 1.2, -1.2, 2, -2]) {
          const y2 = yaw + dy;
          const kk = clearance(look, tmp2.set(h.x + Math.sin(y2) * Math.cos(pitch) * dist, 1.5 + Math.sin(pitch) * dist, h.z + Math.cos(y2) * Math.cos(pitch) * dist));
          if (kk > best + 0.15) {
            best = kk;
            A.suggest = y2;
          }
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, k);
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode || s.snapCam;
    A.mode = s.mode;
    // (by dt, as fast as the old 9 and 3 a second were at 60 Hz, at any rate)
    const ease = jump ? 1 : damp(s.mode === 'walk' ? 9.75 : 3.08, dt);
    A.cam.at.lerp(camAt, ease);
    A.cam.look.lerp(camLook, ease);
    camera.position.copy(A.cam.at);
    camera.lookAt(A.cam.look);
    feel.setBaseFov(camera.fov);
    feel.update(dt, camera);
    // what the camera sees, for the next frame's people; the shadows' box
    // ahead of it (upstairs: downstairs the light has no shadows to give)
    camera.updateMatrixWorld();
    A.view.setFromProjectionMatrix(viewMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    {
      const fx = A.cam.look.x - camera.position.x;
      const fz = A.cam.look.z - camera.position.z;
      const fl = Math.hypot(fx, fz) || 1;
      A.focus.set(camera.position.x + (fx / fl) * 3.4, 0, camera.position.z + (fz / fl) * 3.4);
      if (tier === 'high') {
        if (camera.position.x < 25) follow(camera.position.x + (fx / fl) * 8, camera.position.z + (fz / fl) * 8);
        else follow(0, 0); // (kept over the office, clear of the warehouse's roof)
      }
    }
    // upstairs or down: the office and the warehouse with its lot can't see
    // each other, so only the one the camera's on is drawn (and the lot's
    // horizon, which would otherwise run through the office, stays outside)
    const below = camera.position.x > 25;
    set.group.visible = !below;
    wh.group.visible = below;
    out.group.visible = below;

    set.windows.step(t);
    out.step(t);
    fx.step(dt, t, { night: 0, day: 1 });
    renderer.info.reset();
    stage.render(ms);
  };

  const fxEvent = (type, at = null) => {
    const p = at ? V(at.x ?? 0, at.y ?? 1.2, at.z ?? 0) : null;
    if (type === 'pop' && p) {
      fx.pop(p, at.colour ?? 'gold', 20, 1.8);
      jim?.play('fist.pump', { layer: 'upper' }); // (a basket: his legs his own)
    } else if (type === 'spill' && p) {
      set.spill(p);
      fx.puff(V(p.x, 0.3, p.z), V(0, 0.6, 0), 10);
      jolt(0.06);
      jim?.play('headache', { layer: 'upper' }); // (Kevin's chili, on the carpet)
    } else if (type === 'clearSpills') set.clearSpills();
    else if (type === 'caught') {
      jolt(0.18);
      jim?.glance(camera.position, 1.8); // (caught: his look to the camera)
    } else if (type === 'fire') {
      fx.pop(V(FIRE_BIN.x, 1, FIRE_BIN.z), 'red', 26, 2);
      jolt(0.12);
    } else if (type === 'award') {
      const m = seatOf('michael');
      fx.pop(V(m.x, 1.8, m.z + 0.6), 'gold', 40, 2.4);
      fx.pop(V(m.x, 2, m.z + 0.6), 'white', 20, 2);
      seated.get('michael')?.gesture('cheer');
    } else if (type === 'jello') {
      const d = seatOf('dwight');
      fx.pop(V(d.x, 1.0, d.z), 'green', 22, 1.5);
      jim?.glance(camera.position, 1.6); // (the stapler in Jell-O: a look to the camera)
    }
  };

  // where someone's head is on screen, for the speech bubbles
  const screenOf = (id) => {
    let p = null;
    if (standing.get(id)?.group.visible) p = standing.get(id).headAt(V());
    else if (seated.get(id)?.group.visible) p = seated.get(id).headAt(V());
    if (!p) {
      const c = CAST.find((x) => x.id === id);
      if (!c) return null;
      p = V(c.x, 1.3, c.z);
    }
    p.y += 0.32;
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  // everything's shaders linked before the first frame
  house.follow({ adopt: true });
  await stage.precompile();
  // and the people who come later, as they come (they're shown at once;
  // the page's 3D office links theirs the same way)
  loading.then(() => !gone && (house.follow({ adopt: true }), stage.precompile()));

  return {
    scene: import.meta.env.DEV ? scene : null,
    renderer: import.meta.env.DEV ? renderer : null,
    render,
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    fx: fxEvent,
    screenOf,
    resize: stage.resize,
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier, people: seated.size };
    },
    get lost() {
      return stage.lost;
    },
    get suggestYaw() {
      return A.suggest ?? null;
    },
    get ready() {
      return !!jim;
    },
    dispose() {
      gone = true;
      ghosts.dispose();
      fx.dispose?.();
      set.dispose();
      wh.dispose();
      out.dispose();
      shade.dispose();
      for (const b of baked) b.dispose();
      props.dispose();
      loading.then((c) => c?.dispose());
      kit.dispose();
      stage.dispose();
    },
  };
}

