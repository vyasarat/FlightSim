"use strict";
// ---------------------------------------------------------------------------
// THE ROAD, AND WHAT IS AND IS NOT ALLOWED TO BE STANDING IN IT.
//
// Three bugs are behind this file, and all three were invisible to a check that
// only asked whether things EXISTED.
//
// 1. Buildings stood in the carriageway. `inCorridor` -- the one test that keeps
//    streamed scenery out of places vehicles go -- knew about the two airports
//    and nothing else, so nothing ever kept a town off the road.
//
// 2. Nothing the car drove at was solid. `resolveSolidWalls` gated on
//    `phase === "AIRBORNE"`, and the car writes `phase = "TAXI"` at the top of
//    every frame as a way of saying "not flying", so its call returned on the
//    first line. The old crossing check asserted zero wall hits and passed,
//    because zero was the only number that function could ever produce.
//
// 3. The mountain tunnel was a tube buried in solid rock. The surveyor
//    classified 800 m of route as tunnel and the builder laid a lining along it,
//    and nothing ever took the mountain out of the way.
//
// So these are all BEHAVIOURAL and all ask for a number that can be non-zero:
// a hands-off crossing, a deliberate charge at a wall, a drive over the
// drawbridge, and the ground sampled inside the bore.
// ---------------------------------------------------------------------------

module.exports = async function roadChecks({ newPage, check, viewports }) {
  for (const [w, h] of viewports) {
    const { page } = await newPage(w, h);
    const tag = `${w}x${h}`;

    // ---- 1. the crossing: nothing streamed inside the corridor, nothing hit
    const cross = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      st.speedStep = (L.spdStepsFor(L.spdKey()) || [1]).length - 1;

      const w0 = L.flags.wallHits || 0;
      let inCorridor = 0, checked = 0, worst = [];
      const seen = new Set();
      let guard = 0;
      while (st.z > -6100 && guard < 60 * 60 * 14) {
        L.api.setStick(0, 0); L.update(1 / 60); guard++;
        if (guard % 150 === 0) {
          // every solid streamed in right now: is any of it inside the road's
          // own clearance? The set is deduped so a building that stays loaded
          // across several samples is counted once.
          L.forEachSolid(b => {
            const key = Math.round(b.x) + "," + Math.round(b.z);
            if (seen.has(key)) return;
            seen.add(key); checked++;
            const d = L.hwyCorridorDist(b.x, b.z);
            if (d < L.HW.clearHalf && b.idx !== undefined) {
              inCorridor++;
              if (worst.length < 6) worst.push({ x: Math.round(b.x), z: Math.round(b.z), d: +d.toFixed(1) });
            }
          });
        }
        if (st.exploding) { st.explodeTimer = 0; for (let i = 0; i < 40; i++) L.update(1 / 60); }
      }
      return { frames: guard, endZ: Math.round(st.z), checked, inCorridor, worst,
               wallHits: (L.flags.wallHits || 0) - w0 };
    });
    check(`road ${tag}: a hands-off crossing from New York to California passes ${cross.checked} streamed solids and not one of them stands in the carriageway, the spurs or the ramps`,
      cross.inCorridor === 0 && cross.checked > 200 && cross.endZ < -6000 && cross.wallHits === 0,
      JSON.stringify({ ...cross, worst: cross.worst }));

    // ---- 2. the car is solid. Two answers, and the difference is the point:
    // a wall at speed is a bang, the same wall at a crawl is a shove.
    const solid = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      let box = null, bd = Infinity;
      L.forEachSolid(b => {
        if (b.idx === undefined) return;                 // a streamed town building
        const d = Math.hypot(b.x - st.x, b.z - st.z);
        if (d < bd) { bd = d; box = { x: b.x, z: b.z, hw: b.hw, hd: b.hd, y0: b.y0, y1: b.y1 }; }
      });
      if (!box) return { found: false };
      // The speed is HELD, not asked for: the drive model would otherwise
      // accelerate the crawl straight past the crash threshold before it got
      // there, and the two answers would be the same answer.
      const charge = (speed) => {
        st.x = box.x; st.z = box.z + box.hd + 18;
        st.y = Math.max(L.terrainEff(st.x, st.z) + 1, box.y0 + 0.5);
        st.heading = 0;                                   // forward is -z
        st.speed = speed; st.exploding = false; L.car.crashCool = 0;
        const w0 = L.flags.wallHits || 0, c0 = L.flags.carCrashes || 0;
        let f = 0;
        while (f < 60 * 8 && !st.exploding) {
          L.api.setStick(0, 0.2); L.update(1 / 60); f++;
          // HEADING PINNED as well as speed. This is a test of whether a
          // building is solid, not of the lane-keep: with the car's low-speed
          // turn rate raised in v114 the assist now hauls him back toward the
          // road -- 338 m away -- before he has covered the eighteen metres to
          // the wall, and the slow charge simply never arrived.
          if (!st.exploding) { st.speed = speed; st.heading = 0; }
        }
        const out = { hits: (L.flags.wallHits || 0) - w0, crashes: (L.flags.carCrashes || 0) - c0,
                      exploded: st.exploding, frames: f, endSpeed: Math.round(st.speed) };
        st.explodeTimer = 0; for (let i = 0; i < 60; i++) L.update(1 / 60);
        st.exploding = false;
        return out;
      };
      const fast = charge(45);
      const slow = charge(L.CAR.crashSpeed * 0.5);
      return { found: true, box, fast, slow, onRoad: +L.hwyCorridorDist(box.x, box.z).toFixed(1) };
    });
    check(`road ${tag}: a building beside the road is solid -- driven into at speed it is a bang and a free reassemble, and at a crawl it is a shove that costs him nothing`,
      solid.found && solid.fast.hits >= 1 && solid.fast.crashes === 1 && solid.fast.exploded &&
      solid.slow.hits >= 1 && solid.slow.crashes === 0 && !solid.slow.exploded,
      JSON.stringify(solid));

    // ---- 3. the drawbridge is a PORTAL, not a plug. The towers stand either
    // side of the carriageway; one box across the whole opening made the only
    // way across by land into a wall the moment the car became solid.
    const bridge = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const RZ = -6745;
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      const run = (x0, x1) => {
        st.x = x0; st.z = RZ; st.y = L.hbRoadY(x0); st.speed = 0; st.exploding = false;
        L.car.crashCool = 0; st.heading = x1 > x0 ? -Math.PI / 2 : Math.PI / 2;
        const w0 = L.flags.wallHits || 0;
        let f = 0;
        while (f < 60 * 120 && Math.abs(st.x - x1) > 25) {
          L.api.setStick(0, 0); st.speed = Math.max(st.speed, 22);
          st.z = RZ;                                      // a road test, not a steering test
          L.update(1 / 60); f++;
          if (st.exploding) { st.explodeTimer = 0; for (let i = 0; i < 30; i++) L.update(1 / 60); break; }
        }
        return { endX: Math.round(st.x), hits: (L.flags.wallHits || 0) - w0 };
      };
      const west = run(820, 1780), east = run(1780, 820);
      // and the pier below it is still solid, or the boat sails through the bridge
      const pier = L.harbor.solids.filter(b => Math.abs(b.z - RZ) < 20 &&
                                               b.y0 < L.TUNE.waterLevel && b.y1 > L.TUNE.waterLevel).length;
      return { west, east, pier };
    });
    check(`road ${tag}: the drawbridge towers are a portal the road drives through, not a block across it -- and the pier under them is still solid, so the boat cannot sail through the bridge`,
      bridge.west.hits === 0 && bridge.east.hits === 0 &&
      bridge.west.endX > 1750 && bridge.east.endX < 850 && bridge.pier >= 2,
      JSON.stringify(bridge));

    // ---- 4. every surveyor classification, and what was built for it.
    // The sweep the tunnel bug asked for: a structure with no ground change, or
    // a ground change with no structure, is the same class of bug either way.
    const survey = await page.evaluate(() => {
      const L = window.__lp, pts = L.highway.pts, HW = L.HW;
      const runs = [];
      let cur = null;
      for (let i = 0; i < pts.length; i++) {
        if (!cur || cur.type !== pts[i].type) runs.push(cur = { type: pts[i].type, a: i, b: i });
        else cur.b = i;
      }
      const bad = [];
      const kinds = {};
      for (const r of runs) {
        kinds[r.type] = (kinds[r.type] || 0) + (r.b - r.a + 1);
        for (let i = r.a; i <= r.b; i++) {
          const p = pts[i], ground = L.terrainEff(p.x, p.z);
          if (r.type === "tunnel") {
            // the mountain must be GONE along the bore, not merely tubed
            if (ground > p.y + 0.5) bad.push(`tunnel still buried at z=${Math.round(p.z)} (ground ${ground.toFixed(1)} > road ${p.y.toFixed(1)})`);
          } else if (r.type === "bridge") {
            // a deck with no gap under it is a road, not a bridge
            if (!p.overWater && p.y - p.ground < HW.bridgeAt * 0.4) bad.push(`bridge with no gap at z=${Math.round(p.z)}`);
          } else if (p.y < p.ground - 0.01) {
            bad.push(`ground stretch buried at z=${Math.round(p.z)}`);
          }
          if (bad.length > 6) break;
        }
      }
      const bores = L.hwyBores || [];
      // a bore with no portal at each end, or no lining, is the bug again
      for (const b of bores) {
        if (!b.portals || b.portals.length !== 2) bad.push("bore without two portals");
        if (!b.lid) bad.push("bore without a lid");
      }
      return {
        kinds, runs: runs.length, bores: bores.length, bad,
        boreMetres: bores.reduce((n, b) => n + (b.b - b.a) * HW.step, 0),
        piers: (L.highway.piers || []).length,
        // the lid puts the mountain back: uncut ground over the middle of a bore
        // must still be well above the road, or it is a trench, not a tunnel
        cover: bores.length ? Math.round(Math.max(...bores[0].pts.map(p => L.shapedTerrain(p.x, p.z) - p.y))) : 0,
      };
    });
    check(`road ${tag}: every stretch the surveyor classified has the ground to match -- ${survey.boreMetres} m of bore with the mountain actually cut out of it and a portal at each end, piers under every bridge, and no ground stretch buried`,
      survey.bad.length === 0 && survey.bores >= 1 && survey.boreMetres >= 300 &&
      survey.piers > 0 && survey.cover > 20 && survey.kinds.tunnel > 0 && survey.kinds.bridge > 0,
      JSON.stringify(survey));

    // ---- 4b. the freight line is not the highway.
    // It ran along x = 340 and so does the road: the track was inside the
    // carriageway for 1400 m, and the day the car became solid a hands-off
    // crossing hit the train five times. Measured, not eyeballed.
    const rail = await page.evaluate(() => {
      const L = window.__lp;
      const X = L.TRAIN_X, z0 = L.TRAIN_ZMIN, z1 = L.TRAIN_ZMAX;
      let main = 1e9, spur = 1e9, wet = 0, n = 0, inLane = 0;
      for (let z = z0; z <= z1; z += 15) {
        n++;
        for (const q of L.highway.pts) {
          const d = Math.hypot(q.x - X, q.z - z);
          if (d < main) main = d;
        }
        for (const e of L.highway.exits) {
          for (const q of (e.spur || [])) {
            const d = Math.hypot(q.x - X, q.z - z);
            if (d < spur) spur = d;
          }
        }
        const nr = L.hwyNearest(X, z);
        if (Math.abs(nr.lateral) < L.highway.halfW + 6) inLane++;
        if (L.terrainEff(X, z) < L.TUNE.waterLevel + 1) wet++;
      }
      return { X, z0: Math.round(z0), z1: Math.round(z1), n, inLane, wet,
               main: Math.round(main), spur: Math.round(spur), halfW: L.highway.halfW };
    });
    check(`road ${tag}: the freight line runs its own ground -- ${rail.main} m clear of the carriageway at its nearest, ${rail.spur} m clear of every exit spur, and never once inside a lane or under the water`,
      rail.inLane === 0 && rail.wet === 0 && rail.main > 70 && rail.spur > 70,
      JSON.stringify(rail));

    // ---- 5. drive the bore. He has to come out the other side.
    const drive = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const bore = (L.hwyBores || [])[0];
      if (!bore) return { found: false };
      const first = bore.pts[0], last = bore.pts[bore.pts.length - 1];
      L.api.setVehicle("car"); L.api.placeOnRunway();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      // start 300 m short of the near portal, in lane, and let go
      const n0 = L.hwyNearest(first.x, first.z);
      const s0 = Math.max(0, n0.s - 300);
      const at = L.hwySampleAt(s0);
      const rx = -at.fz, rz = at.fx, off = L.HW.medianW / 2 + L.HW.laneW * 0.5;
      st.x = at.x + rx * off; st.z = at.z + rz * off; st.y = at.y;
      st.heading = Math.atan2(-at.fx, -at.fz); st.speed = 0; st.exploding = false;
      const w0 = L.flags.wallHits || 0;
      let f = 0, insideFrames = 0, minCamAgl = 1e9, sawLamp = false;
      const target = L.hwyNearest(last.x, last.z).s + 250;
      while (f < 60 * 200 && L.hwyNearest(st.x, st.z).s < target) {
        L.api.setStick(0, 0); L.update(1 / 60); f++;
        const ceil = L.hwyBoreCeiling(st.x, st.z);
        if (ceil !== null) {
          insideFrames++;
          // the chase camera must stay UNDER the roof, or the tunnel vanishes
          // at exactly the moment he is inside it
          minCamAgl = Math.min(minCamAgl, ceil - L.camera.position.y);
        }
        if (st.exploding) break;
      }
      return { found: true, frames: f, insideFrames, exploded: st.exploding,
               wallHits: (L.flags.wallHits || 0) - w0,
               throughS: Math.round(L.hwyNearest(st.x, st.z).s), target: Math.round(target),
               camClear: +minCamAgl.toFixed(1) };
    });
    check(`road ${tag}: he drives the bore hands-off from one portal to the other without touching a wall, and the chase camera stays under its roof the whole way through`,
      drive.found && !drive.exploded && drive.wallHits === 0 &&
      drive.insideFrames > 60 && drive.throughS >= drive.target - 40 && drive.camClear > 0,
      JSON.stringify(drive));

    await page.close();
  }
};
