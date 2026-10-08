# Fonts

**Version** every `@fontsource/*` and `@fontsource-variable/*` package in `package.json`, each at the version its row in [README.md](README.md) gives · **Page owner** `src/theme/` · **Decision** none recorded

## What it is, and why it is here

Fontsource packages each web font as npm files: the font in WOFF2 and a CSS file per weight that declares it. The site serves its fonts itself from the build rather than from a font service, so no visitor’s browser asks a third party for them and a font is versioned like any other dependency.

## Where it is used

The census rows are in [README.md](README.md), one per font. The entry points:

- `src/main.jsx`: the shell’s two faces, always loaded, Archivo (variable, width axis) and JetBrains Mono.
- `src/theme/ThemeProvider.jsx`: each fan theme’s face, loaded the first time its theme is on.
- A world’s own face, imported by the world itself (`src/components/minecraft/Minecraft.jsx`, `src/pages/MiddleEarth.jsx` and the others the census lists).
- `tailwind.config.js`: `sans` and `mono` name the shell’s two faces.

## How the site uses it

- **Import the weight, not the family.** A file imports `@fontsource/<font>/<weight>.css` for each weight it draws, so only those weights are bundled.
- **The shell’s faces load up front; everything else waits.** A theme’s face is a dynamic `import()` in `src/theme/ThemeProvider.jsx`; a world’s face comes with the world’s own chunk; an occasional face is imported where it is first needed (`src/components/interests/cards.jsx`).
- **Credits come from `package.json`.** `scripts/credits.mjs` lists every `@fontsource` package under fonts in CREDITS.md, by the display name in its `FONT_NAMES` table.
- **Noto Sans Runic is a source, not a font served.** It is a dev dependency: `scripts/build-durin-runes.py` takes its glyphs, maps Latin letters onto the Anglo-Saxon runes and writes the renamed font to `public/fonts/durin-runes/`, as its licence asks; `src/styles/extras.css` declares it as Durin Runes.

## What the site does not use, and why

- **Google Fonts or another font service**: a request to a third party on every page, and a font that can change under the site.
- **Every weight of a family**: each file imports the weights it draws.
- **Fontsource for every face**: Aurebesh and the other invented scripts under `public/fonts/` come from their own makers, with their licences beside them.

## Rules

- A new font gets its row through the census and its display name in `FONT_NAMES` in `scripts/credits.mjs`, or CREDITS.md shows its package id (nothing measures the second; `stack-pages` measures the first).
- A face only a theme or a world draws is loaded with that theme or world, never from `src/main.jsx` (nothing measures it; the build’s entry chunk grows if it is broken).

## Upgrading

```
npm install @fontsource/<font>@<version>
npm run build
node scripts/autopilot-check.mjs --only smoke
```

A font upgrade can change metrics (line height, advance widths), so look at the pages that use the face. Rebuild Durin Runes with `python3 scripts/build-durin-runes.py` after an upgrade of `@fontsource/noto-sans-runic`. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **The variable font has a different package name.** Archivo is `@fontsource-variable/archivo`, and its CSS file is named for its axis (`wdth.css`), not for a weight; its family is `"Archivo Variable"` (`tailwind.config.js`).
- **Runes fall through for digits and punctuation.** Durin Runes maps letters only; the next font in the CSS stack draws the rest (`scripts/build-durin-runes.py`’s docstring).
