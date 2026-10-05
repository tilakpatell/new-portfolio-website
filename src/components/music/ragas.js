// The raga database: what each raga is made of and when it is played, as the
// Bhatkhande tradition writes it down. Nothing here makes a sound.
//
//   notes      the swaras it uses (S r R g G m M P d D n N: lowercase komal, M tivra)
//   aroha      the way up, avaroha the way down, in sargam (N. mandra Ni, S' taar Sa)
//   vadi       its most important note, samvadi the second, a fourth or fifth from it
//   thaat      the parent scale it is classed under (null for a raga from the south)
//   time       when it is sung (TIMES), first the tanpura's first string (FIRST_STRING)
//   tune       where its notes sit away from just intonation (ratios over Sa)
//   phrase     a phrase in it for the sitar to play, built on its pakad (its
//              catch-phrase): X>Y a meend, X~ an andolan, X^Y a krintan, -
//              holds, | strikes the chikari; beat is seconds to a note
//
// Tested in ragas.test.js: every raga keeps to its own notes.

// When ragas are sung, in order round the clock, then the seasons.
export const TIMES = {
  dawn: { label: 'Dawn', when: 'at dawn' },
  morning: { label: 'Morning', when: 'in the morning' },
  lateMorning: { label: 'Late morning', when: 'in the late morning' },
  noon: { label: 'Midday', when: 'at midday' },
  afternoon: { label: 'Afternoon', when: 'in the afternoon' },
  sunset: { label: 'Sunset', when: 'at sunset' },
  evening: { label: 'Evening', when: 'in the evening' },
  night: { label: 'Night', when: 'at night' },
  lateNight: { label: 'Late night', when: 'late at night' },
  monsoon: { label: 'Monsoon', when: 'in the monsoon' },
  spring: { label: 'Spring', when: 'in spring' },
};

// The ten thaats, Bhatkhande's parent scales.
export const THAATS = {
  Bilawal: 'SRGmPDN',
  Kalyan: 'SRGMPDN',
  Khamaj: 'SRGmPDn',
  Kafi: 'SRgmPDn',
  Asavari: 'SRgmPdn',
  Bhairavi: 'SrgmPdn',
  Bhairav: 'SrGmPdN',
  Marwa: 'SrGMPDN',
  Purvi: 'SrGMPdN',
  Todi: 'SrgMPdN',
};

// Lower than the just komal notes: the Pythagorean minor second, third and
// sixth (90, 294 and 792 cents against 112, 316 and 814).
const LOW = { r: 256 / 243, g: 32 / 27, d: 128 / 81 };

const raga = (name, thaat, notes, aroha, avaroha, vadi, samvadi, time, first, phrase, beat = 0.42, extra = {}) => ({ name, thaat, notes, aroha, avaroha, vadi, samvadi, time, first, phrase, beat, ...extra });

export const RAGAS = {
  // ── Kalyan ──
  yaman: raga('Yaman', 'Kalyan', 'SRGMPDN', "N. R G M D N S'", "S' N D P M G R S", 'G', 'N', 'evening', 'Pa', "N. R G - R G M>P - | M G R - N. R S - -"),
  bhupali: raga('Bhupali', 'Kalyan', 'SRGPD', "S R G P D S'", "S' D P G R S", 'G', 'D', 'evening', 'Pa', "S R G - P G - | D P G R S - -", 0.4),
  shuddhkalyan: raga('Shuddh Kalyan', 'Kalyan', 'SRGMPDN', "S R G P D S'", "S' N D P M G R S", 'G', 'D', 'evening', 'Pa', "G R S - N. D. P. - S G R G P - | R S - -"),
  kedar: raga('Kedar', 'Kalyan', 'SRGmMPDN', "S m P D N S'", "S' N D P M P D P m R S", 'm', 'S', 'evening', 'Pa', "S m - m G P - D>m - | M P D P m - R S - -"),
  hameer: raga('Hameer', 'Kalyan', 'SRGmMPDN', "S R S G m D N D S'", "S' N D P M P D P G m R S", 'D', 'G', 'night', 'Pa', "S R S - G m D - N D S' - | N D P - M P D P - G m R S - -"),
  hindol: raga('Hindol', 'Kalyan', 'SGMDN', "S G M D N D S'", "S' N D M G S", 'D', 'G', 'spring', 'Ni', "S G M D - | D M G - S - N. D. S - -"),
  // ── Bilawal ──
  bilawal: raga('Alhaiya Bilawal', 'Bilawal', 'SRGmPDnN', "S R G P D N S'", "S' N D n D P m G R S", 'D', 'G', 'morning', 'Pa', "G R G P - D N S' - | S' N D P - D n D P - m G m R S - -"),
  durga: raga('Durga', 'Bilawal', 'SRmPD', "S R m P D S'", "S' D P m R S", 'm', 'S', 'night', 'Pa', "S R m P D - | m P D S' - D P m R - S - -", 0.4),
  deshkar: raga('Deshkar', 'Bilawal', 'SRGPD', "S G P D S'", "S' D P G P D P G R S", 'D', 'G', 'morning', 'Pa', "S G P D - P D S' - | D P G P D P - G R S - -", 0.4),
  hamsadhwani: raga('Hamsadhwani', 'Bilawal', 'SRGPN', "S R G P N S'", "S' N P G R S", 'S', 'P', 'evening', 'Pa', "N. S R G P - N S' - | S' N P G R - S - -", 0.38),
  bihag: raga('Bihag', 'Bilawal', 'SRGmMPDN', "N. S G m P N S'", "S' N D P M P G m G R S", 'G', 'N', 'night', 'Pa', "N. S G m P - | M P G m G - R S - -"),
  // ── Khamaj ──
  khamaj: raga('Khamaj', 'Khamaj', 'SRGmPDnN', "S G m P D N S'", "S' n D P m G R S", 'G', 'N', 'night', 'Pa', "G m P D N S' - | n D P D m G - R S - -", 0.4),
  desh: raga('Desh', 'Khamaj', 'SRGmPDnN', "S R m P N S'", "S' n D P m G R G N. S", 'R', 'P', 'night', 'Pa', "R m P N S' - | n D P - D m G R - G N. S - -", 0.4),
  // ── Kafi ──
  kafi: raga('Kafi', 'Kafi', 'SRgmPDn', "S R g m P D n S'", "S' n D P m g R S", 'P', 'S', 'night', 'Pa', "S R g m P - | m g R g>R S - -", 0.4),
  bageshri: raga('Bageshri', 'Kafi', 'SRgmPDn', "n. S g m D n S'", "S' n D m P D m g R S", 'm', 'S', 'night', 'Ma', "n. D. S m - D n D - | m g - R S - -", 0.45),
  bhimpalasi: raga('Bhimpalasi', 'Kafi', 'SRgmPDn', "n. S g m P n S'", "S' n D P m g R S", 'm', 'S', 'afternoon', 'Pa', "n. S g m - P g m - | g m g R - S - -"),
  brindavani: raga('Brindavani Sarang', 'Kafi', 'SRmPnN', "N. S R m P N S'", "S' n P m R S", 'R', 'P', 'noon', 'Pa', "N. S R m P - N S' - | n P m R - S - -", 0.38),
  madhmad: raga('Madhmad Sarang', 'Kafi', 'SRmPn', "n. S R m P n S'", "S' n P m R S", 'R', 'P', 'noon', 'Pa', "n. S R m P - n P - | m R - S - -", 0.4),
  megh: raga('Megh', 'Kafi', 'SRmPn', "S R m P n S'", "S' n P m R S", 'S', 'P', 'monsoon', 'Pa', "S R>m - R P - m P n S' - | n P m R~ - S - -", 0.45),
  miyanmalhar: raga('Miyan ki Malhar', 'Kafi', 'SRgmPDnN', "S R m R P m P n D N S'", "S' n P m P g m R S", 'm', 'S', 'monsoon', 'Pa', "R m R P - | m P n D N S' - | n P m P g~ m R S - -", 0.45),
  abhogi: raga('Abhogi', 'Kafi', 'SRgmD', "S R g m D S'", "S' D m g R S", 'm', 'S', 'night', 'Ma', "S R g m - D m - | g m g R S - -", 0.42),
  patdeep: raga('Patdeep', 'Kafi', 'SRgmPDN', "N. S g m P N S'", "S' N D P m g R S", 'P', 'S', 'afternoon', 'Pa', "N. S g m P - N S' - | N D P m g - R S - -", 0.4),
  // ── Asavari ──
  asavari: raga('Asavari', 'Asavari', 'SRgmPdn', "S R m P d S'", "S' n d P m g R S", 'd', 'g', 'lateMorning', 'Pa', "S R m P - d m P - | m P g - R S - -", 0.45),
  jaunpuri: raga('Jaunpuri', 'Asavari', 'SRgmPdn', "S R m P d n S'", "S' n d P m g R S", 'd', 'g', 'lateMorning', 'Pa', "R m P - d n S' - | n d P - m g R S - -", 0.42),
  darbari: raga('Darbari Kanada', 'Asavari', 'SRgmPdn', "S R g m P d n S'", "S' d n P m P g m R S", 'R', 'P', 'lateNight', 'Pa', "S R g~ - R S - | n. S R g~ - m P - | d~ - n P - -", 0.5, { tune: { g: LOW.g, d: LOW.d } }),
  // ── Bhairav ──
  bhairav: raga('Bhairav', 'Bhairav', 'SrGmPdN', "S r G m P d N S'", "S' N d P m G r S", 'd', 'r', 'dawn', 'Pa', "S G m d~ - P - | G m r~ - S - -", 0.45),
  ahirbhairav: raga('Ahir Bhairav', 'Bhairav', 'SrGmPDn', "S r G m P D n S'", "S' n D P m G r S", 'm', 'S', 'dawn', 'Pa', "S r G m - P D n D P - | m G r - S - D. n. r S - -", 0.45),
  // ── Bhairavi ──
  bhairavi: raga('Bhairavi', 'Bhairavi', 'SrgmPdn', "S r g m P d n S'", "S' n d P m g r S", 'm', 'S', 'morning', 'Pa', "S g m P - d P m g - | m g r~ S - -", 0.45),
  malkauns: raga('Malkauns', 'Bhairavi', 'Sgmdn', "n. S g m d n S'", "S' n d m g m g S", 'm', 'S', 'lateNight', 'Ma', "n. S g m - | g m d n d m - | g m g S - -"),
  // ── Todi ──
  todi: raga('Miyan ki Todi', 'Todi', 'SrgMPdN', "S r g M d N S'", "S' N d P M g r S", 'd', 'g', 'lateMorning', 'Pa', "d. N. S r g - r g M d - | M g>r - S - -", 0.48, { tune: LOW }),
  multani: raga('Multani', 'Todi', 'SrgMPdN', "N. S g M P N S'", "S' N d P M g r S", 'P', 'S', 'afternoon', 'Pa', "N. S M g - M P - N S' - | d P M g - r S - -", 0.45),
  madhuvanti: raga('Madhuvanti', 'Todi', 'SRgMPDN', "N. S g M P N S'", "S' N D P M g R S", 'P', 'S', 'afternoon', 'Pa', "N. S g M P - N S' - | N D P M g - R S - -", 0.42),
  // ── Marwa ──
  marwa: raga('Marwa', 'Marwa', 'SrGMDN', "N. r G M D N r' S'", "r' N D M G r S", 'r', 'D', 'sunset', 'Ni', "N. r G M D - M G r - | N. D. r S - -", 0.45),
  puriya: raga('Puriya', 'Marwa', 'SrGMDN', "N. r G M D N S'", "S' N D M G r S", 'G', 'N', 'sunset', 'Ni', "N. r G - M D G - | M G r S - -", 0.45),
  sohini: raga('Sohini', 'Marwa', 'SrGMDN', "S G M D N S'", "S' r' S' N D G M D G r S", 'D', 'G', 'lateNight', 'Ni', "G M D N S' - r' S' - | N D G M D G - r S - -", 0.4),
  // ── Purvi ──
  purvi: raga('Purvi', 'Purvi', 'SrGmMPdN', "N. r G M P d N S'", "S' N d P M G m G r S", 'G', 'N', 'sunset', 'Pa', "N. r G M P - d P M G - | m G r S - -", 0.45),
  puriyadhanashri: raga('Puriya Dhanashri', 'Purvi', 'SrGMPdN', "N. r G M P d N S'", "S' N d P M G r S", 'P', 'r', 'sunset', 'Pa', "N. r G M P - | M d P M G - M r G - r S - -", 0.42),
  shree: raga('Shree', 'Purvi', 'SrGMPdN', "S r M P N S'", "S' N d P M G r S", 'r', 'P', 'sunset', 'Pa', "S r - r>P - P M G r - | G r S - -", 0.5),
  // Lalit with komal Dha, as it is sung today, is Purvi's; Bhatkhande's own, with shuddha Dha, was Marwa's
  lalit: raga('Lalit', 'Purvi', 'SrGmMdN', "N. r G m M d N S'", "S' N d M m G r S", 'm', 'S', 'dawn', 'Ma', "N. r G m - M m G - | M d M m G - r S - -", 0.45),
  // ── from the south ──
  kirwani: raga('Kirwani', null, 'SRgmPdN', "S R g m P d N S'", "S' N d P m g R S", 'P', 'S', 'night', 'Pa', "S R g m P - d N S' - | N d P m g - R S - -", 0.4),
};

// A raga of the player's own: its notes, and a phrase that runs up and down them.
export function customRaga(notes, name) {
  const ns = [...'SrRgGmMPdDnN'].filter((s) => notes.includes(s));
  const up = [...ns, "S'"];
  const down = [...up].reverse();
  const hasPa = ns.includes('P');
  return {
    name: String(name || '').trim().slice(0, 32) || 'Your raga',
    thaat: null,
    notes: ns.join(''),
    aroha: up.join(' '),
    avaroha: down.join(' '),
    vadi: null,
    samvadi: null,
    time: null,
    // without Pa the tanpura's first string goes to Ma, or Ni
    first: hasPa ? 'Pa' : ns.includes('m') ? 'Ma' : 'Ni',
    phrase: `${up.join(' ')} - | ${down.slice(1).join(' ')} - -`,
    beat: 0.38,
    custom: true,
  };
}
