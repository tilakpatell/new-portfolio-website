import { Suspense, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiExternalLinkLine, RiLockLine, RiTrophyLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import ErrorBoundary from '../components/ErrorBoundary';
import { Chips, Reveal, Waypoint } from '../components/ui';
import { projects, projectById } from '../data/projects';
import { PROJECT_STAGES } from '../stages';
import { ClaudeSpark } from '../stages/ClaudeStage';
import { useDocumentTitle } from '../lib/hooks';
import NotFound from './NotFound';

function StageFallback() {
  return <div className="card grid min-h-[320px] place-items-center text-sm text-muted">Loading demo…</div>;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const project = projectById(id);
  useDocumentTitle(project?.title ?? 'Not found');
  const page = useRef(null);
  if (!project) return <NotFound />;

  const stages = PROJECT_STAGES[project.id] || [];
  const i = projects.indexOf(project);
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const withClaude = project.id === 'swaminarayan-translator';

  return (
    <div ref={page} className="relative" key={project.id}>
      <RouteLine containerRef={page} />
      <header className="shell relative z-10 pt-[calc(var(--nav-h)+28px)] md:pt-[calc(var(--nav-h)+48px)]">
        <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" /> All projects
        </Link>
        <div className="relative mt-8">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">
            {project.kind}
            {project.status ? ` · ${project.status}` : ''}
          </p>
          <h1 className="display mt-4 text-[clamp(2.4rem,1.4rem+4.4vw,4.8rem)]">{project.title}</h1>
          {project.subtitle && <p className="stretch-semi mt-4 text-lg text-body">{project.subtitle}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {withClaude && (
              <span className="chip !py-1 text-ink">
                <ClaudeSpark spinning className="h-4 w-4" /> Built with Claude
              </span>
            )}
            {project.award && (
              <span className="chip text-accent">
                <RiTrophyLine className="h-4 w-4" aria-hidden="true" /> {project.award}
              </span>
            )}
            {project.links.length === 0 && (
              <span className="chip">
                <RiLockLine className="h-3.5 w-3.5" aria-hidden="true" /> Private repository
              </span>
            )}
          </div>
        </div>
      </header>

      {stages.map((s, k) => (
        <section key={s.key} className={`shell relative z-10 ${k === 0 ? 'mt-10 md:mt-12' : 'mt-14 md:mt-20'}`} aria-labelledby={`stage-${s.key}`}>
          <div className="relative mb-5 max-w-2xl">
            {k > 0 && <Waypoint top="0.45rem" />}
            <h2 id={`stage-${s.key}`} className="stretch-semi text-xl font-semibold text-ink">
              {s.title}
            </h2>
            <p className="mt-1 text-body">{s.caption}</p>
          </div>
          <ErrorBoundary fallback={null}>
            <Suspense fallback={<StageFallback />}>
              <s.C />
            </Suspense>
          </ErrorBoundary>
        </section>
      ))}

      <section className="shell relative z-10 py-16 md:py-20" aria-labelledby="about-title">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.45rem" />
                        <h2 id="about-title" className="sr-only">
              About {project.title}
            </h2>
            <p className="lead !text-[clamp(1.1rem,1rem+0.5vw,1.35rem)] text-ink">{project.summary}</p>
            {project.bullets && (
              <ul className="mt-7 grid gap-4">
                {project.bullets.map((b, n) => (
                  <Reveal as="li" key={n} delay={n * 50} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed text-body">
                    <span className="mt-[0.7em] h-[2px] w-3 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
                    <span>{b}</span>
                  </Reveal>
                ))}
              </ul>
            )}
          </div>
          <aside className="card self-start p-6">
            <p className="label">Stack</p>
            <Chips items={project.stack} className="mt-3" />
            {project.credits && (
              <>
                <div className="divider my-6" />
                <p className="label">Credits</p>
                <dl className="mt-3 grid gap-2 text-sm">
                  {project.credits.map((c) => (
                    <div key={c.role} className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">{c.role}</dt>
                      <dd className="flex flex-wrap gap-x-2">
                        {c.people.map((p) => (
                          <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="link font-medium">
                            {p.name}
                          </a>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            {project.links.length > 0 && (
              <>
                <div className="divider my-6" />
                <p className="label">Links</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {project.links.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      {l.label} <RiExternalLinkLine className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      <nav className="shell relative z-10 pb-24" aria-label="More projects">
        <div className="relative grid gap-4 sm:grid-cols-2">
          <Waypoint top="2rem" />
          <Link to={`/projects/${prev.id}`} className="card card-lift p-5">
            <span className="label inline-flex items-center gap-2">
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" /> Previous
            </span>
            <span className="stretch-semi mt-2 block text-lg font-semibold text-ink">{prev.title}</span>
          </Link>
          <Link to={`/projects/${next.id}`} className="card card-lift p-5 sm:flex sm:flex-col sm:items-end sm:text-right">
            <span className="label inline-flex items-center gap-2">
              Next <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="stretch-semi mt-2 block text-lg font-semibold text-ink">{next.title}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
