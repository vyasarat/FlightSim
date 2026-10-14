"use strict";
// ---------------------------------------------------------------------------
// DAD MODE'S HISTORICAL MISSIONS (v154 on). The parent's, behind the code, exempt from the
// kid rules inside it; held here to what dadmode_checks holds Canyon Strike to: each mission
// can be WON and can be LOST, flown through the stick and the buttons' own functions, and
// leaves his game exactly as it was (no object, element, sound or sky mood left behind,
// nothing saved, his random stream not moved by a draw).
//
//   list: the menu is a list of every mission -- its kicker, history, how-to, this session's
//         record, FLY and EXIT; FLY on a card flies that mission
//   dam:  the lamps meet at 60 ft (apart over it, crossed under it); a run in the window
//         skips to the wall and breaches the dam (success); too high breaks up, too far
//         sinks short, too close jumps the crest, and three gone is a failure; the water
//         is a crash; the towers' guns fire and their lights find him; out, it is all gone
//         and his sky is his again
//
// Alone: node scripts/run_module.js dadmissions_checks
// ---------------------------------------------------------------------------
module.exports = async function dadMissionChecks({ newPage, check }) {
  const J = x => JSON.stringify(x);
  const run = async (page, fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e && e.message || e).slice(0, 300) }; } };
  const { page, errors } = await newPage(1180, 820);
  await page.evaluate(() => {
    const L = window.__lp;
    L.noRender = true;
    const H = window.__misH = {};
    H.tapEl = e => { e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true })); };
    H.ls = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
    H.dadDom = () => document.querySelectorAll("#dadHud,#dadGrey,#dadCanopy,#dadCard,#dadPad,#dadMenu").length;
    H.open = () => { document.getElementById("screenVehicle").classList.remove("hiddenS"); L.dadKeyTap(); for (const k of String(L.TUNE.dad.code)) L.dadPadPress(k); return !!document.getElementById("dadMenu"); };
    H.fly = id => { if (!H.open()) return false; const c = document.querySelector('#dadMenu .dadCard[data-mission="' + id + '"]'); if (!c) return false; H.tapEl(c.querySelector(".dadBtn.go")); return L.dadActive(); };
    // a stick for a pitch RATE on a mission profile (the inverse of its expo)
    H.pitchStick = (P, q) => Math.sign(q) * Math.pow(Math.min(1, Math.abs(q) / P.pitchRateDeg), 1 / P.pitchExpo);
    H.wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  });

  // ---- the list
  const list = await run(page, () => {
    const L = window.__lp, H = window.__misH;
    const ls0 = H.ls();
    const open = H.open();
    const cards = [...document.querySelectorAll("#dadMenu .dadCard")].map(c => ({ id: c.dataset.mission, title: c.querySelector("h1").textContent,
      kicker: c.querySelector(".dadKicker").textContent, hist: (c.querySelector(".dadHist") || {}).textContent || "", how: c.querySelectorAll("li").length,
      best: (c.querySelector(".dadBest") || {}).textContent || "", fly: !!c.querySelector(".dadBtn.go"), exit: [...c.querySelectorAll(".dadBtn")].some(b => b.textContent === "EXIT") }));
    // EXIT on a card closes the list, back to his picker
    H.tapEl([...document.querySelectorAll("#dadMenu .dadBtn")].find(b => b.textContent === "EXIT"));
    const closed = !document.getElementById("dadMenu") && !L.dadActive();
    return { open, cards, closed, ls: J0(ls0, H.ls()) };
    function J0(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  });
  check("dad/list: the dad menu is a list of missions -- Canyon Strike first, then each historical one: its date and aircraft, what really happened, how to fly it, this session's record, FLY and EXIT; EXIT closes it",
    !list.err && list.open && list.cards.length >= 2 && list.cards[0].id === "canyon" && list.cards.every(c => c.fly && c.exit && c.hist.length > 120 && c.how >= 3 && /Not flown this session/.test(c.best))
      && list.cards.some(c => c.id === "dam" && /1943/.test(c.kicker) && /60 ft/.test(c.hist)) && list.closed && list.ls, J(list));

  // ---- dambusters: in
  const din = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const sky0 = S.sky;
    const ok = H.fly("dam");
    const W = L.dad.world, D = W.dam;
    return { ok, mis: L.dad.mis && L.dad.mis.id, kind: L.vehKind(), sky0, sky: S.sky, night: S.nightF, body: !!W.body && W.body.parent === L.scene, dam: !!D, span: D ? Math.round(D.z1 - D.z0) : 0,
      len: D ? Math.round(D.zb - D.za) : 0, towers: D ? D.towers.length : 0, bombs: L.dad.m.bombs, heading: +S.heading.toFixed(3), x: Math.round(S.x),
      btnBomb: !!document.getElementById("dadBombBtn"), gunUp: (() => { const e = document.getElementById("dadGunBtn"); L.update(1 / 60); return !e.classList.contains("hidden") && getComputedStyle(e).display !== "none"; })() };
  });
  check("dad/dam: FLY on its card flies the Dambusters -- night, the bomber over the lake running west at the dam (a wall across the south arm, two towers), three bombs; the F-35's gun is not offered",
    !din.err && din.ok && din.mis === "dam" && din.kind === "dad" && din.sky === 3 && din.night === 1 && din.body && din.dam && din.span > 60 && din.len > din.span && din.towers === 2 && din.bombs === 3 && !din.gunUp, J(din));

  // the lamps: level over the water at 60 ft their spots meet; at 80 apart, at 45 crossed
  const lamps = await run(page, () => {
    const L = window.__lp, S = L.state, m = () => L.dad.m, wl = L.TUNE.waterLevel, T = L.TUNE.dad.dam;
    const at = ft => {
      L.dadRestart(); S.x = -150; S.z = L.dadDamLineZ(-150); S.y = wl + ft / 3.281; S.pitch = 0; S.bank = 0; S.speed = 104;
      L.api.clearStick(); L.update(1 / 60);
      return { gap: +m().spotGap.toFixed(2), say: document.querySelector("#dadHud .dadDamLamps").textContent };
    };
    return { r: T.spotR, at60: at(60), at80: at(80), at45: at(45) };
  });
  check("dad/dam: the two lamps' spots meet on the water at 60 ft (SPOTS TOGETHER); over it the beams have crossed (DOWN), under it they have not met (UP)",
    !lamps.err && lamps.at60.gap < 0.5 && /TOGETHER/.test(lamps.at60.say) && lamps.at80.gap > lamps.r * 2 && /CROSSED -- DOWN/.test(lamps.at80.say) && lamps.at45.gap > lamps.r * 2 && /APART -- UP/.test(lamps.at45.say), J(lamps));

  // a run by hand: the stick holds the arm's line at `ft`, and the bomb goes at `yd` (or when
  // the window is all green, yd null); then up over the dam. Returns what happened.
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.damRun = (ft, yd, secs, opts) => {
      opts = opts || {};
      const P = L.TUNE.dad.air.lancaster, wl = L.TUNE.waterLevel, D = L.dad.world.dam;
      if (!opts.keep) L.dadRestart();
      const out = { released: null, t: 0, maxFt: 0, minFt: 1e9, tracers: 0, barge: 0, count: 0, splashes: 0, why: null };
      let rel = false;
      for (let i = 0; i < 60 * secs && !L.dad.m.over; i++) {
        const m = L.dad.m;
        const ax = S.x - 400, az = L.dadDamLineZ(Math.max(ax, D.x + 30));
        const climb = rel || (S.x < D.x + 330 && !rel && yd === null && false);
        const wantY = (rel ? D.crest + 30 : wl + ft / 3.281);
        const eh = H.wrap(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading);
        const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (wantY - S.y) * 0.9 - S.pitch * 2.2));
        L.api.setStick(Math.max(-1, Math.min(1, -eh * 3)), H.pitchStick(P, q));
        L.update(1 / 60);
        out.t += 1 / 60;
        if (!rel && i > 120 && S.x < 200) { const f = (S.y - wl) * 3.281; out.maxFt = Math.max(out.maxFt, f); out.minFt = Math.min(out.minFt, f); }
        // release: at the range asked for, or when the three panels are green
        const ydNow = (S.x - (D.x + L.TUNE.dad.dam.thick / 2)) * 1.0936;
        if (!rel && L.dadBombCan() && (yd === null ? (m.window && m.window.all) : ydNow <= yd) && S.x < 100) {
          rel = L.dadDropBomb();
          if (rel) out.released = Object.assign({}, m.runs[m.runs.length - 1]);
        }
        if (L.dad.world.tracer.life.some(v => v > 0)) out.tracers++;
        // his fireworks barge is on this lake: it never shows, arms or counts down in here
        // (its hull may stand there: it is solid, so it is never hidden)
        if (fbarge.reticle && fbarge.reticle.visible || fbarge.phase !== "armed") out.barge++;
        if (document.getElementById("bigNum").classList.contains("on")) out.count++;
        out.splashes = m.bombFly ? m.bombFly.splashes : out.splashes;
        if (rel && !m.bombFly && !out.why) out.why = m.msg;
        if (rel && !m.bombFly && !opts.wait) { if (++out.after > 60) break; } else out.after = 0;
      }
      L.api.clearStick();
      const m = L.dad.m;
      return Object.assign(out, { over: m.over, result: m.result, mwhy: m.why, breached: m.breached, bombs: m.bombs, health: m.health,
        maxFt: Math.round(out.maxFt), minFt: Math.round(out.minFt), t: +out.t.toFixed(1) });
    };
  });

  const win = await run(page, () => window.__misH.damRun(60, null, 60, { wait: true }));
  check("dad/dam: a run in the window wins -- 60 ft, ~232 mph, released with all three panels green 400-480 yd out: it skips to the wall, goes off at depth and breaches the dam; 'success'",
    !win.err && win.released && win.released.kind === "wall" && win.released.ft >= 55 && win.released.ft <= 65 && win.released.mph >= 220 && win.released.mph <= 245
      && win.released.yd >= 400 && win.released.yd <= 480 && win.splashes >= 3 && win.breached && win.result === "success", J(win));
  const winCard = await run(page, () => { const L = window.__lp; for (let i = 0; i < 60 * 4; i++) L.update(1 / 60); const c = document.getElementById("dadCard"); return { card: !!c, text: c ? c.textContent : "" }; });
  check("dad/dam: the results card -- DAMBUSTERS, success, the time, the bombs used and the breaching bomb's height, speed and range; RETRY and EXIT",
    !winCard.err && winCard.card && /DAMBUSTERS/.test(winCard.text) && /success|breached/i.test(winCard.text) && /Time/.test(winCard.text) && /ft, \d+ mph, \d+ yd/.test(winCard.text) && /RETRY/.test(winCard.text) && /EXIT/.test(winCard.text), J(winCard));

  const high = await run(page, () => window.__misH.damRun(90, 440, 40));
  const far = await run(page, () => window.__misH.damRun(60, 650, 40));
  const close = await run(page, () => window.__misH.damRun(60, 300, 40));
  check("dad/dam: out of the window it fails, each its own way -- at 90 ft it breaks up on the water; 650 yd out it sinks short; 300 yd out it jumps the dam; none breaches",
    !high.err && !far.err && !close.err && high.released && high.released.kind === "broke" && far.released && far.released.kind === "short" && close.released && close.released.kind === "over"
      && !high.breached && !far.breached && !close.breached, J({ high: high.released, far: far.released, close: close.released }));
  const three = await run(page, () => {
    const L = window.__lp, H = window.__misH;
    const a = H.damRun(90, 440, 40);
    // round again: put him back at the start, the same sortie, and twice more
    const back = () => { const S = L.state, T = L.TUNE.dad.dam; S.x = T.start.x; S.z = L.dadDamLineZ(T.start.x); S.y = Math.max(L.terrainEff(S.x, S.z), L.TUNE.waterLevel) + T.start.agl; S.heading = Math.PI / 2; S.pitch = 0; S.bank = 0; };
    back(); const b = H.damRun(90, 440, 40, { keep: true });
    back(); const c = H.damRun(90, 440, 50, { keep: true, wait: true });
    for (let i = 0; i < 60 * 5; i++) L.update(1 / 60);
    const m = L.dad.m, card = document.getElementById("dadCard");
    return { bombs: m.bombs, over: m.over, result: m.result, why: m.why, card: card ? card.textContent : "" };
  });
  check("dad/dam: three bombs gone without a breach is a failure -- 'dam intact', the failure card with RETRY and EXIT",
    !three.err && three.bombs === 0 && three.over && three.result === "fail" && /intact/.test(three.why) && /Mission failed/.test(three.card) && /RETRY/.test(three.card), J(three));
  const crash = await run(page, () => window.__misH.damRun(4, 9999, 20));
  check("dad/dam: the water is hard -- flown at 4 ft over the lake the bomber goes in: 'crashed'",
    !crash.err && crash.over && crash.result === "fail" && crash.mwhy === "crashed", J(crash));
  check("dad/dam: his world stands down -- his fireworks barge, on this lake, never arms, shows its reticle or counts down through a whole run, and no set-piece countdown appears",
    !win.err && win.barge === 0 && win.count === 0 && far.barge === 0 && far.count === 0, J({ win: [win.barge, win.count], far: [far.barge, far.count] }));
  check("dad/dam: the defences -- on every run the towers' guns put tracer up at him",
    !win.err && win.tracers > 30 && far.tracers > 30, J({ win: win.tracers, far: far.tracers }));

  // ---- out: everything gone, his sky his again, nothing saved, his stream not moved
  const out = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const objs = L.dad.objs.slice();
    L.dadExit();
    for (let i = 0; i < 3; i++) L.update(1 / 60);
    return { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(), sky: S.sky, night: S.nightF,
      picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), kind: L.vehKind(), mis: L.dad.mis };
  });
  check("dad/dam: EXIT takes all of it away -- every object (the dam, the bomber, the moon and its light), every element; his sky mood back (day), his picker on the vehicles",
    !out.err && !out.on && out.objs === 0 && out.had > 20 && out.inScene === 0 && out.dom === 0 && out.sky === 0 && out.night === 0 && out.picker && out.kind !== "dad" && out.mis === null, J(out));
  // his world is scenery in here: nothing of his reacts to dad's aircraft, and nothing is saved.
  // The bomber is flown straight through the lake island's sparkle spot (out of a mission
  // that one is lit for good, and remembered); his toys are out of the picture while dad
  // mode is on, and each comes back on the way out exactly as it was.
  const his = await run(page, () => {
    const L = window.__lp, S = L.state;
    // his toys, and every set-piece's aim reticle (the red ring), each one's visibility
    const rets = []; L.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === "TorusGeometry" && o.material && o.material.isMeshBasicMaterial && o.material.color.getHex() === 0xff3b30) rets.push(o); });
    const seen = o => { for (let p = o; p; p = p.parent) if (!p.visible) return 0; return 1; };
    const snap = () => { const a = []; for (const t of targets) a.push(t.mesh.visible ? 1 : 0); for (const q of spots) a.push(q.mesh.visible ? 1 : 0, q.beam.visible ? 1 : 0); for (const g of gates) a.push(g.mesh.visible ? 1 : 0); for (const r of rets) a.push(seen(r)); return a.join(""); };
    const store = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(o); };
    const sp = spots.find(q => Math.hypot(q.x + 350, q.z - 1800) < 250);
    if (!sp) return { err: "no lake spot" };
    const wasLit = sp.lit, ls0 = store(), vis0 = snap(), fl0 = flags.spots || 0;
    L.dadEnter("dam");
    let shown = 0;
    for (const t of targets) if (t.mesh.visible) shown++;
    for (const q of spots) if (q.mesh.visible || q.beam.visible) shown++;
    for (const g of gates) if (g.mesh.visible) shown++;
    for (const r of rets) shown += seen(r);
    // put the bomber 250 m east of the spot at its height, heading west through it
    S.x = sp.x + 250; S.z = sp.z; S.y = sp.y; S.heading = Math.PI / 2; S.pitch = 0; S.bank = 0; S.speed = 103;
    let closest = 1e9;
    for (let i = 0; i < 240 && !L.dad.m.over; i++) { L.api.clearStick(); L.update(1 / 60); closest = Math.min(closest, Math.hypot(S.x - sp.x, S.y - sp.y, S.z - sp.z)); }
    const lit = sp.lit, fl1 = flags.spots || 0;
    L.dadExit(); L.api.skipScreens();
    const sameVis = snap() === vis0;
    // and the same through Canyon Strike, which hides and restores the same way
    L.dadEnter("canyon"); let shownC = 0; for (const t of targets) if (t.mesh.visible) shownC++; for (const r of rets) shownC += seen(r);
    L.dadExit(); L.api.skipScreens();
    return { closest: +closest.toFixed(1), wasLit, lit, spotsFlag: [fl0, fl1], shown, shownC, sameStore: store() === ls0, sameVis, sameVisC: snap() === vis0, n: vis0.length, rets: rets.length };
  });
  check("dad/dam: his world is scenery -- the bomber flown straight through the lake's sparkle spot does not light it (nothing is saved); his targets, spots, gates and set-piece reticles are out of the picture in here (and in Canyon Strike) and each comes back on EXIT exactly as it was",
    !his.err && his.closest < 4 && his.lit === his.wasLit && his.spotsFlag[0] === his.spotsFlag[1] && his.shown === 0 && his.shownC === 0 && his.sameStore && his.sameVis && his.sameVisC && his.n > 20 && his.rets >= 3, J(his));
  const stream = await run(page, () => {
    const L = window.__lp, S = L.state;
    // in one page, synchronously. (1) Going in and out of the Dambusters draws his Math.random
    // exactly what the same vehicle switch draws. (2) Flown, nothing in a dad file draws at all:
    // his own frame loop draws as it always does (the camera's shake, audio buffers), so the
    // flying is judged by WHO draws -- every draw's stack is read for a dad*.js frame.
    const R = Math.random; let n = 0, dadDraws = 0; const where = [];
    Math.random = () => { n++; const st = new Error().stack; if (/\/js\/dad[^/]*\.js/.test(st)) { dadDraws++; const f = (st.match(/[a-zA-Z_.]+ \([^)]*\/js\/[a-z_]+\.js:\d+/g) || []).slice(0, 3).map(x => x.replace(/\(.*\/js\//, "(")).join(" < "); if (where.indexOf(f) < 0 && where.length < 4) where.push(f); } return R(); };
    try {
      const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
      const plainSw = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
      plainSw(); n = 0; plainSw(); const plain = n;
      n = 0; L.dadEnter("dam"); L.dadExit(); L.api.skipScreens(); const io = n;
      L.dadEnter("dam"); n = 0; dadDraws = 0; where.length = 0;
      for (let i = 0; i < 120; i++) L.update(1 / 60); L.dadDropBomb(); for (let i = 0; i < 300; i++) L.update(1 / 60);
      const flown = n, fromDad = dadDraws, at = where.slice();
      L.dadExit(); L.api.skipScreens();
      return { plain, io, flown, dadDraws: fromDad, where: at };
    } finally { Math.random = R; }
  });
  check("dad/dam: his random stream does not move -- going in and out of the Dambusters draws his Math.random exactly what the same vehicle switch draws, and flown and bombed nothing in a dad file draws it once",
    !stream.err && stream.io === stream.plain && stream.flown > 0 && stream.dadDraws === 0, J(stream));
  check("dad/missions: no page errors through all of it", errors.length === 0, J(errors.slice(0, 5)));
};
