// ---------------------------------------------------------------------------
// Stage 3 of BOATS: things to do at sea.
//
// The point of every check in here is the same: does it HAPPEN, and can it take
// anything away? A rubber-banded rival is not asserted by the rival existing --
// it is asserted by driving slowly and then flat out and finding it alongside
// both times, and by there being no counter anywhere that could go up or down.
// ---------------------------------------------------------------------------
const path = require("path");

module.exports = async function seaChecks({ newPage, check, shots }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  // ---- the jet-ski race ----------------------------------------------------
  const race = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    // out in the buoy channel, going flat out
    const P = L.HB.buoys.path;
    st.x = P[1][0]; st.z = P[1][1];
    st.heading = Math.atan2(-(P[2][0] - P[1][0]), -(P[2][1] - P[1][1]));
    st.y = L.TUNE.waterLevel; st.speed = L.BT.cruise;
    L.sea.ski.state = "away"; L.sea.ski.cool = 0;
    let appeared = false, fastGap = 0, slowGap = 0, everBehind = false, everAhead = false;
    // FLAT OUT for twelve seconds
    for (let i = 0; i < 60 * 12; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (L.sea.ski.g.visible) {
        appeared = true;
        const g = Math.hypot(st.x - L.sea.ski.x, st.z - L.sea.ski.z);
        fastGap = Math.max(fastGap, g);
        // is it ever ahead of him, and ever behind? A rubber band does both.
        const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
        const along = (L.sea.ski.x - st.x) * fx + (L.sea.ski.z - st.z) * fz;
        if (along > 3) everAhead = true;
        if (along < -3) everBehind = true;
      }
    }
    // and now DEAD SLOW for twelve seconds: it must not run off and leave him
    for (let i = 0; i < 60 * 12; i++) {
      L.api.clearStick(); L.update(1 / 60);
      st.speed = Math.max(st.speed, L.SE.ski.minSpeed + 2);   // still moving, barely
      if (L.sea.ski.g.visible) slowGap = Math.max(slowGap, Math.hypot(st.x - L.sea.ski.x, st.z - L.sea.ski.z));
    }
    L.api.clearStick();
    return { appeared, fastGap: Math.round(fastGap), slowGap: Math.round(slowGap),
             everAhead, everBehind, races: L.flags.skiRaces || 0,
             // there is nothing that could be scored: no counter, no winner
             // The word has to be a WHOLE word: `wingman` is a flag about flying
             // in formation and begins with "win", which is how the first version
             // of this check accused the game of keeping score.
             scoreKeys: Object.keys(L.flags).filter(k =>
               /(^|_)(win|won|lose|lost|score|lap|laps|place|rank)(_|$)/i.test(k) ||
               /(Won|Lost|Score|Rank|Place)s?$/.test(k)),
             // and the ski itself holds no result: the only thing counted about
             // the race anywhere is how many times one has started
             skiKeys: Object.keys(L.sea.ski).filter(k => /win|lost|result|score/i.test(k)),
             skiFlags: Object.keys(L.flags).filter(k => /^ski/.test(k)) };
  });
  check("sea: a rival jet-ski comes past and races him, RUBBER-BANDED -- it noses ahead and drops back, and flat out or barely moving it is still alongside. There is no winner and nothing anywhere that could be scored",
    race.appeared && race.fastGap < 220 && race.slowGap < 220 && race.everAhead && race.everBehind &&
    race.scoreKeys.length === 0 && race.skiKeys.length === 0 && race.skiFlags.join() === "skiRaces",
    JSON.stringify(race));

  // ---- the whale is scenery -------------------------------------------------
  // ITS OWN PAGE. The whale picks its spot from Math.random and rejects any
  // that lands in the shallows, so whether it surfaces inside the window
  // depends on where the seeded stream has got to -- and the race check above
  // moves that stream by however many frames it happened to run. On a shared
  // page this check passed or failed according to edits made somewhere else
  // entirely. CLAUDE.md's rule: give a check its own page when state carries.
  const { page: whalePage } = await newPage(1180, 820);
  await whalePage.evaluate(() => { window.__lp.noRender = true; });
  const whale = await whalePage.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    const P = L.HB.buoys.path;
    st.x = P[2][0]; st.z = P[2][1]; st.y = L.TUNE.waterLevel; st.speed = 0;
    L.sea.whale.next = 0.1;
    let breached = false, minDist = 1e9, everSolid = false;
    for (let i = 0; i < 60 * 90; i++) {
      L.update(1 / 60);
      if (L.sea.whale.g.visible) {
        breached = true;
        minDist = Math.min(minDist, Math.hypot(st.x - L.sea.whale.x, st.z - L.sea.whale.z));
      }
      if ((L.flags.boatCrashes || 0) > 0) everSolid = true;
    }
    // and it is in no solid list at all -- the astronaut's rule, not the paper planes'
    let inSolids = false;
    L.forEachSolid(b => { if (b.mesh && (b.mesh === L.sea.whale.g || b.mesh.parent === L.sea.whale.g)) inSolids = true; });
    return { breached, minDist: Math.round(minDist), everSolid, inSolids,
             noSolid: !!L.sea.whale.g.userData.noSolid, noShatter: !!L.sea.whale.g.userData.noShatter,
             count: L.flags.whaleBreaches || 0 };
  });
  check("sea: a whale breaches a long way off and NOTHING CAN HAPPEN TO IT -- it is in no solid list, carries noSolid and noShatter, and never becomes a crash",
    whale.breached && whale.minDist > 150 && !whale.everSolid && !whale.inSolids &&
    whale.noSolid && whale.noShatter, JSON.stringify(whale));
  await whalePage.close();

  // ---- sailing straight through it ------------------------------------------
  const through = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    L.sea.whale.next = 999;
    // put it right in front of him and drive at it
    L.sea.whale.x = st.x; L.sea.whale.z = st.z - 120;
    L.sea.whale.up = L.SE.whale.riseTime;
    st.heading = 0; st.speed = L.BT.cruise;
    let crashes = 0;
    for (let i = 0; i < 60 * 8; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      L.sea.whale.up = Math.max(L.sea.whale.up, 0.2);
      crashes = L.flags.boatCrashes || 0;
    }
    L.api.clearStick();
    return { crashes, exploding: st.exploding };
  });
  check("sea: he sails straight through a breaching whale and it is simply there -- no bang, no crash, no stop",
    through.crashes === 0 && !through.exploding, JSON.stringify(through));

  // ---- the carrier's wake ---------------------------------------------------
  const wake = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = L.carrier.x + 200; st.z = L.carrier.z + 200; st.y = L.TUNE.waterLevel; st.speed = 10;
    L.sea.wake.cool = 0;
    let maxBank = 0;
    const before = L.flags.carrierWakes || 0;
    for (let i = 0; i < 60 * 40; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      st.x = L.carrier.x + 200; st.z = L.carrier.z + 200;
      maxBank = Math.max(maxBank, Math.abs(st.bank));
    }
    L.api.clearStick();
    return { wakes: (L.flags.carrierWakes || 0) - before, maxBank: +maxBank.toFixed(1),
             crashes: L.flags.boatCrashes || 0 };
  });
  check("sea: close under the carrier a wake wall rolls past and rocks the boat -- it is felt, and it costs nothing",
    wake.wakes >= 1 && wake.maxBank > 3 && wake.crashes === 0, JSON.stringify(wake));

  // ---- the cruise ship ------------------------------------------------------
  const cruise = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    st.x = L.HB.cx; st.z = -6400; st.speed = 0;
    const S = L.sea.cruise;
    S.state = "away"; S.next = 0.1; S.g.visible = false;
    let calledBeforeSeen = null, seen = false, arrived = 0, alongside = null, left = false;
    for (let i = 0; i < 60 * 700; i++) {
      L.update(1 / 60);
      if (S.state === "calling" && !seen) calledBeforeSeen = !S.g.visible;   // horn first, hull later
      if (S.g.visible) seen = true;
      if (S.state === "alongside" && alongside === null) {
        alongside = { toQuay: Math.round(Math.hypot(S.x - L.HB.terminal.x, S.z - L.HB.terminal.z)),
                      inBasin: S.x > L.HB.basin.x[0] && S.x < L.HB.basin.x[1] &&
                               S.z > L.HB.basin.z[0] && S.z < L.HB.basin.z[1] };
      }
      if (seen && S.state === "away") { left = true; break; }
    }
    arrived = L.flags.cruiseArrivals || 0;
    return { calledBeforeSeen, seen, arrived, alongside, left, calls: L.flags.cruiseCalls || 0 };
  });
  check("sea: the cruise ship announces herself with a horn from over the horizon BEFORE anything appears, comes in past the breakwater and berths in the inner harbour, and goes again -- so there is always another one coming",
    cruise.calledBeforeSeen === true && cruise.seen && cruise.arrived >= 1 &&
    cruise.alongside && cruise.alongside.inBasin && cruise.alongside.toQuay < 500 && cruise.left, JSON.stringify(cruise));

  // ---- the horn is answered -------------------------------------------------
  const answer = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    const S = L.sea.cruise;
    S.state = "alongside"; S.t = 60; S.g.visible = true;
    S.x = L.HB.terminal.ship.x; S.z = L.HB.terminal.z - 120;
    st.x = S.x + 200; st.z = S.z + 100; st.speed = 0;
    L.flags.yachtReplies = 0;
    L.yachtHorn();
    for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
    return { replies: L.flags.yachtReplies || 0 };
  });
  check("sea: the yacht's horn is answered by the cruise ship alongside as well as by the ferry and the tug",
    answer.replies >= 1, JSON.stringify(answer));

  // ---- the crane puts a box on her foredeck ---------------------------------
  const crane = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    L.sea.crane.state = "idle";
    // out in the middle of the harbour, a honk is only a honk
    st.x = L.HB.cx; st.z = -6500; st.speed = 0;
    L.yacht.hornT = 0; L.yachtHorn();
    L.update(1 / 60);
    const away = L.sea.crane.state;
    // under a gantry, a honk is a request
    const c = L.harbor.cranes[0];
    st.x = c.cx; st.z = c.z1 - 30; L.yacht.x = st.x; L.yacht.z = st.z; L.yacht.heading = st.heading;
    L.yacht.hornT = 0; L.yachtHorn();
    for (let i = 0; i < 60 * 8; i++) L.update(1 / 60);
    const deck = L.yachtLocal ? null : null;
    const aboard = { state: L.sea.crane.state, visible: !!(L.sea.crane.box && L.sea.crane.box.visible),
                     y: L.sea.crane.box ? +L.sea.crane.box.position.y.toFixed(1) : null };
    // she carries it: drive her, and the box goes with her
    const bx0 = L.sea.crane.box.position.x, bz0 = L.sea.crane.box.position.z;
    for (let i = 0; i < 60 * 15; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    L.api.clearStick();
    const carried = Math.hypot(L.sea.crane.box.position.x - bx0, L.sea.crane.box.position.z - bz0);
    const onDeck = Math.hypot(L.sea.crane.box.position.x - st.x, L.sea.crane.box.position.z - st.z);
    // and honking again takes it off
    st.x = c.cx; st.z = c.z1 - 30; L.yacht.x = st.x; L.yacht.z = st.z; st.speed = 0;
    L.yacht.hornT = 0; L.yachtHorn();
    for (let i = 0; i < 60 * 8; i++) L.update(1 / 60);
    const off = { state: L.sea.crane.state, visible: !!(L.sea.crane.box && L.sea.crane.box.visible) };
    return { away, aboard, carried: Math.round(carried), onDeck: Math.round(onDeck), off,
             loads: L.flags.craneLoads || 0, unloads: L.flags.craneUnloads || 0 };
  });
  check("sea: honk the yacht under a gantry crane and it puts a container on her foredeck, she carries it wherever she goes, and honking again lifts it off. Out in the harbour a honk is only a honk",
    crane.away === "idle" && crane.aboard.state === "aboard" && crane.aboard.visible &&
    crane.carried > 100 && crane.onDeck < 40 && crane.off.state === "idle" && !crane.off.visible,
    JSON.stringify(crane));

  // ---- nothing at sea is ever required, and nothing blocks --------------------
  const free = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    // with everything running at once, he can still simply leave
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    const P = L.HB.buoys.path;
    st.x = P[1][0]; st.z = P[1][1]; st.speed = L.BT.cruise;
    st.heading = Math.atan2(-(P[2][0] - P[1][0]), -(P[2][1] - P[1][1]));
    L.sea.ski.state = "away"; L.sea.ski.cool = 0;
    L.sea.whale.next = 0.1;
    L.sea.cruise.state = "away"; L.sea.cruise.next = 0.1;
    L.sea.wake.cool = 0;
    for (let i = 0; i < 60 * 20; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    // turn round and go home, right through the middle of all of it
    st.heading += Math.PI;
    for (let i = 0; i < 60 * 60; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    L.api.clearStick();
    return { home: Math.round(Math.hypot(st.x - L.HB.marina.spawn[0], st.z - L.HB.marina.spawn[1])),
             crashes: L.flags.boatCrashes || 0, finite: isFinite(st.x) && isFinite(st.z) && isFinite(st.y),
             errors: L.frameErrors || 0 };
  });
  check("sea: with the race, a whale, the cruise ship and the carrier's wake all running at once he can turn round and sail home through the middle of them -- nothing at sea ever holds on to him",
    free.home < 1400 && free.finite && free.errors === 0, JSON.stringify(free));

  // ---- zero text ------------------------------------------------------------
  const text = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    L.sea.ski.state = "away"; L.sea.ski.cool = 0; L.sea.whale.next = 0.1;
    L.sea.cruise.state = "alongside"; L.sea.cruise.t = 40; L.sea.cruise.g.visible = true;
    for (let i = 0; i < 120; i++) L.update(1 / 60);
    const bad = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 24)); return; }
      if (n.nodeType !== 1 || n.tagName === "TITLE" || n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
      if (getComputedStyle(n).display === "none") return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return { bad: bad.slice(0, 5) };
  });
  check("sea: zero text with the race, the whale and the cruise ship all on screen", text.bad.length === 0, JSON.stringify(text));

  await page.screenshot({ path: path.join(shots, "sea-events.png") });
  await page.close();

  // ---- frame time at the busiest the harbour ever gets ----------------------
  {
    const { page } = await newPage(1180, 820);
    const perf = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      const place = () => {
        // in the mouth, with the cruise ship alongside, the bridge up, the
        // traffic queued and the terminal in frame: everything at once
        st.x = L.HB.cx; st.z = -6560; st.heading = Math.PI; st.y = L.TUNE.waterLevel; st.speed = 0;
        L.harbor.bridge.want = 1; L.harbor.bridge.open = 1;
        L.sea.cruise.state = "alongside"; L.sea.cruise.t = 200; L.sea.cruise.g.visible = true;
        L.sea.ski.g.visible = true;
      };
      const sample = (on) => {
        place();
        L.harbor.g.visible = on; L.sea.cruise.g.visible = on;
        for (let i = 0; i < 25; i++) { L.update(1 / 60); place(); L.harbor.g.visible = on; L.sea.cruise.g.visible = on; }
        const t0 = performance.now();
        for (let i = 0; i < 50; i++) {
          L.update(1 / 60); place(); L.harbor.g.visible = on; L.sea.cruise.g.visible = on;
          L.renderer.render(L.scene, L.camera);
        }
        return { ms: (performance.now() - t0) / 50, calls: L.renderer.info.render.calls, tris: L.renderer.info.render.triangles };
      };
      const a = [], b = [];
      for (let i = 0; i < 5; i++) { a.push(sample(true)); b.push(sample(false)); }
      const med = (v, k) => v.map(s => s[k]).sort((x, y) => x - y)[Math.floor(v.length / 2)];
      L.harbor.g.visible = true;
      return { withMs: +med(a, "ms").toFixed(2), withoutMs: +med(b, "ms").toFixed(2),
               calls: med(a, "calls"), callsWithout: med(b, "calls"),
               tris: med(a, "tris"), trisWithout: med(b, "tris") };
    });
    const added = perf.calls - perf.callsWithout;
    check("sea: the busiest the harbour ever gets -- cruise ship alongside, drawbridge up, traffic queued, terminal in frame -- stays inside the draw-call budget (SwiftShader: calls are the hardware proxy, cpuMs only a bound)",
      added < 110 && perf.withMs < 240, JSON.stringify({ ...perf, added }));
    console.log(`INFO  busiest harbour: ${perf.withMs} ms with it vs ${perf.withoutMs} ms without, +${added} draw calls, +${(perf.tris - perf.trisWithout).toLocaleString()} triangles (swiftshader, interleaved)`);
    await page.close();
  }
};
