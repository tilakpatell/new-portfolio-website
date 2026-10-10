// Walt's Metherria in WebGL. One room (the RV, or the superlab once it's
// bought) with every station along a bench, and the camera gliding to the
// one you're at, Papa's style. The scene reads `live`, which the stations
// write as they're played, and draws it: the flask filling and tinting, the
// vat bubbling under its gauge, the slab splitting under the hammer, the pack
// filling on the scale with its stickers, and customers waiting at the
// hatch as cut-outs of their portraits. Loaded only with WebGL.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadEnvironment, loadPbr, loadTexture } from '../../../lib/hdri';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import Face from './Face';
import { CUSTOMERS, M } from './rules';
import { loadPeople } from '../../office/people';
import { createQueue } from './queue';
import { ABQ, dressedAs, moodGesture } from '../wardrobe';
import { LOOK_KEY, readLooks } from '../../rickmorty/wardrobe/looks';
import { dressColors } from '../../rickmorty/wardrobe/dress';
import { dress as putOn } from '../../rickmorty/wardrobe/wear';
import { local } from '../../../lib/hooks';
import { loadProps, PROPS, spoutOf } from './props';
import { paintDial, paintFloor, paintHazard, paintLabel, paintPollosBox, paintSteel, paintTile, paintWood } from './paint';
import { pixelRatio } from '../../../lib/device';
import { precompile, quiet, releaseContext } from '../../../lib/three/renderer';
import { sharpen } from '../../../lib/three/textures';
import { houseOn } from '../../../lib/three/house';

export const STATIONS = { order: -4.4, serve: -4.4, idle: -4.4, build: -1.7, cook: 0.7, break: 3.0, pack: 5.3 };
const BENCH_Y = 0.92;
const BLUE = new THREE.Color('#4fb8ea');
const PALE = new THREE.Color('#d8e6ea');
const DEEP = new THREE.Color('#15629f');

function tex(c, renderer, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Erlenmeyer flask: the outside profile, turned on a lathe.
const FLASK = [
  [0, 0],
  [0.15, 0],
  [0.165, 0.015],
  [0.15, 0.06],
  [0.05, 0.27],
  [0.045, 0.34],
  [0.052, 0.355],
  [0.05, 0.36],
];
const flaskRadius = (y) => {
  for (let i = 1; i < FLASK.length; i++) {
    const [r0, y0] = FLASK[i - 1];
    const [r1, y1] = FLASK[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return 0.05;
};
const FLASK_H = 0.27; // the liquid can rise to the neck

export function createMetherria3D(canvas, { onLost, onSlow } = {}) {
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // (the house tone mapper: houseOn, below, before the first frame)
  renderer.toneMappingExposure = 1.1;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let ratio = pixelRatio(1.75); // lib/device: lower on a phone or a weak device
  renderer.setPixelRatio(ratio);
  const big = renderer.capabilities.maxTextureSize >= 4096 && !(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const T = big ? 1024 : 512;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1a17);
  // lit at once by a generated room, then by a real HDRI (the workshop for
  // the RV, the lab for the superlab) once it has loaded
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const hdris = {};
  let disposed = false;
  const hdriFor = (p) => {
    const file = p === 'superlab' ? 'lab.exr' : 'workshop.exr';
    if (!hdris[file]) {
      hdris[file] = loadEnvironment(renderer, file)
        .then((t) => (disposed ? (t.dispose(), null) : t))
        .catch(() => null);
    }
    return hdris[file];
  };
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 60);
  camera.position.set(STATIONS.order, 1.55, 2.4);

  // light: a warm fill, tube lights down the room, a key that casts shadows
  const hemi = new THREE.HemisphereLight(0xfff4e6, 0x2a2420, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(1, 5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0005;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);
  key.target.position.set(1, 0.8, 0);
  const tubes = [];
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), toneMapped: false });
  // four tubes on the ceiling, lit by two lights between them (every light
  // is paid for on every pixel, so the room makes do with few)
  for (const x of [-4.4, -1.4, 1.6, 4.6]) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), tubeMat);
    tube.position.set(x, 2.95, -0.2);
    scene.add(tube);
  }
  for (const x of [-2.9, 3.1]) {
    const l = new THREE.PointLight(0xfff3e0, 6, 9, 1.4);
    l.position.set(x, 2.7, 0.3);
    scene.add(l);
    tubes.push(l);
  }
  const burnerLight = new THREE.PointLight(0xff7a2a, 0, 2, 2);
  scene.add(burnerLight);
  // the house look (lib/three/house): one shadow colour, measured off the
  // room's light and its HDRI (the room keeps its own dark, no fog)
  const house = houseOn({ renderer, scene, sun: key, hemi, env: { get texture() { return scene.environment; }, intensity: () => scene.environmentIntensity }, look: { fog: false } });
  let houseFrames = 0;

  // ── the room: two looks, the RV and the superlab ──
  // Photo-scanned CC0 materials (Poly Haven, ambientCG; see public/cc0),
  // sized in metres. Until they load the room is plainly shaded; if they
  // can't load, it paints its own textures instead.
  const SETS = {
    rv: { wall: ['rv-wall', 1.13], floor: ['rv-floor', 1.99], bench: ['rv-bench', 1.5] },
    superlab: { wall: ['lab-wall', 0.9], floor: ['lab-floor', 3], bench: ['lab-bench', 1, true] },
  };
  const AREA = { wall: [1, 1], floor: [18, 8], bench: [10.4, 0.8] }; // walls are UV-mapped in metres already
  const looks = {};
  const fit = (t, part, metres, srgb) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(AREA[part][0] / metres, AREA[part][1] / metres);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const dress = (mat, maps, metal) => {
    for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap']) mat[k]?.dispose?.();
    Object.assign(mat, { map: maps.color, normalMap: maps.normal, roughnessMap: maps.arm, aoMap: maps.arm, metalnessMap: metal ? maps.arm : null, roughness: 1, metalness: metal ? 1 : 0 });
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  };
  const paintFallback = (place, part, mat) => {
    const superlab = place === 'superlab';
    const set =
      part === 'wall'
        ? superlab
          ? paintTile({ size: T })
          : paintWood({ size: T })
        : part === 'floor'
          ? paintFloor({ size: T, kind: superlab ? 'superlab' : 'rv' })
          : superlab
            ? paintSteel({ size: T / 2 })
            : paintWood({ size: T / 2, seed: 11 });
    const metres = { wall: superlab ? 0.6 : 1.4, floor: superlab ? 4.5 : 3, bench: 1.3 }[part];
    dress(mat, { color: fit(new THREE.CanvasTexture(set.color), part, metres, true), normal: fit(new THREE.CanvasTexture(set.normal), part, metres), arm: fit(new THREE.CanvasTexture(set.rough), part, metres) }, false);
    mat.aoMap = null;
    if (part === 'bench' && superlab) mat.metalness = 0.9;
  };
  const lookFor = (place) => {
    if (looks[place]) return looks[place];
    const superlab = place === 'superlab';
    const L = {
      wall: new THREE.MeshStandardMaterial({ color: superlab ? 0xe4e6e8 : 0xa8703c, roughness: superlab ? 0.25 : 0.55 }),
      floor: new THREE.MeshStandardMaterial({ color: superlab ? 0x8e9196 : 0x9a8462, roughness: 0.7 }),
      bench: new THREE.MeshStandardMaterial(superlab ? { color: 0xc9ced3, metalness: 0.9, roughness: 0.3 } : { color: 0x6e3a22, roughness: 0.45 }),
    };
    looks[place] = L;
    L.ready = Promise.all(Object.keys(L).map((part) => {
      const [name, metres, metal] = SETS[place][part];
      return loadPbr(name)
        .then((maps) => {
          if (disposed) return Object.values(maps).forEach((t) => t.dispose());
          fit(maps.color, part, metres);
          fit(maps.normal, part, metres);
          fit(maps.arm, part, metres);
          return dress(L[part], maps, metal);
        })
        .catch(() => !disposed && paintFallback(place, part, L[part]));
    }));
    return L;
  };
  const room = new THREE.Group();
  scene.add(room);
  const wallParts = [];
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), null);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(1, 0, 2);
  floorMesh.receiveShadow = true;
  room.add(floorMesh);
  // the back wall, built round the serving hatch at the left
  const HATCH = { x0: -5.4, x1: -3.4, y0: 1.0, y1: 2.35 };
  const wallPiece = (x0, x1, y0, y1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), null);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.75);
    m.receiveShadow = true;
    // UVs in metres, so the texture lines up across the pieces
    const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, x0 + uv.getX(i) * (x1 - x0), y0 + uv.getY(i) * (y1 - y0));
    room.add(m);
    wallParts.push(m);
  };
  wallPiece(-8, HATCH.x0, 0, 3.2);
  wallPiece(HATCH.x1, 10, 0, 3.2);
  wallPiece(HATCH.x0, HATCH.x1, 0, HATCH.y0);
  wallPiece(HATCH.x0, HATCH.x1, HATCH.y1, 3.2);
  // outside the hatch: dusk over the desert, the Sandias
  {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#2b3a66');
    sky.addColorStop(0.55, '#e0835a');
    sky.addColorStop(0.75, '#f4c27a');
    sky.addColorStop(1, '#c49a6c');
    x.fillStyle = sky;
    x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#6e4a52';
    x.beginPath();
    x.moveTo(0, 360);
    for (let i = 0; i <= 1024; i += 32) x.lineTo(i, 330 - Math.abs(Math.sin(i * 0.011) * 60) - (i > 380 && i < 700 ? 50 : 0));
    x.lineTo(1024, 512);
    x.lineTo(0, 512);
    x.fill();
    x.fillStyle = '#a07c5a';
    x.fillRect(0, 410, 1024, 102);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: t }));
    back.position.set(-4.4, 1.6, -4.5);
    room.add(back);
  }
  // the hatch's ledge and frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b6f75, metalness: 0.6, roughness: 0.4 });
  {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.5), frameMat);
    ledge.position.set(-4.4, HATCH.y0, -0.62);
    ledge.castShadow = ledge.receiveShadow = true;
    room.add(ledge);
    for (const x of [HATCH.x0, HATCH.x1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, HATCH.y1 - HATCH.y0, 0.1), frameMat);
      post.position.set(x, (HATCH.y0 + HATCH.y1) / 2, -0.72);
      room.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.1), frameMat);
    top.position.set(-4.4, HATCH.y1, -0.72);
    room.add(top);
  }
  // the bench and a hazard rail along its front (the superlab's)
  const bench = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.06, 0.8), null);
  bench.position.set(1.9, BENCH_Y - 0.03, -0.33);
  bench.receiveShadow = true;
  bench.castShadow = true;
  room.add(bench);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(10.4, BENCH_Y - 0.06, 0.74), new THREE.MeshStandardMaterial({ color: 0x5c6168, metalness: 0.4, roughness: 0.55 }));
  cabinet.position.set(1.9, (BENCH_Y - 0.06) / 2, -0.36);
  cabinet.receiveShadow = true;
  room.add(cabinet);
  const hazardTex = new THREE.CanvasTexture(paintHazard());
  sharpen(hazardTex);
  hazardTex.colorSpace = THREE.SRGBColorSpace;
  hazardTex.wrapS = THREE.RepeatWrapping;
  hazardTex.repeat.set(24, 1);
  const hazard = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.05, 0.012), new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 }));
  hazard.position.set(1.9, BENCH_Y - 0.09, 0.075);
  room.add(hazard);
  let place = null;
  const setPlace = (p) => {
    if (p === place) return;
    place = p;
    hdriFor(p).then((t) => {
      if (t && place === p && !disposed) {
        scene.environment = t;
        scene.environmentIntensity = p === 'superlab' ? 0.7 : 0.62;
      }
    });
    const L = lookFor(p);
    floorMesh.material = L.floor;
    for (const w of wallParts) w.material = L.wall;
    bench.material = L.bench;
    hazard.visible = p === 'superlab';
    house.adopt(scene);
  };

  const shadowy = (o) => {
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  };
  const at = (station, dx = 0, dy = 0, dz = 0) => new THREE.Vector3(STATIONS[station] + dx, BENCH_Y + dy, dz);

  // ── Build: three trays, two drums, the flask, the mix-in jars ──
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.92, roughness: 0.28 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x80868d, metalness: 0.85, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const TRAY_X = [-1.0, -0.68, -0.3];
  const trays = ['small', 'medium', 'large'].map((size, i) => {
    const w = 0.22 + i * 0.07;
    const g = new THREE.Group();
    const lipMat = steel.clone();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.26), steel);
    g.add(base);
    for (const [sx, sz, ww, dd] of [[0, -0.13, w, 0.01], [0, 0.13, w, 0.01], [-w / 2, 0, 0.01, 0.26], [w / 2, 0, 0.01, 0.26]]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.04, dd), lipMat);
      lip.position.set(sx, 0.02, sz);
      g.add(lip);
    }
    g.position.copy(at('build', TRAY_X[i], 0.006, -0.02));
    scene.add(shadowy(g));
    return { size, g, lipMat };
  });
  const drum = (color, label, lc, side = 1) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.46, 32), new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 }));
    body.position.y = 0.23;
    g.add(body);
    for (const y of [0.08, 0.38]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.008, 8, 32), darkSteel);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.1515, 0.1515, 0.14, 32, 1, true, -0.7, 1.4), new THREE.MeshStandardMaterial({ map: tex(paintLabel(label, { bg: lc[0], fg: lc[1] }), renderer), roughness: 0.6 }));
    lab.position.y = 0.23;
    g.add(lab);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), darkSteel);
    spout.rotation.z = Math.PI / 2;
    spout.position.set(0.17 * side, 0.4, 0);
    g.add(spout);
    // (made here until the drum's model is in: see props below)
    g.userData = { side, label: lab, made: g.children.filter((c) => c !== lab), spout: new THREE.Vector3(0.17 * side, 0.4, 0) };
    return shadowy(g);
  };
  const baseDrum = drum(0xdfe3e6, 'BASE', ['#f4f6f7', '#22313a'], 1);
  baseDrum.position.copy(at('build', -0.14, 0, -0.42));
  scene.add(baseDrum);
  const blueDrum = drum(0x2f8fd0, 'BLUE', ['#d8eefa', '#0c3d61'], -1);
  blueDrum.position.copy(at('build', 0.4, 0, -0.42));
  blueDrum.rotation.y = 0.35;
  scene.add(blueDrum);
  const flask = new THREE.Group();
  {
    const pts = FLASK.map(([r, y]) => new THREE.Vector2(r, y));
    const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), glass);
    shell.renderOrder = 2;
    flask.add(shell);
  }
  flask.position.copy(at('build', 0.13, 0, 0.0));
  scene.add(flask);
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xd8e6ea, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.88, emissive: new THREE.Color(0.02, 0.06, 0.1) });
  const liquidPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  liquidMat.clippingPlanes = [liquidPlane];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(FLASK.slice(0, 6).map(([r, y]) => new THREE.Vector2(Math.max(0, r - 0.006), y + 0.004)), 48), liquidMat);
  liquid.renderOrder = 1;
  flask.add(liquid);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0xd8e6ea, roughness: 0.08, transparent: true, opacity: 0.9 }));
  surface.rotation.x = -Math.PI / 2;
  flask.add(surface);
  const fillLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.6, 0.2), toneMapped: false }));
  fillLine.rotation.x = Math.PI / 2;
  flask.add(fillLine);
  const streams = [baseDrum, blueDrum].map((d, i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 8), new THREE.MeshStandardMaterial({ color: i ? 0x4fb8ea : 0xe8ecef, roughness: 0.1, transparent: true, opacity: 0.85 }));
    s.visible = false;
    scene.add(s);
    return s;
  });
  const flakes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.004, 0.012), new THREE.MeshStandardMaterial({ color: 0xc8361e, roughness: 0.6 }), 24);
  flakes.count = 0;
  flask.add(flakes);
  const jars = Object.keys(M.mixins).map((k, i) => {
    const g = new THREE.Group();
    const colors = { blue: 0x2f8fd0, chili: 0xc8361e, seeds: 0xbfe8ff, spice: 0xd99a2b };
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 24, 1, true), glass);
    jar.position.y = 0.075;
    jar.renderOrder = 2;
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.1, 24), new THREE.MeshStandardMaterial({ color: colors[k], roughness: 0.7 }));
    fill.position.y = 0.055;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.5, roughness: 0.4 }));
    lid.position.y = 0.16;
    g.add(fill, jar, lid);
    g.position.copy(at('build', 0.56 + i * 0.17, 0, 0.04));
    scene.add(shadowy(g));
    return { k, g };
  });

  // ── Cook: the vat on its burner, the gauge, trays filling on the rack ──
  const vat = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.31, 0.5, 48, 1, true), steel);
    body.material = steel;
    body.position.y = 0.33;
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.3, 0.5, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.35, side: THREE.BackSide }));
    inside.position.y = 0.33;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 10, 48), steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.58;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 32), darkSteel);
    stand.position.y = 0.04;
    vat.add(body, inside, rim, stand);
  }
  vat.position.copy(at('cook', -0.2, 0, -0.32));
  scene.add(shadowy(vat));
  const burner = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.12, 0.05), toneMapped: false }));
  burner.rotation.x = Math.PI / 2;
  burner.position.set(0, 0.085, 0);
  vat.add(burner);
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.325, 48), new THREE.MeshStandardMaterial({ color: 0x4fb8ea, roughness: 0.15, emissive: new THREE.Color(0, 0, 0) }));
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = 0.45;
  vat.add(brew);
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, transparent: true, opacity: 0.7 }), 40);
  vat.add(bubbles);
  const bubbleState = Array.from({ length: 40 }, () => ({ x: 0, z: 0, t: Math.random(), s: 0.01 + Math.random() * 0.02 }));
  const steamTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  loadTexture('cloud.webp')
    .then((t) => {
      if (disposed) return t.dispose();
      for (const st of steam) {
        st.material.map = t;
        st.material.needsUpdate = true;
      }
      return null;
    })
    .catch(() => {});
  const steam = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { t: i / 14 };
    vat.add(s);
    return s;
  });
  // the gauge: a dial on a post in front of the vat, with a needle
  const dialCanvas = document.createElement('canvas');
  dialCanvas.width = dialCanvas.height = 256;
  const dialTex = new THREE.CanvasTexture(dialCanvas);
  sharpen(dialTex);
  dialTex.colorSpace = THREE.SRGBColorSpace;
  const gauge = new THREE.Group();
  {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.14, 48), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.4 }));
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.012, 10, 48), steel);
    const glassFace = new THREE.Mesh(new THREE.CircleGeometry(0.14, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02 }));
    glassFace.position.z = 0.01;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 10), darkSteel);
    post.position.y = -0.27;
    gauge.add(face, bezel, glassFace, post);
  }
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.004), new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.4 }));
  needle.geometry.translate(0, 0.055, 0.006);
  gauge.add(needle);
  gauge.position.copy(at('cook', 0.38, 0.42, 0.0));
  gauge.rotation.y = -0.25;
  scene.add(shadowy(gauge));
  let dialBand = '';
  const cookTrays = [0, 1, 2].map((i) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.2), steel);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.18), new THREE.MeshStandardMaterial({ color: 0x4fb8ea, roughness: 0.15, emissive: new THREE.Color(0.02, 0.08, 0.14) }));
    blue.position.y = 0.008;
    blue.scale.x = 0.001;
    g.add(base, blue);
    g.position.copy(at('cook', 0.7, 0.01 + i * 0.12, -0.42));
    scene.add(shadowy(g));
    return { g, blue };
  });
  {
    // a wire rack for them
    for (const dx of [-0.16, 0.16]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6), darkSteel);
      post.position.copy(at('cook', 0.7 + dx, 0.21, -0.32));
      scene.add(post);
    }
  }

  // ── Break: the slab of blue in its tray, and the hammer over it ──
  const slabTray = new THREE.Group();
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.014, 0.42), steel);
    slabTray.add(base);
    for (const [x, z, w, d] of [[0, -0.21, 1.0, 0.012], [0, 0.21, 1.0, 0.012], [-0.5, 0, 0.012, 0.42], [0.5, 0, 0.012, 0.42]]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), steel);
      lip.position.set(x, 0.025, z);
      slabTray.add(lip);
    }
  }
  slabTray.position.copy(at('break', 0, 0.007, -0.2));
  scene.add(shadowy(slabTray));
  const crystal = new THREE.MeshStandardMaterial({ color: 0x5cc4f0, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.92, emissive: new THREE.Color(0.03, 0.1, 0.16), envMapIntensity: 1.4 });
  const slabGroup = new THREE.Group();
  slabTray.add(slabGroup);
  let slabKey = '';
  const crackMarks = new THREE.Group();
  slabTray.add(crackMarks);
  const hammer = new THREE.Group();
  {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), darkSteel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.7 }));
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.2;
    hammer.add(head, handle);
  }
  scene.add(shadowy(hammer));

  // ── Walt's drums and hammer as models (props.js), once they're in ──
  loadProps(renderer).then((models) => {
    if (disposed) {
      for (const m of Object.values(models)) m?.traverse((o) => o.isMesh && (o.geometry.dispose(), o.material.map?.dispose(), o.material.dispose()));
      return;
    }
    for (const [name, d] of [['drumBase', baseDrum], ['drumBlue', blueDrum]]) {
      const m = models[name];
      if (!m) continue;
      const { side, label, made } = d.userData;
      for (const c of made) c.visible = false;
      m.rotation.y = side < 0 ? Math.PI : 0; // its spout toward the flask
      d.add(m);
      spoutOf(name, side, d.userData.spout);
      // the label on the drum's band
      const [y, r] = PROPS[name].band;
      label.position.y = y;
      label.scale.set((r * 1.03) / 0.1515, 1, (r * 1.03) / 0.1515);
    }
    if (models.hammer) {
      for (const c of [...hammer.children]) c.visible = false;
      hammer.add(models.hammer);
    }
  });
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.2), toneMapped: false }));
  marker.rotation.x = Math.PI;
  scene.add(marker);

  // ── Pack: the scale, the pack on it, finished bags beside ──
  const scale = new THREE.Group();
  {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.34), darkSteel);
    foot.position.y = 0.03;
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.015, 0.32), steel);
    pan.position.y = 0.07;
    scale.add(foot, pan);
  }
  scale.position.copy(at('pack', -0.2, 0, -0.2));
  scene.add(shadowy(scale));
  const scaleDialCanvas = document.createElement('canvas');
  scaleDialCanvas.width = scaleDialCanvas.height = 256;
  const scaleDialTex = new THREE.CanvasTexture(scaleDialCanvas);
  sharpen(scaleDialTex);
  scaleDialTex.colorSpace = THREE.SRGBColorSpace;
  const scaleDial = new THREE.Group();
  {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.11, 40), new THREE.MeshStandardMaterial({ map: scaleDialTex, roughness: 0.4 }));
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 8, 40), steel);
    scaleDial.add(face, bezel);
  }
  const scaleNeedle = needle.clone();
  scaleNeedle.material = needle.material;
  scaleDial.add(scaleNeedle);
  scaleDial.position.copy(at('pack', -0.2, 0.2, 0.0));
  scale.add(scaleDial);
  scaleDial.position.set(0, 0.2, 0.17);
  let scaleKey = '';
  const packs = {};
  {
    const box = new THREE.Group();
    const pollos = new THREE.MeshStandardMaterial({ map: tex(paintPollosBox(), renderer), roughness: 0.75 });
    const card = new THREE.MeshStandardMaterial({ color: 0xf2c318, roughness: 0.8 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.2), [card, card, card, card, pollos, card]);
    b.position.y = 0.12;
    box.add(b);
    packs.box = { g: box, face: { w: 0.26, h: 0.24, z: 0.101, y: 0.12 } };
    const drumG = new THREE.Group();
    const dbody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 32), new THREE.MeshStandardMaterial({ color: 0x3e6a92, metalness: 0.4, roughness: 0.4 }));
    dbody.position.y = 0.17;
    const dlab = new THREE.Mesh(new THREE.CylinderGeometry(0.1315, 0.1315, 0.14, 32, 1, true, -0.8, 1.6), new THREE.MeshStandardMaterial({ map: tex(paintLabel('MADRIGAL', { bg: '#e9eef2', fg: '#1d3550', sub: 'ELEKTRO' }), renderer), roughness: 0.6 }));
    dlab.position.y = 0.17;
    drumG.add(dbody, dlab);
    packs.barrel = { g: drumG, face: { w: 0.16, h: 0.2, z: 0.134, y: 0.17 } };
    const bag = new THREE.Group();
    const film = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }));
    film.position.y = 0.11;
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.042), new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.5 }));
    zip.position.y = 0.2;
    bag.add(film, zip);
    packs.baggie = { g: bag, face: { w: 0.18, h: 0.22, z: 0.021, y: 0.11 } };
    for (const p of Object.values(packs)) {
      p.g.position.y = 0.078;
      p.g.visible = false;
      scale.add(shadowy(p.g));
      // crystals inside, rising with the fill
      const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crystal);
      fill.visible = false;
      p.g.add(fill);
      p.fill = fill;
      p.stickers = new THREE.Group();
      p.g.add(p.stickers);
      p.stickerKey = '';
    }
  }
  const stickerTex = {};
  const stickerFor = (kind) => {
    if (stickerTex[kind]) return stickerTex[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.translate(64, 64);
    if (kind === 'hat') {
      x.fillStyle = '#1a1a1a';
      x.beginPath();
      x.ellipse(0, 22, 58, 14, 0, 0, Math.PI * 2);
      x.fill();
      x.fillRect(-32, -30, 64, 52);
      x.fillStyle = '#3a3a3a';
      x.fillRect(-32, 8, 64, 10);
    } else if (kind === 'bluesky') {
      x.fillStyle = '#1d78c4';
      x.beginPath();
      x.arc(0, 0, 58, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#fff';
      x.font = 'bold 30px Arial';
      x.textAlign = 'center';
      x.fillText('BLUE', 0, -4);
      x.fillText('SKY', 0, 26);
    } else if (kind === 'pollos') {
      x.fillStyle = '#b5281c';
      x.beginPath();
      x.arc(0, 0, 58, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#ffd23a';
      x.beginPath();
      x.ellipse(-4, 6, 30, 22, 0, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.arc(22, -16, 13, 0, Math.PI * 2);
      x.fill();
    } else {
      x.fillStyle = '#1d3550';
      x.fillRect(-58, -40, 116, 80);
      x.fillStyle = '#fff';
      x.font = 'bold 22px Arial';
      x.textAlign = 'center';
      x.fillText('MADRIGAL', 0, 8);
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    stickerTex[kind] = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    return stickerTex[kind];
  };
  const stickerGeo = new THREE.PlaneGeometry(1, 1);
  const doneBags = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0x9fdcf5, roughness: 0.15, transparent: true, opacity: 0.85 }), 3);
  doneBags.count = 0;
  scene.add(doneBags);

  // ── the hatch: customers outside, the tip jar on the ledge ──
  const standeeTex = new Map();
  const standeeFor = (who, mood) => {
    const k = `${who}:${mood}`;
    if (standeeTex.has(k)) return standeeTex.get(k);
    const svg = renderToStaticMarkup(createElement(Face, { who, mood })).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"');
    const img = new Image();
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    img.onload = () => {
      t.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, roughness: 0.8, side: THREE.DoubleSide });
    standeeTex.set(k, mat);
    return mat;
  };
  const standees = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), null);
    m.visible = false;
    m.castShadow = true;
    m.userData = { phase: i * 1.7 };
    scene.add(m);
    return m;
  });
  const jar = new THREE.Group();
  {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 32, 1, true), glass);
    shell.position.y = 0.1;
    shell.renderOrder = 2;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0905, 0.0855, 0.06, 32, 1, true, -0.6, 1.2), new THREE.MeshStandardMaterial({ map: tex(paintLabel('TIPS', { bg: '#f6efdc', fg: '#8a1c1c', w: 256, h: 128, font: 'bold 70px Georgia, serif' }), renderer) }));
    label.position.y = 0.13;
    jar.add(shell, label);
  }
  jar.position.set(-3.75, HATCH.y0 + 0.03, -0.55);
  scene.add(jar);
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 16), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.9, roughness: 0.3 }), 60);
  coins.count = 0;
  jar.add(coins);
  let flying = [];
  let lastTip = null;

  // ── the people: customers outside the hatch, Walt at the bench, Jesse in
  // the room ── Rigged figures (office/people.js) once the cast has loaded;
  // until then, or for anyone whose figure can't be had, the cut-outs above.
  const folks = { ready: false, people: null, at: new Map(), walt: null, jesse: null, reaction: null, undress: [] };
  // Each on their feet stands on clips (office/people.js: a calm idle, the
  // walk paced to the floor they cover, the clip library's for the rest):
  // the line walks up to the hatch and off again (./queue.js), Walt steps
  // between the stations, Jesse throws his arms up at a great batch.
  const cast = [...Object.keys(CUSTOMERS), 'walt', 'jesseLab'];
  loadPeople(cast.map((id) => ABQ[id]).filter(Boolean), null, { clips: true })
    .then((people) => {
      if (disposed) return people.dispose();
      const walt = people.person(ABQ.walt, { pose: 'stand', anim: true });
      if (!walt) return people.dispose(); // no models: the cut-outs stay
      folks.people = people;
      folks.walt = walt;
      folks.waltHead = walt.group.getObjectByName('Head');
      walt.group.rotation.y = Math.PI; // at the bench, his back to us
      folks.jesse = people.person(ABQ.jesseLab, { pose: 'stand', idle: true, anim: true });
      // both in the lab’s suits, as the universe’s wardrobe colours them;
      // Jesse’s gear on too (Walt’s eyes are the camera’s: nothing on his
      // head or face to see through, so his colours only, his own sleeves
      // and hands at the bench)
      const looks = readLooks(local.get(LOOK_KEY));
      const mats = dressColors(walt, dressedAs('walt', looks.walt, ABQ.walt).look);
      folks.undress.push(() => mats.forEach((m) => m.dispose()));
      const jesse = dressedAs('jesse', looks.jesse, ABQ.jesseLab).look;
      if (folks.jesse && jesse) folks.undress.push(putOn(folks.jesse, jesse));
      scene.add(walt.group);
      if (folks.jesse) scene.add(folks.jesse.group);
      folks.ready = true;
    })
    .catch(() => {});
  // one figure a customer, made the first time they come and kept
  const figureFor = (id) => {
    if (!folks.at.has(id)) {
      const p = ABQ[id] ? folks.people.person(ABQ[id], { pose: 'stand', idle: true, anim: true }) : null;
      if (p) {
        p.group.visible = false;
        scene.add(p.group);
      }
      folks.at.set(id, p && { p, mood: null });
    }
    return folks.at.get(id);
  };
  // the line, walked: in from the left beyond the hatch, off to the right
  const line = createQueue({ enter: { x: -7.6, z: -2.7 }, leave: { x: -1.2, z: -2.5 } });
  const crowdAnchors = []; // over each customer's head, in crowd order
  const waltAt = new THREE.Vector3(STATIONS.order - 0.42, 0, 0.42);
  const WALT_EYES = 1.66; // how far his eyes are off the floor
  const WALT_BACK = 0.1; // at the bench, his body this far behind the camera (his neck out of sight)
  const reachFor = new THREE.Vector3();
  const headTmp = new THREE.Vector3();

  // ── per frame ──
  const camPos = new THREE.Vector3().copy(camera.position);
  const camLook = new THREE.Vector3(STATIONS.order, 1.2, -0.4);
  const want = new THREE.Vector3();
  const look = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  let clock = 0;
  let size = { w: 1, h: 1 };
  let lost = false;
  let shadows = true;

  const viewFor = (station) => {
    const x = STATIONS[station] ?? STATIONS.order;
    if (station === 'order' || station === 'serve' || station === 'idle') return [want.set(x + 0.15, 1.65, 2.2), look.set(x, 1.35, -1)];
    if (station === 'cook') return [want.set(x + 0.1, 1.55, 1.55), look.set(x + 0.1, 1.08, -0.3)];
    if (station === 'break') return [want.set(x, 1.75, 1.15), look.set(x, 0.92, -0.25)];
    if (station === 'pack') return [want.set(x - 0.1, 1.45, 1.25), look.set(x - 0.15, 1.08, -0.2)];
    return [want.set(x + 0.05, 1.55, 1.75), look.set(x + 0.05, 0.98, -0.25)];
  };

  function render(live, ms = 16) {
    if (lost) return;
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    setPlace(live.place === 'superlab' ? 'superlab' : 'rv');
    const [p, l] = viewFor(live.station);
    const k = 1 - Math.exp(-dt * 3.2);
    camPos.lerp(p, k);
    camLook.lerp(l, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // build (what the station's doing, or what was made for this order)
    const now = performance.now() / 1000;
    const b = live.build ?? live.made?.build ?? {};
    for (const t of trays) {
      const on = b.size === t.size;
      t.lipMat.emissive.setRGB(on ? 0.9 : 0, on ? 0.65 : 0, on ? 0.05 : 0);
      t.g.position.y = BENCH_Y + 0.006 + (on ? 0.012 : 0);
    }
    const base = b.base ?? 0;
    const lvl = base * FLASK_H;
    liquidPlane.constant = flask.position.y + lvl + 0.004;
    liquid.visible = base > 0.01;
    surface.visible = base > 0.01;
    const shade = PALE.clone().lerp(DEEP, Math.min(1, (b.mix?.blue ?? 0) / 3));
    liquidMat.color.copy(shade);
    surface.material.color.copy(shade).offsetHSL(0, 0, 0.06);
    const r = flaskRadius(lvl) - 0.006;
    surface.position.y = lvl + 0.004;
    surface.scale.setScalar(Math.max(0.001, r));
    const target = b.target ?? 0;
    fillLine.visible = target > 0 && live.station === 'build';
    fillLine.position.y = target * FLASK_H + 0.004;
    fillLine.scale.setScalar(flaskRadius(target * FLASK_H) + 0.002);
    fillLine.material.color.setRGB(b.near ? 0.4 : 2, b.near ? 2.2 : 1.6, b.near ? 0.8 : 0.2);
    for (const [i, d] of [baseDrum, blueDrum].entries()) {
      const on = (i === 0 && b.pour === 'base') || (i === 1 && b.pour === 'blue');
      const s = streams[i];
      s.visible = on;
      if (on) {
        const from = v3.copy(d.userData.spout).applyEuler(d.rotation).add(d.position);
        const to = s3.set(flask.position.x, flask.position.y + Math.max(0.08, lvl + 0.02), flask.position.z);
        s.position.copy(from).add(to).multiplyScalar(0.5);
        s.scale.set(1, from.distanceTo(to), 1);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
      }
    }
    const nFlakes = Math.min(24, (b.mix?.chili ?? 0) * 6);
    flakes.count = nFlakes;
    for (let i = 0; i < nFlakes; i++) {
      const a = i * 2.4;
      const rr = (r - 0.01) * ((i % 6) / 6);
      m4.compose(v3.set(Math.cos(a) * rr, lvl + 0.007, Math.sin(a) * rr), q.setFromAxisAngle(s3.set(0, 1, 0), a), s3.set(1, 1, 1));
      flakes.setMatrixAt(i, m4);
    }
    flakes.instanceMatrix.needsUpdate = true;
    const open = live.mixins ?? ['blue', 'chili'];
    for (const j of jars) {
      j.g.visible = open.includes(j.k);
      j.g.position.y = BENCH_Y + (b.lastAdd === j.k && now - (b.lastAddAt ?? -9) < 0.25 ? 0.04 : 0);
    }

    // cook
    const c = live.cook ?? { heat: 0.2, progress: live.made?.cook ? 1 : 0 };
    const heat = c.heat ?? 0.25;
    needle.rotation.z = -((-120 + heat * 240) * Math.PI) / 180;
    const bandKey = c.band ? c.band.map((v) => v.toFixed(3)).join() : '';
    if (bandKey !== dialBand) {
      dialBand = bandKey;
      paintDial(dialCanvas, { band: c.band, label: 'TEMP' });
      dialTex.needsUpdate = true;
    }
    const hot = live.station === 'cook' ? heat : 0.15;
    burner.material.color.setRGB(0.3 + hot * 3.2, 0.12 + hot * 1.1, 0.05 + hot * 0.2);
    burnerLight.position.set(vat.position.x, vat.position.y + 0.1, vat.position.z + 0.3);
    burnerLight.intensity = hot * 3;
    brew.material.color.copy(shade);
    brew.material.emissive.setRGB(hot * 0.15, hot * 0.25, hot * 0.4);
    const boil = Math.max(0, (heat - 0.35) / 0.65);
    bubbles.count = Math.round(boil * 40);
    for (let i = 0; i < bubbles.count; i++) {
      const s = bubbleState[i];
      s.t += dt * (0.6 + boil * 1.4);
      if (s.t > 1 || s.x === 0) {
        s.t = 0;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * 0.28;
        s.x = Math.cos(a) * rr;
        s.z = Math.sin(a) * rr;
      }
      const sc = s.s * Math.sin(s.t * Math.PI);
      m4.compose(v3.set(s.x, 0.45 + sc * 0.4, s.z), q.identity(), s3.setScalar(Math.max(0.0001, sc)));
      bubbles.setMatrixAt(i, m4);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    for (const st of steam) {
      st.userData.t = (st.userData.t + dt * 0.35) % 1;
      const t = st.userData.t;
      st.position.set(Math.sin(t * 9 + st.id) * 0.12, 0.5 + t * 0.9, Math.cos(t * 7 + st.id) * 0.1);
      st.scale.setScalar(0.12 + t * 0.4);
      st.material.opacity = boil * 0.5 * Math.sin(t * Math.PI);
    }
    const prog = c.progress ?? 0;
    const nTrays = live.order ? M.sizes[live.order.size].trays : 0;
    cookTrays.forEach((t, i) => {
      t.g.visible = i < Math.max(1, nTrays);
      t.blue.scale.x = Math.max(0.001, Math.min(1, prog * Math.max(1, nTrays) - i));
      t.blue.material.color.copy(shade);
    });

    // break
    const br = live.brk ?? live.made?.break ?? null;
    const cracks = br?.cracks ?? [0.3, 0.6];
    const broken = br?.broken ?? cracks.map(() => null);
    const sk = `${cracks.join()}|${broken.map((x) => (x == null ? 0 : 1)).join('')}`;
    if (sk !== slabKey) {
      slabKey = sk;
      for (const o of [...slabGroup.children, ...crackMarks.children]) o.geometry.dispose();
      for (const o of crackMarks.children) o.material.dispose();
      slabGroup.clear();
      crackMarks.clear();
      // the slab, split at every crack that's been struck
      const cuts = [0, ...cracks.filter((_, i) => broken[i] != null), 1].sort((a, z) => a - z);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i];
        const z = cuts[i + 1];
        const w = (z - a) * 0.96 - (cuts.length > 2 ? 0.01 : 0);
        const piece = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, 0.38), crystal);
        piece.position.set(-0.48 + (a + z) * 0.48, 0.022, 0);
        if (cuts.length > 2) piece.rotation.set((i % 2 ? 1 : -1) * 0.03, 0, (i % 3) * 0.02);
        piece.castShadow = true;
        slabGroup.add(piece);
      }
      cracks.forEach((cx, i) => {
        if (broken[i] != null) return;
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
        mark.position.set(-0.48 + cx * 0.96, 0.038, 0);
        crackMarks.add(mark);
      });
    }
    crystal.color.copy(shade).lerp(BLUE, 0.4);
    const hx = br?.x ?? 0.5;
    const since = now - (br?.strikeAt ?? -9);
    const drop = since < 0.12 ? since / 0.12 : since < 0.3 ? 1 - (since - 0.12) / 0.18 : 0;
    hammer.position.set(slabTray.position.x - 0.48 + hx * 0.96, BENCH_Y + 0.3 - drop * 0.24, slabTray.position.z + 0.02);
    hammer.rotation.set(-0.25 + drop * 0.25, 0, 0);
    hammer.visible = live.station === 'break';
    marker.position.set(hammer.position.x, BENCH_Y + 0.12, slabTray.position.z);
    marker.visible = live.station === 'break';

    // pack
    const pk = live.pack ?? live.made?.pack ?? {};
    for (const [name, p] of Object.entries(packs)) {
      p.g.visible = name === pk.pack;
      if (!p.g.visible) continue;
      const w = pk.w ?? 0;
      const f = p.face;
      p.fill.visible = w > 0.01;
      p.fill.scale.set(f.w * 0.82, Math.max(0.001, (f.h * 0.9 * Math.min(1, w)) / 1), 0.03);
      p.fill.position.set(0, f.y - (f.h * 0.9) / 2 + (f.h * 0.9 * Math.min(1, w)) / 2, f.z - 0.02);
      const key2 = JSON.stringify(pk.stickers ?? []);
      if (key2 !== p.stickerKey) {
        p.stickerKey = key2;
        p.stickers.clear();
        for (const s of pk.stickers ?? []) {
          const m = new THREE.Mesh(stickerGeo, stickerFor(s.kind));
          const size_ = Math.min(f.w, f.h) * 0.32;
          m.scale.set(size_, size_, 1);
          m.position.set(-f.w / 2 + s.x * f.w, f.y + f.h / 2 - s.y * f.h, f.z + 0.002);
          p.stickers.add(m);
        }
      }
    }
    const tw = M.packs[pk.pack ?? live.order?.pack ?? 'baggie']?.weight ?? 0.34;
    const sKey = `${tw}`;
    if (sKey !== scaleKey) {
      scaleKey = sKey;
      paintDial(scaleDialCanvas, { from: -90, to: 90, band: [tw - 0.035, tw + 0.035], label: 'kg' });
      scaleDialTex.needsUpdate = true;
    }
    scaleNeedle.rotation.z = -((-90 + Math.min(1, pk.w ?? 0) * 180) * Math.PI) / 180;
    const nDone = Math.min(3, pk.bags?.length ?? 0);
    doneBags.count = nDone;
    for (let i = 0; i < nDone; i++) {
      m4.compose(v3.set(STATIONS.pack + 0.35 + i * 0.15, BENCH_Y + 0.07, -0.25), q.identity(), s3.set(1, 1, 1));
      doneBags.setMatrixAt(i, m4);
    }
    doneBags.instanceMatrix.needsUpdate = true;
    doneBags.material.color.copy(shade).lerp(BLUE, 0.5);

    // customers at the hatch: the one being served at the front, the queue behind
    const crowd = [];
    if (live.serving) crowd.push({ ...live.serving, front: true });
    for (const e of live.lobby ?? []) if (crowd.length < standees.length) crowd.push(e);
    // (only drawn while the camera's at the hatch)
    const atHatch = Math.abs(camPos.x - STATIONS.order) < 2.6;
    const shown = new Set();
    crowdAnchors.length = 0;
    // each in the line's place: the front one at the ledge, the rest behind
    const spotOf = (e, i) => {
      const front = e.front || (!live.serving && i === 0);
      const slot = live.serving ? i : i + 1;
      return { front, x: -4.4 + (front ? 0 : (slot % 2 ? -1 : 1) * (0.35 + Math.floor(slot / 2) * 0.3)), z: front ? -1.05 : -1.5 - slot * 0.35 };
    };
    // the figures walked to theirs (the line moving up, the served walking off)
    const wanted = [];
    const placed = new Set();
    if (folks.ready)
      crowd.forEach((e, i) => {
        if (i >= standees.length || placed.has(e.customer) || !figureFor(e.customer)) return;
        placed.add(e.customer);
        const { front, x, z } = spotOf(e, i);
        wanted.push({ id: e.customer, x, z: front ? -1.25 : z, face: front ? 0 : Math.atan2(-4.4 - x, -0.75 - z) });
      });
    const walked = new Map(folks.ready ? line.step(dt, wanted).map((w) => [w.id, w]) : []);
    standees.forEach((m, i) => {
      const e = crowd[i];
      m.visible = !!e && !folks.ready;
      if (!e) return;
      const { front, x, z } = spotOf(e, i);
      const f = folks.ready ? figureFor(e.customer) : null;
      if (!f) {
        // a cut-out: until the cast is in, or if their figure can't be had
        m.visible = true;
        m.material = standeeFor(e.customer, e.mood ?? 'wait');
        const s = front ? 1.05 : 0.85;
        m.scale.set(s, s, 1);
        m.position.set(x, 1.12 + Math.sin(clock * 2 + m.userData.phase) * 0.012 + (front ? 0.05 : -0.05), z);
        if (folks.ready) crowdAnchors.push(new THREE.Vector3(x, m.position.y + s * 0.5, z));
        return;
      }
      // a figure: the one being served at the ledge, looking at us once
      // they're there; the queue behind, turned to the hatch
      if (shown.has(e.customer)) return crowdAnchors.push(null);
      shown.add(e.customer);
      const g = f.p.group;
      const w = walked.get(e.customer);
      g.visible = atHatch;
      if (w) {
        g.position.set(w.x, 0, w.z);
        g.rotation.y = w.yaw;
      } else {
        g.position.set(x, 0, front ? -1.25 : z);
        g.rotation.y = front ? 0 : Math.atan2(-4.4 - x, -0.75 - z);
      }
      f.p.look(front && (!w || w.arrived) ? camera.position : null);
      // the one at the front shows how the order left them
      const mood = front ? (e.mood ?? 'wait') : null;
      if (mood !== f.mood) {
        f.mood = mood;
        const gesture = mood && moodGesture(mood);
        if (gesture) f.p.gesture(gesture);
      }
      if (atHatch) f.p.update(clock, dt);
      crowdAnchors.push(f.p.headAt(new THREE.Vector3()).add(headTmp.set(0, 0.3, 0)));
    });
    // (the one just served, walking off; anyone else out of the line, put away)
    if (folks.ready)
      for (const [id, f] of folks.at) {
        if (!f || shown.has(id)) continue;
        const w = walked.get(id);
        f.p.group.visible = Boolean(w) && atHatch;
        if (!w) continue;
        f.p.group.position.set(w.x, 0, w.z);
        f.p.group.rotation.y = w.yaw;
        f.p.look(null);
        if (atHatch) f.p.update(clock, dt);
      }

    // Walt, at the station, his hand on what he's working with; Jesse in the
    // room, reacting to each order (unless he's outside, ordering)
    if (folks.ready) {
      const walt = folks.walt;
      const sx = STATIONS[live.station] ?? STATIONS.order;
      // at the hatch, over his shoulder; at the bench, his eyes are ours: his
      // head is hidden, his body a step behind us, and only his arms come
      // into view
      const bench = !(live.station in { order: 1, serve: 1, idle: 1 });
      if (bench) waltAt.set(camPos.x - 0.02, camPos.y - WALT_EYES, camPos.z + WALT_BACK);
      else waltAt.lerp(v3.set(sx - 0.42, 0, 0.42), k);
      walt.group.position.copy(waltAt);
      folks.waltHead.scale.setScalar(bench ? 1e-3 : 1);
      let hand = null;
      if (live.station === 'build' && (b.pour === 'base' || b.pour === 'blue')) {
        const d = b.pour === 'base' ? baseDrum : blueDrum;
        hand = d.localToWorld(reachFor.copy(d.userData.spout));
      } else if (live.station === 'cook' && live.cook) hand = gauge.localToWorld(reachFor.set(0, 0.08, 0.02));
      else if (live.station === 'break' && live.brk) {
        hammer.updateMatrixWorld();
        hand = hammer.localToWorld(reachFor.set(0, 0, 0.36));
      } else if (live.station === 'pack' && pk.pack && packs[pk.pack]) hand = packs[pk.pack].g.localToWorld(reachFor.set(0, 0.12, 0.05));
      walt.reach('right', hand);
      walt.update(clock, dt);
      const jesse = folks.jesse;
      if (jesse) {
        jesse.group.visible = !shown.has('jesse');
        jesse.group.position.set(-2.9, 0, 0.5);
        jesse.group.rotation.y = -0.5;
        jesse.look(walt.headAt(headTmp));
        if (live.reaction && live.reaction.at !== folks.reaction) {
          folks.reaction = live.reaction.at;
          const gesture = moodGesture(live.reaction.mood);
          if (gesture) jesse.gesture(gesture);
        }
        if (jesse.group.visible) jesse.update(clock, dt);
      }
    }

    // tips: coins arc from the hatch into the jar
    if (live.tip && live.tip.at !== lastTip) {
      lastTip = live.tip.at;
      const n = Math.min(12, Math.max(2, Math.round(live.tip.amount / 4)));
      for (let i = 0; i < n; i++) flying.push({ t: -i * 0.06, x: -4.4 + (Math.random() - 0.5) * 0.3 });
    }
    flying = flying.filter((f) => f.t < 1);
    const settled = Math.min(60, Math.round((live.jar ?? 0) / 5));
    coins.count = Math.min(60, settled + flying.length);
    for (let i = 0; i < settled; i++) {
      const a = i * 2.3;
      m4.compose(v3.set(Math.cos(a) * 0.04 * ((i % 3) / 2), 0.006 + Math.floor(i / 6) * 0.006, Math.sin(a) * 0.04 * ((i % 3) / 2)), q.setFromAxisAngle(s3.set(1, 0, 0), 0.1 * (i % 4)), s3.set(1, 1, 1));
      coins.setMatrixAt(i, m4);
    }
    flying.forEach((f, i) => {
      f.t += dt * 1.6;
      const t = Math.max(0, f.t);
      const x = (f.x - jar.position.x) * (1 - t);
      const y = 0.4 * Math.sin(t * Math.PI) + 0.25 * (1 - t);
      m4.compose(v3.set(x, y, (1 - t) * -0.3), q.setFromAxisAngle(s3.set(1, 0, 0), t * 8), s3.set(1, 1, 1));
      if (settled + i < 60) coins.setMatrixAt(settled + i, m4);
    });
    coins.instanceMatrix.needsUpdate = true;

    renderer.shadowMap.enabled = shadows;
    // (and whatever's come in since: the people, the props)
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    renderer.render(scene, camera);
    watch();
  }

  // slow frames: drop the pixel ratio, then shadows, then tell the page.
  // Judged every couple of seconds of real time, not every so many frames,
  // so a machine managing a few frames a second is helped within seconds.
  const perf = { acc: 0, n: 0, step: 0, last: performance.now() };
  const watch = () => {
    const t = performance.now();
    const gap = t - perf.last;
    perf.last = t;
    if (gap > 1000) {
      // back from a pause (off screen, another tab): start the count again
      perf.acc = 0;
      perf.n = 0;
      return;
    }
    perf.acc += gap;
    perf.n += 1;
    if (perf.acc < 3000 || perf.n < 4) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 40) return; // a battery-saving 30 fps cap isn't struggling
    if (ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    } else if (shadows) shadows = false;
    else if (avg > 60 && perf.step !== 'told') {
      perf.step = 'told';
      onSlow?.();
    }
  };
  const resize = (w, h) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.fov = camera.aspect < 1.2 ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  setPlace('rv');

  // where a point is on screen, for labels over the customers
  const project = (x, y, z) => {
    v3.set(x, y, z).project(camera);
    return [((v3.x + 1) / 2) * size.w, ((1 - v3.y) / 2) * size.h, v3.z < 1];
  };
  // (over the figures' heads once they're in, else over the cut-outs; in
  // crowd order either way, the one being served first)
  const standeeAnchors = () =>
    folks.ready
      ? crowdAnchors.map((p) => (p ? project(p.x, p.y, p.z) : [0, 0, false]))
      : standees.filter((m) => m.visible).map((m) => project(m.position.x, m.position.y + m.scale.y * 0.5, m.position.z));

  // renderer counts, for the QA pass (draw calls, triangles, textures)
  const diagnostics = () => {
    const { render: r, memory: m } = renderer.info;
    return { calls: r.calls, triangles: r.triangles, geometries: m.geometries, textures: m.textures, ratio, shadows };
  };

  const dispose = () => {
    disposed = true;
    for (const off of folks.undress) off();
    folks.people?.dispose();
    for (const p of Object.values(hdris)) p.then((t) => t?.dispose());
    canvas.removeEventListener('webglcontextlost', onContextLost);
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const k2 of ['map', 'normalMap', 'roughnessMap']) m[k2]?.dispose?.();
        m.dispose?.();
      }
    });
    // each look also holds its `ready` promise, which isn't a material
    for (const L of Object.values(looks)) for (const m of Object.values(L)) {
      if (!m?.isMaterial) continue;
      for (const k2 of ['map', 'normalMap', 'roughnessMap']) m[k2]?.dispose?.();
      m.dispose();
    }
    for (const m of standeeTex.values()) {
      m.map?.dispose();
      m.dispose();
    }
    env.dispose();
    renderer.dispose();
    // give the context back soon, not when it's collected (lib/three/renderer:
    // once nothing is compiling, so the wait for it lands on no one's frame)
    releaseContext(renderer);
  };

  // the room as it should look: photo materials and HDRI in, or given up on
  // after a few seconds (and painted instead), so it never shows half-dressed;
  // then its shaders, linked in the background, so the first frame doesn't
  // stop the page (lib/three/renderer's precompile)
  const whenReady = () => {
    const look = lookFor(place ?? 'rv');
    const wait = new Promise((r) => setTimeout(r, 6000));
    return Promise.race([Promise.all([look.ready, hdriFor(place ?? 'rv')]), wait]).then(() => {
      if (disposed || lost) return null;
      house.adopt(scene);
      return precompile(renderer, scene, camera);
    });
  };

  return { render, resize, dispose, project, standeeAnchors, diagnostics, whenReady, get lost() { return lost; } };
}
