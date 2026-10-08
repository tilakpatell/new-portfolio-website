import { useCallback, useMemo } from 'react';
import PageTitle from '../components/PageTitle';
import { RiCloseLine, RiDownloadLine, RiPrinterLine } from 'react-icons/ri';
import ResumeSheet from '../components/ResumeSheet';
import { profile } from '../data/profile';
import { skillCount, skillFromSlug, skillSlug } from '../data/resume';
import { useDocumentTitle } from '../lib/hooks';
import { usePageParams } from '../lib/page';
import Egg from '../components/Egg';
import '../styles/lazy/resume.css';

const VIEWS = [
  { id: 'interactive', label: 'Interactive' },
  { id: 'pdf', label: 'PDF' },
];

// Phones and tablets can't show a PDF inside the page reliably (iOS shows only
// the first page), so they get buttons that open it full screen instead.
const touchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function PdfView() {
  if (touchDevice()) {
    return (
      <div className="resume-pdf grid place-items-center p-8 text-center !h-auto">
        <div>
          <p className="stretch-semi text-lg font-semibold text-ink">The PDF opens best on its own here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a className="btn btn-primary" href={profile.resume.href} target="_blank" rel="noopener noreferrer">
              Open the PDF
            </a>
            <a className="btn btn-ghost" href={profile.resume.href} download={profile.resume.filename}>
              <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Download the PDF
            </a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="resume-pdf">
      <object data={`${profile.resume.href}#view=FitH`} type="application/pdf" aria-label="Résumé, PDF" className="h-full w-full">
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <p className="stretch-semi text-lg font-semibold text-ink">This browser won’t show the PDF here.</p>
            <p className="mt-2 text-body">Download it instead, or use the interactive version.</p>
            <a className="btn btn-primary mt-6" href={profile.resume.href} download={profile.resume.filename}>
              <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Download the PDF
            </a>
          </div>
        </div>
      </object>
    </div>
  );
}

export default function Resume() {
  useDocumentTitle('Résumé');
  const [params, setParams] = usePageParams();
  const view = params.get('view') === 'pdf' ? 'pdf' : 'interactive';
  const active = useMemo(
    () =>
      (params.get('skills') || '')
        .split(',')
        .map(skillFromSlug)
        .filter(Boolean),
    [params],
  );

  const update = useCallback(
    (next) => {
      const p = new URLSearchParams(params);
      Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  const toggle = (skill) => {
    const list = active.includes(skill) ? active.filter((s) => s !== skill) : [...active, skill];
    update({ skills: list.map(skillSlug).join(',') });
  };

  const lines = active.reduce((n, s) => n + skillCount(s), 0);

  return (
    <div className="shell section-last relative z-10 pt-[var(--page-top)]">
      <header className="resume-header flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="eyebrow">Résumé</p>
          {/* its own size: at the shared page size it breaks in two at laptop widths */}
          <PageTitle className="display mt-5 text-[clamp(2.6rem,1.4rem+4.6vw,5rem)]">One page, filterable.</PageTitle>
          <p className="lead mt-5 max-w-[46ch]">Click any skill on the résumé to light up every line that uses it.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="btn btn-primary" href={profile.resume.href} download={profile.resume.filename} data-tour="resume-pdf">
            <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Download the PDF
          </a>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <RiPrinterLine className="h-4 w-4" aria-hidden="true" /> Print
          </button>
          <Egg id="reactor" className="self-center" />
        </div>
      </header>

      <div className="resume-toolbar mt-10">
        <div className="resume-tabs switch" data-size="md" role="tablist" aria-label="Résumé view">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              id={`resume-tab-${v.id}`}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              aria-controls="resume-panel"
              tabIndex={view === v.id ? 0 : -1}
              className="resume-tab"
              onClick={() => update({ view: v.id === 'pdf' ? 'pdf' : null })}
              onKeyDown={(e) => {
                // the arrows (and Home, End) go to the other view, and focus goes with them
                const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: VIEWS.length - 1 }[e.key];
                if (to === undefined) return;
                e.preventDefault();
                const next = VIEWS[(to + VIEWS.length) % VIEWS.length];
                update({ view: next.id === 'pdf' ? 'pdf' : null });
                document.getElementById(`resume-tab-${next.id}`)?.focus();
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === 'interactive' && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-live="polite">
            {active.length === 0 ? (
              <p className="text-sm text-muted">No skill selected. Try Python, React or MCP below.</p>
            ) : (
              <>
                {active.map((s) => (
                  <button key={s} type="button" className="chip chip-accent" onClick={() => toggle(s)} aria-label={`Remove ${s}`}>
                    {s} <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ))}
                <span className="text-sm text-muted">
                  {lines ? `${lines} line${lines === 1 ? '' : 's'} on the page` : 'Listed under skills; no single line names it'}
                </span>
                <button type="button" className="link ml-auto text-sm" onClick={() => update({ skills: null })}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div id="resume-panel" role="tabpanel" aria-labelledby={`resume-tab-${view}`} className="mt-6">
        {view === 'pdf' ? <PdfView /> : <ResumeSheet active={active} onToggle={toggle} />}
      </div>
    </div>
  );
}
