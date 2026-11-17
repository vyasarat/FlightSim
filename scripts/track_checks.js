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

// (v233) his speed arriving at each section of the track on v232 -- before the giant loop was laid --
// lap by lap, from the deck with a held finger, at every speed step, hands-off (0), held right (R) and
// held left (L), as the steps run below measures it now (V233_ARRIVALS=1 prints the table it measured)
// (v233) how long he sees both panels of each fork's sign whole, in one go, before passing under it, on v232
// (seconds; track_checks' sight check measures it the same way; V233_SIGHT=1 prints the table it measured)
const V232_SIGHT = {
  "820x1180": {
    "chase:0": {"main0":0,"main1":4.3,"main2":3.85,"main3":2.75},
    "chase:1": {"main0":0,"main1":3.78,"main2":3.38,"main3":2.73},
    "chase:2": {"main0":0.08,"main1":3.15,"main2":3.03,"main3":2.5},
    "chase:3": {"main0":0.2,"main1":2.38,"main2":2.48,"main3":2.2},
    "chase:4": {"main0":0.18,"main1":1.88,"main2":2.03,"main3":2.75},
    "seat:0": {"main0":0,"main1":3.65,"main2":3.62,"main3":2.3},
    "seat:1": {"main0":0,"main1":3.2,"main2":3.07,"main3":2.25},
    "seat:2": {"main0":0,"main1":2.65,"main2":2.68,"main3":2.05},
    "seat:3": {"main0":0,"main1":1.98,"main2":2.18,"main3":1.77},
    "seat:4": {"main0":0,"main1":1.58,"main2":1.78,"main3":1.5},
  },
  "1180x820": {
    "chase:0": {"main0":0.68,"main1":4.98,"main2":4.73,"main3":2.75},
    "chase:1": {"main0":0.65,"main1":4.4,"main2":4.03,"main3":2.73},
    "chase:2": {"main0":0.55,"main1":3.67,"main2":3.55,"main3":2.5},
    "chase:3": {"main0":0.45,"main1":2.77,"main2":2.83,"main3":2.2},
    "chase:4": {"main0":0.37,"main1":2.2,"main2":2.32,"main3":2.75},
    "seat:0": {"main0":0,"main1":4.28,"main2":4.43,"main3":2.3},
    "seat:1": {"main0":0,"main1":3.78,"main2":3.68,"main3":2.25},
    "seat:2": {"main0":0,"main1":3.12,"main2":3.17,"main3":2.05},
    "seat:3": {"main0":0,"main1":2.33,"main2":2.52,"main3":1.77},
    "seat:4": {"main0":0,"main1":1.87,"main2":2.05,"main3":1.5},
  },
};
const V232_ARRIVALS = {
  "10": {"main0|loop#0":34.16,"A:in":29.38,"main1|booster#0":21.13,"B:in":37.58,"main2|hump#0":28.08,"main2|spiral#0":25.36,"main2|booster#0":18.67,"C:in":32.07,"main3|drop#0":23.6,"D:in":33.95,"main4|loop#0":38.7,"main4|loop#2":31.87,"main4|ski#0":28.57,"ski:lip":23.79},
  "20": {"main0|loop#0":37.49,"A:in":32.54,"main1|booster#0":25.98,"B:in":43.05,"main2|hump#0":32.54,"main2|spiral#0":29.6,"main2|booster#0":22.97,"C:in":34.37,"main3|drop#0":27.04,"D:in":38.31,"main4|loop#0":43.72,"main4|loop#2":35.92,"main4|ski#0":32.36,"ski:lip":26.56},
  "30": {"main0|loop#0":43.47,"A:in":39.26,"main1|booster#0":35.17,"B:in":48.51,"main2|hump#0":38.12,"main2|spiral#0":37.22,"main2|booster#0":32.4,"C:in":39.66,"main3|drop#0":35.66,"D:in":43.42,"main4|loop#0":49.21,"main4|loop#2":41.41,"main4|ski#0":39,"ski:lip":29.15},
  "40": {"main0|loop#0":49.94,"A:in":47.7,"main1|booster#0":44.82,"B:in":55.29,"main2|hump#0":47.07,"main2|spiral#0":46.43,"main2|booster#0":42.37,"C:in":48.46,"main3|drop#0":45.34,"D:in":50.8,"main4|loop#0":56.22,"main4|loop#2":49.86,"main4|ski#0":48.06,"ski:lip":30.41},
  "00": {"main0|loop#0":33.23,"A:in":28.43,"main1|booster#0":17.42,"B:in":37.35,"main2|hump#0":27.88,"main2|spiral#0":24.39,"main2|booster#0":14.14,"C:in":30.32,"main3|drop#0":22.14,"D:in":33.84,"main4|loop#0":38.72,"main4|loop#2":31.9,"main4|ski#0":28.41,"ski:lip":23.68},
  "0R": {"main0|loop#0":33.23,"A:in":28.43,"A_stunt|corkscrew#0":26.96,"main1|booster#0":17.01,"B:in":37.39,"B_stunt|kicker#0":35.56,"main2|hump#0":28.37,"main2|spiral#0":24.83,"main2|booster#0":14.16,"C:in":30.35,"C_jump|kicker#0":39.31,"main3|drop#0":27.39,"D:in":33.66,"D_jump|kicker#0":39.43,"main4|loop#0":38.54,"main4|loop#2":31.74,"main4|ski#0":28.28,"ski:lip":23.48},
  "0L": {"main0|loop#0":33.23,"A:in":28.43,"main1|booster#0":17.42,"B:in":37.35,"main2|hump#0":27.88,"main2|spiral#0":24.39,"main2|booster#0":14.14,"C:in":30.32,"C_loop|loop#0":38.22,"main3|drop#0":30.56,"D:in":33.85,"D_loop|loop#0":39.48,"main4|loop#0":38.63,"main4|loop#2":31.81,"main4|ski#0":28.33,"ski:lip":23.6},
  "1R": {"main0|loop#0":34.16,"A:in":29.38,"A_stunt|corkscrew#0":27.87,"main1|booster#0":21.09,"B:in":37.54,"B_stunt|kicker#0":35.68,"main2|hump#0":28.54,"main2|spiral#0":25.6,"main2|booster#0":18.69,"C:in":32.09,"C_jump|kicker#0":39.25,"main3|drop#0":27.34,"D:in":33.63,"D_jump|kicker#0":39.44,"main4|loop#0":38.5,"main4|loop#2":31.71,"main4|ski#0":28.47,"ski:lip":23.73},
  "1L": {"main0|loop#0":34.16,"A:in":29.38,"main1|booster#0":21.13,"B:in":37.58,"main2|hump#0":28.08,"main2|spiral#0":25.36,"main2|booster#0":18.67,"C:in":32.07,"C_loop|loop#0":39.34,"main3|drop#0":31.49,"D:in":33.71,"D_loop|loop#0":39.33,"main4|loop#0":38.55,"main4|loop#2":31.74,"main4|ski#0":28.48,"ski:lip":23.76},
  "2R": {"main0|loop#0":37.49,"A:in":32.54,"A_stunt|corkscrew#0":30.95,"main1|booster#0":26,"B:in":43.07,"B_stunt|kicker#0":41,"main2|hump#0":32.55,"main2|spiral#0":29.61,"main2|booster#0":22.98,"C:in":34.37,"C_jump|kicker#0":43.13,"main3|drop#0":28.4,"D:in":39.04,"D_jump|kicker#0":46.27,"main4|loop#0":43.66,"main4|loop#2":35.86,"main4|ski#0":32.32,"ski:lip":26.54},
  "2L": {"main0|loop#0":37.49,"A:in":32.54,"main1|booster#0":25.98,"B:in":43.05,"main2|hump#0":32.54,"main2|spiral#0":29.6,"main2|booster#0":22.97,"C:in":34.37,"C_loop|loop#0":40.57,"main3|drop#0":32.49,"D:in":39.77,"D_loop|loop#0":44.53,"main4|loop#0":45.32,"main4|loop#2":37.23,"main4|ski#0":33.32,"ski:lip":26.56},
  "3R": {"main0|loop#0":43.47,"A:in":39.26,"A_stunt|corkscrew#0":38.13,"main1|booster#0":35.2,"B:in":48.53,"B_stunt|kicker#0":46.32,"main2|hump#0":35.66,"main2|spiral#0":36.24,"main2|booster#0":32.22,"C:in":39.82,"C_jump|kicker#0":47.66,"main3|drop#0":32.97,"D:in":42.62,"D_jump|kicker#0":51.05,"main4|loop#0":47.77,"main4|loop#2":40.8,"main4|ski#0":38.7,"ski:lip":28.89},
  "3L": {"main0|loop#0":43.47,"A:in":39.26,"main1|booster#0":35.17,"B:in":48.51,"main2|hump#0":38.12,"main2|spiral#0":37.22,"main2|booster#0":32.4,"C:in":39.66,"C_loop|loop#0":46.08,"main3|drop#0":38.52,"D:in":44.43,"D_loop|loop#0":48.61,"main4|loop#0":51.02,"main4|loop#2":42.4,"main4|ski#0":39.48,"ski:lip":29.12},
  "4R": {"main0|loop#0":49.94,"A:in":47.7,"A_stunt|corkscrew#0":46.96,"main1|booster#0":44.85,"B:in":55.31,"B_stunt|kicker#0":53.09,"main2|hump#0":40.8,"main2|spiral#0":43.69,"main2|booster#0":41.75,"C:in":48.4,"C_jump|kicker#0":54.65,"main3|drop#0":37.47,"D:in":49.13,"D_jump|kicker#0":56.9,"main4|loop#0":52.66,"main4|loop#2":48.7,"main4|ski#0":47.46,"ski:lip":30.4},
  "4L": {"main0|loop#0":49.94,"A:in":47.7,"main1|booster#0":44.82,"B:in":55.29,"main2|hump#0":47.07,"main2|spiral#0":46.43,"main2|booster#0":42.37,"C:in":48.46,"C_loop|loop#0":53.98,"main3|drop#0":47.91,"D:in":51.44,"D_loop|loop#0":56.02,"main4|loop#0":57.7,"main4|loop#2":50.42,"main4|ski#0":48.33,"ski:lip":30.54},
};

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
    // (v233) on to the start deck in this car (the SUV, the Cybertruck or the Corvette: every car that can board)
    boardAs(veh) {
      L.trackReset(); L.api.setVehicle(veh); L.api.spawnAt(0, 0);
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const p = L.tkLiftPad();
      st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0; st.exploding = false;
      L.api.clearStick();
      for (let i = 0; i < 60 * 6 && (!T.on || T.lift); i++) L.update(1 / 60);
      return T.on && !T.lift && L.vehKind() === veh;
    },
    // (v233) the giant loop, read off the table and the laid track: where it starts and ends on its
    // segment, the start of the run of rollers that feeds it, its radius and its step sideways; null
    // if there is none (v232)
    giant() {
      const def = L.TK.segments.find(d => d.sections.some(x => x.type === "loop" && x.color));
      if (!def) return null;
      const si = def.sections.findIndex(x => x.type === "loop" && x.color), sec = def.sections[si], S = T.segs[def.id].S;
      const ks = S.filter(q => q.sec === si);
      let k = S.indexOf(ks[0]) - 1;
      while (k > 0 && S[k - 1].type === "booster") k--;
      const e = ks[0];
      return { seg: def.id, si, R: sec.radius, off: sec.offset, color: sec.color, s0: ks[0].s, s1: ks[ks.length - 1].s, feed: S[k].type === "booster" ? S[k].s : null,
               entry: { x: e.x, y: e.y, z: e.z, tx: e.tx, ty: e.ty, tz: e.tz, lx: e.ny * e.tz - e.nz * e.ty, lz: e.nx * e.ty - e.ny * e.tx } };
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
    // (v233) and his speed ARRIVING at each section, by name (segment|type#nth of that type on it; a fork's
    // branch is its fork's "in"), and leaving the ski-jump's lip: what the existing track gives him, lap by lap
    const name = {}, branchOf = {};
    for (const d of L.TK.segments) { const c = {}; name[d.id] = d.sections.map(x => x.type + "#" + (c[x.type] = (c[x.type] === undefined ? 0 : c[x.type] + 1))); }
    for (const d of L.TK.segments) if (d.fork) for (const w of ["safe", "stunt", "left"]) if (d.fork[w]) branchOf[d.fork[w]] = d.fork[w].split("_")[0];
    out.arr = {};
    for (let k = 0; k < n; k++) for (const steer of [0, 1, -1]) {
      st.speedStep = k;
      tk.at("deck", 0, 0);
      const f0 = tk.flags(), r0 = f0.runs, arr = {};
      let f = 0, last = null;
      for (; f < 60 * 200; f++) {
        tk.finger(true, T.seg === "deck" ? 0 : steer); tk.frame();
        if (tk.flags().runs > r0) break;
        if (T.air && T.air.kind === "ski" && !("ski:lip" in arr)) arr["ski:lip"] = +Math.hypot(T.air.vx, T.air.vy, T.air.vz).toFixed(2);
        if (T.air || T.bounce || T.bang || T.lift) continue;
        const def = T.segs[T.seg].def, q = L.tkAt(T.segs[T.seg], T.s), key = def.id + "|" + name[def.id][q.sec];
        if (key !== last && !(key in arr)) { arr[key] = +T.v.toFixed(2); if (branchOf[def.id] && q.sec === 0 && T.s < 3) arr[branchOf[def.id] + ":in"] = arr[key]; }
        last = key;
      }
      tk.finger(false);
      const f1 = tk.flags(), way = k + (steer > 0 ? "R" : steer < 0 ? "L" : "0");
      out.ways[way] = { secs: +(f / 60).toFixed(1), net: f1.net - f0.net, crashes: f1.crashes - f0.crashes, peels: f1.peels - f0.peels, gaps: f1.gaps - f0.gaps };
      out.arr[way] = arr;
    }
    st.speedStep = L.spdStepsFor("car").indexOf(1);
    return out;
  });
  const sw = steps.ways, ks = Object.keys(sw);
  check("track: the speed steps are the car's own pair in its own slot on the track, and they change the ride -- the top step's lap at least a quarter quicker than the bottom's",
    steps.pair && sw["0" + "0"].secs >= sw[(ks.length / 3 - 1) + "0"].secs * 1.33, JSON.stringify({ pair: steps.pair, slow: sw["00"], fast: sw[(ks.length / 3 - 1) + "0"] }));
  check("track: at EVERY speed step, hands-off, held right and held left, the whole run into the net with no bang and no fall (every jump landed: the kickers cap his speed)",
    ks.every(k => sw[k].net === 1 && sw[k].crashes === 0 && sw[k].peels === 0 && sw[k].gaps === (k.endsWith("R") ? 3 : 0)), JSON.stringify(sw));

  // ---- (v233) THE GIANT LOOP: green, 48 m tall, on fork D's straight-on way, fed by two runs of rollers end
  // to end. Asked of where he really is: his height over the loop's entry, which way up his car is drawn (the
  // model's own up), and where he comes out (stepped `offset` to his left, running the way he went in), in
  // every car that can board, at every speed step
  if (process.env.V233_ARRIVALS) console.log("V233_ARRIVALS " + JSON.stringify(steps.arr));
  {
    // everything he reaches before the giant loop -- and every section on the held-left and held-right ways,
    // which never meet it -- is v232's to a frame; only hands-off, after it (the triple loop and the ski-jump),
    // may differ: by the rollers that feed it, within 2.5 m/s, and off the ski-jump's lip within 0.3
    const KEYS = ["main0|loop#0", "A:in", "A_stunt|corkscrew#0", "main1|booster#0", "B:in", "B_stunt|kicker#0", "main2|hump#0", "main2|spiral#0", "main2|booster#0",
      "C:in", "C_loop|loop#0", "C_jump|kicker#0", "main3|drop#0", "D:in", "D_loop|loop#0", "D_jump|kicker#0", "main4|loop#0", "main4|loop#2", "main4|ski#0", "ski:lip"];
    const AFTER = { "main4|loop#0": 2.5, "main4|loop#2": 2.5, "main4|ski#0": 2.5, "ski:lip": 0.3 };
    const rows = [];
    for (const [way, was] of Object.entries(V232_ARRIVALS)) {
      const now = steps.arr[way] || {};
      for (const k of KEYS) if (k in was) {
        const after = way.endsWith("0") && k in AFTER;
        rows.push({ way, k, was: was[k], now: now[k], d: now[k] === undefined ? null : +(now[k] - was[k]).toFixed(2), tol: after ? AFTER[k] : 0.1, after });
      }
    }
    const off = rows.filter(r => r.d === null || Math.abs(r.d) > r.tol);
    const worst = (b) => rows.filter(r => r.after === b && r.d !== null).reduce((m, r) => Math.abs(r.d) > Math.abs(m.d) ? r : m, { d: 0 });
    check(`track (v233): his speed arriving at every section is v232's to a frame (0.1 m/s) up to fork D and on every held-left and held-right way (worst ${JSON.stringify(worst(false))}); hands-off after the giant loop, at the triple loop and the ski-jump, within 2.5 m/s, off the lip within 0.3 (worst ${JSON.stringify(worst(true))}), at all ${Object.keys(V232_ARRIVALS).length} steps and hands`,
      rows.length >= 15 * 14 && off.length === 0, JSON.stringify(off.slice(0, 8)));
  }
  const giant = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, out = { runs: [] };
    const G0 = tk.giant();
    if (!G0) return { missing: true };
    const n = L.spdStepsFor("car").length;
    // one ride: from (seg, s, v), finger held hands-off, until he is off the loop's segment or 40 s
    const ride = (s, v) => {
      const G = tk.giant(), E = G.entry, f0 = tk.flags();
      tk.at(G.seg, s, v);
      let top = -1e9, atTop = null, out1 = null, f = 0, inLoop = false;
      for (; f < 60 * 40 && T.seg === G.seg && !T.air && !T.bang; f++) {
        tk.finger(true, 0); tk.frame();
        if (T.seg !== G.seg) break;
        const q = L.tkAt(T.segs[T.seg], T.s);
        if (q.sec === G.si) {
          inLoop = true;
          const h = L.state.y - E.y;
          if (h > top) { top = h; const m = L.vehicleModel, up = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion); atTop = { h: +h.toFixed(1), N: +L.tkPose.N.y.toFixed(2), model: +up.y.toFixed(2), v: +T.v.toFixed(1) }; }
        } else if (inLoop && !out1 && T.s > G.s1 + 0.5) {
          const dx = L.state.x - E.x, dz = L.state.z - E.z;
          out1 = { lat: +(dx * E.lx + dz * E.lz).toFixed(2), dy: +(L.state.y - E.y).toFixed(2), dot: +(L.tkPose.T.x * E.tx + L.tkPose.T.y * E.ty + L.tkPose.T.z * E.tz).toFixed(4), v: +T.v.toFixed(1) };
        }
      }
      tk.finger(false);
      const f1 = tk.flags();
      return { top: atTop, out: out1, next: T.seg, secs: +(f / 60).toFixed(1), peels: f1.peels - f0.peels, crashes: f1.crashes - f0.crashes };
    };
    for (const veh of ["car", "cybertruck", "corvette"]) {
      out.boarded = (out.boarded || 0) + (tk.boardAs(veh) ? 1 : 0);
      L.api.setView(true);
      const k0 = st.speedStep;              // the step is each vehicle's own (speed.js): put back each one's
      for (let k = 0; k < n; k++) {
        st.speedStep = k;
        const G = tk.giant();
        // from a standing start at the start of its rollers, and arriving at lap speed off the spiral
        out.runs.push({ veh, k, from: "feed", ...(G.feed === null ? { noRollers: true } : ride(G.feed, 0)) });
        out.runs.push({ veh, k, from: "lap", ...ride(L.trk.segs[G.seg].S.find(q => q.type === "booster").s - 12, 22) });
      }
      st.speedStep = k0;
    }
    out.G = { R: G0.R, off: G0.off, color: G0.color, next: T.segs[G0.seg].next, drawn: !!(T.channels && T.channels[G0.color] && T.channels[G0.color].visible !== false) };
    return out;
  });
  {
    const G = giant.G || {}, bad = (giant.runs || []).filter(r => !(r.top && r.top.h >= 2 * G.R - 1.5 && r.top.N < -0.95 && r.top.model < -0.9 &&
      r.out && Math.abs(r.out.lat - G.off) < 0.6 && Math.abs(r.out.dy) < 0.6 && r.out.dot > 0.999 && r.next === giant.G.next && r.peels === 0 && r.crashes === 0));
    check(`track (v233): a held finger takes the SUV, the Cybertruck and the Corvette round the giant ${G.color} loop at every speed step -- from a standing start at its rollers and at lap speed: ${G.R ? 2 * G.R : "?"} m up and upside down at its top (the car drawn upside down), out the far side ${G.off} m to his left running the way he went in, and on to what follows it (${G.next}), no fall, no bang`,
      !giant.missing && giant.boarded === 3 && giant.runs.length === 30 && G.drawn && bad.length === 0,
      JSON.stringify(giant.missing ? giant : { bad: bad.slice(0, 4), slowestTop: giant.runs.reduce((m, r) => r.top && r.top.v < m.v ? { v: r.top.v, veh: r.veh, k: r.k, from: r.from } : m, { v: 1e9 }) }));
  }

  // ---- (v233) too slow into the giant loop: he peels off, goes bang, comes back at the START of the rollers
  // that feed it -- both runs, or from the second alone he would only fall out again -- with nothing taken,
  // and from there a held finger (the slowest step) takes him round
  const giantPeel = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, out = {};
    if (!tk.giant()) return { missing: true };
    for (const veh of ["car", "cybertruck", "corvette"]) {
      tk.boardAs(veh); L.api.setView(true);
      const G = tk.giant(), k0 = st.speedStep, f0 = tk.flags();
      // fast enough to climb past where the loop must pull (slower, he only rolls back down), too slow to go round
      tk.at(G.seg, G.s0 + 1, Math.sqrt(3.8 * 9.8 * G.R));
      tk.finger(false);
      let fell = false, bang = false, back = null;
      for (let i = 0; i < 60 * 12; i++) {
        const o = tk.frame();
        if (o.air) fell = true;
        if (o.bang) bang = true;
        if (bang && !o.bang && back === null) { back = { seg: o.seg, s: +o.s.toFixed(1), v: +o.v.toFixed(1) }; break; }
      }
      const kept = { step: st.speedStep === k0, veh: L.vehKind() === veh, on: T.on, runs: tk.flags().runs === f0.runs };
      st.speedStep = 0;
      tk.finger(true, 0);
      let made = false, topN = 1;
      for (let i = 0; i < 60 * 30 && !made; i++) {
        const o = tk.frame();
        if (o.seg === G.seg && L.tkAt(T.segs[o.seg], o.s).sec === G.si) topN = Math.min(topN, L.tkPose.N.y);
        if ((o.seg === G.seg && o.s > G.s1 + 5) || T.cameFrom[o.seg] === G.seg) made = !o.bang && !o.air;
      }
      tk.finger(false); st.speedStep = k0;
      const f1 = tk.flags();
      out[veh] = { seg: G.seg, fell, bang, back, feed: G.feed === null ? null : +G.feed.toFixed(1), loopAt: +G.s0.toFixed(1), kept, made, topN: +topN.toFixed(2), peels: f1.peels - f0.peels, reass: f1.reass - f0.reass };
    }
    return out;
  });
  check("track (v233): into the giant loop too slowly he peels off, tumbles and goes bang -- and comes back at the start of the rollers that feed it (both runs, on its own branch: he need not choose it again), his car, his speed step and the track all his, and with a held finger at the slowest step goes round, in every car",
    !giantPeel.missing && Object.values(giantPeel).length === 3 && Object.values(giantPeel).every(r => r.fell && r.bang && r.peels === 1 && r.reass === 1 && r.back && r.back.seg === r.seg && r.feed !== null && r.back.s <= r.feed + 0.5 && r.back.s >= r.feed - 3 &&
      r.kept.step && r.kept.veh && r.kept.on && r.kept.runs && r.made && r.topN < -0.95), JSON.stringify(giantPeel));

  // ---- (v233) finger off on the way in: on the climb he rolls back and is never stuck -- the finger down
  // again takes him round; and lifted on the rollers at a standstill, the rollers alone take him round
  const giantRoll = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, out = {};
    const G = tk.giant();
    if (!G || G.feed === null) return { missing: !G, noRollers: !!G };
    const past = o => (o.seg === G.seg && o.s > G.s1 + 5) || T.cameFrom[o.seg] === G.seg;
    for (const veh of ["car", "cybertruck", "corvette"]) {
      tk.boardAs(veh); L.api.setView(true);
      const k0 = st.speedStep;
      for (const k of [0, L.spdStepsFor("car").length - 1]) {      // the slowest step and the fastest
        st.speedStep = k;
        const f0 = tk.flags();
        tk.at(G.seg, G.s0 + 3, 12);
        tk.finger(false);
        let back = false, low = 1e9;
        for (let i = 0; i < 60 * 12; i++) { const o = tk.frame(); if (o.v < -0.5) back = true; if (o.seg === G.seg) low = Math.min(low, o.s); }
        tk.finger(true, 0);
        let through = false, f = 0;
        for (; f < 60 * 40 && !through; f++) { const o = tk.frame(); if (past(o)) through = !o.bang && !o.air; }
        tk.finger(false);
        const f1 = tk.flags();
        // and hands off the screen altogether, at a standstill on the start of its rollers
        tk.at(G.seg, G.feed, 0);
        let alone = false;
        for (let i = 0; i < 60 * 20 && !alone; i++) { const o = tk.frame(); if (past(o)) alone = !o.bang && !o.air; }
        const f2 = tk.flags();
        out[veh + ":" + k] = { back, rolledTo: +(low - G.s0).toFixed(1), through, secs: +(f / 60).toFixed(1), rollersAlone: alone,
                               peels: f2.peels - f0.peels, crashes: f2.crashes - f0.crashes };
      }
      st.speedStep = k0;
    }
    return out;
  });
  check("track (v233): a finger off on the climb into the giant loop -- he rolls back down and is never stuck: the finger down again takes him round; and lifted at a standstill on its rollers, the rollers alone take him round -- no fall, no bang, in every car at the slowest and the fastest step",
    !giantRoll.missing && !giantRoll.noRollers && Object.keys(giantRoll).length === 6 && Object.values(giantRoll).every(r => r.back && r.rolledTo < 0 && r.through && r.rollersAlone && r.peels === 0 && r.crashes === 0), JSON.stringify(giantRoll));

  // ---- (v233) the giant loop and its S cross nothing: no road (the motorway, every spur and exit, the track's
  // own exit lane and road back), runway, solid or other piece of track within a channel's reach, no leg of it
  // through track or solid, and all of it inside the corridor the streamed scenery keeps off
  const giantClear = await page.evaluate(() => {
    const tk = window.__tk, L = window.__lp, T = L.trk, TK = L.TK, HW = L.HW;
    const G = tk.giant();
    if (!G) return { missing: true };
    const S = T.segs[G.seg].S, mine = S.filter(q => q.sec >= G.si - 1 && q.sec <= G.si + 3);   // its new rollers, the loop, its straight, its S
    const reach = TK.width / 2 + TK.wallT, out = { n: mine.length };
    // the motorway and every road off it (exits, spurs, the track's own road back): flat distance
    let road = 1e9, roadAt = null;
    for (const q of mine) {
      const h = L.hwyNearest(q.x, q.z); const d = Math.abs(h.lateral) - (HW.medianW / 2 + HW.laneW * 3);
      if (d < road) { road = d; roadAt = "motorway"; }
      for (const ex of L.highway.exits.concat(T.back ? [T.back] : [])) for (const p of ex.spur || []) { const dd = Math.hypot(p.x - q.x, p.z - q.z); if (dd < road) { road = dd; roadAt = ex.to || ex.icon || "spur"; } }
    }
    out.road = { min: +road.toFixed(1), at: roadAt };
    out.runway = Math.min(...L.AIRPORTS.map(a => Math.min(...mine.map(q => Math.hypot(q.x - (a.cx || 0), q.z - a.cz))) - L.TUNE.runwayLength / 2));
    // every other piece of track, the exit lane among them
    let tr = 1e9, trAt = null;
    const ends = [S[0], S[S.length - 1]];
    for (const p of T.order) for (let k = 0; k < p.S.length; k += 2) {
      const o = p.S[k];
      for (let j = 0; j < mine.length; j += 2) {
        if (p.id === G.seg && Math.abs(o.s - mine[j].s) < 40) continue;      // the channel it runs on (its own entry and exit ARE asked: they pass 10 m apart)
        if (ends.some(E => Math.hypot(o.x - E.x, o.y - E.y, o.z - E.z) < 40 && Math.hypot(mine[j].x - E.x, mine[j].y - E.y, mine[j].z - E.z) < 40)) continue;   // where branches meet it, at either end
        const d = Math.hypot(o.x - mine[j].x, o.y - mine[j].y, o.z - mine[j].z);
        if (d < tr) { tr = d; trAt = p.id + "@" + Math.round(o.s) + " / @" + Math.round(mine[j].s); }
      }
    }
    out.track = { min: +tr.toFixed(1), at: trAt, need: TK.width + 2 * TK.wallT + 0.5 };
    // what stands over the track, all 48 m of it: the rings over the jumps and the signs' gantries
    // (a ring is a torus: asked of its tube, not its box -- the big jump's ring reaches over the straight-on way
    // 14 m up, as it did on v232; every sign's posts, beam and panels by their own boxes)
    const over = [], P = new THREE.Vector3(), inv = new THREE.Matrix4();
    let ringMin = 1e9;
    for (const r of T.rings || []) {
      r.updateMatrixWorld(true); inv.copy(r.matrixWorld).invert();
      const R = r.geometry.parameters.radius, tube = r.geometry.parameters.tube;
      for (const q of mine) { P.set(q.x, q.y, q.z).applyMatrix4(inv); ringMin = Math.min(ringMin, Math.hypot(Math.hypot(P.x, P.y) - R, P.z) - tube); }
    }
    if (ringMin < reach + TK.wallH + 0.5) over.push("ring");
    for (const sg of T.signs || []) sg.g.traverse(o => { if (!o.isMesh) return;
      const box = new THREE.Box3().setFromObject(o).expandByScalar(reach + 0.5);
      if (mine.some(q => box.containsPoint(P.set(q.x, q.y, q.z)))) over.push("sign@" + sg.seg); });
    out.over = [...new Set(over)]; out.ringClear = +ringMin.toFixed(1);
    // the registry: nothing solid within the channel's reach of it
    const solids = [];
    for (const q of mine) L.forEachSolid(b => { if (L.solidTest(b, q.x, q.y, q.z, reach)) solids.push(L.solidKind ? L.solidKind(b) : b.kind); });
    out.solids = [...new Set(solids)];
    // its legs: none through another piece of track or a solid
    const legs = T.legs.filter(l => mine.some(q => Math.hypot(q.x - l.x, q.z - l.z) < 0.01));
    let legBad = [];
    for (const l of legs) {
      for (const p of T.order) for (const o of p.S) if (Math.hypot(o.x - l.x, o.z - l.z) < TK.width / 2 + TK.wallT + 1.1 && o.y < l.y1 - 1 && o.y > l.y0 && !(p.id === G.seg && Math.abs(o.y - l.y1) < 3)) { legBad.push(p.id + "@" + Math.round(o.s)); break; }
      for (let y = l.y0 + 1; y < l.y1 - 1; y += 3) L.forEachSolid(b => { if (L.solidTest(b, l.x, y, l.z, 1.1)) legBad.push("solid"); });
    }
    out.legs = { n: legs.length, bad: [...new Set(legBad)].slice(0, 5) };
    // the corridor the scenery keeps off: every metre of it claimed
    out.corridor = +Math.max(...mine.map(q => L.hwyCorridorDist(q.x, q.z))).toFixed(1);
    out.ground = +Math.min(...mine.filter(q => q.ny > 0.5).map(q => q.y - TK.deckT - Math.max(L.terrainEff(q.x, q.z), L.TUNE.waterLevel))).toFixed(1);
    return out;
  });
  check("track (v233): the giant loop, its rollers and its S cross nothing -- no road, spur or the track's own exit lane and road back near it, no runway, nothing solid within its walls, no other piece of track within a channel's width (the tall loop and the big jump beside it), no ring or sign gantry over its 48 m, none of its legs through track or solid, and all of it in the corridor the scenery keeps off",
    !giantClear.missing && giantClear.n > 300 && giantClear.road.min > 60 && giantClear.runway > 300 && giantClear.track.min >= giantClear.track.need && giantClear.solids.length === 0 && giantClear.over.length === 0 &&
    giantClear.legs.n > 0 && giantClear.legs.bad.length === 0 && giantClear.corridor < 9 && giantClear.ground > 0.5, JSON.stringify(giantClear));

  // ---- (v233) the cameras ride the giant loop as they ride the first: portrait and landscape, from behind
  // and from his seat, every frame round it -- from behind, his car on the screen with nothing of the track
  // between, and the track 20 m ahead of him on the screen; from the seat, the track 10 m ahead on the screen
  // and in sight (20 m round the first loop's 15 m radius turns him 76 degrees: that track is overhead, out of the windscreen).
  // The first loop is held to the same, so the bar is the one the track already met.
  const cams = {};
  for (const [vw, vh] of [[820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width: vw, height: vh });
    cams[`${vw}x${vh}`] = await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, cam = L.camera, out = {};
      const G = tk.giant();
      if (!G || G.feed === null) return { missing: true };
      tk.boardAs("car");
      const k0 = st.speedStep; st.speedStep = L.spdStepsFor("car").indexOf(1);
      const first = { seg: "main0", si: T.segs.main0.S.find(q => q.type === "loop").sec, feed: tk.sOf("main0", "booster") };
      const meshes = [T.channel].concat(Object.values(T.channels || {}));
      const rc = new THREE.Raycaster(), P = new THREE.Vector3(), D = new THREE.Vector3();
      const onScreen = v => { P.copy(v).project(cam); return Math.abs(P.x) < 0.95 && Math.abs(P.y) < 0.95 && P.z < 1; };
      const seen = (v, slack) => { D.copy(v).sub(cam.position); const d = D.length(); rc.set(cam.position, D.normalize()); rc.far = d; const h = rc.intersectObjects(meshes, false)[0]; return !h || h.distance > d - slack; };
      for (const [name, L0] of [["first", first], ["giant", { seg: G.seg, si: G.si, feed: G.feed }]]) for (const chase of [true, false]) {
        L.api.setView(chase);
        tk.at(L0.seg, L0.feed, 0);
        const r = { frames: 0, carOff: 0, carHidden: 0, aheadOff: 0, aheadHidden: 0, aspect: +cam.aspect.toFixed(2), win: +(innerWidth / innerHeight).toFixed(2), worst: null };
        for (let f = 0; f < 60 * 20; f++) {
          tk.finger(true, 0); tk.frame();
          if (T.seg !== L0.seg || T.air || T.bang) { if (r.frames) break; continue; }
          const q = L.tkAt(T.segs[T.seg], T.s);
          if (q.sec !== L0.si) { if (r.frames) break; continue; }
          cam.updateMatrixWorld(true);
          r.frames++;
          const car = new THREE.Vector3(L.tkPose.x + L.tkPose.N.x, L.tkPose.y + L.tkPose.N.y, L.tkPose.z + L.tkPose.N.z);
          const a = L.tkStep(T.seg, T.s, chase ? 20 : 10), qa = L.tkAt(T.segs[a.seg], a.s), ahead = new THREE.Vector3(qa.x + qa.nx * 0.5, qa.y + qa.ny * 0.5, qa.z + qa.nz * 0.5);
          const fail = [];
          if (chase) { if (!onScreen(car)) { r.carOff++; fail.push("carOff"); } else if (!seen(car, 2)) { r.carHidden++; fail.push("carHidden"); } }
          if (!onScreen(ahead)) { r.aheadOff++; fail.push("aheadOff"); } else if (!seen(ahead, 2.5)) { r.aheadHidden++; fail.push("aheadHidden"); }
          if (fail.length && !r.worst) r.worst = { s: +T.s.toFixed(0), up: +L.tkPose.N.y.toFixed(2), fail };
        }
        out[name + (chase ? ":chase" : ":seat")] = r;
      }
      tk.finger(false); st.speedStep = k0; L.api.setView(true);
      return out;
    });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  {
    const rows = Object.entries(cams).flatMap(([v, o]) => o.missing ? [{ v, missing: true }] : Object.entries(o).map(([k, r]) => ({ v, k, ...r })));
    const bad = rows.filter(r => r.missing || r.frames < 60 || r.carOff || r.carHidden || r.aheadOff || r.aheadHidden || r.aspect !== r.win);
    check(`track (v233): round the giant loop, portrait and landscape, the chase camera keeps his car on the screen with no track between them and the track ahead in view, and from his seat the track 10 m ahead is in view -- every frame, as round the first loop (${rows.map(r => `${r.v} ${r.k} ${r.frames}`).join(", ")} frames)`,
      rows.length === 8 && bad.length === 0, JSON.stringify(bad));
  }

  // ---- (v233) THE SIGNS STAY READABLE: for every fork's sign, the longest he sees BOTH its panels whole --
  // every corner and the middle of each on the screen, with nothing in front (the track, its legs and clips,
  // the gantries, the props, his own car or cabin) -- in one go before he passes under it, riding a lap
  // hands-off with a held finger, from behind and from his seat, portrait and landscape, at every speed step;
  // against v232's (V232_SIGHT, measured the same way; V233_SIGHT=1 prints the table). Round 2 put the giant
  // loop in front of fork C's sign and cut 2.1-2.4 s to 0.4-0.6 s: this is the check that says so. And after
  // the giant loop there is nothing to read: no sign stands between it and the net.
  const sight = {};
  for (const [vw, vh] of [[820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width: vw, height: vh });
    sight[`${vw}x${vh}`] = await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      const tk = window.__tk, L = window.__lp, st = L.state, T = L.trk, cam = L.camera, out = {};
      tk.boardAs("car");
      const k0 = st.speedStep;
      const carMeshes = new Set(); for (const c of T.cars) c.mesh.traverse(o => carMeshes.add(o));
      const channels = [T.channel].concat(Object.values(T.channels || {}));
      // per sign: what can stand in front of it -- the channels' triangles within 300 m cut into 25 m cells (so a
      // ray tests a few small meshes, not the whole track), and every other thing of the track
      const prep = T.signs.map(sg => {
        const cells = {}, cx = sg.g.position.x, cz = sg.g.position.z;
        for (const m of channels) {
          const p = m.geometry.attributes.position.array, ix = m.geometry.index.array;
          for (let i = 0; i < ix.length; i += 3) {
            const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3, x = (p[a] + p[b] + p[c]) / 3, z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
            if (Math.hypot(x - cx, z - cz) > 300) continue;
            const key = Math.floor(x / 25) + "," + Math.floor(z / 25);
            (cells[key] || (cells[key] = [])).push(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]);
          }
        }
        const occ = Object.values(cells).map(P => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.computeBoundingSphere();
          const mm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mm.updateMatrixWorld(true); return mm; });
        for (const ch of T.g.children) if (!channels.includes(ch) && ch !== sg.g && !carMeshes.has(ch)) occ.push(ch);
        const pts = sg.panels.map(p => { const g = p.mesh.geometry; g.computeBoundingBox(); const b = g.boundingBox;
          return { mesh: p.mesh, loc: [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => new THREE.Vector3(u * b.max.x * 0.95, v * b.max.y * 0.95, b.max.z + 0.02)) }; });
        return { sg, occ, pts };
      });
      const rc = new THREE.Raycaster(), V = new THREE.Vector3(), N = new THREE.Vector3(), D = new THREE.Vector3();
      const clear = (P, extra) => {
        P.sg.g.updateMatrixWorld(true);
        for (const p of P.pts) for (const lp of p.loc) {
          V.copy(lp).applyMatrix4(p.mesh.matrixWorld);
          N.copy(V).project(cam);
          if (!(Math.abs(N.x) <= 1 && Math.abs(N.y) <= 1 && N.z < 1 && N.z > -1)) return false;
          D.copy(V).sub(cam.position); const d = D.length(); rc.set(cam.position, D.normalize()); rc.far = d - 0.3;
          if (rc.intersectObjects(P.occ.concat(extra), true).some(x => { for (let q = x.object; q; q = q.parent) if (!q.visible) return false; return true; })) return false;
        }
        return true;
      };
      for (const chase of [true, false]) for (let k = 0; k < L.spdStepsFor("car").length; k++) {
        st.speedStep = k; L.api.setView(chase);
        tk.at("deck", 0, 0);
        const r0 = tk.flags().runs, run = {}, best = {};
        for (let f = 0; f < 60 * 200; f++) {
          tk.finger(true, 0); tk.frame();
          if (tk.flags().runs > r0) break;
          if (T.air || T.bounce || T.bang || T.lift) continue;
          cam.updateMatrixWorld(true);
          const extra = chase ? [L.vehicleModel] : [L.car.cabin];
          for (const P of prep) {
            const id = P.sg.seg;
            if (T.seg !== id || id in best) continue;
            if (T.s >= P.sg.s) { best[id] = +(run[id] || 0).toFixed(2); continue; }          // passing under it: the run he had
            if (P.sg.s - T.s > 200) continue;
            if (clear(P, extra)) { run[id] = (run[id] || 0) + 1 / 60; } else if (run[id]) { best["last:" + id] = run[id]; run[id] = 0; }
          }
        }
        tk.finger(false);
        // the run that was going when he passed under it, or the last one he had before it
        for (const P of prep) { const id = P.sg.seg; if (!best[id] && best["last:" + id]) best[id] = +best["last:" + id].toFixed(2); delete best["last:" + id]; }
        out[(chase ? "chase" : "seat") + ":" + k] = best;
      }
      st.speedStep = k0; L.api.setView(true);
      // nothing to read after the giant loop: no sign on the way from it to the net
      const G = tk.giant(); let after = G && T.signs.some(sg => sg.seg === G.seg && sg.s > G.s1) ? [G.seg] : [], id = G ? T.segs[G.seg].next : null;
      for (let n = 0; id && n < 20; n++) { if (T.signs.some(sg => sg.seg === id)) after.push(id); id = T.segs[id].next; }
      out.signsAfterGiant = G ? after : null;
      return out;
    });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  if (process.env.V233_SIGHT) console.log("V233_SIGHT " + JSON.stringify(sight));
  {
    const rows = [];
    for (const [vp, o] of Object.entries(V232_SIGHT)) for (const [view, signs] of Object.entries(o)) for (const [id, was] of Object.entries(signs)) {
      const now = sight[vp] && sight[vp][view] ? sight[vp][view][id] : undefined;
      rows.push({ vp, view, id, was, now, d: now === undefined ? null : +(now - was).toFixed(2) });
    }
    const bad = rows.filter(r => r.d === null || r.d < -0.1);
    const after = Object.values(sight).map(o => o.signsAfterGiant);
    check(`track (v233): every fork's sign is as readable as on v232 -- both panels whole and in sight, in one go before he passes under it, from behind and from his seat, portrait and landscape, every speed step, no less than v232's less 0.1 s (${rows.length} cases; shortest now ${Math.min(...rows.map(r => r.now === undefined ? 0 : r.now))} s); and after the giant loop no sign to read`,
      rows.length >= 4 * 2 * 2 * 5 && bad.length === 0 && after.every(a => Array.isArray(a) && a.length === 0), JSON.stringify({ bad: bad.slice(0, 8), after }));
  }

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
