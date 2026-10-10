import { Link } from 'react-router-dom';
import { RiArrowRightUpLine } from 'react-icons/ri';
import ProjectThumb from './ProjectThumb';

// `large` is the tall bento tile, `horizontal` puts the thumbnail beside the text.
export default function ProjectCard({ project, compact = false, large = false, horizontal = false, thumb }) {
  const partner = project.credits?.[0]?.role === 'Built with' && project.credits[0].people[0].name !== 'Claude' ? project.credits[0].people : null;
  const thumbClass = thumb ?? (large ? 'aspect-[16/10] md:aspect-auto md:min-h-[300px] md:flex-1' : horizontal ? 'aspect-[16/10] sm:aspect-auto sm:h-full' : compact ? 'aspect-[16/9]' : 'aspect-[16/10]');
  return (
    <Link
      to={`/projects/${project.id}`}
      className={`card card-lift group h-full overflow-hidden p-4 sm:p-5 ${horizontal ? 'grid gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]' : 'flex flex-col'} ${large ? 'sm:p-6' : ''}`}
    >
      <ProjectThumb stage={project.stage} className={thumbClass} />
      <div className={`flex flex-col ${horizontal ? '' : 'mt-5'} ${large ? 'md:flex-none' : 'flex-1'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">{project.kind}</span>
          {project.award && <span className="chip chip-accent chip-sm">{project.award}</span>}
        </div>
        <h3 className={`stretch-semi mt-2 flex items-start justify-between gap-3 font-semibold text-ink ${large ? 'text-[clamp(1.6rem,1.2rem+1.2vw,2.2rem)] leading-tight' : 'text-xl'}`}>
          {project.title}
          <RiArrowRightUpLine className="mt-1 h-5 w-5 flex-none text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]" aria-hidden="true" />
        </h3>
        <p className={`mt-2 leading-relaxed text-body ${large ? 'max-w-[52ch] text-[1.05rem]' : 'text-[0.95rem]'}`}>{project.summary}</p>
        {partner && <p className="mt-3 text-sm text-muted">with {partner.map((p) => p.name).join(', ')}</p>}
        <p className="mono mt-auto pt-5 text-xs text-muted">{project.stack.slice(0, 5).join(', ')}</p>
      </div>
    </Link>
  );
}
