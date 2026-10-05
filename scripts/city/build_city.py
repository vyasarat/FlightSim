# The two block cities, generated in Blender (headless):
#
#   /Applications/Blender-4.2.app/Contents/MacOS/Blender -b -P scripts/city/build_city.py
#
# Reads scripts/city/site-{ny,ca}.json (the survey: node scripts/city/site.js)
# and writes:
#   cockpit/models/city-ny.glb, city-ca.glb   building types (LOD0 + LOD1) and
#                                              the ground: streets and sidewalks
#   cockpit/js/citydata.js                     the layout: every building's type,
#                                              place, turn and tint, and each
#                                              type's solid tiers
#
# The layout is JS, not GLB extras, on purpose: collision and the sparkle spots
# are registered synchronously at load (city.js), exactly as the old clusters
# were, and only the LOOK arrives asynchronously in the GLB.
#
# Everything is built in game coordinates (x east, y up, z south-ish) and turned
# into Blender's Z-up only at mesh creation; the glTF exporter turns it back.
# UV0 is the atlas tile coordinate in tiles (walls: along the wall from its left
# corner, and up from the building's base; roofs: world XZ), UV1.x the atlas
# slot, so one material and one draw call per building type.
import bpy
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# atlas slots (art.js ART_LAYER) and metres per tile
GLASS, BRICK, OFFICE, ROAD, CONC, CORR, ASPH, ROOF, DECK = 0, 1, 2, 3, 4, 10, 13, 14, 15
# metres per tile: MUST match art.js ART_LAYER_INFO, which is where the real
# sizes live -- these only bake the same numbers into the GLB's UVs
SCALE = {GLASS: (12, 14), BRICK: (12, 14), OFFICE: (12, 14), CONC: (4, 4), CORR: (4, 4),
         ASPH: (8, 8), ROOF: (8, 8), DECK: (8, 8), ROAD: (17.5, 12)}
FLOOR = 3.5

P = {  # the palette (TUNE.palette), the only colours a building may take
    "white": 0xf2f4f7, "steel": 0xc9ced6, "grey": 0x8a93a0, "slate": 0x3c4350, "night": 0x2f3a48,
    "concrete": 0x9a9ea6, "sand": 0xd9c27e, "rust": 0xb5522e, "gold": 0xd4a72c, "sea": 0x2f74b8,
    "blue": 0x2b4fb0, "red": 0xe0483e, "grassHigh": 0xa8a06b,
}


# ---------------------------------------------------------------------------
class Geo:
    """Flat-shaded faces with their own vertices, UV0 (tiles) and slot (UV1.x)."""

    def __init__(self):
        self.v, self.f, self.uv, self.lay = [], [], [], []
        self.tris = 0

    def face(self, pts, uvs, layer, normal=None):
        if normal is not None:
            # wind counter-clockwise seen from the normal side
            a, b, c = pts[0], pts[1], pts[2]
            e1 = [b[i] - a[i] for i in range(3)]
            e2 = [c[i] - a[i] for i in range(3)]
            n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
            if sum(n[i] * normal[i] for i in range(3)) < 0:
                pts, uvs = pts[::-1], uvs[::-1]
        i0 = len(self.v)
        self.v.extend(pts)
        self.uv.extend(uvs)
        self.lay.extend([layer] * len(pts))
        self.f.append(list(range(i0, i0 + len(pts))))
        self.tris += len(pts) - 2

    def wall(self, a, t, L, y0, y1, n, layer, base_y=0.0, u0=0.0):
        su, sv = SCALE[layer]
        p = [(a[0], y0, a[1]), (a[0] + t[0] * L, y0, a[1] + t[1] * L),
             (a[0] + t[0] * L, y1, a[1] + t[1] * L), (a[0], y1, a[1])]
        uv = [(u0 / su, (y0 - base_y) / sv), ((u0 + L) / su, (y0 - base_y) / sv),
              ((u0 + L) / su, (y1 - base_y) / sv), (u0 / su, (y1 - base_y) / sv)]
        self.face(p, uv, layer, (n[0], 0, n[1]))

    def top(self, x0, z0, x1, z1, y, layer, down=False):
        su, sv = SCALE[layer]
        p = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
        uv = [(q[0] / su, q[2] / sv) for q in p]
        self.face(p, uv, layer, (0, -1 if down else 1, 0))

    def box(self, cx, cz, w, d, y0, y1, wall, top=ROOF, base_y=0.0, bottom=False):
        x0, x1, z0, z1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2
        self.wall((x0, z1), (1, 0), w, y0, y1, (0, 1), wall, base_y)
        self.wall((x1, z0), (-1, 0), w, y0, y1, (0, -1), wall, base_y)
        self.wall((x1, z1), (0, -1), d, y0, y1, (1, 0), wall, base_y)
        self.wall((x0, z0), (0, 1), d, y0, y1, (-1, 0), wall, base_y)
        if top is not None:
            self.top(x0, z0, x1, z1, y1, top)
        if bottom:
            self.top(x0, z0, x1, z1, y0, top if top is not None else wall, down=True)

    def cyl(self, cx, cz, r, y0, y1, seg, wall, top=ROOF, base_y=0.0, r1=None):
        r1 = r if r1 is None else r1
        su, sv = SCALE[wall]
        arc = 2 * math.pi * r / seg
        for k in range(seg):
            a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
            p = [(cx + math.cos(a0) * r, y0, cz + math.sin(a0) * r), (cx + math.cos(a1) * r, y0, cz + math.sin(a1) * r),
                 (cx + math.cos(a1) * r1, y1, cz + math.sin(a1) * r1), (cx + math.cos(a0) * r1, y1, cz + math.sin(a0) * r1)]
            uv = [(k * arc / su, (y0 - base_y) / sv), ((k + 1) * arc / su, (y0 - base_y) / sv),
                  ((k + 1) * arc / su, (y1 - base_y) / sv), (k * arc / su, (y1 - base_y) / sv)]
            am = (a0 + a1) / 2
            self.face(p, uv, wall, (math.cos(am), 0, math.sin(am)))
        if top is not None and r1 > 0.01:
            st, sv2 = SCALE[top]
            p = [(cx + math.cos(2 * math.pi * k / seg) * r1, y1, cz + math.sin(2 * math.pi * k / seg) * r1) for k in range(seg)]
            self.face(p, [(q[0] / st, q[2] / sv2) for q in p], top, (0, 1, 0))


# ---------------------------------------------------------------------------
# Rooftop detail. Every building gets some: it is what a city looks like from
# a helicopter, and what flat-topped boxes never do.
def parapet(g, cx, cz, w, d, y, layer=CONC, h=1.2, t=0.6):
    g.box(cx, cz - d / 2 + t / 2, w, t, y, y + h, layer, CONC)
    g.box(cx, cz + d / 2 - t / 2, w, t, y, y + h, layer, CONC)
    g.box(cx - w / 2 + t / 2, cz, t, d - 2 * t, y, y + h, layer, CONC)
    g.box(cx + w / 2 - t / 2, cz, t, d - 2 * t, y, y + h, layer, CONC)


def hvac(g, rnd, cx, cz, w, d, y, n):
    for _ in range(n):
        bw, bd = rnd.choice([3, 4, 6]), rnd.choice([2, 3, 4])
        if bw > w - 4 or bd > d - 4:
            continue
        x = cx + (rnd.random() - 0.5) * (w - bw - 3)
        z = cz + (rnd.random() - 0.5) * (d - bd - 3)
        g.box(x, z, bw, bd, y, y + rnd.choice([1.6, 2.2, 3.0]), CORR, CORR)


def water_tank(g, cx, cz, y):
    for dx, dz in ((-1.4, -1.4), (1.4, -1.4), (-1.4, 1.4), (1.4, 1.4)):
        g.box(cx + dx, cz + dz, 0.4, 0.4, y, y + 3, CORR, None)
    g.cyl(cx, cz, 2.4, y + 3, y + 7.5, 8, CORR, None)
    g.cyl(cx, cz, 2.6, y + 7.5, y + 9.3, 8, CORR, CORR, r1=0.15)


def antenna(g, cx, cz, y, h):
    g.box(cx, cz, 0.6, 0.6, y, y + h, CONC, CONC)


# ---------------------------------------------------------------------------
# Building types. Each returns (LOD0 geo, LOD1 geo, tiers, height, footprint).
# Footprints are whole 3 m bays and tiers whole 3.5 m floors, so the window
# grid lands on the corners and the floors line up with the base.
PLINTH = -6.0   # every building runs down into the ground: terrain is not flat


def tiered(rnd, tiers, wall, name, crown=None, tank=False, rooftop=True, base_wall=None):
    """tiers: [(w, d, floors)] bottom-up, centred. Returns the type record."""
    g, lo = Geo(), Geo()
    y = 0.0
    solids = []
    for i, (w, d, fl) in enumerate(tiers):
        y1 = y + fl * FLOOR
        y0 = PLINTH if i == 0 else y
        wl = base_wall if (i == 0 and base_wall is not None) else wall
        g.box(0, 0, w, d, y0, y1, wl, ROOF)
        lo.box(0, 0, w, d, y0, y1, wl, ROOF)
        solids.append((0, 0, w / 2, d / 2, 0 if i == 0 else y, y1))
        # the cornice at every setback: a ledge that catches the light
        g.box(0, 0, w + 0.8, d + 0.8, y1 - 0.6, y1 + 0.2, CONC, CONC)
        y = y1
    w, d, _ = tiers[-1]
    if rooftop:
        parapet(g, 0, 0, w, d, y)
        hvac(g, rnd, 0, 0, w, d, y, 2 + int(w * d / 400))
        if tank:
            water_tank(g, rnd.choice([-1, 1]) * (w / 2 - 4), rnd.choice([-1, 1]) * (d / 2 - 4), y)
    top = y
    # the crown's solids, in the tiers' own form, so city.js registers them where
    # they are drawn (v139: a helicopter settled INSIDE an unregistered crown)
    crowns = []
    if crown == "spire":
        crowns = [(0, 0, 4.5, 4.5, y, y + 7), (0, 0, 3, 3, y + 7, y + 12), (0, 0, 1, 1, y + 12, y + 26)]
    elif crown == "mast":
        crowns = [(0, 0, w * 0.25, d * 0.25, y, y + 5), (0, 0, 0.4, 0.4, y + 5, y + 23)]
    elif crown == "slope":
        crowns = [(0, 0, w * 0.35, d * 0.35, y, y + 4), (0, 0, w * 0.2, d * 0.2, y + 4, y + 8)]
    if crown == "spire":
        g.box(0, 0, 9, 9, y, y + 7, OFFICE, CONC)
        g.box(0, 0, 6, 6, y + 7, y + 12, OFFICE, CONC)
        g.cyl(0, 0, 1.4, y + 12, y + 30, 6, CONC, None, r1=0.2)
        lo.box(0, 0, 9, 9, y, y + 12, OFFICE, CONC)
        top = y + 30
    elif crown == "mast":
        g.box(0, 0, w * 0.5, d * 0.5, y, y + 5, CORR, CORR)
        antenna(g, 0, 0, y + 5, 18)
        top = y + 23
    elif crown == "slope":
        # a glass crown: a stepped-back cap, then a lit top box
        g.box(0, 0, w * 0.7, d * 0.7, y, y + 4, GLASS, ROOF)
        g.box(0, 0, w * 0.4, d * 0.4, y + 4, y + 8, GLASS, ROOF)
        lo.box(0, 0, w * 0.7, d * 0.7, y, y + 8, GLASS, ROOF)
        top = y + 8
    return {"name": name, "lod0": g, "lod1": lo, "tiers": solids, "height": top,
            "w": tiers[0][0], "d": tiers[0][1], "crown": crowns}


def round_tower(rnd, r, floors, name):
    g, lo = Geo(), Geo()
    h = floors * FLOOR
    g.cyl(0, 0, r, PLINTH, h, 16, GLASS, ROOF)
    g.cyl(0, 0, r + 0.4, h - 0.6, h + 0.3, 16, CONC, CONC)
    g.cyl(0, 0, r * 0.55, h, h + 6, 12, GLASS, ROOF)
    g.box(0, 0, 3, 3, h + 6, h + 9, CORR, CORR)
    lo.cyl(0, 0, r, PLINTH, h + 6, 8, GLASS, ROOF)
    return {"name": name, "lod0": g, "lod1": lo, "tiers": [(0, 0, r * 0.92, r * 0.92, 0, h + 6)],
            "height": h + 9, "w": 2 * r, "d": 2 * r, "crown": [(0, 0, 1.5, 1.5, h + 6, h + 9)]}


def parking(rnd, w, d, floors, name):
    g, lo = Geo(), Geo()
    h = floors * 3.0
    for k in range(floors + 1):
        y = k * 3.0
        g.box(0, 0, w, d, y - 0.5 if k else PLINTH, y + 0.4, CONC, CONC)   # slabs
    for sx in (-1, 1):
        for sz in (-1, 1):
            g.box(sx * (w / 2 - 1), sz * (d / 2 - 1), 1.2, 1.2, 0, h, CONC, None)
    g.box(0, 0, w * 0.9, d * 0.9, 0, h - 0.5, OFFICE, None)   # the dark interior behind the slabs
    lo.box(0, 0, w, d, PLINTH, h + 0.4, CONC, CONC)
    return {"name": name, "lod0": g, "lod1": lo, "tiers": [(0, 0, w / 2, d / 2, 0, h + 0.4)],
            "height": h + 0.4, "w": w, "d": d}


def ny_types(rnd):
    T = []
    # walk-ups and tenements: brick, cornices, water tanks
    for fl, w in ((4, 12), (5, 12), (6, 15), (5, 18)):
        T.append(("low", tiered(rnd, [(w, 18, fl)], BRICK, f"walkup{fl}_{w}", tank=rnd.random() < 0.7), ["rust", "rust", "concrete", "grey", "grassHigh"]))
    for fl in (8, 10):
        T.append(("low", tiered(rnd, [(24, 21, fl)], BRICK, f"tenement{fl}", tank=True), ["rust", "concrete", "grey"]))
    # pre-war midrise: limestone, one setback, a tank
    for fl, fl2 in ((12, 4), (15, 5)):
        T.append(("mid", tiered(rnd, [(27, 24, fl), (21, 18, fl2)], OFFICE, f"prewar{fl}", tank=True, base_wall=BRICK), ["sand", "white", "steel", "concrete"]))
    # post-war slabs
    T.append(("mid", tiered(rnd, [(42, 21, 18)], OFFICE, "slab18", crown="mast"), ["white", "steel", "concrete"]))
    T.append(("mid", tiered(rnd, [(36, 24, 22)], GLASS, "glassslab22"), ["steel", "grey", "sea"]))
    # art-deco setback towers
    T.append(("core", tiered(rnd, [(36, 33, 10), (27, 27, 18), (18, 18, 8)], OFFICE, "deco36", crown="spire", base_wall=BRICK), ["sand", "white", "steel"]))
    T.append(("core", tiered(rnd, [(33, 30, 8), (24, 24, 22), (15, 15, 10)], OFFICE, "deco44", crown="spire"), ["white", "sand", "grey"]))
    # glass towers
    T.append(("core", tiered(rnd, [(30, 30, 38)], GLASS, "glass38", crown="slope"), ["steel", "sea", "grey", "night"]))
    T.append(("core", tiered(rnd, [(33, 27, 30), (27, 21, 16)], GLASS, "glass46", crown="mast"), ["steel", "grey", "sea"]))
    T.append(("core", round_tower(rnd, 14, 34, "round34"), ["steel", "sea"]))
    T.append(("core", tiered(rnd, [(30, 27, 14), (24, 21, 12)], BRICK, "brickdeco26", crown="spire", tank=True), ["rust", "concrete"]))
    T.append(("core", tiered(rnd, [(27, 27, 26)], OFFICE, "office26", crown="mast"), ["white", "steel", "grey"]))
    T.append(("core", tiered(rnd, [(36, 30, 6), (30, 24, 26)], GLASS, "glass32b", crown="slope", base_wall=OFFICE), ["night", "steel", "grey"]))
    T.append(("mid", tiered(rnd, [(30, 21, 14)], BRICK, "loft14", tank=True), ["rust", "concrete", "grey"]))
    # the hero: an Empire-State stack round the old spire, which pokes out of it
    T.append(("hero", tiered(rnd, [(51, 42, 6), (42, 33, 18), (30, 24, 14), (18, 18, 4)], OFFICE, "hero", base_wall=OFFICE, rooftop=False), ["sand"]))
    return T


def ca_types(rnd):
    T = []
    # low: stucco and concrete, flat roofs crowded with plant
    for fl, w, d in ((2, 24, 27), (3, 30, 24), (4, 21, 21)):
        T.append(("low", tiered(rnd, [(w, d, fl)], CONC, f"stucco{fl}", tank=False), ["white", "sand", "steel", "grassHigh"]))
    T.append(("low", parking(rnd, 36, 45, 5, "garage5"), ["concrete", "steel"]))
    T.append(("mid", tiered(rnd, [(36, 24, 12)], OFFICE, "office12", crown="mast"), ["white", "sand", "steel"]))
    T.append(("mid", tiered(rnd, [(30, 30, 18)], OFFICE, "office18"), ["white", "steel", "concrete"]))
    T.append(("mid", tiered(rnd, [(33, 24, 20)], GLASS, "glass20", crown="slope"), ["sea", "steel", "grey"]))
    T.append(("core", tiered(rnd, [(33, 33, 32)], GLASS, "glass32", crown="slope"), ["sea", "steel", "night"]))
    T.append(("core", tiered(rnd, [(36, 30, 24), (27, 24, 16)], GLASS, "glass40", crown="mast"), ["steel", "grey", "sea"]))
    T.append(("core", round_tower(rnd, 17, 42, "round42"), ["steel", "sea"]))
    T.append(("core", tiered(rnd, [(39, 33, 14), (30, 27, 20), (21, 21, 12)], OFFICE, "stack46", crown="slope"), ["white", "sand", "steel"]))
    T.append(("hero", tiered(rnd, [(42, 42, 20), (36, 36, 24), (30, 30, 14)], GLASS, "hero", crown="mast"), ["sea"]))
    return T


# ---------------------------------------------------------------------------
class Site:
    def __init__(self, path):
        d = json.load(open(path))
        self.__dict__.update(d)

    def at(self, x, z):
        i = int((x - self.x0) // self.cell)
        j = int((z - self.z0) // self.cell)
        if i < 0 or j < 0 or i >= self.nx or j >= self.nz:
            return 1
        return self.blocked[j * self.nx + i]

    def free_rect(self, x0, z0, x1, z1, margin=0.0):
        x, step = x0 - margin, self.cell / 2
        while x <= x1 + margin:
            z = z0 - margin
            while z <= z1 + margin:
                if self.at(x, z):
                    return False
                z += step
            x += step
        return True

    def free_frac(self, x0, z0, x1, z1):
        n = f = 0
        x = x0
        while x <= x1:
            z = z0
            while z <= z1:
                n += 1
                f += 0 if self.at(x, z) else 1
                z += self.cell
            x += self.cell
        return f / max(1, n)


def layout(site, types, cfg, rnd):
    """Streets, block pads and building placements for one city."""
    ground = Geo()
    placed = []          # [type_index, x, z, rot, tint]
    taken = []           # footprints already used: (x0, z0, x1, z1)
    X0, X1 = site.x0, site.x0 + site.nx * site.cell
    Z0, Z1 = site.z0, site.z0 + site.nz * site.cell
    ax, az = cfg["core"]
    xs = [cfg["x_origin"] + k * cfg["x_step"] for k in range(-30, 30)]
    zs = [cfg["z_origin"] + k * cfg["z_step"] for k in range(-30, 30)]
    xs = [x for x in xs if X0 - cfg["x_step"] < x < X1 + cfg["x_step"]]
    zs = [z for z in zs if Z0 - cfg["z_step"] < z < Z1 + cfg["z_step"]]
    aw, sw = cfg["avenue_w"], cfg["street_w"]
    SUB = 9.0

    def zone(x, z):
        d = math.hypot(x - ax, z - az)
        if d < cfg["r_core"]:
            return "core"
        if d < cfg["r_mid"]:
            return "mid"
        return "low"

    def overlaps(r):
        for t in taken:
            if r[0] < t[2] and r[2] > t[0] and r[1] < t[3] and r[3] > t[1]:
                return True
        return False

    def place(ti, x, z, rot, rec):
        w, d = (rec["w"], rec["d"]) if rot % 2 == 0 else (rec["d"], rec["w"])
        r = (x - w / 2, z - d / 2, x + w / 2, z + d / 2)
        if overlaps(r) or not site.free_rect(*r, margin=2):
            return False
        taken.append(r)
        placed.append([ti, round(x, 2), round(z, 2), rot, P[rnd.choice(types[ti][2])]])
        return True

    by_zone = {}
    for i, (zn, rec, tints) in enumerate(types):
        by_zone.setdefault(zn, []).append(i)

    # the hero first, where the landmark says
    for i, (zn, rec, tints) in enumerate(types):
        if zn == "hero":
            hx, hz = cfg["hero"]
            if not place(i, hx, hz, 0, rec):
                print("WARNING: hero did not fit at", hx, hz)

    # ---- streets: strips between grid lines, subdivided so they drape
    def strip_x(x, za, zb, width, layer_mid):
        """a north-south strip centred on x, from za to zb"""
        n = max(1, int(math.ceil((zb - za) / SUB)))
        across = 2
        for k in range(n):
            z0, z1 = za + (zb - za) * k / n, za + (zb - za) * (k + 1) / n
            for a in range(across):
                x0 = x - width / 2 + width * a / across
                x1 = x - width / 2 + width * (a + 1) / across
                if not site.free_rect(x0, z0, x1, z1):
                    continue
                if layer_mid == ROAD:
                    # the carriageway tile, mirrored about the centre line, in
                    # metres: each half is one direction, so a narrow street
                    # gets a double centre line and a wide one gets lanes too
                    ru, rv = SCALE[ROAD]
                    uv = [(abs(x0 - x) / ru, z0 / rv), (abs(x1 - x) / ru, z0 / rv),
                          (abs(x1 - x) / ru, z1 / rv), (abs(x0 - x) / ru, z1 / rv)]
                    pts = [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)]
                    ground.face(pts, uv, ROAD, (0, 1, 0))
                else:
                    ground.top(x0, z0, x1, z1, 0, layer_mid)

    def strip_z(z, xa, xb, width, layer_mid):
        n = max(1, int(math.ceil((xb - xa) / SUB)))
        across = 2
        for k in range(n):
            x0, x1 = xa + (xb - xa) * k / n, xa + (xb - xa) * (k + 1) / n
            for a in range(across):
                z0 = z - width / 2 + width * a / across
                z1 = z - width / 2 + width * (a + 1) / across
                if not site.free_rect(x0, z0, x1, z1):
                    continue
                if layer_mid == ROAD:
                    # u across the street, v along it: the tile's lanes run with the road
                    ru, rv = SCALE[ROAD]
                    uv = [(abs(z0 - z) / ru, x0 / rv), (abs(z0 - z) / ru, x1 / rv),
                          (abs(z1 - z) / ru, x1 / rv), (abs(z1 - z) / ru, x0 / rv)]
                    pts = [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)]
                    ground.face(pts, uv, ROAD, (0, 1, 0))
                else:
                    ground.top(x0, z0, x1, z1, 0, layer_mid)

    blocks = []
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            bx0, bx1 = xs[i] + aw / 2, xs[i + 1] - aw / 2
            bz0, bz1 = zs[j] + sw / 2, zs[j + 1] - sw / 2
            if bx1 < X0 or bx0 > X1 or bz1 < Z0 or bz0 > Z1:
                continue
            if site.free_frac(bx0, bz0, bx1, bz1) < 0.55:
                continue
            blocks.append((bx0, bz0, bx1, bz1))
    used_x, used_z = set(), set()
    for (bx0, bz0, bx1, bz1) in blocks:
        # the sidewalk pad under the whole block
        n = max(1, int(math.ceil((bx1 - bx0) / SUB)))
        m = max(1, int(math.ceil((bz1 - bz0) / SUB)))
        for a in range(n):
            for b in range(m):
                x0, x1 = bx0 + (bx1 - bx0) * a / n, bx0 + (bx1 - bx0) * (a + 1) / n
                z0, z1 = bz0 + (bz1 - bz0) * b / m, bz0 + (bz1 - bz0) * (b + 1) / m
                if site.free_rect(x0, z0, x1, z1):
                    ground.top(x0, z0, x1, z1, 0.18, CONC)
        # the streets round it (each once)
        k = (round(bx0 - aw / 2, 1), round(bz0, 1))
        if k not in used_x:
            used_x.add(k); strip_x(bx0 - aw / 2, bz0, bz1, aw, ROAD)
        k = (round(bx1 + aw / 2, 1), round(bz0, 1))
        if k not in used_x:
            used_x.add(k); strip_x(bx1 + aw / 2, bz0, bz1, aw, ROAD)
        k = (round(bz0 - sw / 2, 1), round(bx0, 1))
        if k not in used_z:
            used_z.add(k); strip_z(bz0 - sw / 2, bx0, bx1, sw, ROAD)
        k = (round(bz1 + sw / 2, 1), round(bx0, 1))
        if k not in used_z:
            used_z.add(k); strip_z(bz1 + sw / 2, bx0, bx1, sw, ROAD)
    # the crossings
    corners = set()
    for (bx0, bz0, bx1, bz1) in blocks:
        for cx in (bx0 - aw / 2, bx1 + aw / 2):
            for cz in (bz0 - sw / 2, bz1 + sw / 2):
                corners.add((round(cx, 1), round(cz, 1)))
    for (cx, cz) in corners:
        if site.free_rect(cx - aw / 2, cz - sw / 2, cx + aw / 2, cz + sw / 2):
            ground.top(cx - aw / 2, cz - sw / 2, cx + aw / 2, cz + sw / 2, 0, ASPH)

    # ---- buildings, block by block
    inset = cfg["inset"]
    for (bx0, bz0, bx1, bz1) in blocks:
        cx, cz = (bx0 + bx1) / 2, (bz0 + bz1) / 2
        zn = zone(cx, cz)
        depth = bz1 - bz0 - 2 * inset
        # a core block may take one tower in the middle first
        if zn == "core" and rnd.random() < cfg["tower_p"]:
            opts = [i for i in by_zone["core"] if types[i][1]["d"] <= depth and types[i][1]["w"] <= bx1 - bx0 - 2 * inset]
            if opts:
                ti = rnd.choice(opts)
                x = cx + (rnd.random() - 0.5) * max(0, bx1 - bx0 - 2 * inset - types[ti][1]["w"]) * 0.8
                place(ti, x, cz, rnd.choice([0, 2]), types[ti][1])
        # then fill both street fronts, left to right
        for side in (1, -1):
            edge = bz1 - inset if side == 1 else bz0 + inset
            x = bx0 + inset
            misses = 0
            while x < bx1 - inset - 8 and misses < 30:
                pool = list(by_zone[zn])
                if zn != "low" and rnd.random() < cfg["mix"]:
                    pool = by_zone["mid" if zn == "core" else "low"]
                rnd.shuffle(pool)
                ok = False
                for ti in pool:
                    rec = types[ti][1]
                    if rec["d"] > depth / 2 + (0 if zn == "low" else depth / 2 - 2):
                        continue
                    if x + rec["w"] > bx1 - inset:
                        continue
                    z = edge - side * rec["d"] / 2
                    if place(ti, x + rec["w"] / 2, z, 0 if side == 1 else 2, rec):
                        x += rec["w"] + cfg["gap"]
                        ok = True
                        break
                if not ok:
                    x += 3
                    misses += 1
    # ---- the square: one block left open, by taking its buildings back out
    # AFTER everything is placed, so the random stream -- and with it every
    # other block in the city -- is exactly what it was without one
    plaza = None
    if cfg.get("plaza"):
        px, pz = cfg["plaza"]
        for (bx0, bz0, bx1, bz1) in blocks:
            if bx0 < px < bx1 and bz0 < pz < bz1:
                plaza = [round(bx0, 1), round(bz0, 1), round(bx1, 1), round(bz1, 1)]
                placed[:] = [p for p in placed if not (bx0 < p[1] < bx1 and bz0 < p[2] < bz1)]
        if plaza is None:
            print("WARNING: no block under the plaza at", px, pz)
    rects = [[round(b[0] - aw / 2, 1), round(b[1] - sw / 2, 1), round(b[2] + aw / 2, 1), round(b[3] + sw / 2, 1)] for b in blocks]
    return ground, placed, rects, plaza


# ---------------------------------------------------------------------------
def to_blender(g, name, weld=False):
    me = bpy.data.meshes.new(name)
    verts = [(p[0], -p[2], p[1]) for p in g.v]
    me.from_pydata(verts, [], g.f)
    uv0 = me.uv_layers.new(name="UVMap")
    uv1 = me.uv_layers.new(name="Layer")
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            u, v = g.uv[vi]
            uv0.data[li].uv = (u, 1.0 - v)          # the exporter flips V back
            uv1.data[li].uv = (float(g.lay[vi]), 1.0)
    if weld:
        # the ground is one continuous sheet: share its vertices (UVs stay per loop)
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
        bm.to_mesh(me)
        bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build(city, cfg, type_fn, seed):
    rnd = random.Random(seed)
    site = Site(os.path.join(HERE, f"site-{city}.json"))
    types = type_fn(rnd)
    ground, placed, rects, plaza = layout(site, types, cfg, rnd)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    obs = []
    used = sorted({p[0] for p in placed})
    remap = {old: new for new, old in enumerate(used)}
    out_types = []
    tris0 = tris1 = 0
    count = {i: 0 for i in used}
    for p in placed:
        count[p[0]] += 1
    for old in used:
        zn, rec, tints = types[old]
        k = remap[old]
        obs.append(to_blender(rec["lod0"], f"T{k}"))
        obs.append(to_blender(rec["lod1"], f"T{k}L"))
        tris0 += rec["lod0"].tris * count[old]
        tris1 += rec["lod1"].tris * count[old]
        out_types.append({"name": rec["name"], "height": round(rec["height"], 2),
                          "tiers": [[round(v, 2) for v in t] for t in rec["tiers"]],
                          "crown": [[round(v, 2) for v in t] for t in rec.get("crown", [])],
                          "tris": rec["lod0"].tris, "trisLod1": rec["lod1"].tris})
    obs.append(to_blender(ground, "ground", weld=True))
    for p in placed:
        p[0] = remap[p[0]]
    out = os.path.join(ROOT, "cockpit", "models", f"city-{city}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True,
                              export_yup=True, export_normals=True, export_texcoords=True,
                              export_materials="NONE", export_apply=False, export_animations=False)
    xs = [p[1] for p in placed]
    zs = [p[2] for p in placed]
    info = {
        "anchor": cfg["anchor"], "glb": f"models/city-{city}.glb",
        "bounds": [round(min(xs) - 40), round(min(zs) - 40), round(max(xs) + 40), round(max(zs) + 40)],
        "types": out_types, "buildings": placed, "blocks": rects,
        # what streets.js drives on: every block edge is a street centreline,
        # north-south ones avenueW wide and east-west ones streetW, and the
        # buildings stand `inset` back from the kerb
        "avenueW": cfg["avenue_w"], "streetW": cfg["street_w"], "inset": cfg["inset"], "plaza": plaza,
        "tris": {"lod0": tris0 + ground.tris, "lod1": tris1, "ground": ground.tris},
    }
    print(f"{city}: {len(placed)} buildings, {len(used)} types, tris lod0 {tris0} + ground {ground.tris}, lod1 {tris1}")
    return info


NY = {
    "anchor": "skyline", "core": (-330, 4110), "hero": (-220, 4130),
    "x_origin": -220 + 36, "x_step": 108, "z_origin": 4130 - 33, "z_step": 66,
    "avenue_w": 20, "street_w": 14, "r_core": 230, "r_mid": 420,
    "inset": 3, "gap": 0, "tower_p": 0.8, "mix": 0.3,
    "plaza": (-454, 4196),           # the square with the fountain, on the street in from the off-ramp
}
CA = {
    "anchor": "downtown", "core": (470, -4930), "hero": (460, -4920),
    "x_origin": 460 + 46, "x_step": 96, "z_origin": -4920 - 46, "z_step": 96,
    "avenue_w": 20, "street_w": 20, "r_core": 190, "r_mid": 380,
    "inset": 5, "gap": 6, "tower_p": 0.9, "mix": 0.35,
}

data = {"ny": build("ny", NY, ny_types, 1971), "ca": build("ca", CA, ca_types, 1984)}
js = os.path.join(ROOT, "cockpit", "js", "citydata.js")
with open(js, "w") as f:
    f.write('"use strict";\n// GENERATED by scripts/city/build_city.py -- do not edit by hand.\n')
    f.write("// Each city: its landmark, its GLB, and every building as\n")
    f.write("// [type, x, z, quarter turns, tint]; each type's solid tiers as\n")
    f.write("// [cx, cz, halfW, halfD, y0, y1] above its base, before it is turned.\n")
    f.write("const CITY_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print("wrote", js)
