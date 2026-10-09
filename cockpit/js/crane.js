"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE WRECKING-BALL CRANE (v145).
//
// A card in the picker: the giant yellow crawler crane. Picked, he sits in its cab
// on its own lot beside the demolition district, a long lattice boom over him and a
// HUGE black ball on its cable, and in front of him three blocks of empty towers in
// a fan, each block a row of slabs standing like dominoes. He turns the crane to
// point at a block, presses go, and after 3-2-1 the ball swings BY ITSELF: drawn back
// slowly, then forward faster and faster, into the block's first tower -- and the
// whole row folds over, one after another, away from him. Then, a few seconds on,
// they all stand back up, and he can turn and do it again.
//
// THE ONE NEW CONTROL, the crane's alone (approved 2026-10-08): a drag left or right
// turns (slews) the crane about its tracks. Nothing else he drives reads it -- the
// input path is untouched; this file reads the stick only while he is in the crane.
// Wide aim: let go and a magnet eases it on to the nearest block, so roughly there IS
// there; it never turns more than `slewMarginDeg` past the outer blocks, so it never
// faces nothing. No timing anywhere: go is the go button (a finger on the glass is
// the aim, so it cannot also be go), one press runs the whole thing, and a press
// during it does nothing. The crane never moves off its tracks.
//
// NOTHING CAN BANG. The crane is parked for good (vehParked while it waits), not
// solid (vehSolid false: it never moves, so it can drive into nothing), and what
// falls is its OWN towers, which are not in the solids registry -- they are a show,
// drawn only while he is in the crane, so for every other vehicle the world is
// exactly as it was. The buildings are empty: nothing living anywhere on the lot.
//
// THE LOT is TUNE.crane.at, beside the demolition block but never in it, off every
// airport and out of the motorway's corridor (crane_checks proves the crane, every
// fallen tower, the ball's arc and every piece). While he is in the crane, streamed
// trees and towns keep off the lot (crCovers, asked by scenery.js); out of it, the
// question is never asked and the scenery is exactly as before.
//
// THE PIECES come from the monster truck's debris pool (its cap, its gravity), and
// the dust from the shared puffs; both are cleared when he leaves. Everything stands
// back up EXACTLY on its built transform: nothing is ever taken away or counted.
//
// THE BUTTONS: go and the picker only while it waits; the view, the photo and the
// menu as everywhere. No speed steps (it does not drive), no eject (a parked crane's
// cab is not a seat to fly out of), no horn. No other set-piece counts down while he
// is in it (crQuiet): the one numeral is his.
// ---------------------------------------------------------------------------
const CR = TUNE.crane;
const cr = {
  built: false, lot: null, towers: [], groups: [], reticle: null,
  phase: "armed",                  // armed | count | wind | swing | fall | down | rise
  t: 0, clock: 0, aim: 1, baseHeading: 0, theta: 0, thetaPrev: 0, ballSpeed: 0,
  wasPressed: false, want: false, camInit: false, x: 0, y: 0, z: 0,
  cable: 0,                        // the cable paid out now: CR.cable, or less while it hoists
};
const crV = new THREE.Vector3(), crV2 = new THREE.Vector3(), crLook = new THREE.Vector3();

function crActive() { return !!(state.vp && state.vp.crane); }
// In the crane, no other set-piece's countdown starts (setpieces.js spCountBusy).
function crQuiet(me) { return crActive() && me !== "crane"; }
function crParked() { return cr.phase === "armed"; }
function crCanGo() { return crActive() && cr.phase === "armed" && !state.exploding && !menuOpen(); }
function crHeadingOf(deg) { return (CR.baseDeg + deg) * DEG; }
function crFwd(h) { return { x: -Math.sin(h), z: -Math.cos(h) }; }
// Streamed trees and towns keep off the lot -- only while he is in the crane.
function crCovers(x, z, extra) {
  if (!crActive() || !cr.built) return false;
  const dx = x - cr.x, dz = z - cr.z, r = cr.lotR + (extra || 0);
  return dx * dx + dz * dz < r * r;
}

// ---- the geometry, all from TUNE --------------------------------------------
// The boom's tip and the ball, in the upper works' own frame (forward -z).
function crTip() {
  const a = CR.boomDeg * DEG;
  return { f: CR.pivotF + CR.boomLen * Math.cos(a), y: CR.pivotY + CR.boomLen * Math.sin(a) };
}
function crBallLocal(theta, len) {
  const tip = crTip(), L = len || CR.cable;
  return { f: tip.f + L * Math.sin(theta), y: tip.y - L * Math.cos(theta) };
}
// The shortest cable that keeps the ball's sphere off the boom at swing angle theta
// (its centre `ballR + boomW/sqrt2 + boomClear` from the boom's axis); never over CR.cable.
function crCableMin(theta) {
  const s = Math.sin(theta + (90 - CR.boomDeg) * DEG);
  return s > 0.05 ? Math.min(CR.cable, (CR.ballR + CR.boomW * Math.SQRT1_2 + CR.boomClear) / s) : CR.cable;
}
// Hoisting: from `from` to `to` metres of cable, eased, k from 0 to 1, never on to the boom.
function crReel(from, to, k) {
  k = clamp(k, 0, 1);
  cr.cable = Math.max(from + (to - from) * k * k * (3 - 2 * k), crCableMin(cr.theta));
}
// Where the ball's face is at the hit: the first tower's near face stands exactly there.
function crFirstFace() { return crBallLocal(CR.hitDeg * DEG).f + CR.ballR; }

// ---- building it: the lot (towers and the aim ring) ---------------------------
function crBuild() {
  if (cr.built) return;
  cr.x = CR.at[0]; cr.z = CR.at[1];
  cr.y = terrainEff(cr.x, cr.z);
  cr.baseHeading = CR.baseDeg * DEG;
  const lot = new THREE.Group();
  lot.visible = false;
  const P = TUNE.palette;
  const greys = [P.concrete, 0xb9b0a0, P.grey, 0xcfc4ae];
  const face = crFirstFace();
  cr.towers = []; cr.groups = [];
  let far = 0;
  CR.groups.forEach((deg, g) => {
    const h = crHeadingOf(deg), f = crFwd(h);
    cr.groups.push({ bearing: h, deg });
    for (let i = 0; i < CR.perGroup; i++) {
      const height = CR.towerH[0] + hashSalt(g, i, 1451) * (CR.towerH[1] - CR.towerH[0]);
      // its pivot: the far bottom edge, so it falls AWAY from the crane
      const along = face + CR.towerW + i * CR.spacing;
      const px = cr.x + f.x * along, pz = cr.z + f.z * along;
      const cx = cr.x + f.x * (along - CR.towerW / 2), cz = cr.z + f.z * (along - CR.towerW / 2);
      const base = terrainEff(cx, cz) - CR.sink;
      const pivot = new THREE.Group();
      pivot.rotation.order = "YXZ";
      pivot.position.set(px, base, pz);
      pivot.rotation.set(0, h, 0);
      // the slab spans its pivot back toward the crane (+z here) and up
      const geo = new THREE.BoxGeometry(CR.towerD, height + CR.sink, CR.towerW).translate(0, (height + CR.sink) / 2, CR.towerW / 2);
      const m = new THREE.Mesh(geo, artLam(greys[(g * 2 + i) % greys.length], "office"));
      m.castShadow = true; m.receiveShadow = true;
      pivot.add(m);
      // a dark band at the roof: an empty block, its top floor open
      const cap = new THREE.Mesh(new THREE.BoxGeometry(CR.towerD + 0.6, 2.4, CR.towerW + 0.6).translate(0, height + CR.sink - 1.6, CR.towerW / 2), lam(P.slate));
      pivot.add(cap);
      lot.add(pivot);
      const rest = (i === CR.perGroup - 1 ? CR.lastDeg : CR.restDeg) * DEG;
      cr.towers.push({ g, i, h: height + CR.sink, pivot, home: pivot.quaternion.clone(), homeP: pivot.position.clone(),
                       fx: f.x, fz: f.z, phi: 0, rest, startT: null, landed: false, fallT: 0, rise0: 0 });
      far = Math.max(far, along + height);
    }
  });
  cr.lotR = far + 40;
  // the aim: a pulsing ring on the aimed block's first tower, where the ball will hit
  const ret = new THREE.Group();
  ret.add(new THREE.Mesh(new THREE.TorusGeometry(CR.reticleR, 1.1, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  ret.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  ret.rotation.order = "YXZ";
  lot.add(ret);
  cr.reticle = ret;
  scene.add(lot);
  cr.lot = lot;
  cr.built = true;
}

// Every tower back on its built transform, exactly.
function crTowersHome() {
  for (const t of cr.towers) {
    t.phi = 0; t.startT = null; t.landed = false; t.fallT = 0;
    t.pivot.position.copy(t.homeP); t.pivot.quaternion.copy(t.home);
  }
}
function crPose(t) {
  t.pivot.rotation.set(-t.phi, cr.groups[t.g].bearing, 0, "YXZ");   // the top goes AWAY (-z, forward)
}
function crClearPieces() {
  if (typeof mon !== "undefined" && mon.debris) {
    for (const p of mon.debris) p.life = 0;
    if (mon.debrisMesh) monUpdateDebris(0);
  }
}

// ---- getting in and out ------------------------------------------------------
function crSpawn() {
  vkQuiet(0, () => crBuild());
  crReset();
  state.x = cr.x; state.z = cr.z; state.y = cr.y;
  state.heading = cr.groups[1] ? cr.groups[1].bearing : cr.baseHeading;
  state.speed = 0; state.pitch = 0; state.bank = 0; state.airVy = 0; state.phase = "TAXI";
  cr.lot.visible = true;
  cr.camInit = false;
  cr.wasPressed = crPressed();
  // the lot is bare while he is here: the streamed trees and towns asked again (crCovers)
  updateScenery(state.x, state.z, true);
}
// Back to waiting, everything standing, nothing in the air, nothing counting.
function crReset() {
  if (cr.phase === "count") { countdownClear(); el.bigNum.classList.remove("sky"); }
  cr.phase = "armed"; cr.t = 0; cr.theta = 0; cr.thetaPrev = 0; cr.ballSpeed = 0; cr.want = false; cr.cable = CR.cable;
  if (cr.built) crTowersHome();
  crClearPieces();
  setTone("crRumble", "sawtooth", CR.rumbleHz, 0);
  setTone("crHum", "triangle", CR.humHz, 0);
}
// Called by applyVehicle whatever he picks next: the crane's show goes away whole.
function crLeave() {
  if (!cr.built) return;
  const was = cr.lot.visible;
  crReset();
  cr.lot.visible = false;
  // the streamed trees and towns are asked again without the lot, wherever he goes next
  if (was) scenCenterX = null;
}

// ---- the frame -----------------------------------------------------------------
function crPressed() { return !menuOpen() && !state.exploding && state.throttleHeld; }
function crAimed() {
  let best = 0, bd = 1e9;
  cr.groups.forEach((g, i) => { const d = Math.abs(wrapPi(state.heading - g.bearing)); if (d < bd) { bd = d; best = i; } });
  return best;
}
function crStart() {
  cr.aim = crAimed();
  cr.phase = "count"; cr.t = CR.count;
  flags.crGoes = (flags.crGoes || 0) + 1;
  flags.crCountdowns = (flags.crCountdowns || 0) + 1;
  releaseThrottle();                   // the press is spent: no hold outlives it
  thunk();
}

function crUpdate(dt) {
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";                // "not flying" -- every surface vehicle's word (vehicles.js)
  if (!cr.built) crSpawn();
  cr.lot.visible = true;
  cr.clock += dt;
  if (typeof monUpdateDebris === "function") { monDebrisInit(); monUpdateDebris(dt); }
  state.x = cr.x; state.z = cr.z; state.y = cr.y; state.speed = 0; state.pitch = 0; state.bank = 0; state.airVy = 0;
  if (state.exploding) return;
  const pressed = crPressed();
  const g = cr.groups;
  const lo = Math.min(...g.map(q => q.bearing)) - CR.slewMarginDeg * DEG, hi = Math.max(...g.map(q => q.bearing)) + CR.slewMarginDeg * DEG;
  let humK = 0;

  if (cr.phase === "armed") {
    // ---- the aim: his drag turns it; let go, the magnet settles it on a block
    const bank = state.touching && !menuOpen() ? state.ctrlBank : 0;
    if (Math.abs(bank) > CR.slewDead) {
      state.heading -= bank * CR.slewDeg * DEG * dt;          // a drag right turns it right
      humK = Math.min(1, Math.abs(bank));
    } else {
      const want = g[crAimed()].bearing;
      state.heading += wrapPi(want - state.heading) * (1 - Math.exp(-CR.magnet * dt));
    }
    state.heading = clamp(cr.baseHeading + wrapPi(state.heading - cr.baseHeading), lo, hi);
    // go: a NEW press of the go button (a hold left over from before is not one); kept
    // until the one numeral is free
    if (pressed && !cr.wasPressed) cr.want = true;
    if (cr.want && !spCountBusy("crane")) { cr.want = false; crStart(); }
  } else {
    cr.want = false;
    if (state.throttleHeld) releaseThrottle();
  }
  cr.wasPressed = pressed;

  // the ring on the aimed block, while it waits
  const aimNow = cr.phase === "armed" ? crAimed() : cr.aim;
  const t0 = cr.towers.find(t => t.g === aimNow && t.i === 0);
  if (t0 && cr.reticle) {
    const hb = crBallLocal(CR.hitDeg * DEG);
    const d = crFirstFace() - 1.2;
    cr.reticle.position.set(cr.x + t0.fx * d, cr.y + hb.y, cr.z + t0.fz * d);
    cr.reticle.rotation.set(0, g[aimNow].bearing, 0);
    cr.reticle.scale.setScalar(1 + Math.sin(cr.clock * CR.reticleRate * Math.PI) * CR.reticlePulse);
    cr.reticle.visible = cr.phase === "armed" || cr.phase === "count" || cr.phase === "wind" || cr.phase === "swing";   // until the ball hits
  }

  const ph = cr.phase;
  cr.thetaPrev = cr.theta;
  if (ph === "count") {
    // settle on the block it was pointed at, and count
    state.heading += wrapPi(g[cr.aim].bearing - state.heading) * (1 - Math.exp(-CR.lockRate * dt));
    cr.t -= dt;
    el.bigNum.classList.add("sky");
    countdownTo(cr.t, CR.count);
    setTone("crRumble", "sawtooth", CR.rumbleHz, CR.rumble * 0.5 * (1 - cr.t / CR.count));
    if (cr.t <= 0) {
      countdownClear(); el.bigNum.classList.remove("sky");
      state.heading = g[cr.aim].bearing;
      cr.phase = "wind"; cr.t = 0;
    }
  } else if (ph === "wind") {
    // drawn back, big and slow
    cr.t += dt;
    const u = clamp(cr.t / CR.windT, 0, 1);
    cr.theta = -CR.backDeg * DEG * u * u * (3 - 2 * u);
    setTone("crRumble", "sawtooth", CR.rumbleHz * (1 + 0.3 * u), CR.rumble * (0.5 + 0.5 * u));
    if (cr.t >= CR.windT + CR.holdT) {
      cr.phase = "swing"; cr.t = 0;
      flags.crSwings = (flags.crSwings || 0) + 1;
      whoosh();
    }
  } else if (ph === "swing") {
    // ... then forward, faster and faster, into the first tower
    cr.t += dt;
    const u = clamp(cr.t / CR.swingT, 0, 1);
    const back = CR.backDeg * DEG, hit = CR.hitDeg * DEG;
    cr.theta = -back + (hit + back) * Math.pow(u, CR.swingPow);
    if (u >= 1) crHit();
  } else if (ph === "fall" || ph === "down") {
    cr.t += dt;
    // the ball swings back off the hit and settles
    const hit = CR.hitDeg * DEG;
    cr.theta = hit * Math.exp(-cr.fallClock / CR.settleT) * Math.cos(cr.fallClock * CR.settleHz * 2 * Math.PI);
    // ... and the crane hoists it, up toward the boom's tip, clear of the falling row
    crReel(CR.cable, CR.hoistCable, (cr.fallClock - CR.hoistDelay) / CR.hoistT);
    cr.fallClock += dt;
    crDominoes(dt);
    if (ph === "fall" && cr.towers.filter(t => t.g === cr.aim).every(t => t.landed)) {
      cr.phase = "down"; cr.t = 0;
      flags.crDowns = (flags.crDowns || 0) + 1;
      setTone("crRumble", "sawtooth", CR.rumbleHz, 0);
    }
    if (cr.phase === "down" && cr.t >= CR.downT) {
      cr.phase = "rise"; cr.t = 0;
      crClearPieces();                    // standing back up whole: the pieces go with that
      const row = cr.towers.filter(t => t.g === cr.aim);
      for (const t of row) t.rise0 = t.phi;
      chime();
    }
  } else if (ph === "rise") {
    cr.t += dt;
    cr.theta *= Math.exp(-CR.riseSettle * dt);
    crReel(CR.hoistCable, CR.cable, cr.t / CR.payT);    // paid back out while they stand up
    const row = cr.towers.filter(t => t.g === cr.aim);
    let done = true;
    for (let j = row.length - 1; j >= 0; j--) {
      // the last one first, like a film run backwards -- and each one leaning on the
      // next is pushed up by it, never gone through (crLeanCap)
      const t = row[j];
      const k = clamp((cr.t - (CR.perGroup - 1 - t.i) * CR.riseGap) / CR.riseT, 0, 1);
      if (k < 1) done = false;
      t.phi = Math.min(t.rise0 * (1 - k * k * (3 - 2 * k)), crLeanCap(t, row[j + 1]));
      crPose(t);
    }
    if (done) {
      crTowersHome();                     // EXACTLY where they were built
      cr.theta = 0; cr.phase = "armed"; cr.t = 0; cr.cable = CR.cable;
      flags.crRises = (flags.crRises || 0) + 1;
      chirp();
    }
  }
  // the ball's speed, for the checks and the ear
  cr.ballSpeed = Math.abs(cr.theta - cr.thetaPrev) / Math.max(dt, 1e-6) * cr.cable;
  setTone("crHum", "triangle", CR.humHz * (1 + humK * 0.4), CR.hum * humK);
  const f = crFwd(state.heading);
  forward.set(f.x, 0, f.z);
  setEngine(0.18 + humK * 0.2);
}

// The ball meets the first tower: a clang and a boom, pieces off its face, and it goes.
function crHit() {
  cr.phase = "fall"; cr.t = 0; cr.fallClock = 0;
  flags.crHits = (flags.crHits || 0) + 1;
  const b = crBall();
  const f = crFwd(cr.groups[cr.aim].bearing);
  clang(); deepPop(); noiseBurst(0.6, 120, 0.45, 0);
  for (let i = 0; i < CR.hitPieces; i++) {
    const s = CR.pieceSpeed[0] + rnd() * (CR.pieceSpeed[1] - CR.pieceSpeed[0]);
    const side = (rnd() - 0.5) * 2;
    // off the ball's whole face, out to its rim, so they show round it from the cab
    crPiece(b.x + f.x * CR.ballR - f.z * side * CR.ballR * CR.hitRim, b.y + (rnd() - 0.5) * CR.ballR * 2 * CR.hitRim, b.z + f.z * CR.ballR + f.x * side * CR.ballR * CR.hitRim,
            f.x * s - f.z * side * CR.pieceSpread, CR.pieceUp[0] + rnd() * (CR.pieceUp[1] - CR.pieceUp[0]), f.z * s + f.x * side * CR.pieceSpread,
            CR.hitColours, CR.hitPieceSize);
  }
  for (let i = 0; i < CR.dust; i++) wakePuff(b.x + f.x * (CR.ballR + 4) + (rnd() - 0.5) * 10, b.y + (rnd() - 0.5) * 8, b.z + f.z * (CR.ballR + 4) + (rnd() - 0.5) * 10, 0xcfc7bb, CR.dustSize, CR.dustRise, CR.dustLife);
  crStartFall(cr.towers.find(t => t.g === cr.aim && t.i === 0));
}
function crStartFall(t) {
  if (!t || t.startT !== null) return;
  t.startT = cr.clock; t.fallT = 0;
  flags.crFalls = (flags.crFalls || 0) + 1;
  noiseBurst(0.35, 70, 0.22, 0);
}
// The furthest over a tower can lean with its top on the next one's near face (the
// next standing or leaning at next.phi, its foot `spacing` on): never through it.
function crLeanCap(t, next) {
  if (!next) return Infinity;
  const dy = t.homeP.y - next.homeP.y;
  return next.phi + Math.asin(clamp((CR.spacing * Math.cos(next.phi) + dy * Math.sin(next.phi) - CR.towerW) / t.h, -1, 1));
}
// Each going tower leans on further and faster; when its top reaches the next one's
// face, that one goes too -- and from then on it leans ON the next one, never through
// it (crLeanCap). A tower that reaches its rest, or rests on one that has landed,
// lands: a boom, dust, pieces.
function crDominoes(dt) {
  const row = cr.towers.filter(t => t.g === cr.aim);
  for (const t of row) {
    if (t.startT === null || t.landed) continue;
    t.fallT += dt;
    const u = clamp(t.fallT / CR.fallT, 0, 1);
    const next = row[t.i + 1];
    const cap = crLeanCap(t, next);
    t.phi = Math.min(t.rest * u * u, cap);
    crPose(t);
    if (next && next.startT === null && t.phi >= cap - 1e-9) crStartFall(next);
    if (u >= 1 && (t.phi >= t.rest - 1e-9 || (next && next.landed && t.phi >= cap - 1e-9))) { t.phi = Math.min(t.rest, cap); crPose(t); crLand(t); }
  }
}
function crLand(t) {
  t.landed = true;
  noiseBurst(0.5, 90, 0.32, 0); deepPop();
  const P = t.pivot.position, L = t.h * Math.sin(t.phi);
  for (let i = 0; i < CR.landPieces; i++) {
    const k = rnd(), s = CR.pieceSpeed[0] + rnd() * (CR.pieceSpeed[1] - CR.pieceSpeed[0]) * 0.6, side = (rnd() - 0.5) * 2;
    crPiece(P.x + t.fx * L * k + t.fz * side * CR.towerD * 0.5, P.y + 2 + rnd() * 6, P.z + t.fz * L * k - t.fx * side * CR.towerD * 0.5,
            t.fx * s * 0.6 + t.fz * side * s, CR.pieceUp[0] + rnd() * (CR.pieceUp[1] - CR.pieceUp[0]), t.fz * s * 0.6 - t.fx * side * s);
  }
  for (let i = 0; i < CR.dust; i++) {
    const k = rnd();
    wakePuff(P.x + t.fx * L * k + (rnd() - 0.5) * CR.towerD, P.y + 2 + rnd() * 4, P.z + t.fz * L * k + (rnd() - 0.5) * CR.towerD, 0xcfc7bb, CR.dustSize, CR.dustRise, CR.dustLife);
  }
}
// One piece out of the monster truck's pool (its cap is the pool's size).
function crPiece(x, y, z, vx, vy, vz, colours, size) {
  monDebrisInit();
  const i = mon.cursor = (mon.cursor + 1) % MON.debris, p = mon.debris[i];
  const P = TUNE.palette, cols = colours || [P.concrete, P.grey, P.white, P.slate], sz = size || CR.pieceSize;
  p.life = MON.debrisLife; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.s = sz[0] + rnd() * (sz[1] - sz[0]); p.r = rnd() * 6;
  mon.debrisMesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  mon.debrisMesh.instanceColor.needsUpdate = true;
  flags.crDebris = (flags.crDebris || 0) + 1;
}

// ---- the cameras: the cab, or the chase behind, right and above ----------------
function crCamera(dt) {
  camera.up.set(0, 1, 0);
  const h = state.heading, f = crFwd(h), rx = -f.z, rz = f.x;     // right of forward
  if (state.viewChase) {
    const C = CR.chase;
    crV.set(cr.x - f.x * C.back + rx * C.side, cr.y + C.up, cr.z - f.z * C.back + rz * C.side);
    crLook.set(cr.x + f.x * C.look, cr.y + C.lookUp, cr.z + f.z * C.look);
    if (cr.camInit) camera.position.lerp(crV, 1 - Math.exp(-C.lag * dt));
    else camera.position.copy(crV);
    camera.lookAt(crLook);
  } else {
    const C = CR.seat;
    camera.position.set(cr.x + f.x * C.fwd + rx * C.side, cr.y + C.up, cr.z + f.z * C.fwd + rz * C.side);
    camera.rotation.set(C.pitch * DEG, h + C.yaw * DEG, 0, "YXZ");
  }
  cr.camInit = true;
}

// ---- his crane: the vehicle model ------------------------------------------------
function crBuildModel() {
  const P = TUNE.palette;
  const paint = c => { const m = sledPaint(c).clone(); m.emissive = new THREE.Color(c).multiplyScalar(CR.selfLight); return m; };
  const outer = new THREE.Group();
  // the tracks and the car body: they face baseDeg and never turn
  const base = new THREE.Group(), bk = lsKit();
  for (const s of [-1, 1]) {
    bk.add(P.ink, new THREE.BoxGeometry(4.2, 3.2, 20), s * 6.4, 1.6, 0);
    for (let i = 0; i < 12; i++) bk.add(P.slate, new THREE.BoxGeometry(4.4, 0.5, 0.9), s * 6.4, 3.25, -9 + i * 1.65);
    bk.add(P.warning, new THREE.BoxGeometry(0.4, 1.4, 16), s * 8.6, 1.8, 0);
  }
  bk.add(P.slate, new THREE.BoxGeometry(9, 2, 10), 0, 3, 0);
  bk.build(base, paint);
  outer.add(base);
  // the upper works: they turn with his drag
  const up = new THREE.Group(), uk = lsKit();
  uk.add(P.warning, new THREE.BoxGeometry(9, 4.5, 14), 0, 6.2, 1);            // the body
  uk.add(P.slate, new THREE.BoxGeometry(9.4, 5, 4.5), 0, 6.5, 8.6);           // the counterweight, at the back
  for (const s of [-1, 1]) uk.add(P.warning, new THREE.BoxGeometry(1.2, 5.2, 4.7), s * 2.4, 6.5, 8.6);
  uk.add(P.ink, new THREE.CylinderGeometry(4.6, 4.6, 1.2, 18), 0, 3.6, 0);   // the slew ring
  // the A-frame behind the boom's foot, and the pendant lines to the tip
  const a = CR.boomDeg * DEG, tip = crTip();
  for (const s of [-1, 1]) uk.add(P.warning, new THREE.BoxGeometry(0.9, 14, 0.9), s * 2.6, 14, 4, -0.25, 0, 0);
  const mast = { y: 20.5, z: 5.6 };
  const pdy = tip.y - mast.y, pdz = -tip.f - mast.z, plen = Math.hypot(pdy, pdz);
  for (const s of [-1, 1]) uk.add(P.ink, new THREE.BoxGeometry(0.35, 0.35, plen), s * 0.9, mast.y + pdy / 2, mast.z + pdz / 2, Math.atan2(-pdy, pdz), 0, 0);
  uk.build(up, paint);
  // the cab, front-left: from the seat it is where he sits, so it is not drawn there
  const cab = new THREE.Group(), ck = lsKit();
  ck.add(P.warning, new THREE.BoxGeometry(3.6, 4, 5), -3.4, 7.6, -6.2);
  ck.add(P.night, new THREE.BoxGeometry(3.7, 2, 5.1), -3.4, 8.4, -6.2);         // dark glass: an empty cab, nobody to see
  ck.build(cab, paint);
  up.add(cab);
  // the lattice boom: four chords and their lacing, standing at boomDeg
  const boom = new THREE.Group(), kk = lsKit(), W = CR.boomW / 2, L = CR.boomLen;
  for (const [x, y] of [[-W, -W], [W, -W], [-W, W], [W, W]]) kk.add(P.warning, new THREE.BoxGeometry(0.45, 0.45, L), x, y, -L / 2);
  const bays = Math.round(L / 4);
  for (let i = 0; i < bays; i++) {
    const z0 = -i * L / bays, z1 = -(i + 1) * L / bays, zm = (z0 + z1) / 2, dl = Math.hypot(2 * W, z1 - z0), ang = Math.atan2(2 * W, z0 - z1);
    const sgn = i % 2 ? 1 : -1;
    for (const y of [-W, W]) kk.add(P.warning, new THREE.BoxGeometry(0.22, 0.22, dl), 0, y, zm, 0, sgn * ang, 0);
    for (const x of [-W, W]) kk.add(P.warning, new THREE.BoxGeometry(0.22, 0.22, dl), x, 0, zm, -sgn * ang, 0, 0);
  }
  kk.add(P.ink, new THREE.BoxGeometry(CR.boomW + 1, CR.boomW + 1, 2.4), 0, 0, -L);   // the tip's sheaves
  kk.build(boom, paint);
  boom.position.set(0, CR.pivotY, -CR.pivotF);
  boom.rotation.x = a;
  up.add(boom);
  // the cable and the ball: posed every frame (crPoseModel)
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 6).translate(0, -0.5, 0), paint(P.ink));
  cable.position.set(0, tip.y, -tip.f);
  up.add(cable);
  const ball = new THREE.Group(), blk = lsKit();
  blk.add(P.ink, new THREE.SphereGeometry(CR.ballR, 20, 14), 0, 0, 0);
  blk.add(P.slate, new THREE.TorusGeometry(CR.ballR * 1.01, 0.5, 6, 24), 0, 0, 0, Math.PI / 2, 0, 0);
  blk.add(P.warning, new THREE.BoxGeometry(2.4, 2.2, 2.4), 0, CR.ballR + 0.8, 0);   // the shackle
  blk.build(ball, paint);
  up.add(ball);
  outer.add(up);
  outer.userData.up = up; outer.userData.base = base; outer.userData.cab = cab;
  outer.userData.cable = cable; outer.userData.ball = ball;
  return outer;
}
function crPoseModel(m) {
  const ud = m.userData;
  if (!ud.up) return;
  m.position.set(cr.x, cr.y, cr.z);
  ud.base.rotation.set(0, cr.baseHeading, 0);
  ud.up.rotation.set(0, state.heading, 0);
  ud.cab.visible = state.viewChase;
  const tip = crTip(), b = crBallLocal(cr.theta, cr.cable);
  ud.ball.position.set(0, b.y, -b.f);
  // the cable from the tip to the ball's shackle
  const dy = (b.y + CR.ballR) - tip.y, dz = -(b.f - tip.f);
  ud.cable.scale.set(1, Math.hypot(dy, dz), 1);
  ud.cable.rotation.set(Math.atan2(-dz, -dy), 0, 0);
}

// ---- for the checks ---------------------------------------------------------------
function crBall() {
  const b = crBallLocal(cr.theta, cr.cable), f = crFwd(state.vp && state.vp.crane ? state.heading : cr.groups[cr.aim] ? cr.groups[cr.aim].bearing : 0);
  return { x: cr.x + f.x * b.f, y: cr.y + b.y, z: cr.z + f.z * b.f, speed: cr.ballSpeed, r: CR.ballR };
}
function crCrane() { return { x: cr.x, y: cr.y, z: cr.z, baseHeading: cr.baseHeading }; }
function crGroups() { return cr.groups.map(g => ({ bearing: g.bearing, deg: g.deg })); }
function crTowers() {
  return cr.towers.map(t => {
    const P = t.pivot.position, s = Math.sin(t.phi), c = Math.cos(t.phi);
    // its foot's middle (standing), and its top's middle now
    const mid = CR.towerW / 2;
    return { g: t.g, i: t.i, h: t.h, w: CR.towerW, d: CR.towerD, phiDeg: t.phi / DEG, startT: t.startT, visible: !!(cr.lot && cr.lot.visible),
             fallDir: { x: t.fx, z: t.fz },
             base: { x: t.homeP.x - t.fx * mid, y: t.homeP.y, z: t.homeP.z - t.fz * mid },
             top: { x: P.x + t.fx * (t.h * s - mid * c), y: P.y + t.h * c + mid * s, z: P.z + t.fz * (t.h * s - mid * c) } };
  });
}
// The worst any tower is off its built transform: metres, plus radians.
function crHomeError() {
  let e = 0;
  for (const t of cr.towers) e = Math.max(e, t.pivot.position.distanceTo(t.homeP) + t.pivot.quaternion.angleTo(t.home));
  return e;
}

spCountRegister("crane", () => cr.phase === "count");
