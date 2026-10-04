// Ricochet's own models: Captain America's shield, and the room's walls.

import * as THREE from 'three';
import { pbr } from '../hq/assets';
import { canvasTexture, rbox } from '../hq/kit/shapes';

// The shield's face: red, silver-white, red, then the blue disc and its star.
function shieldFace() {
  return canvasTexture(1024, 1024, (x, w) => {
    const c = w / 2;
    const ring = (r, color) => {
      x.fillStyle = color;
      x.beginPath();
      x.arc(c, c, r * c, 0, Math.PI * 2);
      x.fill();
    };
    ring(1, '#a3161c');
    ring(0.8, '#e9e7e2');
    ring(0.6, '#a3161c');
    ring(0.4, '#1d3f8f');
    x.fillStyle = '#f2f0ea';
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = (i % 2 ? 0.15 : 0.38) * c;
      if (i) x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      else x.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    // thin dark lines where the rings meet
    x.strokeStyle = 'rgba(30,20,20,0.35)';
    x.lineWidth = 3;
    for (const r of [0.8, 0.6, 0.4]) {
      x.beginPath();
      x.arc(c, c, r * c, 0, Math.PI * 2);
      x.stroke();
    }
  });
}

// The shield, facing +z, `radius` across. A slightly domed face, a rolled
// silver rim, leather straps behind.
export async function buildShield({ radius = 0.45, small = false } = {}) {
  const group = new THREE.Group();
  const face = new THREE.LatheGeometry(
    Array.from({ length: 13 }, (_, i) => {
      const r = (i / 12) * radius;
      return new THREE.Vector2(r, Math.cos((r / radius) * Math.PI * 0.5) * radius * 0.13);
    }),
    64,
  ).rotateX(Math.PI / 2);
  // flat (planar) texture coordinates, so the rings sit true
  const pos = face.attributes.position;
  const uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * radius) + 0.5, pos.getY(i) / (2 * radius) + 0.5);
  face.computeVertexNormals();
  const paint = await pbr('painted-metal', { repeat: [1.5, 1.5], small, physical: true, metalness: 0.55, roughness: 0.9, clearcoat: 0.6, clearcoatRoughness: 0.25, normalScale: 0.6 });
  paint.map = shieldFace();
  paint.color = new THREE.Color(1, 1, 1);
  const front = new THREE.Mesh(face, paint);
  front.name = 'face';
  group.add(front);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.035, 10, 64), new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.25 }));
  group.add(rim);
  const back = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ color: 0x8c9198, metalness: 0.9, roughness: 0.45, side: THREE.BackSide }));
  back.position.z = -0.002;
  group.add(back);
  const leather = await pbr('leather', { small, roughness: 1, metalness: 0, color: 0x7a5232 });
  for (const y of [-0.08, 0.08]) {
    const strap = new THREE.Mesh(rbox(radius * 1.1, 0.045, 0.02, 0.008), leather);
    strap.position.set(0, y, -0.03);
    group.add(strap);
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return group;
}

// A painted stencil on a wall, or the court's lines on the floor.
export function courtTexture() {
  return canvasTexture(1600, 1200, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const m = w / 16; // pixels per metre; the court is 16 m by 12 m
    x.strokeStyle = 'rgba(28,48,92,0.8)';
    x.lineWidth = 0.07 * m;
    x.strokeRect(0.35 * m, 0.35 * m, w - 0.7 * m, h - 0.7 * m);
    x.beginPath();
    x.moveTo(0.35 * m, h / 2);
    x.lineTo(w - 0.35 * m, h / 2);
    x.stroke();
    x.beginPath();
    x.arc(w / 2, h / 2, 1.8 * m, 0, Math.PI * 2);
    x.stroke();
    // Cap's mark, where he stands
    x.strokeStyle = 'rgba(190,30,36,0.9)';
    x.beginPath();
    x.arc(w / 2, (6 + 4.6) * m, 0.75 * m, 0, Math.PI * 2);
    x.stroke();
  });
}

export const hazardTexture = () =>
  canvasTexture(256, 32, (x, w, h) => {
    x.fillStyle = '#1b1b1d';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#e8b623';
    for (let i = -32; i < w + 32; i += 32) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 16, 0);
      x.lineTo(i + 16 + h, h);
      x.lineTo(i + h, h);
      x.fill();
    }
  });
