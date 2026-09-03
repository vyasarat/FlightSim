"use strict";
// ---------------------------------------------------------------------------
// The helicopter's own flight model.
//
// It used to fly the plane model, which meant pitch was altitude, the throttle
// did nothing in the air, and it could never leave the runway at all (the plane
// needs rotateSpeed 44 m/s to rotate; this thing tops out at 34). So it has its
// own model now, on the two controls he already knows:
//
//   throttle       up. Hold to climb, let go and it sinks gently, never faster
//                  than maxSink. It sets itself down softly and lifts straight
//                  back off -- no runway, no rotate speed.
//   stick left/right  turn, with a visible lean so it reads as steering.
//   stick up/down     speed. Push forward (drag down) and the nose drops and it
//                  accelerates; pull back and it slows, stops, and can back up.
//
// Let go of everything and it stops and levels within about a second. Hovering
// is the safe state: he can always take his finger off.
// ---------------------------------------------------------------------------

const H = TUNE.heli;
const heli = { vy: 0, turn: 0 };

function heliActive() { return !!(state.vp && state.vp.heli); }

function heliReset() { heli.vy = 0; heli.turn = 0; }

function updateHelicopter(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  // the throttle is the collective: it is up at all times, on the ground and off it
  el.throttleBtn.classList.remove("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden");
  el.fastBtn.classList.add("hidden");
  el.gearBtn.classList.add("hidden");

  const ground = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  const rest = ground + TUNE.gearHeight;
  const bankIn = state.touching ? clamp(state.ctrlBank, -1, 1) : 0;
  const pitchIn = state.touching ? clamp(state.ctrlPitch, -1, 1) : 0;
  // Drag down = forward (the nose drops and it goes), drag up = slow, stop, back
  // up. That keeps "drag up = nose up" true: pulling back does raise the nose.
  const speedIn = -pitchIn;

  // ---- turn, with the lean that makes it read as steering
  heli.turn += (bankIn * H.turnRate - heli.turn) * Math.min(1, H.turnAccel * dt);
  if (Math.abs(heli.turn) < 0.05) heli.turn = 0;
  state.heading -= heli.turn * DEG * dt;
  const wantBank = (heli.turn / H.turnRate) * H.bankDeg;
  state.bank += (wantBank - state.bank) * Math.min(1, H.levelRate * dt);

  // ---- speed along the nose
  const wantSpeed = grounded ? 0 : (speedIn >= 0 ? speedIn * H.cruise : speedIn * H.reverse);
  const k = state.touching ? H.accel : H.hoverDamp;   // let go and it stops promptly
  state.speed += (wantSpeed - state.speed) * Math.min(1, k * dt);
  if (Math.abs(state.speed) < H.stopBelow) state.speed = 0;
  // the nose tilts down with speed, and levels off when it stops
  const wantPitch = -(state.speed / H.cruise) * H.noseDeg;
  state.pitch += (wantPitch - state.pitch) * Math.min(1, H.levelRate * dt);

  // ---- up and down: hold to climb, let go and it settles
  const wantVy = state.throttleHeld ? H.climb : (grounded ? 0 : -H.maxSink);
  heli.vy += (wantVy - heli.vy) * Math.min(1, H.vAccel * dt);
  heli.vy = clamp(heli.vy, -H.maxSink, H.climb);      // it can never come down hard

  if (grounded) {
    state.y = rest;
    state.speed = 0;
    heli.turn *= 1 - Math.min(1, 4 * dt);
    setRolling(0);
    if (state.throttleHeld && !menuOpen() && heli.vy > 0.4) {
      state.phase = "AIRBORNE";
      state.liftoffTimer = 0;
      state.maxAglSinceLiftoff = 1e9;
      flags.liftoff++;
      flags.heliLiftoffs = (flags.heliLiftoffs || 0) + 1;
    }
  } else {
    state.y += heli.vy * dt;
  }

  const hr = state.heading;
  const fx = -Math.sin(hr), fz = -Math.cos(hr);
  state.x += fx * state.speed * dt;
  state.z += fz * state.speed * dt;
  // the shared systems read the travel direction off `forward` and `airVy`
  forward.set(fx, 0, fz);
  state.airVy = heli.vy;

  setEngine(clamp(0.45 + Math.abs(state.speed) / H.cruise * 0.55, 0, 1.2));

  // ---- the ceiling, the same one every other non-rocket has
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
    state.speed = 0;
    if (!state.heliDown) { state.heliDown = true; chirp(); touchdownFx(); flags.heliLandings = (flags.heliLandings || 0) + 1; }
  } else if (state.y > rest + 1) {
    state.heliDown = false;
  }
}
