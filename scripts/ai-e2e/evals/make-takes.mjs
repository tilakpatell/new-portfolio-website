// How the hearing judge's labelled takes were made, so they can be made
// again or grown: from the voice lines the site already ships (each a
// judged best take, with its line known from export-lines.mjs), two short
// ones a speaker, a longer one of each as their reference, and two
// deliberate wrongs: one speaker's take labelled as another's (the right
// words in the wrong mouth), and a take played backwards (a mumble).
//
//   node scripts/ai-e2e/evals/make-takes.mjs     (ffmpeg on the PATH)

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mp3 } from '../assets/mp3.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const VOICED = join(ROOT, 'public', 'audio', 'voiced');
const OUT = join(HERE, 'takes');
const SPEAKERS = ['rick', 'morty', 'han', 'luke', 'walt', 'jesse'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'ai-e2e-takes-')), 'lines.json');
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'voices', 'export-lines.mjs'), '--out', tmp], { stdio: 'inherit' });
  const text = Object.fromEntries(JSON.parse(readFileSync(tmp, 'utf8')).map((l) => [l.id, l]));
  mkdirSync(join(OUT, 'refs'), { recursive: true });
  const labels = {};
  const seconds = (f) => mp3(readFileSync(f)).seconds;
  for (const who of SPEAKERS) {
    // the speaker's lines the site still says, shortest words first, so the pick is the same each time
    const lines = readdirSync(join(VOICED, who))
      .map((f) => ({ f, id: f.replace(/\.mp3$/, '') }))
      .filter((x) => text[x.id]?.who === who)
      .map((x) => ({ ...x, s: seconds(join(VOICED, who, x.f)), text: text[x.id].text }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const short = lines.filter((x) => x.s >= 2 && x.s <= 4).slice(0, 2);
    const ref = lines.find((x) => x.s > 4 && x.s <= 10);
    for (const [i, x] of short.entries()) {
      copyFileSync(join(VOICED, who, x.f), join(OUT, `${who}-${i + 1}.mp3`));
      labels[`${who}-${i + 1}.mp3`] = { who, text: x.text, good: true };
    }
    copyFileSync(join(VOICED, who, ref.f), join(OUT, 'refs', `${who}.mp3`));
  }
  // the wrongs: Han's words labelled as Morty's, and Rick's first take backwards
  copyFileSync(join(OUT, 'han-1.mp3'), join(OUT, 'wrong-voice.mp3'));
  labels['wrong-voice.mp3'] = { ...labels['han-1.mp3'], who: 'morty', good: false, note: 'Han saying it, labelled as Morty' };
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(OUT, 'rick-1.mp3'), '-af', 'areverse', join(OUT, 'mumbled.mp3')]);
  labels['mumbled.mp3'] = { ...labels['rick-1.mp3'], good: false, note: 'Rick’s take played backwards: the voice right, the words gone' };
  writeFileSync(join(OUT, 'labels.json'), `${JSON.stringify(labels, null, 1)}\n`);
  console.log(`${Object.keys(labels).length} takes, ${SPEAKERS.length} references → ${OUT}`);
}
