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
  // Refuse to run against a server we didn't start (stale build on :8177).
  const portBusy = await new Promise(resolve => {
    const req = http.get(URL, res => { res.resume(); resolve(true); });
    req.on("error", () => resolve(false));
  });
  if (portBusy) {
    console.error(`Port ${PORT} is already serving something; stop it first.`);
    process.exit(2);
  }
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  process.on("exit", () => server.kill());
  server.on("exit", code => {
    if (results.length === 0) { console.error(`static server exited early (code ${code})`); process.exit(2); }
  });
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
      const visible = [...sv.querySelectorAll(".card:not(.hiddenS)")];
      const hidden = [...sv.querySelectorAll(".card.hiddenS")];
      if (visible.length !== 5) return { ok: false, why: "visible=" + visible.length };
      const sized = visible.every(c => {
        const r = c.getBoundingClientRect();
        return r.width >= 100 && r.height >= 100;
      });
      const keys = visible.map(c => c.dataset.v);
      const hiddenGone = hidden.every(c => c.getBoundingClientRect().width === 0);
      const fromTune = hidden.every(c => window.__lp.TUNE.vehicles[c.dataset.v].hidden === true);
      return { ok: sized && hidden.length === 2 && hiddenGone && fromTune && keys.includes("fighter") && !keys.includes("helicopter") && !keys.includes("rocket"), why: keys.join(",") + (hiddenGone ? "" : " HIDDEN CARDS STILL RENDER") };
    });
    check("vehicles: picker shows 5 incl fighter (heli+rocket shelved, not rendered, driven by TUNE.hidden)", bootOk.ok, bootOk.why);

    const combos = await page.evaluate(() => {
      const vs = Object.values(window.__lp.TUNE.vehicles).filter(v => !v.hidden);
      return { n: vs.length, uniq: new Set(vs.map(v => v.cruiseSpeed + "|" + v.turnRateDeg + "|" + v.pitchLimitDeg)).size };
    });
    check("vehicles: five available, fighter distinct, airliners share stats",
      combos.n === 5 && combos.uniq === 3, `n=${combos.n} uniq=${combos.uniq}`);

    await page.evaluate(() => {
      document.getElementById("screenDir").classList.add("hiddenS");
      document.getElementById("screenVehicle").classList.remove("hiddenS");
      // The rocket is shelved; un-shelve it for this test only so the space checks below still run.
      document.querySelector('[data-v="rocket"]').classList.remove("hiddenS");
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

  // ---------- T-F solid structures ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    const nSolids = await page.evaluate(() => {
      let n = 0; window.__lp.forEachSolid ? window.__lp.forEachSolid(() => n++) : null;
      return window.__lp.solidCount !== undefined ? window.__lp.solidCount : -1;
    });
    check("solids: registry populated", nSolids > 40, `count=${nSolids}`);

    const e0 = await page.evaluate(() => window.__lp.flags.exploded);
    const aim = await page.evaluate(() => {
      let best = null;
      window.__lp.forEachSolid(b => {
        // CA downtown cluster (addRouteLandmark(downtown, 460, ...)) -- beside the approach corridor
        if (b.x > 300 && b.x < 620 && Math.abs(b.z + 4920) < 60 && (b.y1 - b.y0) > 80) {
          if (!best || (b.y1 - b.y0) > (best.y1 - best.y0)) best = b;
        }
      });
      return best ? { x: b_x(best), z: best.z, midY: (best.y0 + best.y1) / 2 } : null;
      function b_x(b) { return b.x; }
    });
    check("solids: aimed at a real registered tower", !!aim, JSON.stringify(aim));
    await page.evaluate((a) => {
      const st = window.__lp.state;
      st.x = a.x - 80; st.z = a.z;
      st.heading = -Math.PI / 2; st.pitch = 0; st.bank = 0; st.dirIdx = 0;
      st.y = a.midY;
      st.speed = 60; st.phase = "AIRBORNE"; st.exploding = false;
      st.destIdx = 1; st.originIdx = 0;
    }, aim);
    await page.evaluate(() => window.__lp.api.setStick(0, 0));
    let boomed = false, maxX = -1e9;
    for (let i = 0; i < 24 && !boomed; i++) {
      const cur = await page.evaluate(() => ({
        e: window.__lp.flags.exploded > 0,
        x: window.__lp.state.x
      }));
      maxX = Math.max(maxX, cur.x);
      boomed = cur.e || false;
      if (!boomed) await pump(page, 0.25);
    }
    check("solids: flying into downtown tower shatters plane",
      boomed && maxX < aim.x + 30,
      `exploded=${boomed} maxX=${maxX.toFixed(0)} towerX=${aim.x.toFixed(0)}`);
    await pump(page, 3.2);
    const alive = await page.evaluate(() =>
      !window.__lp.state.exploding && isFinite(window.__lp.state.x));
    check("solids: reassembled after structure crash", alive);
    await page.close();
  }

  // ---------- T-G view + gear ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });

    const gearVisRocket = await page.evaluate(() => {
      window.__lp.api.setVehicle("rocket");
      for (let i = 0; i < 40; i++) {
        const q = window.__rafQueue.splice(0);
        if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
      }
      return document.getElementById("gearBtn").classList.contains("hidden");
    });
    check("gear: hidden for rocket", gearVisRocket);

    const gearVisProp = await page.evaluate(() => {
      window.__lp.api.setVehicle("prop");
      for (let i = 0; i < 40; i++) {
        const q = window.__rafQueue.splice(0);
        if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
      }
      return !document.getElementById("gearBtn").classList.contains("hidden");
    });
    check("gear: visible for prop plane", gearVisProp);

    const btnOk = await page.evaluate(() => {
      const r = document.getElementById("viewBtn").getBoundingClientRect();
      return r.width >= 80 && r.height >= 80;
    });
    check("view: toggle button >= 80px", btnOk);

    await page.click("#viewBtn");
    await pump(page, 0.5);
    const chaseRaw = await page.evaluate(() => {
      const cp = window.__lp.cameraPos;
      const st = window.__lp.state;
      return {
        on: st.viewChase,
        frameHidden: getComputedStyle(document.getElementById("pillarL")).display === "none",
        dialVisible: document.getElementById("asiDial").getBoundingClientRect().height > 40,
        modelVisible: window.__lp.vehicleModel.visible,
        cx: cp.x, cy: cp.y, cz2: cp.z,
        px: st.x, py: st.y, pz: st.z
      };
    });
    chaseRaw.dist = Math.hypot(chaseRaw.cx - chaseRaw.px, chaseRaw.cy - chaseRaw.py, chaseRaw.cz2 - chaseRaw.pz);
    const chase = { on: chaseRaw.on, frameHidden: chaseRaw.frameHidden, dialVisible: chaseRaw.dialVisible, modelVisible: chaseRaw.modelVisible, dist: chaseRaw.dist };
    check("view: chase active, frame hidden, dials kept, model shown",
      chase.on && chase.frameHidden && chase.dialVisible && chase.modelVisible, JSON.stringify(chase));

    await page.click("#viewBtn");
    await pump(page, 0.3);
    const back = await page.evaluate(() => ({
      off: !window.__lp.state.viewChase,
      frameBack: getComputedStyle(document.getElementById("pillarL")).display !== "none",
      modelHidden: !window.__lp.vehicleModel.visible
    }));
    check("view: toggles back to cockpit", back.off && back.frameBack && back.modelHidden);
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await pump(page, 0.5);
    const aimGround = await page.evaluate(() =>
      !document.getElementById("aimMarker").classList.contains("on"));
    check("aim: hidden while parked", aimGround);

    // gear toggle in flight
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    await pump(page, 1);
    const aim = await page.evaluate(() => {
      const e = document.getElementById("aimMarker");
      const r = { on: e.classList.contains("on"), l: parseFloat(e.style.left), t: parseFloat(e.style.top) };
      return r;
    });
    check("aim: crosshair on-screen while flying level",
      aim.on && aim.l > 0 && aim.t > 0 &&
      aim.l < 1180 && aim.t < 820,
      JSON.stringify(aim));

    const gDown0 = await page.evaluate(() => window.__lp.state.gearDown);
    await page.click("#gearBtn");
    await pump(page, 1.2);
    const gUp = await page.evaluate(() => ({
      down: window.__lp.state.gearDown,
      anim: window.__lp.state.gearAnim,
      snd: window.__lp.flags.gear
    }));
    check("gear: button retracts gear mid-flight with sound",
      gDown0 === true && gUp.down === false && gUp.anim < 0.15 && gUp.snd >= 1,
      JSON.stringify(gUp));
    await page.click("#gearBtn");
    await pump(page, 1.2);
    const gExt = await page.evaluate(() => ({
      down: window.__lp.state.gearDown,
      anim: window.__lp.state.gearAnim
    }));
    check("gear: extends again", gExt.down === true && gExt.anim > 0.85, JSON.stringify(gExt));
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-D ceiling (space content dormant: rocket shelved) ----------
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
    let capped = true;
    while (simSecs < 70) {
      await pump(page, 1); simSecs += 1;
      capped = await page.evaluate(() =>
        window.__lp.state.y <= window.__lp.TUNE.otherVehicleCeiling + 6 &&
        window.__lp.state.spaceF < 0.35);
      if (simSecs > 30 && !capped) break;
    }
    check("ceiling: vehicles capped below dormant space", capped);
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
    const e0 = await page.evaluate(() => window.__lp.flags.exploded);
    let blew = false;
    for (let i = 0; i < 24 && !blew; i++) {
      blew = await page.evaluate((prevE) => window.__lp.flags.exploded > prevE, e0);
      if (!blew) await pump(page, 0.25);
    }
    const e1 = await page.evaluate(() => window.__lp.flags.exploded);
    check("crash: every impact explodes (shallow skim included)", blew && e1 === e0 + 1,
      `exploded ${e0}->${e1}`);
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
      const aglNow = await page.evaluate(() =>
        window.__lp.state.y - Math.max(window.__lp.terrainEff(window.__lp.state.x, window.__lp.state.z), window.__lp.TUNE.waterLevel));
      let stickP = 0;
      if (distToDest < 4600) stickP = -0.19;
      else if (aglNow < 170) stickP = 0.16;
      else if (aglNow > 210) stickP = -0.06;
      await page.evaluate((sp) => window.__lp.api.setStick(0, sp), stickP);
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

  // ---------- T-H gear-up landing explodes ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    const td0 = await page.evaluate(() => window.__lp.flags.touchdown);
    await page.click("#gearBtn");
    await pump(page, 1.2);
    await page.evaluate(() => window.__lp.api.teleportAirborne(500, 0, 60, 0));
    await page.evaluate(() => window.__lp.api.setStick(0, -0.2));
    let boomed = false;
    for (let i = 0; i < 60 && !boomed; i++) {
      boomed = await page.evaluate(() => window.__lp.flags.exploded > 0);
      if (!boomed) await pump(page, 0.5);
    }
    const tds = await page.evaluate(() => window.__lp.flags.touchdown);
    check("gear: belly landing explodes instead of landing",
      boomed && tds === td0, `exploded=${boomed} td=${tds}`);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-I slow throttle + glide guide ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    await pump(page, 3);
    const cruise = await page.evaluate(() => window.__lp.state.vp.cruiseSpeed);
    const step0 = await page.evaluate(() => window.__lp.state.speedStep);

    // turtle tap: speed drops and STAYS down
    await page.click("#slowBtn");
    let slowed = false;
    for (let i = 0; i < 16 && !slowed; i++) {
      slowed = await page.evaluate((c) => window.__lp.state.speed < c * 0.75, cruise);
      if (!slowed) await pump(page, 0.5);
    }
    check("throttle: turtle tap slows", slowed);
    await pump(page, 5);
    const staysLow = await page.evaluate((c) => window.__lp.state.speed < c * 0.75, cruise);
    check("throttle: slow speed persists (no regress to cruise)", staysLow);

    // two rabbit taps: up to boost, and STAYS
    await page.click("#fastBtn");
    await page.click("#fastBtn");
    let boosted = false;
    for (let i = 0; i < 16 && !boosted; i++) {
      boosted = await page.evaluate((c) => window.__lp.state.speed > c * 1.1, cruise);
      if (!boosted) await pump(page, 0.5);
    }
    check("throttle: rabbit taps speed up", boosted);
    await pump(page, 5);
    const staysFast = await page.evaluate((c) => window.__lp.state.speed > c * 1.1, cruise);
    check("throttle: fast speed persists", staysFast);
    const stepNow = await page.evaluate(() => window.__lp.state.speedStep);
    check("throttle: step index tracked", stepNow === step0 + 1, `step ${step0}->${stepNow}`);

    // glide guide during engaged approach
    await page.evaluate(() => window.__lp.api.teleportAirborne(900, 0, 60, 0));
    await page.evaluate(() => window.__lp.api.setStick(0, -0.16));
    let guideSeen = false;
    for (let i = 0; i < 40 && !guideSeen; i++) {
      guideSeen = await page.evaluate(() =>
        document.getElementById("glideGuide").classList.contains("on") &&
        ["up", "down", "ok"].includes(document.getElementById("glideGuide").dataset.state));
      if (!guideSeen) await pump(page, 0.5);
    }
    check("guidance: glide arrow appears on approach", guideSeen);
    const guideStates = await page.evaluate(() => {
      const T = window.__lp.TUNE, st = window.__lp.state;
      const out = {};
      for (const [name, dAlt] of [["ok", 0], ["down", 60], ["up", -60]]) {
        window.__lp.api.teleportAirborne(900, 0, 3 + 900 * T.glideSlope + dAlt, 0);
        st.pitch = 0;
        window.__lp.api.clearStick();
        window.__lp.update(1 / 60);
        out[name] = document.getElementById("glideGuide").dataset.state;
      }
      return out;
    });
    check("guidance: glide arrow says ok on-slope, down when high, up when low",
      guideStates.ok === "ok" && guideStates.down === "down" && guideStates.up === "up", JSON.stringify(guideStates));
    // rings sit on the same slope the arrow measures
    const ringsOnSlope = await page.evaluate(() => {
      const T = window.__lp.TUNE;
      let worst = 0;
      for (let i = 0; i < T.ringCount; i++) {
        const s = i / (T.ringCount - 1), d = T.ringStartDistance * (1 - s);
        const expect = 3 + d * T.glideSlope;
        const rings = window.__lp.rings;
        worst = Math.max(worst, Math.abs(rings[i].position.y - expect));
      }
      return worst;
    });
    check("guidance: ring corridor lies on the glide slope", ringsOnSlope < 0.01, `worst dy ${ringsOnSlope.toFixed(2)}`);
    // put the plane back on the approach the following speed checks expect
    await page.evaluate(() => { window.__lp.state.exploding = false; window.__lp.state.explodeTimer = 0; window.__lp.api.teleportAirborne(900, 0, 60, 0); window.__lp.api.setStick(0, -0.16); });
    await pump(page, 1);

    // speed controls work during engaged approach
    const spEngaged = await page.evaluate(() => window.__lp.state.speed);
    await page.click("#slowBtn");
    await pump(page, 2);
    const spSlower = await page.evaluate(() => window.__lp.state.speed);
    check("throttle: slow works during landing approach", spSlower < spEngaged - 2,
      `${spEngaged.toFixed(0)} -> ${spSlower.toFixed(0)}`);
    await page.click("#fastBtn");
    await pump(page, 2);
    const spFaster = await page.evaluate(() => window.__lp.state.speed);
    check("throttle: fast works during landing approach", spFaster > spSlower + 2,
      `${spSlower.toFixed(0)} -> ${spFaster.toFixed(0)}`);
    await page.evaluate(() => window.__lp.api.clearStick());
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-J chase model sits on the ground ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.setView(true); window.__lp.api.placeOnRunway(); });
    await pump(page, 1);
    const gap = await page.evaluate(() => {
      const m = window.__lp.vehicleModel;
      const st = window.__lp.state;
      const wheelWorld = m.position.y - 1.9 * (st.vp.size || 1);
      const ground = Math.max(window.__lp.terrainEff(st.x, st.z), window.__lp.TUNE.waterLevel);
      return wheelWorld - ground;
    });
    check("view: landed model rests wheels on ground", Math.abs(gap) < 1.5, `gap=${gap.toFixed(2)}`);
    await page.close();
  }

  // ---------- T-K skip to landing ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    await page.evaluate(() => window.__lp.api.clearStick());
    await pump(page, 1);
    const vis = await page.evaluate(() =>
      !document.getElementById("skipBtn").classList.contains("hidden"));
    check("skip: button appears while airborne en-route", vis);

    await page.click("#skipBtn");
    await pump(page, 0.5);
    const placed = await page.evaluate(() => {
      const st = window.__lp.state;
      const apCz = window.__lp.TUNE.routeLength / 2 * (st.dirIdx === 0 ? -1 : 1);
      const thOff = (st.dirIdx === 0 ? 1 : -1) * window.__lp.TUNE.runwayLength / 2;
      return {
        engaged: st.engaged,
        gear: st.gearDown,
        dist: Math.abs(st.z - (apCz + thOff)),
        sp: st.speed,
        btnHidden: document.getElementById("skipBtn").classList.contains("hidden")
      };
    });
    check("skip: placed aligned on glide slope, engaged, gear down, button hides",
      placed.engaged && placed.gear && placed.dist > 1300 && placed.dist < 1600 &&
      placed.sp <= 60 && placed.btnHidden,
      JSON.stringify(placed));

    const repos0 = await page.evaluate(() => window.__lp.flags.repositioned);
    let landed = false, elapsed = 0;
    await page.evaluate(() => window.__lp.api.setStick(0, -0.18));
    while (elapsed < 90 && !landed) {
      landed = await page.evaluate(() =>
        window.__lp.flags.touchdown > 0 && window.__lp.state.phase === "LANDED");
      if (!landed) { await pump(page, 1); elapsed += 1; }
    }
    check("skip: lands within a minute-ish of skipping",
      landed && elapsed >= 20 && elapsed <= 80, `${elapsed.toFixed(0)}s landed=${landed}`);
    await pump(page, 14);
    const reset = await page.evaluate((r0) =>
      window.__lp.flags.repositioned > r0 && window.__lp.state.phase === "TAXI", repos0);
    check("skip: post-landing reset ready for next flight", reset);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-M missiles & traffic ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    await page.evaluate(() => window.__lp.api.clearStick());
    await pump(page, 2);
    for (let i = 0; i < 30; i++) {
      const agl = await page.evaluate(() =>
        window.__lp.state.y - Math.max(window.__lp.terrainEff(window.__lp.state.x, window.__lp.state.z), window.__lp.TUNE.waterLevel));
      if (agl >= 100) break;
      await page.evaluate(() => window.__lp.api.setStick(0, 0.3));
      await pump(page, 0.5);
    }
    await page.evaluate(() => window.__lp.api.clearStick());
    const settle = async () => {
      for (let i = 0; i < 20; i++) {
        const p = await page.evaluate(() => Math.abs(window.__lp.state.pitch));
        if (p < 0.15) return true;
        await pump(page, 0.25);
      }
      return false;
    };
    const leveled = await settle();

    const trafficN = await page.evaluate(() => window.__lp.traffic.length);
    check("traffic: planes cruising", trafficN === 6, `n=${trafficN}`);

    const mb = await page.locator("#missileBtn").boundingBox();
    check("missiles: button visible airborne", !!mb && mb.width >= 80);
    check("missiles: plane settled level before shot", leveled);

    // put a traffic plane dead ahead, then shoot it
    const shot = await page.evaluate(() => {
      const st = window.__lp.state;
      const t = window.__lp.traffic.find(tt => tt.alive);
      if (!t) return false;
      t.heading = st.heading;
      t.x = st.x - Math.sin(st.heading) * 260;
      t.z = st.z - Math.cos(st.heading) * 260;
      t.y = Math.max(st.y, window.__lp.terrainEff(t.x, t.z) + window.__lp.TUNE.waterLevel + 47);
      t.speed = st.speed * 0.5;
      return true;
    });
    const e0 = await page.evaluate(() => window.__lp.flags.exploded);
    const s0 = await page.evaluate(() => window.__lp.flags.shootdowns);
    await page.click("#missileBtn");
    let hit = false;
    for (let i = 0; i < 16 && !hit; i++) {
      hit = await page.evaluate((p0) => window.__lp.flags.shootdowns > p0, s0);
      if (!hit) await pump(page, 0.25);
    }
    const e1 = await page.evaluate(() => window.__lp.flags.exploded);
    check("missiles: shoot down a plane ahead",
      shot && hit && e1 >= e0, `shot=${shot} hit=${hit}`);

    // missile into terrain also explodes
    const h0 = await page.evaluate(() => window.__lp.flags.missileHits);
    await page.evaluate(() => window.__lp.api.setStick(0, -0.5));
    await pump(page, 1);
    await page.evaluate(() => window.__lp.api.clearStick());
    await page.click("#missileBtn");
    let terrainHit = false;
    for (let i = 0; i < 20 && !terrainHit; i++) {
      terrainHit = await page.evaluate((p0) => window.__lp.flags.missileHits > p0, h0);
      if (!terrainHit) await pump(page, 0.25);
    }
    check("missiles: ground impact explodes", terrainHit);

    // mid-air collision with traffic explodes the player
    const e2 = await page.evaluate(() => window.__lp.flags.exploded);
    await page.evaluate(() => {
      const st = window.__lp.state;
      const t = window.__lp.traffic.find(tt => tt.alive);
      if (t) {
        st.x = t.x; st.y = t.y; st.z = t.z;
      }
    });
    let midair = false;
    for (let i = 0; i < 12 && !midair; i++) {
      midair = await page.evaluate((p0) => window.__lp.flags.exploded > p0 || window.__lp.flags.midairs > 0, e2);
      if (!midair) await pump(page, 0.25);
    }
    check("traffic: mid-air collision explodes", midair);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-N town building collisions ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    await page.evaluate(() => { window.__lp.api.placeOnRunway(); });
    await page.evaluate(() => window.__lp.api.setThrottle(true));
    for (let i = 0; i < 40; i++) {
      const air = await page.evaluate(() => window.__lp.state.phase === "AIRBORNE");
      if (air) break;
      const canRot = await page.evaluate(() => window.__lp.state.canRotate);
      if (canRot) await page.evaluate(() => window.__lp.api.setStick(0, 0.6));
      await pump(page, 0.25);
    }
    await page.evaluate(() => window.__lp.api.clearStick());
    await pump(page, 2);

    // find a real town building near the plane, aim at its center
    const aim = await page.evaluate(() => {
      let best = null;
      window.__lp.forEachSolid(b => {
        if (b.idx === undefined || b.y0 === undefined) return;
        const d = Math.hypot(b.x - window.__lp.state.x, b.z - window.__lp.state.z);
        if (d < 600 && d > 80 && (b.y1 - b.y0) > 8) {
          if (!best || d < best.d) best = { x: b.x, z: b.z, y0: b.y0, y1: b.y1, d };
        }
      });
      return best;
    });
    check("town: found a nearby town building to test", !!aim, JSON.stringify(aim));

    // missile into the town building
    await page.evaluate((a) => {
      const st = window.__lp.state;
      st.heading = Math.atan2(-(a.x - st.x), -(a.z - st.z));
      st.pitch = 0; st.bank = 0;
      st.y = (a.y0 + a.y1) / 2;
      st.speed = 60; st.phase = "AIRBORNE"; st.exploding = false;
    }, aim);
    const h0 = await page.evaluate(() => window.__lp.flags.missileHits);
    await page.click("#missileBtn");
    await page.evaluate(() => {
      const st = window.__lp.state;
      st.y += 260;
      st.pitch = 0;
    });
    let mHit = false;
    for (let i = 0; i < 16 && !mHit; i++) {
      mHit = await page.evaluate((p0) => window.__lp.flags.missileHits > p0, h0);
      if (!mHit) await pump(page, 0.25);
    }
    check("town: missile destroys a small building", mHit);

    // plane into the same building
    const e0 = await page.evaluate(() => window.__lp.flags.exploded);
    await page.evaluate((a) => {
      const st = window.__lp.state;
      st.heading = Math.atan2(-(a.x - st.x), -(a.z - st.z));
      st.pitch = 0; st.bank = 0;
      st.y = (a.y0 + a.y1) / 2;
      st.speed = 60; st.phase = "AIRBORNE"; st.exploding = false;
      st.x = a.x + Math.sin(st.heading) * 90;
      st.z = a.z + Math.cos(st.heading) * 90;
    }, aim);
    let boomed = false;
    for (let i = 0; i < 16 && !boomed; i++) {
      boomed = await page.evaluate((p0) => window.__lp.flags.exploded > p0, e0);
      if (!boomed) await pump(page, 0.25);
    }
    check("town: plane hitting a small building explodes", boomed);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
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
    console.log(`INFO  perf: ${fps} fps under swiftshader (advisory only; iPad GPU is much faster)`);
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

  // ---------- T-W world integrity (regressions the old harness missed) ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });

    const terrain = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, half = T.routeLength / 2;
      const ap = L.AIRPORTS[0];
      // sample the centreline mid-route: flatten must be ~0 there and 1 on the runway
      let maxMask = 0, maxGap = 0;
      for (let z = -half + 1200; z < half - 1200; z += 97) {
        maxMask = Math.max(maxMask, L.flattenMask(0, z));
        maxGap = Math.max(maxGap, Math.abs(L.shapedTerrain(0, z) - L.terrainEff(0, z)));
      }
      return { maxMask, maxGap, runwayMask: L.flattenMask(0, ap.cz), runwayFlat: Math.abs(L.terrainEff(0, ap.cz) - L.terrainEff(0, ap.cz + T.runwayLength * 0.4)) };
    });
    check("world: no flattened ribbon along the route centreline (flattenMask sign)",
      terrain.maxMask < 0.02 && terrain.maxGap < 0.5, JSON.stringify(terrain));
    check("world: runways still flat", terrain.runwayMask > 0.999 && terrain.runwayFlat < 0.01, JSON.stringify(terrain));

    // train exists, moves, is finite
    const train = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      st.x = 340; st.z = 500; st.y = 400; st.phase = "AIRBORNE"; st.speed = 0;
      for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);  // let the cars enter the track
      const h0 = L.trainHead;
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      const h1 = L.trainHead;
      const solids = L.trainSolids.length;
      const finite = L.trainSolids.every(b => Number.isFinite(b.z) && Number.isFinite(b.y0));
      return { h0, h1, solids, finite, speed: L.TUNE.trainSpeed };
    });
    check("world: freight train moves and is solid (TUNE.trainSpeed defined)",
      Number.isFinite(train.h0) && train.h1 < train.h0 - 10 && train.solids > 10 && train.finite, JSON.stringify(train));

    // tower beacons are live meshes (not JSON-cloned husks)
    const beacons = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      // fly along the route so landmark cells stream in
      st.speed = 0;
      for (let z = -3000; z <= 3000; z += 600) { st.x = 0; st.z = z; st.y = 300; L.update(1 / 60); }
      return { n: L.blinkers.length, meshes: L.blinkers.filter(b => b && b.isMesh).length };
    });
    check("world: tower beacons are real meshes", beacons.n > 0 && beacons.meshes === beacons.n, JSON.stringify(beacons));

    // wall hit: reassemble on the near side, never NaN
    const walls = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const res = [];
      const boxes = [];
      L.forEachSolid(b => { if (b.hw >= 4 && b.hd >= 4 && b.y1 - b.y0 >= 6) boxes.push(b); });
      const b = boxes[0];
      if (!b) return { err: "no solids" };
      const cases = [
        { name: "+x", x: b.x + b.hw + 1, y: (b.y0 + b.y1) / 2, z: b.z, ok: sp => sp.x > b.x + b.hw },
        { name: "-x", x: b.x - b.hw - 1, y: (b.y0 + b.y1) / 2, z: b.z, ok: sp => sp.x < b.x - b.hw },
        { name: "+z", x: b.x, y: (b.y0 + b.y1) / 2, z: b.z + b.hd + 1, ok: sp => sp.z > b.z + b.hd },
        { name: "-z", x: b.x, y: (b.y0 + b.y1) / 2, z: b.z - b.hd - 1, ok: sp => sp.z < b.z - b.hd },
        { name: "roof", x: b.x, y: b.y1 + 1, z: b.z, ok: sp => sp.y > b.y1 },
      ];
      for (const c of cases) {
        L.restoreShattered();  // the previous hit shattered (hid) this very box
        st.exploding = false; st.explodeTimer = 0; st.phase = "AIRBORNE";
        st.x = c.x; st.y = c.y; st.z = c.z; st.speed = 40; st.pitch = 0; st.heading = 0;
        L.resolveSolidWalls();
        const sp = L.safePos;
        const finite = Number.isFinite(sp.x) && Number.isFinite(sp.y) && Number.isFinite(sp.z);
        res.push({ name: c.name, hit: st.exploding, finite, side: finite && c.ok(sp) });
        st.exploding = false;
      }
      return { res };
    });
    check("walls: every face hit reassembles on the near side with finite coords",
      !walls.err && walls.res.every(r => r.hit && r.finite && r.side), JSON.stringify(walls));

    // shattered pieces restore on their own (missile hit, no player crash)
    const shatter = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      let b = null;
      L.forEachSolid(x => { if (!b && x.mesh) b = x; });
      if (!b) return { err: "no mesh solid" };
      st.x = b.x + b.hw + 200; st.y = (b.y0 + b.y1) / 2; st.z = b.z; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0; st.heading = Math.PI / 2;
      st.exploding = false;
      // shatter directly (what a missile impact does) and let time pass
      L.hiddenPieces.length = 0;
      window.__lp_shatterProbe = true;
      const before = b.mesh.visible;
      // call through a missile-hit-equivalent: fire toward it
      st.heading = Math.atan2(-(b.x - st.x), -(b.z - st.z));
      L.fireMissile();
      let hidden = false, restored = false;
      for (let i = 0; i < 60 * 8; i++) {
        L.update(1 / 60);
        if (b.mesh.visible === false) hidden = true;
        if (hidden && b.mesh.visible === true) { restored = true; break; }
      }
      return { before, hidden, restored, exploded: st.exploding };
    });
    check("walls: missile-shattered pieces restore without a player crash",
      !shatter.err && shatter.hidden && shatter.restored, JSON.stringify(shatter));

    // deep water is crashable
    const water = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      let wx = null, wz = null;
      const half = T.routeLength / 2;
      for (let z = -half + 500; z < half - 500 && wx === null; z += 50) {
        for (let x = -1200; x <= 1200; x += 100) {
          if (L.terrainEff(x, z) < T.waterLevel - 10 && !L.AIRPORTS.some(a => Math.abs(z - a.cz) < 1500)) { wx = x; wz = z; break; }
        }
      }
      if (wx === null) return { err: "no deep water found" };
      const e0 = L.flags.exploded;
      st.x = wx; st.z = wz; st.y = T.waterLevel + 40; st.phase = "AIRBORNE"; st.speed = 50; st.pitch = -20; st.heading = 0; st.exploding = false;
      window.__lp.api.setStick(0, -0.6);
      for (let i = 0; i < 60 * 6 && L.flags.exploded === e0; i++) L.update(1 / 60);
      window.__lp.api.clearStick();
      return { wx, wz, depth: L.terrainEff(wx, wz), exploded: L.flags.exploded > e0 };
    });
    check("crash: deep water explodes (no surfing)", !water.err && water.exploded, JSON.stringify(water));

    // nothing solid stands under either approach: every solid inside the ring
    // corridor must top out below the glide slope with clearance to spare
    const corridor = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const bad = [];
      for (const destIdx of [0, 1]) {
        const ap = L.AIRPORTS[destIdx];
        for (const sgn of [1, -1]) {
          const th = ap.cz + sgn * T.runwayLength / 2;
          // stream scenery in around the approach
          for (let d = 0; d <= T.ringStartDistance; d += 300) { st.x = 0; st.z = th + sgn * d; st.y = ap.elev + 200; st.phase = "AIRBORNE"; st.speed = 0; L.update(1 / 60); }
          L.forEachSolid(b => {
            const dz = (b.z - th) * sgn;
            if (dz < -20 || dz > T.ringStartDistance) return;
            if (Math.abs(b.x) - b.hw > T.runwayWidth / 2 + 35) return;
            const slopeY = ap.elev + 3 + Math.max(0, dz - b.hd) * T.glideSlope;
            if (b.y1 + T.terrainClearance > slopeY) bad.push({ destIdx, sgn, x: Math.round(b.x), dShort: Math.round(dz), top: Math.round(b.y1), slope: Math.round(slopeY) });
          });
        }
      }
      return bad;
    });
    check("world: approach corridors are clear of solids below the glide slope", corridor.length === 0, JSON.stringify(corridor.slice(0, 6)));
    await page.close();
  }

  // ---------- T8 service worker reachable ----------
  {
    const { page } = await newPage(1180, 820);
    const sw = await page.evaluate(async () => (await fetch("sw.js")).status);
    check("pwa: sw.js served", sw === 200, `status ${sw}`);
    const pwa = await page.evaluate(async () => {
      const out = {};
      for (const f of ["manifest.json", "../manifest.json", "../sw.js", "../index.html"]) {
        try {
          const r = await fetch(f);
          out[f] = r.status === 200 && (f.endsWith(".json") ? !!JSON.parse(await r.text()).start_url : (await r.text()).length > 100);
        } catch (e) { out[f] = false; }
      }
      return out;
    });
    check("pwa: both manifests parse, 2D build and root sw.js served", Object.values(pwa).every(Boolean), JSON.stringify(pwa));
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
