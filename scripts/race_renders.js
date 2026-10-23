"use strict";
// The race (v164), through the game's own loop, portrait:
//   picker      the track picker: one big card and the way back
//   grid        the start grid from the chase view, the gantry's lamps coming on
//   gridSeat    the same from his seat
//   overtake    mid-race, chase view, him coming past a car
//   overtakeSeat  the same moment from his seat
//   podiumWin   he won: the podium, his car on the top step, the trophy, fireworks
//   podiumLose  he did not: the podium in its order, his car driving on in front
//   world       normal play: his car by the oval, facing it, the flag up
//   afterPodium the first frames after "go back" from a podium: nothing of the race left
//   surface:<kind> / surfaceSeat:<kind>   (v170) him mid-way along that surface at speed, its spray up
//   fork / shortcut   (v170) where the shortcut leaves the road, and half-way along it
//   dune / landing / pad / hairpin   (v170) a dune ahead, a landing, a boost pad, a dirt hairpin
//   padAhead          (v171) a boost pad about 80 m ahead, him down the middle: what he sees to aim
//   at:<m> / atSeat:<m>  (v173) him down the middle, settled, at that many metres along the lap
//   jump / jumpSeat   (v170) off a dune, near the top of the flight
//   glide / glideSeat (v171) held full into the left barrier for three seconds: riding along it
//   cam:<x>,<y>,<z>,<tx>,<ty>,<tz>  (v174) normal play, the camera put there (heights over the ground) looking at that
//   TRACK=dunes renders that track (the oval if unset); SKY=3 at night (v179); NIGHTF=0.5 holds the night blend there (dusk)
//   bunch:<kind> / bunchSeat:<kind>   (v181 gaps) that surface, the rivals side by side across the track 12-18 m ahead (the giant at the edge), all spraying
//   closeSeat:<kind>  (v181 gaps) from his seat, a rival 9 m ahead (tailgating, its tail ~4 m off his nose) in his lane on that surface, spraying at him
//   puffAt:<kind> / puffAtSeat:<kind>   (v181 gaps) from the chase view / his seat on that surface, a row of the biggest puff that surface makes, white, held at
//                     1, 2, 3, 4.5, 7, 10 and 15 m straight ahead of the camera: what the 2-7 m fade and the size cap leave on the glass
//   boxes / boxesSeat, item:<kind> / itemSeat:<kind>, hold:<kind> / holdSeat:<kind>   (v187) the power-ups: a row of boxes
//                     ahead; an item at work (boost, shield, ball, hit, oil, spin, giant); the button holding one
//   node scripts/race_renders.js [root] [views...]   -> evidence/race/ (OUT=, VEH= to change)
const path = require("path"), fs = require("fs");
const { launch, openGame, serve } = require("./art_rig.js");

const DEFAULT = ["picker", "grid", "gridSeat", "overtake", "overtakeSeat", "podiumWin", "podiumLose", "world", "afterPodium"];

async function render(root, views) {
  const out = process.env.OUT || path.resolve(__dirname, "..", "evidence", "race");
  fs.mkdirSync(out, { recursive: true });
  const port = +(process.env.PORT || 8232), srv = serve(root, port), browser = await launch();
  const [vw, vh] = (process.env.VP || "820x1180").split("x").map(Number);   // VP=1180x820 for landscape
  const page = await openGame(browser, port, { width: vw, height: vh });
  await page.evaluate(([v, t, k, nf]) => { window.__rVeh = v; window.__rTrack = t; window.__rSky = k; window.__rNightF = nf; }, [process.env.VEH || "car", process.env.TRACK || "oval", +(process.env.SKY || 0), process.env.NIGHTF || ""]);
  await page.evaluate(() => { window.__lp.api.skipScreens(); window.__hold = () => {}; for (let i = 0; i < 3; i++) window.__paint(); });
  await page.waitForFunction(() => { const s = window.__lp.modelState; return s && ["car", "cybertruck", "corvette"].every(k => s[k] !== "loading"); }, null, { timeout: 120000 }).catch(() => {});
  await page.screenshot({ timeout: 180000 });
  for (const v of views) {
    const info = await page.evaluate((v) => {
      const L = window.__lp, S = L.state, R = L.race;
      window.__hold = () => {};
      if (window.__carCam0) window.carCamera = window.__carCam0;
      S.sky = window.__rSky; S.nightF = S.sky === 3 ? 1 : 0;   // (v179) SKY=3 renders it at night
      if (window.__rNightF !== "") S.nightF = +window.__rNightF;   // (v181 gaps) NIGHTF: dusk, held
      L.raceReset();
      L.api.setVehicle(window.__rVeh); L.api.spawnAt(0, 0); L.api.skipScreens();
      for (let i = 0; i < 20; i++) L.update(1 / 60);
      const go = (n, bank, pitch) => { for (let i = 0; i < n; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = bank || 0; S.ctrlPitch = pitch || 0; L.update(1 / 60); } };
      const note = { v };
      if (v === "picker") { L.raceOpenPicker(); return note; }
      if (v === "world") {
        // normal play: his car on the open ground outside the oval, facing it, his own chase camera
        L.api.setView(true);
        const T = R.venues[window.__rTrack].track, q = T.S[Math.floor(T.n * 0.55)];
        const cx = T.S.reduce((a, p) => a + p.x, 0) / T.n, cz = T.S.reduce((a, p) => a + p.z, 0) / T.n;
        const dx = q.x - cx, dz = q.z - cz, d = Math.hypot(dx, dz);
        S.x = q.x + dx / d * 45; S.z = q.z + dz / d * 45; S.heading = Math.atan2(dx, dz);
        L.updateScenery(S.x, S.z, true);
        S.y = L.terrainEff(S.x, S.z); S.speed = 0;
        for (let i = 0; i < 90; i++) { S.touching = false; L.update(1 / 60); }
        return note;
      }
      if (v.startsWith("cam:")) {
        // (v174) a fixed camera anywhere, in normal play: cam:<x>,<y>,<z>,<tx>,<ty>,<tz> (y over the ground there)
        const [x, y, z, tx, ty, tz] = v.slice(4).split(",").map(Number);
        L.api.setView(true);
        S.x = tx + 30; S.z = tz + 30; S.y = L.terrainEff(S.x, S.z); S.speed = 0;
        L.updateScenery(tx, tz, true);
        for (let i = 0; i < 30; i++) { S.touching = false; L.update(1 / 60); }
        const cy = L.terrainEff(x, z) + y, gy = L.terrainEff(tx, tz) + ty;
        window.__hold = () => { L.camera.position.set(x, cy, z); L.camera.up.set(0, 1, 0); L.camera.lookAt(tx, gy, tz); };
        return note;
      }
      if (v === "afterPodium") {
        // straight after "go back" from a podium: normal play, nothing of the race left on screen
        L.api.setView(true); L.rcStartRace(window.__rTrack);
        for (let i = 0; i < 60 * 400 && R.phase !== "podium"; i++) go(1, 0, 0);
        for (let i = 0; i < 60 * 3; i++) { S.touching = false; L.update(1 / 60); }
        L.raceExit();
        for (let i = 0; i < 3; i++) { S.touching = false; L.update(1 / 60); }
        note.raceOn = L.raceOn(); note.confetti = typeof confetti !== "undefined" ? confetti.length : -1;
        return note;
      }
      L.api.setView(!/Seat/.test(v));
      L.rcStartRace(window.__rTrack);
      if (v === "fork" || v === "shortcut") {
        // (v170) the shortcut: coming up to where it leaves the road (him on its edge), or half-way along it
        const T = R.track, sc = T.sc[0];
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len;
        him.s = base + sc.sa - (v === "fork" ? 45 : 30); him.v = L.RC.v * 0.86; him.lat = -9;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s + 30 + r.i * 9; r.v = him.v; r.lat = (r.i % 2 ? -1 : 1) * 5; }
        const range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
        for (let i = 0; i < 60 * 8; i++) {
          if (v === "fork" && him.s > base + sc.sa - 25) break;
          if (v === "shortcut" && him.path && him.u > sc.Ls * 0.35) break;
          go(1, him.path ? 0 : -sc.side / range, 0);           // (a full steer to its side, held)
        }
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.path = !!him.path; note.lat = +him.lat.toFixed(1);
        return note;
      }
      if (v.startsWith("at:") || v.startsWith("atSeat:")) {
        // (v173) anywhere on the lap: him down the middle at his speed, 90 m short of it, for 2.5 s
        const T = R.track, m = +v.split(":")[1];
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len;
        him.s = base + m - 90; him.lat = 0; him.v = L.RC.v * 0.95;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s - 40 - r.i * 14; r.v = him.v * 0.9; r.lat = (r.i % 2 ? -1 : 1) * 5; }   // (behind him: the road ahead is the subject)
        go(Math.round(60 * 2.5), 0, 0);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.s = Math.round(him.s - base); note.air = !!him.air;
        return note;
      }
      if (/^(boxes|boxesSeat|item|itemSeat|hold|holdSeat)(:|$)/.test(v)) {
        // (v187) the power-ups. boxes / boxesSeat: a row of boxes ~70 m ahead, him down the middle.
        // item:<kind> / itemSeat:<kind>: that item at work -- boost (pushed, flames), shield (the bubble),
        // ball (thrown at the car 45 m ahead, in flight), hit (that car spinning), oil (a rival's slick
        // 30 m ahead of him), spin (him spinning, hit by a ball), giant (him huge, a rival alongside).
        // hold:<kind> / holdSeat:<kind>: he holds it -- the button with its picture
        const T = R.track, k = v.split(":")[1] || "";
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len, row = R.it.rows[1];
        const at = v.startsWith("boxes") ? row.s - 70 : row.s + 150;
        him.s = base + at; him.lat = 0; him.v = L.RC.v * 0.95; him.latV = 0;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s - 60 - r.i * 14; r.v = him.v * 0.9; r.lat = (r.i % 2 ? -1 : 1) * 6; }
        if (!v.startsWith("boxes")) { R.it.rows.forEach(rw => { rw.off = true; }); for (let i = 0; i < 90; i++) { for (const r of R.racers) if (!r.isHim) r.v = him.v * 0.9; go(1, 0, 0); } }   // (settled behind him, away from the boxes)
        const a = R.racers.find(r => r.key === "corvette" && !r.isHim) || R.racers[1];
        if (v.startsWith("boxes")) { go(30, 0, 0); return Object.assign(note, { rowAhead: Math.round(row.s + base - him.s) }); }
        if (v.startsWith("hold")) { L.rcItGive(him, k); go(20, 0, 0); return Object.assign(note, { item: him.item }); }
        if (k === "boost") { L.rcItGive(him, "boost"); L.raceItemUse(); go(40, 0, 0); }
        if (k === "shield") { L.rcItGive(him, "shield"); L.raceItemUse(); go(30, 0, 0); }
        if (k === "ball" || k === "hit") { a.s = him.s + 45; a.lat = 0; a.v = him.v; L.rcItGive(him, "ball"); L.raceItemUse(); for (let i = 0; i < (k === "ball" ? 25 : 140) && !(k === "hit" && a.spinT > 0 && a.spinT < 0.6); i++) { a.v = him.v; go(1, 0, 0); } }
        if (k === "oil") { a.s = him.s + 90; a.lat = 0; a.v = him.v; L.rcItGive(a, "oil"); L.rcItUse(a); for (let i = 0; i < 30; i++) { a.v = him.v * 1.4; go(1, 0, 0); } }   // (the slick ~50 m ahead at the shot: on the road in front of him, not under his own car)
        if (k === "spin") { a.s = him.s - 40; a.lat = 0; a.v = him.v; L.rcItGive(a, "ball"); L.rcItUse(a); for (let i = 0; i < 200 && !(him.spinT > 0 && him.spinT < 0.65); i++) { a.v = him.v * 0.8; go(1, 0, 0); } }
        if (k === "giant") { const ahead = /Seat/.test(v) ? 28 : 6, lat = /Seat/.test(v) ? -5 : -7; L.rcItGive(him, "giant"); L.raceItemUse(); a.s = him.s + ahead + 4; a.lat = lat; a.v = him.v; for (let i = 0; i < 90; i++) { a.v = him.v; a.s = Math.max(a.s, him.s + ahead); go(1, 0, 0); } }   // (from the seat, a rival in front, small under him)
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        return Object.assign(note, { k, spin: +(him.spinT || 0).toFixed(2), aSpin: +(a.spinT || 0).toFixed(2), giant: +(him.giantK || 1).toFixed(2), shield: +(him.shieldT || 0).toFixed(1),
          balls: R.it.balls.filter(b => b.on).length, oils: R.it.oils.filter(o => o.on).length, gapA: +(a.s - him.s).toFixed(1) });
      }
      if (v === "glide" || v === "glideSeat") {
        // (v171) on the straight before the first pad, the finger held full left: on the barrier, gliding
        const T = R.track, pd = R.pads[0];
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len;
        him.s = base + pd.s - 160; him.v = L.RC.v * 0.95; him.lat = 4;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s + 60 + r.i * 12; r.v = him.v; r.lat = (r.i % 2 ? -1 : 1) * 3; }
        const w0 = R.wallShoves, g0 = R.glideT, range = (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight)) / (L.CAR.dragRangeX * innerWidth);
        go(60 * 3, -1 / range, 0);
        window.__hold = () => { S.touching = true; S.ctrlBank = -1 / range; S.ctrlPitch = 0; };
        note.lat = +him.lat.toFixed(2); note.thumps = R.wallShoves - w0; note.glide = +(R.glideT - g0).toFixed(1); note.v = +him.v.toFixed(1);
        return note;
      }
      if (v === "dune" || v === "landing" || v === "pad" || v === "padAhead" || v === "hairpin") {
        // (v170) the dune ahead of him; the moment he lands; a boost pad coming up; a dirt hairpin
        const T = R.track, d = T.S.find(q => q.dune), pd = R.pads[0];
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len;
        const at = v === "pad" ? pd.s - 100 : v === "padAhead" ? pd.s - 130 : v === "hairpin" ? T.S.find(q => q.sf === "dirt").s - 60 : d.s - (v === "dune" ? 45 : 60);
        him.s = base + at; him.v = L.RC.v * 0.9; him.lat = v === "pad" ? pd.lat : v === "padAhead" ? 0 : 2;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s + (v === "dune" || v === "pad" || v === "padAhead" ? 90 : 30) + r.i * 10; r.v = him.v; r.lat = (r.i % 2 ? -1 : 1) * 7; }
        if (v === "landing") { let was = false; for (let i = 0; i < 60 * 6; i++) { go(1, 0, 0); if (was && !him.air) break; was = was || him.air; } go(3, 0, 0); }
        else if (v === "hairpin") go(90, 0, 0);
        else go(Math.round(60 * (v === "dune" ? 0.8 : 1.5)), 0, 0);      // (long enough for the camera to be behind him again)
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.air = !!him.air; note.s = Math.round(him.s - base); note.padAhead = Math.round(pd.s - (him.s - base)); note.phase = R.phase; note.big = document.getElementById("bigNum") && document.getElementById("bigNum").textContent;
        return note;
      }
      if (v === "jump" || v.startsWith("jumpSeat")) {
        // (v170) off the first dune at his step, frozen where the dune falls away under him
        const T = R.track, d = T.S.find(q => q.dune);
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him;
        him.s = Math.floor(him.s / T.len) * T.len + d.s - 60; him.v = L.RC.v * 0.9; him.lat = 2;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s + 30 + r.i * 10; r.v = him.v; r.lat = (r.i % 2 ? -1 : 1) * 6; }
        let prevOver = -1;
        for (let i = 0; i < 60 * 6; i++) {
          go(1, 0, 0);
          const over = him.air ? him.y - L.rcPoint(him.s, him.lat, {}).y : 0;
          // (from the seat: pre = on the deck 25 m before the crest, up = off it, nose up into the sky, top = the top of
          // the flight, down = just before he lands, nose down)
          const ph = v === "jump" ? "top" : v.split(":")[1] || "up", toCrest = d.s - (him.s - Math.floor(him.s / T.len) * T.len);
          if (ph === "pre" && toCrest <= 25) break;
          // (t<sec>: that long after leaving the crest -- a strip; after: 0.3 s after he lands)
          if (ph[0] === "t" && him.air && him.airT >= +ph.slice(1) - 3 / 60) break;
          if (ph.startsWith("after")) { const wait = +(ph.slice(5) || 0.3); if (him.air) note.flew = true; else if (note.flew) { note.since = (note.since || 0) + 1 / 60; if (note.since >= wait - 3 / 60) break; } }
          if (ph === "up" && him.air && him.airT >= 0.1 - 3 / 60) break;
          if (ph === "down" && him.air && him.vy < 0 && over < 2.2) break;   // (three frames more are drawn before the picture)
          if (ph === "top" && him.air && over < prevOver) break;          // (the highest he is over the ground under him)
          prevOver = over;
        }
        window.__hold = () => {};
        note.air = !!him.air; note.vy = +(him.vy || 0).toFixed(2); note.pitchDeg = +S.pitch.toFixed(1); note.over = +(him.y - L.rcPoint(him.s, him.lat, {}).y).toFixed(2);
        return note;
      }
      if (v.startsWith("bunch") || v.startsWith("closeSeat") || v.startsWith("puffAt")) {
        // (v181 gaps) the spray's worst cases, on the longest run of that surface, at his speed
        const kind = v.split(":")[1], T = R.track, S2 = T.S;
        let best = null, run = null;
        for (const q of S2) { if (q.sf === kind) { if (!run) run = { a: q.s }; run.b = q.s; if (!best || run.b - run.a > best.b - best.a) best = run; } else run = null; }
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, base = Math.floor(him.s / T.len) * T.len, mid = (best.a + best.b) / 2 - 40;
        him.s = base + mid; him.v = L.RC.v; him.lat = 0;
        const others = R.racers.filter(r => !r.isHim);
        const place = () => {
          if (v.startsWith("bunch")) others.slice().sort((a, b) => (b.key === "monster") - (a.key === "monster")).forEach((r, k) => { r.s = him.s + 12 + (k % 2) * 6; r.lat = -7.5 + k * (15 / Math.max(1, others.length - 1)); r.v = him.v; r.line = r.lat; r.aim = null; r.aimGo = false; });
          else if (v.startsWith("closeSeat")) others.forEach((r, k) => { r.s = k ? him.s + 60 + k * 10 : him.s + 5; r.lat = k ? (k % 2 ? -6 : 6) : him.lat; r.v = him.v; r.line = r.lat; r.aim = null; r.aimGo = false; });
          else others.forEach((r, k) => { r.s = him.s + 60 + k * 10; r.lat = k % 2 ? -6 : 6; r.v = him.v; });
        };
        place();
        for (let i = 0; i < 90; i++) { if (i % 10 === 0) place(); go(1, 0, 0); }
        place();
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        // (closeSeat: the rival is held 9 m ahead -- its tail about 4 m off his nose -- in his lane up to the picture -- a contact shove would move it out)
        if (v.startsWith("closeSeat")) window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; const r = others[0]; r.s = him.s + 9; r.lat = him.lat; r.v = him.v; };
        if (v.startsWith("puffAt")) {
          // the biggest puff this surface makes (its radius at the end of its life), white at full strength, held still
          const sf = L.RC.surfaces[kind], rMax = sf.size * 1.6 + sf.size * 2.2 * sf.life, ds = [1, 2, 3, 4.5, 7, 10, 15], idx = [];
          for (const d of ds) { window.rcPuff(0, 0, 0, 0xffffff, rMax, 0, 60, 0.9); idx.push((rcPuffs.next - 1 + rcPuffs.n) % rcPuffs.n); }
          const C = window.THREE, f = new C.Vector3(), lx = [-1.2, 1.2, -0.6, 0.6, 0, -0.9, 0.9];
          const put = () => { L.camera.getWorldDirection(f); const c = L.camera.position, sd = new C.Vector3(-f.z, 0, f.x).normalize();
            ds.forEach((d, k) => { const i = idx[k]; rcPuffs.pos[i * 3] = c.x + f.x * d + sd.x * lx[k] * d * 0.25; rcPuffs.pos[i * 3 + 1] = c.y + f.y * d - 0.35 - 0.02 * d; rcPuffs.pos[i * 3 + 2] = c.z + f.z * d + sd.z * lx[k] * d * 0.25; rcPuffs.r[i] = rMax; rcPuffs.grow[i] = 0; rcPuffs.life[i] = rcPuffs.max[i] = 60; rcPuffs.a0[i] = 0.9; });
            rcPuffs.geo.attributes.position.needsUpdate = true; };
          window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; put(); };
          note.rMax = +rMax.toFixed(2); note.capPx = Math.round(L.RC.spray.maxPx * L.renderer.getDrawingBufferSize(new C.Vector2()).y);
        }
        note.sf = L.rcAt(him.s).sf; note.speed = +him.v.toFixed(1); note.alive = rcPuffs ? Array.from(rcPuffs.life).filter(x => x > 0).length : 0;
        note.ahead = others.map(r => [r.key, +(r.s - him.s).toFixed(1), +r.lat.toFixed(1)]);
        return note;
      }
      if (v.startsWith("surface")) {
        // mid-way along the longest run of that surface, at his speed, for a second and a half
        const kind = v.split(":")[1], T = R.track, S2 = T.S;
        let best = null, run = null;
        for (const q of S2) { if (q.sf === kind) { if (!run) run = { a: q.s }; run.b = q.s; if (!best || run.b - run.a > best.b - best.a) best = run; } else run = null; }
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 3 + 0.5)), 0, 0);
        const him = R.him, mid = (best.a + best.b) / 2 - 40;
        him.s = Math.floor(him.s / T.len) * T.len + mid; him.v = L.RC.v; him.lat = 2;
        for (const r of R.racers) if (!r.isHim) { r.s = him.s + 25 + r.i * 9; r.v = L.RC.v; r.lat = (r.i % 2 ? -1 : 1) * 6; }
        go(90, 0, 0);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.sf = L.rcAt(him.s).sf; note.speed = +him.v.toFixed(1);
        return note;
      }
      if (v === "grid" || v === "gridSeat") {
        go(Math.round(60 * (L.RC.count.lead + L.RC.count.step * 1.6)), 0, 0);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; };
        note.phase = R.phase; note.lit = R.lights.filter(m => m.material.color.getHex() === L.TUNE.palette.red).length;
        return note;
      }
      if (v === "overtake" || v === "overtakeSeat") {
        go(60 * 14, 0, 0);    // (out along the lap, clear of the gantry)
        // a car just ahead of him, a lane over; he is quicker and coming past it
        const him = R.him, o = R.racers.find(r => !r.isHim && r.key === "corvette") || R.racers.find(r => !r.isHim);
        for (const r of R.racers) if (r !== him && r !== o) r.s = him.s - 200;
        o.s = him.s + (S.vp && S.vp.monster ? (v === "overtakeSeat" ? 14 : 2) : 18); o.lat = him.lat + (S.vp && S.vp.monster ? (him.lat > 0 ? -10 : 10) : 4.5);   // (the giant: the rival alongside it, clear of its wheels, or its body hides it)
        // (its own line where it is put, and its wander at the middle of its swing: it holds that lane)
        o.line = o.lat; o.lineT = -o.i / L.RC.ai.wander[0]; o.aim = null; o.aimGo = false;
        go(40, 0, 0.8);
        window.__hold = () => { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0.8; };
        note.gap = +(o.s - him.s).toFixed(1); note.chase = S.viewChase; note.camUp = +(L.camera.position.y - S.y).toFixed(1); note.camBack = +Math.hypot(L.camera.position.x - S.x, L.camera.position.z - S.z).toFixed(1); note.dl = +(o.lat - him.lat).toFixed(1);
        return note;
      }
      if (v === "podiumWin" || v === "podiumLose") {
        const win = v === "podiumWin";
        for (const r of R.racers) if (!r.isHim) r.skill = win ? 0.8 : 1.2;
        for (let i = 0; i < 60 * 900 && R.phase !== "podium"; i++) go(1, 0, 0);   // (v181: a three-lap race on a v173 track runs past 400 s)
        for (let i = 0; i < 60 * (win ? 4.2 : 5.5); i++) { S.touching = false; L.update(1 / 60); }
        // he did not win: on until his car has stopped for its cheer
        for (let i = 0; i < 60 * 15 && !win && !R.podium.onStep && R.him.v > 0.1; i++) { S.touching = false; L.update(1 / 60); }
        note.himV = +R.him.v.toFixed(2);
        if (!win && R.loseShot) { const a = R.loseShot; note.fit = { ok: a.ok, up: a.up, slide: a.slide, full: +a.fit.toFixed(2) }; }   // (v167: the fitted shot)
        note.place = R.him.place; note.top = R.podium && R.podium.top.map(r => r.key);
        return note;
      }
      return note;
    }, v);
    if (process.env.NEAR) Object.assign(info, await page.evaluate(() => {
      const L = window.__lp, T = window.THREE, S0 = L.race.him.mesh.position, S = { x: S0.x, y: S0.y, z: S0.z }, out = [], b = new T.Box3(), mine = new Set();
      L.vehicleModel.traverse(o => mine.add(o));
      L.scene.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return;
        b.setFromObject(o); if (b.isEmpty()) return;
        const c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3());
        if (Math.hypot(c.x - S.x, c.z - S.z) < 6 && sz.length() < 40) out.push({ n: o.name || o.type, p: (o.parent && (o.parent.name || o.parent.type)), mine: mine.has(o), inst: !!o.isInstancedMesh, y: [+(b.min.y - S.y).toFixed(2), +(b.max.y - S.y).toFixed(2)], sz: sz.toArray().map(v => +v.toFixed(1)), col: o.material && o.material.color ? o.material.color.getHexString() : "" });
      });
      return { near: out.slice(0, 30) };
    }));
    if (process.env.RAY) Object.assign(info, await page.evaluate((xy) => {
      const L = window.__lp, T = window.THREE, rc = new T.Raycaster(), [x, y] = xy.split(",").map(Number);
      rc.setFromCamera(new T.Vector2(x, y), L.camera);
      const hit = rc.intersectObjects(L.scene.children, true).slice(0, 3);
      const path = o => { const n = []; for (let p = o; p && n.length < 6; p = p.parent) n.push((p.name || p.type) + (p.userData && Object.keys(p.userData).length ? "{" + Object.keys(p.userData).slice(0, 4).join(",") + "}" : "")); return n.join("<"); };
      return { ray: hit.map(h => [+h.distance.toFixed(1), path(h.object), h.object.material && h.object.material.color ? h.object.material.color.getHexString() : ""]), cam: [L.camera.position.x, L.camera.position.y, L.camera.position.z].map(v => Math.round(v)) };
    }, process.env.RAY));
    if (process.env.PROBE) Object.assign(info, await page.evaluate(() => {
      const L = window.__lp, S = L.state, c = L.camera.position, ey = S.y + 1.6, near = [];
      L.forEachSolid(b => { if (Math.hypot(b.x - c.x, b.z - c.z) < Math.hypot(b.hw, b.hd) + 6) near.push([L.solidKind(b), +b.x.toFixed(1), +b.z.toFixed(1), +b.y0.toFixed(1), +b.y1.toFixed(1), +b.hw.toFixed(1), +b.hd.toFixed(1), L.solidTest(b, c.x, c.y, c.z, 0.3)]); });
      const rc = window.__lp.race.racers.map(r => [r.key, +(Math.hypot(r.mesh.position.x - c.x, r.mesh.position.z - c.z)).toFixed(1)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
      return { cam: [c.x, c.y - S.y, c.z].map(v => +v.toFixed(1)), sight: window.solidSight(S.x, ey, S.z, c.x, c.y, c.z, 0.5, ["wall", "building", "rock", "pillar", "tree", "structure"]), near: near.slice(0, 6), racers: rc };
    }));
    if (process.env.HIDE) Object.assign(info, await page.evaluate((h) => {
      const L = window.__lp, R = L.race, out = {};
      if (h === "cabin") { const c = typeof car !== "undefined" && car.cabin; out.cabin = !!c; out.cabinVis = c ? c.visible : null; if (c) c.visible = false; window.__hold = () => { if (car.cabin) car.cabin.visible = false; }; }
      if (h === "where") { const T = window.THREE, b = new T.Box3(), q = {}; out.where = R.racers.map(r => { r.mesh.updateMatrixWorld(true); b.setFromObject(r.mesh); L.rcPoint(r.s, r.lat, q); return [r.key, r.isHim ? "HIM" : "", +(b.min.y - q.y).toFixed(2), +(b.max.y - q.y).toFixed(2), +(r.mesh.userData.rcLift || 0).toFixed(2), r.mesh.children.length]; }); }
      if (h === "low") { const T = window.THREE, b = new T.Box3(), q = {}, m = L.vehicleModel; m.updateMatrixWorld(true); L.rcPoint(R.him.s, R.him.lat, q); out.low = []; out.lift = R.himLift;
        m.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isSprite) return; let vis = true; for (let p = o; p && p !== m.parent; p = p.parent) if (!p.visible) vis = false; b.setFromObject(o); out.low.push([o.name || o.type, vis, o.material && o.material.visible, +(b.min.y - q.y).toFixed(2), +(b.max.y - q.y).toFixed(2), o.parent && (o.parent.name || o.parent.type)]); });
        out.low.sort((a, b) => a[3] - b[3]); out.low = out.low.slice(0, 8); }
      if (h === "parts") { const T = window.THREE, b = new T.Box3(), c = new T.Vector3(), r = R.racers.find(r => r.key === "car" && !r.isHim), hp = R.him.mesh.position, rp = r.mesh.position; out.parts = []; r.mesh.updateMatrixWorld(true);
        r.mesh.traverse(o => { if (!o.isMesh) return; b.setFromObject(o); b.getCenter(c); out.parts.push([o.name || "-", o.visible, o.matrixAutoUpdate, o.frustumCulled, +Math.hypot(c.x - rp.x, c.z - rp.z).toFixed(1), +Math.hypot(c.x - hp.x, c.z - hp.z).toFixed(1), o.material && o.material.color ? o.material.color.getHexString() : "", o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count : 0, !!(o.material && o.material.onBeforeCompile) ]); }); }
      if (h.startsWith("only:")) { const k = h.slice(5); for (const r of R.racers) if (!r.isHim && r.mesh && r.key !== k) r.mesh.visible = false; window.__hold = () => { for (const r of R.racers) if (!r.isHim && r.mesh && r.key !== k) r.mesh.visible = false; }; }
      if (h === "racers") { for (const r of R.racers) if (!r.isHim && r.mesh) r.mesh.visible = false; }
      return out;
    }, process.env.HIDE));
    await page.evaluate(() => { const f = document.getElementById("flash"); f.style.transition = "none"; f.classList.remove("on"); });
    const shot = await page.evaluate((nf) => { const nF = () => { if (nf !== "") window.__lp.state.nightF = +nf; }; for (let i = 0; i < 3; i++) { nF(); window.__hold(); window.__lp.update(1 / 60); nF(); window.__hold(); window.__paint(); }
      const L = window.__lp, h = L.race && L.race.him; const bn = document.getElementById("bigNum");
      return h ? { atShot: { air: !!h.air, airT: +(h.airT || 0).toFixed(2), pitchDeg: +L.state.pitch.toFixed(1), phase: L.race.phase, raceT: +(L.race.t - L.race.raceT0).toFixed(2), nightF: +L.state.nightF.toFixed(2), bigNum: bn && [bn.textContent, bn.className, getComputedStyle(bn).opacity] } } : {}; }, process.env.NIGHTF || "");
    Object.assign(info, shot);
    const file = path.join(out, v + ".png");
    await page.screenshot({ path: file, timeout: 180000 });
    console.log("wrote", file, JSON.stringify(info));
  }
  await browser.close(); srv.close();
}
module.exports = render;
if (require.main === module) {
  const args = process.argv.slice(2), root = args[0] && fs.existsSync(path.join(args[0], "cockpit")) ? args.shift() : path.join(__dirname, "..");
  render(path.resolve(root), args.length ? args : DEFAULT);
}
