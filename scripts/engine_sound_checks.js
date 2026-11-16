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

  // ---- (v217, Q-3) BEHIND THE PICKER THE MOTION VOICES GO QUIET, AND COME BACK WHEN IT CLOSES.
  // The picker's hold (flight.js, v212: menuOpen() && !vehParked()) does not run his vehicle's update, which is
  // the only writer of its motion voices -- so the dive whistle, the tyres, the hull, the booster's roar, the
  // track's rattle, the crane's rumble and the rocket's roar held their last gain under the cards. Read as the
  // TARGET each writer last set (the gain ramps to it on the audio clock, which the harness does not keep), in
  // the states he is really in, portrait and landscape:
  //   1. every voice of his that is up before the cards is ~0 behind them, the ambient bed still there;
  //   2. every one of them is back within 10 frames of the cards closing -- including a voice its owner does
  //      NOT rewrite each frame (round 2: the crane's rumble is written in its count and wind-up only, and
  //      held on purpose through the swing and the fall until the towers are down): back at its pre-card
  //      level, and held there until its owner says otherwise;
  //   3. nothing is put back that is no longer his: a vehicle picked (or the same one started afresh) behind
  //      the cards, or a voice its owner has since moved (the dive levelled out while the cards were up).
  // The game's list of what the hold quiets (audio.js HELD_STILL) must hold every tone applyVehicle silences.
  const holdRes = [];
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const { page: hp } = await newPage(w, h);
    const res = await hp.evaluate(async () => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      try { await L.audio.unlock(); } catch (e) {}
      const live = L.audio.ctxState() === "running";
      const step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
      const finger = (n, x, y) => step(n, () => L.api.setStick(x || 0, y || 0));
      const SCREENS = ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"];
      const closeScreens = () => { for (const id of SCREENS) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); } };
      const numUp = () => el.bigNum.classList.contains("on");
      const until = (n, pred, fn) => { for (let i = 0; i < n && !pred(); i++) { if (fn) fn(i); L.update(1 / 60); } return pred(); };
      // what is read: every motion voice of every vehicle (the check's own list, not the game's)
      const MOTION = ["stall", "dive", "carTyre", "cvRoar", "boatHull", "boatCannon", "yachtHull", "rover", "srBurst", "trkRattle", "trkWhir", "crRumble", "crHum", "fans"];
      const voices = () => {
        const o = {};
        for (const n of MOTION) if (tones[n] && tones[n].last > 0.001) o["tone:" + n] = +tones[n].last.toFixed(4);
        if (rollNodes && rollNodes.last > 0.004) o.roll = +rollNodes.last.toFixed(4);
        if (rocketNodes && rocketNodes.last > 0.004) o.rocket = +rocketNodes.last.toFixed(4);
        if (reentryNodes && reentryNodes.last > 0.004) o.reentry = +reentryNodes.last.toFixed(4);
        if (hornNodes && hornNodes.on) o.horn = 1;
        return o;
      };
      const cruise = () => st.vp.cruiseSpeed;
      const crane = (phase) => () => {
        L.api.setVehicle("crane"); L.api.spawnAt(0, 0); closeScreens(); step(90);
        L.api.setThrottle(true); step(2); L.api.setThrottle(false);
        until(60 * 3, numUp);
        if (phase === "count") step(40); else until(60 * 30, () => cr.phase === phase);
        if (phase === "fall") step(10);
      };
      const trackOn = () => {
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
        const p = L.tkLiftPad(); st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0;
        L.api.clearStick(); step(1);
        until(60 * 25, () => !L.trk.lift && L.trk.on, () => L.api.setStick(0, 0.9));
      };
      // [setup, what keeps it going once the cards close, the voice it must have up (its proof), latched: held
      // at its pre-card level after the cards close for as long as this says]
      const ROWS = {
        plane: [() => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(20); finger(40, 0, -1); st.pitch = -30; step(4, () => L.api.setStick(0, -1)); }, () => L.api.setStick(0, -1), "tone:dive"],
        stall: [() => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(20); step(40, () => { L.api.setStick(0, 1); st.speed = cruise() * 0.4; }); }, () => { L.api.setStick(0, 1); st.speed = cruise() * 0.4; }, "tone:stall"],
        car: [() => { L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); finger(60 * 6); }, () => L.api.setStick(0, 0), "tone:carTyre"],
        horn: [() => { L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); finger(60 * 3); carHornPress(); finger(5); }, () => L.api.setStick(0, 0), "horn"],
        corvette: [() => { L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); step(10); finger(60 * 4); finger(40, 0, 0.95); }, () => L.api.setStick(0, 0.95), "tone:cvRoar"],
        track: [() => { trackOn(); finger(60 * 2, 0, 0.9); }, () => L.api.setStick(0, 0.9), "tone:trkRattle"],
        trackBoost: [() => { trackOn(); until(60 * 60, () => tones.trkWhir && tones.trkWhir.last > 0.001, () => L.api.setStick(0, 0.9)); }, () => L.api.setStick(0, 0.9), "tone:trkWhir"],
        craneCount: [crane("count"), null, "tone:crRumble"],
        craneSwing: [crane("swing"), null, "tone:crRumble", () => cr.phase === "swing" || cr.phase === "fall"],
        craneFall: [crane("fall"), null, "tone:crRumble", () => cr.phase === "fall"],
        boat: [() => { L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); step(10); finger(60 * 4); }, () => L.api.setStick(0, 0), "tone:boatHull"],
        yacht: [() => { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); step(10); finger(60 * 4); }, () => L.api.setStick(0, 0), "tone:yachtHull"],
        rocket: [() => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); step(10); L.api.setThrottle(true); step(60 * 5); }, null, "rocket"],
        // last: applyVehicle does not silence the roll (it is no VEHICLE_TONES entry), so a row after this one would
        // start with the runway's rumble under it
        roll: [() => { L.api.setVehicle("prop"); L.api.spawnAt(0, 0); step(20); L.api.setThrottle(true); step(60); }, () => L.api.setThrottle(true), "roll"],
      };
      const out = { live, rows: {}, gone: {} };
      for (const id in ROWS) {
        const [setup, keep, proof, latched] = ROWS[id];
        setup();
        const before = voices();
        const r = out.rows[id] = { before, proof: before[proof] || 0 };
        el.screenVehicle.classList.remove("hiddenS");
        r.held = menuOpen() && !vehParked();
        step(30);
        r.behind = voices();
        r.bed = bedNodes ? +bedNodes.level.toFixed(4) : 0;
        closeScreens();
        r.back = {};
        for (let i = 0; i < 10; i++) {
          if (keep) keep(); L.update(1 / 60);
          const v = voices();
          for (const k in before) if (r.back[k] === undefined && v[k] > 0) r.back[k] = i + 1;
        }
        if (latched) {   // held at the pre-card level while its owner holds it (every frame of it, up to 10 s)
          r.drift = 0; r.span = 0;
          for (let i = 0; i < 600 && latched(); i++) {
            const v = voices()[proof] || 0;
            r.drift = Math.max(r.drift, Math.abs(v - before[proof])); r.span++;
            L.update(1 / 60);
          }
        }
        L.api.clearStick(); L.api.setThrottle(false); if (typeof carHornRelease === "function") carHornRelease();
      }
      // 3. what is put back must still be his
      const GONE = {
        // the crane mid-fall, its rumble held: behind the cards he picks the prop (the card's own applyVehicle and spawn)
        craneThenProp: [crane("fall"), () => { L.api.setVehicle("prop"); L.api.spawnAt(0, 0); }, ["tone:crRumble", "tone:crHum"]],
        // ... or the crane again, afresh
        craneAfresh: [crane("fall"), () => { L.api.setVehicle("crane"); L.api.spawnAt(0, 0); }, ["tone:crRumble"]],
        // the plane rolling down the runway: behind the cards he picks the car
        rollThenCar: [ROWS.roll[0], () => { L.api.setThrottle(false); L.api.setVehicle("car"); L.api.spawnAt(0, 0); }, ["roll"]],
        // the dive levelled out while the cards were up: its owner writes it off, and it stays off
        diveLevelled: [ROWS.plane[0], () => { L.api.clearStick(); st.pitch = 0; }, ["tone:dive"]],
      };
      for (const id in GONE) {
        const [setup, behind, names] = GONE[id];
        setup();
        const g = out.gone[id] = { up: names.filter(n => voices()[n] > 0) };
        el.screenVehicle.classList.remove("hiddenS");
        step(10); behind(); step(10);
        closeScreens();
        g.after = {};
        for (let i = 0; i < 30; i++) { L.update(1 / 60); const v = voices(); for (const n of names) if (v[n] > 0) g.after[n] = v[n]; }
        L.api.clearStick(); L.api.setThrottle(false);
      }
      out.listed = typeof HELD_STILL === "undefined" ? null : VEHICLE_TONES.filter(([n]) => !HELD_STILL.includes(n)).map(([n]) => n);
      return out;
    });
    holdRes.push({ vp: `${w}x${h}`, ...res });
    await hp.close();
  }
  const holdBad = [], backBad = [], goneBad = [];
  for (const R of holdRes) {
    if (!R.live) { holdBad.push(R.vp + ": no running audio context"); continue; }
    for (const [id, r] of Object.entries(R.rows)) {
      if (!(r.proof > 0)) holdBad.push(`${R.vp} ${id}: its voice was not up before (${JSON.stringify(r.before)})`);
      if (!r.held) holdBad.push(`${R.vp} ${id}: the picker did not hold the world`);
      if (Object.keys(r.behind).length) holdBad.push(`${R.vp} ${id}: behind the cards ${JSON.stringify(r.behind)}`);
      if (!(r.bed > 0.001)) holdBad.push(`${R.vp} ${id}: the bed went (${r.bed})`);
      const missing = Object.keys(r.before).filter(k => !(r.back[k] > 0));
      if (missing.length) backBad.push(`${R.vp} ${id}: not back within 10 frames of the cards closing: ${missing.join(", ")} (before ${JSON.stringify(r.before)})`);
      if (r.span !== undefined && (!(r.span > 0) || r.drift > 0.002)) backBad.push(`${R.vp} ${id}: not held at its pre-card level until its owner moved it (drift ${r.drift}, ${r.span} frames)`);
    }
    for (const [id, g] of Object.entries(R.gone)) {
      if (!g.up.length) goneBad.push(`${R.vp} ${id}: nothing was up to begin with`);
      if (Object.keys(g.after).length) goneBad.push(`${R.vp} ${id}: put back after the cards closed: ${JSON.stringify(g.after)}`);
    }
    if (R.listed === null) holdBad.push(R.vp + ": no HELD_STILL in audio.js");
    else if (R.listed.length) holdBad.push(`${R.vp}: VEHICLE_TONES not in HELD_STILL: ${R.listed.join(", ")}`);
  }
  const rowSay = (R) => R.vp + " " + Object.entries(R.rows || {}).map(([id, r]) => `${id} ${JSON.stringify(r.before)} back@${JSON.stringify(r.back)}${r.span !== undefined ? ` held ${r.span}f drift ${r.drift}` : ""}`).join(", ");
  check("engines: behind the picker (the world held, v212) every motion voice of his vehicle goes to 0 -- the dive whistle, the stall warble, the ground roll, the tyres, the horn, the booster's roar, the track's rattle and whir, the crane's rumble and hum, the hull, the rocket's roar -- while the ambient bed stays; portrait and landscape (Q-3)",
    holdBad.length === 0, holdBad.length ? holdBad.join("; ") : holdRes.map(R => R.vp + " " + Object.entries(R.rows).map(([id, r]) => `${id} ${r.proof}->0 bed ${r.bed}`).join(", ")).join(" | "));
  check("engines: when the cards close every voice that was up comes back within 10 frames -- a voice its owner holds rather than rewrites (the crane's rumble through the swing and the fall) at its pre-card level, until its owner moves it; portrait and landscape (Q-3, round 2)",
    holdBad.length === 0 && backBad.length === 0, backBad.length ? backBad.join("; ") : holdRes.map(rowSay).join(" | "));
  check("engines: nothing is put back that is no longer his -- a vehicle picked behind the cards, the same one started afresh, or a voice its owner moved while they were up (the dive levelled out) stays silent after they close; portrait and landscape (Q-3, round 2)",
    holdBad.length === 0 && goneBad.length === 0, goneBad.length ? goneBad.join("; ") : holdRes.map(R => R.vp + " " + JSON.stringify(R.gone)).join(" | "));

  // ---- (v224, B5) TONE OWNERSHIP: the tyres (carTyre, the first tone owned per frame, audio.js TONES_OWNED).
  // Its one writer is updateCar, and a race never runs it (vehicles.js `race`): started from a car at speed, the
  // tyres held their last gain for the whole race (Q-16). Now a tone owned per frame that nobody wrote this frame is
  // swept to zero at the end of it (AUDIO_TAILS.sweep). Portrait, in the SUV, the Cybertruck and the Corvette:
  //   the race, by touch: the race button, the track picker up half a second (his own pace), a track card -- and
  //     the race button and a card on ONE frame, as the leaving matrix starts it (the picker's hold never runs: no
  //     frame passes behind the cards). The tyres' gain is 0 within 0.1 s of the race starting and stays 0 through
  //     the grid and 20 s of racing (unless the race writes them: it does not, so any write is red too); off the
  //     race by its exit button and driving again, they are back within 3 s.
  //   the stay: a minute of ordinary driving -- the motorway with a wobbling finger and short lifts, a stop with the
  //     finger off, a city street with full turns held at its junctions, and a bang -- the sweep never fires, and
  //     every frame the tyres are heard they were written that frame, but the car's one frame in pieces (the bang's
  //     way through update(), which never sweeps): the gain trace is the writer's alone (its hash in the detail is
  //     the base tree's, the same stream).
  //   Measured on the v223 tree (v224's survey): at his pace the picker's hold already quiets the tyres before the
  //     card (v217), so the half-second race was clean there; only the one-frame start held them (Q-16 as found).
  {
    const { page: tp } = await newPage(820, 1180);
    const res = await tp.evaluate(async () => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      try { await L.audio.unlock(); } catch (e) {}
      const live = L.audio.ctxState() === "running";
      const press = (e) => e && e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
      const SCREENS = ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"];
      const closeScreens = () => { for (const id of SCREENS) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); } };
      const setToneReal = window.setTone; let stamp = -1, hotWrites = 0;
      window.setTone = function (n, t, f, g) { if (n === "carTyre") { stamp = frameCount; if (g > 0) hotWrites++; } return setToneReal.apply(this, arguments); };
      const tyre = () => tones.carTyre ? Math.max(0, tones.carTyre.last) : 0;
      const swept = () => L.flags.tonesSwept || 0;
      const step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
      const finger = (n) => step(n, () => L.api.setStick(0, 0));
      const card = () => [...document.querySelectorAll(".trackCard")].find(c => c.dataset.track !== "back");
      const out = { live, race: {}, stay: {} };
      try {
        for (const v of ["car", "cybertruck", "corvette"]) {
          for (const how of ["picker", "oneFrame"]) {
            L.api.clearStick(); closeScreens(); if (L.raceOn()) L.raceReset();
            L.api.setVehicle(v); L.api.spawnAt(0, 0); closeScreens(); step(10); finger(60 * 6);
            const r = out.race[v + " " + how] = { before: +tyre().toFixed(4), shows: L.raceBtnShows() };
            L.api.clearStick(); press(el.raceBtn);
            r.picker = !el.screenRace.classList.contains("hiddenS");
            if (how === "picker") step(30);
            press(card());
            r.on = L.raceOn();
            const h0 = hotWrites;
            let f = 0, zeroAt = -1, maxAfter = 0, raceF = 0;
            for (; f < 60 * 40 && raceF < 60 * 20; f++) {
              L.api.setStick(0, 0); L.update(1 / 60);
              const g = tyre();
              if (zeroAt < 0 && g === 0) zeroAt = f + 1;
              if (zeroAt >= 0) maxAfter = Math.max(maxAfter, g);
              if (L.race.phase === "race") raceF++;
            }
            Object.assign(r, { zeroAt, maxAfter: +maxAfter.toFixed(4), raceF, raceWrites: hotWrites - h0, still: L.raceOn() });
            L.api.clearStick(); press(el.raceExitBtn); r.off = !L.raceOn();
            closeScreens();
            let back = -1;
            for (let i = 0; i < 60 * 3 && back < 0; i++) { L.api.setStick(0, 0); L.update(1 / 60); if (tyre() > 0) back = i + 1; }
            r.back = back; r.kind = vehKind();
          }
          // the stay: a minute of ordinary driving
          {
            L.api.clearStick(); closeScreens(); if (L.raceOn()) L.raceReset();
            L.api.setVehicle(v); L.api.spawnAt(0, 0); closeScreens(); step(10);
            const s = out.stay[v] = { frames: 0, heard: 0, gaps: 0, firstGap: null, bangGaps: 0, stopF: 0, turned: 0, banged: false, back: false };
            const s0 = swept(); let hash = 0;
            const one = (stick) => {
              if (stick) L.api.setStick(stick[0], stick[1]); else L.api.clearStick();
              // a frame that starts in pieces runs the bang's way through update(), which has no audio tail and so no
              // sweep (AUDIO_TAILS): the car's one frame in pieces, on which nothing writes the tyres, is counted apart
              const inPieces = st.exploding;
              L.update(1 / 60); s.frames++;
              const g = tyre();
              hash = (hash * 31 + Math.round(g * 1e5)) >>> 0;
              if (g > 0) { s.heard++; if (stamp !== frameCount) { if (inPieces) s.bangGaps++; else if (s.gaps++ === 0) s.firstGap = { f: s.frames, g, k: vehKind(), ex: st.exploding, menu: menuOpen() }; } }
              if (st.speed === 0) s.stopF++;
            };
            // 25 s on the motorway: a wobbling finger, a lift of a fifth of a second every seven, and at 15 s a stop
            for (let i = 0; i < 60 * 25; i++) {
              const lift = i % 420 > 408 || (i >= 60 * 15 && i < 60 * 20);
              one(lift ? null : [Math.sin(i / 37) * 0.25, 0]);
            }
            // 25 s on a New York street: full right held through four junctions' approaches, straight on between
            {
              const C = L.streets.cities.ny, road = C.roads.filter(q => q.kind === "grid" && q.len > 90).sort((a, b) => b.len - a.len)[2], q = {};
              L.stPointAt(road, 10, 1, road.lo, q);
              st.x = q.x; st.z = q.z; st.heading = Math.atan2(-q.fx, -q.fz); st.y = L.stSurfaceAt(q.x, q.z) ?? L.terrainEff(q.x, q.z); st.speed = 10;
              L.car.yield = 1; L.car.steer = 0; L.car.crashCool = 0; L.stPlan.road = road; L.stPlan.dir = 1; L.stPlan.turn = null; L.stTrail.pts.length = 0; L.stTrail.lastX = null;
              const full = 0.9 * L.CAR.dragRangeX * innerWidth / (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight));
              for (let k = 0; k < 4; k++) {
                const h0 = st.heading;
                for (let i = 0; i < 60 * 4; i++) one([full, 0]);
                if (Math.abs(Math.atan2(Math.sin(st.heading - h0), Math.cos(st.heading - h0))) > 1.0) s.turned++;
                for (let i = 0; i < 60 * 2.25; i++) one([0, 0]);
              }
            }
            // and a bang: at speed into the nearest solid that blocks a car, then 10 s more driving
            {
              let best = null, bd = Infinity; const cls = vehSolidClass();
              L.forEachSolid(b => {
                if (b.o3 || b.cap || b.ramp || b.toy || b.moving || b.car !== undefined || b.park) return;
                if (!L.solidBlocks(b, cls) || (b.mesh && b.mesh.visible === false) || L.isSolidHidden(b)) return;
                if (!(b.hw > 3 && b.hd > 3 && b.y1 - b.y0 > 6)) return;
                const d = Math.hypot(b.x - st.x, b.z - st.z); if (d < bd) { bd = d; best = b; }
              }, st.x, st.z, 2000);
              if (best) { st.x = best.x; st.z = best.z + best.hd - 1; st.y = Math.max(best.y0, L.terrainEff(st.x, st.z)); st.heading = 0; st.speed = 30; }
              for (let i = 0; i < 60 * 10; i++) { one([0, 0]); if (st.exploding) s.banged = true; else if (s.banged) s.back = true; }
            }
            s.swept = swept() - s0; s.hash = hash;
          }
        }
      } finally {
        window.setTone = setToneReal;
        L.api.clearStick(); closeScreens(); if (L.raceOn()) L.raceReset();
        L.api.setVehicle("prop"); L.api.spawnAt(0, 0); closeScreens(); step(10);
      }
      return out;
    });
    const rb = [], sb = [];
    if (!res.live) rb.push("no running audio context");
    for (const [id, r] of Object.entries(res.race)) {
      if (!(r.before > 0) || !r.shows || !r.picker || !r.on) rb.push(`${id}: not at speed with the tyres up and a race started by its button (${JSON.stringify({ before: r.before, shows: r.shows, picker: r.picker, on: r.on })})`);
      if (!(r.zeroAt >= 1 && r.zeroAt <= 6)) rb.push(`${id}: the tyres not at 0 within 0.1 s of the race (first 0 at frame ${r.zeroAt})`);
      if (r.maxAfter > 0) rb.push(`${id}: the tyres back up in the race (${r.maxAfter})`);
      if (r.raceWrites) rb.push(`${id}: the race wrote the tyres ${r.raceWrites} times`);
      if (!(r.raceF >= 60 * 20) || !r.still) rb.push(`${id}: not 20 s of racing (${r.raceF} frames, still on ${r.still})`);
      if (!r.off || !(r.back > 0)) rb.push(`${id}: off the race (${r.off}) the tyres not back within 3 s of driving (${r.back}, in ${r.kind})`);
    }
    for (const [v, s] of Object.entries(res.stay)) {
      if (s.swept !== 0) sb.push(`${v}: swept ${s.swept} times in ordinary driving`);
      if (s.gaps) sb.push(`${v}: heard but not written on ${s.gaps} frames (first ${JSON.stringify(s.firstGap)})`);
      if (!(s.heard > s.frames * 0.5) || !(s.stopF > 60) || s.turned < 2 || !s.banged || !s.back) sb.push(`${v}: not the drive it says (${JSON.stringify({ frames: s.frames, heard: s.heard, stopF: s.stopF, turned: s.turned, banged: s.banged, back: s.back })})`);
    }
    check("engines: tone ownership (B5, Q-16) -- in the SUV, the Cybertruck and the Corvette at speed, portrait, a race started by its button (the track picker up half a second, or a card on the button's own frame) takes the tyres to 0 within 0.1 s and they stay 0 through the grid and 20 s of racing (the race never writes them); off it by its exit, driving again, they are back within 3 s",
      rb.length === 0, { bad: rb, race: Object.fromEntries(Object.entries(res.race).map(([k, r]) => [k, `${r.before} -> 0 @${r.zeroAt}f, max after ${r.maxAfter}, back @${r.back}f`])) });
    check("engines: tone ownership (B5), where it STAYS -- a minute of ordinary driving in each car (a wobbling finger with short lifts, a stop, full turns held in a city, a bang) never sweeps the tyres, and every frame they are heard they were written that frame, but the bang's own frame in pieces, where nothing sweeps (portrait)",
      sb.length === 0, { bad: sb, stay: Object.fromEntries(Object.entries(res.stay).map(([k, s]) => [k, `${s.heard}/${s.frames} heard, ${s.bangGaps} in pieces unwritten (no sweep there), stopped ${s.stopF}f, ${s.turned} turns, bang ${s.banged}/${s.back}, swept ${s.swept}, trace ${s.hash}`])) });
    await tp.close();
  }
};
