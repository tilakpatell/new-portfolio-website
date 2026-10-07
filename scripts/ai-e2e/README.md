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

The fakes share knobs (`fakes/common.mjs`):

- `GEN3D_FAKE_FAIL_AT=generate|bake|picture`: that fake exits 1 (the engine
  after writing half its file, as a crash would), so a test can kill a run
  at a step and watch the next one resume there.
- `GEN3D_FAKE_TRIS=N` (or the engine's `--tris N`): a grid of at least N
  triangles, so a budget test can overshoot.
- `GEN3D_FAKE_SLEEP=S`: each fake waits first, for the timeout paths.
- `GEN3D_FAKE_LOG=file`: each fake appends `{ tool, argv }` as a line of JSON.

## Adding a case

A contract test is a vitest file under `scripts/ai-e2e/<tier>/`, its
fixtures in `fixtures/` beside it. A test that spawns a pipeline says “up to
10 s” in its `describe` name; anything else runs under a second and touches
no network.

## The nightly (tiers 5 and 6)

`npm run test:ai:gpu` runs the real engines and the judges' evaluations on
the desktop. Until those land it says which part is missing and fails, so it
can't pass by doing nothing.
