export const profile = {
  name: 'Tilak Patel',
  identity: 'Software Engineer',
  email: 'tilakny@gmail.com',
  site: 'https://tilakpatell.com',
  github: { handle: 'tilakpatell', url: 'https://github.com/tilakpatell' },
  linkedin: { handle: 'tilakpatell', url: 'https://www.linkedin.com/in/tilakpatell' },
  resume: { href: '/Resume.pdf', filename: 'Tilak_Patel_Resume.pdf' },
  photo: {
    webp: '/portrait.webp',
    webpSmall: '/portrait-480.webp',
    jpg: '/portrait.jpg',
    width: 780,
    height: 975,
    alt: 'Tilak Patel smiling in a black rain jacket in front of a waterfall',
  },
  lead:
    'Computer science student at Northeastern, currently a Technical Infrastructure Program Manager Intern at AWS — building data-center planning tools for generative-AI capacity.',
  focus: 'Infrastructure tooling, AI pipelines and systems software.',
  offClock: 'Off the clock: Game Boy emulators, open source and an unreasonable amount of Star Wars.',
};

export const education = {
  school: 'Northeastern University',
  location: 'Boston, MA',
  degree: 'B.S. Computer Science',
  gpa: '3.6 / 4.0',
  graduation: '2027-05',
  coursework: [
    'Grad AI',
    'Grad HPC',
    'Algorithms',
    'Computer Systems',
    'Systems Security',
    'Robotics',
    'Theory of Computation',
  ],
};

// Grouped exactly as on the résumé.
export const skills = [
  { id: 'languages', label: 'Languages', items: ['Python', 'C/C++', 'Java', 'C#/.NET', 'SQL', 'Assembly (x86)', 'JavaScript'] },
  { id: 'frameworks', label: 'Frameworks', items: ['FastAPI', 'Spring Boot', 'React', 'Node.js', 'PyTorch', 'LangGraph', 'Qt/PySide6'] },
  { id: 'tools', label: 'Tools & platforms', items: ['AWS (Redshift, Bedrock)', 'Docker', 'Git', 'Linux', 'GitHub Actions', 'MongoDB', 'Grafana', 'MCP'] },
];

export const focusAreas = [
  {
    id: 'infra',
    title: 'Infrastructure & capacity',
    body:
      'Planning tools that model server-placement constraints for generative-AI capacity at AWS, and the application-modernization roadmap behind RTX’s move to its Xeta Cloud platform.',
    where: ['aws', 'rtx'],
  },
  {
    id: 'ai',
    title: 'AI pipelines & agents',
    body:
      'A multi-agent pipeline that queries Redshift over MCP to flag stale capacity data, knowledge-graph extraction from 500+ radar documents with LangGraph, and a Copilot SDK desktop app.',
    where: ['aws', 'src', 'bose'],
  },
  {
    id: 'systems',
    title: 'Systems & performance',
    body:
      'A Game Boy emulator that passes Blargg’s CPU tests at 60 FPS, a real-time Qt acquisition app that replaced LabVIEW, and low-level C work — shells, file systems, MPI.',
    where: ['gameboy', 'pendar'],
  },
];
