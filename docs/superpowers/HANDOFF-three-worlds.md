# Handoff: Coruscant, Yavin 4 and Bespin made whole

The spec: `docs/superpowers/specs/2026-10-07-three-worlds-design.md`. The plan: `docs/superpowers/plans/2026-10-07-three-worlds.md` (ticked boxes are done). Run it inline with superpowers:executing-plans: the user asked for no subagents and no workflows, and for each PR section merged to main (merge commit, never a rebase) once its checks are green.

## Where it stands (7 October 2026)

**PR 1, the look engine on every world (Tasks 1–6): done on `claude/three-worlds-plan-9dc25b`, not merged yet.** It is pushed, with `origin/main` merged in. What it does is in `HANDOFF-galaxy-surfaces.md`'s "The house look on the galaxy's worlds" section and in `docs/architecture.md`.

What PR 1 still needs before its merge:

1. `npm ci`, then `npm test`. The suite of the galaxy and `lib` passed: 1135 tests. The full run failed only on `nostr.test.js`, from a stale install.
2. `npm run build` and `node scripts/health.mjs --check --skip build`.
3. `galaxy-check.mjs surface` on all 17 worlds against a baseline from main. The baseline was taken (main: Tatooine 67 calls / 554k tris, Hoth 237 / 1.07M, Naboo 371 / 880k, Coruscant 209 / 1.01M, Bespin 180 / 322k). The branch run was stopped before it finished.
4. Fetch, merge `origin/main` in, trial-merge against the open branches (below), then `gh pr create` ("The galaxy's worlds, through the house look") and `gh pr merge --merge`.

Checked so far: lint is clean. Headless shots of all 17 worlds at their landings (before and after) show no page errors and no blow-out on Mustafar's lava or Hoth's snow. The grass is drawn on Naboo, Scarif, Lothal and Sorgan in its own colours. The `?debug` panel draws. The branch has had a self-review only (no subagents were allowed), so it has had no fresh review.

**Next: PR 2, Coruscant (Task 7).** Then PR 3 Yavin 4 (Tasks 11–12), PR 4 Bespin (Tasks 13–15), PR 5 the models (Tasks 16–17, Meshy and Sketchfab), PR 6 the people (Tasks 18–19, after the NPC intelligence plan's Tasks 15–16), PR 7–8 the allegiance plan's PR 2–6, and PR 9 the war on the ground (Tasks 20–22).

An earlier run of Tasks 1–4 in a cloud session was never pushed and was lost; everything here was redone on `claude/three-worlds-plan-9dc25b`.

## Decisions taken in PR 1 (the later tasks build on them)

- **Tone mapping.** The surface's post tone-maps with its own shoulder (`universe/post.js`), and its renderer has none. So the house's tone mapper and its ×1.4 exposure lift are not used. `exposureOf(site)` is the site's own `exposure` (default 1), set through `post.exposure`. A world that reads too dark or too bright gets an `exposure` in its site.
- **Fog.** The house is made with `fog: false` (the look's own key, `createHouse({ ...look, fog: false })`, as PR #448 has it). The fog stays `skyfog.js`'s, the dome's colour, and `skyFog.look({ halo, below })` takes the site look's `halo` and `fogBelow`. Tasks 7, 11 and 13 give those keys; they work.
- **Adopting.** `warm()` adopts each object before its shaders are made. `house.adopt(scene)` runs once the floor's light is baked, and again every 2 s, to catch anything built without `warm`. There is no `adopt` option on the placer, the actors or the activity. Zones and quest spawns (Tasks 9, 12, 14, 15) need nothing more.
- **Marks a copy doesn't take.** `userData.house` and `userData.core` are not enumerable. A clone made after adoption (props/core.js and edge.js clone `kit.mats.paint`) is then adopted again, and it doesn't drag textures through JSON.
- **The ground map.** `SCATTER[kind].canopy` is a crown radius in metres at scale 1 (jungletree 10, redwood 7, wroshyr 10, gnarltree 6). Task 11 only adds `grass` to Yavin's site. Where grass grows, the map paints the grass's own `mid`→`dry` colour, so the blades (which take the map's colour) keep each world's grass colour.
- **The core kit.** World-space scans slide over things that move. Built rides, prop figures and carried props get UV-dressed twins (`kit.moving`). Worn materials keep their own roughness and metalness, because `wear` brings no ARM picture. `wear: 'role'` on a thing lays a scan over a loaded model (`placer.js`'s `wearModel`).
- **Attribution.** Commits end with this session's own `Co-Authored-By` line, not the plan's.

## Open branches that touch the same code

- **PR #448** (`claude/magical-bell-xabvq1`, another session) also puts the galaxy's surfaces on the house look, its own way: a shadow colour from the sky light each frame (`shadowFor`), adopting the scene every frame. Its `house.js` merges cleanly with this branch, but `galaxy/surface/scene.js` conflicts. Whoever merges second should keep this branch's way, the site's look from `look.js` (the spec's per-world looks need it). Drop #448's surface hunks: the `createHouse` after the hemisphere light, the `shadowFor` per frame and the per-frame `adopt`. #448's `light({ env })` and `houseOn` are for other worlds and stay.
- **`claude/happy-clarke-uahdd1`** (Endor's close set) adds `fog: false` and `url` to the placer. It merges cleanly with this branch except for `src/data/health/latest.json`, which it already conflicts on with main.

## Doing it on this Mac

- **Dev server.** The Bash sandbox refuses to bind local ports (EPERM). Run Vite in-process outside the sandbox, or set `sandbox.network.allowLocalBinding: true`. `gh` needs the sandbox off too (its TLS check fails inside it).
- **Pictures.** `scripts/surface-shot.mjs` and `scripts/galaxy-check.mjs` take `CHROME=` (Playwright's `~/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`) and `BASE=`. galaxy-check draws on SwiftShader, at about a minute a world. For a baseline from main, use a detached `git worktree` of `origin/main` with `node_modules` linked in. The fonts 403 there; ignore them.
- **Stale installs.** A worktree's `node_modules` can be days stale (`@noble/secp256k1` missing breaks `nostr.test.js` and the build). Run `npm ci` before the gates.
- **Gates before every push:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`. Surface PRs also run `galaxy-check.mjs surface` on the worlds touched, against a baseline from main. Never go over 600 draw calls or 2.5M triangles, and allow no page error.
- **Merging.** Merge `origin/main` in, and trial-merge against every unmerged branch (`git merge-tree --write-tree --name-only HEAD <branch>`, compared with the same against `origin/main`). Then `gh pr create` and `gh pr merge --merge`. If the classifier refuses the merge, leave the PR green and say so.

## Left to tune (not blocking)

- Each world beyond the three has the default look made from its sky. Grass worlds read paler and with less contrast than before (the house's rule: a blade's root is the look's shade colour). Tune a world in `?debug` and paste the copied `look`, `exposure` and `grass` blocks into its site.
- The ground's bounce (`house.ground`, strength 0.5) tints legs strongly on bright grass. It is on the `?debug` panel.
