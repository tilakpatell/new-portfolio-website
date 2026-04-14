import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useAchievements } from '../components/Achievements';

/* ── Animated counter — counts up from 0 on scroll into view ─────────── */
const AnimatedNum = ({ target, inView, suffix = '+' }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const num = parseInt(target, 10);
    if (isNaN(num)) { setVal(target); return; }
    const dur = 1200;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(Math.round(num * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return <>{val}{suffix}</>;
};

const stats = [
  { label: 'Languages', value: 6 },
  { label: 'Projects',  value: 9 },
  { label: 'Co-ops',    value: 4 },
];

/* ── GitHub profile stats (fetched once on mount) ────────────────────── */
const useGitHubProfile = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [profile, repos] = await Promise.all([
          fetch('https://api.github.com/users/tilakpatell').then(r => r.ok ? r.json() : null),
          fetch('https://api.github.com/users/tilakpatell/repos?per_page=100').then(r => r.ok ? r.json() : []),
        ]);
        if (!profile) return;
        const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
        setData({ repos: profile.public_repos, followers: profile.followers, stars });
      } catch { /* silent */ }
    })();
  }, []);
  return data;
};

const AboutSection = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [ref, inView] = useInView({ threshold: 0.10, triggerOnce: true });
  const gh = useGitHubProfile();
  const { unlock } = useAchievements();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  const handleDownloadCV = () => {
    unlock('resume');
    const link = document.createElement('a');
    link.href = '/Resume.pdf';
    link.download = 'Tilak_Patel_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section ref={containerRef} className="relative overflow-hidden py-24 sm:py-36">
      {/* Video background */}
      <motion.div style={{ y: parallaxY }} className="absolute inset-0 -top-16 -bottom-16">
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-[0.22]"
        >
          <source src="/star-destroyer.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 90% 80% at 50% 40%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.92) 100%)' }}
        />
      </motion.div>

      <div ref={ref} className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-10 lg:gap-20 items-start max-w-5xl mx-auto">

          {/* Left: Photo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto w-full max-w-[260px] lg:max-w-none space-y-3"
          >
            <div className="relative aspect-[3/4] w-full corner-brackets overflow-hidden">
              <img
                src="/profile-pic.jpg"
                alt="Tilak Patel"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Status below photo */}
            <div className="border border-white/10 px-3 py-2.5 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-pulse shrink-0" />
              <span className="font-mono text-[0.58rem] tracking-[0.18em] text-white/45 uppercase">
                Open to Opportunities
              </span>
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="space-y-7"
          >
            {/* Name */}
            <div>
              <h3
                className="font-display font-bold text-white leading-none tracking-wide"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
              >
                TILAK PATEL
              </h3>
              <span
                className="font-mono text-xs tracking-[0.3em] text-white/35 mt-1.5 block select-none uppercase"
              >
                Software Engineer
              </span>
            </div>

            {/* Bio */}
            <div className="space-y-3 border-l border-white/[0.10] pl-4">
              <p className="text-sm sm:text-base text-white/75 leading-relaxed">
                Dedicated software engineer with expertise in AI,
                machine learning, and high-performance computing. Strong
                background in full-stack development, embedded systems,
                and distributed computing.
              </p>
              <p className="text-sm text-white/55 leading-relaxed">
                My work spans HPC research, artificial intelligence, and
                robotics — building intelligent, high-performance applications
                using Python, C, and modern frameworks, pushing the boundaries
                of software and hardware integration.
              </p>
            </div>

            {/* Stats — animated counters */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.08] border border-white/[0.08]">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.45 + i * 0.08 }}
                  className="px-4 py-4 text-center"
                >
                  <div className="font-display text-2xl sm:text-3xl font-bold text-white leading-none">
                    <AnimatedNum target={stat.value} inView={inView} />
                  </div>
                  <div className="font-mono text-[0.58rem] tracking-[0.16em] text-white/35 uppercase mt-1.5">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* GitHub live stats strip */}
            {gh && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.7 }}
                className="flex items-center gap-3 border border-white/[0.08] px-4 py-3"
              >
                <span className="font-mono text-xs tracking-[0.18em] text-white/38 uppercase flex-shrink-0">
                  ◈ GitHub
                </span>
                <div className="flex-1 flex items-center gap-4 overflow-x-auto">
                  {[
                    { label: 'Repos', value: gh.repos },
                    { label: 'Stars', value: gh.stars },
                    { label: 'Followers', value: gh.followers },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-display text-sm font-bold text-white/70">
                        <AnimatedNum target={s.value} inView={inView} suffix="" />
                      </span>
                      <span className="font-mono text-xs text-white/42 uppercase">{s.label}</span>
                    </div>
                  ))}
                </div>
                <a href="https://github.com/tilakpatell" target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-white/38 hover:text-white/60 transition-colors uppercase tracking-wider flex-shrink-0">
                  View →
                </a>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleDownloadCV}
                className="btn-imperial-solid"
              >
                Download CV
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate('/contact')}
                className="btn-imperial"
              >
                Contact Me
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
