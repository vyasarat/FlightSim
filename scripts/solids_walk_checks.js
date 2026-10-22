"use strict";
// THE REGISTRY WALK, CHEAPEST TEST FIRST (v181).
//
// solidQuery and solidCol answer "the FIRST solid, in registry order, that this
// vehicle cannot pass". Until v181 every record was asked who it blocks and
// whether it is hidden (a mesh, its parent, its userData -- pointer-chasing)
// BEFORE the two-line box test that throws out all but a handful of the ~8,000
// records: the walk was 60% of a car's simulated frame and 89% of the monster
// truck's (twelve hull and camera questions a frame).
//
// Every filter on a record is a pure function of it, so the order they are asked
// in cannot change which record is first: v181 asks the box first. These checks
// hold it to that:
//   a. EQUIVALENCE. The walk as it was (written out here, from v180's solids.js)
//      and the walk as it is answer tens of thousands of questions -- every
//      vehicle's radius, every class, with and without baseY, flat, and the
//      game's own skip predicates -- at the edges of every record (each box's
//      faces at its radius plus or minus a hair, inside, at its top and bottom),
//      in both cities, beside every race venue, at the harbour, in the bore,
//      on the runway, on Mars, and after a toy ball has moved: the same record,
//      the same kind, the same depth and the same normal, to the last bit.
//   b. THE WORK. A question asks `isSolidHidden` only of the records whose box
//      it is inside -- a handful, not the registry. (On v180: every record that
//      blocks the class, ~8,000 a question.) A count, not a clock, so it runs in
//      a shard.
module.exports = async function solidsWalkChecks({ newPage, check }) {
  const { page } = await newPage(1024, 768);
  const res = await page.evaluate(() => {
    const L = window.__lp, S = L.state, T = L.TUNE;
    L.noRender = true;
    // ---- the walk as v180 had it, verbatim (solids.js, solidQuery / solidCol)
    function refQuery(x, y, z, r, cls, baseY, skip, flat) {
      let hit = null;
      forEachSolid(b => {
        if (hit) return;
        if (!solidBlocks(b, cls)) return;
        if (isSolidHidden(b)) return;
        if (skip && skip(b)) return;
        if (baseY !== undefined && baseY >= b.y1 - 1) return;
        const t = solidTest(b, x, y, z, r, flat);
        if (t) hit = { b, kind: solidKind(b), d: t.d, nx: t.nx, ny: t.ny, nz: t.nz };
      });
      return hit;
    }
    function refCol(x, z, yLo, yHi, r, cls, skip) {
      let hit = null;
      forEachSolid(b => {
        if (hit) return;
        if (!solidBlocks(b, cls)) return;
        if (isSolidHidden(b)) return;
        if (skip && skip(b)) return;
        if (b.y1 < yLo || b.y0 > yHi) return;
        const rr = b.pad ? Math.max(0.3, r + b.pad) : r;
        const ex = b.hw + rr, ez = b.hd + rr;
        if (!(x > b.x - ex && x < b.x + ex && z > b.z - ez && z < b.z + ez)) return;
        let t = null;
        if (b.o3 || b.cap || b.ramp) {
          const n = Math.max(1, Math.ceil((yHi - yLo) / Math.max(1, rr)));
          for (let i = 0; i <= n && !t; i++) {
            const y = yLo + (yHi - yLo) * i / n;
            const q = b.o3 ? solidTestBox3(b.o3, x, y, z, rr) : b.cap ? solidTestCap(b.cap, x, y, z, rr) : solidTestRamp(b.ramp, x, y, z, rr);
            if (q) { const h = Math.hypot(q.nx, q.nz) || 1; t = { d: q.d, nx: q.nx / h, nz: q.nz / h }; }
          }
        } else {
          let d = (b.x + ex) - x, nx = 1, nz = 0, q;
          if ((q = x - (b.x - ex)) < d) { d = q; nx = -1; nz = 0; }
          if ((q = (b.z + ez) - z) < d) { d = q; nx = 0; nz = 1; }
          if ((q = z - (b.z - ez)) < d) { d = q; nx = 0; nz = -1; }
          t = { d, nx, nz };
        }
        if (t) hit = { b, kind: solidKind(b), d: t.d, nx: t.nx, ny: 0, nz: t.nz };
      });
      return hit;
    }
    const same = (a, b) => (a === null && b === null) ||
      (a !== null && b !== null && a.b === b.b && a.kind === b.kind && Object.is(a.d, b.d) &&
       Object.is(a.nx, b.nx) && Object.is(a.ny, b.ny) && Object.is(a.nz, b.nz));
    // its own stream: the game's is left as it was
    let seed = 0x5011D5;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const radii = [...new Set(Object.values(T.solid.r))].concat([0, 0.5, 8]);
    const classes = [L.SOLID.AIR, L.SOLID.CAR, L.SOLID.BOAT, L.SOLID.ROVER, L.SOLID.ALL];
    const someSet = new Set();
    const skips = [null, sb => !!sb.toy || !!sb.ramp, sb => !!sb.ramp || !!sb.toy,
                   b => b.car !== undefined || !!b.park || !!b.cap, b => someSet.has(b) || !!b.ramp];
    const st = { q: 0, col: 0, bad: 0, badEx: [], hitsQ: 0, hitsC: 0, shapes: {}, lists: {}, places: [] };
    const listOf = new Map();
    const tag = () => {
      listOf.clear();
      for (const b of buildingBoxes) listOf.set(b, "town");
      for (const b of staticSolids) listOf.set(b, "static");
      for (const arr of streamedSolids.values()) for (const b of arr) listOf.set(b, "streamed");
      for (const b of trainSolids) listOf.set(b, "train");
      for (const b of surfSolids) listOf.set(b, "surf");
    };
    const shapeOf = b => b.o3 ? "box3" : b.cap ? "capsule" : b.ramp ? "ramp" : "box";
    const ask = (x, y, z) => {
      const r = pick(radii), cls = pick(classes), skip = pick(skips), flat = rnd() < 0.5;
      const baseY = rnd() < 0.3 ? y - 1 + (rnd() - 0.5) * 4 : undefined;
      const a = solidQuery(x, y, z, r, cls, baseY, skip, flat), e = refQuery(x, y, z, r, cls, baseY, skip, flat);
      st.q++;
      if (e) { st.hitsQ++; const s = shapeOf(e.b), l = listOf.get(e.b) || "?"; st.shapes[s] = (st.shapes[s] || 0) + 1; st.lists[l] = (st.lists[l] || 0) + 1; }
      if (!same(a, e)) { st.bad++; if (st.badEx.length < 5) st.badEx.push({ fn: "solidQuery", x, y, z, r, cls, baseY, flat, got: a && [a.kind, a.d], want: e && [e.kind, e.d] }); }
      const yLo = y - rnd() * 6, yHi = y + rnd() * 14, rc = pick(radii);
      const c = solidCol(x, z, yLo, yHi, rc, cls, skip), f = refCol(x, z, yLo, yHi, rc, cls, skip);
      st.col++;
      if (f) st.hitsC++;
      if (!same(c, f)) { st.bad++; if (st.badEx.length < 5) st.badEx.push({ fn: "solidCol", x, z, yLo, yHi, r: rc, cls, got: c && [c.kind, c.d], want: f && [f.kind, f.d] }); }
    };
    // around one record: its faces at r +/- a hair, inside, its top and bottom
    const around = (b) => {
      const r = pick(radii), rr = b.pad ? Math.max(0.3, r + b.pad) : r, eps = rnd() < 0.5 ? 1e-6 : 0.05;
      const ym = (b.y0 + b.y1) / 2, ex = b.hw + rr, ez = b.hd + rr;
      for (const s of [-1, 1]) for (const e of [-eps, eps]) {
        ask(b.x + s * (ex + e), ym, b.z + (rnd() - 0.5) * 2 * b.hd);
        ask(b.x + (rnd() - 0.5) * 2 * b.hw, ym, b.z + s * (ez + e));
        ask(b.x + (rnd() - 0.5) * b.hw, s < 0 ? b.y0 - rr + e : b.y1 + rr + e, b.z + (rnd() - 0.5) * b.hd);
      }
      for (let k = 0; k < 3; k++) ask(b.x + (rnd() - 0.5) * 2 * ex, b.y0 + rnd() * (b.y1 - b.y0), b.z + (rnd() - 0.5) * 2 * ez);
    };
    const visit = (name, x, z, rad, n) => {
      L.updateScenery(x, z, true);
      for (let i = 0; i < 3; i++) L.update(1 / 60);
      tag();
      const near = [];
      forEachSolid(b => { if (Math.hypot(b.x - x, b.z - z) < rad) near.push(b); });
      someSet.clear(); for (let i = 0; i < near.length; i += 7) someSet.add(near[i]);
      const q0 = st.q;
      for (let i = 0; i < n && near.length; i++) around(pick(near));
      // and plain points on the ground and in the air
      for (let i = 0; i < n; i++) {
        const px = x + (rnd() - 0.5) * 2 * rad, pz = z + (rnd() - 0.5) * 2 * rad, g = L.terrainEff(px, pz);
        ask(px, g + rnd() * 60, pz);
      }
      st.places.push({ name, near: near.length, asked: st.q - q0 });
    };
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const mid = k => { const N = L.streets.cities[k].nodes; return [N.reduce((a, n) => a + n.x, 0) / N.length, N.reduce((a, n) => a + n.z, 0) / N.length]; };
    visit("runway", 0, 0, 900, 400);
    visit("New York", ...mid("ny"), 900, 900);
    visit("California", ...mid("ca"), 900, 900);
    const R = L.race || (typeof race !== "undefined" ? race : null);
    if (R && R.venues) for (const id of Object.keys(R.venues)) {
      const Tk = R.venues[id].track, q = Tk.S[Math.floor(Tk.n * 0.3)];
      visit("venue " + id, q.x, q.z, 1200, 500);
    }
    if (L.harbor && L.harbor.solids && L.harbor.solids.length) { const h = L.harbor.solids[0]; visit("harbour", h.x, h.z, 900, 500); }
    // the bore: every tunnel record's own neighbourhood
    const tunnels = []; forEachSolid(b => { if (b.kind === "tunnel" || b.kind === "portal") tunnels.push(b); });
    if (tunnels.length) visit("the bore", tunnels[0].x, tunnels[0].z, 600, 400);
    // every record anywhere in the world, a few questions each
    tag();
    const all = []; forEachSolid(b => all.push(b));
    const q0 = st.q;
    for (const b of all) if (rnd() < 0.12) around(b);
    st.places.push({ name: "every record", near: all.length, asked: st.q - q0 });
    // and every shape and every list, by name: up to 80 of each, a dozen questions apiece
    // (the town's boxes and the ramps are few beside the venues' thousands)
    const comp = {};
    const q2 = st.q;
    for (const want of ["box", "box3", "capsule", "ramp", "town", "static", "streamed", "train"]) {
      const of = all.filter(b => shapeOf(b) === want || listOf.get(b) === want);
      comp[want] = of.length;
      for (let i = 0; i < Math.min(80, of.length); i++) { const b = pick(of); around(b); }
    }
    st.comp = comp;
    st.places.push({ name: "by shape and list", near: 0, asked: st.q - q2 });
    // Mars: its surface solids (capsules, oriented boxes, the ramps), and a toy ball moved
    {   // landed on Mars, as solidity_checks lands there, the rover out
      const b = L.BODIES[1];
      L.api.setVehicle("starship"); L.api.placeOnRunway();
      S.dest = b.name; S.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
      const nn = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
      S.x = b.x + nn.x * (b.r + 12); S.y = b.y + nn.y * (b.r + 12); S.z = b.z + nn.z * (b.r + 12);
      S.exploding = false;
      L.update(1 / 60);
      if (!L.mars.g && L.marsBuild) L.marsBuild();
      L.roverDeploy();
      for (let i = 0; i < 30; i++) L.update(1 / 60);
    }
    tag();
    const surf = surfSolids.slice();
    const q1 = st.q;
    for (const b of surf) for (let k = 0; k < 3; k++) around(b);
    const toy = surf.find(b => b.toy);
    if (toy) {
      for (let k = 0; k < 20; k++) { solidFollow(toy, toy.x + (rnd() - 0.5) * 6, (toy.y0 + toy.y1) / 2 + (rnd() - 0.5) * 2, toy.z + (rnd() - 0.5) * 6); around(toy); around(toy); }
    }
    st.places.push({ name: "Mars", near: surf.length, asked: st.q - q1, toy: !!toy });
    // ---- b. the work: isSolidHidden asks per question, in the scene that asks most
    // (counted only inside solidQuery and solidCol: other walks -- the monster's crush,
    // shatterAround -- ask isSolidHidden of their own records, and are not this question)
    // (and solidBlocks, and the caller's skip: any of the three asked before the box is the
    // slow walk back, whichever it is -- law-reviewer, v181)
    const orig = window.isSolidHidden, origB = window.solidBlocks;
    let asks = 0, inside = 0;
    window.isSolidHidden = function (b) { if (inside) asks++; return orig(b); };
    window.solidBlocks = function (b, c) { if (inside) asks++; return origB(b, c); };
    L.raceReset && L.raceReset();
    L.api.setVehicle("monster"); L.api.spawnAt(0, 0);
    for (let i = 0; i < 10; i++) L.update(1 / 60);
    const [nx, nz] = mid("ny");
    S.x = nx; S.z = nz; L.updateScenery(S.x, S.z, true); S.y = L.terrainEff(S.x, S.z); S.speed = 0;
    for (let i = 0; i < 30; i++) { S.touching = false; L.update(1 / 60); }
    let calls = 0;
    const wrap = (name, skipAt) => { const f = window[name]; window[name] = function () {
      calls++; inside++;
      const a = Array.prototype.slice.call(arguments), sk = a[skipAt];
      if (typeof sk === "function") a[skipAt] = function (b) { asks++; return sk(b); };
      try { return f.apply(this, a); } finally { inside--; } }; return () => { window[name] = f; }; };
    const un = [wrap("solidQuery", 6), wrap("solidCol", 6)];
    asks = 0;
    for (let i = 0; i < 120; i++) { S.touching = true; S.touchIsPoint = false; S.ctrlBank = 0.3 * Math.sin(i / 20); S.ctrlPitch = 0; L.update(1 / 60); }
    for (const u of un) u();
    window.isSolidHidden = orig; window.solidBlocks = origB;
    let total = 0; forEachSolid(() => total++);
    L.raceReset && L.raceReset();
    L.api.setVehicle("car"); L.api.spawnAt(0, 0);
    return { st, work: { asks, calls, perQuestion: calls ? asks / calls : 0, registry: total } };
  });
  const st = res.st, w = res.work;
  console.log("INFO  solids walk: " + st.places.map(p => `${p.name} ${p.asked} (${p.near} near)`).join(", "));
  console.log(`INFO  hits: solidQuery ${st.hitsQ}/${st.q}, solidCol ${st.hitsC}/${st.col}; shapes hit ${JSON.stringify(st.shapes)}; lists hit ${JSON.stringify(st.lists)}`);
  console.log(`INFO  filter asks (blocks, hidden, skip) per question with the monster in New York: ${w.perQuestion.toFixed(2)} (registry ${w.registry}, ${w.calls} questions)`);
  // every shape and list the world holds is hit at least 20 times (a list it does not
  // hold -- no streamed solids today, the train off -- says so in the INFO line)
  const need = Object.entries(st.comp).filter(([k, n]) => n > 0).map(([k]) => k).concat(["surf"]);
  const hitsOf = k => (st.shapes[k] || 0) + (st.lists[k] || 0);
  const kinds = need.every(k => hitsOf(k) >= 20);
  console.log("INFO  registry holds " + JSON.stringify(st.comp) + "; must each be hit 20 times: " + need.map(k => k + " " + hitsOf(k)).join(", "));
  check(`solids walk a: the box first changes no answer -- ${st.q + st.col} questions (${st.q} solidQuery, ${st.col} solidCol) at the faces, tops, bottoms and insides of the registry's records, in both cities, beside every race venue, at the harbour, in the bore, on Mars and after a toy ball moved, with every radius, class, baseY, flat and the game's skip predicates: ${st.bad} differ from v180's walk; ${st.hitsQ + st.hitsC} were hits, on every shape and every list the world holds`,
    st.bad === 0 && st.q > 20000 && st.hitsQ > 2000 && st.hitsC > 2000 && st.q - st.hitsQ > 2000 && kinds,
    { bad: st.bad, ex: st.badEx, q: st.q, col: st.col, hitsQ: st.hitsQ, hitsC: st.hitsC, shapes: st.shapes, lists: st.lists });
  check(`solids walk b: a question asks who a record blocks, whether it is hidden and the caller's skip only of the records its box is inside -- ${w.perQuestion.toFixed(2)} asks a question with the monster truck in New York, out of a registry of ${w.registry} (v180 asked every record)`,
    w.calls > 500 && w.perQuestion < 25, w);
  await page.close();
};
