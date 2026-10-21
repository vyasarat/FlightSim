"use strict";
// EVENTS, WHAT A SHOWER COSTS (v177: lifted out of headless_test.js's T-EV, unchanged). It times
// frames in milliseconds, so the sharded harness runs it ALONE, after the shards (SOLO in
// harness_shards.js): on a machine shared with three other shards a millisecond means nothing.
module.exports = async function eventsPerfChecks({ newPage, check }) {
  const { page } = await newPage(1180, 820);
  const perf = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    const park = () => { L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; };
    const space = () => {
      st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
      st.y = 4000; st.pitch = 10; st.spaceF = 1;
    };
    // the real cost of a shower is draw calls, not the simulation, so both are timed
    const sim = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { L.update(1 / 60); park(); } return (performance.now() - t0) / n; };
    const drawn = (n) => {
      L.noRender = false;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { const q = window.__rafQueue.splice(0); if (q.length) q[q.length - 1](window.__simTime += 1000 / 60); park(); }
      const ms = (performance.now() - t0) / n;
      L.noRender = true;
      return ms;
    };
    L.noRender = true;
    L.api.setVehicle("rocket"); L.api.placeOnRunway(); space();
    sim(60); drawn(20);                              // warm the pipeline
    const baseSim = sim(300), baseDraw = drawn(90);   // in space, no event staged
    L.api.placeOnRunway(); L.eventsForce("meteors"); space();
    for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); park(); }   // let the shower fill up
    const rocks = L.evProps.length;
    const showSim = sim(300), showDraw = drawn(90);
    return { baseSim: +baseSim.toFixed(3), showSim: +showSim.toFixed(3),
             baseDraw: +baseDraw.toFixed(2), showDraw: +showDraw.toFixed(2), rocks };
  });
  console.log(`INFO  events: ${perf.baseSim.toFixed(2)} -> ${perf.showSim.toFixed(2)} ms of update(), ` +
    `${perf.baseDraw.toFixed(1)} -> ${perf.showDraw.toFixed(1)} ms of CPU per drawn frame with ${perf.rocks} props (swiftshader)`);
  check("events: frame time holds during the meteor shower",
    perf.rocks > 5 &&
    perf.showSim < Math.max(perf.baseSim * 2.5 + 0.5, 4) &&
    perf.showDraw < perf.baseDraw * 1.8 + 6, JSON.stringify(perf));
  await page.close();
};
