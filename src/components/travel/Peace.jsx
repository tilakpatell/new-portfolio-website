import PhotoBand from './PhotoBand';
import { Reveal, Waypoint } from '../ui';

// The first verse of Satsang Dīkṣhā, as Mahant Swami Maharaj teaches it: a
// prayer for peace for everyone. Text exactly as given, in Gujarati
// (romanised) and English, with its footnote, over Akshardham at dusk.
export default function Peace() {
  return (
    <section data-theme-section="travel" className="relative z-10" aria-labelledby="peace-title">
      <PhotoBand id="h-delhi" className="peace-band">
        <div className="shell relative py-[clamp(7rem,14vw,11rem)]">
          <Waypoint top="0.9rem" />
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="peace-title" className="title !text-white">
              A message of peace
            </h2>
            <p className="mt-3 text-white/85">Taught by Mahant Swami Maharaj</p>
            <Reveal as="figure" className="m-0 mt-10">
              <blockquote className="m-0">
                <p lang="gu-Latn" className="peace-gu">
                  Swāminārāyaṇ Bhagwān eṭale ke sākṣhāt Akṣhar-Puruṣhottam Mahārāj sarvane param shānti, ānand ane sukh arpe. (1)
                </p>
                <p lang="en" className="peace-en">
                  May Swaminarayan Bhagwan, that is, Akshar-Purushottam Maharaj himself,
                  <sup>
                    <a href="#peace-note" aria-label="Note 1" className="peace-ref">
                      1
                    </a>
                  </sup>{' '}
                  bestow ultimate peace, bliss and happiness on all. (1)
                </p>
              </blockquote>
              <figcaption className="mt-6 text-sm text-white/75">Satsang Dīkṣhā, verse 1</figcaption>
            </Reveal>
            <p id="peace-note" className="peace-note">
              1. Here, Swaminarayan Bhagwan and Akshar-Purushottam Maharaj are synonyms and refer to the one supreme entity – Parabrahman, Paramatma.
            </p>
          </div>
        </div>
      </PhotoBand>
    </section>
  );
}
