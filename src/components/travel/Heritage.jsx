import { useState } from 'react';
import { RiZoomInLine } from 'react-icons/ri';
import Photo from '../Photo';
import Lightbox from '../Lightbox';
import AkshardhamScene from './AkshardhamScene';
import { Reveal, Waypoint } from '../ui';

// Indian architecture: the two Akshardhams, with facts from the official
// sites, then the carving up close, over a faint jali (stone lattice)
// pattern. Any photo opens larger.

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

const ALL = [
  { id: 'h-robbinsville', title: 'BAPS Swaminarayan Akshardham', caption: 'Robbinsville, New Jersey, at sunset' },
  { id: 'h-delhi', title: 'Swaminarayan Akshardham', caption: 'New Delhi, in the evening' },
  ...DETAILS,
];

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

export default function Heritage() {
  const [open, setOpen] = useState(-1);
  return (
    <section id="heritage" data-theme-section="travel" className="heritage relative z-10 scroll-mt-20 py-16 md:py-28" aria-labelledby="heritage-title">
      <div className="jali" aria-hidden="true">
        <div className="jali-pattern" />
      </div>
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

        <div className="mt-10">
          <AkshardhamScene />
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
          <Reveal className="h-full">
            <Zoomable index={0} onOpen={setOpen} className="heritage-photo heritage-hero h-full w-full">
              <Photo id="h-robbinsville" sizes="(min-width: 1024px) 640px, 100vw" className="h-full w-full object-cover" />
            </Zoomable>
          </Reveal>

          <div className="grid content-between gap-6">
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
              <Zoomable index={1} onOpen={setOpen} className="heritage-photo mt-5 aspect-[16/9] w-full">
                <Photo id="h-delhi" sizes="(min-width: 1024px) 560px, 100vw" className="h-full w-full object-cover" />
              </Zoomable>
            </Reveal>
            <Reveal className="temple" delay={80}>
              <p className="label">Robbinsville, New Jersey</p>
              <h3 className="stretch-semi mt-1 text-2xl font-semibold text-ink">BAPS Swaminarayan Akshardham</h3>
              <p className="mt-2 leading-relaxed text-body">
                Opened in October 2023. Stone carved by hand in India, then assembled in New Jersey with the help of thousands of volunteers.
              </p>
            </Reveal>
          </div>
        </div>

        <h3 className="stretch-semi mt-16 text-xl font-semibold text-ink md:mt-20">Up close</h3>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {DETAILS.map((d, i) => (
            <Reveal as="li" key={d.id} delay={i * 60}>
              <Zoomable index={i + 2} onOpen={setOpen} className="heritage-photo aspect-[4/5] w-full">
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
}
