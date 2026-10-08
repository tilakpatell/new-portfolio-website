// Where the Scranton branch goes when it gets up, and who goes where, for
// ./day.js: the kitchen's counter, fridge and microwave, the copier, the
// water cooler by reception, Pam's jelly beans on reception's counter (Erin
// behind it), the vending machine in the break room, the supply room, Ryan's
// closet door (Kelly), and Michael's door (Toby, who is told no). (The
// conference room's door is too narrow for a body to walk the way through.)
// Each place a spot or two clear of everything to stand at (./paths.js
// freeNear), the way it's faced (at what it's for), the clip it's used with
// (lib/three/clipLibrary.js) and for how long. Pure data and
// a builder; the way to each is found when it's first wanted (./scene.js).
//
// officePlaces() → [place…] as day.js reads them
// AMBLERS: [{ who, needs: { [need]: rate a second }, places: [id…] }]
// TALK_CLIP: { [who]: clip } the talk each has in a conversation (the
//   clip library's), standing

import { RECEPTION, VENDING, seatOf } from './layout';
import { freeNear } from './paths';

const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
// spots clear of everything, near each of these, facing `look`
const spotsAt = (pts, look) => {
  const spots = pts.map((p) => freeNear(p));
  return { spots, face: look ? yawTo(spots[0], look) : null };
};

export function officePlaces() {
  const michael = seatOf('michael').chair;
  const ryan = seatOf('ryan').chair;
  const erin = RECEPTION.chair;
  // (the break room's round tables stand in a row before the machines: the
  // way to them is round the end of the row)
  const vend = { x: 12.45, z: -7.45 };
  const machine = { x: VENDING[0].x, z: VENDING[0].z };
  const cooler = { x: -10.2, z: -4.7 };
  return [
    // the kitchen: the coffee at the counter, the fridge, the microwave (each a slot; three there talk)
    { id: 'coffee', need: 'coffee', ...spotsAt([{ x: 1.9, z: -1.72 }], { x: 1.9, z: -2.4 }), clip: 'drink', duration: 7, chat: true },
    { id: 'microwave', need: 'food', ...spotsAt([{ x: 3.05, z: -1.72 }], { x: 3.05, z: -2.4 }), clip: 'interact', duration: 8, chat: true },
    { id: 'fridge', need: 'food', ...spotsAt([{ x: 3.93, z: -1.62 }], { x: 3.9, z: -2.4 }), clip: 'door', duration: 5, chat: true },
    // the copier, jammed
    { id: 'copier', need: 'work', ...spotsAt([{ x: 0.6, z: -2.95 }], { x: 0.6, z: -3.8 }), clip: 'interact', duration: 8 },
    // Pam's jelly beans, Erin behind the counter
    { id: 'jellybeans', need: 'food', ...spotsAt([{ x: -9.0, z: -3.15 }], { x: -9.0, z: -2.4 }), clip: 'pickup', duration: 6, with: 'erin', look: { x: erin.x, z: erin.z } },
    // the water cooler: where the office talks about everyone who isn't at it
    { id: 'cooler', need: 'company', ...spotsAt([{ x: -9.7, z: -4.15 }, { x: -9.25, z: -4.75 }, { x: -9.9, z: -3.6 }], cooler), clip: 'drink', duration: 14, chat: true },
    // the vending machine: Kevin has a technique
    { id: 'vending', need: 'food', ...spotsAt([vend], machine), clip: 'interact', duration: 7 },
    // the supply room: Creed, about his business
    { id: 'supplies', need: 'work', ...spotsAt([{ x: -7.5, z: 6.0 }], { x: -7.6, z: 7.6 }), clip: 'look.around', loop: true, duration: 10 },
    // at Ryan's closet door: Kelly
    { id: 'closet', need: 'company', ...spotsAt([{ x: 3.85, z: -0.75 }], ryan), clip: 'talk.passion', loop: true, duration: 10, with: 'ryan', look: { x: ryan.x, z: ryan.z } },
    // at Michael's door: Toby, with something for him (not you, Toby)
    { id: 'michael', need: 'boss', ...spotsAt([{ x: -5.1, z: -3.9 }], michael), clip: 'talk.open', loop: true, duration: 7, with: 'michael', look: { x: michael.x, z: michael.z } },
  ];
}

// Who gets up, what they want, and where they'll go for it
export const AMBLERS = [
  { who: 'kevin', needs: { food: 0.011, coffee: 0.003 }, places: ['vending', 'jellybeans', 'microwave', 'coffee'], walk: 0.9 },
  { who: 'meredith', needs: { coffee: 0.012, company: 0.004 }, places: ['coffee', 'cooler'] },
  { who: 'oscar', needs: { work: 0.009, company: 0.006, coffee: 0.004 }, places: ['copier', 'cooler', 'coffee'] },
  { who: 'angela', needs: { food: 0.008, company: 0.005 }, places: ['fridge', 'cooler'], walk: 1.15 },
  { who: 'creed', needs: { work: 0.008, food: 0.003 }, places: ['supplies', 'fridge'], walk: 0.95 },
  { who: 'phyllis', needs: { food: 0.009, company: 0.005, coffee: 0.003 }, places: ['microwave', 'cooler', 'coffee'], walk: 0.9 },
  { who: 'pam', needs: { coffee: 0.007, company: 0.005, work: 0.003 }, places: ['coffee', 'cooler', 'copier'] },
  { who: 'kelly', needs: { company: 0.012, coffee: 0.004 }, places: ['closet', 'cooler', 'coffee'], walk: 1.15 },
  { who: 'toby', needs: { coffee: 0.007, boss: 0.005 }, places: ['coffee', 'michael'], walk: 0.95 },
  { who: 'andy', needs: { company: 0.009, coffee: 0.004 }, places: ['cooler', 'coffee'], walk: 1.15 },
  { who: 'stanley', needs: { food: 0.004 }, places: ['vending'], walk: 0.85 },
  { who: 'darryl', needs: { coffee: 0.004, food: 0.003 }, places: ['coffee', 'vending'] },
];

export const TALK_CLIP = {
  michael: 'talk.passion',
  dwight: 'talk.angry',
  angela: 'talk.hip',
  kelly: 'talk.passion',
  oscar: 'talk.open',
  andy: 'talk.raised',
  phyllis: 'talk.right',
  meredith: 'talk.open',
  creed: 'talk.right',
  darryl: 'talk.open',
  ryan: 'talk.right',
};
