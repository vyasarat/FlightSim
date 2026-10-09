"use strict";
// ---------------------------------------------------------------------------
// DAD MODE (v147) and THE VALLEY. Dad mode is the parent's, behind a code, and
// exempt from the kid rules INSIDE it by the parent's decision; what these checks
// hold it to is that it is shut when it should be, does what it says when it is
// open, and leaves HIS game exactly as it was. Every count is a DELTA.
//
//   a. getting in: a wrong code does not enter and closes the pad; three wrong lock
//      the pad for TUNE.dad.lockout seconds of GAME time (a tap does nothing); then
//      it opens again; the right code opens the menu, FLY enters (kind "dad");
//   b. nothing saved: no localStorage key is written by any of it, lp.vehicle is
//      what it was, and a reload opens his game;
//   c. inside: none of his flight buttons (speed, go, missile, menu, eject) exist,
//      dad's are up without a slot clash or overlap, his crash alarm stays off
//      flying at a wall, the jet's G is limited, its tuning is its own;
//   d. the radar: above 100 ft for more than a moment locks and launches; under it,
//      nothing; a flare decoys the missile and it never reaches him;
//   e. the bombs: through the vent's three metres they count (hatch, then plant),
//      four metres off they do not; damage ends it ("shot down"), the ground ends it
//      ("crashed"), the clock ends it; a whole sortie flown by the pilot succeeds;
//   f. out: exit removes every dad object, element and sound, the bunker stands
//      whole, the solids are as before, his fighter's row is byte-identical and
//      flies exactly as it did; the random stream did not move by a draw;
//   g. his game: zero text with dad mode never entered and after it, the valley is
//      there (floor under walls, snow), clear of the motorway, the railway, both
//      cities and both airports by kilometres; the bunker is solid, a bang and a
//      free reassembly for his plane, and nothing breaks it.
// On v146 there is no dad mode or valley: every check FAILs, none throws.
//
// Alone: node scripts/run_module.js dadmode_checks
// ---------------------------------------------------------------------------
const pilot = require("./dad_autopilot.js");

module.exports = async function dadChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const run = async (page, fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e && e.message || e).slice(0, 300) }; } };
  const { page, errors } = await newPage(1180, 820);
  await page.evaluate(`(${pilot.toString()})()`);
  await page.evaluate(() => {
    const L = window.__lp;
    L.noRender = true;
    const H = window.__dadH = {};
    H.ls = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
    H.vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden") && getComputedStyle(e).display !== "none"; };
    H.text = () => {
      const bad = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode, p = n.parentElement && n.parentElement.tagName; if (p === "SCRIPT" || p === "STYLE") continue; const t = n.nodeValue.trim(); if (t && !/^[0-9]+$/.test(t)) bad.push(t.slice(0, 30)); }
      return bad;
    };
    H.tap = id => { const e = document.getElementById(id); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true })); };
    H.padKey = k => { const b = document.querySelector('#dadPad .dadPadKey[data-k="' + k + '"]'); if (!b) return false;
      b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true })); return true; };
    H.code = s => { for (const k of s) if (!H.padKey(k)) return false; return true; };
    H.dadDom = () => document.querySelectorAll("#dadHud,#dadGrey,#dadCard,#dadPad,#dadMenu").length;
    H.solids = () => { let n = 0; L.forEachSolid(() => n++); return n; };
    H.press = id => { const e = document.getElementById(id); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); };
  });

  // ---- g (before anything): his game, untouched by dad mode never entered
  const g0 = await run(page, () => {
    const L = window.__lp, H = window.__dadH, V = L.TUNE.valley;
    const out = { text: H.text(), key: !!document.getElementById("dadKey"), keyWords: [...document.querySelectorAll("#dadKey, #dadKey *")].filter(e => ["aria-label", "title", "alt"].some(a => e.hasAttribute(a))).length };
    out.dadButtonsUp = ["dadBombBtn", "dadFlareBtn", "dadMslBtn", "dadExitBtn"].filter(H.vis);
    out.dadObjs = L.dad.objs.length; out.dadDom = H.dadDom();
    // the valley: floor well under its walls all the way, snow-white
    let worst = Infinity;
    for (let x = V.x0 - 300; x > V.xb + V.bowlRim; x -= 400) {
      const z = L.vlCenterZ(x), floor = L.terrainEff(x, z);
      const s = L.vlCenterSlope(x), n = Math.sqrt(1 + s * s);
      const off = V.floorHalf + V.wallRun + 60;
      const wall = Math.min(L.terrainEff(x - off * s / n, z + off / n), L.terrainEff(x + off * s / n, z - off / n));
      worst = Math.min(worst, wall - floor);
    }
    out.wallOverFloor = Math.round(worst);
    // clear of everything else in his world, by the valley's whole box
    const box = { x1: -1650, x0: V.xb - V.westPad - V.rampX - 50, z0: V.zc - V.halfZ * 1.1, z1: V.zc + V.halfZ * 1.1 };
    const d = (x, z) => Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.z0 - z, 0, z - box.z1));
    let road = Infinity; for (const p of L.highway.pts) road = Math.min(road, d(p.x, p.z));
    let rail = Infinity; for (let z = L.TRAIN_ZMIN; z <= L.TRAIN_ZMAX; z += 50) rail = Math.min(rail, d(L.TRAIN_X, z));
    let city = Infinity; for (const k in L.cities) { const b = L.cities[k].data.bounds; for (const [x, z] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) city = Math.min(city, d(x, z)); }
    let air = Infinity; for (const a of L.AIRPORTS) air = Math.min(air, d(0, a.cz));
    let streets = Infinity; if (L.streets && L.streets.nodes) for (const n of L.streets.nodes) streets = Math.min(streets, d(n.x, n.z));
    out.clear = { road: Math.round(road), rail: Math.round(rail), city: Math.round(city), air: Math.round(air), streets: streets === Infinity ? null : Math.round(streets) };
    out.bunker = !!L.vl.bunker && L.vl.bunker.visible && !!L.vl.solid;
    out.pines = L.vl.pineCount;
    return out;
  });
  check("dad/valley: his game with dad mode never entered -- zero text, the dim key there with no words on it, no dad button up, no dad object or element anywhere",
    !g0.err && g0.text.length === 0 && g0.key && g0.keyWords === 0 && g0.dadButtonsUp.length === 0 && g0.dadObjs === 0 && g0.dadDom === 0, J(g0));
  check("dad/valley: the valley is in his world -- along its whole length the floor lies under both walls (by > 150 m), the bunker stands, pines on its slopes",
    !g0.err && g0.wallOverFloor > 150 && g0.bunker && g0.pines > 400, J({ wall: g0.wallOverFloor, bunker: g0.bunker, pines: g0.pines }));
  check("dad/valley: clear of everything -- the valley's whole box is > 1.5 km from every motorway sample and > 1.5 km from the railway, both cities (and every city street) and both airports",
    !g0.err && g0.clear.road > 1500 && g0.clear.rail > 1500 && g0.clear.city > 1500 && g0.clear.air > 1500 && (g0.clear.streets === null || g0.clear.streets > 1500), J(g0.clear));

  // ---- a. getting in
  const a = await run(page, () => {
    const L = window.__lp, H = window.__dadH, D = L.TUNE.dad, out = {};
    out.ls0 = H.ls();
    document.getElementById("screenVehicle").classList.remove("hiddenS");
    out.vehicle0 = L.state.vehicleKey;
    const wrong = D.code === "0000" ? "1111" : "0000";
    // a boy who finds the star: digits mashed, then a tap off the pad -- it closes, nothing changes
    H.tap("dadKey"); H.padKey("3"); H.padKey("5");
    const ov = document.getElementById("dadPad");
    ov.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); ov.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    out.outside = { pad: !!document.getElementById("dadPad"), on: L.dadActive(), wrong: L.dad.pad.wrong, picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), key: L.state.vehicleKey };
    // one wrong: the pad closes, nothing entered
    H.tap("dadKey"); out.padOpened = !!document.getElementById("dadPad");
    out.typed = H.code(wrong);
    out.afterWrong = { pad: !!document.getElementById("dadPad"), menu: !!document.getElementById("dadMenu"), on: L.dadActive() };
    // two more: locked
    H.tap("dadKey"); H.code(wrong); H.tap("dadKey"); H.code(wrong);
    out.locked = L.dad.pad.lockT; out.keyLocked = document.getElementById("dadKey").classList.contains("locked");
    H.tap("dadKey"); out.padWhileLocked = !!document.getElementById("dadPad");
    // the lockout runs on the game's clock: half of it, still locked; all of it, open
    for (let i = 0; i < D.lockout * 60 / 2; i++) L.update(1 / 60);
    H.tap("dadKey"); out.padHalfway = !!document.getElementById("dadPad");
    for (let i = 0; i < D.lockout * 60 / 2 + 30; i++) L.update(1 / 60);
    out.lockAfter = L.dad.pad.lockT;
    H.tap("dadKey"); out.padAfterLock = !!document.getElementById("dadPad");
    // the back key, then the right code
    H.padKey("7"); H.padKey("<"); out.dotsAfterBack = document.querySelectorAll("#dadPad .dadDots span.on").length;
    H.code(D.code);
    out.menu = !!document.getElementById("dadMenu"); out.onAtMenu = L.dadActive();
    out.menuText = (document.getElementById("dadMenu") || {}).textContent || "";
    // EXIT on the menu: back to the picker, not in
    const ex = [...document.querySelectorAll("#dadMenu .dadBtn")].find(b => b.textContent === "EXIT");
    ex.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); ex.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    out.afterMenuExit = { menu: !!document.getElementById("dadMenu"), on: L.dadActive(), picker: !document.getElementById("screenVehicle").classList.contains("hiddenS") };
    // in again, and FLY
    H.tap("dadKey"); H.code(D.code);
    const fly = [...document.querySelectorAll("#dadMenu .dadBtn")].find(b => b.textContent === "FLY");
    fly.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); fly.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    out.on = L.dadActive(); out.kind = L.vehKind(); out.pickerHidden = document.getElementById("screenVehicle").classList.contains("hiddenS");
    out.agl = +L.dadAgl().toFixed(1);
    return out;
  });
  check("dad/in: a tap off the pad closes it -- digits mashed, then a tap outside: the pad gone, nothing entered, no wrong try counted, his picker and vehicle as they were",
    !a.err && a.outside && !a.outside.pad && !a.outside.on && a.outside.wrong === 0 && a.outside.picker && a.outside.key === a.vehicle0, J(a.outside || a));
  check("dad/in: a wrong code does not enter -- the pad closes, no menu, dad mode off",
    !a.err && a.padOpened && a.typed && !a.afterWrong.pad && !a.afterWrong.menu && !a.afterWrong.on, J(a.afterWrong || a));
  check("dad/in: three wrong lock the pad for the lockout -- a tap opens nothing at once or halfway through (game time), and it opens again after",
    !a.err && a.locked > 0 && a.keyLocked && !a.padWhileLocked && !a.padHalfway && a.lockAfter === 0 && a.padAfterLock, J({ locked: a.locked, keyLocked: a.keyLocked, now: a.padWhileLocked, half: a.padHalfway, after: a.padAfterLock }));
  check("dad/in: the right code opens the menu (its briefing, FLY and EXIT), EXIT goes back to the picker, FLY enters -- low in the valley's mouth, kind 'dad', the picker gone",
    !a.err && a.dotsAfterBack === 0 && a.menu && !a.onAtMenu && /Canyon Strike/.test(a.menuText) && !a.afterMenuExit.menu && !a.afterMenuExit.on && a.afterMenuExit.picker &&
    a.on && a.kind === "dad" && a.pickerHidden && a.agl > 5 && a.agl < 30, J({ back: a.dotsAfterBack, menu: a.menu, exit: a.afterMenuExit, on: a.on, kind: a.kind, agl: a.agl }));

  // ---- c. inside
  const c = await run(page, () => {
    const L = window.__lp, H = window.__dadH, S = L.state, out = {};
    L.update(1 / 60);
    out.his = ["fastBtn", "slowBtn", "speedBtn", "skipBtn", "missileBtn", "menuBtn", "ejectBtn", "gearBtn", "throttleBtn", "vehBtn"].filter(H.vis);
    out.dads = ["dadFlareBtn", "dadMslBtn", "dadExitBtn"].filter(H.vis);
    out.bomb = H.vis("dadBombBtn");   // far from the bunker: not yet
    out.clash = L.btnSlotClashes(); out.obstruct = L.btnObstructions();
    // overlap by elementFromPoint, as the slot check measures it
    const SEL = ".roundBtn, #ejectBtn, #hornBtn, #menuBtn, #throttleBtn, #dadExitBtn";
    const bad = [];
    for (const b of document.querySelectorAll(SEL)) {
      const cs = getComputedStyle(b); if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = b.getBoundingClientRect(); if (!r.width) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), own = hit && hit.closest(SEL);
      if (own && own !== b) bad.push(b.id + " under " + own.id);
    }
    out.overlap = bad;
    out.vpOwn = S.vp !== L.TUNE.vehicles.fighter && S.vp.dadJet === true && S.vehicleKey === "fighter";
    // his alarm, flown at a wall hands-off: never on; dad's PULL UP is
    let alarm = 0, pull = 0;
    for (let i = 0; i < 60 * 5 && !L.dad.m.over; i++) { L.api.clearStick(); L.update(1 / 60); if (document.getElementById("alarm").classList.contains("on")) alarm++; if (L.dad.m.pullUp) pull++; }
    out.alarmFrames = alarm; out.pullFrames = pull; out.crashed = L.dad.m.why; out.over = L.dad.m.over;
    out.flagsAlarms = L.flags.alarms;
    // the control: the same flight with the mute taken off -- his alarm WOULD have come on
    const mute = window.dadAlarmMuted;
    window.dadAlarmMuted = () => false;
    L.dadStart(); let ctrl = 0;
    for (let i = 0; i < 60 * 5 && !L.dad.m.over; i++) { L.api.clearStick(); L.update(1 / 60); if (document.getElementById("alarm").classList.contains("on")) ctrl++; }
    window.dadAlarmMuted = mute;
    out.controlFrames = ctrl;
    return out;
  });
  check("dad/inside: none of his flight buttons exist (speed, go, missile, menu, eject, gear, throttle, picker); flare, missile and exit do, the bomb not yet; no slot clash, overlap or obstruction",
    !c.err && c.his.length === 0 && c.dads.length === 3 && !c.bomb && c.clash.length === 0 && c.overlap.length === 0 && c.obstruct.length === 0, J(c));
  check("dad/inside: his crash alarm is muted -- flown hands-off into the first wall it never comes on (the same flight unmuted turns it on); dad's own PULL UP does; the wall ends the sortie, 'crashed'",
    !c.err && c.alarmFrames === 0 && c.controlFrames > 10 && c.pullFrames > 10 && c.over && c.crashed === "crashed", J({ alarm: c.alarmFrames, control: c.controlFrames, pull: c.pullFrames, why: c.crashed }));
  check("dad/inside: the jet flies its own profile -- state.vp is a dad profile, never his fighter's row",
    !c.err && c.vpOwn, J({ vpOwn: c.vpOwn }));

  // the G limit: a full pull at cruise never goes past gMax, and does reach it
  const gl = await run(page, () => {
    const L = window.__lp, S = L.state;
    L.dadStart();
    S.y = L.terrainEff(S.x, S.z) + 400;
    let gMax = 0;
    for (let i = 0; i < 60 * 3; i++) { L.api.setStick(0, 1); L.update(1 / 60); if (i > 5) gMax = Math.max(gMax, Math.abs(L.dad.m.g)); }
    L.api.clearStick();
    return { gMax: +gMax.toFixed(2), limit: L.TUNE.dad.jet.gMax, grey: +L.dad.m.grey.toFixed(2), greyEl: +getComputedStyle(document.getElementById("dadGrey")).opacity };
  });
  check("dad/inside: a full pull is G-limited -- it reaches the limit and never passes it, and the grey-out comes in while it is held",
    !gl.err && gl.gMax <= gl.limit + 0.15 && gl.gMax > gl.limit - 1 && gl.grey > 0.2 && gl.greyEl > 0.15, J(gl));

  // ---- d. the radar and the flares
  const d = await run(page, () => {
    const L = window.__lp, S = L.state, out = {};
    // low: no lock and no launch in 6 s (flown along the valley by the pilot)
    L.dadStart(); const P = window.__dadPilot; P.phase = "valley"; P.t = 0; P.dropped = 0; P.log = [];
    const s0 = L.dad.m.samsLaunched;
    let lowLock = 0, maxAgl = 0;
    for (let i = 0; i < 60 * 6; i++) { P.step(1 / 60); if (L.dad.m.locked) lowLock++; maxAgl = Math.max(maxAgl, L.dadAgl()); }
    out.low = { launched: L.dad.m.samsLaunched - s0, lockFrames: lowLock, maxFt: Math.round(maxAgl * 3.281), over: L.dad.m.over };
    // high: climb to ~60 m (200 ft) and hold it: a lock, then a launch
    L.dadStart();
    const s1 = L.dad.m.samsLaunched;
    let lockAt = -1, launchAt = -1;
    for (let i = 0; i < 60 * 8 && launchAt < 0; i++) {
      const ax = S.x - 360, az = L.vlCenterZ(ax), want = L.terrainEff(S.x, S.z) + 60;
      const dh = Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading;
      const eh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const q = Math.max(-1, Math.min(1, ((want - S.y) * 0.08 - S.pitch * 0.15)));
      L.api.setStick(Math.max(-1, Math.min(1, -eh * 4.5)), Math.sign(q) * Math.pow(Math.abs(q), 1 / 2.6));
      L.update(1 / 60);
      if (lockAt < 0 && L.dad.m.locked) lockAt = i;
      if (L.dad.m.samsLaunched > s1) launchAt = i;
    }
    out.high = { lockAt: +(lockAt / 60).toFixed(2), launchAt: +(launchAt / 60).toFixed(2), launched: L.dad.m.samsLaunched - s1, warn: document.querySelector("#dadHud .dadWarn").textContent };
    // the missile chases; wait until it is in reach, then a flare
    const sam = L.dad.world.sams.find(s => s.alive);
    out.chasing = !!sam && sam.target === "jet";
    const h0 = L.dad.m.health;
    let flared = false, distAtFlare = null;
    for (let i = 0; i < 60 * 12 && sam && sam.alive; i++) {
      const dist = Math.hypot(sam.x - S.x, sam.y - S.y, sam.z - S.z);
      if (!flared && dist < 900) { flared = L.dadFlare(); distAtFlare = Math.round(dist); }
      L.api.clearStick(); L.update(1 / 60);
      if (L.dad.m.over) break;
    }
    out.flare = { flared, distAtFlare, target: sam && sam.target, alive: sam && sam.alive, hitHim: L.dad.m.health < h0 - 40, decoys: L.dad.m.decoys, flaresLeft: L.dad.m.flares };
    return out;
  });
  check("dad/radar: under 100 ft along the valley there is no lock and no launch",
    !d.err && d.low.launched === 0 && d.low.lockFrames === 0 && d.low.maxFt < 100 && !d.low.over, J(d.low || d));
  check("dad/radar: above 100 ft for more than a moment -- RADAR LOCK, then a missile launched, chasing him",
    !d.err && d.high.lockAt > 0.3 && d.high.launchAt > d.high.lockAt && d.high.launched === 1 && /RADAR LOCK|MISSILE/.test(d.high.warn) && d.chasing, J(d.high || d));
  check("dad/radar: a flare decoys it -- once it is in reach a flare takes it, and it never reaches him",
    !d.err && d.flare.flared && d.flare.target === "flare" && !d.flare.hitHim && d.flare.decoys >= 1, J(d.flare || d));

  // ---- e. the bombs, set up exactly: nose on the vent (or 4 m off it), steady, from 800 m
  const bombAt = (off) => page.evaluate((off) => {
    const L = window.__lp, S = L.state, v = L.vl.vent;
    L.dadStart();
    const tx = v.x + off, ty = v.y, tz = v.z;
    // 40 degrees down, from the east, 800 m out along the line to the (offset) aim point
    const pitch = -40, h = Math.atan2(1, 0.15);
    const fx = -Math.sin(h) * Math.cos(pitch * Math.PI / 180), fy = Math.sin(pitch * Math.PI / 180), fz = -Math.cos(h) * Math.cos(pitch * Math.PI / 180);
    S.x = tx - fx * 800; S.y = ty - fy * 800; S.z = tz - fz * 800; S.heading = h; S.pitch = pitch; S.bank = 0; S.speed = 150;
    L.dad.m.lastFwd = L.dadFwd(new THREE.Vector3());
    L.api.clearStick();
    for (let i = 0; i < 20; i++) L.update(1 / 60);
    const err0 = L.dad.m.spotErr;
    const can = L.dadBombCan();
    const dropped = [L.dadDropBomb()];
    for (let i = 0; i < 25; i++) L.update(1 / 60);
    dropped.push(L.dadDropBomb());
    // hold the nose until 500 m off, then a hard pull: the spot holds while they fall
    for (let i = 0; i < 60 * 10 && L.dad.world.bombs.length; i++) {
      const pull = Math.hypot(S.x - v.x, S.y - v.y, S.z - v.z) < 500;
      if (pull) L.api.setStick(0, 1); else L.api.clearStick();
      L.update(1 / 60);
    }
    L.api.clearStick();
    const m = L.dad.m;
    return { err0: +err0.toFixed(2), can, dropped, hits: m.hits, hatch: m.hatch, plant: m.plant, used: m.bombsUsed, last: m.lastBomb, bunker: L.vl.bunker.visible, over: m.over, why: m.why };
  }, off).catch(e => ({ err: String(e.message).slice(0, 300) }));
  const on = await bombAt(0);
  check("dad/bombs: through the vent's three metres they count -- nose on it, two dropped, the first blows the hatch and the second the plant (the bunker gone)",
    !on.err && on.can && on.dropped.every(Boolean) && on.err0 < 1 && on.hits === 2 && on.hatch && on.plant && !on.bunker, J(on));
  const off = await bombAt(4);
  check("dad/bombs: four metres off the vent they do not -- two dropped, no hit, the hatch shut and the plant standing",
    !off.err && off.dropped.every(Boolean) && off.err0 > 3 && off.hits === 0 && !off.hatch && !off.plant && off.bunker && off.last && !off.last.onVent, J(off));

  // damage ends it: high over the valley with no flares, the guns and the missiles have him
  const dmg = await run(page, () => {
    const L = window.__lp, S = L.state;
    L.dadStart();
    let minH = 100;
    for (let i = 0; i < 60 * 90 && !L.dad.m.over; i++) {
      const ax = S.x - 400, az = L.vlCenterZ(ax), want = L.terrainEff(S.x, S.z) + 140;
      const dh = Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading, eh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const q = Math.max(-1, Math.min(1, ((want - S.y) * 0.06 - S.pitch * 0.15)));
      L.api.setStick(Math.max(-1, Math.min(1, -eh * 4.5)), Math.sign(q) * Math.pow(Math.abs(q), 1 / 2.6));
      L.update(1 / 60); minH = Math.min(minH, L.dad.m.health);
    }
    L.api.clearStick();
    const m = L.dad.m;
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    return { over: m.over, result: m.result, why: m.why, health: m.health, sams: m.samsLaunched, gunHits: m.gunHits, exploding: S.exploding, card: !!document.getElementById("dadCard"),
             cardText: (document.getElementById("dadCard") || {}).textContent || "" };
  });
  check("dad/damage: flown exposed with no flares, the damage ends it -- 'shot down', the jet in pieces, the failure card with RETRY and EXIT",
    !dmg.err && dmg.over && dmg.result === "fail" && dmg.why === "shot down" && dmg.health === 0 && dmg.exploding && dmg.card && /Mission failed/.test(dmg.cardText) && /RETRY/.test(dmg.cardText) && /EXIT/.test(dmg.cardText), J(dmg));
  const clk = await run(page, () => {
    const L = window.__lp; L.dadStart(); L.dad.m.clock = 1;
    const P = window.__dadPilot; P.phase = "valley";
    for (let i = 0; i < 90; i++) P.step(1 / 60);
    return { over: L.dad.m.over, why: L.dad.m.why, result: L.dad.m.result };
  });
  check("dad/clock: the clock running out ends it -- 'clock ran out', a failure",
    !clk.err && clk.over && clk.result === "fail" && clk.why === "clock ran out", J(clk));
  const retry = await run(page, () => {
    const L = window.__lp;
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    const b = [...document.querySelectorAll("#dadCard .dadBtn")].find(x => x.textContent === "RETRY");
    if (!b) return { noCard: true };
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    const m = L.dad.m;
    return { card: !!document.getElementById("dadCard"), over: m.over, clock: m.clock, health: m.health, bombs: m.bombs, flares: m.flares, guns: L.dad.world.guns.every(g => g.alive), bunker: L.vl.bunker.visible, agl: +L.dadAgl().toFixed(0), exploding: L.state.exploding };
  });
  check("dad/retry: RETRY starts the sortie over -- full clock, health, bombs and flares, every gun standing, the bunker whole, low at the mouth",
    !retry.err && !retry.noCard && !retry.card && !retry.over && retry.clock === 150 && retry.health === 100 && retry.bombs === 4 && retry.flares === 8 && retry.guns && retry.bunker && !retry.exploding && retry.agl < 30, J(retry));

  // a whole sortie, flown by the pilot through the stick and the buttons' own functions
  const full = await run(page, () => {
    const L = window.__lp, P = window.__dadPilot;
    L.dadStart(); P.phase = "valley"; P.t = 0; P.dropped = 0; P.log = []; P.lastDropT = -9; P.highAt = 0;
    return P.fly(200);
  });
  check("dad/full: a whole sortie flown through the stick succeeds -- the valley under 100 ft, the pop-up, two bombs through the vent, the climb out with flares, 'success' inside the clock",
    !full.err && full.result === "success" && full.hits === 2 && full.plant && full.clock > 0 && full.sams > 0 && full.flaresUsed > 0, J(full));
  const card = await run(page, () => {
    const L = window.__lp;
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    const c = document.getElementById("dadCard");
    return { card: !!c, text: c ? c.textContent : "" };
  });
  check("dad/full: the results card -- success, the time, the damage, the bombs and flares used, RETRY and EXIT",
    !card.err && card.card && /Mission success/.test(card.text) && /Time/.test(card.text) && /Damage/.test(card.text) && /Bombs used/.test(card.text) && /Flares used/.test(card.text) && /RETRY/.test(card.text) && /EXIT/.test(card.text), J(card));

  // ---- f. out
  const f = await run(page, () => {
    const L = window.__lp, H = window.__dadH, S = L.state;
    const objs = L.dad.objs.slice();
    const b = [...document.querySelectorAll("#dadCard .dadBtn")].find(x => x.textContent === "EXIT");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    L.update(1 / 60);
    const out = { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(),
      picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), dirHidden: document.getElementById("screenDir").classList.contains("hiddenS"),
      kind: L.vehKind(), key: S.vehicleKey, vpRow: S.vp === L.TUNE.vehicles[S.vehicleKey], bunker: L.vl.bunker.visible && L.vl.ventGroup.visible,
      dadBtns: ["dadBombBtn", "dadFlareBtn", "dadMslBtn", "dadExitBtn"].filter(H.vis), bodyDad: document.body.classList.contains("dad"),
      text: H.text(), ls: H.ls(), exploding: S.exploding, camOrder: L.camera.rotation.order };
    return out;
  });
  check("dad/out: EXIT from the card removes every dad object (from the scene too), element and button, puts the bunker back whole, and opens HIS picker on the vehicles with the vehicle he had",
    !f.err && !f.on && f.objs === 0 && f.had > 20 && f.inScene === 0 && f.dom === 0 && f.picker && f.dirHidden && f.kind !== "dad" && f.key === a.vehicle0 && f.vpRow && f.bunker && f.dadBtns.length === 0 && !f.bodyDad && !f.exploding && f.camOrder === "YXZ",
    J({ ...f, text: undefined, ls: undefined }));
  check("dad/out: zero text in his game after dad mode, and nothing saved -- localStorage is exactly what it was before the pad was touched",
    !f.err && f.text.length === 0 && J(f.ls) === J(a.ls0), J({ text: f.text, before: a.ls0, after: f.ls }));

  // his fighter: its row byte-identical, and it flies exactly as on a page that never saw dad mode
  const flyFighter = (p, viaDad) => p.evaluate((viaDad) => {
    const L = window.__lp, S = L.state;
    const row = JSON.stringify(L.TUNE.vehicles.fighter);
    if (viaDad) { L.dadEnter(); for (let i = 0; i < 30; i++) L.update(1 / 60); L.dadExit(); }
    L.api.skipScreens(); L.api.setVehicle("fighter"); L.api.placeOnRunway();
    L.api.setThrottle(true);
    for (let i = 0; i < 60 * 12; i++) { if (i > 300) L.api.setStick(0.2, 0.6); L.update(1 / 60); }
    L.api.setThrottle(false); L.api.clearStick();
    return { row, rowAfter: JSON.stringify(L.TUNE.vehicles.fighter), x: +S.x.toFixed(3), y: +S.y.toFixed(3), z: +S.z.toFixed(3), h: +S.heading.toFixed(5), sp: +S.speed.toFixed(3), phase: S.phase, vp: S.vp === L.TUNE.vehicles.fighter };
  }, viaDad).catch(e => ({ err: String(e.message).slice(0, 300) }));
  const pA = await newPage(1180, 820); const fA = await flyFighter(pA.page, true); await pA.ctx.close();
  const pB = await newPage(1180, 820); const fB = await flyFighter(pB.page, false); await pB.ctx.close();
  check("dad/out: his fighter is untouched -- its TUNE row byte-identical, and after dad mode it takes off and flies exactly the path it flies on a page that never saw dad mode",
    !fA.err && !fB.err && fA.row === fA.rowAfter && fA.row === fB.row && fA.vp && fA.phase === "AIRBORNE" && fA.x === fB.x && fA.y === fB.y && fA.z === fB.z && fA.h === fB.h && fA.sp === fB.sp, J({ A: { ...fA, row: undefined, rowAfter: undefined }, B: { ...fB, row: undefined, rowAfter: undefined } }));

  // the seeded random stream: going in and out of dad mode draws on it exactly what
  // the same vehicle switch does without it -- counted inside ONE page, synchronously.
  // (Comparing two fresh pages' next draws is a race: GLBs and city meshes arrive while
  // a page boots and draw uuids as they land, so two pages start at different places.)
  const sA = await newPage(1024, 768);
  const rS = await sA.page.evaluate(() => {
    const L = window.__lp, S = L.state;
    let n = 0; const R = Math.random; Math.random = () => { n++; return R(); };
    const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
    const plain = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
    const dadIO = () => { L.dadEnter(); L.dadExit(); L.api.skipScreens(); };
    const out = {};
    try {
      plain();                                // warm every cache the switch touches
      n = 0; plain(); out.plain = n;
      n = 0; dadIO(); out.dad = n;
      n = 0; plain(); out.plainAfter = n;
    } finally { Math.random = R; }
    return out;
  }).catch(e => ({ err: String(e.message).slice(0, 300) }));
  await sA.ctx.close();
  check("dad/out: the seeded random stream does not move -- going in and out of dad mode draws exactly what the same vehicle switch draws without it, counted in one page",
    !rS.err && rS.dad === rS.plain && rS.plainAfter === rS.plain, J(rS));
  // ... and mid-sortie: making one of everything dad mode makes in flight (a cruise
  // missile, a SAM, a flare, his missile, a bomb) draws his Math.random not once
  const sC = await newPage(1024, 768);
  const mid = await sC.page.evaluate(() => {
    const L = window.__lp, S = L.state, v = L.vl.vent;
    L.dadEnter();
    let n = 0; const R = Math.random; Math.random = () => { n++; return R(); };
    const made = {};
    try {
      const before = L.dad.objs.length;
      L.dadCruiseMissiles(L.TUNE.dad.cruiseMissiles.delay + 0.01); made.cm = L.dad.world.cms.length;
      made.sam = L.dadLaunchSam(); made.flare = L.dadFlare(); made.msl = L.dadFireMissile();
      // over the bunker in a dive, for the bomb
      S.x = v.x + 600; S.z = v.z; S.y = v.y + 500; S.pitch = -40;
      made.bomb = L.dadDropBomb();
      made.meshes = L.dad.objs.length - before;
    } finally { Math.random = R; }
    const uu = new Set(); let dup = 0; for (const o of L.dad.objs) { if (uu.has(o.uuid)) dup++; uu.add(o.uuid); }
    L.dadExit();
    return { draws: n, made, dupUuids: dup };
  }).catch(e => ({ err: String(e.message).slice(0, 300) }));
  await sC.ctx.close();
  check("dad/out: mid-sortie too -- a cruise missile, a SAM, a flare, his missile and a bomb made in flight draw his Math.random not once, and no two dad objects share a uuid",
    !mid.err && mid.draws === 0 && mid.made.cm >= 1 && mid.made.sam && mid.made.flare && mid.made.msl && mid.made.bomb && mid.made.meshes >= 4 && mid.dupUuids === 0, J(mid));

  // ---- g. the bunker in his game: solid, a free bang for his plane, never broken
  const bk = await run(page, () => {
    const L = window.__lp, S = L.state, v = L.vl.vent, bunk = L.vlBunkerAt();
    const before = { solids: L.staticSolids.length, vis: L.vl.bunker.visible };
    L.api.skipScreens(); L.api.setVehicle("prop"); L.api.placeOnRunway();
    const hit = L.solidQuery(bunk.x, L.vl.base + 2, bunk.z, 3, L.SOLID.AIR);
    // his prop flown straight at the bunker's side, at cruise, low
    const h = Math.atan2(1, 0);   // west
    // from inside the bowl's flat floor, as low as his plane flies (over TUNE.terrainClearance)
    // and still into the block's solid box (its top is the vent housing's)
    const yFly = L.vl.base + 10.5;
    S.x = bunk.x + 140; S.z = bunk.z; S.y = yFly; S.heading = h; S.pitch = 0; S.bank = 0; S.speed = S.vp.cruiseSpeed;
    const floorMax = Math.max(...[0, 20, 40, 60, 80, 100, 120, 140].map(dx => L.terrainEff(bunk.x + dx, bunk.z)));
    S.phase = "AIRBORNE"; S.liftoffTimer = 0; S.maxAglSinceLiftoff = 1e9;
    const e0 = L.flags.exploded;
    let bang = false, minDx = Infinity;
    for (let i = 0; i < 60 * 8; i++) { L.api.clearStick(); L.update(1 / 60); if (S.exploding) bang = true; if (!bang) minDx = Math.min(minDx, S.x - bunk.x); if (bang && !S.exploding) break; }
    // his missile, fired straight at it from his fighter: it strikes the block, and the
    // block stands (noShatter: nothing of it is hidden, the solid still there)
    L.api.setVehicle("fighter"); L.api.placeOnRunway();
    S.x = bunk.x + 260; S.z = bunk.z; S.y = L.vl.base + 40; S.heading = Math.atan2(1, 0);
    S.pitch = -Math.atan2(40 - 3, 260) / (Math.PI / 180); S.bank = 0; S.speed = S.vp.cruiseSpeed;
    S.phase = "AIRBORNE"; S.liftoffTimer = 0; S.maxAglSinceLiftoff = 1e9; S.missileCooldown = 0;
    const m0 = L.flags.missiles, hid0 = L.hiddenPieces.length;
    L.fireMissile();
    let struck = false, hidBunker = 0, endAt = null;
    const live = L.missilesList.find(m => m.alive);
    for (let i = 0; i < 60 * 3 && live; i++) {
      S.x = bunk.x + 260; S.y = L.vl.base + 40; S.speed = 0;   // he holds still; only the missile moves
      const last = { x: live.x, y: live.y, z: live.z };
      L.update(1 / 60);
      if (!live.alive) {
        // it ended AT the block, not timed out or in the snow somewhere else
        const b = L.vl.solid;
        endAt = Math.hypot(Math.max(b.x - b.hw - last.x, 0, last.x - b.x - b.hw), Math.max(b.y0 - last.y, 0, last.y - b.y1), Math.max(b.z - b.hd - last.z, 0, last.z - b.z - b.hd));
        struck = endAt < 8; break;
      }
    }
    for (const h of L.hiddenPieces) if (h.mesh) { let p = h.mesh; while (p) { if (p === L.vl.bunker) hidBunker++; p = p.parent; } }
    const shot = { fired: L.flags.missiles - m0, struck, endAt: endAt === null ? null : +endAt.toFixed(1), hidBunker, stillSolid: !L.__lpIsHidden(L.vl.solid) };
    return { kind: hit && hit.b && hit.b.kind, bang, back: bang && !S.exploding, minDx: Math.round(minDx), exploded: L.flags.exploded - e0, vis: L.vl.bunker.visible, ventVis: L.vl.ventGroup.visible,
             noShatter: (() => { let ok = true; L.vl.bunker.traverse(o => { if (o.isMesh && !o.userData.noShatter) ok = false; }); return ok; })(), solids: L.staticSolids.length - before.solids,
             clearOfFloor: +(yFly - floorMax).toFixed(1), clearance: L.TUNE.terrainClearance, boxTop: +(L.vl.solid.y1 - yFly).toFixed(1), shot };
  });
  check("dad/valley: the bunker is solid in his game -- the registry has it, his prop flown at its side at cruise bangs and comes back free, and his own missile fired into it breaks nothing (still drawn, still solid, solids unchanged)",
    !bk.err && bk.kind === "building" && bk.clearOfFloor > bk.clearance && bk.boxTop > -3 && bk.bang && bk.back && bk.minDx > 0 && bk.minDx < 15 && bk.vis && bk.ventVis && bk.noShatter && bk.solids === 0 &&
    bk.shot.fired === 1 && bk.shot.struck && bk.shot.hidBunker === 0 && bk.shot.stillSolid, J(bk));

  // streaming the valley costs about what streaming anywhere else does: a ground chunk
  // there is built in under 3x the time of one on the plains (alternated, medians)
  const cost = await run(page, () => {
    const cs = window.__lp.TUNE.chunkSize, t = { valley: [], plains: [] };
    const at = { valley: [-6000, -1500], plains: [0, 1500] };
    for (let rep = 0; rep < 8; rep++) for (const k of ["valley", "plains"]) {
      const [x, z] = at[k];
      const t0 = performance.now(); const m = buildChunk(Math.round(x / cs) + rep, Math.round(z / cs)); t[k].push(performance.now() - t0); m.geometry.dispose();
    }
    const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
    return { valley: +med(t.valley).toFixed(2), plains: +med(t.plains).toFixed(2) };
  });
  check("dad/valley: a ground chunk in the valley builds in under 3x the time of one on the plains -- flying it does not hitch while it streams",
    !cost.err && cost.valley < cost.plains * 3, J(cost));

  // the key in HIS portrait picker covers no card, scrolled to the top or the bottom:
  // a tap on a card is always the card
  for (const [w, h] of [[768, 1024], [390, 844]]) {
    const kp = await newPage(w, h);
    const cov = await kp.page.evaluate(() => {
      const sv = document.getElementById("screenVehicle"); sv.classList.remove("hiddenS");
      const out = [];
      for (const top of [0, 1e6]) {
        sv.scrollTop = top;
        const k = document.getElementById("dadKey").getBoundingClientRect();
        for (const c of sv.querySelectorAll(".card:not(.hiddenS)")) {
          const r = c.getBoundingClientRect();
          if (r.left < k.right && k.left < r.right && r.top < k.bottom && k.top < r.bottom) out.push(c.dataset.v + "@" + Math.round(sv.scrollTop));
          // and what a tap at the card's own centre lands on
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (hit && hit.closest("#dadKey")) out.push("centre:" + c.dataset.v);
        }
      }
      return out;
    }).catch(e => [String(e.message).slice(0, 200)]);
    await kp.ctx.close();
    check("dad/key: in his portrait picker (" + w + "x" + h + ") the dim key covers no vehicle card, scrolled to the top or the bottom", cov.length === 0, J(cov));
  }

  check("dad: no page errors through all of it", errors.length === 0, J(errors.slice(0, 5)));
  await page.context().close();
};
