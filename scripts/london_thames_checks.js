"use strict";
// ---------------------------------------------------------------------------
// v199: THE THAMES. Tower Bridge opens -- for the tall ship and for his boat -- and never with his
// car where it could be trapped or bang. Every check makes the thing happen and measures it.
//
//   the ship     a round trip up to her berth and back: the bridge is UP every frame her hull is in
//                it, comes down behind her each way, and she is never stopped for good
//   the leaves   up, the flat leaf is no wall and the upright one is; down, the other way round
//   his boat     started in London on the Thames, he sails up and it opens before he gets there; he
//                goes through and it closes behind him; never a bang
//   his car      on the deck when the ship asks, it waits for him to be off; a held finger at a shut
//                bridge stops at the gate and crosses when it is down; coming too fast to stop, it
//                does not begin; never a bang, never a car between the gates while it is up
//   the river    its boats move, keep to the river, and none is a wall
// ---------------------------------------------------------------------------
module.exports = async function londonThamesChecks({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldt = {};
    L.noRender = true; L.api.skipScreens();
    D.f = () => ({ c: L.flags.carCrashes || 0, b: L.flags.boatCrashes || 0, w: L.flags.wallHits || 0, o: L.flags.tbOpens || 0 });
    D.delta = (a) => { const b = D.f(); const o = {}; for (const k in a) o[k] = b[k] - a[k]; return o; };
    // the ship out of the way, at sea, for a long while -- or where a check wants her
    D.shipAway = (t) => { const S = L.ldn.tship; S.state = "away"; S.t = t || 1e6; S.z = L.LD.river.ship.from; S.v = 0; };
    D.bridgeDown = () => { const T = L.ldn.tb; T.state = "down"; T.open = 0; T.gate = 0; T.t = 0; L.ldTbUpdate(0); };
    D.frame = (steer, pitch) => {
      L.api.setStick(steer || 0, pitch || 0); L.update(1 / 60);
      if (st.exploding) { st.explodeTimer = 0; L.api.setStick(0, 0); for (let i = 0; i < 40; i++) L.update(1 / 60); return true; }
      return false;
    };
    D.hull = () => { const S = L.ldn.tship, T = L.ldn.tb, h = L.LD.river.ship.len / 2; return Math.abs(S.z - T.z) < h + 12; };
  });

  // ---- the tall ship's round trip ---------------------------------------------------------------
  const ship = await page.evaluate(() => {
    const L = window.__lp, D = window.__ldt, S = L.ldn.tship, T = L.ldn.tb;
    L.api.setVehicle("prop"); L.ldStart();
    D.bridgeDown(); D.shipAway(2);
    const f0 = D.f();
    let inHull = 0, inHullShut = 0, maxStill = 0, still = 0, seq = [], last = "", trips0 = L.flags.tbShipRoundTrips || 0;
    for (let f = 0; f < 60 * 600; f++) {
      L.update(1 / 60);
      if (D.hull()) { inHull++; if (T.open < 1) inHullShut++; }
      if ((S.state === "in" || S.state === "out") && S.v < 0.05) still++; else still = 0;
      maxStill = Math.max(maxStill, still);
      const k = S.state + ":" + T.state;
      if (k !== last) { seq.push(k); last = k; }
      if ((L.flags.tbShipRoundTrips || 0) > trips0) break;
    }
    return { inHull, inHullShut, maxStillS: +(maxStill / 60).toFixed(1), trips: (L.flags.tbShipRoundTrips || 0) - trips0, opens: D.delta(f0).o,
             endOpen: T.open, endState: T.state, seq: seq.join(" ") };
  });
  check(`london thames: the tall ship goes up to her berth and back down, and Tower Bridge opens for her both ways (${ship.opens} times) -- UP every one of the ${ship.inHull} frames her hull is in it -- and comes down behind her; she is never held more than a few seconds`,
    ship.trips === 1 && ship.opens === 2 && ship.inHull > 200 && ship.inHullShut === 0 && ship.endOpen === 0 && ship.maxStillS < 15, JSON.stringify(ship));

  // ---- the leaves are walls where they stand ----------------------------------------------------
  const leaves = await page.evaluate(() => {
    const L = window.__lp, D = window.__ldt, T = L.ldn.tb, deck = L.ldDeckY();
    const probe = () => {
      const flat = [], up = [];
      for (const lf of L.ldn.tbLeaves) {
        const hx = T.x + lf.sx * T.half;
        flat.push(!!L.solidQuery(hx - lf.sx * T.half * 0.6, deck - 0.5, T.z, 1, L.SOLID.AIR));
        up.push(!!L.solidQuery(hx - lf.sx * 3, deck + 18, T.z, 1, L.SOLID.AIR));
      }
      return { flat, up };
    };
    D.shipAway(); D.bridgeDown();
    const down = probe();
    T.state = "up"; T.open = 1; T.gate = 1; L.ldTbUpdate(0);
    // (held up: the ship is away and nothing asks, so the update would start it down -- probe at once)
    const raised = probe();
    D.bridgeDown();
    return { down, raised };
  });
  check("london thames: down, each leaf is a deck to land on and no upright wall; up, the flat leaf is gone from the registry and the raised one is a wall",
    leaves.down.flat.every(Boolean) && !leaves.down.up.some(Boolean) && !leaves.raised.flat.some(Boolean) && leaves.raised.up.every(Boolean), JSON.stringify(leaves));

  // ---- his boat ---------------------------------------------------------------------------------
  const boat = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldt, T = L.ldn.tb;
    L.api.setVehicle("speedboat"); D.shipAway(); D.bridgeDown(); L.ldStart();
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const o = { start: { x: Math.round(st.x), z: Math.round(st.z), onWater: L.boatOnWater(), origin: st.originIdx, upRiver: -Math.cos(st.heading) > 0.9 } };
    const f0 = D.f();
    let openAt = null, minGap = Infinity, through = false, closedAfter = false, wet = 0, f = 0;
    // a held finger, steering for the river's middle a little way ahead
    for (; f < 60 * 120; f++) {
      const R = L.ldRiverMid(st.z + 40), want = Math.atan2(-(R.x - st.x), -40), err = Math.atan2(Math.sin(want - st.heading), Math.cos(want - st.heading));
      D.frame(Math.abs(err) < 0.04 ? 0 : clampS(-err * 3), 0.2);
      if (L.boatOnWater()) wet++;
      const dz = T.z - st.z;
      if (dz > 0) minGap = Math.min(minGap, dz);
      if (openAt === null && T.open >= 1) openAt = Math.round(dz);
      if (dz < -20) through = true;
      if (through && st.z > T.z + L.LD.river.boatClear + 60) { for (let i = 0; i < 60 * 20; i++) D.frame(0, 0); closedAfter = T.open === 0; break; }
    }
    function clampS(v) { return Math.max(-1, Math.min(1, v)); }
    o.run = { openAt, through, closedAfter, onWaterShare: +(wet / f).toFixed(2), ...D.delta(f0) };
    return o;
  });
  check("london thames: the speedboat started in London stands on the Thames below Tower Bridge, bow up the river",
    boat.start.onWater && boat.start.origin === 2 && boat.start.upRiver, JSON.stringify(boat.start));
  check(`london thames: sailing up in the speedboat, Tower Bridge is open before he reaches it (${boat.run.openAt} m short); he goes through, and it closes behind him; never a bang`,
    boat.run.openAt !== null && boat.run.openAt > 20 && boat.run.through && boat.run.closedAfter && boat.run.b === 0 && boat.run.onWaterShare > 0.95 && boat.run.o === 1, JSON.stringify(boat.run));

  // ---- his car ----------------------------------------------------------------------------------
  const car = await page.evaluate(() => {
    const L = window.__lp, st = L.state, D = window.__ldt, T = L.ldn.tb, S = L.ldn.tship, R = L.ldn.roads.towerBridge;
    const out = {};
    const place = (road, dir, s, v) => {
      const q = {}; L.stPointAt(road, s, dir, road.lo, q);
      st.x = q.x; st.z = q.z; st.y = L.stRoadY(road, q.x, q.z, s); st.heading = Math.atan2(-q.fx, -q.fz); st.speed = v; st.exploding = false;
      L.car.yield = 1; L.car.steer = 0; L.car.spent = 0; L.car.lastHeld = 0; L.stPlan.road = road; L.stPlan.dir = dir; L.stPlan.turn = null;
    };
    const shipAsks = () => { S.state = "in"; S.dir = 1; S.z = T.z - 260; S.v = 9; };   // coming, and asking within a few seconds
    // the bridge's question, not the traffic's: London's traffic off for the whole of this (dead, and staying so)
    const noTraffic = () => { for (const v of L.stTraffic.list) { v.alive = false; v.city = "ldn"; v.respawn = 1e9; } };
    noTraffic();
    // (a) on the deck, mid-span, parked, when the ship asks: it does not begin until he has driven off
    L.api.setVehicle("car"); L.ldStart(); D.shipAway(); D.bridgeDown();
    L.api.clearStick();                 // his finger off the glass: parked
    place(R, 1, R.len / 2, 0);
    shipAsks();
    let begunOn = false, f0 = D.f();
    let why = null;
    for (let f = 0; f < 60 * 8; f++) { L.update(1 / 60); if (T.state !== "down" && !begunOn) { begunOn = true; const p = L.stProject(R, st.x, st.z); why = { f, s: Math.round(p.s), d: +p.d.toFixed(1), car: L.carActive(), veh: st.vp && st.vp.car, expl: st.exploding }; } }
    // then he drives off it, hands-off, and it begins once he is clear of the gate
    let begunAt = null, between = 0;
    for (let f = 0; f < 60 * 40 && begunAt === null; f++) {
      D.frame(0, 0);
      const p = L.stProject(R, st.x, st.z), inGates = p.d < 12 && p.s > T.gateS[0] && p.s < T.gateS[1];
      if (T.state !== "down") { begunAt = Math.round(p.s); if (inGates) between++; }
    }
    out.deck = { begunWhileOn: begunOn, why, begunAt, between, ...D.delta(f0) };
    // (b) the bridge up, a held finger coming at it at cruise from the street beyond the east junction
    D.shipAway(); D.bridgeDown();
    T.state = "up"; T.open = 1; T.gate = 1;
    shipAsks(); S.z = T.z;            // she is IN it: it stays up while she clears
    const east = R.b, inArm = east.arms.find(a => a.road !== R && a.road.kind === "grid" && Math.abs(a.dx) > 0.9);
    const road = inArm.road, dir = inArm.atStart ? -1 : 1;
    place(road, dir, dir > 0 ? Math.max(5, road.len - 90) : Math.min(road.len - 5, 90), L.CAR.cruise);
    f0 = D.f();
    let minToGate = Infinity, passedShut = 0, crossed = false, f = 0, waited = 0;
    for (; f < 60 * 120; f++) {
      D.frame(0, 0);
      const p = L.stProject(R, st.x, st.z);
      if (p.d < 12) {
        const toGate = p.s - T.gateS[1];           // westbound: the east gate is his
        if (T.state !== "down") { minToGate = Math.min(minToGate, toGate); if (toGate < -1) passedShut++; if (st.speed < 0.3) waited++; }
        if (p.s < T.gateS[0] - 5) { crossed = true; break; }
      }
    }
    out.held = { minToGate: +minToGate.toFixed(1), passedShut, waitedS: +(waited / 60).toFixed(1), crossed, s: +(f / 60).toFixed(1), ...D.delta(f0) };
    // (c) coming at it fast, close, as the ship asks: it does not begin under him
    D.shipAway(); D.bridgeDown(); noTraffic();
    place(road, dir, dir > 0 ? road.len - 25 : 25, L.CAR.cruise);
    shipAsks(); S.z = T.z - 200;
    f0 = D.f();
    let underHim = 0, bangAt = null;
    for (let f = 0; f < 60 * 20; f++) {
      const c0 = L.flags.carCrashes || 0, px = st.x, pz = st.z, pv = st.speed, ps = L.stPlan.road && L.stPlan.road.id;
      D.frame(0, 0);
      if ((L.flags.carCrashes || 0) > c0 && !bangAt) bangAt = { f, x: Math.round(px), z: Math.round(pz), v: Math.round(pv), road: ps, bridge: R.id, hit: L.car.dbg };
      const p = L.stProject(R, st.x, st.z);
      if (T.state !== "down" && p.d < 12 && p.s > T.gateS[0] && p.s < T.gateS[1]) underHim++;
    }
    out.fast = { underHim, bangAt, ...D.delta(f0) };
    D.shipAway(); D.bridgeDown();
    for (const v of L.stTraffic.list) v.respawn = 0.5;
    return out;
  });
  check("london thames: parked on Tower Bridge when the ship asks, it does not begin until he has driven off and is clear of the gate; never a bang",
    !car.deck.begunWhileOn && car.deck.begunAt !== null && car.deck.between === 0 && car.deck.c === 0 && car.deck.w === 0, JSON.stringify(car.deck));
  check(`london thames: a held finger at a raised Tower Bridge stops at the gate (${car.held.minToGate} m short), waits there (${car.held.waitedS} s), and crosses when it is down -- never past a shut gate, never a bang`,
    car.held.minToGate >= 0 && car.held.passedShut === 0 && car.held.waitedS > 1 && car.held.crossed && car.held.c === 0 && car.held.w === 0, JSON.stringify(car.held));
  check("london thames: coming at the bridge too fast and too close to stop when the ship asks, it does not begin under him; never a bang",
    car.fast.underHim === 0 && car.fast.c === 0 && car.fast.w === 0, JSON.stringify(car.fast));

  // ---- the river's boats ------------------------------------------------------------------------
  const rb = await page.evaluate(() => {
    const L = window.__lp, B = L.ldn.rboats;
    L.api.setVehicle("prop"); L.api.spawnAt(2, 0);
    const z0 = B.map(b => b.z);
    for (let f = 0; f < 60 * 30; f++) L.update(1 / 60);
    return B.map((b, i) => ({ moved: Math.round(Math.abs(b.z - z0[i])), wet: L.terrainEff(b.x, b.z) < L.seaLevelAt(b.x, b.z),
                              wall: !!L.solidQuery(b.x, L.TUNE.waterLevel + 1, b.z, 2, L.SOLID.BOAT) }));
  });
  check(`london thames: ${rb.length} boats ply the river -- every one moving, on the water, and none of them a wall`,
    rb.length >= 3 && rb.every(b => b.moved > 50 && b.wet && !b.wall), JSON.stringify(rb));

  await page.close();
};
