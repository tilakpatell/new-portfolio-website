import { Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiDownloadLine, RiGithubFill, RiLinkedinBoxFill, RiMailLine, RiStarLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import Portrait from '../components/Portrait';
import CareerStrip from '../components/CareerStrip';
import ProjectCard from '../components/ProjectCard';
import { Chips, Reveal, Saber, SectionHeading, Waypoint } from '../components/ui';
import { useAchievements } from '../components/Achievements';
import { education, focusAreas, profile, skills } from '../data/profile';
import { roles, fmtMonth } from '../data/roles';
import { featuredProjects, projectById } from '../data/projects';
import { THEMES } from '../theme/themes';
import { ClaudeFeature, GameBoyFeature } from '../stages';
import { ClaudeSpark } from '../stages/ClaudeStage';
import ProjectThumb from '../components/ProjectThumb';
import { storage, useDocumentTitle } from '../lib/hooks';
import { useSectionThemes } from '../theme/ThemeProvider';

const LABELS = { gameboy: 'Game Boy emulator' };
const label = (id) => LABELS[id] ?? roles.find((r) => r.id === id)?.short ?? id;

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

// Mounts children only when the placeholder gets near the viewport.
function LazyMount({ children, minHeight }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={on ? undefined : { minHeight }}>
      {on && children}
    </div>
  );
}

function useRecentRepos() {
  const [repos, setRepos] = useState(() => {
    const cached = storage.get('tp-gh-repos');
    return cached && Date.now() - cached.t < 30 * 60 * 1000 ? cached.data : null;
  });
  useEffect(() => {
    if (repos) return undefined;
    const ctrl = new AbortController();
    fetch('https://api.github.com/users/tilakpatell/repos?sort=pushed&per_page=12', {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list) => {
        const data = list
          .filter((r) => !r.fork && !r.archived)
          .slice(0, 4)
          .map((r) => ({ name: r.name, url: r.html_url, desc: r.description, lang: r.language, pushed: r.pushed_at, stars: r.stargazers_count }));
        storage.set('tp-gh-repos', { t: Date.now(), data });
        setRepos(data);
      })
      .catch(() => setRepos([]));
    return () => ctrl.abort();
  }, [repos]);
  return repos;
}

function RecentRepos() {
  const repos = useRecentRepos();
  if (!repos || repos.length === 0) return null; // never show zeros or placeholders
  return (
    <section data-theme-section="github" className="shell relative z-10 py-10 md:py-14" aria-labelledby="gh-title">
      <SectionHeading eyebrow="Live from GitHub" title="Recently pushed" id="gh-title" />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {repos.map((r) => (
          <li key={r.name}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="card flex h-full flex-col p-5">
              <span className="mono font-medium text-ink">{r.name}</span>
              {r.desc && <span className="mt-2 text-sm leading-relaxed text-body">{r.desc}</span>}
              <span className="mono mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted">
                {r.lang && <span>{r.lang}</span>}
                {r.stars > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <RiStarLine className="h-3.5 w-3.5" aria-hidden="true" />
                    {r.stars}
                  </span>
                )}
                <span>pushed {timeAgo(r.pushed)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  useDocumentTitle(null);
  useSectionThemes();
  const page = useRef(null);

  // Load the two live demos while the browser is idle, so they don't stall a scroll later.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const id = idle(() => {
      import('../stages/GameBoyStage');
      import('../stages/ClaudeStage');
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);
  const { unlock } = useAchievements();
  const gameboy = projectById('gameboy-emulator');
  const translator = projectById('swaminarayan-translator');
  const others = featuredProjects.filter((p) => p.id !== gameboy.id && p.id !== translator.id);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />

      {/* Hero */}
      <section data-theme-section="aws" className="shell relative z-10 pb-14 pt-[calc(var(--nav-h)+36px)] md:pb-20 md:pt-[calc(var(--nav-h)+64px)]">
        <div className="hero-grid pointer-events-none" aria-hidden="true" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.6rem" />
            <Reveal>
              <p className="eyebrow flex items-center gap-2.5">
                <span className="status-dot" aria-hidden="true" />
                <span className="sm:hidden">Now at AWS · Herndon, VA</span>
                <span className="hidden sm:inline">Now at Amazon Web Services · Herndon, VA</span>
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="display mt-5 text-[clamp(3.3rem,1.4rem+8vw,7.2rem)]">
                Tilak
                <br />
                Patel
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="stretch-semi mt-6 text-[clamp(1.15rem,1rem+0.7vw,1.45rem)] font-medium text-ink">
                Software engineer — infrastructure, AI pipelines and systems.
              </p>
              <p className="lead mt-4 max-w-[38rem]">{profile.lead} Before that: RTX, Bose, Pendar Technologies and SRC.</p>
            </Reveal>
            <Reveal delay={180} className="mt-8 flex flex-wrap gap-3">
              <Link to="/experience" className="btn btn-primary">
                View experience <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={profile.resume.href} download={profile.resume.filename} onClick={() => unlock('resume')} className="btn btn-ghost">
                <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Résumé
              </a>
              <Link to="/contact" className="btn btn-ghost">
                Contact
              </Link>
            </Reveal>
            <Reveal delay={220} className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <a className="inline-flex items-center gap-2 text-body hover:text-ink" href={profile.github.url} target="_blank" rel="noopener noreferrer">
                <RiGithubFill className="h-5 w-5" aria-hidden="true" /> github.com/{profile.github.handle}
              </a>
              <a className="inline-flex items-center gap-2 text-body hover:text-ink" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer">
                <RiLinkedinBoxFill className="h-5 w-5" aria-hidden="true" /> in/{profile.linkedin.handle}
              </a>
              <a className="inline-flex items-center gap-2 text-body hover:text-ink" href={`mailto:${profile.email}`}>
                <RiMailLine className="h-5 w-5" aria-hidden="true" /> {profile.email}
              </a>
            </Reveal>
          </div>
          <Reveal delay={90} className="mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[400px]">
            <Portrait />
            <p className="mono mt-4 flex items-center justify-between gap-4 text-xs text-muted">
              <span>B.S. Computer Science</span>
              <span>Northeastern ’27</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Career route */}
      <section data-theme-section="aws" className="shell relative z-10 pb-6 md:pb-0" aria-label="Experience, newest first">
        <CareerStrip />
        {/* The route line turns back across the page here, in clear space below the strip */}
        <div className="relative hidden h-20 md:block" aria-hidden="true">
          <Waypoint top="5rem" data-node="false" />
        </div>
      </section>

      {/* Featured: the Game Boy */}
      <section data-theme-section="gameboy" className="shell relative z-10 py-12 md:py-16" aria-labelledby="gb-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.45rem" />
            <p className="eyebrow">Featured project</p>
            <h2 id="gb-title" className="display mt-4 text-[clamp(2.2rem,1.4rem+3.2vw,3.8rem)]">
              {gameboy.title}
            </h2>
            <p className="lead mt-5 max-w-xl">{gameboy.summary}</p>
            <p className="mt-4 max-w-xl text-body">
              The handheld on the right runs a Mario-style level I wrote for this site — tap A or press Space to jump.
            </p>
            <Chips items={gameboy.stack} className="mt-6" />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/projects/gameboy-emulator" className="btn btn-primary">
                How it works <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="https://github.com/tilakpatell/gameboy-emulator" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Source
              </a>
            </div>
          </div>
          <LazyMount minHeight={520}>
            <Suspense fallback={<div style={{ minHeight: 520 }} />}>
              <GameBoyFeature compact />
            </Suspense>
          </LazyMount>
        </div>
      </section>

      {/* Featured: the translator, with Claude */}
      <section data-theme-section="claude" className="shell relative z-10 py-12 md:py-16" aria-labelledby="tr-title">
        <div className="relative">
          <Waypoint top="0.45rem" />
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="relative order-1 lg:order-2">
            <p className="eyebrow flex items-center gap-2">
              <ClaudeSpark className="h-4 w-4" /> Built with Claude
            </p>
            <h2 id="tr-title" className="display mt-4 text-[clamp(2.1rem,1.4rem+2.8vw,3.4rem)]">
              {translator.title}
            </h2>
            <p className="lead mt-5 max-w-xl">{translator.summary}</p>
            <Chips items={translator.stack.slice(0, 6)} className="mt-6" />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/projects/swaminarayan-translator" className="btn btn-primary">
                See it translate <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="order-2 lg:order-1">
            <LazyMount minHeight={420}>
              <Suspense fallback={<div style={{ minHeight: 420 }} />}>
                <ClaudeFeature />
              </Suspense>
            </LazyMount>
          </div>
        </div>
      </section>

      <div className="shell relative z-10">
        <Saber className="my-6" />
      </div>

      {/* More work */}
      <section data-theme-section="devspace" className="shell relative z-10 py-10 md:py-14" aria-labelledby="work-title">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="More work" title="A winning hackathon build, open source and systems code." id="work-title">
            Every project page has a live demo of how it works.
          </SectionHeading>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {others.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
          <Reveal delay={others.length * 60}>
            <Link to="/projects" className="card group flex h-full flex-col p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2">
                {['tree', 'shell', 'api', 'summarizer'].map((st) => (
                  <ProjectThumb key={st} stage={st} className="aspect-[16/10]" />
                ))}
              </div>
              <p className="eyebrow mt-5">And more</p>
              <h3 className="stretch-semi mt-2 text-xl font-semibold text-ink">File systems, shells, APIs and ML</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Coursework and earlier builds — each with its own demo.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-ink">
                All projects <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Focus */}
      <section data-theme-section="aws" className="shell relative z-10 py-10 md:py-14" aria-labelledby="focus-title">
        <SectionHeading eyebrow="What I work on" title="Close to the infrastructure, the data and the hardware." id="focus-title" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {focusAreas.map((f, i) => (
            <Reveal key={f.id} delay={i * 60} className="card flex flex-col p-6">
              <h3 className="stretch-semi text-xl font-semibold text-ink">{f.title}</h3>
              <p className="mt-3 leading-relaxed text-body">{f.body}</p>
              <ul className="mt-auto flex flex-wrap gap-2 pt-6">
                {f.where.map((w) => (
                  <li key={w} className="chip">
                    {THEMES[w] && <span className="h-2 w-2 rounded-full" style={{ background: THEMES[w].swatch }} aria-hidden="true" />}
                    {label(w)}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Toolkit + education */}
      <section data-theme-section="aws" className="shell relative z-10 py-10 md:py-14" aria-labelledby="toolkit-title">
        <SectionHeading eyebrow="Toolkit" title="What I build with." id="toolkit-title" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
          <dl className="grid content-start gap-7">
            {skills.map((g) => (
              <div key={g.id} className="grid gap-3 sm:grid-cols-[9.5rem_1fr] sm:gap-6">
                <dt className="eyebrow pt-1.5">{g.label}</dt>
                <dd>
                  <Chips items={g.items} />
                </dd>
              </div>
            ))}
          </dl>
          <Reveal className="card p-6">
            <p className="eyebrow">Education</p>
            <h3 className="stretch-semi mt-3 text-2xl font-semibold text-ink">{education.school}</h3>
            <p className="mt-1 text-body">
              {education.degree} · {fmtMonth(education.graduation)}
            </p>
            <p className="mono mt-1 text-sm text-muted">GPA {education.gpa}</p>
            <div className="divider my-5" />
            <p className="eyebrow">Coursework</p>
            <Chips items={education.coursework} className="mt-3" />
          </Reveal>
        </div>
      </section>

      <RecentRepos />

      {/* Closing */}
      <section data-theme-section="aws" className="shell relative z-10 pb-24 pt-10 md:pt-16" aria-labelledby="closing-title">
        <div className="relative">
          <Waypoint top="0.4rem" />
          <p className="eyebrow">Get in touch</p>
          <h2 id="closing-title" className="display mt-5 max-w-4xl text-[clamp(2.1rem,1.3rem+3.4vw,4.2rem)]">
            Working on infrastructure, AI tooling or systems?
          </h2>
          <p className="lead mt-5 max-w-2xl">{profile.offClock}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn btn-primary" href={`mailto:${profile.email}`}>
              <RiMailLine className="h-4 w-4" aria-hidden="true" /> Email me
            </a>
            <a className="btn btn-ghost" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer">
              <RiLinkedinBoxFill className="h-4 w-4" aria-hidden="true" /> LinkedIn
            </a>
          </div>
          <figure className="mt-14 max-w-md">
            <blockquote className="mono text-sm text-muted">“Do. Or do not. There is no try.”</blockquote>
            <figcaption className="mono mt-1 text-xs text-muted">— Yoda</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
