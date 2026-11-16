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
//      peel-off, the dunes grid, the menu, the rule and the source.
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
    step(60 * 8, (i) => { L.api.setStick(0, 0); if (goAt < 0 && L.race.phase === "race") goAt = i; if (sledAt < 0 && sled.phase === "count") sledAt = i; }, () => L.race.phase);
    const g = tr.frames.slice(n0, n0 + Math.max(0, goAt));
    out.gridSeen = (() => { const o = []; let last = null, n = 0; for (const f of g) { if (f.k === last) n++; else { if (last !== null) o.push(last + "x" + n); last = f.k; n = 1; } } if (last !== null) o.push(last + "x" + n); return o.join(" "); })();
    Object.assign(out, { goAt, sledAt, gridTicks: g.reduce((m, f) => m + f.ticks, 0), gridMax: g.reduce((m, f) => Math.max(m, f.ticks), 0), after: seen(n0 + Math.max(0, goAt)).slice(0, 120), sledCounts: d("sledCountdowns", f0) });
  `);
  check("numeral (B6): the dunes race, by its button and its card -- the grid's 3-2-1 is the race's own (under the lamps, nothing up in the sky, one tick a lamp: three), and the rocket sled, whose wall is 900 m off the grid's nose, waits for the green instead of counting over the lamps (whether it counts after depends on where he drives: printed)",
    !grid.err && grid.raceBtn && grid.card && grid.on && grid.track === "dunes" && grid.goAt > 0 && /^(-r?x\d+ )*3rx\d+ 2rx\d+ 1rx\d+( -x\d+)?$/.test(grid.gridSeen) && grid.gridTicks === 3 && grid.gridMax === 1 && (grid.sledAt < 0 || grid.sledAt >= grid.goAt),
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
  // g. the source
  {
    const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..", "cockpit", "js");
    const bad = [], places = { endAll: [], bare: [] };
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
        }
        if (/\bcountdownEndAll\(\)/.test(code) && !/function countdownEndAll/.test(code)) places.endAll.push(`${f}:${i + 1}`);
        if (/\bsetBigNum\(/.test(code) && !/function setBigNum/.test(code)) places.bare.push(f);
      });
    }
    const endAllOk = places.endAll.length === 1 && /^setpieces\.js/.test(places.endAll[0]);
    const bareOk = places.bare.every(f => f === "setpieces.js");
    check("numeral (B6): every write and clear of the numeral in cockpit/js names its owner (a literal); the clear of all (countdownEndAll) is called in one place, the start's (towerCatchReset), and the bare write (setBigNum) only inside the mechanism in setpieces.js",
      bad.length === 0 && endAllOk && bareOk, JSON.stringify({ bad, endAll: places.endAll, bare: [...new Set(places.bare)] }));
  }
};
