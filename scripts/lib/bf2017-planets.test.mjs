import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOOKS } from "../../src/components/galaxy/bodies.js";
import {
  SEQUEL_WORLDS,
  SKINS,
  convertSkin,
  meanColor,
  nameOf,
  planFor,
  planetNames,
  sequelWorld,
  sizesFor,
  skinsJson,
} from "./bf2017-planets.mjs";

const sharp = createRequire(
  createRequire(import.meta.url).resolve("ndarray-pixels"),
)("sharp");
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "bf2017",
  "web",
  "textures",
  "levels",
  "space",
  "sb_endor_01",
  "planet",
);

describe("the planet skins table", () => {
  it("names only planets the site draws, and no sequel world", () => {
    for (const id of Object.keys(SKINS)) {
      expect(LOOKS[id], id).toBeTruthy();
      expect(sequelWorld(id), id).toBe(false);
      for (const w of SEQUEL_WORLDS)
        expect(JSON.stringify(SKINS[id]).includes(w), `${id} ${w}`).toBe(false);
      expect(SKINS[id].color, id).toBeTruthy();
    }
  });

  it("sizes each map by tier: none on low, KTX2 for the ultra colour and normal, clouds at half", () => {
    expect(sizesFor("color", "ultra")).toEqual({ w: 4096, format: "ktx2" });
    expect(sizesFor("normal", "high")).toEqual({ w: 2048, format: "webp" });
    expect(sizesFor("color", "mid")).toEqual({ w: 1024, format: "webp" });
    expect(sizesFor("clouds", "ultra")).toEqual({ w: 2048, format: "webp" });
    expect(sizesFor("color", "low")).toBeNull();
  });
});

describe("planFor", () => {
  const have = new Set([
    "levels/space/sb_endor_01/planet/t_planet_endor_01_cs",
    "levels/space/sb_endor_01/planet/t_planet_endor_01_n",
    "levels/space/sb_endor_01/planet/t_planet_endor_cloudes_01_c",
    "levels/space/sb_endor_01/planet/t_planet_endor_cloudes_02_c",
  ]);

  it("takes the one name a glob matches, and lists the rest as missing, never throwing", () => {
    const { fetch, missing } = planFor(SKINS.endor, have);
    expect(fetch).toEqual([
      {
        kind: "color",
        name: "levels/space/sb_endor_01/planet/t_planet_endor_01_cs",
      },
      {
        kind: "normal",
        name: "levels/space/sb_endor_01/planet/t_planet_endor_01_n",
      },
    ]);
    expect(missing.map((m) => m.kind)).toEqual(["clouds", "atmo"]);
    expect(missing[0].why).toMatch(/^ambiguous/); // (two cloud maps: the table must say which)
    expect(missing[1].why).toBe("not in the bucket yet");
    expect(planFor(SKINS.hoth, new Set())).toEqual({
      fetch: [],
      missing: [
        { kind: "color", why: "not in the bucket yet" },
        { kind: "normal", why: "not in the bucket yet" },
      ],
    });
    expect(() => planFor(undefined, undefined)).not.toThrow();
  });

  it("reads a leading */ as any folders, and falls back to the next glob", () => {
    const { fetch } = planFor(
      SKINS.hoth,
      new Set(["s2/objects/planets/hoth/t_planetfrontenhoth_01_ca"]),
    );
    expect(fetch).toEqual([
      {
        kind: "color",
        name: "s2/objects/planets/hoth/t_planetfrontenhoth_01_ca",
      },
    ]);
  });

  it("never takes a sequel world’s map", () => {
    expect(
      planFor(
        { color: ["*/t_planet_*_cs"] },
        new Set(["levels/space/sb_jakku_01/planet/t_planet_jakku_cs"]),
      ).fetch,
    ).toEqual([]);
  });
});

describe("the bucket’s list", () => {
  it("reads textures.jsonl’s planet names, lowercased, without the folder or the extension", () => {
    const text = [
      '{"name":"Levels/Space/SB_Endor_01/Planet/T_Planet_Endor_01_CS"}',
      '{"path":"web/textures/s2/objects/planets/hoth/t_planetfrontenhoth_01_ca.png"}',
      '{"name":"Characters/Hero/Luke/T_Luke_CS"}',
      "not json",
      "",
    ].join("\n");
    expect([...planetNames(text)]).toEqual([
      "levels/space/sb_endor_01/planet/t_planet_endor_01_cs",
      "s2/objects/planets/hoth/t_planetfrontenhoth_01_ca",
    ]);
    expect(nameOf("web/textures/a/b.ktx2")).toBe("a/b");
  });
});

describe("convertSkin", () => {
  it("writes the fixture’s colour and normal at every tier, and its manifest entry", async () => {
    const out = await mkdtemp(join(tmpdir(), "planets-"));
    try {
      const images = {
        color: await readFile(join(FIXTURE, "t_planet_endor_01_cs.png")),
        normal: await readFile(join(FIXTURE, "t_planet_endor_01_n.png")),
      };
      const encoded = [];
      const encodeKtx2 = async (png, opts) => {
        encoded.push(opts);
        return { ktx2: Buffer.from("KTX2 stand-in") };
      };
      const { entry, files, skipped } = await convertSkin({
        id: "endor",
        skin: { seamShift: 30 },
        images,
        outDir: out,
        encodeKtx2,
      });
      expect(skipped).toEqual([]);
      expect(entry).toEqual({
        from: {},
        color: "textures/galaxy/planets/endor/color",
        normal: "textures/galaxy/planets/endor/normal",
        seamShift: 30,
      });
      expect(files.map((f) => f.path)).toEqual([
        "textures/galaxy/planets/endor/color-1024.webp",
        "textures/galaxy/planets/endor/color-2048.webp",
        "textures/galaxy/planets/endor/color-4096.ktx2",
        "textures/galaxy/planets/endor/normal-1024.webp",
        "textures/galaxy/planets/endor/normal-2048.webp",
        "textures/galaxy/planets/endor/normal-4096.ktx2",
      ]);
      expect(encoded).toEqual([
        { role: "color", flipY: true },
        { role: "normal", flipY: true },
      ]);
      // (never larger than the game drew it; the colour's alpha, smoothness, dropped)
      const color = await sharp(
        join(out, "endor", "color-2048.webp"),
      ).metadata();
      expect([color.width, color.height, color.hasAlpha]).toEqual([
        64,
        32,
        false,
      ]);
      // (the normal's z rebuilt: a flat-ish normal points out, not at the 200 the drop's blue held)
      const { data } = await sharp(join(out, "endor", "normal-1024.webp"))
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[2]).toBeGreaterThan(230);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it("skips a map that is not a sphere’s, and writes no entry without a colour", async () => {
    const square = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#336699" },
    })
      .png()
      .toBuffer();
    const { entry, skipped } = await convertSkin({
      id: "hoth",
      images: { color: square },
      outDir: tmpdir(),
      encodeKtx2: async () => ({ ktx2: Buffer.alloc(1) }),
    });
    expect(entry).toBeNull();
    expect(skipped).toEqual([
      { kind: "color", why: "32×32: not a sphere's map" },
    ]);
  });

  it("reads an atmosphere gradient as its colour where it has air", async () => {
    const buf = Buffer.alloc(4 * 4 * 4);
    for (let i = 0; i < 16; i++)
      buf.set(i < 8 ? [0, 0, 0, 0] : [100, 150, 250, 255], i * 4);
    expect(
      await meanColor(
        await sharp(buf, { raw: { width: 4, height: 4, channels: 4 } })
          .png()
          .toBuffer(),
      ),
    ).toBe("#6496fa");
  });

  it("writes the manifest with its keys sorted", () => {
    expect(
      skinsJson({ naboo: { color: "c", atmo: "#fff" }, endor: { color: "c" } }),
    ).toBe(
      '{\n  "endor": {\n    "color": "c"\n  },\n  "naboo": {\n    "atmo": "#fff",\n    "color": "c"\n  }\n}\n',
    );
  });
});
