"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE, MISSION 2: DAMBUSTERS (v154). Operation Chastise, 16-17 May 1943.
//
// Dad mode only (dadmode.js's promises hold: built on entry, gone on exit, nothing saved,
// no Math.random). NIGHT for the length of the sortie: his sky mood is put back on exit.
//
// THE DAM stands across the south arm of the great lake (the ring round the island), built
// on entry and nowhere in his game: a concrete wall from the lake bed to `crest` over the
// water, its two towers carrying a light flak gun and a searchlight each. The lake is the
// game's own water (terrainEff < seaLevelAt): the dam adds no water of its own.
//
// THE RUN, as 617 Squadron flew it: in from the east low over the water, at 60 ft -- two
// lamps under the bomber throw two spots on the water that meet at exactly 60 ft -- at
// about 232 mph, and release 400-480 yards from the wall. The bomb (a backspun drum) skips
// across the water to the wall, sinks against it and goes off at depth. Out of the window it
// fails, each in its own way: too high or too fast it breaks up on the first impact; too low
// or too slow it digs in and sinks short; too far out its skips run out short of the wall;
// too close it bounces over the crest; off the line it runs into the bank. Three bombs.
// One on the wall breaches the dam.
// ---------------------------------------------------------------------------
const dadDam = { mis: null };

function dadDamFt(m) { return m * 3.281; }
function dadDamMph(v) { return v * 2.237; }
function dadDamYd(m) { return m * 1.0936; }

function dadDamBuild(W) {
  const T = TUNE.dad.dam, wl = TUNE.waterLevel;
  // the arm's water across the line x = T.x: the wall runs from bank to bank and on into both
  let z0 = null, z1 = null;
  for (let z = T.zScan[0]; z <= T.zScan[1]; z += 2) if (terrainEff(T.x, z) < seaLevelAt(T.x, z)) { if (z0 === null) z0 = z; z1 = z; }
  if (z0 === null) { z0 = T.zScan[0] + 100; z1 = z0 + 120; }
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + T.wingWall;
  const crest = wl + T.crest, base = Math.min(terrainEff(T.x, zc), wl - 6) - 4;
  const D = W.dam = { x: T.x, z0, z1, zc, za: zc - half, zb: zc + half, crest, base, segs: [], towers: [], breached: false, thick: T.thick };
  const conc = new THREE.MeshLambertMaterial({ color: TUNE.palette.concrete, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: TUNE.palette.slate, flatShading: true });
  const roof = new THREE.MeshLambertMaterial({ color: TUNE.palette.night, flatShading: true });
  W.mats.conc = conc;
  // the wall in segments, so the breach can take the middle out of it
  const n = T.segs, len = (D.zb - D.za) / n;
  for (let i = 0; i < n; i++) {
    const zs = D.za + (i + 0.5) * len;
    const ground = Math.max(base, Math.min(terrainEff(T.x, zs), crest - 2));
    const h = crest - ground + 2;
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(T.thick, h, len + 0.2), conc);
    wall.position.y = -h / 2; g.add(wall);
    // the parapet, and a buttress line on the downstream face every other segment
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, len + 0.2), dark), T.thick / 2 - 0.4, 0.6, 0));
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, len + 0.2), dark), -T.thick / 2 + 0.4, 0.6, 0));
    if (i % 2) g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(2.5, h, 2.2), conc), -T.thick / 2 - 1.2, -h / 2, 0));
    g.position.set(T.x, crest, zs);
    dadAdd(g);
    D.segs.push({ g, z: zs, len, mid: Math.abs(zs - zc) < T.breachHalf });
  }
  // the two towers, each with its gun and its searchlight
  for (const s of [-1, 1]) {
    const tz = zc + s * T.towerOff;
    const g = new THREE.Group();
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(T.thick + 3, T.towerH, 8), conc), 0, T.towerH / 2, 0));
    const r = new THREE.Mesh(new THREE.ConeGeometry(6.2, 5, 4), roof); r.rotation.y = Math.PI / 4; r.position.y = T.towerH + 2.5; g.add(r);
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.6), dark), 0, T.towerH + 5.5, 0));
    g.position.set(T.x, crest, tz);
    dadAdd(g);
    // the searchlight's beam: a long soft cone, additive, from the tower top. Its outside only:
    // with the camera inside the cone (it is on him, and the chase camera rides behind him)
    // the inner face washed the whole picture grey
    const beamGeo = new THREE.ConeGeometry(T.lightR, T.lightLen, 16, 1, true).translate(0, -T.lightLen / 2, 0).rotateX(-Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, fog: false }));
    beam.position.set(T.x, crest + T.towerH + 6, tz);
    dadAdd(beam);
    D.towers.push({ g, x: T.x, y: crest + T.towerH + 6, z: tz, beam, sweep: s * 0.8, shotT: 0, burstT: 0, gapT: s > 0 ? 0.6 : 0 });
  }
  // the breach: broken slabs that show once the middle goes
  const rub = new THREE.Group();
  for (let k = 0; k < 10; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(dadR(3, 7), dadR(2, 6), dadR(3, 8)), conc);
    s.position.set(T.x + dadR(-6, 6), wl + dadR(-2, 3), zc + (k % 2 ? 1 : -1) * (T.breachHalf + dadR(-3, 2)));
    s.rotation.set(dadR(-0.6, 0.6), dadR(0, 3), dadR(-0.6, 0.6));
    rub.add(s);
  }
  rub.visible = false; dadAdd(rub); D.rubble = rub;
  // the bomber, and its bomb
  const body = dadBuildLancaster();
  dadAdd(body); W.body = body;
  const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 1.52, 14), W.mats.steel || conc);
  bomb.rotation.z = Math.PI / 2; bomb.visible = false; dadAdd(bomb); W.bomb = bomb;
  // the rings the bomb leaves on the water where it touches
  W.skipRings = [];
  for (let i = 0; i < 8; i++) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    rg.rotation.x = -Math.PI / 2; rg.renderOrder = 5; rg.visible = false; rg.userData.t = 0; dadAdd(rg); W.skipRings.push(rg);
  }
  // the waterfall through the breach: a white sheet in the gap, down the downstream face
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xe8eef5, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  fall.visible = false; dadAdd(fall); D.fall = fall;
  // the two lamps' beams and their spots on the water
  W.lamps = [];
  for (let i = 0; i < 2; i++) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    spot.rotation.x = -Math.PI / 2; spot.renderOrder = 6; dadAdd(spot);
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.55, fog: false }));
    ray.frustumCulled = false; dadAdd(ray);
    W.lamps.push({ spot, ray, at: i ? T.lampAft : T.lampFore });
  }
  // the moon over the lake, and its light (the raid flew under a full moon)
  const moon = new THREE.Mesh(new THREE.CircleGeometry(T.moonR, 32), new THREE.MeshBasicMaterial({ color: 0xf4f1e2, fog: false, depthWrite: false }));
  moon.renderOrder = -1; dadAdd(moon); W.moon = moon;
  const ml = new THREE.DirectionalLight(0xa9bce0, T.moonLight);
  dadAdd(ml); dadAdd(ml.target); W.moonLight = ml;
}

// where the lamps' spots fall on the water: each lamp a point in the airframe with its
// beam aimed (in the airframe) at the one point `T.meet` under the bomber -- they meet on
// the water when he is exactly that high
const dadDamQ = new THREE.Quaternion(), dadDamE = new THREE.Euler(), dadDamA = new THREE.Vector3(), dadDamB = new THREE.Vector3();
function dadDamSpots() {
  const W = dad.world, T = TUNE.dad.dam, wl = TUNE.waterLevel;
  dadDamE.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ");
  dadDamQ.setFromEuler(dadDamE);
  const meet = dadDamB.set(T.meetX, -T.height, T.meetZ);
  const out = [];
  for (const L of W.lamps) {
    const p = dadDamA.set(L.at[0], L.at[1], L.at[2]);
    const d = meet.clone().sub(p).normalize().applyQuaternion(dadDamQ);
    const o = p.clone().applyQuaternion(dadDamQ).add(new THREE.Vector3(state.x, state.y, state.z));
    let hit = null;
    if (d.y < -1e-3) { const t = (wl - o.y) / d.y; if (t > 0 && t < 400) hit = o.clone().addScaledVector(d, t); }
    out.push({ o, hit });
  }
  return out;
}

function dadDamStart() {
  const T = TUNE.dad.dam, W = dad.world, D = W.dam;
  dadSeedNow = dad.seed + 2;
  dad.m = {
    t: 0, over: false, result: null, why: "", overT: 0, card: false, shake: 0, msg: "", msgT: 0, health: 100,
    bombs: T.bombs, bombsUsed: 0, runs: [], breached: false, breachT: 0, bombFly: null, column: 0, torrent: 0,
    thrust: 0, propRpm: 40, flakHits: 0, best: null, auto: false, q: 0, load: 1, hitRelease: null,
  };
  for (const s of D.segs) s.g.visible = true;
  D.rubble.visible = false; D.breached = false; D.fall.visible = false;
  for (const rg of W.skipRings) rg.visible = false;
  W.bomb.visible = false;
  for (const P of [W.smoke, W.fire, W.tracer]) P.life.fill(0);
  // in from the east, at 150 ft, heading west along the arm
  state.x = T.start.x; state.z = dadDamLineZ(T.start.x);
  state.y = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + T.start.agl;
  state.heading = Math.PI / 2; state.pitch = 0; state.bank = 0;
  state.speed = T.start.speed / 2.237;
  state.phase = "AIRBORNE"; state.airVy = null; state.exploding = false; state.explodeTimer = 0;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.cam = null;
  const card = document.getElementById("dadCard"); if (card) card.remove();
}
// the run's line: straight down the arm, due west, at the dam's centre (the arm is
// straight for the last 600 m before the wall; east of it is low marsh). `x` is kept for
// the callers' sake: the line is the same z everywhere.
function dadDamLineZ(x) {
  const D = dad.world && dad.world.dam;
  if (D) return D.zc;
  const T = TUNE.dad.dam, wl = TUNE.waterLevel;
  let a = null, b = null;
  for (let z = T.zScan[0]; z <= T.zScan[1]; z += 2) if (terrainEff(T.x, z) < seaLevelAt(T.x, z)) { if (a === null) a = z; b = z; }
  return a === null ? (T.zScan[0] + T.zScan[1]) / 2 : (a + b) / 2;
}

function dadDamFly(dt) {
  const m = dad.m, A = TUNE.dad.air.lancaster;
  if (!m) return;
  state.phase = "AIRBORNE"; state.airVy = null; rumble = 0;
  if (state.exploding) return;
  m.thrust = m.over ? A.thrust * 0.8 : A.thrust;
  if (m.over) m.stick = { bank: 0, pitch: clamp((8 - state.pitch) * 0.1, -0.5, 0.5) };
  dadAirFly(dt, A, m);
  if (typeof setEngine === "function") setEngine(0);
  if (m.over) return;
  // the water, the ground, the dam and its towers: a crash ends it
  const ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  if (state.y - ground < A.touchAgl) { dadDamCrash(); return; }
  const D = dad.world.dam, T = TUNE.dad.dam;
  if (Math.abs(state.x - D.x) < T.thick / 2 + 2 && state.z > D.za && state.z < D.zb) {
    const gap = D.breached && Math.abs(state.z - D.zc) < T.breachHalf - 4;
    if (!gap && state.y < D.crest + 1.5) { dadDamCrash(); return; }
  }
  for (const t of D.towers) if (Math.abs(state.x - t.x) < 7 && Math.abs(state.z - t.z) < 7 && state.y < t.y + 2) { dadDamCrash(); return; }
  // and anything of his world that is solid (a bridge, a mast, a building), as the jet's
  if (solidQuery(state.x, state.y, state.z, TUNE.solid.r.dad, SOLID.AIR, undefined, null, false)) dadDamCrash();
}
function dadDamCrash() {
  dadBlast(state.x, Math.max(state.y, TUNE.waterLevel + 1), state.z, 2.4, false);
  for (let i = 0; i < 40; i++) dadEmit(dad.world.smoke, state.x, TUNE.waterLevel + 1, state.z, dadR(-20, 20), dadR(10, 40), dadR(-20, 20), dadR(2, 4), 6, dadR(20, 40), 0.9, 0xf2f4f7, 0.8, -3);
  dadEnd("fail", "crashed", true);
}

// ---- the release: the numbers at the moment he lets go decide what the bomb does
function dadDamCan() {
  const m = dad.m;
  return dadFlying() && m.bombs > 0 && !m.bombFly && !m.breached;
}
function dadDamRelease() {
  const m = dad.m, W = dad.world, D = W.dam, T = TUNE.dad.dam, wl = TUNE.waterLevel;
  if (!dadDamCan()) return false;
  m.bombs--; m.bombsUsed++;
  const f = dadFwd(dadTmpF), hl = Math.hypot(f.x, f.z) || 1, ux = f.x / hl, uz = f.z / hl;
  const vh = state.speed * Math.cos(state.pitch * DEG);
  const over = Math.max(terrainEff(state.x, state.z), wl);
  const r = { ft: dadDamFt(state.y - wl), mph: dadDamMph(vh), yd: null, z: null, why: null, kind: null, overWater: terrainEff(state.x, state.z) < seaLevelAt(state.x, state.z) };
  // along the track to the wall's upstream face
  const face = D.x + T.thick / 2;
  if (ux < -0.05 && state.x > face) {
    const s = (face - state.x) / ux;
    r.yd = dadDamYd(s); r.z = state.z + uz * s;
  }
  const W1 = T.window;
  let endS;   // how far along the track the bomb comes to rest
  const fall = vh * Math.sqrt(2 * Math.max(1, state.y - wl) / 9.81);
  if (!r.overWater) { r.kind = "land"; r.why = "RELEASED OVER LAND"; endS = fall; }
  else if (r.yd === null) { r.kind = "away"; r.why = "NOT RUNNING AT THE DAM"; endS = fall + 120; }
  else if (r.ft > W1.ftMax) { r.kind = "broke"; r.why = "TOO HIGH -- IT BROKE UP ON THE WATER"; endS = fall; }
  else if (r.mph > W1.mphMax) { r.kind = "broke"; r.why = "TOO FAST -- IT BROKE UP ON THE WATER"; endS = fall; }
  else if (r.ft < W1.ftMin) { r.kind = "short"; r.why = "TOO LOW -- IT DUG IN AND SANK"; endS = fall + 60; }
  else if (r.mph < W1.mphMin) { r.kind = "short"; r.why = "TOO SLOW -- IT SANK SHORT"; endS = fall + 90; }
  else if (r.yd > W1.ydMax) { r.kind = "short"; r.why = "TOO FAR OUT -- IT SANK SHORT OF THE WALL"; endS = r.yd / 1.0936 - dadR(50, 110); }
  else if (r.yd < W1.ydMin) { r.kind = "over"; r.why = "TOO CLOSE -- IT BOUNCED OVER THE DAM"; endS = r.yd / 1.0936 + T.thick + 60; }
  else if (r.z < D.z0 + 6 || r.z > D.z1 - 6) { r.kind = "bank"; r.why = "OFF THE LINE -- IT RAN INTO THE BANK"; endS = r.yd / 1.0936 - 15; }
  else { r.kind = "wall"; r.why = null; endS = r.yd / 1.0936; }
  endS = Math.max(fall, endS);
  // the skips: the fall to the water, then hops shrinking by `ratio`, to `endS`
  const hops = [];
  const rest = endS - fall, n = r.kind === "broke" || r.kind === "land" ? 0 : T.hops, k = T.ratio;
  const L1 = n ? rest * (1 - k) / (1 - Math.pow(k, n)) : 0;
  for (let i = 0; i < n; i++) hops.push(L1 * Math.pow(k, i));
  m.bombFly = { r, ox: state.x, oy: state.y - 1.5, oz: state.z, ux, uz, vh, fall, hops, endS, t: 0, seg: -1, sinkT: 0, done: false, splashes: 0 };
  m.runs.push(r);
  if (r.kind === "wall") m.hitRelease = r;
  W.bomb.visible = true;
  dadNoise(0.3, 500, 0.12);
  dadSay("BOMB GONE", 1.4);
  return true;
}
// the bomb along its track: the fall, then each skip a low arc (the last over the crest
// when it is going over), then it sinks; where it sinks it goes off
function dadDamBombStep(dt) {
  const m = dad.m, W = dad.world, D = W.dam, T = TUNE.dad.dam, wl = TUNE.waterLevel, b = m.bombFly;
  if (!b || b.done) return;
  b.t += dt;
  const at = s => ({ x: b.ox + b.ux * s, z: b.oz + b.uz * s });
  let s, y;
  const tFall = b.fall / b.vh;
  if (b.t < tFall) {
    s = b.vh * b.t; y = b.oy - 0.5 * 9.81 * b.t * b.t;
    if (y < wl) y = wl;
  } else {
    // the skips: each hop takes `L / v` with v falling off a little each time
    let tt = b.t - tFall, s0 = b.fall, i = 0, v = b.vh * 0.85;
    for (; i < b.hops.length; i++) {
      const L = b.hops[i], th = L / v;
      if (tt < th) break;
      tt -= th; s0 += L; v *= 0.86;
    }
    if (i !== b.seg) {
      b.seg = i;
      const p = at(s0);
      // a splash where it touches: white, bigger the faster it is going
      for (let k = 0; k < 10; k++) dadEmit(W.smoke, p.x, wl + 0.5, p.z, dadR(-6, 6) + b.ux * v * 0.15, dadR(4, 12), dadR(-6, 6) + b.uz * v * 0.15, dadR(0.8, 1.6), 3, dadR(10, 18), 0.9, 0xf2f4f7, 1.2, -6);
      b.splashes++;
      // and a ring on the water where it touched, spreading and fading: the skips read as a trail
      const rg = W.skipRings[b.splashes % W.skipRings.length];
      rg.position.set(p.x, wl + 0.15, p.z); rg.scale.setScalar(2); rg.material.opacity = 0.85; rg.visible = true; rg.userData.t = 0;
      if (b.r.kind === "broke") { dadDamBreakUp(p); return; }
    }
    if (i < b.hops.length) {
      const L = b.hops[i], th = L / v, u = tt / th;
      let hgt = Math.max(1.5, L * T.hopH);
      if (b.r.kind === "over" && i === b.hops.length - 1) hgt = D.crest - wl + 8;
      s = s0 + L * u; y = wl + 4 * hgt * u * (1 - u) + 0.6;
    } else {
      // at rest: it sinks (against the wall, if that is where it is)
      s = b.endS; b.sinkT += dt; y = wl + 0.6 - b.sinkT * T.sink;
      if (b.sinkT >= T.sinkFor) { dadDamGoesOff(at(s), b.r); return; }
    }
  }
  const p = at(s);
  W.bomb.position.set(p.x, y, p.z);
  W.bomb.rotation.set(0, Math.atan2(-b.ux, -b.uz), 0, "YXZ");
  W.bomb.rotateX(-b.t * 52);   // the backspin: 500 rpm
  W.bomb.rotateZ(Math.PI / 2);
}
function dadDamBreakUp(p) {
  const m = dad.m, W = dad.world, b = m.bombFly;
  b.done = true; W.bomb.visible = false;
  for (let k = 0; k < 30; k++) dadEmit(W.smoke, p.x, TUNE.waterLevel + 1, p.z, dadR(-14, 14) + b.ux * 30, dadR(6, 24), dadR(-14, 14) + b.uz * 30, dadR(1.5, 2.6), 4, dadR(16, 30), 0.9, 0xf2f4f7, 1, -5);
  dadSay(b.r.why, 3);
  dadDamAfterBomb();
}
// it goes off at depth: a column of water (white, climbing hundreds of feet); on the wall,
// the breach a moment later
function dadDamGoesOff(p, r) {
  const m = dad.m, W = dad.world, T = TUNE.dad.dam, wl = TUNE.waterLevel, b = m.bombFly;
  b.done = true; W.bomb.visible = false;
  const big = r.kind === "wall" ? 1 : 0.55;
  // a pillar: fast and nearly straight up (the Möhne's climbed about 1,000 ft), a skirt of spray round its foot
  for (let k = 0; k < 260 * big; k++) {
    const a = dadR(0, 6.283), out = dadR(1, 9) * big;
    dadEmit(W.smoke, p.x + Math.cos(a) * dadR(0, 8), wl + dadR(0, 6), p.z + Math.sin(a) * dadR(0, 8), Math.cos(a) * out, dadR(50, 170) * big, Math.sin(a) * out,
      dadR(5, 9), dadR(14, 24), dadR(55, 120) * big, 0.92, dadRand() < 0.5 ? 0xf2f4f7 : 0xdfe6ee, 0.35, -6);
  }
  for (let k = 0; k < 70 * big; k++) {
    const a = dadR(0, 6.283), out = dadR(20, 45) * big;
    dadEmit(W.smoke, p.x, wl + 1, p.z, Math.cos(a) * out, dadR(8, 20), Math.sin(a) * out, dadR(3, 5), dadR(10, 16), dadR(30, 50), 0.8, 0xdfe6ee, 0.5, -4);
  }
  const d = Math.hypot(p.x - state.x, p.z - state.z);
  m.shake = Math.max(m.shake, clamp(1 - d / 1500, 0.15, 0.8));
  dadBoom(3 * big, d);
  if (r.kind === "wall") { m.breachT = T.breachAfter; dadSay("ON THE WALL -- IT'S GONE OFF", 2.5); }
  else { dadSay(r.why, 3); dadDamAfterBomb(); }
}
function dadDamAfterBomb() {
  const m = dad.m;
  m.bombFly = null;
  if (m.bombs <= 0 && !m.breached && !m.over) { m.failT = 4; }
}
function dadDamBreach() {
  const m = dad.m, W = dad.world, D = W.dam;
  m.breached = true; D.breached = true; m.bombFly = null;
  for (const s of D.segs) if (s.mid) s.g.visible = false;
  D.rubble.visible = true;
  // the sheet: across the gap, from high in the notch falling west down to the water 22 m out.
  // A plane turned so its width runs along z (the gap) and its length slopes down to the west
  const T2 = TUNE.dad.dam, wl2 = TUNE.waterLevel, lip = 10, out = 22;
  D.fall.scale.set(T2.breachHalf * 1.2, Math.hypot(lip, out), 1);
  D.fall.position.set(D.x - T2.thick / 2 - out / 2, wl2 + lip / 2, D.zc);
  D.fall.rotation.set(0, 0, 0); D.fall.rotateY(Math.PI / 2); D.fall.rotateX(Math.atan2(out, lip));
  D.fall.visible = true;
  m.torrent = TUNE.dad.dam.torrentFor;
  m.shake = Math.max(m.shake, 0.7);
  dadBoom(4, Math.hypot(D.x - state.x, D.zc - state.z));
  dadSay("DAM BREACHED", 4);
  m.winT = TUNE.dad.dam.winAfter;
}

// ---- the defences: a light flak gun and a searchlight on each tower
function dadDamDefences(dt) {
  const m = dad.m, W = dad.world, D = W.dam, T = TUNE.dad.dam, F = T.flak;
  const f = dadFwd(dadTmpF);
  for (const t of D.towers) {
    const dx = state.x - t.x, dy = state.y - t.y, dz = state.z - t.z, d = Math.hypot(dx, dy, dz);
    const near = d < F.range * 1.4 && !state.exploding && !m.over;
    // the searchlight: on him when he is near, sweeping the sky when he is not
    t.sweep += dt * 0.35;
    const aim = near ? dadDamB.set(state.x, state.y, state.z) : dadDamB.set(t.x + Math.cos(t.sweep) * 300 + 300, t.y + 260, t.z + Math.sin(t.sweep) * 400);
    t.beam.lookAt(aim);
    if (!near) continue;
    t.gapT -= dt;
    if (t.burstT <= 0 && t.gapT <= 0) { t.burstT = F.burst; t.gapT = F.gap; }
    if (t.burstT <= 0) continue;
    t.burstT -= dt;
    t.shotT -= dt;
    const tof = d / F.speed;
    while (t.shotT <= 0) {
      t.shotT += 1 / F.rof;
      const lead = tof * dadR(0.6, 1.3);
      const px = state.x + f.x * state.speed * lead + dadR(-F.spread, F.spread), py = state.y + f.y * state.speed * lead + dadR(-F.spread, F.spread) * 0.5, pz = state.z + f.z * state.speed * lead + dadR(-F.spread, F.spread);
      const qx = px - t.x, qy = py - t.y, qz = pz - t.z, ql = Math.hypot(qx, qy, qz) || 1;
      dadShoot(W.tracer, t.x, t.y, t.z, qx / ql * F.speed, qy / ql * F.speed, qz / ql * F.speed, Math.min(3, (ql + 500) / F.speed));
      if (d < F.range && dadRand() < F.hit * (1 - d / F.range)) {
        m.flakHits++;
        m.health = Math.max(0, m.health - F.damage);
        m.shake = Math.max(m.shake, 0.5);
        dadNoise(0.12, 3200, 0.25);
        dadSay("HIT", 1);
        if (m.health <= 0) { dadBlast(state.x, state.y, state.z, 2, false); dadEnd("fail", "shot down", true); return; }
      }
    }
    dadEmit(W.fire, t.x, t.y, t.z, 0, 0, 0, 0.06, 8, 3, 1, 0xffd070, 0, 0);
  }
}

function dadDamStep(dt) {
  const m = dad.m, W = dad.world, T = TUNE.dad.dam, D = W.dam;
  if (!m || !W) return;
  dadMisTick(dt);
  if (!m.over) {
    if (m.breachT > 0) { m.breachT -= dt; if (m.breachT <= 0) dadDamBreach(); }
    if (m.winT > 0) { m.winT -= dt; if (m.winT <= 0) dadEnd("success", "dam breached", false); }
    if (m.failT > 0) { m.failT -= dt; if (m.failT <= 0 && !m.breached) dadEnd("fail", "dam intact: three bombs gone", false); }
  }
  dadDamBombStep(dt);
  dadDamDefences(dt);
  // the torrent through the breach: white water pouring out west, and its roar
  if (m.torrent > 0) {
    m.torrent -= dt;
    const wl = TUNE.waterLevel;
    for (let i = 0; i < 22; i++) {
      const z = D.zc + dadR(-1, 1) * (T.breachHalf - 3);
      dadEmit(W.smoke, D.x - T.thick / 2 - 1, wl + dadR(-1, 6), z, -dadR(30, 60), dadR(-2, 8), dadR(-6, 6), dadR(4, 7), dadR(6, 10), dadR(30, 52), 0.85, dadRand() < 0.5 ? 0xf2f4f7 : 0xc8d3df, 0.2, -3);
    }
    if (dadRand() < 0.5) dadEmit(W.smoke, D.x + 4, wl + dadR(0, 2), D.zc + dadR(-1, 1) * T.breachHalf, -dadR(4, 10), dadR(1, 3), 0, 2, 8, 22, 0.6, 0xdfe6ee, 0.3, 0);
  }
  // the skip rings spread and fade
  for (const rg of W.skipRings) {
    if (!rg.visible) continue;
    rg.userData.t += dt;
    rg.scale.setScalar(2 + rg.userData.t * 5);
    rg.material.opacity = Math.max(0, 0.85 * (1 - rg.userData.t / 4));
    if (rg.userData.t > 4) rg.visible = false;
  }
  // the lamps
  const sp = dadDamSpots();
  for (let i = 0; i < 2; i++) {
    const L = W.lamps[i], s = sp[i];
    L.spot.visible = !!s.hit && !state.exploding && !m.over;
    L.ray.visible = L.spot.visible;
    if (s.hit) {
      L.spot.position.set(s.hit.x, TUNE.waterLevel + 0.12, s.hit.z);
      L.spot.scale.setScalar(T.spotR);
      const a = L.ray.geometry.attributes.position;
      a.setXYZ(0, s.o.x, s.o.y, s.o.z); a.setXYZ(1, s.hit.x, s.hit.y, s.hit.z); a.needsUpdate = true;
    }
  }
  m.spotGap = sp[0].hit && sp[1].hit ? Math.hypot(sp[0].hit.x - sp[1].hit.x, sp[0].hit.z - sp[1].hit.z) : null;
  // the moon, low in the south-west sky, and its light
  // (inside the 3 km sky dome, or the dome hides it)
  const mx = camera.position.x - 2400, my = camera.position.y + 850, mz = camera.position.z - 1100;
  W.moon.position.set(mx, my, mz); W.moon.lookAt(camera.position);
  W.moonLight.position.set(state.x - 360, state.y + 150, state.z - 320); W.moonLight.target.position.set(state.x, state.y, state.z);
  m.propRpm = 45;
  dadStepParticles(W.smoke, dt); dadStepParticles(W.fire, dt); dadStepStreaks(W.tracer, dt);
  if (typeof setTone === "function") {
    setTone("dadProp", "sawtooth", 58 + state.speed * 0.12, !m.over || !state.exploding ? 0.022 : 0);
    setTone("dadProp2", "square", 29 + state.speed * 0.06, !state.exploding ? 0.012 : 0);
  }
  dadDamHud();
}

// ---- the HUD: the three numbers of the release, each against its window, the lamps, the
// distance to the wall, the bombs; the dam marked
function dadDamHudBuild() {
  const hud = dadEl("div", { id: "dadHud", class: "dadMisHud" });
  dad.dom.push(hud);
  const mk = (cls, parent, txt) => { const e = dadEl("div", { class: cls }, parent || hud); if (txt) e.textContent = txt; return e; };
  const h = dad.hud = { msg: mk("dadMsg"), warn: mk("dadWarn") };
  const panel = mk("dadDamPanel");
  h.cells = {};
  for (const [k, lab] of [["ft", "HEIGHT"], ["mph", "SPEED"], ["yd", "RANGE"]]) {
    const c = mk("dadDamCell", panel);
    mk("dadDamLab", c, lab);
    h.cells[k] = { c, v: mk("dadDamVal", c), w: mk("dadDamWin", c) };
  }
  h.lamps = mk("dadDamLamps");
  // the lamps' gauge: the two spots as they lie on the water, fore and aft, drawn side by side
  // (from the bomb aimer's seat the spots are under the aircraft, out of sight)
  h.gauge = mk("dadDamGauge"); h.gFore = mk("dadDamDot", h.gauge); h.gAft = mk("dadDamDot aft", h.gauge);
  h.bombs = mk("dadDamBombs");
  h.health = mk("dadHealth"); h.healthBar = mk("bar", h.health);
  h.mark = dadMarkMake(hud);
}
function dadDamHud() {
  const h = dad.hud, m = dad.m, W = dad.world, D = W.dam, T = TUNE.dad.dam, wl = TUNE.waterLevel;
  if (!h) return;
  const W1 = T.window;
  const ft = dadDamFt(state.y - wl), mph = dadDamMph(state.speed * Math.cos(state.pitch * DEG));
  const face = D.x + T.thick / 2, f = dadFwd(dadTmpF), hl = Math.hypot(f.x, f.z) || 1;
  const yd = f.x / hl < -0.05 && state.x > face ? dadDamYd((face - state.x) / (f.x / hl)) : null;
  const set = (k, val, lo, hi, fmt, win) => {
    const c = h.cells[k];
    c.v.textContent = val === null ? "--" : fmt(val);
    c.w.textContent = win;
    const ok = val !== null && val >= lo && val <= hi;
    c.c.classList.toggle("ok", ok); c.c.classList.toggle("hi", val !== null && val > hi); c.c.classList.toggle("lo", val !== null && val < lo);
    return ok;
  };
  const a = set("ft", ft, W1.ftMin, W1.ftMax, v => Math.round(v) + " FT", W1.ftMin + "-" + W1.ftMax);
  const b = set("mph", mph, W1.mphMin, W1.mphMax, v => Math.round(v) + " MPH", W1.mphMin + "-" + W1.mphMax);
  const c = set("yd", yd, W1.ydMin, W1.ydMax, v => Math.round(v) + " YD", W1.ydMin + "-" + W1.ydMax);
  m.window = { ft: a, mph: b, yd: c, all: a && b && c };
  // the lamps: apart (high), touching, or crossed (low)
  const g = m.spotGap;
  // too high and the beams have crossed before the water; too low and they have not yet met
  // only on a run: low, and pointed at the dam from its east side
  const run = !m.bombFly && state.x > face && f.x / hl < -0.7 && ft < 250;
  h.lamps.textContent = m.over || g === null || !run ? "" : g < T.together ? "SPOTS TOGETHER  60 FT" : (state.y - wl > T.height ? "SPOTS CROSSED -- DOWN" : "SPOTS APART -- UP");
  h.lamps.className = "dadDamLamps" + (g !== null && g < T.together ? " ok" : "");
  // the gauge: each dot offset by half the gap, the fore spot ahead (right) when he is low and
  // behind (left) when high, where the beams have crossed; together, one green dot
  const gOn = !(m.over || g === null || !run);
  h.gauge.style.display = gOn ? "block" : "none";
  if (gOn) {
    const off = Math.min(48, g * 6) * (state.y - wl > T.height ? -1 : 1);
    h.gFore.style.transform = "translateX(" + off.toFixed(1) + "px)"; h.gAft.style.transform = "translateX(" + (-off).toFixed(1) + "px)";
    h.gauge.classList.toggle("ok", g < T.together);
  }
  h.bombs.textContent = "BOMBS " + m.bombs + (m.window.all && dadDamCan() ? "   ▶ RELEASE" : "");
  h.bombs.classList.toggle("go", !!(m.window.all && dadDamCan()));
  h.healthBar.style.width = m.health + "%";
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  const warns = [];
  if (!m.over && D.towers.some(t => Math.hypot(t.x - state.x, t.z - state.z) < T.flak.range * 1.4)) warns.push("FLAK");
  h.warn.textContent = warns.join("   "); h.warn.classList.toggle("on", warns.length > 0);
  // the dam's mark, while it is ahead of him (over it and past, he is turning for the next run)
  const dm = Math.hypot(D.x - state.x, D.zc - state.z);
  h.mark.update(m.over || m.breached || state.x < D.x + 60 ? null : { x: D.x, y: D.crest + 22, z: D.zc }, dm, Math.round(yd !== null ? yd : dadDamYd(dm)) + " yd");   // the panel's own number when it has one
}

dadMissionDef({
  id: "dam", title: "Dambusters", kicker: "16–17 MAY 1943  ·  FOUR-ENGINE BOMBER",
  history: "Operation Chastise. Nineteen Lancasters of 617 Squadron, modified to carry Barnes Wallis's bouncing bomb (Upkeep), " +
    "flew at night under a full moon against the dams of the Ruhr. Each bomb had to be released at 60 ft, at about 232 mph and " +
    "425–475 yards from the wall; two spotlights under the aircraft met on the water at exactly 60 ft. At the Möhne the dam broke " +
    "at the fifth bomb; the Eder fell the same night. Eight of the nineteen aircraft were lost: 53 of the 133 aircrew were killed and three taken prisoner.",
  how: [
    "Night, low over the lake. Come in from the east along the south arm and run at the dam.",
    "Hold 55–65 ft: the two lamps' spots meet on the water at 60 ft (above it the beams have crossed before the water; below it they have not met).",
    "Speed 220–245 mph, release 400–480 yards out. The three panels turn green; drop.",
    "Too high or fast, it breaks up. Too low, slow or far, it sinks short. Too close, it jumps the dam.",
    "Flak and searchlights on the towers. Three bombs. One on the wall breaches it.",
  ],
  night: true,
  buttons: { bomb: true },
  build: dadDamBuild, start: dadDamStart, fly: dadDamFly, step: dadDamStep,
  camera: dt => dadAirCamera(dt, { back: 68, up: 16, look: 140, eye: [0, 0.2, -9.1] }),   // the seat: the bomb aimer's, past the nose glazing
  pose: () => dadAirPose(dad.world.body),
  hud: dadDamHudBuild,
  bombCan: dadDamCan, drop: dadDamRelease,
  cardRows: () => {
    const m = dad.m, r = m.hitRelease;
    const rows = [["Time", dadFmtClock(m.endT || m.t)], ["Bombs used", m.bombsUsed + " of " + TUNE.dad.dam.bombs], ["Aircraft damage", Math.round(100 - m.health) + "%"]];
    if (r) rows.push(["The bomb that breached it", Math.round(r.ft) + " ft, " + Math.round(r.mph) + " mph, " + Math.round(r.yd) + " yd"]);
    m.runs.forEach((x, i) => { if (x !== r) rows.push(["Bomb " + (i + 1), x.why ? x.why.toLowerCase() : "on the wall"]); });
    return rows;
  },
});
