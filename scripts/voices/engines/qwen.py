"""Qwen3-TTS 1.7B Base (Alibaba, 24 kHz), cloning in context from the reference and its transcript.
It makes takes in batches (several lines, or several takes of one, at once): far quicker on a GPU."""

from worker import seed_all, serve


def load(jobs):
    import torch
    from qwen_tts import Qwen3TTSModel

    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cuda:0" if torch.cuda.is_available() else "cpu", dtype=torch.bfloat16)
    prompts = {}

    def prompt(voice):
        if voice["wav"] not in prompts:
            prompts[voice["wav"]] = m.create_voice_clone_prompt(ref_audio=voice["wav"], ref_text=voice["text"])
        return prompts[voice["wav"]]

    def many(voices, texts, seeds):
        # a take each: each line is cloned from the real line of the speaker's that feels like it should
        clone = [p for v in voices for p in prompt(v)]
        seed_all(seeds[0])  # one seed for the batch: its takes still differ, each sampled on its own
        # at most twice as long as the longest line could take (12 codec frames a second), so a
        # take that won't stop can't run on for its full 2048 frames
        frames = int(12 * (max(len(t.split()) for t in texts) / 1.2 + 4))
        wavs, sr = m.generate_voice_clone(text=texts, language=["English"] * len(texts), voice_clone_prompt=clone, max_new_tokens=frames)
        return [(w, sr) for w in wavs]

    def say(voice, text, seed):
        return many([voice], [text], [seed])[0]

    say.many, say.batch, say.mixed = many, 16, True
    return say


if __name__ == "__main__":
    serve(load)
