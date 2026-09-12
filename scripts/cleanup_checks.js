"use strict";
// ---------------------------------------------------------------------------
// THREE INVARIANTS THAT WERE NEVER STATED, AND SO WERE NEVER TRUE ON PURPOSE.
//
//   * exactly one of him. Every path that spawns a vehicle -- the picker, a
//     respawn, a crash, an eject, going out in the rover or the suit, a carrier
//     launch -- must leave exactly one player vehicle in the scene. Nothing
//     asked that before, so nothing would have noticed a second one.
//
//   * nothing standing on a surface he uses. Asked BY GEOMETRY, walking every
//     mesh in the scene (per instance, and per triangle for merged ones whose
//     union box says nothing about where their pieces are) against the runways
//     and the carriageways. A list of things to exclude is a list someone has
//     to remember to add to; a sweep is not.
//
//   * the helicopter can never be stuck. Fifty point-to-go runs from coastal
//     and inland spots, plus a deliberately unreachable one to prove the floor
//     under it is real.
// ---------------------------------------------------------------------------

module.exports = async function cleanupChecks({ newPage, check, viewports }) {

  // ---- 1. exactly one of him, twenty times down every path ------------------
  {
    const { page } = await newPage(820, 1180);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      const out = {};
      const many = (name, fn, n) => {
        let mx = 0, mn = 99; const bad = [];
        for (let i = 0; i < n; i++) {
          fn(i);
          for (let k = 0; k < 20; k++) L.update(1 / 60);
          const m = L.vehPlayerModels();
          mx = Math.max(mx, m.length); mn = Math.min(mn, m.length);
          if (m.length !== 1) bad.push({ i, n: m.length, veh: st.vehicleKey });
        }
        out[name] = { max: mx, min: mn, bad: bad.slice(0, 3) };
      };
      const KEYS = ["prop", "fighter", "airlinerDelta", "airlinerEmirates", "helicopter",
                    "car", "speedboat", "yacht", "rocket", "starship"];
      many("picker", (i) => {
        const k = KEYS[i % KEYS.length]; L.api.setVehicle(k);
        if (k === "speedboat" || k === "yacht") L.api.spawnAt(1, 1); else L.api.placeOnRunway();
      }, 20);
      many("respawn", () => { L.api.setVehicle("prop"); L.api.placeOnRunway(); }, 20);
      many("planeCrash", () => {
        L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 300, 0);
        for (let k = 0; k < 8; k++) L.update(1 / 60);
        st.exploding = true; st.explodeTimer = 0;
        L.safePos.x = st.x; L.safePos.y = st.y + 60; L.safePos.z = st.z;
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      many("carCrash", () => {
        L.api.setVehicle("car"); L.api.placeOnRunway();
        for (let k = 0; k < 8; k++) L.update(1 / 60);
        L.carCrash(); st.explodeTimer = 0;
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      many("boatCrash", () => {
        L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1);
        for (let k = 0; k < 8; k++) L.update(1 / 60);
        if (L.boatCrash) L.boatCrash(); st.explodeTimer = 0;
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      many("eject", () => {
        L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 400, 0);
        for (let k = 0; k < 8; k++) L.update(1 / 60);
        if (L.ejectFire) L.ejectFire();
        for (let k = 0; k < 60 * 9; k++) L.update(1 / 60);
      }, 20);
      many("rover", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        const bod = L.BODIES.find(x => x.name === "moon");
        st.dest = "moon"; st.phase = "TAXI"; L.rk.stage = 3; L.rk.onBody = bod;
        st.x = bod.x; st.y = bod.y + bod.r + 10; st.z = bod.z;
        L.update(1 / 60); L.roverDeploy();
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      many("station", () => {
        L.api.setVehicle("rocket"); L.api.placeOnRunway();
        st.dest = "station"; st.phase = "AIRBORNE"; L.rk.stage = 3;
        for (let k = 0; k < 10; k++) L.update(1 / 60);
        if (L.stationEnter) L.stationEnter();
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      many("carrier", () => {
        L.api.setVehicle("fighter"); L.api.placeOnRunway();
        for (let k = 0; k < 8; k++) L.update(1 / 60);
        if (L.carrierPlace) L.carrierPlace();
        if (L.carrierLaunch) L.carrierLaunch();
        for (let k = 0; k < 40; k++) L.update(1 / 60);
      }, 20);
      return out;
    });
    const paths = Object.keys(r);
    check(`one of him: every one of the ${paths.length} paths that puts him in a vehicle -- picker, respawn, three kinds of crash, eject, rover, spacewalk, carrier launch -- leaves exactly one player vehicle in the scene, twenty times each`,
      paths.every(k => r[k].min === 1 && r[k].max === 1), JSON.stringify(r));
    await page.close();
  }

  // ---- 2. nothing standing on a surface he uses ----------------------------
  {
    const { page } = await newPage(820, 1180);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      // fly the length of the world so everything streams in
      for (const [x, z] of [[0, 6200], [0, 4800], [200, 3400], [300, 2000], [300, 600],
                            [250, -900], [220, -2400], [100, -3800], [-200, -5200],
                            [-400, -6100], [1400, -6600], [700, -6700], [0, -6200]]) {
        L.api.setVehicle("prop"); L.api.teleportAirborne(x, 600, z, 0);
        for (let k = 0; k < 12; k++) L.update(1 / 60);
      }
      L.api.setVehicle("prop"); L.api.placeOnRunway();
      for (let k = 0; k < 40; k++) L.update(1 / 60);

      const W = L.TUNE.runwayWidth / 2, Ln = L.TUNE.runwayLength / 2;
      const surfaces = L.AIRPORTS.map(ap => ({ name: "runway z=" + Math.round(ap.cz),
        x0: -W, x1: W, z0: ap.cz - Ln, z1: ap.cz + Ln, y: ap.elev }));

      // What is MEANT to be on them: the vehicles that drive there, and the
      // landing guide, which is drawn on the glide slope by design and is not
      // solid. Everything else is swept.
      const skip = new Set();
      const mark = (o) => { if (o) o.traverse(q => skip.add(q)); };
      mark(L.camera); mark(L.ringsGroup); mark(L.guideGroup);
      if (L.police && L.police.g) mark(L.police.g);
      for (const m of [L.highway.trafficMesh, L.highway.truckMesh,
                       L.lights && L.lights.carMesh, L.lights && L.lights.lampMesh]) if (m) skip.add(m);

      const hits = [];
      const m4 = new THREE.Matrix4(), box = new THREE.Box3();
      const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
      const label = (o, extra) => {
        let top = o; while (top.parent && top.parent !== L.scene) top = top.parent;
        const mm = Array.isArray(o.material) ? o.material[0] : o.material;
        return (o.geometry ? o.geometry.type.replace("Geometry", "") : "?") +
               (mm && mm.color ? " #" + mm.color.getHexString() : "") +
               " [child#" + L.scene.children.indexOf(top) + "]" + (extra || "");
      };
      // An obstruction is something he can HIT: it rises out of the surface and
      // its base is within a vehicle's height of it. A bridge pier reaching up
      // from far below, or a signal head hanging overhead, is neither.
      const test = (bb, o, extra) => {
        const h = bb.max.y - bb.min.y;
        if (h < 1.2 || h > 400) return;
        for (const s of surfaces) {
          if (bb.max.x > s.x0 && bb.min.x < s.x1 && bb.max.z > s.z0 && bb.min.z < s.z1 &&
              bb.min.y > s.y - 0.3 && bb.min.y < s.y + 3.5 && bb.max.y > s.y + 1.2) {
            hits.push({ where: s.name, what: label(o, extra),
                        x: Math.round((bb.min.x + bb.max.x) / 2), z: Math.round((bb.min.z + bb.max.z) / 2),
                        above: +(bb.min.y - s.y).toFixed(1), h: +h.toFixed(1) });
            return;
          }
        }
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        if (!L.highway.built) return;
        const n = L.hwyNearest(cx, cz);
        // hwyNearest CLAMPS to the ends of the spline, so a thing beyond New
        // York comes back with a small lateral and looks like it is in the road.
        if (!n || n.s < 40 || n.s > L.highway.length - 40) return;
        // THE LANES, not the whole strip. The median is not a lane and neither is
        // the shoulder: the guardrail stands at the outer edge by definition, and
        // flagging it says only that the road has a guardrail.
        const laneIn = L.HW.medianW / 2;
        const laneOut = L.HW.medianW / 2 + L.HW.lanes * L.HW.laneW;
        if (Math.abs(n.lateral) <= laneIn || Math.abs(n.lateral) >= laneOut) return;
        // ON the surface, not under it. A pier, a guardrail ribbon following a
        // slope and the deck itself all have their base below the carriageway;
        // a thing he can hit stands on it.
        if (bb.min.y > n.y - 0.3 && bb.min.y < n.y + 3.5 && bb.max.y > n.y + 1.2) {
          hits.push({ where: "carriageway", what: label(o, extra), x: Math.round(cx), z: Math.round(cz),
                      lat: Math.round(n.lateral), above: +(bb.min.y - n.y).toFixed(1), h: +h.toFixed(1) });
        }
      };
      const perTriangle = (o) => {
        const g = o.geometry, pos = g.attributes.position; if (!pos) return;
        const idx = g.index, n = idx ? idx.count : pos.count;
        for (let i = 0; i < n; i += 24) {
          const a = idx ? idx.getX(i) : i, b2 = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
          if (c >= pos.count) break;
          va.fromBufferAttribute(pos, a).applyMatrix4(o.matrixWorld);
          vb.fromBufferAttribute(pos, b2).applyMatrix4(o.matrixWorld);
          vc.fromBufferAttribute(pos, c).applyMatrix4(o.matrixWorld);
          box.makeEmpty(); box.expandByPoint(va); box.expandByPoint(vb); box.expandByPoint(vc);
          test(box, o, " tri" + i);
          if (hits.length > 200) return;
        }
      };
      let examined = 0;
      L.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        let q = o, vis = true;
        while (q) { if (!q.visible) vis = false; if (skip.has(q)) return; q = q.parent; }
        if (!vis) return;
        if (o.userData && (o.userData.isPlayerVehicle || o.userData.noSolid)) return;
        examined++;
        o.updateWorldMatrix(true, false);
        if (o.isInstancedMesh) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld);
            box.copy(o.geometry.boundingBox).applyMatrix4(m4);
            if (box.min.y < -5000) continue;
            test(box, o, "#" + i);
          }
        } else {
          box.setFromObject(o);
          if (!isFinite(box.min.y) || box.min.y < -5000) return;
          const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
          if (span > 60 && o.geometry && o.geometry.attributes.position) perTriangle(o);
          else test(box, o);
        }
      });
      const seen = new Set(), out = [];
      for (const h of hits) {
        const k = h.where + "|" + h.what.replace(/#\d+| tri\d+/g, "") + "@" + Math.round(h.x / 30) + "," + Math.round(h.z / 30);
        if (seen.has(k)) continue; seen.add(k); out.push(h);
      }
      return { examined, hits: out.slice(0, 10), count: out.length };
    });
    check(`clear surfaces: every one of the ${r.examined} meshes in the world, per instance and per triangle, swept against both runways and the whole carriageway -- nothing stands on any of them`,
      r.count === 0, JSON.stringify(r.hits));
    await page.close();
  }

  // ---- 3. the helicopter can never be stuck --------------------------------
  {
    const { page } = await newPage(820, 1180);
    const r = await page.evaluate(() => {
      const L = window.__lp, st = L.state;
      L.noRender = true; L.api.skipScreens();
      let seed = 0x51ED;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const go = (sx, sz, tx, tz, cap) => {
        L.api.setVehicle("helicopter"); L.api.placeOnRunway();
        for (let k = 0; k < 20; k++) L.update(1 / 60);
        st.x = sx; st.z = sz; st.y = Math.max(L.terrainEff(sx, sz), L.TUNE.waterLevel) + 60;
        st.phase = "AIRBORNE"; st.exploding = false;
        for (let k = 0; k < 30; k++) L.update(1 / 60);
        L.heli.target = { x: tx, y: Math.max(L.terrainEff(tx, tz), L.TUNE.waterLevel), z: tz };
        L.heli.sky = false; L.heli.stallBest = undefined; L.heli.stallT = 0;
        let f = 0;
        while (f < 60 * cap && L.heli.target && !st.exploding) { L.update(1 / 60); f++; }
        return { secs: +(f / 60).toFixed(1), released: !L.heli.target };
      };
      const runs = [];
      for (let i = 0; i < 50; i++) {
        const coastal = i % 2 === 0;
        let sx, sz, tries = 0;
        do {
          sx = (rnd() - 0.5) * 2400; sz = (rnd() - 0.5) * 12000; tries++;
        } while (tries < 60 && (coastal ? Math.abs(L.terrainEff(sx, sz) - L.TUNE.waterLevel) > 6
                                        : L.terrainEff(sx, sz) < L.TUNE.waterLevel + 8));
        const ang = rnd() * Math.PI * 2, d = 140 + rnd() * 500;
        runs.push({ coastal, ...go(sx, sz, sx + Math.cos(ang) * d, sz + Math.sin(ang) * d, 70) });
      }
      // AND ONE IT CANNOT GET TO. A target a long way off is not unreachable --
      // it closes on it at ninety metres a second and that is progress. Going
      // nowhere is the thing with no floor under it, so this pins it in place
      // with a target set and asks whether it ever lets go.
      const stalls0 = L.flags.heliStalls || 0;
      L.api.setVehicle("helicopter"); L.api.placeOnRunway();
      for (let k = 0; k < 20; k++) L.update(1 / 60);
      st.phase = "AIRBORNE"; st.y += 60;
      const px = st.x, pz = st.z, py = st.y;
      L.heli.target = { x: px + 600, y: py, z: pz };
      L.heli.sky = false; L.heli.stallBest = undefined; L.heli.stallT = 0;
      let ff = 0;
      while (ff < 60 * 40 && L.heli.target) {
        L.update(1 / 60); ff++;
        st.x = px; st.z = pz; st.y = py;        // held: it is getting nowhere
      }
      const far = { secs: +(ff / 60).toFixed(1), released: !L.heli.target };
      return { n: runs.length, released: runs.filter(r2 => r2.released).length,
               worst: Math.max(...runs.map(r2 => r2.secs)),
               unreachable: far, stalled: (L.flags.heliStalls || 0) - stalls0,
               stallAfter: L.TUNE.heli.stallAfter };
    });
    check(`helicopter: fifty point-to-go runs from random coastal and inland spots all arrived (worst ${r.worst} s), and one it is getting nowhere with is let go after ${r.stallAfter} s rather than hovering at it for ever -- it can never be stuck`,
      r.released === r.n && r.unreachable.released && r.stalled === 1 &&
      r.unreachable.secs < r.stallAfter + 4, JSON.stringify(r));
    await page.close();
  }
};
