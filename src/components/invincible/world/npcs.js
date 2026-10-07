// Who's about the city, and what they say when Mark comes by: Debbie on
// the porch at home, Cecil outside the GDA's door with his arms folded,
// Atom Eve flying her patrol round downtown (she stops to talk if he
// catches her up, comes to his side when the Flaxans are on him, and
// cheers when they're beaten), and the townspeople at Burger Mart, outside
// the school and on the Guardians' plaza. What each of them does is
// ./townsfolk.js's (looking at him, waving, talking, the phone, running
// from a crater and walking back); the people are ./people.js's, and what
// they say ./lines.js's; this places them, plays it on them and says who's
// near.

import * as THREE from 'three';
import { personFor } from './people';
import { CAST } from '../cast';
import { LINES } from './lines';
import { surfaceAt } from './flight';
import { groundAt } from './map';
import { createFolk, eveChoice, stepFolk } from './townsfolk';

export const CIVS = ['civA', 'civB', 'civC'];

const NAMES = { debbie: 'Mom', cecil: 'Cecil', eve: 'Atom Eve', omni: 'Dad', manager: 'Burger Mart manager', student: 'A classmate', fan: 'Someone from the city' };

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Eve stops for him when he catches her up (within `stop` metres) and waits
// while he's about (within `go`: the gap between the two is so that hanging
// at the edge doesn't stop and start her). She waits `patience` seconds with
// him by her, `aloof` hanging back out of talking range; then she flies on,
// and doesn't stop for him again until he's been off past `go`, so he can't
// keep her in the air for ever, parked on a roof under her loop or hovering
// just outside it.
export const EVE = { stop: 55, go: 75, patience: 45, aloof: 6 };
// at his side in a fight: how far off, how high, how fast she gets there
const ASSIST = { r: 26, up: 7, speed: 70, near: 250, cheer: 3.5 };

// a person stood somewhere: a holder at their hips, so they can lean and fly
// (`cast`: the HD figures' templates by kind, ./people.js's loadCast)
function stand(scene, cast, kind, seed, { x, z, y = 0, face = 0, mode = 'idle', role = kind, r = 9 }) {
  // a townsperson is one of the cast's three, by seed
  const who = kind === 'person' ? CIVS[seed % CIVS.length] : kind;
  const person = personFor(kind, seed, cast[who], CAST[who]);
  const holder = new THREE.Group();
  const hipY = person.hipY;
  holder.add(person.root);
  holder.position.set(x, y + hipY, z);
  holder.rotation.y = face;
  scene.add(holder);
  const phase = seed * 1.7;
  const folk = createFolk({ id: `${role}-${phase}`, role, x, y, z, face, base: mode, r, seed, stays: role === 'debbie' || role === 'cecil', calm: role === 'cecil' });
  return { id: `${role}-${phase}`, kind, role, person, holder, hipY, home: [x, y, z], face, look: face, mode, base: mode, r, phase, folk, name: NAMES[role] ?? NAMES[kind], lines: LINES[role] ?? LINES[kind] ?? LINES.fan };
}

export function createNpcs(scene, world, cast = {}) {
  const P = Object.fromEntries(world.places.map((p) => [p.id, p]));
  const L = Object.fromEntries(world.landmarks.map((l) => [l.id, l]));
  const all = [];

  // Mom, on the porch
  {
    const h = world.houses.find((q) => q.home);
    const s = h.yaw === 0 ? 1 : -1;
    const fz = h.z + s * (h.d / 2);
    all.push(stand(scene, cast, 'debbie', 1, { x: h.x - 1.3, z: fz + s * 1.4, y: 0.3, face: s > 0 ? 0 : Math.PI, mode: 'idle', r: 10 }));
  }
  // Cecil, at the GDA's door
  {
    const g = P.gda;
    all.push(stand(scene, cast, 'cecil', 2, { x: g.door[0] + 2.5, z: g.door[1] - 1, face: 0, mode: 'arms', r: 12 }));
  }
  // Burger Mart: the manager at the door, two in line
  {
    const b = P.burgermart;
    all.push(stand(scene, cast, 'person', 3, { x: b.door[0] - 1.5, z: b.door[1] + 1.5, face: Math.PI / 2, mode: 'arms', role: 'manager' }));
    all.push(stand(scene, cast, 'person', 4, { x: b.door[0] + 1.5, z: b.door[1] - 2, face: -Math.PI / 2, mode: 'talk', role: 'fan' }));
    all.push(stand(scene, cast, 'person', 5, { x: b.door[0] + 2.2, z: b.door[1] - 0.6, face: -Math.PI / 2 - 0.5, mode: 'idle', role: 'fan' }));
  }
  // the school steps
  {
    const s = P.school;
    for (let i = 0; i < 4; i++) all.push(stand(scene, cast, 'person', 10 + i, { x: s.door[0] - 6 + i * 3.6, z: s.door[1] + 3 + (i % 2) * 1.5, face: Math.PI + (i - 1.5) * 0.4, mode: i % 2 ? 'talk' : 'idle', role: 'student' }));
  }
  // the plaza: people round the hall
  {
    const g = L.guardians;
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + i * 0.42;
      all.push(stand(scene, cast, 'person', 20 + i, { x: g.x + Math.cos(a) * 23, z: g.z + Math.sin(a) * 23, face: a + Math.PI, mode: i % 3 === 0 ? 'talk' : 'idle', role: 'fan', r: 8 }));
    }
  }
  // Atom Eve, on patrol
  const eve = stand(scene, cast, 'eve', 7, { x: 0, z: 0, y: 160, mode: 'fly', r: 40 });
  eve.flying = true;
  eve.path = { s: 0, cx: 120, cz: -140, rad: 460, speed: 32, y: 165 };
  eve.p = new THREE.Vector3();
  eve.v = new THREE.Vector3();
  eve.lean = new THREE.Quaternion();
  eve.wait = false; // (stopped for him)
  eve.patience = 0;
  eve.done = false; // (she's flown on from him, until he's been off past EVE.go)
  eve.choice = 'patrol';
  eve.orbit = 0; // (round him, in a fight)
  eve.cheer = 0;
  eve.talking = false;
  all.push(eve);

  const tmpQ = new THREE.Quaternion();
  const yawQ = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const want = new THREE.Vector3();
  const before = new THREE.Vector3();
  const eyes = new THREE.Vector3();
  // where they can't go: into a building, or the river
  const blocked = (x, z) => {
    const s = surfaceAt(world, x, z, Infinity);
    return s.water || s.y > groundAt(x, z) + 1.5;
  };

  // ctx: { talking (the id of whoever he's talking to), scares ([{ x, z, r }]
  // this frame), won (the Flaxans beaten this frame), fight (the invasion's state) }
  function update(frameDt, t, hero, { talking = null, scares = [], won = false, fight = null } = {}) {
    // (a tab hidden a minute and back is one short step, as the rules' are)
    const dt = Math.min(frameDt, 0.05);
    const hp = hero.p;
    const him = { x: hp[0], y: hp[1], z: hp[2], air: hero.mode === 'air' };
    for (const n of all) {
      if (n.flying) continue;
      const out = stepFolk(n.folk, dt, { hero: him, talking: talking === n.id, scares, won, blocked });
      n.holder.position.set(out.x, n.home[1] + n.hipY, out.z);
      n.holder.rotation.y = out.yaw;
      n.look = out.yaw;
      n.mode = out.mode;
      const d = Math.hypot(hp[0] - out.x, hp[2] - out.z, hp[1] - n.home[1]);
      // (only drawn and posed near enough to see)
      n.holder.visible = d < 260;
      if (!n.holder.visible) continue;
      if (out.react) n.person.react(out.react, { target: out.at ? { x: out.at.x, y: n.home[1] + 1, z: out.at.z } : null, moving: out.ground > 0.5 });
      n.person.look(out.look);
      n.person.pose({ mode: out.mode, t, phase: n.phase, ground: out.ground }, dt);
    }

    // Eve: round the loop, unless Mark's caught her up, when she stops to
    // talk (he's only ever here in the city: out in space this isn't run,
    // and he comes back from it 8 km up, well clear of her); at his side
    // while the Flaxans are on him; a cheer when they're beaten
    const e = eve;
    const d = Math.hypot(hp[0] - e.p.x, hp[1] - e.p.y, hp[2] - e.p.z);
    if (!(d <= EVE.go)) {
      e.wait = false;
      e.done = false;
    } else if (!e.wait && !e.done && d < EVE.stop) {
      e.wait = true;
      e.patience = EVE.patience;
      e.person.play('wave', { layer: 'upper' }); // (hello)
    }
    if (e.wait) {
      e.patience -= d < e.r ? dt : (dt * EVE.patience) / EVE.aloof;
      if (e.patience <= 0) {
        e.wait = false;
        e.done = true;
      }
    }
    if (won) {
      e.cheer = ASSIST.cheer;
      e.person.play('cheer', { layer: 'upper' });
    }
    e.cheer = Math.max(0, e.cheer - dt);
    const foes = fight?.on ? fight.foes.filter((f) => f.state === 'fight') : [];
    const near = foes.some((f) => Math.hypot(f.p[0] - hp[0], f.p[1] - hp[1], f.p[2] - hp[2]) < ASSIST.near);
    e.choice = eveChoice({ fight: near, cheer: e.cheer, wait: e.wait });
    // round her loop (still while she's stopped for him)
    const speed = e.wait && e.choice === 'meet' ? 0 : e.path.speed;
    e.path.s += (speed / e.path.rad) * dt;
    const a = e.path.s;
    if (e.choice === 'assist') {
      // off his shoulder, going round him
      e.orbit += dt * 0.35;
      want.set(hp[0] + Math.cos(e.orbit) * ASSIST.r, hp[1] + ASSIST.up + Math.sin(e.orbit * 1.3) * 3, hp[2] + Math.sin(e.orbit) * ASSIST.r);
    } else if (e.choice === 'cheer') want.copy(e.p);
    else want.set(e.path.cx + Math.cos(a) * e.path.rad, e.path.y + Math.sin(a * 3) * 25, e.path.cz + Math.sin(a) * e.path.rad * 0.7);
    if (t < 0.1) e.p.copy(want);
    before.copy(e.p);
    // eased there, never faster than she flies
    dir.copy(want).sub(e.p);
    const gap = dir.length();
    const step = Math.min(gap * (1 - Math.exp(-2 * dt)), ASSIST.speed * dt);
    if (gap > 1e-6) e.p.addScaledVector(dir, step / gap);
    e.v.copy(e.p).sub(before).divideScalar(Math.max(1e-4, dt));
    const sp = e.v.length();
    // face where she's going, or him when she's stopped (in a fight, the nearest of them)
    let foe = null;
    for (const f of foes) if (!foe || Math.hypot(f.p[0] - e.p.x, f.p[2] - e.p.z) < Math.hypot(foe.p[0] - e.p.x, foe.p[2] - e.p.z)) foe = f;
    const at = e.choice === 'assist' && foe ? { x: foe.p[0], y: foe.p[1], z: foe.p[2] } : { x: hp[0], y: hp[1] + 1.6, z: hp[2] };
    const yaw = sp > 3 ? Math.atan2(e.v.x, e.v.z) : Math.atan2(at.x - e.p.x, at.z - e.p.z);
    e.look += angle(yaw - e.look) * (1 - Math.exp(-4 * dt));
    e.holder.position.copy(e.p);
    e.holder.rotation.set(0, e.look, 0);
    // along her flight when she's going, upright when she's not (her crown
    // turned along it; or, when her fly clip lies along it itself, her front)
    const k = Math.min(1, Math.max(0, (sp - 6) / 20));
    const axis = k > 0.4 && e.person.clips.includes('fly') ? Z : Y;
    dir.copy(sp > 0.1 ? e.v : axis).normalize();
    yawQ.setFromAxisAngle(Y, -e.look);
    dir.applyQuaternion(yawQ);
    dir.lerpVectors(axis, dir, k).normalize();
    tmpQ.setFromUnitVectors(axis, dir);
    e.lean.slerp(tmpQ, 1 - Math.exp(-5 * dt));
    e.holder.quaternion.multiply(e.lean);
    // talking while he talks to her; her eyes on him near, or on the Flaxan she's watching
    const talks = talking === e.id && d < e.r;
    if (talks !== e.talking) {
      e.talking = talks;
      if (talks) e.person.play('talk', { layer: 'upper', loop: true });
      else e.person.stop(0.4, 'upper');
    }
    e.person.look(k < 0.4 && (d < 80 || e.choice === 'assist') ? eyes.set(at.x, at.y, at.z) : null);
    e.person.pose({ mode: k > 0.4 ? 'fly' : 'hover', t, phase: e.phase }, dt);
  }

  // who's near enough to talk: [{ id, name, lines, head: [x, y, z], d }]
  function talkers(hero) {
    const out = [];
    for (const n of all) {
      const p = n.flying ? n.p : n.holder.position;
      const d = Math.hypot(hero.p[0] - p.x, hero.p[1] + 1 - p.y, hero.p[2] - p.z);
      if (d < n.r) out.push({ id: n.id, role: n.role, name: n.name, lines: n.lines, head: [p.x, p.y + n.person.height * 0.55, p.z], d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  // whoever's waving at him now (for him to wave back)
  const waving = () => all.some((n) => !n.flying && n.holder.visible && n.mode === 'wave');

  return { all, eve, update, talkers, waving };
}
