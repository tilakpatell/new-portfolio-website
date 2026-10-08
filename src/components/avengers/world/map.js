import { BUILDINGS, LAWN_W, PACKS, PORTAL, RIVER_W, ROADS_W, ROAD_HALF, TOUR } from './rules';
import { stoneFor } from './labels';

// The map in the corner: the river, the lawn and its drives, the buildings,
// the doors (a stone over each one won back), the portal once it's open, the
// backpacks still to find near you, the swing tour's next ring, and you.
const MAP = { x0: -60, z0: -20, size: 300 };
const PACK_SHOWN = 42; // a backpack shows on the map this near (m)
export function drawMap(c, box, h, prog, others, found = [], tour = null) {
  const g = c?.getContext('2d');
  if (!g) return;
  // (`box`: runtime/hud's fitCanvas, at 150 units; none yet, the canvas's own 150 px)
  const sc = box?.s ?? 1;
  g.setTransform(sc, 0, 0, sc, 0, 0);
  const k = 150 / MAP.size;
  const at = (x, z) => [(x - MAP.x0) * k, (z - MAP.z0) * k];
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.closePath();
  };
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#2f4a2c'; // the woods
  g.fillRect(0, 0, 150, 150);
  g.fillStyle = '#3d6f7a';
  poly(RIVER_W);
  g.fill();
  g.fillStyle = '#7da35a';
  poly(LAWN_W);
  g.fill();
  g.strokeStyle = '#d9dbd2';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.2, ROAD_HALF * 2 * k);
  for (const r of ROADS_W) {
    g.beginPath();
    r.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.stroke();
  }
  g.fillStyle = '#f2f4f6';
  g.strokeStyle = 'rgba(20, 28, 36, 0.55)';
  g.lineWidth = 0.8;
  for (const b of BUILDINGS) {
    poly(b.foot);
    g.fill();
    g.stroke();
  }
  // the doors: a pulsing ring for the next, a dot for the rest, the stone's colour once won
  const pulse = 3.2 + Math.sin(performance.now() / 260) * 1.2;
  for (const p of prog.places) {
    const [x, y] = at(p.x, p.z);
    g.fillStyle = p.done ? stoneFor(p)?.color ?? p.accent : p.accent;
    g.beginPath();
    g.arc(x, y, p.done ? 3.4 : 2.8, 0, Math.PI * 2);
    g.fill();
    if (p.id === prog.next) {
      g.strokeStyle = p.accent;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, pulse + 2, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (prog.portal) {
    const [x, y] = at(PORTAL.x, PORTAL.z);
    g.strokeStyle = '#9fdcff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 4 + pulse * 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  // the swing tour: the next ring red (the first, faintly, before a tour), the rest of the course faint
  if (tour) {
    const next = tour.on ? tour.next : 0;
    g.strokeStyle = 'rgba(255, 90, 79, 0.45)';
    g.lineWidth = 1;
    g.beginPath();
    TOUR.forEach((r, i) => (i ? g.lineTo(...at(r.x, r.z)) : g.moveTo(...at(r.x, r.z))));
    if (tour.on) g.stroke();
    const r = TOUR[next];
    const [x, y] = at(r.x, r.z);
    g.fillStyle = tour.on ? '#ff5a4f' : 'rgba(255, 90, 79, 0.7)';
    g.beginPath();
    g.arc(x, y, tour.on ? 3 : 2.4, 0, Math.PI * 2);
    g.fill();
    if (tour.on) {
      g.strokeStyle = '#ff5a4f';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, pulse + 1.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // the backpacks still to find, once you're near one: a white dot, blinking
  if (Math.sin(performance.now() / 180) > -0.3) {
    g.fillStyle = '#ffffff';
    for (const p of PACKS) {
      if (found.includes(p.id) || Math.hypot(p.x - h.x, p.z - h.z) > PACK_SHOWN) continue;
      const [x, y] = at(p.x, p.z);
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the others online, pale
  if (others?.length) {
    g.fillStyle = 'rgba(190, 215, 255, 0.95)';
    for (const o of others) {
      if (o.inside) continue;
      const [x, y] = at(o.x, o.z);
      g.beginPath();
      g.arc(x, y, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  // you
  const [cx, cy] = at(h.x, h.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-h.face + Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1d2f5c';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(200, 220, 240, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.stroke();
}
