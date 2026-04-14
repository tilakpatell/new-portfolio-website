import { motion, AnimatePresence } from 'framer-motion';
import { RiAddLine, RiMapPinLine } from 'react-icons/ri';
import { useState, memo, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';

/* ── Data ─────────────────────────────────────────────────────────────────── */
const experiences = [
  {
    id: '01',
    title: 'Software Engineer Co-op',
    company: 'Bose Corporation',
    location: 'Framingham, MA',
    logo: '/Bose-logo.png',
    logoInvert: true,
    period: 'Jan 2026 – Jun 2026',
    codename: 'Imperial Engineering Division',
    flavor: 'When the Empire needs firmware that actually works, they call Bose.',
    description: 'Built the full-stack firmware intelligence platform that turned hours of debugging into minutes — 60+ REST endpoints, real-time streaming, and an AI-powered defect triage pipeline that runs without human input.',
    achievements: [
      'Built full-stack log analysis platform with 60+ REST endpoints, streaming, and session persistence using FastAPI',
      'Designed 3-phase processing pipeline with 25+ custom tools, reducing firmware debugging from hours to minutes',
      'Automated defect triage via CI pipeline that processes Jira tickets and posts reports without human input',
      'Shipped cross-platform desktop app (React, Electron, Copilot SDK) integrating Jira, Confluence, and Artifactory',
    ],
    skills: ['FastAPI', 'React', 'Electron', 'Copilot SDK', 'CI/CD', 'Jira API', 'Python'],
  },
  {
    id: '02',
    title: 'Laser Software Engineer Co-op',
    company: 'Pendar Technologies',
    location: 'Boston, MA',
    logo: '/Pendar-Technologies.png',
    period: 'Jul 2025 – Dec 2025',
    codename: 'Precision Targeting Systems',
    flavor: 'LabVIEW was the old republic. Qt is the new order.',
    description: 'Replaced a legacy LabVIEW system with a modern real-time data acquisition app for laser sensor testing — built in Qt/PySide6, automated overnight, never looked back.',
    achievements: [
      'Built real-time data acquisition app in Qt/PySide6 for laser sensor testing, fully replacing legacy LabVIEW system',
      'Implemented automated overnight testing with CSV export, eliminating hours of manual data collection daily',
    ],
    skills: ['Qt', 'PySide6', 'Python', 'Data Acquisition', 'Automation'],
  },
  {
    id: '03',
    title: 'AI Engineer Intern',
    company: 'Empowerreg AI',
    location: 'Remote',
    logo: '/empower.png',
    period: 'Jul 2025 – Dec 2025',
    codename: 'Rebel Medical Intelligence',
    flavor: 'Fighting the regulatory dark side, one heatmap at a time.',
    description: 'Deployed AI-driven tools to cut analyst workload for medical device compliance — interactive risk heatmaps, Grafana + Loki observability, and an AI assistant that answers regulatory queries on demand.',
    achievements: [
      'Built interactive visualization tool mapping FDA complaint severity with heatmaps for medical device risk analysis',
      'Deployed Grafana and Loki observability stack, unifying real-time log monitoring across 5+ microservices',
      'Saved 4+ hours/week per analyst by building AI-powered assistant for regulatory compliance queries',
    ],
    skills: ['Grafana', 'Loki', 'FastAPI', 'LLMs', 'Data Visualization', 'Observability'],
  },
  {
    id: '04',
    title: 'Machine Learning Engineer Intern',
    company: 'SRC, Inc.',
    location: 'Syracuse, NY',
    logo: '/src-logo.png',
    period: 'Apr 2025 – Jul 2025',
    codename: 'Radar Intelligence Corps',
    flavor: '500 documents. 90% accuracy. No Jedi mind tricks.',
    description: 'Built a LangGraph-powered pipeline that extracts structured knowledge triplets from hundreds of radar documents — feeding them into knowledge graphs and cutting expert review time by 70%.',
    achievements: [
      'Built pipeline extracting knowledge triplets from 500+ radar docs at 90% accuracy using Pydantic and Docling',
      'Fed extracted triplets into knowledge graphs via LangGraph, automating analysis and cutting review time by 70%',
    ],
    skills: ['LangGraph', 'Pydantic', 'Docling', 'Knowledge Graphs', 'Python', 'NLP'],
  },
];

/* ── Gantt ────────────────────────────────────────────────────────────────── */
const TIMELINE_START = new Date('2025-04-01');
const TIMELINE_END   = new Date('2026-07-01');
const TOTAL_MS = TIMELINE_END - TIMELINE_START;

const toPct = (dateStr) => {
  const d = new Date(dateStr);
  return Math.max(0, Math.min(100, ((d - TIMELINE_START) / TOTAL_MS) * 100));
};

const ganttRows = [
  { id: 0, company: 'Bose Corporation',    role: 'SWE Co-op',       start: '2026-01-01', end: '2026-07-01' },
  { id: 1, company: 'Pendar Technologies', role: 'Laser SWE Co-op', start: '2025-07-01', end: '2026-01-01' },
  { id: 2, company: 'Empowerreg AI',       role: 'AI Eng. Intern',  start: '2025-07-01', end: '2026-01-01' },
  { id: 3, company: 'SRC, Inc.',           role: 'ML Eng. Intern',  start: '2025-04-01', end: '2025-07-01' },
];

const AXIS_MARKS = [
  { label: "APR '25", pct: toPct('2025-04-01') },
  { label: "JUL '25", pct: toPct('2025-07-01') },
  { label: "OCT '25", pct: toPct('2025-10-01') },
  { label: "JAN '26", pct: toPct('2026-01-01') },
  { label: "APR '26", pct: toPct('2026-04-01') },
];

// Subtle per-role accent colours for Gantt bars
const BAR_COLORS = [
  'rgba(255,255,255,0.85)',     // Bose — clean white
  'rgba(168,162,158,0.65)',     // Pendar — steel
  'rgba(96,165,250,0.50)',      // Empowerreg — sky blue
  'rgba(74,222,128,0.40)',      // SRC — emerald
];
const now = new Date();
const nowPct = Math.max(0, Math.min(100, ((now - TIMELINE_START) / TOTAL_MS) * 100));

const CareerTimeline = ({ onHoverRow, hoveredExpId }) => {
  const [ref, inView] = useInView({ threshold: 0.12, triggerOnce: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <div className="bg-[#0e0e0e] border border-white/[0.09] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
          <span className="font-mono text-[0.55rem] tracking-[0.22em] text-white/28 uppercase">◈ Career Timeline</span>
          <span className="font-mono text-[0.50rem] tracking-[0.14em] text-white/18 uppercase">Apr '25 — Jun '26</span>
        </div>
        <div className="px-5 pt-5 pb-3">
          <div className="relative">
            {AXIS_MARKS.map(m => (
              <div key={m.label} className="absolute top-0 bottom-0 w-px bg-white/[0.05] pointer-events-none"
                style={{ left: `${m.pct}%` }} />
            ))}
            {nowPct > 0 && nowPct < 100 && (
              <div className="absolute top-0 z-10 pointer-events-none" style={{ left: `${nowPct}%`, bottom: '1.5rem' }}>
                <div className="w-px h-full bg-white/[0.28]" />
                <span className="absolute -top-4 -translate-x-1/2 font-mono text-[0.40rem] tracking-[0.12em] text-white/35 uppercase bg-black px-1">now</span>
              </div>
            )}
            <div className="space-y-2.5">
              {ganttRows.map((row, i) => {
                const left  = toPct(row.start);
                const width = toPct(row.end) - left;
                const isHl  = hoveredExpId === experiences[i]?.id;
                return (
                  <div key={row.id} className="relative flex items-center h-8 cursor-pointer"
                    onMouseEnter={() => onHoverRow(experiences[i])}
                    onMouseLeave={() => onHoverRow(null)}
                  >
                    <div className="flex-shrink-0 w-[130px] sm:w-[150px] pr-3">
                      <span className={`font-mono text-[0.52rem] tracking-[0.08em] truncate block transition-colors duration-200 ${isHl ? 'text-white/65' : 'text-white/28'}`}>
                        {row.company}
                      </span>
                    </div>
                    <div className="relative flex-1 h-full">
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 h-6"
                        style={{ left: `${left}%`, width: `${width}%`, originX: 0 }}
                        initial={{ scaleX: 0 }}
                        animate={inView ? { scaleX: 1 } : {}}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: 'easeOut' }}
                      >
                        <div className={`w-full h-full relative overflow-hidden transition-opacity duration-200 ${isHl ? 'opacity-100' : 'opacity-70'}`}
                          style={{ backgroundColor: BAR_COLORS[i] }}>
                          <motion.div
                            className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{ x: ['-100%', '400%'] }}
                            transition={{ duration: 2.5, delay: 0.8 + i * 0.15, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 font-mono text-[0.46rem] tracking-wider text-black/55 truncate select-none">
                            {row.role}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="relative h-5 mt-0.5">
              <div className="absolute flex items-center gap-1" style={{ left: `calc(${toPct('2025-07-01')}% + 150px)` }}>
                <div className="h-px w-8 bg-white/[0.10]" />
                <span className="font-mono text-[0.44rem] text-white/16 tracking-[0.14em] uppercase">concurrent</span>
                <div className="h-px w-8 bg-white/[0.10]" />
              </div>
            </div>
          </div>
          <div className="relative h-6 mt-1 ml-[130px] sm:ml-[150px]">
            {AXIS_MARKS.map(m => (
              <span key={m.label} className="absolute font-mono text-[0.46rem] tracking-[0.10em] text-white/22 uppercase -translate-x-1/2" style={{ left: `${m.pct}%` }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Deployment Stats ────────────────────────────────────────────────────── */
// Key metric per role — shown in a 2×2 grid, highlights on row hover
const DEPLOYMENT_STATS = [
  { id: '01', company: 'Bose Corp.',     period: 'Jan – Jun 2026',  metric: '60+',    unit: 'REST endpoints shipped'      },
  { id: '02', company: 'Pendar Tech.',   period: 'Jul – Dec 2025',  metric: '100%',   unit: 'legacy LabVIEW replaced'     },
  { id: '03', company: 'Empowerreg AI',  period: 'Jul – Dec 2025',  metric: '4+ hrs', unit: 'analyst time saved per week' },
  { id: '04', company: 'SRC, Inc.',      period: 'Apr – Jul 2025',  metric: '90%',    unit: 'extraction accuracy on 500+ docs' },
];

const DeploymentStats = ({ hoveredExpId }) => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45 }}
      className="bg-[#0e0e0e] border border-white/[0.09] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
        <span className="font-mono text-[0.46rem] tracking-[0.18em] text-white/18 uppercase">◈ Key Metrics</span>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="font-mono text-[0.42rem] text-white/22 uppercase"
        >
          {hoveredExpId ? 'FOCUS' : 'OVERVIEW'}
        </motion.span>
      </div>

      {/* 2×2 metric cells separated by 1px lines */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.07]">
        {DEPLOYMENT_STATS.map((d, i) => {
          const isActive = hoveredExpId === d.id;
          const isDimmed = hoveredExpId && !isActive;
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: i * 0.07 }}
              className={`relative bg-[#0e0e0e] p-4 overflow-hidden transition-colors duration-200
                          ${isActive ? 'bg-white/[0.04]' : ''}`}
            >
              {/* Active top accent */}
              <motion.div
                className="absolute top-0 left-0 right-0 h-[1px] bg-white/35 origin-left"
                animate={{ scaleX: isActive ? 1 : 0 }}
                transition={{ duration: 0.28 }}
              />

              <div className={`transition-opacity duration-200 ${isDimmed ? 'opacity-20' : ''}`}>
                {/* Period */}
                <div className="font-mono text-[0.42rem] tracking-[0.12em] text-white/18 uppercase mb-2.5">
                  {d.id} · {d.period}
                </div>
                {/* Big metric */}
                <div className={`font-display font-bold leading-none mb-1.5 transition-colors duration-200
                                 ${isActive ? 'text-white/92' : 'text-white/55'}`}
                  style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
                  {d.metric}
                </div>
                {/* Unit label */}
                <div className="font-mono text-[0.43rem] text-white/22 leading-relaxed uppercase tracking-wide">
                  {d.unit}
                </div>
                {/* Company footer */}
                <div className={`font-mono text-[0.42rem] mt-2.5 pt-2 border-t border-white/[0.05] transition-colors duration-200
                                 ${isActive ? 'text-white/42' : 'text-white/16'}`}>
                  {d.company}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ── SVG Radar Chart ─────────────────────────────────────────────────────── */
const RADAR_AXES = [
  { label: 'Systems',  value: 90, color: '168,162,158' },
  { label: 'AI / ML',  value: 87, color: '96,165,250' },
  { label: 'Backend',  value: 88, color: '74,222,128' },
  { label: 'HPC',      value: 72, color: '248,113,113' },
  { label: 'DevOps',   value: 80, color: '251,146,60' },
  { label: 'Data Eng', value: 84, color: '167,139,250' },
];

// Which domains each role touches (for hover highlighting)
const EXP_DOMAINS = {
  '01': ['Systems', 'Backend', 'DevOps'],   // Bose
  '02': ['Systems'],                         // Pendar
  '03': ['AI / ML', 'Backend', 'DevOps'],   // Empowerreg
  '04': ['AI / ML', 'Data Eng'],            // SRC
};

const RD_N = RADAR_AXES.length;
const RD_SIZE = 260;
const RD_CX = RD_SIZE / 2;
const RD_CY = RD_SIZE / 2;
const RD_R = 96;
const rdAngle = (i) => (Math.PI * 2 / RD_N) * i - Math.PI / 2;
const rdPt = (i, r) => ({ x: RD_CX + r * Math.cos(rdAngle(i)), y: RD_CY + r * Math.sin(rdAngle(i)) });
const rdRing = (r) => Array.from({ length: RD_N }, (_, i) => rdPt(i, r)).map(p => `${p.x},${p.y}`).join(' ');

const RadarChart = ({ hoveredExpId }) => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const lit = hoveredExpId ? (EXP_DOMAINS[hoveredExpId] || []) : [];

  const dataPoly = RADAR_AXES.map((a, i) => {
    const p = rdPt(i, RD_R * a.value / 100);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="bg-[#0e0e0e] border border-white/[0.09] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
        <span className="font-mono text-[0.46rem] tracking-[0.18em] text-white/18 uppercase">◈ Skill Radar</span>
        <span className="font-mono text-[0.42rem] text-white/10 uppercase">6 domains</span>
      </div>

      <div className="px-2 py-3 flex justify-center">
        <svg viewBox={`0 0 ${RD_SIZE} ${RD_SIZE}`} className="w-full" style={{ maxWidth: 260 }}>
          {/* Concentric rings */}
          {[0.25, 0.5, 0.75, 1].map(s => (
            <polygon key={s} points={rdRing(RD_R * s)}
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
          ))}

          {/* Axis spokes */}
          {RADAR_AXES.map((_, i) => {
            const p = rdPt(i, RD_R);
            return <line key={i} x1={RD_CX} y1={RD_CY} x2={p.x} y2={p.y}
              stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />;
          })}

          {/* Data polygon fill */}
          <motion.polygon
            points={dataPoly}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.8}
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ transformOrigin: `${RD_CX}px ${RD_CY}px` }}
          />

          {/* Data dots + labels (accent-colored) */}
          {RADAR_AXES.map((axis, i) => {
            const dp = rdPt(i, RD_R * axis.value / 100);
            const lp = rdPt(i, RD_R + 20);
            const isLit = lit.includes(axis.label);
            const dotColor = isLit ? `rgba(${axis.color},0.90)` : `rgba(${axis.color},0.50)`;
            return (
              <g key={axis.label}>
                {/* Accent glow on lit dots */}
                {isLit && (
                  <circle cx={dp.x} cy={dp.y} r={8}
                    fill={`rgba(${axis.color},0.08)`} />
                )}
                <motion.circle
                  cx={dp.x} cy={dp.y} r={isLit ? 4 : 3}
                  fill={dotColor}
                  initial={{ scale: 0 }} animate={inView ? { scale: 1 } : {}}
                  transition={{ delay: 0.35 + i * 0.08 }}
                />
                <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize={7.5} fontFamily="JetBrains Mono, monospace"
                  fill={isLit ? `rgba(${axis.color},0.75)` : 'rgba(255,255,255,0.22)'}>
                  {axis.label}
                </text>
                <text x={lp.x} y={lp.y + 10} textAnchor="middle" dominantBaseline="middle"
                  fontSize={7} fontFamily="JetBrains Mono, monospace"
                  fill={isLit ? `rgba(${axis.color},0.55)` : 'rgba(255,255,255,0.14)'}>
                  {axis.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </motion.div>
  );
};

/* ── Experience Row ──────────────────────────────────────────────────────── */
const ExperienceRow = memo(({ experience, index, isExpanded, onToggle, onHover }) => {
  const [ref, inView] = useInView({ threshold: 0.04, triggerOnce: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.42, delay: index * 0.06, ease: 'easeOut' }}
      className={`group relative border-b border-white/[0.07] transition-all duration-200
                 ${isExpanded ? 'bg-white/[0.035] border-l-2 border-l-white/25' : 'hover:bg-white/[0.018]'}`}
      onMouseEnter={() => onHover(experience)}
      onMouseLeave={() => onHover(null)}
    >
      <motion.div
        className="absolute top-0 left-0 right-0 h-[1px] bg-white/40 origin-left pointer-events-none"
        animate={{ scaleX: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3 sm:gap-5 py-4 sm:py-5 px-3 sm:px-5"
      >
        {/* Company logo (replaces numeric ID) */}
        <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center
                         overflow-hidden border transition-all duration-300
                         ${isExpanded
                           ? 'border-white/15 bg-white/[0.05]'
                           : 'border-white/[0.06] bg-white/[0.02] group-hover:border-white/[0.12]'}`}>
          {experience.logo ? (
            <img src={experience.logo} alt=""
              className={`w-full h-full object-contain p-1.5 transition-opacity duration-300
                          ${isExpanded ? 'opacity-75' : 'opacity-45 group-hover:opacity-65'}
                          ${experience.logoInvert ? 'invert' : ''}`}
              loading="lazy"
            />
          ) : (
            <span className={`font-display text-lg font-bold transition-colors duration-300
                              ${isExpanded ? 'text-white/35' : 'text-white/12 group-hover:text-white/25'}`}>
              {experience.company.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <h3
                className={`font-display font-bold uppercase tracking-wide truncate leading-tight transition-colors duration-200
                            ${isExpanded ? 'text-white' : 'text-white/72 group-hover:text-white/92'}`}
                style={{ fontSize: 'clamp(0.92rem, 2.2vw, 1.35rem)' }}
              >
                {experience.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-mono text-[0.52rem] tracking-[0.08em] text-white/32 uppercase truncate hidden sm:block">
                  {experience.company}
                </p>
                <span className="text-white/15 hidden sm:block">·</span>
                <span className="hidden sm:flex items-center gap-1 font-mono text-[0.50rem] text-white/22">
                  <RiMapPinLine className="w-2.5 h-2.5" />{experience.location}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <span className="font-mono text-[0.50rem] tracking-[0.08em] text-white/25 uppercase hidden md:block">
                {experience.period}
              </span>
              <span className="hidden lg:inline font-mono text-[0.44rem] tracking-[0.12em] text-white/16 uppercase border border-white/[0.06] px-1.5 py-0.5">
                {experience.codename}
              </span>
              <motion.div animate={{ rotate: isExpanded ? 45 : 0 }} transition={{ duration: 0.22 }}>
                <RiAddLine className="w-4 h-4 text-white/22 group-hover:text-white/48 transition-colors" />
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-5 pb-6 pl-[calc(2.5rem+0.75rem)] sm:pl-[calc(3.5rem+1.25rem)]">
              <p className="text-[0.70rem] text-white/22 italic font-light mb-3 tracking-wide">
                "{experience.flavor}"
              </p>
              <p className="text-sm text-white/58 leading-relaxed mb-5 max-w-2xl">
                {experience.description}
              </p>
              <div className="border border-white/[0.08] bg-white/[0.015] mb-5 max-w-2xl">
                <div className="px-4 py-2.5 border-b border-white/[0.06]">
                  <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/25 uppercase">Mission Objectives</span>
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {experience.achievements.map((ach, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-4 px-4 py-3"
                    >
                      <span className="font-mono text-[0.52rem] tracking-[0.12em] text-white/18 flex-shrink-0 mt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm text-white/62 leading-relaxed">{ach}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {experience.skills.map(skill => (
                  <span key={skill} className="tech-tag">{skill}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
ExperienceRow.displayName = 'ExperienceRow';

/* ── Page stats ─────────────────────────────────────────────────────────── */
const PAGE_STATS = [
  { label: 'Deployments', value: '4'    },
  { label: 'Active Now',  value: '1'    },
  { label: 'States',      value: '3'    },
  { label: 'Timeline',    value: '15mo' },
];

/* ── Side decoration ─────────────────────────────────────────────────────── */
const SideDecor = ({ side }) => (
  <div className={`fixed ${side === 'left' ? 'left-3' : 'right-3'} top-[30%] z-[5] pointer-events-none
                   hidden 2xl:flex flex-col items-center gap-4`}>
    <motion.div
      animate={{ opacity: [0.04, 0.10, 0.04] }}
      transition={{ duration: 3.5, repeat: Infinity, delay: side === 'right' ? 1 : 0 }}
      className="w-3 h-3 border border-white/[0.14] rotate-45"
    />
    <div className="w-px h-16 bg-gradient-to-b from-white/[0.08] to-transparent" />
    <span
      className="font-mono text-[0.36rem] text-white/[0.09] uppercase tracking-[0.5em] select-none"
      style={{ writingMode: 'vertical-rl' }}
    >
      {side === 'left' ? 'IMPERIAL//ARCHIVES//CLASSIFIED' : 'CLEARANCE//ALPHA-SECTOR//7'}
    </span>
    <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/[0.05]" />
    <motion.div
      animate={{ opacity: [0.04, 0.12, 0.04] }}
      transition={{ duration: 2.2, repeat: Infinity, delay: side === 'right' ? 0 : 1.5 }}
      className="w-2 h-2 border border-white/[0.12]"
    />
  </div>
);

/* ── Page ─────────────────────────────────────────────────────────────────── */
const ExperiencePage = () => {
  const [expandedId, setExpandedId] = useState(null);
  const [hoveredExp, setHoveredExp] = useState(null);
  const [headerRef, headerInView]   = useInView({ threshold: 0.2, triggerOnce: true });

  const handleHover  = useCallback(exp => setHoveredExp(exp), []);
  const handleToggle = useCallback(id  => setExpandedId(prev => prev === id ? null : id), []);

  return (
    <main className="relative min-h-screen">
      {/* Side decorations */}
      <SideDecor side="left" />
      <SideDecor side="right" />

      {/* Video background */}
      <div className="fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-[0.22]">
          <source src="/spaceclonewars.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.88) 100%)' }}
        />
      </div>

      {/* Scanline */}
      <div className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)' }}
      />

      <div className="relative z-10 pt-20 lg:pt-24 pb-24">

        {/* Header */}
        <div ref={headerRef} className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center">
          <motion.p initial={{ opacity: 0 }} animate={headerInView ? { opacity: 1 } : {}} className="section-label mb-3">
            Timeline
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 15 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight"
          >
            Experience
          </motion.h1>
          <div className="gold-line w-16 mx-auto mt-4" />
          <motion.p
            initial={{ opacity: 0 }} animate={headerInView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-white/50 max-w-md mx-auto mt-4"
          >
            A timeline of my professional journey and technical accomplishments
          </motion.p>
        </div>

        {/* Stats strip */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={headerInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.28 }}
            className="grid grid-cols-2 sm:grid-cols-4 border border-white/[0.09] max-w-2xl mx-auto"
          >
            {PAGE_STATS.map((s, i) => (
              <div key={s.label}
                className={`px-5 py-4 text-center border-r border-white/[0.07] last:border-r-0 ${i < 2 ? 'border-b sm:border-b-0' : ''}`}>
                <div className="font-display text-xl font-bold text-white/80">{s.value}</div>
                <div className="font-mono text-[0.46rem] tracking-[0.16em] text-white/22 uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Two-column layout */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-6 max-w-6xl mx-auto items-start">

            {/* Left: Gantt + rows */}
            <div>
              <CareerTimeline onHoverRow={handleHover} hoveredExpId={hoveredExp?.id} />

              <div className="flex items-center gap-3 sm:gap-5 px-3 sm:px-5 py-2.5 border-b border-white/[0.08]">
                <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase w-10 sm:w-12 text-center flex-shrink-0">Co.</span>
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase">Role</span>
                  <span className="font-mono text-[0.50rem] tracking-[0.20em] text-white/18 uppercase hidden md:block">Period</span>
                </div>
              </div>

              {experiences.map((exp, i) => (
                <ExperienceRow
                  key={exp.id}
                  experience={exp}
                  index={i}
                  isExpanded={expandedId === exp.id}
                  onToggle={() => handleToggle(exp.id)}
                  onHover={handleHover}
                />
              ))}

              <div className="px-3 sm:px-5 pt-4">
                <span className="font-mono text-[0.48rem] tracking-[0.16em] text-white/15 uppercase">
                  {experiences.length} field deployments logged
                </span>
              </div>
            </div>

            {/* Right: stats + radar */}
            <div className="hidden xl:flex flex-col gap-4 sticky top-24">
              <DeploymentStats hoveredExpId={hoveredExp?.id} />
              <RadarChart hoveredExpId={hoveredExp?.id} />
            </div>

          </div>
        </div>
      </div>
    </main>
  );
};

export default ExperiencePage;
