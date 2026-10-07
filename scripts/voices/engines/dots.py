"""dots.tts SOAR (rednote hilab's dots-studio, 2B, 48 kHz, Apache-2.0), cloning by continuation:
it carries on from the reference audio as if reading its transcript first. Linux only (its text
normaliser, WeTextProcessing, needs pynini): it runs under WSL from a dots.tts checkout
(README.md here), reading and writing the Windows side's files through /mnt.
One take at a time: its generator takes a batch of one."""

import math
import os
import sys

from worker import seed_all, serve, wsl_path

# the checkpoint: a local download (the default, under the checkout) or a Hugging Face repo id;
# dots.tts-base and dots.tts-mf load the same way, each with its own sampling defaults
CKPT = os.environ.get("DOTS_CKPT", "checkpoints/dots.tts-soar")
# torch.compile with warmup at load makes it several times faster, but Triton needs the Python
# headers (python3-dev): set DOTS_OPTIMIZE=1 where they're installed
OPTIMIZE = os.environ.get("DOTS_OPTIMIZE") == "1"


def load(jobs):
    from loguru import logger

    logger.remove()
    logger.add(sys.stderr, level="INFO")  # loguru's default is DEBUG, a dozen lines a take

    from dots_tts.runtime import DotsTtsRuntime

    ckpt = os.path.expanduser(CKPT)
    if not os.path.isdir(ckpt) and ckpt.startswith("checkpoints/"):
        ckpt = "dots-studio/" + os.path.basename(ckpt)  # not downloaded here: fetch it into the HF cache
    rt = DotsTtsRuntime.from_pretrained(ckpt, precision="bfloat16", optimize=OPTIMIZE)
    per_patch = rt.model.config.patch_size * rt.model.hop_size  # samples a generated patch makes
    patches_per_second = rt.sample_rate / per_patch
    prompt_patches = {}

    def say(voice, text, seed):
        if voice["wav"] not in prompt_patches:  # the reference as the runtime will see it (trimmed, resampled)
            prompt_patches[voice["wav"]] = math.ceil(rt._load_prompt_audio(voice["wav"]).shape[-1] / per_patch)
        # its length cap counts the reference's patches too (and one of them it makes again and
        # drops), so allow the reference plus at most twice as long as the line could take,
        # so a take that won't stop can't run on for the whole 500 patches (80 s)
        cap = prompt_patches[voice["wav"]] + 1 + math.ceil(patches_per_second * (len(text.split()) / 1.2 + 4))
        rt.max_generate_length = min(cap, 512) if OPTIMIZE else cap  # 512: the largest compiled size
        seed_all(seed)
        r = rt.generate(text=text, prompt_audio_path=voice["wav"], prompt_text=voice["text"])
        return r["audio"].float().cpu().squeeze().numpy(), r["sample_rate"]

    return say


if __name__ == "__main__":
    serve(load, local=wsl_path)
