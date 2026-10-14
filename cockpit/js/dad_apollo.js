"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE, MISSION 4: APOLLO 11 (v156). The landing, 20 July 1969.
//
// Dad mode only: built on entry, gone on exit, nothing saved, no Math.random.
//
// THE MOON is dad mode's own: a grey cratered plain laid out `TUNE.dad.apollo.y` metres up,
// so far over his world that the whole of it is past the far plane (the space blend, which
// the height turns on, gives the black sky and the stars). The game's own Moon, the
// rocket's, is not touched. Gravity there is 1.62 m/s^2.
//
// THE DESCENT, compressed: it starts at high gate, about 7,500 ft (the braking burn before
// it is skipped, and the briefing says so). The computer flies it toward the planned spot --
// which is in a boulder field by a crater, as Eagle's was by West crater. The 1202 and 1201
// alarms come and go from about 6,000 ft (Houston: GO). Under `takeover` feet the computer
// says so and he flies it: the drag TILTS the lander (release: upright), the thrust follows
// the rate of descent he asks for with UP and DOWN (a foot a second a press, the real P66
// switch). Fuel is SECONDS of hover, counted down; at 60 and 30 the calls come; at none the
// engine stops. Down gently -- under 3 ft/s, sideways under 4, upright, not on a rock, not on
// a crater's wall -- is "The Eagle has landed".
// ---------------------------------------------------------------------------
function dadApMoonH(x, z) {
  // the plain, gently rolling, with craters: a rim and a bowl each
  const A = TUNE.dad.apollo;
  let h = 6 * Math.sin(x * 0.0021 + 1.3) * Math.cos(z * 0.0017) + 3 * Math.sin(x * 0.007 + z * 0.005);
  for (const c of dadAp.craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= c.depth * (1 - d * d);
    else if (d < 1.6) h += c.rim * Math.pow(1 - (d - 1) / 0.6, 2);
  }
  return A.y + h;
}
const dadAp = { craters: [], rocks: [] };
// how a point is shaded: -1 the floor of a crater (dark), +1 its rim (light), 0 the plain
function dadApShade(x, z) {
  let s = 0;
  for (const c of dadAp.craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) s = Math.min(s, -0.55 * (1 - d * d));
    else if (d < 1.4) s = Math.max(s, 0.5 * (1 - (d - 1) / 0.4));
  }
  return s;
}
function dadApBuild(W) {
  const A = TUNE.dad.apollo;
  dadAp.craters.length = 0; dadAp.rocks.length = 0;
  // the craters: West crater by the planned spot, and a scatter over the plain
  dadAp.craters.push({ x: A.site.x + A.west.dx, z: A.site.z + A.west.dz, r: A.west.r, depth: A.west.depth, rim: A.west.rim });
  for (let i = 0; i < A.craters; i++) {
    const r = dadRand() < 0.15 ? dadR(120, 280) : dadR(15, 120);
    const x = A.site.x + dadR(-9000, 9000), z = A.site.z + dadR(-9000, 9000);
    if (Math.hypot(x - A.clear.x, z - A.clear.z) < A.clear.r + r * 1.6) continue;    // the clear ground he can land on stays clear
    dadAp.craters.push({ x, z, r, depth: r * 0.22, rim: r * 0.06 });
  }
  // the surface: a coarse plain far out and a fine patch round the site
  // grey from the palette, shaded per vertex: a crater's floor toward slate, its rim toward steel, so
  // they read from high gate
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
  W.mats.moon = mat;
  const cG = new THREE.Color(TUNE.palette.grey), cD = new THREE.Color(TUNE.palette.slate), cL = new THREE.Color(TUNE.palette.steel), cT = new THREE.Color();
  const plain = (size, n, cx, cz, yOff) => {
    const geo = new THREE.PlaneGeometry(size, size, n, n).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz; p.setY(i, dadApMoonH(x, z) - A.y + yOff);
      const sh = dadApShade(x, z);
      cT.copy(cG).lerp(sh < 0 ? cD : cL, Math.abs(sh));
      col[i * 3] = cT.r; col[i * 3 + 1] = cT.g; col[i * 3 + 2] = cT.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, A.y, cz);
    dadAdd(mesh); return mesh;
  };
  plain(40000, 160, A.site.x, A.site.z, -3);
  plain(3200, 200, A.site.x, A.site.z, 0);
  // the boulders: thick round the planned spot and West crater's rim, none on the clear ground
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: TUNE.palette.slate, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, A.rocks);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < A.rocks && tries < A.rocks * 8; tries++) {
    const a = dadR(0, 6.283), rr = Math.sqrt(dadRand()) * A.field.r;
    const x = A.site.x + A.field.dx + Math.cos(a) * rr, z = A.site.z + A.field.dz + Math.sin(a) * rr;
    if (Math.hypot(x - A.clear.x, z - A.clear.z) < A.clear.r) continue;
    const r = dadR(0.6, 2.2) * (dadRand() < 0.15 ? 1.6 : 1);
    const y = dadApMoonH(x, z);
    e.set(dadR(0, 3), dadR(0, 3), dadR(0, 3)); q.setFromEuler(e);
    m4.compose(v.set(x, y + r * 0.4, z), q, s.set(r, r * 0.8, r * 1.1));
    rocks.setMatrixAt(n++, m4);
    dadAp.rocks.push({ x, z, r });
  }
  rocks.count = n; rocks.instanceMatrix.needsUpdate = true;
  dadAdd(rocks);
  // the lander
  const body = dadBuildLM(); dadAdd(body); W.body = body;
}
// the lunar module: the gold descent stage (an octagon with four legs and pads), the grey
// faceted ascent stage, the engine bell and its flame
function dadBuildLM() {
  const M = dadMatsFor({ gold: TUNE.palette.gold, grey: TUNE.palette.steel, dark: TUNE.palette.slate, ink: TUNE.palette.ink, glass: TUNE.palette.night });
  const g = new THREE.Group();
  const ds = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.7, 8), M.gold); ds.position.y = 1.85; ds.rotation.y = Math.PI / 8; g.add(ds);
  const as = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 0), M.grey); as.scale.set(1.15, 0.9, 1.0); as.position.y = 3.9; g.add(as);
  dadBox(g, 1.0, 0.9, 0.2, M.glass, -0.6, 4.1, -1.62);
  dadBox(g, 1.0, 0.9, 0.2, M.glass, 0.6, 4.1, -1.62);
  dadBox(g, 0.12, 1.6, 0.12, M.dark, 0.9, 5.4, 0.4);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 1.0, 12, 1, true), M.dark); bell.position.y = 0.6; g.add(bell);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6), M.grey);
    leg.position.set(cx * 2.9, 1.0, cz * 2.9); leg.rotation.set(cz * 0.55, 0, -cx * 0.55); g.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10), M.grey); pad.position.set(cx * 3.9, 0.06, cz * 3.9); g.add(pad);
    if (k < 3) { const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 4), M.ink); probe.position.set(cx * 3.9, -0.8, cz * 3.9); g.add(probe); }
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe7b0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI; flame.position.y = -1.4; g.add(flame);
  g.userData.flame = flame;
  return g;
}

function dadApStart() {
  const A = TUNE.dad.apollo, W = dad.world;
  dadSeedNow = dad.seed + 4;
  dad.m = { t: 0, over: false, result: null, why: "", overT: 0, card: false, shake: 0, msg: "", msgT: 0,
    fuel: A.fuel, thr: 0, mode: "P64", rod: -1, tiltX: 0, tiltZ: 0, vx: A.start.vx, vy: A.start.vy, vz: A.start.vz,
    alarms: A.alarms.map(a => ({ ft: a.ft, code: a.code, done: false })), alarm: null, alarmT: 0, calls: { 60: false, 30: false },
    touch: null, contact: false, maxThr: 0, minFuel: A.fuel, auto: true };
  for (const P of [W.smoke, W.fire, W.tracer]) P.life.fill(0);
  state.x = A.site.x + A.start.dx; state.z = A.site.z + A.start.dz;
  state.y = dadApMoonH(state.x, state.z) + A.start.agl;
  state.heading = Math.atan2(-(A.site.x - state.x), -(A.site.z - state.z));   // facing down the track
  state.pitch = 0; state.bank = 0; state.speed = 0;
  state.phase = "AIRBORNE"; state.airVy = null; state.exploding = false; state.explodeTimer = 0;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.cam = null;
  const card = document.getElementById("dadCard"); if (card) card.remove();
}
function dadApAgl() { return state.y - dadApMoonH(state.x, state.z); }
// The lander: thrust along its own up, tilted by the stick (or the computer); the throttle
// holds the descent rate asked for. Horizontal motion is what the tilt gives against gravity.
function dadApFly(dt) {
  const m = dad.m, A = TUNE.dad.apollo, g = A.g;
  if (!m) return;
  state.phase = "AIRBORNE"; state.airVy = null; rumble = 0;
  if (typeof setEngine === "function") setEngine(0);
  if (state.exploding || m.landed) return;
  const agl = dadApAgl(), ft = agl * 3.281;
  // the computer hands over under `takeover`, or the moment he touches the stick
  if (m.mode === "P64" && !m.over && (ft < A.takeoverFt || (state.touching && !menuOpen())))
    dadApTakeover(ft < A.takeoverFt ? "P66 -- IT'S TAKING YOU INTO THE BOULDERS: FLY IT" : "P66 -- YOU HAVE IT");
  // the tilt it wants: the computer's, toward the planned spot; or his
  let wantX, wantZ, wantVy;
  if (m.mode === "P64") {
    const dx = A.site.x - state.x, dz = A.site.z - state.z, dh = Math.hypot(dx, dz) || 1;
    // the speed that brakes to a stop over the site at `brake` m/s^2, pitched back as far as `tiltMax`
    const vWant = Math.min(A.p64.vMax, Math.sqrt(2 * A.p64.brake * dh));
    const ax = (dx / dh * vWant - m.vx) * A.p64.gain, az = (dz / dh * vWant - m.vz) * A.p64.gain;
    wantX = clamp(Math.atan2(ax, g) / DEG, -A.p64.tiltMax, A.p64.tiltMax); wantZ = clamp(Math.atan2(az, g) / DEG, -A.p64.tiltMax, A.p64.tiltMax);
    wantVy = -clamp(agl * A.p64.descentK, A.p64.vyMin, A.p64.vyMax);
  } else {
    // his drag in the frame he is facing: up/forward tilts toward his nose, sideways to the side
    const touching = !m.over && state.touching && !menuOpen();
    const cb = touching ? state.ctrlBank : 0, cp = touching ? state.ctrlPitch : 0;
    const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading), rx = Math.cos(state.heading), rz = -Math.sin(state.heading);
    const fwd = cp * A.tiltMax, side = cb * A.tiltMax;
    wantX = fx * fwd + rx * side; wantZ = fz * fwd + rz * side;
    wantVy = m.rod / 3.281;
  }
  // the attitude follows at a rate
  const rate = (m.mode === "P64" ? A.p64.tiltRate : A.tiltRate) * dt;
  m.tiltX += clamp(wantX - m.tiltX, -rate, rate); m.tiltZ += clamp(wantZ - m.tiltZ, -rate, rate);
  // the throttle: hold the vertical rate, within the engine's range; no fuel, no engine
  const tx = Math.tan(m.tiltX * DEG), tz = Math.tan(m.tiltZ * DEG), up = 1 / Math.sqrt(1 + tx * tx + tz * tz);
  let accUp = (g + (wantVy - m.vy) * A.vGain) / up;
  accUp = clamp(accUp, A.accMin, A.accMax);
  if (m.fuel <= 0) accUp = 0;
  m.thr = accUp / A.accMax;
  m.maxThr = Math.max(m.maxThr, m.thr);
  m.fuel = Math.max(0, m.fuel - dt * accUp / g);   // seconds of hover: a second's hover burns one
  m.minFuel = m.fuel;
  // and the motion
  m.vx += accUp * up * tx * dt; m.vz += accUp * up * tz * dt;
  m.vy += (accUp * up - g) * dt;
  state.x += m.vx * dt; state.y += m.vy * dt; state.z += m.vz * dt;
  state.speed = Math.hypot(m.vx, m.vy, m.vz);
  // the lander's attitude for the camera and the model: pitch and bank from the tilt in his frame
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading), rx = Math.cos(state.heading), rz = -Math.sin(state.heading);
  state.pitch = -(m.tiltX * fx + m.tiltZ * fz);
  state.bank = (m.tiltX * rx + m.tiltZ * rz);
  if (m.over) return;
  // the probes under the pads touch first: CONTACT LIGHT, the engine off
  const ag = dadApAgl();
  if (!m.contact && ag < A.probe) { m.contact = true; dadSay("CONTACT LIGHT", 2); }
  if (ag <= 0) dadApTouch();
}
function dadApTouch() {
  const m = dad.m, A = TUNE.dad.apollo;
  const vDown = -m.vy * 3.281, vSide = Math.hypot(m.vx, m.vz) * 3.281, tilt = Math.hypot(m.tiltX, m.tiltZ);
  // the ground's own slope under him, and the rocks within his legs' reach
  const e = A.slopeSpan, sl = Math.atan(Math.hypot(dadApMoonH(state.x + e, state.z) - dadApMoonH(state.x - e, state.z), dadApMoonH(state.x, state.z + e) - dadApMoonH(state.x, state.z - e)) / (2 * e)) / DEG;
  const rock = dadAp.rocks.find(r => Math.hypot(r.x - state.x, r.z - state.z) < A.legR + r.r * 0.8);
  m.touch = { vDown: +vDown.toFixed(1), vSide: +vSide.toFixed(1), tilt: +tilt.toFixed(1), slope: +sl.toFixed(1), rock: !!rock, fuel: +m.fuel.toFixed(1),
              fromSite: Math.round(Math.hypot(state.x - A.site.x, state.z - A.site.z)) };
  state.y = dadApMoonH(state.x, state.z);
  m.vx = m.vy = m.vz = 0;
  const L = A.land;
  let why = null;
  if (vDown > L.crashFps) why = "came down too hard (" + vDown.toFixed(0) + " ft/s)";
  else if (rock) why = "landed on a boulder and tipped over";
  else if (sl > L.slopeMax) why = "landed on a crater's wall and tipped over";
  else if (vDown > L.vDownFps) why = "hard landing, " + vDown.toFixed(1) + " ft/s down";
  else if (vSide > L.vSideFps) why = "touched down sliding, " + vSide.toFixed(1) + " ft/s sideways";
  else if (tilt > L.tiltMax) why = "touched down tilted " + tilt.toFixed(0) + " degrees";
  if (!why) { m.landed = true; m.mode = "LANDED"; dadSay("THE EAGLE HAS LANDED", 5); dadEnd("success", "the Eagle has landed", false); }
  else if (/tipped|too hard/.test(why)) { dadBlast(state.x, state.y + 2, state.z, 1.4, false); dadEnd("fail", why, true); }
  else { m.landed = true; dadEnd("fail", why, false); }
}
function dadApStep(dt) {
  const m = dad.m, W = dad.world, A = TUNE.dad.apollo;
  if (!m || !W) return;
  dadMisTick(dt);
  const ft = dadApAgl() * 3.281;
  if (!m.over) {
    // the program alarms, at their heights; Houston's GO a moment later
    for (const a of m.alarms) if (!a.done && ft < a.ft) { a.done = true; m.alarm = a.code; m.alarmT = A.alarmFor; dadSay("PROGRAM ALARM " + a.code, 2.5); }
    if (m.alarmT > 0) { m.alarmT -= dt; if (m.alarmT <= A.alarmFor - A.goAfter && !m.alarmGo) { m.alarmGo = true; dadSay("HOUSTON: WE'RE GO ON THAT ALARM", 2.5); } if (m.alarmT <= 0) { m.alarm = null; m.alarmGo = false; } }
    for (const s of [60, 30]) if (!m.calls[s] && m.fuel <= s) { m.calls[s] = true; dadSay(s + " SECONDS", 2.5); }
    if (m.fuel <= 0 && !m.outSaid) { m.outSaid = true; dadSay("OUT OF FUEL", 3); }
  }
  // the dust the engine blows off the ground under him, low down
  const agl = dadApAgl();
  if (!m.landed && !state.exploding && agl < A.dustAgl && m.thr > 0.05) {
    const k = 1 - agl / A.dustAgl;
    // no air: it flies out flat and fast in sheets and drops, it never hangs in a cloud
    for (let i = 0; i < A.dust.n * k; i++) {
      const a = dadR(0, 6.283), sp = dadR(A.dust.v[0], A.dust.v[1]) * k;
      dadEmit(W.smoke, state.x + Math.cos(a) * 3, dadApMoonH(state.x, state.z) + 0.3, state.z + Math.sin(a) * 3, Math.cos(a) * sp, dadR(0, 0.6), Math.sin(a) * sp, dadR(0.5, 0.9), 1.2, 3.5, 0.45 * k, 0x9a9ea6, 0, -1.6);
    }
  }
  dadStepParticles(W.smoke, dt); dadStepParticles(W.fire, dt);
  if (typeof setTone === "function") {
    setTone("dadRocket", "sawtooth", 40 + m.thr * 30, !m.over && m.fuel > 0 ? 0.01 + m.thr * 0.02 : 0);
    setTone("dadAlarm", "square", Math.floor(m.t * 4) % 2 ? 1500 : 1200, m.alarmT > A.alarmFor - 1.5 ? 0.03 : 0);
  }
  dadApHud();
}
function dadApHudBuild() {
  const hud = dadEl("div", { id: "dadHud", class: "dadMisHud" });
  dad.dom.push(hud);
  const mk = (cls, parent, txt) => { const e = dadEl("div", { class: cls }, parent || hud); if (txt) e.textContent = txt; return e; };
  const h = dad.hud = { msg: mk("dadMsg"), warn: mk("dadWarn") };
  const panel = mk("dadDamPanel");
  h.cells = {};
  for (const [k, lab] of [["alt", "ALTITUDE"], ["vs", "DESCENT"], ["h", "SIDEWAYS"], ["fuel", "FUEL"]]) { const c = mk("dadDamCell", panel); mk("dadDamLab", c, lab); h.cells[k] = { c, v: mk("dadDamVal", c), w: mk("dadDamWin", c) }; }
  h.lamps = mk("dadDamLamps");
  h.prog = mk("dadProg");
  h.mark = dadMarkMake(hud);
}
function dadApHud() {
  const h = dad.hud, m = dad.m, A = TUNE.dad.apollo, L = A.land;
  if (!h) return;
  const ft = Math.max(0, dadApAgl() * 3.281), vs = -m.vy * 3.281, side = Math.hypot(m.vx, m.vz) * 3.281;
  const put = (k, v, w, ok, bad) => { const c = h.cells[k]; c.v.textContent = v; c.w.textContent = w; c.c.classList.toggle("ok", !!ok); c.c.classList.toggle("bad", !!bad); };
  put("alt", Math.round(ft) + " FT", m.mode, (ft < 100 && !m.over) || m.result === "success");
  put("vs", (vs >= 0 ? "" : "UP ") + Math.abs(vs).toFixed(1) + " FT/S", m.mode === "P66" ? (m.rod <= 0 ? "SET " + Math.abs(m.rod).toFixed(0) + " DOWN" : "SET " + m.rod.toFixed(0) + " UP") : m.mode === "P64" ? "COMPUTER" : "",
    vs < L.vDownFps && vs > -1, m.mode === "P66" && ft < 200 && vs > L.crashFps);   // a warning only once it is his, low
  put("h", side.toFixed(1) + " FT/S", m.mode === "P66" ? "UNDER " + L.vSideFps : "", m.mode !== "P66" || side < L.vSideFps);
  put("fuel", Math.ceil(m.fuel) + " S", "SECONDS LEFT", m.fuel > 30, m.fuel < 15);
  h.prog.textContent = m.alarm ? "PROG  " + m.alarm + (m.alarmGo ? "  GO" : "") : "";
  h.prog.style.display = m.alarm ? "block" : "none";
  // the rocks: say when they are under him
  const below = dadAp.rocks.some(r => Math.hypot(r.x - state.x, r.z - state.z) < A.belowR);
  let lamp = "";
  if (m.mode === "P64") lamp = "THE COMPUTER IS FLYING IT -- TOUCH TO TAKE OVER";
  else if (m.mode === "P66" && !m.over) lamp = below ? "BOULDERS UNDER YOU -- TILT TO FLY ON" : "CLEAR GROUND -- SET HER DOWN GENTLY";
  h.lamps.textContent = lamp; h.lamps.className = "dadDamLamps" + (m.mode === "P66" && !below ? " ok" : "");
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  const warns = []; if (!m.over && m.fuel < 30) warns.push("FUEL"); if (!m.over && vs > L.crashFps && ft < 200) warns.push("SINK RATE");
  h.warn.textContent = warns.join("   "); h.warn.classList.toggle("on", warns.length > 0);
  // the clear ground beyond the boulders, marked once he is flying it
  h.mark.update(m.mode === "P66" && !m.over ? { x: A.clear.x, y: dadApMoonH(A.clear.x, A.clear.z) + 2, z: A.clear.z } : null, Math.hypot(A.clear.x - state.x, A.clear.z - state.z), Math.round(Math.hypot(A.clear.x - state.x, A.clear.z - state.z) * 3.281) + " FT");
}
// UP and DOWN: the rate-of-descent switch, a foot a second a press. In P64 a press is a takeover.
function dadApRod(d) {
  const m = dad.m;
  if (!dadFlying() || m.landed) return false;
  if (m.mode === "P64") dadApTakeover("P66 -- YOU HAVE IT");
  m.rod = clamp(m.rod + d, -TUNE.dad.apollo.rodMax, TUNE.dad.apollo.rodMax);
  return true;
}
function dadApTakeover(say) { const m = dad.m, A = TUNE.dad.apollo; m.mode = "P66"; m.auto = false; m.rod = Math.round(clamp(m.vy * 3.281, -A.rodMax, 0)); dadSay(say, 3.5); }
dadMissionDef({
  id: "apollo", title: "Apollo 11", kicker: "20 JULY 1969  ·  LUNAR MODULE",
  history: "Neil Armstrong and Buzz Aldrin flew the lunar module Eagle down to the Sea of Tranquility. About five minutes into the descent burn, " +
    "at around 6,000 ft, the guidance computer threw the first of several 1202 and 1201 program alarms; Mission Control judged it safe to go on. " +
    "The computer was taking them into a boulder field beside a crater about 300 ft across (later named West crater), so Armstrong took " +
    "semi-automatic control and flew on past it, landing long, west of the target. Aldrin called \"contact light\" when a probe under a footpad " +
    "touched. They landed at 20:17:40 UTC with fuel then thought to be about 25 seconds short of an unsafe abort (later analysis put it nearer 50). " +
    "\"Houston, Tranquility Base here. The Eagle has landed.\"",
  how: [
    "It starts at high gate, about 7,500 ft (the burn before it is skipped). The computer flies it down.",
    "1202 and 1201 program alarms from about 6,000 ft: Houston says GO. Fly on.",
    "Under 500 ft (or when you touch the stick or a button) it is yours: drag tilts the lander and it flies the way it leans. Let go and it stands up.",
    "UP and DOWN set the descent rate, a foot a second a press, as the real switch did. Fuel is seconds of hover; the calls come at 60 and 30.",
    "Fly past the boulders to the clear ground (the diamond). Down under 3 ft/s, sideways under 4, upright, not on a rock or a crater's wall.",
  ],
  buttons: { rod: true },
  build: dadApBuild, start: dadApStart, fly: dadApFly, step: dadApStep,
  camera: dt => dadAirCamera(dt, { back: 24, up: 10, look: 30, lookUp: -6, eye: [-0.6, 4.1, -1.9], stiff: 6 }),
  pose: () => { const b = dad.world.body; dadAirPose(b); if (b) { b.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ"); const f = b.userData.flame; f.visible = dad.m && dad.m.thr > 0.02 && dad.m.fuel > 0 && !dad.m.landed; f.scale.set(1, 0.4 + dad.m.thr, 1); } },
  hud: dadApHudBuild,
  exit: () => { dadAp.craters.length = 0; dadAp.rocks.length = 0; },   // its data goes with it
  winTitle: "The Eagle has landed",
  cardRows: () => {
    const m = dad.m, t = m.touch;
    const rows = [["Time", dadFmtClock(m.endT || m.t)], ["Fuel left", Math.max(0, Math.ceil(m.fuel)) + " s"]];
    if (t) rows.push(["Touchdown", t.vDown + " ft/s down, " + t.vSide + " ft/s sideways, tilt " + t.tilt + "°"], ["From the computer's target", Math.round(t.fromSite * 3.281) + " ft"]);
    return rows;
  },
});
