"""LongCat-AudioDiT 3.5B (Meituan, 24 kHz, MIT), a diffusion TTS in a waveform VAE's latent
space, cloning in context from the reference and its transcript: it reads the transcript and the
line as one text, and carries on from the reference's latents with the line. It makes a take's
whole length at once, as long as it's asked for (a guess from the line's letters and how fast
the reference talks), so a take can't run on; and since every take in a batch is that one length,
it batches the takes of a line together. It runs under WSL from a LongCat-AudioDiT checkout
(README.md here), whose model code isn't a package, reading and writing the Windows side's files
through /mnt."""

import importlib.util
import math
import os
import sys

from worker import seed_all, serve, wsl_path

CHECKPOINT = "checkpoints/LongCat-AudioDiT-3.5B"
STEPS, GUIDANCE = 16, 4.0  # the authors' settings, with their APG guidance for cloning


def load(jobs):
    sys.path.append(os.getcwd())  # the checkout's audiodit package and utils.py
    import numpy as np
    import torch
    from audiodit import AudioDiTModel
    from transformers import AutoTokenizer

    spec = importlib.util.spec_from_file_location("longcat_utils", "utils.py")
    utils = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(utils)

    torch.backends.cudnn.benchmark = False
    torch.set_float32_matmul_precision("high")  # TF32 matmuls: twice as quick as full fp32 here, the takes no worse
    m = AudioDiTModel.from_pretrained(CHECKPOINT, dtype=torch.float32).to("cuda" if torch.cuda.is_available() else "cpu")
    if m.device.type == "cuda":
        m.vae.to_half()  # its VAE runs in fp16, as the authors' does (but fp16 convolutions crawl on a CPU)
    m.eval()
    tok = AutoTokenizer.from_pretrained(m.config.text_encoder_model)
    sr, hop, longest = m.config.sampling_rate, m.config.latent_hop, m.config.max_wav_duration
    refs = {}

    def ref(voice):
        if voice["wav"] not in refs:
            wav = utils.load_audio(voice["wav"], sr)  # (1, samples) at 24 kHz
            frames = math.ceil(wav.shape[-1] / hop)  # the latent frames the model encodes it to
            said = utils.normalize_text(voice["text"])
            # how much slower than the model's average the reference talks (never quicker: the authors' clip)
            pace = float(np.clip(frames * hop / sr / utils.approx_duration_from_text(said, longest), 1.0, 1.5))
            refs[voice["wav"]] = (wav.unsqueeze(0), frames, said, pace)
        return refs[voice["wav"]]

    def takes(voice, text, seed, n):
        wav, frames, said, pace = ref(voice)
        line = utils.normalize_text(text)
        secs = utils.approx_duration_from_text(line, longest - frames * hop / sr) * pace
        secs = min(secs, len(text.split()) / 1.2 + 4)  # no slower than 1.2 words a second, plus 4 s
        total = min(frames + int(secs * sr // hop), int(longest * sr // hop))
        ids = tok([f"{said} {line}"] * n, padding="longest", return_tensors="pt")
        seed_all(seed)
        out = m(input_ids=ids.input_ids, attention_mask=ids.attention_mask, prompt_audio=wav.repeat(n, 1, 1), duration=total, steps=STEPS, cfg_strength=GUIDANCE, guidance_method="apg")
        return [(w.float().cpu().numpy(), sr) for w in out.waveform]

    def many(voice, texts, seeds):
        # each line's takes in one go (one seed for them all: they still differ, each its own noise)
        made = [None] * len(texts)
        for text in dict.fromkeys(texts):
            at = [i for i, t in enumerate(texts) if t == text]
            for i, take in zip(at, takes(voice, text, seeds[at[0]], len(at))):
                made[i] = take
        return made

    def say(voice, text, seed):
        return takes(voice, text, seed, 1)[0]

    say.many, say.batch = many, 8
    return say


if __name__ == "__main__":
    serve(load, local=wsl_path)
