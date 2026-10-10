// A close-up layer for the worlds' models. A model's own maps are made to
// be seen whole: a 40 m hall on one 2K map is a few texels a hand's width,
// and up close it smears. So the models that want it (a catalogue entry's
// `detail`: 'stone', 'adobe', 'metal'…) wear one of the kit's photo-scanned
// surfaces (public/cc0/galaxy/, the same the built props wear) over their
// own, laid on in the world, not the model's UVs: projected from the three
// axes and blended by which way the surface faces (triplanar), at the
// scan's real size, so a wall shows the grain and joints of real stone
// whatever its UVs, at any scale it's placed. The scan's colour, centred on
// 1, darkens and lightens the model's own (a stain stays a stain); its
// normal map adds the relief on top of the model's.
//
//   withDetail(material, { map, normalMap }, { metres, strength, normal, mean })
//     metres:   how much world one repeat of the scan covers
//     strength: how much of the scan's colour comes through (0…1)
//     normal:   how strong its relief is
//     mean:     the scan's mean brightness, sRGB (scripts/galaxy-textures.mjs
//               centres them there)
// Once per material (the clones of a model share theirs). Lit materials only.

// (now the site's one core kit, lib/three/core: every world wears the same
// scans the same way)
export { wear as withDetail } from '../../../lib/three/coreNodes';
