"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE, MISSION 5: MIRACLE ON THE HUDSON (v157). 15 January 2009.
//
// Dad mode only: built on entry, gone on exit, nothing saved, no Math.random.
//
// A twin-engined narrow-body airliner -- the game's own procedural airliner shape at A320
// size, plain (the airliner models in the game carry real liveries, so they are not used)
// -- climbs out of his New York airport. At `strikeFt` a flock crosses its nose: both
// engines go, the engine voice stops and the wind is all there is. It glides: best glide at
// `vbg`, the ratio `ld`. He turns back for the water -- the channel south of the airport,
// New York's river -- and ditches: wings level, the nose a little up, not too fast, not
// sinking too hard. A good ditching floats (the card is the survivors'); a bad one breaks
// up. Land is a crash, and so is anything solid of his (the city's towers, a bridge). The same
// water rule as everything: terrainEff < seaLevelAt.
//
// THE NOSE is not the path. The shared model flies where it points; an airliner's nose rides
// above its path by the angle of attack, which grows as she slows (`aoa0` at best glide, by
// (vbg / v)^2). The ditching reads the NOSE: slow and flared, it is up where it should be;
// fast, it is flat and she digs in.
// ---------------------------------------------------------------------------
function dadBuildA320() {
  const M = dadMatsFor({ body: TUNE.palette.white, belly: TUNE.palette.steel, wing: TUNE.palette.grey, eng: TUNE.palette.slate, glass: TUNE.palette.night, fin: TUNE.palette.blue });
  const g = new THREE.Group();
  // the game's airliner (vehicle.js), at an A320's size: 37.6 m long, 34 m span
  const k = 2.6;
  dadCyl(g, 1.05 * k * 0.72, 1.05 * k * 0.72, 13.4 * k, M.body, 0, 0, 0, 14);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05 * k * 0.72, 14, 10), M.body); nose.scale.set(1, 1, 1.5); nose.position.z = -6.7 * k; g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.05 * k * 0.72, 2.6 * k, 14), M.body); tail.rotation.x = Math.PI / 2; tail.position.z = 8.0 * k; g.add(tail);
  dadBox(g, 0.9, 0.5, 1.6, M.glass, 0, 0.75, -6.9 * k);
  dadWing(g, 1.6, 17, 6.5, 1.7, 5.5, 0.4, M.wing, -0.9, -0.6);
  dadWing(g, -1.6, -17, 6.5, 1.7, 5.5, 0.4, M.wing, -0.9, -0.6);
  for (const sx of [-1, 1]) dadBox(g, 0.2, 2.2, 1.2, M.wing, sx * 17, 0.1, 5.2);   // the sharklets, tip fences
  const fin = dadWing(g, 0, 0, 5.5, 2.4, 4.2, 0.3, M.fin, 0, 13); fin.rotation.z = Math.PI / 2; fin.position.set(0, 1.6, 15.5);
  fin.scale.set(1, 1, 1);
  dadBox(g, 0.3, 6.5, 0.3, M.fin, 0, 4.3, 16.8).visible = false;
  dadWing(g, 0.5, 6.2, 3.6, 1.6, 2.2, 0.25, M.wing, 0.8, 15.4);
  dadWing(g, -0.5, -6.2, 3.6, 1.6, 2.2, 0.25, M.wing, 0.8, 15.4);
  const engines = [];
  for (const sx of [-5.8, 5.8]) {
    const e = dadCyl(g, 1.05, 0.85, 4.2, M.eng, sx, -2.0, -3.6, 14);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.95, 14), M.belly); fan.position.set(sx, -2.0, -5.72); fan.rotation.y = Math.PI; g.add(fan);
    engines.push({ x: sx, y: -2.0, z: -3.6 });
  }
  g.userData.engines = engines;
  return g;
}
// a flock of big dark birds, a V crossing the climb-out (a few dozen flat chevrons)
function dadBuildFlock(W) {
  const mat = new THREE.MeshBasicMaterial({ color: TUNE.palette.ink, side: THREE.DoubleSide });
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, -0.6, -1.6, 0.3, 0.4, 0, 0, 0.1, 0, 0, -0.6, 1.6, 0.3, 0.4, 0, 0, 0.1]), 3));
  const g = new THREE.Group();
  for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(geo, mat); b.position.set((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 4, -Math.ceil(i / 2) * 0.6, Math.ceil(i / 2) * 3.5); b.scale.setScalar(1.6); g.add(b); }
  g.visible = false; dadAdd(g); W.flock = g;
}
function dadHuBuild(W) {
  const body = dadBuildA320(); dadAdd(body); W.body = body;
  dadBuildFlock(W);
}
function dadHuStart() {
  const H = TUNE.dad.hudson, W = dad.world, ap = { cx: 0, cz: AIRPORTS[H.airport].cz };
  dadSeedNow = dad.seed + 5;
  dad.m = { t: 0, over: false, result: null, why: "", overT: 0, card: false, shake: 0, msg: "", msgT: 0,
    struck: false, strikeT: null, strikeAt: null, thrust: 0, thr: 1, q: 0, load: 1, auto: true, ditch: null, flaps: false, maxFt: 0, glideStart: null };
  for (const P of [W.smoke, W.fire, W.tracer]) P.life.fill(0);
  // climbing out north off the runway, already airborne and cleaned up, as the flight was
  // (the take-off roll is not the story); the climb hands to him at once
  state.x = ap.cx + H.start.dx; state.z = ap.cz + H.start.dz;
  state.y = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + H.start.agl;
  state.heading = H.start.heading; state.pitch = H.start.pitch; state.bank = 0;
  state.speed = H.start.kt / 1.944;
  state.phase = "AIRBORNE"; state.airVy = null; state.exploding = false; state.explodeTimer = 0;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.cam = null;
  W.flock.visible = false;
  const card = document.getElementById("dadCard"); if (card) card.remove();
}
function dadHuAgl() { return state.y - Math.max(terrainEff(state.x, state.z), seaLevelAt(state.x, state.z)); }
// the nose's attitude: the path plus the angle of attack
function dadHuNose() { const A = TUNE.dad.air.a320; if (dad.m && dad.m.ditch) return state.pitch;   // afloat (or wrecked): her attitude, no wing flying
  return state.pitch + Math.min(A.aoaMax, A.aoa0 * Math.pow(A.vbg / Math.max(20, state.speed), 2)); }
function dadHuFly(dt) {
  const m = dad.m, H = TUNE.dad.hudson, A = TUNE.dad.air.a320;
  if (!m) return;
  state.phase = "AIRBORNE"; state.airVy = null; rumble = 0;
  if (typeof setEngine === "function") setEngine(0);
  if (state.exploding || m.ditch) return;
  m.auto = false;
  m.thrust = m.struck ? 0 : A.thrust * H.climbPower;
  const P = m.flaps ? Object.assign({}, A, { vStall: A.vStall * H.flapK, ld: A.ld * H.flapLd }) : A;
  dadAirFly(dt, P, m);
  const ft = dadHuAgl() * 3.281;
  m.maxFt = Math.max(m.maxFt, ft);
  // flaps 2 for the ditching, low and slow, as the crew set them
  if (m.struck && !m.flaps && ft < H.flapsAtFt) { m.flaps = true; dadSay("FLAPS 2", 1.5); }
  if (m.over) return;
  // the surface: water is a ditching, anything else a crash; anything solid of his, a crash
  if (dadHuAgl() < A.touchAgl) { dadHuDown(); return; }
  const hit = solidQuery(state.x, state.y, state.z, TUNE.solid.r.dad, SOLID.AIR, undefined, null, false);
  if (hit) { m.ditch = { water: false, solid: true, hitKind: hit.kind || typeof hit, hitAt: hit.x !== undefined ? [Math.round(hit.x), Math.round(hit.z)] : null, kt: Math.round(state.speed * 1.944), sink: 0, pitch: +dadHuNose().toFixed(1), bank: +state.bank.toFixed(1) };
    dadBlast(state.x, state.y, state.z, 2.4, false); dadEnd("fail", "flew into something solid", true); }
}
function dadHuDown() {
  const m = dad.m, H = TUNE.dad.hudson, wl = TUNE.waterLevel;
  const water = terrainEff(state.x, state.z) < seaLevelAt(state.x, state.z);
  const vs = state.speed * Math.sin(-state.pitch * DEG) * 196.85, kt = state.speed * 1.944;   // fpm down, knots
  // the path's own sink, not the nose's: how fast he was coming down the last second
  const sink = m.vsSmooth !== undefined ? -m.vsSmooth * 196.85 : vs;
  const nose = dadHuNose();
  m.ditch = { water, kt: Math.round(kt), sink: Math.round(sink), pitch: +nose.toFixed(1), bank: +state.bank.toFixed(1), x: Math.round(state.x), z: Math.round(state.z) };
  const D = H.ditch;
  let why = null;
  if (!water) why = "came down on land";
  else if (Math.abs(state.bank) > D.bankMax) why = "a wing tip caught the water and she broke up";
  else if (nose < D.pitchMin) why = "nose too low into the water: she dug in and broke up";
  else if (nose > D.pitchMax) why = "tail first, too nose-high: she broke up";
  else if (kt > D.ktMax) why = "too fast into the water (" + Math.round(kt) + " kt): she broke up";
  else if (sink > D.sinkMax) why = "sinking too hard (" + Math.round(sink) + " ft/min): she broke up";
  state.y = Math.max(terrainEff(state.x, state.z), seaLevelAt(state.x, state.z)) + 2.4;
  if (!why) {
    state.speed = 0; state.pitch = 3; state.bank = 0;
    dadSay("SHE FLOATS -- EVERYONE OUT ON THE WINGS", 5);
    for (let i = 0; i < 40; i++) dadEmit(dad.world.smoke, state.x + dadR(-12, 12), wl + 0.5, state.z + dadR(-12, 12), dadR(-6, 6), dadR(3, 9), dadR(-6, 6), dadR(1, 2), 4, dadR(14, 24), 0.9, 0xf2f4f7, 1.2, -6);
    dadEnd("success", "ditched: she floats", false);
  } else {
    dadBlast(state.x, state.y, state.z, water ? 1.6 : 2.4, true);
    if (water) for (let i = 0; i < 60; i++) dadEmit(dad.world.smoke, state.x + dadR(-20, 20), wl + 0.5, state.z + dadR(-20, 20), dadR(-12, 12), dadR(6, 22), dadR(-12, 12), dadR(1.5, 3), 5, dadR(18, 34), 0.9, 0xf2f4f7, 1, -6);
    dadEnd("fail", why, true);
  }
}
function dadHuStrike() {
  const m = dad.m, W = dad.world;
  m.struck = true; m.strikeT = m.t; m.strikeAt = { x: state.x, z: state.z, ft: Math.round(dadHuAgl() * 3.281) };
  m.glideStart = { x: state.x, z: state.z };
  m.shake = 0.9;
  for (let i = 0; i < 4; i++) dadNoise(0.15, 1800 + i * 300, 0.25, i * 0.07);
  dadBoom(0.8, 10);
  dadSay("BIRDS -- BOTH ENGINES", 3);
}
function dadHuStep(dt) {
  const m = dad.m, W = dad.world, H = TUNE.dad.hudson;
  if (!m || !W) return;
  dadMisTick(dt);
  // the path's vertical speed, smoothed: what the sink at the water is read off
  const vy = state.speed * Math.sin(state.pitch * DEG);
  m.vsSmooth = m.vsSmooth === undefined ? vy : m.vsSmooth + (vy - m.vsSmooth) * Math.min(1, 2 * dt);
  const ft = dadHuAgl() * 3.281;
  // the flock: shown crossing ahead a few seconds before, and through him at the strike
  if (!m.struck && !m.over) {
    const f = dadFwd(dadTmpF), toGo = (H.strikeFt - ft) / Math.max(1, state.speed * Math.sin(Math.max(1, state.pitch) * DEG) * 3.281);
    if (toGo < 4) {
      W.flock.visible = true;
      const ahead = Math.max(0, toGo) * state.speed;
      W.flock.position.set(state.x + f.x * ahead + dadR(-0.3, 0.3), state.y + f.y * ahead + 1, state.z + f.z * ahead);
      W.flock.rotation.y = state.heading + Math.PI / 2;
      for (const b of W.flock.children) b.rotation.z = Math.sin(m.t * 12 + b.position.x) * 0.5;
    }
    if (ft >= H.strikeFt) { dadHuStrike(); W.flock.visible = false; }
  }
  // after the strike: smoke and a little fire from both engines for a while
  if (m.struck && !m.over && m.t - m.strikeT < H.smokeFor) {
    const b = W.body, e = b.userData.engines;
    for (const en of e) {
      const p = new THREE.Vector3(en.x, en.y, en.z + 2.5).applyEuler(b.rotation).add(b.position);
      dadEmit(W.smoke, p.x, p.y, p.z, 0, 0, 0, dadR(1.5, 2.5), 2, dadR(8, 14), 0.6, 0x3c4350, 0.4, 0.5);
      if (m.t - m.strikeT < 3 && dadRand() < 0.5) dadEmit(W.fire, p.x, p.y, p.z, 0, 0, 0, 0.12, 3, 1.5, 1, 0xff8a2a, 0, 0);
    }
  }
  dadStepParticles(W.smoke, dt); dadStepParticles(W.fire, dt);
  if (typeof setTone === "function") {
    setTone("dadJet", "sawtooth", 90 + state.speed * 0.4, !m.struck && !m.over ? 0.02 : 0);
    setTone("dadWind", "sawtooth", 140 + state.speed * 0.6, m.struck && !m.over ? 0.008 + state.speed * 0.00008 : 0);
  }
  dadHuHud();
}
function dadHuHudBuild() {
  const hud = dadEl("div", { id: "dadHud", class: "dadMisHud" });
  dad.dom.push(hud);
  const mk = (cls, parent, txt) => { const e = dadEl("div", { class: cls }, parent || hud); if (txt) e.textContent = txt; return e; };
  const h = dad.hud = { msg: mk("dadMsg"), warn: mk("dadWarn") };
  const panel = mk("dadDamPanel");
  h.cells = {};
  for (const [k, lab] of [["kt", "AIRSPEED"], ["ft", "ALTITUDE"], ["glide", "GLIDE"], ["t", "SINCE STRIKE"]]) { const c = mk("dadDamCell", panel); mk("dadDamLab", c, lab); h.cells[k] = { c, v: mk("dadDamVal", c), w: mk("dadDamWin", c) }; }
  h.lamps = mk("dadDamLamps");
  h.mark = dadMarkMake(hud);
}
function dadHuHud() {
  const h = dad.hud, m = dad.m, H = TUNE.dad.hudson, A = TUNE.dad.air.a320;
  if (!h) return;
  const ft = Math.max(0, dadHuAgl() * 3.281), kt = state.speed * 1.944, fpm = (m.vsSmooth || 0) * 196.85;
  const put = (k, v, w, ok, bad) => { const c = h.cells[k]; c.v.textContent = v; c.w.textContent = w; c.c.classList.toggle("ok", !!ok); c.c.classList.toggle("bad", !!bad); };
  put("kt", Math.round(kt) + " KT", m.struck ? "BEST GLIDE " + Math.round(A.vbg * 1.944) : "CLIMB", Math.abs(kt - A.vbg * 1.944) < 15, kt < A.vStall * 1.944 * 1.1);
  put("ft", Math.round(ft) + " FT", (fpm >= 0 ? "+" : "") + Math.round(fpm) + " FPM  ·  NOSE " + dadHuNose().toFixed(0) + "°", false, m.struck && ft < 300 && -fpm > H.ditch.sinkMax);
  // still air: how far this height carries her at the speed and sink she has now (the nominal
  // ratio until she is gliding)
  const sinkMs = -(m.vsSmooth || 0), reach = dadHuAgl() * (m.struck && sinkMs > 0.5 ? Math.min(30, state.speed * Math.cos(state.pitch * DEG) / sinkMs) : A.ld);
  put("glide", (reach / 1609).toFixed(1) + " MI", m.struck ? "STILL AIR" : "", m.struck);
  put("t", m.struck ? dadFmtClock(m.t - m.strikeT) : "--", m.struck ? "ENG 1 + 2 OUT" : "", false, m.struck);
  let lamp = "";
  if (!m.struck) lamp = "CLIMBING OUT -- " + Math.round(H.strikeFt - ft) + " FT TO GO";
  else if (!m.over && ft > 400) lamp = "TURN FOR THE RIVER -- HOLD BEST GLIDE";
  else if (!m.over) lamp = "WINGS LEVEL  ·  NOSE UP A LITTLE  ·  UNDER " + H.ditch.ktMax + " KT";
  h.lamps.textContent = lamp;
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  const warns = []; if (m.struck && !m.over) { if (kt < A.vStall * 1.944 * 1.12) warns.push("STALL"); if (ft < 300 && -fpm > H.ditch.sinkMax) warns.push("SINK RATE"); }
  h.warn.textContent = warns.join("   "); h.warn.classList.toggle("on", warns.length > 0);
  h.mark.update(m.struck && !m.over ? { x: H.river.x, y: TUNE.waterLevel + 10, z: H.river.z } : null, Math.hypot(H.river.x - state.x, H.river.z - state.z), "RIVER " + (Math.hypot(H.river.x - state.x, H.river.z - state.z) / 1609).toFixed(1) + " MI");
}
dadMissionDef({
  id: "hudson", title: "Miracle on the Hudson", kicker: "15 JANUARY 2009  ·  TWIN-ENGINE AIRLINER",
  history: "US Airways Flight 1549, an Airbus A320 with 150 passengers and 5 crew, climbed out of LaGuardia. At 2,818 ft, a little over two " +
    "minutes after take-off clearance, it flew into a flock of Canada geese and lost thrust in both engines. Captain Chesley Sullenberger and " +
    "First Officer Jeffrey Skiles could reach neither LaGuardia nor Teterboro (\"Unable\"), and less than four minutes after the strike they ditched " +
    "in the Hudson, about opposite West 50th Street: 125 knots, the nose 9.5 degrees up, sinking 750 ft a minute. All 155 survived.",
  how: [
    "Climbing out of his New York airport, northbound. At 2,800 ft: the birds. Both engines out; silence.",
    "Glide at about best-glide speed; the GLIDE box is how far that height will carry her.",
    "Turn back for the river, the channel south of the airport (the diamond marks it), and line up along it: it is narrow. Mind the city's towers beyond it.",
    "Ditch on the water: wings level, the nose 4–13° up (slow down and it comes up), under 150 kt, sinking under 1,000 ft/min. Flaps come out low.",
    "Too fast, too steep or a wing down and she breaks up. Land is a crash.",
  ],
  buttons: {},
  build: dadHuBuild, start: dadHuStart, fly: dadHuFly, step: dadHuStep,
  camera: dt => dadAirCamera(dt, { back: 70, up: 16, look: 140, eye: [0, 1.4, -15] }),
  pose: () => { const b = dad.world.body; dadAirPose(b); if (b) b.rotation.set(dadHuNose() * DEG, state.heading, -state.bank * DEG, "YXZ"); },
  hud: dadHuHudBuild,
  winTitle: "She floats -- everyone out",
  cardRows: () => {
    const m = dad.m, d = m.ditch;
    const rows = [["Strike to water", m.strikeT === null ? "--" : dadFmtClock((m.endT || m.t) - m.strikeT)]];
    if (d) rows.push(["At the water", d.kt + " kt, nose " + d.pitch + "°, bank " + d.bank + "°, sinking " + d.sink + " ft/min"], ["Where", d.water ? "on the water" : "on land"]);
    rows.push(["The real one", "125 kt, nose 9.5° up, 750 ft/min, under four minutes after the strike"]);
    return rows;
  },
});
