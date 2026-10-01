"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE GIANT TOY TRACK (v130).
//
// An orange toy-car track at enormous scale in the desert between the canyon
// and the coast, off its own motorway exit (the board's icon is an orange
// loop). The car IS the toy: on the track it is rail-locked in a car-width
// walled channel. Orange track, blue connectors, no logos, no letters.
//
// THE RUN: launch tower and its steep drop -> banked turn -> a full loop ->
// FORK A (hands-off or held left: an easy S; held right: a double corkscrew)
// -> a booster -> FORK B (the safe span, or the gap jump under an amber ring)
// -> over the sofa -> the spiral climb round the lamp -> a second booster ->
// the triple loop -> the ski-jump into the giant padded net, which bounces him
// back to the top of the tower. Then again.
//
// THE RULES, which are the game's rules:
//   - FINGER DOWN = GO. Finger off = coast: gravity along the track has him,
//     and on a climb he rolls back to the bottom. Nothing is ever stuck.
//   - A FORK IS A TURN, and a turn is the city's rule (car.js): a FULL steer
//     (TUNE.car.fullSteer) HELD through the fork's approach. Anything less --
//     a wobble, a light touch, hands-off -- goes the safe way. Nothing latches.
//   - HE CANNOT FALL OFF, except in two places: short of the landing at the gap
//     jump, or out of a loop he came into too slowly (the track can push him
//     round a loop, never pull him). Then he peels off, tumbles, goes bang --
//     a machine, a toy car -- and comes back just before that section, free.
//     Falling out of the loop is the best part; it costs nothing.
//   - THE WAY OFF is an exit lane off the start deck, under a gantry with the
//     motorway's icon: a full steer held right through the deck takes it, like
//     every exit; hands-off stays on the track. It runs down beside the tower on
//     to a road that merges back into the motorway.
//   - Rear-ending another toy car on the course: both go bang, both come back.
//     They never run into him: they hold back behind him.
//   - The household props (the sofa, the bookshelf, the lamp) are scenery he
//     weaves through. They are never solid and never hit.
//
// THE TRACK IS DATA: TUNE.track.segments is a graph of segments, each a list of
// typed SECTIONS (straight, drop, hump, turn, loop, corkscrew, sbend, spiral,
// booster, kicker, landing, ski). Each section is generated in its own frame --
// forward +z, up +y, left +x, from the origin -- and laid end to end, so a
// section can be added, lengthened or moved without touching the others.
// Everything is resampled to a uniform `ds` and carries its frame (T, N) and
// its curvature toward N, which is what the loops' grip is measured with.
// ---------------------------------------------------------------------------

const TK = TUNE.track;
const trk = {
  built: false, g: null, segs: {}, order: [],
  on: false, seg: null, s: 0, v: 0, air: null, lift: null, bounce: null,
  forkHold: 0, forkHeld: 0, forkLift: 0, took: {}, cameFrom: {},
  bang: null, cars: [], rollers: [], net: null, ring: null, t: 0,
  up: new THREE.Vector3(0, 1, 0), camUp: new THREE.Vector3(0, 1, 0),
  runs: 0, rattle: 0,
};
const tkV1 = new THREE.Vector3(), tkV2 = new THREE.Vector3(), tkV3 = new THREE.Vector3();
const tkM = new THREE.Matrix4(), tkQ = new THREE.Quaternion();

// ---- section generators ---------------------------------------------------
// Each section is a curve f(t), t 0..1, in its own frame: from the origin,
// heading +z, +y up, +x LEFT. f returns the point and the meant up. It is a
// FUNCTION, not a list, so the end tangent is exact (an epsilon step): a chord
// between the last two samples is a couple of degrees off on a bend, and over a
// hundred metres that put the stunt branch four metres off the safe one's line.
const tkSm = t => t * t * (3 - 2 * t);
function tkSection(sec) {
  const f = (x, y, z, ux, uy, uz) => ({ p: [x, y, z], up: [ux, uy, uz] });
  let len, at, gap = false;
  switch (sec.type) {
    case "straight": case "booster": case "shelf": {
      const L = sec.len, c = sec.climb || 0; len = L;
      at = t => f(0, c * tkSm(t), L * t, 0, 1, 0);
      break;
    }
    case "drop": {                      // steep in the middle, level at both ends
      const L = sec.len, H = sec.height; len = L;
      at = t => f(0, -H * (1 - Math.cos(Math.PI * t)) / 2, L * t, 0, 1, 0);
      break;
    }
    case "hump": {
      const L = sec.len, H = sec.height; len = L;
      at = t => f(0, H * Math.pow(Math.sin(Math.PI * t), 2), L * t, 0, 1, 0);
      break;
    }
    case "turn": {                      // an arc, banked in toward its centre (+ angle = left)
      const a = sec.angle * Math.PI / 180, R = sec.radius, sg = Math.sign(a), A = Math.abs(a), bank = (sec.bank || 0) * Math.PI / 180;
      len = A * R;
      at = t => { const th = A * t, b = bank * Math.sin(Math.PI * t), cx = sg * Math.cos(th), cz = -Math.sin(th);
                  return f(sg * R * (1 - Math.cos(th)), 0, R * Math.sin(th), cx * Math.sin(b), Math.cos(b), cz * Math.sin(b)); };
      break;
    }
    case "loop": {                      // a full vertical loop, stepping `offset` sideways (+ left)
      const R = sec.radius, off = sec.offset; len = 2 * Math.PI * R;
      at = t => { const th = 2 * Math.PI * t; return f(off * tkSm(t), R - R * Math.cos(th), R * Math.sin(th), 0, Math.cos(th), -Math.sin(th)); };
      break;
    }
    case "corkscrew": {                 // rolls right over, `turns` times, round an axis ahead
      const L = sec.len, T = sec.turns, rc = sec.radius; len = L * 1.3;
      at = u => { const th = 2 * Math.PI * T * u, r = rc * Math.pow(Math.sin(Math.PI * u), 2);
                  return f(-r * Math.sin(th), r * (1 - Math.cos(th)), L * u, Math.sin(th), Math.cos(th), 0); };
      break;
    }
    case "sbend": {                     // step `shift` sideways (+ left) over `len`
      const L = sec.len, W = sec.shift; len = L;
      at = t => f(W * tkSm(t), 0, L * t, 0, 1, 0);
      break;
    }
    case "spiral": {                    // a helix round a vertical axis beside him (dir + = left), climbing
      const T = sec.turns, R = sec.radius, H = sec.rise, sg = sec.dir || 1, A = 2 * Math.PI * T, bank = (sec.bank || 0) * Math.PI / 180;
      len = A * R;
      at = t => { const th = A * t, b = bank * Math.min(1, Math.sin(Math.PI * t) * 3), cx = sg * Math.cos(th), cz = -Math.sin(th);
                  return f(sg * R * (1 - Math.cos(th)), H * tkSm(t), R * Math.sin(th), cx * Math.sin(b), Math.cos(b), cz * Math.sin(b)); };
      break;
    }
    case "kicker": case "ski": {         // level into a lip at `lipSlope`
      const L = sec.len, H = sec.rise, k = Math.max(1, sec.lipSlope * L / H); len = L;
      at = t => f(0, H * Math.pow(t, k), L * t, 0, 1, 0);
      break;
    }
    case "landing": {                   // a long ramp falling away, steepest first, level at its end
      const L = sec.len, D = sec.fall; len = L;
      at = t => f(0, -D * (2 * t - t * t), L * t, 0, 1, 0);
      break;
    }
    case "gap": {                       // nothing: he flies it
      const L = sec.len, dy = sec.dy || 0; len = L; gap = true;
      at = t => f(0, dy * t, L * t, 0, 1, 0);
      break;
    }
  }
  const N = gap ? 1 : Math.max(4, Math.ceil(len));
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(at(i / N));
  const e0 = at(1 - 1e-5).p, e1 = at(1).p;
  pts.endT = [e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]];
  pts.gap = gap;
  return pts;
}

// ---- a segment: sections laid end to end from a start frame ---------------
// frame: { p: Vector3, f: forward (unit), u: up (unit) }. Returns uniform
// samples every TK.ds with position, T, N and the curvature toward N, plus the
// frame it ends in. A "gap" section splits it: `pieces` are the runs of track.
function tkLay(frame, sections, id) {
  const raw = [];                        // world points with the section they came from
  let P = frame.p.clone(), F = frame.f.clone(), U = frame.u.clone();
  const gaps = [];
  sections.forEach((sec, si) => {
    const pts = tkSection(sec);
    const Lf = new THREE.Vector3().crossVectors(U, F).normalize();       // left
    const W = (a) => new THREE.Vector3().copy(P).addScaledVector(Lf, a[0]).addScaledVector(U, a[1]).addScaledVector(F, a[2]);
    const Wv = (a) => new THREE.Vector3().addScaledVector(Lf, a[0]).addScaledVector(U, a[1]).addScaledVector(F, a[2]).normalize();
    const world = pts.map(q => ({ p: W(q.p), up: Wv(q.up), sec: si, type: sec.type }));
    if (pts.gap) gaps.push(raw.length);  // the index where the void begins
    for (let i = raw.length ? 1 : 0; i < world.length; i++) raw.push(world[i]);
    // the end frame: the exact tangent, from the section's own curve
    P = world[world.length - 1].p.clone();
    F = Wv(pts.endT);
    if (sec.type === "kicker" || pts.gap) {
      // a lip ends tilted up, and the void after it is laid LEVEL from the lip:
      // forward is the lip's heading on the flat, up is up -- or the landing
      // would be laid in a frame tipped by the kick, and the stunt branch would
      // not come back to where the safe one does
      F.y = 0; F.normalize(); U.set(0, 1, 0);
    } else {
      U = world[world.length - 1].up.clone();
      U.addScaledVector(F, -U.dot(F)).normalize();
    }
  });
  // split at gaps into pieces, then resample each piece
  const pieces = [];
  let from = 0;
  for (const gi of gaps) { pieces.push(raw.slice(from, gi)); from = gi; }
  pieces.push(raw.slice(from));
  const out = pieces.map((pc, k) => tkResample(pc, id + (pieces.length > 1 ? ":" + k : "")));
  return { pieces: out, end: { p: P, f: F, u: U } };
}

function tkResample(pts, id) {
  // cumulative length
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].p.distanceTo(pts[i - 1].p));
  const len = cum[cum.length - 1], ds = TK.ds, n = Math.max(2, Math.round(len / ds) + 1);
  const S = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = len * k / (n - 1);
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const t = clamp((s - cum[j]) / ((cum[j + 1] - cum[j]) || 1), 0, 1);
    const p = pts[j].p.clone().lerp(pts[j + 1].p, t), up = pts[j].up.clone().lerp(pts[j + 1].up, t);
    S.push({ x: p.x, y: p.y, z: p.z, ux: up.x, uy: up.y, uz: up.z, s, type: pts[t < 0.5 ? j : j + 1].type, sec: pts[t < 0.5 ? j : j + 1].sec });
  }
  // tangents, orthonormal up (N), left (B), curvature toward N
  for (let k = 0; k < n; k++) {
    const a = S[Math.max(0, k - 1)], b = S[Math.min(n - 1, k + 1)];
    let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const q = S[k];
    let nx = q.ux, ny = q.uy, nz = q.uz; const d = nx * tx + ny * ty + nz * tz;
    nx -= tx * d; ny -= ty * d; nz -= tz * d; const nl = Math.hypot(nx, ny, nz) || 1;
    q.tx = tx; q.ty = ty; q.tz = tz; q.nx = nx / nl; q.ny = ny / nl; q.nz = nz / nl;
  }
  for (let k = 0; k < n; k++) {
    const a = S[Math.max(0, k - 1)], b = S[Math.min(n - 1, k + 1)], q = S[k];
    const dsn = (b.s - a.s) || 1;
    const kx = (b.tx - a.tx) / dsn, ky = (b.ty - a.ty) / dsn, kz = (b.tz - a.tz) / dsn;
    q.kn = kx * q.nx + ky * q.ny + kz * q.nz;                 // curvature toward N (+ = curling toward his head)
  }
  return { id, S, len };
}

// Where he is on a segment: position, T, N, curvature, interpolated.
const tkAtOut = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, nx: 0, ny: 1, nz: 0, kn: 0, type: "", sec: 0 };
function tkAt(seg, s) {
  const S = seg.S, n = S.length, f = clamp(s / seg.len, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f)), t = f - i, a = S[i], b = S[i + 1], o = tkAtOut;
  o.x = a.x + (b.x - a.x) * t; o.y = a.y + (b.y - a.y) * t; o.z = a.z + (b.z - a.z) * t;
  o.tx = a.tx + (b.tx - a.tx) * t; o.ty = a.ty + (b.ty - a.ty) * t; o.tz = a.tz + (b.tz - a.tz) * t;
  o.nx = a.nx + (b.nx - a.nx) * t; o.ny = a.ny + (b.ny - a.ny) * t; o.nz = a.nz + (b.nz - a.nz) * t;
  const tl = Math.hypot(o.tx, o.ty, o.tz) || 1, nl = Math.hypot(o.nx, o.ny, o.nz) || 1;
  o.tx /= tl; o.ty /= tl; o.tz /= tl; o.nx /= nl; o.ny /= nl; o.nz /= nl;
  o.kn = a.kn + (b.kn - a.kn) * t; o.type = t < 0.5 ? a.type : b.type; o.sec = t < 0.5 ? a.sec : b.sec;
  return o;
}

// ---- the graph --------------------------------------------------------------
// TK.segments: [{ id, from: "tower" | "<seg>" | {merge: [...]}, sections, fork?: {...} }]
// Built in order; a segment starts where its `from` ends (a fork's branches both
// start where the fork's stem ends, and the segment after a fork starts where
// its SAFE branch ends -- the stunt is laid to end in the same place).
function tkBuild() {
  if (trk.built) return;
  const site = TK.site, g0 = Math.max(terrainEff(site.x, site.z), TUNE.waterLevel);
  const h = site.heading * Math.PI / 180;
  const start = { p: new THREE.Vector3(site.x, g0 + TK.towerH, site.z), f: new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h)), u: new THREE.Vector3(0, 1, 0) };
  trk.g0 = g0;
  const ends = { tower: start };
  for (const def of TK.segments) {
    const from = ends[def.from];
    const laid = tkLay(from, def.sections, def.id);
    laid.pieces.forEach((pc, k) => {
      pc.def = def; pc.piece = k; pc.pieces = laid.pieces.length;
      trk.segs[pc.id] = pc; trk.order.push(pc);
    });
    // the pieces of one segment chain into each other (across a gap, by flight)
    for (let k = 0; k < laid.pieces.length - 1; k++) { laid.pieces[k].next = laid.pieces[k + 1].id; laid.pieces[k].gapTo = laid.pieces[k + 1].id; laid.pieces[k + 1].prev = laid.pieces[k].id; }
    ends[def.id] = laid.end;
    const first = laid.pieces[0], last = laid.pieces[laid.pieces.length - 1];
    first.fromId = def.from; last.endOf = def.id;
  }
  // wire the graph: a segment's `next` is whatever starts from it; names in
  // the table are segments, and a segment split by a gap is several pieces
  const firstOf = id => trk.order.find(p => p.def.id === id && p.piece === 0).id;
  for (const def of TK.segments) {
    const last = trk.order.filter(p => p.def === def).pop();
    const kids = TK.segments.filter(d => d.from === def.id);
    if (def.fork) {
      last.fork = { safe: firstOf(def.fork.safe), stunt: firstOf(def.fork.stunt), approach: def.fork.approach };
    } else if (def.merge) {      // a branch ends on the stem after the fork
      last.next = firstOf(def.merge);
    } else if (kids.length === 1) {
      last.next = firstOf(kids[0].id);
    }
  }
  for (const pc of trk.order) {
    if (pc.next && trk.segs[pc.next] && !trk.segs[pc.next].prev) trk.segs[pc.next].prev = pc.id;
  }
  // it claims its ground, the way every road does (highway.js): nothing streamed
  // -- a town, a tree -- stands in the tangle
  const claim = [];
  for (const pc of trk.order) for (let k = 0; k < pc.S.length; k += 16) claim.push(pc.S[k]);
  hwyClaimCorridor(claim);
  tkBuildMeshes();
  if (trk.net) hwyClaimCorridor([{ x: trk.net.near[0], z: trk.net.near[2] }, { x: trk.net.far[0], z: trk.net.far[2] }]);
  hwyIndexCorridor();
  trk.built = true;
  flags.trackBuilt = (flags.trackBuilt || 0) + 1;
}

// The first segment and the lip at the end of the run.
function tkFirst() { return trk.order[0]; }

// ---- the look -----------------------------------------------------------------
// One orange channel swept along every segment (one draw call), blue connector
// clips every few metres and blue legs down to the sand (instanced), the tower,
// the booster rollers, the ring over the gap, the net, and the props.
function tkFrameAt(q) {
  // left = N x T
  const lx = q.ny * q.tz - q.nz * q.ty, ly = q.nz * q.tx - q.nx * q.tz, lz = q.nx * q.ty - q.ny * q.tx;
  return [lx, ly, lz];
}
function tkBuildMeshes() {
  const C = TUNE.palette, W = TK.width / 2, WH = TK.wallH, T = TK.deckT, wt = TK.wallT;
  const g = new THREE.Group();
  // the channel's cross-section, (left, up), a closed U
  const prof = [[-W - wt, -T], [-W - wt, WH], [-W, WH], [-W, 0], [W, 0], [W, WH], [W + wt, WH], [W + wt, -T]];
  const pos = [], idx = [];
  for (const seg of trk.order) {
    const S = seg.S, step = 2, rings = [];
    for (let k = 0; k < S.length; k += step) rings.push(S[k]);
    if (rings[rings.length - 1] !== S[S.length - 1]) rings.push(S[S.length - 1]);
    const base = pos.length / 3;
    for (const q of rings) {
      const L = tkFrameAt(q);
      for (const [a, b] of prof) pos.push(q.x - L[0] * a + q.nx * b, q.y - L[1] * a + q.ny * b, q.z - L[2] * a + q.nz * b);
    }
    const np = prof.length;
    for (let r = 0; r < rings.length - 1; r++) {
      for (let e = 0; e < np; e++) {
        const a = base + r * np + e, b = base + r * np + (e + 1) % np, c = a + np, d = b + np;
        idx.push(a, c, b, b, c, d);
      }
    }
    // end caps
    for (const r of [0, rings.length - 1]) {
      const o = base + r * np;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3, o, o + 3, o + 7, o + 3, o + 4, o + 7, o + 4, o + 6, o + 7, o + 4, o + 5, o + 6);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const orange = new THREE.MeshLambertMaterial({ color: C.fire, side: THREE.DoubleSide });
  const channel = new THREE.Mesh(geo, orange);
  channel.castShadow = true; channel.receiveShadow = true;
  g.add(channel);
  trk.channel = channel;

  // connector clips and legs
  const blue = new THREE.MeshLambertMaterial({ color: C.blue });
  const clips = [], legs = [];
  for (const seg of trk.order) {
    const every = Math.round(TK.clipEvery / TK.ds);
    for (let k = every; k < seg.S.length - 1; k += every) clips.push(seg.S[k]);
    const legEvery = Math.round(TK.legEvery / TK.ds);
    for (let k = Math.round(legEvery / 2); k < seg.S.length; k += legEvery) {
      const q = seg.S[k];
      if (q.ny < 0.6) continue;                       // not under a loop's roof or a corkscrew
      const gy = Math.max(terrainEff(q.x, q.z), TUNE.waterLevel);
      if (q.y - T - gy < 1.2) continue;
      if (tkUnderTrack(q, seg)) continue;              // a leg would stand on track below it
      legs.push({ x: q.x, z: q.z, y0: gy - 0.5, y1: q.y - T });
    }
  }
  const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blue, clips.length);
  clips.forEach((q, i) => {
    const L = tkFrameAt(q);
    tkM.makeBasis(tkV1.set(L[0], L[1], L[2]), tkV2.set(q.nx, q.ny, q.nz), tkV3.set(q.tx, q.ty, q.tz));
    tkM.scale(tkV1.set(TK.width + 2 * wt + 0.3, WH + T + 0.2, 0.9));
    tkM.setPosition(q.x + q.nx * (WH - T) / 2, q.y + q.ny * (WH - T) / 2, q.z + q.nz * (WH - T) / 2);
    cm.setMatrixAt(i, tkM);
  });
  cm.castShadow = true;
  g.add(cm);
  const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.1, 1, 8), blue, Math.max(1, legs.length));
  legs.forEach((l, i) => {
    tkM.makeScale(1, l.y1 - l.y0, 1); tkM.setPosition(l.x, (l.y0 + l.y1) / 2, l.z);
    lm.setMatrixAt(i, tkM);
  });
  lm.count = legs.length;
  lm.castShadow = true;
  g.add(lm);
  trk.legs = legs;

  tkBuildTower(g, orange, blue);
  tkBuildRollers(g);
  tkBuildRing(g);
  tkBuildGantry(g);
  tkBuildNet(g, blue);
  tkBuildProps(g);
  tkBuildCars(g);
  castsShadow(g);
  scene.add(g);
  trk.g = g;
}

// Is there another piece of track under this point? (so a leg never stands on
// the track below it -- the spiral stacks on itself)
function tkUnderTrack(q, self) {
  for (const seg of trk.order) {
    const S = seg.S;
    for (let k = 0; k < S.length; k += 4) {
      const p = S[k];
      if (seg === self && Math.abs(p.s - q.s) < 12) continue;
      if (Math.abs(p.x - q.x) < TK.width && Math.abs(p.z - q.z) < TK.width && p.y < q.y - 2) return true;
    }
  }
  return false;
}

// The launch tower: a blue lattice with orange bands, the start deck on top and
// the lift up its back.
function tkBuildTower(g, orange, blue) {
  const s0 = tkFirst().S[0], L = tkFrameAt(s0), H = s0.y - trk.g0, specs = [];
  const tg = new THREE.Group();
  tg.position.set(s0.x, trk.g0, s0.z);
  tg.rotation.y = Math.atan2(s0.tx, s0.tz);
  const leg = (x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, H, 2.2), blue); m.position.set(x, H / 2, z); tg.add(m); };
  const w = TK.width / 2 + 3;
  for (const x of [-w, w]) for (const z of [-2, -18]) leg(x, z);
  for (let y = 6; y < H; y += 7) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 2.2, 1.2, 18), orange);
    band.position.set(0, y, -10); tg.add(band);
  }
  // the start deck behind the drop's top: he waits here, and comes back here
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 3, 1.2, 22), orange);
  deck.position.set(0, H - 0.6 - TK.deckT, -10); tg.add(deck);
  // the lift cage up its back
  const cage = new THREE.Mesh(new THREE.BoxGeometry(TK.width + 3, 1, 12), blue);
  cage.position.set(0, 1, -26); tg.add(cage);
  trk.liftCage = cage;
  for (const x of [-TK.width / 2 - 2, TK.width / 2 + 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, H + 4, 1.2), blue); m.position.set(x, (H + 4) / 2, -32); tg.add(m); }
  g.add(tg);
  trk.tower = tg;
  // it is solid (solids.js): a pillar you can fly into
  const c = [s0.x - s0.tx * 10, trk.g0 + H / 2, s0.z - s0.tz * 10];
  solidBox3(c[0], c[1], c[2], [Math.cos(tg.rotation.y), 0, -Math.sin(tg.rotation.y)], [0, 1, 0], [Math.sin(tg.rotation.y), 0, Math.cos(tg.rotation.y)],
            w + 1, H / 2, 12, "pillar");
}

// The booster rollers: yellow drums across the deck that spin while he is near.
function tkBuildRollers(g) {
  const list = [];
  for (const seg of trk.order) for (let k = 0; k < seg.S.length; k += Math.round(2.2 / TK.ds)) if (seg.S[k].type === "booster") list.push(seg.S[k]);
  const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.45, TK.width - 0.4, 10), new THREE.MeshLambertMaterial({ color: TUNE.palette.warning }), Math.max(1, list.length));
  m.count = list.length;
  trk.rollers = list; trk.rollerMesh = m; trk.rollerSpin = 0;
  tkPoseRollers();
  g.add(m);
}
function tkPoseRollers() {
  const m = trk.rollerMesh;
  trk.rollers.forEach((q, i) => {
    const L = tkFrameAt(q);
    tkM.makeBasis(tkV1.set(q.nx, q.ny, q.nz), tkV2.set(L[0], L[1], L[2]), tkV3.set(q.tx, q.ty, q.tz));   // the drum's axis across the deck
    tkQ.setFromAxisAngle(tkV1.set(0, 1, 0), trk.rollerSpin);
    tkM.multiply(new THREE.Matrix4().makeRotationFromQuaternion(tkQ));
    tkM.setPosition(q.x + q.nx * 0.2, q.y + q.ny * 0.2, q.z + q.nz * 0.2);
    m.setMatrixAt(i, tkM);
  });
  m.instanceMatrix.needsUpdate = true;
}

// An amber ring standing over the middle of the gap, facing along it.
function tkBuildRing(g) {
  const a = trk.order.find(p => p.gapTo), b = a && trk.segs[a.gapTo];
  if (!a) return;
  const p = a.S[a.S.length - 1], q = b.S[0];
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TK.ringR, 0.7, 10, 30), new THREE.MeshBasicMaterial({ color: 0xffb43a, fog: false }));
  ring.position.set((p.x + q.x) / 2, Math.max(p.y, q.y) + TK.ringR * 0.9, (p.z + q.z) / 2);
  ring.rotation.y = Math.atan2(p.tx, p.tz);
  g.add(ring);
  trk.ring = ring;
}

// The net at the end of the ski-jump: a padded catch net from just below the
// lip, a long way out and up at the far end, on blue posts. Wherever he comes
// off the lip, he lands in it.
function tkBuildNet(g, blue) {
  const end = trk.order[trk.order.length - 1], lip = end.S[end.S.length - 1];
  const fx = lip.tx, fz = lip.tz, fl = Math.hypot(fx, fz) || 1, F = [fx / fl, 0, fz / fl], Lf = [F[2], 0, -F[0]];
  const N = TK.net, gy = Math.max(terrainEff(lip.x + F[0] * N.len * 0.5, lip.z + F[2] * N.len * 0.5), TUNE.waterLevel);
  // near edge a little under the lip, far edge raised: a scoop
  const near = [lip.x + F[0] * N.start, Math.max(gy + 2, lip.y - N.drop), lip.z + F[2] * N.start];
  const far = [lip.x + F[0] * (N.start + N.len), gy + N.farH, lip.z + F[2] * (N.start + N.len)];
  const net = { F, L: Lf, near, far, w: N.w, len: N.len, sag: 0, sagV: 0 };
  // a gridded sheet
  const geo = new THREE.PlaneGeometry(N.w, N.len, 12, 16);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const u = pa.getX(i) / N.w, v = pa.getY(i) / N.len + 0.5;     // across, along 0..1
    const y = near[1] + (far[1] - near[1]) * Math.pow(v, 1.6);
    pa.setXYZ(i, near[0] + F[0] * N.len * v + Lf[0] * u * N.w, y, near[2] + F[2] * N.len * v + Lf[2] * u * N.w);
  }
  geo.computeVertexNormals();
  net.rest = Float32Array.from(pa.array);
  const sheet = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  const grid = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: TUNE.palette.fire }));
  g.add(sheet); g.add(grid);
  net.sheet = sheet; net.grid = grid;
  // posts
  for (const v of [0, 1]) for (const u of [-0.5, 0.5]) {
    const x = near[0] + F[0] * N.len * v + Lf[0] * u * N.w, z = near[2] + F[2] * N.len * v + Lf[2] * u * N.w;
    const yTop = v ? far[1] : near[1], yb = Math.max(terrainEff(x, z), TUNE.waterLevel);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, yTop - yb + 2, 8), blue);
    post.position.set(x, (yTop + yb + 2) / 2, z); g.add(post);
  }
  trk.net = net;
}
// The net's height at a point, or null off it.
function tkNetY(x, z) {
  const n = trk.net; if (!n) return null;
  const dx = x - n.near[0], dz = z - n.near[2];
  const v = (dx * n.F[0] + dz * n.F[2]) / n.len, u = (dx * n.L[0] + dz * n.L[2]) / n.w;
  if (v < -0.05 || v > 1.05 || Math.abs(u) > 0.55) return null;
  return n.near[1] + (n.far[1] - n.near[1]) * Math.pow(clamp(v, 0, 1), 1.6);
}

// ---- the household props he weaves through: never solid, never hit ------------
function tkFindType(type) {
  for (const seg of trk.order) {
    if (seg.def.leave) continue;            // the exit lane's spiral down is not the lamp's
    const ks = seg.S.filter(q => q.type === type);
    if (ks.length) return { seg, a: ks[0], b: ks[ks.length - 1], mid: ks[Math.floor(ks.length / 2)], all: ks };
  }
  return null;
}
function tkBuildProps(g) {
  const C = TUNE.palette, P = TK.props;
  const box = (grp, w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); grp.add(m); return m; };
  const standAt = (grp, q) => {
    grp.position.set(q.x, Math.max(terrainEff(q.x, q.z), TUNE.waterLevel), q.z);
    grp.rotation.y = Math.atan2(q.tx, q.tz);
    g.add(grp);
  };
  trk.props = [];
  // THE SOFA: the hump is its seat; a giant red sofa across the track
  const hump = tkFindType("hump");
  if (hump) {
    const s = new THREE.Group(), S = P.sofa;
    box(s, S.w, S.seat, S.d, C.red, 0, S.seat / 2, 0);                                   // the base
    for (const x of [-S.w / 3, 0, S.w / 3]) box(s, S.w / 3 - 1, 2.4, S.d - 2, 0xf06a5e, x, S.seat + 1.2, 1);   // cushions
    box(s, S.w, S.back, 5, C.red, 0, S.back / 2, -S.d / 2 + 2.5);                       // the back
    for (const x of [-S.w / 2 - 3, S.w / 2 + 3]) box(s, 6, S.arm, S.d, C.red, x, S.arm / 2, 0);   // arms
    standAt(s, hump.mid);
    trk.props.push({ kind: "sofa", g: s });
  }
  // THE BOOKSHELF: an arch of shelves the track runs through
  const shelfAt = tkFindType("shelf");
  if (shelfAt) {
    const b = new THREE.Group(), B = P.shelf, q = shelfAt.mid;
    const gy = Math.max(terrainEff(q.x, q.z), TUNE.waterLevel), hole = q.y - gy + TK.wallH + B.clear;
    const side = (B.w - TK.width - 2 * B.gap) / 2;
    const wood = C.gold;
    for (const sx of [-1, 1]) {
      const cx = sx * (TK.width / 2 + B.gap + side / 2);
      box(b, side, B.h, B.d, wood, cx, B.h / 2, 0);
      for (let y = 4; y < B.h - 2; y += 6) {                                              // the books
        for (let k = 0; k < 6; k++) {
          const bw = side / 7, col = [C.red, C.blue, C.green, C.warning, C.cyan, C.fire][(k + Math.round(y)) % 6];
          box(b, bw * 0.8, 4.4, B.d * 0.2, col, cx - side / 2 + bw * (k + 0.9), y + 2.2, B.d / 2 + 0.1);
        }
      }
    }
    box(b, B.w, B.h - hole, B.d, wood, 0, hole + (B.h - hole) / 2, 0);                  // over the hole
    standAt(b, q);
    trk.props.push({ kind: "shelf", g: b });
  }
  // THE LAMP: the spiral climbs round its stem, the shade high over the top
  const sp = tkFindType("spiral");
  if (sp) {
    // the spiral's axis: the centre of its samples
    let cx = 0, cz = 0; for (const q of sp.all) { cx += q.x; cz += q.z; } cx /= sp.all.length; cz /= sp.all.length;
    const top = Math.max(...sp.all.map(q => q.y)), gy = Math.max(terrainEff(cx, cz), TUNE.waterLevel), L = P.lamp;
    const l = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(L.stemR, L.stemR, top - gy + L.over, 12), new THREE.MeshLambertMaterial({ color: C.white }));
    stem.position.y = (top - gy + L.over) / 2; l.add(stem);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(L.footR, L.footR * 1.1, 2, 20), new THREE.MeshLambertMaterial({ color: C.slate }));
    foot.position.y = 1; l.add(foot);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(L.shadeR * 0.55, L.shadeR, L.shadeH, 20, 1, true), new THREE.MeshLambertMaterial({ color: C.warning, side: THREE.DoubleSide }));
    shade.position.y = top - gy + L.over; l.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
    bulb.position.y = top - gy + L.over - 2; l.add(bulb);
    l.position.set(cx, gy, cz);
    g.add(l);
    trk.props.push({ kind: "lamp", g: l });
  }
  for (const pr of trk.props) pr.g.traverse(o => { o.userData.noSolid = true; o.userData.noShatter = true; });
}

// ---- the other toy cars on the course ------------------------------------------
// Bright toy cars running the course at a toy's pace, always the safe way.
// They never run into him: one closing on him from behind waits. He can run
// into one: both go bang and both come back.
function tkToyCarMesh(color) {
  const g = new THREE.Group(), C = TUNE.palette;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6.6), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.3; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 3.0), new THREE.MeshLambertMaterial({ color: C.white }));
  cab.position.set(0, 2.6, 0.4); g.add(cab);
  for (const [x, z] of [[-1.7, 2.2], [1.7, 2.2], [-1.7, -2.2], [1.7, -2.2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 10), new THREE.MeshLambertMaterial({ color: C.ink }));
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.8, z); g.add(w);
  }
  return g;
}
function tkBuildCars(g) {
  const cols = [TUNE.palette.cyan, TUNE.palette.green, TUNE.palette.warning, TUNE.palette.red];
  trk.cars = [];
  for (let i = 0; i < TK.cars.count; i++) {
    const mesh = tkToyCarMesh(cols[i % cols.length]);
    g.add(mesh);
    trk.cars.push({ mesh, seg: tkFirst().id, s: 40 + i * TK.cars.spacing, v: TK.cars.speed, gone: 0, spin: 0 });
  }
}

// ---- walking the graph -----------------------------------------------------------
// Move (seg, s) by ds along the track, taking `pick(fork)` at a fork. Returns
// { seg, s, off } where `off` is "gap" (flew off a lip), "end" (off the ski
// lip) or null.
function tkStep(segId, s, ds, pick) {
  let seg = trk.segs[segId];
  s += ds;
  for (let guard = 0; guard < 8; guard++) {
    if (s > seg.len) {
      if (seg.gapTo) return { seg: seg.id, s: seg.len, off: "gap" };
      let nx = seg.next;
      if (seg.fork) nx = pick ? pick(seg) : seg.fork.safe;
      if (!nx) return { seg: seg.id, s: seg.len, off: seg.def.leave ? "leave" : "end" };
      s -= seg.len;
      trk.cameFrom[nx] = seg.id;
      seg = trk.segs[nx];
    } else if (s < 0) {
      // backward: a branch goes back to its stem, a stem after a merge to the
      // branch he came along; the tower deck and a landing's back end stop him
      const back = trk.cameFrom[seg.id] || seg.prev;
      if (!back || seg.fromGap || (seg.piece > 0)) return { seg: seg.id, s: 0, off: "stop" };
      seg = trk.segs[back];
      s += seg.len;
    } else break;
  }
  return { seg: seg.id, s, off: null };
}

// The steer, measured exactly as the car measures it (car.js): his drag against
// the car's own range, full at TUNE.car.fullSteer.
function tkBank() {
  if (!state.touching || menuOpen()) return 0;
  const range = (TUNE.dragRangeX * Math.min(window.innerWidth, window.innerHeight)) / (CAR.dragRangeX * window.innerWidth);
  return clamp(state.ctrlBank * range, -1, 1);
}

// Where he comes back after a bang in `seg` at `s`: the start of the drop or
// booster that feeds the section he fell out of, so he has the speed to go
// again -- from a standing start before a loop he would only fall out again.
function tkRetryFor(segId, s) {
  let id = segId, at = s;
  for (let hop = 0; hop < 6; hop++) {
    const seg = trk.segs[id];
    for (let k = Math.min(seg.S.length - 1, Math.floor(at / TK.ds)); k >= 0; k--) {
      const t = seg.S[k].type;
      if (t === "drop" || t === "booster") {
        // the start of that section
        let j = k; while (j > 0 && seg.S[j - 1].type === t && seg.S[j - 1].sec === seg.S[k].sec) j--;
        return { seg: id, s: Math.max(0, seg.S[j].s - 2) };
      }
    }
    const back = trk.cameFrom[id] || seg.prev;
    if (!back) break;
    id = back; at = trk.segs[id].len;
  }
  return { seg: tkFirst().id, s: 0 };
}

// ---- getting on and off: the lift up the back of the tower ------------------------
function tkLiftPad() { const t = trk.tower; return t ? { x: t.position.x - Math.sin(t.rotation.y) * 26, z: t.position.z - Math.cos(t.rotation.y) * 26 } : null; }
function trackCanBoard() {
  if (!trk.built || trk.on || !state.vp || !state.vp.car || state.exploding) return false;
  const p = tkLiftPad();
  return !!p && Math.hypot(state.x - p.x, state.z - p.z) < TK.liftR;
}
function trackBoard() {
  if (!trackCanBoard()) return false;
  trk.on = true; trk.lift = { dir: 1, t: 0 }; trk.air = null; trk.bang = null; trk.bounce = null;
  trk.seg = tkFirst().id; trk.s = 0; trk.v = 0; trk.forkHeld = 0; trk.forkLift = 0; trk.took = {};
  car.steer = 0; car.boost = 0; state.speed = 0;
  chirp();
  flags.trackBoards = (flags.trackBoards || 0) + 1;
  return true;
}
// Off the end of the exit lane and on to the road back, rolling: the car is
// his again, on a way on that merges into the carriageway that brought him.
function trackLeave() {
  const rec = trk.back, v = Math.max(8, Math.abs(trk.v));
  trk.on = false; trk.lift = null; trk.air = null; trk.bang = null; trk.bounce = null;
  setTone("trkRattle", "sawtooth", 50, 0); setTone("trkWhir", "square", 200, 0);
  if (vehicleModel) vehicleModel.visible = state.viewChase;
  camera.up.set(0, 1, 0);
  if (rec) {
    const sp = rec.spur, e = sp[sp.length - 1], b = sp[sp.length - 2];
    state.x = e.x; state.z = e.z; state.y = e.y;
    state.heading = Math.atan2(-(b.x - e.x), -(b.z - e.z));
    car.spurRec = rec; car.onSpurRoad = true;
  }
  state.speed = v; state.pitch = 0; state.bank = 0;
  if (typeof stPlan !== "undefined") { stPlan.road = null; stPlan.turn = null; }
  car.exitChoice = null; car.spent = 0; car.steer = 0;
  flags.trackLeaves = (flags.trackLeaves || 0) + 1;
}

// ---- THE FRAME ------------------------------------------------------------------------
const tkPose = { x: 0, y: 0, z: 0, T: new THREE.Vector3(0, 0, -1), N: new THREE.Vector3(0, 1, 0), spin: 0 };
function trackUpdate(dt) {
  trk.t += dt;
  const P = TK.physics, touching = state.touching && !menuOpen(), bank = tkBank();
  state.phase = "TAXI";
  tkTrackHold(dt, touching, bank);
  tkUpdateCars(dt);
  tkUpdateNet(dt);

  // ---- the lift: up the back of the tower on to the start deck, or down
  if (trk.lift) {
    const L = trk.lift, H = tkFirst().S[0].y - trk.g0, pad = tkLiftPad(), s0 = tkFirst().S[0];
    L.t += dt / TK.liftTime;
    const t = clamp(L.t, 0, 1), up = t;
    tkPose.x = lerp(pad.x, s0.x - s0.tx * 6, clamp(up * 1.25 - 0.25, 0, 1)); tkPose.z = lerp(pad.z, s0.z - s0.tz * 6, clamp(up * 1.25 - 0.25, 0, 1));
    tkPose.y = trk.g0 + H * tkSm(clamp(up * 1.2, 0, 1));
    tkPose.T.set(s0.tx, 0, s0.tz).normalize(); tkPose.N.set(0, 1, 0);
    if (trk.liftCage) trk.liftCage.position.y = 1 + (tkPose.y - trk.g0);
    tkSync(0);
    setTone("trkRattle", "sawtooth", 50, 0.02);
    if (L.t >= 1) { trk.lift = null; trk.seg = tkFirst().id; trk.s = 0; trk.v = 0; }
    return;
  }
  // ---- in pieces: back just before the section, free
  if (trk.bang) {
    trk.bang.t -= dt;
    setTone("trkRattle", "sawtooth", 50, 0); setTone("trkWhir", "square", 200, 0);
    if (trk.bang.t <= 0) {
      const r = trk.bang.retry;
      trk.bang = null; trk.seg = r.seg; trk.s = r.s; trk.v = 0; trk.air = null;
      flags.trackReassembles = (flags.trackReassembles || 0) + 1;
      thunk();
    }
    tkPoseRail(); tkSync(0);
    return;
  }
  // ---- the net's throw back to the tower
  if (trk.bounce) {
    const B = trk.bounce, s0 = tkFirst().S[0];
    B.t += dt / TK.net.flight;
    const t = clamp(B.t, 0, 1);
    tkPose.x = lerp(B.x, s0.x, tkSm(t)); tkPose.z = lerp(B.z, s0.z, tkSm(t));
    tkPose.y = lerp(B.y, s0.y, tkSm(t)) + Math.sin(Math.PI * t) * TK.net.arc;
    tkPose.T.set(s0.x - B.x, 0, s0.z - B.z).normalize(); tkPose.N.set(0, 1, 0);
    tkPose.spin = t < 0.85 ? t * Math.PI * 4 : 0;
    tkSync(0);
    if (B.t >= 1) {
      trk.bounce = null; trk.seg = tkFirst().id; trk.s = 0; trk.v = 0; tkPose.spin = 0;
      trk.runs++; flags.trackRuns = (flags.trackRuns || 0) + 1;
      chirp();
    }
    return;
  }
  // ---- in the air: off the gap's lip, out of a loop, off the ski-jump
  if (trk.air) {
    const A = trk.air;
    A.vy -= P.g * dt;
    A.x += A.vx * dt; A.y += A.vy * dt; A.z += A.vz * dt; A.t += dt;
    tkPose.x = A.x; tkPose.y = A.y; tkPose.z = A.z;
    tkPose.T.set(A.vx, A.vy, A.vz).normalize();
    if (A.kind === "peel") { tkPose.spin += A.spinRate * dt; } else tkPose.spin = 0;
    tkPose.N.set(0, 1, 0).addScaledVector(tkPose.T, -tkPose.T.y).normalize();
    // the landing ramp across the gap
    if (A.kind === "gap" && A.vy < 0) {
      const seg = trk.segs[A.to];
      for (let k = 0; k < seg.S.length; k += 2) {
        const q = seg.S[k], dx = A.x - q.x, dz = A.z - q.z;
        const along = dx * q.tx + dz * q.tz, lat = Math.abs(dx * q.tz - dz * q.tx);
        if (Math.abs(along) < 1.5 && lat < TK.width / 2 + 1.2 && A.y - q.y < 1.2 && A.y - q.y > -2.5) {
          trk.seg = seg.id; trk.s = q.s; trk.v = Math.max(4, A.vx * q.tx + A.vy * q.ty + A.vz * q.tz); trk.air = null;
          thunk(); flags.trackGapLandings = (flags.trackGapLandings || 0) + 1;
          return tkRail(dt, touching, bank);
        }
      }
    }
    // the net
    if (A.kind === "ski") {
      const ny = tkNetY(A.x, A.z);
      if (ny !== null && A.y <= ny + 1) {
        trk.air = null; trk.bounce = { t: 0, x: A.x, y: ny + 1, z: A.z };
        trk.net.sagV = -Math.min(30, Math.abs(A.vy) + 6);
        boing(); flags.trackNet = (flags.trackNet || 0) + 1;
        return;
      }
    }
    const gy = Math.max(terrainEff(A.x, A.z), TUNE.waterLevel);
    if (A.y <= gy + 1 || A.t > 9) return tkBang(A.x, Math.max(A.y, gy + 1), A.z, A.retry);
    tkSync(Math.hypot(A.vx, A.vy, A.vz));
    return;
  }
  tkRail(dt, touching, bank);
}

// Which side he is holding, by the car's allowances (a lift shorter than
// liftGrace is not a release; the finger that lands again has relatchFor to
// find its drag). Tracked EVERY frame -- on the lift and in the net's throw too:
// he comes on to the start deck that way, and a hold he made in the air is the
// hold he has when the deck's fork asks.
function tkTrackHold(dt, touching, bank) {
  const full = Math.abs(bank) >= CAR.fullSteer;
  if (!touching) {
    trk.forkLift += dt;
    trk.forkRelatch = trk.forkLift <= CAR.liftGrace ? CAR.relatchFor : 0;
    if (trk.forkLift > CAR.liftGrace) trk.holdSide = 0;
  } else {
    trk.forkLift = 0;
    const finding = trk.forkRelatch > 0;
    if (full) { trk.forkRelatch = 0; trk.holdSide = Math.sign(bank); }
    else if (finding) trk.forkRelatch -= dt;
    else trk.holdSide = 0;
  }
}

// On the rail: gravity along the track, the motor under his finger, the boosters,
// the forks, and the one way off a loop.
function tkRail(dt, touching, bank) {
  const P = TK.physics;
  let q = tkAt(trk.segs[trk.seg], trk.s);
  const vMax = P.motorSpeed * spdMul();
  let a = -P.g * q.ty;
  if (touching) a += P.motorAccel * clamp(1 - trk.v / vMax, 0, 1.6);
  a -= Math.sign(trk.v) * P.roll + P.drag * trk.v * Math.abs(trk.v);
  const boosting = q.type === "booster" && trk.v > -1;
  if (boosting && trk.v < P.boostMax) a += P.boostAccel;
  trk.v += a * dt;
  // at rest on the level he stays at rest
  if (!touching && Math.abs(trk.v) < 0.4 && Math.abs(q.ty) < 0.04) trk.v = 0;

  // ---- the forks: a full steer HELD through the approach (the city's rule).
  // Which side he is holding is tracked all the time, by exactly the car's
  // allowances (car.js): a lift shorter than liftGrace is not a release, and the
  // finger that lands again has relatchFor to find its drag -- it lands at the
  // middle of a new one. The fork then asks whether that hold has stood through
  // its whole approach. (Read only at the moment the approach began, a 300 ms
  // lift that straddled it lost the turn.)
  const seg = trk.segs[trk.seg];
  if (seg.fork && seg.len - trk.s <= seg.fork.approach) {
    if (trk.forkEnter !== seg.id) { trk.forkEnter = seg.id; trk.forkHeld = trk.holdSide || 0; }
    else if (trk.holdSide !== trk.forkHeld) trk.forkHeld = 0;
  } else { trk.forkEnter = null; trk.forkHeld = 0; }
  const pick = (sg) => {
    const took = trk.forkHeld > 0 ? sg.fork.stunt : sg.fork.safe;
    trk.took[sg.id] = took === sg.fork.stunt ? "stunt" : "safe";
    flags.trackForks = flags.trackForks || {}; flags.trackForks[sg.id + ":" + trk.took[sg.id]] = (flags.trackForks[sg.id + ":" + trk.took[sg.id]] || 0) + 1;
    trk.forkHeld = 0; trk.forkEnter = null;
    return took;
  };
  const was = q.type;
  const st = tkStep(trk.seg, trk.s, trk.v * dt, pick);
  if (st.off === "stop") trk.v = Math.max(0, trk.v);
  trk.seg = st.seg; trk.s = st.s;
  q = tkAt(trk.segs[trk.seg], trk.s);
  if (q.type === "loop" && was !== "loop") whoosh();

  // ---- off the end of the exit lane: on to the road back
  if (st.off === "leave") { trackLeave(); return; }
  // ---- off the lip of the gap, or the ski-jump: into the air
  if (st.off === "gap" || st.off === "end") {
    const sg = trk.segs[trk.seg];
    trk.air = { kind: st.off === "gap" ? "gap" : "ski", x: q.x, y: q.y, z: q.z, vx: q.tx * trk.v, vy: q.ty * trk.v, vz: q.tz * trk.v, t: 0,
                to: sg.gapTo, retry: tkRetryFor(trk.seg, trk.s), spinRate: 0 };
    whoosh();
    tkSync(trk.v);
    return;
  }
  // ---- a loop can push him round, never pull him: too slow and he peels off
  if (q.type === "loop") {
    const fn = trk.v * trk.v * q.kn + P.g * q.ny;          // what the track must push with
    if (fn < -P.grip * P.g) {
      trk.air = { kind: "peel", x: q.x, y: q.y, z: q.z, vx: q.tx * trk.v, vy: q.ty * trk.v, vz: q.tz * trk.v, t: 0,
                  retry: tkRetryFor(trk.seg, trk.s), spinRate: 5 + Math.random() * 3 };
      flags.trackPeels = (flags.trackPeels || 0) + 1;
      squeak();
      tkSync(trk.v);
      return;
    }
  }
  // ---- rear-ending a toy car on the course: both go bang
  for (const c of trk.cars) {
    if (c.gone > 0 || c.seg !== trk.seg) continue;
    const gap = c.s - trk.s;
    if (gap > 0 && gap < TK.cars.touch && trk.v > c.v + 1) {
      c.gone = TK.cars.back; c.mesh.visible = false;
      triggerExplosion(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, 0.6);
      flags.trackCarHits = (flags.trackCarHits || 0) + 1;
      return tkBang(q.x, q.y, q.z, tkRetryFor(trk.seg, trk.s));
    }
  }
  tkPoseRail();
  tkSync(trk.v, boosting);
}

function tkPoseRail() {
  const q = tkAt(trk.segs[trk.seg], trk.s);
  tkPose.x = q.x; tkPose.y = q.y; tkPose.z = q.z;
  tkPose.T.set(q.tx, q.ty, q.tz); tkPose.N.set(q.nx, q.ny, q.nz); tkPose.spin = 0;
}

function tkBang(x, y, z, retry) {
  triggerExplosion(x, y + 1, z, 1);
  cameraHitStop(1.0);
  trk.air = null;
  trk.bang = { t: TK.reassemble, retry: retry || { seg: tkFirst().id, s: 0 } };
  flags.trackCrashes = (flags.trackCrashes || 0) + 1;
}

// Write the pose into the shared state, and the sound.
function tkSync(v, boosting) {
  state.x = tkPose.x; state.y = tkPose.y; state.z = tkPose.z;
  state.heading = Math.atan2(-tkPose.T.x, -tkPose.T.z);
  state.speed = Math.abs(v); state.pitch = 0; state.bank = 0; state.airVy = null;
  forward.copy(tkPose.T);
  const sp = Math.abs(v);
  setEngine(0);
  setTone("trkRattle", "sawtooth", 38 + sp * 2.2, sp > 0.5 && !trk.air && !trk.bounce ? Math.min(0.05, 0.012 + sp * 0.0012) : 0);
  trk.rattle -= sp * (1 / 60);
  if (sp > 1 && !trk.air && trk.rattle <= 0) { trk.rattle = TK.rattleEvery; noiseBurst(0.03, 1800, Math.min(0.06, 0.02 + sp * 0.001), 0); }
  setTone("trkWhir", "square", 180 + sp * 9, boosting ? 0.035 : 0);
  if (trk.rollerMesh && Math.hypot(state.x - trk.rollers[0].x, state.z - trk.rollers[0].z) < 900) { trk.rollerSpin += (boosting ? 40 : 12) * (1 / 60); tkPoseRollers(); }
}

// ---- the toy cars ---------------------------------------------------------------------
function tkUpdateCars(dt) {
  const hisSeg = trk.on && !trk.lift ? trk.seg : null;
  for (const c of trk.cars) {
    if (c.gone > 0) {
      c.gone -= dt;
      if (c.gone <= 0) {
        // back at the start, but never on top of him
        if (hisSeg === tkFirst().id && trk.s < 40) { c.gone = 1; continue; }
        c.seg = tkFirst().id; c.s = 0; c.mesh.visible = true;
      } else continue;
    }
    let v = TK.cars.speed;
    // never into him: one closing on him from behind waits
    if (hisSeg && c.seg === hisSeg && trk.s - c.s > 0 && trk.s - c.s < TK.cars.hold) v = 0;
    const st = tkStep(c.seg, c.s, v * dt, sg => sg.fork.safe);
    if (st.off === "end" || st.off === "gap" || st.off === "leave") { c.gone = TK.cars.back; c.mesh.visible = false; continue; }
    c.seg = st.seg; c.s = st.s; c.v = v;
    const q = tkAt(trk.segs[c.seg], c.s), L = tkFrameAt(q);
    tkM.makeBasis(tkV1.set(-L[0], -L[1], -L[2]), tkV2.set(q.nx, q.ny, q.nz), tkV3.set(-q.tx, -q.ty, -q.tz));
    c.mesh.quaternion.setFromRotationMatrix(tkM);
    c.mesh.position.set(q.x, q.y, q.z);
  }
}

function tkUpdateNet(dt) {
  const n = trk.net; if (!n) return;
  n.sagV += (-n.sag * 40 - n.sagV * 5) * dt;
  n.sag += n.sagV * dt;
  if (Math.abs(n.sag) < 0.01 && Math.abs(n.sagV) < 0.01) return;
  const pa = n.sheet.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const u = (i % 13) / 12, v = Math.floor(i / 13) / 16;
    const bump = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * n.sag;
    pa.array[i * 3 + 1] = n.rest[i * 3 + 1] + bump;
  }
  pa.needsUpdate = true;
}

// ---- the camera and the model: upside down with him, in both views ----------------------
function trackCamera(dt) {
  const T = tkPose.T, N = tkPose.N;
  trk.camUp.lerp(N, Math.min(1, TK.cam.upLag * dt)).normalize();
  camera.up.copy(trk.camUp);
  if (state.viewChase) {
    // On the rail the camera rides the track itself, `back` metres behind him
    // along the curve and up off its deck -- a straight line back from the top
    // of a loop leaves the loop, and looked at the track from underneath.
    if (!trk.air && !trk.bounce && !trk.lift && !trk.bang) {
      const b = tkStep(trk.seg, trk.s, -TK.cam.back, sg => trk.took[sg.id] === "stunt" ? sg.fork.stunt : sg.fork.safe);
      const q = tkAt(trk.segs[b.seg], b.s);
      camDesired.set(q.x + q.nx * TK.cam.up, q.y + q.ny * TK.cam.up, q.z + q.nz * TK.cam.up);
    } else {
      camDesired.set(tkPose.x - T.x * TK.cam.back + N.x * TK.cam.up, tkPose.y - T.y * TK.cam.back + N.y * TK.cam.up, tkPose.z - T.z * TK.cam.back + N.z * TK.cam.up);
    }
    if (trk.lift || trk.bounce) camDesired.set(tkPose.x - T.x * TK.cam.back * 1.6, tkPose.y + TK.cam.up * 2, tkPose.z - T.z * TK.cam.back * 1.6);
    camera.position.lerp(camDesired, Math.min(1, TK.cam.lag * dt));
    lookV.set(tkPose.x + T.x * 8 + N.x * 1.5, tkPose.y + T.y * 8 + N.y * 1.5, tkPose.z + T.z * 8 + N.z * 1.5);
    camera.lookAt(lookV);
    carHideCabin();
  } else {
    // the car's own driving seat (car.js carCamera): off to the side, at its eye
    // height, a hand forward -- only turned with the track
    const K = CAR.cabin, bodyH = (vehicleModel && vehicleModel.userData.height) || CAR.bodyH * 1.22;
    const eye = bodyH * CAR.eyeFrac, R = tkV1.crossVectors(T, N).normalize();     // his right
    const ex = tkPose.x + N.x * eye + T.x * 0.2 + R.x * K.seatX, ey = tkPose.y + N.y * eye + T.y * 0.2 + R.y * K.seatX,
          ez = tkPose.z + N.z * eye + T.z * 0.2 + R.z * K.seatX;
    camera.position.set(ex, ey, ez);
    // a touch below the line of the track ahead, as the car's seat looks
    lookV.set(ex + T.x * 30 - N.x * 1.5, ey + T.y * 30 - N.y * 1.5, ez + T.z * 30 - N.z * 1.5);
    camera.lookAt(lookV);
    const cab = carBuildCabin();
    cab.visible = !trk.bang;
    cab.position.set(tkPose.x, tkPose.y, tkPose.z);
    tkBasisQuat(cab.quaternion);
  }
}
// the model's orientation: it faces -z, so its basis is (T x N, N, -T)
function tkBasisQuat(out) {
  const T = tkPose.T, N = tkPose.N;
  tkV1.crossVectors(T, N).normalize();
  tkV2.copy(N); tkV3.copy(T).negate();
  tkM.makeBasis(tkV1, tkV2, tkV3);
  out.setFromRotationMatrix(tkM);
  if (tkPose.spin) { tkQ.setFromAxisAngle(tkV1.set(1, 0, 0), tkPose.spin); out.multiply(tkQ); }
  return out;
}
function trackPoseModel(m) {
  m.visible = state.viewChase && !trk.bang;
  const off = 0.6 - TUNE.gearHeight;
  m.position.set(tkPose.x + tkPose.N.x * off, tkPose.y + tkPose.N.y * off, tkPose.z + tkPose.N.z * off);
  tkBasisQuat(m.quaternion);
}

// Every frame, whatever he is in: the toy cars run the course for anyone
// watching from the motorway or the air.
function trackFrame(dt) {
  if (!trk.built || trk.on) return;
  tkUpdateCars(dt);
  tkUpdateNet(dt);
}
function trackReset() {
  if (!trk.on) return;
  trk.on = false; trk.lift = null; trk.air = null; trk.bang = null; trk.bounce = null;
  setTone("trkRattle", "sawtooth", 50, 0); setTone("trkWhir", "square", 200, 0);
}

// ---- its own motorway exit, and the road from it to the foot of the lift ---------------
// Built here, after the track, the way the harbour builds its own (harbor.js):
// a spur record pushed into highway.exits is a road as far as the car is
// concerned, and it claims its corridor so nothing streams in across it.
function tkBuildExit() {
  const pad = tkLiftPad(); if (!pad) return;
  const n = hwyNearest(pad.x, pad.z);
  // Which carriageway serves it: the one whose RIGHT the pad is on (traffic
  // keeps right). Travelling +s, the right is +lat; travelling -s, -lat. The
  // mouth comes `lead` metres before the pad for that traffic, and the spur
  // leaves the way that traffic is going -- a spur is only ever taken the way
  // it runs (car.js).
  const side = Math.sign(n.lateral) || 1, dir = side > 0 ? 1 : -1;
  const A = hwySampleAt(n.s - dir * TK.exit.lead);
  const fx = A.fx * dir, fz = A.fz * dir, rx = -fz, rz = fx;      // his forward and his right
  const pts = [];
  const seg = 10;
  for (let k = 0; k <= seg; k++) {
    const t = k / seg, out = Math.sin(t * Math.PI / 2) * TK.exit.out, fwd = t * TK.exit.fwd;
    pts.push({ x: A.x + rx * out + fx * fwd, z: A.z + rz * out + fz * fwd });
  }
  const from = pts[pts.length - 1], L = Math.hypot(pad.x - from.x, pad.z - from.z), nn = Math.max(4, Math.ceil(L / 40));
  for (let k = 1; k <= nn; k++) pts.push({ x: lerp(from.x, pad.x, k / nn), z: lerp(from.z, pad.z, k / nn) });
  for (let k = 0; k < pts.length; k++) {
    const ground = Math.max(terrainEff(pts[k].x, pts[k].z), TUNE.waterLevel) + HW.clearance;
    pts[k].y = k <= seg ? lerp(A.y, ground, smoothstep(0, HW.spurDescend, k / seg)) : ground;
  }
  let run = 0; pts[0].s = 0; pts[0].fx = fx; pts[0].fz = fz;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x, dz = pts[k].z - pts[k - 1].z, l = Math.hypot(dx, dz) || 1;
    pts[k].fx = dx / l; pts[k].fz = dz / l; run += l; pts[k].s = run;
  }
  trk.g.add(hwyStrip(pts, -HW.spurW, HW.spurW, 0, artPaint(mattMat(TUNE.runwaySurfaceColor), "asphalt")));
  // the board, on his right before the mouth, facing him
  const bs = hwySampleAt(n.s - dir * (TK.exit.lead + TK.exit.boardBack));
  const bx = bs.x + rx * (highway.halfW + 16), bz = bs.z + rz * (highway.halfW + 16);
  hwyExitBoard(trk.g, bx, bs.y, bz, { fx, fz }, "loop");
  const rec = { s: (n.s - dir * TK.exit.lead) / highway.length, side, icon: "loop", to: "track",
                x: A.x, z: A.z, y: A.y, spur: pts, bx, bz };
  highway.exits.push(rec);
  hwyClaimCorridor(pts);
  trk.exit = rec;
  tkBuildBack(n, side, dir);
  hwyIndexCorridor();
}

// The road back from the foot of the exit lane: a way ON (`out`), merging into
// the same carriageway `TK.leave.back.lead` metres from the pad -- before the
// track's own exit mouth, so the two roads never cross. Laid from the motorway
// end (the order every way on is kept in) round to the lane's end.
function tkBuildBack(n, side, dir) {
  const ex = trk.segs.exit; if (!ex) return;
  const E = ex.S[ex.S.length - 1], B = TK.leave.back;
  const M = hwySampleAt(n.s - dir * B.lead);
  const fx = M.fx * dir, fz = M.fz * dir, rx = -fz, rz = fx;     // his forward at the merge, and his right
  // It meets the motorway at ITS carriageway's outer edge, running along it --
  // not at the centreline: laid from the middle, it brought him in across his own
  // carriageway, through the median and on to the other one, the wrong way.
  const edge = HW.medianW / 2 + HW.lanes * HW.laneW;
  const pts = [], seg = 10;
  for (let k = 0; k <= seg; k++) {
    // a taper first, alongside the edge, then the sweep away: he comes in
    // running WITH the traffic, as on every way on
    const t = k / seg, u = clamp((t - B.taper) / (1 - B.taper), 0, 1);
    const out = edge + B.out * u * u * (3 - 2 * u), back = t * B.fwd;
    pts.push({ x: M.x + rx * out - fx * back, z: M.z + rz * out - fz * back });
  }
  const from = pts[pts.length - 1], L = Math.hypot(E.x - from.x, E.z - from.z), nn = Math.max(4, Math.ceil(L / 40));
  for (let k = 1; k <= nn; k++) pts.push({ x: lerp(from.x, E.x, k / nn), z: lerp(from.z, E.z, k / nn) });
  for (let k = 0; k < pts.length; k++) {
    const ground = Math.max(terrainEff(pts[k].x, pts[k].z), TUNE.waterLevel) + HW.clearance;
    pts[k].y = k <= seg ? lerp(M.y, ground, smoothstep(0, HW.spurDescend, k / seg)) : ground;
  }
  pts[pts.length - 1].y = E.y;
  let run = 0; pts[0].s = 0; pts[0].fx = -fx; pts[0].fz = -fz;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x, dz = pts[k].z - pts[k - 1].z, l = Math.hypot(dx, dz) || 1;
    pts[k].fx = dx / l; pts[k].fz = dz / l; run += l; pts[k].s = run;
  }
  trk.g.add(hwyStrip(pts, -HW.spurW, HW.spurW, 0, artPaint(mattMat(TUNE.runwaySurfaceColor), "asphalt")));
  const rec = { s: (n.s - dir * B.lead) / highway.length, side, to: "trackBack", out: true,
                x: M.x, z: M.z, y: M.y, spur: pts, bx: M.x, bz: M.z };
  highway.exits.push(rec);
  hwyClaimCorridor(pts);
  trk.back = rec;
}

// The gantry over the exit lane's mouth, on the deck: blue, the motorway's
// icon, facing him as he comes off the lift.
function tkBuildGantry(g) {
  const ex = trk.segs.exit; if (!ex) return;
  const q = tkAt(ex, TK.leave.gantryAt), W = TK.width / 2 + 1.6, H = 7;
  const gg = new THREE.Group();
  gg.position.set(q.x, q.y, q.z);
  gg.rotation.y = Math.atan2(-q.tx, -q.tz);          // its face toward him, coming along the lane
  const post = new THREE.MeshLambertMaterial({ color: TUNE.palette.blue });
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, H, 0.8), post); m.position.set(sx * W, H / 2, 0); gg.add(m); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * W + 0.8, 0.8, 0.8), post); beam.position.y = H; gg.add(beam);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 0.5), new THREE.MeshLambertMaterial({ color: 0x1c4f9c }));
  panel.position.y = H + 1.4; gg.add(panel);
  const ic = new THREE.Group(); ic.scale.setScalar(0.42); ic.position.set(0, H + 1.4 - 0.42 * H, 0.3);
  hwyIcon(ic, "road", new THREE.MeshBasicMaterial({ color: TUNE.palette.white }), H);
  gg.add(ic);
  g.add(gg);
  trk.gantry = gg;
}

tkBuild();
tkBuildExit();
