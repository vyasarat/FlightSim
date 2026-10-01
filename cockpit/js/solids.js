"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE ONE SOLIDS REGISTRY.
//
// The bug kept coming back in one shape: a solid was only solid for the
// vehicle it had been built for. The boat swept `harbor.solids` and never saw
// the lock walls beside it; the rover and the drone had no list at all and
// drove through the whole of the Mars base; the bore had a lining you could
// see and nothing you could hit. Each vehicle had its own idea of "solid", and
// each idea was a list someone had to remember to add to.
//
// So there is ONE rule now:
//   1. Everything solid registers ONCE, here, through `solidAdd` (or
//      `addSolidBox`, which is the same call). It says what it is (`kind`, one
//      of SOLID_KINDS -- that is what the matrix check is indexed by) and whom
//      it blocks (`blocks`, a mask of SOLID classes; DEFAULT: EVERYONE).
//   2. Every vehicle asks the same question of the same registry:
//      `solidQuery(x, y, z, r, cls, baseY)`. Its radius and its class come
//      from the vehicle contract (vehicles.js). No vehicle keeps a list.
//   3. What a hit DOES is the vehicle's business and one law for all of them:
//      over its `crawl` speed a bang and a free reassembly, at or under it a
//      shove out of the thing. That lives in `resolveSolidWalls` (collision.js)
//      for the vehicles that share the world frame, and in `solidResolveAt`
//      for the ones on a sphere (the rover and the drone).
//
// SHAPES. Every record carries a world bounding box -- x, z, hw, hd, y0, y1 --
// because a dozen callers (the crash warning, the respawn, spawn clearance,
// street pruning) read exactly those fields and always have. A record may add
// an exact shape inside that box:
//   (none)  the box itself, axis-aligned: every building, quay and pier
//   `o3`    an oriented box {c, u, v, w, e}: the bore's walls and roof, which
//           follow the road's bearing, and anything standing on a sphere
//   `cap`   a capsule {a, b, r}: a dome, a mast, a parked Starship
// The exact test runs only once the bounding box has said "maybe".
//
// `pad` (optional, metres, usually negative) trims the body radius for one
// record. A sphere is a fair body for most things and a poor one beside a long
// thin thing: the car's 3 m radius against a parked car's flank called a
// touch where the old box-against-box test (4.2 m SUV, 3.4 m sedan) did not.
//
// `baseY` is the one allowance, and it is old: a box whose top is under
// baseY + 1 is ground to stand on, not a wall. The rocket's base, a car on a
// flyover, a plane rolling over a kerb.
//
// Hidden records (`isSolidHidden`, collision.js) are skipped: nothing solid is
// ever invisible.
// ---------------------------------------------------------------------------

// Who a solid blocks. A vehicle is exactly one class.
const SOLID = { AIR: 1, CAR: 2, BOAT: 4, ROVER: 8, ALL: 15 };

// What a solid IS. The matrix check drives every vehicle into every one of
// these; add a kind here and the check grows a column.
const SOLID_KINDS = ["building", "wall", "pillar", "tunnel", "portal", "ramp", "rock",
                     "dome", "pad", "parked", "crane", "container", "ship", "bridge"];

const staticSolids = [];   // registered once, at build time
const trainSolids = [];    // the freight train: rebuilt every frame it runs
const surfSolids = [];     // on a sphere (Mars, the Moon): built with the base, cleared with it

function solidAdd(b, kind, blocks) {
  if (!b.kind) b.kind = kind || "building";
  if (b.blocks === undefined) b.blocks = blocks === undefined ? SOLID.ALL : blocks;
  staticSolids.push(b);
  return b;
}
function addSolidBox(x, y0, z, hw, hd, y1, mesh, kind, blocks) {
  return solidAdd({ x, y0, z, hw, hd, y1, mesh }, kind, blocks);
}

// An oriented box: centre, three unit axes and half extents along them. Its
// bounding box is written for the callers that only read that.
function solidBox3(cx, cy, cz, u, v, w, eu, ev, ew, kind, blocks, list) {
  const b = { o3: { c: [cx, cy, cz], u, v, w, e: [eu, ev, ew] }, kind: kind || "building",
              blocks: blocks === undefined ? SOLID.ALL : blocks };
  solidBound3(b);
  (list || staticSolids).push(b);
  return b;
}
function solidBound3(b) {
  const o = b.o3, c = o.c, e = o.e, A = [o.u, o.v, o.w];
  const ext = [0, 0, 0];
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) ext[k] += Math.abs(A[j][k]) * e[j];
  b.x = c[0]; b.z = c[2]; b.hw = ext[0]; b.hd = ext[2]; b.y0 = c[1] - ext[1]; b.y1 = c[1] + ext[1];
}
// A capsule from a to b, radius r.
function solidCapsule(a, bb, r, kind, blocks, list) {
  const b = { cap: { a, b: bb, r }, kind: kind || "pillar", blocks: blocks === undefined ? SOLID.ALL : blocks };
  b.x = (a[0] + bb[0]) / 2; b.z = (a[2] + bb[2]) / 2;
  b.hw = Math.abs(a[0] - bb[0]) / 2 + r; b.hd = Math.abs(a[2] - bb[2]) / 2 + r;
  b.y0 = Math.min(a[1], bb[1]) - r; b.y1 = Math.max(a[1], bb[1]) + r;
  (list || staticSolids).push(b);
  return b;
}

// Every solid in the world, in one walk. (The harness's copy in main.js calls
// this; it used to be a second hand-written loop that could drift.)
function forEachSolid(cb) {
  for (const b of buildingBoxes) cb(b);
  for (const b of staticSolids) cb(b);
  for (const arr of streamedSolids.values()) for (const b of arr) cb(b);
  for (const b of trainSolids) cb(b);
  for (const b of surfSolids) cb(b);
}

// The kind of a record that predates kinds (a streamed town building, a train
// car): building unless it says otherwise.
function solidKind(b) { return b.kind || (b.car !== undefined ? "parked" : "building"); }
function solidBlocks(b, cls) { return ((b.blocks === undefined ? SOLID.ALL : b.blocks) & cls) !== 0; }

// ---- the exact tests. Each answers null, or how deep a sphere of radius r at
// (x, y, z) is into the thing and which way is out.
const solidOut = { d: 0, nx: 0, ny: 0, nz: 0 };

function solidTestAabb(b, x, y, z, r, flat) {
  const ex = b.hw + r, ez = b.hd + r;
  if (!(x > b.x - ex && x < b.x + ex && z > b.z - ez && z < b.z + ez)) return null;
  if (!(y > b.y0 - r && y < b.y1 + r)) return null;
  // Out through the face it is nearest -- the rule resolveSolidWalls always had.
  // `flat`: something on wheels or a hull is only ever pushed out sideways.
  let d = (b.x + ex) - x, nx = 1, ny = 0, nz = 0, q;
  if ((q = x - (b.x - ex)) < d) { d = q; nx = -1; ny = 0; nz = 0; }
  if ((q = (b.z + ez) - z) < d) { d = q; nx = 0; ny = 0; nz = 1; }
  if ((q = z - (b.z - ez)) < d) { d = q; nx = 0; ny = 0; nz = -1; }
  if (!flat && (q = (b.y1 + r) - y) < d) { d = q; nx = 0; ny = 1; nz = 0; }
  if (!flat && (q = y - (b.y0 - r)) < d) { d = q; nx = 0; ny = -1; nz = 0; }
  solidOut.d = d; solidOut.nx = nx; solidOut.ny = ny; solidOut.nz = nz;
  return solidOut;
}

function solidTestBox3(o, x, y, z, r) {
  const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2];
  const A = [o.u, o.v, o.w], L = [0, 0, 0];
  for (let j = 0; j < 3; j++) L[j] = dx * A[j][0] + dy * A[j][1] + dz * A[j][2];
  let inside = true, dist2 = 0;
  const cl = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    cl[j] = Math.max(-o.e[j], Math.min(o.e[j], L[j]));
    if (cl[j] !== L[j]) inside = false;
    dist2 += (L[j] - cl[j]) * (L[j] - cl[j]);
  }
  if (!inside) {
    if (dist2 >= r * r) return null;
    const dist = Math.sqrt(dist2) || 1e-6;
    let nx = 0, ny = 0, nz = 0;
    for (let j = 0; j < 3; j++) { const k = (L[j] - cl[j]) / dist; nx += A[j][0] * k; ny += A[j][1] * k; nz += A[j][2] * k; }
    solidOut.d = r - dist; solidOut.nx = nx; solidOut.ny = ny; solidOut.nz = nz;
    return solidOut;
  }
  // the centre is inside: out through the nearest face
  let best = Infinity, bj = 0, bs = 1;
  for (let j = 0; j < 3; j++) {
    const up = o.e[j] - L[j], dn = L[j] + o.e[j];
    if (up < best) { best = up; bj = j; bs = 1; }
    if (dn < best) { best = dn; bj = j; bs = -1; }
  }
  solidOut.d = best + r; solidOut.nx = A[bj][0] * bs; solidOut.ny = A[bj][1] * bs; solidOut.nz = A[bj][2] * bs;
  return solidOut;
}

function solidTestCap(c, x, y, z, r) {
  const a = c.a, b = c.b;
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2));
  const px = x - (a[0] + abx * t), py = y - (a[1] + aby * t), pz = z - (a[2] + abz * t);
  const d = Math.hypot(px, py, pz), R = c.r + r;
  if (d >= R) return null;
  const k = d > 1e-6 ? 1 / d : 0;
  solidOut.d = R - d; solidOut.nx = px * k; solidOut.ny = d > 1e-6 ? py * k : 1; solidOut.nz = pz * k;
  return solidOut;
}

// ---- RAMPS are surfaces, not trigger zones. A ramp is the solid volume under
// a height profile h(t) = rise * t^k, t = 0 at its foot and 1 at its lip, k
// set so the LIP's slope is `lipSlope` (the launch angle is the lip's, not the
// average's -- that is what a kicker is). To anything flying it is a wedge to
// hit like any wall; the rover (rover.js) drives UP it, and leaves the lip
// with the vertical speed the slope gives it, and nothing else.
//   o: the foot's centre on the ground   dir: uphill   up: the ground normal
//   side = dir x up (a right-handed frame on whatever it stands on)
function solidRamp(o, dir, up, len, rise, w, lipSlope, list, extra) {
  const side = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]];
  const k = Math.max(1, lipSlope * len / rise);
  const rp = { o, dir, up, side, len, rise, w, k };
  const b = { ramp: rp, kind: "ramp", blocks: SOLID.ALL, ...(extra || {}) };
  // bounding box: the eight corners of its box
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const a of [0, len]) for (const sv of [-w / 2, w / 2]) for (const hv of [-1, rise]) {
    const X = o[0] + dir[0] * a + side[0] * sv + up[0] * hv, Y = o[1] + dir[1] * a + side[1] * sv + up[1] * hv,
          Z = o[2] + dir[2] * a + side[2] * sv + up[2] * hv;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z);
  }
  b.x = (x0 + x1) / 2; b.z = (z0 + z1) / 2; b.hw = (x1 - x0) / 2; b.hd = (z1 - z0) / 2; b.y0 = y0; b.y1 = y1;
  (list || surfSolids).push(b);
  return b;
}
function solidRampH(rp, a) {
  const t = Math.max(0, Math.min(1, a / rp.len));
  return rp.rise * Math.pow(t, rp.k);
}
function solidRampSlope(rp, a) {
  const t = Math.max(0, Math.min(1, a / rp.len));
  return rp.rise * rp.k * Math.pow(t, rp.k - 1) / rp.len;
}
// Where a point is in a ramp's own frame: along, across, and height over its ground.
function solidRampLocal(rp, x, y, z, out) {
  const dx = x - rp.o[0], dy = y - rp.o[1], dz = z - rp.o[2];
  out.a = dx * rp.dir[0] + dy * rp.dir[1] + dz * rp.dir[2];
  out.s = dx * rp.side[0] + dy * rp.side[1] + dz * rp.side[2];
  out.h = dx * rp.up[0] + dy * rp.up[1] + dz * rp.up[2];
  return out;
}
const solidRampTmp = { a: 0, s: 0, h: 0 };
function solidTestRamp(rp, x, y, z, r) {
  const L = solidRampLocal(rp, x, y, z, solidRampTmp);
  if (L.a < -r || L.a > rp.len + r || Math.abs(L.s) > rp.w / 2 + r || L.h < -1 - r) return null;
  const top = solidRampH(rp, L.a);
  if (L.h > top + r) return null;
  // out through the nearest of: the surface, either side, the lip's back face
  const cand = [
    { d: top + r - L.h, n: rp.up },
    { d: rp.w / 2 + r - L.s, n: rp.side },
    { d: L.s + rp.w / 2 + r, n: [-rp.side[0], -rp.side[1], -rp.side[2]] },
    { d: rp.len + r - L.a, n: rp.dir },
  ];
  let best = cand[0];
  for (const c of cand) if (c.d < best.d) best = c;
  solidOut.d = best.d; solidOut.nx = best.n[0]; solidOut.ny = best.n[1]; solidOut.nz = best.n[2];
  return solidOut;
}

// Is a sphere of radius r at (x, y, z) into this record? Bounding box first.
// `flat` (a vehicle on the ground): the way out is always sideways. A box over
// the bonnet -- a launch mount's slab 2.8 m up, lower than the car's roof --
// is nearest through its underside, and a push DOWN does nothing for a car: it
// crept in under the slab and out the other side.
function solidTest(b, x, y, z, r, flat) {
  if (b.pad) r = Math.max(0.3, r + b.pad);
  const ex = b.hw + r, ez = b.hd + r;
  if (!(x > b.x - ex && x < b.x + ex && z > b.z - ez && z < b.z + ez)) return null;
  if (!(y > b.y0 - r && y < b.y1 + r)) return null;
  if (!b.o3 && !b.cap && !b.ramp) return solidTestAabb(b, x, y, z, r, flat);
  const t = b.o3 ? solidTestBox3(b.o3, x, y, z, r) : b.cap ? solidTestCap(b.cap, x, y, z, r) : solidTestRamp(b.ramp, x, y, z, r);
  if (t && flat && Math.abs(t.ny) > 0.7) {
    // straight up or down: out through the nearest side instead
    const o = b.o3;
    if (o) {
      let best = Infinity, bn = null;
      for (const ax of [o.u, o.w]) {
        if (Math.abs(ax[1]) > 0.5) continue;
        const e = ax === o.u ? o.e[0] : o.e[2];
        const L = (x - o.c[0]) * ax[0] + (z - o.c[2]) * ax[2];
        for (const sg of [1, -1]) { const d = e + r - sg * L; if (d < best) { best = d; bn = [ax[0] * sg, ax[2] * sg]; } }
      }
      if (bn) { t.d = best; t.nx = bn[0]; t.ny = 0; t.nz = bn[1]; }
    } else {
      const h = Math.hypot(x - b.x, z - b.z) || 1;
      t.nx = (x - b.x) / h; t.ny = 0; t.nz = (z - b.z) / h; t.d = Math.max(t.d, r);
    }
  }
  return t;
}

// THE question. The first solid (in registry order, as resolveSolidWalls always
// took) that this class of vehicle cannot pass, or null. The result is a fresh
// object, safe to keep.
function solidQuery(x, y, z, r, cls, baseY, skip, flat) {
  let hit = null;
  forEachSolid(b => {
    if (hit) return;
    if (!solidBlocks(b, cls)) return;
    if (isSolidHidden(b)) return;
    if (skip && skip(b)) return;
    if (baseY !== undefined && baseY >= b.y1 - 1) return;
    const t = solidTest(b, x, y, z, r, flat);
    if (t) hit = { b, kind: solidKind(b), d: t.d, nx: t.nx, ny: t.ny, nz: t.nz };
  });
  return hit;
}

// Every hit, counted per vehicle and per kind, for the matrix check and for
// whoever reads the flags: `flags.solidHits["car:tunnel"]`.
function solidCount(veh, kind, what) {
  const k = veh + ":" + kind + ":" + what;
  const h = flags.solidHits || (flags.solidHits = {});
  h[k] = (h[k] || 0) + 1;
}

// The same question for a HULL: a vertical column of radius r from yLo to yHi,
// pushed out sideways only. A boat is not a ball -- a sphere of the yacht's 17 m
// would snag a deck high over her -- and nothing ever shoves a hull up or down.
function solidCol(x, z, yLo, yHi, r, cls, skip) {
  let hit = null;
  forEachSolid(b => {
    if (hit) return;
    if (!solidBlocks(b, cls)) return;
    if (isSolidHidden(b)) return;
    if (skip && skip(b)) return;
    if (b.y1 < yLo || b.y0 > yHi) return;
    const rr = b.pad ? Math.max(0.3, r + b.pad) : r;
    const ex = b.hw + rr, ez = b.hd + rr;
    if (!(x > b.x - ex && x < b.x + ex && z > b.z - ez && z < b.z + ez)) return;
    let t = null;
    if (b.o3 || b.cap || b.ramp) {
      // sample the exact shape up the column
      const n = Math.max(1, Math.ceil((yHi - yLo) / Math.max(1, rr)));
      for (let i = 0; i <= n && !t; i++) {
        const y = yLo + (yHi - yLo) * i / n;
        const q = b.o3 ? solidTestBox3(b.o3, x, y, z, rr) : b.cap ? solidTestCap(b.cap, x, y, z, rr) : solidTestRamp(b.ramp, x, y, z, rr);
        if (q) { const h = Math.hypot(q.nx, q.nz) || 1; t = { d: q.d, nx: q.nx / h, nz: q.nz / h }; }
      }
    } else {
      let d = (b.x + ex) - x, nx = 1, nz = 0, q;
      if ((q = x - (b.x - ex)) < d) { d = q; nx = -1; nz = 0; }
      if ((q = (b.z + ez) - z) < d) { d = q; nx = 0; nz = 1; }
      if ((q = z - (b.z - ez)) < d) { d = q; nx = 0; nz = -1; }
      t = { d, nx, nz };
    }
    if (t) hit = { b, kind: solidKind(b), d: t.d, nx: t.nx, ny: 0, nz: t.nz };
  });
  return hit;
}

// Where a hull reassembles: walked out of anything within `r` of it, `pad`
// metres clear, a few steps at most.
function solidClearHull(x, z, r, pad) {
  for (let i = 0; i < 6; i++) {
    const h = solidCol(x, z, TUNE.waterLevel - 0.5, TUNE.waterLevel + 3, r, SOLID.BOAT);
    if (!h) break;
    x += h.nx * (h.d + pad * 0.25); z += h.nz * (h.d + pad * 0.25);
  }
  return { x, z };
}

// Surface solids belong to whatever built them (the Mars base, the rover's
// toys); each clears its own when it goes.
function solidDropOwner(owner) {
  for (let i = surfSolids.length - 1; i >= 0; i--) if (surfSolids[i].owner === owner) surfSolids.splice(i, 1);
}

// A toy that moves (a boulder he shoves): a ball in the registry that follows
// it. The rover shoves toys by their own rules (rover.js, marsbase.js) and
// skips them here; everything else meets them as solid.
function solidToyBall(x, y, z, r, owner, mesh) {
  const sb = solidCapsule([x, y, z], [x, y, z], r, "rock", SOLID.ALL, surfSolids);
  sb.owner = owner; sb.toy = true; sb.mesh = mesh || null;
  if (mesh) mesh.userData.noShatter = true;
  return sb;
}
function solidFollow(sb, x, y, z) {
  const c = sb.cap, r = c.r;
  c.a[0] = c.b[0] = x; c.a[1] = c.b[1] = y; c.a[2] = c.b[2] = z;
  sb.x = x; sb.z = z; sb.y0 = y - r; sb.y1 = y + r;
}
