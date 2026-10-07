"""Tencent Hunyuan AuK (24 kHz, MIT; the Qwen2.5-Omni-3B encoder it needs is under the Qwen
Research licence, non-commercial), a 1.5B flow-matching speech model conditioned through that
encoder: it clones without a transcript, told "Say the following with the same voice" with the
reference audio in the message. It doesn't decide when to stop: each take is
as long as asked, so the length comes from the reference's own pace (the repo's estimate,
get_gen_duration) or the words. AUK_FLASH=1 uses AuK-Flash, the 4-step distilled model;
AUK_OFFLOAD=1 parks the encoder and DiT on the CPU between steps (25 GB of VRAM -> 17).
Linux only: it runs under WSL from an AuK checkout (README.md here), reading
and writing the Windows side's files through /mnt."""

import os
import sys

from worker import seed_all, serve, wsl_path

# this script has to be auk.py (the engine's name), and its folder, first on the path, would
# shadow the auk package it runs: drop the folder now that worker's imported
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:] = [p for p in sys.path if os.path.abspath(p or ".") != HERE]

FLASH = os.environ.get("AUK_FLASH") == "1"
OFFLOAD = os.environ.get("AUK_OFFLOAD") == "1"


def seconds(voice, text):
    """How long the take should be: the reference's pace applied to the line (the repo's own
    estimate, by UTF-8 bytes), kept near ~2.7 words a second and never past words/1.2 + 4."""
    from auk.infer.infer_auk import get_gen_duration

    words = max(1, len(text.split()))
    by_words = words / 2.7 + 0.4
    est = get_gen_duration(audio=voice["wav"], ref_text=voice["text"], gen_text=text) if voice.get("text", "").strip() else None
    return min(max(est or by_words, 0.7 * by_words, 1.0), words / 1.2 + 4)


def load(jobs):
    from auk.infer.infer_auk import AukInfer

    name, ckpt = ("AuK-Flash", "auk_flash") if FLASH else ("AuK", "auk_base")
    engine = AukInfer(f"ckpts/{name}/config.yaml", f"ckpts/{name}/{ckpt}.safetensors", device="cuda", dtype="bf16", qwen_path="ckpts/Qwen2.5-Omni-3B", cpu_offload=OFFLOAD)

    def say(voice, text, seed):
        line = text.strip().replace('"', "'")
        # (not told the line's direction: it reads any words in the instruction aloud. The feeling
        # comes from the reference, a real line of the speaker's that feels the way this one should.)
        messages = [{"role": "user", "content": [{"type": "text", "text": f'Say the following with the same voice: "{line}"'}, {"type": "audio", "audio": voice["wav"]}]}]
        seed_all(seed)
        # base AuK at its defaults (32 steps, CFG 2, sway -1); Flash pins its own 4-step recipe
        audio, sr = engine.generate(messages, audio=voice["wav"], gen_seconds=seconds(voice, text), seed=seed)
        return audio.squeeze(0).numpy(), sr

    return say


if __name__ == "__main__":
    serve(load, local=wsl_path)
