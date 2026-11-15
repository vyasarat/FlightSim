"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- WHAT THE SHARED STATE FIELDS ACTUALLY MEAN.
//
// One `state` object is read by forty files, and several of its fields mean
// DIFFERENT THINGS depending on what he is driving. That is not a thing to fix
// by renaming -- it is a thing to write down, because every bug this codebase
// has had in that area came from a reader assuming the aeroplane's meaning.
// scripts/state_semantics_checks.js asserts the ones that can be asserted.
//
//   state.y      THE VEHICLE'S OWN REFERENCE HEIGHT, and its zero is different
//                per vehicle. Aircraft: the model origin, with the wheels
//                TUNE.gearHeight below it. Car: the road surface (the body's
//                origin is 2.6 m lower still). Boat and yacht: the WATERLINE --
//                and the waterline is seaLevelAt(x,z), not TUNE.waterLevel, so
//                inside the lock it is six metres higher. Rover and Mars drone:
//                MEANINGLESS. They live on a sphere; rover.x/y/z and
//                mars.drone.h are the truth, and state.y is stale for them.
//
//   state.phase  "TAXI" | "ROLL" | "AIRBORNE" | "CLIMB_AWAY" | "LANDED".
//                An AEROPLANE's flight phase. The car, boat, yacht, helicopter
//                and rocket set "TAXI" as a way of saying "not flying", which
//                is a lie a reader can believe: it is why the car wash offered
//                itself to a boat parked in the harbour lock. ASK THE VEHICLE
//                (vehParked() in js/vehicles.js), not the phase, unless you
//                genuinely mean an aeroplane's phase. Migrating its sixty-odd
//                readers is a separate job, deliberately not done yet.
//
//   state.speed  metres per second along `forward`, for every vehicle. The one
//                field that means the same thing everywhere -- EXCEPT for the
//                rover and the drone, which keep their own (rover.speed,
//                mars.drone.speed) and leave this one stale.
//
//   state.airVy  vertical velocity, aircraft only. Surface vehicles pin it to 0.
//
//   state.vp     the vehicle PROFILE from TUNE.vehicles. Its booleans are not
//                exclusive: `bigBoat` implies `boat`, which is why anything
//                asking must ask in the order js/vehicles.js asks.
//
//   safePos      where the SHARED respawn puts him after a bang -- and only the
//                aeroplane ever writes it. A vehicle that wants to come back
//                where it crashed records that itself (boat.crashX, car.crashX)
//                and uses it in its own reassemble slot. The car not doing this
//                is why it used to come back at the far end of the last flight.
//   gameT        (v203) seconds of GAME time: update(dt) adds dt. Every bob, pulse and
//                blink times off it (gameMs()), never performance.now() -- the
//                harness runs 12 sim-seconds in a sixth of a real one, so a wall-clock
//                bob left the boat's resting height to how long the page took.
// ---------------------------------------------------------------------------
const state = {
  gameT: 0,
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
// (v203) game time in milliseconds, for the sin() of a bob or a pulse
function gameMs() { return state.gameT * 1000; }

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
  ["boatHull", "triangle", 90], ["boatCannon", "sawtooth", 120],
  ["carTyre", "triangle", 90],
  ["yachtHull", "triangle", 55],
  ["rover", "sawtooth", 55],
  ["srBurst", "sawtooth", TUNE.sledRide.burst.hz],   // v144: the rocket sled's burst (sledride.js)
  ["cvRoar", "sawtooth", TUNE.corvette.roar.hz],     // v159: the Corvette's booster (corvette.js)
];

// ---------------------------------------------------------------------------
// WORKING RULES -- LEAVING: ONE TABLE OF WHAT IS PUT AWAY (v221, B4 step 1).
//
// Three places put away what he was doing: a change of vehicle (applyVehicle, the vehicle card), a fresh
// start (spawnForTakeoff: the direction card, a relaunch, the globe, a rescue), and the menu button
// (openPickerAnywhere, input.js). Each had its own list. LEAVE holds every statement of the three as one
// named row, moved verbatim with its own guard; LEAVE_AT says, per place, which rows it runs and in what
// order, in steps, because each place does some of its own work between them (takes the new vehicle,
// builds its model, poses him on the runway) and that work stays where it was, inline. A row a place
// does not run is not in its lists: the grid below shows every row against every place, "-" for not run.
// Each place runs exactly what it ran before v221, in exactly the old order -- the three lists did not
// agree on an order (the helicopter and the toy track, the race and the helicopter, the cannon and the
// rover), so there is no one order for all of them: each place keeps its own. A step guarded by the new
// vehicle (offBoat, offRocket) is guarded at the place that runs it, as it was.
//
//   row            vehicle     start   picker     what goes
//   monster        leaving     -       -          what the monster truck crushed comes back
//   robot          leaving     first   -          the giant robot forgets him ("vehicle" / "start")
//   crane          leaving     -       -          the crane's lot goes away
//   heavy          leaving     -       -          the heavy's side boosters (unless he picked the heavy)
//   heli           leaving     last    unwind     the helicopter's tool, load and air
//   track          leaving     first   -          off the giant toy track
//   corvette       leaving     -       -          the Corvette's booster flames
//   rocketRoar     roar        -       -          the rocket's roar, if its graph exists
//   cabin          putAway     -       -          the car's cabin (unless he picked a car)
//   helm           putAway     -       -          the boat's helm (unless he picked a boat)
//   yacht          putAway     -       -          the yacht's bridge, and she goes back in the world
//   cannon         offBoat     -       unwind     the boat's cannon lets go
//   tones          quiet       -       -          every per-vehicle tone (VEHICLE_TONES) to zero
//   audioHold      quiet       first   -          the picker's hold forgets what it quieted
//   reentry        offRocket   -       -          re-entry's glow
//   reentryRoar    offRocket   -       -          re-entry's roar
//   rocketButtons  offRocket   -       -          stage, satellite, chute, rover, hatch, drone buttons
//   rover          offRocket   -       unwind     the rover put away
//   astro          offRocket   -       unwind     the astronaut back in
//   recovery       offRocket   -       unwind     the booster's recovery called off
//   body           offRocket   -       -          off the Moon, Mars or the station: rk.onBody cleared (v222, Q-18)
//   race           -           first   unwind     out of a race, its track picker shut
//   demo           -           first   -          out of a demolition's count
//   police         -           first   -          out of a police pull-over
//   events         -           last    -          last flight's event goes, a new one is drawn (DRAWS from the stream)
//   towerCatch     -           last    -          the tower catch re-armed
//   carrier        -           last    -          the carrier re-armed
//   throttle       -           -       unwind     the throttle let go
//   keys           -           -       unwind     the keyboard's held keys
//   finger         -           -       unwind     the finger's touch and stick
//   stick          -           -       unwind     the stick's pointer
//   pieces         -           -       unwind     a bang's pieces put back, the bang over
//   horn           -           -       unwind     the car's horn let go
//
// What stays inline, at its old place: applyVehicle's taking of the new vehicle (key, profile, colours, the
// model), its chase view and the missile's low slot, and its model's visibility; spawnForTakeoff's runway
// pose, the vehicles' spawns, the rocket's pad (with its `rk.onBody = null`), the apron, the rings, the
// helicopter's playground and the count; the picker's three refusals at its top and its screens after.
//
// (v222) `body` is the first row added after the move: the rocket is the only vehicle that lands on a body, so a
// change to anything else is off it -- the rover and the astronaut are put away in the same step. Only the
// vehicle card's place runs it: the menu does not (opened on the Moon he is still on it until he picks), a fresh
// start does not need to (a non-rocket only comes from applyVehicle, which has cleared it; the rocket's own pad
// clears it inline, as before), and dad mode enters through applyVehicle.
//
// Not yet (B4's next steps, one row per release): a place running a row it does not run today.
// The order each place runs its rows in is pinned by leave_matrix_checks ("leave order: ..."); gate 20 holds the
// names and this grid to LEAVE_AT.
// ---------------------------------------------------------------------------
const LEAVE = {
  monster:       () => { if (typeof monRestoreAll === "function") monRestoreAll(); },   // what the monster truck crushed comes back when he leaves it: nothing is lost
  robot:         (at) => { if (typeof tnStandDown === "function") tnStandDown({ vehicle: "vehicle", start: "start" }[at]); },   // (v218) a different vehicle, a fresh start: the giant robot forgets him
  crane:         () => { if (typeof crLeave === "function") crLeave(); },   // the crane's towers stand back up and go away (v145): its lot is drawn only while he is in it
  heavy:         (at, key) => { if (typeof heavyReset === "function" && !(TUNE.vehicles[key] && TUNE.vehicles[key].heavy)) heavyReset(); },   // the heavy's side boosters do not outlive it
  heli:          () => { if (typeof heliReset === "function") heliReset(); },
  // (v214) ... and off the giant toy track: it stayed on, and the next frame put him back on the
  // rail -- the globe took him nowhere, but saved London as his start
  track:         () => { if (typeof trackReset === "function") trackReset(); },
  corvette:      () => { if (typeof cvReset === "function") cvReset(); },   // v159: the booster's flames do not outlive the Corvette
  rocketRoar:    () => { if (typeof rocketNodes !== "undefined" && rocketNodes) setRocketEngine(0, 0); },   // silence the roar, but don't build the graph for a plane
  // the car's cabin is scene-level, so it has to be put away by hand when he
  // climbs out -- otherwise it stays standing in the world behind him
  cabin:         () => { if (!state.vp.car && typeof carHideCabin === "function") carHideCabin(); },
  // ... and so is the boat's helm, for exactly the same reason
  helm:          () => { if (!state.vp.boat && typeof boatHideHelm === "function") boatHideHelm(); },
  yacht:         () => {
    if (!state.vp.bigBoat) {
      if (typeof yachtHideBridge === "function") yachtHideBridge();
      // she is a place in the world whether or not he is standing on her, so she
      // has to be put back into the world the moment he steps off
      if (typeof yacht !== "undefined" && yacht.built) { yacht.aboard = false; yachtPlace(); }
    }
  },
  // The cannon lives on the boat alone. Left up, it sits in the helicopter
  // bucket's slot and eats the tap that means "scoop".
  cannon:        () => { if (typeof boatCannonPress === "function") boatCannonPress(false); },
  tones:         () => { if (typeof setTone === "function") for (const [n, t, f] of VEHICLE_TONES) setTone(n, t, f, 0); },
  audioHold:     () => { if (typeof audioHoldForget === "function") audioHoldForget(); },   // (v217) nothing the picker quieted comes back in what he picked, nor in a fresh start
  // (v213) re-entry's glow and roar are driven only by the rocket's own update: left mid-re-entry
  // they stayed on the screen and in his ears in whatever he picked, until his next rocket
  reentry:       () => { if (typeof rk !== "undefined" && rk.reentry > 0) { rk.reentry = 0; reentryOverlay(); } },
  reentryRoar:   () => { if (typeof setReentryRoar === "function") setReentryRoar(0); },
  rocketButtons: () => { for (const b of [el.stageBtn, el.satBtn, el.chuteBtn, el.roverBtn, el.hatchBtn, el.droneBtn]) b.classList.add("hidden"); },
  rover:         () => { if (typeof roverReset === "function") roverReset(); },
  astro:         () => { if (typeof astroReset === "function") astroReset(); },
  recovery:      () => { if (typeof cancelRecovery === "function") cancelRecovery(); },
  // (v222, Q-18) off the Moon, Mars or the station: only the rocket stands on a body. Left set, every reader of
  // rk.onBody (the ambient bed first, audio.js currentBedName; the sky, the light, the streamed lamps and the
  // motorway) took the plane on the runway for one on the Moon
  body:          () => { if (typeof rk !== "undefined") rk.onBody = null; },
  race:          () => { if (typeof raceReset === "function") raceReset(); },   // v164: every start is out of a race (and the picker's: its track picker shut)
  demo:          () => { if (typeof demoStandDown === "function") demoStandDown(); },   // (v213) ... and out of a demolition's count
  // (v214) ... and out of a police pull-over: its cars eased toward him with no limit on the step,
  // so from a relaunch they crossed the country (or the sea) in two seconds to finish the 3-2-1
  police:        () => { if (typeof policeStop === "function") policeStop(false); },
  // last flight's event goes away and a new one is drawn for this stack (it DRAWS from the random stream:
  // where it runs among the other draws is what every seeded check after it sees)
  events:        () => { if (typeof eventsSpawn === "function") eventsSpawn(); },
  towerCatch:    () => { if (typeof towerCatchReset === "function") towerCatchReset(); },
  carrier:       () => { if (typeof carrierReset === "function") carrierReset(); },
  // input.js's own: the finger and the keys let go (its names are read when the row runs, never at load)
  throttle:      () => { releaseThrottle(); },
  keys:          () => { keys.clear(); },
  finger:        () => { state.touching = false; state.touchIsPoint = false; state.ctrlBank = 0; state.ctrlPitch = 0; },
  stick:         () => { stickPointerId = null; },
  // If he was mid-bang, put the pieces back before the picker covers the world:
  // clearing `exploding` alone leaves the shattered model hidden behind it.
  pieces:        () => { if (typeof restoreShattered === "function") restoreShattered(); state.exploding = false; state.explodeTimer = 0; },
  horn:          () => { if (typeof carHornRelease === "function") carHornRelease(); },
};
const LEAVE_AT = {
  vehicle: {   // applyVehicle(key)
    leaving:   ["monster", "robot", "crane", "heavy", "heli", "track", "corvette"],   // before the new vehicle is his
    roar:      ["rocketRoar"],                                                         // his profile is the new one
    putAway:   ["cabin", "helm", "yacht"],                                             // the new model is built
    offBoat:   ["cannon"],                                                             // only if he did not pick a boat
    quiet:     ["tones", "audioHold"],
    offRocket: ["reentry", "reentryRoar", "rocketButtons", "rover", "astro", "recovery", "body"],   // only if he did not pick a rocket
  },
  start: {     // spawnForTakeoff(originIdx, dirIdx)
    first: ["audioHold", "race", "demo", "robot", "police", "track"],   // before he is posed on the runway
    last:  ["events", "towerCatch", "carrier", "heli"],                 // after the rings are placed
  },
  picker: {    // openPickerAnywhere(), the menu button
    unwind: ["throttle", "keys", "finger", "stick", "pieces", "rover", "astro", "recovery", "heli", "cannon", "horn", "race"],
  },
};
// One step of one place's leaving, its rows in its own order.
function leaveRun(at, step, key) {
  for (const row of LEAVE_AT[at][step]) LEAVE[row](at, key);
}

function applyVehicle(key) {
  if (!TUNE.vehicles[key]) return;
  leaveRun("vehicle", "leaving", key);
  state.vehicleKey = key;
  state.vp = TUNE.vehicles[key];
  leaveRun("vehicle", "roar", key);
  const cols = TUNE.vehicleColors[key];
  document.documentElement.style.setProperty("--veh", cols[0]);
  document.documentElement.style.setProperty("--veh2", cols[1]);
  buildVehicleModel(key);
  leaveRun("vehicle", "putAway", key);
  // Watch the rocket, see the helicopter's tool/load, and see the boat's hull and
  // its wake, in chase view; the view button still toggles.
  if ((state.vp.rocket || state.vp.heli || state.vp.boat || state.vp.sledRide || state.vp.crane) && !state.viewChase) { state.viewChase = true; el.hud.classList.add("chase"); }
  if (!state.vp.boat) leaveRun("vehicle", "offBoat", key);
  leaveRun("vehicle", "quiet", key);
  el.missileBtn.classList.toggle("lowSlot", !!state.vp.rocket);   // the shared slot is spoken for on a rocket
  if (!state.vp.rocket) leaveRun("vehicle", "offRocket", key);
  if (vehicleModel) {
    vehicleModel.visible = state.viewChase && !state.exploding;
  }
}

// The rocket's launch pad: on the side of the runway away from the terminal,
// standing on the launch mount (solid top, so it can land back on it).
function rocketPad(idx) {
  // the booster rocket stands on the launch site's pad, beside the motorway (heavy.js)
  if (state.vp && state.vp.heavy && typeof heavyPad === "function") { const hp = heavyPad(); if (hp) return hp; }
  const ap = AIRPORTS[idx], P = TUNE.rocketTune.pad;
  const m = AIRPORTS[idx].side;
  return { x: -m * P.dx, z: ap.cz + P.dz, ground: ap.elev + P.mountH };
}
// (v214) Back on an airport's runway the way a landing puts him there: origin and direction PAIRED
// (New York flies south, California north, London south to New York). A bare spawnForTakeoff()
// reuses whatever pair it finds, and London's heading switch leaves one that faces out to sea.
function spawnAtAirport(at) { spawnForTakeoff(at, at === 1 ? 1 : 0); }
function spawnForTakeoff(originIdx, dirIdx) {
  if (originIdx === undefined) { originIdx = state.originIdx; }
  if (dirIdx === undefined) { dirIdx = state.dirIdx; }
  leaveRun("start", "first");   // (v221) the LEAVE table above: the hold forgets, out of a race, a count, the robot's eye, a pull-over, the toy track
  state.originIdx = originIdx;
  state.dirIdx = dirIdx;
  state.destIdx = apDest(originIdx);
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
  if (state.vp && state.vp.monster && typeof monSpawn === "function") monSpawn();   // the arena, either way
  if (state.vp && state.vp.sledRide && typeof srSpawn === "function") srSpawn();   // v144: on the sled at the start tower, either way
  if (state.vp && state.vp.crane && typeof crSpawn === "function") crSpawn();   // v145: in the crane on its lot, either way
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
  // (not to the crane, v145: its lot is out in the country, not on an apron -- they stay at their airport)
  if (typeof apronVehiclesTo === "function" && !(state.vp && state.vp.crane)) apronVehiclesTo(originIdx, true);
  placeRings();
  leaveRun("start", "last");   // (v221) last flight's event goes and a new one is drawn (the stream), the set-pieces re-armed, the helicopter
  if (state.vp.heli && typeof twFacePlayground === "function") twFacePlayground();
  flags.repositioned++;
}

applyVehicle("prop");
spawnForTakeoff(0, 0);
initTraffic();
initTargets();

const glEl = renderer.domElement;
