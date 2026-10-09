// The radar's picture (FlightCluster.jsx's canvas): rings at a half and the
// whole range, a wedge for what's ahead, the ship in the middle, and a dot
// per contact (radar.js placed them): red for hostiles (bigger when they're
// on you), green allies, gold the way to go, cyan a pickup, the lock in a
// white ring; a tick above or below a dot for a contact over or under you;
// the range in the lower part, between the rings (the canvas is clipped to
// its round border, which took a corner's number).
const INK = { hostile: '#ff5a4a', threat: '#ff3b2f', ally: '#6dff9a', goal: '#ffd36a', pickup: '#6fe7ff' };

export function drawRadar(canvas, points, { range, dpr = 1 } = {}) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.clientWidth || 132;
  const px = Math.round(size * dpr);
  if (canvas.width !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const c = size / 2;
  const r = c - 6;
  g.strokeStyle = 'rgba(127,214,255,0.28)';
  g.lineWidth = 1;
  for (const k of [0.5, 1]) {
    g.beginPath();
    g.arc(c, c, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(127,214,255,0.08)';
  g.beginPath();
  g.moveTo(c, c);
  g.arc(c, c, r, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8f4ff';
  g.beginPath();
  g.moveTo(c, c - 5);
  g.lineTo(c - 3.5, c + 4);
  g.lineTo(c + 3.5, c + 4);
  g.closePath();
  g.fill();
  for (const p of points) {
    const x = c + p.x * r;
    const y = c - p.y * r;
    const big = p.kind === 'threat' ? 3.6 : 2.6;
    g.fillStyle = INK[p.kind] ?? '#fff';
    g.globalAlpha = p.rim ? 0.6 : 1;
    g.beginPath();
    g.arc(x, y, big, 0, Math.PI * 2);
    g.fill();
    if (p.up) g.fillRect(x - 0.75, p.up > 0 ? y - big - 5 : y + big, 1.5, 5);
    if (p.lock) {
      g.globalAlpha = 1;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, big + 3.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(217,243,255,0.9)';
  // (12 px: nothing a player reads is under 0.7 rem)
  g.font = `600 12px ${getComputedStyle(canvas).fontFamily || 'monospace'}`;
  g.textAlign = 'center';
  g.fillText(String(range), c, c + r * 0.75 + 4);
}
