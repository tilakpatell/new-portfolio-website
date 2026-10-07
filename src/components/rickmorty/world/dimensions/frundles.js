// Mr. Frundles' Earth (S6 'Full Meta Jackrick', the cold open): the Smiths'
// kind of street on a bright afternoon, but the houses have his face, and so
// does the dog, and so do the neighbours. Rick holds the portal open at the
// end of the lawn; the family wait where the data puts them, and everything
// fuzzy wanders the lawns till it sees you (./destinations.js). The houses,
// the dog, the neighbours and Mr. Frundles himself are models; the lawns,
// the road, the hedges and the trees are the scenery.

import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff4e0, 1.1], hemi: [0xbfe0ff, 0x4a6a3a, 1.3], fog: [0xc8dcf0, 70, 260] };

export async function buildFrundles(kit) {
  const S = stage(kit, 'frundles', { ground: specks('#5a9a46', ['#4f8a3c', '#66a850', '#548f40'], 61, 2000, 2), groundTile: 5 });
  const { R, P } = S;

  // the road across the middle of the box, with a kerb each side and a dashed line
  R.frame(...P(0, 0), 0, { list: 'fixed' }).box(0x3a3a40, 0, 0.02, 0, 90, 0.04, 7).box(0x9a9a96, 0, 0.05, -3.7, 90, 0.1, 0.5).box(0x9a9a96, 0, 0.05, 3.7, 90, 0.1, 0.5);
  for (let k = -10; k <= 10; k++) R.frame(...P(k * 4.2, 0), 0, { list: 'fixed' }).box(0xf0e8a0, 0, 0.045, 0, 2, 0.02, 0.18);
  // the lawns' paths up to each house's door
  for (const [dx, dz, len] of [[-16, -9, 10], [18, -11, 12], [24, 4, 8]]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).box(0xcfc8b8, 0, 0.03, 0, 1.2, 0.03, len);
  // hedges, as the data has them (solids hedge-a, hedge-b), a little fur on top where he's been
  for (const [dx, dz, w, d] of [[-8, -22, 10, 1], [10, 6, 1, 8]]) {
    const f = R.frame(...P(dx, dz), 0);
    f.box(0x2f6a2a, 0, 0.6, 0, w, 1.2, d).box(0x8a4a2a, 0, 1.25, 0, w * 0.6, 0.12, d * 0.6);
  }
  // the mailbox by the Hendersons' path
  R.frame(...P(-12, -10), 0).box(0x3a3a3a, 0, 0.55, 0, 0.1, 1.1, 0.1).box(0x2a4a9a, 0, 1.2, 0, 0.5, 0.3, 0.3).box(0xe03030, 0.28, 1.35, 0, 0.04, 0.3, 0.06);
  // two trees at the ends of the street, their crowns gone fuzzy and brown like him
  for (const [i, [dx, dz]] of [[-30, 14], [30, 16]].entries()) {
    const f = R.frame(...P(dx, dz), i);
    f.cyl(0x5a4030, 0, 0, 0, 0.5, 4).ball(0x8a4a2a, 0, 5, 0, 2.6).ball(0x9a5a34, 1.4, 4.4, 0.6, 1.8).ball(0x7a3e24, -1.2, 4.6, -0.8, 1.7);
    // his eyes, in the crown
    f.ball(0x101010, -0.7, 5.2, 2.3, 0.3).ball(0x101010, 0.7, 5.2, 2.3, 0.3).ball(0xf09ab0, 0, 4.7, 2.5, 0.16);
  }
  // the sun, low and warm, and a few clouds
  R.frame(...P(60, -140), 0, { list: 'fixed' }).glow(BALL, 0xfff0c0, 1.2, 0, 60, 0, 0, 9);
  for (let k = 0; k < 6; k++) R.frame(...P(-80 + k * 32, -120 + (k % 2) * 30), 0, { list: 'fixed' }).ball(0xffffff, 0, 48 + (k % 3) * 6, 0, 7 + (k % 2) * 3, 0.6);

  S.people();
  return S.done(LIGHT, () => {});
}
