"use strict";
// The Cybertruck (v146), through the game's own loop, portrait:
//   picker          the vehicle screen, its card beside the car's
//   road-<v>        on the motorway, a held finger, lane-keep driving   (v = chase | seat)
//   city-<v>        in New York, at a signalled junction's stop line
//   side|front|rear|three   close in, at wheel height: no lettering, wheels on the road
//   crash-<v>       pointed at a New York building from mid-block: the bang       rebuilt-<v>  back, free, on that street
//   bore-<v>        inside a motorway bore: the taller body under its roof        police-<v>   the chase behind him
//   node scripts/cybertruck_renders.js [root] [views...]    -> evidence/cybertruck/ (OUT= to change; VEH=car for the SUV)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["picker", "road-chase", "road-seat", "city-chase", "city-seat", "side", "front", "rear", "three",
  "rebuilt-chase", "bore-chase", "crash-chase", "bore-seat", "police-chase"];   // a crash never straight after a crash: a page left mid-bang carries it

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "cybertruck");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8203), srv = serve(root, port), browser = await launch();
  const page = await openGame(browser, port, { width: 820, height: 1180 });
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.waitForFunction(() => window.__lp.modelState && window.__lp.modelState.cybertruck !== "loading", null, { timeout: 120000 }).catch(() => {});
  await page.screenshot({ timeout: 180000 });
  // VEH=car renders the SUV from the same spots, to set the two side by side
  await page.evaluate((k) => { window.__veh = k; }, process.env.VEH || "cybertruck");
  for (const v of [views[0], ...views]) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state;
      const [what, seat] = v.split("-");
      window.__hold = () => {};
      if (window.__carCam0) { window.carCamera = window.__carCam0; }
      if (what === "picker") {
        L.api.clearStick();
        document.getElementById("screenVehicle").classList.remove("hiddenS");
        return { what };
      }
      document.getElementById("screenVehicle").classList.add("hiddenS");
      for (let i = 0; i < 60 * 10 && S.exploding; i++) L.update(1 / 60);   // the last view's bang is over first
      L.api.setVehicle(window.__veh || "cybertruck"); L.api.spawnAt(0, 0); L.api.skipScreens();
      L.api.setView(seat !== "seat");
      L.api.clearStick(); for (let i = 0; i < 30; i++) L.update(1 / 60);
      const held = (n) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); } };
      const note = { kind: L.vehKind(), imported: L.vehicleModel && L.vehicleModel.userData.imported };
      if (what === "road") {
        held(60 * 4);
      } else if (what === "crash" || what === "rebuilt") {
        // as cybertruck_checks: street 0's middle, pointed at the nearest city building
        const C = L.streets.cities.ny, q = {};
        const rr = C.roads.filter(x => x.kind === "grid" && x.len > 80).sort((a, b) => a.id - b.id)[0];
        L.stPointAt(rr, rr.len / 2, 1, rr.lo, q);
        let tb = null, td = 1e9;
        L.forEachSolid(o => { if (o.mesh && o.mesh.isCityProxy) { const d = Math.hypot(o.x - q.x, o.z - q.z); if (d < td) { td = d; tb = o; } } });
        S.x = q.x; S.z = q.z; S.y = L.stSurfaceAt(q.x, q.z); S.heading = Math.atan2(-(tb.x - q.x), -(tb.z - q.z)); S.speed = L.CAR.cruise;
        L.car.rejoin = null; L.car.rejoinT = 0; L.car.rejoinPts = null;   // a teleport: no pull-back left over from the last view's bang
        L.updateScenery(S.x, S.z, true); L.api.clearStick(); for (let i = 0; i < 3; i++) L.update(1 / 60);
        for (let i = 0; i < 360 && !S.exploding; i++) held(1);
        note.banged = !!S.exploding;
        if (what === "crash") { for (let i = 0; i < 10; i++) L.update(1 / 60); }
        else { for (let i = 0; i < 600 && S.exploding; i++) L.update(1 / 60); L.api.clearStick(); for (let i = 0; i < 60 * 4; i++) L.update(1 / 60); note.back = !S.exploding; }
      } else if (what === "bore") {
        held(60);
        const n0 = L.hwyNearest(S.x, S.z), bo = L.highway.bores[0], mid = bo.pts[Math.floor(bo.pts.length / 2)];
        const sMid = L.hwyNearest(mid.x, mid.z).s, dir = Math.sign(Math.cos(S.heading - Math.atan2(-n0.fx, -n0.fz))) || 1;
        // inside the bore already, on the lateral where the ceiling is over him (the twin
        // bores sit wider than the open road's lanes): the one nearest his own
        let q = L.hwySampleAt(sMid - dir * 40), lat = null;
        for (let k = 0; k <= 60 && lat === null; k++) for (const sg of [1, -1]) {
          const l = n0.lateral + sg * k * 0.5, x = q.x - q.fz * l, z = q.z + q.fx * l;
          if (lat === null && L.hwyBoreCeiling(x, z) !== null && !L.solidCol(x, z, q.y + 1, q.y + 3, 4, L.SOLID.CAR)) lat = l;
        }
        S.x = q.x - q.fz * lat; S.z = q.z + q.fx * lat; S.y = q.y; S.heading = Math.atan2(-q.fx * dir, -q.fz * dir); S.speed = L.CAR.cruise;
        L.updateScenery(S.x, S.z, true);
        held(50); note.lat = lat; note.exploding = !!S.exploding;
        const ceil = L.hwyBoreCeiling(S.x, S.z); note.inBore = ceil !== null; note.roofGap = ceil !== null ? +(ceil - S.y - 3.65).toFixed(2) : null;
      } else if (what === "police") {
        held(120); L.policeStart(null); held(60 * 6); note.chase = !!L.police.active;
      } else if (what === "city") {
        const C = L.streets.cities.ny;
        for (let i = 0; i < 5; i++) L.update(1 / 60);
        const hero = L.ROUTE_LANDMARKS.find(l => l.name === "skyline");
        const n = C.nodes.filter(q => q.signal).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
        const arm = n.arms.find(a => Math.abs(a.dz) > 0.9), r = arm.road, dir = arm.atStart ? -1 : 1, q = {};
        L.stPointAt(r, dir > 0 ? r.len - 22 : 22, dir, r.lo, q);
        const h = Math.atan2(-q.fx, -q.fz), y = L.stSurfaceAt(q.x, q.z);
        window.__hold = () => { L.api.clearStick(); S.x = q.x; S.z = q.z; S.y = y; S.heading = h; S.speed = 0; };
        for (let i = 0; i < 90; i++) { L.update(1 / 60); window.__hold(); }
      } else {
        // close in: stopped on the motorway, the camera posed round the truck at wheel height
        held(60 * 2); L.api.clearStick();
        window.__hold = () => { S.speed = 0; };
        for (let i = 0; i < 60; i++) { L.update(1 / 60); window.__hold(); }
        const ang = { side: Math.PI / 2, front: 0, rear: Math.PI, three: Math.PI / 4 }[what];
        const fx = -Math.sin(S.heading), fz = -Math.cos(S.heading), rx = -fz, rz = fx;
        const D = 17, ca = Math.cos(ang), sa = Math.sin(ang);
        window.__carCam0 = window.__carCam0 || window.carCamera;
        window.carCamera = () => {
          const cam = L.camera;
          cam.position.set(S.x + (fx * ca + rx * sa) * D, S.y + 2.2, S.z + (fz * ca + rz * sa) * D);
          cam.up.set(0, 1, 0); cam.lookAt(S.x, S.y + 1.6, S.z);
        };
        L.update(1 / 60);
        // how it sits: the lowest point of each wheel against the road under it
        const m = L.vehicleModel; m.updateWorldMatrix(true, true);
        const wheels = [];
        // vertex by vertex: this three.js build's Box3 boxes a spun wheel's own box
        const lowY = (w) => { let mn = 1e9; const p3 = new THREE.Vector3(); w.traverse(c => { if (!c.isMesh) return; const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) mn = Math.min(mn, p3.fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld).y); }); return mn; };
        m.traverse(o => { if (/^wheel_/.test(o.name)) wheels.push(+(lowY(o) - S.y).toFixed(3)); });
        note.wheelGap = wheels;
      }
      return { what, ...note, y: +S.y.toFixed(2), sp: +S.speed.toFixed(1) };
    }, v);
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__hold(); window.__paint(); } });
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
