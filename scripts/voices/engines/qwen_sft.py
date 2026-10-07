"""Teach Qwen3-TTS 1.7B Base one speaker: the training loop of Qwen's own finetuning/sft_12hz.py
(github.com/QwenLM/Qwen3-TTS, Apache-2.0), with what this machine needs: PyTorch's own attention
(no flash-attn on Windows), the audio codes made here rather than in a separate step, and only the
epochs asked for saved, each as a CustomVoice model that says `--speaker`. finetune.py runs it in
the qwen engine's venv; it needs a checkout of Qwen3-TTS for finetuning/dataset.py
($QWEN_TTS_REPO, else ~/src/Qwen3-TTS).

    python engines/qwen_sft.py --train TRAIN.jsonl --out DIR --speaker han --epochs 8 --save 3,5,8

TRAIN.jsonl: {"audio": wav, "text": its words, "ref_audio": the speaker's reference} a line.
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import torch

REPO = Path(os.environ.get("QWEN_TTS_REPO", Path.home() / "src" / "Qwen3-TTS"))
BASE = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"


def with_codes(rows):
    """Each row with its audio as the 12 Hz tokenizer's codes, which is what the model learns to say."""
    from qwen_tts import Qwen3TTSTokenizer

    tok = Qwen3TTSTokenizer.from_pretrained("Qwen/Qwen3-TTS-Tokenizer-12Hz", device_map="cuda:0")
    for i in range(0, len(rows), 16):
        batch = rows[i : i + 16]
        for row, code in zip(batch, tok.encode([r["audio"] for r in batch]).audio_codes):
            row["audio_codes"] = code.cpu().tolist()
    del tok
    torch.cuda.empty_cache()
    return rows


def save(model, base, out, speaker, embedding):
    """The model as it is now, as a CustomVoice model whose one speaker is `speaker`."""
    from safetensors.torch import save_file

    shutil.copytree(base, out, dirs_exist_ok=True, ignore=shutil.ignore_patterns("model.safetensors", "*.md", ".git*"))
    config = json.loads((Path(base) / "config.json").read_text(encoding="utf-8"))
    config["tts_model_type"] = "custom_voice"
    config.setdefault("talker_config", {})["spk_id"] = {speaker: 3000}
    config["talker_config"]["spk_is_dialect"] = {speaker: False}
    (Path(out) / "config.json").write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    state = {k: v.detach().to("cpu") for k, v in model.state_dict().items() if not k.startswith("speaker_encoder")}
    weight = state["talker.model.codec_embedding.weight"]
    weight[3000] = embedding[0].detach().to(weight.device).to(weight.dtype)
    save_file(state, str(Path(out) / "model.safetensors"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--speaker", required=True)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--save", default="", help="the epochs to save, comma-separated (default: the last)")
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--accumulate", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-5)
    args = ap.parse_args()

    from accelerate import Accelerator
    from huggingface_hub import snapshot_download
    from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel
    from torch.optim import AdamW
    from torch.utils.data import DataLoader
    from transformers import AutoConfig

    sys.path.insert(0, str(REPO / "finetuning"))
    from dataset import TTSDataset

    torch.manual_seed(1234)
    base = snapshot_download(BASE)
    rows = with_codes([json.loads(l) for l in Path(args.train).read_text(encoding="utf-8").splitlines() if l.strip()])
    accelerator = Accelerator(gradient_accumulation_steps=args.accumulate, mixed_precision="bf16")
    qwen = Qwen3TTSModel.from_pretrained(base, torch_dtype=torch.bfloat16, attn_implementation="sdpa")
    data = TTSDataset(rows, qwen.processor, AutoConfig.from_pretrained(base))
    loader = DataLoader(data, batch_size=args.batch, shuffle=True, collate_fn=data.collate_fn)
    optimizer = AdamW(qwen.model.parameters(), lr=args.lr, weight_decay=0.01)
    model, optimizer, loader = accelerator.prepare(qwen.model, optimizer, loader)
    keep = {int(e) for e in args.save.split(",") if e.strip()} or {args.epochs}
    embedding = None
    model.train()
    for epoch in range(1, args.epochs + 1):
        losses = []
        for batch in loader:
            with accelerator.accumulate(model):
                input_ids, codec_ids = batch["input_ids"], batch["codec_ids"]
                codec_mask = batch["codec_mask"]
                spk = model.speaker_encoder(batch["ref_mels"].to(model.device).to(model.dtype)).detach()
                if embedding is None:
                    embedding = spk
                text = model.talker.model.text_embedding(input_ids[:, :, 0]) * batch["text_embedding_mask"]
                codec = model.talker.model.codec_embedding(input_ids[:, :, 1]) * batch["codec_embedding_mask"]
                codec[:, 6, :] = spk
                embeds = text + codec
                for i in range(1, 16):
                    embeds = embeds + model.talker.code_predictor.get_input_embeddings()[i - 1](codec_ids[:, :, i]) * codec_mask.unsqueeze(-1)
                out = model.talker(inputs_embeds=embeds[:, :-1, :], attention_mask=batch["attention_mask"][:, :-1], labels=batch["codec_0_labels"][:, 1:], output_hidden_states=True)
                hidden = out.hidden_states[0][-1][codec_mask[:, :-1]]
                _, sub_loss = model.talker.forward_sub_talker_finetune(codec_ids[codec_mask], hidden)
                loss = out.loss + 0.3 * sub_loss
                accelerator.backward(loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                optimizer.zero_grad()
                losses.append(loss.item())
        print(f"epoch {epoch} loss {sum(losses) / max(len(losses), 1):.4f}", flush=True)
        if epoch in keep:
            where = Path(args.out) / f"epoch-{epoch}"
            save(accelerator.unwrap_model(model), base, where, args.speaker, embedding)
            print(f"saved {where}", flush=True)


if __name__ == "__main__":
    main()
