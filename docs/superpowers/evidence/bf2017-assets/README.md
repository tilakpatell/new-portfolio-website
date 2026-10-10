# The Battlefront II (2017) drop on Supabase: what was there on 2026-10-10

What the files in this folder are, and how they were made. The design they feed is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`.

| file | what |
| --- | --- |
| `inventory.md` | the two buckets counted: files, bytes, folders, formats, what a model carries, what a texture is, what is missing |

## How the count was made

The buckets are private, so the anon key sees nothing. The counts came from the project's `storage.objects` table through the Supabase Management API (`POST https://api.supabase.com/v1/projects/<ref>/database/query`, bearer the management key from the session's environment), grouped by path. The manifest `web/models.jsonl` (25 MB, 13,871 lines) and five sample files were downloaded with the service key through `GET /storage/v1/object/bf2017-assets/<path>` and read with Python (the glTF JSON chunk) and `@gltf-transform/core`. No key is in this repository; the session's keys were environment variables.

The upload was still running while this was counted (objects went from 90,280 to 103,835 in the twenty-five minutes of the session, and `web/textures/` had not started), so the numbers are a floor, and the manifest, which lists everything the uploader intends, is the ceiling.
