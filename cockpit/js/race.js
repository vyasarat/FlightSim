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
// holds his line, and the barrier at either edge is a shove back on to it.
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
// sections; it never edits this file.
//
// THE VENUE STANDS IN THE WORLD, seen in normal play: asphalt, kerbs, barriers,
// grandstands (solid, as buildings are), flags, the start gantry with its three
// lamps, the boost pads and the podium. It is built on its own random stream
// (vkQuiet), so the seeded traffic still sees v125's.
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
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    a.kh = (a.tz * b.tx - a.tx * b.tz) / (b.s - a.s || TK.ds);
  }
  S[n - 1].kh = S[n - 2].kh;
  const gap = Math.hypot(laid.end.p.x - start.p.x, laid.end.p.z - start.p.z);
  const turn = Math.abs(wrapPi(Math.atan2(laid.end.f.x, laid.end.f.z) - Math.atan2(start.f.x, start.f.z)));
  return { def, S, len: pc.len, n, gap, turn };
}

// Where s metres along it is (s wraps by the lap): one sample's worth, interpolated.
const rcAtOut = { x: 0, gy: 0, z: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0, s: 0, sf: "asphalt" };
function rcAt(s) {
  const T = race.track, S = T.S, n = T.n;
  let u = s % T.len; if (u < 0) u += T.len;
  const f = u / T.len * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i, a = S[i], b = S[i + 1], o = rcAtOut;
  o.x = a.x + (b.x - a.x) * t; o.z = a.z + (b.z - a.z) * t; o.gy = a.gy + (b.gy - a.gy) * t;
  o.tx = a.tx + (b.tx - a.tx) * t; o.tz = a.tz + (b.tz - a.tz) * t;
  const tl = Math.hypot(o.tx, o.tz) || 1; o.tx /= tl; o.tz /= tl;
  o.lx = a.lx + (b.lx - a.lx) * t; o.ly = a.ly + (b.ly - a.ly) * t; o.lz = a.lz + (b.lz - a.lz) * t;
  o.kh = a.kh + (b.kh - a.kh) * t; o.s = u; o.sf = (t < 0.5 ? a : b).sf;
  return o;
}
// The surface s metres along (TUNE.race.surfaces): the same answer for every racer there.
function rcSurfAt(s) { return RC.surfaces[rcAt(s).sf] || RC.surfaces.asphalt; }
// the world point at (s, lat), and the deck's up there
function rcPoint(s, lat, out) {
  const q = rcAt(s);
  out.x = q.x + q.lx * lat; out.y = q.gy + q.ly * lat; out.z = q.z + q.lz * lat;
  // up = T x left... the deck's normal: left x T
  const tx = q.tx, tz = q.tz, lx = q.lx, ly = q.ly, lz = q.lz;
  out.nx = ly * tz - lz * 0; out.ny = lz * tx - lx * tz; out.nz = lx * 0 - ly * tx;
  const nl = Math.hypot(out.nx, out.ny, out.nz) || 1; out.nx /= nl; out.ny /= nl; out.nz /= nl;
  if (out.ny < 0) { out.nx = -out.nx; out.ny = -out.ny; out.nz = -out.nz; }
  out.tx = tx; out.tz = tz; out.lx = lx; out.ly = ly; out.lz = lz; out.kh = q.kh;
  return out;
}
const rcP = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };

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
  rcUse(RC.tracks[0].id);
}
// The venue a race is run on; an id it does not know is the first track.
function rcUse(id) {
  const v = race.venues && (race.venues[id] || race.venues[RC.tracks[0].id]);
  if (!v || race.track === v.track) return;
  if (race.trophy) race.trophy.visible = race.trophyStand.visible = false;
  for (const k of RC_VENUE) race[k] = v[k];
}
// where on the lap its podium stands (a fraction of it)
function rcPodiumS(def) { return (def && def.podiumS !== undefined ? def.podiumS : RC.podium.s); }
function rcBuildVenue(def) {
  race.track = rcLayTrack(def);
  const T = race.track, S = T.S, n = T.n, P = TUNE.palette, W = RC.width / 2, KW = RC.kerbW;
  const g = new THREE.Group();
  g.userData.noSolid = false;
  // ---- the deck, the kerbs and the barriers: three ribbons and a wall, one mesh each
  const deck = [], kerbR = [], kerbW = [], wall = [], line = [];
  const decks = { asphalt: deck }, ruts = [];        // (v170) a deck per surface, asphalt's the one there always was
  const at = (q, a, up) => [q.x + q.lx * a, q.gy + q.ly * a + (up || 0), q.z + q.lz * a];
  const quad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    quad(decks[a.sf] || (decks[a.sf] = []), at(a, -W), at(b, -W), at(b, W), at(a, W));
    const sf = RC.surfaces[a.sf] || RC.surfaces.asphalt;
    // dirt keeps the ruts of the cars before him, where the racing lines run
    if (sf.ruts) for (const c of RC.rutLat) quad(ruts, at(a, c - 0.25, 0.04), at(b, c - 0.25, 0.04), at(b, c + 0.25, 0.04), at(a, c + 0.25, 0.04));
    // kerbs on the bends, red and white every few metres, on both edges (asphalt's alone)
    const bend = Math.abs(a.kh) > 0.0015 && sf.kerbs;
    const red = Math.floor(a.s / RC.kerbStep) % 2 === 0;
    for (const sd of [-1, 1]) {
      const k = bend ? (red ? kerbR : kerbW) : kerbW;
      if (sf.kerbs && (bend || i % 4 < 2)) quad(k, at(a, sd * W, 0.04), at(b, sd * W, 0.04), at(b, sd * (W + KW), 0.04), at(a, sd * (W + KW), 0.04));
      // the barrier just outside the kerb, low and white with a red cap
      const e = sd * (W + KW + 0.4);
      quad(wall, at(a, e), at(b, e), at(b, e, RC.wallH), at(a, e, RC.wallH));
    }
  }
  // the barriers are walls in the world, to anything that meets them out of a race
  // (in one, the race itself keeps him off them): short turned boxes along each
  const step = Math.max(1, Math.round(RC.wallPiece / TK.ds));
  for (let i = 0; i < n; i += step) {
    const a = S[i], b = S[(i + step) % n];
    for (const sd of [-1, 1]) {
      const e = sd * (W + KW + 0.4), p0 = at(a, e), p1 = at(b, e);
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], L = Math.hypot(dx, dz) || 1;
      solidBox3((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + RC.wallH / 2 - 0.25, (p0[2] + p1[2]) / 2,
                [dx / L, 0, dz / L], [0, 1, 0], [-dz / L, 0, dx / L], L / 2 + 0.3, RC.wallH / 2 + 0.25, 0.3, "wall");
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
  for (const k in decks) if (k !== "asphalt") mk(decks[k], artPaint(new THREE.MeshLambertMaterial({ color: RC.surfaces[k].col, side: THREE.DoubleSide }), RC.surfaces[k].art));
  if (ruts.length) mk(ruts, new THREE.MeshLambertMaterial({ color: P.slate, side: THREE.DoubleSide }));
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
  race.pads = (def.pads || RC.pads).map(p => ({ s: p.s * T.len, lat: p.lat }));
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
  hwyClaimCorridor(claim);
  hwyIndexCorridor();
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
    const q = rcAt((St.from + k * St.step) * T.len);
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
  const q = rcAt(rcPodiumS(race.track.def) * race.track.len);
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
    if (Math.abs(s - rcPodiumS(T.def) * T.len) < 60) continue;          // nothing between the podium and the camera
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
  race.stuckT = 0; race.stuck = 0; race.shoves = 0; race.wallShoves = 0; race.padHits = 0; race.bangs0 = flags.carCrashes || 0;
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
  if (cvt) cvUpdate(dt, r.boosting);
  if (race.phase === "done" && r.done) touching = true;          // across the line he rolls on for his cheer
  const sf = rcSurfAt(r.s);                    // (the ground's own speed and grip: the same for every racer on it)
  const want = (touching ? A.v * step : 0) * (r.boosting ? A.burst : 1) * (r.padT > 0 ? A.pad : 1) * (r.done ? A.coolDown : 1) * sf.speed;
  rcSpeedTo(r, want, dt);
  // across the track: a rate, from the drag, past the car's own deadzone
  const dz = CAR.deadzone || 0.08;
  const steer = Math.abs(bank) < dz ? 0 : (bank - Math.sign(bank) * dz) / (1 - dz);
  // drag right = to his right, which is -left
  const wantLatV = r.done ? (0 - r.lat) * 0.5 : -steer * A.latRate * clamp(r.v / A.latFull, 0.25, 1);
  r.latV += (wantLatV - r.latV) * Math.min(1, A.latResp * sf.grip * dt);
}
function rcSpeedTo(r, want, dt) {
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
  const sf = rcSurfAt(r.s);
  const want = RC.v * step * r.skill * band * (r.boosting ? RC.burst : 1) * (r.padT > 0 ? RC.pad : 1) * (r.done ? RC.coolDown : 1) * sf.speed;
  rcSpeedTo(r, want, dt);
  // where across: their line, slowly wandering; a pad ahead, if they go for it;
  // round a car close in front
  r.lineT += dt;
  let aim = r.line + Math.sin(r.lineT * A.wander[0] + r.i) * A.wander[1];
  // the inside of a bend is shorter, and the good ones know it
  if (Math.abs(q.kh) > 0.002) aim = lerp(aim, Math.sign(q.kh) * RC.width * 0.3, A.inside);
  for (const pd of race.pads) {
    const ahead = rcAhead(pd.s, r.s);
    if (ahead > 0 && ahead < A.padSee) { if (r.aim !== pd) { r.aim = pd; r.aimGo = rcRnd() < A.padP; } if (r.aimGo) aim = pd.lat; }
  }
  for (const o of race.racers) {
    if (o === r) continue;
    const ds = rcGap(o.s, r.s);
    if (ds > 0 && ds < A.passSee && Math.abs(o.lat - aim) < (o.wid + r.wid) / 2 + 1) {
      // pass on whichever side has more room
      const left = RC.width / 2 - o.lat, right = o.lat + RC.width / 2;
      aim = o.lat + (left > right ? 1 : -1) * ((o.wid + r.wid) / 2 + 1.5);
    }
  }
  const lim = RC.width / 2 - r.wid / 2 - 0.3;
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
  const q = rcAt(r.s);
  r.lat += r.latV * dt;
  const lim = RC.width / 2 - r.wid / 2 - 0.2;
  if (Math.abs(r.lat) > lim) {
    r.lat = Math.sign(r.lat) * lim;
    if (Math.sign(r.latV) === Math.sign(r.lat) && Math.abs(r.latV) > 1) {
      if (r.isHim) { race.wallShoves++; flags.raceWallShoves = (flags.raceWallShoves || 0) + 1; rcBump(0.25); }
      r.v *= RC.wallKeep;
    }
    r.latV = -r.latV * 0.3;
  }
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
}

// A shove, never a bang: overlapping cars are pushed apart across the track, and
// the one behind gives up the speed it had over the one in front.
function rcContacts(dt) {
  const R = race.racers;
  for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) {
    const A = R[a], B = R[b];
    const ds = rcGap(A.s, B.s), dl = A.lat - B.lat;
    const needS = (A.len + B.len) / 2, needL = (A.wid + B.wid) / 2;
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
  const lim = r => RC.width / 2 - r.wid / 2 - 0.2;
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
  race.phase = "podium"; race.podiumT = 0;
  const top = race.order.slice(0, 3), him = race.him, won = him.place === 1;
  race.podium = { top, won, onStep: top.includes(him) };
  top.forEach((r, k) => { r.onStep = k; });
  // the rest are off the track for it; he, if he is not on a step, comes along
  // the straight in front of it for his cheer, and stops there
  for (const r of race.racers) if (!r.isHim && !top.includes(r) && r.mesh) r.mesh.visible = false;
  if (!race.podium.onStep) {
    const L = race.track.len, ps = rcPodiumS(race.track.def) * L;
    const base = Math.floor(him.s / L) * L;
    him.s = base + ps - RC.podium.parade; him.lat = RC.width / 2 - 2.5; him.latV = 0; him.v = RC.podium.paradeV; him.yaw = 0;
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
  rcPoint(r.s, r.lat, rcP);
  state.x = rcP.x; state.y = rcP.y; state.z = rcP.z;
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  const fx = rcP.tx * c + rcP.lx * s, fz = rcP.tz * c + rcP.lz * s;
  state.heading = Math.atan2(-fx, -fz);
  state.speed = r.v; state.pitch = 0; state.bank = 0; state.airVy = null;
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
    rcPoint(r.s, r.lat, rcP);
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
    const back = mon ? 26 : RC.cam.back, up = mon ? 11 : RC.cam.up;
    camDesired.set(state.x - fx * back, state.y + up, state.z - fz * back);
    camera.position.lerp(camDesired, Math.min(1, RC.cam.lag * dt));
    // never inside the venue: the line back to him clear of its stands, gantry and walls (v163's rule)
    const ey = state.y + (mon ? 4 : 1.6), k = solidSight(state.x, ey, state.z, camera.position.x, camera.position.y, camera.position.z, CAR.camClear.r, CAR.camClear.kinds);
    if (k < 1) camera.position.set(state.x + (camera.position.x - state.x) * k, ey + (camera.position.y - ey) * k, state.z + (camera.position.z - state.z) * k);
    lookV.set(state.x + fx * 18, state.y + (mon ? 4 : 1.6), state.z + fz * 18);
    camera.lookAt(lookV);
    if (typeof carHideCabin === "function") carHideCabin();
  } else if (mon) {
    const C = MON.cam;
    camera.position.set(state.x - fx * C.seatBack, state.y + C.eye, state.z - fz * C.seatBack);
    camera.rotation.set(-C.seatPitch * DEG, state.heading, 0, "YXZ");
  } else {
    // the car's own seat (car.js carCamera), on the banked deck
    const K = CAR.cabin, rx = -fz, rz = fx;
    const bodyH = (vehicleModel && vehicleModel.userData.height) || CAR.bodyH * 1.22;
    camera.position.set(state.x + fx * 0.2 + rx * K.seatX, state.y + bodyH * CAR.eyeFrac, state.z + fz * 0.2 + rz * K.seatX);
    camera.rotation.set(-0.05, state.heading, 0, "YXZ");
    const cab = carBuildCabin();
    cab.visible = true;
    if (car.screen) car.screen.visible = false;      // (its map would hide the car he is racing)
    const ownBody = vehicleModel && vehicleModel.userData.imported === state.vehicleKey;
    const lift = (ownBody && TUNE.models[state.vehicleKey] && TUNE.models[state.vehicleKey].cabinLift) || 0;
    cab.position.set(state.x, state.y + lift, state.z);
    cab.rotation.set(0, state.heading, 0);
  }
}

// ---- the sound ----------------------------------------------------------------------------
// (v170) What his wheels throw up off the ground they are on: dust off sand, dirt
// off dirt, nothing off asphalt -- his, and the two others nearest the camera. The
// world's own puff pool (landmarks.js), and no random in it: the race's stream
// would make the results hang on the camera, the game's would move the traffic's.
const rcPS = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
function rcSpray(dt) {
  if (race.phase === "grid" || race.phase === "podium" || typeof wakePuff !== "function") return;
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
    const sf = rcSurfAt(r.s);
    if (!sf.spray || r.v < SP.minV) continue;
    r.sprayT = r.isHim ? sf.every : SP.otherEvery;
    r.sprayK = (r.sprayK || 0) + 1;
    rcPoint(r.s - 0.45 * r.len, r.lat + (r.sprayK % 2 ? 0.35 : -0.35) * r.wid, rcPS);
    wakePuff(rcPS.x, rcPS.y + 0.4, rcPS.z, sf.spray, sf.size, sf.rise, sf.life);
  }
}

function rcSound(him, touching) {
  setEngine(clamp(him.v / RC.v, 0, 1.4));
  // the ground under him, by its own voice: louder the faster he goes
  const here = rcAt(him.s).sf;
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
