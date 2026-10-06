// Canvases for the office's printed and lit surfaces: what is on each
// monitor, the desk nameplates, the mug's lettering, Stanley's crossword and
// the Dunder Mifflin sign. Painted once, used as textures by the 3D office.

import { rng } from '../../lib/texture';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// What the monitors show, each 256×160 in a 1024×320 sheet (4 across, 2 down).
// Most show the branch's own desktop, the Dunder Mifflin Digital Hub, as on
// the set; a few are mid-task.
export const SCREENS = ['hub', 'sheet', 'hub', 'mail', 'hub', 'solitaire', 'beets', 'infinity'];

export function screens() {
  const c = canvas(1024, 320);
  const x = c.getContext('2d');
  const r = rng(5);
  SCREENS.forEach((kind, i) => {
    const ox = (i % 4) * 256;
    const oy = Math.floor(i / 4) * 160;
    x.save();
    x.translate(ox, oy);
    x.beginPath();
    x.rect(0, 0, 256, 160);
    x.clip();
    // the desktop and a window's title bar
    x.fillStyle = kind === 'solitaire' ? '#1f6b3a' : kind === 'hub' ? '#245edb' : '#e9edf2';
    x.fillRect(0, 0, 256, 160);
    if (kind === 'hub') {
      // as on every monitor on the set: the XP-blue desktop, a column of
      // icons, and the hub's white panel: "Intra-Office Digital Hub" on a
      // blue tab over the logo, and its menu of four with blue bullets
      const sky = x.createLinearGradient(0, 0, 0, 160);
      sky.addColorStop(0, '#2f63d0');
      sky.addColorStop(1, '#1b48b0');
      x.fillStyle = sky;
      x.fillRect(0, 0, 256, 160);
      for (let k = 0; k < 6; k++) {
        x.fillStyle = ['#f4f4f4', '#ffd75a', '#7fc4ff', '#f4f4f4', '#9be08a', '#f4f4f4'][k];
        x.fillRect(8, 6 + k * 23, 10, 9);
        x.fillStyle = 'rgba(255,255,255,0.75)';
        x.fillRect(5, 17 + k * 23, 16, 2);
      }
      x.fillStyle = '#fbfbfb';
      x.fillRect(46, 18, 178, 112);
      x.fillStyle = '#2a5bc4';
      x.fillRect(46, 24, 52, 40);
      x.fillStyle = '#fff';
      x.font = 'bold italic 10px Arial, sans-serif';
      x.fillText('Intra-Office', 49, 36);
      x.fillText('Digital', 49, 48);
      x.fillText('Hub', 49, 60);
      x.fillStyle = '#111';
      x.font = 'bold 21px Arial Black, Arial, sans-serif';
      x.fillText('DUNDER', 102, 42);
      x.fillText('MIFFLIN', 102, 63);
      x.save();
      x.translate(205, 36);
      x.rotate(Math.PI / 2);
      x.font = 'bold 9px Arial, sans-serif';
      x.fillText('INC.', 0, 0);
      x.restore();
      x.fillStyle = '#333';
      x.font = 'bold 6px Arial, sans-serif';
      x.fillText('P A P E R   C O M P A N Y', 112, 73);
      ['E-Mail', 'Business', 'Productivity', 'Reference'].forEach((l, k) => {
        x.strokeStyle = '#2a5bc4';
        x.lineWidth = 1.4;
        x.beginPath();
        x.arc(74, 84 + k * 11, 3.2, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = '#2a5bc4';
        x.font = 'bold 8px Arial, sans-serif';
        x.fillText(l, 82, 87 + k * 11);
      });
    } else if (kind !== 'solitaire') {
      x.fillStyle = '#2b4f8c';
      x.fillRect(0, 0, 256, 14);
      x.fillStyle = '#fff';
      x.font = 'bold 9px sans-serif';
      x.fillText({ sheet: 'Q3 Sales.xls', mail: 'Inbox (3)', infinity: 'Dunder Mifflin Infinity', beets: 'Schrute Farms: Beets.xls', crossword: 'Crossword', words: 'Memo.doc' }[kind], 6, 10);
    }
    x.fillStyle = kind === 'hub' ? '#2457c8' : '#c9ced6';
    x.fillRect(0, 148, 256, 12); // the taskbar
    x.fillStyle = '#3b7d3b';
    x.fillRect(2, 150, 26, 8);
    if (kind === 'sheet' || kind === 'beets') {
      x.strokeStyle = '#b8c0cc';
      x.lineWidth = 1;
      for (let gy = 26; gy < 148; gy += 10) {
        x.beginPath();
        x.moveTo(0, gy);
        x.lineTo(256, gy);
        x.stroke();
      }
      for (let gx = 30; gx < 256; gx += 44) {
        x.beginPath();
        x.moveTo(gx, 16);
        x.lineTo(gx, 148);
        x.stroke();
      }
      x.fillStyle = '#334';
      x.font = '7px monospace';
      for (let row = 0; row < 12; row++) for (let col = 0; col < 5; col++) x.fillText(kind === 'beets' && col === 0 ? ['Red', 'Gold', 'Chiogga', 'Bull’s Blood'][row % 4] : String(Math.floor(r() * 9000 + 100)), 34 + col * 44, 34 + row * 10);
      if (kind === 'beets') {
        x.fillStyle = '#8b1e3f';
        for (let k = 0; k < 6; k++) x.fillRect(150 + k * 14, 140 - (k + 2) * 9, 10, (k + 2) * 9);
      }
    } else if (kind === 'mail' || kind === 'words') {
      x.fillStyle = '#334';
      x.font = '8px sans-serif';
      const lines = kind === 'mail' ? ['Michael Scott: Conference room. 5 min.', 'Dwight Schrute: RE: RE: Desk perimeter', 'Angela Martin: Party Planning Committee', 'Toby Flenderson: Reminder: training'] : ['TO: All staff', 'FROM: Michael Scott', 'RE: Fun Run', '', 'Attendance is mandatory', 'and voluntary.'];
      lines.forEach((l, k) => {
        if (kind === 'mail') {
          x.fillStyle = k === 0 ? '#dfe8f6' : '#e9edf2';
          x.fillRect(4, 20 + k * 22, 248, 20);
          x.fillStyle = '#334';
        }
        x.fillText(l, 8, (kind === 'mail' ? 33 : 30) + k * (kind === 'mail' ? 22 : 13));
      });
    } else if (kind === 'infinity') {
      x.fillStyle = '#1f4e8c';
      x.font = 'bold 15px sans-serif';
      x.fillText('Dunder Mifflin', 60, 60);
      x.font = 'italic 12px sans-serif';
      x.fillText('Infinity', 104, 78);
      x.fillStyle = '#e04b2a';
      x.fillRect(80, 100, 96, 18);
      x.fillStyle = '#fff';
      x.font = 'bold 9px sans-serif';
      x.fillText('Order paper', 100, 112);
    } else if (kind === 'solitaire') {
      for (let k = 0; k < 7; k++)
        for (let d = 0; d <= k % 4; d++) {
          x.fillStyle = d === k % 4 ? '#fbfbf7' : '#2a50a0';
          x.fillRect(12 + k * 34, 40 + d * 10, 26, 36);
          if (d === k % 4) {
            x.fillStyle = k % 2 ? '#c0392b' : '#111';
            x.font = 'bold 9px sans-serif';
            x.fillText('A23456789'[k] || 'K', 15 + k * 34, 50 + d * 10);
          }
        }
    } else if (kind === 'crossword') {
      for (let gy = 0; gy < 9; gy++)
        for (let gx = 0; gx < 9; gx++) {
          x.fillStyle = (gx * 7 + gy * 3) % 5 === 0 ? '#222' : '#fff';
          x.fillRect(40 + gx * 13, 22 + gy * 13, 12, 12);
        }
    }
    x.restore();
  });
  return c;
}

// A brass-edged nameplate: name and title, centred.
export function nameplate(name, title, light = false) {
  // as on the set's desks: an engraved black insert, white letters (Michael's
  // in capitals, a title under them; Ryan's in a serif), or reception's grey
  const c = canvas(512, 96);
  const x = c.getContext('2d');
  x.fillStyle = light ? '#d9dad6' : '#141414';
  x.fillRect(0, 0, 512, 96);
  x.fillStyle = light ? '#1b1b1b' : '#f4f4f2';
  x.textAlign = 'center';
  const caps = name === name.toUpperCase();
  x.font = caps ? 'bold 40px Arial, sans-serif' : '44px Georgia, serif';
  x.fillText(name, 256, title ? 50 : 64, 480);
  if (title) {
    x.font = 'bold 18px Arial, sans-serif';
    x.fillText(title, 256, 80, 480);
  }
  return c;
}

// The mug: white china, black lettering, in a band all the way round.
export function mugBand() {
  const c = canvas(512, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f7f6f2';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#141414';
  x.textAlign = 'center';
  x.font = 'bold 54px Arial, sans-serif';
  x.fillText('WORLD’S', 128, 110);
  x.fillText('BEST BOSS', 128, 170);
  return c;
}

// The sign on the wall: the company's name in its own blue and black.
export function sign() {
  const c = canvas(1024, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f4f2ec';
  x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#121212';
  x.textAlign = 'center';
  x.font = 'bold 120px Arial, sans-serif';
  x.fillText('DUNDER', 360, 150);
  x.fillStyle = '#1f4e8c';
  x.fillText('MIFFLIN', 760, 150);
  x.fillStyle = '#121212';
  x.font = 'italic 34px Georgia, serif';
  x.fillText('The People Person’s Paper People', 512, 214);
  return c;
}

// A sheet of paper, crumpled: off-white with ruled lines and a printed letterhead.
export function paper() {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f5f4ef';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(70,110,180,0.35)';
  x.lineWidth = 1.5;
  for (let y = 30; y < 256; y += 14) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y);
    x.stroke();
  }
  x.fillStyle = 'rgba(31,78,140,0.7)';
  x.font = 'bold 18px Arial';
  x.fillText('Dunder Mifflin', 60, 22);
  return c;
}

// The reception counter's top: speckled grey-green laminate, as on the set.
export function speckle() {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  const r = rng(17);
  x.fillStyle = '#9aa494';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    x.fillStyle = v < 0.45 ? 'rgba(70,78,70,0.55)' : v < 0.8 ? 'rgba(200,206,194,0.6)' : 'rgba(40,44,40,0.7)';
    x.fillRect(r() * 256, r() * 256, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  return c;
}

// A ream box of Dunder Mifflin paper: white card, the logo in blue and black.
export function paperBox() {
  const c = canvas(512, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f1efe8';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#1f4e8c';
  x.fillRect(0, 196, 512, 24);
  x.fillStyle = '#111';
  x.textAlign = 'center';
  x.font = 'bold 54px Arial, sans-serif';
  x.fillText('DUNDER', 190, 110);
  x.fillStyle = '#1f4e8c';
  x.fillText('MIFFLIN', 360, 110);
  x.fillStyle = '#333';
  x.font = '22px Arial, sans-serif';
  x.fillText('Multipurpose Copy Paper  ·  8½ x 11  ·  5000 sheets', 256, 160);
  return c;
}
