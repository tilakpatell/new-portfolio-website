# AI End-to-End Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline, in this session. Steps use checkbox (`- [ ]`) syntax for tracking. The owner asked for no subagents and for a pull request merged to `main` at the end of every PR section, as often as possible without breaking `main`.

**Goal:** Every piece of the site that a model makes, judges or drives (the gen3d and voices pipelines, their judges, the shipped models and voice lines, the desktop jobs, the NPC brains and the autopilot) is tested from the request to what a visitor sees: fast contract tests with fake engines on every pull request, and a nightly run of the real engines and judge evaluations on the desktop’s GPU runner that reports in one issue.

**Architecture:** Seven tiers (see the spec), each a folder of vitest files under `scripts/ai-e2e/` (or beside the brains for the sims) with one command. `npm run test:ai` runs the tiers a GitHub-hosted runner can; `npm run test:ai:gpu` runs the two that need the desktop. Fakes sit behind seams the pipelines already have (`GEN3D_ENGINE`, `GEN3D_JUDGE`, `BLENDER`, a new `GH_BIN`), so the orchestration is tested as it is and no engine is changed.

**Tech Stack:** JavaScript ES modules, vitest 5 (a second config `vitest.ai.config.js`), `@gltf-transform/core` for fixture GLBs and asset checks, `playwright-core` + headless Chromium for renders, Python 3.12 unittest for the voices’ side, GitHub Actions (`ubuntu-latest` and `[self-hosted, gpu]`).

**Spec:** `docs/superpowers/specs/2026-10-07-ai-e2e-testing-design.md`

## Global Constraints

- Read the spec first, then `scripts/gen3d/README.md`, `scripts/desktop/README.md`, `scripts/voices/README.md`, `docs/autopilot/README.md`, `docs/health/RULES.md`.
- British spelling, curly quotes in prose; comments say why, not what. No AI assistant model names in code, docs or commits (engine names like TRELLIS are fine: they are the subject).
- Tests are written before the code they test. A unit or contract test runs under a second and touches no network; a subprocess contract test may take up to 10 s and says so in its `describe` name. Fixtures live in `fixtures/` beside the test.
- No pipeline behaviour changes except where a seam is needed (a fake backend, `GH_BIN`, `GEN3D_OUT`). Every existing test keeps passing unchanged.
- `docs/health/budgets.json`: `big-files` 30, `lint-disables` 54, `todo-notes` 0. No new file over the big-file line, no `eslint-disable`, no TODO.
- Before every push: `npm run lint`, `npm test`, `npm run test:ai`, `npm run build`, `node scripts/health.mjs --check --skip build`, all clean. In a worktree, `npm ci --ignore-scripts` (the `cpu-features` build fails there; lint, test and dev are unaffected).
- One PR per section below, each on a fresh branch from `origin/main`; merge with a merge commit once CI is green; never merge red. `main` is unprotected and auto-merge is off, so wait for the check yourself (`gh pr checks --watch`) before `gh pr merge --merge`.
- Commit messages are one plain sentence that says why, ending with the session’s attribution lines.
- Nothing in these tiers runs a real engine on a pull request. The GPU runner is nightly only.

## Review Focus

- Does each fake sit behind a seam the real pipeline already uses, so the contract test exercises the real orchestration?
- Can every tier be run alone with one command, and does `scripts/ai-e2e/README.md` say how?
- Does `npm test` stay as fast as it was?
- Are the thresholds (judge accuracy, drift, pixel coverage) written down with their reasons?

---

## PR 1: The harness, the fakes and the second vitest run

- [x] **1.1** `vitest.ai.config.js`: `include` is `scripts/ai-e2e/**/*.test.mjs`, `src/**/*.fuzz.test.js`, `src/components/universe/npcs/brains/*.scenario.test.js`; `testTimeout` 15000; `fileParallelism` false for the subprocess folder (`poolMatchGlobs` or a `sequence` setting). `vite.config.js`’s test `exclude` adds `scripts/ai-e2e/**`, `**/*.fuzz.test.js`, `**/*.scenario.test.js`. Test: `npm test` lists none of them; `npm run test:ai` with an empty include passes.
- [x] **1.2** `package.json`: `"test:ai": "vitest run --config vitest.ai.config.js"`, `"test:ai:gpu": "node scripts/ai-e2e/real/health.mjs && node scripts/ai-e2e/evals/run.mjs"` (the targets land in PRs 6 and 7; until then the script exists and says what is missing).
- [x] **1.3** `scripts/ai-e2e/fakes/engine.mjs`: `fake` engine for `generate.mjs`. Reads the input picture, hashes it for a seed, writes a textured box GLB (`@gltf-transform/core`: one mesh, one 64×64 PNG base colour, ~12 triangles; `--tris N` writes a subdivided plane to reach N triangles so budget tests can overshoot). Honours `--seed`, `--fail-at generate` (exit 1 after writing half a file), and a sleep knob for timeout tests. Test: byte-identical output for the same input; different for a one-byte change; `--tris 30000` gives ≥ 30000 triangles.
- [x] **1.4** `generate.mjs`: `command('fake', …)` returns `['node', fakes/engine.mjs, in, out, …]`; `GEN3D_ENGINE=fake` is honoured where the default engine is chosen. Test in `gen3d.test.mjs` alongside the trellis2 case.
- [x] **1.5** `vlm.mjs`: a `fake` backend chosen by `GEN3D_JUDGE=fake`, answering from `GEN3D_JUDGE_SCRIPT` (JSON array of `{ match, reply }`, first substring match of the prompt wins, a `calls.json` log beside the script of every prompt and image path asked). `which()` returns `'fake'`. Test: `judge()` and `pick()` parse the scripted replies; an unmatched prompt throws with the prompt’s first 80 characters.
- [x] **1.6** `picture.mjs`: `GEN3D_PICTURE=fake` copies `fakes/picture.png` (a 1024² PNG with a grey box) to the output; with several candidates, each differs in one pixel. Test: four files, four digests.
- [x] **1.7** `scripts/ai-e2e/fakes/blender.mjs`: copies the raw GLB to the low GLB (what a bake does to the plumbing, not the pixels). `bake.mjs` accepts `BLENDER` pointing at a `.mjs` (runs it with `node`). Test: `bake.mjs` with it writes the output and its key.
- [x] **1.8** `scripts/ai-e2e/fakes/gh.mjs` and `GH_BIN` in `scripts/desktop/lib.mjs` (default `gh`): the fake records each argv to `GH_LOG` and answers from `GH_FIXTURES/<subcommand>.json` (`issue view`, `pr create` → a URL, `issue comment`, `issue edit`, `api …/labels`). Test: `lib.mjs`’s `pullRequest()` and label helpers against the fake produce the expected argv.
- [x] **1.9** `scripts/ai-e2e/README.md`: the tiers, the commands, the fakes and their knobs, how to add a case. `docs/architecture.md` Tests section: two sentences pointing at it.
- [x] **1.10** `.github/workflows/ci.yml`: a second job `ai` on `ubuntu-latest`: `npm ci`, `npm run test:ai`. Lint, test, build and health stay in the first job.
- [x] **1.11** Gate, PR, CI green, merge.

## PR 2: Tier 1, gen3d from issue to pull request with fakes

- [x] **2.1** `scripts/ai-e2e/contract/fixtures/`: `x-wing-ref.png` (a real render of `public/models/gen3d/x-wing.glb` on white at 512², made once with `scripts/preview/glb-shot.html`), `issue-full.md` (every field), `issue-multiview.md`, `issue-bad-faces.md`, judge scripts `judge-good.json`, `judge-reseed.json` (4 then 9), `judge-never.json` (4, 4, 4).
- [x] **2.2** `contract/repo.mjs`: a helper that makes a temporary repository (`git init`, a first commit, a bare `origin` beside it), copies in the files `make.mjs` reads (`scripts/gen3d`, `scripts/desktop`, `public/games/credits.json`), sets `GEN3D_CACHE`, `GEN3D_OUT`, `GEN3D_RUNNER_ROOT`, `GH_BIN`, `GH_LOG`, `GH_FIXTURES`, and returns paths and a `run(args)` for `runner.mjs`. `GEN3D_OUT` is new in `web.mjs`: where `public/models/gen3d` and `credits.json` are written (default the repository).
- [x] **2.3** `contract/gen3d-make.test.mjs` (describe says “up to 10 s”): `make.mjs` with the fake engine, judge and picture → three cuts within `TIERS` for `--faces 8000`, credit present, `result.json` ok, sheet PNG exists and is the right size for one model (`layout(1)`), `make.log` names each step.
- [x] **2.4** `contract/gen3d-resume.test.mjs`: run; run again; the raw and bake steps report `reused`. `--fresh` makes all again. A one-byte change to the picture makes all again.
- [x] **2.5** `contract/gen3d-judge.test.mjs`: `judge-reseed.json` → two generate calls, seeds 1 and 2, the second shipped; `judge-never.json` → the limit of retries from the README, the best verdict in `result.json`; `--no-judge` → no judge calls in `calls.json`.
- [x] **2.6** `contract/gen3d-budget.test.mjs`: engine `--tris 30000` with `--faces 8000` and the bake fake (which keeps the count) → `web.mjs` refuses with `budget.mjs`’s wording, no credit, `result.json` not ok.
- [x] **2.7** `contract/gen3d-runner.test.mjs`: `runner.mjs --issue 1` with `issue-full.md` through the fake `gh` → a branch `gen3d/<name>` on `origin`, a PR created whose body has the sheet path, the verdict, the triangles and sizes; the issue commented and closed; labels `gen3d:running` added then removed. `issue-bad-faces.md` → `gen3d:failed`, a comment quoting the field error, nothing pushed. `--fail-at generate` → `gen3d:failed` with the log’s tail. `issue-multiview.md` → the fake engine is called once with four pictures (the hunyuan path’s argv).
- [x] **2.8** `gen3d.test.mjs` grows the `parseIssue` matrix: each key in `KEYS`, each boolean spelling, `faces: 24k`, a URL in `image`, attached pictures in order.
- [x] **2.9** Gate, PR, CI green, merge.

## PR 3: Tier 1, voices from lines to manifest

- [x] **3.1** `scripts/voices/judge.py`: `VOICES_JUDGE=fake` makes `hear()` return the take’s own line (read from a sidecar `.txt` the fake worker writes), similarity 0.9, MOS 4.0, and `[bad]` in a line’s text gives similarity 0.3 and the words scrambled. `test_judge_fake.py`.
- [x] **3.2** `contract/fixtures/voices-src/`: a tiny `src/` tree with two `voicelines.js` (three lines each, two speakers, one speaker with no reference).
- [x] **3.3** `contract/voices.test.mjs` (“up to 10 s”): `export-lines.mjs` over the fixture tree → `lines.json` with six lines and the right `who`s; `generate.py` with the fake worker and judge into a temporary `public/audio/voiced` → five mp3s (the voiceless speaker skipped and named), a manifest whose ids equal `lineId()` from `src/lib/voiced.js` for each line (import it in the test: the JavaScript and Python hashes must agree); the `[bad]` line marked doubtful in the report. Skip with a clear message when `python` or the venv is absent, so CI without Python does not fail (CI installs Python 3.12 for this job).
- [x] **3.4** `contract/voices-runner.test.mjs`: `runner.mjs --issue` with an `only:` body through the fake `gh` → a PR whose body has the count and the voiceless speaker, as `summarise` gives it.
- [x] **3.5** `ci.yml`’s `ai` job: `actions/setup-python@v5` 3.12, `pip install numpy soundfile` (what the fakes need; the real engines are not installed).
- [x] **3.6** Gate, PR, CI green, merge.

## PR 4: Tier 2, the assets as shipped

- [x] **4.1** `scripts/ai-e2e/assets/glb.mjs`: `inspect(file)` → `{ tris, bytes, textures: [{ mime, w, h }], extensions, scenes, bbox, meshopt }` with `@gltf-transform/core` + extensions. Test on the x-wing cuts.
- [x] **4.2** `assets/gen3d.test.mjs`: for every `public/models/gen3d/*.glb` family: three cuts; each within its `TIERS` band for the `--faces` inferred from the plain cut (`budget.mjs` exports the inference); under 4 MB; textures WebP; meshopt; one scene; credited `gen3d/<name>`. Failures name the file and the number.
- [x] **4.3** `assets/credits.test.mjs`: every credit in `public/games/credits.json` and `src/data/modelCredits.json` points at a file that exists; every GLB under `public/models/` is credited, with `assets/allow-uncredited.json` holding the exceptions and a test that the list only shrinks (each entry must still exist as a file, else it is stale and the test says so).
- [x] **4.4** `assets/voiced.test.mjs`: manifest ↔ files both ways; each mp3 has a valid frame header and a duration between 0.3 s and 30 s (a minimal MPEG frame walk, no dependency); each id is `lineId(who, text)` of a line from a `voicelines.js` under `src/` or from `scripts/voices/export-lines.mjs`’s universe lists (`allow-orphans.json`, shrinking only); every speaker `voiceOf` names has a folder or is on the “no reference yet” list.
- [x] **4.5** Gate, PR, CI green, merge.

## PR 5: Tier 3, every model draws

- [x] **5.1** `scripts/glb-shot.mjs`: `shoot()` returns the console errors and page errors it saw (`shoot.last.errors`) so a test can assert on them; `W`/`H` overridable (already `w`, `h`). A dev server helper `scripts/ai-e2e/render/server.mjs` starts vite on a free port and stops it (reuse `autopilot-check.mjs`’s port-finding).
- [x] **5.2** `render/coverage.mjs`: `coverage(png, bg)` → fraction of pixels farther than a tolerance from the background colour (`sharp` raw pixels). Test on a blank and a drawn fixture.
- [x] **5.3** `render/gen3d.test.mjs` (“up to 60 s, needs Chromium”): for each cut, the `three` view at 320×240 → coverage ≥ 0.04, no error outside `NOISE` (export `NOISE` from `autopilot-check.mjs` into `scripts/lib/noise.mjs` and import it in both). Skips with a clear reason when `CHROME` is unset and no Chromium is found; writes each PNG to `scripts/ai-e2e/render/out/` (git-ignored).
- [x] **5.4** `ci.yml`: the `ai` job gets a step that runs tier 3 only when `public/models/**` or `src/lib/three/**` changed (`dorny/paths-filter` or a `git diff --name-only origin/main...` check in a script), after `npx playwright@<pinned> install --with-deps chromium` cached on the version. The render folder is excluded from the plain `test:ai` run and run by `test:ai:render`.
- [x] **5.5** Gate, PR, CI green, merge.

## PR 6: Tier 4, the brains scripted and fuzzed

- [x] **6.1** `src/components/universe/npcs/brains/harness.js`: `meet()` and its helpers lifted from `nemesis.test.js` (seeded random, `fly`, `you`, `foe(brainName)`, frame-by-frame capture, modes seen, a `trace` of events for determinism). `nemesis.test.js` imports it and passes unchanged. Exports `simulate(rules, script)` for the worlds’ `rules.js` files.
- [x] **6.2** One `<brain>.scenario.test.js` per brain in `brains/` (inspector, merchant, wingman, bounty, rival, trickster, tagalong, informant), each scenario and assertion taken from the brain’s header comment and the spec’s table. Where a brain’s promise is not in its header, read the brain, write the promise into the header, then the test.
- [x] **6.3** `brains/all.scenario.test.js`: over every brain and 200 seeds: no NaN or infinity in any intent or event; speed and turn within `stats`; determinism (same seed, same script → identical trace); liveness (no mode held with the same target over 60 s unless the brain’s header names it terminal).
- [x] **6.4** `src/lib/ai/*.fuzz.test.js`: `steer` output length ≤ limit over random fields; `search` finds a path when flood fill does and not otherwise; `spatial.pick` returns only candidates passing every filter; `squad` gives every member exactly one role; `perception` memory decays monotonically with no sightings; `utility.pick` returns an option with the highest score, ties broken by the given `rand`.
- [x] **6.5** Gate, PR, CI green, merge.

## PR 7: Tier 5, the judges, and the nightly workflow

- [x] **7.1** `scripts/ai-e2e/evals/sheets/`: 12 to 20 judging sheets with `labels.json` (`what`, `score: [lo, hi]`, `note`), taken from `docs/gen3d/`, from four-view sheets of the shipped gen3d models (`judge.mjs`), and deliberate wrongs (the TIE sheet labelled as an X-wing, a sheet of the fake engine’s box, a sheet of a model turned on its back with `upright.mjs --x 90`). Keep the total under 6 MB (WebP).
- [x] **7.2** `evals/vision.mjs`: for each backend `vlm.which()` can reach (`claude`, `qwen`; `fake` for the self-test): `judge()` per sheet, accuracy in band, mean absolute error to the band’s middle, good/bad confusion; `pick()` over `pick-sets/` (four candidates, one right) accuracy. Writes `results/<date>-vision.json`; exits 1 under the lines (85% / 70% judge, 80% pick). Unit test with the fake backend over three labelled sheets.
- [x] **7.3** `evals/takes/` and `scripts/voices/eval_judge.py`: a dozen short wavs (from the references already made, cut to 2–4 s; and two deliberately wrong: another speaker, a mumbled take) with `labels.json`; WER on good takes ≤ 10%; right speaker ranked first ≥ 90%; every bad under every good on the pipeline’s combined score. Writes `results/<date>-hearing.json`. Unit test with `VOICES_JUDGE=fake`.
- [x] **7.4** `evals/run.mjs`: runs 7.2 and 7.3, collects their JSON, exit 1 if either did.
- [x] **7.5** `.github/workflows/ai-health.yml`: `schedule: cron '0 4 * * *'` and `workflow_dispatch`; job `gpu` on `[self-hosted, gpu]`, `timeout-minutes: 120`, `concurrency` with the gen3d and voices make jobs’ group so it never shares the GPU; steps: checkout, `npm ci --ignore-scripts`, `node scripts/desktop/doctor.mjs --json`, `npm run test:ai:render` (all cuts, both looks), `node scripts/ai-e2e/evals/run.mjs`, then (PR 8) the real run and the report. Artifacts: results JSON, renders, sheets.
- [x] **7.6** Gate, PR, CI green, merge.

## PR 8: Tier 6, one real model and one real line, drift, and the report

- [x] **8.1** `scripts/ai-e2e/real/health.mjs`: runs `make.mjs ai-health-xwing --image fixtures/x-wing-ref.png --what "an X-wing starfighter" --faces 8000 --seed 1 --fresh` with a throwaway `GEN3D_CACHE` and `GEN3D_OUT`, times it, reads `result.json`; runs `generate.py --only han --limit 1 --takes 2` into a throwaway out; collects `{ gen3d: { ok, verdict, tris: [hq, mid, lo], bytes, seconds }, voices: { made, doubtful, wer, similarity, seconds } }` into `results/<date>-real.json`. Lines: verdict ≥ 7, cuts in budget, gen3d ≤ 25 min, voices ≤ 10 min, doubtful 0.
- [x] **8.2** `real/golden.json` and `real/drift.mjs`: compare the night’s numbers to the golden; over 10% on any number is a drift, reported with what moved; `real/bless.mjs` writes the golden from a results file (a human runs it). Unit tests on fixture results.
- [x] **8.3** `scripts/ai-e2e/report.mjs`: every `results/<date>-*.json` from the run → one Markdown table (tier, pass/fail, headline number, time) to stdout and `results/<date>-report.md`. Unit test on fixtures.
- [x] **8.4** `ai-health.yml`: after the evals, `node scripts/ai-e2e/real/health.mjs`, `node scripts/ai-e2e/real/drift.mjs`, `node scripts/ai-e2e/report.mjs`; then one `ai-health`-labelled issue kept: green closes it if open, red opens it or comments the table (`gh` in the workflow, with `GITHUB_TOKEN`). `scripts/desktop/status.mjs` shows the last `ai-health` run’s conclusion and date.
- [ ] **8.5** Run the workflow once by hand (`gh workflow run ai-health.yml`), wait for it, read the report, bless the first golden, commit it.
  Run by hand three times on 2026-10-07 (the first cancelled, the second and third read). Not blessed: on both nights the gen3d real run found the GPU held for 20 minutes (the second night by the vision eval's own leaked llama-server, fixed in PR 10; the third by another session's long voices remake in WSL) and made nothing, and a golden is a good night. Bless the first night whose gen3d and voices are both green: `node scripts/ai-e2e/real/bless.mjs`.
- [x] **8.6** Gate, PR, CI green, merge.

## PR 9: Tier 7, the agent and the jobs

- [x] **9.1** `scripts/autopilot-budget.mjs`: reads `docs/autopilot/budget.json` and `AUTOPILOT_UTILIZATION` / `AUTOPILOT_STATUS`; prints `go` or `stop: <reason>`; exit 0/1. The skill (`.claude/skills/autopilot/SKILL.md`) calls it in place of its prose check. Tests: paused; 80% and 79%; no figure with `allowed`; overage; `runsPerDay` reached (reads the day’s entries in `src/data/changes/`).
- [x] **9.2** `agent/changes.test.mjs`: every `src/data/changes/*.json` matches the schema (id, date, kind, summary, route, pr URL, screenshots that exist under `public/changes/`, `reverted` boolean or absent); `autopilot-log.mjs --next` is max id + 1.
- [x] **9.3** `agent/revert.test.mjs` (“up to 10 s”): a temporary repository with three merged branches and three log entries; `autopilot-revert.mjs 2` reverts the second merge, marks the entry, and refuses when entry 3 touched the same files, naming 3.
- [x] **9.4** `agent/jobs.test.mjs`: property test, 100 generated jobs over `runner.mjs`’s `KEYS`: `ask.mjs --dry-run`’s body → `parseIssue` → the same job; the same for voices’ fields. `status.mjs --json` over fixture `gh` output (queued, running, failed, runner down). `doctor.mjs` with a fake `LOCAL` tree: a boxed tool is reported boxed with its fix.
- [x] **9.5** `agent/workflows.test.mjs`: parse `gen3d.yml`, `voices.yml`, `ai-health.yml` (a small YAML reader or `yaml` dev dependency): every job on `[self-hosted, gpu]` has a `timeout-minutes`, a `concurrency` group, and an `if` that names the trusted conditions; `queue` and `check` jobs are on `ubuntu-latest`; `ci.yml`’s jobs are all `ubuntu-latest`.
- [x] **9.6** Gate, PR, CI green, merge.

## PR 10: The manual and the close

- [x] **10.1** `scripts/ai-e2e/README.md` complete: every tier, every command, every knob, how to add a sheet, a take, a scenario, a golden; what a red night means and what to do.
- [x] **10.2** `docs/architecture.md` Tests section rewritten: `npm test`, `npm run test:ai`, `npm run test:ai:render`, `npm run test:ai:gpu`, the nightly, the issue. `docs/desktop` and `docs/gen3d` READMEs point at the evals and the health run where they mention judging.
- [x] **10.3** `docs/autopilot/backlog.md`: the follow-ups found on the way (a brain whose promise was vague, an uncredited model, an orphan voice line), each one line.
- [x] **10.4** Gate, PR, CI green, merge. Report: what each tier found when first run against `main` (the allow-lists’ contents are the findings).
