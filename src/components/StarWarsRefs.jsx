/**
 * Star Wars show references — quotes, faction symbols, badges
 *
 * Show → Section mapping:
 *   Hero            → The Mandalorian   "This Is the Way."
 *   About           → Empire Strikes    "Do or do not."
 *   TechStack       → Andor             "The stronger the light…"
 *   Experience      → Clone Wars        show badges per card
 *   Projects        → Rogue One         "Rebellions are built on hope."
 *   Contact         → Empire Strikes    "Laugh it up, fuzzball!"
 */

// ─── SVG Faction Symbols ──────────────────────────────────────────────────────

/** Rebel Alliance Starbird */
export const RebelStarbird = ({ className = '' }) => (
  <svg viewBox="0 0 120 105" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* left wing */}
    <path d="M60 8 L68 34 L100 20 L78 44 L60 38 Z" />
    {/* right wing */}
    <path d="M60 8 L52 34 L20 20 L42 44 L60 38 Z" />
    {/* body + tail */}
    <path d="M42 44 L38 72 L50 60 L60 74 L70 60 L82 72 L78 44 Z" />
    {/* head */}
    <ellipse cx="60" cy="30" rx="9" ry="7" />
  </svg>
);

/** Galactic Empire Cog (12-spoke radial) */
export const ImperialCog = ({ className = '' }) => {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    return (
      <line
        key={i}
        x1={50 + 22 * cos} y1={50 + 22 * sin}
        x2={50 + 43 * cos} y2={50 + 43 * sin}
        stroke="currentColor" strokeWidth="4" strokeLinecap="round"
      />
    );
  });
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
      {spokes}
    </svg>
  );
};

/** Mandalorian mythosaur skull (stylised helmet / T-visor) */
export const MandalorianHelmet = ({ className = '' }) => (
  <svg viewBox="0 0 80 90" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* dome */}
    <path d="M40 4 C18 4 8 22 8 40 L8 52 L72 52 L72 40 C72 22 62 4 40 4 Z" />
    {/* cheeks */}
    <path d="M8 52 L4 72 L20 68 L24 78 L40 82 L56 78 L60 68 L76 72 L72 52 Z" />
    {/* T-visor (cut out in black) */}
    <rect x="16" y="35" width="48" height="14" rx="3" fill="black" />
    <rect x="34" y="22" width="12" height="16" rx="2" fill="black" />
  </svg>
);

/** Jedi Order (winged emblem) */
export const JediOrder = ({ className = '' }) => (
  <svg viewBox="0 0 100 110" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* blade */}
    <rect x="47" y="8" width="6" height="60" rx="3" />
    {/* guard */}
    <ellipse cx="50" cy="68" rx="16" ry="4" />
    {/* hilt */}
    <rect x="44" y="70" width="12" height="22" rx="3" />
    {/* wings */}
    <path d="M34 52 C18 44 6 52 2 62 C14 58 28 56 34 62 Z" />
    <path d="M66 52 C82 44 94 52 98 62 C86 58 72 56 66 62 Z" />
  </svg>
);

/** Ahsoka Tano montrals (simplified silhouette) */
export const AhsokaMontrals = ({ className = '' }) => (
  <svg viewBox="0 0 100 120" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* head */}
    <ellipse cx="50" cy="70" rx="22" ry="26" />
    {/* left montral */}
    <path d="M30 56 C22 40 18 16 26 4 C30 18 32 38 36 52 Z" />
    {/* right montral */}
    <path d="M70 56 C78 40 82 16 74 4 C70 18 68 38 64 52 Z" />
    {/* lekku hint */}
    <path d="M34 88 C28 96 24 108 30 118 C34 108 38 96 40 88 Z" />
    <path d="M66 88 C72 96 76 108 70 118 C66 108 62 96 60 88 Z" />
  </svg>
);

// ─── Show Theme Config ────────────────────────────────────────────────────────
// All themes are monochrome — stormtrooper B&W aesthetic.
// Varying opacities provide subtle differentiation without color.

const MONO_THEME = {
  colorClass: 'text-white/48',
  borderClass: 'border-white/14',
  bgClass: 'bg-white/[0.04]',
  color: 'rgba(255,255,255,0.48)',
};

export const SHOW_THEMES = {
  mandalorian: { ...MONO_THEME, label: 'THE MANDALORIAN' },
  andor:       { ...MONO_THEME, label: 'ANDOR' },
  clonewars:   { ...MONO_THEME, label: 'THE CLONE WARS' },
  rogueone:    { ...MONO_THEME, label: 'ROGUE ONE' },
  rebels:      { ...MONO_THEME, label: 'STAR WARS REBELS' },
  obiwan:      { ...MONO_THEME, label: 'OBI-WAN KENOBI' },
  bobafett:    { ...MONO_THEME, label: 'BOOK OF BOBA FETT' },
  empire:      { ...MONO_THEME, label: 'THE EMPIRE STRIKES BACK' },
};

// ─── ShowBadge ────────────────────────────────────────────────────────────────

/**
 * Compact badge labelling which show a card/section references.
 * usage: <ShowBadge show="mandalorian" episode="Chapter I" />
 */
export const ShowBadge = ({ show, episode }) => {
  const theme = SHOW_THEMES[show] ?? SHOW_THEMES.mandalorian;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5
                  border ${theme.borderClass} ${theme.bgClass} ${theme.colorClass}
                  font-mono text-[0.58rem] tracking-[0.14em] uppercase`}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-80 flex-shrink-0" />
      {theme.label}
      {episode && <span className="opacity-55 font-light">· {episode}</span>}
    </span>
  );
};

// ─── ShowQuote ────────────────────────────────────────────────────────────────

/**
 * Stylised quote block with left accent bar, quote text, and attribution.
 * usage: <ShowQuote show="andor" quote="…" character="Luthen Rael" />
 */
export const ShowQuote = ({ show, quote, character, align = 'left' }) => {
  const theme = SHOW_THEMES[show] ?? SHOW_THEMES.mandalorian;
  const isRight = align === 'right';
  return (
    <div className={`relative pl-4 ${isRight ? 'text-right pr-4 pl-0' : ''}`}>
      {/* accent bar */}
      <div
        className={`absolute top-0 ${isRight ? 'right-0' : 'left-0'} w-[2px] h-full rounded-full`}
        style={{
          background: `linear-gradient(to bottom, transparent, ${theme.color}66, transparent)`,
        }}
      />
      <p className="text-sm italic text-white/45 leading-relaxed mb-2 font-light">
        "{quote}"
      </p>
      <div className={`flex items-center gap-2 flex-wrap ${isRight ? 'justify-end' : ''}`}>
        <span className="text-xs text-white/32 not-italic">— {character}</span>
        <span
          className={`font-mono text-[0.58rem] tracking-[0.12em] uppercase`}
          style={{ color: theme.color + '99' }}
        >
          {theme.label}
        </span>
      </div>
    </div>
  );
};

// ─── Section Epigraph (larger, prominent quote used at top of pages) ──────────

export const SectionEpigraph = ({ show, quote, character }) => {
  const theme = SHOW_THEMES[show] ?? SHOW_THEMES.mandalorian;
  return (
    <div className="relative py-4 px-6 bg-white/[0.02] border border-white/[0.06]">
      {/* top shimmer line */}
      <div
        className="absolute top-0 left-8 right-8 h-[1px] rounded-full"
        style={{
          background: `linear-gradient(to right, transparent, ${theme.color}55, transparent)`,
        }}
      />
      <p
        className="text-base sm:text-lg italic font-light leading-relaxed mb-3"
        style={{ color: 'rgba(255,255,255,0.48)' }}
      >
        "{quote}"
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-white/30">— {character}</span>
        <ShowBadge show={show} />
      </div>
    </div>
  );
};
