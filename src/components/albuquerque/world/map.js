import { CITY, COLLIDERS, CRYSTALS, ROADS } from './rules';

// The map in the corner, north up and round the car: the city's streets,
// blocks and buildings (drawn once, below), the places, the crystals, Hank,
// the traffic, the other drivers online (pale, out of any place) and you.
// Anything further off than it shows is drawn on its rim.
const VIEW = 150; // metres from the middle to the rim
const K = 74 / VIEW;
let base = null;
const BASE = { px: 1, half: 430 }; // pixels a metre, and where the middle of town is on it
function baseMap() {
  if (base) return base;
  const c = document.createElement('canvas');
  c.width = c.height = BASE.half * 2;
  const g = c.getContext('2d');
  const at = (x, z) => [BASE.half + x * BASE.px, BASE.half + z * BASE.px];
  // the blocks, a shade lighter than the desert
  g.fillStyle = 'rgba(233, 225, 208, 0.16)';
  for (const b of CITY.blocks) {
    const [x, y] = at(b.kerb.x0, b.kerb.z0);
    g.fillRect(x, y, (b.kerb.x1 - b.kerb.x0) * BASE.px, (b.kerb.z1 - b.kerb.z0) * BASE.px);
  }
  g.fillStyle = 'rgba(120, 170, 90, 0.45)';
  for (const l of CITY.lots) {
    if (l.surface !== 'grass') continue;
    const [x, y] = at(l.x - l.w / 2, l.z - l.d / 2);
    g.fillRect(x, y, l.w * BASE.px, l.d * BASE.px);
  }
  g.lineCap = 'butt';
  for (const r of ROADS) {
    g.strokeStyle = r.dirt ? '#b8946a' : '#e9e1d0';
    g.lineWidth = Math.max(2, r.w * BASE.px);
    g.beginPath();
    g.moveTo(...at(r.a.x, r.a.z));
    g.lineTo(...at(r.b.x, r.b.z));
    g.stroke();
  }
  g.fillStyle = 'rgba(40, 30, 20, 0.55)';
  for (const b of COLLIDERS) {
    if (b.kind === 'car') continue;
    const [x, y] = at(b.x - b.w / 2, b.z - b.d / 2);
    g.fillRect(x, y, Math.max(1, b.w * BASE.px), Math.max(1, b.d * BASE.px));
  }
  base = c;
  return c;
}
// `box`: the canvas fitted to the screen (runtime/hud fitCanvas, in 150
// units), or null before it is (its 150 × 150 attributes, drawn as they are)
export function drawMap(c, box, car, hank, prog, blue = [], run = null, others = [], traffic = []) {
  const g = c?.getContext('2d');
  if (!g) return;
  const s = box?.s ?? c.width / 150;
  g.setTransform(s, 0, 0, s, 0, 0);
  const at = (x, z) => [75 + (x - car.x) * K, 75 + (z - car.z) * K];
  // anything off the map's edge is drawn on its rim
  const rim = (x, z) => {
    const dx = x - car.x;
    const dz = z - car.z;
    const d = Math.hypot(dx, dz);
    const k = d > VIEW - 6 ? (VIEW - 6) / d : 1;
    return at(car.x + dx * k, car.z + dz * k);
  };
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 74, 0, Math.PI * 2);
  g.fillStyle = 'rgba(70, 52, 34, 0.62)';
  g.fill();
  g.clip();
  const b = baseMap();
  g.drawImage(b, BASE.half + (car.x - VIEW) * BASE.px, BASE.half + (car.z - VIEW) * BASE.px, VIEW * 2 * BASE.px, VIEW * 2 * BASE.px, 1, 1, 148, 148);
  // the traffic, small and grey
  g.fillStyle = 'rgba(200, 200, 195, 0.75)';
  for (const t of traffic) {
    if (t.route) continue;
    const [x, y] = at(t.x, t.z);
    if (x < 0 || y < 0 || x > 150 || y > 150) continue;
    g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
  g.restore();
  for (const p of prog.places) {
    const [x, y] = rim(p.door.x, p.door.z);
    g.fillStyle = p.open ? '#f0c330' : '#7c817e';
    g.beginPath();
    g.arc(x, y, p.id === prog.next ? 5 : 3.5, 0, Math.PI * 2);
    g.fill();
    if (p.id === prog.next) {
      g.strokeStyle = '#f0c330';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.fillStyle = '#5fd0ff';
  for (const k of CRYSTALS) {
    if (blue.includes(k.id)) continue;
    if (Math.hypot(k.x - car.x, k.z - car.z) > VIEW - 6) continue;
    const [x, y] = at(k.x, k.z);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const [hx, hy] = rim(hank.x, hank.z);
  g.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4a4a' : '#4a7bff';
  g.beginPath();
  g.arc(hx, hy, 3.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(190, 210, 255, 0.85)';
  for (const o of others ?? []) {
    if (o.inside) continue;
    const [ox, oy] = rim(o.x, o.z);
    g.beginPath();
    g.arc(ox, oy, 3, 0, Math.PI * 2);
    g.fill();
  }
  if (run) {
    const [dx, dy] = rim(run.x, run.z);
    g.fillStyle = '#58ff8a';
    g.strokeStyle = '#0c2a14';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(dx, dy, 4.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.save();
  g.translate(75, 75);
  g.rotate(-car.yaw + Math.PI);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
