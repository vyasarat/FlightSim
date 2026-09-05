// ---------------------------------------------------------------------------
// The polish rig. Every polish pass is judged by this and nothing else:
//
//   node scripts/polish_check.js <tag>
//
// It renders the same four vantage points in both camera views, and times the
// three heaviest scenes in both views, writing:
//
//   qa-screenshots/polish/<tag>/<vantage>-<view>.png
//   qa-screenshots/polish/<tag>/perf.json
//
// A NOTE ON WHAT THE NUMBERS MEAN. This runs under swiftshader, a software
// rasteriser. Fill-rate and shadow-map cost there is nothing like an iPad's
// GPU -- swiftshader will over-punish a shadow map or a big additive sprite by
// an order of magnitude, and under-punish extra draw calls. So the honest
// budget instrument is three numbers side by side:
//
//   cpuMs    JS + draw-call submission per drawn frame  (maps to iPad fairly)
//   calls    draw calls per frame                       (the real GPU proxy)
//   tris     triangles per frame                        (ditto)
//
// "Costs more than ~15% frame time" is read off calls/tris and cpuMs together,
// with shadow-map passes counted explicitly (renderer.info.render.calls
// includes every shadow pass, which is exactly what we want to see).
// ---------------------------------------------------------------------------

const http = require("http"), fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TAG = process.argv[2] || "scratch";
const OUT = path.join(ROOT, "qa-screenshots", "polish", TAG);
const PORT = 8181;
const W = 1180, H = 760;

const MIME = { ".js": "application/javascript", ".html": "text/html", ".json": "application/json", ".css": "text/css", ".png": "image/png" };

function serve(root = ROOT, port = PORT) {
  const realRoot = fs.realpathSync(root);
  const contained = f => {
    const rel = path.relative(realRoot, f);
    return rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
  };
  return http.createServer(async (req, res) => {
    const end = code => { res.writeHead(code); res.end(); };
    let p;
    try {
      // Decode before resolving; URL normalization must not erase traversal.
      if (!req.url.startsWith("/")) return end(400);
      p = decodeURIComponent(req.url.split("?")[0]);
      if (p.includes("\0") || p.includes("\\")) return end(400);
    } catch (_) { return end(400); }
    if (p.endsWith("/")) p += "index.html";
    const f = path.resolve(realRoot, "." + p);
    if (!contained(f)) return end(403);
    try {
      const realFile = await fs.promises.realpath(f);
      if (!contained(realFile)) return end(403);
      const data = await fs.promises.readFile(realFile);
      res.writeHead(200, { "Content-Type": MIME[path.extname(realFile)] || "text/plain" });
      res.end(data);
    } catch (_) { end(404); }
  }).listen(port, "127.0.0.1");
}
module.exports = { serve };

// ---- the four vantage points, as page-side setup functions -----------------
// Each returns nothing; the rig then settles the camera and shoots.
const VANTAGES = {
  runway: () => {
    const L = window.__lp;
    L.api.skipScreens(); L.api.setVehicle("prop"); L.api.placeOnRunway();
    for (let i = 0; i < 120; i++) L.update(1 / 60);
  },
  canyon: () => {
    const L = window.__lp, st = L.state;
    L.api.skipScreens(); L.api.setVehicle("prop"); L.api.placeOnRunway();
    const zc = -3800 * L.ROUTE_SCALE_V;
    st.phase = "AIRBORNE";
    // fly it in place: re-pin every frame so the chase camera settles behind it
    for (let i = 0; i < 150; i++) {
      st.x = 0; st.z = zc + 220; st.y = 150; st.heading = Math.PI; st.pitch = 0; st.bank = 0;
      st.speed = st.vp.cruiseSpeed; st.airVy = 0;
      L.update(1 / 60);
    }
    st.x = 0; st.z = zc + 220; st.y = 150; st.heading = Math.PI;
  },
  mars: () => {
    const L = window.__lp, st = L.state;
    L.api.skipScreens(); L.api.setVehicle("starship"); L.api.placeOnRunway();
    const b = L.BODIES[1];
    st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
    const n = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
    st.x = b.x + n.x * (b.r + 12); st.y = b.y + n.y * (b.r + 12); st.z = b.z + n.z * (b.r + 12);
    L.update(1 / 60);
    L.roverDeploy();
    // drive out a little so the base is in front of him, not on top of him
    for (let i = 0; i < 60 * 3; i++) { L.api.setThrottle(true); L.update(1 / 60); }
    L.api.setThrottle(false);
    for (let i = 0; i < 150; i++) L.update(1 / 60);
  },
  carrier: () => {
    const L = window.__lp, st = L.state, CV = L.CV;
    L.api.skipScreens(); L.api.setVehicle("jet"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    for (let i = 0; i < 150; i++) {
      st.x = CV.at.x + 240; st.z = CV.at.z + 420; st.y = 150;
      st.heading = Math.atan2(-(CV.at.x - st.x), -(CV.at.z - st.z));
      st.pitch = -6; st.bank = 0; st.speed = st.vp.cruiseSpeed * 0.6; st.airVy = 0;
      L.update(1 / 60);
    }
  },
};

// ---- the three heaviest scenes, for timing ---------------------------------
const HEAVY = {
  "station+meteors": () => {
    const L = window.__lp, st = L.state;
    L.api.skipScreens(); L.api.setVehicle("rocket"); L.api.placeOnRunway();
    L.eventsForce("meteors");
    st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
    st.y = 4000; st.pitch = 10; st.spaceF = 1;
    L.station.visible = true;
    const park = () => { L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; };
    for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); park(); }
    return park;
  },
  "mars-base": () => {
    const L = window.__lp, st = L.state;
    L.api.skipScreens(); L.api.setVehicle("starship"); L.api.placeOnRunway();
    const b = L.BODIES[1];
    st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
    const n = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
    st.x = b.x + n.x * (b.r + 12); st.y = b.y + n.y * (b.r + 12); st.z = b.z + n.z * (b.r + 12);
    L.update(1 / 60);
    L.roverDeploy();
    for (let i = 0; i < 60 * 3; i++) { L.api.setThrottle(true); L.update(1 / 60); }
    L.api.setThrottle(false);
    for (let i = 0; i < 150; i++) L.update(1 / 60);
    return () => { L.rover.speed = 0; };
  },
  "carrier+fire": () => {
    const L = window.__lp, st = L.state, FF = L.FF;
    L.api.skipScreens(); L.api.setVehicle("heli"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    const hold = () => {
      st.x = FF.rig.x + 150; st.z = FF.rig.z + 260; st.y = 90;
      st.heading = Math.atan2(-(FF.rig.x - st.x), -(FF.rig.z - st.z));
    };
    for (let i = 0; i < 60 * 4; i++) { hold(); L.update(1 / 60); }
    return hold;
  },
};

if (require.main === module) (async () => {
  const { chromium } = require("playwright-core");
  fs.mkdirSync(OUT, { recursive: true });
  const srv = serve();
  let browserRef = null;
  process.on("uncaughtException", async (e) => {
    console.error("FAILED:", e.message);
    try { if (browserRef) await browserRef.close(); } catch (_) {}
    srv.close(); process.exit(1);
  });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_HEADLESS_SHELL,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
           "--disable-dev-shm-usage", "--js-flags=--max-old-space-size=512"],
  });
  browserRef = browser;
  const errors = [];
  const perf = { tag: TAG, when: new Date().toISOString(), vantages: {}, heavy: {} };

  const newPage = async () => {
    const pg = await browser.newPage({ viewport: { width: W, height: H } });
    await pg.addInitScript(`window.__rafQueue=[];window.__simTime=0;window.requestAnimationFrame=cb=>{__rafQueue.push(cb);return __rafQueue.length;};`);
    pg.on("pageerror", (e) => errors.push(String(e.message)));
    // this box can be under real memory pressure; a cold swiftshader start is slow
    await pg.goto(`http://127.0.0.1:${PORT}/cockpit/index.html`, { timeout: 120000 });
    await pg.waitForFunction(() => window.__lp && window.__lp.state, null, { timeout: 120000 });
    await pg.evaluate(() => {
      window.__lp.noRender = true;
      // ROUTE_SCALE is a function in page scope; expose its value for the setups
      window.__lp.ROUTE_SCALE_V = (typeof ROUTE_SCALE === "function" ? ROUTE_SCALE() : 1) || 1;
      window.__paint = () => {
        window.__lp.noRender = false;
        const q = window.__rafQueue; window.__rafQueue = [];
        window.__simTime += 1000 / 60;
        if (q.length) q[q.length - 1](window.__simTime);
        window.__lp.noRender = true;
      };
    });
    return pg;
  };

  // ---------- the four vantage points, both views ----------
  for (const [name, setup] of Object.entries(VANTAGES)) {
    const pg = await newPage();
    await pg.evaluate(setup);
    for (const chase of [true, false]) {
      await pg.evaluate((c) => { window.__lp.api.setView(c); for (let i = 0; i < 100; i++) window.__lp.update(1 / 60); }, chase);
      await pg.evaluate(() => { for (let i = 0; i < 3; i++) window.__paint(); });
      const view = chase ? "chase" : "cockpit";
      await pg.screenshot({ path: path.join(OUT, `${name}-${view}.png`) });
      console.log(`shot ${name}-${view}`);
    }
    perf.vantages[name] = await pg.evaluate(() => ({
      calls: window.__lp.renderer.info.render.calls,
      tris: window.__lp.renderer.info.render.triangles,
      programs: window.__lp.renderer.info.programs.length,
      geometries: window.__lp.renderer.info.memory.geometries,
      textures: window.__lp.renderer.info.memory.textures,
    }));
    await pg.close();
  }

  // ---------- the three heaviest scenes, both views ----------
  for (const [name, setup] of Object.entries(HEAVY)) {
    const pg = await newPage();
    const out = {};
    for (const chase of [true, false]) {
      await pg.evaluate((c) => { window.__lp.api.setView(c); }, chase);
      const r = await pg.evaluate(async (setupSrc) => {
        const L = window.__lp;
        const hold = eval("(" + setupSrc + ")")() || (() => {});
        const sim = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { L.update(1 / 60); hold(); } return (performance.now() - t0) / n; };
        const draw = (n) => {
          L.noRender = false;
          const t0 = performance.now();
          for (let i = 0; i < n; i++) {
            const q = window.__rafQueue; window.__rafQueue = [];
            window.__simTime += 1000 / 60;
            if (q.length) q[q.length - 1](window.__simTime);
            hold();
          }
          const ms = (performance.now() - t0) / n;
          L.noRender = true;
          return ms;
        };
        const med = (f, n) => { const a = []; for (let i = 0; i < n; i++) a.push(f()); a.sort((x, y) => x - y); return a[n >> 1]; };
        sim(60); draw(20);                       // warm
        const simMs = med(() => sim(120), 3);
        L.renderer.info.reset();
        const cpuMs = med(() => draw(45), 3);
        const info = L.renderer.info;
        const calls = info.render.calls, tris = info.render.triangles;
        // A/B the shadow pass in place, INTERLEAVED. Measuring one block of
        // samples then the other let this box's own drift swing the answer by ten
        // percentage points -- it once priced a layer at +19% that alternating
        // sampling then showed to be free. Toggling shadowMap.enabled forces a
        // material recompile, so each side gets its own warm-up before it counts.
        const wasOn = L.renderer.shadowMap.enabled;
        const flush = () => L.scene.traverse(o => { if (o.isMesh && o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
        const sOn = [], sOff = [];
        for (let i = 0; i < 3; i++) {
          L.renderer.shadowMap.enabled = true; flush(); draw(15); sOn.push(draw(30));
          L.renderer.shadowMap.enabled = false; flush(); draw(15); sOff.push(draw(30));
        }
        sOn.sort((x, y) => x - y); sOff.sort((x, y) => x - y);
        const withShadow = sOn[1], noShadowMs = sOff[1];
        const noShadowCalls = L.renderer.info.render.calls;
        // ... and the same A/B for every additive layer the atmosphere pass added.
        // INTERLEAVED, not in blocks: this box drifts enough between two blocks of
        // samples to swing a percentage by ten points, and alternating cancels it.
        const glows = [];
        L.scene.traverse(o => {
          if ((o.isSprite || o.isPoints) && o.material && o.material.blending === 2 && o.visible) glows.push(o);
        });
        const on = [], off = [];
        for (let i = 0; i < 5; i++) {
          for (const o of glows) o.visible = true;
          on.push(draw(30));
          for (const o of glows) o.visible = false;
          off.push(draw(30));
        }
        for (const o of glows) o.visible = true;
        on.sort((x, y) => x - y); off.sort((x, y) => x - y);
        const withGlow = on[2], noGlowMs = off[2];
        L.renderer.shadowMap.enabled = wasOn;
        L.scene.traverse(o => { if (o.isMesh && o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
        draw(20);
        return {
          simMs: +simMs.toFixed(3),
          cpuMs: +cpuMs.toFixed(2),
          noShadowMs: +noShadowMs.toFixed(2),
          shadowPct: +(((withShadow - noShadowMs) / noShadowMs) * 100).toFixed(1),
          calls, tris,
          noGlowMs: +noGlowMs.toFixed(2),
          glowPct: +(((withGlow - noGlowMs) / noGlowMs) * 100).toFixed(1),
          glowObjects: glows.length,
          shadowCalls: calls - noShadowCalls,
          programs: info.programs.length,
        };
      }, setup.toString());
      out[chase ? "chase" : "cockpit"] = r;
    }
    perf.heavy[name] = out;
    console.log(`timed ${name}`);
    await pg.close();
  }

  perf.errors = errors.slice(0, 8);
  fs.writeFileSync(path.join(OUT, "perf.json"), JSON.stringify(perf, null, 2));
  await browser.close();
  srv.close();

  // ---- readable summary ----
  console.log(`\n=== ${TAG} ===`);
  for (const [k, v] of Object.entries(perf.heavy)) {
    for (const view of ["chase", "cockpit"]) {
      const r = v[view];
      const sh = r.noShadowMs === undefined ? "" : `   shadow +${String(r.shadowPct).padStart(5)}%   glow +${String(r.glowPct).padStart(5)}% (${r.glowObjects})`;
      console.log(`  ${k.padEnd(16)} ${view.padEnd(8)} cpu ${String(r.cpuMs).padStart(7)} ms   sim ${String(r.simMs).padStart(6)} ms   calls ${String(r.calls).padStart(5)}   tris ${String(r.tris).padStart(8)}${sh}`);
    }
  }
  for (const [k, v] of Object.entries(perf.vantages)) {
    console.log(`  vantage ${k.padEnd(10)} calls ${String(v.calls).padStart(5)}   tris ${String(v.tris).padStart(8)}   progs ${v.programs}`);
  }
  if (errors.length) console.log("  PAGE ERRORS:", errors.slice(0, 4));
})();
