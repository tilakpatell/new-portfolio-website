// Hand-designed courses for Super Tilak Land, built from authored chunks.
// Rows 2–17 of an 18-row screen; ground is rows 16–17.
//
//   #  ground        B  brick        ?  coin block    M  mushroom block
//   H  hard block    [ ] pipe top    ( ) pipe body    =  bridge
//   o  coin          g  walker       k  shell turtle  L  lava
//   f  firebar block X  axe          F  flag base     C  castle

const chunk = (w, rows = {}, ground = null) => ({ w, rows, ground: ground ?? '#'.repeat(w) });

// ─── Overground ─────────────────────────────────────────────────────────────
const O = {
  start: chunk(18),
  firstQ: chunk(20, {
    7: '..........?.........',
    11: '......?...BMB?B.....',
    15: '..............g.....',
  }),
  pipes: chunk(34, {
    12: '........................[]........',
    13: '.............[].........()........',
    14: '....[].......().........()........',
    15: '....()...g...()....g.g..()........',
  }),
  gap: chunk(14, { 10: '.....ooo......' }, '#####...######'),
  bricks: chunk(26, {
    6: '..........oooo............',
    7: '........BBBBBBBB..........',
    11: '....?.............B?B.....',
    15: '.........g.g..............',
  }),
  koopa: chunk(20, {
    11: '......?.?.?.........',
    14: '..............[]....',
    15: '..........k...()....',
  }),
  stairs: chunk(24, {
    12: '.....H..H...............',
    13: '....HH..HH..............',
    14: '...HHH..HHH.............',
    15: '..HHHH..HHHH............',
  }, '######..################'),
  coins: chunk(18, {
    10: '....oooooo........',
    11: '...o......o.......',
    12: '..o........o......',
    15: '.........g.g......',
  }),
  bricks2: chunk(24, {
    7: '...BBB?BBB..............',
    11: '..........B?BMB.........',
    15: '...g..........k.........',
  }),
  end: chunk(40, {
    8: '.........H..............................',
    9: '........HH..............................',
    10: '.......HHH..............................',
    11: '......HHHH..............................',
    12: '.....HHHHH..............................',
    13: '....HHHHHH..............................',
    14: '...HHHHHHH..............................',
    15: '..HHHHHHHH........F.......C.............',
  }),
};

// ─── Underground ────────────────────────────────────────────────────────────
const ceil = (w) => 'B'.repeat(w);
const U = {
  start: chunk(18, { 2: '....' + ceil(14), 3: '....' + ceil(14) }),
  walls: chunk(26, {
    2: ceil(26),
    3: ceil(26),
    9: '......oooo....oooo........',
    10: '......BBBB....BBBB........',
    13: '..B......................B',
    14: '..B.........g............B',
    15: '..B......g.........k......',
  }),
  coins: chunk(22, {
    2: ceil(22),
    3: ceil(22),
    8: '....oooooooooo........',
    9: '....BBBBBBBBBB........',
    11: '..........M...........',
    15: '.....g....g.....g.....',
  }),
  gap: chunk(16, { 2: ceil(16), 3: ceil(16), 6: '.....ooo........', 7: '....BBBBB.......' }, '#####...########'),
  pipes: chunk(24, {
    2: ceil(24),
    3: ceil(24),
    12: '..........[]............',
    13: '...[].....()......[]....',
    14: '...().....()......()....',
    15: '...()..g..()..k...()....',
  }),
  end: chunk(40, {
    9: '.........H..............................',
    10: '........HH..............................',
    11: '.......HHH..............................',
    12: '......HHHH..............................',
    13: '.....HHHHH..............................',
    14: '....HHHHHH..............................',
    15: '...HHHHHHH........F.......C.............',
  }),
};

// ─── Sky ────────────────────────────────────────────────────────────────────
const none = (w) => '.'.repeat(w);
const S = {
  start: chunk(16),
  plats: chunk(32, {
    8: '.................oooo...........',
    9: '................HHHHHH..........',
    10: '..........o.o...................',
    11: '.........HHHHH...............o..',
    12: '..oo........g...............HHH.',
    13: '.HHHHHH.........................',
  }, none(32)),
  plats2: chunk(30, {
    8: '...........?..................',
    9: '................g.............',
    10: '..ooo..........HHHHHHH........',
    12: '.HHHHH...HHH..............HH..',
    13: '.........................HHH..',
  }, none(30)),
  plats3: chunk(30, {
    10: '.........HHHHHH...........M...',
    12: '..HHHH...........HHHH.........',
    13: '.....................HHHHH....',
    9: '..........oogo................',
  }, none(30)),
  land: chunk(12, {}, '############'),
  end: chunk(40, {
    11: '.......H................................',
    12: '......HH................................',
    13: '.....HHH................................',
    14: '....HHHH................................',
    15: '...HHHHH..........F.......C.............',
  }),
};

// ─── Castle ─────────────────────────────────────────────────────────────────
const stone = (w) => '#'.repeat(w);
const C = {
  start: chunk(16, { 2: stone(16), 3: stone(16), 4: stone(16), 12: '................', 13: '.......H........' }),
  lava: chunk(28, {
    2: stone(28),
    3: stone(28),
    11: '..........f.................',
    12: '.........HHH....HHHH........',
    15: '..........................g.',
  }, '#####LLLLLL####LLLLL########'),
  fire: chunk(26, {
    2: stone(26),
    3: stone(26),
    4: stone(26),
    5: '......####.......####.....',
    9: '..........f..........f....',
    10: '..........H..........H....',
    15: '...............g..........',
  }),
  bridge: chunk(40, {
    2: stone(40),
    3: stone(40),
    12: '...................................X....',
    13: '....=========================HHHHHHHHHHH',
    14: '.............................HHHHHHHHHHH',
    15: '.............................HHHHHHHHHHH',
  }, '####LLLLLLLLLLLLLLLLLLLLLLLLL###########'),
};

export const COURSES = [
  { name: '1-1', look: 'over', chunks: [O.start, O.firstQ, O.pipes, O.gap, O.bricks, O.koopa, O.stairs, O.coins, O.gap, O.bricks2, O.stairs, O.end] },
  { name: '1-2', look: 'under', chunks: [O.start, U.start, U.walls, U.coins, U.gap, U.pipes, U.walls, U.gap, U.coins, U.end] },
  { name: '1-3', look: 'sky', chunks: [S.start, S.plats, S.land, S.plats2, S.land, S.plats3, S.land, S.plats, S.end] },
  { name: '1-4', look: 'castle', chunks: [C.start, C.lava, C.fire, C.lava, C.fire, C.bridge, C.start] },
];

export const ROWS = 18;

// Lay the chunks side by side into one grid plus a list of spawns.
export function buildCourse(index) {
  const course = COURSES[index];
  const cols = course.chunks.reduce((n, c) => n + c.w, 0);
  const grid = Array.from({ length: ROWS }, () => Array(cols).fill('.'));
  let x0 = 0;
  for (const ch of course.chunks) {
    for (let c = 0; c < ch.w; c++) {
      const g = ch.ground[c] || '.';
      grid[16][x0 + c] = g;
      grid[17][x0 + c] = g;
    }
    for (const [row, str] of Object.entries(ch.rows)) {
      for (let c = 0; c < ch.w; c++) {
        const t = str[c];
        if (t && t !== '.') grid[Number(row)][x0 + c] = t;
      }
    }
    x0 += ch.w;
  }
  const spawns = { coins: [], walkers: [], turtles: [], firebars: [], flag: null, castle: null, axe: null };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === 'o') spawns.coins.push({ c, r });
      else if (t === 'g') spawns.walkers.push({ c, r });
      else if (t === 'k') spawns.turtles.push({ c, r });
      else if (t === 'F') spawns.flag = { c, r };
      else if (t === 'C') spawns.castle = { c, r };
      else if (t === 'X') spawns.axe = { c, r };
      if (t === 'f') {
        spawns.firebars.push({ c, r });
        grid[r][c] = 'H';
      } else if ('ogkCX'.includes(t)) grid[r][c] = '.';
      else if (t === 'F') grid[r][c] = 'H';
    }
  }
  return { ...course, cols, grid, spawns };
}
