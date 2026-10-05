"use strict";
// THE MONSTER TRUCK HE DRIVES (v141), driven the way he drives it: one finger,
// by the stick values touch produces. Every scenario counts bangs as a DELTA and
// watches `state.exploding` frame by frame -- the one promise is that it never
// bangs, whatever it meets.
module.exports = async function monsterChecks({ newPage, check }) {
  const { page, errors } = await newPage(768, 1024);
  const r = await page.evaluate(() => {
    const L = window.__lp, S = L.state, M = L.mon, MON = L.TUNE.monster;
    L.noRender = true;
    const out = { bangs: 0 };
    const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.TUNE.car.dragRangeX * innerWidth);
    const finger = (steer, pitch) => {
      if (steer === null || steer === undefined) { L.api.clearStick(); return; }
      S.touching = true; S.touchIsPoint = false; S.ctrlBank = steer / range; S.ctrlPitch = pitch || 0;
    };
    const step = (n, steer, pitch) => {
      for (let i = 0; i < n; i++) {
        const was = S.exploding;
        finger(steer, pitch);
        L.update(1 / 60);
        if (S.exploding && !was) out.bangs++;
      }
    };
    const vis = id => !document.getElementById(id).classList.contains("hidden");
    // place him somewhere, facing a point, standing still on the ground
    const put = (x, z, tx, tz) => {
      S.x = x; S.z = z; S.speed = 0; M.air = false; M.vy = 0;
      S.y = L.monGround(x, z, L.terrainEff(x, z)).y; M.groundPrev = S.y;
      S.heading = Math.atan2(-(tx - x), -(tz - z));
      // (not forced: a forced rebuild renumbers the town's houses under a test
      // that has just picked one -- the game streams them as he drives)
      L.updateScenery(x, z, false);
      step(20, null);
    };

    // ---- 1. the card, the spawn, the buttons
    out.card = !!document.querySelector('.vehCard[data-v="monster"]') && !document.querySelector('.vehCard[data-v="monster"]').classList.contains("hiddenS");
    L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens();
    // picked, he is IN the arena: the set-piece's own show must not start by itself
    step(60 * 3, null);
    out.quiet = { phase: L.mtruck.phase, counting: !!L.mtruck.counting };
    const armR0 = L.TUNE.monsterTruck.armR;
    step(30, null);
    const T = L.TUNE.monsterTruck, lip = L.mtruck.lip;
    out.spawn = { kind: L.vehKind(), parked: L.vehParked(), toLip: Math.round(Math.hypot(S.x - lip.x, S.z - lip.z)),
                  facing: +((-Math.sin(S.heading)) * L.mtruck.dirX + (-Math.cos(S.heading)) * L.mtruck.dirZ).toFixed(2),
                  pair: vis("slowBtn") && vis("fastBtn"), throttle: vis("throttleBtn"), horn: vis("hornBtn"), clashes: L.btnSlotClashes().length };

    // ---- 2. the big jump off the arena's ramp: finger down from the spawn
    const j0 = L.flags.monJumps || 0, l0 = L.flags.monLandings || 0;
    let top = -1e9, lipY = L.mtruck.ramp.y1, airT = 0;
    for (let i = 0; i < 60 * 14; i++) { step(1, 0, 0); if (M.air) { airT += 1 / 60; top = Math.max(top, S.y); } if (airT > 0 && !M.air) break; }
    out.jump = { jumps: (L.flags.monJumps || 0) - j0, landings: (L.flags.monLandings || 0) - l0, overLip: +(top - lipY).toFixed(1), airT: +airT.toFixed(1), bangs: out.bangs };

    // ---- 3. it drives and steers freely, and backs up
    put(600, 2600, 600, 2000);
    step(60 * 4, 0, 0);
    const cruise = S.speed, h0 = S.heading;
    step(60 * 2, 1, 0);
    const turnedRight = L.wrapPi(S.heading - h0);
    step(60 * 2, -1, 0);
    step(60 * 3, 0, -1);
    out.drive = { cruise: +cruise.toFixed(1), turnedRight: +turnedRight.toFixed(2), back: +S.speed.toFixed(1) };
    // the speed steps: the bottom step's cruise is well under the top's
    const k0 = S.speedStep;
    S.speedStep = 0; put(600, 2600, 600, 2000); step(60 * 5, 0, 0); const slow = S.speed;
    S.speedStep = L.spdStepsFor("monster").length - 1; put(600, 2600, 600, 2000); step(60 * 5, 0, 0); const fast = S.speed;
    S.speedStep = k0;
    out.steps = { slow: +slow.toFixed(1), fast: +fast.toFixed(1) };

    // ---- 4. what it meets. Find, near the cities and the road, one of each.
    const near = (cx, cz, R, f) => { let best = null, bd = 1e9; L.forEachSolid(b => { const d = Math.hypot(b.x - cx, b.z - cz); if (d < R && d < bd && f(b)) { bd = d; best = b; } }); return best; };
    const meet = (b, label, run) => {
      // come at its middle from `run` metres out (a street's width in a city), on a side with nothing in the way
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], R = run || 45;
      let best = null;
      for (const [dx, dz] of dirs) {
        const sx = b.x + dx * (b.hw + R), sz = b.z + dz * (b.hd + R);
        let clear = true;
        for (let d = 7; d <= R; d += 3) { const px = b.x + dx * (b.hw + d), pz = b.z + dz * (b.hd + d);
          if (L.solidCol(px, pz, L.terrainEff(px, pz) + MON.step, L.terrainEff(px, pz) + MON.hullH, MON.hullR, L.SOLID.CAR, o => o === b)) clear = false;
          if (L.terrainEff(px, pz) < L.seaLevelAt(px, pz)) clear = false; }
        if (clear) { best = [sx, sz]; break; }
      }
      if (!best) return { label, skipped: true };
      const c0 = L.flags.monCrushes || 0, s0 = L.flags.monShoves || 0, b0 = out.bangs;
      put(best[0], best[1], b.x, b.z);
      // a town is restreamed round him as he moves: the same house, renumbered
      if (b.idx !== undefined) { const bx = b.x, bz = b.z; b = near(bx, bz, 1, o => o.idx !== undefined) || b; }
      let hidden = false, minD = 1e9;
      for (let i = 0; i < 60 * 6; i++) { step(1, 0, 0); if (L.__lpIsHidden(b)) hidden = true; minD = Math.min(minD, Math.hypot(S.x - b.x, S.z - b.z)); }
      return { label, hidden, crushes: (L.flags.monCrushes || 0) - c0, shoves: (L.flags.monShoves || 0) - s0, bangs: out.bangs - b0,
               inside: Math.abs(S.x - b.x) < b.hw && Math.abs(S.z - b.z) < b.hd, h: +(b.y1 - b.y0).toFixed(0) };
    };
    const ny = L.cities.ny;
    // a city's small building and a tower (go there first: a city is solid only while it is loaded)
    put(ny.ax + 300, ny.az + 300, ny.ax, ny.az); step(60);
    const small = near(ny.ax, ny.az, 1500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && L.monCanCrush(b) && b.hw > 4);
    const tall = near(ny.ax, ny.az, 1500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && b.y0 < L.terrainEff(b.x, b.z) + 3 && !L.monCanCrush(b));
    out.small = small ? meet(small, "small building", 16) : null;
    // and it pops back once he has gone
    if (small && out.small.hidden) {
      put(small.x + 400, small.z + 400, small.x + 800, small.z + 800);
      step(60 * (MON.popAfter + 1), 0, 0);
      out.small.back = !L.__lpIsHidden(small);
    }
    out.tall = tall ? meet(tall, "tower", 16) : null;
    // the junk cars at the arena
    const jc = L.mtruck.cars[2].solid;
    out.junk = meet(jc, "junk car"); out.junk.squashed = L.mtruck.cars[2].sq > 0.5;
    put(jc.x + 500, jc.z, jc.x + 900, jc.z); step(60 * (MON.popAfter + 1), 0, 0);
    out.junk.back = L.mtruck.cars[2].sq < 0.05;
    // a house in one of the towns along the way (the instanced town buildings)
    put(600, -1500, 600, -2000); L.updateScenery(S.x, S.z, true); step(60);
    const house = near(S.x, S.z, 3000, b => b.idx !== undefined && !L.__lpIsHidden(b) && L.monCanCrush(b));
    out.box = house ? meet(house, "town house", 30) : null;
    if (house && out.box.hidden) { const hx = house.x, hz = house.z; put(hx + 400, house.z + 400, house.x + 900, house.z + 900); step(60 * (MON.popAfter + 1), 0, 0);
      const again = near(hx, hz, 1, o => o.idx !== undefined); out.box.back = !!again && !L.__lpIsHidden(again); }

    // ---- 5. traffic on the motorway: knocked flying, never a bang
    {
      // stand in the lane ahead of a car coming, facing it: it drives into him
      // a car on a stretch at ground level, ahead of it too (not on a viaduct: there he drives under it)
      const atGrade = s => { const q = L.hwySampleAt(s); return Math.abs(q.y - L.terrainEff(q.x, q.z)) < 1.5; };
      const t = L.highway.traffic.find(t => t.alive && t.wx !== undefined && t.s > 800 && t.s < L.highway.length - 800 && atGrade(t.s) && atGrade(t.s + t.dir * 60) && atGrade(t.s + t.dir * 120));
      const k0 = L.flags.monKnocks || 0, b0 = out.bangs;
      if (t) {
        const dir = t.dir || Math.sign(t.v || 1) || 1;
        const q = L.hwySampleAt(t.s + dir * 120), n = L.hwyNearest(t.wx, t.wz);
        const lat = n.lateral, x = q.x - q.fz * lat, z = q.z + q.fx * lat;
        put(x, z, t.wx, t.wz);
        S.y = Math.max(S.y, q.y);
        // and he drives at it, nose on it: head on
        let minD = 1e9, dy = 0;
        for (let i = 0; i < 60 * 8 && t.alive; i++) { S.heading = Math.atan2(-(t.wx - S.x), -(t.wz - S.z)); step(1, 0, 0); const d = Math.hypot(t.wx - S.x, t.wz - S.z); if (d < minD) { minD = d; dy = S.y - L.hwyNearest(S.x, S.z).y; } }
        out.trafficDbg = { minD: +minD.toFixed(1), dy: +dy.toFixed(1), startDy: 0 };
      }
      out.traffic = { found: !!t, knocks: (L.flags.monKnocks || 0) - k0, bangs: out.bangs - b0, dbg: out.trafficDbg };
    }

    // ---- 6. the shore stops it: driven at the great lake, it never goes in
    {
      const F = L.TUNE.fireworksBarge, b0 = out.bangs;
      let sx = F.x + 400, sz = F.z;
      for (let d = 0; d < 1500 && L.terrainEff(sx, sz) < L.seaLevelAt(sx, sz) + 1; d += 20) sx += 20;
      put(sx + 60, sz, F.x, F.z);
      let wet = 0;
      for (let i = 0; i < 60 * 10; i++) { step(1, 0, 0); if (L.terrainEff(S.x, S.z) < L.seaLevelAt(S.x, S.z) - 2) wet++; }
      step(60 * 3, 0, -1);
      out.shore = { wet, bangs: out.bangs - b0, backed: S.speed < -1 };
    }

    // ---- 7. a wandering finger across the country for a minute: never a bang,
    // never stuck, never in the water
    {
      // open country well clear of water: the plains east of the arena
      let px = 900, pz = 600;
      for (let k = 0; k < 40; k++) { let wetNear = false; for (let a = 0; a < 6.28; a += 0.5) if (L.terrainEff(px + Math.cos(a) * 700, pz + Math.sin(a) * 700) < L.seaLevelAt(px, pz) + 1) wetNear = true; if (!wetNear) break; px += 300; }
      put(px, pz, px, pz - 500);
      const b0 = out.bangs, x0 = S.x, z0 = S.z;
      let rng = 7, still = 0, wet = 0, far = 0;
      const rnd = () => (rng = (rng * 1103515245 + 12345) >>> 0) / 4294967296;
      let steer = 0;
      for (let i = 0; i < 60 * 60; i++) {
        if (i % 90 === 0) steer = (rnd() - 0.5) * 1.6;
        step(1, steer, rnd() < 0.05 ? 1 : 0);
        if (Math.abs(S.speed) < 1) still++;
        if (L.terrainEff(S.x, S.z) < L.seaLevelAt(S.x, S.z) - 2) wet++;
        far = Math.max(far, Math.hypot(S.x - x0, S.z - z0));
      }
      out.roam = { bangs: out.bangs - b0, stillSecs: +(still / 60).toFixed(1), wet, far: Math.round(far) };
    }
    // ---- 8. under a city's flyover, along the motorway: it never climbs on to
    // the deck over it -- a road he is not level with is not his road
    {
      let at = null;
      for (let s = 300; s < L.highway.length - 300 && !at; s += 6) {
        const q = L.hwySampleAt(s);
        for (const lat of [-9, 9]) {
          const x = q.x - q.fz * lat, z = q.z + q.fx * lat, sy = L.stSurfaceAt(x, z);
          if (sy !== null && sy > q.y + 5) { at = { s, lat }; break; }
        }
      }
      if (at) {
        const dir = 1, q0 = L.hwySampleAt(at.s - 90);
        const x = q0.x - q0.fz * at.lat, z = q0.z + q0.fx * at.lat;
        S.x = x; S.z = z; S.y = q0.y; S.speed = 0; M.air = false; M.vy = 0; M.groundPrev = S.y; S.heading = Math.atan2(-q0.fx, -q0.fz);
        L.monSnapCamera(); step(10, null);
        let worst = 0, b0 = out.bangs;
        for (let i = 0; i < 60 * 7; i++) {
          const n = L.hwyNearest(S.x, S.z); S.heading = Math.atan2(-n.fx, -n.fz);
          step(1, 0, 0);
          if (Math.abs(n.lateral) < L.highway.halfW) worst = Math.max(worst, S.y - L.hwyNearest(S.x, S.z).y);
        }
        out.flyover = { found: true, worst: +worst.toFixed(1), bangs: out.bangs - b0 };
      } else out.flyover = { found: false };
    }

    // ---- 9. a jump that comes down in the lake: back on the last dry ground, not stuck
    {
      const F = L.TUNE.fireworksBarge, wl0 = L.flags.monWaterLandings || 0; let sx = F.x + 400;
      for (let d = 0; d < 1500 && L.terrainEff(sx, F.z) < L.seaLevelAt(sx, F.z) + 1; d += 20) sx += 20;
      put(sx + 40, F.z, F.x, F.z); step(30, 0, 0);
      S.x = F.x + 120; S.z = F.z; S.y = L.seaLevelAt(S.x, S.z) + 25; M.air = true; M.vy = 0;
      for (let i = 0; i < 60 * 4 && (M.air || L.terrainEff(S.x, S.z) < L.seaLevelAt(S.x, S.z)); i++) step(1, null);
      const dry = L.terrainEff(S.x, S.z) >= L.seaLevelAt(S.x, S.z) - 0.5, x0 = S.x, z0 = S.z;
      step(60 * 3, 0, 0);
      out.lake = { dry, moved: +Math.hypot(S.x - x0, S.z - z0).toFixed(1), landings: (L.flags.monWaterLandings || 0) - wl0 };
    }

    // ---- 10. what it crushed comes back the moment he leaves the monster, and
    // a house it crushed comes back even after the picker has been opened
    {
      const ny = L.cities.ny; put(ny.ax + 300, ny.az + 300, ny.ax, ny.az); step(60, null);
      const b = near(ny.ax, ny.az, 1500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && L.monCanCrush(b) && b.hw > 4);
      const m = b ? meet(b, "for the switch", 16) : null;
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      out.switchBack = { crushed: !!m && m.hidden, back: !!b && !L.__lpIsHidden(b) };
      L.api.setVehicle("monster"); L.api.spawnAt(0, 0); step(10, null);
      put(600, -1500, 600, -2000); L.updateScenery(S.x, S.z, true); step(60, null);
      const h = near(S.x, S.z, 3000, o => o.idx !== undefined && !L.__lpIsHidden(o) && L.monCanCrush(o));
      const hx = h.x, hz = h.z, mm = meet(h, "house for the picker", 30);
      L.restoreShattered();            // what opening the picker does
      put(hx + 400, hz + 400, hx + 900, hz + 900); step(60 * (MON.popAfter + 1), 0, 0);
      const again = near(hx, hz, 1, o => o.idx !== undefined), mat = new THREE.Matrix4(), pos = new THREE.Vector3();
      if (again) { L.buildingInst.getMatrixAt(again.idx, mat); pos.setFromMatrixPosition(mat); }
      out.picker = { crushed: mm.hidden, drawn: !!again && pos.y > -100, solid: !!again && !L.__lpIsHidden(again) };
    }

    // ---- 11. from the driving seat (v143): high up, the bonnet and the tops of
    // both front wheels in the picture, and a car on the road small beneath him
    {
      L.api.setView(false);
      put(900, 600, 900, 0); step(60 * 2, null);
      L.camera.updateMatrixWorld(); L.camera.updateProjectionMatrix();
      const m = L.vehicleModel; m.updateMatrixWorld(true);
      const v = new THREE.Vector3(), onScreen = p => { v.copy(p).project(L.camera); return v.z < 1 && Math.abs(v.x) < 0.98 && v.y > -0.98 && v.y < 0.98; };
      const fx = -Math.sin(S.heading), fz = -Math.cos(S.heading);
      const wheels = m.userData.wheels.map(w => { const wp = new THREE.Vector3(); w.getWorldPosition(wp); return wp; })
        .filter(wp => (wp.x - S.x) * fx + (wp.z - S.z) * fz > 0);   // the front pair
      const fronts = wheels.map(wp => onScreen(new THREE.Vector3(wp.x, wp.y + 1.75 * L.TUNE.monster.scale * 0.9, wp.z)));
      const bonnet = onScreen(new THREE.Vector3(S.x + fx * 5, S.y + 7.6, S.z + fz * 5));
      // a car (1.6 m tall) 40 m ahead on the ground: its share of the picture's height
      const a = new THREE.Vector3(S.x + fx * 40, S.y, S.z + fz * 40).project(L.camera).y, b2 = new THREE.Vector3(S.x + fx * 40, S.y + 1.6, S.z + fz * 40).project(L.camera).y;
      out.seat = { eyeUp: +(L.camera.position.y - S.y).toFixed(1), fronts, bonnet, carFrac: +((b2 - a) / 2).toFixed(3), cabHidden: !!m.userData.cab && !m.userData.cab.visible, modelShown: m.visible };
      L.api.setView(true); step(2, null);
    }

    // ---- 11b. CRUSHING IS INSTANT (v143): stopped dead against a house, the
    // first push of his finger goes straight through it -- and in that frame it
    // is gone and a burst of many pieces fills its place
    {
      put(600, -1500, 600, -2000); L.updateScenery(S.x, S.z, true); step(60, null);
      let h = near(S.x, S.z, 3000, o => o.idx !== undefined && !L.__lpIsHidden(o) && L.monCanCrush(o) && o.y1 - o.y0 > 8);
      const hx = h.x, hz = h.z;
      // stand him a hand's width off its face, still, then the one push that touches it
      put(hx + h.hw + L.TUNE.monster.hullR + 0.05, hz, hx, hz);
      h = near(hx, hz, 1, o => o.idx !== undefined) || h;
      S.speed = 0; step(5, null);
      const d0 = L.monDebrisLive(), c0 = L.flags.monCrushes || 0;
      let frames = 0;
      for (; frames < 60 && !L.__lpIsHidden(h); frames++) step(1, 0, 0);
      out.instant = { frames, gone: L.__lpIsHidden(h), burst: L.monDebrisLive() - d0, crushes: (L.flags.monCrushes || 0) - c0 };
      L.api.clearStick();
    }

    // ---- 11c. in the monster truck nothing counts down: at the arena, nose at
    // the ramp (and the launch site beyond it), eight seconds of nothing
    {
      L.TUNE.monsterTruck.armR = armR0;
      L.lsReset(); document.getElementById("bigNum").classList.remove("on", "sky");
      L.api.setVehicle("monster"); L.api.spawnAt(0, 0); step(10, null);
      let counted = 0;
      for (let i = 0; i < 60 * 8; i++) { step(1, null); if (document.getElementById("bigNum").classList.contains("on")) counted++; }
      out.noCount = { counted, ls: L.lsite.phase, mt: L.mtruck.phase };
      // out of the arena, 600 m from the pad, nose on it: it counts down -- unless he has just crushed something
      const LS = L.TUNE.launchSite;
      L.lsReset();
      L.mon.lastCrushT = 3; put(LS.x - 600, LS.z, LS.x, LS.z); step(30, null);
      const quiet = L.lsite.phase === "armed";
      L.mon.lastCrushT = 0;
      for (let i = 0; i < 60 * 8 && L.lsite.phase === "armed"; i++) step(1, null);
      out.lsOut = { quietAfterCrush: quiet, started: L.lsite.phase !== "armed" };
      L.lsReset(); document.getElementById("bigNum").classList.remove("on", "sky");
      L.TUNE.monsterTruck.armR = 0;
    }

    // ---- 12. landing a jump on a junk car squashes it
    {
      const c = L.mtruck.cars[0], b0 = out.bangs;
      L.mtCarSet && L.mtCarSet(c, 0);
      S.x = c.solid.x; S.z = c.solid.z; S.y = c.solid.y1 + 30; M.air = true; M.vy = 0; S.speed = 0;
      for (let i = 0; i < 60 * 3 && M.air; i++) step(1, null);
      out.landCrush = { squashed: c.sq > 0.5, bangs: out.bangs - b0 };
    }

    // ---- 13. a city car he drives at: knocked spinning
    {
      const k0 = L.flags.monKnocks || 0, b0 = out.bangs;
      const ny = L.cities.ny; put(ny.ax + 200, ny.az + 200, ny.ax, ny.az); step(120, null);
      const v = L.stTraffic.list.find(v => v.alive && !v.spin && v.wx !== undefined && Math.hypot(v.wx - S.x, v.wz - S.z) < 900 &&
        Math.abs((L.stSurfaceAt(v.wx, v.wz) ?? 1e9) - L.terrainEff(v.wx, v.wz)) < 1.5);
      if (v) {
        put(v.wx + 30, v.wz + 30, v.wx, v.wz);
        for (let i = 0; i < 60 * 6 && !v.spin; i++) { S.heading = Math.atan2(-(v.wx - S.x), -(v.wz - S.z)); step(1, 0, 0); }
      }
      out.city = { found: !!v, knocks: (L.flags.monKnocks || 0) - k0, bangs: out.bangs - b0 };
    }

    // ---- 14. under the low end of a motorway BRIDGE, from the field: it drives
    // under it, never lifted on to the deck
    {
      let at = null;
      for (let s = 300; s < L.highway.length - 300 && !at; s += 4) {
        const q = L.hwySampleAt(s), g = L.terrainEff(q.x, q.z);
        if (q.type === "bridge" && q.y - g > L.HW.bridgeAt && q.y - g < 9.5 && g > L.seaLevelAt(q.x, q.z) + 1) at = { s, q };
      }
      if (at) {
        const q = at.q, rx = -q.fz, rz = q.fx;
        // from 60 m out to one side, straight across under the deck
        const sx = q.x + rx * 60, sz = q.z + rz * 60;
        put(sx, sz, q.x - rx * 60, q.z - rz * 60);
        let worst = -1e9, under = 0, b0 = out.bangs;
        for (let i = 0; i < 60 * 6; i++) {
          step(1, 0, 0);
          const n = L.hwyNearest(S.x, S.z);
          if (Math.abs(n.lateral) < L.highway.halfW) { under++; worst = Math.max(worst, S.y - L.terrainEff(S.x, S.z)); }
        }
        out.underBridge = { found: true, under, worst: +worst.toFixed(1), deck: +(q.y - L.terrainEff(q.x, q.z)).toFixed(1), bangs: out.bangs - b0 };
      } else out.underBridge = { found: false };
    }

    // ---- 15. a junk car flattened while the set-piece's show runs, then he
    // changes vehicle: the show stands it back up with the rest
    {
      L.TUNE.monsterTruck.armR = armR0;
      L.mtReset && L.mtReset();
      L.mtForce();
      const c = L.mtruck.cars[4];
      for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);       // the countdown, and away
      const ph = L.mtruck.phase;
      S.x = c.solid.x; S.z = c.solid.z; S.y = c.solid.y1 + 25; M.air = true; M.vy = 0; S.speed = 0;
      for (let i = 0; i < 60 * 3 && M.air; i++) step(1, null);
      const flatNow = c.sq > 0.5;
      L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0);
      for (let i = 0; i < 60 * 120 && L.mtruck.phase !== "armed"; i++) L.update(1 / 60);
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      out.showJunk = { phaseWhenCrushed: ph, flatNow, phase: L.mtruck.phase, sq: +c.sq.toFixed(2) };
      L.api.setVehicle("monster"); L.api.spawnAt(0, 0); step(10, null);
      L.TUNE.monsterTruck.armR = 0;
    }

    // ---- 16. in a city street with a building close behind him, the chase
    // camera is not inside it: it has come in over the cab
    {
      const ny = L.cities.ny; put(ny.ax + 300, ny.az + 300, ny.ax, ny.az); step(60, null);
      const wall = near(ny.ax, ny.az, 1500, b => b.mesh && b.mesh.isCityProxy && !L.__lpIsHidden(b) && b.y1 - b.y0 > 20 &&
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !L.solidCol(b.x + dx * (b.hw + 12), b.z + dz * (b.hd + 12), b.y0 + 3, b.y0 + 9, 5.5, L.SOLID.CAR, o => o === b)));
      if (wall) {
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !L.solidCol(wall.x + dx * (wall.hw + 12), wall.z + dz * (wall.hd + 12), wall.y0 + 3, wall.y0 + 9, 5.5, L.SOLID.CAR, o => o === wall));
        // his back to the wall, 12 m off it, facing away
        const x = wall.x + d[0] * (wall.hw + 12), z = wall.z + d[1] * (wall.hd + 12);
        put(x, z, x + d[0] * 100, z + d[1] * 100);
        L.api.setView(true); step(90, null);
        const cp = L.camera.position, inside = !!L.solidQuery(cp.x, cp.y, cp.z, 0.5, L.SOLID.AIR, undefined, b => b.car !== undefined || !!b.park);
        out.camPull = { inside, back: +Math.hypot(cp.x - S.x, cp.z - S.z).toFixed(1), up: +(cp.y - S.y).toFixed(1) };
      } else out.camPull = null;
    }

    // ---- 17. a knocked car is SEEN: thrown up and out to the side, in the air for a while
    {
      const f0 = L.flags.monFlings || 0;
      const atGrade = s => { const q = L.hwySampleAt(s); return Math.abs(q.y - L.terrainEff(q.x, q.z)) < 1.5; };
      let s0 = 0; for (let s = 1500; s < L.highway.length - 1500; s += 50) if ([-200, 0, 200].every(o => atGrade(s + o))) { s0 = s; break; }
      { const q = L.hwySampleAt(s0); put(q.x - q.fz * 60, q.z + q.fx * 60, q.x, q.z); for (let i = 0; i < 120; i++) L.update(1 / 60); }
      const t = L.highway.traffic.filter(t => t.alive && t.wx !== undefined).sort((a, b) => Math.abs(a.s - s0) - Math.abs(b.s - s0))[0];
      let peak = 0, airborne = 0;
      if (t) {
        const q = L.hwySampleAt(t.s + t.dir * 90), n = L.hwyNearest(t.wx, t.wz);
        put(q.x - q.fz * n.lateral, q.z + q.fx * n.lateral, t.wx, t.wz); S.y = Math.max(S.y, q.y);
        for (let i = 0; i < 60 * 8 && (L.flags.monFlings || 0) === f0; i++) { if (t.alive) S.heading = Math.atan2(-(t.wx - S.x), -(t.wz - S.z)); step(1, 0, 0); }
        for (let i = 0; i < 90; i++) { step(1, null); for (const f of M.flyers || []) if (f.life > 0 && f.g.visible) { airborne++; peak = Math.max(peak, f.y - L.terrainEff(f.x, f.z)); } }
      }
      out.fling = { flings: (L.flags.monFlings || 0) - f0, peak: +peak.toFixed(1), airFrames: airborne };
    }

    L.api.clearStick();
    L.TUNE.monsterTruck.armR = armR0;
    out.kinds = L.flags.monCrushedKinds || {};
    return out;
  });
  await page.close();
  const J = x => JSON.stringify(x);
  check("monster: a card in the picker; picked, it starts at the arena facing the ramp, parked, with the speed pair and nothing else new", r.card && r.spawn.kind === "monster" && r.spawn.parked && r.spawn.facing > 0.95 && r.spawn.toLip < 200 && r.spawn.pair && !r.spawn.throttle && !r.spawn.horn && r.spawn.clashes === 0, J({ card: r.card, ...r.spawn }));
  check("monster: finger down from the start, up the arena's ramp and off it -- a big jump (well over the lip), a landing, no bang", r.jump.jumps >= 1 && r.jump.landings >= 1 && r.jump.overLip > 8 && r.jump.airT > 2 && r.jump.bangs === 0, J(r.jump));
  check("monster: finger down drives it, a held steer right turns it right (freely, no lane), and a pull down backs it up", r.drive.cruise > 20 && r.drive.turnedRight < -1 && r.drive.back < -3, J(r.drive));
  check("monster: the speed steps change its speed (the bottom step well under the top)", r.steps.slow < r.steps.fast * 0.5, J(r.steps));
  check("monster: driven at a small city building -- crushed, never a bang; and it pops back once he has gone", r.small && r.small.hidden && r.small.crushes >= 1 && r.small.bangs === 0 && r.small.back, J(r.small));
  check("monster: driven at a tower too big to crush -- it stops against it (a shove), never a bang, never inside it", r.tall && !r.tall.hidden && r.tall.shoves >= 1 && r.tall.bangs === 0 && !r.tall.inside, J(r.tall));
  check("monster: the arena's junk cars -- squashed flat, never a bang, and popped back up once he has gone", r.junk && r.junk.squashed && r.junk.bangs === 0 && r.junk.back, J(r.junk));
  check("monster: a town house along the way -- crushed, never a bang, and back once he has gone", r.box && r.box.hidden && r.box.bangs === 0 && r.box.back, J(r.box));
  check("monster: motorway traffic it meets is knocked flying, never a bang", r.traffic.found && r.traffic.knocks >= 1 && r.traffic.bangs === 0, J(r.traffic));
  check("monster: driven at the great lake it stops at the shore -- never in the water, never a bang -- and backs off", r.shore.wet === 0 && r.shore.bangs === 0 && r.shore.backed, J(r.shore));
  check("monster: a wandering finger across the country for a minute -- never a bang, never in the water, never stuck", r.roam.bangs === 0 && r.roam.wet === 0 && r.roam.far > 300 && r.roam.stillSecs < 10, J(r.roam));
  check("monster: picked, in the arena, the set-piece's own show does not start by itself (he is playing in it)", r.quiet.phase === "armed" && !r.quiet.counting, J(r.quiet));
  check("monster: along the motorway under a city flyover it stays on the motorway -- never lifted on to the deck over it", r.flyover.found && r.flyover.worst < 1 && r.flyover.bangs === 0, J(r.flyover));
  check("monster: a jump that comes down in the lake -- back on the last dry ground, and it drives on (never stuck)", r.lake.dry && r.lake.moved > 10 && r.lake.landings >= 1, J(r.lake));
  check("monster: a building it crushed is back the moment he leaves the monster", r.switchBack.crushed && r.switchBack.back, J(r.switchBack));
  check("monster: a town house it crushed is back -- drawn and solid together -- even after the picker was opened", r.picker.crushed && r.picker.drawn && r.picker.solid, J(r.picker));
  check("monster: from the driving seat he sits high -- over the bonnet, the tops of both front wheels in the picture, a car on the road below small", r.seat.eyeUp > 10 && r.seat.fronts.length === 2 && r.seat.fronts.every(f => f) && r.seat.bonnet && r.seat.cabHidden && r.seat.modelShown && r.seat.carFrac < 0.06, J(r.seat));
  check("monster: crushing is instant -- stopped against a house, the first push goes through it within a few frames, and in that frame a burst of many pieces", r.instant.gone && r.instant.frames <= 8 && r.instant.burst >= 15, J(r.instant));
  check("monster: in the monster truck in the arena nothing counts down, even nose-on to the launch site beyond it", r.noCount.counted === 0 && r.noCount.ls === "armed" && r.noCount.mt === "armed", J(r.noCount));
  check("monster: out of the arena, pointed at the launch site, he still sets it off (and not within seconds of a crush)", r.lsOut.started && r.lsOut.quietAfterCrush, J(r.lsOut));
  check("monster: landing a jump on a junk car squashes it -- never a bang", r.landCrush.squashed && r.landCrush.bangs === 0, J(r.landCrush));
  check("monster: a city car it drives at is knocked spinning, never a bang", r.city.found && r.city.knocks >= 1 && r.city.bangs === 0, J(r.city));
  check("monster: under the low end of a motorway bridge, from the field, it drives under the deck -- never lifted on to it", r.underBridge.found && r.underBridge.under > 10 && r.underBridge.worst < 2 && r.underBridge.bangs === 0, J(r.underBridge));
  check("monster: a junk car flattened while the set-piece's show runs, then a vehicle change -- the show stands it back up", r.showJunk.flatNow && r.showJunk.phase === "armed" && r.showJunk.sq < 0.05, J(r.showJunk));
  check("monster: in a city street with a building behind him, the chase camera is never inside it -- it comes in over the cab", r.camPull && !r.camPull.inside && r.camPull.up > 8, J(r.camPull));
  check("monster: a motorway car it knocks is seen flying -- thrown up out to the side, in the air a good while", r.fling.flings >= 1 && r.fling.peak > 6 && r.fling.airFrames > 40, J(r.fling));
  check("monster: no bang anywhere in any of it", r.bangs === 0, J({ bangs: r.bangs, kinds: r.kinds }));
  check("monster: no browser or frame errors", errors.length === 0, J(errors.slice(0, 5)));
};
