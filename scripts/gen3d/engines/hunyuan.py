"""Hunyuan3D-2 multi-view (tencent/Hunyuan3D-2mv): several pictures of one thing
(front, left, back, right: any one or more) in, one textured GLB out. Runs in
WSL in the `hy3d` conda env scripts/gen3d/README.md describes, from the
~/Hunyuan3D-2 checkout. Non-commercial licence (Tencent Hunyuan).

    python hunyuan.py OUT.glb --front F.png [--left L.png] [--back B.png] [--right R.png] [--seed N] [--steps 50] [--octree 380] [--faces 300000]

The shape model sees every view; the texture model paints from all of them
too (its multi-view paint). The GLB is the raw asset for bake.mjs / web.mjs.
"""

import argparse
import os
import sys
import time

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

VIEWS = ["front", "left", "back", "right"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    for v in VIEWS:
        ap.add_argument(f"--{v}")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--octree", type=int, default=380, help="marching-cubes grid; 380 is the model's top")
    ap.add_argument("--faces", type=int, default=300_000, help="faces kept before painting")
    ap.add_argument("--repo", default=os.path.expanduser("~/Hunyuan3D-2"))
    args = ap.parse_args()
    sys.path.insert(0, args.repo)
    os.chdir(args.repo)  # the texture pipeline reads its own config files by relative path

    import torch
    from PIL import Image

    from hy3dgen.rembg import BackgroundRemover
    from hy3dgen.shapegen import DegenerateFaceRemover, FaceReducer, FloaterRemover, Hunyuan3DDiTFlowMatchingPipeline
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    given = {v: getattr(args, v) for v in VIEWS if getattr(args, v)}
    if not given:
        sys.exit("at least one of --front --left --back --right")
    rembg = BackgroundRemover()
    images = {}
    for v, path in given.items():
        im = Image.open(path)
        images[v] = rembg(im.convert("RGB")) if im.mode != "RGBA" else im
    print(f"views: {', '.join(images)}", flush=True)

    t = time.time()
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("tencent/Hunyuan3D-2mv", subfolder="hunyuan3d-dit-v2-mv", variant="fp16")
    print(f"shape model loaded in {time.time() - t:.0f}s", flush=True)
    t = time.time()
    mesh = shape(image=images, num_inference_steps=args.steps, octree_resolution=args.octree, num_chunks=20000, generator=torch.manual_seed(args.seed), output_type="trimesh")[0]
    mesh = FloaterRemover()(mesh)
    mesh = DegenerateFaceRemover()(mesh)
    if len(mesh.faces) > args.faces:
        mesh = FaceReducer()(mesh, max_facenum=args.faces)
    print(f"shape in {time.time() - t:.0f}s: {len(mesh.faces)} faces, peak {torch.cuda.max_memory_allocated() / 1e9:.1f} GB", flush=True)
    del shape
    torch.cuda.empty_cache()

    t = time.time()
    paint = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2", subfolder="hunyuan3d-paint-v2-0-turbo")
    order = [images[v] for v in VIEWS if v in images]
    mesh = paint(mesh, image=order if len(order) > 1 else order[0])
    mesh.export(args.out)
    print(f"painted and exported {args.out} in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
