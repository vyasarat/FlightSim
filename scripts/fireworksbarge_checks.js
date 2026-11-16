"use strict";
// ---------------------------------------------------------------------------
// THE FIREWORKS BARGE (v135), watched the way he will watch it.
//
//   1. the site: afloat in deep water, out of the road's corridor and out of the
//      target boats' orbit, solid;
//   2. southbound hands-off: 3-2-1, then the whole show (every shell launched,
//      every one bursts, a finale of 20+ bursts inside a second and a half), then
//      armed again -- the car never bangs, touches anything or leaves the road;
//   3. no star, trail spark or shell ever comes within the road's corridor;
//   4. the first burst and the finale are ON his screen, portrait, both cameras,
//      both directions;
//   5. away from it, nothing; the plane and the helicopter set it off; flown
//      into, the barge is a bang;
//   6. it shares the numeral: it waits for another count, and stands down for
//      the picker;
//   7. the frame: draw calls bounded;
//   8. (v226, B6) the numeral has an owner: Q-7 by touch, the go arrow, the police's
//      peel-off, the dunes grid, the menu, the rule and the source; (v227) a count he is taken away
//      from stands down (h), the kept missile dropped (i), a race asked for or left with a count up
//      (l), the separation of the counts that never ask (k), and the refused path, a row each (j).
//      (v228) a count he comes at is never cut (m), a missile in flight at the go arrow (n); (v229) a count he
//      turns away from at once is never cut either (o); (v230) B6 done: the source names every count still written
//      by hand, and every point-and-count set-piece is on the one step (g).
// Renders are scripts/fireworksbarge_renders.js, and are LOOKED at.
// ---------------------------------------------------------------------------

module.exports = async function fireworksBargeChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);

  // ---- 1. the site
  const site = await page.evaluate(() => {
    const L = window.__lp, T = L.TUNE.fireworksBarge;
    L.noRender = true; L.api.skipScreens();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    let shallow = 0, inRoad = 0;
    for (let i = -1; i <= 1; i += 0.25) for (let j = -1; j <= 1; j += 0.25) {
      const x = T.x + i * T.hullW / 2, z = T.z + j * T.hullL / 2;
      if (L.terrainEff(x, z) > L.seaLevelAt(x, z) - T.hullH) shallow++;
      if (L.hwyCorridorDist(x, z) < L.HW.clearHalf) inRoad++;
    }
    // the lake's target boats: their orbit's closest pass to the hull
    let orbitGap = 1e9;
    for (const t of L.targets) if (t.kind === "boat" && t.orbitX) {
      for (let a = 0; a < Math.PI * 2; a += 0.01) {
        const bx = t.cx + Math.cos(a) * t.orbitX, bz = t.cz + Math.sin(a) * t.orbitZ;
        orbitGap = Math.min(orbitGap, Math.max(Math.abs(bx - T.x) - T.hullW / 2, Math.abs(bz - T.z) - T.hullL / 2));
      }
    }
    let ours = 0; L.forEachSolid(b => { if (b.fb) ours++; });
    return { shallow, inRoad, orbitGap: Math.round(orbitGap), ours, phase: L.fbarge.phase };
  });
  check(`fireworks barge: afloat in deep water, out of the road's corridor and clear of the lake boats' orbit, solid`,
    site.shallow === 0 && site.inRoad === 0 && site.orbitGap > 25 && site.ours === 1 && site.phase === "armed", site);

  // ---- 2 + 3. southbound, hands-off
  const run = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge;
    L.fbReset(); L.spdReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const q = L.hwySampleAt(L.hwyNearest(T.x, T.z + 2200).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    const big = document.getElementById("bigNum");
    const nums = []; let last = "", inRoad = 0, samples = 0, offRoad = 0, maxSparks = 0, finale = 0, burstTimes = [], f = 0, armedAgain = false;
    for (; f < 60 * 120; f++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (st.exploding) break;
      const n = big.classList.contains("on") ? big.textContent : "";
      if (n && n !== last) nums.push(n);
      last = n;
      if (L.hwyCorridorDist(st.x, st.z) > 30) offRoad++;
      const b = d("fbBursts");
      if (burstTimes.length < b) for (let k = burstTimes.length; k < b; k++) burstTimes.push(f / 60);
      maxSparks = Math.max(maxSparks, F.spN);
      if (f % 3 === 0) for (const p of L.fbSparksLive()) { samples++; if (L.hwyCorridorDist(p.x, p.z) < L.HW.clearHalf) inRoad++; }
      if (d("fbRests") > 0 && F.phase === "armed") { armedAgain = true; break; }
    }
    for (const t of burstTimes) finale = Math.max(finale, burstTimes.filter(u => u >= t && u < t + 1.5).length);
    return { countdowns: d("fbCountdowns"), shows: d("fbShows"), shells: d("fbShells"), bursts: d("fbBursts"), nums: nums.join(""),
             finale, maxSparks, armedAgain, secs: Math.round(f / 60), inRoad, samples, offRoad,
             crashes: d("carCrashes"), walls: d("wallHits"), touches: d("hwyTrafficHit"),
             volleyShells: T.volleys.reduce((a, v) => a + v[1], 0) };
  });
  check(`fireworks barge: southbound hands-off, 3-2-1 and the show goes -- every shell launched, every one bursts, a finale of 20+ bursts inside a second and a half`,
    run.countdowns === 1 && run.shows === 1 && run.nums === "321" && run.shells === run.volleyShells && run.bursts === run.shells && run.finale >= 20, run);
  check(`fireworks barge: then it rests and is armed again; the car never bangs, touches anything or leaves the road`,
    run.armedAgain && run.crashes === 0 && run.walls === 0 && run.touches === 0 && run.offRoad === 0, run);
  check(`fireworks barge: no star, spark or shell ever comes within the road's corridor (${run.samples} samples)`,
    run.samples > 2000 && run.inRoad === 0, { samples: run.samples, inRoad: run.inRoad, maxSparks: run.maxSparks });

  // ---- 4. on his screen: the first burst and the finale, portrait, both cameras, both ways
  for (const [w, h] of [[820, 1180]]) {
    const { page: pg } = await newPage(w, h);
    const r = await pg.evaluate(() => {
      const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge;
      L.noRender = true; L.api.skipScreens();
      const out = [];
      for (const north of [false, true]) for (const chase of [false, true]) {
        L.fbReset(); L.spdReset();
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.api.setView(chase);
        const q = L.hwySampleAt(L.hwyNearest(T.x, north ? T.z - 2200 : T.z + 2200).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        const b0 = L.flags.fbBursts || 0;
        const seen = { dir: north ? "N" : "S", cam: chase ? "chase" : "seat", first: null, finale: null };
        for (let f = 0; f < 60 * 90 && !seen.finale; f++) {
          L.api.setStick(0, 0); L.update(1 / 60);
          const b = (L.flags.fbBursts || 0) - b0;
          const shot = () => { L.camera.updateMatrixWorld(); const v = new L.camera.position.constructor(F.lastBurst.x, F.lastBurst.y, F.lastBurst.z).project(L.camera);
                               return { x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, front: v.z < 1 }; };
          if (b >= 1 && !seen.first) seen.first = shot();
          if (b >= 30 && !seen.finale) seen.finale = shot();
        }
        out.push(seen);
      }
      L.fbReset();
      return out;
    });
    await pg.context().close();
    // inside the windscreen: clear of the pillars and the button columns (|x| < 0.65), above the dash
    const on = o => o && o.front && Math.abs(o.x) < 0.65 && o.y > -0.1 && o.y < 0.6;
    check(`fireworks barge: at ${w}x${h}, both ways, both cameras, the first burst and the finale are on his screen`,
      r.length === 4 && r.every(o => on(o.first) && on(o.finale)), r);
  }

  // ---- 4b. at every speed step, southbound, the first burst is on his screen
  const steps = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge, out = [];
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const n = L.spdStepsFor(L.spdKey()).length;
    for (let step = 0; step < n; step++) {
      L.fbReset(); L.lsReset(); L.sledReset(); if (L.policeStop) L.policeStop(); L.setBigNum(null);
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      st.speedStep = step;
      const q = L.hwySampleAt(L.hwyNearest(T.x, T.z + 2600).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
      const b0 = L.flags.fbBursts || 0; let seen = null;
      for (let f = 0; f < 60 * 120 && !seen; f++) {
        L.api.setStick(0, 0); L.update(1 / 60);
        if ((L.flags.fbBursts || 0) > b0) { L.camera.updateMatrixWorld(); const v = new L.camera.position.constructor(F.lastBurst.x, F.lastBurst.y, F.lastBurst.z).project(L.camera);
          seen = { step, v: Math.round(st.speed), x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, front: v.z < 1 }; }
      }
      out.push(seen || { step, missed: true });
    }
    L.spdReset(); L.fbReset();
    return out;
  });
  check(`fireworks barge: at every speed step the first burst is in his windscreen`,
    steps.length >= 4 && steps.every(o => !o.missed && o.front && Math.abs(o.x) < 0.65 && o.y > -0.1 && o.y < 0.6), steps);

  // ---- 5. away from it; the plane and the helicopter; the barge is solid
  const more = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge;
    const out = {};
    // southbound, already past it
    L.fbReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const q = L.hwySampleAt(L.hwyNearest(T.x, T.z - 150).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
    let c0 = L.flags.fbCountdowns || 0, minD = 1e9;
    for (let f = 0; f < 60 * 20; f++) { L.api.setStick(0, 0); L.update(1 / 60); minD = Math.min(minD, Math.hypot(st.x - T.x, st.z - T.z)); }
    out.away = { countdowns: (L.flags.fbCountdowns || 0) - c0, minD: Math.round(minD) };
    // the drive above may have run a red and been pulled over: that is the car's, not this test's
    // ... and driving on south it reaches the launch pad, which counts on the shared numeral
    if (L.policeStop) L.policeStop(); L.lsReset(); L.sledReset(); L.setBigNum(null);
    // the plane, nose at it
    L.fbReset();
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    const put = (x, y, z, hx, hz) => { st.phase = "AIRBORNE"; st.exploding = false; st.engaged = false; st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-hx, -hz); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.gearDown = false; };
    const px = T.x - 600, pz = T.z - 800;
    c0 = L.flags.fbCountdowns || 0;
    for (let f = 0; f < 60 * 2; f++) { put(px, 220, pz, T.x - px, T.z - pz); L.update(1 / 60); }
    out.plane = (L.flags.fbCountdowns || 0) - c0;
    // the helicopter, nose at it -- and then flown into it at cruise
    L.fbReset();
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    c0 = L.flags.fbCountdowns || 0;
    const hx = T.x - 600, hz = T.z - 300;
    for (let f = 0; f < 60 * 2; f++) { st.phase = "AIRBORNE"; st.x = hx; st.y = 80; st.z = hz; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = 80; L.heli.target = null; st.heading = Math.atan2(-(T.x - hx), -(T.z - hz)); L.update(1 / 60); }
    out.heli = (L.flags.fbCountdowns || 0) - c0;
    // the helicopter at cruise into its side, level with the racks (a plane that
    // low over the water would be a splash before it was a bang)
    L.fbReset();
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const armR = T.armR;
    try {
      T.armR = 0;
      const sy = F.y + T.deck + 2.5;
      st.phase = "AIRBORNE"; st.exploding = false; st.x = T.x; st.y = sy; st.z = T.z + 120; st.heading = 0;
      L.heli.altitude = sy; L.heli.vx = 0; L.heli.vy = 0; L.heli.vz = -L.TUNE.heli.cruise; L.heli.speed = L.TUNE.heli.cruise; L.heli.target = { x: T.x, y: sy, z: T.z - 200 };
      let hit = null;
      for (let i = 0; i < 60 * 5 && !hit; i++) { L.update(1 / 60); if (st.exploding) hit = { dz: Math.round(st.z - T.z), dx: Math.round(st.x - T.x) }; }
      out.solid = hit;
    } finally { T.armR = armR; }
    L.fbReset();
    return out;
  });
  check(`fireworks barge: driving away from it, inside its range, nothing happens -- it is something he points at`,
    more.away.countdowns === 0 && more.away.minD < 900, more.away);
  check(`fireworks barge: the plane and the helicopter, nose at it, set it off`, more.plane === 1 && more.heli === 1, more);
  check(`fireworks barge: the barge is solid -- flown into, a bang, at the barge`,
    !!more.solid && Math.abs(more.solid.dx) < 12 && more.solid.dz > 0 && more.solid.dz < 35, more.solid);

  // ---- 6. the numeral is shared
  const share = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge;
    const out = {};
    L.fbReset(); if (L.sledReset) L.sledReset();
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    const px = T.x - 600, pz = T.z - 800;
    const hold = () => { st.phase = "AIRBORNE"; st.exploding = false; st.x = px; st.y = 220; st.z = pz; st.heading = Math.atan2(-(T.x - px), -(T.z - pz)); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
    // (v228) the other count is the monster truck's, 0.7 km from here: the sled (4.4 km off) is out of its drawn
    // distance from the barge, and since v228 a count out of sight stands down (spCountStep's `away`) -- it was
    // over before the barge could be asked to wait for it
    L.mtReset(); L.mtForce();
    const c0 = L.flags.fbCountdowns || 0, r0 = L.flags.mtRuns || 0;
    let during = 0, after = null;
    for (let i = 0; i < 60 * 8; i++) {
      hold(); L.update(1 / 60);
      if (L.mtruck.phase === "count" && (L.flags.fbCountdowns || 0) > c0) during++;
      if (after === null && L.mtruck.phase !== "count" && (L.flags.fbCountdowns || 0) > c0) after = Math.round(i / 6) / 10;
    }
    out.wait = { during, after, otherRan: (L.flags.mtRuns || 0) - r0 };
    L.mtReset();
    // the picker mid-count
    L.fbReset(); if (L.sledReset) L.sledReset();
    L.fbForce();
    for (let i = 0; i < 30; i++) { hold(); L.update(1 / 60); }
    const up = document.getElementById("bigNum").classList.contains("on");
    const s0 = L.flags.fbStandDowns || 0;
    L.openPickerAnywhere(); L.update(1 / 60);
    const bn = document.getElementById("bigNum");
    out.picker = { up, menu: L.menuOpen(), standDowns: (L.flags.fbStandDowns || 0) - s0, numOn: bn.classList.contains("on"), sky: bn.classList.contains("sky"), phase: F.phase };
    L.api.skipScreens();
    // a pull-over mid-count
    L.fbReset(); L.fbForce();
    for (let i = 0; i < 30; i++) { hold(); L.update(1 / 60); }
    const s1 = L.flags.fbStandDowns || 0;
    for (let i = 0; i < 5; i++) { L.police.active = true; L.police.state = "pullover"; hold(); L.update(1 / 60); }
    L.police.active = false; L.police.state = "away";
    out.police = { standDowns: (L.flags.fbStandDowns || 0) - s1, numOn: document.getElementById("bigNum").classList.contains("on"), phase: F.phase };
    // the other way: the sled and the launch pad wait while the barge counts
    L.fbReset(); L.setBigNum(null); L.fbForce();
    L.update(1 / 60);
    // ask each, as its own start does, while the barge is counting
    out.others = { barge: F.phase };
    out.others.sledBusy = L.spCountBusy("rocketSled"); out.others.lsBusy = L.spCountBusy("launchSite");
    L.fbReset(); L.setBigNum(null);
    return out;
  });
  check(`fireworks barge: a police pull-over mid-count stands it down and the numeral goes`,
    share.police.standDowns === 1 && !share.police.numOn && share.police.phase === "armed", share.police);
  check(`fireworks barge: while it counts, the rocket sled and the launch pad are told to wait`,
    share.others.barge === "count" && share.others.sledBusy && share.others.lsBusy, share.others);
  check(`fireworks barge: pointed at, it waits while another set-piece's numeral is up, and goes once it is down`,
    share.wait.during === 0 && share.wait.after !== null && share.wait.otherRan === 1, share.wait);
  check(`fireworks barge: the picker opened mid-count stands it down and the numeral goes with it`,
    share.picker.up && share.picker.menu && share.picker.standDowns === 1 && !share.picker.numOn && !share.picker.sky && share.picker.phase === "armed", share.picker);

  // ---- 7. the frame
  const cost = await page.evaluate(() => {
    const L = window.__lp, st = L.state, F = L.fbarge, T = L.TUNE.fireworksBarge;
    L.fbReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const q = L.hwySampleAt(L.hwyNearest(T.x, T.z + 800).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-(T.x - st.x), -(T.z - st.z)); };
    const objs = () => [F.g, F.reticle, F.sparks, F.shellPts, ...F.flashes.map(f => f.s)];
    const calls = () => { L.renderer.render(L.scene, L.camera); return L.renderer.info.render.calls; };
    const frame = () => {
      hold(); L.noRender = false; L.update(1 / 60); L.noRender = true;
      const all = calls(), was = objs().map(o => o.visible);
      objs().forEach(o => { o.visible = false; });
      const without = calls();
      objs().forEach((o, i) => { o.visible = was[i]; });
      return all - without;
    };
    // (v230) three counts its draw calls itself (renderer.info, in JS): the GL draws are left out while it counts.
    // Drawn for real, these ~360 frames handed SwiftShader's GPU process some 80 s of rasterising, and the next page
    // this module opened waited behind it to load (measured: its first numIn page took 82 s, the rest 2.7 s). The
    // counts are three's own and come out the same either way.
    const gl = L.renderer.getContext(), NO = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"], keep = NO.map(n => gl[n]);
    NO.forEach(n => { gl[n] = () => {}; });
    try {
      for (let i = 0; i < 20; i++) frame();
      const idle = frame();
      L.fbForce();
      let worst = 0;
      for (let i = 0; i < 60 * 20; i++) { if (i % 12 === 0) worst = Math.max(worst, frame()); else { hold(); L.update(1 / 60); } }
      L.fbReset();
      return { idle, worst };
    } finally { NO.forEach((n, i) => { gl[n] = keep[i]; }); }
  });
  check(`fireworks barge: it costs at most 15 draw calls standing and 30 through the finale (${cost.idle}, ${cost.worst})`,
    cost.idle > 0 && cost.idle <= 15 && cost.worst <= 30, cost);
  // ---- 8. (v226, B6) the numeral has an owner: whoever puts it up holds it, only the holder writes it or takes it
  // down, the first keeps it and a newcomer waits. Portrait, a fresh page each, by touch where he can do it:
  //   a. Q-7: flying the route south over the demolition with the barge a kilometre on, the barge's 3-2-1 starts and
  //      a missile from its button sets the block off -- the barge's count, then the block's, never both, never two
  //      ticks a frame, and the block goes (its missile kept, not lost) -- in the prop and the helicopter;
  //   b. the go arrow mid-demolition-count: its numeral does not stay on his screen;
  //   c. let go by the police (the peel-off), the barge he is stopped pointing at counts, and the end of the
  //      peel-off (policeStop) does not take its count down for a frame (the barge's clock staged: harness);
  //   d. the dunes race's grid: the race's own 3-2-1 and nothing over it; the rocket sled waits for the green;
  //   e. the menu (v223's `police` row): with no chase, a set-piece's count goes by its own stand-down, as before
  //      v223; in a chase, the same -- the police row takes down nothing it does not own; in a pull-over, its count
  //      goes with the police, at the press;
  //   f. the rule, in the page: a second owner refused (no digit, no tick, no class), the start's clear of all;
  //   g. the source: every write names its owner; the bare write and the clear of all are where they are said to be.
  const NUM_RIG = `
    const L = window.__lp, st = L.state; L.noRender = true; L.api.skipScreens();
    const press = (e) => e && e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
    const tap = (e) => { press(e); e && e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 })); };
    const SCREENS = ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"];
    const closeScreens = () => { for (const id of SCREENS) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); } };
    const bn = el.bigNum;
    // what he sees and hears of the numeral, frame by frame: its digit (or -), ^ up in the sky, r the race's place; ticks a frame
    const tr = { frames: [], ticks: 0 };
    const sb = window.synthBlip; window.synthBlip = function (ty, f0) { if (ty === "triangle" && f0 === 520) tr.ticks++; return sb.apply(this, arguments); };
    const unTrace = () => { window.synthBlip = sb; };
    const snap = (tag) => { tr.frames.push({ k: (bn.classList.contains("on") ? bn.textContent : "-") + (bn.classList.contains("sky") ? "^" : "") + (bn.classList.contains("race") ? "r" : ""), ticks: tr.ticks, tag: tag || "" }); tr.ticks = 0; };
    const step = (n, fn, tag) => { for (let i = 0; i < n; i++) { if (fn && fn(i) === false) return i; L.update(1 / 60); snap(typeof tag === "function" ? tag() : tag); } return n; };
    const seen = (from) => { const o = []; let last = null, n = 0; for (const f of tr.frames.slice(from || 0)) { if (f.k === last) n++; else { if (last !== null) o.push(last + "x" + n); last = f.k; n = 1; } } if (last !== null) o.push(last + "x" + n); return o.join(" "); };
    const maxTicks = (from) => tr.frames.slice(from || 0).reduce((m, f) => Math.max(m, f.ticks), 0);
    const sumTicks = (from, to) => tr.frames.slice(from || 0, to).reduce((m, f) => m + f.ticks, 0);
    const planeAt = (x, z, agl, hdg) => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); st.x = x; st.z = z; st.y = L.terrainEff(x, z) + agl; st.heading = hdg; st.pitch = 0; st.bank = 0; L.api.clearStick(); };
    // the motorway north of the barge, d m from it, him on it facing the barge's way, stopped
    const roadAt = (d) => {
      let best = null;
      for (let s = 0; s < highway.length; s += 20) { const q = hwySampleAt(s); const e = Math.hypot(q.x - FBARGE.x, q.z - FBARGE.z); if (q.z > FBARGE.z && Math.abs(e - d) < 150 && (!best || Math.abs(e - d) < Math.abs(best.e - d))) best = { s, e, q }; }
      const q = best.q; st.x = q.x - q.fz * 3; st.z = q.z + q.fx * 3; st.y = q.y;
      const dir = ((FBARGE.x - st.x) * q.fx + (FBARGE.z - st.z) * q.fz) >= 0 ? 1 : -1;
      st.heading = Math.atan2(-q.fx * dir, -q.fz * dir); st.speed = 0;
      return Math.round(best.e);
    };
    const d = (k, f0) => (L.flags[k] || 0) - (f0[k] || 0);`;
  const numIn = async (body, arg) => {
    const { page: np } = await newPage(820, 1180);
    const r = await np.evaluate(new Function("arg", `return (async () => { ${NUM_RIG}
      const out = {};
      try { ${body} } catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
      finally { unTrace(); }
      return out; })();`), arg).catch(e => ({ err: String(e && e.message || e).slice(0, 300) }));
    await np.close();
    return r;
  };
  // a. Q-7, the prop and the helicopter
  const q7 = {};
  for (const who of ["prop", "helicopter"]) {
    q7[who] = await numIn(`
      const f0 = Object.assign({}, L.flags);
      if (arg === "prop") { planeAt(300, 3500, 80, 0); }
      else { L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10); st.x = 300; st.z = 3020; st.y = L.terrainEff(300, 3020) + 60; st.heading = 0; st.speed = 0; heli.vertical = 0; }
      out.kind = vehKind();
      let fired = -1, fbAt = -1, dmAt = -1, fbEnd = -1;
      const tag = () => "fb:" + fbarge.phase + " dm:" + demo.phase;
      step(60 * 20, (i) => {
        if (fbAt < 0 && fbarge.phase === "count") fbAt = i;
        if (fired < 0 && fbarge.phase === "count" && bn.classList.contains("on")) { out.missileBtn = !el.missileBtn.classList.contains("hidden"); press(el.missileBtn); fired = i; }
        if (fbAt >= 0 && fbEnd < 0 && fbarge.phase !== "count") fbEnd = i;
        if (dmAt < 0 && demo.phase === "charging") dmAt = i;
        if (arg === "prop") { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 70); st.pitch = 0; }
      }, tag);
      Object.assign(out, { fired, fbAt, fbEnd, dmAt, seen: seen(), maxTicks: maxTicks(), ticks: sumTicks(),
        flags: { missiles: d("missiles", f0), fbShows: d("fbShows", f0), demolitions: d("demolitions", f0), folded: d("demoTowersFolded", f0), refused: d("numRefused", f0) } });
    `, who);
  }
  const q7bad = [];
  for (const [who, r] of Object.entries(q7)) {
    if (r.err || !(r.fired >= 0) || !r.missileBtn || !(r.flags.missiles >= 1) || r.flags.fbShows !== 1) { q7bad.push(`${who}: not the barge's count with a missile from its button into the block (${JSON.stringify(r)})`); continue; }
    if (r.maxTicks > 1) q7bad.push(`${who}: ${r.maxTicks} ticks in one frame (two counts on the one numeral)`);
    if (!(r.dmAt >= r.fbEnd && r.fbEnd > 0)) q7bad.push(`${who}: the block's count began at frame ${r.dmAt}, before the barge's ended at ${r.fbEnd}`);
    if (!/^-x\d+ 3\^x(5[89]|6[01]) 2\^x(59|60|61) 1\^x(59|60|61) (-x\d+ )?3x(59|60|61) 2x(59|60|61) 1x(59|60|61) -x\d+$/.test(r.seen)) q7bad.push(`${who}: not the barge's 3-2-1 up in the sky and then the block's 3-2-1, each digit a second (${r.seen})`);
    if (r.ticks !== 6) q7bad.push(`${who}: ${r.ticks} ticks, not six (three a count)`);
    if (r.flags.demolitions !== 1 || r.flags.folded < 7) q7bad.push(`${who}: the block did not go (its missile lost): ${JSON.stringify(r.flags)}`);
  }
  check("numeral (B6, Q-7): flying the route south over the demolition, the fireworks barge a kilometre on starts its 3-2-1, and a missile from its button sets the block off -- the barge's count up in the sky, then the block's, never both, never two ticks a frame, six ticks in all, and the block goes all the way down (its missile kept, never lost); in the prop and the helicopter, portrait",
    q7bad.length === 0, JSON.stringify({ bad: q7bad, prop: q7.prop && { seen: q7.prop.seen, fired: q7.prop.fired, fbEnd: q7.prop.fbEnd, dmAt: q7.prop.dmAt, flags: q7.prop.flags }, helicopter: q7.helicopter && { seen: q7.helicopter.seen, fired: q7.helicopter.fired, fbEnd: q7.helicopter.fbEnd, dmAt: q7.helicopter.dmAt, flags: q7.helicopter.flags } }));
  // b. the go arrow mid-demolition-count (flying north, away from the barge: the block behind... no, ahead)
  const skip = await numIn(`
    const f0 = Object.assign({}, L.flags);
    planeAt(300, 2150, 80, Math.PI);   // south of the block, nose north at it: the barge behind him
    let fired = -1, at = -1;
    step(60 * 6, (i) => {
      if (fired < 0) { press(el.missileBtn); fired = i; }
      if (demo.phase === "charging" && bn.classList.contains("on") && at < 0) { out.skipBtn = !el.skipBtn.classList.contains("hidden"); out.numAt = bn.textContent; press(el.skipBtn); at = i; return false; }
      L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 70); st.pitch = 0;
    });
    const n0 = tr.frames.length;
    step(60 * 10, () => { L.api.clearStick(); });
    const after = tr.frames.slice(n0);
    out.upAfter = after.filter(f => f.k[0] !== "-").length; out.firstDown = after.findIndex(f => f.k[0] === "-") + 1;
    Object.assign(out, { at, kind: vehKind(), z: Math.round(st.z), dm: demo.phase, seen: seen(n0), demolitions: d("demolitions", f0) });
  `);
  check("numeral (B6): the go arrow pressed mid-demolition-count (by touch, the prop) -- its numeral does not stay on his screen with nothing counting: down within half a second of the go arrow (as soon as the block is out of sight), and down for the 10 s after, the block re-armed",
    !skip.err && skip.at >= 0 && skip.skipBtn && skip.demolitions === 1 && skip.firstDown >= 1 && skip.firstDown <= 30 && skip.upAfter < 30 && skip.upAfter === skip.firstDown - 1 && skip.dm === "armed",
    JSON.stringify(skip));
  // c. the police let him go; the barge he is stopped pointing at counts; the peel-off ends
  const pol = await numIn(`
    const f0 = Object.assign({}, L.flags);
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
    out.dist = roadAt(750);
    // the barge is mid-show when he is caught (staged: its clock), so it can be armed only once the pull-over is on
    fbarge.phase = "rest"; fbarge.t = -1e6;
    step(20, () => L.api.setStick(0, 0));
    L.policeStart(null); step(60 * 2, () => L.api.setStick(0, 0)); L.api.clearStick();
    step(60 * 25, () => { L.api.clearStick(); if (police.state === "pullover") return false; });
    fbarge.phase = "armed";                       // re-armed: it waits for the pull-over's numeral
    const n0 = tr.frames.length;
    let fbAt = -1, endAt = -1;
    step(60 * 14, (i) => { L.api.clearStick(); if (fbAt < 0 && fbarge.phase === "count") fbAt = i; if (endAt < 0 && fbAt >= 0 && !police.active) endAt = i; }, () => "fb:" + fbarge.phase + " pl:" + (police.active ? police.state : "-"));
    const tags = []; let lt = null; tr.frames.slice(n0).forEach((f, i) => { if (f.tag !== lt) { tags.push(i + ":" + f.tag); lt = f.tag; } });
    Object.assign(out, { fbAt, endAt, seen: seen(n0), tags, ticks: sumTicks(n0), maxTicks: maxTicks(n0), ended: d("policeEnded", f0), counts: d("fbCountdowns", f0), shows: d("fbShows", f0) });
  `);
  check("numeral (B6): let go by the police (the pull-over's 3-2-1, then the peel-off), the barge he is stopped pointing at down the motorway counts its 3-2-1 -- and the end of the peel-off (policeStop) does not take the barge's count down: the police's 3-2-1, then the barge's, each digit unbroken, one tick a digit (the barge's clock staged so it re-arms during the pull-over; portrait)",
    !pol.err && pol.ended === 1 && pol.counts === 1 && pol.shows === 1 && pol.endAt > pol.fbAt && pol.fbAt > 0 && pol.ticks === 6 && pol.maxTicks === 1 &&
      /^-x\d+ 3x(5[89]|6[01]) 2x(59|60|61) 1x(59|60|61) -x\d+ 3\^x(5[89]|6[01]) 2\^x(59|60|61) 1\^x(59|60|61) -x\d+$/.test(pol.seen),
    JSON.stringify(pol));
  // d. the dunes race's grid, started by touch
  const grid = await numIn(`
    const f0 = Object.assign({}, L.flags);
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(30, () => L.api.setStick(0, 0)); L.api.clearStick(); step(10);
    out.raceBtn = !el.raceBtn.classList.contains("hidden");
    press(el.raceBtn); step(10);
    const card = document.querySelector('.trackCard[data-track="dunes"]');
    out.card = !!card; tap(card);
    out.on = L.raceOn(); { const T = L.RC.tracks.find(t => t.id === "dunes"); out.track = Math.hypot(st.x - T.site.x, st.z - T.site.z) < 300 ? "dunes" : Math.round(st.x) + "," + Math.round(st.z); }
    const n0 = tr.frames.length;
    let goAt = -1, sledAt = -1;
    let sledRunAt = -1; const r0 = d("sledRuns", f0);
    step(60 * 20, (i) => { L.api.setStick(0, 0); if (goAt < 0 && L.race.phase === "race") goAt = i; if (sledAt < 0 && sled.phase === "count") sledAt = i; if (sledRunAt < 0 && d("sledRuns", f0) > r0) sledRunAt = i; }, () => L.race.phase);
    const g = tr.frames.slice(n0, n0 + Math.max(0, goAt));
    out.gridSeen = (() => { const o = []; let last = null, n = 0; for (const f of g) { if (f.k === last) n++; else { if (last !== null) o.push(last + "x" + n); last = f.k; n = 1; } } if (last !== null) o.push(last + "x" + n); return o.join(" "); })();
    Object.assign(out, { goAt, sledAt, gridTicks: g.reduce((m, f) => m + f.ticks, 0), gridMax: g.reduce((m, f) => Math.max(m, f.ticks), 0), after: seen(n0 + Math.max(0, goAt)).slice(0, 120), sledCounts: d("sledCountdowns", f0), sledRunAt, sledRuns: d("sledRuns", f0) });
  `);
  check("numeral (B6): the dunes race, by its button and its card -- the grid's 3-2-1 is the race's own (under the lamps, nothing up in the sky, one tick a lamp: three), and the rocket sled, whose wall is 900 m off the grid's nose, waits for the green instead of counting over the lamps -- and (v227, Q-30 c) after the green, hands-off, it DOES count and run",
    !grid.err && grid.raceBtn && grid.card && grid.on && grid.track === "dunes" && grid.goAt > 0 && /^(-r?x\d+ )*3rx\d+ 2rx\d+ 1rx\d+( -x\d+)?$/.test(grid.gridSeen) && grid.gridTicks === 3 && grid.gridMax === 1 &&
      grid.sledAt >= grid.goAt && grid.sledRunAt > grid.sledAt && grid.sledCounts >= 1 && grid.sledRuns >= 1,
    JSON.stringify(grid));
  // e. the menu: no chase, a chase, a pull-over
  const menu = await numIn(`
    const res = {};
    const barge = () => { for (let i = 0; i < 60 * 30 && !(fbarge.phase === "count" && bn.classList.contains("on")); i++) { L.api.setStick(0, 0); L.update(1 / 60); } return fbarge.phase === "count" && bn.classList.contains("on"); };
    const atMenu = (name) => {
      const f0 = Object.assign({}, L.flags);
      const r = res[name] = { before: bn.textContent, beforeOn: bn.classList.contains("on"), police: police.active ? police.state : "-" };
      L.api.clearStick(); press(el.menuBtn);
      r.menu = L.menuOpen(); r.atPress = bn.classList.contains("on") ? bn.textContent : "-";
      L.update(1 / 60); r.next = bn.classList.contains("on") ? bn.textContent : "-";
      step(60 * 2); r.behind = bn.classList.contains("on") ? bn.textContent : "-";
      r.standDowns = d("fbStandDowns", f0); r.ended = d("policeEnded", f0);
      L.api.skipScreens(); closeScreens();
    };
    // no chase: the barge counting as he drives at it
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); roadAt(700); res.noChaseUp = barge(); atMenu("noChase");
    // a chase (not a pull-over): the same
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); L.fbReset(); roadAt(1600); st.speed = 20; L.policeStart(null); res.chaseUp = barge(); atMenu("chase");
    // a pull-over's count
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(30, () => L.api.setStick(0, 0)); L.policeStart(null); step(60 * 3, () => L.api.setStick(0, 0)); L.api.clearStick();
    for (let i = 0; i < 60 * 25 && !(police.state === "pullover" && bn.classList.contains("on")); i++) L.update(1 / 60);
    atMenu("pullover");
    Object.assign(out, res);
  `);
  const mb = [];
  if (menu.err) mb.push(menu.err);
  const mn = menu.noChase || {}, mc = menu.chase || {}, mp = menu.pullover || {};
  if (!menu.noChaseUp || !mn.menu || mn.atPress === "-" || mn.next !== "-" || mn.behind !== "-" || mn.standDowns !== 1) mb.push(`no chase: the barge's count not gone by its own stand-down on the next frame (${JSON.stringify(mn)})`);
  if (!menu.chaseUp || mc.police !== "chase" || !mc.menu || mc.atPress === "-" || mc.next !== "-" || mc.behind !== "-" || mc.standDowns !== 1 || mc.ended !== 1) mb.push(`a chase: the police row took the barge's count down at the press, or it did not go by its own stand-down (${JSON.stringify(mc)})`);
  if (mp.police !== "pullover" || !/^[1-3]$/.test(mp.before) || !mp.menu || mp.atPress !== "-" || mp.ended !== 1) mb.push(`a pull-over: its count not gone with the police at the press (${JSON.stringify(mp)})`);
  check("numeral (B6, v223's `police` row): the menu by touch -- with no chase, the barge's count stays up through the press and goes on the next frame by its own stand-down, as it did before v223; in a chase, exactly the same (the police row ends the chase and takes down nothing it does not own); in a pull-over, its 3-2-1 goes with the police at the press",
    mb.length === 0, JSON.stringify({ bad: mb, noChase: mn, chase: mc, pullover: mp }));
  // f. the rule, in the page
  const rule = await numIn(`
    const f0 = Object.assign({}, L.flags);
    countdownEndAll(); tr.ticks = 0;
    const r = {};
    r.a = countdownTo(2.5, 3, "ownerA"); r.aTicks = tr.ticks; tr.ticks = 0;
    r.b = countdownTo(1.2, 3, "ownerB"); r.bTicks = tr.ticks; r.textB = bn.textContent;
    el.bigNum.classList.remove("sky");
    r.bBlocked = countdownBlocked("ownerB"); r.aBlocked = countdownBlocked("ownerA");
    r.bClear = countdownClear("ownerB"); r.textAfterBClear = bn.textContent;
    r.bShow = numShow(9, "ownerB"); r.textAfterBShow = bn.textContent;
    r.aClear = countdownClear("ownerA"); r.downA = !bn.classList.contains("on");
    r.b2 = countdownTo(1.2, 3, "ownerB"); r.textB2 = bn.textContent;
    countdownEndAll(); r.downAll = !bn.classList.contains("on") && !countdownBlocked("ownerA");
    r.b3 = countdownTo(2.2, 3, "ownerB"); setBigNum(null); r.bareDown = !bn.classList.contains("on") && !countdownBlocked("ownerA");
    // a fresh start ends every count: the barge counting, the go arrow's relaunch on the ground (spawnForTakeoff)
    L.fbReset(); L.fbForce(); planeAt(FBARGE.x - 500, FBARGE.z - 700, 200, Math.atan2(-500, -700)); step(30);
    r.fbUp = bn.classList.contains("on") && countdownHeldBy("fireworksBarge");
    L.api.spawnAt(0, 0); r.afterStart = bn.classList.contains("on") ? bn.textContent : "-";
    r.refused = d("numRefused", f0);
    Object.assign(out, r);
  `);
  check("numeral (B6): the rule, in the page -- the first owner keeps the numeral: a second owner's count is refused (its digit not shown, no tick), its clear and its digit are refused, and once the first takes it down the second may count; the start's clear (countdownEndAll) and the bare write take down anyone's; a fresh start ends a barge count that is up",
    !rule.err && rule.a === 3 && rule.aTicks === 1 && rule.b === 0 && rule.bTicks === 0 && rule.textB === "3" && rule.bBlocked && !rule.aBlocked && rule.bClear === false && rule.textAfterBClear === "3" &&
      rule.bShow === false && rule.textAfterBShow === "3" && rule.aClear === true && rule.downA && rule.b2 === 2 && rule.textB2 === "2" && rule.downAll && rule.bareDown && rule.fbUp && rule.afterStart === "-" && rule.refused >= 3,
    JSON.stringify(rule));
  // h. (v227) a point-at count does not follow him away: the barge, the monster truck and (v228) the rocket sled
  // counting, in the prop (by touch, portrait) -- the go arrow (skipToLanding in flight), or the eject (its fresh start
  // on the runway); (v228) in the helicopter (hovering at it, staged) by the go arrow and the eject. In the car nothing
  // takes him away: it has no go arrow (btnSkipShows: it is never AIRBORNE) and its eject keeps his place on the road --
  // so there (a held finger, by touch) the count is judged to run on through the eject and go off, uncut. Within two frames the numeral is down and stays down, no payoff goes off out
  // of sight, the stand-down is the one for being out of sight (`countAway`: 0 before the press, at least 1 after it),
  // and the set-piece is armed: come back at, it counts again.
  // (v230, Q-33 e) Not the rocket nor the booster rocket at the pad: neither can be in a pad count to be taken from it.
  // The rocket stands on its airport's pad, 5.5 km (California) and 6.5 km (New York) from the launch pad, and climbs
  // straight up from there: measured on real launches (the rocket and the starship from both airports, both
  // directions, 8 s on the pad, then the finger held or let go after the drop), it never comes within 5.55 km of
  // the pad (armR 1.4 km, 3-D) and the pad never counts. In the booster rocket he IS the pad's rocket: its stack steps
  // aside and never counts while he is in it (launchsite.js, heavyHeld; the same launches from its pad, 29 m from the
  // count's aim point: no count), and a count up when he picks it is stood down by the picker. So h has no rocket case.
  const awayRuns = {};
  const AWAY_CASES = [];
  for (const piece of ["barge", "truck", "sled", "pad"]) {
    AWAY_CASES.push([piece, "plane", "skip"], [piece, "plane", "eject"], [piece, "car", "eject"], [piece, "heli", "skip"], [piece, "heli", "eject"]);
  }
  // (v229, Q-32 g) one page a set-piece, its cases in turn (each sets up its own vehicle and place, judges deltas of
  // the flags and of the trace from its own start, and resets the four set-pieces after it): 4 pages, not 20
  for (const piece of ["barge", "truck", "sled", "pad"]) {
    const cases = AWAY_CASES.filter(c => c[0] === piece).map(([piece, veh, how]) => ({ piece, veh, how }));
    const page = await numIn(`for (const cs of arg) { const res = {}; ((out, arg) => { try {
      const f0 = Object.assign({}, L.flags);
      const PC = arg.piece, B = PC === "barge", T = PC === "truck", LS = PC === "pad", SL = PC === "sled";
      const P = B ? { x: FBARGE.x, z: FBARGE.z } : T ? mtLanding() : LS ? { x: LSITE.x, z: LSITE.z } : sledWallWorld();
      const ph = () => B ? fbarge.phase : T ? mtruck.phase : LS ? lsite.phase : sled.phase;
      const payoff = B ? "fbShows" : T ? "mtRuns" : LS ? "lsIgnitions" : "sledRuns", counts = B ? "fbCountdowns" : T ? "mtCountdowns" : LS ? "lsCountdowns" : "sledCountdowns";
      const owner = B ? "fireworksBarge" : T ? "monsterTruck" : LS ? "launchSite" : "rocketSled";
      // (v230, Q-33 b) where its count's away is measured from, and how far it is drawn: each piece's own drawFog
      const DR = () => B ? { x: FBARGE.x, z: FBARGE.z, R: TUNE.fogFar * FBARGE.drawFog } : T ? { x: mtruck.x, z: mtruck.z, R: TUNE.fogFar * MTRUCK.drawFog }
        : LS ? { x: LSITE.x, z: LSITE.z, R: TUNE.fogFar * LSITE.drawFog } : { x: sled.x, z: sled.z, R: TUNE.fogFar * SLED.drawFog };
      const fromDrawn = () => { const D = DR(); return Math.round(Math.hypot(st.x - D.x, st.z - D.z)); };
      out.drawn = Math.round(DR().R);
      // (v230, Q-33 d) the pad's arms (how far swung out) and every write of its roar after the press
      const armsNow = () => Math.max(...lsite.arms.map(a => Math.abs(a.rotation.y)));
      let padRoar = null;
      const standF = B ? "fbStandDowns" : T ? "mtStandDowns" : LS ? "lsStandDowns" : "sledStandDowns";
      // (v229, Q-32 e) the sled's lamps and its roar, read when it stands down and when he is back in its sight
      const lampsNow = () => sled.lamps.map(q => q.glow.material.opacity > 0 ? "o" : ".").join("");
      const st0 = window.setTone; let roar = null;
      window.setTone = function (name, type, freq, g) { if (name === "sledRoar") roar = g; if (name === "lsRoar" && padRoar) padRoar.push(+g.toFixed(4)); return st0.apply(this, arguments); };
      const cvs = L.renderer.domElement;
      const fire = (type, x, y) => cvs.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
      const ax = P.x - 600, az = P.z + 700, hdg = Math.atan2(-(P.x - ax), -(P.z - az));
      const fly = () => { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 150); st.pitch = 0; };
      const hover = () => { st.phase = "AIRBORNE"; st.x = ax; st.y = L.terrainEff(ax, az) + 120; st.z = az; heli.vx = heli.vz = heli.vy = 0; heli.altitude = st.y; heli.target = null; st.heading = hdg; };
      // the motorway north of it, dd m from it, him on it facing its way, stopped (as l's roadNear)
      const roadNear = (dd) => {
        let best = null;
        for (let s = 0; s < highway.length; s += 20) { const q = hwySampleAt(s); const e = Math.hypot(q.x - P.x, q.z - P.z); if (q.z > P.z && Math.abs(e - dd) < 150 && (!best || Math.abs(e - dd) < Math.abs(best.e - dd))) best = { s, e, q }; }
        const q = best.q; st.x = q.x - q.fz * 3; st.z = q.z + q.fx * 3; st.y = q.y;
        const dir = ((P.x - st.x) * q.fx + (P.z - st.z) * q.fz) >= 0 ? 1 : -1;
        st.heading = Math.atan2(-q.fx * dir, -q.fz * dir); st.speed = 0;
      };
      const dd = B ? 700 : 900;
      const setUp = () => {
        if (arg.veh === "plane") { planeAt(ax, az, 200, hdg); return fly; }
        if (arg.veh === "car") { L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); roadNear(dd); fire("pointerdown", 410, 800); return null; }
        // (from California the sled is beside the go arrow's own destination: there it would not take him away)
        L.api.setVehicle("helicopter"); if (PC === "sled") L.api.spawnAt(1, 1); else L.api.spawnAt(0, 0); step(10); hover(); return () => { if (ph() !== "count") hover(); };
      };
      let each = setUp();
      let at = -1;
      step(60 * 20, (i) => { if (each) each(); if (ph() === "count" && bn.classList.contains("on")) { at = i; return false; } });
      // (the pad's a beat longer, so its arms have swung out and its roar risen before he is taken away)
      step(LS ? 90 : 20, each);
      out.at = at; out.before = bn.textContent; out.held = countdownHeldBy(owner);
      if (arg.veh === "car") out.skipShown = !el.skipBtn.classList.contains("hidden");
      if (SL) out.lampsBefore = lampsNow();
      if (LS) out.armsBefore = +armsNow().toFixed(3);
      const btn = arg.how === "skip" ? el.skipBtn : el.ejectBtn;
      out.btn = !btn.classList.contains("hidden");
      const r0 = d("repositioned", f0);
      out.awayBefore = d("countAway", f0);
      if (arg.veh === "car") fire("pointerup", 410, 800);
      roar = null; if (LS) padRoar = [];
      press(btn);
      // the car's eject keeps his place on the road (eject.js: surface progress is preserved): he is back by his car, in
      // sight, so it is NOT a take-away -- the count runs on and goes off, with no stand-down (judged below)
      if (arg.how === "eject" && arg.veh !== "car") { for (let i = 0; i < 60 * 40 && d("repositioned", f0) === r0; i++) L.update(1 / 60); out.restarted = d("repositioned", f0) > r0; out.ejectActive = eject.active; }
      const n0 = tr.frames.length;
      // (the whole world waits while he is under the canopy -- update() returns early for the rescue -- so the car's
      // count picks up again once he is back by his car)
      if (arg.veh === "car") { let k = 0; for (; k < 60 * 60 && (k < 2 || eject.active); k++) { L.update(1 / 60); snap(); } out.rescueF = k; }
      let armsUp = 0, armsLast = LS ? armsNow() : 0;
      step(60 * 12, () => { L.api.clearStick(); if (LS) { const a = armsNow(); if (a > armsLast + 1e-6) armsUp++; armsLast = a; } });
      if (LS && arg.veh !== "car") { out.armsAway = +armsLast.toFixed(4); out.armsUp = armsUp; out.padRoar = padRoar.slice(0, 8); out.padRoarN = padRoar.length; out.padRoarMax = Math.max(0, ...padRoar); }
      padRoar = null;
      if (arg.veh === "car") { out.carDist = fromDrawn(); out.carPay = d(payoff, f0); out.carAway = d("countAway", f0); out.carStand = d(standF, f0); out.ejectActive = eject.active; out.ph = ph(); out.seen = seen(n0).slice(0, 160); out.ejPhase = eject.phase; } else {
      const after = tr.frames.slice(n0);
      out.firstDown = after.findIndex(f => f.k[0] === "-"); out.upAfter = after.filter(f => f.k[0] !== "-").length;
      if (SL) { out.lampsAway = lampsNow(); out.roarAway = roar; roar = null; }
      out.seen = seen(n0).slice(0, 160); out.dist = fromDrawn();
      out.payoff = d(payoff, f0); out.phase = ph(); out.away = d("countAway", f0);
      // back: come at it again
      each = setUp();
      let again = -1;
      step(60 * 20, (i) => {
        // back in its sight, one frame on (its count, if it starts again at once, has not lit a lamp yet)
        if (SL && i === 1) { out.lampsBack = lampsNow(); out.roarBack = roar; out.backDist = fromDrawn(); }
        if (each) each(); if (ph() === "count" && bn.classList.contains("on")) { again = i; return false; } });
      if (arg.veh === "car") fire("pointerup", 410, 800);
      out.again = again; out.counts = d(counts, f0);
      }
      window.setTone = st0;
      L.api.clearStick(); L.fbReset(); L.mtReset(); L.sledReset(); L.lsReset();
      } catch (e) { out.err = String(e && e.stack || e).slice(0, 400); } })(res, cs); out[cs.piece + "/" + cs.veh + "/" + cs.how] = res; }
    `, cases);
    if (page.err) for (const c of cases) awayRuns[c.piece + "/" + c.veh + "/" + c.how] = { err: page.err };
    else for (const [k, v] of Object.entries(page)) awayRuns[k] = v;
  }
  const awayBad = [];
  for (const [k, r] of Object.entries(awayRuns)) {
    if (k.includes("/car/")) {
      if (r.err || !(r.at >= 0) || !r.btn || !r.held) { awayBad.push(`${k}: not counting by touch with the eject there (${JSON.stringify(r)})`); continue; }
      if (r.skipShown) awayBad.push(`${k}: a go arrow in the car`);
      if (!(r.carDist < r.drawn) || r.carPay !== 1 || r.carAway !== 0 || r.carStand !== 0) awayBad.push(`${k}: the car's eject is not a take-away -- he stays in sight and the count should run on and go off (${r.carDist} m, ${r.carPay} payoffs, countAway ${r.carAway}, ${r.carStand} stand-downs)`);
      continue;
    }
    if (r.err || !(r.at >= 0) || !r.btn || !r.held || (k.endsWith("eject") && !r.restarted)) { awayBad.push(`${k}: not counting by touch with its button there, or no fresh start (${JSON.stringify(r)})`); continue; }
    if (!(r.dist > r.drawn)) awayBad.push(`${k}: not taken away (${r.dist} m from where it is drawn, drawn to ${r.drawn})`);
    if (r.firstDown < 0 || r.firstDown > 1 || r.upAfter > 1) awayBad.push(`${k}: its numeral followed him (${r.seen})`);
    if (r.payoff !== 0) awayBad.push(`${k}: its payoff went off out of sight (${r.payoff})`);
    if (r.awayBefore !== 0 || !(r.away >= 1)) awayBad.push(`${k}: not stood down for being out of sight (countAway ${r.awayBefore} before the press, ${r.away} after)`);
    if (r.skipShown) awayBad.push(`${k}: a go arrow in the car`);
    if (r.phase !== "armed" || !(r.again >= 0) || r.counts !== 2) awayBad.push(`${k}: not armed again when he came back (phase ${r.phase}, counted again at ${r.again}, ${r.counts} counts)`);
    // (v229, Q-32 e) the sled stood down out of sight: its lamps dark and its roar silent, then and when he is back
    if (k.startsWith("sled/") && (!/o/.test(r.lampsBefore || "") || r.lampsAway !== "..." || r.roarAway !== 0 || r.lampsBack !== "..." || !(r.roarBack === null || r.roarBack === 0) || !(r.backDist < r.drawn)))
      awayBad.push(`${k}: the sled's lamps or roar not dark and silent after its stand-down (lit ${r.lampsBefore} at the press, ${r.lampsAway} and roar ${r.roarAway} away, ${r.lampsBack} and roar ${r.roarBack} back at ${r.backDist} m)`);
    // (v230, Q-33 d) the pad stood down out of sight: its roar written to 0 (every write from the press on) and its
    // arms easing back in (never swinging out again) from where the count had them to all but closed
    if (k.startsWith("pad/") && (!(r.armsBefore > 0.2) || r.armsUp !== 0 || !(r.armsAway < 0.01) || !(r.padRoarN >= 1) || r.padRoarMax !== 0))
      awayBad.push(`${k}: the pad's roar not silenced or its arms not eased back after its stand-down (arms ${r.armsBefore} at the press, ${r.armsAway} 12 s on, out again ${r.armsUp}x; roar written ${r.padRoarN}x, at most ${r.padRoarMax}: ${JSON.stringify(r.padRoar)})`);
  }
  check("numeral (v227): a point-at count does not follow him away -- the fireworks barge, the monster truck, (v228) the rocket sled and (v229) the launch pad counting, the prop by touch (portrait) then the go arrow or the eject's fresh start, (v228) the helicopter's go arrow and (v229, for every one) its eject: the numeral down within two frames and down for the 12 s after, no show, run or launch out of sight, stood down for being out of sight (countAway), and come back at, it counts again (armed); (v229) the sled's lamps dark and its roar silent from the stand-down to his return; (v230) the pad's roar written silent and its arms easing back in; in the car (no go arrow) the eject keeps him in sight and the count runs on and goes off",
    awayBad.length === 0, JSON.stringify({ bad: awayBad, runs: Object.fromEntries(Object.entries(awayRuns).map(([k, r]) => [k, { at: r.at, dist: r.dist, firstDown: r.firstDown, upAfter: r.upAfter, payoff: r.payoff, again: r.again, away: [r.awayBefore, r.away], seen: (r.seen || "").slice(0, 60), lamps: r.lampsBefore && [r.lampsBefore, r.lampsAway, r.roarAway, r.lampsBack, r.roarBack, r.backDist], arms: r.armsBefore !== undefined ? [r.armsBefore, r.armsAway, r.armsUp, r.padRoarN, r.padRoarMax] : undefined, drawn: r.drawn, err: r.err }])) }));
  // i. (v227, Q-30 d) the kept missile (demo.want) dropped when he goes: Q-7's flight (the prop, portrait), the barge
  // counting and his missile from its button landing in the block, kept -- then the go arrow (by touch: its drop is
  // the out-of-sight one, updateDemolition) or a relaunch (the picker and a fresh start, as audit_hud's __relaunch:
  // its drop is demoStandDown's). Flown back over the block with nothing fired, it never goes off on its own.
  const kept = {};
  for (const how of ["skip", "relaunch"]) {
    kept[how] = await numIn(`
      const f0 = Object.assign({}, L.flags);
      const fly = () => { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 70); st.pitch = 0; };
      planeAt(300, 3500, 80, 0);
      let fired = -1;
      step(60 * 12, (i) => { if (fired < 0 && fbarge.phase === "count" && bn.classList.contains("on")) { press(el.missileBtn); fired = i; } if (fired >= 0 && demo.want) return false; fly(); });
      out.fired = fired; out.kept = demo.want; out.fb = fbarge.phase;
      if (arg === "skip") { out.btn = !el.skipBtn.classList.contains("hidden"); press(el.skipBtn); }
      else { L.openPickerAnywhere(); L.api.skipScreens(); L.api.setVehicle("prop"); L.api.spawnAt(0, 0); }
      out.wantAtOnce = demo.want;
      step(60 * 5, () => L.api.clearStick());
      out.wantLater = demo.want;
      const m0 = d("missiles", f0), dm0 = d("demolitions", f0);
      planeAt(300, 3500, 80, 0);
      step(60 * 16, fly);
      Object.assign(out, { missilesBack: d("missiles", f0) - m0, demolitionsBack: d("demolitions", f0) - dm0, demolitions: d("demolitions", f0), demoPhase: demo.phase, fbShows: d("fbShows", f0) });
    `, how);
  }
  const keptBad = [];
  for (const [how, r] of Object.entries(kept)) {
    if (r.err || !(r.fired >= 0) || !r.kept || (how === "skip" && !r.btn)) { keptBad.push(`${how}: no missile kept behind the barge's count (${JSON.stringify(r)})`); continue; }
    if (r.wantLater || (how === "relaunch" && r.wantAtOnce)) keptBad.push(`${how}: the kept missile not dropped (at once ${r.wantAtOnce}, 5 s on ${r.wantLater})`);
    if (r.missilesBack !== 0 || r.demolitionsBack !== 0 || r.demolitions !== 0) keptBad.push(`${how}: flown back with nothing fired, the block went off on its own (${r.demolitionsBack}, ${r.missilesBack} missiles)`);
  }
  check("numeral (v227, Q-30 d): a missile kept behind the barge's count (Q-7's flight by touch, portrait) is dropped when he goes -- by the go arrow (out of sight) and by a relaunch (at once: demoStandDown) -- and flown back over the block with nothing fired, it never goes off on its own",
    keptBad.length === 0, JSON.stringify({ bad: keptBad, kept }));
  // ... and behind another holder: the launch pad's 5-4-3-2-1, STAGED (lsForce: by touch no other count is up while a
  // missile can reach the block -- the barge is the only one whose arm range is within a missile of it). The block
  // waits for the pad's count to come down, then goes: its own 3-2-1, never two digits fighting, its missile not lost.
  const keptLs = await numIn(`
    const f0 = Object.assign({}, L.flags);
    const fly = () => { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 70); st.pitch = 0; };
    const fbR = FBARGE.armR; FBARGE.armR = 0;                // the barge kept out of it: the holder is the pad's
    // (v229) and the pad, 3.5 km off, drawn to here: since v229 its count stands down out of its drawn distance (away)
    const lsF = LSITE.drawFog; LSITE.drawFog = 3;
    try {
      planeAt(300, 3050, 80, 0);
      lsForce(); step(3, fly);
      out.lsUp = countdownHeldBy("launchSite");
      press(el.missileBtn);
      let keptAt = -1, lsEnd = -1, dmAt = -1;
      step(60 * 14, (i) => { if (keptAt < 0 && demo.want) keptAt = i; if (lsEnd < 0 && lsite.phase !== "count") lsEnd = i; if (dmAt < 0 && demo.phase === "charging") dmAt = i; fly(); });
      Object.assign(out, { keptAt, lsEnd, dmAt, seen: seen(), maxTicks: maxTicks(), demolitions: d("demolitions", f0), folded: d("demoTowersFolded", f0), lsIgnitions: d("lsIgnitions", f0), lsAway: d("countAway", f0) });
    } finally { FBARGE.armR = fbR; LSITE.drawFog = lsF; lsReset(); }
  `);
  check("numeral (v227, Q-30 d): a missile into the block while the launch pad's 5-4-3-2-1 holds the numeral (staged) is kept: the block's 3-2-1 starts only once the pad's is down, never two ticks a frame, and the block goes",
    !keptLs.err && keptLs.lsUp && keptLs.keptAt >= 0 && keptLs.dmAt >= keptLs.lsEnd && keptLs.lsEnd > keptLs.keptAt && keptLs.maxTicks === 1 && keptLs.demolitions === 1 && keptLs.folded >= 7 && keptLs.lsIgnitions === 1 && keptLs.lsAway === 0 &&
      /3x(59|60|61) 2x(59|60|61) 1x(59|60|61)/.test(keptLs.seen.replace(/\^/g, "")),
    JSON.stringify(keptLs));
  // m. (v228, Q-31 b) A COUNT HE IS WATCHING IS NEVER CUT -- the standing proof under spCountStep's `away`: every
  // vehicle that can set off the barge, the truck or the sled, at its TOP speed step (pressed, by touch), comes at it
  // and sees a whole count and its payoff with no stand-down at all, `countAway` 0. The cars on the motorway both
  // ways, a held finger (by touch), the Corvette also with its booster held (a drag up, by touch); the prop and the
  // fighter flown at it (the plane's height held, as h); the helicopter at its top step flown to it (its target
  // staged). The other point-at set-pieces are kept from arming (STAGED: their aims return false), so the one count
  // is this one's, from its own arm range -- a later move of drawFog, armR, carArmR, carView or carsAt that cuts a
  // watched count goes red here. And the one path that cut one by touch, unstaged (v228's finding): southbound at
  // the bottom step through the launch pad's 5-4-3-2-1, then the booster -- at 128 m/s the truck armed 2.3 km from
  // a truck drawn to 2.26, and started and stood down every other frame for 0.6 s.
  const STAND = `
    const cvs = L.renderer.domElement;
    const fire = (type, x, y) => cvs.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    const OWN = { barge: "fireworksBarge", truck: "monsterTruck", sled: "rocketSled", pad: "launchSite" };
    const AIMS = { barge: "fbAimed", truck: "mtAimed", sled: "sledAimed", pad: "lsAimed" };
    const real = Object.fromEntries(Object.values(AIMS).map(n => [n, window[n]]));
    const quiet = (piece) => { for (const [k, n] of Object.entries(AIMS)) window[n] = k === piece ? real[n] : () => false; };
    const loud = () => { for (const n of Object.values(AIMS)) window[n] = real[n]; };
    const resetAll = () => { if (police.active) policeStop(false); fbReset(); mtReset(); sledReset(); lsReset(); countdownEndAll(); el.bigNum.classList.remove("sky"); };
    const tgt = (piece) => piece === "barge" ? { x: FBARGE.x, z: FBARGE.z } : piece === "truck" ? mtLanding() : piece === "pad" ? { x: LSITE.x, z: LSITE.z } : sledWallWorld();
    const FL = { barge: ["fbCountdowns", "fbStandDowns", "fbShows"], truck: ["mtCountdowns", "mtStandDowns", "mtRuns"], sled: ["sledCountdowns", "sledStandDowns", "sledRuns"], pad: ["lsCountdowns", "lsStandDowns", "lsIgnitions"] };
    const phaseOf = (piece) => piece === "barge" ? fbarge.phase : piece === "truck" ? mtruck.phase : piece === "pad" ? lsite.phase : sled.phase;
    // (v229) where it is DRAWN from, and how far: what its count's away asks (each set-piece's own drawFog)
    const drawnAt = (piece) => piece === "barge" ? { x: FBARGE.x, z: FBARGE.z, R: TUNE.fogFar * FBARGE.drawFog } : piece === "truck" ? { x: mtruck.x, z: mtruck.z, R: TUNE.fogFar * MTRUCK.drawFog }
      : piece === "pad" ? { x: LSITE.x, z: LSITE.z, R: TUNE.fogFar * LSITE.drawFog } : { x: sled.x, z: sled.z, R: TUNE.fogFar * SLED.drawFog };
    const topOf = () => L.spdStepsFor(L.spdKey()).length - 1;
    const topStep = (btn) => { for (let i = 0; i < 8; i++) { press(btn); L.update(1 / 60); } return st.speedStep; };
    // one run: drive or fly at it until its payoff (or 150 s), the numeral traced
    const watch = (piece, frames, each) => {
      const F = FL[piece], f0 = Object.assign({}, L.flags), D = drawnAt(piece);
      let payAt = -1, vmax = 0, maxD = 0; const own = [], owners = new Set();
      step(frames, (i) => {
        if (each) each(i); vmax = Math.max(vmax, Math.abs(st.speed));
        if (bigNumShown && bigNumOwner) owners.add(bigNumOwner);
        if (phaseOf(piece) === "count") maxD = Math.max(maxD, Math.hypot(st.x - D.x, st.z - D.z));
        if (countdownHeldBy(OWN[piece])) own.push(bn.textContent + (bn.classList.contains("sky") ? "^" : ""));
        if (payAt < 0 && d(F[2], f0) > 0) payAt = i; if (payAt >= 0 && i > payAt + 30) return false; if (st.exploding) return false;
      });
      const runs = []; for (const k of own) { if (runs.length && runs[runs.length - 1][0] === k) runs[runs.length - 1][1]++; else runs.push([k, 1]); }
      return { counts: d(F[0], f0), standDowns: d(F[1], f0), pay: d(F[2], f0), away: d("countAway", f0), refused: d("numRefused", f0), vmax: Math.round(vmax), bang: st.exploding,
               digits: runs.map(r => r[0] + "x" + r[1]).join(" "), step: st.speedStep, top: topOf(), pol: police.active ? police.state : "",
               owners: [...owners].join(","), maxD: Math.round(maxD), drawn: Math.round(D.R), touch: st.exploding ? highway.lastTouch || null : undefined };
    };
    // (v229, Q-32 f) ... and AWAY: on the frame it arms, he is turned round (STAGED, the worst case -- nothing he
    // drives or flies turns in a frame): the same speed, the other way; in a car on to the other carriageway
    const flipCar = () => {
      const q = hwySampleAt(hwyNearest(st.x, st.z).s), fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
      const dir = (fx * q.fx + fz * q.fz) >= 0 ? -1 : 1, off = dir * (HW.medianW / 2 + HW.laneW * 0.5);
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off;
      st.heading = dir > 0 ? Math.atan2(-q.fx, -q.fz) : Math.atan2(q.fx, q.fz);
      // ... and no traffic car where he lands, as he would not be dropped into one (STAGED: those within 200 m are
      // taken off the road and come back later, as a knocked one does -- uncounted)
      for (const t of highway.traffic) if (t.alive && t.wx !== undefined && Math.hypot(t.wx - st.x, t.wz - st.z) < 200) { t.alive = false; t.respawn = HW.traffic.respawn; }
    };
    const armedNow = (piece, F) => { if (F.done || phaseOf(piece) !== "count") return false; F.done = true; const D = drawnAt(piece); F.armD = Math.round(Math.hypot(st.x - D.x, st.z - D.z)); return true; };
    // the car on the motorway, 3.2 km short of it along the road, travelling +s (dir 1) or -s, a held finger
    const carRun = (piece, dir, opts) => {
      resetAll(); if (!opts.loud) quiet(piece); else loud();
      const P = tgt(piece), s0 = hwyNearest(P.x, P.z).s, s = clamp(s0 - dir * 3200, 50, highway.length - 50);
      const q = hwySampleAt(s), off = dir * (HW.medianW / 2 + HW.laneW * 0.5);
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
      st.heading = dir > 0 ? Math.atan2(-q.fx, -q.fz) : Math.atan2(q.fx, q.fz);      // forward is (-sin h, -cos h)
      L.api.clearStick(); topStep(opts.slow ? el.slowBtn : el.fastBtn);
      fire("pointerdown", 410, 800); L.update(1 / 60);
      const up = () => { fire("pointermove", 410, 650); L.update(1 / 60); fire("pointermove", 410, 500); };
      if (opts.boost) up();
      let lit = !!opts.boost, other = false; const F = {};
      const r = watch(piece, 60 * 150, () => {
        if (bigNumShown && bigNumOwner && bigNumOwner !== OWN[piece]) other = true;
        if (opts.late && !lit && other && !bigNumShown) { up(); lit = true; }
        if (opts.flip && armedNow(piece, F)) flipCar();
      });
      fire("pointerup", 410, 500); L.api.clearStick(); loud();
      return Object.assign(r, { boost: lit, cv: typeof cv !== "undefined" && cv.on, flipped: !!F.done, armD: F.armD });
    };
    // (v230, Q-33 f) the planes and the helicopter start 200 m outside its drawn distance (they flew from 3 km: the
    // ~0.54 km between was cruising before anything could arm -- every arm range is inside the drawn distance,
    // and a later one that is not arms at the start, in sight of an edge it then crosses: red, as before)
    const airStart = (piece) => drawnAt(piece).R + 200;
    // the plane flown at it from there, at its top step, its height held
    const planeRun = (piece, key, flip) => {
      resetAll(); quiet(piece);
      const P = tgt(piece), a = Math.atan2(P.x - 300, P.z - 9000), ax = P.x - Math.sin(a) * airStart(piece), az = P.z - Math.cos(a) * airStart(piece);
      L.api.setVehicle(key); L.api.teleportAirborne(1200, 0, 320, 0);
      st.x = ax; st.z = az; st.y = L.terrainEff(ax, az) + 200; st.heading = Math.atan2(-(P.x - ax), -(P.z - az)); st.pitch = 0; st.bank = 0; L.api.clearStick();
      const fly = () => { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 150); st.pitch = 0; };
      fly(); L.update(1 / 60); topStep(el.fastBtn);
      const F = {};
      const r = watch(piece, 60 * 90, () => { fly(); if (flip && armedNow(piece, F)) st.heading += Math.PI; }); loud();
      return Object.assign(r, { flipped: !!F.done, armD: F.armD });
    };
    // the helicopter at its top step, its target the thing (staged), from there too
    const heliRun = (piece, flip) => {
      resetAll(); quiet(piece);
      L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10);
      const P = tgt(piece), a = Math.atan2(P.x - 300, P.z - 9000), ax = P.x - Math.sin(a) * airStart(piece), az = P.z - Math.cos(a) * airStart(piece);
      st.phase = "AIRBORNE"; st.x = ax; st.z = az; st.y = L.terrainEff(ax, az) + 120; heli.altitude = st.y; heli.vx = heli.vz = heli.vy = 0; heli.vertical = 0;
      st.heading = Math.atan2(-(P.x - ax), -(P.z - az));
      for (let i = 0; i < 8; i++) { press(el.speedBtn); L.update(1 / 60); if (st.speedStep === L.spdStepsFor(L.spdKey()).length - 1) break; }
      heli.target = { x: P.x + Math.sin(a) * 2000, y: st.y, z: P.z + Math.cos(a) * 2000 };
      const F = {};
      const r = watch(piece, 60 * 90, () => {
        heli.vertical = 0;
        if (flip && armedNow(piece, F)) { heli.vx = -heli.vx; heli.vz = -heli.vz; st.heading += Math.PI; heli.target = { x: 2 * st.x - P.x, y: st.y, z: 2 * st.z - P.z }; }
      }); loud();
      return Object.assign(r, { flipped: !!F.done, armD: F.armD });
    };`;
  const standRuns = {};
  // (v230, Q-33 f) the runs share pages: each sets up its own vehicle and place (resetAll, setVehicle) and judges
  // deltas from its own start, as h's do -- the three cars and the unstaged run on one page, the prop, the fighter
  // and the helicopter on another: 2 pages, not 7
  const standPage = async (list) => {     // [key, body, perPiece]: body run once a piece (or once), its runs as out[...]
    const r = await numIn(`${STAND}
      const runs = [${list.map(([k, body, per]) => `[${JSON.stringify(k)}, () => { const out = {}; ${per ? `for (const piece of ["barge", "truck", "sled", "pad"]) { ${body} }` : body} return out; }]`).join(", ")}];
      for (const [key, run] of runs) {
        try { for (const [k, v] of Object.entries(run())) out[key + " " + k] = v; }
        catch (e) { out[key + " (page)"] = { err: String(e && e.stack || e).slice(0, 400) }; }
      }
      L.api.clearStick();`);
    if (r.err) standRuns["(page)"] = { err: r.err };
    for (const [k, v] of Object.entries(r)) if (k !== "err") standRuns[k] = v;
  };
  // (v229) each vehicle runs m's coming-at runs and then o's going-away ones (below): the same staging
  const carBody = (veh) => `L.api.setVehicle("${veh}"); L.api.spawnAt(0, 0); step(10);
      for (const flip of [false, true]) {
        const tag = flip ? " away" : "";
        for (const dir of [1, -1]) out[piece + (dir > 0 ? " +s" : " -s") + tag] = carRun(piece, dir, { flip });
        ${veh === "corvette" ? `for (const dir of [1, -1]) out[piece + (dir > 0 ? " +s" : " -s") + " booster" + tag] = carRun(piece, dir, { boost: true, flip });` : ""}
      }`;
  await standPage([
    ...["car", "cybertruck", "corvette"].map(veh => [veh, carBody(veh), true]),
    // the unstaged path (v228's finding): the bottom step through the pad's count, then the booster
    ["corvette", `L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); step(10);
      out["truck -s slow, then the booster (unstaged)"] = carRun("truck", -1, { loud: true, slow: true, late: true });`, false],
  ]);
  await standPage([
    ...["prop", "fighter"].map(key => [key, `out[piece] = planeRun(piece, "${key}"); out[piece + " away"] = planeRun(piece, "${key}", true);`, true]),
    ["helicopter", `out[piece] = heliRun(piece); out[piece + " away"] = heliRun(piece, true);`, true],
  ]);
  // (v229, Q-32 a) and what each run WAS: at the vehicle's top step (the slow run at its bottom one), the booster lit
  // and over BOOST_FLOOR where it is held (the Corvette's 128 m/s, over the top step's 85), and the unstaged run met
  // the pad's count on the way -- or the one guard on v228's mtDrawn fix passes on a drive that never tested it
  const BOOST_FLOOR = 120;
  const judgeRun = (k, r, bad, what) => {
    if (r.err) { bad.push(`${k}: ${r.err}`); return; }
    if (r.away !== 0) bad.push(`${k}: ${r.away} stand-downs for being out of sight (countAway) -- a count he was ${what}, cut`);
    if (r.counts < 1 || r.pay < 1) { bad.push(`${k}: no whole count and payoff (${r.counts} counts, ${r.pay} payoffs, ${r.vmax} m/s, step ${r.step})`); return; }
    if (r.standDowns !== 0 || r.counts !== 1) bad.push(`${k}: ${r.counts} counts with ${r.standDowns} stand-downs before its one payoff (police: ${r.pol})`);
    const re = / pad\b/.test(k) ? /^5\^x(5[89]|6[01]) 4\^x(59|60|61) 3\^x(59|60|61) 2\^x(59|60|61) 1\^x(59|60|61)$/ : /^3\^x(5[89]|6[01]) 2\^x(59|60|61) 1\^x(59|60|61)$/;
    if (!re.test(r.digits)) bad.push(`${k}: its count not a second a digit up in the sky (${r.digits})`);
    if (r.bang) bad.push(`${k}: a bang`);
    if (/booster/.test(k) && !(r.boost && r.cv && r.vmax >= BOOST_FLOOR)) bad.push(`${k}: the booster not lit (lit ${r.boost}, on ${r.cv}, ${r.vmax} m/s, the floor ${BOOST_FLOOR})`);
    if (/slow/.test(k) ? r.step !== 0 : r.step !== r.top) bad.push(`${k}: at step ${r.step}, not ${/slow/.test(k) ? "the bottom" : "the top (" + r.top + ")"}`);
    if (/unstaged/.test(k) && !/launchSite/.test(r.owners || "")) bad.push(`${k}: the launch pad's count not met on the way (${r.owners})`);
    if (/ away$/.test(k) && !r.flipped) bad.push(`${k}: never turned away (no count to turn from)`);
  };
  // (v229) a car run whose count arms AT its drawn edge (under EDGE_M inside it): the monster truck's, since v228's
  // mtDrawn, at the booster's 128 m/s on the -s carriageway -- turned round there it is out of sight in a frame, so o
  // cannot judge it whole. It is unreachable by touch (no car turns on the motorway: it only ever arms coming at it,
  // which m judges whole); o prints it, and judges only that it is THAT run (EDGE_KEY) and that it stood down with no
  // bang. Anything else armed at its edge -- another car, piece or carriageway, a plane, the helicopter -- is red.
  const EDGE_M = 30;
  // (v230, Q-33 a) and that is the ONE run let off: any other run (another car, piece or way) armed at its edge is red
  const EDGE_KEY = "corvette truck -s booster away";
  const standBad = [], awayBad2 = [], edge = {};
  for (const [k, r] of Object.entries(standRuns)) {
    if (!/ away$/.test(k)) { judgeRun(k, r, standBad, "coming at"); continue; }
    if (!r.err && r.armD > r.drawn - EDGE_M) {
      edge[k] = { armD: r.armD, maxD: r.maxD, drawn: r.drawn, vmax: r.vmax, away: r.away, counts: r.counts, pay: r.pay, digits: r.digits };
      if (k !== EDGE_KEY || r.bang || !(r.away >= 1)) awayBad2.push(`${k}: armed at its drawn edge (${r.armD} of ${r.drawn} m) and not the one stated run's (${EDGE_KEY}) clean stand-down`);
      continue;
    }
    judgeRun(k, r, awayBad2, "going away from");
  }
  const pick = (re) => Object.fromEntries(Object.entries(standRuns).filter(([k]) => re.test(k)).map(([k, r]) => [k, r.err ? { err: r.err } : { bang: r.bang, vmax: r.vmax, step: r.step, top: r.top, boost: r.boost, owners: r.owners, armD: r.armD, maxD: r.maxD, drawn: r.drawn, away: r.away, digits: r.digits }]));
  check("numeral (v228, Q-31 b): a count he is coming at is never cut -- the barge, the truck, the sled and (v229) the launch pad, each by the SUV, the Cybertruck and the Corvette at the top step both ways on the motorway (a held finger, by touch), the Corvette also with its booster held, the prop, the fighter and the helicopter at their top steps flown at it, the others kept from arming (staged): one whole count and its payoff, no stand-down, countAway 0; and by touch, unstaged, the bottom step through the launch pad's count and then the booster southbound at the truck, the same -- (v229, Q-32 a) each run judged at its top step (the slow run its bottom), the booster lit and over 120 m/s where held, the pad's count met on the unstaged run",
    standBad.length === 0, JSON.stringify({ bad: standBad, runs: pick(/^(?!.* away$)/) }));
  // o. (v229, Q-32 f) ... and a count he GOES AWAY from at once is never cut either: each of m's runs again, turned
  // round on the frame its count arms (STAGED, the worst case: nothing he drives or flies turns round in a frame, and
  // the cars cannot turn on the motorway at all -- the turn puts him on the other carriageway): the same top speed
  // (the Corvette's booster too) straight away from it for the whole count, and the count still runs whole and goes
  // off, countAway 0. How far he got (maxD) against its drawn distance is printed: the margin a later drawFog, arm
  // range or top speed may not eat.
  {
    const margins = {};
    for (const [k, r] of Object.entries(standRuns)) if (/ away$/.test(k) && !r.err && !edge[k]) { const pc = k.split(" ")[1]; margins[pc] = Math.min(margins[pc] === undefined ? 1e9 : margins[pc], r.drawn - r.maxD); }
    check(`numeral (v229, Q-32 f): a count he goes AWAY from at once is never cut -- each of the coming-at runs (the barge, the truck, the sled and the launch pad; the three cars both ways and the Corvette's booster, the prop, the fighter and the helicopter, all at their top steps) turned round on the frame it arms (STAGED, the worst case) and away at the same speed: one whole count and its payoff, no stand-down, countAway 0, each piece's least margin to its drawn distance over 0 (printed); the one count armed at its drawn edge, where no car can turn (the truck, the Corvette's booster, -s), printed and judged only to stand down clean -- any other run armed at its edge is red`,
      awayBad2.length === 0 && Object.keys(margins).length === 4 && Object.values(margins).every(m => m > 0) && Object.keys(edge).length <= 1, JSON.stringify({ bad: awayBad2, margins, edge, runs: pick(/ away$/) }));
  }
  // n. (v228, Q-31 d) a missile still in FLIGHT toward the block when the go arrow takes him away (demoInSight's
  // other case): the prop between the barge and the block, nose at the block, its missile from its button; the go
  // arrow pressed (by touch) a frame or so before the missile reaches the block. At the far airport the block never
  // counts or folds, no numeral. And without the press, the same missile sets the block off (it was going in).
  const flightRun = async (go) => numIn(`
    const f0 = Object.assign({}, L.flags);
    const fly = () => { L.api.clearStick(); st.y = Math.max(st.y, L.terrainEff(st.x, st.z) + 70); st.pitch = 0; };
    const ux = FBARGE.x - demo.x, uz = FBARGE.z - demo.z, u = Math.hypot(ux, uz);
    const sx = demo.x + ux / u * 700, sz = demo.z + uz / u * 700;
    planeAt(sx, sz, 80, Math.atan2(-(demo.x - sx), -(demo.z - sz)));
    fly(); step(2, fly);
    out.free = !bn.classList.contains("on") && demo.phase === "armed" && !demo.want;
    let fired = -1, goAt = -1;
    const near = () => { let best = 1e9, vm = 0; for (const m of missiles) { if (!m.alive) continue; vm = Math.max(vm, Math.hypot(m.vx, m.vz)); for (const t of demo.towers) { const w = demoTowerWorld(t); best = Math.min(best, Math.hypot(m.x - w.x, m.z - w.z) - DEMO.hitR); } } return { best, vm }; };
    step(60 * 10, (i) => {
      if (fired < 0 && Math.hypot(demo.x - st.x, demo.z - st.z) < 450) { press(el.missileBtn); fired = i; }
      if (fired >= 0 && goAt < 0 && arg) { const n = near(); if (n.vm > 0 && n.best > 0 && n.best < n.vm * 1.5 / 60) { out.btn = !el.skipBtn.classList.contains("hidden"); out.gap = Math.round(n.best); press(el.skipBtn); goAt = i; out.distAt = Math.round(Math.hypot(demo.x - st.x, demo.z - st.z)); return; } }
      if (goAt >= 0) { L.api.clearStick(); return; }
      if (!arg && demo.phase === "charging") return false;
      fly();
    });
    out.fired = fired; out.goAt = goAt; out.seen = seen(); out.dist = Math.round(Math.hypot(demo.x - st.x, demo.z - st.z));
    Object.assign(out, { demolitions: d("demolitions", f0), folded: d("demoTowersFolded", f0), phase: demo.phase, want: demo.want, missiles: d("missiles", f0) });
  `, go);
  const inFlight = { control: await flightRun(false), go: await flightRun(true) };
  const ifc = inFlight.control, ifg = inFlight.go;
  check("numeral (v228, Q-31 d): a missile still in flight toward the demolition block when the go arrow takes him away (by touch, the prop) -- at the far airport the block never counts or folds and no numeral shows; without the press the same missile sets the block off",
    !ifc.err && !ifg.err && ifc.free && ifg.free && ifc.fired >= 0 && ifc.demolitions === 1 && ifg.fired >= 0 && ifg.goAt > ifg.fired && ifg.btn && ifg.dist > 2400 &&
      ifg.demolitions === 0 && ifg.folded === 0 && ifg.phase === "armed" && /^-x\d+$/.test(ifg.seen),
    JSON.stringify(inFlight));
  // l. (v227, Q-30 b) a race asked for while a point-at count is up on the motorway (by touch, portrait): the race
  // button's own picker stands it down (menuOpen) before the card is tapped, so the grid's 3-2-1 is the race's own
  // under its lamps -- the barge, the truck, the launch pad and the sled, each counting as he taps the button.
  const ROAD = `
    const roadNear = (tx, tz, dd) => {
      let best = null;
      for (let s = 0; s < highway.length; s += 20) { const q = hwySampleAt(s); const e = Math.hypot(q.x - tx, q.z - tz); if (q.z > tz && Math.abs(e - dd) < 150 && (!best || Math.abs(e - dd) < Math.abs(best.e - dd))) best = { s, e, q }; }
      const q = best.q; st.x = q.x - q.fz * 3; st.z = q.z + q.fx * 3; st.y = q.y;
      const dir = ((tx - st.x) * q.fx + (tz - st.z) * q.fz) >= 0 ? 1 : -1;
      st.heading = Math.atan2(-q.fx * dir, -q.fz * dir); st.speed = 0;
      return Math.round(best.e);
    };
    const lamps = () => race.lights.map(m => { const h = m.material.color.getHex(); return h === 0xe0483e ? "R" : h === 0x36c46a ? "G" : "."; }).join("");`;
  const raceAsk = {};
  for (const [piece, dd, track] of [["barge", 700, "dunes"], ["truck", 900, "dunes"], ["launch", 1000, "snow"], ["sled", 900, "dunes"]]) {
    raceAsk[piece] = await numIn(`${ROAD}
      const f0 = Object.assign({}, L.flags);
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      const P = arg.piece, W = sledWallWorld(), M = mtLanding();
      const tgt = P === "barge" ? [FBARGE.x, FBARGE.z] : P === "sled" ? [W.x, W.z] : P === "truck" ? [M.x, M.z] : [LSITE.x, LSITE.z];
      roadNear(tgt[0], tgt[1], arg.dd);
      const counting = () => P === "barge" ? fbarge.phase === "count" : P === "sled" ? sled.phase === "count" : P === "truck" ? mtruck.phase === "count" : lsite.phase === "count";
      let up = -1;
      step(60 * 20, (i) => { L.api.setStick(0, 0); if (counting() && bn.classList.contains("on")) { up = i; return false; } });
      step(3, () => L.api.setStick(0, 0));
      out.up = up; out.before = bn.textContent; L.api.clearStick();
      out.raceBtn = !el.raceBtn.classList.contains("hidden");
      press(el.raceBtn); step(2);
      out.afterBtn = bn.classList.contains("on") ? bn.textContent : "-"; out.stillCounting = counting();
      tap(document.querySelector('.trackCard[data-track="' + arg.track + '"]'));
      out.on = L.raceOn();
      const n0 = tr.frames.length; let goAt = -1;
      step(60 * 5, (i) => { L.api.setStick(0, 0); if (goAt < 0 && L.race.phase === "race") { goAt = i; return false; } }, () => lamps());
      out.goAt = goAt; out.seen = seen(n0);
      const g = tr.frames.slice(n0); out.ticks = g.reduce((m, f) => m + f.ticks, 0);
      out.lampSeq = [...new Set(g.map(f => f.tag))].join(" ");
    `, { piece, dd, track });
  }
  const raBad = [];
  for (const [p, r] of Object.entries(raceAsk)) {
    if (r.err || !(r.up >= 0) || !r.raceBtn || !r.on || !(r.goAt > 0)) { raBad.push(`${p}: not counting by touch, or no race (${JSON.stringify(r)})`); continue; }
    if (r.afterBtn !== "-" || r.stillCounting) raBad.push(`${p}: still counting behind the race's picker (${r.afterBtn})`);
    if (!/^(-r?x\d+ )*3rx\d+ 2rx\d+ 1rx\d+( -x\d+)?$/.test(r.seen) || r.ticks !== 3) raBad.push(`${p}: the grid's 3-2-1 not the race's own (${r.seen}, ${r.ticks} ticks)`);
    if (!/R\.\. RR\. RRR GGG$/.test(r.lampSeq)) raBad.push(`${p}: the lamps did not light one a second (${r.lampSeq})`);
  }
  check("numeral (v227, Q-30 b): a race asked for while the barge's, the truck's, the launch pad's or the sled's count is up on the motorway (by touch, portrait) -- the race button's picker stands it down before the card, and the grid's 3-2-1 is the race's own under its three lamps, one tick each",
    raBad.length === 0, JSON.stringify({ bad: raBad, runs: Object.fromEntries(Object.entries(raceAsk).map(([k, r]) => [k, { up: r.up, before: r.before, afterBtn: r.afterBtn, seen: r.seen, lamps: r.lampSeq, err: r.err }])) }));
  // ... and LEFT with one up (by touch): on the dunes after the green the sled counts over the race (v226: it waits for
  // the green); the menu then leaves the race (raceReset) and the sled's digit and its sky class survive the press --
  // the race takes down only its own -- and the sled's own stand-down takes it down on the next frame.
  const raceLeft = await numIn(`${ROAD}
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(30, () => L.api.setStick(0, 0)); L.api.clearStick(); step(10);
    press(el.raceBtn); step(10); tap(document.querySelector('.trackCard[data-track="dunes"]'));
    out.on = L.raceOn();
    let up = -1;
    step(60 * 20, (i) => { L.api.setStick(0, 0); if (L.race.phase === "race" && sled.phase === "count" && countdownHeldBy("rocketSled")) { up = i; return false; } });
    out.up = up; out.before = bn.textContent + (bn.classList.contains("sky") ? "^" : "") + (bn.classList.contains("race") ? "r" : "");
    L.api.clearStick(); press(el.menuBtn);
    out.menu = L.menuOpen(); out.raceOff = !L.raceOn();
    out.atPress = (bn.classList.contains("on") ? bn.textContent : "-") + (bn.classList.contains("sky") ? "^" : "") + (bn.classList.contains("race") ? "r" : "") + (countdownHeldBy("rocketSled") ? " sled" : "");
    L.update(1 / 60);
    out.next = (bn.classList.contains("on") ? bn.textContent : "-") + (bn.classList.contains("sky") ? "^" : "");
    L.api.skipScreens();
  `);
  check("numeral (v227, Q-30 b): a race LEFT by the menu while the sled counts over it on the dunes (by touch) -- the sled's digit and its sky class survive the race's leave (it takes down only its own), and the sled's own stand-down takes it down on the next frame",
    !raceLeft.err && raceLeft.on && raceLeft.up >= 0 && /^[1-3]\^$/.test(raceLeft.before) && raceLeft.menu && raceLeft.raceOff &&
      raceLeft.atPress === raceLeft.before + " sled" && raceLeft.next === "-",
    JSON.stringify(raceLeft));
  // ... and STAGED (no count of his reaches the grid by touch -- above): another owner's 3, with the sky class, put up
  // on the grid after the race has started. The lamps still light one a second; the race's digits are refused; at the
  // green the other's 3 and its sky class are still there. PRINTED, not judged: the race class the start put on the
  // numeral stays on the other's digit until the green (QUEUE, v227's finding).
  const raceGreen = await numIn(`${ROAD}
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(30, () => L.api.setStick(0, 0)); L.api.clearStick(); step(10);
    press(el.raceBtn); step(10); tap(document.querySelector('.trackCard[data-track="dunes"]'));
    step(5); countdownTo(2.5, 3, "another"); el.bigNum.classList.add("sky"); tr.ticks = 0;
    const n0 = tr.frames.length; let goAt = -1;
    step(60 * 5, (i) => { if (goAt < 0 && L.race.phase === "race") { goAt = i; return false; } }, () => lamps());
    out.goAt = goAt; out.seen = seen(n0); out.lampSeq = [...new Set(tr.frames.slice(n0).map(f => f.tag))].join(" ");
    out.ticks = tr.frames.slice(n0).reduce((m, f) => m + f.ticks, 0);
    out.atGreen = bn.textContent + (bn.classList.contains("sky") ? "^" : "") + (bn.classList.contains("race") ? "r" : "") + (countdownHeldBy("another") ? " another" : "");
    countdownEndAll(); el.bigNum.classList.remove("sky");
  `);
  check("numeral (v227, Q-30 b): the race's green with another owner's 3 up (STAGED) -- the lamps light one a second and go green, the race's digits are refused (no tick), and at the green the other's 3 and its sky class are still there",
    !raceGreen.err && raceGreen.goAt > 0 && /R\.\. RR\. RRR GGG$/.test(raceGreen.lampSeq) && raceGreen.ticks === 0 && raceGreen.atGreen === "3^ another",
    JSON.stringify(raceGreen));
  // k. (v227, Q-30 a) THE SEPARATION that makes j's rows unreachable, pinned: the counts that never ask (the carrier's
  // catapult, the lock's gates, the tower catch, Mars's pad) run where no other count can be up. From where he is when
  // each runs (the catapult; the chamber; a real flight from each airport, his finger held and let go, every frame the
  // catch counts; anywhere on Mars) to every count he can set off (the barge, the truck, the launch pad, the sled: their
  // furthest arm range, a car's at 80 m/s; the demolition: a missile's reach) is more than that range plus 400 m/s for its whole count.
  // A set-piece moved within reach makes this red: then it must ask (spCountBusy) or wait, as the crane does.
  const sep = await numIn(`
    const CV = TUNE.carrier, K = L.LK, vMax = 400, vCar = 80, places = {};   // vCar: faster than any car's top step
    places.carrier = [{ x: carrier.x + CV.catX, y: carrier.deck, z: carrier.z - CV.catZ }];
    places.lock = [{ x: (K.chamber.x[0] + K.chamber.x[1]) / 2, y: TUNE.waterLevel, z: (K.gateS + K.gateN) / 2 }];
    out.flights = [];
    for (const [ap, dir] of [[0, 0], [1, 1]]) for (const holdOn of [true, false]) {
      L.api.setVehicle("starship"); spawnForTakeoff(ap, dir); L.api.setThrottle(true);
      for (let i = 0; i < 60 * 60 && !L.rocketCanDrop(); i++) L.update(1 / 60);
      L.dropStage(); if (!holdOn) L.api.setThrottle(false);
      const pts = []; let n = 0;
      for (let j = 0; j < 60 * 120; j++) { L.update(1 / 60); if (tcatch.counting) { n++; pts.push({ x: st.x, y: st.y, z: st.z }); } else if (n) break; }
      L.api.setThrottle(false);
      out.flights.push({ ap, holdOn, frames: n });
      places["catch" + ap + (holdOn ? "held" : "off")] = pts;
    }
    const b = L.BODIES[1];
    const pieces = {
      fireworksBarge: { x: FBARGE.x, y: fbarge.y, z: FBARGE.z, R: Math.max(FBARGE.armR, FBARGE.carView + vCar * fbToFirstBurst()), count: FBARGE.count },
      monsterTruck: { ...mtLanding(), R: Math.max(MTRUCK.armR, MTRUCK.carArmR), count: MTRUCK.count },
      launchSite: { x: LSITE.x, y: lsite.padY + 40, z: LSITE.z, R: LSITE.armR, count: LSITE.count },
      rocketSled: { ...sledWallWorld(), R: Math.max(SLED.armR, SLED.carView + vCar * sledToWall()), count: SLED.count },
      demolition: { x: demo.x, y: demo.base, z: demo.z, R: (TUNE.missileSpeed + vMax) * TUNE.missileLife + TUNE.demolition.hitR, count: 3 },
    };
    out.gaps = [];
    for (const [sn, S] of Object.entries(pieces)) {
      const need = S.R + vMax * S.count;
      for (const [pn, pts] of Object.entries(places)) {
        let dmin = 1e12; for (const P of pts) dmin = Math.min(dmin, Math.hypot(P.x - S.x, P.y - S.y, P.z - S.z));
        out.gaps.push({ place: pn, piece: sn, d: Math.round(dmin), need: Math.round(need), n: pts.length });
      }
      out.gaps.push({ place: "mars", piece: sn, d: Math.round(Math.abs(Math.hypot(S.x - b.x, S.y - b.y, S.z - b.z) - b.r)), need: Math.round(need), n: 1 });
    }
  `);
  const sepBad = sep.err ? [sep.err] : sep.gaps.filter(g => !(g.n > 0) || g.d <= g.need).map(g => `${g.piece} from ${g.place}: ${g.d} m, within ${g.need} m`);
  if (!sep.err && !sep.flights.every(f => f.frames > 60)) sepBad.push("the tower catch did not count on a flight: " + JSON.stringify(sep.flights));
  check("numeral (v227, Q-30 a): the counts that never ask (the carrier's catapult, the lock's gates, the tower catch on a real flight from each airport, Mars's pad) run kilometres from every count he can set off -- each further than that count's furthest arm range (a missile's reach for the demolition) plus 400 m/s for its whole count, so nothing he does can have two up at once there",
    sepBad.length === 0, JSON.stringify({ bad: sepBad, closest: sep.gaps && [...sep.gaps].sort((p, q) => (p.d - p.need) - (q.d - q.need)).slice(0, 6) }));
  // j. (v227, Q-30 e) THE REFUSED PATH, a row each, STAGED (by touch none of these can start under another's count:
  // the point-at ones and the crane ask first, and the rest are kilometres from every other count -- k, below):
  // another owner's 3 is up, with and without the sky class, and the row's own count is run through to its go.
  // Refused whole: the 3 stands, no tick of its own, the class not moved either way; what it does is printed.
  const REFUSE_ROWS = {
    crane: `L.api.setVehicle("crane"); L.api.spawnAt(0, 0); step(30);
      R.start = () => { cr.aim = crAimed(); cr.phase = "count"; cr.t = CR.count; };
      R.running = () => cr.phase === "count"; R.hold = () => {}; R.frames = 60 * 3.5; R.reset = () => crReset();`,
    launchSite: `L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      R.hold = () => { st.x = LSITE.x - 700; st.z = LSITE.z + 300; st.y = L.terrainEff(st.x, st.z) + 2; st.speed = 0; };
      R.start = () => lsForce(); R.running = () => lsite.phase === "count"; R.frames = 60 * (LSITE.count + 0.5); R.reset = () => lsReset();`,
    monsterTruck: `L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      const P = mtLanding(); R.hold = () => { st.x = P.x + 300; st.z = P.z + 450; st.y = L.terrainEff(st.x, st.z) + 2; st.speed = 0; };
      R.start = () => mtForce(); R.running = () => mtruck.phase === "count"; R.frames = 60 * 3.5; R.reset = () => mtReset();`,
    rocketSled: `L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      const W = sledWallWorld(); R.hold = () => { st.x = W.x + 300; st.z = W.z + 500; st.y = L.terrainEff(st.x, st.z) + 2; st.speed = 0; };
      R.start = () => sledForce(); R.running = () => sled.phase === "count"; R.frames = 60 * 3.5; R.reset = () => sledReset();
      R.extra = () => sled.lamps.map(q => q.glow.material.opacity > 0.5 ? "o" : ".").join("");`,
    lock: `L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); step(10);
      const K = L.LK, cx = (K.chamber.x[0] + K.chamber.x[1]) / 2, cz = (K.gateS + K.gateN) / 2;
      R.hold = () => { st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz); st.speed = 0; };
      R.start = () => { lock.dir = lock.fill < 0.5 ? 1 : -1; lock.state = "warn"; lock.t = K.warn; }; R.running = () => lock.state === "warn"; R.frames = 60 * (K.warn + 0.5);
      R.reset = () => { lock.state = "idle"; lock.t = 0; };`,
    carrier: `L.api.setVehicle("fighter"); L.api.spawnAt(1, 1); step(10);
      const CV = TUNE.carrier; R.hold = () => {};
      R.start = () => { st.phase = "AIRBORNE"; st.exploding = false; st.x = carrier.x + CV.catX; st.z = carrier.z - CV.catZ; st.y = carrier.deck + TUNE.gearHeight; st.heading = 0; st.speed = 0; carrier.state = "count"; carrier.t = CV.countFrom; };
      R.running = () => carrier.state === "count"; R.frames = 60 * (CV.countFrom + 0.5); R.reset = () => carrierReset();`,
    towerCatch: `R.hold = () => {}; R.start = () => {}; R.reset = () => {};
      // a real flight to the drop (its fresh start ends every count: so before the other's 3 goes up), then the catch
      R.pre = () => {
        L.api.setVehicle("starship"); spawnForTakeoff(0, 0); L.api.setThrottle(true);
        for (let i = 0; i < 60 * 60 && !L.rocketCanDrop(); i++) L.update(1 / 60);
        L.dropStage(); L.api.setThrottle(false);
      };
      R.running = () => tcatch.counting; R.frames = 60 * 25;`,
    // Mars: one landing a page (a second landing after its launch does not call the pad again), each class its own page
    marsBase: `R.skies = [false]; const b = L.BODIES[1];
      const onMars = () => {
        if (typeof roverReset === "function") roverReset(); L.api.setThrottle(false);
        L.api.setVehicle("starship"); L.api.placeOnRunway();
        st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
        const n0 = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
        st.x = b.x + n0.x * (b.r + 12); st.y = b.y + n0.y * (b.r + 12); st.z = b.z + n0.z * (b.r + 12);
        st.touching = false; releaseThrottle(); L.update(1 / 60);
      };
      R.hold = () => {}; R.reset = () => {};
      // landed, out in the rover and back on the pad: the pad's count is called (then put back to its start, staged)
      R.pre = () => {
        onMars(); for (let i = 0; i < 6; i++) L.update(1 / 60);
        L.roverDeploy(); for (let i = 0; i < 6; i++) L.update(1 / 60);
        mars.phase = "returning"; L.roverReturn();
        for (let t = 0; rover.active && t < 300; t++) for (let i = 0; i < 6; i++) L.update(1 / 60);
        R.called = mars.phase === "count";
      };
      R.start = () => { mars.phase = "count"; mars.t = MB.padCount; };
      R.running = () => mars.phase === "count"; R.frames = 60 * (MB.padCount + 0.5);`,
    marsBaseSky: `R.skies = [true]; const b = L.BODIES[1];
      const onMars = () => {
        if (typeof roverReset === "function") roverReset(); L.api.setThrottle(false);
        L.api.setVehicle("starship"); L.api.placeOnRunway();
        st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
        const n0 = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
        st.x = b.x + n0.x * (b.r + 12); st.y = b.y + n0.y * (b.r + 12); st.z = b.z + n0.z * (b.r + 12);
        st.touching = false; releaseThrottle(); L.update(1 / 60);
      };
      R.hold = () => {}; R.reset = () => {};
      // landed, out in the rover and back on the pad: the pad's count is called (then put back to its start, staged)
      R.pre = () => {
        onMars(); for (let i = 0; i < 6; i++) L.update(1 / 60);
        L.roverDeploy(); for (let i = 0; i < 6; i++) L.update(1 / 60);
        mars.phase = "returning"; L.roverReturn();
        for (let t = 0; rover.active && t < 300; t++) for (let i = 0; i < 6; i++) L.update(1 / 60);
        R.called = mars.phase === "count";
      };
      R.start = () => { mars.phase = "count"; mars.t = MB.padCount; };
      R.running = () => mars.phase === "count"; R.frames = 60 * (MB.padCount + 0.5);`,
  };
  const refuse = {};
  // (v230, Q-33 f) the rows share a page, each in its own block with its own flags and trace from its own start, and
  // each reset after it: the seven on Earth on one page, Mars's two on a page each (one landing a page): 3, not 9
  const ROW_PAGES = [Object.keys(REFUSE_ROWS).filter(r => !/^marsBase/.test(r)), ["marsBase"], ["marsBaseSky"]];
  for (const rows of ROW_PAGES) {
    const pr = await numIn(rows.map(row => `{ const out = {}; try {
      const R = {}; ${REFUSE_ROWS[row]}
      const f0 = Object.assign({}, L.flags);
      const runs = [];
      for (const sky of (R.skies || [false, true])) {
        if (R.pre) R.pre(); else { R.hold(); step(5, R.hold); }
        countdownEndAll(); el.bigNum.classList.remove("sky");
        countdownTo(2.5, 3, "another");                       // someone else's 3, up
        if (sky) el.bigNum.classList.add("sky");
        tr.ticks = 0; const n0 = tr.frames.length, r0 = d("numRefused", f0);
        R.hold(); R.start();
        const extra = [];
        let ran = 0;
        step(R.frames, () => { R.hold(); if (R.running()) ran++; if (R.extra) { const e = R.extra(); if (extra[extra.length - 1] !== e) extra.push(e); } });
        const fr = tr.frames.slice(n0);
        runs.push({ sky, ran, seen: seen(n0), ticks: sumTicks(n0), refused: d("numRefused", f0) - r0,
          held: countdownHeldBy("another"), text: bn.textContent, skyNow: bn.classList.contains("sky"), still: R.running(), lamps: extra.join(" "), called: R.called });
        R.reset(); countdownEndAll(); el.bigNum.classList.remove("sky");
      }
      out.runs = runs;
      } catch (e) { out.err = String(e && e.stack || e).slice(0, 400); } __rows[${JSON.stringify(row)}] = out; }`).join("\n").replace(/^/, "const __rows = out;\n"));
    for (const row of rows) refuse[row] = pr.err ? { err: pr.err } : (pr[row] || { err: "no result" });
  }
  const refBad = [];
  for (const [row, r] of Object.entries(refuse)) {
    if (r.err || !r.runs) { refBad.push(`${row}: ${r.err || "no runs"}`); continue; }
    for (const u of r.runs) {
      if (!(u.ran > 120) || (/^marsBase/.test(row) && !u.called)) refBad.push(`${row} (sky ${u.sky}): its count did not run its length (${u.ran} frames${/^marsBase/.test(row) ? ", the pad called " + u.called : ""})`);
      if (!new RegExp("^" + (u.sky ? "3\\^" : "3") + "x\\d+$").test(u.seen)) refBad.push(`${row} (sky ${u.sky}): the other owner's 3 did not stand, or its class moved (${u.seen})`);
      if (u.ticks !== 0) refBad.push(`${row} (sky ${u.sky}): ${u.ticks} ticks of its own under another's numeral`);
      if (!(u.refused > 0) || !u.held || u.text !== "3" || u.skyNow !== u.sky) refBad.push(`${row} (sky ${u.sky}): not refused whole (${JSON.stringify(u)})`);
    }
  }
  check("numeral (v227, Q-30 e): the refused path, a row each (STAGED: none is reachable by touch -- the crane, the launch pad, the truck and the sled ask first, the rest are kilometres from every other count, k): another owner's 3 up, with and without the sky class, and the crane's, the launch pad's, the truck's, the sled's, the lock's, the carrier's, the tower catch's (a real flight) and Mars's pad count run to its go under it -- the 3 stands with its class unmoved, no tick of their own, refused every frame",
    refBad.length === 0, JSON.stringify({ bad: refBad, rows: Object.fromEntries(Object.entries(refuse).map(([k, r]) => [k, r.runs ? r.runs.map(u => ({ sky: u.sky, ran: u.ran, seen: u.seen, ticks: u.ticks, refused: u.refused, lamps: u.lamps, still: u.still, called: u.called })) : r.err])) }));
  // g. the source
  {
    const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..", "cockpit", "js");
    const bad = [], places = { endAll: [], bare: [] };
    // (v230, B6's close) WHO COUNTS, and how: every point-and-count set-piece runs its count on the one step
    // (spCountStep) -- the barge, the truck, the sled, the launch pad and the crane -- and the hand-written counts that
    // are left are the ones that are not point-and-count, each named here with why (setpieces.js's header): the
    // demolition (a missile sets it off, its numeral mid-screen, its kept missile), the tower catch (altitude over the
    // closing speed, not a clock), the carrier's catapult (he is put on it), the police's pull-over, Mars (two counts
    // under the base, held under the picker and resumed), the lock and the race (they drive the digit: numShow). A new
    // hand-written count, or the sky class moved by anyone but the step, is red here: it goes on spCountStep, or this
    // list grows with its reason.
    const ON_STEP = ["crane.js crane", "fireworksbarge.js fireworksBarge", "launchsite.js launchSite", "monstertruck.js monsterTruck", "rocketsled.js rocketSled"];
    const BY_HAND = ["countdownTo marsbase.js marsBase", "countdownTo police.js police", "countdownTo setpieces.js carrier", "countdownTo setpieces.js demolition", "countdownTo setpieces.js towerCatch",
                     "numShow lock.js lock", "numShow race.js race"];
    // ... and who takes the sky class off: the step, each step-owner's reset (a count it holds when it is reset), the race (its own leave)
    const SKY_OFF = ["crane.js", "fireworksbarge.js", "launchsite.js", "monstertruck.js", "race.js", "rocketsled.js", "setpieces.js"];
    const who = { step: new Set(), hand: new Set(), clear: new Set(), skyOn: new Set(), skyOff: new Set() };
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
      const src = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
      src.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        for (const m of code.matchAll(/\b(countdownTo|countdownClear|numShow|countdownBlocked|countdownHeldBy|spCountStep)\(/g)) {
          if (/function\s+$/.test(code.slice(0, m.index))) continue;
          // its arguments, split at the top level
          const args = []; let depth = 0, cur = "", j = m.index + m[0].length;
          for (; j < code.length; j++) {
            const ch = code[j];
            if (ch === "(") depth++;
            else if (ch === ")") { if (depth === 0) break; depth--; }
            if (ch === "," && depth === 0) { args.push(cur.trim()); cur = ""; } else cur += ch;
          }
          args.push(cur.trim());
          const owner = { countdownTo: args[2], countdownClear: args[0], numShow: args[1], countdownBlocked: args[0], countdownHeldBy: args[0], spCountStep: args[0] }[m[1]];
          if (!(f === "setpieces.js" && owner === "owner") && !/^"[A-Za-z]+"$/.test(owner || "")) bad.push(`${f}:${i + 1} ${m[1]}(${args.join(", ")})`);
          const o = (owner || "").replace(/"/g, "");
          if (!(f === "setpieces.js" && o === "owner")) {
            if (m[1] === "spCountStep") who.step.add(`${f} ${o}`);
            if (m[1] === "countdownTo" || m[1] === "numShow") who.hand.add(`${m[1]} ${f} ${o}`);
            if (m[1] === "countdownClear") who.clear.add(`${f} ${o}`);
          }
        }
        if (/classList\.(add|toggle)\("sky"/.test(code)) who.skyOn.add(f);
        if (/classList\.remove\("sky"\)/.test(code)) who.skyOff.add(f);
        if (/\bcountdownEndAll\(\)/.test(code) && !/function countdownEndAll/.test(code)) places.endAll.push(`${f}:${i + 1}`);
        if (/\bsetBigNum\(/.test(code) && !/function setBigNum/.test(code)) places.bare.push(f);
      });
    }
    const endAllOk = places.endAll.length === 1 && /^setpieces\.js/.test(places.endAll[0]);
    const bareOk = places.bare.every(f => f === "setpieces.js");
    check("numeral (B6): every write and clear of the numeral in cockpit/js names its owner (a literal); the clear of all (countdownEndAll) is called in one place, the start's (towerCatchReset), and the bare write (setBigNum) only inside the mechanism in setpieces.js",
      bad.length === 0 && endAllOk && bareOk, JSON.stringify({ bad, endAll: places.endAll, bare: [...new Set(places.bare)] }));
    const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const owners = new Set([...ON_STEP.map(x => x.split(" ")[1]), ...BY_HAND.map(x => x.split(" ")[2])]);
    const strayClear = [...who.clear].filter(x => !owners.has(x.split(" ")[1]) || ![...ON_STEP, ...BY_HAND.map(y => y.split(" ").slice(1).join(" "))].includes(x));
    const skyOn = [...who.skyOn].filter(f => f !== "setpieces.js"), skyOff = [...who.skyOff].filter(f => !SKY_OFF.includes(f));
    check("numeral (v230, B6 done): every point-and-count set-piece counts on the one step (spCountStep: the barge, the truck, the sled, the launch pad and the crane), the counts still written by hand are exactly the stated ones that are not point-and-count (the demolition, the tower catch, the carrier, the police, Mars, the lock, the race), the sky class goes up only in the step, and no one else clears or takes it down",
      same(who.step, ON_STEP) && same(who.hand, BY_HAND) && strayClear.length === 0 && skyOn.length === 0 && skyOff.length === 0,
      JSON.stringify({ step: [...who.step].sort(), hand: [...who.hand].sort(), strayClear, skyOn, skyOff }));
  }
};
