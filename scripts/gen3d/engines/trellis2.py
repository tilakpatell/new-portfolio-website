"""The reference TRELLIS.2 (microsoft/TRELLIS.2, bf16): one image in, one raw
textured GLB out. Runs in WSL, in the `trellis2` conda env scripts/gen3d/README.md
describes, from the ~/TRELLIS.2 checkout (it imports `trellis2` from there).

    python trellis2.py IMAGE OUT.glb [--seed N] [--faces N] [--tex N]

The GLB is the raw asset (up to --faces triangles, a --tex square PBR atlas,
WebP textures); web.mjs cuts it to the site's budget afterwards.
"""

import argparse
import os
import sys
import time

os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--faces", type=int, default=1_000_000, help="triangles to keep in the raw GLB")
    ap.add_argument("--tex", type=int, default=4096, help="texture atlas size")
    ap.add_argument("--repo", default=os.path.expanduser("~/TRELLIS.2"))
    args = ap.parse_args()
    sys.path.insert(0, args.repo)

    import torch
    from PIL import Image

    import o_voxel
    from trellis2.pipelines import Trellis2ImageTo3DPipeline

    t = time.time()
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    pipeline.cuda()
    print(f"loaded in {time.time() - t:.0f}s", flush=True)
    torch.manual_seed(args.seed)
    t = time.time()
    mesh = pipeline.run(Image.open(args.image), seed=args.seed)[0]
    mesh.simplify(16_777_216)  # nvdiffrast's limit
    print(f"generated in {time.time() - t:.0f}s, peak {torch.cuda.max_memory_allocated() / 1e9:.1f} GB", flush=True)
    t = time.time()
    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices, faces=mesh.faces, attr_volume=mesh.attrs, coords=mesh.coords, attr_layout=mesh.layout,
        voxel_size=mesh.voxel_size, aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
        decimation_target=args.faces, texture_size=args.tex, remesh=True, remesh_band=1, remesh_project=0, verbose=False,
    )
    glb.export(args.out, extension_webp=True)
    print(f"exported {args.out} in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
