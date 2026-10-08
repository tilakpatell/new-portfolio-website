// A lift car: one landing of a lift (layout.js makes each stop a room of
// its own, and a ride moves whoever is in the car from one to the next), so
// each car shows its own level on the readout over its door. Small and
// close: walls in narrow bays, a handrail round three sides, a light panel
// overhead, the call buttons on the wall beside the door.
//
//   levelOf(room, station) → the level number its name or section gives, or null
//   buildLift(kit, room, layout, { renderer }) → { group, lamps, dispose() }

import * as THREE from 'three';
import { detailCanvas, sharpen } from '../../../../../lib/three/textures';
import { roomWalls } from '../kit';
import { probeRoom } from '../probe';

export function levelOf(room, station) {
  const m = /level\s*(\d+)/i.exec(room.name ?? '') ?? /level\s*(\d+)/i.exec(station?.sections?.[room.section] ?? '');
  return m ? Number(m[1]) : null;
}

// The readout: the level in big amber figures between arrows, on black.
function paintReadout(level, kit) {
  const { canvas, ctx } = detailCanvas(128, 64, { level: kit.level, max: kit.small ? 128 : 256 });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(level === null ? '–' : String(level), 64, 35);
  ctx.fillStyle = '#ff6a3a';
  for (const [x, up] of [[16, true], [112, false]]) {
    ctx.beginPath();
    ctx.moveTo(x - 8, up ? 40 : 24);
    ctx.lineTo(x + 8, up ? 40 : 24);
    ctx.lineTo(x, up ? 24 : 40);
    ctx.fill();
  }
  return canvas;
}

export function buildLift(kit, room, layout, { renderer = null } = {}) {
  const parts = kit.shell(room, layout, { bay: 1, rib: 0.14, ribDepth: 0.08, kick: 0.25, band: 0.3, tall: 1.2, seed: room.id.length * 29 });
  const top = room.y + room.h;
  const [w, d] = [room.box.x1 - room.box.x0, room.box.z1 - room.box.z0];
  parts.push(kit.box(Math.min(2, w - 0.6), 0.06, Math.min(2, d - 0.6), room.x, top - 0.03, room.z, 'black'));
  parts.push(kit.plate(Math.min(1.8, w - 0.8), Math.min(1.8, d - 0.8), room.x, top - 0.065, room.z, 'strip', 'down'));
  const texture = sharpen(new THREE.CanvasTexture(paintReadout(levelOf(room, layout.station), kit)), { renderer, color: true });
  const readout = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: texture, name: 'ds-readout' });
  const runs = roomWalls(layout, room.id);
  const doorRun = runs.find((r) => r.holes.some((h) => h.door));
  for (const run of runs) {
    const local = [];
    const door = run.holes.find((h) => h.door);
    if (door) {
      // the readout over the door
      const c = (door.x0 + door.x1) / 2;
      const y = Math.min(door.y1 + 0.42, run.y1 - run.y0 - 0.18);
      local.push(kit.box(0.6, 0.32, 0.05, c, y, 0.025, 'trim'), { geo: new THREE.PlaneGeometry(0.5, 0.25).translate(c, y, 0.052), mat: readout });
    } else {
      // a handrail along every wall but the door’s
      local.push(kit.beam({ x: 0.3, y: 0.95, z: 0.09 }, { x: run.len - 0.3, y: 0.95, z: 0.09 }, 0.05, 0.05, 'rail'));
      for (const t of [0.4, run.len - 0.4]) local.push(kit.box(0.04, 0.04, 0.09, t, 0.95, 0.045, 'rail'));
    }
    // the buttons on the wall that leads to the door, by the door’s corner
    if (doorRun && Math.hypot(run.x1 - doorRun.x0, run.z1 - doorRun.z0) < 0.05) {
      const t = run.len - 0.45;
      local.push(kit.box(0.24, 0.46, 0.04, t, 1.3, 0.02, 'trim'), kit.plate(0.16, 0.34, t, 1.3, 0.042, 'console'), kit.box(0.05, 0.05, 0.02, t, 1.6, 0.04, 'red'));
    }
    parts.push(...kit.place(local, kit.at(run.x0, run.y0, run.z0, run.angle)));
  }
  const group = kit.merge(parts);
  group.name = room.id;
  const lamps = [{ x: room.x, y: top - 0.3, z: room.z, color: 0xe8efff, intensity: 14, distance: 5 }];
  const reflection = probeRoom(renderer, group, { x: room.x, y: room.y + 1.3, z: room.z }, { lamps });
  return {
    group,
    lamps,
    dispose() {
      reflection.dispose();
      kit.free(group);
      readout.dispose();
      texture.dispose();
      group.removeFromParent();
    },
  };
}
