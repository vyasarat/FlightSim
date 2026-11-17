"use strict";
// The race.
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["RACE-3", "RACE-1"]);
// ---------------------------------------------------------------------------
// RACE AUDIT (2026-11): four things a race left wrong, each a check that fails until fixed.
//   RACE-1  at the car wash he is never offered a race that cannot run (flag hidden, or its clock runs)
//   RACE-2  his car's body arriving mid-race sits on the deck, not over it
//   RACE-3  out of a race, no race tone keeps sounding -- even when the EXIT tap came while audio was not running
//   RACE-4  on the podium his car is never drawn giant
//   (C3, Q-10, v232) the rivals' bodies landing late: a cold load with their GLBs held on the wire -- each one
//   drawn as itself once it lands, mid-race, on the podium and in the next race; one that never lands still races
// One page for RACE-1..4; every scenario sets its own vehicle and spot and leaves the race off. C3 has its own.
// Alone: node scripts/run_module.js race_audit_checks
// ---------------------------------------------------------------------------
module.exports = async function raceAuditChecks({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table); the rest
  // still run, so the scenarios stay honest, but stay quiet until their release. Anything not named
  // by a finding id (a page-error guard) always reports.
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail); };
  const { ctx, page, errors } = await newPage(820, 1180);
  await page.waitForFunction(() => { const L = window.__lp, s = L.modelState; return L.race && L.race.built && s && ["car", "cybertruck"].every(k => s[k] && s[k] !== "loading"); }, null, { timeout: 120000 }).catch(() => {});
  const prelude = `const L = window.__lp, st = L.state, R = L.race, RC = L.RC; L.noRender = true;
    const step = (n, touch) => { for (let i = 0; i < n; i++) { st.touching = !!touch; st.ctrlBank = 0; st.ctrlPitch = 0; L.update(1 / 60); } };
    const fresh = (v) => { L.raceReset(); L.api.skipScreens(); L.api.setVehicle(v); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true); step(20); };`;

  // ---- RACE-1: the car wash
  const r1 = await page.evaluate(new Function(`${prelude}
    fresh("car");
    const w = L.toyWorld.washes[st.originIdx];
    st.x = w.x; st.z = w.z - w.side * 60; st.y = L.terrainEff(st.x, st.z) + 1; st.speed = 0; step(5); st.speed = 0;
    const started = L.twWashStart(w);
    step(30);
    const btn = document.getElementById("raceBtn"), cs = getComputedStyle(btn);
    const offered = L.raceBtnShows() && cs.display !== "none" && cs.visibility !== "hidden" && !btn.classList.contains("hidden");
    const washAtOffer = !!L.toyWorld.wash;               // (v215) he really is in the wash as the flag is asked
    // (v215) the track picker's own guard, asked directly inside the wash: it does not open, no race
    L.raceOpenPicker();
    const direct = { washOn: !!L.toyWorld.wash, pickerOpened: !document.getElementById("screenRace").classList.contains("hiddenS"), raceOn: !!R.on };
    if (direct.pickerOpened) raceClosePicker();
    let opened = false, clock = null;
    if (offered) {
      L.raceOpenPicker();
      opened = !document.getElementById("screenRace").classList.contains("hiddenS");
      if (opened) { L.rcStartRace("oval", 4242); const t0 = R.t; step(180, true); clock = +(R.t - t0).toFixed(2); }
    }
    const out = { started, washAtOffer, direct, offered, opened, raceClockIn3s: clock };
    L.raceReset(); for (let i = 0; i < 900 && L.toyWorld.wash; i++) step(1);
    // (v215) ... and nothing is taken away: out of the wash the flag is back, a race runs from there,
    // and EXIT puts him back where he was -- out of the wash, not inside it
    step(30);
    const site = { x: Math.round(st.x), z: Math.round(st.z) };
    out.after = { washOn: !!L.toyWorld.wash, offered: L.raceBtnShows() };
    if (out.after.offered) {
      L.raceOpenPicker(); L.rcStartRace("oval", 4241); const t0 = R.t; step(180, true);
      out.after.clockIn3s = +(R.t - t0).toFixed(2);
      L.raceExit(); step(10);
      out.after.back = { x: Math.round(st.x), z: Math.round(st.z), metresFromWhereHeWas: Math.round(Math.hypot(st.x - site.x, st.z - site.z)),
                         inWash: Math.abs(st.x - w.x) < 15 && Math.abs(st.z - w.z) < L.TW.wash.length / 2 + 5 };
    }
    L.raceReset(); step(3);
    return out;`));
  check("RACE-1: at the car wash he is never offered a race that cannot run (no flag, or the race's clock runs), and the track picker will not open there; out of the wash the flag is back, a race from there runs, and EXIT puts him back where he was, never inside the wash",
    r1.started && r1.washAtOffer && r1.direct.washOn && !r1.direct.pickerOpened && !r1.direct.raceOn && (!r1.offered || !r1.opened || r1.raceClockIn3s > 2.5) &&
    !r1.after.washOn && r1.after.offered && r1.after.clockIn3s > 2.5 && !!r1.after.back && r1.after.back.metresFromWhereHeWas < 5 && !r1.after.back.inWash, r1);

  // ---- RACE-2: the body arriving mid-race
  const r2 = await page.evaluate(new Function(`${prelude}
    const T = window.THREE, res = [];
    const gap = () => { const m = L.vehicleModel, b = new T.Box3(), g = new T.Box3(), q = {}; m.updateMatrixWorld(true);
      m.traverse(o => { if (!o.isMesh || !o.geometry) return; for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
        if (o.userData.cvFx || (o.material && (o.material.visible === false || o.material.blending === T.AdditiveBlending))) return;
        o.geometry.boundingBox || o.geometry.computeBoundingBox(); b.union(g.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); });
      L.rcPoint(R.him.s, R.him.lat, q); return +(b.min.y - q.y).toFixed(2); };
    for (const v of ["car", "cybertruck"]) {
      const kept = L.modelStore[v], ks = L.modelState[v];
      if (!kept) { res.push({ v, skipped: "no body loaded" }); continue; }
      delete L.modelStore[v]; L.modelState[v] = "loading";
      try {
        fresh(v);
        L.rcStartRace("oval", 4243); step(300, true);
        const onStandIn = gap();
        L.modelStore[v] = kept; L.modelState[v] = ks;
        buildVehicleModel(v);                      // what models.js does when the download lands under him
        step(30, true);
        res.push({ v, onStandIn, afterBodyArrives: gap() });
      } finally { L.modelStore[v] = kept; L.modelState[v] = ks; L.raceReset(); buildVehicleModel(st.vehicleKey); step(3); }
    }
    return res;`));
  check("RACE-2: when his car's body arrives mid-race it sits on the track (lowest point within 0.3 m of the deck)",
    r2.length > 0 && r2.every(r => !r.skipped && Math.abs(r.afterBodyArrives) < 0.3), r2);

  // ---- RACE-3: the race's tones after an EXIT tapped while the audio was not running
  // (a real touch first, so the AudioContext is unlocked by a gesture, as his finger does)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 410, y: 500, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.evaluate(() => { window.__lp.audio.unlock(); return new Promise(r => setTimeout(r, 300)); });
  const r3a = await page.evaluate(new Function(`${prelude}
    fresh("car");
    L.rcStartRace("dunes", 4244); step(60 * 9, true);
    const ctxBefore = audioCtx.state;
    // the iPad's audio is interrupted: at his tap the context is not running (shadowed, then given back)
    Object.defineProperty(audioCtx, "state", { get: () => "suspended", configurable: true });
    try { unlockAudio(); L.raceExit(); } finally { delete audioCtx.state; }
    step(60, false);                               // parked in the world, the audio back
    return { ctxBefore, ctxNow: audioCtx.state };`));
  await page.waitForTimeout(500);                  // (the audio thread's own clock: the gains settle)
  const r3 = await page.evaluate(() => {
    const L = window.__lp, names = ["raceCrowd"].concat(Object.values(L.RC.surfaces).filter(s => s.tone).map(s => s.tone[0])), on = {};
    for (const k of names) if (tones[k] && tones[k].g.gain.value > 0.001) on[k] = +tones[k].g.gain.value.toFixed(4);
    return { on, raceOn: L.raceOn() };
  });
  check("RACE-3: out of a race no race tone (crowd, surface) is still sounding, even when EXIT was tapped while the audio was not running",
    r3a.ctxBefore === "running" && r3a.ctxNow === "running" && !r3.raceOn && Object.keys(r3.on).length === 0, { ...r3a, ...r3 });

  // ---- RACE-4: a giant who loses, on the podium
  const r4 = await page.evaluate(new Function(`${prelude}
    const T = window.THREE, size = () => { const b = new T.Box3().setFromObject(L.vehicleModel), v = new T.Vector3(); b.getSize(v); return Math.max(v.x, v.y, v.z); };
    fresh("car");
    L.rcStartRace("oval", 4245); step(300, true);
    const normal = size();
    const Ln = R.track.len, N = R.track.laps || RC.laps;
    for (const r of R.racers) { r.lapsDone = N - 1; r.s = r.isHim ? N * Ln - 15 : N * Ln + 5 + r.i * 8; }
    step(1, true);
    L.rcItGive(R.him, "giant"); R.him.itemShuf = 0; L.raceItemUse();
    let f = 0; while (R.phase !== "podium" && f < 900) { step(1, true); f++; }
    const phase = R.phase, place = R.him.place, onStep = !!(R.podium && R.podium.onStep);
    step(60 * 10, false);
    const out = { phase, place, onStep, normal: +normal.toFixed(2), onPodium: +size().toFixed(2) };
    L.raceReset(); step(3);
    return out;`));
  check("RACE-4: on the podium his car is drawn at its own size, never still giant (within 10% of its size on the grid)",
    r4.phase === "podium" && r4.onPodium <= r4.normal * 1.1, r4);

  if (errors.length) check("race audit: no page errors", false, errors.slice(0, 5));
  await ctx.close();

  // ---- (C3, Q-10) THE RIVALS' BODIES ARRIVING LATE. A cold load: the page reloaded with the three rival GLBs held
  // on the wire (routing turns the HTTP cache off), the first race started on their stand-ins, and each body let
  // through at its moment. Asked of the SCENE, not a flag: which visible racer bodies are drawn, each known by its
  // geometry (a GLB clone shares its prototype's) or as the grey sedan stand-in; where (across the ground, and its
  // lowest drawn point against the deck or its podium step); how long it is drawn along its own nose; which way it
  // points. A body swapped in is judged against the SAME car in a warm race (its body landed before the grid).
  //   load 1: the SUV lands mid-race while a GIANT, the Cybertruck mid-race while SPINNING OUT; the Corvette on its
  //           podium step; then a warm race and its podium, the yardstick
  //   load 2: the Cybertruck lands on the podium while OFF it (hidden stays hidden); the race left, the SUV and the
  //           Corvette land in free play, BETWEEN races; the next race: every rival real, none twice, no stand-in left
  //   load 3: the downloads fail: the race still starts, runs and finishes on the stand-ins
  {
    const GLB = ["car", "cybertruck", "corvette"], RX = /models\/(car|cybertruck|corvette)\.glb$/;
    const { ctx: c2, page: p2, errors: e2 } = await newPage(820, 1180);
    let held = {};
    const boot = async () => {
      held = {};
      await p2.reload({ timeout: 120000 });
      await p2.waitForFunction(() => window.__lp && window.__lp.state && (!window.__lp.artReady || window.__lp.artReady()) && window.__lp.race && window.__lp.race.built, null, { timeout: 120000, polling: 100 });
      await p2.evaluate(() => window.__lp.api.skipScreens());
    };
    const drawnJs = `const L = window.__lp, R = L.race, T = window.THREE, GLB = ${JSON.stringify(GLB)};
      const geos = {}; for (const k of GLB) { geos[k] = new Set(); const p = L.modelStore[k]; if (p) p.traverse(o => { if (o.isMesh) geos[k].add(o.geometry); }); }
      const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      const body = (o) => {   // its visible meshes: the lowest point, and the length along its own nose
        o.updateMatrixWorld(true);
        const e = o.matrixWorld.elements, f = new T.Vector3(e[8], e[9], e[10]).normalize(), v = new T.Vector3();
        let minY = Infinity, lo = Infinity, hi = -Infinity;
        o.traverse(c => { if (!c.isMesh || !c.geometry) return; for (let q = c; q && q !== o.parent; q = q.parent) if (!q.visible) return;
          const m = c.material; if (m && (m.visible === false || m.blending === T.AdditiveBlending)) return;
          c.geometry.boundingBox || c.geometry.computeBoundingBox(); const bb = c.geometry.boundingBox;
          for (let i = 0; i < 8; i++) { v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(c.matrixWorld);
            minY = Math.min(minY, v.y); const d = v.dot(f); lo = Math.min(lo, d); hi = Math.max(hi, d); } });
        return { minY, len: hi - lo, fx: -f.x, fz: -f.z };
      };
      const drawn = () => { const list = [], q = {};
        for (const o of L.scene.children) { if (!o.userData || !o.userData.rcRacer || !shown(o)) continue;
          let kind = o.userData.vk ? (o.userData.vk.userData.vkShape === "sedan" ? "grey" : o.userData.vk.userData.vkShape) : "built";
          o.traverse(c => { if (c.isMesh) for (const k of GLB) if (geos[k].has(c.geometry)) kind = k; });
          const r = R.racers.find(x => !x.isHim && x.mesh === o), pod = R.phase === "podium" && r && r.podPose;
          const row = { kind, racer: r ? r.key : null };
          if (r && GLB.includes(kind)) {
            const b = body(o); row.len = +b.len.toFixed(2);
            if (pod) { row.off = +Math.hypot(o.position.x - r.podPose.x, o.position.z - r.podPose.z).toFixed(2); row.gap = +(b.minY - r.podPose.y).toFixed(2); }
            else { L.rcPoint(r.s, r.lat, q); row.off = +Math.hypot(o.position.x - q.x, o.position.z - q.z).toFixed(2); row.gap = +(b.minY - q.y).toFixed(2);
              const a = L.rcAt(r.s, {}), yw = r.yaw + (r.spinA || 0), Fx = a.tx * Math.cos(yw) + a.lx * Math.sin(yw), Fz = a.tz * Math.cos(yw) + a.lz * Math.sin(yw);
              row.yawErr = +Math.abs(Math.atan2(b.fx * Fz - b.fz * Fx, b.fx * Fx + b.fz * Fz)).toFixed(3); row.giantK = +(r.giantK || 1).toFixed(2); row.spinA = +(r.spinA || 0).toFixed(2); }
          }
          list.push(row); }
        return list; };
      const standIns = () => { let n = 0; L.scene.traverse(o => { if (o.userData && o.userData.rcStandIn) n++; }); return n; };
      const step = (n) => { for (let i = 0; i < n; i++) { L.state.touching = true; L.state.ctrlBank = 0; L.state.ctrlPitch = 0; L.update(1 / 60); } };
      const toPodium = (at) => { const Ln = R.track.len, N = R.track.laps || L.RC.laps;
        for (const r of R.racers) { r.lapsDone = N - 1; r.s = r.isHim ? N * Ln - 12 : at[r.key] !== undefined ? N * Ln + at[r.key] : N * Ln - 250 - r.i * 10; }
        let f = 0; while (R.phase !== "podium" && f < 1800) { step(1); f++; } step(30);
        return R.podium ? R.podium.top.map(r => r.isHim ? "him" : r.key) : null; };`;
    const ev = (body, arg) => p2.evaluate(new Function("arg", `${drawnJs}\n${body}`), arg);
    const land = async (keys) => {
      for (const k of keys) if (held[k]) { await held[k].continue(); delete held[k]; }
      await p2.waitForFunction((ks) => ks.every(k => window.__lp.modelState[k] !== "loading"), keys, { timeout: 120000, polling: 100 });   // (polled on a clock: the page's rAF is stubbed)
      return p2.evaluate((ks) => ks.map(k => window.__lp.modelState[k]), keys);
    };
    const J2 = x => JSON.stringify(x);
    const rivals = (d) => d.filter(x => x.racer), kindOf = (d, k) => d.filter(x => x.racer === k);
    const real = (d, k) => kindOf(d, k).length === 1 && kindOf(d, k)[0].kind === k && kindOf(d, k)[0].off < 3;
    const noGrey = (d) => d.every(x => x.kind !== "grey");
    // (a) on the deck or its step as the same car is in a warm race: within 0.15 m of it, and within 0.35 of the deck
    const sits = (row, warm) => !!row && !!warm && Math.abs(row.gap) < 0.35 && Math.abs(row.gap - warm.gap) < 0.15;
    await c2.route(RX, r => { held[r.request().url().match(RX)[1]] = r; });

    // ---- load 1
    await boot();
    const L1 = {};
    L1.grid = await ev(`L.noRender = true; L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true); step(20);
      const was = GLB.map(k => L.modelState[k]);
      L.rcStartRace("oval", 4251); step(60 * 6);
      const car = R.racers.find(r => r.key === "car"), cyb = R.racers.find(r => r.key === "cybertruck");
      L.rcItGive(car, "giant"); L.rcItUse(car); step(50);
      window.rcItHit(cyb, null); step(25);
      return { was, phase: R.phase, drawn: drawn(), giantK: +car.giantK.toFixed(2), spinT: +cyb.spinT.toFixed(2) };`);
    L1.landedMid = await land(["car", "cybertruck"]);
    L1.mid = await ev(`step(1); return { phase: R.phase, drawn: drawn() };`);
    L1.top = await ev(`return toPodium({ car: 5, corvette: 2 });`);
    L1.landedPod = await land(["corvette"]);
    L1.podium = await ev(`step(30); return { phase: R.phase, drawn: drawn() };`);
    // the yardstick: a warm race (every body landed before its grid), mid-race and on its podium in the same order
    L1.warm = await ev(`L.raceReset(); step(10); L.rcStartRace("oval", 4252); step(60 * 6); const d = drawn(); return { drawn: d, standIns: standIns() };`);
    L1.warmTop = await ev(`return toPodium({ car: 5, corvette: 2 });`);
    L1.warmPod = await ev(`step(30); const d = drawn(); L.raceReset(); step(5); return { drawn: d };`);
    const w1 = (k) => kindOf(L1.warm.drawn, k)[0], wp = (k) => kindOf(L1.warmPod.drawn, k)[0];
    const carM = kindOf(L1.mid.drawn, "car")[0], cybM = kindOf(L1.mid.drawn, "cybertruck")[0];
    check(`race (C3, Q-10): a cold load with the rival bodies held past the grid -- the first race starts on grey stand-ins (${L1.grid.drawn.filter(x => x.kind === "grey").length} drawn, bodies ${L1.grid.was.join("/")}); the SUV's body landing mid-race while it is a giant (x${L1.grid.giantK}) and the Cybertruck's while it spins out are each drawn as itself where it races, wheels on the deck as in a warm race (SUV ${carM && carM.gap} m against ${w1("car") && w1("car").gap}, Cybertruck ${cybM && cybM.gap} against ${w1("cybertruck") && w1("cybertruck").gap}), the giant ${carM && (carM.len / w1("car").len).toFixed(2)}x the warm SUV's length, the spinning one pointing where its spin does (${cybM && cybM.yawErr} rad off, spun ${cybM && cybM.spinA} rad); the one still held stays a stand-in; the bodies that landed are "ready" (${L1.landedMid.join("/")})`,
      L1.grid.was.every(s => s === "loading") && L1.grid.phase === "race" && L1.grid.drawn.filter(x => x.kind === "grey").length === 3 && L1.grid.giantK > 1.5 && L1.grid.spinT > 0.2 &&
      L1.landedMid.every(s => s === "ready") && L1.mid.phase === "race" && rivals(L1.mid.drawn).length === 5 && L1.mid.drawn.filter(x => x.kind === "grey").length === 1 &&
      real(L1.mid.drawn, "car") && real(L1.mid.drawn, "cybertruck") && sits(carM, w1("car")) && sits(cybM, w1("cybertruck")) &&
      Math.abs(carM.len / w1("car").len - carM.giantK) < 0.08 * carM.giantK && cybM.yawErr < 0.05 && cybM.spinA > 0.3 && cybM.spinA < 6, J2({ grid: L1.grid, mid: L1.mid, warm: L1.warm.drawn }));
    const cvP = kindOf(L1.podium.drawn, "corvette")[0];
    check(`race (C3, Q-10): the Corvette's body landing on its podium step is drawn as itself, standing on the step and fitted to it as in a warm podium (bottom ${cvP && cvP.gap} m over the step against ${wp("corvette") && wp("corvette").gap}, ${cvP && cvP.len} m long against ${wp("corvette") && wp("corvette").len}), the SUV beside it as warm (${J2(kindOf(L1.podium.drawn, "car")[0])}), no grey stand-in drawn, the body "ready" (${L1.landedPod.join("/")}; podium ${J2(L1.top)}, warm ${J2(L1.warmTop)})`,
      L1.landedPod.every(s => s === "ready") && L1.podium.phase === "podium" && J2(L1.top) === J2(["car", "corvette", "him"]) && J2(L1.warmTop) === J2(L1.top) &&
      real(L1.podium.drawn, "corvette") && real(L1.podium.drawn, "car") && noGrey(L1.podium.drawn) &&
      sits(cvP, wp("corvette")) && Math.abs(cvP.len - wp("corvette").len) < 0.1 && sits(kindOf(L1.podium.drawn, "car")[0], wp("car")) && Math.abs(kindOf(L1.podium.drawn, "car")[0].len - wp("car").len) < 0.1,
      J2({ podium: L1.podium, warmPod: L1.warmPod }));
    check(`race (C3, Q-10): the next race after a cold load -- every rival drawn as its own car (${rivals(L1.warm.drawn).map(x => x.kind).join(", ")}), no grey stand-in drawn or left in the scene (${L1.warm.standIns})`,
      rivals(L1.warm.drawn).length === 5 && GLB.every(k => real(L1.warm.drawn, k)) && noGrey(L1.warm.drawn) && L1.warm.standIns === 0, J2(L1.warm));

    // ---- load 2
    await boot();
    const L2 = {};
    L2.top = await ev(`L.noRender = true; L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true); step(20);
      L.rcStartRace("oval", 4254); step(60 * 6); return toPodium({ car: 5, corvette: 2 });`);
    L2.landedPod = await land(["cybertruck"]);
    L2.podium = await ev(`step(30); return { phase: R.phase, drawn: drawn() };`);
    L2.left = await ev(`L.raceReset(); step(10); return { on: L.raceOn(), racers: R.racers.length };`);
    L2.landedFree = await land(["car", "corvette"]);
    L2.next = await ev(`step(10); const free = standIns(); L.rcStartRace("oval", 4255); step(60 * 6); const d = drawn(), s = standIns(); L.raceReset(); step(5); return { free, drawn: d, standIns: s };`);
    check(`race (C3, Q-10): the Cybertruck's body landing on the podium while it is OFF the podium stays undrawn (${kindOf(L2.podium.drawn, "cybertruck").length} drawn; on the steps, still held, ${kindOf(L2.podium.drawn, "car").concat(kindOf(L2.podium.drawn, "corvette")).map(x => x.kind).join(" and ")}), the body "ready" (${L2.landedPod.join("/")}; podium ${J2(L2.top)})`,
      L2.landedPod.every(s => s === "ready") && L2.podium.phase === "podium" && J2(L2.top) === J2(["car", "corvette", "him"]) && kindOf(L2.podium.drawn, "cybertruck").length === 0 && rivals(L2.podium.drawn).length === 2,
      J2(L2.podium));
    check(`race (C3, Q-10): bodies landing BETWEEN races (the race left, ${L2.left.racers} racers, in free play) -- no stand-in left in the scene (${L2.next.free} then ${L2.next.standIns}), and the next race has every rival as its own car once (${rivals(L2.next.drawn).map(x => x.kind).join(", ")}), the bodies "ready" (${L2.landedFree.join("/")})`,
      !L2.left.on && L2.left.racers === 0 && L2.landedFree.every(s => s === "ready") && L2.next.free === 0 && L2.next.standIns === 0 &&
      rivals(L2.next.drawn).length === 5 && GLB.every(k => real(L2.next.drawn, k)) && noGrey(L2.next.drawn), J2({ left: L2.left, next: L2.next }));

    // ---- load 3: a body that never arrives -- the race still starts, runs its laps and finishes, on the stand-ins
    await c2.unroute(RX); await c2.route(RX, r => r.abort());
    await boot();
    const never = await ev(`L.noRender = true; L.api.setVehicle("monster"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.api.setView(true); step(20);
      const ms = GLB.map(k => L.modelState[k]); L.rcStartRace("oval", 4253);
      let f = 0, raced = false; while (R.phase !== "podium" && f < 60 * 400) { step(1); f++; if (R.phase === "race") raced = true; }
      const out = { ms, raced, phase: R.phase, seconds: +(f / 60).toFixed(0), done: R.racers.filter(r => r.done).length, n: R.racers.length, bangs: R.bangs, drawn: drawn().filter(x => x.racer).map(x => x.kind) };
      L.raceReset(); step(5); return out;`);
    check(`race (C3, Q-10): a rival body that never arrives (the download fails) -- the race still starts, runs and finishes on the stand-ins (${never.seconds} s to the podium, ${never.done}/${never.n} home, bodies ${never.ms.join("/")})`,
      never.ms.every(s => s === "failed") && never.raced && never.phase === "podium" && never.done === never.n && never.bangs === 0, J2(never));
    const errs = e2.filter(e => !/Failed to load resource|ERR_FAILED|could not load/.test(e));
    if (errs.length) check("race audit (C3): no page errors on the cold-load page", false, errs.slice(0, 5));
    await c2.close();
  }
};
