"""VoxCPM2 (OpenBMB, 48 kHz), cloning from the reference and its transcript together
(prompt and reference audio both: the mode its authors call the closest copy)."""

from worker import seed_all, serve


def load(jobs):
    from voxcpm import VoxCPM

    # no denoiser (grab.py's references are cleaned already) and no torch.compile (no Triton on Windows)
    m = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False)
    sr = m.tts_model.sample_rate

    def say(voice, text, seed):
        seed_all(seed)
        return m.generate(text=text, prompt_wav_path=voice["wav"], prompt_text=voice["text"], reference_wav_path=voice["wav"], cfg_value=2.0, inference_timesteps=10), sr

    return say


if __name__ == "__main__":
    serve(load)
