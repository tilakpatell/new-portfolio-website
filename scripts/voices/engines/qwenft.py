"""Qwen3-TTS 1.7B taught one speaker (finetune.py): each voice its own model, learnt from every
line of theirs grab.py found (bank.py), at cache/finetune/<who>/best. 24 kHz. A voice with no
model of its own fails here, and its lines keep the other engines' takes.
$QWENFT_CKPT names one model to use for every voice (finetune.py, trying an epoch out)."""

import os
import sys
from pathlib import Path

from worker import seed_all, serve

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CACHE  # noqa: E402


def load(jobs):
    import gc

    import torch
    from qwen_tts import Qwen3TTSModel

    whose = {v["wav"]: w for w, v in jobs["voices"].items()}
    current = {"who": None, "model": None}

    def model(who):
        if current["who"] != who:
            given = os.environ.get("QWENFT_CKPT")
            ckpt = Path(given) if given else CACHE / "finetune" / who / "best"
            if not (ckpt / "model.safetensors").exists():
                raise RuntimeError(f"no model of {who}'s own yet (python scripts/voices/finetune.py --only {who})")
            current["model"] = None
            gc.collect()
            torch.cuda.empty_cache()
            current["model"] = Qwen3TTSModel.from_pretrained(str(ckpt), device_map="cuda:0", dtype=torch.bfloat16)
            current["who"] = who
        return current["model"]

    def many(voice, texts, seeds):
        who = whose[voice["wav"]]
        m = model(who)
        speaker = m.get_supported_speakers()[0]
        seed_all(seeds[0])
        frames = int(12 * (max(len(t.split()) for t in texts) / 1.2 + 4))
        wavs, sr = m.generate_custom_voice(text=texts, speaker=[speaker] * len(texts), language=["English"] * len(texts), max_new_tokens=frames)
        return [(w, sr) for w in wavs]

    def say(voice, text, seed):
        return many(voice, [text], [seed])[0]

    say.many, say.batch = many, 8
    return say


if __name__ == "__main__":
    serve(load)
