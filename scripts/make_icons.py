#!/usr/bin/env python3
"""Generate app icons: red toy plane on a bright sky background."""
import math
import os

from PIL import Image, ImageDraw

SS = 4      # supersample factor
BASE = 512  # master design size


def draw_scene(size):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)

    top = (121, 200, 242)
    bottom = (226, 244, 253)
    for y in range(size):
        t = y / size
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)

    s = size / BASE

    def sc(v):
        return v * s

    d.ellipse([sc(370), sc(55), sc(475), sc(160)], fill=(255, 223, 143))
    d.rectangle([0, sc(430), size, size], fill=(120, 201, 95))

    cx, cy = sc(250), sc(235)
    u = sc(150)
    ang = math.radians(-8)
    ca, sa = math.cos(ang), math.sin(ang)

    def rot(px, py):
        return cx + px * ca - py * sa, cy + px * sa + py * ca

    def poly(points, fill):
        d.polygon([rot(px, py) for px, py in points], fill=fill)

    poly([(-0.40 * u, -0.28 * u), (0.50 * u, -0.16 * u),
          (0.50 * u, -0.04 * u), (-0.40 * u, -0.14 * u)], (233, 211, 171))   # far wing

    poly([(-1.02 * u, 0.10 * u), (-0.52 * u, 0.06 * u),
          (-0.72 * u, -0.88 * u)], (214, 58, 47))                            # tail fin

    poly([(-1.15 * u, 0.12 * u), (-0.55 * u, 0.06 * u),
          (-0.55 * u, 0.20 * u), (-1.15 * u, 0.26 * u)], (255, 233, 201))    # stabilizer

    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    body_pts = [rot(px, py) for px, py in [
        (-1.05 * u, -0.38 * u), (1.05 * u, -0.38 * u),
        (1.05 * u, 0.38 * u), (-1.05 * u, 0.38 * u)]]
    md.polygon(body_pts, fill=255)
    tail_c = rot(-1.05 * u, 0)
    nose_c = rot(1.05 * u, 0)
    r = 0.38 * u
    md.ellipse([tail_c[0] - r, tail_c[1] - r, tail_c[0] + r, tail_c[1] + r], fill=255)
    md.ellipse([nose_c[0] - r, nose_c[1] - r, nose_c[0] + r, nose_c[1] + r], fill=255)
    red = Image.new("RGB", (size, size), (239, 75, 63))
    img.paste(red, (0, 0), mask)                                             # fuselage

    poly([(-0.50 * u, 0.08 * u), (0.62 * u, 0.18 * u),
          (0.62 * u, 0.34 * u), (-0.50 * u, 0.26 * u)], (255, 233, 201))     # near wing

    wx, wy = rot(0.34 * u, -0.06 * u)
    wr = 0.17 * u
    d.ellipse([wx - wr, wy - wr, wx + wr, wy + wr], fill=(191, 234, 255))    # window

    px_, py_ = rot(1.10 * u, 0)
    pr = 0.48 * u
    blur = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blur)
    bd.ellipse([px_ - 0.07 * u, py_ - pr, px_ + 0.07 * u, py_ + pr], fill=(70, 70, 85, 190))
    img.paste(blur, (0, 0), blur)                                            # propeller blur

    return img


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    # Both PWAs share one icon set; write to each build's icons/ so neither
    # goes stale when the artwork changes.
    outs = [os.path.join(here, "..", "icons"), os.path.join(here, "..", "cockpit", "icons")]
    master = draw_scene(BASE * SS).resize((BASE, BASE), Image.LANCZOS)
    for out in outs:
        os.makedirs(out, exist_ok=True)
        master.save(os.path.join(out, "icon-512.png"))
        master.resize((192, 192), Image.LANCZOS).save(os.path.join(out, "icon-192.png"))
        master.resize((180, 180), Image.LANCZOS).save(os.path.join(out, "icon-180.png"))
        print("icons written:", out, sorted(os.listdir(out)))


if __name__ == "__main__":
    main()
