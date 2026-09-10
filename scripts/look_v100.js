"use strict";
// Render the things this release actually changed, so they can be LOOKED AT.
// The harness's eight visual scenes are a plane, a rocket and two skylines --
// none of them shows the boat's wake or the button ladder, which is all this
// release touched. Writes to the gitignored evidence/ folder.
const { chromium } = require("playwright-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 8199;
const URL = `http://127.0.0.1:${PORT}/cockpit/index.html`;
const OUT = path.resolve(__dirname, "..", "evidence", "lock");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn("python3", ["-m", "http.server", String(PORT)],
    { cwd: path.resolve(__dirname, ".."), stdio: "ignore" });
  process.on("exit", () => server.kill());
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_HEADLESS_SHELL,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const shot = async (name, w, h, setup) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      let seed = 0x2F6E2B1;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    });
    const page = await ctx.newPage();
    await page.addInitScript(`window.__rafQueue=[];window.__simTime=0;window.requestAnimationFrame=cb=>{__rafQueue.push(cb);return __rafQueue.length;};`);
    await page.goto(URL);
    await page.waitForFunction(() => !!window.__lp, null, { timeout: 15000 });
    await page.evaluate(() => window.__lp.api.skipScreens());
    await page.evaluate(setup);
    // frame() -- and therefore renderer.render -- only runs off the stubbed rAF
    // queue. Calling update() alone advances the world and draws nothing, which
    // is why the first pass of this script produced eleven black screenshots.
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) {
        const q = window.__rafQueue.splice(0);
        if (q.length) q[q.length - 1](window.__simTime += 1000 / 60);
      }
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
    console.log("wrote", name + ".png");
    await ctx.close();
  };

  // ---- the speedboat under way, both views: this is the "smoke" -------------
  const driveBoat = (chase) => `(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    L.api.setView(${chase});
    // driven out of the harbour under its own power, not teleported: the chase
    // camera lerps, so a teleport mid-run leaves it lagging somewhere useless
    for (let i = 0; i < 60 * 26; i++) { L.api.setStick(0, 0); L.update(1/60); }
    L.api.clearStick();
    for (let i = 0; i < 3; i++) L.update(1/60);
  })()`;
  await shot("boat-chase-underway", 1180, 820, driveBoat(true));
  await shot("boat-helm-underway", 1180, 820, driveBoat(false));

  const driveYacht = (chase) => `(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("yacht"); L.api.spawnAt(1, 1);
    L.api.setView(${chase});
    for (let i = 0; i < 60 * 30; i++) { L.api.setStick(0, 0); L.update(1/60); }
    L.api.clearStick();
    for (let i = 0; i < 3; i++) L.update(1/60);
  })()`;
  await shot("yacht-chase-underway", 1180, 820, driveYacht(true));
  await shot("yacht-bridge-underway", 1180, 820, driveYacht(false));

  // ---- the controls, on every vehicle that changed -------------------------
  const car = `(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("car"); L.api.placeOnRunway();
    for (let i = 0; i < 60 * 3; i++) { L.api.setStick(0, 0); L.update(1/60); }
    L.api.clearStick();
    L.carHornPress();
    for (let i = 0; i < 6; i++) L.update(1/60);
  })()`;
  await shot("car-horn-and-steps-ipad", 1180, 820, car);
  await shot("car-horn-and-steps-phone", 844, 390, car);

  const heli = `(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("helicopter"); L.api.placeOnRunway();
    st.phase = "AIRBORNE"; st.y += 90;
    for (let i = 0; i < 40; i++) L.update(1/60);
    L.spdCycle(); L.spdCycle();
    for (let i = 0; i < 6; i++) L.update(1/60);
  })()`;
  await shot("heli-stepper-ipad", 1180, 820, heli);
  await shot("heli-stepper-phone", 844, 390, heli);

  const plane = `(() => {
    const L = window.__lp;
    L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0);
    for (let i = 0; i < 40; i++) L.update(1/60);
  })()`;
  await shot("plane-steps-ipad", 1180, 820, plane);
  await shot("plane-steps-phone", 844, 390, plane);

  const rover = `(() => {
    const L = window.__lp, st = L.state;
    L.api.setVehicle("rocket"); L.api.placeOnRunway();
    const b = L.BODIES[0];
    st.dest = "moon"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 3;
    st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
    L.update(1/60); L.roverDeploy();
    for (let i = 0; i < 40; i++) L.update(1/60);
  })()`;
  await shot("rover-steps-ipad", 1180, 820, rover);

  // ---- the lock ------------------------------------------------------------
  const lockShot = (phase, chase) => `(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
    L.api.setView(${chase});
    const cx = (K.chamber.x[0]+K.chamber.x[1])/2, cz = (K.gateS+K.gateN)/2;
    st.x = cx; st.z = cz; st.y = L.seaLevelAt(cx, cz); st.speed = 0; st.heading = Math.PI;
    for (let i = 0; i < 40; i++) L.update(1/60);
    if ("${phase}" !== "low") {
      L.lockPress();
      for (let i = 0; i < 60 * 26; i++) { L.update(1/60); st.x = cx; st.z = cz; }
    }
    if ("${phase}" === "dock") { st.z = K.gateN + 130; for (let i = 0; i < 90; i++) L.update(1/60); }
  })()`;
  await shot("lock-chamber-low", 1180, 820, lockShot("low", true));
  await shot("lock-chamber-high", 1180, 820, lockShot("high", true));
  await shot("lock-in-the-dock", 1180, 820, lockShot("dock", true));
  await shot("lock-from-above", 1180, 820, `(() => {
    const L = window.__lp, st = L.state, K = L.LK;
    L.api.setVehicle("helicopter"); L.api.placeOnRunway();
    st.phase = "AIRBORNE";
    st.x = (K.chamber.x[0]+K.chamber.x[1])/2; st.z = K.gateS - 260;
    st.y = L.TUNE.waterLevel + 300; st.heading = Math.PI; st.speed = 0;
    L.api.setView(true);
    for (let i = 0; i < 40; i++) L.update(1/60);
  })()`);

  await browser.close();
  server.kill();
  console.log("\nall shots in", OUT);
  process.exit(0);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
