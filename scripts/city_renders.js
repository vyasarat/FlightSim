"use strict";
// The drivable cities' evidence: five renders to LOOK at, and the frame cost of
// the busiest junction.
//
//   node scripts/city_renders.js <beforeRoot> <afterRoot>
//
// Each root is a directory holding a cockpit/ (a snapshot of the release before
// the streets, and this repo). Writes evidence/city/<vantage>.png from the
// after build, and evidence/city/perf.json.
//
// Renders, all portrait: the driving seat at a New York junction, on the bridge
// deck, and at the fountain; and from the air over each city with its traffic.
//
// THE NUMBERS are SwiftShader's -- a software rasteriser at 820x1180 @1x, not
// an iPad. `calls` and `tris` are the numbers that transfer; `ms` is a whole
// forced frame and over-prices fill. The two builds are timed INTERLEAVED,
// sample by sample, never in blocks, and more than one run is reported.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const [rootA, rootB] = process.argv.slice(2, 4).map(p => path.resolve(p));
const OUT = path.resolve(__dirname, "..", "evidence", "city");
const W = 820, H = 1180;

// Each vantage sets him up and returns a `hold` run after every update.
const VANTAGES = {
  "ny-junction-seat": () => {
    const L = window.__lp, st = L.state, C = L.streets.cities.ny;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 5; i++) L.update(1 / 60);            // the signals are built on the first frames
    // the signalled junction nearest the hero tower, from the stop line
    const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
    const n = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
    const arm = n.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
    L.stPointAt(r, dir > 0 ? r.len - 22 : 22, dir, r.lo, q);
    const h = Math.atan2(-q.fx, -q.fz), y = L.stSurfaceAt(q.x, q.z);
    return () => { L.api.clearStick(); st.x = q.x; st.z = q.z; st.y = y; st.heading = h; st.speed = 0; };
  },
  "ny-bridge-seat": () => {
    const L = window.__lp, st = L.state, B = L.streets.cities.ny.bridge;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    const q = {};
    L.stPointAt(B.deck, B.deck.len * 0.3, 1, B.deck.lo, q);
    const h = Math.atan2(-q.fx, -q.fz);
    return () => { L.api.clearStick(); st.x = q.x; st.z = q.z; st.y = B.top; st.heading = h; st.speed = 0; };
  },
  "ny-fountain-seat": () => {
    const L = window.__lp, st = L.state, S = L.streets.cities.ny.square;
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    const x = S.x - 26, z = S.z - 16, h = Math.atan2(-(S.x - x), -(S.z - z));
    const y = L.terrainMeshY(x, z) + L.CITY.sidewalkLift;
    return () => { L.api.clearStick(); st.x = x; st.z = z; st.y = y; st.heading = h; st.speed = 0; };
  },
  "ny-air": () => {
    const L = window.__lp, st = L.state, b = L.streets.cities.ny.data.bounds;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, x = cx + 380, z = cz + 520;
    const h = Math.atan2(-(cx - x), -(cz - z)), gy = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel);
    return () => { st.x = x; st.z = z; st.y = gy + 260; st.heading = h; st.pitch = -18; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.airVy = 0; };
  },
  "ca-air": () => {
    const L = window.__lp, st = L.state, b = L.streets.cities.ca.data.bounds;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, x = cx - 420, z = cz + 560;
    const h = Math.atan2(-(cx - x), -(cz - z)), gy = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel);
    return () => { st.x = x; st.z = z; st.y = gy + 260; st.heading = h; st.pitch = -18; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.airVy = 0; };
  },
};

// The perf vantage: the same place on both builds -- the busiest New York
// junction's stop line -- with a chase running. The old build has no streets,
// so it is placed by coordinate, not by the graph.
function perfVantage() {
  const L = window.__lp, st = L.state;
  // The old build's guardrail clamp pulls a car anywhere below the motorway's
  // height on to it (the bug this release fixes), which would put the "before"
  // camera 850 m from the junction. Off for the measurement, so both builds
  // draw the same place.
  if (!L.streets) L.CAR.railAt = 1e9;
  L.api.setVehicle("car"); L.api.spawnAt(0, 0);
  const x = window.__perfAt.x, z = window.__perfAt.z, h = window.__perfAt.h;
  st.x = x; st.z = z; st.heading = h; st.speed = 0;
  st.y = (L.stSurfaceAt && L.stSurfaceAt(x, z)) ?? L.terrainEff(x, z);
  if (L.policeStart) L.policeStart(null);
  return () => { L.api.clearStick(); st.x = x; st.z = z; st.heading = h; st.speed = 0; };
}

async function setup(pg, src, frames) {
  await pg.evaluate(([src, frames]) => {
    const L = window.__lp;
    performance.now = () => window.__simTime;
    L.api.skipScreens();
    window.__hold = eval("(" + src + ")")() || (() => {});
    for (let i = 0; i < frames; i++) { L.update(1 / 60); window.__hold(); }
  }, [src, frames]);
}

async function settle(pg, chase) {
  await pg.evaluate((c) => {
    const L = window.__lp;
    L.api.setView(c);
    for (let i = 0; i < 90; i++) { L.update(1 / 60); window.__hold(); }
    for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
  }, chase);
}

async function sample(pg, n) {
  return pg.evaluate((n) => {
    const L = window.__lp, r = L.renderer, gl = r.getContext(), px = new Uint8Array(4);
    r.info.autoReset = false;
    const ms = [];
    let calls = 0, tris = 0;
    for (let i = 0; i < n; i++) {
      r.info.reset();
      const t1 = globalThis.__realNow();
      window.__paint(); window.__hold();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(globalThis.__realNow() - t1);
      calls = r.info.render.calls; tris = r.info.render.triangles;
    }
    r.info.autoReset = true;
    return { ms, calls, tris };
  }, n);
}

const median = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srvA = serve(rootA, 8184), srvB = serve(rootB, 8185);
  const browser = await launch();
  const errors = [];
  // The first page a fresh SwiftShader browser opens comes up with its WebGL
  // context lost (the old build too): open one and throw it away.
  await (await openGame(browser, 8185, { width: 200, height: 200 })).close();

  // ---- the renders, on the new build
  for (const name of Object.keys(VANTAGES)) {
    const pg = await openGame(browser, 8185, { width: W, height: H, errors });
    await pg.evaluate(() => { globalThis.__realNow = performance.now.bind(performance); });
    await setup(pg, VANTAGES[name].toString(), 60 * 12);     // long enough for traffic to fill in
    await settle(pg, !/-seat$/.test(name));
    await pg.screenshot({ path: path.join(OUT, `${name}.png`) });
    await pg.close();
    console.log("wrote", name);
  }

  // ---- the frame cost at the busiest junction, with a chase, A/B interleaved
  const probe = await openGame(browser, 8185, { width: 400, height: 300 });
  const at = await probe.evaluate(() => {
    const L = window.__lp, C = L.streets.cities.ny;
    L.noRender = true; L.api.skipScreens();
    for (let i = 0; i < 5; i++) L.update(1 / 60);
    const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
    const n = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
    const arm = n.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
    L.stPointAt(r, dir > 0 ? r.len - 22 : 22, dir, r.lo, q);
    return { x: q.x, z: q.z, h: Math.atan2(-q.fx, -q.fz), node: [n.x, n.z] };
  });
  await probe.close();
  const perf = { when: new Date().toISOString(), viewport: `${W}x${H} @1x`, renderer: "SwiftShader (software), not an iPad",
                 at, runs: [] };
  for (let run = 0; run < 2; run++) {
    const pages = [];
    for (const port of [8184, 8185]) {
      const pg = await openGame(browser, port, { width: W, height: H, errors });
      await pg.evaluate((a) => { globalThis.__realNow = performance.now.bind(performance); window.__perfAt = a; }, at);
      await setup(pg, perfVantage.toString(), 60 * 12);
      pages.push(pg);
    }
    const res = {};
    for (const chase of [false, true]) {
      for (const pg of pages) await settle(pg, chase);
      for (const pg of pages) await sample(pg, 6);                 // warm both
      const acc = [[], []], last = [null, null];
      for (let round = 0; round < 8; round++) {
        for (const [i, pg] of pages.entries()) { const s = await sample(pg, 5); acc[i].push(...s.ms); last[i] = s; }
      }
      const cars = await pages[1].evaluate(() => ({ traffic: window.__lp.stTraffic.list.filter(v => v.alive).length,
                                                   police: window.__lp.police.active }));
      res[chase ? "chase" : "seat"] = {
        before: { ms: +median(acc[0]).toFixed(2), calls: last[0].calls, tris: last[0].tris },
        after: { ms: +median(acc[1]).toFixed(2), calls: last[1].calls, tris: last[1].tris }, ...cars };
    }
    perf.runs.push(res);
    for (const pg of pages) await pg.close();
    console.log("run", run, JSON.stringify(res));
  }
  perf.errors = errors.slice(0, 10);
  fs.writeFileSync(path.join(OUT, "perf.json"), JSON.stringify(perf, null, 1));
  await browser.close(); srvA.close(); srvB.close();
})();
