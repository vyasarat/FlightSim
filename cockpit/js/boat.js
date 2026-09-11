"use strict";
// WORKING RULES
// The speedboat. One finger and the same stick semantics as the car: finger
// down = go, drag left/right = steer, drag up = a throttle burst. There is no
// new gesture to learn anywhere in here.
//
// THE RULE FOR BOATS. Each boat gets one thing only a boat can do; a boat is
// not a slow car on water. The speedboat's is the WATER CANNON: within
// TUNE.boat.cannonRadius of the burning rig one button appears, exactly where
// the helicopter's bucket button appears and under the same slot rules, and
// holding it throws a thick arc of water that shrinks the flames the same way
// the helicopter's drops do. The two ways of fighting that fire agree because
// they call the same code (fireDropWater in setpieces.js).
//
// NEVER STUCK is the whole of the ground handling. Water is anywhere the
// terrain is below the waterline, and there is no "beached" state to get out
// of: run up the shingle and the hull slides itself back off within a couple of
// seconds. He cannot strand it, and there is nothing to press to be rescued.
//
// The jump ramp is the Mars jump's physics, on water: a kick, a spin, and a
// landing that rights itself if it comes down badly. Nothing is scored.

const BT = TUNE.boat;

const boat = {
  steer: 0, burst: 0, plane: 0,
  air: 0, airT: 0, spin: 0, flip: 0,
  beach: 0, wakeT: 0, sprayT: 0, crashCool: 0,
  vx: 0, vy: 0, vz: 0,      // only ever used while it is off the ramp
  crashX: null, crashZ: 0,  // where it blew up, so the reassemble does not read a stale safePos
  cannon: 0, cannonT: 0, cannonHeld: false,
  helmWheel: null, helmThrottle: null, helm: null,
  rampCool: 0,
};

function boatActive() { return !!(state.vp && state.vp.boat); }

// ---------------------------------------------------------------------------
// Where the water is. `terrainEff` under the waterline is water; everything
// else is beach. That is the only test in here, and it means the harbour, the
// open sea, the lake and the river all behave the same without a single
// hand-drawn boundary.
// ---------------------------------------------------------------------------
// The local level, not the global constant: inside the lock's chamber and up
// in the dock the water stands somewhere else, and a hull has to float on the
// water that is actually there (js/lock.js, seaLevelAt in terrain.js).
function boatWaterAt(x, z) { return terrainEff(x, z) < seaLevelAt(x, z) - BT.draft; }
function boatSeaY() { return seaLevelAt(state.x, state.z); }
function boatOnWater() { return boatWaterAt(state.x, state.z); }

// The direction back toward water, found by sampling rings of GROWING radius.
//
// A single ring at one radius is not enough, and that is not a theoretical
// worry: driving up the east shore of the basin put him 115 m inland, the ring
// at 22 m found nothing but beach, and the boat sat there for ever with no
// button to press. Never stuck is a law, so the search widens until it finds
// water or runs out of ring -- and boatStranded() below is the backstop for
// when it does run out.
function boatWaterDir(x, z) {
  for (const r of BT.beachRings) {
    let bx = 0, bz = 0, found = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (boatWaterAt(x + Math.cos(a) * r, z + Math.sin(a) * r)) { bx += Math.cos(a); bz += Math.sin(a); found++; }
    }
    if (found) { const l = Math.hypot(bx, bz) || 1; return { x: bx / l, z: bz / l, r }; }
  }
  return null;
}

// ---------------------------------------------------------------------------
function boatSpawn() {
  const M = TUNE.harbor.marina;
  state.x = M.spawn[0];
  state.z = M.spawn[1];
  state.y = boatSeaY();
  // nose out: pointed at the harbour mouth, worked out rather than written down,
  // so moving the mouth in TUNE moves the way he is facing with it
  const mx = TUNE.harbor.cx, mz = (TUNE.harbor.mouth.z[0] + TUNE.harbor.mouth.z[1]) / 2;
  state.heading = Math.atan2(-(mx - state.x), -(mz - state.z));
  state.speed = 0; state.pitch = 0; state.bank = 0; state.phase = "TAXI";
  state.airVy = 0;
  boat.steer = 0; boat.burst = 0; boat.plane = 0; boat.air = 0; boat.airT = 0;
  boat.spin = 0; boat.flip = 0; boat.beach = 0; boat.cannon = 0; boat.rampCool = 0;
  boat.crashX = null;
  boatBuildHelm();
  thunk();
}

// Put him back on the water, facing out. Nothing is lost, ever.
function boatReassemble() {
  const M = TUNE.harbor.marina;
  // Where he BLEW UP, not where the shared reassemble logic has since put him.
  // flight.js moves state to `safePos` before calling this, and safePos is only
  // ever written by the aircraft wall solver -- so a boat crash reassembled at
  // whatever coordinate the last aeroplane happened to hit a building at, which
  // in a fresh session is the middle of the continent.
  let px = boat.crashX === null ? state.x : boat.crashX;
  let pz = boat.crashX === null ? state.z : boat.crashZ;
  if (!boatWaterAt(px, pz)) {
    const d = boatWaterDir(px, pz);
    if (d) { px += d.x * BT.beachProbe * 2; pz += d.z * BT.beachProbe * 2; }
    else { px = M.spawn[0]; pz = M.spawn[1]; }
  }
  // and clear of whatever he hit
  for (const b of harbor.solids) {
    if (px > b.x - b.hw - 14 && px < b.x + b.hw + 14 && pz > b.z - b.hd - 14 && pz < b.z + b.hd + 14) {
      const dx = px - b.x, dz = pz - b.z;
      if (Math.abs(dx) / (b.hw + 1) > Math.abs(dz) / (b.hd + 1)) px = b.x + Math.sign(dx || 1) * (b.hw + 22);
      else pz = b.z + Math.sign(dz || 1) * (b.hd + 22);
    }
  }
  state.x = px; state.z = pz;
  state.y = boatSeaY();
  const mx = TUNE.harbor.cx, mz = (TUNE.harbor.mouth.z[0] + TUNE.harbor.mouth.z[1]) / 2;
  state.heading = Math.atan2(-(mx - state.x), -(mz - state.z));
  state.speed = 0; state.pitch = 0; state.bank = 0;
  boat.steer = 0; boat.burst = 0; boat.air = 0; boat.spin = 0; boat.flip = 0;
  boat.beach = 0; boat.crashX = null;
  flags.boatReassembles = (flags.boatReassembles || 0) + 1;
}

// The backstop. If the hull is somewhere with no water anywhere near it at all
// -- which should not happen, and did -- it goes home to its berth after a few
// seconds, with a splash, for free. There is nothing to press and nothing to
// lose: he simply finds himself back at the marina.
function boatStranded() {
  const M = TUNE.harbor.marina;
  splashAt(state.x, Math.max(terrainEff(state.x, state.z), boatSeaY()), state.z, 1.4);
  state.x = M.spawn[0]; state.z = M.spawn[1]; state.y = seaLevelAt(state.x, state.z);
  const mx = TUNE.harbor.cx, mz = (TUNE.harbor.mouth.z[0] + TUNE.harbor.mouth.z[1]) / 2;
  state.heading = Math.atan2(-(mx - state.x), -(mz - state.z));
  state.speed = 0; boat.beach = 0; boat.steer = 0; boat.burst = 0;
  splashAt(state.x, boatSeaY(), state.z, 1.6);
  whoosh();
  flags.boatRefloats = (flags.boatRefloats || 0) + 1;
}

// The debounce is a COUNTDOWN THE FRAME DRIVES, not a wall-clock stamp, and the
// difference is not academic. It used to read `performance.now() - lastCrash <
// 900` against a `lastCrash` that starts at 0 -- so for the first nine hundred
// milliseconds of the page's life the number it compared was the AGE OF THE
// PAGE, and the boat could not crash into anything at all. It also meant the
// harness, which runs twelve simulated seconds in about a sixth of a real one,
// could never see a crash: the check that was meant to catch this passed on a
// flag left behind by an earlier check on the same page. CLAUDE.md's rule about
// not timing game code off real time is exactly this.
function boatCrash() {
  if (state.exploding || boat.crashCool > 0) return;
  boat.crashCool = BT.crashDebounce;
  boat.crashX = state.x; boat.crashZ = state.z;
  triggerExplosion(state.x, state.y + 1.2, state.z, 1);
  cameraHitStop(1.2);
  state.exploding = true;
  state.explodeTimer = 0;
  flags.boatCrashes = (flags.boatCrashes || 0) + 1;
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------
function updateBoat(dt) {
  if (boat.crashCool > 0) boat.crashCool -= dt;
  // one finger: no throttle button, no gear, no missiles. The speed steps are
  // up (taps, not a second finger); js/speed.js decides them once a frame.
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";

  // The cannon button's visibility is decided BEFORE anything can return early,
  // so it can never be left up over a button he needs -- the rule the rover and
  // the astronaut taught this codebase the hard way.
  boatUpdateCannonButton();
  if (typeof yachtUpdateGarageButton === "function") yachtUpdateGarageButton();

  if (state.exploding) { setTone("boatEngine", "sawtooth", 60, 0); setTone("boatHull", "triangle", 90, 0); return; }

  const touching = state.touching && !menuOpen();
  const bank = touching ? clamp(state.ctrlBank, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;

  // ---- airborne off the ramp: a kick, a spin, and a landing that rights itself
  if (boat.air > 0) { boatAirborne(dt); return; }

  const onWater = boatOnWater();

  // ---- speed. Finger down drives; off coasts to a stop and it bobs.
  if (pitch > 0.45 && touching && boat.burst <= 0 && state.speed > BT.cruise * 0.25) {
    boat.burst = BT.burstTime;
    cameraPunch(0.5);
    synthBlip("sawtooth", 180, 640, 0.5, 0.14, 0);
    flags.boatBursts = (flags.boatBursts || 0) + 1;
  }
  if (boat.burst > 0) boat.burst -= dt;
  const bursting = boat.burst > 0 ? BT.burst : 1;
  // The speed step multiplies the TARGET and the cap and nothing else: every
  // `speed / BT.cruise` below still reads against the base, so the engine note
  // pegs and the wake maxes out at the top step (js/speed.js).
  const step = spdMul();
  const top = BT.cruise * step * bursting * (onWater ? 1 : BT.beachedMax);
  const want = touching ? top : 0;
  const rate = (want > state.speed ? BT.accel : BT.drag) * dt;
  state.speed += clamp(want - state.speed, -rate, rate);
  state.speed = clamp(state.speed, 0, BT.cruise * step * BT.burst * 1.05);
  if (state.speed < 0.05) state.speed = 0;

  // ---- planing. Above planeAt the bow lifts, then levels off as it comes on
  // the plane -- which is what a fast boat actually does, and it is the one
  // visible thing that says "this is not a car".
  const fast = clamp(state.speed / BT.planeAt, 0, 1);
  const wantPlane = fast;
  boat.plane += (wantPlane - boat.plane) * Math.min(1, BT.planeRate * dt);
  const bowUp = Math.sin(clamp(boat.plane, 0, 1) * Math.PI) * BT.bowRise + boat.plane * BT.trim;
  state.pitch += (bowUp - state.pitch) * Math.min(1, 4 * dt);

  // ---- steering. A boat steers from the stern, so it only turns while it is
  // moving, and it BANKS INTO the turn (a car leans out of one).
  const cmd = bank * BT.steerRate;
  boat.steer += (cmd - boat.steer) * Math.min(1, BT.steerAccel * dt);
  const bite = clamp(state.speed / (BT.cruise * 0.25), 0, 1);
  state.heading -= boat.steer * DEG * dt * bite;
  const wantBank = (boat.steer / BT.steerRate) * BT.bankDeg * bite;
  state.bank += (wantBank - state.bank) * Math.min(1, 5 * dt);

  // ---- move
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  state.x += fx * state.speed * dt;
  state.z += fz * state.speed * dt;
  forward.set(fx, 0, fz);

  // ---- NEVER STUCK. A hull up the beach slides itself back into the water.
  // There is no button, no timer he can see, and no failure: it just leaves.
  if (!onWater) {
    boat.beach += dt;
    const d = boatWaterDir(state.x, state.z);
    if (d) {
      // it slides faster the further from the water it has managed to get, so a
      // long beaching is not a long wait
      const push = BT.refloat * Math.min(1, boat.beach / BT.refloatDelay) * clamp(d.r / BT.beachProbe, 1, 4);
      state.x += d.x * push * dt;
      state.z += d.z * push * dt;
    }
    // The backstop fires on TIME, not on failing to find water, and that
    // distinction is the whole of it. Beached against the landward face of the
    // marina wall the search found water fine -- straight through the quay --
    // and pushed him at it, while the hull collision pushed him straight back
    // out again. He sat in that standoff for ever, on water he could see. Any
    // beaching that has not ended in five seconds now ends itself.
    if (boat.beach > BT.strandedAfter) boatStranded();
    if (boat.beach > 0.25 && state.speed > 3) { state.speed *= Math.max(0, 1 - 3 * dt); rumble = Math.max(rumble, 0.14); }
  } else if (boat.beach > 0) {
    boat.beach = 0;
    splashAt(state.x, boatSeaY(), state.z, 1.1);
  }

  // ---- the hull sits on the water, and bobs when it is not driving
  const bob = state.speed < BT.planeAt * 0.3 ? Math.sin(performance.now() * 0.0016) * BT.bob : 0;
  state.y = boatSeaY() + bob + boat.plane * BT.planeLift;
  state.airVy = 0;
  if (state.speed < BT.planeAt * 0.3) state.bank += Math.sin(performance.now() * 0.0012) * 0.02;

  boatWake(dt, fx, fz);
  boatPlume(dt, fx, fz);   // outside boatWake: that returns early below 3 m/s, which is the idle this wisp is for
  boatHitTest(dt, fx, fz);
  boatRampTest(dt);
  boatCannon(dt);
  boatSound();
}

// ---------------------------------------------------------------------------
// Off the ramp: launch, spin, slap down. A belly flop rolls it and it rights
// itself in a second -- that is the whole failure state, and it costs nothing.
// ---------------------------------------------------------------------------
function boatAirborne(dt) {
  const R = TUNE.harbor.ramp;
  boat.airT += dt;
  boat.vy -= BT.gravity * dt;
  state.x += boat.vx * dt;
  state.z += boat.vz * dt;
  state.y += boat.vy * dt;
  state.heading -= boat.spin * dt;
  state.pitch += (12 - state.pitch) * Math.min(1, 2 * dt);
  state.bank += (boat.spin * 14 - state.bank) * Math.min(1, 3 * dt);
  state.speed = Math.hypot(boat.vx, boat.vz);
  forward.set(-Math.sin(state.heading), 0, -Math.cos(state.heading));

  const down = state.y <= boatSeaY() + 0.2;
  if (down || boat.airT > R.maxAir) {
    boat.air = 0;
    state.y = boatSeaY();
    const hard = Math.abs(state.pitch) > 26 || Math.abs(state.bank) > R.flipAt * 40;
    // the slap
    for (let i = 0; i < 12; i++) {
      wakePuff(state.x + (rnd() - 0.5) * 12, boatSeaY() + 1, state.z + (rnd() - 0.5) * 12,
        0xf2f4f7, 2.4, 11, 1.1);
    }
    splashAt(state.x, boatSeaY(), state.z, 2.2);
    noiseBurst(0.35, 900, 0.22, 0);
    cameraNod(1);
    if (hard) { boat.flip = R.flipTime; boing(); } else { chime(); }
    boat.spin = 0;
    state.speed *= 0.72;
    flags.boatJumpLandings = (flags.boatJumpLandings || 0) + 1;
  }
  boatSound();
}

// The ramp itself: hit it fast enough, from the front, and it throws him.
function boatRampTest(dt) {
  const R = TUNE.harbor.ramp, r = harbor.ramp;
  if (!r) return;
  if (boat.rampCool > 0) { boat.rampCool -= dt; return; }
  const dx = state.x - r.x, dz = state.z - r.z;
  if (dx * dx + dz * dz > R.hitR * R.hitR) return;
  if (state.speed < R.minSpeed) return;
  // only from the ramp's own back end: hitting the lip from the front is a wall
  const along = dx * r.fx + dz * r.fz;
  const dot = (-Math.sin(state.heading)) * r.fx + (-Math.cos(state.heading)) * r.fz;
  if (dot < 0.3) return;
  if (along > R.len * 0.4) return;
  boat.air = 1;
  boat.airT = 0;
  boat.rampCool = 2.5;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  boat.vx = fx * state.speed;
  boat.vz = fz * state.speed;
  boat.vy = R.kick + state.speed * R.kickPerSpeed;
  boat.spin = (Math.random() - 0.5) * R.spin;
  cameraPunch(0.8);
  synthBlip("sine", 300, 900, 0.4, 0.16, 0);
  flags.boatJumps = (flags.boatJumps || 0) + 1;
}

// ---------------------------------------------------------------------------
// Crashing. Full speed into a pier, the breakwater, the ferry or the ship is a
// bang; a slow bump is a bump. Both are free.
// ---------------------------------------------------------------------------
function boatHitTest(dt, fx, fz) {
  const PR = BT.hullR;
  for (const b of harbor.solids) {
    if (isSolidHidden(b)) continue;
    if (b.y1 < TUNE.waterLevel - 0.5) continue;     // dredged bottom: nothing to hit
    const ex = b.hw + PR, ez = b.hd + PR;
    if (!(state.x > b.x - ex && state.x < b.x + ex && state.z > b.z - ez && state.z < b.z + ez)) continue;
    if (state.speed > BT.crashSpeed) { boatCrash(); return; }
    // a bump: stop dead, push clear, and make a noise
    const dx = state.x - b.x, dz = state.z - b.z;
    if (Math.abs(dx) / ex > Math.abs(dz) / ez) state.x = b.x + Math.sign(dx || 1) * ex;
    else state.z = b.z + Math.sign(dz || 1) * ez;
    state.speed *= 0.25;
    noiseBurst(0.14, 190, 0.18, 0);
    rumble = Math.max(rumble, 0.2);
    return;
  }
}

// ---------------------------------------------------------------------------
// Wake and spray
// ---------------------------------------------------------------------------
function boatWake(dt, fx, fz) {
  if (state.speed < 3) return;
  boat.wakeT -= dt;
  if (boat.wakeT > 0) return;
  boat.wakeT = lerp(0.09, 0.035, clamp(state.speed / BT.cruise, 0, 1));
  const back = 7 + boat.plane * 4;
  const rx = -fz, rz = fx;
  const spread = BT.wakeSpread[0] + boat.plane * BT.wakeSpread[1];
  // SPRAY FALLS BACK, IT DOES NOT CLIMB. This used to rise at up to 7.2 m/s for
  // a second and a half -- ten metres of white ball, straight up through the
  // chase camera's sightline, which sits 22 m astern and 8 m up. Between that
  // and the rooster tail it read as an engine on fire rather than as water.
  // Kept low and short it is still plainly a wake and it is under the shot.
  for (const s of [-1, 1]) {
    wakePuff(state.x - fx * back + rx * s * spread, boatSeaY() + 0.4, state.z - fz * back + rz * s * spread,
      0xf2f4f7, BT.wakeSize[0] + boat.plane * BT.wakeSize[1],
      BT.wakeRise[0] + boat.plane * BT.wakeRise[1], BT.wakeLife[0] + boat.plane * BT.wakeLife[1]);
  }
  // The rooster tail that used to live here is GONE -- see TUNE.boat's plume
  // block. What is left is one thin wisp at the transom while he is idling
  // along (boatPlume, called from updateBoat so this function's own 3 m/s floor
  // does not swallow it), and nothing at all once he is moving, which is when
  // he is looking where he is going.
}

// ---------------------------------------------------------------------------
// THE STERN PLUME. It is deliberately almost invisible.
//
// It has to stay out of BOTH sightlines, and the two look in opposite
// directions. The helm camera sits 0.3 m FORWARD of centre looking ahead, so
// anything at the transom is behind it and can never be in frame. The chase
// camera sits BT.camChase astern (22 m) and 8 m up, looking forward at a point
// 22 m ahead and 1.4 m up -- so the sightline passes over the transom at
// roughly 6 m above the water. Keeping the wisp low (plumeY, and a rise of half
// a metre a second over a life under a second) keeps it a couple of metres
// under that line, and it is gone entirely above plumeMaxSpeed.
let boatPlumeT = 0;
function boatPlume(dt, fx, fz) {
  const P = BT;
  boatPlumeT -= dt;
  // only at a crawl, only on the water, and never while the hull is up on the
  // plane -- a boat on the plane has its exhaust under the water anyway
  if (state.speed > P.plumeMaxSpeed || state.speed < 0.4 || boat.plane > 0.15) return;
  if (boatPlumeT > 0) return;
  boatPlumeT = P.plumeEvery;
  wakePuff(state.x - fx * P.plumeBack, boatSeaY() + P.plumeY, state.z - fz * P.plumeBack,
    0xf2f4f7, P.plumeSize, P.plumeRise, P.plumeLife);
}

// ---------------------------------------------------------------------------
// THE WATER CANNON -- the one thing only this boat can do.
//
// It exists near the burning rig and nowhere else. Aiming is steering: the arc
// comes off the bow, so pointing the boat at the fire points the water at it.
// Holding it long enough lands one sheet, and a sheet is exactly what a
// helicopter bucket drop is -- fireDropWater() -- so the flames shrink by the
// same amount whichever way he chose to put it out.
// ---------------------------------------------------------------------------
function boatCannonCan() {
  return boatActive() && !state.exploding && typeof fire !== "undefined" && !!fire.g &&
    fire.level > 0 && Math.hypot(state.x - fire.x, state.z - fire.z) < BT.cannonRadius;
}
function boatUpdateCannonButton() {
  const can = boatCannonCan();
  if (!can) { boat.cannonHeld = false; boat.cannon = 0; }
}
function boatCannonPress(on) {
  if (!boatCannonCan()) { boat.cannonHeld = false; return; }
  boat.cannonHeld = !!on;
  if (on) flags.boatCannon = (flags.boatCannon || 0) + 1;
}
function boatCannon(dt) {
  if (!boat.cannonHeld || !boatCannonCan()) {
    boat.cannon = Math.max(0, boat.cannon - dt * 2);
    setTone("boatCannon", "sawtooth", 120, 0);
    return;
  }
  boat.cannon = Math.min(1, boat.cannon + dt * 3);
  setTone("boatCannon", "sawtooth", 140, 0.05 * boat.cannon);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const bx = state.x + fx * 6, bz = state.z + fz * 6;
  const dx = fire.x - bx, dz = fire.z - bz;
  const d = Math.hypot(dx, dz) || 1;
  const aim = (fx * dx + fz * dz) / d;              // 1 when the bow points straight at it
  const inRange = d < BT.cannonReach + BT.cannonSlack;

  // The arc. A real ballistic curve from the bow up to the rig's deck, which is
  // thirty metres above the sea -- a fixed rise looked like a garden hose
  // squirting at the bottom of the legs. It stops at whatever is nearer, the
  // fire or the cannon's own reach, so from far out it reads as a jet falling
  // short rather than as water arriving from nowhere.
  const reach = Math.min(d, BT.cannonReach);
  const topY = (typeof fire !== "undefined" && fire.deck ? fire.deck : TUNE.waterLevel + 26) + 10;
  if (typeof ffPuff === "function") {
    for (let i = 0; i < BT.cannonPuffs; i++) {
      const t = (i + Math.random()) / BT.cannonPuffs;
      const y = lerp(TUNE.waterLevel + 4, topY, Math.sin(t * Math.PI * 0.5));
      ffPuff(bx + fx * reach * t + (Math.random() - 0.5) * 5,
             y,
             bz + fz * reach * t + (Math.random() - 0.5) * 5,
             0, 1.8 + t * 2.6, -4, 0.5, 2.5);
    }
  }

  // A sheet lands when the bow has been pointing at it long enough from close
  // enough. `aim` is the whole gate, so this is POINTING and never timing: get
  // near, point at the fire, hold. There is forty degrees of slop in `cannonAim`
  // because he is four.
  boat.cannonT += dt * clamp((aim - BT.cannonAim) / (1 - BT.cannonAim), 0, 1) * (inRange ? 1 : 0);
  if (boat.cannonT >= BT.cannonSheet) {
    boat.cannonT = 0;
    // it falls out of the sky over the rig, not out of the bottom of the hull
    if (typeof fireDropWater === "function") fireDropWater({ x: fire.x, y: topY + 6, z: fire.z });
    flags.boatCannonSheets = (flags.boatCannonSheets || 0) + 1;
  }
}

// ---------------------------------------------------------------------------
function boatSound() {
  const n = clamp(state.speed / BT.cruise, 0, 1.4);
  const air = boat.air > 0;
  setTone("boatEngine", "sawtooth", lerp(BT.engineHz[0], BT.engineHz[1], n), air ? 0.05 : (state.speed > 0.2 ? 0.055 : 0.02));
  setTone("boatHull", "triangle", 70 + n * 60, !air && state.speed > 4 ? BT.slapGain * n : 0);
  setEngine(0);
}

// ---------------------------------------------------------------------------
// The fallback hull.
//
// The imported body arrives asynchronously and may never arrive at all -- a
// missing file has to be a cosmetic downgrade, never a broken game -- so there
// is a built one underneath it, in the same box: a white planing hull with a red
// flash, a screen and an outboard.
// ---------------------------------------------------------------------------
function buildBoatModel() {
  const C = TUNE.palette;
  const g = new THREE.Group();
  const L = 9.6, W = 2.9, H = 1.5;
  const white = metalMat(C.white, 50, 0x9aa4b0);
  const red = mattMat(C.red);
  const glass = new THREE.MeshPhongMaterial({ color: 0x1b2430, flatShading: true, shininess: 90,
    specular: 0x8fa4bb, transparent: true, opacity: 0.72 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), white);
  hull.position.y = H * 0.4; g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, W / 2, 2.6, 5), white);
  bow.rotation.x = -Math.PI / 2; bow.position.set(0, H * 0.4, -L / 2 - 1.1); g.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.34, L * 0.86), red);
  stripe.position.y = H * 0.06; g.add(stripe);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.16, L * 0.9), mattMat(C.steel));
  deck.position.y = H * 0.92; g.add(deck);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.7, 0.1), glass);
  screen.position.set(0, H * 1.3, -0.7); screen.rotation.x = -0.35; g.add(screen);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.7, 0.18), mattMat(C.night));
  seatBack.position.set(0, H * 1.25, 0.9); g.add(seatBack);
  const outboard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.9), mattMat(C.ink));
  outboard.position.set(0, H * 0.8, L / 2 + 0.4); g.add(outboard);
  g.rotation.order = "YXZ";
  return g;
}

// ---------------------------------------------------------------------------
// The helm view: a windscreen, a wheel that turns, and a throttle lever that
// moves when he drags up. It is feedback, never a control -- he still drives by
// dragging, exactly as he does in the car.
// ---------------------------------------------------------------------------
function boatBuildHelm() {
  if (boat.helm) return boat.helm;
  const C = TUNE.palette, K = BT.helm;
  const g = new THREE.Group();
  const dash = mattMat(C.night), hard = mattMat(C.slate), top = mattMat(C.steel);
  const glass = new THREE.MeshPhongMaterial({ color: 0x1b2430, flatShading: true, shininess: 90,
    specular: 0x8fa4bb, transparent: true, opacity: 0.30 });

  // Kept LOW and THIN, for the reason the car's cabin is: a realistic screen
  // frame a metre from his eye eats a quarter of the picture, and he has to be
  // able to see the water.
  g.add(new THREE.Mesh(carMergeBoxes([
    { w: K.width, h: 0.14, d: 1.5, x: 0, y: K.dashTop, z: -1.5 },        // the dash shelf
    { w: K.width, h: 0.5, d: 0.12, x: 0, y: K.dashTop - 0.34, z: -2.2 }, // its face
  ]), top));
  g.add(new THREE.Mesh(carMergeBoxes([
    { w: K.width + 0.5, h: 0.7, d: 0.16, x: 0, y: K.dashTop - 0.75, z: 0.9 },   // coaming behind him
    { w: 0.16, h: 0.7, d: 2.6, x: -K.width / 2, y: K.dashTop - 0.75, z: -0.3 },
    { w: 0.16, h: 0.7, d: 2.6, x: K.width / 2, y: K.dashTop - 0.75, z: -0.3 },
    { w: 0.9, h: 0.5, d: 0.9, x: K.seatX + 1.5, y: K.dashTop - 0.5, z: -0.2 },  // the seat beside him
  ]), dash));

  // the windscreen: one raked pane, no frame across the middle
  const wind = new THREE.Mesh(new THREE.BoxGeometry(K.width * 0.94, 0.9, 0.08), glass);
  wind.position.set(0, K.dashTop + 0.5, -2.25);
  wind.rotation.x = -0.34;
  g.add(wind);

  // the wheel
  const wheel = new THREE.Group();
  wheel.position.set(K.seatX, K.dashTop + 0.05, -1.45);
  wheel.rotation.x = -0.5;
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 16), mattMat(C.ink)));
  wheel.add(new THREE.Mesh(carMergeBoxes([
    { w: 0.44, h: 0.05, d: 0.05, x: 0, y: 0, z: 0 },
    { w: 0.05, h: 0.44, d: 0.05, x: 0, y: 0, z: 0 },
    { w: 0.14, h: 0.14, d: 0.07, x: 0, y: 0, z: 0.01 },
  ]), hard));
  g.add(wheel);
  boat.helmWheel = wheel;

  // the throttle lever, which moves when he drags up
  const lever = new THREE.Group();
  lever.position.set(K.seatX + 0.52, K.dashTop - 0.1, -1.15);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), hard);
  arm.position.y = 0.21; lever.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mattMat(C.red));
  knob.position.y = 0.44; lever.add(knob);
  g.add(lever);
  boat.helmThrottle = lever;

  g.visible = false;
  scene.add(g);
  boat.helm = g;
  return g;
}
function boatHideHelm() { if (boat.helm) boat.helm.visible = false; }

function boatCamera(dt) {
  camera.up.set(0, 1, 0);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  if (state.viewChase) {
    camDesired.set(state.x - fx * BT.camChase[0], state.y + BT.camChase[1], state.z - fz * BT.camChase[0]);
    camera.position.lerp(camDesired, Math.min(1, BT.camLag * dt));
    lookV.set(state.x + fx * 22, state.y + 1.4, state.z + fz * 22);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG * 0.35);
    boatHideHelm();
  } else {
    const K = BT.helm, rx = -fz, rz = fx;
    camera.position.set(state.x + fx * K.eyeZ + rx * K.seatX, state.y + K.eyeY, state.z + fz * K.eyeZ + rz * K.seatX);
    camera.rotation.set(state.pitch * DEG * 0.5 - 0.03, state.heading, -state.bank * DEG * 0.4);
    const h = boatBuildHelm();
    h.visible = true;
    h.position.set(state.x, state.y, state.z);
    h.rotation.set(state.pitch * DEG * 0.5, state.heading, -state.bank * DEG * 0.4);
    if (boat.helmWheel) boat.helmWheel.rotation.z = -(boat.steer / BT.steerRate) * K.wheelTurn;
    if (boat.helmThrottle) {
      const t = clamp(state.speed / BT.cruise, 0, 1) * 0.5 + (boat.burst > 0 ? 0.5 : 0);
      boat.helmThrottle.rotation.x = lerp(0.5, -0.5, t);
    }
  }
}
