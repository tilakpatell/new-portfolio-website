# Making the site's 3D models here

Concept image → 3D → web GLB, all on this machine's GPU, so a model can be
made and remade as often as it takes to get one right.

```
node scripts/gen3d/make.mjs x-wing --image photo.png --what "an X-wing starfighter"       # from your own picture, followed closely
node scripts/gen3d/make.mjs x-wing --prompt "an X-wing starfighter" --what "an X-wing"     # from words (Z-Image-Turbo draws it)
```

`make.mjs` runs the steps, each usable on its own:

```
node scripts/gen3d/prepare.mjs photo.jpg cache/xwing.png               # your picture trimmed, squared, 1024 (what the model expects)
node scripts/gen3d/picture.mjs "an X-wing starfighter" cache/xwing.png  # or a concept image from words
node scripts/gen3d/generate.mjs cache/xwing.png cache/raw/xwing.glb [--faithful]   # image → raw textured GLB, ~300k triangles
node scripts/gen3d/bake.mjs cache/raw/xwing.glb cache/xwing-low.glb --faces 24000  # the high mesh baked onto a low one (Blender)
node scripts/gen3d/web.mjs cache/xwing-low.glb x-wing --tris 24000 --tex 2048 --what "an X-wing starfighter"
node scripts/gen3d/judge.mjs cache/xwing.png cache/raw/xwing.glb public/models/gen3d/x-wing.glb   # four views each, side by side
```

A picture of your own goes through **Pixal3D** (`--faithful`, on by default
with `--image`): a TRELLIS.2 fine-tune that projects each 3D cell into the
picture and samples it there, so the shape follows what you gave it; pass
`--fov` if you know the camera's horizontal field of view. A prompt goes
through TRELLIS.2 proper. Either way the model is made at full quality
first (res 1024, ~300k triangles, 2048² PBR atlas) and only then cut down
for the web: simplifying the raw mesh directly smears its texture (its atlas
is thousands of tiny charts), so `bake.mjs` decimates it, unwraps the low
mesh afresh and bakes colour, roughness, metalness and a normal map from the
high one. Without Blender, `web.mjs` simplifies the raw mesh and stops where
the seams let it (~25k triangles).

`web.mjs` writes `public/models/gen3d/<name>.glb` (welded, simplified to the
triangle budget, WebP textures, meshopt: the same steps as
`scripts/meshy-import.mjs`) and credits it in `public/games/credits.json`.
It refuses a model over its budget or over 1 MB. Everything else lands in
`scripts/gen3d/cache/` (git-ignored).

## The engines

Two run the same model, Microsoft's TRELLIS.2-4B (MIT), from a single image:

| engine | where | weights | what it is |
|---|---|---|---|
| `trelliscpp` | Windows, CUDA | f16 GGUF, 16.5 GB | [trellis.cpp](https://github.com/pwilkin/trellis.cpp) v0.8.1: a C++/GGML port, no Python; ~80–220 s a model at res 1024 |
| `trellis2` | WSL (Ubuntu-24.04), CUDA | bf16, ~10 GB | the [reference implementation](https://github.com/microsoft/TRELLIS.2), PyTorch, with its six CUDA extensions |

`generate.mjs` uses `--engine`, else the first set up here. Judge them on the
same images with `judge.mjs` before trusting either on a new kind of subject.

### trellis.cpp (Windows)

Its installer is PowerShell 7 syntax (Windows PowerShell can't parse it), so
by hand, into `%LOCALAPPDATA%\trellis-studio`:

1. `runtime\`: unzip `trellis-cuda-windows-x64.zip` from the
   [latest release](https://github.com/pwilkin/trellis.cpp/releases/latest)
   (`trellis-cli.exe`, `trellis-server.exe`).
2. `models\`: the ten f16 files from
   [ilintar/trellis2-gguf](https://huggingface.co/ilintar/trellis2-gguf/tree/main):
   `birefnet dinov3 ss_flow ss_dec shape_flow_512 shape_flow_1024 shape_dec tex_flow_512 tex_flow_1024 tex_dec` (`.gguf`).

Needs an NVIDIA driver with CUDA 13 (610+). Blackwell (RTX 50) is fine.

### Reference TRELLIS.2 (WSL)

No sudo needed: a user-space conda with the CUDA toolkit in it. In WSL:

```
curl -L -o mf.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh && bash mf.sh -b -p ~/miniforge3
source ~/miniforge3/bin/activate && conda create -y -n trellis2 python=3.10 && conda activate trellis2
conda install -y -c nvidia/label/cuda-12.8.1 cuda-toolkit cuda-nvcc cuda-cudart-dev
export CUDA_HOME=$CONDA_PREFIX TORCH_CUDA_ARCH_LIST=12.0 MAX_JOBS=14
pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
git clone --recursive https://github.com/microsoft/TRELLIS.2 ~/TRELLIS.2 && cd ~/TRELLIS.2
pip install imageio imageio-ffmpeg tqdm easydict opencv-python-headless ninja trimesh transformers gradio==6.0.1 tensorboard pandas lpips zstandard "huggingface_hub[hf_xet]" kornia timm
pip install git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8
# flash-attn from a prebuilt wheel (cu128, torch 2.8, cp310): hours of compiling saved
pip install https://github.com/mjun0812/flash-attention-prebuild-wheels/releases/download/v0.7.16/flash_attn-2.8.3%2Bcu128torch2.8-cp310-cp310-linux_x86_64.whl
for r in "-b v0.4.0 https://github.com/NVlabs/nvdiffrast.git" "-b renderutils https://github.com/JeffreyXiang/nvdiffrec.git" "https://github.com/JeffreyXiang/CuMesh.git --recursive" "https://github.com/JeffreyXiang/FlexGEMM.git --recursive"; do git clone $r /tmp/ext && pip install /tmp/ext --no-build-isolation && rm -rf /tmp/ext; done
pip install ./o-voxel --no-build-isolation
hf download microsoft/TRELLIS.2-4B
```

`engines/trellis2.py` is what `generate.mjs` runs there (`wsl.exe`, the
paths translated to `/mnt/c/…`). TRELLIS.2 wants 24 GB of GPU memory.

### Pixal3D (for --faithful)

Five more GGUFs beside TRELLIS.2's, from
[vegax87/Pixal3D](https://huggingface.co/vegax87/Pixal3D):
`pixal3d_ss_flow pixal3d_shape_flow_512 pixal3d_shape_flow_1024 pixal3d_tex_flow_1024 pixal3d_naf` (`.gguf`).

### Blender (for bake.mjs)

A portable Blender 4.x unzipped under `%LOCALAPPDATA%lender\` (winget's
copy works too; `$BLENDER` points at any other). Cycles bakes on the GPU.

### Concept images

`picture.mjs` runs [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)
(the Windows CUDA 12 build, in `%LOCALAPPDATA%\sdcpp\bin`) with
Z-Image-Turbo: `models\z_image_turbo-Q8_0.gguf`
([leejet/Z-Image-Turbo-GGUF](https://huggingface.co/leejet/Z-Image-Turbo-GGUF)),
`models\Qwen3-4B-Instruct-2507-Q8_0.gguf` (unsloth) and `models\ae.safetensors`
(Comfy-Org/z_image_turbo). A good source image is most of a good model:
one object, front three-quarter view, plain white background, even light,
no text.

### Judging

`judge.mjs` renders through `scripts/glb-shot.mjs` (headless Chromium) and
a dev server serving the repository; on Windows:

```
CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" BASE=http://127.0.0.1:5299 node scripts/gen3d/judge.mjs out.png a.glb b.glb
```

The GPU is shared with `scripts/voices`: check `nvidia-smi` before a run.

## What was learned making the X-wing

- **A model is only as right as its picture.** From a Z-Image-Turbo concept
  the X-wing came out sharp and wrong (engines on the fuselage): the image
  model didn't know the design. FLUX.1-schnell knows it; a real reference is
  better still. A **render of the model the site already had**, on white
  (`scripts/preview/glb-shot.html?…&bg=ffffff`, prepared with `prepare.mjs`),
  gave TRELLIS.2 the right shape and it added the detail: engine intakes, the
  canopy frame, panel lines, five times the triangles at the same budget.
- **Show the whole shape.** A near-frontal concept hid the fuselage length and
  the model came out squat. Three-quarter, from slightly above, nose visible.
- **Pixal3D assumes a frontal camera**: fed a three-quarter render it kept
  the shape but tilted it. Use it for photos taken facing the subject, with
  `--fov` when known; use plain TRELLIS.2 for renders and concept art.
- **Cut, don't crush.** The raw atlas is thousands of charts; meshopt's
  simplifier stops at the seams (~25k triangles for a 300k mesh) and crossing
  them smears the texture. 24k triangles at 1536² is under 900 KB and looks
  the part; the Blender bake is the way below that.
- **Both engines, in order of use:** `trelliscpp` (f16 GGUF, ~2–4 minutes a
  model at res 1024 on the RTX 5090) does everything here. The reference
  `trellis2` is built in WSL but its image encoder (`facebook/dinov3`) is a
  gated Hugging Face repo: accept the licence and `hf auth login` in the
  `trellis2` conda env, and `--engine trellis2` works, with
  `decimation_target` baking straight onto a low mesh.
