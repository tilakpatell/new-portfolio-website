import { Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiFileTextLine, RiGithubFill, RiLinkedinBoxFill, RiMailLine, RiStarLine, RiArrowRightUpLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import Portrait from '../components/Portrait';
import CareerStrip from '../components/CareerStrip';
import ProjectCard from '../components/ProjectCard';
import { Chips, Reveal, SectionHeading, Waypoint } from '../components/ui';
import { education, focusAreas, profile, skills } from '../data/profile';
import { roles, fmtMonth } from '../data/roles';
import { featuredProjects, projectById } from '../data/projects';
import { ClaudeFeature, GameBoyFeature } from '../stages';
import { ClaudeSpark } from '../stages/ClaudeStage';
import ProjectThumb from '../components/ProjectThumb';
import { storage, useDocumentTitle } from '../lib/hooks';
import { useSectionThemes } from '../theme/ThemeProvider';
import { useFun } from '../fun/FunProvider';
import PlacesExplorer from '../components/travel/PlacesExplorer';
import PhotoBand from '../components/travel/PhotoBand';
import Interests from '../components/interests/Interests';

const LABELS = { gameboy: 'Game Boy emulator' };
const label = (id) => LABELS[id] ?? roles.find((r) => r.id === id)?.short ?? id;

// Breaking Bad's title card, with my name: Ti (titanium) and Pa (protactinium) are real.
function Element({ symbol, number, weight }) {
  return (
    <span className="element element-in">
      <sup aria-hidden="true">{number}</sup>
      {symbol}
      <sub aria-hidden="true">{weight}</sub>
    </span>
  );
}

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
    <section data-theme-section="github" className="shell relative z-10 py-14 md:py-20" aria-labelledby="gh-title">
      <SectionHeading title="Recently pushed to GitHub" id="gh-title" />
      <ul className="mt-10 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {repos.map((r) => (
          <li key={r.name}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="repo-link group flex h-full flex-col border-t border-line py-5">
              <span className="mono flex items-center justify-between gap-2 font-medium text-ink">{r.name}<RiArrowRightUpLine className="h-4 w-4 flex-none text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></span>
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
  const { heisenberg } = useFun();
  const gameboy = projectById('gameboy-emulator');
  const translator = projectById('swaminarayan-translator');
  const others = featuredProjects.filter((p) => p.id !== gameboy.id && p.id !== translator.id);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />

      {/* Hero */}
      <section data-theme-section="aws" className="shell relative z-10 pb-16 pt-[calc(var(--nav-h)+40px)] md:pb-24 md:pt-[calc(var(--nav-h)+72px)]">
        <div className="hero-wash pointer-events-none" aria-hidden="true" />
        <div className="relative grid items-end gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.6rem" />
            <Reveal>
              <p className="eyebrow">Now at Amazon Web Services</p>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="display mt-6 text-[clamp(3.6rem,1.2rem+9vw,8.4rem)]">
                {heisenberg ? (
                  <>
                    <Element symbol="Ti" number={22} weight="47.867" />
                    lak
                    <br />
                    <Element symbol="Pa" number={91} weight="231.04" />
                    tel
                  </>
                ) : (
                  <>
                    Tilak
                    <br />
                    Patel
                  </>
                )}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead mt-8 max-w-[34rem] !text-[clamp(1.125rem,1rem+0.45vw,1.3rem)] text-ink">
                I build infrastructure tooling, AI pipelines and systems software. Currently at AWS, before that RTX, Bose, Pendar and SRC.
              </p>
            </Reveal>
            <Reveal delay={180} className="mt-9 flex flex-wrap gap-3">
              <Link to="/experience" className="btn btn-primary btn-lg group">
                View experience <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link to="/resume" className="btn btn-ghost btn-lg">
                <RiFileTextLine className="h-4 w-4" aria-hidden="true" /> Résumé
              </Link>
            </Reveal>
          </div>
          <Reveal delay={90} className="mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:mx-0 lg:ml-auto lg:max-w-[380px]">
            <Portrait />
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
      <section data-theme-section="gameboy" className="shell relative z-10 py-14 md:py-20" aria-labelledby="gb-title">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
          <div className="relative">
            <Waypoint top="0.9rem" />
            <h2 id="gb-title" className="display text-[clamp(2.4rem,1.4rem+3.6vw,4.4rem)]">
              {gameboy.title}
            </h2>
            <p className="lead mt-6 max-w-xl">{gameboy.summary}</p>
            <p className="mt-4 max-w-xl leading-relaxed text-body">
              The handheld on the right runs Super Tilak Land, a four-world platformer I wrote for this site, plus Block Drop and Snake. Press Start.
            </p>
            <Chips items={gameboy.stack} className="mt-7" />
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/projects/gameboy-emulator" className="btn btn-primary group">
                How it works <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
      <section data-theme-section="claude" className="relative z-10 py-14 md:py-20" aria-labelledby="tr-title">
        <div className="feature-band" aria-hidden="true" />
        <div className="shell relative">
          <div className="relative">
            <Waypoint top="0.45rem" />
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div className="relative order-1 [container-type:inline-size] lg:order-2">
              <p className="eyebrow flex items-center gap-2">
                <ClaudeSpark className="h-4 w-4" /> Built with Claude
              </p>
              <h2 id="tr-title" className="display mt-5 text-[clamp(2rem,10cqi,3.8rem)]">
                {translator.title}
              </h2>
              <p className="lead mt-6 max-w-xl">
                Turns scanned Gujarati, Hindi and Sanskrit books into English editions typeset like a published volume.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-body">
                OCR, layout analysis and page-by-page translation with Claude, checked in a facing-page review workbench.
              </p>
              <Chips items={translator.stack.slice(0, 6)} className="mt-7" />
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/projects/swaminarayan-translator" className="btn btn-primary group">
                  See it translate <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
        </div>
      </section>

      {/* More work: a bento of the rest of the featured work */}
      <section data-theme-section="devspace" className="shell relative z-10 py-14 md:py-20" aria-labelledby="work-title">
        <SectionHeading title="A winning hackathon build, open source and systems code." id="work-title">
          Every project page has a live demo of how it works.
        </SectionHeading>
        <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:grid-rows-[auto_auto]">
          {others[0] && (
            <Reveal className="md:row-span-2">
              <ProjectCard project={others[0]} large />
            </Reveal>
          )}
          {others.slice(1).map((p, i) => (
            <Reveal key={p.id} delay={(i + 1) * 60}>
              <ProjectCard project={p} thumb="aspect-[16/6]" />
            </Reveal>
          ))}
          <Reveal delay={others.length * 60}>
            <Link to="/projects" className="card card-tint group flex h-full flex-col p-5 sm:p-6">
              <div className="grid grid-cols-4 gap-2">
                {['tree', 'shell', 'api', 'summarizer'].map((st) => (
                  <ProjectThumb key={st} stage={st} className="aspect-square" />
                ))}
              </div>
              <h3 className="stretch-semi mt-5 text-xl font-semibold text-ink">File systems, shells, APIs and ML</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Coursework and earlier builds, each with its own demo.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-ink">
                All projects <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Focus: a pinned heading beside the three areas */}
      <section data-theme-section="aws" className="shell relative z-10 py-14 md:py-20" aria-labelledby="focus-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:self-start">
            <SectionHeading title="Close to the infrastructure, the data and the hardware." id="focus-title" />
          </div>
          <ol className="grid">
            {focusAreas.map((f, i) => (
              <Reveal as="li" key={f.id} delay={i * 60} className="border-t border-line py-8 first:border-t-0 first:pt-0 lg:first:pt-1">
                <h3 className="stretch-semi text-2xl font-semibold text-ink">{f.title}</h3>
                <p className="mt-3 max-w-[60ch] leading-relaxed text-body">{f.body}</p>
                <p className="mono mt-4 text-xs text-muted">{f.where.map(label).join(', ')}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Toolkit, then education */}
      <section data-theme-section="aws" className="shell relative z-10 py-14 md:py-20" aria-labelledby="toolkit-title">
        <SectionHeading title="What I build with." id="toolkit-title" />
        <dl className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {skills.map((g, i) => (
            <Reveal key={g.id} delay={i * 60} className="border-t-2 pt-5" style={{ borderColor: 'var(--accent)' }}>
              <dt className="stretch-semi text-lg font-semibold text-ink">{g.label}</dt>
              <dd className="mt-4">
                <Chips items={g.items} />
              </dd>
            </Reveal>
          ))}
        </dl>
        <Reveal className="panel mt-12 grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
          <div>
            <h3 className="stretch-semi text-2xl font-semibold text-ink">{education.school}</h3>
            <p className="mt-2 text-body">
              {education.degree}, graduating {fmtMonth(education.graduation)}
            </p>
            <p className="mono mt-1 text-sm text-muted">GPA {education.gpa}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Coursework</p>
            <Chips items={education.coursework} className="mt-3" />
          </div>
        </Reveal>
      </section>

      <RecentRepos />

      <Interests />

      {/* Closing */}
      <section data-theme-section="aws" className="shell relative z-10 pb-24 pt-14 md:pb-32 md:pt-24" aria-labelledby="closing-title">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="closing-title" className="display max-w-4xl text-[clamp(2.3rem,1.3rem+3.8vw,4.8rem)]">
            Working on infrastructure, AI tooling or systems?
          </h2>
          <p className="lead mt-6 max-w-2xl">I’m graduating in May 2027. Email is the fastest way to reach me.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a className="btn btn-primary btn-lg" href={`mailto:${profile.email}`}>
              <RiMailLine className="h-4 w-4" aria-hidden="true" /> Email me
            </a>
            <a className="btn btn-ghost btn-lg" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer">
              <RiLinkedinBoxFill className="h-4 w-4" aria-hidden="true" /> LinkedIn
            </a>
          </div>
          <figure className="mt-16 max-w-md">
            <blockquote className="mono text-sm text-muted">“Do. Or do not. There is no try.”</blockquote>
            <figcaption className="mono mt-1 text-xs text-muted">Yoda</figcaption>
          </figure>
        </div>
      </section>

      {/* Travel: the globe, then a misty way into the travel page */}
      <section data-theme-section="travel" className="relative z-10 pt-14 md:pt-20" aria-labelledby="travel-title">
        <div className="shell relative">
          <Waypoint top="0.9rem" />
        </div>
        <PlacesExplorer />
        <PhotoBand id="band" className="travel-teaser mt-16 md:mt-24">
          <div className="shell relative py-24">
            <h3 className="display max-w-2xl text-[clamp(2.1rem,1.2rem+3vw,3.8rem)] !text-white">Mountains, lakes and a little heritage.</h3>
            <p className="mt-5 max-w-md leading-relaxed text-white/90">Postcards from every place, home base in Syracuse, and the carved stone of Akshardham.</p>
            <Link to="/travel" className="btn btn-primary btn-lg group mt-8">
              See the travel page <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </PhotoBand>
      </section>
    </div>
  );
}
