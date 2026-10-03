import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RiDownloadLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import Motif from '../components/Motifs';
import CompanyLogo from '../components/CompanyLogo';
import AwsLogoAnimated from '../components/AwsLogoAnimated';
import { Chips, Reveal, Saber, Waypoint } from '../components/ui';
import { useAchievements } from '../components/Achievements';
import { roles, fmtRange, fmtMonth, monthIndex, nowMonth } from '../data/roles';
import { profile } from '../data/profile';
import { THEMES } from '../theme/themes';
import { useTheme } from '../theme/ThemeProvider';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function Bullets({ items }) {
  return (
    <ul className="grid gap-3.5">
      {items.map((b, i) => (
        <Reveal as="li" key={i} delay={i * 50} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed text-body">
          <span className="mt-[0.7em] h-[2px] w-3 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          <span>{b}</span>
        </Reveal>
      ))}
    </ul>
  );
}

// The current role opens the page as its own centred hero: the logo draws
// itself in, then the company, the role and the key facts, with the work below.
function CurrentRole({ role }) {
  const facts = [
    ['Where', role.location],
    ['Since', fmtMonth(role.start)],
    ['Focus', 'Generative-AI capacity'],
    ['Stack', 'Python · Redshift · MCP'],
  ];
  return (
    <section id={role.id} data-theme-section={role.id} className="exp-hero relative z-10 scroll-mt-24" aria-labelledby={`${role.id}-title`}>
      <div className="exp-hero-bg" aria-hidden="true" />
      <div className="shell relative pb-14 pt-[calc(var(--nav-h)+32px)] md:pb-20 md:pt-[calc(var(--nav-h)+52px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow hero-in flex items-center justify-center gap-2.5">
            <span className="status-dot" aria-hidden="true" /> Where I am now
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <div className="hero-logo-card">
            {role.id === 'aws' ? <AwsLogoAnimated className="block h-auto w-full" /> : <CompanyLogo id={role.id} className="h-full w-full border-0" />}
          </div>
          <h1 id={`${role.id}-title`} className="display hero-in mt-8 text-[clamp(2.4rem,1.3rem+4.4vw,5.2rem)]" style={{ '--d': '120ms' }}>
            {role.company}
          </h1>
          <p className="stretch-semi hero-in mt-4 max-w-3xl text-[clamp(1.2rem,1rem+0.8vw,1.65rem)] font-semibold leading-snug text-ink" style={{ '--d': '200ms' }}>
            {role.title}
          </p>
          <dl className="hero-in mt-8 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-card border border-line sm:grid-cols-4" style={{ '--d': '280ms', background: 'var(--border)' }}>
            {facts.map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <dt className="eyebrow !text-[0.68rem]">{k}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="lead hero-in mt-8 max-w-2xl text-ink" style={{ '--d': '340ms' }}>
            {role.summary}
          </p>
        </div>

        <div className="hero-in mt-12 grid items-start gap-10 lg:grid-cols-2 lg:gap-14" style={{ '--d': '420ms' }}>
          <div>
            <p className="eyebrow">What I’m doing</p>
            <div className="mt-4">
              <Bullets items={role.bullets} />
            </div>
            <Chips items={role.stack} className="mt-6" />
          </div>
          <div>
            <Motif name={role.motif} />
            <p className="mt-4 text-sm text-muted">Scroll for every role — the site takes on each company’s colors as you go.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chapter({ role, episode, last }) {
  return (
    <section id={role.id} data-theme-section={role.id} className="shell relative z-10 scroll-mt-24 pt-12 md:pt-16" aria-labelledby={`${role.id}-title`}>
      <div className="relative">
        <Waypoint top="0.45rem" />
        <p className="eyebrow">
          Episode {ROMAN[episode - 1]} · {role.sector}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <CompanyLogo id={role.id} className="h-14 w-20 flex-none" />
        <h2 id={`${role.id}-title`} className="display text-[clamp(2.1rem,1.4rem+2.8vw,3.6rem)]">
          {role.company}
        </h2>
      </div>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <p className="stretch-semi text-xl font-semibold leading-snug text-ink">{role.title}</p>
          <p className="mono mt-2 text-sm text-muted">
            {fmtRange(role)} · {role.location}
          </p>
          <p className="lead mt-5 text-ink">{role.summary}</p>
          <div className="mt-5">
            <Bullets items={role.bullets} />
          </div>
          <Chips items={role.stack} className="mt-6" />
        </div>
        <div>
          <Motif name={role.motif} />
          {role.result && (
            <div className="mt-5 border-l-2 pl-4" style={{ borderColor: 'var(--accent)' }}>
              <p className="stretch-wide text-2xl font-semibold text-ink">{role.result.value}</p>
              <p className="mt-1 text-sm text-muted">{role.result.label}</p>
            </div>
          )}
        </div>
      </div>
      {!last && <Saber className="mt-12 md:mt-14" />}
    </section>
  );
}

function Timeline() {
  const start = Math.min(...roles.map((r) => monthIndex(r.start)));
  const end = nowMonth() + 1;
  const span = end - start;
  const pct = (m) => `${((m - start) / span) * 100}%`;
  const years = [];
  for (let m = start; m < end; m++) if (m % 12 === 0) years.push(m);

  return (
    <figure className="card mt-8 p-5 sm:p-6" aria-label="Timeline of roles">
      <div className="relative ml-[5.5rem] h-5 sm:ml-[7rem]">
        {start % 12 !== 0 && <span className="mono absolute left-0 top-0 text-xs text-muted">{Math.floor(start / 12)}</span>}
        {years.map((m) => (
          <span key={m} className="mono absolute top-0 -translate-x-1/2 text-xs text-muted" style={{ left: pct(m) }}>
            {Math.floor(m / 12)}
          </span>
        ))}
        <span className="mono absolute right-0 top-0 text-xs text-accent">now</span>
      </div>
      <ol className="mt-2 grid gap-2.5">
        {roles.map((r) => {
          const a = monthIndex(r.start);
          const b = r.end ? monthIndex(r.end) + 1 : end;
          return (
            <li key={r.id} className="grid grid-cols-[5.5rem_1fr] items-center sm:grid-cols-[7rem_1fr]">
              <Link to={`/experience?role=${r.id}`} className="mono truncate pr-3 text-sm text-body hover:text-ink">
                {r.short}
              </Link>
              <span className="relative h-5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: pct(a), width: `${((b - a) / span) * 100}%`, background: THEMES[r.id].fill || THEMES[r.id].swatch, minWidth: 8 }}
                  title={`${r.company}: ${fmtRange(r)}`}
                />
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="mono mt-4 text-xs text-muted">
        {fmtMonth(roles[roles.length - 1].start)} – now · Empowerreg was part-time and remote, alongside Pendar
      </figcaption>
    </figure>
  );
}

export default function Experience() {
  useDocumentTitle('Experience');
  const page = useRef(null);
  const { setScrollTheme } = useTheme();
  const [params] = useSearchParams();
  const { unlock } = useAchievements();

  // Re-skin the site with the company whose section crosses the middle of the screen.
  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-theme-section]')];
    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setScrollTheme(e.target.dataset.themeSection);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [setScrollTheme]);

  useEffect(() => {
    const id = params.get('role');
    if (!id) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [params]);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <CurrentRole role={roles[0]} />
      {roles.slice(1).map((r, i) => (
        <Chapter key={r.id} role={r} episode={roles.length - 1 - i} last={i === roles.length - 2} />
      ))}

      <section className="shell relative z-10 pb-24 pt-20" aria-labelledby="glance-title">
        <div className="relative">
          <Waypoint top="0.4rem" />
          <p className="eyebrow">At a glance</p>
          <h2 id="glance-title" className="title mt-3">
            Internships and co-ops alongside a CS degree at Northeastern.
          </h2>
        </div>
        <Timeline />
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="btn btn-primary" href={profile.resume.href} download={profile.resume.filename} onClick={() => unlock('resume')}>
            <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Download résumé
          </a>
          <Link className="btn btn-ghost" to="/projects">
            See projects
          </Link>
        </div>
      </section>
    </div>
  );
}
