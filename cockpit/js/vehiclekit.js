"use strict";
// WORKING RULES
// The traffic kit: six low-poly vehicles -- sedan, hatchback, taxi, van, bus,
// box lorry -- lofted here at load, and the police car on the sedan.
//
// EACH SHAPE FILLS THE BOX IT REPLACED AND NOTHING MOVES. A shape is drawn
// inside the footprint of the collision class that places it (the car 3.4 x
// 7.6, the van 3.2 x 9.2, the bus 3.4 x 14, the lorry 4.2 x 15; streets.js
// ST_TYPES and highway.js say so), with its wheels on the road at the lift that
// class already uses. Which shape a slot wears is a function of the slot index:
// nothing here decides anything from Math.random, and nothing here decides
// where anything goes (and see vkQuiet: the seeded stream is left as v125 left it).
//
// HOW A SHAPE IS MADE. A side profile (z along, y up; the nose is -z, as for
// every model in this game) swept across the car: bumpers, bonnet, boot and
// real wheel ARCHES are notches in that profile. The glasshouse is a second,
// narrower sweep on top of it, tucked in towards the roof, and its sides are cut
// into bands -- pillar, window, pillar. Lamps, grilles, windows and stripes are
// flat decals a couple of centimetres proud. Wheels are 10-sided with a flat on
// the road and a spoked hub, so turning shows.
//
// ONE DRAW PER SHAPE. Everything is one merged, non-indexed geometry on one
// shared material. Colour is per vertex from TUNE.palette; the per-instance
// colour tints only the faces marked paint (`vkFx.x`), so glass stays glass
// and tyres stay black. The material is artPaint's "vehicle" preset and this
// file's patch is chained AFTER art's own (vkOnBeforeCompile), so the texture
// detail still lands exactly as before.
//
//   - WHEELS TURN IN THE VERTEX SHADER: each wheel vertex carries its hub
//     centre (`vkWheel`), each instance its roll angle (`vkSpin`, written with
//     the matrix). Zero extra draw calls.
//   - LAMPS GLOW with a per-vertex weight (`vkFx.y`): their own colour, never
//     tinted, never painted, a little brighter at night. No post stack -- ever.
//
// Under 800 triangles a shape; `VK.tris` holds the counts.
// ---------------------------------------------------------------------------

const VK = { tris: {}, material: null };
// How hard the atlas's detail lands on a vehicle (art.js `fade` strength): paint
// is smooth, and the full deck plates and grain read as rust at this size.
const VK_ART_STRENGTH = 0.4;

// ---- the random stream is not ours -------------------------------------------
// three.js draws four Math.random()s for the UUID of EVERY geometry, material and
// object it makes, and the harness seeds Math.random: build a different number of
// things and every seeded check after it sees a different stream -- different
// traffic, different spawns -- though nothing about traffic changed. So each
// builder runs on the kit's OWN stream and then draws from the real one exactly
// what the box version of it drew in v125 (counted, not guessed: the numbers
// below). Change a builder's count of three.js objects and nothing moves; change
// these numbers and everything does.
const VK_V125_DRAWS = { hwyTraffic: 176, stTraffic: 268, stParked: 36, policeCar: 168 };
let vkSeed = 0x6b1d2f37;
function vkQuiet(draws, fn) {
  const R = Math.random;
  Math.random = () => { vkSeed = (vkSeed * 1664525 + 1013904223) >>> 0; return vkSeed / 4294967296; };
  try { return fn(); } finally {
    Math.random = R;
    for (let i = 0; i < draws; i++) R();
  }
}

// ---- the builder ----------------------------------------------------------
// Design units are metres above the road (y = 0) with the nose at -z. The
// builder maps them to the mesh: scaled (the police car is the sedan, smaller)
// and dropped by `y0` (an instanced vehicle's origin sits `lift` above the road).
function vkBegin(o) {
  o = o || {};
  return { P: [], C: [], L: [], F: [], W: [], sx: o.sx || 1, sy: o.sy || 1, sz: o.sz || 1,
           y0: o.y0 || 0, only: o.only || null, lampsOff: !!o.lampsOff };
}
const vkTmpCol = new THREE.Color();
function vkMap(B, p) { return [p[0] * B.sx, p[1] * B.sy + B.y0, p[2] * B.sz]; }

// One triangle. `out` is the way it must face: the winding is fixed to suit, so
// no face in the kit is ever culled the wrong way round. `wc`: a wheel's hub
// centre, and then the points are already in mesh units.
function vkTri(B, a, b, c, out, m, wc) {
  if (B.only && !B.only(m)) return;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * nx + ny * ny + nz * nz < 1e-10) return;
  if (out && nx * out[0] + ny * out[1] + nz * out[2] < 0) { const t = b; b = c; c = t; }
  vkTmpCol.setHex(m.c);
  const glow = B.lampsOff ? 0 : (m.g || 0);
  for (const p of [a, b, c]) {
    const q = wc ? p : vkMap(B, p);
    B.P.push(q[0], q[1], q[2]);
    B.C.push(vkTmpCol.r, vkTmpCol.g, vkTmpCol.b);
    B.L.push(m.l);
    B.F.push(m.t || 0, glow);
    if (wc) B.W.push(wc[0], wc[1], wc[2], 1); else B.W.push(0, 0, 0, 0);
  }
}
function vkQuad(B, a, b, c, d, out, m) { vkTri(B, a, b, c, out, m); vkTri(B, a, c, d, out, m); }

// A box (12 triangles), for mirrors, chassis rails, a fuel tank.
function vkBox(B, x, y, z, w, h, d, m) {
  const X = [x - w / 2, x + w / 2], Y = [y - h / 2, y + h / 2], Z = [z - d / 2, z + d / 2];
  const p = (i, j, k) => [X[i], Y[j], Z[k]];
  vkQuad(B, p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1), [1, 0, 0], m);
  vkQuad(B, p(0, 0, 0), p(0, 1, 0), p(0, 1, 1), p(0, 0, 1), [-1, 0, 0], m);
  vkQuad(B, p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1), [0, 1, 0], m);
  vkQuad(B, p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1), [0, -1, 0], m);
  vkQuad(B, p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1), [0, 0, 1], m);
  vkQuad(B, p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0), [0, 0, -1], m);
}

// A profile's winding: +1 counter-clockwise in (z, y).
function vkOrient(prof) {
  let a = 0;
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a >= 0 ? 1 : -1;
}
// the outward normal (0, y, z) of profile edge i
function vkEdgeOut(prof, i, s) {
  const p = prof[i], q = prof[(i + 1) % prof.length];
  const dz = q[0] - p[0], dy = q[1] - p[1];
  return [0, s * -dz, s * dy];
}

// THE SWEEP. prof: [[z, y, tag], ...], a closed polygon; `tag` is the material
// of the face from that point to the next (null: no face, for an edge nothing
// can see). half(y, z): the half-width there. cap: the sides' material.
function vkExtrude(B, prof, half, cap, mats) {
  const s = vkOrient(prof);
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    if (!p[2]) continue;
    const hp = half(p[1], p[0]), hq = half(q[1], q[0]);
    vkQuad(B, [-hp, p[1], p[0]], [hp, p[1], p[0]], [hq, q[1], q[0]], [-hq, q[1], q[0]],
      vkEdgeOut(prof, i, s), mats[p[2]]);
  }
  if (!cap) return;
  const tris = THREE.ShapeUtils.triangulateShape(prof.map(p => new THREE.Vector2(p[0], p[1])), []);
  for (const side of [-1, 1]) {
    for (const [i, j, k] of tris) {
      const P = [prof[i], prof[j], prof[k]].map(p => [side * half(p[1], p[0]), p[1], p[0]]);
      vkTri(B, P[0], P[1], P[2], [side, 0, 0], cap);
    }
  }
}

// A convex polygon clipped to z0 <= z <= z1 (Sutherland-Hodgman, twice).
function vkClipZ(poly, z0, z1) {
  const cut = (pts, inside, zc) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], ip = inside(p[0]), iq = inside(q[0]);
      if (ip) out.push(p);
      if (ip !== iq) { const t = (zc - p[0]) / (q[0] - p[0]); out.push([zc, p[1] + t * (q[1] - p[1])]); }
    }
    return out;
  };
  return cut(cut(poly, z => z >= z0, z0), z => z <= z1, z1);
}
// The glasshouse's sides, in bands along the car: [[z0, z1, material], ...].
function vkBandCap(B, poly, half, bands) {
  for (const [z0, z1, m] of bands) {
    const pts = vkClipZ(poly, z0, z1);
    if (pts.length < 3) continue;
    for (const side of [-1, 1]) {
      const P = pts.map(p => [side * half(p[1], p[0]), p[1], p[0]]);
      for (let k = 1; k < P.length - 1; k++) vkTri(B, P[0], P[k], P[k + 1], [side, 0, 0], m);
    }
  }
}

// A wheel arch notched into the bottom of a profile, walked rear to front.
function vkArch(zc, yc, ra, sill, tag, n) {
  n = n || 6;
  const out = [], t0 = sill > yc ? Math.asin(Math.min(1, (sill - yc) / ra)) : 0;
  if (sill < yc) out.push([zc + ra, sill, tag]);
  for (let k = 0; k <= n; k++) {
    const a = t0 + (Math.PI - 2 * t0) * k / n;
    out.push([zc + ra * Math.cos(a), yc + ra * Math.sin(a), tag]);
  }
  if (sill < yc) out.push([zc - ra, sill, tag]);
  return out;
}

// A decal on profile edge i, from t0 to t1 along it and x0..x1 across (mirrored
// to both sides unless `one`), lifted `off` off the surface.
function vkEdgeDecal(B, prof, i, t0, t1, x0, x1, m, one, off) {
  const s = vkOrient(prof), n = vkEdgeOut(prof, i, s), L = Math.hypot(n[1], n[2]) || 1;
  const o = (off || 0.025) / L;
  const p = prof[i], q = prof[(i + 1) % prof.length];
  const at = t => [p[0] + (q[0] - p[0]) * t + n[2] * o, p[1] + (q[1] - p[1]) * t + n[1] * o];
  const a = at(t0), b = at(t1);
  const spans = one ? [[x0, x1]] : [[x0, x1], [-x1, -x0]];
  for (const [u0, u1] of spans) {
    vkQuad(B, [u0, a[1], a[0]], [u1, a[1], a[0]], [u1, b[1], b[0]], [u0, b[1], b[0]], n, m);
  }
}
// A decal on the flat side of a sweep: a polygon [[z, y], ...] at x = +-(w + off).
function vkSideDecal(B, pts, w, m, sides) {
  for (const side of sides || [-1, 1]) {
    const P = pts.map(p => [side * (w + 0.018), p[1], p[0]]);
    for (let k = 1; k < P.length - 1; k++) vkTri(B, P[0], P[k], P[k + 1], [side, 0, 0], m);
  }
}

// A WHEEL: a 10-sided tread with a flat on the road, a black tyre face, and a
// six-spoke hub of alternating steel standing proud of it, so turning shows --
// 34 triangles. Built in mesh units so it stays round whatever the body's scale;
// `xo` is the outer face, `side` which way it faces.
function vkWheel(B, xo, z, r, w, side, M) {
  const n = 10, rf = r * B.sz, cx = xo * B.sx, cz = z * B.sz;
  const cy = B.y0 + rf * Math.cos(Math.PI / n) - 0.02;            // the flat 2 cm into the road
  const xi = cx - side * w * B.sx, wc = [0, cy, cz];
  const at = (rr, k, m) => {
    const a = -Math.PI / 2 + Math.PI / n + 2 * Math.PI * k / m;
    return [cy + rr * Math.sin(a), cz + rr * Math.cos(a), a];
  };
  const face = [];
  for (let k = 0; k < n; k++) {
    const A = at(rf, k, n), Bq = at(rf, k + 1, n), am = (A[2] + Bq[2]) / 2, o = [0, Math.sin(am), Math.cos(am)];
    vkTri(B, [cx, A[0], A[1]], [xi, A[0], A[1]], [xi, Bq[0], Bq[1]], o, M.tyre, wc);
    vkTri(B, [cx, A[0], A[1]], [xi, Bq[0], Bq[1]], [cx, Bq[0], Bq[1]], o, M.tyre, wc);
    face.push([cx, A[0], A[1]]);
  }
  for (let k = 1; k < n - 1; k++) vkTri(B, face[0], face[k], face[k + 1], [side, 0, 0], M.tyre, wc);
  const hx = cx + side * 0.035, rh = rf * 0.62;
  for (let k = 0; k < 6; k++) {
    const a = at(rh, k, 6), b = at(rh, k + 1, 6);
    vkTri(B, [hx + side * 0.03, cy, cz], [hx, a[0], a[1]], [hx, b[0], b[1]], [side, 0, 0], k % 2 ? M.hub : M.hub2, wc);
  }
}

function vkGeometry(B) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(B.P, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(B.C, 3));
  g.setAttribute("artLayerA", new THREE.Float32BufferAttribute(B.L, 1));
  g.setAttribute("vkFx", new THREE.Float32BufferAttribute(B.F, 2));
  g.setAttribute("vkWheel", new THREE.Float32BufferAttribute(B.W, 4));
  g.computeVertexNormals();                       // non-indexed: face normals
  g.computeBoundingSphere();
  return g;
}

// ---- the materials, from the palette ----------------------------------------
function vkMats() {
  const C = TUNE.palette, L = ART_LAYER;
  return {
    p: { c: 0xffffff, l: L.deck, t: 1 },              // paint: takes the instance colour
    w: { c: C.white, l: L.deck },                     // fixed white (a bus roof, a van)
    g: { c: C.night, l: L.glass },                    // glass
    k: { c: C.ink, l: L.asphalt },                    // wheel wells, underside
    s: { c: C.slate, l: L.deck },                     // bumpers, trim
    m: { c: C.steel, l: L.deck },                     // chrome and steel
    c: { c: C.white, l: L.container },                // a lorry's box
    tyre: { c: C.ink, l: L.asphalt },
    hub: { c: C.steel, l: L.deck }, hub2: { c: C.slate, l: L.deck },
    // lamps: their own colour, glowing, never tinted (signal-lamp colours, not palette)
    head: { c: 0xfff4dc, l: L.deck, g: 1 },
    tail: { c: 0xff3b30, l: L.deck, g: 0.85 },
    sign: { c: 0xffe7a0, l: L.deck, g: 0.9 },
    dest: { c: 0xffb43a, l: L.deck, g: 0.8 },
  };
}

// ---- the shapes --------------------------------------------------------------
// Every shape: (builder, materials). Numbers are metres, y above the road.
const VK_SHAPES = {
  // THE SEDAN: 7.5 x 3.3 x 2.25, a bonnet, a raked windscreen, a boot.
  sedan(B, M, o) {
    o = o || {};
    const W = 1.64, zF = -2.35, zR = 2.30, ra = 0.64, yc = 0.50, sill = 0.34;
    const half = (y, z) => W - Math.max(0, Math.abs(z) - 3.25) * 0.5;
    const prof = [
      [-3.62, 0.34, "s"], [-3.75, 0.52, "p"], [-3.77, 0.88, "p"], [-3.66, 1.08, "p"], [-3.30, 1.20, "p"],
      [-1.25, 1.40, "p"], [2.05, 1.40, "p"], [3.32, 1.37, "p"], [3.68, 1.22, "p"], [3.78, 0.92, "s"],
      [3.76, 0.52, "k"], [3.62, 0.34, "k"],
      ...vkArch(zR, yc, ra, sill, "k"), ...vkArch(zF, yc, ra, sill, "k"),
    ];
    vkExtrude(B, prof, half, M.p, M);
    const gh = [[-1.25, 1.40, "g"], [-0.10, 2.18, "p"], [0.55, 2.25, "p"], [1.20, 2.20, "g"], [2.05, 1.40, null]];
    const ghHalf = (y) => 1.52 - (y - 1.40) * 0.40;
    vkExtrude(B, gh, ghHalf, null, M);
    vkBandCap(B, gh, ghHalf, [[-9, -0.85, M.p], [-0.85, 0.40, M.g], [0.40, 0.60, M.p], [0.60, 1.45, M.g], [1.45, 9, M.p]]);
    vkEdgeDecal(B, prof, 2, 0.12, 0.85, 0.78, 1.30, M.head);          // headlamps
    vkEdgeDecal(B, prof, 1, 0.30, 0.95, -0.62, 0.62, M.s, true);        // grille
    vkEdgeDecal(B, prof, 8, 0.10, 0.90, 0.85, 1.36, M.tail);           // tail-lamps
    for (const sx of [-1, 1]) vkBox(B, sx * 1.55, 1.50, -1.02, 0.26, 0.22, 0.34, o.mirror || M.p);
    for (const sx of [-1, 1]) for (const z of [zF, zR]) vkWheel(B, sx * 1.60, z, 0.54, 0.58, sx, M);
    return { W, prof, half };
  },

  // THE HATCHBACK: shorter (6.9), taller, the glass running on to a steep hatch.
  hatch(B, M) {
    const W = 1.64, zF = -2.15, zR = 2.10, ra = 0.64, yc = 0.50, sill = 0.34;
    const half = (y, z) => W - Math.max(0, Math.abs(z) - 2.95) * 0.5;
    const prof = [
      [-3.30, 0.34, "s"], [-3.42, 0.52, "p"], [-3.44, 0.90, "p"], [-3.32, 1.10, "p"], [-2.95, 1.22, "p"],
      [-1.05, 1.42, "p"], [3.20, 1.52, "p"], [3.36, 1.40, "p"], [3.42, 0.72, "s"], [3.40, 0.50, "k"],
      [3.28, 0.34, "k"],
      ...vkArch(zR, yc, ra, sill, "k"), ...vkArch(zF, yc, ra, sill, "k"),
    ];
    vkExtrude(B, prof, half, M.p, M);
    const gh = [[-1.05, 1.42, "g"], [0.0, 2.28, "p"], [1.40, 2.32, "p"], [2.75, 2.26, "g"], [3.20, 1.52, null]];
    const ghHalf = (y) => 1.52 - (y - 1.42) * 0.36;
    vkExtrude(B, gh, ghHalf, null, M);
    vkBandCap(B, gh, ghHalf, [[-9, -0.72, M.p], [-0.72, 0.55, M.g], [0.55, 0.75, M.p], [0.75, 2.10, M.g], [2.10, 9, M.p]]);
    vkEdgeDecal(B, prof, 2, 0.12, 0.85, 0.78, 1.28, M.head);
    vkEdgeDecal(B, prof, 1, 0.30, 0.95, -0.60, 0.60, M.s, true);
    vkEdgeDecal(B, prof, 7, 0.06, 0.55, 0.98, 1.40, M.tail);
    for (const sx of [-1, 1]) vkBox(B, sx * 1.55, 1.52, -0.82, 0.26, 0.22, 0.34, M.p);
    for (const sx of [-1, 1]) for (const z of [zF, zR]) vkWheel(B, sx * 1.60, z, 0.54, 0.58, sx, M);
  },

  // THE TAXI: the sedan in yellow, a lit sign on the roof (a shape, no
  // letters) and a checker band down each side.
  taxi(B, M) {
    const S = VK_SHAPES.sedan(B, M);
    const sign = [[0.25, 2.20, "sign"], [0.33, 2.50, "sign"], [0.77, 2.50, "sign"], [0.85, 2.20, null]];
    vkExtrude(B, sign, () => 0.62, M.sign, M);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 11; k++) {
        if ((k + r) % 2) continue;
        const z0 = -1.3 + k * 0.26, y0 = 0.98 + r * 0.12;
        vkSideDecal(B, [[z0, y0], [z0 + 0.26, y0], [z0 + 0.26, y0 + 0.12], [z0, y0 + 0.12]], S.W, M.k);
      }
    }
  },

  // THE DELIVERY VAN: 9.1 long, 3.6 tall, a short bonnet, a steep screen, a
  // white box with its stripe in the instance colour.
  van(B, M) {
    const W = 1.58, zF = -2.95, zR = 2.95, ra = 0.72, yc = 0.58, sill = 0.40;
    const half = (y, z) => W - Math.max(0, Math.abs(z) - 4.10) * 0.5;
    const prof = [
      [-4.42, 0.40, "s"], [-4.55, 0.60, "w"], [-4.56, 1.05, "w"], [-4.50, 1.42, "w"], [-4.05, 1.62, "w"],
      [-3.25, 1.80, "g"], [-2.40, 3.05, "w"], [-2.00, 3.52, "w"], [4.40, 3.58, "w"], [4.55, 3.45, "w"],
      [4.56, 0.95, "s"], [4.52, 0.60, "k"], [4.45, 0.40, "k"],
      ...vkArch(zR, yc, ra, sill, "k"), ...vkArch(zF, yc, ra, sill, "k"),
    ];
    vkExtrude(B, prof, half, M.w, M);
    vkSideDecal(B, [[-2.92, 2.00], [-1.55, 2.00], [-1.55, 2.80], [-2.42, 2.80]], W, M.g);   // cab doors
    vkSideDecal(B, [[-2.10, 1.30], [4.40, 1.30], [4.40, 1.58], [-2.10, 1.58]], W, M.p);     // the stripe
    vkEdgeDecal(B, prof, 2, 0.15, 0.85, 0.90, 1.38, M.head);
    vkEdgeDecal(B, prof, 2, 0.20, 0.80, -0.70, 0.70, M.s, true);
    vkEdgeDecal(B, prof, 9, 0.03, 0.97, -0.03, 0.03, M.k, true);           // the rear doors' split
    vkEdgeDecal(B, prof, 9, 0.10, 0.34, 0.14, 1.15, M.g);                  // their windows
    vkEdgeDecal(B, prof, 9, 0.55, 0.85, 1.25, 1.50, M.tail);
    for (const sx of [-1, 1]) vkBox(B, sx * 1.50, 2.30, -2.95, 0.18, 0.50, 0.20, M.s);
    for (const sx of [-1, 1]) for (const z of [zF, zR]) vkWheel(B, sx * 1.54, z, 0.58, 0.60, sx, M);
  },

  // THE BUS: 13.8 long, a row of windows, doors on the kerb side, a lit
  // destination strip with nothing written on it.
  bus(B, M) {
    const W = 1.66, zF = -4.35, zR = 3.75, ra = 0.80, yc = 0.62, sill = 0.42;
    const half = (y, z) => W - Math.max(0, Math.abs(z) - 6.60) * 0.6;
    const prof = [
      [-6.78, 0.42, "s"], [-6.90, 0.62, "p"], [-6.93, 1.50, "p"], [-6.96, 1.62, "g"], [-6.98, 3.00, "dest"],
      [-6.90, 3.40, "w"], [-6.50, 3.62, "w"], [6.55, 3.62, "w"], [6.90, 3.40, "p"], [6.92, 0.95, "s"],
      [6.80, 0.42, "k"],
      ...vkArch(zR, yc, ra, sill, "k"), ...vkArch(zF, yc, ra, sill, "k"),
    ];
    vkExtrude(B, prof, half, M.p, M);
    const pane = (z0, z1, y0, y1, sides) => vkSideDecal(B, [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], W, M.g, sides);
    const panes = [[-5.15, -3.85], [-3.65, -2.35], [-2.15, -0.85], [-0.65, 0.65], [0.85, 2.15], [2.35, 3.65], [3.85, 5.15], [5.35, 6.35]];
    for (const [z0, z1] of panes) {
      if (z0 === -0.65) { pane(z0, z1, 1.80, 3.05, [-1]); pane(z0, z1, 0.70, 3.05, [1]); }   // the middle door
      else pane(z0, z1, 1.80, 3.05);
    }
    pane(-6.55, -5.35, 1.80, 3.05, [-1]);                                   // the driver's window
    pane(-6.55, -5.35, 0.70, 3.05, [1]);                                    // the front door
    vkEdgeDecal(B, prof, 1, 0.12, 0.40, 1.00, 1.45, M.head);
    vkEdgeDecal(B, prof, 8, 0.12, 0.45, -1.30, 1.30, M.g, true);            // the rear window
    vkEdgeDecal(B, prof, 8, 0.75, 0.92, 1.20, 1.52, M.tail);
    for (const sx of [-1, 1]) for (const z of [zF, zR]) vkWheel(B, sx * 1.60, z, 0.62, 0.62, sx, M);
  },

  // THE BOX LORRY: a bonneted cab with a roof fairing, a white box, a chassis,
  // a fuel tank, a tandem at the back. 14.9 long, 4.2 wide.
  lorry(B, M) {
    const W = 1.86, zF = -6.05;
    const half = (y, z) => W - Math.max(0, -z - 7.0) * 0.6;
    const prof = [
      [-7.30, 0.55, "s"], [-7.42, 0.75, "p"], [-7.44, 1.20, "p"], [-7.40, 2.05, "p"], [-7.20, 2.15, "p"],
      [-5.95, 2.30, "g"], [-5.45, 3.40, "p"], [-5.20, 3.52, "p"], [-3.40, 3.52, "p"], [-3.30, 3.40, "p"],
      [-3.30, 1.05, "k"],
      ...vkArch(zF, 0.66, 0.82, 1.05, "k"), [-6.87, 0.66, "k"],
    ];
    vkExtrude(B, prof, half, M.p, M);
    vkSideDecal(B, [[-5.70, 2.45], [-4.10, 2.45], [-4.10, 3.25], [-5.36, 3.25]], W, M.g);
    vkExtrude(B, [[-5.10, 3.50, "p"], [-3.35, 4.30, "p"], [-3.30, 3.50, null]], () => 1.62, M.p, M);
    const box = [[-3.05, 1.30, "c"], [7.45, 1.30, "c"], [7.45, 4.48, "c"], [-3.05, 4.48, "c"]];
    vkExtrude(B, box, () => 2.08, M.c, M);
    vkBox(B, 0, 1.02, 2.10, 1.70, 0.50, 10.5, M.k);                          // the chassis
    vkBox(B, 0, 0.80, 7.30, 3.60, 0.22, 0.18, M.s);                          // the under-run bar
    for (const sx of [-1, 1]) vkBox(B, sx * 1.55, 0.80, -4.30, 0.56, 0.52, 1.30, M.m);   // fuel tanks
    for (const sx of [-1, 1]) vkBox(B, sx * 1.98, 2.90, -5.55, 0.12, 0.60, 0.26, M.s);   // mirrors
    vkEdgeDecal(B, prof, 2, 0.05, 0.95, -0.85, 0.85, M.m, true);           // the grille
    vkEdgeDecal(B, prof, 2, 0.08, 0.34, 1.05, 1.55, M.head);
    vkEdgeDecal(B, box, 1, 0.03, 0.97, -0.03, 0.03, M.k, true);            // the box doors' split
    vkEdgeDecal(B, box, 1, 0.03, 0.14, 1.50, 1.95, M.tail);
    for (const sx of [-1, 1]) {
      vkWheel(B, sx * 1.80, zF, 0.62, 0.55, sx, M);
      for (const z of [4.55, 5.90]) vkWheel(B, sx * 1.95, z, 0.62, 0.80, sx, M);
    }
  },
};

// One shape's geometry, dropped so that `lift` above the road is its origin.
function vkShapeGeo(name, lift, opts) {
  const B = vkBegin(Object.assign({ y0: -lift }, opts || {}));
  VK_SHAPES[name](B, vkMats());
  const g = vkGeometry(B);
  VK.tris[name] = B.P.length / 9;
  return g;
}

// ---- the shader ----------------------------------------------------------------
const VK_VERT_PARS = `
attribute vec2 vkFx;
attribute vec4 vkWheel;
#ifdef VK_INST
attribute float vkSpin;
#else
uniform float vkSpinU;
#endif
varying vec3 vVkCol;
varying float vVkGlow;
`;
// rolls forward for a positive angle: the top of the wheel goes towards the nose
const VK_VERT_SPIN = `
if (vkWheel.w > 0.5) {
  #ifdef VK_INST
    float vka = vkSpin;
  #else
    float vka = vkSpinU;
  #endif
  vec3 vkd = transformed - vkWheel.xyz;
  float vkc = cos(vka), vks = sin(vka);
  transformed = vkWheel.xyz + vec3(vkd.x, vkc * vkd.y + vks * vkd.z, -vks * vkd.y + vkc * vkd.z);
}
`;
// the instance colour tints the paint and nothing else
const VK_VERT_COLOR = `
#if defined(USE_INSTANCING_COLOR) && defined(USE_COLOR)
  vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, vkFx.x);
#endif
vVkCol = color.xyz;
vVkGlow = vkFx.y;
`;
const VK_FRAG_PARS = `
varying vec3 vVkCol;
varying float vVkGlow;
`;
// a lamp: its own colour, unpainted, and alight
const VK_FRAG_GLOW = `
if (vVkGlow > 0.0) {
  diffuseColor.rgb = mix(diffuseColor.rgb, vVkCol * 0.5, min(vVkGlow, 1.0));
  totalEmissiveRadiance += vVkCol * vVkGlow * (0.8 + 0.6 * artNight);
}
`;
function vkOnBeforeCompile(shader, renderer) {
  artOnBeforeCompile.call(this, shader, renderer);
  if (this.userData.vk) Object.assign(shader.uniforms, this.userData.vk);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\n" + VK_VERT_PARS)
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VK_VERT_SPIN)
    .replace("#include <color_vertex>", "#include <color_vertex>\n" + VK_VERT_COLOR);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\n" + VK_FRAG_PARS)
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + VK_FRAG_GLOW);
}

// The kit's material: artPaint's vehicle preset with the kit's patch after it.
// `inst`: for InstancedMesh (spin per instance); otherwise one `vkSpinU`.
function vkMaterial(inst) {
  const m = artPaint(new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true,
    shininess: 36, specular: 0x4a5058 }), "vehicle", { fade: [300, 1000, VK_ART_STRENGTH] });
  if (inst) m.defines.VK_INST = "";
  else m.userData.vk = { vkSpinU: { value: 0 } };
  m.onBeforeCompile = vkOnBeforeCompile;
  return m;
}

// ---- instanced traffic -------------------------------------------------------
// One InstancedMesh of one shape, on the shared material. Draws `count`.
function vkMesh(name, lift, cap, opts) {
  if (!VK.material) VK.material = vkMaterial(true);
  const g = vkShapeGeo(name, lift, opts);
  g.setAttribute("vkSpin", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap)), 1));
  const m = new THREE.InstancedMesh(g, VK.material, Math.max(1, cap));
  m.setColorAt(0, vkTmpCol.setHex(0xffffff));
  m.frustumCulled = false; m.castShadow = true; m.userData.noSolid = true;
  m.userData.cap = Math.max(1, cap);
  m.userData.vkShape = name;
  m.count = 0; m.visible = false;
  return m;
}

// Per frame, for each instance drawn: its colour, and its wheels' roll. The
// roll is how far it moved along its own nose since the last frame (so a car
// going backwards rolls backwards and a respawn does not spin), kept per SLOT in
// `roll` -- a Float32Array of 3 per slot.
function vkInstance(m, k, roll, slot, mat, hex, r) {
  m.setColorAt(k, vkTmpCol.setHex(hex));
  const e = mat.elements, o = slot * 3, x = e[12], z = e[14];
  const d = -((x - roll[o]) * e[8] + (z - roll[o + 1]) * e[10]);    // the nose is -z
  roll[o] = x; roll[o + 1] = z;
  if (Math.abs(d) < 40) roll[o + 2] = (roll[o + 2] + d / r) % (Math.PI * 2);
  m.geometry.attributes.vkSpin.array[k] = roll[o + 2];
}
function vkCommit(m, n) {
  m.count = n;
  m.visible = n > 0;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.geometry.attributes.vkSpin.needsUpdate = true;
}
// wheel radius per shape, for the roll
const VK_WHEEL_R = { sedan: 0.54, hatch: 0.54, taxi: 0.54, van: 0.58, bus: 0.62, lorry: 0.62 };

// Which car a car slot is: a sedan or a hatchback, by its index and nothing else.
function vkCarShape(i) { return ((i * 11 + 3) % 5) < 2 ? "hatch" : "sedan"; }

// ---- the police car ------------------------------------------------------------
// The sedan at the police car's size (2.5 x 5.4 -- sized against HIS car), in
// three meshes so the livery can be swapped as before: `body` (the paint),
// `panel` (the doors, the scheme's second colour) and the fixed parts --
// glass, tyres, trim and lamps -- with its wheels turning off how far it moved.
function vkPoliceParts() {
  const S = { sx: 2.5 / 3.30, sy: 0.78, sz: 5.4 / 7.55, y0: 0 };
  const M = vkMats();
  const Bb = vkBegin(Object.assign({ only: m => m.t === 1 }, S));
  VK_SHAPES.sedan(Bb, M, { mirror: M.s });
  const Bf = vkBegin(Object.assign({ only: m => m.t !== 1 }, S));
  VK_SHAPES.sedan(Bf, M, { mirror: M.s });
  const Bp = vkBegin(S);
  vkSideDecal(Bp, [[-1.35, 0.62], [1.55, 0.62], [1.55, 1.30], [-1.35, 1.30]], 1.64, { c: 0xffffff, l: ART_LAYER.deck });
  const mat = vkMaterial(false);
  const fixed = new THREE.Mesh(vkGeometry(Bf), mat);
  // the wheels turn by how far the car moved along its nose since it was last drawn
  const last = new THREE.Vector3(NaN, 0, 0), now = new THREE.Vector3(), nose = new THREE.Vector3();
  fixed.onBeforeRender = function () {
    now.setFromMatrixPosition(this.matrixWorld);
    if (last.x === last.x) {
      nose.setFromMatrixColumn(this.matrixWorld, 2);
      const d = -(now.x - last.x) * nose.x - (now.z - last.z) * nose.z;
      if (Math.abs(d) < 40) mat.userData.vk.vkSpinU.value = (mat.userData.vk.vkSpinU.value + d / (0.54 * S.sz)) % (Math.PI * 2);
    }
    last.copy(now);
  };
  return {
    body: vkGeometry(Bb), panel: vkGeometry(Bp), fixed,
    roof: 2.25 * S.sy, roofZ: 0.55 * S.sz,
  };
}
