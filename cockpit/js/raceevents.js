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
//
// THE WAVES (Beach Splash, v191): up the sand and over the road from the sea's side as he comes, each reaching
// its own way across and never the inland lane; a car in one is slowed, as on a splash, and throws spray.
//
// THE WATER-CANNON SHIP (Beach Splash, v191): at anchor in the lagoon, no one aboard. While he is on the water it
// lobs balls of water ahead of him; an orange ring marks each landing spot from the moment it fires, and a car under
// it when it lands spins out (never a bang). He steers off the ring.
//
// THE BOOST RINGS (Sky Glow Road, v192): glowing hoops over the road, spinning and swaying across the lanes; through
// one, a pad's boost. Aimed at.
//
// THE GUSTS (Sky Glow Road, v192): stretches where the wind blows across, announced by streaks flying over the road
// before it pushes; every car in it is pushed sideways, and he holds his line by steering into it (rceWind, race.js).
// The barrier holds anyone it pushes all the way: a glide, never a bang.
// ---------------------------------------------------------------------------
const RCE = TUNE.race.events;
const rceP = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
const rceV = new THREE.Vector3();
const rce = { venues: {}, cur: null, quiet: false };

// ---- built once, at load, for every track that has events ---------------------------------------
function rceBuild() {
  for (const def of RC.tracks) {
    const T = race.venues[def.id] && race.venues[def.id].track;
    if (!T) continue;
    // a ski jump or a stunt ramp is dressed on any track (v193: the oval's has no events, and stood bare)
    def.sections.forEach((sc, k) => { if (sc.jump && sc.jump.ski) rceStatic(def.id, "rceSki" + k, rceBuildSki(T, def, k)); });
    if (!def.events) continue;
    const v = rce.venues[def.id] = { def, T, boulders: null, train: null, av: null, waves: null, ship: null, rings: null, wind: null };
    for (const ev of def.events) {
      if (ev.kind === "boulders" || ev.kind === "snowballs") { v.boulders = rceBuildBoulders(T, ev); rceStatic(def.id, "rceHeap", v.boulders.heap); }
      if (ev.kind === "waves") v.waves = rceBuildWaves(T, ev);
      if (ev.kind === "ship") v.ship = rceBuildShip(T, ev);
      if (ev.kind === "rings") v.rings = rceBuildRings(T, ev);
      if (ev.kind === "wind") v.wind = rceBuildWind(T, ev);
      if (ev.kind === "avalanche") { v.av = rceBuildAvalanche(T, ev); rceStatic(def.id, "rceAvSign", v.av.sign); }
      if (ev.kind === "train" && def.rail) { v.train = rceBuildTrain(T, def.rail); rceStatic(def.id, "rceRail", v.train.still); }
    }
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
  for (const L of race.track.loops || []) L.told = undefined;     // (v193)
  const v = rce.venues[race.track.def.id];
  rce.cur = v || null;
  if (!v) return;
  if (v.boulders) { v.boulders.released = -1; for (const b of v.boulders.rocks) { b.on = false; b.m.visible = false; } }
  if (v.av) rceAvOff(v.av);
  if (v.waves) rceWavesOff(v.waves);
  if (v.ship) rceShipOff(v.ship);
  if (v.rings) rceRingsOff(v.rings);
  if (v.wind) rceWindOff(v.wind);
  if (v.train) { const tr = v.train; tr.state = "shed"; tr.lap = -1; tr.v = 0; tr.passedHim = false; tr.train.visible = true; }
}
function rceReset() {
  for (const id in rce.venues) {
    const v = rce.venues[id];
    if (v.boulders) for (const b of v.boulders.rocks) { b.on = false; b.m.visible = false; }
    if (v.av) rceAvOff(v.av);
    if (v.waves) rceWavesOff(v.waves);
    if (v.ship) rceShipOff(v.ship);
    if (v.rings) rceRingsOff(v.rings);
    if (v.wind) rceWindOff(v.wind);
    if (v.train) { const tr = v.train; if (tr.state !== "shed") { tr.state = "shed"; tr.v = 0; tr.x = tr.dir > 0 ? tr.sheds[1].x : tr.sheds[0].x; tr.dir = -tr.dir; } tr.boomA = 0; tr.train.visible = false; rcePoseTrain(tr); rceBooms(tr, 0); for (const l of tr.lamps) l.material.color.setHex(TUNE.palette.ink); }
  }
  rce.cur = null;
}

// (v193) over the top of a loop, upside down: a thing he did, once a loop a lap (race.js lays the loop)
function rceLoopWatch(going) {
  const T = race.track, him = race.him;
  if (!going || !T.loops || !him || him.path) return;
  for (const L of T.loops) {
    const top = (L.a + L.b) / 2, d = rcGap(him.s, top), lap = Math.floor((him.s - top + T.len / 2) / T.len);
    if (d >= 0 && d < 20 && L.told !== lap) { L.told = lap; rcThing("loop"); flags.raceLoops = (flags.raceLoops || 0) + 1; synthBlip("triangle", 520, 1040, 0.5, 0.12, 0); }
  }
}
function rceUpdate(dt, going) {
  if (race.him && !rce.quiet) rceLoopWatch(going);
  const v = rce.cur;
  if (!v || !race.him || rce.quiet) return;   // (quiet: a check of the track alone, race_track_checks c and the splash)
  if (v.boulders) rceBoulders(v.boulders, dt, going);
  if (v.train) rceTrain(v.train, dt, going);
  if (v.av) rceAvalanche(v.av, dt, going);
  if (v.waves) rceWaves(v.waves, dt, going);
  if (v.ship) rceShip(v.ship, dt, going);
  if (v.rings) rceRings(v.rings, dt, going);
  if (v.wind) rceWindUpdate(v.wind, dt, going);
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
// what a car keeps of its speed: in the drift or a wave, its `drag`; all of it everywhere else (race.js, his and theirs)
function rceDrag(r) {
  const v = rce.cur;
  if (!v || r.air || r.path) return 1;
  if (v.waves) for (const w of v.waves.waves) if (rceInWave(w, r)) return RCE.waves.drag;     // (v191) in a wave
  if (!v.av || v.av.grow < 0.5) return 1;
  return Math.abs(rcGap(r.s, v.av.ev.m)) < RCE.avalanche.len / 2 ? RCE.avalanche.drag : 1;
}

// ---- the waves (v191) --------------------------------------------------------------------------------------
// Fixed places along the beach; each comes up the sand over the road from the sea's side as he nears it, holds,
// and runs back. It reaches `reach` of the way across (a different reach each), never the inland lane: the dry
// line is his to steer for. A car in the water keeps `drag` of its speed and throws spray, as on a splash.
function rceBuildWaves(T, ev) {
  const E = RCE.waves, P = TUNE.palette, W = RC.width / 2 + RC.kerbW, g = new THREE.Group(), waves = [];
  const NS = 14, NL = 8;
  for (let k = 0; k < E.n; k++) {
    const m = ev.m + k * E.spacing, pos = new Float32Array((NS + 1) * (NL + 1) * 3), idx = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < NL; j++) { const a = i * (NL + 1) + j, b = a + NL + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const sheet = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: P.cyan, transparent: true, opacity: E.opacity, side: THREE.DoubleSide, depthWrite: false }));
    sheet.frustumCulled = false; sheet.visible = false; sheet.renderOrder = 1;
    const fpos = new Float32Array((NS + 1) * 2 * 3), fidx = [];
    for (let i = 0; i < NS; i++) { const a = i * 2; fidx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3)); fgeo.setIndex(fidx);
    const foam = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ color: P.white, side: THREE.DoubleSide }));
    foam.frustumCulled = false; foam.visible = false; foam.renderOrder = 2;
    g.add(sheet, foam);
    waves.push({ m, reach: E.reach[k % E.reach.length], sheet, foam, NS, NL, lap: -1, t: -1, edge: ev.side * (W + E.out), told: -1 });
  }
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return { ev, g, waves };
}
function rceWavesOff(B) { for (const w of B.waves) { w.t = -1; w.lap = -1; w.told = -1; w.sheet.visible = w.foam.visible = false; } }
// how far up it is: 0 out on the sand past the road's edge, 1 at its reach
function rceWaveK(w) {
  const E = RCE.waves;
  if (w.t < 0) return 0;
  if (w.t < E.rise) { const k = w.t / E.rise; return k * k * (3 - 2 * k); }
  if (w.t < E.rise + E.stay) return 1;
  const k = 1 - (w.t - E.rise - E.stay) / E.fall; return k <= 0 ? 0 : k * k * (3 - 2 * k);
}
function rceWaves(B, dt, going) {
  const E = RCE.waves, him = race.him, L = race.track.len, W = RC.width / 2 + RC.kerbW, side = B.ev.side;
  for (const w of B.waves) {
    const ahead = rcAhead(w.m, him.s), lap = Math.floor((him.s + ahead) / L);
    // up as he comes within `lead` s of it, once a lap
    if (going && w.t < 0 && lap > w.lap && ahead < E.lead * Math.max(him.v, 20) && !him.done) {
      w.lap = lap; w.t = 0;
      synthBlip("sawtooth", 140, 60, 1.3, 0.1, 0);                     // (its rush, coming up the sand)
      flags.raceWaves = (flags.raceWaves || 0) + 1;
    }
    if (w.t < 0) continue;
    w.t += dt;
    const k = rceWaveK(w);
    if (w.t > E.rise + E.stay + E.fall) { w.t = -1; w.sheet.visible = w.foam.visible = false; continue; }
    const out = side * (W + E.out), reachLat = side * W - side * w.reach * 2 * W;
    w.edge = out + (reachLat - out) * k;
    // the water: from out on the sand to its edge, `len` along, a hand's depth over the deck; the foam its edge
    const sp = w.sheet.geometry.attributes.position.array, fp = w.foam.geometry.attributes.position.array;
    for (let i = 0; i <= w.NS; i++) {
      const s = w.m + (i / w.NS - 0.5) * E.len * (1 - 0.25 * Math.abs(i / w.NS - 0.5) * 2 * (1 - k));
      const bow = Math.sin(Math.PI * i / w.NS) * E.bow * k;              // (its edge bowed: furthest up in the middle)
      const edge = w.edge - side * bow;
      for (let j = 0; j <= w.NL; j++) {
        rcPoint(s, out + (edge - out) * (j / w.NL), rceP);
        const o = (i * (w.NL + 1) + j) * 3; sp[o] = rceP.x; sp[o + 1] = rceP.y + E.up; sp[o + 2] = rceP.z;
      }
      for (let j = 0; j < 2; j++) {
        rcPoint(s, edge + side * j * E.foam, rceP);
        const o = (i * 2 + j) * 3; fp[o] = rceP.x; fp[o + 1] = rceP.y + E.up + 0.03; fp[o + 2] = rceP.z;
      }
    }
    w.sheet.geometry.attributes.position.needsUpdate = w.foam.geometry.attributes.position.needsUpdate = true;
    w.sheet.visible = w.foam.visible = k > 0.01;
    // he sees it wash over the road ahead of him: a thing, once a wave
    if (going && k > 0.5 && w.told !== w.lap && Math.abs(rcGap(w.m, him.s)) < E.tell) { w.told = w.lap; rcThing("wave"); }
    // a car in it throws spray (the ones near the camera)
    if (going && ((race.t * 10) | 0) !== (((race.t - dt) * 10) | 0))
      for (const r of race.racers) if (rceInWave(w, r) && Math.abs(rcGap(r.s, him.s)) < RC.spray.near) {
        rcPoint(r.s, r.lat, rceP); rcPuff(rceP.x, rceP.y + 0.5, rceP.z, ((race.t * 10) | 0) % 2 ? TUNE.palette.white : TUNE.palette.cyan, E.spray, 3, 0.8, 0.95);
        if (r.isHim) flags.raceWaveT = (flags.raceWaveT || 0) + 0.1;
      }
  }
}
function rceInWave(w, r) {
  if (w.t < 0 || r.air || r.path) return false;
  const side = rce.cur.waves.ev.side, d = rcGap(r.s, w.m);
  return Math.abs(d) < RCE.waves.len / 2 && (r.lat - rceWaveEdge(w, d)) * side > 0;
}
// its edge `d` m along from its middle, as drawn: bowed furthest up the road in the middle (the dry line he sees is
// the one that counts)
function rceWaveEdge(w, d) { const side = rce.cur.waves.ev.side; return w.edge - side * Math.sin(Math.PI * (d / RCE.waves.len + 0.5)) * RCE.waves.bow * rceWaveK(w); }

// ---- the water-cannon ship (v191) -------------------------------------------------------------------------
// A wooden ship at anchor in the lagoon, beside the splash: no one on it -- a machine. While he is on the water
// it lobs a ball of water every `every` s, to land `flight` s later where a car will be -- him or the rival nearest
// ahead of him; an orange ring
// on the water marks the spot from the moment it fires. A car under it when it lands spins out, as an item does
// (rcItHit: never a bang). One shot in `aimEvery` is aimed at his lane; the others at a lane by turns.
function rceBuildShip(T, ev) {
  const S = RCE.ship, P = TUNE.palette, g = new THREE.Group();
  rcPointOn(T, ev.m, ev.side * S.lat, rceP);
  const a = rcAtOn(T, ev.m), hd = Math.atan2(a.tx, a.tz), sea = seaLevelAt(rceP.x, rceP.z);
  const ship = new THREE.Group(), boxes = [];
  // the hull: a long box, a raised deck at each end, a stripe; then masts, yards and sails, all along local z
  boxes.push({ x: 0, y: 1.2, z: 0, w: S.beam, h: 2.4, d: S.len, c: P.rust });
  boxes.push({ x: 0, y: 2.6, z: -S.len * 0.38, w: S.beam, h: 1.6, d: S.len * 0.24, c: P.rust });
  boxes.push({ x: 0, y: 2.6, z: S.len * 0.4, w: S.beam * 0.8, h: 1.2, d: S.len * 0.16, c: P.rust });
  boxes.push({ x: 0, y: 2.0, z: 0, w: S.beam + 0.1, h: 0.35, d: S.len * 0.98, c: P.gold });
  for (const mz of S.masts) {
    boxes.push({ x: 0, y: 2.4 + S.mastH / 2, z: mz * S.len, w: 0.45, h: S.mastH, d: 0.45, c: P.grey });
    boxes.push({ x: 0, y: 2.4 + S.mastH * 0.82, z: mz * S.len, w: S.sailW + 1, h: 0.3, d: 0.3, c: P.grey });
  }
  // the cannons: three dark tubes along the side toward the road, each a box out of the hull
  const guns = [];
  for (let k = 0; k < 3; k++) {
    const gz = (k - 1) * S.len * 0.22;
    boxes.push({ x: -ev.side * (S.beam / 2 + 0.5), y: 1.9, z: gz, w: 1.6, h: 0.6, d: 0.6, c: P.slate });
    guns.push(gz);
  }
  ship.add(rceMerged(boxes));
  const sailM = new THREE.MeshLambertMaterial({ color: P.white, emissive: P.grey, side: THREE.DoubleSide });   // (lit from inside: seen from behind they were black)
  for (const mz of S.masts) {
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(S.sailW, S.mastH * 0.6), sailM);
    sail.position.set(0, 2.4 + S.mastH * 0.5, mz * S.len + 0.3); ship.add(sail);
  }
  // a striped flag on the tallest mast, red and white
  const flag = new THREE.Group();
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(S.flag, S.flag * 0.22), new THREE.MeshBasicMaterial({ color: k % 2 ? P.white : P.red, side: THREE.DoubleSide })); f.position.set(0, -k * S.flag * 0.22, -S.flag / 2); f.rotation.y = Math.PI / 2; flag.add(f); }
  flag.position.set(0, 2.4 + S.mastH + 0.2, S.masts[0] * S.len); ship.add(flag);
  ship.position.set(rceP.x, sea, rceP.z); ship.rotation.y = hd;
  g.add(ship);
  // the shots: a ball of water and the ring that marks where it lands, pooled
  const shots = [];
  const ballGeo = new THREE.IcosahedronGeometry(S.ballR, 1), ballM = new THREE.MeshLambertMaterial({ color: P.cyan, emissive: 0x1e5a66, flatShading: true });
  // the mark: a thick red rim round a see-through red disc on the road, and a glowing beam standing up out of it,
  // so it is seen from far off and over the bonnet (a thin dull ring read as a stain, and hid behind the pillar)
  const ringGeo = new THREE.RingGeometry(S.ringR - S.ringW, S.ringR, 28); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(S.ringR - S.ringW, 28); discGeo.rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(S.beamR, S.beamR, S.beamH, 10, 1, true); beamGeo.translate(0, S.beamH / 2, 0);
  for (let k = 0; k < S.pool; k++) {
    const ball = new THREE.Mesh(ballGeo, ballM); ball.visible = false;
    const ring = new THREE.Group();
    const rim = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: P.red, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: P.red, side: THREE.DoubleSide, transparent: true, opacity: S.discA, depthWrite: false }));
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: P.fire, transparent: true, opacity: S.beamA, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(rim, disc, beam); ring.visible = false; ring.renderOrder = 3; ring.traverse(o => { o.renderOrder = 3; });
    g.add(ball, ring); shots.push({ ball, ring, rim, beam, on: false });
  }
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return { ev, g, ship, guns, hd, shots, fireT: 0, n: 0, bob: 0 };
}
function rceShipOff(Sh) { Sh.fireT = 0; Sh.n = 0; for (const s of Sh.shots) { s.on = false; s.ball.visible = s.ring.visible = false; } }
function rceShip(Sh, dt, going) {
  const S = RCE.ship, him = race.him, side = Sh.ev.side;
  Sh.bob += dt; Sh.ship.position.y = seaLevelAt(Sh.ship.position.x, Sh.ship.position.z) + Math.sin(Sh.bob * 1.1) * S.bob;
  Sh.ship.rotation.z = Math.sin(Sh.bob * 0.8) * 0.03;
  // fire while he is in the stretch it covers, every `every` s
  const into = rcGap(him.s, Sh.ev.from), zone = Sh.ev.to - Sh.ev.from;
  const inZone = into > -S.early * Math.max(him.v, 20) && into < zone;
  if (going && inZone && !him.done) {
    Sh.fireT -= dt;
    const at = him.s + Math.max(him.v, 15) * S.flight, toEnd = rcGap(at, Sh.ev.to), toStart = rcGap(at, Sh.ev.from);
    if (Sh.fireT <= 0 && toStart > 0 && toEnd < 0) {
      const s = Sh.shots.find(x => !x.on);
      if (s) {
        Sh.fireT = S.every;
        // his lane one shot in `aimEvery`; otherwise the nearest rival ahead of him in sight, where it will be; else a lane
        let lat = S.lanes[Sh.n % S.lanes.length], tgt = at;
        if (Sh.n % S.aimEvery === 0) lat = clamp(him.lat, -S.laneMax, S.laneMax);
        else {
          let best = null;
          for (const r of race.racers) { const d = rcGap(r.s, him.s); if (!r.isHim && d > S.rivalNear[0] && d < S.rivalNear[1] && (!best || d < rcGap(best.s, him.s))) best = r; }
          const bt = best && best.s + Math.max(best.v, 15) * S.flight;
          if (best && rcGap(bt, Sh.ev.to) < 0) { tgt = bt; lat = clamp(best.lat, -S.laneMax, S.laneMax); }   // (inside its stretch only)
        }
        Sh.n++;
        // from the middle gun, to the ring
        const gz = Sh.guns[Sh.n % 3], c = Math.cos(Sh.hd), sn = Math.sin(Sh.hd);
        const gx = -side * (S.beam / 2 + 1.2);
        s.from = { x: Sh.ship.position.x + gx * c + gz * sn, y: Sh.ship.position.y + 2, z: Sh.ship.position.z - gx * sn + gz * c };
        rcPoint(tgt, lat, rceP);
        Object.assign(s, { on: true, t: 0, s: tgt, lat, to: { x: rceP.x, y: rceP.y, z: rceP.z } });
        s.ring.position.set(rceP.x, rceP.y + 0.12, rceP.z); s.ring.visible = s.ball.visible = true;
        for (let q = 0; q < 4; q++) rcPuff(s.from.x + (q - 1.5) * 1.5, s.from.y + (q % 2) * 1.2, s.from.z, q % 2 ? TUNE.palette.white : TUNE.palette.grey, S.muzzle, 1.5, 0.9, 0.95);   // (its puff: he sees which ship -- one small one read as a stray mark in the sky)
        synthBlip("sine", 90, 50, 0.35, 0.22, 0);                                         // (its boom: a deep pop, not a bang)
        flags.raceShots = (flags.raceShots || 0) + 1;
      }
    }
  }
  for (const s of Sh.shots) {
    if (!s.on) continue;
    s.t += dt;
    const k = Math.min(1, s.t / S.flight);
    s.ball.position.set(s.from.x + (s.to.x - s.from.x) * k, s.from.y + (s.to.y - s.from.y) * k + 4 * S.arc * k * (1 - k), s.from.z + (s.to.z - s.from.z) * k);
    s.rim.material.opacity = 0.55 + 0.4 * (((s.t * 6) | 0) % 2);                         // (it blinks: here, here)
    s.beam.visible = Math.hypot(camera.position.x - s.to.x, camera.position.z - s.to.z) > S.beamClear;   // (close to, the beam would wash the screen: the disc says it there)
    if (going && ((s.t * 12) | 0) !== (((s.t - dt) * 12) | 0)) rcPuff(s.ball.position.x, s.ball.position.y, s.ball.position.z, TUNE.palette.white, S.trail, 0.5, S.trailLife, 0.85);   // (its trail across the sky)
    if (k < 1) continue;
    // down: a column of water, and whoever is under it spins
    s.on = false; s.ball.visible = s.ring.visible = false;
    for (let q = 0; q < S.burst; q++) rcPuff(s.to.x + (q % 3 - 1) * 1.2, s.to.y + 1 + q * 0.6, s.to.z + ((q >> 1) % 3 - 1) * 1.2, q % 2 ? TUNE.palette.white : TUNE.palette.cyan, 2.6, 4, 1.1, 0.95);
    synthBlip("sawtooth", 200, 70, 0.5, 0.12, 0);
    if (Math.abs(rcGap(s.s, him.s)) < S.tell) rcThing("cannon");
    for (const r of race.racers) {
      if (r.path || r.air) continue;
      if (Math.abs(rcGap(r.s, s.s)) < RCI.footL / 2 + S.r && Math.abs(r.lat - s.lat) < rcItFoot(r) / 2 + S.r) {
        rcItHit(r, null); const f = r.isHim ? "raceShotHits" : "raceShotRivalHits"; flags[f] = (flags[f] || 0) + 1;
      }
    }
  }
}

// ---- the boost rings (v192) ---------------------------------------------------------------------------------
// Glowing hoops standing over the sky road, spinning, each swaying slowly across the lanes; a car whose body goes
// through one gets a pad's boost (the pads' own `padTime`, times `boost`). Aimed at, never timed: it is wide,
// it is slow, and it is seen from far off. Rivals that happen through them are boosted too.
function rceBuildRings(T, ev) {
  const K = RCE.rings, P = TUNE.palette, g = new THREE.Group(), rings = [];
  const geo = new THREE.TorusGeometry(K.r, K.tube, 8, 32);
  for (let k = 0; k < ev.at.length; k++) {
    const [m, lat] = ev.at[k];
    const ring = new THREE.Group();
    const hoop = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: K.cols[k % K.cols.length] }));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(K.r - K.tube * 1.6, K.tube * 0.45, 6, 32), new THREE.MeshBasicMaterial({ color: P.white }));
    ring.add(hoop, inner);
    g.add(ring);
    rings.push({ m, lat0: lat, lat, ring, phase: k * 1.7, hit: new Set(), lap: -1 });
  }
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return { ev, g, rings, t: 0 };
}
function rceRingsOff(B) { B.t = 0; for (const q of B.rings) { q.hit.clear(); q.lap = -1; } }
function rceRings(B, dt, going) {
  const K = RCE.rings, him = race.him, L = race.track.len;
  B.t += dt;
  for (const q of B.rings) {
    q.lat = clamp(q.lat0 + Math.sin(B.t * K.sway + q.phase) * K.swayA, -K.latMax, K.latMax);
    rcPoint(q.m, q.lat, rceP);
    const a = rcAt(q.m);
    q.ring.position.set(rceP.x, rceP.y + K.up, rceP.z);
    q.ring.rotation.set(0, Math.atan2(a.tx, a.tz), B.t * K.spin);      // (facing down the road, spinning in its own plane)
    // a new lap: everyone may go through it again
    const lap = Math.floor((him.s - q.m + L / 2) / L);
    if (lap !== q.lap) { q.lap = lap; q.hit.clear(); }
    if (!going) continue;
    for (const r of race.racers) {
      if (q.hit.has(r) || r.path) continue;
      const d = rcGap(r.s, q.m);
      if (d < 0 || d > Math.max(1, r.v * dt * 1.5)) continue;          // (just through its plane this frame)
      if (Math.abs(r.lat - q.lat) > K.r - K.tube - rcItFoot(r) * 0.25) continue;   // (its body inside the hoop -- a wide hole)
      if (r.air && r.y - rcPoint(r.s, r.lat, rceP).y > K.up + K.r) continue;
      q.hit.add(r);
      r.padT = RC.padTime * K.boost;
      if (r.isHim) { flags.raceRings = (flags.raceRings || 0) + 1; rcWhoosh(); cameraPunch(0.4); rcThing("ring"); synthBlip("triangle", 660, 1320, 0.3, 0.12, 0); }
      for (let k = 0; k < K.burst; k++) { const a2 = k / K.burst * Math.PI * 2; rcPoint(q.m, q.lat + Math.cos(a2) * K.r, rceP); rcPuff(rceP.x, rceP.y + K.up + Math.sin(a2) * K.r, rceP.z, k % 2 ? TUNE.palette.white : K.cols[0], 1.6, 0.5, 0.5, 0.95); }
    }
  }
}

// ---- the gusts (v192) ---------------------------------------------------------------------------------------
// Stretches of the sky road where the wind blows across: as he comes within `lead` s of one, white streaks start
// flying across the road from the windward side, and `warn` s later the gust pushes every car in the stretch
// sideways at `push` m/s for `dur` s. His steer is faster than it: he holds his line by steering into it. Hands-off
// he drifts to the barrier, which holds him (a glide, never a bang). Once a lap each.
function rceBuildWind(T, ev) {
  const W = RCE.wind, P = TUNE.palette;
  const geo = new THREE.BoxGeometry(W.streakL, W.streakT, W.streakT);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: P.white, transparent: true, opacity: W.streakA, depthWrite: false }), W.streaks);
  mesh.count = 0; mesh.frustumCulled = false; mesh.userData.noSolid = true;
  scene.add(mesh);
  // a windsock at the start of each stretch, on the side the wind comes from, pointing the way it blows: hung limp,
  // it stands out and flaps while the gust is on (white streaks alone read as planks: the sock says WIND)
  const socks = new THREE.Group(), H = RC.width / 2 + RC.kerbW;
  const zones = ev.zones.map(([a, b, dir]) => {
    rcPointOn(T, a, -dir * (H + 2), rceP);
    const q = rcAtOn(T, a), sock = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, W.poleH, 6), new THREE.MeshLambertMaterial({ color: P.white }));
    pole.position.y = W.poleH / 2; sock.add(pole);
    const arm = new THREE.Group(); arm.position.y = W.poleH;
    for (let k = 0; k < 4; k++) {
      const r0 = W.sockR * (1 - k * 0.16), r1 = W.sockR * (1 - (k + 1) * 0.16), seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, W.sockL / 4, 10, 1, true), new THREE.MeshLambertMaterial({ color: k % 2 ? P.white : P.fire, side: THREE.DoubleSide }));
      seg.rotation.z = -Math.PI / 2; seg.position.x = (k + 0.5) * W.sockL / 4; arm.add(seg);
    }
    sock.add(arm);
    sock.position.set(rceP.x, rceP.y, rceP.z);
    // its arm's +x along the road's left (lx, lz) times the way it blows
    sock.rotation.y = Math.atan2(-q.lz * dir, q.lx * dir);
    socks.add(sock);
    return { a, b, dir, t: -1, lap: -1, told: -1, arm };
  });
  socks.traverse(o => { o.userData.noSolid = true; });
  scene.add(socks);
  const streaks = []; for (let k = 0; k < W.streaks; k++) streaks.push({ on: false, s: 0, lat: 0, y: 0, v: 0 });
  return { ev, mesh, socks, zones, streaks, spawn: 0 };
}
function rceWindOff(B) { for (const z of B.zones) { z.t = -1; z.lap = -1; z.told = -1; z.arm.rotation.set(0, 0, -1.25); } for (const s of B.streaks) s.on = false; B.mesh.count = 0; }
// the push on a car now, m/s across (+ to its left): 0 outside a blowing gust
function rceWind(r) {
  const v = rce.cur;
  if (!v || !v.wind || rce.quiet || r.path) return 0;
  const W = RCE.wind;
  for (const z of v.wind.zones) {
    if (z.t < W.warn || z.t > W.warn + W.dur) continue;
    const d = rcAhead(r.s, z.a);
    if (d >= 0 && d <= z.b - z.a) { const k = Math.min(1, (z.t - W.warn) / W.ease, (W.warn + W.dur - z.t) / W.ease); return z.dir * W.push * k; }
  }
  return 0;
}
function rceWindUpdate(B, dt, going) {
  const W = RCE.wind, him = race.him, L = race.track.len, H = RC.width / 2;
  let blowing = null;
  for (const z of B.zones) {
    const ahead = rcAhead(z.a, him.s), lap = Math.floor((him.s + ahead) / L);
    if (going && z.t < 0 && lap > z.lap && ahead < W.lead * Math.max(him.v, 20) && !him.done) {
      z.lap = lap; z.t = 0;
      synthBlip("sawtooth", 300, 120, 1.6, 0.06, 0);                   // (a rising whoosh: the wind coming)
      flags.raceGusts = (flags.raceGusts || 0) + 1;
    }
    // the sock: limp (hung down) when still, straight out and flapping while it blows
    const blowK = z.t < 0 ? 0 : Math.min(1, z.t / W.ease, Math.max(0, (W.warn + W.dur - z.t) / W.ease));
    z.arm.rotation.z = -(1 - blowK) * 1.25 + blowK * Math.sin(race.t * 9) * 0.08;
    z.arm.rotation.y = blowK * Math.sin(race.t * 6.3) * 0.12;
    if (z.t < 0) continue;
    z.t += dt;
    if (z.t > W.warn + W.dur) { z.t = -1; continue; }
    blowing = z;
    if (going && z.t > W.warn && z.told !== z.lap && rcAhead(him.s, z.a) <= z.b - z.a) { z.told = z.lap; rcThing("gust"); }
  }
  // the streaks: born on the windward edge round him, flying across the road and beyond, while a gust is on
  B.spawn -= dt;
  if (blowing && B.spawn <= 0) {
    B.spawn = W.every;
    const s = B.streaks.find(x => !x.on);
    if (s) {
      const ds = W.ahead + ((race.t * 53.7) % 1) * W.spread;               // (ahead of him only: behind, they crossed between the chase camera and his car)
      Object.assign(s, { on: true, s: him.s + ds, lat: blowing.dir * -(H + 10), y: W.streakY[0] + ((race.t * 31.3) % 1) * (W.streakY[1] - W.streakY[0]), v: blowing.dir * W.streakV, dir: blowing.dir });
    }
  }
  let n = 0;
  for (const s of B.streaks) {
    if (!s.on) continue;
    s.lat += s.v * dt;
    if (Math.abs(s.lat) > H + 14 && Math.sign(s.lat) === s.dir) { s.on = false; continue; }
    rcPoint(s.s, s.lat, rceP);
    const a = rcAt(s.s);
    rceM.makeRotationY(Math.atan2(a.tx, a.tz) + Math.PI / 2);               // (lying across the road, the way it blows)
    rceM.setPosition(rceP.x, rceP.y + s.y, rceP.z);
    B.mesh.setMatrixAt(n++, rceM);
  }
  B.mesh.count = n; B.mesh.instanceMatrix.needsUpdate = true;
}
const rceM = new THREE.Matrix4();

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
      boxes.push({ x: rceP.x, y: rceP.y + K.boardH / 2, z: rceP.z, w: 0.3, h: K.boardH, d: K.board * 0.98, ry: Math.atan2(a.tx, a.tz), c: i % 2 ? (J.stunt ? P.ink : P.white) : (J.stunt ? P.warning : P.blue) });   // (v193: a stunt ramp's are yellow and black)
    }
  }
  // the lip: a flag on a pole each side, the kind that stands at the top of a real one
  const a = rcAtOn(T, crest);
  for (const sd of [-1, 1]) {
    rcPointOn(T, crest, sd * (W + 1.2), rceP);
    boxes.push({ x: rceP.x, y: rceP.y + K.pole / 2, z: rceP.z, w: 0.25, h: K.pole, d: 0.25, c: P.white });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(K.flag, -K.flag * 0.35); sh.lineTo(0, -K.flag * 0.7); sh.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: J.stunt ? P.fire : sd > 0 ? P.red : P.blue, side: THREE.DoubleSide }));
    f.position.set(rceP.x, rceP.y + K.pole, rceP.z); f.rotation.y = Math.atan2(a.tx, a.tz) + Math.PI / 2; g.add(f);
  }
  g.add(rceMerged(boxes));
  g.traverse(o => { o.userData.noSolid = true; });
  scene.add(g);
  return g;
}

{ const s0 = vkSeed; try { vkQuiet(0, rceBuild); } finally { vkSeed = s0; } }
