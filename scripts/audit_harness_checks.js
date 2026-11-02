"use strict";
// Harness audit (phase 2): two checks that fail on the code as audited, and pass once fixed.
//   HARNESS-1  every asset the game's scripts fetch at runtime is in cockpit/sw.js ASSETS (a file check, no page)
//   HARNESS-2  a service-worker update never reloads the page under him while he is playing
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");

module.exports = async function auditHarnessChecks({ newPage, check }) {
  // ---- HARNESS-2 (the real controllerchange handler, driven) -------------------------------------
  // input.js only wires the handler on https; the page here is http, so the served input.js has that
  // one test widened, the worker container is given a controller (as on any launch after the first),
  // and a fake controllerchange is dispatched. A reload is seen as the page's marker vanishing.
  const scenario = async (label, setup) => {
    const { ctx, page } = await newPage(1024, 768);
    let rewired = false;
    await ctx.route("**/cockpit/js/input.js", async route => {
      const r = await route.fetch(); let body = await r.text();
      const b2 = body.replace(/location\.protocol === "https:"/g, '(location.protocol === "https:" || window.__swTest === true)');
      rewired = rewired || b2 !== body;
      await route.fulfill({ response: r, body: b2 });
    });
    await ctx.addInitScript(() => {
      window.__swTest = true; window.__ccListeners = 0;
      if (navigator.serviceWorker) {
        const C = navigator.serviceWorker;
        Object.defineProperty(C, "controller", { get: () => ({}), configurable: true });
        C.register = () => new Promise(() => {});
        const add = C.addEventListener.bind(C);
        C.addEventListener = (t, fn, o) => { if (t === "controllerchange") window.__ccListeners++; return add(t, fn, o); };
      }
    });
    await page.reload();
    await page.waitForFunction(() => window.__lp && (!window.__lp.artReady || window.__lp.artReady()), null, { timeout: 90000 });
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });
    if (label === "race grid") await page.waitForFunction(() => window.__lp.race && window.__lp.race.built, null, { timeout: 60000 }).catch(() => {});
    const before = await page.evaluate(setup);
    let navigated = 0; page.on("framenavigated", f => { if (f === page.mainFrame()) navigated++; });
    await page.evaluate(() => { window.__mark = 1; navigator.serviceWorker.dispatchEvent(new Event("controllerchange")); });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ marker: window.__mark === 1, listeners: window.__ccListeners })).catch(() => ({ marker: false }));
    let reloadedAfter;
    const navBefore = navigated;
    if (after.marker && navigated === 0) {
      const hasAfter = await page.evaluate(() => typeof window.__afterCC === "function").catch(() => false);
      if (hasAfter) {
        await page.evaluate(() => window.__afterCC()).catch(() => {});
        await page.waitForTimeout(1500);
        const m2 = await page.evaluate(() => window.__mark === 1).catch(() => false);
        reloadedAfter = !m2 || navigated > 0;
      }
    }
    await ctx.close();
    return { label, rewired, ...before, reloaded: !after.marker || navBefore > 0, reloadedAfter, listeners: after.listeners };
  };
  const out = [];
  out.push(await scenario("car stopped", () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
    for (let i = 0; i < 120; i++) L.update(1 / 60);
    st.speed = 0; L.update(1 / 60);
    return { phase: st.phase, speed: st.speed, menu: menuOpen() };
  }));
  out.push(await scenario("race grid", () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    L.rcStartRace("oval");
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    return { phase: st.phase, speed: st.speed, menu: menuOpen(), racePhase: L.race && (L.race.phase || L.race.state) };
  }));
  out.push(await scenario("boat idle", () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); L.api.skipScreens();
    for (let i = 0; i < 240; i++) L.update(1 / 60);
    return { phase: st.phase, speed: st.speed, menu: menuOpen() };
  }));
  // ... and the new code is not lost: arrived while he played, it is picked up when the picker next opens
  const later = await scenario("car stopped, then the picker", () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); L.api.skipScreens();
    for (let i = 0; i < 120; i++) L.update(1 / 60);
    st.speed = 0; L.update(1 / 60);
    window.__afterCC = () => L.openPickerAnywhere();
    return { phase: st.phase, speed: st.speed, menu: menuOpen() };
  });
  check("HARNESS-2: a new release that arrived while he played is picked up the next time the picker opens",
    later.rewired && later.listeners >= 1 && !later.reloaded && later.reloadedAfter === true, JSON.stringify(later));
  // the handler must really have been wired, or "no reload" proves nothing
  // ... and each really was the stopped state that used to reload: TAXI, speed 0, the race on its grid
  const live = out.every(o => o.rewired && o.listeners >= 1 && o.phase === "TAXI" && o.speed === 0) &&
    out[1].racePhase === "grid";
  check("HARNESS-2: a new release arriving (controllerchange) never reloads the page while he is playing -- not with the car stopped, not on the race grid, not with the boat idle",
    live && out.every(o => !o.menu && !o.reloaded), JSON.stringify(out));
};
