// Themes. The CSS tokens live in index.css under [data-theme="…"]; this file
// holds what JavaScript needs. Company themes can be picked from the nav dots;
// project themes apply on their own project pages.
export const THEMES = {
  aws: { id: 'aws', label: 'AWS', company: 'Amazon Web Services', swatch: '#FF9900' },
  rtx: { id: 'rtx', label: 'RTX', company: 'RTX Corporation', swatch: '#CE1126' },
  bose: { id: 'bose', label: 'Bose', company: 'Bose Corporation', swatch: '#131317' },
  pendar: { id: 'pendar', label: 'Pendar', company: 'Pendar Technologies', swatch: '#4DA3DC' },
  empowerreg: { id: 'empowerreg', label: 'Empowerreg', company: 'Empowerreg AI', swatch: '#7BC043' },
  src: { id: 'src', label: 'SRC', company: 'SRC, Inc.', swatch: '#002C77' },
  // project themes
  gameboy: { id: 'gameboy', label: 'Game Boy', company: 'Game Boy', swatch: '#9B2257' },
  claude: { id: 'claude', label: 'Claude', company: 'Claude', swatch: '#D97757' },
  devspace: { id: 'devspace', label: 'DevSpace', company: 'DevSpace', swatch: '#007ACC' },
  github: { id: 'github', label: 'GitHub', company: 'GitHub', swatch: '#8250DF' },
  shell: { id: 'shell', label: 'Shell', company: 'Unix shell', swatch: '#2F8A1F' },
  fuse: { id: 'fuse', label: 'FUSE', company: 'FUSE file system', swatch: '#B45309' },
  finance: { id: 'finance', label: 'Finance', company: 'Finance platform', swatch: '#0F9D58' },
  pytorch: { id: 'pytorch', label: 'PyTorch', company: 'PyTorch', swatch: '#EE4C2C' },
  nvidia: { id: 'nvidia', label: 'NVIDIA', company: 'GPU research', swatch: '#76B900' },
};

export const THEME_ORDER = ['aws', 'rtx', 'bose', 'pendar', 'empowerreg', 'src'];
export const DEFAULT_THEME = 'aws';

// Pages that carry their own theme.
export const ROUTE_THEMES = {
  '/projects/gameboy-emulator': 'gameboy',
  '/projects/swaminarayan-translator': 'claude',
  '/projects/devspace': 'devspace',
  '/projects/awesome-copilot': 'github',
  '/projects/unix-shell': 'shell',
  '/projects/fuse-fs': 'fuse',
  '/projects/finance-platform': 'finance',
  '/projects/smart-summarizer': 'pytorch',
  '/projects/gpu-checkpoint-restart': 'nvidia',
};
