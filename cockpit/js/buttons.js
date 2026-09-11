"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE CONTEXTUAL BUTTON SYSTEM.
//
// Every button says, in one place, WHICH SLOT it lives in and WHEN it exists.
// One pass a frame answers both, for all of them, from scratch.
//
// WHY IT HAD TO BECOME ONE PLACE. Visibility was decided at forty-six sites in
// twelve files, and sixteen of those were pure suppression -- `add("hidden")`
// calls in the boat, the car, the yacht, the helicopter and the Mars drone
// whose only job was to put away a button that some OTHER vehicle had left up.
// That is not a rule, it is a chase, and the misses are the game's bug history:
// the rover's throttle that only worked because the capsule happened to leave
// one up, and the car wash offering itself to a boat in the harbour lock.
//
// Computing every button from scratch each frame makes suppression meaningless.
// A button is up if and only if its own `when()` says so, so nothing can be
// left behind by anything else, and no new vehicle has to remember to put away
// buttons it has never heard of.
//
// THE SLOT CHECK IS PART OF THE SYSTEM, NOT BOLTED ON. Buttons share a few
// fixed slots, and two visible in one slot means the later one in the DOM
// silently eats the tap. `btnSlotClashes()` answers that question directly from
// this table and the live DOM; the harness calls it at three viewports across
// every vehicle, and it is the same function the game could assert on itself.
//
// WHAT STAYS WHERE IT IS: the `data-mode` and decorative classes (gear-up,
// cooldown, lowSlot, pressed). Those are the button's APPEARANCE, which its
// owner is the right thing to drive. This file owns existence only.
// ---------------------------------------------------------------------------

// The slots, by where they actually sit. Anything sharing a name here must
// never be visible at the same time as its neighbours.
const BTN_SLOT = {
  topLeft1: "top-left, first",     topLeft2: "top-left, second",
  topRight1: "top-right, first",   topRight2: "top-right, second",  topRight3: "top-right, third",
  lowLeft: "bottom-left, low",     highLeft: "bottom-left, high",
  lowRight: "bottom-right, low",   highRight: "bottom-right, high",
  dashLeft: "dash corner, left",   dashRight: "dash corner, right",  dashRight2: "dash corner, inboard",
  free: "not in a shared slot",
};

// `menuOpen()` covers the picker screens; the ejection canopy hides every
// button in CSS, so it is only named where a button must also stop responding.
const btnWash = () => typeof toyWorld !== "undefined" && !!toyWorld.wash;

const BUTTONS = {
  // ---- the two corners that are always there
  viewBtn:   { slot: "topRight1", when: () => true },
  menuBtn:   { slot: "dashLeft",  when: () => !menuOpen() && !eject.active },
  ejectBtn:  { slot: "dashRight", when: null },          // eject.js owns its own, and its modes
  hornBtn:   { slot: "dashRight2", when: () => carHornCan() },

  // ---- the speed control: js/speed.js decides WHICH of the three, this says when
  fastBtn:   { slot: "topRight2", when: () => spdShows() && !spdUsesCycle() },
  slowBtn:   { slot: "topRight3", when: () => spdShows() && !spdUsesCycle() },
  speedBtn:  { slot: "topRight2", when: () => spdShows() && spdUsesCycle() },

  // ---- the picker, and the go button, which share the top-left corner
  vehBtn:    { slot: "topLeft1", when: () => pickerCanOpen() && !btnWash() },
  skipBtn:   { slot: "topLeft1", when: () => btnSkipShows() },
  camBtn:    { slot: "topLeft2", when: () => true },

  // ---- the bottom ladders
  throttleBtn: { slot: "lowRight",  when: () => btnThrottleShows() },
  gearBtn:     { slot: "lowLeft",   when: () => !!state.vp.hasGear && !btnWash() },
  heliDownBtn: { slot: "lowRight",  when: () => btnHeliShows() },
  heliUpBtn:   { slot: "highRight", when: () => btnHeliShows() },

  missileBtn: { slot: "highLeft", when: () => btnMissileShows() },
  catBtn:     { slot: "highLeft", when: () => typeof carrierCanLaunch === "function" && carrierCanLaunch() },
  washBtn:    { slot: "highLeft", when: () => twWashCan() && twWashNear() && !btnWash() },

  stageBtn:   { slot: "highLeft", when: () => btnRocket() && rocketCanDrop() },
  satBtn:     { slot: "highLeft", when: () => btnRocket() && rocketCanDeploySat() },
  chuteBtn:   { slot: "highLeft", when: () => btnRocket() && rocketCanChute() },
  roverBtn:   { slot: "highLeft", when: () => btnRocket() && (roverCan() || roverActive()) && !marsDroneActive() },
  hatchBtn:   { slot: "highLeft", when: () => btnRocket() && (stationCanEnter() || astroActive()) },

  droneBtn:   { slot: "lowLeft",  when: () => btnRocket() && typeof marsDroneCan === "function" && (marsDroneCan() || marsDroneActive()) },
  magnetBtn:  { slot: "lowLeft",  when: null },          // toyworld.js owns it
  bucketBtn:  { slot: "lowLeft",  when: () => btnBucketShows() },
  cannonBtn:  { slot: "lowLeft",  when: () => boatCannonCan() },
  garageBtn:  { slot: "lowLeft",  when: () => !!state.vp.boat && yachtGarageCan() },
  lockBtn:    { slot: "lowLeft",  when: () => lockCanCycle() },
};

// ---- the predicates that were inline, kept verbatim ------------------------

function btnRocket() { return !!(state.vp && state.vp.rocket) && !state.exploding; }

// The speed pair's own test, lifted out of spdUpdateButtons so the table can
// ask it without that function having to touch the DOM.
function spdShows() {
  const steps = spdStepsFor(spdKey());
  if (!steps || state.exploding || menuOpen()) return false;
  const vp = state.vp;
  const plain = vp && !vp.car && !vp.boat && !vp.heli && !vp.rocket;
  if (!plain) return true;
  const onDeck = typeof carrierOnDeck === "function" && carrierOnDeck();
  return (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !onDeck;
}

// The go button. On a rocket it is updateRocket's (destination icons, the
// capsule); on everything else it is the "take me home" arrow, and it stays
// away until he is properly en route.
function btnSkipShows() {
  if (state.exploding) return false;
  // `out`: floating about the station, where the go button means "back to the
  // capsule seat" rather than a destination. updateGoButton still owns the icon.
  if (state.vp.rocket) {
    const out = astroActive() && astro.mode !== "leaving";
    return (typeof rocketCanSkip === "function" && rocketCanSkip()) || out;
  }
  if (state.vp.bigBoat || state.vp.boat) return false;
  const thOff = Math.round(Math.cos(state.dirIdx === 0 ? 0 : Math.PI)) * (TUNE.runwayLength / 2);
  const dz = state.z - (AIRPORTS[state.destIdx].cz + thOff);
  return state.phase === "AIRBORNE" && !state.engaged &&
         (dz * dz) >= TUNE.approachEngageDist * TUNE.approachEngageDist;
}

// Hold to burn, hold to roll, hold to drive. Three of the rocket's four modes
// use it and the Mars drone does not; a fixed-wing has it only on the ground.
function btnThrottleShows() {
  if (btnWash()) return false;
  const k = vehKind();
  if (k === "plane") return state.phase === "TAXI" || state.phase === "ROLL";
  return k === "rocket" || k === "rover" || k === "astro";
}

function btnMissileShows() {
  if (btnWash()) return false;
  if (state.vp.rocket) return btnRocket() && typeof eventsWantMissile === "function" && eventsWantMissile();
  if (state.vp.bigBoat || state.vp.boat) return false;
  const onDeck = typeof carrierOnDeck === "function" && carrierOnDeck();
  return (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !onDeck;
}

function btnHeliShows() {
  if (btnWash()) return false;
  return typeof heliActive === "function" && heliActive() && !state.exploding && !menuOpen();
}

function btnBucketShows() {
  if (typeof isHeli !== "function" || !isHeli()) return false;
  // The magnet owns this slot in the toy yards, and the two are the same
  // helicopter: whichever tool is on the hook is the one with a button.
  if (typeof twMagnetOn === "function" && twMagnetOn()) return false;
  return (typeof bucketCanScoop === "function" && bucketCanScoop()) ||
         (typeof bucketCanDrop === "function" && bucketCanDrop());
}

// ---------------------------------------------------------------------------
// The one pass. Called from the tail of update(), after every vehicle has run,
// so nothing any of them did can survive it.
// ---------------------------------------------------------------------------
function btnUpdateAll() {
  for (const id in BUTTONS) {
    const b = BUTTONS[id], e = el[id];
    if (!e || !b.when) continue;                  // null `when`: its own module owns it
    let show = false;
    try { show = !!b.when(); } catch (err) { show = false; }
    e.classList.toggle("hidden", !show);
  }
}

// ---------------------------------------------------------------------------
// The slot check, from the same table. Two buttons visible in one slot means
// the later one in the DOM eats the tap, and that has cost this game real bugs.
// Returns a list of clashes, empty when all is well.
// ---------------------------------------------------------------------------
// The HUD indicators that are DRAWN OVER the controls rather than beside them.
// They are not buttons and have no slot, so the slot table cannot see them --
// and a "pull up" arrow or a home arrow sitting on top of the throttle is every
// bit as bad as two buttons in one slot, because he still cannot press what he
// is looking at. `btnObstructions` is the geometric half that the declared half
// cannot do.
const BTN_HUD_OVERLAY = ["homeArrow", "rotateArrow", "glideGuide", "aimMarker",
                         "heliTarget", "alarm", "wingman", "bigNum"];

function btnVisibleRect(e) {
  if (!e) return null;
  const cs = getComputedStyle(e);
  if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return null;
  let r = e.getBoundingClientRect();
  if (r.width < 2) {
    // several of these are zero-size anchors with a drawn child
    for (const child of e.children) {
      const cr = child.getBoundingClientRect();
      if (cr.width > 2 && cr.height > 2) { r = cr; break; }
    }
  }
  return (r.width > 2 && r.height > 2) ? r : null;
}

// Would something drawn at this rectangle sit on a control? Used by the aim
// marker to take itself away rather than lie on top of a button.
function btnRectBlocked(left, top, right, bottom) {
  for (const id in BUTTONS) {
    const r = btnVisibleRect(el[id]);
    if (!r) continue;
    if (left < r.right - 3 && r.left < right - 3 && top < r.bottom - 3 && r.top < bottom - 3) return true;
  }
  return false;
}

// Anything drawn on top of a control he has to be able to press.
function btnObstructions() {
  const bad = [];
  const controls = [];
  for (const id in BUTTONS) {
    const r = btnVisibleRect(el[id]);
    if (r) controls.push({ id, r });
  }
  for (const id of BTN_HUD_OVERLAY) {
    const r = btnVisibleRect(document.getElementById(id));
    if (!r) continue;
    for (const c of controls) {
      if (r.left < c.r.right - 3 && c.r.left < r.right - 3 &&
          r.top < c.r.bottom - 3 && c.r.top < r.bottom - 3) bad.push(id + " over " + c.id);
    }
  }
  return bad;
}

function btnSlotClashes() {
  const bySlot = {};
  for (const id in BUTTONS) {
    const e = el[id];
    if (!e || BUTTONS[id].slot === "free") continue;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    (bySlot[BUTTONS[id].slot] = bySlot[BUTTONS[id].slot] || []).push(id);
  }
  const bad = [];
  for (const slot in bySlot) if (bySlot[slot].length > 1) bad.push(slot + ": " + bySlot[slot].join(" + "));
  return bad;
}
