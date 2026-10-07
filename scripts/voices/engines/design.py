"""Qwen3-TTS 1.7B VoiceDesign (Alibaba, 24 kHz, Apache-2.0): a voice made from a description, for
the characters with no voice of their own to clone (design.py). Runs in the qwen engine's venv.
A job's voice is {"wav": "", "design": "<who they sound like>"}."""

from worker import seed_all, serve


def load(jobs):
    import torch
    from qwen_tts import Qwen3TTSModel

    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cuda:0" if torch.cuda.is_available() else "cpu", dtype=torch.bfloat16)

    def say(voice, text, seed):
        seed_all(seed)
        frames = int(12 * (len(text.split()) / 1.2 + 4))
        wavs, sr = m.generate_voice_design(text=text, instruct=voice["design"], language="English", max_new_tokens=frames)
        return wavs[0], sr

    return say


if __name__ == "__main__":
    serve(load)
