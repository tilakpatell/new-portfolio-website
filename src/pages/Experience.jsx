import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useParams } from 'react-router-dom';
import { RiFileTextLine, RiMovie2Line } from 'react-icons/ri';
import Dundies from '../components/experience/Dundies';
import RoleBanner from '../components/experience/RoleBanner';
import { audioContext } from '../lib/audio';
import PhotoCredits from '../components/travel/PhotoCredits';
import RouteLine from '../components/RouteLine';
import Motif from '../components/Motifs';
import CompanyLogo from '../components/CompanyLogo';
import AwsLogoAnimated from '../components/AwsLogoAnimated';
import { Bullets, Chips, Reveal, Saber, useFitTitle, Waypoint } from '../components/ui';
import '../styles/lazy/experience.css';

const OpeningCrawl = lazy(() => import('../components/experience/OpeningCrawl'));
import { roles, fmtRange, fmtMonth, monthIndex, nowMonth, roleLink, TRACKS } from '../data/roles';
import { THEMES } from '../theme/themes';
import { useSectionThemes } from '../theme/ThemeProvider';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import { usePageParams } from '../lib/page';
import Egg from '../components/Egg';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Which track is highlighted (all, program management or engineering). It lives
// in the address (?track=pm), so a link can open on it; the other roles dim.
const TrackContext = createContext({ track: 'all', setTrack: () => {} });
const useTrack = () => useContext(TrackContext);
const dimmed = (track, role) => track !== 'all' && role.track !== track;

function TrackSwitch({ className = '', align = 'center' }) {
  const { track, setTrack } = useTrack();
  const justify = align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${justify} ${className}`}>
      <span className="text-sm text-muted">Highlight</span>
      <div className={`seg ${justify}`} data-tour="experience-track" role="group" aria-label="Highlight roles">
        {TRACKS.map((t) => (
          <button key={t.id} type="button" aria-pressed={track === t.id} onClick={() => setTrack(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// The current role opens the page as its own centred hero: the logo draws
// itself in, then the company, the role and the key facts, with the work below.
function CurrentRole({ role, onCrawl }) {
  const { track } = useTrack();
  const facts = [
    ['Where', role.location],
    ['Since', fmtMonth(role.start)],
    ['Focus', 'Generative-AI capacity'],
    ['Stack', 'Python · Redshift · MCP'],
  ];
  return (
    <section id={role.id} data-theme-section={role.id} className="exp-hero relative z-10 scroll-mt-24" data-dim={dimmed(track, role) || undefined} aria-labelledby={`${role.id}-title`}>
      <div className="exp-hero-bg" aria-hidden="true" />
      <div className="shell relative pb-14 pt-[calc(var(--nav-h)+32px)] md:pb-20 md:pt-[calc(var(--nav-h)+52px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow hero-in text-center">
            Where I am now
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <div className="hero-logo-card">
            {role.id === 'aws' ? <AwsLogoAnimated className="block h-auto w-full" /> : <CompanyLogo id={role.id} className="h-full w-full border-0" />}
          </div>
          <PageTitle id={`${role.id}-title`} data-tour="experience-roles" className="display hero-in mt-8 text-[clamp(2.4rem,1.3rem+4.4vw,5.2rem)]" style={{ '--d': '120ms' }}>
            {role.company}
          </PageTitle>
          <p className="stretch-semi hero-in mt-4 max-w-3xl text-[clamp(1.2rem,1rem+0.8vw,1.65rem)] font-semibold leading-snug text-ink" style={{ '--d': '200ms' }}>
            {role.title}
          </p>
          <dl className="hero-in mt-8 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-card border border-line sm:grid-cols-4" style={{ '--d': '280ms', background: 'var(--border)' }}>
            {facts.map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <dt className="label">{k}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="lead hero-in mt-8 max-w-2xl text-ink" style={{ '--d': '340ms' }}>
            {role.summary}
          </p>
          <button type="button" className="btn btn-ghost btn-sm hero-in mt-6" style={{ '--d': '400ms' }} onClick={onCrawl}>
            <RiMovie2Line className="h-4 w-4" aria-hidden="true" /> Play the opening crawl
          </button>
          <TrackSwitch className="hero-in mt-6" />
        </div>

        <RoleBanner role={role.id} className="mt-12" />
        <div className="hero-in mt-12 grid items-start gap-10 lg:grid-cols-2 lg:gap-14" style={{ '--d': '420ms' }}>
          <div>
            <p className="label">What I’m doing</p>
            <div className="mt-4">
              <Bullets items={role.bullets} />
            </div>
            <Chips items={role.stack} className="mt-6" />
          </div>
          <div>
            <Motif name={role.motif} />
            <p className="mt-4 text-sm text-muted">Every earlier role follows below. The site takes on each company’s colours as you reach it.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const roleType = (role) => (role.title.includes('Co-op') ? 'Co-op' : role.title.includes('part-time') ? 'Part-time internship' : 'Internship');

// Every earlier role: the company pinned on the left while its work scrolls past on the right.
function Chapter({ role, episode, last }) {
  const { track } = useTrack();
  const fitTitle = useFitTitle();
  const facts = [
    ['Where', role.location],
    ['When', fmtRange(role)],
    ['Type', roleType(role)],
    role.result ? ['Impact', `${role.result.value} ${role.result.short}`] : ['Sector', role.sector],
  ];
  return (
    <section id={role.id} data-theme-section={role.id} className="exp-chapter relative z-10 scroll-mt-24" data-dim={dimmed(track, role) || undefined} aria-labelledby={`${role.id}-title`}>
      <div className="shell relative pt-16 md:pt-24">
        <RoleBanner role={role.id} className="mb-10 md:mb-14" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="relative lg:sticky lg:top-[calc(var(--nav-h)+32px)] lg:self-start">
            <Waypoint top="0.45rem" />
            <p className="eyebrow">
              Episode {ROMAN[episode - 1]} · {role.sector}
            </p>
            <Reveal className="chapter-logo-card is-small mt-6">
              <CompanyLogo id={role.id} className="h-full w-full border-0 bg-transparent" />
            </Reveal>
            <h2 ref={fitTitle} id={`${role.id}-title`} className="display mt-7 text-[clamp(2.2rem,1.3rem+3vw,3.8rem)]">
              {role.company}
            </h2>
            <p className="stretch-semi mt-3 text-[clamp(1.05rem,1rem+0.4vw,1.25rem)] font-semibold leading-snug text-ink">{role.title}</p>
            <dl className="mt-7 grid max-w-md grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pt-10">
            <p className="lead lead-lg max-w-2xl text-ink">{role.summary}</p>
            <div className="mt-8">
              <Bullets items={role.bullets} />
            </div>
            <Chips items={role.stack} className="mt-7" />
            <div className="mt-10">
              <Motif name={role.motif} />
            </div>
          </div>
        </div>
        {!last && <Saber className="mt-16 md:mt-24" />}
      </div>
    </section>
  );
}

function Timeline() {
  const { track } = useTrack();
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
            <li key={r.id} className="exp-tl-row grid grid-cols-[5.5rem_1fr] items-center sm:grid-cols-[7rem_1fr]" data-dim={dimmed(track, r) || undefined}>
              <Link to={roleLink(r.id)} className="mono truncate pr-3 text-sm text-body hover:text-ink">
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
        {fmtMonth(roles[roles.length - 1].start)} to now. Empowerreg was part-time and remote, alongside Pendar
      </figcaption>
    </figure>
  );
}

export default function Experience() {
  // /experience/aws (and the older /experience?role=aws) opens on that role
  const { roleId } = useParams();
  const [params, setParams] = usePageParams();
  const linked = roles.find((r) => r.id === (roleId || params.get('role')));
  useDocumentTitle(linked ? `${linked.company} · Experience` : 'Experience');
  const page = useRef(null);
  const [crawl, setCrawl] = useState(false);
  const track = TRACKS.some((t) => t.id === params.get('track')) ? params.get('track') : 'all';
  const setTrack = (t) => {
    const next = new URLSearchParams(params);
    if (t === 'all') next.delete('track');
    else next.set('track', t);
    setParams(next, { replace: true });
  };

  useSectionThemes(page);

  useEffect(() => {
    const id = linked?.id;
    if (!id) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [linked]);

  return (
    <TrackContext.Provider value={{ track, setTrack }}>
      <div ref={page} className="relative">
        <RouteLine containerRef={page} />
        <CurrentRole
          role={roles[0]}
          onCrawl={() => {
            audioContext(); // in the click, so the main title can play
            setCrawl(true);
          }}
        />
        {roles.slice(1).map((r, i) => (
          <Chapter key={r.id} role={r} episode={roles.length - 1 - i} last={i === roles.length - 2} />
        ))}

        <Dundies />

        <section className="shell section-last relative z-10 pt-20" aria-labelledby="glance-title">
          <div className="relative">
            <Waypoint top="0.4rem" />
            <h2 id="glance-title" className="title">
              Internships and co-ops alongside a CS degree at Northeastern.
            </h2>
          </div>
          <TrackSwitch className="mt-8" align="start" />
          <Timeline />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-primary" to="/resume">
              <RiFileTextLine className="h-4 w-4" aria-hidden="true" /> Résumé
            </Link>
            <Link className="btn btn-ghost" to="/projects">
              See projects
            </Link>
            <Egg id="mjolnir" className="ml-auto self-center" />
          </div>
        </section>
        <PhotoCredits ids={roles.map((r) => `exp-${r.id}`)} note="The photos at the top of each role are freely licensed, from Wikimedia Commons." />
        {crawl && (
          <Suspense fallback={null}>
            <OpeningCrawl onClose={() => setCrawl(false)} />
          </Suspense>
        )}
      </div>
    </TrackContext.Provider>
  );
}
