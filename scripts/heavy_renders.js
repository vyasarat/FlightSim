"use strict";
// The booster rocket (v142), through the game's own loop, portrait:
//   picker        the vehicle screen with its card
//   pad-<v>       on the launch site's pad (v = chase | seat)
//   climb-chase   a few seconds up
//   watch@<s>     the camera on the side boosters, <s> seconds after they let go
//   back-chase    the camera back on him afterwards
//   node scripts/heavy_renders.js [root] [views...]    -> evidence/heavy/ (OUT= to change)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");
const DEFAULT = ["picker", "pad-chase", "pad-seat", "climb-chase", "watch@0.4", "watch@3", "watch@7", "watch@11", "watch@14", "watch@17", "back-chase"];

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "heavy");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8203), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state;
      window.__hold = () => {};
      if (v === "picker") { L.api.clearStick(); document.getElementById("screenVehicle").classList.remove("hiddenS"); return { v }; }
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.setThrottle(false);
      L.api.setVehicle("heavy"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(!v.endsWith("seat"));
      for (let i = 0; i < 60; i++) L.update(1 / 60);
      if (v.startsWith("pad")) return { v, y: S.y | 0 };
      L.api.setThrottle(true);
      if (v === "climb-chase") { for (let i = 0; i < 60 * 4; i++) L.update(1 / 60); return { v, y: S.y | 0 }; }
      const s0 = L.flags.heavySeparations || 0;
      for (let i = 0; i < 60 * 60 && (L.flags.heavySeparations || 0) === s0; i++) L.update(1 / 60);
      if (v.startsWith("watch@")) { const t = +v.slice(6); for (let i = 0; i < Math.round(t * 60); i++) L.update(1 / 60); return { v, watching: L.heavyWatching(), landed: L.heavy.boosters.map(b => b.landed) }; }
      if (v === "back-chase") { for (let i = 0; i < 60 * 40 && L.heavyWatching(); i++) L.update(1 / 60); for (let i = 0; i < 60 * 2; i++) L.update(1 / 60); return { v, watching: L.heavyWatching(), y: S.y | 0 }; }
      return { v };
    }, v);
    // the liftoff flash is a 110 ms wall-clock blink in the game; this rig's compressed time never ends it
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } });
    const file = path.join(out, v.replace("@", "_") + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    console.log("wrote", file, JSON.stringify(info));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
