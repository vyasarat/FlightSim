"use strict";
const state = {
  x: 0, y: 0, z: 0,
  pitch: 0, bank: 0, heading: 0,
  ctrlBank: 0, ctrlPitch: 0,
  touching: false,
  startX: 0, startY: 0,
  touchNX: 0, touchNY: 0, touchIsPoint: false,   // where the finger is, for the helicopter
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
  // speedStep is redefined in js/speed.js as an accessor over the per-vehicle
  // step memory. It is declared here so the shape of `state` is still readable
  // in one place; the value below is never the one anybody sees.
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

// EVERY per-vehicle tone, and the frequency to park it at.
//
// Each of these is driven once a frame by the one vehicle that owns it and by
// nobody else -- so switching vehicle simply STOPS those updates and the
// oscillator carries on at whatever gain it last had. The boat's three were
// being silenced by hand below; the car's whine and tyre roar and the yacht's
// diesel and hull were not, so they followed him into the next vehicle and hung
// there under everything for the rest of the session. Silencing the whole list
// on every switch costs nothing and cannot rot: whichever vehicle owns a tone
// re-establishes it on its very next frame.
const VEHICLE_TONES = [
  ["boatEngine", "sawtooth", 60], ["boatHull", "triangle", 90], ["boatCannon", "sawtooth", 120],
  ["carWhine", "sawtooth", 60], ["carTyre", "triangle", 90],
  ["carHornA", "sawtooth", 370], ["carHornB", "sawtooth", 294],
  ["yachtDiesel", "sawtooth", 30], ["yachtHull", "triangle", 55],
  ["rover", "sawtooth", 55],
];

function applyVehicle(key) {
  if (!TUNE.vehicles[key]) return;
  if (typeof heliReset === "function") heliReset();
  state.vehicleKey = key;
  state.vp = TUNE.vehicles[key];
  if (typeof rocketNodes !== "undefined" && rocketNodes) setRocketEngine(0, 0);   // silence the roar, but don't build the graph for a plane
  const cols = TUNE.vehicleColors[key];
  document.documentElement.style.setProperty("--veh", cols[0]);
  document.documentElement.style.setProperty("--veh2", cols[1]);
  buildVehicleModel(key);
  // the car's cabin is scene-level, so it has to be put away by hand when he
  // climbs out -- otherwise it stays standing in the world behind him
  if (!state.vp.car && typeof carHideCabin === "function") carHideCabin();
  // ... and so is the boat's helm, for exactly the same reason
  if (!state.vp.boat && typeof boatHideHelm === "function") boatHideHelm();
  if (!state.vp.bigBoat) {
    if (typeof yachtHideBridge === "function") yachtHideBridge();
    // she is a place in the world whether or not he is standing on her, so she
    // has to be put back into the world the moment he steps off
    if (typeof yacht !== "undefined" && yacht.built) { yacht.aboard = false; yachtPlace(); }
  }
  if (typeof el.garageBtn !== "undefined" && el.garageBtn && !state.vp.boat) el.garageBtn.classList.add("hidden");
  // Watch the rocket, see the helicopter's tool/load, and see the boat's hull and
  // its wake, in chase view; the view button still toggles.
  if ((state.vp.rocket || state.vp.heli || state.vp.boat) && !state.viewChase) { state.viewChase = true; el.hud.classList.add("chase"); }
  // The cannon lives on the boat alone. Left up, it sits in the helicopter
  // bucket's slot and eats the tap that means "scoop".
  if (!state.vp.boat) {
    el.cannonBtn.classList.add("hidden");
    if (typeof boatCannonPress === "function") boatCannonPress(false);
  }
  if (typeof setTone === "function") for (const [n, t, f] of VEHICLE_TONES) setTone(n, t, f, 0);
  el.missileBtn.classList.toggle("lowSlot", !!state.vp.rocket);   // the shared slot is spoken for on a rocket
  if (!state.vp.rocket) {
    for (const b of [el.stageBtn, el.satBtn, el.chuteBtn, el.roverBtn, el.hatchBtn, el.droneBtn]) b.classList.add("hidden");
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
  if (state.vp && state.vp.car) {
    if (typeof carSpawn === "function" && typeof highway !== "undefined" && highway.built) carSpawn(originIdx);
  }
  // A boat does not spawn on a runway. It spawns in its berth, whichever end of
  // the country the direction card picked -- there is only one harbour, and
  // putting a speedboat on the tarmac in New York would be a joke he cannot
  // recover from without the picker.
  if (state.vp && state.vp.bigBoat) { if (typeof yachtSpawn === "function") yachtSpawn(); }
  else if (state.vp && state.vp.boat && typeof boatSpawn === "function") boatSpawn();
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
  if (typeof towerCatchReset === "function") towerCatchReset();
  if (typeof carrierReset === "function") carrierReset();
  if (typeof heliReset === "function") heliReset();
  if (state.vp.heli && typeof twFacePlayground === "function") twFacePlayground();
  flags.repositioned++;
}

applyVehicle("prop");
spawnForTakeoff(0, 0);
initTraffic();
initTargets();

const glEl = renderer.domElement;
