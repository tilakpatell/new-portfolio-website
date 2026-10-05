// The Prancing Pony's kitchen: flagstones, plaster and timber, firelit,
// with pans and herbs hung over the back counters. The shared stations
// (./common.js) are the Pony's own.

import { B, cyl } from '../../shire/props';

export const INN = {
  sky: { background: 0x1a120c, fog: [0x1a120c, 18, 44], hemi: [0xffe2b8, 0x3a2414, 1.25], sun: [0xffe0b0, 2.2] },
  room({ bk, mats, W, D, Z, wallH }) {
    // flagstones underfoot, so the counters stand out from the floor
    bk.add(mats.ashlar, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.45 });
    bk.add(mats.plaster, B(W + 2, wallH, 0.2), { p: [0, wallH / 2, Z(0) - 0.1], uv: 0.5 });
    for (const s of [-1, 1]) bk.add(mats.plaster, B(0.2, wallH, D + 1), { p: [s * (W / 2 + 0.1), wallH / 2, 0], uv: 0.5 });
    // beams and panelling on the back wall
    for (let x = -W / 2; x <= W / 2; x += 2) bk.add(mats.timber, B(0.22, wallH, 0.12), { p: [x, wallH / 2, Z(0) + 0.02], uv: 1 });
    bk.add(mats.timber, B(W + 2, 0.18, 0.14), { p: [0, wallH - 0.4, Z(0) + 0.03], uv: 1 });
    bk.add(mats.timber, B(W + 2, 0.12, 0.12), { p: [0, 1.25, Z(0) + 0.03], uv: 1 });
    for (const s of [-1, 1]) bk.add(mats.timber, B(0.12, 0.18, D + 1), { p: [s * (W / 2 + 0.02), wallH - 0.4, 0], uv: 1 });
    // hanging pans and herbs over the back counters
    for (let x = -W / 2 + 1.5; x < W / 2 - 1; x += 2.6) {
      bk.add(mats.iron, cyl(0.16, 0.12, 0.05, 12), { p: [x, 2.0, Z(0) + 0.18], r: [Math.PI / 2, 0, 0] });
      bk.add(mats.iron, B(0.03, 0.22, 0.03), { p: [x, 2.22, Z(0) + 0.14] });
      bk.add(mats.wheat, cyl(0.06, 0.02, 0.36, 5), { p: [x + 1.1, 2.15, Z(0) + 0.16], color: 0x9aa060 });
    }
  },
};
