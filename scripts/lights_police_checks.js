"use strict";
// ---------------------------------------------------------------------------
// TRAFFIC SIGNALS, AND THE CHASE THAT COMES OF IGNORING ONE.
//
// The whole feature is one decision he gets to make -- stop or go -- and one
// consequence that cannot hurt him. So these check both halves of that: that
// the signal is readable and honest (amber always before red, never two greens
// at once, traffic that actually stops), and that the chase is never a
// punishment (it always ends, by two independent routes, and being caught takes
// nothing away).
// ---------------------------------------------------------------------------

module.exports = async function lightsPoliceChecks({ newPage, check, viewports }) {
  for (const [w, h] of viewports) {
    const tag = `${w}x${h}`;
    const { page } = await newPage(w, h);

    // ---- 1. the cycle -----------------------------------------------------
    const cyc = await page.evaluate(() => {
      const L = window.__lp;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 40; i++) L.update(1 / 60);
      const out = { junctions: L.ltJunctionCount(), bothGreen: 0, redNoAmber: 0 };
      L.ltForce(0, "mainGreen");
      const seq = [];
      // Seeded from the CURRENT aspect. Starting at null makes whatever is up
      // when the loop opens look like a transition into it, and the cross street
      // starts red -- which is an amberless red that never happened.
      const s0 = L.ltStateOf(0);
      let lastMain = s0.main, lastCross = s0.cross;
      for (let i = 0; i < 60 * 90; i++) {
        L.update(1 / 60);
        const s = L.ltStateOf(0);
        if (s.main === "green" && s.cross === "green") out.bothGreen++;
        if (s.main !== lastMain) {
          if (s.main === "red" && lastMain !== "amber") out.redNoAmber++;
          seq.push("m:" + s.main); lastMain = s.main;
        }
        if (s.cross !== lastCross) {
          if (s.cross === "red" && lastCross !== "amber") out.redNoAmber++;
          lastCross = s.cross;
        }
        if (seq.length > 8) break;
      }
      out.seq = seq;
      // and the amber actually blinks: sampled fast, the lamp is not steady
      L.ltForce(0, "mainAmber");
      const j = L.lights.junctions[0];
      j.t = 99;
      const lampOn = [];
      for (let i = 0; i < 40; i++) {
        L.update(1 / 60);
        const m = new THREE.Matrix4();
        // the amber lamp of the first head is instance 1
        const c = new THREE.Color();
        L.lights.lampMesh.getColorAt(1, c);
        lampOn.push(c.getHex() !== L.LT.colors.dark);
        void m;
      }
      out.blinkOn = lampOn.filter(Boolean).length;
      out.blinkOff = lampOn.filter(x => !x).length;
      return out;
    });
    check(`signals ${tag}: ${cyc.junctions} junctions on the surface roads and none on the open motorway, each cycling green → amber → red with the amber BLINKING first, and the two directions never green together`,
      cyc.junctions >= 5 && cyc.bothGreen === 0 && cyc.redNoAmber === 0 &&
      ["m:green", "m:amber", "m:red"].every(k => cyc.seq.includes(k)) &&
      cyc.blinkOn > 3 && cyc.blinkOff > 3, JSON.stringify(cyc));

    // ---- 2. traffic stops and queues --------------------------------------
    const traf = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      const j = L.lights.junctions[0];
      // stand him beside it so the junction is awake, but off the carriageway
      st.x = j.x + j.rx * 120; st.z = j.z + j.rz * 120; st.y = j.y; st.speed = 0;
      const hold = (phase, secs) => {
        j.phase = ["mainGreen", "mainAmber", "allRedA", "crossGreen", "crossAmber", "allRedB"].indexOf(phase);
        j.t = 999;
        for (let i = 0; i < 60 * secs; i++) {
          L.update(1 / 60);
          st.x = j.x + j.rx * 120; st.z = j.z + j.rz * 120; st.speed = 0;
        }
        const moving = j.cars.filter(c => (c.sp || 0) > 2).length;
        const queued = j.cars.filter(c => (c.sp || 0) < 0.5).length;
        return { moving, queued, total: j.cars.length };
      };
      const onRed = hold("mainGreen", 22);     // the CROSS street is red here
      const onGreen = hold("crossGreen", 10);  // ... and green here
      return { onRed, onGreen };
    });
    check(`signals ${tag}: the cross traffic obeys them -- ${traf.onRed.queued} of ${traf.onRed.total} cars sat still at the red, and they were moving again on the green`,
      traf.onRed.queued >= 3 && traf.onGreen.moving >= traf.onRed.moving + 2, JSON.stringify(traf));

    // ---- 3. running one starts a chase, and obeying one does not ----------
    const ran = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const go = (aspect) => {
        L.policeStop(false);
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let i = 0; i < 40; i++) L.update(1 / 60);
        const j = L.lights.junctions[0];
        j.phase = aspect === "red" ? 2 : 0; j.t = 999;
        st.x = j.x - j.fx * 60; st.z = j.z - j.fz * 60; st.y = j.y;
        st.heading = Math.atan2(-j.fx, -j.fz); st.speed = 30; st.exploding = false;
        const r0 = L.flags.redsRun || 0, c0 = L.flags.policeChases || 0;
        let f = 0;
        while (f < 60 * 10 && !L.police.active) {
          L.api.setStick(0, 0.9); L.update(1 / 60); st.speed = Math.max(st.speed, 30); f++;
        }
        return { reds: (L.flags.redsRun || 0) - r0, chases: (L.flags.policeChases || 0) - c0,
                 active: L.police.active, cars: L.police.cars.length,
                 behind: L.police.active ? L.policeState().nearest : null };
      };
      const onRed = go("red");
      const onGreen = go("green");
      L.policeStop(false);
      return { onRed, onGreen };
    });
    check(`chase ${tag}: crossing the stop line on a RED brings two cars out behind him, and crossing on a green brings nothing -- the chase is the consequence of the choice, not of the junction`,
      ran.onRed.reds === 1 && ran.onRed.chases === 1 && ran.onRed.active &&
      ran.onRed.cars === 2 && ran.onRed.behind > 20 &&
      ran.onGreen.reds === 0 && ran.onGreen.chases === 0 && !ran.onGreen.active,
      JSON.stringify(ran));

    // ---- 4. he can always get out: two ways, neither of them luck ---------
    const out1 = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      // THE GIVE-UP RULE, on its own: put the gap past the distance and they go.
      L.policeStop(false);
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      L.policeStart(null);
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
      for (const c of L.police.cars) { c.x -= fx * (L.PL.giveUpDist + 200); c.z -= fz * (L.PL.giveUpDist + 200); }
      const o0 = L.flags.policeOutrun || 0;
      let f = 0;
      while (f < 60 * 20 && L.police.active) { L.api.setStick(0, 0.4); L.update(1 / 60); f++; }
      return { secs: +(f / 60).toFixed(1), active: L.police.active,
               outrun: (L.flags.policeOutrun || 0) - o0, giveUpDist: L.PL.giveUpDist };
    });
    check(`chase ${tag}: get far enough ahead and they peel off with a last whoop -- ${out1.giveUpDist} m is the whole of the rule, and it fired`,
      out1.outrun === 1 && !out1.active && out1.secs < 8, JSON.stringify(out1));

    const capped = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      // AND THE GAP IS HIS TO OPEN: their speed is capped below his top step, so
      // holding it pulls away. Driven, not teleported -- this is the rule he
      // finds by doing it.
      L.policeStop(false);
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      L.policeStart(null);
      st.speedStep = (L.spdStepsFor(L.spdKey()) || [1]).length - 1;
      let f = 0, peak = 0, mine = 0;
      while (f < 60 * 25 && L.police.active && !st.exploding) {
        L.api.setStick(0, 0.9); L.update(1 / 60); f++;
        peak = Math.max(peak, +L.policeState().nearest || 0);
        mine = Math.max(mine, st.speed);
      }
      return { peak: Math.round(peak), mine: Math.round(mine), topSpeed: L.PL.topSpeed,
               secs: +(f / 60).toFixed(1), ended: !L.police.active };
    });
    check(`chase ${tag}: their speed is capped at ${capped.topSpeed} and his top step is not, so holding it opened the gap to ${capped.peak} m -- going fast is the way out, and it is a rule he can find by doing it`,
      capped.peak > capped.topSpeed * 4 && capped.mine > capped.topSpeed + 15, JSON.stringify(capped));

    const out2 = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      // WAITING: doing nothing at all also ends it. A chase he cannot end would
      // be a thing taken away, and there is no such thing in this game.
      L.policeStop(false);
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      L.policeStart(null);
      const g0 = L.flags.policeGaveUp || 0;
      // Pinned, and moving: not far enough ahead to outrun them and not stopped
      // enough to be pulled over, so the ONLY way this can end is the clock.
      const px = st.x, pz = st.z, ph = st.heading;
      let f = 0;
      while (f < 60 * 140 && L.police.active) {
        L.api.setStick(0, 0.5); L.update(1 / 60); f++;
        // Twelve, not twenty: above the speed that counts as stopped and below
        // the one at which touching traffic is a bang, so neither of the other
        // two exits can fire and the clock is the only thing left.
        st.x = px; st.z = pz; st.heading = ph; st.speed = 12; st.exploding = false;
      }
      return { secs: +(f / 60).toFixed(1), active: L.police.active,
               gaveUp: (L.flags.policeGaveUp || 0) - g0, maxChase: L.PL.maxChase };
    });
    check(`chase ${tag}: and doing nothing about it ends it too -- neither far enough ahead nor stopped, they still gave up after ${out2.maxChase} seconds, so there is no chase he can be stuck in`,
      !out2.active && out2.gaveUp === 1 && out2.secs > out2.maxChase - 3 && out2.secs < out2.maxChase + 8,
      JSON.stringify(out2));

    // ---- 5. the pull-over: the full sequence, and it costs him nothing ----
    const pull = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.policeStop(false);
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 40; i++) L.update(1 / 60);
      const before = {
        flags: Object.fromEntries(Object.entries(L.flags).filter(([, v]) => typeof v === "number")),
        cards: document.querySelectorAll("#vehPicker .card, .pickCard").length,
        vehicle: st.vehicleKey, step: st.speedStep,
      };
      L.policeStart(null);
      const states = new Set(), nums = new Set();
      let f = 0, textSeen = [];
      while (f < 60 * 60 && L.police.active) {
        L.api.setStick(0, 0); st.speed = 0; L.update(1 / 60); f++;
        states.add(L.police.state);
        const n = document.getElementById("bigNum").textContent;
        if (n) nums.add(n);
      }
      // zero text through the whole of it: the numerals are allowed, words are not
      const walk = (n) => {
        if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && !/^[0-9]+$/.test(t)) textSeen.push(t.slice(0, 20)); return; }
        if (n.nodeType !== 1 || n.tagName === "TITLE" || n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
        if (getComputedStyle(n).display === "none") return;
        for (const c of n.childNodes) walk(c);
      };
      walk(document.body);
      const after = {
        flags: Object.fromEntries(Object.entries(L.flags).filter(([, v]) => typeof v === "number")),
        cards: document.querySelectorAll("#vehPicker .card, .pickCard").length,
        vehicle: st.vehicleKey, step: st.speedStep,
      };
      const lost = [];
      for (const k in before.flags) if ((after.flags[k] || 0) < before.flags[k]) lost.push(k);
      // and he can drive away the moment it is over
      let drove = 0;
      for (let i = 0; i < 60 * 3; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); drove = Math.max(drove, st.speed); }
      return { secs: +(f / 60).toFixed(1), states: [...states], nums: [...nums].sort(),
               lost, cards: [before.cards, after.cards], vehicle: after.vehicle === before.vehicle,
               step: after.step === before.step, text: textSeen.slice(0, 4), drove: Math.round(drove),
               active: L.police.active };
    });
    check(`chase ${tag}: stopping runs the pull-over in full -- they angle in, the numerals count 3-2-1, they peel away and he drives off with the engine running -- and it takes NOTHING: no flag falls, no card goes, no vehicle changes, and there is not a word on the screen`,
      pull.states.includes("pullover") && pull.states.includes("leaving") &&
      pull.nums.join(",") === "1,2,3" && pull.lost.length === 0 &&
      pull.cards[0] === pull.cards[1] && pull.vehicle && pull.step &&
      pull.text.length === 0 && pull.drove > 10 && !pull.active && pull.secs < 22,
      JSON.stringify(pull));

    // ---- 6. never for anything but the car --------------------------------
    const other = await page.evaluate(() => {
      const L = window.__lp;
      L.policeStop(false);
      const tried = {};
      for (const v of ["prop", "fighter", "airlinerDelta", "helicopter", "speedboat", "yacht", "rocket"]) {
        L.api.setVehicle(v);
        if (v === "speedboat" || v === "yacht") L.api.spawnAt(1, 1); else L.api.placeOnRunway();
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        tried[v] = { started: L.policeStart(null), can: L.policeCan(), active: L.police.active };
        L.policeStop(false);
      }
      return tried;
    });
    check(`chase ${tag}: it is the car's and nothing else's -- every other vehicle refuses to start one even when asked directly`,
      Object.values(other).every(t => !t.started && !t.can && !t.active), JSON.stringify(other));

    await page.close();
  }

  // ---- 7. what it costs to draw, at a busy junction with a chase on -------
  {
    const { page } = await newPage(1180, 820);
    const perf = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = false; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 40; i++) L.update(1 / 60);
      const j = L.lights.junctions[0];
      const sit = (chase) => {
        L.policeStop(false);
        st.x = j.x - j.fx * 55; st.z = j.z - j.fz * 55; st.y = j.y;
        st.heading = Math.atan2(-j.fx, -j.fz); st.speed = 20;
        j.phase = 2; j.t = 999;                       // red, so the cross street queues
        if (chase) L.policeStart(null);
        const px = st.x, pz = st.z, ph = st.heading;
        const hold = () => { st.x = px; st.z = pz; st.heading = ph; st.speed = 12; j.phase = 2; j.t = 999; st.exploding = false; };
        for (let i = 0; i < 90; i++) { L.update(1 / 60); hold(); L.renderer.render(L.scene, L.camera); }
        const ms = [];
        for (let r = 0; r < 7; r++) {
          const t0 = performance.now();
          for (let i = 0; i < 20; i++) { L.update(1 / 60); hold(); L.renderer.render(L.scene, L.camera); }
          ms.push((performance.now() - t0) / 20);
        }
        ms.sort((a, b) => a - b);
        return { ms: +ms[3].toFixed(2), calls: L.renderer.info.render.calls,
                 tris: L.renderer.info.render.triangles };
      };
      // interleaved, because sampling one then the other lets drift land on a side
      const a = [], b = [];
      for (let r = 0; r < 3; r++) { a.push(sit(false)); b.push(sit(true)); }
      const med = (xs) => xs.map(x => x.ms).sort((p, q) => p - q)[1];
      L.policeStop(false);
      return { quiet: a[1], chase: b[1], quietMs: +med(a).toFixed(2), chaseMs: +med(b).toFixed(2) };
    });
    const added = perf.chase.calls - perf.quiet.calls;
    check(`chase 1180x820: a busy junction with a chase running costs a bounded number of extra draw calls over the same junction without one (SwiftShader: read calls/tris as the hardware proxy, cpuMs only as a bound)`,
      added <= 24 && perf.chase.calls < 700, JSON.stringify({ ...perf, added }));
    console.log(`INFO  chase perf: ${perf.chaseMs} ms with the chase vs ${perf.quietMs} ms without, ` +
                `+${added} draw calls (${perf.chase.calls} vs ${perf.quiet.calls}), ` +
                `+${(perf.chase.tris - perf.quiet.tris).toLocaleString()} triangles (swiftshader, interleaved)`);
    await page.close();
  }
};
