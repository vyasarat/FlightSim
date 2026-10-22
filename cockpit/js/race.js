"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE RACE (v164). His idea, his dad's yes.
//
// THE ONE PLACE HE CAN LOSE. The parent's exception (CLAUDE.md, design rules):
// a race has a real finishing order and he can come last. Nothing else is
// taken away -- no score is kept, nothing is saved, nothing is locked, and the
// next race is one tap. Every other kid rule holds in here.
//
// HOW HE GETS IN. The picker still opens on the vehicles. In anything that
// drives (the SUV, the Cybertruck, the Corvette, the monster truck) a pulsing
// chequered flag offers a race (`raceBtn`). It opens the track picker: one big
// silhouette card per track, and the way back. The track's card puts him on
// the grid, in the same car. EXIT (`raceExitBtn`) puts him back in the world,
// in that car, where he was.
//
// THE RACE IS A MODE, NOT A CAR. While it runs, `vehKind()` answers "race"
// (vehicles.js, modes first), so nothing that asks for a car -- the police, the
// signals, the horn, the walls -- sees him, and this file drives him, his
// camera and his model. His controls are the car's, nothing new: finger down
// drives, off eases him down; drag left/right moves him across the track; drag
// up is his car's own burst (the Corvette keeps its booster, flames and all);
// the speed steps are the same pair.
//
// HE CAN'T FALL OFF AND HE IS NEVER STUCK. He is laid on the track as metres
// along it and metres across it, so lane-keep is the track itself: hands-off
// holds his line, and the barrier at either edge is a shove back on to it -- on a
// fresh hit; a steer held on into it glides along it, quietly, and never quicker
// than the racing line (v171, rcEdge).
// Contact with another car is a shove, both ways, never a bang -- nothing in a
// race explodes and nothing stops one. Steering across the track is how he
// overtakes, dodges, takes the inside of a bend (shorter, so faster) and hits
// the boost pads he aims at. Pointing, not timing.
//
// FAIR FOR EVERY CAR. Every racer, his included, runs the SAME speed model:
// one base speed times his speed step, one burst gain, one pad gain. What car
// he picked changes how it looks and sounds, never how fast it goes -- so the
// Corvette's booster is no walkover and the monster truck is no hopeless case.
// The opponents race at his step too, so the step is a feel, not a cheat. They
// adjust a little to keep it close (ease off when far ahead of him, push when
// far behind), but they never wait for him: the strength is `TUNE.race.ai`,
// for the parent to make it harder or easier.
//
// THE TRACK IS DATA: `TUNE.race.tracks` lists typed sections, laid end to end
// in the frame the last one ended in, with the toy track's own generators
// (track.js tkSection/tkLay). Track 1 is an egg-shaped oval -- a gentle banked
// turn at one end, a long sweeping bend at the other -- whose numbers close it
// exactly (the harness checks the end meets the start). A later track adds
// sections; it edits this file only for a kind of thing no track had before.
//
// (v174, Snowy Peaks) SNOW AND ICE are a bit slippery: on a bend every racer swings
// wide by the same amount, and comes back to its line after it -- lane-keep holds,
// hands-off never reaches a bank. A track's SNOWBANKS are its barriers drawn as snow
// (the same solids). Its TUNNEL is built over the deck, never cut into the ground,
// and the chase camera stays inside it by v163's line test. Its FROZEN LAKE is ice on
// a level bed shaped into the ground (terrain.js rcLakeBed) -- ice, never water.
//
// (v176, Sky Glow Road) A SKY ROAD is a section's `sky`: the deck that many metres over the
// line, eased, never under the ground. Up in the air it stands on pylons over a girder, both
// solid in the world, and its barriers' tops glow (additive, the shared texture, no post).
// He cannot fall off it any more than off the ground: he is laid on the track, as everywhere.
//
// THE VENUE STANDS IN THE WORLD, seen in normal play: asphalt, kerbs, barriers,
// grandstands (solid, as buildings are), flags, the start gantry with its three
// lamps, the boost pads and the podium. It is built on its own random stream
// (vkQuiet), so the seeded traffic still sees v125's. It is DRAWN only where it can be seen
// (v179, rcCull): its long ribbons in 600 m squares, and past the fog off the camera's layer --
// never `visible`, which the solids registry asks (frame_budget_checks).
// ---------------------------------------------------------------------------
const RC = TUNE.race;
const race = {
  built: false, track: null, on: false, phase: "off", t: 0, racers: [], him: null,
  order: [], finished: 0, podium: null, saved: null, lights: [], venue: null,
  stuckT: 0, stuck: 0, bangs: 0, shoves: 0, wallShoves: 0, padHits: 0, lapT: [],
  confT: 0, fwT: 0, camShot: null,
};
const rcV1 = new THREE.Vector3(), rcV2 = new THREE.Vector3(), rcV3 = new THREE.Vector3(), rcM = new THREE.Matrix4();
const rcBox = new THREE.Box3(), rcBox2 = new THREE.Box3();
const rcEu = new THREE.Euler(), rcQ1 = new THREE.Quaternion(), rcQ2 = new THREE.Quaternion();

function raceOn() { return race.on; }
// The race draws from its OWN stream, seeded at the grid: the same seed is the
// same race (race_drive.js reports per seed), and the game's seeded stream --
// which the traffic checks read -- is never touched by a race.
let rcSeed = 1;
function rcRnd() { rcSeed = (rcSeed + 0x6D2B79F5) >>> 0; let t = rcSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
// A car he can race: anything that drives.
function raceCarOK() { return !!(state.vp && (state.vp.car || state.vp.monster)); }

// ---- the track: sections laid end to end -----------------------------------------
// samples every TK.ds with position, tangent, the left vector across the deck
// (banked), the ground height for it and the bend's horizontal curvature (+ left)
function rcLayTrack(def) {
  const site = def.site || RC.site, h = site.heading * DEG;
  const start = { p: new THREE.Vector3(site.x, 0, site.z), f: new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h)), u: new THREE.Vector3(0, 1, 0) };
  const laid = tkLay(start, def.sections, "race:" + def.id);
  const pc = laid.pieces[0], S = pc.S, n = S.length, W = RC.width / 2 + RC.kerbW;
  for (const q of S) {
    const L = tkFrameAt(q);                   // left = N x T, tilted by the bank
    q.lx = L[0]; q.ly = L[1]; q.lz = L[2];
    // the deck stands clear of the ground under all of it, at either edge
    let g = -Infinity;
    for (const a of [-W, -W / 2, 0, W / 2, W]) g = Math.max(g, terrainEff(q.x + L[0] * a, q.z + L[2] * a) - L[1] * a);
    q.g = g + RC.lift;
    q.sf = def.sections[q.sec].surface || "asphalt";   // what it is made of (v170)
  }
  // smoothed along it, so a bump in the ground is never a step in the road
  const sm = S.map(q => q.g), K = Math.max(1, Math.round(RC.smooth / TK.ds));
  for (let i = 0; i < n; i++) {
    let m = -Infinity;
    for (let j = -K; j <= K; j++) m = Math.max(m, sm[(i + j + n) % n]);
    S[i].gy = m;
  }
  // (v174) a frozen lake is dead level: its section at the highest the deck stands
  // over it (its bed is level: terrain.js rcLakeBed), eased in over `along` m either
  // side -- toward a height the deck is under there, so never under the ground
  const lakes = [];
  def.sections.forEach((sc, k) => {
    if (!sc.lake) return;
    let a = Infinity, b = -Infinity;
    for (const q of S) if (q.sec === k) { a = Math.min(a, q.s); b = Math.max(b, q.s); }
    const E = RC.lake.along;
    let y = -Infinity;
    for (const q of S) if (q.sec === k) y = Math.max(y, q.gy);
    for (const q of S) {
      const d = q.s < a ? a - q.s : q.s > b ? q.s - b : 0;
      if (d < E) q.gy = lerp(q.gy, y, 1 - smoothstep(0, E, d));
    }
    lakes.push({ sec: k, a, b, y });
  });
  // (v170) a track with jumps rides its slopes: the deck eased once more (the
  // highest-under-it pass leaves corners a car at speed would leave the deck on),
  // then its dunes heaped on it, and the slope kept for the cars to pitch with
  const jumps = def.sections.some(sc => sc.jump);
  if (jumps) {
    const B = Math.max(1, Math.round(RC.jump.ease / TK.ds)), raw = S.map(q => q.gy);
    for (let i = 0; i < n; i++) { let a = 0; for (let j = -B; j <= B; j++) a += raw[(i + j + n) % n]; S[i].gy = a / (2 * B + 1); }
  }
  // (v176) a SKY ROAD: each section's `sky` is the deck's height at its end, in metres
  // over the line's own deck (none or 0: on the ground), straight from the last section's
  // end to it and eased over `RC.sky.ease` m -- and never under the ground (its own
  // highest under it, plus the lift). Where it stands `RC.sky.minUp` over that it is
  // up in the air: on pylons, solid, glowing (rcBuildSky).
  const sky = def.sections.some(sc => sc.sky !== undefined);
  if (sky) {
    const from = {}, to = {}, base = S[0].gy, hs = def.sections.map(sc => sc.sky || 0), raw = new Array(n);
    for (const q of S) { if (from[q.sec] === undefined) from[q.sec] = q.s; to[q.sec] = q.s; }
    for (let i = 0; i < n; i++) {
      const q = S[i], k = q.sec, h0 = hs[(k - 1 + hs.length) % hs.length];
      raw[i] = lerp(h0, hs[k], to[k] > from[k] ? (q.s - from[k]) / (to[k] - from[k]) : 1);
    }
    const B = Math.max(1, Math.round(RC.sky.ease / TK.ds));
    for (let i = 0; i < n; i++) {
      let a = 0; for (let j = -B; j <= B; j++) a += raw[(i + j + n) % n];
      const q = S[i], h = a / (2 * B + 1);
      q.gy = Math.max(q.gy, q.g, lerp(q.gy, base + h, Math.min(1, h / RC.sky.blend)));   // (off the ground over the first `blend` m: no step where it leaves it)
      q.up = q.gy - q.g + RC.lift > RC.sky.minUp;              // (up in the air: over the ground under it, not its lift)
    }
  }
  // (v175) a splash is the deck down AT the water: over each splash section it stands
  // `over` m above the sea where the ground under it is lower, and on the ground (its
  // own highest under it, plus the lift) where that is higher -- never under either --
  // eased back to the road over `along` m each side. Real water: the lagoon is the
  // coast's own (terrainEff under seaLevelAt, CLAUDE.md's one definition); nothing is
  // reshaped and nothing new answers "is this water".
  const splashes = [];
  def.sections.forEach((sc, k) => {
    if (sc.surface !== "splash") return;
    let a = Infinity, b = -Infinity, y = -Infinity;
    for (const q of S) if (q.sec === k) { a = Math.min(a, q.s); b = Math.max(b, q.s); y = Math.max(y, seaLevelAt(q.x, q.z) + RC.splash.over); }
    const E = RC.splash.along;
    for (const q of S) {
      const d = q.s < a ? a - q.s : q.s > b ? q.s - b : 0;
      if (d < E) q.gy = Math.max(q.g, lerp(q.gy, Math.max(q.g, y), 1 - smoothstep(0, E, d)));
    }
    splashes.push({ sec: k, a, b, y });
  });
  if (jumps) {
    const from = {};
    for (const q of S) if (from[q.sec] === undefined) from[q.sec] = q.s;
    for (const q of S) {
      const J = def.sections[q.sec].jump;
      if (!J) continue;
      const crest = J.at * def.sections[q.sec].len, u = q.s - from[q.sec] - crest;
      const k = u < 0 ? 1 - Math.min(1, -u / J.up) : 1 - Math.min(1, u / J.down);
      q.gy += J.h * k * k * (3 - 2 * k);           // smoothstep up the face, smoothstep down the back
      q.dune = k > 0;
    }
    for (let i = 0; i < n; i++) S[i].ty = (S[(i + 1) % n].gy - S[i].gy) / TK.ds;
    S[n - 1].ty = S[n - 2].ty;
  }
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    a.kh = (a.tz * b.tx - a.tx * b.tz) / (b.s - a.s || TK.ds);
  }
  S[n - 1].kh = S[n - 2].kh;
  const gap = Math.hypot(laid.end.p.x - start.p.x, laid.end.p.z - start.p.z);
  const turn = Math.abs(wrapPi(Math.atan2(laid.end.f.x, laid.end.f.z) - Math.atan2(start.f.x, start.f.z)));
  return { def, S, len: pc.len, n, gap, turn, jumps, lakes, splashes, sky };
}

// Where s metres along it is (s wraps by the lap): one sample's worth, interpolated.
const rcAtOut = { x: 0, gy: 0, z: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0, s: 0, sf: "asphalt", ty: 0 };
function rcAt(s) {
  const T = race.track, S = T.S, n = T.n;
  let u = s % T.len; if (u < 0) u += T.len;
  const f = u / T.len * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i, a = S[i], b = S[i + 1], o = rcAtOut;
  o.x = a.x + (b.x - a.x) * t; o.z = a.z + (b.z - a.z) * t; o.gy = a.gy + (b.gy - a.gy) * t;
  o.tx = a.tx + (b.tx - a.tx) * t; o.tz = a.tz + (b.tz - a.tz) * t;
  const tl = Math.hypot(o.tx, o.tz) || 1; o.tx /= tl; o.tz /= tl;
  o.lx = a.lx + (b.lx - a.lx) * t; o.ly = a.ly + (b.ly - a.ly) * t; o.lz = a.lz + (b.lz - a.lz) * t;
  o.kh = a.kh + (b.kh - a.kh) * t; o.s = u; o.sf = (t < 0.5 ? a : b).sf;
  o.ty = a.ty === undefined ? 0 : a.ty + (b.ty - a.ty) * t;   // (the slope along: only a track with jumps keeps one)
  o.dune = (t < 0.5 ? a : b).dune;
  return o;
}
// The surface s metres along (TUNE.race.surfaces): the same answer for every racer there.
function rcSurfAt(s) { return RC.surfaces[rcAt(s).sf] || RC.surfaces.asphalt; }
// ... under a racer, wherever it is (a shortcut is its own)
function rcSurfR(r) { return r.path ? RC.surfaces[r.path.surface] : rcSurfAt(r.s); }
// the world point at (s, lat), and the deck's up there (pitched by the slope along,
// or by `ty` when it is given: a car in the air, nose where it is going)
function rcPoint(s, lat, out, tyAt) {
  const q = rcAt(s);
  out.x = q.x + q.lx * lat; out.y = q.gy + q.ly * lat; out.z = q.z + q.lz * lat;
  // up = T x left... the deck's normal: left x T
  const tx = q.tx, tz = q.tz, lx = q.lx, ly = q.ly, lz = q.lz, ty = tyAt === undefined ? q.ty : tyAt;
  out.nx = ly * tz - lz * ty; out.ny = lz * tx - lx * tz; out.nz = lx * ty - ly * tx;
  const nl = Math.hypot(out.nx, out.ny, out.nz) || 1; out.nx /= nl; out.ny /= nl; out.nz /= nl;
  if (out.ny < 0) { out.nx = -out.nx; out.ny = -out.ny; out.nz = -out.nz; }
  out.tx = tx; out.tz = tz; out.lx = lx; out.ly = ly; out.lz = lz; out.kh = q.kh;
  return out;
}
const rcP = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
// where a racer IS: on the deck, or over it in the air off a dune
function rcPointR(r, out) {
  if (r.path) return rcScPoint(r.path, r.u, r.lat, out);
  if (!r.air) return rcPoint(r.s, r.lat, out);
  rcPoint(r.s, r.lat, out, clamp(r.vy / Math.max(4, r.v), -RC.jump.pitchMax, RC.jump.pitchMax));
  out.y = r.y;
  return out;
}

// ---- (v170) a shortcut: the straight chord across a bulge in the track ---------------
// From section `from`'s start to section `to`'s end the main road bulges into the
// infield; the shortcut runs straight between the two, on its `side` of the road,
// `half` m either side of its line, on its own surface -- shorter and slower, never
// a trap and never a cheat (the harness times both). He takes it by being within
// `mouth` m of that edge `gore` m past its start: aimed at, like a motorway exit;
// hands-off in the middle of the road never does. Its lap metres are the bulge's,
// so laps and places read as if it were the road.
function rcLayShortcut(sc) {
  const T = race.track, from = {}, to = {};
  for (const q of T.S) { if (from[q.sec] === undefined) from[q.sec] = q.s; to[q.sec] = q.s; }
  const sa = from[sc.from], sb = sc.to + 1 < T.def.sections.length ? from[sc.to + 1] : T.len;
  const latC = sc.side * (RC.width / 2 - sc.half);
  const A = rcPoint(sa, latC, {}), B = rcPoint(sb, latC, {});
  const Ls = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / Ls, dz = (B.z - A.z) / Ls, lx = dz, lz = -dx;
  const n = Math.max(2, Math.round(Ls / TK.ds) + 1), S = [], W = sc.half + RC.kerbW;
  for (let i = 0; i < n; i++) {
    const u = Ls * i / (n - 1), x = A.x + dx * u, z = A.z + dz * u;
    let g = -Infinity;
    for (const a of [-W, 0, W]) g = Math.max(g, terrainEff(x + lx * a, z + lz * a));
    S.push({ u, x, z, g: g + RC.lift });
  }
  const K = Math.max(1, Math.round(RC.smooth / TK.ds));
  for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - K); j <= Math.min(n - 1, i + K); j++) m = Math.max(m, S[j].g); S[i].gy = m; }
  // its ends at the road's own height where they meet it
  const e0 = A.y - S[0].gy, e1 = B.y - S[n - 1].gy;
  for (const q of S) q.gy += e0 + (e1 - e0) * q.u / Ls;
  return Object.assign({}, sc, { sa, sb, latC, Ls, ax: A.x, az: A.z, dx, dz, lx, lz, S, n });
}
// a point on it, u metres along, lat across (+ left)
function rcScPoint(sc, u, lat, out) {
  const f = clamp(u / sc.Ls, 0, 1) * (sc.n - 1), i = Math.min(sc.n - 2, Math.floor(f)), t = f - i;
  out.x = sc.ax + sc.dx * u + sc.lx * lat; out.z = sc.az + sc.dz * u + sc.lz * lat;
  out.y = sc.S[i].gy + (sc.S[i + 1].gy - sc.S[i].gy) * t;
  out.nx = 0; out.ny = 1; out.nz = 0; out.tx = sc.dx; out.tz = sc.dz; out.lx = sc.lx; out.ly = 0; out.lz = sc.lz; out.kh = 0;
  return out;
}
// is (x, z) on its deck? on the road's?
function rcOnSc(sc, x, z, pad) {
  const u = (x - sc.ax) * sc.dx + (z - sc.az) * sc.dz, l = (x - sc.ax) * sc.lx + (z - sc.az) * sc.lz;
  return u > -pad && u < sc.Ls + pad && Math.abs(l) < sc.half + RC.kerbW + pad;
}
function rcOnMain(T, sc, x, z, pad) {
  const i0 = Math.floor((sc.sa - 30) / T.len * (T.n - 1)), i1 = Math.ceil((sc.sb + 30) / T.len * (T.n - 1));
  for (let i = Math.max(0, i0); i <= Math.min(T.n - 1, i1); i += 2) if (Math.hypot(T.S[i].x - x, T.S[i].z - z) < RC.width / 2 + RC.kerbW + pad) return true;
  return false;
}

// ---- the venue ------------------------------------------------------------------------
function rcBuild() {
  if (race.built) return;
  vkQuiet(0, rcBuildQuiet);
  race.built = true;
  flags.raceBuilt = (flags.raceBuilt || 0) + 1;
}
// Every track is a VENUE of its own, built once at load and standing in the world:
// what the race reads -- race.track, race.pads, race.lights, the podium -- is the
// venue in use (`rcUse`), so the race itself never asks which track it is. The
// oval is built first, exactly as it always was; each later one on the kit's
// stream with its seed put back after, so the oval and everything built after the
// venues draw what they drew before there was more than one.
const RC_VENUE = ["track", "pads", "padMesh", "venue", "lights", "gantry", "stands", "standsG", "podiumG", "podiumSpots",
                  "podiumFace", "podiumC", "trophy", "trophyStand", "flags"];
function rcBuildQuiet() {
  race.venues = {};
  RC.tracks.forEach((def, i) => {
    const s0 = vkSeed;
    try { rcBuildVenue(def); } finally { if (i > 0) vkSeed = s0; }
    const v = race.venues[def.id] = {};
    for (const k of RC_VENUE) v[k] = race[k];
  });
  // (v179) cut and culled after every venue is built, on the kit's stream put back after:
  // nothing built before or after draws differently for it
  const s0 = vkSeed;
  race.cullStats = { before: 0, after: 0, from: 0, into: 0 };
  try { for (const id in race.venues) rcChunkVenue(race.venues[id]); } finally { vkSeed = s0; }
  race.padMesh = race.venues[RC.tracks[0].id].padMesh;
  rcCullPrep();
  rcUse(RC.tracks[0].id);
}

// ---- (v179) a venue drawn only where it can be seen ------------------------------------------
// Five venues of four-odd kilometres each, every ribbon one mesh: a mesh that long is never
// out of the frustum, so all of them were drawn from everywhere -- 150k triangles on the
// runway, 475k beside the oval -- under a fog that had hidden them whole. Now each long
// ribbon is cut into squares (the same triangles, the same material), and anything of a venue
// wholly past the fog's far edge (in view depth) is taken off the camera's LAYER, not hidden: `visible` is what the
// solids registry asks (isSolidHidden), and a grandstand far from the camera is still a wall to
// whatever the harness puts beside it. What the fog lets him see is drawn exactly as before.
// Glows that ignore the fog (fog: false) are never culled here.
function rcChunkVenue(v) {
  const C = RC.cull, g = v.venue;
  for (const m of g.children.slice()) {
    if (!m.isMesh || m.material.fog === false) continue;
    const g0 = m.geometry, nTri = (g0.index ? g0.index.count : g0.attributes.position.count) / 3;
    if (nTri < C.chunkMin) continue;
    const geo = g0.index ? g0.toNonIndexed() : g0, pos = geo.attributes.position, cells = new Map();
    for (let t = 0; t < pos.count / 3; t++) {
      const i = t * 3, cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const key = Math.floor(cx / C.cell) + "," + Math.floor(cz / C.cell);
      let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(t);
    }
    if (cells.size < 2) { if (geo !== g0) geo.dispose(); continue; }
    const st = race.cullStats; st.before += pos.count / 3; st.from++; st.into += cells.size;
    for (const tris of cells.values()) {
      const ng = new THREE.BufferGeometry();
      for (const name in geo.attributes) {
        const src = geo.attributes[name], k = src.itemSize, arr = new Float32Array(tris.length * 3 * k);
        let o = 0;
        for (const t of tris) for (let j = t * 3 * k, e = j + 3 * k; j < e; j++) arr[o++] = src.array[j];
        ng.setAttribute(name, new THREE.BufferAttribute(arr, k));
      }
      st.after += tris.length;
      const piece = new THREE.Mesh(ng, m.material);
      piece.receiveShadow = m.receiveShadow; piece.castShadow = m.castShadow; piece.renderOrder = m.renderOrder;
      piece.name = m.name; piece.frustumCulled = m.frustumCulled; piece.onBeforeRender = m.onBeforeRender;
      piece.position.copy(m.position); piece.quaternion.copy(m.quaternion); piece.scale.copy(m.scale);
      Object.assign(piece.userData, m.userData);
      g.add(piece);
      if (v.padMesh === m) v.padMesh = piece;
    }
    g.remove(m);
    if (geo !== g0) geo.dispose();
    g0.dispose();
  }
}
// every mesh of every venue, with the box it stands in (the trophy travels: never culled)
const RC_CULL_SKIP = ["trophy", "trophyStand"];
function rcCullPrep() {
  race.cull = [];
  const seen = new Set();
  for (const id in race.venues) {
    const v = race.venues[id];
    for (const k in v) {
      if (RC_CULL_SKIP.includes(k) || !v[k] || !v[k].isObject3D) continue;
      v[k].updateWorldMatrix(true, true);
      v[k].traverse(m => {
        if (!(m.isMesh || m.isPoints) || seen.has(m) || !m.material || m.material.fog === false) return;
        seen.add(m);
        race.cull.push({ m, box: new THREE.Box3().setFromObject(m) });
      });
    }
  }
  scene.onBeforeRender = rcCull;
}
// before every render, with the camera it is drawn from. The fog is by VIEW DEPTH (three.js
// fogs on -mvPosition.z), not by distance: at the edge of a wide screen a piece 1.7 km off is
// only 1.2 km deep and half seen. So a piece is culled only when the NEAREST corner of its box,
// measured along the camera's line of sight, is past the fog's far edge plus the margin -- the
// fog has then hidden every point of it, wherever it is on the screen.
const rcFwd = new THREE.Vector3();
function rcCull(renderer, sc, cam) {
  if (!race.cull || !cam || !sc.fog) return;
  const far = sc.fog.far + RC.cull.margin, p = cam.position;
  cam.getWorldDirection(rcFwd);
  const fx = rcFwd.x, fy = rcFwd.y, fz = rcFwd.z;
  for (const c of race.cull) {
    const b = c.box;
    // the least depth over the box's eight corners: per axis, the end that is nearer along it
    const d = (fx > 0 ? b.min.x : b.max.x) * fx + (fy > 0 ? b.min.y : b.max.y) * fy + (fz > 0 ? b.min.z : b.max.z) * fz
            - (p.x * fx + p.y * fy + p.z * fz);
    c.m.layers.mask = d > far ? 0 : 1;
  }
}
// The venue a race is run on; an id it does not know is the first track.
function rcUse(id) {
  const v = race.venues && (race.venues[id] || race.venues[RC.tracks[0].id]);
  if (!v || race.track === v.track) return;
  if (race.trophy) race.trophy.visible = race.trophyStand.visible = false;
  for (const k of RC_VENUE) race[k] = v[k];
}
// where on the lap its podium stands (a fraction of it)
function rcPodiumM(def) { return (def && def.podiumM !== undefined ? def.podiumM : RC.podium.m); }   // (v173: metres from the line)
function rcBuildVenue(def) {
  race.track = rcLayTrack(def);
  race.track.sc = (def.shortcuts || []).map(rcLayShortcut);
  const T = race.track, S = T.S, n = T.n, P = TUNE.palette, W = RC.width / 2, KW = RC.kerbW;
  const g = new THREE.Group();
  g.userData.noSolid = false;
  // ---- the deck, the kerbs and the barriers: three ribbons and a wall, one mesh each
  const deck = [], kerbR = [], kerbW = [], wall = [], line = [];
  const decks = { asphalt: deck }, ruts = {}, films = {}, skirt = [];   // (films: v175's splash)   // (ruts: one mesh per colour, v174)   // (v170) a deck per surface, asphalt's the one there always was
  const at = (q, a, up) => [q.x + q.lx * a, q.gy + q.ly * a + (up || 0), q.z + q.lz * a];
  const quad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    quad(decks[a.sf] || (decks[a.sf] = []), at(a, -W), at(b, -W), at(b, W), at(a, W));
    const sf = RC.surfaces[a.sf] || RC.surfaces.asphalt;
    // a dune is ground, not a deck on stilts: its sides run down to the desert
    if ((a.dune || b.dune) && !def.banks && !(a.up || b.up)) for (const sd of [-1, 1]) {   // (v176: a sky jump has nothing under it but its girder)
      const e = sd * (W + KW + 0.4), o = sd * (W + KW + 0.4 + RC.jump.skirt);
      const ga = [a.x + a.lx * o, terrainEff(a.x + a.lx * o, a.z + a.lz * o) - 0.3, a.z + a.lz * o];
      const gb = [b.x + b.lx * o, terrainEff(b.x + b.lx * o, b.z + b.lz * o) - 0.3, b.z + b.lz * o];
      quad(skirt, at(a, e, -0.05), at(b, e, -0.05), gb, ga);
    }
    // dirt keeps the ruts of the cars before him, where the racing lines run
    // (v174) a snow or ice road has a blue line down each edge: white on white, from his seat a bend could not be read
    if (sf.edgeLine) { const el = ruts[sf.edgeLine] || (ruts[sf.edgeLine] = []); for (const sd of [-1, 1]) { const o = sd * (W - 0.5); quad(el, at(a, o - 0.35, 0.045), at(b, o - 0.35, 0.045), at(b, o + 0.35, 0.045), at(a, o + 0.35, 0.045)); } }
    // (v175) a splash is under a film of the sea: the road's sand seen through shallow water
    if (sf.film) { const fl = films[sf.film] || (films[sf.film] = []); quad(fl, at(a, -W, RC.splash.filmUp), at(b, -W, RC.splash.filmUp), at(b, W, RC.splash.filmUp), at(a, W, RC.splash.filmUp)); }
    if (sf.ruts) { const rr = ruts[sf.rutCol || P.slate] || (ruts[sf.rutCol || P.slate] = []); for (const c of RC.rutLat) quad(rr, at(a, c - RC.rutW / 2, 0.04), at(b, c - RC.rutW / 2, 0.04), at(b, c + RC.rutW / 2, 0.04), at(a, c + RC.rutW / 2, 0.04)); }
    // kerbs on the bends, red and white every few metres, on both edges (asphalt's alone)
    const bend = Math.abs(a.kh) > 0.0015 && sf.kerbs;
    const red = Math.floor(a.s / RC.kerbStep) % 2 === 0;
    for (const sd of [-1, 1]) {
      const k = bend ? (red ? kerbR : kerbW) : kerbW;
      if (sf.kerbs && (bend || i % 4 < 2)) quad(k, at(a, sd * W, 0.04), at(b, sd * W, 0.04), at(b, sd * (W + KW), 0.04), at(a, sd * (W + KW), 0.04));
      // the barrier just outside the kerb, low and white with a red cap (open where a shortcut leaves it)
      const e = sd * (W + KW + 0.4), pe = at(a, e);
      if (!def.banks && !T.sc.some(sc => rcOnSc(sc, pe[0], pe[2], 0.5))) quad(wall, pe, at(b, e), at(b, e, RC.wallH), at(a, e, RC.wallH));   // (v174: a snow track's are its banks, rcBuildBanks)
    }
  }
  // the barriers are walls in the world, to anything that meets them out of a race
  // (in one, the race itself keeps him off them): short turned boxes along each
  const step = Math.max(1, Math.round(RC.wallPiece / TK.ds));
  for (let i = 0; i < n; i += step) {
    const a = S[i], b = S[(i + step) % n];
    for (const sd of [-1, 1]) {
      const e = sd * (W + KW + 0.4), p0 = at(a, e), p1 = at(b, e);
      if (T.sc.some(sc => rcOnSc(sc, p0[0], p0[2], 0.5) || rcOnSc(sc, p1[0], p1[2], 0.5))) continue;
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], L = Math.hypot(dx, dz) || 1;
      // (v174: a snowbank's solid is as tall as the bank drawn over it -- its crest stands on this line)
      const wh = def.banks ? Math.min(rcBankH(T, a), rcBankH(T, b)) : RC.wallH;
      solidBox3((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + wh / 2 - 0.25, (p0[2] + p1[2]) / 2,
                [dx / L, 0, dz / L], [0, 1, 0], [-dz / L, 0, dx / L], L / 2 + 0.3, wh / 2 + 0.25, 0.3, "wall");
    }
  }
  // the shortcuts: a deck of their own surface where they leave the road, barriers
  // where nothing else is beside them
  for (const sc of T.sc) {
    const P = (q, a, up) => [q.x + sc.lx * a, q.gy + (up || 0), q.z + sc.lz * a];
    const dk = decks[sc.surface] || (decks[sc.surface] = []), HW = sc.half, step = Math.max(1, Math.round(RC.wallPiece / TK.ds));
    for (let i = 0; i < sc.n - 1; i++) {
      const a = sc.S[i], b = sc.S[i + 1];
      // (over the road too where they share it, a hand's breadth up: the second way is seen
      // peeling off from the fork, not starting out of nowhere past it)
      const up = rcOnMain(T, sc, a.x, a.z, -2) ? 0.03 : -0.02;
      quad(dk, P(a, -HW, up), P(b, -HW, up), P(b, HW, up), P(a, HW, up));
      for (const sd of [-1, 1]) quad(kerbW, P(a, sd * (HW - 0.6), up + 0.02), P(b, sd * (HW - 0.6), up + 0.02), P(b, sd * HW, up + 0.02), P(a, sd * HW, up + 0.02));
      for (const sd of [-1, 1]) {
        const e = sd * (HW + KW + 0.4), pe = P(a, e);
        if (rcOnMain(T, sc, pe[0], pe[2], 0.5)) continue;
        quad(wall, pe, P(b, e), P(b, e, RC.wallH), P(a, e, RC.wallH));
        if (i % step === 0) {
          const c = sc.S[Math.min(sc.n - 1, i + step)], p1 = P(c, e);
          const dx = p1[0] - pe[0], dz = p1[2] - pe[2], L = Math.hypot(dx, dz) || 1;
          solidBox3((pe[0] + p1[0]) / 2, (pe[1] + p1[1]) / 2 + RC.wallH / 2 - 0.25, (pe[2] + p1[2]) / 2,
                    [dx / L, 0, dz / L], [0, 1, 0], [-dz / L, 0, dx / L], L / 2 + 0.3, RC.wallH / 2 + 0.25, 0.3, "wall");
        }
      }
    }
  }
  // the start line, chequered across the deck
  const s0 = S[0];
  const sq = RC.width / 12;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
    if ((r + c) % 2) continue;
    const a0 = -W + c * sq, along = r * sq;
    const p = (da, ds) => [s0.x + s0.lx * (a0 + da) + s0.tx * (along + ds), s0.gy + s0.ly * (a0 + da) + 0.05, s0.z + s0.lz * (a0 + da) + s0.tz * (along + ds)];
    quad(line, p(0, 0), p(0, sq), p(sq, sq), p(sq, 0));
  }
  const mk = (arr, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
  };
  mk(deck, artPaint(new THREE.MeshLambertMaterial({ color: P.slate, side: THREE.DoubleSide }), "asphalt"));
  for (const k in decks) if (k !== "asphalt") {
    const sf = RC.surfaces[k];
    // (v174) ice shines; everything else is matt
    mk(decks[k], sf.shine ? new THREE.MeshPhongMaterial({ color: sf.col, shininess: sf.shine, specular: 0x8a93a0, side: THREE.DoubleSide })
                          : artPaint(new THREE.MeshLambertMaterial({ color: sf.col, side: THREE.DoubleSide }), sf.art));
  }
  if (def.banks) rcBuildBanks(T, mk);
  for (const lk of T.lakes) rcBuildLake(T, lk, mk);
  def.sections.forEach((sc, k) => { if (sc.tunnel) rcBuildTunnel(T, k, sc.tunnel, g); });
  if (T.sky) rcBuildSky(T, mk, g);
  for (const c in films) mk(films[c], new THREE.MeshLambertMaterial({ color: +c, transparent: true, opacity: RC.splash.film, depthWrite: false, side: THREE.DoubleSide })).receiveShadow = false;
  for (const c in ruts) mk(ruts[c], new THREE.MeshLambertMaterial({ color: +c, side: THREE.DoubleSide }));
  if (skirt.length) mk(skirt, artPaint(new THREE.MeshLambertMaterial({ color: RC.surfaces.sand.col, side: THREE.DoubleSide }), "sand"));
  mk(kerbR, new THREE.MeshLambertMaterial({ color: P.red, side: THREE.DoubleSide }));
  mk(kerbW, new THREE.MeshLambertMaterial({ color: 0xf2f4f7, side: THREE.DoubleSide }));
  mk(wall, new THREE.MeshLambertMaterial({ color: TUNE.palette.white, side: THREE.DoubleSide }));
  mk(line, new THREE.MeshBasicMaterial({ color: 0xf2f4f7, side: THREE.DoubleSide }));
  // the black squares under the white ones: a plain dark strip
  {
    const strip = [];
    const p = (a, ds) => [s0.x + s0.lx * a + s0.tx * ds, s0.gy + s0.ly * a + 0.03, s0.z + s0.lz * a + s0.tz * ds];
    quad(strip, p(-W, 0), p(-W, 2 * sq), p(W, 2 * sq), p(W, 0));
    mk(strip, new THREE.MeshBasicMaterial({ color: 0x1f2328, side: THREE.DoubleSide }));
  }
  // ---- the boost pads: bright chevrons he aims at (never painted: he acts on them)
  race.pads = (def.pads || RC.pads).map(p => ({ s: p.m, lat: p.lat }));   // (v173: metres)
  {
    const chev = [];
    for (const pd of race.pads) {
      for (let k = 0; k < 3; k++) {
        const ds0 = -RC.padLen / 2 + k * RC.padLen / 3;
        const q = rcAt(pd.s + ds0);
        const tip = (a, ds) => [q.x + q.lx * (pd.lat + a) + q.tx * ds, q.gy + q.ly * (pd.lat + a) + 0.08, q.z + q.lz * (pd.lat + a) + q.tz * ds];
        const hw = RC.padW / 2, d = RC.padLen / 3;
        quad(chev, tip(-hw, 0), tip(0, d * 0.6), tip(0, d), tip(-hw, d * 0.4));
        quad(chev, tip(0, d * 0.6), tip(hw, 0), tip(hw, d * 0.4), tip(0, d));
      }
    }
    race.padMesh = mk(chev, new THREE.MeshBasicMaterial({ color: 0x5ff1ff, side: THREE.DoubleSide }));
  }
  scene.add(g);
  race.venue = g;
  // ---- the start gantry over the line: two legs, a beam, three lamps facing the grid
  const gan = new THREE.Group();
  const legH = RC.gantryH, span = RC.width + 2 * KW + 4;
  const grey = mattMat(TUNE.palette.slate);
  for (const sd of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, legH, 1.2), grey);
    leg.position.set(sd * span / 2, legH / 2, 0); gan.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 2.6, 1.6), grey);
  beam.position.y = legH; gan.add(beam);
  // a chequered band along the beam
  for (let c = 0; c < 16; c++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(span / 16, 0.9, 0.1), new THREE.MeshBasicMaterial({ color: c % 2 ? 0x1f2328 : 0xf2f4f7 }));
    t.position.set(-span / 2 + span / 32 + c * span / 16, legH + 0.85, 0.85); gan.add(t);
  }
  race.lights = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: TUNE.palette.ink, fog: false }));
    m.position.set((k - 1) * 2.6, legH - 0.2, 0.9); gan.add(m); race.lights.push(m);
  }
  // facing the grid (the cars come at it along +T): its +z face toward -T
  const yaw = Math.atan2(-s0.tx, -s0.tz);
  gan.position.set(s0.x, s0.gy, s0.z); gan.rotation.y = yaw;
  castsShadow(gan);
  scene.add(gan);
  race.gantry = gan;
  // its beam and its legs are solid (the legs stand outside the barriers)
  solidBox3(s0.x, s0.gy + legH, s0.z, [-s0.lx, 0, -s0.lz], [0, 1, 0], [s0.tx, 0, s0.tz], span / 2, 1.3, 0.8, "wall");
  for (const sd of [-1, 1]) {
    const lx = s0.x + s0.lx * sd * span / 2, lz = s0.z + s0.lz * sd * span / 2;
    addSolidBox(lx, s0.gy - 1, lz, 0.8, 0.8, s0.gy + legH + 1.3, gan.children[sd < 0 ? 0 : 1], "pillar");
  }
  // ---- grandstands along the outside of the main straight, a podium on the infield
  rcBuildStands();
  rcBuildPodium();
  rcBuildFlags();
  // the ground it stands on is claimed, as every road's is: nothing streamed in it
  const claim = [];
  for (let i = 0; i < n; i += 10) claim.push({ x: S[i].x, z: S[i].z });
  // ... and its infield, so the bends are seen across open grass
  const cx = S.reduce((a, q) => a + q.x, 0) / n, cz = S.reduce((a, q) => a + q.z, 0) / n;
  for (let i = 0; i < n; i += 20) for (const f of [0.25, 0.5, 0.75]) claim.push({ x: lerp(S[i].x, cx, f), z: lerp(S[i].z, cz, f) });
  for (const st of race.stands) claim.push({ x: st.x, z: st.z });
  for (const p of T.claimMore || []) claim.push(p);          // (v174) the lake's ice and the tunnel's mountain: nothing streamed on them
  hwyClaimCorridor(claim);
  hwyIndexCorridor();
}

// ---- (v176) the sky road's pieces ---------------------------------------------------------
// Where the ribbon is up in the air (q.up): a girder under the deck and a pylon down to the
// ground every `pylonStep` m, both solid in the world -- a plane or a helicopter flown into
// the ribbon crashes, free, as into any bridge; the barriers' own solids ride up with the
// deck. Along all of the glow road, a glow on each barrier's top every `glowStep` m: one
// draw call, the shared texture, additive (glowField) -- never post-processing, and never
// on a pad (the pads are his to aim at: plain cyan, as on every track).
function rcBuildSky(T, mk, g) {
  const S = T.S, n = T.n, K = RC.sky, W = RC.width / 2 + RC.kerbW + 0.4, girder = [], pylon = [];
  const at = (q, a, up) => [q.x + q.lx * a, q.gy + q.ly * a + (up || 0), q.z + q.lz * a];
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    if (!a.up && !b.up) continue;
    for (const sd of [-1, 1]) rcQuad(girder, at(a, sd * W, -0.05), at(b, sd * W, -0.05), at(b, sd * W, -K.girder), at(a, sd * W, -K.girder));
    rcQuad(girder, at(a, -W, -K.girder), at(b, -W, -K.girder), at(b, W, -K.girder), at(a, W, -K.girder));
  }
  // the girder's solid, piece by piece: a slab under the deck, as wide as the barriers
  const step = Math.max(1, Math.round(RC.wallPiece / TK.ds));
  for (let i = 0; i < n; i += step) {
    const a = S[i], b = S[(i + step) % n];
    if (!a.up && !b.up) continue;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, dy = Math.abs(b.gy - a.gy);
    const turn = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz));   // (on a bend, long enough to close the wedge on its outside)
    solidBox3((a.x + b.x) / 2, (a.gy + b.gy) / 2 - K.girder / 2, (a.z + b.z) / 2, [dx / L, 0, dz / L], [0, 1, 0], [-dz / L, 0, dx / L],
              L / 2 + 0.3 + W * turn, K.girder / 2 + dy / 2, W, "bridge");
  }
  // the pylons, down the middle of it to the ground
  const ps = Math.max(1, Math.round(K.pylonStep / TK.ds)), hw = K.pylonW / 2;
  for (let i = 0; i < n; i += ps) {
    const q = S[i];
    if (!q.up) continue;
    const y0 = terrainEff(q.x, q.z) - 1, y1 = q.gy - K.girder + 0.05, ux = q.tx, uz = q.tz, vx = -q.tz, vz = q.tx;
    const c = (a, b, y) => [q.x + ux * a + vx * b, y, q.z + uz * a + vz * b];
    const P4 = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    for (let k = 0; k < 4; k++) { const [a0, b0] = P4[k], [a1, b1] = P4[(k + 1) % 4]; rcQuad(pylon, c(a0, b0, y0), c(a1, b1, y0), c(a1, b1, y1), c(a0, b0, y1)); }
    solidBox3(q.x, (y0 + y1) / 2, q.z, [ux, 0, uz], [0, 1, 0], [vx, 0, vz], hw, (y1 - y0) / 2, hw, "pillar");
  }
  if (girder.length) mk(girder, new THREE.MeshLambertMaterial({ color: K.girderCol, side: THREE.DoubleSide }));
  if (pylon.length) mk(pylon, new THREE.MeshLambertMaterial({ color: K.pylonCol, side: THREE.DoubleSide }));
  // the glow along its barriers
  const pts = [], gs = Math.max(1, Math.round(K.glowStep / TK.ds));
  for (let i = 0; i < n; i += gs) {
    const q = S[i];
    if (q.sf !== "glow") continue;
    for (const sd of [-1, 1]) { const p = at(q, sd * W, RC.wallH + 0.3); pts.push({ x: p[0], y: p[1], z: p[2] }); }
  }
  if (pts.length) { const gf = glowField(pts, K.glowCol, K.glowSize, K.glowOpacity); gf.userData.noSolid = true; g.add(gf); T.glow = gf; }
}

// ---- (v174) the snow track's pieces ------------------------------------------------------
// (v180) How tall a snowbank stands at a sample: low over the frozen lake, and between the two a
// slope `lakeRamp` m long inside the lake's section -- a step there was a face turned from the sun,
// a dark wedge where the ice road meets the shore. Its solid takes the lower end of each piece.
function rcBankH(T, q) {
  const B = RC.banks;
  for (const lk of T.lakes || []) if (q.sec === lk.sec) return lerp(B.h, B.lakeH, smoothstep(0, B.lakeRamp, Math.min(q.s - lk.a, lk.b - q.s)));
  return B.h;
}
const rcQuad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
// Snowbanks for barriers: a heap of snow just outside each edge, where the barrier's
// own solids stand; a red-and-white marker pole on its crest every few metres; and from
// its foot snow down to the ground, so a deck raised off it (a jump, a hollow) stands on
// a snow embankment, never on nothing.
function rcBuildBanks(T, mk) {
  const S = T.S, n = T.n, B = RC.banks, W = RC.width / 2 + RC.kerbW;
  const bank = [], red = [], white = [];
  const at = (q, a, up) => [q.x + q.lx * a, q.gy + q.ly * a + (up || 0), q.z + q.lz * a];
  const ground = (q, a) => { const x = q.x + q.lx * a, z = q.z + q.lz * a; return [x, terrainEff(x, z) - 0.3, z]; };
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    const bh = rcBankH(T, a), bhB = rcBankH(T, b);   // (low over the lake: from his seat he sees the ice)
    for (const sd of [-1, 1]) {
      // (from the kerb's edge where there is one, from the deck's own edge where there is not)
      const e0 = sd * ((RC.surfaces[a.sf] || RC.surfaces.asphalt).kerbs ? W : RC.width / 2), e1 = sd * (W + 0.4), e2 = sd * (W + B.w), e3 = sd * (W + B.w + B.skirt);   // (its crest where the barrier's solid stands)
      rcQuad(bank, at(a, e0, -0.05), at(b, e0, -0.05), at(b, e1, bhB), at(a, e1, bh));
      rcQuad(bank, at(a, e1, bh), at(b, e1, bhB), at(b, e2, -0.05), at(a, e2, -0.05));
      rcQuad(bank, at(a, e2, -0.05), at(b, e2, -0.05), ground(b, e3), ground(a, e3));
      // (v180) where the bank comes in from a kerb's edge to the deck's own, the face between the
      // two: open, it was a hole through the bank, and down it the undersides lit by the ground's green fill
      const f0 = sd * ((RC.surfaces[b.sf] || RC.surfaces.asphalt).kerbs ? W : RC.width / 2);
      if (f0 !== e0) bank.push(...at(b, e0, -0.05), ...at(b, e1, bhB), ...at(b, f0, -0.05));
    }
  }
  const pole = (p) => {
    const r = 0.16, nb = 5, hb = B.poleH / nb, c = [[-r, -r], [r, -r], [r, r], [-r, r]];
    for (let k = 0; k < nb; k++) {
      const arr = k % 2 ? white : red, y0 = p[1] - 0.3 + k * hb, y1 = y0 + hb;
      for (let j = 0; j < 4; j++) { const u = c[j], v = c[(j + 1) % 4]; rcQuad(arr, [p[0] + u[0], y0, p[2] + u[1]], [p[0] + v[0], y0, p[2] + v[1]], [p[0] + v[0], y1, p[2] + v[1]], [p[0] + u[0], y1, p[2] + u[1]]); }
    }
  };
  const step = Math.max(1, Math.round(B.poleStep / TK.ds));
  const pm = rcPodiumM(T.def);
  for (let i = 0; i < n; i += step) for (const sd of [-1, 1]) {
    if (sd > 0 && Math.abs(S[i].s - pm) < RC.podium.w * 3) continue;          // (nothing between the podium and its camera)
    pole(at(S[i], sd * (W + 0.4), rcBankH(T, S[i])));
  }
  mk(bank, new THREE.MeshLambertMaterial({ color: RC.surfaces.snow.col, side: THREE.DoubleSide })).name = "rcBanks";
  mk(red, new THREE.MeshLambertMaterial({ color: TUNE.palette.red }));
  mk(white, new THREE.MeshLambertMaterial({ color: TUNE.palette.white }));
}
// A frozen lake: a level sheet of ice on its bed (terrain.js rcLakeBed), just under the
// deck where the track crosses it, a darker band round its edge and a rim of snow. Not
// water: the ground under it is dry, and nothing asks it what the sea is (CLAUDE.md:
// water is one definition).
function rcBuildLake(T, lk, mk) {
  const L = RC.lake, Bd = T.def.lakeBed, hd = Bd.heading * DEG, cx = Bd.x, cz = Bd.z;
  const tx = -Math.sin(hd), tz = -Math.cos(hd), lx = -Math.cos(hd), lz = Math.sin(hd);
  const A = Bd.a, Bc = Bd.b, y = Bd.y + L.over;          // (on its bed: a car out of a race stands on it, not in it)
  const ice = [], shore = [], rim = [], drift = [];
  const P = (k, f) => { const t = 2 * Math.PI * k / L.segs; return [cx + (tx * Math.cos(t) * A + lx * Math.sin(t) * Bc) * f, cz + (tz * Math.cos(t) * A + lz * Math.sin(t) * Bc) * f]; };
  for (let k = 0; k < L.segs; k++) {
    const a = P(k, 1), b = P(k + 1, 1), a2 = P(k, 1.06), b2 = P(k + 1, 1.06);
    ice.push(cx, y, cz, a[0], y, a[1], b[0], y, b[1]);
    // its shore: snow from the ice's edge to the ground
    rcQuad(shore, [a[0], y + 0.02, a[1]], [b[0], y + 0.02, b[1]], [b2[0], Math.max(y, terrainEff(b2[0], b2[1])) + 0.05, b2[1]], [a2[0], Math.max(y, terrainEff(a2[0], a2[1])) + 0.05, a2[1]]);
    // a white band of frost round its edge
    const a3 = P(k, 0.95), b3 = P(k + 1, 0.95);
    rcQuad(rim, [a3[0], y + 0.01, a3[1]], [b3[0], y + 0.01, b3[1]], [b[0], y + 0.01, b[1]], [a[0], y + 0.01, a[1]]);
  }
  // streaks of snow blown across it, along the wind: what makes blue read as ICE, not water
  for (const [u0, v0, len, w] of L.drifts) {
    const p = (u, v) => [cx + tx * u * A + lx * v * Bc, y + 0.015, cz + tz * u * A + lz * v * Bc];
    rcQuad(drift, p(u0, v0), p(u0 + len, v0 + 0.08), p(u0 + len, v0 + 0.08 + w), p(u0, v0 + w));
  }
  // blue, glossy: frozen water under the deck's pale ice road
  mk(ice, new THREE.MeshPhongMaterial({ color: TUNE.palette.sea, shininess: RC.surfaces.ice.shine, specular: 0xc9ced6, side: THREE.DoubleSide }));
  mk(rim, new THREE.MeshLambertMaterial({ color: TUNE.palette.white, side: THREE.DoubleSide }));
  mk(drift, new THREE.MeshLambertMaterial({ color: TUNE.palette.white, side: THREE.DoubleSide }));
  mk(shore, new THREE.MeshLambertMaterial({ color: RC.surfaces.snow.col, side: THREE.DoubleSide }));
  const more = T.claimMore || (T.claimMore = []);
  for (let u = -A; u <= A; u += 25) for (let v = -Bc; v <= Bc; v += 25) if ((u / A) ** 2 + (v / Bc) ** 2 <= 1.1) more.push({ x: cx + tx * u + lx * v, z: cz + tz * u + lz * v });
}
// The tunnel through the mountain: on a straight, `len` m of it under a mountain heaped
// on the track -- an arched lining with lamps down both walls, a concrete portal at
// each end, snow on the mountain's slopes and rock where they are steep. The lining and
// the mountain are solid in the world (the camera keeps inside it: v163's line test).
function rcBuildTunnel(T, k, tn, g) {
  const C = RC.tunnel, S = T.S;
  let a0 = Infinity; for (const q of S) if (q.sec === k) a0 = Math.min(a0, q.s);
  const sA = a0 + tn.from, sB = sA + tn.len, sM = (sA + sB) / 2, half = C.half, H = C.h, yW = H * 0.55;
  const q0 = Object.assign({}, rcAt(sM)), tx = q0.tx, tz = q0.tz, lx = q0.lx, lz = q0.lz;
  const deckY = (s) => rcAt(clamp(s, a0, a0 + T.def.sections[k].len)).gy;
  const W = (s, v, y) => { const q = rcAt(s); return [q.x + lx * v, y, q.z + lz * v]; };
  // the lining's cross-section, left wall up, over, right wall down (lat, height)
  const arch = [[half, 0], [half, yW]];
  for (let j = 1; j < 12; j++) { const t = Math.PI * j / 12; arch.push([half * Math.cos(t), yW + (H - yW) * Math.sin(t)]); }
  arch.push([-half, yW], [-half, 0]);
  const lining = [], lamps = [], portal = [];
  for (let s = sA; s < sB - 0.01; s += 4) {
    const s2 = Math.min(sB, s + 4), y1 = deckY(s), y2 = deckY(s2);
    for (let j = 0; j < arch.length - 1; j++) {
      const p = arch[j], o = arch[j + 1];
      rcQuad(lining, W(s, p[0], y1 + p[1]), W(s2, p[0], y2 + p[1]), W(s2, o[0], y2 + o[1]), W(s, o[0], y1 + o[1]));
    }
  }
  for (let s = sA + C.lampStep / 2; s < sB; s += C.lampStep) for (const sd of [-1, 1]) {
    const y = deckY(s) + 5.5, v = sd * (half - 0.25);
    rcQuad(lamps, W(s - 1.6, v, y), W(s + 1.6, v, y), W(s + 1.6, v, y + 0.6), W(s - 1.6, v, y + 0.6));
  }
  for (const [s, f] of [[sA, -1], [sB, 1]]) {
    const y = deckY(s);
    for (let j = 0; j < arch.length - 1; j++) {
      const p = arch[j], o = arch[j + 1], P2 = [p[0] * 1.14, p[1] * 1.12 + (p[1] > 0 ? 0 : 0)], O2 = [o[0] * 1.14, o[1] * 1.12];
      rcQuad(portal, W(s, p[0], y + p[1]), W(s, o[0], y + o[1]), W(s + f * 0.5, O2[0], y + O2[1]), W(s + f * 0.5, P2[0], y + P2[1]));
    }
  }
  const mkM = (arr, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m; };
  // (lit: a tunnel he can see into from outside and see the cars in -- readability over realism)
  mkM(lining, new THREE.MeshLambertMaterial({ color: TUNE.palette.concrete, emissive: TUNE.palette.concrete, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  mkM(lamps, new THREE.MeshBasicMaterial({ color: TUNE.palette.warning, side: THREE.DoubleSide }));
  mkM(portal, new THREE.MeshLambertMaterial({ color: TUNE.palette.grey, side: THREE.DoubleSide }));
  // ---- the mountain over it: a height field in the track's frame, open in a cutting
  // in front of each portal, snow where it is gentle and rock where it is steep
  const Lh = tn.len / 2, Uo = Lh + C.apron, Vo = half + C.foot, cut = half + 3;
  const uN = [], vN = [];
  for (let u = -Uo; u <= Uo + 0.01; u += 8) uN.push(u);
  uN.push(-Lh, Lh, -Lh - 0.05, Lh + 0.05, Uo); uN.sort((a, b) => a - b);
  for (let k = uN.length - 1; k > 0; k--) if (uN[k] - uN[k - 1] < 0.01) uN.splice(k, 1);
  for (let v = -Vo; v <= Vo + 0.01; v += 8) if (Math.abs(v) > cut) vN.push(v);
  vN.push(-cut, cut, -half - 1, half + 1, -Vo, Vo);
  for (const p of arch) vN.push(p[0] * 1.14);                 // (the portal's outline: the face over it meets it exactly)
  vN.sort((a, b) => a - b);
  for (let k = vN.length - 1; k > 0; k--) if (vN[k] - vN[k - 1] < 0.01) vN.splice(k, 1);
  const open = (u, v) => Math.abs(u) > Lh && Math.abs(v) < cut - 0.01;
  // the portal ring's outer edge over the deck, at lat v (the arch scaled as the ring is)
  const ringY = (v) => {
    const w = Math.abs(v) / 1.14;
    if (w >= half) return 0;
    return 1.12 * (w <= half * 0.001 ? H : yW + (H - yW) * Math.sqrt(Math.max(0, 1 - (w / half) ** 2)));
  };
  const hy = (u, v) => {
    const wq = rcAt(sM + u), x = wq.x + lx * v, z = wq.z + lz * v, gr = terrainEff(x, z) - 0.5;
    if (open(u, v)) return gr;
    // (crags on top: a mountain, not a dome)
    const crag = 1 + C.crag * (valueNoise(wq.x / 30 + 3.7, wq.z / 30 + 1.9) * 2 - 1);
    const top = deckY(sM + u) + H + 1.5 + C.over * crag * Math.pow(Math.cos(Math.PI / 2 * Math.min(1, Math.abs(v) / Vo)), 2.6) * (1 - 0.35 * Math.min(1, (u / Uo) ** 2));
    const fV = 1 - smoothstep(half + 2, Vo, Math.abs(v)), fU = 1 - smoothstep(Lh, Uo, Math.abs(u));
    return Math.max(gr, lerp(gr, top, Math.min(fV, fU)));
  };
  const Y = uN.map(u => vN.map(v => hy(u, v)));
  const pos = [], col = [], cSnow = new THREE.Color(RC.surfaces.snow.col), cRock = new THREE.Color(TUNE.palette.grey);   // (grey, not slate: the dark mouth is what must stand out)
  const vtx = (i, j) => { const wq = rcAt(sM + uN[i]); return [wq.x + lx * vN[j], Y[i][j], wq.z + lz * vN[j]]; };
  const tri = (a, b, c, force) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
    const k = force || (Math.abs(ny / nl) < C.rockBelow ? cRock : cSnow);
    pos.push(...a, ...b, ...c); for (let r = 0; r < 3; r++) col.push(k.r, k.g, k.b);
  };
  // (a height field cannot overhang: the cells over each cutting are left out, and its
  // walls and the face over each portal are built standing)
  for (let i = 0; i < uN.length - 1; i++) for (let j = 0; j < vN.length - 1; j++) {
    if (open(uN[i], vN[j]) || open(uN[i + 1], vN[j]) || open(uN[i], vN[j + 1]) || open(uN[i + 1], vN[j + 1])) continue;
    if (Math.abs(vN[j] + vN[j + 1]) / 2 < cut && (uN[i] + uN[i + 1]) / 2 < -Lh || (uN[i] + uN[i + 1]) / 2 > Lh && Math.abs(vN[j] + vN[j + 1]) / 2 < cut) continue;
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1);
    tri(a, b, c); tri(a, c, d);
  }
  const iA = uN.indexOf(-Lh), iB = uN.indexOf(Lh);
  for (let j = 0; j < vN.length - 1; j++) {
    if (Math.abs(vN[j]) > cut + 0.01 || Math.abs(vN[j + 1]) > cut + 0.01) continue;
    for (const i of [iA, iB]) {
      const s = sM + uN[i], y = deckY(s);
      const b0 = W(s, vN[j], y + ringY(vN[j])), b1 = W(s, vN[j + 1], y + ringY(vN[j + 1]));
      tri(b0, b1, vtx(i, j + 1)); tri(b0, vtx(i, j + 1), vtx(i, j));
    }
  }
  for (const sd of [-1, 1]) {
    const j = vN.indexOf(sd * cut);
    for (let i = 0; i < uN.length - 1; i++) {
      if (Math.abs(uN[i]) < Lh - 0.01 || Math.abs(uN[i + 1]) < Lh - 0.01) continue;
      const g0 = rcAt(sM + uN[i]), g1 = rcAt(sM + uN[i + 1]);
      const p0 = [g0.x + lx * sd * cut, terrainEff(g0.x + lx * sd * cut, g0.z + lz * sd * cut) - 0.5, g0.z + lz * sd * cut];
      const p1 = [g1.x + lx * sd * cut, terrainEff(g1.x + lx * sd * cut, g1.z + lz * sd * cut) - 0.5, g1.z + lz * sd * cut];
      tri(p0, p1, vtx(i + 1, j), cSnow); tri(p0, vtx(i + 1, j), vtx(i, j), cSnow);
    }
  }
  // the height as DRAWN at (u, v): the two triangles of its grid cell, as tri() laid them (a,b,c / a,c,d)
  const drawnY = (u, v) => {
    let i = 0; while (i < uN.length - 2 && uN[i + 1] <= u) i++;
    let j = 0; while (j < vN.length - 2 && vN[j + 1] <= v) j++;
    const s = clamp((u - uN[i]) / (uN[i + 1] - uN[i] || 1), 0, 1), t = clamp((v - vN[j]) / (vN[j + 1] - vN[j] || 1), 0, 1);
    const a = Y[i][j], b = Y[i + 1][j], c = Y[i + 1][j + 1], d = Y[i][j + 1];
    return s >= t ? a + (b - a) * s + (c - b) * t : a + (c - d) * s + (d - a) * t;
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  // (v180) each face lit as if it leaned `snowUp` back toward the sky: faceted still, but a
  // slope turned from the sun is snow in the shade, not a grey dome (readability over realism)
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < pos.length; t += 9) {
    const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2];
    const vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // (on its own winding's side -- the material is two-sided and turns a normal to the side seen --
    // and the snow faces only: a standing face, rock or a portal's wall, keeps its own)
    if (Math.abs(ny) >= C.rockBelow) ny += Math.sign(ny) * C.snowUp;
    const bl = Math.hypot(nx, ny, nz);
    for (let v = 0; v < 3; v++) { nrm[t + v * 3] = nx / bl; nrm[t + v * 3 + 1] = ny / bl; nrm[t + v * 3 + 2] = nz / bl; }
  }
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  const mt = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: false, shininess: 0, specular: 0x000000, side: THREE.DoubleSide }));   // (its normals are per face: faceted still)
  mt.name = "rcMountain";
  mt.receiveShadow = true; g.add(mt);   // (it casts no shadow: under it the road and the cars stay as bright as outside)
  // ---- its solids, in the track's frame: the lining's walls, and the mountain in
  // pieces -- over the roof down to it, beside the lining down to the ground (each
  // piece's top the lowest of the mountain over it: never a wall where there is air)
  const U = [tx, 0, tz], V = [0, 1, 0], Wv = [lx, 0, lz];
  for (let s = sA; s < sB - 0.01; s += C.piece) {
    const s2 = Math.min(sB, s + C.piece), y = Math.min(deckY(s), deckY(s2)), m = rcAt((s + s2) / 2);
    for (const sd of [-1, 1]) solidBox3(m.x + lx * sd * (half + 0.4), y + H / 2, m.z + lz * sd * (half + 0.4), U, V, Wv, (s2 - s) / 2, H / 2 + 0.5, 0.4, "wall");
  }
  // (in cells `cell` m along by `strip` m across: over the lining, flat boxes down to its roof;
  // beside it, down into the ground. Each one's top is the lowest of the mountain over it, so a
  // plane never meets air it cannot see; narrow across the slope, so little it can see is not
  // solid -- race_track_checks o measures both)
  const strips = [];
  for (let v = -half - 1; v < half + 1 - 0.01; v += C.cell) strips.push([v, Math.min(half + 1, v + C.cell), true]);
  for (let v = half + 1; v < Vo * 0.9; v += C.strip) { const v2 = Math.min(Vo * 0.9, v + C.strip); strips.push([v, v2, false], [-v2, -v, false]); }
  for (let u = -Uo, du; u < Uo - 0.01; u += du) {
    // (narrow along the track too where the mountain falls toward a portal's end)
    du = Math.abs(u) > Lh - C.cell || Math.abs(u + C.cell) > Lh - C.cell ? C.strip : C.cell;
    const u2 = Math.min(Uo, u + du), m = Object.assign({}, rcAt(sM + (u + u2) / 2));   // (a copy: rcAt answers in one shared object)
    for (const [v0, v1, roof] of strips) {
      if (roof && (u < -Lh || u2 > Lh)) continue;                  // (the cutting in front of a portal is open)
      let top = Infinity, gr = Infinity;
      const us = [u, (u + u2) / 2, u2].concat(uN.filter(x => x > u && x < u2)), vs = [v0, (v0 + v1) / 2, v1].concat(vN.filter(x => x > v0 && x < v1));
      for (const uu of us) for (const vv of vs) {
        if (open(uu, vv)) continue;
        top = Math.min(top, drawnY(uu, vv)); const wq = rcAt(sM + uu); gr = Math.min(gr, terrainEff(wq.x + lx * vv, wq.z + lz * vv));
      }
      if (!isFinite(top)) continue;
      top -= roof ? 0.5 : C.under;
      const bot = roof ? deckY(sM + (u + u2) / 2) + H : gr - 1;
      if (top - bot < (roof ? 1 : 4)) continue;                     // (the last 3 m of its foot: there the ground is the mountain)
      const vc = (v0 + v1) / 2;
      solidBox3(m.x + lx * vc, (top + bot) / 2, m.z + lz * vc, U, V, Wv, (u2 - u) / 2, (top - bot) / 2, (v1 - v0) / 2, roof ? "wall" : "rock");
    }
  }
  const more = T.claimMore || (T.claimMore = []);
  for (let u = -Uo; u <= Uo; u += 20) for (let v = -Vo; v <= Vo; v += 20) { const wq = rcAt(sM + u); more.push({ x: wq.x + lx * v, z: wq.z + lz * v }); }
  T.tunnels = (T.tunnels || []).concat([{ sA, sB, half, h: H }]);
}

// The stands: stepped tiers in the palette's seat colours under a roof, outside
// the main straight (the side away from the infield). The main straight runs
// along a world axis, so their boxes -- and their solids -- are true to it.
function rcBuildStands() {
  const T = race.track, St = Object.assign({}, RC.stands, T.def.stands);
  const seat = [TUNE.palette.blue, TUNE.palette.red, TUNE.palette.warning, TUNE.palette.green];
  const off = RC.width / 2 + RC.kerbW + St.back, D = St.depth, L = St.len, H = St.rise;
  race.stands = [];
  for (let k = 0; k < St.count; k++) {
    const q = rcAt(St.from + k * St.step);   // (v173: metres from the line)
    race.stands.push({ q: { x: q.x, z: q.z, lx: q.lx, lz: q.lz, tx: q.tx, tz: q.tz, gy: q.gy }, x: q.x - q.lx * (off + D / 2), z: q.z - q.lz * (off + D / 2) });
  }
  const x0 = race.stands[0].x, z0 = race.stands[0].z, yg = terrainEff(x0, z0) - 0.5;
  const g = new THREE.Group();
  g.userData.trackSolids = true; g.userData.pending = []; g.userData.solidKind = "building";
  race.stands.forEach((st, k) => {
    const q = st.q, ax = Math.abs(q.tx) > Math.abs(q.tz);      // long along x, or along z
    for (let t = 0; t < 4; t++) {
      const d = D / 4, out = off + d * t + d / 2;
      const cx = q.x - q.lx * out, cz = q.z - q.lz * out, base = terrainEff(cx, cz) - 0.5;
      const top = q.gy + H * (t + 1) / 4, h = top - base;
      lmBox(g, ax ? L : d, h, ax ? d : L, seat[(k + t) % 4], cx - x0, base + h / 2 - yg, cz - z0, true, null);
    }
    // the roof on four posts
    const top = q.gy + H + 5;
    lmBox(g, ax ? L + 2 : D + 2, 0.8, ax ? D + 2 : L + 2, TUNE.palette.white, st.x - x0, top - yg, st.z - z0, true, null);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const px = st.x + (ax ? a * L / 2 : b * D / 2), pz = st.z + (ax ? b * D / 2 : a * L / 2), base = terrainEff(px, pz) - 0.5;
      lmBox(g, 0.6, top - base, 0.6, TUNE.palette.grey, px - x0, (top + base) / 2 - yg, pz - z0, true, null);
    }
  });
  addRouteLandmark(g, x0, z0, "raceStands");
  race.standsG = g;
}

// The podium: three steps on the infield beside the line, gold in the middle
// (the tallest), silver to its left, bronze to its right, facing the track.
function rcBuildPodium() {
  const q = rcAt(rcPodiumM(race.track.def));
  const off = RC.width / 2 + RC.kerbW + RC.podium.back;
  const cx = q.x + q.lx * off, cz = q.z + q.lz * off, gy = terrainEff(cx, cz);
  const g = new THREE.Group();
  const face = Math.atan2(q.lx, q.lz);          // its front faces the track (-left)
  const steps = [[0, RC.podium.h[0], TUNE.palette.gold], [-1, RC.podium.h[1], TUNE.palette.steel], [1, RC.podium.h[2], TUNE.palette.rust]];
  race.podiumSpots = [];
  for (const [k, h, c] of steps) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(RC.podium.w, h, RC.podium.d), mattMat(c));
    m.position.set(k * RC.podium.w, h / 2, 0); g.add(m);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(RC.podium.w * 3 + 4, 9, 0.6), mattMat(TUNE.palette.blue));
  back.position.set(0, 4.5, -RC.podium.d / 2 - 2); g.add(back);
  g.position.set(cx, gy, cz); g.rotation.y = face + Math.PI;
  castsAndReceives(g);
  scene.add(g);
  race.podiumG = g;
  // where each place stands, in the world: 1st on the middle step and so on
  g.updateMatrixWorld(true);
  for (const [k, h] of steps) {
    const v = new THREE.Vector3(k * RC.podium.w, h, 0).applyMatrix4(g.matrixWorld);
    race.podiumSpots.push({ x: v.x, y: v.y, z: v.z });
  }
  race.podiumFace = face;                       // the cars on it face the track, and the camera on it
  race.podiumC = { x: cx, y: gy, z: cz, fx: -q.lx, fz: -q.lz };
  // its solids turned as it is: each step, and the board behind
  const ux = Math.cos(g.rotation.y), uz = -Math.sin(g.rotation.y);     // its local x, in the world
  const wx = Math.sin(g.rotation.y), wz = Math.cos(g.rotation.y);      // its local z
  steps.forEach(([k, h], i) => {
    const v = new THREE.Vector3(k * RC.podium.w, h / 2, 0).applyMatrix4(g.matrixWorld);
    solidBox3(v.x, v.y - 0.5, v.z, [ux, 0, uz], [0, 1, 0], [wx, 0, wz], RC.podium.w / 2, h / 2 + 0.5, RC.podium.d / 2, "building");
  });
  const bv = new THREE.Vector3(0, 4.5, -RC.podium.d / 2 - 2).applyMatrix4(g.matrixWorld);
  solidBox3(bv.x, bv.y, bv.z, [ux, 0, uz], [0, 1, 0], [wx, 0, wz], (RC.podium.w * 3 + 4) / 2, 4.5, 0.3, "wall");
  // the trophy: a gold cup, shown only over his car when he wins
  const cup = new THREE.Group(), gold = metalMat(TUNE.palette.gold, 80, 0xfff2a8);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.7, 2.2, 14), gold); bowl.position.y = 3.4; cup.add(bowl);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8), gold); stem.position.y = 1.6; cup.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.7, 12), gold); base.position.y = 0.6; cup.add(base);
  for (const sd of [-1, 1]) {
    const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.18, 6, 12, Math.PI), gold);
    hnd.position.set(sd * 1.7, 3.5, 0); hnd.rotation.z = sd * Math.PI / 2; cup.add(hnd);
  }
  cup.scale.setScalar(RC.podium.trophy);
  cup.visible = false; cup.userData.noSolid = true;
  scene.add(cup);
  race.trophy = cup;
  // it stands on a plinth on top of the board, over the gold step -- never in the air
  // over his car, where the monster truck sent it 11 m up with nothing under it
  // (as tall as it must be for the cup to stand clear over his car: rcTrophyStand)
  const P = RC.podium.stand, stand = new THREE.Group();
  const blk = new THREE.Mesh(new THREE.BoxGeometry(P.w, 1, P.d), mattMat(TUNE.palette.white)); blk.position.y = 0.5; stand.add(blk);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(P.w + 0.4, 0.3, P.d + 0.4), gold); stand.add(cap);
  stand.position.set(0, 9, -RC.podium.d / 2 - 2); stand.visible = false; g.add(stand);
  stand.userData.blk = blk; stand.userData.cap = cap;
  race.trophyStand = stand;
}

// Flags on poles along the outside of the bends, and the chequered pair at the line.
function rcBuildFlags() {
  const T = race.track, P = TUNE.palette, cols = [P.red, P.warning, P.blue, P.green, P.white, P.cyan];
  const g = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 9, 6), flagGeo = new THREE.PlaneGeometry(3, 2);
  race.flags = [];
  let k = 0;
  for (let s = 0; s < T.len; s += RC.flagStep) {
    const q = rcAt(s);
    if (Math.abs(q.kh) < 0.0015 && s > 120) continue;
    if (Math.abs(s - rcPodiumM(T.def)) < 60) continue;          // nothing between the podium and the camera
    if (T.S[Math.min(T.n - 1, Math.round(s / T.len * (T.n - 1)))].up) continue;   // (v176: in the sky, no flag on a pole from the ground)
    const side = q.kh > 0 ? -1 : 1;               // the outside of the bend
    const off = side * (RC.width / 2 + RC.kerbW + 3);
    const x = q.x + q.lx * off, z = q.z + q.lz * off, y = terrainEff(x, z);
    const pole = new THREE.Mesh(poleGeo, mattMat(TUNE.palette.steel)); pole.position.set(x, y + 4.5, z); g.add(pole);
    const fl = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: cols[k++ % cols.length], side: THREE.DoubleSide }));
    fl.position.set(x, y + 8, z); g.add(fl); race.flags.push({ m: fl, ph: k * 1.7 });
  }
  scene.add(g);
}

// ---- the racers --------------------------------------------------------------------------
// The roster: the other cars he can drive, then the traffic's taxi and hatchback.
// Never his own; the first RC.field of what is left.
function rcRoster(mine) {
  return RC.roster.filter(k => k !== mine).slice(0, RC.field);
}
function rcMeshFor(key) {
  const kept = (race.meshes || (race.meshes = {}))[key];
  if (kept) { scene.add(kept); kept.visible = true; return kept; }
  const seed0 = vkSeed;
  const m = vkQuiet(0, () => {
    let m = null;
    if (key === "monster") m = buildMonsterModel();
    else if (key === "taxi" || key === "hatch") {
      const im = vkMesh(key, 0, 1);
      im.userData.vkRoll = new Float32Array(3);
      im.userData.tint = key === "taxi" ? 0xffd23e : RC.hatchColour;
      const grp = new THREE.Group(); grp.add(im); grp.userData.vk = im; m = grp;
    } else m = modelInstance(key) || (() => { const im = vkMesh("sedan", 0, 1); im.userData.vkRoll = new Float32Array(3); im.userData.tint = 0x8a93a0; const grp = new THREE.Group(); grp.add(im); grp.userData.vk = im; return grp; })();
    castsShadow(m);
    m.traverse(o => { o.userData.noSolid = true; });
    m.userData.rcRacer = true;
    // its wheels on the deck: the lowest point of the body at its origin's height
    rcBox.setFromObject(m);
    m.userData.rcLift = m.userData.vk ? 0 : -rcBox.min.y;
    m.userData.rcLen = m.userData.vk ? (key === "taxi" || key === "hatch" ? 7.6 : 7.6) : rcBox.max.z - rcBox.min.z;
    m.userData.rcWid = m.userData.vk ? 3.4 : rcBox.max.x - rcBox.min.x;
    scene.add(m);
    return m;
  });
  vkSeed = seed0;
  race.meshes[key] = m;
  return m;
}
function rcMakeRacer(key, isHim, i) {
  const r = { key, isHim, i, s: 0, lat: 0, v: 0, latV: 0, burstT: 0, burstCool: 0, padT: 0, boosting: false,
              done: false, finishT: 0, place: 0, lapsDone: 0, skill: 1, line: 0, lineT: 0, aim: null, mesh: null,
              len: 7.6, wid: 3.4, yaw: 0, bumpT: 0, aiBurst: 0, wantBurst: false };
  if (isHim) {
    r.mesh = vehicleModel;
    r.len = state.vp.monster ? 12 : 7.6; r.wid = state.vp.monster ? 5.8 : 3.4;
  } else {
    r.mesh = rcMeshFor(key);
    r.len = Math.max(5, Math.min(13, r.mesh.userData.rcLen || 7.6));
    r.wid = Math.max(2.5, Math.min(6, r.mesh.userData.rcWid || 3.4));
    rcSkillFor(r, i);
    r.lineT = rcRnd() * 10;
  }
  return r;
}
// An opponent's skill and line go with its place on the grid (the i-th behind
// him), never with which car it is: the field he meets is the same whatever he
// drives, and only the giant's place at the back moves who sits where.
function rcSkillFor(r, i) {
  const A = RC.ai, k = (i - 1) / Math.max(1, RC.field - 1);
  r.skill = lerp(A.skill[0], A.skill[1], k) * A.strength * (race.track.def.aiMul || 1);   // (a track's own: its bends favour a clean line more than his hand)
  r.line = (k - 0.5) * RC.width * 0.5;
}
function rcClearRacers() {
  for (const r of race.racers) if (!r.isHim && r.mesh) { rcUnscale(r.mesh); scene.remove(r.mesh); }
  race.racers = []; race.him = null;
}

// ---- in and out ------------------------------------------------------------------------
// The picker of tracks. Its own screen, so menuOpen() holds the world off.
function raceOpenPicker() {
  if (!raceCarOK() || race.on || state.exploding) return;
  rcBuild();
  el.screenRace.classList.remove("hiddenS");
  unlockAudio();
}
function raceClosePicker() { el.screenRace.classList.add("hiddenS"); }

function rcStartRace(trackId, seed) {
  rcBuild();
  rcUse(trackId);
  race.seedN = (race.seedN || 0) + 1;
  rcSeed = (seed === undefined ? race.seedN * 7919 : seed) >>> 0;
  raceClosePicker();
  if (!race.on) {
    // where he was, to come back to
    race.saved = {
      x: state.x, y: state.y, z: state.z, heading: state.heading, viewChase: state.viewChase,
      road: typeof stPlan !== "undefined" ? stPlan.road : null, dir: typeof stPlan !== "undefined" ? stPlan.dir : 1,
      onSpurRoad: car.onSpurRoad, spurRec: car.spurRec, onStreet: car.onStreet,
    };
  }
  if (typeof policeStop === "function" && typeof police !== "undefined" && police.active) policeStop(false);
  if (typeof carHornRelease === "function") carHornRelease();
  rcClearRacers();
  race.on = true; race.phase = "grid"; race.t = 0; race.finished = 0; race.order = [];
  race.stuckT = 0; race.stuck = 0; race.shoves = 0; race.wallShoves = 0; race.glideT = 0; race.padHits = 0; race.bangs0 = flags.carCrashes || 0;
  race.podium = null; race.confT = 0; race.fwT = 0;
  if (race.trophy) race.trophy.visible = race.trophyStand.visible = false;
  race.loseShot = null;
  rcUnscale(vehicleModel);                    // (again, from the podium: measured at his own size, not the step's)
  rcMeasureHim();
  const him = rcMakeRacer(state.vehicleKey, true, 0);
  race.racers.push(him); race.him = him;
  rcRoster(state.vehicleKey).forEach((k, i) => race.racers.push(rcMakeRacer(k, false, i + 1)));
  // the grid: two by two behind the line, him in the middle of the pack
  const slots = [];
  for (let k = 0; k < race.racers.length; k++) slots.push({ s: -RC.grid.first - Math.floor(k / 2) * RC.grid.row, lat: (k % 2 ? -1 : 1) * RC.grid.lat });
  const order = race.racers.slice(1).sort((a, b) => (a.key === "monster") - (b.key === "monster"));   // the giant at the back
  order.forEach((r, k) => rcSkillFor(r, k + 1));
  order.splice(Math.min(order.length, RC.grid.him), 0, him);
  order.forEach((r, k) => { r.s = slots[k].s - (k === order.length - 1 ? RC.grid.lastBack : 0); r.lat = slots[k].lat; r.v = 0; r.latV = 0; r.lapsDone = 0; r.done = false; r.place = 0; });   // (the last slot -- the giant's, when it races -- a row further back: its wheels filled his chase camera. The slot, not the car, so the field is the same whatever he drives)
  state.speed = 0; state.exploding = false; state.pitch = 0; state.bank = 0;
  car.steer = 0; car.boost = 0;
  for (const L of race.lights) L.material.color.setHex(TUNE.palette.ink);
  el.raceHud.classList.remove("hidden");
  rcHudBuild();
  rcSyncHim(him);
  rcPoseAll(0);
  rcCamSnap();
  el.bigNum.classList.add("race");                // the count between the gantry's lamps and his car (up in the sky it covered the order strip in landscape)
  flags.raceStarts = (flags.raceStarts || 0) + 1;
  chirp();
}

// The chase camera put straight behind him (a start, an exit): never a swoop across the map.
function rcCamSnap() {
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  camera.position.set(state.x - fx * 17, state.y + 6.5, state.z - fz * 17);
}

// Back to the world, in the same car, where he was when he asked for a race.
function raceExit() {
  if (!race.on) return;
  const sv = race.saved;
  raceReset();
  if (sv) {
    state.x = sv.x; state.y = sv.y; state.z = sv.z; state.heading = sv.heading;
    if (typeof stPlan !== "undefined") { stPlan.road = sv.road; stPlan.dir = sv.dir; stPlan.turn = null; }
    car.onSpurRoad = sv.onSpurRoad; car.spurRec = sv.spurRec;
    // nothing standing where he comes back: the traffic there moves on
    if (typeof highway !== "undefined" && highway.traffic) for (const t of highway.traffic) if (t.alive && Math.hypot(t.x - sv.x, t.z - sv.z) < 120) { t.alive = false; t.respawn = 3; }
    if (typeof stTraffic !== "undefined") for (const v of stTraffic.list) if (v.alive && Math.hypot(v.wx - sv.x, v.wz - sv.z) < 40) { v.alive = false; v.respawn = 2.5; }
  }
  state.speed = 0; car.steer = 0; car.boost = 0; car.yield = 1; car.spent = 0;
  state.pitch = 0;          // (left mid-jump, every car comes back level: the race's pitch is the race's)
  car.rejoin = null; car.rejoinT = 0; car.rejoinPts = null;
  // the monster truck comes back on its wheels, not mid-jump
  if (state.vp.monster && typeof mon !== "undefined") { mon.air = false; mon.vy = 0; mon.onRamp = null; mon.pitch = 0; state.pitch = 0; }
  rcCamSnap();
  if (typeof updateScenery === "function") updateScenery(state.x, state.z, true);
  flags.raceExits = (flags.raceExits || 0) + 1;
  chirp();
}

// Out of it without going anywhere (the picker, a relaunch): everything put away.
function raceReset() {
  if (!race.on && !race.racers.length) { if (el.screenRace) raceClosePicker(); return; }
  race.on = false; race.phase = "off";
  rcClearRacers();
  if (race.trophy) race.trophy.visible = race.trophyStand.visible = false;
  race.loseShot = null;
  if (el.raceHud) el.raceHud.classList.add("hidden");
  raceClosePicker();
  setBigNum(null); el.bigNum.classList.remove("sky", "race");
  if (car.screen) car.screen.visible = true;
  if (typeof cvUpdate === "function" && state.vp && state.vp.corvette) cvUpdate(1 / 60, false);
  setTone("raceCrowd", "sawtooth", 120, 0);
  for (const k in RC.surfaces) { const T = RC.surfaces[k].tone; if (T) setTone(T[0], T[1], T[2], 0); }
  if (typeof confetti !== "undefined") confetti.length = 0;   // the podium's confetti stays at the podium
  rcPuffsClear();                              // (v181) and the race's spray with it
  if (vehicleModel) { vehicleModel.visible = true; vehicleModel.quaternion.identity(); rcUnscale(vehicleModel); }
  camera.up.set(0, 1, 0);
  rcUse(RC.tracks[0].id);                       // out of a race, the first track is the one the world asks about
}

function raceAgain() {
  if (!race.on) return;
  rcStartRace(race.track.def.id);
}

// ---- the frame --------------------------------------------------------------------------
function rcUpdate(dt) {
  if (!race.on) return;
  race.t += dt;
  state.phase = "TAXI";
  const touching = state.touching && !menuOpen();
  const range = (TUNE.dragRangeX * Math.min(window.innerWidth, window.innerHeight)) / (CAR.dragRangeX * window.innerWidth);
  const bank = touching ? clamp(state.ctrlBank * range, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;
  const him = race.him;

  if (race.phase === "grid") rcGrid(dt);
  const going = race.phase === "race" || race.phase === "done";
  // ---- him: the same speed model as every racer, and his finger
  if (going) {
    const held = touching && pitch > RC.burstPull;      // one pull for every car (the Corvette's own lighter release made its next burst easier)
    rcHimControl(him, dt, touching, bank, held);
  } else {
    if (state.vp.corvette) cvUpdate(dt, false);
  }
  if (race.phase !== "podium") {
    // ---- them
    for (const r of race.racers) if (!r.isHim) rcAI(r, dt, going);
    // ---- everyone along and across the track, then the shoves
    for (const r of race.racers) rcMove(r, dt);
    rcContacts(dt);
    rcLaps();
  }
  // ---- the podium: once all are home (or after a backstop, in the order they stand)
  if (race.phase === "done") {
    race.doneT = (race.doneT || 0) + dt;
    if (race.finished >= race.racers.length || race.doneT > RC.finishWait) rcToPodium();
  }
  if (race.phase === "podium") rcPodium(dt);
  // ---- stuck: his finger down, the race on, and him not moving
  if (race.phase === "race" && touching && him.v < RC.stuckV) { race.stuckT += dt; if (race.stuckT > RC.stuckFor) { race.stuck++; race.stuckT = -1e9; } }
  else if (race.stuckT > 0) race.stuckT = 0;
  // ---- what the shared state says about him (the camera, the model and the sound read it)
  if (race.phase !== "podium") rcSyncHim(him);
  rcPoseAll(dt);
  rcSpray(dt);
  rcHud();
  rcSound(him, touching);
  for (const f of race.flags) f.m.rotation.y = Math.sin(race.t * 2.2 + f.ph) * 0.5;
  if (race.padMesh) race.padMesh.material.color.setHSL(0.5, 1, 0.55 + 0.15 * Math.sin(race.t * 8));
}

// the countdown: the gantry's three lamps come on red, one a second, then all
// green and they go. The numeral is the wind-up counter, as every set-piece's is.
function rcGrid(dt) {
  const t = race.t, c = RC.count;
  const lit = Math.floor((t - c.lead) / c.step) + 1;
  for (let k = 0; k < 3; k++) race.lights[k].material.color.setHex(k < lit ? 0xe0483e : TUNE.palette.ink);
  const left = 3 - Math.max(0, lit) + 1;
  if (lit >= 1 && lit <= 3) { setBigNum(4 - lit); if (race.lastLit !== lit) { race.lastLit = lit; synthBlip("triangle", 520, 520, 0.16, 0.18, 0); } }
  if (lit >= 4) {
    for (const L of race.lights) L.material.color.setHex(0x36c46a);
    setBigNum(null);
    race.phase = "race"; race.raceT0 = race.t; race.lastLit = 0;
    el.bigNum.classList.remove("sky", "race");
    synthBlip("triangle", 1040, 1040, 0.4, 0.24, 0);
    flags.raceGo = (flags.raceGo || 0) + 1;
  }
  return left;
}

// His speed and his line. The car's own rules: finger down drives, off eases him
// down; a steer past the deadzone moves him across; drag up is his burst.
function rcHimControl(r, dt, touching, bank, held) {
  const A = RC, step = spdMul();
  // drag up: a burst for every car, the same rule and gain -- a pull goes off for
  // burstTime and, held, goes off again. The Corvette's is its booster, flames and
  // all, burning just as long (burning only while held, a lifting finger got less)
  const cvt = !!state.vp.corvette;
  if (held && r.burstT <= 0 && r.v > A.v * 0.3) {
    r.burstT = A.burstTime;
    if (!cvt) { engSurge(0.8); cameraPunch(0.55); synthBlip("sine", 260, 1200, 0.45, 0.16, 0); }
    flags.raceBursts = (flags.raceBursts || 0) + 1;
  }
  r.boosting = r.burstT > 0;
  // A turn done is spent (car.js, the turn rule): the full steer that took a shortcut
  // reads as hands-off while the finger stays put -- held on, it drove him into the
  // shortcut's wall the whole way -- until he lifts (past liftGrace) or comes back
  // under centreBelow, or steers full the other way. Then it is his steer again.
  if (r.spent) {
    if (!touching) { r.liftT = (r.liftT || 0) + dt; if (r.liftT > CAR.liftGrace) r.spent = 0; }
    else { r.liftT = 0; if (Math.abs(bank) < CAR.centreBelow || bank * r.spent < 0) r.spent = 0; }
    if (r.spent) bank = 0;
  }
  r.inBank = touching ? bank : 0; r.inTouch = touching;      // (his drag, for a shortcut's held steer -- a spent one is no one's choice)
  if (cvt) cvUpdate(dt, r.boosting);
  if (race.phase === "done" && r.done) touching = true;          // across the line he rolls on for his cheer
  const sf = rcSurfR(r);                       // (the ground's own speed and grip: the same for every racer on it)
  const want = (touching ? A.v * step : 0) * (r.boosting ? A.burst : 1) * (r.padT > 0 ? A.pad : 1) * (r.done ? A.coolDown : 1) * sf.speed;
  rcSpeedTo(r, r.air ? r.v : want, dt);         // (in the air off a dune it carries what it took off with)
  // across the track: a rate, from the drag, past the car's own deadzone
  const dz = CAR.deadzone || 0.08;
  const steer = Math.abs(bank) < dz ? 0 : (bank - Math.sign(bank) * dz) / (1 - dz);
  // drag right = to his right, which is -left
  const wantLatV = r.done ? (0 - r.lat) * 0.5 : -steer * A.latRate * clamp(r.v / A.latFull, 0.25, 1);
  r.latV += (wantLatV - r.latV) * Math.min(1, A.latResp * sf.grip * dt);
}
function rcSpeedTo(r, want, dt) {
  if (r.glideHold > 0) { r.glideHold -= dt; if (!r.air) want *= RC.wall.glideSpeed; }   // (riding a barrier: rcEdge)
  const up = RC.accel, down = want > 1 ? RC.brake : RC.coast;
  r.v += clamp(want - r.v, -down * dt, up * dt);
  if (r.v < 0.05 && want === 0) r.v = 0;
  if (r.burstT > 0) r.burstT -= dt;
  if (r.padT > 0) r.padT -= dt;
}

// Them: the same speed model, at his step, times their skill and a little
// rubber band; a line of their own across the track, round a car in front, and
// now and then at a pad.
function rcAI(r, dt, going) {
  const A = RC.ai, him = race.him, step = spdMul();
  if (!going) { r.v = 0; r.latV = 0; return; }
  // the gap to him in metres of race (+: they are ahead)
  const lead = r.s - him.s;
  let band = 1;
  if (!him.done) {
    if (lead > A.bandFrom) band -= A.ease * clamp((lead - A.bandFrom) / A.bandSpan, 0, 1);
    else if (lead < -A.bandFrom) band += A.push * clamp((-lead - A.bandFrom) / A.bandSpan, 0, 1);
  }
  // their burst, now and then on a straight, never all at once
  r.aiBurst -= dt;
  if (r.aiBurst <= 0) { r.aiBurst = lerp(A.burstEvery[0], A.burstEvery[1], rcRnd()); r.wantBurst = rcRnd() < A.burstP; }
  const q = rcAt(r.s);
  if (r.wantBurst && Math.abs(q.kh) < 0.002 && r.burstT <= 0 && r.v > RC.v * 0.5) { r.burstT = RC.burstTime; r.wantBurst = false; }
  r.boosting = r.burstT > 0;
  const sf = rcSurfR(r);
  const want = RC.v * step * r.skill * band * (r.boosting ? RC.burst : 1) * (r.padT > 0 ? RC.pad : 1) * (r.done ? RC.coolDown : 1) * sf.speed;
  rcSpeedTo(r, r.air ? r.v : want, dt);
  // where across: their line, slowly wandering; a pad ahead, if they go for it;
  // round a car close in front
  r.lineT += dt;
  let aim = r.line + Math.sin(r.lineT * A.wander[0] + r.i) * A.wander[1];
  // the inside of a bend is shorter, and the good ones know it
  if (Math.abs(q.kh) > 0.002 && !r.path) aim = lerp(aim, Math.sign(q.kh) * RC.width * 0.3, A.inside);
  // a shortcut, now and then (its own choice once per pass); on one, down its middle
  for (const sc of race.track.sc) {
    if (r.path) break;
    const ahead = rcAhead(sc.sa + sc.gore, r.s);
    if (ahead > 0 && ahead < A.padSee + sc.gore) { if (r.scFor !== sc) { r.scFor = sc; r.scGo = rcRnd() < A.shortcutP; } if (r.scGo) aim = sc.side * (RC.width / 2 - sc.mouth / 2); }
  }
  if (r.path) aim = Math.sin(r.lineT * A.wander[0] + r.i) * Math.min(A.wander[1], r.path.half / 3);
  for (const pd of race.pads) {
    if (r.path) break;
    const ahead = rcAhead(pd.s, r.s);
    if (ahead > 0 && ahead < A.padSee) { if (r.aim !== pd) { r.aim = pd; r.aimGo = rcRnd() < A.padP; } if (r.aimGo) aim = pd.lat; }
  }
  for (const o of race.racers) {
    if (o === r || o.path !== r.path) continue;
    const ds = rcGap(o.s, r.s);
    if (ds > 0 && ds < A.passSee && Math.abs(o.lat - aim) < (o.wid + r.wid) / 2 + 1) {
      // pass on whichever side has more room
      const hw = r.path ? r.path.half : RC.width / 2, left = hw - o.lat, right = o.lat + hw;
      aim = o.lat + (left > right ? 1 : -1) * ((o.wid + r.wid) / 2 + 1.5);
    }
  }
  const lim = (r.path ? r.path.half : RC.width / 2) - r.wid / 2 - 0.3;
  aim = clamp(aim, -lim, lim);
  const wantLatV = clamp((aim - r.lat) * A.steerK, -RC.latRate, RC.latRate);
  r.latV += (wantLatV - r.latV) * Math.min(1, RC.latResp * sf.grip * dt);
}

// metres from b forward to a along the lap (0..len), and the signed gap a-b in race metres
function rcAhead(a, b) { const L = race.track.len; let d = (a - b) % L; if (d < 0) d += L; return d; }
function rcGap(a, b) { const L = race.track.len; let d = (a - b) % L; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }

// Along and across. The inside of a bend goes by faster in metres of track; the
// barrier is a shove back on to it; a pad gives its push.
function rcMove(r, dt) {
  if (r.path) { rcMoveSc(r, dt); return; }
  const q = rcAt(r.s);
  r.lat += r.latV * dt;
  // (v174) snow and ice: on a bend every car swings wide -- by how hard the bend pulls,
  // up to the surface's `slideMax` -- and comes back to its line as it straightens: the
  // slip eases in and out, so hands-off he is back where he was (lane-keep holds)
  const sl = rcSurfAt(r.s), slip0 = r.slip || 0;
  const slipTo = sl.slide && !r.air ? -Math.sign(q.kh) * Math.min(sl.slideMax, sl.slide * r.v * r.v * Math.abs(q.kh)) : 0;
  r.slip = slip0 + (slipTo - slip0) * Math.min(1, (sl.slideRate || RC.surfaces.snow.slideRate) * dt);
  r.lat += r.slip - slip0;
  const lim = RC.width / 2 - r.wid / 2 - 0.2;
  // (held to a shortcut's side through its approach, that edge is its way in, not a barrier)
  rcEdge(r, lim, dt, () => r.scw && race.track.sc.some(sc => { const w = r.scw.get(sc); return sc.side === Math.sign(r.lat) && w && w.on && w.ok; }));
  const f = 1 / Math.max(0.6, 1 - q.kh * r.lat);
  const prevS = r.s;
  r.s += r.v * f * dt;
  // a pad under him: caught by ONE width, whatever he drives (by its own, the giant caught more)
  for (const pd of race.pads) {
    const d = rcAhead(pd.s, prevS), dd = r.s - prevS;
    if (d >= 0 && d <= dd + 0.01 && Math.abs(r.lat - pd.lat) < RC.padW / 2 + RC.footW * 0.3) {
      r.padT = RC.padTime;
      if (r.isHim) { race.padHits++; flags.racePads = (flags.racePads || 0) + 1; whoosh(); cameraPunch(0.4); }
    }
  }
  // the heading it shows: along the track, turned by how fast it moves across
  r.yaw = Math.atan2(r.latV, Math.max(4, r.v));
  if (race.track.jumps) rcVertical(r, dt);
  // A shortcut is a fork, and a fork is the game's one turn rule (CLAUDE.md): his FULL
  // steer to its side, HELD through its approach (`hold` m before the gore; a lift
  // shorter than liftGrace is not a release). Anything less -- a light touch, a finger
  // left on that edge after a pad, hands-off -- stays on the road. The opponents go
  // only where they chose to. Past the gore on its edge: on to it, where it is.
  for (const sc of race.track.sc) {
    const L = race.track.len, nose = sc.sa + sc.gore, base = Math.floor(prevS / L) * L;
    const w = r.isHim ? rcScHold(r, sc, r.s - base - (nose - sc.hold), dt) : null;
    const chose = r.isHim ? w.on && w.ok : r.scGo && r.scFor === sc;
    if (prevS - base < nose && r.s - base >= nose && chose && sc.side * r.lat >= RC.width / 2 - sc.mouth && !r.air && !r.done) {
      rcPoint(r.s, r.lat, rcPV);
      r.path = sc; r.scBase = base; r.wallSide = undefined;
      r.u = (rcPV.x - sc.ax) * sc.dx + (rcPV.z - sc.az) * sc.dz;
      r.lat = (rcPV.x - sc.ax) * sc.lx + (rcPV.z - sc.az) * sc.lz;
      r.y = rcPV.y; r.vyG = 0;
      if (r.isHim) { flags.raceShortcuts = (flags.raceShortcuts || 0) + 1; r.spent = -sc.side; r.liftT = 0; }
      break;
    }
  }
}
// (v171) The barrier. A FRESH hit -- coming at it across the track, off it (or on the
// other one) for longer than `wall.fresh` -- is the shove it always was: a thump, a
// bounce and wallKeep of the speed. Pressed on along it after that, a held steer GLIDES:
// held at the edge, nothing back across, no sound, and a quiet drag (it aims at `wall.glideSpeed` of
// its speed) so that riding a barrier is never quicker than the racing line -- the
// inside of a bend is shorter, and a finger held into it is no free win. The same law
// for every racer.
function rcEdge(r, lim, dt, openFn) {
  const W = RC.wall;
  if (Math.abs(r.lat) <= lim) { r.wallOff = (r.wallOff || 0) + dt; return; }
  const side = Math.sign(r.lat);
  r.lat = side * lim;
  if (openFn && openFn()) { r.latV = 0; r.glideHold = 0; r.wallOff = (r.wallOff || 0) + dt; return; }   // (its way in: no thump and no drag)
  const fresh = r.wallSide !== side || (r.wallOff || 0) > W.fresh || r.wallSide === undefined;
  if (fresh && Math.sign(r.latV) === side && Math.abs(r.latV) > 1) {
    if (r.isHim) { race.wallShoves++; flags.raceWallShoves = (flags.raceWallShoves || 0) + 1; rcBump(0.25); }
    r.v *= RC.wallKeep;
    r.latV = -r.latV * 0.3;
  } else {
    if (Math.sign(r.latV) === side) r.latV = 0;
    r.glideHold = W.hold;                       // (rcSpeedTo: aiming at glideSpeed of what it would)
    if (r.isHim) race.glideT = (race.glideT || 0) + dt;
  }
  r.wallSide = side; r.wallOff = 0;
}
// His hold on a shortcut's side through its approach, by exactly the car's allowances
// (track.js tkTrackHold): a lift shorter than liftGrace is not a release, and the
// finger that lands again -- at the middle of a new drag -- has relatchFor to find its
// full steer. One per shortcut, so a track can have more than one.
function rcScHold(r, sc, rel, dt) {
  const ws = r.scw || (r.scw = new Map());
  let w = ws.get(sc);
  if (!w) { w = { on: false, ok: false, lift: 0, relatch: 0 }; ws.set(sc, w); }
  if (rel >= 0 && rel < sc.hold) {
    if (!w.on) { w.on = true; w.ok = true; w.lift = 0; w.relatch = 0; }
    const full = r.inBank * -sc.side >= CAR.fullSteer;
    if (!r.inTouch) {
      w.lift += dt;
      w.relatch = w.lift <= CAR.liftGrace ? CAR.relatchFor : 0;
      if (w.lift > CAR.liftGrace) w.ok = false;
    } else {
      w.lift = 0;
      if (full) w.relatch = 0;
      else if (w.relatch > 0) w.relatch -= dt;
      else w.ok = false;
    }
  } else if (rel < 0 || rel >= sc.hold + 5) w.on = false;
  return w;
}
function rcMoveSc(r, dt) {
  const sc = r.path;
  r.lat += r.latV * dt;
  rcEdge(r, sc.half - r.wid / 2 - 0.2, dt, null);
  r.u += r.v * dt;
  r.s = r.scBase + sc.sa + Math.min(r.u, sc.Ls) * (sc.sb - sc.sa) / sc.Ls;
  r.yaw = Math.atan2(r.latV, Math.max(4, r.v));
  r.y = rcScPoint(sc, r.u, r.lat, rcPV).y; r.air = false;
  // at its end, back on the road where it meets it
  if (r.u >= sc.Ls) { r.path = null; r.wallSide = undefined; r.s = r.scBase + sc.sb + (r.u - sc.Ls); r.lat = sc.latC + r.lat; r.vyG = 0; }
}

// (v170) Up and down: on the deck it follows it, and where the deck falls away
// faster than a car can fall -- a dune's crest -- it leaves it, flies (its launch
// capped, so the top step is a jump, not a flight) and lands on the deck again, in
// its lane: the deck is under it all the way and the barriers still hold it. How
// far it flies is its speed's alone, so the same for every car.
const rcPV = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
const rcPC = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
function rcVertical(r, dt) {
  const J = RC.jump, yd = rcPoint(r.s, r.lat, rcPV).y;
  // (what the seat shows of it: his pitch, made big enough to read, eased so it never snaps)
  if (r.isHim) r.seatP = (r.seatP || 0) + (clamp(rcAirPitch(r) * J.seatGain, -J.seatMax, J.seatMax) - (r.seatP || 0)) * Math.min(1, (r.air ? J.seatEase : J.seatSettle) * dt);
  if (r.y === undefined) { r.y = yd; r.vy = 0; r.vyG = 0; r.air = false; }
  if (r.air) {
    r.vy -= J.g * dt; r.y += r.vy * dt; r.airT += dt;
    if (r.y <= yd) {
      r.air = false; r.y = yd; r.vyG = 0;
      if (r.isHim) { flags.raceLandings = (flags.raceLandings || 0) + 1; cameraPunch(0.3); synthBlip("sine", 150, 60, 0.22, 0.22, 0); }
      const sf = rcSurfAt(r.s);
      if (sf.spray) for (const sd of [-1, 1]) { rcPoint(r.s, r.lat + sd * 0.4 * r.wid, rcPV); rcPuff(rcPV.x, rcPV.y + 0.4, rcPV.z, sf.spray, sf.size * 1.6, sf.rise, sf.life, sf.sprayA); }
    }
    return;
  }
  const vyL = Math.min(r.vyG, J.vyMax), yFree = r.y + vyL * dt - 0.5 * J.g * dt * dt;
  // (off a dune only: anywhere else the ground's own swells hopped the top step every few metres)
  if (yFree > yd + 0.001 && r.v > J.minV && rcAt(r.s).dune) {         // (a millimetre: the deck curving away faster than g, not its noise)
    r.air = true; r.airT = 0; r.vy = vyL - J.g * dt; r.y = yFree;
    if (r.isHim) flags.raceJumps = (flags.raceJumps || 0) + 1;
  } else { r.vyG = dt > 0 ? (yd - r.y) / dt : 0; r.y = yd; }
}

// A shove, never a bang: overlapping cars are pushed apart across the track, and
// the one behind gives up the speed it had over the one in front.
function rcContacts(dt) {
  const R = race.racers;
  for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) {
    const A = R[a], B = R[b];
    const ds = rcGap(A.s, B.s), dl = A.lat - B.lat;
    const needS = (A.len + B.len) / 2, needL = (A.wid + B.wid) / 2;
    if ((A.air || B.air) && Math.abs(A.y - B.y) > RC.jump.passOver) continue;     // (one over the other off a dune)
    if (A.path !== B.path) continue;                                             // (one on a shortcut, one on the road)
    if (Math.abs(ds) >= needS || Math.abs(dl) >= needL) continue;
    const pushL = (needL - Math.abs(dl)) / 2 + 0.05, sg = dl === 0 ? (A.i < B.i ? 1 : -1) : Math.sign(dl);
    // across, unless they are nose to tail
    if (needL - Math.abs(dl) < (needS - Math.abs(ds)) * 1.2) { A.lat += sg * pushL; B.lat -= sg * pushL; A.latV = sg * Math.abs(A.latV) * 0.5; B.latV = -sg * Math.abs(B.latV) * 0.5; }
    // the follower gives up its extra speed and is put just behind
    const front = ds > 0 ? A : B, back = front === A ? B : A;
    if (needL - Math.abs(dl) >= (needS - Math.abs(ds)) * 1.2) {
      back.s = front.s - needS - 0.05 - (front.s - back.s > race.track.len / 2 ? race.track.len : 0);
    }
    if (back.v > front.v) { const m = (back.v + front.v) / 2; back.v = m * RC.shoveKeep; front.v = Math.max(front.v, m); }
    if (A.isHim || B.isHim) {
      race.shoves++; flags.raceShoves = (flags.raceShoves || 0) + 1;
      if ((race.bumpCool || 0) <= 0) { rcBump(0.35); race.bumpCool = 0.4; }
    }
  }
  if (race.bumpCool > 0) race.bumpCool -= dt;
  const lim = r => (r.path ? r.path.half : RC.width / 2) - r.wid / 2 - 0.2;
  for (const r of R) r.lat = clamp(r.lat, -lim(r), lim(r));
}
function rcBump(k) { thunk(); cameraPunch(k); }

// Laps and the line. Every racer's laps are counted at the line; the third time
// over it, it is home, and its place is the order it got there.
function rcLaps() {
  const L = race.track.len;
  for (const r of race.racers) {
    const laps = Math.floor(r.s / L);
    if (laps > r.lapsDone && !r.done) {
      r.lapsDone = laps;
      if (r.isHim && laps < RC.laps) { chime(); flags.raceLaps = (flags.raceLaps || 0) + 1; }
      if (laps >= RC.laps) {
        r.done = true; r.place = ++race.finished; r.finishT = race.t - race.raceT0;
        race.order.push(r);
        if (r.isHim) {
          race.phase = "done"; race.doneT = 0;
          flags.raceFinishes = (flags.raceFinishes || 0) + 1;
          if (r.place === 1) { fanfare(); flags.raceWins = (flags.raceWins || 0) + 1; }
          else cheer();
        }
      }
    }
  }
}

// Places as they stand on the road: finished first (in their order), then by how far round.
function racePlaces() {
  return race.racers.slice().sort((a, b) => (a.done !== b.done) ? (a.done ? -1 : 1) : a.done ? a.place - b.place : b.s - a.s);
}

// ---- the podium -------------------------------------------------------------------------
function rcToPodium() {
  // anyone not home yet is placed where they stand on the road (the backstop)
  for (const r of racePlaces()) if (!r.done) { r.done = true; r.place = ++race.finished; r.finishT = race.t - race.raceT0; race.order.push(r); }
  race.phase = "podium"; race.podiumT = 0; race.him.seatP = 0; state.pitch = 0;
  const top = race.order.slice(0, 3), him = race.him, won = him.place === 1;
  race.podium = { top, won, onStep: top.includes(him) };
  top.forEach((r, k) => { r.onStep = k; });
  // the rest are off the track for it; he, if he is not on a step, comes along
  // the straight in front of it for his cheer, and stops there
  for (const r of race.racers) if (!r.isHim && !top.includes(r) && r.mesh) r.mesh.visible = false;
  if (!race.podium.onStep) {
    const L = race.track.len, ps = rcPodiumM(race.track.def);
    const base = Math.floor(him.s / L) * L;
    him.s = base + ps - RC.podium.parade; him.lat = RC.width / 2 - 2.5; him.latV = 0; him.v = RC.podium.paradeV; him.yaw = 0; him.path = null; him.air = false;
    race.paradeStop = base + ps + RC.podium.stopPast + (state.vp.monster ? RC.podium.giantPast : 0);   // (the giant stops further on, or it hides the steps)
  }
  confettiBurst(); cheer();
  if (won) {
    race.trophyFit = false;                     // (shown once his car stands on the step: rcTrophyStand)
    rcFireworks(9);
  }
  flags.racePodiums = (flags.racePodiums || 0) + 1;
  el.raceHud.classList.add("podium");
}
function rcFireworks(n) {
  if (typeof fwQueue === "undefined") return;
  const C = race.podiumC;
  for (let i = 0; i < n; i++) {
    // spread sideways behind the podium, in the sky over it -- scattered toward the
    // camera as well, they burst at the top of the frame as big grey lumps
    // (to either side of the trophy, never over it)
    const side = (i % 2 ? 1 : -1) * (RC.podium.fwClear + rcRnd() * RC.podium.fwWide), back = RC.podium.fwBack, up = RC.podium.fwUp + rcRnd() * RC.podium.fwUpRnd;
    fwQueue.push({ t: 0.2 + i * 0.45, x: C.x - C.fz * side - C.fx * back, y: C.y + up, z: C.z + C.fx * side - C.fz * back, c: fireworkColors[i % fireworkColors.length] });
    fireworkSound(i * 0.45);
  }
}
// The plinth stands on the board and reaches over his car on the gold step: its
// cap `over` m above the car's top as it stands there (measured, posed, the hop
// taken off), and never under P.h. Until then neither is shown.
function rcTrophyStand() {
  const P = RC.podium.stand, st = race.trophyStand, g = race.podiumG, m = vehicleModel, him = race.him;
  m.updateMatrixWorld(true);
  rcBox.makeEmpty();
  m.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
    if (o.userData.cvFx || o.material && (o.material.visible === false || o.material.blending === THREE.AdditiveBlending)) return;
    o.geometry.boundingBox || o.geometry.computeBoundingBox();
    rcBox2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    rcBox.union(rcBox2);
  });
  const hop = him.podPose ? him.podPose.y - race.podiumSpots[0].y : 0;
  const top = (isFinite(rcBox.max.y) ? rcBox.max.y - hop : race.podiumSpots[0].y) + RC.podium.hop.h + P.over;
  const base = new THREE.Vector3(0, 9, 0).applyMatrix4(g.matrixWorld).y;
  const h = Math.max(P.h, top - base);
  st.userData.blk.scale.y = h; st.userData.blk.position.y = h / 2; st.userData.cap.position.y = h + 0.15;
  race.trophyAt = new THREE.Vector3(0, 9 + h + 0.3, -RC.podium.d / 2 - 2).applyMatrix4(g.matrixWorld);
  race.trophy.visible = st.visible = true;
}
// When he did not make the steps, the shot is fitted to hold the podium AND his
// own car where it will stop (every car, the monster truck too), all of it inside
// the screen and above the two buttons that come up after it: the camera stays on
// the line in front of the podium (never back into the stands), slides along the
// track to centre the pair, and rises until they fit with his car clear of the steps
// (a giant in front of the bronze step hid it). Plain projection maths, no
// three.js object made in play (each would draw Math.random for its id).
function rcLoseShot() {
  const C = race.podiumC, g = race.podiumG, m = vehicleModel, him = race.him, F = RC.podium.loseFit;
  const pts = [];
  // the podium: its three steps (with the cars on them, 5 m) and the board behind
  const W = RC.podium.w * 1.5, z0 = -RC.podium.d / 2 - 2.3, z1 = RC.podium.d / 2;
  g.updateMatrixWorld(true);
  for (const x of [-W, W]) for (const y of [0, 5, 9]) for (const z of [z0, z1]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld));
  // his car as it stands now, moved on to where the parade stops it (the straight)
  m.updateMatrixWorld(true);
  rcBox.makeEmpty();
  m.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
    if (o.userData.cvFx || o.material && (o.material.visible === false || o.material.blending === THREE.AdditiveBlending)) return;
    o.geometry.boundingBox || o.geometry.computeBoundingBox();
    rcBox2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    rcBox.union(rcBox2);
  });
  const nPod = pts.length;
  if (isFinite(rcBox.max.x)) {
    // (deck point to deck point: the model's origin is not on the deck's line)
    rcPoint(him.s, him.lat, rcP); const ax = rcP.x, ay = rcP.y, az = rcP.z;
    rcPoint(race.paradeStop, him.lat, rcP);
    const dx = rcP.x - ax, dy = rcP.y - ay, dz = rcP.z - az;
    for (const x of [rcBox.min.x, rcBox.max.x]) for (const y of [rcBox.min.y, rcBox.max.y]) for (const z of [rcBox.min.z, rcBox.max.z])
      pts.push(new THREE.Vector3(x + dx, y + dy, z + dz));
  }
  // the window it must fit, in the screen's -1..1: above the buttons' top
  let yb = F.bottom;
  const b = document.getElementById("raceAgainBtn"), H = window.innerHeight || 1;
  if (b) {
    const hid = b.classList.contains("hidden");
    b.classList.remove("hidden");
    const r = b.getBoundingClientRect();
    if (hid) b.classList.add("hidden");
    if (r.height > 0) yb = 1 - 2 * r.top / H + F.gap;
  }
  // and the buttons standing at the sides: his car and the steps are never under one
  const Wd = window.innerWidth || 1, btns = [];
  for (const e of document.querySelectorAll("button")) {
    if (e.id === "raceAgainBtn" || e.id === "raceBackBtn") continue;
    const q = e.getBoundingClientRect();
    if (q.width < 1 || q.height < 1 || getComputedStyle(e).visibility === "hidden") continue;
    btns.push([2 * q.left / Wd - 1 - F.gap, 2 * q.right / Wd - 1 + F.gap, 1 - 2 * q.bottom / H - F.gap, 1 - 2 * q.top / H + F.gap]);
  }
  const under = (k) => btns.some(q => k[1] > q[0] && k[0] < q[1] && k[3] > q[2] && k[2] < q[3]);
  const yt = F.top, xw = F.side, asp = camera.aspect || 1;
  const tv = Math.tan(TUNE.fov * Math.PI / 360), th = tv * asp;
  // slide along the track: the camera faces the podium (-fx), so the track runs across it
  const tx = -C.fz, tz = C.fx;
  let c = 0;
  for (const p of pts) c += (p.x - C.x) * tx + (p.z - C.z) * tz;
  c /= pts.length;
  const pos = new THREE.Vector3(), aim = new THREE.Vector3(), f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  // lowest first, then the least slid: sliding toward the podium's side moves his (nearer)
  // car off the steps on the screen; rising drops it under them
  let best = null, done = false;
  const slides = [0];
  for (let k = F.slideStep; k <= F.slide; k += F.slideStep) slides.push(k, -k);
  for (let up = RC.podium.camUp; up <= F.maxUp && !done; up += 2) for (const sl of slides) {
    pos.set(C.x + C.fx * RC.podium.camBack + tx * (c + sl), C.y + up, C.z + C.fz * RC.podium.camBack + tz * (c + sl));
    aim.set(C.x + tx * c, C.y + 3, C.z + tz * c);
    let ok = false, ext = 0, rects = null;
    for (let it = 0; it < 12; it++) {
      f.subVectors(aim, pos); const d = f.length(); f.divideScalar(d);
      r.set(-f.z, 0, f.x).normalize(); u.crossVectors(r, f);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const sb = [Infinity, -Infinity, Infinity, -Infinity], cb = [Infinity, -Infinity, Infinity, -Infinity];   // the steps' and his car's
      pts.forEach((p, i) => {
        v.subVectors(p, pos); const z = Math.max(0.1, v.dot(f));
        const nx = v.dot(r) / (z * th), ny = v.dot(u) / (z * tv);
        x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
        const k = i < nPod ? sb : cb;
        if (i < nPod && p.y > g.position.y + 5.5) return;   // (the board behind may stand over his car; the steps and the cars on them, 5 m, may not)
        k[0] = Math.min(k[0], nx); k[1] = Math.max(k[1], nx); k[2] = Math.min(k[2], ny); k[3] = Math.max(k[3], ny);
      });
      const M = F.clear, clear = nPod === pts.length || cb[1] + M <= sb[0] || cb[0] - M >= sb[1] || cb[3] + M <= sb[2] || cb[2] - M >= sb[3];
      ok = clear && x1 - x0 <= 2 * xw && y1 - y0 <= yt - yb && !under(sb) && !under(cb);
      rects = { steps: sb, car: cb, all: [x0, x1, y0, y1], win: [-xw, xw, yb, yt], clear, btns: btns.length };
      ext = Math.max((x1 - x0) / (2 * xw), (y1 - y0) / (yt - yb));
      // turn the aim so the pair sits in the middle across, and down on the buttons' row
      // (the side buttons stand higher up: it is below them that there is room)
      const ex = (x0 + x1) / 2, ey = y0 - yb;
      if (Math.abs(ex) < 0.005 && Math.abs(ey) < 0.005) break;
      aim.addScaledVector(r, ex * d * th).addScaledVector(u, ey * d * tv);
    }
    // (failing a fit, the fullest that keeps him clear of the steps, else the fullest)
    const rank = ok ? 0 : rects.clear ? 1 + ext : 10 + ext;
    if (!best || rank < best.rank) best = { pos: pos.clone(), aim: aim.clone(), ext, clear: ok, rects, up, slide: sl, rank };
    if (ok) { done = true; break; }
  }
  race.loseShot = { pos: best.pos, aim: best.aim, aspect: camera.aspect, stopped: him.v < 0.5, fit: best.ext, ok: best.clear, rects: best.rects, up: best.up, slide: best.slide };
}
function rcPodium(dt) {
  const P = race.podium, C = race.podiumC;
  race.podiumT += dt;
  // the cars on the steps, facing the track; the winner hops for joy -- a small hop that lands
  // back on its step and sits there between hops, so it reads as standing on the top, not floating
  const H = RC.podium.hop, ph = race.podiumT % H.every, hop = ph < H.air ? Math.sin(Math.PI * ph / H.air) * H.h : 0;
  for (const r of race.racers) {
    if (r.onStep === undefined || r.onStep === null || r.onStep < 0) continue;
    const sp = race.podiumSpots[r.onStep];
    r.podPose = { x: sp.x, y: sp.y + (r.onStep === 0 ? hop : 0), z: sp.z, yaw: race.podiumFace + (r.onStep === 0 && P.won ? race.podiumT * 0.8 : 0) };
  }
  // his car, if it is not on a step, rolls on along the straight in front for its cheer
  const him = race.him;
  if (!P.onStep) {
    // along to just past the podium's middle, slowing, and stopped there
    const left = race.paradeStop - him.s;
    him.v = Math.max(0, Math.min(RC.podium.paradeV, left * 0.6));
    him.s += him.v * dt;
    rcSyncHim(him);
  } else {
    const pp = him.podPose; state.x = pp.x; state.y = pp.y; state.z = pp.z; state.heading = pp.yaw; state.speed = 0;
  }
  if (P.won && race.trophy && !race.trophyFit && him.podPose && race.podiumT > 0.05) { rcTrophyStand(); race.trophyFit = true; }
  if (P.won && race.trophy && race.trophyFit) {
    // (standing on its plinth, its base on the cap: it turns, it never lifts)
    race.trophy.position.copy(race.trophyAt).y -= 0.25 * RC.podium.trophy;
    race.trophy.rotation.y = race.podiumT * 1.2;
  }
  race.confT -= dt;
  if (race.confT <= 0) { race.confT = P.won ? 1.6 : 3.2; confettiBurst(); if (race.podiumT > 1) cheer(); }
  if (P.won) { race.fwT -= dt; if (race.fwT <= 0) { race.fwT = 4.5; if (race.podiumT > 3) rcFireworks(5); } }
}

// ---- poses -------------------------------------------------------------------------------
function rcSyncHim(r) {
  rcPointR(r, rcP);
  state.x = rcP.x; state.y = rcP.y; state.z = rcP.z;
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  const fx = rcP.tx * c + rcP.lx * s, fz = rcP.tz * c + rcP.lz * s;
  state.heading = Math.atan2(-fx, -fz);
  state.speed = r.v; state.bank = 0; state.airVy = null;
  state.pitch = rcSeatPitch(r) / DEG;          // (off a dune the centre gauge pitches with him, as the seat shows it; on the deck, level)
  forward.set(fx, 0, fz).normalize();
  r.n = { x: rcP.nx, y: rcP.ny, z: rcP.nz };
}
function rcPose(r) {
  const m = r.mesh;
  if (!m) return;
  if (race.phase === "podium" && r.podPose) {
    // on a step, every car fits its step: the giant on silver dwarfed the winner on gold
    const k = Math.min(1, RC.podium.w * RC.podium.fit / r.len);
    if (!m.userData.rcS0) m.userData.rcS0 = m.scale.clone();
    m.scale.copy(m.userData.rcS0).multiplyScalar(k);
    m.position.set(r.podPose.x, r.podPose.y + ((m.userData.rcLift || 0) + (r.isHim ? rcHimLift() : 0)) * k, r.podPose.z);
    m.quaternion.setFromAxisAngle(rcV1.set(0, 1, 0), r.podPose.yaw);
  } else {
    rcUnscale(m);
    rcPointR(r, rcP);
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    const F = rcV1.set(rcP.tx * c + rcP.lx * s, 0, rcP.tz * c + rcP.lz * s);
    const N = rcV2.set(rcP.nx, rcP.ny, rcP.nz);
    F.addScaledVector(N, -F.dot(N)).normalize();
    const R = rcV3.crossVectors(F, N).normalize();
    rcM.makeBasis(R, N, F.clone().negate());
    m.quaternion.setFromRotationMatrix(rcM);
    const lift = r.isHim ? rcHimLift() : (m.userData.rcLift || 0);
    m.position.set(rcP.x + N.x * lift, rcP.y + N.y * lift, rcP.z + N.z * lift);
  }
  const vk = m.userData.vk;
  if (vk) {
    m.updateMatrixWorld(true);
    vk.matrixAutoUpdate = false;
    rcM.identity(); vk.setMatrixAt(0, rcM);
    vkInstance(vk, 0, vk.userData.vkRoll, 0, m.matrixWorld, vk.userData.tint, VK_WHEEL_R[vk.userData.vkShape] || 0.54);
    vkCommit(vk, 1);
  }
}
function rcUnscale(m) { if (m && m.userData.rcS0) { m.scale.copy(m.userData.rcS0); delete m.userData.rcS0; } }
// his own body: the game's car models stand where the car's own pose puts them
function rcHimLift() { return race.himLift || 0; }
// measured once a race, on the body as it is built: its lowest point on the deck
function rcMeasureHim() {
  const m = vehicleModel;
  if (!m) { race.himLift = 0; return; }
  const p = m.position.clone(), q = m.quaternion.clone();
  m.position.set(0, 0, 0); m.quaternion.identity(); m.updateMatrixWorld(true);
  // only what is drawn: a box of everything took in the Corvette's hidden SUV body
  // and its flames, and floated it a metre over the deck
  rcBox.makeEmpty();
  m.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;   // (its parts: the body itself is hidden from the seat)
    if (o.userData.cvFx || o.material && (o.material.visible === false || o.material.blending === THREE.AdditiveBlending)) return;   // (flames and glows are not the body)
    o.geometry.boundingBox || o.geometry.computeBoundingBox();
    rcBox2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    rcBox.union(rcBox2);
  });
  race.himLift = isFinite(rcBox.min.y) ? -rcBox.min.y : 0;
  m.position.copy(p); m.quaternion.copy(q); m.updateMatrixWorld(true);
}
function rcPoseAll() { for (const r of race.racers) rcPose(r); }
// vehicle.js asks: his model, posed here
function racePoseModel(m) {
  if (!race.him) return;
  race.him.mesh = m;
  m.visible = state.viewChase || race.phase === "podium";
  if (m.userData.cab) m.userData.cab.visible = state.viewChase || race.phase === "podium";
  rcPose(race.him);
}

// ---- the camera ---------------------------------------------------------------------------
function raceCamera(dt) {
  const him = race.him;
  camera.up.set(0, 1, 0);
  if (race.phase === "podium") {
    // a fixed shot from the track: the podium, the stands behind, the sky for the fireworks
    const C = race.podiumC;
    // (fitted as the parade starts, to where it will stop; and again once it has, from where it stands)
    if (!race.podium.onStep && race.podiumT > 0 && (!race.loseShot || race.loseShot.aspect !== camera.aspect || (!race.loseShot.stopped && him.v < 0.5))) rcLoseShot();
    const LS = !race.podium.onStep && race.loseShot;
    if (LS) camDesired.copy(LS.pos);
    else camDesired.set(C.x + C.fx * RC.podium.camBack, C.y + RC.podium.camUp, C.z + C.fz * RC.podium.camBack);
    camera.position.lerp(camDesired, Math.min(1, 2.5 * dt));
    if (LS) lookV.lerp(LS.aim, Math.min(1, 2.5 * dt)); else lookV.set(C.x, C.y + 5, C.z);
    camera.lookAt(lookV);
    if (typeof carHideCabin === "function") carHideCabin();
    return;
  }
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const mon = !!state.vp.monster;
  if (state.viewChase) {
    const C = rcChaseCam(mon), back = C.back, up = Math.min(C.up, rcTunnelCamUp(him, back));
    // (v170) off a dune the camera keeps to the ground under him, so he is SEEN to fly
    const yb = him && him.air ? rcPoint(him.s, him.lat, rcPC).y : state.y;
    camDesired.set(state.x - fx * back, yb + up, state.z - fz * back);
    camera.position.lerp(camDesired, Math.min(1, RC.cam.lag * dt));
    // never inside the venue: the line back to him clear of its stands, gantry and walls (v163's rule)
    const ey = state.y + C.lookUp, k = solidSight(state.x, ey, state.z, camera.position.x, camera.position.y, camera.position.z, CAR.camClear.r, CAR.camClear.kinds);
    if (k < 1) camera.position.set(state.x + (camera.position.x - state.x) * k, ey + (camera.position.y - ey) * k, state.z + (camera.position.z - state.z) * k);
    lookV.set(state.x + fx * C.look, yb + C.lookUp, state.z + fz * C.look);
    camera.lookAt(lookV);
    if (typeof carHideCabin === "function") carHideCabin();
  } else if (mon) {
    const C = MON.cam;
    camera.position.set(state.x - fx * C.seatBack, state.y + C.eye, state.z - fz * C.seatBack);
    camera.rotation.set(-C.seatPitch * DEG + rcSeatPitch(him), state.heading, 0, "YXZ");
  } else {
    // the car's own seat (car.js carCamera), on the banked deck
    const K = CAR.cabin, rx = -fz, rz = fx;
    const bodyH = (vehicleModel && vehicleModel.userData.height) || CAR.bodyH * 1.22;
    camera.position.set(state.x + fx * 0.2 + rx * K.seatX, state.y + bodyH * CAR.eyeFrac, state.z + fz * 0.2 + rz * K.seatX);
    camera.rotation.set(-0.05 + rcSeatPitch(him), state.heading, 0, "YXZ");
    const cab = carBuildCabin();
    cab.visible = true;
    if (car.screen) car.screen.visible = false;      // (its map would hide the car he is racing)
    const ownBody = vehicleModel && vehicleModel.userData.imported === state.vehicleKey;
    const lift = (ownBody && TUNE.models[state.vehicleKey] && TUNE.models[state.vehicleKey].cabinLift) || 0;
    cab.position.set(state.x, state.y + lift, state.z);
    cab.rotation.set(0, state.heading, 0, "YXZ");
    // (in the air the cabin pitches with the car round his eye, so the windscreen stays where he sees it)
    const ap = rcSeatPitch(him);
    if (ap) {
      rcEu.set(0, state.heading, 0, "YXZ"); rcQ1.setFromEuler(rcEu).invert();
      rcEu.set(ap, state.heading, 0, "YXZ"); rcQ2.setFromEuler(rcEu);
      rcV1.copy(cab.position).sub(camera.position).applyQuaternion(rcQ1).applyQuaternion(rcQ2);
      cab.position.copy(camera.position).add(rcV1);
      cab.rotation.copy(rcEu);
    }
  }
}

// (v174) In a tunnel -- from a little before its portal until the camera behind him
// is out of it -- the chase camera comes down under its roof (the monster truck's sits
// 19 m up: cut short by the roof it landed on its own cab and hid the road).
function rcTunnelCamUp(him, back) {
  const T = race.track;
  if (!him || !T.tunnels) return Infinity;
  for (const tn of T.tunnels) {
    const u = rcAhead(him.s, tn.sA - RC.tunnel.camFrom);
    if (u < tn.sB - tn.sA + RC.tunnel.camFrom + back + 10) return RC.tunnel.h - RC.tunnel.camUnder;
  }
  return Infinity;
}
// The chase camera's place, per body. (v172) The monster truck's sits higher: from
// 11 m up its own cab hid every pad within 100 m ahead -- three seconds of road, the
// whole of his time to aim at one (race_track_checks m).
function rcChaseCam(mon) { return mon ? RC.cam.monster : RC.cam; }

// (v170) off a dune the car pitches: nose up off the crest, down to land. The seat
// and the centre gauge show it bigger (rcSeatPitch, TUNE.race.jump.seatGain).
function rcAirPitch(r) { return r && r.air ? Math.atan(clamp(r.vy / Math.max(4, r.v), -RC.jump.pitchMax, RC.jump.pitchMax)) : 0; }
function rcSeatPitch(r) { return (r && r.seatP) || 0; }

// ---- the sound ----------------------------------------------------------------------------
// (v170) What his wheels throw up off the ground they are on: dust off sand, dirt
// off dirt, nothing off asphalt -- his, and the two others nearest the camera. No
// random in it: the race's stream would make the results hang on the camera, the
// game's would move the traffic's.
// (v181) Its OWN puffs, not the world's: soft round billows drawn as one cloud of
// points on one texture -- the world's pool is lit, faceted spheres, which in the
// foreground of the chase view read as boulders rolling after him, and over the
// splash as pale blue lumps, never as water. These are unlit, the surface's own
// colour (the splash's white), dimmed at night with the sky; they fade out close to
// the camera and are never drawn bigger than `maxPx` of the screen's height, so
// nothing he throws up ever stands in front of what he is looking at.
const rcPS = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
let rcPuffs = null;
const rcPuffWH = new THREE.Vector2();
function rcPuffTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  // a billow: five soft blobs at fixed places round the middle, so it reads as a puff and not a dot
  for (const [bx, by, br] of [[32, 34, 22], [22, 30, 14], [42, 28, 15], [27, 42, 13], [40, 42, 13]]) {
    const g = x.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}
function rcPuffPool() {
  if (rcPuffs) return rcPuffs;
  const SP = RC.spray, n = SP.pool, geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), col = new Float32Array(n * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: rcPuffTex() }, uScale: { value: 600 }, uMax: { value: 80 }, uLit: { value: 1 }, uNear: { value: new THREE.Vector2(SP.fadeNear[0], SP.fadeNear[1]) } },
    // the game draws with a logarithmic depth buffer: a shader of its own writes its depth the same way
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize; attribute float aAlpha; attribute vec3 aCol;
      uniform float uScale; uniform float uMax; varying float vA; varying vec3 vC; varying float vD;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; vA = aAlpha; vC = aCol;
        gl_PointSize = aSize > 0.0 ? clamp(aSize * uScale / max(0.5, -mv.z), 1.0, uMax) : 0.0; gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform sampler2D map; uniform float uLit; uniform vec2 uNear; varying float vA; varying vec3 vC; varying float vD;
      void main() {
        #include <logdepthbuf_fragment>
        float a = texture2D(map, gl_PointCoord).a * vA * smoothstep(uNear.x, uNear.y, vD);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC * uLit, a); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 2;
  scene.add(pts);
  rcPuffs = { n, pts, geo, mat, pos, size, alpha, col, next: 0, life: new Float32Array(n), max: new Float32Array(n),
    r: new Float32Array(n), grow: new Float32Array(n), rise: new Float32Array(n), a0: new Float32Array(n) };
  return rcPuffs;
}
// one puff: the old call's numbers (size is a radius, grown by 2.2 x size a second, rising `rise`), its own alpha
function rcPuff(x, y, z, color, size, rise, life, a0) {
  const P = rcPuffPool(), i = P.next;
  P.next = (P.next + 1) % P.n;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.life[i] = P.max[i] = life; P.r[i] = size; P.grow[i] = size * 2.2; P.rise[i] = rise; P.a0[i] = a0 === undefined ? RC.spray.alpha : a0;
  P.col[i * 3] = ((color >> 16) & 255) / 255; P.col[i * 3 + 1] = ((color >> 8) & 255) / 255; P.col[i * 3 + 2] = (color & 255) / 255;
}
function rcPuffsUpdate(dt) {
  const P = rcPuffs;
  if (!P) return;
  const SP = RC.spray, H = renderer.getDrawingBufferSize(rcPuffWH).y;
  let alive = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) { P.size[i] = 0; P.alpha[i] = 0; continue; }
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.size[i] = 0; P.alpha[i] = 0; continue; }
    alive++;
    P.pos[i * 3 + 1] += P.rise[i] * dt; P.r[i] += P.grow[i] * dt;
    P.size[i] = P.r[i] * SP.sizeK;
    const u = 1 - P.life[i] / P.max[i];
    P.alpha[i] = P.a0[i] * (1 - u * u);            // (held, then gone: a linear fade left most of a puff half there, tinted by the ground)
  }
  for (const k of ["position", "aSize", "aAlpha", "aCol"]) P.geo.attributes[k].needsUpdate = true;
  const U = P.mat.uniforms;
  U.uScale.value = H / (2 * Math.tan(camera.fov * DEG / 2));
  U.uMax.value = SP.maxPx * H;
  U.uLit.value = 1 - SP.nightDim * (state.nightF || 0);
  P.pts.visible = alive > 0;
}
function rcPuffsClear() {
  if (!rcPuffs) return;
  rcPuffs.life.fill(0); rcPuffs.size.fill(0); rcPuffs.alpha.fill(0);
  rcPuffs.geo.attributes.aSize.needsUpdate = rcPuffs.geo.attributes.aAlpha.needsUpdate = true;
  rcPuffs.pts.visible = false;
}
function rcSpray(dt) {
  rcPuffsUpdate(dt);
  if (race.phase === "grid" || race.phase === "podium") return;
  const SP = RC.spray, cx = camera.position.x, cz = camera.position.z;
  let a = null, b = null, da = SP.near, db = SP.near;
  for (const r of race.racers) {
    if (r.isHim) continue;
    const d = Math.hypot(r.mesh.position.x - cx, r.mesh.position.z - cz);
    if (d < da) { b = a; db = da; a = r; da = d; } else if (d < db) { b = r; db = d; }
  }
  for (const r of race.racers) {
    if (!(r.isHim || r === a || (SP.others > 1 && r === b))) continue;
    r.sprayT = (r.sprayT || 0) - dt;
    if (r.sprayT > 0) continue;
    const sf = rcSurfR(r);
    if (!sf.spray || r.v < SP.minV) continue;
    r.sprayT = r.isHim ? sf.every : SP.otherEvery;
    r.sprayK = (r.sprayK || 0) + 1;
    const back = 0.55 * r.len, la = r.lat + (r.sprayK % 2 ? 0.35 : -0.35) * r.wid;
    if (r.path) rcScPoint(r.path, r.u - back, la, rcPS); else rcPoint(r.s - back, la, rcPS);
    rcPuff(rcPS.x, rcPS.y + 0.4, rcPS.z, sf.spray, sf.size, sf.rise, sf.life, sf.sprayA);
  }
}

function rcSound(him, touching) {
  setEngine(clamp(him.v / RC.v, 0, 1.4));
  // the ground under him, by its own voice: louder the faster he goes
  const here = him.path ? him.path.surface : rcAt(him.s).sf;
  for (const k in RC.surfaces) { const T = RC.surfaces[k].tone; if (T) setTone(T[0], T[1], T[2] * (0.7 + 0.5 * clamp(him.v / RC.v, 0, 1.4)), k === here && race.phase !== "podium" ? T[3] * clamp(him.v / RC.v, 0, 1) : 0); }
  const near = race.racers.reduce((m, r) => r.isHim ? m : Math.min(m, Math.abs(rcGap(r.s, him.s))), 1e9);
  setTone("raceCrowd", "sawtooth", 140 + Math.min(80, 2000 / (near + 20)), race.phase === "race" && near < 40 ? 0.012 : 0);
}

// ---- the HUD: three lap lights, and the cars in order -------------------------------------
// No words, no numbers: the lights fill as the laps go by, and the strip is the
// cars themselves, in the order they are on the road, his ringed in yellow.
const RC_SIL = {
  car: '<path d="M8 30 L12 22 Q16 18 24 17 L30 11 Q34 9 40 9 L50 9 Q56 10 60 16 L66 19 Q72 21 72 26 L72 30 Z" fill="#8a93a0"/>',
  cybertruck: '<path d="M6 30 L6 20 L44 9 L72 22 L72 30 Z" fill="#c9ced6"/>',
  corvette: '<path d="M8 30 L8 23 Q10 20 16 19 L30 17 Q38 11 46 11 L54 15 L68 19 Q74 21 72 27 L72 30 Z" fill="#e0483e"/>',
  monster: '<path d="M14 20 L18 14 L30 13 L34 7 L48 7 L52 13 L64 14 Q68 15 68 19 L68 22 L14 22 Z" fill="#2b6fd1"/><circle cx="22" cy="28" r="8" fill="#1f2328"/><circle cx="60" cy="28" r="8" fill="#1f2328"/>',
  taxi: '<path d="M8 30 L12 22 Q16 19 24 18 L30 12 L50 12 L58 18 L68 20 Q72 22 72 26 L72 30 Z" fill="#ffd23e"/>',
  hatch: '<path d="M8 30 L10 22 Q14 19 22 18 L30 11 L52 11 Q58 12 62 18 L70 21 Q72 24 72 30 Z" fill="#36c46a"/>',
};
function rcSilSvg(key) {
  const wheels = key === "monster" ? "" : '<circle cx="22" cy="31" r="5" fill="#1f2328"/><circle cx="58" cy="31" r="5" fill="#1f2328"/>';
  return '<svg viewBox="0 0 80 40">' + (RC_SIL[key] || RC_SIL.car) + wheels + '</svg>';
}
function rcHudBuild() {
  const h = el.raceHud;
  h.classList.remove("podium");
  const laps = h.querySelector(".raceLaps"), strip = h.querySelector(".racePos");
  laps.innerHTML = ""; strip.innerHTML = "";
  for (let k = 0; k < RC.laps; k++) { const d = document.createElement("i"); laps.appendChild(d); }
  for (const r of race.racers) {
    const d = document.createElement("b");
    d.innerHTML = rcSilSvg(r.key);
    if (r.isHim) d.classList.add("him");
    r.hudEl = d; strip.appendChild(d);
  }
  race.hudOrder = "";
}
function rcHud() {
  const h = el.raceHud, him = race.him;
  const lights = h.querySelectorAll(".raceLaps i");
  const on = Math.min(RC.laps, him.lapsDone + (race.phase === "race" ? 1 : 0));
  lights.forEach((d, k) => { d.className = k < him.lapsDone ? "done" : (k < on ? "now" : ""); });
  const order = racePlaces();
  const key = order.map(r => r.i).join(",");
  if (key !== race.hudOrder) {
    race.hudOrder = key;
    const strip = h.querySelector(".racePos");
    for (const r of order) strip.appendChild(r.hudEl);      // re-ordered in place
  }
}

// ---- the buttons (buttons.js asks these) ----------------------------------------------------
function raceBtnShows() {
  return raceCarOK() && !race.on && !state.exploding && !menuOpen() && !(typeof eject !== "undefined" && eject.active) &&
    !(typeof trk !== "undefined" && trk.on) && !(typeof dadActive === "function" && dadActive());
}
function raceExitShows() { return race.on && race.phase !== "podium" && !menuOpen(); }
function raceEndShows() { return race.on && race.phase === "podium" && race.podiumT > RC.podium.buttonsAfter && !menuOpen(); }

function rcWire() {
  const press = (id, fn) => el[id].addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el[id]); fn(); });
  press("raceBtn", raceOpenPicker);
  press("raceExitBtn", raceExit);
  press("raceAgainBtn", raceAgain);
  press("raceBackBtn", raceExit);
  document.querySelectorAll(".trackCard").forEach(card => card.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation(); unlockAudio();
    if (card.dataset.track === "back") { raceClosePicker(); return; }
    rcStartRace(card.dataset.track);
  }));
}
for (const id of ["screenRace", "raceHud", "raceBtn", "raceExitBtn", "raceAgainBtn", "raceBackBtn"]) el[id] = document.getElementById(id);
rcWire();
// it stands in the world from the start, seen in normal play
rcBuild();
