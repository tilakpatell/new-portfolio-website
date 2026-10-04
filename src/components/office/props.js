// What sits on each desk at the Scranton branch, as the set dresses them:
// Michael's mug, the stapler in Jell-O and the beets on Dwight's desk, Andy's
// banjo, Phyllis's knitting, Stanley's crossword, Kevin's chili, Angela's cat
// figurines, Oscar's book, Toby's HR binder and bear, Darryl's keyboard.
// Built from the kit's materials; each returns a Group sitting on y = 0.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function makeProps(kit) {
  const own = [];
  const keep = (x) => {
    own.push(x);
    return x;
  };
  const mat = (o) => keep(new THREE.MeshStandardMaterial(o));
  const mesh = (geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(keep(geo), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };

  const banjo = () => {
    const g = new THREE.Group();
    const pot = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 32), mat({ color: 0xb98a4c, roughness: 0.45 }));
    const head = mesh(new THREE.CircleGeometry(0.135, 32), mat({ color: 0xefe8d6, roughness: 0.7 }), 0, 0.031, 0);
    head.rotation.x = -Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(0.145, 0.008, 6, 40), kit.M.chrome, 0, 0.03, 0);
    rim.rotation.x = Math.PI / 2;
    const neck = mesh(new THREE.BoxGeometry(0.05, 0.022, 0.5), mat({ color: 0x5a3418, roughness: 0.5 }), 0, 0.02, -0.38);
    const peg = mesh(new THREE.BoxGeometry(0.08, 0.025, 0.12), mat({ color: 0x3a2210, roughness: 0.5 }), 0, 0.02, -0.68);
    const strings = mesh(new THREE.BoxGeometry(0.03, 0.002, 0.8), mat({ color: 0xdddddd, metalness: 1, roughness: 0.2 }), 0, 0.04, -0.27);
    g.add(pot, head, rim, neck, peg, strings);
    // leaning against the desk's side
    g.rotation.set(-1.15, 0, 0);
    g.position.y = 0.3;
    return g;
  };

  const yarn = () => {
    const g = new THREE.Group();
    const ball = mesh(new THREE.SphereGeometry(0.06, 20, 14), mat({ color: 0xc8577f, roughness: 0.95 }), 0, 0.06, 0);
    for (let i = 0; i < 6; i++) {
      const wrap = mesh(new THREE.TorusGeometry(0.06, 0.004, 4, 32), mat({ color: 0xa63e64, roughness: 0.95 }), 0, 0.06, 0);
      wrap.rotation.set(i * 0.7, i * 1.1, 0);
      g.add(wrap);
    }
    for (const s of [-1, 1]) {
      const needle = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6), kit.M.metal, 0.08 + s * 0.012, 0.03, 0.02);
      needle.rotation.z = Math.PI / 2 - 0.15 * s;
      g.add(needle);
    }
    g.add(ball);
    return g;
  };

  const crossword = () => {
    const g = new THREE.Group();
    const paper = document.createElement('canvas');
    paper.width = 256;
    paper.height = 320;
    const x = paper.getContext('2d');
    x.fillStyle = '#ece8dc';
    x.fillRect(0, 0, 256, 320);
    x.fillStyle = '#222';
    x.font = 'bold 18px Georgia, serif';
    x.fillText('The Scranton Times', 30, 26);
    for (let gy = 0; gy < 11; gy++)
      for (let gx = 0; gx < 11; gx++) {
        x.fillStyle = (gx * 5 + gy * 7) % 6 === 0 ? '#222' : '#fff';
        x.fillRect(40 + gx * 16, 60 + gy * 16, 15, 15);
      }
    x.fillStyle = '#444';
    for (let k = 0; k < 6; k++) x.fillRect(30, 250 + k * 10, 200 - (k % 3) * 30, 3);
    const t = keep(new THREE.CanvasTexture(paper));
    t.colorSpace = THREE.SRGBColorSpace;
    const sheet = mesh(new THREE.PlaneGeometry(0.26, 0.32), mat({ map: t, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.003, 0);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = 0.2;
    const pen = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), mat({ color: 0x1f4ea0 }), 0.05, 0.006, 0.02);
    pen.rotation.set(Math.PI / 2, 0, 0.7);
    g.add(sheet, pen);
    return g;
  };

  // Kevin's famous chili: the pot on the desk, and the spill on the carpet
  const chili = () => {
    const g = new THREE.Group();
    const pot = mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.16, 28, 1, true), mat({ color: 0x8d949c, roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide }), 0, 0.08, 0);
    const chiliMat = mat({ color: 0x7a2a10, roughness: 0.5 });
    const top = mesh(new THREE.CircleGeometry(0.125, 28), chiliMat, 0, 0.13, 0);
    top.rotation.x = -Math.PI / 2;
    const bottom = mesh(new THREE.CircleGeometry(0.12, 28), kit.M.metal, 0, 0.001, 0);
    bottom.rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) {
      const handle = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16, Math.PI), kit.M.metal, s * 0.135, 0.13, 0);
      handle.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(handle);
    }
    g.add(pot, top, bottom);
    return g;
  };
  const chiliSpill = () => {
    const s = new THREE.Shape();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 0.42 + 0.12 * Math.sin(a * 3) + 0.06 * Math.cos(a * 7);
      if (i) s.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r);
      else s.moveTo(Math.cos(a) * r * 1.4, Math.sin(a) * r);
    }
    const m = new THREE.Mesh(keep(new THREE.ShapeGeometry(s)), mat({ color: 0x6e2610, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.004;
    m.receiveShadow = true;
    return m;
  };

  // Angela's cats: little china figurines in a row
  const cats = () => {
    const g = new THREE.Group();
    const colors = [0xf1ece2, 0xd9a066, 0x8a8f99, 0x2b2b2b];
    colors.forEach((c, i) => {
      const m = mat({ color: c, roughness: 0.25 });
      const cat = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.03, 12, 10), m, 0, 0.03, 0);
      body.scale.set(0.9, 1.1, 1.2);
      const head = mesh(new THREE.SphereGeometry(0.021, 12, 10), m, 0, 0.072, 0.012);
      const ear1 = mesh(new THREE.ConeGeometry(0.008, 0.018, 4), m, -0.012, 0.094, 0.012);
      const ear2 = mesh(new THREE.ConeGeometry(0.008, 0.018, 4), m, 0.012, 0.094, 0.012);
      const tail = mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12, Math.PI), m, 0, 0.03, -0.03);
      tail.rotation.y = Math.PI / 2;
      cat.add(body, head, ear1, ear2, tail);
      cat.position.x = (i - 1.5) * 0.08;
      cat.rotation.y = (i - 1.5) * 0.25;
      g.add(cat);
    });
    return g;
  };

  const book = () => {
    const g = new THREE.Group();
    const cover = mesh(new RoundedBoxGeometry(0.17, 0.035, 0.24, 2, 0.004), mat({ color: 0x2f4f6f, roughness: 0.6 }), 0, 0.018, 0);
    const pages = mesh(new THREE.BoxGeometry(0.16, 0.028, 0.23), mat({ color: 0xf2ecd9, roughness: 0.9 }), 0.006, 0.018, 0);
    g.add(cover, pages);
    g.rotation.y = 0.3;
    return g;
  };

  const binder = () => {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#2f5ea8';
    x.fillRect(0, 0, 128, 256);
    x.fillStyle = '#fff';
    x.font = 'bold 56px Arial';
    x.textAlign = 'center';
    x.fillText('HR', 64, 140);
    const t = keep(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    const side = mat({ color: 0x2f5ea8, roughness: 0.5 });
    const front = mat({ map: t, roughness: 0.5 });
    const b = mesh(new THREE.BoxGeometry(0.06, 0.3, 0.26), [side, side, side, side, front, side], 0, 0.15, 0);
    b.rotation.y = Math.PI / 2;
    g.add(b);
    // and the bear on the shelf: TOBY, on its T-shirt, as on the set
    const fur = mat({ color: 0x8a5a33, roughness: 1 });
    const bear = new THREE.Group();
    bear.add(mesh(new THREE.SphereGeometry(0.06, 14, 12), fur, 0, 0.06, 0));
    bear.add(mesh(new THREE.SphereGeometry(0.045, 14, 12), fur, 0, 0.15, 0.01));
    bear.add(mesh(new THREE.SphereGeometry(0.016, 8, 8), fur, -0.035, 0.19, 0));
    bear.add(mesh(new THREE.SphereGeometry(0.016, 8, 8), fur, 0.035, 0.19, 0));
    bear.add(mesh(new THREE.SphereGeometry(0.02, 8, 8), mat({ color: 0xd8b48a, roughness: 1 }), 0, 0.14, 0.05));
    bear.position.set(0.25, 0, 0.02);
    g.add(bear);
    return g;
  };

  // Darryl's keyboard: a small synth, black, with its white and black keys
  const keys = () => {
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(0.62, 0.05, 0.2, 2, 0.01), kit.M.plasticDark, 0, 0.025, 0));
    const white = mat({ color: 0xf4f4f0, roughness: 0.4 });
    const black = mat({ color: 0x111111, roughness: 0.4 });
    for (let i = 0; i < 22; i++) g.add(mesh(new THREE.BoxGeometry(0.024, 0.012, 0.1), white, -0.27 + i * 0.0257, 0.055, 0.04));
    for (let i = 0; i < 22; i++) if (![2, 6, 9, 13, 16, 20].includes(i % 21)) g.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.06), black, -0.257 + i * 0.0257, 0.064, 0.02));
    return g;
  };

  const byItem = {
    mug: () => kit.mug(),
    'mug-plain': () => {
      const m = kit.mug();
      m.traverse((o) => {
        if (o.isMesh && o.material?.map) o.material = mat({ color: 0x9fc3df, roughness: 0.2 });
      });
      return m;
    },
    jello: () => kit.jello(),
    beet: () => kit.beet(),
    banjo,
    yarn,
    paper: crossword,
    chili,
    cat: cats,
    book,
    binder,
    keys,
  };

  return {
    item: (kind) => (byItem[kind] ? byItem[kind]() : null),
    chiliSpill,
    dispose: () => own.forEach((o) => o.dispose?.()),
  };
}
