import { Link } from 'react-router-dom';
import { RiArrowRightUpLine } from 'react-icons/ri';
import ProjectThumb from './ProjectThumb';
import { ROUTE_THEMES, THEMES } from '../theme/themes';

export default function ProjectCard({ project, compact = false }) {
  const theme = THEMES[ROUTE_THEMES[`/projects/${project.id}`]];
  return (
    <Link to={`/projects/${project.id}`} className="card group flex h-full flex-col overflow-hidden p-4 sm:p-5">
      <ProjectThumb stage={project.stage} className={compact ? 'aspect-[16/9]' : 'aspect-[16/10]'} />
      <div className="mt-5 flex items-center gap-2">
        {theme && <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: theme.swatch }} title={`Opens in ${theme.label} colors`} aria-hidden="true" />}
        <span className="eyebrow">{project.kind}</span>
        {project.award && <span className="chip !min-h-0 !py-0.5 text-accent">{project.award}</span>}
        {project.status && <span className="chip !min-h-0 !py-0.5">{project.status}</span>}
      </div>
      <h3 className="stretch-semi mt-2 flex items-start justify-between gap-3 text-xl font-semibold text-ink">
        {project.title}
        <RiArrowRightUpLine className="mt-1 h-5 w-5 flex-none text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" aria-hidden="true" />
      </h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">{project.summary}</p>
      {project.credits?.[0]?.role === 'Built with' && project.credits[0].people[0].name !== 'Claude' && (
        <p className="mt-3 text-sm text-muted">with {project.credits[0].people.map((p) => p.name).join(', ')}</p>
      )}
      <p className="mono mt-auto pt-5 text-xs text-muted">{project.stack.join(' · ')}</p>
    </Link>
  );
}
