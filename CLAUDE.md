# tilakpatell.com

A portfolio site: a classic page and a universe of 3D worlds, built on React and three.js, deployed as a static site.

Start at `docs/README.md`: it maps every folder under `docs/` and says where to look for a question.

The rules live in two places, and this file does not copy them:

- `docs/health/RULES.md`: layers, size, tests, UI, and what may import what.
- `.claude/skills/autopilot/SKILL.md`: the standing rules every change keeps.

Every library has a page under `docs/stack/`; a new one gets its page before it is imported.

Before a change is done:

```
npm run lint
npm test
npm run build
node scripts/health.mjs --check --skip build
```
