"use strict";
// DAD MODE (v147), rendered through the game's own loop, to LOOK at beside the film
// stills (reference/topgun/, gitignored, never committed). One sortie flown by the
// pilot in scripts/dad_autopilot.js, LANDSCAPE 1180x820 (the iPad on its side, the
// film's shape), captured at its moments; then his own game, PORTRAIT 820x1180, with
// nothing of dad mode in it: the picker with its dim key, and the valley and the
// bunker as he sees them in his own aeroplane.
//   node scripts/dadmode_renders.js [root]     -> evidence/dad/ (OUT= to change; PORT=, default 8317)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");
const pilot = require("./dad_autopilot.js");

async function shot(page, out, name, info) {
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file, timeout: 900000 });
  console.log(file + "  " + JSON.stringify(info || {}));
}

async function render(root) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "dad");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8317), srv = serve(root, port), browser = await launch();
  const errors = [];

  // ---------------- dad mode, landscape ----------------
  const page = await openGame(browser, port, { width: 1180, height: 820, errors });
  await page.evaluate(`(${pilot.toString()})()`);
  // the pad and the menu, over the picker
  await page.evaluate(() => { const L = window.__lp; document.getElementById("screenVehicle").classList.remove("hiddenS"); L.dadKeyTap(); L.dadPadPress("1"); L.dadPadPress("9"); for (let i = 0; i < 2; i++) window.__paint(); });
  await shot(page, out, "00-pad", { note: "the number pad over the picker, two digits in" });
  await page.evaluate(() => { const L = window.__lp; L.dadPadPress("8"); L.dadPadPress("6"); for (let i = 0; i < 2; i++) window.__paint(); });
  await shot(page, out, "01-menu", { note: "the right code: the dad menu" });
  // in
  await page.evaluate(() => { const L = window.__lp; document.getElementById("dadMenu").remove(); L.dad.menu = false; L.dadEnter(); for (let i = 0; i < 2; i++) window.__paint(); });

  // advance the sortie with the pilot until `until()` (or a cap), then paint
  const advance = (until, cap) => page.evaluate(([u, c]) => {
    const L = window.__lp, P = window.__dadPilot, m = () => L.dad.m;
    const f = new Function("L", "P", "m", "S", "return (" + u + ");");
    for (let i = 0; i < c * 60 && !f(L, P, m(), L.state); i++) P.step(1 / 60);
    const M = m();
    return { t: +P.t.toFixed(1), phase: P.phase, agl: +L.dadAgl().toFixed(0), pitch: +L.state.pitch.toFixed(0), g: +M.g.toFixed(1), health: M.health,
             clock: +M.clock.toFixed(0), sams: M.samsLaunched, chasing: L.dad.world.sams.filter(s => s.alive && s.target === "jet").length,
             flares: M.flaresUsed, hits: M.hits, plant: M.plant, over: M.over, result: M.result, spotErr: M.spotErr === undefined ? null : +M.spotErr.toFixed(1) };
  }, [until, cap]);
  // paint the game's own camera (chase or cockpit)
  const paintView = (chase) => page.evaluate((c) => { const L = window.__lp; L.api.setView(c); for (let i = 0; i < 2; i++) window.__paint(); }, chase);
  // a vantage: step one frame, then put the camera somewhere and draw it by hand
  const vantage = (code) => page.evaluate((src) => {
    const L = window.__lp, S = L.state, cam = L.camera;
    L.api.setView(true);           // the vantages are outside the jet: no cockpit streaks
    window.__paint();
    new Function("L", "S", "cam", "THREE", src)(L, S, cam, THREE);
    cam.updateMatrixWorld(true);
    L.renderer.render(L.scene, cam);
  }, code);

  let i = await advance("P.t > 3.2", 10);
  await vantage(`const f = L.dadFwd(new THREE.Vector3()); cam.up.set(0,1,0);
    cam.position.set(S.x - f.x * 30, S.y + 5, S.z - f.z * 30); cam.lookAt(S.x + f.x * 320, S.y + 150, S.z + f.z * 320);`);
  await shot(page, out, "02-cruise-missiles", { ...i, note: "3 s in: the cruise missiles streaking overhead, low in the mouth of the valley (t014, t122)" });
  i = await advance("P.t > 6.5", 10);
  await paintView(true);
  await shot(page, out, "03-valley-low-chase", { ...i, note: "early in the valley, chase (t122, t248)" });
  i = await advance("P.t > 16", 20);
  await vantage(`const f = L.dadFwd(new THREE.Vector3()); cam.up.set(0,1,0);
    const sx = Math.cos(S.heading), sz = -Math.sin(S.heading);
    cam.position.set(S.x + f.x * 90 + sx * 30, S.y + 10, S.z + f.z * 90 + sz * 30); cam.lookAt(S.x, S.y + 2, S.z);`);
  await shot(page, out, "04-valley-front", { ...i, note: "head-on and low: the jet down in the snow valley, the walls, the pines (t348)" });
  i = await advance("P.t > 24", 20);
  await paintView(true);
  await shot(page, out, "05-valley-chase", { ...i, note: "deep in the valley, chase, HUD (t122)" });
  await paintView(false);
  await shot(page, out, "06-valley-cockpit", { ...i, note: "deep in the valley, the pilot's view, HUD (t113)" });
  await page.evaluate(() => window.__lp.api.setView(true));
  // the moment a stream crosses his nose: tracer heads inside 25 degrees of it
  await page.evaluate(() => { window.__ahead = () => { const L = window.__lp, S = L.state, T = L.dad.world.tracer, f = L.dadFwd(new THREE.Vector3()); let n = 0;
    for (let k = 0; k < T.n; k++) { if (T.life[k] <= 0) continue; const rx = T.pos[k * 3] - S.x, ry = T.pos[k * 3 + 1] - S.y, rz = T.pos[k * 3 + 2] - S.z, a = rx * f.x + ry * f.y + rz * f.z;
      if (a > 40 && a < 700 && Math.hypot(rx - f.x * a, ry - f.y * a, rz - f.z * a) < a * 0.45) n++; } return n; }; });
  i = await advance("m.gunsFiring && P.t > 26 && window.__ahead() > 5", 30);
  await paintView(true);
  await shot(page, out, "07-guns-chase", { ...i, note: "v148: the guns opening up -- tracer streams across his nose, black flak round him, chase" });
  await paintView(false);
  await shot(page, out, "07b-guns-cockpit", { ...i, note: "v148: the same from the seat, through the canopy and the HUD glass" });
  await page.evaluate(() => window.__lp.api.setView(true));
  await vantage(`const g = L.dad.world.guns.filter(g => g.alive).sort((a, b) => Math.hypot(a.x - S.x, a.z - S.z) - Math.hypot(b.x - S.x, b.z - S.z))[0], cz = L.vlCenterZ(g.x), side = Math.sign(cz - g.z) || 1; cam.up.set(0,1,0);
    const px = g.x + 40, pz = g.z + side * 110; cam.position.set(px, Math.max(g.y + 30, L.terrainEff(px, pz) + 15), pz); cam.lookAt(g.x, g.y + 3, g.z);`);
  await shot(page, out, "07d-gun-close", { ...i, note: "v148: a gun close, from across the valley -- the mount on its ledge, its barrels, the muzzle flash and its stream" });
  i = await advance("P.phase === 'popup'", 40);
  i = await advance("P.phase === 'dive' && m.spotErr !== undefined && m.spotErr < 30", 30);
  await paintView(true);
  await shot(page, out, "08-dive-chase", { ...i, note: "rolled in: the bowl, the needles, the bunker under the box (t324, t344)" });
  i = await advance("P.dropped >= 1", 10);
  await paintView(false);
  await page.evaluate(() => window.__lp.api.setView(true));
  await shot(page, out, "09-dive-cockpit", { ...i, note: "the nose on the vent, the first bomb away: the box, the spot, the miss distance (t332, t344)" });
  i = await advance("m.hatch", 15);
  i = await advance("m.plant", 5);
  const plantT = i.t;
  i = await advance("P.t > " + (plantT + 1.0), 5);
  await vantage(`const v = L.vl.vent; cam.up.set(0,1,0);
    cam.position.set(v.x + 430, v.y + 150, v.z + 150); cam.lookAt(v.x, v.y + 70, v.z);`);
  await shot(page, out, "10a-explosion-1s", { ...i, note: "v148: 1 s after the second hit -- the stacked bursts going up, wreckage thrown out (t368)" });
  i = await advance("P.t > " + (plantT + 2.5), 5);
  await vantage(`const v = L.vl.vent; cam.up.set(0,1,0);
    cam.position.set(v.x + 430, v.y + 150, v.z + 150); cam.lookAt(v.x, v.y + 90, v.z);`);
  await shot(page, out, "10-explosion", { ...i, note: "2.5 s after the second hit, from the bowl's east rim: the column and the snow thrown out across the bowl (t368)" });
  i = await advance("P.t > " + (plantT + 3.5), 5);
  const behind = i;
  await vantage(`const v = L.vl.vent; const f = L.dadFwd(new THREE.Vector3()); cam.up.set(0,1,0);
    cam.position.set(S.x - f.x * 3, S.y + 3.5, S.z - f.z * 3); cam.lookAt(v.x, v.y + 80, v.z);`);
  await shot(page, out, "11-explosion-behind", { ...behind, note: "3 s after, from the jet looking back down at it (t476, t448)" });
  // a missile on his tail, close enough that the chase camera has it in the frame
  i = await advance("m.plantT > 3.5 && L.dad.world.sams.some(s => s.alive && s.t > 1.5 && Math.hypot(s.x - S.x, s.y - S.y, s.z - S.z) < 1500)", 15);
  // on the line from the missile through the jet, past the jet: the jet big in front,
  // the missile and its rope coming up behind it
  await vantage(`const f = L.dadFwd(new THREE.Vector3()); cam.up.set(0,1,0);
    const m = L.dad.world.sams.filter(s => s.alive && s.t > 1.5).sort((a, b) => Math.hypot(a.x - S.x, a.z - S.z) - Math.hypot(b.x - S.x, b.z - S.z))[0] || { x: S.x - f.x * 300, y: S.y - 30, z: S.z - f.z * 300 };
    const dx = S.x - m.x, dy = S.y - m.y, dz = S.z - m.z, dl = Math.hypot(dx, dy, dz) || 1, ux = dx / dl, uy = dy / dl, uz = dz / dl;
    let px = -uz, pz = ux; const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    cam.position.set(S.x + ux * 38 + px * 12, S.y + uy * 38 + 7, S.z + uz * 38 + pz * 12);
    cam.lookAt(S.x - ux * dl * 0.3, S.y - uy * dl * 0.3, S.z - uz * dl * 0.3);`);
  await shot(page, out, "12-climbout-chase", { ...i, note: "v148: the climb out from ahead of the jet looking back -- a missile on his tail, its trail and motor (t384, t420)" });
  i = await advance("L.dad.world.flares.some(f => f.alive && f.t > 0.5) && L.dad.world.sams.some(s => s.alive && s.t > 2)", 15);
  await vantage(`const f = L.dadFwd(new THREE.Vector3()); cam.up.set(0,1,0);
    const sx = Math.cos(S.heading), sz = -Math.sin(S.heading);
    const live = L.dad.world.sams.filter(s => s.alive);
    let mx = S.x, my = S.y, mz = S.z; for (const s of live) { mx += s.x; my += s.y; mz += s.z; } mx /= live.length + 1; my /= live.length + 1; mz /= live.length + 1;
    cam.position.set(mx + sx * 520, my - 160, mz + sz * 520); cam.lookAt(mx, my, mz);`);
  await shot(page, out, "13-flares", { ...i, note: "flares off the jet, the missiles' white trails curling after them (t432, t444, t482)" });
  i = await advance("L.dad.world.sams.some(s => s.alive && s.t > 2.6)", 10);
  await vantage(`const s = L.dad.world.sams.filter(s => s.alive && s.t > 2.6)[0] || L.dad.world.sams[0];
    const v = Math.hypot(s.vx, s.vy, s.vz) || 1, ux = s.vx / v, uy = s.vy / v, uz = s.vz / v;
    let px = -uz, pz = ux; const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    cam.up.set(0,1,0); cam.position.set(s.x + ux * 20 + px * 38, s.y + uy * 20 + 8, s.z + uz * 20 + pz * 38); cam.lookAt(s.x - ux * 45, s.y - uy * 45, s.z - uz * 45);`);
  await shot(page, out, "13b-missile-close", { ...i, note: "v148: beside a SAM in flight -- the white-hot motor, the thick corkscrewing trail (t384, t432)" });
  i = await advance("P.t > " + (plantT + 8) + " || m.over", 6);
  await vantage(`const v = L.vl.vent; cam.up.set(0,1,0);
    cam.position.set(S.x + (S.x - v.x) * 0.15, S.y + 60, S.z + (S.z - v.z) * 0.15); cam.lookAt(v.x, v.y + 300, v.z);`);
  await shot(page, out, "10c-column-8s", { ...i, note: "v148: 8 s after, from behind the climbing jet looking back -- the column over the peaks, the snow cloud across the bowl floor" });
  i = await advance("m.card", 40);
  for (let k = 0; k < 2; k++) await page.evaluate(() => window.__paint());
  await shot(page, out, "14-results", { ...i, note: "the results card" });
  // a failure card, too: a fresh sortie flown into the first wall hands-off
  await page.evaluate(() => { const L = window.__lp; L.dadStart(); L.api.clearStick(); for (let k = 0; k < 60 * 8 && !L.dad.m.card; k++) L.update(1 / 60); for (let k = 0; k < 2; k++) window.__paint(); });
  await shot(page, out, "15-results-fail", { note: "a crash: the failure card" });
  const dadErr = errors.slice();
  await page.close();

  // ---------------- his game, portrait: nothing of dad mode in it ----------------
  const kp = await openGame(browser, port, { width: 820, height: 1180, errors });
  await kp.evaluate(() => { document.getElementById("screenVehicle").classList.remove("hiddenS"); for (let k = 0; k < 2; k++) window.__paint(); });
  await kp.screenshot({ timeout: 900000 });
  await shot(kp, out, "20-picker", { note: "his picker: the dim key in the bottom-left corner" });
  const kidAt = (veh, x, agl, back, chase) => kp.evaluate(([veh, x, agl, back, chase]) => {
    const L = window.__lp, S = L.state;
    L.api.skipScreens(); L.api.setVehicle(veh); L.api.placeOnRunway(); L.api.setView(chase);
    const s = L.vlCenterSlope(x);
    S.x = x; S.z = L.vlCenterZ(x); S.y = L.terrainEff(S.x, S.z) + agl; S.heading = Math.atan2(1, s);
    S.phase = "AIRBORNE"; S.speed = S.vp.cruiseSpeed; S.pitch = 0; S.bank = 0; S.liftoffTimer = 0; S.maxAglSinceLiftoff = 1e9;
    // his chase camera eases after him: let it arrive (a teleport leaves it behind)
    for (let k = 0; k < 150; k++) { L.api.clearStick(); L.update(1 / 60); }
    for (let k = 0; k < 2; k++) window.__paint();
    return { kind: L.vehKind(), dad: L.dadActive(), x: Math.round(S.x), agl: Math.round(S.y - L.terrainEff(S.x, S.z)), exploding: S.exploding,
             dadDom: document.querySelectorAll("#dadHud,#dadGrey,#dadCanopy,#dadCard,#dadPad,#dadMenu").length };
  }, [veh, x, agl, back, chase]);
  let k = await kidAt("fighter", -3500, 70, 0, true);
  await shot(kp, out, "21-his-valley", { ...k, note: "his fighter in the valley, his own HUD, nothing of dad mode" });
  k = await kidAt("prop", -10350, 90, 0, true);
  await shot(kp, out, "22-his-bowl", { ...k, note: "his prop coming into the bowl: the needles and the bunker, whole" });
  k = await kidAt("prop", -10520, 40, 0, false);
  await shot(kp, out, "23-his-bunker-seat", { ...k, note: "the bunker from his seat, low over the bowl" });
  await kp.evaluate(() => { const L = window.__lp, S = L.state, cam = L.camera;
    // the plane parked out of shot at the vantage, so the ground, sky and haze are built round it
    S.x = -1900; S.z = -1250; S.y = 300; S.heading = Math.PI / 2; S.pitch = 0; S.bank = 0;
    for (let k = 0; k < 30; k++) { L.api.clearStick(); L.update(1 / 60); S.x = -1900; S.z = -1250; S.y = 300; }
    window.__paint(); cam.up.set(0, 1, 0);
    cam.position.set(-1900, 260, -1250); cam.lookAt(-3300, 150, -1450); cam.updateMatrixWorld(true);
    if (L.vehicleModel) L.vehicleModel.visible = false;
    L.renderer.render(L.scene, cam); });
  await shot(kp, out, "24-his-mouth", { note: "the valley's mouth seen from the east, out over the range" });
  // the bunker close and low, as the film shows it (t312): his prop parked out of shot
  await kp.evaluate(() => { const L = window.__lp, S = L.state, cam = L.camera, b = L.vlBunkerAt(), v = L.vl.vent;
    S.x = b.x + 60; S.z = b.z + 90; S.y = L.vl.base + 40; S.heading = Math.PI / 2; S.pitch = 0; S.bank = 0;
    for (let k = 0; k < 30; k++) { L.api.clearStick(); L.update(1 / 60); S.x = b.x + 60; S.z = b.z + 90; S.y = L.vl.base + 40; }
    window.__paint(); cam.up.set(0, 1, 0);
    cam.position.set(b.x + 26, L.vl.base + 13, b.z + 30); cam.lookAt(v.x, v.y - 2.5, v.z); cam.updateMatrixWorld(true);
    if (L.vehicleModel) L.vehicleModel.visible = false;
    L.renderer.render(L.scene, cam); });
  await shot(kp, out, "25-his-bunker-close", { note: "the bunker close and low in its snowfield: the block, the tilted vent's grille, the track to its door (t312)" });
  console.log("errors:", JSON.stringify(dadErr.concat(errors).slice(0, 12)));
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root));
}
