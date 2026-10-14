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
  console.log("errors: " + JSON.stringify(errors.slice(0, 5)));
  await browser.close(); srv.close();
}
const args = process.argv.slice(2);
render(path.resolve(args[0] || path.join(__dirname, "..")), args.slice(1)).catch(e => { console.error(e); process.exit(1); });
