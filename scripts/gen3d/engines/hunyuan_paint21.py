"""Hunyuan3D-2.1's PBR paint on a mesh (the multi-view one hunyuan.py makes):
base colour, metal and roughness maps from the front picture. Runs in WSL
in the `hy3d21` conda env (engines/hy3d21-setup.sh), from ~/Hunyuan3D-2.1.

    python hunyuan_paint21.py MESH.glb FRONT.png OUT.glb [--views 6] [--res 768]
"""

import argparse
import os
import shutil
import sys
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mesh")
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--views", type=int, default=6, help="views painted, 6 to 9")
    ap.add_argument("--res", type=int, default=768, help="each view's resolution, 512 or 768")
    ap.add_argument("--repo", default=os.path.expanduser("~/Hunyuan3D-2.1"))
    args = ap.parse_args()
    os.chdir(args.repo)  # its configs and checkpoints are relative paths
    sys.path.insert(0, os.path.join(args.repo, "hy3dpaint"))

    try:
        from torchvision_fix import apply_fix

        apply_fix()
    except Exception as e:  # noqa: BLE001
        print(f"torchvision fix not applied: {e}", flush=True)
    from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline

    conf = Hunyuan3DPaintConfig(args.views, args.res)
    conf.realesrgan_ckpt_path = "hy3dpaint/ckpt/RealESRGAN_x4plus.pth"
    conf.multiview_cfg_path = "hy3dpaint/cfgs/hunyuan-paint-pbr.yaml"
    conf.custom_pipeline = "hy3dpaint/hunyuanpaintpbr"
    t = time.time()
    paint = Hunyuan3DPaintPipeline(conf)
    print(f"paint model loaded in {time.time() - t:.0f}s", flush=True)
    t = time.time()
    made = paint(mesh_path=args.mesh, image_path=args.image, output_mesh_path=args.out)
    if made and os.path.abspath(made) != os.path.abspath(args.out):
        shutil.copyfile(made, args.out)
    print(f"painted {args.out} in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
