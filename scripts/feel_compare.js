"use strict";
// THE CITY MUST FEEL LIKE THE MOTORWAY, ONLY SLOWER. The same stick inputs, on
// a long straight city street and on a straight stretch of motorway, at the
// same speed, and every difference in how the car answers:
//
//   hands     finger down, no steer, 8 s: how far he wanders off his lane
//   (maxDev/rms: metres off his lane; peakHead: degrees off the road's line;
//    back: seconds from letting go to within 0.5 m of his lane)
//   nudge     a light steer (0.35) for 1 s, then let go
//   full      full lock LEFT (-1.0) for 0.4 s, then let go -- in the city on its
//             east edge street, where no street is to his left
//   lift      finger off for 2 s at speed: how fast he slows
//   tremor    a 0.1 steer for 2 s: whether the deadzone is the same
//
//   node scripts/feel_compare.js [root] [speed m/s ...]
//
// Prints a table and writes evidence/feel/feel.json. The city street is New
// York's 3833 street, driven west from its east end: 840 m of straight grid.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const SPEEDS = process.argv.slice(3).map(Number).filter(Boolean);
const OUT = path.resolve(__dirname, "..", "evidence", "feel");

function measure(speeds) {
  const L = window.__lp, st = L.state, out = [];
  L.api.skipScreens(); L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  for (let i = 0; i < 10; i++) L.update(1 / 60);
  const ny = L.streets.cities.ny;
  // the street: every grid road on z = 3833, west of x = -76, heading west
  // `edge`: the city's east edge street, driven north -- nothing to its left, so
  // a full steer left is steering, not the choice of a street
  const lane = (where, edge) => {
    if (where === "city") {
      const n = ny.nodes.find(q => Math.abs(q.x + 76) < 1 && Math.abs(q.z - (edge ? 3899 : 3833)) < 1);
      const arm = n.arms.find(a => a.road.kind === "grid" && (edge ? a.dz > 0.9 : a.dx < -0.9));
      const r = arm.road, dir = arm.atStart ? 1 : -1, q = {};
      L.stPointAt(r, dir > 0 ? 20 : r.len - 20, dir, r.lo, q);
      return { x: q.x, z: q.z, h: Math.atan2(-q.fx, -q.fz), y: L.stSurfaceAt(q.x, q.z), road: r, dir, city: true };
    }
    const q = L.hwySampleAt(3000), c = 1, lat = c * (L.HW.medianW / 2 + L.HW.laneW * (edge ? 1.5 : 0.5));
    return { x: q.x - q.fz * lat, z: q.z + q.fx * lat, y: q.y, h: Math.atan2(-q.fx * c, -q.fz * c), city: false, lat };
  };
  // his offset from the lane he started in, and his heading off the road's own
  // (the street is straight; the motorway's direction is read where he is)
  const dev = (P) => {
    if (P.city) { const fx = -Math.sin(P.h), fz = -Math.cos(P.h); return (st.x - P.x) * -fz + (st.z - P.z) * fx; }
    const n = L.hwyNearest(st.x, st.z); return n.lateral - P.lat;
  };
  const herr = (P) => {
    if (P.city) return L.wrapPi(st.heading - P.h);
    const n = L.hwyNearest(st.x, st.z); return L.wrapPi(st.heading - Math.atan2(-n.fx, -n.fz));
  };
  const run = (where, v, script, secs) => {
    const P = lane(where, script.edge);
    st.x = P.x; st.z = P.z; st.y = P.y; st.heading = P.h; st.speed = v; st.exploding = false;
    L.car.yield = 1; L.car.steer = 0; L.car.assistOff = 0; L.car.onSpurRoad = false; L.car.spurRec = null;
    L.car.exitChoice = null; L.car.lastHeld = 0; L.car.liftT = 0;
    if (L.stPlan) { L.stPlan.road = P.city ? P.road : null; L.stPlan.dir = P.dir || 1; L.stPlan.turn = null; }
    L.spdReset();
    for (const t of L.highway.traffic) t.alive = false;
    for (const t of L.stTraffic.list) t.alive = false;
    const r = { maxDev: 0, rms: 0, peakHead: 0, back: null, endSpeed: 0, heading: 0, bangs: 0 };
    const c0 = L.flags.carCrashes || 0, t0 = (L.flags.cityTrafficHit || 0) + (L.flags.hwyTrafficHit || 0);
    let n = 0, released = null;
    for (let f = 0; f < secs * 60; f++) {
      const t = f / 60, s = script(t);
      if (s === null) L.api.clearStick(); else L.api.setStick(s, 0);
      // speed held for the steering tests: the answer to a steer, not to the throttle
      if (script.hold) st.speed = v;
      L.update(1 / 60);
      if (st.exploding) { st.explodeTimer = 0; L.update(1 / 60); }
      const d = dev(P), he = Math.abs(herr(P)) * 180 / Math.PI;
      r.maxDev = Math.max(r.maxDev, Math.abs(d)); r.rms += d * d; n++;
      r.peakHead = Math.max(r.peakHead, he);
      if (s === 0 && released === null && t > 0.05) released = t;
      if (released !== null && r.back === null && Math.abs(d) < 0.5 && t > released + 0.2) r.back = +(t - released).toFixed(2);
    }
    r.rms = +Math.sqrt(r.rms / n).toFixed(2); r.maxDev = +r.maxDev.toFixed(2); r.peakHead = +r.peakHead.toFixed(1);
    r.endSpeed = +st.speed.toFixed(1); r.heading = +(herr(P) * 180 / Math.PI).toFixed(1);
    r.bangs = (L.flags.carCrashes || 0) - c0; r.touches = (L.flags.cityTrafficHit || 0) + (L.flags.hwyTrafficHit || 0) - t0;
    r.onStreetAtEnd = !!L.car.onStreet; r.cap = L.car.road && L.car.road.cap < 999 ? +L.car.road.cap.toFixed(1) : null;
    return r;
  };
  const S = {
    hands: Object.assign(() => 0, { hold: true, secs: 8 }),
    nudge: Object.assign((t) => (t < 1 ? 0.35 : 0), { hold: true, secs: 6 }),
    full: Object.assign((t) => (t < 0.4 ? -1 : 0), { hold: true, secs: 6, edge: true }),
    tremor: Object.assign((t) => (t < 2 ? 0.1 : 0), { hold: true, secs: 3 }),
    lift: Object.assign((t) => (t < 2 ? null : 0), { hold: false, secs: 2 }),
  };
  for (const v of speeds) for (const k in S) {
    out.push({ test: k, v, city: run("city", v, S[k], S[k].secs), motorway: run("motorway", v, S[k], S[k].secs) });
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = 8198, srv = serve(ROOT, port), browser = await launch();
  const pg = await openGame(browser, port, { width: 820, height: 1180 });
  const res = await pg.evaluate(measure, SPEEDS.length ? SPEEDS : [20, 46]);
  const row = (k, a, b) => `${k.padEnd(9)} ${String(a).padStart(8)} ${String(b).padStart(9)}${a !== b && typeof a === "number" && Math.abs(a - b) > Math.max(0.15, 0.1 * Math.abs(b)) ? "   <-- differs" : ""}`;
  for (const r of res) {
    console.log(`\n== ${r.test} at ${r.v} m/s          city  motorway`);
    for (const k of ["maxDev", "rms", "peakHead", "back", "heading", "endSpeed", "bangs", "touches"]) console.log(row(k, r.city[k], r.motorway[k]));
  }
  fs.writeFileSync(path.join(OUT, path.basename(ROOT) + "-feel.json"), JSON.stringify(res, null, 1));
  await browser.close(); srv.close();
})();
