# The motion spike: a sword stroke from words, on Meshy's skeleton (2026-10-08)

Lane G of the combat revamp (`docs/superpowers/plans/2026-10-08-combat-revamp.md`, Task G1; the design's §10). The question: can the owner's RTX 5090 desktop make a sword-stroke clip from a sentence with HY-Motion 1.0, and land it on Meshy's 24-bone skeleton through the UAL retarget the site already uses, well enough that it reads as a strike beside UAL2's `Sword_Heavy_A`? This note says what was built, what the desktop will do with it, what is known so far, and how to judge the clip when the desktop's pull request comes. The verdict itself waits for that pull request.

## 1. What was built

All of it in `scripts/motion/` (its README is the manual), the desktop's job pattern copied from gen3d:

- **`generate.py`**: HY-Motion 1.0 (`T2MRuntime.generate_motion`, prompt rewriting and duration guessing off: those are another 8B model, and the asker gives the prompt and the length) → the 22 body joints' turns (its 6D rotations, as matrices) and the hips' travel → a BVH. The rest is the model's own skeleton (`j_template.bin`, the T-pose its forward kinematics stand on), checked against SMPL-H's kinematic tree before anything is written. No FBX SDK, no ComfyUI wrapper: the exporter is sixty lines of numpy (turns to `Z X Y` Euler angles per frame, the hips' travel as the root's position).
- **`bvh-map.mjs`**: SMPL-H's 22 body joints onto the 22 `DEF-*` bones `ualRetarget.js`'s `UAL_MAP` covers. The two bodies are the same joints in the same chains (hips, three spine, neck, head; collar, upper arm, forearm, hand; thigh, shin, ankle, toes), so the map is a renaming and `ualRetarget.js` needed no change. The 30 finger joints have nowhere to go on Meshy's mittens and are left out.
- **`bake.mjs`**: the BVH, renamed, through `retargetUal` onto Luke at rest, written as `public/games/meshy/ual-gen.NAME.glb` in the library's layout (the same 25 nodes and 23 channels as `ual-sword.heavy.glb`, the hips' height in its extras), plus `extras.strike`: when the hands move fastest relative to the hips. It is its own small writer because `ual-bake.mjs`'s `bake()` isn't exported and that file is the sword lane's.
- **`scripts/preview/motion.html`** and **`sheet.mjs`**: the clip on Luke beside a library clip (`sword.heavy` by default), looping, or as a sheet of four moments each (start, strike, halfway on, end) from the figure's right-front.
- **The job**: `runner.mjs` (parse, request, make, through `scripts/desktop/jobs.mjs`), `.github/workflows/motion.yml` (queue and check on GitHub's runners, `make` on `[self-hosted, gpu]` for the owner's and collaborators' issues only, two hours at most), the *Motion clip* issue form, `motion` in `ask.mjs`, `status.mjs` and the doctor. It waits for 26 GB of free GPU memory (`MOTION_VRAM_MIB`), as HY-Motion's README asks of the 1B.

Tested here: the map covers the 22 bones once each and keeps every chain's parent; a synthetic BVH (the left arm raised 80°, the hips 0.3 m forward) through `retargetUal` onto the Meshy fixture gives all 22 bones a track, nothing undefined, raises the left hand and not the right, and carries the hips forward; `generate.py`'s writer, on a seeded random motion, reads back through three's `BVHLoader` with every joint within a millimetre of where HY-Motion's own forward kinematics put it; the bake writes the library's layout; and a motion issue goes end to end through the runner with the fake `gh` and a fake model (the clip, its BVH and its credit pushed, the pull request and the comments as gen3d's are), and fails cleanly with no prompt or a dying model.

## 2. What the desktop will do

The ask is issue-driven like gen3d's: `node scripts/desktop/ask.mjs motion overhead-strike --prompt "a two-handed overhead sword strike, stepping forward"`. When the desktop is awake its runner takes it: three seconds at seed 42 and cfg 5 with the 1B; the BVH baked onto Luke; the sheet beside `sword.heavy`; a pull request on `motion/overhead-strike` with `ual-gen.overhead-strike.glb`, `docs/motion/overhead-strike.bvh`, `docs/motion/overhead-strike.png` and a credit.

Before the first run the desktop needs HY-Motion set up in WSL (`scripts/motion/README.md`, *Setting it up*); until then the job fails with a hint that says so, and `node scripts/desktop/doctor.mjs` shows it under *motion*. Two things could stop the first run that couldn't be tried from here:

- **Blackwell.** The repository pins `torch==2.5.1`, which has no kernels for the 5090's sm_120. The setup takes a CUDA 12.8 build of PyTorch in its place; if HY-Motion's code leans on something 2.5-only, that's the first fix.
- **Memory.** 26 GB for the 1B is most of the card, and the Qwen3-8B text encoder is most of that. Anything else on the GPU (a game, a voices run) makes the job wait; `model: lite` (24 GB) is the fallback.

## 3. The licence: the finding that may decide it

HY-Motion 1.0 is under the Tencent HY-Motion 1.0 Community License, read from the repository's `License.txt`. It is free for any purpose, Tencent claims no rights in what it makes (6(d)), and a site with under a million monthly users needs nothing more (section 4). But its territory is the world **without the EU, the UK and South Korea**, and section 5(c) says the model's *output* may not be used, distributed or *displayed* outside it.

A clip shipped on a public website is displayed to whoever visits, the EU and the UK included. So shipping a HY-Motion clip on tilakpatell.com as it stands is outside what the licence grants, however well it reads. (If the owner is in one of those places, running it at all is.) This isn't a legal opinion; it's the plain reading, and it's the owner's call. The ways on, if the clip reads well:

1. **Use it as a reference, not an asset**: the judgement shows whether a generated stroke reads; the shipped clip stays the library's, or is keyed by hand to match it.
2. **A model with a licence that fits**: MoMask (MIT code, BVH straight out of `gen_t2m.py`, but trained on HumanML3D, whose data is non-commercial: a personal site may fit, and its quality is lower), or GVHMR/TRAM from a filmed reference (the research audit's §3). The rest of this pipeline (BVH → `bvh-map.mjs` → the retarget → the bake → the sheet) takes any SMPL-family BVH unchanged.
3. **Ask Tencent** (hunyuan3d@tencent.com) whether a clip baked into a free personal site's assets counts.

Every credit the runner writes names the licence and the exclusion, so a clip that lands on `main` by mistake says so.

## 4. What "reads as a strike" means

Judge from the pull request's sheet first, then `scripts/preview/motion.html?clip=overhead-strike` on the dev server (`&slow=4` to step through it), beside `sword.heavy` at the same camera. It reads as a strike when all of these hold:

1. **Three beats**: a wind-up (both hands rise to or above the head), a strike (the hands come down fast in front of the body, from above the head to about the waist), a recovery (they slow and settle). `extras.strike`, the hands' fastest moment, falls inside the clip's middle, not at its edges.
2. **Two hands on one grip**: the wrists stay within about a hand's width of each other (under 0.25 m) from the top of the wind-up through the strike. Two hands drifting apart reads as a flail, not a sword.
3. **A step into it**: the hips travel forward, 0.2 to 0.6 m, in the strike's direction; the lead foot plants and stays planted through the blow (no sliding: `node scripts/anim-check.mjs` on a figure playing it, within the limit the library's clips meet); no foot through the floor.
4. **Forward**: the blow lands along the figure's facing, not off to a side; the torso pitches into it and the head stays up and facing the target.
5. **Clean on Meshy's rig**: no flipped wrists, elbows bending the wrong way, shoulders popping or the spine twisting where the T-pose to A-pose rest difference could show; the hands' path matches the BVH's (the sheet's four moments against the same moments in a BVH viewer, if any doubt).
6. **Usable as a stroke**: it can be cut to its active part (sword.heavy is 0.73 s; a three-second clip will carry idle before and after), it starts and ends near a guard the saber's idle can blend from and to, and at the game camera's distance it reads as heavy, not floaty: a pause at the top, a fast fall.

A clip that meets 1 to 5 reads as a strike; 6 says whether it's worth wiring. One that fails 1 or 2 on the first seed gets one more round (seeds 7 and 11, or the prompt in HY-Motion's own style: "A person raises a sword above the head with both hands, steps forward and swings it down hard") before the verdict.

## 5. The verdict and the next step

Not yet: it waits for the desktop's pull request. When it comes, this section gets the sheet, the six checks above one by one, and one of:

- **It reads, and the licence question has an answer that allows it**: the `motion` job stays as the way to make strokes the library lacks; the clip is cut to its active part and wired as a stroke in the sword lane's clip table (a separate change), with its contact window from `extras.strike`.
- **It reads, but the licence stands**: the clip stays off `main`; the pipeline stays, pointed at a model whose licence fits (section 3, option 2), and the next spike is the same stroke from MoMask or from a filmed reference through GVHMR.
- **It doesn't read**: why (which of the six failed), and the library's 254 clips, UAL2's twenty-two unbaked sword clips first, are what there is.
