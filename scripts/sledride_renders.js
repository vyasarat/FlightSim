"use strict";
// RIDE THE ROCKET SLED (v144), rendered through the game's own loop, PORTRAIT
// 820x1180, to LOOK at. He rides it: the sled card (setVehicle + spawnAt, the
// srSpawn path), go held the way he holds the go button, nothing else. Each view
// is `<moment>-<seat|chase>`:
//   armed     home at the start tower, before go
//   count3/2/1  the countdown: the tower's lamps lit, the numeral on the screen
//   go        (chase) just after the countdown: the green lamp, the run starting
//   run       ~1.5 s into the run, at speed
//   wall      the nose ~60 m from the wall from the seat (~20 m in the chase)
//   smash     (chase) ~0.3 s after impact, the bricks in the air
//   smash05/10/15  (seat) 0.05 / 0.10 / 0.15 s after impact
//   chutes    ~1.5 s after the three chutes open
//   rebuild   rolling home, ~2.4 s into the rebuild: half rebuilt, bricks in mid-flight
//   rebuilt   the last brick home, the wall whole, still rolling home
//   homeagain back at the start tower, ready: the go button up
//   burst     mid-run with the drag up held: the bigger flame
//   node scripts/sledride_renders.js [root] [views...]    -> evidence/sledride/ (OUT= to change; PORT=, default 8199)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const MOMENTS = ["armed", "count3", "count2", "count1", "run", "wall", "chutes", "rebuild", "rebuilt", "homeagain"];
const DEFAULT = [].concat(...MOMENTS.map(m => [m + "-seat", m + "-chase"]),
  ["go-seat", "go-chase", "smash05-seat", "smash10-seat", "smash15-seat", "smash30-seat", "smash-chase",
   "chutes03-chase", "gap-chase", "burst-seat", "burst-chase"]);
const SAYS = {
  armed: "on the red sled at the start tower, lamps dark, nose down the rail at the brick wall; the go button is up",
  count3: "the countdown at 3: the numeral high on the screen, the tower's red lamp lit",
  count2: "the countdown at 2: red and amber lamps lit",
  count1: "the countdown at 1: red and amber lamps lit, the roar spooling",
  go: "just after 1: the tower's green lamp lit, the flame lit, the run starting",
  run: "~1.5 s into the run, at speed: the flame and the smoke trail, the wall growing ahead",
  wall: "close to the wall (seat ~60 m, chase ~20 m): the wall big, the red target on the rail's line where the nose will hit",
  smash: "~0.3 s after impact: the bricks flying forward, up and west, the flash",
  smash05: "0.05 s after impact, from the seat: the wall bursting round the nose",
  smash10: "0.10 s after impact, from the seat: the bricks flying past",
  smash15: "0.15 s after impact, from the seat: the last bricks going by",
  smash30: "0.30 s after impact, from the seat: through, the view widened by the kick, the bricks behind",
  chutes03: "0.3 s after the chutes open: the canopies just out, his camera starting to swing east",
  gap: "just back through the gap in the wall, ~1.2 s into the rebuild: the bricks rising off the ground to fly back",
  chutes: "~1.5 s after the chutes open: three canopies (red, white, yellow) streaming behind the sled; in the chase, seen from the east side, the sled in profile and clear",
  rebuild: "rolling home backwards, ~2.4 s into the rebuild: the wall half rebuilt, the top rows' bricks in mid-flight",
  rebuilt: "the last brick home: the wall whole again, the sled still rolling home",
  homeagain: "home again at the start tower, ready: lamps dark, the go button up",
  burst: "mid-run with the drag up held: in the chase a longer, fatter flame from the nozzles than run-chase; from the seat the flame is behind him and the burst is its sound only (the picture is run-seat's)",
};

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "sledride");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8199), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.screenshot({ timeout: 180000 });
  // the first view painted after load comes out white: paint it twice, keep the second
  let first = true;
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state, sled = L.sled, T = L.TUNE.rocketSled;
      const [moment, view] = v.split("-");
      const nose = 10 * T.size, wallFace = T.wallAt - T.brick[2] / 2;
      const f0 = { ...L.flags };
      const d = k => (L.flags[k] || 0) - (f0[k] || 0);
      const burst = moment === "burst";
      let hold = () => {};
      const step = (n, cond) => { for (let i = 0; i < n && !(cond && cond()); i++) { hold(); L.update(1 / 60); } };
      document.getElementById("screenVehicle").classList.add("hiddenS");
      L.api.setThrottle(false); L.api.clearStick();
      L.api.setVehicle("sled"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(view === "chase");
      step(90);
      if (moment !== "armed") {
        // go, held the way he holds the go button (the run lets go of it once it starts)
        L.api.setThrottle(true);
        step(60 * 6, () => sled.phase === "count");
        if (moment.startsWith("count")) {
          const n = +moment.slice(5);
          step(60 * 4, () => sled.phase !== "count" || sled.t <= n - 0.35);
        } else {
          step(60 * 6, () => sled.phase === "run");
          L.api.setThrottle(false);
          if (burst) hold = () => L.api.setStick(0, 1);             // the drag up, held through the frame
          if (moment === "run" || burst) step(60 * 3, () => sled.phase === "run" && sled.t >= 1.5 - 3 / 60);
          // three paints (~6 m at 120 m/s) still to come: stop ~26 m short so it is drawn ~20 m out
          else if (moment === "go") step(60 * 2, () => sled.phase === "run" && sled.t >= 0.15 - 3 / 60);
          else if (moment === "wall") step(60 * 8, () => sled.d + nose >= wallFace - (view === "seat" ? 66 : 26));
          else if (moment.startsWith("smash")) {
            const after = moment === "smash" ? 0.3 : +moment.slice(5) / 100;
            step(60 * 8, () => d("sledSmashes") > 0);
            step(Math.max(0, Math.round(after * 60) - 3));
          }
          else if (moment.startsWith("chutes")) {
            const after = moment === "chutes" ? 1.5 : +moment.slice(6) / 10;
            step(60 * 12, () => d("sledChutes") > 0); step(Math.max(0, Math.round(after * 60) - 3));
          }
          else if (moment === "gap") { step(60 * 30, () => sled.phase === "home" && sled.rebuilding); step(Math.round(1.2 * 60) - 3); }
          else if (moment === "rebuild") { step(60 * 30, () => sled.phase === "home" && sled.rebuilding); step(Math.round(2.4 * 60) - 3); }
          else if (moment === "rebuilt") step(60 * 40, () => d("sledRebuilds") > 0);
          else if (moment === "homeagain") { step(60 * 50, () => d("sledHomes") > 0 && sled.phase === "armed"); step(30); }
        }
      }
      window.__hold = hold;
      const lamps = sled.lamps.map((l, i) => l.glow.material.opacity > 0.5 ? "RAG"[i] : "").join("") || "-";
      const big = document.getElementById("bigNum");
      return { v, kind: L.vehKind(), phase: sled.phase, t: +sled.t.toFixed(2), d: +sled.d.toFixed(0), v_: +sled.v.toFixed(0),
               toWall: +(wallFace - sled.d - nose).toFixed(0), lamps, num: big.classList.contains("on") ? big.textContent : "",
               airBricks: sled.bricks.filter(b => b.mode !== "wall").length, chutes: sled.chuteOut, burstK: L.sr ? +L.sr.burstK.toFixed(2) : null,
               go: !document.getElementById("throttleBtn").classList.contains("hidden") };
    }, v);
    // the liftoff flash is a wall-clock blink in the game; this rig's compressed time never ends it
    await page.evaluate(() => { const f = document.getElementById("flash"); if (f) { f.style.transition = "none"; f.classList.remove("on"); } });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } window.__lp.api.clearStick(); });
    const file = path.join(out, v + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
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
