"use strict";
// THE NOISY DRIVE: a four-year-old's hand, through New York, in real time.
//
// One finger on the glass, portrait, from the driving seat, driven through the
// browser's own touch input (CDP Input.dispatchTouchEvent -> the page's pointer
// handlers -> input.js) at 60 Hz against the wall clock, for five real minutes.
// The hand is noisy on purpose:
//   - every drag wobbles by up to +-15% of the car's drag range (a tremor of a
//     few hertz, on both axes);
//   - every 12-30 s the finger comes off the glass for 300 ms and goes back
//     down wherever it lands, then finds its drag again;
//   - after a turn or the way in, half the time it stays down 1-3.5 s;
//   - every 8-20 s it overshoots: for a second it swings 35-45% of the range
//     PAST where it meant to be (held full, further out; meaning straight,
//     either way) -- and letting go of a turn, half the time it swings past the
//     middle the other way.
// What it MEANS to do: straight on down the motorway, take New York's way in
// by holding right at the gantry, then in the city hold a FULL turn at five
// junctions (alternating sides where it can), and otherwise just drive -- the
// finger down and meaning straight -- until the way out takes it back to the
// motorway. After that, straight on until the five minutes are up.
//
// Every event is logged with the real clock and the game clock: every junction
// passed, what the hand meant and what the car did; every lift and overshoot;
// the way in and the way out; every bang, touch of traffic, wall, and every
// time he leaves the road. The verdict is the log: an unintended turn, a
// missed turn, a bang.
//
//   [NOISY_VEH=cybertruck] node scripts/noisy_drive.js [seconds=300] [seed=1] [root]
// or, from the harness: require("./noisy_drive")({ newPage, check }).
const fs = require("fs"), path = require("path");

const FPS = 60;

// a seeded stream for the hand, never the game's
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// In the page, once: the probe the driver reads each frame, and one frame.
function install() {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  window.__nd = {
    setup(where) {
      L.api.skipScreens(); L.api.setVehicle(window.__ndVeh || "car"); L.api.spawnAt(0, 0);   // NOISY_VEH=cybertruck (v146) drives it in the Cybertruck
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      L.spdReset(); L.api.setView(false);
      const rec = L.streets.cities.ny.ramps.inFar, g = rec.gantry, c = g.c;
      const s0 = g.s - c * where;
      const q = L.hwySampleAt(s0), lat = c * (L.HW.medianW / 2 + L.HW.laneW * 0.5);
      st.x = q.x - q.fz * lat; st.z = q.z + q.fx * lat; st.y = q.y; st.heading = Math.atan2(-q.fx * c, -q.fz * c);
      st.speed = L.CAR.cruise; st.exploding = false;
      L.car.yield = 1; L.car.steer = 0; L.car.onSpurRoad = false; L.car.spurRec = null; L.stPlan.road = null; L.stPlan.turn = null;
      // he is not dropped into traffic: nothing within a few hundred metres to start
      for (const t of L.highway.traffic) if (t.alive && Math.abs(t.s - s0) < 300) { t.alive = false; t.respawn = 3; }
      window.__nd.prev = null;
      return { width: innerWidth, height: innerHeight, dragPx: L.CAR.dragRangeX * innerWidth,
               dragYPx: L.TUNE.dragRangeY * Math.min(innerWidth, innerHeight), gantryS: g.s, c, fullSteer: L.CAR.fullSteer };
    },
    // one frame, and what the driver can see: where he is, the junction ahead
    // and its streets, his road, and the counters
    step() {
      L.update(1 / 60);
      if (st.exploding) { st.explodeTimer = 0; L.update(1 / 60); }
      const P = L.stPlan, R = L.streets.cities.ny.ramps, road = P.road;
      const n = L.hwyNearest(st.x, st.z);
      const out = {
        x: st.x, z: st.z, v: st.speed, h: st.heading, bank: st.ctrlBank, touching: st.touching,
        onStreet: !!L.car.onStreet, offRoad: L.car.offRoad, spur: L.car.spurRec ? L.car.spurRec.to : null,
        road: road ? road.id : null, kind: road ? road.kind : null, city: road ? road.city : null,
        hwyLat: n.lateral, hwyS: n.s, hwyDir: Math.sign(-Math.sin(st.heading) * n.fx + -Math.cos(st.heading) * n.fz),
        crashes: L.flags.carCrashes || 0, walls: L.flags.wallHits || 0,
        ct: L.flags.cityTrafficHit || 0, ht: L.flags.hwyTrafficHit || 0, reds: L.flags.redsRun || 0,
        onLine: !!P.onLine, holding: !!(L.car.road && L.car.road.holding), plan: P.turn ? (P.turn.held ? "held" : P.turn.forced ? "forced" : "straight") : null,
        steerIn: +(L.car.dbgSteer || 0).toFixed(2), cap: L.car.road && L.car.road.cap < 999 ? +L.car.road.cap.toFixed(1) : null,
      };
      // the junction ahead, as a four-year-old sees it: how far, and whether
      // there is a street to the left and to the right
      if (road && P.turn && P.turn.node && L.car.onStreet) {
        const node = P.turn.node, dir = P.dir;
        const p = L.stProject(road, st.x, st.z), toGo = dir > 0 ? road.len - p.s : p.s;
        const inArm = L.stArrivalArm(node, road, dir);
        const ch = inArm ? L.stChoices(node, inArm).filter(c => c.arm.road.kind === "grid") : [];
        out.jn = { id: node.id, toGo, left: ch.some(c => c.ang < -45 * Math.PI / 180 && c.ang > -135 * Math.PI / 180),
                   right: ch.some(c => c.ang > 45 * Math.PI / 180 && c.ang < 135 * Math.PI / 180),
                   straight: !!L.stStraight(ch), plan: P.turn.held ? "held" : P.turn.forced ? "forced" : "straight",
                   leadsOut: P.turn.arm.road === R.out };
      }
      // a junction passed: the road changed across a node -- which way did he go?
      if (window.__nd.prev && road && window.__nd.prev.road && road !== window.__nd.prev.road) {
        const a = window.__nd.prev, ax = a.hx, az = a.hz;
        const q = {}; L.stPointAt(road, P.dir > 0 ? 0 : road.len, P.dir, 0, q);
        // the planner's own measure (stArmAngle): + is a turn to his right
        const ang = Math.atan2(-q.fx * az + q.fz * ax, ax * q.fx + az * q.fz);
        out.passed = { from: a.road.id, to: road.id, fromKind: a.road.kind, toKind: road.kind, ang: +(ang * 180 / Math.PI).toFixed(0),
                       wasPlan: a.plan, node: a.node };
      }
      if (road) {
        const q = {}; L.stPointAt(road, P.dir > 0 ? road.len : 0, P.dir, 0, q);
        window.__nd.prev = { road, hx: q.fx, hz: q.fz, plan: P.turn ? (P.turn.held ? "held" : P.turn.forced ? "forced" : "straight") : null,
                             node: P.turn && P.turn.node ? P.turn.node.id : null };
      } else window.__nd.prev = null;
      out.dbg = P.dbg ? { ...P.dbg, node: P.turn && P.turn.node ? P.turn.node.id : null, yld: +(L.car.yield || 0).toFixed(2), hold: L.car.lastHeld } : null;
      out.lastTouch = L.stTraffic.lastTouch || null;
      // the nearest city car, for the log when something is hit
      let nv = null, nd = 25;
      for (const v of L.stTraffic.list) { if (!v.alive) continue; const d = Math.hypot(v.wx - st.x, v.wz - st.z); if (d < nd) { nd = d; nv = v; } }
      if (nv) {
        const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading), dx = nv.wx - st.x, dz = nv.wz - st.z;
        out.nearCar = { d: +nd.toFixed(1), ahead: +(dx * fx + dz * fz).toFixed(1), side: +(dx * -fz + dz * fx).toFixed(1), sp: +(nv.sp || 0).toFixed(1),
                        sameWay: +(nv.hx * fx + nv.hz * fz).toFixed(2), road: nv.road && nv.road.id, turning: !!nv.path, type: nv.type };
      }
      return out;
    },
  };
}

// The hand. `intent` is -1, 0 or +1 (left, straight, right) and it is what the
// finger MEANS; the drag it makes is that, plus the wobble, the overshoot and
// the lifts.
function makeHand(rand, geo) {
  const H = { down: false, ox: 0, oy: 0, x: 0, y: 0, intent: 0, target: 0, cur: 0, liftUntil: -1,
              overUntil: -1, overAmt: 0, nextLift: 12 + rand() * 18, nextOver: 8 + rand() * 12,
              ph: [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28], f: [1.6 + rand() * 1.8, 2.7 + rand() * 1.5, 1.2 + rand() * 1.4, 3.1 + rand() * 1.2],
              reacquire: 0 };
  const base = { x: geo.width * 0.42, y: geo.height * 0.40 };
  // what the hand does this frame; returns the touch events to send
  H.frame = (t, log) => {
    const ev = [];
    // a lift: off the glass for 300 ms, then down again somewhere near where it was
    if (t >= H.nextLift && H.liftUntil < 0 && H.down) {
      H.liftUntil = t + 0.3; H.nextLift = t + 12 + rand() * 18;
      ev.push({ type: "touchEnd" }); H.down = false;
      log("lift", { ms: 300, meant: H.intent });
    }
    if (H.liftUntil >= 0 && t >= H.liftUntil) {
      H.liftUntil = -1;
      H.ox = base.x + (rand() - 0.5) * 40; H.oy = base.y + (rand() - 0.5) * 40;
      H.cur = 0; H.reacquire = t;                                   // it finds its drag again from here
      ev.push({ type: "touchStart", x: H.ox, y: H.oy }); H.down = true;
    }
    if (!H.down && H.liftUntil < 0) {                               // the first touch
      H.ox = base.x; H.oy = base.y; ev.push({ type: "touchStart", x: H.ox, y: H.oy }); H.down = true; H.cur = 0;
    }
    if (!H.down) return ev;
    // an overshoot: for a second it swings well past where it meant to be
    if (t >= H.nextOver && H.overUntil < 0) {
      H.overUntil = t + 1; H.nextOver = t + 8 + rand() * 12;
      // PAST where it means to be: held full, that is further out; meaning
      // straight, either way
      H.overAmt = (H.intent !== 0 ? H.intent : (rand() < 0.5 ? -1 : 1)) * (0.35 + rand() * 0.10);
      H.overFor = H.intent;
      log("overshoot", { by: +H.overAmt.toFixed(2), meant: H.intent });
    }
    if (H.overUntil >= 0 && t >= H.overUntil) H.overUntil = -1;
    // it is PAST where the hand means to be: when the hand means somewhere else,
    // that overshoot is over (one begun meaning straight pulled a new hold short)
    if (H.overUntil >= 0 && H.overFor !== H.intent) H.overUntil = -1;
    // the drag it is going for, reached over ~150 ms the way a hand moves
    H.target = H.intent;
    const k = Math.min(1, (1 / FPS) / 0.15);
    H.cur += (H.target - H.cur) * k;
    const over = H.overUntil >= 0 ? H.overAmt : 0;
    const wob = 0.15 * (0.6 * Math.sin(t * H.f[0] * 6.283 + H.ph[0]) + 0.4 * Math.sin(t * H.f[1] * 6.283 + H.ph[1]));
    const wobY = 0.15 * (0.6 * Math.sin(t * H.f[2] * 6.283 + H.ph[2]) + 0.4 * Math.sin(t * H.f[3] * 6.283 + H.ph[3]));
    const dx = (H.cur + over + wob) * geo.dragPx, dy = wobY * geo.dragYPx;
    ev.push({ type: "touchMove", x: H.ox + dx, y: H.oy + dy });
    H.lastDrag = (H.cur + over + wob);
    return ev;
  };
  // letting go of a turn: half the time it swings past the middle the other way
  H.release = (t, log) => {
    const was = H.intent; H.intent = 0;
    if (rand() < 0.5) { H.overUntil = t + 1; H.overAmt = -was * (0.35 + rand() * 0.10); H.overFor = 0; log("overshoot", { by: +H.overAmt.toFixed(2), meant: 0, onRelease: true }); }
  };
  return H;
}

async function drive(page, { seconds = 300, seed = 1, onLog } = {}) {
  await page.evaluate((v) => { window.__ndVeh = v; }, process.env.NOISY_VEH || "car");
  await page.evaluate(install);
  const cdp = await page.context().newCDPSession(page);
  const geo = await page.evaluate(() => window.__nd.setup(800));
  const rand = mulberry(seed);
  // how long the finger stays down after a turn is done: its own stream, so a
  // seed drives the same streets it always did. Half the time it lets go at
  // once; half the time it stays down 1-3.5 s -- a turn done is spent (v128),
  // and the held finger must keep him on the new road, not steer him off it.
  const keepRand = mulberry(seed ^ 0x5eed);
  const keepFor = () => keepRand() < 0.5 ? 0 : 1 + keepRand() * 2.5;
  const log = [];
  let t = 0, simT = 0;
  const t0 = Date.now();
  const L = (type, info) => { const e = { real: +((Date.now() - t0) / 1000).toFixed(2), sim: +simT.toFixed(2), type, ...info }; log.push(e); if (onLog) onLog(e); };
  const hand = makeHand(rand, geo);
  const S = { phase: "motorway", turnsWanted: 5, turnsDone: 0, turn: null, lastTurnNode: null, sinceTurn: 99, prev: null,
              junctions: [], offRoad: false, lastSide: 1, late: 0, reachedOut: false };
  const send = async (e) => {
    if (e.type === "touchEnd") return cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return cdp.send("Input.dispatchTouchEvent", { type: e.type, touchPoints: [{ x: Math.round(e.x), y: Math.round(e.y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  };
  L("start", { seed, seconds, where: "motorway, 800 m before New York's far gantry, inner lane" });
  const frames = seconds * FPS;
  for (let f = 0; f < frames; f++) {
    // real-clock pacing: frame f is due at t0 + f/60 s
    const due = t0 + (f * 1000) / FPS, now = Date.now();
    if (due > now) await new Promise(r => setTimeout(r, due - now));
    else if (now - due > 50) S.late++;
    t = f / FPS; simT = t;
    for (const e of hand.frame(t, L)) await send(e);
    const o = await page.evaluate(() => window.__nd.step());
    // ---- what the hand means next
    if (S.phase === "motorway") {
      const along = (o.hwyS - geo.gantryS) * geo.c;
      if (along > -260 && hand.intent === 0 && !o.spur) { hand.intent = 1; L("hold", { side: "right", why: "New York's way in: the gantry", gantryIn: Math.round(-along) }); }
      if (o.spur === "nyCityInFar" && o.onStreet === false && hand.intent === 1 && S.inRampSince === undefined) S.inRampSince = t;
      if (S.inRampSince !== undefined && S.rampKeep === undefined) { S.rampKeep = keepFor(); if (S.rampKeep) L("keeps holding", { for: +S.rampKeep.toFixed(1), after: "the ramp" }); }
      if (S.inRampSince !== undefined && t > S.inRampSince + 1.2 + S.rampKeep && hand.intent === 1) { hand.release(t, L); L("let go", { why: "on the ramp" }); }
      if (o.onStreet && o.city === "ny") { S.phase = "city"; L("way in", { took: "nyCityInFar", road: o.road }); }
      if (along > 400 && !o.spur && !o.onStreet && S.phase === "motorway") { L("missed the way in", {}); S.phase = "after"; }
    } else if (S.phase === "city") {
      // a junction passed: what did he mean, what did the car do?
      if (o.passed && (o.passed.fromKind === "grid" || o.passed.toKind === "grid")) {
        const a = o.passed.ang, did = Math.abs(a) < 30 ? "straight" : Math.abs(a) > 150 ? "u-turn" : a > 0 ? "right" : "left";
        const meant = S.turn && S.turn.node === o.passed.node ? S.turn.side : "straight";
        const forced = o.passed.wasPlan === "forced";
        let verdict = "ok";
        if (meant === "straight" && did !== "straight") verdict = forced ? "ok (the road ended: taken round)" : "UNINTENDED TURN";
        // "clearly held": the finger itself at full (the rule's 70%) for most of
        // the approach -- its wobble and overshoots are real, and a hold the
        // hand MEANT but never reached is straight on, as the rule says
        const heldShare = meant !== "straight" && S.turn.appr ? +((S.turn.full || 0) / S.turn.appr).toFixed(2) : null;
        if (meant !== "straight" && did !== meant) verdict = heldShare >= 0.8 ? "MISSED TURN" : "not held full (" + Math.round(heldShare * 100) + "% of the approach): straight on, as the rule says";
        S.junctions.push({ meant, did, verdict });
        L("junction", { node: o.passed.node, meant, did, angle: a, plan: o.passed.wasPlan, verdict, ...(heldShare !== null ? { heldFull: heldShare } : {}) });
        if (S.turn && S.turn.node === o.passed.node) {
          if (did === meant) S.turnsDone++;
          S.lastTurnNode = o.passed.node;
          S.turn.done = t;
        }
        S.sinceTurn++;
      }
      // how much of the approach the finger was really at full (lifts under
      // the grace count as held: the rule does too)
      if (S.turn && S.turn.done === undefined && hand.intent !== 0 && o.jn && o.jn.id === S.turn.node && o.jn.toGo > 10) {
        S.turn.appr = (S.turn.appr || 0) + 1;
        if (!hand.down || (hand.lastDrag || 0) * hand.intent >= geo.fullSteer) S.turn.full = (S.turn.full || 0) + 1;
      }
      // letting go once the turn is done and he is lined up with the new street
      if (S.turn && S.turn.done !== undefined && S.turn.keep === undefined) { S.turn.keep = keepFor(); if (S.turn.keep) L("keeps holding", { for: +S.turn.keep.toFixed(1), after: "the turn" }); }
      // (a finger kept down after a turn is no choice of the next junction; with
      // turns still to make and that junction leading out, it lets go in time)
      const leaving = S.turnsDone < S.turnsWanted && o.jn && o.jn.leadsOut && S.turn && o.jn.id !== S.turn.node && o.jn.toGo < 90;
      if (S.turn && S.turn.done !== undefined && hand.intent !== 0 && (t > S.turn.done + S.turn.lateBy + S.turn.keep || leaving)) {
        hand.release(t, L); L("let go", { why: "turned" }); S.turn = null; S.sinceTurn = 0;
      }
      // a held finger that has run out of junction (the turn was not possible)
      if (S.turn && S.turn.done === undefined && o.jn && o.jn.id !== S.turn.node && hand.intent !== 0) {
        hand.release(t, L); L("let go", { why: "passed that junction" }); S.turn = null;
      }
      // choose the next turn: a street that way, a block since the last one
      // (which junctions it turns at is up to the hand: a seed-dependent coin at
      // each one it could, so different seeds drive different streets)
      if (o.jn && o.jn.id !== S.coinFor) { S.coinFor = o.jn.id; S.coin = rand() < 0.55; }
      // ... but with turns still to make it does not drive out of the city
      if (o.jn && o.jn.leadsOut && S.turnsDone < S.turnsWanted) S.coin = true;
      if (!S.turn && S.coin && S.turnsDone < S.turnsWanted && o.jn && o.jn.id !== S.lastTurnNode && o.jn.toGo < 130 && o.jn.toGo > 45) {
        const want = rand() < 0.5 ? "left" : "right", other = want === "left" ? "right" : "left";
        const side = o.jn[want] ? want : o.jn[other] ? other : null;
        if (side) {
          // it starts holding somewhere in the block, not at a fixed mark
          S.turn = { node: o.jn.id, side, startAt: 30 + rand() * Math.min(80, o.jn.toGo - 30), lateBy: rand() * 0.4 };
          S.lastSide = side === "right" ? 1 : -1;
        }
      }
      if (S.turn && hand.intent === 0 && S.turn.done === undefined && o.jn && o.jn.id === S.turn.node && o.jn.toGo < S.turn.startAt) {
        hand.intent = S.turn.side === "right" ? 1 : -1;
        L("hold", { side: S.turn.side, why: `turn ${S.turnsDone + 1} of ${S.turnsWanted}`, junctionIn: Math.round(o.jn.toGo) });
      }
      if (o.spur === "nyCityOut" || (!o.onStreet && S.turnsDone >= S.turnsWanted && o.kind === null && Math.abs(o.hwyLat) < 22 && o.spur === null)) {
        if (!S.reachedOut && o.spur === "nyCityOut") { S.reachedOut = true; L("way out", { after: `${S.turnsDone} turns` }); S.phase = "after"; }
      }
    } else if (S.phase === "after") {
      if (o.spur === null && !o.onStreet && Math.abs(o.hwyLat) < 20 && !S.merged && S.reachedOut) {
        S.merged = true; L("merged", { lat: Math.round(o.hwyLat), travelling: o.hwyDir > 0 ? "+s" : "-s", rightSide: Math.sign(o.hwyLat) === o.hwyDir });
      }
    }
    // ---- what happened to him
    if (S.prev) {
      if (o.crashes > S.prev.crashes) L("BANG", { x: Math.round(S.prev.x), z: Math.round(S.prev.z), v: Math.round(S.prev.v), road: S.prev.kind, onStreet: S.prev.onStreet,
        wall: o.walls > S.prev.walls, cityTraffic: o.ct > S.prev.ct, motorwayTraffic: o.ht > S.prev.ht, meant: hand.intent,
        drag: +(hand.lastDrag || 0).toFixed(2), bank: +(S.prev.bank || 0).toFixed(2), plan: S.prev.plan, onLine: S.prev.onLine, nearCar: S.prev.nearCar, myRoad: S.prev.road, holding: S.prev.holding, junctionIn: S.prev.jn ? Math.round(S.prev.jn.toGo) : null });
      else {
        if (o.ct > S.prev.ct) L("TOUCH", { what: o.lastTouch && o.lastTouch.parked ? "a parked car" : "city traffic", touched: o.lastTouch, v: Math.round(o.v), x: Math.round(o.x), z: Math.round(o.z), plan: S.prev.plan, nearCar: S.prev.nearCar, myRoad: S.prev.road, junctionIn: S.prev.jn ? Math.round(S.prev.jn.toGo) : null });
        if (o.ht > S.prev.ht) L("TOUCH", { what: "motorway traffic", v: Math.round(o.v) });
        if (o.walls > S.prev.walls) L("TOUCH", { what: "a wall, at a crawl", v: Math.round(o.v) });
      }
      if (o.reds > S.prev.reds) L("red run", {});
      const off = o.offRoad > 0.6;
      if (off && !S.offRoad) L("off the road", { x: Math.round(o.x), z: Math.round(o.z), v: Math.round(o.v), meant: hand.intent });
      if (!off && S.offRoad) L("back on the road", {});
      S.offRoad = off;
    }
    S.prev = o;
    S.ring = S.ring || []; S.ring.push({ t: +t.toFixed(2), x: Math.round(o.x), z: Math.round(o.z), v: +(o.v || 0).toFixed(1), plan: o.plan, dbg: o.dbg, bank: +(o.bank || 0).toFixed(2), road: o.road, nearCar: o.nearCar });
    if (S.ring.length > 360) S.ring.shift();
    const lastLog = log[log.length - 1];
    if (lastLog && lastLog !== S.dumpedFor && (lastLog.type === "BANG" || lastLog.type === "TOUCH" || lastLog.verdict === "MISSED TURN" || lastLog.verdict === "UNINTENDED TURN")) {
      S.dumpedFor = lastLog; lastLog.frames = S.ring.filter((r, i) => i % 6 === 0 || i > S.ring.length - 8);
    }
  }
  const wall = (Date.now() - t0) / 1000;
  L("end", { realSeconds: +wall.toFixed(1), simSeconds: seconds, lateFrames: S.late });
  await cdp.detach().catch(() => {});
  const count = (ty) => log.filter(e => e.type === ty).length;
  const J = S.junctions;
  const summary = {
    seed, realSeconds: +wall.toFixed(1), simSeconds: seconds, lateFrames: S.late,
    wayIn: log.some(e => e.type === "way in"), wayOut: S.reachedOut, merged: !!S.merged,
    junctions: J.length, turnsMeant: J.filter(j => j.meant !== "straight").length, turnsMade: S.turnsDone,
    unintended: J.filter(j => j.verdict === "UNINTENDED TURN").length, missed: J.filter(j => j.verdict === "MISSED TURN").length,
    notHeldFull: J.filter(j => j.verdict.startsWith("not held full")).length,
    bangs: count("BANG"), touches: count("TOUCH"), offRoad: count("off the road"), lifts: count("lift"), overshoots: count("overshoot"),
  };
  return { summary, log };
}

// ---- the harness check ----------------------------------------------------
async function harness({ newPage, check }) {
  const { page, errors } = await newPage(820, 1180);
  const { summary, log } = await drive(page, { seconds: 300, seed: 1 });
  const out = path.resolve(__dirname, "..", "evidence", "noisy");
  try { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "harness-seed1.json"), JSON.stringify({ summary, log }, null, 1)); } catch (e) {}
  const ok = summary.wayIn && summary.wayOut && summary.unintended === 0 && summary.missed === 0 && summary.bangs === 0 &&
             summary.turnsMade >= 5 && summary.touches === 0 && summary.offRoad === 0 && errors.length === 0;
  const tail = log.filter(e => !["lift", "overshoot"].includes(e.type)).map(e => `${e.real}s ${e.type}${e.verdict ? " " + e.meant + "->" + e.did + " " + e.verdict : ""}${e.why ? " (" + e.why + ")" : ""}`).join("; ");
  check(`noisy drive: five real minutes of a four-year-old's hand through New York (touch events at 60 Hz, portrait, driving seat, +-15% wobble, ${summary.lifts} lifts, ${summary.overshoots} overshoots) -- way in, ${summary.turnsMade}/5 held turns made, ${summary.junctions} junctions, ${summary.unintended} unintended turns, ${summary.missed} missed, ${summary.bangs} bangs, ${summary.touches} touches, ${summary.offRoad} times off the road, way out`,
    ok, JSON.stringify(summary) + " || " + tail.slice(0, 2500));
  await page.context().close();
}

module.exports = harness;
module.exports.drive = drive;
module.exports.makeHand = makeHand;      // the track drives the same hand (track_checks.js)
module.exports.mulberry = mulberry;

if (require.main === module) {
  (async () => {
    const [secs, seed, rootArg] = process.argv.slice(2);
    const { launch, openGame, serve } = require("./art_rig.js");
    const root = path.resolve(rootArg || path.join(__dirname, ".."));
    const port = +(process.env.PORT || 8199), srv = serve(root, port), browser = await launch();
    const errors = [];
    const page = await openGame(browser, port, { width: 820, height: 1180, errors });
    const res = await drive(page, { seconds: +(secs || 300), seed: +(seed || 1),
      onLog: e => { if (!["lift", "overshoot"].includes(e.type) || process.env.ALL) console.log(JSON.stringify(e)); } });
    console.log("SUMMARY " + JSON.stringify(res.summary));
    if (errors.length) console.log("ERRORS", errors.slice(0, 5));
    const out = path.resolve(__dirname, "..", "evidence", "noisy");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `seed${seed || 1}.json`), JSON.stringify(res, null, 1));
    await browser.close(); srv.close();
  })();
}
