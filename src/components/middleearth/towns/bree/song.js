// On the side: a song on the table. In the book it's Frodo, not Pippin, who
// gets up on the table in the Prancing Pony, and he sings Bilbo's silly song
// about the Man in the Moon. Here the hobbits keep time for him: stamp on
// the table and clap as each beat comes down to the line. Keep the room with
// you to the end of the verse and they roar for more; lose them, and your
// foot goes from under you.
//
// Time is in seconds from the first note of the count-in. The chart is in
// quavers (eighth notes), sixteen to a line of the verse: `s` a stamp, `c` a
// clap, `.` neither. The tune (MIDI notes, or null for a rest) is for the
// fiddle in ./sounds.js; it's an old-fashioned jig made up for this, not
// anyone's recording.

// the task, for the list: on the side, so the story never waits on it
export const SIDE = { id: 'song', name: 'The Man in the Moon', where: 'The hobbits’ table, in the Pony', blurb: 'Get up on the table and sing Bilbo’s song, with the hobbits keeping time.', seal: 'maninthemoon' };

export const SONG = {
  bpm: 112,
  count: 16, // quavers of fiddle before the singing starts
  good: 0.09, // seconds either side of the beat: spot on
  ok: 0.17, // near enough
  need: 0.7, // of the best you could do, to bring the house down
  start: 0.5, // the room's mood when you get up
  lift: 0.07, // a good one cheers them
  lift2: 0.035, // a near one, a little
  drop: 0.11, // a missed one costs
  stray: 0.05, // and so does stamping out of time
};
export const QUAVER = 60 / SONG.bpm / 2;

export const VERSE = [
  { words: 'There is an inn, a merry old inn', chart: 's...c...s...c...', tune: [69, null, 74, 74, 74, null, 76, 78, 76, null, 74, null, 78, null, 81, null] },
  { words: 'beneath an old grey hill,', chart: 's...c...s.c.s...', tune: [81, null, 79, 78, 76, null, 74, null, 76, null, null, null, 69, null, null, null] },
  { words: 'And there they brew a beer so brown', chart: 's.c.s.c.s.c.s.c.', tune: [69, 74, 74, 74, 78, 78, 81, 81, 79, 78, 76, null, 78, null, 74, null] },
  { words: 'That the Man in the Moon himself came down', chart: 's.c.ssc.s.c.ssc.', tune: [81, 81, 83, 81, 79, 78, 76, 78, 79, 81, 79, 78, 76, null, 73, null] },
  { words: 'one night to drink his fill.', chart: 's.c.s.c.ssc.s...', tune: [69, null, 74, 76, 78, null, 76, 74, 76, null, 73, null, 74, null, null, null] },
];
export const LANES = ['stamp', 'clap'];

// every note to hit: { t, lane (0 stamp, 1 clap), line }
export const NOTES = VERSE.flatMap((v, line) =>
  [...v.chart].flatMap((ch, q) => (ch === 's' || ch === 'c' ? [{ t: (SONG.count + line * 16 + q) * QUAVER, lane: ch === 's' ? 0 : 1, line }] : [])),
);
export const LENGTH = (SONG.count + VERSE.length * 16 + 4) * QUAVER;

export const newSong = () => ({ t: 0, cheer: SONG.start, hit: NOTES.map(() => null), line: -1, state: 'on' });

// how well it's gone so far, 0…1 of the best you could do
export const score = (song) => song.hit.reduce((n, h) => n + (h === 'good' ? 1 : h === 'ok' ? 0.5 : 0), 0) / NOTES.length;

// A stamp (lane 0) or a clap (lane 1) at time `t`: { how: 'good' | 'ok' |
// 'stray', i } — the nearest note in that lane not yet judged.
export function press(song, lane, t = song.t) {
  if (song.state !== 'on') return null;
  let best = -1;
  let bestD = Infinity;
  NOTES.forEach((n, i) => {
    if (n.lane !== lane || song.hit[i]) return;
    const d = Math.abs(n.t - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0 || bestD > SONG.ok) {
    song.cheer = Math.max(0, song.cheer - SONG.stray);
    return { how: 'stray', i: -1 };
  }
  const how = bestD <= SONG.good ? 'good' : 'ok';
  song.hit[best] = how;
  song.cheer = Math.min(1, song.cheer + (how === 'good' ? SONG.lift : SONG.lift2));
  return { how, i: best };
}

// The song moves on to time `t`: events 'line' { line } as each line of the
// verse starts, 'miss' { i } for each note let go by, then 'won', 'flat'
// (not enough of them in time: the room goes back to its beer) or 'fell'
// (the room's lost, and so's your footing).
export function stepSong(song, t) {
  const ev = [];
  if (song.state !== 'on') return ev;
  song.t = t;
  const line = Math.floor((t / QUAVER - SONG.count) / 16);
  if (line > song.line && line >= 0 && line < VERSE.length) {
    song.line = line;
    ev.push({ type: 'line', line });
  }
  NOTES.forEach((n, i) => {
    if (song.hit[i] || t - n.t <= SONG.ok) return;
    song.hit[i] = 'miss';
    song.cheer = Math.max(0, song.cheer - SONG.drop);
    ev.push({ type: 'miss', i });
  });
  if (song.cheer <= 0) {
    song.state = 'fell';
    ev.push({ type: 'fell' });
  } else if (t >= LENGTH) {
    song.state = score(song) >= SONG.need ? 'won' : 'flat';
    ev.push({ type: song.state });
  }
  return ev;
}
