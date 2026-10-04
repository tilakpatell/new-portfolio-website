"""Builds the universe map's models into public/models/universe/.

They were made for this site with Meshy (meshy.ai) text-to-3D on the site
owner's account (meshy-6, remeshed to about 8k triangles, textured), from
these prompts, task ids in brackets:

  gaming        a grey 1989 handheld console, green screen, D-pad, red A/B   [01a10822-1032-7569-ac28-1337ee5af8ab]
  marvel        a gold gauntlet with six coloured gems                       [01a10822-1894-7737-b549-b2fb78ca2cff]
  breakingbad   a cream 1980s motorhome with a faded brown stripe            [01a10822-251d-75cb-a368-0d3ac9faae3e]
  music         a sitar, teak with ivory inlay, brass frets, gourd           [01a10822-332e-766f-8686-483e0782df4f]

and these, made by the site owner with Meshy (100k triangles and a 2048 px
texture each as they came), cut to what they're seen at:

  xwing-traffic  the X-wings flying by (x-wing-fighter.glb, the one you fly, from
                 public/models/meshy/, cut down for a crowd): 5k, 256 px
  slave1         Boba Fett's Slave I, a bounty hunter who comes by: 34k, 512 px
  venator        a Republic attack cruiser circling the Death Star: 14k, 1024 px
  optimus        Optimus Prime, on Cybertron's orbit: 8k, 512 px
  megatron       Megatron, across the orbit from him (200k as it came): 8k, 512 px
  mario          Mario, standing on the Game Boy world: 8k, 512 px
  piranha        a Piranha Plant in its pipe, on the same world: 6k, 512 px

and the Millennium Falcon you can fly, made by the site owner with Meshy
(Meshy_AI_Millennium_Falcon_1004193913, 2M triangles, 11.7 MB as it came):
it's cut to about 1% of its vertices (24k triangles: it's a few hundred
pixels across at most, behind the chase camera), its normal map keeping the
hull's detail, with 1024 px textures.

Each raw .glb (2.5-5 MB, 2K texture) is optimised with glTF Transform the
way the office's props are: meshopt geometry, a WebP texture no bigger than
it's ever seen (256 px: on the map each object is a moon a few dozen pixels
across, a couple of hundred at most when its planet is selected).

Run: python3 scripts/build-universe.py <folder with gaming.glb, marvel.glb, ...>   (needs npx)
(each named as above: the crowd's X-wing as xwing-traffic.glb, and so on)
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/models/universe'
NAMES = ['gaming', 'marvel', 'breakingbad', 'music']
# name: (texture px, simplify ratio or None, how far the simplifier may move the surface)
OPTIONS = {
    'falcon': (1024, 0.012),
    'xwing-traffic': (256, 0.05),
    'slave1': (512, 0.08),  # stops at about 34k: its texture seams won't come down further (one at a time, so it's fine)
    'venator': (1024, 0.08),
    'optimus': (512, 0.08),
    'megatron': (512, 0.04),
    'mario': (512, 0.08),
    'piranha': (512, 0.06),
}


def main():
    src = pathlib.Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for name in NAMES + list(OPTIONS):
        if not (src / f'{name}.glb').exists():
            print(f'skipping {name}: no {name}.glb in {src}')
            continue
        out = OUT / f'{name}.glb'
        size, ratio, error = (*OPTIONS.get(name, (256, None)), 0.02)[:3]
        simplify = ['--simplify-ratio', str(ratio), '--simplify-error', str(error)] if ratio else ['--simplify', 'false']
        cmd = ['npx', '--yes', '@gltf-transform/cli@4', 'optimize', str(src / f'{name}.glb'), str(out),
               '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', str(size),
               *simplify, '--palette', 'false', '--join', 'false', '--flatten', 'false']
        subprocess.run(cmd, check=True, cwd=ROOT)
        print(f'{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
