"use strict";
// THE WRECKING-BALL CRANE (v145), rendered through the game's own loop, PORTRAIT
// 820x1180, to LOOK at. He is in the crane (setVehicle + spawnAt, the crSpawn path),
// the go button pressed once, nothing else. Each view is `<moment>-<seat|chase>`:
//   aim       waiting, pointed at the middle block: the red ring on its first tower
//   aimleft   turned on to the left-hand block by a held drag, settled by the magnet
//   count3/2/1  the 3-2-1 on the big numeral
//   wind      ~2 s into the wind-up: the ball drawn back, slow
//   fast      ~1.1 s into the swing: the ball coming forward fast
//   impact    the frame after the hit
//   domino    the third tower of the row on its way over
//   down      all down, the dust settling
//   restored  stood back up, waiting again: the go button up
//   node scripts/crane_renders.js [root] [views...]    -> evidence/crane/ (OUT= to change; PORT=, default 8303)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const MOMENTS = ["aim", "aimleft", "count3", "count2", "count1", "wind", "fast", "impact", "domino", "down", "restored"];
const DEFAULT = [].concat(...MOMENTS.map(m => [m + "-seat", m + "-chase"]));
const SAYS = {
  aim: "in the crane, waiting, pointed at the middle block of towers: the red ring pulsing on its first tower; the go button up",
  aimleft: "turned left on to the left-hand block by a held drag, and settled on it",
  count3: "the countdown at 3, the numeral high on the screen",
  count2: "the countdown at 2",
  count1: "the countdown at 1",
  wind: "~2 s into the wind-up: the huge ball drawn back toward the crane",
  fast: "~1.1 s into the swing: the ball coming forward fast at the first tower",
  impact: "the frame after the hit: the ball at the first tower's face, pieces and dust off it",
  domino: "mid-domino: the third tower going over, the first two already leaning on the next",
  down: "all five down, away from the crane, the dust settling",
  restored: "every tower standing again exactly, waiting: the go button up",
};

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "crane");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8303), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 900000 });
  // the first view painted after load comes out white: paint it twice, keep the second
  let first = true;
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state, cr = L.cr;
      const [moment, view] = v.split("-");
      const f0 = { ...L.flags };
      const d = k => (L.flags[k] || 0) - (f0[k] || 0);
      const step = (n, cond) => { for (let i = 0; i < n && !(cond && cond()); i++) L.update(1 / 60); };
      const gl = L.renderer.domElement;
      const fire = (type, x, y) => gl.dispatchEvent(new PointerEvent(type, { pointerId: 61, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.setThrottle(false); L.api.clearStick();
      L.api.setVehicle("crane"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(view === "chase");
      step(120);
      if (moment === "aimleft") {
        fire("pointerdown", 410, 700); step(1); fire("pointermove", 190, 700); step(100); fire("pointerup", 190, 700); step(150);
      } else if (moment !== "aim") {
        // go: the go button, pressed once
        const b = document.getElementById("throttleBtn");
        b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 62, bubbles: true, cancelable: true }));
        step(1);
        b.dispatchEvent(new PointerEvent("pointerup", { pointerId: 62, bubbles: true, cancelable: true }));
        if (moment.startsWith("count")) { const n = +moment.slice(5); step(60 * 4, () => cr.phase !== "count" || cr.t <= n - 0.35); }
        else if (moment === "wind") step(60 * 8, () => cr.phase === "wind" && cr.t >= 2.0 - 3 / 60);
        else if (moment === "fast") step(60 * 10, () => cr.phase === "swing" && cr.t >= 1.1 - 3 / 60);
        else if (moment === "impact") step(60 * 12, () => d("crHits") > 0);
        else if (moment === "domino") step(60 * 20, () => L.crTowers().some(t => t.g === cr.aim && t.i === 2 && t.phiDeg > 30));
        else if (moment === "down") { step(60 * 25, () => d("crDowns") > 0); step(60); }
        else if (moment === "restored") { step(60 * 40, () => d("crRises") > 0 && cr.phase === "armed"); step(30); }
      }
      const big = document.getElementById("bigNum");
      return { v, kind: L.vehKind(), phase: cr.phase, t: +cr.t.toFixed(2), aim: L.crAimed(), ball: +cr.ballSpeed.toFixed(1),
               down: L.crTowers().filter(t => t.phiDeg > 60).length, num: big.classList.contains("on") ? big.textContent : "",
               go: !document.getElementById("throttleBtn").classList.contains("hidden") };
    }, v);
    await page.evaluate(() => { const f = document.getElementById("flash"); if (f) { f.style.transition = "none"; f.classList.remove("on"); } });
    // three paints, each a frame on: the rig's paint runs the game's frame too
    await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__paint(); });
    const file = path.join(out, v + ".png");
    await page.screenshot({ path: file, timeout: 900000 });
    if (!first) console.log(file + "  --  " + (SAYS[v.split("-")[0]] || "") + "  " + JSON.stringify(info));
    first = false;                     // the throwaway first paint is not reported
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
