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
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].type !== "tunnel") continue;
    let a = i; while (a > 0 && pts[a - 1].type === "tunnel") a--;
    let b = i; while (b < pts.length - 1 && pts[b + 1].type === "tunnel") b++;
    const y0 = pts[Math.max(0, a - 1)].y, y1 = pts[Math.min(pts.length - 1, b + 1)].y;
    for (let k = a; k <= b; k++) pts[k].y = lerp(y0, y1, (k - a) / Math.max(1, b - a));
    i = b;
  }
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
// Geometry
// ---------------------------------------------------------------------------
function hwyStrip(pts, halfL, halfR, yOff, mat, closeEnds) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], rx = -p.fz, rz = p.fx;
    pos.push(p.x + rx * halfL, p.y + yOff, p.z + rz * halfL);
    pos.push(p.x + rx * halfR, p.y + yOff, p.z + rz * halfR);
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
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
  const C = TUNE.palette;
  const pts = highway.pts;
  const roadHalf = HW.lanes * HW.laneW + HW.shoulder;
  highway.halfW = roadHalf + HW.medianW / 2;
  const g = new THREE.Group();

  const tarmac = mattMat(TUNE.runwaySurfaceColor);
  const paint = new THREE.MeshBasicMaterial({ color: TUNE.runwayPaintColor });
  const steel = metalMat(C.steel, 30);
  const conc = mattMat(C.concrete);

  // two carriageways, a median between them
  g.add(hwyStrip(pts, -highway.halfW, -HW.medianW / 2, 0, tarmac));
  g.add(hwyStrip(pts, HW.medianW / 2, highway.halfW, 0, tarmac));
  g.add(hwyStrip(pts, -HW.medianW / 2, HW.medianW / 2, 0.35, mattMat(C.grassMid)));

  // lane dashes down the middle of each carriageway
  {
    const dash = [];
    for (let i = 0; i < pts.length - 1; i += HW.dashEvery) {
      const p = pts[i], rx = -p.fz, rz = p.fx;
      for (const side of [-1, 1]) {
        const off = side * (HW.medianW / 2 + HW.laneW);
        dash.push({ x: p.x + rx * off, y: p.y + 0.06, z: p.z + rz * off, fx: p.fx, fz: p.fz });
      }
    }
    const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 9), paint, dash.length);
    const d = new THREE.Object3D();
    dash.forEach((p, k) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
      d.updateMatrix(); dm.setMatrixAt(k, d.matrix);
    });
    g.add(dm);
  }

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
  if (tunnels.length) {
    // A full bore, not a half arch. The geometry is pre-rotated so its axis runs
    // along +Z and each instance only has to yaw to the road's bearing; the
    // half-cylinder version needed a second rotation to get its open face
    // downward and ended up lying across the carriageway like a dropped pipe.
    const bore = new THREE.CylinderGeometry(HW.tunnelR, HW.tunnelR, HW.step * HW.tunnelSeg * 1.06, 14, 1, true);
    bore.rotateX(Math.PI / 2);
    const tm = new THREE.InstancedMesh(bore,
      new THREE.MeshPhongMaterial({ color: C.concrete, flatShading: true, shininess: 0,
        specular: 0x000000, side: THREE.BackSide }),      // we are inside it
      Math.ceil(tunnels.length / HW.tunnelSeg) + 1);
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < tunnels.length; i += HW.tunnelSeg) {
      const p = tunnels[i];
      // the road runs along the floor of the bore, not through its centre
      d.position.set(p.x, p.y + HW.tunnelR * 0.42, p.z);
      d.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      if (k < tm.count) tm.setMatrixAt(k++, d.matrix);
    }
    tm.count = k;
    tm.frustumCulled = false;
    g.add(tm);
    highway.tunnelRuns = tunnels.length;
  }

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
  castsShadow(g, false);          // the road itself never casts; its structures do
  scene.add(g);
  highway.g = g;
  highway.built = true;
  flags.highwayBuilt = (flags.highwayBuilt || 0) + 1;
}

// A stack of ramp loops at each city end: pure spectacle, and the overpass decks
// are solid so an aeroplane can fly into one and go bang like anything else.
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
        ramp.push({ x, z, y: lerp(base.y, y, Math.sin(Math.PI * k / seg)), fx: Math.cos(fa), fz: Math.sin(fa) });
      }
      g.add(hwyStrip(ramp, -7, 7, 0, conc));
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
  const C = TUNE.palette;
  const boardMat = mattMat(0x1c4f9c);
  const iconMat = new THREE.MeshBasicMaterial({ color: TUNE.palette.white });
  const post = metalMat(C.grey, 20);
  const tarmac = mattMat(TUNE.runwaySurfaceColor);
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

    // the board: a blue panel on two posts, one white icon, no letters anywhere
    const bx = at.x + rx * ex.side * (highway.halfW + 16), bz = at.z + rz * ex.side * (highway.halfW + 16);
    const bg = new THREE.Group();
    bg.position.set(bx, at.y, bz);
    // face the traffic coming toward it, not the traffic that has passed
    bg.rotation.y = Math.atan2(-at.fx, -at.fz);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(HW.boardW, HW.boardH * 0.62, 0.6), boardMat);
    panel.position.y = HW.boardH; bg.add(panel);
    for (const sx of [-1, 1]) {
      const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, HW.boardH, 6), post);
      pst.position.set(sx * HW.boardW * 0.36, HW.boardH / 2, 0); bg.add(pst);
    }
    hwyIcon(bg, ex.icon, iconMat, HW.boardH);
    castsShadow(bg);
    g.add(bg);

    const rec = { ...ex, x: at.x, z: at.z, y: at.y, spur, bx, bz };
    if (ex.charge) rec.charge = hwyBuildCharge(g, spur[spur.length - 1], at);
    highway.exits.push(rec);
  }
}

// Icons only: a control tower, a wave, an aeroplane. Built from boxes so there
// is not a glyph anywhere near them.
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
function hwyBuildTraffic(g) {
  const T = HW.traffic, C = TUNE.palette;
  const carGeo = new THREE.BoxGeometry(3.4, 2.2, 7.6);
  const truckGeo = new THREE.BoxGeometry(4.2, 4.4, 15);
  highway.trafficMesh = new THREE.InstancedMesh(carGeo, metalMat(C.steel, 40), T.count);
  highway.truckMesh = new THREE.InstancedMesh(truckGeo, metalMat(C.white, 20), Math.ceil(T.count / T.truckEvery));
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
  t.alive = true; t.spin = 0; t.respawn = 0;
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
    if (carHere && t.dir === carHere.side) {
      const laneGap = Math.abs((t.dir * (HW.medianW / 2 + HW.laneW * (t.lane + 0.5))) - carHere.lateral);
      const ahead = (carHere.s - t.s) * t.dir;      // positive: he is in front of it
      if (laneGap < HW.laneW * 1.1 && ahead > 0 && ahead < T.follow) sp = Math.min(sp, carHere.speed * 0.98);
    }
    t.s += sp * t.dir * dt;
    if (t.s < 0 || t.s > highway.length) hwyPlaceTraffic(t, aroundS);
    const p = hwySampleAt(t.s);
    const rx = -p.fz, rz = p.fx;
    const off = t.dir * (HW.medianW / 2 + HW.laneW * (t.lane + 0.5));
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
  for (const c of highway.charges) {
    if (c.t > 0) c.t -= dt;
    const on = c.t > 0 ? (Math.floor(c.t * HW.charge.pulse) % 2 === 0) : true;
    for (const s of c.stalls) s.lamp.material.color.setHex(on ? TUNE.palette.cyan : 0x14343c);
  }
}

// Built once, at load: it is scenery for every vehicle, not just the car, and
// the aeroplanes should be able to fly over it from the first frame.
hwyBuild();
