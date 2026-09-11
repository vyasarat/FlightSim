"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- the speed steps, and the one place they live.
//
// The plane has had a slow/fast pair since the beginning. This file makes that
// pair mean the same thing on EVERY vehicle that is not a rocket, because the
// point is that he learns one control once: same two buttons, same place, same
// icons, same direction (up is faster). Nothing here is a new gesture.
//
// THE POSITION IS TOP-RIGHT, UNDER THE VIEW BUTTON, AND IT HAD TO MOVE THERE.
// The pair used to sit in the bottom-right ladder. That ladder is already
// spoken for on two vehicles -- the helicopter parks its up/down buttons in
// both slots, and the rover inherits the rocket's throttle in the lower one --
// and per CLAUDE.md two buttons in one slot means the later one in the DOM
// silently eats the tap. Leaving the pair where it was would have given it a
// different position on three vehicles, which is exactly the thing the brief
// forbids. Top-right below the view button is empty on every vehicle in every
// state, so that is where it went, plane included.
//
// EXCEPT ON THE HELICOPTER, WHICH HAS ONE SLOT AND NOT TWO. A side of the
// screen holds four button slots at iPad size -- the band between the brow and
// the dash is 511 px and a slot is 127 -- and the helicopter already spends
// three of its four on view, up and down. Its altitude buttons are the biggest
// controls in the game deliberately, so they do not shrink to make room. There,
// and only there, the control is ONE button that steps up and wraps round to
// the slowest, with the chevrons saying which step he is on. It is the same
// icon, in the same slot, doing the same job; it just cycles instead of
// pairing, because the alternative was making every right-hand button on the
// helicopter a third smaller.
//
// EACH VEHICLE GETS ITS OWN RANGE. `TUNE.<vehicle>.speedSteps` is a list of
// multipliers on that vehicle's own cruise, so a step means "a bit slower than
// usual" or "much faster than usual" rather than a number of metres per second
// he cannot read. The plane keeps TUNE.speedSteps, which is tuned with him and
// is not to be touched; the vehicles that are new to the control get a top step
// around 1.85x, because at their default they plod.
//
// THE DEFAULT IS CRUISE. Index of the 1.0 multiplier, so a fresh spawn feels
// exactly like it did before he ever found the buttons.
//
// IT REMEMBERS, FOR THE SESSION ONLY. `spdMemory` is a plain object: pick the
// boat up again ten minutes later and it is still on the step he left it on;
// reload and everything is back to cruise. Deliberately not localStorage --
// nothing in this game is allowed to accumulate across days.
//
// IT SCALES THE TARGET, NEVER THE NORMALISERS. Each vehicle multiplies the
// speed it is aiming for and the clamp that caps it, and leaves every
// `speed / cruise` ratio alone. Those ratios drive the engine note, the wake
// rate, the bow rise and the field of view -- so at the top step the boat
// sounds pegged and throws its biggest wake, which is what "fast" should look
// like. Scaling them too would have made the top step look identical to cruise.
//
// POINT-TO-GO VEHICLES KEEP THEIR EASING. The helicopter and the Mars drone
// aim at `Math.min(cruise, distance * approach)`. Only the cruise half is
// scaled, so the arrival taper is bit-for-bit what it was: he still slows into
// the spot he touched, he just gets there faster.
// ---------------------------------------------------------------------------

// Which vehicle the steps are being asked about. The rover and the Mars drone
// are modes of the rocket rather than cards in the picker, so they name
// themselves -- otherwise all three would share the rocket's (absent) steps.
function spdKey() {
  if (typeof marsDroneActive === "function" && marsDroneActive()) return "drone";
  if (typeof roverActive === "function" && roverActive()) return "rover";
  return state.vehicleKey;
}

// The step list for a vehicle key, or null if it has none. Rockets have none
// and never will: a rocket's throttle is the hold, and the whole flight is a
// climb through an envelope that these multipliers would tear open.
function spdStepsFor(key) {
  if (key === "rover") return TUNE.rover && TUNE.rover.speedSteps;
  if (key === "drone") return TUNE.marsBase && TUNE.marsBase.drone && TUNE.marsBase.drone.speedSteps;
  const vp = TUNE.vehicles[key];
  if (!vp || vp.rocket) return null;
  if (vp.car) return TUNE.car.speedSteps;
  if (vp.bigBoat) return TUNE.yacht.speedSteps;
  if (vp.boat) return TUNE.boat.speedSteps;
  if (vp.heli) return TUNE.heli.speedSteps;
  return TUNE.speedSteps;          // every fixed-wing: prop, fighter, the airliners
}

// The rest position: the step whose multiplier is exactly cruise. Worked out
// rather than written down, so re-tuning a list can never leave the default
// pointing at "slow" and make a fresh spawn feel broken.
function spdDefaultIndex(steps) {
  if (!steps) return 0;
  const i = steps.indexOf(1);
  return i >= 0 ? i : Math.floor(steps.length / 2);
}

const spdMemory = {};              // vehicle key -> step index, for this session only

function spdIndex() {
  const key = spdKey(), steps = spdStepsFor(key);
  if (!steps) return 0;
  const i = spdMemory[key];
  return i === undefined ? spdDefaultIndex(steps) : clamp(i, 0, steps.length - 1);
}

// The number every vehicle's speed model multiplies by. Always finite, always
// positive: a vehicle with no steps simply gets 1 and behaves as it always did.
function spdMul() {
  const steps = spdStepsFor(spdKey());
  return steps ? steps[spdIndex()] : 1;
}

// The helicopter is the one vehicle with no room for a pair.
function spdUsesCycle() { return !!(state.vp && state.vp.heli); }

// One step up, wrapping back to the slowest at the top. Wrapping is safe here
// in a way it would not be for, say, altitude: the step is his own tap, it is
// visible on the button before and after, and one more tap walks it back round.
function spdCycle() {
  const key = spdKey(), steps = spdStepsFor(key);
  if (!steps) return;
  spdMemory[key] = (spdIndex() + 1) % steps.length;
}

// `state.speedStep` stays the one name the whole game (and the harness) uses to
// read or set the current step -- it is just no longer a number sitting in the
// state object. Reading it asks the memory for THIS vehicle; writing it files
// the answer under this vehicle. That is the entire per-vehicle persistence
// mechanism, and it means no caller has to know the memory exists.
delete state.speedStep;
Object.defineProperty(state, "speedStep", {
  get() { return spdIndex(); },
  set(v) {
    const key = spdKey(), steps = spdStepsFor(key);
    if (!steps) return;                       // a rocket has no steps to set
    const n = Math.round(v);
    spdMemory[key] = clamp(Number.isFinite(n) ? n : spdDefaultIndex(steps), 0, steps.length - 1);
  },
  enumerable: true, configurable: true,
});

function spdNudge(dir) {
  const key = spdKey(), steps = spdStepsFor(key);
  if (!steps) return;
  spdMemory[key] = clamp(spdIndex() + dir, 0, steps.length - 1);
}

// One step below cruise, for an approach. The skip button already overrides his
// speed outright (it puts him on the glide slope at approachSpeed), and arriving
// at the top step turns "coast in and it works" into a fast, flat arrival -- so
// the approach setup sets the step too. This is not the game taking something
// away: it is the landing assist doing the job the button exists for, and one
// tap of fast has it straight back.
function spdSetApproach() {
  const key = spdKey(), steps = spdStepsFor(key);
  if (!steps) return;
  spdMemory[key] = Math.max(0, spdDefaultIndex(steps) - 1);
}

// Forget a vehicle's step, so the next look at it answers "cruise". Nothing in
// the game calls this -- picking a card he has already driven is meant to give
// him back the step he left it on, which is what "persists for the session"
// means. It exists so the harness can measure a default against a top step
// without reloading the page.
function spdReset(key) { delete spdMemory[key === undefined ? spdKey() : key]; }

// ---- the buttons.
//
// Called once a frame from the tail of update(), AFTER every vehicle has had
// its go at the DOM. That is deliberate: half the vehicles hide this pair on
// their own early-return paths, and deciding it here means no stale hide from
// a previous mode can survive into the next one. It is also the only decision
// point, so there is exactly one answer to "is the pair up right now".
function spdUpdateButtons() {
  const steps = spdStepsFor(spdKey());
  let show = !!steps && !state.exploding && !menuOpen();
  if (show) {
    // On a fixed-wing the control still belongs to flight: on the ground he has
    // a throttle to hold and the steps would do nothing he could see.
    const vp = state.vp;
    const plain = vp && !vp.car && !vp.boat && !vp.heli && !vp.rocket;
    if (plain) {
      const onDeck = typeof carrierOnDeck === "function" && carrierOnDeck();
      show = (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !onDeck;
    }
  }
  // WHETHER these three are up is the button table's (js/buttons.js), which asks
  // spdShows() and spdUsesCycle(). What is left here is the dimming: which END of
  // the range he is already sitting on, and which step the stepper shows.
  const cycle = show && spdUsesCycle();
  if (!show) return;
  const i = spdIndex(), n = steps.length;
  if (cycle) {
    // The chevrons ARE the readout: one lit for the slowest step, all of them
    // for the fastest. Icons only -- numerals belong to the wind-up counter.
    const st = String(i + 1);
    if (el.speedBtn.dataset.step !== st) el.speedBtn.dataset.step = st;
    return;
  }
  // Dim the end of the range he is already sitting on, the same way the gear
  // button dims: he can still press it, it just has nothing left to give.
  el.slowBtn.classList.toggle("off", i <= 0);
  el.fastBtn.classList.toggle("off", i >= n - 1);
}
