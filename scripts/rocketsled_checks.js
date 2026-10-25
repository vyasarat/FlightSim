"use strict";
// ---------------------------------------------------------------------------
// THE ROCKET SLED (v134), watched the way he will watch it: from the car on
// the motorway with his hands off, both ways, and from the plane.
//
//   1. the site: the rail, the wall and the bricks' field out of the road's
//      corridor and the airports', nothing else standing on them;
//   2. southbound out of the mountain tunnel, hands-off: nothing while he is in
//      the bore (he cannot see it), then 3-2-1, the sled blasts off, smashes
//      through the wall, pops its chutes and stops before the end of the rail,
//      rolls home, and the wall flies back together brick for brick -- while the
//      car never bangs, touches anything or leaves the road;
//   3. no brick and no puff of smoke ever lands in the road's corridor, and no
//      brick ever goes under the ground;
//   4. northbound, it goes too, with the wall in front of him; driving away
//      from it, nothing;
//   5. the wall and the parked sled are solid: flown into, a bang;
//   6. the frame: draw calls stay bounded.
// Renders are scripts/rocketsled_renders.js, and are LOOKED at.
// ---------------------------------------------------------------------------

module.exports = async function rocketSledChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);

  // ---- 1. the site
  const site = await page.evaluate(() => {
    const L = window.__lp, S = L.sled, T = L.TUNE.rocketSled;
    L.noRender = true; L.api.skipScreens();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    // every metre of both embankment edges, the wall's width, and how far a brick may fly
    const pts = [];
    for (let k = 0; k <= 1.0001; k += 0.01) {
      const x = T.n[0] + (T.s[0] - T.n[0]) * k, z = T.n[1] + (T.s[1] - T.n[1]) * k;
      pts.push([x - T.bankW / 2, z], [x + T.bankW / 2, z]);
    }
    const w = L.sledWallWorld();
    for (let i = -1; i <= 1; i += 0.1) pts.push([w.x + i * w.halfW, w.z]);
    const inRoad = pts.filter(([x, z]) => L.hwyCorridorDist(x, z) < L.HW.clearHalf).length;
    const inAir = pts.filter(([x, z]) => L.inCorridor(x, z, 0) && L.hwyCorridorDist(x, z) >= L.HW.clearHalf).length;
    let strangers = 0, ours = 0;
    const train = new Set(L.trainSolids);
    L.forEachSolid(b => {
      if (b.sled) { ours++; return; }
      if (train.has(b)) return;
      for (const [x, z] of pts) if (Math.abs(b.x - x) < b.hw + 4 && Math.abs(b.z - z) < b.hd + 4) { strangers++; return; }
    });
    return { inRoad, inAir, strangers, ours, phase: S.phase, built: !!S.g };
  });
  check(`rocket sled: built, its rail, wall and the bricks' landing field out of the road's and the airports' corridors, nothing else standing on them, solid`,
    site.built && site.inRoad === 0 && site.inAir === 0 && site.strangers === 0 && site.ours >= 3 && site.phase === "armed", site);

  // ---- 2 + 3. southbound out of the tunnel, hands-off
  const run = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    L.sledReset(); L.spdReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    // in the bore, well before its southern portal, nose down the road
    const sStart = L.hwyNearest(10, -1500).s;
    const q = L.hwySampleAt(sStart), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y;
    st.heading = Math.atan2(-q.fx, -q.fz); st.speed = 0;
    const startsInBore = L.hwyBoreCeiling(st.x, st.z) !== null;
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    const big = document.getElementById("bigNum");
    const nums = []; let last = "";
    let inBoreCount = 0, maxV = 0, offRoad = 0, brickRoad = 0, brickUnder = 0, puffRoad = 0, samples = 0, stopAt = null, f = 0;
    let homeDone = false, smashSeen = null;
    for (; f < 60 * 120; f++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (st.exploding) break;
      const n = big.classList.contains("on") ? big.textContent : "";
      if (n && n !== last) nums.push(n);
      last = n;
      if (L.hwyBoreCeiling(st.x, st.z) !== null) {
        if (S.phase !== "armed") inBoreCount++;
      }
      maxV = Math.max(maxV, S.v);
      if (S.phase === "rest" && stopAt === null) stopAt = Math.round(S.d);
      if (smashSeen === null && (L.flags.sledSmashes || 0) > (f0.sledSmashes || 0)) {
        // where the smash lands, from his seat: how far ahead, and how far off his nose
        const w = L.sledWallWorld(), dx = w.x - st.x, dz = w.z - st.z;
        const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
        smashSeen = { ahead: Math.round(dx * fx + dz * fz), offDeg: Math.round(Math.acos((dx * fx + dz * fz) / Math.hypot(dx, dz)) / Math.PI * 180) };
      }
      if (L.hwyCorridorDist(st.x, st.z) > 30) offRoad++;
      if (f % 4 === 0) {
        for (const b of L.sledBricksLive()) {
          samples++;
          if (L.hwyCorridorDist(b.x, b.z) < L.HW.clearHalf + b.r) brickRoad++;
          if (b.y < L.terrainEff(b.x, b.z) - 0.6) brickUnder++;
        }
        for (const p of L.sledPuffsLive()) if (L.hwyCorridorDist(p.x, p.z) < L.HW.clearHalf + p.r) puffRoad++;
      }
      if (d("sledHomes") > 0 && S.phase === "armed") { homeDone = true; break; }
    }
    return {
      countdowns: d("sledCountdowns"), runs: d("sledRuns"), smashes: d("sledSmashes"), chutes: d("sledChutes"),
      rebuilds: d("sledRebuilds"), homes: d("sledHomes"), nums: nums.join(""), inBoreCount, maxV: Math.round(maxV),
      stopAt, railLen: Math.round(S.len), secs: Math.round(f / 60), homeDone, slotErr: L.sledSlotError(),
      wallSolid: L.sledWallSolid(), crashes: d("carCrashes"), walls: d("wallHits"), touches: d("hwyTrafficHit"),
      offRoad, brickRoad, brickUnder, puffRoad, samples, smashSeen, startsInBore,
    };
  });
  check(`rocket sled: southbound out of the tunnel, hands-off, nothing starts while he is in the bore, then 3-2-1 and it blasts off -- once`,
    run.countdowns === 1 && run.runs === 1 && run.nums === "321" && run.inBoreCount === 0 && run.startsInBore, run);
  check(`rocket sled: it goes FAST (over 100 m/s), smashes through the wall, pops its chutes and stops before the end of the rail`,
    run.maxV > 100 && run.smashes === 1 && run.chutes === 1 && run.stopAt !== null && run.stopAt < run.railLen - 5,
    { maxV: run.maxV, smashes: run.smashes, chutes: run.chutes, stopAt: run.stopAt, railLen: run.railLen });
  check(`rocket sled: it rolls home and the wall flies back together, every brick exactly in its slot, solid again, armed`,
    run.homeDone && run.rebuilds === 1 && run.slotErr < 0.01 && run.wallSolid, { homes: run.homes, rebuilds: run.rebuilds, slotErr: run.slotErr, solid: run.wallSolid, secs: run.secs });
  check(`rocket sled: from the driving seat the smash lands AHEAD of him, inside the windscreen (under 20 degrees off his nose, 300-600 m out)`,
    !!run.smashSeen && run.smashSeen.offDeg < 20 && run.smashSeen.ahead > 300 && run.smashSeen.ahead < 600, run.smashSeen);
  check(`rocket sled: through the whole show the car, hands-off, never bangs, never touches anything and never leaves the road`,
    run.crashes === 0 && run.walls === 0 && run.touches === 0 && run.offRoad === 0, run);
  check(`rocket sled: no flying brick and no puff of smoke ever reaches the road, and no brick goes under the ground (${run.samples} brick-samples)`,
    run.samples > 500 && run.brickRoad === 0 && run.puffRoad === 0 && run.brickUnder === 0, run);

  // ---- 3b. the tunnel guard, exercised: with the arming range stretched so the
  // wall IS in range and in his cone while he is still in the bore, it still
  // waits until he is out
  const bore = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    const carView = T.carView;
    let out;
    try {
      T.carView = 3000;
      L.sledReset(); L.spdReset();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const q = L.hwySampleAt(L.hwyNearest(150, -1500).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz);
      const c0 = L.flags.sledCountdowns || 0;
      let aimedInBore = 0, startedInBore = 0, startedOutAt = null;
      for (let f = 0; f < 60 * 60 && startedOutAt === null; f++) {
        L.api.setStick(0, 0); L.update(1 / 60);
        const inBore = L.hwyBoreCeiling(st.x, st.z) !== null;
        const w = L.sledWallWorld(), dx = w.x - st.x, dz = w.z - st.z, dh = Math.hypot(dx, dz);
        const aimed = (dx * -Math.sin(st.heading) + dz * -Math.cos(st.heading)) / dh > Math.cos(T.coneDeg * Math.PI / 180);
        if (inBore && aimed) aimedInBore++;
        if ((L.flags.sledCountdowns || 0) > c0) { if (inBore) startedInBore++; else startedOutAt = Math.round(L.hwyNearest(st.x, st.z).s); }
      }
      out = { aimedInBore, startedInBore, startedOutAt };
    } finally { T.carView = carView; }
    L.sledReset();
    return out;
  });
  check(`rocket sled: inside the mountain tunnel it never starts, even with the wall in range and dead ahead -- it goes the moment he is out`,
    bore.aimedInBore > 60 && bore.startedInBore === 0 && bore.startedOutAt !== null, bore);

  // ---- 4. northbound, with the wall in front of him; and away from it
  const dirs = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    const out = {};
    const place = (z, north) => {
      L.sledReset();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const q = L.hwySampleAt(L.hwyNearest(150, z).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y;
      st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz); st.speed = 0;
    };
    // northbound from 1 km south of the wall
    place(T.s[1] - 800, true);
    let c0 = L.flags.sledCountdowns || 0, wallAhead = null;
    for (let f = 0; f < 60 * 30 && (L.flags.sledCountdowns || 0) === c0; f++) { L.api.setStick(0, 0); L.update(1 / 60); }
    const w = L.sledWallWorld();
    out.north = (L.flags.sledCountdowns || 0) - c0;
    out.wallAhead = st.z < w.z;
    // southbound but already past the whole thing: it is behind him
    place(T.s[1] - 50, false);
    c0 = L.flags.sledCountdowns || 0;
    let minD = 1e9;
    const wl = L.sledWallWorld();
    for (let f = 0; f < 60 * 25; f++) { L.api.setStick(0, 0); L.update(1 / 60); minD = Math.min(minD, Math.hypot(st.x - wl.x, st.z - wl.z)); }
    out.away = (L.flags.sledCountdowns || 0) - c0;
    out.minD = Math.round(minD);
    L.sledReset();
    return out;
  });
  check(`rocket sled: northbound it goes too, with the wall in front of him`, dirs.north === 1 && dirs.wallAhead, dirs);
  check(`rocket sled: driving away from it, inside its range, nothing happens -- it is something he points at`,
    dirs.away === 0 && dirs.minD < 420, dirs);

  // ---- 4b. at every speed step, both ways, the smash lands in his windscreen
  const steps = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    const out = [];
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const n = L.spdStepsFor(L.spdKey()).length;
    for (const north of [false, true]) for (let step = 0; step < n; step++) {
      L.sledReset();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      st.speedStep = step;
      const q = L.hwySampleAt(L.hwyNearest(150, north ? T.s[1] - 1300 : -1500).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
      st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
      st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
      const s0 = L.flags.sledSmashes || 0;
      let seen = null;
      for (let f = 0; f < 60 * 240 && !seen; f++) {
        L.api.setStick(0, 0); L.update(1 / 60);
        if ((L.flags.sledSmashes || 0) > s0) {
          const w = L.sledWallWorld(), dx = w.x - st.x, dz = w.z - st.z, fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
          seen = { dir: north ? "N" : "S", step, v: Math.round(st.speed), ahead: Math.round(dx * fx + dz * fz), offDeg: Math.round(Math.acos((dx * fx + dz * fz) / Math.hypot(dx, dz)) / Math.PI * 180) };
        }
      }
      out.push(seen || { dir: north ? "N" : "S", step, missed: true });
    }
    L.spdReset(); L.sledReset();
    return out;
  });
  check(`rocket sled: at every speed step, both ways, the smash lands ahead inside the windscreen (under 20 degrees, 250-750 m)`,
    steps.length >= 4 && steps.every(o => !o.missed && o.offDeg < 20 && o.ahead > 250 && o.ahead < 750), steps);

  // ---- 5. solid: the wall, the parked sled
  const solid = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    const out = {};
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    const put = (x, y, z, hx, hz) => {
      st.phase = "AIRBORNE"; st.exploding = false; st.engaged = false;
      st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-hx, -hz); st.pitch = 0; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.gearDown = false;
    };
    const fly = (near) => { for (let i = 0; i < 60 * 5; i++) { L.api.setStick(0, 0); L.update(1 / 60); if (st.exploding) return near(); } return null; };
    const w = L.sledWallWorld();
    L.sledReset();
    const armR = T.armR;
    T.armR = 0;    // the plane must not set it off on the way in: this is about the wall standing
    try {
    put(w.x - 150, w.y + 8, w.z - 1, 1, 0);
    out.wall = fly(() => ({ dx: Math.round(st.x - w.x), dz: Math.round(st.z - w.z) }));
    L.sledReset();
    // from the road side, level with its body (the start tower stands west of it)
    put(S.x + 60, S.y + 1.9 * T.size, S.z, -1, 0);
    out.sled = fly(() => ({ dx: Math.round(st.x - S.x), dz: Math.round(st.z - S.z) }));
    } finally { T.armR = armR; }
    // and while it RUNS: the plane, at speed (so nothing steps it aside), met
    // head-on down the rail, high enough over the embankment not to be landing on it
    L.sledReset(); L.sledForce();
    for (let i = 0; i < 60 * (T.count + 1.5); i++) { put(S.x, 400, S.z + 2500, 0, 1); L.update(1 / 60); }
    {
      const ahead = 70;
      put(S.x + L.sled.dirX * ahead, T.railY + 0.5 + 1.9 * T.size + 2.5, S.z + L.sled.dirZ * ahead, -L.sled.dirX, -L.sled.dirZ);
      const f0 = { ...(L.flags.solidHits || {}) };
      out.headOn = fly(() => ({ dAlong: Math.round((st.x - S.x) * L.sled.dirX + (st.z - S.z) * L.sled.dirZ), v: Math.round(S.v), phase: S.phase,
                                pillar: ((L.flags.solidHits || {})["plane:pillar:crash"] || 0) - (f0["plane:pillar:crash"] || 0) }));
    }
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const d0 = 160, hx = T.n[0] + L.sled.dirX * d0, hz = T.n[1] + L.sled.dirZ * d0, hy = T.railY + 0.5 + 1.9 * T.size;
    const hov = () => { st.phase = "AIRBORNE"; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = hy; L.heli.target = null; st.speed = 0; };
    // ... and left to its own devices (not pinned): how far does it go, and where?
    L.sledReset();
    st.x = hx; st.y = hy; st.z = hz; st.heading = Math.atan2(L.sled.dirX, L.sled.dirZ); hov();
    const ss0 = L.flags.sledSidesteps || 0, e1 = L.flags.exploded || 0;
    L.sledForce();
    let passed2 = false;
    for (let i = 0; i < 60 * 12 && !passed2; i++) { L.update(1 / 60); passed2 = S.d > d0 + 60; }
    const ox = st.x - hx, oz = st.z - hz;
    out.free = { passed: passed2, bangs: (L.flags.exploded || 0) - e1, sidesteps: (L.flags.sledSidesteps || 0) - ss0,
                 west: Math.round(ox * L.sled.dirZ - oz * L.sled.dirX), along: Math.round(ox * L.sled.dirX + oz * L.sled.dirZ) };

    L.sledReset();
    return out;
  });
  check(`rocket sled: the wall of bricks is solid -- flown into, a bang, at the wall`,
    // it meets the wall's west end, half the wall's width from its middle
    !!solid.wall && Math.abs(solid.wall.dz) < 8 && Math.abs(solid.wall.dx) < 50, solid);
  check(`rocket sled: the sled waiting at the start is solid -- flown into, a bang, at the sled`,
    !!solid.sled && Math.abs(solid.sled.dx) < 15 && Math.abs(solid.sled.dz) < 15, solid);
  check(`rocket sled: the sled is solid while it RUNS -- the plane met head-on down the rail, at speed, is a bang at its nose`,
    !!solid.headOn && solid.headOn.phase === "run" && solid.headOn.v > 40 && solid.headOn.pillar === 1 && solid.headOn.dAlong > 0 && solid.headOn.dAlong < 40, solid.headOn);
  check(`rocket sled: a helicopter left hovering on the rail is stepped aside, west, before the sled reaches it -- not carried down the rail, never banged`,
    !!solid.free && solid.free.passed && solid.free.bangs === 0 && solid.free.sidesteps > 0 && solid.free.west > 3 && Math.abs(solid.free.along) < 25, solid.free);

  // ---- 5b. the numeral is shared: the sled stands down for the police and the
  // picker, and neither it nor the launch pad starts while another countdown shows
  const share = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled, LS = L.TUNE.launchSite;
    const out = {};
    // the police pull him over mid-count
    L.sledReset(); L.sledForce();
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const sd0 = L.flags.sledStandDowns || 0;
    for (let i = 0; i < 5; i++) { L.police.active = true; L.police.state = "pullover"; L.update(1 / 60); }
    L.police.active = false; L.police.state = "away"; L.setBigNum(null);
    out.police = { standDowns: (L.flags.sledStandDowns || 0) - sd0, phase: S.phase, sky: document.getElementById("bigNum").classList.contains("sky") };
    // the picker opened mid-count: the sled's numeral goes with it, read off the numeral itself
    L.sledReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    L.sledForce();
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const numUp = document.getElementById("bigNum").classList.contains("on");
    const sd1 = L.flags.sledStandDowns || 0;
    L.openPickerAnywhere();
    L.update(1 / 60);
    const bn = document.getElementById("bigNum");
    out.picker = { numUpBefore: numUp, menu: L.menuOpen(), standDowns: (L.flags.sledStandDowns || 0) - sd1, numOn: bn.classList.contains("on"), text: bn.textContent, sky: bn.classList.contains("sky"), phase: S.phase };
    L.api.skipScreens();
    // the other way round: the sled, pointed at, waits while the launch pad counts
    L.sledReset(); if (L.lsReset) L.lsReset();
    const wq = L.sledWallWorld();
    const q2 = L.hwySampleAt(L.hwyNearest(150, wq.z + 400).s), off2 = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold2 = () => { st.x = q2.x - q2.fz * off2; st.z = q2.z + q2.fx * off2; st.y = q2.y; st.speed = 0; st.heading = Math.atan2(-q2.fx, -q2.fz); };
    L.lsForce();
    const sc0 = L.flags.sledCountdowns || 0;
    let dur2 = 0, after2 = null;
    for (let i = 0; i < 60 * 8; i++) {
      hold2(); L.update(1 / 60);
      if (L.lsite.phase === "count" && (L.flags.sledCountdowns || 0) > sc0) dur2++;
      if (after2 === null && L.lsite.phase !== "count" && (L.flags.sledCountdowns || 0) > sc0) after2 = Math.round(i / 6) / 10;
    }
    out.reverse = { startedDuringLaunch: dur2, startedAfter: after2 };
    // the launch pad, pointed at, waits while the sled's numeral is up
    L.sledReset(); if (L.lsReset) L.lsReset();
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    const px = LS.x - 500, pz = LS.z + 900, py = L.terrainEff(px, pz) + 200;
    const hold = () => { st.phase = "AIRBORNE"; st.exploding = false; st.x = px; st.y = py; st.z = pz; st.heading = Math.atan2(-(LS.x - px), -(LS.z - pz)); st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; };
    L.sledForce();                                      // the sled's 3-2-1 is on the numeral
    const c0 = L.flags.lsCountdowns || 0;
    let during = 0, after = null;
    for (let i = 0; i < 60 * 8; i++) {
      hold(); L.update(1 / 60);
      if (S.phase === "count" && (L.flags.lsCountdowns || 0) > c0) during++;
      if (after === null && S.phase !== "count" && (L.flags.lsCountdowns || 0) > c0) after = Math.round(i / 6) / 10;
    }
    out.launch = { startedDuringSled: during, startedAfter: after };
    L.sledReset(); if (L.lsReset) L.lsReset();
    return out;
  });
  check(`rocket sled: a police pull-over mid-count stands it down and takes back the numeral`,
    share.police.standDowns === 1 && share.police.phase === "armed" && !share.police.sky, share.police);
  check(`rocket sled: the picker opened mid-count stands it down and the numeral goes with it`,
    share.picker.numUpBefore && share.picker.menu && share.picker.standDowns === 1 && !share.picker.numOn && !share.picker.sky && share.picker.phase === "armed", share.picker);
  check(`rocket sled: the sled, pointed at, waits while the launch pad's numeral is up and goes once it is down`,
    share.reverse.startedDuringLaunch === 0 && share.reverse.startedAfter !== null, share.reverse);
  check(`rocket sled: the launch pad, pointed at, waits while the sled's numeral is up and goes once it is down`,
    share.launch.startedDuringSled === 0 && share.launch.startedAfter !== null, share.launch);

  // ---- 5c. portrait, both cameras: at the smash, the wall is on the screen and
  // clear of the windscreen pillars (the portrait iPad sees less to the side)
  for (const [w, h] of [[820, 1180], [768, 1024]]) {
    const { page: pg } = await newPage(w, h);
    const r = await pg.evaluate(() => {
      const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
      L.noRender = true; L.api.skipScreens();
      const out = [];
      for (const north of [false, true]) for (const chase of [false, true]) {
        L.sledReset(); L.spdReset();
        L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.api.setView(chase);
        const q = L.hwySampleAt(L.hwyNearest(150, north ? T.s[1] - 1300 : -1500).s), off = (north ? -1 : 1) * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
        st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
        st.heading = north ? Math.atan2(q.fx, q.fz) : Math.atan2(-q.fx, -q.fz);
        const s0 = L.flags.sledSmashes || 0;
        let seen = null;
        for (let f = 0; f < 60 * 120 && !seen; f++) {
          L.api.setStick(0, 0); L.update(1 / 60);
          if ((L.flags.sledSmashes || 0) > s0) {
            const wl = L.sledWallWorld();
            L.camera.updateMatrixWorld();
            const v = new L.camera.position.constructor(wl.x, wl.y + T.wallRows * T.brick[1] / 2, wl.z).project(L.camera);
            seen = { dir: north ? "N" : "S", cam: chase ? "chase" : "seat", x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, front: v.z < 1 };
          }
        }
        out.push(seen || { dir: north ? "N" : "S", cam: chase ? "chase" : "seat", missed: true });
      }
      L.sledReset();
      return out;
    });
    await pg.context().close();
    // the seat's pillars stand at about the outer tenth of a portrait screen
    check(`rocket sled: at ${w}x${h}, both ways, in both cameras, the smash is on the screen clear of the pillars at the moment it happens`,
      r.length === 4 && r.every(o => !o.missed && o.front && Math.abs(o.x) < 0.8 && Math.abs(o.y) < 0.9), r);
  }

  // ---- 6. the frame
  const cost = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.sled, T = L.TUNE.rocketSled;
    L.sledReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const w = L.sledWallWorld();
    const q = L.hwySampleAt(L.hwyNearest(150, w.z + 500).s), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
                         st.heading = Math.atan2(-(w.x - st.x), -(w.z - st.z)); };
    const objs = () => [S.g, S.sledG, S.brickMesh, S.puffMesh];
    const calls = () => { L.renderer.render(L.scene, L.camera); return L.renderer.info.render.calls; };
    const frame = () => {
      hold(); L.noRender = false; L.update(1 / 60); L.noRender = true;
      const all = calls();
      const was = objs().map(o => o.visible);
      objs().forEach(o => { o.visible = false; });
      const without = calls();
      objs().forEach((o, i) => { o.visible = was[i]; });
      return all - without;
    };
    for (let i = 0; i < 20; i++) frame();
    const idle = frame();
    L.sledForce();
    let worst = 0;
    for (let i = 0; i < 60 * 25; i++) { if (i % 15 === 0) worst = Math.max(worst, frame()); else { hold(); L.update(1 / 60); } }
    L.sledReset();
    return { idle, worst };
  });
  check(`rocket sled: the site costs at most 20 draw calls standing and 30 through the run (${cost.idle}, ${cost.worst})`,
    cost.idle > 0 && cost.idle <= 20 && cost.worst <= 30, cost);
};
