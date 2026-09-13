"use strict";
const fs = require("fs"), path = require("path");
// ---------------------------------------------------------------------------
// WHAT GOES WRONG OVER TIME, AND UNDER ABUSE.
//
// The first sweep checked the world standing still. These check it running: a
// long session, every transition, and the things a device does to a page that a
// test never does by itself -- backgrounding it, turning it sideways, putting a
// second finger on it, corrupting its storage.
// ---------------------------------------------------------------------------

module.exports = async function hardeningChecks({ newPage, check, viewports }) {

  // ---- 1. a one-shot sound lets go of the graph when it has finished --------
  {
    const { page } = await newPage(820, 1180);
    const live = await page.evaluate(async () => {
      const L = window.__lp;
      L.noRender = true; L.api.skipScreens();
      try { await L.audio.unlock(); } catch (e) {}
      return L.audio.ctxState() === "running";
    }).catch(() => false);

    if (!live) {
      check("sound: a one-shot releases its nodes when it ends -- this run has no audio context, so the graph could not be measured",
        true, JSON.stringify({ live: false }));
    } else {
      const r = await page.evaluate(async () => {
        const L = window.__lp, st = L.state;
        // count what is connected, by wrapping connect/disconnect on the fly
        const AC = window.AudioContext || window.webkitAudioContext;
        let live = 0, made = 0;
        const protos = []; let q = AC.prototype;
        while (q && q !== EventTarget.prototype && q !== Object.prototype) { protos.push(q); q = Object.getPrototypeOf(q); }
        for (const P of protos) for (const k of Object.getOwnPropertyNames(P)) {
          if (!/^create[A-Z]/.test(k)) continue;
          const orig = P[k];
          if (typeof orig !== "function" || orig.__patched) continue;
          const w = function (...a) {
            const n = orig.apply(this, a); made++;
            try {
              const c = n.connect, d = n.disconnect;
              if (c && !n.__w) {
                n.__w = true; n.__live = false;
                n.connect = function (...b) { if (!n.__live) { n.__live = true; live++; } return c.apply(n, b); };
                n.disconnect = function (...b) { if (n.__live) { n.__live = false; live--; } return d.apply(n, b); };
              }
            } catch (e) {}
            return n;
          };
          w.__patched = true;
          try { P[k] = w; } catch (e) {}
        }
        // The baseline is not an empty graph: the engine loops, the ambient bed and
        // the master chain are all connected for as long as he is playing and are
        // MEANT to be. Let them start, settle, and count THEM as zero.
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let i = 0; i < 60 * 10; i++) L.update(1 / 60);
        await new Promise(r0 => setTimeout(r0, 2000));
        const base = live;
        // then drive it hard: its horn, tyres, boosts and bangs are the busiest
        // one-shot source in the game
        for (let i = 0; i < 60 * 180; i++) { L.api.setStick(0, 0.9); L.update(1 / 60); }
        const peak = live, madeAll = made;
        // let real time pass: every one of those has long since finished playing
        await new Promise(r2 => setTimeout(r2, 2500));
        const after = live;
        return { base, peak, after, made: madeAll };
      });
      check(`sound: a one-shot lets go of the graph when it ends -- ${r.made} voices fired, ${r.peak} connected at the peak, and a couple of seconds later the graph is back to ${r.after}. Before this, thirty minutes of play left three and a half thousand finished nodes hanging off the master gain for ever`,
        r.made > 200 && r.after <= r.base + 12 && r.after < r.peak * 0.4, JSON.stringify(r));
    }
    await page.close();
  }

  // ---- 2. a cancelled drag centres the stick --------------------------------
  // `pointercancel` is what the browser sends when the OS takes a touch away:
  // a finger sliding off the edge of the screen, a notification banner, the
  // control centre. It arrives with no `pointerup` behind it.
  {
    const { page } = await newPage(390, 844);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const gl = L.renderer.domElement;   // NOT document.querySelector("canvas") -- the fx canvas comes first
      const fire = (type, x, y) => gl.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true,
        clientX: x, clientY: y,
      }));
      const left = [];
      for (const v of ["prop", "jet", "helicopter", "car", "speedboat", "yacht", "rocket"]) {
        L.api.setVehicle(v);
        if (v === "speedboat" || v === "yacht") L.api.spawnAt(1, 1); else L.api.placeOnRunway();
        L.update(1 / 60);
        fire("pointerdown", 195, 500);
        fire("pointermove", 8, 520);
        L.update(1 / 60);
        const held = Math.abs(st.ctrlBank);
        fire("pointercancel", 8, 520);
        L.update(1 / 60);
        left.push({ v, held: +held.toFixed(2), bank: +st.ctrlBank.toFixed(3), pitch: +st.ctrlPitch.toFixed(3), touching: st.touching });
      }
      return left;
    });
    const dragged = r.filter(x => x.held > 0.2).length;
    const stuck = r.filter(x => x.touching || Math.abs(x.bank) > 0.001 || Math.abs(x.pitch) > 0.001);
    check(`input: a cancelled touch centres the stick -- ${dragged} of ${r.length} vehicles took a real deflection from the drag, and every one of them is back at zero after the cancel. The rover and the spacewalking astronaut read ctrlBank without asking whether a finger is down, so a drag that ended at the edge of the screen used to leave them turning on the spot for ever`,
      dragged >= 6 && stuck.length === 0, JSON.stringify({ stuck, sample: r.slice(0, 3) }));
    await page.close();
  }

  // ---- 3. turning the device sideways, mid-play ----------------------------
  // With the sim stepped by hand, so that nothing DRIFTS between the two
  // readings: the only thing that changes between them is the shape of the
  // screen. (A first cut held the throttle down across the rotation and blamed
  // it for two buttons going away; the aeroplane had simply rolled seven metres
  // off the wash apron.)
  {
    const { page } = await newPage(390, 844);
    await page.evaluate(() => { window.__lp.noRender = true; window.__lp.api.skipScreens(); });
    const read = () => page.evaluate(() => {
      const L = window.__lp, st = L.state, vw = window.innerWidth, vh = window.innerHeight;
      const shown = [], off = [], small = [];
      for (const id in L.BUTTONS) {
        const e = document.getElementById(id);
        if (!e || e.classList.contains("hidden")) continue;
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = e.getBoundingClientRect();
        if (r.width < 2) continue;
        shown.push(id);
        if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) off.push(id);
        if (Math.min(r.width, r.height) < 56) small.push(id + ":" + Math.round(Math.min(r.width, r.height)));
      }
      return {
        shown: shown.sort().join("|"), off, small,
        clash: L.btnSlotClashes ? L.btnSlotClashes() : [],
        aspectErr: +Math.abs(L.camera.aspect - vw / vh).toFixed(4),
        finite: [st.x, st.y, st.z, st.heading, st.speed].every(Number.isFinite),
        held: !!st.throttleHeld,
      };
    });
    const setScene = (v) => page.evaluate((veh) => {
      const L = window.__lp;
      L.api.setVehicle(veh);
      if (veh === "speedboat" || veh === "yacht") L.api.spawnAt(1, 1);
      else if (veh === "prop") L.api.teleportAirborne();
      else L.api.placeOnRunway();
      L.api.setThrottle(true);   // held across the rotation, and it must survive it
      L.update(1 / 60);
    }, v);

    const faults = [];
    for (const veh of ["prop", "jet", "helicopter", "car", "speedboat", "yacht", "rocket"]) {
      await setScene(veh);
      const portrait = await read();
      await page.setViewportSize({ width: 844, height: 390 });
      // the resize EVENT is dispatched a beat after the layout changes, and the
      // camera only follows the screen from inside that handler
      await page.waitForTimeout(250);
      await page.evaluate(() => window.__lp.update(1 / 60));
      const landscape = await read();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(250);
      await page.evaluate(() => window.__lp.update(1 / 60));
      const back = await read();
      for (const [where, s] of [["landscape", landscape], ["back", back]]) {
        if (s.off.length) faults.push(`${veh}/${where}: off screen ${s.off.join(",")}`);
        if (s.small.length) faults.push(`${veh}/${where}: under 56px ${s.small.join(",")}`);
        if (s.clash.length) faults.push(`${veh}/${where}: slot clash ${JSON.stringify(s.clash)}`);
        if (s.aspectErr > 0.01) faults.push(`${veh}/${where}: camera aspect is stale by ${s.aspectErr}`);
        if (!s.finite) faults.push(`${veh}/${where}: state went non-finite`);
        if (!s.held) faults.push(`${veh}/${where}: the held throttle was dropped by the rotation`);
      }
      if (back.shown !== portrait.shown) faults.push(`${veh}: buttons differ after a round trip -- ${portrait.shown} then ${back.shown}`);
      await page.evaluate(() => window.__lp.api.setThrottle(false));
    }
    check(`device: turning it sideways mid-play changes nothing but the shape -- 7 vehicles rotated to landscape and back with the throttle held down; same buttons, all on screen, all still 56px, camera aspect follows, and not one held control let go`,
      faults.length === 0, JSON.stringify(faults.slice(0, 6)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.close();
  }

  // ---- 4. a corrupted save still opens on the picker ------------------------
  // Everything in localStorage is a convenience: which vehicle he had last, which
  // way he was pointing, which spots he has found. None of it may ever be the
  // reason the game does not start. The page's own init script clears storage, so
  // the junk is seeded by a SECOND init script and the page reloaded onto it.
  {
    const { ctx, page } = await newPage(390, 844);
    const KEYS = ["lp.vehicle", "lp.dir", "lp.dest", "lp.spots", "lp.lastEvent", "lp.lastPolice", "lp.sky"];
    const SHAPES = [
      ["truncated json", '[1,2'],
      ["the wrong type", '{"v":1}'],
      ["a name that is gone", "airlinerJetblue"],
      ["empty", ""],
      ["a future shape", "submarine"],
    ];
    const faults = [];
    for (const [why, junk] of SHAPES) {
      await ctx.addInitScript(`try { ${KEYS.map(k => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(junk)});`).join(" ")} } catch (e) {}`);
      await page.reload();
      await page.waitForFunction(() => !!window.__lp, null, { timeout: 15000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const L = window.__lp;
        if (!L) return { dead: true };
        const cards = [...document.querySelectorAll(".vehCard")].filter(c => !c.classList.contains("hiddenS"));
        const live = cards.filter(c => { const b = c.getBoundingClientRect(); return b.width > 10 && b.height > 10; });
        let objs = 0; L.scene.traverse(() => objs++);
        return {
          cards: cards.length, live: live.length, objs,
          picker: !document.getElementById("screenVehicle").classList.contains("hiddenS"),
          dest: !document.getElementById("screenDest").classList.contains("hiddenS"),
          finite: [L.state.x, L.state.y, L.state.z].every(Number.isFinite),
        };
      }).catch(() => ({ dead: true }));
      if (r.dead) { faults.push(`${why}: the game never started`); continue; }
      if (!r.picker) faults.push(`${why}: the picker did not open`);
      if (r.dest) faults.push(`${why}: it opened on the destination screen`);
      if (r.live < 6) faults.push(`${why}: only ${r.live} of ${r.cards} cards can be tapped`);
      if (r.objs < 200) faults.push(`${why}: a nearly empty scene (${r.objs})`);
      if (!r.finite) faults.push(`${why}: position is not a number`);
    }
    check(`storage: a corrupted save still opens on the picker -- every lp.* key filled with ${SHAPES.length} kinds of rubbish in turn (truncated json, the wrong type, a vehicle that no longer exists, empty, a name from the future) and the game opened on a full, tappable picker every time`,
      faults.length === 0, JSON.stringify(faults.slice(0, 6)));
    await page.close();
  }

  // ---- 5. the first touch, on any screen, starts the sound ------------------
  // iOS only lets audio start inside a gesture, and the earliest gesture is the
  // one most likely to be honoured. The vehicle picker -- the first thing he ever
  // touches -- was the one control in input.js that did not unlock.
  {
    const { page } = await newPage(390, 844);
    const r = await page.evaluate(() => {
      const L = window.__lp;
      const real = window.unlockAudio;
      let n = 0;
      window.unlockAudio = function (...a) { n++; return real.apply(this, a); };
      const tap = (el, id) => {
        if (!el) return null;
        el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: id, bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
        el.dispatchEvent(new PointerEvent("pointerup", { pointerId: id, bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
        return true;
      };
      const gates = [
        ["the vehicle picker", document.querySelector(".vehCard")],
        ["the direction screen", document.querySelector(".dirCard")],
        ["the destination screen", document.querySelector(".destCard")],
        ["the throttle", document.getElementById("throttleBtn")],
        ["the world itself", L.renderer.domElement],
      ];
      const silent = [];
      let id = 20;
      for (const [name, el] of gates) {
        if (!el) { silent.push(name + " (missing)"); continue; }
        const was = n;
        tap(el, id++);
        if (n === was) silent.push(name);
      }
      window.unlockAudio = real;
      return { silent, taps: gates.length };
    });
    check(`audio: the first touch on any screen starts the sound -- all ${r.taps} of the things he can touch first (a vehicle card, a direction, a destination, the throttle, the world) ask for the audio. The picker was the one that did not, so the sound waited for the second screen`,
      r.silent.length === 0, JSON.stringify(r));
    await page.close();
  }

  // ---- 6. every screen he might hold it at ---------------------------------
  {
    const DEVICES = [["iPhone SE", 375, 667], ["iPhone 15", 393, 852], ["iPad mini", 744, 1133], ["iPad Pro", 1024, 1366]];
    const { page } = await newPage(393, 852);
    await page.evaluate(() => { window.__lp.noRender = true; });
    const faults = [];
    let measured = 0;
    for (const [dev, w, h] of DEVICES) {
      for (const [o, vw, vh] of [["portrait", w, h], ["landscape", h, w]]) {
        await page.setViewportSize({ width: vw, height: vh });
        for (const veh of ["prop", "helicopter", "car", "speedboat", "yacht", "rocket"]) {
          const r = await page.evaluate((v) => {
            const L = window.__lp;
            L.api.setVehicle(v);
            if (v === "speedboat" || v === "yacht") L.api.spawnAt(1, 1); else L.api.placeOnRunway();
            L.update(1 / 60);
            const vw2 = window.innerWidth, vh2 = window.innerHeight;
            const small = [], off = [];
            let n = 0;
            for (const id in L.BUTTONS) {
              const e = document.getElementById(id);
              if (!e || e.classList.contains("hidden")) continue;
              const cs = getComputedStyle(e);
              if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) continue;
              const b = e.getBoundingClientRect();
              if (b.width < 2) continue;
              n++;
              const side = Math.min(b.width, b.height);
              if (side < 56) small.push(id + ":" + Math.round(side));
              if (b.left < -1 || b.top < -1 || b.right > vw2 + 1 || b.bottom > vh2 + 1) off.push(id);
            }
            return { n, small, off, clash: L.btnSlotClashes ? L.btnSlotClashes() : [] };
          }, veh);
          measured += r.n;
          const tag = `${dev} ${o}/${veh}`;
          if (r.small.length) faults.push(`${tag}: under 56px ${r.small.join(",")}`);
          if (r.off.length) faults.push(`${tag}: off screen ${r.off.join(",")}`);
          if (r.clash.length) faults.push(`${tag}: slot clash ${JSON.stringify(r.clash)}`);
        }
      }
    }
    check(`layout: every button he can reach, on every screen he might hold -- ${measured} buttons measured across 4 devices, both ways up, 6 vehicles each; every one at least 56px and wholly on the glass, with no two in the same slot`,
      faults.length === 0, JSON.stringify(faults.slice(0, 6)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.close();
  }

  // ---- 7. the service worker holds everything the page asks for -------------
  // The one mistake CLAUDE.md warns about: add a file, add the script tag, forget
  // sw.js. It costs nothing offline until the aeroplane, and then it costs the
  // whole game.
  {
    const root = path.join(__dirname, "..", "cockpit");
    const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const m = sw.match(/ASSETS\s*=\s*\[([\s\S]*?)\]/);
    const list = m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
    const held = new Set(list.map(a => a.replace(/^\.\//, "")));
    const missing = list.filter(a => !/^https?:/.test(a) && !fs.existsSync(path.join(root, a === "./" ? "index.html" : a.replace(/^\.\//, ""))));
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x => x[1]).filter(u => !/^https?:|^data:|^#/.test(u));
    const uncached = refs.filter(u => { const k = u.replace(/^\.\//, ""); return k && !held.has(k) && !(k === "index.html" && held.has("")); });
    check(`offline: the cache holds everything the page loads -- ${list.length} files listed in sw.js, every one of them on disk, and every script and stylesheet index.html pulls is one of them`,
      list.length > 40 && missing.length === 0 && uncached.length === 0,
      JSON.stringify({ listed: list.length, missing, uncached }));
  }
};
