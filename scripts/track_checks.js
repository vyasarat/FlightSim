"use strict";
// ---------------------------------------------------------------------------
// THE GIANT TOY TRACK (v130), driven the way he drives it.
//
//   1. a finger held from the tower completes the run and lands in the net, and
//      the net throws him back up to the tower -- both forks the safe way;
//   2. both forks by a FULL steer held through the approach (the corkscrew and
//      the gap jump), and a steer that is not full goes the safe way;
//   3. a finger off on a loop: he rolls back, and with it down again goes on;
//   4. into a loop too slowly: he peels off, goes bang, and comes back just
//      before it -- and then makes it;
//   5. a toy car rear-ended: both bang, both come back;
//   6. the noisy finger (noisy_drive.js's hand, by touch events) for five
//      minutes on the track: never stuck, and the log is the verdict;
//   7. the frame at the triple loop (SwiftShader: calls and tris are the proxy);
//   8. no text, the props never solid, its exit crossing nothing.
// Renders -- from the seat on the drop, upside down in the loop, from the air --
// are scripts/track_renders.js, and are LOOKED at.
// ---------------------------------------------------------------------------
const { makeHand, mulberry } = require("./noisy_drive.js");

// in the page: helpers every check shares
function install() {
  const L = window.__lp, st = L.state, T = L.trk;
  L.noRender = true;
  const range = () => (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.TUNE.car.dragRangeX * innerWidth);
  window.__tk = {
    // on to the start deck by the lift, from the end of its road
    board() {
      L.api.skipScreens();
      L.api.setVehicle("car"); L.api.spawnAt(0, 0);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const p = L.tkLiftPad();
      st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0; st.exploding = false;
      L.api.clearStick();
      for (let i = 0; i < 60 * 6 && (!T.on || T.lift); i++) L.update(1 / 60);
      return T.on && !T.lift;
    },
    // a finger: down or not, and a steer as a fraction of FULL LOCK (1 = full)
    finger(down, steer) {
      if (!down) { L.api.clearStick(); return; }
      st.touching = true; st.touchIsPoint = false; st.ctrlPitch = 0;
      st.ctrlBank = (steer || 0) / range();
    },
    frame() { L.update(1 / 60); return { seg: T.seg, s: T.s, v: T.v, air: !!T.air, bang: !!T.bang, bounce: !!T.bounce, lift: !!T.lift }; },
    flags() { const f = L.flags; return { net: f.trackNet || 0, runs: f.trackRuns || 0, crashes: f.trackCrashes || 0, peels: f.trackPeels || 0,
                                        reass: f.trackReassembles || 0, gaps: f.trackGapLandings || 0, forks: { ...(f.trackForks || {}) }, hits: f.trackCarHits || 0 }; },
    at(segId, s, v) { T.seg = segId; T.s = s; T.v = v; T.air = null; T.bang = null; T.bounce = null; T.lift = null; T.on = true; },
    // the s of the first sample of a type on a segment
    sOf(segId, type, which) {
      const S = T.segs[segId].S; let n = 0;
      for (let k = 0; k < S.length; k++) if (S[k].type === type && (k === 0 || S[k - 1].type !== type)) { if (n++ === (which || 0)) return S[k].s; }
      return null;
    },
    endOf(segId, type, which) {
      const S = T.segs[segId].S; let n = 0;
      for (let k = 0; k < S.length; k++) if (S[k].type === type && (k === S.length - 1 || S[k + 1].type !== type)) { if (n++ === (which || 0)) return S[k].s; }
      return null;
    },
  };
  return true;
}

// Run a finger pattern from the deck until the net throws him back (or time).
function runFrom([steer, secs]) {
  const tk = window.__tk, L = window.__lp, T = L.trk;
  const f0 = tk.flags();
  const seen = new Set();
  let f = 0, maxV = 0;
  tk.finger(true, steer);
  for (; f < 60 * secs; f++) {
    const o = tk.frame();
    seen.add(o.seg); maxV = Math.max(maxV, o.v);
    if (tk.flags().runs > f0.runs) break;
  }
  tk.finger(false);
  const f1 = tk.flags();
  const d = k => f1[k] - f0[k];
  const forks = {};
  for (const k of Object.keys(f1.forks)) forks[k] = (f1.forks[k] || 0) - (f0.forks[k] || 0);
  return { secs: +(f / 60).toFixed(1), net: d("net"), runs: d("runs"), crashes: d("crashes"), peels: d("peels"), gaps: d("gaps"),
           forks, segs: [...seen], maxV: +maxV.toFixed(1), backOnDeck: T.seg === T.order[0].id && T.s < 1 };
}

module.exports = async function trackChecks({ newPage, check }) {
  const { page, errors } = await newPage(1024, 768);
  await page.evaluate(install);
  const boarded = await page.evaluate(() => window.__tk.board());
  check("track: from the end of its road, the lift takes the car up the back of the tower on to the start deck", boarded);

  // ---- 1. a held finger, hands-off at the forks
  const held = await page.evaluate(runFrom, [0, 150]);
  check("track: a finger held from the tower completes the run -- drop, banked turn, loop, corkscrew fork, booster, gap fork, sofa, spiral, booster, triple loop, ski-jump -- lands in the net and is thrown back up to the tower, with no bang",
    held.net === 1 && held.runs === 1 && held.crashes === 0 && held.peels === 0 && held.backOnDeck &&
    held.forks["main0:safe"] === 1 && held.forks["main1:safe"] === 1, JSON.stringify(held));

  // ---- 2. both forks by a held FULL steer; a steer short of full goes safe
  const right = await page.evaluate(runFrom, [1, 150]);
  check("track: both forks by a FULL steer held right through the approach -- the double corkscrew and the gap jump (landed), and still into the net",
    right.forks["main0:stunt"] === 1 && right.forks["main1:stunt"] === 1 && right.gaps === 1 && right.net === 1 && right.crashes === 0,
    JSON.stringify(right));
  const light = await page.evaluate(runFrom, [0.55, 150]);
  const left = await page.evaluate(runFrom, [-1, 150]);
  check("track: a steer short of full, or held left, is the safe way at both forks (the city's turn rule: only a full steer held is a choice)",
    light.forks["main0:safe"] === 1 && light.forks["main1:safe"] === 1 && left.forks["main0:safe"] === 1 && left.forks["main1:safe"] === 1 &&
    light.net === 1 && left.net === 1, JSON.stringify({ light, left }));

  // ---- 3. finger off on a loop: rolls back, and goes on when it comes down again
  const roll = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk;
    const s0 = tk.sOf("main0", "loop"), s1 = tk.endOf("main0", "loop");
    tk.at("main0", s0 + 2, 11);
    tk.finger(false);
    let back = false, maxS = 0, peel0 = tk.flags().peels;
    for (let i = 0; i < 60 * 8; i++) { const o = tk.frame(); if (o.seg === "main0") maxS = Math.max(maxS, o.s); if (o.v < -0.5) back = true; }
    const stoppedAt = +T.s.toFixed(1);
    tk.finger(true, 0);
    let through = false;
    for (let i = 0; i < 60 * 25 && !through; i++) { const o = tk.frame(); if ((o.seg === "main0" && o.s > s1 + 5) || o.seg !== "main0") through = true; }
    tk.finger(false);
    return { back, climbedTo: +(maxS - s0).toFixed(1), loopLen: +(s1 - s0).toFixed(1), stoppedAt, through, peels: tk.flags().peels - peel0, bang: !!T.bang };
  });
  check("track: a finger off on a loop -- he rolls back down it and settles; with the finger down again he goes on round",
    roll.back && roll.through && roll.peels === 0, JSON.stringify(roll));

  // ---- 4. too slow into a loop: peels off, bang, back just before it, then makes it
  const peel = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk;
    const s0 = tk.sOf("main2", "loop"), s1 = tk.endOf("main2", "loop", 2);
    const f0 = tk.flags();
    tk.at("main2", s0 + 1, 19);
    tk.finger(false);
    let fell = false, bang = false, back = null;
    for (let i = 0; i < 60 * 10; i++) {
      const o = tk.frame();
      if (o.air) fell = true;
      if (o.bang) bang = true;
      if (bang && !o.bang && back === null) { back = { seg: o.seg, s: +o.s.toFixed(1) }; break; }
    }
    const boosterS = tk.sOf("main2", "booster", 0);
    tk.finger(true, 0);
    let made = false;
    for (let i = 0; i < 60 * 30 && !made; i++) { const o = tk.frame(); if (o.seg === "main2" && o.s > s1 + 3) made = true; if (o.air && T.air.kind === "ski") made = true; }
    tk.finger(false);
    const f1 = tk.flags();
    return { fell, bang, back, loopAt: +s0.toFixed(1), boosterAt: +boosterS.toFixed(1), made, peels: f1.peels - f0.peels, crashes: f1.crashes - f0.crashes, reass: f1.reass - f0.reass };
  });
  check("track: into the triple loop too slowly he peels off, tumbles and goes bang -- and comes back just before it, at the booster that feeds it, and with the finger down makes it round",
    peel.fell && peel.bang && peel.peels >= 1 && peel.reass >= 1 && peel.back && peel.back.seg === "main2" &&
    peel.back.s <= peel.loopAt && peel.back.s >= peel.boosterAt - 3 && peel.made, JSON.stringify(peel));

  // ---- 4b. short at the gap: the other way off -- bang, and back at its booster
  const gap = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk;
    const f0 = tk.flags();
    tk.at("B_stunt:0", T.segs["B_stunt:0"].len - 8, 17);      // on the kicker, far too slow
    tk.finger(false);
    let air = false, bang = false, back = null;
    for (let i = 0; i < 60 * 8; i++) {
      const o = tk.frame();
      if (o.air) air = true;
      if (o.bang) bang = true;
      if (bang && !o.bang) { back = { seg: o.seg, s: +o.s.toFixed(1) }; break; }
    }
    const boosterS = tk.sOf("main1", "booster");
    return { air, bang, back, boosterAt: +boosterS.toFixed(1), landed: tk.flags().gaps - f0.gaps };
  });
  check("track: short of the landing at the gap he falls, goes bang and comes back at the booster that feeds the jump -- the one other way off the track",
    gap.air && gap.bang && gap.landed === 0 && gap.back && gap.back.seg === "main1" && Math.abs(gap.back.s - gap.boosterAt) < 4, JSON.stringify(gap));

  // ---- 4c. its own exit: a full steer held at the orange-loop board takes him
  // off the motorway, down its road to the lift, and up
  const exit = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, ex = T.exit;
    L.trackReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    // on the carriageway whose right the exit is on, 700 m before it
    const dir = ex.side > 0 ? 1 : -1;               // travelling +s keeps the +lat side on the right
    const s0 = ex.s * L.highway.length - dir * 700, q = L.hwySampleAt(s0);
    const lat = ex.side * (L.HW.medianW / 2 + L.HW.laneW * 1.5);
    st.x = q.x - q.fz * lat; st.z = q.z + q.fx * lat; st.y = q.y; st.heading = Math.atan2(-q.fx * dir, -q.fz * dir);
    st.speed = L.CAR.cruise; st.exploding = false;
    for (const t of L.highway.traffic) if (t.alive && Math.abs(t.s - s0) < 400) { t.alive = false; t.respawn = 3; }
    let boarded = false, f = 0;
    const c0 = L.flags.carCrashes || 0, hits = [];
    for (; f < 60 * 70 && !boarded; f++) {
      const n = L.hwyNearest(st.x, st.z), to = (ex.s * L.highway.length - n.s) * dir;
      // a full steer to the right at the mouth, until he is on its road
      const hold = to < 60 && to > -40 && !L.car.onSpurRoad;
      tk.finger(true, hold ? 1 : 0);
      const cc = L.flags.carCrashes || 0;
      L.update(1 / 60);
      if ((L.flags.carCrashes || 0) > cc) { const p = L.tkLiftPad(); hits.push({ x: Math.round(st.x), z: Math.round(st.z), toPad: Math.round(Math.hypot(st.x - p.x, st.z - p.z)), hits: JSON.stringify(L.flags.solidHits || {}).slice(-120) }); }
      if (T.on) boarded = true;
    }
    tk.finger(false);
    return { boarded, secs: +(f / 60).toFixed(1), crashes: (L.flags.carCrashes || 0) - c0, hits };
  });
  check("track: its own exit -- a full steer held at the board (an orange loop) takes him off the motorway, down its road to the foot of the lift, and up",
    exit.boarded && exit.crashes === 0, JSON.stringify(exit));

  // ---- 7. the frame at the triple loop, against a plain motorway frame
  const perf = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, r = L.renderer;
    const measure = () => {
      L.noRender = false; r.info.autoReset = false;
      const ms = []; let calls = 0, tris = 0;
      for (let i = 0; i < 24; i++) {
        r.info.reset();
        const q = window.__rafQueue.splice(0), t1 = performance.now();
        if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
        r.getContext().finish();
        ms.push(performance.now() - t1); calls = r.info.render.calls; tris = r.info.render.triangles;
      }
      L.noRender = true; r.info.autoReset = true;
      ms.sort((a, b) => a - b);
      return { ms: +ms[12].toFixed(1), calls, tris };
    };
    L.api.setView(true);
    const loopS = tk.sOf("main2", "loop");
    tk.at("main2", loopS + 20, 28);
    for (let i = 0; i < 30; i++) { T.v = 28; tk.frame(); }
    const loop = measure();
    L.trackReset(); L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 60; i++) L.update(1 / 60);
    const road = measure();
    return { loop, road };
  });
  console.log("TRACK FRAME (SwiftShader: calls/tris are the iPad proxy, ms only a bound): " + JSON.stringify(perf));
  check("track: the frame at the triple loop costs no more than a plain motorway frame and a handful of draw calls (SwiftShader proxy)",
    perf.loop.calls <= perf.road.calls + 40 && perf.loop.tris <= perf.road.tris * 1.6 + 60000, JSON.stringify(perf));

  // ---- 5. rear-ending a toy car: both bang, both come back; they never hit him
  const rear = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk, c = T.cars[0];
    const f0 = tk.flags();
    const s = tk.sOf("main1", "booster") + 30;
    c.seg = "main1"; c.s = s; c.gone = 0; c.mesh.visible = true;
    tk.at("main1", s - 40, 36);
    tk.finger(true, 0);
    let hit = false, carGone = false;
    for (let i = 0; i < 60 * 3; i++) { tk.frame(); if (tk.flags().hits > f0.hits) { hit = true; carGone = c.gone > 0; break; } }
    tk.finger(false);
    for (let i = 0; i < 60 * 6; i++) tk.frame();
    const back = !T.bang && c.gone <= 0 && c.mesh.visible;
    // and they wait behind him: him stopped, one coming up behind
    tk.at("main1", 60, 0); c.seg = "main1"; c.s = 5; c.gone = 0;
    let minGap = 1e9;
    for (let i = 0; i < 60 * 6; i++) { tk.frame(); if (c.seg === "main1") minGap = Math.min(minGap, T.s - c.s); }
    return { hit, carGone, back, crashes: tk.flags().crashes - f0.crashes, waitGap: +minGap.toFixed(1) };
  });
  check("track: rear-ending a toy car -- both go bang and both come back; and a toy car never runs into him, it waits behind",
    rear.hit && rear.carGone && rear.back && rear.crashes >= 1 && rear.waitGap > 20, JSON.stringify(rear));

  // ---- 6. the noisy finger, by touch events, five simulated minutes
  const noisy = await noisyRun(page, 300, 1);
  console.log("TRACK NOISY LOG (seed 1)\n" + noisy.log.filter(e => !["lift", "overshoot"].includes(e.type)).map(e => "  " + JSON.stringify(e)).join("\n"));
  check("track: a noisy four-year-old's finger (wobble, lifts, overshoots) for five minutes on the track -- never stuck, every fork the way the hand meant, round and into the net again and again",
    noisy.summary.stuck === 0 && noisy.summary.wrongWay === 0 && noisy.summary.runs >= 3 && noisy.summary.errors === 0, JSON.stringify(noisy.summary));

  // ---- 8. no text; props never solid; the exit crosses nothing
  const misc = await page.evaluate(() => {
    const L = window.__lp, T = L.trk;
    let propSolid = 0;
    L.forEachSolid(b => { if (!b.mesh) return; for (let p = b.mesh; p; p = p.parent) if (T.props.some(pr => pr.g === p)) { propSolid++; return; } });
    const text = [...document.querySelectorAll("body *")].filter(e => e.offsetParent !== null && e.childElementCount === 0 && /[A-Za-z]{2,}/.test(e.textContent || "")).map(e => e.textContent.trim()).slice(0, 5);
    return { propSolid, props: T.props.map(p => p.kind), crossings: L.roadCrossings(), exit: !!T.exit && T.exit.icon === "loop", text };
  });
  check("track: the sofa, the bookshelf and the lamp are scenery he weaves through and never solid; its exit (an orange loop on the board) crosses nothing; no text anywhere",
    misc.propSolid === 0 && misc.props.length === 3 && misc.crossings.length === 0 && misc.exit && misc.text.length === 0, JSON.stringify(misc));

  // ---- 9. it never passes through itself: every part clear of every other,
  // wall to wall, except where the pieces of a fork meet
  const self = await page.evaluate(() => {
    const L = window.__lp, T = L.trk, need = L.TK.width + 2 * L.TK.wallT + 0.5;
    const joins = [];
    for (const p of T.order) joins.push(p.S[0], p.S[p.S.length - 1]);
    const atJoin = q => joins.some(j => Math.hypot(q.x - j.x, q.y - j.y, q.z - j.z) < 50);
    const pts = [];
    for (const p of T.order) for (let k = 0; k < p.S.length; k += 4) pts.push({ seg: p.id, q: p.S[k] });
    let min = 1e9, worst = null;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const A = pts[i], B = pts[j];
      if (A.seg === B.seg && Math.abs(A.q.s - B.q.s) < 40) continue;
      if (atJoin(A.q) && atJoin(B.q)) continue;
      const d = Math.hypot(A.q.x - B.q.x, A.q.y - B.q.y, A.q.z - B.q.z);
      if (d < min) { min = d; worst = A.seg + "@" + Math.round(A.q.s) + " / " + B.seg + "@" + Math.round(B.q.s); }
    }
    let ground = 1e9;
    for (const p of T.order) for (const q of p.S) if (q.ny > 0.5) ground = Math.min(ground, q.y - L.TK.deckT - Math.max(L.terrainEff(q.x, q.z), L.TUNE.waterLevel));
    return { min: +min.toFixed(1), need: +need.toFixed(1), worst, groundClear: +ground.toFixed(1) };
  });
  check("track: it never passes through itself (every part clear of every other, wall to wall) and never dips into the sand",
    self.min >= self.need && self.groundClear > 0.5, JSON.stringify(self));

  check("track: no browser or frame errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
  await page.context().close();
};

// The noisy hand on the track. What it MEANS: keep the finger down; at each
// fork, one time in two, hold a full steer (a random side) through the
// approach. Stuck is: finger down, on the rail, and no ground covered for
// `stuckSecs`. The log is the verdict.
async function noisyRun(page, seconds, seed, real) {
  await page.evaluate(install);
  const cdp = await page.context().newCDPSession(page);
  const geo = await page.evaluate(() => {
    window.__tk.board();
    const L = window.__lp;
    return { width: innerWidth, height: innerHeight, dragPx: L.TUNE.car.dragRangeX * innerWidth, dragYPx: L.TUNE.dragRangeY * Math.min(innerWidth, innerHeight) };
  });
  const rand = mulberry(seed), log = [], t0 = Date.now();
  let simT = 0;
  const L = (type, info) => log.push({ real: +((Date.now() - t0) / 1000).toFixed(2), sim: +simT.toFixed(2), type, ...info });
  const hand = makeHand(rand, geo);
  const send = e => e.type === "touchEnd" ? cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    : cdp.send("Input.dispatchTouchEvent", { type: e.type, touchPoints: [{ x: Math.round(e.x), y: Math.round(e.y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  const S = { stuck: 0, lastProgT: 0, prog: 0, lastKey: null, forkN: {}, runs0: 0, errors: 0, meaning: {} };
  L("start", { seed, seconds, where: "the start deck" });
  const f0 = await page.evaluate(() => window.__tk.flags());
  Object.assign(S.forkN, f0.forks);
  for (let f = 0; f < seconds * 60; f++) {
    if (real) { const due = t0 + f * 1000 / 60, now = Date.now(); if (due > now) await new Promise(r => setTimeout(r, due - now)); }
    simT = f / 60;
    for (const e of hand.frame(simT, L)) await send(e);
    const o = await page.evaluate(() => {
      const L = window.__lp, T = L.trk, seg = T.segs[T.seg];
      L.update(1 / 60);
      const toFork = seg.fork ? seg.len - T.s : null;
      return { seg: T.seg, s: T.s, v: T.v, air: !!T.air, bang: !!T.bang, bounce: !!T.bounce, lift: !!T.lift, on: T.on,
               toFork, approach: seg.fork ? seg.fork.approach : 0, forks: { ...(L.flags.trackForks || {}) }, fe: L.frameErrors || 0 };
    });
    if (o.fe) S.errors = o.fe;
    // what the hand means: at a fork's approach, sometimes a full hold
    if (o.toFork !== null && o.toFork < o.approach + 40 && S.meaning[o.seg] === undefined) {
      const side = rand() < 0.5 ? 0 : (rand() < 0.5 ? 1 : -1);
      S.meaning[o.seg] = side; hand.intent = side;
      L("fork ahead", { fork: o.seg, means: side === 1 ? "hold right (stunt)" : side === -1 ? "hold left (safe)" : "straight (safe)" });
    }
    // a fork just taken: its counter ticked this frame
    for (const [k, n] of Object.entries(o.forks)) {
      if ((S.forkN[k] || 0) === n) continue;
      S.forkN[k] = n;
      const [fork, way] = k.split(":");
      const meant = S.meaning[fork] === 1 ? "stunt" : "safe";
      L("fork", { fork, meant, took: way, verdict: meant === way ? "ok" : "WRONG WAY" });
      if (meant !== way) S.wrong = (S.wrong || 0) + 1;
      delete S.meaning[fork];
      if (hand.intent !== 0) hand.release(simT, L);
    }
    // progress: ground covered on the rail, or a scripted moment (lift, flight, bang, net)
    const key = o.seg + ":" + Math.floor(o.s / 5);
    if (o.air || o.bang || o.bounce || o.lift || key !== S.lastKey) { S.lastProgT = simT; S.lastKey = key; }
    if (simT - S.lastProgT > 20 && hand.down) { S.stuck++; L("STUCK", { seg: o.seg, s: +o.s.toFixed(1), v: +o.v.toFixed(2) }); S.lastProgT = simT; }
    if (o.bounce && !S.inNet) { S.inNet = true; L("net", {}); S.meaning = {}; } else if (!o.bounce) S.inNet = false;
    if (o.bang && !S.inBang) { S.inBang = true; L("bang", { seg: o.seg, s: +o.s.toFixed(1) }); } else if (!o.bang) S.inBang = false;
  }
  await send({ type: "touchEnd" });
  const f1 = await page.evaluate(() => window.__tk.flags());
  const summary = { seconds, seed, runs: f1.runs - f0.runs, crashes: f1.crashes - f0.crashes, peels: f1.peels - f0.peels,
                    gaps: f1.gaps - f0.gaps, stuck: S.stuck, wrongWay: S.wrong || 0, errors: S.errors };
  L("end", summary);
  return { log, summary };
}
module.exports.noisyRun = noisyRun;
module.exports.install = install;

// node scripts/track_checks.js noisy [seconds=300] [seed=1] [root] [--real]
if (require.main === module && process.argv[2] === "noisy") {
  (async () => {
    const path = require("path"), fs = require("fs");
    const { launch, openGame, serve } = require("./art_rig.js");
    const [, , , secs, seed, rootArg] = process.argv;
    const real = process.argv.includes("--real");
    const root = path.resolve(rootArg && !rootArg.startsWith("--") ? rootArg : path.join(__dirname, ".."));
    const port = +(process.env.PORT || 8197), srv = serve(root, port), browser = await launch();
    const page = await openGame(browser, port, { width: 820, height: 1180 });
    const res = await noisyRun(page, +(secs || 300), +(seed || 1), real);
    for (const e of res.log) if (!["lift", "overshoot"].includes(e.type) || process.env.ALL) console.log(JSON.stringify(e));
    console.log("SUMMARY " + JSON.stringify(res.summary));
    const out = path.resolve(__dirname, "..", "evidence", "track");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `noisy-seed${seed || 1}.json`), JSON.stringify(res, null, 1));
    await browser.close(); srv.close();
  })();
}
