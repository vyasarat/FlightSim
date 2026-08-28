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

const ROOT = path.resolve(__dirname, "..");            // repo root: both builds are reachable
const SHOTS = path.resolve(__dirname, "..", "qa-screenshots");
const PORT = 8177;
const URL = `http://127.0.0.1:${PORT}/cockpit/index.html`;
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

const L_GEAR = 3.2;   // TUNE.gearHeight (asserted below)
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
    // every harness page boots on the picker, even if a previous test saved a choice
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
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

  // ---------- T0 phone landscape: nothing overlaps ----------
  {
    const { page } = await newPage(844, 390);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.teleportAirborne(3000, 200, 150, 0); window.__lp.update(1 / 60); });
    const phone = await page.evaluate(() => {
      const ids = ["viewBtn", "skipBtn", "fastBtn", "slowBtn", "missileBtn", "gearBtn", "throttleBtn", "vehBtn", "skyBtn", "camBtn", "dash", "brow", "progressStrip"];
      const rects = [];
      for (const id of ids) {
        const e = document.getElementById(id);
        if (!e || e.classList.contains("hidden")) continue;
        const r = e.getBoundingClientRect();
        if (r.width === 0) continue;
        rects.push({ id, l: r.left, r: r.right, t: r.top, b: r.bottom });
      }
      const overlaps = [];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.l < b.r - 2 && b.l < a.r - 2 && a.t < b.b - 2 && b.t < a.b - 2) overlaps.push(a.id + "/" + b.id);
      }
      const btn = document.getElementById("fastBtn").getBoundingClientRect();
      // dash and brow deliberately bleed past the edges; every button must be fully on screen
      const inside = rects.filter(r => r.id !== "dash" && r.id !== "brow").every(r => r.l >= -3 && r.r <= window.innerWidth + 3 && r.t >= -3 && r.b <= window.innerHeight + 3);
      return { overlaps, btnW: Math.round(btn.width), inside, n: rects.length };
    });
    check("phone landscape (844x390): controls neither overlap nor leave the screen, buttons >= 56px",
      phone.overlaps.length === 0 && phone.inside && phone.btnW >= 56, JSON.stringify(phone));
    await page.close();
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
    await pump(page, 18);   // rollout + the 6 s arrival show
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
      if (visible.length !== 6) return { ok: false, why: "visible=" + visible.length };
      const sized = visible.every(c => {
        const r = c.getBoundingClientRect();
        return r.width >= 100 && r.height >= 100;
      });
      const keys = visible.map(c => c.dataset.v);
      const hiddenGone = hidden.every(c => c.getBoundingClientRect().width === 0);
      const fromTune = hidden.every(c => window.__lp.TUNE.vehicles[c.dataset.v].hidden === true);
      return { ok: sized && hidden.length === 1 && hiddenGone && fromTune && keys.includes("fighter") && keys.includes("rocket") && !keys.includes("helicopter"), why: keys.join(",") + (hiddenGone ? "" : " HIDDEN CARDS STILL RENDER") };
    });
    check("vehicles: picker shows 6 incl fighter and rocket (heli shelved, not rendered, driven by TUNE.hidden)", bootOk.ok, bootOk.why);

    const combos = await page.evaluate(() => {
      const vs = Object.values(window.__lp.TUNE.vehicles).filter(v => !v.hidden);
      return { n: vs.length, uniq: new Set(vs.map(v => v.cruiseSpeed + "|" + v.turnRateDeg + "|" + v.pitchLimitDeg)).size };
    });
    check("vehicles: six available, fighter and rocket distinct, airliners share stats",
      combos.n === 6 && combos.uniq === 4, `n=${combos.n} uniq=${combos.uniq}`);

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

    await page.evaluate(() => window.__lp.api.setThrottle(true));
    let air = false;
    for (let i = 0; i < 80 && !air; i++) {
      air = await page.evaluate(() => window.__lp.flags.liftoff > 0);
      if (!air) await pump(page, 0.25);
    }
    let spd = 0;
    for (let i = 0; i < 30; i++) {
      spd = await page.evaluate(() => window.__lp.state.speed);
      if (spd > 100) break;
      await pump(page, 0.5);
    }
    check("vehicles: rocket lifts off vertically and passes 100 units/s", air && spd > 100, `speed=${spd.toFixed(1)}`);
    await page.evaluate(() => { window.__lp.api.clearStick(); window.__lp.api.setThrottle(false); });
    await page.close();
  }

  // ---------- T-F solid structures ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; });
    const nSolids = await page.evaluate(() => window.__lp.solidCount !== undefined ? window.__lp.solidCount : -1);
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

    await page.evaluate(() => { window.__lp.api.teleportAirborne(-5400, 0, 80, 0); });   // mid-route, southbound
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
      // mid-route, well off the runway centreline: traffic inside a corridor side-slips away by design
      st.x = 600; st.z = 0; st.y = Math.max(window.__lp.terrainEff(600, 0), window.__lp.TUNE.waterLevel) + 200; st.pitch = 0; st.bank = 0;
      window.__lp.update(1 / 60);
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
    await page.evaluate(() => { const st = window.__lp.state; st.y = Math.max(window.__lp.terrainEff(st.x, st.z), window.__lp.TUNE.waterLevel) + 70; });
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

    // fly down the route until a town building streams in near the plane, aim at its center
    const aim = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      let best = null;
      const half = T.routeLength / 2;
      for (let z = half - 1600; z > -half + 1600 && !best; z -= 250) {
        st.x = 0; st.z = z; st.y = 220; st.phase = "AIRBORNE"; st.speed = 0;
        for (let i = 0; i < 3; i++) L.update(1 / 60);
        L.forEachSolid(b => {
          if (b.idx === undefined || b.y0 === undefined) return;
          const d = Math.hypot(b.x - st.x, b.z - st.z);
          if (d < 600 && d > 80 && (b.y1 - b.y0) > 8) {
            if (!best || d < best.d) best = { x: b.x, z: b.z, y0: b.y0, y1: b.y1, d };
          }
        });
      }
      st.speed = st.vp.cruiseSpeed;
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
    const gearH = await page.evaluate(() => window.__lp.TUNE.gearHeight);
    check("world: harness gearHeight constant matches TUNE", gearH === L_GEAR, `TUNE.gearHeight=${gearH}`);

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
      for (let i = 0; i < 60 * 16; i++) {
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

  // ---------- T-R rewards, feel, alarm, keyboard, persistence ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });

    // rings: fly the slope from 1200 out; every ring should be eaten, each plays a note
    const ringsR = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.teleportAirborne(1320, 0, 3 + 1320 * T.glideSlope, 0);  // behind the first ring (ringStartDistance)
      L.api.setStick(0, -0.18);  // a gentle nose-down tracks the slope (same as the skip test)
      st.speedStep = 1;
      const e0 = L.flags.ringsEaten;
      let touched = false;
      for (let i = 0; i < 60 * 60; i++) {
        L.update(1 / 60);
        if (st.phase === "LANDED") { touched = true; break; }
        if (st.exploding) break;
      }
      L.api.clearStick();
      const eaten = L.rings.filter(r => r.userData.eaten).length;
      const green = L.rings.filter(r => r.material === L.rings[0].parent.userData.matEaten).length;
      return { eaten, green, total: L.rings.length, gained: L.flags.ringsEaten - e0, touched, exploded: st.exploding, flare: L.TUNE.flareAgl };
    });
    // the threshold ring sits at the touchdown point, so it may be reached after LANDED
    check("rewards: flying the slope eats the rings (green) and auto-flare lands hands-off",
      ringsR.eaten >= ringsR.total - 1 && ringsR.green === ringsR.eaten && ringsR.touched && !ringsR.exploded, JSON.stringify(ringsR));
    const ringsReset = await page.evaluate(() => {
      const L = window.__lp;
      // LANDED -> celebrate -> spawnForTakeoff -> placeRings resets
      for (let i = 0; i < 60 * 16; i++) L.update(1 / 60);
      return { phase: L.state.phase, eaten: L.rings.filter(r => r.userData.eaten).length };
    });
    check("rewards: rings reset for the next approach", ringsReset.phase === "TAXI" && ringsReset.eaten === 0, JSON.stringify(ringsReset));

    // both directions: the ring corridor must start at the NEAR threshold and run away from the runway
    const ringSides = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const out = {};
      for (const d of [0, 1]) {
        L.api.spawnAt(d, d);            // origin d, dest 1-d
        const ap = L.AIRPORTS[st.destIdx];
        const sgn = d === 0 ? 1 : -1;     // the end he arrives at
        const near = ap.cz + sgn * T.runwayLength / 2;
        const g = L.rings[0].parent;
        const zs = L.rings.map(r => g.position.z + (g.rotation.y ? -1 : 1) * r.position.z);
        const lastZ = zs[zs.length - 1], firstZ = zs[0];
        // last ring at the near threshold; first ring further out, away from the runway
        out["dir" + d] = { lastAtNear: Math.abs(lastZ - near) < 1, outward: (firstZ - near) * sgn > T.ringStartDistance * 0.9,
          overRunway: zs.some(z => (z - near) * sgn < -5) };
      }
      return out;
    });
    // landing short (on the pad, before the threshold) is a landing, and the
    // wheels never go below the ground
    const shortLanding = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.spawnAt(0, 0);
      L.api.teleportAirborne(260, 0, 14, 0);   // 260 m short, 14 m up, level
      st.gearDown = true;
      L.api.setStick(0, -0.35);                 // push it onto the pad
      let minAbove = Infinity, landedAlong = null;
      for (let i = 0; i < 60 * 20; i++) {
        L.update(1 / 60);
        const g = L.terrainEff(st.x, st.z);
        minAbove = Math.min(minAbove, st.y - g);
        if (st.phase === "LANDED") { landedAlong = st.approachData.along; break; }
        if (st.exploding) break;
      }
      L.api.clearStick();
      return { landed: st.phase === "LANDED", landedAlong: landedAlong && Math.round(landedAlong), minAbove: +minAbove.toFixed(2), gearHeight: T.gearHeight, exploded: st.exploding };
    });
    check("landing: touching down short on the pad lands (no explosion) and the wheels stay above ground",
      shortLanding.landed && shortLanding.landedAlong < -40 && shortLanding.minAbove >= shortLanding.gearHeight - 0.05 && !shortLanding.exploded, JSON.stringify(shortLanding));

    // gear-up approach: alarm before touchdown, then the explosion
    const bellyLanding = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.spawnAt(0, 0);
      L.api.teleportAirborne(500, 0, 3 + 500 * T.glideSlope, 0);
      st.gearDown = false;
      L.api.setStick(0, -0.18);
      const e0 = L.flags.exploded;
      let alarmBeforeCrash = false, alarmAgl = null;
      for (let i = 0; i < 60 * 30; i++) {
        L.update(1 / 60);
        if (!st.exploding && document.getElementById("alarm").classList.contains("on")) {
          alarmBeforeCrash = true;
          if (alarmAgl === null) alarmAgl = +(st.y - L.terrainEff(st.x, st.z)).toFixed(1);
        }
        if (st.exploding || st.phase === "LANDED") break;
      }
      L.api.clearStick();
      const r = { alarmBeforeCrash, alarmAgl, exploded: L.flags.exploded > e0, landed: st.phase === "LANDED" };
      st.gearDown = true;
      return r;
    });
    check("alarm: landing with the gear up strobes on final and explodes on touchdown",
      bellyLanding.alarmBeforeCrash && bellyLanding.exploded && !bellyLanding.landed, JSON.stringify(bellyLanding));

    // gear can't retract while the wheels are on the ground
    const gearGround = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.placeOnRunway();
      st.gearDown = true;
      const g0 = L.flags.gear;
      const tap = () => { document.getElementById("gearBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 9 })); for (let i = 0; i < 20; i++) L.update(1 / 60); };
      tap(); const taxi = st.gearDown;
      L.api.setThrottle(true); for (let i = 0; i < 60; i++) L.update(1 / 60);
      tap(); const roll = st.gearDown && st.phase === "ROLL";
      L.api.setThrottle(false);
      // airborne: retract works, extend works
      L.api.teleportAirborne(2000, 0, 200, 0);
      tap(); const upInAir = !st.gearDown;
      tap(); const downInAir = st.gearDown;
      return { taxi, roll, upInAir, downInAir, flagsUnchangedOnGround: true };
    });
    check("gear: cannot retract on the ground, still cycles in the air", gearGround.taxi && gearGround.roll && gearGround.upInAir && gearGround.downInAir, JSON.stringify(gearGround));

    // shootable targets: balloons, blimp, UFO, boats; a missile pops one and it respawns
    const tg = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const kinds = {};
      for (const t of L.targets) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
      const b = L.targets.find(t => t.kind === "balloon");
      // park 120 m from the balloon, aim straight at it, fire
      st.exploding = false; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0; st.bank = 0;
      st.x = b.x; st.y = b.y + 9; st.z = b.z + 120; st.heading = 0;
      L.api.clearStick();
      const h0 = L.flags.targets;
      L.fireMissile();
      let popped = false;
      for (let i = 0; i < 60 * 4 && !popped; i++) { L.update(1 / 60); popped = L.flags.targets > h0; }
      const hiddenAfter = !b.mesh.visible;
      for (let i = 0; i < 60 * 12; i++) L.update(1 / 60);
      const back = b.alive && b.mesh.visible;
      return { kinds, popped, hiddenAfter, back, n: L.targets.length };
    });
    check("targets: balloons, blimps, UFO, boats, flocks, kites and discs exist; a missile pops a balloon and it comes back",
      tg.kinds.balloon >= 6 && tg.kinds.blimp >= 2 && tg.kinds.ufo >= 1 && tg.kinds.boat >= 4 && tg.kinds.flock >= 3 && tg.kinds.kite >= 4 && tg.kinds.disc >= 6 && tg.popped && tg.hiddenAfter && tg.back, JSON.stringify(tg));

    // every target starts in the open: above ground, not inside a solid, not in a corridor
    const tgPlace = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE;
      const bad = [];
      for (const t of L.targets) {
        const g = Math.max(L.terrainEff(t.x, t.z), T.waterLevel);
        if (t.kind !== "boat" && t.y < g + 5) bad.push({ kind: t.kind, why: "low", y: Math.round(t.y), g: Math.round(g) });
        if (t.kind === "boat" && L.terrainEff(t.x, t.z) > T.waterLevel - 0.5) bad.push({ kind: t.kind, why: "dry" });
        let inside = false;
        L.forEachSolid(b => { if (b.car === undefined && Math.abs(t.x - b.x) < b.hw && Math.abs(t.z - b.z) < b.hd && t.y > b.y0 && t.y < b.y1) inside = true; });
        if (inside) bad.push({ kind: t.kind, why: "inside solid" });
      }
      return bad;
    });
    check("targets: none start underground, inside a solid, or dry", tgPlace.length === 0, JSON.stringify(tgPlace.slice(0, 5)));

    // train cars are shootable: a hit removes the car until the train loops
    const trainShot = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      st.exploding = false; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0; st.bank = 0;
      st.x = 340; st.z = 600; st.y = 400;
      for (let i = 0; i < 60 * 25; i++) L.update(1 / 60);   // let cars enter the track
      const car = L.trainSolids.find(b => b.car === 3);
      if (!car) return { err: "no car" };
      st.x = car.x; st.y = car.y1 + 4; st.z = car.z + 140; st.heading = 0; st.pitch = -3;
      L.update(1 / 60);
      const h0 = L.flags.targets, n0 = L.trainSolids.length;
      L.fireMissile();
      let hit = false;
      for (let i = 0; i < 60 * 4 && !hit; i++) { L.update(1 / 60); hit = L.flags.targets > h0; }
      L.update(1 / 60);   // the train rebuilds its solids on the next frame
      const nAfter = L.trainSolids.length;
      return { hit, fewerCars: nAfter < n0, n0, nAfter };
    });
    check("targets: a missile knocks a car off the freight train", !trainShot.err && trainShot.hit && trainShot.fewerCars, JSON.stringify(trainShot));

    // H4: crossing the threshold high with the stick released must still land (engaged stays on over the runway)
    const highCross = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.spawnAt(0, 0);
      L.api.teleportAirborne(60, 0, 14, 0);   // 60 m short, 14 m up (above flareAgl), level
      st.gearDown = true; st.speedStep = 1;
      L.api.clearStick();
      let engagedOver = false, missed0 = L.flags.missed;
      for (let i = 0; i < 60 * 40; i++) {
        L.update(1 / 60);
        if (st.approachData && st.approachData.along > 100 && st.engaged) engagedOver = true;
        if (st.phase === "LANDED" || st.exploding) break;
      }
      return { landed: st.phase === "LANDED", engagedOver, wentAround: L.flags.missed > missed0, along: st.approachData && Math.round(st.approachData.along) };
    });
    check("landing: a high, hands-off threshold crossing still flares and lands (no forced go-around)",
      highCross.landed && !highCross.wentAround, JSON.stringify(highCross));

    // H5: turning back onto the ORIGIN runway lands (gear down) / explodes (gear up)
    const origin = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const out = {};
      for (const gear of [true, false]) {
        L.api.spawnAt(0, 0);           // origin NY (idx 0), dest CA
        const ap = L.AIRPORTS[0];
        // approach NY from the south (heading +z = PI), lined up, on a slope
        st.phase = "AIRBORNE"; st.exploding = false; st.x = 0; st.z = ap.cz - T.runwayLength / 2 - 500; st.y = ap.elev + 3 + 500 * T.glideSlope;
        st.heading = Math.PI; st.pitch = 0; st.speed = st.vp.cruiseSpeed * 0.7; st.gearDown = gear; st.liftoffTimer = 0;
        L.api.setStick(0, -0.18);
        const e0 = L.flags.exploded, td0 = L.flags.touchdown;
        let minAbove = Infinity;
        for (let i = 0; i < 60 * 40; i++) {
          L.update(1 / 60);
          minAbove = Math.min(minAbove, st.y - L.terrainEff(st.x, st.z));
          if (st.phase === "LANDED" || st.exploding) break;
        }
        L.api.clearStick();
        out[gear ? "gearDown" : "gearUp"] = { landed: L.flags.touchdown > td0, exploded: L.flags.exploded > e0, minAbove: +minAbove.toFixed(2), approachIdx: st.approachIdx };
        if (gear) {
          for (let i = 0; i < 60 * 16 && st.phase !== "TAXI"; i++) L.update(1 / 60);
          out.respawnedAt = st.originIdx;
        }
        st.gearDown = true; st.exploding = false;
      }
      return out;
    });
    check("landing: turning back onto the origin runway lands with gear down and respawns there",
      origin.gearDown.landed && !origin.gearDown.exploded && origin.gearDown.minAbove >= L_GEAR - 0.05 && origin.respawnedAt === 0, JSON.stringify(origin));
    check("landing: origin runway with gear up explodes (no underground skim)",
      origin.gearUp.exploded && !origin.gearUp.landed, JSON.stringify(origin.gearUp));

    // rings re-arm after a go-around
    const rearm = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.spawnAt(0, 0);
      L.api.teleportAirborne(1320, 0, 3 + 1320 * T.glideSlope, 0);
      L.api.setStick(0, -0.18);
      for (let i = 0; i < 60 * 20; i++) { L.update(1 / 60); if (st.approachData && st.approachData.along > -400) break; }
      const eatenBefore = L.rings.filter(r => r.userData.eaten).length;
      // force a go-around: pop up just past the far end of the runway, low
      const ap = L.AIRPORTS[st.destIdx];
      st.z = ap.cz - 100; st.y = ap.elev + 20; st.x = 0;   // ~800 m along: past the midpoint, low
      for (let i = 0; i < 60 * 3 && st.phase !== "CLIMB_AWAY"; i++) L.update(1 / 60);
      const went = st.phase === "CLIMB_AWAY";
      const eatenAfter = L.rings.filter(r => r.userData.eaten).length;
      L.api.clearStick();
      return { eatenBefore, went, eatenAfter };
    });
    check("rewards: rings re-arm on a go-around", rearm.eatenBefore > 0 && rearm.went && rearm.eatenAfter === 0, JSON.stringify(rearm));

    // bridge gates: the hoop must lie entirely in legal air (above water clearance, under the deck collider)
    const gateAir = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE;
      const bad = [];
      for (const g of L.gates) {
        if (g.follow) continue;
        const ground = Math.max(L.terrainEff(g.x, g.z), T.waterLevel);
        const lo = g.y - g.hh, hi = g.y + g.hh;
        if (lo < ground + T.terrainClearance) bad.push({ x: Math.round(g.x), z: Math.round(g.z), lo: +lo.toFixed(1), ground: +ground.toFixed(1) });
        let deckHit = false;
        L.forEachSolid(b => { if (Math.abs(b.x - g.x) < b.hw && Math.abs(b.z - g.z) < b.hd + 4 && b.y0 - 3 < hi && b.y1 + 3 > lo) deckHit = true; });
        if (deckHit) bad.push({ x: Math.round(g.x), z: Math.round(g.z), deckHit: true, hi: +hi.toFixed(1) });
      }
      return { n: L.gates.length, bad };
    });
    check("rewards: every fixed gate sits in legal air (>= 8 m over water, clear of solids)", gateAir.bad.length === 0, JSON.stringify(gateAir));

    // boats: on water all the way round their orbit
    const boats = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE;
      const out = [];
      for (const b of L.targets.filter(t => t.kind === "boat")) {
        let dry = 0, n = 0;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) { n++; if (L.terrainEff(b.cx + Math.cos(a) * b.orbitX, b.cz + Math.sin(a) * b.orbitZ) > T.waterLevel - 0.5) dry++; }
        out.push({ k: +(b.orbitX / (640 * T.routeLength / 12000)).toFixed(2), dry, n });
      }
      return out;
    });
    check("targets: boats stay on the water for the whole orbit", boats.length >= 3 && boats.every(b => b.dry === 0), JSON.stringify(boats));

    // no solid crosses the departure/arrival centreline within |x| < 65 for 2.2 km beyond either runway end
    const centreline = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const bad = [];
      for (const ap of L.AIRPORTS) for (const sgn of [1, -1]) {
        const th = ap.cz + sgn * T.runwayLength / 2;
        const reach = T.ringStartDistance + 100;
        for (let d = 0; d <= reach; d += 300) { st.x = 0; st.z = th + sgn * d; st.y = ap.elev + 200; st.phase = "AIRBORNE"; st.speed = 0; L.update(1 / 60); }
        L.forEachSolid(b => {
          const dz = (b.z - th) * sgn;
          if (dz < -20 || dz > reach) return;
          if (Math.abs(b.x) - b.hw < 65 && b.y1 > ap.elev + 2) bad.push({ x: Math.round(b.x), hw: Math.round(b.hw), dz: Math.round(dz), top: Math.round(b.y1) });
        });
      }
      return bad;
    });
    check("world: nothing solid crosses the runway centreline through the ring corridor beyond either end", centreline.length === 0, JSON.stringify(centreline.slice(0, 5)));

    // traffic never lingers in the ring tunnel at glide altitude
    const trafficCorr = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const t = L.traffic[0];
      const ap = L.AIRPORTS[1];
      t.alive = true; t.mesh.visible = true; t.heading = 0; t.x = 10; t.z = ap.cz + T.runwayLength / 2 + 900; t.y = ap.elev + 100; t.speed = 40;
      st.x = 600; st.z = 0; st.y = 300; st.phase = "AIRBORNE"; st.speed = 0;
      let low = 0;
      for (let i = 0; i < 60 * 25; i++) {
        L.update(1 / 60);
        const inC = Math.abs(t.x) < T.runwayWidth / 2 + 35 && Math.abs(t.z - ap.cz) < T.runwayLength / 2 + T.ringStartDistance;
        if (inC && t.y < ap.elev + 200 && i > 60 * 8) low++;
      }
      return { low, x: Math.round(t.x), y: Math.round(t.y) };
    });
    check("traffic: a plane entering the corridor climbs/slips out within seconds", trafficCorr.low === 0, JSON.stringify(trafficCorr));

    // keyboard: blur releases held keys
    const kbBlur = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.placeOnRunway();
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      const held = st.touching && st.throttleHeld;
      window.dispatchEvent(new Event("blur"));
      for (let i = 0; i < 5; i++) L.update(1 / 60);
      return { held, releasedStick: !st.touching && st.ctrlPitch === 0, releasedThrottle: !st.throttleHeld };
    });
    check("keyboard: blur releases held arrow + throttle keys", kbBlur.held && kbBlur.releasedStick && kbBlur.releasedThrottle, JSON.stringify(kbBlur));

    // fighter: throttle held past the runway end stops within a few hundred metres and respawns
    const overrun = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      L.api.setVehicle("fighter"); L.api.placeOnRunway();
      L.api.setThrottle(true);
      const ap = L.AIRPORTS[0];
      let maxPast = 0, repos0 = L.flags.repositioned;
      for (let i = 0; i < 60 * 90 && L.flags.repositioned === repos0; i++) {
        L.update(1 / 60);
        maxPast = Math.max(maxPast, (ap.cz - st.z) - T.runwayLength / 2);
      }
      L.api.setThrottle(false); L.api.setVehicle("prop");
      return { maxPast: Math.round(maxPast), respawned: L.flags.repositioned > repos0 };
    });
    check("ground: fighter with throttle held past the end stops < 400 m out and respawns", overrun.respawned && overrun.maxPast < 400, JSON.stringify(overrun));

    // sky button: rain brings precipitation + rain loop, night lights the windows, sun clears it
    const sky = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const out = {};
      const tap = () => document.getElementById("skyBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 11 }));
      const settle = () => { for (let i = 0; i < 60 * 5; i++) L.update(1 / 60); };
      st.sky = 0; settle();
      tap(); settle(); out.rain = { mode: st.sky, precip: L.precip.visible, rainF: +st.rainF.toFixed(2), fogFar: Math.round(window.__lp.state.rainF > 0.9 ? 950 : -1) };
      tap(); settle(); out.snow = { mode: st.sky, precip: L.precip.visible, snowF: +st.snowF.toFixed(2) };
      tap(); settle(); out.night = { mode: st.sky, windows: L.windowInst.visible, nightF: +st.nightF.toFixed(2), stars: +window.__lp.state.nightF.toFixed(2) };
      tap(); settle(); out.sun = { mode: st.sky, precip: L.precip.visible, windows: L.windowInst.visible };
      out.saved = localStorage.getItem("lp.sky");
      return out;
    });
    check("sky: sun -> rain (drops) -> snow (flakes) -> night (windows lit) -> sun, and the choice is saved",
      sky.rain.mode === 1 && sky.rain.precip && sky.rain.rainF > 0.9 && sky.snow.mode === 2 && sky.snow.precip && sky.snow.snowF > 0.9 &&
      sky.night.mode === 3 && sky.night.windows && sky.night.nightF > 0.9 && sky.sun.mode === 0 && !sky.sun.precip && !sky.sun.windows && sky.saved === "0",
      JSON.stringify(sky));

    // buzz the airport: low over the apron opens the hangar doors
    const buzz = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const a = L.airports[0];
      st.exploding = false; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0;
      st.x = a.m * 170; st.z = a.cz; st.y = L.AIRPORTS[0].elev + 40; st.heading = 0; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9;
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      const open = a.doors.map(d => Math.abs(d.position.x - d.userData.baseX));
      st.y = L.AIRPORTS[0].elev + 400;
      for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
      const closed = a.doors.map(d => Math.abs(d.position.x - d.userData.baseX));
      return { buzz: +a.buzz.toFixed(2), open: open.map(v => Math.round(v)), closed: closed.map(v => Math.round(v)) };
    });
    check("world: buzzing the apron slides the hangar doors open, then they close again", buzz.open.every(v => v > 20) && buzz.closed.every(v => v < 3), JSON.stringify(buzz));

    // bridges bounce after a gate pass
    const hoop = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const bridge = L.gates.find(g => g.bounceGroup);
      if (!bridge) return { err: "no bridge gate" };
      st.exploding = false; st.phase = "AIRBORNE"; st.pitch = 0;
      st.x = bridge.x; st.y = bridge.y; st.z = bridge.z + 40; st.heading = 0; st.speed = 50;
      let bounced = false;
      for (let i = 0; i < 60 * 2; i++) { L.update(1 / 60); if (bridge.bounceT > 0 && Math.abs(bridge.bounceGroup.position.y - bridge.bounceBaseY) > 0.3) bounced = true; }
      return { bounced };
    });
    check("world: bridges bounce when flown under", !hoop.err && hoop.bounced, JSON.stringify(hoop));

    // sparkle spots: 20 gems in the open air; flying through one lights it for good and saves
    const spotsR = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const bad = [];
      for (const sp of L.spots) {
        const g = Math.max(L.terrainEff(sp.x, sp.z), T.waterLevel);
        if (sp.y < g + 4) bad.push({ why: "low", x: Math.round(sp.x), z: Math.round(sp.z) });
        let inside = false;
        L.forEachSolid(b => { if (b.car === undefined && Math.abs(sp.x - b.x) < b.hw && Math.abs(sp.z - b.z) < b.hd && sp.y > b.y0 && sp.y < b.y1) inside = true; });
        if (inside) bad.push({ why: "inside solid", x: Math.round(sp.x), z: Math.round(sp.z) });
      }
      const sp = L.spots[0];
      st.exploding = false; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0;
      st.x = sp.x; st.y = sp.y; st.z = sp.z; st.heading = 0;
      const f0 = L.flags.spots || 0;
      for (let i = 0; i < 10; i++) L.update(1 / 60);
      const saved = localStorage.getItem("lp.spots");
      return { n: L.spots.length, bad, lit: sp.lit && sp.beam.visible, gained: (L.flags.spots || 0) - f0, saved: !!saved && saved.startsWith("[1") };
    });
    check("spots: 20 sparkle spots in clear air; flying through one lights it and it is remembered",
      spotsR.n === 20 && spotsR.bad.length === 0 && spotsR.lit && spotsR.gained === 1 && spotsR.saved, JSON.stringify(spotsR));

    // arrival show + apron vehicles, on a fresh page (no state carried over)
    {
      const fresh = await newPage(1180, 820);
      const p2 = fresh.page;
      await p2.evaluate(() => { window.__lp.noRender = true; });
      // arrival show + apron vehicles: landing brings fireworks, chasing lights, and the trucks drive out
      const arrival = await p2.evaluate(() => {
        const L = window.__lp, T = L.TUNE, st = L.state;
        L.api.spawnAt(0, 0);
        L.api.teleportAirborne(400, 0, 3 + 400 * T.glideSlope, 0);
        st.gearDown = true; L.api.setStick(0, -0.18);
        for (let i = 0; i < 60 * 30 && st.phase !== "LANDED"; i++) L.update(1 / 60);
        L.api.clearStick();
        for (let i = 0; i < 60 * 25 && !st.celebrated; i++) L.update(1 / 60);
        const a = L.airports.find(r => r.idx === st.landedIdx);
        const homeD = a.vehicles.map(v => Math.round(Math.hypot(v.x - v.homeX, v.z - v.homeZ)));
        for (let i = 0; i < 60 * 3.5; i++) L.update(1 / 60);
        const planeD = a.vehicles.map(v => Math.round(Math.hypot(v.x - st.x, v.z - st.z)));
        const stillCelebrating = st.celebrated;
        let fireworksSeen = false;
        for (let i = 0; i < 60 * 2; i++) { L.update(1 / 60); if (L.wakePuffsAlive() > 6) fireworksSeen = true; }
        return { celebrated: stillCelebrating, landedIdx: st.landedIdx, homeD, planeD, fireworksSeen };
      });
      check("arrival: fireworks over the terminal and the apron trucks drive out to the plane",
        arrival.celebrated && arrival.fireworksSeen && arrival.planeD.every(d => d < 40), JSON.stringify(arrival));
      await p2.close();
    }

    // photo: the camera button grabs the rendered frame into a polaroid overlay
    const photo = await page.evaluate(() => new Promise(resolve => {
      const L = window.__lp, st = L.state;
      L.noRender = false;
      document.getElementById("camBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 21 }));
      const pending = st.photoPending;
      // run two real frames so the render + grab happen
      const q1 = window.__rafQueue.splice(0); if (q1.length) q1[q1.length - 1](window.__simTime += 1000 / 60);
      const q2 = window.__rafQueue.splice(0); if (q2.length) q2[q2.length - 1](window.__simTime += 1000 / 60);
      L.noRender = true;
      const img = document.getElementById("photoImg");
      resolve({ pending, shown: document.getElementById("photo").classList.contains("on"), hasImage: img.src.startsWith("data:image/jpeg") && img.src.length > 5000, photos: L.flags.photos || 0 });
    }));
    check("photo: camera button captures the frame into the polaroid overlay", photo.pending && photo.shown && photo.hasImage && photo.photos >= 1, JSON.stringify(photo));

    // fly-by hellos: the tower cab flashes when you pass close
    const flyby = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const a = L.airports[0];
      st.exploding = false; st.phase = "AIRBORNE"; st.speed = 0; st.pitch = 0; st.liftoffTimer = 0; st.maxAglSinceLiftoff = 1e9;
      st.x = a.m * 150 + 30; st.z = a.cz + 260 + 30; st.y = L.AIRPORTS[0].elev + 50; st.heading = 0;
      let flashed = false;
      for (let i = 0; i < 60; i++) { L.update(1 / 60); if (a.cab.material.color.getHex() === 0xfff3a8) flashed = true; }
      return { flyby: +a.flyby.toFixed(2), flashed };
    });
    check("world: passing the control tower flashes its cab", flyby.flashed, JSON.stringify(flyby));

    check("rewards: ring corridor anchors at the near threshold in both directions",
      [0, 1].every(d => ringSides["dir" + d].lastAtNear && ringSides["dir" + d].outward && !ringSides["dir" + d].overRunway), JSON.stringify(ringSides));

    // gates: three kinds exist; flying through the canyon gate triggers a fanfare once, then re-arms
    const gate = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const gs = L.gates;
      const canyon = gs.find(g => !g.follow && Math.abs(g.z + 3800 * (T.routeLength / 12000)) < 1);
      const train = gs.find(g => g.follow);
      const bridges = gs.filter(g => !g.follow && g !== canyon).length;
      if (!canyon) return { err: "no canyon gate", n: gs.length };
      L.api.skipScreens();
      st.phase = "AIRBORNE"; st.exploding = false; st.x = canyon.x; st.y = canyon.y; st.z = canyon.z + 60; st.heading = 0; st.pitch = 0; st.speed = 50;
      L.api.clearStick();
      const g0 = L.flags.gates;
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      const after1 = L.flags.gates - g0;
      const wasGreen = canyon.green > 0;
      // come back through immediately: cooldown means no second fanfare
      st.x = canyon.x; st.y = canyon.y; st.z = canyon.z + 60; st.heading = 0; st.speed = 50;
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      const after2 = L.flags.gates - g0;
      return { n: gs.length, bridges, train: !!train, after1, after2, wasGreen, cooldown: canyon.cooldown };
    });
    check("rewards: gates exist under bridges, in the canyon and on the train", !gate.err && gate.bridges >= 2 && gate.train, JSON.stringify(gate));
    check("rewards: canyon gate fires once, turns green, then re-arms", !gate.err && gate.after1 === 1 && gate.after2 === 1 && gate.wasGreen && gate.cooldown > 0, JSON.stringify(gate));

    // wingman: park next to a traffic plane for the hold time
    const wing = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const t = L.traffic.find(x => x.alive);
      const w0 = L.flags.wingman;
      st.phase = "AIRBORNE"; st.exploding = false; st.speedStep = 1;
      let nearSeen = false;
      for (let i = 0; i < 60 * (T.wingmanHold + 1.5); i++) {
        st.x = t.x + 20; st.y = t.y; st.z = t.z; st.speed = t.speed; st.heading = t.heading;
        L.update(1 / 60);
        if (document.getElementById("wingman").classList.contains("near")) nearSeen = true;
      }
      return { nearSeen, gained: L.flags.wingman - w0, done: document.getElementById("wingman").classList.contains("done") };
    });
    check("rewards: wingman icon lights when close and fires after the hold", wing.nearSeen && wing.gained === 1, JSON.stringify(wing));

    // crash aftermath: smoke + crater linger, shattered pieces stay hidden longer than the plane
    const aftermath = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const half = T.routeLength / 2;
      // find dry land mid-route
      let gx = 300, gz = 0;
      for (let z = -half + 2000; z < half - 2000; z += 200) { if (L.terrainEff(300, z) > T.waterLevel + 5) { gz = z; break; } }
      const gy = L.terrainEff(gx, gz);
      st.phase = "AIRBORNE"; st.exploding = false; st.x = gx; st.z = gz; st.y = gy + 40; st.pitch = -60; st.speed = 60; st.heading = 0;
      L.api.setStick(0, -1);
      let t = 0;
      for (; t < 60 * 6 && !st.exploding; t++) L.update(1 / 60);
      L.api.clearStick();
      const smoke = L.smokeSources.length, crater = L.craters.filter(c => c.life > 0).length;
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      const smokeLater = L.smokeSources.length, craterLater = L.craters.filter(c => c.life > 0).length;
      return { exploded: t < 360, smoke, crater, smokeLater, craterLater, popped: st.popTimer > 0 || !st.exploding };
    });
    check("crash: leaves a smoke column and a crater that outlast the reassemble",
      aftermath.exploded && aftermath.smoke > 0 && aftermath.crater > 0 && aftermath.smokeLater > 0 && aftermath.craterLater > 0, JSON.stringify(aftermath));

    // alarm: diving at terrain strobes + beeps; a normal approach does not
    const alarm = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const half = T.routeLength / 2;
      let gz = 0;
      for (let z = -half + 2000; z < half - 2000; z += 200) { if (L.terrainEff(300, z) > T.waterLevel + 5) { gz = z; break; } }
      const gy = L.terrainEff(300, gz);
      st.exploding = false; st.phase = "AIRBORNE"; st.x = 300; st.z = gz; st.y = gy + 60; st.pitch = -45; st.speed = 60; st.heading = 0; st.liftoffTimer = 0;
      L.api.setStick(0, -1);
      const a0 = L.flags.alarms;
      let on = false;
      for (let i = 0; i < 60 * 4 && !st.exploding; i++) { L.update(1 / 60); if (document.getElementById("alarm").classList.contains("on")) on = true; }
      L.api.clearStick();
      const diveAlarm = on && L.flags.alarms > a0;
      // approach: on-slope, engaged, gear down -> no alarm even on short final
      st.exploding = false;
      L.api.teleportAirborne(400, 0, 3 + 400 * T.glideSlope, 0);
      st.gearDown = true;
      L.api.setStick(0, -0.18);
      let approachAlarm = false;
      for (let i = 0; i < 60 * 25; i++) { L.update(1 / 60); if (document.getElementById("alarm").classList.contains("on")) approachAlarm = true; if (st.phase === "LANDED") break; }
      L.api.clearStick();
      return { diveAlarm, approachAlarm, landed: st.phase === "LANDED", off: !document.getElementById("alarm").classList.contains("on") };
    });
    check("alarm: strobes on a dive into terrain, silent on a normal approach", alarm.diveAlarm && !alarm.approachAlarm && alarm.landed && alarm.off, JSON.stringify(alarm));

    // keyboard: arrows steer (up = nose up), space throttles, keys toggle
    const kb = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.placeOnRunway();
      const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      fire("keydown", "Space");
      for (let i = 0; i < 60 * 6; i++) {
        L.update(1 / 60);
        if (st.canRotate) fire("keydown", "ArrowUp");
        if (st.phase === "AIRBORNE") break;
      }
      const tookOff = st.phase === "AIRBORNE";
      fire("keyup", "ArrowUp"); fire("keyup", "Space");
      const thr = st.throttleHeld;
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      fire("keydown", "ArrowUp");
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      const pitchUp = st.ctrlPitch > 0.5 && st.touching;
      fire("keyup", "ArrowUp");
      for (let i = 0; i < 5; i++) L.update(1 / 60);
      const released = !st.touching && st.ctrlPitch === 0;
      const v0 = st.viewChase; fire("keydown", "KeyV"); fire("keyup", "KeyV"); for (let i = 0; i < 2; i++) L.update(1 / 60);
      const g0 = st.gearDown; fire("keydown", "KeyG"); fire("keyup", "KeyG"); for (let i = 0; i < 2; i++) L.update(1 / 60);
      const s0 = st.speedStep; fire("keydown", "Equal"); fire("keyup", "Equal");
      return { tookOff, throttleReleased: !thr, pitchUp, released, view: st.viewChase !== v0, gear: st.gearDown !== g0, step: st.speedStep === Math.min(s0 + 1, L.TUNE.speedSteps.length - 1) };
    });
    check("keyboard: space + arrow-up takes off, arrows steer, keys toggle view/gear/speed", Object.values(kb).every(Boolean), JSON.stringify(kb));
    await page.close();

    // persistence: a chosen vehicle + direction is restored on the next launch
    {
      const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
      const p1 = await ctx.newPage();
      await p1.addInitScript(() => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; });
      await p1.goto(URL);
      await p1.waitForFunction(() => window.__lp);
      await p1.click('[data-v="fighter"]');
      await p1.click('[data-d="1"]');
      const p2 = await ctx.newPage();
      await p2.addInitScript(() => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; });
      await p2.goto(URL);
      await p2.waitForFunction(() => window.__lp);
      const restored = await p2.evaluate(() => ({
        key: window.__lp.state.vehicleKey, dir: window.__lp.state.dirIdx, phase: window.__lp.state.phase,
        pickerHidden: document.getElementById("screenVehicle").classList.contains("hiddenS"),
      }));
      await p2.evaluate(() => { window.__lp.update(1 / 60); });
      const vehBtnShown = await p2.evaluate(() => !document.getElementById("vehBtn").classList.contains("hidden"));
      await p2.click("#vehBtn");
      const pickerBack = await p2.evaluate(() => !document.getElementById("screenVehicle").classList.contains("hiddenS"));
      check("persistence: relaunch restores vehicle + direction straight to the runway; plane button reopens the picker",
        restored.key === "fighter" && restored.dir === 1 && restored.phase === "TAXI" && restored.pickerHidden && vehBtnShown && pickerBack, JSON.stringify({ restored, vehBtnShown, pickerBack }));
      await ctx.close();
    }
  }

  // ---------- T-V visual regression (perceptual hashes of fixed scenes) ----------
  {
    const fs = require("fs");
    const baselinePath = path.resolve(__dirname, "visual_baseline.json");
    const update = !!process.env.UPDATE_VISUAL;
    let baseline = {};
    try { baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")); } catch (e) {}
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.api.skipScreens(); for (const t of window.__lp.traffic) t.mesh.visible = false; });
    const scenes = {
      "runway-ny-cockpit": () => { window.__lp.api.placeOnRunway(); window.__lp.api.setView(false); },
      "chase-canyon": () => { const T = window.__lp.TUNE; window.__lp.api.setView(true); const st = window.__lp.state; st.phase = "AIRBORNE"; st.x = 0; st.z = -3800 * (T.routeLength / 12000) + 420; st.y = T.waterLevel + 140; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = 0; },
      "approach-rings": () => { const T = window.__lp.TUNE; window.__lp.api.setView(false); window.__lp.api.teleportAirborne(700, 0, 3 + 700 * T.glideSlope, 0); window.__lp.state.speed = 0; },
      "ny-skyline-chase": () => { const T = window.__lp.TUNE; window.__lp.api.setView(true); const st = window.__lp.state; st.phase = "AIRBORNE"; st.x = 0; st.z = T.routeLength / 2 - 1900; st.y = 160; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = 0; },
    };
    const got = {};
    for (const [name, setup] of Object.entries(scenes)) {
      got[name] = await page.evaluate(async (src) => {
        const L = window.__lp;
        L.noRender = true;
        (new Function(src))();
        // let the chase camera finish its lerp and scenery stream in before hashing
        for (let i = 0; i < 150; i++) { const q = window.__rafQueue.splice(0); if (q.length) q[q.length - 1](window.__simTime += 1000 / 60); }
        L.noRender = false;
        const q = window.__rafQueue.splice(0); if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
        const gl = document.getElementById("gl");
        const c = document.createElement("canvas"); c.width = 96; c.height = 54;
        const cx = c.getContext("2d");
        cx.drawImage(gl, 0, 0, 96, 54);
        const d = cx.getImageData(0, 0, 96, 54).data;
        const out = [];
        for (let i = 0; i < d.length; i += 4) out.push(Math.round((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11)));
        return out;
      }, "(" + setup.toString() + ")()");
      await page.screenshot({ path: path.join(SHOTS, `visual-${name}.png`) });
    }
    if (update) {
      fs.writeFileSync(baselinePath, JSON.stringify(got));
      console.log("INFO  visual: baseline written to scripts/visual_baseline.json");
    } else {
      for (const [name, hash] of Object.entries(got)) {
        const ref = baseline[name];
        if (!ref) { console.log(`INFO  visual: no baseline for ${name} (run with UPDATE_VISUAL=1)`); continue; }
        let sum = 0, blank = hash.every(v => v === hash[0]);
        for (let i = 0; i < hash.length; i++) sum += Math.abs(hash[i] - ref[i]);
        const mean = sum / hash.length;
        check(`visual: ${name} matches baseline`, mean < 6 && !blank, `mean |diff| ${mean.toFixed(1)}/255${blank ? " BLANK FRAME" : ""}`);
      }
    }
    await page.close();
  }

  // ---------- T-K rocket: staging, booster landing, Moon and Mars ----------
  {
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); });

    const launch = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune;
      const stageBtn = document.getElementById("stageBtn");
      const out = { pitchOnPad: Math.round(st.pitch), btnHiddenOnPad: stageBtn.classList.contains("hidden"), canDropLow: null, canDropHigh: null };
      L.api.setThrottle(true);
      let liftoffAt = null, alt = 0;
      for (let i = 0; i < 60 * 40; i++) {
        L.update(1 / 60);
        alt = st.y - L.terrainEff(st.x, st.z);
        if (liftoffAt === null && st.phase === "AIRBORNE") liftoffAt = i / 60;
        if (st.phase === "AIRBORNE" && alt < R.stageAlt[0] - 50 && out.canDropLow === null) out.canDropLow = L.rocketCanDrop();
        if (alt >= R.stageAlt[0] + 20) { out.canDropHigh = L.rocketCanDrop(); break; }
      }
      out.liftoffAt = liftoffAt; out.alt = Math.round(alt); out.btnShownHigh = !stageBtn.classList.contains("hidden"); out.stage = L.rk.stage;
      // drop the booster
      const dropped = L.dropStage();
      out.dropped = dropped; out.stageAfter = L.rk.stage; out.falling = L.fallingStages.length;
      out.boosterKind = L.fallingStages[0] && L.fallingStages[0].kind;
      // keep climbing to the fairing and stage-2 altitudes, dropping as allowed
      for (let i = 0; i < 60 * 90 && L.rk.stage < 3; i++) { L.update(1 / 60); if (L.rocketCanDrop()) L.dropStage(); }
      out.finalStage = L.rk.stage; out.altEnd = Math.round(st.y - L.terrainEff(st.x, st.z)); out.spaceF = +st.spaceF.toFixed(2);
      // the booster should have landed on its legs by now
      let boosterLanded = false;
      for (let i = 0; i < 60 * 40 && !boosterLanded; i++) { L.update(1 / 60); boosterLanded = (L.flags.boosterLandings || 0) > 0; }
      out.boosterLanded = boosterLanded;
      L.api.setThrottle(false);
      return out;
    });
    check("rocket: sits upright on the pad; stage button only above the booster altitude",
      launch.pitchOnPad === 90 && launch.btnHiddenOnPad && launch.canDropLow === false && launch.canDropHigh === true && launch.btnShownHigh, JSON.stringify(launch));
    check("rocket: three manual drops (booster, fairing, second stage) each gated by altitude; ends as the capsule in space",
      launch.dropped && launch.stageAfter === 1 && launch.boosterKind === "booster" && launch.finalStage === 3 && launch.spaceF > 0.9, JSON.stringify(launch));
    check("rocket: the dropped booster flies itself down and lands on its legs", launch.boosterLanded, JSON.stringify({ boosterLanded: launch.boosterLanded }));

    const moon = await page.evaluate(() => {
      const L = window.__lp, st = L.state, R = L.TUNE.rocketTune, m = L.BODIES[0];
      // approach the Moon slowly from below: land
      st.exploding = false; st.phase = "AIRBORNE"; st.throttleHeld = false;
      st.x = m.x; st.y = m.y - m.r - 60; st.z = m.z; st.pitch = 90; st.heading = 0;
      L.rk.vx = 0; L.rk.vy = 12; L.rk.vz = 0;
      const l0 = L.flags.moonLandings || 0;
      for (let i = 0; i < 60 * 20 && (L.flags.moonLandings || 0) === l0; i++) L.update(1 / 60);
      const landed = (L.flags.moonLandings || 0) > l0;
      const onMoon = L.rk.onBody && L.rk.onBody.name === "moon";
      const restocked = L.rk.stage === 0;
      const spaceStays = st.spaceF > 0.5;
      // launch again from the Moon
      L.api.setThrottle(true);
      let left = false;
      for (let i = 0; i < 60 * 15; i++) { L.update(1 / 60); if (st.phase === "AIRBORNE" && Math.hypot(st.x - m.x, st.y - m.y, st.z - m.z) > m.r + 40) { left = true; break; } }
      L.api.setThrottle(false);
      // now crash into Mars fast: explode + reassemble above it
      const mars = L.BODIES[1];
      st.exploding = false; st.phase = "AIRBORNE"; st.x = mars.x; st.y = mars.y - mars.r - 200; st.z = mars.z; st.pitch = 90;
      L.rk.vx = 0; L.rk.vy = 150; L.rk.vz = 0;
      const e0 = L.flags.exploded;
      for (let i = 0; i < 60 * 8 && L.flags.exploded === e0; i++) L.update(1 / 60);
      const crashed = L.flags.exploded > e0;
      for (let i = 0; i < 60 * 4 && st.exploding; i++) L.update(1 / 60);
      const back = !st.exploding && Math.hypot(st.x - mars.x, st.y - mars.y, st.z - mars.z) > mars.r + 30 && L.rk.stage === 0;
      return { landed, onMoon, restocked, spaceStays, left, crashed, back };
    });
    check("rocket: a slow approach lands on the Moon (stack restored, space stays), and it can launch again",
      moon.landed && moon.onMoon && moon.restocked && moon.spaceStays && moon.left, JSON.stringify(moon));
    check("rocket: hitting Mars fast explodes and reassembles above it with the full stack", moon.crashed && moon.back, JSON.stringify(moon));

    // return to Earth: descend upright and slowly = a landing
    const home = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const ap = L.AIRPORTS[0];
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null;
      st.x = 0; st.z = ap.cz; st.y = ap.elev + 120; st.pitch = 90; st.heading = 0;
      L.rk.vx = 0; L.rk.vy = -8; L.rk.vz = 0;
      const r0 = L.flags.rocketLandings || 0, e0 = L.flags.exploded;
      // feather it down: burn when falling faster than 10
      for (let i = 0; i < 60 * 40 && st.phase !== "TAXI"; i++) { L.api.setThrottle(L.rk.vy < -9); L.update(1 / 60); }
      L.api.setThrottle(false);
      return { landed: (L.flags.rocketLandings || 0) > r0, exploded: L.flags.exploded > e0, phase: st.phase, pitch: Math.round(st.pitch) };
    });
    check("rocket: a slow upright descent onto the Earth lands (Falcon style)", home.landed && !home.exploded && home.phase === "TAXI", JSON.stringify(home));
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
          const txt = await r.text();
          out[f] = r.status === 200 && (f.endsWith(".json") ? !!JSON.parse(txt).start_url : txt.length > 100);
          if (f === "../sw.js") out.rootIsDistinct = /little-pilot-v\d+/.test(txt) && !/cockpit/.test(txt.split("\n")[0]);
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
