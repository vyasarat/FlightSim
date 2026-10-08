"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE ROCKET SLED HE RIDES (v144).
//
// A card in the picker: the red rocket sled. Picked, he sits ON the set-piece's
// own sled (rocketsled.js), at home beside the start tower, nose down the rail
// at the giant wall of toy bricks. He presses go -- the go button, or a finger
// anywhere on the screen, the surface vehicles' "finger down is go" -- and the
// set-piece runs for him exactly as it runs when he points at it from the car:
// red, amber, green under 3-2-1, the blast down the rail to 120 m/s, through the
// wall, three chutes, a stop, and the roll home while the wall flies back
// together. Then go again.
//
// IT IS THE SET-PIECE, DRIVEN, NOT A COPY OF IT. rocketsled.js moves the sled;
// this file reads him off it every frame (srPlace). Its rail, its numbers, its
// smash, its chutes, its brick throw (west, away from the road) and its rebuild
// are all its own, untouched. Riding it changes three things there and nothing
// else: his go starts it instead of his pointing (`sled.ridden`), its own sled
// is not drawn (his vehicle model is a copy of it, posed to match it, flame and
// chutes and all), and getting on or off is a fresh sledReset -- so whenever he
// is not riding it, it is the set-piece it always was.
//
// NOTHING TO TIME, NOTHING TO FAIL. One press starts the 3-2-1 and the run goes
// through to the end whether he keeps holding or not; home again, a new press is
// the next run (a finger still down from the last one is not). The go button
// goes away with the press that used it, and lets go of the throttle as it
// does, so no hold outlives it into the next vehicle. Rail-locked: a steer does
// nothing at all. A drag UP during the run is the burst (the surface vehicles'
// drag-up): a longer, fatter flame (from the nozzles) and a roar of its own. It
// starts past `burst.pitch` and ends only under `burst.release`, so a wobbling
// finger is one burst. It is a SHOW -- the run's speed and its payoff stay the
// set-piece's. From the seat the flame is behind him: there the burst is its
// sound, and nothing else.
//
// THE CAMERAS. The seat sits on the nose looking down the rail; it gets one kick
// of the field of view at the launch and one at the smash (cameraPunch, never a
// shake). The chase sits behind and high; once the chutes are out it eases out to
// the east -- the road's side, away from the bricks -- so no canopy hangs between
// him and the sled, and back behind as they pack.
//
// NEVER A BANG. On the rail nothing can be in front of him: the embankment, the
// tower, the wall (smashed as the nose reaches it) and the sled's own capsule
// are the run's own solids, so the vehicle contract says he is not solid
// (vehSolid) and he never asks the registry for a wall.
//
// THE BUTTONS: go only while it is home and ready (it would do nothing during a
// run); the picker only at home (vehParked); the view toggle, the photo and the
// menu as everywhere. No speed steps -- the run is the set-piece's speed -- and
// no eject: the sled has no seat to leave. No other set-piece starts a countdown
// while he rides (srQuiet): the one numeral on the screen is his.
// ---------------------------------------------------------------------------
const SR = TUNE.sledRide;
const sr = { want: false, wasPressed: false, burst: false, burstK: 0, flameK: 1, roar: 0, camInit: false, phase: "armed", sideK: 0 };
const srCamV = new THREE.Vector3(), srLookV = new THREE.Vector3(), srSideV = new THREE.Vector3(), srSideLookV = new THREE.Vector3();

function srActive() { return !!(state.vp && state.vp.sledRide); }
// Riding it, no other set-piece's countdown starts (setpieces.js spCountBusy).
function srQuiet(me) { return srActive() && me !== "rocketSled"; }
function srPressed() { return !menuOpen() && !state.exploding && (state.throttleHeld || state.touching); }
// Asked by rocketsled.js while it is home and he is riding it: a NEW press (not a
// finger held on from the last run). It is kept until the one numeral is free,
// so a press is never lost.
function srGo() { return (sr.want || (srPressed() && !sr.wasPressed)) && !spCountBusy("rocketSled"); }
function srCanGo() { return srActive() && sled.phase === "armed" && !state.exploding && !menuOpen(); }
function srParked() { return sled.phase === "armed"; }
function srHeading() { return Math.atan2(-sled.dirX, -sled.dirZ); }

// He is where the sled is, facing down the rail, going its speed.
function srPlace() {
  state.x = sled.x; state.y = sled.y; state.z = sled.z;
  state.heading = srHeading();
  state.speed = sled.v;
  state.pitch = 0; state.bank = 0; state.airVy = 0;
  state.phase = "TAXI";                // "not flying" -- every surface vehicle's word (vehicles.js)
}

// On at the start tower: the set-piece from a fresh reset, home and armed.
function srSpawn() {
  sledSetRidden(true);
  sr.want = false; sr.phase = sled.phase; sr.wasPressed = srPressed(); sr.burst = false; sr.burstK = 0; sr.flameK = 1; sr.roar = 0;
  sr.camInit = false; sr.sideK = 0;
  srPlace();
}

function srUpdate(dt) {
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";
  if (state.exploding) return;
  // a new press while it is home is kept until it starts (rocketsled.js asks srGo);
  // once it has started, the go button is gone and so is its hold
  const pressed = srPressed();
  if (sled.phase === "armed") { if (pressed && !sr.wasPressed) sr.want = true; }
  else { sr.want = false; if (state.throttleHeld) releaseThrottle(); }
  sr.wasPressed = pressed;
  // the launch and the smash, from the seat: one kick of the field of view each (never a shake)
  if (sled.phase === "run" && sr.phase === "count" && !state.viewChase) { cameraPunch(SR.seat.launchPunch); flags.srLaunchPunches = (flags.srLaunchPunches || 0) + 1; }
  if (sled.phase === "chute" && sr.phase === "run" && !state.viewChase) { cameraPunch(SR.seat.smashPunch); flags.srSmashPunches = (flags.srSmashPunches || 0) + 1; }
  sr.phase = sled.phase;
  // the burst: a drag up during the run
  const B = SR.burst;
  // (it starts past `pitch` and ends only under `release`: a wobbling finger is one burst)
  const burst = sled.phase === "run" && state.touching && !menuOpen() && state.ctrlPitch > (sr.burst ? B.release : B.pitch);
  if (burst && !sr.burst) { flags.srBursts = (flags.srBursts || 0) + 1; noiseBurst(B.whoosh.dur, B.whoosh.freq, B.whoosh.peak, 0); }
  sr.burst = burst;
  sr.burstK += ((burst ? 1 : 0) - sr.burstK) * Math.min(1, B.rate * dt);
  sr.flameK = 1 + sr.burstK * (B.flame - 1);
  sr.roar = burst ? B.roar : 0;
  setTone("srBurst", "sawtooth", B.hz * (1 + sr.burstK * B.hzRise), sr.roar);
  srPlace();
  forward.set(sled.dirX, 0, sled.dirZ);
  setEngine(0);                        // no engine voice of its own: the set-piece's roar is the sound
}

// ---- the cameras: the seat on the nose, or the chase behind and above --------
function srCamera(dt) {
  camera.up.set(0, 1, 0);
  const fx = sled.dirX, fz = sled.dirZ;
  if (state.viewChase) {
    const C = SR.chase;
    srCamV.set(sled.x - fx * C.back, sled.y + C.up, sled.z - fz * C.back);
    srLookV.set(sled.x + fx * C.look, sled.y + C.lookUp, sled.z + fz * C.look);
    // chutes out: ease out to the east side (the road's side, away from the bricks),
    // so no canopy hangs between him and the sled; back behind as they pack
    sr.sideK += ((sled.chuteOut ? 1 : 0) - sr.sideK) * Math.min(1, C.sideRate * dt);
    if (sr.sideK > 1e-3) {
      const ex = -fz, ez = fx;                 // east: the rail's across is +west (rocketsled.js)
      srSideV.set(sled.x + ex * C.side - fx * C.sideBack, sled.y + C.sideUp, sled.z + ez * C.side - fz * C.sideBack);
      srSideLookV.set(sled.x - fx * C.sideLookBack, sled.y + C.sideLookUp, sled.z - fz * C.sideLookBack);
      srCamV.lerp(srSideV, sr.sideK); srLookV.lerp(srSideLookV, sr.sideK);
    }
    if (sr.camInit) camera.position.lerp(srCamV, 1 - Math.exp(-C.lag * dt));
    else camera.position.copy(srCamV);
    camera.lookAt(srLookV);
  } else {
    // low on the nose, looking down the rail at the wall
    const C = SR.seat;
    camera.position.set(sled.x + fx * C.fwd, sled.y + C.up, sled.z + fz * C.fwd);
    camera.rotation.set(-C.pitch * DEG, srHeading(), 0, "YXZ");
  }
  sr.camInit = true;
}

// ---- his sled: a copy of the set-piece's own, with its own geometry and paint
// (a vehicle model is disposed when he changes vehicle), posed to match it -------
function srBuildModel() {
  const g = sled.sledG.clone();
  g.traverse(o => {
    if (o.geometry) o.geometry = o.geometry.clone();
    if (o.material) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
  });
  g.userData.srFlame = g.children[sled.sledG.children.indexOf(sled.flame)];
  g.visible = true;
  return g;
}
function srPoseModel(m) {
  const src = sled.sledG;
  m.position.copy(src.position);
  m.quaternion.copy(src.quaternion);
  // the flame, the chutes, all of it, as the set-piece has posed its own
  for (let i = 0; i < src.children.length; i++) {
    const a = src.children[i], b = m.children[i];
    if (!b) continue;
    b.visible = a.visible; b.position.copy(a.position); b.quaternion.copy(a.quaternion); b.scale.copy(a.scale);
  }
  // ... and the burst on top: longer and fatter, lit through the whole run
  const fl = m.userData.srFlame;
  if (!fl) return;
  if (sr.burstK > 0.02 && sled.phase === "run") {
    const w = 1 + sr.burstK * (SR.burst.wide - 1), s = sled.flame.scale;
    fl.visible = true;
    fl.scale.set(s.x * w, s.y * w, s.z * sr.flameK);
  }
  // the flame grows backward FROM THE NOZZLES: it is scaled about the sled's middle,
  // so it is moved back on to them (a 1.8x flame scaled about the middle sat 20 m
  // behind the sled, a gap of smoke between)
  const N = srNozzle();
  fl.position.set(0, N.y * (1 - fl.scale.y), N.z * (1 - fl.scale.z));
}
// The flame's root (the nozzles' plane and their middle height) and its length, in
// the sled's own frame -- as rocketsled.js builds them
function srNozzle() { const S = SLED.size; return { y: 1.8 * S, z: -6.4 * S, len: 9 * S }; }
// Where his flame starts and ends, for the checks: how far its root is from the
// nozzles, and how far behind the sled's middle its tip reaches
function srFlameEnds() {
  const fl = vehicleModel && vehicleModel.userData.srFlame;
  if (!fl) return null;
  const N = srNozzle();
  return { visible: fl.visible,
           rootGap: Math.hypot(fl.position.y + fl.scale.y * N.y - N.y, fl.position.z + fl.scale.z * N.z - N.z),
           reach: -(fl.position.z + fl.scale.z * (N.z - N.len)) };
}
