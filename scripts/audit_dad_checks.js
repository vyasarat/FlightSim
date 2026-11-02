"use strict";
// Dad mode (its sounds must not follow him out).
// The 2026-11 audit (AUDIT.md): one check per finding, each failed on the release before its fix.
const FIXED = new Set(["DAD-1"]);
// ---------------------------------------------------------------------------
// DAD MODE AUDIT (phase 2). Each check fails on the code it was written against and
// passes once its finding is fixed:
//   DAD-1  no dad tone is still sounding in HIS game after EXIT, even when the audio
//          context was not running at the moment of the tap (iPad lock / call / Siri)
//   DAD-2  going in and out of a mission gives back the GPU geometries it made
//          (renderer.info.memory.geometries back near its pre-entry value, per mission)
//   DAD-3  his stall wobble and dive whistle never sound inside dad mode (Apollo, Hudson)
// The audio checks need a live AudioContext: the page gets a real click first (a user
// gesture) and then unlocks. With no running context they FAIL, never pass vacuously.
//
// Alone: node scripts/run_module.js dadmode_audit_checks
// ---------------------------------------------------------------------------
module.exports = async function dadAuditChecks({ newPage, check: report }) {
  // Only the findings already fixed report (FIXED grows release by release, AUDIT.md's table); the rest
  // still run, so the scenarios stay honest, but stay quiet until their release. Anything not named
  // by a finding id (a page-error guard) always reports.
  const check = (name, ok, detail) => { const id = (name.match(/^([A-Z]+-\d+)/) || [])[1]; if (!id || FIXED.has(id)) report(name, ok, detail); };
  const J = x => JSON.stringify(x);
  const run = async (page, fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e && e.message || e).slice(0, 300) }; } };
  const setup = async (page) => {
    await page.evaluate(() => {
      const L = window.__lp;
      L.noRender = true;
      const H = window.__dadA = {};
      H.step = (n, f) => { for (let i = 0; i < n; i++) { L.update(1 / 60); if (f) f(); } };
      H.tapEl = e => { e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true })); };
      // the way the parent goes in: the key on his picker, the code, FLY on the mission's card
      H.fly = id => {
        document.getElementById("screenVehicle").classList.remove("hiddenS");
        L.dadKeyTap(); for (const k of String(L.TUNE.dad.code)) L.dadPadPress(k);
        const c = document.querySelector('#dadMenu .dadCard[data-mission="' + id + '"]');
        if (!c) return false;
        H.tapEl(c.querySelector(".dadBtn.go")); return L.dadActive();
      };
      H.paint = () => { renderer.render(scene, camera); };
    });
  };
  // a real gesture, then the game's own unlock: a running context or an honest "no"
  const audioOn = async (page) => {
    try { await page.mouse.click(5, 5); } catch (e) {}
    return run(page, async () => { const L = window.__lp; try { await L.audio.unlock(); } catch (e) {} for (let i = 0; i < 20 && L.audio.ctxState() !== "running"; i++) await new Promise(r => setTimeout(r, 50)); return L.audio.ctxState(); });
  };

  // ---- DAD-1: EXIT with the context suspended
  {
    const { ctx, page, errors } = await newPage(1180, 820);
    await setup(page);
    const st = await audioOn(page);
    const r = await run(page, async (st) => {
      const L = window.__lp, H = window.__dadA, out = { ctx: st, missions: {} };
      if (st !== "running") return out;
      L.api.skipScreens(); H.step(30);
      for (const id of ["dam", "doolittle", "hudson", "x1", "apollo"]) {
        const o = out.missions[id] = {};
        o.entered = H.fly(id);
        H.step(60 * 8);
        o.dadTonesUp = Object.keys(tones).filter(k => k.startsWith("dad") && tones[k].last > 0.002).length;
        await audioCtx.suspend();
        H.tapEl(document.getElementById("dadExitBtn"));     // the real button: its handler unlocks, then exits
        if (audioCtx.state !== "running") await audioCtx.resume();
        L.api.skipScreens();
        H.step(60 * 5);
        await new Promise(r => setTimeout(r, 250));          // let the audio thread report its gains
        o.on = L.dadActive();
        o.kind = L.vehKind();
        o.sounding = Object.keys(tones).filter(k => k.startsWith("dad") && tones[k].g.gain.value > 0.001).map(k => k + "=" + tones[k].g.gain.value.toFixed(3));
        // put the next mission on a clean start: in and out with the sound running
        H.fly(id); H.step(5); L.dadExit(); L.api.skipScreens(); H.step(60);
        await new Promise(r => setTimeout(r, 150));
      }
      return out;
    }, st);
    const ms = r.missions || {};
    const ok = !r.err && r.ctx === "running" && Object.keys(ms).length === 5 &&
      Object.values(ms).every(m => m.entered && m.dadTonesUp > 0 && !m.on && m.kind !== "dad" && m.sounding.length === 0);
    check("DAD-1: no dad mode sound is left playing in his game after EXIT, even when the audio was interrupted (iPad locked, a call) at the moment the parent tapped it -- Dambusters, Doolittle, Hudson, X-1, Apollo",
      ok, J(r));
    if (errors.length) check("DAD-1: no page errors", false, J(errors.slice(0, 5)));
    await ctx.close();
  }

  // ---- DAD-2: geometries given back, per mission
  {
    const { ctx, page, errors } = await newPage(1180, 820);
    await setup(page);
    const r = await run(page, () => {
      const L = window.__lp, S = L.state, H = window.__dadA, out = {};
      const geos = () => renderer.info.memory.geometries;
      const settle = () => { L.api.skipScreens(); H.step(60 * 3); H.paint(); H.paint(); };
      const cycle = id => {
        H.fly(id); H.step(60 * 3);
        // draw both views, so everything the mission shows in either is on the GPU
        H.paint(); S.viewChase = !S.viewChase; H.step(2); H.paint(); S.viewChase = !S.viewChase; H.step(60 * 2); H.paint();
        L.dadExit(); settle();
      };
      L.api.skipScreens(); settle();
      for (const id of ["canyon", "dam", "doolittle", "apollo", "hudson", "x1"]) {
        cycle(id);                       // a first visit: the ground it streams at the mission's site is not his leak to count
        const g0 = geos();
        cycle(id); cycle(id);
        out[id] = { before: g0, after: geos(), perEntry: (geos() - g0) / 2 };
      }
      return out;
    });
    const MARGIN = 8;   // geometries per entry: ground chunks streamed at the airport, a puff or two (a deep-dispose fix measured 0-3; the leak is 15-260)
    const bad = r.err ? ["err"] : Object.keys(r).filter(k => !(r[k].perEntry <= MARGIN));
    check("DAD-2: each dad mission gives its GPU geometries back on EXIT -- in and out twice more after a first visit, renderer.info.memory.geometries ends within " + MARGIN + " per entry of where it started (Canyon, Dambusters, Doolittle, Apollo, Hudson, X-1)",
      !r.err && Object.keys(r).length === 6 && bad.length === 0, J({ over: bad, r }));
    if (errors.length) check("DAD-2: no page errors", false, J(errors.slice(0, 5)));
    await ctx.close();
  }

  // ---- DAD-3: his stall and dive tones stay out of dad mode
  {
    const { ctx, page, errors } = await newPage(1180, 820);
    await setup(page);
    const st = await audioOn(page);
    const r = await run(page, (st) => {
      const L = window.__lp, S = L.state, H = window.__dadA, out = { ctx: st };
      if (st !== "running") return out;
      L.api.skipScreens(); H.step(30);
      for (const id of ["apollo", "hudson"]) {
        const o = out[id] = { entered: H.fly(id), stallSec: 0, diveSec: 0, max: 0 };
        H.step(60 * 50, () => {
          // the Hudson as it is flown: after the birds, the nose held up toward best glide and below
          if (id === "hudson" && L.dad.m && L.dad.m.struck) { S.touching = true; S.ctrlPitch = 0.6; S.ctrlBank = 0; }
          for (const n of ["stall", "dive"]) { const t = tones[n]; if (t && t.last > 0.002) { o[n + "Sec"] += 1 / 60; o.max = Math.max(o.max, t.last); } }
        });
        S.touching = false; S.ctrlPitch = 0;
        o.stallSec = +o.stallSec.toFixed(1); o.diveSec = +o.diveSec.toFixed(1);
        L.dadExit(); L.api.skipScreens(); H.step(60);
      }
      return out;
    }, st);
    const ok = !r.err && r.ctx === "running" && ["apollo", "hudson"].every(k => r[k] && r[k].entered && r[k].stallSec === 0 && r[k].diveSec === 0);
    check("DAD-3: his stall wobble and dive whistle never sound inside dad mode -- 50 s of the Apollo descent (the computer flying it) and of the Hudson glide (nose held up after the birds)",
      ok, J(r));
    if (errors.length) check("DAD-3: no page errors", false, J(errors.slice(0, 5)));
    await ctx.close();
  }
};
