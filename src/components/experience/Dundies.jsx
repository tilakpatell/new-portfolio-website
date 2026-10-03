import { RiTrophyLine } from 'react-icons/ri';
import { Reveal, Waypoint } from '../ui';

// The Office's awards night, for real results. Every award is a line from the
// roles above.
const AWARDS = [
  { award: 'The Hours-to-Minutes Award', to: 'Bose', for: 'A three-phase pipeline with 25+ tools that cut firmware debugging from hours to minutes.' },
  { award: 'Most Documents Read by a Pipeline', to: 'SRC', for: 'Knowledge triplets from 500+ radar documents at 90% accuracy, cutting review time by 70%.' },
  { award: 'Lifetime Achievement in Retiring LabVIEW', to: 'Pendar Technologies', for: 'A real-time Qt/PySide6 acquisition app that fully replaced the legacy rig.' },
  { award: 'Most Hours Given Back', to: 'Empowerreg AI', for: 'An AI assistant that saves each regulatory analyst 4+ hours a week.' },
  { award: 'Longest View of the Road', to: 'RTX', for: 'An application-modernization roadmap aimed at 2028.' },
  { award: 'Most Servers Placed (On Paper)', to: 'Amazon Web Services', for: 'Planning tools that model server placement for generative-AI capacity.' },
];

export default function Dundies() {
  return (
    <section className="shell relative z-10 pb-6 pt-20 md:pt-28" aria-labelledby="dundies-title">
      <div className="relative">
        <Waypoint top="0.9rem" />
        <h2 id="dundies-title" className="title">
          The Dundies
        </h2>
        <p className="lead mt-4 max-w-[52ch]">In the spirit of Michael Scott, every role gets an award. The results are real; the trophies are not.</p>
      </div>
      <ol className="dundies mt-10">
        {AWARDS.map((a, i) => (
          <Reveal as="li" key={a.award} delay={(i % 2) * 70} className="dundie">
            <span className="dundie-trophy" aria-hidden="true">
              <RiTrophyLine className="h-5 w-5" />
            </span>
            <div>
              <p className="stretch-semi font-semibold text-ink">{a.award}</p>
              <p className="mt-0.5 text-sm font-medium text-accent">{a.to}</p>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-body">{a.for}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
