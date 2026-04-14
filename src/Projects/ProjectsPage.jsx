import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, memo } from 'react';
import { useInView } from 'react-intersection-observer';
import {
  RiGithubLine, RiArrowRightUpLine, RiFlaskLine,
  RiCodeSSlashLine, RiTerminalBoxLine, RiStarLine,
  RiTimeLine, RiAddLine, RiSubtractLine, RiSearchLine,
} from 'react-icons/ri';

/* ── Language colours ─────────────────────────────────────────────────────── */
const LANG_COLORS = {
  'C++': '#ec4899', 'C': '#a1a1aa', 'Python': '#60a5fa',
  'Java': '#fb923c', 'JavaScript': '#facc15', 'TypeScript': '#38bdf8',
  'CMake': '#f97316', 'C#': '#a78bfa', 'Jupyter Notebook': '#fb923c',
  'Perl': '#818cf8', 'Makefile': '#94a3b8', 'HTML': '#f97316',
  'CSS': '#38bdf8', 'Shell': '#4ade80',
};
const DEFAULT_COLOR = '#6b7280';

/* ── GitHub fetching ─────────────────────────────────────────────────────── */
const repoCache = {};

const parseRepo = (url) => {
  if (!url?.includes('github.com')) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/?#\s]+)/);
  return m ? m[1].replace(/\.git$/, '') : null;
};

const fetchRepoStats = async (url) => {
  const repo = parseRepo(url);
  if (!repo) return null;
  if (repoCache[url]) return repoCache[url];

  const [rd, ld] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`https://api.github.com/repos/${repo}/languages`).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  if (!rd) return null;

  const total = ld ? Object.values(ld).reduce((a, b) => a + b, 0) : 0;
  const langs = total > 0
    ? Object.entries(ld).sort(([, a], [, b]) => b - a).map(([name, bytes]) => ({
        name, pct: +((bytes / total) * 100).toFixed(1),
      }))
    : [];
  const result = { stars: rd.stargazers_count, forks: rd.forks_count, pushed: rd.pushed_at, langs };
  repoCache[url] = result;
  return result;
};

const timeAgo = (iso) => {
  if (!iso) return null;
  const mo = Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24 * 30));
  if (mo < 1) return 'this month';
  if (mo === 1) return '1mo ago';
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}yr ago`;
};

/* ── Data ─────────────────────────────────────────────────────────────────── */
const FILTERS = ['ALL', 'RESEARCH', 'OPEN SOURCE', 'PROJECT'];
const CATEGORY_ICON = {
  RESEARCH: RiFlaskLine, 'OPEN SOURCE': RiCodeSSlashLine, PROJECT: RiTerminalBoxLine,
};

const projects = [
  { id: 1, category: 'RESEARCH',     title: 'GPU Checkpoint-Restart', subtitle: 'Prof. Gene Cooperman · Northeastern HPC Lab', flavor: 'When the supercomputer goes dark mid-training, this is the system that brings it back.', description: 'Profiling MPI checkpoint-restart overhead in MANA using flamegraphs to identify communication bottlenecks. Implementing GPU checkpoint-restart for NCCL collectives, enabling fault recovery in distributed multi-GPU training jobs.', technologies: ['C','MPI','NCCL','Linux','Flamegraphs','HPC'], link: null, badge: 'ACTIVE' },
  { id: 2, category: 'OPEN SOURCE',  title: 'github/awesome-copilot', subtitle: 'Merged Contribution · 29K+ Stars', flavor: 'Joined the rebellion — patches merged into one of GitHub\'s most-starred repositories.', description: 'Wrote error-recovery hooks and PyInstaller frozen-build recipes for the Copilot SDK. Contributions merged into the official github/awesome-copilot repository.', technologies: ['Python','Copilot SDK','PyInstaller'], link: 'https://github.com/github/awesome-copilot', badge: '29K ★' },
  { id: 3, category: 'PROJECT',      title: 'Game Boy Emulator',      subtitle: 'Passes Blargg\'s CPU Test Suite', flavor: 'Resurrecting ancient silicon from a cartridge far, far away — opcode by opcode.', description: 'Game Boy (DMG) emulator implementing all 500+ LR35902 opcodes. Scanline-based PPU with full sprite rendering, STAT interrupt edge detection, and memory-mapped I/O via SDL3 at 60 FPS.', technologies: ['C++20','SDL3','CMake'], link: 'https://github.com/tilakpatell/gameboy-emulator' },
  { id: 4, category: 'PROJECT',      title: 'DevSpace',               subtitle: 'HackBeanpot — 1st Place', flavor: 'A galaxy-class collaborative IDE. GPU horsepower, zero compromises.', description: 'Collaborative cloud IDE with GPU-accelerated Docker execution (CUDA/C++/Python) on Jetson Nano. Real-time multi-user editing with cursor sync and conflict resolution via WebSockets.', technologies: ['Java','React','Spring Boot','Docker','CUDA','WebSockets'], link: 'https://github.com/shreyaanpathak/devspace', badge: '1ST PLACE' },
  { id: 5, category: 'PROJECT',      title: 'Interactive AI Tutor',   subtitle: 'LangChain · Multi-Agent System', flavor: 'Do or do not, there is no try — this tutor makes sure you do.', description: 'LLM-powered tutoring system providing personalized learning support and guided problem-solving across subjects, augmented with real-time web search via Tavily.', technologies: ['Python','LangChain','Gradio','Tavily API','Llama 3','OpenAI API'], link: 'https://github.com/vishyka/LLM-tutor' },
  { id: 6, category: 'PROJECT',      title: 'Finance Platform',       subtitle: 'AI Portfolio Intelligence', flavor: 'The Empire\'s treasury, rebuilt with better data pipelines and fewer middlemen.', description: 'Comprehensive financial platform with real-time stock data analysis, AI-powered portfolio recommendations, and interactive dashboards backed by FastAPI + MongoDB.', technologies: ['React','TypeScript','FastAPI','MongoDB','Tailwind CSS'], link: 'https://github.com/tilakpatell/webdev-final-backend' },
  { id: 7, category: 'PROJECT',      title: 'FUSE File System',       subtitle: 'Kernel-Level Custom FS', flavor: 'Building the data vault the Rebellion never had — from scratch, in C.', description: 'Custom file system using FUSE with comprehensive file operations, directory management, inode handling, and persistent memory-mapped storage.', technologies: ['C','FUSE','Linux','Memory Mapping'], link: 'https://github.com/tilakpatell/File-System-Project' },
  { id: 8, category: 'PROJECT',      title: 'Unix Shell',             subtitle: 'Custom Shell Interpreter', flavor: 'Forged from system calls — because the Force flows through process trees.', description: 'Custom Unix shell with built-in commands, process management, piping, redirection, and inter-process communication from scratch.', technologies: ['C','Unix System Calls','Process Management','IPC'], link: 'https://github.com/tilakpatell/Shell-Project' },
  { id: 9, category: 'PROJECT',      title: 'Smart Summarizer',       subtitle: 'Fine-Tuned BERT · NLP', flavor: 'Compressing the Jedi archives into a single paragraph — one token at a time.', description: 'NLP tool using fine-tuned BERT for accurate text summarization, optimized for performance and scalability across document types.', technologies: ['Python','PyTorch','BERT','Transformers','Seaborn','Matplotlib'], link: 'https://github.com/tilakpatell/smart-summarizer-bert' },
];

/* ── Tech frequency (computed once at module level) ─────────────────────── */
const _techFreqMap = projects
  .flatMap(p => p.technologies)
  .reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});

const TOP_TECHS = Object.entries(_techFreqMap)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 9);

const MAX_FREQ = TOP_TECHS[0]?.[1] ?? 1;

/* ── Page-level stats (computed once) ───────────────────────────────────── */
const PAGE_STATS = [
  { label: 'Missions',     value: String(projects.length) },
  { label: 'Research',     value: String(projects.filter(p => p.category === 'RESEARCH').length) },
  { label: 'Open Source',  value: String(projects.filter(p => p.category === 'OPEN SOURCE').length) },
  { label: 'Public Repos', value: String(projects.filter(p => !!p.link).length) },
];

/* ── Language bars ────────────────────────────────────────────────────────── */
const LanguageBarH = ({ langs }) => {
  const shown = langs.slice(0, 6);
  return (
    <div>
      <div className="flex h-[3px] gap-[1px] mb-2">
        {shown.map(l => (
          <motion.div key={l.name} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{ width: `${l.pct}%`, backgroundColor: LANG_COLORS[l.name] ?? DEFAULT_COLOR, originX: 0 }}
            className="h-full opacity-70 hover:opacity-100 transition-opacity"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {shown.slice(0, 4).map(l => (
          <span key={l.name} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: LANG_COLORS[l.name] ?? DEFAULT_COLOR }} />
            <span className="font-mono text-[0.50rem] text-white/32">{l.name}</span>
            <span className="font-mono text-[0.46rem] text-white/18">{l.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Preview panel (right column, desktop) ───────────────────────────────── */
const PreviewPanel = ({ project, stats }) => (
  <div className="bg-[#0e0e0e] border border-white/[0.09] overflow-hidden">
    {/* Terminal title bar */}
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 border border-white/[0.14]" />)}
        </div>
        <span className="font-mono text-[0.46rem] tracking-[0.18em] text-white/18 uppercase">◈ intel terminal</span>
      </div>
      <motion.span
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="font-mono text-[0.42rem] tracking-[0.14em] text-white/22 uppercase"
      >
        {project ? 'LIVE' : 'STANDBY'}
      </motion.span>
    </div>

    <AnimatePresence mode="wait">
      {project ? (
        <motion.div key={project.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="p-5 space-y-4"
        >
          {/* Title */}
          <div>
            <h4 className="font-display text-sm font-bold text-white/85 uppercase tracking-wide leading-tight">
              {project.title}
            </h4>
            <p className="font-mono text-[0.50rem] text-white/28 mt-0.5 tracking-wider uppercase">{project.subtitle}</p>
          </div>

          {/* Category */}
          {(() => { const Icon = CATEGORY_ICON[project.category] ?? RiTerminalBoxLine; return (
            <span className="inline-flex items-center gap-1 font-mono text-[0.48rem] tracking-[0.12em]
                             text-white/28 uppercase border border-white/[0.07] px-2 py-0.5">
              <Icon className="w-2.5 h-2.5" />{project.category}
            </span>
          ); })()}

          {/* Flavor */}
          <p className="text-[0.68rem] text-white/22 italic font-light leading-relaxed">"{project.flavor}"</p>

          {/* GitHub stats */}
          {stats ? (
            <div className="space-y-3">
              {stats.langs.length > 0 && (
                <div>
                  <span className="font-mono text-[0.46rem] tracking-[0.18em] text-white/18 uppercase block mb-2">Languages</span>
                  <div className="space-y-1.5">
                    {stats.langs.slice(0, 5).map(l => (
                      <div key={l.name} className="flex items-center gap-2">
                        <span className="font-mono text-[0.46rem] text-white/32 w-20 truncate">{l.name}</span>
                        <div className="flex-1 h-[3px] bg-white/[0.04]">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${l.pct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="h-full" style={{ backgroundColor: LANG_COLORS[l.name] ?? DEFAULT_COLOR }}
                          />
                        </div>
                        <span className="font-mono text-[0.44rem] text-white/20 w-7 text-right">{l.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 pt-1">
                {stats.stars > 0 && (
                  <span className="flex items-center gap-1 font-mono text-[0.50rem] text-white/32">
                    <RiStarLine className="w-3 h-3 text-yellow-400/55" />{stats.stars.toLocaleString()} stars
                  </span>
                )}
                {stats.pushed && (
                  <span className="flex items-center gap-1 font-mono text-[0.48rem] text-white/22">
                    <RiTimeLine className="w-3 h-3" />{timeAgo(stats.pushed)}
                  </span>
                )}
              </div>
            </div>
          ) : project.link ? (
            <div className="flex items-center gap-2">
              <motion.div animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 1.2, repeat: Infinity }}
                className="w-1 h-1 bg-white/50" />
              <span className="font-mono text-[0.50rem] text-white/20 tracking-widest">Fetching intel…</span>
            </div>
          ) : (
            <span className="font-mono text-[0.50rem] text-white/18 uppercase tracking-widest">
              Research · No public repo
            </span>
          )}

          {/* Link */}
          {project.link && (
            <a href={project.link} target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-between border border-white/[0.09] hover:border-white/[0.22]
                          bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all duration-200 group/link mt-2"
            >
              <div className="flex items-center gap-2">
                <RiGithubLine className="w-3.5 h-3.5 text-white/30 group-hover/link:text-white/65 transition-colors" />
                <span className="font-mono text-[0.52rem] tracking-[0.12em] uppercase text-white/32 group-hover/link:text-white/65 transition-colors">
                  Open Repository
                </span>
              </div>
              <RiArrowRightUpLine className="w-3 h-3 text-white/18 group-hover/link:text-white/50 transition-colors" />
            </a>
          )}
        </motion.div>
      ) : (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="p-5 space-y-5"
        >
          {/* Idle header */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.50rem] tracking-[0.20em] text-white/20 uppercase">
              Tech Arsenal
            </p>
            <div className="relative w-7 h-7 flex-shrink-0">
              <div className="absolute inset-0 border border-white/[0.10]" />
              <motion.div className="absolute left-0 right-0 h-px bg-white/20"
                animate={{ y: [0, 28, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>

          {/* Top tech frequency bars */}
          <div className="space-y-2">
            <span className="font-mono text-[0.44rem] tracking-[0.16em] text-white/14 uppercase block mb-3">
              frequency across all missions
            </span>
            {TOP_TECHS.map(([name, count], i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2"
              >
                <span className="font-mono text-[0.46rem] text-white/32 w-[78px] truncate flex-shrink-0">
                  {name}
                </span>
                <div className="flex-1 h-[3px] bg-white/[0.04]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / MAX_FREQ) * 100}%` }}
                    transition={{ duration: 0.55, delay: i * 0.05, ease: 'easeOut' }}
                    className="h-full opacity-70"
                    style={{ backgroundColor: LANG_COLORS[name] ?? DEFAULT_COLOR }}
                  />
                </div>
                <span className="font-mono text-[0.42rem] text-white/20 w-3 text-right flex-shrink-0">
                  {count}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Hover prompt */}
          <div className="pt-2 border-t border-white/[0.05] text-center">
            <p className="font-mono text-[0.48rem] tracking-[0.16em] text-white/14 uppercase">
              Hover a project to view intel
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ── Project row ──────────────────────────────────────────────────────────── */
const ProjectRow = memo(({ project, index, isExpanded, onToggle, onHover, stats }) => {
  const [ref, inView] = useInView({ threshold: 0.04, triggerOnce: true });
  const num = String(project.id).padStart(2, '0');
  const Icon = CATEGORY_ICON[project.category] ?? RiTerminalBoxLine;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.42, delay: index * 0.055, ease: 'easeOut' }}
      className={`group relative border-b border-white/[0.07] transition-all duration-250
                 ${isExpanded
                   ? 'bg-white/[0.035] border-l-2 border-l-white/25'
                   : 'hover:bg-white/[0.018]'}`}
      onMouseEnter={() => onHover(project)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Top sweep on hover */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[1px] bg-white/40 origin-left pointer-events-none"
        animate={{ scaleX: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3 sm:gap-5 py-4 sm:py-5 px-3 sm:px-5"
      >
        {/* Background number */}
        <span
          className={`font-display font-bold flex-shrink-0 leading-none select-none
                      transition-colors duration-300 w-10 sm:w-14 text-right
                      ${isExpanded ? 'text-white/22' : 'text-white/[0.07] group-hover:text-white/[0.14]'}`}
          style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
        >
          {num}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            {/* Title + subtitle */}
            <div className="min-w-0 flex-1">
              <h3
                className={`font-display font-bold uppercase tracking-wide truncate leading-tight
                            transition-colors duration-200
                            ${isExpanded ? 'text-white' : 'text-white/72 group-hover:text-white/92'}`}
                style={{ fontSize: 'clamp(0.92rem, 2.2vw, 1.35rem)' }}
              >
                {project.title}
              </h3>
              {project.subtitle && (
                <p className="font-mono text-[0.50rem] tracking-[0.10em] text-white/22 mt-0.5 uppercase truncate hidden sm:block">
                  {project.subtitle}
                </p>
              )}
            </div>

            {/* Right: category, tags, badge, stars, expand icon */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <span className="hidden md:inline-flex items-center gap-1 font-mono text-[0.48rem] tracking-[0.10em]
                               text-white/25 uppercase border border-white/[0.07] px-1.5 py-0.5">
                <Icon className="w-2.5 h-2.5" />{project.category}
              </span>

              {project.technologies.slice(0, 2).map(t => (
                <span key={t} className="hidden lg:inline font-mono text-[0.48rem] tracking-[0.08em] text-white/20 uppercase">
                  {t}
                </span>
              ))}

              {project.badge && (
                <span className="font-mono text-[0.46rem] tracking-[0.10em] text-white/52 uppercase
                                 border border-white/18 px-1.5 py-0.5 bg-white/[0.04]">
                  {project.badge}
                </span>
              )}

              {stats?.stars > 0 && (
                <span className="hidden sm:flex items-center gap-1 font-mono text-[0.48rem] text-yellow-400/55">
                  <RiStarLine className="w-3 h-3" />{stats.stars.toLocaleString()}
                </span>
              )}

              <motion.div animate={{ rotate: isExpanded ? 45 : 0 }} transition={{ duration: 0.22 }}>
                <RiAddLine className="w-4 h-4 text-white/22 group-hover:text-white/48 transition-colors" />
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* indent to align with title */}
            <div className="px-3 sm:px-5 pb-6 pl-[calc(2.5rem+0.75rem)] sm:pl-[calc(3.5rem+1.25rem)]">
              {/* Flavor */}
              <p className="text-[0.70rem] text-white/22 italic font-light mb-3 tracking-wide">
                "{project.flavor}"
              </p>

              {/* Description */}
              <p className="text-sm text-white/58 leading-relaxed mb-4 max-w-2xl">
                {project.description}
              </p>

              {/* All tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {project.technologies.map(t => <span key={t} className="tech-tag">{t}</span>)}
              </div>

              {/* GitHub language bar */}
              {stats?.langs?.length > 0 && (
                <div className="mb-4 max-w-lg">
                  <LanguageBarH langs={stats.langs} />
                </div>
              )}

              {/* Stars + push date */}
              {stats && (stats.stars > 0 || stats.pushed) && (
                <div className="flex items-center gap-4 mb-4">
                  {stats.stars > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[0.52rem] text-white/32">
                      <RiStarLine className="w-3 h-3 text-yellow-400/55" />{stats.stars.toLocaleString()} stars
                    </span>
                  )}
                  {stats.pushed && (
                    <span className="flex items-center gap-1 font-mono text-[0.50rem] text-white/22">
                      <RiTimeLine className="w-3 h-3" />Updated {timeAgo(stats.pushed)}
                    </span>
                  )}
                </div>
              )}

              {/* Action */}
              {project.link ? (
                <a href={project.link} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-2.5 font-mono text-[0.58rem] tracking-[0.14em]
                              uppercase text-white/40 hover:text-white/80 border border-white/[0.10]
                              hover:border-white/[0.28] px-4 py-2 transition-all duration-200
                              bg-white/[0.02] hover:bg-white/[0.06]"
                >
                  <RiGithubLine className="w-3.5 h-3.5" />
                  View Source
                  <RiArrowRightUpLine className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="font-mono text-[0.52rem] text-white/18 uppercase tracking-widest">
                  Research Project · No Public Repository
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
ProjectRow.displayName = 'ProjectRow';

/* ── Page ─────────────────────────────────────────────────────────────────── */
const ProjectsPage = () => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [hoveredProject, setHoveredProject] = useState(null);
  const [allStats, setAllStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [headerRef, headerInView] = useInView({ threshold: 0.2, triggerOnce: true });

  /* Pre-fetch all GitHub stats on mount */
  useEffect(() => {
    // Load cached stats immediately
    const cached = {};
    projects.forEach(p => { if (p.link && repoCache[p.link]) cached[p.link] = repoCache[p.link]; });
    if (Object.keys(cached).length) setAllStats(cached);

    // Fetch remaining
    projects.forEach(async p => {
      if (!p.link || repoCache[p.link]) return;
      const stats = await fetchRepoStats(p.link);
      if (stats) setAllStats(prev => ({ ...prev, [p.link]: stats }));
    });
  }, []);

  const catFiltered = activeFilter === 'ALL' ? projects : projects.filter(p => p.category === activeFilter);
  const filtered = searchQuery.trim()
    ? catFiltered.filter(p => {
        const q = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
          || p.technologies.some(t => t.toLowerCase().includes(q))
          || (p.subtitle && p.subtitle.toLowerCase().includes(q));
      })
    : catFiltered;

  const counts = { ALL: projects.length };
  projects.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });

  const handleHover = useCallback((project) => setHoveredProject(project), []);
  const handleToggle = useCallback((id) => setExpandedId(prev => prev === id ? null : id), []);

  return (
    <main className="relative min-h-screen">
      {/* Video bg */}
      <div className="fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-[0.18]">
          <source src="/spaceship.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.92) 100%)' }}
        />
      </div>

      {/* Scanline texture */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)',
        }}
      />

      <div className="relative z-10 pt-20 lg:pt-24 pb-24">
        {/* Header */}
        <div ref={headerRef} className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center">
          <motion.p initial={{ opacity: 0 }} animate={headerInView ? { opacity: 1 } : {}} className="section-label mb-3">
            Archive
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight"
          >
            My Projects
          </motion.h1>
          <div className="gold-line w-16 mx-auto mt-4" />
          <motion.p
            initial={{ opacity: 0 }} animate={headerInView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-white/48 max-w-md mx-auto mt-4"
          >
            Research, open source, and engineering — from emulators to supercomputing
          </motion.p>
        </div>

        {/* Stats strip */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.24 }}
            className="grid grid-cols-2 sm:grid-cols-4 border border-white/[0.09] max-w-2xl mx-auto"
          >
            {PAGE_STATS.map((s, i) => (
              <div
                key={s.label}
                className={`px-5 py-3.5 text-center border-r border-white/[0.07] last:border-r-0
                            ${i < 2 ? 'border-b sm:border-b-0' : ''}`}
              >
                <div className="font-display text-xl font-bold text-white/80">{s.value}</div>
                <div className="font-mono text-[0.46rem] tracking-[0.16em] text-white/22 uppercase mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Search bar */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.26 }}
            className="max-w-lg mx-auto relative"
          >
            <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setExpandedId(null); }}
              placeholder="Search projects, technologies..."
              className="w-full bg-white/[0.03] border border-white/[0.09] pl-10 pr-4 py-2.5
                         font-mono text-[0.78rem] text-white/75 placeholder:text-white/18
                         focus:outline-none focus:border-white/22 focus:bg-white/[0.05] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.60rem] text-white/25 hover:text-white/50">
                ESC
              </button>
            )}
          </motion.div>
        </div>

        {/* Filter tabs */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.28 }}
            className="flex flex-wrap justify-center max-w-lg mx-auto border border-white/[0.09]"
          >
            {FILTERS.map(f => (
              <button key={f} onClick={() => { setActiveFilter(f); setExpandedId(null); }}
                className={`flex-1 min-w-[68px] px-3 py-2.5 font-mono text-[0.54rem] tracking-[0.12em] uppercase
                            transition-all duration-200 border-r border-white/[0.09] last:border-r-0
                            ${activeFilter === f ? 'bg-white text-black' : 'text-white/32 hover:text-white/62 hover:bg-white/[0.03]'}`}
              >
                {f} <span className={activeFilter === f ? 'text-black/45' : 'text-white/16'}>{counts[f] ?? 0}</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* Two-column layout */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-6 max-w-6xl mx-auto items-start">

            {/* Project list */}
            <div>
              {/* List header */}
              <div className="flex items-center gap-4 px-3 sm:px-5 py-2.5 border-b border-white/[0.08] mb-0">
                <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase w-10 sm:w-14 text-right flex-shrink-0">
                  No.
                </span>
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase">Project</span>
                  <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase hidden sm:block">Category / Stack</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={activeFilter} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                >
                  {filtered.map((project, i) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      index={i}
                      isExpanded={expandedId === project.id}
                      onToggle={() => handleToggle(project.id)}
                      onHover={handleHover}
                      stats={allStats[project.link]}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Footer count */}
              <div className="px-3 sm:px-5 pt-4">
                <span className="font-mono text-[0.48rem] tracking-[0.16em] text-white/15 uppercase">
                  {filtered.length} {activeFilter === 'ALL' ? 'total' : activeFilter.toLowerCase()} entries
                </span>
              </div>
            </div>

            {/* Preview panel — sticky on desktop */}
            <div className="hidden xl:block sticky top-24">
              <PreviewPanel
                project={hoveredProject}
                stats={hoveredProject ? allStats[hoveredProject.link] : null}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ProjectsPage;
