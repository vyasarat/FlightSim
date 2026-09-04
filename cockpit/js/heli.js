"use strict";
// ---------------------------------------------------------------------------
// The helicopter: point-to-go.
//
// A stick cannot say "up, and forward, and round" at once to a four-year-old.
// So there is no stick here. He puts a finger on a place -- the sea, the fire,
// the deck, a hillside -- and the helicopter turns toward it and flies there,
// slowing as it arrives and settling into a hover above it. A finger on the sky
// means "that way, and up". A finger at the edge of the screen spins it round.
// Taking the finger off always means stop.
//
//   finger on a place    turn to it, fly there, hover over it at hoverAgl
//   finger on a place    ... or, if that place is right underneath, land on it
//   finger on the sky    go that way and climb (higher on screen = faster)
//   finger at the edge   keep turning that way
//   finger off           stop, level, hold height, in about a second
//
// One finger, always: there is no throttle and nothing else to hold.
// ---------------------------------------------------------------------------

const H = TUNE.heli;
const heli = {
  vy: 0, turn: 0, speed: 0,
  braking: false, target: null, targetDist: 0, sky: false,
};

function heliActive() { return !!(state.vp && state.vp.heli); }
function heliReset() {
  heli.vy = 0; heli.turn = 0; heli.speed = 0;
  heli.braking = false; heli.target = null; heli.targetDist = 0; heli.sky = false;
}

// The places he has a job to do, and only those: the fire, whatever he carries,
// and the water he would actually scoop from. Open sea elsewhere is just sea.
function heliJobNear() {
  if (typeof fire === "undefined" || !fire.g) return false;
  const d = Math.hypot(state.x - fire.x, state.z - fire.z);
  if (d < H.jobRadius) return true;
  if (typeof bucket !== "undefined" && bucket.state !== "empty") return false;
  if (d > TUNE.firefight.scoopRadius) return false;
  const g = terrainEff(state.x, state.z);
  return g < TUNE.waterLevel - 1 && (state.y - TUNE.waterLevel) < TUNE.firefight.scoopAlt;
}

// ---- what is under his finger
const heliRay = new THREE.Raycaster();
const heliNdc = new THREE.Vector2();
const heliHit = new THREE.Vector3();
const heliPickList = [];

// The ground and the sea, marched analytically: no mesh needed, so it works the
// same wherever the terrain chunks happen to be streamed in.
function heliGroundHit(o, d, maxD) {
  if (d.y > -0.0005) return null;                       // pointing up: sky
  let prev = 0;
  const lim = Math.min(maxD, H.pickRange);
  for (let t = H.pickStep; t <= lim; t += H.pickStep) {
    const y = o.y + d.y * t;
    const g = Math.max(terrainEff(o.x + d.x * t, o.z + d.z * t), TUNE.waterLevel);
    if (y <= g) {
      let lo = prev, hi = t;
      for (let i = 0; i < 8; i++) {
        const m = (lo + hi) / 2;
        const my = o.y + d.y * m;
        if (my <= Math.max(terrainEff(o.x + d.x * m, o.z + d.z * m), TUNE.waterLevel)) hi = m; else lo = m;
      }
      const px = o.x + d.x * hi, pz = o.z + d.z * hi;
      heliHit.set(px, Math.max(terrainEff(px, pz), TUNE.waterLevel), pz);
      return { point: heliHit, dist: hi };
    }
    prev = t;
  }
  return null;
}

function heliPick(nx, ny) {
  camera.updateMatrixWorld();
  heliNdc.set(nx, ny);
  heliRay.setFromCamera(heliNdc, camera);
  const o = heliRay.ray.origin, d = heliRay.ray.direction;
  let best = null;
  // the things worth touching that stand above the ground
  heliPickList.length = 0;
  if (typeof fire !== "undefined" && fire.g) heliPickList.push(fire.g);
  if (typeof carrier !== "undefined" && carrier.g) heliPickList.push(carrier.g);
  if (typeof demo !== "undefined" && demo.g && demo.g.visible) heliPickList.push(demo.g);
  if (heliPickList.length) {
    const hits = heliRay.intersectObjects(heliPickList, true);
    if (hits.length) best = { point: hits[0].point, dist: hits[0].distance };
  }
  const g = heliGroundHit(o, d, best ? best.dist : H.pickRange);
  if (g && (!best || g.dist < best.dist)) best = g;
  return best;
}

function updateHelicopter(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  // one finger, always: there is nothing else to hold
  el.throttleBtn.classList.add("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden");
  el.fastBtn.classList.add("hidden");
  el.gearBtn.classList.add("hidden");

  const ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  const rest = ground + TUNE.gearHeight;
  const touching = state.touching;
  // a real finger has a place on the screen; the keyboard and the test hooks
  // fall back to the stick values, which mean the same thing on screen
  const nx = touching ? (state.touchIsPoint ? state.touchNX : clamp(state.ctrlBank, -1, 1)) : 0;
  const ny = touching ? (state.touchIsPoint ? state.touchNY : clamp(state.ctrlPitch, -1, 1)) : 0;

  let wantYaw = null, wantSpeed = 0, wantVy = 0, edgeYaw = 0;
  heli.target = null; heli.sky = false;

  if (touching) {
    if (nx < -1 + H.edgeYawBand) edgeYaw = -1;
    else if (nx > 1 - H.edgeYawBand) edgeYaw = 1;
    const hit = heliPick(nx, ny);
    if (hit) {
      heli.target = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      const dx = hit.point.x - state.x, dz = hit.point.z - state.z;
      const dist = Math.hypot(dx, dz);
      heli.targetDist = dist;
      if (dist > 1) wantYaw = Math.atan2(-dx, -dz);
      // Hover over a place; settle onto one he has essentially arrived at. The
      // threshold grows with height, because from the cockpit he can only touch
      // what is ahead of him -- so holding a finger on the ground always walks
      // him down to it, a step at a time, instead of stalling in a hover.
      const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
      const aimY = dist < H.landRadius + agl * 0.9 ? hit.point.y : hit.point.y + H.hoverAgl;
      wantVy = clamp((aimY - state.y) * H.vGain, -H.maxSink, H.climb);
      wantSpeed = Math.min(H.cruise, dist * H.approach);
    } else {
      // the sky: go that way, and up. Higher on the screen climbs harder.
      heli.sky = true;
      const d = heliRay.ray.direction;
      if (Math.abs(d.x) + Math.abs(d.z) > 1e-4) wantYaw = Math.atan2(-d.x, -d.z);
      wantSpeed = H.cruise;
      wantVy = H.climb * clamp(ny, 0.15, 1);
    }
  }

  // ---- yaw: ease onto the bearing, plus whatever the screen edge is asking for
  const yawErr = wantYaw === null ? 0 : wrapPi(wantYaw - state.heading);
  let cmd = clamp(-yawErr / DEG * H.yawGain, -H.turnRate, H.turnRate);
  cmd = clamp(cmd + edgeYaw * H.edgeYawRate, -H.turnRate * 1.6, H.turnRate * 1.6);
  if (!touching) cmd = 0;
  heli.turn += (cmd - heli.turn) * Math.min(1, H.turnAccel * dt);
  if (Math.abs(heli.turn) < 0.05) heli.turn = 0;
  state.heading -= heli.turn * DEG * dt;
  state.bank += ((heli.turn / H.turnRate) * H.bankDeg - state.bank) * Math.min(1, H.levelRate * dt);

  // ---- forward: it turns first and then goes, and stops itself at a job
  heli.braking = !grounded && heliJobNear();
  if (heli.braking || grounded) wantSpeed = 0;
  else if (wantYaw !== null) wantSpeed *= Math.max(0, Math.cos(yawErr));
  const k = wantSpeed > heli.speed ? H.accel : (heli.braking ? H.jobBrake : H.hoverDamp);
  heli.speed += (wantSpeed - heli.speed) * Math.min(1, k * dt);
  if (heli.speed < H.stopBelow) heli.speed = 0;
  state.speed = heli.speed;
  state.pitch += (-(heli.speed / H.cruise) * H.noseDeg - state.pitch) * Math.min(1, H.levelRate * dt);

  // ---- up and down. No finger holds the height; it can never come down hard.
  heli.vy += ((touching ? wantVy : 0) - heli.vy) * Math.min(1, H.vAccel * dt);
  heli.vy = clamp(heli.vy, -H.maxSink, H.climb);

  if (grounded) {
    state.y = rest;
    heli.speed = 0; state.speed = 0;
    heli.turn *= 1 - Math.min(1, 4 * dt);
    setRolling(0);
    if (touching && !menuOpen()) {          // any touch gets it off the ground
      state.phase = "AIRBORNE";
      heli.vy = Math.max(heli.vy, H.liftKick);
      state.liftoffTimer = 0;
      state.maxAglSinceLiftoff = 1e9;
      flags.liftoff++;
      flags.heliLiftoffs = (flags.heliLiftoffs || 0) + 1;
    } else if (heli.vy < 0) {
      heli.vy = 0;
    }
  } else {
    state.y += heli.vy * dt;
  }

  const hr = state.heading;
  const fx = -Math.sin(hr), fz = -Math.cos(hr);
  state.x += fx * heli.speed * dt;
  state.z += fz * heli.speed * dt;
  forward.set(fx, 0, fz);          // the shared systems read travel off these two
  state.airVy = heli.vy;

  setEngine(clamp(0.45 + heli.speed / H.cruise * 0.55, 0, 1.2));

  if (state.vp.capped && state.y > TUNE.otherVehicleCeiling) {
    state.y = TUNE.otherVehicleCeiling;
    if (heli.vy > 0) heli.vy = 0;
  }

  // walls are still walls: fly into a tower and it goes bang, like anything else
  resolveSolidWalls();
  if (state.exploding) return;

  // ---- the sea is a floor, not a landing place. Sitting on it would end the
  // flight and take the bucket button away in the one spot he needs it.
  const overWater = terrainEff(state.x, state.z) < TUNE.waterLevel - 0.5;
  if (overWater) {
    const floor = TUNE.waterLevel + H.waterFloor;
    if (state.y < floor) { state.y = floor; if (heli.vy < 0) heli.vy = 0; }
    state.heliDown = false;
    return;
  }
  // ---- the ground. It can only ever arrive at maxSink, so setting down is soft.
  if (!grounded && state.y <= rest && heli.vy <= 0) {
    state.y = rest;
    heli.vy = 0;
    state.phase = "TAXI";
    heli.speed = 0; state.speed = 0;
    if (!state.heliDown) { state.heliDown = true; chirp(); touchdownFx(); flags.heliLandings = (flags.heliLandings || 0) + 1; }
  } else if (state.y > rest + 1) {
    state.heliDown = false;
  }
}
