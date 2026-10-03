"use strict";
// ---------------------------------------------------------------------------
// THE MONSTER TRUCK (v136), watched the way he will watch it.
//
//   1. the site: dry, out of the road's corridor, nothing else on the loop;
//   2. southbound hands-off: 3-2-1, the truck jumps (over 6 m of air), lands on
//      the cars, squashes all six flat, stops, drives round the loop home, the
//      cars pop back up exactly as they were, armed again -- the car never bangs,
//      touches anything or leaves the road, and no puff reaches the road;
//   3. the landing is in his windscreen, both cameras, both ways, every speed step;
//   4. away from it, nothing; the plane and the helicopter set it off;
//   5. solid: the truck at the start, a junk car (its solid height follows the
//      squash), the ramp is a surface;
//   6. it shares the numeral; the picker and a pull-over stand it down;
//   7. the frame.
// Renders are scripts/monstertruck_renders.js, and are LOOKED at.
// ---------------------------------------------------------------------------

module.exports = async function monsterTruckChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);
  // every other point-at set-piece reset, and the two the drive passes (the
  // fireworks barge before it, the launch pad after) held off so the numerals read are the truck's
  const resetAll = () => {
    const L = window.__lp; L.mtReset(); L.fbReset(); L.lsReset(); L.sledReset(); if (L.policeStop) L.policeStop(); L.setBigNum(null); L.spdReset();
    if (!window.__mtHeld) { window.__mtHeld = { fb: L.TUNE.fireworksBarge.carView, ls: L.TUNE.launchSite.armR }; }
    L.TUNE.fireworksBarge.carView = -1e6; L.TUNE.launchSite.armR = 0;
  };
  const restore = () => { const L = window.__lp, h = window.__mtHeld; if (h) { L.TUNE.fireworksBarge.carView = h.fb; L.TUNE.launchSite.armR = h.ls; window.__mtHeld = null; } };
  await page.evaluate(`window.__mtResetAll = ${resetAll.toString()}; window.__mtRestore = ${restore.toString()}`);

  // ---- 1. the site
  const site = await page.evaluate(() => {
    const L = window.__lp, M = L.mtruck, T = L.TUNE.monsterTruck;
    L.noRender = true; L.api.skipScreens();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    let wet = 0, inRoad = 0, nearRoad = 1e9;
    for (const p of M.path) {
      for (const s of [-T.trackW / 2, 0, T.trackW / 2]) {
        const x = p.x + M.west.x * s, z = p.z + M.west.z * s;
        if (L.terrainEff(x, z) < L.seaLevelAt(x, z) + 1) wet++;
        const d = L.hwyCorridorDist(x, z);
        nearRoad = Math.min(nearRoad, d);
        if (d < L.HW.clearHalf) inRoad++;
      }
    }
    let strangers = 0, ours = 0;
    const train = new Set(L.trainSolids);
    L.forEachSolid(b => {
      if (b.mt) { ours++; return; }
      if (train.has(b)) return;
      if (L.mtCovers(b.x, b.z, 0)) strangers++;
    });
    return { wet, inRoad, nearRoad: Math.round(nearRoad), strangers, ours, len: Math.round(M.len), phase: M.phase };
  });
  check(`monster truck: its loop is dry, out of the road's corridor, nothing else standing on it, and its cars, ramp and truck solid`,
    site.wet === 0 && site.inRoad === 0 && site.strangers === 0 && site.ours === 8 && site.phase === "armed", site);

  // ---- 2. southbound, hands-off
  const run = await page.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck, T = L.TUNE.monsterTruck;
    window.__mtResetAll();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const q = L.hwySampleAt(L.hwyNearest(300, 2200).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    const big = document.getElementById("bigNum");
    const nums = []; let last = "", f = 0, airMax = 0, flatAll = false, offRoad = 0, puffRoad = 0, puffs = 0, armedAgain = false, maxSq = 0;
    M.airMax = 0;
    for (; f < 60 * 150; f++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (st.exploding) break;
      const n = big.classList.contains("on") ? big.textContent : "";
      if (n && n !== last) nums.push(n);
      last = n;
      if (L.hwyCorridorDist(st.x, st.z) > 30) offRoad++;
      if (M.cars.every(c => c.sq > 0.95)) flatAll = true;
      if (f % 4 === 0) for (const p of L.mtPuffsLive()) { puffs++; if (L.hwyCorridorDist(p.x, p.z) < L.HW.clearHalf + p.r) puffRoad++; }
      if (d("mtHomes") > 0 && M.phase === "armed" && M.cars.every(c => !c.flat && !(c.pop > 0))) { armedAgain = true; break; }
    }
    const cars = L.mtCarsState();
    return { countdowns: d("mtCountdowns"), runs: d("mtRuns"), jumps: d("mtJumps"), landings: d("mtLandings"), crushes: d("mtCrushes"),
             homes: d("mtHomes"), restored: d("mtRestored"), nums: nums.join(""), airMax: Math.round(M.airMax * 10) / 10, flatAll, armedAgain,
             carsBack: cars.every(c => c.sq === 0 && Math.abs(c.y1 - T.carScale * 1.9) < 0.05), secs: Math.round(f / 60),
             crashes: d("carCrashes"), walls: d("wallHits"), touches: d("hwyTrafficHit"), offRoad, puffRoad, puffs };
  });
  check(`monster truck: southbound hands-off, 3-2-1, it jumps (over 6 m of air) and lands on the junk cars -- once`,
    run.countdowns === 1 && run.runs === 1 && run.nums === "321" && run.jumps === 1 && run.landings === 1 && run.airMax > 6, run);
  check(`monster truck: it squashes all six cars flat, drives round the loop home, and every car pops back exactly as it was`,
    run.crushes === 6 && run.flatAll && run.homes === 1 && run.restored === 1 && run.armedAgain && run.carsBack, run);
  check(`monster truck: through it the car never bangs, touches anything or leaves the road, and no dust reaches the road`,
    run.crashes === 0 && run.walls === 0 && run.touches === 0 && run.offRoad === 0 && run.puffRoad === 0 && run.puffs > 50, run);

  // ---- 3. the landing in his windscreen: both ways, every step; both cameras at the default
  // ON THE PORTRAIT iPAD he holds: a landscape page sees twice as wide
  const { page: pp } = await newPage(820, 1180);
  await pp.evaluate(`window.__mtResetAll = ${resetAll.toString()}; window.__mtRestore = ${restore.toString()}`);
  const view = await pp.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck, T = L.TUNE.monsterTruck, out = [];
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const n = L.spdStepsFor(L.spdKey()).length;
    for (const north of [false, true]) for (let step = 0; step < n; step++) for (const chase of (step === 1 ? [false, true] : [false])) {
      window.__mtResetAll();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.api.setView(chase);
      st.speedStep = step;
      const q = L.hwySampleAt(L.hwyNearest(300, north ? -1500 : 2200).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
      st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
      const l0 = L.flags.mtLandings || 0; let seen = null;
      for (let f = 0; f < 60 * 150 && !seen; f++) {
        L.api.setStick(0, 0); L.update(1 / 60);
        if ((L.flags.mtLandings || 0) > l0) {
          L.camera.updateMatrixWorld();
          const v = new L.camera.position.constructor(M.x, M.y + 4, M.z).project(L.camera);
          seen = { dir: north ? "N" : "S", step, cam: chase ? "chase" : "seat", d: Math.round(Math.hypot(M.x - st.x, M.z - st.z)), x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, front: v.z < 1 };
        }
      }
      out.push(seen || { dir: north ? "N" : "S", step, missed: true });
    }
    window.__mtResetAll(); window.__mtRestore();
    return out;
  });
  await pp.context().close();
  check(`monster truck: on the portrait iPad, the landing is in his windscreen, clear of the pillars (|x| < 0.55), both ways, at every speed step, in both cameras`,
    view.length >= 10 && view.every(o => !o.missed && o.front && Math.abs(o.x) < 0.55 && o.y > -0.3 && o.y < 0.6),
    view.filter(o => o.missed || !o.front || Math.abs(o.x) >= 0.55 || o.y <= -0.3 || o.y >= 0.6).concat([{ of: view.length }]));

  // ---- 4. away; the plane and the helicopter
  const more = await page.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck, T = L.TUNE.monsterTruck, out = {};
    const Lnd = L.mtLanding();
    window.__mtResetAll();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const q = L.hwySampleAt(L.hwyNearest(300, Lnd.z - 120).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
    let c0 = L.flags.mtCountdowns || 0, minD = 1e9;
    for (let f = 0; f < 60 * 15; f++) { L.api.setStick(0, 0); L.update(1 / 60); minD = Math.min(minD, Math.hypot(st.x - Lnd.x, st.z - Lnd.z)); }
    out.away = { countdowns: (L.flags.mtCountdowns || 0) - c0, minD: Math.round(minD) };
    window.__mtResetAll();
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    const px = Lnd.x - 700, pz = Lnd.z + 500;
    c0 = L.flags.mtCountdowns || 0;
    for (let f = 0; f < 60 * 2; f++) { st.phase = "AIRBORNE"; st.exploding = false; st.x = px; st.y = 200; st.z = pz; st.heading = Math.atan2(-(Lnd.x - px), -(Lnd.z - pz)); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; L.update(1 / 60); }
    out.plane = (L.flags.mtCountdowns || 0) - c0;
    window.__mtResetAll();
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    c0 = L.flags.mtCountdowns || 0;
    const hx = Lnd.x - 400, hz = Lnd.z - 300;
    for (let f = 0; f < 60 * 2; f++) { st.phase = "AIRBORNE"; st.x = hx; st.y = 60; st.z = hz; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = 60; L.heli.target = null; st.heading = Math.atan2(-(Lnd.x - hx), -(Lnd.z - hz)); L.update(1 / 60); }
    out.heli = (L.flags.mtCountdowns || 0) - c0;
    window.__mtResetAll();
    return out;
  });
  check(`monster truck: driving away from it, inside its range, nothing happens`, more.away.countdowns === 0 && more.away.minD < 600, more.away);
  check(`monster truck: the plane and the helicopter, nose at it, set it off`, more.plane === 1 && more.heli === 1, more);

  // ---- 5. solid
  const solid = await page.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck, T = L.TUNE.monsterTruck, out = {};
    window.__mtResetAll();
    const armR = T.armR;
    try {
      T.armR = 0;
      L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const into = (tx, ty, tz) => {
        st.phase = "AIRBORNE"; st.exploding = false; st.x = tx + M.west.x * 100; st.y = ty; st.z = tz + M.west.z * 100; st.heading = Math.atan2(M.west.x, M.west.z);
        L.heli.altitude = ty; L.heli.vx = -M.west.x * L.TUNE.heli.cruise; L.heli.vz = -M.west.z * L.TUNE.heli.cruise; L.heli.vy = 0; L.heli.speed = L.TUNE.heli.cruise;
        L.heli.target = { x: tx - M.west.x * 200, y: ty, z: tz - M.west.z * 200 };
        for (let i = 0; i < 60 * 4; i++) { L.update(1 / 60); if (st.exploding) return { d: Math.round(Math.hypot(st.x - tx, st.z - tz)) }; }
        return null;
      };
      out.truck = into(M.x, M.groundY + 3.4 * T.truckScale, M.z);
      window.__mtResetAll(); T.armR = 0;
      const c = M.cars[2];
      // a junk car: the plane diving on it (the helicopter's hover floor lifts it over a car at speed)
      L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
      L.api.teleportAirborne(3000, 0, 250, 0); T.armR = 0;
      {
        const tx = c.g.position.x, tz = c.g.position.z, ty = c.cy + c.h * 0.5, back = 40;
        st.phase = "AIRBORNE"; st.exploding = false; st.engaged = false;
        st.x = tx + M.west.x * back; st.z = tz + M.west.z * back; st.y = ty + back * Math.tan(8 * Math.PI / 180);
        st.heading = Math.atan2(M.west.x, M.west.z); st.pitch = -8; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.gearDown = false;
        const h0 = { ...(L.flags.solidHits || {}) };
        out.car = null;
        // a shallow dive at its flank, 40 m out: two-thirds of a second, too short for the auto-level to matter
        for (let i = 0; i < 60 * 3 && !out.car; i++) { L.api.setStick(0, 0); L.update(1 / 60);
          if (st.exploding) out.car = { d: Math.round(Math.hypot(st.x - tx, st.z - tz)), overGround: Math.round((st.y - L.terrainEff(st.x, st.z)) * 10) / 10 }; }
      }
      // a flat car is only as tall as it is squashed
      window.__mtResetAll(); T.armR = 0;
      out.carH = L.mtSquash(0, 0);
      out.carFlatH = L.mtSquash(0, 1);
      L.mtSquash(0, 0);
      out.ramp = !!M.ramp && M.ramp.kind === "ramp";
      // a helicopter left hovering low on the track ahead of the running truck:
      // stepped off it before the truck arrives, never banged, never carried along
      window.__mtResetAll(); T.armR = 0;
      L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const p = L.mtAt(60), hy = M.groundY + 4 * T.truckScale;
      st.phase = "AIRBORNE"; st.x = p.x; st.z = p.z; st.y = hy; st.heading = p.h;
      L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = hy; L.heli.target = null;
      const e0 = L.flags.exploded || 0, s0 = L.flags.mtSidesteps || 0;
      L.mtForce();
      let passed = false;
      for (let i = 0; i < 60 * 14 && !passed; i++) { L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.target = null; L.update(1 / 60); passed = M.d > 100; }
      out.hover = { passed, bangs: (L.flags.exploded || 0) - e0, sidesteps: (L.flags.mtSidesteps || 0) - s0,
                    off: Math.round(Math.abs((st.x - p.x) * Math.cos(p.h) - (st.z - p.z) * Math.sin(p.h))) };
    } finally { T.armR = armR; }
    window.__mtResetAll();
    return out;
  });
  check(`monster truck: the truck (the helicopter at cruise) and a junk car (the plane diving on it) are solid -- a bang, at them`,
    !!solid.truck && solid.truck.d < 20 && !!solid.car && solid.car.d < 8 && solid.car.overGround > 3.5, solid);
  check(`monster truck: a helicopter left hovering on the track is stepped off it before the truck arrives, never banged`,
    !!solid.hover && solid.hover.passed && solid.hover.bangs === 0 && solid.hover.sidesteps > 0 && solid.hover.off > 6, solid.hover);
  check(`monster truck: a squashed car's solid is only as tall as it is (${solid.carH && solid.carH.toFixed(1)} m -> ${solid.carFlatH && solid.carFlatH.toFixed(1)} m), and the ramp is a surface`,
    solid.carFlatH < solid.carH * 0.4 && solid.ramp, solid);

  // ---- 6. the numeral
  const share = await page.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck, out = {};
    window.__mtResetAll();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.mtForce(); for (let i = 0; i < 20; i++) L.update(1 / 60);
    out.busy = { sled: L.spCountBusy("rocketSled"), ls: L.spCountBusy("launchSite"), fb: L.spCountBusy("fireworksBarge") };
    const s0 = L.flags.mtStandDowns || 0;
    L.openPickerAnywhere(); L.update(1 / 60);
    const bn = document.getElementById("bigNum");
    out.picker = { standDowns: (L.flags.mtStandDowns || 0) - s0, numOn: bn.classList.contains("on"), phase: M.phase };
    L.api.skipScreens();
    window.__mtResetAll();
    L.mtForce(); for (let i = 0; i < 20; i++) L.update(1 / 60);
    const s1 = L.flags.mtStandDowns || 0;
    for (let i = 0; i < 5; i++) { L.police.active = true; L.police.state = "pullover"; L.update(1 / 60); }
    L.police.active = false; L.police.state = "away";
    out.police = { standDowns: (L.flags.mtStandDowns || 0) - s1, phase: M.phase, numOn: bn.classList.contains("on") };
    // and it waits for another's count
    window.__mtResetAll();
    L.sledForce(); L.update(1 / 60);
    out.waits = L.spCountBusy("monsterTruck");
    window.__mtResetAll();
    return out;
  });
  check(`monster truck: while it counts the others wait; it waits for theirs; the picker and a pull-over stand it down (the pull-over's own numeral takes over)`,
    share.busy.sled && share.busy.ls && share.busy.fb && share.waits && share.picker.standDowns === 1 && !share.picker.numOn && share.picker.phase === "armed" &&
    share.police.standDowns === 1 && share.police.phase === "armed", share);

  // ---- 7. the frame
  const cost = await page.evaluate(() => {
    const L = window.__lp, st = L.state, M = L.mtruck;
    window.__mtResetAll();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const Lnd = L.mtLanding();
    const q = L.hwySampleAt(L.hwyNearest(300, Lnd.z + 450).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-(Lnd.x - st.x), -(Lnd.z - st.z)); };
    const objs = () => [M.g, M.truck, M.reticle, M.puffMesh];
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
    L.mtForce();
    let worst = 0;
    for (let i = 0; i < 60 * 20; i++) { if (i % 12 === 0) worst = Math.max(worst, frame()); else { hold(); L.update(1 / 60); } }
    window.__mtResetAll();
    return { idle, worst };
  });
  check(`monster truck: it costs at most 34 draw calls standing and 38 running (${cost.idle}, ${cost.worst})`,
    cost.idle > 0 && cost.idle <= 34 && cost.worst <= 38, cost);
  await page.evaluate(() => window.__mtRestore());
};
