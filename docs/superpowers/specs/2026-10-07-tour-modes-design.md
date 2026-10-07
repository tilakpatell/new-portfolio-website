# Tours across pages: recruiter, player, mixed

The design of the site-wide tour modes lives in the project's design doc
(Claude Docs, "Tour system design", 2026-10-07): three scripts on one runner,
legs as the unit of navigation and skipping, `data-tour` marks as the only
targeting, two localStorage keys for status and resume. In short:

- **Recruiter** (about 2 minutes): home, a role, projects, the résumé, contact,
  and one look at the universe.
- **Player** (about 5 minutes, each world skippable): the map and ships, the
  galaxy, Avengers HQ, Middle-earth, Scranton, Invincible, C-137, Albuquerque,
  the games, the terminal, achievements, online.
- **Mixed**: the recruiter spine plus the stops tagged `taste`.

A phone waits for a world's 3D like any device; one that keeps a world light
tours its 2D version with a notice on the first card. The runner, the script
shape (`lib/tour.js`) and the memory keys are in
[the site tour's design](2026-10-07-site-tour-design.md), "Where things live".

Landing in four PRs: the runner (this one), the recruiter script with the mode
picker and the `?tour=` link, the player script, then mixed and polish.
