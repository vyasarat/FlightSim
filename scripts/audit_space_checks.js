"use strict";
// Space audit checks (SPACE-1..4): the Mars pad's take-off and what else he can do while it runs.
// Each scenario on its own page. Every one starts the same way: the Starship landed on Mars, base built.
const ON_MARS = `(() => {
  const L = window.__lp, st = L.state, b = L.BODIES[1];
  L.noRender = true;
  L.api.setVehicle("starship"); L.api.placeOnRunway();
  st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
  const n0 = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
  st.x = b.x + n0.x * (b.r + 12); st.y = b.y + n0.y * (b.r + 12); st.z = b.z + n0.z * (b.r + 12);
  st.touching = false; releaseThrottle();
  L.update(1 / 60);
  window.__step = s => { for (let i = 0; i < Math.round(s * 60); i++) L.update(1 / 60); };
  // he drove out and back onto the lit pad: the base has him, the rover parks itself
  window.__backOnPad = () => {
    L.roverDeploy(); __step(0.1);
    mars.phase = "returning"; L.roverReturn();
    let t = 0; while (rover.active && t < 30) { __step(0.1); t += 0.1; }
    return !rover.active && mars.phase === "count";
  };
  return true;
})()`;

module.exports = async function ({ newPage, check }) {
  // ---- SPACE-1: a rover rolled out during the pad count never drives without a finger
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, st = L.state, o = {};
      o.onPad = __backOnPad();
      __step(1.0);                          // inside the 3 s count
      o.phaseAtTap = mars.phase;
      o.deployed = L.roverDeploy();         // he taps the rover button (it is up)
      const x0 = rover.x, y0 = rover.y, z0 = rover.z;
      let maxSpeed = 0;
      for (let i = 0; i < 360; i++) {       // 6 s, no finger anywhere
        st.touching = false;
        L.update(1 / 60);
        maxSpeed = Math.max(maxSpeed, Math.abs(rover.speed));
      }
      o.moved = +Math.hypot(rover.x - x0, rover.y - y0, rover.z - z0).toFixed(1);
      o.maxSpeed = +maxSpeed.toFixed(2);
      o.roverActive = rover.active; o.phaseLater = mars.phase; o.throttleHeld = st.throttleHeld;
      return o;
    });
    check("SPACE-1: a rover rolled out during the pad count never drives without a finger",
      o.onPad && o.phaseAtTap === "count" && !(o.deployed && (o.moved > 3 || o.maxSpeed > 1)), Object.assign(o, { errors }));
    await ctx.close();
  }

  // ---- SPACE-2: the picker mid-count, then the real cards: the Earth rocket waits for his finger
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, st = L.state, o = {};
      o.onPad = __backOnPad();
      __step(1.0);
      openPickerAnywhere();                 // the way back to the vehicles, mid-count
      __step(3);                            // looking at the cards
      applyVehicle("starship");             // the vehicle card
      el.screenVehicle.classList.add("hiddenS"); el.screenDir.classList.remove("hiddenS");
      __step(1);
      spawnForTakeoff(0, 0);                // the direction card
      el.screenDir.classList.add("hiddenS"); el.screenDest.classList.remove("hiddenS");
      __step(1);
      st.dest = "moon"; eventsOnDest();     // the destination card
      el.screenDest.classList.add("hiddenS");
      o.menuOpen = menuOpen();
      o.onEarthPad = !L.rk.onBody && st.phase === "TAXI";
      o.thrAtStart = st.throttleHeld;
      const lift0 = L.flags.liftoff || 0, y0 = st.y;
      let thrFrames = 0;
      for (let i = 0; i < 300; i++) {       // 5 s, no finger
        st.touching = false;
        L.update(1 / 60);
        if (st.throttleHeld) thrFrames++;
      }
      o.liftoffs = (L.flags.liftoff || 0) - lift0;
      o.phase = st.phase; o.climbed = +(st.y - y0).toFixed(1); o.thrFrames = thrFrames;
      return o;
    });
    check("SPACE-2: after the picker during the Mars pad count, the next rocket never launches without a finger",
      o.onPad && o.onEarthPad && !o.menuOpen && o.liftoffs === 0 && o.thrFrames === 0 && o.phase !== "AIRBORNE",
      Object.assign(o, { errors }));
    await ctx.close();
  }

  // ---- SPACE-2 (law-reviewer, v211): the picker inside the lift-off boost, then a plane picked:
  // the boost lets go, and the plane on the runway waits for his finger
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, st = L.state, o = {};
      o.onPad = __backOnPad();
      const lift0 = L.flags.liftoff || 0;
      for (let i = 0; i < 60 * 12 && (L.flags.liftoff || 0) === lift0; i++) { st.touching = false; L.update(1 / 60); }
      o.liftedOffMars = (L.flags.liftoff || 0) > lift0 && !L.rk.onBody;
      __step(1);                            // a second into the boost
      o.boosting = mars.boostT > 0;
      openPickerAnywhere();
      __step(1);
      applyVehicle("prop"); spawnForTakeoff(0, 0);
      el.screenVehicle.classList.add("hiddenS"); el.screenDir.classList.add("hiddenS"); el.screenDest.classList.add("hiddenS");
      o.menuOpen = menuOpen();
      const z0 = st.z, x0 = st.x;
      let thrFrames = 0;
      for (let i = 0; i < 60 * 8; i++) { st.touching = false; L.update(1 / 60); if (st.throttleHeld) thrFrames++; }
      o.thrFrames = thrFrames; o.rolled = +Math.hypot(st.x - x0, st.z - z0).toFixed(1); o.phase = st.phase;
      return o;
    });
    check("SPACE-2: the picker inside the Mars lift-off boost: the plane he picks next never rolls without a finger",
      o.onPad && o.liftedOffMars && o.boosting && !o.menuOpen && o.thrFrames === 0 && o.rolled < 1, Object.assign(o, { errors }));
    await ctx.close();
  }

  // ---- SPACE-2 (law-reviewer, v211): the picker opened and shut again in the count takes nothing away:
  // the pad still lights him
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, st = L.state, o = {};
      o.onPad = __backOnPad();
      __step(1);
      openPickerAnywhere(); __step(2);
      o.thrUnderCards = st.throttleHeld;
      el.screenVehicle.classList.add("hiddenS");      // shut with nothing picked
      o.menuOpen = menuOpen();
      const lift0 = L.flags.liftoff || 0;
      for (let i = 0; i < 60 * 12 && (L.flags.liftoff || 0) === lift0; i++) { st.touching = false; L.update(1 / 60); }
      o.liftedOff = (L.flags.liftoff || 0) > lift0; o.phase = st.phase; o.base = mars.phase;
      return o;
    });
    check("SPACE-2: the picker opened and shut in the Mars pad count: the pad still takes him home, and holds nothing under the cards",
      o.onPad && !o.menuOpen && !o.thrUnderCards && o.liftedOff, Object.assign(o, { errors }));
    await ctx.close();
  }

  // ---- SPACE-3: two Mars countdowns at once never buzz: about one tick a second
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, o = {};
      L.roverDeploy(); __step(0.1);
      // the cargo ship's countdown started while he drove home onto the pad
      mars.cargoPhase = "count"; mars.cargoT = 4.5;
      mars.phase = "returning"; L.roverReturn();
      let t = 0; while (rover.active && t < 30) { L.update(1 / 60); t += 1 / 60; }
      L.update(1 / 60);                     // the frame the base sees him in and starts its count
      o.padCounting = mars.phase === "count"; o.cargoCounting = mars.cargoPhase === "count";
      let ticks = 0, sets = 0;
      const sb = window.synthBlip, sn = window.setBigNum;
      window.synthBlip = function () { ticks++; return sb.apply(this, arguments); };
      window.setBigNum = function () { sets++; return sn.apply(this, arguments); };
      let shownChanges = 0, last = el.bigNum.textContent;
      try {
        for (let i = 0; i < 150; i++) {     // 2.5 s: both counts still running
          L.update(1 / 60);
          if (el.bigNum.textContent !== last) { shownChanges++; last = el.bigNum.textContent; }
        }
      } finally { window.synthBlip = sb; window.setBigNum = sn; }
      o.ticks = ticks; o.shownChanges = shownChanges;
      return o;
    });
    check("SPACE-3: with the cargo ship's and the pad's countdowns both due, the numeral still counts, and ticks about once a second",
      o.padCounting && o.cargoCounting && o.ticks >= 2 && o.ticks <= 8 && o.shownChanges >= 2, Object.assign(o, { errors }));
    await ctx.close();
  }

  // ---- SPACE-4: a star shower he parked away from gives the pad's lights back
  {
    const { page, errors, ctx } = await newPage(1024, 768);
    await page.evaluate(ON_MARS);
    const o = await page.evaluate(() => {
      const L = window.__lp, o = {};
      L.roverDeploy(); __step(0.1);
      mars.cargoPhase = "down";
      mars.stars.t = 0.1;                   // the shower is due
      __step(0.5);
      o.showerOn = mars.stars.phase !== "wait" && mars.stars.phase !== "rest";
      L.roverReturn();                      // the rover button: back in, near the pad (base still idle)
      let t = 0; while (rover.active && t < 30) { __step(0.1); t += 0.1; }
      o.parked = !rover.active; o.base = mars.phase;
      // a long while sitting in the rocket: well past MB.stars.padDimFor
      __step(L.MB.stars.padDimFor + 10);
      // over the next 3 s the pad's lights must show their gold at least once (they blink)
      let lit = 0;
      for (let i = 0; i < 180; i++) { L.update(1 / 60); if (mars.padMat && mars.padMat.color.getHex() === 0xffd23e) lit++; }
      o.litFrames = lit;
      o.padHex = mars.padMat && mars.padMat.color.getHexString();
      return o;
    });
    check("SPACE-4: a star shower he has parked away from gives the pad its gold lights back",
      o.showerOn && o.parked && o.base === "idle" && o.litFrames > 0, Object.assign(o, { errors }));
    await ctx.close();
  }
};
