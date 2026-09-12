"use strict";
// ---------------------------------------------------------------------------
// The lock, and the dock it lifts him into.
//
// The point of every check here is the same as the sea events': does it HAPPEN,
// and can it take anything away? A lift is not asserted by a `fill` variable
// reaching 1 -- it is asserted by his BOAT being six metres higher than it was
// and floating there, by the dock holding water the world's own sea plane never
// reaches, and by there being no way to be shut in.
// ---------------------------------------------------------------------------

module.exports = async function lockChecks({ newPage, check, shots }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  // Put the lock back to "empty chamber, gates shut". The page is shared and
  // `lock.fill` carries between checks: the first version of the yacht check
  // inherited a full chamber from the speedboat's, so she correctly locked DOWN
  // and the check called a working lock broken.
  const resetLock = () => page.evaluate(() => {
    const L = window.__lp;
    L.lock.fill = 0; L.lock.state = "idle"; L.lock.t = 0; L.lock.idle = 0; L.lock.dir = 1;
    L.lock.gates.s.want = 0; L.lock.gates.n.want = 0;
    L.lock.gates.s.open = 0; L.lock.gates.n.open = 0;
    if (typeof L.setBigNum === "function") L.setBigNum(null);
  });

  // ---- the ground: the dock is a real second water level -------------------
  const built = await page.evaluate(() => {
    const L = window.__lp, K = L.LK, W = L.TUNE.waterLevel;
    const mid = r => [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];
    const [dx, dz] = mid(K.dock), [cx, cz] = mid(K.chamber);
    // No way in by water except the chamber: ring the dock well outside the rim
    // and count anything that is already below the world's sea there.
    let leaks = 0;
    for (let a = 0; a < 128; a++) {
      const th = a / 128 * Math.PI * 2;
      const x = dx + Math.cos(th) * 340, z = dz + Math.sin(th) * 340;
      if (L.terrainEff(x, z) < W && Math.abs(x - cx) > 60) leaks++;
    }
    return {
      built: L.lock.built,
      // the dock's floor is ABOVE the global sea, so the world's plane is not what fills it
      dockFloor: +L.terrainEff(dx, dz).toFixed(2),
      dockFloorAboveGlobalSea: L.terrainEff(dx, dz) > W,
      dockSurface: +L.seaLevelAt(dx, dz).toFixed(2),
      dockHoldsWater: L.terrainEff(dx, dz) < L.seaLevelAt(dx, dz),
      liftIsReal: Math.abs(L.seaLevelAt(dx, dz) - (W + K.lift)) < 0.01,
      // the chamber's floor is BELOW it, because it holds water at both heights
      chamberFloorBelowGlobalSea: L.terrainEff(cx, cz) < W,
      // the rim has to stand clear of the dock's surface or the water spills
      rimClears: L.terrainEff(K.rim.x[0] + 30, (K.rim.z[0] + K.rim.z[1]) / 2) > W + K.lift,
      leaks,
      // everywhere else in the world, the answer is still the world's own sea
      openSeaUnchanged: L.seaLevelAt(0, -8000) === W && L.seaLevelAt(1300, -6400) === W,
    };
  });
  check("lock: the dock is a genuine second water level -- its floor stands above the world's sea, it holds water six metres up, and the only way in by water is the chamber",
    built.built && built.dockFloorAboveGlobalSea && built.dockHoldsWater && built.liftIsReal &&
    built.chamberFloorBelowGlobalSea && built.rimClears && built.leaks === 0 && built.openSeaUnchanged,
    JSON.stringify(built));

  // ---- the cycle, in the boat he actually drives ---------------------------
  await resetLock();
  const cycle = await page.evaluate(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    const cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    // Come at it the way he would: from the harbour, outside the south gate.
    st.x = cx; st.z = K.gateS - 100; st.y = L.seaLevelAt(st.x, st.z); st.speed = 0; st.heading = Math.PI;
    for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
    const southOpensOnApproach = L.lock.gates.s.open > 0.9;
    const buttonOutside = !document.getElementById("lockBtn").classList.contains("hidden");

    // in the chamber
    st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const buttonInside = !document.getElementById("lockBtn").classList.contains("hidden");
    const yLow = st.y;

    const pressed = L.lockPress();
    let sawNumerals = false, sawBothShut = false, everFloatedFree = true;
    for (let i = 0; i < 60 * 30; i++) {
      L.update(1 / 60);
      st.x = cx; st.z = cz;                     // he sits still; the water does the work
      const bn = document.getElementById("bigNum");
      if (bn && bn.textContent) sawNumerals = true;
      if (L.lock.gates.s.open < 0.05 && L.lock.gates.n.open < 0.05) sawBothShut = true;
      // his hull must stay ON the surface the whole way up, never under it
      if (Math.abs(st.y - L.seaLevelAt(cx, cz)) > 1.5) everFloatedFree = false;
    }
    const yHigh = st.y;
    const numeralsGoneAfter = !document.getElementById("bigNum").textContent;

    // out into the dock, and he floats up there
    st.z = K.gateN + 120;
    for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
    const floatsInDock = L.boatOnWater();
    const dockY = +st.y.toFixed(2);

    return { southOpensOnApproach, buttonOutside, buttonInside, pressed,
             yLow: +yLow.toFixed(2), yHigh: +yHigh.toFixed(2), lifted: +(yHigh - yLow).toFixed(2),
             expected: K.lift, sawNumerals, numeralsGoneAfter, sawBothShut, everFloatedFree,
             floatsInDock, dockY };
  });
  check("lock: he drives up to it and the gate opens itself; the button exists only inside the chamber",
    cycle.southOpensOnApproach && !cycle.buttonOutside && cycle.buttonInside, JSON.stringify(cycle));
  check("lock: pressing it winds up on the shared numerals, shuts BOTH gates, and lifts his boat the full six metres -- the hull rides the surface the whole way",
    cycle.pressed && cycle.sawNumerals && cycle.numeralsGoneAfter && cycle.sawBothShut &&
    Math.abs(cycle.lifted - cycle.expected) < 0.3 && cycle.everFloatedFree,
    JSON.stringify(cycle));
  check("lock: and he floats out into the dock at the top",
    cycle.floatsInDock && cycle.dockY > 0, JSON.stringify({ floats: cycle.floatsInDock, y: cycle.dockY }));

  // ---- the yacht fits too --------------------------------------------------
  await resetLock();
  const big = await page.evaluate(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    const cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz); st.speed = 0; st.heading = Math.PI;
    for (let i = 0; i < 40; i++) L.update(1 / 60);
    const inside = L.lockBoatInside(), can = L.lockCanCycle();
    const y0 = st.y;
    L.lockPress();
    for (let i = 0; i < 60 * 30; i++) { L.update(1 / 60); st.x = cx; st.z = cz; }
    // she is fifty-two metres long and nine and a half wide: both have to fit
    const chamberW = K.chamber.x[1] - K.chamber.x[0], chamberL = K.gateN - K.gateS;
    return { inside, can, lifted: +(st.y - y0).toFixed(2), expected: K.lift,
             beams: +(chamberW / L.YT.beam).toFixed(1), lengths: +(chamberL / L.YT.len).toFixed(1),
             crashes: L.flags.yachtCrashes || 0 };
  });
  check("lock: the yacht fits and locks through as well -- five beams wide and nearly three of her lengths long",
    big.inside && big.can && Math.abs(big.lifted - big.expected) < 0.3 &&
    big.beams >= 4 && big.lengths >= 2 && big.crashes === 0, JSON.stringify(big));

  // ---- never stuck, and never required ------------------------------------
  await resetLock();
  const free = await page.evaluate(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    const cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    // sealed in: both gates shut, at the low level, doing nothing
    st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz); st.speed = 0;
    L.lock.fill = 0; L.lock.state = "idle"; L.lock.idle = 0;
    L.lock.gates.s.want = 0; L.lock.gates.n.want = 0;
    L.lock.gates.s.open = 0; L.lock.gates.n.open = 0;
    let opened = false;
    for (let i = 0; i < 60 * (K.idleReset + 8); i++) {
      L.update(1 / 60);
      st.x = cx; st.z = cz;
      if (L.lock.gates.s.open > 0.9) opened = true;
    }
    // ... and the sea route is untouched: the harbour mouth is still open water
    const mouthX = (L.HB.mouth.x[0] + L.HB.mouth.x[1]) / 2;
    const mouthOpen = L.terrainEff(mouthX, (L.HB.mouth.z[0] + L.HB.mouth.z[1]) / 2) < L.TUNE.waterLevel - 1;
    // nothing anywhere that could be scored or lost
    const scoreKeys = Object.keys(L.flags).filter(k =>
      /(^|_)(win|won|lose|lost|score|fail|penalt)(_|$)/i.test(k) || /(Won|Lost|Score|Fail)s?$/.test(k));
    const lockKeys = Object.keys(L.lock).filter(k => /win|lost|result|score|fail/i.test(k));
    return { opened, mouthOpen, scoreKeys, lockKeys };
  });
  check("lock: NEVER STUCK -- sealed in with both gates shut and nothing pressed, it lets him out on its own",
    free.opened, JSON.stringify({ opened: free.opened }));
  check("lock: it is never the way anywhere -- the harbour mouth is still open water, and nothing about it can be scored or lost",
    free.mouthOpen && free.scoreKeys.length === 0 && free.lockKeys.length === 0, JSON.stringify(free));

  // ---- and the car wash no longer offers itself out here -------------------
  await resetLock();
  const wash = await page.evaluate(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    const cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz); st.speed = 0;
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const inLock = !document.getElementById("washBtn").classList.contains("hidden");
    // ... but it is still there where the wash actually is
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    const bay = L.toyWorld.washes[st.originIdx];
    st.x = bay.x; st.z = bay.z;
    L.toyWorld.washCooldown = 0;
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const atAirport = !document.getElementById("washBtn").classList.contains("hidden");
    return { inLock, atAirport };
  });
  check("lock: the car wash button no longer offers itself to a boat two kilometres away, and is still there at the airport",
    !wash.inLock && wash.atAirport, JSON.stringify(wash));

  await page.close();
};
