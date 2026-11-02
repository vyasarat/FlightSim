"use strict";
// The race.
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["RACE-3"]);
// ---------------------------------------------------------------------------
// RACE AUDIT (2026-11): four things a race left wrong, each a check that fails until fixed.
//   RACE-1  at the car wash he is never offered a race that cannot run (flag hidden, or its clock runs)
//   RACE-2  his car's body arriving mid-race sits on the deck, not over it
//   RACE-3  out of a race, no race tone keeps sounding -- even when the EXIT tap came while audio was not running
//   RACE-4  on the podium his car is never drawn giant
// One page; every scenario sets its own vehicle and spot and leaves the race off.
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
    let opened = false, clock = null;
    if (offered) {
      L.raceOpenPicker();
      opened = !document.getElementById("screenRace").classList.contains("hiddenS");
      if (opened) { L.rcStartRace("oval", 4242); const t0 = R.t; step(180, true); clock = +(R.t - t0).toFixed(2); }
    }
    const out = { started, washOn: !!L.toyWorld.wash, offered, opened, raceClockIn3s: clock };
    L.raceReset(); for (let i = 0; i < 900 && L.toyWorld.wash; i++) step(1);
    return out;`));
  check("RACE-1: at the car wash he is never offered a race that cannot run (no flag, or the race's clock runs)",
    r1.started && (!r1.offered || !r1.opened || r1.raceClockIn3s > 2.5), r1);

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
};
