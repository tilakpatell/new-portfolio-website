import { lazy } from 'react';

const pick = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const extras = () => import('./GameBoyExtras');
const terminal = () => import('./TerminalStages');
const more = () => import('./MoreStages');

// Each project page loads only its own stages, top to bottom.
export const PROJECT_STAGES = {
  'gameboy-emulator': [
    { key: 'game', title: 'Play it', caption: 'Super Tilak Land — a Mario-style level on the handheld. The plumber runs on his own; jump to grab coins.', C: lazy(() => import('./GameBoyStage')) },
    { key: 'cpu', title: 'Step the CPU', caption: 'A small LR35902 program, one instruction at a time: registers, flags and cycle counts as the emulator sees them.', C: pick(extras, 'CpuStage') },
    { key: 'ppu', title: 'Watch the PPU draw', caption: 'The picture-processing unit builds each frame one scanline at a time — 144 visible lines, then VBlank.', C: pick(extras, 'PpuStage') },
    { key: 'blargg', title: 'Pass the tests', caption: 'Blargg’s cpu_instrs ROM exercises every instruction group. All eleven pass.', C: pick(extras, 'BlarggStage') },
  ],
  'swaminarayan-translator': [
    { key: 'claude', title: 'Translated with Claude', caption: 'Each page goes to Claude as the scan and its OCR together, with the style guide and locked glossary cached across the book.', C: lazy(() => import('./ClaudeStage')) },
    { key: 'pipeline', title: 'One page through the pipeline', caption: 'From a scanned leaf to a typeset English page, with every stage a retryable job.', C: lazy(() => import('./TranslatorStage')) },
  ],
  devspace: [
    { key: 'editor', title: 'Edit together', caption: 'Two people typing into the same CUDA file, then running it on the Jetson.', C: lazy(() => import('./DevSpaceStage')) },
    { key: 'scheduler', title: 'Share one GPU', caption: 'Run requests from every editor are queued onto isolated containers on the Jetson Nano.', C: pick(more, 'SchedulerStage') },
  ],
  'awesome-copilot': [
    { key: 'merge', title: 'Upstream', caption: 'Branch, pull request, checks, merge.', C: lazy(() => import('./MergeStage')) },
    { key: 'recovery', title: 'What the hook does', caption: 'An error-recovery hook turns a dropped connection into a retry the user never notices.', C: pick(more, 'RecoveryStage') },
  ],
  'unix-shell': [
    { key: 'shell', title: 'Use it', caption: 'Pipes, redirection and job control.', C: pick(terminal, 'ShellStage') },
    { key: 'pipeline', title: 'How a pipeline runs', caption: 'One process per command, joined by pipes.', C: pick(more, 'PipelineStage') },
  ],
  'fuse-fs': [
    { key: 'tree', title: 'Mount it', caption: 'Files and directories appear as inodes and blocks in a memory-mapped disk image.', C: pick(terminal, 'TreeStage') },
    { key: 'inodes', title: 'Inside the image', caption: 'Each file gets an inode; its data lands in blocks tracked by a bitmap.', C: pick(more, 'InodeStage') },
  ],
  'finance-platform': [
    { key: 'api', title: 'Call it', caption: 'Auth, market data, recommendations and chat over FastAPI.', C: pick(terminal, 'ApiStage') },
    { key: 'portfolio', title: 'A recommendation', caption: 'The recommend route returns a portfolio split for the user’s risk profile.', C: pick(more, 'PortfolioStage') },
  ],
  'smart-summarizer': [
    { key: 'summarizer', title: 'Summarize', caption: 'Score every sentence, keep the best three.', C: pick(terminal, 'SummarizerStage') },
    { key: 'attention', title: 'What the model looks at', caption: 'Attention from one token to the rest of the sentence.', C: pick(more, 'AttentionStage') },
  ],
  'gpu-checkpoint-restart': [
    { key: 'gpu', title: 'Checkpoint and restart', caption: 'Four GPUs in an NCCL ring: train, checkpoint, fault, restart.', C: lazy(() => import('./GpuStage')) },
    { key: 'flame', title: 'Where the time goes', caption: 'Profiling checkpoint overhead in MANA with flamegraphs.', C: pick(more, 'FlamegraphStage') },
  ],
};

// Home page features: the Game Boy, playable, and Claude translating a page.
export const GameBoyFeature = lazy(() => import('./GameBoyStage'));
export const ClaudeFeature = lazy(() => import('./ClaudeStage'));
