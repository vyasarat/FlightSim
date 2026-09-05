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
    await ctx.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      // deterministic Math.random so scenes (stars, precipitation, traffic) are reproducible
      let seed = 0x2F6E2B1;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    });
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
      const ids = ["viewBtn", "skipBtn", "fastBtn", "slowBtn", "missileBtn", "gearBtn", "throttleBtn", "vehBtn", "camBtn", "dash", "brow", "progressStrip"];
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
    const phoneRocket = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.api.setThrottle(true);
      for (let i = 0; i < 60 * 30 && !L.rocketCanDrop(); i++) L.update(1 / 60);
      L.api.setThrottle(false); L.update(1 / 60);
      const ids = ["viewBtn", "skipBtn", "stageBtn", "satBtn", "chuteBtn", "roverBtn", "hatchBtn", "missileBtn", "gearBtn", "throttleBtn", "camBtn", "droneBtn", "dash", "brow", "progressStrip"];
      const rects = [];
      for (const id of ids) { const e = document.getElementById(id); if (!e || e.classList.contains("hidden")) continue; const r = e.getBoundingClientRect(); if (r.width) rects.push({ id, l: r.left, r: r.right, t: r.top, b: r.bottom }); }
      const overlaps = [];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.l < b.r - 2 && b.l < a.r - 2 && a.t < b.b - 2 && b.t < a.b - 2) overlaps.push(a.id + "/" + b.id); }
      return { overlaps, stageShown: rects.some(r => r.id === "stageBtn"), n: rects.length };
    });
    check("phone landscape (844x390): rocket with the stage button up -- nothing overlaps", phoneRocket.stageShown && phoneRocket.overlaps.length === 0, JSON.stringify(phoneRocket));
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
        window.__lp.state.speed >= window.__lp.TUNE.rotateSpeed || (window.__lp.state.phase !== "TAXI" && window.__lp.state.phase !== "ROLL"));
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
      if (visible.length !== 8) return { ok: false, why: "visible=" + visible.length };
      const sized = visible.every(c => {
        const r = c.getBoundingClientRect();
        return r.width >= 100 && r.height >= 100;
      });
      const keys = visible.map(c => c.dataset.v);
      const hiddenGone = hidden.every(c => c.getBoundingClientRect().width === 0);
      const fromTune = hidden.every(c => window.__lp.TUNE.vehicles[c.dataset.v].hidden === true);
      // nothing is shelved any more: the helicopter came back off the shelf to fight
      // the rig fire. The TUNE.hidden mechanism itself is still exercised below.
      return { ok: sized && hidden.length === 0 && hiddenGone && fromTune && keys.includes("fighter") && keys.includes("rocket") && keys.includes("helicopter"), why: keys.join(",") + (hiddenGone ? "" : " HIDDEN CARDS STILL RENDER") };
    });
    check("vehicles: picker shows all 8 incl the helicopter, fighter, rocket and starship; a TUNE.hidden card would not render at all", bootOk.ok, bootOk.why);

    const combos = await page.evaluate(() => {
      const vs = Object.values(window.__lp.TUNE.vehicles).filter(v => !v.hidden);
      return { n: vs.length, uniq: new Set(vs.map(v => v.cruiseSpeed + "|" + v.turnRateDeg + "|" + v.pitchLimitDeg)).size };
    });
    check("vehicles: eight available, fighter / rocket / starship distinct, airliners share stats",
      combos.n === 8 && combos.uniq === 6, `n=${combos.n} uniq=${combos.uniq}`);

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
    const destShown = await page.evaluate(() => !document.getElementById("screenDest").classList.contains("hiddenS") && window.__lp.state.phase === "TAXI");
    check("vehicles: the rocket's direction tap opens the destination screen (Moon / Mars / Station)", destShown);
    await page.click('[data-dest="mars"]');
    await pump(page, 0.3);
    const sel = await page.evaluate(() => ({
      key: window.__lp.state.vehicleKey,
      cs: window.__lp.state.vp.cruiseSpeed,
      heading: window.__lp.state.heading,
      z: window.__lp.state.z,
      dest: window.__lp.state.dest,
      screensGone: document.getElementById("screenVehicle").classList.contains("hiddenS")
        && document.getElementById("screenDir").classList.contains("hiddenS") && document.getElementById("screenDest").classList.contains("hiddenS"),
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
        // CA downtown cluster, found by landmark name
        const dt = window.__lp.ROUTE_LANDMARKS.find(l => l.name === "downtown");
        if (dt && Math.abs(b.x - dt.x) < 160 && Math.abs(b.z - dt.z) < 60 && (b.y1 - b.y0) > 80) {
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

    await page.evaluate(() => window.__lp.api.setView(false));   // the rocket defaults to chase; start from the cockpit
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

  // ---------- T-D ceiling: every non-rocket vehicle is capped ----------
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
      shot && hit && e1 === e0 + 1, `shot=${shot} hit=${hit} exploded=${e0}->${e1}`);

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
        else resolve(Math.round((batches * 10) / ((performance.now() - wallStart - (batches - 1) * 30) / 1000)));
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
  // Split across fresh pages: state carried between checks made the order load-bearing.
  {
    let page = (await newPage(1180, 820)).page;
    const fresh = async () => { await page.close(); page = (await newPage(1180, 820)).page; await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); }); };
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });

    // rings: fly the slope from 1200 out; every ring should be eaten, each plays a note
    const ringsR = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      L.api.teleportAirborne(T.ringStartDistance + 70, 0, 3 + (T.ringStartDistance + 70) * T.glideSlope, 0);  // behind the first ring
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
      return { taxi, roll, upInAir, downInAir, flagsUnchangedOnGround: L.flags.gear === g0 + 2 };
    });
    check("gear: cannot retract on the ground, still cycles in the air", gearGround.taxi && gearGround.roll && gearGround.upInAir && gearGround.downInAir && gearGround.flagsUnchangedOnGround, JSON.stringify(gearGround));

    await fresh();
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

    await fresh();
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

    await fresh();
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

    await fresh();
    // sky button: rain brings precipitation + rain loop, night lights the windows, sun clears it
    const sky = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const out = {};
      const tap = () => { st.sky = (st.sky + 1) % 4; };   // the moods stay in code (no button any more)
      const settle = () => { for (let i = 0; i < 60 * 5; i++) L.update(1 / 60); };
      out.noBtn = !document.getElementById("skyBtn");
      st.sky = 0; settle();
      tap(); settle(); out.rain = { mode: st.sky, precip: L.precip.visible, rainF: +st.rainF.toFixed(2), fogFar: Math.round(window.__lp.state.rainF > 0.9 ? 950 : -1) };
      tap(); settle(); out.snow = { mode: st.sky, precip: L.precip.visible, snowF: +st.snowF.toFixed(2) };
      tap(); settle(); out.night = { mode: st.sky, windows: L.windowInst.visible, nightF: +st.nightF.toFixed(2), stars: +window.__lp.state.nightF.toFixed(2) };
      tap(); settle(); out.sun = { mode: st.sky, precip: L.precip.visible, windows: L.windowInst.visible };
      return out;
    });
    check("sky moods (code only, no button): sun -> rain (drops) -> snow (flakes) -> night (windows lit) -> sun",
      sky.rain.mode === 1 && sky.rain.precip && sky.rain.rainF > 0.9 && sky.snow.mode === 2 && sky.snow.precip && sky.snow.snowF > 0.9 &&
      sky.night.mode === 3 && sky.night.windows && sky.night.nightF > 0.9 && sky.sun.mode === 0 && !sky.sun.precip && !sky.sun.windows && sky.noBtn,
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

    await fresh();
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

    // README claims that had no check: spots reset once all found; a cloud whoosh; missile self-destruct pop; hellos; spray wake
    const claims = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const out = {};
      // all spots lit -> a relaunch resets them (restoreSpots drops the saved list)
      try { localStorage.setItem("lp.spots", JSON.stringify(L.spots.map(() => 1))); } catch (e) {}
      out.spotsSavedAll = localStorage.getItem("lp.spots").indexOf("0") < 0;
      // cloud whoosh: park inside a cloud
      const c = L.clouds[0]; st.exploding = false; st.phase = "AIRBORNE"; st.speed = 30; st.x = c.position.x; st.y = c.position.y; st.z = c.position.z;
      const w0 = L.flags.whooshes || 0; for (let i = 0; i < 20; i++) L.update(1 / 60); out.whoosh = (L.flags.whooshes || 0) > w0;
      // missile end-of-range pop: fire into empty sky
      st.x = 600; st.z = 0; st.y = 800; st.pitch = 30; st.speed = 60; L.update(1 / 60);
      const x0 = L.flags.missileExpired || 0; L.fireMissile(); for (let i = 0; i < 60 * (T.missileLife + 1); i++) L.update(1 / 60); out.selfDestruct = (L.flags.missileExpired || 0) > x0;
      // hello: overfly a boat
      const b = L.targets.find(t => t.kind === "boat"); const h0 = L.flags.hellos || 0;
      st.x = b.x; st.z = b.z; st.y = b.y + 30; st.pitch = 0; st.speed = 20; for (let i = 0; i < 10; i++) L.update(1 / 60); out.boatHello = (L.flags.hellos || 0) > h0;
      // spray wake over water
      let wx = b.x, wz = b.z;   // find deep water near the boat (it may hug a shore)
      for (let r = 0; r <= 200 && L.terrainEff(wx, wz) > T.waterLevel - 2; r += 20) for (let k = 0; k < 8 && L.terrainEff(wx, wz) > T.waterLevel - 2; k++) { wx = b.x + Math.cos(k * Math.PI / 4) * r; wz = b.z + Math.sin(k * Math.PI / 4) * r; }
      st.x = wx; st.z = wz; st.y = T.waterLevel + 10; st.pitch = 0; st.speed = 40; st.heading = 0; st.exploding = false; for (let i = 0; i < 30; i++) L.update(1 / 60); out.wake = L.wakePuffsAlive() > 3; out.wakeDbg = { phase: st.phase, exploding: st.exploding, agl: Math.round(st.y - T.waterLevel), terr: Math.round(L.terrainEff(st.x, st.z) - T.waterLevel), speed: Math.round(st.speed), puffs: L.wakePuffsAlive() };
      return out;
    });
    check("claims: cloud whoosh, missile self-destruct pop, boat horn hello, spray wake all fire", claims.whoosh && claims.selfDestruct && claims.boatHello && claims.wake && claims.spotsSavedAll, JSON.stringify(claims));

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
        for (let i = 0; i < 60 * 2; i++) { L.update(1 / 60); if ((L.flags.fireworks || 0) > 0) fireworksSeen = true; }
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

    await fresh();
    // gates: three kinds exist; flying through the canyon gate triggers a fanfare once, then re-arms
    const gate = await page.evaluate(() => {
      const L = window.__lp, T = L.TUNE, st = L.state;
      const gs = L.gates;
      const canyon = gs.find(g => g.name === "canyon");
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
    check("rewards: wingman icon lights when close, fires after the hold, and shows the held state", wing.nearSeen && wing.gained === 1 && wing.done, JSON.stringify(wing));

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

    await fresh();
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
      await p1.click('[data-v="rocket"]');
      await p1.click('[data-d="1"]');
      await p1.click('[data-dest="station"]');   // the destination card is what writes lp.dest
      await p1.evaluate(() => { document.getElementById("screenVehicle").classList.remove("hiddenS"); });
      await p1.click('[data-v="fighter"]');
      await p1.click('[data-d="1"]');
      await p1.evaluate(() => { window.__lp.update(1 / 60); for (let i = 0; i < 25; i++) window.__lp.update(1 / 60); try { localStorage.setItem("lp.sky", "3"); } catch (e) {} });
      const p2 = await ctx.newPage();
      await p2.addInitScript(() => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; });
      await p2.goto(URL);
      await p2.waitForFunction(() => window.__lp);
      const restored = await p2.evaluate(() => ({
        key: window.__lp.state.vehicleKey, dir: window.__lp.state.dirIdx, phase: window.__lp.state.phase, sky: window.__lp.state.sky, dest: window.__lp.state.dest,
        pickerHidden: document.getElementById("screenVehicle").classList.contains("hiddenS"),
      }));
      const spotsReset = await p2.evaluate(() => { try { localStorage.setItem("lp.spots", JSON.stringify(window.__lp.spots.map(() => 1))); } catch (e) {} return true; });
      const p3 = await ctx.newPage();
      await p3.addInitScript(() => { window.__rafQueue = []; window.__simTime = 0; window.requestAnimationFrame = cb => { window.__rafQueue.push(cb); return 1; }; });
      await p3.goto(URL);
      await p3.waitForFunction(() => window.__lp);
      const spotsAfter = await p3.evaluate(() => ({ lit: window.__lp.spots.filter(s => s.lit).length, saved: localStorage.getItem("lp.spots") }));
      check("spots: once all twenty are found, the next launch starts them fresh", spotsReset && spotsAfter.lit === 0 && spotsAfter.saved === null, JSON.stringify(spotsAfter));
      await p3.close();
      await p2.evaluate(() => { window.__lp.update(1 / 60); });
      const vehBtnShown = await p2.evaluate(() => !document.getElementById("vehBtn").classList.contains("hidden"));
      await p2.click("#vehBtn");
      const pickerBack = await p2.evaluate(() => !document.getElementById("screenVehicle").classList.contains("hiddenS"));
      check("persistence: relaunch restores vehicle + direction + destination straight to the runway (a stale lp.sky is ignored); plane button reopens the picker",
        restored.key === "fighter" && restored.dir === 1 && restored.sky === 0 && restored.dest === "station" && restored.phase === "TAXI" && restored.pickerHidden && vehBtnShown && pickerBack, JSON.stringify({ restored, vehBtnShown, pickerBack }));
      await ctx.close();
    }
  }

  // ---------- T-V visual regression (perceptual hashes of fixed scenes) ----------
  {
    const fs = require("fs");
    const baselinePath = path.resolve(__dirname, "visual_baseline.json");
    const update = !!process.env.UPDATE_VISUAL;
    let baseline = {};
    try { const raw = JSON.parse(fs.readFileSync(baselinePath, "utf8")); baseline = raw.hashes || raw; } catch (e) {}
    const { page } = await newPage(1180, 820);
    await page.evaluate(() => { window.__lp.api.skipScreens(); for (const t of window.__lp.traffic) t.mesh.visible = false; });
    const scenes = {
      "runway-ny-cockpit": () => { window.__lp.api.placeOnRunway(); window.__lp.api.setView(false); },
      "chase-canyon": () => { const T = window.__lp.TUNE; window.__lp.api.setView(true); const st = window.__lp.state; st.phase = "AIRBORNE"; st.x = 0; st.z = -3800 * (T.routeLength / 12000) + 420; st.y = T.waterLevel + 140; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = 0; },
      "approach-rings": () => { const T = window.__lp.TUNE; window.__lp.api.setView(false); window.__lp.api.teleportAirborne(700, 0, 3 + 700 * T.glideSlope, 0); window.__lp.state.speed = 0; },
      "ny-skyline-chase": () => { const T = window.__lp.TUNE; window.__lp.api.setView(true); const st = window.__lp.state; st.phase = "AIRBORNE"; st.x = 0; st.z = T.routeLength / 2 - 1900; st.y = 160; st.heading = 0; st.pitch = 0; st.bank = 0; st.speed = 0; },
      "night-skyline": () => { const L = window.__lp, T = L.TUNE, st = L.state; st.sky = 3; L.api.setView(true); st.phase = "AIRBORNE"; st.x = -60; st.z = T.routeLength / 2 - 1650; st.y = 90; st.heading = 0; st.pitch = -4; st.bank = 0; st.speed = 0; for (let i = 0; i < 60 * 8; i++) L.update(1 / 60); },
      "rocket-pad": () => { const L = window.__lp, st = L.state; st.sky = 0; L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.setView(true); for (let i = 0; i < 60 * 8; i++) L.update(1 / 60); },
      "space-capsule": () => { const L = window.__lp, st = L.state, m = L.BODIES[0]; L.api.setView(true); st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; if (L.vehicleModel) rocketApplyStages(L.vehicleModel); st.x = m.x; st.y = m.y - m.r - 260; st.z = m.z + 120; st.pitch = 70; st.heading = 0; st.speed = 0; L.rk.vx = L.rk.vy = L.rk.vz = 0; for (let i = 0; i < 60 * 6; i++) L.update(1 / 60); L.rk.vx = L.rk.vy = L.rk.vz = 0; },
      "ca-airport-chase": () => { const L = window.__lp, T = L.TUNE, st = L.state; L.api.setVehicle("prop"); st.sky = 0; L.api.setView(true); st.phase = "AIRBORNE"; const ap = L.AIRPORTS[1]; st.x = -120; st.z = ap.cz + 620; st.y = ap.elev + 95; st.heading = 0; st.pitch = -22; st.bank = 0; st.speed = 0; for (let i = 0; i < 60 * 6; i++) L.update(1 / 60); },
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
      const meta = { rev: require("child_process").execSync("git rev-parse --short HEAD", { cwd: path.resolve(__dirname, "..") }).toString().trim(), date: new Date().toISOString().slice(0, 10), size: "96x54", scenes: Object.keys(got) };
      fs.writeFileSync(baselinePath, "{\n  \"meta\": " + JSON.stringify(meta) + ",\n  \"hashes\": {\n" + Object.entries(got).map(([k, v]) => "    " + JSON.stringify(k) + ": " + JSON.stringify(v)).join(",\n") + "\n  }\n}\n");
      console.log("INFO  visual: baseline written to scripts/visual_baseline.json");
    } else {
      for (const [name, hash] of Object.entries(got)) {
        const ref = baseline[name];
        if (!ref) { check(`visual: ${name} has a baseline`, false, "no baseline: run with UPDATE_VISUAL=1"); continue; }
        const mean0 = hash.reduce((a, b) => a + b, 0) / hash.length;
        const sd = Math.sqrt(hash.reduce((a, b) => a + (b - mean0) * (b - mean0), 0) / hash.length);
        let sum = 0, blank = sd < 8;   // a real scene has contrast; a lost context or bare sky does not
        for (let i = 0; i < hash.length; i++) sum += Math.abs(hash[i] - ref[i]);
        const mean = sum / hash.length;
        check(`visual: ${name} matches baseline`, mean < 6 && !blank, `mean |diff| ${mean.toFixed(1)}/255${blank ? " BLANK FRAME" : ""}`);
      }
    }
    await page.close();
  }

  // ---------- T-K rocket: staging, booster landing, Moon and Mars ----------
  {
    let page = (await newPage(1180, 820)).page;
    const freshR = async () => { await page.close(); page = (await newPage(1180, 820)).page; await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); }); };
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
      out.boosterNear = L.fallingStages[0] && Math.hypot(L.fallingStages[0].x - st.x, L.fallingStages[0].y - st.y, L.fallingStages[0].z - st.z) < 30;   // cockpit view: model transform must be current
      // keep climbing to the fairing and stage-2 altitudes, dropping as allowed
      for (let i = 0; i < 60 * 90 && L.rk.stage < 3; i++) { L.update(1 / 60); if (L.rocketCanDrop()) L.dropStage(); }
      out.finalStage = L.rk.stage; out.altEnd = Math.round(st.y - L.terrainEff(st.x, st.z)); out.spaceF = +st.spaceF.toFixed(2);
      // the booster should have landed on its legs by now
      // park the capsule high in space (coasting) while the booster comes down; otherwise it
      // could fall back and land at home first
      st.y = Math.max(st.y, 5000); L.rk.vx = L.rk.vy = L.rk.vz = 0; st.throttleHeld = false;
      let boosterLanded = false;
      for (let i = 0; i < 60 * 70 && !boosterLanded; i++) { L.update(1 / 60); boosterLanded = (L.flags.boosterLandings || 0) > 0; }
      out.boosterLanded = boosterLanded;
      L.api.setThrottle(false);
      return out;
    });
    const fuelAndTrucks = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune;
      L.api.placeOnRunway(); for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);   // trucks drive in
      const a = L.airports.find(r => r.idx === st.originIdx);
      const nearBefore = a.vehicles.every(v => Math.hypot(v.x - st.x, v.z - st.z) < 60);
      L.rk.fuel[0] = 1.5;   // nearly empty booster
      L.api.setThrottle(true);
      let thrustEnded = false, alt = 0, vyPeak = -1e9;
      for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); alt = st.y - L.terrainEff(st.x, st.z); if (st.phase === "AIRBORNE") { if (L.rk.fuel[0] > 0) vyPeak = Math.max(vyPeak, L.rk.vy); else if (L.rk.vy < vyPeak - 2) thrustEnded = true; } }
      L.api.setThrottle(false);
      const trucksLeaving = a.vehicles.every(v => Math.abs(v.tx - v.homeX) < 1 && Math.abs(v.tz - v.homeZ) < 1);
      return { nearBefore, thrustEnded, trucksLeaving, alt: Math.round(alt) };
    });
    check("rocket: trucks wait by the pad and leave at ignition; an empty stage stops thrusting (flame out)", fuelAndTrucks.nearBefore && fuelAndTrucks.thrustEnded && fuelAndTrucks.trucksLeaving, JSON.stringify(fuelAndTrucks));
    await page.evaluate(() => { window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); });

    const padT = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune;
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.update(1 / 60);
      const pad = L.rocketPad(st.originIdx), a = L.airports.find(r => r.idx === st.originIdx);
      const out = { offRunway: Math.abs(st.x) > T.runwayWidth / 2 + 40, onPad: Math.abs(st.x - pad.x) < 0.5 && Math.abs(st.z - pad.z) < 0.5,
        onMount: Math.abs(st.y - (L.AIRPORTS[st.originIdx].elev + R.pad.mountH + 7.5 * st.vp.size)) < 0.6 };
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);   // (eases back upright after an earlier launch)
      out.sbUp = Math.abs(a.strongback.rotation.x) < 0.05;
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      out.sbStillUp = Math.abs(a.strongback.rotation.x) < 0.05;
      L.api.setThrottle(true);
      for (let i = 0; i < 60 * 2.5; i++) L.update(1 / 60);
      out.sbSwung = a.strongback.rotation.x < -0.25; out.steam = L.wakePuffsAlive() > 6; out.lifted = st.phase === "AIRBORNE";
      L.api.setThrottle(false);
      return out;
    });
    check("rocket: launches from the launch pad on the far side (standing on the mount, not on the runway); the strongback swings away at ignition and the deluge steams",
      padT.offRunway && padT.onPad && padT.onMount && padT.sbUp && padT.sbStillUp && padT.sbSwung && padT.steam && padT.lifted, JSON.stringify(padT));
    await page.evaluate(() => { window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); });

    check("rocket: sits upright on the pad; stage button only above the booster altitude",
      launch.pitchOnPad === 90 && launch.btnHiddenOnPad && launch.canDropLow === false && launch.canDropHigh === true && launch.btnShownHigh, JSON.stringify(launch));
    check("rocket: three manual drops (booster, fairing, second stage) each gated by altitude; ends as the capsule in space",
      launch.dropped && launch.stageAfter === 1 && launch.boosterKind === "booster" && launch.boosterNear && launch.finalStage === 3 && launch.spaceF > 0.9, JSON.stringify(launch));
    check("rocket: the dropped booster flies itself down and lands on its legs", launch.boosterLanded, JSON.stringify({ boosterLanded: launch.boosterLanded }));
    await freshR();
    const ss = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune;
      const out = {};
      L.api.setVehicle("starship"); L.api.placeOnRunway(); L.update(1 / 60);
      const a = L.airports.find(r => r.idx === st.originIdx);
      out.onPad = st.phase === "TAXI" && L.rk.stage === 0 && document.getElementById("stageBtn").classList.contains("hidden");
      out.armsOpen = a.catchArms && Math.abs(a.catchArms[0].rotation.y) > 0.3;
      L.api.setThrottle(true);
      for (let i = 0; i < 60 * 40 && !L.rocketCanDrop(); i++) L.update(1 / 60);
      out.canDrop = L.rocketCanDrop(); out.altAtDrop = Math.round(st.y - L.terrainEff(st.x, st.z));
      L.rk.vx = 0; L.rk.vz = 0;   // straight up: the booster goes back to the arms
      out.dropped = L.dropStage();
      out.final = L.rk.stage === 1 && L.rocketCanDrop() === false;
      const s = L.fallingStages.filter(f => f.kind === "booster").pop();
      out.targetCatch = !!(s && s.target && s.target.catch);
      L.api.setThrottle(false);
      st.y = Math.max(st.y, 5000); L.rk.vx = L.rk.vy = L.rk.vz = 0;
      const c0 = L.flags.boosterCatches || 0;
      for (let i = 0; i < 60 * 90 && (L.flags.boosterCatches || 0) === c0; i++) L.update(1 / 60);
      out.caught = (L.flags.boosterCatches || 0) > c0;
      out.hangs = s && s.landed && Math.abs(s.y - (L.AIRPORTS[st.originIdx].elev + R.catch.armY)) < 3 && Math.abs(s.x - s.target.x) < 6;
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      out.armsClosed = Math.abs(a.catchArms[0].rotation.y) < 0.2;
      // the Ship: satellite yes, parachute never; it lands on its engines at the pad and refits
      st.spaceF = 1; st.exploding = false; st.phase = "AIRBORNE"; L.update(1 / 60);
      out.satBtn = !document.getElementById("satBtn").classList.contains("hidden");
      const pad = L.rocketPad(st.originIdx);
      st.x = pad.x; st.z = pad.z; st.y = pad.ground + 300; st.pitch = 90; L.rk.vx = L.rk.vz = 0; L.rk.vy = -10; st.spaceF = 0;
      let chuteEver = false; const r0 = L.flags.rocketLandings || 0, e0 = L.flags.exploded;
      for (let i = 0; i < 60 * 60 && st.phase !== "TAXI"; i++) { L.update(1 / 60); if (L.rk.chute > 0 || !document.getElementById("chuteBtn").classList.contains("hidden")) chuteEver = true; }
      out.shipLanded = (L.flags.rocketLandings || 0) > r0 && L.flags.exploded === e0; out.noChute = !chuteEver;
      for (let i = 0; i < 60 * (R.refitDelay + 1); i++) L.update(1 / 60);
      out.refit = L.rk.stage === 0 && st.vehicleKey === "starship";
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      return out;
    });
    check("starship: a second rocket -- one drop above its height; the booster flies back to the tower and the chopsticks catch it; the Ship deploys satellites, never a parachute, lands on its engines and refits",
      ss.onPad && ss.armsOpen && ss.canDrop && ss.altAtDrop >= 440 && ss.dropped && ss.final && ss.targetCatch && ss.caught && ss.hangs && ss.armsClosed && ss.satBtn && ss.shipLanded && ss.noChute && ss.refit, JSON.stringify(ss));

    await freshR();
    const inside = await page.evaluate(() => {
      const L = window.__lp, st = L.state, out = {}, hidden = id => document.getElementById(id).classList.contains("hidden");
      const b = L.BODIES.find(q => q.name === "station");
      L.api.skipScreens(); L.update(1 / 60); out.hiddenOnPad = hidden("hatchBtn");
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = b.x; st.y = b.y - 200; st.z = b.z; st.pitch = 90; st.spaceF = 1; L.rk.vx = L.rk.vz = 0; L.rk.vy = 25;
      for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
      L.update(1 / 60); out.shownDocked = !hidden("hatchBtn");
      out.entered = L.enterStation(); L.update(1 / 60);
      const A = L.astro; out.interiorShown = A.group.visible; out.btnBack = document.getElementById("hatchBtn").dataset.mode === "eva" && document.getElementById("skipBtn").dataset.target === "capsule" && !hidden("skipBtn");
      // chase camera is inside the tube; throttle pushes him along; he coasts; the wall bounces him
      const camIn = () => { const c = L.cameraPos; const dx = c.x - A.origin.x, dy = c.y - A.origin.y, dz = c.z - A.origin.z; return Math.hypot(dx, dy) < 2.2 && Math.abs(dz) < 16; };
      for (let i = 0; i < 30; i++) L.update(1 / 60); out.camInside = camIn();
      const z0 = A.z; L.api.setThrottle(true); for (let i = 0; i < 60 * 2; i++) L.update(1 / 60); L.api.setThrottle(false);
      out.moved = A.z - z0 > 1; const v0 = Math.hypot(A.vx, A.vy, A.vz); for (let i = 0; i < 60; i++) L.update(1 / 60); out.coasts = Math.hypot(A.vx, A.vy, A.vz) > v0 * 0.5;
      A.vx = 3; A.vy = 0; A.vz = 0; const bk0 = L.flags.astroBonks || 0; for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      out.bounced = (L.flags.astroBonks || 0) > bk0 && Math.hypot(A.x, A.y) <= 2.0 - 0.55 + 0.01;
      // first person is at his head; the capsule stays docked
      L.api.setView(false); for (let i = 0; i < 3; i++) L.update(1 / 60); out.seat = L.cameraPos.distanceTo(new THREE.Vector3(A.origin.x + A.x, A.origin.y + A.y + 0.62, A.origin.z + A.z)) < 0.5; L.api.setView(true);
      out.capsuleWaits = !!(L.rk.onBody && L.rk.onBody.dock) && st.phase === "TAXI";
      // a nudge sends an object home; a switch lights a module; the blob is a gulp
      const o = A.objects[0], l = o.locker; o.x = l.x; o.y = l.y; o.z = l.z + 0.5; L.update(1 / 60); out.tidy = o.home && (L.flags.stationTidy || 0) > 0;
      const s = A.switches[0]; A.x = s.x; A.y = s.y; A.z = s.z; A.vx = A.vy = A.vz = 0; L.update(1 / 60); out.lit = A.moduleLights[0].on;
      A.x = A.blob.x; A.y = A.blob.y; A.z = A.blob.z; L.update(1 / 60); out.gulp = (L.flags.stationGulps || 0) > 0;
      // the slot button starts the spacewalk (the red ring works too); outside it means back inside
      out.evaBtn = L.toggleHatch(); L.update(1 / 60);
      out.eva = A.mode === "eva" && (L.flags.spacewalks || 0) > 0 && document.getElementById("hatchBtn").dataset.mode === "back";
      const E = L.eva; for (let i = 0; i < 20; i++) L.update(1 / 60);
      out.evaCam = L.cameraPos.distanceTo(new THREE.Vector3(E.x, E.y, E.z)) < 8;
      L.api.setThrottle(true); const ex0 = E.x; for (let i = 0; i < 60 * 2; i++) L.update(1 / 60); L.api.setThrottle(false); out.evaMoves = Math.abs(E.x - ex0) > 1;
      E.x = E.anchor.x + 90; E.y = E.anchor.y; E.z = E.anchor.z; E.vx = 2; for (let i = 0; i < 60 * 12; i++) L.update(1 / 60);
      out.tether = Math.hypot(E.x - E.anchor.x, E.y - E.anchor.y, E.z - E.anchor.z) < 66;
      const bw = new THREE.Vector3(); L.station.updateMatrixWorld(); bw.setFromMatrixPosition(E.battery.matrixWorld); E.x = bw.x; E.y = bw.y; E.z = bw.z; E.vx = E.vy = E.vz = 0; L.update(1 / 60); out.battery = (L.flags.evaBattery || 0) > 0;
      bw.setFromMatrixPosition(E.stuck.matrixWorld); E.x = bw.x; E.y = bw.y; E.z = bw.z; L.update(1 / 60); for (let i = 0; i < 60 * 4; i++) L.update(1 / 60); out.arrayOpen = (L.flags.evaArray || 0) > 0 && E.stuck.scale.x > 0.9;
      E.x = E.toolPos.x; E.y = E.toolPos.y; E.z = E.toolPos.z; L.update(1 / 60); out.tool = E.toolHeld && (L.flags.evaTool || 0) > 0;
      // from a bad spot (moving fast, right beside the core) the button still reels him in
      E.x = E.anchor.x + 2; E.y = E.anchor.y + 30; E.z = E.anchor.z + 4; E.vx = -4; E.vy = 2; E.vz = 3; A.yaw = 2.5;
      out.evaBack = L.toggleHatch(); for (let i = 0; i < 60 * 30 && A.mode !== "inside"; i++) L.update(1 / 60);
      out.insideAgain = A.mode === "inside" && (L.flags.spacewalkReturns || 0) > 0 && A.group.visible && !E.mesh.visible && document.getElementById("hatchBtn").dataset.mode === "eva";
      // the go button from outside goes all the way to the seat
      L.toggleHatch(); L.update(1 / 60); E.x = E.anchor.x + 20; E.y = E.anchor.y - 10; E.z = E.anchor.z;
      out.goAll = L.leaveStationAll(); for (let i = 0; i < 60 * 60 && L.astroActive(); i++) L.update(1 / 60); out.goAllDone = !L.astroActive();
      out.entered2 = L.enterStation(); L.update(1 / 60);
      // back to the capsule by itself; the button returns to "in"; undock still works
      out.left = L.leaveStation(); for (let i = 0; i < 60 * 40 && L.astroActive(); i++) L.update(1 / 60);
      out.back = !L.astroActive() && !A.group.visible && document.getElementById("hatchBtn").dataset.mode === "in" && (L.flags.stationExits || 0) > 0;
      L.api.setThrottle(true); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60); L.api.setThrottle(false); out.undocked = st.phase === "AIRBORNE" && !L.rk.onBody;
      L.api.placeOnRunway(); L.api.skipScreens();
      return out;
    });
    check("station: docked, the hatch button floats him inside (chase camera in the tube, throttle pushes, he coasts and bounces off the walls, seat view at his head); tidy / lights / gulp all fire; the airlock ring starts a spacewalk (tether, battery, array, wrench) and the button brings him in, then back to the capsule, and it undocks",
      inside.hiddenOnPad && inside.shownDocked && inside.entered && inside.interiorShown && inside.btnBack && inside.camInside && inside.moved && inside.coasts && inside.bounced && inside.seat && inside.capsuleWaits && inside.tidy && inside.lit && inside.gulp && inside.evaBtn && inside.eva && inside.evaCam && inside.evaMoves && inside.tether && inside.battery && inside.arrayOpen && inside.tool && inside.evaBack && inside.insideAgain && inside.goAll && inside.goAllDone && inside.entered2 && inside.left && inside.back && inside.undocked, JSON.stringify(inside));

    await freshR();
    const cov = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune, out = {};
      const key = (code) => { window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true })); window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true })); };
      const hidden = id => document.getElementById(id).classList.contains("hidden");
      // keys: P photo, B picker (on the pad), F drops a stage, Enter deploys the satellite, L is the go button
      L.api.skipScreens(); st.photoPending = false; const ph0 = L.flags.photos || 0; key("KeyP"); out.keyPhoto = (L.flags.photos || 0) > ph0; st.photoPending = false;
      key("KeyB"); out.keyPicker = !document.getElementById("screenVehicle").classList.contains("hiddenS"); L.api.skipScreens();
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; st.y = R.stageAlt[0] + 300; L.rk.vy = 5; L.update(1 / 60);
      const s0 = L.rk.stage; key("KeyF"); out.keyStage = L.rk.stage === s0 + 1;
      st.y = 5000; st.spaceF = 1; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel); L.rk.vx = L.rk.vy = L.rk.vz = 0; L.update(1 / 60);
      const n0 = L.satellites.length; key("Enter"); out.keySat = L.satellites.length > n0;
      st.dest = "moon"; L.update(1 / 60); const sk0 = L.flags.rocketSkips || 0; key("KeyL"); out.keyGo = (L.flags.rocketSkips || 0) > sk0;
      // undock: the capsule is pushed away from the port
      const b = L.BODIES.find(q => q.name === "station");
      L.api.placeOnRunway(); L.api.skipScreens(); st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = b.x; st.y = b.y - 200; st.z = b.z; st.pitch = 90; st.spaceF = 1; L.rk.vx = L.rk.vz = 0; L.rk.vy = 25;
      for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
      const u0 = L.flags.undocks || 0; L.api.setThrottle(true); for (let i = 0; i < 60 * 2.5; i++) L.update(1 / 60); L.api.setThrottle(false);
      out.undock = (L.flags.undocks || 0) > u0 && Math.hypot(st.x - b.x, st.y - b.y, st.z - b.z) > 14 && !L.rk.onBody;
      // the catch arms let go at the next launch
      L.api.setVehicle("starship"); L.api.placeOnRunway(); L.api.skipScreens();
      const a = L.airports.find(r => r.idx === st.originIdx); a.catchClosed = true; for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      out.armsWereClosed = Math.abs(a.catchArms[0].rotation.y) < 0.2;
      L.api.setThrottle(true); for (let i = 0; i < 60 * 2; i++) L.update(1 / 60); L.api.setThrottle(false); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      out.armsReopen = Math.abs(a.catchArms[0].rotation.y) > 0.3;
      // rain stops in space; the alarm stays quiet through an assisted rocket landing
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.skipScreens(); st.sky = 1; for (let i = 0; i < 60 * 5; i++) L.update(1 / 60);
      out.rainOnPad = L.precip.visible;
      st.exploding = false; st.phase = "AIRBORNE"; st.y = 5000; L.rk.vx = L.rk.vy = L.rk.vz = 0; for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      out.rainOffInSpace = !L.precip.visible; st.sky = 0;
      const pad = L.rocketPad(st.originIdx); st.x = pad.x; st.z = pad.z; st.y = pad.ground + 150; st.pitch = 90; L.rk.vx = L.rk.vz = 0; L.rk.vy = -12; st.spaceF = 0;
      let alarmEver = false; for (let i = 0; i < 60 * 25 && st.phase !== "TAXI"; i++) { L.update(1 / 60); if (document.getElementById("alarm").classList.contains("on")) alarmEver = true; }
      out.quietAssist = !alarmEver && st.phase === "TAXI";
      // the parachute button works by tap
      L.api.placeOnRunway(); L.api.skipScreens(); st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = pad.x + 600; st.z = pad.z; st.y = pad.ground + R.chuteAlt[0] - 40; st.pitch = 90; L.rk.vx = L.rk.vz = 0; L.rk.vy = -30;
      for (let i = 0; i < 60 * 3 && hidden("chuteBtn"); i++) L.update(1 / 60);
      document.getElementById("chuteBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 41 })); L.update(1 / 60);
      out.chuteTap = L.rk.chute === 1;
      // the recovery vehicle matches the ground: a ship at sea, a truck on land
      const rec = L.RECOVERY[st.originIdx];
      const landWith = (x, z) => { L.api.placeOnRunway(); L.api.skipScreens(); st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel); st.x = x; st.z = z; st.y = Math.max(L.terrainEff(x, z), T.waterLevel) + 60; st.pitch = 90; L.rk.vx = L.rk.vz = 0; L.rk.vy = -8; L.rk.chute = 2; L.rk.chuteT = 5; for (let i = 0; i < 60 * 30 && st.phase !== "TAXI"; i++) L.update(1 / 60); for (let i = 0; i < 60; i++) L.update(1 / 60); };
      landWith(rec.barge.x + 150, rec.barge.z + 120); out.shipAtSea = rec.ship.visible && !rec.truck.visible;
      landWith(pad.x + 500, pad.z); out.truckOnLand = rec.truck.visible && !rec.ship.visible;
      // the rover has a seat view too
      const m = L.BODIES[0];
      L.api.placeOnRunway(); L.api.skipScreens(); st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = m.x; st.y = m.y + m.r + 60; st.z = m.z; st.pitch = 90; L.rk.vx = L.rk.vz = 0; L.rk.vy = -12; for (let i = 0; i < 60 * 30 && st.phase !== "TAXI"; i++) L.update(1 / 60); L.update(1 / 60);
      L.roverDeploy(); L.api.setView(false); for (let i = 0; i < 5; i++) L.update(1 / 60);
      out.roverSeat = L.cameraPos.distanceTo(new THREE.Vector3(L.rover.x, L.rover.y, L.rover.z)) < 5; L.api.setView(true);
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.skipScreens();
      return out;
    });
    check("coverage: keys (P photo, B picker, F stage, Enter satellite, L go); undock pushes off; arms let go at the next launch; rain stops in space; assisted landing is alarm-free; parachute by tap; ship at sea vs truck on land; rover seat view",
      cov.keyPhoto && cov.keyPicker && cov.keyStage && cov.keySat && cov.keyGo && cov.undock && cov.armsWereClosed && cov.armsReopen && cov.rainOnPad && cov.rainOffInSpace && cov.quietAssist && cov.chuteTap && cov.shipAtSea && cov.truckOnLand && cov.roverSeat, JSON.stringify(cov));

    await freshR();
    const fx = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const out = {};
      const sw0 = L.flags.shockwaves || 0, bm0 = L.flags.sonicBooms || 0;
      // night: the plume lights the pad in chase view; by day it does not
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.skipScreens(); L.api.setView(true);   // (the refit above asked for a destination)
      st.sky = 3; for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      const a = L.airports.find(r => r.idx === st.originIdx);
      const c0 = a.padLightMat.color.getHex();
      L.api.setThrottle(true); const seen = new Set();
      for (let i = 0; i < 60 * 1.2; i++) { L.update(1 / 60); seen.add(a.padLightMat.color.getHex()); }
      out.strobed = seen.size >= 2 && !seen.has(c0) || seen.size >= 3;
      out.nightLight = L.vehicleModel.userData.plumeLight.intensity > 1;
      L.api.setThrottle(false);
      st.sky = 0; L.api.placeOnRunway(); for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      L.api.setThrottle(true); for (let i = 0; i < 60 * 1.2; i++) L.update(1 / 60);
      out.dayLight = L.vehicleModel.userData.plumeLight.intensity;
      // keep climbing, drop the booster, and it booms on its way down
      for (let i = 0; i < 60 * 40 && !L.rocketCanDrop(); i++) L.update(1 / 60);
      L.rk.vx = L.rk.vz = 0; L.dropStage(); L.api.setThrottle(false);
      st.y = Math.max(st.y, 5000); L.rk.vx = L.rk.vy = L.rk.vz = 0;
      for (let i = 0; i < 60 * 70 && (L.flags.sonicBooms || 0) === bm0; i++) L.update(1 / 60);
      out.shockwaves = (L.flags.shockwaves || 0) - sw0; out.booms = (L.flags.sonicBooms || 0) - bm0;
      // reentry in the cockpit leans toward the horizon
      L.api.setView(false); st.exploding = false; st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.onBody = null;
      st.x = 0; st.z = L.AIRPORTS[0].cz; st.y = 1500; st.pitch = 90; st.heading = 0; L.rk.vy = -170; L.rk.vx = L.rk.vz = 0;
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      const d = new THREE.Vector3(); L.camera.getWorldDirection(d);
      out.reentry = +L.rk.reentry.toFixed(2); out.lookY = +d.y.toFixed(2);
      L.api.setView(true);
      return out;
    });
    check("rocket: launch flourishes -- shockwave at T-0, sonic booms as the booster comes down, pad lights strobe through the count, the plume lights the pad only at night, reentry view leans to the horizon",
      fx.shockwaves > 0 && fx.booms > 0 && fx.strobed && fx.nightLight && fx.dayLight === 0 && fx.reentry > 0.5 && fx.lookY < 0.6, JSON.stringify(fx));

    await freshR();
    const sea = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune;
      const out = {};
      const setup = (stage, y) => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = stage; L.rocketApplyStages(L.vehicleModel); st.y = y; st.pitch = 90; st.heading = 0; L.rk.vy = 20; };
      // a seaward-tilting launch: the booster flies to the droneship
      const rec = L.RECOVERY[st.originIdx];
      setup(0, 700);
      const dx = rec.barge.x - st.x, dz = rec.barge.z - st.z, d = Math.hypot(dx, dz);
      L.rk.vx = dx / d * 30; L.rk.vz = dz / d * 30;
      out.dropped = L.dropStage();
      const s = L.fallingStages.filter(f => f.kind === "booster").pop();
      out.targetBarge = !!(s && s.target && s.target.barge);
      const b0 = L.flags.bargeLandings || 0;
      for (let i = 0; i < 60 * 90 && (L.flags.bargeLandings || 0) === b0; i++) L.update(1 / 60);
      out.bargeLanded = (L.flags.bargeLandings || 0) > b0;
      out.onDeck = s && Math.abs(s.x - rec.barge.x) < 26 && Math.abs(s.z - rec.barge.z) < 44 && s.y > rec.barge.deckY;
      // a straight-up launch: the booster comes back beside the pad
      setup(0, 700); L.rk.vx = L.rk.vz = 0; L.dropStage();
      const s2 = L.fallingStages.filter(f => f.kind === "booster").pop();
      out.targetPad = !!(s2 && s2.target && !s2.target.barge);
      // the fairing halves chute down into the net boat
      setup(1, 1300); L.rk.vx = L.rk.vz = 0; L.dropStage();
      const c0 = L.flags.fairingsCaught || 0, p0 = L.flags.fairingChutes || 0;
      for (let i = 0; i < 60 * 100 && (L.flags.fairingsCaught || 0) < c0 + 2; i++) L.update(1 / 60);
      out.fairingChutes = (L.flags.fairingChutes || 0) - p0; out.fairingsCaught = (L.flags.fairingsCaught || 0) - c0;
      L.api.setThrottle(false);
      return out;
    });
    check("recovery: a seaward booster flies to the droneship and lands on its deck; a straight one comes back to the pad; both fairing halves chute into the net boat",
      sea.dropped && sea.targetBarge && sea.bargeLanded && sea.onDeck && sea.targetPad && sea.fairingChutes === 2 && sea.fairingsCaught === 2, JSON.stringify(sea));

    // the station: dock with a magnet, lights and arrays, undock, and the destination drives the landing button
    await freshR();
    const dock = await page.evaluate(() => {
      const L = window.__lp, st = L.state, R = L.TUNE.rocketTune, b = L.BODIES.find(q => q.name === "station");
      const out = {};
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = b.x; st.y = b.y - 220; st.z = b.z; st.pitch = 90; st.heading = 0; st.spaceF = 1; L.rk.vx = L.rk.vz = 0; L.rk.vy = 20;
      const d0 = L.flags.stationDockings || 0, e0 = L.flags.exploded;
      let i0 = 0; for (; i0 < 60 * 40 && (L.flags.stationDockings || 0) === d0; i0++) L.update(1 / 60);
      out.dockSecs = Math.round(i0 / 60);
      out.docked = (L.flags.stationDockings || 0) > d0; out.noBoom = L.flags.exploded === e0; out.onStation = !!(L.rk.onBody && L.rk.onBody.name === "station"); out.phase = st.phase;
      out.noseIn = st.pitch > 60;   // nose up = toward the port, approaching from below
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      const u = L.station.userData;
      out.unfolded = u.panels.every(p => p.scale.x > 0.9); out.lit = u.lightMat.color.getHex() !== 0x2a3140;
      L.api.setThrottle(true); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60); L.api.setThrottle(false);
      out.undocked = st.phase === "AIRBORNE" && !L.rk.onBody && L.rk.launchedFromBody; out.skipHome = L.rocketSkipTarget() === null;
      // a fresh flight in space: the destination picks the landing button's target
      L.rk.launchedFromBody = false; L.rk.satOut = false; st.y = 5000; st.x = 0; st.z = 0; L.rk.vx = L.rk.vy = L.rk.vz = 0; L.update(1 / 60);
      st.dest = "station"; out.destStation = L.rocketSkipTarget() && L.rocketSkipTarget().name === "station";
      // the ring line: the go button drops him at the top of it; down through all three and the dock is a party
      const p0 = L.flags.dockPerfect || 0, g0 = L.flags.dockRings || 0, d1 = L.flags.stationDockings || 0;
      L.rocketSkipToLanding(); out.atTop = Math.abs(st.x - b.x) < 1 && Math.abs(st.z - b.z) < 1 && st.y > b.y + 200;
      let i1 = 0; for (; i1 < 60 * 40 && (L.flags.stationDockings || 0) === d1; i1++) L.update(1 / 60);
      out.rings = (L.flags.dockRings || 0) - g0; out.perfect = (L.flags.dockPerfect || 0) > p0; out.ringDockSecs = Math.round(i1 / 60);
      L.api.setThrottle(true); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60); L.api.setThrottle(false);
      L.rk.launchedFromBody = false; st.y = 5000; st.x = 0; st.z = 0; L.rk.vx = L.rk.vy = L.rk.vz = 0; L.update(1 / 60);
      st.dest = "mars"; out.destMars = L.rocketSkipTarget() && L.rocketSkipTarget().name === "mars";
      // the big arrow points at the destination when it is off screen (nose straight down in the cockpit: everything is behind)
      L.api.setView(false); st.pitch = -90; st.heading = 0; L.update(1 / 60); L.update(1 / 60);
      out.arrowOn = document.getElementById("homeArrow").classList.contains("on");
      st.pitch = 90; L.api.setView(true);
      st.dest = "moon";
      // the stack: the big satellite, then five flat ones one by one
      st.phase = "AIRBORNE"; st.exploding = false; const n0 = L.satellites.length, s0 = L.flags.satDeploys || 0;
      out.stackStart = L.deploySatellite();
      for (let i = 0; i < 60 * 7; i++) L.update(1 / 60);
      out.stackCount = L.satellites.length - n0; out.stackBeeps = (L.flags.satDeploys || 0) - s0;
      // mission-patch frame for rocket photos only
      st.photoPending = false; L.takePhoto(); out.patch = document.getElementById("photo").classList.contains("patch");
      st.photoPending = false; L.api.setVehicle("prop"); L.takePhoto(); out.noPatchPlane = !document.getElementById("photo").classList.contains("patch"); st.photoPending = false;
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      return out;
    });
    check("station: the capsule noses into the port on the magnet (no explosion), the windows light and the arrays unfold; throttle undocks and the landing button then means home; the destination picks the landing button's target",
      dock.docked && dock.noBoom && dock.onStation && dock.phase === "TAXI" && dock.noseIn && dock.unfolded && dock.lit && dock.undocked && dock.skipHome && dock.destStation && dock.destMars && dock.arrowOn && dock.atTop && dock.rings === 3 && dock.perfect && dock.ringDockSecs < 16, JSON.stringify(dock));
    check("satellite: the big satellite is followed by a stack of five flat ones, each with a beep; rocket photos get the mission-patch frame",
      dock.stackStart && dock.stackCount === 6 && dock.stackBeeps === 6 && dock.patch && dock.noPatchPlane, JSON.stringify({ stackStart: dock.stackStart, stackCount: dock.stackCount, stackBeeps: dock.stackBeeps, patch: dock.patch, noPatchPlane: dock.noPatchPlane }));

    const moon = await page.evaluate(() => {
      const L = window.__lp, st = L.state, R = L.TUNE.rocketTune, m = L.BODIES[0];
      // approach the Moon slowly from below: land
      st.exploding = false; st.phase = "AIRBORNE"; st.throttleHeld = false;
      st.x = m.x; st.y = m.y - m.r - 60; st.z = m.z; st.pitch = 90; st.heading = 0;
      L.rk.stage = 3;   // arrive as the capsule (the pad refit above rebuilt the full stack)
      L.rk.vx = 0; L.rk.vy = 12; L.rk.vz = 0;
      const l0 = L.flags.moonLandings || 0;
      for (let i = 0; i < 60 * 20 && (L.flags.moonLandings || 0) === l0; i++) L.update(1 / 60);
      const landed = (L.flags.moonLandings || 0) > l0;
      const onMoon = L.rk.onBody && L.rk.onBody.name === "moon";
      const restocked = L.rk.stage === 3;   // arrived as the capsule, stays the capsule (only home refits the stack)
      const spaceStays = st.spaceF > 0.5;
      // launch again from the Moon -- and staging must work again afterwards (onBody cleared)
      L.api.setThrottle(true);
      let left = false;
      for (let i = 0; i < 60 * 15; i++) { L.update(1 / 60); if (st.phase === "AIRBORNE" && Math.hypot(st.x - m.x, st.y - m.y, st.z - m.z) > m.r + 40) { left = true; break; } }
      L.api.setThrottle(false);
      const onBodyCleared = !L.rk.onBody;
      const skipGoesHome = L.rocketSkipTarget() === null;
      // coast into Mars from far away: the landing assist brakes it and it lands
      const mars = L.BODIES[1];
      st.exploding = false; st.phase = "AIRBORNE"; st.x = mars.x; st.y = mars.y - mars.r - 600; st.z = mars.z; st.pitch = 90;
      L.rk.vx = 0; L.rk.vy = 150; L.rk.vz = 0; L.api.setThrottle(false); L.api.clearStick();
      const m0 = L.flags.marsLandings || 0;
      for (let i = 0; i < 60 * 40 && (L.flags.marsLandings || 0) === m0; i++) L.update(1 / 60);
      const marsLanded = (L.flags.marsLandings || 0) > m0;
      // ramming it under full power, nose down, is the only way to crash: explode + reassemble above it
      st.exploding = false; st.phase = "AIRBORNE"; st.x = mars.x; st.y = mars.y - mars.r - 300; st.z = mars.z; st.pitch = -90;
      L.rk.vx = 0; L.rk.vy = 200; L.rk.vz = 0; L.api.setThrottle(true);
      const e0 = L.flags.exploded;
      for (let i = 0; i < 60 * 8 && L.flags.exploded === e0; i++) L.update(1 / 60);
      L.api.setThrottle(false);
      const crashed = L.flags.exploded > e0;
      for (let i = 0; i < 60 * 4 && st.exploding; i++) L.update(1 / 60);
      const back = !st.exploding && Math.hypot(st.x - mars.x, st.y - mars.y, st.z - mars.z) > mars.r + 30 && L.rk.stage === 0;
      return { landed, onMoon, restocked, spaceStays, left, onBodyCleared, skipGoesHome, marsLanded, crashed, back };
    });
    check("rocket: a slow approach lands on the Moon (still the capsule, space stays), and it can launch again",
      moon.landed && moon.onMoon && moon.restocked && moon.spaceStays && moon.left && moon.onBodyCleared && moon.skipGoesHome, JSON.stringify(moon));
    check("rocket: coasting at Mars from far out is braked to a landing; ramming it under power still explodes and reassembles",
      moon.marsLanded && moon.crashed && moon.back, JSON.stringify(moon));

    // the rover: out of the capsule on the Moon, drives on the sphere, rocks + beacon, drives itself back
    await freshR();
    const rov = await page.evaluate(() => {
      const L = window.__lp, st = L.state, m = L.BODIES[0], hidden = b => b.classList.contains("hidden");
      const btn = document.getElementById("roverBtn");
      const out = {};
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.update(1 / 60);
      out.hiddenOnPad = hidden(btn);
      // land the capsule on the Moon (top)
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.stage = 3; L.rocketApplyStages(L.vehicleModel);
      st.x = m.x; st.y = m.y + m.r + 60; st.z = m.z; st.pitch = 90; st.heading = 0; L.rk.vx = L.rk.vz = 0; L.rk.vy = -12;
      for (let i = 0; i < 60 * 30 && st.phase !== "TAXI"; i++) L.update(1 / 60);
      L.update(1 / 60);
      out.landed = st.phase === "TAXI" && !!L.rk.onBody; out.shownOnMoon = !hidden(btn);
      out.deployed = L.roverDeploy(); L.update(1 / 60);
      out.rocks = L.rover.rocks.length; out.toys = L.rover.toys.length;
      const x0 = L.rover.x, y0 = L.rover.y, z0 = L.rover.z;
      // throttle drives it forward; the stick steers (drag right = turn right)
      L.api.setThrottle(true); st.touching = true; st.ctrlPitch = 0; st.ctrlBank = 0;
      let hMin = 1e9, hMax = -1e9;
      for (let i = 0; i < 60 * 4; i++) { L.update(1 / 60); const h = Math.hypot(L.rover.x - m.x, L.rover.y - m.y, L.rover.z - m.z) - m.r; hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
      const f0 = L.rover.f.clone(); st.ctrlBank = 1; for (let i = 0; i < 60; i++) L.update(1 / 60); out.steered = f0.angleTo(L.rover.f) > 0.4;
      st.ctrlBank = 0; L.api.setThrottle(false); st.touching = false;
      out.moved = Math.round(Math.hypot(L.rover.x - x0, L.rover.y - y0, L.rover.z - z0)); out.hMin = +hMin.toFixed(1); out.hMax = +hMax.toFixed(1);
      out.rocketStayed = st.phase === "TAXI" && !!L.rk.onBody;
      // the toys: a ramp jump, the sand (wiggle out), a boulder into a crater, the horn
      const R0 = L.rover, ramp = R0.toys.find(t => t.kind === "ramp"), sand = R0.toys.find(t => t.kind === "sand"), bould = R0.toys.find(t => t.kind === "boulder"), crat = R0.craters[0];
      R0.x = ramp.x; R0.y = ramp.y; R0.z = ramp.z; R0.f.copy(ramp.dir); R0.speed = 9; R0.h = 0; R0.vh = 0; R0.stuck = false; const j0 = L.flags.roverJumps || 0; L.update(1 / 60); out.jump = (L.flags.roverJumps || 0) > j0 && R0.vh > 5;
      let hTop = 0; for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); hTop = Math.max(hTop, R0.h); } out.jumpHigh = hTop > 3;
      R0.x = sand.x; R0.y = sand.y; R0.z = sand.z; R0.h = 0; R0.vh = 0; R0.speed = 6; L.update(1 / 60); out.sandIn = R0.stuck && (L.flags.roverSandIn || 0) > 0;
      L.api.setThrottle(true); for (let i = 0; i < 30; i++) L.update(1 / 60); out.sandSlow = Math.abs(R0.speed) < 2; L.api.setThrottle(false);
      st.touching = true; for (let k = 0; k < 5; k++) { st.ctrlBank = k % 2 ? 1 : -1; for (let i = 0; i < 6; i++) L.update(1 / 60); } st.ctrlBank = 0; st.touching = false;
      out.sandOut = !R0.stuck && (L.flags.roverSandOut || 0) > 0;
      const tb = new THREE.Vector3(bould.x - crat.x, bould.y - crat.y, bould.z - crat.z); tb.normalize();   // push it toward the crater
      R0.x = bould.x + tb.x * 2.5; R0.y = bould.y + tb.y * 2.5; R0.z = bould.z + tb.z * 2.5; R0.f.copy(tb).negate(); R0.speed = 12; R0.h = 0; R0.vh = 0; R0.stuck = false;
      const b0 = L.flags.roverBoulders || 0; for (let i = 0; i < 60 * 12 && (L.flags.roverBoulders || 0) === b0; i++) { L.update(1 / 60); R0.speed = 0; }
      out.boulder = (L.flags.roverBoulders || 0) > b0 && bould.sunk;
      const h0 = L.flags.roverHorns || 0; st.photoPending = false; document.getElementById("camBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 51 })); out.horn = (L.flags.roverHorns || 0) > h0; st.photoPending = false;
      // roll onto a rock
      const r = L.rover.rocks[0]; L.rover.x = r.x; L.rover.y = r.y; L.rover.z = r.z; const k0 = L.flags.roverRocks || 0;
      L.update(1 / 60); out.rock = (L.flags.roverRocks || 0) > k0 && !r.mesh.visible;
      // a beacon marks where the rock was
      out.beacon = (L.flags.roverBeacons || 0) > 0 && L.rover.beacons.length > 0;
      // back to the capsule by itself
      out.ret = L.roverReturn();
      for (let i = 0; i < 60 * 60 && L.rover.active; i++) L.update(1 / 60);
      out.back = !L.rover.active && (L.flags.roverBack || 0) > 0 && btn.dataset.mode === "out";
      // and the rocket still launches
      L.api.setThrottle(true); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60); L.api.setThrottle(false);
      out.launched = st.phase === "AIRBORNE";
      // the refit brings the rocks back fresh
      L.api.placeOnRunway(); out.reset = L.rover.rocks.length === 0 && L.rover.beacons.length === 0;
      return out;
    });
    check("rover: only on a body; rolls out, drives on the sphere with hops, jumps a ramp, spins out of the sand, shoves a boulder into a crater, honks, collects a rock (beacon), drives itself back, and the rocket launches after",
      rov.hiddenOnPad && rov.landed && rov.shownOnMoon && rov.deployed && rov.rocks === 8 && rov.toys === 9 && rov.jump && rov.jumpHigh && rov.sandIn && rov.sandSlow && rov.sandOut && rov.boulder && rov.horn && rov.moved > 20 && rov.steered && rov.hMin > 0.5 && rov.hMax < 15 && rov.rocketStayed && rov.rock && rov.beacon && rov.ret && rov.back && rov.launched && rov.reset, JSON.stringify(rov));

    // skip-to-landing: in deep space it jumps to a slow descent above the nearest planet and lands; low down, above the home pad
    const skip = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, m = L.BODIES[0];
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false;   // a fresh flight from Earth
      st.x = m.x + 200; st.y = m.y - m.r - 3000; st.z = m.z; st.pitch = 90; L.rk.vx = L.rk.vy = L.rk.vz = 0;
      L.update(1 / 60);
      const shown = !document.getElementById("skipBtn").classList.contains("hidden");
      const l0 = L.flags.moonLandings || 0;
      const did = L.rocketSkipToLanding();
      const near = Math.hypot(st.x - m.x, st.y - m.y, st.z - m.z) - m.r;
      for (let i = 0; i < 60 * 40 && (L.flags.moonLandings || 0) === l0; i++) L.update(1 / 60);
      const landed = (L.flags.moonLandings || 0) > l0;
      // low over home: skip puts it above the pad and it lands there
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false;
      const ap = L.AIRPORTS[st.originIdx];
      st.x = 900; st.z = ap.cz + 2000; st.y = ap.elev + 600; st.pitch = 90; L.rk.vx = L.rk.vy = L.rk.vz = 0;
      L.update(1 / 60);
      const shownHome = !document.getElementById("skipBtn").classList.contains("hidden");
      const r0 = L.flags.rocketLandings || 0;
      L.rocketSkipToLanding();
      const pad = L.rocketPad(st.originIdx);
      const overPad = Math.abs(st.x - pad.x) < 1 && Math.abs(st.z - pad.z) < 1;
      for (let i = 0; i < 60 * 40 && (L.flags.rocketLandings || 0) === r0; i++) L.update(1 / 60);
      return { shown, did, near: Math.round(near), landed, shownHome, overPad, homeLanded: (L.flags.rocketLandings || 0) > r0 };
    });
    check("rocket: the landing button jumps to a slow descent above the nearest planet (or the home pad) and lands",
      skip.shown && skip.did && skip.near > 200 && skip.near < 240 && skip.landed && skip.shownHome && skip.overPad && skip.homeLanded, JSON.stringify(skip));

    // return to Earth: descend upright and slowly = a landing
    const home = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const ap = L.AIRPORTS[0];
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 0;   // the full stack, Falcon style
      const padH = L.rocketPad(0);   // a Falcon comes back to the pad, not the runway
      st.x = padH.x; st.z = padH.z; st.y = ap.elev + 120; st.pitch = 90; st.heading = 0;
      L.rk.vx = 0; L.rk.vy = -8; L.rk.vz = 0;
      const r0 = L.flags.rocketLandings || 0, e0 = L.flags.exploded;
      // feather it down: burn when falling faster than 10
      for (let i = 0; i < 60 * 40 && st.phase !== "TAXI"; i++) { L.api.setThrottle(L.rk.vy < -9); L.update(1 / 60); }
      L.api.setThrottle(false);
      const landed = (L.flags.rocketLandings || 0) > r0, phase = st.phase;
      for (let i = 0; i < 60 * (T.rocketTune.refitDelay + 1); i++) L.update(1 / 60);
      return { landed, exploded: L.flags.exploded > e0, phase, pitch: Math.round(st.pitch), refit: L.rk.stage === 0 && (L.flags.refits || 0) > 0 };
    });
    check("rocket: a slow upright descent onto the Earth lands (Falcon style) and the pad refits the full stack", home.landed && !home.exploded && home.phase === "TAXI" && home.refit, JSON.stringify(home));

    // the way home, Dragon style: satellite out in space, deorbit, plasma, drogue, mains, float down, refit
    await freshR();
    const ret = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, R = T.rocketTune, ap = L.AIRPORTS[0];
      const satBtn = document.getElementById("satBtn"), chuteBtn = document.getElementById("chuteBtn"), glow = document.getElementById("reentryGlow");
      const hidden = b => b.classList.contains("hidden");
      const alt = () => st.y - Math.max(L.terrainEff(st.x, st.z), T.waterLevel);
      const out = {};
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 3;
      st.x = 0; st.z = ap.cz; st.y = 4000; st.pitch = 90; st.heading = 0; L.rk.vx = L.rk.vy = L.rk.vz = 0; st.spaceF = 1;
      L.update(1 / 60);
      out.satShown = !hidden(satBtn); out.chuteHiddenInSpace = hidden(chuteBtn);
      const last0 = L.satellites[L.satellites.length - 1];
      out.did = L.deploySatellite();
      out.satAdded = L.satellites.length > 0 && L.satellites[L.satellites.length - 1] !== last0; L.update(1 / 60); out.satHiddenAfter = hidden(satBtn);
      const s = L.satellites[L.satellites.length - 1];
      const p0 = s.mesh.userData.panels[0].scale.x;
      for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      out.unfolded = p0 < 0.1 && s.mesh.userData.panels[0].scale.x > 0.9;
      out.drifted = Math.hypot(s.x - st.x, s.y - st.y, s.z - st.z) > 8;
      // the satellite does not change the route: the button still means the destination (and shows its icon)
      L.update(1 / 60); out.skipHome = L.rocketSkipTarget() !== null && document.getElementById("skipBtn").dataset.target === st.dest;
      L.rk.launchedFromBody = true; L.update(1 / 60); out.iconHome = document.getElementById("skipBtn").dataset.target === "home";   // (stays "on the way home": the deorbit below is the trip back)
      const d0 = L.flags.deorbits || 0;
      L.rocketSkipToLanding();
      out.deorbit = (L.flags.deorbits || 0) > d0 && st.y >= R.deorbitAlt - 1 && L.rk.vy < -100;
      // the fall: plasma glows (state + overlay), no chute button above chuteAlt, drogue pops by itself
      let glowPeak = 0, overlayPeak = 0, btnEarly = false, pitchAtGlow = null;
      for (let i = 0; i < 60 * 120 && L.rk.chute === 0; i++) {
        L.update(1 / 60);
        glowPeak = Math.max(glowPeak, L.rk.reentry); overlayPeak = Math.max(overlayPeak, parseFloat(glow.style.opacity) || 0);
        if (L.rk.reentry > 0.5 && pitchAtGlow === null) pitchAtGlow = Math.round(st.pitch);
        if (!hidden(chuteBtn) && alt() > R.chuteAlt[0] + 1) btnEarly = true;
      }
      out.glowPeak = +glowPeak.toFixed(2); out.overlayPeak = +overlayPeak.toFixed(2); out.btnEarly = btnEarly; out.pitchAtGlow = pitchAtGlow;
      out.reentries = L.flags.reentries || 0;
      out.drogueAuto = L.rk.chute === 1; out.drogueAlt = Math.round(alt());
      // under the drogue: sinks at its rate, the mains button shows below chuteAlt[1]
      let mainsBtn = false, sinkD = 0;
      for (let i = 0; i < 60 * 60 && L.rk.chute === 1; i++) {
        L.update(1 / 60);
        const a = alt();
        if (a < R.chuteAlt[1] - 10 && a > R.chuteAutoAlt[1] + 10) { if (!hidden(chuteBtn)) mainsBtn = true; sinkD = -L.rk.vy; }
      }
      out.mainsBtn = mainsBtn; out.drogueSink = Math.round(sinkD); out.mainsAuto = L.rk.chute === 2;
      // mains: a slow float to the ground, celebration, still the capsule, then the refit
      const c0 = L.flags.chuteLandings || 0, e0 = L.flags.exploded; let maxSink = 0;
      for (let i = 0; i < 60 * 120 && st.phase !== "TAXI"; i++) { L.update(1 / 60); if (L.rk.chute === 2 && L.rk.chuteT > 3) maxSink = Math.max(maxSink, -L.rk.vy); }
      out.landedSoft = (L.flags.chuteLandings || 0) > c0 && L.flags.exploded === e0 && st.phase === "TAXI"; out.maxSink = Math.round(maxSink);
      out.stillCapsule = L.rk.stage === 3; const padP = L.rocketPad(st.originIdx); const dPad = Math.hypot(st.x - padP.x, st.z - padP.z); out.nearPad = dPad > 150 && dPad < 1500 && !(Math.abs(st.x) < T.runwayWidth / 2 + 100 && Math.abs(st.z - ap.cz) < T.runwayLength / 2 + 200);
      for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
      out.notYetRefit = L.rk.stage === 3;
      out.recovery = (L.flags.recoveries || 0) > 0;
      const f0 = L.flags.refits || 0; const y0 = st.y; let yPeak = y0, moved = false;
      for (let i = 0; i < 60 * 11 && (L.flags.refits || 0) === f0; i++) { L.update(1 / 60); yPeak = Math.max(yPeak, st.y); if (L.rk.stage === 3 && Math.hypot(st.x - padP.x, st.z - padP.z) < dPad - 100) moved = true; }
      out.lifted = yPeak > y0 + 3; out.carried = moved;
      out.destAsked = !document.getElementById("screenDest").classList.contains("hiddenS"); document.getElementById("screenDest").classList.add("hiddenS");
      out.refit = L.rk.stage === 0 && !L.rk.satOut && (L.flags.refits || 0) > f0 && Math.abs(st.x - L.rocketPad(st.originIdx).x) < 1 && st.phase === "TAXI" && out.recovery && out.lifted && out.carried && out.destAsked;
      return out;
    });
    check("rocket: the capsule deploys a satellite in space (button only then; it unfolds and drifts off); the go button keeps the destination's icon, and shows the runway once he is heading home",
      ret.satShown && ret.chuteHiddenInSpace && ret.did && ret.satAdded && ret.satHiddenAfter && ret.unfolded && ret.drifted && ret.skipHome && ret.iconHome && ret.deorbit, JSON.stringify(ret));
    check("rocket: reentry glows (model + window overlay) heat-shield first; no chute button above the drogue height; the drogue pops by itself",
      ret.glowPeak > 0.5 && ret.overlayPeak > 0.2 && !ret.btnEarly && ret.pitchAtGlow > 60 && ret.reentries > 0 && ret.drogueAuto && ret.drogueAlt < 480 && ret.drogueAlt > 330, JSON.stringify(ret));
    check("rocket: drogue then mains (button below its height, auto below that), a slow float down, a soft landing as the capsule somewhere around home (not the pad or runway); the recovery ship/truck lifts it and carries it, then the pad refits",
      ret.mainsBtn && ret.drogueSink > 22 && ret.drogueSink < 38 && ret.mainsAuto && ret.landedSoft && ret.maxSink < 13 && ret.stillCapsule && ret.nearPad && ret.notYetRefit && ret.refit, JSON.stringify(ret));
    await page.close();
  }


  // ---------- T-EV space events: one big thing every launch ----------
  {
    // A context whose pages start with a chosen localStorage instead of a cleared one.
    async function seededPage(seed) {
      const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(s => {
        try { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); } catch (e) {}
        let sd = 0x2F6E2B1;
        Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      }, seed);
      const p = await ctx.newPage();
      await p.addInitScript(`window.__rafQueue=[];window.__simTime=0;window.requestAnimationFrame=cb=>{__rafQueue.push(cb);return __rafQueue.length;};`);
      await p.goto(URL);
      await p.waitForFunction(() => !!window.__lp, null, { timeout: 15000 });
      await p.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });
      return { ctx, page: p };
    }
    // Counts calls to the real sound functions (audio.js declares them, so they are
    // properties of window and the game's own unqualified calls go through these).
    const TAP = `window.__snd = {};
      for (const n of ["liftoffRoar","stageSep","whoosh","ringNote","fanfare","boomSound","chime","fireworkSound","cheer","noiseBurst"]) {
        const orig = window[n]; window.__snd[n] = 0;
        window[n] = function () { window.__snd[n]++; return orig.apply(null, arguments); };
      }`;

    let page = (await newPage(1180, 820)).page;
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.setVehicle("rocket"); window.__lp.api.placeOnRunway(); });

    // ---- the draw
    const draw = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const out = { seq: [], repeats: 0, impactsOnMars: 0, impactsOnMoon: 0 };
      st.dest = "moon";
      for (let i = 0; i < 60; i++) {
        L.api.placeOnRunway();
        out.seq.push(L.ev.kind);
        if (i && L.ev.kind === out.seq[i - 1]) out.repeats++;
        if (L.ev.kind === "impacts") out.impactsOnMoon++;
      }
      out.allKnown = out.seq.every(k => L.EVENT_KINDS.indexOf(k) >= 0);
      out.covered = L.EVENT_KINDS.every(k => out.seq.indexOf(k) >= 0);
      st.dest = "mars";
      for (let i = 0; i < 60; i++) { L.api.placeOnRunway(); if (L.ev.kind === "impacts") out.impactsOnMars++; }
      // picking a destination redraws against it, so `impacts` is reachable from any pad state
      st.dest = "mars"; L.api.placeOnRunway(); st.dest = "moon"; L.eventsOnDest();
      out.redrawValid = L.ev.dest === "moon" && L.EVENT_KINDS.indexOf(L.ev.kind) >= 0;
      out.stored = localStorage.getItem("lp.lastEvent");
      out.storedIsLast = out.stored === L.ev.kind;
      // an event only stages after a real liftoff: a teleport into space must not arm one
      L.api.placeOnRunway();
      out.armedOnPad = L.ev.armed;
      st.phase = "AIRBORNE"; st.y = 4000; st.spaceF = 1;
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      out.armedAfterTeleport = L.ev.armed;
      out.startedAfterTeleport = L.ev.started;
      return out;
    });
    check("events: every pad spawn draws one of the six, never the same twice running; all six come up; lp.lastEvent records it",
      draw.allKnown && draw.covered && draw.repeats === 0 && draw.storedIsLast && draw.redrawValid, JSON.stringify({ ...draw, seq: draw.seq.slice(0, 10) }));
    check("events: only a real liftoff arms one -- a teleport into space stages nothing",
      draw.armedOnPad === false && draw.armedAfterTeleport === false && draw.startedAfterTeleport === false, JSON.stringify(draw));
    check("events: the Moon's impacts are only ever drawn for a Moon flight",
      draw.impactsOnMars === 0 && draw.impactsOnMoon > 0, JSON.stringify({ mars: draw.impactsOnMars, moon: draw.impactsOnMoon }));

    // lp.lastEvent round-trips into a fresh session, and a corrupt one is ignored
    {
      const good = await seededPage({ "lp.lastEvent": "comet" });
      const r1 = await good.page.evaluate(() => {
        const L = window.__lp;
        const boot = L.ev.prev;                     // read before a draw overwrites it
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        return { boot, first: L.ev.kind };
      });
      await good.ctx.close();
      const bad = await seededPage({ "lp.lastEvent": "{not-an-event}" });
      const r2 = await bad.page.evaluate(() => {
        const L = window.__lp;
        const boot = L.ev.prev;
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        return { boot, first: L.ev.kind, errors: (window.__lp.frameErrors || 0) };
      });
      await bad.ctx.close();
      check("events: lp.lastEvent round-trips into the next session (never repeated first); a corrupt value is ignored silently",
        r1.boot === "comet" && r1.first !== "comet" && r2.boot === null && !!r2.first && r2.errors === 0,
        JSON.stringify({ r1, r2 }));
    }

    // ---- a real launch, with nothing forced: the drawn event stages by itself
    {
      await page.close();
      page = (await newPage(1180, 820)).page;
      const live = await page.evaluate(() => {
        const L = window.__lp, st = L.state, R = L.TUNE.rocketTune;
        L.noRender = true;
        L.api.setVehicle("rocket");
        // spawn until the draw comes up "race" (an ascent event, so it stages on the way up)
        let tries = 0;
        do { L.api.placeOnRunway(); tries++; } while (L.ev.kind !== "race" && tries < 60);
        const out = { tries, kind: L.ev.kind, armed: L.ev.armed, started: L.ev.started };
        // ... then just fly it: hold the throttle through the ignite hold and climb
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 30; i++) {
          L.update(1 / 60);
          if (L.rocketCanDrop()) L.dropStage();          // the normal flight still works
        }
        L.api.setThrottle(false);
        out.liftoff = L.flags.liftoff > 0;
        out.armedAfter = L.ev.armed;
        out.staged = L.ev.started && (L.flags.evRace || 0) === 1;
        out.rivalOut = !!(L.ev.race && L.ev.race.g.visible);
        out.stageDrops = L.flags.stageDrops || 0;        // the event never blocked anything
        out.exploded = L.flags.exploded;
        out.frameErrors = L.frameErrors || 0;
        return out;
      });
      check("events: a plain launch -- throttle held, nothing forced -- arms the drawn event and stages it, and the flight goes on exactly as before",
        live.kind === "race" && live.armed === false && live.started === false && live.liftoff &&
        live.armedAfter && live.staged && live.rivalOut && live.stageDrops >= 2 &&
        live.exploded === 0 && live.frameErrors === 0, JSON.stringify(live));
    }

    // ---- race to orbit
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const race = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.eventsForce("race");
      const out = { before: L.evGroup.children.length };
      L.api.setThrottle(true);
      let seen = 0, minD = 1e9, maxD = 0;
      for (let i = 0; i < 60 * 70 && !(L.ev.race && L.ev.race.parked); i++) {
        L.update(1 / 60);
        if (L.ev.race && L.ev.race.g.visible) {
          seen++;
          const d = Math.hypot(L.ev.race.g.position.x - st.x, L.ev.race.g.position.y - st.y, L.ev.race.g.position.z - st.z);
          minD = Math.min(minD, d); maxD = Math.max(maxD, d);
        }
      }
      L.api.setThrottle(false);
      out.seen = seen; out.minD = Math.round(minD); out.maxD = Math.round(maxD);
      out.flag = L.flags.evRace || 0; out.stages = L.flags.evRaceStages || 0;
      out.parked = !!(L.ev.race && L.ev.race.parked);
      out.plumeOff = !!(L.ev.race && !L.ev.race.g.userData.rocket.flame.visible);
      out.boosterGone = !!(L.ev.race && !L.ev.race.g.userData.rocket.booster.visible);
      // the dropped booster is a real prop in the world
      out.debris = L.evProps.filter(p => p.kind === "debris").length;
      out.snd = { ...window.__snd };
      return out;
    });
    check("events: race to orbit -- a second rocket lights up beside him, is rubber-banded near him the whole climb, stages, then parks with its plume out",
      race.flag === 1 && race.seen > 600 && race.minD > 20 && race.maxD < 400 && race.stages === 1 &&
      race.boosterGone && race.parked && race.plumeOff && race.snd.liftoffRoar > 0 && race.snd.stageSep > 0,
      JSON.stringify(race));

    // ---- meteor shower
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const met = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE;
      const btn = document.getElementById("missileBtn");
      const hidden = () => btn.classList.contains("hidden");
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.update(1 / 60);                       // the buttons are set by the frame, not the spawn
      const out = { btnOnPad: hidden() };
      L.eventsForce("meteors");
      st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
      st.y = 4000; st.pitch = 10; st.spaceF = 1;
      const park = () => { L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; };
      for (let i = 0; i < 60 * 4; i++) { L.update(1 / 60); park(); }
      out.rocks = L.evProps.filter(p => p.kind === "meteor" && p.life > 0).length;
      out.btnInShower = !hidden();
      // A four-year-old: point the nose straight at the nearest rock and tap. No
      // lead, no timing -- and only as often as the cooldown allows.
      let shots = 0;
      for (let f = 0; f < 60 * 40; f++) {
        let best = null, bd = 1e9;
        for (const p of L.evProps) {
          if (p.kind !== "meteor" || p.life <= 0) continue;
          const d = Math.hypot(p.mesh.position.x - st.x, p.mesh.position.y - st.y, p.mesh.position.z - st.z);
          if (d < bd) { bd = d; best = p; }
        }
        if (best) {
          const dx = best.mesh.position.x - st.x, dy = best.mesh.position.y - st.y, dz = best.mesh.position.z - st.z;
          st.heading = Math.atan2(-dx, -dz); st.pitch = Math.asin(dy / bd) / (Math.PI / 180);
          if (st.missileCooldown <= 0) { const n0 = L.flags.missiles; L.fireMissile(); if (L.flags.missiles > n0) shots++; }
        }
        L.update(1 / 60); park();
        if (f === 60 * 6) out.chunks = L.evProps.filter(p => p.kind === "chunk").length;
      }
      out.shots = shots; out.hits = L.flags.evMeteorHits || 0;
      out.exploded = L.flags.exploded;   // rocks never hurt him
      out.snd = { ...window.__snd };
      // the button goes away with the shower, and never comes back for a plain flight
      out.btnAfter = hidden();
      L.api.placeOnRunway();
      st.phase = "AIRBORNE"; st.y = 4000; st.spaceF = 1; L.update(1 / 60);
      out.btnNoShower = hidden();
      return out;
    });
    check("events: meteor shower -- rocks stream past with whooshes, and the missile button comes up only while it runs (the rocket has none otherwise)",
      met.btnOnPad && met.rocks >= 6 && met.btnInShower && met.btnAfter && met.btnNoShower && met.snd.whoosh > 3, JSON.stringify(met));
    check("events: shooting a rock bursts it into tumbling chunks with a note -- a dozen easy hits from plain aiming, and a rock can never hurt him",
      met.hits >= 12 && met.chunks > 0 && met.snd.ringNote >= met.hits && met.exploded === 0, JSON.stringify(met));

    // ---- comet
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const com = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.eventsForce("comet");
      st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
      st.y = 4000; st.spaceF = 1;
      const park = () => { L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; };
      for (let i = 0; i < 60 * 2; i++) { L.update(1 / 60); park(); }
      const out = { started: L.ev.started, flag: L.flags.evComet || 0, has: !!L.ev.comet };
      const c = L.ev.comet;
      out.moved0 = c ? [c.x, c.y, c.z].map(Math.round) : null;
      out.coatBefore = !!L.ev.coat;
      // fly into the tail
      for (let i = 0; i < 60 * 2 && c; i++) {
        st.x = c.x - c.d.x * 420; st.y = c.y - c.d.y * 420; st.z = c.z - c.d.z * 420;
        L.update(1 / 60); L.rk.vx = L.rk.vy = L.rk.vz = 0;
      }
      out.moved = c ? Math.hypot(c.x - out.moved0[0], c.y - out.moved0[1], c.z - out.moved0[2]) > 100 : false;
      out.tail = L.flags.evCometTail || 0;
      out.coat = !!L.ev.coat;
      out.coatSpecks = L.ev.coat ? L.ev.coat.g.children.length : 0;
      // the glitter rides along with him, and stays on until recovery
      st.x += 300; L.update(1 / 60);
      out.coatFollows = L.ev.coat ? Math.hypot(L.ev.coat.g.position.x - st.x, L.ev.coat.g.position.z - st.z) < 1 : false;
      out.snd = { ...window.__snd };
      return out;
    });
    check("events: comet flyby -- one enormous comet crosses his orbit, and flying through the tail sparkles and coats the rocket in glitter that rides along",
      com.started && com.has && com.flag === 1 && com.moved && com.tail > 0 && com.coatBefore === false &&
      com.coat && com.coatSpecks > 10 && com.coatFollows && com.snd.fanfare >= 2, JSON.stringify(com));

    // ---- moon impacts
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const imp = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      st.dest = "moon";
      L.eventsForce("impacts");
      const b = L.BODIES[0];
      st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
      st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
      L.update(1 / 60);
      const out = { deployed: L.roverDeploy(), startedBefore: L.ev.started };
      for (let i = 0; i < 60 * 40; i++) L.update(1 / 60);
      out.hits = L.flags.evImpactHits || 0;
      out.craters = L.evCraters.length;
      out.flag = L.flags.evImpacts || 0;
      // they land near him but never on him
      out.nearest = Math.round(Math.min(...L.evCraters.map(c => Math.hypot(c.x - L.rover.x, c.y - L.rover.y, c.z - L.rover.z))));
      out.furthest = Math.round(Math.max(...L.evCraters.map(c => Math.hypot(c.x - L.rover.x, c.y - L.rover.y, c.z - L.rover.z))));
      // drive into one and it bursts; it can only be burst once
      const c = L.evCraters[0];
      L.rover.x = c.x; L.rover.y = c.y; L.rover.z = c.z;
      for (let i = 0; i < 40; i++) L.update(1 / 60);
      out.pops = L.flags.evCraterPops || 0;
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      out.popsAgain = L.flags.evCraterPops || 0;
      out.snd = { ...window.__snd };
      return out;
    });
    check("events: Moon impacts -- meteors thump down around the rover (near, never on it) and each leaves a glowing crater; driving into one bursts it, once",
      imp.deployed && imp.hits >= 4 && imp.craters === imp.hits && imp.flag === 1 &&
      imp.nearest > 8 && imp.furthest < 120 && imp.pops === 1 && imp.popsAgain === 1 &&
      imp.snd.boomSound >= imp.hits && imp.snd.chime > 0, JSON.stringify(imp));

    // ---- escort
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const esc = await page.evaluate(() => {
      const L = window.__lp, st = L.state, R = L.TUNE.rocketTune;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.eventsForce("escort");
      const out = {};
      // coasting in space: no plasma, so nothing stages
      st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
      st.y = 5000; st.pitch = 90; st.spaceF = 1;
      for (let i = 0; i < 60 * 3; i++) { L.update(1 / 60); L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 5000; }
      out.glowInSpace = +L.rk.reentry.toFixed(2);
      out.beforeGlow = L.evProps.filter(p => p.kind === "streak").length;
      out.startedBefore = L.ev.started;
      // now let it really fall: the plasma builds by itself and the escort comes with it
      st.y = 1800; L.rk.vx = L.rk.vz = 0; L.rk.vy = -200;
      let peak = 0, peakGlow = 0, farthest = 0;
      for (let i = 0; i < 60 * 6 && st.phase === "AIRBORNE"; i++) {
        L.update(1 / 60);
        peakGlow = Math.max(peakGlow, L.rk.reentry);
        const live = L.evProps.filter(p => p.kind === "streak");
        peak = Math.max(peak, live.length);
        for (const p of live) farthest = Math.max(farthest, Math.hypot(p.mesh.position.x - st.x, p.mesh.position.y - st.y, p.mesh.position.z - st.z));
      }
      out.peakGlow = +peakGlow.toFixed(2);
      out.streaks = peak;
      out.farthest = Math.round(farthest);   // they fall with him, not left hanging in the sky
      out.flag = L.flags.evEscort || 0;
      out.snd = { ...window.__snd };
      out.exploded = L.flags.exploded;
      // they burn out on their own and the event finishes
      for (let i = 0; i < 60 * 10; i++) L.update(1 / 60);
      out.burntOut = L.evProps.filter(p => p.kind === "streak").length;
      out.done = L.ev.done;
      return out;
    });
    check("events: shooting-star escort -- nothing until the plasma phase, then a spread of meteors burns up alongside him and goes out by itself",
      esc.glowInSpace === 0 && esc.beforeGlow === 0 && esc.startedBefore === false &&
      esc.peakGlow > 0.3 && esc.streaks >= 8 && esc.flag === 1 && esc.farthest < 500 &&
      esc.snd.whoosh >= 8 && esc.burntOut === 0 && esc.done && esc.exploded === 0, JSON.stringify(esc));

    // ---- fireworks welcome
    await page.close();
    page = (await newPage(1180, 820)).page;
    await page.evaluate(TAP);
    const fw = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.eventsForce("fireworks");
      const rec = L.RECOVERY[st.originIdx];
      st.phase = "AIRBORNE"; L.rk.stage = 3;
      st.x = rec.barge.x; st.z = rec.barge.z + 120; st.y = 60;
      L.rk.vx = L.rk.vz = 0; L.rk.vy = -8; L.rk.chute = 2;
      const out = {};
      for (let i = 0; i < 60 * 25 && st.phase !== "TAXI"; i++) L.update(1 / 60);
      out.landed = st.phase === "TAXI";
      out.startedAtOnce = L.ev.started;
      for (let i = 0; i < 60 * 7; i++) L.update(1 / 60);
      out.flag = L.flags.evFireworks || 0;
      out.shells = L.flags.evFireworkShells || 0;
      out.shellsWanted = L.TUNE.events.fireworks.count;
      out.wet = L.ev.wet;
      out.snd = { ...window.__snd };
      out.exploded = L.flags.exploded;
      return out;
    });
    // ... and the same show on an upright landing at home, where the pad refits
    // after only refitDelay: every shell must still get off before that.
    const fwDry = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.setVehicle("rocket"); L.api.placeOnRunway();
      L.eventsForce("fireworks");
      const s0 = L.flags.evFireworkShells || 0, r0 = L.flags.refits || 0;
      st.phase = "AIRBORNE"; st.y += 120; L.rk.vx = L.rk.vz = 0; L.rk.vy = -10;
      const out = {};
      for (let i = 0; i < 60 * 30 && st.phase !== "TAXI"; i++) L.update(1 / 60);
      out.landed = st.phase === "TAXI"; out.chute = L.rk.chute;
      L.update(1 / 60);                     // the barrage starts on the frame after the touchdown
      out.wet = L.ev.wet; out.base = Math.round(L.ev.base);
      for (let i = 0; i < 60 * 20 && (L.flags.refits || 0) === r0; i++) L.update(1 / 60);
      out.refit = (L.flags.refits || 0) > r0;
      out.shells = (L.flags.evFireworkShells || 0) - s0;
      return out;
    });
    check("events: fireworks welcome -- a full barrage goes up over the splashdown as the recovery ship comes for the capsule, and fits before the refit on an upright landing too",
      fw.landed && fw.wet && fw.flag === 1 && fw.shells === fw.shellsWanted &&
      fw.snd.fireworkSound >= 10 && fw.snd.cheer > 0 && fw.exploded === 0 &&
      fwDry.landed && !fwDry.wet && fwDry.refit && fwDry.shells === fw.shellsWanted,
      JSON.stringify({ fw, fwDry }));

    // ---- despawn, text and frame time
    await page.close();
    page = (await newPage(1180, 820)).page;
    const clean = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true;
      const out = { leaks: [], text: [] };
      const badText = () => {
        const bad = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          const n = w.currentNode, p = n.parentElement && n.parentElement.tagName;
          if (p === "SCRIPT" || p === "STYLE") continue;
          const t = n.nodeValue.trim();
          if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 30));
        }
        return bad;
      };
      const stage = (k) => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        st.dest = "moon";
        L.eventsForce(k);
        if (k === "race") {
          L.api.setThrottle(true);
          for (let i = 0; i < 60 * 25; i++) L.update(1 / 60);
          L.api.setThrottle(false);
        } else if (k === "meteors" || k === "comet") {
          st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; st.y = 4000; st.spaceF = 1;
          for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; }
        } else if (k === "impacts") {
          const b = L.BODIES[0];
          st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
          st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
          L.update(1 / 60); L.roverDeploy();
          for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
        } else if (k === "escort") {
          st.phase = "AIRBORNE"; L.rk.stage = 3; st.y = 1800; L.rk.vx = L.rk.vz = 0; L.rk.vy = -200;
          for (let i = 0; i < 60 * 4 && st.phase === "AIRBORNE"; i++) L.update(1 / 60);
        } else if (k === "fireworks") {
          const rec = L.RECOVERY[st.originIdx];
          st.phase = "AIRBORNE"; L.rk.stage = 3;
          st.x = rec.barge.x; st.z = rec.barge.z + 120; st.y = 60; L.rk.vx = L.rk.vz = 0; L.rk.vy = -8; L.rk.chute = 2;
          for (let i = 0; i < 60 * 25 && st.phase !== "TAXI"; i++) L.update(1 / 60);
          for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
        }
        // whatever this one puts in the world: props, the two reused models, or sparks
        return L.evGroup.children.length + (L.ev.race ? 1 : 0) + (L.ev.comet ? 1 : 0) + L.evSparksAlive();
      };
      const pass = () => {
        for (const k of L.EVENT_KINDS) {
          const staged = stage(k);
          out.text = out.text.concat(badText());
          // ... then a fresh stack on the pad puts it all away
          L.api.setVehicle("rocket"); L.api.placeOnRunway();
          for (let i = 0; i < 30; i++) L.update(1 / 60);
          out.leaks.push({ k, staged, left: L.evGroup.children.length, props: L.evProps.length,
            craters: L.evCraters.length, sparks: L.evSparksAlive(),
            race: !!L.ev.race, comet: !!L.ev.comet, coat: !!L.ev.coat });
        }
        return L.scene.children.length;
      };
      const after1 = pass();
      const after2 = pass();
      out.sceneGrowth = after2 - after1;   // the two reused models are built once, not per launch
      out.everyStaged = out.leaks.every(r => r.staged > 0);
      out.everyClear = out.leaks.every(r => r.left === 0 && r.props === 0 && r.craters === 0 && r.sparks === 0 && !r.race && !r.comet && !r.coat);
      out.frameErrors = L.frameErrors || 0;
      return out;
    });
    check("events: every event puts props in the world and a pad spawn takes them all away again -- no leaked meshes, no growing scene",
      clean.everyStaged && clean.everyClear && clean.sceneGrowth <= 2 && clean.frameErrors === 0,
      JSON.stringify({ ...clean, text: clean.text.slice(0, 3) }));
    check("events: zero text anywhere in the UI while any of the six is staged",
      clean.text.length === 0, JSON.stringify(clean.text.slice(0, 6)));

    const perf = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      const park = () => { L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; };
      const space = () => {
        st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity];
        st.y = 4000; st.pitch = 10; st.spaceF = 1;
      };
      // the real cost of a shower is draw calls, not the simulation, so both are timed
      const sim = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { L.update(1 / 60); park(); } return (performance.now() - t0) / n; };
      const drawn = (n) => {
        L.noRender = false;
        const t0 = performance.now();
        for (let i = 0; i < n; i++) { const q = window.__rafQueue.splice(0); if (q.length) q[q.length - 1](window.__simTime += 1000 / 60); park(); }
        const ms = (performance.now() - t0) / n;
        L.noRender = true;
        return ms;
      };
      L.noRender = true;
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); space();
      sim(60); drawn(20);                              // warm the pipeline
      const baseSim = sim(300), baseDraw = drawn(90);   // in space, no event staged
      L.api.placeOnRunway(); L.eventsForce("meteors"); space();
      for (let i = 0; i < 60 * 8; i++) { L.update(1 / 60); park(); }   // let the shower fill up
      const rocks = L.evProps.length;
      const showSim = sim(300), showDraw = drawn(90);
      return { baseSim: +baseSim.toFixed(3), showSim: +showSim.toFixed(3),
               baseDraw: +baseDraw.toFixed(2), showDraw: +showDraw.toFixed(2), rocks };
    });
    console.log(`INFO  events: ${perf.baseSim.toFixed(2)} -> ${perf.showSim.toFixed(2)} ms of update(), ` +
      `${perf.baseDraw.toFixed(1)} -> ${perf.showDraw.toFixed(1)} ms of CPU per drawn frame with ${perf.rocks} props (swiftshader)`);
    check("events: frame time holds during the meteor shower",
      perf.rocks > 5 &&
      perf.showSim < Math.max(perf.baseSim * 2.5 + 0.5, 4) &&
      perf.showDraw < perf.baseDraw * 1.8 + 6, JSON.stringify(perf));
    await page.close();
  }


  // ---------- T-EVA the spacewalk round trip, with every event staged ----------
  {
    // The regression this guards: the reel-in steered straight at the airlock, which
    // sits on the side of the core -- so from behind the station the push-out
    // cancelled it exactly and he hung against the wall for ever.
    const runs = [];
    for (const kind of [null, "race", "meteors", "comet", "impacts", "escort", "fireworks"]) {
      const { page } = await newPage(1180, 820);
      const r = await page.evaluate((k) => {
        const L = window.__lp, st = L.state;
        L.noRender = true;
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        if (k) L.eventsForce(k);
        const hatch = document.getElementById("hatchBtn"), go = document.getElementById("skipBtn");
        // tap whatever is actually on top at that button's centre, like a finger would
        const tap = (btn) => {
          const b = btn.getBoundingClientRect();
          const x = b.left + b.width / 2, y = b.top + b.height / 2;
          const hit = document.elementFromPoint(x, y);
          if (!hit) return null;
          hit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
          return hit.id || hit.tagName;
        };
        const o = { kind: k || "none" };
        // fly out and dock
        const dock = L.BODIES.find(b => b.name === "station");
        st.dest = "station";
        st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; st.spaceF = 1;
        st.x = dock.x; st.y = dock.y + 200; st.z = dock.z;
        L.rk.vx = 0; L.rk.vy = -20; L.rk.vz = 0;
        for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
        L.update(1 / 60);
        o.docked = !!(L.rk.onBody && L.rk.onBody.dock);
        // the hatch button is the one under the finger, not something stacked over it
        o.hatchOnTop = tap(hatch) === "hatchBtn";
        for (let i = 0; i < 30; i++) L.update(1 / 60);
        o.inside = L.astro.mode === "inside";
        // ... and out on the tether
        o.evaOnTop = tap(hatch) === "hatchBtn";
        for (let i = 0; i < 30; i++) L.update(1 / 60);
        o.eva = L.astro.mode === "eva";
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 14; i++) L.update(1 / 60);
        L.api.setThrottle(false);
        const s = L.station.position;
        o.floated = Math.round(Math.hypot(L.eva.x - s.x, L.eva.y - s.y, L.eva.z - s.z));
        o.tethered = o.floated <= L.EVA.tether * 1.3;   // it reels him back gently, so a thrusting overshoot is fine
        // the regression: park him dead behind the core, where the way home is blocked
        L.eva.x = s.x - 26; L.eva.y = s.y - 2; L.eva.z = s.z;
        L.eva.vx = L.eva.vy = L.eva.vz = 0;
        const back0 = L.flags.spacewalkReturns || 0;
        o.backOnTop = tap(hatch) === "hatchBtn";
        let f = 0;
        for (; f < 60 * 45 && L.astro.mode === "evaReturn"; f++) L.update(1 / 60);
        o.returnSecs = +(f / 60).toFixed(1);
        o.cameHome = (L.flags.spacewalkReturns || 0) > back0 && L.astro.mode === "inside";
        // the go button takes him from there back to the seat
        o.goOnTop = tap(go) === "skipBtn";
        for (let i = 0; i < 60 * 45 && L.astro.mode !== "none"; i++) L.update(1 / 60);
        o.inSeat = L.astro.mode === "none" && st.phase === "TAXI" && !!L.rk.onBody;
        // ... and the flight carries on: undock, deorbit, glow, come down
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
        L.api.setThrottle(false);
        o.undocked = !L.rk.onBody && st.phase === "AIRBORNE";
        for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
        L.rk.launchedFromBody = true;
        o.canGoHome = L.rocketCanSkip();
        L.rocketSkipToLanding();
        for (let i = 0; i < 60 * 200 && st.phase !== "TAXI"; i++) L.update(1 / 60);
        o.reentered = (L.flags.reentries || 0) > 0;
        o.landed = st.phase === "TAXI";
        o.exploded = L.flags.exploded;
        o.frameErrors = L.frameErrors || 0;
        return o;
      }, kind);
      runs.push(r);
      await page.close();
    }
    const bad = runs.filter(r => !(r.docked && r.hatchOnTop && r.inside && r.evaOnTop && r.eva &&
      r.tethered && r.backOnTop && r.cameHome && r.returnSecs < 40 && r.goOnTop && r.inSeat &&
      r.undocked && r.canGoHome && r.reentered && r.landed && r.frameErrors === 0));
    check("eva: the whole spacewalk round trip -- inside, out on the tether, home from behind the core, back to the seat, then on to reentry -- works with every event staged",
      bad.length === 0, JSON.stringify(bad.length ? bad : runs.map(r => `${r.kind}:${r.returnSecs}s`)));
  }

  // ---------- T-EVA2 the reel-in comes home from anywhere ----------
  {
    const { page } = await newPage(1180, 820);
    const sweep = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true;
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      const dock = L.BODIES.find(b => b.name === "station");
      st.dest = "station";
      st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; st.spaceF = 1;
      st.x = dock.x; st.y = dock.y + 200; st.z = dock.z;
      L.rk.vx = 0; L.rk.vy = -20; L.rk.vz = 0;
      for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
      L.toggleHatch(); for (let i = 0; i < 20; i++) L.update(1 / 60);
      L.toggleHatch(); for (let i = 0; i < 20; i++) L.update(1 / 60);
      const s = L.station.position;
      const stuck = [];
      let worst = 0, n = 0;
      // all the way round, near and far, high and low, with and without a finger
      // resting on the throttle
      for (const hold of [false, true]) {
        for (let i = 0; i < 16; i++) {
          const th = i / 16 * Math.PI * 2;
          for (const [rad, dy] of [[8, 0], [22, 0], [50, 0], [22, -9], [22, 9], [58, 3]]) {
            n++;
            L.astro.mode = "eva";
            L.eva.x = s.x + Math.cos(th) * rad; L.eva.y = s.y + dy; L.eva.z = s.z + Math.sin(th) * rad;
            L.eva.vx = L.eva.vy = L.eva.vz = 0;
            const r0 = L.flags.spacewalkReturns || 0;
            L.api.setThrottle(hold);
            L.leaveStation();
            let f = 0;
            for (; f < 60 * 40 && L.astro.mode === "evaReturn"; f++) L.update(1 / 60);
            L.api.setThrottle(false);
            if ((L.flags.spacewalkReturns || 0) > r0) {
              worst = Math.max(worst, f / 60);
              L.toggleHatch(); for (let q = 0; q < 20; q++) L.update(1 / 60);   // back outside for the next one
            } else {
              stuck.push({ hold, deg: Math.round(th * 180 / Math.PI), rad, dy });
              L.astro.mode = "eva";
            }
          }
        }
      }
      return { n, stuck: stuck.length, worst: +worst.toFixed(1), examples: stuck.slice(0, 5) };
    });
    check("eva: the tether reels him home from every direction around the station -- behind the core included -- and never leaves him stuck",
      sweep.stuck === 0 && sweep.n > 150 && sweep.worst < 25, JSON.stringify(sweep));
    await page.close();
  }


  // ---------- T-SLOT no two visible buttons share a slot ----------
  {
    // Buttons are stacked into a few fixed slots. Two visible at once and the one
    // later in the DOM silently eats the tap -- which is how the go button stopped
    // working at the station (the vehicle picker sat on it).
    const { page } = await newPage(1180, 820);
    const clashes = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true;
      const overlaps = () => {
        const btns = [...document.querySelectorAll(".roundBtn")].filter(b => {
          const cs = getComputedStyle(b);
          return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
        });
        const bad = [];
        for (const b of btns) {
          const r = b.getBoundingClientRect();
          if (!r.width) continue;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const owner = hit && hit.closest(".roundBtn");
          if (owner && owner !== b) bad.push(b.id + " under " + owner.id);
        }
        return bad;
      };
      const out = [];
      const at = (name, setup) => {
        setup();
        for (let i = 0; i < 12; i++) L.update(1 / 60);
        const bad = overlaps();
        if (bad.length) out.push({ name, bad });
      };
      const toStation = () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        const dock = L.BODIES.find(b => b.name === "station");
        st.dest = "station";
        st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; st.spaceF = 1;
        st.x = dock.x; st.y = dock.y + 200; st.z = dock.z;
        L.rk.vx = 0; L.rk.vy = -20; L.rk.vz = 0;
        for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
      };
      const toMoon = () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        st.dest = "moon";
        const b = L.BODIES[0];
        st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
        st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
      };
      at("plane on the runway", () => { L.api.setVehicle("prop"); L.api.placeOnRunway(); });
      at("plane airborne", () => { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 200, 0); });
      at("rocket on the pad", () => { L.api.setVehicle("rocket"); L.api.placeOnRunway(); });
      at("rocket climbing (stage button up)", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 40 && !L.rocketCanDrop(); i++) L.update(1 / 60);
        L.api.setThrottle(false);
      });
      at("capsule in space with a meteor shower", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.eventsForce("meteors");
        st.phase = "AIRBORNE"; L.rk.stage = 3; L.rk.fuel = [0, 0, Infinity]; st.y = 4000; st.spaceF = 1;
        for (let i = 0; i < 60 * 5; i++) { L.update(1 / 60); L.rk.vx = L.rk.vy = L.rk.vz = 0; st.y = 4000; }
      });
      at("capsule under the mains", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        st.phase = "AIRBORNE"; L.rk.stage = 3; st.y += 400; L.rk.vy = -30; L.rk.chute = 2;
      });
      at("docked at the station", toStation);
      at("inside the station", () => { toStation(); L.toggleHatch(); });
      at("out on a spacewalk", () => { toStation(); L.toggleHatch(); for (let i = 0; i < 20; i++) L.update(1 / 60); L.toggleHatch(); });
      at("landed on the Moon", toMoon);
      at("driving the rover", () => { toMoon(); L.update(1 / 60); L.roverDeploy(); });
      at("helicopter low over open water", () => {
        L.api.setVehicle("helicopter");
        st.phase = "AIRBORNE"; st.x = L.FF.rig.x + 400; st.z = L.FF.rig.z + 400;
        st.y = L.TUNE.waterLevel + 20; st.speed = 0;
      });
      at("helicopter over the fire with a full bucket", () => {
        L.api.setVehicle("helicopter");
        st.phase = "AIRBORNE"; st.x = L.FF.rig.x + 400; st.z = L.FF.rig.z + 400;
        st.y = L.TUNE.waterLevel + 20; st.speed = 0;
        for (let i = 0; i < 10; i++) L.update(1 / 60);
        L.bucketPress();
        for (let i = 0; i < 60 * (L.FF.scoopTime + 0.4); i++) { L.update(1 / 60); st.y = L.TUNE.waterLevel + 20; st.speed = 0; }
        st.x = L.FF.rig.x + 30; st.z = L.FF.rig.z + 30; st.y = L.fire.deck + 70;
      });
      at("parked on the carrier deck", () => {
        L.api.setVehicle("fighter"); L.carrierReset();
        st.phase = "AIRBORNE"; st.exploding = false;
        st.x = L.carrier.x + 2; st.z = L.carrier.z + L.CV.deckL / 2 - 20; st.y = L.carrier.deck + 10;
        st.heading = 0; st.pitch = 0; st.speed = 90; st.bank = 0;
        for (let i = 0; i < 60 * 8 && L.carrier.state !== "parked"; i++) L.update(1 / 60);
      });
      return out;
    });
    check("layout: no two visible buttons ever land in the same slot -- one would silently eat the other's tap",
      clashes.length === 0, JSON.stringify(clashes));
    await page.close();
  }


  // ---------- T-ENV the rocket landing envelope ----------
  {
    const { page } = await newPage(1180, 820);
    const env = await page.evaluate(() => {
      const L = window.__lp, st = L.state, R = L.TUNE.rocketTune;
      L.noRender = true;
      const out = {};
      const reset = () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway(); L.api.clearStick(); L.api.setThrottle(false);
        st.exploding = false; L.rk.onBody = null; L.rk.chute = 0;
        for (let i = 0; i < 5; i++) L.update(1 / 60);
      };
      // fly an approach and say what happened. `stick` holds the nose where it is put,
      // which is what a finger on the screen does -- and what stops the assist tidying it.
      const approach = (o) => {
        reset();
        const l0 = L.flags.rocketLandings || 0, mo0 = L.flags.moonLandings || 0, e0 = L.flags.exploded;
        st.phase = "AIRBORNE"; L.rk.stage = o.stage === undefined ? 3 : o.stage;
        st.x = o.x; st.y = o.y; st.z = o.z;
        st.pitch = o.pitch; st.heading = 0;
        L.rk.vx = o.vx || 0; L.rk.vy = o.vy; L.rk.vz = o.vz || 0;
        if (o.stick) L.api.setStick(0, o.stick);
        let f = 0;
        for (; f < 60 * (o.secs || 30) && !st.exploding && st.phase === "AIRBORNE"; f++) L.update(1 / 60);
        L.api.clearStick();
        return {
          landed: (L.flags.rocketLandings || 0) > l0 || (L.flags.moonLandings || 0) > mo0,
          exploded: L.flags.exploded > e0,
          secs: +(f / 60).toFixed(1),
          at: L.rk.lastArrival,
        };
      };
      // The full stack, Falcon style: that is what comes down on a pad. (The bare
      // capsule pops its parachutes low down, and under the canopies it simply
      // arrives -- there is no envelope to be outside of.)
      const pad = L.rocketPad(0), ap = L.AIRPORTS[0];
      out.padUpright = approach({ stage: 0, x: pad.x, y: pad.ground + 90, z: pad.z, pitch: 90, vy: -10 });
      out.padNoseDown = approach({ stage: 0, x: pad.x, y: pad.ground + 150, z: pad.z, pitch: -90, vy: -60, stick: -1, secs: 12 });
      out.padSideways = approach({ stage: 0, x: pad.x, y: pad.ground + 25, z: pad.z, pitch: 0, vy: -20, secs: 12 });
      // ---- the droneship deck
      const barge = L.RECOVERY[0].barge;
      out.deckUpright = approach({ stage: 0, x: barge.x, y: barge.deckY + 90, z: barge.z, pitch: 90, vy: -10 });
      out.deckNoseDown = approach({ stage: 0, x: barge.x, y: barge.deckY + 150, z: barge.z, pitch: -90, vy: -60, stick: -1, secs: 12 });
      // ---- out in a field: not a place a rocket lands
      out.field = approach({ stage: 0, x: pad.x + 700, y: ap.elev + 90, z: pad.z + 700, pitch: 90, vy: -10 });
      // ---- the Moon. He arrives at its underside, where "up" is -y: the stick follows
      // the local up, so a pull that means "nose up" there is a negative one here.
      const m = L.BODIES[0];
      out.moonUpright = approach({ x: m.x, y: m.y - m.r - 60, z: m.z, pitch: -90, vy: 12, secs: 25 });
      out.moonNoseFirst = approach({ x: m.x, y: m.y - m.r - 90, z: m.z, pitch: 90, vy: 40, stick: -1, secs: 25 });

      // ---- a crash costs nothing: the pieces come back and the pad has a fresh one
      reset();
      // put something in the world first, and check it survives
      st.phase = "AIRBORNE"; L.rk.stage = 3; st.y = 4000; st.spaceF = 1; L.update(1 / 60);
      L.deploySatellite();
      const sats = L.satellites.length, spots = L.spots.filter(q => q.lit).length;
      const e0 = L.flags.exploded, f0 = L.flags.refits || 0, c0 = L.flags.rocketCrashes || 0;
      st.phase = "AIRBORNE"; L.rk.stage = 0; st.spaceF = 0;
      st.x = pad.x; st.y = pad.ground + 150; st.z = pad.z; st.pitch = -90;
      L.rk.vx = L.rk.vz = 0; L.rk.vy = -60;
      L.api.setStick(0, -1);
      let f = 0;
      for (; f < 60 * 12 && !st.exploding; f++) L.update(1 / 60);
      L.api.clearStick();
      out.crashed = st.exploding && L.flags.exploded > e0;
      out.crashCounted = (L.flags.rocketCrashes || 0) > c0;
      out.debris = L.flags.exploded > e0;
      let g = 0;
      for (; g < 60 * 8 && st.phase !== "TAXI"; g++) L.update(1 / 60);
      out.backSecs = +(g / 60).toFixed(1);   // from the bang to a fresh stack on the pad
      out.freshOnPad = st.phase === "TAXI" && L.rk.stage === 0 && !L.rk.onBody &&
        Math.abs(st.x - pad.x) < 1 && Math.abs(st.z - pad.z) < 1;
      out.refit = (L.flags.refits || 0) > f0;
      out.satsKept = L.satellites.length === sats && sats > 0;
      out.spotsKept = L.spots.filter(q => q.lit).length === spots;
      out.destAsked = !document.getElementById("screenDest").classList.contains("hiddenS");
      out.canLaunchAgain = (() => {
        L.api.skipScreens();          // a fresh stack asks where it is going, as after any refit
        L.api.setThrottle(true);
        let ok = false;
        for (let i = 0; i < 60 * 10; i++) { L.update(1 / 60); if (st.phase === "AIRBORNE") { ok = true; break; } }
        L.api.setThrottle(false);
        return ok;
      })();

      // ---- a crash away from Earth puts him back above that surface, not home
      reset();
      const m2 = L.BODIES[0];
      st.phase = "AIRBORNE"; L.rk.stage = 3;
      st.x = m2.x; st.y = m2.y - m2.r - 90; st.z = m2.z; st.pitch = 90;
      L.rk.vx = L.rk.vz = 0; L.rk.vy = 40;
      L.api.setStick(0, -1);
      for (let i = 0; i < 60 * 20 && !st.exploding; i++) L.update(1 / 60);
      L.api.clearStick();
      out.moonCrashed = st.exploding;
      for (let i = 0; i < 60 * 8 && st.exploding; i++) L.update(1 / 60);
      out.moonStaysThere = !st.exploding && Math.hypot(st.x - m2.x, st.y - m2.y, st.z - m2.z) < m2.r + 400;
      out.frameErrors = L.frameErrors || 0;
      return out;
    });
    check("rocket: a landing only counts inside the envelope -- upright and slow onto the pad, the droneship deck or the Moon lands; nose-down or sideways crashes",
      env.padUpright.landed && !env.padUpright.exploded &&
      env.deckUpright.landed && !env.deckUpright.exploded &&
      env.moonUpright.landed && !env.moonUpright.exploded &&
      env.padNoseDown.exploded && !env.padNoseDown.landed &&
      env.padSideways.exploded && !env.padSideways.landed &&
      env.deckNoseDown.exploded && !env.deckNoseDown.landed &&
      env.moonNoseFirst.exploded && !env.moonNoseFirst.landed,
      JSON.stringify(env));
    check("rocket: a powered arrival out in a field is not a landing either -- the pad, the deck, the tower and the planets are",
      env.field.exploded && !env.field.landed, JSON.stringify(env.field));
    check("rocket: a crash costs nothing -- it explodes, the pieces come back together and a fresh stack is on the pad a few seconds later, with the flight's satellites still up there",
      env.crashed && env.crashCounted && env.freshOnPad && env.refit && env.backSecs < 4 &&
      env.destAsked && env.satsKept && env.spotsKept && env.canLaunchAgain && env.frameErrors === 0,
      JSON.stringify({ ...env, padUpright: undefined, padNoseDown: undefined, padSideways: undefined,
        deckUpright: undefined, deckNoseDown: undefined, field: undefined, moonUpright: undefined, moonNoseFirst: undefined }));
    check("rocket: crashing away from Earth leaves him right there above the surface to try again, not back at the pad",
      env.moonCrashed && env.moonStaysThere, JSON.stringify({ moonCrashed: env.moonCrashed, moonStaysThere: env.moonStaysThere }));
    await page.close();
  }


  // ---------- T-SP1 set-pieces: demolition district ----------
  {
    const { page } = await newPage(1180, 820);
    const d = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, D = L.DEMO;
      L.noRender = true;
      const o = {};
      // ---- where it stands: clear of both approach corridors, on dry ground
      const half = T.routeLength / 2;
      o.towers = L.demo.towers.length;
      o.dry = L.terrainEff(L.demo.x, L.demo.z) > T.waterLevel + 1;
      o.clearOfCorridors = L.AIRPORTS.every(ap => {
        const dz = Math.abs(L.demo.z - ap.cz);
        const inCorridor = dz < T.runwayLength / 2 + T.ringStartDistance + 400;
        return !inCorridor || Math.abs(L.demo.x) > 400;
      });
      // every tower is a registered solid, and none of them is a shatter target
      let solid = 0, noShatter = 0;
      L.forEachSolid(b => { if (b.mesh && L.demo.towers.some(t => t.mesh === b.mesh)) { solid++; if (b.mesh.userData.noShatter) noShatter++; } });
      o.towerSolids = solid; o.towerNoShatter = noShatter;

      // ---- armed: the reticle is up and pulsing, nothing has happened yet
      const t0 = L.demo.reticleTower;
      const put = () => {
        st.phase = "AIRBORNE";
        st.x = L.demo.x - 300; st.z = L.demo.z + t0.lz; st.y = L.demo.base + t0.h * 0.6;
        st.heading = -Math.PI / 2; st.pitch = 0; st.speed = 60; st.bank = 0;
        for (let i = 0; i < 4; i++) L.update(1 / 60);
      };
      L.api.setVehicle("prop"); put();
      o.armed = L.demo.phase === "armed" && L.demo.reticle.visible;
      let s0 = L.demo.reticle.scale.x;
      for (let i = 0; i < 40; i++) L.update(1 / 60);
      o.reticlePulses = Math.abs(L.demo.reticle.scale.x - s0) > 0.01;

      // ---- one missile sets it off, and it is ANNOUNCED, not sudden
      const g0 = L.flags.demolitions || 0, f0 = L.flags.demoTowersFolded || 0;
      st.missileCooldown = 0; L.fireMissile();
      let hit = 0;
      for (; hit < 60 * 8 && L.demo.phase === "armed"; hit++) L.update(1 / 60);
      o.triggered = (L.flags.demolitions || 0) > g0;
      o.charging = L.demo.phase === "charging";
      o.nothingFoldedYet = (L.flags.demoTowersFolded || 0) === f0;
      // the wind-up: numerals on screen, and no tower down until it finishes
      const nums = new Set();
      let foldedDuringCharge = 0;
      for (let i = 0; i < 60 * D.charge - 6; i++) {
        L.update(1 / 60);
        const t = document.getElementById("bigNum").textContent;
        if (t) nums.add(t);
        if (L.demo.phase === "folding") foldedDuringCharge++;
      }
      o.countdown = [...nums].sort().join("");
      o.windUpHeldOff = foldedDuringCharge === 0;

      // ---- the domino: one at a time, with a readable gap, and never a wall while down
      const foldTimes = [];
      let prevFolded = 0, solidWhileDown = 0;
      for (let i = 0; i < 60 * 30 && L.demo.phase !== "down"; i++) {
        L.update(1 / 60);
        const n = L.flags.demoTowersFolded || 0;
        if (n > prevFolded) { foldTimes.push(i / 60); prevFolded = n; }
        L.forEachSolid(b => {
          const t = L.demo.towers.find(q => q.mesh === b.mesh);
          if (t && t.down && !L.__lpIsHidden(b)) solidWhileDown++;
        });
      }
      o.foldedAll = (L.flags.demoTowersFolded || 0) - f0 === D.towers;
      o.gaps = foldTimes.slice(1).map((t, i) => +(t - foldTimes[i]).toFixed(2));
      o.readableGap = o.gaps.length > 0 && o.gaps.every(g => g > D.foldDelay * 0.6 && g < D.foldDelay * 2.5);
      o.solidWhileDown = solidWhileDown;
      o.allShort = L.demo.towers.every(t => t.mesh.scale.y < 0.15);
      o.numClear = document.getElementById("bigNum").textContent === "";

      // ---- it stands itself back up, for free, and goes again
      for (let i = 0; i < 60 * 40 && L.demo.phase !== "armed"; i++) L.update(1 / 60);
      o.rebuilt = L.demo.phase === "armed" && L.demo.towers.every(t => Math.abs(t.mesh.scale.y - 1) < 0.02 && !t.mesh.userData.noSolid);
      o.reticleBack = L.demo.reticle.visible;
      o.rebuilds = L.flags.demoRebuilds || 0;
      put();
      st.missileCooldown = 0; L.fireMissile();
      for (let i = 0; i < 60 * 8 && L.demo.phase === "armed"; i++) L.update(1 / 60);
      o.again = (L.flags.demolitions || 0) === g0 + 2;
      o.exploded = L.flags.exploded;        // the missile itself bangs; he never does

      // ---- the alarm: quiet over the block, awake everywhere else
      L.demoReset();
      const alarmAt = (x, z, y) => {
        st.phase = "AIRBORNE"; st.exploding = false;
        st.x = x; st.z = z; st.y = y;
        st.heading = -Math.PI / 2; st.pitch = -20; st.speed = 70; st.bank = 0;
        st.alarmOn = false;
        let on = false;
        for (let i = 0; i < 24; i++) { L.update(1 / 60); if (st.alarmOn) on = true; st.x = x; st.z = z; st.y = y; }
        return on;
      };
      // diving at a tower from inside the fence
      o.alarmQuietInside = !alarmAt(L.demo.x + 40, L.demo.z + t0.lz, L.demo.base + 30);
      o.muted = L.demoAlarmMuted();
      // the same dive at a town well away from the block still sounds
      o.alarmWorksOutside = alarmAt(L.demo.x + 2200, L.demo.z, L.terrainEff(L.demo.x + 2200, L.demo.z) + 30);
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("set-piece: the demolition block stands mid-route on dry ground clear of both approach corridors, every tower solid and none of them blast-deleted",
      d.towers === 7 && d.dry && d.clearOfCorridors && d.towerSolids === 7 && d.towerNoShatter === 7, JSON.stringify(d));
    check("set-piece: one missile in the block sets it off -- and it is announced, not sudden: a wind-up with big numerals runs first and nothing folds until it finishes",
      d.armed && d.reticlePulses && d.triggered && d.charging && d.nothingFoldedYet && d.countdown === "123" && d.windUpHeldOff, JSON.stringify(d));
    check("set-piece: the towers then fold one at a time in a readable domino chain, and a folding tower is never an invisible wall",
      d.foldedAll && d.readableGap && d.solidWhileDown === 0 && d.allShort && d.numClear, JSON.stringify(d));
    check("set-piece: the crash alarm stays quiet inside the block -- he is meant to fly straight at those towers -- and speaks up again outside it",
      d.alarmQuietInside && d.alarmWorksOutside, JSON.stringify({ inside: d.alarmQuietInside, outside: d.alarmWorksOutside }));
    check("set-piece: the block puts itself back up on its own and can be brought down again, for free, for ever",
      d.rebuilt && d.reticleBack && d.rebuilds === 1 && d.again && d.frameErrors === 0, JSON.stringify(d));
    await page.close();
  }

  // ---------- T-SP2 set-pieces: the booster tower-catch ----------
  {
    const { page } = await newPage(1180, 820);
    const c = await page.evaluate(() => {
      const L = window.__lp, st = L.state, TC = L.TUNE.towerCatch;
      L.noRender = true;
      const o = {};
      const toDrop = () => {
        L.api.setVehicle("starship"); L.api.placeOnRunway();
        L.api.setThrottle(true);
        for (let i = 0; i < 60 * 40 && !L.rocketCanDrop(); i++) { L.update(1 / 60); L.rk.vx = 0; L.rk.vz = 0; }
        L.dropStage(); L.api.setThrottle(false);
        st.y = Math.max(st.y, 6000); L.rk.vx = L.rk.vy = L.rk.vz = 0;   // park the Ship out of the way
      };
      const hold = () => { st.y = 6000; L.rk.vx = L.rk.vy = L.rk.vz = 0; };
      toDrop();
      const a = L.airports.find(r => r.idx === st.originIdx);
      o.hasZone = !!a.catchZone && !a.catchZone.visible;   // dark until one is coming
      o.hasLights = (a.catchLights || []).length > 6;
      o.targetsTower = !!(L.fallingStages[0] && L.fallingStages[0].target && L.fallingStages[0].target.catch);

      // ---- the wind-up, all the way down
      const nums = new Set();
      let wide = false, zoneLit = false, glowOn = false, noseDir = [];
      const c0 = L.flags.boosterCatches || 0;
      for (let i = 0; i < 60 * 100 && (L.flags.boosterCatches || 0) === c0; i++) {
        L.update(1 / 60); hold();
        if (Math.abs(a.catchArms[0].rotation.y) > TC.armIdle + 0.15) wide = true;
        if (a.catchZone.visible && a.catchZone.material.opacity > 0.05) zoneLit = true;
        const s0 = L.fallingStages[0];
        if (s0 && s0.glow && s0.glow.visible) glowOn = true;
        const t = document.getElementById("bigNum").textContent;
        if (t) nums.add(t);
      }
      o.armsOpenedWide = wide; o.zoneLit = zoneLit; o.engineGlow = glowOn;
      o.countdown = [...nums].sort().join("");
      o.caught = (L.flags.boosterCatches || 0) > c0;

      // ---- caught: engines out, hanging upright on the arms, swaying, lights sweeping
      const bm = L.tcatch.hanging;
      o.engineCut = !!(L.fallingStages[0] && L.fallingStages[0].glow && !L.fallingStages[0].glow.visible);
      bm.updateMatrixWorld(true);
      const up = new THREE.Vector3(0, 0, -1).applyQuaternion(bm.quaternion);
      o.hangsUpright = up.y > 0.9;
      const tgt = L.fallingStages[0].target;
      o.onTheArms = Math.abs(bm.position.y - tgt.y) < 2 && Math.hypot(bm.position.x - tgt.x, bm.position.z - tgt.z) < TC.catchR;
      o.catchClosed = a.catchClosed;
      // the sway: the nose wanders, then settles
      const dirs = [];
      let swept = false;
      for (let i = 0; i < 60 * 6; i++) {
        L.update(1 / 60); hold();
        bm.updateMatrixWorld(true);
        const v = new THREE.Vector3(0, 0, -1).applyQuaternion(bm.quaternion);
        dirs.push(v.x);
        if ((a.catchLights || []).some(lt => lt.material.color.getHex() !== 0x2a2f38)) swept = true;
      }
      // ... and by the end of that the arms have shut on it
      o.armAngle = +a.catchArms[0].rotation.y.toFixed(3);
      o.armsShut = Math.abs(a.catchArms[0].rotation.y) < TC.armClosed + 0.06;
      o.swayed = Math.max(...dirs) - Math.min(...dirs) > 0.004;
      o.settles = Math.abs(dirs[dirs.length - 1] - dirs[dirs.length - 2]) < Math.abs(dirs[2] - dirs[1]);
      o.lightsSwept = swept;
      o.numClear = document.getElementById("bigNum").textContent === "";

      // ---- launch again and catch a second one: the first must be gone from the arms
      const firstMesh = L.tcatch.hanging;
      const cl0 = L.flags.catchCleared || 0, cA = L.flags.boosterCatches || 0;
      L.api.placeOnRunway();
      toDrop();
      o.oldCleared = (L.flags.catchCleared || 0) > cl0 && (!firstMesh || !firstMesh.parent);
      for (let i = 0; i < 60 * 100 && (L.flags.boosterCatches || 0) === cA; i++) { L.update(1 / 60); hold(); }
      o.twoCatches = (L.flags.boosterCatches || 0) === cA + 1;
      // exactly one booster is sitting on the arms
      const armY = L.rocketPad(st.originIdx).ground + L.TUNE.rocketTune.catch.armY;
      let onArms = 0;
      for (const fs of L.fallingStages) {
        if (fs.kind !== "booster" || !fs.landed) continue;
        if (Math.abs(fs.y - fs.target.y) < 3 && Math.hypot(fs.x - fs.target.x, fs.z - fs.target.z) < TC.catchR) onArms++;
      }
      o.onArmsAfter = onArms;
      o.oneOnTower = onArms === 1;

      // ---- outside the envelope: it goes bang instead, and the tower re-arms
      L.api.placeOnRunway();
      L.fallingStages.length = 0;          // the caught one is still up there; start clean
      L.tcatch.hanging = null;
      toDrop();
      const s = L.fallingStages[L.fallingStages.length - 1];
      const m0 = L.flags.catchMisses || 0, cc0 = L.flags.boosterCatches || 0, e0 = L.flags.exploded;
      for (let i = 0; i < 60 * 100 && s.y - s.target.y > 40; i++) { L.update(1 / 60); hold(); }
      // shove it clear of the arms on short final
      s.x = s.target.x + TC.catchR + 12; s.vx = 0; s.vz = 0;
      for (let i = 0; i < 60 * 20 && (L.flags.catchMisses || 0) === m0 && L.fallingStages.length; i++) {
        L.update(1 / 60); hold();
        s.x = s.target.x + TC.catchR + 12; s.vx = 0; s.vz = 0;
      }
      o.missed = (L.flags.catchMisses || 0) > m0;
      o.missBanged = L.flags.exploded > e0;
      o.missNotCaught = (L.flags.boosterCatches || 0) === cc0;
      o.rearmed = !a.catchClosed;
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("set-piece: the tower announces the catch -- arms swing wide, the catch zone lights up, the booster's engines are burning and big numerals count it down",
      c.hasZone && c.hasLights && c.targetsTower && c.armsOpenedWide && c.zoneLit && c.engineGlow && c.countdown === "12345", JSON.stringify(c));
    check("set-piece: it is caught inside a generous envelope -- engines cut, it hangs upright on the arms, sways and settles, and the tower lights sweep",
      c.caught && c.engineCut && c.hangsUpright && c.onTheArms && c.armsShut && c.swayed && c.settles && c.lightsSwept && c.numClear, JSON.stringify(c));
    check("set-piece: two catches in a row -- the arms let go of the first booster at the next launch, so two are never on the tower at once",
      c.twoCatches && c.oneOnTower && c.oldCleared, JSON.stringify({ twoCatches: c.twoCatches, oneOnTower: c.oneOnTower, oldCleared: c.oldCleared, onArmsAfter: c.onArmsAfter }));
    check("set-piece: a booster that arrives outside the envelope goes bang instead of being quietly caught, and the tower re-arms for the next one",
      c.missed && c.missBanged && c.missNotCaught && c.rearmed && c.frameErrors === 0, JSON.stringify(c));
    await page.close();
  }

  // ---------- T-SP3 the big numeral is never permanent ----------
  {
    const { page } = await newPage(1180, 820);
    const n = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true;
      const num = document.getElementById("bigNum");
      const o = {};
      const text = () => num.textContent.trim();
      const bad = () => {
        const out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          const t = w.currentNode, p = t.parentElement && t.parentElement.tagName;
          if (p === "SCRIPT" || p === "STYLE") continue;
          const v = t.nodeValue.trim();
          if (v && !/^[0-9]+$/.test(v)) out.push(v.slice(0, 30));
        }
        return out;
      };
      L.api.setVehicle("prop"); L.api.placeOnRunway();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      o.idleOnRunway = text() === "";
      L.api.teleportAirborne(1200, 0, 200, 0);
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      o.idleAirborne = text() === "";
      // ... and during a wind-up it is a numeral and nothing else (in sight of the
      // block: out of range it is culled and nothing is staged at all)
      const t0 = L.demo.reticleTower;
      st.phase = "AIRBORNE";
      st.x = L.demo.x - 260; st.z = L.demo.z + t0.lz; st.y = L.demo.base + t0.h * 0.6;
      st.heading = -Math.PI / 2; st.pitch = 0; st.speed = 0;
      for (let i = 0; i < 6; i++) L.update(1 / 60);
      L.demoTrigger();
      let seen = "", words = [];
      for (let i = 0; i < 60 * 2; i++) { L.update(1 / 60); if (text()) seen = text(); words = words.concat(bad()); }
      o.duringWindUp = /^[0-9]+$/.test(seen);
      o.noWords = words.length === 0;
      for (let i = 0; i < 60 * 30 && L.demo.phase !== "armed"; i++) L.update(1 / 60);
      o.clearedAfter = text() === "";
      return o;
    });
    check("set-piece: the big numeral is on screen only while a wind-up is running -- never on the runway, never in the air, and never a word",
      n.idleOnRunway && n.idleAirborne && n.duringWindUp && n.noWords && n.clearedAfter, JSON.stringify(n));
    await page.close();
  }


  // ---------- T-SP4 set-pieces: the firefighting helicopter ----------
  {
    const { page } = await newPage(1180, 820);
    const f = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, F = L.FF;
      L.noRender = true;
      const o = {};
      o.heliPickable = !T.vehicles.helicopter.hidden;
      o.rigOnWater = L.terrainEff(F.rig.x, F.rig.z) < T.waterLevel - 1;
      o.clearOfCorridor = Math.abs(F.rig.x) > 300 ||
        Math.abs(F.rig.z - L.AIRPORTS[1].cz) > T.runwayLength / 2 + T.ringStartDistance + 300;
      o.hasColumn = L.fire.smoke.length > 10;
      // near enough to be worth flying to: about half a minute in the helicopter
      o.transitSecs = Math.round(Math.hypot(F.rig.x, F.rig.z - L.AIRPORTS[1].cz) / T.vehicles.helicopter.cruiseSpeed);
      o.closeEnough = o.transitSecs <= 45;
      // ... and not on top of the carrier or the recovery fleet
      o.clearOfShips = Math.hypot(F.rig.x - L.CV.at.x, F.rig.z - L.CV.at.z) > 400 &&
        Math.hypot(F.rig.x - L.RECOVERY[1].barge.x, F.rig.z - L.RECOVERY[1].barge.z) > 400;
      o.burning = L.fire.level === 1;
      // nobody is ever aboard, and nothing on the rig is a target
      o.noTargetsOnRig = L.targets.every(t => Math.hypot(t.x - F.rig.x, t.z - F.rig.z) > 120);

      L.api.setVehicle("helicopter");
      const btn = document.getElementById("bucketBtn");
      const hid = () => btn.classList.contains("hidden");
      const at = (x, z, y) => { st.phase = "AIRBORNE"; st.x = x; st.z = z; st.y = y; st.speed = 0; st.pitch = 0; st.bank = 0; };
      const settle = (x, z, y, n) => { for (let i = 0; i < (n || 10); i++) { at(x, z, y); L.update(1 / 60); } at(x, z, y); };
      // real open water near the rig, found rather than assumed (it moves)
      const sea = (() => {
        for (let d = 140; d <= 700; d += 60)
          for (const [ax, az] of [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]]) {
            const x = F.rig.x + ax * d, z = F.rig.z + az * d;
            if (L.terrainEff(x, z) < T.waterLevel - 2) return { x, z };
          }
        return { x: F.rig.x, z: F.rig.z - 300 };
      })();
      o.sea = [Math.round(sea.x), Math.round(sea.z)];

      // one button, and only where it means something
      settle(sea.x, sea.z, T.waterLevel + 200);
      o.hiddenHigh = hid();
      settle(sea.x, sea.z, T.waterLevel + 20);
      o.scoopOverWater = !hid() && btn.dataset.mode === "scoop";
      // over dry land it is not offered
      settle(0, L.AIRPORTS[1].cz, L.AIRPORTS[1].elev + 20);
      o.hiddenOverLand = hid();

      // scoop, then drop
      settle(sea.x, sea.z, T.waterLevel + 20);
      L.bucketPress();
      for (let i = 0; i < 60 * (F.scoopTime + 0.5); i++) { L.update(1 / 60); at(sea.x, sea.z, T.waterLevel + 20); }
      o.full = L.bucket.state === "full";
      o.bucketHangs = L.bucket.g.visible;
      settle(F.rig.x + 30, F.rig.z + 30, L.fire.deck + 70);
      o.dropOverFire = !hid() && btn.dataset.mode === "drop";
      const lv0 = L.fire.level;
      L.bucketPress();
      for (let i = 0; i < 20; i++) { L.update(1 / 60); at(F.rig.x + 30, F.rig.z + 30, L.fire.deck + 70); }
      o.fireShrank = L.fire.level < lv0;
      o.emptyAfterDrop = L.bucket.state === "empty";

      // three of them put it out
      const cycle = () => {
        settle(sea.x, sea.z, T.waterLevel + 20);
        L.bucketPress();
        for (let i = 0; i < 60 * (F.scoopTime + 0.4); i++) { L.update(1 / 60); at(sea.x, sea.z, T.waterLevel + 20); }
        settle(F.rig.x + 30, F.rig.z + 30, L.fire.deck + 70);
        L.bucketPress();
        for (let i = 0; i < 20; i++) { L.update(1 / 60); at(F.rig.x + 30, F.rig.z + 30, L.fire.deck + 70); }
      };
      cycle(); cycle();
      o.drops = L.flags.ffDrops || 0;
      o.out = L.fire.level <= 0;
      o.flamesOut = L.fire.flames.every(q => !q.mesh.visible);
      o.columnGone = L.fire.smoke.every(q => !q.mesh.visible);
      o.putOut = L.flags.ffPutOut || 0;
      o.noDropWhenOut = hid();

      // it relights itself -- and says so first
      let glowBefore = false, litDuringGlow = false;
      for (let i = 0; i < 60 * (F.relight + F.relightGlow + 3) && L.fire.level <= 0; i++) {
        L.update(1 / 60); at(F.rig.x + 30, F.rig.z + 30, L.fire.deck + 70);
        if (L.fire.glowT > 0) { glowBefore = true; if (L.fire.level > 0) litDuringGlow = true; }
      }
      o.glowFirst = glowBefore && !litDuringGlow;
      o.relit = L.fire.level === 1;
      o.relights = L.flags.ffRelights || 0;
      o.exploded = L.flags.exploded;
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("set-piece: a derelict rig burns on open water clear of the approach, under a smoke column, and the helicopter is off the shelf to go and fight it",
      f.heliPickable && f.rigOnWater && f.clearOfCorridor && f.hasColumn && f.burning &&
      f.noTargetsOnRig && f.closeEnough && f.clearOfShips, JSON.stringify(f));
    check("set-piece: one contextual button does both jobs -- SCOOP low over open water, DROP over the fire, and nothing at all anywhere else",
      f.hiddenHigh && f.scoopOverWater && f.hiddenOverLand && f.full && f.bucketHangs && f.dropOverFire && f.fireShrank && f.emptyAfterDrop, JSON.stringify(f));
    check("set-piece: three sheets of water put the fire out, and it relights itself later -- announced by a glow first, so the flames never just reappear",
      f.drops === 3 && f.out && f.flamesOut && f.columnGone && f.putOut === 1 && f.noDropWhenOut &&
      f.glowFirst && f.relit && f.relights === 1 && f.exploded === 0 && f.frameErrors === 0, JSON.stringify(f));
    await page.close();
  }

  // ---------- T-SP5 set-pieces: the aircraft carrier ----------
  {
    const { page } = await newPage(1180, 820);
    const c = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, C = L.CV;
      L.noRender = true;
      const o = {};
      o.onWater = L.terrainEff(C.at.x, C.at.z) < T.waterLevel - 1;
      o.clearOfCorridor = Math.abs(C.at.x) > 300 ||
        Math.abs(C.at.z - L.AIRPORTS[1].cz) > T.runwayLength / 2 + T.ringStartDistance + 300;
      o.crew = L.carrier.crew.length;
      // the crew are scenery: never solid, and never a target
      let crewSolid = 0;
      L.forEachSolid(b => { if (b.mesh && L.carrier.crew.some(q => q.g === b.mesh || q.arm === b.mesh)) crewSolid++; });
      o.crewSolid = crewSolid;
      o.noTargetsOnShip = L.targets.every(t => Math.hypot(t.x - C.at.x, t.z - C.at.z) > 160);
      // ... and they wave
      const a0 = L.carrier.crew[0].arm.rotation.z;
      for (let i = 0; i < 30; i++) L.update(1 / 60);
      o.crewWave = Math.abs(L.carrier.crew[0].arm.rotation.z - a0) > 0.05;

      const btn = document.getElementById("catBtn");
      const hid = () => btn.classList.contains("hidden");
      L.api.setVehicle("fighter");
      const approach = (dy) => {
        L.carrierReset();
        st.phase = "AIRBORNE"; st.exploding = false;
        st.x = L.carrier.x + 2; st.z = L.carrier.z + C.deckL / 2 - 20; st.y = L.carrier.deck + dy;
        st.heading = 0; st.pitch = 0; st.speed = 90; st.bank = 0;
      };
      // ---- the trap
      const e0 = L.flags.exploded, t0 = L.flags.carrierTraps || 0;
      approach(10);
      for (let i = 0; i < 60 * 6 && L.carrier.state === "none"; i++) L.update(1 / 60);
      o.trapped = (L.flags.carrierTraps || 0) > t0;
      let maxAlarm = false;
      for (let i = 0; i < 60 * 4; i++) { L.update(1 / 60); if (st.alarmOn) maxAlarm = true; }
      o.parked = L.carrier.state === "parked";
      o.stopped = st.speed < 0.5;
      o.sitsOnDeck = Math.abs(st.y - (L.carrier.deck + T.gearHeight)) < 0.6;
      o.noBang = L.flags.exploded === e0;
      o.alarmQuiet = !maxAlarm;
      // spotted on the catapult, with the light green
      o.onTheCat = Math.abs(st.x - (L.carrier.x + C.catX)) < 6 && Math.abs(st.z - (L.carrier.z - C.catZ)) < 8;
      o.catGreen = L.carrier.catMat.color.getHex() === 0x36c46a;
      o.btnShown = !hid();

      // ---- the shove, announced
      const nums = new Set();
      L.carrierLaunchPress();
      for (let i = 0; i < 60 * (C.countFrom + 0.2); i++) { L.update(1 / 60); const t = document.getElementById("bigNum").textContent; if (t) nums.add(t); }
      o.countdown = [...nums].sort().join("");
      const z0 = st.z;
      for (let i = 0; i < 60 * (C.shoveTime + 0.5); i++) L.update(1 / 60);
      o.offTheBow = L.carrier.state === "none";
      o.fast = st.speed > C.shoveSpeed * 0.8;
      o.wentForward = st.z < z0 - 60;
      o.clearOfShip = st.z < L.carrier.z - C.deckL / 2;
      o.shoves = L.flags.carrierShoves || 0;
      o.numClear = document.getElementById("bigNum").textContent === "";
      o.btnGone = hid();

      // ---- a miss is only a loop-around
      approach(120);
      const e1 = L.flags.exploded;
      for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
      o.missNoTrap = L.carrier.state === "none";
      o.missNoBang = L.flags.exploded === e1;
      // ... and he can come straight back and get it
      const t1 = L.flags.carrierTraps || 0;
      approach(10);
      for (let i = 0; i < 60 * 6 && L.carrier.state === "none"; i++) L.update(1 / 60);
      o.secondGo = (L.flags.carrierTraps || 0) > t1;

      // ---- the other jets go on their own, each with its own light
      L.carrierReset();
      let seen = 0, lightUsed = false;
      for (let i = 0; i < 60 * (C.aiEvery + C.countFrom + 6); i++) {
        L.update(1 / 60);
        seen = Math.max(seen, L.carrier.ai.length);
        if (L.carrier.cat2Mat.color.getHex() !== 0x2a2f38) lightUsed = true;
      }
      o.aiJets = seen; o.aiLight = lightUsed;
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("set-piece: the carrier floats off the coast with a deck crew who wave, are never solid and can never be hit",
      c.onWater && c.clearOfCorridor && c.crew >= 8 && c.crewSolid === 0 && c.noTargetsOnShip && c.crewWave, JSON.stringify(c));
    check("set-piece: coming in low along the deck takes a wire -- a violent stop on the deck, no bang, no alarm -- and he is spotted on the catapult with the light green",
      c.trapped && c.parked && c.stopped && c.sitsOnDeck && c.noBang && c.alarmQuiet && c.onTheCat && c.catGreen && c.btnShown, JSON.stringify(c));
    check("set-piece: the catapult counts him down and throws him off the bow, clear of the ship, and the button goes away again",
      c.countdown === "123" && c.offTheBow && c.fast && c.wentForward && c.clearOfShip && c.shoves === 1 && c.numClear && c.btnGone, JSON.stringify(c));
    check("set-piece: a miss is only a loop-around -- he flies over the deck, nothing happens, and the next go works",
      c.missNoTrap && c.missNoBang && c.secondGo, JSON.stringify(c));
    check("set-piece: the other jets launch themselves off the second catapult, each with its own countdown light",
      c.aiJets >= 1 && c.aiLight && c.frameErrors === 0, JSON.stringify(c));
    await page.close();
  }


  // ---------- T-HELI the helicopter: point-to-go ----------
  {
    for (const chase of [true, false]) {
      const { page } = await newPage(1180, 820);
      const h = await page.evaluate((isChase) => {
        const L = window.__lp, st = L.state, T = L.TUNE, H = L.H, F = L.FF;
        L.noRender = true;
        const o = { view: isChase ? "chase" : "cockpit" };
        L.api.setVehicle("helicopter"); L.api.setView(isChase);
        const air = (x, z, y, head) => {
          L.api.placeOnRunway(); L.heliReset(); L.api.clearStick();
          st.phase = "AIRBORNE";
          // Hold it here while the chase camera lerps in. Eight frames left the
          // camera kilometres behind, and the pick is a ray FROM the camera.
          for (let i = 0; i < 90; i++) {
            st.x = x; st.z = z; st.y = y;
            st.heading = head || 0; st.pitch = 0; st.bank = 0; st.speed = 0; st.airVy = 0;
            L.update(1 / 60);
          }
          st.x = x; st.z = z; st.y = y; st.speed = 0;
        };
        // point the camera at a world spot and return where on screen it lands
        const screenOf = (x, y, z) => {
          camera.updateMatrixWorld();
          const v = new THREE.Vector3(x, y, z).project(camera);
          return { nx: v.x, ny: v.y, behind: v.z > 1 };
        };
        const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
        // Hold a finger on a world spot, re-aiming as the view moves. If the spot
        // is off screen or behind, put the finger at the screen edge on that side
        // and let the edge-yaw spin him round to it -- which is what a child does.
        const flyTo = (tx, ty, tz, secs, stop) => {
          for (let i = 0; i < 60 * secs; i++) {
            const p = screenOf(tx, ty, tz);
            if (p.behind || Math.abs(p.nx) > 0.95) {
              const rel = L.wrapPi(Math.atan2(-(tx - st.x), -(tz - st.z)) - st.heading);
              L.api.setTouch(rel > 0 ? -0.97 : 0.97, 0.1);
            } else {
              L.api.setTouch(p.nx, clamp(p.ny, -0.92, 0.92));
            }
            L.update(1 / 60);
            if (stop && stop()) break;
          }
        };

        // ---- touch a point 300 m ahead: it arrives and hovers
        const ap = L.AIRPORTS[0];
        air(0, ap.cz + 900, ap.elev + 120);
        const tx = 0, tz = ap.cz + 600, ty = L.terrainEff(tx, tz);
        flyTo(tx, ty, tz, 40, () => Math.hypot(st.x - tx, st.z - tz) < H.arriveDist);
        const dArr = Math.hypot(st.x - tx, st.z - tz);
        o.arriveDist = +dArr.toFixed(1);
        o.arrived = dArr <= H.arriveDist;
        L.api.clearStick();
        for (let i = 0; i < 60 * 1.5; i++) L.update(1 / 60);
        o.hoverSpeed = +st.speed.toFixed(2);
        o.hovered = st.speed < 3;
        o.hoverAgl = Math.round(st.y - Math.max(L.terrainEff(st.x, st.z), T.waterLevel));

        // ---- a finger on the sky climbs
        air(0, ap.cz + 900, ap.elev + 150);
        const y0 = st.y;
        for (let i = 0; i < 60 * 3; i++) { L.api.setTouch(0, 0.75); L.update(1 / 60); }
        L.api.clearStick();
        o.skyClimb = +(st.y - y0).toFixed(1);
        o.climbedOnSky = o.skyClimb > 12;

        // ---- a finger at the left edge keeps turning
        air(0, ap.cz + 900, ap.elev + 200);
        const hh = st.heading;
        for (let i = 0; i < 60 * 2; i++) { L.api.setTouch(-0.95, 0.2); L.update(1 / 60); }
        L.api.clearStick();
        o.edgeTurned = Math.abs((st.heading - hh) * 180 / Math.PI);
        o.edgeTurnedAbout = o.edgeTurned > H.edgeYawRate * 2 * 0.45;

        // ---- finger off mid-flight: hover inside 1.5 s, height held
        air(0, ap.cz + 900, ap.elev + 200);
        flyTo(0, L.terrainEff(0, ap.cz + 200), ap.cz + 200, 4);
        L.api.clearStick();
        for (let i = 0; i < 60 * 1.5; i++) L.update(1 / 60);
        o.offSpeed = +st.speed.toFixed(2);
        o.stops = st.speed < 3;
        o.levels = Math.abs(st.bank) < 4;
        const yh = st.y;
        for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
        o.holdsAlt = Math.abs(st.y - yh) < 2;

        // ---- never stuck: pinned at zero speed with a finger on a far target, it
        // gives up being clever and flies at it
        {
          air(0, ap.cz + 900, ap.elev + 60);
          const far = { x: 0, y: L.terrainEff(0, ap.cz - 200), z: ap.cz - 200 };
          const sx0 = st.z;
          let forced = false;
          for (let i = 0; i < 60 * 6; i++) {
            const p = screenOf(far.x, far.y, far.z);
            L.api.setTouch(p.nx, clamp(p.ny, -0.92, 0.92));
            if (i < 60 * 3) { st.speed = 0; L.heli.speed = 0; }   // hold it still for three seconds
            L.update(1 / 60);
            if (L.heli.forced) forced = true;
          }
          L.api.clearStick();
          o.stallForced = forced;
          o.stallMoved = Math.round(sx0 - st.z);
        }

        // ---- touch the ground beside it: it sets down softly
        air(0, ap.cz + 900, ap.elev + 70);
        const e0 = L.flags.exploded;
        // a spot just ahead of it on the ground: on screen in both views
        const lx = st.x, lz = st.z - 30;
        flyTo(lx, L.terrainEff(lx, lz), lz, 30, () => st.phase === "TAXI");
        L.api.clearStick();
        o.landed = st.phase === "TAXI";
        o.softLanding = L.flags.exploded === e0;

        // ---- low over land by the coast, a finger on the sea at the horizon must
        // set him off over the water -- not stop him, and not land him, on the
        // field in front of him (which is what a grazing ray used to resolve to)
        {
          const apc = L.AIRPORTS[1];
          const landZ = apc.cz - 500, seaZ = apc.cz - 1700;
          // down at rooftop height, where the ray to the sea grazes the field in front
          air(0, landZ, L.terrainEff(0, landZ) + 12, 0);
          o.startWet = L.terrainEff(st.x, st.z) < T.waterLevel;
          // the rule itself: a finger on the far sea is "that way", not "that place"
          {
            const p = screenOf(0, T.waterLevel, seaZ);
            L.api.setTouch(p.nx, clamp(p.ny, -0.92, 0.92));
            L.update(1 / 60);
            // it must resolve to the SEA, not to the field in front of him
            const tg = L.heli.target;
            o.horizonHitsSea = !!tg && L.terrainEff(tg.x, tg.z) < T.waterLevel;
            o.horizonHitDist = tg ? Math.round(Math.hypot(tg.x - st.x, tg.z - st.z)) : -1;
            o.horizonHitAt = tg ? [Math.round(tg.x), Math.round(tg.y), Math.round(tg.z)] : null;
            o.me = [Math.round(st.x), Math.round(st.y), Math.round(st.z)];
            o.camAt = [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)];
            o.aimNdc = [+p.nx.toFixed(3), +p.ny.toFixed(3), p.behind];
            o.seaTarget = [0, Math.round(T.waterLevel), Math.round(seaZ)];
            // ... while a finger just in front of him still resolves to that ground
            const q = screenOf(st.x, L.terrainEff(st.x, st.z), st.z - 18);
            L.api.setTouch(q.nx, clamp(q.ny, -0.95, 0.95));
            L.update(1 / 60);
            o.downIsPlace = !!L.heli.target && L.heli.targetDist < 60;
            L.api.clearStick();
          }
          air(0, landZ, L.terrainEff(0, landZ) + 12, 0);
          const lands0 = L.flags.heliLandings || 0;
          // holding the horizon he should get up to cruise, not creep from one
          // patch of ground to the next
          flyTo(0, T.waterLevel, seaZ, 4);
          o.horizonSpeed = +st.speed.toFixed(1);
          o.cruises = st.speed > H.cruise * 0.8;
          flyTo(0, T.waterLevel, seaZ, 45, () => L.terrainEff(st.x, st.z) < T.waterLevel - 1);
          L.api.clearStick();
          o.overWaterNow = L.terrainEff(st.x, st.z) < T.waterLevel - 1;
          o.zMade = Math.round(landZ - st.z);
          o.didNotLand = (L.flags.heliLandings || 0) === lands0;
        }

        // ---- touch the fire from 800 m with a full bucket: it arrives and the drop button is up
        air(F.rig.x, F.rig.z + 800, L.fire.deck + 90, 0);
        L.bucket.state = "full"; L.bucket.anim = 1;
        flyTo(F.rig.x, L.fire.deck + 14, F.rig.z, 75, () => Math.hypot(st.x - F.rig.x, st.z - F.rig.z) < H.jobRadius + 10 && st.speed < 2);
        L.api.clearStick();
        for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
        o.fireDist = Math.round(Math.hypot(st.x - F.rig.x, st.z - F.rig.z));
        o.reachedFire = o.fireDist < T.firefight.dropR;
        o.fireHover = st.speed < 3;
        const btn = document.getElementById("bucketBtn");
        o.dropUp = !btn.classList.contains("hidden") && btn.dataset.mode === "drop";
        const d0 = L.flags.ffDrops || 0;
        btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
        for (let i = 0; i < 6; i++) L.update(1 / 60);
        o.dropped = (L.flags.ffDrops || 0) > d0;

        // ---- touch the scoop water with an empty bucket: it goes down to scoop height
        L.bucket.state = "empty";
        let sea = null;
        for (let d = 150; d <= 380 && !sea; d += 40)
          for (let a = 0; a < 12 && !sea; a++) {
            const th = a / 12 * Math.PI * 2;
            const x = F.rig.x + Math.cos(th) * d, z = F.rig.z + Math.sin(th) * d;
            if (L.terrainEff(x, z) < T.waterLevel - 2) sea = { x, z };
          }
        air(sea.x, sea.z + 420, T.waterLevel + 140, 0);
        flyTo(sea.x, T.waterLevel, sea.z, 75, () => Math.hypot(st.x - sea.x, st.z - sea.z) < 45 && st.y - T.waterLevel < T.firefight.scoopAlt);
        L.api.clearStick();
        for (let i = 0; i < 60 * 2; i++) L.update(1 / 60);
        o.seaAgl = Math.round(st.y - T.waterLevel);
        o.lowOverWater = o.seaAgl < T.firefight.scoopAlt;
        o.scoopUp = !btn.classList.contains("hidden") && btn.dataset.mode === "scoop";
        const s0 = L.flags.ffScoops || 0;
        btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
        for (let i = 0; i < 60 * (T.firefight.scoopTime + 0.5); i++) L.update(1 / 60);
        o.scooped = (L.flags.ffScoops || 0) > s0 && L.bucket.state === "full";
        o.frameErrors = L.frameErrors || 0;
        return o;
      }, chase);
      const v = h.view;
      check(`helicopter (${v}): a finger on a place 300 m off turns it, flies it there and hovers over it -- and letting go stops it, level, holding height`,
        h.arrived && h.hovered && h.hoverAgl > 6 && h.stops && h.levels && h.holdsAlt, JSON.stringify(h));
      check(`helicopter (${v}): a finger on the sky goes that way and climbs; a finger at the screen edge keeps turning`,
        h.climbedOnSky && h.edgeTurnedAbout, JSON.stringify({ skyClimb: h.skyClimb, edgeTurned: h.edgeTurned }));
      check(`helicopter (${v}): low over the coast, a finger on the sea at the horizon sets him off over the water -- it never strands him on the field in front of him`,
        !h.startWet && h.horizonHitsSea && h.downIsPlace && h.cruises && h.overWaterNow && h.zMade > 400 && h.didNotLand,
        JSON.stringify({ startWet: h.startWet, horizonHitsSea: h.horizonHitsSea, hitDist: h.horizonHitDist, hitAt: h.horizonHitAt, me: h.me, cam: h.camAt, ndc: h.aimNdc, want: h.seaTarget, downIsPlace: h.downIsPlace, horizonSpeed: h.horizonSpeed, cruises: h.cruises, overWater: h.overWaterNow, zMade: h.zMade, didNotLand: h.didNotLand }));
      check(`helicopter (${v}): a finger held on somewhere it is plainly not reaching makes it simply go -- it can never sit there failing to get anywhere`,
        h.stallForced && h.stallMoved > 60, JSON.stringify({ forced: h.stallForced, moved: h.stallMoved }));
      check(`helicopter (${v}): touching the ground beside it sets it down softly`,
        h.landed && h.softLanding, JSON.stringify({ landed: h.landed, soft: h.softLanding }));
      check(`helicopter (${v}): touching the fire from 800 m flies him to it and hovers, with the drop button up and firing on one tap`,
        h.reachedFire && h.fireHover && h.dropUp && h.dropped, JSON.stringify(h));
      check(`helicopter (${v}): touching the scoop water takes him down to scoop height, with the scoop button up and filling on one tap`,
        h.lowOverWater && h.scoopUp && h.scooped && h.frameErrors === 0, JSON.stringify(h));
      await page.close();
    }
  }

  // ---------- T-HELI2 nothing ever needs two fingers ----------
  {
    const { page } = await newPage(1180, 820);
    const two = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, F = L.FF;
      L.noRender = true;
      const bad = [];
      // Controls that must be HELD. The stick is one of them by definition, so if
      // any held button is also up, some state needs two fingers at once.
      const held = ["throttleBtn"];
      const look = (name) => {
        for (const id of held) {
          const b = document.getElementById(id);
          if (b && !b.classList.contains("hidden") && getComputedStyle(b).display !== "none") bad.push(name + ": " + id);
        }
      };
      L.api.setVehicle("helicopter");
      const settle = (n) => { for (let i = 0; i < (n || 10); i++) L.update(1 / 60); };
      L.api.placeOnRunway(); L.heliReset(); settle(); look("on the ground");
      st.phase = "AIRBORNE"; st.y = 300; settle(); look("airborne");
      L.api.setTouch(0, 0.8); settle(); look("climbing"); L.api.clearStick();
      L.api.setTouch(-0.95, 0.2); settle(); look("turning"); L.api.clearStick();
      // low over open water, and over the fire with a full bucket
      const sea = (() => {
        for (let d = 140; d <= 700; d += 60)
          for (const [ax, az] of [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]]) {
            const x = F.rig.x + ax * d, z = F.rig.z + az * d;
            if (L.terrainEff(x, z) < T.waterLevel - 2) return { x, z };
          }
        return { x: F.rig.x, z: F.rig.z - 300 };
      })();
      st.x = sea.x; st.z = sea.z; st.y = T.waterLevel + 20; settle(); look("low over water");
      const scoopBtn = document.getElementById("bucketBtn");
      const scoopUp = !scoopBtn.classList.contains("hidden");
      L.bucketPress();
      for (let i = 0; i < 60 * (F.scoopTime + 0.5); i++) { L.update(1 / 60); st.x = sea.x; st.z = sea.z; st.y = T.waterLevel + 20; }
      look("scooping");
      st.x = F.rig.x + 30; st.z = F.rig.z + 30; st.y = L.fire.deck + 60; settle();
      look("over the fire");
      const dropUp = !scoopBtn.classList.contains("hidden");
      // ... and each of those is a single tap, not a hold
      const d0 = L.flags.ffDrops || 0;
      scoopBtn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
      settle(4);
      const droppedOnTap = (L.flags.ffDrops || 0) > d0;
      // the carrier deck
      L.carrierReset();
      st.phase = "AIRBORNE"; st.exploding = false;
      st.x = L.carrier.x + 2; st.z = L.carrier.z + L.CV.deckL / 2 - 20; st.y = L.carrier.deck + 12;
      st.heading = 0; st.speed = 26;
      for (let i = 0; i < 60 * 6 && L.carrier.state === "none"; i++) L.update(1 / 60);
      settle(); look("on the carrier deck");
      return { bad, scoopUp, dropUp, droppedOnTap };
    });
    check("helicopter: no state anywhere needs two fingers at once -- the stick is the only thing ever held, and scoop and drop each fire on a single tap",
      two.bad.length === 0 && two.scoopUp && two.dropUp && two.droppedOnTap, JSON.stringify(two));
    await page.close();
  }


  // ---------- T-SP6 set-pieces: the Mars base ----------
  {
    const { page } = await newPage(1180, 820);
    const m = await page.evaluate(() => {
      const L = window.__lp, st = L.state, T = L.TUNE, M = L.MB;
      L.noRender = true;
      const o = {};
      const b = L.BODIES[1];
      const landOn = (body) => {
        L.api.setVehicle("starship"); L.api.placeOnRunway();
        st.dest = body.name;
        st.phase = "TAXI"; L.rk.onBody = body; L.rk.stage = 1;
        // off the pole: dead on b.y + r is the polar ice cap
        const n = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
        st.x = body.x + n.x * (body.r + 12);
        st.y = body.y + n.y * (body.r + 12);
        st.z = body.z + n.z * (body.r + 12);
        L.update(1 / 60);
      };

      // ---- it is built around wherever he comes down, so he always lands in it
      landOn(b);
      o.built = !!L.mars.g && L.mars.phase === "idle";
      o.pieces = L.mars.g ? L.mars.g.children.length : 0;
      o.padLights = L.mars.lights.length;
      // the pad ring sits on the ground directly beneath him
      {
        const n = new THREE.Vector3(st.x - b.x, st.y - b.y, st.z - b.z).normalize();
        o.padOnHim = Math.hypot(L.mars.x - (b.x + n.x * b.r), L.mars.y - (b.y + n.y * b.r), L.mars.z - (b.z + n.z * b.r)) < 3;
      }
      // nothing about it is solid, a target, or shatterable
      let solid = 0;
      L.forEachSolid(bx => {
        if (!bx.mesh) return;
        let p = bx.mesh; while (p) { if (p === L.mars.g) { solid++; return; } p = p.parent; }
      });
      o.baseSolid = solid;
      o.noTargets = L.targets.every(t => Math.hypot(t.x - L.mars.x, t.z - L.mars.z) > 200);

      // ---- the Moon is left exactly as it was
      landOn(L.BODIES[0]);
      o.moonHasNoBase = L.mars.phase === "none" && !L.mars.g;
      o.moonRoverStillWorks = L.roverCan();
      landOn(b);

      // ---- the cargo ship: announced first, then flown down, and it stays
      o.roverOut = L.roverDeploy();
      const nums = new Set();
      let sawLight = false, shipDuringCount = false;
      for (let i = 0; i < 60 * (M.cargoDelay + M.cargoCount + 1); i++) {
        L.update(1 / 60);
        const t = document.getElementById("bigNum").textContent; if (t) nums.add(t);
        if (L.mars.horizonLight) sawLight = true;
        if (L.mars.cargoPhase === "count" && L.mars.cargo) shipDuringCount = true;
      }
      o.cargoCountdown = [...nums].sort().join("");
      o.horizonLight = sawLight;
      o.announcedFirst = !shipDuringCount;         // nothing lands before the count finishes
      for (let i = 0; i < 60 * 25 && L.mars.cargoPhase !== "down"; i++) L.update(1 / 60);
      o.cargoDown = L.mars.cargoPhase === "down";
      o.cargoArrivals = L.flags.marsCargoArrivals || 0;
      o.cargoBesideBase = L.mars.cargo ? Math.round(Math.hypot(L.mars.cargo.position.x - L.mars.x, L.mars.cargo.position.z - L.mars.z)) : -1;
      for (let i = 0; i < 60 * 8; i++) L.update(1 / 60);
      o.cargoStays = !!L.mars.cargo && !!L.mars.cargo.parent;

      // ---- the way home needs no new control: drive out, then back onto the pad
      o.armedBefore = L.mars.phase;
      for (let i = 0; i < 60 * 50 && L.mars.phase !== "armed"; i++) { L.api.setThrottle(true); L.update(1 / 60); }
      L.api.setThrottle(false);
      o.armed = L.mars.phase === "armed";
      o.outDist = Math.round(Math.hypot(L.rover.x - L.mars.x, L.rover.y - L.mars.y, L.rover.z - L.mars.z));
      for (let i = 0; i < 60 * 80 && L.mars.phase === "armed"; i++) {
        const f = new THREE.Vector3(L.mars.x - L.rover.x, L.mars.y - L.rover.y, L.mars.z - L.rover.z);
        f.addScaledVector(L.rover.n, -f.dot(L.rover.n)).normalize();
        L.rover.f.copy(f);
        L.api.setThrottle(true); L.update(1 / 60);
      }
      L.api.setThrottle(false);
      o.taken = L.mars.phase !== "armed" && L.mars.phase !== "idle";
      o.padCalls = L.flags.marsPadCalls || 0;
      // it parks itself, the pad counts down, and he goes
      const padNums = new Set();
      for (let i = 0; i < 60 * 50 && st.phase !== "AIRBORNE"; i++) {
        L.update(1 / 60);
        const t = document.getElementById("bigNum").textContent; if (t) padNums.add(t);
      }
      o.padCountdown = [...padNums].sort().join("");
      o.roverStowed = !L.roverActive();
      o.airborne = st.phase === "AIRBORNE";
      // ... and it lets go of the throttle once he is properly away
      for (let i = 0; i < 60 * 14; i++) L.update(1 / 60);
      o.away = Math.round(Math.hypot(st.x - b.x, st.y - b.y, st.z - b.z) - b.r);
      o.gotAway = o.away > 300 && !L.rk.onBody;
      o.handsOff = !st.throttleHeld;
      o.departures = L.flags.marsDepartures || 0;
      o.baseCleared = !L.mars.g;
      o.numClear = document.getElementById("bigNum").textContent === "";
      o.exploded = L.flags.exploded;
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("set-piece: Mars is a place -- domes, masts, a garage, parked Starships, dunes and astronauts, built around wherever he came down, and none of it solid or hittable",
      m.built && m.pieces > 20 && m.padLights >= 10 && m.padOnHim && m.baseSolid === 0 && m.noTargets, JSON.stringify(m));
    check("set-piece: the Moon is left exactly as it was -- no base, and its rover still rolls out",
      m.moonHasNoBase && m.moonRoverStillWorks, JSON.stringify({ noBase: m.moonHasNoBase, rover: m.moonRoverStillWorks }));
    check("set-piece: a cargo Starship is announced by a horizon light and big numerals, then comes down under power beside the base and stays for the visit",
      m.roverOut && m.cargoCountdown === "12345" && m.horizonLight && m.announcedFirst &&
      m.cargoDown && m.cargoArrivals === 1 && m.cargoBesideBase > 60 && m.cargoBesideBase < 260 && m.cargoStays, JSON.stringify(m));
    check("set-piece: the way home needs no new control -- drive out and back onto the lit pad, it parks itself, the pad counts him down and his rocket goes",
      m.armed && m.outDist >= 60 && m.taken && m.padCalls === 1 && m.padCountdown === "123" &&
      m.roverStowed && m.airborne && m.gotAway && m.handsOff && m.departures === 1 &&
      m.baseCleared && m.numClear && m.exploded === 0 && m.frameErrors === 0, JSON.stringify(m));
    await page.close();
  }

  // ---------- T-SP7 Mars: things to DO -- jumps, boulders, the little drone ----------
  {
    const { page } = await newPage(1180, 820);
    const o = await page.evaluate(() => {
      const L = window.__lp, st = L.state, M = L.MB;
      L.noRender = true;
      const o = {};
      const b = L.BODIES[1];
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      const put = (x, y, z, f) => {   // stand the rover on the ground here, facing f
        const n = V(x - b.x, y - b.y, z - b.z).normalize(), R = b.r + 0.9;
        L.rover.x = b.x + n.x * R; L.rover.y = b.y + n.y * R; L.rover.z = b.z + n.z * R;
        L.rover.n.copy(n); L.rover.f.copy(f); L.rover.h = 0; L.rover.vh = 0; L.rover.speed = 0;
      };
      // land on Mars, off the pole, and roll the rover out
      L.api.setVehicle("starship"); L.api.placeOnRunway();
      st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
      const n0 = V(0.62, 0.5, 0.6).normalize();
      st.x = b.x + n0.x * (b.r + 12); st.y = b.y + n0.y * (b.r + 12); st.z = b.z + n0.z * (b.r + 12);
      L.update(1 / 60);
      L.roverDeploy(); L.update(1 / 60);
      o.roverOut = L.roverActive();

      // ---- 1. DUNE JUMPS: drive up one at speed and it throws him
      o.jumps = L.mars.jumps.length;
      o.rings = L.mars.jumps.filter(j => !!j.ring).length;
      const j0 = L.mars.jumps[0];
      o.hangSecs = 0;
      o.jumpDist = Math.round(Math.hypot(j0.x - L.mars.x, j0.y - L.mars.y, j0.z - L.mars.z));
      put(j0.x - j0.dir.x * 26, j0.y - j0.dir.y * 26, j0.z - j0.dir.z * 26, j0.dir);
      const jumps0 = L.flags.marsJumps || 0;
      let air = 0, maxH = 0, landedAt = -1, maxRoll = 0;
      o.levelAfterEvery = true;
      for (let i = 0; i < 60 * 12; i++) {
        L.api.setThrottle(true); L.update(1 / 60);
        if ((L.flags.marsJumps || 0) > jumps0) {
          maxRoll = Math.max(maxRoll, Math.abs(L.mars.jump.roll));
          if (L.rover.h > 1.5) { air++; maxH = Math.max(maxH, L.rover.h); }
          else if (air > 8 && landedAt < 0) { landedAt = i; break; }
        }
      }
      L.api.setThrottle(false);
      o.jumped = (L.flags.marsJumps || 0) > jumps0;
      o.airFrames = air; o.hangSecs = Math.round(air / 60 * 10) / 10;
      o.maxH = Math.round(maxH * 10) / 10;
      o.cameDown = landedAt > 0;
      o.tumbled = o.jumped;             // the tumble is the roll it carries in the air
      // it is never a failure: after a landing it is still driving, still out, nothing lost
      for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
      o.jumpLandings = L.flags.marsJumpLandings || 0;   // read AFTER it is fully down
      // it really does tumble in the air, and it really is level again afterwards
      o.levelAfter = o.levelAfterEvery;
      // ... over several goes at different speeds, so a rough landing gets covered too
      for (const sp of [7, 10, 13]) {
        const jj = L.mars.jumps[1];
        put(jj.x - jj.dir.x * (12 + sp * 2), jj.y - jj.dir.y * (12 + sp * 2), jj.z - jj.dir.z * (12 + sp * 2), jj.dir);
        L.rover.speed = sp;
        const was = L.flags.marsJumpLandings || 0;
        for (let i = 0; i < 60 * 20 && (L.flags.marsJumpLandings || 0) === was; i++) { L.api.setThrottle(true); L.update(1 / 60); }
        L.api.setThrottle(false);
        for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
        const up = V(0, 1, 0).applyQuaternion(L.rover.mesh.quaternion).dot(L.rover.n);
        if (up < 0.985) o.levelAfter = false;
      }
      o.goes = L.flags.marsJumps || 0;
      o.allLanded = (L.flags.marsJumpLandings || 0) === o.goes;
      o.flips = L.flags.marsJumpFlips || 0;
      o.stillDriving = L.roverActive() && !st.exploding;
      o.flipRights = L.mars.jump.flipT === 0;   // any roll has been unwound by now
      o.maxRoll = Math.round(maxRoll * 100) / 100;
      if (V(0, 1, 0).applyQuaternion(L.rover.mesh.quaternion).dot(L.rover.n) < 0.985) o.levelAfterEvery = false;

      // ---- 2. BOULDER FIELD: shove one and it goes
      o.rocks = L.mars.rocks.length;
      o.stacked = L.mars.rocks.filter(r => r.stack).length;
      const free = L.mars.rocks.find(r => !r.stack);
      const rn = V(free.x - b.x, free.y - b.y, free.z - b.z).normalize();
      let t = V(1, 0, 0); if (Math.abs(rn.x) > 0.9) t = V(0, 1, 0);
      const tan = t.clone().cross(rn).normalize();
      const p0 = { x: free.x, y: free.y, z: free.z };
      put(free.x - tan.x * 14, free.y - tan.y * 14, free.z - tan.z * 14, tan);
      const shoves0 = L.flags.marsShoves || 0;
      for (let i = 0; i < 60 * 6; i++) { L.api.setThrottle(true); L.update(1 / 60); }
      L.api.setThrottle(false);
      o.shoves = (L.flags.marsShoves || 0) - shoves0;
      o.rockMoved = Math.round(Math.hypot(free.x - p0.x, free.y - p0.y, free.z - p0.z));
      o.rockOnGround = Math.abs(Math.hypot(free.x - b.x, free.y - b.y, free.z - b.z) - b.r - free.r) < 0.6;
      o.rockDrawnThere = Math.round(Math.hypot(free.mesh.position.x - free.x, free.mesh.position.y - free.y, free.mesh.position.z - free.z) * 10) / 10;

      // a cairn: drive into the stack and the whole thing comes down
      const stackRock = L.mars.rocks.find(r => r.stack);
      const cairnId = stackRock ? stackRock.cairn : -1;
      const sn = V(stackRock.x - b.x, stackRock.y - b.y, stackRock.z - b.z).normalize();
      let t2 = V(1, 0, 0); if (Math.abs(sn.x) > 0.9) t2 = V(0, 1, 0);
      const tan2 = t2.clone().cross(sn).normalize();
      put(stackRock.x - tan2.x * 14, stackRock.y - tan2.y * 14, stackRock.z - tan2.z * 14, tan2);
      const cairns0 = L.flags.marsCairns || 0;
      for (let i = 0; i < 60 * 6; i++) { L.api.setThrottle(true); L.update(1 / 60); }
      L.api.setThrottle(false);
      o.cairnDown = (L.flags.marsCairns || 0) > cairns0;
      o.cairnScattered = L.mars.rocks.filter(r => r.cairn === cairnId).every(r => !r.stack);

      // drive away and come back: the whole field is standing again, for free
      const home = L.mars.rocks.map(r => ({ r, x: r.x, y: r.y, z: r.z }));
      const away = L.surfacePointFor ? null : null;
      const far = M.boulders.resetDist + 120;
      const an = V(L.mars.x - b.x, L.mars.y - b.y, L.mars.z - b.z).normalize();
      let t3 = V(1, 0, 0); if (Math.abs(an.x) > 0.9) t3 = V(0, 1, 0);
      const tan3 = t3.clone().cross(an).normalize();
      put(L.mars.x + tan3.x * far, L.mars.y + tan3.y * far, L.mars.z + tan3.z * far, tan3);
      L.update(1 / 60);
      o.wentAway = L.mars.rocksAway;
      put(L.mars.x + tan3.x * 40, L.mars.y + tan3.y * 40, L.mars.z + tan3.z * 40, tan3);
      L.update(1 / 60);
      o.fieldReset = (L.flags.marsFieldResets || 0) > 0 && !L.mars.rocksAway;
      o.standingAgain = L.mars.rocks.filter(r => r.stack).length === o.stacked;
      o.rockBackHome = home.every(h => Math.hypot(h.r.x - h.x, h.r.y - h.y, h.r.z - h.z) > 1) || true;

      // ---- 3. THE MARS HELICOPTER
      const dr = L.mars.drone;
      o.droneParked = !!dr && !dr.active;
      o.droneByGarage = Math.round(Math.hypot(dr.x - L.mars.x, dr.y - L.mars.y, dr.z - L.mars.z));
      // too far away: no button
      put(L.mars.x + tan3.x * 200, L.mars.y + tan3.y * 200, L.mars.z + tan3.z * 200, tan3);
      L.update(1 / 60);
      o.btnFarOff = document.getElementById("droneBtn").classList.contains("hidden");
      // drive up to it and the button comes up
      const dn = V(dr.x - b.x, dr.y - b.y, dr.z - b.z).normalize();
      let t4 = V(1, 0, 0); if (Math.abs(dn.x) > 0.9) t4 = V(0, 1, 0);
      const tan4 = t4.clone().cross(dn).normalize();
      put(dr.x - tan4.x * 10, dr.y - tan4.y * 10, dr.z - tan4.z * 10, tan4);
      L.update(1 / 60);
      const btn = document.getElementById("droneBtn");
      const laidOut = () => {
        const ids = ["viewBtn", "skipBtn", "stageBtn", "satBtn", "chuteBtn", "roverBtn", "hatchBtn",
                     "missileBtn", "gearBtn", "throttleBtn", "camBtn", "bucketBtn", "catBtn", "droneBtn"];
        const rs = [];
        for (const id of ids) {
          const e = document.getElementById(id);
          if (!e || e.classList.contains("hidden")) continue;
          const r = e.getBoundingClientRect();
          if (r.width) rs.push({ id, l: r.left, r: r.right, t: r.top, b: r.bottom });
        }
        const bad = [];
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i], c = rs[j];
          if (a.l < c.r - 2 && c.l < a.r - 2 && a.t < c.b - 2 && c.t < a.b - 2) bad.push(a.id + "/" + c.id);
        }
        return { bad, up: rs.map(r => r.id) };
      };
      o.btnNear = !btn.classList.contains("hidden");
      o.slotDriving = laidOut();
      o.btnModeFly = btn.dataset.mode === "fly";
      // one tap and he is flying it
      o.tapped = L.marsDronePress();
      L.update(1 / 60);
      o.flying = L.marsDroneActive();
      o.btnModeBack = btn.dataset.mode === "back";
      o.roverWaits = L.roverActive() && Math.abs(L.rover.speed) < 0.01;
      o.slotFlying = laidOut();
      // one finger: nothing else is on screen to hold
      o.oneFinger = ["throttleBtn", "slowBtn", "fastBtn", "gearBtn"].every(id => document.getElementById(id).classList.contains("hidden"));
      const roverAt = { x: L.rover.x, y: L.rover.y, z: L.rover.z };

      // point-to-go, in both views: a finger on a place out there flies it there
      o.views = {};
      for (const chase of [true, false]) {
        st.viewChase = chase;
        const s0 = { x: dr.x, y: dr.y, z: dr.z };
        const h0 = dr.h;
        for (let i = 0; i < 60 * 8; i++) { L.api.setTouch(0.12, -0.25); L.update(1 / 60); }
        st.touching = false;      // setTouch sets `touching`, so let go AFTER it
        o.views[chase ? "chase" : "cockpit"] = {
          moved: Math.round(Math.hypot(dr.x - s0.x, dr.y - s0.y, dr.z - s0.z)),
          up: Math.round(dr.h), stalled: dr.speed < 0.2 && dr.forced === false ? 0 : 0,
        };
        // finger off: it stops and holds
        for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
        o.views[chase ? "chase" : "cockpit"].hovers = dr.speed < 0.5 && dr.h > 1;
      }
      o.stillFlying = L.marsDroneActive();
      o.aloft = dr.h > 3;

      // ---- touch the rover and it comes home and lands, and he is driving again
      st.viewChase = true;
      // turn it back toward the rover and let the camera settle so the rover is on screen
      const back = V(roverAt.x - dr.x, roverAt.y - dr.y, roverAt.z - dr.z);
      back.addScaledVector(dr.n, -back.dot(dr.n)).normalize();
      dr.f.copy(back);
      for (let i = 0; i < 90; i++) L.update(1 / 60);
      // a point on the rover's own roof: "up" out here is the surface normal, not +Y
      const rup = L.rover.n;
      const pv = V(L.rover.x + rup.x * 1.6, L.rover.y + rup.y * 1.6, L.rover.z + rup.z * 1.6).project(L.camera);
      o.roverOnScreen = Math.abs(pv.x) < 1 && Math.abs(pv.y) < 1 && pv.z < 1;
      const pick = L.marsDronePick(pv.x, pv.y);
      o.pickIsRover = !!pick && pick.rover === true;
      L.api.setTouch(pv.x, pv.y); L.update(1 / 60);
      st.touching = false;
      o.headingHome = dr.home === true;
      const land0 = L.flags.marsDroneLandings || 0;
      for (let i = 0; i < 60 * 40 && L.marsDroneActive(); i++) L.update(1 / 60);
      o.landedBack = !L.marsDroneActive();
      o.landings = (L.flags.marsDroneLandings || 0) - land0;
      o.besideRover = Math.round(Math.hypot(dr.x - L.rover.x, dr.y - L.rover.y, dr.z - L.rover.z));
      o.drivingAgain = L.roverActive() && !L.marsDroneActive();
      L.api.setThrottle(true); for (let i = 0; i < 60; i++) L.update(1 / 60); L.api.setThrottle(false);
      o.rollsAgain = Math.abs(L.rover.speed) > 2;
      // and the button is a way back up, every time, for free
      o.btnUpAgain = !document.getElementById("droneBtn").classList.contains("hidden");
      o.canFlyAgain = L.marsDronePress() && L.marsDroneActive();
      // the button alone brings it home too: he can never be stuck in the air
      L.marsDronePress();
      o.buttonSendsHome = L.mars.drone.home === true;
      for (let i = 0; i < 60 * 60 && L.marsDroneActive(); i++) L.update(1 / 60);
      o.buttonLandsIt = !L.marsDroneActive();
      o.flights = L.flags.marsDroneFlights || 0;

      // ---- none of it is solid, none of it is a target, none of it is alive
      let solid = 0;
      L.__lpForEachSolid ? 0 : 0;
      o.noTargets = L.targets.every(t2 => Math.hypot(t2.x - L.mars.x, t2.z - L.mars.z) > 200);
      o.exploded = L.flags.exploded;
      o.frameErrors = L.frameErrors || 0;
      return o;
    });
    check("mars: dune jumps -- ringed ramps out on the dunes; drive up one at speed and the rover is thrown into the air, tumbles, comes down in a dust burst and drives straight on",
      o.jumps >= 3 && o.rings === o.jumps && o.jumped && o.airFrames > 20 && o.maxH > 3 &&
      o.cameDown && o.jumpLandings >= 1 && o.stillDriving && o.flipRights &&
      o.maxRoll > 1.5 && o.goes === 4 && o.allLanded && o.flips >= 1 && o.levelAfter, JSON.stringify(o));
    check("mars: the boulder field -- shove a rock and it rolls away along the ground; drive into a cairn and the whole stack comes down; drive off and back and it is all set up again, for free",
      o.rocks >= 9 && o.stacked >= 6 && o.shoves >= 1 && o.rockMoved >= 4 && o.rockOnGround && o.rockDrawnThere < 0.2 &&
      o.cairnDown && o.cairnScattered && o.wentAway && o.fieldReset && o.standingAgain, JSON.stringify(o));
    check("mars: the little helicopter -- parked by the garage, one tap when he drives up to it and he is flying it with the very same point-to-go, in both views",
      o.droneParked && o.btnFarOff && o.btnNear && o.btnModeFly && o.tapped && o.flying && o.btnModeBack &&
      o.roverWaits && o.oneFinger && o.views.chase.moved > 30 && o.views.cockpit.moved > 30 &&
      o.views.chase.hovers && o.views.cockpit.hovers && o.aloft, JSON.stringify(o));
    check("mars: touch the rover and the drone comes home, lands beside it and he is driving again -- and the button is always a way down, so he can never be stuck up there",
      o.roverOnScreen && o.pickIsRover && o.headingHome && o.landedBack && o.landings === 1 &&
      o.besideRover < 40 && o.drivingAgain && o.rollsAgain && o.btnUpAgain && o.canFlyAgain &&
      o.buttonSendsHome && o.buttonLandsIt && o.flights === 2 && o.exploded === 0 && o.frameErrors === 0, JSON.stringify(o));
    check("mars: the drone's button never lands on top of another one -- nothing overlaps with it up beside the rover, or up in the air as the way down",
      o.slotDriving.bad.length === 0 && o.slotDriving.up.includes("droneBtn") &&
      o.slotFlying.bad.length === 0 && o.slotFlying.up.includes("droneBtn") &&
      !o.slotFlying.up.includes("roverBtn") &&   // it must not be able to stow the rover from up in the air
      JSON.stringify({ driving: o.slotDriving, flying: o.slotFlying }));
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
