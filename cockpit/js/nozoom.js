"use strict";
// ---------------------------------------------------------------------------
// iOS Safari zoom, stopped at the source.
//
// `user-scalable=no` has been ignored by iOS since iOS 10, so the viewport meta
// is not a defence. `touch-action: none` covers the ordinary cases, but three
// things still get through on iOS:
//
//   1. Safari's own pinch, which arrives as gesturestart/gesturechange/gestureend
//      and is not a touch-action concern at all.
//   2. A second finger landing on a surface whose touch-action has not applied
//      (or on Safari's own chrome-adjacent areas).
//   3. Double-tap zoom, which fires on the SECOND tap's touchend -- and a
//      four-year-old hammering a button double-taps constantly.
//
// Everything here is `passive: false` (a passive listener cannot preventDefault)
// and `capture: true`, so it still runs if something downstream stops
// propagation. Nothing here calls stopPropagation itself.
//
// WHY THIS CANNOT EAT HIS OWN TOUCHES. The game reads *pointer* events and
// nothing else -- there is not one touchstart/touchmove/touchend listener in
// input.js. Pointer events are dispatched BEFORE the corresponding touch
// events, and preventDefault on a touch event does not cancel a pointer
// sequence; it only suppresses the browser's default action (scroll, zoom, and
// the legacy compatibility mouse events, which this game never uses). The stick,
// point-to-go, every button and the picker are all untouched. There is a harness
// check that a ONE-finger touchstart is left alone, and the whole one-finger
// suite runs after this.
// ---------------------------------------------------------------------------

const NOZOOM = {
  doubleTapMs: 300,      // a second tap sooner than this is a zoom gesture, not a press
  scaleSlack: 1.01,      // visualViewport.scale noise floor
  nudgeMs: 60,           // how long the viewport meta is held at its clamped value
};

const nozoom = { gestures: 0, multiTouch: 0, doubleTaps: 0, resets: 0, lastEnd: 0 };

(function installNoZoom() {
  const opts = { passive: false, capture: true };

  // ---- 1. Safari's pinch. touch-action never sees these.
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, (e) => {
      if (e.cancelable) e.preventDefault();
      nozoom.gestures++;
    }, opts);
  }

  // ---- 2. More than one finger. This game is one-finger everywhere by design,
  // so a second finger is never anything but a pinch.
  const multi = (e) => {
    if (e.touches && e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
      nozoom.multiTouch++;
    }
  };
  document.addEventListener("touchstart", multi, opts);
  document.addEventListener("touchmove", multi, opts);

  // ---- 3. Double-tap zoom, which is the second tap's touchend.
  // pointerup has already fired by the time we get here, so both of his taps
  // still register as two real presses.
  document.addEventListener("touchend", (e) => {
    const now = e.timeStamp || performance.now();
    if (now - nozoom.lastEnd < NOZOOM.doubleTapMs) {
      if (e.cancelable) e.preventDefault();
      nozoom.doubleTaps++;
    }
    nozoom.lastEnd = now;
  }, opts);

  // ---- 4. Belt and braces, for a page zoom that got through anyway: a pinch on
  // some surface this misses, a scale carried in from a previous session, or one
  // left behind by a rotation. Clamping the viewport meta and releasing it makes
  // Safari re-lay-out at 1. No text, no dialog, nothing he can see: the picture
  // just settles.
  //
  // To be accurate about what this does NOT do: iOS's *accessibility* magnifier
  // (Settings > Accessibility > Zoom, the three-finger triple tap) is a system
  // layer above the browser. It does not move visualViewport.scale and no web
  // page can see it or undo it. If he ever ends up magnified that way it has to
  // be turned off in Settings.
  const meta = document.querySelector('meta[name="viewport"]');
  const BASE = meta ? meta.getAttribute("content") : null;
  let nudging = false;
  function resetScale() {
    if (!meta || !BASE || nudging) return false;
    nudging = true;
    nozoom.resets++;
    meta.setAttribute("content", BASE + ", minimum-scale=1, maximum-scale=1");
    setTimeout(() => { meta.setAttribute("content", BASE); nudging = false; }, NOZOOM.nudgeMs);
    return true;
  }
  const vv = window.visualViewport;
  if (vv) {
    const check = () => { if (vv.scale > NOZOOM.scaleSlack) resetScale(); };
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
  }
  nozoom.resetScale = resetScale;
  nozoom.scale = () => (window.visualViewport ? window.visualViewport.scale : 1);
})();
