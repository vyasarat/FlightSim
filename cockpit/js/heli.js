"use strict";
// WORKING RULES (moved here from CLAUDE.md)
// This file owns both the ground and the air for the helicopter: the plane path
// in flight.js never runs for it. Sequential controls, one finger -- a tap sets a
// fixed horizontal destination; up/down change altitude without cancelling
// travel, and releasing them holds height. Freeze the picking camera for each
// gesture and filter small finger jitter; never re-aim from camera movement.
// Horizontal velocity is independent of body yaw. Arrival stops travel in a
// hover. No throttle, and no state may ever need two simultaneous touches.
// The touch point arrives as state.touchNX/NY (NDC); the plane and rocket ignore
// those entirely. Separate altitude controls and helicopter-only tuning were
// explicitly authorised -- preserve plane, rocket and Mars drone tuning.
// Tap a destination, then adjust height with the up/down buttons. The destination
// stays in world space while the camera moves and while the same finger changes
// altitude. Hover cancels travel; releasing an altitude button holds that height.

const H = TUNE.heli;
const heli = {
  vy: 0, turn: 0, speed: 0, vx: 0, vz: 0,
  facing: null, target: null, targetDist: 0, sky: false,
  altitude: null, cameraY: null, cameraAhead: H.cameraLookAhead, vertical: 0, wasTouching: false, lastNX: null, lastNY: null,
};

function heliActive() { return !!(state.vp && state.vp.heli); }
function heliReset() {
  heli.vy = 0; heli.turn = 0; heli.speed = 0; heli.vx = heli.vz = 0;
  heliEndGesture();
  heli.facing = null; heli.target = null; heli.targetDist = 0; heli.sky = false;
  heli.altitude = null; heli.cameraY = null; heli.cameraAhead = H.cameraLookAhead; heli.vertical = 0; heli.wasTouching = false;
  heli.lastNX = heli.lastNY = null;
  if (typeof releaseHeliAltitude === "function") releaseHeliAltitude();
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
  const under = (t) => (o.y + d.y * t) <= Math.max(terrainEff(o.x + d.x * t, o.z + d.z * t), TUNE.waterLevel);
  let prev = 0;
  const lim = Math.min(maxD, H.pickRange);
  for (let t = H.pickStep; t <= lim; t += H.pickStep) {
    if (under(t)) {
      // A graze: the ray dips under a crest and comes out again beyond it. That is
      // not what he is pointing at -- keep going until it stays under.
      let stays = true;
      for (let k = 1; k <= H.grazeSteps; k++) {
        const q = t + k * H.pickStep;
        if (q > lim) break;
        const sy = Math.max(terrainEff(o.x + d.x * q, o.z + d.z * q), TUNE.waterLevel);
        if ((o.y + d.y * q) > sy + H.grazeMargin) { stays = false; break; }
      }
      if (!stays) { prev = t; continue; }
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
  heliRay.setFromCamera(heliNdc, heliGesture.active ? heliGestureCamera : camera);
  const o = heliRay.ray.origin, d = heliRay.ray.direction;
  let best = null;
  // the things worth touching that stand above the ground
  heliPickList.length = 0;
  if (typeof fire !== "undefined" && fire.g) heliPickList.push(fire.g);
  if (typeof carrier !== "undefined" && carrier.g) heliPickList.push(carrier.g);
  if (typeof demo !== "undefined" && demo.g && demo.g.visible) heliPickList.push(demo.g);
  if (typeof toyWorld !== "undefined") {
    for (const yard of toyWorld.yards) if (yard.g.visible) heliPickList.push(yard.g);
    for (const o of toyWorld.objects) if (o.g.visible && o !== toyWorld.held) heliPickList.push(o.g);
  }
  if (typeof yacht !== "undefined" && yacht.g && yacht.g.visible) {
    // Raycaster does not refresh world matrices, and the ship is placed during
    // the UPDATE rather than the render -- so without this the ray is tested
    // against wherever she was last DRAWN, which in a headless run is the world
    // origin. car.js's centre-screen tap learned the same lesson.
    yacht.g.updateWorldMatrix(true, true);
    heliPickList.push(yacht.g);
  }
  heliHitYacht = false;
  if (heliPickList.length) {
    const hits = heliRay.intersectObjects(heliPickList, true);
    if (hits.length) {
      best = { point: hits[0].point.clone(), dist: hits[0].distance };
      // Touching the SHIP means the PAD. She is fifty metres long and the only
      // place on her a helicopter can go down is a seven-metre circle on her
      // stern; aiming at the point of hull he happened to touch would hover him
      // beside a wall instead.
      if (typeof yacht !== "undefined" && yacht.g && heliUnder(hits[0].object, yacht.g)) {
        const p = yachtPadWorld();
        if (p) { best.point.set(p.x, p.y, p.z); heliHitYacht = true; }
      }
    }
  }
  const g = heliGroundHit(o, d, best ? best.dist : H.pickRange);
  if (g && (!best || g.dist < best.dist)) best = g;
  return best;
}

let heliHitYacht = false;
function heliUnder(o, root) { for (let n = o; n; n = n.parent) if (n === root) return true; return false; }

// Freeze the view for one gesture: camera movement must not steer the aircraft.
const heliGestureCamera = camera.clone();
const heliGesture = { active: false, nx: 0, ny: 0, x: 0, z: 0 };
function heliBeginGesture(nx, ny) {
  camera.updateMatrixWorld();
  heliGestureCamera.copy(camera); heliGestureCamera.matrixWorld.copy(camera.matrixWorld);
  heliGestureCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
  heliGesture.active = true; heliGesture.nx = nx; heliGesture.ny = ny;
  heliGesture.x = state.x; heliGesture.z = state.z;
  heliAim(nx, ny);
}
function heliMoveGesture(nx, ny) {
  if (!heliGesture.active) return;
  const pixels = Math.hypot((nx - heliGesture.nx) * innerWidth / 2, (ny - heliGesture.ny) * innerHeight / 2);
  if (pixels < H.dragDeadzone) return;
  heliGesture.nx = nx; heliGesture.ny = ny; heliAim(nx, ny);
}
function heliEndGesture() { heliGesture.active = false; }
function heliHover() {
  heli.target = null; heli.sky = false; heli.facing = null; heli.followPad = false;
  heli.altitude = state.y; heli.vy = 0;
}
function heliAim(nx, ny) {
  const hit = heliPick(nx, ny);
  heli.sky = !hit;
  // A MOVING landing target. The pad is a fixed point only while she is stopped;
  // aimed at a ship under way, a fixed point is where she used to be.
  heli.followPad = !!(hit && heliHitYacht);
  if (hit) heli.target = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
  else {
    const d = heliRay.ray.direction, len = Math.hypot(d.x, d.z);
    if (len < 1e-4) return;
    heli.target = { x: (heliGesture.active ? heliGesture.x : state.x) + d.x / len * H.headingRange, y: state.y, z: (heliGesture.active ? heliGesture.z : state.z) + d.z / len * H.headingRange };
  }
}
const heliMarkerPoint = new THREE.Vector3();
function updateHeliControls() {
  if (heliActive() && state.exploding) heliReset();
  const visible = heliActive() && !menuOpen() && !state.exploding;
  for (const id of ["heliUpBtn", "heliDownBtn"]) el[id].classList.toggle("hidden", !visible);
  el.heliUpBtn.classList.toggle("pressed", visible && heli.vertical > 0);
  el.heliDownBtn.classList.toggle("pressed", visible && heli.vertical < 0);
  el.heliTarget.classList.toggle("hidden", !visible || !heli.target);
  if (!visible || !heli.target) return;
  // A ring marks the selected surface (or held height for a sky bearing). An
  // arrow keeps the bearing readable even while the helicopter turns around.
  camera.updateMatrixWorld();
  heliMarkerPoint.set(heli.target.x, heli.sky ? state.y : heli.target.y + 2, heli.target.z).project(camera);
  let x = heliMarkerPoint.x, y = heliMarkerPoint.y;
  if (heliMarkerPoint.z > 1) { x = -x; y = -y; }
  const off = heliMarkerPoint.z > 1 || Math.abs(x) > .78 || Math.abs(y) > .65;
  el.heliTarget.classList.toggle("offscreen", off);
  el.heliTarget.style.left = ((clamp(x, -.78, .78) + 1) * 50) + "%";
  el.heliTarget.style.top = ((1 - clamp(y, -.65, .65)) * 50) + "%";
  el.heliTarget.style.setProperty("--bearing", Math.atan2(x, y) + "rad");
}

function updateHelicopter(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  // The altitude buttons replace the throttle. The speed control is still here,
  // as the single cycling stepper -- this column has no room for a pair, which
  // js/speed.js explains and spdUpdateButtons decides.
  el.rotateArrow.classList.remove("on");

  // The yacht's helipad is GROUND while he is over it -- that one substitution is
  // the whole of "a moving landing target", because everything below already
  // knows how to land on ground.
  const yPad = typeof yachtPadUnder === "function" ? yachtPadUnder(state.x, state.z) : null;
  if (heli.followPad && typeof yachtPadWorld === "function") {
    const p = yachtPadWorld();
    if (p && heli.target) { heli.target.x = p.x; heli.target.y = p.y; heli.target.z = p.z; }
    else heli.followPad = false;
  }
  const ground = yPad ? yPad.y : Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  const rest = ground + TUNE.gearHeight;
  const touching = state.touching;
  // a real finger has a place on the screen; the keyboard and the test hooks
  // fall back to the stick values, which mean the same thing on screen
  const nx = touching ? (state.touchIsPoint ? state.touchNX : clamp(state.ctrlBank, -1, 1)) : 0;
  const ny = touching ? (state.touchIsPoint ? state.touchNY : clamp(state.ctrlPitch, -1, 1)) : 0;

  if (heli.altitude === null) heli.altitude = state.y;
  // Only a new touch or drag changes the destination, never camera motion alone.
  if (touching && !state.touchIsPoint && (!heli.wasTouching || nx !== heli.lastNX || ny !== heli.lastNY)) heliAim(nx, ny);
  heli.wasTouching = touching; heli.lastNX = nx; heli.lastNY = ny;
  if (heli.vertical) heli.altitude = clamp(state.y + heli.vertical * H.altitudeLead, rest - 1, TUNE.otherVehicleCeiling);
  let wantYaw = null, wantSpeed = 0;
  // Anticipate rising terrain instead of waiting for an abrupt floor correction.
  if (heli.target && heli.vertical >= 0 && !grounded) {
    for (const t of [.5, 1]) {
      const floor = Math.max(terrainEff(state.x + heli.vx * H.terrainLookahead * t, state.z + heli.vz * H.terrainLookahead * t), TUNE.waterLevel);
      heli.altitude = Math.max(heli.altitude, floor + H.terrainClearance);
    }
  }
  const wantVy = clamp((heli.altitude - state.y) * H.vGain, -H.maxSink, H.climb);
  if (heli.target) {
    const dx = heli.target.x - state.x, dz = heli.target.z - state.z;
    const dist = Math.hypot(dx, dz);
    heli.targetDist = dist;
    if (dist < H.arriveDist) { heli.target = null; heli.sky = false; }
    else {
      wantYaw = Math.atan2(-dx, -dz);
      // Point-to-go: the step scales the CRUISE CAP only. `dist * H.approach`
      // is the arrival taper and stays exactly as it was, so he still eases
      // into the spot he touched (js/speed.js).
      wantSpeed = Math.min(H.cruise * spdMul(), dist * H.approach);
    }
  }

  // ---- yaw: finish facing the chosen bearing, independently of translation
  if (wantYaw !== null) heli.facing = wantYaw;
  const yawErr = heli.facing === null ? 0 : wrapPi(heli.facing - state.heading);
  const cmd = clamp(-yawErr / DEG * H.yawGain, -H.turnRate, H.turnRate);

  heli.turn += (cmd - heli.turn) * Math.min(1, H.turnAccel * dt);
  if (Math.abs(heli.turn) < 0.05) heli.turn = 0;
  state.heading -= heli.turn * DEG * dt;
  state.bank += ((heli.turn / H.turnRate) * H.bankDeg - state.bank) * Math.min(1, H.levelRate * dt);

  // ---- horizontal motion: ease into the selected destination
  if (heli.vertical < 0) wantSpeed *= clamp((state.y - rest) / H.landingBrakeH, 0, 1);
  if (grounded) wantSpeed = 0;
  // A helicopter can move sideways: heading follows smoothly without rotating
  // an existing forward velocity or stopping travel for every course correction.
  const tx = wantYaw === null ? 0 : -Math.sin(wantYaw) * wantSpeed;
  const tz = wantYaw === null ? 0 : -Math.cos(wantYaw) * wantSpeed;
  const dxv = tx - heli.vx, dzv = tz - heli.vz, change = Math.hypot(dxv, dzv);
  const rate = wantSpeed > heli.speed ? H.horizontalAccel : H.horizontalBrake;
  const blend = change ? Math.min(1, rate * dt / change, heli.target ? H.accel * dt : 1) : 0;
  heli.vx += dxv * blend; heli.vz += dzv * blend;
  heli.speed = Math.hypot(heli.vx, heli.vz);
  state.speed = heli.speed;
  state.pitch += (-(heli.speed / H.cruise) * H.noseDeg - state.pitch) * Math.min(1, H.levelRate * dt);

  // ---- up and down. Releasing a button holds height; descent stays gentle.
  heli.vy += (wantVy - heli.vy) * Math.min(1, H.vAccel * dt);
  heli.vy = clamp(heli.vy, -H.maxSink, H.climb);

  if (grounded) {
    state.y = rest;
    heli.speed = 0; heli.vx = heli.vz = 0; state.speed = 0;
    heli.turn *= 1 - Math.min(1, 4 * dt);
    setRolling(0);
    if ((heli.target || heli.vertical > 0) && !menuOpen()) {
      state.phase = "AIRBORNE";
      heli.altitude = Math.max(heli.altitude, rest + H.hoverAgl);
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
  state.x += heli.vx * dt;
  state.z += heli.vz * dt;
  forward.set(fx, 0, fz);          // the shared systems read travel off these two
  state.airVy = heli.vy;

  setEngine(clamp(0.45 + heli.speed / H.cruise * 0.55, 0, 1.2));

  if (state.vp.capped && state.y > TUNE.otherVehicleCeiling) {
    state.y = TUNE.otherVehicleCeiling;
    if (heli.vy > 0) heli.vy = 0;
  }

  if (heli.vertical >= 0 && !grounded) {
    const clearance = (yPad ? yPad.y : Math.max(terrainEff(state.x, state.z), TUNE.waterLevel)) + TUNE.gearHeight;
    if (state.y < clearance) { state.y = clearance; heli.altitude = Math.max(heli.altitude, clearance); heli.vy = Math.max(0, heli.vy); }
  }

  // walls are still walls: fly into a tower and it goes bang, like anything else
  resolveSolidWalls();
  if (state.exploding) return;

  // ---- the sea is a floor, not a landing place. Sitting on it would end the
  // flight and take the bucket button away in the one spot he needs it.
  const overWater = !yPad && terrainEff(state.x, state.z) < TUNE.waterLevel - 0.5;
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
    heli.speed = 0; heli.vx = heli.vz = 0; state.speed = 0; heli.target = null; heli.altitude = rest;
    if (!state.heliDown) { state.heliDown = true; chirp(); touchdownFx(); flags.heliLandings = (flags.heliLandings || 0) + 1; }
  } else if (state.y > rest + 1) {
    state.heliDown = false;
  }
}
