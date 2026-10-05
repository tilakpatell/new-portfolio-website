import { useState, memo } from 'react';
import { RiZoomInLine } from 'react-icons/ri';
import Photo from '../Photo';
import Lightbox from '../Lightbox';
import { Reveal, Waypoint } from '../ui';
import AkshardhamDay, { DAY } from './AkshardhamDay';
import '../../styles/lazy/travel.css';

// Indian architecture: a day at the two Akshardhams in photographs, their
// facts from the official sites, then the carving up close, over a faint jali
// (stone lattice). Any photo opens larger.

const DELHI_FACTS = [
  { value: '234', label: 'carved pillars' },
  { value: '9', label: 'domes' },
  { value: '20,000', label: 'statues' },
];

const DETAILS = [
  { id: 'h-colonnade', title: 'Parikrama', caption: 'The colonnade that circles the mandir, Robbinsville' },
  { id: 'h-pithika', title: 'Carved relief', caption: 'Stories told in stone at the base, New Delhi' },
  { id: 'h-ceiling', title: 'Mandapam dome', caption: 'A marble ceiling, carved ring inside ring, Robbinsville' },
  { id: 'h-elephants', title: 'Gajendra Peeth', caption: 'The plinth of carved elephants, Robbinsville' },
];

const ALL = [...DAY.map((d) => ({ id: d.id, title: `${d.time}, ${d.place}`, caption: d.text })), ...DETAILS];

// The lattice, drawn once as an SVG pattern in the theme's color. (It used to
// be a CSS mask over the whole section, which phones redrew as you scrolled.)
function Jali() {
  return (
    <div className="jali" aria-hidden="true">
      <svg className="jali-pattern" width="100%" height="100%">
        <defs>
          <pattern id="jali-tile" width="64" height="64" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M32 4 60 32 32 60 4 32Z" />
              <path d="M32 16 48 32 32 48 16 32Z" />
              <circle cx="32" cy="32" r="6" />
              <path d="M32 0v4M32 60v4M0 32h4M60 32h4" />
              <circle cx="0" cy="0" r="10" />
              <circle cx="64" cy="0" r="10" />
              <circle cx="0" cy="64" r="10" />
              <circle cx="64" cy="64" r="10" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#jali-tile)" />
      </svg>
      <div className="jali-fade jali-fade-top" />
      <div className="jali-fade jali-fade-bottom" />
    </div>
  );
}

function Zoomable({ index, onOpen, className = '', children }) {
  return (
    <button type="button" className={`heritage-zoom ${className}`} onClick={() => onOpen(index)} aria-label={`Open larger: ${ALL[index].title}, ${ALL[index].caption}`}>
      {children}
      <span className="heritage-zoom-icon" aria-hidden="true">
        <RiZoomInLine className="h-4 w-4" />
      </span>
    </button>
  );
}

export default memo(function Heritage() {
  const [open, setOpen] = useState(-1);
  return (
    <section id="heritage" data-theme-section="travel" className="heritage relative z-10 scroll-mt-20 py-16 md:py-28" aria-labelledby="heritage-title">
      <Jali />
      <div className="shell relative">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="heritage-title" className="title">
            Heritage
          </h2>
          <p className="lead mt-4 max-w-[56ch]">
            Indian architecture is my heritage: mandirs carved by hand from stone, in a tradition centuries old. These are the two Akshardhams.
          </p>
        </div>

        <Reveal className="mt-10">
          <AkshardhamDay onOpen={(id) => setOpen(ALL.findIndex((a) => a.id === id))} />
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8">
          <Reveal className="temple">
            <p className="label">New Delhi</p>
            <h3 className="stretch-semi mt-1 text-2xl font-semibold text-ink">Swaminarayan Akshardham</h3>
            <p className="mt-2 leading-relaxed text-body">
              Opened on 6 November 2005. Carved sandstone and marble, 141 feet tall, built without any steel by more than 8,000 volunteers.
            </p>
            <dl className="temple-stats">
              {DELHI_FACTS.map((f) => (
                <div key={f.label}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="m-0">
                    <span className="stretch-semi block text-3xl font-semibold text-ink">{f.value}</span>
                    <span className="text-sm text-muted">{f.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal className="temple" delay={80}>
            <p className="label">Robbinsville, New Jersey</p>
            <h3 className="stretch-semi mt-1 text-2xl font-semibold text-ink">BAPS Swaminarayan Akshardham</h3>
            <p className="mt-2 leading-relaxed text-body">
              Opened in October 2023. Stone carved by hand in India, then assembled in New Jersey with the help of thousands of volunteers.
            </p>
          </Reveal>
        </div>

        <h3 className="stretch-semi mt-16 text-xl font-semibold text-ink md:mt-20">Up close</h3>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {DETAILS.map((d, i) => (
            <Reveal as="li" key={d.id} delay={i * 60}>
              <Zoomable index={i + DAY.length} onOpen={setOpen} className="heritage-photo aspect-[4/5] w-full">
                <Photo id={d.id} sizes="(min-width: 768px) 25vw, 50vw" className="h-full w-full object-cover" />
              </Zoomable>
              <p className="mt-3 font-semibold text-ink">{d.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">{d.caption}</p>
            </Reveal>
          ))}
        </ul>
      </div>
      {open >= 0 && <Lightbox items={ALL} index={open} onIndex={setOpen} onClose={() => setOpen(-1)} />}
    </section>
  );
});
