# Supabase: the durable world

The schema in `migrations/` is the one source of truth for what players build on the planets (the design: `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`, Pillar 2; why a server at all: `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`). The client is `src/lib/durable/`.

## Applying it

1. Make a project at supabase.com (the free tier is enough to start). In Authentication, Providers, enable **Anonymous sign-ins**.
2. `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Or paste each file under `migrations/` into the SQL editor, oldest first, then `seed.sql`.
3. Put the project's URL and anon key where the build reads them: locally in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (never committed; `.env.example` lists the names), and on GitHub as the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`deploy.yml` passes them to the build). The anon key is public by design: row-level security is what guards the tables, which is why every table here has it on.

## Checking it

`node scripts/supabase-check.mjs` against a linked project: signs in anonymously, places three entities, asks the envelope round them, is refused inside a POI, damages one to nothing and sees it gone. It runs by hand (it needs a project); CI tests the client against a fake.

## Rules

- A change to the schema is a new migration file, never an edit of an applied one.
- No service-role key anywhere in this repository or its workflows. The client holds the anon key only.
- A write that is not the owner's own row goes through a `security definer` function that clamps and rate-limits (`damage_entity` is the pattern).
