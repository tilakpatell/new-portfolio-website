import { Link } from 'react-router-dom';
import { roles, fmtShortRange } from '../data/roles';
import { THEMES } from '../theme/themes';
import CompanyLogo from './CompanyLogo';

// The horizontal run of the home page's route line: one stop per employer,
// each lighting in its own company colour as the line passes.
export default function CareerStrip() {
  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="stretch-semi text-lg font-semibold text-ink">Where I’ve worked</h2>
        <Link to="/experience" className="link text-sm">
          Full timeline
        </Link>
      </div>

      {/* Desktop: a horizontal rail the route line draws across */}
      <div className="relative mt-8 hidden md:block">
        <span className="waypoint" data-waypoint="" data-node="false" data-trigger="-160" style={{ left: 'calc(var(--route-x) - var(--gutter-l))', top: '7px' }} />
        <ol className="grid grid-cols-6">
          {roles.map((r, i) => (
            <li key={r.id} className="relative pr-4">
              <span className="waypoint" data-waypoint="" data-node-color={THEMES[r.id].fill || THEMES[r.id].swatch} data-trigger={String(-120 + i * 40)} style={{ left: '7px', top: '7px' }} />
              <Link to={`/experience?role=${r.id}`} className="group mt-6 block rounded-lg pt-1">
                <CompanyLogo id={r.id} className="h-12 w-[4.5rem] transition-transform duration-200 group-hover:-translate-y-0.5" />
                <span className="stretch-semi mt-3 block text-lg font-semibold text-ink group-hover:underline group-hover:decoration-[color:var(--accent)] group-hover:underline-offset-4">
                  {r.short}
                </span>
                <span className="mt-1 block text-sm leading-snug text-body">{r.shortTitle}</span>
                <span className="mono mt-1 block text-xs text-muted">{fmtShortRange(r)}</span>
              </Link>
            </li>
          ))}
        </ol>
        <span className="waypoint" data-waypoint="" data-node="false" data-trigger="120" style={{ left: '100%', top: '7px' }} />
      </div>

      {/* Mobile: a compact list; the route line runs down the gutter instead */}
      <ol className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 md:hidden">
        {roles.map((r) => (
          <li key={r.id}>
            <Link to={`/experience?role=${r.id}`} className="flex items-center gap-3">
              <CompanyLogo id={r.id} className="h-10 w-12 flex-none" />
              <span className="min-w-0">
                <span className="stretch-semi block font-semibold text-ink">{r.short}</span>
                <span className="mono block text-xs text-muted">{fmtShortRange(r)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
