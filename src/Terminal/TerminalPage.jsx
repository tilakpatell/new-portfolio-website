import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAchievements } from '../components/Achievements';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const timeAgo = (iso) => {
  if (!iso) return 'N/A';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d < 1) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const triggerResume = () => {
  const a = Object.assign(document.createElement('a'), { href: '/Resume.pdf', download: 'Tilak_Patel_Resume.pdf' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

/* ── Command output data ─────────────────────────────────────────────────── */
const L = (text, type = 'output') => ({ text, type });
const BLANK = L('', 'blank');

const HELP = [
  BLANK,
  L('  AVAILABLE COMMANDS', 'heading'),
  L('  ──────────────────────────────────────', 'dim'),
  L('  about        Personnel dossier'),
  L('  skills       Technical clearance levels'),
  L('  projects     Mission archives (9 entries)'),
  L('  experience   Deployment history'),
  L('  github       Live GitHub intelligence  [API]'),
  L('  contact      Communication channels'),
  L('  resume       Download dossier (.pdf)'),
  L('  neofetch     System information'),
  L('  clear        Clear terminal'),
  BLANK,
  L('  ping       Check GitHub API latency   [API]'),
  L('  cat <file> Read file (try: resume.txt)'),
  L('  man <cmd>  Manual page for a command'),
  L('  history    Show command log'),
  L('  uptime     Session duration'),
  BLANK,
  L('  Also try: whoami · date · ls · pwd · echo', 'dim'),
  L('  Hint: try order66, force, deathstar...', 'dim'),
];

const ABOUT = [
  BLANK,
  L('  ╔═══════════════════════════════════════════╗', 'ascii'),
  L('  ║   PERSONNEL FILE — TILAK PATEL            ║', 'ascii'),
  L('  ╚═══════════════════════════════════════════╝', 'ascii'),
  BLANK,
  L('  Name          Tilak Patel'),
  L('  Role          Software Engineer'),
  L('  Affiliation   Northeastern University'),
  L('  Degree        B.S. Computer Science (2027)'),
  L('  Current       Software Engineer Co-op @ Bose'),
  L('  Focus         Systems · AI/ML · Backend'),
  BLANK,
  L('  Dedicated software engineer with expertise in AI,', 'dim'),
  L('  machine learning, and high-performance computing.', 'dim'),
];

const SKILLS = [
  BLANK,
  L('  TECHNICAL CLEARANCE LEVELS', 'heading'),
  L('  ──────────────────────────────────────', 'dim'),
  BLANK,
  L('  [SYSTEMS & HPC]', 'heading'),
  L('  C/C++       ████████████████████░░  92'),
  L('  Linux/OS    ██████████████████░░░░  88'),
  L('  IPC/Pipes   ████████████████░░░░░░  80'),
  L('  MPI/NCCL    ██████████████░░░░░░░░  72'),
  BLANK,
  L('  [AI / ML ENGINEERING]', 'heading'),
  L('  Python      █████████████████████░  95'),
  L('  Pydantic    ██████████████████░░░░  88'),
  L('  LangGraph   █████████████████░░░░░  85'),
  L('  Copilot SDK ████████████████░░░░░░  82'),
  BLANK,
  L('  [BACKEND & INFRA]', 'heading'),
  L('  FastAPI     ████████████████████░░  92'),
  L('  Docker/CI   ████████████████░░░░░░  82'),
  L('  Grafana     ██████████████░░░░░░░░  75'),
  L('  WebSockets  ██████████████░░░░░░░░  72'),
];

const PROJECTS = [
  BLANK,
  L('  MISSION ARCHIVES — 9 ENTRIES', 'heading'),
  L('  ──────────────────────────────────────', 'dim'),
  L('  01  GPU Checkpoint-Restart    RESEARCH      ACTIVE'),
  L('  02  github/awesome-copilot    OPEN SOURCE   29K ★'),
  L('  03  Game Boy Emulator         PROJECT       500+ ops'),
  L('  04  DevSpace                  PROJECT       1ST PLACE'),
  L('  05  Interactive AI Tutor      PROJECT'),
  L('  06  Finance Platform          PROJECT'),
  L('  07  FUSE File System          PROJECT       Kernel FS'),
  L('  08  Unix Shell                PROJECT'),
  L('  09  Smart Summarizer          PROJECT       BERT'),
  BLANK,
  L('  Navigate to /#/projects for full details.', 'dim'),
];

const EXPERIENCE = [
  BLANK,
  L('  DEPLOYMENT HISTORY', 'heading'),
  L('  ──────────────────────────────────────', 'dim'),
  L('  01  Bose Corporation        SWE Co-op          Jan–Jun 2026'),
  L('      60+ endpoints · 25+ tools · CI/CD automation', 'dim'),
  L('  02  Pendar Technologies     Laser SWE Co-op    Jul–Dec 2025'),
  L('      Qt/PySide6 · Replaced legacy LabVIEW', 'dim'),
  L('  03  Empowerreg AI           AI Eng. Intern     Jul–Dec 2025'),
  L('      Grafana/Loki · FDA heatmaps · 4+ hrs/wk saved', 'dim'),
  L('  04  SRC, Inc.               ML Eng. Intern     Apr–Jul 2025'),
  L('      LangGraph · 500+ docs · 90% accuracy', 'dim'),
];

const CONTACT = [
  BLANK,
  L('  COMMUNICATION CHANNELS', 'heading'),
  L('  ──────────────────────────────────────', 'dim'),
  L('  Email     tilakny@gmail.com'),
  L('  GitHub    github.com/tilakpatell'),
  L('  LinkedIn  linkedin.com/in/tilakpatell'),
  BLANK,
  L('  Navigate to /#/contact for the form.', 'dim'),
];

const NEOFETCH = [
  BLANK,
  L('  ┌──────────────────────────────────────────┐', 'ascii'),
  L('  │   T I L A K   P A T E L                   │', 'ascii'),
  L('  │   Software Engineer · Northeastern \'27    │', 'ascii'),
  L('  └──────────────────────────────────────────┘', 'ascii'),
  BLANK,
  L('  OS        Imperial Mainframe v4.2.1'),
  L('  Host      tilakpatel.dev'),
  L('  Kernel    React 18 · Vite 5 · Three.js'),
  L('  Shell     imperial-sh 1.0.0'),
  L('  Uptime    3+ years engineering'),
  L('  Packages  9 deployed projects · 4 co-ops'),
  L('  CPU       Python · C/C++ · TypeScript'),
  L('  GPU       Three.js · WebGL · CUDA'),
  L(`  Date      ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}`),
];

/* ── Easter eggs ─────────────────────────────────────────────────────────── */
const ORDER66 = [
  BLANK,
  L('  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', 'error'),
  L('  ▓                                    ▓', 'error'),
  L('  ▓   EXECUTING ORDER 66...            ▓', 'error'),
  L('  ▓   "Do what must be done."          ▓', 'error'),
  L('  ▓         — Emperor Palpatine        ▓', 'error'),
  L('  ▓                                    ▓', 'error'),
  L('  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', 'error'),
  BLANK,
  L('  (Don\'t worry, it\'s just a portfolio.)', 'dim'),
];

const SW_QUOTES = [
  '"Do. Or do not. There is no try." — Yoda',
  '"I am one with the Force and the Force is with me." — Chirrut Imwe',
  '"In my experience, there\'s no such thing as luck." — Obi-Wan Kenobi',
  '"The Force will be with you. Always." — Obi-Wan Kenobi',
  '"I\'ve got a bad feeling about this." — Everyone',
  '"This is the way." — Din Djarin',
  '"Rebellions are built on hope." — Jyn Erso',
  '"Never tell me the odds." — Han Solo',
  '"I find your lack of faith disturbing." — Darth Vader',
  '"The belonging you seek is not behind you, it is ahead." — Maz Kanata',
  '"We are what they grow beyond." — Yoda',
];

const LIGHTSABER = [
  BLANK,
  L('  ──══════════[#####]══>', 'ascii'),
  BLANK,
  L('  "An elegant weapon, for a more civilized age."', 'output'),
  L('  — Obi-Wan Kenobi, A New Hope', 'dim'),
];

const VADER = [
  BLANK,
  L('  ┌─────────────────────────────────────┐', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  │      ▓▓▓  DARTH VADER  ▓▓▓         │', 'ascii'),
  L('  │      Dark Lord of the Sith          │', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  │      Clearance: SUPREME             │', 'ascii'),
  L('  │      Affiliation: Galactic Empire   │', 'ascii'),
  L('  │      Weapon: Lightsaber (red)       │', 'ascii'),
  L('  │      Master: Emperor Palpatine      │', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  └─────────────────────────────────────┘', 'ascii'),
  BLANK,
  L('  "I am your father."', 'output'),
  L('  — The Empire Strikes Back', 'dim'),
];

const YODA = [
  BLANK,
  L('  ┌─────────────────────────────────────┐', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  │      ◈◈◈  GRAND MASTER YODA  ◈◈◈   │', 'ascii'),
  L('  │      Jedi Order                     │', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  │      Age: 900 years                 │', 'ascii'),
  L('  │      Species: Unknown               │', 'ascii'),
  L('  │      Weapon: Lightsaber (green)     │', 'ascii'),
  L('  │      Rank: Grand Master             │', 'ascii'),
  L('  │                                     │', 'ascii'),
  L('  └─────────────────────────────────────┘', 'ascii'),
  BLANK,
  L('  "Size matters not. Judge me by my size, do you?"', 'output'),
  L('  — The Empire Strikes Back', 'dim'),
];

/* ── GitHub API fetch ────────────────────────────────────────────────────── */
const fetchGitHub = async () => {
  const [profile, repos] = await Promise.all([
    fetch('https://api.github.com/users/tilakpatell').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('https://api.github.com/users/tilakpatell/repos?per_page=100&sort=pushed')
      .then(r => r.ok ? r.json() : []).catch(() => []),
  ]);

  if (!profile) return [BLANK, L('  Error: GitHub API rate limit exceeded. Try later.', 'error')];

  const langMap = {};
  let stars = 0;
  repos.forEach(r => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; stars += r.stargazers_count; });
  const topLangs = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return [
    BLANK,
    L('  GITHUB INTELLIGENCE REPORT  [LIVE]', 'heading'),
    L('  ──────────────────────────────────────', 'dim'),
    L(`  Handle       @${profile.login}`),
    L(`  Public Repos ${profile.public_repos}`),
    L(`  Followers    ${profile.followers}`),
    L(`  Total Stars  ${stars}`),
    BLANK,
    L('  TOP LANGUAGES', 'heading'),
    ...topLangs.map(([name, count]) => {
      const bar = '█'.repeat(Math.round(count * 2.5)) + '░'.repeat(Math.max(0, 15 - Math.round(count * 2.5)));
      return L(`  ${name.padEnd(16)} ${bar}  ${count} repos`);
    }),
    BLANK,
    L('  RECENT PUSHES', 'heading'),
    ...repos.slice(0, 5).map(r =>
      L(`  ${r.name.substring(0, 28).padEnd(30)} ${(r.language || '').padEnd(12)} ${timeAgo(r.pushed_at)}`)
    ),
    BLANK,
    L('  Fetched live from api.github.com', 'dim'),
  ];
};

/* ── cat resume.txt ─────────────────────────────────────────────────────── */
const CAT_RESUME = [
  BLANK,
  L('  ┌──────────────────────────────────────────────┐', 'ascii'),
  L('  │             TILAK PATEL                       │', 'ascii'),
  L('  │  tilakny@gmail.com · github.com/tilakpatell   │', 'ascii'),
  L('  │  Northeastern University · CS · 2027           │', 'ascii'),
  L('  └──────────────────────────────────────────────┘', 'ascii'),
  BLANK,
  L('  EXPERIENCE', 'heading'),
  L('  Bose Corporation        SWE Co-op         Jan–Jun 2026'),
  L('  Pendar Technologies     Laser SWE Co-op   Jul–Dec 2025'),
  L('  Empowerreg AI           AI Eng Intern     Jul–Dec 2025'),
  L('  SRC, Inc.               ML Eng Intern     Apr–Jul 2025'),
  BLANK,
  L('  SKILLS', 'heading'),
  L('  Languages   Python · C/C++ · Java · TypeScript · SQL'),
  L('  AI/ML       PyTorch · LangGraph · BERT · RAG · Pydantic'),
  L('  Backend     FastAPI · Spring Boot · Docker · CI/CD'),
  L('  Systems     Linux · MPI · NCCL · CUDA · FUSE · CMake'),
  BLANK,
  L('  Type "resume" to download the full PDF.', 'dim'),
];

/* ── ping (checks GitHub API) ──────────────────────────────────────────── */
const pingGitHub = async () => {
  const start = performance.now();
  const ok = await fetch('https://api.github.com/users/tilakpatell')
    .then(r => r.ok).catch(() => false);
  const ms = Math.round(performance.now() - start);
  return [
    BLANK,
    L(`  PING api.github.com — ${ok ? 'OK' : 'FAIL'}`, ok ? 'success' : 'error'),
    L(`  Response time: ${ms}ms`),
    L(`  Status: ${ok ? 'Imperial relay operational' : 'Connection lost'}`, 'dim'),
  ];
};

/* ── Session uptime ────────────────────────────────────────────────────── */
const SESSION_START = Date.now();

/* ── Command registry ────────────────────────────────────────────────────── */
const CMDS = {
  help:       () => HELP,
  about:      () => ABOUT,
  skills:     () => SKILLS,
  projects:   () => PROJECTS,
  experience: () => EXPERIENCE,
  contact:    () => CONTACT,
  neofetch:   () => NEOFETCH,
  resume:     () => { triggerResume(); return [BLANK, L('  Downloading Resume.pdf...', 'success')]; },
  github:     fetchGitHub,
  ping:       pingGitHub,
  clear:      null,
  // File system aliases
  whoami:     () => [L('  visitor@imperial-mainframe')],
  pwd:        () => [L('  /imperial/mainframe/public')],
  date:       () => [L(`  ${new Date().toString()}`)],
  ls:         () => [BLANK, L('  about.txt  skills.dat  projects/  experience/  .github/'), L('  contact.cfg  resume.pdf  node_modules/  force.sh')],
  cat:        null, // handled inline for sub-commands
  echo:       null, // handled inline
  uptime:     () => {
    const sec = Math.floor((Date.now() - SESSION_START) / 1000);
    const m = Math.floor(sec / 60), s = sec % 60;
    return [L(`  Session uptime: ${m}m ${s}s`), L('  System uptime: 3+ years', 'dim')];
  },
  man:        null, // handled inline
  // Easter eggs
  order66:    () => ORDER66,
  force:      () => [BLANK, L(`  ${SW_QUOTES[Math.floor(Math.random() * SW_QUOTES.length)]}`)],
  hello:      () => [BLANK, L('  Hello there! General Kenobi...'), BLANK, L('  — Obi-Wan Kenobi (and the visitor)', 'dim')],
  hi:         () => [BLANK, L('  Hello there! General Kenobi...')],
  sudo:       () => [L('  Nice try. The Force is not with you.', 'error')],
  'rm':       () => [L('  UNAUTHORIZED. You need Dark Side clearance.', 'error')],
  starwars:   () => [BLANK, L(`  ${SW_QUOTES[Math.floor(Math.random() * SW_QUOTES.length)]}`)],
  lightsaber: () => LIGHTSABER,
  vader:      () => VADER,
  yoda:       () => YODA,
  jedi:       () => [BLANK, L('  You were the chosen one!'), L('  "You were supposed to destroy the Sith, not join them!"', 'dim'), L('  — Obi-Wan Kenobi, Revenge of the Sith', 'dim')],
  sith:       () => [BLANK, L('  "Peace is a lie, there is only passion."'), L('  "Through passion, I gain strength."'), L('  "Through strength, I gain power."'), L('  — The Sith Code', 'dim')],
  cantina:    () => [BLANK, L('  *doo doo doo doo-doo doo doo-doo doo doo*', 'output'), L('  (The Cantina Band plays on.)', 'dim'), L('  "Sorry about the mess." — Han Solo', 'dim')],
  exit:       () => { window.location.hash = '#/'; return []; },
  deathstar:  () => { window.location.hash = '#/deathstar'; return [BLANK, L('  Redirecting to classified schematics...', 'success')]; },
};

const CMD_NAMES = Object.keys(CMDS);

/* ── Line renderer ───────────────────────────────────────────────────────── */
const LINE_STYLES = {
  system:  'text-white/30 text-[0.72rem]',
  command: 'text-white/50',
  output:  'text-white/72',
  heading: 'text-white/90 font-semibold',
  dim:     'text-white/25 text-[0.72rem]',
  error:   'text-red-400/70',
  success: 'text-green-400/60',
  blank:   'h-3',
  ascii:   'text-white/45 whitespace-pre leading-tight',
};

const TerminalLine = ({ line, index }) => {
  if (line.type === 'blank') return <div className="h-3" />;
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.08, delay: Math.min(index * 0.015, 0.4) }}
      className={`font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap break-words ${LINE_STYLES[line.type] ?? LINE_STYLES.output}`}
    >
      {line.text}
    </motion.div>
  );
};

/* ── Terminal page ───────────────────────────────────────────────────────── */
const TerminalPage = () => {
  const [lines, setLines] = useState([
    L('  IMPERIAL MAINFRAME v4.2.1', 'system'),
    L('  Establishing secure connection...', 'system'),
    L('  Connection established. Access Level: VISITOR', 'success'),
    BLANK,
    L('  Type \'help\' for available commands.', 'system'),
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const { unlock } = useAchievements();

  /* Scroll to bottom on new output */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  /* Auto-focus input */
  useEffect(() => { inputRef.current?.focus(); }, [busy]);

  const addLines = useCallback((newLines) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const processCommand = useCallback(async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    /* Echo command */
    addLines([L(`  root@imperial:~$ ${trimmed}`, 'command')]);
    setHistory(prev => [...prev, trimmed]);
    setHistIdx(-1);

    const cmd = trimmed.toLowerCase().split(' ')[0];

    /* Achievement triggers */
    if (cmd === 'order66') unlock('order66');
    if (cmd === 'resume') unlock('resume');

    /* Clear */
    if (cmd === 'clear') { setLines([]); return; }

    /* Echo */
    if (cmd === 'echo') { addLines([L(`  ${trimmed.slice(5)}`)]); return; }

    /* cat <file> */
    if (cmd === 'cat') {
      const arg = trimmed.split(/\s+/)[1]?.toLowerCase();
      if (arg === 'resume.txt' || arg === 'resume.pdf') { addLines(CAT_RESUME); return; }
      if (arg === 'about.txt') { addLines(ABOUT); return; }
      if (arg === 'skills.dat') { addLines(SKILLS); return; }
      if (arg === 'contact.cfg') { addLines(CONTACT); return; }
      if (arg === 'force.sh') { addLines([BLANK, L('  #!/bin/bash'), L('  echo "May the Force be with you"'), L('  exit 0')]); return; }
      addLines([L(`  cat: ${arg || '???'}: No such file or directory`, 'error')]); return;
    }

    /* man <cmd> */
    if (cmd === 'man') {
      const arg = trimmed.split(/\s+/)[1]?.toLowerCase();
      const descs = { help:'Show available commands', about:'Display personnel dossier', skills:'Show technical clearance', projects:'List mission archives', experience:'Deployment history', github:'Fetch live GitHub intelligence (API call)', contact:'Show communication channels', resume:'Download PDF resume', neofetch:'System information', ping:'Check GitHub API latency', cat:'Read file contents (cat <filename>)', uptime:'Show session duration', clear:'Clear terminal screen' };
      if (arg && descs[arg]) { addLines([BLANK, L(`  ${arg.toUpperCase()}(1)`, 'heading'), L(`  ${descs[arg]}`)]); return; }
      addLines([L(`  What manual page do you want? Try: man help`, 'dim')]); return;
    }

    /* history */
    if (cmd === 'history') {
      addLines([BLANK, ...history.slice(-15).map((h, i) => L(`  ${String(i + 1).padStart(3)}  ${h}`))]); return;
    }

    const handler = CMDS[cmd];
    if (!handler) {
      addLines([L(`  Command not found: ${cmd}. Type 'help' for available commands.`, 'error')]);
      return;
    }

    /* Async handler (github) */
    if (handler.constructor.name === 'AsyncFunction') {
      setBusy(true);
      try {
        const result = await handler();
        addLines(result);
      } catch (err) {
        addLines([L(`  Error: ${err.message}`, 'error')]);
      }
      setBusy(false);
      return;
    }

    /* Sync handler */
    const result = handler();
    if (result) addLines(result);
  }, [addLines]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') {
      processCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        const next = histIdx < history.length - 1 ? histIdx + 1 : histIdx;
        setHistIdx(next);
        setInput(history[history.length - 1 - next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(history[history.length - histIdx]); }
      else { setHistIdx(-1); setInput(''); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.toLowerCase();
      const matches = CMD_NAMES.filter(c => c.startsWith(partial) && c !== partial);
      if (matches.length === 1) setInput(matches[0]);
      else if (matches.length > 1) addLines([L(`  root@imperial:~$ ${input}`, 'command'), L(`  ${matches.join('  ')}`, 'dim')]);
    }
  }, [input, history, histIdx, processCommand, addLines]);

  /* Click anywhere focuses input */
  const focusInput = () => inputRef.current?.focus();

  return (
    <main className="relative min-h-screen" onClick={focusInput}>
      {/* Video bg */}
      <div className="fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-[0.10]">
          <source src="/spaceship.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 100%)' }}
        />
      </div>

      {/* Scanlines */}
      <div className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)' }}
      />

      <div className="relative z-10 pt-20 lg:pt-24 pb-10 px-4 sm:px-6 min-h-screen flex flex-col items-center">
        {/* Terminal window */}
        <div className="w-full max-w-4xl flex-1 flex flex-col">
          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0a0a0a] border border-b-0 border-white/[0.10]">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => <span key={i} className="w-2.5 h-2.5 border border-white/[0.18]" />)}
            </div>
            <span className="font-mono text-[0.50rem] tracking-[0.18em] text-white/20 uppercase">
              ◈ Imperial Mainframe · tilak.exe
            </span>
            <motion.span
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="ml-auto font-mono text-[0.42rem] text-white/20 uppercase"
            >
              CONNECTED
            </motion.span>
          </div>

          {/* Terminal body */}
          <div
            ref={scrollRef}
            className="flex-1 bg-[#060606]/95 border border-white/[0.10] border-t-0
                       overflow-y-auto p-4 sm:p-6 min-h-[60vh] max-h-[75vh]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          >
            {lines.map((line, i) => (
              <TerminalLine key={i} line={line} index={i} />
            ))}

            {/* Input / processing indicator */}
            {busy ? (
              <div className="flex items-center gap-2 mt-2">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="font-mono text-[0.78rem] text-white/40"
                >
                  ⠋ Fetching data...
                </motion.span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-[0.72rem] text-white/35 flex-shrink-0 select-none">
                  root@imperial:~$
                </span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  className="flex-1 bg-transparent font-mono text-[0.78rem] text-white/80
                             outline-none caret-white/55"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
              </div>
            )}
          </div>

          {/* Footer hints */}
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="font-mono text-[0.42rem] text-white/10 uppercase tracking-widest">
              ↑↓ History · Tab Autocomplete
            </span>
            <span className="font-mono text-[0.42rem] text-white/10 uppercase tracking-widest">
              {lines.length} lines · {history.length} cmds
            </span>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TerminalPage;
