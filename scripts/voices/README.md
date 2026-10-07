# The crews' voices

Most of what the crews say on the universe map, in the galaxy and in the
cockpit has no recording, so it plays as blips. These scripts make those
lines in the speakers' own voices, cloned from a few seconds of each, and the
site plays a generated line wherever there's no clip, moves the speaker's
mouth with it, and falls back to the blips for anything not made.

The lines it makes (`public/audio/voiced/`, with the `manifest.json` the
site looks them up in) are committed and go out with the site. What it
makes along the way stays on this machine: `scripts/voices/cache/`,
`scripts/voices/refs/` (the reference recordings) and `lines.json` are
git-ignored. To serve the lines from somewhere else (behind a sign-in, say),
build with `VITE_VOICED_BASE` set to that folder's URL path.

## Whose lines

The crews on the universe map, in the galaxy, the cockpit and on the
ground, and the worlds' people: Middle-earth's towns, the Office and the
Citadel (their conversations, through `TownHud`'s `Convo`), Metherria's
customers, the Avengers compound and Cybertron's bots. Each says its lines
through `useVoiced` (src/lib/useVoiced.js); `voiceOf` in src/lib/voiced.js
says who sounds like whom and who has no voice. A voice in
`export-lines.mjs`'s lists with no reference yet just stays quiet.

A world wires its people in by itself, with no change here: a
`voicelines.js` beside its data exports `VOICELINES`, a list of
`{ who, text }` with each line exactly as the world passes it to
`useVoiced` or `sayVoiced`. `export-lines.mjs` reads every `voicelines.js`
under `src/`, and `generate.py` makes the lines of every voice with a
reference. The new voices' searches and quotes go in
`sources/<world>.json`, in the same shape as `sources.json` (grab.py reads
them all).

## How

1. **References** (`grab.py`). For each voice it gathers candidates (the
   site's clips of them, and the scenes YouTube finds for the searches in
   `sources.json`), takes the music and effects out, cuts the speech into
   utterances, works out which are the speaker (voiceprints seeded from the
   site's clips and from utterances saying their known quotes) and keeps the
   best few seconds of one scene: `refs/<who>.wav` and its transcript
   `refs/<who>.txt`.
2. **Lines** (`generate.py`). Each line is said several times by the
   voice's engine, and a judge listens to every take: Whisper for the words,
   WavLM voiceprints for how like the reference it sounds, UTMOS for how
   natural. The best take becomes `public/audio/voiced/<who>/<id>.mp3`.

## Setup (once)

1. Python 3.12 and ffmpeg (`winget install Python.Python.3.12 Gyan.FFmpeg astral-sh.uv`).
2. The pipeline's venv, with the CUDA 12.8 build of PyTorch (an RTX 50-series card needs 12.8 or newer):

   ```
   uv venv ~/.venvs/voices --python 3.12
   uv pip install --python ~/.venvs/voices/Scripts/python.exe --index-url https://pypi.org/simple --extra-index-url https://download.pytorch.org/whl/cu128 --index-strategy unsafe-best-match "torch==2.8.0+cu128" "torchaudio==2.8.0+cu128" f5-tts==1.1.22 "audio-separator[gpu]==0.47.0" audioread jiwer yt-dlp torchmetrics silero-vad
   ```

   Leave `torchcodec` out of it (transformers picks it up when it's there,
   and it doesn't load against winget's ffmpeg).
3. The engines, each in a venv of its own: [engines/README.md](engines/README.md).

The first runs download Whisper, the separator, the voiceprint model and each
engine's weights (several GB in all).

## Making the lines

With the venv's Python (`~/.venvs/voices/Scripts/python.exe`):

```
npm run voices:lines                          # the lines with no recording (again after editing any)
python scripts/voices/grab.py                 # each voice's reference; read cache/grab/report.md
python scripts/voices/design.py               # the references of the voices with only a "design"
python scripts/voices/generate.py --check     # the references, their transcripts and engines
python scripts/voices/generate.py --bakeoff 6 # every engine on 6 lines a voice: which is best for whom
python scripts/voices/generate.py             # make everything that's missing
```

`--only walt,jesse` does just those speakers, `--limit 10` a few lines,
`--takes 6` more takes to choose from, `--force` makes lines again. Both
scripts cache what they've done, so a rerun picks up where one stopped.

## Getting a voice right

- **A character with no voice to clone** (the site's own villagers, say):
  give them `"design"` in their sources, a sentence on how they sound
  (`"an elderly woman from a seaside village, warm and slow, a little
  hoarse"`). `design.py` has Qwen3-TTS VoiceDesign say a few of their own
  lines in that voice, keeps the take the judge hears best as their
  reference, and grab.py leaves them be.

- **The reference.** `cache/grab/report.md` shows what was chosen and the
  runners-up with their scores, and `cache/grab/listen/<who>/` has them to
  hear. A wrong source or segment goes in the voice's `"exclude"` in
  `sources.json` (`"yt-<id>"` or `"yt-<id>@<start>"`); `--pick
  who=source@start` takes the ones you name. To use your own instead, put 5
  to 11 seconds of the character talking, with no music, at
  `refs/<who>.wav`: grab.py leaves it alone and generate.py transcribes it.
- **More to choose from.** Add searches, quotes or `"urls"` to the voice in
  `sources.json`. Luke is the original trilogy's only.
- **YouTube** sometimes wants this machine to sign in; grab.py then fetches
  with YouTube's Android client, which still works without one.
- **The engine.** `--bakeoff` says which engine does each voice best; put it
  in `refs.json` as `"engine"`. `"speed"` there slows or speeds an F5-TTS voice.
- **Transcripts.** The clone follows the reference's transcript. If
  `--check` shows it misheard, correct `refs/<who>.txt` and run again.
- **A bad line.** `cache/takes/report.md` lists the lines whose best take
  still didn't pass. Delete a line's mp3 and run again for new takes.

## From anywhere: a `voices` issue

The desktop makes the lines; any other session (a cloud one, a phone) asks
for them. `scripts/desktop/README.md` has the whole picture:

```
node scripts/desktop/ask.mjs voices citadel --only rick,morty --line "rick: Wubba lubba dub dub." --line "morty: Aw geez, Rick."
```

or Actions → *voices* → *Run workflow*, or a new issue from the *Voice
lines* form. Each one is an issue labelled **`voices`**, and its body is
optional:

```
only: rick, morty            (just these speakers; else everyone with a voice)
rick: Wubba lubba dub dub.   (a line to make ahead of the code that will say it: who: text, one a line)
morty: Aw geez, Rick.
```

The desktop's self-hosted runner makes every line the site says that has
no recording yet, opens a pull request with the recordings and the
manifest, comments on the issue and closes it. It waits for the GPU if a
long run holds it.

So a session adding lines to a world either merges its code to main and
asks with no lines, or lists the lines first and wires them once the PR
lands (the id is the same either way: `lineId(who, text)` in
src/lib/voiced.js). A speaker with no reference voice is reported back, not
made: that needs the owner, with `grab.py`, or five to eleven seconds of
them at `refs/<who>.wav` and the transcript beside it, plus the name in
`export-lines.mjs`'s lists and `voiceOf`. A failure is commented with the
log's tail and labelled `voices:failed`: fix the issue, then remove the
label to try again.

On the desktop, the jobs run in their own checkout beside the repository
(`<repo>-voices`). The references and the takes cache are in
`%LOCALAPPDATA%\voices\` (`VOICES_REFS`, `VOICES_CACHE`), or the Claude
app's boxed copy of it, which the runner finds too. The TTS venv is at
`~/.venvs/voices` (`VOICES_PYTHON` for another). The gen3d jobs share the
GPU, one job at a time.
