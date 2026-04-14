import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const employers = [
  { name: 'Bose Corporation',        role: 'Software Engineer Co-op',  period: '2026', logo: '/Bose-logo.png',  logoInvert: true,             initial: 'B' },
  { name: 'Pendar Technologies',     role: 'Laser Software Co-op',     period: '2025', logo: '/Pendar-Technologies.png',  initial: 'P' },
  { name: 'Empowerreg AI',           role: 'AI Engineer Intern',       period: '2025', logo: '/empower.png',                                  initial: 'E' },
  { name: 'SRC, Inc.',               role: 'ML Engineer Intern',       period: '2025', logo: '/src-logo.png',                                 initial: 'S' },
  { name: 'Northeastern University', role: 'B.S. Computer Science',    period: '2027', logo: '/hpclogo.jpg',                                  initial: 'N' },
];

const techStack = [
  'Python','C/C++','React','FastAPI','PyTorch','LangGraph','Docker','CUDA',
  'AWS','Spring Boot','TypeScript','MPI','Qt/PySide6','MongoDB','Linux',
  'NCCL','Electron','SDL3','FUSE','WebSockets','BERT','Grafana','Loki','CMake',
];

// 3 copies ensures ~3330px per half — fills any screen up to 3330px wide
const EMP_TRACK  = [...employers,  ...employers,  ...employers];
// 2 copies of tech = ~3936px per half — more than enough
const TECH_TRACK = [...techStack, ...techStack];

const EmployerItem = ({ emp }) => (
  <div className="flex items-center gap-3 px-4 py-3 border border-white/[0.08]
                  bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.16]
                  transition-all duration-200 flex-shrink-0 w-[220px]">
    <div className="w-8 h-8 flex-shrink-0 bg-white/[0.04] border border-white/[0.08]
                    flex items-center justify-center overflow-hidden">
      {emp.logo ? (
        <img
          src={emp.logo} alt="" className={`w-full h-full object-contain p-1 ${emp.logoInvert ? 'invert' : ''}`}
          onError={e => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.querySelector('span').style.display = 'flex';
          }}
        />
      ) : null}
      <span
        className="font-display text-xs font-bold text-white/45 items-center justify-center"
        style={{ display: emp.logo ? 'none' : 'flex' }}
      >
        {emp.initial}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-display text-[0.66rem] font-semibold text-white/62 uppercase tracking-wider leading-tight truncate">
        {emp.name}
      </div>
      <div className="font-mono text-[0.58rem] text-white/42 tracking-wider mt-0.5 truncate">
        {emp.role}
      </div>
    </div>
    <span className="font-mono text-[0.55rem] text-white/32 flex-shrink-0 pl-1">{emp.period}</span>
  </div>
);

const TechItem = ({ name }) => (
  <span className="font-mono text-[0.62rem] tracking-[0.14em] text-white/38 uppercase
                   border border-white/[0.10] bg-white/[0.02] px-3 py-[0.4rem]
                   hover:text-white/60 hover:border-white/[0.18] hover:bg-white/[0.05]
                   flex-shrink-0 transition-all duration-200 select-none whitespace-nowrap">
  {name}
</span>
);

const LogoMarquee = () => {
  const [ref, inView] = useInView({ threshold: 0.05, triggerOnce: true });

  return (
    <section ref={ref} className="relative py-12 sm:py-14">
      <div className="absolute top-0 left-0 right-0 h-px bg-white/[0.06]" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]" />

      {/* Subtle grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.012]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5 }}
      >
        {/* Label — centered to match full-width marquee tracks */}
        <div className="mb-5 flex flex-col items-center gap-1">
          <span className="font-mono text-xs tracking-[0.26em] text-white/35 uppercase">◈ Field Deployments</span>
        </div>

        {/* Row 1 — employers, scrolling left */}
        <div className="marquee-wrapper overflow-hidden mb-3">
          <div className="marquee-left flex gap-2.5 w-max">
            {EMP_TRACK.map((e, i) => <EmployerItem key={`a${i}`} emp={e} />)}
            {EMP_TRACK.map((e, i) => <EmployerItem key={`b${i}`} emp={e} />)}
          </div>
        </div>

        {/* Row 2 — tech, scrolling right */}
        <div className="marquee-wrapper overflow-hidden">
          <div className="marquee-right flex gap-2.5 w-max">
            {TECH_TRACK.map((t, i) => <TechItem key={`a${i}`} name={t} />)}
            {TECH_TRACK.map((t, i) => <TechItem key={`b${i}`} name={t} />)}
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LogoMarquee;
