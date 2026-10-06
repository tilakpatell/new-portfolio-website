"""Fish Audio S2 Pro (44.1 kHz), cloning in context from the reference and its transcript.
Linux only: it runs under WSL from a fish-speech checkout (README.md here), reading
and writing the Windows side's files through /mnt."""

from worker import seed_all, serve, wsl_path


def load(jobs):
    import torch
    from fish_speech.inference_engine import TTSInferenceEngine
    from fish_speech.models.dac.inference import load_model as load_decoder
    from fish_speech.models.text2semantic.inference import launch_thread_safe_queue
    from fish_speech.utils.schema import ServeReferenceAudio, ServeTTSRequest

    queue = launch_thread_safe_queue(checkpoint_path="checkpoints/s2-pro", device="cuda", precision=torch.bfloat16, compile=True)
    decoder = load_decoder(config_name="modded_dac_vq", checkpoint_path="checkpoints/s2-pro/codec.pth", device="cuda")
    engine = TTSInferenceEngine(llama_queue=queue, decoder_model=decoder, precision=torch.bfloat16, compile=True)
    refs = {}

    def say(voice, text, seed):
        if voice["wav"] not in refs:
            with open(voice["wav"], "rb") as f:
                refs[voice["wav"]] = ServeReferenceAudio(audio=f.read(), text=voice["text"])
        seed_all(seed)
        req = ServeTTSRequest(text=text, references=[refs[voice["wav"]]], seed=seed, use_memory_cache="on", max_new_tokens=1024, chunk_length=200, top_p=0.8, temperature=0.8, repetition_penalty=1.1, format="wav")
        for r in engine.inference(req):
            if r.code == "final":
                sr, audio = r.audio
                return audio, sr
            if r.code == "error":
                raise r.error
        raise RuntimeError("no audio")

    return say


if __name__ == "__main__":
    serve(load, local=wsl_path)
