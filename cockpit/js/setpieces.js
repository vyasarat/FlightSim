"use strict";
// ---------------------------------------------------------------------------
// Set-pieces: the big staged moments out in the world.
//
// Every one runs the same loop -- a giant obvious thing, one aim or one pulsing
// button, a visible wind-up, a huge payoff, and a free reset that comes round on
// its own within seconds. Nothing here can be failed: a miss just means turning
// round and going again, with no message and no sound of disapproval.
//
//   demolition   a fenced block of condemned towers with a reticle on one of
//                them. Put a missile into it and the block folds in a domino
//                chain, then stands itself back up.
//
// Only structures and machines are ever wrecked.
// ---------------------------------------------------------------------------

// ---- the big numeral. Shared by every set-piece that counts down: numbers are
// allowed in this game, words are not. Nothing is on screen unless a wind-up is
// actually running, so the HUD gains nothing permanent.
let bigNumShown = null;
function setBigNum(n) {
  const v = n === null || n === undefined ? "" : String(Math.max(0, Math.round(n)));
  if (v === bigNumShown) return;
  bigNumShown = v;
  el.bigNum.textContent = v;
  el.bigNum.classList.toggle("on", v !== "");
  if (v !== "") { el.bigNum.classList.remove("beat"); void el.bigNum.offsetWidth; el.bigNum.classList.add("beat"); }
}
// A countdown from `from` over `total` seconds, given how much is left. Returns
// the numeral it is showing so a caller can chirp on the change.
let lastTick = -1;
function countdownTo(left, from) {
  if (left <= 0) { setBigNum(null); lastTick = -1; return 0; }
  const n = Math.min(from, Math.max(1, Math.ceil(left)));
  setBigNum(n);
  if (n !== lastTick) { lastTick = n; synthBlip("triangle", 520, 520, 0.16, 0.16, 0); }
  return n;
}
function countdownClear() { setBigNum(null); lastTick = -1; }

// ===========================================================================
// DEMOLITION DISTRICT
// ===========================================================================
const DEMO = TUNE.demolition;
const demo = {
  g: null, x: 0, z: 0, base: 0,
  towers: [],          // { mesh, h, w, x, z, order, fold, down }
  beacons: [], beaconMat: null,
  reticle: null, reticleTower: null,
  phase: "armed",      // armed | charging | folding | down | rising
  t: 0, next: 0, folded: 0,
  clock: 0,            // its own clock: the pulse and the blink run off dt, not the wall clock
};

function buildDemolition() {
  const half = TUNE.routeLength / 2;
  const x = DEMO.x, z = half * DEMO.f;
  const g = new THREE.Group();
  g.userData.trackSolids = true;
  g.userData.pending = [];
  g.userData.name = "demolition";
  const concrete = 0x8f8a82, dark = 0x5d5952, board = 0x8a6a3a;

  // the fenced block: a low hoarding all the way round (not solid -- he flies in)
  const R = DEMO.blockR;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, a2 = (i + 1) / 24 * Math.PI * 2;
    const px = Math.cos(a) * R, pz = Math.sin(a) * R;
    const nx = Math.cos(a2) * R, nz = Math.sin(a2) * R;
    const mx = (px + nx) / 2, mz = (pz + nz) / 2;
    const len = Math.hypot(nx - px, nz - pz) + 0.4;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len, 3.2, 0.4), lam(i % 2 ? 0xffd23e : 0x2f3a48));
    panel.position.set(mx, 1.6, mz);
    panel.rotation.y = -Math.atan2(nz - pz, nx - px);
    g.add(panel);
  }
  // hazard beacons on the fence, all the way round
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffb43a, fog: false });
  demo.beaconMat = beaconMat;
  demo.beacons = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 6), lam(0xf2f4f7));
    post.position.set(Math.cos(a) * R, 3, Math.sin(a) * R); g.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), beaconMat);
    lamp.position.set(Math.cos(a) * R, 6.8, Math.sin(a) * R); g.add(lamp);
    demo.beacons.push(lamp);
  }

  // the condemned towers, ringed inside the fence. The tallest carries the reticle.
  demo.towers = [];
  let tallest = null;
  for (let i = 0; i < DEMO.towers; i++) {
    const a = i / DEMO.towers * Math.PI * 2 + 0.4;
    const rr = R * (i % 2 ? 0.34 : 0.66);
    const tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
    const h = DEMO.towerH[0] + hashSalt(i, 909, 3) * (DEMO.towerH[1] - DEMO.towerH[0]);
    const w = DEMO.towerW * (0.8 + hashSalt(i, 909, 5) * 0.5);
    const m = lmBox(g, w, h, w, i % 3 ? concrete : dark, tx, h / 2, tz, true);
    m.userData.noShatter = true;      // the fold is choreographed: a missile must not just delete it
    // boarded-up windows, so it reads as condemned rather than merely grey
    // boarded-up windows: bands standing slightly PROUD of the tower, or they sit
    // inside the box where nobody can see them
    for (let r = 1; r < Math.floor(h / 11); r++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 2.6, w * 1.04), lam(board));
      band.position.y = -h / 2 + r * 11;
      m.add(band);
    }
    demo.towers.push({ mesh: m, h, w, lx: tx, lz: tz, order: i, fold: 0, down: false });
    if (!tallest || h > tallest.h) tallest = demo.towers[demo.towers.length - 1];
  }
  // the domino order: the reticle tower first, then round the ring from it
  const t0 = tallest;
  demo.towers.sort((p, q) => {
    const ap = Math.atan2(p.lz - t0.lz, p.lx - t0.lx), aq = Math.atan2(q.lz - t0.lz, q.lx - t0.lx);
    return (p === t0 ? -1e9 : ap) - (q === t0 ? -1e9 : aq);
  });
  demo.towers.forEach((t, i) => { t.order = i; });
  demo.reticleTower = t0;

  // the reticle: a pulsing ring on the tallest tower, facing the route
  const ret = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(DEMO.reticleR, 1.3, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
  ret.add(ring);
  for (const [rx, ry] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(rx ? 6 : 1.4, ry ? 6 : 1.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
    tick.position.set(rx * (DEMO.reticleR + 3), ry * (DEMO.reticleR + 3), 0);
    ret.add(tick);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
  ret.add(dot);
  ret.position.set(t0.lx - t0.w / 2 - 1.5, t0.h * 0.62, t0.lz);
  ret.rotation.y = -Math.PI / 2;     // faces -x, the side the route runs down
  g.add(ret);
  demo.reticle = ret;

  addRouteLandmark(g, x, z, "demolition");
  castsAndReceives(g);
  demo.g = g; demo.x = x; demo.z = z; demo.base = g.position.y;
}

// Inside the fence the crash alarm is silenced: he is supposed to fly at these.
function demoAlarmMuted() {
  if (!demo.g) return false;
  return Math.hypot(state.x - demo.x, state.z - demo.z) < DEMO.alarmMuteRadius;
}

function demoTowerWorld(t) { return { x: demo.x + t.lx, y: demo.base, z: demo.z + t.lz }; }

// Set it off. Only ever called from a missile landing in the block.
function demoTrigger() {
  if (demo.phase !== "armed") return false;
  demo.phase = "charging";
  demo.t = DEMO.charge;
  demo.next = 0; demo.folded = 0;
  setTone("demo", "sawtooth", DEMO.rumbleFreq, DEMO.rumble);
  flags.demolitions = (flags.demolitions || 0) + 1;
  return true;
}

function demoFoldTower(t) {
  t.down = true;
  t.mesh.userData.noSolid = true;    // a folding tower is not a wall
  const w = demoTowerWorld(t);
  for (let i = 0; i < DEMO.dust; i++) {
    wakePuff(w.x + (rnd() - 0.5) * t.w * 3, w.y + rnd() * 8, w.z + (rnd() - 0.5) * t.w * 3,
      0xcfc7bb, 2.4, DEMO.dustRise, DEMO.dustLife);
  }
  noiseBurst(0.5, 90, 0.32, 0);
  deepPop();
  shakeAmp = Math.max(shakeAmp, clamp(1 - Math.hypot(w.x - state.x, w.z - state.z) / 900, 0.05, 0.5));
  flags.demoTowersFolded = (flags.demoTowersFolded || 0) + 1;
}

function demoReset() {
  demo.phase = "armed";
  demo.t = 0; demo.next = 0; demo.folded = 0;
  for (const t of demo.towers) {
    t.fold = 0; t.down = false;
    t.mesh.scale.set(1, 1, 1);
    t.mesh.rotation.set(0, 0, 0);
    t.mesh.position.y = t.h / 2;
    t.mesh.visible = true;
    t.mesh.userData.noSolid = false;
  }
  if (demo.reticle) demo.reticle.visible = true;
  setTone("demo", "sawtooth", DEMO.rumbleFreq, 0);
}

function updateDemolition(dt) {
  if (!demo.g || !demo.g.visible) {
    // far away: keep the clock running so it is always ready when he comes back
    if (demo.phase !== "armed") { demo.t -= dt; if (demo.t <= 0 && demo.phase !== "folding") demoReset(); }
    return;
  }
  demo.clock += dt;
  const now = demo.clock;
  // hazard beacons: a steady blink, hurrying through the wind-up
  const rate = demo.phase === "charging" ? DEMO.beaconFast : DEMO.beaconRate;
  const on = Math.sin(now * rate * Math.PI) > -0.1;
  if (demo.beaconMat) demo.beaconMat.color.setHex(on ? 0xffb43a : 0x4a3a18);

  if (demo.phase === "armed") {
    // the reticle pulses: the one thing to aim at
    const p = 1 + Math.sin(now * DEMO.reticleRate) * 0.14;
    demo.reticle.scale.setScalar(p);
    // a missile anywhere in the block sets it off -- he does not have to hit the ring
    for (const m of missiles) {
      if (!m.alive) continue;
      for (const t of demo.towers) {
        const w = demoTowerWorld(t);
        if (Math.hypot(m.x - w.x, m.z - w.z) < DEMO.hitR && m.y < w.y + t.h + 30) { demoTrigger(); break; }
      }
      if (demo.phase !== "armed") break;
    }
    return;
  }

  if (demo.phase === "charging") {
    demo.t -= dt;
    countdownTo(demo.t, 3);
    // dust already lifting off the bases, and the rumble climbing
    if (rnd() < dt * 9) {
      const t = demo.towers[Math.floor(rnd() * demo.towers.length)], w = demoTowerWorld(t);
      wakePuff(w.x + (rnd() - 0.5) * t.w * 2, w.y + 1, w.z + (rnd() - 0.5) * t.w * 2, 0xcfc7bb, 1.6, 3, 1.6);
    }
    setTone("demo", "sawtooth", DEMO.rumbleFreq, DEMO.rumble * (1 - demo.t / DEMO.charge));
    if (demo.t <= 0) {
      countdownClear();
      demo.phase = "folding";
      demo.next = 0; demo.folded = 0;
      demo.reticle.visible = false;
    }
    return;
  }

  if (demo.phase === "folding") {
    // the domino: one tower starts every foldDelay, each taking foldTime to go
    demo.next -= dt;
    if (demo.next <= 0 && demo.folded < demo.towers.length) {
      demoFoldTower(demo.towers[demo.folded]);
      demo.folded++;
      demo.next = DEMO.foldDelay;
    }
    let allDown = true;
    for (const t of demo.towers) {
      if (!t.down) { allDown = false; continue; }
      if (t.fold < 1) {
        t.fold = Math.min(1, t.fold + dt / DEMO.foldTime);
        const k = t.fold * t.fold * (3 - 2 * t.fold);              // ease: it lets go, then goes
        t.mesh.scale.y = 1 - k * 0.94;
        t.mesh.position.y = t.h / 2 * t.mesh.scale.y;
        t.mesh.rotation.z = Math.sin(t.order * 2.1) * 0.12 * k;    // a little lean, each its own way
        t.mesh.rotation.x = Math.cos(t.order * 1.7) * 0.12 * k;
        allDown = false;
      }
    }
    setTone("demo", "sawtooth", DEMO.rumbleFreq, DEMO.rumble * 0.7);
    if (allDown && demo.folded >= demo.towers.length) {
      demo.phase = "down";
      demo.t = DEMO.rebuild;
      setTone("demo", "sawtooth", DEMO.rumbleFreq, 0);
      chirp();
    }
    return;
  }

  if (demo.phase === "down") {
    demo.t -= dt;
    if (demo.t <= 0) { demo.phase = "rising"; demo.t = DEMO.riseTime; chime(); }
    return;
  }

  if (demo.phase === "rising") {
    // it puts itself back up, and the reticle is pulsing again: go round and do it once more
    demo.t -= dt;
    const k = clamp(1 - demo.t / DEMO.riseTime, 0, 1);
    for (const t of demo.towers) {
      t.mesh.scale.y = 0.06 + k * 0.94;
      t.mesh.position.y = t.h / 2 * t.mesh.scale.y;
      t.mesh.rotation.z *= 1 - k;
      t.mesh.rotation.x *= 1 - k;
    }
    if (demo.t <= 0) { demoReset(); flags.demoRebuilds = (flags.demoRebuilds || 0) + 1; }
    return;
  }
}

// ===========================================================================
// BOOSTER TOWER-CATCH
//
// The tower and its arms already existed; this is the theatre around them. The
// booster flies itself home, so the wind-up is what makes it a moment: the arms
// swing wide, the catch zone lights up, big numerals count it down, and the
// clunk lands with the engines cutting out. Then it hangs there swaying while
// the tower lights sweep and the boats sound off.
// ===========================================================================
const TC = TUNE.towerCatch;
const tcQ = new THREE.Quaternion(), tcE = new THREE.Euler();
const tcatch = {
  hanging: null,      // the caught booster's mesh, once it is up there
  sway: 0, swayT: 0,
  sweep: 0,
  hornT: 0,
  glowT: 0,
  counting: false,
};

function towerRec() { return typeof airports === "undefined" ? null : airports.find(r => r.idx === state.originIdx); }

// The booster on its way to the arms, if there is one. Drives the wind-up.
function towerCatchInbound() {
  if (typeof fallingStages === "undefined") return null;
  for (const s of fallingStages) {
    if (s.kind !== "booster" || s.landed || !s.target || !s.target.catch) continue;
    if (s.y - s.target.y > TC.inboundAlt) continue;
    return s;
  }
  return null;
}

function towerCatchCaught(s) {
  const a = towerRec();
  if (a) a.catchClosed = true;
  tcatch.hanging = s.mesh;
  tcatch.sway = TC.swayAmp;
  tcatch.swayT = 0;
  tcatch.sweep = TC.sweepTime;
  tcatch.hornT = TC.hornDelay;
  tcatch.counting = false;
  countdownClear();
  if (s.glow) { s.glow.visible = false; }        // engines cut the instant the arms take it
  // the clunk: heavy, warm, and all at once
  clang();
  deepPop();
  noiseBurst(0.35, 120, 0.4, 0);
  shakeAmp = Math.max(shakeAmp, 0.5);
  flags.boosterCatches = (flags.boosterCatches || 0) + 1;
}

// A new launch: the arms let go of whatever they are holding and it is taken away,
// so the old booster and the new one can never both be on the tower at once.
function towerCatchClear() {
  const a = towerRec();
  if (a) a.catchClosed = false;
  if (tcatch.hanging && typeof fallingStages !== "undefined") {
    for (let i = fallingStages.length - 1; i >= 0; i--) {
      if (fallingStages[i].mesh === tcatch.hanging) { scene.remove(fallingStages[i].mesh); fallingStages.splice(i, 1); }
    }
    if (tcatch.hanging.parent) scene.remove(tcatch.hanging);
    flags.catchCleared = (flags.catchCleared || 0) + 1;
  }
  tcatch.hanging = null; tcatch.sway = 0; tcatch.sweep = 0; tcatch.hornT = 0;
  tcatch.counting = false;
  countdownClear();
}

function towerCatchMissed() {
  const a = towerRec();
  if (a) a.catchClosed = false;
  tcatch.counting = false;
  countdownClear();
}

// A little engine glow under the descending booster, so there is something to cut.
function towerCatchGlow(s) {
  if (!s.glow) {
    const g = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5.5, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb43a, transparent: true, opacity: 0.9, fog: false }));
    g.rotation.x = Math.PI / 2;  // the booster's local +z is down when it is upright
    s.mesh.add(g);
    g.position.set(0, 0, (s.mesh.userData.baseZ || 7.6) + 2.6);
    s.glow = g;
  }
  s.glow.visible = true;
  const k = 0.7 + rnd() * 0.5;
  s.glow.scale.set(k, 1 + (-s.vy) * 0.02, k);
}

function updateTowerCatch(dt) {
  const a = towerRec();
  if (!a || !a.catchArms) return;
  const inbound = towerCatchInbound();

  // ---- the wind-up: the zone lights up and the numerals run it down
  if (a.catchZone) {
    const want = inbound ? 0.3 : 0;
    tcatch.glowT += (want - tcatch.glowT) * Math.min(1, 3 * dt);
    a.catchZone.visible = tcatch.glowT > 0.01;
    if (a.catchZone.visible) {
      a.catchZone.material.opacity = tcatch.glowT * (0.75 + 0.25 * Math.sin(performance.now() * 0.006));
    }
  }
  if (inbound) {
    towerCatchGlow(inbound);
    // altitude above the arms, mapped onto the count. Closing speed makes it a
    // real countdown rather than a number that stalls while it hovers across.
    const gap = inbound.y - inbound.target.y;
    const closing = Math.max(-inbound.vy, 4);
    countdownTo(Math.min(TC.countFrom, gap / closing), TC.countFrom);
    tcatch.counting = true;
  } else if (tcatch.counting) {
    tcatch.counting = false;
    countdownClear();
  }

  // ---- caught: it hangs there swaying, the tower sweeps, the boats sound off
  if (tcatch.hanging) {
    if (tcatch.sway > 0.0005) {
      tcatch.swayT += dt;
      tcatch.sway *= 1 - Math.min(1, TC.swayDamp * dt);
      // The rock goes ON TOP of the upright quaternion. Writing .rotation here
      // would throw that away and leave it lying on its side across the arms.
      tcE.set(Math.cos(tcatch.swayT * TC.swayRate * 0.8) * tcatch.sway * 0.6, 0,
              Math.sin(tcatch.swayT * TC.swayRate) * tcatch.sway);
      tcQ.setFromEuler(tcE);
      tcatch.hanging.quaternion.copy(tcQ).multiply(Q_UPRIGHT);
    }
    if (tcatch.hornT > 0) { tcatch.hornT -= dt; if (tcatch.hornT <= 0) boatHorn(); }
  }
  if (tcatch.sweep > 0 && a.catchLights && a.catchLights.length) {
    tcatch.sweep -= dt;
    const n = a.catchLights.length;
    const head = ((TC.sweepTime - tcatch.sweep) * TC.sweepRate * n) % (n * 1.6);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - head);
      a.catchLights[i].material.color.setHex(d < 1.6 ? 0xfff2b0 : 0x2a2f38);
    }
    if (tcatch.sweep <= 0) for (const lt of a.catchLights) lt.material.color.setHex(0x2a2f38);
  }
}

// A fresh stack on the pad resets the show, but deliberately leaves a caught
// booster hanging: it stays up there as the trophy it is until the next T-0, and
// towerCatchClear takes it away then. Nulling it here orphaned it on the arms,
// and the next catch arrived on top of it.
function towerCatchReset() {
  tcatch.sway = 0; tcatch.sweep = 0; tcatch.hornT = 0;
  tcatch.glowT = 0; tcatch.counting = false;
  const a = towerRec();
  if (a && a.catchZone) { a.catchZone.visible = false; }
  if (a && a.catchLights) for (const lt of a.catchLights) lt.material.color.setHex(0x2a2f38);
  countdownClear();
}

// ===========================================================================
// FIREFIGHTING HELICOPTER
//
// A derelict rig burns out on the water -- nobody aboard, ever -- under a smoke
// column you can see from the coast. Fly the helicopter low over open water and
// one button pulses: SCOOP. Over the fire the same button becomes DROP. Three
// sheets of water put it out; it relights itself a while later, announced by a
// glow, so there is always another one to go and do.
// ===========================================================================
const FF = TUNE.firefight;

// A puff pool of its own: water, steam and smoke would drain the shared one.
const FF_MATS = [0x9fd8ff, 0xf2f4f7, 0x6b7078, 0xffb43a].map(c => new THREE.MeshLambertMaterial({ color: c }));
const ffPuffs = [];
for (let i = 0; i < 96; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), FF_MATS[0]);
  m.visible = false; scene.add(m);
  ffPuffs.push({ mesh: m, life: 0, max: 1, size: 1, vy: 0, vx: 0, vz: 0, grow: 0 });
}
let ffNext = 0;
function ffPuff(x, y, z, ci, size, vy, life, grow, vx, vz) {
  const p = ffPuffs[ffNext++ % ffPuffs.length];
  p.life = p.max = life; p.size = size; p.vy = vy; p.grow = grow || 0;
  p.vx = vx || 0; p.vz = vz || 0;
  p.mesh.material = FF_MATS[ci];
  p.mesh.position.set(x, y, z);
  p.mesh.scale.setScalar(size);
  p.mesh.visible = true;
}
function ffPuffsUpdate(dt) {
  for (const p of ffPuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    p.mesh.scale.setScalar(p.size + p.grow * (1 - p.life / p.max));
  }
}
function ffPuffsClear() { for (const p of ffPuffs) { p.life = 0; p.mesh.visible = false; } }

const fire = {
  g: null, x: 0, z: 0, deck: 0,
  flames: [], flameMat: null, glow: null, radar: null,
  smoke: [], smokeT: 0,
  level: 1,            // 1 burning, 0 out -- derived from `dropped`, never accumulated
  dropped: 0,          // how many sheets have landed on it (three puts it out)
  relightT: 0, glowT: 0,
  clock: 0,
};
const bucket = { g: null, state: "empty", anim: 0, drops: 0 };

function buildFireRig() {
  const g = new THREE.Group();
  const x = FF.rig.x, z = FF.rig.z;
  const w = TUNE.waterLevel, deck = w + FF.legH;
  const steel = 0xd87a3a, dark = 0x3c4350, pale = 0xb8bec8;
  // four legs standing out of the sea, a platform, a derrick and a flare stack
  for (const [lx, lz] of [[-16, -22], [16, -22], [-16, 22], [16, 22]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, FF.legH + 8, 8), lam(dark));
    leg.position.set(x + lx, w + FF.legH / 2 - 4, z + lz); g.add(leg);
  }
  const plat = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 60), lam(steel));
  plat.position.set(x, deck, z); g.add(plat);
  addSolidBox(x, deck - 2, z, 23, 30, deck + 2, plat);
  const block = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 18), lam(pale));
  block.position.set(x, deck + 8, z + 18); g.add(block);
  addSolidBox(x, deck + 2, z + 18, 10, 9, deck + 14, block);
  // the derrick over the middle: the thing that is on fire
  for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 30, 6), lam(dark));
    l.position.set(x + dx * 0.6, deck + 17, z + dz * 0.6 - 8);
    l.rotation.set(dz * 0.012, 0, -dx * 0.012);
    g.add(l);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 12), lam(0xb5522e));
  tank.position.set(x - 14, deck + 6.5, z - 20); g.add(tank);

  // the flames: cartoon orange, flickering, and fewer as it goes out
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false });
  fire.flameMat = flameMat;
  fire.flames = [];
  for (let i = 0; i < FF.flames; i++) {
    const a = i / FF.flames * Math.PI * 2;
    const r = 4 + (i % 3) * 6;
    const f = new THREE.Mesh(new THREE.ConeGeometry(4.5, FF.flameH, 7), flameMat);
    f.position.set(x + Math.cos(a) * r, deck + FF.flameH / 2 + 2, z + Math.sin(a) * r - 6);
    g.add(f);
    fire.flames.push({ mesh: f, baseY: f.position.y, phase: i * 1.7 });
  }
  // the smoke column: its own meshes, unfogged, so it reads from the coast
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x3c4350, transparent: true, opacity: 0.85, fog: false });
  fire.smoke = [];
  for (let i = 0; i < FF.smokePuffs; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), smokeMat);
    m.visible = false; g.add(m);
    fire.smoke.push({ mesh: m, t: i / FF.smokePuffs, k: 0.7 + hashSalt(i, 411, 2) * 0.7 });
  }
  scene.add(g);
  castsShadow(g);
  // a radar that turns, so the rig is never quite still even before he arrives
  {
    const rmast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 6), new THREE.MeshLambertMaterial({ color: TUNE.palette.steel }));
    rmast.position.set(10, deck + 4.5, -10); g.add(rmast);
    const rdish = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 2), new THREE.MeshLambertMaterial({ color: TUNE.palette.white }));
    rdish.position.set(10, deck + 9.5, -10); g.add(rdish);
    fire.radar = rdish;
  }
  // one big additive glow over the whole blaze: it is what makes it read as fire
  // from a mile out rather than as orange cones
  const fglow = glowSprite(TUNE.sky.fireGlowColor, TUNE.sky.fireGlowSize, 0);
  fglow.position.set(0, deck + 18, 0);
  g.add(fglow);
  fire.glow = fglow;
  fire.g = g; fire.x = x; fire.z = z; fire.deck = deck;
}

function buildBucket() {
  const g = new THREE.Group();
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, FF.bucketDrop, 5), lam(0x2f3a48));
  line.position.y = -FF.bucketDrop / 2; g.add(line);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.7, 3.2, 12), lam(0xf2f4f7));
  b.position.y = -FF.bucketDrop - 1.6; g.add(b);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.6, 2.4, 12), lam(0x2b8fd8));
  water.position.y = -FF.bucketDrop - 1.9; g.add(water);
  g.visible = false;
  scene.add(g);
  bucket.g = g; bucket.water = water;
}

function fireOverWater() {
  return terrainEff(state.x, state.z) < TUNE.waterLevel - 1;
}
function fireAgl() { return state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel); }
function fireNear() { return Math.hypot(state.x - fire.x, state.z - fire.z); }
function isHeli() { return !!(state.vp && state.vp.heli); }
function bucketCanScoop() {
  return isHeli() && state.phase === "AIRBORNE" && !state.exploding &&
    bucket.state === "empty" && fireOverWater() && fireAgl() < FF.scoopAlt;
}
function bucketCanDrop() {
  return isHeli() && state.phase === "AIRBORNE" && !state.exploding &&
    bucket.state === "full" && fire.level > 0 && fireNear() < FF.dropR;
}

function bucketPress() {
  if (bucketCanScoop()) {
    bucket.state = "filling"; bucket.anim = 0;
    noiseBurst(0.5, 320, 0.22, 0);           // the slosh, never a siren
    flags.ffScoops = (flags.ffScoops || 0) + 1;
    return true;
  }
  if (bucketCanDrop()) {
    bucket.state = "empty"; bucket.anim = 0;
    fireDropWater();
    return true;
  }
  return false;
}

function fireDropWater() {
  // the sheet: a wall of water falling from him onto the fire
  for (let i = 0; i < FF.sheet; i++) {
    ffPuff(state.x + (rnd() - 0.5) * 26, state.y - 4 - rnd() * 10, state.z + (rnd() - 0.5) * 26,
      0, 2.6 + rnd() * 2, -FF.sheetFall, FF.sheetLife, 5);
  }
  whoosh();
  // counted, not subtracted: three thirds of a float never quite reaches zero
  fire.dropped = Math.min(FF.drops, fire.dropped + 1);
  fire.level = 1 - fire.dropped / FF.drops;
  flags.ffDrops = (flags.ffDrops || 0) + 1;
  // steam where it lands, and a hiss
  for (let i = 0; i < FF.steam; i++) {
    ffPuff(fire.x + (rnd() - 0.5) * 34, fire.deck + 4 + rnd() * 14, fire.z + (rnd() - 0.5) * 34,
      1, 3 + rnd() * 3, FF.steamRise, FF.steamLife, 9);
  }
  noiseBurst(0.9, 1500, 0.2, 0.1);           // the hiss
  if (fire.dropped >= FF.drops) {
    fire.relightT = FF.relight;
    chime(); fanfare(); confettiBurst();
    flags.ffPutOut = (flags.ffPutOut || 0) + 1;
  } else {
    chirp();
  }
}

function fireReset() {
  fire.level = 1; fire.dropped = 0; fire.relightT = 0; fire.glowT = 0;
  bucket.state = "empty"; bucket.anim = 0;
  if (bucket.g) bucket.g.visible = false;
  ffPuffsClear();
}

function updateFirefight(dt) {
  if (!fire.g) return;
  ffPuffsUpdate(dt);
  fire.clock += dt;
  if (fire.radar) fire.radar.rotation.y += dt * TUNE.ambient.radarRpm * 0.105;

  // ---- the fire itself: flames flicker, and there are fewer of them as it goes out
  const lit = fire.level > 0;
  const lvl = fire.level;
  if (fire.glow) {
    const want = (lit ? TUNE.sky.fireGlowOpacity * (0.55 + 0.45 * lvl) : 0) * (0.85 + 0.15 * Math.sin(fire.clock * 5.5));
    fire.glow.material.opacity += (want - fire.glow.material.opacity) * Math.min(1, 4 * dt);
    fire.glow.visible = fire.glow.material.opacity > 0.006;
    fire.glow.scale.setScalar(TUNE.sky.fireGlowSize * (0.5 + 0.5 * lvl) * (0.95 + 0.05 * Math.sin(fire.clock * 3.1)));
  }
  for (let i = 0; i < fire.flames.length; i++) {
    const f = fire.flames[i];
    const on = lit && i < Math.ceil(fire.flames.length * lvl);
    f.mesh.visible = on || fire.glowT > 0;
    if (!f.mesh.visible) continue;
    const k = 0.75 + 0.25 * Math.sin(fire.clock * FF.flicker + f.phase);
    const g = fire.glowT > 0 ? 0.25 + 0.75 * (1 - fire.glowT / FF.relightGlow) : 1;
    f.mesh.scale.set(k * g, (0.6 + 0.6 * lvl) * k * g, k * g);
    f.mesh.position.y = f.baseY - FF.flameH * (1 - (0.6 + 0.6 * lvl) * k * g) / 2;
  }
  if (fire.flameMat) fire.flameMat.color.setHex(fire.glowT > 0 ? 0xff5a1a : 0xff7a1a);

  // ---- the column. It only climbs while it is burning, and thins as it dies.
  fire.smokeT += dt;
  for (const p of fire.smoke) {
    p.t += dt / (FF.smokeH / FF.smokeRise);
    if (p.t >= 1) { p.t -= 1; }
    const up = p.t * FF.smokeH;
    const vis = lit && p.t < 0.02 + lvl;
    p.mesh.visible = vis;
    if (!vis) continue;
    p.mesh.position.set(fire.x + Math.sin(p.t * 6 + fire.clock * 0.3) * (6 + up * 0.09),
      fire.deck + 10 + up,
      fire.z + Math.cos(p.t * 5 + fire.clock * 0.25) * (6 + up * 0.07));
    p.mesh.scale.setScalar(FF.smokeSize * p.k * (0.35 + p.t * 1.1) * (0.4 + 0.6 * lvl));
  }

  // ---- out: it relights itself, and says so first
  if (!lit) {
    if (fire.relightT > 0) {
      fire.relightT -= dt;
      if (fire.relightT <= 0) { fire.glowT = FF.relightGlow; synthBlip("sine", 150, 260, 1.2, 0.16, 0); }
    } else if (fire.glowT > 0) {
      fire.glowT -= dt;
      if (rnd() < dt * 6) ffPuff(fire.x + (rnd() - 0.5) * 20, fire.deck + 6, fire.z + (rnd() - 0.5) * 20, 3, 2, 6, 1.2, 3);
      if (fire.glowT <= 0) { fire.dropped = 0; fire.level = 1; whoosh(); flags.ffRelights = (flags.ffRelights || 0) + 1; }
    }
  }

  // ---- the bucket and its one button
  if (!isHeli()) { if (bucket.g) bucket.g.visible = false; el.bucketBtn.classList.add("hidden"); return; }
  if (!bucket.g) buildBucket();
  if (bucket.state === "filling") {
    bucket.anim += dt / FF.scoopTime;
    if (rnd() < dt * 10) ffPuff(state.x + (rnd() - 0.5) * 6, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + 1, state.z + (rnd() - 0.5) * 6, 1, 1.6, 4, 0.8, 2);
    if (bucket.anim >= 1) { bucket.state = "full"; bucket.anim = 1; chirp(); }
  }
  const showBucket = bucket.state !== "empty";
  bucket.g.visible = showBucket && !state.exploding;
  if (bucket.g.visible) {
    bucket.g.position.set(state.x, state.y, state.z);
    bucket.water.visible = bucket.state === "full";
    const sway = Math.sin(fire.clock * 1.8) * 0.06;
    bucket.g.rotation.z = sway;
  }
  const scoop = bucketCanScoop(), drop = bucketCanDrop();
  el.bucketBtn.classList.toggle("hidden", !(scoop || drop));
  const mode = drop ? "drop" : "scoop";
  if (el.bucketBtn.dataset.mode !== mode) el.bucketBtn.dataset.mode = mode;
}

// ===========================================================================
// AIRCRAFT CARRIER
//
// A grey slab of a ship off the California coast, with a deck crew who wave and
// to whom nothing can ever happen. Come in low along the deck and the hook takes
// a wire: a violent stop, and a cheer. Miss and you simply fly off the angled
// deck and come round again -- there is nothing to fail. Parked, one button
// pulses: the catapult counts down and throws you off the bow.
//
// The deck is deliberately NOT a solid: the trap is generous enough that he lands
// on it, and nothing about a near miss should ever be an explosion.
// ===========================================================================
const CV = TUNE.carrier;
const carrier = {
  g: null, x: 0, z: 0, deck: 0,
  state: "none",        // none | arrest | parked | count | shove
  t: 0, along: 0, speed: 0,
  crew: [], catMat: null, cat2Mat: null,
  ai: [], aiT: 0,
  clock: 0,
};
const cvTmp = new THREE.Vector3();

// carrier-local coordinates: +z along the deck toward the bow, +x to starboard
function carrierLocal(x, z) { return { s: x - carrier.x, f: z - carrier.z }; }

function buildCarrier() {
  const g = new THREE.Group();
  const x = CV.at.x, z = CV.at.z, w = TUNE.waterLevel;
  const grey = 0x6d747d, dark = 0x3c4350, pale = 0x9a9ea6;
  const deck = w + CV.deckY;
  // hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(CV.hullW, CV.deckY + 10, CV.deckL - 26), lam(dark));
  hull.position.set(x, w + CV.deckY / 2 - 5, z); g.add(hull);
  // (no bow cone: it only ever poked out under the hull line -- the deck's own
  // overhang past the hull reads as the bow perfectly well)
  // flight deck
  const fd = new THREE.Mesh(new THREE.BoxGeometry(CV.deckW, 3, CV.deckL), lam(grey));
  fd.position.set(x, deck - 1.5, z); g.add(fd);
  // the angled landing strip, and its wires
  // bow at -z: he lands toward it, and the catapults throw him off it the same way,
  // so the landing strip is aft and the catapults are forward
  const strip = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, CV.deckL * 0.62), lam(0x4a505a));
  strip.position.set(x - 8, deck + 0.3, z + 42);
  strip.rotation.y = CV.angleDeg * DEG; g.add(strip);
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(19, 0.2, 0.7), lam(0xf2f4f7));
    line.position.set(0, 0.35, -CV.deckL * 0.2 + i * 11); strip.add(line);
  }
  for (let i = 0; i < 4; i++) {   // arrestor wires
    const wire = new THREE.Mesh(new THREE.BoxGeometry(19, 0.35, 0.35), lam(0x1f2328));
    wire.position.set(0, 0.7, -CV.deckL * 0.06 + i * 9); strip.add(wire);
  }
  // the two catapults, forward, each with its own light
  const catMat = new THREE.MeshBasicMaterial({ color: 0x2a2f38, fog: false });
  const cat2Mat = new THREE.MeshBasicMaterial({ color: 0x2a2f38, fog: false });
  carrier.catMat = catMat; carrier.cat2Mat = cat2Mat;
  for (const [cx, mat] of [[CV.catX, catMat], [CV.cat2X, cat2Mat]]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 150), lam(0x4a505a));
    track.position.set(x + cx, deck + 0.3, z - CV.catZ - 20); g.add(track);
    for (let i = 0; i < 7; i++) {
      const lt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), mat);
      lt.position.set(x + cx, deck + 0.7, z - CV.catZ - 86 + i * 22); g.add(lt);
    }
  }
  // the island, to starboard, with a mast and a dish
  const isl = new THREE.Mesh(new THREE.BoxGeometry(13, 22, 40), lam(pale));
  isl.position.set(x + CV.deckW / 2 - 8, deck + 11, z + 16); g.add(isl);
  addSolidBox(x + CV.deckW / 2 - 8, deck, z + 16, 6.5, 20, deck + 22, isl);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 26, 6), lam(0xf2f4f7));
  mast.position.set(x + CV.deckW / 2 - 8, deck + 34, z + 10); g.add(mast);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 3), lam(0xf2f4f7));
  dish.position.set(x + CV.deckW / 2 - 8, deck + 26, z + 22); g.add(dish);
  carrier.dish = dish;
  // a flag at the masthead: the one place on the ship where the wind is visible
  {
    const fl = registerFlag(makeFlag(11, 6.5, TUNE.palette.red));
    fl.position.set(x + CV.deckW / 2 - 8 + 5.6, deck + 44, z + 10);
    g.add(fl);
    carrier.flag = fl;
  }
  // parked jets along the starboard edge, and a helicopter aft
  for (let i = 0; i < CV.jets; i++) {
    const j = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 11, 8), lam(0x6b7280)); body.rotation.x = Math.PI / 2; j.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3), lam(0x6b7280)); j.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 2.4), lam(0xe0483e)); tail.position.set(0, 1.8, -4.4); j.add(tail);
    j.position.set(x + CV.deckW / 2 - 16, deck + 1.6, z + 62 + i * 17);
    j.rotation.y = 0.5; g.add(j);
  }
  {
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), lam(0x20a39e)); h.add(body);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 9), lam(0x20a39e)); boom.position.z = -5; h.add(boom);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.25, 1), lam(0x1f2328)); rotor.position.y = 2.8; h.add(rotor);
    h.position.set(x - CV.deckW / 2 + 14, deck + 3, z + CV.deckL / 2 - 40); g.add(h);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.5, 6, 22), lam(0xffd23e));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x - CV.deckW / 2 + 14, deck + 0.5, z + CV.deckL / 2 - 40); g.add(ring);
  }
  // the deck crew: they wave, they are never solid, and nothing can ever happen
  // to them -- they stand well clear of the strip and the catapults.
  carrier.crew = [];
  const jackets = [0xffd23e, 0x36c46a, 0xe0483e, 0x5ff1ff, 0xf2f4f7];
  for (let i = 0; i < CV.crew; i++) {
    const c = new THREE.Group();
    const sx = i % 2 ? 1 : -1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 6), lam(jackets[i % jackets.length])); body.position.y = 1.1; c.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lam(0xf1c9a5)); head.position.y = 2.5; c.add(head);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.6, 0.28), lam(jackets[i % jackets.length]));
    arm.position.set(sx * 0.6, 2.0, 0); c.add(arm);
    c.position.set(x + sx * (CV.deckW / 2 - 5), deck + 1.6, z - CV.deckL / 2 + 24 + i * 21);
    c.userData.noShatter = true;
    g.add(c);
    carrier.crew.push({ g: c, arm, phase: i * 0.9, sx });
  }
  scene.add(g);
  castsAndReceives(g);   // the deck takes the shadow of the island and of him
  carrier.g = g; carrier.x = x; carrier.z = z; carrier.deck = deck;
}

function carrierNear() { return Math.hypot(state.x - carrier.x, state.z - carrier.z); }
function carrierAlarmMuted() {
  return !!carrier.g && carrierNear() < CV.alarmMuteRadius;
}
function carrierOnDeck() { return carrier.state !== "none"; }
function carrierCanLaunch() { return carrier.state === "parked"; }

// The trap. Low along the deck, roughly the right way round, and it takes a wire.
function carrierTryTrap() {
  if (carrier.state !== "none") return false;
  if (!state.vp || state.vp.rocket) return false;
  if (state.phase !== "AIRBORNE" || state.exploding) return false;
  const L = carrierLocal(state.x, state.z);
  if (Math.abs(L.s) > CV.deckW / 2 || Math.abs(L.f) > CV.deckL / 2) return false;
  const agl = state.y - carrier.deck;
  if (agl < -6 || agl > CV.trapAlt) return false;
  if (Math.abs(wrapPi(state.heading)) > CV.trapHeadingDeg * DEG) return false;   // deck runs along +z... he flies -z
  return true;
}

function carrierTrap() {
  carrier.state = "arrest";
  carrier.t = 0;
  carrier.speed = Math.max(state.speed, 20);
  cheer();
  clang();
  shakeAmp = Math.max(shakeAmp, 0.55);
  flags.carrierTraps = (flags.carrierTraps || 0) + 1;
}

function carrierLaunchPress() {
  if (!carrierCanLaunch()) return false;
  carrier.state = "count";
  carrier.t = CV.countFrom;
  flags.carrierLaunches = (flags.carrierLaunches || 0) + 1;
  return true;
}

function carrierShove() {
  carrier.state = "shove";
  carrier.t = 0;
  countdownClear();
  // the steam, the bang and the shove
  for (let i = 0; i < CV.steam; i++) {
    ffPuff(state.x + (rnd() - 0.5) * 14, carrier.deck + 1 + rnd() * 5, state.z - 8 - rnd() * 24,
      1, 3 + rnd() * 3, 9, CV.steamLife, 8);
  }
  noiseBurst(0.55, 240, 0.35, 0);
  whoosh();
  shakeAmp = Math.max(shakeAmp, 0.75);
}

function carrierReset() {
  carrier.state = "none"; carrier.t = 0;
  countdownClear();
  if (el.catBtn) el.catBtn.classList.add("hidden");
}

// Runs late, after the flight model, so the deck actually holds him.
function carrierLate(dt) {
  if (carrier.state === "none") return;
  const dirZ = -1;                       // he lands and launches flying -z along the deck
  if (carrier.state === "arrest") {
    carrier.t += dt;
    const k = clamp(carrier.t / CV.arrestTime, 0, 1);
    const v = carrier.speed * (1 - k) * (1 - k);
    state.z += dirZ * v * dt;
    state.speed = v;
    state.pitch += (0 - state.pitch) * Math.min(1, 8 * dt);
    state.bank += (0 - state.bank) * Math.min(1, 8 * dt);
    state.y = carrier.deck + TUNE.gearHeight;
    if (k >= 1) { carrier.state = "parked"; state.speed = 0; }
    return;
  }
  if (carrier.state === "parked" || carrier.state === "count") {
    state.speed = 0;
    state.y = carrier.deck + TUNE.gearHeight;
    // he is drawn onto the catapult, so the green light is under him and the shove
    // starts from the right end of the deck -- nothing to line up
    const tx = carrier.x + CV.catX, tz = carrier.z - CV.catZ;
    state.x += (tx - state.x) * Math.min(1, 1.4 * dt);
    state.z += (tz - state.z) * Math.min(1, 1.4 * dt);
    state.pitch += (0 - state.pitch) * Math.min(1, 6 * dt);
    state.bank += (0 - state.bank) * Math.min(1, 6 * dt);
    state.heading += wrapPi(0 - state.heading) * Math.min(1, 3 * dt);
    if (carrier.state === "count") {
      carrier.t -= dt;
      countdownTo(carrier.t, CV.countFrom);
      if (carrier.t <= 0) carrierShove();
    }
    return;
  }
  if (carrier.state === "shove") {
    carrier.t += dt;
    const k = clamp(carrier.t / CV.shoveTime, 0, 1);
    state.speed = CV.shoveSpeed * (0.25 + 0.75 * k);
    state.y = carrier.deck + TUNE.gearHeight + k * 6;
    state.pitch = k * 9;
    state.z += dirZ * state.speed * dt;
    if (rnd() < dt * 30) ffPuff(state.x + (rnd() - 0.5) * 10, carrier.deck + 2, state.z + 10, 1, 2.5, 7, 1.1, 5);
    if (k >= 1) { carrier.state = "none"; flags.carrierShoves = (flags.carrierShoves || 0) + 1; }
    return;
  }
}

function updateCarrier(dt) {
  if (!carrier.g) return;
  carrier.clock += dt;
  if (carrier.dish) carrier.dish.rotation.y += dt * 0.7;
  // the crew wave, for ever, and nothing ever happens to them
  for (const c of carrier.crew) {
    c.arm.rotation.z = c.sx * (0.5 + 0.5 * Math.sin(carrier.clock * CV.crewWave + c.phase));
  }
  // catapult 1: lit when he is parked on it, strobing through the count
  const ready = carrier.state === "parked";
  const counting = carrier.state === "count";
  carrier.catMat.color.setHex(counting ? (Math.floor(carrier.clock * 9) % 2 ? 0xf2f4f7 : 0x36c46a)
    : ready ? 0x36c46a : 0x2a2f38);

  // catapult 2: the other jets go on their own, each with its own countdown light
  carrier.aiT -= dt;
  if (carrier.aiT <= 0 && carrier.ai.length < CV.aiCount) {
    carrier.aiT = CV.aiEvery;
    const j = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 11, 8), lam(0x8a93a0)); body.rotation.x = Math.PI / 2; j.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3), lam(0x8a93a0)); j.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 2.4), lam(0x2b4fb0)); tail.position.set(0, 1.8, -4.4); j.add(tail);
    j.position.set(carrier.x + CV.cat2X, carrier.deck + 1.8, carrier.z - CV.catZ + 30);
    j.rotation.y = 0;
    scene.add(j);
    carrier.ai.push({ g: j, t: 0, phase: "count", v: 0 });
  }
  for (let i = carrier.ai.length - 1; i >= 0; i--) {
    const a = carrier.ai[i];
    a.t += dt;
    if (a.phase === "count") {
      carrier.cat2Mat.color.setHex(Math.floor(a.t * 6) % 2 ? 0xffd23e : 0x2a2f38);
      if (a.t > CV.countFrom) { a.phase = "go"; a.t = 0; a.v = 20; noiseBurst(0.4, 260, 0.16, 0); }
    } else {
      a.v += 120 * dt;
      a.g.position.z -= a.v * dt;
      a.g.position.y += Math.max(0, a.t - 1.2) * 12 * dt;
      if (a.t > 1.4) carrier.cat2Mat.color.setHex(0x2a2f38);
      if (a.t > 9) { scene.remove(a.g); carrier.ai.splice(i, 1); }
    }
  }

  // ---- the trap, and the one button
  if (carrier.state === "none" && carrierTryTrap()) carrierTrap();
  el.catBtn.classList.toggle("hidden", !carrierCanLaunch());
}

buildDemolition();
buildFireRig();
buildCarrier();

function updateSetpieces(dt) {
  updateDemolition(dt);
  updateFirefight(dt);
  updateCarrier(dt);
  updateMarsBase(dt);
  if (state.vp && state.vp.rocket) updateTowerCatch(dt);
}
// Runs at the END of the frame: the deck has to hold him after the flight model
// has had its say, or he simply flies on through it.
function updateSetpiecesLate(dt) {
  carrierLate(dt);
  marsLate(dt);
}
