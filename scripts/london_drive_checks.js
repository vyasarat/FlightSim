"use strict";
// ---------------------------------------------------------------------------
// v198: DRIVING LONDON. Every check is a drive, and every number a delta or a measure.
// (The turn rule itself -- a full steer held through the approach, a turn done is spent, a
// building at speed -- runs on London's grid in city_checks.js, beside New York's.)
//
//   the graph   one network, both banks joined by the two bridges, every lane LEFT of its road's
//               middle (the parent, 2026-10-26), the only dead end the airport road's turnaround
//   the start   a car started in London stands on the way in from its airport, in its left lane,
//               bound for the city; the globe offers it
//   hands-off   a held finger from the airport drives into the city and back, round and round,
//               never a bang, never a touch, never off the road, never stuck
//   bridges     each bridge is driven both ways, hands-off, through Tower Bridge's arches,
//               never a bang; and a full steer held at its junction turns him on to it
//   traffic     keeps left; its taxis are black cabs and its buses red double-deckers in London,
//               and New York's are still New York's
//   the river   off the road he is held at the Thames's edge, never in it; off every road in
//               Britain the pull and a reassembly are London's, never across the sea
//   perf        (the solo phase) a car in a London street against one in New York's
// ---------------------------------------------------------------------------
module.exports = async function londonDriveChecks({ newPage, check, perf }) {
  const perfBlock = async () => {
    const { page } = await newPage(820, 1180);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = {};
      L.api.skipScreens(); L.api.setView(true);
      const views = { "london-car": [2, -400, 14356, -700, 14356], "london-car-bridge": [2, -560, 13780, -900, 13780], "ny-car": [0, -400, 4300, -400, 4100] };
      for (const [k, [at, x, z, tx, tz]] of Object.entries(views)) {
        L.api.setVehicle("car"); L.api.spawnAt(at, 0);
        const R = L.stReassembleAt(x, z, Math.atan2(-(tx - x), -(tz - z)), null, Infinity);
        const put = () => { st.x = R.x; st.z = R.z; st.y = R.y; st.heading = R.heading; st.speed = 0; L.stPlan.road = R.road; L.stPlan.dir = R.dir; };
        for (let i = 0; i < 60 * 8; i++) { put(); L.update(1 / 60); }
        const ms = []; let calls = 0, tris = 0;
        for (let i = 0; i < 6; i++) {
          put(); L.update(1 / 60);
          const t0 = performance.now();
          L.renderer.render(L.scene, L.camera);
          ms.push(performance.now() - t0);
          calls = L.renderer.info.render.calls; tris = L.renderer.info.render.triangles;
        }
        ms.sort((a, b) => a - b);
        out[k] = { calls, tris, ms: +ms[3].toFixed(1) };
      }
      return out;
    });
    console.log("INFO  london drive perf (SwiftShader: calls/tris are the proxy, ms only a bound): " + JSON.stringify(r));
    const N = r["ny-car"];
    check("london drive perf: in a London street, and on Tower Bridge's approach, a car costs no more than in New York's -- draw calls and triangles (SwiftShader: the iPad proxy)",
      ["london-car", "london-car-bridge"].every(k => r[k].calls <= N.calls && r[k].tris <= N.tris), JSON.stringify(r));
    await page.close();
  };
  if (perf === "only") return perfBlock();

  const { page } = await newPage(820, 1180);
  await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldd = {};
    L.noRender = true; L.api.skipScreens();
    D.flags = () => ({ c: L.flags.carCrashes || 0, w: L.flags.wallHits || 0, t: L.flags.cityTrafficHit || 0, e: L.flags.ldEmbankHolds || 0 });
    D.delta = (a) => { const b = D.flags(); const o = {}; for (const k in a) o[k] = b[k] - a[k]; return o; };
    D.london = () => { L.api.setVehicle("car"); L.ldStart(); for (let i = 0; i < 20; i++) L.update(1 / 60); L.spdReset(); };
    D.placeOn = (road, dir, s, speed) => {
      const q = {};
      L.stPointAt(road, s, dir, road.lo, q);
      st.x = q.x; st.z = q.z; st.heading = Math.atan2(-q.fx, -q.fz); st.y = L.stRoadY(road, q.x, q.z, s);
      st.speed = speed || 0; st.exploding = false;
      L.car.yield = 1; L.car.steer = 0; L.car.crashCool = 0; L.car.assistOff = 0; L.car.spent = 0; L.car.lastHeld = 0;
      L.stPlan.road = road; L.stPlan.dir = dir; L.stPlan.turn = null;
    };
    D.frame = (steer) => {
      L.api.setStick(steer || 0, 0);
      L.update(1 / 60);
      if (st.exploding) { st.explodeTimer = 0; L.api.setStick(0, 0); for (let i = 0; i < 40; i++) L.update(1 / 60); return true; }
      return false;
    };
    D.wet = (x, z) => L.terrainEff(x, z) < L.seaLevelAt(x, z);
  });

  // ---- the graph ------------------------------------------------------------------------------
  const g = await page.evaluate(() => {
    const L = window.__lp, C = L.streets.cities.ldn, o = {};
    if (!C) return { none: true };
    const comp = new Map(); let nc = 0;
    for (const n of C.nodes) {
      if (comp.has(n)) continue;
      const stack = [n]; comp.set(n, nc);
      while (stack.length) { const m = stack.pop(); for (const a of m.arms) { const q = a.road.a === m ? a.road.b : a.road.a; if (q && !comp.has(q)) { comp.set(q, nc); stack.push(q); } } }
      nc++;
    }
    o.roads = C.roads.length; o.nodes = C.nodes.length; o.comps = nc;
    o.left = C.roads.concat(C.links).every(r => r.lo < 0);
    o.deadEnds = C.nodes.filter(n => n.arms.length === 1).map(n => ({ x: Math.round(n.x), z: Math.round(n.z), goal: !!n.arms[0].road.goal }));
    o.links = Object.fromEntries(Object.entries(L.ldn.roads).map(([k, r]) => [k, r ? { len: Math.round(r.len), a: !!r.a, b: !!r.b, arms: [r.a && r.a.arms.length, r.b && r.b.arms.length] } : null]));
    // the bridges cross from one bank to the other: dry at both ends, water under the middle
    o.banks = ["towerBridge", "londonBridge"].map(k => { const r = L.ldn.roads[k], p = r.pts, m = p[p.length >> 1];
      return { k, dryEnds: L.terrainEff(p[0].x, p[0].z) >= L.seaLevelAt(p[0].x, p[0].z) && L.terrainEff(p[p.length - 1].x, p[p.length - 1].z) >= L.seaLevelAt(p[p.length - 1].x, p[p.length - 1].z), wetMiddle: L.terrainEff(m.x, m.z) < L.seaLevelAt(m.x, m.z) }; });
    // and every grid street is dry and clear (streets.js measured it; the river split none)
    o.grid = C.roads.every(r => r.kind === "grid");
    return o;
  });
  check(`london drive: ${g.roads} streets and ${g.nodes} junctions read off the generated layout, ONE network -- the two banks joined by Tower Bridge and London Bridge, the airport road into it -- every lane left of its road's middle, and the only dead end the airport road's turnaround`,
    !g.none && g.roads > 300 && g.comps === 1 && g.left && g.deadEnds.length === 1 && g.deadEnds[0].goal &&
    ["towerBridge", "londonBridge", "airport"].every(k => g.links[k] && g.links[k].a && g.links[k].b) && g.banks.every(b => b.dryEnds && b.wetMiddle), JSON.stringify(g));

  // ---- the start, and hands-off ---------------------------------------------------------------
  const ho = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldd, o = {};
    D.london();
    const R = L.ldn.roads.airport, p = L.stProject(R, st.x, st.z);
    o.start = { origin: st.originIdx, onAirportRoad: L.stPlan.road === R || p.d < 5, lat: +(p.lat).toFixed(1), facingCity: (-Math.sin(st.heading) * p.fx + -Math.cos(st.heading) * p.fz) > 0.95, speed: st.speed };
    // a held finger, nothing else, for four minutes
    const f0 = D.flags();
    let off = 0, bangs = 0, still = 0, stuckMax = 0, minX = Infinity, airport = 0, city = 0, bridgeSeen = 0, laneSum = 0, laneN = 0;
    const was = { x: st.x, z: st.z };
    for (let f = 0; f < 60 * 240; f++) {
      if (D.frame(0)) bangs++;
      if (!L.car.onRoad) off++;
      still = st.speed < 0.5 ? still + 1 : 0; stuckMax = Math.max(stuckMax, still);
      minX = Math.min(minX, st.x);
      const r = L.stPlan.road;
      if (r === R) airport++; else if (r && r.kind === "grid") city++;
      // on a straight grid street, out of the junctions: which side of its middle is he?
      if (r && r.kind === "grid" && !L.stPlan.turn?.committed && f % 30 === 0) {
        const q = L.stProject(r, st.x, st.z), toEnd = Math.min(q.s, r.len - q.s);
        if (toEnd > 25) { laneSum += q.lat * L.stPlan.dir; laneN++; }
      }
    }
    o.drive = { bangs, off, stuckS: +(stuckMax / 60).toFixed(1), deepestWest: Math.round(minX), airportS: Math.round(airport / 60), cityS: Math.round(city / 60), lane: laneN ? +(laneSum / laneN).toFixed(2) : null, laneN, ...D.delta(f0) };
    return o;
  });
  check("london drive: a car started in London stands on the way in from its airport, still, in its LEFT lane, facing the city",
    ho.start.origin === 2 && ho.start.onAirportRoad && ho.start.lat < -2 && ho.start.facingCity && ho.start.speed === 0, JSON.stringify(ho.start));
  check(`london drive: hands-off for four minutes from the airport he drives into the city and back to the airport and in again (${ho.drive.cityS} s in the grid, ${ho.drive.airportS} s on the airport road), on the LEFT (${ho.drive.lane} m), never a bang, never a touch, never off the road, never stuck`,
    ho.drive.bangs === 0 && ho.drive.c === 0 && ho.drive.w === 0 && ho.drive.t === 0 && ho.drive.off === 0 && ho.drive.stuckS < 3 &&
    ho.drive.cityS > 60 && ho.drive.airportS > 20 && ho.drive.lane < -2.5 && ho.drive.laneN > 20, JSON.stringify(ho.drive));

  // ---- the bridges ----------------------------------------------------------------------------
  const br = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldd, out = [];
    const top = L.ldn.decks && L.TUNE.waterLevel + 9 + 0.3;
    for (const k of ["towerBridge", "londonBridge"]) for (const dir of [1, -1]) {
      D.london();
      for (const v of L.stTraffic.list) v.alive = false;
      const r = L.ldn.roads[k];
      D.placeOn(r, dir, dir > 0 ? 6 : r.len - 6, 12);
      const f0 = D.flags();
      let f = 0, maxY = -Infinity, wetUnder = 0, off = 0, solidHits = 0, bangs = 0, laneSum = 0, laneN = 0;
      const sh0 = L.flags.solidShoves || 0;
      while (f < 60 * 30 && L.stPlan.road === r) {
        if (D.frame(0)) bangs++;
        f++;
        if (D.wet(st.x, st.z)) { wetUnder++; maxY = Math.max(maxY, st.y); }
        if (!L.car.onRoad) off++;
        const q = L.stProject(r, st.x, st.z); if (q.s > 40 && q.s < r.len - 40) { laneSum += q.lat * dir; laneN++; }
      }
      out.push({ k, dir, s: +(f / 60).toFixed(1), across: L.stPlan.road !== r, bangs, off, overWater: wetUnder, deck: +(maxY - top).toFixed(2), lane: laneN ? +(laneSum / laneN).toFixed(2) : null, shoves: (L.flags.solidShoves || 0) - sh0, ...D.delta(f0) });
    }
    // a full steer held at the junction turns him ON to Tower Bridge
    D.london();
    for (const v of L.stTraffic.list) v.alive = false;
    const tb = L.ldn.roads.towerBridge, node = tb.b;                       // the east bank's junction
    let pick = null;
    for (const inArm of node.arms) {
      if (inArm.road === tb || inArm.road.kind !== "grid") continue;
      const c = L.stChoices(node, inArm).find(q => q.arm.road === tb && Math.abs(q.ang) > 1.2);
      if (c) { pick = { inArm, side: Math.sign(c.ang) }; break; }
    }
    let turned = null, bangs = 0;
    if (pick) {
      const road = pick.inArm.road, dir = pick.inArm.atStart ? -1 : 1;
      D.placeOn(road, dir, dir > 0 ? Math.max(5, road.len - 70) : Math.min(road.len - 5, 70), L.CAR.cruise);
      for (let f = 0; f < 60 * 12 && turned === null; f++) {
        if (D.frame(L.stPlan.road === road ? pick.side : 0)) bangs++;
        if (L.stPlan.road !== road && L.stPlan.road) turned = L.stPlan.road === tb ? "bridge" : "other";
      }
    }
    return { out, turnOn: { found: !!pick, side: pick && pick.side, turned, bangs } };
  });
  check(`london drive: each bridge driven both ways hands-off, up on to its deck over the water and across -- through Tower Bridge's arches -- in the LEFT lane, never a bang, never a shove, never off it`,
    br.out.length === 4 && br.out.every(b => b.across && b.bangs === 0 && b.c === 0 && b.w === 0 && b.shoves === 0 && b.off === 0 && b.overWater > 60 && Math.abs(b.deck) < 0.6 && b.lane < -2.5), JSON.stringify(br.out));
  check("london drive: a full steer held through the approach to Tower Bridge's junction turns him on to the bridge, as at any junction",
    br.turnOn.found && br.turnOn.turned === "bridge" && br.turnOn.bangs === 0, JSON.stringify(br.turnOn));

  // ---- traffic --------------------------------------------------------------------------------
  const tr = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldd, o = {};
    const shapes = () => Object.fromEntries(L.stTraffic.meshes.map(m => [m.userData.vkShape, m.count]));
    const sides = (city) => L.stTraffic.list.filter(v => v.alive && !v.path && !v.spin && v.city === city).map(v => { const p = L.stProject(v.road, v.wx, v.wz); return p.lat * v.dir; });
    D.london();
    for (let f = 0; f < 60 * 30; f++) D.frame(0);
    o.ldn = { shapes: shapes(), sides: sides("ldn"), cabs: L.stTraffic.list.filter(v => v.alive && v.city === "ldn" && v.type === 1).length, buses: L.stTraffic.list.filter(v => v.alive && v.city === "ldn" && v.type === 2).length };
    // and in New York, New York's
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    const C = L.streets.cities.ny, r = C.roads.filter(q => q.kind === "grid")[40];
    D.placeOn(r, 1, r.len / 2, 0);
    for (let f = 0; f < 60 * 30; f++) { D.placeOn(r, 1, r.len / 2, 0); L.update(1 / 60); }
    o.ny = { shapes: shapes(), sides: sides("ny") };
    o.tints = { ldnCab: L.stTintOf({ type: 1, city: "ldn", slot: 1 }).toString(16), ldnBus: L.stTintOf({ type: 2, city: "ldn", slot: 4 }).toString(16),
                nyCab: L.stTintOf({ type: 1, city: "ny", slot: 1 }).toString(16), nyBus: L.stTintOf({ type: 2, city: "ny", slot: 4 }).toString(16) };
    return o;
  });
  const S = tr.ldn.shapes, N = tr.ny.shapes;
  check(`london drive: London's traffic keeps LEFT (${tr.ldn.sides.length} cars, every one ${tr.ldn.sides.length ? Math.max(...tr.ldn.sides).toFixed(1) : "?"} m or more left of its road's middle) and New York's still keeps right`,
    tr.ldn.sides.length > 10 && tr.ldn.sides.every(s => s < -2) && tr.ny.sides.length > 5 && tr.ny.sides.every(s => s > 2), JSON.stringify({ ldn: tr.ldn.sides, ny: tr.ny.sides }));
  check(`london drive: in London the taxis are black cabs (${S.cab}) and the buses red double-deckers (${S.decker}) -- none of New York's yellow taxis or blue buses -- and in New York, New York's (${N.taxi} taxis, ${N.bus} buses, no cab, no double-decker)`,
    tr.ldn.cabs > 0 && tr.ldn.buses > 0 && S.cab === tr.ldn.cabs && S.decker === tr.ldn.buses && S.taxi === 0 && S.bus === 0 &&
    N.cab === 0 && N.decker === 0 && N.taxi > 0 && N.bus > 0 && tr.tints.ldnBus !== tr.tints.nyBus && tr.tints.ldnCab !== tr.tints.nyCab,
    JSON.stringify(tr));

  // ---- the river and the far pull -------------------------------------------------------------
  const rv = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldd, o = {};
    // off the road on the bank, steering hard for the water: held at the edge, never in it
    D.london();
    for (const v of L.stTraffic.list) v.alive = false;
    const tries = [];
    // two places on the Thames clear of the bridges and the landmarks, from both banks: out from the
    // river's middle to its edge, then 35 m on up the bank, and steer hard back at the middle
    const T = L.LD.thames.pts;
    for (const i of [8, 4]) for (const sg of [1, -1]) {
      const [cx, cz] = T[i], [ax, az] = T[i - 1], [bx, bz] = T[i + 1];
      const l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l * sg, nz = (bx - ax) / l * sg;
      let e = 0; while (e < 400 && (D.wet(cx + nx * e, cz + nz * e) || L.terrainEff(cx + nx * e, cz + nz * e) < L.seaLevelAt(cx, cz) + 1)) e += 2;
      const x = cx + nx * (e + 35), z = cz + nz * (e + 35);
      st.x = x; st.z = z; st.y = L.terrainEff(x, z); st.speed = 15; st.heading = Math.atan2(nx, nz); st.exploding = false;
      L.stPlan.road = null; L.car.yield = 1;
      const f0 = D.flags();
      let wet = 0, bangs = 0, firstWet = null;
      for (let f = 0; f < 60 * 8; f++) {
        // a full steer held for the river's middle the whole time: his steering, not the road's
        const want = Math.atan2(-(cx - st.x), -(cz - st.z)), err = Math.atan2(Math.sin(want - st.heading), Math.cos(want - st.heading));
        if (D.frame(Math.abs(err) < 0.05 ? 0 : err > 0 ? -1 : 1)) bangs++;
        if (D.wet(st.x, st.z)) { wet++; if (!firstWet) firstWet = { f, x: +st.x.toFixed(1), z: +st.z.toFixed(1), onRoad: L.car.onRoad, road: L.stPlan.road && L.stPlan.road.kind }; }
      }
      tries.push({ at: [Math.round(x), Math.round(z)], edge: e, wet, firstWet, bangs, holds: D.delta(f0).e, end: [Math.round(st.x), Math.round(st.z)] });
    }
    o.river = tries;
    // far out in the downs, off every road and pointing away from London: the pull is London's
    D.london();
    const far = [];
    for (const [x, z, h] of [[1400, 12600, Math.PI / 2], [-2400, 13000, -Math.PI / 2], [600, 17800, 0]]) {
      st.x = x; st.z = z; st.y = L.terrainEff(x, z); st.heading = h; st.speed = 0; st.exploding = false; L.stPlan.road = null; L.car.rejoin = null; L.car.yield = 1;
      const d0 = nearest();
      let minZ = Infinity;
      for (let f = 0; f < 60 * 60; f++) { D.frame(0); minZ = Math.min(minZ, st.z); }
      far.push({ x, z, d0: Math.round(d0), d1: Math.round(nearest()), minZ: Math.round(minZ), rejoin: L.car.rejoin && L.car.rejoin.kind });
    }
    function nearest() { let b = Infinity; for (const r of L.streets.cities.ldn.roads.concat(L.streets.cities.ldn.links)) b = Math.min(b, L.stProject(r, st.x, st.z).d); return b; }
    o.far = far;
    // a bang with nowhere to come back but the road: in the Thames, in the middle of the downs
    const back = [];
    for (const [x, z] of [[-900, 14600], [1500, 12700]]) {
      D.london();
      st.x = x; st.z = z; L.car.crashX = x; L.car.crashZ = z; L.car.crashOn = { off: true }; L.car.crashNx = 0; L.car.crashNz = 0;
      if (D.wet(x, z)) { /* in the river: the spot will not do */ }
      L.carReassemble();
      back.push({ x, z, at: [Math.round(st.x), Math.round(st.z)], london: st.z > 11000, dry: !D.wet(st.x, st.z) });
    }
    o.back = back;
    return o;
  });
  check("london drive: steering off the bank for the Thames, he is held at its edge as a rail holds him -- never in the water, never a bang",
    rv.river.every(t => t.wet === 0 && t.bangs === 0 && t.holds > 0), JSON.stringify(rv.river));
  check("london drive: off every road out in the downs, pointing away, hands-off pulls him back toward London's roads -- never toward New York across the sea -- and a reassembly with nowhere else to go is on London's road",
    rv.far.every(t => t.d1 < t.d0 && t.minZ > 11000) && rv.back.every(b => b.london && b.dry), JSON.stringify({ far: rv.far, back: rv.back }));

  await page.close();
  if (perf !== "skip") await perfBlock();
};
