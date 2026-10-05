// The classroom at Harry Herpson High, for ../interiors.js, as the show's
// still has it: pale blue square floor tiles, cream walls over a grey dado,
// rows of chair-desks (pale wood tops, blue-grey seats), a "MATH! 2+2"
// poster and a corkboard on the front wall either side of the chalkboard
// ("Pop quiz today"), a round clock, a big world map on the back wall, a
// bookcase, a row of windows down one side, fluorescent panels in the
// ceiling, and the teacher behind his desk at the front.

import * as THREE from 'three';
import { AREAS, FURNITURE, LINKS, PEOPLE } from '../rules';
import { paint, rng } from '../kit';
import { BOX, CYL8, TAU, ceilings, doorAt, fitText, makeRoom, scribble, tiledPaint, wallLine, win, windowView } from './shell';
import { toonPerson } from './people';

const H = 2.9;
const CREAM = 0xf1e7c6;
const DADO = [1.0, 0x9aa1a8];
const TEACHER = { skin: 0x9a6a46, shirt: 0xf2d23c, pants: 0x5a4632, hair: 0x231a14, moustache: 0x231a14, sleeves: 'short', tie: 0x8a4a2a, shoes: 0x2a1e16 };

// The world, roughly, by longitude and latitude
const LANDS = [
  ['#f2d27a', [[-168, 66], [-160, 71], [-140, 70], [-125, 72], [-95, 74], [-80, 73], [-62, 66], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 26], [-97, 21], [-92, 18], [-87, 21], [-88, 15], [-83, 10], [-79, 8], [-82, 8], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 30], [-117, 32], [-124, 40], [-125, 48], [-133, 56], [-150, 60], [-158, 57], [-165, 62]]],
  ['#eef4f4', [[-45, 60], [-55, 65], [-60, 76], [-70, 78], [-55, 82], [-30, 83], [-20, 76], [-22, 70], [-40, 65]]],
  ['#9ccc65', [[-79, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-38, -14], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-74, -50], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 2]]],
  ['#f0a0a8', [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 53], [8, 57], [5, 62], [12, 66], [20, 70], [30, 71], [40, 67], [45, 60], [40, 50], [30, 46], [28, 41], [24, 38], [20, 40], [15, 38], [12, 44], [8, 44], [3, 43], [-2, 37]]],
  ['#f0a0a8', [[-5, 50], [1, 51], [0, 53], [-3, 56], [-5, 58], [-6, 55], [-3, 54], [-5, 52]]],
  ['#f2b36a', [[-17, 15], [-17, 21], [-13, 28], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -1], [40, -15], [35, -24], [27, -34], [18, -34], [12, -18], [13, -5], [9, 4], [-4, 5], [-12, 8]]],
  ['#f2b36a', [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]]],
  ['#c9a8e0', [[26, 40], [36, 36], [34, 28], [38, 20], [43, 13], [53, 17], [58, 23], [62, 25], [67, 24], [73, 20], [77, 8], [80, 15], [88, 22], [92, 21], [98, 16], [99, 8], [103, 1], [105, 10], [109, 12], [106, 20], [110, 21], [117, 23], [121, 30], [122, 37], [118, 39], [122, 41], [128, 35], [130, 42], [135, 44], [141, 52], [137, 55], [143, 59], [155, 59], [162, 62], [170, 60], [179, 65], [180, 69], [170, 70], [140, 72], [113, 74], [100, 78], [80, 73], [70, 73], [60, 69], [45, 68], [40, 67], [45, 60], [40, 50], [48, 45], [52, 42], [50, 37], [40, 40]]],
  ['#c9a8e0', [[130, 31], [135, 34], [140, 36], [142, 40], [141, 45], [144, 44], [141, 38], [139, 34], [133, 33]]],
  ['#c9a8e0', [[109, 1], [115, 5], [119, 5], [118, 0], [116, -4], [110, -3]]],
  ['#c9a8e0', [[95, 5], [100, 2], [106, -6], [101, -3]]],
  ['#e88a5a', [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [131, -31], [115, -34], [114, -26]]],
  ['#e88a5a', [[131, -1], [141, -3], [150, -10], [141, -9]]],
  ['#e88a5a', [[172, -34], [178, -38], [174, -41], [167, -46], [172, -41]]],
];

function paintMap(g, w, h) {
  g.fillStyle = '#6a4a2a';
  g.fillRect(0, 0, w, h);
  const x0 = 6;
  const y0 = 22;
  const mw = w - 12;
  const mh = h - 28;
  g.fillStyle = '#86c8ea';
  g.fillRect(x0, y0, mw, mh);
  const X = (lon) => x0 + ((lon + 180) / 360) * mw;
  const Y = (lat) => y0 + ((84 - lat) / 158) * mh;
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1;
  for (let lon = -150; lon < 180; lon += 30) {
    g.beginPath();
    g.moveTo(X(lon), y0);
    g.lineTo(X(lon), y0 + mh);
    g.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    g.beginPath();
    g.moveTo(x0, Y(lat));
    g.lineTo(x0 + mw, Y(lat));
    g.stroke();
  }
  for (const [colour, pts] of LANDS) {
    g.fillStyle = colour;
    g.strokeStyle = '#5a4a3a';
    g.lineWidth = 1.2;
    g.beginPath();
    pts.forEach(([lon, lat], i) => (i ? g.lineTo(X(lon), Y(lat)) : g.moveTo(X(lon), Y(lat))));
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Antarctica along the bottom
  g.fillStyle = '#f4f8f8';
  g.beginPath();
  g.moveTo(x0, y0 + mh);
  for (let lon = -180; lon <= 180; lon += 15) g.lineTo(X(lon), Y(-68 - Math.sin(lon * 0.05) * 3));
  g.lineTo(x0 + mw, y0 + mh);
  g.fill();
  fitText(g, 'THE WORLD', w / 2, 12, w * 0.5, 15, { color: '#f7f0d8' });
}

function paintCells(R) {
  R.cell('chalkboard', 640, 140, (g, w, h) => {
    g.fillStyle = '#2f4a3c';
    g.fillRect(0, 0, w, h);
    const r = rng(14);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 20 + r() * 50, 6 + r() * 12, r() * 3, 0, TAU);
      g.fill();
    }
    // (the left half: the teacher stands in front of the middle)
    g.save();
    g.translate(w * 0.235, h * 0.3);
    g.rotate(-0.03);
    fitText(g, 'Pop quiz', 0, 0, w * 0.4, 50, { font: 'Comic Sans MS, Chalkboard SE, Marker Felt, cursive', weight: '700', color: 'rgba(250,250,240,0.92)' });
    fitText(g, 'today', 0, h * 0.36, w * 0.3, 46, { font: 'Comic Sans MS, Chalkboard SE, Marker Felt, cursive', weight: '700', color: 'rgba(250,250,240,0.92)' });
    g.restore();
    g.strokeStyle = 'rgba(250,250,240,0.85)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.1, h * 0.86);
    g.quadraticCurveTo(w * 0.24, h * 0.9, w * 0.38, h * 0.84);
    g.stroke();
    fitText(g, '2 + 2 = 4', w * 0.84, h * 0.32, w * 0.24, 30, { font: 'Comic Sans MS, Chalkboard SE, cursive', weight: '700', color: 'rgba(250,250,240,0.85)' });
    fitText(g, 'x² + y² = r²', w * 0.84, h * 0.62, w * 0.26, 26, { font: 'Comic Sans MS, Chalkboard SE, cursive', weight: '700', color: 'rgba(255,240,170,0.8)' });
  });
  R.cell('flag', 96, 52, (g, w, h) => {
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#f7f4ea' : '#c8302a';
      g.fillRect(0, (i * h) / 13, w, h / 13 + 0.5);
    }
    g.fillStyle = '#2a3a7a';
    g.fillRect(0, 0, w * 0.42, h * 0.54);
    g.fillStyle = '#f7f4ea';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) g.fillRect(3 + x * 6.4, 3 + y * 5.4, 2, 2);
  });
  R.cell('math', 128, 160, (g, w, h) => {
    g.fillStyle = '#1a1210';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7d54a';
    g.fillRect(4, 4, w - 8, h - 8);
    fitText(g, 'MATH!', w / 2, h * 0.24, w - 16, 40, { color: '#d8302a' });
    fitText(g, '2+2', w / 2, h * 0.58, w - 20, 54, { color: '#2a5ab0' });
    g.fillStyle = '#d8302a';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(18 + i * 23, h * 0.85, 6, 0, TAU);
      g.fill();
    }
  });
  R.cell('notices', 192, 128, (g, w, h) => {
    g.fillStyle = '#6b4426';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4935e';
    g.fillRect(5, 5, w - 10, h - 10);
    const r = rng(4);
    const papers = [
      [14, 12, 50, 62, '#fff'],
      [72, 10, 46, 36, '#f7e27a'],
      [126, 14, 52, 46, '#bfe0f2'],
      [74, 54, 52, 60, '#fff'],
      [134, 68, 44, 44, '#f6c0d0'],
      [16, 80, 48, 38, '#d8f0c0'],
    ];
    for (const [x, y, pw, ph, c] of papers) {
      g.save();
      g.translate(x + pw / 2, y + ph / 2);
      g.rotate((r() - 0.5) * 0.12);
      g.fillStyle = c;
      g.fillRect(-pw / 2, -ph / 2, pw, ph);
      scribble(g, -pw / 2 + 5, -ph / 2 + 9, pw - 10, Math.floor(ph / 9), { seed: x + y });
      g.fillStyle = ['#d0201c', '#2a5ab0', '#3f8f3a'][Math.floor(r() * 3)];
      g.beginPath();
      g.arc(0, -ph / 2 + 3, 3, 0, TAU);
      g.fill();
      g.restore();
    }
  });
  R.cell('map', 448, 256, paintMap);
  R.cell('clock', 128, 128, (g, w, h) => {
    g.fillStyle = '#2b2b30';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbfaf4';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU);
    g.fill();
    g.strokeStyle = '#1a1210';
    g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.lineWidth = i % 3 ? 2 : 4;
      g.beginPath();
      g.moveTo(w / 2 + Math.sin(a) * 44, h / 2 - Math.cos(a) * 44);
      g.lineTo(w / 2 + Math.sin(a) * 52, h / 2 - Math.cos(a) * 52);
      g.stroke();
    }
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + Math.sin(TAU * 0.71) * 28, h / 2 - Math.cos(TAU * 0.71) * 28);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + Math.sin(TAU * 0.25) * 42, h / 2 - Math.cos(TAU * 0.25) * 42);
    g.stroke();
  });
  R.cell('art', 256, 96, (g, w, h) => {
    g.fillStyle = '#f4ecd8';
    g.fillRect(0, 0, w, h);
    const cs = ['#d8302a', '#2a5ab0', '#3f8f3a', '#f2b33a', '#9a5ab0'];
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 50;
      g.fillStyle = '#fff';
      g.fillRect(x, 10, 42, 56);
      g.fillStyle = cs[i];
      g.beginPath();
      g.arc(x + 21, 32, 12, 0, TAU);
      g.fill();
      g.fillRect(x + 8, 50, 26, 8);
    }
    fitText(g, 'OUR WORK', w / 2, h - 14, w * 0.5, 16, { color: '#2a5ab0' });
  });
  R.cell('doorglass', 32, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e8eef2');
    gr.addColorStop(1, '#b8c8d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  for (let i = 1; i <= 3; i++) R.cell(`view${i}`, 192, 128, windowView(i + 10, { house: false }));
}

// a chair-desk pair (one rules.js desk is two of them side by side): pale
// wood tops in front, blue-grey seats behind, tube frames
function chairDesks(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  for (const s of [-1, 1]) {
    const u = (s * w) / 4;
    // the desk top over the front, its rack under
    f.box(0xd9b98a, u, 0.72, d / 2 - 0.22, 0.62, 0.035, 0.42).box(0x6f7880, u, 0.5, d / 2 - 0.22, 0.56, 0.02, 0.36);
    // the seat behind it, its back
    f.box(0x7d8fa6, u, 0.42, -d / 2 + 0.2, 0.46, 0.05, 0.4).box(0x7d8fa6, u, 0.5, -d / 2 + 0.02, 0.44, 0.34, 0.04, 0, 0.1);
    // the frame: legs, the arm up to the desk
    for (const a of [-1, 1]) {
      f.box(0x9aa3ab, u + a * 0.2, 0, -d / 2 + 0.06, 0.025, 0.42, 0.025).box(0x9aa3ab, u + a * 0.2, 0, d / 2 - 0.08, 0.025, 0.72, 0.025);
      f.box(0x9aa3ab, u + a * 0.2, 0.02, 0, 0.025, 0.025, d - 0.12);
    }
    f.box(0x9aa3ab, u + 0.28, 0.42, 0.05, 0.025, 0.3, 0.025);
    // a book on two desks in three, a pencil by it
    const pick = Math.abs(Math.round(it.x * 3 + it.z * 2 + s)) % 3;
    if (pick) f.box([0xd8302a, 0x2a5ab0, 0x3f8f3a][Math.abs(Math.round(it.z + s)) % 3], u - 0.08, 0.755, d / 2 - 0.22, 0.2, 0.025, 0.26, 0.2 * s).box(0xf2c23c, u + 0.12, 0.755, d / 2 - 0.2, 0.012, 0.012, 0.16, 0.4);
  }
}

function teacherDesk(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  const wood = 0x8a5a34;
  f.box(0x9a6a3e, 0, h - 0.04, 0, w, 0.04, d);
  f.box(wood, 0, 0.02, d / 2 - 0.04, w - 0.04, h - 0.08, 0.03);
  for (const s of [-1, 1]) f.box(wood, s * (w / 2 - 0.3), 0, 0, 0.56, h - 0.04, d - 0.06);
  for (let i = 0; i < 3; i++) f.box(0x9a6a3e, w / 2 - 0.3, 0.08 + i * 0.22, -d / 2 + 0.02, 0.5, 0.19, 0.02).ball(0xd8b25a, w / 2 - 0.3, 0.17 + i * 0.22, -d / 2, 0.02);
  // an apple, papers, a mug of pencils, books and a globe
  f.ball(0xd8302a, -0.9, h + 0.045, 0.2, 0.045).cyl(0x5a3a20, -0.9, h + 0.08, 0.2, 0.004, 0.025);
  for (let i = 0; i < 4; i++) f.box(0xf7f4ea, 0.1 + i * 0.01, h + i * 0.012, 0.05, 0.3, 0.01, 0.4, 0.05 * i);
  f.cyl(0xf4f0e6, 0.75, h, -0.25, 0.045, 0.1);
  for (let i = 0; i < 3; i++) f.cyl([0xf2c23c, 0xd8302a, 0x2a5ab0][i], 0.74 + i * 0.015, h + 0.06, -0.25 + (i - 1) * 0.015, 0.006, 0.16, 0.1 * (i - 1), 0.1);
  for (let i = 0; i < 3; i++) f.box([0x3f8f3a, 0x2a5ab0, 0xd8302a][i], -0.5, h + i * 0.05, -0.2, 0.26, 0.048, 0.34, 0.1 * i);
  f.cyl(0x6b4426, 1.15, h, -0.2, 0.07, 0.03).cyl(0x6b4426, 1.15, h + 0.03, -0.2, 0.01, 0.12);
  f.ball(0x6ab0e0, 1.15, h + 0.26, -0.2, 0.13).ball(0x7ac74f, 1.19, h + 0.29, -0.13, 0.06, 0.8).ball(0x7ac74f, 1.09, h + 0.22, -0.11, 0.05);
  f.part(new THREE.TorusGeometry(0.15, 0.008, 6, 24, Math.PI), 0x9aa3ab, 1.15, h + 0.26, -0.2, Math.PI / 2, 1, 1, 1, 0, 0.4);
  // his chair, behind
  f.box(0x3a3d42, 0, 0, -d / 2 - 0.28, 0.46, 0.46, 0.44).box(0x3a3d42, 0, 0.46, -d / 2 - 0.48, 0.46, 0.5, 0.06);
}

function bookcase(R, x, z, turn, w = 1.6, h = 1.85, d = 0.34) {
  const f = R.frame(x, z, turn);
  const r = rng(7);
  const wood = 0x8a5a34;
  f.box(wood, 0, 0, -d / 2 + 0.01, w, h, 0.02);
  for (const s of [-1, 1]) f.box(wood, s * (w / 2 - 0.02), 0, 0, 0.04, h, d);
  const n = 5;
  for (let i = 0; i <= n; i++) f.box(wood, 0, i === n ? h - 0.03 : 0.04 + i * ((h - 0.08) / n), 0, w - 0.06, 0.03, d);
  const cs = [0xd8302a, 0x2a5ab0, 0x3f8f3a, 0xf2b33a, 0x7a4a9a, 0xe8e3d6, 0x2b2b30];
  for (let i = 0; i < n; i++) {
    const y0 = 0.07 + i * ((h - 0.08) / n);
    let u = -w / 2 + 0.06;
    while (u < w / 2 - 0.1) {
      const bw = 0.035 + r() * 0.04;
      f.box(cs[Math.floor(r() * cs.length)], u + bw / 2, y0, 0.01, bw, 0.2 + r() * 0.1, d - 0.08);
      u += bw + 0.005;
    }
  }
}

export async function buildSchoolRoom(kit) {
  const R = makeRoom(kit, 'school');
  const m = kit.mats;
  const a = AREAS.school;
  paintCells(R);
  const tiles = tiledPaint(m, 'c137-school-tiles', 256, 2.4, (g, w, h) => {
    const n = 4;
    const s = w / n;
    const r = rng(19);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const k = 0.95 + r() * 0.08;
        g.fillStyle = `rgb(${Math.round(170 * k)},${Math.round(204 * k)},${Math.round(224 * k)})`;
        g.fillRect(x * s, y * s, s, s);
      }
    g.strokeStyle = '#8fb2c8';
    g.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, h);
      g.moveTo(0, i * s);
      g.lineTo(w, i * s);
      g.stroke();
    }
  });
  R.tiled.add(BOX, tiles, new THREE.Matrix4().compose(new THREE.Vector3((a.x0 + a.x1) / 2, -0.05, (a.z0 + a.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(a.x1 - a.x0 + 0.4, 0.1, a.z1 - a.z0 + 0.4)));
  const ceilTiles = paint(kit.renderer, 128, 128, (g, w, h) => {
    g.fillStyle = '#ece9df';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.05)';
    const r = rng(2);
    for (let i = 0; i < 300; i++) g.fillRect(r() * w, r() * h, 1.5, 1.5);
    g.fillStyle = '#b9b6ac';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h / 2 - 1, w, 3);
    g.fillRect(0, 0, 3, h);
    g.fillRect(w / 2 - 1, 0, 3, h);
  });
  ceilings(R, [[a.x0 - 0.2, a.x1 + 0.2, a.z0 - 0.2, a.z1 + 0.2]], H, 0xdcdad2, R.own(ceilTiles), 1.2);

  // walls: cream over a grey dado
  const F = R.fixed;
  const wall = { color: CREAM, dado: DADO, skirt: 0x5a6066, h: H };
  wallLine(R, F, [a.x0 - 0.2, a.z0], [a.x1 + 0.2, a.z0], { ...wall, into: [0, 1] });
  wallLine(R, F, [a.x0, a.z0 - 0.2], [a.x0, a.z1 + 0.2], { ...wall, into: [1, 0] }, [196.6, 200.2, 203.8].map((z, i) => win(z, 2.6, 0.95, 1.6, `view${i + 1}`, { bars: [4, 3], frame: 0xe8e3d6 })));
  wallLine(R, F, [a.x1, a.z0 - 0.2], [a.x1, a.z1 + 0.2], { ...wall, into: [-1, 0] });
  const exit = LINKS.find((l) => l.id === 'school-exit');
  wallLine(R, F, [a.x0 - 0.2, a.z1], [a.x1 + 0.2, a.z1], { ...wall, into: [0, -1] }, [doorAt(exit.x, { w: 1.0, color: 0x9a6a3e, trim: 0x7d848a, glass: 'doorglass' })]);
  // the dado rail all round
  const rail = R.frame(0, 0, 0, { list: 'fixed' });
  rail.box(0x7d848a, (a.x0 + a.x1) / 2, DADO[0] - 0.02, a.z0 + 0.012, a.x1 - a.x0, 0.05, 0.025).box(0x7d848a, a.x0 + 0.012, DADO[0] - 0.02, (a.z0 + a.z1) / 2, 0.025, 0.05, a.z1 - a.z0);
  rail.box(0x7d848a, a.x1 - 0.012, DADO[0] - 0.02, (a.z0 + a.z1) / 2, 0.025, 0.05, a.z1 - a.z0);
  rail.box(0x7d848a, a.x0 + (exit.x - 0.6 - a.x0) / 2, DADO[0] - 0.02, a.z1 - 0.012, exit.x - 0.6 - a.x0, 0.05, 0.025).box(0x7d848a, (exit.x + 0.6 + a.x1) / 2, DADO[0] - 0.02, a.z1 - 0.012, a.x1 - exit.x - 0.6, 0.05, 0.025);

  // the front wall: the chalkboard, the poster, the corkboard, the clock
  const board = FURNITURE.find((f) => f.id === 'chalkboard');
  const fw = R.fixed(board.x, a.z0, 0);
  fw.box(0xb9c0c7, 0, 0.82, 0.03, board.w + 0.14, 1.4, 0.05).decal('chalkboard', 0, 1.52, 0.058, board.w, 1.3);
  fw.box(0xb9c0c7, 0, 0.8, 0.1, board.w, 0.04, 0.12);
  for (let i = 0; i < 4; i++) fw.cyl([0xf7f4ea, 0xf7f4ea, 0xf6c0d0, 0xf7e27a][i], -2.2 + i * 0.16, 0.84, 0.12, 0.008, 0.07, 0, Math.PI / 2, CYL8);
  fw.box(0x2b2b30, 2.0, 0.84, 0.1, 0.16, 0.04, 0.06).box(0xd8d4cb, 2.0, 0.84, 0.1, 0.16, 0.015, 0.065);
  fw.decal('math', -5.2, 1.65, 0.012, 0.8, 1.0);
  fw.decal('notices', 5.2, 1.6, 0.012, 1.5, 1.0);
  fw.cyl(0x2b2b30, 0, 2.5, 0.03, 0.22, 0.06, Math.PI / 2).decal('clock', 0, 2.5, 0.062, 0.4, 0.4);
  // a flag on a little pole by the board
  fw.box(0xd8b25a, -3.9, 2.02, 0.02, 0.08, 0.08, 0.04).cyl(0xd8b25a, -3.62, 2.12, 0.06, 0.01, 0.62, 0, -1.2).ball(0xd8b25a, -3.34, 2.23, 0.06, 0.022);
  fw.decal('flag', -3.6, 1.92, 0.065, 0.56, 0.31);
  // the back wall: the world map, the class's art
  const bw = R.fixed(a.x0, a.z1, Math.PI);
  bw.box(0x6a4a2a, -3.6, 0.92, 0.02, 3.3, 1.82, 0.03).decal('map', -3.6, 1.83, 0.037, 3.24, 1.76);
  bw.decal('art', -12.4, 1.75, 0.012, 2.4, 0.9);
  // a bookcase on the east wall, a second low one
  bookcase(R, a.x1 - 0.17, 198.6, -Math.PI / 2);
  bookcase(R, a.x1 - 0.17, 202.4, -Math.PI / 2, 1.4, 1.1);
  R.fixed(a.x1, 196.0, -Math.PI / 2).decal('notices', 0, 1.65, 0.012, 1.2, 0.8);
  // fluorescent panels in the ceiling
  const top = R.frame(0, 0, 0, { list: 'fixed' });
  for (const x of [-303.5, -296.5])
    for (const z of [197, 200.5, 204]) {
      top.box(0xd8dcd6, x, H - 0.03, z, 0.7, 0.03, 1.3);
      top.glow(BOX, 0xf4fbff, 1.9, x, H - 0.035, z, 0, 0.6, 0.02, 1.2);
    }

  // the furniture from the rules: the desks, his desk
  for (const it of FURNITURE.filter((f) => f.area === 'school')) {
    if (it.kind === 'school-desk') chairDesks(R, it);
    else if (it.kind === 'goldenfold-desk') teacherDesk(R, it);
  }

  // the teacher, behind his desk: yellow shirt, dark hair, a moustache
  const t = PEOPLE.find((p) => p.id === 'teacher');
  const fig = toonPerson(R, TEACHER, 1.95);
  fig.group.position.set(t.x, 0, t.z);
  fig.group.rotation.y = t.face + Math.PI / 2;
  R.group.add(fig.group);
  const turn0 = fig.group.rotation.y;
  R.tick((tt) => {
    fig.tick(tt);
    // looking round the class now and then
    fig.group.rotation.y = turn0 + Math.sin(tt * 0.35) * 0.35;
  });

  return R.build({ light: { sun: [0xffffff, 0.5], hemi: [0xf4f8ff, 0x8d9aa8, 2.0], fog: null, background: 0x101418 } });
}
