import { lazy } from 'react';

const pick = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const extras = () => import('./GameBoyExtras');
const terminal = () => import('./TerminalStages');
const more = () => import('./MoreStages');
const play = () => import('./PlayStages');

// Each project page loads only its own stages, top to bottom.
export const PROJECT_STAGES = {
  'gameboy-emulator': [
    { key: 'game', title: 'Play it', caption: 'A cartridge with three games. Super Tilak Land: four worlds (overground, underground, sky, castle) with mushrooms, fire flowers (B throws fire), a star in a brick or two, shells, firebars and a fire-breathing king on the castle bridge. Block Drop pays combos for clears in a row; in Snake, hold B to sprint and chase the golden apples. Pick a world with ← → in the menu; every game keeps its best score.', C: lazy(() => import('./GameBoyStage')) },
    { key: 'cpu', title: 'Step the CPU', caption: 'A small LR35902 program, one instruction at a time: registers, flags and cycle counts as the emulator sees them.', C: pick(extras, 'CpuStage') },
    { key: 'ppu', title: 'Watch the PPU draw', caption: 'The picture-processing unit builds each frame one scanline at a time: 144 visible lines, then VBlank.', C: pick(extras, 'PpuStage') },
    { key: 'blargg', title: 'Pass the tests', caption: 'Blargg’s cpu_instrs ROM exercises every instruction group. All eleven pass.', C: pick(extras, 'BlarggStage') },
  ],
  'swaminarayan-translator': [
    { key: 'claude', title: 'Translated with Claude', caption: 'Each page goes to Claude as the scan and its OCR together, with the style guide and locked glossary cached across the book.', C: lazy(() => import('./ClaudeStage')) },
    { key: 'pipeline', title: 'One page through the pipeline', caption: 'From a scanned leaf to a typeset English page, with every stage a retryable job.', C: lazy(() => import('./TranslatorStage')) },
  ],
  devspace: [
    { key: 'editor', title: 'Edit together', caption: 'Two people typing into the same CUDA file, then running it on the Jetson.', C: lazy(() => import('./DevSpaceStage')) },
    { key: 'kernel', title: 'Your turn', caption: 'Edit the kernel and run it. One GPU thread per element.', C: pick(more, 'KernelPlay') },
    { key: 'scheduler', title: 'Share one GPU', caption: 'Run requests from every editor are queued onto isolated containers on the Jetson Nano.', C: pick(more, 'SchedulerStage') },
  ],
  'awesome-copilot': [
    { key: 'merge', title: 'Upstream', caption: 'Branch, pull request, checks, merge.', C: lazy(() => import('./MergeStage')) },
    { key: 'recovery', title: 'What the hook does', caption: 'An error-recovery hook turns a dropped connection into a retry the user never notices.', C: pick(more, 'RecoveryStage') },
  ],
  'unix-shell': [
    { key: 'try', title: 'Try it', caption: 'A small shell running in your browser: pipes, redirection and the classic text tools. Type help, or click an example.', C: lazy(() => import('./ShellPlay')) },
    { key: 'pipeline', title: 'How a pipeline runs', caption: 'One process per command, joined by pipes.', C: pick(more, 'PipelineStage') },
  ],
  'fuse-fs': [
    { key: 'tree', title: 'Mount it', caption: 'Files and directories appear as inodes and blocks in a memory-mapped disk image.', C: pick(terminal, 'TreeStage') },
    { key: 'inodes', title: 'Make some files', caption: 'Create, write and delete files. Each gets an inode, and its data lands in blocks tracked by a bitmap.', C: pick(play, 'InodePlay') },
  ],
  'finance-platform': [
    { key: 'api', title: 'Call it', caption: 'Auth, market data, recommendations and chat over FastAPI.', C: pick(terminal, 'ApiStage') },
    { key: 'portfolio', title: 'Pick a risk level', caption: 'Drag the slider: the recommend route returns a portfolio split for the user’s risk profile.', C: pick(play, 'PortfolioPlay') },
  ],
  'smart-summarizer': [
    { key: 'summarizer', title: 'Summarize anything', caption: 'Paste any text: every sentence is scored, and the best ones become the summary.', C: pick(play, 'SummarizerPlay') },
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
