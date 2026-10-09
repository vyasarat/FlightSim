"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE (v147). "Canyon Strike."
//
// THE PARENT'S, BEHIND A CODE. A dim icon in a corner of the vehicle picker opens
// a number pad (digits and icons only); TUNE.dad.code lets him in, three wrong
// tries lock it for TUNE.dad.lockout seconds, and a wrong one just closes it.
// Inside, the kid rules do NOT apply, by the parent's decision: there is text, a
// clock, damage, a way to fail, and things that shoot at you. OUTSIDE it, his game
// does not change by one thing:
//
//   - NOTHING OF IT EXISTS UNTIL IT IS ENTERED. Every scene object, DOM node, sound
//     and solid it makes is made on entry and listed in `dad.objs` / `dad.dom`, and
//     dadExit() takes every one of them away. The only things in his game are the
//     dim icon and four buttons whose `when()` is false outside dad mode (buttons.js).
//   - NOTHING IS SAVED. No localStorage, ever: a reload or a relaunch opens his game.
//   - HIS FIGHTER IS UNTOUCHED. The jet flies on its own profile (`dad.vp`, built
//     fresh from TUNE.dad.jet) through its own contract row ("dad", vehicles.js) and
//     its own flight model below; TUNE.vehicles.fighter is never written. Exit puts
//     back the vehicle he had, at the airport he had, on the picker.
//   - ITS OWN RANDOMNESS. Runtime draws come from dadRand, seeded per sortie, never
//     rnd() or Math.random; everything built on entry or mid-sortie draws its three.js
//     uuids from dad mode's own stream (dadQuiet), so the one his checks are seeded on never moves.
//   - HIS ALARM IS MUTED here (flight.js asks dadAlarmMuted); the mission has its own
//     warnings: RADAR LOCK, MISSILE, PULL UP, and the G meter's grey-out.
//
// THE MISSION, from the film's last act: start low at the valley's mouth, cruise
// missiles streaking overhead to a radar on the ridge; two and a half minutes to
// the target; stay under 100 ft or the radar locks and a missile comes; guns on
// the ridges; dive on the bunker and put a laser-guided bomb through a vent three
// metres wide -- the first blows the hatch, the second the plant; then a hard pull
// out of the bowl with missiles chasing and flares to decoy them. A results card,
// RETRY and EXIT.
//
// The pitch is RATE, not attitude: release holds the nose, which is what lets the
// laser stay on a three-metre vent from a kilometre out (expo puts the fine aim in
// the middle of the drag). The roll is attitude, like his: release levels the wings.
// The laser spot follows the nose while the nose is steady, and HOLDS where it was
// when he pulls hard -- so a bomb in the air goes where he was pointing when he left.
// ---------------------------------------------------------------------------
const dad = {
  on: false,
  pad: { open: false, entry: "", wrong: 0, lockT: 0 },
  menu: false,
  prev: null,            // what he was in when the parent went in: put back on exit
  vp: null,              // the jet's own profile (never TUNE.vehicles.fighter)
  m: null,               // the sortie
  objs: [],              // every scene object dad mode added
  dom: [],               // every element dad mode added
  world: null,           // guns, sites, the radar, the hatch, the particles
  seed: 1986,
  enters: 0, exits: 0,
};
let dadSeedNow = 1;
function dadRand() {
  dadSeedNow = (dadSeedNow + 0x6D2B79F5) >>> 0;
  let t = dadSeedNow;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const dadR = (a, b) => a + (b - a) * dadRand();

function dadActive() { return dad.on; }
function dadAlarmMuted() { return dad.on; }
function dadFlying() { return dad.on && !!dad.m && !dad.m.over; }

// ---------------------------------------------------------------------------
// GETTING IN
// ---------------------------------------------------------------------------
function dadEl(tag, attrs, parent) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    if (k === "text") e.textContent = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  (parent || document.body).appendChild(e);
  return e;
}
function dadTap(e, fn) {
  e.addEventListener("pointerdown", ev => { ev.preventDefault(); ev.stopPropagation(); if (typeof unlockAudio === "function") unlockAudio(); });
  e.addEventListener("pointerup", ev => { ev.preventDefault(); ev.stopPropagation(); fn(); });
}
const DAD_ICON = {
  back: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7H28V25H12L4 16Z"/><path d="M15 12l8 8M23 12l-8 8"/></svg>',
  close: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M8 8l16 16M24 8L8 24"/></svg>',
};

function dadKeyTap() {
  if (dad.pad.lockT > 0 || dad.pad.open || dad.menu || dad.on) { dadKeyShake(); return; }
  dadPadOpen();
}
function dadKeyShake() {
  const k = document.getElementById("dadKey");
  if (!k) return;
  k.classList.remove("shake"); void k.offsetWidth; k.classList.add("shake");
}

function dadPadOpen() {
  dad.pad.open = true;
  dad.pad.entry = "";
  const ov = dadEl("div", { id: "dadPad", class: "dadOverlay" });
  // a tap anywhere off the pad closes it: a boy who finds the star is never stuck behind it
  ov.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); });
  ov.addEventListener("pointerup", e => { if (e.target === ov) { e.preventDefault(); e.stopPropagation(); dadPadClose(); } });
  const box = dadEl("div", { class: "dadPadBox" }, ov);
  const dots = dadEl("div", { class: "dadDots" }, box);
  for (let i = 0; i < TUNE.dad.code.length; i++) dadEl("span", {}, dots);
  const grid = dadEl("div", { class: "dadGrid" }, box);
  for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "x", "0", "<"]) {
    const b = dadEl("button", { class: "dadPadKey", "data-k": d }, grid);
    if (d === "x") b.innerHTML = DAD_ICON.close;
    else if (d === "<") b.innerHTML = DAD_ICON.back;
    else b.textContent = d;
    dadTap(b, () => dadPadPress(d));
  }
  dadPadDraw();
}
function dadPadDraw() {
  const p = document.getElementById("dadPad");
  if (!p) return;
  p.querySelectorAll(".dadDots span").forEach((s, i) => s.classList.toggle("on", i < dad.pad.entry.length));
}
function dadPadClose() {
  dad.pad.open = false;
  dad.pad.entry = "";
  const p = document.getElementById("dadPad");
  if (p) p.remove();
}
// One digit, or the close / back icons. A full-length entry is judged at once:
// right opens the menu, wrong closes the pad, and the third wrong locks it.
function dadPadPress(k) {
  if (!dad.pad.open) return;
  if (k === "x") { dadPadClose(); return; }
  if (k === "<") { dad.pad.entry = dad.pad.entry.slice(0, -1); dadPadDraw(); return; }
  dad.pad.entry += k;
  dadPadDraw();
  if (dad.pad.entry.length < TUNE.dad.code.length) return;
  const ok = dad.pad.entry === String(TUNE.dad.code);
  dadPadClose();
  if (ok) { dad.pad.wrong = 0; dadMenuOpen(); return; }
  dad.pad.wrong++;
  if (dad.pad.wrong >= TUNE.dad.wrongMax) { dad.pad.wrong = 0; dad.pad.lockT = TUNE.dad.lockout; }
  dadKeyDraw();
}
function dadKeyDraw() {
  const k = document.getElementById("dadKey");
  if (k) k.classList.toggle("locked", dad.pad.lockT > 0);
}

function dadMenuOpen() {
  dad.menu = true;
  const ov = dadEl("div", { id: "dadMenu", class: "dadOverlay" });
  const card = dadEl("div", { class: "dadCard" }, ov);
  dadEl("div", { class: "dadKicker", text: "DAD MODE  ·  MISSION 1" }, card);
  dadEl("h1", { text: "Canyon Strike" }, card);
  dadEl("p", { text: "An enrichment plant is buried under a bowl of snow at the end of a mountain valley. " +
    "Fly the valley under 100 ft so the radar never sees you, put two laser-guided bombs through a vent three metres wide, " +
    "and get out over the peaks with missiles on your tail." }, card);
  const ul = dadEl("ul", {}, card);
  for (const t of [
    "2:30 to target. Above 100 ft for more than a moment: radar lock, then a launch.",
    "Guns on the ridges. Your missiles take them out.",
    "Dive on the vent, keep the nose on it, drop. First bomb opens the hatch, second kills the plant.",
    "Pull hard out of the bowl. Flares decoy the missiles.",
    "Drag to fly: up/down is pitch rate (the nose holds when you let go), left/right is bank.",
  ]) dadEl("li", { text: t }, ul);
  const row = dadEl("div", { class: "dadRow" }, card);
  const fly = dadEl("button", { class: "dadBtn go", text: "FLY" }, row);
  const ex = dadEl("button", { class: "dadBtn", text: "EXIT" }, row);
  dadTap(fly, () => { dadMenuClose(); dadEnter(); });
  dadTap(ex, () => dadMenuClose());
}
function dadMenuClose() {
  dad.menu = false;
  const m = document.getElementById("dadMenu");
  if (m) m.remove();
}

// Called once a frame from the top of update(), in and out of dad mode: the pad's
// lockout counts down on the game's own clock, never performance.now().
function dadTick(dt) {
  if (dad.pad.lockT > 0) { dad.pad.lockT = Math.max(0, dad.pad.lockT - dt); if (dad.pad.lockT === 0) dadKeyDraw(); }
  if (!dad.on) return;
  // anything that swapped the vehicle out from under dad mode ends it
  if (state.vp !== dad.vp) { dadTeardown(); return; }
  dadMission(dt);
}

// ---------------------------------------------------------------------------
// IN AND OUT
// ---------------------------------------------------------------------------
function dadMakeVp() {
  const J = TUNE.dad.jet;
  // his fighter's shape and model, the dad jet's own numbers -- a fresh object, so
  // nothing written here can reach TUNE.vehicles.fighter
  return Object.freeze({
    cruiseSpeed: J.cruise, turnRateDeg: 0, pitchLimitDeg: 89, bankLimitDeg: J.bankLimitDeg, accel: 0,
    capped: false, size: J.size, hasGear: false, dadJet: true,
  });
}

function dadEnter() {
  if (dad.on) return;
  dad.prev = { key: state.vehicleKey, origin: state.originIdx, dir: state.dirIdx, view: state.viewChase };
  dad.enters++;
  el.screenVehicle.classList.add("hiddenS");
  el.screenDir.classList.add("hiddenS");
  el.screenDest.classList.add("hiddenS");
  if (typeof restoreShattered === "function") restoreShattered();
  state.exploding = false; state.explodeTimer = 0;
  applyVehicle("fighter");        // his fighter's model and the clean-up of whatever he was in
  dad.vp = dadMakeVp();
  state.vp = dad.vp;              // ... flown on the dad jet's own profile
  dad.on = true;
  document.body.classList.add("dad");
  dadQuiet(() => dadBuildWorld());
  dadBuildHud();
  dadStart();
}

// Put back everything dad mode touched. `quiet`: the vehicle has already been
// changed under it, so do not change it again.
function dadTeardown() {
  for (const o of dad.objs) { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); }
  dad.objs.length = 0;
  for (const e of dad.dom) e.remove();
  dad.dom.length = 0;
  for (const id of ["dadPad", "dadMenu", "dadCard"]) { const e = document.getElementById(id); if (e) e.remove(); }
  dadSoundsOff();
  if (vl.bunker) vl.bunker.visible = true;
  if (vl.ventGroup) vl.ventGroup.visible = true;
  dad.world = null;
  dad.m = null;
  dad.on = false;
  dad.vp = null;
  dad.menu = false;
  document.body.classList.remove("dad");
  dad.exits++;
}
function dadExit() {
  if (!dad.on) return;
  const prev = dad.prev || { key: "prop", origin: 0, dir: 0, view: false };
  state.exploding = false; state.explodeTimer = 0;
  dadTeardown();
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  applyVehicle(TUNE.vehicles[prev.key] ? prev.key : "prop");
  state.viewChase = !!prev.view;
  el.hud.classList.toggle("chase", state.viewChase);
  if (vehicleModel) vehicleModel.visible = state.viewChase;
  spawnForTakeoff(prev.origin, prev.dir);
  // ALWAYS back on the vehicles, never anywhere else
  el.screenDir.classList.add("hiddenS");
  el.screenDest.classList.add("hiddenS");
  el.screenVehicle.classList.remove("hiddenS");
}

// ---------------------------------------------------------------------------
// THE WORLD: built on entry, gone on exit
// ---------------------------------------------------------------------------
function dadAdd(o) { scene.add(o); dad.objs.push(o); return o; }
function dadAt(o, x, y, z) { o.position.set(x, y, z); return o; }
// three.js draws Math.random for every object's uuid: anything dad mode makes is made
// with Math.random pointed at dad mode's OWN uuid stream for the length of the call, so
// his seeded stream never moves and no two dad objects share a uuid
let dadUuidSeed = 0x0dad1986;
function dadUuidRand() { dadUuidSeed = (dadUuidSeed * 1664525 + 1013904223) >>> 0; return dadUuidSeed / 4294967296; }
function dadQuiet(fn) { const R = Math.random; Math.random = dadUuidRand; try { return fn(); } finally { Math.random = R; } }
function dadMesh(geo, mat) { return dadAdd(dadQuiet(() => new THREE.Mesh(geo, mat))); }

// A crest near (x, z): the highest ground in a small search, for a gun or a site.
function dadCrest(x, z, r) {
  let best = { x, z, y: terrainEff(x, z) };
  for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
    const px = x + i * r / 3, pz = z + k * r / 3, y = terrainEff(px, pz);
    if (y > best.y) best = { x: px, z: pz, y };
  }
  return best;
}
// a point beside the valley at x, `side` +1 north (+z) / -1 south, `off` metres out
function dadBeside(x, side, off) {
  const s = vlCenterSlope(x), n = Math.sqrt(1 + s * s);
  return { x: x - side * off * s / n, z: vlCenterZ(x) + side * off / n };
}

function dadBuildWorld() {
  const V = TUNE.valley, D = TUNE.dad;
  dadSeedNow = dad.seed + 7;
  const W = dad.world = { guns: [], sites: [], cms: [], sams: [], flares: [], aims: [], bombs: [], tracers: [] };
  const dark = new THREE.MeshLambertMaterial({ color: TUNE.palette.slate, flatShading: true });
  const ink = new THREE.MeshLambertMaterial({ color: TUNE.palette.ink, flatShading: true });
  const steel = new THREE.MeshLambertMaterial({ color: TUNE.palette.grey, flatShading: true });
  const white = new THREE.MeshLambertMaterial({ color: TUNE.palette.white, flatShading: true });
  const wreck = new THREE.MeshLambertMaterial({ color: TUNE.palette.ink, flatShading: true });
  W.mats = { dark, ink, steel, white, wreck };
  const len = V.x0 - V.xb;
  // ---- the guns: twin-barrelled mounts on the rims, alternating sides
  for (let i = 0; i < D.guns.count; i++) {
    const x = V.x0 - len * (0.1 + 0.8 * i / (D.guns.count - 1));
    const p0 = dadBeside(x, i % 2 ? 1 : -1, V.floorHalf + V.wallRun + 30);
    const c = dadCrest(p0.x, p0.z, 60);
    const g = new THREE.Group();
    g.position.set(c.x, c.y - 0.5, c.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.6, 8), dark); base.position.y = 0.8; g.add(base);
    const turret = new THREE.Group(); turret.position.y = 2.2; g.add(turret);
    turret.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.8), dark));
    const tilt = new THREE.Group(); tilt.position.set(0, 0.4, -0.6); turret.add(tilt);
    for (const sx of [-0.55, 0.55]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 6), ink);
      b.rotation.x = Math.PI / 2; b.position.set(sx, 0, -2.4); tilt.add(b);
    }
    const ruin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 3.2), wreck); ruin.position.y = 1.4; ruin.rotation.set(0.3, 0.6, 0.2); ruin.visible = false; g.add(ruin);
    dadAdd(g);
    W.guns.push({ i, g, turret, tilt, ruin, x: c.x, y: c.y + 2.6, z: c.z, alive: true, fireT: 0, gapT: dadR(0, D.guns.gap), flakT: 0, shotT: 0 });
  }
  // ---- the SAM sites: a lattice frame on a peak with four missiles bristling up (t077)
  const sitesAt = [];
  for (let i = 0; i < 6; i++) sitesAt.push(dadBeside(V.x0 - len * (0.16 + i * 0.15), i % 2 ? -1 : 1, V.floorHalf + V.wallRun + 160));
  const bc = vlBowlCentre();
  for (const a of [0.55, 1.6, 2.6]) sitesAt.push({ x: bc.x - Math.cos(a + Math.PI * 0.5) * (V.bowlRim + 160), z: bc.z + Math.sin(a + Math.PI * 0.5) * (V.bowlRim + 160) });
  for (const p0 of sitesAt) {
    const c = dadCrest(p0.x, p0.z, 90);
    const g = new THREE.Group();
    g.position.set(c.x, c.y - 0.5, c.z);
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 9), dark), 0, 0.6, 0));
    const frame = new THREE.Group(); frame.position.y = 1.2; g.add(frame);
    for (const sx of [-3, 3]) for (const sz of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), ink); leg.position.set(sx, 2.1, sz); frame.add(leg);
    }
    frame.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 7.4), ink), 0, 4.3, 0));
    const rails = [];
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Group();
      m.position.set(-2.7 + k * 1.8, 4.6, 0);
      m.rotation.x = -0.5;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.2, 6), steel); body.position.y = 2.6; m.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 6), steel); nose.position.y = 5.7; m.add(nose);
      for (let f = 0; f < 4; f++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.7), ink); fin.position.y = 0.5; fin.rotation.y = f * Math.PI / 2; fin.position.x = Math.cos(f * Math.PI / 2) * 0.35; fin.position.z = Math.sin(f * Math.PI / 2) * 0.35; m.add(fin); }
      frame.add(m); rails.push(m);
    }
    const ruin = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 7), wreck); ruin.position.y = 1.5; ruin.rotation.set(0.2, 0.4, 0.15); ruin.visible = false; g.add(ruin);
    dadAdd(g);
    W.sites.push({ g, frame, rails, ruin, x: c.x, y: c.y + 6, z: c.z, alive: true, left: 4 });
  }
  // ---- the radar the cruise missiles hit: a dome and a dish on the north crest
  {
    const x = V.x0 - len * D.cruiseMissiles.at;
    const c = dadCrest(dadBeside(x, 1, V.floorHalf + V.wallRun + 200).x, dadBeside(x, 1, V.floorHalf + V.wallRun + 200).z, 120);
    const g = new THREE.Group();
    g.position.set(c.x, c.y - 0.5, c.z);
    g.add(dadAt(new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 6, 10), steel), 0, 3, 0));
    g.add(dadAt(new THREE.Mesh(new THREE.SphereGeometry(7.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), white), 0, 6, 0));
    g.add(dadAt(new THREE.Mesh(new THREE.BoxGeometry(1, 14, 1), ink), 12, 7, 0));
    const ruin = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 12), wreck); ruin.position.y = 1.5; ruin.visible = false; g.add(ruin);
    dadAdd(g);
    W.radar = { g, ruin, x: c.x, y: c.y + 6, z: c.z, alive: true };
  }
  // ---- the hatch that blows off the vent, and the hole under it (the vent's own
  // grille is valley.js's: hidden while the hatch is open, put back on exit)
  {
    const B = TUNE.valley.bunker;
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(B.ventW + 0.8, 0.5, B.ventL), dark);
    hatch.visible = false;
    dadAdd(hatch);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(B.ventW, 0.2, B.ventL * 0.9), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    hole.visible = false;
    vl.ventGroup.updateMatrixWorld(true);
    hole.position.set(0, B.ventH + 0.05, 0);
    vl.ventGroup.localToWorld(hole.position);
    hole.quaternion.copy(vl.ventGroup.getWorldQuaternion(new THREE.Quaternion()));
    dadAdd(hole);
    // the plant, after: a burnt crater of slabs where the bunker stood
    const rub = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(dadR(3, 7), dadR(1, 2.5), dadR(3, 6)), k % 3 ? wreck : dark);
      s.position.set(vl.vent.x + dadR(-11, 11), vl.base + dadR(0, 1.5), vl.vent.z + dadR(-9, 9));
      s.rotation.set(dadR(-0.5, 0.5), dadR(0, 3), dadR(-0.5, 0.5));
      rub.add(s);
    }
    rub.visible = false;
    dadAdd(rub);
    W.hatch = hatch; W.hole = hole; W.rubble = rub;
  }
  // ---- the laser spot (a small red ring on the ground) and the bombs' and missiles' bodies
  {
    const spot = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.6, 16), new THREE.MeshBasicMaterial({ color: 0xff3020, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.9, fog: false }));
    spot.rotation.x = -Math.PI / 2; spot.renderOrder = 10; spot.visible = false;
    dadAdd(spot);
    W.spot = spot;
  }
  W.bodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.2, 6).rotateX(Math.PI / 2);
  W.bombGeo = new THREE.CylinderGeometry(0.3, 0.3, 3.0, 8).rotateX(Math.PI / 2);
  W.flareMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false });
  // ---- the particles: one Points draw for the smoke, one for the fire
  W.smoke = dadParticles(4200, false);
  W.fire = dadParticles(1600, true);
  dadAdd(W.smoke.pts); dadAdd(W.fire.pts);
}

// ---------------------------------------------------------------------------
// PARTICLES. Two pools, each one THREE.Points with a little shader: soft round
// sprites, per-particle size, colour and alpha, fogged by hand. Smoke is normal
// blending (the film's charcoal columns and white trails); fire is additive.
// ---------------------------------------------------------------------------
let dadSmokeTex = null;
function dadSmokeTexture() {
  if (dadSmokeTex) return dadSmokeTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  // a puff: a few soft blobs, so a trail reads as billows and not as a row of dots
  for (let i = 0; i < 7; i++) {
    const r = 12 + dadRand() * 12, cx = 32 + (dadRand() - 0.5) * 22, cy = 32 + (dadRand() - 0.5) * 22;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(0.6, "rgba(255,255,255,0.3)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  dadSmokeTex = new THREE.CanvasTexture(c);
  return dadSmokeTex;
}
function dadParticles(n, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), col = new Float32Array(n * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: additive ? glowTex : dadSmokeTexture() }, uScale: { value: 400 },
                fogColor: { value: new THREE.Color() }, fogNear: { value: 1000 }, fogFar: { value: 2000 } },
    // the game draws with a logarithmic depth buffer: a shader of its own has to
    // write its depth the same way, or every point fails the depth test unseen
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize; attribute float aAlpha; attribute vec3 aCol;
      uniform float uScale; varying float vA; varying vec3 vC; varying float vD;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; vA = aAlpha; vC = aCol;
        gl_PointSize = aSize > 0.0 ? clamp(aSize * uScale / max(1.0, -mv.z), 1.0, 900.0) : 0.0; gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying float vA; varying vec3 vC; varying float vD;
      void main() {
        #include <logdepthbuf_fragment>
        // fogged far off, and faded out close up: smoke in his face must never white out the screen
        vec4 t = texture2D(map, gl_PointCoord); float f = smoothstep(fogNear, fogFar, vD);
        float a = t.a * vA * smoothstep(6.0, 45.0, vD);
        if (a < 0.004) discard;
        ${additive ? "gl_FragColor = vec4(vC * a * (1.0 - f), 1.0);" : "gl_FragColor = vec4(mix(vC, fogColor, f), a);"} }`,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = additive ? 3 : 2;
  const P = { n, pts, geo, mat, pos, size, alpha, col, next: 0,
    life: new Float32Array(n), max: new Float32Array(n), v: new Float32Array(n * 3),
    s0: new Float32Array(n), s1: new Float32Array(n), a0: new Float32Array(n), drag: new Float32Array(n), rise: new Float32Array(n) };
  return P;
}
// one particle: position, velocity, life, size from s0 to s1, alpha, colour, drag, buoyancy
function dadEmit(P, x, y, z, vx, vy, vz, life, s0, s1, a0, color, drag, rise) {
  if (!P) return;
  const i = P.next; P.next = (P.next + 1) % P.n;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
  P.life[i] = life; P.max[i] = life; P.s0[i] = s0; P.s1[i] = s1; P.a0[i] = a0;
  P.col[i * 3] = ((color >> 16) & 255) / 255; P.col[i * 3 + 1] = ((color >> 8) & 255) / 255; P.col[i * 3 + 2] = (color & 255) / 255;
  P.drag[i] = drag || 0; P.rise[i] = rise || 0;
}
function dadStepParticles(P, dt) {
  let live = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) { if (P.alpha[i] !== 0) { P.alpha[i] = 0; P.size[i] = 0; } continue; }
    live++;
    P.life[i] -= dt;
    const t = 1 - Math.max(0, P.life[i]) / P.max[i];
    const k = Math.exp(-P.drag[i] * dt);
    P.v[i * 3] *= k; P.v[i * 3 + 1] = P.v[i * 3 + 1] * k + P.rise[i] * dt; P.v[i * 3 + 2] *= k;
    P.pos[i * 3] += P.v[i * 3] * dt; P.pos[i * 3 + 1] += P.v[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.v[i * 3 + 2] * dt;
    P.size[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * Math.sqrt(t);
    P.alpha[i] = P.a0[i] * (t < 0.08 ? t / 0.08 : 1) * (1 - t) * (1 - t * 0.3);
  }
  P.geo.attributes.position.needsUpdate = true;
  P.geo.attributes.aSize.needsUpdate = true;
  P.geo.attributes.aAlpha.needsUpdate = true;
  P.geo.attributes.aCol.needsUpdate = true;
  const u = P.mat.uniforms;
  u.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
  u.fogColor.value.copy(scene.fog.color); u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far * 1.25;
  P.live = live;
}

// A blast, sized: the fireball, the charcoal smoke, and -- on the ground -- the snow
// thrown up around it in a white skirt (the film's t368).
function dadBlast(x, y, z, size, ground) {
  const W = dad.world;
  if (!W) return;
  const n = Math.round(10 + 14 * size);
  for (let i = 0; i < n; i++) {
    const a = dadR(0, 6.283), u = dadR(-0.3, 1), sp = dadR(6, 22) * size;
    dadEmit(W.fire, x, y, z, Math.cos(a) * sp * 0.8, u * sp, Math.sin(a) * sp * 0.8, dadR(0.5, 1.1) * Math.sqrt(size), 4 * size, dadR(14, 26) * size, 1, [0xffd070, 0xff8a2a, 0xffb43a][i % 3], 2.5, 4);
  }
  for (let i = 0; i < n; i++) {
    const a = dadR(0, 6.283), sp = dadR(2, 10) * size;
    dadEmit(W.smoke, x + dadR(-3, 3) * size, y + dadR(0, 4) * size, z + dadR(-3, 3) * size, Math.cos(a) * sp, dadR(4, 12) * size, Math.sin(a) * sp,
      dadR(3, 6) * Math.sqrt(size), 6 * size, dadR(22, 40) * size, 0.85, [0x2a2c30, 0x3c4350, 0x1f2328][i % 3], 0.6, 2);
  }
  if (ground) for (let i = 0; i < n; i++) {
    const a = dadR(0, 6.283), sp = dadR(12, 30) * Math.sqrt(size);
    dadEmit(W.smoke, x, y + 1, z, Math.cos(a) * sp, dadR(1, 5), Math.sin(a) * sp, dadR(2.5, 4.5) * Math.sqrt(size), 5 * size, dadR(18, 32) * size, 0.9, 0xf2f4f7, 0.9, 0.5);
  }
  const d = Math.hypot(x - state.x, y - state.y, z - state.z);
  dad.m.shake = Math.max(dad.m.shake, clamp(1 - d / (250 * Math.sqrt(size)), 0, 1) * Math.min(1, size * 0.5));
  dadBoom(size, d);
}

// ---------------------------------------------------------------------------
// SOUND: its own, on its own noise (seeded), never the shared helpers' Math.random
// ---------------------------------------------------------------------------
let dadNoiseBuf = null;
function dadNoise(dur, freq, peak, when) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (!dadNoiseBuf) {
    const len = audioCtx.sampleRate * 2;
    dadNoiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = dadNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = dadRand() * 2 - 1;
  }
  const t = audioCtx.currentTime + (when || 0);
  const src = audioCtx.createBufferSource(); src.buffer = dadNoiseBuf;
  const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 0.8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(masterGain);
  src.start(t, dadRand() * 1.5); src.stop(t + dur + 0.05);
  sfxOneShot(src, [src, bp, g]);
}
function dadBoom(size, dist) {
  const k = clamp(1 - dist / 2500, 0.05, 1);
  dadNoise(0.6 + size * 0.5, 160, 0.4 * k * Math.min(1.5, size));
  dadNoise(0.25, 900, 0.12 * k);
  if (typeof synthBlip === "function") synthBlip("sine", 70, 28, 0.9 + size * 0.3, 0.3 * k);
}
function dadSoundsOff() {
  if (typeof setTone !== "function") return;
  for (const n of ["dadLock", "dadMsl", "dadPull", "dadGun"]) setTone(n, "square", 440, 0);
}

// ---------------------------------------------------------------------------
// THE SORTIE
// ---------------------------------------------------------------------------
function dadStart() {
  const V = TUNE.valley, D = TUNE.dad, W = dad.world;
  dadSeedNow = dad.seed;
  dad.m = {
    t: 0, clock: D.clock, health: D.health, bombs: D.bombs.count, flares: D.flares.count, missiles: D.missiles.count,
    bombsUsed: 0, flaresUsed: 0, missilesUsed: 0, hits: 0, hatch: false, plant: false, plantT: 0,
    over: false, result: null, why: "", overT: 0, card: false, highT: 0, lockT: 0, lockCool: 0, locked: false,
    samsLaunched: 0, decoys: 0, gunsKilled: 0, g: 1, gSmooth: 1, grey: 0, shake: 0, q: 0, spot: null, spotHeld: false,
    flareCool: 0, mslCool: 0, pullUp: false, cmNext: D.cruiseMissiles.delay, cmLeft: D.cruiseMissiles.count,
    damageTaken: 0, gunHits: 0, flak: 0, column: 0, msg: "", msgT: 0, alert: 0, lastFwd: null,
  };
  // the world back as it was: every gun and site standing, the bunker whole
  for (const g of W.guns) { g.alive = true; g.turret.visible = true; g.ruin.visible = false; g.fireT = 0; g.gapT = dadR(0, D.guns.gap); }
  for (const s of W.sites) { s.alive = true; s.left = 4; s.frame.visible = true; s.ruin.visible = false; for (const r of s.rails) r.visible = true; }
  W.radar.alive = true; W.radar.g.children.forEach(c => { c.visible = c !== W.radar.ruin; });
  for (const list of [W.cms, W.sams, W.flares, W.aims, W.bombs]) { for (const o of list) if (o.mesh) { scene.remove(o.mesh); const i = dad.objs.indexOf(o.mesh); if (i >= 0) dad.objs.splice(i, 1); } list.length = 0; }
  for (const P of [W.smoke, W.fire]) { P.life.fill(0); }
  W.hatch.visible = false; W.hole.visible = false; W.rubble.visible = false;
  vl.bunker.visible = true; vl.ventGroup.visible = true;
  // the jet: low at the valley's mouth, heading up it
  const x = V.x0 + D.start.back;
  const s = vlCenterSlope(x);
  state.x = x; state.z = vlCenterZ(x);
  state.y = terrainEff(state.x, state.z) + D.start.agl;
  state.heading = Math.atan2(1, s);
  state.pitch = 0; state.bank = 0;
  state.speed = D.jet.cruise;
  state.airVy = null;
  state.phase = "AIRBORNE";
  state.exploding = false; state.explodeTimer = 0;
  state.liftoffTimer = 0; state.climbAwayTimer = 0; state.engaged = false; state.approachLatch = false;
  state.maxAglSinceLiftoff = 1e9;
  state.viewChase = true; el.hud.classList.add("chase");
  state.touching = false; state.ctrlBank = 0; state.ctrlPitch = 0;
  dad.m.lastFwd = dadFwd(new THREE.Vector3());
  dad.cam = null;
  const card = document.getElementById("dadCard");
  if (card) card.remove();
}

function dadFwd(out) {
  const pr = state.pitch * DEG, hr = state.heading, cp = Math.cos(pr);
  return out.set(-Math.sin(hr) * cp, Math.sin(pr), -Math.cos(hr) * cp);
}
const dadTmpF = new THREE.Vector3(), dadTmpV = new THREE.Vector3(), dadTmpW = new THREE.Vector3();

// The jet. Its own model: roll to an attitude, pitch at a rate, a coordinated
// turn off the bank, G limited, speed traded against height. Owns the frame
// through the contract (vehicles.js "dad").
function dadFly(dt) {
  const J = TUNE.dad.jet, m = dad.m;
  if (!m) return;
  state.phase = "AIRBORNE";
  state.airVy = null;
  rumble = 0;
  if (state.exploding) return;
  const g = 9.81;
  const live = !m.over;
  const auto = m.over;   // the sortie is over and the jet is whole: hands off, climbing out
  const touching = live && state.touching && !menuOpen();
  let cb = touching ? state.ctrlBank : 0, cp = touching ? state.ctrlPitch : 0;
  // after the plant: hands off, wings level and a steady climb out over the peaks
  let qWant = Math.sign(cp) * Math.pow(Math.abs(cp), J.pitchExpo) * J.pitchRateDeg;
  if (auto) { cb = 0; qWant = clamp((25 - state.pitch) * 1.5, -10, 10); }
  // roll: an attitude, released to level
  const bankT = cb * J.bankLimitDeg;
  state.bank += (bankT - state.bank) * Math.min(1, J.rollRate * dt);
  // the coordinated turn, and the pitch rate, limited together to gMax
  const v = Math.max(30, state.speed), pr = state.pitch * DEG;
  let w = J.turnMul * g * Math.tan(clamp(state.bank, -85, 85) * DEG) / v;            // rad/s, heading
  let q = qWant * DEG;                                                                  // rad/s, pitch
  const load = (qq, ww) => Math.hypot(v * qq + g * Math.cos(pr), v * ww * Math.cos(pr)) / g;
  if (load(q, w) > J.gMax) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (load(q * mid, w * mid) > J.gMax) hi = mid; else lo = mid; }
    q *= lo; w *= lo;
  }
  state.pitch = clamp(state.pitch + q / DEG * dt, -89, 89);
  state.heading -= w * dt;
  m.q = q / DEG;
  // speed: drive to cruise, trade with the climb, bleed in a hard pull
  const n = load(q, w);
  state.speed += ((J.cruise - state.speed) * J.accel - g * Math.sin(state.pitch * DEG) * J.gravity - Math.max(0, n - 1.5) * 0.9) * dt;
  state.speed = clamp(state.speed, J.min, J.max);
  const f = dadFwd(dadTmpF);
  forward.copy(f);   // the shared heading vector (flight.js), so nothing reads a stale one
  state.x += f.x * state.speed * dt;
  state.y += f.y * state.speed * dt;
  state.z += f.z * state.speed * dt;
  if (state.y > J.ceiling) { state.y = J.ceiling; if (state.pitch > 0) state.pitch = Math.max(0, state.pitch - 30 * dt); }
  // the G he actually pulled: the change in the flight path, plus gravity across it
  if (m.lastFwd && dt > 0) {
    dadTmpV.copy(f).sub(m.lastFwd).multiplyScalar(state.speed / dt);
    dadTmpV.y += g;
    dadTmpV.addScaledVector(f, -dadTmpV.dot(f));
    m.g = dadTmpV.length() / g * Math.sign(dadTmpV.dot(dadTmpW.set(Math.sin(state.heading) * Math.sin(state.pitch * DEG), Math.cos(state.pitch * DEG), Math.cos(state.heading) * Math.sin(state.pitch * DEG))) || 1);
    m.lastFwd.copy(f);
  }
  if (typeof setEngine === "function") setEngine(state.speed / J.cruise);
  if (auto) return;
  // the ground, and anything solid: a crash, and the end of the sortie
  const ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  if (state.y - ground < 1.2) { dadCrash(Math.max(ground + 1, state.y)); return; }
  const hit = solidQuery(state.x, state.y, state.z, TUNE.solid.r.dad, SOLID.AIR, undefined, null, false);
  if (hit) dadCrash(state.y);
}

function dadCrash(y) {
  const m = dad.m;
  dadBlast(state.x, y, state.z, 2.2, true);
  dadEnd("fail", "crashed", true);
}
function dadDown() {
  dadBlast(state.x, state.y, state.z, 2.0, false);
  dadEnd("fail", "shot down", true);
}
// The sortie is over. `gone`: the jet is in pieces; it is hidden and the camera
// holds on where it went in.
function dadEnd(result, why, gone) {
  const m = dad.m;
  if (m.over) return;
  m.over = true; m.result = result; m.why = why; m.overT = 0;
  if (gone) {
    state.exploding = true;
    state.explodeTimer = 1e9;        // never reassembles: the card is the way on
    if (vehicleModel) vehicleModel.visible = false;
  }
  dadSoundsOff();
}

// ---------------------------------------------------------------------------
// The mission's frame: clock, radar, SAMs and flares, guns, his missiles, bombs,
// the cruise missiles, the plant, and the end.
// ---------------------------------------------------------------------------
function dadAgl() { return state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel); }

function dadMission(dt) {
  const m = dad.m, W = dad.world, D = TUNE.dad;
  if (!m || !W) return;
  m.t += dt;
  m.shake = Math.max(0, m.shake - dt * 1.4);
  if (m.msgT > 0) m.msgT -= dt;
  m.flareCool = Math.max(0, m.flareCool - dt);
  m.mslCool = Math.max(0, m.mslCool - dt);
  const jetAlive = !state.exploding;
  if (!m.over) {
    // ---- the clock runs to the target, and stops when the plant goes
    if (!m.plant) {
      m.clock = Math.max(0, m.clock - dt);
      if (m.clock <= 0) dadEnd("fail", "clock ran out", false);
    }
    // ---- the radar: above 100 ft for more than a moment is a lock, then a launch
    const R = D.radar, agl = dadAgl();
    const arm = R.arm * (m.plant ? R.alertMul : 1);
    m.lockCool = Math.max(0, m.lockCool - dt);
    if (agl > R.agl) m.highT += dt; else { m.highT = 0; m.lockT = 0; }
    m.locked = m.highT > arm && m.lockCool <= 0;
    if (m.locked) {
      m.lockT += dt;
      if (m.lockT >= R.lock * (m.plant ? R.alertMul : 1)) { dadLaunchSam(); m.lockT = 0; m.lockCool = R.cool * (m.plant ? R.alertMul : 1); }
    }
    // ---- the climb-out: once the plant goes, the sites in reach all fire
    if (m.plant && m.alert > 0) {
      m.alert -= dt;
      if (m.alert <= 0 && m.alertLeft > 0) { dadLaunchSam(); m.alertLeft--; m.alert = m.alertLeft > 0 ? 0.9 : 0; }
    }
    if (m.plant && !m.over) {
      m.plantT += dt;
      // out: he has lived `escape` seconds since, and nothing is close on his tail
      const close = W.sams.some(s => s.alive && s.target === "jet" && Math.hypot(s.x - state.x, s.y - state.y, s.z - state.z) < 800);
      if (m.plantT > D.escape && !close) dadEnd("success", "target destroyed", false);
    }
    // ---- out of bombs with the plant standing
    if (!m.plant && m.bombs <= 0 && W.bombs.length === 0 && !m.over) dadEnd("fail", "target intact", false);
    if (m.health <= 0 && !m.over) dadDown();
    // ---- PULL UP: the ground inside two and a half seconds at this velocity
    const f = dadFwd(dadTmpF);
    m.pullUp = false;
    for (let t = 0.5; t <= 2.5; t += 0.5) {
      const px = state.x + f.x * state.speed * t, pz = state.z + f.z * state.speed * t, py = state.y + f.y * state.speed * t;
      if (py - terrainEff(px, pz) < 8) { m.pullUp = true; break; }
    }
    dadUpdateSpot(dt);
  } else {
    m.overT += dt;
    if (!m.card && m.overT >= D.results.hold) dadShowCard();
  }
  dadCruiseMissiles(dt);
  dadGuns(dt, jetAlive && !m.over);
  dadSams(dt, jetAlive);
  dadFlaresStep(dt);
  dadAims(dt);
  dadBombsStep(dt);
  dadColumn(dt);
  // the jet's own trail of heat in the fire pool, and the particles
  dadStepParticles(W.smoke, dt);
  dadStepParticles(W.fire, dt);
  // the G meter's grey-out: a held pull fades the edges in, a quick one does not
  m.gSmooth += (Math.abs(m.g) - m.gSmooth) * Math.min(1, 2.2 * dt);
  const J = D.jet;
  const greyWant = jetAlive && !m.over ? clamp((m.gSmooth - J.gGrey) / (J.gBlack - J.gGrey), 0, 1) : 0;
  m.grey += (greyWant - m.grey) * Math.min(1, 1.5 * dt);
  dadSoundsStep();
  dadHudUpdate();
}

function dadSay(t, s) { dad.m.msg = t; dad.m.msgT = s || 2.5; }

// ---- the cruise missiles: dark darts streaming overhead to the radar on the ridge
function dadCruiseMissiles(dt) {
  const m = dad.m, W = dad.world, C = TUNE.dad.cruiseMissiles;
  if (m.cmLeft > 0) {
    m.cmNext -= dt;
    if (m.cmNext <= 0) {
      m.cmNext = C.gap;
      m.cmLeft--;
      const f = dadFwd(dadTmpF);
      const k = C.count - m.cmLeft;
      const mesh = dadMesh(W.bodyGeo, W.mats.ink);
      mesh.scale.set(1.4, 1.4, 1.6);
      W.cms.push({ mesh, x: state.x - f.x * 200 + (k - 3) * 22, y: state.y + 140 + k * 12, z: state.z - f.z * 200 + (k % 2 ? 30 : -30),
        vx: f.x * C.speed, vy: 0, vz: f.z * C.speed, alive: true, k });
    }
  }
  for (const c of W.cms) {
    if (!c.alive) continue;
    const R = W.radar;
    const dx = R.x - c.x, dz = R.z - c.z, dh = Math.hypot(dx, dz);
    const cruiseY = Math.max(R.y + 40, terrainEff(c.x, c.z) + 120, C.alt);
    const ty = dh < 700 ? R.y : cruiseY;
    const dy = ty - c.y;
    const len = Math.hypot(dx, dy, dz) || 1;
    // steer for the target at a steady speed
    const kx = dx / len * C.speed, ky = dy / len * C.speed, kz = dz / len * C.speed;
    const r = Math.min(1, 1.6 * dt);
    c.vx += (kx - c.vx) * r; c.vy += (ky - c.vy) * r; c.vz += (kz - c.vz) * r;
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.lookAt(c.x + c.vx, c.y + c.vy, c.z + c.vz);
    dadEmit(W.fire, c.x - c.vx * 0.012, c.y - c.vy * 0.012, c.z - c.vz * 0.012, 0, 0, 0, 0.12, 3, 1.5, 1, 0xffb43a, 0, 0);
    dadEmit(W.smoke, c.x, c.y, c.z, dadR(-1, 1), dadR(-1, 1), dadR(-1, 1), 2.8, 2.5, 13, 0.5, 0x9aa1ab, 0.2, 0.5);
    if (Math.hypot(R.x - c.x, R.y - c.y, R.z - c.z) < 14 || c.y < terrainEff(c.x, c.z)) {
      c.alive = false; c.mesh.visible = false;
      dadBlast(c.x, Math.max(c.y, terrainEff(c.x, c.z)), c.z, 1.8, true);
      if (R.alive) { R.alive = false; R.g.children.forEach(o => { o.visible = o === R.ruin; }); m.column = Math.max(m.column, 0); R.burnT = 30; }
    }
  }
  // the radar burns once it is hit: a column of smoke he flies past later
  const R = W.radar;
  if (!R.alive && R.burnT > 0) {
    R.burnT -= dt;
    if (dadRand() < 0.5) dadEmit(W.smoke, R.x + dadR(-6, 6), R.y, R.z + dadR(-6, 6), dadR(-2, 2), dadR(8, 14), dadR(-2, 2), dadR(5, 8), 10, 46, 0.7, 0x2a2c30, 0.2, 1.5);
    if (dadRand() < 0.4) dadEmit(W.fire, R.x + dadR(-5, 5), R.y - 2, R.z + dadR(-5, 5), 0, dadR(4, 9), 0, 0.6, 6, 12, 0.9, 0xff8a2a, 0.5, 2);
  }
}

// ---- the radar's missile: launched from the nearest standing site
function dadLaunchSam() {
  const W = dad.world, m = dad.m, S = TUNE.dad.sam;
  let best = null, bd = Infinity;
  for (const s of W.sites) {
    if (!s.alive || s.left <= 0) continue;
    const d = Math.hypot(s.x - state.x, s.z - state.z);
    if (d < bd && d < 4500) { bd = d; best = s; }
  }
  if (!best) return false;
  best.left--;
  const rail = best.rails[best.left];
  if (rail) rail.visible = false;
  const mesh = dadMesh(W.bodyGeo, W.mats.white);
  mesh.scale.set(1.3, 1.3, 1.6);
  W.sams.push({ mesh, x: best.x, y: best.y + 3, z: best.z, vx: 0, vy: 40, vz: 0, speed: 40, t: 0, alive: true, target: "jet", flare: null });
  m.samsLaunched++;
  dadSay("MISSILE LAUNCH", 2);
  return true;
}
function dadSams(dt, jetAlive) {
  const W = dad.world, m = dad.m, S = TUNE.dad.sam;
  for (const s of W.sams) {
    if (!s.alive) continue;
    s.t += dt;
    s.speed = Math.min(S.speed, s.speed + 160 * dt);
    // what it chases: the jet, or the flare it was decoyed onto
    let tx, ty, tz, tvx = 0, tvy = 0, tvz = 0;
    if (s.target === "flare" && s.flare && s.flare.alive) { tx = s.flare.x; ty = s.flare.y; tz = s.flare.z; tvx = s.flare.vx; tvy = s.flare.vy; tvz = s.flare.vz; }
    else if (s.target === "jet" && jetAlive && !m.over) { const f = dadFwd(dadTmpF); tx = state.x; ty = state.y; tz = state.z; tvx = f.x * state.speed; tvy = f.y * state.speed; tvz = f.z * state.speed; }
    else { tx = s.x + s.vx; ty = s.y + s.vy; tz = s.z + s.vz; s.target = "none"; }
    const dist = Math.hypot(tx - s.x, ty - s.y, tz - s.z);
    const tgo = Math.min(4, dist / Math.max(60, s.speed));
    const ax = tx + tvx * tgo * 0.7 - s.x, ay = ty + tvy * tgo * 0.7 - s.y, az = tz + tvz * tgo * 0.7 - s.z;
    const al = Math.hypot(ax, ay, az) || 1;
    // turn the velocity toward the aim point, no faster than turnDeg a second (after the boost)
    const cur = Math.hypot(s.vx, s.vy, s.vz) || 1;
    let ux = s.vx / cur, uy = s.vy / cur, uz = s.vz / cur;
    const wx = ax / al, wy = ay / al, wz = az / al;
    const dot = clamp(ux * wx + uy * wy + uz * wz, -1, 1), ang = Math.acos(dot);
    const maxA = (s.t < 0.8 ? 120 : S.turnDeg) * DEG * dt;
    const k = ang > 1e-4 ? Math.min(1, maxA / ang) : 1;
    ux += (wx - ux) * k; uy += (wy - uy) * k; uz += (wz - uz) * k;
    const ul = Math.hypot(ux, uy, uz) || 1;
    s.vx = ux / ul * s.speed; s.vy = uy / ul * s.speed; s.vz = uz / ul * s.speed;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.lookAt(s.x + s.vx, s.y + s.vy, s.z + s.vz);
    // the motor and the thick white trail that curls and lingers (t384, t432)
    dadEmit(W.fire, s.x - s.vx * 0.01, s.y - s.vy * 0.01, s.z - s.vz * 0.01, 0, 0, 0, 0.1, 5, 2.5, 1, 0xfff0b0, 0, 0);
    // grey-white, so it reads against the sky AND the snow, thick and lingering (t384, t482):
    // two puffs a frame, so at 290 m/s it is a rope and not a row of dots
    for (let k = 0; k < 2; k++) {
      const b = 0.012 + k * 0.009;
      dadEmit(W.smoke, s.x - s.vx * b, s.y - s.vy * b, s.z - s.vz * b, dadR(-1.5, 1.5), dadR(-1, 1.5), dadR(-1.5, 1.5), dadR(4, 5.5), 4, dadR(24, 38), 0.7, s.t < 1.5 ? 0x8a93a0 : (dadRand() < 0.5 ? 0xb9bec6 : 0x9aa1ab), 0.3, 0.9);
    }
    const hitDist = s.target === "flare" ? 10 : S.fuse;
    if (s.target !== "none" && dist < hitDist) {
      s.alive = false; s.mesh.visible = false;
      dadBlast(s.x, s.y, s.z, 1.1, false);
      if (s.target === "jet") { dadDamage(S.damage, "missile"); }
      continue;
    }
    if (s.t > S.life || s.y < terrainEff(s.x, s.z)) {
      s.alive = false; s.mesh.visible = false;
      dadBlast(s.x, Math.max(s.y, terrainEff(s.x, s.z)), s.z, 1.0, s.y < terrainEff(s.x, s.z) + 3);
    }
  }
}
function dadDamage(n, why) {
  const m = dad.m;
  if (m.over) return;
  m.health = Math.max(0, m.health - n);
  m.damageTaken += n;
  m.shake = Math.max(m.shake, Math.min(1, n / 40));
  dadSay(why === "missile" ? "HIT -- MISSILE" : "HIT", 1.2);
  if (m.health <= 0) dadDown();
}

// ---- flares: a burst of three hot sparks; every missile chasing him within reach
// takes the nearest one instead
function dadFlare() {
  const m = dad.m, W = dad.world, F = TUNE.dad.flares;
  if (!dadFlying() || m.flares <= 0 || m.flareCool > 0) return false;
  m.flares--; m.flaresUsed++; m.flareCool = F.cooldown;
  const f = dadFwd(dadTmpF);
  const made = [];
  for (let i = 0; i < 3; i++) {
    const side = (i - 1) * 18;
    const sx = Math.cos(state.heading) * side, sz = -Math.sin(state.heading) * side;
    const fl = { x: state.x - f.x * 6, y: state.y - 1, z: state.z - f.z * 6,
      vx: f.x * state.speed * 0.55 + sx, vy: f.y * state.speed * 0.55 - 12 - i * 4, vz: f.z * state.speed * 0.55 + sz, t: 0, alive: true };
    W.flares.push(fl); made.push(fl);
  }
  for (const s of W.sams) {
    if (!s.alive || s.target !== "jet") continue;
    if (Math.hypot(s.x - state.x, s.y - state.y, s.z - state.z) > F.decoyRange) continue;
    let best = made[0], bd = Infinity;
    for (const fl of made) { const d = Math.hypot(fl.x - s.x, fl.y - s.y, fl.z - s.z); if (d < bd) { bd = d; best = fl; } }
    s.target = "flare"; s.flare = best;
    m.decoys++;
  }
  dadNoise(0.35, 2400, 0.12);
  return true;
}
function dadFlaresStep(dt) {
  const W = dad.world, F = TUNE.dad.flares;
  for (const fl of W.flares) {
    if (!fl.alive) continue;
    fl.t += dt;
    fl.vx *= Math.exp(-0.6 * dt); fl.vz *= Math.exp(-0.6 * dt);
    fl.vy = fl.vy * Math.exp(-0.6 * dt) - 9.8 * dt;
    fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.z += fl.vz * dt;
    dadEmit(W.fire, fl.x, fl.y, fl.z, 0, 0, 0, 0.2, 9, 5, 1, 0xfff0b0, 0, 0);
    if (dadRand() < 0.7) dadEmit(W.fire, fl.x, fl.y, fl.z, dadR(-14, 14), dadR(-14, 6), dadR(-14, 14), 0.45, 2.2, 0.6, 1, 0xffb43a, 1.5, -8);
    if (dadRand() < 0.5) dadEmit(W.smoke, fl.x, fl.y, fl.z, 0, 0, 0, 2.2, 2, 9, 0.35, 0xf2f4f7, 0, 0.6);
    if (fl.t > F.life || fl.y < terrainEff(fl.x, fl.z)) fl.alive = false;
  }
}

// ---- the guns on the ridges: bursts of tracer and flak while he is in range and
// in sight; higher means more exposed
function dadLos(x, y, z, tx, ty, tz) {
  for (let i = 1; i < 10; i++) {
    const t = i / 10, px = x + (tx - x) * t, py = y + (ty - y) * t, pz = z + (tz - z) * t;
    if (py < terrainEff(px, pz) + 1) return false;
  }
  return true;
}
function dadGuns(dt, firing) {
  const W = dad.world, m = dad.m, G = TUNE.dad.guns;
  let anyFiring = false;
  const f = dadFwd(dadTmpF);
  for (const g of W.guns) {
    if (!g.alive) continue;
    const dx = state.x - g.x, dy = state.y - g.y, dz = state.z - g.z, d = Math.hypot(dx, dy, dz);
    // the turret follows him whether or not it is firing
    g.turret.rotation.y = Math.atan2(-dx, -dz);
    g.tilt.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
    if (!firing || d > G.range) { g.fireT = 0; continue; }
    if (g.fireT <= 0) {
      g.gapT -= dt;
      if (g.gapT > 0) continue;
      if (!dadLos(g.x, g.y, g.z, state.x, state.y, state.z)) { g.gapT = 0.4; continue; }
      g.fireT = G.burst; g.gapT = G.gap * dadR(0.7, 1.3);
    }
    g.fireT -= dt;
    anyFiring = true;
    g.shotT -= dt;
    const tof = d / G.tracer;
    const ax = state.x + f.x * state.speed * tof - g.x, ay = state.y + f.y * state.speed * tof - g.y, az = state.z + f.z * state.speed * tof - g.z;
    const al = Math.hypot(ax, ay, az) || 1;
    const agl = dadAgl();
    const expo = agl > G.exposedAgl ? 1.25 : (agl > TUNE.dad.radar.agl ? 0.9 : 0.4);
    while (g.shotT <= 0) {
      g.shotT += 1 / G.rof;
      const sx = ax / al + dadR(-G.spread, G.spread), sy = ay / al + dadR(-G.spread, G.spread), sz = az / al + dadR(-G.spread, G.spread);
      // a tracer: a bright head and a dimmer tail behind it, so it reads as a streak
      const life = Math.min(2.2, tof * 1.3);
      dadEmit(W.fire, g.x, g.y, g.z, sx * G.tracer, sy * G.tracer, sz * G.tracer, life, 4.5, 3.5, 1, 0xffd070, 0, 0);
      dadEmit(W.fire, g.x - sx * 9, g.y - sy * 9, g.z - sz * 9, sx * G.tracer, sy * G.tracer, sz * G.tracer, life, 3.5, 2.5, 0.6, 0xff8a2a, 0, 0);
      if (dadRand() < G.hitChance * expo * (1 - d / G.range) * 1.4) {
        m.gunHits++;
        dadDamage(G.damage, "gun");
        dadEmit(W.fire, state.x, state.y, state.z, dadR(-20, 20), dadR(-5, 15), dadR(-20, 20), 0.3, 4, 1, 1, 0xfff0b0, 2, 0);
      }
    }
    g.flakT -= dt;
    if (g.flakT <= 0) {
      g.flakT = G.flakEvery * dadR(0.6, 1.4);
      const spread = G.flakSpread * (0.4 + d / G.range) / expo;
      const bx = state.x + f.x * state.speed * dadR(0.1, 0.6) + dadR(-spread, spread), by = state.y + dadR(-spread, spread) * 0.6 + 6, bz = state.z + f.z * state.speed * dadR(0.1, 0.6) + dadR(-spread, spread);
      dadEmit(W.fire, bx, by, bz, 0, 0, 0, 0.18, 14, 6, 1, 0xffd070, 0, 0);
      for (let i = 0; i < 4; i++) dadEmit(W.smoke, bx + dadR(-2, 2), by + dadR(-2, 2), bz + dadR(-2, 2), dadR(-3, 3), dadR(-1, 3), dadR(-3, 3), dadR(2.5, 4), 4, dadR(9, 14), 0.8, 0x1f2328, 0.8, 0.2);
      m.flak++;
      if (Math.hypot(bx - state.x, by - state.y, bz - state.z) < 10) dadDamage(5, "flak");
      dadNoise(0.18, 300, 0.12 * clamp(1 - Math.hypot(bx - state.x, by - state.y, bz - state.z) / 600, 0.1, 1));
    }
  }
  m.gunsFiring = anyFiring;
}

// ---- his missiles: off the rail at the nearest gun or site in the cone ahead
function dadFireMissile() {
  const m = dad.m, W = dad.world, A = TUNE.dad.missiles;
  if (!dadFlying() || m.missiles <= 0 || m.mslCool > 0) return false;
  m.missiles--; m.missilesUsed++; m.mslCool = A.cooldown;
  const tgt = dadAimTarget();
  const f = dadFwd(dadTmpF);
  const mesh = dadMesh(W.bodyGeo, W.mats.steel);
  W.aims.push({ mesh, x: state.x + f.x * 6, y: state.y - 1.5, z: state.z + f.z * 6, vx: f.x * (state.speed + 40), vy: f.y * (state.speed + 40), vz: f.z * (state.speed + 40), t: 0, alive: true, tgt });
  dadNoise(0.5, 1200, 0.15);
  return true;
}
function dadAimTarget() {
  const W = dad.world, A = TUNE.dad.missiles;
  const f = dadFwd(dadTmpF);
  let best = null, bs = -Infinity;
  for (const o of W.guns.concat(W.sites)) {
    if (!o.alive) continue;
    const dx = o.x - state.x, dy = o.y - state.y, dz = o.z - state.z, d = Math.hypot(dx, dy, dz);
    if (d > A.range) continue;
    const c = (dx * f.x + dy * f.y + dz * f.z) / d;
    if (c < Math.cos(A.lockCone)) continue;
    const score = c * 2 - d / A.range + (W.guns.includes(o) ? 0.5 : 0);
    if (score > bs) { bs = score; best = o; }
  }
  return best;
}
function dadAims(dt) {
  const W = dad.world, A = TUNE.dad.missiles;
  for (const a of W.aims) {
    if (!a.alive) continue;
    a.t += dt;
    const sp = Math.min(A.speed + 120, Math.hypot(a.vx, a.vy, a.vz) + 120 * dt);
    if (a.tgt && a.tgt.alive) {
      const dx = a.tgt.x - a.x, dy = a.tgt.y - a.y, dz = a.tgt.z - a.z, dl = Math.hypot(dx, dy, dz) || 1;
      const cur = Math.hypot(a.vx, a.vy, a.vz) || 1;
      let ux = a.vx / cur, uy = a.vy / cur, uz = a.vz / cur;
      const ang = Math.acos(clamp(ux * dx / dl + uy * dy / dl + uz * dz / dl, -1, 1));
      const k = ang > 1e-4 ? Math.min(1, A.turnDeg * DEG * dt / ang) : 1;
      ux += (dx / dl - ux) * k; uy += (dy / dl - uy) * k; uz += (dz / dl - uz) * k;
      const ul = Math.hypot(ux, uy, uz) || 1;
      a.vx = ux / ul * sp; a.vy = uy / ul * sp; a.vz = uz / ul * sp;
      if (dl < 9) { a.alive = false; a.mesh.visible = false; dadKill(a.tgt); dadBlast(a.tgt.x, a.tgt.y, a.tgt.z, 1.4, true); continue; }
    }
    a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
    a.mesh.position.set(a.x, a.y, a.z);
    a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
    dadEmit(W.fire, a.x, a.y, a.z, 0, 0, 0, 0.08, 3.5, 2, 1, 0xfff0b0, 0, 0);
    dadEmit(W.smoke, a.x, a.y, a.z, 0, 0, 0, 2.2, 1.5, 8, 0.45, 0xd8dce2, 0.2, 0.5);
    if (a.t > A.life || a.y < terrainEff(a.x, a.z)) { a.alive = false; a.mesh.visible = false; dadBlast(a.x, Math.max(a.y, terrainEff(a.x, a.z)), a.z, 0.8, true); }
  }
}
function dadKill(o) {
  const m = dad.m, W = dad.world;
  if (!o.alive) return;
  o.alive = false;
  if (o.turret) { o.turret.visible = false; o.ruin.visible = true; m.gunsKilled++; dadSay("GUN DOWN", 1.6); }
  else { o.frame.visible = false; o.ruin.visible = true; dadSay("SITE DOWN", 1.6); }
}

// ---- the laser: where the nose points, held while he pulls
function dadNosePoint(f) {
  const vt = vl.vent, B = TUNE.valley.bunker;
  // the bunker's roof first (its vent's plane), then the ground
  if (f.y < -0.01) {
    const t = (vt.y - state.y) / f.y;
    const px = state.x + f.x * t, pz = state.z + f.z * t;
    if (t > 0 && Math.abs(px - vt.x) < B.w / 2 + 1 && Math.abs(pz - vt.z) < B.d / 2 + 1) return { x: px, y: vt.y, z: pz, d: t };
  }
  let prev = 0;
  for (let t = 8; t < 3200; t += t < 400 ? 6 : 12) {
    const px = state.x + f.x * t, py = state.y + f.y * t, pz = state.z + f.z * t;
    if (py < terrainEff(px, pz)) {
      let lo = prev, hi = t;
      for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (state.y + f.y * mid < terrainEff(state.x + f.x * mid, state.z + f.z * mid)) hi = mid; else lo = mid; }
      return { x: state.x + f.x * hi, y: state.y + f.y * hi, z: state.z + f.z * hi, d: hi };
    }
    prev = t;
  }
  return null;
}
function dadBombRange() {
  const vt = vl.vent;
  return Math.hypot(state.x - vt.x, state.z - vt.z);
}
function dadUpdateSpot(dt) {
  const m = dad.m, W = dad.world, B = TUNE.dad.bombs;
  const near = dadBombRange() < B.range * 1.2;
  if (!near) { m.spot = null; W.spot.visible = false; return; }
  // it follows the nose -- except while a bomb is falling and he is pulling hard:
  // then it holds where it was, and the bomb goes where he was pointing
  const steady = W.bombs.length === 0 || Math.abs(m.q) < B.holdRateDeg;
  if (steady || !m.spot) {
    const p = dadNosePoint(dadFwd(dadTmpF));
    if (p) { m.spot = p; m.spotHeld = false; }
    else if (m.spot) m.spotHeld = true;
  } else m.spotHeld = true;
  W.spot.visible = !!m.spot;
  if (m.spot) {
    W.spot.position.set(m.spot.x, m.spot.y + 0.15, m.spot.z);
    const s = clamp(Math.hypot(m.spot.x - state.x, m.spot.y - state.y, m.spot.z - state.z) / 400, 0.6, 4);
    W.spot.scale.setScalar(s);
    m.spotErr = Math.hypot(m.spot.x - vl.vent.x, m.spot.z - vl.vent.z);
  }
}
function dadBombCan() {
  const m = dad.m;
  return dadFlying() && m.bombs > 0 && !m.plant && dadBombRange() < TUNE.dad.bombs.range && dadAgl() > TUNE.dad.bombs.armAgl * 0.5;
}
function dadDropBomb() {
  const m = dad.m, W = dad.world;
  if (!dadBombCan()) return false;
  m.bombs--; m.bombsUsed++;
  const f = dadFwd(dadTmpF);
  const mesh = dadMesh(W.bombGeo, W.mats.steel);
  W.bombs.push({ mesh, x: state.x, y: state.y - 2, z: state.z, vx: f.x * state.speed, vy: f.y * state.speed, vz: f.z * state.speed, t: 0, alive: true });
  dadNoise(0.3, 600, 0.12);
  dadSay("BOMB AWAY", 1.4);
  return true;
}
function dadBombsStep(dt) {
  const W = dad.world, m = dad.m, B = TUNE.dad.bombs, vt = vl.vent;
  for (let i = W.bombs.length - 1; i >= 0; i--) {
    const b = W.bombs[i];
    b.t += dt;
    const px = b.x, py = b.y, pz = b.z;
    // guided: the velocity is steered toward the laser spot, `steer` m/s/s at most
    // with a spot to ride, its fins carry it and steer it, `steer` m/s/s at most;
    // without one it falls like a stone
    let ax = 0, ay = -9.81, az = 0;
    if (m.spot) {
      const dx = m.spot.x - b.x, dy = m.spot.y - b.y, dz = m.spot.z - b.z, dl = Math.hypot(dx, dy, dz) || 1;
      const sp = Math.max(60, Math.hypot(b.vx, b.vy, b.vz));
      ax = (dx / dl * sp - b.vx) * 2.4; ay = (dy / dl * sp - b.vy) * 2.4; az = (dz / dl * sp - b.vz) * 2.4;
      const al = Math.hypot(ax, ay, az);
      if (al > B.steer) { ax *= B.steer / al; ay *= B.steer / al; az *= B.steer / al; }
    }
    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
    // through the vent's plane this frame: within ventR of its centre is a hit
    let done = false, onVent = false, at = null;
    if (py >= vt.y && b.y < vt.y) {
      const t = (py - vt.y) / (py - b.y);
      const cx = px + (b.x - px) * t, cz = pz + (b.z - pz) * t;
      const B2 = TUNE.valley.bunker;
      const err = Math.hypot(cx - vt.x, cz - vt.z);
      if (err <= TUNE.dad.ventR) { done = true; onVent = true; at = { x: cx, y: vt.y, z: cz, err }; }
      else if (Math.abs(cx - vt.x) < B2.w / 2 + 1.5 && Math.abs(cz - vt.z) < B2.d / 2 + 1.5) { done = true; at = { x: cx, y: vt.y, z: cz, err }; }
    }
    const gy = terrainEff(b.x, b.z);
    if (!done && b.y <= gy) { done = true; at = { x: b.x, y: gy, z: b.z, err: Math.hypot(b.x - vt.x, b.z - vt.z) }; }
    if (!done && b.t > B.life) { done = true; at = { x: b.x, y: b.y, z: b.z, err: 999 }; }
    if (!done) continue;
    b.alive = false; b.mesh.visible = false;
    W.bombs.splice(i, 1);
    m.lastBomb = { onVent, err: +at.err.toFixed(2) };
    if (onVent && !m.plant) {
      m.hits++;
      if (!m.hatch) {
        m.hatch = true;
        dadBlast(vt.x, vt.y + 1, vt.z, 1.2, true);
        dadHatchBlows();
        dadSay("DIRECT HIT -- HATCH OPEN", 3);
      } else {
        dadPlantGoes();
      }
    } else {
      dadBlast(at.x, at.y, at.z, 1.3, true);
      dadSay("MISS  " + at.err.toFixed(1) + " m", 2.5);
    }
  }
}
function dadHatchBlows() {
  const W = dad.world, vt = vl.vent;
  vl.ventGroup.visible = false;
  W.hole.visible = true;
  W.hatch.visible = true;
  W.hatch.position.set(vt.x, vt.y, vt.z);
  W.hatchV = { x: dadR(-8, 8), y: 38, z: dadR(-8, 8), r: dadR(3, 6) };
}
// the plant goes: the bunker gone in a column of black smoke over a skirt of snow
function dadPlantGoes() {
  const m = dad.m, W = dad.world, vt = vl.vent;
  m.plant = true; m.plantT = 0;
  vl.bunker.visible = false;
  W.hatch.visible = false; W.hole.visible = false;
  W.rubble.visible = true;
  dadBlast(vt.x, vt.y, vt.z, 5, true);
  // the burst that fills the bowl (t368): charcoal billows thrown up and out, and the
  // snow blown off the floor in a white wall round it
  for (let i = 0; i < 90; i++) {
    const a = dadR(0, 6.283), up = dadR(35, 110), out = dadR(10, 70);
    dadEmit(W.smoke, vt.x + dadR(-25, 25), vt.y + dadR(0, 30), vt.z + dadR(-25, 25), Math.cos(a) * out, up, Math.sin(a) * out,
      dadR(9, 15), dadR(60, 100), dadR(170, 280), 0.9, [0x1f2328, 0x2a2c30, 0x3c4350][i % 3], 0.55, 1.5);
  }
  for (let i = 0; i < 70; i++) {
    const a = dadR(0, 6.283), out = dadR(60, 140);
    dadEmit(W.smoke, vt.x, vt.y + 3, vt.z, Math.cos(a) * out, dadR(4, 26), Math.sin(a) * out,
      dadR(6, 10), dadR(40, 70), dadR(130, 220), 0.95, 0xf2f4f7, 0.55, 0.6);
  }
  for (let i = 0; i < 40; i++) {
    const a = dadR(0, 6.283), up = dadR(20, 60), out = dadR(5, 30);
    dadEmit(W.fire, vt.x, vt.y + dadR(0, 25), vt.z, Math.cos(a) * out, up, Math.sin(a) * out, dadR(1.2, 2.4), dadR(30, 50), dadR(70, 120), 1, [0xffd070, 0xff8a2a, 0xff7a1a][i % 3], 1.0, 4);
  }
  m.column = 22;
  m.shake = 1;
  dadSay("TARGET DESTROYED", 4);
  // every site still standing within reach launches, one after another
  m.alertLeft = Math.min(4, W.sites.filter(s => s.alive && Math.hypot(s.x - vt.x, s.z - vt.z) < 4500).length);
  m.alert = 1.2;
}
function dadColumn(dt) {
  const m = dad.m, W = dad.world, vt = vl.vent;
  if (W.hatch.visible && W.hatchV) {
    const h = W.hatchV;
    h.y -= 9.81 * dt;
    W.hatch.position.x += h.x * dt; W.hatch.position.y += h.y * dt; W.hatch.position.z += h.z * dt;
    W.hatch.rotation.x += h.r * dt; W.hatch.rotation.z += h.r * 0.6 * dt;
    if (W.hatch.position.y < terrainEff(W.hatch.position.x, W.hatch.position.z)) { W.hatch.position.y = terrainEff(W.hatch.position.x, W.hatch.position.z) + 0.2; h.x = h.z = h.r = 0; h.y = 0; }
  }
  if (m.column <= 0) return;
  m.column -= dt;
  const k = clamp(m.column / 22, 0, 1);
  // the charcoal column (t368): rising billows, broad at the top
  for (let i = 0; i < 3; i++) dadEmit(W.smoke, vt.x + dadR(-14, 14), vt.y + dadR(0, 12), vt.z + dadR(-14, 14), dadR(-6, 6), dadR(18, 36) * (0.5 + k), dadR(-6, 6), dadR(8, 13), 30, dadR(90, 150), 0.85, [0x1f2328, 0x2a2c30, 0x3c4350][i], 0.12, 3);
  // fire in its root for the first seconds (t476)
  if (m.column > 16) for (let i = 0; i < 3; i++) dadEmit(W.fire, vt.x + dadR(-8, 8), vt.y + dadR(0, 20), vt.z + dadR(-8, 8), dadR(-6, 6), dadR(10, 30), dadR(-6, 6), dadR(0.8, 1.4), 16, 38, 1, [0xffd070, 0xff8a2a, 0xff7a1a][i], 1, 6);
  // and the snow thrown out across the bowl
  if (m.column > 18) for (let i = 0; i < 3; i++) { const a = dadR(0, 6.283), sp = dadR(30, 60); dadEmit(W.smoke, vt.x, vt.y + 2, vt.z, Math.cos(a) * sp, dadR(2, 8), Math.sin(a) * sp, dadR(4, 7), 14, dadR(40, 70), 0.85, 0xf2f4f7, 0.7, 0.8); }
}

// ---------------------------------------------------------------------------
// CAMERA AND MODEL
// ---------------------------------------------------------------------------
const dadCamPos = new THREE.Vector3(), dadCamLook = new THREE.Vector3(), dadCamUp = new THREE.Vector3();
function dadCamera(dt) {
  const m = dad.m;
  const f = dadFwd(dadTmpF);
  const sh = m ? m.shake : 0;
  if (state.exploding) {
    // in pieces: hold where it went in, looking at it
    camera.up.set(0, 1, 0);
    camera.lookAt(state.x, state.y, state.z);
    return;
  }
  if (state.viewChase) {
    // behind and above along his own flight path, so a dive looks DOWN the dive
    const pr = state.pitch * DEG;
    const ux = Math.sin(state.heading) * Math.sin(pr), uy = Math.cos(pr), uz = Math.cos(state.heading) * Math.sin(pr);
    dadCamPos.set(state.x - f.x * 34 + ux * 8, state.y - f.y * 34 + uy * 8, state.z - f.z * 34 + uz * 8);
    if (!dad.cam) { camera.position.copy(dadCamPos); dad.cam = true; }
    camera.position.lerp(dadCamPos, 1 - Math.exp(-22 * dt));   // stiff: a 9 G pull must not leave it under the jet
    const gy = terrainEff(camera.position.x, camera.position.z) + 2;
    if (camera.position.y < gy) camera.position.y = gy;
    dadCamLook.set(state.x + f.x * 60, state.y + f.y * 60 + 2, state.z + f.z * 60);
    dadCamUp.set(ux, uy, uz);
    camera.up.copy(dadCamUp);
    camera.lookAt(dadCamLook);
    camera.rotateZ(-state.bank * DEG * 0.45);
  } else {
    camera.up.set(0, 1, 0);
    camera.position.set(state.x, state.y + 0.9, state.z);
    // yaw, then pitch, then roll: the order `forward` is built in, and the shared
    // camera's own (scene.js) -- passed anyway, and never changed
    camera.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ");
  }
  if (sh > 0) {
    camera.position.x += (dadRand() - 0.5) * 1.6 * sh;
    camera.position.y += (dadRand() - 0.5) * 1.2 * sh;
    camera.position.z += (dadRand() - 0.5) * 1.6 * sh;
  }
}
// The jet's pose and its burner, here rather than in the shared pose so nothing
// in dad mode draws on Math.random.
function dadPoseModel(g) {
  g.visible = state.viewChase && !state.exploding;
  if (!g.visible) return;
  g.position.set(state.x, state.y, state.z);
  if (g.userData.baseScale === undefined) g.userData.baseScale = g.scale.x;
  g.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ");
  const b = g.userData.burner;
  if (b) {
    const B = TUNE.burner;
    b.root.visible = true;
    const want = clamp(0.35 + 0.65 * (state.speed / TUNE.dad.jet.cruise - 0.6) + (dad.m ? Math.max(0, dad.m.g - 3) * 0.08 : 0), B.idle, 1);
    b.level += (want - b.level) * Math.min(1, B.response * 0.016);
    b.root.scale.set(1, 1, b.level * (1 + (dadRand() - 0.5) * B.flicker));
    for (let i = 0; i < B.layers.length; i++) { const fl = b["flame" + i]; if (fl) fl.material.opacity = B.layers[i].opacity * b.level; }
    if (b.core) b.core.material.opacity = B.coreOpacity * (0.4 + 0.6 * b.level);
    if (b.knots) b.knots.material.opacity = B.diamondOpacity * Math.max(0, b.level - 0.45) / 0.55;
    if (b.glow) { b.glow.material.opacity = B.glowOpacity * b.level; const s = (g.userData.nozzleR || 1) * B.glow * (0.85 + 0.3 * dadRand()) * (0.6 + 0.4 * b.level); b.glow.scale.set(s, s, 1); }
  }
}

// ---------------------------------------------------------------------------
// HUD, the grey-out and the results card (text is fine in here)
// ---------------------------------------------------------------------------
function dadBuildHud() {
  const hud = dadEl("div", { id: "dadHud" });
  dad.dom.push(hud);
  const mk = (cls, parent) => dadEl("div", { class: cls }, parent || hud);
  dad.hud = {
    clock: mk("dadClock"), left: mk("dadL"), right: mk("dadR"), warn: mk("dadWarn"), msg: mk("dadMsg"),
    weap: mk("dadWeap"), health: mk("dadHealth"), box: mk("dadBox"), boxErr: null, fpm: mk("dadFpm"),
  };
  dad.hud.boxErr = mk("dadBoxErr", dad.hud.box);
  dad.hud.healthBar = mk("bar", dad.hud.health);
  const grey = dadEl("div", { id: "dadGrey" });
  dad.dom.push(grey);
  dad.hud.grey = grey;
}
const dadProj = new THREE.Vector3();
function dadScreen(x, y, z) {
  dadProj.set(x, y, z).project(camera);
  if (dadProj.z > 1) return null;
  return { x: (dadProj.x + 1) / 2 * innerWidth, y: (1 - dadProj.y) / 2 * innerHeight };
}
function dadFmtClock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function dadHudUpdate() {
  const h = dad.hud, m = dad.m;
  if (!h || !m) return;
  h.clock.textContent = dadFmtClock(m.clock);
  h.clock.classList.toggle("low", m.clock < 30 && !m.plant);
  const ft = Math.round(dadAgl() * 3.281);
  h.left.innerHTML = "SPD " + Math.round(state.speed * 1.944) + " KT<br>G " + m.g.toFixed(1);
  h.right.innerHTML = "RALT " + Math.max(0, ft) + " FT<br>ALT " + Math.round(state.y * 3.281) + " FT";
  h.right.classList.toggle("high", ft > 100 && !m.plant);
  h.weap.innerHTML = "BOMB " + m.bombs + "&nbsp;&nbsp;FLR " + m.flares + "&nbsp;&nbsp;MSL " + m.missiles;
  h.healthBar.style.width = m.health + "%";
  h.health.classList.toggle("hurt", m.health < 50);
  const warns = [];
  const chasing = dad.world.sams.some(s => s.alive && s.target === "jet");
  if (!m.over) {
    if (chasing) warns.push("MISSILE");
    else if (m.locked) warns.push("RADAR LOCK");
    if (m.pullUp) warns.push("PULL UP");
  }
  h.warn.textContent = warns.join("   ");
  h.warn.classList.toggle("on", warns.length > 0);
  h.msg.textContent = m.msgT > 0 ? m.msg : "";
  // the target box on the vent, and how far the laser is from it
  const near = !m.over && !m.plant && dadBombRange() < TUNE.dad.bombs.range * 1.2;
  const sp = near ? dadScreen(vl.vent.x, vl.vent.y, vl.vent.z) : null;
  h.box.style.display = sp ? "block" : "none";
  if (sp) {
    h.box.style.transform = "translate(" + Math.round(sp.x) + "px," + Math.round(sp.y) + "px)";
    h.boxErr.textContent = m.spot ? (m.spotErr < TUNE.dad.ventR ? "ON  " : "") + m.spotErr.toFixed(1) + " m" + (m.spotHeld ? " HOLD" : "") : "";
    h.box.classList.toggle("on", !!m.spot && m.spotErr < TUNE.dad.ventR);
  }
  // the flight-path marker: where he is going
  const f = dadFwd(dadTmpF);
  const fp = !state.exploding ? dadScreen(state.x + f.x * 400, state.y + f.y * 400, state.z + f.z * 400) : null;
  h.fpm.style.display = fp ? "block" : "none";
  if (fp) h.fpm.style.transform = "translate(" + Math.round(fp.x) + "px," + Math.round(fp.y) + "px)";
  h.grey.style.opacity = (m.grey * 0.92).toFixed(3);
}
function dadSoundsStep() {
  if (typeof setTone !== "function") return;
  const m = dad.m, W = dad.world;
  const chasing = !m.over && W.sams.some(s => s.alive && s.target === "jet");
  const beat = Math.floor(m.t * (chasing ? 8 : 3)) % 2 === 0;
  setTone("dadMsl", "square", 1180, chasing && beat ? 0.05 : 0);
  setTone("dadLock", "square", beat ? 880 : 660, !chasing && !m.over && m.locked ? 0.04 : 0);
  setTone("dadPull", "sawtooth", 420, !m.over && m.pullUp && Math.floor(m.t * 5) % 2 === 0 ? 0.035 : 0);
  setTone("dadGun", "square", 58, !m.over && m.gunsFiring ? 0.02 : 0);
}

function dadShowCard() {
  const m = dad.m;
  m.card = true;
  const ov = dadEl("div", { id: "dadCard", class: "dadOverlay" });
  dad.dom.push(ov);
  const card = dadEl("div", { class: "dadCard " + (m.result === "success" ? "win" : "lose") }, ov);
  dadEl("div", { class: "dadKicker", text: "CANYON STRIKE" }, card);
  dadEl("h1", { text: m.result === "success" ? "Mission success" : "Mission failed" }, card);
  if (m.result !== "success") dadEl("p", { class: "dadWhy", text: m.why.charAt(0).toUpperCase() + m.why.slice(1) + "." }, card);
  const tbl = dadEl("dl", {}, card);
  const used = TUNE.dad.clock - m.clock;
  for (const [k, v] of [["Time", dadFmtClock(used) + (m.plant ? "" : " of " + dadFmtClock(TUNE.dad.clock))],
                        ["Damage", Math.round(TUNE.dad.health - m.health) + "%"],
                        ["Bombs used", m.bombsUsed + " (" + m.hits + " on the vent)"],
                        ["Flares used", String(m.flaresUsed)],
                        ["Guns destroyed", String(m.gunsKilled)]]) {
    dadEl("dt", { text: k }, tbl); dadEl("dd", { text: v }, tbl);
  }
  const row = dadEl("div", { class: "dadRow" }, card);
  const retry = dadEl("button", { class: "dadBtn go", text: "RETRY" }, row);
  const ex = dadEl("button", { class: "dadBtn", text: "EXIT" }, row);
  dadTap(retry, () => dadStart());
  dadTap(ex, () => dadExit());
}

// ---------------------------------------------------------------------------
// The buttons (declared in buttons.js): bomb, flare, missile, and the way out
// ---------------------------------------------------------------------------
function dadWire() {
  const k = document.getElementById("dadKey");
  if (k) dadTap(k, dadKeyTap);
  const map = { dadBombBtn: dadDropBomb, dadFlareBtn: dadFlare, dadMslBtn: dadFireMissile, dadExitBtn: dadExit };
  for (const id in map) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); if (typeof unlockAudio === "function") unlockAudio(); if (typeof pressFlash === "function") pressFlash(b); map[id](); });
  }
  window.addEventListener("keydown", e => {
    if (!dad.on || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyC") dadDropBomb();
    else if (e.code === "KeyX") dadFlare();
    else if (e.code === "KeyF") dadFireMissile();
  });
}
dadWire();
