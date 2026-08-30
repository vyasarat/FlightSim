"use strict";
const state = {
  x: 0, y: 0, z: 0,
  pitch: 0, bank: 0, heading: 0,
  ctrlBank: 0, ctrlPitch: 0,
  touching: false,
  startX: 0, startY: 0,
  airVy: null,
  speed: 0,
  phase: "TAXI",
  throttleHeld: false,
  rotatePullTime: 0,
  liftoffTimer: 0,
  climbAwayTimer: 0,
  celebrateTimer: 0,
  celebrated: false,
  assistBias: 0,
  engaged: false,
  canRotate: false,
  approachLatch: false,
  exploding: false,
  explodeTimer: 0,
  spaceF: 0,
  viewChase: false,
  gearDown: true,
  gearAnim: 1,
  vehicleKey: "prop",
  vp: null,
  speedStep: 2,
  missileCooldown: 0,
  missileSide: 1,
  squashTimer: 0,
  popTimer: 0,
  flaring: false,
  ringsEatenThisApproach: 0,
  wingmanHold: 0,
  wingmanCooldown: 0,
  alarmOn: false,
  alarmBeepT: 0,
  sky: 0,            // 0 sun, 1 rain, 2 snow, 3 night
  photoPending: false,
  rainF: 0, snowF: 0, nightF: 0,
  dirIdx: 0,
  originIdx: 0,
  destIdx: 1,
  dest: "moon"   // where the rocket's landing button aims in space: moon | mars | station
};

const flags = { liftoff: 0, touchdown: 0, missed: 0, repositioned: 0, exploded: 0, gear: 0, missiles: 0, missileHits: 0, shootdowns: 0, midairs: 0, ringsEaten: 0, gates: 0, wingman: 0, alarms: 0, targets: 0 };
const safePos = { x: 0, y: 0, z: 0 };

function applyVehicle(key) {
  if (!TUNE.vehicles[key]) return;
  state.vehicleKey = key;
  state.vp = TUNE.vehicles[key];
  if (typeof rocketNodes !== "undefined" && rocketNodes) setRocketEngine(0, 0);   // silence the roar, but don't build the graph for a plane
  const cols = TUNE.vehicleColors[key];
  document.documentElement.style.setProperty("--veh", cols[0]);
  document.documentElement.style.setProperty("--veh2", cols[1]);
  buildVehicleModel(key);
  // the rocket is a thing to watch: it starts in the chase view (the view button still toggles)
  if (state.vp.rocket && !state.viewChase) { state.viewChase = true; el.hud.classList.add("chase"); }
  if (!state.vp.rocket) {
    for (const b of [el.stageBtn, el.satBtn, el.chuteBtn, el.roverBtn, el.hatchBtn]) b.classList.add("hidden");
    if (typeof roverReset === "function") roverReset();
    if (typeof astroReset === "function") astroReset();
    if (typeof cancelRecovery === "function") cancelRecovery();
  }
  if (vehicleModel) {
    vehicleModel.visible = state.viewChase && !state.exploding;
  }
}

// The rocket's launch pad: on the side of the runway away from the terminal,
// standing on the launch mount (solid top, so it can land back on it).
function rocketPad(idx) {
  const ap = AIRPORTS[idx], P = TUNE.rocketTune.pad;
  const m = idx === 0 ? 1 : -1;
  return { x: -m * P.dx, z: ap.cz + P.dz, ground: ap.elev + P.mountH };
}
function spawnForTakeoff(originIdx, dirIdx) {
  if (originIdx === undefined) { originIdx = state.originIdx; }
  if (dirIdx === undefined) { dirIdx = state.dirIdx; }
  state.originIdx = originIdx;
  state.dirIdx = dirIdx;
  state.destIdx = 1 - originIdx;
  const ap = AIRPORTS[state.originIdx];
  const sgn = dirIdx === 0 ? 1 : -1;
  state.x = 0;
  state.z = ap.cz + sgn * (TUNE.runwayLength / 2 - 50);
  state.y = ap.elev + TUNE.gearHeight;
  state.heading = dirIdx === 0 ? 0 : Math.PI;
  state.pitch = 0;
  state.bank = 0;
  state.speed = 0;
  state.airVy = null;
  state.ctrlBank = 0;
  state.ctrlPitch = 0;
  // Deliberately do NOT clear `touching` / `throttleHeld`: the finger may still
  // be physically down (ran off the runway end while holding throttle) and the
  // pointerup that would re-arm it never comes.
  state.rotatePullTime = 0;
  state.liftoffTimer = 0;
  state.climbAwayTimer = 0;
  state.celebrateTimer = 0;
  state.celebrated = false;
  state.assistBias = 0;
  state.engaged = false;
  state.canRotate = false;
  state.approachLatch = false;
  state.approachData = null;   // a stale approach from the last landing must not silence the alarm
  state.exploding = false;
  state.explodeTimer = 0;
  state.gearDown = true;
  state.gearAnim = 1;
  state.maxAglSinceLiftoff = 0;
  state.phase = "TAXI";
  if (state.vp && state.vp.rocket) {
    state.pitch = 90;
    rk.onBody = null;
    rocketRestock();
    const pad = rocketPad(originIdx);
    state.x = pad.x; state.z = pad.z;
    rk.groundHere = pad.ground;
    state.y = pad.ground + rocketHalfLen();
  }
  if (typeof apronVehiclesTo === "function") apronVehiclesTo(originIdx, true);
  placeRings();
  // last flight's event goes away and a new one is drawn for this stack
  if (typeof eventsSpawn === "function") eventsSpawn();
  flags.repositioned++;
}

applyVehicle("prop");
spawnForTakeoff(0, 0);
initTraffic();
initTargets();

const glEl = renderer.domElement;
