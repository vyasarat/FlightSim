"use strict";
// Buttons, HUD and audio.
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["HUD-2", "HUD-3", "HUD-4", "HUD-8", "HUD-1"]);
// HUD / input / audio audit (phase 2): one check per finding, each FAILS on 15b239d and passes once fixed.
// Taps are dispatched as touch PointerEvents on whatever elementFromPoint says is under the finger, with the
// pointerup going to the pointerdown's target (touch pointers are implicitly captured), and game frames
// stepped between the two taps of a double tap.
module.exports = async function hudAuditChecks({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table); the rest
  // still run, so the scenarios stay honest, but stay quiet until their release. Anything not named
  // by a finding id (a page-error guard) always reports.
  // (v227, Q-30 f) the detail goes out as a string: the harness prints it by concatenation, and an object read "[object Object]"
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail === undefined || typeof detail === "string" ? detail : JSON.stringify(detail)); };
  // shared page helpers, installed into the page
  const install = () => {
    const L = window.__lp; L.noRender = true;
    window.__step = (n) => { for (let i = 0; i < n; i++) L.update(1 / 60); };
    window.__tapAt = (x, y, id) => {
      const t = document.elementFromPoint(x, y);
      const o = { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
      if (t) { t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); }
      return t ? (t.id || (t.closest("[id],[class]") && (t.closest("[id]") || {}).id) || t.tagName) : null;
    };
    window.__relaunch = (key, o) => { L.openPickerAnywhere(); L.api.skipScreens(); L.api.setVehicle(key); L.api.spawnAt(o || 0, o || 0); };
  };
  const unlock = async (page) => {
    await page.evaluate(() => window.__lp.audio.unlock());
    await page.waitForFunction(() => window.__lp.audio.ctxState() === "running", null, { timeout: 10000 }).catch(() => {});
    return page.evaluate(() => window.__lp.audio.ctxState());
  };
  // a tone's level: what was last asked of it, and where the graph actually is (after a real-time settle)
  const toneLevel = (page, name) => page.evaluate((n) => {
    const t = tones[n]; return t ? { last: +t.last.toFixed(4), live: +t.g.gain.value.toFixed(4) } : { last: 0, live: 0 };
  }, name);

  // ======================= page A: the mix =======================
  {
    const { ctx, page, errors } = await newPage(1024, 768);
    await page.evaluate(install);
    const st = await unlock(page);
    if (st !== "running") check("HUD-audio: the AudioContext runs in this page (precondition)", false, { state: st });

    // ---- HUD-8: a tone silenced while the context is suspended is silent once it resumes
    await page.evaluate(() => setTone("auditTone", "sine", 220, 0.1));
    await page.waitForTimeout(700);
    await page.evaluate(async () => { await audioCtx.suspend(); setTone("auditTone", "sine", 220, 0); await audioCtx.resume(); });
    await page.waitForTimeout(900);
    const h8 = await toneLevel(page, "auditTone");
    check("HUD-8: a tone set to silence while the AudioContext is suspended is silent once it resumes", h8.live < 0.01, h8);
    await page.evaluate(() => { tones.auditTone.g.gain.value = 0; tones.auditTone.last = 0; });

    // ---- HUD-7: the engine voice falls away during a bang
    const h7 = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("fighter"); L.api.teleportAirborne(3000, 0, 400, 0); __step(30);
      for (let i = 0; i < 900 && !st.exploding; i++) { L.api.setStick(0, -1); st.pitch = -40; L.update(1 / 60); }
      L.api.clearStick();
      const lvl = () => { const e = L.audio.engine(); return +(e.out * (e.idle + e.high)).toFixed(5); };
      const atBang = lvl(); __step(30);
      const r = { exploded: st.exploding, atBang, intoBang: lvl() };
      while (st.exploding) L.update(1 / 60);
      return r;
    });
    check("HUD-7: half a second into a crash the engine voice has fallen to under half what it was at the bang",
      h7.exploded && h7.intoBang < 0.5 * h7.atBang, h7);

    // ---- HUD-2: leaving mid-re-entry for another vehicle leaves no glow and no roar
    await page.evaluate(() => {
      const L = window.__lp;
      L.api.setVehicle("rocket"); L.api.spawnAt(0, 0); __step(30);
      rk.reentry = 0.8; reentryOverlay(); setReentryRoar(0.8);   // the moment he taps the menu, glowing
      __relaunch("car", 0); __step(300);
    });
    await page.waitForTimeout(1200);
    const h2 = await page.evaluate(() => ({ glow: +(el.reentryGlow.style.opacity || 0),
      roarLast: reentryNodes ? +reentryNodes.last.toFixed(3) : 0, roarLive: reentryNodes ? +reentryNodes.g.gain.value.toFixed(3) : 0 }));
    check("HUD-2: picked the car from the menu mid-re-entry, five seconds later there is no re-entry glow on screen and no re-entry roar",
      h2.glow < 0.02 && Math.min(h2.roarLast, h2.roarLive) < 0.01, h2);

    // ---- HUD-3: leaving the demolition mid-countdown or mid-fold leaves no numeral and no rumble behind
    const h3a = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.api.setVehicle("prop"); st.x = demo.x - 600; st.z = demo.z; st.y = 400; st.phase = "AIRBORNE"; st.speed = 60; __step(30);
      // (v226, B6) a missile into the block waits while another count holds the numeral (the barge's, started at his
      // new start by the relaunch above): the harness's trigger asks for it free first, as a missile now does
      for (let i = 0; i < 60 * 12 && L.spCountBusy("demolition"); i++) L.update(1 / 60);
      const trig = L.demoTrigger(); __step(60);
      const before = el.bigNum.classList.contains("on") ? el.bigNum.textContent : "";
      __relaunch("prop", 0);
      const atStart = el.bigNum.classList.contains("on") ? el.bigNum.textContent : "";   // the moment he lands at his new start
      // whose numeral is it: another set-piece may start its own count at his new start (the fireworks
      // barge does at New York) -- what must not be there is the demolition's
      let demoWrites = 0; const ct = window.countdownTo;
      window.countdownTo = function () { if (/updateDemolition/.test(new Error().stack)) demoWrites++; return ct.apply(this, arguments); };
      try { __step(60); } finally { window.countdownTo = ct; }
      const demoNum = before !== "" && el.bigNum.classList.contains("on") && demoWrites > 0;
      return { trig, before, atStart, demoPhase: demo.phase, demoWrites, after: demoNum ? el.bigNum.textContent : "" };
    });
    check("HUD-3: a second after he leaves the demolition mid-countdown, its numeral is gone from his screen",
      h3a.trig && h3a.before !== "" && h3a.atStart === "" && h3a.demoWrites === 0 && h3a.demoPhase !== "charging", h3a);
    const h3b = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      for (let i = 0; i < 900 && demo.phase !== "armed"; i++) L.update(1 / 60);
      L.api.setVehicle("prop"); st.x = demo.x - 600; st.z = demo.z; st.y = 400; st.phase = "AIRBORNE"; st.speed = 60; __step(30);
      for (let i = 0; i < 60 * 12 && L.spCountBusy("demolition"); i++) L.update(1 / 60);   // (v226) as above
      const trig = L.demoTrigger();
      for (let i = 0; i < 900 && demo.phase !== "folding"; i++) L.update(1 / 60);
      __step(20);
      const folding = demo.phase, rumble = +(tones.demo ? tones.demo.last : 0).toFixed(3);
      __relaunch("prop", 0); __step(600);
      return { trig, folding, rumbleAtFold: rumble };
    });
    await page.waitForTimeout(1000);
    const h3c = await toneLevel(page, "demo");
    check("HUD-3: ten seconds after he leaves the demolition while its towers fold, its rumble is silent",
      h3b.trig && h3b.folding === "folding" && h3b.rumbleAtFold > 0.01 && Math.min(h3c.last, h3c.live) < 0.01, { ...h3b, after: h3c });

    // ---- HUD-4: relaunched from the harbour, the harbour's crane hum does not come with him
    const h4 = await page.evaluate(() => {
      const L = window.__lp;
      L.api.setVehicle("speedboat"); boatSpawn(); __step(240);
      const at = +(tones.hbCrane ? tones.hbCrane.last : 0).toFixed(4);
      __relaunch("prop", 0); __step(120);
      return { atHarbour: at, pos: [Math.round(L.state.x), Math.round(L.state.z)] };
    });
    await page.waitForTimeout(1000);
    const h4b = await toneLevel(page, "hbCrane");
    check("HUD-4: relaunched from the harbour to New York, the harbour crane's hum is silent there",
      h4.atHarbour > 0.005 && Math.min(h4b.last, h4b.live) < 0.002, { ...h4, after: h4b });

    if (errors.length) check("HUD-audio page: no page errors", false, errors.slice(0, 5));
    await ctx.close();
  }

  // ======================= page B: taps =======================
  {
    const { ctx, page, errors } = await newPage(1024, 768);
    await page.evaluate(install);

    // ---- HUD-1: a double tap on the menu button never opens anything of dad mode
    const h1 = await page.evaluate(() => {
      const L = window.__lp;
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); __step(10);
      const r = el.menuBtn.getBoundingClientRect(), x = r.left + r.width * 0.25, y = r.top + r.height * 0.7;
      const first = __tapAt(x, y, 11); __step(6);          // a tenth of a second between his two taps
      const second = __tapAt(x, y, 12); __step(2);
      const out = { first, second, picker: L.menuOpen(), pad: !!document.getElementById("dadPad") || !!(dad.pad && dad.pad.open) };
      if (document.getElementById("dadPad")) dadPadClose();
      L.api.skipScreens(); __step(2);
      return out;
    });
    check("HUD-1: a double tap on the menu button opens the vehicle picker and nothing of dad mode (no code pad)",
      h1.picker && !h1.pad, h1);

    // ---- HUD-5: on the picker, nothing at the horn's spot honks
    const h5 = await page.evaluate(() => {
      const L = window.__lp;
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); __step(30);
      const r = el.hornBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const horns0 = L.flags.carHorns || 0;
      L.openPickerAnywhere(); __step(5);
      const top = document.elementFromPoint(x, y), hit = __tapAt(x, y, 21); __step(3);
      const out = { inCar: r.width > 0, menuOpen: L.menuOpen(), topIsHorn: !!(top && top.closest("#hornBtn")), honked: (L.flags.carHorns || 0) - horns0, hit };
      L.carHornRelease(); L.api.skipScreens(); __step(2);
      return out;
    });
    check("HUD-5: with the picker open over the car, tapping where the horn was does not honk (the horn is not on the picker)",
      h5.inCar && h5.menuOpen && !h5.topIsHorn && h5.honked === 0, h5);

    // ---- HUD-6: a double tap on a vehicle card leaves the direction screen waiting for his choice
    const h6 = await page.evaluate(() => {
      const L = window.__lp;
      const show = (s) => { for (const k of ["screenVehicle", "screenDir", "screenDest"]) el[k].classList.toggle("hiddenS", k !== s); };
      // a card whose centre sits over a direction card: those are the ones a double tap carries through
      show("screenVehicle");
      const cards = [...document.querySelectorAll(".vehCard")].filter(c => !c.classList.contains("hiddenS"))
        .map(c => { const r = c.getBoundingClientRect(); return { v: c.dataset.v, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      show("screenDir");
      const over = cards.filter(p => { const e = document.elementFromPoint(p.x, p.y); return e && e.closest(".dirCard"); });
      show("screenVehicle");
      if (!over.length) return { over: 0 };
      const p = over.find(c => c.v === "prop") || over[0];
      const spawns0 = L.flags.repositioned;
      const first = __tapAt(p.x, p.y, 31); __step(12);   // a fifth of a second later, the second tap
      const second = __tapAt(p.x, p.y, 32); __step(2);
      const out = { over: over.length, card: p.v, first, second, dirWaiting: !el.screenDir.classList.contains("hiddenS"),
        vehicle: L.state.vehicleKey };
      L.api.skipScreens(); __step(2);
      return out;
    });
    check("HUD-6: a double tap on a vehicle card picks the vehicle and leaves the direction screen up, waiting for his own choice",
      h6.over > 0 && h6.dirWaiting, h6);

    if (errors.length) check("HUD-taps page: no page errors", false, errors.slice(0, 5));
    await ctx.close();
  }

  // ======================= page B': the menu button by REAL touches, both ways up =======================
  // (v215) HUD-1 as his finger does it: touches through the browser's own input (CDP), so the pointer
  // events, their targets and the implicit capture are the browser's, not ours. A double tap; ten taps
  // mashed on the same spot; and the parent's way in still works -- the picker up a moment, then the star.
  for (const [w, h, way] of [[1024, 768, "landscape"], [768, 1024, "portrait"]]) {
    const { ctx, page, errors } = await newPage(w, h);
    await page.evaluate(install);
    const cdp = await page.context().newCDPSession(page);
    const touch = async (x, y) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const frames = (n) => page.evaluate((n) => __step(n), n);
    const look = () => page.evaluate(() => ({ picker: window.__lp.menuOpen(), pad: !!document.getElementById("dadPad"), lockT: +dad.pad.lockT.toFixed(1), wrong: dad.pad.wrong, menu: !!dad.menu }));
    const at = await page.evaluate(() => {
      const L = window.__lp;
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0); __step(10);
      const r = el.menuBtn.getBoundingClientRect();
      return { x: Math.round(r.left + r.width * 0.25), y: Math.round(r.top + r.height * 0.7) };
    });
    // a double tap: a tenth of a second between
    await touch(at.x, at.y); await frames(6); await touch(at.x, at.y); await frames(2);
    const dbl = await look();
    await page.evaluate(() => { if (document.getElementById("dadPad")) dadPadClose(); window.__lp.api.skipScreens(); __step(30); });
    // mashed: taps about seven a second, for well over twice the star's wait (TUNE.dad.keyCalm) -- a
    // mash shorter than the wait would pass even if a tap did not restart it
    const calm = await page.evaluate(() => window.__lp.TUNE.dad.keyCalm);
    const mashN = Math.ceil(calm * 2.5 * 60 / 9) + 1;
    let mashPadSeen = false;
    let underTap = null;
    for (let i = 0; i < mashN; i++) {
      await touch(at.x, at.y); await frames(9); if ((await look()).pad) mashPadSeen = true;
      // (v215) once the picker is up, what is under his finger there IS the star -- or the mash proves nothing
      if (i === 0) underTap = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return { picker: window.__lp.menuOpen(), star: !!(e && e.closest("#dadKey")), el: e ? e.id || e.tagName : null }; }, at);
    }
    const mash = { ...(await look()), taps: mashN, secs: +(mashN * 9 / 60).toFixed(2), keyCalm: calm };
    await page.evaluate(() => { if (document.getElementById("dadPad")) dadPadClose(); window.__lp.api.skipScreens(); __step(30); });
    // the parent: the menu, a moment's look at the cards, then the star in the corner
    await touch(at.x, at.y); await frames(150);
    const star = await page.evaluate(() => { const r = document.getElementById("dadKey").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    await touch(star.x, star.y); await frames(2);
    const parent = await look();
    // (v215) the parent's way in, as before v215 once the picker has been up: the pad closed, the star
    // opens it again at once; after a wrong code likewise; during a lockout the star shakes (a tap during
    // a lockout before the picker's wait is over does nothing at all -- no shake -- which is accepted)
    const tapStar = async () => { await touch(star.x, star.y); await frames(2); return page.evaluate(() => ({ pad: !!document.getElementById("dadPad"), shake: document.getElementById("dadKey").classList.contains("shake"), lockT: +dad.pad.lockT.toFixed(1) })); };
    await page.evaluate(() => dadPadClose());
    const again = await tapStar();
    await page.evaluate(() => { const c = String(window.__lp.TUNE.dad.code), w = c === "0000" ? "1111" : "0000"; for (const k of w) dadPadPress(k); });
    const afterWrong = { wrong: await page.evaluate(() => dad.pad.wrong), ...(await tapStar()) };
    await page.evaluate(() => { const c = String(window.__lp.TUNE.dad.code), w = c === "0000" ? "1111" : "0000"; for (let n = 0; n < 3 && dad.pad.lockT === 0; n++) { if (!document.getElementById("dadPad")) dadKeyTap(); for (const k of w) dadPadPress(k); } document.getElementById("dadKey").classList.remove("shake"); });
    const inLockout = await tapStar();
    await page.evaluate(() => { if (document.getElementById("dadPad")) dadPadClose(); dad.pad.lockT = 0; dad.pad.wrong = 0; dadKeyDraw(); window.__lp.api.skipScreens(); __step(2); });
    const way2 = { again, afterWrong, inLockout, note: "a tap in a lockout before keyCalm gives no shake (accepted)" };
    const tag = way === "portrait" ? "portrait 768x1024" : "landscape 1024x768";
    check(`HUD-1: by real touches (${tag}) a double tap on the menu button opens the vehicle picker and nothing of dad mode; taps mashed there for 2.5x the star's wait never open the code pad nor lock it; the parent's way in still opens it -- and again at once after he closes it or a wrong code, and in a lockout the star shakes`,
      dbl.picker && !dbl.pad && !!underTap && underTap.picker && underTap.star && !mashPadSeen && !mash.pad && mash.lockT === 0 && mash.wrong === 0 && parent.pad &&
      again.pad && afterWrong.wrong === 1 && afterWrong.pad && inLockout.lockT > 0 && !inLockout.pad && inLockout.shake,
      { dbl, underTap, mashPadSeen, mash, parent, way2, at, star });
    check(`HUD-touch page (${way}): no page errors`, errors.length === 0, errors.slice(0, 5));
    await ctx.close();
  }

  // ======================= page C: turning the iPad mid-drag =======================
  {
    const { ctx, page, errors } = await newPage(390, 844);
    await page.evaluate(install);
    await page.evaluate(() => {
      const L = window.__lp; L.api.setVehicle("car"); L.api.spawnAt(0, 0); __step(20);
      const o = { pointerId: 41, clientX: 200, clientY: 600, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
      el.gl = el.gl || document.getElementById("gl");
      document.getElementById("gl").dispatchEvent(new PointerEvent("pointerdown", o));
      __step(5);
    });
    await page.setViewportSize({ width: 844, height: 390 });
    const h9 = await page.evaluate(() => {
      const L = window.__lp; __step(5);
      // the same finger, not moved on the glass: portrait (200, 600) is landscape (600, 390 - 200)
      const o = { pointerId: 41, clientX: 601, clientY: 190, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
      document.getElementById("gl").dispatchEvent(new PointerEvent("pointermove", o));
      __step(2);
      const out = { touching: L.state.touching, bank: +L.state.ctrlBank.toFixed(2), pitch: +L.state.ctrlPitch.toFixed(2) };
      document.getElementById("gl").dispatchEvent(new PointerEvent("pointerup", o)); __step(2);
      return out;
    });
    check("HUD-9: a finger held still while the iPad turns does not become a steer (|stick| < 0.2 after a 1 px move)",
      Math.abs(h9.bank) < 0.2 && Math.abs(h9.pitch) < 0.2, h9);
    await page.setViewportSize({ width: 390, height: 844 });
    if (errors.length) check("HUD-rotate page: no page errors", false, errors.slice(0, 5));
    await ctx.close();
  }
};
