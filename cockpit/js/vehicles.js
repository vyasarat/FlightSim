"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE VEHICLE CONTRACT.
//
// One place that says, for whatever he is driving right now: how it updates,
// where its cameras sit, whether it is parked, and where it comes back from a
// bang. Before this, each of those lived in an `if (vp.boat) ... else if
// (vp.car) ...` chain, and there were four of them in three files, in three
// different orders. Adding a vehicle meant finding all of them; forgetting one
// is how the rover ended up with a throttle button it never asked for.
//
// A MODE IS A VEHICLE HERE. The rocket is also the rover, the astronaut and the
// Mars drone, and those are not cards in the picker -- they are states it gets
// into. `vehKind()` resolves the mode, not just the card, because every one of
// those questions has a different answer in each of them.
//
// THE ORDER IS LOAD-BEARING. A yacht is a boat -- `vp.bigBoat` implies
// `vp.boat` -- so it has to be asked about first. That was a comment in one
// chain and an accident in the other two; here it is one resolver and cannot
// disagree with itself.
//
// THIS FILE CHANGES NO BEHAVIOUR. Every entry calls exactly the function the
// old chain called, in the same order, under the same condition. The vehicle
// baseline in scripts/vehicle_baseline.json is the proof: sixty recorded
// numbers across ten vehicles, and not one of them may move.
//
// IT IS A LOOKUP, NOT A FRAMEWORK. No inheritance, no registration, no
// lifecycle. A table of small functions, resolved once a frame.
// ---------------------------------------------------------------------------

// Which kind is he in, counting modes. Resolved in the one order that is safe:
// the rocket's modes before the rocket, the yacht before the boat.
function vehKind() {
  const vp = state.vp;
  if (!vp) return "plane";
  if (vp.rocket) {
    if (typeof marsDroneActive === "function" && marsDroneActive()) return "drone";
    if (typeof roverActive === "function" && roverActive()) return "rover";
    if (typeof astroActive === "function" && astroActive()) return "astro";
    return "rocket";
  }
  if (vp.bigBoat) return "yacht";       // a yacht is a boat: ask first
  if (vp.boat) return "boat";
  if (vp.monster) return "monster";      // v141: its own rules, not the car's
  if (vp.sledRide) return "sled";        // v144: the set-piece's rail, ridden (sledride.js)
  if (vp.car) return "car";
  if (vp.heli) return "heli";
  return "plane";                        // prop, fighter, the airliners
}

// ---------------------------------------------------------------------------
// The table. Every slot is optional; `vehSlot` falls back to the plane's, which
// is what the old chains did by reaching their final `else`.
//
//   update(dt)      drive it for a frame
//   camera(dt)      put the camera where this vehicle wants it, both views
//   parked()        is he stopped somewhere it is safe to leave? -- the honest
//                   question the picker and the car wash were asking by testing
//                   `phase === "TAXI"`, which five vehicles only ever set as a
//                   way of saying "not flying"
//   reassemble()    where it comes back after a bang, AFTER the shared respawn
//                   has moved him to safePos
//   crashedAt()     where the bang happened, for vehicles that remember -- the
//                   thing the car was missing when it came back at the far end
//                   of the last aeroplane's flight
//   solid()         is this vehicle solid against walls right now? The shared
//                   resolver used to answer this with `phase === "AIRBORNE"`,
//                   which is the phase lie again: the car sets TAXI every frame
//                   as a way of saying "not flying", so its call to
//                   resolveSolidWalls returned on the first line and had never
//                   once run. A building the car drove through was not a
//                   placement bug, it was that.
//   wallHit(push)   what this vehicle does when it does hit one. Return true to
//                   say it has been handled; the shared explode-and-respawn
//                   writes `safePos`, which only the AEROPLANE reads, so a car
//                   doing its own is the difference between coming back on the
//                   road and coming back wherever the last aeroplane crashed.
//
//   solidClass      which SOLID class he is (solids.js): what may block him. His
//                   radius and his crawl speed are TUNE.solid.r / .crawl, by kind.
//
// Every vehicle asks the ONE registry (solids.js) now. The boat and the yacht
// used to sweep `harbor.solids` on their own, and the lock walls, which were
// never on that list, were air to them; the rover and the drone had no list.
// ---------------------------------------------------------------------------
const VEHICLE_CONTRACT = {
  plane: {
    solidClass: SOLID.AIR,
    // Solid on the ground as well as in the air: a plane rolling into a hangar
    // is shoved at taxi speed and bangs at take-off speed, like anything else.
    // (flight.js asks on the ground with the kerb allowance.)
    solid: () => true,
    update: null,                      // the flight model runs inline; see vehUpdate
    camera: null,                      // ... and so does the shared camera
    parked: () => state.phase === "TAXI" && state.speed === 0,
    reassemble: null,
  },
  heli: {
    solidClass: SOLID.AIR,
    wallHit: (push, hit) => heliWallHit(push, hit),
    solid: () => state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY",   // parked, it does not move
    update: (dt) => updateHelicopter(dt),
    camera: null,                      // the shared camera has the heli branch inside it
    // The helicopter still answers this with the phase, because it is the one
    // vehicle that genuinely sets TAXI to mean "on the ground" rather than as a
    // synonym for "not flying". Changing it here would change behaviour, and
    // this commit changes none.
    parked: () => state.phase === "TAXI" && state.speed === 0,
    reassemble: null,
  },
  car: {
    solidClass: SOLID.CAR,
    solid: () => true,
    wallHit: (push) => carWallHit(push),
    update: (dt) => updateCar(dt),
    camera: (dt) => carCamera(dt),
    parked: () => state.speed === 0,
    reassemble: () => carReassemble(),
  },
  // v141: the monster truck he drives (monster.js). It meets the registry itself
  // (monMeet: a column, crushed or shoved), so the shared resolver never runs for
  // it -- and it never bangs, at any speed.
  monster: {
    solidClass: SOLID.CAR,
    solid: () => false,
    update: (dt) => updateMonster(dt),
    camera: (dt) => monCamera(dt),
    parked: () => state.speed === 0,
    reassemble: null,
  },
  // v144: the rocket sled he rides (sledride.js). He IS the set-piece's sled, on
  // its rail: rocketsled.js moves it and he is read off it every frame. Nothing
  // can stand on the rail in front of him -- the rail, the wall (smashed as the
  // nose reaches it), the tower and the sled's own capsule are the run's own
  // solids -- so he is not solid against the registry, and never bangs. Parked
  // only at home in the start tower, where the next go starts the next run.
  sled: {
    solidClass: SOLID.CAR,
    solid: () => false,
    update: (dt) => srUpdate(dt),
    camera: (dt) => srCamera(dt),
    parked: () => srParked(),
    reassemble: () => srPlace(),
  },
  boat: {
    solidClass: SOLID.BOAT,
    solid: () => true,
    update: (dt) => updateBoat(dt),
    camera: (dt) => boatCamera(dt),
    parked: () => state.speed === 0,
    reassemble: () => boatReassemble(),
  },
  yacht: {
    solidClass: SOLID.BOAT,
    solid: () => true,
    update: (dt) => updateYacht(dt),
    camera: (dt) => yachtCamera(dt),
    parked: () => state.speed === 0,
    reassemble: () => yachtReassemble(),
  },
  rocket: {
    solidClass: SOLID.AIR,
    solid: () => state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY",   // parked, it does not move
    update: (dt) => updateRocket(dt),
    camera: (dt) => rocketCamera(dt),
    // A rocket sitting on a body is somewhere he has to fly home FROM, so the
    // picker stays shut there -- which is what the old `rk.onBody` clause in
    // pickerCanOpen was saying.
    parked: () => state.phase === "TAXI" && state.speed === 0 && !rk.onBody,
    reassemble: () => rocketAfterReassemble(),
  },
  // The rocket's three modes. They update through updateRocket, which dispatches
  // to them internally, and they reassemble as the rocket does -- the old code
  // asked `if (state.vp.rocket)`, which is true in all three, so they must too.
  // None of them is ever "parked" for the picker's purposes: out on a body, in
  // the rover or on a spacewalk, the way back is the go button, not the menu.
  rover:  { solidClass: SOLID.ROVER, solid: () => false, update: (dt) => updateRocket(dt), camera: (dt) => roverCamera(dt),     parked: () => false, reassemble: () => rocketAfterReassemble() },
  drone:  { solidClass: SOLID.ROVER, solid: () => false, update: (dt) => updateRocket(dt), camera: (dt) => marsDroneCamera(dt), parked: () => false, reassemble: () => rocketAfterReassemble() },
  astro:  { solidClass: SOLID.ROVER, solid: () => false, update: (dt) => updateRocket(dt), camera: (dt) => astroCamera(dt),     parked: () => false, reassemble: () => rocketAfterReassemble() },
};

function vehSlot(name) {
  const e = VEHICLE_CONTRACT[vehKind()];
  const v = e && e[name];
  return v === undefined ? VEHICLE_CONTRACT.plane[name] : v;
}

// ---- the four questions ----------------------------------------------------

// Drive it. Returns true if the vehicle owned the frame; false means the flight
// model should run its own ground/air branches inline, which is what the old
// chain's final `else` did for the fixed-wing aircraft.
function vehUpdate(dt) {
  const fn = vehSlot("update");
  if (!fn) return false;
  fn(dt);
  return true;
}

// Put the camera where this vehicle wants it. Same answer as before: false
// means the shared camera in vehicle.js handles it (the plane, and the
// helicopter, whose chase branch lives inside that shared function).
function vehCamera(dt) {
  const fn = vehSlot("camera");
  if (!fn) return false;
  fn(dt);
  return true;
}

// Is he stopped somewhere it is safe to leave? Asked by the picker and by the
// car wash, both of which used to ask `phase === "TAXI" && speed === 0` -- true
// of a boat sitting in a lock two kilometres from the wash, which is how the
// wash came to offer itself out there.
function vehParked() {
  const fn = vehSlot("parked");
  return fn ? !!fn() : false;
}

// Where it comes back. Called by the shared respawn once it has put him at
// safePos, exactly where the old inline calls were and in the same order.
function vehReassemble() {
  const fn = vehSlot("reassemble");
  if (fn) fn();
}

// Is he solid against walls right now? A surface vehicle always is -- it has no
// airborne phase to gate on, and gating on one is exactly how the car ended up
// with a solid test that never ran. Everything that flies is solid once it has
// left the ground, and not while it is taxiing through its own airport.
function vehSolid() {
  if (state.exploding) return false;
  const fn = vehSlot("solid");
  if (fn) return !!fn();
  return state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY";
}

// How this vehicle hits a wall. True means it handled it and the shared
// explode-to-safePos (or, at a crawl, the shared shove) must not run.
function vehWallHit(push, hit) {
  const fn = vehSlot("wallHit");
  return fn ? !!fn(push, hit) : false;
}

// The three numbers the one wall law reads (solids.js, collision.js).
function vehSolidClass() { return vehSlot("solidClass") || SOLID.AIR; }
function vehSolidR() { const k = vehKind(); return TUNE.solid.r[k] !== undefined ? TUNE.solid.r[k] : 3; }
function vehCrawl() { const k = vehKind(); return TUNE.solid.crawl[k] !== undefined ? TUNE.solid.crawl[k] : -1; }
