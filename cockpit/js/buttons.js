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
  const rs = btnDrawnRects(e);
  return rs.length ? rs[0] : null;
}

// What a thing actually PAINTS, as a list of rectangles.
//
// An overlay is not always the element you name. `#alarm` is `inset: 0` -- a
// full-screen transparent container holding an edge vignette and a triangle --
// so measuring its own box says "the alarm covers every button on the screen",
// which is both true and useless. The same goes for `#homeArrow`, a zero-size
// anchor with a drawn <svg> inside it. Descend until what is measured is the
// thing that draws, and never count a full-bleed transparent box as coverage.
function btnDrawnRects(e, out) {
  out = out || [];
  if (!e) return out;
  const cs = getComputedStyle(e);
  if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return out;
  const r = e.getBoundingClientRect();
  const fullBleed = r.width >= innerWidth - 2 && r.height >= innerHeight - 2;
  const paints = cs.backgroundImage !== "none" ||
                 (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") ||
                 parseFloat(cs.borderTopWidth) > 0 ||
                 e.tagName === "svg" || e.tagName === "IMG" || e.tagName === "CANVAS";
  if (r.width > 2 && r.height > 2 && !fullBleed && paints) { out.push(r); return out; }
  const before = out.length;
  for (const child of e.children) btnDrawnRects(child, out);
  if (out.length === before && r.width > 2 && r.height > 2 && !fullBleed) out.push(r);
  return out;
}

// How far past its own box an element PAINTS -- the glow, the drop shadow, the
// halo a held control grows. Offsets plus blur plus spread, on the element and
// on anything inside it.
const BTN_SHADOW_RE = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/g;
function btnPaintReach(e) {
  let m = 0;
  const scan = (s) => {
    BTN_SHADOW_RE.lastIndex = 0;
    let x;
    while ((x = BTN_SHADOW_RE.exec(s))) {
      m = Math.max(m, Math.max(Math.abs(+x[1]), Math.abs(+x[2])) + +x[3] + +(x[4] || 0));
    }
  };
  const one = (n) => {
    const cs = getComputedStyle(n);
    if (cs.boxShadow && cs.boxShadow !== "none") scan(cs.boxShadow);
    if (cs.filter && cs.filter !== "none") scan(cs.filter);
  };
  one(e);
  for (const n of e.querySelectorAll("*")) one(n);
  return m;
}

// Every `.roundBtn` carries a resting drop shadow with more reach than the gap
// between slots, so absolute paint reach says every stacked pair overlaps and
// always has. The question that matters is what a PRESSED or EXPANDED state
// ADDS over its own resting state -- `#heliUpBtn.pressed`'s cyan halo, the
// horn's yellow glow -- so that is what is measured, against a rest value
// learned the first time the control is seen unpressed.
const btnRestReach = {};
function btnHeldBleed(e) {
  if (!e || !e.id) return 0;
  const reach = btnPaintReach(e);
  if (!e.classList.contains("pressed")) { btnRestReach[e.id] = reach; return 0; }
  const rest = btnRestReach[e.id];
  return rest === undefined ? 0 : Math.max(0, reach - rest);
}

function btnControlRects() {
  const out = [];
  for (const id in BUTTONS) {
    const e = el[id];
    const r = btnVisibleRect(e);
    if (!r) continue;
    const g = btnHeldBleed(e);
    out.push({ id, left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g, bleed: g });
  }
  return out;
}

const btnHits = (a, b) => a.left < b.right - 3 && b.left < a.right - 3 &&
                          a.top < b.bottom - 3 && b.top < a.bottom - 3;

// Would something drawn at this rectangle sit on a control? Used by the aim
// marker to take itself away rather than lie on top of a button.
function btnRectBlocked(left, top, right, bottom) {
  const box = { left, top, right, bottom };
  for (const c of btnControlRects()) if (btnHits(box, c)) return true;
  return false;
}

// A ring indicator -- the home arrow -- cares about its ANGLE, not its radius.
// So when the ring would put it on a control, walk it inwards along its own ray
// until it is clear rather than hiding the one thing telling him which way home
// is. Returns the original radius when nothing is in the way.
function btnRingRadius(cx, cy, theta, radius, half) {
  const sin = Math.sin(theta), cos = Math.cos(theta);
  for (let r = radius; r > radius * 0.5; r -= 8) {
    const x = cx + sin * r, y = cy - cos * r;
    if (!btnRectBlocked(x - half, y - half, x + half, y + half)) return r;
  }
  return radius * 0.5;
}

// Anything drawn on top of a control he has to be able to press -- a HUD
// indicator over a button, or a held control's own glow spilling onto its
// neighbour.
function btnObstructions() {
  const bad = [];
  const controls = btnControlRects();
  for (const id of BTN_HUD_OVERLAY) {
    for (const r of btnDrawnRects(document.getElementById(id))) {
      for (const c of controls) if (btnHits(r, c)) bad.push(id + " over " + c.id);
    }
  }
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if ((a.bleed || b.bleed) && btnHits(a, b)) bad.push("held " + a.id + " over " + b.id);
    }
  }
  return [...new Set(bad)];
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
