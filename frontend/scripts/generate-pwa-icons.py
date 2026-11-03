"""Resize the selected BatGram PNG icon with system cairo (no pip packages).

Run from any directory: python3 frontend/scripts/generate-pwa-icons.py
Source: public/brand/app-icon.png. Generates all install/browser icons.
"""
from pathlib import Path
import ctypes as c
import ctypes.util
import struct
import base64

root = Path(__file__).resolve().parents[1] / "public"
icons = root / "icons"
icons.mkdir(exist_ok=True)
source_path = root / "brand" / "app-icon.png"
cairo = c.CDLL(ctypes.util.find_library("cairo"))
cairo.cairo_image_surface_create_from_png.argtypes = [c.c_char_p]
cairo.cairo_image_surface_create_from_png.restype = c.c_void_p
cairo.cairo_image_surface_create.argtypes = [c.c_int, c.c_int, c.c_int]
cairo.cairo_image_surface_create.restype = c.c_void_p
cairo.cairo_create.argtypes = [c.c_void_p]
cairo.cairo_create.restype = c.c_void_p
cairo.cairo_surface_status.argtypes = [c.c_void_p]
cairo.cairo_surface_status.restype = c.c_int
cairo.cairo_image_surface_get_width.argtypes = [c.c_void_p]
cairo.cairo_image_surface_get_width.restype = c.c_int
cairo.cairo_image_surface_get_height.argtypes = [c.c_void_p]
cairo.cairo_image_surface_get_height.restype = c.c_int
cairo.cairo_surface_write_to_png.argtypes = [c.c_void_p, c.c_char_p]
cairo.cairo_surface_write_to_png.restype = c.c_int
for name in ("cairo_destroy", "cairo_surface_destroy", "cairo_paint"):
    getattr(cairo, name).argtypes = [c.c_void_p]
cairo.cairo_set_source_rgb.argtypes = [c.c_void_p, c.c_double, c.c_double, c.c_double]
cairo.cairo_translate.argtypes = [c.c_void_p, c.c_double, c.c_double]
cairo.cairo_scale.argtypes = [c.c_void_p, c.c_double, c.c_double]
cairo.cairo_set_source_surface.argtypes = [c.c_void_p, c.c_void_p, c.c_double, c.c_double]

source = cairo.cairo_image_surface_create_from_png(str(source_path).encode())
if cairo.cairo_surface_status(source) != 0:
    raise RuntimeError("Cannot read source PNG")
width = cairo.cairo_image_surface_get_width(source)
height = cairo.cairo_image_surface_get_height(source)


def render(size, target, maskable=False):
    surface = cairo.cairo_image_surface_create(0, size, size)
    context = cairo.cairo_create(surface)
    try:
        cairo.cairo_set_source_rgb(context, 5/255, 10/255, 18/255)
        cairo.cairo_paint(context)
        # Maskable symbols fit inside the central 80% safe circle. The
        # diagonal of a .56-width square is < .8 of the full icon diameter.
        scale = size * (0.56 if maskable else 1) / max(width, height)
        cairo.cairo_translate(context, (size - width*scale)/2, (size - height*scale)/2)
        cairo.cairo_scale(context, scale, scale)
        cairo.cairo_set_source_surface(context, source, 0, 0)
        cairo.cairo_paint(context)
        if cairo.cairo_surface_write_to_png(surface, str(target).encode()) != 0:
            raise RuntimeError(f"Cannot write {target}")
    finally:
        cairo.cairo_destroy(context)
        cairo.cairo_surface_destroy(surface)


# SVG favicon embeds the approved raster artwork, without redrawing the logo.
encoded = base64.b64encode(source_path.read_bytes()).decode()
(root / "favicon.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {width}">'
    f'<rect width="{width}" height="{width}" fill="#050A12"/>'
    f'<image y="{(width-height)/2}" width="{width}" height="{height}" href="data:image/png;base64,{encoded}"/>'
    '</svg>\n'
)

for size in (16, 32, 48):
    render(size, icons / f"favicon-{size}.png")
for size in (192, 512):
    render(size, icons / f"icon-{size}.png")
    render(size, icons / f"maskable-{size}.png", maskable=True)
render(180, root / "apple-touch-icon.png")

# ICO directory containing three PNG frames for browser/desktop compatibility.
frames = [(size, (icons / f"favicon-{size}.png").read_bytes()) for size in (16, 32, 48)]
header = struct.pack("<HHH", 0, 1, len(frames))
offset = 6 + 16 * len(frames)
entries = bytearray()
for size, data in frames:
    entries.extend(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
(root / "favicon.ico").write_bytes(header + entries + b"".join(data for _, data in frames))
print("Generated favicons, Apple Touch, PWA and maskable icons.")

cairo.cairo_surface_destroy(source)
