"use strict";
// ---------------------------------------------------------------------------
// THE LAUNCH SITE (v133), watched the way he will watch it: from the car going
// down the motorway with his hands off, and from the plane.
//
//   1. the site: dry, out of the road's corridor, nothing streamed standing in it;
//   2. hands-off down the motorway towards it: the countdown runs 5-4-3-2-1 in
//      big numerals, the rocket lifts off and climbs, both side boosters come
//      home and land upright on their own pads, and a fresh stack rises -- while
//      the car never bangs, never touches anything and never leaves the road;
//   3. the cloud never reaches the road (readability beats realism);
//   4. pointing AWAY from it, nothing happens -- it is something he aims at;
//   5. the plane, pointed at it, sets it off too; and the rocket on the pad is
//      solid: flown into, it is a bang;
//   6. the frame through the launch: draw calls stay bounded.
// Renders are scripts/launchsite_renders.js, and are LOOKED at.
// ---------------------------------------------------------------------------

module.exports = async function launchSiteChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);

  // ---- 1. the site
  const site = await page.evaluate(() => {
    const L = window.__lp, S = L.lsite, T = L.TUNE.launchSite;
    L.noRender = true; L.api.skipScreens();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const wet = [[T.x, T.z], ...T.lz].filter(([x, z]) => L.terrainEff(x, z) < L.seaLevelAt(x, z) + 1).length;
    // every edge of the plinth and of both landing pads stays out of the road's own corridor
    const edge = [];
    for (let k = -1; k <= 1; k += 0.25) for (const [ex, ez] of [[-1, k], [1, k], [k, -1], [k, 1]]) edge.push([T.x + ex * T.padHalf, T.z + ez * T.padHalf]);
    for (const [x, z] of T.lz) for (let a = 0; a < 16; a++) edge.push([x + Math.cos(a / 8 * Math.PI) * T.lzR, z + Math.sin(a / 8 * Math.PI) * T.lzR]);
    const inRoad = edge.filter(([x, z]) => L.hwyCorridorDist(x, z) < L.HW.clearHalf).length;
    const onRail = edge.filter(([x, z]) => Math.abs(x - L.TRAIN_X) < 16 && z > L.TRAIN_ZMIN && z < L.TRAIN_ZMAX).length;
    // nothing else standing on the plinth or the landing pads (the train is
    // not standing anywhere: it passes, behind the pad)
    const train = new Set(L.trainSolids);
    let strangers = 0;
    L.forEachSolid(b => {
      if (b.ls || train.has(b)) return;
      const onPad = Math.abs(b.x - T.x) < T.padHalf + b.hw + 4 && Math.abs(b.z - T.z) < T.padHalf + b.hd + 4;
      const onLz = T.lz.some(([x, z]) => Math.hypot(b.x - x, b.z - z) < T.lzR + Math.max(b.hw, b.hd) + 4);
      if (onPad || onLz) strangers++;
    });
    let ours = 0; L.forEachSolid(b => { if (b.ls) ours++; });
    return { wet, inRoad, onRail, strangers, ours, built: !!S.g, phase: S.phase };
  });
  check(`launch site: built, dry, out of the road's corridor and off the railway, nothing streamed standing in it, and its pad and tower solid`,
    site.built && site.wet === 0 && site.inRoad === 0 && site.onRail === 0 && site.strangers === 0 && site.ours >= 4 && site.phase === "armed", site);

  // ---- 2 + 3. down the motorway, hands off, towards it
  const run = await page.evaluate(() => {
    const L = window.__lp, st = L.state, S = L.lsite, T = L.TUNE.launchSite;
    L.lsReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    // on the southbound carriageway 2.4 km before the pad, nose down the road
    const sPad = L.hwyNearest(T.x, T.z).s;
    const q = L.hwySampleAt(sPad - 2400), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y;
    st.heading = Math.atan2(-q.fx, -q.fz); st.speed = 0;
    const f0 = { ...L.flags };
    const d = k => (L.flags[k] || 0) - (f0[k] || 0);
    const nums = []; let lastNum = "";
    let maxAlt = 0, offRoad = 0, puffInRoad = 0, puffsSeen = 0, restacked = false, armedAgain = false;
    let liftAt = -1, f = 0, jumpM = 0, jumpDeg = 0;
    const big = document.getElementById("bigNum");
    for (; f < 60 * 150; f++) {
      L.api.setStick(0, 0);
      L.update(1 / 60);
      if (st.exploding) break;
      const n = big.classList.contains("on") ? big.textContent : "";
      if (n && n !== lastNum) nums.push(n);
      lastNum = n;
      if (liftAt < 0 && d("lsLiftoffs") > 0) liftAt = f;
      if (S.flying) maxAlt = Math.max(maxAlt, S.alt);
      if (L.hwyCorridorDist(st.x, st.z) > 30) offRoad++;
      if (f % 6 === 0) for (const p of L.lsPuffsLive()) {
        puffsSeen++;
        if (L.hwyCorridorDist(p.x, p.z) < L.HW.clearHalf + p.r) puffInRoad++;
      }
      // the boosters never jump: per frame, under 400 m/s of travel and 8 degrees of turn
      for (const b of S.boosters) {
        if (b.mode === "stack" || b.mode === "spare") { b.__p = null; continue; }
        const p = { x: b.g.position.x, y: b.g.position.y, z: b.g.position.z, q: b.g.quaternion.clone() };
        if (b.__p) {
          jumpM = Math.max(jumpM, Math.hypot(p.x - b.__p.x, p.y - b.__p.y, p.z - b.__p.z) * 60);
          jumpDeg = Math.max(jumpDeg, p.q.angleTo(b.__p.q) / Math.PI * 180);
        }
        b.__p = p;
      }
      if (d("lsRestacks") > 0) restacked = true;
      if (restacked && S.phase === "armed") { armedAgain = true; break; }
    }
    const B = S.boosters.map(b => ({ landed: b.landed, dLz: Math.round(Math.hypot(b.x - b.lzX, b.z - b.lzZ) * 10) / 10, tilt: Math.round(b.tiltDeg * 10) / 10 }));
    return {
      countdowns: d("lsCountdowns"), liftoffs: d("lsLiftoffs"), seps: d("lsSeparations"), landings: d("lsBoosterLandings"),
      restacks: d("lsRestacks"), nums: nums.join(""), maxAlt: Math.round(maxAlt), secs: Math.round(f / 60),
      crashes: d("carCrashes"), walls: d("wallHits"), touches: d("hwyTrafficHit"), offRoad, puffInRoad, puffsSeen,
      armedAgain, solidAgain: L.lsStackSolid(), boosters: B, maxLandTilt: Math.max(...(S.lastLandings || [99])),
      landDist: S.lastLandDist || [], jumpM: Math.round(jumpM), jumpDeg: Math.round(jumpDeg * 10) / 10,
    };
  });
  check(`launch site: hands-off down the motorway at it, the countdown runs 5-4-3-2-1 in big numerals and it lifts off -- once`,
    run.countdowns === 1 && run.liftoffs === 1 && run.nums === "54321", run);
  check(`launch site: the rocket climbs out of sight (over 1500 m) and both side boosters separate`,
    run.maxAlt > 1500 && run.seps === 1, { maxAlt: run.maxAlt, seps: run.seps });
  check(`launch site: both boosters fly home and land UPRIGHT on their own pads (under 4 degrees, inside the pad)`,
    run.landings === 2 && run.maxLandTilt < 4 && run.landDist.length === 2 && run.landDist.every(x => x < 8), { landings: run.landings, tilt: run.maxLandTilt, dist: run.landDist });
  check(`launch site: a booster flying home never jumps -- per frame under 400 m/s and 8 degrees (${run.jumpM} m/s, ${run.jumpDeg} deg)`,
    run.jumpM > 50 && run.jumpM < 400 && run.jumpDeg < 8, { jumpM: run.jumpM, jumpDeg: run.jumpDeg });
  check(`launch site: a fresh stack rises out of the pad, solid, armed for next time`,
    run.restacks === 1 && run.armedAgain && run.solidAgain, { restacks: run.restacks, armed: run.armedAgain, solid: run.solidAgain, secs: run.secs });
  check(`launch site: through the whole show the car, hands-off, never bangs, never touches anything and never leaves the road`,
    run.crashes === 0 && run.walls === 0 && run.touches === 0 && run.offRoad === 0, { crashes: run.crashes, walls: run.walls, touches: run.touches, offRoad: run.offRoad });
  check(`launch site: the launch cloud never reaches the road (sampled every tenth of a second, ${run.puffsSeen} puff-samples)`,
    run.puffsSeen > 200 && run.puffInRoad === 0, { seen: run.puffsSeen, inRoad: run.puffInRoad });

  // ---- 4. pointing away: nothing
  const away = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE.launchSite;
    L.lsReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    // northbound, already past it: the pad is behind him the whole way
    const sPad = L.hwyNearest(T.x, T.z).s;
    const q = L.hwySampleAt(sPad - 150), off = -(L.HW.medianW / 2 + L.HW.laneW * 0.5);
    st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y;
    st.heading = Math.atan2(q.fx, q.fz); st.speed = 0;
    const c0 = L.flags.lsCountdowns || 0;
    let minD = 1e9;
    for (let f = 0; f < 60 * 40; f++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      minD = Math.min(minD, Math.hypot(st.x - T.x, st.z - T.z));
    }
    return { countdowns: (L.flags.lsCountdowns || 0) - c0, minD: Math.round(minD), phase: L.lsite.phase };
  });
  check(`launch site: driving AWAY from it with the pad behind him, inside its range, nothing happens -- it is something he points at`,
    away.countdowns === 0 && away.minD < 1500 && away.phase === "armed", away);

  // ---- 5. the plane: pointed at it, it goes; flown into on the pad, a bang
  const plane = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE.launchSite, S = L.lsite;
    L.lsReset();
    L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 200, 0);
    const put = (x, y, z, hx, hz) => {
      st.phase = "AIRBORNE"; st.exploding = false; st.engaged = false;
      st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-hx, -hz); st.pitch = 0; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.gearDown = false;
    };
    // 1300 m north-west, nose at the pad, 200 m up
    const sx = T.x - 600, sz = T.z + 1150;
    put(sx, L.terrainEff(sx, sz) + 200, sz, T.x - sx, T.z - sz);
    const c0 = L.flags.lsCountdowns || 0;
    let f = 0;
    for (; f < 60 * 6 && (L.flags.lsCountdowns || 0) === c0; f++) { L.api.setStick(0, 0); L.update(1 / 60); }
    const went = (L.flags.lsCountdowns || 0) - c0;
    // into the stack on the pad, level, at half its height
    L.lsReset();
    const hx = T.x - 160, y = S.padY + 40;
    put(hx, y, T.z, 1, 0);
    let banged = false, at = null;
    for (let i = 0; i < 60 * 6 && !banged; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if (st.exploding) { banged = true; at = Math.round(st.x - T.x); }
    }
    return { went, secs: Math.round(f / 60 * 10) / 10, banged, at };
  });
  check(`launch site: the plane, nose at it, sets it off too`, plane.went === 1, plane);
  check(`launch site: the rocket standing on the pad is solid -- flown into, it is a bang, at the rocket`,
    plane.banged && plane.at !== null && Math.abs(plane.at) < 30, plane);

  // ---- 5b. solid wherever it is: flown into while it climbs, and a landed booster
  const moving = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE.launchSite, S = L.lsite;
    const out = {};
    const put = (x, y, z, hx, hz) => {
      st.phase = "AIRBORNE"; st.exploding = false; st.engaged = false;
      st.x = x; st.y = y; st.z = z; st.heading = Math.atan2(-hx, -hz); st.pitch = 0; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.gearDown = false;
    };
    const fly = (n, near) => { for (let i = 0; i < n; i++) { L.api.setStick(0, 0); L.update(1 / 60); if (st.exploding) return near(); } return null; };
    // 10 s into the climb, the plane level with its middle, coming straight at it
    L.lsReset(); L.api.setVehicle("prop"); L.api.placeOnRunway(); for (let i = 0; i < 5; i++) L.update(1 / 60);
    L.api.teleportAirborne(3000, 0, 250, 0);
    put(T.x - 3000, 300, T.z - 3000, 1, 1);                    // far off, out of range, while it goes
    L.lsForce();
    for (let i = 0; i < 60 * 16; i++) { put(T.x - 3000, 300, T.z - 3000, 1, 1); L.update(1 / 60); }
    // 70 m off, level with where its middle will be when he gets there (it is
    // climbing at tens of metres a second)
    const lead = 70 / st.vp.cruiseSpeed, vy = S.speed * Math.cos(S.tilt);
    const mid = S.y + Math.cos(S.tilt) * S.stackH * 0.5 + vy * lead;
    put(S.x + Math.sin(S.tilt) * S.stackH * 0.5 - 70, mid, S.z, 1, 0);
    out.climb = fly(60 * 4, () => ({ dx: Math.round(st.x - S.x), alt: Math.round(S.alt), phase: S.phase }));
    // a landed booster
    L.lsReset(); L.lsForce();
    for (let i = 0; i < 60 * 60 && !S.boosters.every(b => b.landed); i++) { put(T.x - 3000, 300, T.z - 3000, 1, 1); L.update(1 / 60); }
    const b = S.boosters[0];
    out.landedBoth = S.boosters.every(q => q.landed);
    put(b.x - 140, b.lzY + 30, b.z, 1, 0);
    out.booster = fly(60 * 4, () => ({ dx: Math.round(st.x - b.x), dz: Math.round(st.z - b.z) }));
    // the helicopter hovering low over a landing pad as its booster comes down:
    // a shove, never a bang (it is not his doing, and nothing counted it down)
    L.lsReset();
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const lz = S.lzs[0], hy = lz.y + 25;
    const hov = () => { st.phase = "AIRBORNE"; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = hy; L.heli.target = null; };
    st.x = lz.x + 3; st.z = lz.z; st.y = hy; hov();
    L.lsForce();
    const e0 = L.flags.exploded || 0;
    let apart = null, landed = false, minGap = 1e9;
    for (let i = 0; i < 60 * 60 && !landed; i++) {
      hov(); L.update(1 / 60);
      if (S.sep && apart === null && S.boosters[0].mode === "glide" && S.boosters[0].t > 2)
        apart = Math.round(Math.hypot(S.boosters[0].x - S.boosters[1].x, S.boosters[0].z - S.boosters[1].z));
      if (S.boosters[0].mode === "burn" || S.boosters[0].mode === "landed") minGap = Math.min(minGap, Math.hypot(st.x - lz.x, st.z - lz.z));
      landed = S.boosters[0].landed;
    }
    out.hover = { landed, bangs: (L.flags.exploded || 0) - e0, shovedTo: Math.round(Math.hypot(st.x - lz.x, st.z - lz.z)), apart };
    return out;
  });
  check(`launch site: the helicopter hovering over a landing pad is shoved aside by its booster coming down, never banged`,
    moving.hover.landed && moving.hover.bangs === 0 && moving.hover.shovedTo > 3, moving.hover);
  check(`launch site: the boosters visibly part at separation -- over 40 m apart two seconds later (${moving.hover.apart} m)`,
    moving.hover.apart > 40, moving.hover);
  check(`launch site: the rocket is solid while it CLIMBS -- flown into ten seconds up, it is a bang, at the rocket`,
    !!moving.climb && Math.abs(moving.climb.dx) < 30 && moving.climb.phase === "climb", moving.climb);
  check(`launch site: a landed booster is solid -- flown into, it is a bang, at the booster`,
    moving.landedBoth && !!moving.booster && Math.abs(moving.booster.dx) < 20 && Math.abs(moving.booster.dz) < 20, moving);

  // ---- 5c. the helicopter, pointed at it, sets it off; the police and the
  // picker take the numeral back
  const others = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE.launchSite, S = L.lsite;
    const out = {};
    L.lsReset();
    L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const x = T.x - 500, z = T.z + 900, y = L.terrainEff(x, z) + 120;
    const c0 = L.flags.lsCountdowns || 0;
    for (let i = 0; i < 60 * 3; i++) {
      st.phase = "AIRBORNE"; st.x = x; st.y = y; st.z = z; L.heli.vx = L.heli.vz = L.heli.vy = 0; L.heli.altitude = y; L.heli.target = null;
      st.heading = Math.atan2(-(T.x - x), -(T.z - z)); L.update(1 / 60);
    }
    out.heli = (L.flags.lsCountdowns || 0) - c0;
    // the police on him: pointing at it does nothing; a pull-over mid-count stands it down
    L.lsReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
    const sPad = L.hwyNearest(T.x, T.z).s, q = L.hwySampleAt(sPad - 1100), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz); };
    const c1 = L.flags.lsCountdowns || 0;
    // held in a pull-over (its own update would move it on: hold it there)
    for (let i = 0; i < 60 * 2; i++) { L.police.active = true; L.police.state = "pullover"; hold(); L.update(1 / 60); }
    out.policeStarts = (L.flags.lsCountdowns || 0) - c1;
    L.police.active = false; L.police.state = "away";
    L.setBigNum(null);                 // as the police do when they leave (countdownClear)
    for (let i = 0; i < 30; i++) { hold(); L.update(1 / 60); }
    out.afterPolice = S.phase;
    const s0 = L.flags.lsStandDowns || 0;
    for (let i = 0; i < 10; i++) { L.police.active = true; L.police.state = "pullover"; hold(); L.update(1 / 60); }
    L.police.active = false; L.police.state = "away";
    out.standDowns = (L.flags.lsStandDowns || 0) - s0;
    out.numClear = !document.getElementById("bigNum").classList.contains("on") || S.phase !== "armed";
    out.skyClear = !document.getElementById("bigNum").classList.contains("sky") || S.phase === "count";
    L.lsReset();
    return out;
  });
  check(`launch site: the helicopter, nose at it, sets it off`, others.heli === 1, others);
  check(`launch site: while the police are pulling him over it never starts, and a pull-over mid-count stands it down and hands back the numeral`,
    others.policeStarts === 0 && others.afterPolice === "count" && others.standDowns === 1 && others.skyClear, others);

  // ---- 5d. the numeral up in the sky sits on no control, portrait and phone
  for (const [w, h] of [[820, 1180], [390, 844], [844, 390]]) {
    const { page: pg } = await newPage(w, h);
    const r = await pg.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE.launchSite;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); for (let i = 0; i < 10; i++) L.update(1 / 60);
      const sPad = L.hwyNearest(T.x, T.z).s, q = L.hwySampleAt(sPad - 1100), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0; st.heading = Math.atan2(-q.fx, -q.fz); };
      const out = [];
      // the numeral fades in on a CSS transition, which runs on the wall clock
      // this harness does not wait for: measure it at its full opacity
      const bn = document.getElementById("bigNum");
      bn.style.transition = "none"; bn.style.animation = "none";
      for (const seat of [false, true]) {
        L.lsReset(); L.api.setView(seat);
        for (let i = 0; i < 60 * 2.5; i++) { hold(); L.update(1 / 60); }
        const b = document.getElementById("bigNum");
        const rr = b.getBoundingClientRect();
        out.push({ seat: seat ? "chase" : "seat", on: b.classList.contains("on"), sky: b.classList.contains("sky"), n: b.textContent,
                   op: +getComputedStyle(b).opacity, top: Math.round(rr.top), bottom: Math.round(rr.bottom),
                   obs: L.btnObstructions ? L.btnObstructions() : ["no btnObstructions"] });
      }
      L.lsReset();
      return out;
    });
    await pg.context().close();
    check(`launch site: at ${w}x${h}, in both seats, the countdown numeral up in the sky covers no control`,
      r.length === 2 && r.every(o => o.on && o.sky && o.op > 0.5 && o.obs.filter(x => /bigNum/.test(x)).length === 0), r);
  }

  // ---- 6. the frame through the launch, from the motorway: what the site
  // itself costs, measured as the same frame drawn with and without it
  const cost = await page.evaluate(() => {
    const L = window.__lp, st = L.state, T = L.TUNE.launchSite, S = L.lsite;
    L.lsReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const sPad = L.hwyNearest(T.x, T.z).s;
    const q = L.hwySampleAt(sPad - 700), off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
    const hold = () => { st.x = q.x - q.fz * off; st.z = q.z + q.fx * off; st.y = q.y; st.speed = 0;
                         st.heading = Math.atan2(-(T.x - st.x), -(T.z - st.z)); };
    const objs = () => [S.g, S.stack, S.puffMesh, ...S.pairs.flat().map(b => b.g)];
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
    L.lsForce();
    let worst = 0;
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 20 === 0) worst = Math.max(worst, frame()); else { hold(); L.update(1 / 60); }
    }
    return { idle, worst };
  });
  check(`launch site: the site costs at most 30 draw calls standing, 50 through the launch (${cost.idle}, ${cost.worst})`,
    cost.idle > 0 && cost.idle <= 30 && cost.worst <= 50, cost);
};
