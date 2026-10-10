// A sprite sheet's frames: how many across and down the game's name says
// it holds, and where in the sheet frame n is. Pure; the effects that draw
// a sheet (./marks.js, ./gameLook.js's sheets) read their frames from here.
//
// The game names a sheet's grid three ways: `_5x1_` (columns by rows),
// `_8x64_` (8 across and 64 frames, so 8 rows: a count, which is how its
// smoke and fire loops say it) and `Anim8x4o32` (8 by 4, 32 of them). A
// second number of 16 or more is a count, as no sheet of the game's has 16
// rows. A name that says nothing is one frame. Where the name and the
// pixels disagree (the metal scorch's `2x4` is four marks in a 2 by 2),
// the effect table's own `grid` wins: gameLook.js's entries carry one.
//
// gridFromName(name) → [columns, rows]
// frameUv([columns, rows], n) → { offset: [u, v], repeat: [u, v] }: frame n
//   counted left to right from the top row down, wrapped, whole frames only
// frameAt(k, frames, { loop }) → the frame `k` (0…1) of the way through a
//   life, held on the last after it (or round again, looping)

const COUNT = 16; // a second number this big or more is a count of frames

export function gridFromName(name) {
  const last = String(name ?? '')
    .split('/')
    .pop()
    .toLowerCase();
  const of = /(\d+)x(\d+)o(\d+)/.exec(last);
  if (of) return [Number(of[1]), Number(of[2])];
  const m = /(?:^|[_a-z])(\d+)x(\d+)(?=_|$)/.exec(last);
  if (!m) return [1, 1];
  const cols = Number(m[1]);
  const second = Number(m[2]);
  if (!cols || !second) return [1, 1];
  return second >= COUNT ? [cols, Math.max(1, Math.ceil(second / cols))] : [cols, second];
}

export function frameUv([cols, rows], n) {
  const frames = cols * rows;
  const i = ((Math.floor(n) % frames) + frames) % frames;
  const col = i % cols;
  const row = Math.floor(i / cols);
  // (uv's v runs up, the sheet's rows run down)
  return { offset: [col / cols, (rows - 1 - row) / rows], repeat: [1 / cols, 1 / rows] };
}

export function frameAt(k, frames, { loop = false } = {}) {
  if (loop) return ((Math.floor(k * frames) % frames) + frames) % frames;
  return Math.min(frames - 1, Math.max(0, Math.floor(k * frames)));
}
