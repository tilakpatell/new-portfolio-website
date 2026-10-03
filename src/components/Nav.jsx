import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { RiCheckLine, RiCloseLine, RiGithubFill, RiLinkedinBoxFill, RiMenuLine, RiMoonClearLine, RiSunLine, RiTerminalBoxLine } from 'react-icons/ri';
import { profile } from '../data/profile';
import { useAchievements } from './Achievements';
import { useTheme } from '../theme/ThemeProvider';
import { THEMES, THEME_ORDER } from '../theme/themes';

const LINKS = [
  { to: '/experience', label: 'Experience' },
  { to: '/projects', label: 'Projects' },
  { to: '/contact', label: 'Contact' },
];

// The mark: a kyber crystal, cut in the theme's colour.
export function Monogram({ className = '' }) {
  return (
    <svg viewBox="0 0 24 32" className={className} aria-hidden="true">
      <polygon points="12,1 22.5,10 18.5,31 5.5,31 1.5,10" style={{ fill: 'var(--logo-accent, var(--saber))' }} />
      <polygon points="12,1 22.5,10 12,12.5 1.5,10" style={{ fill: '#ffffff', opacity: 0.38 }} />
      <polygon points="12,12.5 22.5,10 18.5,31 12,31" style={{ fill: '#000000', opacity: 0.16 }} />
      <polygon points="12,3.5 14.6,10.5 12,28.5 9.4,10.5" style={{ fill: '#ffffff', opacity: 0.55 }} />
      <polygon points="12,1 22.5,10 18.5,31 5.5,31 1.5,10" fill="none" style={{ stroke: 'color-mix(in srgb, var(--logo-accent, var(--saber)) 60%, #000)' }} strokeWidth="1" />
    </svg>
  );
}

// Site colours: a small "Auto" control that explains what the colours mean.
// Auto follows the page; picking a company keeps its colours everywhere.
function ThemeOptions({ onPick }) {
  const { active, pinned, pin } = useTheme();
  const choose = (id) => {
    pin(id);
    onPick?.();
  };
  const row = 'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-2)]';
  return (
    <div role="group" aria-label="Site colors">
      <button type="button" className={row} aria-pressed={!pinned} onClick={() => choose(null)}>
        <span className="grid h-4 w-4 place-items-center rounded-full border border-line-strong" aria-hidden="true">
          <span className="h-2 w-2 rounded-full" style={{ background: THEMES[active].fill || THEMES[active].swatch }} />
        </span>
        <span className="flex-1">
          <span className="font-semibold text-ink">Auto</span>
          <span className="block text-xs text-muted">Follows the page you’re on</span>
        </span>
        {!pinned && <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" />}
      </button>
      <div className="my-1 h-px bg-[var(--border)]" />
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const on = pinned === id;
        return (
          <button key={id} type="button" className={row} aria-pressed={on} onClick={() => choose(id)}>
            <span className="h-4 w-4 flex-none rounded-full" style={{ background: t.fill || t.swatch }} aria-hidden="true" />
            <span className="flex-1 text-ink">{t.company}</span>
            {on && <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function ThemePicker() {
  const { active, pinned } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const t = THEMES[active];
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="theme-panel"
        className="flex h-9 items-center gap-2 rounded-full px-2.5 text-[0.8125rem] text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-ink"
        title="Site colors"
      >
        <span className="h-3 w-3 rounded-full ring-2 ring-[var(--bg)]" style={{ background: t.fill || t.swatch, boxShadow: '0 0 0 3px var(--border)' }} aria-hidden="true" />
        <span>
          <span className="sr-only">Site colors: </span>
          {pinned ? t.label : `Auto · ${t.label}`}
        </span>
      </button>
      {open && (
        <div id="theme-panel" className="card absolute right-0 top-[calc(100%+10px)] z-50 w-[19rem] p-2" style={{ background: 'var(--surface)' }}>
          <p className="px-2.5 pb-2 pt-1.5 text-xs leading-relaxed text-muted">
            Every color scheme comes from a company I’ve worked at. On <span className="font-semibold text-ink">Auto</span>, the site follows the
            page: AWS by default, each company as you scroll Experience, and each project’s own colors on its page.
          </p>
          <ThemeOptions onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { unlock } = useAchievements();
  const { mode, toggleMode } = useTheme();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass = ({ isActive }) =>
    `nav-link relative px-3 py-2 text-[0.9375rem] font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-[3px] after:h-[2px] after:rounded-full after:bg-[var(--accent)] after:transition-transform after:duration-200 after:origin-left ${
      isActive ? 'after:scale-x-100' : 'after:scale-x-0'
    }`;
  const iconBtn = 'btn btn-ghost btn-sm w-9 px-0';

  return (
    <header className="site-nav fixed inset-x-0 top-0 z-40" style={{ height: 'var(--nav-h)' }}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 md:px-14" aria-label="Main">
        <Link to="/" className="group flex items-center gap-3 rounded-lg" aria-label="Tilak Patel, home">
          <Monogram className="h-8 w-6 transition-transform duration-300 group-hover:-rotate-12" />
          <span className="stretch-wide text-[1.05rem] font-bold tracking-tight text-ink">
            Tilak Patel
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/terminal" className={linkClass}>
            <span className="flex items-center gap-1.5">
              <RiTerminalBoxLine className="h-4 w-4" aria-hidden="true" />
              Terminal
            </span>
          </NavLink>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden lg:block">
            <ThemePicker />
          </div>
          <a href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" className={`${iconBtn} hidden md:inline-flex`} aria-label="LinkedIn" title="LinkedIn">
            <RiLinkedinBoxFill className="h-4 w-4" />
          </a>
          <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className={`${iconBtn} hidden md:inline-flex`} aria-label="GitHub" title="GitHub">
            <RiGithubFill className="h-4 w-4" />
          </a>
          <button type="button" className={iconBtn} onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            {mode === 'dark' ? <RiSunLine className="h-4 w-4" /> : <RiMoonClearLine className="h-4 w-4" />}
          </button>
          <a href={profile.resume.href} download={profile.resume.filename} onClick={() => unlock('resume')} className="btn btn-primary btn-sm hidden sm:inline-flex">
            Résumé
          </a>
          <button
            type="button"
            className={`${iconBtn} md:hidden`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <RiCloseLine className="h-5 w-5" /> : <RiMenuLine className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--nav-h))] overflow-y-auto border-b border-line px-5 pb-6 pt-2 md:hidden" style={{ background: 'var(--bg)' }}>
          <ul className="divide-y divide-[var(--border)]">
            {[{ to: '/', label: 'Home' }, ...LINKS, { to: '/terminal', label: 'Terminal' }].map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end className={({ isActive }) => `stretch-semi flex items-center justify-between py-4 text-lg font-semibold ${isActive ? 'text-ink' : 'text-body'}`}>
                  {l.label}
                  <span aria-hidden="true" className="text-accent">
                    →
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <p className="eyebrow">Site colors</p>
            <p className="mt-1 text-xs text-muted">From companies I’ve worked at. Auto follows the page.</p>
            <div className="card mt-3 p-1.5">
              <ThemeOptions onPick={() => setOpen(false)} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={profile.resume.href} download={profile.resume.filename} onClick={() => unlock('resume')} className="btn btn-primary">
              Download résumé
            </a>
            <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-11 px-0" aria-label="GitHub">
              <RiGithubFill className="h-5 w-5" />
            </a>
            <a href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-11 px-0" aria-label="LinkedIn">
              <RiLinkedinBoxFill className="h-5 w-5" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
