import Photo from '../Photo';
import { Reveal, Waypoint } from '../ui';

// Indian architecture: two Akshardhams side by side, then four carved details,
// over a faint jali (stone lattice) pattern.
const WIDE = [
  { id: 'h-robbinsville', caption: 'Akshardham at sunset, Robbinsville, New Jersey' },
  { id: 'h-delhi', caption: 'Akshardham in the evening, New Delhi' },
];
const DETAILS = [
  { id: 'h-colonnade', caption: 'The parikrama colonnade, Robbinsville' },
  { id: 'h-pillars', caption: 'Carved sandstone pillars, New Delhi' },
  { id: 'h-ceiling', caption: 'A marble ceiling dome, Robbinsville' },
  { id: 'h-neasden', caption: 'Carved wood at Neasden Temple, London' },
];

export default function Heritage() {
  return (
    <section data-theme-section="travel" className="heritage relative z-10 py-16 md:py-28" aria-labelledby="heritage-title">
      <div className="jali" aria-hidden="true">
        <div className="jali-pattern" />
      </div>
      <div className="shell relative">
        <Waypoint top="0.9rem" />
        <h2 id="heritage-title" className="title">
          Heritage
        </h2>
        <p className="lead mt-4 max-w-[54ch]">
          Indian architecture is my heritage: hand-carved stone and marble, and mandirs like Akshardham in New Delhi and in Robbinsville, New Jersey.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
          {WIDE.map((p, i) => (
            <Reveal as="figure" key={p.id} delay={i * 80} className="m-0">
              <div className="heritage-photo aspect-[16/10]">
                <Photo id={p.id} sizes="(min-width: 768px) 50vw, 100vw" className="h-full w-full object-cover" />
              </div>
              <figcaption className="mt-2.5 text-sm text-muted">{p.caption}</figcaption>
            </Reveal>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:mt-5 md:grid-cols-4 md:gap-5">
          {DETAILS.map((p, i) => (
            <Reveal as="figure" key={p.id} delay={i * 60} className="m-0">
              <div className="heritage-photo aspect-[4/5]">
                <Photo id={p.id} sizes="(min-width: 768px) 25vw, 50vw" className="h-full w-full object-cover" />
              </div>
              <figcaption className="mt-2.5 text-sm text-muted">{p.caption}</figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
