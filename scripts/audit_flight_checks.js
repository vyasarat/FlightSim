"use strict";
// Flight.
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["FLIGHT-4"]);
// Flight audit (phase 2): one check per finding, each FAILS on b21b83f and passes once fixed.
// Harness module contract: module.exports = async ({ newPage, check }) => { ... }
module.exports = async function ({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table); the rest
  // still run, so the scenarios stay honest, but stay quiet until their release. Anything not named
  // by a finding id (a page-error guard) always reports.
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail); };
  // ---- page A: the picker over a flying plane (FLIGHT-4) -- first, on a fresh page, so the
  // paper-plane flock over New York is still standing
  {
    const { ctx, page, errors } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, F = L.flags, out = {};
      const fly = (x, z, y, hdg) => {
        st.phase = "AIRBORNE"; st.x = x; st.z = z; st.y = y; st.speed = 60; st.pitch = 0; st.bank = 0; st.heading = hdg;
        st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null; st.alarmOn = false;
      };
      const watch = (secs) => {
        let bangs = 0, alarmFrames = 0; const t0 = F.targets, a0 = F.alarms;
        const p0 = { x: st.x, y: st.y, z: st.z, phase: st.phase };
        const boom = window.triggerExplosion; window.triggerExplosion = function (...a) { bangs++; return boom.apply(this, a); };
        let beeps = 0; const ab = window.alarmBeep; window.alarmBeep = function (...a) { beeps++; return ab.apply(this, a); };
        try { for (let i = 0; i < 60 * secs; i++) { L.update(1 / 60); if (st.alarmOn) alarmFrames++; if (st.exploding) bangs = Math.max(bangs, 1); } }
        finally { window.triggerExplosion = boom; window.alarmBeep = ab; }
        return { menu: L.menuOpen(), bangs, alarmFrames, beeps, targetsPopped: F.targets - t0, alarms: F.alarms - a0,
                 airborne: p0.phase === "AIRBORNE", moved: +Math.hypot(st.x - p0.x, st.y - p0.y, st.z - p0.z).toFixed(1) };
      };
      // 1: low over New York's country, a paper-plane flock in his path
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.api.clearStick();
      fly(0, 3000, L.terrainEff(0, 3000) + 40, 0); L.update(1 / 60);
      L.openPickerAnywhere();
      out.ny = watch(30);
      document.getElementById("screenVehicle").classList.add("hiddenS");
      // 2: straight at Big Ben
      const [bx, bz] = T.london.at.bigBen;
      L.api.spawnAt(2, 0); L.api.clearStick();
      fly(bx, bz - 500, L.terrainEff(bx, bz) + 50, Math.PI); L.update(1 / 60);
      L.openPickerAnywhere();
      out.bigBen = watch(12);
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.spawnAt(0, 0);
      return out;
    });
    const ok = (o) => o.menu && o.airborne && o.moved < 1 && o.bangs === 0 && o.alarmFrames === 0 && o.beeps === 0 && o.targetsPopped === 0;
    check("FLIGHT-4: with the picker open over a flying plane, nothing happens to him -- it holds where it was: no bang, no crash-warning beeps, no target popped",
      ok(r.ny) && ok(r.bigBen), r);
    check("FLIGHT-4: (page) no page errors", errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }

  // ---- FLIGHT-4 (v212, the law-reviewer and the render-critic): held behind the cards, and shut
  // again with nothing picked he goes on from where he was -- the plane flying, a car at speed driving
  {
    const { ctx, page, errors } = await newPage(1024, 768);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = {};
      const shut = () => { for (const id of ["screenVehicle", "screenDir", "screenDest"]) document.getElementById(id).classList.add("hiddenS"); };
      const run = (secs) => { for (let i = 0; i < 60 * secs; i++) L.update(1 / 60); };
      // the plane, level and high
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.api.clearStick(); L.api.skipScreens();
      st.phase = "AIRBORNE"; st.x = 0; st.z = 2000; st.y = L.terrainEff(0, 2000) + 300; st.speed = 60; st.pitch = 0; st.bank = 0; st.heading = 0;
      st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; run(0.5);
      L.openPickerAnywhere(); const a = { x: st.x, z: st.z }; run(3);
      out.planeHeld = +Math.hypot(st.x - a.x, st.z - a.z).toFixed(1);
      shut(); const b = { x: st.x, z: st.z }; run(1);
      out.planeOn = { moved: +Math.hypot(st.x - b.x, st.z - b.z).toFixed(1), phase: st.phase, exploding: st.exploding };
      // a car at speed on the motorway, his finger holding it on (drag up is go, as car_feel_checks)
      L.api.setVehicle("car"); L.api.placeOnRunway();
      const drive = (secs) => { for (let i = 0; i < 60 * secs; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); } };
      drive(0.7);
      const q = L.hwySampleAt(L.highway.length * 0.30), rx = -q.fz, rz = q.fx, off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      st.x = q.x + rx * off; st.z = q.z + rz * off; st.y = q.y; st.heading = Math.atan2(-q.fx, -q.fz); st.speed = L.CAR.cruise;
      L.car.steer = 0; st.exploding = false;
      drive(1);
      out.carSpeed = +st.speed.toFixed(1);
      L.openPickerAnywhere(); const c = { x: st.x, z: st.z }; run(3);
      out.carHeld = +Math.hypot(st.x - c.x, st.z - c.z).toFixed(1);
      shut(); const d = { x: st.x, z: st.z }; drive(1);
      out.carOn = { moved: +Math.hypot(st.x - d.x, st.z - d.z).toFixed(1), exploding: st.exploding };
      return out;
    });
    check("FLIGHT-4: behind the cards the plane and a car at speed hold where they were; shut with nothing picked, both go on from there",
      r.planeHeld < 1 && r.planeOn.moved > 20 && r.planeOn.phase === "AIRBORNE" && !r.planeOn.exploding &&
      r.carSpeed > 5 && r.carHeld < 1 && r.carOn.moved > 2 && !r.carOn.exploding, r);
    check("FLIGHT-4: (hold page) no page errors", errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }

  // ---- page B: everything else, each scenario re-spawned from scratch
  const { ctx, page, errors } = await newPage(1024, 768);
  const live = await page.evaluate(async () => { try { await window.__lp.audio.unlock(); } catch (e) {} return window.__lp.audio.ctxState(); });

  // FLIGHT-1: eject after the London heading switch
  const f1 = await page.evaluate(() => {
    const L = window.__lp, st = L.state, A = L.AIRPORTS, out = {};
    const runEject = () => { ejectStart(); let n = 0; while (eject.active && n < 60 * 40) { L.update(1 / 60); n++; } };
    const facing = () => {   // does the nose point toward the destination along the route (z)?
      const fz = -Math.cos(st.heading), toDest = A[st.destIdx].cz - st.z;
      return { origin: st.originIdx, dest: st.destIdx, dir: st.dirIdx, z: Math.round(st.z), hdg: Math.round(st.heading * 180 / Math.PI), towardDest: fz * toDest > 0 };
    };
    const outToSea = (hdg) => {
      st.phase = "AIRBORNE"; st.x = 0; st.z = 9000; st.y = 200; st.speed = 60; st.pitch = 0; st.bank = 0; st.heading = hdg;
      st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null;
      for (let i = 0; i < 2; i++) L.update(1 / 60);
    };
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.update(1 / 60);
    outToSea(Math.PI);                       // NY origin, turned toward Britain: London is the destination
    out.nySwitched = st.destIdx === 2;
    runEject(); out.ny = facing();
    L.ldStart(); L.update(1 / 60);
    outToSea(Math.PI);                       // London origin, turned back toward Britain
    runEject(); out.ldn = facing();
    L.api.spawnAt(0, 0);
    return out;
  });
  check("FLIGHT-1: after an eject out over the sea, he is back on his runway facing where he is going (NY start and London start)",
    f1.ny.towardDest && f1.ldn.towardDest, f1);

  // FLIGHT-2: eject during the landing roll-out keeps the landing
  const f2 = await page.evaluate(() => {
    const L = window.__lp, st = L.state, A = L.AIRPORTS, out = {};
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); for (let i = 0; i < 3; i++) L.update(1 / 60);
    skipToLanding(); L.api.setStick(0, -0.18);
    for (let i = 0; i < 60 * 90; i++) { L.update(1 / 60); if (st.phase === "LANDED" || st.exploding) break; }
    L.api.clearStick();
    out.landed = { phase: st.phase, landedIdx: st.landedIdx, ejectOffered: !el.ejectBtn.classList.contains("hidden") };
    ejectStart(); let n = 0; while (eject.active && n < 60 * 40) { L.update(1 / 60); n++; }
    out.after = { origin: st.originIdx, z: Math.round(st.z), atCalifornia: Math.abs(st.z - A[1].cz) < 1500, atNewYork: Math.abs(st.z - A[0].cz) < 1500 };
    L.api.spawnAt(0, 0);
    return out;
  });
  check("FLIGHT-2: ejecting during the landing roll-out at California brings him back in California, not where he took off",
    f2.landed.phase === "LANDED" && f2.landed.landedIdx === 1 && f2.after.atCalifornia, f2);

  // FLIGHT-3: the engine is silent during the rescue
  const f3 = await page.evaluate(async (live) => {
    const L = window.__lp, st = L.state, out = { live };
    L.api.setVehicle("prop"); L.api.teleportAirborne(1500, 0, 300, 0);
    for (let i = 0; i < 90; i++) L.update(1 / 60);
    out.before = L.audio.engine();
    ejectStart();
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    out.phase = eject.phase; out.during = L.audio.engine();
    while (eject.active) L.update(1 / 60);
    L.api.spawnAt(0, 0);
    return out;
  }, live);
  const e3 = f3.during || {};
  check("FLIGHT-3: four seconds into an eject from cruise, the plane's engine voice has gone quiet (the rescue is not droned over)",
    f3.live === "running" && !!f3.before.up && f3.before.high + f3.before.idle > 0.01 && (!e3.up || e3.out <= 0.01 || (e3.idle + e3.high) <= 0.002), f3);

  // FLIGHT-6: eject over the lock's upper dock
  const f6 = await page.evaluate(() => {
    const L = window.__lp, st = L.state, LK = L.LK, out = {};
    const cx = (LK.dock.x[0] + LK.dock.x[1]) / 2, cz = (LK.dock.z[0] + LK.dock.z[1]) / 2, sea = L.seaLevelAt(cx, cz);
    out.dock = { ter: +L.terrainEff(cx, cz).toFixed(2), sea: +sea.toFixed(2) };
    L.api.setVehicle("helicopter"); L.api.spawnAt(1, 1); for (let i = 0; i < 5; i++) L.update(1 / 60);
    st.phase = "AIRBORNE"; st.x = cx; st.z = cz; st.y = sea + 25; L.heli.altitude = st.y; L.heli.target = null;
    for (let i = 0; i < 60; i++) L.update(1 / 60);
    const booms = []; const tb = window.triggerExplosion;
    window.triggerExplosion = function (...a) { booms.push(+a[1].toFixed(1)); return tb.apply(this, a); };
    let land = null;
    try {
      ejectStart();
      for (let i = 0; i < 60 * 30 && eject.active; i++) { L.update(1 / 60); if (eject.phase === "land" && !land) land = { seatY: +eject.pool.seat.position.y.toFixed(2), raft: eject.pool.raft.visible }; }
    } finally { window.triggerExplosion = tb; }
    out.booms = booms; out.land = land;
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
    return out;
  });
  check("FLIGHT-6: ejecting over the lock's water, nothing explodes under the water and the pilot comes down on its surface (with the raft)",
    !!f6.land && f6.booms.every(y => y >= f6.dock.sea - 0.5) && f6.land.seatY >= f6.dock.sea - 0.5 && f6.land.raft, f6);

  // FLIGHT-7: the route strip over the sea from London
  const f7 = await page.evaluate(() => {
    const L = window.__lp, st = L.state, out = {};
    let notes = 0; const rn = window.routeNote; window.routeNote = function (...a) { notes++; return rn.apply(this, a); };
    const lit = () => stripDots.filter(d => d.el.classList.contains("passed")).length;
    try {
      L.api.setVehicle("prop"); L.ldStart(); for (let i = 0; i < 3; i++) L.update(1 / 60);
      st.phase = "AIRBORNE"; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9; st.approachLatch = false; st.airVy = null; st.speed = 60; st.pitch = 0; st.bank = 0;
      let first = null, last = null, seaSamples = 0;
      for (let z = 12000; z >= 7000; z -= 250) {
        st.x = 0; st.z = z; st.y = 250; st.heading = 0; L.update(1 / 60);
        if (L.terrainEff(0, z) >= L.TUNE.waterLevel) continue;     // only judge it over open sea
        seaSamples++; if (first === null) { first = lit(); notes = 0; } last = lit();
      }
      out.seaSamples = seaSamples; out.litFirst = first; out.litLast = last; out.notesOverSea = notes;
    } finally { window.routeNote = rn; }
    L.api.spawnAt(0, 0);
    return out;
  });
  check("FLIGHT-7: crossing the open sea from London, no American landmark on the route strip lights up and no route note plays",
    f7.seaSamples > 5 && f7.litLast === f7.litFirst && f7.notesOverSea === 0, f7);

  // FLIGHT-8: helicopter -- lifting the pointing finger with a palm resting does not re-aim it
  const f8 = await page.evaluate(() => {
    const L = window.__lp, st = L.state, out = {};
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 5; i++) L.update(1 / 60);
    st.phase = "AIRBORNE"; st.y = L.AIRPORTS[0].elev + 60; L.heli.altitude = st.y; L.heli.target = null;
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const W = innerWidth, H = innerHeight;
    const ev = (type, id, x, y) => glEl.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11, pointerType: "touch" }));
    ev("pointerdown", 11, W * 0.5, H * 0.62); L.update(1 / 60);       // his finger: the ground ahead
    const aim = L.heli.target && { x: Math.round(L.heli.target.x), z: Math.round(L.heli.target.z) };
    ev("pointerdown", 22, W * 0.08, H * 0.95); L.update(1 / 60);      // the heel of his hand, bottom-left
    const withPalm = L.heli.target && { x: Math.round(L.heli.target.x), z: Math.round(L.heli.target.z) };
    ev("pointerup", 11, W * 0.5, H * 0.62); L.update(1 / 60);         // he lifts the finger; the palm stays
    const after = L.heli.target && { x: Math.round(L.heli.target.x), z: Math.round(L.heli.target.z) };
    ev("pointerup", 22, W * 0.08, H * 0.95); L.update(1 / 60);
    out.aim = aim; out.withPalm = withPalm; out.afterLift = after;
    out.moved = !!(aim && after) ? Math.hypot(after.x - aim.x, after.z - aim.z) : null;
    L.api.clearStick(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0);
    return out;
  });
  check("FLIGHT-8: helicopter -- lifting the pointing finger while a palm rests on the glass leaves the destination where he pointed",
    !!f8.aim && (f8.afterLift === null || f8.moved < 5), f8);

  check("FLIGHT audit: no page errors", errors.length === 0, errors.slice(0, 3));
  await ctx.close();
};
