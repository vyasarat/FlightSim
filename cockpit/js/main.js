"use strict";
// The home arrow rides a ring around the middle of the screen. On a tall screen
// that ring passes straight through the top-left pair, so it is walked inwards
// along its own bearing until it is clear of every control -- the direction is
// the whole message, the distance from the middle carries nothing.
function homeArrowRadius(cx, cy, theta) {
  // Measured, not assumed: the svg is sized in CSS and the narrow-screen media
  // query changes it, so `TUNE.homeIndicatorSize` is the smaller of the two
  // numbers and clearing by it leaves the arrow a third of the way onto the
  // button. Take what it actually paints, plus a margin.
  // offsetWidth, not getBoundingClientRect: the arrow is rotated, and what is
  // wanted is the unrotated side so the diagonal can be allowed for once.
  const w = el.homeArrow.offsetWidth || TUNE.homeIndicatorSize;
  const half = w * 0.708 + 6;                  // half the rotated bounding box
  const r0 = Math.min(cx, cy) - TUNE.homeIndicatorSize * 0.75 - 10;
  return typeof btnRingRadius === "function" ? btnRingRadius(cx, cy, theta, r0, half) : r0;
}

function updateHomeArrow() {
  if (state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY") {
    el.homeArrow.classList.remove("on");
    return;
  }
  if (state.vp.rocket && state.spaceF > 0.5) { updateSpaceArrow(); return; }
  const thz = AIRPORTS[state.destIdx].cz;
  const rx = -state.x, rz = thz - state.z;
  const dist = Math.sqrt(rx * rx + rz * rz);
  if (dist <= TUNE.homeIndicatorDistance || state.engaged) {
    el.homeArrow.classList.remove("on");
    return;
  }
  el.homeArrow.classList.add("on");

  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const dot = fx * rx + fz * rz;
  const cross = fx * rz - fz * rx;
  const theta = Math.atan2(cross, dot);

  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const radius = homeArrowRadius(cx, cy, theta);
  el.homeArrow.style.left = (cx + Math.sin(theta) * radius) + "px";
  el.homeArrow.style.top = (cy - Math.cos(theta) * radius) + "px";
  el.homeArrow.style.transform = `translate(-50%,-50%) rotate(${theta * 180 / Math.PI}deg)`;
}

// In space the arrow points at where he is going: the chosen destination, or home
// once he is on the way back (after a planet, the station, or with the satellite out).
const spaceTarget = new THREE.Vector3();
function updateSpaceArrow() {
  let tx, ty, tz;
  const goingHome = rk.launchedFromBody;
  const body = goingHome ? null : BODIES.find(b => b.name === state.dest);
  if (body) { tx = body.x; ty = body.y; tz = body.z; }
  else { const pad = rocketPad(state.originIdx); tx = pad.x; ty = pad.ground; tz = pad.z; }
  camera.updateMatrixWorld();
  spaceTarget.set(tx, ty, tz).project(camera);
  const behind = spaceTarget.z > 1;
  let sx = spaceTarget.x, sy = spaceTarget.y;
  if (behind) { sx = -sx; sy = -sy; }
  if (!behind && Math.abs(sx) < 0.85 && Math.abs(sy) < 0.8) { el.homeArrow.classList.remove("on"); return; }   // in view: no arrow needed
  el.homeArrow.classList.add("on");
  const theta = Math.atan2(sx, sy);
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const radius = homeArrowRadius(cx, cy, theta);
  el.homeArrow.style.left = (cx + Math.sin(theta) * radius) + "px";
  el.homeArrow.style.top = (cy - Math.cos(theta) * radius) + "px";
  el.homeArrow.style.transform = `translate(-50%,-50%) rotate(${theta * 180 / Math.PI}deg)`;
}

function updateAimMarker() {
  if (state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY") {
    el.aimMarker.classList.remove("on");
    return;
  }
  const pr = state.pitch * DEG, hr = state.heading;
  const cp = Math.cos(pr);
  const fx = -Math.sin(hr) * cp, fy = Math.sin(pr), fz = -Math.cos(hr) * cp;

  camera.updateMatrixWorld();
  camera.getWorldDirection(camFwd);
  aimWorld.set(state.x + fx * TUNE.aimMarkerDistance, state.y + fy * TUNE.aimMarkerDistance, state.z + fz * TUNE.aimMarkerDistance);
  const toAim = aimTmp.copy(aimWorld).sub(camera.position);
  if (toAim.dot(camFwd) <= 0) {
    el.aimMarker.classList.remove("on");
    return;
  }
  aimWorld.project(camera);

  const px = (aimWorld.x * 0.5 + 0.5) * window.innerWidth;
  const py = (-aimWorld.y * 0.5 + 0.5) * window.innerHeight;
  const m = 30;
  const cx2 = clamp(px, m, window.innerWidth - m);
  const cy2 = clamp(py, m, window.innerHeight - m);
  // IT GETS OUT OF THE WAY OF A CONTROL. The marker is clamped to the screen, so
  // where he is aiming can land squarely on a button -- on the helicopter it sat
  // on the speed stepper, a reticle over a control, at every viewport. Nothing
  // becomes unpressable (it does not take pointer events) but he cannot read the
  // button underneath, and readability beats the effect: it simply goes while it
  // would overlap one, and comes back the moment it would not.
  // its own drawn size, not a guess: the svg is clamp(24px, 4.2vmin, 38px)
  const aimSvg = el.aimMarker.querySelector("svg");
  const half = (aimSvg ? aimSvg.getBoundingClientRect().width || 32 : 32) / 2;
  if (typeof btnRectBlocked === "function" &&
      btnRectBlocked(cx2 - half, cy2 - half, cx2 + half, cy2 + half)) {
    el.aimMarker.classList.remove("on");
    return;
  }
  el.aimMarker.classList.add("on");
  el.aimMarker.style.left = cx2 + "px";
  el.aimMarker.style.top = cy2 + "px";
}

const hudLast = {};   // last written HUD strings: write to the DOM only on change
function updateHud() {
  updateHeliControls();
  twControlsLate();
  const asiFrac = clamp(state.speed / TUNE.asiMaxSpeed, 0, 1);
  const asiT = `rotate(${(-120 + asiFrac * 240).toFixed(1)}deg)`;
  if (hudLast.asi !== asiT) { hudLast.asi = asiT; el.asiNeedle.style.transform = asiT; }
  const altM = Math.max(0, state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel));
  const altFrac = clamp(altM / (state.vp.rocket ? TUNE.rocketTune.altMax : TUNE.altMaxMeters), 0, 1);
  el.altNeedle.style.transform = `rotate(${-120 + altFrac * 240}deg)`;
  const altStr = String(Math.round(altM));
  if (el.altDigits.textContent !== altStr) el.altDigits.textContent = altStr;
  const aiT = `rotate(${(-state.bank).toFixed(1)}deg) translateY(${(clamp(state.pitch, -40, 40) * TUNE.hudPitchPixelsPerDeg).toFixed(1)}px)`;
  if (hudLast.ai !== aiT) { hudLast.ai = aiT; el.aiBall.style.transform = aiT; }
  if (hudLast.altLen !== altStr.length) { hudLast.altLen = altStr.length; el.altDigits.dataset.len = String(altStr.length); }

  if (state.engaged && state.approachData) {
    // `along` is negative while short of the threshold; distance-to-go is -along.
    const idealY = AIRPORTS[state.approachIdx === undefined ? state.destIdx : state.approachIdx].elev + 3 + Math.max(0, -state.approachData.along) * TUNE.glideSlope;
    const diff = state.y - idealY;
    el.glideGuide.classList.add("on");
    const gs = diff > TUNE.glideBand ? "down" : (diff < -TUNE.glideBand ? "up" : "ok");
    if (el.glideGuide.dataset.state !== gs) el.glideGuide.dataset.state = gs;
  } else {
    el.glideGuide.classList.remove("on");
  }

  updateHomeArrow();
  updateStrip();
  updateAimMarker();
}

// A relaunch (Guided Access, app switch) restores the last vehicle, direction
// and destination so the world behind the picker is already the one he left --
// but it ALWAYS opens on the vehicle screen.
//
// It used to skip the picker entirely, and with a rocket saved that meant the
// game opened on the DESTINATION screen: two planets and a space station, with
// no way back to the vehicles except a button hidden behind them. Whatever he
// had been flying, the first thing he saw was a question about space. The
// vehicles come first now and the destination screen is only ever reached by
// choosing a rocket, which is the only place it means anything.
(function restoreChoice() {
  let v = null, d = null;
  try {
    v = localStorage.getItem("lp.vehicle"); d = localStorage.getItem("lp.dir");
    localStorage.removeItem("lp.sky");   // the sky button is gone; the sky is always the sunny one
  } catch (err) {}
  state.sky = 0;
  try {
    const de = localStorage.getItem("lp.dest");
    if (de === "moon" || de === "mars" || de === "station") state.dest = de;
  } catch (err) {}
  document.querySelectorAll(".destCard").forEach(c2 => c2.classList.toggle("sel", c2.dataset.dest === state.dest));
  restoreSpots();
  if (window.__lp && window.__lp.noRestore) return;
  // A vehicle that has since been removed falls back to an airliner rather than
  // dropping him on the picker: airlinerJetblue was retired and the boy who last
  // flew it should still get an aeroplane when he opens the game.
  if (v && (!TUNE.vehicles[v] || TUNE.vehicles[v].hidden)) v = "airlinerDelta";
  if (!v || d === null || !TUNE.vehicles[v] || TUNE.vehicles[v].hidden) return;
  const di = d === "1" ? 1 : 0;
  applyVehicle(v);
  document.querySelectorAll(".vehCard").forEach(c2 => c2.classList.toggle("sel", c2.dataset.v === v));
  spawnForTakeoff(di, di);
  // the card he used last is already lit, so carrying on is a tap on the thing
  // that is already highlighted rather than a choice he has to make again
  el.screenVehicle.classList.remove("hiddenS");
  el.screenDir.classList.add("hiddenS");
  el.screenDest.classList.add("hiddenS");
})();
updateChunks(state.x, state.z, true);
updateScenery(state.x, state.z, true);
for (const c of clouds) respawnCloud(c, state.x, state.z, 0, -1, false);
grabWakeLock();

window.__lp = {
  toyWorld, TW, twRelease, twWashStart, twWashCan, twWelcome, twHorn, updateToyWorld,
  TUNE, state, flags, update, terrainEff, shapedTerrain, flattenMask, AIRPORTS, ROUTE_LANDMARKS, wrapPi,
  get safePos(){return safePos;}, get blinkers(){return blinkers;}, get hiddenPieces(){return hiddenPieces;},
  get trainHead(){return trainHead;}, get trainSolids(){return trainSolids;}, resolveSolidWalls,
  TRAIN_X, TRAIN_ZMIN, TRAIN_ZMAX,
  get rings(){return rings;}, restoreShattered, get airports(){return airports;}, get windowInst(){return windowInst;}, get precip(){return precip;}, get gates(){return gates;}, get spots(){return spots;}, get clouds(){return clouds;}, rk, BODIES, RECOVERY, rover, roverDeploy, roverReturn, roverCan, roverActive, astro, eva, EVA, ASTRO, enterStation, leaveStation, leaveStationAll, toggleHatch, stationCanEnter, astroActive, dropStage, rocketCanDrop, rocketApplyStages, rocketPad, rocketLandingZone, rocketArrival, rocketTiltDeg, deploySatellite, rocketCanDeploySat, deployChute, rocketCanChute, get satellites(){return satellites;}, rocketSkipToLanding, rocketCanSkip, rocketSkipTarget, get fallingStages(){return fallingStages;}, wakePuffsAlive(){return wakePuffs.filter(p => p.life > 0).length;}, get wakePuffList(){return wakePuffs;}, get targets(){return targets;}, get smokeSources(){return smokeSources;}, get craters(){return craters;}, keys,
  get solidCount(){let n=0;(function it(cb){for(const b of buildingBoxes)cb(b);for(const b of staticSolids)cb(b);for(const arr of streamedSolids.values())for(const b of arr)cb(b);})(()=>n++);return n;},
  get cameraPos(){return camera.position;}, camera, scene, renderer, station, takePhoto,
  sunLight, hemiLight, sunDir, updateSunRig, shadowRadiusWanted, lightMood, currentLightEnv,
  sunDisc, sunHalo, sunLens, cirrus, glowSprite, glowField, updateAtmosphere,
  birdMesh, birds, flocks, highJets, ambFlags, updateAmbient, AMB,
  feel, cameraPunch, cameraHitStop, cameraNod, updateFeel, shakeNow, speedLines, triggerExplosion,
  nozoom, NOZOOM,
  MODELS, modelStore, modelState, modelInstance, modelPrototype, modelsPreload,
  highway, HW, hwyNearest, hwySampleAt, hwyBuild, updateHighway, hwyTrafficNear, hwyKnockTraffic,
  hwyInCorridor, hwyCorridorDist, inCorridor, hwyBoreCut, hwyBoreCeiling, hwyBores,
  car, CAR, carActive, updateCar, carCamera, carSpawn, carReassemble, carRoadTarget, buildCarModel,
  carHornCan, carHornPress, carHornRelease, carUpdateHorn,
  vehKind, vehSlot, vehUpdate, vehCamera, vehParked, vehReassemble, vehSolid, vehWallHit, VEHICLE_CONTRACT,
  BUTTONS, btnUpdateAll, btnSlotClashes, btnObstructions,
  spdKey, spdStepsFor, spdIndex, spdMul, spdNudge, spdCycle, spdUsesCycle, spdReset, spdUpdateButtons,
  openPicker, openPickerAnywhere, pickerCanOpen, menuOpen,
  harbor, HB, hbBuild, updateHarbor, hbRoadY, hbHorn, hbBridgeHonked,
  lock, LK, lockBuild, lockUpdate, lockPress, lockCanCycle, lockInside, lockBoatInside,
  lockLevelAt, lockUpdateButton, seaLevelAt,
  boat, BT, boatActive, updateBoat, boatCamera, boatSpawn, boatReassemble, boatWaterAt, boatOnWater,
  boatCannonCan, boatCannonPress, buildBoatModel, boatPlume, yachtPlume,
  yacht, YT, yachtActive, updateYacht, yachtCamera, yachtSpawn, yachtBuild, yachtPlace,
  yachtPadWorld, yachtPadUnder, yachtHorn, yachtGarageCan, yachtGaragePress, yachtLate,
  buildYachtModel, yachtDropAnchor, yachtRaiseAnchor,
  sea, SE, seaBuild, updateSeaEvents, seaCraneHonked, seaChannelNear,
  seaPlane, seaSub, seaFireboat, seaHideAll,

  demo, DEMO, demoTrigger, demoReset, setBigNum, updateSetpieces, __lpIsHidden: isSolidHidden,
  tcatch, towerCatchInbound, towerCatchReset, towerCatchClear, demoAlarmMuted,
  fire, bucket, FF, bucketPress, bucketCanScoop, bucketCanDrop, fireReset,
  heli, H, heliActive, heliReset, updateHelicopter,
  mars, MB, marsBuild, marsClear, marsIsHome,
  marsDroneActive, marsDroneCan, marsDronePress, marsDroneLand, marsDronePick, marsRocksReset, updateMarsToys, marsLate,
  carrier, CV, carrierLaunchPress, carrierReset, carrierCanLaunch, carrierOnDeck, carrierTryTrap, updateSetpiecesLate,
  ev, EVENT_KINDS, eventsDraw, eventsForce, eventsReset, eventsArm, eventsSpawn, eventsOnDest, eventsWantMissile,
  EVENT_POOLS, evpRegister, evpPool, evpMember, evpAll, evpDraw, evpDue, evpRearm, evpForce, SPACE_POOL, SEA_POOL,
  get evGroup(){return evGroup;}, get evProps(){return ev.props;}, get evCraters(){return ev.craters;}, evSparksAlive,
  audio: { ctxState(){return audioCtx ? audioCtx.state : null;}, rocketNodes(){return !!rocketNodes;}, roarGain(){return rocketNodes ? +rocketNodes.roar.gain.value.toFixed(3) : null;}, engineGain(){return engineNodes ? +engineNodes.g.gain.value.toFixed(3) : null;}, bed(){return bedNodes ? {level:+bedNodes.level.toFixed(4), cut:Math.round(bedNodes.cut), thump:+bedNodes.thump.toFixed(2)} : null;}, bedName(){return currentBedName();}, place(x,y,z){return sfxPlace(x,y,z);} },
  bigBoom, catapultSound, fireHiss, updateAmbientAudio,
  forEachSolid(cb){for(const b of buildingBoxes)cb(b);for(const b of staticSolids)cb(b);for(const arr of streamedSolids.values())for(const b of arr)cb(b);for(const b of trainSolids)cb(b);}, get vehicleModel(){return vehicleModel;},
  get traffic(){return traffic;},
  get missilesList(){return missiles;},
  fireMissile,
  get engineNorm() { return lastEngineNorm; },
  api: {
    setThrottle(v) { state.throttleHeld = !!v; },
    setStick(bank, pitch) {
      state.touching = true;
      state.ctrlBank = clamp(bank, -1, 1);
      state.ctrlPitch = clamp(pitch, -1, 1);
    },
    clearStick() { state.touching = false; state.touchIsPoint = false; state.ctrlBank = 0; state.ctrlPitch = 0; },
    // a finger at a point on the screen, in normalised device coords (the helicopter flies there)
    setTouch(nx, ny) { state.touching = true; state.touchIsPoint = true; state.touchNX = nx; state.touchNY = ny; },
    placeOnRunway() { spawnForTakeoff(0, 0); },
    setView(chase) {
      state.viewChase = !!chase;
      el.hud.classList.toggle("chase", state.viewChase);
    },
    spawnAt(originIdx, dirIdx) { spawnForTakeoff(originIdx, dirIdx); },
    setVehicle(key) { applyVehicle(key); },
    skipScreens() {
      el.screenVehicle.classList.add("hiddenS");
      el.screenDir.classList.add("hiddenS");
      el.screenDest.classList.add("hiddenS");
    },
    teleportAirborne(distBehind, lateral, alt, headingDeg) {
      state.x = lateral;
      state.z = AIRPORTS[0].cz + Math.round(Math.cos(headingDeg * DEG)) * (TUNE.runwayLength / 2 + distBehind);
      state.y = AIRPORTS[0].elev + alt;
      state.heading = headingDeg * DEG;
      let bd = Infinity;
      state.destIdx = 0;
      for (let i = 0; i < AIRPORTS.length; i++) {
        const d = Math.abs(state.z - AIRPORTS[i].cz);
        if (d < bd) { bd = d; state.destIdx = i; }
      }
      state.originIdx = 1 - state.destIdx;
      // Direction follows the heading: flying -z arrives at a runway's +z end (dirIdx 0).
      state.dirIdx = Math.abs(wrapPi(state.heading)) < Math.PI / 2 ? 0 : 1;
      state.maxAglSinceLiftoff = 1e9;
      placeRings();
      state.pitch = 0;
      state.bank = 0;
      state.speed = state.vp.cruiseSpeed;
      state.airVy = null;
      state.phase = "AIRBORNE";
      state.liftoffTimer = 0;
      state.climbAwayTimer = 0;
      state.celebrated = false;
      state.celebrateTimer = 0;
      state.approachLatch = false;
      state.canRotate = false;
    }
  }
};

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;
  if (dt <= 0) dt = 1 / 120;
  // Schedule the next frame first so a thrown exception can never end the loop
  // (the game runs under Guided Access -- there is no way to reload it).
  requestAnimationFrame(frame);
  try {
    update(dt);
    if (!(window.__lp && window.__lp.noRender)) renderer.render(scene, camera);
    if (state.photoPending) {
      // grab the frame we just drew (still in the buffer until the next clear)
      state.photoPending = false;
      try { showPhoto(renderer.domElement.toDataURL("image/jpeg", 0.85)); } catch (err) {}
    }
  } catch (err) {
    console.error("frame error", err);
    window.__lp = window.__lp || {};
    window.__lp.frameErrors = (window.__lp.frameErrors || 0) + 1;
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.z)) spawnForTakeoff();
  }
}
requestAnimationFrame(frame);
