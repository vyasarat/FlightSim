# The world texture atlas: 2048 x 2048, a 4 x 4 grid of 512 px tiles, every one
# of them seamless. Authored procedurally -- periodic noise plus pattern -- so it
# is reproducible from this file alone:
#
#   python3 scripts/make_atlas.py            -> evidence/art/atlas.png
#   node scripts/make_atlas_webp.js          -> cockpit/textures/atlas.webp
#
# RGB is the natural colour of the material. The game never shows it raw: the
# shader divides each tile by its own mean colour and multiplies by the palette
# colour of whatever it is painted on, so the palette stays the palette and the
# tile only adds detail (art.js).
#
# ALPHA is the glaze mask: 255 = wall, 128 = glass. Glass takes the sky
# reflection, the sun glint and the lit windows at night. It never goes below
# 128 because a canvas premultiplies alpha, and near zero the colour is lost.
#
# The order is load-bearing: ART_LAYER in art.js names these slots.
import numpy as np
from PIL import Image
import os

T = 512
rng = np.random.default_rng(20260926)


def set_size(n):
    """Every helper reads T, X and Y at call time: the detail atlas is 256 px tiles."""
    global T, X, Y
    T = n
    Y, X = np.mgrid[0:T, 0:T]
OUT = os.path.join(os.path.dirname(__file__), "..", "evidence", "art", "atlas.png")
OUT_DETAIL = os.path.join(os.path.dirname(__file__), "..", "evidence", "art", "atlas-detail.png")


def pnoise(cells, seed):
    """Periodic value noise, T x T, `cells` lattice cells across (must divide T)."""
    r = np.random.default_rng(seed).random((cells, cells))
    u = np.arange(T) * cells / T
    i0 = np.floor(u).astype(int)
    f = u - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    a = r[np.ix_(i0, i0)]; b = r[np.ix_(i0, i1)]
    c = r[np.ix_(i1, i0)]; d = r[np.ix_(i1, i1)]
    fy = f[:, None]; fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(base, octaves, seed, gain=0.5):
    s, amp, tot = np.zeros((T, T)), 1.0, 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        if cells > T: break
        s += pnoise(cells, seed + o * 101) * amp
        tot += amp; amp *= gain
    return s / tot


def grain(seed, amp):
    return (np.random.default_rng(seed).random((T, T)) - 0.5) * amp


def col(c):
    return np.array(c, dtype=float)[None, None, :]


def blend(base, over, mask):
    m = mask[..., None]
    return base * (1 - m) + over * m


Y, X = np.mgrid[0:T, 0:T]


def rect(x0, y0, x1, y1, period=128):
    """Mask of a rectangle repeated every `period` px in both axes."""
    xm, ym = X % period, Y % period
    return ((xm >= x0) & (xm < x1) & (ym >= y0) & (ym < y1)).astype(float)


def scatter_discs(n, rmin, rmax, seed):
    """Wrapped random discs: returns (depth bowl, rim) fields."""
    r = np.random.default_rng(seed)
    bowl = np.zeros((T, T)); rim = np.zeros((T, T))
    for _ in range(n):
        cx, cy, rad = r.random() * T, r.random() * T, rmin + r.random() * (rmax - rmin)
        dx = (X - cx + T / 2) % T - T / 2
        dy = (Y - cy + T / 2) % T - T / 2
        d = np.sqrt(dx * dx + dy * dy) / rad
        bowl = np.maximum(bowl, np.clip(1 - d, 0, 1))
        rim = np.maximum(rim, np.exp(-((d - 1.0) / 0.12) ** 2))
    return bowl, rim


def rocks(n, rmin, rmax, seed):
    """Wrapped pebbles lit from the top-left: returns (coverage, shade)."""
    r = np.random.default_rng(seed)
    cov = np.zeros((T, T)); shade = np.zeros((T, T))
    for _ in range(n):
        cx, cy, rad = r.random() * T, r.random() * T, rmin + r.random() * (rmax - rmin)
        dx = (X - cx + T / 2) % T - T / 2
        dy = (Y - cy + T / 2) % T - T / 2
        d = np.sqrt((dx / 1.25) ** 2 + dy * dy) / rad
        inside = d < 1
        light = np.clip(0.55 - (dx + dy) / (rad * 2.4), 0, 1)
        cov = np.where(inside, 1, cov)
        shade = np.where(inside, light, shade)
    return cov, shade


# ---------------------------------------------------------------------------
def glass_facade():
    # 4 bays x 4 floors; each cell 128 px. Spandrel band, mullions, tinted glass.
    n = fbm(4, 4, 11)
    rgb = col([0.30, 0.45, 0.58]) + (n[..., None] - 0.5) * 0.16
    ym, xm = Y % 128, X % 128
    rgb = rgb + ((127 - ym) / 127.0 * 0.10)[..., None]           # brighter towards the top of each pane
    pane = (np.random.default_rng(12).random((4, 8)) - 0.5) * 0.12
    rgb = rgb + pane[Y // 128, X // 64][..., None]
    glaze = np.ones((T, T))
    spandrel = (ym < 22).astype(float)
    rgb = blend(rgb, col([0.22, 0.25, 0.30]) + grain(13, 0.04)[..., None], spandrel)
    mull = ((xm < 6) | ((xm >= 62) & (xm < 66))).astype(float)
    rgb = blend(rgb, col([0.78, 0.80, 0.83]), mull)
    slab = ((ym >= 22) & (ym < 25)).astype(float)
    rgb = blend(rgb, col([0.62, 0.64, 0.68]), slab)
    glaze = glaze * (1 - spandrel) * (1 - mull) * (1 - slab)
    return rgb, glaze


def brick_facade():
    # The wall is weathered brick COLOUR; the courses themselves are the detail
    # tile's (2 m), so they resolve at the car instead of smearing at 12 m.
    rgb = col([0.60, 0.31, 0.23]) + grain(22, 0.03)[..., None]
    rgb = rgb * (0.86 + fbm(4, 3, 23)[..., None] * 0.28)       # weathering
    soot = np.clip(fbm(16, 2, 24) - 0.5, 0, 1) * np.clip(1 - (Y % 128) / 128.0, 0, 1)
    rgb = rgb - soot[..., None] * 0.18                          # rain streaks under every sill
    glaze = np.zeros((T, T))
    # punched windows: stone lintel and sill, white frame, a cross mullion
    lintel = rect(36, 22, 92, 30); sill = rect(34, 100, 94, 105)
    rgb = blend(rgb, col([0.86, 0.82, 0.74]), np.maximum(lintel, sill))
    frame = rect(40, 30, 88, 100)
    rgb = blend(rgb, col([0.90, 0.90, 0.88]), frame)
    glass = rect(43, 33, 85, 97)
    cross = np.maximum(rect(62, 33, 66, 97), rect(43, 58, 85, 61))
    ym = Y % 128
    gcol = col([0.16, 0.20, 0.26]) + ((97 - ym) / 64.0 * 0.10)[..., None]
    rgb = blend(rgb, gcol, glass * (1 - cross))
    glaze = glass * (1 - cross)
    return rgb, glaze


def concrete_facade():
    n = fbm(4, 5, 31)
    rgb = col([0.74, 0.73, 0.70]) + (n[..., None] - 0.5) * 0.12 + grain(32, 0.04)[..., None]
    streak = fbm(16, 2, 33)
    rgb = rgb - (np.clip(streak - 0.55, 0, 1) * 0.25)[..., None]
    joint = (((X % 128) == 0) | ((Y % 128) == 0)).astype(float)
    rgb = blend(rgb, col([0.50, 0.50, 0.48]), joint)
    recess = rect(20, 34, 108, 94)
    rgb = blend(rgb, col([0.45, 0.45, 0.44]), recess)
    glass = rect(23, 37, 108, 94)
    mull = np.maximum(rect(64, 37, 67, 94), rect(23, 37, 108, 39))
    ym = Y % 128
    gcol = col([0.20, 0.26, 0.32]) + ((94 - ym) / 57.0 * 0.12)[..., None]
    g = glass * (1 - mull)
    rgb = blend(rgb, gcol, g)
    rgb = blend(rgb, col([0.30, 0.31, 0.33]), glass * mull)
    return rgb, g


def asphalt(paint):
    n = fbm(8, 5, 41)
    rgb = col([0.30, 0.30, 0.31]) + (n[..., None] - 0.5) * 0.16
    agg = np.random.default_rng(42).random((T, T))
    rgb = rgb + ((agg > 0.90) * 0.14 - (agg < 0.07) * 0.09)[..., None]
    patch = fbm(2, 3, 43)
    rgb = rgb * np.where(patch[..., None] > 0.62, 0.92, 1.0)     # darker repair patches
    crack = (np.abs(fbm(4, 4, 44) - 0.5) < 0.004) & (fbm(2, 2, 46) > 0.58)
    rgb = blend(rgb, col([0.13, 0.13, 0.14]), crack.astype(float))
    if paint:
        # One carriageway, 17.5 m across and 12 m along: a solid line at the
        # median edge, a dashed divider 7.5 m out (3 m of paint every 12 m, the
        # motorway rule), a solid edge line 15 m out, then the shoulder. The
        # wheel paths are worn darker and polished, the way a real lane is.
        m = T / 17.5                                   # px per metre across
        u = X / m
        for c in (1.9, 5.6, 9.4, 13.1):                # two wheel paths per lane
            rgb = rgb * (1 - 0.10 * np.exp(-((u - c) / 0.7) ** 2))[..., None]
        wear = np.clip(fbm(32, 3, 45) * 1.3 - 0.1, 0.55, 1)
        line = lambda a, b: ((u >= a) & (u < b)).astype(float)
        edge = np.maximum(line(0.25, 0.45), line(15.0, 15.2))
        dash = line(7.4, 7.6) * ((Y % T) < T * 3 / 12)
        rgb = blend(rgb, col([0.95, 0.95, 0.92]), np.maximum(edge, dash) * wear)
    return rgb, np.zeros((T, T))


def concrete():
    n = fbm(4, 5, 51)
    slab = np.random.default_rng(52).random((4, 4))[Y // 128, X // 128]
    rgb = col([0.72, 0.71, 0.68]) + (n[..., None] - 0.5) * 0.10 + ((slab - 0.5) * 0.06)[..., None]
    rgb = rgb + grain(53, 0.05)[..., None]
    joint = (((X % 128) < 2) | ((Y % 128) < 2)).astype(float)
    rgb = blend(rgb, col([0.48, 0.48, 0.46]), joint)
    stain = np.clip(fbm(8, 3, 54) - 0.62, 0, 1) * 1.2
    rgb = rgb - stain[..., None] * 0.2
    return rgb, np.zeros((T, T))


def grass():
    n = fbm(4, 5, 61)
    rgb = col([0.34, 0.54, 0.22]) + (n[..., None] - 0.5) * col([0.10, 0.14, 0.06]) * 3.0
    blades = np.random.default_rng(62).random((T, T))
    rgb = rgb + ((blades - 0.5) * 0.10)[..., None]
    clump = np.clip(fbm(16, 3, 63) - 0.55, 0, 1) * 3.5
    rgb = blend(rgb, col([0.20, 0.36, 0.13]), clump)
    dry = np.clip(fbm(4, 3, 64) - 0.58, 0, 1) * 3.0
    rgb = blend(rgb, col([0.55, 0.58, 0.30]), dry)
    return rgb, np.zeros((T, T))


def scrub():
    n = fbm(4, 5, 71)
    rgb = col([0.68, 0.60, 0.44]) + (n[..., None] - 0.5) * 0.14 + grain(72, 0.06)[..., None]
    bush = np.clip((fbm(16, 4, 73) - 0.60) * 6, 0, 1)
    shade = fbm(64, 2, 74)
    rgb = blend(rgb, col([0.40, 0.44, 0.25]) * (0.8 + shade[..., None] * 0.4), bush)
    cov, sh = rocks(40, 2, 5, 75)
    rgb = blend(rgb, col([0.55, 0.50, 0.44]) * (0.7 + sh[..., None] * 0.6), cov)
    return rgb, np.zeros((T, T))


def sand():
    n = fbm(4, 4, 81)
    rip = np.sin(2 * np.pi * (X * 6 + Y * 14) / T + fbm(4, 2, 82) * 6) * 0.5 + 0.5
    rgb = col([0.86, 0.78, 0.58]) + (n[..., None] - 0.5) * 0.14 + (rip[..., None] - 0.5) * 0.14
    rgb = rgb + grain(83, 0.07)[..., None]
    return rgb, np.zeros((T, T))


def mars():
    n = fbm(4, 6, 91)
    rgb = col([0.74, 0.40, 0.23]) + (n[..., None] - 0.5) * col([0.18, 0.12, 0.08]) * 1.4
    rgb = rgb + grain(92, 0.03)[..., None]
    dust = np.clip(fbm(8, 3, 93) - 0.6, 0, 1) * 2
    rgb = blend(rgb, col([0.84, 0.56, 0.36]), dust)
    cov, sh = rocks(22, 5, 13, 94)
    rgb = blend(rgb, col([0.42, 0.22, 0.14]) * (0.6 + sh[..., None] * 0.9), cov)
    return rgb, np.zeros((T, T))


def lunar():
    n = fbm(4, 6, 101)
    rgb = col([0.62, 0.62, 0.61]) + (n[..., None] - 0.5) * 0.16 + grain(102, 0.04)[..., None]
    bowl, rim = scatter_discs(26, 10, 46, 103)
    rgb = rgb - bowl[..., None] * 0.14 + rim[..., None] * 0.10
    cov, sh = rocks(14, 3, 7, 104)
    rgb = blend(rgb, col([0.50, 0.50, 0.50]) * (0.6 + sh[..., None] * 0.8), cov)
    return rgb, np.zeros((T, T))


def corrugated():
    ridge = np.sin(2 * np.pi * X / 16.0) * 0.5 + 0.5
    rgb = col([0.72, 0.74, 0.76]) * (0.80 + ridge[..., None] * 0.22)
    seam = ((Y % 256) < 3).astype(float)
    rgb = blend(rgb, col([0.45, 0.46, 0.48]), seam)
    rivet = (((X % 32) == 8) & ((Y % 256) >= 5) & ((Y % 256) < 8)).astype(float)
    rgb = blend(rgb, col([0.40, 0.40, 0.42]), rivet)
    streak = np.clip(fbm(32, 2, 111) - 0.5, 0, 1)[:, :] * np.clip(1 - (Y % 256) / 256.0, 0, 1)
    rgb = rgb - streak[..., None] * col([0.10, 0.14, 0.18]) * 0.8
    rgb = rgb * (0.95 + fbm(4, 3, 112)[..., None] * 0.1)
    return rgb, np.zeros((T, T))


def container():
    p = X % 32
    face = np.where(p < 10, 0.80, np.where(p < 14, 1.05, np.where(p < 26, 0.92, 0.66)))
    rgb = col([0.80, 0.80, 0.80]) * face[..., None]
    rail = ((Y < 16) | (Y >= 496)).astype(float)
    post = ((X < 14) | (X >= 498)).astype(float)
    rgb = blend(rgb, col([0.62, 0.62, 0.62]), np.maximum(rail, post))
    rod = ((((X - 200) % 512) < 5) | (((X - 312) % 512) < 5)) & (Y > 20) & (Y < 492)
    rgb = blend(rgb, col([0.55, 0.55, 0.55]), rod.astype(float))
    rust = np.clip(fbm(16, 4, 121) - 0.64, 0, 1) * 2.2
    rgb = blend(rgb, col([0.50, 0.32, 0.22]), rust)
    rgb = rgb + grain(122, 0.04)[..., None]
    return rgb, np.zeros((T, T))


def water_normal():
    h = np.zeros((T, T))
    waves = [(2, 1, 0.55, 0.0), (1, 3, 0.40, 1.7), (3, 2, 0.30, 3.1), (5, 1, 0.18, 5.2),
             (1, 5, 0.15, 2.4), (4, 4, 0.12, 0.8), (7, 3, 0.08, 4.4), (3, 8, 0.07, 1.1)]
    u, v = X / T * 2 * np.pi, Y / T * 2 * np.pi
    for fx, fy, amp, ph in waves:
        h += np.sin(u * fx + v * fy + ph) * amp
    # Only long swells. Fine noise here is what turns the sea to white specular
    # static from height (TUNE.water's own warning): every small facet catches
    # the sun. Steepness matches the old 128 px canvas map at bump 3.2.
    h += (fbm(2, 2, 131) - 0.5) * 0.5
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1))
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0))
    s = 12.8
    nx, ny, nz = -dx * s, -dy * s, np.ones((T, T))
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], axis=-1)
    return rgb, np.zeros((T, T))


def roof():
    n = fbm(4, 5, 141)
    rgb = col([0.56, 0.55, 0.53]) + (n[..., None] - 0.5) * 0.12
    gravel = np.random.default_rng(142).random((T, T))
    rgb = rgb + ((gravel - 0.5) * 0.16)[..., None]
    seam = (((Y % 128) < 2)).astype(float)
    rgb = blend(rgb, col([0.40, 0.40, 0.40]), seam)
    puddle = np.clip(fbm(8, 3, 143) - 0.64, 0, 1) * 2
    rgb = blend(rgb, col([0.42, 0.42, 0.42]), puddle)
    return rgb, np.zeros((T, T))


def deck():
    n = fbm(4, 4, 151)
    plate = np.random.default_rng(152).random((8, 4))[Y // 64, X // 128]
    rgb = col([0.50, 0.52, 0.54]) + (n[..., None] - 0.5) * 0.10 + ((plate - 0.5) * 0.14)[..., None]
    skid = np.random.default_rng(153).random((T, T))
    rgb = rgb + ((skid - 0.5) * 0.08)[..., None]
    weld = (((X % 128) < 3) | ((Y % 64) < 3)).astype(float)
    rgb = blend(rgb, col([0.30, 0.31, 0.32]), weld)
    scuff = np.clip(fbm(8, 4, 154) - 0.6, 0, 1) * 2
    rgb = blend(rgb, col([0.36, 0.36, 0.37]), scuff)
    return rgb, np.zeros((T, T))


TILES = [
    glass_facade, brick_facade, concrete_facade, lambda: asphalt(True),
    concrete, grass, scrub, sand,
    mars, lunar, corrugated, container,
    water_normal, lambda: asphalt(False), roof, deck,
]

set_size(512)
atlas = np.zeros((T * 4, T * 4, 4), dtype=np.uint8)
for i, fn in enumerate(TILES):
    rgb, glaze = fn()
    r, c = divmod(i, 4)
    atlas[r * T:(r + 1) * T, c * T:(c + 1) * T, :3] = np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8)
    atlas[r * T:(r + 1) * T, c * T:(c + 1) * T, 3] = np.clip(255 - glaze * 127 + 0.5, 128, 255).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(atlas, "RGBA").save(OUT)
print("wrote", OUT)


# ---------------------------------------------------------------------------
# THE DETAIL ATLAS: 1024 x 1024, sixteen 256 px tiles of pure material grain,
# each authored at a REAL size (art.js ART_DETAIL says which): brick courses
# at 2 m, aggregate at 2 m, corrugation at 1 m... Laid over the big tiles close
# up, as luminance only, so a brick wall has courses at the car and a container
# has ridges at the boat without the big tile having to be tiny.
def d_brick():          # 2 m: 215 x 65 mm bricks, 10 mm joints, running bond
    ppm = T / 2.0
    ch = 0.075 * ppm; cw = 0.225 * ppm
    row = np.floor(Y / ch)
    off = (row % 2) * cw / 2
    bx = np.floor((X + off) / cw)
    tone = np.random.default_rng(301).random(4096)[((row * 37 + bx) % 4096).astype(int)]
    v = 0.62 + (tone - 0.5) * 0.30 + grain(302, 0.10)
    joint = ((Y % ch) < 0.012 * ppm) | (((X + off) % cw) < 0.012 * ppm)
    v = np.where(joint, 0.92, v)
    return v


def d_concrete():       # 2 m: pores, form-tie holes, trowel marks
    v = 0.62 + (fbm(8, 4, 311) - 0.5) * 0.25 + grain(312, 0.12)
    pore = np.random.default_rng(313).random((T, T)) < 0.004
    return np.where(pore, 0.30, v)


def d_asphalt():        # 2 m: aggregate
    v = 0.50 + grain(321, 0.40) + (fbm(16, 3, 322) - 0.5) * 0.25
    stone = np.random.default_rng(323).random((T, T))
    v = v + (stone > 0.94) * 0.35 - (stone < 0.05) * 0.25
    return v


def d_ribs():           # 1 m: four trapezoidal ribs
    p = (X % (T // 4)) / (T / 4.0)
    return np.where(p < 0.30, 0.62, np.where(p < 0.40, 0.95, np.where(p < 0.80, 0.72, 0.40))) + grain(331, 0.05)


def d_nonskid():        # 1 m: the carrier deck's grit, and scuffs
    v = 0.60 + grain(341, 0.35) + (fbm(8, 3, 342) - 0.5) * 0.30
    return v


def d_grass():          # 2 m: blades and clumps
    v = 0.55 + grain(351, 0.45) + (fbm(32, 3, 352) - 0.5) * 0.5
    return v


def d_sand():           # 2 m: grain and wind ripples
    rip = np.sin(2 * np.pi * (X * 5 + Y * 2) / T + fbm(4, 2, 361) * 4) * 0.5 + 0.5
    return 0.60 + grain(362, 0.25) + (rip - 0.5) * 0.25


def d_dirt():           # 2 m: scrub ground, twigs and grit
    return 0.58 + grain(371, 0.35) + (fbm(16, 4, 372) - 0.5) * 0.45


def d_pebbles():        # 2 m: regolith pebbles
    cov, sh = rocks(60, 2, 7, 381)
    v = 0.60 + grain(382, 0.20) + (fbm(16, 3, 383) - 0.5) * 0.3
    return np.where(cov > 0, 0.25 + sh * 0.7, v)


def d_dust():           # 2 m: lunar fines and small craters
    bowl, rim = scatter_discs(10, 6, 22, 391)
    return 0.62 + grain(392, 0.22) - bowl * 0.25 + rim * 0.2


def d_gravel():         # 1 m: roof gravel
    return 0.55 + grain(401, 0.55) + (fbm(32, 2, 402) - 0.5) * 0.3


def d_stucco():         # 1 m
    return 0.64 + (fbm(16, 4, 411) - 0.5) * 0.35 + grain(412, 0.10)


def d_plate():          # 2 m: steel grain and rust bloom
    return 0.60 + (fbm(8, 4, 421) - 0.5) * 0.35 + grain(422, 0.10)


def d_flat():
    return np.full((T, T), 0.6)


DETAIL = [d_brick, d_concrete, d_asphalt, d_ribs, d_nonskid, d_grass, d_sand, d_dirt,
          d_pebbles, d_dust, d_gravel, d_stucco, d_plate, d_flat, d_flat, d_flat]

set_size(256)
det = np.zeros((T * 4, T * 4, 4), dtype=np.uint8)
for i, fn in enumerate(DETAIL):
    v = np.clip(fn(), 0, 1)
    r, c = divmod(i, 4)
    det[r * T:(r + 1) * T, c * T:(c + 1) * T, :3] = (v[..., None] * 255 + 0.5).astype(np.uint8)
    det[r * T:(r + 1) * T, c * T:(c + 1) * T, 3] = 255
Image.fromarray(det, "RGBA").save(OUT_DETAIL)
print("wrote", OUT_DETAIL)
