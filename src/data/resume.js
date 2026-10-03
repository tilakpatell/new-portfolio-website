// The one-page résumé, assembled from the same data as the rest of the site so
// the two never drift apart. The entries and their order match Resume.pdf.
import { education, profile, skills } from './profile';
import { roles, fmtRange } from './roles';
import { projectById } from './projects';

const RESUME_ROLES = ['aws', 'rtx', 'bose', 'pendar', 'src'];

const RESUME_PROJECTS = [
  { id: 'gpu-checkpoint-restart', title: 'Research: GPU Checkpoint-Restart', note: 'Prof. Gene Cooperman' },
  { id: 'gameboy-emulator', title: 'Game Boy Emulator' },
  { id: 'devspace', title: 'DevSpace', note: 'HackBeanpot 1st place' },
  { id: 'awesome-copilot', title: 'Open source: github/awesome-copilot' },
];

export const resume = {
  name: profile.name,
  contact: [
    { label: profile.email, href: `mailto:${profile.email}` },
    { label: `linkedin.com/in/${profile.linkedin.handle}`, href: profile.linkedin.url },
    { label: `github.com/${profile.github.handle}`, href: profile.github.url },
    { label: 'tilakpatell.com', href: profile.site },
  ],
  skills,
  experience: RESUME_ROLES.map((id) => {
    const r = roles.find((x) => x.id === id);
    return { id, title: r.company, subtitle: r.title, where: r.location, when: fmtRange(r), bullets: r.bullets, stack: r.stack, link: `/experience?role=${id}` };
  }),
  projects: RESUME_PROJECTS.map(({ id, title, note }) => {
    const p = projectById(id);
    const source = p.links.find((l) => /source|repository|merged/i.test(l.label));
    return { id, title, note, stackLine: p.stack.join(', '), bullets: p.bullets, stack: p.stack, link: `/projects/${id}`, source: source?.href ?? null };
  }),
  education,
};

// Which lines each skill shows up in. One pattern per skill, tested against
// every bullet and every stack item; `^C$` only ever matches the stack item "C".
const PATTERNS = {
  Python: /\bPython\b/,
  'C/C++': /C\+\+|^C$/,
  Java: /\bJava\b(?!Script)/,
  'C#/.NET': /C#|\.NET/,
  SQL: /\bSQL\b|PostgreSQL/,
  'Assembly (x86)': /Assembly|x86/,
  JavaScript: /JavaScript/,
  FastAPI: /FastAPI/,
  'Spring Boot': /Spring Boot/,
  React: /\bReact\b/,
  'Node.js': /Node\.js/,
  PyTorch: /PyTorch/,
  LangGraph: /LangGraph/,
  'Qt/PySide6': /Qt\/PySide6|PySide6/,
  'AWS (Redshift, Bedrock)': /\bAWS\b|Redshift|Bedrock/,
  Docker: /Docker/,
  Git: /\bGit\b(?!Hub)/,
  Linux: /Linux/,
  'GitHub Actions': /GitHub Actions/,
  MongoDB: /MongoDB/,
  Grafana: /Grafana/,
  MCP: /\bMCP\b/,
};

export const skillPattern = (skill) => PATTERNS[skill] ?? new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
export const skillSlug = (skill) => skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const skillFromSlug = (slug) => skills.flatMap((g) => g.items).find((s) => skillSlug(s) === slug) ?? null;

const entries = () => [...resume.experience, ...resume.projects];

// Number of bullets that mention the skill, across the whole page.
export function skillCount(skill) {
  const re = skillPattern(skill);
  return entries().reduce((n, e) => n + e.bullets.filter((b) => re.test(b)).length + (e.bullets.some((b) => re.test(b)) ? 0 : e.stack.some((s) => re.test(s)) ? 1 : 0), 0);
}

export const entryMatches = (entry, active) => active.some((skill) => {
  const re = skillPattern(skill);
  return entry.bullets.some((b) => re.test(b)) || entry.stack.some((s) => re.test(s));
});
