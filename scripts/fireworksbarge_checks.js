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
//   7. the frame: draw calls bounded.
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
    L.sledForce();
    const c0 = L.flags.fbCountdowns || 0;
    let during = 0, after = null;
    for (let i = 0; i < 60 * 8; i++) {
      hold(); L.update(1 / 60);
      if (L.sled.phase === "count" && (L.flags.fbCountdowns || 0) > c0) during++;
      if (after === null && L.sled.phase !== "count" && (L.flags.fbCountdowns || 0) > c0) after = Math.round(i / 6) / 10;
    }
    out.wait = { during, after };
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
    share.wait.during === 0 && share.wait.after !== null, share.wait);
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
    for (let i = 0; i < 20; i++) frame();
    const idle = frame();
    L.fbForce();
    let worst = 0;
    for (let i = 0; i < 60 * 20; i++) { if (i % 12 === 0) worst = Math.max(worst, frame()); else { hold(); L.update(1 / 60); } }
    L.fbReset();
    return { idle, worst };
  });
  check(`fireworks barge: it costs at most 15 draw calls standing and 30 through the finale (${cost.idle}, ${cost.worst})`,
    cost.idle > 0 && cost.idle <= 15 && cost.worst <= 30, cost);
};
