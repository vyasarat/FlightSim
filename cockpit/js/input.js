"use strict";
// The stick belongs to exactly one pointer. A second finger or a resting palm
// is ignored entirely -- it must neither move the stick nor release it.
let stickPointerId = null;
const stickPointers = new Map();   // every finger on the canvas, oldest first: the next one takes over when the owner lifts
function takeStick(id, x, y) {
  keyStickActive = false;
  state.touching = true;
  stickPointerId = id;
  state.startX = x;
  state.startY = y;
  state.ctrlBank = 0;
  state.ctrlPitch = 0;
  try { glEl.setPointerCapture(id); } catch (err) {}
}
glEl.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockAudio();
  stickPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  // A finger always wins: it takes the stick even if an arrow key is held.
  if (stickPointerId === null) takeStick(e.pointerId, e.clientX, e.clientY);
});
glEl.addEventListener("pointermove", (e) => {
  const p = stickPointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (!state.touching || e.pointerId !== stickPointerId) return;
  const span = Math.min(window.innerWidth, window.innerHeight);
  state.ctrlBank = clamp((e.clientX - state.startX) / (span * TUNE.dragRangeX), -1, 1);
  state.ctrlPitch = clamp(-(e.clientY - state.startY) / (span * TUNE.dragRangeY), -1, 1);
});
const releaseDrag = (e) => {
  if (e && e.pointerId !== undefined) stickPointers.delete(e.pointerId);
  if (e && e.pointerId !== undefined && stickPointerId !== null && e.pointerId !== stickPointerId) return;
  state.touching = false;
  stickPointerId = null;
  if (e && e.pointerId !== undefined && stickPointers.size) {   // a resting second finger becomes the stick, from where it is
    const [id, p] = stickPointers.entries().next().value;
    takeStick(id, p.x, p.y);
  }
  if (!e || e.pointerId === undefined) stickPointers.clear();
};
glEl.addEventListener("pointerup", releaseDrag);
glEl.addEventListener("pointercancel", releaseDrag);
// Anything that can end a touch without telling us (Guided Access overlay,
// notification banner, app switch) releases every held control.
const releaseAllInputs = () => {
  releaseDrag();
  releaseThrottle();
  // A keyup can be lost to another window (Cmd-Tab, Guided Access overlay):
  // forget every held key so nothing stays "pressed" forever.
  keys.clear();
  keyStickActive = false;
  state.ctrlBank = 0;
  state.ctrlPitch = 0;
  state.touching = false;
  stickPointerId = null;
};
window.addEventListener("blur", releaseAllInputs);
window.addEventListener("pagehide", releaseAllInputs);

// The throttle belongs to one pointer too: a palm tapping the same button
// while the thumb holds it must not release it.
let throttlePointerId = null;
function menuOpen() {
  return !el.screenVehicle.classList.contains("hiddenS") || !el.screenDir.classList.contains("hiddenS") || !el.screenDest.classList.contains("hiddenS");
}
el.throttleBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();   // every tap on the throttle is a chance to (re)start the audio, menu or not
  if (menuOpen() || throttlePointerId !== null) return;
  throttlePointerId = e.pointerId;
  try { el.throttleBtn.setPointerCapture(e.pointerId); } catch (err) {}
  el.throttleBtn.classList.add("pressed");
  state.throttleHeld = true;
});
const releaseThrottle = (e) => {
  if (e && e.pointerId !== undefined && throttlePointerId !== null && e.pointerId !== throttlePointerId) return;
  throttlePointerId = null;
  el.throttleBtn.classList.remove("pressed");
  state.throttleHeld = false;
};
el.throttleBtn.addEventListener("pointerup", releaseThrottle);
el.throttleBtn.addEventListener("pointercancel", releaseThrottle);

function skipToLanding() {
  const ap = AIRPORTS[state.destIdx];
  const sgn = state.dirIdx === 0 ? 1 : -1;
  const thOff = sgn * (TUNE.runwayLength / 2);
  state.heading = state.dirIdx === 0 ? 0 : Math.PI;
  state.x = 0;
  state.z = ap.cz + thOff + sgn * TUNE.skipOutDistance;
  state.y = ap.elev + 3 + TUNE.skipOutDistance * TUNE.glideSlope + TUNE.glideBand;
  state.pitch = -2.5;
  state.bank = 0;
  state.assistBias = 0;
  state.speed = TUNE.approachSpeed + 10;
  state.airVy = null;
  state.exploding = false;
  state.explodeTimer = 0;
  state.canRotate = false;
  state.climbAwayTimer = 0;
  state.celebrated = false;
  state.celebrateTimer = 0;
  state.approachLatch = false;
  state.throttleHeld = false;
  state.touching = false;
  stickPointerId = null;
  state.ctrlBank = 0;
  state.ctrlPitch = 0;
  state.liftoffTimer = 0;
  if (state.vp.hasGear && !state.gearDown) {
    state.gearDown = true;
    gearSound(true);
    flags.gear++;
  }
  state.speedStep = 1;
  state.phase = "AIRBORNE";
  state.maxAglSinceLiftoff = 1e9;
  placeRings();
  unlockAudio();
}

el.skipBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  if (state.exploding) return;
  if (state.vp.rocket) { if (astroActive()) leaveStationAll(); else rocketSkipToLanding(); return; }
  restoreShattered();
  skipToLanding();
});

// Toggle buttons ignore a toddler double-tap (two taps within 300 ms would
// otherwise toggle twice and look like nothing happened).
let frameCount = 0;
function debounced(fn, frames) {
  let lastF = -Infinity;
  return () => {
    if (frameCount - lastF < frames) return;
    lastF = frameCount;
    fn();
  };
}

function toggleGear() {
  // Wheels stay down while they're carrying the plane: no retracting on the
  // ground (TAXI / ROLL / LANDED). Extending is always allowed.
  const onGround = state.phase === "TAXI" || state.phase === "ROLL" || state.phase === "LANDED";
  if (onGround && state.gearDown) return;
  state.gearDown = !state.gearDown;
  gearSound(state.gearDown);
  flags.gear++;
}
const toggleGearDebounced = debounced(toggleGear, 18);

const toggleView = debounced(() => {
  state.viewChase = !state.viewChase;
  el.hud.classList.toggle("chase", state.viewChase);
}, 18);

// iOS drops :active after preventDefault, so tap feedback is explicit.
function pressFlash(btn) {
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 140);
}

el.viewBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  pressFlash(el.viewBtn);
  toggleView();
});

el.fastBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  pressFlash(el.fastBtn);
  state.speedStep = Math.min(state.speedStep + 1, TUNE.speedSteps.length - 1);
});

el.slowBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  pressFlash(el.slowBtn);
  state.speedStep = Math.max(state.speedStep - 1, 0);
});

el.missileBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  try { el.missileBtn.setPointerCapture(e.pointerId); } catch (err) {}
  el.missileBtn.classList.add("pressed");
  unlockAudio();
  fireMissile();
  setTimeout(() => el.missileBtn.classList.remove("pressed"), 120);
});

el.gearBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  try { el.gearBtn.setPointerCapture(e.pointerId); } catch (err) {}
  unlockAudio();
  pressFlash(el.gearBtn);
  toggleGearDebounced();
});

document.querySelectorAll(".vehCard").forEach(card => {
  // Shelved vehicles are hidden from TUNE alone (`hidden: true`), not from markup.
  const def = TUNE.vehicles[card.dataset.v];
  card.classList.toggle("hiddenS", !!(def && def.hidden));
  let downAt = null;
  card.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); downAt = { x: e.clientX, y: e.clientY }; });
  card.addEventListener("pointercancel", () => { downAt = null; });
  card.addEventListener("pointerup", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) { downAt = null; return; }   // that was a scroll
    downAt = null;
    applyVehicle(card.dataset.v);
    try { localStorage.setItem("lp.vehicle", card.dataset.v); } catch (err) {}
    document.querySelectorAll(".vehCard").forEach(c2 => c2.classList.toggle("sel", c2 === card));
    el.screenVehicle.classList.add("hiddenS");
    el.screenDir.classList.remove("hiddenS");
  });
});
document.querySelectorAll(".dirCard").forEach(card => {
  card.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const d = parseInt(card.dataset.d, 10) === 1 ? 1 : 0;
    try { localStorage.setItem("lp.dir", String(d)); } catch (err) {}
    spawnForTakeoff(d === 1 ? 1 : 0, d);
    el.screenDir.classList.add("hiddenS");
    if (state.vp.rocket) el.screenDest.classList.remove("hiddenS");   // the rocket picks where it is going
    unlockAudio();
  });
});
document.querySelectorAll(".destCard").forEach(card => {
  card.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.dest = card.dataset.dest;
    try { localStorage.setItem("lp.dest", state.dest); } catch (err) {}
    document.querySelectorAll(".destCard").forEach(c2 => c2.classList.toggle("sel", c2 === card));
    eventsOnDest();   // the draw was made before he chose: redraw against where he is going
    el.screenDest.classList.add("hiddenS");
    unlockAudio();
  });
});

// Stage button (rocket only): drops the next stage when high enough. The same
// slot holds the satellite button (capsule, in space) and the parachute button
// (capsule, low in the air) -- never two at once.
el.stageBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.stageBtn);
  dropStage();
});
el.satBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.satBtn);
  deploySatellite();
});
el.chuteBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.chuteBtn);
  deployChute();
});
el.roverBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.roverBtn);
  toggleRover();
});
el.catBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.catBtn);
  carrierLaunchPress();
});
el.bucketBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.bucketBtn);
  bucketPress();
});
el.hatchBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.hatchBtn);
  toggleHatch();
});

// Camera: the next rendered frame is grabbed (before the buffer clears), shown
// in a polaroid frame for a few seconds with a flash and a shutter click.
let photoTimer = null;
function takePhoto() {
  if (state.photoPending) return;
  state.photoPending = true;
  el.photo.classList.toggle("patch", !!state.vp.rocket);   // rocket shots get the mission-patch frame
  unlockAudio();
  shutter();
  el.flash.classList.add("on");
  setTimeout(() => el.flash.classList.remove("on"), 90);
  flags.photos = (flags.photos || 0) + 1;
}
function showPhoto(dataUrl) {
  el.photoImg.src = dataUrl;
  el.photo.classList.add("on");
  clearTimeout(photoTimer);
  photoTimer = setTimeout(() => { el.photo.classList.remove("on"); el.photoImg.removeAttribute("src"); }, 3200);
}
el.camBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.camBtn);
  if (typeof roverHorn === "function") roverHorn();   // driving: the camera button honks too
  takePhoto();
});

function openPicker() {
  if (state.phase !== "TAXI" || state.speed !== 0) return;
  releaseThrottle();
  keys.clear();
  el.screenDir.classList.add("hiddenS");
  el.screenDest.classList.add("hiddenS");
  el.screenVehicle.classList.remove("hiddenS");
}
el.vehBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  openPicker();
});

window.addEventListener("gesturestart", (e) => e.preventDefault());

// ---- keyboard (desktop): arrows = stick (up = nose up, same as drag-up),
// Space = throttle, G gear, V view, F/Enter missile, +/- speed step, L skip.
const keys = new Set();
const KEY_STICK = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1, KeyW: 1, KeyS: 1 };
let keyStickActive = false;
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const c = e.code;
  const handled = KEY_STICK[c] || c === "Space" || c === "ShiftLeft" || c === "ShiftRight" ||
    c === "KeyG" || c === "KeyV" || c === "KeyF" || c === "Enter" || c === "Equal" || c === "NumpadAdd" ||
    c === "Minus" || c === "NumpadSubtract" || c === "KeyL" || c === "BracketRight" || c === "BracketLeft" || c === "KeyP" || c === "KeyB" || c === "Escape";
  if (!handled) return;
  e.preventDefault();
  if (e.repeat || menuOpen()) return;
  keys.add(c);
  unlockAudio();
  if (c === "Space" || c === "ShiftLeft" || c === "ShiftRight") { el.throttleBtn.classList.add("pressed"); state.throttleHeld = true; }
  else if (c === "KeyG") { if (state.vp.hasGear) toggleGearDebounced(); }
  else if (c === "KeyV") toggleView();
  else if (c === "KeyB" || c === "Escape") openPicker();
  else if (c === "KeyF" || c === "Enter") {
    if (state.vp.rocket) {
      // ... and during a meteor shower, with nothing else in the slot, F shoots
      if (!dropStage() && !deploySatellite() && !deployChute() && !toggleRover() && !toggleHatch() &&
          !el.missileBtn.classList.contains("hidden")) fireMissile();
    }
    else if (!el.catBtn.classList.contains("hidden")) carrierLaunchPress();   // parked on the deck: the catapult
    else if (!el.bucketBtn.classList.contains("hidden")) bucketPress();   // the helicopter's bucket comes first
    else if (!el.missileBtn.classList.contains("hidden")) fireMissile();
  }
  else if (c === "Equal" || c === "NumpadAdd" || c === "BracketRight") state.speedStep = Math.min(state.speedStep + 1, TUNE.speedSteps.length - 1);
  else if (c === "Minus" || c === "NumpadSubtract" || c === "BracketLeft") state.speedStep = Math.max(state.speedStep - 1, 0);
  else if (c === "KeyP") takePhoto();
  else if (c === "KeyL") { if (!el.skipBtn.classList.contains("hidden") && !state.exploding) { if (state.vp.rocket) { if (astroActive()) leaveStationAll(); else rocketSkipToLanding(); } else { restoreShattered(); skipToLanding(); } } }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (!keys.has("Space") && !keys.has("ShiftLeft") && !keys.has("ShiftRight")) { if (throttlePointerId === null) releaseThrottle(); }
  }
});
function applyKeyboard(dt) {
  if (stickPointerId !== null) { keyStickActive = false; return; } // a finger owns the stick
  const bank = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  const pitch = (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0) - (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0);
  if (bank || pitch) {
    keyStickActive = true;
    state.touching = true;
    const k = Math.min(1, TUNE.keyStickRamp * dt);
    state.ctrlBank += (bank - state.ctrlBank) * k;
    state.ctrlPitch += (pitch - state.ctrlPitch) * k;
  } else if (keyStickActive) {
    keyStickActive = false;
    state.touching = false;
    state.ctrlBank = 0;
    state.ctrlPitch = 0;
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TUNE.maxPixelRatio));
  resizeFx();
}

window.addEventListener("resize", resize);
resize();

let wakeLock = null;
async function grabWakeLock() {
  try { wakeLock = await navigator.wakeLock.request("screen"); } catch (err) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    grabWakeLock();
    if (audioCtx && audioCtx.state !== "running") audioCtx.resume().then(startEngine).catch(() => {});
  } else {
    releaseAllInputs();
  }
});

// iOS Safari drops WebGL contexts under memory pressure and rarely restores
// them. If no restore arrives, reload -- a blank frozen canvas is the one
// state a child under Guided Access cannot escape.
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  const t = setTimeout(() => location.reload(), 3000);
  renderer.domElement.addEventListener("webglcontextrestored", () => clearTimeout(t), { once: true });
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
  // A freshly-activated worker means new code is cached; pick it up on this
  // launch instead of the next one. Only reload while sitting on the menu so a
  // flight is never interrupted.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && state.phase === "TAXI" && state.speed === 0 && !state.celebrated && !(rk && rk.onBody) && !(typeof recoveryActive === "function" && recoveryActive()) && !(rk && rk.refitT > 0) && !menuOpen()) location.reload();
    hadController = true;
  });
}
