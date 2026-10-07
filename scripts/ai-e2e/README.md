# Testing the AI and the models, end to end

Everything on the site that a model makes, judges or drives (the gen3d and
voices pipelines, their judges, the shipped models and voice lines, the
desktop jobs, the NPC brains, the autopilot) is tested here, from the request
to what a visitor sees. The design is
`docs/superpowers/specs/2026-10-07-ai-e2e-testing-design.md`.

What can run on a GitHub-hosted runner runs on every pull request; what needs
the GPU runs every night on the desktop's self-hosted runner and reports once.

```
 tier  name       command                  where                when
 ────  ─────────  ───────────────────────  ───────────────────  ────────────────────
  0    unit       npm test                 anywhere             every PR
  1    contract   npm run test:ai          ubuntu, no GPU       every PR
  2    assets     npm run test:ai          ubuntu               every PR
  3    render     npm run test:ai:render   ubuntu + Chromium    asset PRs, nightly
  4    sims       npm run test:ai          ubuntu               every PR
  5    evals      npm run test:ai:gpu      desktop GPU          nightly
  6    real       npm run test:ai:gpu      desktop GPU          nightly
  7    agent      npm run test:ai          ubuntu               every PR
```

`npm run test:ai` is a second vitest run (`vitest.ai.config.js`): every
`scripts/ai-e2e/**/*.test.mjs`, every `src/**/*.fuzz.test.js` and the brains'
`*.scenario.test.js`. `npm test` leaves all of those out, so it stays fast.
One folder alone: `npx vitest run --config vitest.ai.config.js scripts/ai-e2e/fakes`.

## The fakes

Each stands behind a seam the real pipeline already has, so a contract test
runs the real orchestration with only the engine swapped.

| knob | stands in for | what it does |
| --- | --- | --- |
| `GEN3D_ENGINE=fake` | TRELLIS.2, Hunyuan3D (`generate.mjs`) | `fakes/engine.mjs`: a textured box GLB (12 triangles, a 64² PNG) from the pictures' bytes and the seed, byte-identical for the same input |
| `GEN3D_JUDGE=fake` | the vision judge (`vlm.mjs`) | answers from `GEN3D_JUDGE_SCRIPT`, a JSON array of `{ match, reply }`; the first entry whose `match` is in the prompt or an image's path answers; a list of replies is given in turn; every call goes to `calls.json` beside the script |
| `GEN3D_PICTURE=fake` | stable-diffusion.cpp (`picture.mjs`) | `fakes/picture.mjs`: a grey box on white, 1024², one pixel set by the seed so candidates differ |
| `BLENDER=scripts/ai-e2e/fakes/blender.mjs` | the Blender bake (`bake.mjs`) | copies the raw GLB to the baked one: the plumbing, not the pixels |
| `GH_BIN=scripts/ai-e2e/fakes/gh.mjs` | `gh` (`scripts/desktop/lib.mjs`) | writes every call's argv to `GH_LOG` (a JSON array) and answers from `GH_FIXTURES/<first>-<second>.json` (`pr-create.json`, `label-list.json`) or `api.json` (keyed by path); `GH_FAIL=pr-create` makes that command fail |

| `GEN3D_SHEET=fake` | the judging sheet's renders (`judge.mjs`) | a blank sheet of the right size, no browser |
| `GEN3D_OUT=dir` | the repository's `public/` (`web.mjs`) | where `public/models/gen3d/` and `public/games/credits.json` are written, so a test or a health run never writes into the repository's own |

With `GEN3D_ENGINE=fake`, the engine an issue or `--engine` asks for is
passed to the fake as `--asked` instead of being run, with `--res`, `--fov`
and `--faithful`, so a test can read back what reached the engine.

The fakes share knobs (`fakes/common.mjs`):

- `GEN3D_FAKE_FAIL_AT=generate|bake|picture`: that fake exits 1 (the engine
  after writing half its file, as a crash would), so a test can kill a run
  at a step and watch the next one resume there.
- `GEN3D_FAKE_TRIS=N` (or the engine's `--tris N`): a grid of at least N
  triangles, so a budget test can overshoot.
- `GEN3D_FAKE_TEX=N`: the engine's texture is N² (64 otherwise), so a test
  can see `--tex` cap it.
- `GEN3D_FAKE_NOISE=K`: K more parts, each with a 2048² texture of noise
  that no encoder can shrink, so a model comes out too heavy to ship (the
  simplifier can bring any mesh to its triangle count, so weight is what
  overshoots in practice).
- `GEN3D_FAKE_SLEEP=S`: each fake waits first, for the timeout paths.
- `GEN3D_FAKE_LOG=file`: each fake appends `{ tool, argv }` as a line of JSON.

## Tier 1: the pipelines with fake engines

`contract/repo.mjs` gives a test a sandbox: a temporary folder with its own
cache, output root and runner home, every fake switched on, and, for the
runners, a temporary repository (the pipelines' files, the real
`node_modules` borrowed through a junction) with a bare `origin` beside it.
`serveFixtures()` serves `contract/fixtures/` over HTTP on a free port, so
an issue's picture link is fetched as it would be from GitHub, without
leaving the machine.

| file | what it proves |
| --- | --- |
| `contract/gen3d-make.test.mjs` | `make.mjs` makes three cuts within the budget asked for, credits the model, keeps `result.json`, the sheet and the log; `--tex` caps every texture; a prompt draws candidates and the judge picks; `GEN3D_OUT` keeps `public/` clean |
| `contract/gen3d-resume.test.mjs` | the raw model and the bake are reused when nothing changed, the run starts again at the bake when it died there, `--fresh` and a one-pixel change make all again |
| `contract/gen3d-judge.test.mjs` | a miss is made again once with the next seed; a second miss ships with its verdict; `--no-judge` asks nothing |
| `contract/gen3d-budget.test.mjs` | a model too heavy for its cut is refused in `budget.mjs`'s words, nothing credited |
| `contract/gen3d-runner.test.mjs` | an issue through the runner ends as a branch, a pull request with the sheet, verdict and cuts, a comment and a closed issue; every field reaches the pipeline; a bad field and a dead engine end as `gen3d:failed` with nothing pushed; four sides reach the engine at once |

| `contract/voices.test.mjs` | `export-lines.mjs` over a fixture `src/` tree (two worlds' `voicelines.js`) lists every line with the id `lineId()` gives in JavaScript; `generate.py` with the fake worker and ears makes an mp3 for each speaker with a reference, names the one without, marks the mumbled line doubtful, and writes a manifest the site finds each line in; the Python side's own tests of the fakes |
| `contract/voices-runner.test.mjs` | a voices issue through the runner ends as a branch and a pull request that counts the lines made and names who has no voice |

The voices tests need a Python with numpy and soundfile (the voices venv,
`VOICES_TEST_PYTHON`, or `python3` on the PATH) and ffmpeg. Without them
they skip and say why, except on CI, where the AI job installs both and a
missing one fails.

The voices fakes:

| knob | stands in for | what it does |
| --- | --- | --- |
| `VOICES_ENGINE=fake` | the TTS engines (`generate.py`'s `engines_for`) | `fakes/voices_worker.py`: each take a tone as long as its words take to say, and a sidecar (`<take>.said.json`) saying what was said and how alike the voice is; a line with the word “mumbles” comes out scrambled and in another voice |
| `VOICES_JUDGE=fake` | Whisper, WavLM, UTMOS (`common.ears()`) | `fakes/voices_judge.py`: hears the sidecar's words, similarity 0.9 (0.3 for a mumbled take), naturalness 4.0; no models, no torch |
| `VOICES_LINES_FROM=voicelines` | the site's own line lists (`export-lines.mjs`) | only the `voicelines.js` files under `src/`, for a fixture tree with none of the site's other lists |

(The marker is a word, not `[bad]`: the site's `spoken()` and the
pipeline's `speakable()` both drop bracketed asides, so a bracket never
reaches the worker.)

The fixtures: `x-wing-ref.png` (the site's X-wing rendered on white at
512², with `scripts/glb-shot.mjs`), issue bodies (`issue-*.md`, with
`{{BASE}}` where the picture server goes) and judge scripts (`judge-*.json`).

## Tier 2: the assets as shipped

Tests over the repository as it is, so a model or a voice line added by
hand is held to the same bar as a generated one.

| file | what it holds to |
| --- | --- |
| `assets/gen3d.test.mjs` | every `public/models/gen3d/<name>.glb` has its `.hq` and `.lo` cuts; each within its budget for the ask the cuts imply (`budget.mjs`'s `inferFaces`), and no less than a quarter of it (a smaller cut copied over); each under its tier's size cap; WebP textures no bigger than its tier's; meshopt; one scene; credited `gen3d/<name>` |
| `assets/credits.test.mjs` | every credit (`public/games/credits.json`, `src/data/modelCredits.json`, a folder's own `credits.json`) is for a file that exists; every GLB under `public/models/` has a credit, but those on `allow-uncredited.json` |
| `assets/voiced.test.mjs` | every mp3 in `public/audio/voiced/` is in the manifest and every entry is a file; each is a run of real MPEG frames (`mp3.mjs`) between 0.3 and 30 s; each is a line the site still says (`export-lines.mjs --out`); every speaker with lines has a folder, but those on `allow-voiceless.json` |

`assets/glb.mjs`'s `inspect(file)` reads a GLB as the site's loader would
(meshopt decoded): triangles, bytes, textures, extensions, scenes, the
bounding box. `assets/credits.mjs` says which file each credit is for,
since none of the three lists names its file outright.

**The allow-lists are findings.** `allow-uncredited.json`,
`allow-orphans.json` (mp3s the manifest doesn't list; lines the site no
longer says) and `allow-voiceless.json` hold what was wrong when the tests
were first run. They only shrink: an entry fixed since fails the test
until it is taken off.

## Tier 3: every model draws

`npm run test:ai:render` (`vitest.render.config.js`, every
`*.render.test.mjs`): each gen3d cut rendered the way the judge renders it
(`scripts/glb-shot.mjs`: headless Chromium, SwiftShader, a dev server on a
free port, `render/server.mjs`), the three-quarter view at 320×240. Each
must leave no page or console error outside `scripts/lib/noise.mjs`'s
`NOISE` (what every software renderer says) and cover at least 4% of the
frame (`render/coverage.mjs`: pixels farther than a few levels from the
corner's colour). A framed model covers far more (the X-wing, all wings
and gaps, about 10%; a TIE about 30%); a blank canvas, or a model loaded
as a speck, covers less. The PNGs and `results.json` go to `render/out/`
(git-ignored; CI uploads them as the `renders` artifact).

`AI_RENDER_ALL=1` (the nightly) renders every GLB under `public/models/`,
in the plain look and the toon look the galaxy draws figures with.

The browser: `CHROME`, else the Chromium `npx playwright install chromium`
installs, else Edge on Windows. Without one the tier skips and says so,
except on CI. CI's AI job runs it only when the pull request touches
`public/models/`, `src/lib/three/`, `glb-shot` or the tier itself
(`render/changed.mjs`), installing the Chromium for the locked
`playwright-core` version, cached on that version.

## Tier 4: the brains, scripted and fuzzed

Beside the brains, in `npm run test:ai` (and out of `npm test` by name):

- `src/components/universe/npcs/brains/harness.js`: `meet()` flies a
  meeting with one brain frame by frame (a seeded random, you flown by a
  script, every frame's events and a `trace` two runs can be compared by);
  `simulate(rules, script)` does the same for any world's pure `rules.js`
  (`rules.step(state, input, dt)` → events).
- `<brain>.scenario.test.js`, one per brain, each holding the brain to the
  promise in its own header: the inspector comes alongside and lets a
  clean ship go, or calls its faction on one that runs; the nemesis fires
  only in range and no faster than its guns, and breaks off nearly dead;
  the merchant parks, offers once and never follows; the informant tips
  you off and goes; the rival duels and calls a draw; the trickster tolls,
  tips or fights; the tagalong rides your left wing, chats three times and
  hides from hunters; the bounty hunter and the wingman are handed over at
  once (and the wing holds formation round a lazy circle).
- `all.scenario.test.js`, over every brain: 200 seeded meetings each, with
  you flown by a script drawn from the seed, where no number goes NaN and
  the ship never turns or speeds up faster than its stats; the same seed
  flies the same meeting to the last bit; every brain ends its meeting (or
  parks, the merchant's ending) inside two minutes; a nemesis never holds
  one move for a minute.
- `src/lib/ai/toolkit.fuzz.test.js`: steering's heading is never longer
  than one; the chase's flood only ever names a walkable cell it can reach
  (checked by a plain flood fill); a place picked is the best scored, or
  the current one kept within its hysteresis; every live member is in
  exactly one squad of its side, and in exactly one of movers and cover; a
  belief with nothing more seen only fades; utility's pick is the top
  score, or with a rand and a spread one near the top, the same for the
  same rand.

A new brain gets a `<brain>.scenario.test.js` of its own, from its header;
`all.scenario.test.js` picks it up from `BRAINS` by itself.

## Tier 5: the judges still judge right (GPU, nightly)

A judge that drifts is the quietest failure in the whole system: an engine
update makes it stricter and good models are remade for ever, or softer
and bad ones ship. Each judge has a small labelled set and a line it must
stay above. `node scripts/ai-e2e/evals/run.mjs` runs both, every one even
when another fails, and writes `results/<date>-evals.json`.

- **Vision** (`evals/vision.mjs`): `vlm.judge()` over `evals/sheets/` (16
  four-view sheets, no captions: ten right models, and six deliberate
  wrongs: the wrong ship asked about, a sitar asked about as a guitar, the
  fake engine's box, an X-wing on its back) against `sheets/labels.json`,
  each a score band a fair judge falls in; and `vlm.pick()` over
  `evals/pick-sets/` (five sets of four, one the thing). It reports the
  share in band, the mean error to the band's middle and good/bad
  confusion, for every backend reachable (Claude Code, Qwen3-VL), each in a
  process of its own. The lines: 85% in band for Claude (the judge that
  gates a reseed), 70% for Qwen (a note, not a veto), and 80% of picks
  right for both. `results/<date>-vision.json`.
- **Hearing** (`scripts/voices/eval_judge.py`): the voices' ears over
  `evals/takes/` (twelve good takes, two of each of six speakers, from the
  lines the site ships; a speaker's words labelled as another's; a take
  played backwards) with `refs/<who>.mp3` for each speaker. The lines: the
  word error rate on the good takes at most 10%; the labelled speaker the
  most alike for 90%; every bad take under every good one on the score
  `generate.py` ranks takes by. `results/<date>-hearing.json`.

The sets are made by `evals/make-sheets.mjs` (Chromium, a dev server) and
`evals/make-takes.mjs` (ffmpeg), so they can be grown: add a model or a
take to the list, run the script, write its label by hand. Both evals have
a self-test against fixtures with the fake judge and ears
(`evals/vision.test.mjs`, `scripts/voices/test_eval_judge.py`), in
`npm run test:ai`.

`.github/workflows/ai-health.yml` runs on the desktop's `[self-hosted, gpu]`
runner at 04:00 UTC and on demand (`gh workflow run ai-health.yml`): the
doctor (what the runner can see), every model rendered in both looks
(`AI_RENDER_ALL=1`), the evals; the results and the renders are kept as
the run's artifact.

## Tier 6: one real model, one real line (GPU, nightly)

`node scripts/ai-e2e/real/health.mjs` runs the pipelines as they are on
the smallest thing that proves them, everything it makes under
`results/real-work/` (never `public/`):

- **gen3d**: `make.mjs ai-health-xwing` from the contract tests' X-wing
  render, 8000 faces, seed 1, `--fresh`, judged as it ships (a dev server
  for the sheet when `CHROME` is set). Lines: a verdict of at least 7, the
  three cuts within `cutsFor(8000)`, under 25 minutes.
- **voices**: `export-lines.mjs --out`, then `generate.py --only han
  --limit 1 --takes 2` into a throwaway list, cache and output
  (`VOICES_LINES`, `VOICES_CACHE`, `VOICES_OUT`), with the desktop's
  references. Lines: one line made, none doubtful, under 10 minutes.

It waits up to 20 minutes for the GPU first, as the desktop's jobs do, and
writes `results/<date>-real.json`. With the fakes switched on it runs the
same plumbing in seconds: `real/health.test.mjs` does that on every PR.

**Drift**: `real/drift.mjs` compares the night's numbers (triangles, bytes,
verdict, word error rate, similarity, timings) with `real/golden.json`.
Past 10% (50% for timings: the GPU is shared, a cold start is slower; and
a floor for the small numbers) is drift, written to
`results/<date>-drift.json` with what moved and by how much. A person
looks at the night and, if the new numbers are right, blesses it:
`node scripts/ai-e2e/real/bless.mjs [results/<date>-real.json]` writes the
golden (it refuses a failed night). No golden yet: drift says so and stays
green.

## The nightly report and the issue

`node scripts/ai-e2e/report.mjs` reads every tier's results (the doctor's,
`render.json`, the evals', the real run's, the drift's) and writes one
Markdown table, tier, result, headline, time, to stdout, the run's summary
and `results/<date>-report.md`. A tier with no results did not run, which
is red. `node scripts/ai-e2e/issue.mjs` keeps one issue labelled
`ai-health`: a red night opens it, or adds its table as a comment; a green
night closes it. `node scripts/desktop/status.mjs` shows the last night.

**A red night**: open the run from the issue. A red doctor row is the
desktop (a tool missing or boxed: its fix is in the row); a red render is a
model that stopped drawing (its PNG is in the artifact); a red eval is a
judge that drifted (its results JSON lists every sheet or take it got
wrong); a red real run is the pipeline (its `make.log` and the takes'
report are in `results/real-work/`); drift is a question for a person, and
`bless.mjs` is the answer when the new numbers are right.

## Tier 7: the agent and the jobs

| file | what it proves |
| --- | --- |
| `agent/budget.test.mjs` | `scripts/autopilot-budget.mjs`, the check the autopilot makes before anything: paused stops; 80% of the plan stops and 79% goes; no figure with status `allowed` goes, any other status stops; overage stops; `runsPerDay` entries today stop |
| `agent/changes.test.mjs` | every ship's log entry (`src/data/changes/`) is well-formed, its screenshots exist, and `autopilot-log.mjs --next` is one past the highest |
| `agent/revert.test.mjs` | in a temporary repository with three merged pull requests, `autopilot-revert.mjs 2` takes the second out and keeps its entry marked reverted; it stops and names #103 when the third built on the same lines; it refuses a change reverted already |
| `agent/jobs.test.mjs` | 100 generated gen3d requests and 50 voices requests: what `ask.mjs --dry-run` writes, `parseIssue` reads back as the same job; `status.mjs --json` over the fake gh in every state; `doctor.mjs` over a made-up AppData finds a tool in the Claude app's box and says how to fix a missing one |
| `agent/workflows.test.mjs` | every job on `[self-hosted, gpu]` has a time limit, a concurrency group (or runs only by hand) and a trusted trigger or condition; the queue and check jobs and all of CI run on GitHub's own runners; nothing a pull request starts runs on the desktop |


## Every command

```
npm test                                     tier 0, the unit tests (the AI tiers left out)
npm run test:ai                              tiers 1, 2, 4 and 7 (CI's AI job)
npm run test:ai:render                       tier 3 (gen3d cuts; AI_RENDER_ALL=1 for every model)
npm run test:ai:gpu                          tiers 6 then 5, on the desktop (stops at a red one; the night runs each)
node scripts/ai-e2e/evals/run.mjs            tier 5 alone: both judges
node scripts/ai-e2e/evals/vision.mjs [--backend claude|qwen|fake]
python scripts/voices/eval_judge.py [--takes DIR] [--out FILE]
node scripts/ai-e2e/real/health.mjs          tier 6 alone
node scripts/ai-e2e/real/drift.mjs [results/<date>-real.json]
node scripts/ai-e2e/real/bless.mjs [results/<date>-real.json]
node scripts/ai-e2e/report.mjs [date]        the night's table
node scripts/ai-e2e/issue.mjs [date]         the ai-health issue (GH_TOKEN)
node scripts/ai-e2e/evals/make-sheets.mjs    the vision set, made again (CHROME)
node scripts/ai-e2e/evals/make-takes.mjs     the hearing set, made again (ffmpeg)
gh workflow run ai-health.yml                the night, now
```

## Every knob

| knob | where | what |
| --- | --- | --- |
| `GEN3D_ENGINE`, `GEN3D_JUDGE`, `GEN3D_JUDGE_SCRIPT`, `GEN3D_PICTURE`, `GEN3D_SHEET`, `BLENDER`, `GH_BIN`, `GH_LOG`, `GH_FIXTURES`, `GH_FAIL` | the pipelines | the fakes (above) |
| `GEN3D_FAKE_FAIL_AT`, `GEN3D_FAKE_TRIS`, `GEN3D_FAKE_TEX`, `GEN3D_FAKE_NOISE`, `GEN3D_FAKE_SLEEP`, `GEN3D_FAKE_LOG` | the fakes | failing on cue, size, weight, time, a log |
| `GEN3D_OUT`, `GEN3D_CACHE` | `web.mjs`, `make.mjs` | where the cuts and credit, and the cache, go |
| `VOICES_ENGINE`, `VOICES_JUDGE` | `generate.py` | the fake worker and ears |
| `VOICES_LINES`, `VOICES_OUT`, `VOICES_CACHE`, `VOICES_REFS`, `VOICES_PYTHON` | `generate.py`, the runner | the list, the mp3s and manifest, the takes, the references, the Python |
| `VOICES_LINES_FROM=voicelines` | `export-lines.mjs` | only the worlds' `voicelines.js` (a fixture tree) |
| `VOICES_TEST_PYTHON` | the voices contract tests | a Python with numpy and soundfile |
| `CHROME`, `AI_RENDER_ALL` | tier 3, the judging sheet | the browser; every model |
| `AI_RESULTS`, `AI_DATE` | tiers 5 and 6, the report | where results go; the night's date |
| `AUTOPILOT_UTILIZATION`, `AUTOPILOT_STATUS`, `AUTOPILOT_OVERAGE` (and `AUTOPILOT_BUDGET`, `AUTOPILOT_CHANGES`, `AUTOPILOT_TODAY` for tests) | `autopilot-budget.mjs` | the plan's figures |

## Adding a case

- **A contract test**: a vitest file under `scripts/ai-e2e/<tier>/`, its
  fixtures in `fixtures/` beside it, a sandbox from `contract/repo.mjs` for
  anything that runs a pipeline. A test that spawns one says “up to 10 s”
  in its `describe` name; anything else runs under a second and touches no
  network. On CI nothing skips: a tool a test needs is installed there.
- **A judging sheet**: add the model to `SHEETS` in
  `evals/make-sheets.mjs` (or a pick set to `PICKS`), run it, and write its
  label in `evals/sheets/labels.json`: what it is meant to be, the band a
  fair judge's score falls in, and why. A deliberate wrong is the best
  kind: the wrong question asked of a right model.
- **A take**: add a speaker to `SPEAKERS` in `evals/make-takes.mjs` (it
  takes two of their shipped lines and a longer one as the reference), or
  a wrong by hand, and label it in `evals/takes/labels.json`.
- **A brain's scenario**: `<brain>.scenario.test.js` beside it, from the
  promise in its header (write the promise into the header first if it
  isn't there), flown with `meet()` from `harness.js`; the properties in
  `all.scenario.test.js` pick a new brain up from `BRAINS` by themselves. A
  world's pure `rules.js` gets the same with `simulate()`.
- **A golden**: after a night a person has looked at,
  `node scripts/ai-e2e/real/bless.mjs` (the latest night's results), and
  commit `real/golden.json`.
- **An allow-list entry**: never added by hand to make a test pass. The
  lists hold what was wrong when the tests were first run; fix the thing
  and take it off.
