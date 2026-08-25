"use strict";
const forward = new THREE.Vector3();

function groundPhase(dt) {
  const grounded = state.phase === "TAXI" || state.phase === "ROLL";
  if (!grounded) return;
  const ap = AIRPORTS[state.originIdx];
  const sgn = state.dirIdx === 0 ? 1 : -1;
  state.x = 0;
  state.pitch += (0 - state.pitch) * Math.min(1, 8 * dt);
  state.bank += (0 - state.bank) * Math.min(1, 8 * dt);
  state.heading = state.dirIdx === 0 ? 0 : Math.PI;
  state.y = ap.elev + TUNE.gearHeight;
  state.airVy = null;

  if (state.phase === "TAXI") {
    state.speed = 0;
    rumble = 0;
    setRolling(0);
    if (state.throttleHeld) state.phase = "ROLL";
    return;
  }
  rumble = state.speed > 6 ? 0.035 * Math.min(1, state.speed / 40) : 0;
  setRolling(state.speed / Math.max(1, state.vp.cruiseSpeed));

  const pastEnd = sgn * (ap.cz - state.z) > TUNE.runwayLength / 2 + 40;
  if (state.throttleHeld && !pastEnd) {
    state.speed = Math.min(state.speed + state.vp.accel * dt, state.vp.cruiseSpeed * 1.15);
  } else {
    // Off the end of the runway the throttle does nothing: hard brake, respawn.
    state.speed = Math.max(state.speed - TUNE.brakeDecel * (pastEnd ? 2 : 1) * dt, 0);
  }

  state.z -= sgn * state.speed * dt;

  if (state.speed >= TUNE.rotateSpeed) {
    state.canRotate = true;
  }
  if (state.canRotate && state.ctrlPitch > TUNE.rotateStickThreshold) {
    state.rotatePullTime += dt;
    if (state.rotatePullTime >= TUNE.rotateStickTime) {
      state.phase = "AIRBORNE";
      state.liftoffTimer = TUNE.liftoffHoldTime;
      state.pitch = TUNE.liftoffPitchDeg * 0.5;
      state.maxAglSinceLiftoff = 0;
      flags.liftoff++;
      rumble = 0;
      setRolling(0);
      whoosh();
    }
  } else {
    state.rotatePullTime = 0;
  }

  if (pastEnd || (!state.throttleHeld && state.speed <= 0.01)) {
    if (pastEnd) {
      if (state.speed <= 0.01) spawnForTakeoff(state.originIdx, state.dirIdx);
    } else {
      state.phase = "TAXI";
      state.canRotate = false;
      state.rotatePullTime = 0;
    }
  }
}

// The runway he is actually near -- normally the destination, but turning back
// onto the runway he just left must land (or belly-explode) like any other.
function nearestAirportIdx() {
  let best = 0, bd = Infinity;
  for (let i = 0; i < AIRPORTS.length; i++) {
    const d = Math.abs(state.z - AIRPORTS[i].cz);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function updateAssists(dt) {
  const t = Math.abs(wrapPi(state.heading)) < Math.PI / 2 ? 0 : Math.PI;
  const thOff = Math.round(Math.cos(t)) * (TUNE.runwayLength / 2);
  state.approachIdx = nearestAirportIdx();
  const dxr = state.x - 0;
  const dzr = state.z - (AIRPORTS[state.approachIdx].cz + thOff);
  const distHoriz = Math.sqrt(dxr * dxr + dzr * dzr);

  const ft = { x: -Math.sin(t), z: -Math.cos(t) };
  const rt = { x: Math.cos(t), z: -Math.sin(t) };
  const along = dxr * ft.x + dzr * ft.z;
  const lat = dxr * rt.x + dzr * rt.z;
  state.approachData = { t, along, lat };

  const dot = (-Math.sin(state.heading) * -dxr + -Math.cos(state.heading) * -dzr) / (distHoriz || 1);
  // Once past the threshold `dot` points backwards; stay engaged while over the
  // runway and lined up so the flare, arrow and assists carry through to touchdown.
  // (Only once he has actually climbed away -- otherwise the runway he just
  // lifted off from would "engage" and flare him straight back down.)
  // ... and only for an ARRIVAL (approachLatch was set by the approach itself),
  // never for a climb-out over the runway he just left.
  const overRunway = climbedOut() && state.approachLatch && along > -50 && along < TUNE.runwayLength / 2 + 40 &&
    Math.abs(lat) <= (TUNE.runwayWidth / 2) * TUNE.touchdownLatTolMult;
  state.engaged = state.phase === "AIRBORNE"
    && state.liftoffTimer <= 0
    && ((distHoriz < TUNE.approachEngageDist && dot > 0.25 && climbedOut()) || overRunway);

  if (!state.engaged) {
    state.assistBias *= Math.max(0, 1 - 2.5 * dt);
    // Wandered away from the airport: forget the approach so a later low pass
    // beside the runway can't trigger a surprise go-around. Keep it while he is
    // over the runway or just past its far end -- that is the go-around's job
    // (it clears the latch itself), otherwise "flew past the end" could never fire.
    const farEnd = TUNE.runwayLength + 300;   // `along` is measured from the arrival threshold
    if (distHoriz > TUNE.alignStartDist && (along < -TUNE.alignStartDist || along > farEnd)) state.approachLatch = false;
    return;
  }

  state.approachLatch = true;

  const err = wrapPi(t - state.heading);
  const falloff = 1 - smoothstep(TUNE.alignStartDist * 0.5, TUNE.approachEngageDist, distHoriz);

  const dH = clamp(err * TUNE.alignHeadingGain, -TUNE.alignHeadingMaxRateDeg * DEG, TUNE.alignHeadingMaxRateDeg * DEG);
  state.heading += dH * falloff * dt;

  const biasTarget = -clamp(lat * TUNE.alignLateralGain, -TUNE.alignRollMaxBiasDeg, TUNE.alignRollMaxBiasDeg) * falloff;
  state.assistBias += (biasTarget - state.assistBias) * Math.min(1, 2 * dt);
}

// True while the plane is lined up with the runway, gear down, within the
// flattened pad in front of the threshold or over the runway itself. Used to
// exempt the last few metres of an approach from the terrain-clearance
// explosion (the glide slope dips under terrainClearance just short of the
// threshold) and to keep the crash alarm quiet during a landing.
// A landing (or a belly-landing explosion) needs a flight first: the plane
// must have been at least climbOutAgl above the ground since it lifted off.
function climbedOut() {
  return (state.maxAglSinceLiftoff === undefined ? 1e9 : state.maxAglSinceLiftoff) >= TUNE.climbOutAgl;
}

function inLandingZone() {
  const ad = state.approachData;
  if (!ad) return false;
  if (state.vp.hasGear && !state.gearDown) return false;
  const withinLat = Math.abs(ad.lat) <= (TUNE.runwayWidth / 2) * TUNE.touchdownLatTolMult;
  // The flattened pad reaches runwayLength/2 + 60 + flattenMargin beyond the
  // threshold, so 300 m short is still level ground.
  return withinLat && ad.along > -300 && ad.along < TUNE.runwayLength / 2 + 40;
}

function touchdownFx() {
  state.squashTimer = 0.35;
  tyrePuffAt(state.x, state.y - TUNE.gearHeight + 1.2, state.z);
  guideGroup.userData.pulse = 1.5;
  if (state.ringsEatenThisApproach >= 3) landingChord();
}

// Wingman: fly alongside a traffic plane for wingmanHold seconds -> sparkle.
function updateWingman(dt) {
  if (state.wingmanCooldown > 0) state.wingmanCooldown -= dt;
  let near = false;
  if (state.phase === "AIRBORNE" && !state.exploding) {
    const d2 = TUNE.wingmanDist * TUNE.wingmanDist;
    for (const t of traffic) {
      if (!t.alive) continue;
      const dx = t.x - state.x, dy = t.y - state.y, dz = t.z - state.z;
      if (dx * dx + dy * dy + dz * dz < d2) { near = true; break; }
    }
  }
  if (state.wingmanCooldown > 0) state.wingmanHold = 0;
  else state.wingmanHold = near ? Math.min(TUNE.wingmanHold, state.wingmanHold + dt) : Math.max(0, state.wingmanHold - dt * 2);
  const done = state.wingmanHold >= TUNE.wingmanHold && state.wingmanCooldown <= 0;
  if (done) {
    state.wingmanCooldown = TUNE.wingmanCooldown;
    state.wingmanHold = 0;
    flags.wingman++;
    fanfare();
    sparkleBurst();
    el.wingman.classList.remove("done");
    void el.wingman.offsetWidth; // restart the pulse animation
    el.wingman.classList.add("done");
    setTimeout(() => el.wingman.classList.remove("done"), 2000);
  }
  el.wingman.classList.toggle("near", near && !done);
}

let cloudWhooshT = 0;
function updateCloudWhoosh(dt) {
  if (cloudWhooshT > 0) { cloudWhooshT -= dt; return; }
  if (state.phase !== "AIRBORNE") return;
  for (const c of clouds) {
    const dx = c.position.x - state.x, dy = c.position.y - state.y, dz = c.position.z - state.z;
    if (dx * dx + dy * dy + dz * dz < 40 * 40) { whoosh(); cloudWhooshT = 2.5; return; }
  }
}

// Imminent-crash alarm: red strobes + warning triangle + beeps when the plane
// will hit terrain, water or a structure within crashWarnTime at its current
// velocity. Silent on a proper approach over the runway (that's a landing).
const warnP = { x: 0, y: 0, z: 0 };
function updateCrashWarning(dt) {
  let warn = false;
  if ((state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding && state.liftoffTimer <= 0) {
    const vx = forward.x * state.speed, vz = forward.z * state.speed, vy = forward.y * state.speed + (state.airVy || 0) - (state.flaring ? TUNE.flareSink : 0);
    // Gear up, lined up with the runway and low: that's a belly landing about
    // to happen -- alarm, no suppression. Touchdown itself explodes.
    const ad = state.approachData;
    const gearUp = state.vp.hasGear && !state.gearDown;
    const linedUp = !!ad && Math.abs(ad.lat) <= (TUNE.runwayWidth / 2) * TUNE.touchdownLatTolMult &&
      ad.along > -300 && ad.along < TUNE.runwayLength / 2 + 40;
    const aglHere = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
    if (gearUp && climbedOut() && (linedUp || onAnyRunwayRect(state.x, state.z)) && aglHere < TUNE.gearWarnAgl) warn = true;
    const landing = !gearUp && (inLandingZone() || onAnyRunwayRect(state.x, state.z));
    if (!warn && !landing) {
      const groundNow = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
      const agl = state.y - groundNow;
      if (vy < -0.5 && agl / -vy < TUNE.crashWarnTime) warn = true;
      // terrain rising ahead
      if (!warn) {
        for (let t = 0.5; t <= TUNE.crashWarnTime; t += 0.5) {
          const px = state.x + vx * t, pz = state.z + vz * t, py = state.y + vy * t;
          if (py - Math.max(terrainEff(px, pz), TUNE.waterLevel) < TUNE.terrainClearance) { warn = true; break; }
        }
      }
      // structure ahead
      if (!warn) {
        for (let t = 0.4; t <= TUNE.crashWarnTime && !warn; t += 0.4) {
          warnP.x = state.x + vx * t; warnP.y = state.y + vy * t; warnP.z = state.z + vz * t;
          forEachSolid(b => {
            if (warn || isSolidHidden(b)) return;
            if (warnP.x > b.x - b.hw - 3 && warnP.x < b.x + b.hw + 3 &&
                warnP.z > b.z - b.hd - 3 && warnP.z < b.z + b.hd + 3 &&
                warnP.y > b.y0 - 3 && warnP.y < b.y1 + 3) warn = true;
          });
        }
      }
    }
  }
  if (warn !== state.alarmOn) {
    state.alarmOn = warn;
    el.alarm.classList.toggle("on", warn);
    if (warn) { flags.alarms++; state.alarmBeepT = 0; }
  }
  if (warn) {
    state.alarmBeepT -= dt;
    if (state.alarmBeepT <= 0) { alarmBeep(); state.alarmBeepT = 0.36; }
  }
}

function updateRewards(dt) {
  if (state.squashTimer > 0) state.squashTimer -= dt;
  if (state.popTimer > 0) state.popTimer -= dt;
  if (guideGroup.userData.pulse > 0) {
    guideGroup.userData.pulse -= dt;
    const k = Math.max(0, guideGroup.userData.pulse / 1.5);
    for (const l of guideGroup.children) l.material.opacity = 0.55 + 0.45 * k;
  }
  updateRings(dt);
  updateGates(dt);
  updateAirports(dt);
  updateTargets(dt);
  updateWingman(dt);
  updateCloudWhoosh(dt);
  updateSmoke(dt);
  updateCraters(dt);
  updateTyrePuffs(dt);
}

function update(dt) {
  frameCount++;
  applyKeyboard(dt);
  el.vehBtn.classList.toggle("hidden", !(state.phase === "TAXI" && state.speed === 0 && !state.exploding));
  el.gearBtn.classList.toggle("hidden", !state.vp.hasGear);
  el.gearBtn.classList.toggle("gear-up", !state.gearDown);
  const thOffVis = Math.round(Math.cos(state.dirIdx === 0 ? 0 : Math.PI)) * (TUNE.runwayLength / 2);
  const dzVis = state.z - (AIRPORTS[state.destIdx].cz + thOffVis);
  el.skipBtn.classList.toggle("hidden",
    state.phase !== "AIRBORNE" || state.engaged || (dzVis * dzVis) < TUNE.approachEngageDist * TUNE.approachEngageDist);
  const inFlight = state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY";
  el.slowBtn.classList.toggle("hidden", !inFlight);
  el.fastBtn.classList.toggle("hidden", !inFlight);
  el.missileBtn.classList.toggle("hidden", !inFlight);
  el.missileBtn.classList.toggle("cooldown", state.missileCooldown > 0);
  const gT = state.gearDown ? 1 : 0;
  if (state.gearAnim !== gT) {
    state.gearAnim = clamp(state.gearAnim + (gT > state.gearAnim ? 1 : -1) * 1.7 * dt, 0, 1);
  }
  if (state.exploding) {
    state.explodeTimer -= dt;
    const seeking = state.explodeTimer <= 0.5;
    updateExplosion(dt, safePos, seeking);
    setEngine(0.01);
    state.engaged = false;
    updateChunks(state.x, state.z);
    updateShatter(dt);
    updateTrain(dt, state.x, state.z);
    updateTraffic(dt, state.x, state.y, state.z);
    updateMissiles(dt);
    updateRewards(dt);
    updateCrashWarning(dt);
    rumble = 0;
    skyDome.position.set(state.x, state.y, state.z);
    waterMesh.position.set(state.x, TUNE.waterLevel, state.z);
    applyCamera(dt);
    updateVehicleModel(dt);
    updateHud();
    updateFx(dt);
    shakeAmp = Math.max(0, shakeAmp - dt * 0.9);
    if (state.explodeTimer <= 0) {
      state.exploding = false;
      state.x = safePos.x;
      state.y = safePos.y;
      state.z = safePos.z;
      forEachSolid(b => {
        if (state.x > b.x - b.hw - 6 && state.x < b.x + b.hw + 6 &&
            state.z > b.z - b.hd - 6 && state.z < b.z + b.hd + 6) {
          state.y = Math.max(state.y, b.y1 + 40);
        }
      });
      state.speed = state.vp.cruiseSpeed * 0.6;
      state.pitch = 0;
      state.bank = 0;
      state.airVy = null;
      state.canRotate = false;
      state.approachLatch = false;
      whoosh();
      boing();
      state.popTimer = 0.45;
    }
    return;
  }
  if (state.phase !== "AIRBORNE") state.flaring = false;
  let targetBank = 0, targetPitch = 0;
  if (state.touching) {
    targetBank = state.ctrlBank * state.vp.bankLimitDeg;
    targetPitch = state.ctrlPitch * state.vp.pitchLimitDeg;
  }

  if (state.phase === "TAXI" || state.phase === "ROLL") {
    groundPhase(dt);
    setEngine(state.speed / state.vp.cruiseSpeed);
    el.throttleBtn.classList.remove("hidden");
    el.rotateArrow.classList.toggle("on",
      state.phase === "ROLL" && state.canRotate);
  } else {
    el.throttleBtn.classList.add("hidden");
    el.rotateArrow.classList.remove("on");

    let resp = state.touching ? TUNE.controlResponse : TUNE.autoLevelResponse;
    let turnCoupling = true;

    if (state.phase === "CLIMB_AWAY") {
      state.climbAwayTimer -= dt;
      targetPitch = TUNE.climbAwayPitchDeg;
      targetBank = 0;
      resp = TUNE.controlResponse;
      state.assistBias *= Math.max(0, 1 - 3 * dt);
      state.speed += (state.vp.cruiseSpeed - state.speed) * Math.min(1, 1.2 * dt);
      if (state.climbAwayTimer <= 0) {
        state.phase = "AIRBORNE";
        flags.missed++;
      }
    } else if (state.phase === "LANDED") {
      state.speed = Math.max(state.speed - TUNE.brakeDecel * 0.55 * dt, 0);
      rumble = state.speed > 6 ? 0.035 * Math.min(1, state.speed / 40) : 0;
      setRolling(state.speed / Math.max(1, state.vp.cruiseSpeed));
      targetPitch = 0;
      targetBank = 0;
      resp = 4;
      turnCoupling = false;
      state.assistBias = 0;
      const adR = state.approachData;
      if (adR && Math.abs(adR.along) < TUNE.runwayLength) {
        state.heading += wrapPi(adR.t - state.heading) * Math.min(1, 1.5 * dt);
      }
      if (state.speed <= 0.05 && !state.celebrated) {
        state.celebrated = true;
        confettiBurst();
        cheer();
        state.celebrateTimer = 2.6;
      }
      if (state.celebrated) {
        state.celebrateTimer -= dt;
        if (state.celebrateTimer <= 0) {
          const at = state.landedIdx === undefined ? state.destIdx : state.landedIdx;
          state.originIdx = at;
          state.destIdx = 1 - at;
          state.dirIdx = at === 0 ? 0 : 1;   // NY -> fly south, CA -> fly north
          spawnForTakeoff();
        }
      }
    } else {
      updateAssists(dt);
      if (state.liftoffTimer > 0) {
        state.liftoffTimer -= dt;
        targetPitch = TUNE.liftoffPitchDeg;
      }
      if (state.engaged) {
        targetBank += state.assistBias;
      }
      targetBank = clamp(targetBank, -state.vp.bankLimitDeg, state.vp.bankLimitDeg);
      targetPitch = clamp(targetPitch, -state.vp.pitchLimitDeg, state.vp.pitchLimitDeg);
      // Auto-flare: on an engaged approach, below flareAgl the nose levels off
      // regardless of the stick and the plane settles at a steady sink. He
      // can't arrive nose-first or tail-first -- he just arrives.
      state.flaring = false;
      if (state.engaged && state.approachData) {
        const aglNow = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
        const latOk = Math.abs(state.approachData.lat) <= (TUNE.runwayWidth / 2) * TUNE.touchdownLatTolMult;
        const ad = state.approachData;
        const overRunway = ad.along > -50 && ad.along < TUNE.runwayLength / 2 + 40;
        if (latOk && aglNow < TUNE.flareAgl && (!state.vp.hasGear || state.gearDown)) {
          const k = 1 - clamp(aglNow / TUNE.flareAgl, 0, 1);
          targetPitch = lerp(targetPitch, 1.5, k);
          state.flaring = true;
        } else if (latOk && overRunway && aglNow < TUNE.flareStartAgl && (!state.vp.hasGear || state.gearDown)) {
          // Crossed the threshold high with the stick released: ease the nose
          // down so the flare band is reached before the runway runs out.
          targetPitch = Math.min(targetPitch, -3);
          state.flaring = true;
        }
      }
      const hover = state.vp.hoverSpeed > 0 && !state.touching;
      let targetSpeed = state.vp.cruiseSpeed * TUNE.speedSteps[state.speedStep];
      if (hover) targetSpeed = state.vp.hoverSpeed;
      else if (state.engaged) targetSpeed = Math.max(targetSpeed, TUNE.minFlyingSpeed);
      state.speed += (targetSpeed - state.speed) * Math.min(1, (hover ? 0.5 : TUNE.autoThrottleResponse * 1.6) * dt);
    }

    const k = Math.min(1, resp * dt);
    state.bank += (targetBank - state.bank) * k;
    state.pitch += (targetPitch - state.pitch) * k;

    const effBank = clamp(state.bank + state.assistBias, -state.vp.bankLimitDeg, state.vp.bankLimitDeg);
    if (turnCoupling) {
      state.heading -= state.vp.turnRateDeg * DEG * (effBank / state.vp.bankLimitDeg) * dt;
    }

    const pr = state.pitch * DEG;
    const hr = state.heading;
    const cp = Math.cos(pr);
    forward.set(-Math.sin(hr) * cp, Math.sin(pr), -Math.cos(hr) * cp);
    state.x += forward.x * state.speed * dt;
    state.z += forward.z * state.speed * dt;
    state.y += forward.y * state.speed * dt;
    if (state.flaring) state.y -= TUNE.flareSink * dt;

    setEngine(state.speed / state.vp.cruiseSpeed);

    resolveSolidWalls();
    if (state.exploding) {
      updateHud();
      updateFx(dt);
      return;
    }

    const groundNow = terrainEff(state.x, state.z);
    let contactGround = Math.max(groundNow, TUNE.waterLevel);
    if (groundNow > TUNE.waterLevel + 0.01) contactGround = groundNow;
    for (let i = 0; i < buildingBoxes.length; i++) {
      const bb = buildingBoxes[i];
      if (Math.abs(state.x - bb.x) < bb.hw + 2 && Math.abs(state.z - bb.z) < bb.hd + 2) {
        if (state.y < bb.top + 4) contactGround = Math.max(contactGround, bb.top);
      }
    }

    if (state.phase === "LANDED") {
      state.y = groundNow + TUNE.gearHeight;
    } else {
      const agl = state.y - Math.max(groundNow, TUNE.waterLevel);
      const halfW = TUNE.runwayWidth / 2;
      const halfL = TUNE.runwayLength / 2;
      const ad = state.approachData || { t: 0, along: 1e9, lat: 1e9 };
      const withinLat = Math.abs(ad.lat) <= halfW * TUNE.touchdownLatTolMult;
      // The flattened pad extends 300 m short of the threshold; touching down
      // anywhere on it is a landing (he rolls onto the runway), never a plane
      // pinned 0.6 m off the ground with its wheels underground.
      const overRect = ad.along > -300 && ad.along < halfL && withinLat;

      const gearOk = !state.vp.hasGear || state.gearDown;
      // state.y is the plane reference; the wheels hang gearHeight below it.
      if (state.maxAglSinceLiftoff !== undefined && agl > state.maxAglSinceLiftoff) state.maxAglSinceLiftoff = agl;
      if (state.phase === "AIRBORNE" && overRect && climbedOut() && agl <= TUNE.gearHeight + TUNE.touchdownClearance) {
        if (!gearOk) {
          state.exploding = true;
          state.explodeTimer = TUNE.reassembleDelay;
          safePos.x = state.x;
          safePos.z = state.z;
          safePos.y = Math.max(state.y, groundNow + 60);
          triggerExplosion(state.x, state.y, state.z, clamp(state.speed / 80, 0, 1));
        } else if (Math.abs(wrapPi(state.heading - ad.t)) <= TUNE.touchdownHeadingTolDeg * DEG) {
          state.phase = "LANDED";
          state.landedIdx = state.approachIdx;
          state.engaged = false;
          flags.touchdown++;
          chirp();
          touchdownFx();
          state.y = groundNow + TUNE.gearHeight;
        } else {
          state.approachLatch = false;
          state.engaged = false;
          state.phase = "CLIMB_AWAY";
          state.climbAwayTimer = TUNE.climbAwayTime;
          resetRings();
        }
      } else if (
        state.phase === "AIRBORNE" && state.approachLatch && agl < 45 &&
        (ad.along > halfL + 40 || (ad.along > 60 && !withinLat))
      ) {
        state.approachLatch = false;
        state.engaged = false;
        state.phase = "CLIMB_AWAY";
        state.climbAwayTimer = TUNE.climbAwayTime;
        resetRings();
      } else if (agl <= TUNE.terrainClearance && !onAnyRunwayRect(state.x, state.z) && !inLandingZone()) {
        state.exploding = true;
        state.explodeTimer = TUNE.reassembleDelay;
        safePos.x = state.x;
        safePos.z = state.z;
        safePos.y = Math.max(groundNow, TUNE.waterLevel) + 60;
        triggerExplosion(state.x, Math.max(state.y - 2, contactGround + 1), state.z, clamp(state.speed / 80, 0, 1));
      }

      if (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") {
        const floorNow = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
        // With the wheels down on the landing pad the floor is gear height, not
        // belly height -- the model must never sit below the ground.
        const minY = floorNow + (inLandingZone() ? TUNE.gearHeight : 0.6);
        if (state.y < minY) {
          state.y = minY;
        }
      }
    }
  }

  const aglSpace = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  let spaceTarget = 0;
  if (!state.vp.capped && state.phase === "AIRBORNE") {
    spaceTarget = clamp((aglSpace - TUNE.spaceAltitude) / TUNE.spaceBlendBand, 0, 1);
  }
  state.spaceF += (spaceTarget - state.spaceF) * Math.min(1, 1.4 * dt);
  if (state.vp.capped && (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY")) {
    if (state.y > TUNE.otherVehicleCeiling) {
      state.y = TUNE.otherVehicleCeiling;
      if (state.pitch > -2) state.pitch -= 20 * dt;
    }
  }
  const sf = state.spaceF;
  if (sf > 0.001) {
    skyUniforms.topColor.value.copy(SKY_TOP_BASE).lerp(SPACE_TOP, sf);
    skyUniforms.horizonColor.value.copy(SKY_HOR_BASE).lerp(SPACE_HOR, sf);
    scene.fog.color.copy(skyUniforms.horizonColor.value);
    scene.fog.near = lerp(TUNE.fogNear, 2600, sf);
    scene.fog.far = lerp(TUNE.fogFar, 5400, sf);
  } else if (skyUniforms.topColor.value.getHex() !== TUNE.skyTopColor) {
    skyUniforms.topColor.value.copy(SKY_TOP_BASE);
    skyUniforms.horizonColor.value.copy(SKY_HOR_BASE);
    scene.fog.color.copy(skyUniforms.horizonColor.value);
    scene.fog.near = TUNE.fogNear;
    scene.fog.far = TUNE.fogFar;
  }
  stars.material.opacity = sf;
  earthMesh.material.opacity = sf * 0.96;
  earthMesh.position.set(state.x, state.y - 3600, state.z);
  earthMesh.visible = sf > 0.02;
  astronaut.visible = station.visible = sf > 0.05;
  if (astronaut.visible) {
    astronaut.rotation.y += dt * 0.4;
    astronaut.rotation.x += dt * 0.12;
    station.rotation.y += dt * 0.16;
  }
  waterMesh.visible = sf < 0.9;

  updateChunks(state.x, state.z);
  updateScenery(state.x, state.z, false);
  updateTrain(dt, state.x, state.z);
  updateShatter(dt);
  cullLandmarks(dt, state.x, state.z);
  updateTraffic(dt, state.x, state.y, state.z);
  updateMissiles(dt);
  updateRewards(dt);
  updateCrashWarning(dt);
  skyDome.position.set(state.x, state.y, state.z);
  waterMesh.position.set(state.x, TUNE.waterLevel, state.z);

  const hx = -Math.sin(state.heading), hz = -Math.cos(state.heading);
  for (const c of clouds) {
    const dx = c.position.x - state.x, dz = c.position.z - state.z;
    if (dx * dx + dz * dz > TUNE.fogFar * TUNE.fogFar * 1.44) {
      respawnCloud(c, state.x, state.z, hx, hz, true);
    }
  }

  const pulse = 1 + Math.sin(performance.now() * 0.001 * TUNE.ringPulseRate) * 0.07;
  for (const r of rings) r.scale.setScalar(pulse);
  const blinkOn = Math.sin(performance.now() * 0.004) > -0.3;
  for (const b of blinkers) b.visible = blinkOn;

  applyCamera(dt);
  shakeAmp = Math.max(0, shakeAmp - dt * 0.9);
  updateVehicleModel(dt);

  updateHud();
  updateFx(dt);
  updateExplosion(dt, safePos, false);
}
