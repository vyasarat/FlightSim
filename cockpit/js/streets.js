"use strict";
// WORKING RULES -- THE CITY STREETS.
//
// Both block cities are places to DRIVE. Every street the generator laid is a
// road: two lanes, a centre line (the carriageway tile, mirrored), kerbs, a
// zebra across every arm of every junction. The graph is read off the layout
// (citydata.js), never authored: every edge of a block's lot is a street
// centreline, north-south ones `avenueW` wide and east-west ones `streetW`.
// Move the generator's grid and the streets move with it.
//
// THE ROAD IS HIS, THE CORNER IS HIS. Lane-keep works on a street exactly as on
// the motorway -- the nearest lane, a point ahead along it, and it yields the
// instant he steers. At a junction, holding left or right on the approach is
// the exit gesture: that street is his choice, and the corner assist (below)
// makes the turn fit and takes it.
// Hands-off he goes straight on, and where the road ends he is taken round the
// corner that keeps him on the loop.
//
// THE CORNER ASSIST NEVER CHANGES WHERE HE POINTED, and it is the one assist
// in the game that touches his speed. At cruise the car turns on a 77 m circle and a street is
// 14 m wide, so a corner is only makeable slowly. It engages only within
// `cornerAssistDist` of a junction, only while a turn is held into a street
// that is there or the road ends ahead, never on the motorway, and it never
// changes where he pointed: it sheds speed on the approach and gives it back on
// the way out. Point at a building halfway along a block and nothing saves him.
// Every strength is TUNE.city.*, to be weakened as he gets better at corners.
//
// NEVER STUCK. Every street joins the grid at both ends; the one dead end (the
// bridge deck) has a turnaround. Off the street -- the square, a pavement --
// lane-keep's off-road pull brings him back. Hands-off from either city's
// off-ramp he drives through the middle, round, and out on to the motorway.
//
// THE CITY IS ALIVE, and it keeps the motorway's promises: nothing behind him
// in his lane drives into him, nothing ahead of him in it is ever a wall,
// nothing crosses in front of him. Traffic queues at the signals, which are
// lights.js junctions like any other -- run a red and the chase comes, and in a
// city it follows the way he drove rather than the line through the buildings.
// People walk the pavements and never step into a road; they cannot be hit --
// the ones in his way step back to the wall.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE GRAPH. Every street is a straight road between two junctions, read off
// the generated block rectangles: citydata.js's `blocks` are the lots INCLUDING
// half of each street round them, so every rectangle edge is a street
// centreline. An edge two blocks share is one street, not two.
// ---------------------------------------------------------------------------
const ST = TUNE.city;

const streets = {
  built: false, g: null, roads: [], nodes: [], cities: {},
  hash: new Map(),
};

function stKey(x, z) { return Math.round(x * 10) + "," + Math.round(z * 10); }

function stNodeAt(city, x, z) {
  const k = stKey(x, z);
  let n = city.nodeMap.get(k);
  if (!n) {
    n = { id: streets.nodes.length, city: city.key, x, z, arms: [], signal: null, policy: new Map() };
    city.nodeMap.set(k, n);
    city.nodes.push(n);
    streets.nodes.push(n);
  }
  return n;
}

// A road: a polyline with its arc length, direction at every point, its half
// width, and where its lane centres sit. `drape`: the height is the city
// ground's, asked at the point (terrainMeshY), not stored.
function stRoad(o) {
  const pts = o.pts;
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    pts[i].s = run;
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    pts[i].fx = (b.x - a.x) / l; pts[i].fz = (b.z - a.z) / l;
  }
  const r = {
    id: streets.roads.length, city: o.city, kind: o.kind || "grid", pts, len: run,
    halfW: o.halfW, lo: o.lo, drape: o.drape !== false, railed: !!o.railed,
    a: null, b: null, spurExit: o.spurExit || null, parking: !!o.parking, wide: !!o.wide,
  };
  streets.roads.push(r);
  stHashRoad(r);
  return r;
}

// Hook a road's end onto a junction. The arm points OUT of the junction.
function stAttach(node, road, atStart) {
  const p = atStart ? road.pts[0] : road.pts[road.pts.length - 1];
  const q = atStart ? road.pts[1] : road.pts[road.pts.length - 2];
  const l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
  node.arms.push({ road, atStart, dx: (q.x - p.x) / l, dz: (q.z - p.z) / l, node });
  if (atStart) road.a = node; else road.b = node;
}

function stHashRoad(r) {
  const C = ST.hashCell;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (C * 0.5)));
    for (let k = 0; k <= n; k++) {
      const x = lerp(a.x, b.x, k / n), z = lerp(a.z, b.z, k / n);
      const cx = Math.floor(x / C), cz = Math.floor(z / C);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const key = (cx + dx) + "," + (cz + dz);
        let list = streets.hash.get(key);
        if (!list) streets.hash.set(key, list = []);
        if (list[list.length - 1] !== r && list.indexOf(r) < 0) list.push(r);
      }
    }
  }
}

function stRoadsNear(x, z) {
  const C = ST.hashCell;
  return streets.hash.get(Math.floor(x / C) + "," + Math.floor(z / C)) || null;
}

// The surface height of a road at a point on it.
function stRoadY(r, x, z, s) {
  if (r.drape) return terrainMeshY(x, z) + CITY.groundLift;
  const pts = r.pts;
  let i = 1; while (i < pts.length - 1 && pts[i].s < s) i++;
  const a = pts[i - 1], b = pts[i];
  return lerp(a.y, b.y, clamp((s - a.s) / Math.max(1e-3, b.s - a.s), 0, 1));
}

// Nearest point on one road. `along` is UNCLAMPED past either end, which is
// what tells the planner he has gone through a junction.
const stProj = {};
function stProject(r, x, z) {
  let bd = Infinity, bi = 1, bt = 0;
  const pts = r.pts;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
    const px = a.x + ex * t, pz = a.z + ez * t;
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const a = pts[bi - 1], b = pts[bi];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const fx = (b.x - a.x) / l, fz = (b.z - a.z) / l;
  let s = a.s + l * bt;
  // extend past the ends along the end segments
  if (bi === 1 && bt === 0) s += (x - a.x) * fx + (z - a.z) * fz;
  if (bi === pts.length - 1 && bt === 1) s += (x - b.x) * fx + (z - b.z) * fz;
  const px = a.x + (b.x - a.x) * bt, pz = a.z + (b.z - a.z) * bt;
  stProj.d = Math.sqrt(bd); stProj.s = s; stProj.fx = fx; stProj.fz = fz;
  stProj.lat = (x - px) * (-fz) + (z - pz) * fx;
  stProj.px = px; stProj.pz = pz;
  return stProj;
}

// A point `s` metres along a road, offset `off` to the right of travel `dir`.
function stPointAt(r, s, dir, off, out) {
  const pts = r.pts;
  const sc = clamp(s, 0, r.len);
  let i = 1; while (i < pts.length - 1 && pts[i].s < sc) i++;
  const a = pts[i - 1], b = pts[i];
  const l = Math.max(1e-3, b.s - a.s);
  const t = (s - a.s) / l;               // may run past 0/1 at the ends: straight on
  const fx = (b.x - a.x) / l, fz = (b.z - a.z) / l;
  const tx = fx * dir, tz = fz * dir;
  out.x = a.x + (b.x - a.x) * t + (-tz) * off;
  out.z = a.z + (b.z - a.z) * t + tx * off;
  out.fx = tx; out.fz = tz;
  return out;
}

// Is this street really there: dry, and clear of every solid that is not one
// of the city's own buildings, across its lanes and along its whole length?
function stEdgeClear(x0, z0, x1, z1, half) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.ceil(L / 4));
  const tx = (x1 - x0) / L, tz = (z1 - z0) / L, rx = -tz, rz = tx;
  const pad = ST.edgePad;
  const solids = [];
  forEachSolid(b => {
    if (b.mesh && b.mesh.isCityProxy) return;
    const cx = Math.max(Math.min(x0, x1) - half - pad, Math.min(Math.max(x0, x1) + half + pad, b.x));
    const cz = Math.max(Math.min(z0, z1) - half - pad, Math.min(Math.max(z0, z1) + half + pad, b.z));
    if (Math.abs(cx - b.x) < b.hw + half + pad && Math.abs(cz - b.z) < b.hd + half + pad) solids.push(b);
  });
  for (let i = 0; i <= n; i++) {
    for (const off of [-half * 0.6, 0, half * 0.6]) {
      const x = x0 + tx * L * i / n + rx * off, z = z0 + tz * L * i / n + rz * off;
      // the generator's own margin: it lays no street within a metre and a half of water
      if (terrainEff(x, z) < seaLevelAt(x, z) + 1.5) return "water";
      const y = terrainEff(x, z);
      for (const b of solids) {
        if (Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad && y + 3 > b.y0 && y - 3 < b.y1) return "solid@" + Math.round(b.x) + "," + Math.round(b.z);
      }
    }
  }
  return true;
}

// A street left with a dead end by one it met being dropped is taken out too,
// and the one it met, until every junction in the grid has two ways out. The
// tarmac is still there; it is simply not a road lane-keep will send him down.
function stPruneStubs(city) {
  for (let pass = 0; pass < 20; pass++) {
    const stub = city.nodes.find(n => n.arms.length === 1);
    if (!stub) break;
    const r = stub.arms[0].road;
    for (const n of [r.a, r.b]) if (n) n.arms = n.arms.filter(a => a.road !== r);
    city.roads = city.roads.filter(q => q !== r);
    r.pruned = true;
    city.pruned = (city.pruned || 0) + 1;
    for (const list of streets.hash.values()) { const i = list.indexOf(r); if (i >= 0) list.splice(i, 1); }
  }
  // and a junction with nothing left at it is no junction
  for (const n of city.nodes) if (!n.arms.length) city.nodeMap.delete(stKey(n.x, n.z));
  city.nodes = city.nodes.filter(n => n.arms.length > 0);
  streets.nodes = streets.nodes.filter(n => n.arms.length > 0 || n.city !== city.key);
  streets.roads = streets.roads.filter(r => !r.pruned);
}

// One city's grid. North-south lines are avenues (`avenueW`), east-west ones
// streets (`streetW`), both written by the generator into citydata.js.
function stBuildGrid(key) {
  const D = CITY_DATA[key];
  const city = { key, data: D, nodes: [], nodeMap: new Map(), roads: [], links: [] };
  streets.cities[key] = city;
  const seen = new Set();
  const edge = (x0, z0, x1, z1, width) => {
    const k = [stKey(x0, z0), stKey(x1, z1)].sort().join("|");
    if (seen.has(k)) return;
    seen.add(k);
    const half = width / 2;
    // The generator laid no tarmac where the ground was taken -- water, a
    // landmark -- and a block edge there is not a street. Measured, not assumed.
    const why = stEdgeClear(x0, z0, x1, z1, half);
    if (why !== true) { (city.droppedEdges = city.droppedEdges || []).push([x0, z0, x1, z1, why]); city.dropped = (city.dropped || 0) + 1; return; }
    const r = stRoad({ city: key, kind: "grid", pts: [{ x: x0, z: z0 }, { x: x1, z: z1 }],
                       halfW: half, lo: half >= ST.wideHalf ? ST.laneWide : ST.laneNarrow,
                       parking: half >= ST.wideHalf, wide: half >= ST.wideHalf });
    city.roads.push(r);
    stAttach(stNodeAt(city, x0, z0), r, true);
    stAttach(stNodeAt(city, x1, z1), r, false);
  };
  for (const b of D.blocks) {
    const [x0, z0, x1, z1] = b;
    edge(x0, z0, x1, z0, D.streetW); edge(x0, z1, x1, z1, D.streetW);
    edge(x0, z0, x0, z1, D.avenueW); edge(x1, z0, x1, z1, D.avenueW);
  }
  stPruneStubs(city);
  return city;
}
// ---------------------------------------------------------------------------
// THE PLANNER: lane-keep on a street, and the corner.
//
// On the motorway lane-keep is "steer at a point a second or so along the
// nearest road". A grid breaks that twice. At a junction the nearest road is
// ambiguous -- he is standing on both -- so here he is ON a road, and stays on
// it until he is through the junction at its end. And a corner is not a bend:
// at cruise the car turns on a 77 m circle and a street is 14 m wide.
//
// So the junction ahead is decided before he reaches it, and the corner is a
// PATH: his lane in, a fillet of `turnR`, the cross street's lane out.
//
// THE CORNER ASSIST NEVER CHANGES WHERE HE POINTED. A turn held on the approach,
// inside `cornerAssistDist` of a junction that has a street on that side, is his
// choice of that street: the assist sheds speed so the corner fits, lane-keep
// holds his lane to the corner and takes it, and the speed is handed back on
// the way out (CLAUDE.md states it as a carve-out). Hands-off, a junction with no
// straight on is "the road ends": the assist slows him and lane-keep takes the
// turn that keeps him on the loop (`policy`). Nowhere else does it touch his
// speed -- point at a building halfway along a block and nothing saves him.
// ---------------------------------------------------------------------------
const stPlan = { road: null, dir: 1, turn: null, giveBack: 0, cap: Infinity, holding: false, latch: 0 };
const stTmpA = {}, stTmpB = {};

// Signed angle from travelling (fx,fz) to an arm: positive is a RIGHT turn.
function stArmAngle(fx, fz, arm) {
  return Math.atan2(-arm.dx * fz + arm.dz * fx, arm.dx * fx + arm.dz * fz);
}

// The arm he arrives through: this road's own arm at the junction ahead.
function stArrivalArm(node, road, dir) {
  for (const a of node.arms) if (a.road === road && a.atStart === (dir < 0)) return a;
  return null;
}

function stChoices(node, inArm) {
  const fx = -inArm.dx, fz = -inArm.dz;          // travelling INTO the junction
  const out = [];
  for (const a of node.arms) {
    if (a === inArm) continue;
    out.push({ arm: a, ang: stArmAngle(fx, fz, a) });
  }
  return out;
}

function stStraight(choices) {
  let best = null;
  for (const c of choices) if (Math.abs(c.ang) < ST.straightDeg * DEG && (!best || Math.abs(c.ang) < Math.abs(best.ang))) best = c;
  return best;
}

// Where a road leaves a junction, as travel: dir +1 if it leaves from its start.
function stArmDir(arm) { return arm.atStart ? 1 : -1; }

// ---- the path through one junction ----------------------------------------
// Built once per (road in, arm out) and cached: his lane on the way in, the
// fillet (or straight across), the other road's lane on the way out.
function stJunctionPath(road, dir, node, arm) {
  const key = road.id + ":" + dir + ">" + arm.road.id + ":" + (arm.atStart ? 1 : 0);
  const cache = streets.paths || (streets.paths = new Map());
  let P = cache.get(key);
  if (P) return P;
  const pts = [];
  const endS = dir > 0 ? road.len : 0;
  const inLen = Math.min(road.len, ST.pathIn);        // the path starts this far before the junction
  // his lane on the way in
  for (let k = 0; k <= 6; k++) {
    const s = endS - dir * inLen * (1 - k / 6);
    stPointAt(road, s, dir, road.lo, stTmpA);
    pts.push({ x: stTmpA.x, z: stTmpA.z });
  }
  const fin = { x: stTmpA.fx, z: stTmpA.fz };
  const odir = stArmDir(arm), oroad = arm.road;
  const oStart = arm.atStart ? 0 : oroad.len;
  if (oroad === road && odir === -dir) {
    // a dead end: turn round on a half circle, his lane to the other one
    const R = road.lo || 4, e = pts[pts.length - 1];
    const cx = e.x - fin.x * (R + 2) + fin.z * R, cz = e.z - fin.z * (R + 2) - fin.x * R;
    while (pts.length > 1) {
      const q = pts[pts.length - 1];
      if ((q.x - cx) * fin.x + (q.z - cz) * fin.z > -0.5) pts.pop(); else break;
    }
    const rx = -fin.z, rz = fin.x;                 // his right; the circle's centre is the road's middle
    const n = 12;
    let apexI = 0;
    for (let k = 0; k <= n; k++) {
      const th = Math.PI * k / n;
      pts.push({ x: cx + R * (rx * Math.cos(th) + fin.x * Math.sin(th)), z: cz + R * (rz * Math.cos(th) + fin.z * Math.sin(th)) });
      if (k === n / 2) apexI = pts.length - 1;
    }
    const exitI = pts.length - 1;
    const outLen = Math.min(road.len, ST.pathOut);
    for (let k = 1; k <= 8; k++) {
      stPointAt(road, endS - dir * outLen * k / 8, -dir, road.lo, stTmpB);
      pts.push({ x: stTmpB.x, z: stTmpB.z });
    }
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      pts[i].s = run;
    }
    P = { pts, apexS: pts[apexI].s, exitS: pts[exitI].s, t1S: 0, turn: true, uturn: true, ang: Math.PI, arm, inLen, node };
    cache.set(key, P);
    return P;
  }
  stPointAt(oroad, oStart, odir, oroad.lo, stTmpB);
  const fout = { x: stTmpB.fx, z: stTmpB.fz };
  const ang = Math.atan2(-fout.x * fin.z + fout.z * fin.x, fout.x * fin.x + fout.z * fin.z);
  let apexI = pts.length - 1, exitI = pts.length - 1, t1I = pts.length - 1;
  if (Math.abs(ang) > ST.straightDeg * DEG) {
    // the two lane lines, and where they cross
    const ax = pts[pts.length - 1].x, az = pts[pts.length - 1].z;
    const bx = stTmpB.x, bz = stTmpB.z;
    const den = fin.x * fout.z - fin.z * fout.x;
    const t = ((bx - ax) * fout.z - (bz - az) * fout.x) / den;
    const Px = ax + fin.x * t, Pz = az + fin.z * t;
    const half = Math.abs(ang) / 2;
    const L = ST.turnR * Math.tan(half);
    const T1x = Px - fin.x * L, T1z = Pz - fin.z * L;
    // the lane in only as far as the fillet starts
    while (pts.length > 1) {
      const q = pts[pts.length - 1];
      if ((q.x - T1x) * fin.x + (q.z - T1z) * fin.z > -0.5) pts.pop(); else break;
    }
    pts.push({ x: T1x, z: T1z });
    t1I = pts.length - 1;
    const side = ang > 0 ? 1 : -1;                 // right turn: the centre is on the right
    const cx = T1x + (-fin.z) * side * ST.turnR, cz = T1z + fin.x * side * ST.turnR;
    const a0 = Math.atan2(T1z - cz, T1x - cx);
    const n = Math.max(3, Math.ceil(Math.abs(ang) / (10 * DEG)));
    for (let k = 1; k <= n; k++) {
      const a = a0 + side * (Math.abs(ang) * k / n);
      pts.push({ x: cx + Math.cos(a) * ST.turnR, z: cz + Math.sin(a) * ST.turnR });
      if (k === Math.ceil(n / 2)) apexI = pts.length - 1;
    }
    exitI = pts.length - 1;
  } else {
    apexI = exitI = pts.length - 1;
  }
  // the lane out -- from where the corner ends, never back behind it
  const outLen = Math.min(oroad.len, ST.pathOut);
  const ex = pts[pts.length - 1];
  for (let k = 1; k <= 8; k++) {
    stPointAt(oroad, oStart + odir * outLen * k / 8, odir, oroad.lo, stTmpB);
    if ((stTmpB.x - ex.x) * fout.x + (stTmpB.z - ex.z) * fout.z < 1) continue;
    pts.push({ x: stTmpB.x, z: stTmpB.z });
  }
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    pts[i].s = run;
  }
  P = { pts, apexS: pts[apexI].s, exitS: pts[exitI].s, t1S: pts[t1I].s, turn: Math.abs(ang) > ST.straightDeg * DEG, ang, arm, inLen, node };
  cache.set(key, P);
  return P;
}

// Project onto a path polyline; returns s along it and the point `ahead` on.
function stPathAim(P, x, z, ahead, out) {
  const pts = P.pts;
  let bd = Infinity, bs = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
    const d = (a.x + ex * t - x) ** 2 + (a.z + ez * t - z) ** 2;
    if (d < bd) { bd = d; bs = a.s + (b.s - a.s) * t; }
  }
  const want = Math.min(bs + ahead, pts[pts.length - 1].s);
  let i = 1; while (i < pts.length - 1 && pts[i].s < want) i++;
  const a = pts[i - 1], b = pts[i];
  const t = clamp((want - a.s) / Math.max(1e-3, b.s - a.s), 0, 1);
  out.s = bs; out.x = lerp(a.x, b.x, t); out.z = lerp(a.z, b.z, t);
  return out;
}

// ---- which road is he on ---------------------------------------------------
// Sticky: the road he is on keeps him until he is off it or through the
// junction at its end. Otherwise the nearest, with a heading penalty, so that
// crossing a junction does not hand him to the cross street.
function stAcquire(x, z, heading, wide) {
  const list = stRoadsNear(x, z);
  if (!list) return null;
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  let best = null, bs = Infinity;
  const reach = wide ? ST.offStreetReach : ST.capture;
  for (const r of list) {
    const p = stProject(r, x, z);
    if (p.d > r.halfW + reach) continue;
    if (p.s < -ST.endSlack || p.s > r.len + ST.endSlack) continue;
    const c = fx * p.fx + fz * p.fz;
    const score = p.d + ST.headPenalty * (1 - Math.abs(c));
    if (score < bs) { bs = score; best = { road: r, dir: c >= 0 ? 1 : -1 }; }
  }
  return best;
}

// Is he in a city, near enough a street for the planner to be the one asked?
// Inside a city that is anywhere he could be pulled back to a street from --
// the middle of the square is thirty metres from the nearest one.
function stCarNear(x, z) {
  const list = stRoadsNear(x, z);
  if (!list) return false;
  for (const r of list) {
    const p = stProject(r, x, z);
    if (p.d < r.halfW + ST.offStreetReach && p.s > -ST.endSlack && p.s < r.len + ST.endSlack) return true;
  }
  return false;
}

// The whole of the planner, once a frame, for the car. Returns what
// carRoadTarget returns for the motorway, plus `cap`: the corner assist's
// speed ceiling (Infinity when it is not engaged).
const stAim = {};
function stCarTarget(x, z, heading, speed, steer01, handsOff, dt) {
  const P = stPlan;
  P.giveBack = Math.max(0, P.giveBack - dt);
  P.holding = false;
  if (P.latch && !(Math.sign(steer01) === P.latch && Math.abs(steer01) > ST.turnIntent)) P.latch = 0;
  // re-read the road whenever he is steering or has left the one we had
  let cur = P.road ? { road: P.road, dir: P.dir } : null;
  if (cur) {
    const p = stProject(cur.road, x, z);
    let off = p.d > cur.road.halfW + ST.capture && p.d > cur.road.halfW + ST.offStreetReach * 0.5;
    // part-way round a corner he has left his old road's line; he is still on
    // the corner, and the plan holds while he is anywhere near its path
    if (off && P.turn && P.turn.committed) {
      const J = stJunctionPath(cur.road, cur.dir, P.turn.node, P.turn.arm);
      const q = stPathAim(J, x, z, 0, stAim);
      off = Math.hypot(q.x - x, q.z - z) > ST.capture + 4;
    }
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    const c = (fx * p.fx + fz * p.fz) * cur.dir;
    if (off || (!handsOff && !P.turn && c < 0.5)) cur = null;
  }
  if (!cur) {
    // on a street by the usual reach; off one (the square), the nearest there is
    cur = stAcquire(x, z, heading) || stAcquire(x, z, heading, true);
    if (!cur) { P.road = null; P.turn = null; P.cap = Infinity; return null; }
    if (cur.road !== P.road || cur.dir !== P.dir) P.turn = null;
  }
  P.road = cur.road; P.dir = cur.dir;
  const road = P.road, dir = P.dir;
  let p = stProject(road, x, z);
  const toGo = dir > 0 ? road.len - p.s : p.s;
  const node = dir > 0 ? road.b : road.a;

  // ---- the junction ahead, decided before he reaches it
  let plan = null;
  if (node) {
    const inArm = stArrivalArm(node, road, dir);
    const choices = inArm ? stChoices(node, inArm) : [];
    const straight = stStraight(choices);
    const held = Math.abs(steer01) > ST.turnIntent;
    if (P.turn && P.turn.node === node) plan = P.turn;
    // A held turn: the street on that side, if there is one, inside the window
    // -- on the APPROACH. Steering once he is in the junction itself is his own:
    // that is how he drives off the corner into the square.
    const box = node.arms.reduce((m, a) => a.road === road ? m : Math.max(m, a.road.halfW), 0);
    if (held && toGo < ST.cornerAssistDist && toGo > box) {
      const side = Math.sign(steer01);
      let pick = null;
      for (const c of choices) {
        const a = Math.abs(c.ang);
        if (Math.sign(c.ang) === side && a > 45 * DEG && a < 135 * DEG) pick = c;
      }
      if (pick && (!plan || plan.arm !== pick.arm)) plan = { node, arm: pick.arm, held: true, forced: false };
    }
    if (!plan) {
      if (straight) plan = { node, arm: straight.arm, held: false, forced: false };
      else {
        // the road ends: the turn that keeps him on the loop (or, at a dead
        // end, round and back)
        const want = node.policy.get(inArm);
        const c = choices.find(q => q.arm === want) || choices[0];
        plan = { node, arm: c ? c.arm : inArm, held: false, forced: true };
      }
    }
    // a held turn he lets go of before he has started it is no longer his
    // choice: lane-keep goes back to straight on
    if (plan && plan.held && !held && !plan.committed && straight) {
      plan = { node, arm: straight.arm, held: false, forced: false };
    }
    P.turn = plan;
  } else P.turn = null;

  // ---- the path, the aim point and the corner ceiling
  const LK = CAR.laneKeep;
  let ahead = Math.max(ST.minAhead, speed * LK.lookAhead);
  P.cap = Infinity;
  if (P.turn) {
    const J = stJunctionPath(road, dir, node, P.turn.arm);
    if (J.turn) ahead = Math.max(ST.turnAhead, Math.min(ahead, speed * ST.turnLook));
    stPathAim(J, x, z, ahead, stAim);
    // Short of where the corner starts, the aim stays in his lane: a point
    // round the corner, seen from twenty metres back, pulls him across the
    // parked cars on the inside before the corner has begun.
    if (J.turn && stAim.s < J.t1S - 1) {
      const lim = Math.min(stAim.s + ahead, J.t1S + ST.turnAhead * 0.5);
      stPathAim(J, x, z, lim - stAim.s, stAim);
    }
    // To where the corner STARTS: that is where he must already be slow enough.
    // Measured along his road while he is short of where the path begins -- the
    // path's own s stops at its first point, and read from there a corner a
    // block away looked a block nearer than it is.
    const toApex = toGo > J.inLen ? toGo - (J.inLen - J.t1S) : J.t1S - stAim.s;
    // engaged: a turn held inside the window, or the road ending ahead of him
    const engaged = J.turn && ((P.turn.held && Math.abs(steer01) > ST.turnIntent) ||
                                (P.turn.forced && handsOff));
    // A held turn inside the window is his CHOICE of that street: lane-keep holds
    // his lane to the corner and takes it, the way it takes an exit he has
    // steered for. It never picks a street he did not hold toward.
    P.holding = !!(engaged && P.turn.held);
    if (engaged) {
      P.turn.committed = true;
      const vc = J.uturn ? ST.uturnSpeed : ST.cornerSpeed;
      const early = P.turn.forced ? ST.forcedMargin : 0;
      P.cap = Math.sqrt(vc * vc + 2 * ST.cornerBrake * Math.max(0, toApex - early));
    }
    // through it: on to the road it leads to
    const through = J.turn ? stAim.s > J.exitS + ST.exitSlack : toGo < -ST.exitSlack;
    if (through) {
      if (J.turn && P.turn.committed) P.giveBack = ST.giveBackTime;
      // one hold, one turn: a finger still held round the corner is not a
      // second turn into the building on the far side
      if (P.turn.held && Math.abs(steer01) > ST.turnIntent) P.latch = Math.sign(steer01);
      P.road = P.turn.arm.road; P.dir = stArmDir(P.turn.arm); P.turn = null;
    }
    p = stProject(road, x, z);
  } else {
    // no junction ahead (a link that runs out onto the motorway): its lane
    stPointAt(road, p.s + dir * ahead, dir, road.lo, stAim);
  }
  // Hands-off, the corner where the road ends may be several junctions on:
  // at the top speed step a block is shorter than the braking. So the assist
  // looks down the straight-on chain to the first one, and starts in time.
  if (handsOff && P.turn && !P.turn.forced && node) {
    const far = stForcedAhead(P.turn.arm, toGo, speed);
    if (far !== null) P.cap = Math.min(P.cap, Math.sqrt(ST.cornerSpeed * ST.cornerSpeed +
                                        2 * ST.cornerBrake * Math.max(0, far - ST.forcedMargin)));
  }
  // Off the street -- the square, a pavement -- and hands-off, the road pulls
  // him back. Coming at it across its line, the far kerb is a building: so this
  // is the road ending too, and the assist sheds speed before the near kerb so
  // the turn on to it fits. His own steering is never capped here.
  const across = Math.abs(p.lat) - road.halfW;
  if (handsOff && across > -2) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    if (Math.abs(fx * p.fx + fz * p.fz) < ST.rejoinCos) {
      P.cap = Math.min(P.cap, Math.sqrt(ST.rejoinSpeed * ST.rejoinSpeed + 2 * ST.cornerBrake * Math.max(0, across - 2)));
    }
  }
  const y = stRoadY(road, x, z, clamp(p.s, 0, road.len));
  return { lateral: p.lat, y, fx: p.fx, fz: p.fz, s: p.s, spur: null, street: road, dir,
           laneOff: road.lo * dir, aimX: stAim.x, aimZ: stAim.z, cap: P.cap,
           holding: P.holding, latched: !!P.latch,
           railHalf: road.railed ? road.halfW : 0, dist: p.d };
}

// How far, hands-off, to the next junction where the road ends -- following
// straight on through every junction that has one -- or null if that is
// further than he could need to brake from.
function stForcedAhead(arm, dist, speed) {
  const reach = speed * speed / (2 * ST.cornerBrake) + ST.forcedMargin + 30;
  let a = arm;
  for (let hop = 0; hop < 8 && dist < reach; hop++) {
    const r = a.road, far = a.atStart ? r.b : r.a;
    if (!far) return null;
    dist += r.len;
    const inArm = far.arms.find(b => b.road === r && b.atStart !== a.atStart);
    if (!inArm) return null;
    const straight = stStraight(stChoices(far, inArm));
    if (!straight) return dist - ST.turnR - 4;            // the corner starts short of the middle
    a = straight.arm;
  }
  return null;
}

// ---- the hands-off policy ---------------------------------------------------
// Worked out once, at load: at every junction where the road ends (no straight
// on), which way lane-keep turns. Cost is the distance still to drive to an
// EXIT road -- a road back to the motorway -- when every junction with a
// straight on is taken straight on, which is what hands-off does. So a finger
// held from the off-ramp goes round and out again, and a finger held from
// anywhere else in the grid finds its way to the same place.
function stBuildPolicy(city) {
  const states = [];
  for (const n of city.nodes) for (const a of n.arms) states.push({ n, a, cost: Infinity, pick: null });
  const byKey = new Map(states.map(s => [s.a, s]));
  const farArm = (arm) => {
    const r = arm.road, far = arm.atStart ? r.b : r.a;
    if (!far) return null;
    for (const b of far.arms) if (b.road === r && b.atStart !== arm.atStart) return b;
    return null;
  };
  for (let it = 0; it < 400; it++) {
    let changed = false;
    for (const st of states) {
      const choices = stChoices(st.n, st.a);
      const straight = stStraight(choices);
      let opts = straight ? [straight] : choices;
      if (!opts.length) opts = [{ arm: st.a, ang: Math.PI }];     // a dead end: turn round
      let best = Infinity, pick = null;
      for (const c of opts) {
        const r = c.arm.road;
        let cost;
        if (r.kind === "exit") cost = r.len;
        else if (r.kind === "coast") cost = Infinity;        // the harbour road: see below
        else {
          const nxt = farArm(c.arm);
          cost = nxt ? r.len + byKey.get(nxt).cost : Infinity;
        }
        if (cost < best) { best = cost; pick = c.arm; }
      }
      if (best < st.cost - 1e-6) { st.cost = best; st.pick = pick; changed = true; }
      else if (!st.pick) st.pick = pick || (opts[0] && opts[0].arm);
    }
    if (!changed) break;
  }
  for (const st of states) st.n.policy.set(st.a, st.pick);
  // Where the boulevard meets the coast road, hands-off turns for the harbour:
  // that is what the boulevard is for. It never counts as a way OUT of the city,
  // so no loop is routed down it.
  for (const n of city.nodes) {
    const h = n.arms.find(a => a.road.toHarbour);
    if (!h) continue;
    for (const a of n.arms) if (a.road.kind !== "coast") n.policy.set(a, h);
  }
  city.policyCost = states;
}
// ---------------------------------------------------------------------------
// THE LINKS: the roads that join a grid to the rest of the world.
//
// Each city has two exits off the motorway, both real spurs in highway.exits
// with a skyline on the board, so taking one IS the exit gesture and a hands-off
// finger on the main line never does. The way IN arrives on a street through
// the middle of the city; the way OUT leaves from a corner, continuing a street,
// and the hands-off policy is what brings him round to it. New York adds a ramp
// up onto the harbour bridge and a drive along its deck; California a boulevard
// from downtown to the harbour's coast road, which is how the car reaches the
// boats. That is all: one thing each, no more.
//
// Every link claims its corridor as it is laid, the way the spurs do, so no
// streamed scenery ever stands in one.
// ---------------------------------------------------------------------------
const ST_LINKS = {
  ny: {
    // in: off the motorway south of the loops, on to 3899 street heading west
    enter: { s: 0.178, side: -1, node: [-76, 3899], out: [1, 0] },
    // out: from the south-east corner, carrying 3767 street on to the motorway
    leave: { s: 0.1905, side: -1, node: [-76, 3767], out: [1, 0] },
  },
  ca: {
    enter: { s: 0.8625, side: 1, node: [122, -4678], out: [-1, 0] },
    leave: { s: 0.8912, side: 1, node: [122, -4966], out: [-1, 0] },
  },
};

// A cubic from (a, leaving along ta) to (b, arriving along tb), sampled.
function stBezier(ax, az, tax, taz, bx, bz, tbx, tbz, k1, k2, step) {
  const p1x = ax + tax * k1, p1z = az + taz * k1, p2x = bx - tbx * k2, p2z = bz - tbz * k2;
  const approx = Math.hypot(bx - ax, bz - az) + k1 * 0.3 + k2 * 0.3;
  const n = Math.max(8, Math.ceil(approx / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({ x: u * u * u * ax + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * bx,
               z: u * u * u * az + 3 * u * u * t * p1z + 3 * u * t * t * p2z + t * t * t * bz });
  }
  return out;
}

// The street a link carries on from: the arm running the opposite way to `out`.
function stCarriedOn(node, ox, oz) {
  for (const a of node.arms) if (a.dx * ox + a.dz * oz < -0.9) return a;
  return null;
}

// A strip of road, its own width at every point (a spur narrowing to a street).
function stStrip(pts, widths, mat, g) {
  const pos = [], uv = [], idx = [];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], w = widths[i];
    if (i > 0) along += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const rx = -p.fz, rz = p.fx;
    pos.push(p.x - rx * w, p.y, p.z - rz * w, p.x + rx * w, p.y, p.z + rz * w);
    // the carriageway tile mirrored about the middle, as the city streets have it
    uv.push(w / 17.5, along / 12, w / 17.5, along / 12);
    if (i < pts.length - 1) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function stDirs(pts) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    pts[i].fx = (b.x - a.x) / l; pts[i].fz = (b.z - a.z) / l;
  }
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    pts[i].s = run;
  }
  return pts;
}

// ---- off the motorway and on to a street -----------------------------------
function stBuildExitSpur(city, spec, g, tarmac, into) {
  const node = city.nodeMap.get(stKey(spec.node[0], spec.node[1]));
  if (!node) { console.warn("streets: no junction for the", city.key, "spur at", spec.node); return null; }
  const [ox, oz] = spec.out;
  const along = stCarriedOn(node, ox, oz);
  const at = hwySampleAt(spec.s * highway.length);
  const rx = -at.fz, rz = at.fx;
  // from the carriageway's centreline, the way every spur starts
  const raw = stBezier(at.x, at.z, at.fx, at.fz, node.x, node.z, -ox, -oz, 150, 170, 10);
  const pts = stDirs(raw);
  const n = pts.length, streetHalf = along ? along.road.halfW : 10;
  const endY = terrainMeshY(node.x, node.z) + CITY.groundLift;
  const widths = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const p = pts[k];
    const ground = Math.max(terrainEff(p.x, p.z), TUNE.waterLevel) + HW.clearance;
    let y = lerp(at.y, ground, smoothstep(0, HW.spurDescend, t));
    // and down on to the city's own ground over the last stretch, to meet the street
    y = lerp(y, terrainMeshY(p.x, p.z) + CITY.groundLift, smoothstep(0.8, 1, t));
    if (k === n - 1) y = endY;
    p.y = y;
    widths.push(lerp(HW.spurW, streetHalf, smoothstep(0.7, 1, t)));
  }
  stStrip(pts, widths, tarmac, g);
  hwyClaimCorridor(pts);
  // the board, one icon, no letters: a skyline
  const bx = at.x + rx * spec.side * (highway.halfW + 16), bz = at.z + rz * spec.side * (highway.halfW + 16);
  hwyExitBoard(g, bx, at.y, bz, at, "skyline");
  const rec = { s: spec.s, side: spec.side, icon: "skyline", to: city.key + (into ? "CityIn" : "CityOut"),
                city: city.key, noJunction: true, x: at.x, z: at.z, y: at.y, spur: pts, bx, bz };
  highway.exits.push(rec);
  // and to the planner, a road from the junction out to the motorway
  // Its lanes are the street's: the planner has him from `handoff` out, and
  // arriving down the middle of the ramp put him on the street's centre line
  // with the oncoming lane a car's width away.
  const r = stRoad({ city: city.key, kind: "exit", pts: pts.map(p => ({ x: p.x, z: p.z, y: p.y })).reverse(),
                     halfW: streetHalf, lo: along ? along.road.lo : ST.laneWide, drape: false, spurExit: rec });
  stAttach(node, r, true);
  city.links.push(r);
  rec.street = r;
  return rec;
}

// ---- New York: up on to the harbour bridge -----------------------------------
// From the north-east corner the avenue carries straight on and climbs, on a
// long left-hand curve, to the bridge's east end. The deck is a road to its
// far end, over the water, and there it turns round: a dead end with a
// turnaround, which is the one kind of dead end the grid allows.
function stBuildBridge(city, g, tarmac) {
  const lm = ROUTE_LANDMARKS.find(l => l.name === "bridgeNY1");
  if (!lm) return;
  const B = ST.bridge;
  const deckTop = lm.g.position.y + lm.g.userData.bridgeDeckY + 2.25;
  const zc = lm.z + lm.g.userData.bridgeDeckW / 2;
  const xEast = lm.x + lm.g.userData.bridgeLen / 2, xWest = lm.x - lm.g.userData.bridgeLen / 2;
  const nodeA = city.nodeMap.get(stKey(B.from[0], B.from[1]));
  if (!nodeA) return;
  // the ramp: north out of the corner, curving left, then straight on to the deck
  const ramp = [];
  const R = zc - nodeA.z, cx = nodeA.x - R, cz = nodeA.z;
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * Math.PI / 2;
    ramp.push({ x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R });
  }
  const runIn = (cx - xEast);
  for (let k = 1; k <= 4; k++) ramp.push({ x: cx - runIn * k / 4, z: zc });
  stDirs(ramp);
  const y0 = terrainMeshY(nodeA.x, nodeA.z) + CITY.groundLift;
  const total = ramp[ramp.length - 1].s;
  for (const p of ramp) p.y = lerp(y0, deckTop, smoothstep(0.02, 0.96, p.s / total));
  // piers under it, and a rail each side once it is off the ground
  const mat = artPaint(mattMat(TUNE.palette.concrete), "concrete");
  const piers = [];
  for (let i = 3; i < ramp.length; i += 3) {
    const p = ramp[i], gy = Math.max(terrainEff(p.x, p.z), TUNE.waterLevel);
    if (p.y - gy > 3) piers.push({ w: 3, h: p.y - gy, d: 3, x: p.x, y: (p.y + gy) / 2 - 0.4, z: p.z });
  }
  if (piers.length) g.add(new THREE.Mesh(mergeBoxes(piers), mat));
  stStrip(ramp, ramp.map(() => B.halfW), tarmac, g);
  const railPts = (pts, side) => pts.map(p => ({ x: p.x - p.fz * side * B.halfW, z: p.z + p.fx * side * B.halfW,
                                                 y: p.y + 0.6, fx: p.fx, fz: p.fz }));
  const railMat = metalMat(TUNE.palette.steel, 20);
  for (const side of [-1, 1]) {
    const rp = railPts(ramp, side).filter((p, i) => ramp[i].y - terrainEff(ramp[i].x, ramp[i].z) > 1.5);
    if (rp.length > 1) stStrip(rp, rp.map(() => 0.3), railMat, g);
  }
  hwyClaimCorridor(ramp);
  const rampRoad = stRoad({ city: city.key, kind: "link", pts: ramp, halfW: B.halfW, lo: ST.laneWide,
                            drape: false, railed: true });
  stAttach(nodeA, rampRoad, true);
  const nodeB = stNodeAt(city, xEast, zc);
  stAttach(nodeB, rampRoad, false);
  // the deck, east end to the turnaround short of the west end
  const deck = [];
  const xEnd = xWest + B.endBack;
  for (let k = 0; k <= 30; k++) deck.push({ x: lerp(xEast, xEnd, k / 30), z: zc, y: deckTop });
  stDirs(deck);
  // tarmac on the deck, a hand above the concrete, so the lanes carry on up here
  stStrip(deck.map(p => ({ ...p, y: p.y + 0.06 })), deck.map(() => B.halfW), tarmac, g);
  for (const side of [-1, 1]) {
    const rp = railPts(deck, side);
    stStrip(rp, rp.map(() => 0.3), railMat, g);
  }
  const deckRoad = stRoad({ city: city.key, kind: "link", pts: deck, halfW: B.halfW, lo: ST.laneWide,
                            drape: false, railed: true });
  stAttach(nodeB, deckRoad, true);
  const nodeC = stNodeAt(city, xEnd, zc);
  stAttach(nodeC, deckRoad, false);
  city.links.push(rampRoad, deckRoad);
  city.bridge = { ramp: rampRoad, deck: deckRoad, top: deckTop, xEast, xEnd, z: zc };
}

// ---- California: the boulevard to the harbour ------------------------------
// Straight down from downtown's south edge to the coast road, which it meets
// at a T. The coast road is the harbour spur (harbor.js): it is built after
// this file, so the boulevard is laid now and joined to it when it exists.
function stBuildBoulevard(city, g, tarmac) {
  const B = ST.boulevard;
  const node = city.nodeMap.get(stKey(B.from[0], B.from[1]));
  if (!node) return;
  const pts = [];
  const n = Math.ceil((node.z - B.toZ) / 12);
  for (let k = 0; k <= n; k++) pts.push({ x: node.x, z: lerp(node.z, B.toZ, k / n) });
  stDirs(pts);
  const y0 = terrainMeshY(node.x, node.z) + CITY.groundLift;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const ground = Math.max(terrainEff(p.x, p.z), TUNE.waterLevel) + ST.linkLift;
    p.y = lerp(y0, ground, smoothstep(0, 40, p.s));
  }
  stStrip(pts, pts.map(() => B.halfW), tarmac, g);
  hwyClaimCorridor(pts);
  const r = stRoad({ city: city.key, kind: "link", pts, halfW: B.halfW, lo: ST.laneWide, drape: false, parking: false });
  stAttach(node, r, true);
  city.links.push(r);
  city.boulevard = r;
}

// Called by harbor.js once the coast road exists: split it where the boulevard
// meets it, into the way to the motorway and the way to the harbour.
function stJoinHarbour(rec) {
  const city = streets.cities.ca;
  if (!city || !city.boulevard || !rec || !rec.spur) return;
  const r = city.boulevard, end = r.pts[r.pts.length - 1];
  const sp = rec.spur;
  // where along the coast road the boulevard's end is nearest
  let bi = 1, bt = 0, bd = Infinity;
  for (let i = 1; i < sp.length; i++) {
    const a = sp[i - 1], b = sp[i];
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
    const t = clamp(((end.x - a.x) * ex + (end.z - a.z) * ez) / l2, 0, 1);
    const d = Math.hypot(a.x + ex * t - end.x, a.z + ez * t - end.z);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const a = sp[bi - 1], b = sp[bi];
  const J = { x: lerp(a.x, b.x, bt), z: lerp(a.z, b.z, bt), y: lerp(a.y, b.y, bt) };
  // the last stretch of the boulevard, bent to meet the road exactly
  const last = r.pts[r.pts.length - 1];
  last.x = J.x; last.z = J.z; last.y = J.y;
  stDirs(r.pts); r.len = r.pts[r.pts.length - 1].s;
  const node = stNodeAt(city, J.x, J.z);
  stAttach(node, r, false);
  const west = [J, ...sp.slice(0, bi).reverse()].map(p => ({ x: p.x, z: p.z, y: p.y }));
  const east = [J, ...sp.slice(bi)].map(p => ({ x: p.x, z: p.z, y: p.y }));
  // the way back to the motorway is an exit; the way to the harbour is where
  // the boulevard is FOR, so hands-off goes that way
  const w = stRoad({ city: "ca", kind: "coast", pts: west, halfW: HW.spurW, lo: 0, drape: false, spurExit: rec });
  const e = stRoad({ city: "ca", kind: "coast", pts: east, halfW: HW.spurW, lo: 0, drape: false, spurExit: rec });
  e.toHarbour = true;
  stAttach(node, w, true); stAttach(node, e, true);
  city.links.push(w, e);
  city.harbourJoin = { x: J.x, z: J.z, node };
  streets.paths = null;
  stBuildPolicy(city);
}

function stBuildLinks(g) {
  const tarmac = artPaint(mattMat(TUNE.runwaySurfaceColor), "road");
  for (const k in streets.cities) {
    const city = streets.cities[k], L = ST_LINKS[k];
    if (!L) continue;
    stBuildExitSpur(city, L.enter, g, tarmac, true);
    stBuildExitSpur(city, L.leave, g, tarmac, false);
    if (k === "ny") stBuildBridge(city, g, tarmac);
    if (k === "ca") stBuildBoulevard(city, g, tarmac);
  }
}
// ---------------------------------------------------------------------------
// CITY TRAFFIC. Cars, taxis, buses and delivery vans, both ways down every
// street near him, turning at junctions, queuing at reds. Machines only.
//
// THE SAME THREE PROMISES AS THE MOTORWAY, because a held finger never bangs
// here either:
//   - nothing behind him in his lane ever drives into him (it holds his speed);
//   - nothing ahead of him in his lane is ever a wall (it outruns him, goes
//     straight on at the next junction and does not stop at the red there);
//   - nothing crosses in front of him: a car does not enter a junction he will
//     reach inside `yieldT` seconds.
// Everything else is ordinary traffic: a queue, a signal, a turn.
// ---------------------------------------------------------------------------
const STT = TUNE.city.traffic;
const stTraffic = { list: [], meshes: [], city: null, parked: null, peds: null };
// type: 0 car, 1 taxi, 2 bus, 3 delivery van -- half-extents for touching, speed
const ST_TYPES = [
  { hw: 1.7, hl: 3.8, y: 1.2 },
  { hw: 1.7, hl: 3.8, y: 1.2 },
  { hw: 1.7, hl: 7.0, y: 1.9 },
  { hw: 1.6, hl: 4.6, y: 1.8 },
];

function stBuildTrafficMeshes(g) {
  const C = TUNE.palette, L = ART_LAYER, W = 0xffffff, dark = C.ink, glass = C.night;
  const wheels = (xs, zs, y) => zs.flatMap(z => xs.map(x => ({ w: 0.5, h: 1.0, d: 1.1, x, y, z, c: dark, l: L.asphalt })));
  const car = [
    { w: 3.4, h: 1.05, d: 7.6, y: -0.55, c: W, l: L.deck },
    { w: 3.0, h: 0.85, d: 3.9, y: 0.4, z: 0.4, c: glass, l: L.glass },
    { w: 2.9, h: 0.2, d: 3.5, y: 0.93, z: 0.45, c: W, l: L.deck },
    ...wheels([-1.5, 1.5], [-2.4, 2.4], -0.6),
  ];
  const taxi = [...car.map(b => b.c === W ? { ...b, c: C.gold } : b),
    { w: 1.4, h: 0.45, d: 0.6, y: 1.25, z: 0.5, c: W, l: L.deck }];      // the roof lamp, no letters
  const bus = [
    { w: 3.4, h: 3.0, d: 14, y: 0.2, c: C.blue, l: L.deck },
    { w: 3.5, h: 1.1, d: 12.4, y: 0.7, z: 0.4, c: glass, l: L.glass },
    { w: 3.2, h: 1.3, d: 0.12, y: 0.6, z: -7.02, c: glass, l: L.glass },
    ...wheels([-1.5, 1.5], [-4.6, 4.8], -1.3),
  ];
  const van = [
    { w: 3.2, h: 2.2, d: 2.6, y: -0.2, z: -3.3, c: W, l: L.deck },
    { w: 2.8, h: 0.9, d: 0.12, y: 0.4, z: -4.62, c: glass, l: L.glass },
    { w: 3.2, h: 3.2, d: 6.4, y: 0.3, z: 1.3, c: W, l: L.container },
    ...wheels([-1.4, 1.4], [-3.2, 3.2], -1.3),
  ];
  const mat = artPaint(new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true,
    shininess: 30, specular: 0x4a5058 }), "vehicle");
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < STT.count; i++) counts[stTypeOf(i)]++;
  stTraffic.meshes = [car, taxi, bus, van].map((parts, k) => {
    const m = new THREE.InstancedMesh(hwyVehicleGeo(parts), mat, Math.max(1, counts[k]));
    m.frustumCulled = false; m.castShadow = true; m.userData.noSolid = true;
    m.userData.cap = Math.max(1, counts[k]);           // `count` is how many are drawn this frame
    m.setColorAt(0, new THREE.Color(0xffffff));
    g.add(m);
    return m;
  });
  // a car's colour comes from its slot, as on the motorway; the rest are liveries
  let ci = 0;
  for (let i = 0; i < STT.count; i++) if (stTypeOf(i) === 0) {
    stTraffic.meshes[0].setColorAt(ci++, new THREE.Color(HWY_CAR_TINTS[(i * 3 + 1) % HWY_CAR_TINTS.length]));
  }
  for (let k = 1; k < 4; k++) for (let i = 0; i < counts[k]; i++) stTraffic.meshes[k].setColorAt(i, new THREE.Color(0xffffff));
  for (const m of stTraffic.meshes) m.instanceColor.needsUpdate = true;
  for (let i = 0; i < STT.count; i++) stTraffic.list.push({ type: stTypeOf(i), alive: false, road: null, dir: 1, s: 0,
    speed: 0, sp: 0, path: null, ps: 0, next: null, wx: 0, wz: 0, wy: 0, hx: 0, hz: -1, spin: 0, respawn: 0 });
}
function stTypeOf(i) { return i % 9 === 4 ? 2 : i % 7 === 3 ? 3 : i % 4 === 1 ? 1 : 0; }

// Which city he is in or near, if any.
function stCityNear(x, z, margin) {
  for (const k in streets.cities) {
    const b = streets.cities[k].data.bounds;
    if (x > b[0] - margin && x < b[2] + margin && z > b[1] - margin && z < b[3] + margin) return streets.cities[k];
  }
  return null;
}

function stPlaceVehicle(v, city, px, pz, far) {
  const roads = city.roads;
  for (let tries = 0; tries < 16; tries++) {
    const r = roads[Math.floor(Math.random() * roads.length)];
    if (r.kind !== "grid") continue;
    // never already over a stop line: a car that starts inside a junction's
    // zone is "crossing" and never asks whether it may
    const s = STT.spawnClear + Math.random() * Math.max(1, r.len - 2 * STT.spawnClear);
    const dir = Math.random() < 0.5 ? 1 : -1;
    stPointAt(r, s, dir, r.lo, stTmpA);
    const d = Math.hypot(stTmpA.x - px, stTmpA.z - pz);
    const keep = Math.max(STT.keepOut, state.speed * STT.chainT);
    if (d > STT.range || d < (far ? keep : 0)) continue;
    // never materialise in his lane ahead of him: that is a wall out of nowhere
    if (stPlaceHim && stPlaceHim.lanes.some(L => L.road === r && L.dir === dir)) continue;
    let clash = false;
    for (const o of stTraffic.list) {
      if (o !== v && o.alive && o.road === r && o.dir === dir && Math.abs(o.s - s) < 16) { clash = true; break; }
    }
    if (clash) continue;
    v.road = r; v.dir = dir; v.s = s; v.path = null; v.next = null;
    v.speed = STT.speed[0] + Math.random() * (STT.speed[1] - STT.speed[0]);
    if (v.type === 2) v.speed *= 0.8;
    v.sp = v.speed * 0.6; v.alive = true; v.spin = 0; v.respawn = 0; v.city = city.key;
    return true;
  }
  v.alive = false; v.respawn = 0.5;
  return false;
}

// Is this approach to a junction the signal's MAIN axis (its f direction)?
function stSignalAspect(node, road) {
  const j = node.signal;
  if (!j) return "green";
  const p0 = road.pts[0], p1 = road.pts[road.pts.length - 1];
  const l = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1;
  const main = Math.abs(((p1.x - p0.x) * j.fx + (p1.z - p0.z) * j.fz) / l) > 0.7;
  return ltAspect(j, main);
}

// Where he is on the street network, for the traffic's three promises: his
// road, and the chain of roads and junctions ahead of him -- his plan at the
// next junction, straight on after that -- as far as he could cover in
// `chainT` seconds. At the top speed step that is several blocks.
function stHim() {
  if (typeof carActive !== "function" || !carActive() || state.exploding) return null;
  // Off every street -- the square, a pavement -- he has no lane and no
  // junctions ahead, but the net under the promises is measured on the ground
  // and still holds: nothing stays in front of him.
  // On a city's off-ramp the motorway's spur logic drives him until he is near
  // the grid, but the planner already knows the ramp is his road and where it
  // arrives -- and a junction he is coming in to at speed must be kept clear
  // from well before he is "on a street".
  const onRamp = stPlan.road && (stPlan.road.kind === "exit" || stPlan.road.kind === "coast");
  if (!stPlan.road || (!car.onStreet && !onRamp)) return { x: state.x, z: state.z, speed: state.speed, lanes: [], nodes: [], off: true };
  const r = stPlan.road, p = stProject(r, state.x, state.z);
  const toGo = stPlan.dir > 0 ? r.len - p.s : p.s;
  const him = { road: r, dir: stPlan.dir, s: p.s, toGo, speed: state.speed, x: state.x, z: state.z,
                want: state.touching ? CAR.cruise * spdMul() : 0,
                lanes: [{ road: r, dir: stPlan.dir, base: -(stPlan.dir > 0 ? p.s : r.len - p.s) }], nodes: [] };
  // the lanes as far as the yield looks; the junctions as far as a slow
  // turning car could still be in one when he arrives
  const reach = Math.max(STT.yieldReach, state.speed * STT.chainT);
  const claim = Math.max(reach, state.speed * STT.claimT);
  let road = r, dir = stPlan.dir, dist = toGo;
  let arm = stPlan.turn ? stPlan.turn.arm : null;
  for (let hop = 0; hop < 14 && dist < claim; hop++) {
    const node = dir > 0 ? road.b : road.a;
    if (!node) break;
    him.nodes.push({ node, dist });
    if (!arm) {
      const inArm = stArrivalArm(node, road, dir);
      const st = inArm ? stStraight(stChoices(node, inArm)) : null;
      arm = st ? st.arm : null;
    }
    if (!arm) break;
    road = arm.road; dir = stArmDir(arm);
    if (dist < reach) him.lanes.push({ road, dir, base: dist });
    dist += road.len; arm = null;
  }
  return him;
}

// How far ahead of him, along his lane, is this vehicle? null if not in it.
function stGapAhead(v, him) {
  for (const L of him.lanes) {
    if (v.road !== L.road || v.dir !== L.dir) continue;
    // one on a corner's path is still on the road it is turning off, and it
    // is still in his way: where along that road is it?
    const s = v.path ? stProject(L.road, v.wx, v.wz).s : v.s;
    return L.base + (L.dir > 0 ? s : L.road.len - s);
  }
  return null;
}

// The safety net under all three promises, measured on the ground rather than
// on the graph: anything in front of him, inside his path and inside the
// distance he covers in `guardT`, is hurried out of it -- it never stops there.
// Only what is going his way, or already committed to a junction across him,
// is hurried: an oncoming car passes by on its own side, and a crossing car
// still short of its line is stopped by the claim instead -- hurried, it would
// run its line and turn across him.
function stInHisWay(v, him) {
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const dx = v.wx - him.x, dz = v.wz - him.z;
  const along = dx * fx + dz * fz, lat = Math.abs(dx * -fz + dz * fx);
  if (!(along > 0 && along < him.speed * STT.guardT + STT.guardGap && lat < STT.guardLat)) return false;
  const dot = v.hx * fx + v.hz * fz;
  if (dot < -0.3) return false;                                   // oncoming
  if (dot > 0.3) return true;                                     // going his way
  return !!v.path || v.crossing;                                  // across him: only once committed
}

// Would he be inside this junction before a vehicle entering it now is out of
// it again (`clearT`)? Then nothing enters. A turning car is slow and its path
// is long; a straight one still has two stop lines, a box and itself to clear.
function stHimClaims(node, him, clearT) {
  if (!him) return false;
  if (Math.hypot(him.x - node.x, him.z - node.z) < STT.boxR + 6) return true;     // he is in it
  // at the speed he is heading for, not the one he has: coming off a corner
  // or a ramp he is still gathering speed, and arrives sooner than it says
  const v = Math.max(him.speed, him.want || 0);
  if (v < 1) return false;
  const window = STT.yieldT + clearT;
  for (const n of him.nodes) if (n.node === node) return n.dist / v < window;
  return false;
}

// Everything that makes a vehicle stop short of a junction: a red, him about to
// be in it, another car crossing it, the car in front. Returns the speed it may
// have, `toGo` metres short of the junction's middle.
// Is there room on the far side for it to get out of the junction?
function stExitRoom(v, arm) {
  if (!arm) return true;
  const r = arm.road, d = stArmDir(arm), T = ST_TYPES[v.type];
  for (const o of stTraffic.list) {
    if (o === v || !o.alive || o.spin || o.road !== r || o.dir !== d || o.path) continue;
    const from = d > 0 ? o.s : r.len - o.s;
    if (from < T.hl * 2 + STT.queueGap + ST_TYPES[o.type].hl && (o.sp || 0) < 3) return false;
  }
  return true;
}

function stStopFor(v, node, road, toGo, sp, turning, him) {
  const cross = node.arms.reduce((m, a) => a.road === road ? m : Math.max(m, a.road.halfW), 0);
  const line = cross + ST.zebraGap + ST.zebraLen + STT.stopGap;
  if (toGo < line - 2) {
    // over the line: it is crossing, and it holds the junction while it does
    if (toGo > -cross - 4) { node.res = v; node.resT = STT.resHold; }
    v.crossing = true;
    return sp;
  }
  v.crossing = false;
  const aspect = stSignalAspect(node, road);
  let stop = aspect === "red" || (aspect === "amber" && toGo - line > v.sp * v.sp / (2 * STT.brake));
  // how long it would be in the junction: across it, its own length, and a corner is slow
  const clearT = (2 * line + 2 * ST_TYPES[v.type].hl) / Math.max(4, v.speed) + (turning ? STT.turnClearT : 0);
  if (!stop && stHimClaims(node, him, clearT)) stop = true;
  if (!stop && node.res && node.res !== v && node.resT > 0) stop = true;
  if (!stop && !stExitRoom(v, v.path ? v.path.arm : v.next)) stop = true;
  if (!stop) return sp;
  // and it holds SHORT of the line: braking lags the target, so the frame that
  // would carry it over is clamped (stDriveVehicle reads v.hold)
  v.hold = toGo - line - STT.lineBack;
  return Math.min(sp, Math.max(0, v.hold) * 0.6);
}

const stDummy = new THREE.Object3D(), stTAim = {};
let stPlaceHim = null;
function stUpdateTraffic(dt) {
  if (!stTraffic.meshes.length) return;
  const px = state.x, pz = state.z;
  const city = stCityNear(px, pz, ST.wake);
  const him = stHim();
  stPlaceHim = him;
  const idx = [0, 0, 0, 0];
  for (const v of stTraffic.list) {
    if (!city) { v.alive = false; continue; }
    if (!v.alive || v.city !== city.key) {
      v.respawn -= dt;
      if (v.respawn > 0 && v.city === city.key) continue;
      if (!stPlaceVehicle(v, city, px, pz, true)) continue;
    }
    if (Math.hypot(v.wx - px, v.wz - pz) > STT.range * 1.3 && v.wx !== 0) {
      if (!stPlaceVehicle(v, city, px, pz, true)) continue;
    }
    stDriveVehicle(v, dt, him);
    const T = ST_TYPES[v.type], m = stTraffic.meshes[v.type];
    stDummy.position.set(v.wx, v.wy, v.wz);
    stDummy.rotation.set(0, Math.atan2(-v.hx, -v.hz) + v.spin, 0);
    stDummy.scale.setScalar(1);
    stDummy.updateMatrix();
    if (idx[v.type] < m.userData.cap) m.setMatrixAt(idx[v.type]++, stDummy.matrix);
    void T;
  }
  stDummy.position.set(0, -9999, 0); stDummy.scale.setScalar(0.001); stDummy.updateMatrix();
  // only the cars that exist are drawn
  stTraffic.meshes.forEach((m, k) => {
    m.count = idx[k];
    m.instanceMatrix.needsUpdate = true;
  });
}

function stDriveVehicle(v, dt, him) {
  const T = ST_TYPES[v.type];
  if (v.spin) { v.spin += dt * 6; v.respawn -= dt; if (v.respawn <= 0) { v.alive = false; v.respawn = STT.respawn; v.spin = 0; } return; }
  let sp = v.speed;
  let yieldMode = false;
  // ---- the three promises
  if (him) {
    const gap = stGapAhead(v, him);
    const reach = Math.max(STT.yieldReach, him.speed * STT.chainT);
    // Close ahead of him it keeps ahead whatever his speed -- at a corner he is
    // slow too, and a car slowing for its own corner in front of him is a wall.
    const close = gap !== null && gap > 0 && gap < him.speed * STT.closeT + STT.closeGap;
    if (!v.spin && stInHisWay(v, him)) {
      // in front of him and in his way, whatever the graph says: out of it, now
      v.sp = Math.max(v.sp, him.speed * 1.1, STT.turnSpeed);
      sp = Math.max(sp, him.speed * 1.1);
      yieldMode = true;
    } else if (gap !== null && gap > 0 && gap < reach && (him.speed > sp * 0.9 || close)) {
      // ahead of him in his lane: never a wall. It goes, and it keeps going.
      const k = clamp((reach - gap) / Math.max(1, reach - STT.yieldMatch), 0, 1);
      sp = Math.max(sp, lerp(sp, him.speed * 1.05, k));
      yieldMode = true;
    } else if (gap !== null && gap < 0 && -gap < STT.follow) {
      // behind him: never into the back of him
      sp = Math.min(sp, him.speed * 0.98);
    }
  }
  const acc = (yieldMode ? STT.yieldAccel : STT.accel) * dt;
  if (v.path) {
    // ---- round a corner, on the cached path; still short of the junction's
    // middle it stops for the same things it would on the road
    const P = v.path;
    if (!yieldMode) sp = Math.min(sp, STT.turnSpeed);
    const toNode = P.inLen - v.ps;
    v.hold = null;
    if (!yieldMode && toNode > 0) sp = stStopFor(v, P.node, v.road, toNode, sp, true, him);
    v.sp += clamp(sp - v.sp, -STT.brake * dt, acc);
    let move = v.sp * dt;
    if (v.hold !== null) { move = Math.min(move, Math.max(0, v.hold)); if (v.hold <= 0.05) v.sp = 0; }
    v.ps += move;
    const pts = P.pts;
    if (v.ps >= pts[pts.length - 1].s - 0.01 || v.ps > P.exitS + 2) {
      // on to the road it turned into, at the matching place along it
      const arm = P.arm, r = arm.road;
      const p = stProject(r, v.wx, v.wz);
      v.road = r; v.dir = stArmDir(arm); v.s = clamp(p.s, 0, r.len); v.path = null; v.next = null;
    } else {
      let i = 1; while (i < pts.length - 1 && pts[i].s < v.ps) i++;
      const a = pts[i - 1], b = pts[i], l = Math.max(1e-3, b.s - a.s), t = clamp((v.ps - a.s) / l, 0, 1);
      v.wx = lerp(a.x, b.x, t); v.wz = lerp(a.z, b.z, t);
      v.hx = (b.x - a.x) / l; v.hz = (b.z - a.z) / l;
      v.wy = terrainMeshY(v.wx, v.wz) + CITY.groundLift + T.y;
      return;
    }
  }
  const r = v.road, node = v.dir > 0 ? r.b : r.a;
  const toGo = v.dir > 0 ? r.len - v.s : v.s;
  // ---- the junction ahead: where it goes next
  if (node && !v.next && toGo < STT.decide) {
    const inArm = stArrivalArm(node, r, v.dir);
    const ch = inArm ? stChoices(node, inArm) : [];
    // traffic stays in the grid: a link out of the city is his, not theirs
    const grid = ch.filter(c => c.arm.road.kind === "grid");
    const straight = stStraight(grid);
    if (yieldMode && straight) v.next = straight.arm;
    else if (grid.length) {
      const roll = Math.random();
      const turns = grid.filter(c => c !== straight);
      v.next = (straight && (roll < STT.straightP || !turns.length)) ? straight.arm
             : turns.length ? turns[Math.floor(Math.random() * turns.length)].arm
             : (straight ? straight.arm : null);
    }
    if (!v.next && inArm) v.next = inArm;                            // a dead end: round it goes
  }
  // yielding, it goes straight on rather than slowing for a corner in front of him
  if (yieldMode && node && v.next) {
    const inArm = stArrivalArm(node, r, v.dir);
    const st = inArm ? stStraight(stChoices(node, inArm).filter(c => c.arm.road.kind === "grid")) : null;
    if (st) v.next = st.arm;
  }
  const J = node && v.next ? stJunctionPath(r, v.dir, node, v.next) : null;
  // ---- stopping: a red, him, a car crossing
  v.hold = null;
  if (node && !yieldMode) sp = stStopFor(v, node, r, toGo, sp, !!(J && J.turn), him);
  // the one ahead of it in its own lane -- but never inside a junction box:
  // a car that stops in the box is a wall across somebody else's road
  const inBox = node && toGo < node.arms.reduce((m, a) => a.road === r ? m : Math.max(m, a.road.halfW), 0) + 2;
  if (!inBox) for (const o of stTraffic.list) {
    if (o === v || !o.alive || o.spin || o.road !== r || o.dir !== v.dir) continue;
    const g = o.path ? toGo : (o.s - v.s) * v.dir;
    if (g > 0 && g < STT.queueGap + ST_TYPES[o.type].hl + T.hl) sp = Math.min(sp, (o.sp || 0) * (g < STT.queueGap ? 0 : 1));
  }
  // slow for a corner it is about to take
  if (!yieldMode && J && J.turn) sp = Math.min(sp, Math.sqrt(STT.turnSpeed * STT.turnSpeed + 2 * STT.brake * Math.max(0, toGo - J.inLen + J.t1S)));
  v.sp += clamp(sp - v.sp, -STT.brake * dt, acc);
  let move = v.sp * dt;
  if (v.hold !== null) { move = Math.min(move, Math.max(0, v.hold)); if (v.hold <= 0.05) v.sp = 0; }
  v.s += move * v.dir;
  const nowToGo = v.dir > 0 ? r.len - v.s : v.s;
  if (J) {
    // on to the corner's path only where the corner starts
    if (J.turn && nowToGo <= J.inLen - J.t1S) {
      v.path = J; v.ps = J.inLen - nowToGo;
      J.node = node;
    } else if (!J.turn && nowToGo < 0) {
      const arm = v.next, nr = arm.road, nd = stArmDir(arm);
      v.road = nr; v.dir = nd; v.s = nd > 0 ? -nowToGo : nr.len + nowToGo; v.next = null;
      if (nr.kind !== "grid") { v.alive = false; v.respawn = 0.2; return; }
    }
  } else if (!node && nowToGo < 0) { v.alive = false; v.respawn = 0.2; return; }
  if (!v.path) {
    stPointAt(v.road, v.s, v.dir, v.road.lo, stTmpA);
    v.wx = stTmpA.x; v.wz = stTmpA.z; v.hx = stTmpA.fx; v.hz = stTmpA.fz;
  }
  v.wy = terrainMeshY(v.wx, v.wz) + CITY.groundLift + T.y;
}

function stUpdateReservations(dt) {
  for (const n of streets.nodes) if (n.resT > 0) { n.resT -= dt; if (n.resT <= 0) n.res = null; }
}

// ---------------------------------------------------------------------------
// TOUCHING. Boxes, not circles: a bus is fourteen metres long and a circle
// either misses its ends or reaches into the next lane. Two turned rectangles
// overlap unless one of their four edge directions separates them.
// ---------------------------------------------------------------------------
function stBoxesTouch(ax, az, ahx, ahz, aw, al, bx, bz, bhx, bhz, bw, bl) {
  const axes = [[ahx, ahz], [-ahz, ahx], [bhx, bhz], [-bhz, bhx]];
  const dx = bx - ax, dz = bz - az;
  for (const [ux, uz] of axes) {
    const ra = Math.abs(ahx * ux + ahz * uz) * al + Math.abs(-ahz * ux + ahx * uz) * aw;
    const rb = Math.abs(bhx * ux + bhz * uz) * bl + Math.abs(-bhz * ux + bhx * uz) * bw;
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}

// The first city vehicle (moving or parked) his car is touching, or null.
function stTouching(x, z, heading) {
  const hx = -Math.sin(heading), hz = -Math.cos(heading);
  const W = CAR.bodyW / 2, L = CAR.bodyL / 2;
  for (const v of stTraffic.list) {
    if (!v.alive || v.spin) continue;
    if (Math.abs(v.wx - x) > 20 || Math.abs(v.wz - z) > 20) continue;
    const T = ST_TYPES[v.type];
    if (stBoxesTouch(x, z, hx, hz, W, L, v.wx, v.wz, v.hx, v.hz, T.hw, T.hl)) return v;
  }
  const city = stCityNear(x, z, 50);
  if (city && city.parked) {
    for (const p of city.parked) {
      if (p.gone > 0 || Math.abs(p.x - x) > 14 || Math.abs(p.z - z) > 14) continue;
      if (stBoxesTouch(x, z, hx, hz, W, L, p.x, p.z, p.hx, p.hz, 1.7, 3.8)) return p;
    }
  }
  return null;
}

// It spins off and comes back later, like every machine he touches.
function stKnock(v) {
  stTraffic.lastTouch = { parked: v.road === undefined, x: Math.round(v.wx ?? v.x), z: Math.round(v.wz ?? v.z),
                          type: v.type, path: !!v.path, sp: v.sp, hx: v.hx, hz: v.hz };
  if (v.road !== undefined) { v.spin = 0.001; v.respawn = 0.9; }
  else v.gone = STT.parkedBack;
  flags.cityTrafficHit = (flags.cityTrafficHit || 0) + 1;
}

// ---------------------------------------------------------------------------
// HIS TRAIL, for the police. In a grid the straight line to him goes through a
// building, so in a city they drive where he drove.
// ---------------------------------------------------------------------------
const stTrail = { pts: [], lastX: null, lastZ: null };
function stRecordTrail() {
  if (!carActive() || state.exploding) return;
  if (stTrail.lastX !== null && Math.hypot(state.x - stTrail.lastX, state.z - stTrail.lastZ) < ST.trailStep) return;
  if (stTrail.lastX !== null && Math.hypot(state.x - stTrail.lastX, state.z - stTrail.lastZ) > ST.trailStep * 20) stTrail.pts.length = 0;
  stTrail.pts.push({ x: state.x, z: state.z });
  if (stTrail.pts.length > ST.trailMax) stTrail.pts.shift();
  stTrail.lastX = state.x; stTrail.lastZ = state.z;
}

// The point `back` metres behind him along where he actually drove, or null
// when he is not in a city (the police then do what they always did).
function stTrailPoint(back, out) {
  if (!stPlan.road || stTrail.pts.length < 2) return null;
  let run = Math.hypot(state.x - stTrail.pts[stTrail.pts.length - 1].x, state.z - stTrail.pts[stTrail.pts.length - 1].z);
  for (let i = stTrail.pts.length - 1; i > 0; i--) {
    const a = stTrail.pts[i], b = stTrail.pts[i - 1];
    const l = Math.hypot(a.x - b.x, a.z - b.z);
    if (run + l >= back) {
      const t = (back - run) / Math.max(1e-3, l);
      out.x = lerp(a.x, b.x, t); out.z = lerp(a.z, b.z, t);
      out.fx = (a.x - b.x) / Math.max(1e-3, l); out.fz = (a.z - b.z) / Math.max(1e-3, l);
      return out;
    }
    run += l;
  }
  const b = stTrail.pts[0];
  out.x = b.x; out.z = b.z; out.fx = 0; out.fz = 0;
  return out;
}

// Is this point on a city street, or within `margin` of its kerb? Streamed
// scenery asks (scenery.js), so nothing grows in the outer half of a perimeter
// street, which runs past the edge of the blocks.
function stNearStreet(x, z, margin) {
  const list = stRoadsNear(x, z);
  if (!list) return false;
  for (const r of list) {
    const p = stProject(r, x, z);
    if (p.d < r.halfW + margin && p.s > -margin && p.s < r.len + margin) return true;
  }
  return false;
}

// The surface under anything driving in a city, or null if it is not on a street.
function stSurfaceAt(x, z) {
  const list = stRoadsNear(x, z);
  if (!list) return null;
  let best = null, bd = Infinity;
  for (const r of list) {
    const p = stProject(r, x, z);
    if (p.d < r.halfW + 2 && p.d < bd && p.s > -2 && p.s < r.len + 2) { bd = p.d; best = stRoadY(r, x, z, clamp(p.s, 0, r.len)); }
  }
  return best;
}

// ---------------------------------------------------------------------------
// WHERE A CRASH IN A CITY COMES BACK: on the street nearest where it happened,
// in the lane for the way he was going, facing along it. Null when the
// motorway is nearer -- the car's own reassembly handles that.
// ---------------------------------------------------------------------------
function stReassembleAt(x, z, heading) {
  if (!stCityNear(x, z, 120)) return null;
  let best = null, bd = Infinity;
  for (const r of streets.roads) {
    if (r.kind !== "grid" && r.kind !== "link") continue;
    const p = stProject(r, x, z);
    const s = clamp(p.s, 0, r.len);
    if (p.d < bd) { bd = p.d; best = { r, s }; }
  }
  if (!best || bd > ST.reassembleReach) return null;
  const r = best.r;
  // not in the middle of a junction: back along the road a little if need be
  const s = clamp(best.s, Math.min(r.len / 2, 24), Math.max(r.len / 2, r.len - 24));
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  stPointAt(r, s, 1, 0, stTmpA);
  const dir = (fx * stTmpA.fx + fz * stTmpA.fz) >= 0 ? 1 : -1;
  stPointAt(r, s, dir, r.lo, stTmpA);
  return { x: stTmpA.x, z: stTmpA.z, y: stRoadY(r, stTmpA.x, stTmpA.z, s),
           heading: Math.atan2(-stTmpA.fx, -stTmpA.fz), road: r, dir };
}
// ---------------------------------------------------------------------------
// SIGNALS. The bigger junctions -- every third avenue by every third street --
// are lights.js junctions like any other: the same heads, the same halos, the
// same amber wind-up, the same camera flash and the same chase when he runs a
// red. They are built into lights.js's merged masts and its one lamp mesh by
// ltBuild calling this, so a city adds no draw calls for its signals.
// ---------------------------------------------------------------------------
function stBuildSignals(g, masts, arms, boxes, lampPts) {
  for (const k in streets.cities) {
    const city = streets.cities[k], D = city.data;
    const xs = [...new Set(city.nodes.map(n => n.x))].sort((a, b) => a - b);
    const zs = [...new Set(city.nodes.map(n => n.z))].sort((a, b) => a - b);
    for (const n of city.nodes) {
      if (n.arms.length !== 4 || n.arms.some(a => a.road.kind !== "grid")) continue;
      const ix = xs.indexOf(n.x), iz = zs.indexOf(n.z);
      if (ix % ST.signalEvery[0] !== 1 || iz % ST.signalEvery[1] !== 1) continue;
      const aw = D.avenueW / 2, sw = D.streetW / 2;
      const y = terrainMeshY(n.x, n.z) + CITY.groundLift;
      const j = {
        to: "city:" + k, x: n.x, y, z: n.z, fx: 0, fz: 1, rx: -1, rz: 0,
        crossLen: 0, roadHalf: aw, onHighway: false, s: null, city: k,
        mainHalf: aw, crossHalf: sw,
        stopMain: sw + LT.stopGap, stopCross: aw + LT.stopGap,
        phase: Math.floor(Math.random() * LT_PHASES.length), t: Math.random() * LT.green,
        blink: 0, cars: [], lamps: [], awake: false,
      };
      // Each head stands on the FAR side of the junction from the traffic it
      // serves, over that traffic's lane, facing it: stopped at the line he
      // looks straight across at his own. (The motorway puts them on the near
      // side, where from a city's stop line his was behind the windscreen
      // pillar and all he could see was the back of the cross street's.)
      for (const [ax, az, main] of [[-j.fx, -j.fz, true], [j.fx, j.fz, true], [-j.rx, -j.rz, false], [j.rx, j.rz, false]]) {
        const half = main ? aw : sw, crossHalf = main ? sw : aw;
        const side = -az, sideZ = ax;                     // the right of that traffic
        const ahead = crossHalf + ST.mastOut + 1.5;
        const mx = n.x + ax * ahead + side * (half + ST.mastOut);
        const mz = n.z + az * ahead + sideZ * (half + ST.mastOut);
        const hy = y + LT.mastH;
        masts.push({ w: LT.mastR * 2, h: LT.mastH, d: LT.mastR * 2, x: mx, y: y + LT.mastH / 2, z: mz });
        arms.push({ w: LT.armLen, h: LT.mastR * 1.6, d: LT.mastR * 1.6,
                    x: mx - side * LT.armLen / 2, y: hy, z: mz - sideZ * LT.armLen / 2, ry: Math.atan2(-side, -sideZ) });
        const hx = mx - side * LT.armLen, hz = mz - sideZ * LT.armLen;
        boxes.push({ w: LT.headW, h: LT.headH, d: 0.7, x: hx, y: hy - LT.headH / 2 - 0.3, z: hz, ry: Math.atan2(ax, az) });
        for (let q = 0; q < 3; q++) {
          const ly = hy - 0.3 - LT.headH * (0.2 + q * 0.3);
          j.lamps.push({ x: hx - ax * 0.42, y: ly, z: hz - az * 0.42, k: q, main });
          lampPts.push(new THREE.Vector3(hx - ax * 0.42, ly, hz - az * 0.42));
        }
      }
      n.signal = j;
      lights.junctions.push(j);
    }
  }
}

// ---------------------------------------------------------------------------
// PAINT AND KERBS. Laid on the city's own draped ground, per city one mesh
// each: the kerb stones round every block, and at every junction a zebra
// across each arm (and a stop bar where there is a signal). Never art-painted:
// paint is what he reads the road by.
// ---------------------------------------------------------------------------
function stGroundY(x, z, lift) { return terrainMeshY(x, z) + (lift === undefined ? CITY.groundLift : lift); }

function stQuad(pos, idx, ax, az, bx, bz, cx, cz, dx, dz, lift) {
  const o = pos.length / 3;
  pos.push(ax, stGroundY(ax, az, lift), az, bx, stGroundY(bx, bz, lift), bz,
           cx, stGroundY(cx, cz, lift), cz, dx, stGroundY(dx, dz, lift), dz);
  idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
}

function stBuildPaint(city, g) {
  const D = city.data, pos = [], idx = [];
  const lift = CITY.groundLift + 0.04;
  for (const n of city.nodes) {
    for (const a of n.arms) {
      if (a.road.kind !== "grid") continue;
      const half = a.road.halfW;
      // the widest road crossing this arm is the junction box's size
      let box = 0;
      for (const b of n.arms) if (b !== a && Math.abs(b.dx * a.dx + b.dz * a.dz) < 0.5) box = Math.max(box, b.road.halfW);
      if (!box) box = half;
      const rx = -a.dz, rz = a.dx;
      const d0 = box + ST.zebraGap, d1 = d0 + ST.zebraLen;
      const nStripes = Math.floor((2 * half - 2) / (ST.zebraW * 2));
      for (let k = 0; k < nStripes; k++) {
        const u0 = -half + 1 + k * ST.zebraW * 2 + ST.zebraW * 0.5, u1 = u0 + ST.zebraW;
        stQuad(pos, idx,
          n.x + a.dx * d0 + rx * u0, n.z + a.dz * d0 + rz * u0,
          n.x + a.dx * d0 + rx * u1, n.z + a.dz * d0 + rz * u1,
          n.x + a.dx * d1 + rx * u1, n.z + a.dz * d1 + rz * u1,
          n.x + a.dx * d1 + rx * u0, n.z + a.dz * d1 + rz * u0, lift);
      }
      if (n.signal) {
        // the stop bar, across the lane that arrives here (its right-hand side)
        const s0 = d1 + 1.2, s1 = s0 + 0.9;
        stQuad(pos, idx,
          n.x + a.dx * s0, n.z + a.dz * s0, n.x + a.dx * s0 - rx * (half - 1), n.z + a.dz * s0 - rz * (half - 1),
          n.x + a.dx * s1 - rx * (half - 1), n.z + a.dz * s1 - rz * (half - 1), n.x + a.dx * s1, n.z + a.dz * s1, lift);
      }
    }
  }
  // kerbs: a stone along every block edge, following the drape in short runs --
  // into the SAME mesh as the paint, coloured per vertex: one draw call a city
  const paintVerts = pos.length / 3;
  const kp = pos, ki = idx;
  const aw = D.avenueW / 2, sw = D.streetW / 2;
  for (const b of D.blocks) {
    const x0 = b[0] + aw, x1 = b[2] - aw, z0 = b[1] + sw, z1 = b[3] - sw;
    const edges = [[x0, z0, x1, z0, 0, -1], [x1, z0, x1, z1, 1, 0], [x1, z1, x0, z1, 0, 1], [x0, z1, x0, z0, -1, 0]];
    for (const [ax, az, bx, bz, ox, oz] of edges) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / ST.kerbStep));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const px0 = lerp(ax, bx, t0), pz0 = lerp(az, bz, t0), px1 = lerp(ax, bx, t1), pz1 = lerp(az, bz, t1);
        // top face: from the road edge inward by kerbW, at kerb height
        const ix = -ox * ST.kerbW, iz = -oz * ST.kerbW;
        const top = CITY.sidewalkLift + ST.kerbH, road = CITY.groundLift;
        const o = kp.length / 3;
        const y00 = terrainMeshY(px0, pz0), y01 = terrainMeshY(px1, pz1);
        const y10 = terrainMeshY(px0 + ix, pz0 + iz), y11 = terrainMeshY(px1 + ix, pz1 + iz);
        kp.push(px0, y00 + road, pz0, px1, y01 + road, pz1, px1, y01 + top, pz1, px0, y00 + top, pz0,
                px0 + ix, y10 + top, pz0 + iz, px1 + ix, y11 + top, pz1 + iz);
        // the face toward the street, and the top
        ki.push(o, o + 1, o + 2, o, o + 2, o + 3, o + 3, o + 2, o + 5, o + 3, o + 5, o + 4);
      }
    }
  }
  const col = new Float32Array(kp.length), cp = new THREE.Color(TUNE.runwayPaintColor), ck = new THREE.Color(TUNE.palette.steel);
  for (let v = 0; v < kp.length / 3; v++) {
    const c = v < paintVerts ? cp : ck;
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  const kg = new THREE.BufferGeometry();
  kg.setAttribute("position", new THREE.Float32BufferAttribute(kp, 3));
  kg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  kg.setIndex(ki);
  kg.computeVertexNormals();
  const km = new THREE.Mesh(kg, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  km.receiveShadow = true;
  g.add(km);
}

// ---------------------------------------------------------------------------
// PARKED CARS, on the wide streets' outer strip, clear of every junction.
// Slots are laid once; the few hundred nearest him are drawn, re-sorted a few
// times a second, the way the city's buildings are.
// ---------------------------------------------------------------------------
function stLayParking(city) {
  city.parked = [];
  let h = 0;
  for (const r of city.roads) {
    if (r.kind !== "grid" || !r.parking) continue;
    for (const side of [1, -1]) {
      const clear = (n) => n.arms.reduce((m, a) => a.road === r ? m : Math.max(m, a.road.halfW), 0) + ST.zebraGap + ST.zebraLen + ST.parkClear;
      const s0 = clear(r.a), s1 = r.len - clear(r.b);
      for (let s = s0 + 4; s < s1 - 4; s += ST.parkEvery) {
        h = (h * 1103515245 + 12345) >>> 0;
        if ((h >>> 8) % 100 >= ST.parkedPct) continue;
        stPointAt(r, s, side, r.halfW - ST.parkOut, stTmpA);
        // none along the square: it is open, and he drives out of it anywhere --
        // across the street round it and into whatever is parked on the far side
        const P = city.data.plaza, m = 2 * r.halfW + 4;           // both sides of the street round it
        if (P && stTmpA.x > P[0] - m && stTmpA.x < P[2] + m && stTmpA.z > P[1] - m && stTmpA.z < P[3] + m) continue;
        city.parked.push({ x: stTmpA.x, z: stTmpA.z, hx: stTmpA.fx, hz: stTmpA.fz,
                           y: terrainMeshY(stTmpA.x, stTmpA.z) + CITY.groundLift + 1.2, c: (h >>> 16) % HWY_CAR_TINTS.length,
                           gone: 0 });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PEOPLE, on the pavements and nowhere else. Each walks round its own block a
// pace in from the kerb, so it never steps into a road -- and never has to
// cross one. They are un-hittable: nothing checks them against anything, and
// if he mounts the pavement the ones in his way step back against the wall.
// ---------------------------------------------------------------------------
function stBuildPeople(g) {
  const C = TUNE.palette;
  const parts = [
    { w: 0.7, h: 1.0, d: 0.45, y: 0.95, c: 0xffffff, l: ART_LAYER.deck },       // coat
    { w: 0.6, h: 0.85, d: 0.4, y: 0.42, c: C.slate, l: ART_LAYER.deck },          // legs
    { w: 0.42, h: 0.42, d: 0.42, y: 1.68, c: 0xd9b48f, l: ART_LAYER.deck },       // head
  ];
  const m = new THREE.InstancedMesh(hwyVehicleGeo(parts),
    new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), ST.people.count);
  m.frustumCulled = false; m.userData.noSolid = true;
  const tints = [C.red, C.blue, C.gold, C.white, C.green, C.sea, C.rust, C.steel];
  for (let i = 0; i < ST.people.count; i++) m.setColorAt(i, new THREE.Color(tints[i % tints.length]));
  m.instanceColor.needsUpdate = true;
  g.add(m);
  stTraffic.peds = { mesh: m, list: [] };
  for (let i = 0; i < ST.people.count; i++) stTraffic.peds.list.push({ alive: false, block: null, u: 0, speed: 1.3, back: 0 });
}

// the walk round one block: its perimeter, `inset` from the kerb
function stPedPoint(city, b, u, back, out) {
  const D = city.data, aw = D.avenueW / 2, sw = D.streetW / 2;
  const walk = Math.min(D.inset * 0.5, 1.8) + back * Math.max(0, D.inset - 1.8);
  const x0 = b[0] + aw + walk, x1 = b[2] - aw - walk, z0 = b[1] + sw + walk, z1 = b[3] - sw - walk;
  const W = x1 - x0, H = z1 - z0, P = 2 * (W + H);
  let t = ((u % P) + P) % P;
  if (t < W) { out.x = x0 + t; out.z = z0; out.hx = 1; out.hz = 0; }
  else if ((t -= W) < H) { out.x = x1; out.z = z0 + t; out.hx = 0; out.hz = 1; }
  else if ((t -= H) < W) { out.x = x1 - t; out.z = z1; out.hx = -1; out.hz = 0; }
  else { t -= W; out.x = x0; out.z = z1 - t; out.hx = 0; out.hz = -1; }
  return out;
}

// ---------------------------------------------------------------------------
// THE SQUARE (New York). One block the generator left open, paved, with a
// fountain in the middle he can drive straight through: a splash, the sound of
// one, and nothing else. The basin rim is a kerb, not a wall -- nothing here is
// solid, so there is nothing to crash into.
// ---------------------------------------------------------------------------
function stBuildSquare(city, g) {
  const P = city.data.plaza;
  if (!P) return;
  const cx = (P[0] + P[2]) / 2, cz = (P[1] + P[3]) / 2, F = ST.fountain;
  const y = terrainMeshY(cx, cz) + CITY.sidewalkLift;
  const stone = mattMat(TUNE.palette.white), water = new THREE.MeshLambertMaterial({ color: TUNE.palette.sea });
  const fg = new THREE.Group();
  fg.position.set(cx, y, cz);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(F.r, 0.5, 6, 28), stone);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.35; fg.add(rim);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(F.r, 28), water);
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.25; fg.add(pool);
  const tier = new THREE.Mesh(new THREE.CylinderGeometry(F.r * 0.28, F.r * 0.36, 1.6, 12), stone);
  tier.position.y = 0.8; fg.add(tier);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(F.r * 0.42, F.r * 0.2, 0.6, 12), stone);
  bowl.position.y = 2.1; fg.add(bowl);
  // the jet: a white column that the frame loop makes dance
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, F.jetH, 8),
    new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.75 }));
  jet.position.y = 2.4 + F.jetH / 2; fg.add(jet);
  castsShadow(fg, false);
  g.add(fg);
  city.square = { x: cx, z: cz, y, jet, t: 0, splashCool: 0, rect: P };
}

function stUpdateSquare(city, dt) {
  const S = city.square;
  if (!S) return;
  S.t += dt;
  const F = ST.fountain;
  S.jet.scale.y = 0.85 + 0.15 * Math.sin(S.t * 3.1);
  S.jet.position.y = 2.4 + F.jetH * S.jet.scale.y / 2;
  if (S.splashCool > 0) S.splashCool -= dt;
  // (no idle spray: the shared puffs read as grey boulders round the jet from
  // the driving seat, and the jet on its own says "fountain")
  const d = Math.hypot(state.x - S.x, state.z - S.z);
  // he drives through it: a splash, and that is all
  if (carActive() && !state.exploding && d < F.r + 2 && state.speed > 2 && S.splashCool <= 0) {
    S.splashCool = F.splashCool;
    splashAt(state.x, S.y, state.z, 1.4);
    if (typeof splash === "function") splash();
    flags.citySplashes = (flags.citySplashes || 0) + 1;
  }
}

// ---------------------------------------------------------------------------
// NEW YORK, cheaply: steam out of a few manholes, a hot-dog cart on a corner of
// the square, and a subway grate with its railings. One merged mesh for the
// solid bits; the steam is the shared puff pool, only while he is near.
// ---------------------------------------------------------------------------
function stBuildNY(city, g) {
  const D = city.data, P = D.plaza, C = TUNE.palette;
  city.steam = [];
  // manholes: in the middle of the streets either side of the square, and a few more
  const aw = D.avenueW / 2, sw = D.streetW / 2;
  const cands = city.roads.filter(r => r.kind === "grid" && r.len > 50);
  for (let i = 0; i < ST.ny.manholes; i++) {
    const r = cands[(i * 37 + 11) % cands.length];
    stPointAt(r, r.len * (0.35 + 0.3 * ((i * 7) % 5) / 4), 1, 0, stTmpA);
    city.steam.push({ x: stTmpA.x, z: stTmpA.z, y: terrainMeshY(stTmpA.x, stTmpA.z) + CITY.groundLift, t: i * 0.37 });
  }
  const boxes = [], dark = [];
  for (const m of city.steam) dark.push({ w: 1.6, h: 0.06, d: 1.6, x: m.x, y: m.y + 0.03, z: m.z });
  if (P) {
    // the cart, on the square's corner nearest the street he comes in on
    const x = P[2] - 4, z = P[1] + 3.5, y = terrainMeshY(x, z) + CITY.sidewalkLift;
    boxes.push({ w: 2.6, h: 1.1, d: 1.4, x, y: y + 0.95, z, c: "steel" });
    boxes.push({ w: 0.12, h: 2.4, d: 0.12, x, y: y + 2.2, z, c: "steel" });
    boxes.push({ w: 2.8, h: 0.25, d: 2.8, x, y: y + 3.4, z, c: "red" });             // the umbrella
    boxes.push({ w: 2.2, h: 0.2, d: 2.2, x, y: y + 3.6, z, c: "gold" });
    // the grate and the stair rail, on the pavement across the street from it
    const gx = P[0] + 14, gz = P[1] - sw * 2 - 2.5, gy = terrainMeshY(gx, gz) + CITY.sidewalkLift;
    for (let k = 0; k < 6; k++) dark.push({ w: 0.2, h: 0.05, d: 2.2, x: gx - 2.5 + k, y: gy + 0.03, z: gz });
    boxes.push({ w: 5.6, h: 0.9, d: 0.12, x: gx + 7, y: gy + 0.5, z: gz - 1.1, c: "green" });
    boxes.push({ w: 5.6, h: 0.9, d: 0.12, x: gx + 7, y: gy + 0.5, z: gz + 1.1, c: "green" });
    boxes.push({ w: 0.8, h: 0.8, d: 0.8, x: gx + 4.3, y: gy + 1.4, z: gz - 1.1, c: "green" });   // the globe
  }
  for (const c of ["steel", "red", "gold", "green"]) {
    const specs = boxes.filter(b => b.c === c);
    if (specs.length) g.add(new THREE.Mesh(mergeBoxes(specs), mattMat(C[c])));
  }
  if (dark.length) g.add(new THREE.Mesh(mergeBoxes(dark), mattMat(C.ink)));
  city.nyGrate = P ? { x: P[0] + 14, z: P[1] - sw * 2 - 2.5 } : null;
}

function stUpdateNY(city, dt) {
  if (!city.steam) return;
  for (const m of city.steam) {
    m.t -= dt;
    if (m.t > 0) continue;
    m.t = ST.ny.steamEvery;
    if (Math.hypot(state.x - m.x, state.z - m.z) > ST.ny.steamRange) continue;
    wakePuff(m.x + (Math.random() - 0.5), m.y + 0.4, m.z + (Math.random() - 0.5), 0xf2f4f7, 0.9, 2.2, 1.6);
  }
}

function stBuildParkedMesh(g) {
  const L = ART_LAYER, C = TUNE.palette, W = 0xffffff;
  const geo = hwyVehicleGeo([
    { w: 3.4, h: 1.05, d: 7.6, y: -0.55, c: W, l: L.deck },
    { w: 3.0, h: 0.85, d: 3.9, y: 0.4, z: 0.4, c: C.night, l: L.glass },
    { w: 2.9, h: 0.2, d: 3.5, y: 0.93, z: 0.45, c: W, l: L.deck },
  ]);
  const m = new THREE.InstancedMesh(geo, artPaint(new THREE.MeshPhongMaterial({ color: 0xffffff,
    vertexColors: true, shininess: 30, specular: 0x4a5058 }), "vehicle"), ST.parkedDrawn);
  m.frustumCulled = false; m.castShadow = true; m.userData.noSolid = true;
  m.setColorAt(0, new THREE.Color(W)); m.count = 0;
  g.add(m);
  stTraffic.parked = { mesh: m, t: 0, x: 1e9, z: 1e9 };
}

function stUpdateParked(city, dt) {
  const P = stTraffic.parked;
  if (!P) return;
  if (city && city.parked) for (const p of city.parked) if (p.gone > 0) p.gone -= dt;
  P.t -= dt;
  if (P.t > 0 && Math.hypot(state.x - P.x, state.z - P.z) < 40) return;
  P.t = 0.4; P.x = state.x; P.z = state.z;
  const m = P.mesh;
  m.count = 0;
  if (!city || !city.parked) return;
  const r2 = ST.parkedRange * ST.parkedRange, col = new THREE.Color();
  for (const p of city.parked) {
    if (m.count >= ST.parkedDrawn) break;
    if (p.gone > 0) continue;
    const dx = p.x - state.x, dz = p.z - state.z;
    if (dx * dx + dz * dz > r2) continue;
    stDummy.position.set(p.x, p.y, p.z);
    stDummy.rotation.set(0, Math.atan2(-p.hx, -p.hz), 0);
    stDummy.scale.setScalar(1); stDummy.updateMatrix();
    m.setMatrixAt(m.count, stDummy.matrix);
    m.setColorAt(m.count, col.setHex(HWY_CAR_TINTS[p.c]));
    m.count++;
  }
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

const stPedTmp = {};
function stUpdatePeople(city, dt) {
  const Pp = stTraffic.peds;
  if (!Pp) return;
  const m = Pp.mesh, R = ST.people;
  let n = 0;
  for (const p of Pp.list) {
    if (!city) { p.alive = false; continue; }
    if (!p.alive || p.city !== city.key || Math.hypot(p.x - state.x, p.z - state.z) > R.range * 1.2) {
      // a block near him, somewhere along its walk
      const blocks = city.data.blocks;
      let b = null;
      for (let t = 0; t < 8 && !b; t++) {
        const c = blocks[Math.floor(Math.random() * blocks.length)];
        const cx = (c[0] + c[2]) / 2, cz = (c[1] + c[3]) / 2;
        if (Math.hypot(cx - state.x, cz - state.z) < R.range) b = c;
      }
      if (!b) { p.alive = false; continue; }
      p.block = b; p.u = Math.random() * 400; p.speed = lerp(R.speed[0], R.speed[1], Math.random()) * (Math.random() < 0.5 ? 1 : -1);
      p.alive = true; p.city = city.key; p.back = 0; p.bob = Math.random() * 6;
    }
    p.u += p.speed * dt; p.bob += dt * 7;
    stPedPoint(city, p.block, p.u, p.back, stPedTmp);
    // he has mounted the pavement: the ones in his way step back to the wall
    const d = Math.hypot(stPedTmp.x - state.x, stPedTmp.z - state.z);
    const want = carActive() && d < R.dodge ? 1 : 0;
    p.back += clamp(want - p.back, -dt * 1.5, dt * 5);
    stPedPoint(city, p.block, p.u, p.back, stPedTmp);
    p.x = stPedTmp.x; p.z = stPedTmp.z;
    const hide = carActive() && Math.hypot(p.x - state.x, p.z - state.z) < R.hide;
    stDummy.position.set(p.x, terrainMeshY(p.x, p.z) + CITY.sidewalkLift + Math.abs(Math.sin(p.bob)) * 0.08, p.z);
    const s = Math.sign(p.speed) || 1;
    stDummy.rotation.set(0, Math.atan2(-stPedTmp.hx * s, -stPedTmp.hz * s), 0);
    stDummy.scale.setScalar(hide ? 0.001 : 1);
    stDummy.updateMatrix();
    m.setMatrixAt(n++, stDummy.matrix);
  }
  stDummy.position.set(0, -9999, 0); stDummy.scale.setScalar(0.001); stDummy.updateMatrix();
  for (let i = n; i < m.count; i++) m.setMatrixAt(i, stDummy.matrix);
  m.instanceMatrix.needsUpdate = true;
}
// ---------------------------------------------------------------------------
// BUILD, once, at load -- after the highway (the off-ramps leave it) and the
// cities' layout (citydata.js), before the car (which asks all of this).
// ---------------------------------------------------------------------------
function stBuild() {
  if (streets.built || typeof highway === "undefined" || !highway.built) return;
  const g = new THREE.Group();
  for (const key of ["ny", "ca"]) if (typeof CITY_DATA !== "undefined" && CITY_DATA[key]) stBuildGrid(key);
  stBuildLinks(g);
  for (const k in streets.cities) {
    const city = streets.cities[k];
    stBuildPolicy(city);
    stBuildPaint(city, g);
    stLayParking(city);
    stBuildSquare(city, g);
    if (k === "ny") stBuildNY(city, g);
  }
  stMergeStatic(g);                // the links' strips, rails, piers and the dressing: a call per material
  stBuildTrafficMeshes(g);
  stBuildParkedMesh(g);
  stBuildPeople(g);
  hwyIndexCorridor();             // the links claimed their ground as they were laid
  scene.add(g);
  streets.g = g;
  streets.built = true;
}

// Every plain, unmoved mesh directly in the group, merged per material: three.js
// batches nothing on its own, and the links alone were a dozen draw calls.
function stMergeStatic(g) {
  const byMat = new Map();
  for (const o of g.children.slice()) {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) continue;
    if (!o.position.equals(new THREE.Vector3()) || o.rotation.x || o.rotation.y || o.rotation.z) continue;
    const k = o.material.uuid;
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(o);
  }
  for (const list of byMat.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => o.geometry.index ? o.geometry.toNonIndexed() : o.geometry);
    const names = Object.keys(geos[0].attributes).filter(n => geos.every(q => q.attributes[n]));
    const out = new THREE.BufferGeometry();
    for (const n of names) {
      const size = geos[0].attributes[n].itemSize;
      const arr = new Float32Array(geos.reduce((a, q) => a + q.attributes[n].count * size, 0));
      let off = 0;
      for (const q of geos) { arr.set(q.attributes[n].array, off); off += q.attributes[n].array.length; }
      out.setAttribute(n, new THREE.BufferAttribute(arr, size));
    }
    if (!out.attributes.normal) out.computeVertexNormals();
    out.computeBoundingSphere();
    const m = new THREE.Mesh(out, list[0].material);
    m.receiveShadow = list.some(o => o.receiveShadow); m.castShadow = list.some(o => o.castShadow);
    for (const o of list) { g.remove(o); o.geometry.dispose(); }
    g.add(m);
  }
}

// Called from updateHighway, so it shows and sleeps with the road.
function stUpdate(dt) {
  if (!streets.built) return;
  streets.g.visible = highway.g.visible;
  if (!streets.g.visible) return;
  stRecordTrail();
  stUpdateReservations(dt);
  stUpdateTraffic(dt);
  const city = stCityNear(state.x, state.z, ST.wake);
  stUpdateParked(city, dt);
  stUpdatePeople(city, dt);
  if (city) { stUpdateSquare(city, dt); if (city.key === "ny") stUpdateNY(city, dt); }
}

// Built once, at load, after the highway it leaves from.
stBuild();
