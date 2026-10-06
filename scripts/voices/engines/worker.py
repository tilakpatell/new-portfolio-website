"""What every engine's worker does, whatever model it runs: read the jobs
generate.py wrote, make each take that isn't made yet, and say so line by
line ("ok <file>" or "fail <file> <why>", tab-separated) for generate.py to follow.

    python engines/<engine>.py JOBS.json

JOBS.json: {"voices": {who: {"wav": reference, "text": its transcript}},
            "items": [{"who", "text", "out", "seed"}, ...]}

Only the standard library, numpy and soundfile here: each engine runs in a
venv of its own (engines/README.md), with whatever else its model pins.
"""

import json
import os
import sys
import traceback
from pathlib import Path

import numpy as np
import soundfile as sf


def serve(load):
    """`load(jobs)` loads the model and returns say(voice, text, seed) -> (samples, rate)."""
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    todo = [it for it in jobs["items"] if not Path(it["out"]).exists()]
    if not todo:
        return
    say = load(jobs)
    for it in todo:
        out = Path(it["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            wav, sr = say(jobs["voices"][it["who"]], it["text"], int(it["seed"]))
            wav = np.asarray(wav, dtype=np.float32).squeeze()
            if not wav.size:
                raise RuntimeError("no audio")
        except Exception as e:  # one bad line shouldn't stop the rest
            traceback.print_exc(file=sys.stderr)
            print(f"fail\t{out}\t{type(e).__name__}: {e}".replace("\n", " "), flush=True)
            continue
        tmp = out.with_name(out.stem + ".part.wav")
        sf.write(str(tmp), np.clip(wav, -1, 1), int(sr), subtype="PCM_16")
        os.replace(tmp, out)
        print(f"ok\t{out}", flush=True)


def seed_all(seed):
    import random

    import torch

    random.seed(seed)
    np.random.seed(seed % 2**32)
    torch.manual_seed(seed)
