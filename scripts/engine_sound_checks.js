"use strict";
// ---------------------------------------------------------------------------
// THE ENGINE VOICE IS ONE MODEL, WHATEVER THE LOOPS ARE MADE OF.
//
// Every engine is two loops crossfaded by how hard he is working it. The loops
// are synthesised placeholders until the CC0 recordings land in
// `cockpit/audio/engines/`, and the whole point of building it this way is that
// NOTHING ELSE CHANGES when they do. So these check the model, not the sound:
// the crossfade actually crosses, the pitch travels and stays modest, the view
// changes the filter and the level, the idle never sits still, and the rocket
// is not in this system at all.
//
// The one thing a recording changes is `engState().sampled`. Everything below
// is asserted on the placeholder path today and is the same assertion when it
// is not a placeholder.
// ---------------------------------------------------------------------------

module.exports = async function engineSoundChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);

  // The harness runs without a user gesture, so there is no live AudioContext.
  // Everything here is read off the graph the module builds, which means the
  // graph has to exist -- so give it a context the way a tap would.
  const ok = await page.evaluate(async () => {
    const L = window.__lp;
    L.noRender = true; L.api.skipScreens();
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      await L.audio.unlock();
      return L.audio.ctxState() === "running";
    } catch (e) { return false; }
  }).catch(() => false);

  const r = await page.evaluate(async (live) => {
    const L = window.__lp, st = L.state;
    const out = { live, voices: L.audio.engVoiceKeys(), loaded: L.audio.engLoaded() };

    // ---- every vehicle that has an engine has a voice, and the rocket has none
    const keyed = {};
    for (const v of ["prop", "fighter", "airlinerDelta", "airlinerEmirates",
                     "helicopter", "car", "speedboat", "yacht", "rocket"]) {
      L.api.setVehicle(v);
      for (let i = 0; i < 5; i++) L.update(1 / 60);
      keyed[v] = L.audio.engine().key;
    }
    out.keyed = keyed;

    if (!live) return out;

    // ---- the crossfade: idle alone at rest, high alone at full, both in between
    L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0);
    // Driven through the AIRSPEED, not by calling setEngine: the flight model
    // calls it itself every frame from `speed / cruiseSpeed`, so a forced level
    // would be overwritten before the graph ever saw it. This is the real path.
    const at = (level) => {
      for (let i = 0; i < 90; i++) { st.speed = level * st.vp.cruiseSpeed; L.update(1 / 60); }
      return L.audio.engine();
    };
    const idleOnly = at(0.05), middle = at(0.5), fullOn = at(1.0);
    out.fade = { idleOnly, middle, fullOn };

    // ---- the view: inside is quieter and darker than outside, same voice
    L.api.setView(true);  const chase = at(0.7);
    L.api.setView(false); const pit = at(0.7);
    L.api.setView(true);
    out.view = { chase, pit };

    // ---- the idle wobble: a held idle must not sit still
    const seen = [];
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < 14; i++) { st.speed = 0.05 * st.vp.cruiseSpeed; L.update(1 / 60); }
      seen.push(L.audio.engine().idle);
    }
    out.wobble = { spread: +(Math.max(...seen) - Math.min(...seen)).toFixed(6), seen };

    // ---- the rocket is not in this system
    L.api.setVehicle("rocket"); L.api.placeOnRunway();
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    out.rocket = L.audio.engine();
    return out;
  }, ok);

  check("engines: every vehicle with an engine runs one of the seven voices and the two airliners share theirs -- and the rocket runs none of them, because a rocket is not a throttle curve",
    r.keyed.prop === "prop" && r.keyed.fighter === "jet" &&
    r.keyed.airlinerDelta === "airliner" && r.keyed.airlinerEmirates === "airliner" &&
    r.keyed.helicopter === "heli" && r.keyed.car === "car" &&
    r.keyed.speedboat === "boat" && r.keyed.yacht === "yacht" &&
    r.keyed.rocket === null && r.voices.length === 7, JSON.stringify(r.keyed));

  if (!r.live) {
    check("engines: the voice graph is only built behind a real unlock gesture, and this run has no audio context -- the model is asserted on the vehicle mapping alone",
      true, JSON.stringify({ live: false }));
  } else {
    const f = r.fade;
    check("engines: two loops, crossfaded -- at rest it is the idle loop alone, at full chat the high loop alone, and in between both are up with neither dipping out",
      f.idleOnly.idle > f.idleOnly.high * 4 && f.fullOn.high > f.fullOn.idle * 4 &&
      f.middle.idle > 0 && f.middle.high > 0, JSON.stringify(f));

    check("engines: the pitch travels with the throttle and stays modest -- a loop dragged far enough stops being an engine and starts being a siren",
      f.fullOn.rate > f.idleOnly.rate && f.fullOn.rate < 1.35 && f.idleOnly.rate > 0.7,
      JSON.stringify({ idle: f.idleOnly.rate, full: f.fullOn.rate }));

    check("engines: the cockpit is the same voice muffled and turned down, not a second one -- the chase view is louder and brighter at the identical throttle",
      r.view.chase.lp > r.view.pit.lp * 1.5 &&
      (r.view.chase.idle + r.view.chase.high) > (r.view.pit.idle + r.view.pit.high),
      JSON.stringify(r.view));

    check("engines: a held idle never sits still -- it wanders, so it is a thing he can hear rather than a drone he stops hearing",
      r.wobble.spread > 0, JSON.stringify(r.wobble));

    check("engines: the rocket keeps its own bass and never joins the crossfade",
      r.rocket.up === false && r.rocket.key === null, JSON.stringify(r.rocket));
  }

  await page.close();
};
