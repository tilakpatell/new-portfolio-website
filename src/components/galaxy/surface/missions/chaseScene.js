// A chase, drawn and run in the surface scene: the scouts on their speeder
// bikes (placer's bike, figures.js's scout trooper on it), placed each frame
// from the rules (./chase.js), their shots at you through the surface's
// blaster, your bike's cannon at them, and a bike going down: a flash, and
// it skids, rolling, to a stop. The scene hands it the world once the
// trees are solid (begin), then calls update each frame.
//
// Each scout sits its bike as the films have them: low over the bars, its
// thighs along the bike and its boots back on the pegs, leaning into a
// bank further than the bike does, its head into the swerve. As its shot
// comes it turns on the seat and looks back over its shoulder, the arm on
// your side out at you, then back to the bars; hit, it jolts; shot down
// (or into a tree) it's thrown off, up and over, and lies where it slid to.
// The rider shows the rules (chase.js) and never changes them.
//
// createChaseMission({ parent, world, placer, blaster, mission, emit, say,
// sounds }) → { begin(), restart(), update(dt, you) → { push }, fire(from,
// dir, color), knocked(), stalled(), target(), view(), force(result),
// dispose() }
//
// The rider, for the drawing (and tested): riderOf(fig) → its joints, or
// null; createRider(fig, seat) → { pivot, pose(dt, { bank, swerve, at }),
// hit(), thrown(into, { speed, yaw, how }), fly(dt, groundY), muzzle(out),
// reset(holder) }; throwStep(th, dt, groundY); SIT.

import * as THREE from 'three';
import { disposeTree } from '../../../../lib/three/renderer';
import { buildFigure } from '../figures';
import { RIDES as GALAXY_RIDES } from '../rides';
import { groundAt } from '../walker';
import { aimAssist, chaseView, firstSolid, hitScout, knockYou, laneHits, newChase, planRoute, scoutAt, starsFor, stepChase } from './chase';
import { sharpen } from '../../../../lib/three/textures';

const V = THREE.Vector3;
const CHEST = 0.88; // metres over the bike's frame: where a bolt aims for, and lands
const ROLL = { slow: 22, spin: 7, gone: 5 }; // a bike going down: m/s² it slows, rad/s it rolls, seconds till it's cleared away
// How a rider sits its bike (radians, on figures.js's person: a limb hangs
// down its joint's −y, and a turn about x swings it forward when negative):
// its hips `up` over the seat, leaning `lean` over the bars, its thighs
// along the bike and spread a little, its shins back down to the pegs, its
// arms out to the bars; and leaning into a bank `bank` again as far as its
// bike does.
export const SIT = { up: 0.1, lean: 0.22, thigh: -1.52, knee: 1.55, spread: 0.14, arm: -1.22, elbow: -0.4, bank: 0.6 };
// Turning to fire: how long it stays round after a shot, how far its body
// turns on the seat and its head past that, how quickly (a second), and
// how long before the shot the rules give it starts round (chase.js's
// fireIn counting down).
const AIM = { hold: 0.8, twist: 0.7, head: 1.5, rate: 8, lead: 0.35 };
// Thrown off: up (m/s), its bike's speed it keeps, its tumble (rad/s; over
// the bars into a tree, backward off it shot), the height its hips lie at
// on the ground, and how quickly it slides to a stop (m/s²).
const THROW = { up: { tree: 3.5, shot: 2.6 }, ahead: { tree: 0.7, shot: 0.45 }, spin: { tree: 5, shot: -3 }, lie: 0.15, slide: 9 };
const GRAVITY = 9.8;
const DOWN = new V(0, -1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// A built person's joints (figures.js's person(): two hips each with a knee
// 0.42 down it, two shoulders 1.4 up with an elbow 0.32 down each, and the
// head over them), found where it puts them, each pair its left (+x) first;
// hipY is the hips' height in its parent's units. Null for anything else
// (a beast, a model, nothing).
export function riderOf(fig) {
  const m = fig?.model;
  if (!m?.children) return null;
  const child = (o, y) => o.children.find((c) => c.isGroup && Math.abs(c.position.y - y) < 0.02) ?? null;
  const groups = m.children.filter((o) => o.isGroup);
  const hips = groups.filter((o) => o.position.y > 0.7 && o.position.y < 0.95 && Math.abs(o.position.x) < 0.2 && child(o, -0.42)).sort((a, b) => b.position.x - a.position.x);
  const shoulders = groups.filter((o) => Math.abs(o.position.y - 1.4) < 0.02 && child(o, -0.32)).sort((a, b) => b.position.x - a.position.x);
  const head = groups.find((o) => o.position.y > 1.5 && !hips.includes(o) && !shoulders.includes(o)) ?? null;
  if (hips.length !== 2 || shoulders.length !== 2 || !head) return null;
  return { hips, knees: hips.map((h) => child(h, -0.42)), shoulders, elbows: shoulders.map((s) => child(s, -0.32)), head, hipY: hips[0].position.y * m.scale.y };
}

// One step of a body thrown (th: { x, y, z, vx, vy, vz, pitch, spin, t,
// landed }): through the air, tumbling, until it comes down on the ground
// (groundY) at its hips' height lying; then sliding to a stop and settling
// flat on its back or its front, whichever it came down nearer. Changes th
// and gives it back.
export function throwStep(th, dt, groundY) {
  const h = clamp(dt, 0, 0.1);
  th.t += h;
  if (!th.landed) {
    th.vy -= GRAVITY * h;
    th.x += th.vx * h;
    th.y += th.vy * h;
    th.z += th.vz * h;
    th.pitch += th.spin * h;
    if (th.vy < 0 && th.y <= groundY + THROW.lie) {
      th.landed = true;
      th.y = groundY + THROW.lie;
      th.vy = 0;
    }
    return th;
  }
  const sp = Math.hypot(th.vx, th.vz);
  const k = sp > 0 ? Math.max(0, sp - THROW.slide * h) / sp : 0;
  th.vx *= k;
  th.vz *= k;
  th.x += th.vx * h;
  th.z += th.vz * h;
  th.y = groundY + THROW.lie;
  const flat = Math.PI / 2 + Math.round((th.pitch - Math.PI / 2) / Math.PI) * Math.PI;
  th.pitch += (flat - th.pitch) * Math.min(1, h * 8);
  return th;
}

// A scout on its bike: its figure on a pivot at the seat, its hips on it,
// so it leans and turns on the seat about them. A figure riderOf can't read
// stands where scouts always stood, stepped as it was, and is gone when
// its bike goes down.
export function createRider(fig, seat) {
  const parts = riderOf(fig);
  const pivot = new THREE.Group();
  pivot.name = 'rider';
  pivot.rotation.order = 'YXZ';
  const home = () => {
    if (parts) pivot.position.set(seat[0], seat[1] + SIT.up, seat[2]);
    else pivot.position.set(0, 0, 0);
    pivot.rotation.set(0, 0, 0, 'YXZ');
  };
  if (fig) {
    if (parts) fig.model.position.set(0, -parts.hipY, 0);
    else fig.model.position.set(seat[0], seat[1] - 0.55, seat[2]);
    pivot.add(fig.model);
  }
  home();
  // (each arm's place on the bars)
  const bars = [0, 1].map((i) => new THREE.Quaternion().setFromEuler(new THREE.Euler(SIT.arm, 0, (i ? -1 : 1) * 0.08)));
  const st = { w: 0, at: new V(), side: 0, flinch: 0, th: null };
  const tmp = new V();
  const aimQ = new THREE.Quaternion();

  function pose(dt, { bank = 0, swerve = 0, at = null } = {}) {
    if (!parts) {
      fig?.update?.(dt, 0);
      return;
    }
    const k = 1 - Math.exp(-AIM.rate * Math.max(0, dt));
    st.w += ((at ? 1 : 0) - st.w) * k;
    if (at) st.at.copy(at);
    // where you are, round from the way its bike faces (+ its left)
    let a = 0;
    if (st.w > 1e-3) {
      const p = pivot.parent ? pivot.parent.worldToLocal(tmp.copy(st.at)) : tmp.copy(st.at);
      a = Math.atan2(p.x - pivot.position.x, p.z - pivot.position.z);
      st.side = a >= 0 ? 0 : 1;
    }
    const twist = clamp(a, -AIM.twist, AIM.twist) * st.w;
    st.flinch = Math.max(0, st.flinch - dt);
    const jolt = st.flinch > 0 ? Math.sin(st.flinch * 50) * st.flinch * 0.5 : 0;
    pivot.rotation.set(SIT.lean - Math.abs(jolt) * 0.5, twist, bank * SIT.bank + jolt, 'YXZ');
    parts.hips.forEach((hip, i) => {
      hip.rotation.set(SIT.thigh, 0, (i ? -1 : 1) * SIT.spread);
      parts.knees[i].rotation.set(SIT.knee, 0, 0);
    });
    // its head into the swerve (going right, it looks right), or round to you
    const ride = clamp(-swerve * 0.05, -0.5, 0.5);
    parts.head.rotation.set(jolt * 0.6, ride * (1 - st.w) + clamp(a - twist, -AIM.head, AIM.head) * st.w, 0);
    // its hands on the bars, the one on your side round to you
    parts.shoulders.forEach((sh, i) => {
      sh.quaternion.copy(bars[i]);
      parts.elbows[i].rotation.set(SIT.elbow, 0, 0);
    });
    if (st.w > 1e-3) {
      pivot.updateWorldMatrix(true, true);
      const sh = parts.shoulders[st.side];
      const d = fig.model.worldToLocal(tmp.copy(st.at)).sub(sh.position);
      if (d.lengthSq() > 1e-8) {
        aimQ.setFromUnitVectors(DOWN, d.normalize());
        sh.quaternion.slerp(aimQ, st.w);
        parts.elbows[st.side].rotation.x = SIT.elbow * (1 - st.w);
      }
    }
  }

  // out of the seat: into `into` where it was, flying on from its bike
  function thrown(into, { speed = 0, yaw = 0, how = 'shot' } = {}) {
    if (!parts) {
      pivot.visible = false;
      return;
    }
    const kind = how === 'tree' ? 'tree' : 'shot';
    pivot.updateWorldMatrix(true, false);
    into.attach(pivot);
    const p = pivot.position;
    const turned = pivot.rotation.y;
    st.th = { x: p.x, y: p.y, z: p.z, vx: Math.sin(yaw) * speed * THROW.ahead[kind], vy: THROW.up[kind], vz: Math.cos(yaw) * speed * THROW.ahead[kind], pitch: SIT.lean, spin: THROW.spin[kind], yaw: turned, roll: pivot.rotation.z, t: 0, landed: false };
    st.w = 0;
  }
  // a frame of it: through the air flailing, then sliding, then lying spread
  function fly(dt, groundY) {
    const th = st.th;
    if (!th) return;
    throwStep(th, dt, groundY);
    th.roll *= th.landed ? 0.9 : 1;
    pivot.position.set(th.x, th.y, th.z);
    pivot.rotation.set(th.pitch, th.yaw, th.roll, 'YXZ');
    const air = th.landed ? 0 : 1;
    const flail = Math.sin(th.t * 14) * 0.4 * air;
    parts.hips.forEach((hip, i) => {
      const s = i ? -1 : 1;
      hip.rotation.set(-0.5 * air + flail * s, 0, s * (0.25 + 0.15 * air));
      parts.knees[i].rotation.set(0.7 * air, 0, 0);
    });
    parts.shoulders.forEach((sh, i) => {
      const s = i ? -1 : 1;
      sh.rotation.set(-2.4 * air - flail * s, 0, s * (1.1 - 0.4 * air));
      parts.elbows[i].rotation.set(-0.3 * air, 0, 0);
    });
    parts.head.rotation.set(0, 0, 0);
  }

  return {
    pivot,
    parts,
    pose,
    // a bolt of yours, and it's still on: a jolt
    hit() {
      st.flinch = 0.3;
    },
    thrown,
    fly,
    // where its bolt leaves from, while it's round with its arm out (out, in the world), else null
    muzzle(out) {
      if (!parts || st.w < 0.5 || st.th) return null;
      const sh = parts.shoulders[st.side];
      sh.updateWorldMatrix(true, false);
      sh.getWorldPosition(out);
      return out.add(tmp.copy(DOWN).applyQuaternion(sh.getWorldQuaternion(aimQ)).multiplyScalar(0.62));
    },
    // back on its bike for another run
    reset(holder) {
      st.th = null;
      st.w = 0;
      st.flinch = 0;
      holder.add(pivot);
      home();
      pivot.visible = true;
    },
  };
}

export function createChaseMission({ parent, world, placer, blaster, mission, emit, say, sounds, rides: RIDES = GALAXY_RIDES }) {
  const group = new THREE.Group();
  group.name = 'chase';
  parent.add(group);
  const spec = RIDES[mission.ride ?? 'speederbike'];
  let dead = false;

  // a mark over each scout still riding: a small red chevron, the same size
  // on the screen however far off it is, so one can be picked out among the
  // trunks and the fog
  const markMat = new THREE.SpriteMaterial({
    map: (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#ff4a3d';
      g.strokeStyle = 'rgba(20, 6, 4, 0.8)';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(10, 14);
      g.lineTo(54, 14);
      g.lineTo(32, 50);
      g.closePath();
      g.stroke();
      g.fill();
      const t = new THREE.CanvasTexture(c);
      sharpen(t);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    sizeAttenuation: false,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });

  // the scouts: a bike each, with a scout trooper sat on it
  const scouts = Array.from({ length: mission.scouts }, (_, i) => {
    const holder = new THREE.Group();
    holder.visible = false;
    group.add(holder);
    const body = new THREE.Group();
    holder.add(body);
    placer.put({ kind: mission.ride ?? 'speederbike', at: [0, 0], abs: true, solid: false }).then((o) => {
      if (!o || dead) return;
      body.add(o);
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
    });
    const fig = buildFigure('scouttrooper');
    const rider = createRider(fig, spec.seat);
    holder.add(rider.pivot);
    const mark = new THREE.Sprite(markMat);
    mark.scale.setScalar(0.022);
    mark.position.y = 2.7;
    mark.renderOrder = 8;
    holder.add(mark);
    return { id: i, holder, fig, rider, mark, pitch: 0, fall: null, aimFor: 0 };
  });
  const targets = scouts.map((s) => ({ id: s.id, holder: s.holder, fig: { tall: CHEST / 0.55 } }));

  // the flash where one goes down
  const flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb070').multiplyScalar(3), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flashGeo = new THREE.SphereGeometry(1, 14, 10);
  const flashes = [];
  const boom = (at) => {
    const m = new THREE.Mesh(flashGeo, flashMat.clone());
    m.position.copy(at);
    group.add(m);
    flashes.push({ m, age: 0 });
  };

  let route = null;
  let chase = null;
  let told = {};
  let result = null;
  // (where you were last, for a scout turning round to fire at you)
  const youAt = new V();
  let seen = false;

  let planned = 0;
  function begin() {
    if (!route) planned = world.solids.all.length;
    route ??= planRoute(mission.waypoints, world.solids);
    chase = newChase(mission, route);
    told = {};
    result = null;
    for (const s of scouts) {
      s.fall = null;
      s.aimFor = 0;
      s.holder.visible = true;
      s.mark.visible = true;
      s.rider.reset(s.holder);
    }
    place(0);
    say(mission.lines?.start);
    emit({ type: 'mission', view: view() });
  }

  function view() {
    if (!chase) return null;
    return { ...chaseView(chase), result };
  }

  // what each event the rules give does here
  const youV = new V();
  const muzzle = new V();
  function handle(evs, you) {
    let push = null;
    for (const e of evs) {
      if (e.type === 'down') {
        const s = scouts[e.id];
        const p = scoutAt(chase, e.id);
        s.fall = { age: 0, speed: chase.scouts[e.id].speed * 0.8, yaw: p.yaw, spin: e.how === 'tree' ? 1 : -1 };
        boom(s.holder.position.clone().add(new V(0, 0.7, 0)));
        // (its rider off it: thrown, the way its bike was going)
        s.rider.thrown(group, { speed: chase.scouts[e.id].speed, yaw: p.yaw, how: e.how });
        s.mark.visible = false;
        sounds?.crash?.();
        if (!told.first) {
          told.first = true;
          if (chaseView(chase).left > 0) say(mission.lines?.first);
        }
      } else if (e.type === 'bump') {
        push = e.push;
        sounds?.crash?.();
      } else if (e.type === 'shoot' && you) {
        const sc = scouts[e.id];
        const s = sc.holder.position;
        sc.aimFor = AIM.hold;
        // (from its hand, when it's round with its arm out; else from over its bike)
        const from = sc.rider.muzzle(muzzle);
        blaster.enemy(from ? [from.x, from.y, from.z] : [s.x, s.y + 1.2, s.z], youV.set(you.x, you.y + 1.1, you.z), 0.05, '#ff4a3d', 8);
      } else if (e.type === 'won' || e.type === 'lost') {
        const won = e.type === 'won';
        result = { won, t: chase.t, stars: won ? starsFor(mission, chase.t) : 0 };
        say(won ? mission.lines?.won : mission.lines?.lost);
      }
      if (e.type !== 'shoot') emit({ type: 'mission', event: e, view: view() });
    }
    return push;
  }

  // the scouts where the rules say, banked into their swerves, nosed up and
  // down with the land, their riders sat to it; and the ones going down,
  // rolling to a stop, their riders thrown
  function place(dt) {
    scouts.forEach((s, i) => {
      if (!chase) return;
      const h = s.holder;
      if (s.fall) {
        const f = s.fall;
        f.age += dt;
        f.speed = Math.max(0, f.speed - ROLL.slow * dt);
        h.position.x += Math.sin(f.yaw) * f.speed * dt;
        h.position.z += Math.cos(f.yaw) * f.speed * dt;
        h.position.y = groundAt(world, h.position.x, h.position.z) + 0.3;
        if (f.speed > 0) h.rotation.z += f.spin * ROLL.spin * dt * Math.min(1, f.speed / 10);
        const r = s.rider.pivot.position;
        s.rider.fly(dt, groundAt(world, r.x, r.z));
        if (f.age > ROLL.gone) {
          h.visible = false;
          s.rider.pivot.visible = false;
        }
        return;
      }
      const sc = chase.scouts[i];
      const p = scoutAt(chase, i);
      const g = groundAt(world, p.x, p.z);
      const ahead = groundAt(world, p.x + Math.sin(p.yaw) * 3, p.z + Math.cos(p.yaw) * 3);
      s.pitch += (Math.atan2(ahead - g, 3) * 0.6 - s.pitch) * Math.min(1, dt * 6 || 1);
      const bank = Math.max(-0.6, Math.min(0.6, -sc.vOff * 0.07));
      h.position.set(p.x, g + spec.hover + Math.sin(chase.t * 9 + i) * 0.03, p.z);
      h.rotation.set(-s.pitch, p.yaw, bank, 'YXZ');
      // (round to fire a moment before its shot, and a while after)
      s.aimFor = Math.max(0, s.aimFor - dt);
      const aiming = seen && chase.phase === 'run' && (s.aimFor > 0 || (sc.fireIn < AIM.lead && sc.fireIn > -0.1));
      s.rider.pose(dt, { bank, swerve: sc.vOff, at: aiming ? youAt : null });
    });
  }

  return {
    begin,
    restart: begin,
    // the chase on by dt; you: { x, y, z, vx, vz } (your bike). → a shove to
    // give your bike, if you rode into one
    update(dt, you) {
      let push = null;
      if (you) {
        youAt.set(you.x, you.y + 1.1, you.z);
        seen = true;
      }
      if (chase) {
        push = handle(stepChase(chase, dt, { you, solids: world.solids }), you);
        if (!told.close && chase.phase === 'run' && chaseView(chase).lead > 0.85) {
          told.close = true;
          say(mission.lines?.close);
        }
        place(dt);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.age += dt;
        f.m.scale.setScalar(0.6 + f.age * 9);
        f.m.material.opacity = Math.max(0, 1 - f.age * 2.5);
        if (f.age > 0.4) {
          f.m.removeFromParent();
          f.m.material.dispose();
          flashes.splice(i, 1);
        }
      }
      return { push };
    },
    // your bike's cannon: along the way you're looking, turned onto a scout
    // near that line that a tree isn't hiding, and stopped by the first
    // trunk in the way
    fire(from, dir, color) {
      if (!chase || chase.phase !== 'run') return;
      const hidden = (x, z) => {
        const l = Math.hypot(x - from.x, z - from.z) || 1;
        const t = firstSolid(from.x, from.z, (x - from.x) / l, (z - from.z) / l, world.solids, l);
        return t !== null;
      };
      const live = targets.filter((t) => !chase.scouts[t.id].down && !hidden(t.holder.position.x, t.holder.position.z));
      const pts = live.map((t) => ({ x: t.holder.position.x, y: t.holder.position.y + CHEST, z: t.holder.position.z }));
      const aim = aimAssist([from.x, from.y, from.z], [dir.x, dir.y, dir.z], pts);
      const d = aim ? new V(...aim) : dir.clone().normalize();
      const flat = Math.hypot(d.x, d.z) || 1;
      const wall = firstSolid(from.x, from.z, d.x / flat, d.z / flat, world.solids, 90);
      const hit = blaster.fire(from, d, live, color, wall === null ? Infinity : wall / flat);
      sounds?.blast?.();
      if (hit.target) {
        scouts[hit.target.id].rider.hit();
        handle(hitScout(chase, hit.target.id), null);
      }
    },
    knocked() {
      if (!chase || chase.phase !== 'run' || chase.stall > 0) return;
      knockYou(chase);
      emit({ type: 'mission', event: { type: 'knocked' }, view: view() });
    },
    // held: until it's begun (the trees still coming), through the count,
    // and for a moment after you're thrown off
    stalled: () => !chase || chase.phase === 'count' || chase.stall > 0,
    running: () => chase?.phase === 'run',
    // for the compass: the nearest scout still riding
    target(x, z) {
      if (!chase || chase.phase !== 'run') return null;
      let best = null;
      let bestD = Infinity;
      for (const s of chase.scouts) {
        if (s.down) continue;
        const p = scoutAt(chase, s.id);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestD) {
          bestD = d;
          best = [p.x, p.z];
        }
      }
      return best;
    },
    view,
    // (for tests, in development only: none of it ships)
    ...(import.meta.env.DEV
      ? {
        // (a spot `back` metres behind the nearest
        // scout on the route, facing along it)
        behind(back = 22) {
          if (!chase) return null;
          const s = chase.scouts.filter((x) => !x.down).sort((a, b) => a.s - b.s)[0];
          if (!s) return null;
          const p = route.at(Math.max(0, s.s - back));
          return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) };
        },
        // (how clear the route is of what's solid now,
        // against how many solids there were when it was planned)
        audit() {
          if (!route) return null;
          return { planned, now: world.solids.all.length, len: Math.round(route.len), laneHits: laneHits(route, mission.lanes, world.solids), downs: chase?.scouts.map((s) => s.how) };
        },
        // (finish it either way)
        force(how) {
          if (!chase) return;
          if (chase.phase === 'count') stepChase(chase, 3.1, {});
          if (how === 'win') for (const s of chase.scouts) for (let k = 0; k < (mission.hp ?? 3); k++) handle(hitScout(chase, s.id), null);
          else {
            const lead = chase.scouts.filter((s) => !s.down).sort((a, b) => b.s - a.s)[0];
            if (lead) lead.s = route.len - 0.01;
            handle(stepChase(chase, 0.05, {}), null);
          }
        },
      }
      : {}),
    dispose() {
      dead = true;
      for (const s of scouts) s.fig?.dispose?.();
      for (const f of flashes) f.m.material.dispose();
      flashGeo.dispose();
      flashMat.dispose();
      markMat.map.dispose();
      markMat.dispose();
      disposeTree(group);
      group.removeFromParent();
    },
  };
}
