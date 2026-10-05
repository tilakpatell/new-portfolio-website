// The map in the corner of a walkable town's HUD.

// The map in the corner: the town's own ground (`base(g, at)` draws it),
// where to go, and you. `scale` is pixels a metre on its 150 px disc.
export function drawMap(c, { scale, h, markers = [], night = false, base }) {
  const g = c?.getContext('2d');
  if (!g) return;
  const at = (x, z) => [75 + x * scale, 75 + z * scale];
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = night ? '#1e2418' : '#d8cca4';
  g.fillRect(0, 0, 150, 150);
  base?.(g, at);
  const pulse = 4 + Math.sin(performance.now() / 250) * 1.2;
  for (const m of markers) {
    const [x, y] = at(m.x, m.z);
    g.fillStyle = '#f0c040';
    g.beginPath();
    g.arc(x, y, 3.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(240, 192, 64, 0.8)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, pulse + 2, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  const [cx, cy] = at(h.x, h.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-h.face + Math.PI / 2);
  g.fillStyle = '#fff8e8';
  g.strokeStyle = '#2a1a0a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(60, 40, 20, 0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.stroke();
}
