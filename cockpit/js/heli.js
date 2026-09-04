"use strict";
// ---------------------------------------------------------------------------
// The helicopter's flight model. One finger, and the stick means exactly what
// it means in the plane.
//
//   finger on the screen    it flies forward at cruise
//   drag up / down          climb / descend  (the same as the plane: up is up)
//   drag left / right       turn, leaning into it
//   finger off              it stops, holds its height and levels off, in about
//                           a second. Hovering is the safe state.
//
// There is no throttle button: taking off is dragging up and landing is dragging
// down until it settles. Nothing here ever needs a second finger.
//
// Near a job -- low over open water, or by the burning rig -- it brakes to a
// hover by itself even with a finger down, so he can aim at the thing and have
// it stop for him. Pointing, not timing.
// ---------------------------------------------------------------------------

const H = TUNE.heli;
const heli = { vy: 0, turn: 0, speed: 0, braking: false };

function heliActive() { return !!(state.vp && state.vp.heli); }
function heliReset() { heli.vy = 0; heli.turn = 0; heli.speed = 0; heli.braking = false; }
function heliDead(v) { return Math.abs(v) < H.deadzone ? 0 : (v - Math.sign(v) * H.deadzone) / (1 - H.deadzone); }

// The places he has a job to do, and only those.
//
//   the fire      within jobRadius of the rig, whatever he is carrying
//   the water     the water he would actually scoop from: an empty bucket, low,
//                 over water, and near enough to the rig to be part of the job
//
// Open sea further out is just sea -- he flies straight over it -- and a full
// bucket never brakes anywhere, so the trip back to the fire is at full speed.
function heliJobNear() {
  if (typeof fire === "undefined" || !fire.g) return false;
  const d = Math.hypot(state.x - fire.x, state.z - fire.z);
  if (d < H.jobRadius) return true;
  if (typeof bucket !== "undefined" && bucket.state !== "empty") return false;
  if (d > TUNE.firefight.scoopRadius) return false;
  const g = terrainEff(state.x, state.z);
  return g < TUNE.waterLevel - 1 && (state.y - TUNE.waterLevel) < TUNE.firefight.scoopAlt;
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
  const flying = state.touching;
  const turnIn = flying ? heliDead(clamp(state.ctrlBank, -1, 1)) : 0;
  const upIn = flying ? heliDead(clamp(state.ctrlPitch, -1, 1)) : 0;   // drag up = up, as in the plane

  // ---- turn, leaning into it so it reads as steering
  heli.turn += (turnIn * H.turnRate - heli.turn) * Math.min(1, H.turnAccel * dt);
  if (Math.abs(heli.turn) < 0.05) heli.turn = 0;
  state.heading -= heli.turn * DEG * dt;
  state.bank += ((heli.turn / H.turnRate) * H.bankDeg - state.bank) * Math.min(1, H.levelRate * dt);

  // ---- forward. A finger on the screen means go; near a job it stops for him.
  heli.braking = !grounded && heliJobNear();
  const wantSpeed = (flying && !grounded && !heli.braking) ? H.cruise : 0;
  const k = wantSpeed > 0 ? H.accel : (heli.braking ? H.jobBrake : H.hoverDamp);
  heli.speed += (wantSpeed - heli.speed) * Math.min(1, k * dt);
  if (heli.speed < H.stopBelow) heli.speed = 0;
  state.speed = heli.speed;
  // it noses down as it goes, and lifts its nose as he climbs
  const wantPitch = -(heli.speed / H.cruise) * H.noseDeg + upIn * H.climbPitchDeg;
  state.pitch += (wantPitch - state.pitch) * Math.min(1, H.levelRate * dt);

  // ---- up and down. No input holds the height; it can never come down hard.
  const wantVy = upIn >= 0 ? upIn * H.climb : upIn * H.maxSink;
  heli.vy += (wantVy - heli.vy) * Math.min(1, H.vAccel * dt);
  heli.vy = clamp(heli.vy, -H.maxSink, H.climb);

  if (grounded) {
    state.y = rest;
    heli.speed = 0; state.speed = 0;
    heli.turn *= 1 - Math.min(1, 4 * dt);
    setRolling(0);
    if (heli.vy > 0.4 && !menuOpen()) {          // drag up: it lifts straight off
      state.phase = "AIRBORNE";
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

  // ---- the ground. It can only ever arrive at maxSink, so setting down is soft:
  // no bounce, no bang. It rests on the water the same way.
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
