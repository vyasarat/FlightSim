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
//
// SNOWBALLS (Snowy Peaks, v190): the boulders' machine with snow's numbers (`TUNE.race.events.snowballs`) --
// they GROW as they roll off the mountain, and burst in a puff of snow over the far edge instead of sinking.
//
// THE AVALANCHE (Snowy Peaks, v190): once, on his LAST lap. As he comes within `lead` s of it, a wave of snow
// slides down the mountain to the road and heaps a soft drift across it, whole by the time he gets there. The
// drift is never a wall: every car in it, his and theirs, goes at `drag` of its speed and throws snow, and is
// through in about a second (rceDrag, race.js's speed). It stays for the rest of the race.
//
// THE SKI JUMP (Snowy Peaks, v190): a jump section with `ski` is dressed as one -- blue-and-white boards up its
// face, a flag each side of the lip -- and its own `vy` lets it throw a car higher than a dune (race.js rcVertical).
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
    const v = rce.venues[def.id] = { def, T, boulders: null, train: null, av: null };
    for (const ev of def.events) {
      if (ev.kind === "boulders" || ev.kind === "snowballs") { v.boulders = rceBuildBoulders(T, ev); rceStatic(def.id, "rceHeap", v.boulders.heap); }
      if (ev.kind === "avalanche") { v.av = rceBuildAvalanche(T, ev); rceStatic(def.id, "rceAvSign", v.av.sign); }
      if (ev.kind === "train" && def.rail) { v.train = rceBuildTrain(T, def.rail); rceStatic(def.id, "rceRail", v.train.still); }
    }
    def.sections.forEach((sc, k) => { if (sc.jump && sc.jump.ski) rceStatic(def.id, "rceSki" + k, rceBuildSki(T, def, k)); });
  }
}

// static boxes merged, one mesh per colour (a sleeper each was 305 draw calls: frame_budget_checks)
function rceMerged(specs) {
  const g = new THREE.Group(), by = new Map();
  for (const b of specs) { if (!by.has(b.c)) by.set(b.c, []); by.get(b.c).push(b); }
  for (const [c, list] of by) g.add(new THREE.Mesh(mergeBoxes(list), new THREE.MeshLambertMaterial({ color: c })));
  return g;
}
// what stands still joins its venue: counted as the venue's (frame_budget_checks) and taken off the camera
// past the fog by race.js's cull, which was prepared before these were built
function rceStatic(id, key, o) {
  const v = race.venues[id];
  if (!v || !race.cull) return;
  v[key] = o;
  o.updateWorldMatrix(true, true);
  o.traverse(m => { if ((m.isMesh || m.isPoints) && m.material && m.material.fog !== false) race.cull.push({ m, box: new THREE.Box3().setFromObject(m) }); });
}

// what each roller is called in `flags` (the dunes' names are v189's)
const RCE_FLAGS = { boulders: ["raceBoulders", "raceBoulderHits", "raceBoulderRivalHits"], snowballs: ["raceSnowballs", "raceSnowballHits", "raceSnowballRivalHits"] };
function rceBuildBoulders(T, ev) {
  const B = RCE[ev.kind], g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(B.r, B.detail || 1);   // (a snowball rounder than a rock: faceted, it read as one)
  const mat = new THREE.MeshLambertMaterial({ color: B.colour, emissive: B.glow || 0, flatShading: true });   // (snow lit a little from inside: in shade it read as rock)
  const rocks = [];
  for (let i = 0; i < B.n * 2; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; m.castShadow = true; m.userData.noSolid = true; g.add(m); rocks.push({ m, on: false }); }
  // the slope they come off: a heap of the same rocks, still, on the side they roll from
  const side = ev.side, W = RC.width / 2 + RC.kerbW, heap = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const s = ev.m - 10 + k * (B.spread * (B.n - 1) + 20) / 6, lat = side * (W + 9 + (k % 3) * 3);
    rcPointOn(T, s, lat, rceP);
    const m = new THREE.Mesh(geo, mat);
    const sc = 1.1 + (k % 3) * 0.35;
    m.scale.set(sc, sc * 0.8, sc); m.position.set(rceP.x, terrainEff(rceP.x, rceP.z) + B.r * sc * 0.5, rceP.z); m.rotation.set(k, k * 2, 0);
    m.userData.noSolid = true; heap.add(m);
  }
  // the sign: a yellow triangle on a post, a rock falling on it -- no words
  rcPointOn(T, ev.m - B.sign, side * (W + 3 + 1.2 * B.signK), rceP);   // (clear of the barrier, however big)
  const sign = rceSign(rceP, rcAtOn(T, ev.m - B.sign), B.colour, B.signK);
  heap.add(sign); g.add(heap);
  scene.add(g);
  return { ev, E: B, flag: RCE_FLAGS[ev.kind], g, heap, rocks, released: -1 };
}
// a warning sign: a post, a yellow triangle with a dark edge, and what is coming on it (a rock, a snowball)
function rceSign(p, q, col, k) {
  const g = new THREE.Group(), P = TUNE.palette;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), new THREE.MeshLambertMaterial({ color: P.steel }));
  post.position.y = 1.6; g.add(post);
  const tri = (r, col, z) => { const sh = new THREE.Shape(); sh.moveTo(0, r); sh.lineTo(-r * 0.87, -r * 0.5); sh.lineTo(r * 0.87, -r * 0.5); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(0, 3.6, z); return m; };
  g.add(tri(1.3, P.ink, 0.01), tri(1.05, P.warning, 0.03));
  const rock = new THREE.Mesh(new THREE.CircleGeometry(0.35, 7), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
  rock.position.set(0.1, 3.45, 0.05); g.add(rock);
  if (col === P.white) { const rim = new THREE.Mesh(new THREE.CircleGeometry(0.43, 9), new THREE.MeshBasicMaterial({ color: P.ink, side: THREE.DoubleSide })); rim.position.set(0.1, 3.45, 0.04); g.add(rim); }   // (white on yellow needs an edge)
  g.scale.setScalar(k);   // (big: from 200 m back it has to read)
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
  const still = new THREE.Group(); g.add(still);   // (everything that never moves: `boxes`, merged at the end)
  // the bridge: open beams along the road across the opening (the road's surface stops there, race.js), so the
  // train shows between them as he flies over; a wall each side of the rail
  const W = RC.width / 2 + RC.kerbW, deckY = q.gy, D = C.deck;
  for (let k = 0; k < D.beams; k++) boxes.push({ x: crossX - W + D.w / 2 + k * (W * 2 - D.w) / (D.beams - 1), y: deckY - D.drop - D.h / 2, z: R.z, w: D.w, h: D.h, d: R.gap * 2 + 1.2, c: P.concrete });
  solidBox3(crossX, deckY - 0.9, R.z, [1, 0, 0], [0, 1, 0], [0, 0, 1], W + 0.5, 0.7, R.gap + 0.5, "bridge");
  for (const sd of [-1, 1]) {
    boxes.push({ x: crossX, y: (deckY + y) / 2, z: R.z + sd * (R.gap + 0.6), w: W * 2 + 4, h: deckY - y, d: 1.2, c: P.concrete });
    solidBox3(crossX, (deckY + y) / 2, R.z + sd * (R.gap + 0.6), [1, 0, 0], [0, 1, 0], [0, 0, 1], W + 2, (deckY - y) / 2, 0.6, "bridge");
  }
  // a shed at each end, open toward the line
  const S = C.shed, sheds = [];
  for (const [x, dir] of [[R.x0 - S.len / 2 + 6, 1], [R.x1 + S.len / 2 - 6, -1]]) {
    const roofY = terrainEff(x, R.z), by = Math.min(y, roofY);
    for (const sd of [-1, 1]) boxes.push({ x, y: by + S.h / 2, z: R.z + sd * S.w / 2, w: S.len, h: S.h, d: 0.6, c: P.rust });
    boxes.push({ x: x - dir * S.len / 2, y: by + S.h / 2, z: R.z, w: 0.6, h: S.h, d: S.w, c: P.rust });
    boxes.push({ x, y: by + S.h, z: R.z, w: S.len + 1, h: 0.6, d: S.w + 1.2, c: P.slate });
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(S.w - 1, S.h - 1), new THREE.MeshBasicMaterial({ color: P.ink })); dark.position.set(x - dir * (S.len / 2 - 0.4), by + S.h / 2, R.z); dark.rotation.y = dir * Math.PI / 2; still.add(dark);
    addSolidBox(x, Math.min(y, roofY), R.z, S.len / 2, S.w / 2, Math.min(y, roofY) + S.h, null, "building");
    sheds.push({ x, dir });
  }
  // booms and lamps at the cutting's edges, beside the road on the dune, each edge and each side: a post
  // with two lamps, and a red-and-white arm that drops level along the edge, outward from the road
  const booms = [], lamps = [];
  for (const ez of [-1, 1]) for (const sd of [-1, 1]) {
    const bx = crossX + sd * (W + 1.2), bz = R.z + ez * (R.gap + 1.2), base = deckY - 0.5;
    boxes.push({ x: bx, y: base + 1.5, z: bz, w: 0.4, h: 3, d: 0.4, c: P.white });
    const pivot = new THREE.Group(); pivot.position.set(bx, base + C.boom.h, bz);
    const segs = []; for (let k = 0; k < 6; k++) segs.push({ x: sd * (0.75 + k * 1.5), y: 0, z: 0, w: 1.5, h: 0.28, d: 0.28, c: k % 2 ? P.white : P.red });
    pivot.add(rceMerged(segs));
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
  train.visible = false;                              // (drawn only in a race here: rceStart)
  still.add(rceMerged(boxes));
  g.add(train);
  g.traverse(o => { o.userData.noSolid = true; });   // (what is solid here is registered above, by hand)
  scene.add(g);
  const len = C.engLen + C.cars * (C.carLen + 0.8);
  const tr = { R, g, still, train, len, crossX, crossS, deckY, booms, lamps, sheds,
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
  if (v.av) rceAvOff(v.av);
  if (v.train) { const tr = v.train; tr.state = "shed"; tr.lap = -1; tr.v = 0; tr.passedHim = false; tr.train.visible = true; }
}
function rceReset() {
  for (const id in rce.venues) {
    const v = rce.venues[id];
    if (v.boulders) for (const b of v.boulders.rocks) { b.on = false; b.m.visible = false; }
    if (v.av) rceAvOff(v.av);
    if (v.train) { const tr = v.train; if (tr.state !== "shed") { tr.state = "shed"; tr.v = 0; tr.x = tr.dir > 0 ? tr.sheds[1].x : tr.sheds[0].x; tr.dir = -tr.dir; } tr.boomA = 0; tr.train.visible = false; rcePoseTrain(tr); rceBooms(tr, 0); for (const l of tr.lamps) l.material.color.setHex(TUNE.palette.ink); }
  }
  rce.cur = null;
}

function rceUpdate(dt, going) {
  const v = rce.cur;
  if (!v || !race.him) return;
  if (v.boulders) rceBoulders(v.boulders, dt, going);
  if (v.train) rceTrain(v.train, dt, going);
  if (v.av) rceAvalanche(v.av, dt, going);
}

// ---- boulders ------------------------------------------------------------------------------------------
function rceBoulders(B, dt, going) {
  const E = B.E, him = race.him, L = race.track.len, W = RC.width / 2;
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
      Object.assign(b, { on: true, s, target, lat: B.ev.side * (W + E.v * Math.max(0, eta - roadT)), t: 0, roll: 0, sink: 0, rr: E.r0 || E.r, hit: new Set() });
      if (Math.abs(b.lat) > Math.abs(lat0)) b.lat = lat0;              // (never further up the slope than the heap)
      b.m.visible = true;
    }
    rcThing(B.ev.kind);
    synthBlip("sawtooth", 55, 35, 1.4, 0.18, 0);                        // (the rumble: he hears them coming)
    flags[B.flag[0]] = (flags[B.flag[0]] || 0) + 1;
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
    b.lat -= B.ev.side * vl * dt; b.roll = (b.roll || 0) + vl * dt / b.rr;
    if (E.r0) b.rr = Math.min(E.r, b.rr + E.grow * vl * dt);            // (a snowball picks up snow as it rolls)
    const off = Math.abs(b.lat) > W + 2 && Math.sign(b.lat) !== B.ev.side;
    if (off) b.sink += dt;
    if (b.sink > E.sinkAfter) {
      if (E.burst && going) { rcPoint(b.s, b.lat, rceP); for (let k = 0; k < E.burst; k++) rcPuff(rceP.x + (k % 3 - 1) * b.rr, terrainEff(rceP.x, rceP.z) + b.rr, rceP.z + ((k >> 1) % 3 - 1) * b.rr, E.colour, E.r * 2.2, 3, 1.6, 0.9); }
      b.on = false; b.m.visible = false; continue;
    }
    // a car it meets spins out (one footprint for every car, as a box's catch is)
    if (Math.abs(b.lat) < W + 1) for (const r of race.racers) {
      if (r.path || b.hit.has(r) || (r.air && r.y - rcPoint(r.s, r.lat, rceP).y > b.rr)) continue;
      if (Math.abs(rcGap(r.s, b.s)) < RCI.footL / 2 + b.rr && Math.abs(r.lat - b.lat) < rcItFoot(r) / 2 + b.rr) { b.hit.add(r); rcItHit(r, null); const f = B.flag[r.isHim ? 1 : 2]; flags[f] = (flags[f] || 0) + 1; }
    }
    rcPoint(b.s, b.lat, rceP);
    const onRoad = Math.abs(b.lat) <= W + RC.kerbW;
    const gy = onRoad ? rceP.y : terrainEff(rceP.x, rceP.z);
    b.m.position.set(rceP.x, gy + b.rr - b.sink * 1.2, rceP.z);
    b.m.scale.setScalar(b.rr / E.r);
    b.m.rotation.set(b.roll * B.ev.side, 0, 0);
    if (going && ((b.t * 6) | 0) !== (((b.t - dt) * 6) | 0) && Math.abs(rcGap(b.s, race.him.s)) < RC.spray.near) rcPuff(rceP.x, gy + 0.3, rceP.z, E.dust, 0.5 * b.rr / 1.7, 1.2, 0.6, 0.7);
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

// ---- the avalanche ---------------------------------------------------------------------------------------
function rceBuildAvalanche(T, ev) {
  const A = RCE.avalanche, P = TUNE.palette, W = RC.width / 2 + RC.kerbW, g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: A.colour, flatShading: true });   // (unlit from inside: its shadow side is what shows it on the snow)
  // the wave: lumps along the road's line, which slide down to it together, each on the ground under it
  const geo = new THREE.IcosahedronGeometry(1, 1), lumps = [];
  for (let k = 0; k < A.lumps; k++) {
    const m = new THREE.Mesh(geo, mat); m.visible = false; m.castShadow = true;
    const u = k / (A.lumps - 1) - 0.5, sc = A.lumpR * (0.75 + 0.5 * ((k * 7) % 5) / 4);
    m.scale.set(sc * 1.4, sc, sc); m.rotation.set(k, k * 3, 0);
    g.add(m); lumps.push({ m, ds: u * A.len * 1.3, back: ((k * 5) % 3) * A.lumpR * 0.8, sc });
  }
  // the drift: a soft heap across the whole road, `len` m along and `h` high in the middle, laid on the deck
  const NS = 28, NL = 12, pos = [], idx = [];
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NL; j++) {
    const u = i / NS, w = j / NL, s = ev.m + (u - 0.5) * A.len, lat = (w - 0.5) * 2 * (W + 0.6);
    rcPointOn(T, s, lat, rceP);
    const hump = Math.sin(Math.PI * u) * (0.75 + 0.25 * Math.cos(w * 9 + u * 5)) * Math.min(1, Math.sin(Math.PI * w) * 3);
    pos.push(rceP.x, rceP.y + 0.05 + A.h * hump, rceP.z);
    if (i < NS && j < NL) { const a = i * (NL + 1) + j, b = a + NL + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); dg.setIndex(idx); dg.computeVertexNormals();
  const drift = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ color: A.colour, side: THREE.DoubleSide, flatShading: true }));   // (faceted: its humps show on the white road)
  drift.visible = false; drift.receiveShadow = true;
  g.add(drift);
  // its sign: the same warning triangle, a snowball on it, before it on the mountain's side
  rcPointOn(T, ev.m - A.sign, ev.side * (W + 3 + 1.2 * RCE.snowballs.signK), rceP);
  const sign = rceSign(rceP, rcAtOn(T, ev.m - A.sign), P.white, RCE.snowballs.signK);
  g.add(sign);
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return { ev, g, lumps, drift, sign, state: "wait", lat: 0, grow: 0, t: 0, eta: 0, puffT: 0 };
}
function rceAvOff(av) { av.state = "wait"; av.grow = 0; av.drift.visible = false; for (const l of av.lumps) l.m.visible = false; }
function rceAvalanche(av, dt, going) {
  const A = RCE.avalanche, him = race.him, L = race.track.len, W = RC.width / 2 + RC.kerbW, side = av.ev.side;
  const ahead = rcAhead(av.ev.m - A.len / 2, him.s), lap = Math.floor((him.s + ahead) / L);
  // once, on his last lap: let go `lead` s before he gets there, timed to have its drift whole `before` s ahead of him
  if (av.state === "wait" && going && lap === RC.laps - 1 && ahead < A.lead * Math.max(him.v, 20) && !him.done) {
    av.state = "slide"; av.t = 0; av.lat = side * (W + A.from); av.grow = 0;
    av.eta = Math.max(1.5, ahead / Math.max(him.v, 20) - A.before);
    for (const l of av.lumps) l.m.visible = true;
    rcThing("avalanche"); flags.raceAvalanche = (flags.raceAvalanche || 0) + 1;
    synthBlip("sawtooth", 48, 28, 2.6, 0.24, 0); synthBlip("sine", 70, 40, 2.2, 0.2, 0.3);   // (the roar, under everything)
  }
  if (av.state === "wait") return;
  av.t += dt;
  if (av.state === "slide") {
    // down the mountain to the road's edge in the first `slideK` of the time, then it heaps up over the road
    const k = Math.min(1, av.t / (av.eta * A.slideK));
    av.lat = side * (W + A.from * (1 - k * k));
    if (k >= 1) { av.state = "heap"; av.t = 0; av.drift.visible = true; }
  } else if (av.state === "heap") {
    av.grow = Math.min(1, av.t / (av.eta * (1 - A.slideK)));
    av.lat = side * W * (1 - av.grow);
    if (av.grow >= 1) { av.state = "lie"; for (const l of av.lumps) l.m.visible = false; }
  }
  av.drift.position.y = -A.h * 1.2 * (1 - av.grow);     // (it rises out of the road: under the deck it is unseen)
  for (const l of av.lumps) {
    if (!l.m.visible) continue;
    const lat = av.lat + side * l.back;
    rcPoint(av.ev.m + l.ds, lat, rceP);
    const gy = Math.abs(lat) <= W ? rceP.y : terrainEff(rceP.x, rceP.z);
    const shrink = av.state === "heap" ? 1 - av.grow * 0.85 : 1;
    l.m.position.set(rceP.x, gy + l.sc * 0.5 * shrink, rceP.z); l.m.scale.y = l.sc * shrink;
  }
  // the cloud along its front, so it is seen coming from far off
  av.puffT -= dt;
  if (going && av.state === "slide" && av.puffT <= 0) {   // (only while it slides: heaped, a cloud over the road would hide what is ahead, and fill the shared pool)
    av.puffT = A.puffEvery;
    for (let k = 0; k < 3; k++) {
      const ds = ((av.t * 37 + k * 0.37) % 1 - 0.5) * A.len * 1.3;
      rcPoint(av.ev.m + ds, av.lat, rceP);
      rcPuff(rceP.x, terrainEff(rceP.x, rceP.z) + A.lumpR, rceP.z, k ? TUNE.palette.white : A.cloud, A.puffSize, 4, 2.2, 0.9);   // (one in three grey-blue: white on white is lost)
    }
  }
  // a car ploughing through throws snow
  if (going && av.grow >= 0.5 && ((race.t * 8) | 0) !== (((race.t - dt) * 8) | 0))
    for (const r of race.racers) if (rceDrag(r) < 1 && Math.abs(rcGap(r.s, him.s)) < RC.spray.near) {
      rcPoint(r.s, r.lat, rceP); rcPuff(rceP.x, rceP.y + 1, rceP.z, TUNE.palette.white, A.plough, 3, 1.2, 0.9);
      if (r.isHim) flags.raceDriftT = (flags.raceDriftT || 0) + 1 / 8;
    }
}
// what a car in the drift keeps of its speed: `drag` in it, all of it everywhere else (race.js, his and theirs)
function rceDrag(r) {
  const v = rce.cur;
  if (!v || !v.av || v.av.grow < 0.5 || r.air || r.path) return 1;
  return Math.abs(rcGap(r.s, v.av.ev.m)) < RCE.avalanche.len / 2 ? RCE.avalanche.drag : 1;
}

// ---- the ski jump's dressing -------------------------------------------------------------------------------
function rceBuildSki(T, def, k) {
  const K = RCE.ski, P = TUNE.palette, sc = def.sections[k], J = sc.jump, W = RC.width / 2 + RC.kerbW;
  let from = null; for (const q of T.S) if (q.sec === k) { from = q.s; break; }
  const crest = from + J.at * sc.len, boxes = [], g = new THREE.Group();
  // boards up the face each side, blue and white, standing on the deck's edge: the face is a ski jump's in-run
  for (let u = -J.up, i = 0; u < 0; u += K.board, i++) {
    const s = crest + u + K.board / 2, a = rcAtOn(T, s);
    for (const sd of [-1, 1]) {
      rcPointOn(T, s, sd * (W + 0.3), rceP);
      boxes.push({ x: rceP.x, y: rceP.y + K.boardH / 2, z: rceP.z, w: 0.3, h: K.boardH, d: K.board * 0.98, ry: Math.atan2(a.tx, a.tz), c: i % 2 ? P.white : P.blue });
    }
  }
  // the lip: a flag on a pole each side, the kind that stands at the top of a real one
  const a = rcAtOn(T, crest);
  for (const sd of [-1, 1]) {
    rcPointOn(T, crest, sd * (W + 1.2), rceP);
    boxes.push({ x: rceP.x, y: rceP.y + K.pole / 2, z: rceP.z, w: 0.25, h: K.pole, d: 0.25, c: P.white });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(K.flag, -K.flag * 0.35); sh.lineTo(0, -K.flag * 0.7); sh.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: sd > 0 ? P.red : P.blue, side: THREE.DoubleSide }));
    f.position.set(rceP.x, rceP.y + K.pole, rceP.z); f.rotation.y = Math.atan2(a.tx, a.tz) + Math.PI / 2; g.add(f);
  }
  g.add(rceMerged(boxes));
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return g;
}

{ const s0 = vkSeed; try { vkQuiet(0, rceBuild); } finally { vkSeed = s0; } }
