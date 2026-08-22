#!/usr/bin/env node
/*
Headless verification for the cockpit build.

Requires:
  - CHROME_HEADLESS_SHELL env var pointing at a chrome-headless-shell binary
  - playwright-core resolvable (npm i playwright-core)
  - python3 available (used only to serve static files locally)

Usage: CHROME_HEADLESS_SHELL=/path/to/shell node scripts/headless_test.js
*/
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..", "cockpit");
const SHOTS = path.resolve(__dirname, "..", "qa-screenshots");
const PORT = 8177;
const URL = `http://127.0.0.1:${PORT}/index.html`;
const SHELL = process.env.CHROME_HEADLESS_SHELL;

function waitForServer(url, tries) {
  tries = tries || 60;
  return new Promise((resolve, reject) => {
    const attempt = n => {
      const req = http.get(url, res => { res.resume(); resolve(); });
      req.on("error", () => {
        if (n <= 0) reject(new Error("server never came up"));
        else setTimeout(() => attempt(n - 1), 120);
      });
    };
    attempt(tries);
  });
}

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

(async () => {
  if (!SHELL) {
    console.error("Set CHROME_HEADLESS_SHELL to a chrome-headless-shell binary");
    process.exit(1);
  }
  fs_mkdir(SHOTS);
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  process.on("exit", () => server.kill());
  await new Promise(r => setTimeout(r, 500));
  await waitForServer(URL);

  const browser = await chromium.launch({
    executablePath: SHELL,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });

  async function newPage(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
    await page.addInitScript(`
      window.__rafQueue = [];
      window.__simTime = 0;
      window.requestAnimationFrame = cb => { __rafQueue.push(cb); return __rafQueue.length; };
    `);
    await page.goto(URL);
    await page.waitForFunction(() => !!window.__lp, null, { timeout: 15000 });
    await page.evaluate(() => window.__lp.api.skipScreens());
    return { ctx, page, errors };
  }

  async function pump(page, seconds) {
    await page.evaluate(s => {
      const frames = Math.round(s * 60);
      for (let i = 0; i < frames; i++) {
        const q = window.__rafQueue.splice(0);
        if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
      }
    }, seconds);
  }

  async function snapState(page) {
    return page.evaluate(() => {
      const s = window.__lp.state;
      const out = {};
      for (const k in s) if (typeof s[k] === "number") out[k] = +s[k].toFixed(2);
      return {
        phase: s.phase,
        finite: Object.values(s).every(v => typeof v !== "number" || isFinite(v)),
        flags: { ...window.__lp.flags },
        ...out
      };
    });
  }

  // ---------- T1/T2 overlay layout ----------
  for (const [w, h, label] of [[1180, 820, "landscape"], [820, 1180, "portrait"]]) {
    const { page, errors } = await newPage(w, h);
    check(`${label}: boots without errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    const layout = await page.evaluate(() => {
      const ids = ["dash", "asiDial", "aiDial", "altDial", "brow"];
      const out = {};
      for (const id of ids) {
        const r = document.getElementById(id).getBoundingClientRect();
        out[id] = { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
      }
      out.hudPE = getComputedStyle(document.getElementById("hud")).pointerEvents;
      out.btnVisible = !document.getElementById("throttleBtn").classList.contains("hidden")
        && document.getElementById("throttleBtn").getBoundingClientRect().width >= 80;
      out.btnPE = getComputedStyle(document.getElementById("throttleBtn")).pointerEvents !== "none";
      return out;
    });
    const dashOk = layout.dash.b > h * 0.72 && layout.dash.l <= 2 && layout.dash.r >= w - 2 && layout.dash.h >= 80;
    check(`${label}: dashboard spans width, pinned low`, dashOk, JSON.stringify(layout.dash));
    const dialsOk = ["asiDial", "aiDial", "altDial"].every(id =>
      layout[id].w > 60 && layout[id].h > 60 &&
      layout[id].t >= 0 && layout[id].b <= h + 1 &&
      layout[id].l >= -1 && layout[id].r <= w + 1);
    check(`${label}: three dials fully on-screen (>60px)`, dialsOk);
    check(`${label}: hud ignores pointers / button interactive`, layout.hudPE === "none" && layout.btnPE && layout.btnVisible);
    await page.screenshot({ path: path.join(SHOTS, `cockpit-${label}.png`) });
    await page.close();
  }

  // ---------- T3 takeoff safety (never pulls up) ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    let sawVr = false;
    for (let i = 0; i < 80 && !sawVr; i++) {
      sawVr = await page.evaluate(() =>
        window.__lp.state.speed >= window.__lp.TUNE.rotateSpeed || window.__lp.flags.repositioned > 0);
      if (!sawVr) await pump(page, 0.5);
    }
    check("takeoff: reaches rotation speed on throttle alone", sawVr);
    await pump(page, 50);
    const st = await snapState(page);
    check("takeoff: no-pull rolls off end, stops, resets safely",
      st.flags.liftoff === 0 && st.flags.repositioned >= 1 && st.finite && st.y < 30,
      `phase=${st.phase} liftoff=${st.flags.liftoff} repos=${st.flags.repositioned}`);
    await page.close();
  }

  // ---------- T4 takeoff with real pointer input ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.placeOnRunway(); });
    const btn = await page.locator("#throttleBtn").boundingBox();
    await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await page.mouse.down();
    await pump(page, 0.3);
    const pressed = await page.evaluate(() => document.getElementById("throttleBtn").classList.contains("pressed"));
    check("takeoff: throttle button press registered visually", pressed);

    let atVr = false;
    for (let i = 0; i < 60 && !atVr; i++) {
      atVr = await page.evaluate(() => window.__lp.state.speed >= window.__lp.TUNE.rotateSpeed);
      if (!atVr) await pump(page, 0.25);
    }
    const arrowOn = await page.evaluate(() => document.getElementById("rotateArrow").classList.contains("on"));
    check("takeoff: rotate arrow appears at Vr", arrowOn);

    await page.mouse.up();
    const cx = 590, cy = 400;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 160, { steps: 6 });
    await page.mouse.move(cx, cy - 320, { steps: 6 });

    let airborne = false;
    for (let i = 0; i < 40 && !airborne; i++) {
      airborne = await page.evaluate(() => window.__lp.flags.liftoff > 0 && window.__lp.state.phase === "AIRBORNE");
      if (!airborne) await pump(page, 0.25);
    }
    const dbg = await page.evaluate(() => {
      const s = window.__lp.state;
      return `touching=${s.touching} ctrlPitch=${s.ctrlPitch.toFixed(2)} phase=${s.phase} speed=${s.speed.toFixed(1)} pull=${s.rotatePullTime.toFixed(2)}`;
    });
    check("takeoff: drag-up lifts off into AIRBORNE", airborne, dbg);
    await pump(page, 4);
    const st = await snapState(page);
    check("takeoff: climbing after liftoff", st.y > 25 && st.pitch > 0 && st.finite,
      `alt=${st.y} pitch=${st.pitch}`);
    await page.mouse.up();
    await page.close();
  }

  // ---------- T5 sloppy approach lands ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    const repos0 = await page.evaluate(() => window.__lp.flags.repositioned);
    await page.evaluate(() => window.__lp.api.teleportAirborne(500, 100, 60, 20));
    await page.evaluate(() => window.__lp.api.setStick(0, -0.16));
    let landed = false;
    for (let i = 0; i < 240 && !landed; i++) {
      landed = await page.evaluate(() => window.__lp.flags.touchdown > 0);
      if (!landed) await pump(page, 0.5);
    }
    const st = await snapState(page);
    check("landing: sloppy approach touches down successfully",
      landed && st.finite,
      `phase=${st.phase} td=${st.flags.touchdown} miss=${st.flags.missed}`);
    await pump(page, 12);
    const st2 = await snapState(page);
    check("landing: rollout -> celebrate -> reset to takeoff",
      st2.flags.repositioned > repos0 && st2.phase === "TAXI",
      `phase=${st2.phase} repos=${st2.flags.repositioned - repos0}`);
    const engNorm = await page.evaluate(() => window.__lp.engineNorm);
    check("engine: cuts to silent when parked", engNorm === 0, `norm=${engNorm}`);
    await page.close();
  }

  // ---------- T6 missed approach climbs away ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => window.__lp.api.teleportAirborne(260, 260, 22, 0));
    let missed = false;
    let minAgl = Infinity;
    for (let i = 0; i < 90 && !missed; i++) {
      const agl = await page.evaluate(() => {
        const s = window.__lp.state;
        return s.y - Math.max(window.__lp.terrainEff(s.x, s.z), window.__lp.TUNE.waterLevel);
      });
      minAgl = Math.min(minAgl, agl);
      missed = await page.evaluate(() => window.__lp.flags.missed > 0);
      if (!missed) await pump(page, 0.5);
    }
    check("landing: miss triggers silent go-around", missed);
    for (let i = 0; i < 10; i++) {
      const agl = await page.evaluate(() => {
        const s = window.__lp.state;
        return s.y - Math.max(window.__lp.terrainEff(s.x, s.z), window.__lp.TUNE.waterLevel);
      });
      minAgl = Math.min(minAgl, agl);
      await pump(page, 0.5);
    }
    check("go-around: never sinks underground", minAgl > -0.5, `minAgl=${minAgl.toFixed(2)}`);
    await pump(page, 5);
    const st = await snapState(page);
    check("go-around: returns to free flight climbing",
      st.phase === "AIRBORNE" && st.y > 45 && st.finite,
      `phase=${st.phase} alt=${st.y}`);
    await page.close();
  }

  // ---------- T-B vehicles ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.placeOnRunway(); });

    const bootOk = await page.evaluate(() => {
      const sv = document.getElementById("screenVehicle");
      sv.classList.remove("hiddenS");
      const cards = [...sv.querySelectorAll(".card")];
      if (cards.length !== 6) return { ok: false, why: "count" };
      const sized = cards.every(c => {
        const r = c.getBoundingClientRect();
        return r.width >= 100 && r.height >= 100;
      });
      return { ok: sized, why: "size" };
    });
    check("vehicles: picker present at boot, six cards >= 100px", bootOk.ok, bootOk.why);

    const combos = await page.evaluate(() => {
      const vs = Object.values(window.__lp.TUNE.vehicles);
      return { n: vs.length, uniq: new Set(vs.map(v => v.cruiseSpeed + "|" + v.turnRateDeg + "|" + v.pitchLimitDeg)).size };
    });
    check("vehicles: six defined, airliners share stats by design",
      combos.n === 6 && combos.uniq === 4, `n=${combos.n} uniq=${combos.uniq}`);

    const vpBefore = await page.evaluate(() => window.__lp.state.vp.cruiseSpeed);
    await page.evaluate(() => {
      document.getElementById("screenDir").classList.add("hiddenS");
      document.getElementById("screenVehicle").classList.remove("hiddenS");
    });
    await page.click('[data-v="rocket"]');
    const dirShown = await page.evaluate(() =>
      !document.getElementById("screenDir").classList.contains("hiddenS"));
    check("vehicles: vehicle tap opens direction screen", dirShown);

    await page.click('[data-d="1"]');
    await pump(page, 0.3);
    const sel = await page.evaluate(() => ({
      key: window.__lp.state.vehicleKey,
      cs: window.__lp.state.vp.cruiseSpeed,
      heading: window.__lp.state.heading,
      z: window.__lp.state.z,
      screensGone: document.getElementById("screenVehicle").classList.contains("hiddenS")
        && document.getElementById("screenDir").classList.contains("hiddenS"),
      accent: getComputedStyle(document.documentElement).getPropertyValue("--veh").trim()
    }));
    check("vehicles: selection applies (rocket, northbound spawn)",
      sel.key === "rocket" && sel.cs === 112 && Math.abs(sel.heading - Math.PI) < 0.01 &&
      sel.z < 0 && sel.screensGone && sel.accent === "#b8bec9",
      JSON.stringify(sel));
    void vpBefore;

    await page.evaluate(() => window.__lp.api.setThrottle(true));
    let air = false;
    for (let i = 0; i < 80 && !air; i++) {
      air = await page.evaluate(() => window.__lp.flags.liftoff > 0);
      if (!air) await pump(page, 0.25);
    }
    await page.evaluate(() => window.__lp.api.setStick(0, -0.5));
    let spd = 0;
    for (let i = 0; i < 20; i++) {
      spd = await page.evaluate(() => window.__lp.state.speed);
      if (spd > 100) break;
      await pump(page, 0.5);
    }
    check("vehicles: rocket reaches its higher cruise speed", spd > 100, `speed=${spd.toFixed(1)}`);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-D space ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    let air = false, simSecs = 0;
    while (simSecs < 30 && !air) {
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.85));
      await pump(page, 0.5); simSecs += 0.5;
      if (canRot) {
        air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
        if (air) await page.evaluate(() => window.__lp.api.setStick(0, 0.85));
      }
    }
    check("space: rocket climbs with stick held", air);
    let inSpace = false;
    while (simSecs < 90 && !inSpace) {
      inSpace = await page.evaluate(() => window.__lp.state.spaceF > 0.9);
      if (!inSpace) await pump(page, 1); simSecs += 1;
    }
    check("space: rocket reaches space blend", inSpace,
      `spaceF=${(await page.evaluate(() => window.__lp.state.spaceF)).toFixed(2)}`);
    await page.evaluate(() => window.__lp.api.clearStick());
    await pump(page, 3);
    await page.evaluate(() => window.__lp.api.setStick(0, -0.7));
    let back = false;
    while (simSecs < 150 && !back) {
      back = await page.evaluate(() => window.__lp.state.spaceF < 0.15);
      if (!back) await pump(page, 1); simSecs += 1;
    }
    check("space: dive returns to sky", back);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.setVehicle("prop"); window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    let air = false, simSecs = 0;
    while (simSecs < 30 && !air) {
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.9));
      await pump(page, 0.5); simSecs += 0.5;
      if (canRot) {
        air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
        if (air) await page.evaluate(() => window.__lp.api.setStick(0, 0.9));
      }
    }
    let maxY = 0, capped = true;
    while (simSecs < 90) {
      await pump(page, 1); simSecs += 1;
      maxY = Math.max(maxY, await page.evaluate(() => window.__lp.state.y - Math.max(window.__lp.terrainEff(window.__lp.state.x, window.__lp.state.z), window.__lp.TUNE.waterLevel)));
      capped = await page.evaluate(() =>
        window.__lp.state.y <= window.__lp.TUNE.otherVehicleCeiling + 6 && window.__lp.state.spaceF < 0.35);
      if (simSecs > 40 && !capped) break;
    }
    check("space: non-rocket capped below space", capped, `maxAgl=${maxY.toFixed(0)} ceiling=${await page.evaluate(() => window.__lp.TUNE.otherVehicleCeiling)}`);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-A explosions ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => window.__lp.api.teleportAirborne(-1500, 600, 45, 0));
    await page.evaluate(() => window.__lp.api.setStick(0, -0.9));
    let boomed = false;
    for (let i = 0; i < 30 && !boomed; i++) {
      boomed = await page.evaluate(() => window.__lp.flags.exploded > 0 && window.__lp.state.exploding);
      if (!boomed) await pump(page, 0.25);
    }
    check("crash: steep dive explodes", boomed);
    await pump(page, 3.2);
    const stillExploding = await page.evaluate(() => window.__lp.state.exploding);
    const spd = await page.evaluate(() => window.__lp.state.speed);
    const fin1 = await snapState(page);
    check("crash: reassembles airborne, no penalty",
      !stillExploding && fin1.finite && fin1.phase === "AIRBORNE" && spd > 10,
      `phase=${fin1.phase} speed=${spd.toFixed(1)}`);
    await page.evaluate(() => window.__lp.api.setStick(0, -0.9));
    let boomed2 = false;
    for (let i = 0; i < 40 && !boomed2; i++) {
      boomed2 = await page.evaluate(() => window.__lp.flags.exploded >= 2);
      if (!boomed2) await pump(page, 0.25);
    }
    check("crash: deliberately repeatable", boomed2);
    await page.evaluate(() => window.__lp.api.clearStick());
    await pump(page, 3.5);
    const fin = await snapState(page);
    check("crash: state finite after two rebuilds", fin.finite && !fin.phase.includes("LANDED"), `y=${fin.y}`);

    await page.evaluate(() => window.__lp.api.teleportAirborne(-800, -600, 12, 0));
    await page.evaluate(() => window.__lp.api.setStick(0, -0.22));
    const b0 = await page.evaluate(() => window.__lp.flags.bounced);
    const e0 = await page.evaluate(() => window.__lp.flags.exploded);
    let bounced = false;
    for (let i = 0; i < 20 && !bounced; i++) {
      bounced = await page.evaluate((prevE) => window.__lp.flags.bounced > 0 || window.__lp.flags.exploded > prevE, e0);
      if (!bounced) await pump(page, 0.25);
    }
    const b1 = await page.evaluate(() => window.__lp.flags.bounced);
    const e1 = await page.evaluate(() => window.__lp.flags.exploded);
    check("crash: shallow skim still bounces (no explosion)", bounced && e1 === e0 && b1 >= b0,
      `bounced ${b0}->${b1} exploded=${e1}`);
    await page.close();
  }

  // ---------- T-C route end-to-end ----------
  async function flyRoute(page, dirIdx, label) {
    await page.evaluate((d) => { window.__lp.noRender = true; window.__lp.api.skipScreens(); window.__lp.api.spawnAt(d === 1 ? 1 : 0, d); }, dirIdx);
    let simSecs = 0;
    const step = 0.5;
    const repos0 = await page.evaluate(() => window.__lp.flags.repositioned);
    let airborne = false;
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    while (simSecs < 30 && !airborne) {
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, step); simSecs += step;
      if (canRot) {
        const a = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
        if (a) { airborne = true; await page.evaluate(() => window.__lp.api.clearStick()); }
      }
    }
    check(`route ${label}: takeoff`, airborne);
    if (!airborne) return;

    let landed = false;
    while (simSecs < 300) {
      const info = await page.evaluate(() => ({
        z: window.__lp.state.z,
        cz: window.__lp.TUNE.routeLength / 2 * (window.__lp.state.dirIdx === 0 ? -1 : 1),
        td: window.__lp.flags.touchdown,
        phase: window.__lp.state.phase
      }));
      const distToDest = Math.abs(info.cz - info.z);
      await page.evaluate((sp) => window.__lp.api.setStick(0, sp), distToDest < 2300 ? -0.13 : 0);
      await pump(page, step); simSecs += step;
      if (info.td > 0 && info.phase === "LANDED") { landed = true; break; }
    }
    const expectedOrigin = dirIdx === 0 ? 1 : 0;
    check(`route ${label}: reaches destination in 3-4 min cruise`,
      landed && simSecs >= 150 && simSecs <= 290, `${simSecs.toFixed(0)}s landed=${landed}`);

    let parked = false;
    while (simSecs < 330 && !parked) {
      parked = await page.evaluate((r0) => window.__lp.flags.repositioned > r0 && window.__lp.state.phase === "TAXI", repos0);
      await pump(page, step); simSecs += step;
    }
    const originNow = await page.evaluate(() => window.__lp.state.originIdx);
    check(`route ${label}: resets at destination for fly-back`, originNow === expectedOrigin,
      `origin=${originNow} expected=${expectedOrigin}`);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
  }

  {
    const a = await newPage(1180, 820);
    await flyRoute(a.page, 0, "NY->CA");
    await a.page.close();
  }
  {
    const b = await newPage(1180, 820);
    await flyRoute(b.page, 1, "CA->NY");
    await b.page.close();
  }

  // ---------- T-E route strip ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.spawnAt(0, 0); });
    await pump(page, 1);
    const dots = await page.evaluate(() => document.querySelectorAll("#progressStrip .dot").length);
    check("strip: landmark dots rendered", dots === 12, `dots=${dots}`);

    await page.evaluate(() => { window.__lp.api.teleportAirborne(-5400, 0, 80, Math.PI); });
    await pump(page, 1.2);
    const mid = await page.evaluate(() => {
      const m = document.getElementById("progressStrip");
      const marker = m.querySelector(".marker");
      const passed = m.querySelectorAll(".dot.passed").length;
      return { left: marker.style.left, passed };
    });
    check("strip: marker moves and dots pass en-route",
      mid.left !== "" && parseFloat(mid.left) > 30 && parseFloat(mid.left) < 95 && mid.passed >= 3,
      JSON.stringify(mid));
    await page.close();
  }

  // ---------- T9 home indicator ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });

    await page.evaluate(() => window.__lp.api.teleportAirborne(-1400, 0, 80, 0));
    await pump(page, 0.5);
    let r = await page.evaluate(() => {
      const e = document.getElementById("homeArrow");
      const b = e.getBoundingClientRect();
      return { on: e.classList.contains("on"), l: b.left, t: b.top, rgt: b.right, bot: b.bottom, tf: e.style.transform };
    });
    check("home: visible when far from runway (incl. behind case)",
      r.on && r.l >= -2 && r.t >= -2 && r.rgt <= 1182 && r.bot <= 822 && /rotate/.test(r.tf),
      JSON.stringify(r));

    await page.evaluate(() => window.__lp.api.teleportAirborne(2400, 0, 90, 0));
    await pump(page, 0.5);
    const angUp = await page.evaluate(() => {
      const m = document.getElementById("homeArrow").style.transform.match(/rotate\(([-\d.]+)deg\)/);
      return m ? parseFloat(m[1]) : null;
    });
    const norm = angUp === null ? 999 : ((angUp % 360) + 360) % 360;
    check("home: points ahead when runway centered", norm <= 30 || norm >= 330, `angle=${angUp}`);

    await page.evaluate(() => window.__lp.api.teleportAirborne(150, 0, 30, 0));
    await pump(page, 0.5);
    const hidden = await page.evaluate(() => !document.getElementById("homeArrow").classList.contains("on"));
    check("home: hides within approach distance", hidden);

    await page.evaluate(() => window.__lp.api.placeOnRunway());
    await pump(page, 0.3);
    const hiddenGround = await page.evaluate(() => !document.getElementById("homeArrow").classList.contains("on"));
    check("home: hidden while parked", hiddenGround);
    await page.close();
  }

  // ---------- T10 zero-text audit ----------
  {
    const { page } = await newPage(1180, 820);
    const badText = await page.evaluate(() => {
      const bad = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode;
        const p = n.parentElement && n.parentElement.tagName;
        if (p === "SCRIPT" || p === "STYLE") continue;
        const t = n.nodeValue.trim();
        if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 40));
      }
      return bad;
    });
    check("audit: zero text anywhere in UI (numbers only)", badText.length === 0, JSON.stringify(badText));
    await page.close();
  }

  // ---------- T7 rendered FPS smoke test ----------
  {
    const { page } = await newPage(1180, 820);
    const fps = await page.evaluate(() => new Promise(resolve => {
      window.__lp.noRender = false;
      const batches = 12;
      let done = 0;
      const wallStart = performance.now();
      const step = () => {
        for (let i = 0; i < 10; i++) {
          const q = window.__rafQueue.splice(0);
          if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
        }
        done++;
        if (done < batches) setTimeout(step, 30);
        else resolve(Math.round((batches * 10) / ((performance.now() - wallStart) / 1000)));
      };
      step();
    }));
    check("perf: renders under software GL (informational)", fps > 5, `${fps} fps swiftshader (iPad GPU will be much faster)`);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.teleportAirborne(1200, 200, 120, 15); });
    await pump(page, 0.4);
    await page.evaluate(() => {
      window.__lp.noRender = false;
      const q = window.__rafQueue.splice(0);
      if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
    });
    await page.screenshot({ path: path.join(SHOTS, "cockpit-flight.png") });
    await page.close();
  }

  // ---------- T8 service worker reachable ----------
  {
    const { page } = await newPage(1180, 820);
    const sw = await page.evaluate(async () => (await fetch("sw.js")).status);
    check("pwa: sw.js served", sw === 200, `status ${sw}`);
    await page.close();
  }

  await browser.close();
  server.kill();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("HARNESS ERROR:", e); process.exit(2); });

function fs_mkdir(dir) {
  require("fs").mkdirSync(dir, { recursive: true });
}
