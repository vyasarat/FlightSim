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
  rainF: 0, snowF: 0, nightF: 0,
  dirIdx: 0,
  originIdx: 0,
  destIdx: 1
};

const flags = { liftoff: 0, touchdown: 0, missed: 0, repositioned: 0, exploded: 0, gear: 0, missiles: 0, missileHits: 0, shootdowns: 0, midairs: 0, ringsEaten: 0, gates: 0, wingman: 0, alarms: 0, targets: 0 };
const safePos = { x: 0, y: 0, z: 0 };

function applyVehicle(key) {
  if (!TUNE.vehicles[key]) return;
  state.vehicleKey = key;
  state.vp = TUNE.vehicles[key];
  const cols = TUNE.vehicleColors[key];
  document.documentElement.style.setProperty("--veh", cols[0]);
  document.documentElement.style.setProperty("--veh2", cols[1]);
  buildVehicleModel(key);
  if (vehicleModel) {
    vehicleModel.visible = state.viewChase && !state.exploding;
  }
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
  state.exploding = false;
  state.explodeTimer = 0;
  state.gearDown = true;
  state.gearAnim = 1;
  state.maxAglSinceLiftoff = 0;
  state.phase = "TAXI";
  placeRings();
  flags.repositioned++;
}

applyVehicle("prop");
spawnForTakeoff(0, 0);
initTraffic();
initTargets();

const glEl = renderer.domElement;
