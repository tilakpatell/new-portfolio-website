import { ISLES, TIDE } from './rules';

// The chart in the corner: north up, the islands, who's where, what's about
// to land, and the wind. `facing` is the way the camera looks.
export function drawChart(canvas, g, facing) {
  const c = canvas?.getContext('2d');
  if (!c) return;
  const W = canvas.width;
  const R = W / 2;
  const k = (R - 10) / TIDE.R;
  const X = (x) => R + x * k;
  const Y = (y) => R + y * k;
  c.clearRect(0, 0, W, W);
  c.save();
  c.beginPath();
  c.arc(R, R, R - 3, 0, Math.PI * 2);
  c.fillStyle = 'rgba(8, 20, 28, 0.62)';
  c.fill();
  c.clip();
  // the way you're looking: a faint fan
  c.fillStyle = 'rgba(255, 236, 190, 0.1)';
  c.beginPath();
  c.moveTo(X(g.p.x), Y(g.p.y));
  c.arc(X(g.p.x), Y(g.p.y), R * 0.7, facing - 0.5, facing + 0.5);
  c.fill();
  for (const i of ISLES) {
    c.beginPath();
    c.arc(X(i.x), Y(i.y), Math.max(3, i.r * k), 0, Math.PI * 2);
    c.fillStyle = i.kind === 'fort' && g.fort?.hp > 0 ? '#d9584a' : '#cdb98a';
    c.fill();
  }
  for (const z of g.zones) {
    c.beginPath();
    c.arc(X(z.x), Y(z.y), Math.max(2.5, z.r * k), 0, Math.PI * 2);
    c.strokeStyle = z.kind === 'bubble' ? 'rgba(190, 240, 255, 0.9)' : 'rgba(255, 90, 70, 0.95)';
    c.lineWidth = 2;
    c.stroke();
  }
  const blink = 0.6 + 0.4 * Math.sin(g.t * 6);
  for (const p of g.pickups) {
    c.beginPath();
    c.arc(X(p.x), Y(p.y), p.quest ? 5 : 3, 0, Math.PI * 2);
    c.fillStyle = p.kind === 'rum' ? '#7be3a5' : `rgba(255, 207, 92, ${p.quest ? blink : 0.9})`;
    c.fill();
  }
  const ship = (s, colour, size) => {
    c.save();
    c.translate(X(s.x), Y(s.y));
    c.rotate(s.a);
    c.beginPath();
    c.moveTo(size, 0);
    c.lineTo(-size * 0.8, size * 0.62);
    c.lineTo(-size * 0.45, 0);
    c.lineTo(-size * 0.8, -size * 0.62);
    c.closePath();
    c.fillStyle = colour;
    c.fill();
    c.restore();
  };
  for (const s of g.ships) if (!s.sunk && s.under < 0.5) ship(s, s.kind === 'ghost' ? '#7dffb0' : '#ff6a55', s.kind === 'sloop' ? 6.5 : 8.5);
  for (const a of g.arms) {
    c.beginPath();
    c.arc(X(a.x), Y(a.y), 3.5, 0, Math.PI * 2);
    c.fillStyle = '#d06ad0';
    c.fill();
  }
  if (g.kraken && g.kraken.up > 0.3) {
    c.beginPath();
    c.arc(X(g.kraken.x), Y(g.kraken.y), 8, 0, Math.PI * 2);
    c.fillStyle = '#d06ad0';
    c.fill();
  }
  ship(g.p, '#ffffff', 9.5);
  c.restore();
  // the rim, and the wind blowing across it
  c.beginPath();
  c.arc(R, R, R - 3, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(226, 196, 130, 0.8)';
  c.lineWidth = 3;
  c.stroke();
  c.save();
  c.translate(R + Math.cos(g.wind.a + Math.PI) * (R - 16), R + Math.sin(g.wind.a + Math.PI) * (R - 16));
  c.rotate(g.wind.a);
  c.beginPath();
  c.moveTo(12, 0);
  c.lineTo(-7, 6);
  c.lineTo(-3, 0);
  c.lineTo(-7, -6);
  c.closePath();
  c.fillStyle = '#9fd6ff';
  c.fill();
  c.restore();
}
