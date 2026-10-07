// The Scranton branch's floor plan, laid out as the set is: the lobby and
// lift, reception, Michael's office with the conference room beside it, the
// bullpen, accounting, then the hallway past the kitchen and the restrooms to
// the annex. One plan for both drawings: the 2D map and the 3D office.
//
// Plan units: the drawing is 940×520; one unit is 3.2 cm on the set, so a
// desk of 53×24 units is 1.7 m by 77 cm. Walls and glass are SVG paths of
// straight runs (M, H and V only), so the 3D office can raise them as walls.

export const PLAN = { w: 940, h: 520, metres: 0.032 };

// x/y place each person on the plan; `item` is the thing on their desk.
// `done` is what happens when you do their thing: `said` when it's them
// saying it, in their own voice where it's been made (./voicelines.js).
export const STAFF = [
  { id: 'michael', gif: 'officeBestBoss', name: 'Michael Scott', role: 'Regional Manager', x: 269, y: 58, item: 'mug', text: 'Runs the branch like a family, a talk show and an improv class at once, from the office with the blinds he never quite closes.', action: 'Thank the room', done: 'Thank you. Thank you so much.' },
  { id: 'jim', gif: 'officeJim', name: 'Jim Halpert', role: 'Salesman', x: 295, y: 194, item: 'jello', text: 'Sits across from Dwight, which explains most of what happens to Dwight’s things.', action: 'Prank Dwight', done: 'Dwight’s stapler, in Jell-O. Again.' },
  { id: 'pam', gif: 'officePamDundie', name: 'Pam Beesly', role: 'Sales, later office administrator', x: 269, y: 258, item: 'phone', text: 'Answered the phones at reception for years, then moved to the desk beside Jim. Paints the building in her spare time.', action: 'Answer the phone', done: 'Dunder Mifflin, this is Pam.', said: true },
  { id: 'dwight', gif: 'officeFalse', name: 'Dwight Schrute', role: 'Assistant (to the) Regional Manager', x: 331, y: 258, item: 'beet', text: 'Beet farmer, volunteer sheriff’s deputy and the branch’s top salesman, by his own count.', action: 'Fact or false?', done: '' },
  { id: 'andy', gif: 'parkour', name: 'Andy Bernard', role: 'Salesman', x: 410, y: 194, item: 'banjo', text: 'Cornell man, banjo player, and one third of the branch’s parkour team.', action: 'Parkour!', done: 'Parkour!' },
  { id: 'phyllis', name: 'Phyllis Vance', role: 'Saleswoman', x: 379, y: 258, item: 'yarn', text: 'Knits, sells, and is married to Bob Vance, of Vance Refrigeration.', action: 'Ask about Bob', done: 'Bob Vance, Vance Refrigeration.', said: true },
  { id: 'stanley', name: 'Stanley Hudson', role: 'Salesman', x: 442, y: 258, item: 'paper', text: 'Does the crossword, keeps his head down, and lives for one day a year.', action: 'Is it Pretzel Day?', done: 'It is. Stanley is first in line.' },
  { id: 'erin', name: 'Erin Hannon', role: 'Receptionist', x: 186, y: 190, item: 'phone', text: 'Took over reception when Pam moved to sales. The first face you see off the lift.', action: 'Ring reception', done: 'Dunder Mifflin, this is Erin.', said: true },
  { id: 'kevin', gif: 'officeChili', name: 'Kevin Malone', role: 'Accountant', x: 197, y: 331, item: 'chili', text: 'Makes one thing better than anyone: his chili. Getting it to the office is another matter.', action: 'Bring in the chili', done: 'The carpet never recovered.' },
  { id: 'angela', name: 'Angela Martin', role: 'Head of Accounting', x: 197, y: 302, item: 'cat', text: 'Runs the party planning committee and an unknown number of cats.', action: 'Meet the cats', done: 'Sprinkles, Bandit, Princess Lady, Garbage, Comstock, Lumpy, and more besides.' },
  { id: 'oscar', name: 'Oscar Martinez', role: 'Accountant', x: 252, y: 290, item: 'book', text: 'The accountant who reads, and the first to say “actually” when someone is wrong.', action: 'Ask Oscar', done: 'Actually, it’s a little more complicated than that.', said: true },
  { id: 'creed', name: 'Creed Bratton', role: 'Quality Assurance', x: 377, y: 319, item: 'question', text: 'Nobody is entirely sure what Creed does. Possibly including Creed.', action: 'Ask what he does', done: 'Quality assurance. Probably.', said: true },
  { id: 'meredith', name: 'Meredith Palmer', role: 'Supplier Relations', x: 307, y: 366, item: 'mug-plain', text: 'Supplier relations, and every office party’s last guest standing.', action: '', done: '' },
  { id: 'darryl', name: 'Darryl Philbin', role: 'Warehouse foreman', x: 462, y: 330, item: 'keys', text: 'Came up from the warehouse to an office of his own, glass walls and all. Plays keys.', action: '', done: '' },
  { id: 'ryan', name: 'Ryan Howard', role: 'The temp, then the closet', x: 600, y: 286, item: 'question', text: 'Started as the temp, rose, fell, and ended up in a closet between the restrooms.', action: '', done: '' },
  { id: 'toby', gif: 'officeNoGod', name: 'Toby Flenderson', role: 'Human Resources', x: 900, y: 270, item: 'binder', text: 'HR, at the far end of the annex. Michael has strong feelings about Toby.', action: 'Welcome Toby back', done: 'Michael took it well.' },
  { id: 'kelly', name: 'Kelly Kapoor', role: 'Customer Service', x: 892, y: 352, item: 'phone', text: 'Customer service in the annex, and the office’s authority on everyone’s business.', action: '', done: '' },
];

// The building: the office floor, the supply room, the lobby and the lift.
export const FLOOR = 'M142 12 H926 V376 H670 V440 H586 V376 H298 V403 H161 V238 H142 Z';
export const SUPPLIES = { x: 161, y: 403, w: 137, h: 106 };
export const LOBBY = { x: 14, y: 14, w: 128, h: 75 };
export const LIFT = { x: 48, y: 89, w: 91, h: 50 };
// tiled floors: the kitchen and the restrooms
export const TILED = [
  { x: 514, y: 175, w: 225, h: 77 },
  { x: 514, y: 252, w: 225, h: 124 },
];

export const WALLS_OUTER = 'M142 12 H926 V376 H670 V440 H586 V376 H298 V403 M161 403 V509 H298 V403 M161 403 V238 H142 V12';
export const WALLS_INNER = 'M206 12 V127 H514 V12 M324 12 V127 M514 12 V376 M552 12 V175 M514 175 H739 M514 252 H739 M628 252 V376 M739 12 V376 M806 12 V141 H926 M406 288 V376 M161 384 H298';
export const WALLS_INNER_2 = 'M566 252 V300 H628';
export const GLASS = 'M206 127 H324 M326 127 H514 M406 288 H514';
export const DOORS = 'M142 40 V70 M514 200 V228 M739 200 V228 M300 127 V127';

export const LABELS = [
  ['LOBBY', 22, 36],
  ['LIFT', 56, 128],
  ['MICHAEL', 214, 30],
  ['CONFERENCE ROOM', 334, 30],
  ['STAIRS', 560, 30],
  ['KITCHEN', 522, 192],
  ['MEN', 522, 368],
  ['WOMEN', 636, 368],
  ['ANNEX', 748, 30],
  ['BREAK ROOM', 814, 30],
  ['RECEPTION', 166, 170],
  ['ACCOUNTING', 166, 376],
  ['DARRYL', 414, 306],
  ['SUPPLIES', 166, 424],
];

// Desks: [x, y, w, h] on the plan, who sits there, and which side their
// chair is on (n, s, e, w). Michael's is his cherry executive desk.
export const DESKS = [
  { at: [242, 44, 56, 24], who: 'michael', seat: 'n', exec: true },
  { at: [269, 181, 53, 24], who: 'jim', seat: 'n' },
  { at: [269, 206, 26, 55], who: 'pam', seat: 'w' },
  { at: [296, 206, 26, 55], who: 'dwight', seat: 'e' },
  { at: [382, 181, 53, 24], who: 'andy', seat: 'n' },
  { at: [382, 206, 26, 55], who: 'phyllis', seat: 'w' },
  { at: [409, 206, 26, 55], who: 'stanley', seat: 'e' },
  { at: [167, 290, 54, 26], who: 'angela', seat: 'n' },
  { at: [167, 317, 54, 26], who: 'kevin', seat: 's' },
  { at: [222, 284, 26, 59], who: 'oscar', seat: 'e' },
  { at: [312, 316, 27, 55], who: 'meredith', seat: 'w' },
  { at: [340, 316, 27, 55], who: 'creed', seat: 'e' },
  { at: [436, 322, 56, 24], who: 'darryl', seat: 's' },
  { at: [580, 276, 32, 20], who: 'ryan', seat: 's' },
  { at: [806, 140, 56, 26], who: null, seat: 's' },
  { at: [806, 186, 27, 68], who: null, seat: 'e' },
  { at: [896, 244, 26, 54], who: 'toby', seat: 'w' },
  { at: [870, 340, 52, 24], who: 'kelly', seat: 'n' },
];
// Other furniture on the plan
export const CONFERENCE_TABLE = { x: 352, y: 48, w: 118, h: 38 };
export const RECEPTION = 'M162 178 h52 v42 h-14 v-28 h-38 Z';
export const RECEPTION_BOX = { x: 162, y: 178, w: 52, h: 42 };
export const KITCHEN_TABLE = { x: 677, y: 206, r: 16 };
export const KITCHEN_COUNTER = { x: 520, y: 180, w: 58, h: 12 };
export const BREAK_TABLES = [
  [842, 44],
  [866, 70],
  [842, 96],
];
export const STAIRS = { x0: 560, x1: 730, y0: 30, step: 22, n: 6 };

// The straight runs of an M/H/V path, as [x0, y0, x1, y1] segments.
export function segments(d) {
  const out = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const tokens = d.match(/[MHVhvZz]|-?\d+(?:\.\d+)?/g) || [];
  let i = 0;
  while (i < tokens.length) {
    const c = tokens[i++];
    if (c === 'M') {
      x = sx = Number(tokens[i++]);
      y = sy = Number(tokens[i++]);
    } else if (c === 'H' || c === 'h') {
      const nx = c === 'H' ? Number(tokens[i++]) : x + Number(tokens[i++]);
      out.push([x, y, nx, y]);
      x = nx;
    } else if (c === 'V' || c === 'v') {
      const ny = c === 'V' ? Number(tokens[i++]) : y + Number(tokens[i++]);
      out.push([x, y, x, ny]);
      y = ny;
    } else if (c === 'Z' || c === 'z') {
      if (x !== sx || y !== sy) out.push([x, y, sx, sy]);
      x = sx;
      y = sy;
    }
  }
  return out.filter(([a, b, c2, d2]) => a !== c2 || b !== d2);
}

// Walls with the doorways cut out of them: a doorway is a segment lying
// along a wall, and the wall is split around it.
export function wallRuns(d, doors = DOORS) {
  const cuts = segments(doors);
  const out = [];
  for (const s of segments(d)) {
    let pieces = [s];
    for (const c of cuts) {
      const next = [];
      for (const p of pieces) {
        const [x0, y0, x1, y1] = p;
        const horizontal = y0 === y1;
        const sameLine = horizontal ? c[1] === y0 && c[3] === y0 : c[0] === x0 && c[2] === x0;
        if (!sameLine) {
          next.push(p);
          continue;
        }
        const [a, b] = horizontal ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(y0, y1), Math.max(y0, y1)];
        const [ca, cb] = horizontal ? [Math.min(c[0], c[2]), Math.max(c[0], c[2])] : [Math.min(c[1], c[3]), Math.max(c[1], c[3])];
        if (cb <= a || ca >= b) {
          next.push(p);
          continue;
        }
        if (ca > a) next.push(horizontal ? [a, y0, ca, y0] : [x0, a, x0, ca]);
        if (cb < b) next.push(horizontal ? [cb, y0, b, y0] : [x0, cb, x0, b]);
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out;
}

// Plan units to metres on the floor, centred on the plan.
export const toWorld = (px, py) => ({ x: (px - PLAN.w / 2) * PLAN.metres, z: (py - PLAN.h / 2) * PLAN.metres });
