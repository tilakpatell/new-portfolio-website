// Tier 6, one real model and one real line on the desktop's GPU: not built
// yet (docs/superpowers/plans/2026-10-07-ai-e2e-testing.md, PR 8). It says
// so and fails, so npm run test:ai:gpu can't pass by doing nothing.
console.error('tier 6 (the real run) is not built yet: the AI e2e plan, PR 8');
process.exit(1);
