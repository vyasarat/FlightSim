"use strict";
// The race (v164), through the game's own loop, portrait:
//   picker      the track picker: one big card and the way back
//   grid        the start grid from the chase view, the gantry's lamps coming on
//   gridSeat    the same from his seat
//   overtake    mid-race, chase view, him coming past a car
//   overtakeSeat  the same moment from his seat
//   podiumWin   he won: the podium, his car on the top step, the trophy, fireworks
//   podiumLose  he did not: the podium in its order, his car driving on in front
//   world       normal play: his car by the oval, facing it, the flag up
//   afterPodium the first frames after "go back" from a podium: nothing of the race left
//   node scripts/race_renders.js [root] [views...]   -> evidence/race/ (OUT=, VEH= to change)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["picker", "grid", "gridSeat", "overtake", "overtakeSeat", "podiumWin", "podiumLose", "world", "afterPodium"];

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "race");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8232), srv = serve(root, port), browser = await launch();
  const [vw, vh] = (process.env.VP || "820x1180").split("x").map(Number);   // VP=1180x820 for landscape
  const page = await openGame(browser, port, { width: vw, height: vh });
  await page.evaluate((v) => { window.__rVeh = v; }, process.env.VEH || "car");
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.waitForFunction(() => { const s = window.__lp.modelState; return s && ["car", "cybertruck", "corvette"].every(k => s[k] !== "loading"); }, null, { timeout: 120000 }).catch(() => {});
  await page.screenshot({ timeout: 180000 });
  for (const v of views) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state, R = L.race;
      window.__hold = () => {};
      if (window.__carCam0) window.carCamera = window.__carCam0;
      S.sky = 0; S.nightF = 0;
      L.raceReset();
      L.api.setVehicle(window.__rVeh); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      const go = (n, bank, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = bank || 0; S.ctrlPitch = pitch || 0; L.update(1 / 60); } };
      const note = { v };
      if (v === "picker") { L.raceOpenPicker(); return note; }
      if (v === "world") {
        // normal play: his car on the open ground outside the oval, facing it, his own chase camera
        L.api.setView(true);
        const T = R.track, q = T.S[Math.floor(T.n * 0.55)];
        const cx = T.S.reduce((a, p) => a + p.x, 0) / T.n, cz = T.S.reduce((a, p) => a + p.z, 0) / T.n;
        const dx = q.x - cx, dz = q.z - cz, d = Math.hypot(dx, dz);
        S.x = q.x + dx / d * 45; S.z = q.z + dz / d * 45; S.heading = Math.atan2(dx, dz);
        L.updateScenery(S.x, S.z, true);
        S.y = L.terrainEff(S.x, S.z); S.speed = 0;
        for (let i = 0; i < 90; i++) { S.touching = false; L.update(1 / 60); }
        return note;
      }
      if (v === "afterPodium") {
        // straight after "go back" from a podium: normal play, nothing of the race left on screen
        L.api.setView(true); L.rcStartRace("oval");
        for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) go(1, 0, 0);
        for (let i = 0; i < 60 * 3; i++) { S.touching = false; L.update(1 / 60); }
        L.raceExit();
        for (let i = 0; i < 3; i++) { S.touching = false; L.update(1 / 60); }
        note.raceOn = L.raceOn(); note.confetti = typeof confetti !== "undefined" ? confetti.length : -1;
        return note;
      }
      L.api.setView(!v.endsWith("Seat"));
      L.rcStartRace("oval");
      if (v === "grid" || v === "gridSeat") {
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 1.6)), 0, 0);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.phase = R.phase; note.lit = R.lights.filter(m => m.material.color.getHex() === L.TUNE.palette.red).length;
        return note;
      }
      if (v === "overtake" || v === "overtakeSeat") {
        go(60 * 14, 0, 0);    // (out along the lap, clear of the gantry)
        // a car just ahead of him, a lane over; he is quicker and coming past it
        const him = R.him, o = R.racers.find(r => !r.isHim && r.key === "corvette") || R.racers.find(r => !r.isHim);
        for (const r of R.racers) if (r !== him && r !== o) r.s = him.s - 200;
        o.s = him.s + (S.vp && S.vp.monster ? 8 : 18); o.lat = him.lat + (S.vp && S.vp.monster ? (him.lat > 0 ? -8 : 8) : 4.5);   // (the giant: the rival nearer alongside, or its cab hides it) o.v = 30; o.skill = 0.8; him.v = 42;
        // (its own line where it is put, and its wander at the middle of its swing: it holds that lane)
        o.line = o.lat; o.lineT = -o.i / L.RC.ai.wander[0]; o.aim = null; o.aimGo = false;
        go(40, 0, 0.8);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0.8; };
        note.gap = +(o.s - him.s).toFixed(1); note.chase = S.viewChase; note.camUp = +(L.camera.position.y - S.y).toFixed(1); note.camBack = +Math.hypot(L.camera.position.x - S.x, L.camera.position.z - S.z).toFixed(1); note.dl = +(o.lat - him.lat).toFixed(1);
        return note;
      }
      if (v === "podiumWin" || v === "podiumLose") {
        const win = v === "podiumWin";
        for (const r of R.racers) if (!r.isHim) r.skill = win ? 0.8 : 1.2;
        for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) go(1, 0, 0);
        for (let i = 0; i < 60 * (win ? 4.2 : 5.5); i++) { S.touching = false; L.update(1 / 60); }
        // he did not win: on until his car has stopped for its cheer
        for (let i = 0; i < 60 * 15 && !win && !R.podium.onStep && R.him.v > 0.1; i++) { S.touching = false; L.update(1 / 60); }
        note.himV = +R.him.v.toFixed(2);
        note.place = R.him.place; note.top = R.podium && R.podium.top.map(r => r.key);
        return note;
      }
      return note;
    }, v);
    if (process.env.NEAR) Object.assign(info, await page.evaluate(() => {
      const L = window.__lp, T = window.THREE, S0 = L.race.him.mesh.position, S = { x: S0.x, y: S0.y, z: S0.z }, out = [], b = new T.Box3(), mine = new Set();
      L.vehicleModel.traverse(o => mine.add(o));
      L.scene.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return;
        b.setFromObject(o); if (b.isEmpty()) return;
        const c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3());
        if (Math.hypot(c.x - S.x, c.z - S.z) < 6 && sz.length() < 40) out.push({ n: o.name || o.type, p: (o.parent && (o.parent.name || o.parent.type)), mine: mine.has(o), inst: !!o.isInstancedMesh, y: [+(b.min.y - S.y).toFixed(2), +(b.max.y - S.y).toFixed(2)], sz: sz.toArray().map(v => +v.toFixed(1)), col: o.material && o.material.color ? o.material.color.getHexString() : "" });
      });
      return { near: out.slice(0, 30) };
    }));
    if (process.env.RAY) Object.assign(info, await page.evaluate((xy) => {
      const L = window.__lp, T = window.THREE, rc = new T.Raycaster(), [x, y] = xy.split(",").map(Number);
      rc.setFromCamera(new T.Vector2(x, y), L.camera);
      const hit = rc.intersectObjects(L.scene.children, true).slice(0, 3);
      const path = o => { const n = []; for (let p = o; p && n.length < 6; p = p.parent) n.push((p.name || p.type) + (p.userData && Object.keys(p.userData).length ? "{" + Object.keys(p.userData).slice(0, 4).join(",") + "}" : "")); return n.join("<"); };
      return { ray: hit.map(h => [+h.distance.toFixed(1), path(h.object), h.object.material && h.object.material.color ? h.object.material.color.getHexString() : ""]), cam: [L.camera.position.x, L.camera.position.y, L.camera.position.z].map(v => Math.round(v)) };
    }, process.env.RAY));
    if (process.env.PROBE) Object.assign(info, await page.evaluate(() => {
      const L = window.__lp, S = L.state, c = L.camera.position, ey = S.y + 1.6, near = [];
      L.forEachSolid(b => { if (Math.hypot(b.x - c.x, b.z - c.z) < Math.hypot(b.hw, b.hd) + 6) near.push([L.solidKind(b), +b.x.toFixed(1), +b.z.toFixed(1), +b.y0.toFixed(1), +b.y1.toFixed(1), +b.hw.toFixed(1), +b.hd.toFixed(1), L.solidTest(b, c.x, c.y, c.z, 0.3)]); });
      const rc = window.__lp.race.racers.map(r => [r.key, +(Math.hypot(r.mesh.position.x - c.x, r.mesh.position.z - c.z)).toFixed(1)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
      return { cam: [c.x, c.y - S.y, c.z].map(v => +v.toFixed(1)), sight: window.solidSight(S.x, ey, S.z, c.x, c.y, c.z, 0.5, ["wall", "building", "rock", "pillar", "tree", "structure"]), near: near.slice(0, 6), racers: rc };
    }));
    if (process.env.HIDE) Object.assign(info, await page.evaluate((h) => {
      const L = window.__lp, R = L.race, out = {};
      if (h === "cabin") { const c = typeof car !== "undefined" && car.cabin; out.cabin = !!c; out.cabinVis = c ? c.visible : null; if (c) c.visible = false; window.__hold = () => { if (car.cabin) car.cabin.visible = false; }; }
      if (h === "where") { const T = window.THREE, b = new T.Box3(), q = {}; out.where = R.racers.map(r => { r.mesh.updateMatrixWorld(true); b.setFromObject(r.mesh); L.rcPoint(r.s, r.lat, q); return [r.key, r.isHim ? "HIM" : "", +(b.min.y - q.y).toFixed(2), +(b.max.y - q.y).toFixed(2), +(r.mesh.userData.rcLift || 0).toFixed(2), r.mesh.children.length]; }); }
      if (h === "low") { const T = window.THREE, b = new T.Box3(), q = {}, m = L.vehicleModel; m.updateMatrixWorld(true); L.rcPoint(R.him.s, R.him.lat, q); out.low = []; out.lift = R.himLift;
        m.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isSprite) return; let vis = true; for (let p = o; p && p !== m.parent; p = p.parent) if (!p.visible) vis = false; b.setFromObject(o); out.low.push([o.name || o.type, vis, o.material && o.material.visible, +(b.min.y - q.y).toFixed(2), +(b.max.y - q.y).toFixed(2), o.parent && (o.parent.name || o.parent.type)]); });
        out.low.sort((a, b) => a[3] - b[3]); out.low = out.low.slice(0, 8); }
      if (h === "parts") { const T = window.THREE, b = new T.Box3(), c = new T.Vector3(), r = R.racers.find(r => r.key === "car" && !r.isHim), hp = R.him.mesh.position, rp = r.mesh.position; out.parts = []; r.mesh.updateMatrixWorld(true);
        r.mesh.traverse(o => { if (!o.isMesh) return; b.setFromObject(o); b.getCenter(c); out.parts.push([o.name || "-", o.visible, o.matrixAutoUpdate, o.frustumCulled, +Math.hypot(c.x - rp.x, c.z - rp.z).toFixed(1), +Math.hypot(c.x - hp.x, c.z - hp.z).toFixed(1), o.material && o.material.color ? o.material.color.getHexString() : "", o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count : 0, !!(o.material && o.material.onBeforeCompile) ]); }); }
      if (h.startsWith("only:")) { const k = h.slice(5); for (const r of R.racers) if (!r.isHim && r.mesh && r.key !== k) r.mesh.visible = false; window.__hold = () => { for (const r of R.racers) if (!r.isHim && r.mesh && r.key !== k) r.mesh.visible = false; }; }
      if (h === "racers") { for (const r of R.racers) if (!r.isHim && r.mesh) r.mesh.visible = false; }
      return out;
    }, process.env.HIDE));
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
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
