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
//   doolittle: on the deck the flagman holds him, then 467 ft and off the bow; eased up she
//         sinks and climbs away, hauled up she stalls in, pushed she goes in; the sight's ring
//         is where a bomb lands; two targets hit from 1,500 ft and on west wins; from 300 ft
//         his own blast catches him; four short is a failure; out, it is all gone and his
//         random stream has not moved
//   apollo: high gate over dad mode's own Moon (the sky black); the computer through the alarms
//         to 500 ft over the boulders; by hand to the clear ground, down gently, is the Eagle
//         landed; too hard, left alone, run dry or on a boulder fails; the switch takes over;
//         out, his sky and his stream are his
//   hudson: the climb-out into the birds at 2,818 ft and both engines gone; a 17:1 glide; a
//         final down the river flared to a floating ditching; fast and steep, a wing down,
//         land or a tower fail; out, his stream is his
//   x1:   hung in the mothership's bay, dropped, four chambers, Mach 1 at about 42,000 ft under a
//         day sky; the glide home over the lake; a final on to the bed; off the bed, too hard
//         and no Mach 1 fail; out, his sky and stream are his
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
    const snap = () => { const a = []; for (const t of targets) a.push(t.mesh.visible ? 1 : 0); for (const q of spots) a.push(q.mesh.visible ? 1 : 0, q.beam.visible ? 1 : 0); for (const g of gates) a.push(g.mesh.visible ? 1 : 0); for (const r of rets) a.push(seen(r)); a.push(ringsGroup.visible ? 1 : 0); for (const bd of BODIES) if (bd.mesh) a.push(bd.mesh.visible ? 1 : 0); return a.join(""); };
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
    if (ringsGroup.visible) shown++; for (const bd of BODIES) if (bd.mesh && bd.mesh.visible) shown++;
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
  check("dad/dam: his world is scenery -- the bomber flown straight through the lake's sparkle spot does not light it (nothing is saved); his targets, spots, gates, rings, set-piece reticles and the rocket's Moon and Mars are out of the picture in here (and in Canyon Strike) and each comes back on EXIT exactly as it was",
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

  // ---- the Doolittle Raid: in
  const lin = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const ok = H.fly("doolittle");
    const W = L.dad.world, C = W.carrier, D = L.TUNE.dad.doolittle;
    let meshes = 0; C.g.traverse(o => { if (o.isMesh) meshes++; });
    // the flagman winds up: he does not roll until the flag drops
    const rel = () => +(S.z - C.z).toFixed(2);
    L.update(1 / 60); const r0 = rel();
    for (let i = 0; i < 60 * (D.flagCount - 1); i++) L.update(1 / 60);
    const r1 = rel(), say = document.querySelector("#dadHud .dadDamLamps").textContent;
    return { ok, mis: L.dad.mis && L.dad.mis.id, kind: L.vehKind(), carrier: !!C && C.g.parent === L.scene, deckMeshes: meshes, targets: W.targets.length,
      coastZ: Math.round(W.coastZ), landmarkNear: L.dadDlLandmarkNear(C.x, C.z, D.clearR), seaUnder: L.terrainEff(C.x, C.z) < L.seaLevelAt(C.x, C.z), deckY: +(S.y - L.TUNE.waterLevel).toFixed(1), heading: S.heading,
      r0, r1, phase: L.dad.m.phase, say, bombs: L.dad.m.bombs, sky: S.sky,
      tgts: W.targets.map(t => ({ k: t.kind, x: t.x, z: Math.round(t.z), y: +t.y.toFixed(1), dry: L.terrainEff(t.x, t.z) >= L.seaLevelAt(t.x, t.z) })) };
  });
  check("dad/doolittle: FLY on its card puts him on a carrier's deck far out at sea north of his coast, heading south: the island, the fifteen others packed aft (baked, a few draw calls), none of his world's masts or bridges in sight of the deck, four targets on dry land along his coast; the flagman winds up and he holds until the flag drops",
    !lin.err && lin.ok && lin.mis === "doolittle" && lin.kind === "dad" && lin.carrier && !lin.landmarkNear && lin.deckMeshes < 60 && lin.targets === 4 && lin.seaUnder && lin.deckY > 15 && lin.heading === 0
      && lin.r0 === lin.r1 && lin.phase === "deck" && /FLAGMAN/.test(lin.say) && lin.bombs === 4 && lin.sky === 0 && lin.tgts.every(t => t.dry), J(lin));

  // the take-off by hand: `how` after the bow -- "gentle" eases the nose up, "hard" hauls it
  // back, "push" pushes it over
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.dlTakeoff = (how, secs) => {
      const P = L.TUNE.dad.air.b25, wl = L.TUNE.waterLevel, D = L.TUNE.dad.doolittle;
      L.dadRestart();
      const out = { offBow: null, deckS: 0, maxPitch: -99, minSpeed: 999, flapsUp: null, climbed: 0 };
      for (let i = 0; i < 60 * secs && !L.dad.m.over; i++) {
        const m = L.dad.m;
        if (m.phase === "air") {
          const vs = L.dadDlStall();
          let st = 0;
          if (how === "gentle") { const want = S.y - wl > D.flapsUp ? 2 : S.speed > vs * 1.3 ? 7 : 2; st = H.pitchStick(P, Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (want - S.pitch) * 2))); }
          else if (how === "hard") st = 1;
          else if (how === "push") st = -0.7;
          L.api.setStick(0, st);
          out.maxPitch = Math.max(out.maxPitch, S.pitch); out.minSpeed = Math.min(out.minSpeed, S.speed);
        } else if (how === "early" && m.count <= 0) L.api.setStick(0, 0.6); else L.api.clearStick();
        L.update(1 / 60);
        if (!out.offBow && L.dad.m.offBow) out.offBow = { speed: +L.dad.m.offBow.speed.toFixed(1), stall: +L.dadDlStall().toFixed(1), deckS: +L.dad.m.deckS.toFixed(1), t: +L.dad.m.t.toFixed(1) };
        if (out.flapsUp === null && !L.dad.m.flaps) out.flapsUp = +L.dad.m.t.toFixed(1);
        out.climbed = Math.max(out.climbed, (S.y - wl) * 3.281);
      }
      L.api.clearStick();
      const m = L.dad.m;
      return Object.assign(out, { endFt: Math.round((S.y - wl) * 3.281), say: m.msg, over: m.over, result: m.result, why: m.why, sinkMinFt: m.sinkMin === null ? null : Math.round(m.sinkMin * 3.281), climbed: Math.round(out.climbed),
        maxPitch: +out.maxPitch.toFixed(1), minSpeed: +out.minSpeed.toFixed(1), gear: L.dad.world.body.userData.gear.visible });
    };
  });
  const gentle = await run(page, () => window.__misH.dlTakeoff("gentle", 70));
  check("dad/doolittle: the deck run -- at the drop of the flag full power, 467 ft (142 m) of deck, and off the bow she is flying (over her full-flap stall); eased up gently she sinks toward the sea, then climbs away; over 150 ft with the nose down a little she builds speed and the flaps and gear come up",
    !gentle.err && gentle.offBow && Math.abs(gentle.offBow.deckS - 142) < 3 && gentle.offBow.speed > gentle.offBow.stall && gentle.sinkMinFt !== null && gentle.sinkMinFt > 5
      && gentle.sinkMinFt < 17 * 3.281 && gentle.flapsUp !== null && !gentle.gear && gentle.climbed - gentle.sinkMinFt >= 100 && gentle.endFt >= 140 && !gentle.over, J(gentle));
  const early = await run(page, () => window.__misH.dlTakeoff("early", 30));
  check("dad/doolittle: a pull held from the drop of the flag lifts her off the deck before the bow, once she flies ('SHE'S FLYING')",
    !early.err && early.offBow && early.offBow.deckS < 140 && early.offBow.speed > early.offBow.stall * 1.05, J(early));
  const hard = await run(page, () => window.__misH.dlTakeoff("hard", 25));
  const push = await run(page, () => window.__misH.dlTakeoff("push", 25));
  check("dad/doolittle: off the bow, haul her up and she stalls into the sea; push and the sea has her -- each 'crashed'",
    !hard.err && !push.err && hard.over && hard.result === "fail" && hard.why === "crashed" && hard.minSpeed < hard.offBow.stall && push.over && push.why === "crashed", J({ hard, push }));

  // a bomb run by hand: put him `back` metres north of target `i` at `ft`, heading south, and
  // fly the stick down its line holding the height; drop when the ring is on it (or, `early`,
  // as soon as the ring shows). Returns what the bomb did.
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.dlLine = (i, ft, opts) => {
      opts = opts || {};
      const P = L.TUNE.dad.air.b25, W = L.dad.world, m = L.dad.m, t = W.targets[i], wl = L.TUNE.waterLevel;
      m.phase = "air"; m.flaps = false; m.count = 0; m.offBow = m.offBow || { t: -100, speed: 100, y: 0 }; W.body.userData.gear.visible = false;
      S.x = t.x; S.z = t.z + (opts.back || 4500); S.y = Math.max(L.terrainEff(S.x, S.z), wl) + ft / 3.281; S.heading = 0; S.pitch = 0; S.bank = 0; S.speed = 105;
      const out = { ring: null, landed: null, flak: m.flak, drop: false };
      const hitsBefore = m.hits, used = m.bombsUsed;
      for (let k = 0; k < 60 * 70 && !m.over; k++) {
        const ax = t.x, az = S.z - 600;
        const eh = H.wrap(Math.atan2(-(ax - S.x), -(az - S.z)) - S.heading);
        const want = Math.max(L.terrainEff(S.x, S.z), wl) * 0 + wl + ft / 3.281;
        const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (want - S.y) * 0.5 - S.pitch * 2));
        L.api.setStick(Math.max(-1, Math.min(1, -eh * 3)), H.pitchStick(P, q));
        L.update(1 / 60);
        if (!out.drop && L.dadBombCan() && (opts.early ? m.pip && m.pip.z > t.z + 250 : L.dadDlOnTarget())) {
          out.ring = { x: +m.pip.x.toFixed(1), z: +m.pip.z.toFixed(1) };
          out.drop = L.dadDropBomb();
        }
        if (out.drop && W.bombsLive.length === 0 && !out.landed) { out.landed = m.drops[m.drops.length - 1]; out.k = k; }
        if (out.landed && k > out.k + 60) break;
      }
      L.api.clearStick();
      return Object.assign(out, { hits: m.hits - hitsBefore, used: m.bombsUsed - used, flak: m.flak - out.flak, health: m.health, over: m.over, result: m.result, why: m.why, msg: m.msg,
        hit: t.hit, ruin: t.ruin.visible, whole: t.whole.visible });
    };
    // where the bomb came down against where the ring was at the drop
    H.dlRing = () => { L.dadRestart(); const W = L.dad.world, m = L.dad.m, t = W.targets[0];
      m.phase = "air"; m.flaps = false; m.count = 0; m.offBow = { t: -100 }; S.x = t.x + 300; S.z = t.z + 1600; S.y = L.TUNE.waterLevel + 450; S.heading = 0.3; S.pitch = 0; S.bank = 0; S.speed = 105;
      L.update(1 / 60); const ring = { x: m.pip.x, z: m.pip.z }; L.dadDropBomb();
      let at = null; for (let k = 0; k < 60 * 20 && !at; k++) { const b = W.bombsLive[0]; const p = b ? { x: b.x, z: b.z } : null; L.api.clearStick(); L.update(1 / 60); if (!W.bombsLive.length) at = p; }
      return { miss: at ? +Math.hypot(at.x - ring.x, at.z - ring.z).toFixed(1) : null }; };
  });
  const ring = await run(page, () => window.__misH.dlRing());
  check("dad/doolittle: the sight is honest -- a bomb let go comes down where the green ring was (within 15 m, from 1,500 ft, banked off the line)",
    !ring.err && ring.miss !== null && ring.miss < 15, J(ring));
  const raid = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    L.dadRestart();
    const a = H.dlLine(0, 1500), b = H.dlLine(1, 1500);
    // then on west by hand, holding the height, until it ends
    const P = L.TUNE.dad.air.b25, wl = L.TUNE.waterLevel, m = L.dad.m;
    let k = 0;
    for (; k < 60 * 120 && !m.over; k++) {
      const eh = H.wrap(Math.PI / 2 - S.heading);
      const q = Math.max(-P.pitchRateDeg, Math.min(P.pitchRateDeg, (wl + 457 - S.y) * 0.5 - S.pitch * 2));
      L.api.setStick(Math.max(-1, Math.min(1, -eh * 3)), H.pitchStick(P, q)); L.update(1 / 60);
    }
    L.api.clearStick();
    for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    const c = document.getElementById("dadCard");
    return { a, b, over: m.over, result: m.result, why: m.why, x: Math.round(S.x), outX: Math.round(L.dadDlOutX()), card: c ? c.textContent : "" };
  });
  check("dad/doolittle: a raid by hand wins -- at 1,500 ft the ring on the docks, drop: hit, it turns to rubble; the factory the same; flak bursts round him over the coast; then 3 km on west: 'success', the card with the targets, the bombs and each bomb's height",
    !raid.err && raid.a.hit && raid.a.ruin && !raid.a.whole && raid.a.hits === 1 && raid.b.hits === 1 && raid.a.flak + raid.b.flak > 5 && raid.result === "success" && raid.x < raid.outX
      && /DOOLITTLE RAID/i.test(raid.card) && /Targets hit/.test(raid.card) && /from 1[45]\d\d ft/.test(raid.card) && /RETRY/.test(raid.card), J(raid));
  const low = await run(page, () => { const L = window.__lp, H = window.__misH; L.dadRestart(); return H.dlLine(1, 300); });
  check("dad/doolittle: bombed from 300 ft his own blast catches him -- damage, and the HUD says so",
    !low.err && low.drop && low.health < 100 && (/OWN BLAST/.test(low.msg) || low.why === "caught in his own blast"), J(low));
  // flak that finds him costs him, and enough of it brings him down: the bursts made certain to hit
  const shot = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state, F = L.TUNE.dad.doolittle.flak, hit0 = F.hit, every0 = F.every;
    L.dadRestart();
    const m = L.dad.m, t = L.dad.world.targets[0];
    m.phase = "air"; m.flaps = false; m.count = 0; m.offBow = { t: -100 }; S.x = t.x; S.z = t.z + 600; S.y = L.TUNE.waterLevel + 457; S.heading = 0; S.pitch = 0; S.speed = 105;
    F.hit = 1e4; F.every = 0.2;
    const hp = [];
    try { for (let i = 0; i < 60 * 6 && !m.over; i++) { L.api.clearStick(); L.update(1 / 60); if (i % 30 === 0) hp.push(m.health); } }
    finally { F.hit = hit0; F.every = every0; }
    return { hp, flakHits: m.flakHits, over: m.over, result: m.result, why: m.why };
  });
  check("dad/doolittle: flak that finds him costs damage each time, and enough brings him down -- 'shot down'",
    !shot.err && shot.flakHits >= 2 && shot.hp[1] < shot.hp[0] && shot.over && shot.result === "fail" && shot.why === "shot down", J(shot));
  const miss = await run(page, () => {
    const L = window.__lp, H = window.__misH; L.dadRestart();
    const r = [0, 1, 2, 3].map(i => H.dlLine(i, 1500, { early: true }));
    const m = L.dad.m; for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
    const c = document.getElementById("dadCard");
    return { hits: m.hits, bombs: m.bombs, over: m.over, result: m.result, why: m.why, drops: r.map(x => x.drop), card: c ? c.textContent : "" };
  });
  check("dad/doolittle: four bombs dropped short miss everything -- 'targets missed', the failure card with RETRY and EXIT",
    !miss.err && miss.hits === 0 && miss.bombs === 0 && miss.over && miss.result === "fail" && /missed/.test(miss.why) && /Mission failed/.test(miss.card) && /EXIT/.test(miss.card), J(miss));
  const dlOut = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const objs = L.dad.objs.slice();
    L.dadExit(); for (let i = 0; i < 3; i++) L.update(1 / 60);
    const out = { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(), sky: S.sky,
      picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), kind: L.vehKind() };
    // and his random stream: in and out draws what the plain switch draws; flown, nothing in a dad file draws
    const R = Math.random; let n = 0, dadDraws = 0;
    Math.random = () => { n++; if (/\/js\/dad[^/]*\.js/.test(new Error().stack)) dadDraws++; return R(); };
    try {
      L.api.skipScreens();
      const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
      const plainSw = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
      plainSw(); n = 0; plainSw(); out.plain = n;
      n = 0; L.dadEnter("doolittle"); L.dadExit(); L.api.skipScreens(); out.io = n;
      L.dadEnter("doolittle"); dadDraws = 0;
      for (let i = 0; i < 60 * 22; i++) { L.api.setStick(0, L.dad.m.phase === "air" ? 0.3 : 0); L.update(1 / 60); }
      const t = L.dad.world.targets[0], m = L.dad.m; S.x = t.x; S.z = t.z + 1200; S.y = L.TUNE.waterLevel + 457; S.heading = 0; S.pitch = 0; m.flaps = false;
      for (let i = 0; i < 120; i++) { L.api.clearStick(); L.update(1 / 60); } out.dropped = L.dadDropBomb(); for (let i = 0; i < 60 * 12; i++) L.update(1 / 60);
      out.dadDraws = dadDraws; L.dadExit(); L.api.skipScreens();
    } finally { Math.random = R; }
    return out;
  });
  check("dad/doolittle: EXIT takes all of it away (the carrier, the squadron, the targets, the bomber), his picker on the vehicles; his random stream does not move -- in and out draws what a plain switch draws, and flown, bombed, nothing in a dad file draws it",
    !dlOut.err && !dlOut.on && dlOut.objs === 0 && dlOut.had > 10 && dlOut.inScene === 0 && dlOut.dom === 0 && dlOut.sky === 0 && dlOut.picker && dlOut.kind !== "dad"
      && dlOut.io === dlOut.plain && dlOut.dropped && dlOut.dadDraws === 0, J(dlOut));

  // ---- Apollo 11: in
  const ain = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state, A = L.TUNE.dad.apollo;
    const ok = H.fly("apollo");
    for (let i = 0; i < 60 * 4; i++) { L.api.clearStick(); L.update(1 / 60); }
    const shown = id => !document.getElementById(id).classList.contains("hidden");
    return { ok, mis: L.dad.mis && L.dad.mis.id, kind: L.vehKind(), sf: +S.spaceF.toFixed(2), far: L.camera.far, body: !!L.dad.world.body, rocks: L.dadAp.rocks.length,
      ft: Math.round(L.dadApAgl() * 3.281), mode: L.dad.m.mode, up: shown("dadRodUpBtn"), dn: shown("dadRodDnBtn"), bomb: shown("dadBombBtn"), gun: shown("dadGunBtn") };
  });
  check("dad/apollo: FLY on its card puts him at high gate (about 7,500 ft) over dad mode's own Moon -- the sky black, the far plane out, the boulders laid, the computer flying (P64); the UP/DOWN rate switch offered, not the bomb or the gun",
    !ain.err && ain.ok && ain.mis === "apollo" && ain.kind === "dad" && ain.sf > 0.9 && ain.far >= 18000 && ain.body && ain.rocks > 300 && ain.ft > 6000 && ain.ft < 7600
      && ain.mode === "P64" && ain.up && ain.dn && !ain.bomb && !ain.gun, J(ain));

  // the hand: P66 toward `goal` (the clear ground unless given), descending as it closes; `how`
  // "gentle" sets her down at 2 ft/s, "hard" drives her in at 15, "none" leaves the stick and
  // the switch alone; `fuel` sets the tanks at takeover
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.apFly = (how, opts) => {
      opts = opts || {};
      const A = L.TUNE.dad.apollo, m = () => L.dad.m;
      L.dadRestart();
      const out = { alarms: [], go: false, p66: null, calls: [], msgs: [] };
      for (let i = 0; i < 60 * 420 && !m().over; i++) {
        const M = m(), ft = L.dadApAgl() * 3.281;
        if (M.alarm && out.alarms.indexOf(M.alarm + "@" + Math.round(ft / 500) * 500) < 0 && !out.alarms.some(a => a.startsWith(M.alarm + "@") && Math.abs(+a.split("@")[1] - ft) < 800)) out.alarms.push(M.alarm + "@" + Math.round(ft / 500) * 500);
        if (M.alarmGo) out.go = true;
        if (M.msgT > 0 && out.msgs[out.msgs.length - 1] !== M.msg) out.msgs.push(M.msg);
        if (M.mode === "P66") {
          if (!out.p66) { out.p66 = { ft: Math.round(ft), fuel: Math.round(M.fuel), fromSite: Math.round(Math.hypot(S.x - A.site.x, S.z - A.site.z)), rocksUnder: L.dadAp.rocks.filter(r => Math.hypot(r.x - S.x, r.z - S.z) < 60).length }; if (opts.fuel !== undefined) M.fuel = opts.fuel; }
          if (how === "none") { L.api.clearStick(); }
          else {
            const goal = opts.goal || A.clear, dx = goal.x - S.x, dz = goal.z - S.z, d = Math.hypot(dx, dz);
            const vw = Math.min(12, d * 0.07), wx = d > 0.1 ? dx / d * vw : 0, wz = d > 0.1 ? dz / d * vw : 0;
            const tx = Math.atan2((wx - M.vx) * 0.6, A.g) * 180 / Math.PI, tz = Math.atan2((wz - M.vz) * 0.6, A.g) * 180 / Math.PI;
            const fx = -Math.sin(S.heading), fz = -Math.cos(S.heading), rx = Math.cos(S.heading), rz = -Math.sin(S.heading);
            L.api.setStick(Math.max(-1, Math.min(1, (tx * rx + tz * rz) / A.tiltMax)), Math.max(-1, Math.min(1, (tx * fx + tz * fz) / A.tiltMax)));
            const over = d < 12 && Math.hypot(M.vx, M.vz) * 3.281 < 2;
            const want = !over ? Math.round(Math.max(-12, Math.min(4, (Math.min(300, 40 + d * 0.6) - ft) / 5))) : how === "hard" ? -15 : ft > 60 ? -8 : ft > 20 ? -4 : -2;
            if (M.rod < want) L.dadApRod(1); else if (M.rod > want) L.dadApRod(-1);
          }
        } else L.api.clearStick();
        L.update(1 / 60);
      }
      L.api.clearStick();
      for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      const M = m(), c = document.getElementById("dadCard");
      return Object.assign(out, { over: M.over, result: M.result, why: M.why, touch: M.touch, fuel: +M.fuel.toFixed(1), card: c ? c.textContent : "" });
    };
  });
  const apLand = await run(page, () => window.__misH.apFly("gentle"));
  check("dad/apollo: the computer flies the descent through the 1202 and 1201 alarms (Houston: GO) and hands over at 500 ft over the boulder field; flown by hand past it to the clear ground and set down gently -- 'the Eagle has landed', the card with the touchdown and the fuel left",
    !apLand.err && apLand.alarms.length >= 2 && apLand.alarms.some(a => /^1202/.test(a)) && apLand.alarms.some(a => /^1201/.test(a)) && apLand.go && apLand.p66 && Math.abs(apLand.p66.ft - 500) < 30
      && apLand.p66.rocksUnder > 3 && apLand.msgs.some(s => /60 SECONDS/.test(s)) && apLand.result === "success" && apLand.touch.vDown <= 3 && apLand.touch.vSide < 4 && !apLand.touch.rock && apLand.fuel > 0
      && /The Eagle has landed/.test(apLand.card) && /Touchdown/.test(apLand.card) && /Fuel left/.test(apLand.card), J(apLand));
  const apHard = await run(page, () => window.__misH.apFly("hard"));
  const apLeft = await run(page, () => window.__misH.apFly("none"));
  const apDry = await run(page, () => window.__misH.apFly("gentle", { fuel: 8 }));
  check("dad/apollo: and it fails as a landing fails -- driven in at 15 ft/s it comes down too hard; left to the computer's rate into the boulders it never lands right; run dry, the engine stops ('OUT OF FUEL') and she falls",
    !apHard.err && !apLeft.err && !apDry.err && apHard.result === "fail" && /hard|too hard/.test(apHard.why) && apLeft.result === "fail" && /too hard|hard landing|boulder|sliding/.test(apLeft.why) && apDry.result === "fail" && apDry.msgs.some(s => /OUT OF FUEL/.test(s)) && apDry.fuel === 0 && apDry.touch && apDry.touch.vDown > 10,
    J({ hard: [apHard.why, apHard.touch], left: [apLeft.why, apLeft.touch], dry: [apDry.why, apDry.fuel] }));
  const apRock = await run(page, () => {
    const L = window.__lp, A = L.TUNE.dad.apollo, R = L.dadAp.rocks.filter(r => Math.hypot(r.x - A.site.x, r.z - A.site.z) < 100).sort((a, b) => b.r - a.r)[0];
    return R ? window.__misH.apFly("gentle", { goal: { x: R.x, z: R.z } }) : { err: "no rock near the site" };
  });
  check("dad/apollo: set down gently on a boulder, she tips over -- 'landed on a boulder'",
    !apRock.err && apRock.result === "fail" && /boulder/.test(apRock.why), J([apRock.why, apRock.touch]));
  const apSlots = [];
  for (const [w, h] of [[1180, 820], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    apSlots.push(await run(page, ([w, h]) => {
      const L = window.__lp; L.dadRestart(); const m = L.dad.m, out = { vp: w + "x" + h };
      for (let i = 0; i < 60 * 25 && !m.alarm; i++) { L.api.clearStick(); L.update(1 / 60); }   // the alarm banner up
      for (const seat of [true, false]) { L.api.setView(seat); L.update(1 / 60); out[seat ? "chase" : "seat"] = { clash: L.btnSlotClashes(), obs: L.btnObstructions(), prog: getComputedStyle(document.querySelector("#dadHud .dadProg")).display !== "none" }; }
      L.api.setView(true);
      return out;
    }, [w, h]));
  }
  await page.setViewportSize({ width: 1180, height: 820 });
  check("dad/apollo: the rate switch and the alarm banner share no slot with any of his buttons and sit under no HUD figure -- landscape and portrait, in both seats",
    apSlots.every(r => !r.err && ["chase", "seat"].every(k => r[k].clash.length === 0 && r[k].obs.length === 0 && r[k].prog)), J(apSlots));
  const apSw = await run(page, () => {
    const L = window.__lp, H = window.__misH; L.dadRestart(); L.api.clearStick(); L.update(1 / 60);
    const m = L.dad.m, mode0 = m.mode;
    H.tapEl(document.getElementById("dadRodDnBtn")); L.update(1 / 60); const r1 = m.rod, mode1 = m.mode;
    H.tapEl(document.getElementById("dadRodUpBtn")); H.tapEl(document.getElementById("dadRodUpBtn")); L.update(1 / 60);
    return { mode0, mode1, r1, r2: m.rod };
  });
  check("dad/apollo: the switch -- a tap of DOWN in P64 takes it over (P66); then two taps of UP ask two feet a second less down",
    !apSw.err && apSw.mode0 === "P64" && apSw.mode1 === "P66" && apSw.r2 === apSw.r1 + 2, J(apSw));
  const aOut = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const objs = L.dad.objs.slice();
    L.dadExit(); for (let i = 0; i < 60 * 6; i++) L.update(1 / 60);
    const out = { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(), sf: +S.spaceF.toFixed(2), far: L.camera.far,
      picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), kind: L.vehKind(), up: ["dadRodUpBtn", "dadRodDnBtn"].some(id => !document.getElementById(id).classList.contains("hidden")) };
    const R = Math.random; let n = 0, dadDraws = 0;
    Math.random = () => { n++; if (/\/js\/dad[^/]*\.js/.test(new Error().stack)) dadDraws++; return R(); };
    try {
      L.api.skipScreens();
      const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
      const plainSw = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
      plainSw(); n = 0; plainSw(); out.plain = n;
      n = 0; L.dadEnter("apollo"); L.dadExit(); L.api.skipScreens(); out.io = n;
      L.dadEnter("apollo"); dadDraws = 0; for (let i = 0; i < 60 * 30; i++) L.update(1 / 60); L.dadApRod(-1); for (let i = 0; i < 60 * 10; i++) L.update(1 / 60);
      out.dadDraws = dadDraws; L.dadExit(); L.api.skipScreens();
    } finally { Math.random = R; }
    return out;
  });
  check("dad/apollo: EXIT takes the Moon, the boulders and the lander away, the switch with them; his sky comes back from black and the far plane in; his picker on the vehicles; his random stream does not move",
    !aOut.err && !aOut.on && aOut.objs === 0 && aOut.had > 3 && aOut.inScene === 0 && aOut.dom === 0 && aOut.sf < 0.1 && aOut.far === 6000 && aOut.picker && aOut.kind !== "dad" && !aOut.up
      && aOut.io === aOut.plain && aOut.dadDraws === 0, J(aOut));

  // ---- Miracle on the Hudson: in, the climb-out and the strike
  const hin = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state, A = L.TUNE.dad.air.a320, U = L.TUNE.dad.hudson;
    const ok = H.fly("hudson");
    const m = L.dad.m, out = { ok, mis: L.dad.mis && L.dad.mis.id, kind: L.vehKind(), body: !!L.dad.world.body, heading: S.heading, kt0: Math.round(S.speed * 1.944), flockSeen: false };
    // hold the climb by hand until the birds
    for (let i = 0; i < 60 * 120 && !m.struck; i++) { const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (10 - S.pitch) * 1.5)); L.api.setStick(0, H.pitchStick(A, q)); L.update(1 / 60); if (L.dad.world.flock.visible) out.flockSeen = true; }
    out.strikeFt = m.strikeAt && m.strikeAt.ft; out.msg = m.msg; out.thrust = m.thrust;
    // then, hands-off at best glide on her glide angle, the ratio she flies over 20 s
    // on a 17:1 path at best-glide speed her drag must exactly balance gravity along it: the
    // speed holds. (Set on that path, the distance over height is 17 whatever the drag; it is the
    // speed that tests the drag -- at 15:1 she would lose about 3 kt in these 20 s.)
    S.speed = A.vbg; S.pitch = -Math.asin(1 / 17) * 180 / Math.PI; S.bank = 0; L.api.clearStick();
    const kt0 = S.speed * 1.944;
    for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
    out.ktDrift = +(S.speed * 1.944 - kt0).toFixed(2); out.thrustAfter = m.thrust; out.over = m.over;
    out.cells = [...document.querySelectorAll("#dadHud .dadDamCell")].map(c => c.textContent);
    L.api.clearStick();
    return out;
  });
  check("dad/hudson: FLY on its card climbs the airliner out north off his New York airport; the flock crosses the nose at 2,818 ft and both engines go (no thrust, 'BIRDS -- BOTH ENGINES'); on a 17:1 path at best-glide speed (204 kt) her speed holds -- she glides 17 to 1 -- the GLIDE box saying how far",
    !hin.err && hin.ok && hin.mis === "hudson" && hin.kind === "dad" && hin.body && Math.abs(hin.heading - Math.PI) < 0.01 && hin.flockSeen && Math.abs(hin.strikeFt - 2818) < 20
      && /BIRDS/.test(hin.msg) && hin.thrustAfter === 0 && Math.abs(hin.ktDrift) < 1 && !hin.over && hin.cells.some(c => /GLIDE[\d.]+ MI/.test(c)), J(hin));

  // the river can be reached: from the strike, flown (no setting down anywhere) at best glide round
  // and back to a gate on the river's line 2.5 km east of its clear stretch, with height in hand
  const reach = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state, A = L.TUNE.dad.air.a320, U = L.TUNE.dad.hudson;
    L.dadRestart(); const m = L.dad.m;
    for (let i = 0; i < 60 * 120 && !m.struck; i++) { const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (10 - S.pitch) * 1.5)); L.api.setStick(0, H.pitchStick(A, q)); L.update(1 / 60); }
    const E = { x: U.river.x + 2500, z: U.river.z }; let best = 1e9, at = null, flapsFt = null;
    for (let i = 0; i < 60 * 240 && !m.over; i++) {
      const want = Math.atan2(-(E.x - S.x), -(E.z - S.z)), bank = Math.max(-1, Math.min(1, -H.wrap(want - S.heading) * 2));
      const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (S.speed - A.vbg) * 0.12 - (S.pitch + 3.4) * 0.5));
      L.api.setStick(bank, H.pitchStick(A, q)); L.update(1 / 60);
      if (m.flaps && flapsFt === null) flapsFt = Math.round(L.dadHuAgl() * 3.281);
      const d = Math.hypot(E.x - S.x, E.z - S.z); if (d < best) { best = d; at = { d: Math.round(d), ft: Math.round(L.dadHuAgl() * 3.281), t: Math.round(m.t - m.strikeT) }; }
      if (d < 300) break;
    }
    for (let i = 0; i < 60 * 90 && !m.over && L.dadHuAgl() * 3.281 > 450; i++) {
      const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (S.speed - A.vbg) * 0.12 - (S.pitch + 3.4) * 0.5));
      L.api.setStick(0, H.pitchStick(A, q)); L.update(1 / 60);
      if (m.flaps && flapsFt === null) flapsFt = Math.round(L.dadHuAgl() * 3.281);
    }
    L.api.clearStick();
    return { strikeFt: m.strikeAt && m.strikeAt.ft, at, over: m.over, flapsFt, flaps: m.flaps };
  });
  check("dad/hudson: the river can be reached -- flown from the strike at 2,818 ft round and back to the river's line at best glide, she arrives with height in hand (over 300 ft); on down, the flaps come out by themselves under 600 ft",
    !reach.err && reach.at && reach.at.d < 300 && reach.at.ft > 300 && reach.flaps && reach.flapsFt !== null && reach.flapsFt <= 600 && reach.flapsFt > 560, J(reach));
  // a final by hand: struck, flaps out, put `back` metres east of the river's point at `ft` and
  // `kt`, heading west down the channel; the stick flies a path to the touchdown and flares at
  // 45 ft -- unless `how` says otherwise ("dive": hold -6 degrees, "wing": a 15 degree bank, "land":
  // the final laid over the airport instead)
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.huFinal = (how, opts) => {
      opts = opts || {};
      const A = L.TUNE.dad.air.a320, U = L.TUNE.dad.hudson, W = L.dad.world;
      L.dadRestart();
      const m = L.dad.m;
      m.struck = true; m.strikeT = m.t; m.strikeAt = { x: S.x, z: S.z, ft: 2818 }; m.flaps = true;
      const R = how === "land" ? { x: 0, z: 5600 } : U.river;
      S.x = R.x + (opts.back || 1800); S.z = R.z; S.heading = Math.PI / 2; S.bank = 0; S.speed = (opts.kt || 140) / 1.944;
      S.y = Math.max(L.terrainEff(S.x, S.z), L.seaLevelAt(S.x, S.z)) + (opts.ft || 400) / 3.281; S.pitch = -3; L.dad.cam = null;
      for (let i = 0; i < 60 * 90 && !m.over; i++) {
        const agl = L.dadHuAgl(), ft = agl * 3.281;
        let g;
        if (how === "dive") g = -6;
        else { const d = Math.max(60, S.x - (R.x - 100)); g = Math.max(-8, Math.min(-1.5, -Math.atan2(Math.max(0, agl - 2), d) * 180 / Math.PI)); if (ft < 45) g = -1.0; }
        const wantH = Math.PI / 2 - (S.z - R.z) * 0.003, eh = H.wrap(wantH - S.heading);
        const q = Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (g - S.pitch) * 1.2));
        L.api.setStick(how === "wing" && ft < 40 ? 15 / A.bankLimitDeg : Math.max(-1, Math.min(1, -eh * 2)), H.pitchStick(A, q));
        L.update(1 / 60);
      }
      L.api.clearStick();
      for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      const c = document.getElementById("dadCard");
      return { over: m.over, result: m.result, why: m.why, ditch: m.ditch, card: c ? c.textContent : "" };
    };
  });
  const ditch = await run(page, () => window.__misH.huFinal("good"));
  check("dad/hudson: a final flown by hand down the river, flared at 45 ft -- on the water, wings level, the nose up, slow, sinking gently: 'she floats', the card with the ditching set beside the real one",
    !ditch.err && ditch.result === "success" && ditch.ditch.water && Math.abs(ditch.ditch.bank) <= 8 && ditch.ditch.pitch >= 4 && ditch.ditch.pitch <= 13 && ditch.ditch.kt <= 150 && ditch.ditch.sink <= 1000
      && /She floats/.test(ditch.card) && /125 kt, nose 9.5/.test(ditch.card) && /RETRY/.test(ditch.card), J(ditch));
  const hDive = await run(page, () => window.__misH.huFinal("dive", { kt: 190, ft: 300, back: 800 }));
  const hWing = await run(page, () => window.__misH.huFinal("wing"));
  const hLand = await run(page, () => window.__misH.huFinal("land"));
  check("dad/hudson: and it fails as a ditching fails -- driven in fast and steep she breaks up; a wing down catches the water; set down on land is a crash",
    !hDive.err && !hWing.err && !hLand.err && hDive.result === "fail" && /fast|too low|sinking/.test(hDive.why) && hDive.ditch.water
      && hWing.result === "fail" && /wing/.test(hWing.why) && hLand.result === "fail" && /land/.test(hLand.why), J({ dive: [hDive.why, hDive.ditch], wing: [hWing.why, hWing.ditch], land: [hLand.why, hLand.ditch] }));
  const hSeat = await run(page, () => {
    const L = window.__lp; L.dadRestart(); L.api.setView(true); L.update(1 / 60); const chase = L.dad.world.body.visible;
    L.api.setView(false); L.update(1 / 60); const seat = L.dad.world.body.visible; L.api.setView(true); L.update(1 / 60);
    return { chase, seat, back: L.dad.world.body.visible };
  });
  check("dad/missions: from the seat the aircraft's own body is not drawn -- visible exactly false (undefined is drawn: the airliner's glazing sat across the windscreen); back in the chase it is",
    !hSeat.err && hSeat.chase === true && hSeat.seat === false && hSeat.back === true, J({ chase: String(hSeat.chase), seat: String(hSeat.seat), back: String(hSeat.back) }));
  const hSolid = await run(page, () => {
    const L = window.__lp, S = L.state; L.dadRestart(); const m = L.dad.m;
    // level and south at 300 ft straight at the city past the river, the stick left alone
    S.x = -260; S.z = 4700; S.y = L.TUNE.waterLevel + 91; S.heading = 0; S.pitch = 0; S.bank = 0; S.speed = 80;
    for (let i = 0; i < 60 * 25 && !m.over; i++) { L.api.clearStick(); L.update(1 / 60); }
    // the bang is where a building is: the registry finds one at the point she went up
    const there = L.solidQuery(S.x, S.y, S.z, L.TUNE.solid.r.dad + 1, L.SOLID.AIR, undefined, null, false);
    return { over: m.over, result: m.result, why: m.why, at: [Math.round(S.x), Math.round(S.y), Math.round(S.z)], there: there ? there.kind : null, hit: m.ditch && m.ditch.hitKind };
  });
  check("dad/hudson: his solids are solid to her -- flown level at 300 ft south across the river toward the city (the bridge's tower stands in the way), 'flew into something solid', and the bang is where that thing stands (a bridge's tower or a building, the registry says which)",
    !hSolid.err && hSolid.over && hSolid.result === "fail" && /solid/.test(hSolid.why) && /^(building|bridge)$/.test(hSolid.hit) && hSolid.there === hSolid.hit, J(hSolid));
  const hOut = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const objs = L.dad.objs.slice();
    L.dadExit(); for (let i = 0; i < 3; i++) L.update(1 / 60);
    const out = { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(), picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), kind: L.vehKind() };
    const R = Math.random; let n = 0, dadDraws = 0;
    Math.random = () => { n++; if (/\/js\/dad[^/]*\.js/.test(new Error().stack)) dadDraws++; return R(); };
    try {
      L.api.skipScreens();
      const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
      const plainSw = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
      plainSw(); n = 0; plainSw(); out.plain = n;
      n = 0; L.dadEnter("hudson"); L.dadExit(); L.api.skipScreens(); out.io = n;
      L.dadEnter("hudson"); dadDraws = 0; for (let i = 0; i < 60 * 70; i++) { L.api.setStick(0, 0.4); L.update(1 / 60); }
      out.struck = L.dad.m.struck; out.dadDraws = dadDraws; L.dadExit(); L.api.skipScreens();
    } finally { Math.random = R; }
    return out;
  });
  check("dad/hudson: EXIT takes the airliner and the flock away, his picker on the vehicles; his random stream does not move -- in and out draws what a plain switch draws, and climbed into the birds nothing in a dad file draws it",
    !hOut.err && !hOut.on && hOut.objs === 0 && hOut.had >= 2 && hOut.inScene === 0 && hOut.dom === 0 && hOut.picker && hOut.kind !== "dad" && hOut.io === hOut.plain && hOut.struck && hOut.dadDraws === 0, J(hOut));

  // ---- Breaking the Sound Barrier: in, the drop, the chambers, Mach 1 high up
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    // the hand after the drop: light the four one by one, climb at 18 degrees to 41,000 ft, level
    // at 42,000 and let it run; with the fuel gone, home to the lake at a fast glide, round it
    H.x1Run = (opts) => {
      opts = opts || {};
      const A = L.TUNE.dad.air.x1, X = L.TUNE.dad.x1, m = () => L.dad.m;
      L.dadRestart();
      const out = { hungMoved: null, dropped: false, lit: [], sf: 0, farMax: 0, flamesMax: 0, cone: 0 };
      let mode = "climb", x0 = null;
      for (let i = 0; i < 60 * (opts.secs || 700) && !m().over; i++) {
        const M = m(), ft = S.y * 3.281, agl = (S.y - L.terrainEff(S.x, S.z)) * 3.281;
        if (M.phase === "hung") { if (x0 === null) x0 = S.x; if (M.t > 2) { out.hungMoved = Math.round(S.x - x0); /* carried east */ out.dropped = L.dadDropBomb(); } L.api.clearStick(); L.update(1 / 60); continue; }
        if (M.lit < 4 && M.fuel > 0 && (M.t - M.dropT) > M.lit * 0.6 + 0.5) { L.dadX1Chamber(); out.lit.push(+(M.t - M.dropT).toFixed(1)); }
        if (M.fuel <= 0 && mode !== "home") mode = "home";
        const rho = Math.max(0.12, Math.exp(-S.y / X.scaleH)), vbg = A.vbg / Math.sqrt(rho);
        let bank = 0, q;
        if (mode !== "home") { if (ft > 41000) mode = "cruise"; q = ((mode === "climb" ? 18 : ((42000 - ft) / 3.281) * 0.02) - S.pitch) * 1.2; }
        else {
          const dx = X.lake.x - S.x, dz = X.lake.z - S.z, d = Math.hypot(dx, dz);
          bank = Math.max(-1, Math.min(1, -H.wrap(Math.atan2(-dx, -dz) - S.heading) * 2)); if (d < 2500) bank = 0.7;
          q = (S.speed - vbg * 1.25) * 0.08 - (S.pitch + 9) * 0.3;
          if (opts.homeTo && d < 2500 && !out.home) out.home = { d: Math.round(d), ft: Math.round(ft), t: Math.round(M.t) };
          if (out.home && opts.homeTo) break;
        }
        L.api.setStick(bank, H.pitchStick(A, Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, q)))); L.update(1 / 60);
        out.sf = Math.max(out.sf, S.spaceF); out.farMax = Math.max(out.farMax, L.camera.far);
        out.flamesMax = Math.max(out.flamesMax, L.dad.world.body.userData.flames.filter(f => f.visible).length);
        if (/OFF SCALE/.test((document.querySelector("#dadHud .dadDamCell") || {}).textContent || "")) out.offScale = true;
        if (opts.stopAtBoom && M.boom && M.t - M.boomT > 3) break;
      }
      L.api.clearStick();
      const M = m();
      return Object.assign(out, { boom: M.boom, boomAt: M.boomAt, maxMach: +M.maxMach.toFixed(3), maxFt: Math.round(M.maxFt), fuel: M.fuel, over: M.over, msgs: M.msg,
        hud: [...document.querySelectorAll("#dadHud .dadDamCell")].map(c => c.textContent) });
    };
  });
  const xin = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const ok = H.fly("x1");
    const shown = id => !document.getElementById(id).classList.contains("hidden");
    L.update(1 / 60);
    const W = L.dad.world, B = W.mother.userData;
    return { ok, mis: L.dad.mis && L.dad.mis.id, kind: L.vehKind(), ft: Math.round(S.y * 3.281), mph: Math.round(S.speed * 2.237), under: Math.round(B.y - S.y), heading: +S.heading.toFixed(3),
      lake: !!W.lake && W.lake.parent === L.scene, drop: shown("dadBombBtn"), chamber: shown("dadChamberBtn"), phase: L.dad.m.phase };
  });
  check("dad/x1: FLY on its card hangs the rocket plane in the mothership's bay at 20,000 ft and 250 mph, heading east over his desert, the dry lake laid behind; DROP offered, the chambers not yet",
    !xin.err && xin.ok && xin.mis === "x1" && xin.kind === "dad" && Math.abs(xin.ft - 20000) < 200 && Math.abs(xin.mph - 250) < 3 && xin.under > 0 && xin.under < 10 && Math.abs(xin.heading + Math.PI / 2) < 0.01
      && xin.lake && xin.drop && !xin.chamber && xin.phase === "hung", J(xin));
  const xrun = await run(page, () => window.__misH.x1Run({ stopAtBoom: true }));
  check("dad/x1: carried, dropped, the four chambers lit one press at a time (four flames), climbed to about 42,000 ft and let run -- it passes Mach 1 there (the Mach box off the scale, the boom); the sky stays day high up (no space) and the far plane goes out with the height",
    !xrun.err && xrun.hungMoved > 0 && xrun.dropped && xrun.lit.length === 4 && xrun.flamesMax === 4 && xrun.boom && xrun.boomAt.ft > 38000 && xrun.boomAt.ft < 46000
      && xrun.boomAt.mph > 600 && xrun.boomAt.mph < 720 && xrun.offScale && xrun.sf < 0.05 && xrun.farMax > 30000, J(xrun));
  // the flame button, through the button itself: DROP while hung; after the drop the chambers, a
  // tap each, gone once all four are lit; and no speed streaks in the seat at Mach 1
  const xbtn = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state; L.dadRestart();
    const shown = id => !document.getElementById(id).classList.contains("hidden"), up = () => ({ drop: shown("dadBombBtn"), flame: shown("dadChamberBtn") });
    L.update(1 / 60); const hung = up();
    H.tapEl(document.getElementById("dadBombBtn")); L.update(1 / 60); const free = up();
    const lit = []; for (let k = 0; k < 4; k++) { H.tapEl(document.getElementById("dadChamberBtn")); L.update(1 / 60); lit.push(L.dad.m.lit); }
    const four = up();
    L.api.setView(false); S.speed = 300; S.y = 12800; for (let i = 0; i < 60; i++) L.update(1 / 60);
    const lines = L.speedLines.visible ? +L.speedLines.material.opacity.toFixed(3) : 0; L.api.setView(true);
    return { hung, free, lit, four, lines, clash: L.btnSlotClashes() };
  });
  check("dad/x1: the buttons -- DROP while she hangs; after the drop the flame button, and each tap lights one more chamber; with all four lit it goes; never two in one slot; and no speed streaks across the seat at Mach 1",
    !xbtn.err && xbtn.hung.drop && !xbtn.hung.flame && !xbtn.free.drop && xbtn.free.flame && xbtn.lit.join() === "1,2,3,4" && !xbtn.four.flame && xbtn.lines === 0 && xbtn.clash.length === 0, J(xbtn));
  const xhome = await run(page, () => window.__misH.x1Run({ homeTo: true }));
  check("dad/x1: with the fuel burnt out (about two and a half minutes on all four) she glides home: flown back from the run she is over the lake with height to spare",
    !xhome.err && xhome.boom && xhome.fuel === 0 && xhome.maxMach >= 1 && xhome.maxMach < 1.15 && xhome.home && xhome.home.ft > 5000 && !xhome.over, J(xhome));
  // a final on to the lake bed by hand: set 6 km east of the lake at `ft`, gliding west, the stick
  // flying a path to the bed and a flare; `noMach` leaves Mach 1 unreached, `steep` drives her in
  await page.evaluate(() => {
    const L = window.__lp, H = window.__misH, S = L.state;
    H.x1Final = (how, opts) => {
      opts = opts || {};
      const A = L.TUNE.dad.air.x1, X = L.TUNE.dad.x1, m = L.dad.m;
      L.dadRestart(); L.dadX1Drop();
      const M = L.dad.m; M.fuel = 0; M.lit = 0;
      if (how !== "noMach") { M.boom = true; M.maxMach = 1.06; M.boomT = -10; M.boomAt = { ft: 42000, mph: 690 }; }
      const tx = X.lake.x + (opts.offX || 0), tz = X.lake.z + (opts.offZ || 0);
      S.x = tx + 6000; S.z = tz; S.heading = Math.PI / 2; S.bank = 0; S.speed = 120; S.pitch = -4;
      S.y = L.terrainEff(S.x, S.z) + (opts.ft || 2500) / 3.281; L.dad.cam = null;
      for (let i = 0; i < 60 * 200 && !M.over; i++) {
        const agl = S.y - L.terrainEff(S.x, S.z), d = S.x - (tx - 200);
        let g = how === "steep" ? -14 : (agl < 12 ? -0.8 : Math.max(-10, -Math.atan2(agl, Math.max(150, d)) * 180 / Math.PI));
        const wantH = Math.PI / 2 - (S.z - tz) * 0.002, bank = Math.max(-1, Math.min(1, -H.wrap(wantH - S.heading) * 2));
        L.api.setStick(bank, H.pitchStick(A, Math.max(-A.pitchRateDeg, Math.min(A.pitchRateDeg, (g - S.pitch) * 1.2)))); L.update(1 / 60);
      }
      L.api.clearStick();
      for (let i = 0; i < 60 * 4; i++) L.update(1 / 60);
      const c = document.getElementById("dadCard");
      return { over: M.over, result: M.result, why: M.why, land: M.land, gear: L.dad.world.body.userData.gear.visible, card: c ? c.textContent : "", restAgl: +(S.y - L.terrainEff(S.x, S.z)).toFixed(1) };
    };
  });
  const xland = await run(page, () => window.__misH.x1Final("good"));
  check("dad/x1: a final flown by hand on to the dry lake, flared -- gear down, on the bed, gently, and there she stays (four seconds on, still on the bed, not through it): 'supersonic, and down on the lake', the card with Mach and the landing beside the real one",
    !xland.err && xland.result === "success" && xland.land.onLake && xland.land.vs <= 10 && xland.gear && xland.restAgl > 0.5 && xland.restAgl < 3 && /Top Mach/.test(xland.card) && /Mach 1.05-1.06/.test(xland.card) && /RETRY/.test(xland.card), J(xland));
  const xOff = await run(page, () => window.__misH.x1Final("good", { offX: -1500 }));
  const xSteep = await run(page, () => window.__misH.x1Final("steep"));
  const xNoM = await run(page, () => window.__misH.x1Final("noMach"));
  check("dad/x1: and it fails as a landing fails -- set down off the bed, driven in steep it comes down too hard, and down on the lake without Mach 1 is not the mission",
    !xOff.err && !xSteep.err && !xNoM.err && xOff.result === "fail" && /off the lake/.test(xOff.why) && xSteep.result === "fail" && /too hard/.test(xSteep.why)
      && xNoM.result === "fail" && /Mach 1 was never reached/.test(xNoM.why) && xNoM.land.onLake, J({ off: [xOff.why, xOff.land], steep: [xSteep.why, xSteep.land], noMach: [xNoM.why, xNoM.land] }));
  const xOut = await run(page, () => {
    const L = window.__lp, H = window.__misH, S = L.state;
    const objs = L.dad.objs.slice();
    L.dadExit(); for (let i = 0; i < 60 * 3; i++) L.update(1 / 60);
    const out = { on: L.dadActive(), objs: L.dad.objs.length, inScene: objs.filter(o => !!o.parent).length, had: objs.length, dom: H.dadDom(), env: L.dadEnv(), far: L.camera.far,
      picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"), kind: L.vehKind(), chamber: !document.getElementById("dadChamberBtn").classList.contains("hidden") };
    const R = Math.random; let n = 0, dadDraws = 0;
    Math.random = () => { n++; if (/\/js\/dad[^/]*\.js/.test(new Error().stack)) dadDraws++; return R(); };
    try {
      L.api.skipScreens();
      const k = S.vehicleKey, o = S.originIdx, d = S.dirIdx;
      const plainSw = () => { L.api.setVehicle("fighter"); L.api.setVehicle(k); L.api.spawnAt(o, d); };
      plainSw(); n = 0; plainSw(); out.plain = n;
      n = 0; L.dadEnter("x1"); L.dadExit(); L.api.skipScreens(); out.io = n;
      L.dadEnter("x1"); dadDraws = 0; for (let i = 0; i < 60 * 3; i++) L.update(1 / 60); L.dadX1Drop(); for (let k2 = 0; k2 < 4; k2++) L.dadX1Chamber(); for (let i = 0; i < 60 * 20; i++) L.update(1 / 60);
      out.dadDraws = dadDraws; L.dadExit(); L.api.skipScreens();
    } finally { Math.random = R; }
    return out;
  });
  check("dad/x1: EXIT takes the rocket plane, the mothership, the lake and the floor away, the chamber button with them; his sky back (no dad sky, the far plane in); his random stream does not move",
    !xOut.err && !xOut.on && xOut.objs === 0 && xOut.had > 5 && xOut.inScene === 0 && xOut.dom === 0 && xOut.env === null && xOut.far <= 18000 && xOut.picker && xOut.kind !== "dad" && !xOut.chamber
      && xOut.io === xOut.plain && xOut.dadDraws === 0, J(xOut));
  check("dad/missions: no page errors through all of it", errors.length === 0, J(errors.slice(0, 5)));
  await page.context().close();
};
