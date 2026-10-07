// The recruiter's tour: who Tilak is, where he's worked, what he's built and
// how to reach him, across the portfolio's pages, with one look at the
// universe at the end. About two minutes. A leg is a page (lib/tour.js); a
// stop lights the thing marked data-tour="name" on it, or sits in the
// middle. `text` may be a function of { key } (⌘K or Ctrl K).

export const RECRUITER = {
  id: 'recruiter',
  title: 'For recruiters',
  minutes: 2,
  achievement: 'tour-recruiter',
  legs: [
    {
      id: 'home',
      path: '/home',
      ready: 'feed',
      title: 'Home',
      stops: [
        {
          id: 'hello',
          title: 'The short version',
          text: 'I’m Tilak Patel: a technical program manager intern at AWS, studying computer science at Northeastern, open to TPM and software engineering roles. Two minutes, the parts you came for. Next or → goes on; Esc ends it.',
        },
        {
          id: 'career',
          at: 'career',
          title: 'Where I’ve worked',
          text: 'Six companies, newest first: AWS, RTX, Bose, Pendar, Empowerreg AI and SRC. Each one is a chapter of the Experience page, and the site takes that company’s colours as you read it.',
        },
        {
          id: 'program',
          at: 'program',
          title: 'How I run a program',
          text: 'Discover, plan, build, deliver, measure: each step is something I’ve done, with the role it came from. At AWS and RTX the job was the program; everywhere else I built the software.',
        },
      ],
    },
    {
      id: 'experience',
      path: '/experience/aws',
      ready: 'feed',
      title: 'Experience',
      stops: [
        {
          id: 'role',
          at: 'role',
          title: 'A role up close',
          text: 'At AWS I build data-centre planning tools for generative-AI capacity, and a multi-agent pipeline that flags stale capacity data to its owners. Every role reads like this: what it was, what I did, what came of it.',
        },
        {
          id: 'tracks',
          at: 'tracks',
          title: 'Hiring for one side?',
          text: 'Highlight the program-management roles or the engineering ones and the others step back. Scroll on and the roles run newest to oldest.',
          tags: ['taste'],
        },
      ],
    },
    {
      id: 'projects',
      path: '/projects',
      ready: 'feed',
      title: 'Projects',
      stops: [
        {
          id: 'featured',
          at: 'featured',
          title: 'Things I’ve built',
          text: 'A Game Boy emulator, a translator built with Claude, a developer workspace and a Copilot extension up front, with a live demo in each write-up. The cartridges above are the same projects; the periodic table filters by what they’re built with.',
        },
      ],
    },
    {
      id: 'resume',
      path: '/resume',
      ready: 'feed',
      title: 'Résumé',
      stops: [
        {
          id: 'sheet',
          at: 'resume-sheet',
          title: 'The résumé',
          text: 'Click any skill and every line that uses it lights up. The PDF tab is the same résumé as a page; Download and Print are above. Try it, then press Next.',
          pause: true,
        },
      ],
    },
    {
      id: 'contact',
      path: '/contact',
      ready: 'feed',
      title: 'Contact',
      stops: [
        {
          id: 'memo',
          at: 'memo',
          title: 'Reach me',
          text: 'The memo opens in your mail app with everything filled in. Copy address and the résumé download are just below it, and LinkedIn and GitHub are in the footer of every page.',
        },
      ],
    },
    {
      id: 'universe',
      path: '/universe/experience',
      ready: 'map',
      title: 'The universe',
      stops: [
        {
          id: 'map',
          at: 'panel',
          title: 'And it’s a universe',
          text: 'The same site, laid out as space: the stations round the sun are the pages you just read, the planets further out are worlds to walk and games to play. Built with React and three.js on a static site, no backend.',
          tags: ['taste'],
        },
      ],
    },
  ],
  end: {
    id: 'done',
    title: 'That’s the short version',
    text: ({ key }) => `Thanks for your time. Take it again from ${key} or the guide’s “The site” tab, where the player’s tour of the worlds and games lives too.`,
  },
};
