import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaGithub, FaStar, FaCodeBranch, FaFire, FaCube, FaUsers, FaCode } from 'react-icons/fa';

const HeroSection  = lazy(() => import('./HeroSection'));
const AboutSection = lazy(() => import('./AboutSection'));
const LogoMarquee  = lazy(() => import('./LogoMarquee'));
const TechStack    = lazy(() => import('./TechStack'));

const SectionFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border border-white/[0.08] relative overflow-hidden">
      <motion.div
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        animate={{ x: ['-100%', '250%'] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  </div>
);

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center px-4 max-w-md">
      <h2 className="font-display text-lg font-bold text-white mb-3">Section Error</h2>
      <p className="text-sm text-white/40 mb-5">{error.message}</p>
      <button onClick={resetErrorBoundary} className="btn-imperial px-5 py-2">Retry</button>
    </div>
  </div>
);

/* ── GitHub data hooks ───────────────────────────────────────────────────── */
const useGitHubData = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [events, profile, repos] = await Promise.all([
          fetch('https://api.github.com/users/tilakpatell/events?per_page=100')
            .then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('https://api.github.com/users/tilakpatell')
            .then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('https://api.github.com/users/tilakpatell/repos?per_page=100&sort=updated')
            .then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        /* Heatmap grid — 20 weeks */
        const dayCounts = {};
        events.forEach(e => {
          const d = e.created_at?.slice(0, 10);
          if (d) dayCounts[d] = (dayCounts[d] || 0) + 1;
        });
        const today = new Date();
        const weeks = [];
        for (let w = 19; w >= 0; w--) {
          const week = [];
          for (let d = 0; d < 7; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (w * 7 + (6 - d)));
            const key = date.toISOString().slice(0, 10);
            week.push({ date: key, count: dayCounts[key] || 0 });
          }
          weeks.push(week);
        }

        /* Language stats from repos */
        const langMap = {};
        repos.forEach(r => {
          if (r.language && !r.fork) langMap[r.language] = (langMap[r.language] || 0) + 1;
        });
        const languages = Object.entries(langMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, count]) => ({ name, count }));
        const langTotal = languages.reduce((s, l) => s + l.count, 0);

        /* Recent activity feed */
        const recentActivity = events.slice(0, 5).map(e => ({
          type: e.type,
          repo: e.repo?.name?.split('/')[1] || e.repo?.name || '',
          date: e.created_at,
        }));

        /* Stars */
        const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);

        setData({
          weeks,
          profile,
          repoCount: profile?.public_repos || repos.length,
          followers: profile?.followers || 0,
          stars,
          languages,
          langTotal,
          recentActivity,
        });
      } catch { /* silent */ }
    })();
  }, []);
  return data;
};

const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', Rust: '#dea584', Go: '#00ADD8', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Lua: '#000080', Jupyter: '#DA5B0B', 'Jupyter Notebook': '#DA5B0B',
  Makefile: '#427819', CMake: '#DA3434', Verilog: '#b2b7f8', VHDL: '#adb2cb',
};

const EVENT_LABELS = {
  PushEvent: 'Pushed to', PullRequestEvent: 'PR in', CreateEvent: 'Created',
  IssuesEvent: 'Issue in', WatchEvent: 'Starred', ForkEvent: 'Forked',
  DeleteEvent: 'Deleted in', IssueCommentEvent: 'Commented in',
  PullRequestReviewEvent: 'Reviewed', ReleaseEvent: 'Released',
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ── GitHub Dashboard ───────────────────────────────────────────────────── */
const GitHubBar = () => {
  const [ref, inView] = useInView({ threshold: 0.05, triggerOnce: true });
  const gh = useGitHubData();

  const { totalEvents, activeDays, currentStreak } = useMemo(() => {
    if (!gh?.weeks) return { totalEvents: 0, activeDays: 0, currentStreak: 0 };
    const flat = gh.weeks.flat();
    const total = flat.reduce((s, d) => s + d.count, 0);
    const active = flat.filter(d => d.count > 0).length;
    let streak = 0;
    for (const d of [...flat].reverse()) {
      if (d.count > 0) streak++;
      else if (streak > 0) break;
    }
    return { totalEvents: total, activeDays: active, currentStreak: streak };
  }, [gh]);

  return (
    <section ref={ref} className="py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="border border-white/[0.09] bg-white/[0.01] overflow-hidden relative"
        >
          {/* Watermark */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 pointer-events-none select-none">
            <FaGithub className="w-32 h-32 sm:w-40 sm:h-40 text-white/[0.02]" />
          </div>

          {/* ── Single horizontal layout ── */}
          <div className="flex items-stretch">

            {/* Left: GitHub branding + stats column */}
            <div className="flex-shrink-0 border-r border-white/[0.06] flex flex-col justify-between w-[180px] sm:w-[200px]">
              {/* Branding */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <FaGithub className="w-5 h-5 text-white/45" />
                  <span className="font-display text-sm font-semibold tracking-wide text-white/45 uppercase">
                    GitHub
                  </span>
                </div>
                <span className="font-mono text-xs text-white/35 block">@tilakpatell</span>
              </div>

              {/* Stats */}
              <div className="px-4 pb-3 space-y-2.5">
                {[
                  { icon: FaFire,       val: currentStreak, label: 'Streak',  ic: 'text-orange-400/40', vc: 'text-orange-400/65' },
                  { icon: FaCodeBranch, val: totalEvents,   label: 'Events',  ic: 'text-emerald-400/40', vc: 'text-emerald-400/65' },
                  { icon: FaStar,       val: gh?.stars ?? 0, label: 'Stars',   ic: 'text-yellow-400/40', vc: 'text-yellow-400/65' },
                  { icon: FaCube,       val: gh?.repoCount ?? 0, label: 'Repos', ic: 'text-blue-400/40', vc: 'text-blue-400/65' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, x: -6 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-center gap-2"
                  >
                    <s.icon className={`w-3 h-3 flex-shrink-0 ${s.ic}`} />
                    <span className={`font-display text-sm font-bold leading-none ${s.vc}`}>{s.val}</span>
                    <span className="font-mono text-[0.50rem] text-white/35 uppercase tracking-wider">{s.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* Languages bar */}
              {gh?.languages?.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden flex">
                    {gh.languages.map((lang, i) => {
                      const pct = gh.langTotal > 0 ? (lang.count / gh.langTotal) * 100 : 0;
                      return (
                        <motion.div
                          key={lang.name}
                          initial={{ width: 0 }}
                          animate={inView ? { width: `${pct}%` } : {}}
                          transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                          className="h-full"
                          style={{ backgroundColor: LANG_COLORS[lang.name] || '#888', opacity: 0.6 }}
                          title={`${lang.name}: ${Math.round(pct)}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                    {gh.languages.slice(0, 4).map(lang => (
                      <div key={lang.name} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: LANG_COLORS[lang.name] || '#888' }} />
                        <span className="font-mono text-[0.50rem] text-white/40">{lang.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile link */}
              <motion.a
                href="https://github.com/tilakpatell"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between
                           transition-colors"
              >
                <span className="font-mono text-xs text-white/40 uppercase tracking-wider">View Profile</span>
                <span className="text-white/40 text-xs">&rarr;</span>
              </motion.a>
            </div>

            {/* Right: Full heatmap */}
            <div className="flex-1 min-w-0 px-4 sm:px-5 py-4 flex flex-col justify-center">
              {gh?.weeks ? (
                <>
                  {/* Heatmap header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono text-[0.52rem] text-white/35 uppercase tracking-wider">
                      {activeDays} active days in the last 20 weeks
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[0.45rem] text-white/30">Less</span>
                      {[0.04, 0.18, 0.32, 0.48, 0.65].map((o, i) => (
                        <div key={i} className="w-[8px] h-[8px] rounded-[1.5px]"
                          style={{ backgroundColor: i === 0 ? `rgba(255,255,255,${o})` : `rgba(74,222,128,${o})` }}
                        />
                      ))}
                      <span className="font-mono text-[0.45rem] text-white/30">More</span>
                    </div>
                  </div>

                  {/* Day labels + heatmap grid */}
                  <div className="flex gap-[3px]">
                    <div className="flex flex-col gap-[3px] mr-0.5 flex-shrink-0">
                      {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
                        <div key={i} className="h-[14px] sm:h-[16px] flex items-center">
                          <span className="font-mono text-[0.45rem] text-white/25 w-3 text-right leading-none">{d}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-[3px] flex-1 overflow-hidden">
                      {gh.weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px] flex-1 min-w-0">
                          {week.map((day) => (
                            <motion.div
                              key={day.date}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={inView ? { scale: 1, opacity: 1 } : {}}
                              transition={{ delay: 0.15 + wi * 0.015, duration: 0.12 }}
                              className="w-full h-[14px] sm:h-[16px] rounded-[2px]"
                              style={{
                                backgroundColor: day.count === 0
                                  ? 'rgba(255,255,255,0.035)'
                                  : `rgba(74,222,128,${Math.min(0.15 + day.count * 0.15, 0.65)})`,
                              }}
                              title={`${day.date}: ${day.count} events`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity — inline at bottom */}
                  {gh.recentActivity?.length > 0 && (
                    <div className="flex items-center gap-3 mt-3 overflow-hidden">
                      <span className="font-mono text-[0.50rem] text-white/30 uppercase tracking-wider flex-shrink-0">Recent</span>
                      <div className="flex items-center gap-2.5 overflow-x-auto flex-1">
                        {gh.recentActivity.slice(0, 4).map((act, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={inView ? { opacity: 1 } : {}}
                            transition={{ delay: 0.5 + i * 0.06 }}
                            className="flex items-center gap-1.5 flex-shrink-0"
                          >
                            <div className="w-1 h-1 rounded-full bg-emerald-400/30" />
                            <span className="font-mono text-[0.50rem] text-white/40">
                              {EVENT_LABELS[act.type]?.split(' ')[0] || act.type.replace('Event', '')}
                            </span>
                            <span className="font-mono text-[0.50rem] text-white/55">{act.repo}</span>
                            <span className="font-mono text-[0.45rem] text-white/25">{timeAgo(act.date)}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <FaGithub className="w-4 h-4 text-white/15" />
                  </motion.div>
                  <span className="font-mono text-xs text-white/35 uppercase tracking-widest">
                    Loading...
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ── Star Wars epigraph dividers ─────────────────────────────────────────── */
const SW_EPIGRAPHS = [
  { quote: 'Do. Or do not. There is no try.', source: 'Yoda' },
  { quote: 'I find your lack of faith disturbing.', source: 'Darth Vader' },
  { quote: 'The Force will be with you. Always.', source: 'Obi-Wan Kenobi' },
  { quote: 'This is the way.', source: 'Din Djarin' },
  { quote: 'Rebellions are built on hope.', source: 'Jyn Erso' },
  { quote: 'In my experience, there\'s no such thing as luck.', source: 'Obi-Wan Kenobi' },
  { quote: 'Never tell me the odds.', source: 'Han Solo' },
];

const Epigraph = ({ index }) => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const ep = SW_EPIGRAPHS[index % SW_EPIGRAPHS.length];
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8 }}
      className="py-10 sm:py-14 px-4 flex flex-col items-center gap-3 select-none"
    >
      {/* Decorative line + diamond */}
      <div className="flex items-center gap-3">
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/[0.10]" />
        <div className="w-2 h-2 border border-white/[0.12] rotate-45" />
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/[0.10]" />
      </div>
      <p className="font-body text-sm sm:text-base text-white/20 italic text-center max-w-md leading-relaxed">
        "{ep.quote}"
      </p>
      <span className="font-mono text-[0.46rem] tracking-[0.22em] text-white/10 uppercase">
        — {ep.source}
      </span>
      {/* Decorative accent */}
      <div className="flex items-center gap-2 mt-1">
        <div className="h-px w-4 bg-white/[0.06]" />
        <div className="w-0.5 h-0.5 bg-white/[0.08] rotate-45" />
        <div className="h-px w-4 bg-white/[0.06]" />
      </div>
    </motion.div>
  );
};

/* ── Page ─────────────────────────────────────────────────────────────────── */
const HomePage = () => (
  <div>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<SectionFallback />}><HeroSection /></Suspense>
      <Suspense fallback={<SectionFallback />}><AboutSection /></Suspense>
      <GitHubBar />
      <Suspense fallback={<SectionFallback />}><LogoMarquee /></Suspense>
      <Suspense fallback={<SectionFallback />}><TechStack /></Suspense>
      <Epigraph index={0} />
    </ErrorBoundary>
  </div>
);

export default HomePage;
