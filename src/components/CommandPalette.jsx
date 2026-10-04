import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowRightLine,
  RiBriefcaseLine,
  RiCodeBoxLine,
  RiContrast2Line,
  RiFileCopyLine,
  RiFileTextLine,
  RiGithubFill,
  RiGlobalLine,
  RiLinkedinBoxFill,
  RiMailLine,
  RiMusic2Line,
  RiPaletteLine,
  RiSearchLine,
  RiSparkling2Line,
  RiTerminalBoxLine,
} from 'react-icons/ri';
import { profile } from '../data/profile';
import { projects } from '../data/projects';
import { roles } from '../data/roles';
import { PLACES } from '../data/places';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';
import { useTheme } from '../theme/ThemeProvider';
import { useAchievements } from './Achievements';
import { useFun } from '../fun/FunProvider';
import { BACK, SCRIPTS } from '../fun/scripts';
import { audioContext, setSound, soundOn } from '../lib/audio';
import { local } from '../lib/hooks';

// ⌘K / Ctrl+K: jump anywhere on the site, or run one of its tricks.

function score(item, q) {
  if (!q) return 1;
  const hay = `${item.label} ${item.keywords || ''} ${item.group}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) return 0;
    total += at === 0 ? 3 : item.label.toLowerCase().startsWith(w) ? 2.5 : 1 / (1 + at / 20);
  }
  return total;
}

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { pin, toggleMode, mode } = useTheme();
  const { unlock, notify, unlocked } = useAchievements();
  const fun = useFun();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    input.current?.focus();
    unlock('palette');
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [unlock]);

  const items = useMemo(() => {
    const go = (to) => () => navigate(to);
    const all = [
      { id: 'p-home', group: 'Go to', label: 'Home', keywords: 'about me intro', icon: RiArrowRightLine, run: go('/home') },
      { id: 's-uni', group: 'Actions', label: 'Start the site in the universe', keywords: 'front door start page landing universe', icon: RiGlobalLine, run: () => local.set('tp-start', 'universe') },
      { id: 's-home', group: 'Actions', label: 'Start the site on the home page', keywords: 'front door start page landing home plain', icon: RiArrowRightLine, run: () => local.set('tp-start', 'home') },
      { id: 'w-uni', group: 'Go to', label: 'The universe map', keywords: 'universe map planets worlds fandoms space ship fly x-wing falcon cruiser rick morty', icon: RiGlobalLine, run: go('/universe') },
      { id: 'p-exp', group: 'Go to', label: 'Experience', icon: RiBriefcaseLine, run: go('/experience') },
      { id: 'p-proj', group: 'Go to', label: 'Projects', icon: RiCodeBoxLine, run: go('/projects') },
      { id: 'p-travel', group: 'Go to', label: 'Travel', keywords: 'places globe heritage akshardham', icon: RiGlobalLine, run: go('/travel') },
      { id: 'p-resume', group: 'Go to', label: 'Résumé', keywords: 'resume cv', icon: RiFileTextLine, run: go('/resume') },
      { id: 'p-contact', group: 'Go to', label: 'Contact', icon: RiMailLine, run: go('/contact') },
      { id: 'p-music', group: 'Go to', label: 'Music room', keywords: 'sitar tanpura harmonium tabla raga indian classical', icon: RiMusic2Line, run: go('/music') },
      { id: 'p-term', group: 'Go to', label: 'Imperial terminal', keywords: 'terminal shell command line', icon: RiTerminalBoxLine, run: go('/terminal') },
      ...projects.map((p) => ({ id: `pr-${p.id}`, group: 'Projects', label: p.title, hint: p.kind, keywords: p.stack.join(' '), icon: RiCodeBoxLine, run: go(`/projects/${p.id}`) })),
      ...roles.map((r) => ({ id: `ro-${r.id}`, group: 'Experience', label: r.company, hint: r.shortTitle, keywords: `${r.short} ${r.title} ${r.stack.join(' ')}`, icon: RiBriefcaseLine, run: go(`/experience/${r.id}`) })),
      ...PLACES.map((p) => ({ id: `pl-${p.id}`, group: 'Places', label: p.name, hint: p.photo, keywords: `travel ${p.region}`, icon: RiGlobalLine, run: go(`/travel?place=${p.id}`) })),
      {
        id: 'a-copy',
        group: 'Actions',
        label: 'Copy email address',
        hint: profile.email,
        icon: RiFileCopyLine,
        run: async () => {
          try {
            await navigator.clipboard.writeText(profile.email);
            notify('Copied', profile.email);
          } catch {
            window.location.href = `mailto:${profile.email}`;
          }
        },
      },
      { id: 'a-pdf', group: 'Actions', label: 'Download résumé (PDF)', keywords: 'resume cv pdf', icon: RiFileTextLine, run: () => Object.assign(document.createElement('a'), { href: profile.resume.href, download: profile.resume.filename }).click() },
      { id: 'a-mode', group: 'Actions', label: mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', keywords: 'theme dark light mode', icon: RiContrast2Line, run: toggleMode },
      { id: 'e-script', group: 'Easter eggs', label: fun.script ? `${BACK} (turn off ${SCRIPTS[fun.script].name})` : `Read the site in ${fun.scriptName}`, keep: Boolean(fun.script), keywords: 'language english back off aurebesh star wars cybertronian transformers runes tolkien dwarf font', icon: RiSparkling2Line, run: fun.toggleScript },
      { id: 'e-name', group: 'Easter eggs', label: 'Say my name', keywords: 'breaking bad heisenberg walter white', icon: RiSparkling2Line, run: fun.sayMyName },
      { id: 'e-snap', group: 'Easter eggs', label: 'Snap', keywords: 'marvel thanos infinity gauntlet', icon: RiSparkling2Line, run: fun.snap },
      { id: 'e-twss', group: 'Easter eggs', label: 'That’s what she said', keywords: 'the office michael scott dundie', icon: RiSparkling2Line, run: fun.twss },
      { id: 'e-parkour', group: 'Easter eggs', label: 'Parkour', keywords: 'the office andy dwight', icon: RiSparkling2Line, run: fun.parkour },
      { id: 'e-ds', group: 'Easter eggs', label: 'That’s no moon', keywords: 'death star star wars trench run superlaser', icon: RiSparkling2Line, run: go('/deathstar') },
      { id: 'w-me', group: 'Easter eggs', label: 'Middle-earth: Moria to Mordor', keywords: 'lord of the rings lotr tolkien moria doors of durin gandalf balrog one ring frodo sam mordor eye sauron map world', icon: RiSparkling2Line, run: go('/middle-earth') },
      { id: 'w-cb', group: 'Easter eggs', label: 'The Caribbean: Dead man’s tide', keywords: 'pirates of the caribbean pirate ship black pearl jack sparrow kraken davy jones tortuga navy cannon broadside treasure compass sea sail game world', icon: RiSparkling2Line, run: go('/caribbean') },
      { id: 'w-av', group: 'Easter eggs', label: 'Avengers HQ', keywords: 'marvel avengers compound tower iron man stark arc reactor thor mjolnir captain america shield hawkeye black widow hulk banner tesseract thanos infinity gauntlet snap world', icon: RiSparkling2Line, run: go('/avengers') },
      { id: 'w-sc', group: 'Easter eggs', label: 'Scranton: Dunder Mifflin', keywords: 'the office dunder mifflin michael jim pam dwight kevin floor plan paper airplane dundies world', icon: RiSparkling2Line, run: go('/scranton') },
      { id: 'w-cy', group: 'Easter eggs', label: 'Cybertron', keywords: 'transformers prime optimus megatron autobots decepticons bumblebee arcee ratchet ground bridge iacon relics cybertronian world', icon: RiSparkling2Line, run: go('/cybertron') },
      { id: 'w-abq', group: 'Easter eggs', label: 'Albuquerque: Breaking Bad', keywords: 'breaking bad walter white heisenberg jesse pinkman gus fring los pollos hermanos saul goodman mike lalo hector superlab world', icon: RiSparkling2Line, run: go('/albuquerque') },
      { id: 'w-rm', group: 'Easter eggs', label: 'Dimension C-137: Rick and Morty', keywords: 'rick and morty sanchez smith summer beth jerry portal gun portal panic pickle rick meeseeks interdimensional cable plumbus cromulon snowball evil morty citadel gazorpazorp cronenberg world', icon: RiSparkling2Line, run: go('/c-137') },
      { id: 'e-jump', group: 'Easter eggs', label: 'Jump to lightspeed', keywords: 'hyperspace star wars falcon', icon: RiSparkling2Line, run: () => window.dispatchEvent(new Event('tp:hyperspace')) },
      { id: 'e-rollout', group: 'Easter eggs', label: 'Autobots, roll out', keywords: 'transformers optimus prime megatron bumblebee', icon: RiSparkling2Line, run: () => fun.rollOut('optimus') },
      { id: 'e-schwifty', group: 'Easter eggs', label: 'Get schwifty', keywords: 'rick and morty wubba lubba dub dub wubbalubbadubdub portal green', icon: RiSparkling2Line, run: () => fun.getSchwifty('portal') },
      { id: 'e-savvy', group: 'Easter eggs', label: 'Savvy? Hoist the colours', keywords: 'pirates of the caribbean jack sparrow black pearl flying dutchman davy jones tortuga pirate theme', icon: RiSparkling2Line, run: () => fun.savvy('pearl') },
      { id: 'a-sound', group: 'Actions', label: soundOn() ? 'Turn sound off' : 'Turn sound on', keywords: 'mute audio volume', icon: RiContrast2Line, run: () => setSound(!soundOn()) },
      { id: 't-auto', group: 'Themes', label: 'Auto colors', hint: 'Follow the page', keywords: 'theme colors', icon: RiPaletteLine, run: () => pin(null) },
      ...THEME_ORDER.map((id) => ({ id: `t-${id}`, group: 'Themes', label: `${THEMES[id].company} colors`, keywords: 'theme', icon: RiPaletteLine, run: () => pin(id) })),
      ...FAN_THEMES.filter((f) => unlocked.includes(f.achievement)).map((f) => ({ id: `t-${f.id}`, group: 'Themes', label: `${THEMES[f.id].company} colors`, hint: 'Unlocked', keywords: 'theme fan', icon: RiPaletteLine, run: () => pin(f.id) })),
      { id: 'l-gh', group: 'Links', label: 'GitHub', hint: `github.com/${profile.github.handle}`, icon: RiGithubFill, run: () => window.open(profile.github.url, '_blank', 'noopener') },
      { id: 'l-li', group: 'Links', label: 'LinkedIn', hint: `in/${profile.linkedin.handle}`, icon: RiLinkedinBoxFill, run: () => window.open(profile.linkedin.url, '_blank', 'noopener') },
      { id: 'l-mail', group: 'Links', label: 'Email', hint: profile.email, icon: RiMailLine, run: () => (window.location.href = `mailto:${profile.email}`) },
    ];
    return all;
  }, [fun, mode, navigate, notify, pin, toggleMode, unlocked]);

  const shown = useMemo(() => {
    const scored = items.map((it, i) => [score(it, q), i, it]).filter(([s]) => s > 0);
    if (q) scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return scored.map(([, , it]) => it).slice(0, q ? 40 : 60);
  }, [items, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item) => {
    if (!item) return;
    audioContext(); // inside the key press or click, so sounds may play
    onClose();
    // Let the dialog close (and focus return) before navigating or snapping.
    requestAnimationFrame(() => item.run());
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // focus stays in the palette
    }
  };

  let lastGroup = null;
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette card" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <RiSearchLine className="h-5 w-5 flex-none text-muted" aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, projects, places, or try “snap”"
            className="palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={shown[active] ? `pal-${shown[active].id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>
        <ul ref={list} id="palette-list" role="listbox" aria-label="Results" className="palette-list">
          {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nothing matches “{q}”. Try a page, a project or a country.</li>}
          {shown.map((it, i) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <li key={it.id} role="presentation">
                {header && <p className="palette-group">{it.group}</p>}
                <div
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className="palette-item"
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(it)}
                >
                  <Icon className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
                  <span className={`min-w-0 flex-1 truncate text-ink${it.keep ? ' ab-keep' : ''}`}>{it.label}</span>
                  {it.hint && <span className="hidden truncate text-xs text-muted sm:block">{it.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="palette-foot">
          <span>
            <kbd className="palette-kbd">↑</kbd> <kbd className="palette-kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="palette-kbd">↵</kbd> to open
          </span>
          <span className="ml-auto hidden sm:inline">Type a word anywhere on the site, too.</span>
        </p>
      </div>
    </div>
  );
}
