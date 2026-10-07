# End-to-end testing for the AI and the models

Everything on this site that is made by, judged by or driven by a model, tested from the request to what a visitor sees, so a change to any part of it is caught before it ships and a drift in any engine is caught the night it happens.

## What “the AI and the models” is

Six things, each with a different shape of risk:

| Piece | Where | What can go wrong unnoticed today |
| --- | --- | --- |
| **gen3d**: picture → 3D → web GLB | `scripts/gen3d/` | a step’s resume key stops matching; the cut goes over budget; the judge is asked the wrong question; the PR body lies about the model |
| **voices**: lines → takes → judged mp3 | `scripts/voices/` | a line’s id drifts from the manifest; a take passes the judge but says the wrong words; a speaker loses their voice silently |
| **the eyes and ears**: the vision judge (`vlm.mjs`), Whisper, WavLM, UTMOS | `scripts/gen3d/vlm.mjs`, `scripts/voices/judge.py` | the judge gets stricter or softer with an engine update and bad models start to ship, or good ones are remade for ever |
| **the made assets** | `public/models/gen3d/`, `public/audio/voiced/`, `public/games/credits.json` | a cut is missing, a texture is PNG not WebP, a model is lying on its back, a credit is gone, a manifest points at a file that isn’t there |
| **the desktop jobs**: issue → workflow → runner → PR | `scripts/desktop/`, `.github/workflows/gen3d.yml`, `voices.yml` | `ask.mjs` writes a field `parseIssue` can’t read; the runner comments the wrong thing; the doctor says fine when a tool is boxed |
| **the game AI**: the NPC toolkit and the brains | `src/lib/ai/`, `src/components/universe/npcs/brains/`, the worlds’ `rules.js` | a brain never reaches its goal, oscillates, emits NaN, or stops talking; a change to steering breaks a brain that has no test |
| **the autopilot**: the agent that edits the site | `.claude/skills/autopilot/`, `scripts/autopilot-*.mjs` | the budget guard lets a run through; a log entry is malformed; a revert takes the wrong commit |

The pieces that need a GPU and tens of gigabytes of weights live on the owner’s desktop. The rest runs anywhere. The design keeps them apart: **what can run on a GitHub-hosted runner runs on every pull request; what needs the GPU runs every night on the self-hosted runner and reports once.**

## The tiers

Every tier is a folder of vitest files (or Python unittest for the voices’ Python) with one command each, and a CI job that runs the tiers it can.

```
 tier  name          where it runs          when                 what it proves
 ───── ───────────── ────────────────────── ──────────────────── ─────────────────────────────────────────────
  0    unit          anywhere, <1 s a file  every PR (npm test)  each pure module (already there: 300+ files)
  1    contract      ubuntu, no GPU         every PR             the pipelines end to end with fake engines
  2    assets        ubuntu                 every PR             every shipped model and voice line is sound
  3    render        ubuntu + Chromium      every PR that touches an asset, and nightly   each model draws
  4    sims          ubuntu                 every PR             every brain, scripted and fuzzed
  5    evals         desktop GPU            nightly              the judges still judge right
  6    real          desktop GPU            nightly              one real model and one real line, start to end
  7    agent         ubuntu                 every PR             the autopilot’s guards and the desktop jobs’ contract
```

Tiers 1 to 4 and 7 are `npm run test:ai` (a second vitest config, `vitest.ai.config.js`, with its own include list; `npm test` stays as it is and keeps its sub-second promise). Tiers 5 and 6 are `npm run test:ai:gpu`, which `.github/workflows/ai-health.yml` runs on the `[self-hosted, gpu]` runner at 04:00 UTC and on demand.

### Tier 1: the pipelines with fake engines

The pipelines are orchestration: a dozen steps, each a subprocess, with resume keys, budgets, judging and a pull request at the end. Almost none of that needs a real engine, so each engine gets a fake behind the same seam it already has.

- **`GEN3D_ENGINE=fake`**: `generate.mjs`’s `command()` already dispatches on the engine name. The fake is `scripts/gen3d/engines/fake.mjs`: it reads the input picture’s bytes, derives a seed from them and writes a tiny valid textured GLB (a box with a 64×64 PNG, made with `@gltf-transform/core`) in under a second. Deterministic: the same picture gives byte-identical output, so resume keys can be tested for real. `--fail-at generate|bake|web` makes it exit 1 so failure paths are tested too.
- **`GEN3D_JUDGE=fake`**: `vlm.mjs` adds a third backend next to `claude` and `qwen`. It answers from a script: a JSON file named by `GEN3D_JUDGE_SCRIPT` whose entries match on a substring of the prompt and give the reply. A test can make the judge say 4/10 on the first sheet and 9/10 on the second and watch `make.mjs` reseed exactly once.
- **`GEN3D_PICTURE=fake`**: `picture.mjs` writes a fixture PNG instead of running stable-diffusion.cpp; with `--candidates 4` it writes four that differ in one pixel, so `pick()` has something to choose between.
- **Blender absent**: `bake.mjs` already falls back when Blender is missing. Tests cover both the fallback and, with `BLENDER=scripts/ai-e2e/fakes/blender.mjs` (a script that copies in to out), the bake path’s plumbing.
- **A fake `gh`**: `scripts/desktop/lib.mjs` shells out to `gh` and `git`. Tests set `GH_BIN` to `scripts/ai-e2e/fakes/gh.mjs`, which records every call to a JSON log and answers from fixtures (an issue’s JSON, a created PR’s URL). `git` runs for real in a temporary repository the test makes (`git init`, one commit, a bare `origin`), so branches, pushes and `fresh()` are exercised as they are.
- **The voices’ Python** already has a stand-in worker (`test_generate.py`’s `FAKE`). It gains a stand-in judge (`VOICES_JUDGE=fake`: Whisper’s text is the line, similarity 0.9, MOS 4.0, unless a line’s text contains `[bad]`) so `generate.py`’s rounds and `runner.mjs`’s summary are tested together.

With those, the contract tests say, for gen3d:

1. An issue body with every field → `parseIssue` → `make.mjs` with the fake engine → `public/models/gen3d/<name>.glb`, `.hq.glb`, `.lo.glb` within `TIERS`, a credit in `credits.json`, `result.json` with `ok: true`, a judging sheet, a PR opened through the fake `gh` whose body has the sheet, the verdict and the triangle counts. Every field’s effect is asserted (`faces` scales all three cuts; `tex` caps the texture; `fresh: yes` ignores the cache).
2. **Resume**: kill after the raw step (the fake’s `--fail-at bake`), run again, and the raw step is reused (`reused: true` in the log) while the bake runs. Change the picture by a byte and nothing is reused.
3. **Failure**: an engine that exits 1 ends as a `gen3d:failed` label and a comment with the log’s tail through the fake `gh`, and the branch is not pushed.
4. **Over budget**: a fake that writes a model over the triangle budget is refused by `web.mjs` with the message `budget.mjs` gives, and nothing is credited.
5. **Judge loop**: judge says 4 then 9; `make.mjs` reseeds once and ships the second; judge says 4 three times; it ships the best with the verdict in the PR, as the README says.
6. **Multi-view**: four pictures route to `hunyuan`; one routes to `trelliscpp`; `faithful: no` turns Pixal3D off.

And for voices: `export-lines.mjs` over a fixture `src/` tree with two `voicelines.js` files → `lines.json` → `generate.py` with the fake worker and fake judge → `public/audio/voiced/<who>/<id>.mp3` and a manifest whose ids equal `lineId()` from `src/lib/voiced.js` for the same text (the JavaScript and Python sides must agree; today nothing checks that) → `runner.mjs`’s `summarise` and PR body.

### Tier 2: the assets as shipped

A test over the repository as it is, run on every PR, so a hand-made or imported model is held to the same bar as a generated one.

- Every `public/models/gen3d/<name>.glb` has its `.hq.glb` and `.lo.glb`, each within its tier of `TIERS` for a `--faces` the test infers from the plain cut, under 4 MB, textures all WebP (`EXT_texture_webp`), meshopt-compressed, one scene, Y up (the bounding box is taller than it is deep for anything credited as a figure, and the model’s “up” hint in `credits.json` when present), and credited as `gen3d/<name>` in `public/games/credits.json`.
- Every credit in `credits.json` and `src/data/modelCredits.json` points at a file that exists; every GLB under `public/models/` is credited somewhere (the test lists what isn’t, and an allow-list in the test holds the few that predate credits, shrinking only).
- Every file in `public/audio/voiced/` is in the manifest and every manifest entry exists; each is a decodable mp3 (header bytes, duration between 0.3 s and 30 s via `music-metadata` or a minimal frame parse); each id is `lineId(who, text)` of some line in some `voicelines.js` or the universe’s speakers (the orphans listed, allow-listed, shrinking only).
- Every speaker `voiceOf` names has a folder, or is in `export-lines.mjs`’s “no reference yet” list.

### Tier 3: every model draws

`scripts/glb-shot.mjs` in headless Chromium with SwiftShader, already how `judge.mjs` renders. For each gen3d cut: the `three` view at 320×240, no page error, no console error outside `autopilot-check.mjs`’s `NOISE`, and at least 4% of the pixels not the background colour (a blank canvas is the failure this catches). The screenshot is kept as a CI artifact. On a PR this runs only when something under `public/models/` or `src/lib/three/` changed (a paths filter on the job); nightly it runs over everything, including the `look=toon` pass the galaxy uses.

The Chromium comes from `npx playwright@<the pinned playwright-core version> install --with-deps chromium`, cached by `actions/cache` on the version.

### Tier 4: the brains, scripted and fuzzed

`nemesis.test.js` already has the right harness: a seeded random, a meeting flown for N seconds, every frame’s events kept. That harness moves to `src/components/universe/npcs/brains/harness.js` and every brain gets its scenario file:

| brain | scenario | the assertions |
| --- | --- | --- |
| inspector | you fly straight, then stop | comes alongside within 20 s, says its hello once, leaves within 15 s of your stop |
| nemesis | you fly straight, then turn hard | shoots only when within range and roughly ahead, never more than its `fire` rate, breaks off at low hp |
| merchant | you stop near a station | offers once, never follows past 200 m |
| wingman | you fly a lazy circle | holds formation (distance in a band for 80% of frames), never collides |
| bounty, rival, trickster, tagalong, informant | each its own script | each brain’s own promise, taken from its header comment |

Across every brain, three property tests over 200 seeds each: **no NaN or infinity** ever leaves a brain; **speed and turn stay within `stats`**; **determinism**: the same seed and script give an identical event trace. And one **liveness** test: no brain stays in the same mode with the same target for more than 60 s unless that mode is a terminal one it names.

The toolkit itself (`src/lib/ai/`) gets fuzz tests in the shape of `cybertron/game/fuzz.test.js`: `steer` over random fields never produces a vector longer than its limit; `search` over random grids finds a path when one exists (checked by flood fill) and none when none does; `spatial.pick` returns only candidates that pass every filter; `squad` assigns every member exactly one role.

The galaxy surface’s hostiles and the worlds’ watchers have `rules.test.js` files already; the harness exports a `simulate(rules, script)` they can share so new worlds get one for free.

### Tier 5: the judges still judge right (GPU, nightly)

A judge that drifts is the quietest failure in the whole system. Each judge gets a small labelled set and a score that has to stay above a line.

- **Vision**: `scripts/ai-e2e/evals/sheets/` holds judging sheets with a `labels.json`: `{ "x-wing-good.png": { what: "an X-wing starfighter", score: [7, 10] }, "x-wing-squat.png": { score: [1, 5] }, "tie-as-xwing.png": { score: [1, 4] } }`. Twelve to twenty sheets, taken from `docs/gen3d/` and from the models already shipped, plus deliberate wrongs (the wrong ship, a blob, a model on its back). `node scripts/ai-e2e/evals/vision.mjs` runs `vlm.judge` with each available backend and reports accuracy (a score inside its band), mean absolute error against the band’s middle, and a confusion of good/bad. The line: 85% in band for Claude, 70% for Qwen. The same for `pick()`: four candidates and which one is right, 80%.
- **Hearing**: `scripts/ai-e2e/evals/takes/` holds a dozen wavs with `labels.json` (the text said, the speaker, a `good`/`bad` call) and `python scripts/voices/eval_judge.py` reports Whisper’s word error rate on the good takes (≤ 10%), that the speaker similarity ranks the right speaker first (≥ 90%), and that every `bad` take scores under every `good` one on the combined score the pipeline uses.

Each run writes `scripts/ai-e2e/evals/results/<date>.json` to the workflow’s artifacts, never the repo, and appends one line to the nightly report.

### Tier 6: one real model, one real line (GPU, nightly)

The pipelines as they are, on the smallest thing that proves them:

- `node scripts/gen3d/make.mjs ai-health-xwing --image scripts/ai-e2e/fixtures/x-wing-ref.png --what "an X-wing starfighter" --faces 8000 --seed 1 --fresh` into a throwaway `GEN3D_CACHE` and a throwaway output root (`GEN3D_OUT`, a new knob so a health run never writes under `public/`). Pass: `result.json` ok, verdict ≥ 7, the three cuts within budget, under 25 minutes.
- `python scripts/voices/generate.py --only han --limit 1 --takes 2 --out <tmp>` with a fixed seed. Pass: made 1, doubtful 0, under 10 minutes.
- `node scripts/desktop/doctor.mjs --json` all green, from the runner’s side, which is the side that matters.

And **drift**: `scripts/ai-e2e/golden.json` holds the last blessed run’s triangle counts, byte sizes, verdict and timings. A nightly within 10% is fine; outside it the report says what moved and by how much, and `node scripts/ai-e2e/bless.mjs` writes the new golden when a human agrees.

### Tier 7: the agent and the jobs

- **Budget guard**: `scripts/autopilot-check.mjs` grows a `--budget` mode (or the skill’s guard becomes `scripts/autopilot-budget.mjs`) that reads `docs/autopilot/budget.json` and a usage figure from an environment variable and prints `go` or `stop` with the reason. Tests: paused stops; 80% stops; 79% goes; no figure plus status `allowed` goes; overage stops.
- **The log**: every `src/data/changes/*.json` matches a schema (id, date, kind, summary, route, pr, screenshots that exist); `autopilot-log.mjs --next` is one more than the highest.
- **Revert**: in a temporary repository with three merge commits, `autopilot-revert.mjs 2` reverts the second’s merge, keeps the entry marked reverted, and refuses when the third touched the same files (the “which built on it” case).
- **The desktop jobs’ round trip**: for every field in `runner.mjs`’s `KEYS`, `ask.mjs --dry-run` writes an issue body that `parseIssue` reads back to the same job (a property test over generated jobs). `status.mjs --json` over fixture `gh` output. `doctor.mjs` with a fake `LOCAL` tree: boxed tools are reported boxed.
- **The workflows**: `gen3d.yml` and `voices.yml` are parsed and checked: the `make` job runs only on `[self-hosted, gpu]`, only on the trusted conditions, with a timeout; the `queue` and `check` jobs on ubuntu. (A YAML test, so a careless edit can’t hand the GPU runner to a fork.)

## Where it lives

```
scripts/ai-e2e/
  README.md               the manual: each tier, how to run it, how to add a case
  fakes/                  engine, judge, picture, blender, gh
  fixtures/               the reference picture, a fixture src/ tree with voicelines, issue bodies
  contract/*.test.mjs     tier 1
  assets/*.test.mjs       tier 2
  render/*.test.mjs       tier 3
  agent/*.test.mjs        tier 7
  evals/                  tier 5: sheets/, takes/, vision.mjs, labels, results/ (git-ignored)
  real/                   tier 6: health.mjs, golden.json, bless.mjs
  report.mjs              one table from every tier's JSON, for the nightly issue
src/components/universe/npcs/brains/harness.js, *.test.js     tier 4
src/lib/ai/*.fuzz.test.js                                     tier 4
vitest.ai.config.js       include: scripts/ai-e2e/**/*.test.mjs, **/*.fuzz.test.js, brains/*.test.js
.github/workflows/ai-health.yml   nightly on the GPU runner: tiers 3 (all), 5, 6; opens or updates the issue
.github/workflows/ci.yml          gains a job: npm run test:ai (tiers 1, 2, 4, 7), and tier 3 on an asset path filter
```

`npm test` is untouched: `vite.config.js`’s exclude list adds `scripts/ai-e2e/**` and the brains’ scenario files stay out by name (`*.scenario.test.js`), so the default run stays fast and the AI run is one command.

## The nightly report

`ai-health.yml` ends with `node scripts/ai-e2e/report.mjs`, which reads every tier’s JSON from the run and writes one Markdown table: tier, pass/fail, the headline number (accuracy, verdict, drift), the time. One issue labelled `ai-health` is kept: a green night closes it if open; a red night opens it or adds the table as a comment. The judging sheet and the screenshots are the run’s artifacts. `node scripts/desktop/status.mjs` shows the last night’s result next to the queue.

## What is not in this design

- No new engine, model or judge. The fakes stand in; the real ones are run, not changed.
- No test that costs money: Meshy and Sketchfab scripts are out of scope (they stay for what is already on the site).
- No pixel-exact visual regression of the worlds: `autopilot-check.mjs` and `lab/universe/baseline` cover the pages; this design covers the models and the brains inside them.
- Nothing runs the real pipelines on a pull request. The GPU runner takes one job at a time and a PR must never wait on it.

## Rules the work follows

The repository’s own: a test runs under a second and touches no network (tiers 0, 1, 2, 4, 7; tier 1’s subprocess tests may take up to 10 s each and say so in a `describe` name), fixtures beside the test, logic apart from drawing, nothing over the big-file line, no `eslint-disable`, no TODO, British spelling, comments say why. Every tier’s command, and how to add a case, in `scripts/ai-e2e/README.md`; the summary in `docs/architecture.md`’s Tests section.
