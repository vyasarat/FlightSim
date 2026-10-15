"use strict";
// The Corvette (v159) and its rocket booster, through the game's own loop, portrait:
//   picker          the vehicle screen, its card beside the Cybertruck's
//   cruise          the chase view on the motorway, a held finger, no booster
//   chase           the chase view on the motorway, the booster burning
//   behind          the camera posed low behind the tail, the booster burning: the flames close
//   behindOff       the same, the booster out (to tell the flames from the scene)
//   seat            the driving seat, the booster burning: the mirror
//   city            the chase view along a New York street, the booster burning
//   citySeat        the same from the driving seat (v160: the boost in a city)
//   cityApproach    the chase view coming up to a junction, the boost being shed (v160)
//   dusk            the chase view on the motorway at dusk (the night sky part-way in), burning
//   turn            the chase view mid-turn, a full steer held, burning: the flames side-on
//   side|three      close in, stopped, at wheel height: the body, no lettering, wheels on the road
//   node scripts/corvette_renders.js [root] [views...]    -> evidence/corvette/ (OUT= to change)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["picker", "cruise", "chase", "behind", "seat", "city", "dusk", "side", "three"];

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "corvette");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8204), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.waitForFunction(() => window.__lp.modelState && window.__lp.modelState.corvette !== "loading", null, { timeout: 120000 }).catch(() => {});
  await page.screenshot({ timeout: 180000 });
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state;
      window.__hold = () => {};
      if (window.__carCam0) { window.carCamera = window.__carCam0; }
      S.sky = 0; S.nightF = 0;
      if (v === "picker") {
        L.api.clearStick();
        document.getElementById("screenVehicle").classList.remove("hiddenS");
        return { v };
      }
      document.getElementById("screenVehicle").classList.add("hiddenS");
      for (let i = 0; i < 60 * 10 && S.exploding; i++) L.update(1 / 60);
      L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(v !== "seat" && v !== "citySeat");
      L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      const drive = (n, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = 0; S.ctrlPitch = pitch; L.update(1 / 60); } };
      const note = { kind: L.vehKind(), imported: L.vehicleModel && L.vehicleModel.userData.imported };
      if (v === "dusk") { S.sky = 3; window.__hold = () => { S.sky = 3; S.nightF = 0.62; }; }
      if (v === "cruise") { drive(60 * 6, 0); window.__hold = () => { S.touching = true; S.ctrlPitch = 0; }; }
      else if (v === "turn") { drive(60 * 3, 0); drive(60 * 3, 0.8); const full = 1 * L.CAR.dragRangeX * innerWidth / (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)); for (let i = 0; i < 50; i++) { S.touching = true; S.ctrlBank = full; S.ctrlPitch = 0.8; L.update(1 / 60); } window.__hold = () => { S.touching = true; S.ctrlBank = full; S.ctrlPitch = 0.8; }; }
      else if (v === "chase" || v === "seat" || v === "dusk") { drive(60 * 3, 0); drive(60 * 4, 0.8); const h = window.__hold; window.__hold = () => { h(); S.touching = true; S.ctrlPitch = 0.8; }; }
      else if (v === "behind" || v === "behindOff") {
        const p = v === "behind" ? 0.8 : 0;
        drive(60 * 3, 0); drive(60 * 4, p);
        window.__carCam0 = window.__carCam0 || window.carCamera;
        window.carCamera = () => {
          const cam = L.camera, fx = -Math.sin(S.heading), fz = -Math.cos(S.heading), rx = -fz, rz = fx;
          cam.position.set(S.x - fx * 15 + rx * 4, S.y + 2.4, S.z - fz * 15 + rz * 4);
          cam.up.set(0, 1, 0); cam.lookAt(S.x - fx * 4, S.y + 0.9, S.z - fz * 4);
        };
        window.__hold = () => { S.touching = true; S.ctrlPitch = p; };
      } else if (v === "city" || v === "citySeat" || v === "cityApproach") {
        // the longest straight grid street in New York, from its start, the booster lit
        const C = L.streets.cities.ny;
        const grid = C.roads.filter(x => x.kind === "grid" && x.b).sort((a, b) => b.len - a.len), r = grid[0], q = {};
        L.stPointAt(r, 20, 1, r.lo, q);
        S.x = q.x; S.z = q.z; S.y = L.stSurfaceAt(q.x, q.z); S.heading = Math.atan2(-q.fx, -q.fz); S.speed = L.CAR.cruise;
        L.car.yield = 1; L.car.steer = 0; L.stPlan.road = r; L.stPlan.dir = 1; L.stPlan.turn = null;
        L.car.rejoin = null; L.car.rejoinT = 0; L.car.rejoinPts = null;
        L.updateScenery(S.x, S.z, true);
        for (let i = 0; i < 60; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
        drive(80, 0.8);
        if (v === "cityApproach") {
          // on through the blocks, booster held, until the boost is being shed for a junction ahead
          const stepV = L.CAR.cruise * L.spdStepsFor("corvette")[2];
          for (let i = 0; i < 60 * 20; i++) {
            drive(1, 0.8);
            const rd = L.car.road;
            if (L.cv.on && rd && rd.toNode > 35 && rd.toNode < 55 && S.speed > stepV + 4 && rd.street && rd.street.kind === "grid") break;
          }
          note.toNode = L.car.road && Math.round(L.car.road.toNode);
        }
        note.street = r.id; note.len = Math.round(r.len);
        window.__hold = () => { S.touching = true; S.ctrlPitch = 0.8; };
      } else if (v === "side" || v === "three") {
        drive(60 * 2, 0); L.api.clearStick();
        window.__hold = () => { S.speed = 0; };
        for (let i = 0; i < 60; i++) { L.update(1 / 60); window.__hold(); }
        const ang = { side: Math.PI / 2, three: Math.PI / 4 }[v];
        const fx = -Math.sin(S.heading), fz = -Math.cos(S.heading), rx = -fz, rz = fx;
        const D = 15, ca = Math.cos(ang), sa = Math.sin(ang);
        window.__carCam0 = window.__carCam0 || window.carCamera;
        window.carCamera = () => {
          const cam = L.camera;
          cam.position.set(S.x + (fx * ca + rx * sa) * D, S.y + 2.0, S.z + (fz * ca + rz * sa) * D);
          cam.up.set(0, 1, 0); cam.lookAt(S.x, S.y + 1.2, S.z);
        };
        L.update(1 / 60);
      }
      note.burning = L.cv.on; note.k = +L.cv.k.toFixed(2);
      return { v, ...note, y: +S.y.toFixed(2), sp: +S.speed.toFixed(1), fov: +L.camera.fov.toFixed(1) };
    }, v);
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    // the last frames through the game's own update, so the picture is a frame he would see
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__lp.update(1 / 60); window.__hold(); window.__paint(); } });
    const file = path.join(out, v + ".png");
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
