// ---------------------------------------------------------------------------
// Stage 1 of BOATS: the harbour and the speedboat.
//
// Behavioural, not existence checks. The first audit of this codebase found a
// train that had never rendered and "shelved" vehicles that were still tappable,
// all under a green harness that only asked whether things existed -- so nothing
// in here is satisfied by a thing being present. The boat has to actually get
// out of the harbour, actually leave the water off the ramp, actually come back
// off the beach on its own, and the cannon has to actually shrink the fire.
// ---------------------------------------------------------------------------
const path = require("path");

module.exports = async function boatChecks({ newPage, check, shots }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  // ---- the harbour is built, and it is built where the terrain says ---------
  const built = await page.evaluate(() => {
    const L = window.__lp, HB = L.HB, W = L.TUNE.waterLevel;
    const wet = (x, z) => L.terrainEff(x, z) < W;
    return {
      built: L.harbor.built,
      cranes: L.harbor.cranes.length,
      buoyPairs: L.harbor.buoys.map(b => b.pts.length),
      solids: L.harbor.solids.length,
      // the shape of the place: basin wet, spit dry, mouth wet, sea wet
      basinWet: wet(HB.cx, -6300),
      spitDry: !wet(700, -6745) && !wet(1800, -6745),
      mouthWet: wet(HB.cx, -6745),
      seaWet: wet(HB.cx, -7300),
      // ... and the basin does NOT leak out round the ends of the spit
      leakW: wet(500, -6745), leakE: wet(2100, -6745),
      // the gulls are scenery: never solid, never shatterable, never a target
      gullsSafe: !!(L.harbor.gulls && L.harbor.gulls.mesh.userData.noSolid && L.harbor.gulls.mesh.userData.noShatter),
      gullSolid: L.harbor.solids.some(b => b.mesh === L.harbor.gulls.mesh),
    };
  });
  check("harbour: a real basin behind a barrier spit -- the terrain is wet in the basin, the mouth and the sea, dry along the spit, and does not leak round either end of it",
    built.built && built.basinWet && built.spitDry && built.mouthWet && built.seaWet &&
    !built.leakW && !built.leakE && built.cranes === 2 && built.buoyPairs[0] > 8 && built.solids > 25,
    JSON.stringify(built));
  check("harbour: the gulls are scenery under the birds' rule -- not solid, not shatterable, and in no solid list",
    built.gullsSafe && !built.gullSolid, JSON.stringify({ safe: built.gullsSafe, inSolids: built.gullSolid }));

  // ---- one finger from the marina reaches the buoy channel ------------------
  const run = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    const start = { x: st.x, z: st.z, water: L.boatOnWater() };
    let throughMouth = false, best = 1e9;
    // The CLOSEST he ever came to the channel, not where he happened to be when
    // the clock stopped: he crosses it and carries on, so the final distance
    // measures how long the test ran rather than whether he got there.
    for (let i = 0; i < 60 * 45; i++) {
      L.api.setStick(0, 0);
      L.update(1 / 60);
      if (!throughMouth && st.z < L.HB.mouth.z[0]) throughMouth = true;
      if (throughMouth) for (const p of L.HB.buoys.path) best = Math.min(best, Math.hypot(st.x - p[0], st.z - p[1]));
    }
    L.api.clearStick();
    return { start, throughMouth, toChannel: Math.round(best), water: L.boatOnWater(),
             crashes: L.flags.boatCrashes || 0, speed: +st.speed.toFixed(1) };
  });
  check("boat: a finger held down from the marina clears the harbour mouth on its own and reaches the buoy channel, without hitting anything",
    run.start.water && run.throughMouth && run.toChannel < 150 && run.water && run.crashes === 0,
    JSON.stringify(run));

  // ---- the jump ramp -------------------------------------------------------
  const jump = await page.evaluate(() => {
    const L = window.__lp, st = L.state, r = L.harbor.ramp;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = r.x - r.fx * 130; st.z = r.z - r.fz * 130;
    st.y = L.TUNE.waterLevel; st.heading = Math.atan2(-r.fx, -r.fz); st.speed = 40;
    L.boat.air = 0; L.boat.rampCool = 0;
    let peak = -1e9, airFrames = 0, wasAir = false, floatedOnLanding = null;
    for (let i = 0; i < 60 * 14; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (L.boat.air > 0) { airFrames++; wasAir = true; peak = Math.max(peak, st.y); }
      // whether it FLOATS WHEN IT LANDS, not whether it happens to be over water
      // fourteen seconds later still driving flat out away from the ramp
      else if (wasAir && floatedOnLanding === null) floatedOnLanding = L.boatOnWater();
    }
    L.api.clearStick();
    return { jumps: L.flags.boatJumps || 0, landings: L.flags.boatJumpLandings || 0,
             airFrames, peak: +(peak - L.TUNE.waterLevel).toFixed(1), floatedOnLanding };
  });
  check("boat: hitting the floating ramp at speed launches it clear of the water and it comes down and floats again",
    jump.jumps >= 1 && jump.landings >= 1 && jump.airFrames > 30 && jump.peak > 4 && jump.floatedOnLanding === true,
    JSON.stringify(jump));

  // ---- never stuck ---------------------------------------------------------
  const beach = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    // A hundred metres up the north shore, with nothing between him and the
    // water. No ring near him finds any, so the search has to widen -- which is
    // the thing being tested. (The case where a quay stands in the way is the
    // separate check below; that one is the backstop's job, not the search's.)
    st.x = 1500; st.z = -5930; st.y = L.TUNE.waterLevel; st.speed = 0;
    L.boat.beach = 0;
    const dry = !L.boatOnWater();
    let back = null;
    for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); if (back === null && L.boatOnWater()) back = +(i / 60).toFixed(2); }
    return { dry, back, refloats: L.flags.boatRefloats || 0, x: Math.round(st.x), water: L.boatOnWater() };
  });
  check("boat: NEVER STUCK -- a hull driven a hundred metres up the beach is back in the water inside three seconds, with nothing to press",
    beach.dry && beach.back !== null && beach.back < 3 && beach.water, JSON.stringify(beach));

  // The standoff that actually happened: beached on the LANDWARD side of the
  // marina wall, the refloat pushed him at water he could see straight through
  // the quay, and the hull collision pushed him back out again, for ever.
  const trapped = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = 2015; st.z = -6300; st.y = L.TUNE.waterLevel; st.speed = 0;
    L.boat.beach = 0;
    let back = null;
    for (let i = 0; i < 60 * 10; i++) { L.update(1 / 60); if (back === null && L.boatOnWater()) back = +(i / 60).toFixed(2); }
    return { back, refloats: L.flags.boatRefloats || 0, water: L.boatOnWater(), x: Math.round(st.x) };
  });
  check("boat: NEVER STUCK -- wedged between the beach and a solid quay, where the way to the water runs straight through the quay, it takes itself home rather than sitting there",
    trapped.back !== null && trapped.back < 7 && trapped.water, JSON.stringify(trapped));

  // ---- the water cannon ----------------------------------------------------
  const cannon = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.FF.rig;
    const btn = document.getElementById("cannonBtn");
    L.fireReset();
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    L.update(1 / 60);
    const atMarina = !btn.classList.contains("hidden");
    // in the helicopter, over the same water, it must not exist either
    L.api.setVehicle("helicopter");
    st.phase = "AIRBORNE"; st.x = F.x; st.z = F.z + 120; st.y = L.TUNE.waterLevel + 20;
    L.update(1 / 60);
    const inHeli = !btn.classList.contains("hidden");
    // and in the boat, alongside, it does
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = F.x; st.z = F.z + 70; st.y = L.TUNE.waterLevel; st.speed = 0;
    st.heading = Math.atan2(-(F.x - st.x), -(F.z - st.z));
    L.update(1 / 60);
    const nearRig = !btn.classList.contains("hidden");
    const before = L.fire.level;
    // pointing AWAY from it puts no water on it, however long he holds
    st.heading += Math.PI;
    L.boatCannonPress(true);
    for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); st.x = F.x; st.z = F.z + 70; st.speed = 0; }
    const wrongWay = L.fire.level;
    // pointing at it does
    st.heading = Math.atan2(-(F.x - st.x), -(F.z - st.z));
    for (let i = 0; i < 60 * 12; i++) { L.update(1 / 60); st.x = F.x; st.z = F.z + 70; st.speed = 0; }
    L.boatCannonPress(false);
    const after = L.fire.level;
    L.update(1 / 60);
    const stillUp = !btn.classList.contains("hidden");
    return { atMarina, inHeli, nearRig, before, wrongWay, after,
             sheets: L.flags.boatCannonSheets || 0, stillUp };
  });
  check("boat: the water cannon exists only in the boat and only near the rig -- and it is POINTING, not timing: held away from the fire it does nothing, held at it the flames shrink to nothing",
    !cannon.atMarina && !cannon.inHeli && cannon.nearRig &&
    cannon.wrongWay === cannon.before && cannon.after === 0 && cannon.sheets >= 3,
    JSON.stringify(cannon));

  // ---- crashing is free ----------------------------------------------------
  const crash = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.HB.terminal.ship;
    L.fireReset();
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = S.x; st.z = S.z - 150; st.y = L.TUNE.waterLevel; st.heading = Math.PI; st.speed = 40;
    let exploded = false;
    for (let i = 0; i < 60 * 12; i++) { L.api.setStick(0, 0); L.update(1 / 60); if (st.exploding) exploded = true; }
    L.api.clearStick();
    return { exploded, crashes: L.flags.boatCrashes || 0, reassembles: L.flags.boatReassembles || 0,
             water: L.boatOnWater(), x: Math.round(st.x), z: Math.round(st.z),
             // it must come back near where it hit, not at the last aeroplane's safePos
             nearShip: Math.hypot(st.x - S.x, st.z - S.z) < 400 };
  });
  check("boat: full speed into the container ship explodes and reassembles on the water where it hit, for free",
    crash.exploded && crash.reassembles >= 1 && crash.water && crash.nearShip, JSON.stringify(crash));

  // ---- both views ----------------------------------------------------------
  const views = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.speed = 14;
    L.api.setView(true); L.update(1 / 60);
    const chase = { model: !!(L.vehicleModel && L.vehicleModel.visible), helm: !!(L.boat.helm && L.boat.helm.visible) };
    L.api.setView(false); L.update(1 / 60);
    const helmWheel = L.boat.helmWheel ? L.boat.helmWheel.rotation.z : null;
    L.api.setStick(1, 0);
    for (let i = 0; i < 40; i++) { L.update(1 / 60); st.speed = 14; }
    L.api.clearStick();
    const turned = L.boat.helmWheel ? L.boat.helmWheel.rotation.z : null;
    const inside = { model: !!(L.vehicleModel && L.vehicleModel.visible), helm: !!(L.boat.helm && L.boat.helm.visible) };
    // the helm must not be left standing in the world when he changes vehicle
    L.api.setVehicle("prop");
    const stowed = !(L.boat.helm && L.boat.helm.visible);
    return { chase, inside, helmWheel, turned, stowed, imported: L.modelState.speedboat };
  });
  check("boat: two views -- chase shows the hull and no helm, the helm view shows the helm and no hull, its wheel turns with the stick, and the helm is stowed when he changes vehicle",
    views.chase.model && !views.chase.helm && !views.inside.model && views.inside.helm &&
    Math.abs(views.turned - views.helmWheel) > 0.1 && views.stowed, JSON.stringify(views));

  // ---- zero text, with the whole port in frame -----------------------------
  const text = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    st.x = L.HB.cx; st.z = -6320; st.heading = Math.PI * 0.75;
    L.api.setView(true);
    for (let i = 0; i < 60; i++) L.update(1 / 60);
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
  check("boat: zero text with the terminal, the cranes, the container stacks and the marina all in frame",
    text.bad.length === 0, JSON.stringify(text));

  // ---- the button slots, in every state a boat can be in -------------------
  const slots = await page.evaluate(() => {
    const L = window.__lp, st = L.state;
    const overlaps = () => {
      const btns = [...document.querySelectorAll(".roundBtn")].filter(b => {
        const cs = getComputedStyle(b);
        return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
      });
      const bad = [];
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (!r.width) continue;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const owner = hit && hit.closest(".roundBtn");
        if (owner && owner !== b) bad.push(b.id + " under " + owner.id);
      }
      return bad;
    };
    const out = [];
    const at = (name, setup) => {
      setup();
      for (let i = 0; i < 12; i++) L.update(1 / 60);
      const bad = overlaps();
      if (bad.length) out.push({ name, bad });
    };
    at("boat in the marina", () => { L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); });
    at("boat at the rig with the cannon up", () => {
      L.fireReset();
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      const F = L.FF.rig;
      st.x = F.x; st.z = F.z + 70; st.y = L.TUNE.waterLevel; st.speed = 0;
    });
    at("boat off the ramp", () => {
      const r = L.harbor.ramp;
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      st.x = r.x - r.fx * 60; st.z = r.z - r.fz * 60; st.heading = Math.atan2(-r.fx, -r.fz); st.speed = 40;
      L.boat.rampCool = 0;
    });
    return out;
  });
  check("boat: no two visible buttons ever land in the same slot in the boat -- in the marina, at the rig with the cannon up, and off the ramp",
    slots.length === 0, JSON.stringify(slots));

  await page.screenshot({ path: path.join(shots, "boat-harbour.png") });
  await page.close();

  // ---- frame time at the busiest place in the port -------------------------
  // Interleaved A/B, never in blocks: sampling A three times then B three times
  // lets machine drift land on one side, and it once priced a layer at +19% that
  // interleaved sampling showed to be free.
  {
    const { page } = await newPage(1180, 820);
    const perf = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
      const place = (terminal) => {
        if (terminal) { st.x = 1100; st.z = -6420; st.heading = Math.PI * 0.85; }
        else { st.x = 1300; st.z = -12000; st.heading = 0; }   // open sea, nothing built
        st.y = L.TUNE.waterLevel; st.speed = 0;
      };
      // A/B the HARBOUR ITSELF, from the same spot, by hiding it -- and
      // INTERLEAVED, never in blocks. Sampling A five times then B five times
      // lets machine drift land on one side of the comparison; it once priced a
      // layer at +19% that interleaved sampling showed to be free. Comparing the
      // terminal against a patch of open sea measured the terrain instead: out
      // there almost no ground chunks are drawn at all.
      const sample = (on) => {
        L.harbor.g.visible = on;
        place(true);
        for (let i = 0; i < 30; i++) { L.update(1 / 60); L.harbor.g.visible = on; }
        const t0 = performance.now();
        for (let i = 0; i < 50; i++) { L.update(1 / 60); L.harbor.g.visible = on; L.renderer.render(L.scene, L.camera); }
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
    const addedCalls = perf.calls - perf.callsWithout;
    check("harbour: the whole port -- terminal, cranes, ship, container stacks, marina, bridge and buoys -- costs a bounded number of extra draw calls at the busiest place in it (SwiftShader: read calls/tris as the hardware proxy, cpuMs only as a bound)",
      addedCalls < 90 && perf.withMs < 220, JSON.stringify({ ...perf, addedCalls }));
    console.log(`INFO  harbour perf: ${perf.withMs} ms with the port vs ${perf.withoutMs} ms without, +${addedCalls} draw calls (${perf.calls} vs ${perf.callsWithout}), +${(perf.tris - perf.trisWithout).toLocaleString()} triangles (swiftshader, interleaved)`);
    await page.close();
  }
};
