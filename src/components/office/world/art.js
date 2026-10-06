// What's framed on the office's walls, painted on canvases: the motivational
// posters every office of the time had (black border, a photograph, one
// word in spaced capitals and a line under it), Michael's framed
// certificates, the building's directory board in the lobby and the
// kitchen's sign. Each returns a canvas; ./set.js frames and hangs them.

import { rng } from '../../../lib/texture';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// a motivational poster: `scene` paints the photograph in a 400×300 box
function poster(word, line, scene) {
  const c = canvas(512, 640);
  const x = c.getContext('2d');
  x.fillStyle = '#060606';
  x.fillRect(0, 0, 512, 640);
  x.save();
  x.translate(56, 70);
  x.beginPath();
  x.rect(0, 0, 400, 300);
  x.clip();
  scene(x);
  x.restore();
  x.strokeStyle = '#d8d4c8';
  x.lineWidth = 2;
  x.strokeRect(53, 67, 406, 306);
  x.fillStyle = '#f2efe6';
  x.textAlign = 'center';
  x.font = '52px Georgia, "Times New Roman", serif';
  const spaced = word.split('').join(String.fromCharCode(8202));
  x.fillText(spaced, 256, 452);
  x.font = 'italic 19px Georgia, serif';
  const words = line.split(' ');
  let row = '';
  let y = 500;
  for (const w of words) {
    if (x.measureText(`${row} ${w}`).width > 380) {
      x.fillText(row.trim(), 256, y);
      row = '';
      y += 26;
    }
    row += ` ${w}`;
  }
  x.fillText(row.trim(), 256, y);
  return c;
}

const sunset = (x, top, bottom) => {
  const g = x.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  x.fillStyle = g;
  x.fillRect(0, 0, 400, 300);
};

export function teamwork() {
  return poster('TEAMWORK', 'Coming together is a beginning. Keeping together is progress. Working together is success.', (x) => {
    sunset(x, '#f3b04a', '#b0462e');
    x.fillStyle = 'rgba(255,230,160,0.9)';
    x.beginPath();
    x.arc(250, 170, 46, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#3a2a2a';
    x.fillRect(0, 196, 400, 104);
    x.fillStyle = 'rgba(255,190,110,0.45)';
    for (let i = 0; i < 9; i++) x.fillRect(150 + Math.sin(i) * 60, 204 + i * 10, 200 - i * 14, 2);
    // the eight and their boat, in silhouette
    x.fillStyle = '#120c0c';
    x.beginPath();
    x.ellipse(200, 196, 150, 6, 0, 0, Math.PI * 2);
    x.fill();
    for (let i = 0; i < 8; i++) {
      const bx = 80 + i * 32;
      x.fillRect(bx, 176, 8, 18);
      x.beginPath();
      x.arc(bx + 4, 172, 6, 0, Math.PI * 2);
      x.fill();
      x.save();
      x.translate(bx + 4, 188);
      x.rotate(i % 2 ? 0.5 : 2.6);
      x.fillRect(0, -1.5, 70, 3);
      x.restore();
    }
  });
}

export function success() {
  return poster('SUCCESS', 'The road to success is always under construction.', (x) => {
    sunset(x, '#7fa7cf', '#e9eef2');
    const r = rng(3);
    x.fillStyle = '#5a6672';
    x.beginPath();
    x.moveTo(0, 300);
    x.lineTo(60, 170);
    x.lineTo(120, 220);
    x.lineTo(210, 60);
    x.lineTo(300, 200);
    x.lineTo(360, 150);
    x.lineTo(400, 210);
    x.lineTo(400, 300);
    x.fill();
    x.fillStyle = '#f4f6f8';
    x.beginPath();
    x.moveTo(170, 130);
    x.lineTo(210, 60);
    x.lineTo(250, 125);
    x.lineTo(230, 118);
    x.lineTo(212, 132);
    x.lineTo(195, 120);
    x.fill();
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`;
      x.fillRect(r() * 400, 230 + r() * 70, 30 + r() * 60, 2);
    }
    // a climber on the summit, arms up
    x.fillStyle = '#c0392b';
    x.fillRect(206, 44, 7, 14);
    x.fillStyle = '#1b1b1b';
    x.fillRect(206, 57, 3, 8);
    x.fillRect(210, 57, 3, 8);
    x.fillRect(203, 36, 2, 10);
    x.fillRect(214, 36, 2, 10);
    x.beginPath();
    x.arc(209.5, 40, 3.5, 0, Math.PI * 2);
    x.fill();
  });
}

export function persistence() {
  return poster('PERSISTENCE', 'The rock is not hollowed by the water’s force, but by its constant dripping.', (x) => {
    sunset(x, '#2f4a3a', '#6d8a6a');
    x.fillStyle = '#25302a';
    x.fillRect(0, 0, 140, 300);
    x.fillRect(260, 0, 140, 300);
    const g = x.createLinearGradient(140, 0, 260, 0);
    g.addColorStop(0, 'rgba(230,240,245,0.4)');
    g.addColorStop(0.5, 'rgba(250,252,255,0.95)');
    g.addColorStop(1, 'rgba(230,240,245,0.4)');
    x.fillStyle = g;
    x.fillRect(150, 0, 100, 250);
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.beginPath();
    x.ellipse(200, 260, 110, 28, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#3a5a6a';
    x.fillRect(0, 270, 400, 30);
  });
}

// Michael's framed certificates
export function certificate(title, lines) {
  const c = canvas(512, 400);
  const x = c.getContext('2d');
  x.fillStyle = '#f6f0dc';
  x.fillRect(0, 0, 512, 400);
  x.strokeStyle = '#b08a3a';
  x.lineWidth = 10;
  x.strokeRect(18, 18, 476, 364);
  x.lineWidth = 2;
  x.strokeRect(32, 32, 448, 336);
  x.fillStyle = '#2a2a2a';
  x.textAlign = 'center';
  x.font = 'bold 34px Georgia, serif';
  x.fillText(title, 256, 104);
  x.font = 'italic 22px Georgia, serif';
  lines.forEach((l, i) => x.fillText(l, 256, 168 + i * 34));
  x.fillStyle = '#b8322a';
  x.beginPath();
  x.arc(400, 300, 30, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#2a2a2a';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(90, 316);
  x.bezierCurveTo(130, 290, 170, 330, 230, 304);
  x.stroke();
  return c;
}

// the building's directory, by the lift
export function directory() {
  const c = canvas(400, 520);
  const x = c.getContext('2d');
  x.fillStyle = '#1e2124';
  x.fillRect(0, 0, 400, 520);
  x.fillStyle = '#e8e4d8';
  x.textAlign = 'center';
  x.font = 'bold 26px Arial, sans-serif';
  x.fillText('SCRANTON', 200, 52);
  x.fillText('BUSINESS PARK', 200, 84);
  x.font = '15px Arial, sans-serif';
  x.fillText('1725 Slough Avenue', 200, 110);
  x.fillStyle = '#7a7a72';
  x.fillRect(30, 128, 340, 2);
  const rows = [
    ['Dunder Mifflin Paper Co.', '200'],
    ['Vance Refrigeration', '210'],
    ['Disaster Kit Inc.', '220'],
    ['Cumberland Mills', '102'],
    ['Building Manager', '101'],
    ['Lackawanna Life Ins.', '230'],
  ];
  x.textAlign = 'left';
  x.font = '19px Arial, sans-serif';
  rows.forEach(([name, suite], i) => {
    x.fillStyle = '#e8e4d8';
    x.fillText(name, 34, 172 + i * 50);
    x.textAlign = 'right';
    x.fillText(suite, 366, 172 + i * 50);
    x.textAlign = 'left';
    x.fillStyle = '#3a3d40';
    x.fillRect(30, 186 + i * 50, 340, 1);
  });
  return c;
}

// the kitchen's sign, printed and taped up
export function kitchenSign() {
  const c = canvas(400, 300);
  const x = c.getContext('2d');
  x.fillStyle = '#fbfbf7';
  x.fillRect(0, 0, 400, 300);
  x.fillStyle = '#1b1b1b';
  x.textAlign = 'center';
  x.font = 'bold 34px Arial, sans-serif';
  x.fillText('PLEASE', 200, 70);
  x.fillText('CLEAN UP', 200, 112);
  x.fillText('AFTER YOURSELF', 200, 154);
  x.font = 'italic 20px "Comic Sans MS", cursive';
  x.fillText('Your mother doesn’t work here.', 200, 210);
  x.fillStyle = '#c0282e';
  x.font = 'bold 18px "Comic Sans MS", cursive';
  x.fillText('— Management (Angela)', 200, 256);
  x.fillStyle = 'rgba(230,220,170,0.7)';
  x.fillRect(-10, -6, 70, 26);
  x.fillRect(340, -6, 70, 26);
  return c;
}
