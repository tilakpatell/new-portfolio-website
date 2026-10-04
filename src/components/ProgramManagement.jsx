import { Chips, Reveal, SectionHeading } from './ui';
import { programSteps, programToolkit } from '../data/program';
import { roles } from '../data/roles';

const short = (id) => roles.find((r) => r.id === id)?.short ?? id;

// The program-management side: how a program goes, step by step, with the
// role each step came from, then the toolkit.
export default function ProgramManagement() {
  return (
    <section data-theme-section="aws" className="shell relative z-10 py-14 md:py-20" aria-labelledby="pm-title">
      <SectionHeading eyebrow="Program management" title="Programs, and the software that runs them." id="pm-title">
        At AWS and RTX the job is the program: roadmaps, stakeholders, capacity and migrations. Everywhere else I built the software. Each step below is something I’ve done, and where.
      </SectionHeading>
      <ol className="pm-loop mt-10">
        {programSteps.map((s, i) => (
          <Reveal as="li" key={s.id} delay={i * 70} className="pm-step">
            <span className="pm-node" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="pm-label">{s.step}</p>
            <h3 className="stretch-semi mt-2 text-lg font-semibold leading-snug text-ink">{s.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-body">{s.body}</p>
            <p className="mono mt-4 text-xs text-muted">{s.where.map(short).join(' · ')}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-12">
        <p className="label">Program toolkit</p>
        <Chips items={programToolkit} className="mt-3" />
      </Reveal>
    </section>
  );
}
