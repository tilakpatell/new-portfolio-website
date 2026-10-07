// Contact shade, painted on: what ambient occlusion would do, for nothing.
// A soft dark pool under everything that stands on the floor (the desks,
// chairs, cabinets, copier, racks and cars, from the colliders the walk
// already has), and a darkening where every wall meets the floor and the
// ceiling, on both sides. Three instanced draws in all, on every tier, so
// the furniture sits on the carpet instead of floating over it.
//
// buildContactShade({ walls, ceiling, panes }) → { group, dispose() }

import * as THREE from 'three';
import { CEILING, COLLIDERS, LOT, SOLID, PANES, WAREHOUSE } from './layout';
import { sharpen } from '../../../lib/three/textures';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
// (the shade's strength is painted as grey on an opaque canvas and read as
// an alpha map: a canvas's own alpha doesn't survive the upload everywhere)
// a rounded box of shade, darkest in the middle, soft all round
function blobTex(round) {
  const S = 128;
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const u = Math.abs((i + 0.5) / S - 0.5) * 2;
      const v = Math.abs((j + 0.5) / S - 0.5) * 2;
      // distance out of the core, 0 inside it, 1 at the edge
      const d = round ? Math.hypot(u, v) : Math.pow(Math.pow(u, 6) + Math.pow(v, 6), 1 / 6);
      const k = Math.max(0, Math.min(1, (d - 0.35) / 0.65));
      const a = (1 - k * k * (3 - 2 * k)) * 255;
      const o = (j * S + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = a;
      img.data[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
// shade that fades away from an edge (the edge at v = 0)
function edgeTex() {
  const c = canvas(4, 64);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.25, '#737373');
  g.addColorStop(0.6, '#1f1f1f');
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const shadeMat = (alphaMap, opacity) =>
  new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

export function buildContactShade() {
  const group = new THREE.Group();
  group.name = 'contact-shade';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const flat = new THREE.Euler();

  // ── pools under what stands on the floor ──
  const plane = keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const boxes = [];
  const rounds = [];
  for (const c of COLLIDERS) {
    if (c.kind === 'circle') rounds.push(c);
    else if (c.kind === 'box') boxes.push(c);
  }
  // furniture on legs throws a lighter pool than a cabinet standing on its base
  const outdoors = (c) => c.x > LOT.x;
  const pools = (list, round) => {
    const mesh = new THREE.InstancedMesh(plane, keep(shadeMat(keep(blobTex(round)), 0.5)), list.length);
    const color = new THREE.Color();
    list.forEach((c, i) => {
      const grow = outdoors(c) ? 0.9 : c.low ? 0.32 : 0.24;
      const w = (round ? c.r * 2 : c.w) + grow;
      const d = (round ? c.r * 2 : c.d) + grow;
      p.set(c.x, 0.012, c.z);
      q.setFromEuler(flat.set(0, -(c.turn ?? 0), 0));
      s.set(w, 1, d);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
      // the strength, carried in the colour's red (the shader reads it below)
      const k = outdoors(c) ? 0.85 : c.low ? 0.7 : 1;
      mesh.setColorAt(i, color.setRGB(k, k, k));
    });
    mesh.material.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vColor.r;');
    };
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  };
  if (boxes.length) pools(boxes, false);
  if (rounds.length) pools(rounds, true);

  // ── where the walls meet the floor and the ceiling ──
  const strips = [];
  const T = 0.064; // half a wall's thickness, and a hair
  const runs = [
    ...SOLID.map((r) => ({ r, top: CEILING, office: true })),
    ...PANES.map((r) => ({ r, top: 0.86, office: true })),
    ...(() => {
      const { x, z, w, d } = WAREHOUSE;
      return [
        [x, z, x + w, z],
        [x, z + d, x + w, z + d],
        [x, z, x, z + d],
      ].map((r) => ({ r, top: 0, office: false }));
    })(),
  ];
  for (const { r, top, office } of runs) {
    const [x0, z0, x1, z1] = r;
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) continue;
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    const nx = -(z1 - z0) / len;
    const nz = (x1 - x0) / len;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (const side of [-1, 1]) {
      const ox = cx + nx * T * side;
      const oz = cz + nz * T * side;
      // on the floor, out from the wall's foot
      strips.push({ x: ox + nx * side * 0.17, y: 0.011, z: oz + nz * side * 0.17, len, h: 0.34, rotY: ang, lie: true, flip: side < 0 });
      // up the wall from the floor
      strips.push({ x: ox, y: 0.2, z: oz, len, h: 0.4, rotY: ang, face: side, lie: false, up: true });
      // down the wall from the ceiling
      if (office && top >= CEILING) strips.push({ x: ox, y: CEILING - 0.16, z: oz, len, h: 0.32, rotY: ang, face: side, lie: false, up: false });
    }
  }
  {
    const geo = keep(new THREE.PlaneGeometry(1, 1));
    const mesh = new THREE.InstancedMesh(geo, keep(shadeMat(keep(edgeTex()), 0.32)), strips.length);
    const e = new THREE.Euler();
    strips.forEach((st, i) => {
      // (a plane's dark edge is its bottom; it faces +z until turned)
      if (st.lie) e.set(-Math.PI / 2, st.rotY + (st.flip ? 0 : Math.PI), 0, 'YXZ'); // flat, the dark edge to the wall
      else e.set(0, st.rotY + (st.face > 0 ? 0 : Math.PI), st.up ? 0 : Math.PI, 'YXZ'); // on the wall, dark at the floor or the ceiling
      q.setFromEuler(e);
      mesh.setMatrixAt(i, m4.compose(p.set(st.x, st.y, st.z), q, s.set(st.len, st.h, 1)));
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    group.add(mesh);
  }

  return {
    group,
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}
