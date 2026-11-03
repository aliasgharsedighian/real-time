"""Rasterize the temporary SVG icon using system librsvg/cairo (no pip packages).

Run from any directory: python3 frontend/scripts/generate-pwa-icons.py
Replace public/favicon.svg after logo selection and run again.
"""
from pathlib import Path
import ctypes as c
import ctypes.util
import struct

root = Path(__file__).resolve().parents[1] / "public"
icons = root / "icons"
icons.mkdir(exist_ok=True)
svg = (root / "favicon.svg").read_text()

cairo = c.CDLL(ctypes.util.find_library("cairo"))
rsvg = c.CDLL(ctypes.util.find_library("rsvg-2"))
gobject = c.CDLL(ctypes.util.find_library("gobject-2.0"))


class Rectangle(c.Structure):
    _fields_ = [(name, c.c_double) for name in ("x", "y", "width", "height")]


cairo.cairo_image_surface_create.argtypes = [c.c_int, c.c_int, c.c_int]
cairo.cairo_image_surface_create.restype = c.c_void_p
cairo.cairo_create.argtypes = [c.c_void_p]
cairo.cairo_create.restype = c.c_void_p
cairo.cairo_surface_write_to_png.argtypes = [c.c_void_p, c.c_char_p]
cairo.cairo_surface_write_to_png.restype = c.c_int
cairo.cairo_destroy.argtypes = [c.c_void_p]
cairo.cairo_surface_destroy.argtypes = [c.c_void_p]
rsvg.rsvg_handle_new_from_data.argtypes = [c.c_char_p, c.c_size_t, c.c_void_p]
rsvg.rsvg_handle_new_from_data.restype = c.c_void_p
rsvg.rsvg_handle_render_document.argtypes = [c.c_void_p, c.c_void_p, c.POINTER(Rectangle), c.c_void_p]
rsvg.rsvg_handle_render_document.restype = c.c_int
gobject.g_object_unref.argtypes = [c.c_void_p]


def render(size, target, maskable=False):
    source = svg
    if maskable:
        # Keep the full symbol within the central safe circle, with opaque edges.
        source = source.replace('<g id="mark">', '<g id="mark" transform="translate(64 64) scale(.75)">')
    data = source.encode()
    handle = rsvg.rsvg_handle_new_from_data(data, len(data), None)
    if not handle:
        raise RuntimeError("Cannot read SVG")
    surface = cairo.cairo_image_surface_create(0, size, size)
    context = cairo.cairo_create(surface)
    try:
        if not rsvg.rsvg_handle_render_document(handle, context, c.byref(Rectangle(0, 0, size, size)), None):
            raise RuntimeError("Cannot render SVG")
        if cairo.cairo_surface_write_to_png(surface, str(target).encode()) != 0:
            raise RuntimeError(f"Cannot write {target}")
    finally:
        cairo.cairo_destroy(context)
        cairo.cairo_surface_destroy(surface)
        gobject.g_object_unref(handle)


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
