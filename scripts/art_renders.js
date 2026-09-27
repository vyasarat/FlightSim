"use strict";
// The art sprint's evidence: eight vantage points, both views, portrait, on
// two builds side by side, with the frame cost of each.
//
//   node scripts/art_renders.js <beforeRoot> <afterRoot> [only,vantages]
//
// Each root is a directory holding a cockpit/ (the repo itself, or a snapshot
// of an older build). Writes evidence/art/<before|after>/<vantage>-<view>.png
// and evidence/art/perf.json.
//
// WHAT THE NUMBERS ARE. SwiftShader, a software rasteriser, at 820x1180 and a
// device pixel ratio of 1 -- not an iPad. `frameMs` is a whole frame INCLUDING
// the raster (each timed frame ends in a 1-pixel readPixels, which cannot
// return until the GPU side has finished), so it over-prices fill and shadow
// maps the way SwiftShader always does. `calls` and `tris` are the numbers that
// transfer: they count the whole frame, the shadow pass included.
//
// The two builds are timed INTERLEAVED, sample by sample, never in blocks: this
// machine drifts enough between two blocks to swing a comparison by ten points.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const [rootA, rootB] = process.argv.slice(2, 4).map(p => path.resolve(p));
const ONLY = process.argv[4] ? process.argv[4].split(",") : null;
const OUT = path.resolve(__dirname, "..", "evidence", "art");
const TAGS = ["before", "after"];
const W = 820, H = 1180;

// ---- the eight vantage points. Each returns a `hold` run after every update,
// so the chase camera settles on something that is not drifting away.
const VANTAGES = {
  "ny-runway": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    // the south end of the New York runway, looking across the harbour: from
    // the spawn at the north end the skyline is 2.5 km off, deep in the fog
    const s = L.ROUTE_LANDMARKS.find(n => n.name === "skyline");
    const B = L.cities && L.cities.ny && L.cities.ny.data.bounds;   // the district's middle, where there is one
    const c = B ? { x: (B[0] + B[2]) / 2, z: (B[1] + B[3]) / 2 } : s;
    const x = 0, z = L.AIRPORTS[0].cz - L.TUNE.runwayLength / 2 + 60;
    const h = Math.atan2(-(c.x - x), -(c.z - z));
    return () => { st.x = x; st.z = z; st.heading = h; st.speed = 0; };
  },
  "ny-300m": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    const c = L.ROUTE_LANDMARKS.find(n => n.name === "skyline");
    st.phase = "AIRBORNE";
    const x = c.x + 520, z = c.z + 780;
    const gy = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel);
    const h = Math.atan2(-(c.x - x), -(c.z - z));
    return () => {
      st.x = x; st.z = z; st.y = gy + 300; st.heading = h; st.pitch = -8; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.airVy = 0;
    };
  },
  // not one of the eight: the only look at the California city
  "ca-300m": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    const c = L.ROUTE_LANDMARKS.find(n => n.name === "downtown");
    st.phase = "AIRBORNE";
    const x = c.x - 700, z = c.z + 700;
    const gy = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel);
    const h = Math.atan2(-(c.x - x), -(c.z - z));
    return () => {
      st.x = x; st.z = z; st.y = gy + 300; st.heading = h; st.pitch = -10; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.airVy = 0;
    };
  },
  "highway-car": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.placeOnRunway();
    for (let i = 0; i < 60 * 24; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    const px = st.x, pz = st.z, py = st.y, ph = st.heading;
    return () => { L.api.clearStick(); st.x = px; st.z = pz; st.y = py; st.heading = ph; st.speed = 0; };
  },
  "tunnel-portal": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.placeOnRunway();
    const s0 = L.hwyNearest(st.x, st.z).s;
    for (let i = 0; i < 120; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
    const dir = Math.sign(L.hwyNearest(st.x, st.z).s - s0) || 1;
    // the first portal ahead of him, with room to see it coming
    const here = L.hwyNearest(st.x, st.z).s;
    let sB = null;
    for (const b of L.hwyBores) {
      for (const p of [b.pts[0], b.pts[b.pts.length - 1]]) {
        const s = L.hwyNearest(p.x, p.z).s, ahead = (s - here) * dir;
        if (ahead > 400 && (sB === null || ahead < (sB - here) * dir)) sB = s;
      }
    }
    for (let i = 0; i < 60 * 900 && sB !== null; i++) {
      L.api.setStick(0, 0); L.update(1 / 60);
      if ((sB - L.hwyNearest(st.x, st.z).s) * dir < 260) break;
    }
    const px = st.x, pz = st.z, py = st.y, ph = st.heading;
    return () => { L.api.clearStick(); st.x = px; st.z = pz; st.y = py; st.heading = ph; st.speed = 0; };
  },
  "harbour": () => {
    // in the basin, bow on to the container terminal: quays, stacks, cranes, ship
    const L = window.__lp, st = L.state, T = L.HB.terminal;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    for (let i = 0; i < 30; i++) L.update(1 / 60);
    const x = T.x + 170, z = T.z - T.quayD / 2 - 230;
    const h = Math.atan2(-(T.x - x), -(T.z - z));
    return () => { L.api.clearStick(); st.x = x; st.z = z; st.y = L.seaLevelAt(x, z); st.heading = h; st.speed = 0; };
  },
  "carrier": () => {
    const L = window.__lp, st = L.state, CV = L.CV;
    L.api.setVehicle("jet"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    return () => {
      st.x = CV.at.x + 240; st.z = CV.at.z + 420; st.y = 150;
      st.heading = Math.atan2(-(CV.at.x - st.x), -(CV.at.z - st.z));
      st.pitch = -6; st.bank = 0; st.speed = st.vp.cruiseSpeed * 0.6; st.airVy = 0;
    };
  },
  "mars-base": () => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("starship"); L.api.placeOnRunway();
    const b = L.BODIES[1];
    st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
    const n = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
    st.x = b.x + n.x * (b.r + 12); st.y = b.y + n.y * (b.r + 12); st.z = b.z + n.z * (b.r + 12);
    L.update(1 / 60);
    L.roverDeploy();
    for (let i = 0; i < 60 * 3; i++) { L.api.setThrottle(true); L.update(1 / 60); }
    L.api.setThrottle(false);
    return () => { L.rover.speed = 0; };
  },
  "demolition": () => {
    const L = window.__lp, st = L.state, D = L.demo;
    L.api.setVehicle("prop"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    const x = D.x - 260, z = D.z + 330;
    const gy = Math.max(L.terrainEff(x, z), L.TUNE.waterLevel);
    const h = Math.atan2(-(D.x - x), -(D.z - z));
    return () => {
      st.x = x; st.z = z; st.y = gy + 110; st.heading = h; st.pitch = -10; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.airVy = 0;
    };
  },
};

async function setup(pg, name) {
  await pg.evaluate((src) => {
    const L = window.__lp;
    performance.now = () => window.__simTime;      // the pulses read this clock
    L.api.skipScreens();
    window.__hold = eval("(" + src + ")")() || (() => {});
    for (let i = 0; i < 120; i++) { L.update(1 / 60); window.__hold(); }
  }, VANTAGES[name].toString());
}

async function settleView(pg, chase) {
  await pg.evaluate((c) => {
    const L = window.__lp;
    L.api.setView(c);
    for (let i = 0; i < 150; i++) { L.update(1 / 60); window.__hold(); }
    for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
  }, chase);
}

// n frames, each forced to completion, and the counters of the last one
async function sample(pg, n) {
  return pg.evaluate((n) => {
    const L = window.__lp, r = L.renderer, gl = r.getContext();
    const px = new Uint8Array(4);
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
  const srvA = serve(rootA, 8184), srvB = serve(rootB, 8185);
  const browser = await launch();
  const errors = { before: [], after: [] };
  const perf = { when: new Date().toISOString(), viewport: `${W}x${H} @1x`, renderer: "SwiftShader (software), not an iPad", vantages: {} };
  const perfPath = path.join(OUT, "perf.json");
  try { Object.assign(perf.vantages, JSON.parse(fs.readFileSync(perfPath, "utf8")).vantages || {}); } catch (_) {}
  for (const t of TAGS) fs.mkdirSync(path.join(OUT, t), { recursive: true });

  for (const name of Object.keys(VANTAGES)) {
    if (ONLY && !ONLY.includes(name)) continue;
    const pages = [];
    for (const [i, port] of [8184, 8185].entries()) {
      const pg = await openGame(browser, port, { width: W, height: H, errors: errors[TAGS[i]] });
      await pg.evaluate(() => { const rn = performance.now.bind(performance); globalThis.__realNow = rn; });
      await setup(pg, name);
      pages.push(pg);
    }
    perf.vantages[name] = {};
    for (const chase of [true, false]) {
      const view = chase ? "chase" : "cockpit";
      for (const [i, pg] of pages.entries()) {
        await settleView(pg, chase);
        await pg.screenshot({ path: path.join(OUT, TAGS[i], `${name}-${view}.png`) });
      }
      // warm both, then alternate: A, B, A, B ...
      for (const pg of pages) await sample(pg, 6);
      const acc = [[], []];
      let last = [null, null];
      for (let round = 0; round < 6; round++) {
        for (const [i, pg] of pages.entries()) {
          const s = await sample(pg, 5);
          acc[i].push(...s.ms); last[i] = s;
        }
      }
      perf.vantages[name][view] = {};
      for (const i of [0, 1]) {
        perf.vantages[name][view][TAGS[i]] = {
          frameMs: +median(acc[i]).toFixed(1), calls: last[i].calls, tris: last[i].tris,
          frameErrors: await pages[i].evaluate(() => window.__lp.frameErrors || 0),
        };
      }
      const a = perf.vantages[name][view].before, b = perf.vantages[name][view].after;
      console.log(`${name.padEnd(14)} ${view.padEnd(8)} before ${String(a.frameMs).padStart(6)} ms ${String(a.calls).padStart(4)} calls ${String(a.tris).padStart(7)} tris | after ${String(b.frameMs).padStart(6)} ms ${String(b.calls).padStart(4)} calls ${String(b.tris).padStart(7)} tris`);
    }
    for (const pg of pages) await pg.close();
    fs.writeFileSync(perfPath, JSON.stringify(perf, null, 2));
  }
  perf.errors = { before: errors.before.slice(0, 6), after: errors.after.slice(0, 6) };
  fs.writeFileSync(perfPath, JSON.stringify(perf, null, 2));
  if (errors.before.length || errors.after.length) console.log("PAGE ERRORS", perf.errors);
  await browser.close(); srvA.close(); srvB.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
