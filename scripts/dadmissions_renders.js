"use strict";
// DAD MODE'S MISSIONS (v154 on), rendered through the game's own loop at their key moments,
// LANDSCAPE 1180x820 (the iPad on its side), plus the mission list in portrait too.
//   node scripts/dadmissions_renders.js [root] [mission ...]   -> evidence/dadmissions/ (OUT= to change; PORT=, default 8318)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

async function shot(page, out, name, info) {
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file, timeout: 900000 });
  console.log(file + "  " + JSON.stringify(info || {}));
}

async function render(root, only) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "dadmissions");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8318), srv = serve(root, port), browser = await launch();
  const errors = [];
  const page = await openGame(browser, port, { width: 1180, height: 820, errors });
  const paint = (n) => page.evaluate((n) => { for (let i = 0; i < (n || 2); i++) window.__paint(); }, n);
  const view = (chase) => page.evaluate((c) => { window.__lp.api.setView(c); window.__lp.dad.cam = null; window.__lp.update(1 / 60); for (let i = 0; i < 2; i++) window.__paint(); }, chase);
  // step the sortie with a stick program `prog` (source of a function (L, S, m) -> {bank, pitch} or null) until `until`
  const fly = (prog, until, cap) => page.evaluate(([p, u, c]) => {
    const L = window.__lp, S = L.state;
    const pf = new Function("L", "S", "m", "return (" + p + ")(L, S, m);"), uf = new Function("L", "S", "m", "return (" + u + ");");
    for (let i = 0; i < c * 60 && !uf(L, S, L.dad.m); i++) {
      const st = pf(L, S, L.dad.m);
      if (st) L.api.setStick(st.bank, st.pitch); else L.api.clearStick();
      L.update(1 / 60);
    }
    L.api.clearStick();
    const m = L.dad.m;
    return { t: +m.t.toFixed(1), x: Math.round(S.x), y: +S.y.toFixed(1), over: m.over, result: m.result, why: m.why };
  }, [prog, until, cap]);
  const vantage = (code) => page.evaluate((src) => {
    const L = window.__lp, S = L.state, cam = L.camera;
    L.api.setView(true); window.__paint();
    // an outside camera: the HUD's target mark was placed for his camera, not this one
    for (const e of document.querySelectorAll(".dadTgt, .dadTgtArrow")) e.style.display = "none";
    new Function("L", "S", "cam", "THREE", src)(L, S, cam, THREE);
    cam.updateMatrixWorld(true);
    L.renderer.render(L.scene, cam);
  }, code);
  const enter = (id) => page.evaluate((id) => { const L = window.__lp; document.getElementById("screenVehicle").classList.remove("hiddenS");
    L.dadKeyTap(); for (const k of String(L.TUNE.dad.code)) L.dadPadPress(k);
    const c = document.querySelector('#dadMenu .dadCard[data-mission="' + id + '"]'); const b = c.querySelector(".dadBtn.go");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    for (let i = 0; i < 2; i++) window.__paint(); return L.dad.mis && L.dad.mis.id; }, id);

  // ---------------- the list ----------------
  if (!only.length || only.includes("list")) {
    await page.evaluate(() => { const L = window.__lp; document.getElementById("screenVehicle").classList.remove("hiddenS"); L.dadKeyTap(); for (const k of String(L.TUNE.dad.code)) L.dadPadPress(k); for (let i = 0; i < 2; i++) window.__paint(); });
    await shot(page, out, "00-list", { note: "the dad menu: the mission list" });
    await page.evaluate(() => { const l = document.querySelector("#dadMenu .dadList"); l.scrollTop = l.scrollHeight; window.__paint(); });
    await shot(page, out, "00b-list-bottom", { note: "the list scrolled to its end" });
    await page.evaluate(() => { const b = [...document.querySelectorAll("#dadMenu .dadBtn")].find(x => x.textContent === "EXIT"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
  }

  // ---------------- dambusters ----------------
  if (!only.length || only.includes("dam")) {
    await enter("dam");
    // the hand: hold the arm's line at 60 ft, let go when the panels are green, then up over the dam
    const hand = `(L, S, m) => { const P = L.TUNE.dad.air.lancaster, wl = L.TUNE.waterLevel, D = L.dad.world.dam;
      const ax = S.x - 400, az = L.dadDamLineZ(Math.max(ax, D.x + 30));
      const eh = Math.atan2(Math.sin(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading), Math.cos(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading));
      const up = m.bombsUsed > 0, wantY = up ? D.crest + 30 : wl + 60 / 3.281;
      const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (wantY - S.y) * 0.9 - S.pitch * 2.2));
      if (!up && m.window && m.window.all && L.dadBombCan() && S.x < 100) L.dadDropBomb();
      return { bank: Math.max(-1, Math.min(1, -eh * 3)), pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / P.pitchRateDeg), 1 / P.pitchExpo) }; }`;
    let i = await fly(hand, "S.x < 250", 30);
    await view(true); await shot(page, out, "01-dam-run-chase", { ...i, note: "night: the bomber low over the lake, the two lamps' beams, the dam and its towers ahead" });
    i = await fly(hand, "S.x < -120 || m.bombsUsed > 0", 20);
    await view(false); await shot(page, out, "02-dam-run-seat", { ...i, note: "from the seat on the run: the three panels, the lamps' call, the dam marked" });
    await view(true); await shot(page, out, "02b-dam-run-chase", { ...i, note: "the same from behind: the spots together on the water" });
    const side = `cam.up.set(0,1,0); cam.position.set(S.x - 4, L.TUNE.waterLevel + 14, S.z - 95); cam.lookAt(S.x - 4, L.TUNE.waterLevel + 9, S.z);`;
    await vantage(side);
    await shot(page, out, "03-dam-lamps-side", { ...i, note: "side-on at 60 ft: the two beams meet in one spot on the water (the gauge's dots together)" });
    // the same instant lifted to 80 ft and lowered to 45 ft: the spots part, crossed over and apart under
    for (const [ft, tag, note] of [[80, "03b-dam-lamps-80ft", "at 80 ft: the beams have crossed before the water, two spots"], [45, "03c-dam-lamps-45ft", "at 45 ft: the beams have not met yet, two spots"]]) {
      const keep = await page.evaluate((ft) => { const L = window.__lp, S = L.state, y = S.y; S.y = L.TUNE.waterLevel + ft / 3.281; L.dad.mis.step(0); L.dad.mis.pose(); return y; }, ft);
      await vantage(side);
      await shot(page, out, tag, { ft, note });
      await page.evaluate((y) => { const L = window.__lp; L.state.y = y; L.dad.mis.step(0); L.dad.mis.pose(); }, keep);
    }
    i = await fly(hand, "m.bombFly && m.bombFly.splashes >= 2", 15);
    await vantage(`const W = L.dad.world, b = W.bomb.position, D = W.dam; cam.up.set(0,1,0); cam.position.set(b.x + 70, b.y + 22, b.z - 75); cam.lookAt((b.x + D.x) / 2, b.y, (b.z + D.zc) / 2);`);
    await shot(page, out, "04-bomb-skipping", { ...i, note: "the bomb skipping across the water toward the wall, its splashes behind it" });
    i = await fly(hand, "m.breached && m.torrent < L.TUNE.dad.dam.torrentFor - 1.0", 20);
    await vantage(`const D = L.dad.world.dam; cam.up.set(0,1,0); cam.position.set(D.x + 520, 60, D.zc + 160); cam.lookAt(D.x, 70, D.zc + 170);`);
    await shot(page, out, "05-water-column", { ...i, note: "it went off at depth against the wall 2.6 s ago: the column of water, the wall just breached" });
    i = await fly(hand, "m.breached && m.torrent < 34", 20);
    await vantage(`const D = L.dad.world.dam; cam.up.set(0,1,0); cam.position.set(D.x - 230, L.TUNE.waterLevel + 30, D.zc); cam.lookAt(D.x, L.TUNE.waterLevel + 6, D.zc);`);
    await shot(page, out, "06-breach", { ...i, note: "the breach from downstream: the middle of the wall gone, the torrent pouring out" });
    i = await fly(hand, "m.card", 15);
    await paint(); await shot(page, out, "07-dam-card", { ...i, note: "the results card" });
    await page.evaluate(() => window.__lp.dadExit());
    // the list again: this session's record on the Dambusters card
    await page.evaluate(() => { const L = window.__lp; document.getElementById("screenVehicle").classList.remove("hiddenS"); L.dadKeyTap(); for (const k of String(L.TUNE.dad.code)) L.dadPadPress(k);
      const c = document.querySelector('#dadMenu .dadCard[data-mission="dam"]'); c.scrollIntoView(); for (let i = 0; i < 2; i++) window.__paint(); });
    await shot(page, out, "08-list-record", { note: "the list after a sortie: the Dambusters card's session record" });
  }
  // ---------------- the doolittle raid ----------------
  if (!only.length || only.includes("doolittle")) {
    await enter("doolittle");
    // the hand: hold the deck, ease up off the bow, then on to target 0 at 1,500 ft, drop on the ring
    const dl = `(L, S, m) => { const P = L.TUNE.dad.air.b25, wl = L.TUNE.waterLevel, W = L.dad.world;
      if (m.phase !== "air") return null;
      const vs = L.dadDlStall(), t = W.targets.find(x => !x.hit) || W.targets[0];
      const early = m.t - m.offBow.t < 12;
      const wantP = early ? (S.speed > vs * 1.3 ? 7 : 2) : null;
      let q;
      if (wantP !== null) q = (wantP - S.pitch) * 2;
      else { const near = Math.hypot(t.x - S.x, t.z - S.z) < 5000; const wantY = wl + (near ? 457 : 45); q = (wantY - S.y) * 0.4 - S.pitch * 2; }
      q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, q));
      const ax = t.x, az = Math.min(S.z - 600, t.z + 2500 > S.z ? S.z - 600 : t.z + 2500);
      const eh = Math.atan2(Math.sin(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading), Math.cos(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading));
      if (L.dadBombCan() && L.dadDlOnTarget()) L.dadDropBomb();
      return { bank: early ? 0 : Math.max(-1, Math.min(1, -eh * 3)), pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / P.pitchRateDeg), 1 / P.pitchExpo) }; }`;
    let i = await fly(dl, "m.t > 1.5", 3);
    await view(true); await shot(page, out, "10-dl-deck-chase", { ...i, note: "on the deck: the bomber on its line, the island to starboard, the flagman winding his flag, the squadron packed aft" });
    await vantage(`const C = L.dad.world.carrier; cam.up.set(0,1,0); cam.position.set(C.x - 120, C.y + 45, C.z - 200); cam.lookAt(C.x, C.y, C.z + 20);`);
    await shot(page, out, "10b-dl-carrier", { ...i, note: "the carrier from ahead and to port: sixteen bombers on a deck never meant for them" });
    i = await fly(dl, "m.phase === 'air'", 30);
    i = await fly(dl, "m.offBow && m.t - m.offBow.t > 1.2", 3);
    await vantage(`const C = L.dad.world.carrier; cam.up.set(0,1,0); cam.position.set(S.x - 70, S.y + 4, S.z + 10); cam.lookAt(S.x, S.y - 3, S.z - 20);`);
    await shot(page, out, "11-dl-off-the-bow", { ...i, note: "off the bow: she sinks toward the sea before she climbs, the carrier behind" });
    i = await fly(dl, "m.t - m.offBow.t > 20", 25);
    await view(true); await shot(page, out, "12-dl-wave-top", { ...i, note: "wave-top over the sea toward the coast" });
    // the bomb run, lined up as the checks do: 4.5 km north of the docks at 1,500 ft, then down the line by stick
    const line = (i) => page.evaluate((i) => { const L = window.__lp, S = L.state, m = L.dad.m, W = L.dad.world, t = W.targets[i];
      m.flaps = false; W.body.userData.gear.visible = false; S.x = t.x; S.z = t.z + 4500; S.y = L.TUNE.waterLevel + 457; S.heading = 0; S.pitch = 0; S.bank = 0; S.speed = 105; L.dad.cam = null; }, i);
    const run = `(L, S, m) => { const P = L.TUNE.dad.air.b25, wl = L.TUNE.waterLevel, W = L.dad.world, t = W.targets.find(x => !x.hit);
      const ax = t ? t.x : S.x, az = S.z - 600, a = Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading, eh = Math.atan2(Math.sin(a), Math.cos(a));
      const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (wl + 457 - S.y) * 0.5 - S.pitch * 2));
      if (L.dadBombCan() && L.dadDlOnTarget() && m.bombsUsed <= m.hits && !L.dad.world.bombsLive.length) L.dadDropBomb();
      return { bank: Math.max(-1, Math.min(1, -eh * 3)), pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / P.pitchRateDeg), 1 / P.pitchExpo) }; }`;
    await line(0);
    i = await fly(run, "m.pip && L.dad.world.pip.visible && Math.hypot(m.pip.x - L.dad.world.targets[0].x, m.pip.z - L.dad.world.targets[0].z) < 260", 60);
    await view(false); await shot(page, out, "13-dl-bomb-run-seat", { ...i, note: "from the bombardier's seat at 1,500 ft: the green ring sliding up to the docks, flak" });
    await view(true); await shot(page, out, "13b-dl-bomb-run-chase", { ...i, note: "the same from behind" });
    i = await fly(run, "m.hits >= 1 && L.dad.world.bombsLive.length === 0", 40);
    i = await fly(run, "false", 0.8);
    await vantage(`const t = L.dad.world.targets.find(x => x.hit); cam.up.set(0,1,0); cam.position.set(t.x + 170, t.y + 80, t.z + 230); cam.lookAt(t.x, t.y + 15, t.z);`);
    await shot(page, out, "14-dl-target-hit", { ...i, note: "the docks hit: rubble and fire, smoke climbing" });
    // the second target the same way, then on west to the end
    await line(1);
    i = await fly(run, "m.hits >= 2 && L.dad.world.bombsLive.length === 0", 60);
    const west = `(L, S, m) => { const P = L.TUNE.dad.air.b25, wl = L.TUNE.waterLevel, a = Math.PI / 2 - S.heading, eh = Math.atan2(Math.sin(a), Math.cos(a));
      const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (wl + 457 - S.y) * 0.5 - S.pitch * 2));
      return { bank: Math.max(-1, Math.min(1, -eh * 3)), pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / P.pitchRateDeg), 1 / P.pitchExpo) }; }`;
    i = await fly(west, "m.card", 120);
    await paint(); await shot(page, out, "15-dl-card", { ...i, note: "the results card" });
    await page.evaluate(() => window.__lp.dadExit());
  }
  // ---------------- apollo 11 ----------------
  if (!only.length || only.includes("apollo")) {
    await enter("apollo");
    // the hand once it is P66: to the clear ground, descending as it closes, then down at 2 ft/s
    const ap = `(L, S, m) => { const A = L.TUNE.dad.apollo; if (m.mode !== "P66") return null;
      const ft = L.dadApAgl() * 3.281, dx = A.clear.x - S.x, dz = A.clear.z - S.z, d = Math.hypot(dx, dz);
      const vw = Math.min(12, d * 0.07), wx = d > 0.1 ? dx / d * vw : 0, wz = d > 0.1 ? dz / d * vw : 0;
      const tx = Math.atan2((wx - m.vx) * 0.6, A.g) * 180 / Math.PI, tz = Math.atan2((wz - m.vz) * 0.6, A.g) * 180 / Math.PI;
      const fx = -Math.sin(S.heading), fz = -Math.cos(S.heading), rx = Math.cos(S.heading), rz = -Math.sin(S.heading);
      const over = d < 12 && Math.hypot(m.vx, m.vz) * 3.281 < 2;
      const want = !over ? Math.round(Math.max(-12, Math.min(4, (Math.min(300, 40 + d * 0.6) - ft) / 5))) : ft > 60 ? -8 : ft > 20 ? -4 : -2;
      if (m.rod < want) L.dadApRod(1); else if (m.rod > want) L.dadApRod(-1);
      return { bank: Math.max(-1, Math.min(1, (tx * rx + tz * rz) / A.tiltMax)), pitch: Math.max(-1, Math.min(1, (tx * fx + tz * fz) / A.tiltMax)) }; }`;
    let i = await fly(ap, "m.t > 5", 6);
    await view(true); await shot(page, out, "20-ap-high-gate", { ...i, note: "high gate, about 7,000 ft: the lander pitched back, the Moon's grey plain below, the sky black" });
    i = await fly(ap, "m.alarm === 1202 && m.alarmT < 5", 60);
    await view(false); await shot(page, out, "21-ap-alarm-seat", { ...i, note: "from Armstrong's window: PROGRAM ALARM 1202, the plain coming up" });
    i = await fly(ap, "m.mode === 'P66'", 200);
    i = await fly(ap, "m.t - 0 > 0 && L.dadApAgl() * 3.281 < 420", 30);
    await view(false); await shot(page, out, "22-ap-p66-boulders-seat", { ...i, note: "P66 at about 400 ft: the boulder field under him, the crater beside it, the clear ground marked beyond" });
    await view(true); await shot(page, out, "22b-ap-p66-chase", { ...i, note: "the same from behind: tilted, flying on past the boulders" });
    i = await fly(ap, "L.dadApAgl() * 3.281 < 40", 120);
    await vantage(`cam.up.set(0,1,0); cam.position.set(S.x + 30, S.y + 6, S.z + 26); cam.lookAt(S.x, S.y - 6, S.z);`);
    await shot(page, out, "23-ap-dust", { ...i, note: "the last 40 ft: dust blown off the surface by the engine" });
    i = await fly(ap, "m.landed || m.over", 60);
    await vantage(`cam.up.set(0,1,0); cam.position.set(S.x + 22, S.y + 4, S.z + 16); cam.lookAt(S.x, S.y + 2.5, S.z);`);
    await shot(page, out, "24-ap-landed", { ...i, note: "the Eagle has landed: on the clear ground, the boulders behind" });
    i = await fly(ap, "m.card", 6);
    await paint(); await shot(page, out, "25-ap-card", { ...i, note: "the card: The Eagle has landed" });
    await page.evaluate(() => window.__lp.dadExit());
  }
  // ---------------- miracle on the hudson ----------------
  if (!only.length || only.includes("hudson")) {
    await enter("hudson");
    const climb = `(L, S, m) => { const A = L.TUNE.dad.air.a320, q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (10 - S.pitch) * 1.5));
      return { bank: 0, pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / A.pitchRateDeg), 1 / A.pitchExpo) }; }`;
    let i = await fly(climb, "m.t > 1", 2);
    // from ahead and above, looking back past her at the field she has just left
    await vantage(`cam.up.set(0,1,0); cam.position.set(S.x - 45, S.y + 22, S.z + 120); cam.lookAt(S.x, S.y - 160, S.z - 900);`);
    await shot(page, out, "30-hu-climb-out", { ...i, note: "climbing out north off his New York airport, engines at climb power, the field behind" });
    i = await fly(climb, "L.dad.world.flock.visible && L.dadHuAgl() * 3.281 > 2790", 90);
    await view(false); await shot(page, out, "31-hu-geese-seat", { ...i, note: "from the cockpit: the flock across the nose, a second before" });
    i = await fly(climb, "m.struck && m.t - m.strikeT > 1.5", 10);
    await view(true); await shot(page, out, "32-hu-strike", { ...i, note: "both engines gone: smoke from both, BIRDS -- BOTH ENGINES, the glide numbers" });
    // the final, lined up as the checks do: 1.8 km east of the river's clear stretch at 400 ft, flaps out
    await page.evaluate(() => { const L = window.__lp, S = L.state, U = L.TUNE.dad.hudson, m = L.dad.m;
      m.flaps = true; S.x = U.river.x + 1800; S.z = U.river.z; S.heading = Math.PI / 2; S.bank = 0; S.speed = 140 / 1.944; S.pitch = -3;
      S.y = Math.max(L.terrainEff(S.x, S.z), L.seaLevelAt(S.x, S.z)) + 400 / 3.281; L.dad.cam = null; });
    const fin = `(L, S, m) => { const A = L.TUNE.dad.air.a320, U = L.TUNE.dad.hudson, agl = L.dadHuAgl(), ft = agl * 3.281;
      const d = Math.max(60, S.x - (U.river.x - 100)); let g = Math.max(-8, Math.min(-1.5, -Math.atan2(Math.max(0, agl - 2), d) * 180 / Math.PI)); if (ft < 45) g = -1.0;
      const a = Math.PI / 2 - (S.z - U.river.z) * 0.003 - S.heading, eh = Math.atan2(Math.sin(a), Math.cos(a));
      const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (g - S.pitch) * 1.2));
      return { bank: Math.max(-1, Math.min(1, -eh * 2)), pitch: Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / A.pitchRateDeg), 1 / A.pitchExpo) }; }`;
    i = await fly(fin, "L.dadHuAgl() * 3.281 < 250", 30);
    await view(false); await shot(page, out, "33-hu-final-seat", { ...i, note: "on the final from the cockpit: the river ahead between the banks, the city beyond" });
    i = await fly(fin, "L.dadHuAgl() * 3.281 < 25", 30);
    await vantage(`cam.up.set(0,1,0); cam.position.set(S.x - 60, S.y + 6, S.z + 70); cam.lookAt(S.x, S.y - 3, S.z);`);
    await shot(page, out, "34-hu-flare", { ...i, note: "the flare over the water: wings level, nose up, flaps out" });
    i = await fly(fin, "m.over", 20);
    i = await fly(fin, "m.overT > 1", 3);
    await vantage(`cam.up.set(0,1,0); cam.position.set(S.x - 70, S.y + 18, S.z + 60); cam.lookAt(S.x, S.y, S.z);`);
    await shot(page, out, "35-hu-floating", { ...i, note: "she floats: on the river, spray settling" });
    i = await fly(fin, "m.card", 6);
    await paint(); await shot(page, out, "36-hu-card", { ...i, note: "the card: she floats, set beside the real one" });
    await page.evaluate(() => window.__lp.dadExit());
  }
  console.log("errors: " + JSON.stringify(errors.slice(0, 5)));
  await browser.close(); srv.close();
}
const args = process.argv.slice(2);
render(path.resolve(args[0] || path.join(__dirname, "..")), args.slice(1)).catch(e => { console.error(e); process.exit(1); });
