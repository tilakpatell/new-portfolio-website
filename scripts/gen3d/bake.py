"""The high-poly model baked onto a low-poly one, in Blender (headless):

    blender --background --python scripts/gen3d/bake.py -- RAW.glb OUT.glb [--faces 24000] [--tex 2048]

The raw GLB (hundreds of thousands of triangles, its own atlas) is decimated
to --faces, unwrapped afresh and packed tight, and its base colour,
roughness, metalness and surface detail (as a normal map) are baked from the
raw mesh onto the new atlas with Cycles on the GPU. Simplifying the raw mesh
directly would drag its UVs into the atlas gutters; this way the low mesh
keeps the look of the high one. The result is a plain PBR GLB for web.mjs.
"""

import argparse
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("raw")
ap.add_argument("out")
ap.add_argument("--faces", type=int, default=24000)
ap.add_argument("--tex", type=int, default=2048)
ap.add_argument("--smooth", type=int, default=2, help="smoothing passes over the raw mesh before the bake (its surface is lumpy at the voxel scale)")
ap.add_argument("--cage", type=float, default=0.02, help="how far (in the model's extent) the bake looks for the high surface")
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.raw))
highs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not highs:
    sys.exit("no mesh in the GLB")
# one high mesh (the GLB may hold several primitives)
bpy.ops.object.select_all(action="DESELECT")
for o in highs:
    o.select_set(True)
bpy.context.view_layer.objects.active = highs[0]
if len(highs) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
high.name = "high"
extent = max(high.dimensions)
# one surface: an engine's GLB splits its vertices along every seam of its
# atlas (thousands of charts), and smoothing a surface split like that pulls
# each seam's two sides apart into a crack the bake's rays fall through: a
# black line down every one in the base colour, and a low mesh in thousands
# of pieces. Merged first (the UVs stay: they're the faces' corners').
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=extent * 1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
# the raw surface is lumpy at the voxel scale: a little smoothing takes the
# lumps out of the normal map and the silhouette, and leaves the panels
if args.smooth > 0:
    sm = high.modifiers.new("smooth", "SMOOTH")
    sm.factor = 0.5
    sm.iterations = args.smooth
    bpy.ops.object.modifier_apply(modifier="smooth")

# the low mesh: a copy, decimated, unwrapped afresh
low = high.copy()
low.data = high.data.copy()
low.name = "low"
bpy.context.scene.collection.objects.link(low)
bpy.ops.object.select_all(action="DESELECT")
low.select_set(True)
bpy.context.view_layer.objects.active = low
mod = low.modifiers.new("decimate", "DECIMATE")
mod.ratio = min(1.0, args.faces / max(1, len(low.data.polygons)))
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="decimate")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, correct_aspect=True, scale_to_bounds=False)
# packed tight, each chart at the same texel density: Smart UV Project's own
# packing left the charts in a twelfth of the texture
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, margin_method="SCALED", margin=0.002, shape_method="CONCAVE")
bpy.ops.object.mode_set(mode="OBJECT")
# smooth across gentle curves, sharp across real edges: flat panels stay flat
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
print(f"low: {len(low.data.polygons)} faces", flush=True)

# a material on the low mesh with an image for each map to bake into
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == backend or d.type == "CPU"
        if any(d.use and d.type == backend for d in prefs.devices):
            break
    except Exception:
        continue
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = extent * args.cage
scene.render.bake.max_ray_distance = extent * args.cage * 2
scene.render.bake.margin = 16

mat = bpy.data.materials.new("baked")
mat.use_nodes = True
nodes, links = mat.node_tree.nodes, mat.node_tree.links
bsdf = nodes["Principled BSDF"]
low.data.materials.clear()
low.data.materials.append(mat)
images = {}
for name, colorspace in (("base", "sRGB"), ("rough", "Non-Color"), ("metal", "Non-Color"), ("normal", "Non-Color")):
    img = bpy.data.images.new(f"baked_{name}", args.tex, args.tex, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    images[name] = img

bpy.ops.object.select_all(action="DESELECT")
high.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low


def bake(kind, name, **kw):
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = images[name]
    nodes.active = tex
    tex.select = True
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, use_clear=True, margin=16, **kw)
    print(f"baked {name}", flush=True)
    return tex


# base colour as the high material's own colour (no lighting), the rest as the shader sees them
t_base = bake("DIFFUSE", "base", pass_filter={"COLOR"})
t_rough = bake("ROUGHNESS", "rough")
# metalness isn't a bake type: swap each high material's metallic into its emission for one pass
swaps = []
for m in {s.material for s in high.material_slots if s.material}:
    if not m.use_nodes:
        continue
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        continue
    src = b.inputs["Metallic"].links[0].from_socket if b.inputs["Metallic"].links else None
    emis = b.inputs["Emission Color"]
    old = [(l.from_socket, l) for l in emis.links]
    for _, l in old:
        m.node_tree.links.remove(l)
    if src:
        m.node_tree.links.new(src, emis)
    else:
        emis.default_value = (b.inputs["Metallic"].default_value,) * 3 + (1.0,)
    strength = b.inputs["Emission Strength"]
    swaps.append((m, b, src, old, strength.default_value))
    strength.default_value = 1.0
t_metal = bake("EMIT", "metal")
for m, b, src, old, strength in swaps:
    emis = b.inputs["Emission Color"]
    for l in list(emis.links):
        m.node_tree.links.remove(l)
    for from_socket, _ in old:
        m.node_tree.links.new(from_socket, emis)
    b.inputs["Emission Strength"].default_value = strength
t_normal = bake("NORMAL", "normal", normal_space="TANGENT")

# wire the baked maps into the low material and export
links.new(t_base.outputs["Color"], bsdf.inputs["Base Color"])
links.new(t_rough.outputs["Color"], bsdf.inputs["Roughness"])
links.new(t_metal.outputs["Color"], bsdf.inputs["Metallic"])
nm = nodes.new("ShaderNodeNormalMap")
links.new(t_normal.outputs["Color"], nm.inputs["Color"])
links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
for img in images.values():
    img.pack()
bpy.ops.object.select_all(action="DESELECT")
low.select_set(True)
bpy.context.view_layer.objects.active = low
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=True, export_image_format="WEBP", export_image_quality=90, export_apply=True)
print(f"wrote {args.out}: {len(low.data.polygons)} faces, {args.tex}² maps", flush=True)
