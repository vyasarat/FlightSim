"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- TRACK EVENTS (v189: Desert Dunes). The parent's brief after "racing is just circling the
// track": one or two things per track that HAPPEN, all machines or nature, never animals. Each is seen coming
// and steered round; none is ever a bang, and none stops him.
//
// A track lists its events (`TUNE.race.tracks[].events`); the numbers they share are `TUNE.race.events`.
// Everything here is pooled and built at load on the kit's quiet stream, so a race makes no three.js object
// and draws nothing from Math.random (race_track_checks h). Events are timed off HIM: they happen where he
// is about to be, every lap, so he sees each one three times a race.
//
// BOULDERS (Desert Dunes): rocks roll across the sand straight along the rim, off the inland slope and away
// over the edge. As he comes within `lead` s of them, `n` are let go, each timed to be in its own lane as he
// reaches it -- the gaps between are his to steer for. A boulder that meets a car spins it out, as an item does
// (raceitems.js rcItHit: the bubble takes it, a giant shrugs it off). A falling-rocks sign stands before them.
//
// THE TRAIN (Desert Dunes, the parent's choice): the road JUMPS the freight line. Under the third dune's crest
// the road is a short bridge over a level railway bed (terrain.js rcRailBed); a train waits in a shed at one
// end, leaves as he comes within `lead` s of the crest, and is timed to pass under him as he flies -- he never
// stops for it, and it never touches a car. The booms drop and the lamps flash and the bell rings while it is
// near: he hears and sees it coming. It runs into the shed at the other end and comes back the next lap.
// ---------------------------------------------------------------------------
const RCE = TUNE.race.events;
const rceP = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
const rceV = new THREE.Vector3();
const rce = { venues: {}, cur: null };

// ---- built once, at load, for every track that has events ---------------------------------------
function rceBuild() {
  for (const def of RC.tracks) {
    if (!def.events) continue;
    const T = race.venues[def.id] && race.venues[def.id].track;
    if (!T) continue;
    const v = rce.venues[def.id] = { def, T, boulders: null, train: null };
    for (const ev of def.events) {
      if (ev.kind === "boulders") v.boulders = rceBuildBoulders(T, ev);
      if (ev.kind === "train" && def.rail) v.train = rceBuildTrain(T, def.rail);
    }
  }
}

function rceBuildBoulders(T, ev) {
  const B = RCE.boulders, g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(B.r, 1);
  const mat = new THREE.MeshLambertMaterial({ color: B.colour, flatShading: true });
  const rocks = [];
  for (let i = 0; i < B.n * 2; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; m.castShadow = true; m.userData.noSolid = true; g.add(m); rocks.push({ m, on: false }); }
  // the slope they come off: a heap of the same rocks, still, on the side they roll from
  const side = ev.side, W = RC.width / 2 + RC.kerbW;
  for (let k = 0; k < 7; k++) {
    const s = ev.m - 10 + k * (B.spread * (B.n - 1) + 20) / 6, lat = side * (W + 9 + (k % 3) * 3);
    rcPointOn(T, s, lat, rceP);
    const m = new THREE.Mesh(geo, mat);
    const sc = 1.1 + (k % 3) * 0.35;
    m.scale.set(sc, sc * 0.8, sc); m.position.set(rceP.x, terrainEff(rceP.x, rceP.z) + B.r * sc * 0.5, rceP.z); m.rotation.set(k, k * 2, 0);
    m.userData.noSolid = true; g.add(m);
  }
  // the sign: a yellow triangle on a post, a rock falling on it -- no words
  rcPointOn(T, ev.m - B.sign, side * (W + 3 + 1.2 * B.signK), rceP);   // (clear of the barrier, however big)
  const sign = rceSign(rceP, rcAtOn(T, ev.m - B.sign));
  g.add(sign);
  scene.add(g);
  return { ev, g, rocks, released: -1 };
}
// a warning sign: a post, a yellow triangle with a dark edge, and a rock on it
function rceSign(p, q) {
  const g = new THREE.Group(), P = TUNE.palette;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), new THREE.MeshLambertMaterial({ color: P.steel }));
  post.position.y = 1.6; g.add(post);
  const tri = (r, col, z) => { const sh = new THREE.Shape(); sh.moveTo(0, r); sh.lineTo(-r * 0.87, -r * 0.5); sh.lineTo(r * 0.87, -r * 0.5); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(0, 3.6, z); return m; };
  g.add(tri(1.3, P.ink, 0.01), tri(1.05, P.warning, 0.03));
  const rock = new THREE.Mesh(new THREE.CircleGeometry(0.35, 7), new THREE.MeshBasicMaterial({ color: P.rust, side: THREE.DoubleSide }));
  rock.position.set(0.1, 3.45, 0.05); g.add(rock);
  g.scale.setScalar(RCE.boulders.signK);   // (big: from 200 m back it has to read)
  g.position.set(p.x, terrainEff(p.x, p.z), p.z);
  g.rotation.y = Math.atan2(q.tx, q.tz) + Math.PI;     // (facing the cars coming)
  g.traverse(o => { o.userData.noSolid = true; });
  return g;
}
// rcPoint and rcAt on a given track, not the one in use
function rcPointOn(T, s, lat, out) { const t0 = race.track; race.track = T; try { return rcPoint(s, lat, out); } finally { race.track = t0; } }
function rcAtOn(T, s) { const t0 = race.track; race.track = T; try { const q = rcAt(s); return { tx: q.tx, tz: q.tz, gy: q.gy, x: q.x, z: q.z, lx: q.lx, lz: q.lz }; } finally { race.track = t0; } }

function rceBuildTrain(T, R) {
  const C = RCE.train, P = TUNE.palette, g = new THREE.Group();
  const y = R.y;
  // the crossing: the sample of its section nearest the rail's line (the section runs across it)
  let q = null;
  for (const p of T.S) if (p.sec === R.sec && (!q || Math.abs(p.z - R.z) < Math.abs(q.z - R.z))) q = p;
  const crossX = q.x, crossS = q.s;
  // rails and sleepers, level along the bed
  const boxes = [];
  for (const off of [-0.75, 0.75]) boxes.push({ x: (R.x0 + R.x1) / 2, y: y + 0.25, z: R.z + off, w: R.x1 - R.x0, h: 0.18, d: 0.14, c: P.steel });
  for (let x = R.x0; x <= R.x1; x += 2.5) boxes.push({ x, y: y + 0.08, z: R.z, w: 0.5, h: 0.16, d: 2.6, c: P.slate });
  const mk = (b) => { const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshLambertMaterial({ color: b.c })); m.position.set(b.x, b.y, b.z); return m; };
  const rails = new THREE.Group(); for (const b of boxes) rails.add(mk(b)); g.add(rails);
  // the bridge: open beams along the road across the opening (the road's surface stops there, race.js), so the
  // train shows between them as he flies over; a wall each side of the rail
  const W = RC.width / 2 + RC.kerbW, deckY = q.gy, D = C.deck;
  for (let k = 0; k < D.beams; k++) g.add(mk({ x: crossX - W + D.w / 2 + k * (W * 2 - D.w) / (D.beams - 1), y: deckY - D.drop - D.h / 2, z: R.z, w: D.w, h: D.h, d: R.gap * 2 + 1.2, c: P.concrete }));
  solidBox3(crossX, deckY - 0.9, R.z, [1, 0, 0], [0, 1, 0], [0, 0, 1], W + 0.5, 0.7, R.gap + 0.5, "bridge");
  for (const sd of [-1, 1]) {
    const wall = mk({ x: crossX, y: (deckY + y) / 2, z: R.z + sd * (R.gap + 0.6), w: W * 2 + 4, h: deckY - y, d: 1.2, c: P.concrete });
    g.add(wall);
    solidBox3(crossX, (deckY + y) / 2, R.z + sd * (R.gap + 0.6), [1, 0, 0], [0, 1, 0], [0, 0, 1], W + 2, (deckY - y) / 2, 0.6, "bridge");
  }
  // a shed at each end, open toward the line
  const S = C.shed, sheds = [];
  for (const [x, dir] of [[R.x0 - S.len / 2 + 6, 1], [R.x1 + S.len / 2 - 6, -1]]) {
    const sh = new THREE.Group();
    const roofY = terrainEff(x, R.z);
    const wallM = new THREE.MeshLambertMaterial({ color: P.rust });
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(S.len, S.h, 0.6), wallM); m.position.set(0, S.h / 2, sd * S.w / 2); sh.add(m); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, S.h, S.w), wallM); back.position.set(-dir * S.len / 2, S.h / 2, 0); sh.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(S.len + 1, 0.6, S.w + 1.2), new THREE.MeshLambertMaterial({ color: P.slate })); roof.position.y = S.h; sh.add(roof);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(S.w - 1, S.h - 1), new THREE.MeshBasicMaterial({ color: P.ink })); dark.position.set(-dir * (S.len / 2 - 0.4), S.h / 2, 0); dark.rotation.y = dir * Math.PI / 2; sh.add(dark);
    sh.position.set(x, Math.min(y, roofY), R.z);
    g.add(sh);
    addSolidBox(x, Math.min(y, roofY), R.z, S.len / 2, S.w / 2, Math.min(y, roofY) + S.h, null, "building");
    sheds.push({ x, dir });
  }
  // booms and lamps at the cutting's edges, beside the road on the dune, each edge and each side: a post
  // with two lamps, and a red-and-white arm that drops level along the edge, outward from the road
  const booms = [], lamps = [];
  for (const ez of [-1, 1]) for (const sd of [-1, 1]) {
    const bx = crossX + sd * (W + 1.2), bz = R.z + ez * (R.gap + 1.2), base = deckY - 0.5;
    const post = mk({ x: bx, y: base + 1.5, z: bz, w: 0.4, h: 3, d: 0.4, c: P.white }); g.add(post);
    const pivot = new THREE.Group(); pivot.position.set(bx, base + C.boom.h, bz);
    for (let k = 0; k < 6; k++) { const seg = mk({ x: sd * (0.75 + k * 1.5), y: 0, z: 0, w: 1.5, h: 0.28, d: 0.28, c: k % 2 ? P.white : P.red }); pivot.add(seg); }
    g.add(pivot); booms.push({ pivot, sd });
    for (const dx of [-0.45, 0.45]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(C.lampR, 10, 8), new THREE.MeshBasicMaterial({ color: P.ink }));
      lamp.position.set(bx, base + 3.2, bz + dx * C.lampR / 0.34); g.add(lamp); lamps.push(lamp);
    }
  }
  // the train: an engine and its wagons, one group, each a box with a cab or a load
  const train = new THREE.Group(), parts = [];
  const body = (len, col, h) => { const t = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, h, C.wid), new THREE.MeshLambertMaterial({ color: col })); b.position.y = 1.0 + h / 2; t.add(b);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(len - 1, 0.8, C.wid * 0.85), new THREE.MeshLambertMaterial({ color: P.ink })); chassis.position.y = 0.6; t.add(chassis);
    return t; };
  const eng = body(C.engLen, C.colours[0], C.h - 1.2);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, C.wid * 0.9), new THREE.MeshLambertMaterial({ color: P.warning })); cab.position.set(C.engLen / 2 - 3, C.h + 0.4, 0); eng.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, C.wid * 0.7), new THREE.MeshBasicMaterial({ color: P.cyan })); glass.position.set(C.engLen / 2 - 0.95, C.h + 0.45, 0); eng.add(glass);
  train.add(eng); parts.push({ m: eng, off: 0 });
  let off = -(C.engLen / 2 + 0.8 + C.carLen / 2);
  for (let k = 0; k < C.cars; k++) {
    const w = body(C.carLen, C.colours[1 + (k % (C.colours.length - 1))], C.h - 1.6);
    train.add(w); parts.push({ m: w, off }); w.position.x = off; off -= C.carLen + 0.8;
  }
  train.traverse(o => { o.userData.noSolid = true; o.castShadow = true; });
  g.add(train);
  g.traverse(o => { o.userData.noSolid = true; });   // (what is solid here is registered above, by hand)
  scene.add(g);
  const len = C.engLen + C.cars * (C.carLen + 0.8);
  const tr = { R, g, train, len, crossX, crossS, deckY, booms, lamps, sheds,
               x: sheds[0].x, dir: 1, state: "shed", v: 0, lap: -1, boomA: 0, bellT: 0, passedHim: false };
  rcePoseTrain(tr);
  return tr;
}
function rcePoseTrain(tr) {
  // the engine leads, whichever way it is going
  tr.train.position.set(tr.x, tr.R.y + 0.2, tr.R.z);
  tr.train.rotation.y = tr.dir > 0 ? 0 : Math.PI;
}

// ---- a race on a track with events ----------------------------------------------------------------
function rceStart() {
  rceReset();
  const v = rce.venues[race.track.def.id];
  rce.cur = v || null;
  if (!v) return;
  if (v.boulders) { v.boulders.released = -1; for (const b of v.boulders.rocks) { b.on = false; b.m.visible = false; } }
  if (v.train) { const tr = v.train; tr.state = "shed"; tr.lap = -1; tr.v = 0; tr.passedHim = false; }
}
function rceReset() {
  for (const id in rce.venues) {
    const v = rce.venues[id];
    if (v.boulders) for (const b of v.boulders.rocks) { b.on = false; b.m.visible = false; }
    if (v.train) { const tr = v.train; if (tr.state !== "shed") { tr.state = "shed"; tr.v = 0; tr.x = tr.dir > 0 ? tr.sheds[1].x : tr.sheds[0].x; tr.dir = -tr.dir; } tr.boomA = 0; rcePoseTrain(tr); rceBooms(tr, 0); for (const l of tr.lamps) l.material.color.setHex(TUNE.palette.ink); }
  }
  rce.cur = null;
}

function rceUpdate(dt, going) {
  const v = rce.cur;
  if (!v || !race.him) return;
  if (v.boulders) rceBoulders(v.boulders, dt, going);
  if (v.train) rceTrain(v.train, dt, going);
}

// ---- boulders ------------------------------------------------------------------------------------------
function rceBoulders(B, dt, going) {
  const E = RCE.boulders, him = race.him, L = race.track.len, W = RC.width / 2;
  const lap = Math.floor((him.s - B.ev.m + E.lead * RC.v) / L);
  // let go as he comes within `lead` s of the first, once a lap
  const ahead = rcAhead(B.ev.m, him.s);
  if (going && lap > B.released && ahead < E.lead * Math.max(him.v, 20) && !him.done) {
    B.released = lap;
    for (let k = 0; k < E.n; k++) {
      const b = B.rocks.find(x => !x.on) || B.rocks[k];
      const s = B.ev.m + k * E.spread, eta = rcAhead(s, him.s) / Math.max(him.v, 20);
      const target = B.ev.side * E.lanes[k % E.lanes.length];          // (+ toward the side they come from)
      const lat0 = B.ev.side * (W + E.from), roadT = Math.abs(B.ev.side * W - target) / E.vRoad;
      // at `eta` it is at its lane: down the slope at v, then across the road at vRoad
      Object.assign(b, { on: true, s, target, lat: B.ev.side * (W + E.v * Math.max(0, eta - roadT)), t: 0, roll: 0, sink: 0, hit: new Set() });
      if (Math.abs(b.lat) > Math.abs(lat0)) b.lat = lat0;              // (never further up the slope than the heap)
      b.m.visible = true;
    }
    rcThing("boulders");
    synthBlip("sawtooth", 55, 35, 1.4, 0.18, 0);                        // (the rumble: he hears them coming)
    flags.raceBoulders = (flags.raceBoulders || 0) + 1;
  }
  for (const b of B.rocks) {
    if (!b.on) continue;
    b.t += dt;
    // on the dune, until he is past it, it keeps its time with him -- at the road's edge in time to roll (slowly, at
    // vRoad, so a gap stays a gap) into its lane as he gets there, whatever his speed did
    const toB = rcGap(b.s, race.him.s), eta = toB / Math.max(race.him.v, 8), up = (b.lat * B.ev.side) - W;
    const roadT = Math.abs(B.ev.side * W - b.target) / E.vRoad, onDune = up > 0 && Math.abs(b.lat) > Math.abs(b.target);
    const vl = !onDune ? (Math.abs(b.lat) <= W ? E.vRoad : E.v)
      : toB > 0 && eta - roadT > 0.15 ? clamp(up / (eta - roadT), E.v * 0.3, E.v * 2.2) : E.v;
    b.lat -= B.ev.side * vl * dt; b.roll = (b.roll || 0) + vl * dt / E.r;
    const off = Math.abs(b.lat) > W + 2 && Math.sign(b.lat) !== B.ev.side;
    if (off) b.sink += dt;
    if (b.sink > E.sinkAfter) { b.on = false; b.m.visible = false; continue; }
    // a car it meets spins out (one footprint for every car, as a box's catch is)
    if (Math.abs(b.lat) < W + 1) for (const r of race.racers) {
      if (r.path || b.hit.has(r) || (r.air && r.y - rcPoint(r.s, r.lat, rceP).y > E.r)) continue;
      if (Math.abs(rcGap(r.s, b.s)) < RCI.footL / 2 + E.r && Math.abs(r.lat - b.lat) < rcItFoot(r) / 2 + E.r) { b.hit.add(r); rcItHit(r, null); if (r.isHim) flags.raceBoulderHits = (flags.raceBoulderHits || 0) + 1; else flags.raceBoulderRivalHits = (flags.raceBoulderRivalHits || 0) + 1; }
    }
    rcPoint(b.s, b.lat, rceP);
    const onRoad = Math.abs(b.lat) <= W + RC.kerbW;
    const gy = onRoad ? rceP.y : terrainEff(rceP.x, rceP.z);
    b.m.position.set(rceP.x, gy + E.r - b.sink * 1.2, rceP.z);
    b.m.rotation.set(b.roll * B.ev.side, 0, 0);
    if (going && ((b.t * 6) | 0) !== (((b.t - dt) * 6) | 0) && Math.abs(rcGap(b.s, race.him.s)) < RC.spray.near) rcPuff(rceP.x, gy + 0.3, rceP.z, TUNE.palette.sand, 0.5, 1.2, 0.6, 0.7);
  }
}
// ---- the train ------------------------------------------------------------------------------------------
function rceTrain(tr, dt, going) {
  const C = RCE.train, him = race.him, L = race.track.len;
  const toCrest = rcAhead(tr.crossS, him.s), lap = Math.floor((him.s + toCrest) / L);   // (the lap of the crossing he comes to next)
  // leave the shed in time to be there with him -- as soon as the run would need more than `leave` of its top
  // speed (from the far shed that is sooner than from the near one) -- once a lap
  const run = Math.abs(tr.crossX - (tr.x - tr.dir * tr.len * 0.4)) + 10, eta0 = toCrest / Math.max(him.v, 20);
  if (going && tr.state === "shed" && lap > tr.lap && eta0 < run / (C.vMax * C.leave) && !him.done) {
    tr.lap = lap; tr.state = "run"; tr.passedHim = false;
    synthBlip("square", 330, 330, 0.6, 0.1, 0); synthBlip("square", 262, 262, 0.6, 0.1, 0.05);   // (its horn)
  }
  if (tr.state === "run") {
    // timed: the middle of the train under the crossing as he gets to the crest -- never faster or slower than it may go
    const mid = tr.x - tr.dir * tr.len * 0.4, toCross = (tr.crossX - mid) * tr.dir;
    const eta = toCrest / Math.max(him.v, 10);
    const want = toCross > 0 && toCrest < L / 2 ? clamp(toCross / Math.max(eta, 0.2), C.vMin, C.vMax) : C.vMax * 0.8;
    tr.v += clamp(want - tr.v, -C.acc * dt, C.acc * dt);
    tr.x += tr.dir * tr.v * dt;
    // its chimney: seen coming before it is heard
    const SM = C.smoke; tr.smokeT = (tr.smokeT || 0) - dt;
    if (going && tr.smokeT <= 0) { tr.smokeT = SM.every; rcPuff(tr.x - tr.dir * SM.back, tr.R.y + 0.2 + C.h + SM.up, tr.R.z, SM.colour, SM.size, SM.rise, SM.life, 0.95); }
    // into the shed at the other end: it waits there for the next lap
    const end = tr.dir > 0 ? tr.sheds[1] : tr.sheds[0];
    if ((tr.x - end.x) * tr.dir > 0) { tr.x = end.x; tr.state = "shed"; tr.v = 0; tr.dir = -tr.dir; }
    // under him: the moment he crosses its line over it
    if (!tr.passedHim && Math.abs(rcGap(him.s, tr.crossS)) < 4 && rceTrainSpans(tr, tr.crossX)) { tr.passedHim = true; rcThing("train"); flags.raceTrainUnder = (flags.raceTrainUnder || 0) + 1; }
  }
  rcePoseTrain(tr);
  // the booms and the lamps: down and flashing while it is near the road
  const near = tr.state === "run" && rceTrainNear(tr) < C.warn;
  tr.boomA += clamp((near ? 1 : 0) - tr.boomA, -1.5 * dt, 1.5 * dt);
  rceBooms(tr, tr.boomA);
  const on = near && ((race.t * 2.5) | 0) % 2;
  tr.lamps.forEach((l, i) => l.material.color.setHex(near && ((i % 2) ^ on) ? 0xe0483e : TUNE.palette.ink));
  if (near && going) { tr.bellT -= dt; if (tr.bellT <= 0 && Math.abs(rcGap(tr.crossS, him.s)) < C.bellNear) { tr.bellT = C.bellEvery; synthBlip("triangle", 1250, 1250, 0.18, 0.08, 0); } }
}
// how far his camera is into looking down at the train under him: 0 out of it, 1 over the opening with the
// train in it (eased in over `camSpan` m either side of the crossing)
function rceCamK(him) {
  const v = rce.cur, C = RCE.train;
  if (!v || !v.train || !him || !race.on) return 0;
  const tr = v.train, d = Math.abs(rcGap(him.s, tr.crossS));
  if (tr.state !== "run" || d > C.camSpan || rceTrainNear(tr) > C.carLen) return 0;
  const k = 1 - d / C.camSpan; return k * k * (3 - 2 * k);
}
function rceTrainSpans(tr, x) { const a = tr.x, b = tr.x - tr.dir * tr.len; return x >= Math.min(a, b) && x <= Math.max(a, b); }
function rceTrainNear(tr) { const a = tr.x, b = tr.x - tr.dir * tr.len; return rceTrainSpans(tr, tr.crossX) ? 0 : Math.min(Math.abs(a - tr.crossX), Math.abs(b - tr.crossX)); }
function rceBooms(tr, a) { for (const b of tr.booms) b.pivot.rotation.z = b.sd * (1 - a) * 1.45; }   // (up: turned toward the sky; down: level along the edge)

{ const s0 = vkSeed; try { vkQuiet(0, rceBuild); } finally { vkSeed = s0; } }
