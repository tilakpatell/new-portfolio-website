"""HY-Motion 1.0 (Tencent-Hunyuan/HY-Motion-1.0): one prompt in, one BVH of
SMPL-H's 22 body joints out, for scripts/motion/bvh-map.mjs to put on UAL's
names and scripts/preview/ualRetarget.js to carry onto Meshy's skeleton.
Runs in WSL on the desktop, in the `hymotion` conda env from the
~/HY-Motion-1.0 checkout (scripts/motion/README.md says how to set it up).

    python generate.py PROMPT OUT.bvh [--seconds 3] [--seed 42] [--cfg 5] [--lite] [--repo ~/HY-Motion-1.0]
    python generate.py --npz SAMPLE.npz OUT.bvh [--repo …]    an earlier run's NPZ, written out again
    python generate.py --check DIR                             a seeded random motion and where its joints
                                                               should stand (bvh-map.test.mjs reads both)

The BVH: metres, +y up, facing +z (SMPL-H's own frame), 30 frames a second.
The hips carry six channels (their travel from rest, the clip's floor moved
onto the rest's by grounded(), then their turn), every
other joint three, all Z X Y as BVH's habit is. The rest is HY-Motion's own
skeleton (its j_template), so the clip's rest is the model's T-pose. Fingers
are left out: Meshy's hands are mittens. The model's NPZ and its rewrite of
the prompt stay beside the BVH, so a judgement can go back to them.
"""

import argparse
import json
import os
import sys

import numpy as np

# SMPL-H's body, in its own order (HY-Motion's joint_names.json), and each
# joint's parent: the same as bvh-map.mjs's SMPLH_BODY and SMPLH_PARENTS
BODY = ["Pelvis", "L_Hip", "R_Hip", "Spine1", "L_Knee", "R_Knee", "Spine2", "L_Ankle", "R_Ankle", "Spine3", "L_Foot", "R_Foot",
        "Neck", "L_Collar", "R_Collar", "Head", "L_Shoulder", "R_Shoulder", "L_Elbow", "R_Elbow", "L_Wrist", "R_Wrist"]
PARENTS = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19]
FPS = 30


def rodrigues(aa):
    """Axis-angles (..., 3) → rotation matrices (..., 3, 3)."""
    angle = np.linalg.norm(aa, axis=-1, keepdims=True)
    axis = aa / np.maximum(angle, 1e-12)
    x, y, z = axis[..., 0], axis[..., 1], axis[..., 2]
    c, s = np.cos(angle[..., 0]), np.sin(angle[..., 0])
    t = 1 - c
    m = np.stack([t * x * x + c, t * x * y - s * z, t * x * z + s * y,
                  t * x * y + s * z, t * y * y + c, t * y * z - s * x,
                  t * x * z - s * y, t * y * z + s * x, t * z * z + c], axis=-1)
    return m.reshape(*aa.shape[:-1], 3, 3)


def zxy(m):
    """Rotation matrices (..., 3, 3) → Z, X, Y angles in degrees, as BVH's
    `Zrotation Xrotation Yrotation` composes them (Rz · Rx · Ry)."""
    sx = np.clip(m[..., 2, 1], -1.0, 1.0)
    x = np.arcsin(sx)
    lock = np.abs(sx) > 0.999999
    z = np.where(lock, np.arctan2(m[..., 1, 0], m[..., 0, 0]), np.arctan2(-m[..., 0, 1], m[..., 1, 1]))
    y = np.where(lock, 0.0, np.arctan2(-m[..., 2, 0], m[..., 2, 2]))
    return np.degrees(np.stack([z, x, y], axis=-1))


def fk(rots, trans, rest):
    """Where each joint stands, frame by frame (L, 22, 3), as HY-Motion's own
    simple_lbs stands them: a joint's turn is in its parent's frame, its
    offset its rest position less its parent's, the hips at rest plus trans."""
    frames = rots.shape[0]
    world_r = np.zeros((frames, 22, 3, 3))
    world_p = np.zeros((frames, 22, 3))
    for i, p in enumerate(PARENTS):
        if p < 0:
            world_r[:, i] = rots[:, i]
            world_p[:, i] = rest[i] + trans
        else:
            world_r[:, i] = world_r[:, p] @ rots[:, i]
            world_p[:, i] = world_p[:, p] + np.einsum("fij,j->fi", world_r[:, p], rest[i] - rest[p])
    return world_p


def grounded(rots, trans, rest):
    """HY-Motion's trans stands the body on its own floor (y = 0), a metre and
    more above where the rest skeleton's feet are; the retarget reads the
    hips' channels as travel from rest, so a clip written as it comes floats
    that high. The clip's floor is moved onto the rest's: the lowest any joint
    goes over the clip, as low as the rest's lowest."""
    drop = fk(rots, trans, rest)[..., 1].min() - rest[:, 1].min()
    return trans - np.array([0.0, drop, 0.0])


def bvh(rots, trans, rest, fps=FPS):
    """Turns (L, 22, 3, 3) in each parent's frame, the hips' travel (L, 3) and
    the rest (22, 3) → a BVH's text."""
    kids = [[j for j, p in enumerate(PARENTS) if p == i] for i in range(22)]
    num = lambda v: "0" if abs(v) < 5e-7 else f"{v:.6f}".rstrip("0").rstrip(".")
    lines = ["HIERARCHY"]
    order = []

    def joint(i, depth):
        order.append(i)
        pad = "  " * depth
        off = rest[i] if PARENTS[i] < 0 else rest[i] - rest[PARENTS[i]]
        lines.extend([f"{pad}{'ROOT' if i == 0 else 'JOINT'} {BODY[i]}", f"{pad}{{", f"{pad}  OFFSET {' '.join(num(v) for v in off)}"])
        lines.append(f"{pad}  CHANNELS {'6 Xposition Yposition Zposition ' if i == 0 else '3 '}Zrotation Xrotation Yrotation")
        for k in kids[i]:
            joint(k, depth + 1)
        if not kids[i]:
            # a leaf's end, a short way on along its bone (BVH wants one; nothing reads it)
            d = rest[i] - rest[PARENTS[i]]
            end = d / (np.linalg.norm(d) or 1.0) * 0.08
            lines.extend([f"{pad}  End Site", f"{pad}  {{", f"{pad}    OFFSET {' '.join(num(v) for v in end)}", f"{pad}  }}"])
        lines.append(f"{pad}}}")

    joint(0, 0)
    angles = zxy(rots)
    lines.extend(["MOTION", f"Frames: {rots.shape[0]}", f"Frame Time: {num(1.0 / fps)}"])
    for f in range(rots.shape[0]):
        lines.append(" ".join(num(v) for v in [*trans[f], *angles[f, order].reshape(-1)]))
    return "\n".join(lines) + "\n"


def rest_of(repo):
    """HY-Motion's skeleton at rest: its j_template (52 joints, the body first)
    and its kintree, which must be SMPL-H's for the map to hold."""
    folder = os.path.join(repo, "scripts", "gradio", "static", "assets", "dump_wooden")
    joints = np.fromfile(os.path.join(folder, "j_template.bin"), dtype=np.float32)
    parents = np.fromfile(os.path.join(folder, "kintree.bin"), dtype=np.int32)
    if joints.size < 66:
        sys.exit(f"{folder}/j_template.bin is {joints.size * 4} bytes: run `git lfs pull` in {repo}")
    if list(parents[1:22]) != PARENTS[1:]:
        sys.exit(f"HY-Motion's kintree isn't SMPL-H's body ({list(parents[:22])}): the map in bvh-map.mjs no longer holds")
    return joints.reshape(-1, 3)[:22].astype(np.float64)


def from_npz(path, rest, out):
    """An NPZ HY-Motion wrote (poses: axis-angles for 52 joints, trans) → the BVH."""
    data = np.load(path)
    rots = rodrigues(data["poses"].reshape(data["poses"].shape[0], -1, 3)[:, :22])
    write(out, bvh(rots, grounded(rots, data["trans"].astype(np.float64), rest), rest))


def generate(args):
    repo = os.path.abspath(os.path.expanduser(args.repo))
    model = os.path.join(repo, "ckpts", "tencent", "HY-Motion-1.0-Lite" if args.lite else "HY-Motion-1.0")
    for f in ("config.yml", "latest.ckpt"):
        if not os.path.exists(os.path.join(model, f)):
            sys.exit(f"no {f} in {model}: download the weights (scripts/motion/README.md)")
    rest = rest_of(repo)
    # HY-Motion reads its text encoders and skeleton by paths relative to its checkout
    os.chdir(repo)
    sys.path.insert(0, repo)
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    import time

    import torch
    from hymotion.utils.geometry import rot6d_to_rotation_matrix
    from hymotion.utils.t2m_runtime import T2MRuntime

    t = time.time()
    # (no prompt rewriting or duration guess: that is another 8B model, and the prompt and length are the asker's)
    runtime = T2MRuntime(config_path=os.path.join(model, "config.yml"), ckpt_name=os.path.join(model, "latest.ckpt"), disable_prompt_engineering=True)
    print(f"loaded in {time.time() - t:.0f}s", flush=True)
    out_dir = os.path.dirname(os.path.abspath(args.out))
    name = os.path.splitext(os.path.basename(args.out))[0]
    t = time.time()
    _, _, output = runtime.generate_motion(text=args.prompt, seeds_csv=str(args.seed), duration=args.seconds, cfg_scale=args.cfg,
                                           output_format="dict", output_dir=out_dir, output_filename=name)
    print(f"generated in {time.time() - t:.0f}s, peak {torch.cuda.max_memory_allocated() / 2**30:.1f} GiB", flush=True)
    rots = rot6d_to_rotation_matrix(output["rot6d"][0, :, :22].float()).numpy().astype(np.float64)
    trans = output["transl"][0].float().numpy().astype(np.float64)
    write(args.out, bvh(rots, grounded(rots, trans, rest), rest))


def check(folder):
    """A seeded random motion (turns up to a radian, the hips wandering) on a
    made-up T-pose, as a BVH, and where FK stands its joints."""
    rng = np.random.default_rng(7)
    rest = np.array([[0, .95, 0], [.09, .86, 0], [-.09, .86, 0], [0, 1.06, -.01], [.1, .48, 0], [-.1, .48, 0], [0, 1.19, 0],
                     [.1, .08, -.02], [-.1, .08, -.02], [0, 1.25, .01], [.11, .02, .1], [-.11, .02, .1], [0, 1.47, -.01],
                     [.07, 1.39, 0], [-.07, 1.39, 0], [0, 1.58, .03], [.17, 1.42, -.01], [-.17, 1.42, -.01], [.43, 1.4, -.03],
                     [-.43, 1.4, -.03], [.68, 1.41, -.02], [-.68, 1.41, -.02]])
    frames = 6
    aa = rng.uniform(-1, 1, (frames, 22, 3))
    aa[1] = 0  # (and one frame at rest)
    rots = rodrigues(aa)
    trans = rng.uniform(-0.3, 0.3, (frames, 3))
    os.makedirs(folder, exist_ok=True)
    write(os.path.join(folder, "check.bvh"), bvh(rots, trans, rest))
    with open(os.path.join(folder, "check.json"), "w") as f:
        json.dump({"fps": FPS, "frames": fk(rots, trans, rest).round(6).tolist()}, f)


def write(path, text):
    with open(path, "w", newline="\n") as f:
        f.write(text)
    print(f"wrote {path}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--seconds", type=float, default=3.0, help="the clip's length (under 5 keeps HY-Motion under 26 GB)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--cfg", type=float, default=5.0, help="how closely to follow the prompt (HY-Motion's default)")
    ap.add_argument("--lite", action="store_true", help="HY-Motion-1.0-Lite (0.46B, 24 GB) in place of the 1B")
    ap.add_argument("--repo", default="~/HY-Motion-1.0")
    ap.add_argument("--npz", help="an NPZ HY-Motion wrote, written out as the BVH (no model)")
    ap.add_argument("--check", metavar="DIR", help="write check.bvh and check.json for bvh-map.test.mjs")
    args = ap.parse_args()
    if args.check:
        return check(args.check)
    if args.npz:
        out = args.out or args.prompt
        if not out:
            ap.error("--npz SAMPLE.npz OUT.bvh")
        return from_npz(args.npz, rest_of(os.path.expanduser(args.repo)), out)
    if not args.prompt or not args.out:
        ap.error("PROMPT OUT.bvh")
    generate(args)


if __name__ == "__main__":
    main()
