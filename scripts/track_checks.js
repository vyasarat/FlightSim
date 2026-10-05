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
function runFrom([steer, secs, deckSteer]) {
  const tk = window.__tk, L = window.__lp, T = L.trk;
  const f0 = tk.flags();
  const seen = new Set();
  let f = 0, maxV = 0;
  for (; f < 60 * secs; f++) {
    // the deck's own fork is the way off: its steer is `deckSteer` (hands-off
    // by default), the rest of the run's is `steer`
    tk.finger(true, T.seg === "deck" ? (deckSteer || 0) : steer);
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
           forks, segs: [...seen], maxV: +maxV.toFixed(1), backOnDeck: T.seg === T.order[0].id && T.s < 1, on: T.on };
}

module.exports = async function trackChecks({ newPage, check }) {
  const { page, errors } = await newPage(1024, 768);
  await page.evaluate(install);
  const boarded = await page.evaluate(() => window.__tk.board());
  check("track: from the end of its road, the lift takes the car up the back of the tower on to the start deck", boarded);

  // ---- 1. a held finger, hands-off at the forks
  const held = await page.evaluate(runFrom, [0, 150]);
  check("track: a finger held from the tower completes the run -- drop, banked turn, loop, corkscrew fork, booster, gap fork, sofa, spiral, the two three-way forks straight on, triple loop, ski-jump -- lands in the net and is thrown back up to the tower, with no bang",
    held.net === 1 && held.runs === 1 && held.crashes === 0 && held.peels === 0 && held.backOnDeck &&
    held.forks["deck:safe"] === 1 && held.forks["main0:safe"] === 1 && held.forks["main1:safe"] === 1 &&
    held.forks["main2:safe"] === 1 && held.forks["main3:safe"] === 1, JSON.stringify(held));

  // ---- 2. both forks by a held FULL steer; a steer short of full goes safe
  const right = await page.evaluate(runFrom, [1, 150]);
  check("track: every fork by a FULL steer held right through the approach -- the double corkscrew and all three jumps (each landed), and still into the net",
    right.forks["main0:stunt"] === 1 && right.forks["main1:stunt"] === 1 && right.forks["main2:stunt"] === 1 && right.forks["main3:stunt"] === 1 &&
    right.gaps === 3 && right.net === 1 && right.crashes === 0, JSON.stringify(right));
  const light = await page.evaluate(runFrom, [0.55, 150]);
  const left = await page.evaluate(runFrom, [-1, 150]);
  check("track: a steer short of full is straight on at every fork, and a held left is the safe way at the two-way forks (the city's turn rule: only a full steer held is a choice)",
    ["main0", "main1", "main2", "main3"].every(k => light.forks[k + ":safe"] === 1) && left.forks["main0:safe"] === 1 && left.forks["main1:safe"] === 1 &&
    light.net === 1 && left.net === 1, JSON.stringify({ light, left }));
  check("track: at the three-way forks a FULL steer held LEFT is the loop each time -- the loop by the lamp and the tall loop -- round them with no fall, and into the net",
    left.forks["main2:left"] === 1 && left.forks["main3:left"] === 1 && left.peels === 0 && left.crashes === 0 && left.net === 1, JSON.stringify(left));

  // ---- 2b. THE WAY OFF: the exit lane off the start deck. A full steer held
  // right through the deck takes it, down beside the tower and on to the road
  // back; hands-off, a light steer or a held left stays on the track.
  const stay = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk, out = {};
    for (const [k, st] of [["handsOff", 0], ["light", 0.55], ["left", -1]]) {
      tk.at("deck", 0, 0);
      const f0 = (L.flags.trackForks || {})["deck:safe"] || 0;
      for (let i = 0; i < 60 * 6 && T.seg === "deck"; i++) { tk.finger(true, st); tk.frame(); }
      tk.finger(false);
      out[k] = { stayed: T.on && T.seg === "main0", counted: ((L.flags.trackForks || {})["deck:safe"] || 0) - f0 };
    }
    return out;
  });
  check("track: hands-off, a light steer or a held left goes past the exit lane and on round the track",
    stay.handsOff.stayed && stay.light.stayed && stay.left.stayed, JSON.stringify(stay));
  const off = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, back = T.back;
    tk.at("deck", 0, 0);
    const c0 = L.flags.carCrashes || 0, l0 = L.flags.trackLeaves || 0;
    let tookLane = false, left = false, merged = false, f = 0, onBack = false, bang = null;
    const h0 = { ...(L.flags.solidHits || {}) }, t0 = L.flags.hwyTrafficHit || 0;
    for (; f < 60 * 90 && !merged; f++) {
      // a full steer right through the deck, then hands-off
      tk.finger(true, T.on && T.seg === "deck" ? 1 : 0);
      L.update(1 / 60);
      if (T.on && T.seg === "exit") tookLane = true;
      // what it was, if anything went bang: for the log, never for the verdict
      if (!bang && (L.flags.carCrashes || 0) > c0) {
        const h = L.flags.solidHits || {}, d = {};
        for (const k in h) if (h[k] !== (h0[k] || 0)) d[k] = h[k] - (h0[k] || 0);
        bang = { t: +(f / 60).toFixed(1), x: Math.round(st.x), z: Math.round(st.z), y: Math.round(st.y), v: Math.round(st.speed), onTrack: !!T.on, seg: T.seg,
                 solid: d, traffic: (L.flags.hwyTrafficHit || 0) - t0, spur: !!L.car.spurRec };
      }
      if (!T.on && (L.flags.trackLeaves || 0) > l0) left = true;
      if (left && L.car.spurRec === back) onBack = true;
      const n = L.hwyNearest(st.x, st.z);
      if (left && Math.abs(n.lateral) < L.highway.halfW - 2 && Math.sign(n.lateral) === T.exit.side &&
          Math.abs(L.wrapPi(st.heading - Math.atan2(-n.fx * (T.exit.side > 0 ? 1 : -1), -n.fz * (T.exit.side > 0 ? 1 : -1)))) < 0.6) merged = true;
    }
    tk.finger(false);
    const gantry = !!T.gantry && T.gantry.children.length >= 4;
    return { tookLane, left, onBack, merged, secs: +(f / 60).toFixed(1), crashes: (L.flags.carCrashes || 0) - c0, gantry, bang,
             forks: { exit: (L.flags.trackForks || {})["deck:stunt"] || 0 } };
  });
  check("track: a full steer held right through the start deck takes the exit lane under its gantry (the motorway's icon), down beside the tower, and the road back merges him on to the motorway going the way he came -- no bang",
    off.tookLane && off.left && off.onBack && off.merged && off.crashes === 0 && off.gantry, JSON.stringify(off));
  // ---- 2b. THE MERGE, over many traffic layouts. The exit-lane run above
  // touched a traffic car at the merge in some full runs and not others: where
  // the traffic stands then is not fixed by the seed alone. Swept over layouts
  // (scripts/merge_sweep.js), the LIVE build (v132) banged in 4 of 60 -- layouts
  // 7, 23, 29 and 40. The cause: `car.merging` said he was joining the +1
  // carriageway (the track's road back writes no `lat`, and `lat || 1` is +1),
  // while he was joining the -1, so the traffic in the lane he joined never saw
  // him. This runs those four and eight more, each with the traffic laid out
  // afresh from its own seed, and the page's own random stream put back after.
  const sweep = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk;
    const R = Math.random, res = [];
    try {
      for (const r of [7, 23, 29, 40, 0, 1, 2, 3, 4, 5, 6, 8]) {
        tk.board();
        tk.at("deck", 0, 0);
        let seed = (0x9E3779B1 * (r + 1)) >>> 0;
        Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (const t of L.highway.traffic) { t.alive = false; t.respawn = 0; }
        const c0 = L.flags.carCrashes || 0, h0 = L.flags.hwyTrafficHit || 0, l0 = L.flags.trackLeaves || 0;
        let left = false, merged = false, side = 0, joined = 0;
        for (let f = 0; f < 60 * 60 && !merged; f++) {
          tk.finger(true, T.on && T.seg === "deck" ? 1 : 0);
          L.update(1 / 60);
          if (!T.on && (L.flags.trackLeaves || 0) > l0) left = true;
          if (L.car.merging) side = L.car.merging;
          const n = L.hwyNearest(st.x, st.z);
          if (left && Math.abs(n.lateral) < L.highway.halfW - 2 && Math.sign(n.lateral) === T.exit.side) { merged = true; joined = Math.sign(n.lateral); }
        }
        for (let i = 0; i < 60 * 5; i++) { tk.finger(false); L.update(1 / 60); }
        res.push({ r, merged, side, joined, bangs: (L.flags.carCrashes || 0) - c0, touches: (L.flags.hwyTrafficHit || 0) - h0 });
      }
    } finally { Math.random = R; tk.finger(false); }
    return res;
  });
  check(`track: off the toy track and on to the motorway over 12 traffic layouts (the 4 that banged on v132 among them): the side he is told he is merging into is the side he joins, and no bang, no touch, in any`,
    sweep.length === 12 && sweep.every(x => x.merged && x.side === x.joined && x.bangs === 0 && x.touches === 0), JSON.stringify(sweep));
  // and back on: board again for what follows
  await page.evaluate(() => window.__tk.board());

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
    const s0 = tk.sOf("main4", "loop"), s1 = tk.endOf("main4", "loop", 2);
    const f0 = tk.flags();
    tk.at("main4", s0 + 1, 19);
    tk.finger(false);
    let fell = false, bang = false, back = null;
    for (let i = 0; i < 60 * 10; i++) {
      const o = tk.frame();
      if (o.air) fell = true;
      if (o.bang) bang = true;
      if (bang && !o.bang && back === null) { back = { seg: o.seg, s: +o.s.toFixed(1) }; break; }
    }
    const boosterS = tk.sOf("main4", "booster", 0);
    tk.finger(true, 0);
    let made = false;
    for (let i = 0; i < 60 * 30 && !made; i++) { const o = tk.frame(); if (o.seg === "main4" && o.s > s1 + 3) made = true; if (o.air && T.air.kind === "ski") made = true; }
    tk.finger(false);
    const f1 = tk.flags();
    return { fell, bang, back, loopAt: +s0.toFixed(1), boosterAt: +boosterS.toFixed(1), made, peels: f1.peels - f0.peels, crashes: f1.crashes - f0.crashes, reass: f1.reass - f0.reass };
  });
  check("track: into the triple loop too slowly he peels off, tumbles and goes bang -- and comes back just before it, at the booster that feeds it, and with the finger down makes it round",
    peel.fell && peel.bang && peel.peels >= 1 && peel.reass >= 1 && peel.back && peel.back.seg === "main4" &&
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

  // ---- 4b'. the two new jumps (v140): too slow off each kicker he falls, goes
  // bang and comes back at the booster just before it -- with the speed to go again
  const short2 = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk, out = {};
    for (const id of ["C_jump:0", "D_jump:0"]) {
      const f0 = tk.flags();
      tk.at(id, T.segs[id].len - 10, 14);
      tk.finger(false);
      let air = false, bang = false, back = null;
      for (let i = 0; i < 60 * 8; i++) {
        const o = tk.frame();
        if (o.air) air = true;
        if (o.bang) bang = true;
        if (bang && !o.bang) { back = { seg: o.seg, s: +o.s.toFixed(1) }; break; }
      }
      out[id] = { air, bang, back, boosterAt: +tk.sOf(id, "booster").toFixed(1), landed: tk.flags().gaps - f0.gaps };
      // and from that booster, finger down, he makes it
      tk.finger(true, 0);
      let made = false;
      for (let i = 0; i < 60 * 12 && !made; i++) { tk.frame(); if (tk.flags().gaps > f0.gaps) made = true; }
      tk.finger(false);
      out[id].thenMade = made;
    }
    return out;
  });
  check("track: short of the landing at the middle and the big jump he falls, goes bang and comes back at the booster that feeds each -- and from there, finger down, he lands it",
    Object.values(short2).every(r => r.air && r.bang && r.landed === 0 && r.back && Math.abs(r.back.s - r.boosterAt) < 4 && r.thenMade) &&
    short2["C_jump:0"].back.seg === "C_jump:0" && short2["D_jump:0"].back.seg === "D_jump:0", JSON.stringify(short2));

  // ---- 4b''. the speed steps (v140): the car's own pair, in its own slot, on the
  // track -- and at every step, every way, the whole run with no bang
  const steps = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, out = { ways: {} };
    const vis = id => !document.getElementById(id).classList.contains("hidden");
    tk.at("deck", 0, 0); tk.frame();
    out.pair = vis("slowBtn") && vis("fastBtn") && L.BUTTONS.slowBtn.slot === "topRight3" && L.BUTTONS.fastBtn.slot === "topRight2";
    const n = L.spdStepsFor("car").length;
    for (let k = 0; k < n; k++) for (const steer of [0, 1, -1]) {
      st.speedStep = k;
      tk.at("deck", 0, 0);
      const f0 = tk.flags(), r0 = f0.runs;
      let f = 0;
      for (; f < 60 * 200; f++) { tk.finger(true, T.seg === "deck" ? 0 : steer); tk.frame(); if (tk.flags().runs > r0) break; }
      tk.finger(false);
      const f1 = tk.flags();
      out.ways[k + (steer > 0 ? "R" : steer < 0 ? "L" : "0")] = { secs: +(f / 60).toFixed(1), net: f1.net - f0.net, crashes: f1.crashes - f0.crashes, peels: f1.peels - f0.peels, gaps: f1.gaps - f0.gaps };
    }
    st.speedStep = L.spdStepsFor("car").indexOf(1);
    return out;
  });
  const sw = steps.ways, ks = Object.keys(sw);
  check("track: the speed steps are the car's own pair in its own slot on the track, and they change the ride -- the top step's lap at least a quarter quicker than the bottom's",
    steps.pair && sw["0" + "0"].secs >= sw[(ks.length / 3 - 1) + "0"].secs * 1.33, JSON.stringify({ pair: steps.pair, slow: sw["00"], fast: sw[(ks.length / 3 - 1) + "0"] }));
  check("track: at EVERY speed step, hands-off, held right and held left, the whole run into the net with no bang and no fall (every jump landed: the kickers cap his speed)",
    ks.every(k => sw[k].net === 1 && sw[k].crashes === 0 && sw[k].peels === 0 && sw[k].gaps === (k.endsWith("R") ? 3 : 0)), JSON.stringify(sw));

  // ---- 4b'''. the forks he can see coming: a sign over the stem before every
  // fork that goes somewhere, the ride that way drawn on it; and every branch
  // comes back exactly on the line it left
  const signs = await page.evaluate(() => {
    const L = window.__lp, T = L.trk, TK = L.TK, out = { signs: [], merges: [] };
    // which ride each way really is, from the table
    const rideOf = id => { const t = TK.segments.find(d => d.id === id).sections.map(s => s.type); return t.includes("gap") ? "jump" : t.includes("corkscrew") ? "spring" : t.includes("loop") ? "loop" : null; };
    for (const sg of T.signs) {
      const seg = T.segs[sg.seg], q = L.tkAt(seg, sg.s);
      const lx = q.ny * q.tz - q.nz * q.ty, lz = q.nx * q.ty - q.ny * q.tx;     // his left, as the track's frame has it
      sg.g.updateMatrixWorld(true);
      const sides = sg.panels.map(p => {
        const w = new THREE.Vector3(); p.mesh.getWorldPosition(w);
        const lat = (w.x - q.x) * lx + (w.z - q.z) * lz;             // + = on his left
        const want = rideOf(p.side < 0 ? seg.def.fork.left : seg.def.fork.stunt);
        return { side: p.side, onHisLeft: lat > 0, ride: p.ride, want };
      });
      out.signs.push({ seg: sg.seg, before: +(seg.len - sg.s).toFixed(0), approach: seg.fork.approach, three: !!seg.fork.left, sides });
    }
    for (const def of TK.segments) if (def.merge) {
      const e = T.order.filter(p => p.def === def).slice(-1)[0].S.slice(-1)[0];
      const safeId = TK.segments.find(d => d.id === def.merge).from;
      const se = T.order.filter(p => p.def.id === safeId).slice(-1)[0].S.slice(-1)[0];
      out.merges.push({ id: def.id, off: +Math.hypot(e.x - se.x, e.y - se.y, e.z - se.z).toFixed(2), dot: +(e.tx * se.tx + e.ty * se.ty + e.tz * se.tz).toFixed(4) });
    }
    return out;
  });
  check("track: a sign over the track before every fork that goes somewhere (four), well before its approach, and both three-way forks signed",
    signs.signs.length === 4 && signs.signs.every(s => s.before >= s.approach + 10) && signs.signs.filter(s => s.three).length === 2, JSON.stringify(signs.signs));
  check("track: every sign shows each ride on the side it is on -- the left panel on his left with the left way's ride, the right with the right's",
    signs.signs.every(s => s.sides.every(p => p.onHisLeft === (p.side < 0) && p.ride === p.want)), JSON.stringify(signs.signs.map(s => s.sides)));

  // ---- a branch rejoining right behind a toy car, at speed, finger down: the
  // car is nudged on ahead -- a held finger never bangs (v140)
  const rejoin = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk, out = {};
    for (const [br, safe] of [["C_jump:1", "C_safe"], ["D_loop", "D_safe"], ["C_loop", "C_safe"]]) {
      const c = T.cars[0], f0 = tk.flags(), n0 = L.flags.trackCarNudges || 0;
      // both a metre from the merge, him half a metre behind it and much faster:
      // they come out on to the line together (v139's code banged him here)
      c.seg = safe; c.s = T.segs[safe].len - 1; c.gone = 0; c.mesh.visible = true;
      tk.at(br, T.segs[br].len - 1.5, 44);
      let f = 0;
      for (; f < 60 * 3; f++) { tk.finger(true, 0); tk.frame(); }
      tk.finger(false);
      out[br] = { crashes: tk.flags().crashes - f0.crashes, nudges: (L.flags.trackCarNudges || 0) - n0, carAhead: c.seg === T.seg ? +(c.s - T.s).toFixed(1) : c.seg };
    }
    return out;
  });
  check("track: a branch rejoining right behind a toy car at speed, finger down -- never a bang (it is nudged on ahead, or outruns him)",
    Object.values(rejoin).every(r => r.crashes === 0 && r.nudges > 0), JSON.stringify(rejoin));
  check("track: every branch rejoins exactly where the straight-on way does, running the same way",
    signs.merges.length === 10 && signs.merges.every(m => m.off < 0.1 && m.dot > 0.998), JSON.stringify(signs.merges));

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
    const loopS = tk.sOf("main4", "loop");
    tk.at("main4", loopS + 20, 28);
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

  // ---- 5. a toy car he closes on gets out of his way (v140: the motorway's
  // promise -- fast is his, a held finger never bangs), at the top step too;
  // and they never run into him from behind, they wait
  const rear = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, c = T.cars[0];
    const f0 = tk.flags();
    const s = tk.sOf("main1", "booster") + 30;
    c.seg = "main1"; c.s = s; c.gone = 0; c.mesh.visible = true;
    const k0 = st.speedStep; st.speedStep = L.spdStepsFor("car").length - 1;
    tk.at("main1", s - 40, 36);
    tk.finger(true, 0);
    let hit = false, minAhead = 1e9;
    for (let i = 0; i < 60 * 6; i++) { tk.frame(); if (tk.flags().hits > f0.hits) hit = true; if (c.seg === T.seg) minAhead = Math.min(minAhead, c.s - T.s); }
    tk.finger(false); st.speedStep = k0;
    const carGone = c.gone > 0, back = c.mesh.visible;
    // and they wait behind him: him stopped, one coming up behind
    tk.at("main1", 60, 0); c.seg = "main1"; c.s = 5; c.gone = 0;
    let minGap = 1e9;
    for (let i = 0; i < 60 * 6; i++) { tk.frame(); if (c.seg === "main1") minGap = Math.min(minGap, T.s - c.s); }
    return { hit, carGone, minAhead: +minAhead.toFixed(1), back, crashes: tk.flags().crashes - f0.crashes, waitGap: +minGap.toFixed(1) };
  });
  check("track: a toy car he closes on at the top step outruns him -- no bang, it stays ahead; and a toy car never runs into him, it waits behind",
    !rear.carGone && rear.minAhead > 7.5 && rear.crashes === 0 && rear.waitGap > 20, JSON.stringify(rear));

  // ---- 6. the noisy finger, by touch events, five simulated minutes
  const noisy = await noisyRun(page, 300, 1);
  console.log("TRACK NOISY LOG (seed 1)\n" + noisy.log.filter(e => !["lift", "overshoot"].includes(e.type)).map(e => "  " + JSON.stringify(e)).join("\n"));
  check("track: a noisy four-year-old's finger (wobble, lifts, overshoots) for five minutes on the track -- never stuck, every fork the way the hand meant, round and into the net again and again",
    noisy.summary.stuck === 0 && noisy.summary.wrongWay === 0 && noisy.summary.leftUnasked === 0 && noisy.summary.runs >= 3 && noisy.summary.errors === 0, JSON.stringify(noisy.summary));
  // and the way off, by the same hand: it decides part-way round a lap
  const leave = await noisyRun(page, 240, 7, false, 37);
  console.log("TRACK NOISY LEAVE LOG (seed 7)\n" + leave.log.filter(e => !["lift", "overshoot"].includes(e.type)).map(e => "  " + JSON.stringify(e)).join("\n"));
  check("track: the noisy finger can leave -- deciding part-way round a lap, it holds toward the exit lane at the next start deck and is off the track within one lap, the right way",
    leave.summary.leftWithinOneLap && leave.summary.wrongWay === 0 && leave.summary.stuck === 0, JSON.stringify(leave.summary));

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

  // ---- the speed pair on the track in PORTRAIT, the way he holds the iPad
  {
    const { page: pp } = await newPage(768, 1024);
    await pp.evaluate(install);
    const pr = await pp.evaluate(() => {
      const tk = window.__tk, L = window.__lp; tk.board(); tk.frame();
      const vis = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return !e.classList.contains("hidden") && r.width > 20 && r.right <= innerWidth && r.bottom <= innerHeight; };
      return { on: L.trk.on, slow: vis("slowBtn"), fast: vis("fastBtn"), clashes: L.btnSlotClashes().length };
    });
    check("track: in portrait too, the speed pair is on screen while he is on the track, and nothing shares its slots", pr.on && pr.slow && pr.fast && pr.clashes === 0, JSON.stringify(pr));
    await pp.close();
  }
  await page.context().close();
};

// The noisy hand on the track. What it MEANS: keep the finger down; at each
// fork, one time in two, hold a full steer (a random side) through the
// approach. Stuck is: finger down, on the rail, and no ground covered for
// `stuckSecs`. The log is the verdict.
// `leaveAfter`: at that many seconds the hand decides it wants off, and from
// then on means a full steer right at the start deck. It must be off the track
// at the first deck it comes to: within one lap of deciding.
async function noisyRun(page, seconds, seed, real, leaveAfter) {
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
      const left = {}; for (const p of T.order) if (p.fork) left[p.id] = !!p.fork.left;
      return { left, seg: T.seg, s: T.s, v: T.v, air: !!T.air, bang: !!T.bang, bounce: !!T.bounce, lift: !!T.lift, on: T.on,
               toFork, approach: seg.fork ? seg.fork.approach : 0, forks: { ...(L.flags.trackForks || {}) }, fe: L.frameErrors || 0 };
    });
    if (o.fe) S.errors = o.fe;
    // what the hand means: at a fork's approach, sometimes a full hold
    if (leaveAfter !== undefined && simT >= leaveAfter && S.decided === undefined) {
      S.decided = simT; S.deckPasses = 0;
      L("decides to leave", { at: o.seg + "@" + Math.round(o.s) });
    }
    if (o.seg === "deck" && S.lastSeg !== "deck" && S.decided !== undefined) S.deckPasses++;
    S.lastSeg = o.seg;
    // flying back to the tower in the net's throw, or riding the lift: the start
    // deck is what is coming, and he holds for it now if he means to
    const toDeck = (o.bounce || o.lift) && S.meaning.deck === undefined;
    const fseg = toDeck ? "deck" : o.seg, toFork = toDeck ? 0 : o.toFork, appr = toDeck ? 0 : o.approach;
    if (toFork !== null && toFork < appr + 40 && S.meaning[fseg] === undefined) {
      // at the deck the fork is the way off: he holds toward it only once he
      // wants to leave; otherwise he means to stay (straight on, or a left)
      const side = fseg === "deck" ? (S.decided !== undefined ? 1 : (rand() < 0.5 ? 0 : -1))
                                    : rand() < 0.5 ? 0 : (rand() < 0.5 ? 1 : -1);
      S.meaning[fseg] = side; hand.intent = side; S.intentFor = fseg;
      L("fork ahead", { fork: fseg, means: side === 1 ? (fseg === "deck" ? "hold right (the way off)" : "hold right (stunt)") : side === -1 ? (o.left && o.left[fseg] ? "hold left (the loop)" : "hold left (safe)") : "straight (safe)" });
    }
    if (S.decided !== undefined && !o.on) {
      S.left = simT;
      L("left the track", { secsAfterDeciding: +(simT - S.decided).toFixed(1), deckPasses: S.deckPasses });
      break;
    }
    // a fork just taken: its counter ticked this frame
    for (const [k, n] of Object.entries(o.forks)) {
      if ((S.forkN[k] || 0) === n) continue;
      S.forkN[k] = n;
      const [fork, way] = k.split(":");
      const meant = S.meaning[fork] === 1 ? "stunt" : (S.meaning[fork] === -1 && o.left[fork]) ? "left" : "safe";
      L("fork", { fork, meant, took: way, verdict: meant === way ? "ok" : "WRONG WAY" });
      if (meant !== way) S.wrong = (S.wrong || 0) + 1;
      delete S.meaning[fork];
      // let go of THIS fork's hold -- not one already taken up for the next
      if (S.intentFor === fork && hand.intent !== 0) hand.release(simT, L);
      if (S.intentFor === fork) S.intentFor = null;
    }
    if (!o.on && S.decided === undefined && !S.leftUnasked) { S.leftUnasked = 1; L("LEFT THE TRACK UNASKED", { at: simT }); }
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
  if (leaveAfter !== undefined) Object.assign(summary, { decidedAt: S.decided, leftAt: S.left === undefined ? null : +S.left.toFixed(1),
    leftWithinOneLap: S.left !== undefined && S.deckPasses <= 1, deckPasses: S.deckPasses });
  if (leaveAfter === undefined) summary.leftUnasked = S.leftUnasked || 0;
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
    const lv = process.argv.find(a => a.startsWith("--leave="));
    const root = path.resolve(rootArg && !rootArg.startsWith("--") ? rootArg : path.join(__dirname, ".."));
    const port = +(process.env.PORT || 8197), srv = serve(root, port), browser = await launch();
    const page = await openGame(browser, port, { width: 820, height: 1180 });
    const res = await noisyRun(page, +(secs || 300), +(seed || 1), real, lv ? +lv.slice(8) : undefined);
    for (const e of res.log) if (!["lift", "overshoot"].includes(e.type) || process.env.ALL) console.log(JSON.stringify(e));
    console.log("SUMMARY " + JSON.stringify(res.summary));
    const out = path.resolve(__dirname, "..", "evidence", "track");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `noisy-seed${seed || 1}.json`), JSON.stringify(res, null, 1));
    await browser.close(); srv.close();
  })();
}
