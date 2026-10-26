"use strict";
// London's evidence (v197): renders to LOOK at -- every landmark, the crossing, the cliffs,
// the airport -- and the frame cost from the air and the street.
//
//   node scripts/london_renders.js [vantage ...]     (no names: all of them)
//   VP=1180x820 node scripts/london_renders.js       (landscape; default 820x1180 portrait)
//   SEAT=1 ...                                       (the cockpit, not the chase camera)
//
// Writes evidence/london/<vantage>.png. Each vantage stands a plane (or the helicopter)
// somewhere, pointed at something, and holds it there while the frame settles; the
// render-critic is then asked what it sees, WITHOUT being told what any of it is.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const OUT = path.resolve(__dirname, "..", "evidence", "london");
const [W, H] = (process.env.VP || "820x1180").split("x").map(Number);

// a plane at (x, y-above-ground, z), nose at (tx, ty-above-ground, tz)
const at = (x, agl, z, tx, tagl, tz, veh) => ({ x, agl, z, tx, tagl, tz, veh: veh || "prop" });
const V = {
  "sea-ship":       Object.assign(at(-260, 50, 380, 0, 4, 0), { ship: 1 }),   // (x, z: from the ship)
  "sea-lighthouse": at(300, 45, 10150, 600, 20, 10450),
  "cliffs":         at(0, 70, 10700, 0, 25, 11500),
  "airport":        at(260, 40, 12300, 0, 0, 13100),
  "thames-in":      at(-860, 90, 11900, -880, 10, 13000),
  "tower-bridge":   at(-560, 35, 13560, -767, 25, 13795),
  "tower-london":   at(-760, 70, 13700, -1012, 10, 13905),
  "shard":          at(-460, 60, 13950, -708, 120, 14190),
  "stpauls":        at(-1000, 70, 14330, -1235, 50, 14590),
  "gherkin":        at(-1050, 60, 13800, -1250, 70, 14060),
  "london-bridge":  at(-860, 40, 14560, -901, 6, 14221),
  "bigben":         at(-760, 60, 15060, -500, 60, 15505),
  "clock":          at(-560, 64, 15420, -500, 66, 15505),
  "mall":           at(-834, 30, 15650, -834, 12, 16100),
  "parliament":     at(-420, 40, 15250, -430, 20, 15520),
  "eye":            at(-640, 60, 15560, -650, 60, 15290),
  "trafalgar":      at(-980, 45, 15500, -905, 30, 15622),
  "palace":         at(-834, 45, 15760, -834, 15, 16175),
  "overview":       at(-200, 420, 13000, -850, 0, 14700),
  "overview-west":  at(-1700, 380, 16600, -850, 0, 14900),
  // v198: DRIVING London -- a car parked in its lane (the nearest road to x, z, facing tx, tz),
  // the traffic left to run round it for `warm` seconds first
  "drive-airport":  { car: 1, x: 170, z: 13760, tx: 170, tz: 14100, warm: 6 },
  "drive-street":   { car: 1, x: -400, z: 14356, tx: -700, tz: 14356, warm: 25 },
  "drive-tower":    { car: 1, x: -560, z: 13780, tx: -900, tz: 13780, warm: 4 },
  "drive-tbdeck":   { car: 1, x: -700, z: 13780, tx: -900, tz: 13780, warm: 4 },
  "drive-lbridge":  { car: 1, x: -760, z: 14260, tx: -1000, tz: 14260, warm: 4 },
  "drive-bigben":   { car: 1, x: -594, z: 15700, tx: -594, tz: 15500, warm: 25 },
  "drive-mall":     { car: 1, x: -954, z: 15800, tx: -954, tz: 16100, warm: 25 },
  "drive-air-over": at(-300, 140, 14700, -700, 0, 14250),
  "tb-east-top":    at(-560, 70, 13740, -615, 0, 13780),
  "tb-east-down":   at(-575, 45, 13781, -606, 0, 13781),
  // ... and behind one of London's own: a red double-decker, a black cab (the car comes up behind
  // whichever is nearest once the traffic has run)
  "drive-decker":   { car: 1, x: -400, z: 14356, tx: -700, tz: 14356, warm: 20, follow: 2, back: 32 },
  "drive-cab":      { car: 1, x: -1100, z: 15000, tx: -1100, tz: 14700, warm: 20, follow: 1, back: 22 },
  "drive-bigben2":  { car: 1, x: -760, z: 15604, tx: -500, tz: 15604, warm: 4 },
};

function hold(v) {
  const L = window.__lp, st = L.state;
  if (v.car) {
    L.api.setVehicle(v.veh || "car"); L.ldStart();
    const R = L.stReassembleAt(v.x, v.z, Math.atan2(-(v.tx - v.x), -(v.tz - v.z)), null, Infinity);
    const put = () => { st.x = R.x; st.z = R.z; st.y = R.y; st.heading = R.heading; st.speed = 0; st.exploding = false; L.stPlan.road = R.road; L.stPlan.dir = R.dir; };
    put();
    return put;
  }
  if (v.ship !== undefined) {
    const sh = L.ldn.ships[v.ship], ox = v.x, oz = v.z;
    const h0 = () => { v.x = sh.x + ox; v.z = sh.z + oz; v.tx = sh.x; v.tz = sh.z; };
    h0();
    L.api.setVehicle(v.veh); L.api.spawnAt(2, 0); st.phase = "AIRBORNE";
    return () => { h0(); const dx = v.tx - v.x, dz = v.tz - v.z; st.x = v.x; st.z = v.z; st.y = L.TUNE.waterLevel + v.agl; st.heading = Math.atan2(-dx, -dz); st.pitch = Math.atan2(v.tagl - v.agl, Math.hypot(dx, dz)) * 180 / Math.PI; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.airVy = 0; st.exploding = false; };
  }
  L.api.setVehicle(v.veh);
  L.api.spawnAt(2, 0);
  st.phase = "AIRBORNE";
  const gy = Math.max(L.terrainEff(v.x, v.z), L.TUNE.waterLevel), ty = Math.max(L.terrainEff(v.tx, v.tz), L.TUNE.waterLevel);
  const dx = v.tx - v.x, dz = v.tz - v.z, dy = (ty + v.tagl) - (gy + v.agl);
  const h = Math.atan2(-dx, -dz), p = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  return () => { st.x = v.x; st.z = v.z; st.y = gy + v.agl; st.heading = h; st.pitch = p; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.airVy = 0; st.exploding = false; };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(V);
  const port = +(process.env.PORT || 8186), srv = serve(path.resolve(__dirname, ".."), port);
  const browser = await launch(), errors = [];
  await (await openGame(browser, port, { width: 200, height: 200 })).close();   // a fresh SwiftShader's first context comes up lost
  const pg = await openGame(browser, port, { width: W, height: H, errors });
  await pg.evaluate(() => { performance.now = () => window.__simTime; window.__lp.api.skipScreens(); });
  for (const name of names) {
    const v = V[name];
    if (!v) { console.log("no vantage", name); continue; }
    const info = await pg.evaluate(([src, v, seat]) => {
      const L = window.__lp;
      window.__hold = eval("(" + src + ")")(v);
      L.api.setView(!seat);
      for (let i = 0; i < (v.warm ? v.warm * 60 : 150); i++) { L.update(1 / 60); window.__hold(); }
      if (v.follow !== undefined) {
        // up behind the nearest of that kind on a London street, in its lane
        const st = L.state, list = L.stTraffic.list.filter(t => t.alive && !t.path && !t.spin && t.city === "ldn" && t.type === v.follow);
        list.sort((a, b) => Math.hypot(a.wx - st.x, a.wz - st.z) - Math.hypot(b.wx - st.x, b.wz - st.z));
        const t = list[0];
        if (t) {
          // (kept there frame by frame while it drives, so the chase camera has caught up)
          window.__hold = () => {
            const R = L.stReassembleAt(t.wx - t.hx * v.back, t.wz - t.hz * v.back, Math.atan2(-t.hx, -t.hz), t.path ? t.path.arm.road : t.road);
            if (!R) return;
            st.x = R.x; st.z = R.z; st.y = R.y; st.heading = R.heading; st.speed = 0; st.exploding = false; L.stPlan.road = R.road; L.stPlan.dir = R.dir;
          };
          for (let i = 0; i < 90; i++) { L.update(1 / 60); window.__hold(); }
        }
      }
      const r = L.renderer; r.info.autoReset = false; r.info.reset();
      for (let i = 0; i < 3; i++) { r.info.reset(); window.__paint(); window.__hold(); }
      const out = { calls: r.info.render.calls, tris: r.info.render.triangles };
      r.info.autoReset = true;
      return out;
    }, [hold.toString(), v, !!process.env.SEAT]);
    const file = path.join(OUT, `${name}${process.env.SEAT ? "-seat" : ""}${W > H ? "-land" : ""}.png`);
    await pg.screenshot({ path: file });
    console.log("wrote", path.relative(process.cwd(), file), JSON.stringify(info));
  }
  if (errors.length) console.log("errors", errors.slice(0, 8));
  await browser.close(); srv.close();
})();
