import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import { useInView } from 'react-intersection-observer';

/* ── Domain data ─────────────────────────────────────────────────────────── */
// Each domain has a subtle accent colour that tints its bars + stat
const domains = [
  {
    id: '01',
    title: 'Systems & HPC',
    codename: 'Low-Level Warfare',
    accent: '168,162,158',  // warm steel
    description: 'C/C++ systems programming, OS-level abstractions, and parallel computation across distributed GPU clusters. The stack that runs when milliseconds cost millions.',
    skills: [
      { name: 'C / C++',     level: 92 },
      { name: 'Linux / OS',  level: 88 },
      { name: 'MPI / NCCL',  level: 72 },
      { name: 'x86 Assembly',level: 65 },
      { name: 'SDL3',        level: 74 },
      { name: 'IPC / Pipes', level: 80 },
    ],
    stat:     { value: '500+', label: 'LR35902 opcodes implemented in custom Game Boy emulator' },
    projects: ['GPU Checkpoint-Restart', 'Game Boy Emulator', 'FUSE File System', 'Unix Shell'],
  },
  {
    id: '02',
    title: 'AI / ML Engineering',
    codename: 'Neural Intelligence Corps',
    accent: '96,165,250',   // sky blue
    description: 'End-to-end ML from fine-tuning BERT to deploying multi-agent LangGraph systems in production. Building pipelines where intelligence is a first-class runtime dependency.',
    skills: [
      { name: 'Python',      level: 95 },
      { name: 'Pydantic',    level: 88 },
      { name: 'LangGraph',   level: 85 },
      { name: 'RAG / LLMs',  level: 80 },
      { name: 'Copilot SDK', level: 82 },
      { name: 'Docling',     level: 76 },
    ],
    stat:     { value: '90%', label: 'extraction accuracy on 500+ document pipeline · SRC, Inc.' },
    projects: ['GPU Checkpoint-Restart', 'Smart Summarizer', 'AI Tutor', 'Empowerreg AI Asst.'],
  },
  {
    id: '03',
    title: 'Backend & Infrastructure',
    codename: 'Command & Control',
    accent: '74,222,128',   // emerald green
    description: 'FastAPI services with 60+ endpoints, CI/CD pipelines that deploy without human input, and Grafana/Loki observability stacks watching it all in real time.',
    skills: [
      { name: 'FastAPI',      level: 92 },
      { name: 'Docker / CI',  level: 82 },
      { name: 'Grafana/Loki', level: 75 },
      { name: 'Spring Boot',  level: 68 },
      { name: 'WebSockets',   level: 72 },
      { name: 'MongoDB',      level: 70 },
    ],
    stat:     { value: '60+', label: 'REST endpoints shipped in firmware intelligence platform · Bose' },
    projects: ['Finance Platform', 'DevSpace', 'Bose Log Platform', 'Empowerreg Stack'],
  },
];

/* ── Domain panel ────────────────────────────────────────────────────────── */
const DomainPanel = memo(({ domain, index }) => {
  const [ref, inView] = useInView({ threshold: 0.06, triggerOnce: true });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`group relative border-b border-white/[0.07] last:border-b-0 overflow-hidden
                 transition-colors duration-300 ${hovered ? 'bg-white/[0.012]' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Sweep line on hover — accent-tinted */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[1px] origin-left pointer-events-none"
        style={{ backgroundColor: `rgba(${domain.accent},0.35)` }}
        animate={{ scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />

      {/* Large background number */}
      <span
        className="absolute right-0 bottom-0 font-display font-black leading-none select-none pointer-events-none
                   text-white/[0.028] transition-all duration-500"
        style={{ fontSize: 'clamp(8rem, 18vw, 16rem)', lineHeight: 0.8 }}
        aria-hidden="true"
      >
        {domain.id}
      </span>

      {/* ── Content grid ── */}
      <div className="relative grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-8 lg:gap-0 px-5 sm:px-8 py-10 sm:py-12">

        {/* ── Left: Identity + stat ── */}
        <div className="flex flex-col gap-5 lg:pr-10 lg:border-r lg:border-white/[0.07]">
          <div>
            <span className="font-mono text-xs tracking-[0.26em] text-white/35 uppercase">/ {domain.id}</span>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight mt-1.5 leading-tight">
              {domain.title}
            </h3>
          </div>

          <span className="inline-flex items-center font-mono text-[0.55rem] tracking-[0.14em]
                           text-white/35 uppercase border border-white/[0.10] px-2 py-0.5 w-fit">
            ◈ {domain.codename}
          </span>

          <p className="text-sm text-white/48 leading-relaxed">
            {domain.description}
          </p>

          {/* Key stat box */}
          <div className={`border border-white/[0.08] px-4 py-4 mt-auto transition-colors duration-300
                           ${hovered ? 'border-white/[0.15] bg-white/[0.02]' : ''}`}>
            <motion.span
              className="font-display font-bold leading-none block"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: `rgba(${domain.accent},0.72)` }}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
            >
              {domain.stat.value}
            </motion.span>
            <span className="font-mono text-[0.55rem] text-white/40 uppercase tracking-wide mt-2 block leading-relaxed">
              {domain.stat.label}
            </span>
          </div>
        </div>

        {/* ── Right: Skill bars + projects ── */}
        <div className="flex flex-col gap-6 lg:pl-10">
          {/* Proficiency header */}
          <span className="font-mono text-xs tracking-[0.20em] text-white/35 uppercase">
            Proficiency Matrix
          </span>

          {/* Bars */}
          <div className="space-y-3.5">
            {domain.skills.map((skill, si) => (
              <div key={skill.name} className="flex items-center gap-4">
                <span className="font-mono text-[0.60rem] tracking-[0.04em] text-white/50 w-[108px] flex-shrink-0 uppercase">
                  {skill.name}
                </span>
                <div className="flex-1 h-[2px] bg-white/[0.06] relative overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ backgroundColor: `rgba(${domain.accent},${0.35 + (skill.level / 100) * 0.45})` }}
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${skill.level}%` } : { width: 0 }}
                    transition={{ duration: 0.95, delay: 0.2 + si * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  />
                  {/* Shimmer on complete */}
                  <motion.div
                    className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={inView ? { x: '1000%' } : { x: '-100%' }}
                    transition={{ duration: 0.5, delay: 0.2 + si * 0.07 + 0.95, ease: 'easeOut' }}
                  />
                </div>
                <span className="font-mono text-[0.55rem] text-white/38 w-6 text-right flex-shrink-0 tabular-nums">
                  {skill.level}
                </span>
              </div>
            ))}
          </div>

          {/* Related deployments */}
          <div className="pt-4 border-t border-white/[0.06]">
            <span className="font-mono text-xs tracking-[0.18em] text-white/32 uppercase block mb-2.5">
              Related Deployments
            </span>
            <div className="flex flex-wrap gap-1.5">
              {domain.projects.map(p => (
                <span key={p}
                  className="font-mono text-[0.55rem] text-white/40 border border-white/[0.09]
                             px-2 py-0.5 uppercase tracking-wide hover:text-white/60
                             hover:border-white/[0.18] transition-colors duration-150">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
});
DomainPanel.displayName = 'DomainPanel';

/* ── Section ──────────────────────────────────────────────────────────────── */
const TechStack = () => {
  const [headerRef, headerInView] = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      {/* Video background */}
      <div className="absolute inset-0">
        <video autoPlay muted loop playsInline
          className="w-full h-full object-cover opacity-[0.22]"
          style={{ filter: 'grayscale(100%)' }}>
          <source src="/death_star.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 85% 75% at 50% 50%, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.88) 100%)' }}
        />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.014] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 z-10">

        {/* ── Header ── */}
        <div ref={headerRef} className="mb-14 sm:mb-16">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={headerInView ? { opacity: 1 } : {}}
                className="section-label mb-3"
              >
                Capabilities
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                animate={headerInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
              >
                Technical Expertise
              </motion.h2>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={headerInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2 }}
              className="font-mono text-xs tracking-[0.14em] text-white/38 uppercase max-w-xs text-right"
            >
              Systems · AI / ML · Backend Infrastructure
            </motion.p>
          </div>
          <div className="gold-line w-16 mt-5" />
        </div>

        {/* ── Domain panels — full-width strips ── */}
        <div className="border border-white/[0.09] overflow-hidden">
          {domains.map((domain, i) => (
            <DomainPanel key={domain.id} domain={domain} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
};

export default TechStack;
