// The list itself, in 3D: Dickansh_List.docx as it looks open in Word, three
// pages tall as a building, hung in the void beside the island with Word's
// blue title bar over them. Every line is one of the exhibits' (the sealed
// exhibits' `doc`): point at a line and it lights up; click it and the
// camera flies to its exhibit, or a line that's a link opens it.
//
// build({ doc }) → { group, pages, lineAt(hit), setHover(line), mark(exhibit), ready, dispose }
// (`mark`: the lines of one exhibit picked out on the page, as you visit it)
// `lineAt` takes a raycast hit on one of `pages` and gives the line under it
// ({ t, x: the exhibit's index, link?, h?: a heading }) or null.

import * as THREE from 'three';
import { sharpen } from '../../lib/three/textures';

const PAGE_W = 1240; // canvas px, A4
const PAGE_H = 1754;
const MARGIN_X = 130;
const TOP = 150;
const LINE = 30;
const PER_PAGE = Math.floor((PAGE_H - TOP - 120) / LINE);
const WORLD_W = 8.2; // metres
const WORLD_H = WORLD_W * (PAGE_H / PAGE_W);
const FONT = "Aptos, Calibri, Carlito, 'Segoe UI', Arial, sans-serif";

async function fonts() {
  try {
    await document.fonts?.ready;
  } catch {
    /* whatever's there will do */
  }
}

// one page: white, Word's margins, the lines as a bulleted list (the two
// headings bold, and the lists under them indented), the link blue and underlined
function drawPage(lines, first, n, pages, mark = -1, c = document.createElement('canvas')) {
  c.width = PAGE_W;
  c.height = PAGE_H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.textBaseline = 'middle';
  const rects = [];
  let under = false; // under one of the headings: indented
  for (let k = 0; k < first; k++) if (lines[k].h) under = true;
  for (let k = 0; k < n; k++) {
    const i = first + k;
    const line = lines[i];
    if (line.h) under = true;
    const y = TOP + k * LINE + LINE / 2;
    const x = MARGIN_X + (under && !line.h ? 56 : 0);
    if (line.x === mark) {
      // Word's yellow highlighter
      g.fillStyle = '#fff2a8';
      g.fillRect(x - 8, y - LINE / 2 + 2, PAGE_W - MARGIN_X - x + 16, LINE - 4);
    }
    g.fillStyle = '#1f1f1f';
    if (!line.h) {
      g.beginPath();
      g.arc(x + 10, y, 4.2, 0, Math.PI * 2);
      g.fill();
    }
    g.font = `${line.h ? 700 : 400} 23px ${FONT}`;
    const tx = x + (line.h ? 0 : 30);
    let text = line.t;
    const max = PAGE_W - MARGIN_X - tx;
    while (g.measureText(text).width > max && text.length > 4) text = `${text.slice(0, -2)}…`;
    if (line.link) {
      g.fillStyle = '#0563c1';
      g.fillText(text, tx, y);
      const w = g.measureText(text).width;
      g.fillRect(tx, y + 11, w, 1.6);
    } else g.fillText(text, tx, y);
    rects.push({ line: i, y0: y - LINE / 2, y1: y + LINE / 2, x0: tx - 34, x1: Math.min(PAGE_W - MARGIN_X, tx + g.measureText(text).width + 12) });
  }
  // the page number, at the foot
  g.fillStyle = '#6b6b6b';
  g.font = `400 17px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(`Page ${pages.i + 1} of ${pages.n}`, PAGE_W / 2, PAGE_H - 60);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex, { color: true });
  return { tex, rects, canvas: c };
}

// Word's title bar: blue, the W, the file's name
function titleBar(title) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#2b579a';
  g.fillRect(0, 0, 2048, 96);
  g.fillStyle = '#ffffff';
  g.fillRect(28, 18, 60, 60);
  g.fillStyle = '#2b579a';
  g.font = '800 46px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('W', 58, 50);
  g.fillStyle = '#ffffff';
  g.font = '500 40px Arial, sans-serif';
  g.fillText(`${title} - Word`, 1024, 50);
  g.textAlign = 'right';
  g.font = '400 40px Arial, sans-serif';
  g.fillText('—     ☐     ✕', 2010, 48);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex, { color: true });
  return tex;
}

export function build({ doc }) {
  const group = new THREE.Group();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const lines = doc?.lines ?? [];
  const n = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const pages = [];
  const highlights = [];
  const gap = 0.7;
  const span = n * WORLD_W + (n - 1) * gap;
  const paper = keep(new THREE.BoxGeometry(WORLD_W, WORLD_H, 0.06));
  const edge = keep(new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 }));
  const hlGeo = keep(new THREE.PlaneGeometry(1, 1));

  const ready = fonts().then(() => {
    for (let p = 0; p < n; p++) {
      const first = p * PER_PAGE;
      const count = Math.min(PER_PAGE, lines.length - first);
      const { tex, rects, canvas } = drawPage(lines, first, count, { i: p, n });
      keep(tex);
      const face = keep(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xf2f2f2 }));
      // the paper: the printed face to the front, plain stock round the edges and back
      const page = new THREE.Mesh(paper, [edge, edge, edge, edge, face, edge]);
      const x = -span / 2 + WORLD_W / 2 + p * (WORLD_W + gap);
      page.position.set(x, 0, Math.abs(x) * 0.18);
      page.rotation.y = -x * 0.022;
      page.userData.rects = rects;
      page.userData.paint = (mark) => {
        drawPage(lines, first, count, { i: p, n }, mark, canvas);
        tex.needsUpdate = true;
      };
      group.add(page);
      pages.push(page);
      const hl = new THREE.Mesh(hlGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })));
      hl.visible = false;
      hl.raycast = () => {}; // (the pointer reads the page under it)
      hl.position.z = 0.032;
      page.add(hl);
      highlights.push(hl);
    }
    const bar = new THREE.Mesh(keep(new THREE.PlaneGeometry(span + 0.6, (span + 0.6) * (96 / 2048))), keep(new THREE.MeshBasicMaterial({ map: keep(titleBar(doc?.title ?? 'Document.docx')), toneMapped: false })));
    bar.position.set(0, WORLD_H / 2 + 1.25, 0.3);
    group.add(bar);
  });

  let marked = -1;
  const toPx = (rect) => ({ cx: ((rect.x0 + rect.x1) / 2 / PAGE_W - 0.5) * WORLD_W, cy: (0.5 - (rect.y0 + rect.y1) / 2 / PAGE_H) * WORLD_H, w: ((rect.x1 - rect.x0) / PAGE_W) * WORLD_W, h: (LINE / PAGE_H) * WORLD_H });

  return {
    group,
    pages,
    ready,
    lineAt(hit) {
      // only the printed face: the back and the edges have no lines
      if (!hit?.uv || !hit.object?.userData.rects || hit.face?.materialIndex !== 4) return null;
      const px = hit.uv.x * PAGE_W;
      const py = (1 - hit.uv.y) * PAGE_H;
      const r = hit.object.userData.rects.find((q) => py >= q.y0 && py < q.y1 && px >= q.x0 - 40 && px <= PAGE_W - MARGIN_X + 20);
      return r ? { ...lines[r.line], i: r.line } : null;
    },
    // light up line `i` (a doc line's index), or none
    setHover(i) {
      pages.forEach((page, p) => {
        const hl = highlights[p];
        const r = page.userData.rects.find((q) => q.line === i);
        hl.visible = Boolean(r);
        if (!r) return;
        const b = toPx(r);
        hl.position.set(b.cx, b.cy, 0.032);
        hl.scale.set(b.w, b.h * 1.05, 1);
      });
    },
    mark(x) {
      if (x === marked) return;
      marked = x;
      for (const page of pages) page.userData.paint?.(x);
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
  };
}

export const DOC_SIZE = { w: WORLD_W, h: WORLD_H };
