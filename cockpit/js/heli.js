"use strict";
// Tap a destination, then adjust height with the up/down buttons. The destination
// stays in world space while the camera moves and while the same finger changes
// altitude. Hover cancels travel; releasing an altitude button holds that height.

const H = TUNE.heli;
const heli = {
  vy: 0, turn: 0, speed: 0,
  braking: false, target: null, targetDist: 0, sky: false,
  altitude: null, vertical: 0, wasTouching: false, lastNX: null, lastNY: null,
};

function heliActive() { return !!(state.vp && state.vp.heli); }
function heliReset() {
  heli.vy = 0; heli.turn = 0; heli.speed = 0;
  heli.braking = false; heli.target = null; heli.targetDist = 0; heli.sky = false;
  heli.altitude = null; heli.vertical = 0; heli.wasTouching = false;
  heli.lastNX = heli.lastNY = null;
  if (typeof releaseHeliAltitude === "function") releaseHeliAltitude();
}

// Use the gentler firefighting deceleration near the rig. Water and the edge
// of this area are never destinations themselves: keep flying to his tap.
function heliJobNear() {
  if (typeof fire === "undefined" || !fire.g) return false;
  return Math.hypot(state.x - fire.x, state.z - fire.z) < H.jobRadius;
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
  heliRay.setFromCamera(heliNdc, camera);
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
  if (heliPickList.length) {
    const hits = heliRay.intersectObjects(heliPickList, true);
    if (hits.length) best = { point: hits[0].point, dist: hits[0].distance };
  }
  const g = heliGroundHit(o, d, best ? best.dist : H.pickRange);
  if (g && (!best || g.dist < best.dist)) best = g;
  return best;
}

function heliHover() {
  heli.target = null; heli.sky = false;
  heli.altitude = state.y; heli.vy = 0;
}
function heliAim(nx, ny) {
  const hit = heliPick(nx, ny);
  heli.sky = !hit;
  if (hit) heli.target = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
  else {
    const d = heliRay.ray.direction, len = Math.hypot(d.x, d.z);
    if (len < 1e-4) return;
    heli.target = { x: state.x + d.x / len * H.headingRange, y: state.y, z: state.z + d.z / len * H.headingRange };
  }
}
const heliMarkerPoint = new THREE.Vector3();
function updateHeliControls() {
  if (heliActive() && state.exploding) heliReset();
  const visible = heliActive() && !menuOpen() && !state.exploding;
  for (const id of ["heliUpBtn", "heliDownBtn", "heliHoverBtn"]) el[id].classList.toggle("hidden", !visible);
  el.heliUpBtn.classList.toggle("pressed", visible && heli.vertical > 0);
  el.heliDownBtn.classList.toggle("pressed", visible && heli.vertical < 0);
  el.heliHoverBtn.classList.toggle("holding", visible && !heli.target);
  el.heliTarget.classList.toggle("hidden", !visible || !heli.target);
  if (!visible || !heli.target) return;
  // A ring marks the destination at our held flight height. At screen edges an
  // arrow keeps the bearing readable even while the helicopter turns around.
  camera.updateMatrixWorld();
  heliMarkerPoint.set(heli.target.x, state.y, heli.target.z).project(camera);
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
  // The altitude buttons replace the throttle and speed controls.
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

  if (heli.altitude === null) heli.altitude = state.y;
  // Only a new touch or drag changes the destination, never camera motion alone.
  if (touching && (!heli.wasTouching || nx !== heli.lastNX || ny !== heli.lastNY)) heliAim(nx, ny);
  heli.wasTouching = touching; heli.lastNX = nx; heli.lastNY = ny;
  if (heli.vertical) heli.altitude = clamp(state.y + heli.vertical * H.altitudeLead, rest - 1, TUNE.otherVehicleCeiling);
  let wantYaw = null, wantSpeed = 0;
  const wantVy = clamp((heli.altitude - state.y) * H.vGain, -H.maxSink, H.climb);
  if (heli.target) {
    const dx = heli.target.x - state.x, dz = heli.target.z - state.z;
    const dist = Math.hypot(dx, dz);
    heli.targetDist = dist;
    if (dist < H.arriveDist) { heli.target = null; heli.sky = false; }
    else {
      wantYaw = Math.atan2(-dx, -dz);
      wantSpeed = Math.min(H.cruise, dist * H.approach);
    }
  }

  // ---- yaw: turn onto the fixed bearing before accelerating
  const yawErr = wantYaw === null ? 0 : wrapPi(wantYaw - state.heading);
  const cmd = clamp(-yawErr / DEG * H.yawGain, -H.turnRate, H.turnRate);

  heli.turn += (cmd - heli.turn) * Math.min(1, H.turnAccel * dt);
  if (Math.abs(heli.turn) < 0.05) heli.turn = 0;
  state.heading -= heli.turn * DEG * dt;
  state.bank += ((heli.turn / H.turnRate) * H.bankDeg - state.bank) * Math.min(1, H.levelRate * dt);

  // ---- forward: turn first, then ease into the selected destination
  heli.braking = !grounded && heliJobNear();
  // Keep the destination through the shoreline and the fire's assist boundary.
  // Clearing it here stranded him short of the rig and cancelled every retry.
  heli.braking = heli.braking && !!heli.target &&
    Math.hypot(heli.target.x - fire.x, heli.target.z - fire.z) < H.jobRadius;
  if (heli.vertical < 0) wantSpeed *= clamp((state.y - rest) / H.landingBrakeH, 0, 1);
  if (grounded) wantSpeed = 0;
  else if (wantYaw !== null) wantSpeed *= Math.pow(Math.max(0, Math.cos(yawErr)), 2);
  const k = wantSpeed > heli.speed ? H.accel : (heli.braking ? H.jobBrake : H.hoverDamp);
  heli.speed += (wantSpeed - heli.speed) * Math.min(1, k * dt);
  if (heli.speed < H.stopBelow) heli.speed = 0;
  state.speed = heli.speed;
  state.pitch += (-(heli.speed / H.cruise) * H.noseDeg - state.pitch) * Math.min(1, H.levelRate * dt);

  // ---- up and down. Releasing a button holds height; descent stays gentle.
  heli.vy += (wantVy - heli.vy) * Math.min(1, H.vAccel * dt);
  heli.vy = clamp(heli.vy, -H.maxSink, H.climb);

  if (grounded) {
    state.y = rest;
    heli.speed = 0; state.speed = 0;
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
  state.x += fx * heli.speed * dt;
  state.z += fz * heli.speed * dt;
  forward.set(fx, 0, fz);          // the shared systems read travel off these two
  state.airVy = heli.vy;

  setEngine(clamp(0.45 + heli.speed / H.cruise * 0.55, 0, 1.2));

  if (state.vp.capped && state.y > TUNE.otherVehicleCeiling) {
    state.y = TUNE.otherVehicleCeiling;
    if (heli.vy > 0) heli.vy = 0;
  }

  if (heli.vertical >= 0 && !grounded) {
    const clearance = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + TUNE.gearHeight;
    if (state.y < clearance) { state.y = clearance; heli.altitude = Math.max(heli.altitude, clearance); heli.vy = Math.max(0, heli.vy); }
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
    heli.speed = 0; state.speed = 0; heli.target = null; heli.altitude = rest;
    if (!state.heliDown) { state.heliDown = true; chirp(); touchdownFx(); flags.heliLandings = (flags.heliLandings || 0) + 1; }
  } else if (state.y > rest + 1) {
    state.heliDown = false;
  }
}
