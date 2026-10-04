import { Link } from 'react-router-dom';
import { roles, roleLink } from '../data/roles';
import { education } from '../data/profile';
import { THEMES } from '../theme/themes';
import CompanyLogo from './CompanyLogo';

// The horizontal run of the home page's route line: one stop per employer,
// each lighting in its own company colour as the line passes, then the
// university all of it happened alongside. Logo and role only, centred.
const SCHOOL = { id: 'northeastern', short: 'Northeastern', shortTitle: education.degree, to: '/resume', color: '#C8102E' };

export default function CareerStrip() {
  const stops = [
    ...roles.map((r) => ({ id: r.id, short: r.short, shortTitle: r.shortTitle, to: roleLink(r.id), color: THEMES[r.id].fill || THEMES[r.id].swatch })),
    SCHOOL,
  ];
  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="stretch-semi text-lg font-semibold text-ink">Where I’ve worked</h2>
        <Link to="/experience" className="link text-sm">
          Full timeline
        </Link>
      </div>

      {/* Laptops and up: a horizontal rail the route line draws across */}
      <div className="relative mt-8 hidden lg:block">
        <span className="waypoint" data-waypoint="" data-node="false" data-trigger="-160" style={{ left: 'calc(var(--route-x) - var(--gutter-l))', top: '7px' }} />
        <ol className="grid" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}>
          {stops.map((r, i) => (
            <li key={r.id} className="relative px-2 text-center">
              <span className="waypoint" data-waypoint="" data-node-color={r.color} data-trigger={String(-120 + i * 40)} style={{ left: '50%', top: '7px' }} />
              <Link to={r.to} className="group mt-6 flex flex-col items-center rounded-lg pt-1">
                <CompanyLogo id={r.id} className="h-11 w-16 transition-transform duration-200 group-hover:-translate-y-0.5 xl:h-12 xl:w-[4.5rem]" />
                <span className="stretch-semi mt-3 block text-base font-semibold text-ink group-hover:underline group-hover:decoration-[color:var(--accent)] group-hover:underline-offset-4 xl:text-lg">
                  {r.short}
                </span>
                <span className="mt-1 block text-sm leading-snug text-body">{r.shortTitle}</span>
              </Link>
            </li>
          ))}
        </ol>
        {/* the line turns down in the gutter, clear of the last name */}
        <span className="waypoint" data-waypoint="" data-node="false" data-trigger="120" style={{ left: 'calc(100% + 28px)', top: '7px' }} />
      </div>

      {/* Phones and tablets: a compact list; the route line runs down the gutter instead */}
      <ol className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 lg:hidden">
        {stops.map((r) => (
          <li key={r.id}>
            <Link to={r.to} className="flex items-center gap-3">
              <CompanyLogo id={r.id} className="h-10 w-12 flex-none" />
              <span className="min-w-0">
                <span className="stretch-semi block font-semibold text-ink">{r.short}</span>
                <span className="block text-xs leading-snug text-muted">{r.shortTitle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
