// The kit a course is built with: boxes, ramps, cylinders, cones, terrain,
// strips and raw triangles, each one both what Mario stands on (the
// collision triangles, for rules/collide.js) and what you see (meshes by
// material key, for scene.js), so the two never disagree. No three.js here.
// Units are the game's; y is always the bottom of a shape. A shape's yaw
// turns its local +z to (sin yaw, cos yaw), as three's rotation.y does.
// UVs are planar in world space, one repeat every scaleOf(mat) units, so
// every surface of a material shares one texel size.
//
// createKit({ scaleOf }) → kit; kit.done() → { tris, kinds, meshes: Map(mat
// → { pos, nrm, uv }), terrains: [{ id, mats, pos, nrm, uv, splat, index }] }

export function createKit({ scaleOf = () => 400 } = {}) {
  const tris = [];
  const kinds = [];
  const meshes = new Map();
  const terrains = [];

  const bucket = (mat) => {
    let b = meshes.get(mat);
    if (!b) meshes.set(mat, (b = { pos: [], nrm: [], uv: [] }));
    return b;
  };

  // one flat convex polygon, its corners counter-clockwise seen from outside
  function face(pts, { mat, kind = 'default', collide = true, show = true }) {
    if (pts.length < 3) return;
    const [a, b, c] = pts;
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    nx /= len;
    ny /= len;
    nz /= len;
    const s = scaleOf(mat);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const uvOf = (p) => (ay >= ax && ay >= az ? [p[0] / s, p[2] / s] : ax >= az ? [p[2] / s, p[1] / s] : [p[0] / s, p[1] / s]);
    const m = show ? bucket(mat) : null;
    for (let i = 1; i < pts.length - 1; i++) {
      const tri = [pts[0], pts[i], pts[i + 1]];
      if (collide) {
        for (const p of tri) tris.push(p[0], p[1], p[2]);
        kinds.push(kind);
      }
      if (m) {
        for (const p of tri) {
          m.pos.push(p[0], p[1], p[2]);
          m.nrm.push(nx, ny, nz);
          m.uv.push(...uvOf(p));
        }
      }
    }
  }

  // local (lx, ly, lz) about (x, y, z), turned by yaw
  const place = (x, y, z, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  };

  const kit = {
    face(pts, opts) {
      face(pts, opts);
      return kit;
    },

    box({ x, y, z, w, h, d, yaw = 0, mat, top, side, bottom, kind, topKind, collide = true, show = true }) {
      const P = place(x, y, z, yaw);
      const hw = w / 2, hd = d / 2;
      const c = [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(-hw, h, hd)];
      const o = { kind, collide, show };
      face([c[4], c[7], c[6], c[5]], { ...o, mat: top ?? mat, kind: topKind ?? kind });
      face([c[0], c[1], c[2], c[3]], { ...o, mat: bottom ?? side ?? mat });
      face([c[0], c[4], c[5], c[1]], { ...o, mat: side ?? mat }); // -z
      face([c[1], c[5], c[6], c[2]], { ...o, mat: side ?? mat }); // +x
      face([c[2], c[6], c[7], c[3]], { ...o, mat: side ?? mat }); // +z
      face([c[3], c[7], c[4], c[0]], { ...o, mat: side ?? mat }); // -x
      return kit;
    },

    // a wedge rising along local +z from y to y + h
    ramp({ x, y, z, w, d, h, yaw = 0, mat, side, kind, collide = true, show = true }) {
      const P = place(x, y, z, yaw);
      const hw = w / 2, hd = d / 2;
      const b0 = P(-hw, 0, -hd), b1 = P(hw, 0, -hd), b2 = P(hw, 0, hd), b3 = P(-hw, 0, hd);
      const t2 = P(hw, h, hd), t3 = P(-hw, h, hd);
      const o = { kind, collide, show };
      face([b0, t3, t2, b1], { ...o, mat });
      face([b0, b1, b2, b3], { ...o, mat: side ?? mat });
      face([b2, t2, t3, b3], { ...o, mat: side ?? mat });
      face([b1, t2, b2], { ...o, mat: side ?? mat });
      face([b3, t3, b0], { ...o, mat: side ?? mat });
      return kit;
    },

    cyl({ x, y, z, r, h, seg = 20, mat, top, bottom: showBottom = true, kind, topKind, collide = true, show = true }) {
      const ring = (yy) => Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2;
        return [x + Math.sin(a) * r, yy, z + Math.cos(a) * r];
      });
      const lo = ring(y), hi = ring(y + h);
      const o = { kind, collide, show };
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        face([lo[i], lo[j], hi[j], hi[i]], { ...o, mat });
      }
      // a ring in its own order faces up; reversed, down
      face(hi, { ...o, mat: top ?? mat, kind: topKind ?? kind });
      if (showBottom) face([...lo].reverse(), { ...o, mat: top ?? mat });
      return kit;
    },

    cone({ x, y, z, r, h, seg = 20, mat, kind, collide = true, show = true }) {
      const apex = [x, y + h, z];
      const lo = Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2;
        return [x + Math.sin(a) * r, y, z + Math.cos(a) * r];
      });
      for (let i = 0; i < seg; i++) face([lo[i], lo[(i + 1) % seg], apex], { kind, collide, show, mat });
      face([...lo].reverse(), { kind, collide, show, mat });
      return kit;
    },

    // A heightfield over [x0, x0 + w] × [z0, z0 + d] in res × res cells, with
    // smooth normals and a splat weight for each of its three materials.
    terrain({ id, x0, z0, w, d, res, height, splat = () => [1, 0, 0], mats, kind, collide = true }) {
      const n = res + 1;
      const pos = new Float32Array(n * n * 3);
      const nrm = new Float32Array(n * n * 3);
      const uv = new Float32Array(n * n * 2);
      const sp = new Float32Array(n * n * 3);
      const s = scaleOf(mats[0]);
      const e = Math.min(w, d) / res / 2;
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const x = x0 + (w * i) / res;
          const z = z0 + (d * j) / res;
          const y = height(x, z);
          const k = j * n + i;
          pos.set([x, y, z], k * 3);
          let gx = (height(x + e, z) - height(x - e, z)) / (2 * e);
          let gz = (height(x, z + e) - height(x, z - e)) / (2 * e);
          const l = Math.hypot(gx, 1, gz);
          nrm.set([-gx / l, 1 / l, -gz / l], k * 3);
          uv.set([x / s, z / s], k * 2);
          const wts = splat(x, z, 1 / l, y);
          const sum = wts[0] + wts[1] + wts[2] || 1;
          sp.set([wts[0] / sum, wts[1] / sum, wts[2] / sum], k * 3);
        }
      const index = [];
      for (let j = 0; j < res; j++)
        for (let i = 0; i < res; i++) {
          const a = j * n + i, b = a + 1, c = a + n, dd = c + 1;
          // counter-clockwise from above: a, c, dd and a, dd, b
          index.push(a, c, dd, a, dd, b);
          if (collide)
            for (const [p, q, r] of [
              [a, c, dd],
              [a, dd, b],
            ]) {
              tris.push(pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2], pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2], pos[r * 3], pos[r * 3 + 1], pos[r * 3 + 2]);
              kinds.push(kind ?? 'default');
            }
        }
      terrains.push({ id, mats, pos, nrm, uv, splat: sp, index: Uint32Array.from(index) });
      return kit;
    },

    // a slab along pts (its top's middle line), width wide and thick deep,
    // with low walls of height `rail` at both edges when asked
    strip({ pts, width, thick = 60, mat, side, kind, rail = 0, railMat, collide = true, show = true }) {
      const hw = width / 2;
      const perp = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[2] - a[2];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        // the miter: as wide as needed at a bend so the edges stay parallel
        let k = 1;
        if (i > 0 && i < pts.length - 1) {
          const ux = pts[i][0] - pts[i - 1][0], uz = pts[i][2] - pts[i - 1][2];
          const ul = Math.hypot(ux, uz) || 1;
          const cos = (ux / ul) * dx + (uz / ul) * dz;
          k = 1 / Math.max(0.5, Math.sqrt((1 + cos) / 2));
        }
        // right of the heading (dx, dz) is (dz, -dx)
        return [dz * hw * k, -dx * hw * k];
      });
      const L = pts.map((p, i) => [p[0] - perp[i][0], p[1], p[2] - perp[i][1]]);
      const R = pts.map((p, i) => [p[0] + perp[i][0], p[1], p[2] + perp[i][1]]);
      const down = (p) => [p[0], p[1] - thick, p[2]];
      const up = (p) => [p[0], p[1] + rail, p[2]];
      const o = { kind, collide, show };
      for (let i = 0; i < pts.length - 1; i++) {
        face([L[i], L[i + 1], R[i + 1], R[i]], { ...o, mat });
        face([down(L[i]), down(R[i]), down(R[i + 1]), down(L[i + 1])], { ...o, mat: side ?? mat });
        face([R[i], R[i + 1], down(R[i + 1]), down(R[i])], { ...o, mat: side ?? mat });
        face([L[i + 1], L[i], down(L[i]), down(L[i + 1])], { ...o, mat: side ?? mat });
        if (rail > 0) {
          face([up(R[i]), up(R[i + 1]), R[i + 1], R[i]], { ...o, mat: railMat ?? side ?? mat });
          face([R[i], R[i + 1], up(R[i + 1]), up(R[i])], { ...o, mat: railMat ?? side ?? mat });
          face([up(L[i + 1]), up(L[i]), L[i], L[i + 1]], { ...o, mat: railMat ?? side ?? mat });
          face([L[i + 1], L[i], up(L[i]), up(L[i + 1])], { ...o, mat: railMat ?? side ?? mat });
        }
      }
      const last = pts.length - 1;
      face([R[0], down(R[0]), down(L[0]), L[0]], { ...o, mat: side ?? mat });
      face([L[last], down(L[last]), down(R[last]), R[last]], { ...o, mat: side ?? mat });
      return kit;
    },

    raw(positions, mat, { kind, collide = true, show = true } = {}) {
      for (let i = 0; i + 9 <= positions.length; i += 9) {
        const p = positions;
        face(
          [
            [p[i], p[i + 1], p[i + 2]],
            [p[i + 3], p[i + 4], p[i + 5]],
            [p[i + 6], p[i + 7], p[i + 8]],
          ],
          { mat, kind, collide, show },
        );
      }
      return kit;
    },

    done() {
      const out = new Map();
      for (const [k, v] of meshes) out.set(k, { pos: Float32Array.from(v.pos), nrm: Float32Array.from(v.nrm), uv: Float32Array.from(v.uv) });
      return { tris: Float32Array.from(tris), kinds: kinds.slice(), meshes: out, terrains };
    },
  };
  return kit;
}
