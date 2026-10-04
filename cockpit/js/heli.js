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
  heli.stallBest = undefined; heli.stallT = 0;
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

// ---- WHAT HE CAN LAND ON (v139): anything solid. The floor under the helicopter
// is the highest surface at (x, z) that is not above its skids: the ground, a
// roof, a pad, a ship's deck, the motorway where it is a bridge, a city street
// on a flyover, the yacht's helipad. Water is the one floor it never sits on --
// it hovers over it (`water`), which is what the bucket needs. Before this the
// floor was the TERRAIN, so a roof was a wall he was shoved about on for as long
// as he held the button, and a bridge deck was air he sank through.
// Traffic, a parked car and a capsule (a mast, a dome) are not floors.
const heliFloorOut = { y: 0, water: false, solid: null };
function heliFloorAt(x, z, skidY) {
  const o = heliFloorOut;
  const yPad = typeof yachtPadUnder === "function" ? yachtPadUnder(x, z) : null;
  if (yPad) { o.y = yPad.y; o.water = false; o.solid = null; return o; }
  const t = terrainEff(x, z), sea = seaLevelAt(x, z);
  o.water = t < sea; o.y = o.water ? sea : t; o.solid = null;
  const reach = skidY + H.floorTol;
  if (typeof highway !== "undefined" && highway.built && typeof hwyNearest === "function") {
    const n = hwyNearest(x, z);
    if (n && Math.abs(n.lateral) < highway.halfW && n.y > o.y && n.y <= reach) { o.y = n.y; o.water = false; }
  }
  if (typeof stSurfaceAt === "function") {
    const sy = stSurfaceAt(x, z);
    if (sy !== null && sy > o.y && sy <= reach) { o.y = sy; o.water = false; }
  }
  // The carrier's flight deck is not a solid (setpieces.js: a near miss in the
  // plane is never a bang), but it is a deck: and anything inside its footprint
  // under it is inside the ship, so it counts from any height.
  if (typeof carrier !== "undefined" && carrier.g && Math.abs(x - carrier.x) < CV.deckW / 2 &&
      Math.abs(z - carrier.z) < CV.deckL / 2 && carrier.deck > o.y) { o.y = carrier.deck; o.water = false; }
  forEachSolid(b => {
    if (b.y1 <= o.y || b.y1 > reach || b.car !== undefined || b.park || b.cap || isSolidHidden(b)) return;
    if (b.hw < H.floorMinHalf || b.hd < H.floorMinHalf) return;   // a mast, an antenna: not somewhere to stand
    // the same footprint the wall law gives him (its box widened by his radius):
    // half on, half off a roof's edge, it is the roof he rests on -- the lower
    // floor would sink him on to the edge, and its nearest way out is up
    const foot = b.o3 || b.ramp ? 0 : vehSolidR();
    if (Math.abs(x - b.x) > b.hw + foot || Math.abs(z - b.z) > b.hd + foot) return;
    let top = b.y1;
    if (b.ramp) {
      const L = solidRampLocal(b.ramp, x, top, z, solidRampTmp);
      if (L.a < 0 || L.a > b.ramp.len || Math.abs(L.s) > b.ramp.w / 2) return;
      top = b.ramp.o[1] + solidRampH(b.ramp, L.a);
    } else if (b.o3 && !solidTestBox3(b.o3, x, top - 0.3, z, 0.01)) return;   // its bounding box, not the thing
    if (top > o.y && top <= reach) { o.y = top; o.water = false; o.solid = b; }
  });
  return o;
}

function updateHelicopter(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  // The altitude buttons replace the throttle. The speed control is still here,
  // as the single cycling stepper -- this column has no room for a pair, which
  // js/speed.js explains and spdUpdateButtons decides.
  el.rotateArrow.classList.remove("on");

  // The yacht's helipad is GROUND while he is over it (heliFloorAt) -- that one
  // substitution is the whole of "a moving landing target", because everything
  // below already knows how to land on ground.
  if (heli.followPad && typeof yachtPadWorld === "function") {
    const p = yachtPadWorld();
    if (p && heli.target) { heli.target.x = p.x; heli.target.y = p.y; heli.target.z = p.z; }
    else heli.followPad = false;
  }
  const floor = heliFloorAt(state.x, state.z, state.y - TUNE.gearHeight);
  const overWater = floor.water;
  const ground = floor.y;
  const rest = overWater ? ground + H.waterFloor : ground + TUNE.gearHeight;
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
  // Coming down while still travelling: whatever stands ahead is a floor it will
  // not sink below until it has slowed (v139). So a descent ends ON the roof he
  // was heading for, or beside it, never in its side. Level flight is unchanged:
  // flying into the side of something at speed is still the one bang.
  // And holding down is a landing: if something too tall to come down on stands
  // in the way, it slows to a creep rather than meet its side (`heli.landBlock`,
  // read below where the speed is set).
  heli.landBlock = false;
  if (heli.vertical < 0 && !grounded && heli.speed > H.landCreep) {
    const skid = state.y - TUNE.gearHeight;
    for (const k of H.landLook) {
      const px = state.x + heli.vx * k, pz = state.z + heli.vz * k;
      const f = heliFloorAt(px, pz, skid);
      if (!f.water) heli.altitude = Math.max(heli.altitude, f.y + TUNE.gearHeight + H.landHold);
      if (!heli.landBlock && solidQuery(px, state.y, pz, vehSolidR() + H.landMargin, vehSolidClass(), skid)) heli.landBlock = true;
    }
  }
  const wantVy = clamp((heli.altitude - state.y) * H.vGain, -H.maxSink, H.climb);
  if (heli.target) {
    const dx = heli.target.x - state.x, dz = heli.target.z - state.z;
    const dist = Math.hypot(dx, dz);
    heli.targetDist = dist;
    // ---- the stall floor: going nowhere for long enough means letting it go
    if (heli.stallBest === undefined || dist < heli.stallBest - H.stallProgress) {
      heli.stallBest = dist; heli.stallT = 0;
    } else {
      heli.stallT = (heli.stallT || 0) + dt;
    }
    if (heli.stallT > H.stallAfter) {
      heli.target = null; heli.sky = false; heli.stallBest = undefined; heli.stallT = 0;
      flags.heliStalls = (flags.heliStalls || 0) + 1;
    }
    if (dist < H.arriveDist) { heli.target = null; heli.sky = false; heli.stallBest = undefined; heli.stallT = 0; }
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
  if (heli.landBlock) wantSpeed = Math.min(wantSpeed, H.landCreep);
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

  if (grounded && state.y > rest + 0.5) {
    // what it stood on has gone from under it: it lifts and settles on what is there now
    state.phase = "AIRBORNE"; heli.altitude = rest; state.heliDown = false;
  } else if (grounded) {
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
    if (state.y < rest) { state.y = rest; heli.altitude = Math.max(heli.altitude, rest); heli.vy = Math.max(0, heli.vy); }
  }

  // ---- the sea is a floor, not a landing place. Sitting on it would end the
  // flight and take the bucket button away in the one spot he needs it. Any
  // water: the sea, the lake, the lock (`seaLevelAt`), never only the sea's level.
  if (overWater) {
    if (state.y < rest) { state.y = rest; if (heli.vy < 0) heli.vy = 0; heli.altitude = Math.max(heli.altitude, rest); }
    state.heliDown = false;
  } else if (!grounded && state.y <= rest && heli.vy <= 0) {
    // ---- the ground, a roof, a deck. It only ever arrives at maxSink, so setting down is soft.
    state.y = rest;
    heli.vy = 0;
    state.phase = "TAXI";
    heli.speed = 0; heli.vx = heli.vz = 0; state.speed = 0; heli.target = null; heli.altitude = rest;
    if (!state.heliDown) { state.heliDown = true; chirp(); touchdownFx(); flags.heliLandings = (flags.heliLandings || 0) + 1; }
  } else if (state.y > rest + 1) {
    state.heliDown = false;
  }

  // Walls are still walls: fly into the SIDE of a tower at speed and it goes
  // bang, like anything else. What is under the skids is a floor, not a wall --
  // the skids are the base the one law measures from.
  if (state.phase !== "TAXI") resolveSolidWalls(state.y - TUNE.gearHeight);
}


// Its one warning (flight.js): faster than its crawl, and the wall law would
// meet something solid along its own travel, at its own height, within
// crashWarnTime -- what is under the skids is a floor, not a wall, exactly as
// resolveSolidWalls is asked. Flying level into the side of a tower warns;
// coming down on to a roof never does.
function heliWarnAhead() {
  if (Math.hypot(heli.vx, heli.vz) <= vehCrawl()) return false;
  // holding down is a landing: anything in the way slows it to a creep first
  // (`landBlock`), so it is never the bang a warning is for
  if (heli.vertical < 0) return false;
  const skid = state.y - TUNE.gearHeight;
  for (let t = 0.4; t <= TUNE.crashWarnTime; t += 0.4)
    if (solidQuery(state.x + heli.vx * t, state.y, state.z + heli.vz * t, vehSolidR(), vehSolidClass(), skid)) return true;
  return false;
}

// A mid-air is a bang only at speed (v139). A helicopter hovering or creeping --
// at or under its crawl, the wall law's own number -- is not flying into anything:
// the kite or the paper planes that drift into it pop, and it stays. The kites
// fly 28-50 m over the fields, which is exactly where he comes down to land.
function heliMidairSoft() {
  return vehKind() === "heli" && Math.abs(state.speed) <= vehCrawl();
}

// The helicopter against a wall, through the one law (collision.js): over its
// crawl the shared bang; at or under it, a shove. It moves by its own velocity
// rather than `state.speed`, so the shove is its own -- out of the thing, and
// the part of its drift that was INTO it gone.
function heliWallHit(push, hit) {
  if (Math.hypot(heli.vx, heli.vz) > vehCrawl()) return false;   // the shared bang
  // Come down on the tip of a mast and the nearest way out is UP, so it would sit
  // on the point for ever. A thing too narrow to stand on (heliFloorAt) shoves
  // him off sideways instead, and he settles beside it.
  const b = hit && hit.b;
  if (b && (push.ny || 0) > 0.7 && (b.hw < H.floorMinHalf || b.hd < H.floorMinHalf)) {
    let dx = state.x - b.x, dz = state.z - b.z, d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = Math.sin(state.heading); dz = Math.cos(state.heading); d = 1; }
    push = { nx: dx / d, ny: 0, nz: dz / d, d: Math.max(0, Math.max(b.hw, b.hd) + H.rotorClear - d) };   // clear of the rotor, not just the body
  }
  const k = push.d + 0.3;
  state.x += (push.nx || 0) * k; state.z += (push.nz || 0) * k; state.y += (push.ny || 0) * k;
  // under a roof it is held down, over one held up: the climb into it goes
  if ((push.ny || 0) * heli.vy < 0) { heli.vy = 0; heli.altitude = state.y; }
  const into = heli.vx * (push.nx || 0) + heli.vz * (push.nz || 0);
  if (into < 0) { heli.vx -= into * (push.nx || 0); heli.vz -= into * (push.nz || 0); }
  heli.vx *= 0.35; heli.vz *= 0.35;
  heli.speed = state.speed = Math.hypot(heli.vx, heli.vz);
  heli.target = null;
  noiseBurst(0.12, 220, 0.2, 0);
  flags.solidShoves = (flags.solidShoves || 0) + 1;
  return true;
}
