"use strict";
// Run ONE harness check module on its own, the way headless_test.js runs it --
// same page setup (seeded Math.random, stubbed rAF, skipScreens), same
// newPage/check contract -- on a spare port, in a couple of minutes instead of
// the suite's half hour. For iterating; the full harness is still the gate.
//
//   node scripts/run_module.js solidity_checks [root] [--vp=1024x768,390x844]
const path = require("path");
const { launch, serve } = require("./art_rig.js");

(async () => {
  const args = process.argv.slice(2);
  const name = args.find(a => !a.startsWith("--"));
  const rootArg = args.filter(a => !a.startsWith("--"))[1];
  const vpArg = (args.find(a => a.startsWith("--vp=")) || "").slice(5);
  const viewports = vpArg ? vpArg.split(",").map(s => s.split("x").map(Number)) : [[1024, 768]];
  const root = path.resolve(rootArg || path.join(__dirname, ".."));
  const port = +(process.env.PORT || 8191), srv = serve(root, port), browser = await launch();
  const URL = `http://127.0.0.1:${port}/cockpit/index.html`;
  async function newPage(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      let seed = 0x2F6E2B1;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); if (process.env.LOG) console.log("[page]", m.text()); });
    await page.addInitScript(`window.__rafQueue = []; window.__simTime = 0;
      window.requestAnimationFrame = cb => { __rafQueue.push(cb); return __rafQueue.length; };`);
    await page.goto(URL, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
    await page.waitForFunction(() => !window.__lp.artReady || window.__lp.artReady(), null, { timeout: 60000 });
    await page.evaluate(() => window.__lp.api.skipScreens());
    return { ctx, page, errors };
  }
  let pass = 0, fail = 0;
  function check(label, ok, detail) {
    if (ok) pass++; else fail++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail !== undefined ? "  " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
  }
  const SHOTS = path.resolve(__dirname, "..", "evidence", "module");
  require("fs").mkdirSync(SHOTS, { recursive: true });
  try {
    await require(name.startsWith("/") ? name : "./" + name)({ newPage, check, shots: SHOTS, viewports });
  } catch (e) { fail++; console.log("FAIL module threw: " + (e.stack || e)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
