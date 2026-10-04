// A figure on a new atlas, for the scripts that make the site's people with
// Meshy (scripts/meshy.mjs: the Scranton office's; scripts/meshy-albuquerque.mjs:
// Albuquerque's).
//
// Meshy cuts a figure's surface into a thousand islands of a few triangles
// each, packed edge to edge, and splits the vertices along every cut, their
// normals with them: twice the vertices the surface needs, a facet at every
// island, and no room for a mipmap (a mip level mixes each island's rim with
// its neighbour's colour: light seams on a dark suit). `reatlas` welds the
// vertices, cuts the surface again into a few large charts with a gutter
// round each, and paints the texture again in the new layout.

import sharp from 'sharp';
import * as watlas from 'watlas';

// How far a part of a chart may be scaled, laid flat, from the chart as a
// whole (all but the 3% of it most shrunk and the 3% most stretched).
const STRETCH = [0.75, 1.4];
// The head's texels to the body's, a metre: the faces are what is looked at
// (Meshy's own atlas gives a head about as many).
const HEAD = 1.6;

// The triangle across each edge of each triangle (`face`: their corners,
// three each), or -1 where the surface ends or more than two meet.
function neighbours(face, points) {
  const across = new Int32Array(face.length).fill(-1);
  const edges = new Map();
  for (let h = 0; h < face.length; h++) {
    const a = face[h];
    const b = face[h - (h % 3) + ((h + 1) % 3)];
    const k = a < b ? a * points + b : b * points + a;
    if (edges.has(k)) edges.get(k).push(h);
    else edges.set(k, [h]);
  }
  for (const [g, h, more] of edges.values()) {
    // (a pair run opposite ways along their edge)
    if (h === undefined || more !== undefined || face[g] === face[h]) continue;
    across[g] = Math.floor(h / 3);
    across[h] = Math.floor(g / 3);
  }
  return across;
}

// Lays charts of a surface flat (P: its points; face: its triangles; across:
// their neighbours). A chart is a list of triangles; the answer is { points,
// u, v }: the points it uses and where each lies, in the surface's own units;
// or null if, flat, the chart folds over, crosses itself or is stretched. The
// map is least-squares conformal (Lévy et al., 2002): every triangle keeps
// its shape as nearly as all can at once, with two far points pinned, solved
// by conjugate gradients.
function flattener(P, face, across) {
  const inside = new Int32Array(face.length / 3); // the chart each triangle was last in
  let chart = 0;
  return (list) => {
    const m = list.length;
    const own = new Map();
    const points = [];
    const tri = new Int32Array(m * 3);
    for (let i = 0; i < m * 3; i++) {
      const p = face[list[Math.floor(i / 3)] * 3 + (i % 3)];
      if (!own.has(p)) own.set(p, points.push(p) - 1);
      tri[i] = own.get(p);
    }
    const n = points.length;
    // each triangle in its own plane: a corner at the origin, the next along x
    const shape = new Float64Array(m * 3); // (how far along, then the third corner's x and y)
    const size = new Float64Array(m);
    let area = 0;
    for (let i = 0; i < m; i++) {
      const [a, b, c] = [points[tri[i * 3]] * 3, points[tri[i * 3 + 1]] * 3, points[tri[i * 3 + 2]] * 3];
      const e = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
      const f = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const l = Math.hypot(...e);
      const x = l > 1e-12 ? (e[0] * f[0] + e[1] * f[1] + e[2] * f[2]) / l : 0;
      const y = Math.sqrt(Math.max(0, f[0] * f[0] + f[1] * f[1] + f[2] * f[2] - x * x));
      shape.set([l, x, y], i * 3);
      size[i] = (l * y) / 2;
      area += size[i];
    }
    const at = new Float64Array(n * 2); // where each point lies: the u's, then the v's
    if (m === 1) {
      at.set([shape[0], shape[1]], 1);
      at[5] = shape[2];
      return { points, u: at.subarray(0, 3), v: at.subarray(3) };
    }
    // Of each triangle the map wants this sum to be nothing: its corners'
    // places (as complex numbers), each times the side facing it. `wr`, `wi`:
    // those sides, over the root of the triangle's area (a sliver counts as
    // a twentieth of the average, not less).
    const least = (area / m) * 0.05;
    const wr = new Float64Array(m * 3);
    const wi = new Float64Array(m * 3);
    for (let i = 0; i < m; i++) {
      const [l, x, y] = shape.subarray(i * 3, i * 3 + 3);
      const s = size[i] > 1e-14 ? 1 / Math.sqrt(Math.max(size[i], least)) : 0;
      wr.set([(x - l) * s, -x * s, l * s], i * 3);
      wi.set([y * s, -y * s, 0], i * 3);
    }
    // two points pinned, as far apart as any
    const far = (from) => {
      let best = 0;
      let reach = -1;
      for (let p = 0; p < n; p++) {
        const d = Math.hypot(P[points[p] * 3] - P[points[from] * 3], P[points[p] * 3 + 1] - P[points[from] * 3 + 1], P[points[p] * 3 + 2] - P[points[from] * 3 + 2]);
        if (d > reach) [best, reach] = [p, d];
      }
      return [best, reach];
    };
    const [pin] = far(0);
    const [other, reach] = far(pin);
    at[other] = reach;
    // (the sums' squares are least where `times` gives nothing for the free points)
    const times = (x, y) => {
      y.fill(0);
      for (let i = 0; i < m * 3; i += 3) {
        let re = 0;
        let im = 0;
        for (let k = i; k < i + 3; k++) {
          re += wr[k] * x[tri[k]] - wi[k] * x[tri[k] + n];
          im += wr[k] * x[tri[k] + n] + wi[k] * x[tri[k]];
        }
        for (let k = i; k < i + 3; k++) {
          y[tri[k]] += wr[k] * re + wi[k] * im;
          y[tri[k] + n] += wr[k] * im - wi[k] * re;
        }
      }
      for (const p of [pin, other]) y[p] = y[p + n] = 0;
    };
    const weight = new Float64Array(n * 2); // (each point's own share of it, to scale the steps by)
    for (let k = 0; k < m * 3; k++) weight[tri[k]] += wr[k] * wr[k] + wi[k] * wi[k];
    for (let p = 0; p < n; p++) weight[p + n] = weight[p] ||= 1;
    const left = new Float64Array(n * 2);
    const way = new Float64Array(n * 2);
    const turn = new Float64Array(n * 2);
    times(at, left);
    let first = 0;
    let drop = 0;
    for (let p = 0; p < n * 2; p++) {
      left[p] = -left[p];
      way[p] = left[p] / weight[p];
      first += left[p] * left[p];
      drop += left[p] * way[p];
    }
    for (let step = 0; step < n * 4 + 200 && first > 0; step++) {
      times(way, turn);
      let slope = 0;
      for (let p = 0; p < n * 2; p++) slope += way[p] * turn[p];
      if (!(slope > 0)) break;
      let now = 0;
      let next = 0;
      for (let p = 0; p < n * 2; p++) {
        at[p] += (drop / slope) * way[p];
        left[p] -= (drop / slope) * turn[p];
        now += left[p] * left[p];
        next += (left[p] * left[p]) / weight[p];
      }
      if (now < first * 1e-10) break;
      for (let p = 0; p < n * 2; p++) way[p] = left[p] / weight[p] + (next / drop) * way[p];
      drop = next;
    }
    // flat, is every triangle the right way up?
    const side = (a, b, c) => (at[b] - at[a]) * (at[c + n] - at[a + n]) - (at[c] - at[a]) * (at[b + n] - at[a + n]);
    const flat = Float64Array.from(size, (_, i) => side(tri[i * 3], tri[i * 3 + 1], tri[i * 3 + 2]) / 2);
    const total = flat.reduce((sum, a) => sum + a, 0);
    if (!(total > 0) || flat.some((a, i) => a <= 0 && size[i] > least * 0.02)) return null;
    // at the surface's own size, is any part of it much smaller or larger than it is?
    for (let p = 0; p < n * 2; p++) at[p] *= Math.sqrt(area / total);
    const scales = [];
    for (let i = 0; i < m; i++) if (size[i] > 1e-14) scales.push([Math.sqrt((Math.max(0, flat[i]) * area) / total / size[i]), size[i]]);
    scales.sort((a, b) => a[0] - b[0]);
    const scale = (part) => {
      let sum = 0;
      return (scales.find(([, a]) => (sum += a) >= area * part) ?? scales.at(-1))[0];
    };
    if (scale(0.03) < STRETCH[0] || scale(0.97) > STRETCH[1]) return null;
    // does its rim cross itself?
    chart++;
    for (const f of list) inside[f] = chart;
    const rim = [];
    for (let i = 0; i < m * 3; i++) {
      const o = across[list[Math.floor(i / 3)] * 3 + (i % 3)];
      if (o < 0 || inside[o] !== chart) rim.push(tri[i], tri[i - (i % 3) + ((i + 1) % 3)]);
    }
    for (let i = 0; i < rim.length; i += 2)
      for (let j = i + 2; j < rim.length; j += 2) {
        const [a, b, c, d] = [rim[i], rim[i + 1], rim[j], rim[j + 1]];
        if (a === c || a === d || b === c || b === d) continue;
        if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return null;
      }
    return { points, u: at.subarray(0, n), v: at.subarray(n) };
  };
}

// A surface in charts, each laid flat (P: its points; N: their normals; face:
// its triangles). Gives { ref, uv, index }: the vertices (the point each is,
// and its place in its chart, in the surface's own units, the charts well
// apart) and every triangle's three. xatlas cuts the charts; but it ends one
// wherever the surface turns far from the chart's facing (an arm takes three
// or four), which makes hundreds on a figure, so they are then joined two at
// a time, the two with the longest border first, wherever the pair lies flat
// as one.
function chartsOf(P, N, face) {
  const across = neighbours(face, P.length / 3);
  const flatten = flattener(P, face, across);
  const atlas = new watlas.Atlas();
  atlas.addMesh({ vertexCount: P.length / 3, vertexPositionData: P, vertexPositionStride: 12, vertexNormalData: N, vertexNormalStride: 12, indexData: face, indexCount: face.length });
  atlas.generate({}, {});
  const mesh = atlas.getMesh(0);
  const of = new Int32Array(face.length / 3).fill(-1); // each triangle's chart
  const charts = new Map(); // each chart's triangles
  let next = 0;
  for (; next < mesh.chartCount; next++) {
    const list = new Uint32Array(mesh.getChart(next).faceCount);
    mesh.getChart(next).getFaceArray(list);
    for (const f of list) of[f] = next;
    charts.set(next, [...list]);
  }
  // (a triangle xatlas left out is a chart of its own)
  for (let f = 0; f < of.length; f++) if (of[f] < 0) charts.set((of[f] = next++), [f]);
  // xatlas's own layout, for a chart that won't lie flat here
  const theirs = new Uint32Array(face.length);
  mesh.getIndexArray(theirs);
  const laid = Array.from({ length: mesh.vertexCount }, (_, j) => mesh.getVertex(j).uv.map((x) => x / atlas.texelsPerUnit));
  atlas.delete();

  // two that won't join aren't tried again, nor is what either grows into
  const apart = new Map(); // a chart -> those it won't join
  const part = (a, b) => {
    for (const [x, y] of [[a, b], [b, a]]) apart.set(x, (apart.get(x) ?? new Set()).add(y));
  };
  for (;;) {
    const border = new Map(); // how many edges each two charts share
    for (let h = 0; h < face.length; h++) {
      const [a, b] = [of[Math.floor(h / 3)], across[h] < 0 ? -1 : of[across[h]]];
      if (b > a) border.set(a * next + b, (border.get(a * next + b) ?? 0) + 1);
    }
    let pick = -1;
    let most = 0;
    for (const [k, edges] of border) if (edges > most && !apart.get(Math.floor(k / next))?.has(k % next)) [pick, most] = [k, edges];
    if (pick < 0) break;
    const [a, b] = [Math.floor(pick / next), pick % next];
    const list = charts.get(a).concat(charts.get(b));
    if (!flatten(list)) {
      part(a, b);
      continue;
    }
    for (const f of list) of[f] = next;
    for (const was of [a, b]) {
      for (const other of apart.get(was) ?? []) part(next, other);
      charts.delete(was);
    }
    charts.set(next++, list);
  }

  const ref = [];
  const uv = [];
  const index = new Uint32Array(face.length);
  let k = 0;
  for (const list of charts.values()) {
    const flat = flatten(list);
    const own = new Map(); // a point -> its vertex in this chart
    const [x, y] = [(k % 16) * 8, Math.floor(k++ / 16) * 8]; // (a chart is a metre or two across)
    flat?.points.forEach((p, i) => {
      own.set(p, ref.push(p) - 1);
      uv.push(flat.u[i] + x, flat.v[i] + y);
    });
    for (const f of list)
      for (let h = f * 3; h < f * 3 + 3; h++) {
        if (!own.has(face[h])) {
          own.set(face[h], ref.push(face[h]) - 1);
          uv.push(laid[theirs[h]][0] + x, laid[theirs[h]][1] + y);
        }
        index[h] = own.get(face[h]);
      }
  }
  return { ref: Uint32Array.from(ref), uv: Float32Array.from(uv), index };
}

// The same, the head cut from the body (`head`: how much of each point is the
// head's; a triangle is the head's if most of it is), each laid flat as it
// is, and the head's charts then made `HEAD` times the size.
function chartsApart(P, N, face, head) {
  const ref = [];
  const uv = [];
  const index = new Uint32Array(face.length);
  for (const heads of [false, true]) {
    const list = []; // this part's triangles (the first corner of each)
    for (let t = 0; t < face.length; t += 3) if (head[face[t]] + head[face[t + 1]] + head[face[t + 2]] > 1.5 === heads) list.push(t);
    if (!list.length) continue;
    const part = chartsOf(P, N, Uint32Array.from({ length: list.length * 3 }, (_, i) => face[list[Math.floor(i / 3)] + (i % 3)]));
    const from = ref.length;
    const scale = heads ? HEAD : 1;
    part.ref.forEach((p, j) => {
      ref.push(p);
      uv.push(part.uv[j * 2] * scale, part.uv[j * 2 + 1] * scale + (heads ? 256 : 0)); // (the head's well clear of the body's)
    });
    part.index.forEach((j, i) => (index[list[Math.floor(i / 3)] + (i % 3)] = from + j));
  }
  return { ref: Uint32Array.from(ref), uv: Float32Array.from(uv), index };
}

// A figure (one mesh, one texture, as Meshy makes them: unquantized) onto a
// new atlas of `size` pixels. The head is given more texels one of two ways.
// As the office's figures were made: the head is drawn larger (every point by
// how much of it is the head's) before anything is laid flat, which is one
// surface, but pulls the triangles of the neck and collar out of shape, where
// a point is partly the head's, and their texture with them. `apart`: the
// head is cut from the body and only its charts are made larger, so nothing
// is out of shape, for a seam round the neck.
let ready = null; // (xatlas, once)
export async function reatlas(doc, size, { apart = false } = {}) {
  await (ready ??= watlas.Initialize());
  const [prim, more] = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const texture = prim?.getMaterial()?.getBaseColorTexture();
  if (!texture || more) throw new Error('reatlas: a figure is one mesh with one texture');
  const { data: paint, info } = await sharp(texture.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [W, H] = [info.width, info.height];
  const at = prim.getAttribute('POSITION').getArray();
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const corner = prim.getIndices().getArray();

  // ── weld: one point wherever several vertices are at one place ──
  const places = new Map();
  const point = new Uint32Array(at.length / 3); // each vertex's point
  const first = []; // each point's first vertex
  for (let i = 0; i < point.length; i++) {
    const k = `${at[i * 3]},${at[i * 3 + 1]},${at[i * 3 + 2]}`;
    if (!places.has(k)) places.set(k, first.push(i) - 1);
    point[i] = places.get(k);
  }
  const P = Float32Array.from({ length: first.length * 3 }, (_, i) => at[first[Math.floor(i / 3)] * 3 + (i % 3)]);
  // the triangles, less any with two corners at one place: `was`, their
  // vertices as Meshy has them (for its texture); `face`, their points
  const was = corner.filter((_, h) => new Set([0, 1, 2].map((c) => point[corner[h - (h % 3) + c]])).size === 3);
  const face = Uint32Array.from(was, (i) => point[i]);
  // smooth normals: each triangle's facing, weighed by its area and its angle at the point
  const N = new Float32Array(P.length);
  for (let t = 0; t < face.length; t += 3) {
    const side = [0, 1, 2].map((c) => [0, 1, 2].map((k) => P[face[t + ((c + 1) % 3)] * 3 + k] - P[face[t + c] * 3 + k]));
    const [a, b] = side;
    const facing = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // (twice its area long)
    for (let c = 0; c < 3; c++) {
      const [e, f] = [side[c], side[(c + 2) % 3]];
      const cos = -(e[0] * f[0] + e[1] * f[1] + e[2] * f[2]) / (Math.hypot(...e) * Math.hypot(...f) || 1);
      const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
      for (let k = 0; k < 3; k++) N[face[t + c] * 3 + k] += facing[k] * angle;
    }
  }
  for (let p = 0; p < N.length; p += 3) {
    const l = Math.hypot(N[p], N[p + 1], N[p + 2]) || 1;
    for (let k = 0; k < 3; k++) N[p + k] /= l;
  }

  // ── Meshy's islands, and the island each texel of its texture is in ──
  const isle = Int32Array.from(point.keys());
  const top = (i) => {
    while (isle[i] !== i) i = isle[i] = isle[isle[i]];
    return i;
  };
  for (let t = 0; t < corner.length; t += 3) for (const c of [1, 2]) isle[top(corner[t + c])] = top(corner[t]);
  const owner = new Int32Array(W * H).fill(-1);
  for (let t = 0; t < corner.length; t += 3) {
    const x = [0, 1, 2].map((c) => uv[corner[t + c] * 2] * W - 0.5);
    const y = [0, 1, 2].map((c) => uv[corner[t + c] * 2 + 1] * H - 0.5);
    const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
    if (!area) continue;
    for (let py = Math.max(0, Math.ceil(Math.min(...y))); py <= Math.min(H - 1, Math.max(...y)); py++)
      for (let px = Math.max(0, Math.ceil(Math.min(...x))); px <= Math.min(W - 1, Math.max(...x)); px++)
        if ([0, 1, 2].every((c) => ((x[(c + 1) % 3] - x[c]) * (py - y[c]) - (y[(c + 1) % 3] - y[c]) * (px - x[c])) * area >= 0)) owner[py * W + px] = top(corner[t]);
  }
  // Meshy's texture at (u, v), from the texels of one island (and of none:
  // the fill between islands), so a neighbour's colour never comes with it
  const rgb = [0, 0, 0];
  const colour = (u, v, island) => {
    const x = Math.min(W - 1, Math.max(0, u * W - 0.5));
    const y = Math.min(H - 1, Math.max(0, v * H - 0.5));
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    let sum = 0;
    rgb.fill(0);
    for (let k = 0; k < 4; k++) {
      const i = Math.min(H - 1, y0 + (k >> 1)) * W + Math.min(W - 1, x0 + (k & 1));
      if (owner[i] !== island && owner[i] !== -1) continue;
      const w = (k & 1 ? x - x0 : 1 - x + x0) * (k >> 1 ? y - y0 : 1 - y + y0);
      for (let c = 0; c < 3; c++) rgb[c] += paint[i * 3 + c] * w;
      sum += w;
    }
    // (a sliver no texel's centre is in: the nearest texel, whoever's)
    if (sum < 1e-4) for (let c = 0; c < 3; c++) rgb[c] = paint[(Math.round(y) * W + Math.round(x)) * 3 + c];
    else for (let c = 0; c < 3; c++) rgb[c] /= sum;
    return rgb;
  };

  // ── new charts, packed as large as all fit, a gutter between them ──
  // (laid out with the head larger: a chart's texels go by its size)
  const heads = new Set(doc.getRoot().listSkins()[0]?.listJoints().flatMap((j, i) => (/^head/i.test(j.getName()) ? [i] : [])));
  const joints = prim.getAttribute('JOINTS_0')?.getArray();
  const weights = prim.getAttribute('WEIGHTS_0')?.getArray();
  const head = first.map((v) => [0, 1, 2, 3].reduce((sum, k) => sum + (heads.has(joints?.[v * 4 + k]) ? weights[v * 4 + k] : 0), 0)); // how much of each point is head
  const middle = [0, 1, 2].map((k) => head.reduce((sum, w, p) => sum + w * P[p * 3 + k], 0) / (head.reduce((sum, w) => sum + w, 0) || 1));
  const drawn = P.map((x, i) => middle[i % 3] + (x - middle[i % 3]) * (1 + (HEAD - 1) * head[Math.floor(i / 3)]));
  const { ref, uv: flat, index } = apart ? chartsApart(P, N, face, head) : chartsOf(drawn, N, face);
  let surface = 0;
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 2, index[t + 1] * 2, index[t + 2] * 2];
    surface += Math.abs((flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) - (flat[c] - flat[a]) * (flat[b + 1] - flat[a + 1])) / 2;
  }
  const atlas = new watlas.Atlas();
  atlas.addUvMesh({ vertexUvData: flat, vertexCount: ref.length, vertexStride: 8, indexData: index, indexCount: index.length });
  atlas.computeCharts({});
  const gutter = size >> 7; // (8 texels in 1024: a chart's colours keep to themselves two mip levels down, and mix little below)
  const pack = (texelsPerUnit) => {
    atlas.packCharts({ texelsPerUnit, resolution: size, padding: gutter, bilinear: true, blockAlign: false, bruteForce: false, rotateCharts: true, rotateChartsToAxis: true });
    return atlas.atlasCount === 1;
  };
  let fits = 0;
  let over = size / Math.sqrt(surface); // (were there no space between them)
  for (let i = 0; i < 10; i++) {
    const scale = (fits + over) / 2;
    if (pack(scale)) fits = scale;
    else over = scale;
  }
  const packed = pack(fits) && atlas.getMesh(0);
  if (!packed || packed.vertexCount !== ref.length) throw new Error('reatlas: the charts would not pack');
  const st = new Float32Array(ref.length * 2);
  for (let j = 0; j < ref.length; j++) {
    const vertex = packed.getVertex(j);
    // (a chart with no area is given no place: any will do)
    st.set(vertex.atlasIndex < 0 ? [0.5 / size, 0.5 / size] : [vertex.uv[0] / atlas.width, vertex.uv[1] / atlas.height], j * 2);
  }
  atlas.delete();

  // ── the texture painted again: each triangle in its new place, from its old ──
  const out = new Float32Array(size * size * 3);
  const got = new Float32Array(size * size);
  const fine = 4; // samples across a texel
  for (let t = 0; t < index.length; t += 3) {
    const x = [0, 1, 2].map((c) => st[index[t + c] * 2] * size);
    const y = [0, 1, 2].map((c) => st[index[t + c] * 2 + 1] * size);
    const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
    if (Math.abs(area) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...y))); py <= Math.min(size - 1, Math.max(...y)); py++)
      for (let px = Math.max(0, Math.floor(Math.min(...x))); px <= Math.min(size - 1, Math.max(...x)); px++)
        for (let s = 0; s < fine * fine; s++) {
          const sx = px + ((s % fine) + 0.5) / fine;
          const sy = py + (Math.floor(s / fine) + 0.5) / fine;
          // how much of each corner there is at this sample
          const a = ((x[1] - sx) * (y[2] - sy) - (x[2] - sx) * (y[1] - sy)) / area;
          const b = ((x[2] - sx) * (y[0] - sy) - (x[0] - sx) * (y[2] - sy)) / area;
          const c = 1 - a - b;
          if (a < 0 || b < 0 || c < 0) continue;
          const [i, j, k] = [was[t] * 2, was[t + 1] * 2, was[t + 2] * 2];
          const from = colour(a * uv[i] + b * uv[j] + c * uv[k], a * uv[i + 1] + b * uv[j + 1] + c * uv[k + 1], top(was[t]));
          const o = py * size + px;
          for (let ch = 0; ch < 3; ch++) out[o * 3 + ch] += from[ch];
          got[o]++;
        }
  }
  for (let o = 0; o < got.length; o++) {
    if (!got[o]) continue;
    for (let ch = 0; ch < 3; ch++) out[o * 3 + ch] /= got[o];
    got[o] = 1;
  }
  // the gutters, a ring at a time, from the painted texels round them
  for (let left = true; left; ) {
    left = false;
    const add = [];
    for (let ty = 0; ty < size; ty++)
      for (let tx = 0; tx < size; tx++) {
        if (got[ty * size + tx]) continue;
        let r = 0;
        let g = 0;
        let bl = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size || !got[ny * size + nx]) continue;
            const i = (ny * size + nx) * 3;
            r += out[i];
            g += out[i + 1];
            bl += out[i + 2];
            n++;
          }
        if (n) add.push(ty * size + tx, r / n, g / n, bl / n);
      }
    for (let i = 0; i < add.length; i += 4) {
      out.set([add[i + 1], add[i + 2], add[i + 3]], add[i] * 3);
      got[add[i]] = 1;
      left = true;
    }
  }
  texture.setImage(await sharp(Uint8Array.from(out, Math.round), { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
  prim.getMaterial().getBaseColorTextureInfo().setWrapS(33071).setWrapT(33071); // (an atlas: clamped to its edge)

  // ── the mesh on its new vertices ──
  const pick = (from, width, of) => from.constructor.from({ length: ref.length * width }, (_, i) => from[of[Math.floor(i / width)] * width + (i % width)]);
  const vertex = ref.map((p) => first[p]); // (one of Meshy's, for each)
  for (const semantic of prim.listSemantics()) {
    const old = prim.getAttribute(semantic);
    // (the tangents went with the old layout, and nothing here reads them)
    const array = semantic === 'TANGENT' ? null : semantic === 'POSITION' ? pick(P, 3, ref) : semantic === 'NORMAL' ? pick(N, 3, ref) : semantic === 'TEXCOORD_0' ? st : pick(old.getArray(), old.getElementSize(), vertex);
    prim.setAttribute(semantic, array && old.clone().setArray(array));
    old.dispose();
  }
  prim.getIndices().setArray(ref.length > 65535 ? index : Uint16Array.from(index));
}
