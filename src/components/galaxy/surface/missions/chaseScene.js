// A chase, drawn and run in the surface scene: the scouts on their speeder
// bikes (placer's bike, figures.js's scout trooper on it), placed each frame
// from the rules (./chase.js), their shots at you through the surface's
// blaster, your bike's cannon at them, and a bike going down: a flash, and
// it skids, rolling, to a stop. The scene hands it the world once the
// trees are solid (begin), then calls update each frame.
//
// createChaseMission({ parent, world, placer, blaster, mission, emit, say,
// sounds }) → { begin(), restart(), update(dt, you) → { push }, fire(from,
// dir, color), knocked(), stalled(), target(), view(), force(result),
// dispose() }

import * as THREE from 'three';
import { disposeTree } from '../../../../lib/three/renderer';
import { buildFigure } from '../figures';
import { RIDES } from '../rides';
import { groundAt } from '../walker';
import { aimAssist, chaseView, firstSolid, hitScout, knockYou, laneHits, newChase, planRoute, scoutAt, starsFor, stepChase } from './chase';

const V = THREE.Vector3;
const CHEST = 0.88; // metres over the bike's frame: where a bolt aims for, and lands
const ROLL = { slow: 22, spin: 7, gone: 5 }; // a bike going down: m/s² it slows, rad/s it rolls, seconds till it's cleared away

export function createChaseMission({ parent, world, placer, blaster, mission, emit, say, sounds }) {
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
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    sizeAttenuation: false,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });

  // the scouts: a bike each, with a scout trooper on it
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
    if (fig) {
      fig.model.position.set(spec.seat[0], spec.seat[1] - 0.55, spec.seat[2]);
      holder.add(fig.model);
    }
    const mark = new THREE.Sprite(markMat);
    mark.scale.setScalar(0.022);
    mark.position.y = 2.7;
    mark.renderOrder = 8;
    holder.add(mark);
    return { id: i, holder, fig, mark, pitch: 0, fall: null };
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

  let planned = 0;
  function begin() {
    if (!route) planned = world.solids.all.length;
    route ??= planRoute(mission.waypoints, world.solids);
    chase = newChase(mission, route);
    told = {};
    result = null;
    for (const s of scouts) {
      s.fall = null;
      s.holder.visible = true;
      s.mark.visible = true;
      if (s.fig) s.fig.model.visible = true;
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
  function handle(evs, you) {
    let push = null;
    for (const e of evs) {
      if (e.type === 'down') {
        const s = scouts[e.id];
        const p = scoutAt(chase, e.id);
        s.fall = { age: 0, speed: chase.scouts[e.id].speed * 0.8, yaw: p.yaw, spin: e.how === 'tree' ? 1 : -1 };
        boom(s.holder.position.clone().add(new V(0, 0.7, 0)));
        if (s.fig) s.fig.model.visible = false;
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
        const s = scouts[e.id].holder.position;
        blaster.enemy([s.x, s.y + 1.2, s.z], youV.set(you.x, you.y + 1.1, you.z), 0.05, '#ff4a3d', 8);
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
  // down with the land; and the ones going down, rolling to a stop
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
        if (f.age > ROLL.gone) h.visible = false;
        return;
      }
      const p = scoutAt(chase, i);
      const g = groundAt(world, p.x, p.z);
      const ahead = groundAt(world, p.x + Math.sin(p.yaw) * 3, p.z + Math.cos(p.yaw) * 3);
      s.pitch += (Math.atan2(ahead - g, 3) * 0.6 - s.pitch) * Math.min(1, dt * 6 || 1);
      const bank = Math.max(-0.6, Math.min(0.6, -chase.scouts[i].vOff * 0.07));
      h.position.set(p.x, g + spec.hover + Math.sin(chase.t * 9 + i) * 0.03, p.z);
      h.rotation.set(-s.pitch, p.yaw, bank, 'YXZ');
      s.fig?.update(dt, 0);
    });
  }

  return {
    begin,
    restart: begin,
    // the chase on by dt; you: { x, y, z, vx, vz } (your bike). → a shove to
    // give your bike, if you rode into one
    update(dt, you) {
      let push = null;
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
      if (hit.target) handle(hitScout(chase, hit.target.id), null);
    },
    knocked() {
      if (!chase || chase.phase !== 'run' || chase.stall > 0) return;
      knockYou(chase);
      emit({ type: 'mission', event: { type: 'knocked' }, view: view() });
    },
    // held: through the count, and for a moment after you're thrown off
    stalled: () => Boolean(chase && (chase.phase === 'count' || chase.stall > 0)),
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
    // (for tests, in development: a spot `back` metres behind the nearest
    // scout on the route, facing along it)
    behind(back = 22) {
      if (!chase) return null;
      const s = chase.scouts.filter((x) => !x.down).sort((a, b) => a.s - b.s)[0];
      if (!s) return null;
      const p = route.at(Math.max(0, s.s - back));
      return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) };
    },
    // (for tests, in development: how clear the route is of what's solid now,
    // against how many solids there were when it was planned)
    audit() {
      if (!route) return null;
      return { planned, now: world.solids.all.length, len: Math.round(route.len), laneHits: laneHits(route, mission.lanes, world.solids), downs: chase?.scouts.map((s) => s.how) };
    },
    // (for tests, in development: finish it either way)
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
