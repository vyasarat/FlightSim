"use strict";
// ---------------------------------------------------------------------------
// THE CITIES, DRIVEN. Every check here is a drive, and every number is a delta.
//
// The brief: hands-off from a city's off-ramp he loops through the city and out
// on to the motorway without a bang, at every speed step; holding left or right
// at a junction turns him on to the cross street; a building at speed is a bang
// and he comes back on the street, facing along it; a red in the city starts a
// chase that follows him through the grid; the bridge and its ramp can be
// driven, the fountain can be driven through, the boulevard reaches the coast
// road; nothing streamed stands in any street; and the city's traffic stops at
// its reds. Portrait, both views: the drives run in the driving seat on the
// first viewport and in the chase view on the second.
// ---------------------------------------------------------------------------

// The in-page driver: installed once per page, so every drive is the same code.
function installDriver() {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const D = window.__city = {};
  D.flags = () => ({ c: L.flags.carCrashes || 0, w: L.flags.wallHits || 0, t: L.flags.cityTrafficHit || 0,
                     h: L.flags.hwyTrafficHit || 0, r: L.flags.redsRun || 0, p: L.flags.policeChases || 0,
                     s: L.flags.citySplashes || 0, ra: L.flags.carReassemblesCity || 0 });
  D.delta = (a) => { const b = D.flags(); const o = {}; for (const k in a) o[k] = b[k] - a[k]; return o; };
  D.start = (step) => {
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    L.spdReset();
    if (step !== undefined) st.speedStep = step;
    if (L.policeStop) L.policeStop(false);
  };
  // put him on a road's lane, `back` metres short of its end, travelling `dir`
  D.placeOn = (road, dir, back, speed) => {
    const s = dir > 0 ? road.len - back : back;
    const q = {};
    L.stPointAt(road, s, dir, road.lo, q);
    st.x = q.x; st.z = q.z; st.heading = Math.atan2(-q.fx, -q.fz);
    st.y = L.stSurfaceAt(q.x, q.z) ?? L.terrainEff(q.x, q.z);
    st.speed = speed || 0; st.exploding = false;
    L.car.yield = 1; L.car.steer = 0; L.car.crashCool = 0; L.car.assistOff = 0;
    L.stPlan.road = road; L.stPlan.dir = dir; L.stPlan.turn = null;
    L.stTrail.pts.length = 0; L.stTrail.lastX = null;
  };
  // one frame, a finger held, a steer; a bang is let reassemble and counted
  D.frame = (steer) => {
    L.api.setStick(steer || 0, 0);
    L.update(1 / 60);
    // in pieces his finger is off the stick: the steer that hit the wall is not
    // still held when he comes back
    if (st.exploding) { st.explodeTimer = 0; L.api.setStick(0, 0); for (let i = 0; i < 40; i++) L.update(1 / 60); return true; }
    return false;
  };
  D.onHighway = () => { const n = L.hwyNearest(st.x, st.z); return !L.car.onStreet && n && Math.abs(n.lateral) < L.highway.halfW; };
  D.city = (k) => L.streets.cities[k];
}

module.exports = async function cityChecks({ newPage, check, viewports }) {
  for (let vi = 0; vi < viewports.length; vi++) {
    const [w, h] = viewports[vi];
    const chase = vi % 2 === 1;
    const tag = `${w}x${h} ${chase ? "chase" : "seat"}`;
    const { page, errors } = await newPage(w, h);
    await page.evaluate(installDriver);
    await page.evaluate((c) => window.__lp.api.setView(c), chase);

    // ---- 0. the graph: every street joined at both ends, the only dead end the
    // bridge's turnaround, and a hands-off route from each off-ramp to the way out
    if (vi === 0) {
      const g = await page.evaluate(() => {
        const L = window.__lp, out = {};
        for (const k in L.streets.cities) {
          const C = L.streets.cities[k];
          const deadEnds = C.nodes.filter(n => n.arms.length < 2).map(n => ({ x: Math.round(n.x), z: Math.round(n.z),
            road: n.arms[0] && n.arms[0].road.kind }));
          // walk the policy from the entry, the way a held finger would
          const enter = L.highway.exits.find(e => e.to === k + "CityIn").street;
          let arm = enter.a.arms.find(a => a.road === enter), node = enter.a, steps = 0, out_ = false;
          const straightOr = (n, inArm) => {
            const ch = L.stChoices(n, inArm), s = L.stStraight(ch);
            return s ? s.arm : n.policy.get(inArm);
          };
          let next = straightOr(node, arm);
          while (steps++ < 400) {
            if (!next) break;
            if (next.road.kind === "exit") { out_ = true; break; }
            const r = next.road, far = next.atStart ? r.b : r.a;
            if (!far) break;
            const inArm = far.arms.find(b => b.road === r && b.atStart !== next.atStart);
            next = straightOr(far, inArm);
          }
          out[k] = { nodes: C.nodes.length, roads: C.roads.length, dropped: C.dropped || 0, deadEnds,
                     loopHops: steps, loopLeaves: out_, links: C.links.map(l => l.kind) };
        }
        return out;
      });
      for (const k of ["ny", "ca"]) {
        const c = g[k];
        const onlyTurnaround = c.deadEnds.every(d => d.road === "link") && c.deadEnds.length <= (k === "ny" ? 1 : 0);
        check(`city ${k}: ${c.roads} streets and ${c.nodes} junctions read off the generated layout -- every street joined at both ends, the only dead end the bridge's turnaround, and a hands-off route from the off-ramp that leaves the city again (${c.loopHops} junctions)`,
          c.roads > 150 && onlyTurnaround && c.loopLeaves, JSON.stringify(c));
      }
    }

    // ---- 1. THE LOOP: hands-off from the off-ramp, through the city and out
    // on to the motorway, at the slowest, default and top steps
    const loops = await page.evaluate((steps) => {
      const L = window.__lp, st = L.state, D = window.__city, out = [];
      for (const k of ["ny", "ca"]) {
        for (const step of steps) {
          D.start(step);
          const ex = L.highway.exits.find(e => e.to === k + "CityIn");
          const sp = ex.spur, p = sp[Math.floor(sp.length * 0.35)];
          st.x = p.x; st.z = p.z; st.heading = Math.atan2(-p.fx, -p.fz); st.speed = L.CAR.cruise * 0.8;
          st.y = p.y; L.car.yield = 1; L.stPlan.road = null;
          const f0 = D.flags();
          let f = 0, grid = new Set(), home = false, minV = Infinity;
          const bangs = [];
          while (f < 60 * 260) {
            const tb = L.flags.cityTrafficHit || 0, x0 = st.x, z0 = st.z, h0 = st.heading, v0 = st.speed;
            const plan = L.stPlan.turn ? (L.stPlan.turn.forced ? "F" : L.stPlan.turn.held ? "H" : "S") : "-";
            const near = L.stTraffic.list.filter(v => v.alive).map(v => ({ d: Math.hypot(v.wx - x0, v.wz - z0), v })).sort((a, b) => a.d - b.d)[0];
            const snap = near ? { d: +near.d.toFixed(1), type: near.v.type, path: !!near.v.path, sp: +near.v.sp.toFixed(1), hx: +near.v.hx.toFixed(2), hz: +near.v.hz.toFixed(2),
                                  same: near.v.road === L.stPlan.road } : null;
            D.frame(0); f++;
            if ((L.flags.cityTrafficHit || 0) !== tb && bangs.length < 3) bangs.push({ t: +(f / 60).toFixed(1), x: Math.round(x0), z: Math.round(z0),
              h: Math.round(h0 * 57.3), v: +v0.toFixed(1), plan, road: L.stPlan.road && L.stPlan.road.id, near: snap });
            const r = L.stPlan.road;
            if (L.car.onStreet && r && r.kind === "grid") { grid.add(r.id); minV = Math.min(minV, st.speed); }
            if (grid.size > 6 && D.onHighway()) { home = true; break; }
          }
          const d = D.delta(f0);
          out.push({ city: k, step, mul: L.spdMul(), home, secs: Math.round(f / 60), streets: grid.size, hwyT: d.h,
                     cornerV: +minV.toFixed(1), crashes: d.c, walls: d.w, cityTouches: d.t, hwyTouches: d.h, bangs });
        }
      }
      L.spdReset();
      return out;
    }, vi === 0 ? [0, 2, 4] : [2]);
    const badLoops = loops.filter(r => !r.home || r.crashes || r.walls || r.cityTouches || r.hwyTouches);
    check(`city ${tag}: hands-off from each city's off-ramp he loops through the streets and back out on to the motorway -- ${loops.length} loops, ${loops.map(r => `${r.city} x${r.mul} ${r.secs}s ${r.streets} streets`).join(", ")} -- with no crash, no wall and no touch of any traffic`,
      loops.length >= 2 && badLoops.length === 0, JSON.stringify(badLoops.length ? badLoops : loops));

    // ---- 2. TURNING: at a four-way junction, holding left or right turns him
    // on to the cross street; the corner assist sheds speed and gives it back
    const turns = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city, out = [];
      for (const k of ["ny", "ca"]) {
        const C = D.city(k);
        // a four-way junction away from the edge, on a long enough street
        const node = C.nodes.filter(n => n.arms.length === 4 && n.arms.every(a => a.road.kind === "grid") && !n.signal)
          .sort((a, b) => Math.hypot(a.x - C.nodes[0].x, a.z - C.nodes[0].z) - Math.hypot(b.x - C.nodes[0].x, b.z - C.nodes[0].z))[Math.floor(C.nodes.length / 3)];
        const inArm = node.arms[0], road = inArm.road, dir = inArm.atStart ? -1 : 1;
        for (const side of [-1, 1]) {
          D.start(2);
          for (const v of L.stTraffic.list) v.alive = false;     // his turn, not the traffic's
          D.placeOn(road, dir, Math.min(road.len - 5, 60), L.CAR.cruise);
          const want = L.stChoices(node, inArm).find(c => Math.sign(c.ang) === side && Math.abs(c.ang) > 1.2);
          const f0 = D.flags();
          let f = 0, minV = Infinity, held = 0, done = false, maxAfter = 0, turned = false, bangAt = null;
          while (f < 60 * 14) {
            const p = L.stProject(road, st.x, st.z);
            const toGo = dir > 0 ? road.len - p.s : p.s;
            const onTarget = L.stPlan.road === want.arm.road;
            const hdg = L.stProject(want.arm.road, st.x, st.z);
            const along = Math.abs(-Math.sin(st.heading) * hdg.fx + -Math.cos(st.heading) * hdg.fz);
            // hold the turn from inside the corner window until he is round it
            const hold = !turned && (!onTarget || along < 0.94);
            const steer = (toGo < L.ST.cornerAssistDist - 4 && hold && held < 60 * 5) ? side : 0;
            if (steer) held++;
            if (D.frame(steer) && !bangAt) bangAt = { t: +(f / 60).toFixed(1), x: Math.round(st.x), z: Math.round(st.z), turned };
            f++;
            minV = Math.min(minV, st.speed);
            if (onTarget && along > 0.94 && hdg.d < want.arm.road.halfW) turned = true;
            if (onTarget && along > 0.94 && !steer) { done = true; maxAfter = Math.max(maxAfter, st.speed); }
            if (done && f > 60 * 10) break;
          }
          const d = D.delta(f0);
          const hdg = L.stProject(want.arm.road, st.x, st.z);
          out.push({ city: k, side: side < 0 ? "left" : "right", onCross: turned,
                     cornerV: +minV.toFixed(1), after: +maxAfter.toFixed(1), crashes: d.c, walls: d.w, bangAt, node: [node.x, node.z] });
        }
      }
      return out;
    });
    const badTurns = turns.filter(t => !t.onCross || t.crashes || t.walls || t.cornerV > 12 || t.after < 25);
    check(`city ${tag}: holding left or right at a junction turns him on to the cross street -- ${turns.map(t => `${t.city} ${t.side} at ${t.cornerV} m/s`).join(", ")} -- the corner assist slowing him for the corner and giving the speed back after, never a bang`,
      turns.length === 4 && badTurns.length === 0, JSON.stringify(turns));

    // ---- 3. A BUILDING AT SPEED: a bang, and he is back on the street, in his
    // lane, facing along it -- not wherever the last aeroplane crashed
    const bang = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city, out = [];
      for (const k of ["ny", "ca"]) {
        const C = D.city(k);
        D.start(2);
        // the middle of a long street with buildings on it, far from either end
        const road = C.roads.filter(r => r.kind === "grid" && r.len > 90).sort((a, b) => b.len - a.len)[3];
        D.placeOn(road, 1, road.len / 2 + 30, L.CAR.cruise);
        const f0 = D.flags();
        let f = 0, banged = false;
        while (f < 60 * 6 && !banged) { banged = D.frame(1); f++; }
        // D.frame let it reassemble; read him where he came back, before he drives off
        const at = { x: Math.round(st.x), z: Math.round(st.z), h: Math.round(st.heading * 57.3), expl: st.exploding };
        const d = D.delta(f0);
        const back = L.stSurfaceAt(st.x, st.z) !== null;
        const r = L.stPlan.road, p = r ? L.stProject(r, st.x, st.z) : null;
        const along = p ? Math.abs(-Math.sin(st.heading) * p.fx + -Math.cos(st.heading) * p.fz) : 0;
        let inside = false;
        L.forEachSolid(b => { if (!inside && Math.abs(st.x - b.x) < b.hw && Math.abs(st.z - b.z) < b.hd && st.y < b.y1 && st.y > b.y0 - 3) inside = true; });
        out.push({ city: k, banged, crashes: d.c, reassembledOnStreet: d.ra, back, along: +along.toFixed(2), at, road: r && r.id,
                   lateral: p ? +p.lat.toFixed(1) : null, inside });
      }
      return out;
    });
    check(`city ${tag}: steering into a building at speed is a bang, and he comes back on the street he hit it from, in a lane, facing along it`,
      bang.every(b => b.banged && b.crashes === 1 && b.reassembledOnStreet === 1 && b.back && b.along > 0.97 && !b.inside), JSON.stringify(bang));

    // ---- 4. A RED IN THE CITY: the flash, and a chase that follows him down
    // the streets he takes rather than through the buildings between them
    const red = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city;
      D.start(2);
      for (let i = 0; i < 5; i++) D.frame(0);            // the signals are built on the first frames
      const C = D.city("ny");
      const node = C.nodes.find(n => n.signal);
      const j = node.signal, ji = L.lights.junctions.indexOf(j);
      // come at it along the avenue (its main axis) and give the avenue a red
      const inArm = node.arms.find(a => Math.abs(a.dz) > 0.9);
      const road = inArm.road, dir = inArm.atStart ? -1 : 1;
      D.placeOn(road, dir, Math.min(road.len - 5, 55), L.CAR.cruise);
      L.ltForce(ji, "crossGreen");
      const f0 = D.flags();
      let f = 0, frames = 0, onStreet = 0, far = 0, started = -1;
      while (f < 60 * 30) {
        D.frame(0); f++;
        if (started < 0 && L.police.active) started = f;
        if (L.police.active && started >= 0 && f - started > 60) {
          for (const c of L.police.cars) {
            frames++;
            if (L.stSurfaceAt(c.x, c.z) !== null) onStreet++;
          }
          far = Math.max(far, L.policeState().nearest || 0);
        }
        if (f > 60 * 5 && L.ltForce) L.ltForce(ji, "mainGreen");
      }
      const d = D.delta(f0);
      L.policeStop(false);
      return { reds: d.r, chases: d.p, crashes: d.c, frames, onStreet, share: frames ? +(onStreet / frames).toFixed(3) : 0,
               nearestMax: Math.round(far), streets: C.nodes.length };
    });
    check(`city ${tag}: running a red in the city starts the chase, and the police follow him down the streets he drives -- on a street ${Math.round(red.share * 100)}% of the time, never through a block`,
      red.reds >= 1 && red.chases >= 1 && red.crashes === 0 && red.frames > 200 && red.share > 0.97, JSON.stringify(red));

    // ---- 5. THE BRIDGE: straight on at the north-east corner, up the ramp,
    // along the deck to the far end, round, and back down into the city
    const bridge = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city;
      const C = D.city("ny"), B = C.bridge;
      D.start(2);
      const start = B.ramp.a, inArm = start.arms.find(a => a.road.kind === "grid" && Math.abs(a.dz) > 0.9);
      D.placeOn(inArm.road, inArm.atStart ? -1 : 1, 80, L.CAR.cruise);
      const f0 = D.flags();
      let f = 0, maxY = -Infinity, minX = Infinity, onDeck = 0, back = false, turned = false;
      while (f < 60 * 90) {
        D.frame(0); f++;
        maxY = Math.max(maxY, st.y); minX = Math.min(minX, st.x);
        if (L.stPlan.road === B.deck) onDeck++;
        if (minX < B.xEnd + 25) turned = true;
        if (turned && L.stPlan.road && L.stPlan.road.kind === "grid") { back = true; break; }
      }
      const d = D.delta(f0);
      return { top: +B.top.toFixed(1), maxY: +maxY.toFixed(1), reachedFarEnd: minX < B.xEnd + 25, farEnd: Math.round(B.xEnd),
               minX: Math.round(minX), deckSecs: Math.round(onDeck / 60), back, secs: Math.round(f / 60), crashes: d.c, walls: d.w };
    });
    check(`city ${tag}: New York's bridge -- straight on at the north-east corner takes him up the ramp and along the deck ${bridge.deckSecs}s to the far end, round the turnaround and back down into the city, hands-off, no bang`,
      bridge.maxY > bridge.top - 1 && bridge.reachedFarEnd && bridge.back && bridge.crashes === 0 && bridge.walls === 0, JSON.stringify(bridge));

    // ---- 6. THE FOUNTAIN: off the street, across the square, straight through
    // the water -- a splash and nothing else -- and let go, the road takes him back
    const fountain = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city;
      const C = D.city("ny"), S = C.square;
      D.start(1);
      for (const v of L.stTraffic.list) v.alive = false;     // his drive through the square, not the junction's traffic
      // from the junction at the square's corner -- no parking that close to a
      // junction -- pointing at the fountain
      const R = S.rect, corner = C.nodes.map(n => ({ n, d: Math.hypot(n.x - R[0], n.z - R[1]) })).sort((a, b) => a.d - b.d)[0].n;
      const road = corner.arms[0].road;
      D.placeOn(road, corner.arms[0].atStart ? -1 : 1, 1, 12);
      st.x = corner.x; st.z = corner.z; st.heading = Math.atan2(-(S.x - st.x), -(S.z - st.z));
      const f0 = D.flags();
      let f = 0, through = false, minD = Infinity, backOn = -1, bangAt = null;
      while (f < 60 * 25) {
        const d = Math.hypot(st.x - S.x, st.z - S.z);
        minD = Math.min(minD, d);
        if (d < 3) through = true;
        let steer = 0;
        if (!through) {
          // point at the fountain
          const want = Math.atan2(-(S.x - st.x), -(S.z - st.z));
          steer = Math.max(-1, Math.min(1, -L.wrapPi(want - st.heading) * 3));
        }
        const x0 = st.x, z0 = st.z, v0 = st.speed, ph = through;
        if (D.frame(steer) && !bangAt) bangAt = { x: Math.round(x0), z: Math.round(z0), v: +v0.toFixed(1), through: ph, hit: L.stTraffic.lastTouch };
        f++;
        if (through && backOn < 0 && L.car.onStreet && L.car.onRoad && Math.abs(L.car.lateral) < 8) backOn = f;
      }
      const d = D.delta(f0);
      return { through, minD: +minD.toFixed(1), splashes: d.s, crashes: d.c, walls: d.w, backOnStreet: backOn > 0, bangAt };
    });
    check(`city ${tag}: the square's fountain can be driven straight through -- a splash and nothing else -- and letting go, the road takes him back`,
      fountain.through && fountain.splashes >= 1 && fountain.crashes === 0 && fountain.walls === 0 && fountain.backOnStreet, JSON.stringify(fountain));

    // ---- 7. THE BOULEVARD: downtown to the coast road, where hands-off turns
    // him for the harbour -- which is how the car reaches the boats
    const blvd = await page.evaluate(() => {
      const L = window.__lp, st = L.state, D = window.__city;
      const C = D.city("ca"), B = C.boulevard;
      D.start(2);
      const inArm = B.a.arms.find(a => a.road.kind === "grid" && Math.abs(a.dz) > 0.9);
      D.placeOn(inArm.road, inArm.atStart ? -1 : 1, 60, L.CAR.cruise);
      const f0 = D.flags();
      let f = 0, onBlvd = false, onCoast = false, maxX = -Infinity;
      while (f < 60 * 80) {
        D.frame(0); f++;
        if (L.stPlan.road === B) onBlvd = true;
        if (onBlvd && Math.abs(st.z - C.harbourJoin.z) < 60 && st.x > C.harbourJoin.x + 40) onCoast = true;
        if (onCoast) maxX = Math.max(maxX, st.x);
        if (onCoast && st.x > 1000) break;
      }
      const d = D.delta(f0);
      const hr = L.harbor && L.harbor.road;
      return { onBlvd, onCoast, maxX: Math.round(maxX), onHarbourRoad: !!hr, secs: Math.round(f / 60), crashes: d.c, walls: d.w };
    });
    check(`city ${tag}: California's boulevard runs from downtown to the coast road, and hands-off it turns him for the harbour and the boats`,
      blvd.onBlvd && blvd.onCoast && blvd.maxX > 1000 && blvd.crashes === 0 && blvd.walls === 0, JSON.stringify(blvd));

    // ---- 8. NOTHING IN THE STREETS, measured on the geometry: every solid in
    // the world and every tree actually drawn, against every lane of every
    // street and link, with him parked in each city so its scenery has streamed
    if (vi === 0) {
      const clear = await page.evaluate(() => {
        const L = window.__lp, st = L.state, D = window.__city;
        const out = { samples: 0, solidHits: [], treeHits: [], trees: 0 };
        for (const k of ["ny", "ca"]) {
          const C = D.city(k), b = C.data.bounds;
          D.start();
          st.x = (b[0] + b[2]) / 2; st.z = (b[1] + b[3]) / 2;
          L.updateScenery(st.x, st.z, true);
          const solids = [];
          L.forEachSolid(s => solids.push(s));
          const trees = [];
          const m = new THREE.Matrix4(), T = L.trunkInst;
          for (let i = 0; i < T.count; i++) { T.getMatrixAt(i, m); trees.push([m.elements[12], m.elements[14]]); }
          out.trees += trees.length;
          for (const r of L.streets.roads) {
            if (r.city !== k || r.kind === "coast") continue;
            for (let s = 0; s <= r.len; s += 5) {
              for (const off of [-(r.halfW - 1), 0, r.halfW - 1]) {
                const q = {}; L.stPointAt(r, s, 1, off, q);
                const y = L.stSurfaceAt(q.x, q.z) ?? L.terrainEff(q.x, q.z);
                out.samples++;
                for (const o of solids) {
                  if (Math.abs(q.x - o.x) < o.hw && Math.abs(q.z - o.z) < o.hd && y + 2 > o.y0 && y + 0.5 < o.y1) {
                    if (out.solidHits.length < 8) out.solidHits.push({ road: r.kind + r.id, x: Math.round(q.x), z: Math.round(q.z), city: !!(o.mesh && o.mesh.isCityProxy) });
                  }
                }
                for (const t of trees) {
                  if (Math.abs(t[0] - q.x) < 2.5 && Math.abs(t[1] - q.z) < 2.5 && out.treeHits.length < 8) out.treeHits.push({ road: r.kind + r.id, x: Math.round(t[0]), z: Math.round(t[1]) });
                }
              }
            }
          }
        }
        return out;
      });
      check(`city: not one solid and not one drawn tree stands in any street, ramp, deck or boulevard -- ${clear.samples} lane samples against every solid in the world and ${clear.trees} tree instances`,
        clear.samples > 5000 && clear.solidHits.length === 0 && clear.treeHits.length === 0, JSON.stringify(clear));

      // ---- 9. THE TRAFFIC OBEYS THE SIGNALS: a minute of it, him parked out of
      // the way, and no car crosses a stop line while its light is red
      const obey = await page.evaluate(() => {
        const L = window.__lp, st = L.state, D = window.__city;
        const C = D.city("ny");
        D.start();
        const b = C.data.bounds;
        // parked in the square: in the city, off every street
        st.x = C.square.x; st.z = C.square.z; st.speed = 0;
        const last = new Map();
        let redCrossings = 0, stoppedAtRed = 0, crossings = 0, samples = 0;
        const worst = [];
        for (let f = 0; f < 60 * 60; f++) {
          L.api.clearStick(); L.update(1 / 60);
          for (const v of L.stTraffic.list) {
            if (!v.alive || v.spin || v.path) { last.delete(v); continue; }
            const r = v.road, node = v.dir > 0 ? r.b : r.a;
            if (!node || !node.signal) { last.delete(v); continue; }
            const cross = node.arms.reduce((m, a) => a.road === r ? m : Math.max(m, a.road.halfW), 0);
            const line = cross + L.ST.zebraGap + L.ST.zebraLen + L.ST.traffic.stopGap;
            const toGo = (v.dir > 0 ? r.len - v.s : v.s) - line;
            const asp = L.stSignalAspect(node, r);
            const was = last.get(v);
            if (was && was.road === r && was.toGo > 0 && toGo <= 0) {
              crossings++;
              if (was.asp === "red") {
                redCrossings++;
                if (worst.length < 3) worst.push({ type: v.type, sp: +v.sp.toFixed(1), was: +was.toGo.toFixed(1), yieldHim: !!L.stPlan.road,
                  police: L.police.active, next: v.next ? (v.next.road === r ? "U" : "n") : "-", res: node.res === v });
              }
            }
            if (asp === "red" && toGo > -1 && toGo < 12 && (v.sp || 0) < 0.3) stoppedAtRed++;
            last.set(v, { road: r, toGo, asp });
            samples++;
          }
        }
        return { crossings, redCrossings, stoppedAtRed, samples, signals: C.nodes.filter(n => n.signal).length, worst };
      });
      check(`city: the city's traffic stops at its reds -- ${obey.crossings} stop lines crossed in a minute at ${obey.signals} signals, none of them on a red, and cars seen waiting at one ${obey.stoppedAtRed} times`,
        obey.crossings > 10 && obey.redCrossings === 0 && obey.stoppedAtRed > 20, JSON.stringify(obey));
    }

    check(`city ${tag}: no browser or frame errors`, errors.length === 0, JSON.stringify(errors.slice(0, 5)));
    await page.close();
  }
};
