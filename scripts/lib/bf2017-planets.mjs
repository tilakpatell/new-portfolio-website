// The game's planet skins, for the galaxy's planets seen from orbit
// (lane K: docs/superpowers/plans/2026-10-10-bf2017-phaseK-planet-skins.md).
// The drop paints its planets by shader, so no model names these maps and
// the optimiser never cut them: they sit in the bucket as the game named them
// (`web/textures/<lowercased name>.png` and `.ktx2`). SKINS says which game
// maps each site planet wears; the import resolves it against the bucket's
// list, converts what it finds to the site's sizes under
// `public/textures/galaxy/planets/<id>/`, and writes src/data/planetSkins.json,
// which bodies.js reads. The mapping is data reviewed in the PR, never a
// guess in the code that draws.
//
// SKINS: { [site look id]: { color, normal?, clouds?, atmo?, rings?, seamShift?,
//   seas?, greenDown?, atmoScale?, ringsAt? } }; each map is a list of globs
//   over the lowercased game names, best first: the first glob that matches
//   exactly one name wins, so a glob that turns out to match two is reported,
//   not guessed between
// sizesFor(kind, tier) → { w, format } | null
// planFor(skin, available: Set<name>) → { fetch: [{ kind, name }], missing: [{ kind, why }] }
// convertSkin({ id, skin, images: { kind: Buffer }, outDir, encodeKtx2 }) →
//   { entry, files: [{ path, bytes, tier }], skipped: [{ kind, why }] }

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { isSequel } from "./bf2017-manifest.mjs";
import { normalPng } from "./bf2017-textures.mjs";

// (the sharp glTF-Transform's ndarray-pixels loads: see bf2017-textures.mjs)
const sharp = createRequire(
  createRequire(import.meta.url).resolve("ndarray-pixels"),
)("sharp");

// The sequel's worlds, refused whatever the table says (the autopilot's rule;
// phase 0's isSequel knows the drop's folder names, these are the planets')
export const SEQUEL_WORLDS = [
  "jakku",
  "starkiller",
  "takodana",
  "crait",
  "dqar",
  "resurgent",
  "hosnian",
];
export const sequelWorld = (s) =>
  isSequel(s) || SEQUEL_WORLDS.some((w) => s.toLowerCase().includes(w));

// The drop's planet textures, as the spec counts them (102 on 2026-10-10)
export const isPlanetTexture = (name) =>
  /planet|gasgiant|moon_|cluster_|debrisring|asteroids_/i.test(name);

// Where each site planet's skin is in the drop. The names the plan quotes
// are exact; the rest are globs over the planet folders, and an ambiguous or
// absent one is reported by the import for this table to be made exact.
const space = (world) => `levels/space/*${world}*/planet`;
const front = (world) =>
  `*/objects/planets/${world}/t_planetfront*${world}*_ca`;
export const SKINS = {
  bespin: {
    color: [
      `${space("bespin")}/*gasgiant*_c`,
      `${space("bespin")}/*_c`,
      front("bespin"),
    ],
  },
  endor: {
    color: ["levels/space/sb_endor_01/planet/t_planet_endor_01_cs"],
    normal: ["levels/space/sb_endor_01/planet/t_planet_endor_01_n"],
    clouds: ["levels/space/sb_endor_01/planet/*cloud*_c"],
    atmo: ["levels/space/sb_endor_01/planet/*atmosphere*_c"],
  },
  "endor-giant": { color: ["*/t_gasgiant_endor_01_c"] },
  geonosis: {
    color: [
      `${space("geonosis")}/*_cs`,
      "*/objects/planets/geonosis/t_planetfrontendgeonosis_01_ca",
    ],
    rings: [
      "s5_1/objects/planets/geonosis/t_planetfrontendgeonosisrings_01_ca",
    ],
    ringsAt: [1.35, 2.3],
    atmoScale: 0.5,
  },
  hoth: {
    color: [
      `${space("hoth")}/*_cs`,
      "*/objects/planets/hoth/t_planetfront*hoth_01_ca",
    ],
    normal: [`${space("hoth")}/*_n`],
    atmoScale: 0.5,
  },
  kamino: {
    color: [`${space("kamino")}/*_cs`, front("kamino")],
    normal: [`${space("kamino")}/*_n`],
    clouds: [`${space("kamino")}/*cloud*`],
    seas: true,
  },
  kashyyyk: {
    color: [`${space("kashyyyk")}/*_cs`, front("kashyyyk")],
    atmoScale: 0.5,
  },
  naboo: {
    color: [`${space("naboo")}/*_cs`, front("naboo")],
    normal: [`${space("naboo")}/*_n`],
    clouds: [`${space("naboo")}/*cloud*`],
    atmo: [`${space("naboo")}/*atmosphere*`],
    seas: true,
  },
  scarif: {
    color: [`${space("scarif")}/*_cs`, front("scarif")],
    atmoScale: 0.5,
    seas: true,
  },
  tatooine: {
    color: [`${space("tatooine")}/*_cs`, front("tatooine")],
    atmoScale: 0.5,
  },
  yavin: { color: ["levels/lighting/yavin/sunset_01/t_yavin_01_planet_c"] },
  yavin4: {
    color: [`${space("yavin")}/*planet*_cs`, front("yavin4"), front("yavin")],
    atmoScale: 0.5,
  },
};

// The worlds the drop paints that no system on the site has a body for: left
// out until a system draws them (a new look in bodies.js and a place in
// systems.js are another lane's)
export const UNPLACED = [
  "naboo moon",
  "sullust",
  "kessel",
  "felucia",
  "death star II",
  "ryloth and its moon",
  "fondor and its moon",
  "athulla",
  "pillio",
  "vardos",
];

// The site's sizes. Low draws no skin (a weak device keeps the procedural
// ground and its memory); the cloud map is half the colour's size; the ultra
// colour and normal are UASTC, which stays compressed on the graphics chip
const COLOR = {
  mid: { w: 1024, format: "webp" },
  high: { w: 2048, format: "webp" },
  ultra: { w: 4096, format: "ktx2" },
};
export const TIERS = ["mid", "high", "ultra"];
export function sizesFor(kind, tier) {
  const c = COLOR[tier];
  if (!c) return null;
  if (kind === "color" || kind === "normal") return { ...c };
  if (kind === "clouds" || kind === "rings")
    return { w: c.w / 2, format: "webp" };
  return null; // (the atmosphere is a colour, read once at import)
}

const globRe = (g) =>
  new RegExp(
    `^${g
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")}$`,
  );
// (a `*` inside a segment stays in it; a leading `*/` stands for any folders)
const matches = (glob, names) => {
  const re = glob.startsWith("*/")
    ? new RegExp(`(^|/)${globRe(glob.slice(2)).source.slice(1)}`)
    : globRe(glob);
  return names.filter((n) => re.test(n));
};

export const KINDS = ["color", "normal", "clouds", "atmo", "rings"];
export function planFor(skin, available) {
  const names = [...(available ?? [])]
    .map((n) => String(n).toLowerCase())
    .sort();
  const fetch = [];
  const missing = [];
  for (const kind of KINDS) {
    const globs = skin?.[kind];
    if (!globs) continue;
    let found = null;
    const seen = [];
    for (const g of [].concat(globs)) {
      const hit = matches(g, names).filter((n) => !sequelWorld(n));
      if (hit.length === 1) {
        found = hit[0];
        break;
      }
      if (hit.length > 1)
        seen.push(
          `${g}: ${hit.length} names (${hit.slice(0, 3).join(", ")}${hit.length > 3 ? ", …" : ""})`,
        );
    }
    if (found) fetch.push({ kind, name: found });
    else
      missing.push({
        kind,
        why: seen.length
          ? `ambiguous: ${seen.join("; ")}`
          : "not in the bucket yet",
      });
  }
  return { fetch, missing };
}

// A game name from a bucket path or a textures.jsonl line, as SKINS globs it
export const nameOf = (path) =>
  String(path)
    .toLowerCase()
    .replace(/^web\//, "")
    .replace(/^textures\//, "")
    .replace(/\.(png|ktx2)$/, "");

// textures.jsonl's names (the line's `name`, `path` or `file`), planet ones only
export function planetNames(text) {
  const out = new Set();
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const n = e.name ?? e.path ?? e.file;
    if (typeof n === "string" && isPlanetTexture(n)) out.add(nameOf(n));
  }
  return out;
}

const hex = (r, g, b) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
// the mean colour of a map, weighted by its alpha (an atmosphere gradient is
// clear where there's no air)
export async function meanColor(buffer) {
  const { data } = await sharp(buffer)
    .ensureAlpha()
    .resize(64, 64, { fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    w += a;
  }
  return w > 0 ? hex(r / w, g / w, b / w) : null;
}

// a cloud map as coverage in one channel: its alpha where it has one (`_CA`),
// else its brightness
export async function coveragePng(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const chan = meta.hasAlpha
    ? sharp(buffer).ensureAlpha().extractChannel(3)
    : sharp(buffer).greyscale();
  return chan.png().toBuffer();
}

const ext = (format) => (format === "ktx2" ? "ktx2" : "webp");
// a skin's file stem, as planetSkins.json names it (the tier's size and kind
// added at load: `<stem>-<w>.<webp|ktx2>`)
export const stemOf = (id, kind) => `textures/galaxy/planets/${id}/${kind}`;
export const fileOf = (id, kind, { w, format }) =>
  `${stemOf(id, kind)}-${w}.${ext(format)}`;

// One planet's maps at every tier. A map that isn't twice as wide as it is
// tall isn't a sphere's (the front end's globes may be pictures of one) and
// is skipped with its size, for the table to drop it.
export async function convertSkin({
  id,
  skin = {},
  images,
  outDir,
  encodeKtx2,
}) {
  const files = [];
  const skipped = [];
  const entry = { from: {} };
  const write = async (path, buf, tier) => {
    const abs = join(outDir, path.replace(/^textures\/galaxy\/planets\//, ""));
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, buf);
    files.push({ path, bytes: buf.length, tier });
  };
  const sphere = async (kind, buf) => {
    const { width, height } = await sharp(buf).metadata();
    if (width !== height * 2) {
      skipped.push({ kind, why: `${width}×${height}: not a sphere's map` });
      return null;
    }
    return width;
  };
  for (const kind of ["color", "normal", "clouds", "rings"]) {
    let src = images[kind];
    if (!src) continue;
    const srcW =
      kind === "rings"
        ? (await sharp(src).metadata()).width
        : await sphere(kind, src);
    if (!srcW) continue;
    if (kind === "color" && !skin.seas)
      src = await sharp(src).removeAlpha().png().toBuffer(); // (the alpha is smoothness: not a colour)
    if (kind === "normal") src = await normalPng(src);
    if (kind === "clouds") src = await coveragePng(src);
    for (const tier of TIERS) {
      const size = sizesFor(kind, tier);
      const w = Math.min(size.w, srcW); // (never larger than the game drew it)
      const h = kind === "rings" ? w : w / 2;
      const img = sharp(src).resize(w, h, { fit: "fill", kernel: "lanczos3" });
      if (size.format === "ktx2") {
        const { ktx2 } = await encodeKtx2(await img.png().toBuffer(), {
          role: kind === "normal" ? "normal" : "color",
          flipY: true,
        });
        await write(
          fileOf(id, kind, { w: size.w, format: "ktx2" }),
          ktx2,
          tier,
        );
      } else {
        await write(
          fileOf(id, kind, { w: size.w, format: "webp" }),
          await img
            .webp({ quality: kind === "color" ? 82 : 80, alphaQuality: 90 })
            .toBuffer(),
          tier,
        );
      }
    }
    entry[kind] = stemOf(id, kind);
  }
  if (!entry.color) return { entry: null, files, skipped };
  if (images.atmo) entry.atmo = await meanColor(images.atmo);
  for (const k of ["seamShift", "seas", "greenDown", "atmoScale", "ringsAt"])
    if (skin[k] !== undefined && (k !== "ringsAt" || entry.rings))
      entry[k] = skin[k];
  return { entry, files, skipped };
}

// the manifest's text: keys sorted, one planet a line's worth of indent
export function skinsJson(entries) {
  const sorted = Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((k) => [
        k,
        Object.fromEntries(
          Object.keys(entries[k])
            .sort()
            .map((f) => [f, entries[k][f]]),
        ),
      ]),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
