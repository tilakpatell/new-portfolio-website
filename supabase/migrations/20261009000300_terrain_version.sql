-- The ground a thing was built on (lane D, the spec's Pillar 2 and the plan's
-- Task 4b): a planet's ground is code (src/lib/land/flight/planetSpec.js's
-- TERRAIN_VERSION, bumped whenever a world's ground changes), and a turret
-- stored at a height on the old ground would float or sink on the new. Each
-- planet says the version its ground is now (scripts/supabase-seed.mjs
-- writes it) and each entity the version it was put down on; a client that
-- finds an entity on an older ground puts it back on the ground it draws.
-- Every row before this column was put down on the first ground.
alter table public.planets add column if not exists terrain_version integer not null default 1 check (terrain_version >= 1);
alter table public.world_entities add column if not exists terrain_version integer not null default 1 check (terrain_version >= 1);

-- (get_entities_in_bounding_box returns setof world_entities: the new column
-- is in its rows with no change to it; PostgREST is told the schema moved)
notify pgrst, 'reload schema';
