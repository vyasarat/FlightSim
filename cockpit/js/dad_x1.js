"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE, MISSION 6: BREAKING THE SOUND BARRIER (v158). 14 October 1947.
//
// Dad mode only: built on entry, gone on exit, nothing saved, no Math.random.
//
// An orange rocket plane hangs in the bomb bay of a four-engined mothership at 20,000 ft and
// 250 mph over the desert. DROP lets it go; then each press of the chamber button lights one
// more of its four rocket chambers. He climbs to about 42,000 ft, levels, and passes Mach 1 --
// the needle jumps, a cone of shock stands off the nose, the boom rolls out. When the fuel is
// gone he glides down to the dry lake (dad mode's own, a pale bed laid on his desert for the
// sortie) and lands on it. Mach 1 and a landing on the lake is a success.
//
// HIGH UP the world has to be seen from high up: while this mission flies, flight.js asks dad
// mode (dadEnv) for the sky -- the day sky, not space (his space blend starts 900 m up, for
// the rocket), the fog and the far plane pushed out with the height -- and a wide desert floor
// is laid under the streamed ground, out to the horizon. The run is WEST over his desert, which
// goes on for ever east and west, and the glide comes back east to the lake.
//
// THE AIR thins with height: the drag falls with the density, and the speeds the wing needs
// (its stall, its best glide) rise as 1/sqrt(density), so the glide ratio stays the airframe's.
// ---------------------------------------------------------------------------
function dadBuildX1() {
  const M = dadMatsFor({ body: TUNE.palette.fire, glass: TUNE.palette.night, metal: TUNE.palette.grey, ink: TUNE.palette.ink });
  const g = new THREE.Group();
  // a .50-calibre bullet's shape, 9.4 m long, straight thin wings 8.5 m across
  const fus = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 10), M.body); fus.scale.set(1, 1, 5.6); fus.position.z = 0.2; g.add(fus);
  dadBox(g, 0.5, 0.3, 0.7, M.glass, 0, 0.45, -1.9);   // the flush canopy
  dadWing(g, 0.6, 4.25, 1.9, 1.0, 0.25, 0.14, M.body, -0.15, 0);
  dadWing(g, -0.6, -4.25, 1.9, 1.0, 0.25, 0.14, M.body, -0.15, 0);
  dadWing(g, 0.2, 1.8, 1.2, 0.6, 0.35, 0.1, M.body, 1.0, 3.7);
  dadWing(g, -0.2, -1.8, 1.2, 0.6, 0.35, 0.1, M.body, 1.0, 3.7);
  const fin = dadBox(g, 0.12, 1.6, 1.3, M.body, 0, 1.1, 3.6); fin.rotation.x = -0.35;
  // four chambers in a diamond at the tail, each with its own flame
  const flames = [];
  const fmat = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, y] of [[0, 0.22], [0.22, 0], [0, -0.22], [-0.22, 0]]) {
    dadCyl(g, 0.12, 0.14, 0.3, M.ink, x, y, 4.15, 8);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 5.5, 8, 1, true), fmat.clone()); f.rotation.x = -Math.PI / 2; f.position.set(x, y, 7.0); f.visible = false; g.add(f); flames.push(f);
  }
  const gear = new THREE.Group(); for (const [x, z] of [[0, -2.4], [-0.9, 0.6], [0.9, 0.6]]) { dadBox(gear, 0.08, 0.9, 0.08, M.metal, x, -1.1, z); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 10), M.ink); w.rotation.z = Math.PI / 2; w.position.set(x, -1.55, z); gear.add(w); }
  gear.visible = false; g.add(gear);
  // the shock: a pale cone standing off the nose near Mach 1
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.8, 8, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cone.rotation.x = -Math.PI / 2; cone.position.z = 1.2; g.add(cone);
  g.userData.flames = flames; g.userData.gear = gear; g.userData.cone = cone;
  return g;
}
function dadBuildB29() {
  const M = dadMatsFor({ body: TUNE.palette.steel, glass: TUNE.palette.night, ink: TUNE.palette.ink, dark: TUNE.palette.grey });
  const g = new THREE.Group(), props = [];
  dadCyl(g, 1.45, 1.45, 24, M.body, 0, 0, 0, 14);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.45, 14, 10), M.glass); nose.scale.set(1, 1, 1.3); nose.position.z = -12; g.add(nose);
  const tc = new THREE.Mesh(new THREE.ConeGeometry(1.45, 5, 14), M.body); tc.rotation.x = Math.PI / 2; tc.position.z = 14.5; g.add(tc);
  dadWing(g, 1.3, 21.5, 5.4, 2.0, 1.2, 0.5, M.body, -0.3, -2);
  dadWing(g, -1.3, -21.5, 5.4, 2.0, 1.2, 0.5, M.body, -0.3, -2);
  for (const sx of [-12, -6, 6, 12]) { dadCyl(g, 0.75, 0.6, 4.5, M.dark, sx, -0.2, -4.6, 10); dadProp(g, props, 2.1, M.ink, sx, -0.2, -6.9); }
  dadWing(g, 0.5, 7.5, 3.6, 1.6, 1.0, 0.3, M.body, 0.6, 13.5);
  dadWing(g, -0.5, -7.5, 3.6, 1.6, 1.0, 0.3, M.body, 0.6, 13.5);
  const fin = dadBox(g, 0.25, 6.5, 4.2, M.body, 0, 4.2, 14); fin.rotation.x = 0.3;
  g.userData.props = props;
  return g;
}
function dadX1Build(W) {
  const X = TUNE.dad.x1;
  W.body = dadBuildX1(); dadAdd(W.body);
  W.mother = dadBuildB29(); dadAdd(W.mother);
  // the dry lake: a pale bed laid on his desert, following its ground, with the runway marks
  const L = X.lake;
  const geo = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = L.x + p.getX(i) * L.rx, z = L.z + p.getZ(i) * L.rz; p.setXYZ(i, x, terrainEff(x, z) + 0.25, z); }
  geo.computeVertexNormals();
  // a dry lake reads pale against the desert
  const bed = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: TUNE.palette.concrete, polygonOffset: true, polygonOffsetFactor: -2 }));
  dadAdd(bed); W.lake = bed;
  for (let k = -1; k <= 1; k += 2) {
    const n = 40, line = new THREE.BufferGeometry(), pts = [];
    for (let i = 0; i <= n; i++) { const z = L.z - L.rz * 0.8 + i / n * L.rz * 1.6, x = L.x + k * 25; pts.push(x, terrainEff(x, z) + 0.6, z); }
    line.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    dadAdd(new THREE.Line(line, new THREE.LineBasicMaterial({ color: TUNE.palette.ink })));
  }
  // the floor to the horizon. Low down, a ring of desert out past the streamed ground (which
  // shows only ~1.6 km round him). High up, from where that patch would show as a hard-edged
  // tile, one sand floor over all of it (above the desert's highest hills here), with the lake
  // drawn flat on it
  const sandMat = new THREE.MeshLambertMaterial({ color: TUNE.palette.sand });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1500, 90000, 64, 1).rotateX(-Math.PI / 2), sandMat);
  ring.position.y = 1; dadAdd(ring); W.floor = ring;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(90000, 64).rotateX(-Math.PI / 2), sandMat);
  disc.position.y = X.floorHiY; dadAdd(disc); W.floorHi = disc;
  const flat = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: TUNE.palette.concrete, polygonOffset: true, polygonOffsetFactor: -2 }));
  flat.scale.set(L.rx, 1, L.rz); flat.position.set(L.x, X.floorHiY + 0.5, L.z); dadAdd(flat); W.lakeHi = flat;
}
function dadX1Start() {
  const X = TUNE.dad.x1, W = dad.world;
  dadSeedNow = dad.seed + 6;
  dad.m = { t: 0, over: false, result: null, why: "", overT: 0, card: false, shake: 0, msg: "", msgT: 0,
    phase: "hung", lit: 0, fuel: X.fuel, thrust: 0, q: 0, load: 1, mach: 0, maxMach: 0, boom: false, boomT: null, maxFt: 0, auto: true, land: null, propRpm: 40 };
  for (const P of [W.smoke, W.fire, W.tracer]) P.life.fill(0);
  W.mother.userData.x = X.lake.x - X.start.west; W.mother.userData.z = X.lake.z; W.mother.userData.y = X.start.ft / 3.281;
  W.mother.userData.heading = -Math.PI / 2; W.mother.visible = true;   // east
  dadX1Hang();
  state.heading = -Math.PI / 2; state.pitch = 0; state.bank = 0; state.speed = X.start.mph / 2.237;
  state.phase = "AIRBORNE"; state.airVy = null; state.exploding = false; state.explodeTimer = 0;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.cam = null;
  W.body.userData.gear.visible = false;
  const card = document.getElementById("dadCard"); if (card) card.remove();
}
// under the mothership, in its bay
function dadX1Hang() {
  const B = dad.world.mother.userData;
  state.x = B.x; state.y = B.y - TUNE.dad.x1.hangBelow; state.z = B.z - 2;
}
function dadX1Mach() {
  // the speed of sound falls with height to the stratosphere (11 km), then holds
  const h = Math.max(0, state.y);
  const a = h < 11000 ? 340.3 - (340.3 - 295.1) * h / 11000 : 295.1;
  return state.speed / a;
}
function dadX1Fly(dt) {
  const m = dad.m, X = TUNE.dad.x1, A = TUNE.dad.air.x1, W = dad.world;
  if (!m) return;
  state.phase = "AIRBORNE"; state.airVy = null; rumble = 0;
  if (typeof setEngine === "function") setEngine(0);
  // the mothership flies on, level, at 250 mph
  const B = W.mother.userData, bs = X.start.mph / 2.237;
  B.z -= Math.cos(B.heading) * bs * dt; B.x -= Math.sin(B.heading) * bs * dt;
  if (m.phase !== "hung") B.heading += X.motherTurn * dt;   // and away, once he is gone
  if (state.exploding) return;
  // down: she stays where she stopped, on the bed (the flight model would carry on through it)
  if (m.land) { state.y = terrainEff(state.x, state.z) + 1.5; state.speed = 0; state.pitch = 0; state.bank = 0; return; }
  if (m.phase === "hung") { dadX1Hang(); state.speed = bs; state.heading = B.heading; m.mach = dadX1Mach(); return; }
  // the chambers: each lit one burns fuel and pushes; the drag rises through the barrier
  if (m.fuel <= 0 && m.lit > 0) { m.lit = 0; dadSay("FUEL GONE -- GLIDE HOME", 3); }
  m.fuel = Math.max(0, m.fuel - m.lit * dt);
  const mach = dadX1Mach();
  const massK = 1 + (X.fuel - m.fuel) / X.fuel * X.lighter;   // lighter as it burns
  m.thrust = m.lit * X.chamber * massK;
  const bump = Math.exp(-Math.pow((mach - 1.0) / X.waveWidth, 2));
  const rho = Math.max(0.12, Math.exp(-Math.max(0, state.y) / X.scaleH)), sq = Math.sqrt(rho);
  // the wing's speeds rise as the air thins; the drag at a given speed falls with it; the
  // barrier's wave drag is on top, near Mach 1
  const P = Object.assign({}, A, { vbg: A.vbg / sq, vStall: A.vStall / sq, ld: A.ld / (1 + X.waveDrag * bump) });
  dadAirFly(dt, P, m);
  m.mach = dadX1Mach(); m.maxMach = Math.max(m.maxMach, m.mach);
  m.maxFt = Math.max(m.maxFt, state.y * 3.281);
  if (!m.boom && m.mach >= 1) { m.boom = true; m.boomT = m.t; m.boomAt = { ft: Math.round(state.y * 3.281), mph: Math.round(state.speed * 2.237) }; dadX1Boom(); }
  if (m.over) return;
  const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  W.body.userData.gear.visible = agl < X.gearAgl;
  if (agl < A.touchAgl) dadX1Down();
}
function dadX1Boom() {
  const m = dad.m;
  m.shake = 0.8;
  dadNoise(0.5, 120, 0.5); dadNoise(0.5, 120, 0.45, 0.18);
  if (typeof synthBlip === "function") synthBlip("sine", 60, 25, 1.2, 0.35);
  dadSay("MACH 1 -- THE NEEDLE JUMPED", 4);
}
function dadX1Down() {
  const m = dad.m, X = TUNE.dad.x1, L = X.lake;
  const vs = -state.speed * Math.sin(state.pitch * DEG) * 3.281, mph = state.speed * 2.237;
  const dx = (state.x - L.x) / L.rx, dz = (state.z - L.z) / L.rz, onLake = dx * dx + dz * dz < 1;
  m.land = { onLake, vs: +vs.toFixed(1), mph: Math.round(mph), bank: +state.bank.toFixed(1) };
  const D = X.landing;
  let why = null;
  if (vs > D.crashFps || Math.abs(state.bank) > D.bankMax * 2 || mph > D.mphMax) why = "came down too hard";
  else if (!onLake) why = "landed off the lake bed";
  else if (vs > D.vsFps) why = "hard landing, " + vs.toFixed(0) + " ft/s";
  else if (Math.abs(state.bank) > D.bankMax) why = "landed on one wing";
  else if (m.maxMach < 1) why = "landed -- but Mach 1 was never reached";
  state.y = terrainEff(state.x, state.z) + 1.5; state.pitch = 0; state.bank = 0;
  if (!why) { state.speed = 0; dadSay("DOWN ON THE LAKE", 3); dadEnd("success", "supersonic, and down on the lake", false); }
  else if (/too hard/.test(why)) { dadBlast(state.x, state.y, state.z, 1.8, true); dadEnd("fail", why, true); }
  else { state.speed = 0; dadEnd("fail", why, false); }
}
function dadX1Drop() {
  const m = dad.m;
  if (!dadFlying() || m.phase !== "hung") return false;
  m.phase = "free"; m.dropT = m.t; m.auto = false;
  state.pitch = -3;
  dadSay("DROPPED -- LIGHT THE CHAMBERS", 2.5);
  dadNoise(0.3, 400, 0.15);
  return true;
}
function dadX1ChamberCan() { const m = dad.m; return !!m && m.phase === "free" && m.lit < 4 && m.fuel > 0 && !m.over; }
function dadX1Chamber() {
  const m = dad.m;
  if (!dadFlying() || m.phase !== "free" || m.lit >= 4 || m.fuel <= 0) return false;
  m.lit++;
  dadNoise(0.4, 300, 0.25);
  dadSay("CHAMBER " + m.lit + " LIT", 1.5);
  return true;
}
function dadX1Step(dt) {
  const m = dad.m, W = dad.world, X = TUNE.dad.x1;
  if (!m || !W) return;
  dadMisTick(dt);
  const B = W.mother;
  B.position.set(B.userData.x, B.userData.y, B.userData.z);
  B.rotation.set(0, B.userData.heading, 0, "YXZ");
  for (const p of B.userData.props) p.rotation.z += 0.6;
  // the chambers' flames, the shock cone, the boom's ring of vapour
  const fl = W.body.userData.flames;
  for (let i = 0; i < 4; i++) { fl[i].visible = i < m.lit && !state.exploding; fl[i].scale.set(1, 0.8 + dadRand() * 0.4, 1); }
  const near = clamp(1 - Math.abs(m.mach - 1) / X.coneWindow, 0, 1);
  W.body.userData.cone.material.opacity = X.coneOpacity * near;
  if (m.lit > 0 && !state.exploding) { const f = dadFwd(dadTmpF); dadEmit(W.smoke, state.x - f.x * 7, state.y - f.y * 7, state.z - f.z * 7, 0, 0, 0, 1.6, 1.5, 7, 0.35, 0xf2f4f7, 0.2, 0); }
  const hi = state.y > X.floorSwitch;
  W.floor.position.set(state.x, 1, state.z); W.floor.visible = !hi && state.y > X.floorAbove;
  W.floorHi.position.set(state.x, X.floorHiY, state.z); W.floorHi.visible = hi; W.lakeHi.visible = hi;
  W.lake.visible = !hi;
  dadStepParticles(W.smoke, dt); dadStepParticles(W.fire, dt);
  if (typeof setTone === "function") {
    setTone("dadRocket", "sawtooth", 38 + m.lit * 6, m.lit && !m.over ? 0.012 + m.lit * 0.008 : 0);
    setTone("dadProp", "sawtooth", 70, m.phase === "hung" ? 0.02 : Math.max(0, 0.02 - (m.t - (m.dropT || 0)) * 0.004));
    setTone("dadWind", "sawtooth", 120 + state.speed * 0.4, m.phase === "free" && !m.lit && !m.over ? 0.008 : 0);
  }
  dadX1Hud();
}
// the sky, the fog and the far plane for this height (flight.js asks)
function dadX1Env() {
  const h = Math.max(0, state.y);
  return { space: 0, far: Math.max(6000, h * 4 + 6000), fogNear: 950 + h * 1.6, fogFar: 1560 + h * 3.2 };
}
function dadX1HudBuild() {
  const hud = dadEl("div", { id: "dadHud", class: "dadMisHud" });
  dad.dom.push(hud);
  const mk = (cls, parent, txt) => { const e = dadEl("div", { class: cls }, parent || hud); if (txt) e.textContent = txt; return e; };
  const h = dad.hud = { msg: mk("dadMsg"), warn: mk("dadWarn") };
  const panel = mk("dadDamPanel");
  h.cells = {};
  for (const [k, lab] of [["mach", "MACH"], ["ft", "ALTITUDE"], ["mph", "SPEED"], ["ch", "CHAMBERS"]]) { const c = mk("dadDamCell", panel); mk("dadDamLab", c, lab); h.cells[k] = { c, v: mk("dadDamVal", c), w: mk("dadDamWin", c) }; }
  h.lamps = mk("dadDamLamps");
  h.mark = dadMarkMake(hud);
}
function dadX1Hud() {
  const h = dad.hud, m = dad.m, X = TUNE.dad.x1;
  if (!h) return;
  const ft = state.y * 3.281, agl = (state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel)) * 3.281;
  const put = (k, v, w, ok, bad) => { const c = h.cells[k]; c.v.textContent = v; c.w.textContent = w; c.c.classList.toggle("ok", !!ok); c.c.classList.toggle("bad", !!bad); };
  // the real machmeter went off the scale past 1: so does this one, for a moment
  const mTxt = m.boom && m.t - m.boomT < 1.5 ? "OFF SCALE" : m.mach.toFixed(2);
  put("mach", mTxt, m.maxMach >= 1 ? "PASSED 1.0" : "BEST " + m.maxMach.toFixed(2), m.maxMach >= 1);
  put("ft", Math.round(ft).toLocaleString("en-US") + " FT", m.phase === "free" && m.lit ? (m.boom ? "HOLD IT HIGH" : "CLIMB TO ~42,000") : (m.maxMach >= 1 ? "TO THE LAKE" : ""), ft > 40000 && m.lit > 0);
  put("mph", Math.round(state.speed * 2.237) + " MPH", "", false);
  put("ch", "●".repeat(m.lit) + "○".repeat(4 - m.lit), "FUEL " + Math.ceil(m.fuel / X.fuel * 100) + "%", m.lit > 0, m.fuel <= 0 && m.phase === "free");
  let lamp = "";
  if (m.phase === "hung") lamp = "IN THE MOTHERSHIP'S BAY, 20,000 FT, 250 MPH -- DROP WHEN READY";
  else if (!m.lit && m.fuel > 0 && !m.boom) lamp = "LIGHT THE CHAMBERS -- ONE PRESS EACH";
  else if (!m.boom) lamp = "CLIMB, THEN LEVEL HIGH UP AND LET IT RUN";
  else if (m.lit > 0 && m.fuel > 0) lamp = "PAST MACH 1 -- LET IT BURN OUT, THEN HOME TO THE LAKE";
  else if (!m.over) lamp = agl < 2000 ? "GEAR DOWN -- FLARE ON TO THE LAKE BED" : "GLIDE DOWN TO THE DRY LAKE";
  h.lamps.textContent = lamp;
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  const warns = []; if (m.phase === "free" && !m.over && state.speed < TUNE.dad.air.x1.vStall * 1.1) warns.push("STALL");
  h.warn.textContent = warns.join("   "); h.warn.classList.toggle("on", warns.length > 0);
  const L = X.lake;
  h.mark.update(m.phase === "free" && !m.over && (m.boom || m.fuel <= 0) ? { x: L.x, y: terrainEff(L.x, L.z) + 5, z: L.z } : null, Math.hypot(L.x - state.x, L.z - state.z), "LAKE " + (Math.hypot(L.x - state.x, L.z - state.z) / 1609).toFixed(1) + " MI");
}
dadMissionDef({
  id: "x1", title: "Breaking the Sound Barrier", kicker: "14 OCTOBER 1947  ·  ROCKET RESEARCH PLANE",
  history: "Captain Charles \"Chuck\" Yeager flew the Bell X-1 Glamorous Glennis, a rocket plane in international orange shaped like a " +
    ".50-calibre bullet, 9.4 m long with 8.5 m of straight wing, dropped from the bomb bay of a B-29 over the Mojave. Two nights before he had " +
    "broken two ribs falling from a horse. Its four rocket chambers could be lit one at a time. He climbed and passed the speed of sound -- Mach " +
    "1.06, about 700 mph, by one account; Mach 1.05 at 45,000 ft by another -- and with the engine burnt out glided down to land on the dry " +
    "lake bed, Rogers Dry Lake.",
  how: [
    "Hung in the mothership's bay at 20,000 ft and 250 mph (the game's numbers; the sources do not give the drop). DROP lets you go.",
    "The flame button lights one more of the four chambers each press. They burn until the fuel is gone (about two and a half minutes on all four).",
    "Climb to about 42,000 ft, level off, and let it run past Mach 1: the boom, and the needle off the scale.",
    "Then glide down to the dry lake (the diamond) and land on it: gear comes down low; under 10 ft/s, wings level.",
  ],
  buttons: { bomb: true, chamber: true },
  noSpeedLines: true,   // the game's streaks are scaled to the dad jet's cruise: at Mach 1 they filled the screen
  env: dadX1Env,
  build: dadX1Build, start: dadX1Start, fly: dadX1Fly, step: dadX1Step,
  camera: dt => dadAirCamera(dt, { back: 26, up: 6, look: 60, eye: [0, 0.6, -2.2] }),
  pose: () => { if (dad.m && dad.m.phase === "hung") { dad.world.body.visible = true; dad.world.body.position.set(state.x, state.y, state.z); dad.world.body.rotation.set(0, state.heading, 0, "YXZ"); if (vehicleModel) vehicleModel.visible = false; } else dadAirPose(dad.world.body); },
  hud: dadX1HudBuild,
  bombCan: () => dadFlying() && dad.m.phase === "hung", drop: dadX1Drop,
  cardRows: () => {
    const m = dad.m, b = m.boomAt, l = m.land;
    const rows = [["Time", dadFmtClock(m.endT || m.t)], ["Top Mach", m.maxMach.toFixed(2)], ["Highest", Math.round(m.maxFt).toLocaleString("en-US") + " ft"]];
    if (b) rows.push(["Mach 1 at", b.ft.toLocaleString("en-US") + " ft, " + b.mph + " mph"]);
    if (l) rows.push(["Landing", (l.onLake ? "on the lake, " : "off the lake, ") + l.vs + " ft/s, " + l.mph + " mph"]);
    rows.push(["The real one", "Mach 1.05-1.06, about 700 mph, at about 45,000 ft"]);
    return rows;
  },
});
