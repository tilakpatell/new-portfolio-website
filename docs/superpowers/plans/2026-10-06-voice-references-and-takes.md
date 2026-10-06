# Voice references and best-of-N takes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the crews' ~800 unrecorded lines in the highest-quality cloned voices this RTX 5090 can produce, starting from references built automatically out of real scene audio.

**Architecture:** Two stages. `grab.py` builds each voice's reference: it fetches candidate scene audio (the site's clips plus YouTube scenes found by search), takes the music out (MelBand RoFormer), cuts it into utterances (Whisper word times), finds the target speaker (WavLM-large ECAPA voiceprints seeded by the site's clips and by the character's known quotes), scores cleanliness and naturalness (DNSMOS, UTMOS), and writes `refs/<who>.wav` + `refs/<who>.txt` and a review report. `generate.py` then makes every line with the best engine for each voice, several takes per line, and keeps the take the judge likes best (Whisper WER, WavLM-ECAPA similarity to the reference, UTMOS). Each TTS engine runs as a worker script in its own venv, so their pinned dependencies never collide.

**Tech Stack:** Python 3.12, torch 2.8.0+cu128, F5-TTS 1.1.22, VoxCPM2, Qwen3-TTS-1.7B-Base, audio-separator 0.47 (RoFormer), transformers Whisper large-v3, F5-TTS's WavLM-large ECAPA (Seed-TTS-eval SIM), torchmetrics DNSMOS, UTMOS22, Silero VAD, yt-dlp; Node/Vite for the line export.

**Spec:** the prior session's brief (`Voice audio synthesis setup`): "install and run everything to synthesise HIGHEST quality audio voices"; "make reference-building its own stage: pulling multiple candidate clips per character, stripping music, isolating clean single-speaker segments, and scoring them to build the best reference audio".

## Global Constraints

- Generated audio, references, downloads and `lines.json` stay on this machine: `public/audio/voiced/`, `scripts/voices/cache/`, `scripts/voices/refs/`, `scripts/voices/lines.json` are git-ignored, and the build strips `audio/voiced` (existing `keepVoicedOut` in `vite.config.js`).
- Python venvs live under `~/.venvs/` (`voices` for the pipeline and judge; one per extra engine). Torch is `2.8.0+cu128` everywhere (Blackwell sm_120 needs CUDA 12.8+).
- No `torchcodec` in the `voices` venv (transformers imports it when present and it fails to load on this machine).
- Speaker similarity is WavLM-large ECAPA (`bezzam/wavlm_large_finetune_seed_tts_eval`, sha256 `51f07e3b94d9e0262a6a675ef5a087be3dd09e8c62e9d886827f44f82fe7f94b`), measured AUC 0.84 vs speechbrain ECAPA 0.72 on the site's clips.
- References are at most 11.5 s (F5-TTS cuts at 12 s and its transcript must describe the audio it keeps).
- Luke is original-trilogy Mark Hamill only: no sequel-trilogy sources.
- Line ids are `lineId(who, text)` from `src/lib/voiced.js`; manifest format `{"version": 1, "lines": {id: "who/id.mp3"}}` is unchanged.

## Review Focus

- A YouTube result that is a compilation of several characters: the reference must still be one speaker (each half of a chosen segment must match the voice; margin over every other crew voice).
- A voice with no site clip (Morty): bootstrap must come from quote-matched segments, and grab must stop with a clear message if no quote matches, not pick a random speaker.
- A take that drops or repeats words, or runs on: WER and words-per-second gates must reject it even if it sounds like the speaker.
- A rerun after an interrupt: downloads, separations, segment scores and takes are cached; nothing finished is redone.
- An engine venv missing: generate falls back to the next engine for that voice and says so.

---

### Task 1: Bring the prior session's shared modules over

**Files:**
- Create: `scripts/voices/common.py`, `scripts/voices/judge.py` (from the `crew-voices-hq` worktree, uncommitted there)
- Modify: `scripts/voices/export-lines.mjs` (Vite `runnerImport`, no vite-node), `package.json` (`voices:lines` runs `node`)

**Interfaces:**
- Produces: `common.read(f, sr=16000) -> np.ndarray`, `common.write(f, wav, sr)`, `common.ffmpeg()`, `common.speakable(text)`, `common.VOICED`, `common.ROOT/HERE/OUT/CACHE/REFS`; `judge.hear(wav, words=False)`, `judge.wer(meant, heard)`, `judge.voiceprint(wav) -> unit np.ndarray` (WavLM-large ECAPA), `judge.cleanliness(wav) -> {sig,bak,ovrl}`, `judge.naturalness(wav) -> float`, `judge.speech(wav)`, `judge.clipped(wav)`.

- [ ] Port files; switch `judge.voiceprint` to WavLM-large ECAPA (checkpoint by sha above, `f5_tts.eval.ecapa_tdnn.ECAPA_TDNN_SMALL(feat_dim=1024, feat_type="wavlm_large")`, `strict=False`).
- [ ] `npm run voices:lines` writes `lines.json` (expect 808 lines: han 144, hank 1, jesse 138, luke 131, morty 122, rick 133, walt 139).
- [ ] Commit.

### Task 2: Pure selection logic, test first

**Files:**
- Create: `scripts/voices/pick.py`, `scripts/voices/test_pick.py` (unittest; `python -m unittest discover -s scripts/voices -p "test_*.py"`)

**Interfaces:**
- Produces:
  - `utterances(words: list[(str, float, float)], gap=0.35, shortest=1.2, longest=11.5) -> list[(start, end, text)]`: split at pauses >= `gap` and at sentence ends when longer than `longest`; drop ones shorter than `shortest`.
  - `normal(text) -> str` (lowercase, letters/digits/apostrophes, single spaces); `quoted(text, quotes, at_least=0.8) -> str | None` (the quote a transcript contains, fuzzy, via `difflib.SequenceMatcher` over word windows).
  - `segment_score(sim, margin, ovrl, utmos, halves) -> float` = `sim + 0.5*margin + 0.15*(ovrl-3) + 0.1*(utmos-3) - 0.5*max(0, 0.35-halves)`.
  - `choose(segments: list[dict(source, start, end, score)], longest=11.5, enough=7.0, most=3) -> list[dict]`: best set of up to `most` segments from ONE source totalling <= `longest`, maximising duration-weighted mean score with a bonus for reaching `enough` seconds; falls back to the single best segment.
  - `take_score(wer, sim, utmos, wps) -> float | None`: None when `wer > 0.34` or words-per-second outside 0.8..6.0; else `sim + 0.15*(utmos-3) - 1.5*wer`.

- [ ] Write tests: splitting at a 0.5 s pause; a 14 s run splits at a sentence end; a 0.8 s utterance dropped; `quoted("well nobody exists on purpose morty", ["Nobody exists on purpose."])` returns the quote, unrelated text returns None; `choose` keeps one source and stays <= 11.5 s; `take_score` rejects wer 0.5 and wps 9.
- [ ] Run tests (fail), implement, run tests (pass). Commit.

### Task 3: grab.py, the reference builder

**Files:**
- Create: `scripts/voices/grab.py`, `scripts/voices/sources.json`
- Modify: `.gitignore` (nothing new: cache/refs already ignored), `package.json` (`voices:grab`)

**Interfaces:**
- Consumes: Task 1 and 2.
- Produces: `scripts/voices/refs/<who>.wav` (mono, 24 kHz+, <= 11.5 s), `scripts/voices/refs/<who>.txt` (Whisper transcript), `scripts/voices/cache/grab/report.md` (per voice: chosen segments and top 10 candidates with scores and file paths), `cache/grab/<who>/segments.json`.
- `sources.json`: `{who: {"clips": [site clip paths], "quotes": [...], "search": [yt queries], "urls": [...], "exclude": [video ids or "id@start"]}}`.

- [ ] Fetch: `yt-dlp` flat search (`ytsearch{n}:`), skip > 8 min and excluded ids, download `bestaudio` into `cache/grab/<who>/raw/`; cached.
- [ ] Separate: `vocals_mel_band_roformer.ckpt` (audio-separator), cached per source.
- [ ] Cut and score: Whisper words -> `utterances`; voiceprint, halves similarity, DNSMOS, UTMOS, clipping; cached per source in `segments.json`.
- [ ] Find the speaker: seed centroid from site clips + `quoted` segments; refine twice from top-8 segments with positive margin; margin vs other voices' centroids.
- [ ] Choose and write reference + transcript + report. `--only`, `--refresh`, `--pick who=source@start`.
- [ ] Run for all seven voices; read the report; fix `sources.json` excludes until each reference is one clean speaker. Commit code (not audio).

### Task 4: Engines as workers, and a bake-off

**Files:**
- Create: `scripts/voices/engines/f5.py`, `scripts/voices/engines/voxcpm.py`, `scripts/voices/engines/qwen.py`, `scripts/voices/engines/README.md` (setup per venv), `scripts/voices/bakeoff.py`
- Modify: `scripts/voices/refs.json` (per voice `"engine"`; `clips` move to `sources.json`)

**Interfaces:**
- Worker contract: `python engines/<name>.py JOBS.json`; JOBS = `{"voices": {who: {"wav", "text"}}, "items": [{"who", "text", "out", "seed"}]}`; writes each `out` wav, prints `ok <out>` per item, skips existing `out`.
- `engines.python(name) -> str`: `$VOICES_PY_<NAME>` or `~/.venvs/<name>/Scripts/python.exe` (or `bin/python`) if it exists, else None (engine unavailable).
- `bakeoff.py --lines 6 --takes 2`: same sample per voice through every available engine, judged, prints per voice/engine mean SIM, WER, UTMOS and pass rate, writes `cache/bakeoff.json` with the winner per voice.

- [ ] Venvs: `~/.venvs/voxcpm` (`voxcpm`), `~/.venvs/qwen` (`qwen-tts`), torch 2.8.0+cu128 in each; smoke each worker on one line.
- [ ] Bake-off; set `"engine"` per voice from the winner. Commit.

### Task 5: generate.py, best of N takes

**Files:**
- Modify: `scripts/voices/generate.py`, `scripts/voices/README.md`

**Interfaces:**
- Consumes: Tasks 1-4. Takes cached at `cache/takes/<engine>/<who>/<id>.<k>.wav`, scores in `cache/takes/scores.jsonl`.
- CLI: `--only`, `--limit`, `--force`, `--takes N` (default 4), `--engine` (override), `--check`. Output mp3: loudnorm I=-16 TP=-1.5, 44.1 kHz 96k when the engine makes >= 44.1 kHz, else 24 kHz 64k; manifest rewritten every 20 lines and at the end; `cache/takes/report.md` lists lines whose best take still failed the gates.

- [ ] Implement; `--limit 10` smoke; listen-free check: all 10 pass gates.
- [ ] Full run (all voices); report counts; re-take failures with more takes.
- [ ] README rewritten for the two stages; commit; PR.
