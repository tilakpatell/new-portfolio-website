# The crews' voices

Most of what the crews say on the universe map, in the galaxy and in the
cockpit has no recording, so it plays as blips. These scripts make those
lines in the speakers' own voices, cloned from a few seconds of each, and the
site plays a generated line wherever there's no clip, moves the speaker's
mouth with it, and falls back to the blips for anything not made.

Everything generated stays on this machine. `public/audio/voiced/`,
`scripts/voices/cache/`, `scripts/voices/refs/` and `lines.json` are
git-ignored, and every build leaves `public/audio/voiced/` out (see
`vite.config.js`), so neither the public repository nor GitHub Pages ever
carries the cloned voices. You hear them with `npm run dev` here, or by
serving the folder from behind the sign-in and building with
`VITE_VOICED_BASE` set to its URL path (say `/private/voiced`).

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
python scripts/voices/generate.py --check     # the references, their transcripts and engines
python scripts/voices/generate.py --bakeoff 6 # every engine on 6 lines a voice: which is best for whom
python scripts/voices/generate.py             # make everything that's missing
```

`--only walt,jesse` does just those speakers, `--limit 10` a few lines,
`--takes 6` more takes to choose from, `--force` makes lines again. Both
scripts cache what they've done, so a rerun picks up where one stopped.

## Getting a voice right

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
