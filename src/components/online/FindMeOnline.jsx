import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightUpLine, RiGithubFill, RiLinkedinBoxFill, RiStarLine } from 'react-icons/ri';
import { Waypoint } from '../ui';
import ResumeSheet from '../ResumeSheet';
import { profile } from '../../data/profile';
import { roles } from '../../data/roles';
import { local } from '../../lib/hooks';
import '../../styles/lazy/online.css';

// GitHub, LinkedIn and the résumé side by side. GitHub numbers come from the
// snapshot saved at build time (public/github.json) and are refreshed from the
// live API when the cached copy is older than six hours.

const CACHE = 'tp-gh-v2';
const SIX_HOURS = 6 * 3600 * 1000;
const HIDE = /portfolio|github\.io/i; // this site's own repositories

// GitHub's own language colours.
const LANG = { Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', HTML: '#e34c26', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B', Go: '#00ADD8', Rust: '#dea584' };

async function live(base) {
  const json = (url) => fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const [u, r, c] = await Promise.allSettled([
    json(`https://api.github.com/users/${profile.github.handle}`),
    json(`https://api.github.com/users/${profile.github.handle}/repos?per_page=100&sort=pushed`),
    json(`https://github-contributions-api.jogruber.de/v4/${profile.github.handle}?y=last`),
  ]);
  const next = { ...(base || {}) };
  if (u.status === 'fulfilled') next.user = { login: u.value.login, name: u.value.name, avatar: u.value.avatar_url, url: u.value.html_url, publicRepos: u.value.public_repos };
  if (r.status === 'fulfilled') {
    const own = r.value.filter((x) => !x.fork && !x.archived);
    const langs = {};
    own.forEach((x) => x.language && (langs[x.language] = (langs[x.language] || 0) + 1));
    next.languages = Object.entries(langs).sort((a, b) => b[1] - a[1]);
    next.repos = own.slice(0, 6).map((x) => ({ name: x.name, url: x.html_url, desc: x.description, lang: x.language, pushed: x.pushed_at, stars: x.stargazers_count }));
  }
  if (c.status === 'fulfilled' && Array.isArray(c.value.contributions)) {
    const days = c.value.contributions;
    next.contributions = { total: c.value.total?.lastYear ?? 0, start: days[0]?.date, counts: days.map((d) => d.count), levels: days.map((d) => d.level).join('') };
  }
  return [u, r, c].some((x) => x.status === 'fulfilled') ? next : null;
}

function useGitHub() {
  const [data, setData] = useState(() => local.get(CACHE)?.data ?? null);
  const [state, setState] = useState(data ? 'ready' : 'loading');
  useEffect(() => {
    let alive = true;
    const cached = local.get(CACHE);
    (async () => {
      let base = cached?.data ?? null;
      if (!base) {
        base = await fetch('/github.json')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (alive && base) {
          setData(base);
          setState('ready');
        }
      }
      if (cached && Date.now() - cached.t < SIX_HOURS) return;
      const fresh = await live(base).catch(() => null);
      if (!alive) return;
      if (fresh) {
        setData(fresh);
        setState('ready');
        local.set(CACHE, { t: Date.now(), data: fresh });
      } else if (!base) setState('error');
    })();
    return () => {
      alive = false;
    };
  }, []);
  return [data, state];
}

const ago = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'a month ago' : `${months} months ago`;
  return 'over a year ago';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const S = 14;
const L = 28;
const T = 16;

// The year of squares, built once per set of data (it has 365 of them, and the
// home page re-themes itself several times on the way past).
function buildCalendar(contributions) {
  const start = new Date(`${contributions.start}T00:00:00`);
  const offset = start.getDay();
  const n = contributions.counts.length;
  const cols = Math.ceil((offset + n) / 7);
  const months = [];
  const cells = contributions.counts.map((count, i) => {
    const slot = offset + i;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDate() === 1 || i === 0) months.push({ col, label: MONTHS[d.getMonth()] });
    const level = Number(contributions.levels?.[i] ?? (count ? 2 : 0));
    const when = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return (
      <rect key={i} x={L + col * S} y={T + row * S} width={S - 3} height={S - 3} rx="2.5" className={`gh-cell gh-l${level}`}>
        <title>{`${count || 'No'} contribution${count === 1 ? '' : 's'} on ${when}`}</title>
      </rect>
    );
  });
  return { cells, months, width: L + cols * S, height: T + 7 * S };
}

function Calendar({ contributions }) {
  const scroller = useRef(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [contributions]);
  const ok = Boolean(contributions?.start && contributions.counts?.length);
  const built = useMemo(() => (ok ? buildCalendar(contributions) : null), [ok, contributions]);
  if (!built) return null;
  const { cells, months, width, height } = built;
  return (
    <div ref={scroller} className="gh-scroll" tabIndex={0} role="region" aria-label="GitHub contributions over the last year (scrolls sideways)">
      <svg viewBox={`0 0 ${width} ${height}`} className="gh-svg" role="img" aria-label={`${contributions.total} contributions on GitHub in the last year`}>
        {months
          .filter((m, i) => i === 0 || m.col - months[i - 1].col > 2)
          .map((m) => (
            <text key={`${m.col}-${m.label}`} x={L + m.col * S} y="10" className="gh-label">
              {m.label}
            </text>
          ))}
        {['Mon', 'Wed', 'Fri'].map((d, i) => (
          <text key={d} x="0" y={T + (1 + i * 2) * S + 9} className="gh-label">
            {d}
          </text>
        ))}
        {cells}
      </svg>
    </div>
  );
}

function GitHubPanel() {
  const [data, state] = useGitHub();
  if (state === 'loading') {
    return (
      <div className="card gh-panel p-6" aria-busy="true">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton mt-6 h-28 w-full" />
        <div className="skeleton mt-6 h-24 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <a className="card card-lift gh-panel flex items-center gap-4 p-6" href={profile.github.url} target="_blank" rel="noopener noreferrer">
        <RiGithubFill className="h-8 w-8 text-ink" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-ink">github.com/{profile.github.handle}</span>
          <span className="block text-sm text-muted">GitHub isn’t answering right now. The profile is one click away.</span>
        </span>
      </a>
    );
  }
  const repos = (data.repos ?? []).filter((r) => !HIDE.test(r.name)).slice(0, 4);
  const langs = (data.languages ?? []).slice(0, 5);
  const langTotal = langs.reduce((n, [, c]) => n + c, 0);
  return (
    <div className="card gh-panel p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-4">
        {data.user?.avatar && <img src={data.user.avatar} alt="" width="56" height="56" className="h-14 w-14 rounded-[14px] border border-line" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <p className="stretch-semi text-lg font-semibold text-ink">{data.user?.name ?? profile.name}</p>
          <p className="mono text-sm text-muted">@{data.user?.login ?? profile.github.handle}</p>
        </div>
        <a className="btn btn-ghost btn-sm" href={profile.github.url} target="_blank" rel="noopener noreferrer">
          <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Follow
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data.contributions?.total > 0 && (
          <div>
            <dt className="text-xs text-muted">Contributions, last year</dt>
            <dd className="stretch-semi mt-0.5 text-2xl font-semibold text-ink">{data.contributions.total.toLocaleString('en-US')}</dd>
          </div>
        )}
        {data.user?.publicRepos > 0 && (
          <div>
            <dt className="text-xs text-muted">Public repositories</dt>
            <dd className="stretch-semi mt-0.5 text-2xl font-semibold text-ink">{data.user.publicRepos}</dd>
          </div>
        )}
        {langs[0] && (
          <div>
            <dt className="text-xs text-muted">Most used language</dt>
            <dd className="stretch-semi mt-0.5 text-2xl font-semibold text-ink">{langs[0][0]}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6">
        <Calendar contributions={data.contributions} />
      </div>

      {langs.length > 0 && (
        <div className="mt-6">
          <div className="gh-langbar" aria-hidden="true">
            {langs.map(([name, count]) => (
              <span key={name} style={{ width: `${(count / langTotal) * 100}%`, background: LANG[name] ?? 'var(--border-strong)' }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-body" aria-label="Languages by repository">
            {langs.map(([name, count]) => (
              <li key={name} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG[name] ?? 'var(--border-strong)' }} aria-hidden="true" />
                {name} <span className="text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {repos.length > 0 && (
        <ul className="mt-6 grid gap-x-6 sm:grid-cols-2">
          {repos.map((r) => (
            <li key={r.name}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col border-t border-line py-4">
                <span className="mono flex items-center justify-between gap-2 text-sm font-medium text-ink">
                  <span className="truncate">{r.name}</span>
                  <RiArrowRightUpLine className="h-4 w-4 flex-none text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                {r.desc && <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-body">{r.desc}</span>}
                <span className="mono mt-auto flex flex-wrap gap-x-4 pt-2 text-xs text-muted">
                  {r.lang && <span>{r.lang}</span>}
                  {r.stars > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <RiStarLine className="h-3.5 w-3.5" aria-hidden="true" />
                      {r.stars}
                    </span>
                  )}
                  <span>pushed {ago(r.pushed)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkedInCard() {
  const now = roles[0];
  const before = roles.slice(1).filter((r) => r.id !== 'empowerreg').map((r) => r.short).join(', ');
  return (
    <div className="card p-6">
      <div className="flex items-center gap-4">
        <img src={profile.photo.webpSmall} alt="" width="64" height="64" className="h-16 w-16 rounded-[18px] object-cover" loading="lazy" />
        <div className="min-w-0 flex-1">
          <p className="stretch-semi text-lg font-semibold text-ink">{profile.name}</p>
          <p className="text-sm text-body">TPM & Software Engineer, Northeastern CS ’27</p>
        </div>
        <RiLinkedinBoxFill className="h-7 w-7 flex-none" style={{ color: '#0a66c2' }} aria-hidden="true" />
      </div>
      <dl className="mt-5 grid gap-2.5 text-sm">
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <dt className="text-muted">Now</dt>
          <dd className="text-ink">
            {now.shortTitle}, {now.company}
          </dd>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <dt className="text-muted">Before</dt>
          <dd className="text-ink">{before}</dd>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <dt className="text-muted">School</dt>
          <dd className="text-ink">Northeastern University</dd>
        </div>
      </dl>
      <a className="btn btn-ghost btn-sm mt-6" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer">
        <RiLinkedinBoxFill className="h-4 w-4" aria-hidden="true" /> Connect on LinkedIn
      </a>
    </div>
  );
}

function ResumeCard() {
  const box = useRef(null);
  const [scale, setScale] = useState(0.4);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.width - 24) / 880)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <Link to="/resume" className="card card-lift group block p-4 sm:p-5">
      <div ref={box} className="resume-thumb" aria-hidden="true">
        <div className="resume-thumb-inner" style={{ transform: `translateX(-50%) scale(${scale})` }}>
          <ResumeSheet preview />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span>
          <span className="stretch-semi block text-lg font-semibold text-ink">Résumé</span>
          <span className="block text-sm text-body">One page, filterable by skill</span>
        </span>
        <RiArrowRightUpLine className="h-5 w-5 flex-none text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  );
}

function FindMeOnline() {
  return (
    <section data-theme-section="github" className="shell relative z-10 py-14 md:py-20" aria-labelledby="online-title">
      <div className="relative">
        <Waypoint top="0.9rem" />
        <h2 id="online-title" className="title" data-tour="home-github">
          Find me online
        </h2>
        <p className="lead mt-4 max-w-[52ch]">The code on GitHub, the career on LinkedIn, and the one-page version of both.</p>
      </div>
      {/* minmax(0, …) tracks: the contribution graph scrolls inside its panel instead of widening the page */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <GitHubPanel />
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
          <LinkedInCard />
          <ResumeCard />
        </div>
      </div>
    </section>
  );
}

// nothing here follows the theme, so the home page re-theming leaves it alone
export default memo(FindMeOnline);
