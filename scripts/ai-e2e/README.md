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

## Adding a case

A contract test is a vitest file under `scripts/ai-e2e/<tier>/`, its
fixtures in `fixtures/` beside it. A test that spawns a pipeline says “up to
10 s” in its `describe` name; anything else runs under a second and touches
no network.

## The nightly (tiers 5 and 6)

`npm run test:ai:gpu` runs the real engines and the judges' evaluations on
the desktop. Until those land it says which part is missing and fails, so it
can't pass by doing nothing.
