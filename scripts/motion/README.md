# motion: a clip from words, on the owner's desktop

The site's figures stand on Meshy's 24-bone skeleton and play clips from
the library: Meshy's own, and Quaternius's Universal Animation Library baked
onto it (`scripts/ual-bake.mjs`). When the library has nothing for a move,
this makes one: [HY-Motion 1.0](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
turns a sentence into SMPL-H joint turns on the desktop's GPU, `generate.py`
writes them out as a BVH, `bvh-map.mjs` puts that BVH on UAL's `DEF-*`
names, and the same retarget that carries UAL's clips
(`scripts/preview/ualRetarget.js`) carries it onto Luke. The clip lands as
`public/games/meshy/ual-gen.NAME.glb`, laid out as the library's clips are,
so it plays on any Meshy figure the same way.

It started as a spike (can one sword stroke come out of words and read as a
strike?): `docs/research/2026-10-08-motion-spike.md` has what it found and
how to judge a clip.

```
issue (prompt)  →  motion.yml  →  self-hosted runner (gpu)  →  runner.mjs --auto
                →  generate.py in WSL: HY-Motion 1.0 → SMPL-H's 22 body joints → NAME.bvh
                →  bake.mjs: bvh-map.mjs (DEF-* names) → retargetUal onto Luke → ual-gen.NAME.glb
                →  sheet.mjs: four moments of it above four of sword.heavy.a (preview/motion.html)
                →  pull request: the clip, its BVH, its sheet, its credit
```

## Asking for a clip

```
node scripts/desktop/ask.mjs motion overhead-strike --prompt "a two-handed overhead sword strike, stepping forward"
node scripts/desktop/ask.mjs motion parry --prompt "a person raises a sword high to block, then steps back" --seconds 2 --options "seed: 7  with: sword.block"
```

or the *Motion clip* issue form, or Actions → *motion* → *Run workflow*.
Add `--dry-run` to see the issue first. The fields (`runner.mjs` has them):

| field | what | default |
|---|---|---|
| `prompt` | what the body does, in English, under 60 words | (needed) |
| `seconds` | 1 to 10; under 5 keeps the model under 26 GB | 3 |
| `seed` | another take | 42 |
| `cfg` | how closely to follow the words (HY-Motion's guidance scale) | 5 |
| `model` | `lite`: HY-Motion-1.0-Lite (0.46B, 24 GB) | the 1B |
| `with` | the library clip the sheet puts it beside | `sword.heavy.a` |

**What makes a good prompt** (HY-Motion's guide): the body's movement, the
limbs and the torso, in order ("raises the sword over the head with both
hands, steps forward on the left foot and brings it down hard"). It can't do
props, places, cameras, a second person, emotions or loops, so say "both
hands together above the head" rather than "holding a sword", and expect to
choose between seeds.

The desktop answers as gen3d and voices do (`scripts/desktop/README.md`):
the issue says *Started*, *Made* (with the pull request) or *Failed* (with
the log's tail). `node scripts/desktop/status.mjs` shows the queue.

## Looking at one

```
npx vite --port 5188
open http://127.0.0.1:5188/scripts/preview/motion.html?clip=overhead-strike          # beside sword.heavy.a, looping
     …&with=sword.a  …&slow=4                                                       # another library clip; a quarter speed
node scripts/motion/sheet.mjs overhead-strike out.png                               # the four-moment sheet the PR carries
```

## By hand

```
python generate.py "a two-handed overhead sword strike" out.bvh --seconds 3 --seed 42     # in WSL, the hymotion env
python generate.py --npz cache/NAME/NAME_000.npz out.bvh                                  # an earlier run's NPZ, written again
node scripts/motion/bake.mjs out.bvh NAME [--out DIR] [--prompt "…"]                      # onto Luke, as ual-gen.NAME.glb
node scripts/motion/runner.mjs --issue N                                                  # one issue, as the workflow runs it
```

The BVH is SMPL-H's frame and the model's own skeleton: metres, +y up,
facing +z, the figure's left at +x, 30 frames a second, the hips with six
channels (travel from rest, then turn) and every other joint three, `Z X Y`.
Fingers are left out (Meshy's hands are mittens). `bvh-map.test.mjs` checks
the writer against the model's forward kinematics (where a Python with numpy
is about) and the map through `retargetUal` onto the Meshy fixture: every one
of the 22 bones, the left arm on the left.

## Setting it up (once, in WSL)

In the same Ubuntu as gen3d's TRELLIS.2 (`GEN3D_WSL_DISTRO`, else
`Ubuntu-24.04`; `MOTION_WSL_DISTRO` for another), with Miniforge at
`~/miniforge3`:

```
cd ~ && git clone https://github.com/Tencent-Hunyuan/HY-Motion-1.0.git && cd HY-Motion-1.0
git lfs install && git lfs pull                       # the skeleton (j_template.bin, kintree.bin) is in LFS
~/miniforge3/bin/conda create -y -n hymotion python=3.11
source ~/miniforge3/bin/activate hymotion
# the repo pins torch 2.5.1, which has no kernels for the 5090 (Blackwell, sm_120): take a CUDA 12.8 build instead
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
grep -v -E '^(torch|torchvision|fbxsdkpy)==' requirements.txt > /tmp/hymotion-req.txt && pip install -r /tmp/hymotion-req.txt
huggingface-cli download tencent/HY-Motion-1.0 --include "HY-Motion-1.0/*" --local-dir ckpts/tencent          # and "HY-Motion-1.0-Lite/*" for model: lite
huggingface-cli download openai/clip-vit-large-patch14 --local-dir ckpts/clip-vit-large-patch14
huggingface-cli download Qwen/Qwen3-8B --local-dir ckpts/Qwen3-8B                                             # the text encoder, ~16 GB
```

The FBX SDK (`fbxsdkpy`) is left out: the runner asks for the joints, not
an FBX. Check with `node scripts/desktop/doctor.mjs` (the *motion* group), or
from anywhere with `gh workflow run desktop-doctor.yml`.

The job waits for 26 GB of the GPU to be free (`MOTION_VRAM_MIB`), as
HY-Motion's README asks for the 1B; the Qwen3-8B text encoder is most of it.
A `~/.desktop-jobs/motion.lock` keeps the runner off while you run
`generate.py` by hand.

## Licence

HY-Motion 1.0 is under the **Tencent HY-Motion 1.0 Community License**,
which grants nothing in the **European Union, the United Kingdom or South
Korea**: its territory is the world without them, and section 5(c) says the
model's output may not be used, distributed or displayed outside it. Tencent
claims no rights in the output otherwise (6(d)), and a site under a million
monthly users needs no further licence (section 4). A clip made here and
shipped on a public site is shown to visitors in those places too; the spike
note says what that means for shipping one. Each clip's credit in
`public/games/credits.json` names the licence and the exclusion.

## The files

| file | what |
|---|---|
| `generate.py` | HY-Motion 1.0 → SMPL-H's 22 body joints → BVH (and `--npz`, `--check`) |
| `bvh-map.mjs` | SMPL-H's joints → UAL's `DEF-*` names; a BVH as a mannequin for `retargetUal` |
| `bake.mjs` | a BVH onto Luke → `public/games/meshy/ual-gen.NAME.glb` |
| `sheet.mjs` | the four-moment sheet, through `scripts/preview/motion.html` |
| `runner.mjs` | the desktop job: an issue to a pull request (`scripts/desktop/jobs.mjs`) |
| `../../.github/workflows/motion.yml`, `../../.github/ISSUE_TEMPLATE/motion.yml` | the workflow and the issue form |
| `../ai-e2e/fakes/motion.mjs`, `../ai-e2e/contract/motion-runner.test.mjs` | the fake model and the job's contract test |
