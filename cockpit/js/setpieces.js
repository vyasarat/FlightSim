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

buildDemolition();

function updateSetpieces(dt) {
  updateDemolition(dt);
  if (state.vp && state.vp.rocket) updateTowerCatch(dt);
}
