// How each kind of event is played over the planet (lib/land/flight/
// eventTables.js's `play`): the weather through the galaxy's own weather
// (galaxy/surface/weather.js, its box of flakes or sand riding with the
// camera) and the fog; ships and people through the planet life's own models
// (./lifeScene.js's modelGeometry, one instanced draw a play); the ground's
// moments in a few code-built shapes. A play never touches the ground's
// heights: a surge raises the lava's colour band (the ground shader's
// uWet), a quake shakes the camera, a shower's craters are decals.
//
// Everything is drawn relative to the floating origin (`at`), seeded by the
// event's own seed, so pilots together see the same ships come from the same
// side. A play's `look` is what it asks of the light and the fog (the
// scene's to ease in and out: ./occurrenceScene.js).
//
//   makePlay(ev, ctx: { root, camera, field, fire(from, to), crater(x, y, z) })
//     → { look, step(ship, at, dt, age), dispose() }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../../lib/seeded';
import { createWeather } from '../../galaxy/surface/weather';
import { strikeAt } from '../../galaxy/surface/storm';
import { modelGeometry } from './lifeScene';

const GRAVITY = 30; // m/s², a little light: rocks hang long enough to be seen from a cockpit
const ROCKS = 40; // a shower's or an eruption's, at most, and the craters it leaves
const FIRE = { flight: 900, band: 320, every: 1.6 }; // m in reach, s between shots

// one instanced draw of a model, written each frame
function pool(geometry, cap, root, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, cap);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let n = 0;
  return {
    mesh,
    begin: () => (n = 0),
    put(x, y, z, yaw = 0, pitch = 0, scale = 1) {
      if (n >= cap) return;
      e.set(pitch, yaw, 0);
      mesh.setMatrixAt(n++, m.compose(p.set(x, y, z), q.setFromEuler(e), s.set(scale, scale, scale)));
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
    },
  };
}

const lit = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const tinted = (geo, hex) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  g.computeVertexNormals();
  return g;
};

// ── the weather ──
const FALL = { snow: { count: 4200, size: 0.22 }, sand: { count: 2600, size: 0.12 }, rain: { count: 3200, len: 0.05 }, ash: { count: 2600, size: 0.18 }, motes: { count: 1200, size: 0.12 }, spray: { count: 2000, size: 0.14 } };
function weatherPlay(ev, ctx) {
  const f = FALL[ev.fall] ?? FALL.sand;
  const w = createWeather({ weather: [{ kind: ev.fall, box: [220, 110, 220], ...f, ...(ev.color ? { color: ev.color } : {}) }] });
  ctx.root.add(w.group);
  return {
    look: { vis: ev.vis, tint: ev.tint },
    step(ship, at, dt, age, k) {
      w.gust = k;
      const ground = (x, z) => ctx.field.heightAt(x + at[0], z + at[2]) - at[1];
      w.update(age, ctx.camera, ground, typeof window === 'undefined' ? 800 : window.innerHeight);
      // (a storm's lightning: a flash of the sky's light now and then)
      this.look.flash = ev.flash ? strikeAt(age, { seed: ev.seed % 97, every: 7 }) : 0;
    },
    dispose() {
      w.group.removeFromParent();
      w.dispose();
    },
  };
}

// ── ships: across, or after you ──
function flightPlay(ev, ctx, ship0) {
  const rand = seeded(ev.seed);
  const n = Math.max(1, ev.n ?? 3);
  const row = { name: ev.kind, body: ev.body ?? 'craft', tint: ev.tint ?? '#7a7a8a' };
  const draw = pool(modelGeometry(ev.model ?? 'wedge', row, true), n, ctx.root, ctx.material);
  const speed = ev.speed ?? (ev.hostile ? 170 : 120);
  const a = rand() * Math.PI * 2;
  const dir = [Math.cos(a), Math.sin(a)];
  const half = (speed * ev.ttl) / 2;
  const altOf = (x, z) => ctx.field.heightAt(x, z) + (ev.low ? 25 : (ev.alt ?? 260));
  // (a crossing runs over the event's spot; hunters start off to one side of you)
  const from = ev.hostile ? [ship0.x - dir[0] * 2600, ship0.z - dir[1] * 2600] : [ev.at[0] - dir[0] * half, ev.at[1] - dir[1] * half];
  const ships = Array.from({ length: n }, (_, i) => {
    const side = (i - (n - 1) / 2) * 60;
    const x = from[0] - dir[1] * side - dir[0] * i * 40;
    const z = from[1] + dir[0] * side - dir[1] * i * 40;
    return { x, y: altOf(x, z), z, vx: dir[0] * speed, vy: 0, vz: dir[1] * speed, wait: FIRE.every * (1 + i * 0.37) };
  });
  return {
    step(ship, at, dt) {
      draw.begin();
      for (const s of ships) {
        if (ev.hostile) {
          // (turn toward you, keeping its speed and its height over the ground)
          const dx = ship.x - s.x;
          const dy = ship.y - s.y;
          const dz = ship.z - s.z;
          const d = Math.hypot(dx, dy, dz) || 1;
          const k = Math.min(1, dt * 0.9);
          s.vx += ((dx / d) * speed - s.vx) * k;
          s.vy += ((dy / d) * speed - s.vy) * k;
          s.vz += ((dz / d) * speed - s.vz) * k;
          s.wait -= dt;
          if (d < FIRE.flight && s.wait <= 0) {
            s.wait = FIRE.every;
            ctx.fire([s.x, s.y, s.z], [ship.x, ship.y, ship.z]);
          }
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.y = Math.max(s.y, ctx.field.heightAt(s.x, s.z) + 20);
        const yaw = Math.atan2(s.vx, s.vz);
        const pitch = -Math.atan2(s.vy, Math.hypot(s.vx, s.vz));
        draw.put(s.x - at[0], s.y - at[1], s.z - at[2], yaw, pitch);
      }
      draw.end();
    },
    dispose: () => draw.dispose(),
  };
}

// ── people and beasts: across, or closing on you ──
function bandPlay(ev, ctx, ship0) {
  const rand = seeded(ev.seed);
  const n = Math.max(1, ev.n ?? 8);
  const row = { name: ev.kind, body: ev.body ?? 'person', tint: ev.tint ?? '#7a6a5a' };
  const draw = pool(modelGeometry(ev.model ?? 'villager', row, false), n, ctx.root, ctx.material);
  const speed = ev.speed ?? 6;
  const a = rand() * Math.PI * 2;
  const dir = [Math.cos(a), Math.sin(a)];
  const lift = ev.lift ?? 0;
  // (closing in: a ring round where you were; crossing: a crowd behind the spot, walking through it)
  const centre = ev.converge ? [ship0.x, ship0.z] : [ev.at[0] - dir[0] * speed * ev.ttl * 0.5, ev.at[1] - dir[1] * speed * ev.ttl * 0.5];
  const ring = ev.converge ? 700 : 0;
  const folk = Array.from({ length: n }, (_, i) => {
    const b = ev.converge ? (i / n) * Math.PI * 2 + rand() * 0.4 : rand() * Math.PI * 2;
    const r = ring + Math.sqrt(rand()) * (ev.converge ? 120 : 30 + n * 6);
    return { x: centre[0] + Math.cos(b) * r, z: centre[1] + Math.sin(b) * r, yaw: 0, wait: FIRE.every * (1 + rand()) };
  });
  return {
    look: ev.dusk ? { dim: ev.dusk, warm: true } : null,
    step(ship, at, dt) {
      draw.begin();
      for (const f of folk) {
        let vx = dir[0];
        let vz = dir[1];
        if (ev.converge) {
          const d = Math.hypot(ship.x - f.x, ship.z - f.z) || 1;
          [vx, vz] = d > 25 ? [(ship.x - f.x) / d, (ship.z - f.z) / d] : [0, 0];
        }
        f.x += vx * speed * dt;
        f.z += vz * speed * dt;
        if (vx || vz) f.yaw = Math.atan2(vx, vz);
        const y = ctx.field.heightAt(f.x, f.z) + lift;
        if (ev.hostile) {
          f.wait -= dt;
          if (f.wait <= 0 && Math.hypot(ship.x - f.x, ship.y - y, ship.z - f.z) < FIRE.band) {
            f.wait = FIRE.every * 1.3;
            ctx.fire([f.x, y + 2, f.z], [ship.x, ship.y, ship.z]);
          }
        }
        draw.put(f.x - at[0], y - at[1], f.z - at[2], f.yaw);
      }
      draw.end();
    },
    dispose: () => draw.dispose(),
  };
}

// ── rocks: thrown from a cone, or falling from the sky ──
function rocksPlay(ev, ctx, { from, every, burst, look, sky }) {
  const rand = seeded(ev.seed);
  const draw = pool(tinted(new THREE.IcosahedronGeometry(sky ? 4 : 8, 0), sky ? '#3a3430' : '#2a1a14'), ROCKS, ctx.root, ctx.material);
  const rocks = [];
  let next = 0;
  const extras = [];
  if (!sky) {
    const cone = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), glow('#ff6a20'));
    extras.push(cone);
    ctx.root.add(cone);
  }
  const w = look.fall ? createWeather({ weather: [{ kind: look.fall, box: [220, 110, 220], ...FALL[look.fall] }] }) : null;
  if (w) ctx.root.add(w.group);
  return {
    look: { vis: look.vis, tint: look.tint },
    step(ship, at, dt, age, k) {
      next -= dt;
      while (next <= 0) {
        next += every;
        for (let b = 0; b < burst && rocks.length < ROCKS; b++) {
          const a = rand() * Math.PI * 2;
          if (sky) {
            // (out of the rings: in high and slanting, round where you are)
            const r = 200 + rand() * 1400;
            const x = ship.x + Math.cos(a) * r;
            const z = ship.z + Math.sin(a) * r;
            rocks.push({ x: x - 500, y: ctx.field.heightAt(x, z) + 1400, z: z - 200, vx: 140, vy: -260, vz: 56 });
          } else {
            const up = 120 + rand() * 90;
            const out = 20 + rand() * 60;
            rocks.push({ x: from[0], y: from[1] + 20, z: from[2], vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out });
          }
        }
      }
      draw.begin();
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        r.vy -= GRAVITY * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.z += r.vz * dt;
        const g = ctx.field.heightAt(r.x, r.z);
        if (r.y <= g) {
          if (sky) ctx.crater(r.x, g, r.z);
          rocks.splice(i, 1);
          continue;
        }
        draw.put(r.x - at[0], r.y - at[1], r.z - at[2], r.x * 0.01, r.z * 0.01);
      }
      draw.end();
      for (const c of extras) {
        c.position.set(from[0] - at[0], from[1] - at[1], from[2] - at[2]);
        c.scale.setScalar(0.6 + 0.4 * k + 0.08 * Math.sin(age * 9));
      }
      if (w) {
        w.gust = k;
        w.update(age, ctx.camera, (x, z) => ctx.field.heightAt(x + at[0], z + at[2]) - at[1], typeof window === 'undefined' ? 800 : window.innerHeight);
      }
    },
    dispose() {
      draw.dispose();
      for (const c of extras) {
        c.removeFromParent();
        c.geometry.dispose();
        c.material.dispose();
      }
      if (w) {
        w.group.removeFromParent();
        w.dispose();
      }
    },
  };
}

// ── a shape that rises, stands and sinks: a portal, tentacles, something vast, a rocket ──
function shapePlay(ev, ctx, build, move) {
  const object = build();
  ctx.root.add(object);
  const base = ctx.field.heightAt(ev.at[0], ev.at[1]);
  // (out of the water where there is some: the sheet's level, else the ground)
  const y0 = ev.water || ev.play === 'tentacles' ? Math.max(base, ctx.spec.water?.level ?? 0) : base;
  return {
    step(ship, at, dt, age, k) {
      object.position.set(ev.at[0] - at[0], y0 - at[1], ev.at[1] - at[2]);
      move(object, age, k);
    },
    dispose() {
      object.removeFromParent();
      object.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
    },
  };
}

function tentacles(tint = '#3a2a3a') {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(new THREE.CylinderGeometry(1.5, 6, 70, 6, 4).translate(Math.cos(a) * 40, 35, Math.sin(a) * 40));
  }
  const g = tinted(mergeGeometries(parts.map((p) => p.toNonIndexed())), tint);
  for (const p of parts) p.dispose();
  return new THREE.Mesh(g, lit());
}

function rocket() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tinted(mergeGeometries([new THREE.CylinderGeometry(4, 4, 40, 10).translate(0, 20, 0).toNonIndexed(), new THREE.ConeGeometry(4, 10, 10).translate(0, 45, 0).toNonIndexed()]), '#e8e4dc'), lit()));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(5, 60, 10).rotateX(Math.PI).translate(0, -30, 0), glow('#ffb040'));
  g.add(flame);
  return g;
}

// ── fireworks: bursts of sparks over the spot ──
function fireworksPlay(ev, ctx) {
  const rand = seeded(ev.seed);
  const N = 480;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  points.frustumCulled = false;
  ctx.root.add(points);
  const COLOURS = ['#ff5a5a', '#ffd040', '#5ad0ff', '#a0ff70', '#ff80e0'].map((h) => new THREE.Color(h));
  const ground = ctx.field.heightAt(ev.at[0], ev.at[1]);
  let next = 0;
  let cursor = 0;
  const world = new Float32Array(N * 3);
  return {
    step(ship, at, dt) {
      next -= dt;
      if (next <= 0) {
        next = 1.1;
        const c = COLOURS[Math.floor(rand() * COLOURS.length)];
        const cx = ev.at[0] + (rand() - 0.5) * 500;
        const cy = ground + 300 + rand() * 200;
        const cz = ev.at[1] + (rand() - 0.5) * 500;
        for (let i = 0; i < 80; i++, cursor = (cursor + 1) % N) {
          const u = rand() * 2 - 1;
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u) * 60;
          world.set([cx, cy, cz], cursor * 3);
          vel.set([Math.cos(a) * r, u * 60, Math.sin(a) * r], cursor * 3);
          c.toArray(col, cursor * 3);
          life[cursor] = 1.6;
        }
        geo.attributes.color.needsUpdate = true;
      }
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) {
          pos[i * 3 + 1] = -1e5;
          continue;
        }
        life[i] -= dt;
        vel[i * 3 + 1] -= GRAVITY * 0.4 * dt;
        for (let j = 0; j < 3; j++) world[i * 3 + j] += vel[i * 3 + j] * dt;
        pos[i * 3] = world[i * 3] - at[0];
        pos[i * 3 + 1] = world[i * 3 + 1] - at[1];
        pos[i * 3 + 2] = world[i * 3 + 2] - at[2];
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() {
      points.removeFromParent();
      geo.dispose();
      points.material.dispose();
    },
  };
}

const fade = (age, ttl, inS = 4) => Math.max(0, Math.min(1, age / inS, (ttl - age) / inS));

export function makePlay(ev, ctx, ship) {
  switch (ev.play) {
    case 'weather':
      return weatherPlay(ev, ctx);
    case 'dusk':
      return { look: { dim: ev.depth ?? 0.6, warm: ev.warm }, step() {}, dispose() {} };
    case 'flight':
      return flightPlay(ev, ctx, ship);
    case 'band':
      return bandPlay(ev, ctx, ship);
    case 'eruption': {
      const y = ctx.field.heightAt(ev.at[0], ev.at[1]);
      return rocksPlay(ev, ctx, { from: [ev.at[0], y, ev.at[1]], every: 0.25, burst: 2, look: { fall: ev.fall ?? 'ash', vis: ev.vis, tint: ev.tint } });
    }
    case 'shower':
      return rocksPlay(ev, ctx, { from: null, every: 0.6, burst: 1, sky: true, look: { vis: 4000, tint: '#a07a5a' } });
    case 'surge':
      return { look: { surge: ev.rise ?? 4 }, step() {}, dispose() {} };
    case 'quake':
      return {
        step(ship, at, dt, age) {
          const k = fade(age, ev.ttl, 1.5);
          ctx.camera.position.x += Math.sin(age * 41) * 1.6 * k;
          ctx.camera.position.y += Math.sin(age * 53 + 1) * 1.2 * k;
        },
        dispose() {},
      };
    case 'portal':
      return shapePlay(
        ev,
        ctx,
        () => new THREE.Mesh(new THREE.TorusGeometry(90, 9, 10, 48), glow(ev.tint ?? '#80c8ff')),
        (o, age, k) => {
          o.position.y += 120;
          o.rotation.y = age * 0.4;
          o.scale.setScalar(Math.max(0.01, k));
        },
      );
    case 'tentacles':
      return shapePlay(
        ev,
        ctx,
        () => tentacles(ev.tint),
        (o, age, k) => {
          o.position.y -= (1 - k) * 80;
          o.rotation.y = Math.sin(age * 0.5) * 0.4;
          o.scale.set(1, 0.8 + 0.2 * Math.sin(age * 1.7), 1);
        },
      );
    case 'rise': {
      const size = ev.size ?? 20;
      return shapePlay(
        ev,
        ctx,
        () => new THREE.Mesh(tinted(new THREE.SphereGeometry(size, 16, 10), ev.tint ?? '#4a4a3a'), lit()),
        (o, age, k) => {
          o.position.y += ev.sky ? 1600 : -size + k * size * 0.9;
          o.scale.set(1, ev.sky ? 1 : 0.6, 1.4);
        },
      );
    }
    case 'launch':
      return shapePlay(ev, ctx, rocket, (o, age) => {
        const t = Math.max(0, age - 3);
        o.position.y += 0.5 * 12 * t * t;
        o.children[1].visible = age > 2;
      });
    case 'fireworks':
      return fireworksPlay(ev, ctx);
    default:
      return { step() {}, dispose() {} };
  }
}

export { fade };
