// The Smith house's pictures, for ./house.js and ./upstairs.js (drawn into
// each room's atlas, ./shell.js): the notes on the fridge, the back yard
// through the sliding door, the rugs, the checked tablecloth, the clock's
// face, Beth's horses and the dining room's sunflowers; Morty's space rug,
// posters, pennant, dartboard, map and the cracks in his plaster.

import { rng } from '../kit';
import { fitText, framed, scribble, TAU } from './shell';

const circle = (g, x, y, r, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
};
const ink = (g, w = 2) => {
  g.strokeStyle = '#1a1210';
  g.lineWidth = w;
  g.stroke();
};

// ── downstairs ──

export function houseCells(R) {
  // the fridge door: notes held up by magnets (clear round them, so the door shows)
  R.cell('fridgenotes', 128, 116, (g) => {
    g.clearRect(0, 0, 128, 116);
    const note = (x, y, w, h, c, rot = 0) => {
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(rot);
      g.fillStyle = c;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#1a1210';
      g.lineWidth = 1.5;
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.restore();
    };
    note(38, 4, 34, 34, '#cfe4ee', -0.04);
    note(78, 16, 38, 46, '#f3e6b8', 0.03);
    g.fillStyle = '#9fb0b8';
    g.fillRect(93, 10, 7, 12);
    note(66, 66, 24, 26, '#f3d58a', -0.02);
    note(42, 46, 16, 14, '#f3d58a', 0.05);
    scribble(g, 82, 26, 28, 4, { gap: 6, seed: 3 });
    // the magnets: little dark dashes and dots
    g.fillStyle = '#1d1d22';
    for (const [x, y, w, h] of [
      [8, 52, 10, 3],
      [21, 49, 12, 3],
      [36, 46, 4, 4],
      [44, 44, 3, 3],
      [26, 18, 4, 5],
      [34, 12, 3, 4],
      [50, 78, 10, 3],
      [62, 80, 9, 3],
      [14, 30, 5, 3],
    ])
      g.fillRect(x, y, w, h);
  });
  // the back yard through the sliding door: lawn, a tree, the fence, a roof next door, streaks on the glass
  R.cell('backyard', 256, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h * 0.6);
    gr.addColorStop(0, '#8fd0ec');
    gr.addColorStop(1, '#d6f0f8');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9c9a1';
    g.fillRect(w * 0.62, h * 0.36, w * 0.4, h * 0.2);
    g.fillStyle = '#7a4038';
    g.beginPath();
    g.moveTo(w * 0.58, h * 0.37);
    g.lineTo(w * 0.82, h * 0.24);
    g.lineTo(w * 1.05, h * 0.37);
    g.fill();
    g.fillStyle = '#8a6a48';
    g.fillRect(0, h * 0.5, w, h * 0.13);
    g.fillStyle = '#6e5236';
    for (let x = 0; x < w; x += 14) g.fillRect(x, h * 0.5, 2, h * 0.13);
    g.fillStyle = '#8fc45a';
    g.fillRect(0, h * 0.63, w, h * 0.37);
    g.fillStyle = '#7ab04a';
    for (let i = 0; i < 40; i++) g.fillRect((i * 53) % w, h * 0.66 + ((i * 29) % (h * 0.3)), 6, 2);
    // the tree
    g.fillStyle = '#6b4a2a';
    g.fillRect(w * 0.3, h * 0.28, 12, h * 0.4);
    circle(g, w * 0.32, h * 0.24, w * 0.16, '#3f8f3a');
    circle(g, w * 0.22, h * 0.3, w * 0.1, '#4a9a40');
    circle(g, w * 0.42, h * 0.3, w * 0.1, '#56a84a');
    // streaks on the glass
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 3;
    for (const [x, y, l] of [
      [0.12, 0.2, 0.18],
      [0.18, 0.34, 0.1],
      [0.66, 0.12, 0.2],
      [0.72, 0.28, 0.12],
    ]) {
      g.beginPath();
      g.moveTo(w * x, h * (y + l));
      g.lineTo(w * (x + l * 0.6), h * y);
      g.stroke();
    }
  });
  // the entry's rug: plain brick red, a darker border
  R.cell('rug', 128, 168, (g, w, h) => {
    g.fillStyle = '#c66a58';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a85444';
    g.lineWidth = 5;
    g.strokeRect(7, 7, w - 14, h - 14);
    const r = rng(2);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(120,30,20,0.18)' : 'rgba(255,200,170,0.12)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
  // the living room's rug: olive, tufted
  R.cell('livingrug', 192, 192, (g, w, h) => {
    g.fillStyle = '#b8aa5c';
    g.fillRect(0, 0, w, h);
    const r = rng(9);
    g.lineWidth = 1.5;
    for (let i = 0; i < 260; i++) {
      const x = r() * w;
      const y = r() * h;
      g.strokeStyle = r() < 0.6 ? 'rgba(80,80,20,0.45)' : 'rgba(230,230,140,0.4)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 5, y - 4);
      g.stroke();
    }
    g.strokeStyle = '#968a44';
    g.lineWidth = 4;
    g.strokeRect(2, 2, w - 4, h - 4);
  });
  // the tablecloth: yellow-green gingham, its checks the same size on the top and the sides
  const gingham = (cols, rows) => (g, w, h) => {
    g.fillStyle = '#c8c66e';
    g.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    g.fillStyle = 'rgba(240,242,150,0.55)';
    for (let i = 0; i < cols; i += 2) g.fillRect(i * cw, 0, cw, h);
    for (let j = 0; j < rows; j += 2) g.fillRect(0, j * rh, w, rh);
    g.fillStyle = 'rgba(150,150,40,0.35)';
    for (let i = 1; i < cols; i += 2) for (let j = 1; j < rows; j += 2) g.fillRect(i * cw, j * rh, cw, rh);
  };
  R.cell('cloth-top', 256, 128, gingham(14, 7));
  R.cell('cloth-side', 256, 32, gingham(14, 2));
  R.cell('cloth-end', 128, 64, gingham(7, 2));
  // the clock's face (round: clear outside it)
  R.cell('clockface', 96, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    circle(g, w / 2, h / 2, w / 2 - 1, '#c9a24a');
    circle(g, w / 2, h / 2, w / 2 - 6, '#f6f0dc');
    g.fillStyle = '#2a1a12';
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      g.fillRect(w / 2 + Math.sin(a) * 34 - 2, h / 2 - Math.cos(a) * 34 - 2, 4, 4);
    }
    g.strokeStyle = '#2a1a12';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + 14, h / 2 - 16);
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 - 4, h / 2 + 26);
    g.stroke();
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU);
    ink(g, 2);
  });
  // Beth's horses: a grid of little photos in one frame
  R.cell('horses', 192, 136, framed((g, w, h) => {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, w, h);
    const cols = 5;
    const rows = 3;
    const cw = w / cols;
    const rh = h / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const x = i * cw + 4;
        const y = j * rh + 4;
        g.fillStyle = (i + j) % 2 ? '#e8d6b0' : '#dcc8a0';
        g.fillRect(x, y, cw - 8, rh - 8);
        g.strokeStyle = '#6a5040';
        g.lineWidth = 1;
        g.strokeRect(x, y, cw - 8, rh - 8);
        horse(g, x + (cw - 8) / 2, y + (rh - 8) * 0.62, (cw - 8) / 34, (i * 3 + j) % 2 ? -1 : 1);
      }
  }, { border: '#7a5a42', inner: 6 }));
  // the dining room's sunflowers in a blue vase, and a boat at sea
  R.cell('sunflowers', 112, 136, framed((g, w, h) => {
    g.fillStyle = '#5a9a8a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9a86a';
    g.fillRect(0, h * 0.78, w, h * 0.22);
    g.fillStyle = '#7ab4d4';
    g.beginPath();
    g.moveTo(w * 0.38, h * 0.55);
    g.lineTo(w * 0.62, h * 0.55);
    g.lineTo(w * 0.66, h * 0.86);
    g.lineTo(w * 0.34, h * 0.86);
    g.fill();
    g.strokeStyle = '#3f7a3a';
    g.lineWidth = 2;
    const heads = [
      [0.3, 0.22],
      [0.52, 0.16],
      [0.72, 0.28],
      [0.42, 0.38],
      [0.64, 0.44],
    ];
    for (const [x, y] of heads) {
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.58);
      g.lineTo(w * x, h * y);
      g.stroke();
    }
    for (const [x, y] of heads) {
      g.fillStyle = '#f2c230';
      for (let k = 0; k < 10; k++) {
        const a = (k * TAU) / 10;
        g.beginPath();
        g.ellipse(w * x + Math.cos(a) * 7, h * y + Math.sin(a) * 7, 5, 2.5, a, 0, TAU);
        g.fill();
      }
      circle(g, w * x, h * y, 5, '#6a3a1a');
    }
  }, { border: '#8a5a34', inner: 7 }));
  R.cell('seascape', 136, 104, framed((g, w, h) => {
    g.fillStyle = '#a8d4e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a7aa8';
    g.fillRect(0, h * 0.6, w, h * 0.4);
    g.fillStyle = '#f4f0e6';
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.18);
    g.lineTo(w * 0.5, h * 0.55);
    g.lineTo(w * 0.7, h * 0.55);
    g.fill();
    g.fillStyle = '#8a4a2a';
    g.fillRect(w * 0.36, h * 0.56, w * 0.36, h * 0.07);
  }, { border: '#c9a24a', inner: 6 }));
  R.cell('mirror', 64, 112, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#e6f4f6');
    gr.addColorStop(1, '#a9c9d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(w * 0.2, 0, 6, h);
    g.fillRect(w * 0.35, 0, 3, h);
  }, { border: '#d8c49a', inner: 5 }));
}

// a running horse in silhouette at (x, y), s scale, facing dir
function horse(g, x, y, s, dir) {
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  g.fillStyle = '#5a3420';
  g.beginPath();
  g.ellipse(0, -6, 11, 5, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(8, -9);
  g.lineTo(15, -17);
  g.lineTo(19, -15);
  g.lineTo(11, -5);
  g.fill();
  g.lineWidth = 2.2;
  g.strokeStyle = '#5a3420';
  g.beginPath();
  for (const [a, b] of [
    [-8, -10],
    [-5, -2],
    [6, 10],
    [8, 3],
  ]) {
    g.moveTo(a, -3);
    g.lineTo(b, 7);
  }
  g.moveTo(-10, -8);
  g.lineTo(-16, -3);
  g.stroke();
  g.restore();
}

// ── Morty's room ──

export function mortyCells(R) {
  // the round space rug: a sun, planets and stars on dark blue
  R.cell('spacerug', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    circle(g, w / 2, h / 2, w / 2 - 2, '#9a8a6a');
    circle(g, w / 2, h / 2, w / 2 - 9, '#46505e');
    const r = rng(4);
    g.fillStyle = '#e8e6f0';
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU;
      const d = 20 + r() * 95;
      star(g, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 2 + r() * 4);
    }
    // the sun: a ragged corona, a tan face
    g.fillStyle = '#e8b47a';
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i * TAU) / 28;
      const rr = i % 2 ? 30 : 44;
      g.lineTo(w * 0.52 + Math.cos(a) * rr * 1.35, h * 0.52 + Math.sin(a) * rr);
    }
    g.fill();
    g.beginPath();
    g.ellipse(w * 0.52, h * 0.52, 34, 22, 0, 0, TAU);
    g.fillStyle = '#d8b06a';
    g.fill();
    ink(g, 2);
    // Saturn, a red planet, a blue one
    g.beginPath();
    g.ellipse(w * 0.24, h * 0.66, 16, 16, 0, 0, TAU);
    g.fillStyle = '#e8c070';
    g.fill();
    ink(g, 2);
    g.beginPath();
    g.ellipse(w * 0.24, h * 0.66, 30, 8, -0.4, 0, TAU);
    g.strokeStyle = '#9ab8e8';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.ellipse(w * 0.78, h * 0.3, 16, 9, 0, 0, TAU);
    g.fillStyle = '#c8402e';
    g.fill();
    ink(g, 2);
    circle(g, w * 0.72, h * 0.78, 9, '#5a9ad8');
    circle(g, w * 0.3, h * 0.24, 6, '#9ad87a');
  });
  // posters: a beach with palm trees, a magnet, a small one, a map
  R.cell('beach', 112, 140, poster((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h * 0.5);
    gr.addColorStop(0, '#6ac4ec');
    gr.addColorStop(1, '#c8ecf8');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    circle(g, w * 0.78, h * 0.18, 10, '#fff2a0');
    g.fillStyle = '#3a9ad0';
    g.fillRect(0, h * 0.48, w, h * 0.16);
    g.fillStyle = '#f2dca0';
    g.fillRect(0, h * 0.62, w, h * 0.38);
    for (const [x, lean] of [
      [0.3, -0.25],
      [0.66, 0.2],
    ]) {
      g.strokeStyle = '#8a5a34';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(w * x, h * 0.86);
      g.quadraticCurveTo(w * (x + lean * 0.2), h * 0.55, w * (x + lean * 0.4), h * 0.3);
      g.stroke();
      g.fillStyle = '#3f9a3a';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55;
        g.beginPath();
        g.ellipse(w * (x + lean * 0.4) + Math.cos(a) * 14, h * 0.3 + Math.sin(a) * 9 + 6, 16, 4, a, 0, TAU);
        g.fill();
      }
    }
  }, '#3a3a3e'));
  R.cell('magnet', 104, 132, poster((g, w, h) => {
    g.fillStyle = '#6cb89a';
    g.fillRect(0, 0, w, h);
    g.lineWidth = 18;
    g.strokeStyle = '#c8302e';
    g.beginPath();
    g.arc(w / 2, h * 0.48, 26, Math.PI, 0);
    g.lineTo(w / 2 + 26, h * 0.7);
    g.moveTo(w / 2 - 26, h * 0.48);
    g.lineTo(w / 2 - 26, h * 0.7);
    g.stroke();
    g.fillStyle = '#e8e6e0';
    g.fillRect(w / 2 - 35, h * 0.66, 18, 12);
    g.fillRect(w / 2 + 17, h * 0.66, 18, 12);
  }, '#2a2a2e'));
  R.cell('smallposter', 72, 96, poster((g, w, h) => {
    g.fillStyle = '#e8dcec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a4a98';
    g.fillRect(7, 7, w - 14, h - 14);
    circle(g, w / 2, h * 0.45, 16, '#c8c0d8');
    circle(g, w / 2 + 6, h * 0.4, 5, '#6a4a98');
    g.fillStyle = '#f4f0e6';
    for (let i = 0; i < 9; i++) g.fillRect(10 + ((i * 23) % (w - 20)), 10 + ((i * 37) % (h - 20)), 2, 2);
  }, '#3a3a3e'));
  R.cell('map', 136, 104, poster((g, w, h) => {
    g.fillStyle = '#d8ecf2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e6dc9a';
    for (const [x, y, rx, ry] of [
      [0.25, 0.35, 0.16, 0.18],
      [0.32, 0.72, 0.08, 0.16],
      [0.58, 0.32, 0.12, 0.12],
      [0.62, 0.62, 0.08, 0.16],
      [0.82, 0.38, 0.12, 0.16],
    ]) {
      g.beginPath();
      g.ellipse(w * x, h * y, w * rx, h * ry, 0.3, 0, TAU);
      g.fill();
    }
  }, '#2a2a2e'));
  // the pennant (a green triangle: clear round it)
  R.cell('pennant', 200, 72, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(2, 2);
    g.lineTo(w - 2, h * 0.5);
    g.lineTo(2, h - 2);
    g.closePath();
    g.fillStyle = '#3d8a3a';
    g.fill();
    ink(g, 2);
    g.fillStyle = '#f4f0e6';
    g.fillRect(2, 2, 14, h - 4);
    g.save();
    g.translate(w * 0.42, h * 0.5);
    g.scale(1, 0.8);
    fitText(g, 'SCIENCE', 0, 0, w * 0.55, 30, { color: '#f4f0e6' });
    g.restore();
  });
  // the dartboard (round: clear round it)
  R.cell('dartboard', 112, 112, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const c = w / 2;
    circle(g, c, c, c - 1, '#1d1d22');
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? '#f0e6c8' : '#2a2a2e';
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, c - 10, (i * TAU) / 20, ((i + 1) * TAU) / 20);
      g.fill();
    }
    g.strokeStyle = '#c8302e';
    g.lineWidth = 4;
    for (const r of [c - 12, c * 0.55]) {
      g.beginPath();
      g.arc(c, c, r, 0, TAU);
      g.stroke();
    }
    circle(g, c, c, 7, '#3a8a3a');
    circle(g, c, c, 3, '#c8302e');
  });
  // cracks and chips in the plaster (clear but for them)
  const crack = (seed) => (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(seed);
    // a chip where the plaster's come off
    g.beginPath();
    g.moveTo(w * 0.3, 0);
    for (let i = 0; i <= 8; i++) g.lineTo(w * (0.3 + i * 0.05), h * (0.25 + r() * 0.35));
    g.lineTo(w * 0.7, 0);
    g.closePath();
    g.fillStyle = '#d9d4ce';
    g.fill();
    ink(g, 2);
    g.strokeStyle = '#2a2420';
    g.lineWidth = 1.6;
    g.beginPath();
    let x = w * 0.5;
    let y = h * 0.5;
    g.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      x += (r() - 0.5) * 18;
      y += 6 + r() * 6;
      g.lineTo(x, y);
    }
    g.stroke();
  };
  R.cell('crack1', 96, 64, crack(3));
  R.cell('crack2', 96, 64, crack(8));
  R.cell('vent', 80, 40, (g, w, h) => {
    g.fillStyle = '#d6d2cc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5650';
    for (let x = 6; x < w - 4; x += 7) g.fillRect(x, 5, 3, h - 10);
    g.strokeStyle = '#2a2420';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  });
}

// a poster: an inked edge, a bit of tape at each top corner
function poster(draw, edge) {
  return (g, w, h) => {
    draw(g, w, h);
    g.strokeStyle = edge;
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = 'rgba(240,236,220,0.9)';
    g.fillRect(0, 0, 14, 8);
    g.fillRect(w - 14, 0, 14, 8);
  };
}
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.fill();
}
