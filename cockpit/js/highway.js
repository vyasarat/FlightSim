"use strict";
// WORKING RULES
// One continuous divided highway from the New York airport to the California
// airport, built once at load from TUNE.highway.
//
// Bridges and tunnels are NOT authored anywhere. The centreline is sampled every
// `step` metres, the ground height under it is SMOOTHED the way a real road is
// graded, and then: where the graded road sits well above the ground it becomes
// a bridge on piers, and where the ground sits well above the road it becomes a
// tunnel. Move a control point in TUNE and the harbour bridge, the mountain
// tunnel and the canyon crossing all move with it. Nothing here is placed by
// hand except the exits, which are given as a fraction along the road.
//
// hwyNearest() is called every frame by the car, so the samples are kept in a
// z-ordered array and searched by bisection, not scanned.

const HW = TUNE.highway;

const highway = {
  g: null, pts: [], length: 0, halfW: 0,
  traffic: [], trafficMesh: null, truckMesh: null,
  exits: [], charges: [], built: false,
};

// ---------------------------------------------------------------------------
// The centreline
// ---------------------------------------------------------------------------
function hwyBuildSpline() {
  const cps = HW.route.map(([z, x]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(cps, false, "catmullrom", 0.5);
  // walk the curve at a fixed arc-length step so `s` is metres, not parameter
  const approx = curve.getLength();
  const n = Math.max(64, Math.round(approx / HW.step));
  const spaced = curve.getSpacedPoints(n);
  const pts = [];
  let run = 0;
  for (let i = 0; i < spaced.length; i++) {
    const p = spaced[i];
    if (i > 0) run += Math.hypot(p.x - spaced[i - 1].x, p.z - spaced[i - 1].z);
    pts.push({ x: p.x, z: p.z, s: run, ground: 0, y: 0, type: "ground", fx: 0, fz: -1 });
  }
  // forward direction at each sample
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    pts[i].fx = dx / len; pts[i].fz = dz / len;
  }
  highway.pts = pts;
  highway.length = run;
  return pts;
}

// The graded height profile, and the structures that fall out of it.
function hwyGrade() {
  const pts = highway.pts;
  for (const p of pts) p.ground = Math.max(terrainEff(p.x, p.z), TUNE.waterLevel);

  // 1. smooth the ground the way a survey would
  for (let pass = 0; pass < 2; pass++) {
    const src = pts.map(p => (pass ? p.y : p.ground));
    for (let i = 0; i < pts.length; i++) {
      let sum = 0, n = 0;
      for (let k = -HW.grade; k <= HW.grade; k++) {
        const j = i + k;
        if (j < 0 || j >= pts.length) continue;
        sum += src[j]; n++;
      }
      pts[i].y = sum / n;
    }
  }

  // 2. limit the gradient, both directions, both ways. Clamping how fast it may
  // RISE cuts the tops off hills -- that is what makes the mountain tunnel.
  // Clamping how fast it may FALL carries it over valleys -- that is what makes
  // the canyon and harbour bridges. Neither is authored anywhere.
  const rise = HW.maxSlope * HW.step;
  for (let i = 1; i < pts.length; i++) pts[i].y = Math.min(pts[i].y, pts[i - 1].y + rise);
  for (let i = pts.length - 2; i >= 0; i--) pts[i].y = Math.min(pts[i].y, pts[i + 1].y + rise);
  for (let i = 1; i < pts.length; i++) pts[i].y = Math.max(pts[i].y, pts[i - 1].y - rise);
  for (let i = pts.length - 2; i >= 0; i--) pts[i].y = Math.max(pts[i].y, pts[i + 1].y - rise);

  // 3. classify, THEN clamp. Doing it the other way round -- forcing the road
  // to sit above the ground first -- makes a tunnel arithmetically impossible,
  // which is exactly how the first cut of this ended up with none.
  for (const p of pts) {
    const raw = terrainEff(p.x, p.z);
    p.overWater = raw < TUNE.waterLevel + 0.5;
    p.type = (raw - p.y) > HW.tunnelAt ? "tunnel"
           : (p.y - p.ground) > HW.bridgeAt ? "bridge" : "ground";
    if (p.type !== "tunnel") p.y = Math.max(p.y, p.ground + HW.clearance);
    if (p.overWater) { p.y = Math.max(p.y, TUNE.waterLevel + HW.deckMin); p.type = "bridge"; }
  }
  // a bore is straight: hold one grade from portal to portal
  hwyBores.length = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].type !== "tunnel") continue;
    let a = i; while (a > 0 && pts[a - 1].type === "tunnel") a--;
    let b = i; while (b < pts.length - 1 && pts[b + 1].type === "tunnel") b++;
    const y0 = pts[Math.max(0, a - 1)].y, y1 = pts[Math.min(pts.length - 1, b + 1)].y;
    for (let k = a; k <= b; k++) pts[k].y = lerp(y0, y1, (k - a) / Math.max(1, b - a));
    // The bore is the tunnelled samples and nothing more. The cut feathers out
    // over `boreBlend` past each end on its own, which is the approach cutting
    // the portal stands in -- lidding that too would put the road under the
    // mountain before it reached the tunnel mouth.
    hwyBores.push({ a, b, pts: pts.slice(a, b + 1) });
    i = b;
  }
  // Only now: everything above asked terrainEff for the UNCUT mountain, which is
  // what let it find a tunnel in the first place.
  hwyIndexBores();
}

// ---- queries the car lives on ---------------------------------------------
// Bisection on z, then a short local walk: the route is monotonic in z.
function hwySampleAt(s) {
  const pts = highway.pts;
  const f = clamp(s, 0, highway.length) / HW.step;
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(f)));
  const t = clamp(f - i, 0, 1);
  const a = pts[i], b = pts[i + 1];
  return {
    x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t),
    fx: lerp(a.fx, b.fx, t), fz: lerp(a.fz, b.fz, t),
    type: t < 0.5 ? a.type : b.type, i,
  };
}

// Nearest point on the road to a world position. Returns the arc length `s`,
// the signed lateral offset (positive to the road's right) and the road height.
//
// This is a FULL scan, deliberately. It used to bisect on z and then search six
// samples either side, which is wrong wherever the road curves enough that the
// nearest sample by z is not the nearest by distance: it returned a point from
// the wrong stretch, and the height came back with it. That is what drove the
// car seven metres under the road surface while it sat in its own lane. Three
// hundred samples times a handful of calls a frame is a thousand distance
// checks -- nothing next to a single draw call.
const hwyTmp = { };
function hwyNearest(x, z) {
  const pts = highway.pts;
  if (!pts.length) return null;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].x - x, dz = pts[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  // refine onto the better of the two neighbouring segments, and interpolate --
  // taking the sample's own height made a staircase of up to 1.8 m per step
  let bi = best, bt = 0, bd = Infinity;
  for (const i of [best - 1, best]) {
    if (i < 0 || i >= pts.length - 1) continue;
    const a = pts[i], b = pts[i + 1];
    const ex = b.x - a.x, ez = b.z - a.z;
    const len2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / len2, 0, 1);
    const px = a.x + ex * t, pz = a.z + ez * t;
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const a = pts[bi], b = pts[bi + 1] || pts[bi];
  const fx = lerp(a.fx, b.fx, bt), fz = lerp(a.fz, b.fz, bt);
  const flen = Math.hypot(fx, fz) || 1;
  const nx = fx / flen, nz = fz / flen;
  const px = lerp(a.x, b.x, bt), pz = lerp(a.z, b.z, bt);
  const rx = -nz, rz = nx;                      // road's right-hand vector
  hwyTmp.s = lerp(a.s, b.s, bt);
  hwyTmp.lateral = (x - px) * rx + (z - pz) * rz;
  hwyTmp.y = lerp(a.y, b.y, bt);
  hwyTmp.fx = nx; hwyTmp.fz = nz;
  hwyTmp.type = bt < 0.5 ? a.type : b.type;
  hwyTmp.i = bi;
  return hwyTmp;
}

// ---------------------------------------------------------------------------
// THE BORE: the mountain taken out of the way.
//
// The surveyor classified 800 metres of the route as tunnel and the builder put
// a concrete tube along it, and that is where it stopped: the mountain was still
// a solid heightfield, so the tube was buried inside it and the road dived into
// rock. A tunnel you cannot see into is not a tunnel.
//
// A heightfield cannot have a hole in it. So the mountain is CUT down to the
// road along the bore -- `hwyBoreCut`, which `terrainEff` calls, so that every
// spawn, every scenery placement and the terrain mesh agree -- and the cut is
// then LIDDED with the material that was removed (`hwyBuildBore`), sampled from
// the uncut ground at the same colours the chunks use. From outside it is the
// same mountain; from the road it is a tunnel.
//
// Nothing here runs until the surveyor has finished: `hwyBores` is empty while
// hwyGrade is classifying, so the grading pass sees the uncut mountain. That
// ordering is what makes a tunnel possible at all -- cut first and the road
// would never sit far enough below the ground to be classified as one.
// ---------------------------------------------------------------------------
const hwyBores = [];              // one entry per run of tunnel samples
const hwyBoreIndex = new Map();   // cell -> the bore samples that could reach it

function hwyBoreCell(x, z) {
  return Math.floor(x / HW.clearCell) + "," + Math.floor(z / HW.clearCell);
}

function hwyIndexBores() {
  hwyBoreIndex.clear();
  const reach = HW.boreBlend + HW.boreLidOver + HW.clearCell;
  const span = Math.ceil(reach / HW.clearCell);
  for (const bore of hwyBores) {
    for (const p of bore.pts) {
      const cx = Math.floor(p.x / HW.clearCell), cz = Math.floor(p.z / HW.clearCell);
      for (let dx = -span; dx <= span; dx++) {
        for (let dz = -span; dz <= span; dz++) {
          const k = (cx + dx) + "," + (cz + dz);
          let list = hwyBoreIndex.get(k);
          if (!list) hwyBoreIndex.set(k, list = []);
          list.push(p);
        }
      }
    }
  }
}

// How low the ground has to be here for the bore to be clear of it, and how far
// the cut has feathered back by this point. Returns the original height wherever
// there is no bore.
function hwyBoreCut(x, z, h) {
  if (!hwyBores.length) return h;
  const list = hwyBoreIndex.get(hwyBoreCell(x, z));
  if (!list) return h;
  let best = null, bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const dx = list[i].x - x, dz = list[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = list[i]; }
  }
  const d = Math.sqrt(bd);
  if (d >= HW.boreBlend) return h;
  const floor = best.y - 1;                       // just under the carriageway
  if (h <= floor) return h;
  const t = 1 - smoothstep(HW.boreCut, HW.boreBlend, d);   // 1 inside the tube, 0 at the feather
  return lerp(h, Math.min(h, floor), t);
}

// ---------------------------------------------------------------------------
// THE CORRIDOR: the strip nothing else may stand in.
//
// Trees, towns and landmarks are placed from a hash of their grid cell, and the
// only thing that ever kept them out of anything was `inCorridor` in scenery.js
// -- which knew about the two AIRPORTS and nothing else. The road was laid
// through the middle of all of it, so buildings stood in the carriageway from
// the day the road shipped.
//
// The test has to be cheap: it is asked once per candidate tree and once per
// candidate building on every scenery rebuild, thousands of times. So the road,
// its spurs and its ramps are claimed as a flat list of nodes once at load, and
// bucketed into a coarse grid; the question then costs one Map lookup and a
// handful of distance checks against the few nodes that could possibly be near.
//
// Everything drivable claims: the carriageway, every exit spur, and every
// interchange ramp. `hwyClaimCorridor` is called as each is built, so a new
// piece of road cannot be forgotten -- it claims itself.
// ---------------------------------------------------------------------------
const hwyCorridorNodes = [];
const hwyCorridorIndex = new Map();

function hwyClaimCorridor(pts) {
  for (const p of pts) hwyCorridorNodes.push({ x: p.x, z: p.z });
}

const hwyCell = (x, z) => Math.floor(x / HW.clearCell) + "," + Math.floor(z / HW.clearCell);

function hwyIndexCorridor() {
  hwyCorridorIndex.clear();
  // Reach far enough that a query anywhere in a cell finds every node that
  // could be inside the widest margin anyone asks for.
  const reach = HW.clearHalf + HW.clearMaxExtra + HW.clearCell;
  const span = Math.ceil(reach / HW.clearCell);
  for (const n of hwyCorridorNodes) {
    const cx = Math.floor(n.x / HW.clearCell), cz = Math.floor(n.z / HW.clearCell);
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const k = (cx + dx) + "," + (cz + dz);
        let list = hwyCorridorIndex.get(k);
        if (!list) hwyCorridorIndex.set(k, list = []);
        list.push(n);
      }
    }
  }
}

// Metres from here to the nearest piece of road, or Infinity if nothing is near.
function hwyCorridorDist(x, z) {
  const list = hwyCorridorIndex.get(hwyCell(x, z));
  if (!list) return Infinity;
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    const dx = list[i].x - x, dz = list[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// How high anything following the road may ride here before it is through the
// roof of a bore. Null out in the open. The chase camera asks; it normally sits
// higher than a 15 m crown, and from up there the tunnel is a pipe below it.
function hwyBoreCeiling(x, z) {
  if (!hwyBores.length) return null;
  const list = hwyBoreIndex.get(hwyBoreCell(x, z));
  if (!list) return null;
  let best = null, bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const dx = list[i].x - x, dz = list[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = list[i]; }
  }
  // only once he is properly inside -- a portal should not duck the camera from
  // fifty metres out
  // The farthest he can be from a centreline node while still in the tube is
  // half a step along (20 m) and the outer edge of a carriageway across (21 m),
  // so 34 covers inside and excludes anything past the portal.
  const gate = HW.step * 0.85;
  if (bd > gate * gate) return null;
  return best.y + HW.tunnelR * 1.05;
}

// `extra` is the caller's own clearance on top of the road's -- a hundred-metre
// radio tower wants far more room than a shrub.
function hwyInCorridor(x, z, extra) {
  return hwyCorridorDist(x, z) < HW.clearHalf + Math.min(extra || 0, HW.clearMaxExtra);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
// UVs are the carriageway tile's, in metres (art.js "road": 17.5 m across, 12 m
// along): u from the median edge outward, so both carriageways paint their
// lanes on the right side of the tile, and v the distance along the road.
function hwyStrip(pts, halfL, halfR, yOff, mat, closeEnds) {
  const pos = [], idx = [], uv = [];
  const uL = (Math.abs(halfL) - HW.medianW / 2) / 17.5, uR = (Math.abs(halfR) - HW.medianW / 2) / 17.5;
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], rx = -p.fz, rz = p.fx;
    if (i > 0) along += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    pos.push(p.x + rx * halfL, p.y + yOff, p.z + rz * halfL);
    pos.push(p.x + rx * halfR, p.y + yOff, p.z + rz * halfR);
    uv.push(uL, along / 12, uR, along / 12);
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

function hwyBuild() {
  if (highway.built) return;
  hwyBuildSpline();
  hwyGrade();
  hwyClaimCorridor(highway.pts);
  const C = TUNE.palette;
  const pts = highway.pts;
  const roadHalf = HW.lanes * HW.laneW + HW.shoulder;
  highway.halfW = roadHalf + HW.medianW / 2;
  const g = new THREE.Group();

  const steel = metalMat(C.steel, 30);
  const conc = artPaint(mattMat(C.concrete), "concrete");

  // two carriageways, a median between them. The lane paint is the road
  // tile's (art.js): a solid line at each edge and the divider dashed 3 m in
  // every 12 -- it replaced a 9 m box every 160 m, which is why no lane was
  // ever visible from the car.
  const lanes = artPaint(mattMat(TUNE.runwaySurfaceColor), "road");
  g.add(hwyStrip(pts, -highway.halfW, -HW.medianW / 2, 0, lanes));
  g.add(hwyStrip(pts, HW.medianW / 2, highway.halfW, 0, lanes));
  g.add(hwyStrip(pts, -HW.medianW / 2, HW.medianW / 2, 0.35, artPaint(mattMat(C.grassMid), "grass")));

  // guardrails down both outer edges
  for (const side of [-1, 1]) {
    const rail = pts.map(p => ({ x: p.x, z: p.z, y: p.y + HW.railH, fx: p.fx, fz: p.fz }));
    g.add(hwyStrip(rail, side * highway.halfW, side * (highway.halfW - HW.railT), 0, steel));
  }

  // piers under every bridge run, and a tunnel tube through every mountain run
  const piers = [], tunnels = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.type === "bridge" && i % HW.pierEvery === 0) piers.push(p);
    if (p.type === "tunnel") tunnels.push(p);
  }
  if (piers.length) {
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(HW.pierW, 1, HW.pierW), conc, piers.length);
    const d = new THREE.Object3D();
    piers.forEach((p, k) => {
      const h = Math.max(2, p.y - p.ground);
      d.position.set(p.x, p.ground + h / 2, p.z);
      d.scale.set(1, h, 1);
      d.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
      d.updateMatrix(); pm.setMatrixAt(k, d.matrix);
    });
    pm.castShadow = true;
    g.add(pm);
    highway.piers = piers;
  }
  if (tunnels.length) hwyBuildBore(g, conc, steel);

  hwyBuildInterchanges(g, conc, steel);
  hwyBuildExits(g);
  hwyBuildTraffic(g);

  // A NaN anywhere in the profile silently poisons every geometry built from it,
  // and the only symptom is a console warning from computeBoundingSphere.
  for (const p of highway.pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      console.error("highway: non-finite centreline sample", p);
      break;
    }
  }
  hwyIndexCorridor();             // after every piece of road has claimed its ground
  castsShadow(g, false);          // the road itself never casts; its structures do
  scene.add(g);
  highway.g = g;
  highway.built = true;
  flags.highwayBuilt = (flags.highwayBuilt || 0) + 1;
}

// A stack of ramp loops at each city end: pure spectacle, and the overpass decks
// are solid so an aeroplane can fly into one and go bang like anything else.
// ---------------------------------------------------------------------------
// The bore: lining, lid and two portals.
//
// The lining was here already; what was missing is everything that makes it a
// tunnel rather than a pipe buried in a hill. `hwyBoreCut` has taken the
// mountain down to the road along the centreline, so this puts back a LID over
// the cut -- the material that was removed, sampled from the uncut ground and
// coloured by the terrain's own rule -- and stands a concrete headwall with an
// arch at each end.
//
// The lid overhangs the feather of the cut and is lifted a hand's breadth, so
// its triangles overlap the chunk's instead of meeting them: two surfaces at the
// same height along a seam z-fight, and a gap between them is a slot of sky
// through the mountain.
// ---------------------------------------------------------------------------
function hwyBuildBore(g, conc, steel) {
  const C = TUNE.palette, R = HW.tunnelR;
  // one bore over the middle of each carriageway
  const lat = (HW.medianW / 2 + highway.halfW) / 2;
  const LATS = [-lat, lat];
  // the outside of a bore at a lateral offset from the road centre: what the lid
  // has to clear
  const shellTop = (off) => {
    let top = -Infinity;
    for (const l of LATS) {
      const d = Math.abs(off - l);
      if (d < R) top = Math.max(top, R * 0.42 + Math.sqrt(R * R - d * d));
    }
    return top;
  };

  // ---- the lining. A full bore, not a half arch: the geometry is pre-rotated
  // so its axis runs along +Z and each instance only has to yaw to the road's
  // bearing. Lit from inside by its own emissive -- there is no light down
  // there, and a black tube reads as a wall he is about to hit.
  const lit = artPaint(new THREE.MeshPhongMaterial({
    color: C.concrete, emissive: 0x3a4048, flatShading: true,
    shininess: 0, specular: 0x000000, side: THREE.BackSide,
  }), "concrete");
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false });

  // A point part-way between two centreline samples. The lining is laid in whole
  // cylinders, and a cylinder centred on the first sample hangs half its length
  // out of the portal -- which is what put two grey pipes in the air in front of
  // the headwall. Laying them on the MIDPOINTS of each span keeps the lining
  // inside the mountain.
  const at = (pts, f) => {
    const i = Math.min(pts.length - 2, Math.max(0, Math.floor(f)));
    const t = clamp(f - i, 0, 1), a = pts[i], b = pts[i + 1];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
             fx: lerp(a.fx, b.fx, t), fz: lerp(a.fz, b.fz, t) };
  };

  for (const bore of hwyBores) {
    const pts = bore.pts;
    const seg = [];
    const spans = Math.max(1, Math.ceil((pts.length - 1) / HW.tunnelSeg));
    const per = (pts.length - 1) / spans;
    for (let k = 0; k < spans; k++) seg.push(at(pts, (k + 0.5) * per));

    const tube = new THREE.CylinderGeometry(R, R, per * HW.step * 1.06, 14, 1, true);
    tube.rotateX(Math.PI / 2);
    const tm = new THREE.InstancedMesh(tube, lit, seg.length * LATS.length);
    const d = new THREE.Object3D();
    let ti = 0;
    for (const l of LATS) {
      for (const p of seg) {
        const rx = -p.fz, rz = p.fx;
        // the road runs along the floor of the bore, not through its centre
        d.position.set(p.x + rx * l, p.y + R * 0.42, p.z + rz * l);
        d.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
        d.updateMatrix();
        tm.setMatrixAt(ti++, d.matrix);
      }
    }
    tm.frustumCulled = false;
    g.add(tm);

    // ---- the rock between the two bores. Without it the pair meet in a narrow
    // open wedge that the daylight above the lid comes straight down, and the
    // tunnel reads as two half-pipes in a trench rather than two tunnels.
    const pierW = (lat - R) * 2, pierH = R * 1.42 + 3;
    const pm = new THREE.InstancedMesh(
      new THREE.BoxGeometry(pierW, pierH, per * HW.step * 1.06), conc, seg.length);
    seg.forEach((p, k) => {
      d.position.set(p.x, p.y + pierH / 2 - 1.5, p.z);
      d.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      pm.setMatrixAt(k, d.matrix);
    });
    pm.frustumCulled = false;
    g.add(pm);

    // ---- crown lamps: a receding line of them is what says "there is a way
    // through here" from the approach, long before the far end is visible.
    const lampPts = [];
    for (let i = HW.boreLampEvery; i < pts.length - 1; i += HW.boreLampEvery) {
      const p = pts[i], rx = -p.fz, rz = p.fx;
      for (const l of LATS) {
        lampPts.push(new THREE.Vector3(p.x + rx * l, p.y + R * 0.42 + R * 0.72, p.z + rz * l));
      }
    }
    if (lampPts.length) {
      const lg = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.35, 1.1), lampMat, lampPts.length);
      lampPts.forEach((v, k) => {
        d.position.copy(v); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
        d.updateMatrix(); lg.setMatrixAt(k, d.matrix);
      });
      lg.frustumCulled = false;
      g.add(lg);
      g.add(glowField(lampPts, 0xffd9a0, 9, 0.42));
    }

    // ---- the lid ---------------------------------------------------------
    // Sampled from the UNCUT ground: shapedTerrain is what the mountain was
    // before hwyBoreCut took it away, so the lid is exactly the missing piece.
    const half = HW.boreBlend + HW.boreLidOver;
    const cols = Math.max(4, Math.round((half * 2) / HW.boreLidStep) | 1);
    const rows = [];
    // walk the centreline finely so the lid follows the cut, not the 40 m samples
    const fine = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.round(HW.step / HW.boreLidStep));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        // `y` matters: the lid clears the bores by the ROAD's height, and without
        // it `p.y + shellTop(off)` is `undefined + -Infinity`, which is NaN --
        // and a NaN in a position attribute poisons the whole mesh silently.
        fine.push({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t),
                    fx: lerp(a.fx, b.fx, t), fz: lerp(a.fz, b.fz, t) });
      }
    }
    fine.push(pts[pts.length - 1]);

    const pos = [], col = [], idx = [];
    const c = new THREE.Color();
    const concColor = new THREE.Color(C.concrete);
    for (let i = 0; i < fine.length; i++) {
      const p = fine[i], rx = -p.fz, rz = p.fx;
      const row = [];
      for (let k = 0; k < cols; k++) {
        const off = (k / (cols - 1) - 0.5) * 2 * half;
        const wx = p.x + rx * off, wz = p.z + rz * off;
        const natural = shapedTerrain(wx, wz) + HW.boreLidLift;
        // The lid may never dip into a bore. Near the portals the hillside is
        // thinner than the tunnel is tall, so the lid rises over the tubes -- the
        // bank of earth every big portal has in front of it -- and takes the
        // colour of structure rather than ground where it is doing that.
            const st = shellTop(off);
        const clear = Number.isFinite(st) ? p.y + st + 2 : -Infinity;
        const hy = Math.max(natural, clear);
        const banked = clamp((hy - natural) / 9, 0, 1);
        row.push(pos.length / 3);
        pos.push(wx, hy, wz);
        terrainColorAt(natural, wx, wz, c);
        c.lerp(concColor, banked * 0.75);
        col.push(c.r, c.g, c.b);
      }
      rows.push(row);
      if (i > 0) {
        const prev = rows[i - 1];
        for (let k = 0; k < cols - 1; k++) {
          // Wound so the normal points UP. The obvious order gives
          // forward x right, which is straight down: the lid rendered as a
          // one-sided floor and you looked through it into the open trench.
          idx.push(prev[k], prev[k + 1], row[k], row[k], prev[k + 1], row[k + 1]);
        }
      }
    }
    // The two cut faces, closing the ends of the lid down to the carved ground.
    // Without them the mountain is an open-ended shell and the portal stands in
    // front of a hole you can see the sky through.
    for (const end of [0, 1]) {
      const i = end ? fine.length - 1 : 0;
      const p = fine[i], rx = -p.fz, rz = p.fx;
      const top = rows[i];
      const skirt = [];
      for (let k = 0; k < cols; k++) {
        const off = (k / (cols - 1) - 0.5) * 2 * half;
        const wx = p.x + rx * off, wz = p.z + rz * off;
        // Down to the carved floor everywhere EXCEPT across a bore, where it
        // stops at the top of the tube -- otherwise the face that closes the
        // mountain also closes the tunnel, and the exit is a green dome.
        const st2 = shellTop(off);
        const hy = Number.isFinite(st2) ? p.y + st2 + 2 : terrainEff(wx, wz) - 0.5;
        skirt.push(pos.length / 3);
        pos.push(wx, hy, wz);
        terrainColorAt(hy, wx, wz, c);
        col.push(c.r * 0.82, c.g * 0.82, c.b * 0.82);   // a cut face is in its own shadow
      }
      for (let k = 0; k < cols - 1; k++) {
        if (end) idx.push(top[k], skirt[k], top[k + 1], top[k + 1], skirt[k], skirt[k + 1]);
        else idx.push(top[k], top[k + 1], skirt[k], top[k + 1], skirt[k + 1], skirt[k]);
      }
    }
    const lidGeo = new THREE.BufferGeometry();
    lidGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    lidGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    // the ground tile, chosen by the same rule as the terrain round it (art.js)
    const lay = [];
    for (let v = 0; v < pos.length; v += 3) lay.push(artTerrainLayer(pos[v + 1], pos[v], pos[v + 2]));
    lidGeo.setAttribute("artLayerA", new THREE.Float32BufferAttribute(lay, 1));
    lidGeo.setIndex(idx);
    lidGeo.computeVertexNormals();
    // DOUBLE-SIDED, because the lid is ground and ground is lit from whichever
    // side you are looking at it from. Its cut faces at the portals point into
    // the hill, so single-sided they were shaded by a sun behind them and read
    // as black slabs hanging in the air beside the tunnel mouth.
    const lid = new THREE.Mesh(lidGeo, artPaint(new THREE.MeshPhongMaterial({
      vertexColors: true, flatShading: true, shininess: 0, specular: 0x000000,
      side: THREE.DoubleSide,
    }), "terrain"));
    // NOT receiveShadow. The lid is ground, and the ground in this game does not
    // receive shadows -- scene.js switches that on per frame for the handful of
    // chunks near him and leaves it off everywhere else. Left on, a surface this
    // big self-shadows into a black slab hanging beside the portal.
    lid.receiveShadow = false;
    g.add(lid);
    bore.lid = lid;

    // ---- the portals -----------------------------------------------------
    bore.portals = [];
    for (const end of [0, 1]) {
      const p = end ? pts[pts.length - 1] : pts[0];
      const sign = end ? 1 : -1;                 // outward along the road
      const pg = new THREE.Group();
      pg.position.set(p.x, p.y, p.z);
      pg.rotation.y = Math.atan2(p.fx * sign, p.fz * sign);
      const top = R * 0.42 + R + HW.portalRise;
      const outer = lat + R + HW.portalW;
      const wall = [];
      // a pier outside each bore, a pier up the middle, and a lintel over the lot
      for (const sx of [-1, 1]) {
        wall.push({ w: HW.portalW, h: top, d: HW.portalT,
                    x: sx * (lat + R + HW.portalW / 2), y: top / 2, z: 0 });
      }
      wall.push({ w: (lat - R) * 2, h: top, d: HW.portalT, x: 0, y: top / 2, z: 0 });
      wall.push({ w: outer * 2, h: HW.portalRise, d: HW.portalT,
                  x: 0, y: R * 0.42 + R + HW.portalRise / 2, z: 0 });
      pg.add(new THREE.Mesh(mergeBoxes(wall), conc));
      // an arch ring standing across each opening
      for (const l of LATS) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(R + 1.2, 1.4, 5, 18, Math.PI), conc);
        arch.position.set(l, R * 0.42, HW.portalT / 2 + 0.4);
        pg.add(arch);
      }
      // lamps across the headwall: the thing that says "in here", at range
      const lp = [];
      for (let k = 0; k < HW.portalLamps; k++) {
        const lx = (k / (HW.portalLamps - 1) - 0.5) * 2 * (outer - 3);
        const ly = R * 0.42 + R + HW.portalRise * 0.55;
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.5), lampMat);
        m.position.set(lx, ly, HW.portalT / 2 + 0.5);
        pg.add(m);
        lp.push(new THREE.Vector3(lx, ly, HW.portalT / 2 + 0.5));
      }
      pg.add(glowField(lp, 0xffd9a0, 10, 0.5));
      castsShadow(pg);
      g.add(pg);
      bore.portals.push({ x: p.x, y: p.y, z: p.z, g: pg });
    }
  }
  highway.tunnelRuns = hwyBores.reduce((n, b) => n + (b.b - b.a + 1), 0);
  highway.bores = hwyBores;
}

function hwyBuildInterchanges(g, conc, steel) {
  const I = HW.interchange;
  highway.overpasses = [];
  for (const at of I.at) {
    const base = hwySampleAt(at * highway.length);
    for (let r = 0; r < I.ramps; r++) {
      const a0 = (r / I.ramps) * Math.PI * 2;
      const rr = I.r * (0.55 + 0.45 * (r + 1) / I.ramps);
      const y = base.y + I.rise * ((r + 1) / I.ramps);
      const seg = 26;
      const ramp = [];
      for (let k = 0; k <= seg; k++) {
        const a = a0 + (k / seg) * Math.PI * 1.5;
        const x = base.x + Math.cos(a) * rr, z = base.z + Math.sin(a) * rr;
        const fa = a + Math.PI / 2;
        ramp.push({ x, z, y: lerp(base.y + I.clear, y, Math.sin(Math.PI * k / seg)), fx: Math.cos(fa), fz: Math.sin(fa) });
      }
      g.add(hwyStrip(ramp, -7, 7, 0, conc));
      hwyClaimCorridor(ramp);
      const rail = ramp.map(p => ({ ...p, y: p.y + HW.railH }));
      g.add(hwyStrip(rail, -7, -6.5, 0, steel));
      g.add(hwyStrip(rail, 6.5, 7, 0, steel));
      // pillars, and one solid box per ramp so it is a real obstacle in the air
      const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(I.pillarR, I.pillarR, 1, 8), conc, 7);
      const d = new THREE.Object3D();
      for (let k = 0; k < 7; k++) {
        const p = ramp[Math.round(k / 6 * seg)];
        const gy = Math.max(terrainEff(p.x, p.z), TUNE.waterLevel);
        const h = Math.max(2, p.y - gy);
        d.position.set(p.x, gy + h / 2, p.z); d.scale.set(1, h, 1);
        d.updateMatrix(); pm.setMatrixAt(k, d.matrix);
      }
      pm.castShadow = true;
      g.add(pm);
      const mid = ramp[Math.round(seg / 2)];
      // deck-sized, not ramp-sized: rr*0.5 made a 100 m square block that
      // overlapped the carriageway underneath it
      addSolidBox(mid.x, mid.y - 2, mid.z, 16, 16, mid.y + I.deckT, pm);
      highway.overpasses.push({ x: mid.x, y: mid.y, z: mid.z });
    }
  }
}

// Exit spurs, each with a big blue board carrying one icon and no letters.
function hwyBuildExits(g) {
  const tarmac = artPaint(mattMat(TUNE.runwaySurfaceColor), "asphalt");
  for (const ex of HW.exits) {
    const at = hwySampleAt(ex.s * highway.length);
    const rx = -at.fz, rz = at.fx;
    // the spur: a quarter-turn away from the road, ending in a small pad
    const spur = [];
    const seg = 14;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const out = Math.sin(t * Math.PI / 2) * HW.spurLen;
      const fwd = t * HW.spurLen * 0.7;
      spur.push({
        x: at.x + rx * ex.side * out + at.fx * fwd,
        z: at.z + rz * ex.side * out + at.fz * fwd,
        y: 0, fx: at.fx, fz: at.fz,
      });
    }
    // A spur LEAVES the carriageway, so it has to start at the carriageway's own
    // height and only then come down to the ground. Starting it at ground level
    // put a five-metre step at the junction: the nearest-road pick flipped
    // between the two surfaces and dropped the car through the road.
    for (let k = 0; k < spur.length; k++) {
      const t = k / (spur.length - 1);
      const ground = Math.max(terrainEff(spur[k].x, spur[k].z), TUNE.waterLevel) + HW.clearance;
      spur[k].y = lerp(at.y, ground, smoothstep(0, HW.spurDescend, t));
    }
    for (let k = 1; k < spur.length; k++) {
      const a = spur[k - 1], b = spur[k];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      b.fx = dx / l; b.fz = dz / l;
    }
    spur[0].fx = at.fx; spur[0].fz = at.fz;
    let run = 0; spur[0].s = 0;
    for (let k = 1; k < spur.length; k++) {
      run += Math.hypot(spur[k].x - spur[k - 1].x, spur[k].z - spur[k - 1].z);
      spur[k].s = run;
    }
    g.add(hwyStrip(spur, -HW.spurW, HW.spurW, 0, tarmac));
    hwyClaimCorridor(spur);

    // the board: a blue panel on two posts, one white icon, no letters anywhere
    const bx = at.x + rx * ex.side * (highway.halfW + 16), bz = at.z + rz * ex.side * (highway.halfW + 16);
    hwyExitBoard(g, bx, at.y, bz, at, ex.icon);

    const rec = { ...ex, x: at.x, z: at.z, y: at.y, spur, bx, bz };
    if (ex.charge) rec.charge = hwyBuildCharge(g, spur[spur.length - 1], at);
    highway.exits.push(rec);
  }
}

// One exit board: a blue panel on two posts facing the traffic coming toward
// it, one white icon, no letters anywhere. The city spurs (streets.js) put up
// their own with the same call.
const hwyBoardMats = {};
function hwyExitBoard(g, bx, by, bz, at, icon) {
  const M = hwyBoardMats;
  if (!M.board) {
    M.board = mattMat(0x1c4f9c);
    M.icon = new THREE.MeshBasicMaterial({ color: TUNE.palette.white });
    M.post = metalMat(TUNE.palette.grey, 20);
  }
  const bg = new THREE.Group();
  bg.position.set(bx, by, bz);
  // face the traffic coming toward it, not the traffic that has passed
  bg.rotation.y = Math.atan2(-at.fx, -at.fz);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(HW.boardW, HW.boardH * 0.62, 0.6), M.board);
  panel.position.y = HW.boardH; bg.add(panel);
  for (const sx of [-1, 1]) {
    const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, HW.boardH, 6), M.post);
    pst.position.set(sx * HW.boardW * 0.36, HW.boardH / 2, 0); bg.add(pst);
  }
  hwyIcon(bg, icon, M.icon, HW.boardH);
  castsShadow(bg);
  g.add(bg);
  return bg;
}

// Icons only: a control tower, a wave, an aeroplane, a skyline. Built from
// boxes so there is not a glyph anywhere near them.
function hwyIcon(parent, kind, mat, boardH) {
  const G = new THREE.Group();
  G.position.set(0, boardH, 0.5);
  const box = (w, h, d, x, y, z, rz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); if (rz) m.rotation.z = rz; G.add(m); return m;
  };
  if (kind === "plane") {
    box(1.6, 0.9, 0.3, 0, 0, 0); box(0.9, 5.2, 0.3, 0, 0, 0);
    box(6.4, 0.9, 0.3, 0, 0.6, 0); box(2.6, 0.7, 0.3, 0, -1.9, 0);
  } else if (kind === "wave") {
    for (let i = 0; i < 3; i++) box(6.6, 0.75, 0.3, 0, -1.4 + i * 1.4, 0, i % 2 ? 0.12 : -0.12);
  } else if (kind === "skyline") {
    // five towers of different heights standing on one line: a city
    const T = [[-2.9, 2.6], [-1.5, 4.4], [0, 5.8], [1.5, 3.4], [2.9, 4.8]];
    for (const [x, h] of T) box(1.1, h, 0.3, x, -2.6 + h / 2, 0);
    box(0.25, 1.2, 0.3, 0, 3.8, 0);                       // the spire on the tallest
  } else {
    box(1.5, 5.4, 0.3, 0, -0.4, 0); box(3.6, 1.4, 0.3, 0, 2.4, 0); box(4.6, 0.6, 0.3, 0, 3.3, 0);
  }
  parent.add(G);
}

// A canopy on posts with glowing stalls. Nothing is consumed and nothing is
// tracked: driving in makes the light bar pulse and something chime.
function hwyBuildCharge(g, end, at) {
  const CH = HW.charge, C = TUNE.palette;
  const cg = new THREE.Group();
  cg.position.set(end.x, end.y, end.z);
  cg.rotation.y = Math.atan2(end.fx, end.fz);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(CH.canopyW, 1.1, CH.canopyD), mattMat(C.white));
  canopy.position.y = CH.canopyH; cg.add(canopy);
  const stalls = [];
  for (let i = 0; i < CH.stalls; i++) {
    const sx = (i - (CH.stalls - 1) / 2) * (CH.canopyW / CH.stalls);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, CH.canopyH, 1.4), mattMat(C.grey));
    post.position.set(sx, CH.canopyH / 2, -CH.canopyD / 2 + 1.6); cg.add(post);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 0.4),
      new THREE.MeshBasicMaterial({ color: C.cyan, fog: false }));
    lamp.position.set(sx, CH.canopyH * 0.62, -CH.canopyD / 2 + 2.4); cg.add(lamp);
    stalls.push({ lamp, lx: end.x + Math.cos(cg.rotation.y) * sx, lz: end.z - Math.sin(cg.rotation.y) * sx });
  }
  cg.add(glowField(stalls.map(s => new THREE.Vector3(s.lamp.position.x, s.lamp.position.y, s.lamp.position.z)),
    C.cyan, 7, 0.5));
  castsShadow(cg);
  g.add(cg);
  const rec = { g: cg, stalls, x: end.x, y: end.y, z: end.z, t: 0, active: false };
  highway.charges.push(rec);
  return rec;
}

// ---------------------------------------------------------------------------
// Traffic: machines only, instanced, in both directions, keeping their lanes.
// ---------------------------------------------------------------------------
// A traffic vehicle as one merged geometry: boxes, each with its own colour and
// atlas slot, in the SAME envelope as the plain box it replaced (the car 3.4 x
// 2.2 x 7.6, the lorry 4.2 x 4.4 x 15, centred) -- nothing about where traffic
// is, or how near counts as touching it, moves. Front is local -z.
function hwyVehicleGeo(parts) {
  const pos = [], nor = [], col = [], lay = [], c = new THREE.Color();
  for (const b of parts) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
    g.translate(b.x || 0, b.y || 0, b.z || 0);
    const P = g.attributes.position, N = g.attributes.normal;
    c.setHex(b.c);
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(c.r, c.g, c.b); lay.push(b.l);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute("artLayerA", new THREE.Float32BufferAttribute(lay, 1));
  return out;
}
const HWY_CAR_TINTS = [TUNE.palette.steel, TUNE.palette.red, TUNE.palette.blue, TUNE.palette.white,
                       TUNE.palette.slate, TUNE.palette.warning, TUNE.palette.green, TUNE.palette.grey];

function hwyBuildTraffic(g) {
  const T = HW.traffic, C = TUNE.palette, L = ART_LAYER;
  const W = 0xffffff, dark = C.ink, glass = C.night;
  // the car: body, a glasshouse set back, a roof, four wheels. Tinted per car.
  const carGeo = hwyVehicleGeo([
    { w: 3.4, h: 1.05, d: 7.6, y: -0.55, c: W, l: L.deck },
    { w: 3.0, h: 0.85, d: 3.9, y: 0.4, z: 0.4, c: glass, l: L.glass },
    { w: 2.9, h: 0.2, d: 3.5, y: 0.93, z: 0.45, c: W, l: L.deck },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) =>
      ({ w: 0.5, h: 1.0, d: 1.1, x: sx * 1.5, y: -0.6, z: sz * 2.4, c: dark, l: L.asphalt })),
  ]);
  // the lorry: a cab with a windscreen, a container trailer, a chassis, wheels
  const truckGeo = hwyVehicleGeo([
    { w: 3.9, h: 3.3, d: 3.3, y: 0.0, z: -5.85, c: C.red, l: L.deck },
    { w: 3.3, h: 1.2, d: 0.12, y: 0.8, z: -7.52, c: glass, l: L.glass },
    { w: 4.2, h: 3.7, d: 11.4, y: 0.35, z: 1.8, c: W, l: L.container },
    { w: 3.4, h: 0.5, d: 15, y: -1.6, c: dark, l: L.asphalt },
    ...[-5.8, 2.6, 4.3, 6.0].flatMap(z => [-1, 1].map(sx =>
      ({ w: 0.6, h: 1.2, d: 1.2, x: sx * 1.8, y: -1.6, z, c: dark, l: L.asphalt }))),
  ]);
  const paint = (spec) => artPaint(new THREE.MeshPhongMaterial({
    color: 0xffffff, vertexColors: true, shininess: spec, specular: 0x4a5058 }), "vehicle");
  highway.trafficMesh = new THREE.InstancedMesh(carGeo, paint(40), T.count);
  highway.truckMesh = new THREE.InstancedMesh(truckGeo, paint(20), Math.ceil(T.count / T.truckEvery));
  // every car its own colour, fixed by its slot: no draw from the random stream
  for (let i = 0; i < T.count; i++) highway.trafficMesh.setColorAt(i, new THREE.Color(HWY_CAR_TINTS[(i * 5 + 3) % HWY_CAR_TINTS.length]));
  highway.trafficMesh.instanceColor.needsUpdate = true;
  highway.trafficMesh.frustumCulled = false;
  highway.truckMesh.frustumCulled = false;
  highway.trafficMesh.castShadow = true;
  highway.truckMesh.castShadow = true;
  highway.trafficMesh.userData.noSolid = true;
  highway.truckMesh.userData.noSolid = true;
  g.add(highway.trafficMesh); g.add(highway.truckMesh);
  for (let i = 0; i < T.count; i++) {
    highway.traffic.push({
      s: 0, dir: i % 2 ? 1 : -1, lane: (i >> 1) % HW.lanes,
      speed: 0, truck: i % T.truckEvery === 0, alive: false, spin: 0, respawn: 0,
    });
  }
}

function hwyPlaceTraffic(t, aroundS) {
  const T = HW.traffic;
  // Never materialise on top of him. Spawning uniformly around his position put
  // a car inside his bumper now and then, which read as a crash out of nowhere.
  const sign = Math.random() < 0.5 ? -1 : 1;
  const off = T.keepOut + Math.random() * (T.range - T.keepOut);
  t.s = clamp(aroundS + sign * off, 0, highway.length);
  t.speed = T.speed[0] + Math.random() * (T.speed[1] - T.speed[0]);
  t.lane = Math.floor(Math.random() * HW.lanes);
  t.laneF = t.lane;                   // where it actually is: eases toward `lane` on a lane change
  t.alive = true; t.spin = 0; t.respawn = 0;
}

// Is `lane` free alongside t -- nothing in it, same way, within a car's length or two?
function hwyLaneClear(t, lane) {
  for (const o of highway.traffic) {
    if (o === t || !o.alive || o.dir !== t.dir) continue;
    if (Math.abs(o.laneF - lane) < 0.8 && Math.abs(o.s - t.s) < 45) return false;
  }
  return true;
}

const hwyDummy = new THREE.Object3D();
function hwyUpdateTraffic(dt, px, pz) {
  if (!highway.trafficMesh) return;
  const T = HW.traffic;
  const near = hwyNearest(px, pz);
  const aroundS = near ? near.s : 0;
  // where he is, if he is the car: traffic needs it to keep off his bumper
  let carHere = null;
  if (near && typeof car !== "undefined" && state.vp && state.vp.car) {
    // Which CARRIAGEWAY he is on, which is the sign of his lateral offset --
    // not his direction of travel. Matching on direction put the follow rule on
    // the oncoming side and let his own lane drive straight through him.
    carHere = { s: near.s, lateral: near.lateral, side: Math.sign(near.lateral) || 1, speed: state.speed };
  }
  let ci = 0, ti = 0;
  for (const t of highway.traffic) {
    if (!t.alive) {
      t.respawn -= dt;
      if (t.respawn <= 0) hwyPlaceTraffic(t, aroundS);
      else continue;
    }
    if (Math.abs(t.s - aroundS) > T.range * 1.3) hwyPlaceTraffic(t, aroundS);
    // Don't drive into the back of him. Traffic in his own carriageway runs
    // faster than he does, so without this it overtakes straight through him and
    // he gets rear-ended for holding a finger down and steering nothing.
    let sp = t.speed;
    const laneGap = carHere && t.dir === carHere.side
      ? Math.abs((t.dir * (HW.medianW / 2 + HW.laneW * (t.laneF + 0.5))) - carHere.lateral) : Infinity;
    if (laneGap < HW.laneW * 1.1) {
      const ahead = (carHere.s - t.s) * t.dir;      // positive: he is in front of it
      if (ahead > 0 && ahead < T.follow) sp = Math.min(sp, carHere.speed * 0.98);
    }
    // and it stops at a red, unless stopping would put it in his way
    if (typeof ltHighwayStop === "function") {
      const line = ltHighwayStop(t.s, t.dir, carHere ? carHere.s : null, carHere ? carHere.speed : 0);
      if (line !== null) {
        const toLine = (line - t.s) * t.dir;
        sp = Math.min(sp, Math.max(0, toLine) * 0.55);
      }
    }
    // ...and it is never a wall IN FRONT of him either. At his top speed steps
    // he is the faster one, and a car ahead in his lane was simply rear-ended: a
    // bang for a held finger. So it yields. It moves over if the other lane is
    // clear -- the road making way for him, which is how it should read -- and
    // whether or not it can, it speeds up, so that by the time he is yieldMatch
    // behind it is running faster than he is. He is never slowed: fast is his.
    // (After the red-light rule on purpose: a car that has pulled up at a red
    // and finds him arriving goes, rather than stays a wall.)
    if (laneGap < HW.laneW * 1.1 && carHere.speed > sp) {
      const gap = (t.s - carHere.s) * t.dir;        // positive: it is in front of him
      if (gap > 0 && gap < T.yieldReach) {
        if (t.laneF === t.lane) {
          // across, to whichever lane is further from him
          const want = carHere.lateral * t.dir > HW.medianW / 2 + HW.laneW ? 0 : HW.lanes - 1;
          if (want !== t.lane && hwyLaneClear(t, want)) t.lane = want;
        }
        const k = clamp((T.yieldReach - gap) / (T.yieldReach - T.yieldMatch), 0, 1);
        sp = Math.max(sp, lerp(sp, carHere.speed * 1.03, k));
      }
    }
    if (t.laneF !== t.lane) {
      const d = t.lane - t.laneF, step = dt / T.laneChange;
      t.laneF = Math.abs(d) <= step ? t.lane : t.laneF + Math.sign(d) * step;
    }
    t.s += sp * t.dir * dt;
    if (t.s < 0 || t.s > highway.length) hwyPlaceTraffic(t, aroundS);
    const p = hwySampleAt(t.s);
    const rx = -p.fz, rz = p.fx;
    const off = t.dir * (HW.medianW / 2 + HW.laneW * (t.laneF + 0.5));
    hwyDummy.position.set(p.x + rx * off, p.y + (t.truck ? 2.3 : 1.2), p.z + rz * off);
    hwyDummy.rotation.set(0, Math.atan2(p.fx * t.dir * -1, p.fz * t.dir * -1) + t.spin, 0);
    if (t.spin) { t.spin += dt * 6; hwyDummy.position.y += 1; }
    hwyDummy.scale.setScalar(1);
    hwyDummy.updateMatrix();
    if (t.truck) { if (ti < highway.truckMesh.count) highway.truckMesh.setMatrixAt(ti++, hwyDummy.matrix); }
    else { if (ci < highway.trafficMesh.count) highway.trafficMesh.setMatrixAt(ci++, hwyDummy.matrix); }
    t.wx = hwyDummy.position.x; t.wy = hwyDummy.position.y; t.wz = hwyDummy.position.z;
  }
  // park the unused instances out of sight rather than leaving stale matrices
  hwyDummy.position.set(0, -9999, 0); hwyDummy.scale.setScalar(0.001); hwyDummy.updateMatrix();
  for (let k = ci; k < highway.trafficMesh.count; k++) highway.trafficMesh.setMatrixAt(k, hwyDummy.matrix);
  for (let k = ti; k < highway.truckMesh.count; k++) highway.truckMesh.setMatrixAt(k, hwyDummy.matrix);
  highway.trafficMesh.instanceMatrix.needsUpdate = true;
  highway.truckMesh.instanceMatrix.needsUpdate = true;
}

// A traffic car that has been hit spins off and comes back later. It is a
// machine, it is never a target, and nothing is scored.
function hwyKnockTraffic(t) {
  t.spin = 0.001;
  t.alive = false;
  t.respawn = HW.traffic.respawn;
  flags.hwyTrafficHit = (flags.hwyTrafficHit || 0) + 1;
}

function hwyTrafficNear(x, z, r) {
  for (const t of highway.traffic) {
    if (!t.alive || t.wx === undefined) continue;
    if (Math.hypot(t.wx - x, t.wz - z) < r) return t;
  }
  return null;
}

function updateHighway(dt) {
  if (!highway.built) return;
  const visible = state.spaceF < 0.4 && !(typeof rk !== "undefined" && rk && rk.onBody);
  highway.g.visible = visible;
  if (!visible) return;
  hwyUpdateTraffic(dt, state.x, state.z);
  // The junctions on the spurs, and whoever is chasing him through them. Both
  // load after this file, so both answer for themselves only once they exist.
  if (typeof ltBuild === "function") { ltBuild(); ltUpdate(dt); }
  if (typeof updatePolice === "function") updatePolice(dt);
  if (typeof stUpdate === "function") stUpdate(dt);           // the city streets (streets.js)
  for (const c of highway.charges) {
    if (c.t > 0) c.t -= dt;
    const on = c.t > 0 ? (Math.floor(c.t * HW.charge.pulse) % 2 === 0) : true;
    for (const s of c.stalls) s.lamp.material.color.setHex(on ? TUNE.palette.cyan : 0x14343c);
  }
}

// Built once, at load: it is scenery for every vehicle, not just the car, and
// the aeroplanes should be able to fly over it from the first frame.
hwyBuild();
