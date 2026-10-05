// Paper toss in 3D: the bullpen from Jim's chair, looking down the aisle to
// the glass of Michael's office, with the round's bin, the fan and its wind,
// Dwight's desk when it is in the way, and every crumpled sheet where it
// landed. It draws the rules' state (./toss.js); it doesn't keep any.
//
// The office is in: Stanley, Phyllis, Kevin and Andy at their desks down the
// sides, Dwight at his when he has moved it into the way, Michael behind his
// glass. They watch the ball fly and look where it lands; a basket gets a
// cheer from Kevin and Michael (and Andy, for a swish). Dwight glares at Jim
// for a miss. Stanley does not look up.
//
// The rules count x to the thrower's right with z away from them; three's
// world is right-handed, so the thrower's right is its -x. `wx` turns one into
// the other (everything else is shared).

import * as THREE from 'three';
import { loadKit, merge } from './kit';
import { loadPeople } from './people';
import { createStage, lightOffice } from './stage3d';
import { TOSS, predict } from './toss';

const H = 2.7; // the drop ceiling
const BACK = -1.6; // the wall behind Jim
const wx = (x) => -x;

export async function createToss3D(canvas, { onLost, onSlow } = {}) {
  const stage = createStage(canvas, { onLost, onSlow, fov: 58 });
  const { scene, camera } = stage;
  const [kit, people] = await Promise.all([loadKit(stage.renderer), loadPeople(['michael', 'dwight', 'stanley', 'phyllis', 'kevin', 'andy'])]);
  // who is in: id -> their figure, sat in a chair
  const cast = {};
  const seat = (id, parent, chair, opts) => {
    const p = people.person(id, opts);
    if (!p) return;
    p.group.position.copy(chair.position);
    p.group.rotation.y = chair.rotation.y;
    parent.add(p.group);
    cast[id] = p;
  };
  scene.background = new THREE.Color(0xd9d6cf);
  const lights = lightOffice(stage, kit, { target: new THREE.Vector3(0, 0, 4), span: 8, shadowSize: 2048 });
  lights.key.position.set(1.5, 6, 2.5);
  lights.key.intensity = 1.5;
  scene.environmentIntensity = 0.7;

  const X = TOSS.room.x;
  const Z = TOSS.room.z;

  // ── The room ─────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, Z - BACK), kit.surface('carpet', 2 * X, Z - BACK, 1.1, { color: 0xd8dce6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (Z + BACK) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, Z - BACK), kit.surface('ceiling', 2 * X, Z - BACK, 1.2, { color: 0xf4f2ec }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, (Z + BACK) / 2);
  scene.add(ceiling);
  // fluorescent troffers, two rows down the aisle
  for (let z = 0.6; z < Z; z += 2.4)
    for (const x of [-1.5, 1.5]) {
      const l = kit.lightPanel();
      l.position.set(x, H - 0.02, z);
      scene.add(l);
    }
  const wallMat = kit.surface('wall', 1, 1, 1.5, { color: 0xf3eddf });
  wallMat.map = null;
  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  wall(Z - BACK, H, -X, H / 2, (Z + BACK) / 2, Math.PI / 2);
  wall(Z - BACK, H, X, H / 2, (Z + BACK) / 2, -Math.PI / 2);
  wall(2 * X, H, 0, H / 2, BACK, 0);
  // skirting
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6 });
  for (const [w2, x, z, ry] of [
    [Z - BACK, -X + 0.006, (Z + BACK) / 2, Math.PI / 2],
    [Z - BACK, X - 0.006, (Z + BACK) / 2, -Math.PI / 2],
  ]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w2, 0.1), skirtMat);
    s.position.set(x, 0.05, z);
    s.rotation.y = ry;
    scene.add(s);
  }

  // The far wall: Michael's office, glass with his blinds half open, his door,
  // and the conference room's glass beside it; their rooms behind.
  {
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe2ee, transparent: true, opacity: 0.18, roughness: 0.03, envMapIntensity: 1.6, depthWrite: false });
    const frame = kit.M.metal;
    const blindsTex = (() => {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 32;
      const x = c.getContext('2d');
      for (let y = 0; y < 32; y += 8) {
        x.fillStyle = 'rgba(232,230,222,0.92)';
        x.fillRect(0, y, 8, 3);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 9);
      return t;
    })();
    const pane = (x0, x1) => {
      const w2 = x1 - x0;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w2, H - 0.05), glassMat);
      g.position.set((x0 + x1) / 2, (H - 0.05) / 2, Z);
      g.rotation.y = Math.PI;
      g.renderOrder = 2;
      scene.add(g);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w2, H - 0.3), new THREE.MeshStandardMaterial({ map: blindsTex, transparent: true, alphaTest: 0.3, roughness: 0.8, side: THREE.DoubleSide }));
      b.position.set(g.position.x, H / 2 + 0.08, Z + 0.06);
      scene.add(b);
      for (const xx of [x0, x1]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, 0.06), frame);
        mullion.position.set(xx, H / 2, Z);
        scene.add(mullion);
      }
    };
    pane(-X, -1.4);
    pane(-0.4, 1.6);
    pane(1.7, X);
    // Michael's door, open
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.1, 0.04), kit.surface('wood', 0.92, 2.1, 1.2, { color: 0xf6cf9c }));
    door.position.set(-0.9 + 0.46 * Math.cos(1.1), 1.05, Z + 0.46 * Math.sin(1.1));
    door.rotation.y = -1.1;
    door.castShadow = true;
    scene.add(door);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.08), wallMat);
    head.position.set(-0.9, 2.4, Z);
    scene.add(head);
    // behind the glass: Michael's desk, his chair and a lamp, in a warmer light
    const md = kit.desk({ w: 1.6, d: 0.8, pedestals: 'both', exec: true });
    md.position.set(-1.9, 0, Z + 1.6);
    md.rotation.y = Math.PI;
    scene.add(md);
    const mc = kit.chair();
    mc.position.set(-1.9, 0, Z + 2.25);
    mc.rotation.y = Math.PI;
    scene.add(mc);
    seat('michael', scene, mc, { idle: true, typing: true, keys: 0.32 });
    const mm = kit.monitor(7);
    mm.position.set(-1.9, 0.76, Z + 1.85);
    mm.rotation.y = Math.PI;
    scene.add(mm);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, H), wallMat);
    back.position.set(0, H / 2, Z + 3);
    back.rotation.y = Math.PI;
    scene.add(back);
    const backFloor = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, 3), kit.surface('carpet', 2 * X, 3, 1.1, { color: 0xd8dce6 }));
    backFloor.rotation.x = -Math.PI / 2;
    backFloor.position.set(0, 0, Z + 1.5);
    backFloor.receiveShadow = true;
    scene.add(backFloor);
    const warm = new THREE.PointLight(0xffe2b8, 2.2, 6);
    warm.position.set(-1.6, 2.2, Z + 1.8);
    scene.add(warm);
    const sign = kit.companySign();
    sign.position.set(2.9, 1.95, Z + 2.98);
    sign.rotation.y = Math.PI;
    sign.scale.setScalar(0.7);
    scene.add(sign);
  }

  // windows with vertical blinds down the left wall; the clock over them
  {
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xc9dcec, emissive: 0xdbe8f5, emissiveIntensity: 0.7, roughness: 0.2 });
    const vb = (() => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 8;
      const x = c.getContext('2d');
      for (let i = 0; i < 32; i += 8) {
        x.fillStyle = 'rgba(214,208,194,0.95)';
        x.fillRect(i, 0, 5, 8);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();
    for (const z of [1.2, 4.2, 7.2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), windowMat);
      p.position.set(-X + 0.01, 1.55, z);
      p.rotation.y = Math.PI / 2;
      scene.add(p);
      const t = vb.clone();
      t.repeat.set(2.2 * 6, 1);
      t.needsUpdate = true;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.46), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, roughness: 0.8 }));
      b.position.set(-X + 0.03, 1.55, z);
      b.rotation.y = Math.PI / 2;
      scene.add(b);
    }
    // the clock on the right-hand wall, face to the room
    const clock = kit.model('clock');
    clock.rotation.set(0, 0, -Math.PI / 2);
    clock.position.set(X - 0.02, 2.15, 4.2);
    scene.add(clock);
  }

  // ── Desks down both sides of the aisle ──────────────────────────────────
  const sideDesk = (x, z, side, screen, who) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // chairs face the walls' desks from the aisle
    g.add(kit.desk({ w: 1.5, d: 0.72, pedestals: side < 0 ? 'left' : 'right' }));
    const mon = kit.monitor(screen);
    mon.position.set(0, 0.76, -0.16);
    g.add(mon);
    const blot = kit.blotter();
    blot.position.set(0, 0.76, 0.16);
    g.add(blot);
    const kb = kit.keyboard();
    kb.position.set(0, 0.764, 0.2);
    g.add(kb);
    const ph = kit.phone();
    ph.position.set(0.55, 0.76, -0.1);
    g.add(ph);
    const cup = kit.pencilCup();
    cup.position.set(-0.6, 0.76, -0.2);
    g.add(cup);
    const ch = kit.chair();
    ch.position.set(0.05, 0, 0.66);
    ch.rotation.y = Math.PI + 0.2 * side;
    g.add(ch);
    // Stanley keeps his head down; the rest look round now and then
    seat(who, g, ch, { typing: true, idle: who !== 'stanley', keys: 0.46 });
    scene.add(g);
    return g;
  };
  [
    [-X + 0.4, 2.4, -1, 1, 'stanley'],
    [-X + 0.4, 5.6, -1, 3, 'phyllis'],
    [X - 0.4, 2.0, 1, 4, 'kevin'],
    [X - 0.4, 5.2, 1, 0, 'andy'],
  ].forEach(([x, z, side, s, who]) => sideDesk(x, z, side, s, who));
  // items the bullpen is known for
  {
    const plant = kit.model('plant');
    plant.position.set(X - 0.45, 0, 7.9);
    scene.add(plant);
    const plant2 = kit.model('plant');
    plant2.position.set(-X + 0.45, 0, 8.4);
    scene.add(plant2);
    for (let k = 0; k < 3; k++) {
      const b = kit.paperBox();
      b.position.set(X - 0.35, 0.135 + k * 0.27, 7.0);
      b.rotation.y = Math.PI / 2 + (k % 2) * 0.06;
      scene.add(b);
    }
  }

  // ── Jim's desk, in front of the camera ───────────────────────────────────
  const jim = new THREE.Group();
  jim.position.set(0, 0, -0.12);
  jim.add(kit.desk({ w: 1.7, d: 0.78, pedestals: 'right' }));
  const jimMon = kit.monitor(0);
  jimMon.position.set(-0.62, 0.76, -0.12);
  jimMon.rotation.y = 0.45;
  jim.add(jimMon);
  const jimPhone = kit.phone();
  jimPhone.position.set(0.66, 0.76, -0.05);
  jimPhone.rotation.y = -0.5;
  jim.add(jimPhone);
  const jimMug = kit.mug();
  jimMug.position.set(0.48, 0.76, 0.12);
  jim.add(jimMug);
  // the balls still to throw, in a little pile on the desk
  const pile = [];
  for (let i = 0; i < TOSS.balls; i++) {
    const b = kit.paperBall(i);
    const a = (i / TOSS.balls) * Math.PI * 2;
    b.position.set(0.32 + Math.cos(a) * 0.07 * (i % 3), 0.79 + (i > 6 ? 0.05 : 0), -0.2 + Math.sin(a) * 0.07 * (i % 3));
    jim.add(b);
    pile.push(b);
  }
  scene.add(jim);

  // ── The things the round moves ───────────────────────────────────────────
  const bin = kit.bin();
  scene.add(bin);
  const binShadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  binShadow.rotation.x = -Math.PI / 2;
  binShadow.position.y = 0.003;
  scene.add(binShadow);
  const ball = kit.paperBall(0);
  ball.visible = false;
  scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(TOSS.r * 1.2, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2;
  scene.add(ballShadow);
  // every sheet that missed, where it stopped
  const misses = [];
  // the fan on a filing cabinet, on whichever side the wind comes from
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.5, metalness: 0.3 });
  const cabinet = new THREE.Mesh(merge([new THREE.BoxGeometry(0.46, 1.02, 0.62)]), cabinetMat);
  cabinet.castShadow = cabinet.receiveShadow = true;
  scene.add(cabinet);
  const fan = kit.fan();
  scene.add(fan.group);
  // Dwight's desk, when it is in the way: his beets and the stapler in Jell-O on it
  const dwight = new THREE.Group();
  const dwightDesk = kit.desk({ w: 1.5, d: 0.76, pedestals: 'left' });
  dwight.add(dwightDesk);
  const dMon = kit.monitor(6);
  dMon.position.set(0.2, 0.76, -0.2);
  dwight.add(dMon);
  const beet = kit.beet();
  beet.position.set(-0.45, 0.76, 0.05);
  dwight.add(beet);
  const jello = kit.jello();
  jello.position.set(0.5, 0.76, 0.12);
  dwight.add(jello);
  const dChair = kit.chair();
  dChair.position.set(0, 0, 0.7);
  dChair.rotation.y = Math.PI;
  dwight.add(dChair);
  seat('dwight', dwight, dChair, { typing: true, keys: 0.42 });
  dwight.visible = false;
  scene.add(dwight);
  // the aim guide: a dotted arc
  const dotGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, 90);
  dots.count = 0;
  dots.frustumCulled = false;
  scene.add(dots);
  // a ring that flashes on the rim for a swish
  const flash = new THREE.Mesh(new THREE.TorusGeometry(TOSS.bin.rim + 0.01, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0 }));
  flash.rotation.x = Math.PI / 2;
  scene.add(flash);
  // bits of paper bursting out of the bin on a basket
  const bits = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.022), new THREE.MeshStandardMaterial({ color: 0xf5f4ef, side: THREE.DoubleSide, roughness: 0.9 }), 24);
  bits.count = 0;
  bits.frustumCulled = false;
  scene.add(bits);
  const burst = { t: -1, at: new THREE.Vector3(), v: [] };

  // ── Camera: Jim's eyes ───────────────────────────────────────────────────
  camera.position.set(0, 1.28, -0.62);
  const look = new THREE.Vector3(0, 0.55, 4.6);
  camera.lookAt(look);

  // ── Drawing a frame from the round ───────────────────────────────────────
  const shown = { bin: null, from: null, t0: 0, missCount: 0, fanSide: 0, last: null, react: null };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let time = 0;

  // the fan stands upwind and points the way the wind blows
  const placeFan = (wind) => {
    const speed = Math.hypot(wind.x, wind.z);
    const side = speed < 0.01 ? -1 : wind.x >= 0 ? -1 : 1; // in the rules' x
    const z = 4.0;
    cabinet.position.set(wx(side * (X - 0.3)), 0.51, z);
    fan.group.position.set(wx(side * (X - 0.3)), 1.02, z);
    const dir = speed < 0.01 ? new THREE.Vector3(wx(-side), 0, 0) : new THREE.Vector3(wx(wind.x), 0, wind.z).normalize();
    fan.group.rotation.y = Math.atan2(dir.x, dir.z);
    shown.fanSide = side;
  };

  // Where the held ball is: in front of the camera, low and a little right,
  // turned with the aim and drawn back with the power.
  const v3b = new THREE.Vector3();
  let lastAim = { yaw: 0, power: 0 };
  const hand = (a, out) => {
    const yaw = a ? a.yaw : 0;
    const pw = a ? a.power : 0;
    out.set(wx(0.07 + yaw * 0.25), 1.06 - pw * 0.05 + Math.sin(time * 2.1) * 0.004, -0.18 - pw * 0.07);
    return out;
  };

  // aim: { yaw, power } while aiming (or null); guide: draw the arc
  const render = (s, { dt = 1 / 60, ms = 16, aim = null, guide = false } = {}) => {
    time += dt;
    if (aim && s.phase === 'aim') lastAim = { yaw: aim.yaw, power: aim.power };
    // the bin: slides to its new place when it moves (Dwight moves it)
    if (!shown.bin) {
      shown.bin = { ...s.bin };
      placeFan(s.wind);
    }
    if (s.bin.x !== shown.bin.x || s.bin.z !== shown.bin.z) {
      if (!shown.from) {
        shown.from = { ...shown.bin };
        shown.t0 = time;
      }
      const p = Math.min(1, (time - shown.t0) / 0.7);
      const e = p * p * (3 - 2 * p);
      shown.bin = { x: shown.from.x + (s.bin.x - shown.from.x) * e, z: shown.from.z + (s.bin.z - shown.from.z) * e };
      if (p >= 1) {
        shown.bin = { ...s.bin };
        shown.from = null;
        placeFan(s.wind);
      }
    }
    bin.position.set(wx(shown.bin.x), 0, shown.bin.z);
    binShadow.position.set(wx(shown.bin.x) + 0.03, 0.003, shown.bin.z + 0.02);
    // Dwight's desk
    dwight.visible = Boolean(s.desk);
    if (s.desk) dwight.position.set(wx((s.desk.x0 + s.desk.x1) / 2), 0, (s.desk.z0 + s.desk.z1) / 2);
    // the fan: blades spin and ribbons stream when there is wind
    const wind = Math.hypot(s.wind.x, s.wind.z);
    fan.blades.rotation.z -= dt * (wind > 0.01 ? 18 + wind * 10 : 0);
    fan.ribbons.forEach((rb, i) => {
      const lift = wind > 0.01 ? Math.min(1.35, 0.5 + wind * 0.35) : 0;
      rb.rotation.x = -lift + Math.sin(time * 14 + i * 2) * 0.12 * (wind > 0.01 ? 1 : 0);
    });
    // the ball in flight, and the pile on Jim's desk
    // the pile: balls not yet thrown, less the one in Jim's hand
    const inPile = TOSS.balls - s.throws - (s.phase === 'aim' ? 1 : 0);
    pile.forEach((b, i) => (b.visible = i < inPile));
    const b = s.ball;
    if (s.phase === 'flying' && b) {
      ball.visible = true;
      ball.position.set(wx(b.x), b.y, b.z);
      // the first tenth of a second: from the hand into the throw
      if (b.t < 0.1) ball.position.lerp(hand(lastAim, v3b), 1 - b.t / 0.1);
      ball.rotation.x += b.spin * dt;
      ball.rotation.z += b.spin * 0.6 * dt;
      ballShadow.visible = !b.inside;
      ballShadow.position.set(wx(b.x), 0.004, b.z);
      ballShadow.material.opacity = Math.max(0.05, 0.35 - b.y * 0.12);
    } else if (s.phase === 'aim') {
      // the next ball, in Jim's hand: low in the frame, drawn back as the power builds
      ball.visible = true;
      hand(aim, ball.position);
      ball.rotation.y += dt * 0.6;
      ballShadow.visible = false;
    } else {
      ball.visible = false;
      ballShadow.visible = false;
    }
    // misses stay where they stopped
    if (s.last && !s.last.made && shown.missCount < s.throws - s.made) {
      const m = kit.paperBall(misses.length + 1);
      m.position.set(wx(s.last.at.x), TOSS.r * 0.85, s.last.at.z);
      m.rotation.set(time, time * 2, 0);
      scene.add(m);
      misses.push(m);
      shown.missCount = s.throws - s.made;
    }
    if (s.throws === 0 && misses.length) {
      for (const m of misses) scene.remove(m);
      misses.length = 0;
      shown.missCount = 0;
    }
    // the aim guide
    if (guide && aim && s.phase === 'aim') {
      const pts = predict(s, aim, 2.2, 0.028);
      dots.count = Math.min(pts.length, 90);
      for (let i = 0; i < dots.count; i++) {
        m4.compose(v3.set(wx(pts[i].x), pts[i].y, pts[i].z), q, one);
        dots.setMatrixAt(i, m4);
      }
      dots.instanceMatrix.needsUpdate = true;
    } else dots.count = 0;
    // a swish's flash, and paper bits on a basket
    flash.position.set(wx(shown.bin.x), TOSS.bin.height, shown.bin.z);
    flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.8);
    if (burst.t >= 0) {
      burst.t += dt;
      bits.count = burst.v.length;
      burst.v.forEach((v, i) => {
        const t = burst.t;
        v3.set(burst.at.x + v.x * t, burst.at.y + v.y * t - 4.9 * t * t, burst.at.z + v.z * t);
        q.setFromEuler(new THREE.Euler(t * v.r, t * v.r * 0.7, 0));
        m4.compose(v3, q, one);
        bits.setMatrixAt(i, m4);
      });
      bits.instanceMatrix.needsUpdate = true;
      if (burst.t > 1.1) {
        burst.t = -1;
        bits.count = 0;
      }
    }
    // the camera breathes a little, as a hand-held documentary camera does
    camera.position.set(Math.sin(time * 0.7) * 0.008, 1.28 + Math.sin(time * 0.9) * 0.006, -0.62);
    camera.lookAt(look);
    // the office: watching the ball, then where it ended up, for a moment
    if (s.last !== shown.last) {
      shown.last = s.last;
      shown.react = s.last ? { t: time, made: s.last.made, at: new THREE.Vector3(wx(s.last.at.x), 0.25, s.last.at.z) } : null;
    }
    const react = shown.react && time - shown.react.t < 2.2 ? shown.react : null;
    const flying = s.phase === 'flying' && ball.visible ? ball.position : null;
    for (const [id, p] of Object.entries(cast)) {
      if (id === 'stanley') p.look(null);
      else if (flying) p.look(flying);
      else if (react) p.look(id === 'dwight' && !react.made ? camera.position : react.at);
      else if (id === 'dwight' && s.phase === 'aim') p.look(camera.position); // he watches Jim aim
      else p.look(null);
      p.update(time, dt);
    }
    stage.render(ms);
  };

  // A basket: the rim flashes for a swish, paper bits jump out, and the
  // office cheers.
  const celebrate = (swish) => {
    if (swish) flash.material.opacity = 1;
    cast.kevin?.cheer();
    cast.michael?.cheer();
    if (swish) cast.andy?.cheer();
    burst.t = 0;
    burst.at.set(wx(shown.bin.x), TOSS.bin.height, shown.bin.z);
    burst.v = Array.from({ length: 18 }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.4 + Math.random() * 0.9;
      return { x: Math.cos(a) * sp, y: 1.6 + Math.random() * 1.4, z: Math.sin(a) * sp, r: 6 + Math.random() * 10 };
    });
  };

  // the room's shaders, linked in the background before its first frame
  await stage.precompile();

  // A new round: the misses are swept up.
  const clear = () => {
    for (const m of misses) scene.remove(m);
    misses.length = 0;
    shown.missCount = 0;
    shown.bin = null;
    shown.from = null;
    shown.last = null;
    shown.react = null;
  };

  return {
    render,
    celebrate,
    clear,
    // a tall screen keeps the room's width in view: the field of view opens up
    resize(w, h) {
      stage.resize(w, h);
      const aspect = Math.max(0.3, w / Math.max(1, h));
      camera.fov = Math.max(58, (2 * Math.atan(Math.tan((36 * Math.PI) / 180) / aspect) * 180) / Math.PI);
      camera.updateProjectionMatrix();
    },
    project: stage.project,
    info: stage.info,
    get lost() {
      return stage.lost;
    },
    dispose() {
      people.dispose();
      kit.dispose();
      stage.dispose();
    },
  };
}
