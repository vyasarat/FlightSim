"use strict";
// ---------------------------------------------------------------------------
// v197: LONDON, ACROSS THE SEA. Every check here asks whether a thing HAPPENS, measured in
// the states he is really in, as a delta -- and that New York and California did not move.
//
//   the world   the crossing is clean water with its islands; the cliffs stand up out of it;
//               the Thames is water by the ONE definition all the way from the sea to
//               Westminster, and its banks are dry; London is 2-3 minutes from New York
//   landmarks   each stands on its real bank, in its real order along the river; each is
//               solid; a helicopter lands on the flat ones; the boats and whale are not solid
//   alive       Big Ben bongs on game time (and its minute hand is up when it does); the
//               wheel turns; the ships sail; the lighthouse turns; a whale breaches out there
//   the start   the globe is up where it should be and nowhere else, has no text, starts him
//               in London, a relaunch brings London back with the picker on the vehicles;
//               he takes off for New York and lands hands-off at London
//   unchanged   New York's and California's ground is what it was, and a question asked in
//               New York never walks London's solids
//   perf        (the solo phase) London from the air and the street, against New York's
// ---------------------------------------------------------------------------
module.exports = async function londonChecks({ newPage, check, perf }) {
  const perfBlock = async () => {
    const { page } = await newPage(1180, 820);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      L.api.skipScreens();
      const views = {
        "london-air": { veh: "prop", x: -200, z: 13000, agl: 420, tx: -850, tz: 14700, tagl: 0 },
        "london-street": { veh: "prop", x: -980, z: 15500, agl: 25, tx: -905, tz: 15622, tagl: 20 },
        "london-bigben": { veh: "prop", x: -700, z: 15100, agl: 60, tx: -500, tz: 15505, tagl: 50 },
        "ny-air": { veh: "prop", x: -140, z: 4640, agl: 260, tx: -520, tz: 4120, tagl: 0 },
        "ny-street": { veh: "prop", x: -560, z: 4300, agl: 25, tx: -400, tz: 4150, tagl: 20 },
      };
      const place = (v) => {
        const gy = Math.max(L.terrainEff(v.x, v.z), T.waterLevel), ty = Math.max(L.terrainEff(v.tx, v.tz), T.waterLevel);
        const dx = v.tx - v.x, dz = v.tz - v.z;
        st.x = v.x; st.z = v.z; st.y = gy + v.agl; st.heading = Math.atan2(-dx, -dz);
        st.pitch = Math.atan2(ty + v.tagl - gy - v.agl, Math.hypot(dx, dz)) * 180 / Math.PI;
        st.bank = 0; st.speed = st.vp.cruiseSpeed; st.airVy = 0; st.exploding = false; st.phase = "AIRBORNE";
      };
      const out = {};
      L.api.setVehicle("prop"); L.api.setView(true);
      for (const [k, v] of Object.entries(views)) {
        L.api.spawnAt(v.z > 9000 ? 2 : 0, 0);
        for (let i = 0; i < 120; i++) { place(v); L.update(1 / 60); }
        const ms = []; let calls = 0, tris = 0;
        for (let i = 0; i < 6; i++) {
          place(v); L.update(1 / 60);
          const t0 = performance.now();
          L.renderer.render(L.scene, L.camera);
          ms.push(performance.now() - t0);
          calls = L.renderer.info.render.calls; tris = L.renderer.info.render.triangles;
        }
        ms.sort((a, b) => a - b);
        out[k] = { calls, tris, ms: +ms[3].toFixed(1) };
      }
      return out;
    });
    const L = r["london-air"], S = r["london-street"], B = r["london-bigben"], N = r["ny-air"], NS = r["ny-street"];
    console.log("INFO  london perf (SwiftShader: calls/tris are the proxy, ms only a bound): " + JSON.stringify(r));
    check("london perf: from the air London costs no more than New York does -- draw calls and triangles (SwiftShader: these are the iPad proxy)",
      L.calls <= N.calls && L.tris <= N.tris, JSON.stringify({ london: L, ny: N }));
    check("london perf: low over Trafalgar Square and beside Big Ben, London costs no more than New York's streets do",
      S.calls <= NS.calls && B.calls <= NS.calls && S.tris <= NS.tris && B.tris <= NS.tris, JSON.stringify({ trafalgar: S, bigben: B, ny: NS }));
    await page.close();
  };
  if (perf === "only") { await perfBlock(); return; }

  const { page } = await newPage(1024, 768);
  await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });

  // ---- the world ------------------------------------------------------------------------
  const world = await page.evaluate(() => {
    const L = window.__lp, T = L.TUNE, LD = T.london;
    const water = (x, z) => L.terrainEff(x, z) < L.seaLevelAt(x, z);
    const o = {};
    // the crossing, down the line between the runways: water all the way, but for the islands
    const isl = (x, z) => LD.islands.some(i => Math.hypot(x - i.x, z - i.z) < i.r + 20);
    o.dryOnCrossing = [];
    for (let x = -2400; x <= 2400; x += 200) for (let z = LD.seaFull; z < L.ldCoastZ(x) - 40; z += 50) {
      if (!isl(x, z) && !water(x, z)) o.dryOnCrossing.push([x, z]);
    }
    o.islandsDry = LD.islands.map(i => !water(i.x, i.z) && L.terrainEff(i.x, i.z) > T.waterLevel + 4);
    // the cliffs: within 60 m of the coastline the ground stands 25 m and more over the sea
    o.cliffs = [];
    for (let x = -2000; x <= 2000; x += 250) {
      if (Math.abs(x - -870) < 300) continue;                 // the Thames's mouth cuts through them there
      const c = L.ldCoastZ(x); let top = -1e9;
      for (let d = 0; d <= 60; d += 4) top = Math.max(top, L.terrainEff(x, c + d));
      o.cliffs.push(+(top - T.waterLevel).toFixed(1));
    }
    // the Thames: its centreline is water from the sea to Lambeth, and its banks are dry
    const P = LD.thames.pts;
    o.riverDry = []; o.bankWet = [];
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (a[1] > 15600 && b[1] > 15600) continue;           // upstream of Lambeth: past the city, not asked
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, hw = a[2] + (b[2] - a[2]) * t;
        if (!water(x, z)) o.riverDry.push([Math.round(x), Math.round(z)]);
        // the banks, well out from the water: dry (inland only -- past the coast it is the sea)
        const dx = b[0] - a[0], dz = b[1] - a[1], m = Math.hypot(dx, dz), lx = dz / m, lz = -dx / m;
        for (const s of [1, -1]) {
          const bx = x + lx * s * (hw + 40), bz = z + lz * s * (hw + 40);
          if (bz > L.ldCoastZ(bx) + 80 && water(bx, bz) && L.ldRiverAt(bx, bz).d > hw + 30) o.bankWet.push([Math.round(bx), Math.round(bz)]);
        }
      }
    }
    const ny = L.AIRPORTS[0], ld = L.AIRPORTS[2];
    o.flightS = (ld.cz - ny.cz) / T.cruiseSpeed;
    const sky = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
    o.cityS = Math.hypot(LD.at.bigBen[0] - sky.x, LD.at.bigBen[1] - sky.z) / T.cruiseSpeed;
    // the landmarks' banks and order along the river: left of the downstream flow is the
    // north bank (Westminster, the City, the Tower, the palace); right is the south (the Eye, the Shard)
    const along = (x, z) => {
      let best = Infinity, s = 0, acc = 0, side = 0;
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i], ex = b[0] - a[0], ez = b[1] - a[1], m2 = ex * ex + ez * ez;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / m2));
        const d = Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
        if (d < best) { best = d; s = acc + t * Math.sqrt(m2); side = Math.sign(ez * (x - a[0]) - ex * (z - a[1])); }
        acc += Math.sqrt(m2);
      }
      return { s, side, d: best };   // side +1: left of the downstream flow (the north bank)
    };
    o.banks = {};
    for (const k of ["bigBen", "parliament", "victoriaTower", "nelson", "palace", "stPauls", "tower", "gherkin", "eye", "shard"]) {
      const [x, z] = LD.at[k], a = along(x, z);
      o.banks[k] = { side: a.side, s: Math.round(a.s), d: Math.round(a.d) };
    }
    for (const k of ["towerBridge", "londonBridge"]) { const [x, z] = LD.at[k]; o.banks[k] = { s: Math.round(along(x, z).s), d: Math.round(along(x, z).d) }; }
    // every landmark is there, drawn and solid
    o.landmarks = Object.fromEntries(Object.entries(L.ldn.landmarks).map(([k, v]) => [k, { tris: v.tris, solids: v.solids }]));
    return o;
  });
  check("london world: the crossing is open water from NY's sea to Britain's coast, but for its islands", world.dryOnCrossing.length === 0, JSON.stringify(world.dryOnCrossing.slice(0, 6)));
  check("london world: two islands and the lighthouse rock stand out of the sea", world.islandsDry.length >= 3 && world.islandsDry.every(Boolean), JSON.stringify(world.islandsDry));
  check("london world: Britain's coast is cliffs -- 25 m and more over the sea within 60 m of the water, all along it", world.cliffs.length >= 12 && world.cliffs.every(h => h >= 25), JSON.stringify(world.cliffs));
  check("london world: the Thames is water by the one definition (terrainEff < seaLevelAt) from the sea to Lambeth", world.riverDry.length === 0, JSON.stringify(world.riverDry.slice(0, 6)));
  check("london world: the Thames's banks are dry land", world.bankWet.length === 0, JSON.stringify(world.bankWet.slice(0, 6)));
  check("london world: London is 2-3 minutes from New York at a plane's cruise (runway to runway, and the skyline to Big Ben)",
    world.flightS >= 110 && world.flightS <= 180 && world.cityS >= 120 && world.cityS <= 200, JSON.stringify({ runways: Math.round(world.flightS), cities: Math.round(world.cityS) }));
  const B = world.banks;
  const north = ["bigBen", "parliament", "victoriaTower", "nelson", "palace", "stPauls", "tower", "gherkin"], south = ["eye", "shard"];
  check("london landmarks: each on its real bank -- Westminster, the City, the Tower and the palace on the north; the Eye and the Shard on the south",
    north.every(k => B[k].side === 1) && south.every(k => B[k].side === -1), JSON.stringify(B));
  check("london landmarks: in their real order down the river -- Westminster, then London Bridge, then Tower Bridge; and both bridges stand over the water",
    B.bigBen.s < B.londonBridge.s && B.londonBridge.s < B.towerBridge.s && B.stPauls.s < B.londonBridge.s && B.towerBridge.d < 10 && B.londonBridge.d < 10, JSON.stringify(B));
  const want = ["bigBen", "parliament", "victoriaTower", "eye", "nelson", "arch", "mall", "memorial", "palace", "stPauls", "londonBridge", "towerBridge", "tower", "shard", "gherkin", "phoneBoxes", "lighthouse"];
  check("london landmarks: every one is built, drawn and (but the Mall) solid", want.every(k => world.landmarks[k] && world.landmarks[k].tris > 20 && (k === "mall" || world.landmarks[k].solids > 0)), JSON.stringify(world.landmarks));

  // ---- solid, landable, and the living things not ------------------------------------------
  const solid = await page.evaluate(() => {
    const L = window.__lp, T = L.TUNE, LD = T.london, st = L.state, o = {};
    L.api.setVehicle("prop"); L.api.spawnAt(2, 0);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const probe = (k, dx, h, dz) => {
      const [x, z] = LD.at[k], y = L.terrainEff(x, z) + h;
      const hit = L.solidQuery(x + (dx || 0), y, z + (dz || 0), 3, L.SOLID.AIR);
      return hit ? (hit.b.ld || hit.kind) : null;
    };
    o.hits = {
      bigBen: probe("bigBen", 0, 60), bigBenSpire: probe("bigBen", 0, 85), parliament: probe("parliament", 0, 15), victoriaTower: probe("victoriaTower", 0, 60),
      stPaulsDome: probe("stPauls", 0, 60, -10), shard: probe("shard", 0, 150), gherkin: probe("gherkin", 0, 100), tower: probe("tower", 0, 20),
      towerBridge: probe("towerBridge", 40, 30), towerBridgeWalk: (() => { const [x, z] = LD.at.towerBridge; const h = L.solidQuery(x, T.waterLevel + 9 + 36, z + 7, 1.5, L.SOLID.AIR); return h ? h.b.ld : null; })(), londonBridge: (() => { const [x, z] = LD.at.londonBridge; const h = L.solidQuery(x, T.waterLevel + 8.5, z, 2, L.SOLID.AIR); return h ? h.b.ld : null; })(),
      palace: probe("palace", 0, 12), nelson: probe("nelson", 0, 40), eyeRim: (() => { const E = L.ldn.eye; const h = L.solidQuery(E.x + E.r - 1.6, E.y, E.z, 2, L.SOLID.AIR); return h ? h.b.ld : null; })(),
    };
    // what is alive, or moving, is never solid
    const sh = L.ldn.ships[0], wh = L.ldn.whale.g;
    o.shipSolid = !!L.solidQuery(sh.x, T.waterLevel + 6, sh.z, 3, L.SOLID.AIR);
    o.whaleFlags = !!(wh && wh.userData.noSolid && wh.userData.noShatter);
    return o;
  });
  check("london landmarks: each one stops a plane (solid, in the one registry)", Object.values(solid.hits).every(Boolean), JSON.stringify(solid.hits));
  check("london: the ships and the whale are never solid (scenery that moves; the whale is alive)", !solid.shipSolid && solid.whaleFlags, JSON.stringify(solid));

  const heli = await page.evaluate(() => {
    const L = window.__lp, S = L.state, H = L.heli, T = L.TUNE, LD = T.london;
    L.api.setVehicle("helicopter"); L.api.spawnAt(2, 0);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const out = {};
    // straight down on to the flat tops: the palace, the White Tower, St Paul's nave, a London Bridge pier
    for (const [k, dx, dz] of [["palace", 30, 0], ["tower", 0, 0], ["stPauls", 0, 40], ["victoriaTower", 0, 0]]) {
      const [x, z] = LD.at[k];
      let top = null;
      L.forEachSolid(b => { if (b.ld === k && Math.abs(x + dx - b.x) < b.hw && Math.abs(z + dz - b.z) < b.hd) top = Math.max(top === null ? -1e9 : top, b.y1); });
      L.heliReset(); L.restoreShattered(); S.exploding = false;
      S.x = x + dx; S.z = z + dz; S.y = top + 30; S.heading = 0; S.phase = "AIRBORNE"; S.speed = 0; H.altitude = S.y; H.vy = 0;
      let bang = false; H.vertical = -1;
      for (let i = 0; i < 60 * 25 && S.phase !== "TAXI"; i++) { L.update(1 / 60); if (S.exploding) bang = true; }
      H.vertical = 0;
      for (let i = 0; i < 60; i++) { L.update(1 / 60); if (S.exploding) bang = true; }
      out[k] = { landed: S.phase === "TAXI", bang, skid: +(S.y - T.gearHeight).toFixed(2), top: top === null ? null : +top.toFixed(2) };
    }
    return out;
  });
  check("london landmarks: the helicopter lands on their roofs -- the palace, the White Tower, St Paul's, the Victoria Tower -- and never bangs",
    Object.values(heli).every(w => w.landed && !w.bang && Math.abs(w.skid - w.top) < 0.5), JSON.stringify(heli));

  // ---- alive: Big Ben, the wheel, the ships, the beam, the whale -----------------------------
  const alive = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE, LD = T.london, F = L.flags, o = {};
    L.api.setVehicle("prop"); L.api.spawnAt(2, 0);
    // parked at London's airport, 2.3 km from the tower: in earshot. Run game time only.
    const realNow = performance.now; let calls = 0;
    performance.now = () => { calls++; return realNow.call(performance); };
    const b0 = F.bigBenBongs || 0, h0 = F.bigBenHeard || 0, e0 = L.ldn.eyeA, s0 = L.ldn.ships.map(s => s.x), beam0 = L.ldn.beamSpun || 0;
    let upAtBong = null;
    for (let i = 0; i < 60 * 40; i++) {
      const before = F.bigBenBongs || 0;
      L.update(1 / 60);
      if ((F.bigBenBongs || 0) > before && upAtBong === null) upAtBong = +L.ldClockPhase().toFixed(3);
    }
    o.bongs = (F.bigBenBongs || 0) - b0; o.heard = (F.bigBenHeard || 0) - h0; o.upAtBong = upAtBong;
    let dA = L.ldn.eyeA - e0; if (dA < 0) dA += Math.PI * 2;
    o.eyeTurn = +dA.toFixed(3);                       // 40 s at its rate
    o.shipsMoved = L.ldn.ships.map((s, i) => +Math.abs(s.x - s0[i]).toFixed(1));
    o.beam = +((L.ldn.beamSpun || 0) - beam0).toFixed(2);
    // and the next bong comes `every` seconds after
    const b1 = F.bigBenBongs;
    for (let i = 0; i < 60 * (LD.bigBen.every + 10); i++) L.update(1 / 60);
    o.nextBongs = F.bigBenBongs - b1;
    performance.now = realNow;
    o.nowCalls = calls;
    // a whale, crossing: fly the prop across the open sea for a minute and a half
    L.api.spawnAt(0, 1);
    const w0 = F.ldWhaleBreaches || 0;
    st.phase = "AIRBORNE"; st.x = 0; st.z = 8800; st.y = 120; st.heading = Math.PI; st.pitch = 0; st.speed = 30;
    for (let i = 0; i < 60 * 90; i++) { st.z = 8800 + (i % 3000) * 0.6; st.x = 0; st.y = 120; st.heading = Math.PI; st.pitch = 0; st.speed = 30; L.update(1 / 60); }
    o.whales = (F.ldWhaleBreaches || 0) - w0;
    return o;
  });
  check("london alive: Big Ben bongs on game time -- three strokes within 40 s of a London start, heard there, and again a period later; the minute hand is up when it strikes",
    alive.bongs >= 3 && alive.heard >= 3 && alive.nextBongs >= 3 && alive.upAtBong !== null && (alive.upAtBong < 0.02 || alive.upAtBong > 0.98), JSON.stringify(alive));
  check("london alive: the big wheel turns slowly (about once in four minutes)", alive.eyeTurn > 0.6 && alive.eyeTurn < 1.6, JSON.stringify(alive.eyeTurn));
  check("london alive: the ships sail and the lighthouse turns", alive.shipsMoved.every(d => d > 100) && alive.beam > 10, JSON.stringify({ ships: alive.shipsMoved, beam: alive.beam }));
  check("london alive: a whale breaches off his beam while he crosses the sea", alive.whales >= 1, JSON.stringify(alive.whales));

  // ---- the start: the globe ----------------------------------------------------------------
  const globe = await page.evaluate(() => {
    const L = window.__lp, st = L.state, o = {};
    const vis = id => !document.getElementById(id).classList.contains("hidden") && !document.getElementById(id).classList.contains("hiddenS");
    const tap = el => { el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 9 })); };
    const frame = () => { L.update(1 / 60); L.btnUpdateAll(); };
    o.text = (document.getElementById("globeBtn").textContent + document.getElementById("screenGlobe").textContent).replace(/\s+/g, "");
    // parked in each thing he might be in: the globe for the ones that fly from a runway
    o.shows = {};
    for (const v of ["prop", "airlinerDelta", "fighter", "helicopter", "car", "speedboat", "rocket", "monster"]) {
      L.api.setVehicle(v); L.api.spawnAt(0, 0); for (let i = 0; i < 20; i++) frame();
      o.shows[v] = vis("globeBtn");
      o.clash = (o.clash || []).concat(L.btnSlotClashes().map(c => v + ":" + JSON.stringify(c)));
    }
    // in flight it goes
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); st.phase = "AIRBORNE"; st.y += 200; st.speed = 60; frame();
    o.inFlight = vis("globeBtn");
    // a tap opens the three cities; London starts him on London's runway, still, ready to go
    L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) frame();
    tap(document.getElementById("globeBtn"));
    o.screen = vis("screenGlobe"); o.cards = document.querySelectorAll("#screenGlobe .cityCard").length; o.menuOpen = L.menuOpen();
    tap(document.querySelector('#screenGlobe .cityCard[data-city="ldn"]'));
    for (let i = 0; i < 10; i++) frame();
    const ap = L.AIRPORTS[2];
    o.ldn = { origin: st.originIdx, dest: st.destIdx, onRunway: Math.abs(st.x) < 5 && Math.abs(st.z - ap.cz) < 720, phase: st.phase, speed: st.speed, screen: vis("screenGlobe"), start: localStorage.getItem("lp.start") };
    // the same globe takes him back to New York
    tap(document.getElementById("globeBtn")); tap(document.querySelector('#screenGlobe .cityCard[data-city="ny"]'));
    o.ny = { origin: st.originIdx, nearNY: Math.abs(st.z - L.AIRPORTS[0].cz) < 720, start: localStorage.getItem("lp.start") };
    // a relaunch with a London start: the world behind the picker is London, and the picker is on the VEHICLES
    localStorage.setItem("lp.vehicle", "prop"); localStorage.setItem("lp.dir", "0"); localStorage.setItem("lp.start", "ldn");
    L.lpRestoreChoice();
    o.relaunch = { origin: st.originIdx, vehicles: vis("screenVehicle"), dir: vis("screenDir"), globe: vis("screenGlobe"), dest: vis("screenDest") };
    // ... and a vehicle that cannot start there yet starts where it always did
    localStorage.setItem("lp.vehicle", "car"); L.lpRestoreChoice();
    o.carRelaunch = st.originIdx;
    L.api.skipScreens(); localStorage.clear();
    return o;
  });
  check("london start: the globe and its screen carry no text", globe.text === "", JSON.stringify(globe.text));
  check("london start: parked, the globe is up for what flies from a runway (planes, the helicopter) and for nothing else; never in flight; never two buttons in a slot",
    ["prop", "airlinerDelta", "fighter", "helicopter"].every(v => globe.shows[v]) && ["car", "speedboat", "rocket", "monster"].every(v => !globe.shows[v]) && !globe.inFlight && globe.clash.length === 0,
    JSON.stringify({ shows: globe.shows, inFlight: globe.inFlight, clash: globe.clash }));
  check("london start: the globe opens three cities and the way back; London starts him parked on London's runway, bound for New York",
    globe.screen && globe.menuOpen && globe.cards === 4 && globe.ldn.origin === 2 && globe.ldn.dest === 0 && globe.ldn.onRunway && globe.ldn.phase === "TAXI" && globe.ldn.speed === 0 && !globe.ldn.screen && globe.ldn.start === "ldn" &&
    globe.ny.origin === 0 && globe.ny.nearNY && globe.ny.start === null, JSON.stringify(globe));
  check("london start: a relaunch after a London start puts the world back in London and opens on the vehicle picker; a car starts where it always did",
    globe.relaunch.origin === 2 && globe.relaunch.vehicles && !globe.relaunch.dir && !globe.relaunch.globe && !globe.relaunch.dest && globe.carRelaunch !== 2, JSON.stringify(globe.relaunch));

  // the globe never sits on another button: it is DRAWN where it is, whatever the slot table says
  // (on a short landscape screen it first sat on the helicopter's up button, and a finger meant
  // for "up" sent him to London)
  const overlaps = [];
  for (const [w, h] of [[1024, 768], [844, 390], [390, 844], [1180, 820]]) {
    const { page: p2 } = await newPage(w, h);
    overlaps.push(...await p2.evaluate(([w, h]) => {
      const L = window.__lp, out = [];
      L.noRender = true; L.api.skipScreens();
      for (const [v, at] of [["prop", 0], ["airlinerEmirates", 0], ["fighter", 2], ["helicopter", 0], ["helicopter", 2], ["prop", 2]]) {
        L.api.setVehicle(v); L.api.spawnAt(at, 0);
        for (let i = 0; i < 20; i++) { L.update(1 / 60); L.btnUpdateAll(); }
        const g = document.getElementById("globeBtn");
        if (g.classList.contains("hidden")) { out.push(`${w}x${h} ${v}: no globe`); continue; }
        const a = g.getBoundingClientRect();
        if (a.right > innerWidth || a.bottom > innerHeight || a.left < 0 || a.top < 0) out.push(`${w}x${h} ${v}: off the screen`);
        for (const id of Object.keys(L.BUTTONS)) {
          const e = document.getElementById(id);
          if (!e || id === "globeBtn" || e.classList.contains("hidden") || getComputedStyle(e).display === "none") continue;
          const b = e.getBoundingClientRect();
          if (b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${w}x${h} ${v}: on ${id}`);
        }
      }
      return out;
    }, [w, h]));
    await p2.close();
  }
  check("london start: the globe is on the screen and on no other button -- every plane and the helicopter, landscape and portrait, phone and iPad", overlaps.length === 0, JSON.stringify(overlaps));

  // ---- the London airport: off for New York, and in, hands-off -------------------------------
  const fly = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE, ap = L.AIRPORTS[2], o = {};
    L.api.setVehicle("prop"); L.ldStart();
    // the take-off roll and the climb: held throttle, a gentle pull, away toward New York
    L.api.setThrottle(true);
    for (let i = 0; i < 60 * 30 && st.phase !== "AIRBORNE"; i++) { L.api.setStick(0, st.speed > T.rotateSpeed ? 0.6 : 0); L.update(1 / 60); }
    L.api.setThrottle(false);
    const z0 = st.z;
    for (let i = 0; i < 60 * 10; i++) { L.api.setStick(0, 0.2); L.update(1 / 60); }
    L.api.clearStick();
    o.off = { phase: st.phase, south: st.z < z0 - 400, dest: st.destIdx, bang: st.exploding };
    // in from the sea, on London's slope: the gentle nose-down every landing check uses
    L.api.spawnAt(0, 1);
    const d = T.ringStartDistance + 70, th = ap.cz - T.runwayLength / 2;
    st.phase = "AIRBORNE"; st.x = 0; st.z = th - d; st.y = ap.elev + 3 + d * T.glideSlope; st.heading = Math.PI; st.pitch = 0; st.bank = 0;
    st.speed = T.approachSpeed; st.airVy = null; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false;
    L.api.setStick(0, -0.18);
    let landed = false, bang = false, at = null, why = null;
    const boom = window.triggerExplosion;
    window.triggerExplosion = function (...a) { why = why || [Math.round(st.z), Math.round(st.y), Math.round(L.terrainEff(st.x, st.z)), (new Error().stack || "").split("\n").slice(2, 4).map(s => s.trim().replace(/\(.*\/js\//, "(")).join(" < ")]; return boom.apply(this, a); };
    for (let i = 0; i < 60 * 60; i++) {
      L.update(1 / 60);
      if (st.exploding) { bang = true; break; }
      if (st.phase === "LANDED" && !landed) { landed = true; at = st.landedIdx === undefined ? st.approachIdx : st.landedIdx; L.api.clearStick(); }
      if (landed && st.phase === "TAXI") break;
    }
    window.triggerExplosion = boom;
    o.land = { landed, bang, why, at, approachIdx: st.approachIdx, originAfter: st.originIdx, destAfter: st.destIdx };
    // from New York, out over the sea: turned toward Britain, London is where he is going (its rings
    // with it); turned back, New York -- and his controls are never touched
    L.api.spawnAt(0, 0);
    st.phase = "AIRBORNE"; st.x = 0; st.z = 9000; st.y = 150; st.speed = 60; st.pitch = 0; st.bank = 0;
    st.heading = Math.PI; L.api.setStick(0.3, -0.2);
    const flip = () => { const c0 = [st.ctrlBank, st.ctrlPitch, st.heading, st.bank]; L.update(1 / 60); return [st.ctrlBank, st.ctrlPitch].every((v, i) => v === c0[i]); };
    const kept1 = flip();
    const ringZ = L.ringsGroup.position.z;
    o.toLondon = { dest: st.destIdx, rings: Math.abs(ringZ - (ap.cz - T.runwayLength / 2)) < 1 };
    // the same frame with and without the flip turns him identically: only the HUD changed
    const turnOf = (dest) => { st.heading = 0.2; st.bank = 0; st.destIdx = dest; st.dirIdx = dest === 2 ? 1 : 0; st.z = 9000; st.x = 0; st.y = 150; L.api.setStick(0.3, -0.2); L.update(1 / 60); return +st.heading.toFixed(6); };
    st.heading = 0; L.update(1 / 60);
    o.back = { dest: st.destIdx, kept: kept1 };
    o.sameTurn = turnOf(2) === turnOf(0);
    L.api.clearStick();
    L.api.clearStick();
    return o;
  });
  check("london airport: he takes off from London on a held finger, south toward New York, without a bang", fly.off.phase === "AIRBORNE" && fly.off.south && fly.off.dest === 0 && !fly.off.bang, JSON.stringify(fly.off));
  check("london airport: a plane on London's glide slope lands there, celebrates, and comes back to start from London", fly.land.landed && !fly.land.bang && fly.land.originAfter === 2 && fly.land.destAfter === 0, JSON.stringify(fly.land));
  check("london airport: out over the sea, flying toward Britain makes London the destination (its rings waiting), and turning back makes it New York again",
    fly.toLondon.dest === 2 && fly.toLondon.rings && fly.back.dest === 0 && fly.back.kept && fly.sameTurn, JSON.stringify({ toLondon: fly.toLondon, back: fly.back, sameTurn: fly.sameTurn }));

  // the crash warning sounds before a landmark, as it does before any building: flying at Big Ben
  const warn = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE, [bx, bz] = T.london.at.bigBen;
    L.api.setVehicle("prop"); L.api.spawnAt(2, 0); L.api.clearStick();
    st.phase = "AIRBORNE"; st.x = bx; st.z = bz - 400; st.y = L.terrainEff(bx, bz) + 50; st.heading = Math.PI; st.pitch = 0; st.bank = 0; st.speed = 60;
    st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.alarmOn = false;
    let warnedAt = null, bangAt = null;
    for (let i = 0; i < 60 * 10 && bangAt === null; i++) {
      st.x = bx; st.heading = Math.PI; st.pitch = 0; L.update(1 / 60);
      if (st.alarmOn && warnedAt === null) warnedAt = Math.round(bz - st.z);
      if (st.exploding) bangAt = Math.round(bz - st.z);
    }
    return { warnedAt, bangAt };
  });
  check("london: the crash warning sounds before he flies into Big Ben, as before any building (and the bang comes, free, where it happened)",
    warn.warnedAt !== null && warn.bangAt !== null && warn.warnedAt > warn.bangAt + 30, JSON.stringify(warn));

  // ---- nothing in New York or California moved ----------------------------------------------
  const same = await page.evaluate(() => {
    const L = window.__lp, o = {};
    // v196's ground at points he knows, to the fourth decimal
    const v196 = [[0, 4000, 3.9509], [-500, 4100, 8.437], [300, -5000, 2.0796], [0, 6500, 7.9935], [-900, 6585, 0.2421], [200, 7800, -8.4211]];
    o.ground = v196.map(([x, z, y]) => +(L.terrainEff(x, z) - y).toFixed(4));
    o.airports = L.AIRPORTS.slice(0, 2).map(a => [a.cz, +a.elev.toFixed(2)]);
    // a question asked in New York walks none of London's solids
    let n = 0, total = 0;
    L.forEachSolid(() => total++);
    L.forEachSolid(() => n++, -400, 4100, 10);
    o.walk = { ny: n, all: total, region: L.ldn.region.list.length };
    // London's own clocks never draw from the page's random stream
    const R = Math.random; let draws = 0;
    Math.random = function () { if (/london\.js/.test(new Error().stack)) draws++; return R(); };
    L.api.setVehicle("prop"); L.api.spawnAt(2, 0);
    for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
    Math.random = R;
    o.draws = draws;
    return o;
  });
  check("london leaves New York and California alone: their ground is v196's to the millimetre and their runways are where they were",
    same.ground.every(d => d === 0) && same.airports[0][0] === 6000 && same.airports[0][1] === 7.99 && same.airports[1][0] === -6000 && same.airports[1][1] === 7.69, JSON.stringify(same));
  check("london leaves New York alone: a solid question asked there walks none of London's records, and London never draws from the page's random stream",
    same.walk.ny === same.walk.all - same.walk.region && same.walk.region > 100 && same.draws === 0, JSON.stringify(same));

  await page.close();
  if (perf !== "skip") await perfBlock();
};
