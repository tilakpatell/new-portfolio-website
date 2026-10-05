// The people and creatures of the worlds, built from shapes: who's there
// when there's no model of them (catalog/*.js), or until it's loaded.
// Each stands on y = 0 facing +z, in metres, and walks: its legs swing and
// it bobs with how fast it's going (update(dt, move 0…1)).
//
// buildFigure(kind) → { model, tall, update(dt, move), dispose } or null
// for a kind there's no figure of.

import * as THREE from 'three';

const { PI, sin, abs, max } = Math;

// people: their colours and what they wear
const PEOPLE = {
  jawa: { tall: 1.0, robe: '#5a3e26', hood: '#4a321e', eyes: '#ffd83a', bulk: 1.2 },
  tusken: { tall: 1.9, body: '#b8a888', legs: '#9a8a6c', wrap: '#c8b898', eyes: '#2a2a2a', mask: true, staff: '#5a4a38', bulk: 1.05 },
  stormtrooper: { tall: 1.83, body: '#eceeee', legs: '#eceeee', joints: '#1a1a1a', helmet: 'trooper', bulk: 1 },
  sandtrooper: { tall: 1.83, body: '#e2d6c0', legs: '#e2d6c0', joints: '#4a3c2a', helmet: 'trooper', pauldron: '#c84a2a', pack: '#b8aa90', bulk: 1 },
  snowtrooper: { tall: 1.83, body: '#e8ecf2', legs: '#e8ecf2', joints: '#7a8494', helmet: 'trooper', robe: '#dfe4ec', bulk: 1.05 },
  scouttrooper: { tall: 1.83, body: '#e8e8e4', legs: '#1a1a1a', joints: '#1a1a1a', helmet: 'scout', bulk: 0.9 },
  clone: { tall: 1.83, body: '#eeeeea', legs: '#eeeeea', joints: '#2a2a2a', helmet: 'clone', stripe: '#3a6ad0', bulk: 1 },
  rebel: { tall: 1.78, body: '#c8b48c', legs: '#4a4a3e', helmet: 'rebel', skin: '#d8a888', bulk: 1 },
  pilot: { tall: 1.78, body: '#e8742a', legs: '#e8742a', helmet: 'pilot', skin: '#e0b090', bulk: 1 },
  battledroid: { tall: 1.91, body: '#c8b088', legs: '#c8b088', helmet: 'b1', thin: true, bulk: 0.6 },
  ewok: { tall: 1.0, body: '#6a4a30', legs: '#5a3c26', hood: '#8a6a3a', eyes: '#1a1210', fur: true, bulk: 1.5 },
  wookiee: { tall: 2.25, body: '#7a5634', legs: '#6a4a2c', fur: true, head: '#7a5634', bandolier: '#3a2a1a', bulk: 1.15 },
  gungan: { tall: 1.96, body: '#c8a26a', legs: '#6a5a4a', skin: '#d89a5a', ears: true, bulk: 0.9 },
  geonosian: { tall: 1.7, body: '#7a5a3a', legs: '#6a4a2a', skin: '#8a6a3a', wings: true, thin: true, bulk: 0.8 },
  kaminoan: { tall: 2.6, body: '#e6e8ec', legs: '#e6e8ec', skin: '#e0e4ea', neck: true, thin: true, bulk: 0.7 },
  villager: { tall: 1.75, body: '#8a7a5e', legs: '#5a4c3a', skin: '#c89a78', robe: '#9a8a6a', bulk: 1 },
  jedi: { tall: 1.8, body: '#c8b48c', legs: '#8a6a4a', skin: '#e0b090', robe: '#6a4a2a', hood: '#6a4a2a', bulk: 1 },
  caretaker: { tall: 1.2, body: '#e8e4dc', legs: '#e8e4dc', skin: '#9a9a8a', robe: '#ece8de', hood: '#ece8de', bulk: 1.1 },
  porg: { tall: 0.3, creature: 'porg' },
  droid: { tall: 1.09, creature: 'astromech' },
};

// four-legged (and two-legged) creatures
const BEASTS = {
  bantha: { tall: 2.8, fur: '#4a3a2e', skin: '#2e241c', len: 3.6, wide: 1.7, leg: 1.1, neck: 0.5, head: 0.7, horns: 'curl', tail: 0.6 },
  dewback: { tall: 1.6, fur: '#7a8a6a', skin: '#5a6a4a', len: 3.6, wide: 1.0, leg: 0.55, neck: 0.6, head: 0.45, tail: 2.2, low: true },
  tauntaun: { tall: 2.5, fur: '#d8d0c4', skin: '#9a9488', biped: true, len: 1.6, wide: 0.8, leg: 1.1, neck: 0.9, head: 0.5, horns: 'back', tail: 1.2 },
  kaadu: { tall: 2.2, fur: '#8a7a5a', skin: '#6a5a3a', biped: true, len: 1.5, wide: 0.7, leg: 1.2, neck: 0.8, head: 0.5, tail: 1.0, beak: true },
  wampa: { tall: 3.0, fur: '#f0ece6', skin: '#c8bfb2', ape: true, len: 1.2, wide: 1.4, leg: 1.0, head: 0.6, horns: 'curl' },
  nerf: { tall: 1.4, fur: '#7a5a3a', skin: '#3a2a1e', len: 2.0, wide: 1.0, leg: 0.6, neck: 0.3, head: 0.45, horns: 'curl', tail: 0.3 },
};

export const FIGURES = [...Object.keys(PEOPLE), ...Object.keys(BEASTS)];

function kitOf() {
  const owned = [];
  const mats = new Map();
  return {
    owned,
    mat(color, o = {}) {
      const key = `${color}|${JSON.stringify(o)}`;
      if (!mats.has(key)) {
        const m = o.glow ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(o.glow), toneMapped: false }) : new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0 });
        mats.set(key, m);
        owned.push(m);
      }
      return mats.get(key);
    },
    geo(g) {
      owned.push(g);
      return g;
    },
  };
}

const shadowed = (o) => {
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
};

// a limb hanging from its joint
function limb(k, r, l, m) {
  const g = k.geo(new THREE.CapsuleGeometry(r, l, 4, 8));
  g.translate(0, -l / 2 - r * 0.5, 0);
  return new THREE.Mesh(g, m);
}

function person(spec) {
  const k = kitOf();
  const model = new THREE.Group();
  const s = spec.tall / 1.75; // built 1.75 tall, scaled
  const thin = spec.thin ? 0.55 : 1;
  const bulk = spec.bulk ?? 1;
  const body = k.mat(spec.body ?? spec.robe ?? '#888');
  const legsM = k.mat(spec.legs ?? spec.body ?? '#666');
  const legs = [];
  const arms = [];
  const hipY = spec.robe && !spec.legs ? 0.8 : 0.86;
  for (const x of [-0.09, 0.09]) {
    const hip = new THREE.Group();
    hip.position.set(x * bulk, hipY, 0);
    hip.add(limb(k, 0.07 * thin * bulk, 0.33, legsM));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(limb(k, 0.06 * thin * bulk, 0.3, legsM));
    const boot = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.12 * bulk, 0.08, 0.24)), k.mat(spec.joints ?? '#2a2420'));
    boot.position.set(0, -0.4, 0.04);
    knee.add(boot);
    hip.add(knee);
    model.add(hip);
    legs.push({ hip, knee });
  }
  const torso = new THREE.Mesh(k.geo(new THREE.CapsuleGeometry(0.17 * bulk * (spec.thin ? 0.7 : 1), 0.32, 4, 12)), body);
  torso.position.y = 1.18;
  torso.scale.set(1, 1, spec.thin ? 0.5 : 0.7);
  model.add(torso);
  // a robe over the legs (Jawas, Tuskens, Jedi, snowtroopers' skirts)
  if (spec.robe) {
    const robe = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.2 * bulk, 0.34 * bulk, spec.legs ? 0.55 : 0.95, 12, 1, true)), k.mat(spec.robe, { roughness: 1 }));
    robe.material.side = THREE.DoubleSide;
    robe.position.y = spec.legs ? 0.72 : 0.5;
    model.add(robe);
  }
  if (spec.wrap) {
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(k.geo(new THREE.TorusGeometry(0.18 * bulk, 0.035, 6, 14)), k.mat(spec.wrap));
      band.rotation.x = PI / 2;
      band.position.y = 1.0 + i * 0.16;
      model.add(band);
    }
  }
  if (spec.fur) {
    // a furry lump of a body over it all
    const fur = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.26 * bulk, 14, 10)), k.mat(spec.body, { roughness: 1 }));
    fur.scale.set(1, 1.6, 0.85);
    fur.position.y = 1.1;
    model.add(fur);
  }
  if (spec.pauldron) {
    const p = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.1, 10, 6, 0, PI * 2, 0, PI / 2)), k.mat(spec.pauldron));
    p.position.set(-0.22, 1.42, 0);
    model.add(p);
  }
  if (spec.pack) {
    const p = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.34, 0.4, 0.18)), k.mat(spec.pack));
    p.position.set(0, 1.2, -0.2);
    model.add(p);
  }
  if (spec.bandolier) {
    const b = new THREE.Mesh(k.geo(new THREE.TorusGeometry(0.24, 0.03, 6, 16)), k.mat(spec.bandolier));
    b.rotation.set(PI / 2, 0.7, 0);
    b.position.y = 1.2;
    b.scale.set(1, 0.75, 1);
    model.add(b);
  }
  if (spec.wings) {
    for (const x of [-1, 1]) {
      const w = new THREE.Mesh(k.geo(new THREE.PlaneGeometry(0.25, 0.7)), k.mat('#c8d0b0', { roughness: 0.4 }));
      w.material.side = THREE.DoubleSide;
      w.position.set(x * 0.15, 1.25, -0.16);
      w.rotation.set(0.2, x * 0.5, x * 0.3);
      model.add(w);
    }
  }
  // the neck and head
  const headY = spec.neck ? 1.9 : 1.58;
  if (spec.neck) {
    const n = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 8)), k.mat(spec.skin));
    n.position.y = 1.62;
    model.add(n);
  }
  const head = new THREE.Group();
  head.position.y = headY;
  model.add(head);
  const helmet = spec.helmet;
  const white = k.mat(spec.body ?? '#eee', { roughness: 0.35 });
  if (helmet === 'trooper' || helmet === 'clone' || helmet === 'scout') {
    const dome = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.135, 16, 12)), white);
    dome.scale.set(1, 1.08, 1.05);
    head.add(dome);
    const visor = k.mat('#0c0c0e', { roughness: 0.2 });
    if (helmet === 'clone') {
      const t = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.17, 0.04, 0.05)), visor);
      t.position.set(0, 0.02, 0.12);
      head.add(t);
      const v = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.04, 0.09, 0.05)), visor);
      v.position.set(0, -0.04, 0.125);
      head.add(v);
      if (spec.stripe) {
        const st = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.03, 0.2, 0.24)), k.mat(spec.stripe));
        st.position.y = 0.06;
        head.add(st);
      }
    } else {
      for (const x of [-0.05, 0.05]) {
        const e = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.035, 8, 6)), visor);
        e.position.set(x, 0.02, 0.12);
        e.scale.set(1.2, 0.8, 0.6);
        head.add(e);
      }
      const grill = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.08, 0.04, 0.04)), k.mat(spec.joints ?? '#222'));
      grill.position.set(0, -0.07, 0.12);
      head.add(grill);
      if (helmet === 'scout') {
        const brim = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16)), white);
        brim.position.y = 0.03;
        head.add(brim);
      }
    }
  } else if (helmet === 'b1') {
    const h = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 8)), white);
    h.rotation.x = PI / 2 - 0.3;
    h.position.z = 0.1;
    head.add(h);
  } else if (helmet === 'rebel' || helmet === 'pilot') {
    head.add(new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.11, 14, 10)), k.mat(spec.skin)));
    const cap = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.125, 14, 8, 0, PI * 2, 0, PI * 0.55)), k.mat(helmet === 'pilot' ? '#e8e8e2' : '#8a8a70', { roughness: 0.5 }));
    cap.position.y = 0.01;
    head.add(cap);
  } else if (spec.hood) {
    const hood = new THREE.Mesh(k.geo(new THREE.ConeGeometry(0.17 * bulk, 0.42, 12)), k.mat(spec.hood, { roughness: 1 }));
    hood.position.y = 0.05;
    head.add(hood);
    const face = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.1 * bulk, 12, 8)), k.mat('#0a0806'));
    face.position.set(0, -0.04, 0.06);
    head.add(face);
  } else {
    const h = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.12 * (spec.fur ? 1.3 : 1), 14, 10)), k.mat(spec.head ?? spec.skin ?? spec.wrap ?? '#c8a080', { roughness: 0.9 }));
    if (spec.ears) h.scale.set(0.9, 1.2, 1.4);
    head.add(h);
    if (spec.ears)
      for (const x of [-1, 1]) {
        const ear = new THREE.Mesh(k.geo(new THREE.CapsuleGeometry(0.035, 0.45, 3, 6)), k.mat(spec.skin));
        ear.position.set(x * 0.1, -0.2, -0.04);
        ear.rotation.z = x * 0.15;
        head.add(ear);
      }
  }
  if (spec.mask) {
    for (const x of [-0.045, 0.045]) {
      const e = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8)), k.mat('#2a2a2a', { roughness: 0.3 }));
      e.rotation.x = PI / 2;
      e.position.set(x, 0.02, 0.12);
      head.add(e);
    }
  }
  if (spec.eyes && !spec.mask) {
    for (const x of [-0.04, 0.04]) {
      const e = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.022, 8, 6)), k.mat(spec.eyes, spec.eyes === '#1a1210' ? {} : { glow: 3 }));
      e.position.set(x, -0.02, 0.13 * bulk);
      head.add(e);
    }
  }
  // arms
  for (const x of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(x * 0.24 * bulk * (spec.thin ? 0.8 : 1), 1.4, 0);
    sh.add(limb(k, 0.05 * thin * bulk, 0.24, spec.robe && !spec.legs ? k.mat(spec.robe) : body));
    const el = new THREE.Group();
    el.position.y = -0.32;
    el.add(limb(k, 0.045 * thin * bulk, 0.22, spec.robe && !spec.legs ? k.mat(spec.robe) : body));
    sh.add(el);
    model.add(sh);
    arms.push({ sh, el });
  }
  if (spec.staff) {
    const st = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6)), k.mat(spec.staff));
    st.position.set(0, -0.55, 0.1);
    st.rotation.x = 0.3;
    arms[1].el.add(st);
  }
  model.scale.setScalar(s);
  let phase = Math.random() * 10;
  return {
    model: shadowed(model),
    tall: spec.tall,
    update(dt, move) {
      phase += dt * (2.5 + move * 6);
      const sw = sin(phase) * (0.1 + move * 0.55) * Math.min(1, move * 5);
      legs[0].hip.rotation.x = sw;
      legs[1].hip.rotation.x = -sw;
      legs[0].knee.rotation.x = max(0, -sin(phase + 0.6)) * move * 0.9;
      legs[1].knee.rotation.x = max(0, sin(phase + 0.6)) * move * 0.9;
      arms[0].sh.rotation.x = -sw * 0.7;
      arms[1].sh.rotation.x = sw * 0.7;
      torso.position.y = 1.18 + abs(sin(phase)) * 0.02 * move;
      head.rotation.y = sin(phase * 0.13) * 0.25 * (1 - move);
    },
    dispose() {
      for (const o of k.owned) o.dispose();
    },
  };
}

function beast(spec) {
  const k = kitOf();
  const model = new THREE.Group();
  const fur = k.mat(spec.fur, { roughness: 1 });
  const skin = k.mat(spec.skin, { roughness: 0.85 });
  const H = spec.tall;
  const L = spec.len;
  const W = spec.wide;
  const legH = spec.leg;
  const legs = [];
  const body = new THREE.Group();
  model.add(body);
  let bodyY;
  if (spec.biped || spec.ape) {
    // two legs; the body leaning forward (tauntaun, kaadu) or upright (wampa)
    bodyY = legH + W * 0.4;
    const torso = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.5, 16, 12)), fur);
    torso.scale.set(W, spec.ape ? H * 0.45 : L * 0.55, spec.ape ? W * 0.7 : L * 0.6);
    torso.rotation.x = spec.ape ? 0 : 0.5;
    torso.position.y = spec.ape ? H * 0.5 : bodyY + 0.2;
    body.add(torso);
    for (const x of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(x * W * 0.3, legH + 0.1, 0);
      hip.add(limb(k, 0.12 * W, legH * 0.8, fur));
      model.add(hip);
      legs.push({ hip, x });
    }
    if (spec.ape) {
      for (const x of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(x * W * 0.62, H * 0.72, 0);
        arm.add(limb(k, 0.14, H * 0.38, fur));
        arm.rotation.z = x * 0.15;
        body.add(arm);
        legs.push({ hip: arm, x: -x, arm: true });
      }
    }
  } else {
    bodyY = legH + W * 0.35;
    const torso = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.5, 18, 12)), fur);
    torso.scale.set(W, H - legH, L);
    torso.position.y = bodyY + (spec.low ? -0.05 : 0.1);
    body.add(torso);
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(x * W * 0.32, legH + 0.05, z * L * 0.3);
        hip.add(limb(k, 0.1 * W + 0.05, legH * 0.85, spec.horns === 'curl' ? fur : skin));
        if (spec.low) hip.rotation.z = x * 0.5;
        model.add(hip);
        legs.push({ hip, x: x * z });
      }
  }
  // neck and head, forward
  const head = new THREE.Group();
  if (spec.ape) head.position.set(0, H * 0.92, W * 0.15);
  else head.position.set(0, bodyY + (spec.biped ? spec.neck * 0.9 : spec.neck * 0.4), (spec.biped ? L * 0.35 : L * 0.5) + spec.neck * 0.5);
  model.add(head);
  if (spec.neck && !spec.ape) {
    const n = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.14 * W, 0.22 * W, spec.neck, 10)), fur);
    n.position.set(0, -spec.neck * 0.35, -spec.neck * 0.3);
    n.rotation.x = spec.biped ? -0.4 : 0.9;
    head.add(n);
  }
  const skull = new THREE.Mesh(k.geo(new THREE.SphereGeometry(spec.head / 2, 14, 10)), skin);
  skull.scale.set(1, 0.85, spec.beak || spec.low ? 1.8 : 1.3);
  head.add(skull);
  for (const x of [-1, 1]) {
    const e = new THREE.Mesh(k.geo(new THREE.SphereGeometry(spec.head * 0.07, 6, 4)), k.mat('#0a0a0a', { roughness: 0.2 }));
    e.position.set(x * spec.head * 0.32, spec.head * 0.12, spec.head * 0.38);
    head.add(e);
  }
  if (spec.horns === 'curl') {
    for (const x of [-1, 1]) {
      const h = new THREE.Mesh(k.geo(new THREE.TorusGeometry(spec.head * 0.45, spec.head * 0.1, 6, 12, PI * 1.5)), k.mat('#c8b48a', { roughness: 0.6 }));
      h.position.set(x * spec.head * 0.55, spec.head * 0.15, -spec.head * 0.1);
      h.rotation.set(0, x * PI / 2, 0);
      head.add(h);
    }
  } else if (spec.horns === 'back') {
    for (const x of [-1, 1]) {
      const h = new THREE.Mesh(k.geo(new THREE.ConeGeometry(spec.head * 0.12, spec.head * 1.1, 6)), k.mat('#c8b48a'));
      h.position.set(x * spec.head * 0.35, spec.head * 0.3, -spec.head * 0.35);
      h.rotation.set(-1.2, 0, x * 0.5);
      head.add(h);
    }
  }
  if (spec.crystal) {
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(k.geo(new THREE.ConeGeometry(0.04, 0.35, 4)), k.mat('#dff2ff', { glow: 1.6 }));
      c.position.set(sin(i) * 0.1, bodyY + 0.25, -L * 0.2 + (i / 6) * L * 0.4);
      c.rotation.set(-0.4 + (i % 3) * 0.3, 0, (i % 2 ? 1 : -1) * 0.5);
      body.add(c);
    }
  }
  if (spec.tail) {
    const t = new THREE.Mesh(k.geo(new THREE.ConeGeometry(0.13 * W + 0.05, spec.tail, 8)), spec.low ? skin : fur);
    t.rotation.x = -PI / 2 + (spec.low ? 0.1 : 0.5);
    t.position.set(0, bodyY - (spec.low ? 0.15 : 0), -L * 0.5 - spec.tail * 0.4);
    body.add(t);
  }
  let phase = Math.random() * 10;
  return {
    model: shadowed(model),
    tall: H,
    update(dt, move) {
      phase += dt * (1.8 + move * 5);
      const sw = sin(phase) * (0.08 + move * 0.45) * Math.min(1, move * 5 + 0.02);
      for (const l of legs) l.hip.rotation.x = sw * l.x * (l.arm ? 0.6 : 1);
      body.position.y = abs(sin(phase)) * 0.05 * move * H;
      head.rotation.x = sin(phase * 0.5) * 0.06 + (1 - move) * sin(phase * 0.07) * 0.2;
      head.rotation.y = (1 - move) * sin(phase * 0.05) * 0.4;
    },
    dispose() {
      for (const o of k.owned) o.dispose();
    },
  };
}

// small ones: a porg, an astromech
function small(spec) {
  const k = kitOf();
  const model = new THREE.Group();
  let t = Math.random() * 10;
  let bobber = model;
  if (spec.creature === 'porg') {
    const b = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.13, 12, 10)), k.mat('#8a6a50'));
    b.scale.set(1, 1.1, 1);
    b.position.y = 0.14;
    const belly = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.11, 12, 8)), k.mat('#f2ebe0'));
    belly.position.set(0, 0.12, 0.05);
    const face = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.08, 12, 8)), k.mat('#f4ede2'));
    face.position.set(0, 0.22, 0.07);
    model.add(b, belly, face);
    for (const x of [-0.035, 0.035]) {
      const e = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.022, 8, 6)), k.mat('#0a0806', { roughness: 0.2 }));
      e.position.set(x, 0.24, 0.13);
      model.add(e);
    }
    const beak = new THREE.Mesh(k.geo(new THREE.ConeGeometry(0.015, 0.04, 6)), k.mat('#e8a040'));
    beak.rotation.x = PI / 2;
    beak.position.set(0, 0.2, 0.15);
    model.add(beak);
  } else {
    const white = k.mat('#e9edf2', { roughness: 0.4 });
    const blue = k.mat('#2f62c9');
    const barrel = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(0.2, 0.19, 0.5, 18)), white);
    barrel.position.y = 0.55;
    const dome = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.2, 18, 10, 0, PI * 2, 0, PI / 2)), k.mat('#c9ced6', { metalness: 0.6, roughness: 0.35 }));
    dome.position.y = 0.8;
    const panel = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.1, 0.18, 0.02)), blue);
    panel.position.set(0, 0.6, 0.2);
    const eye = new THREE.Mesh(k.geo(new THREE.SphereGeometry(0.035, 8, 6)), k.mat('#ff3030', { glow: 2 }));
    eye.position.set(0, 0.9, 0.17);
    const top = new THREE.Group();
    top.add(barrel, dome, panel, eye);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(k.geo(new THREE.BoxGeometry(0.07, 0.62, 0.12)), white);
      leg.position.set(x, 0.38, -0.02);
      model.add(leg);
    }
    model.add(top);
    bobber = top;
    model.scale.setScalar(spec.tall / 1.0);
  }
  return {
    model: shadowed(model),
    tall: spec.tall,
    update(dt, move) {
      t += dt;
      if (spec.creature === 'porg') model.rotation.z = sin(t * 12) * 0.08 * move;
      else bobber.rotation.z = sin(t * 9) * 0.05 * move;
    },
    dispose() {
      for (const o of k.owned) o.dispose();
    },
  };
}

export function buildFigure(kind) {
  const p = PEOPLE[kind];
  if (p) return p.creature ? small(p) : person(p);
  const b = BEASTS[kind];
  if (b) return beast(b);
  return null;
}

export const tallOf = (kind) => PEOPLE[kind]?.tall ?? BEASTS[kind]?.tall ?? 1.8;
