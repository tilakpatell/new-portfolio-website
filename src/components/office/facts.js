// Dwight's fact check (FactCheck.jsx): the facts, his verdict on each, and
// his verdict on the round. Pure data, so scripts/voices can make what
// Dwight says in his voice (./voicelines.js). `clip` is the show saying it
// out loud, played instead.

export const PER_ROUND = 8;

// (and how many countries, which FactCheck.jsx counts: its words change as
// the count does, so it has no voice made)
export const ABOUT_ME = [
  { q: 'Tilak plays the sitar.', fact: true, dwight: 'Fact. Around twenty strings, and most of them ring on their own. I respect an instrument with backup.' },
  { q: 'Tilak’s Game Boy emulator runs games at 30 frames per second.', fact: false, dwight: 'False. Sixty, like the real hardware. Thirty is for amateurs and the Stamford branch.' },
  { q: 'Tilak is interning at Amazon Web Services.', fact: true, dwight: 'Fact. Technical Infrastructure PM intern. Before that RTX, Bose, Pendar and SRC. A strong résumé. Almost as strong as mine.' },
  { q: 'Tilak’s AI translator turns Gujarati scripture into Klingon.', fact: false, dwight: 'False. Into English, verse by verse. Klingon is a hobby, not a career.' },
  { q: 'Tilak studies computer science at Northeastern.', fact: true, dwight: 'Fact. Boston. A fine city, if you don’t count the people, the traffic or the Red Sox.' },
  { q: 'Tilak once worked on lasers.', fact: true, dwight: 'Fact. Laser software at Pendar Technologies. I have asked for a laser for my desk. Request denied.' },
  { q: 'Tilak’s Game Boy emulator passes Blargg’s CPU tests.', fact: true, dwight: 'Fact. Every instruction, checked. That is how I do my taxes.' },
  { q: 'Tilak wrote his Unix shell in Python.', fact: false, dwight: 'False. In C. Python is for people who do not fear death.' },
  { q: 'Tilak interned at Dunder Mifflin.', fact: false, dwight: 'False. There is no record of him in the employee files. I checked. Twice. With a flashlight.' },
  { q: 'Tilak’s code was merged into GitHub’s awesome-copilot.', fact: true, dwight: 'Fact. Thirty-nine thousand stars. I have one star. It is gold, and Michael gave it to me.' },
];

export const ABOUT_THE_BRANCH = [
  { q: 'Bears eat beets.', fact: true, dwight: 'Fact. Bears. Beets. Battlestar Galactica.', clip: 'bearsBeets' },
  { q: 'Identity theft is a joke.', fact: false, dwight: 'False. Identity theft is not a joke. Millions of families suffer every year.', clip: 'identityTheft' },
  { q: 'Dwight’s middle name is Kurt.', fact: true, dwight: 'Fact. Dwight Kurt Schrute. The Kurt is for my grandfather, who could kill a man with a tuba.' },
  { q: 'Michael bought his own World’s Best Boss mug.', fact: true, dwight: 'Fact. At Spencer Gifts. Which does not make it less true.' },
  { q: 'Dunder Mifflin Scranton is in Pittsburgh.', fact: false, dwight: 'False. The Scranton Business Park, Slough Avenue. Pittsburgh has no Dwight Schrute.' },
  { q: 'Dwight is a volunteer sheriff’s deputy.', fact: true, dwight: 'Fact. Lackawanna County. I have the badge, the hat, and a list.' },
  { q: 'Michael’s screenplay is called Threat Level Midnight.', fact: true, dwight: 'Fact. I play Samuel L. Chang. It is the best role of my career.' },
  { q: 'Schrute Farms grows corn.', fact: false, dwight: 'False. Beets. Also a bed and breakfast. Corn is for the weak.' },
  { q: 'Andy Bernard went to Princeton.', fact: false, dwight: 'False. Cornell. He will tell you. He will tell you again.' },
  { q: 'Michael drove into a lake because his GPS told him to.', fact: true, dwight: 'Fact. The machine knows. That is what he said, as the car sank.' },
  { q: 'The Office Olympics medals were yogurt lids.', fact: true, dwight: 'Fact. I did not win one. The competition was rigged.' },
  { q: 'Ryan started a fire in the kitchen making a cheese pita.', fact: true, dwight: 'Fact. In the toaster oven. I led the evacuation. Nobody thanked me.' },
  { q: 'Toby moved to Costa Rica.', fact: true, dwight: 'Fact. He came back. Like a rash.' },
];

// the round, by how many he got right
export const VERDICTS = {
  perfect: 'Perfect. You would make an excellent assistant to the regional manager.',
  close: 'Acceptable. You may keep your desk.',
  half: 'You are no Schrute. But you are not Toby either.',
  poor: 'You are no Schrute. Go back to the beginning.',
};
export const verdict = (score) => (score === PER_ROUND ? VERDICTS.perfect : score >= PER_ROUND - 2 ? VERDICTS.close : score >= PER_ROUND / 2 ? VERDICTS.half : VERDICTS.poor);
