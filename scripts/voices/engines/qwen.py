"""Qwen3-TTS 1.7B Base (Alibaba, 24 kHz), cloning in context from the reference and its transcript."""

from worker import seed_all, serve


def load(jobs):
    import torch
    from qwen_tts import Qwen3TTSModel

    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cuda:0" if torch.cuda.is_available() else "cpu", dtype=torch.bfloat16)
    prompts = {}

    def say(voice, text, seed):
        if voice["wav"] not in prompts:
            prompts[voice["wav"]] = m.create_voice_clone_prompt(ref_audio=voice["wav"], ref_text=voice["text"])
        seed_all(seed)
        wavs, sr = m.generate_voice_clone(text=text, language="English", voice_clone_prompt=prompts[voice["wav"]])
        return wavs[0], sr

    return say


if __name__ == "__main__":
    serve(load)
