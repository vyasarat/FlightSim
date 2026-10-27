"use strict";
// WHAT A DRAWN FRAME COSTS, AND WHAT THE RACE VENUES ADD TO IT (v179).
// Draw calls and triangles per frame -- the main pass AND the shadow pass, counted
// together (renderer.info.autoReset off around one frame) -- in the scenes he is
// really in: the runway, both cities, beside each race venue in normal play, and in
// a race on each track. For every scene, the same frame again with the venues he is
// not at hidden: what the venues cost from there. Counts, not milliseconds, so it
// runs in a shard: calls and triangles are the hardware proxy (polish_check's
// header), the same on any machine.
//
// MEASURE=1 prints the table and checks nothing (any root, old ones too).
module.exports = async function frameBudgetChecks({ newPage, check }) {
  // the frame he sees in landscape from the chase view (the budgets), and in portrait from his seat
  const run = async (w, h, chase) => {
  const { page } = await newPage(w, h);
  const res = await page.evaluate((chase) => {
    const L = window.__lp, S = L.state, R = L.race || (typeof race !== "undefined" ? race : null);
    const paint = () => {
      L.noRender = false;
      const q = window.__rafQueue; window.__rafQueue = [];
      window.__simTime += 1000 / 60;
      if (q.length) q[q.length - 1](window.__simTime);
      L.noRender = true;
    };
    // one frame, everything it drew: shadow pass + main pass
    const count = () => {
      const info = L.renderer.info, was = info.autoReset;
      paint();                                 // the frame before settles visibility
      info.autoReset = false; info.reset();
      paint();
      const out = { calls: info.render.calls, tris: info.render.triangles };
      info.autoReset = was;
      return out;
    };
    // the venue objects: every Object3D a venue keeps
    const ids = R && R.venues ? Object.keys(R.venues) : [];
    const objsOf = id => {
      const v = R.venues[id], out = [];
      for (const k in v) if (v[k] && v[k].isObject3D && !out.includes(v[k])) out.push(v[k]);
      return out;
    };
    // the venues' share: the same frame with them hidden (but the one he races on)
    // (and, with everything shown, whether the cull hid anything the fog leaves in sight)
    const inSight = () => {
      if (!R || !R.cull) return { bad: 0, culled: 0 };
      // as the fog counts it: every corner of the piece's box in the camera's own space, and
      // the fog factor at the one with the least depth (three.js: smoothstep near..far on -z)
      const far = L.scene.fog.far, cam = L.camera, V = new THREE.Vector3();
      cam.updateMatrixWorld(); const inv = cam.matrixWorldInverse;
      let bad = 0, culled = 0;
      for (const c of R.cull) {
        if (c.m.layers.mask !== 0) continue;
        culled++;
        const b = c.box; let dmin = Infinity;
        for (let k = 0; k < 8; k++) {
          V.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
          dmin = Math.min(dmin, -V.z);
        }
        if (dmin < far) bad++;
      }
      return { bad, culled };
    };
    const share = (keep) => {
      const hid = [];
      for (const id of ids) if (id !== keep) for (const o of objsOf(id)) { hid.push([o, o.visible]); o.visible = false; }
      const off = count();
      for (const [o, v] of hid) o.visible = v;
      const on = count(), sight = inSight();
      return { calls: on.calls, tris: on.tris, venueCalls: on.calls - off.calls, venueTris: on.tris - off.tris, ...sight };
    };
    const settle = n => { for (let i = 0; i < n; i++) { S.touching = false; L.update(1 / 60); } };
    const reset = () => { if (L.raceReset) L.raceReset(); S.sky = 0; S.nightF = 0; };
    const out = {};
    // the runway, the plane on it, chase view
    reset(); L.api.setView(chase); L.api.setVehicle("prop"); L.api.placeOnRunway(); settle(120);
    out.runway = share(null);
    // each city: the car parked on the grid node nearest its middle
    for (const k of ["ny", "ca"]) {
      reset(); L.api.setView(chase); L.api.setVehicle("car"); L.api.spawnAt(0, 0); settle(10);
      const C = L.streets.cities[k], N = C.nodes;
      const cx = N.reduce((a, n) => a + n.x, 0) / N.length, cz = N.reduce((a, n) => a + n.z, 0) / N.length;
      const n = N.slice().sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
      const arm = n.arms[0], o = arm.road.a === n ? arm.road.b : arm.road.a;
      S.x = n.x; S.z = n.z; S.heading = Math.atan2(-(o.x - n.x), -(o.z - n.z));
      L.updateScenery(S.x, S.z, true);
      S.y = L.terrainEff(S.x, S.z); S.speed = 0; settle(90);
      out[k + "City"] = share(null);
    }
    // each venue: normal play beside it (race_renders' "world"), then in a race on it
    for (const id of ids) {
      reset(); L.api.setView(chase); L.api.setVehicle("car"); L.api.spawnAt(0, 0); settle(10);
      const T = R.venues[id].track, q = T.S[Math.floor(T.n * 0.55)];
      const cx = T.S.reduce((a, p) => a + p.x, 0) / T.n, cz = T.S.reduce((a, p) => a + p.z, 0) / T.n;
      const dx = q.x - cx, dz = q.z - cz, d = Math.hypot(dx, dz);
      S.x = q.x + dx / d * 45; S.z = q.z + dz / d * 45; S.heading = Math.atan2(dx, dz);
      L.updateScenery(S.x, S.z, true);
      S.y = L.terrainEff(S.x, S.z); S.speed = 0; settle(90);
      out["by:" + id] = share(id);
      reset(); L.api.setView(chase); L.api.setVehicle("car"); L.api.spawnAt(0, 0); settle(10);
      L.rcStartRace(id);
      for (let i = 0; i < 60 * 9; i++) { S.touching = R.phase !== "grid"; S.touchIsPoint = false; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }   // (v194: finger off through the lamps -- a rocket start would put him further along, a different frame from the one budgeted)
      out["race:" + id] = share(id);
      reset();
    }
    // what the venues hold, whole
    const held = {};
    for (const id of ids) {
      let calls = 0, tris = 0;
      for (const o of objsOf(id)) o.traverse(m => {
        if (!m.isMesh) return;
        calls++;
        const g = m.geometry, c = g.index ? g.index.count : g.attributes.position.count;
        tris += Math.round(c / 3) * (m.isInstancedMesh ? m.count : 1);
      });
      held[id] = { meshes: calls, tris };
    }
    // a start gantry the cull took off the camera is still a wall: from the runway every
    // venue's gantry is far past the fog, and the solids registry still counts its legs
    // (the grandstands are route landmarks, streamed by the landmarks' own rule, as before)
    // (a camera on the runway looking at each gantry in turn, through the cull itself)
    reset(); L.api.setView(chase); L.api.setVehicle("prop"); L.api.placeOnRunway(); settle(30);
    const solid = { culled: 0, hidden: 0 };
    if (R && R.venues && typeof rcCull === "function") {
      const eye = new THREE.PerspectiveCamera(72, 1.33, 0.6, 6000);
      for (const id in R.venues) {
        const gn = R.venues[id].gantry;
        if (gn.userData.raceDay) continue;       // (v200: a street circuit's gantry stands on race day only -- london_race_checks)
        eye.position.set(L.state.x, L.state.y + 3, L.state.z); eye.lookAt(gn.position); eye.updateMatrixWorld();
        rcCull(L.renderer, L.scene, eye);
        L.forEachSolid(b => {
          if (!b.mesh || b.mesh.parent !== gn || b.mesh.layers.mask !== 0) return;
          solid.culled++; if (isSolidHidden(b)) solid.hidden++;
        });
      }
      count();                                   // (and the game's own camera puts its masks back)
    }
    return { out, held, solid, chunk: R && R.cullStats || null };
  }, chase);
  await page.close();
  return res;
  };
  const res = await run(1024, 768, true), seat = await run(390, 844, false);
  console.log("INFO  frame budget (calls / tris per drawn frame, shadow pass included; venue share = the venues he is not at hidden):");
  for (const [k, r] of Object.entries(res.out))
    console.log(`INFO    ${k.padEnd(12)} calls ${String(r.calls).padStart(5)}  tris ${String(r.tris).padStart(8)}   venues +${r.venueCalls} calls +${r.venueTris} tris`);
  for (const [k, h] of Object.entries(res.held)) console.log(`INFO    held ${k.padEnd(6)} ${h.meshes} meshes, ${h.tris} tris`);
  console.log("INFO  ... and in portrait from his seat:");
  for (const [k, r] of Object.entries(seat.out))
    console.log(`INFO    ${k.padEnd(12)} calls ${String(r.calls).padStart(5)}  tris ${String(r.tris).padStart(8)}   venues +${r.venueCalls} calls +${r.venueTris} tris`);
  if (process.env.MEASURE) { check("frame budget measured", true); return; }
  const O = res.out;
  // 1. from where he is not at a venue, the venues cost (next to) nothing: on v178 they added
  // 152k triangles to the runway's frame, from 1.5 to 6.6 km off, under a fog that hid them.
  // (The runway only: from California's middle a venue piece IS in sight -- at the edge of the
  // wide screen, inside the fog by view depth, about 26k triangles -- so the cities are held by
  // their budgets in 2. and by the depth rule in 3., not by a zero share.)
  const away = [["runway", O.runway.venueCalls, O.runway.venueTris], ["seat runway", seat.out.runway.venueCalls, seat.out.runway.venueTris]];
  check("frame budget: from the runway, in landscape from the chase view and in portrait from his seat, the race venues add at " +
    "most 10 draw calls and 2,000 triangles -- fogged out, they are not drawn (v178: 39 calls and 152k triangles)",
    away.every(([, c, t]) => c <= 10 && t <= 2000), JSON.stringify(away));
  // 2. every scene inside its budget, shadow pass counted: v179's measure plus 12% (calls 8%)
  const BUDGET = {
    runway: [615, 405000], nyCity: [275, 870000], caCity: [605, 980000],
    "by:oval": [885, 865000], "race:oval": [810, 940000], "by:dunes": [905, 800000], "race:dunes": [705, 840000],
    "by:snow": [630, 790000], "race:snow": [420, 935000], "by:beach": [585, 585000], "race:beach": [410, 645000],
    "by:sky": [470, 685000], "race:sky": [360, 690000],
  };
  const over = Object.entries(BUDGET).filter(([k, [c, t]]) => !O[k] || O[k].calls > c || O[k].tris > t)
    .map(([k, b]) => [k, O[k] ? [O[k].calls, O[k].tris] : "missing", b]);
  check("frame budget: the runway, both cities, beside each of the five venues and racing on each -- every frame inside " +
    "its calls and triangles (beside the oval v178 drew 1.09M triangles; the budget is 865k)", over.length === 0, JSON.stringify(over));
  // 3. the cull never takes what the fog leaves in sight
  const both = [...Object.entries(O), ...Object.entries(seat.out).map(([k, r]) => ["seat " + k, r])];
  const bad = both.filter(([, r]) => r.bad > 0).map(([k, r]) => [k, r.bad]);
  const culled = both.reduce((a, [, r]) => a + r.culled, 0);
  check("frame budget: nothing of a venue the fog leaves any of in sight is ever culled -- every culled piece's nearest corner " +
    `is past the fog's far edge in view depth, as the fog counts it -- in all 26 frames, both screens (${culled} culls)`,
    bad.length === 0 && culled > 0, JSON.stringify(bad));
  // 4. the cut pieces are the same triangles, and a culled grandstand is still solid
  const ch = res.chunk;
  check("frame budget: the venues' long ribbons cut into squares keep every triangle (" +
    (ch ? `${ch.before} before, ${ch.after} after, ${ch.from} meshes into ${ch.into}` : "no stats") + ")",
    !!ch && ch.before === ch.after && ch.into > ch.from, JSON.stringify(ch));
  check("frame budget: a start gantry culled off the camera is still a wall -- the solids registry asks `visible`, never the layer",
    res.solid.culled > 0 && res.solid.hidden === 0, JSON.stringify(res.solid));

  // ---- (v204) each airport's apron trucks rest on ITS apron (New York's and California's rested at z 120/160 of
  // the world, mid-country by the race venues), and no culled instanced mesh is culled by a sphere that does not
  // hold its instances (the two runways' paint was bounded at the world's origin: drawn from everywhere)
  const { page: apPage } = await newPage(1180, 820);
  const ap = await apPage.evaluate(() => {
    const L = window.__lp, T3 = window.THREE, out = { trucks: [], badCull: [] };
    for (const a of L.airports) {
      const A = L.AIRPORTS[a.idx];
      for (const v of a.vehicles) { const mz = v.mesh.position.z; out.trucks.push({ idx: a.idx, dz: Math.round(mz - A.cz), ok: Math.abs(mz - A.cz) < L.TUNE.runwayLength / 2 && Math.abs(v.homeZ - A.cz) < L.TUNE.runwayLength / 2 }); }   // (where the mesh stands, and its home)
    }
    const m4 = new T3.Matrix4(), p = new T3.Vector3();
    out.paintUnculled = 0;
    L.scene.traverse(o => {
      // (the runways' paint: culled like everything that stays put -- never drawn from every venue)
      if (o.isInstancedMesh && o.userData.runwayPaint) { out.paint = (out.paint || 0) + 1; if (o.frustumCulled === false) out.paintUnculled++; }
      if (!o.isInstancedMesh || o.frustumCulled === false || !o.count) return;
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const sp = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
      let worst = 0;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); worst = Math.max(worst, p.distanceTo(sp.center) - sp.radius); }
      if (worst > 1 && out.badCull.length < 10) out.badCull.push({ name: o.name || o.material.type, count: o.count, outBy: Math.round(worst) });
    });
    return out;
  });
  check(`frame budget: every airport's apron trucks rest on its own apron (${ap.trucks.map(t => t.idx + ":" + t.dz).join(", ")} m from its middle), and the runways' paint is culled (${ap.paintUnculled} not), every culled instanced mesh's sphere holding all its instances`,
    ap.trucks.length >= 6 && ap.trucks.every(t => t.ok) && ap.badCull.length === 0 && ap.paint === 6 && ap.paintUnculled === 0, JSON.stringify(ap));
  await apPage.close();
};
