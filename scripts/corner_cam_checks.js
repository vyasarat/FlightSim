"use strict";
// ---------------------------------------------------------------------------
// THE CHASE CAMERA ON A CORNER (v163).
//
// On a held corner the chase camera lags the turn and swings wide round its
// inside, and the inside of a city corner is a building: for the first third
// of a second the picture was a wall (the render-critic's standing BLOCK on
// v161). The rule now is that it never goes inside one, for every car, at
// every corner.
//
// So: in both cities, for the SUV, the Cybertruck and the boosted Corvette,
// held corners left and right at four-way grid junctions, driven through the
// game's own update from the approach to well out of the corner, and on every
// frame the camera is asked, by a walk of the registry of its own (not the
// camera's solidSight), whether it is inside a building or a wall, and whether
// one stands between it and him. Every frame counts; the corners must really
// be turned (his heading through a right angle), and buildings must really be
// standing there (solid, not hidden, beside the corner) or the check proves
// nothing.
// ---------------------------------------------------------------------------

module.exports = async function cornerCamChecks({ newPage, check }) {
  const { page } = await newPage(820, 1180);
  const VEHS = [["car", 0], ["cybertruck", 0], ["corvette", 0.8], ["monster", 0]];
  const t0 = Date.now(), TRACE = process.env.CC_TRACE;   // (CC_TRACE=<try>: every frame of one corner)
  for (const city of ["ny", "ca"]) {
    for (const [veh, pull] of VEHS) {
      if (process.env.CC_ONLY && !process.env.CC_ONLY.split(",").includes(city + ":" + veh)) continue;   // (iterating on one)
      const r = await page.evaluate(([city, veh, pull, TRACE]) => {
        const L = window.__lp, S = L.state, cam = L.camera;
        L.noRender = true; L.api.skipScreens();
        for (let i = 0; i < 60 * 10 && S.exploding; i++) L.update(1 / 60);
        L.api.setVehicle(veh); L.api.spawnAt(0, 0); L.api.skipScreens();
        L.api.setView(true); L.api.clearStick();
        for (let i = 0; i < 30; i++) L.update(1 / 60);
        const full = L.CAR.dragRangeX * innerWidth / (L.TUNE.dragRangeX * Math.min(innerWidth, innerHeight));
        const KINDS = ["building", "wall"];
        const live = b => KINDS.includes(L.solidKind(b)) && !L.__lpIsHidden(b);
        // inside: the camera's own point, a 0.3 m ball, in a building or a wall
        const inside = (x, y, z) => { let h = false; L.forEachSolid(b => { if (!h && live(b) && L.solidTest(b, x, y, z, 0.3)) h = true; }); return h; };
        // blocked: anything on the line from him to it, every half metre
        const blocked = (ax, ay, az, bx, by, bz) => {
          const n = Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.5);
          let h = false;
          L.forEachSolid(b => {
            if (h || !live(b)) return;
            if (Math.hypot(b.x - ax, b.z - az) > Math.hypot(b.hw, b.hd) + 30) return;
            for (let j = 1; j < n && !h; j++) { const u = j / n; if (L.solidTest(b, ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u, 0.1)) h = true; }
          });
          return h;
        };
        // a signal head: its own box, round a vertical axis by a right angle or none
        const heads = L.lights.heads || [];
        const headHit = (ax, ay, az, bx, by, bz) => {
          for (const h of heads) {
            if (Math.hypot(h.x - ax, h.z - az) > 40) continue;
            // in the head's own frame: the box as mergeBoxes laid it, turned ry about the vertical
            const cs = Math.cos(h.ry), sn = Math.sin(h.ry), l = (x, z) => [cs * (x - h.x) - sn * (z - h.z), sn * (x - h.x) + cs * (z - h.z)];
            const [lax, laz] = l(ax, az), [lbx, lbz] = l(bx, bz), hx = h.w / 2, hz = h.d / 2, hy = h.h / 2;
            let t0 = 0, t1 = 1, ok = true;
            for (const [a, b, c, e] of [[lax, lbx, 0, hx], [ay, by, h.y, hy], [laz, lbz, 0, hz]]) {
              const d = b - a;
              if (Math.abs(d) < 1e-9) { if (a < c - e || a > c + e) { ok = false; break; } continue; }
              let u0 = (c - e - a) / d, u1 = (c + e - a) / d; if (u0 > u1) [u0, u1] = [u1, u0];
              t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) { ok = false; break; }
            }
            if (!ok || t0 <= 0) continue;
            // (a head within headNear of the eye is in the bulk of the truck -- the monster's eye passes under them -- and is seen past)
            const nr = L.CAR.camClear.headNear;
            if (Math.abs(lax) <= hx + nr && Math.abs(ay - h.y) <= hy + nr && Math.abs(laz) <= hz + nr) continue;
            return true;
          }
          return false;
        };
        // the camera's own point, a 0.3 m ball, in a head (its own box test, not the camera's)
        const headIn = (x, y, z) => heads.some(h => {
          const cs = Math.cos(h.ry), sn = Math.sin(h.ry), lx = cs * (x - h.x) - sn * (z - h.z), lz = sn * (x - h.x) + cs * (z - h.z);
          return Math.abs(lx) <= h.w / 2 + 0.3 && Math.abs(y - h.y) <= h.h / 2 + 0.3 && Math.abs(lz) <= h.d / 2 + 0.3;
        });
        const C = L.streets.cities[city], tries = [];
        for (const node of C.nodes) {
          if (node.arms.length !== 4 || !node.arms.every(a => a.road.kind === "grid")) continue;
          for (const inArm of node.arms) {
            if (inArm.road.len < 90) continue;
            for (const side of [-1, 1]) {
              if (!L.stChoices(node, inArm).find(c => c.ang * side > 1.2 && c.arm.road.kind === "grid")) continue;
              tries.push({ node, inArm, side });
            }
          }
        }
        const out = { city, veh, tries: tries.length, corners: 0, turned: 0, frames: 0, inside: 0, blocked: 0, head: 0, signalFrames: 0, jump: 0, jumps: 0, bangs: 0, near: 0, minBack: 99, worst: [] };
        // every corner there is, lefts and rights both (the Cybertruck, on the car's own
        // camera, a spread of them)
        const spread = veh === "cybertruck" || veh === "monster";
        // (the spread takes half its corners at junctions with signals, the rest anywhere:
        // a plain stride landed on signalled corners by luck -- 1659 frames by a signal on one
        // random stream, 92 on the full harness's)
        const want = spread ? 16 : Infinity, signalled = n => heads.some(h => Math.hypot(h.x - n.x, h.z - n.z) < 30);
        const passes = spread ? [[tries.filter(c => signalled(c.node)), want / 2], [tries.filter(c => !signalled(c.node)), want]] : [[tries, want]];
        for (const [list, upTo] of passes) {
        const step = spread ? Math.max(1, Math.floor(list.length / (want / 2))) : 1;
        // (a corner skipped -- traffic at its start, nothing standing yet -- hands on to
        // the next one, not a whole stride on: skipping a stride left the spread short)
        let nextT = 0;
        for (let t = 0; t < list.length && out.corners < upTo; t++) {
          if (t < nextT) continue;
          const { node, inArm, side } = list[t], rd = inArm.road, dir = inArm.atStart ? -1 : 1, q = {};
          L.stPointAt(rd, dir > 0 ? 5 : rd.len - 5, dir, rd.lo, q);
          // nothing on the approach: put down at speed behind a car queued at the junction,
          // he had no time to be seen and ran into it (a teleport, not a drive; on main too)
          const segD = (px, pz) => { const ax = node.x - q.x, az = node.z - q.z, u = Math.max(0, Math.min(1, ((px - q.x) * ax + (pz - q.z) * az) / (ax * ax + az * az))); return Math.hypot(px - q.x - ax * u, pz - q.z - az * u); };
          if (L.stTraffic.list.some(o => o.alive && (Math.hypot(o.wx - q.x, o.wz - q.z) < 15 || segD(o.wx, o.wz) < 8))) continue;
          S.x = q.x; S.z = q.z; S.y = L.stSurfaceAt(q.x, q.z); S.heading = Math.atan2(-q.fx, -q.fz);
          S.speed = L.CAR.cruise * L.spdStepsFor(veh)[2]; S.exploding = false;
          L.car.yield = 1; L.car.steer = 0; L.car.spent = 0; L.stPlan.road = rd; L.stPlan.dir = dir; L.stPlan.turn = null;
          L.car.rejoin = null; L.car.rejoinT = 0; L.car.rejoinPts = null;
          L.updateScenery(S.x, S.z, true);
          // the camera where it would have been, behind him on the straight
          const fx0 = -Math.sin(S.heading), fz0 = -Math.cos(S.heading);
          cam.position.set(S.x - fx0 * 17, S.y + 6.5, S.z - fz0 * 17);
          // a few frames for the world to catch up with him (a city far off is not drawn, and not solid)
          for (let i = 0; i < 4; i++) { S.touching = true; S.ctrlBank = 0; S.ctrlPitch = 0; L.update(1 / 60); }
          cam.position.set(S.x - fx0 * 17, S.y + 6.5, S.z - fz0 * 17);
          // buildings must be standing beside this corner, or there is nothing to test
          let standing = 0;
          L.forEachSolid(b => { if (L.solidKind(b) === "building" && !L.__lpIsHidden(b) && Math.hypot(b.x - node.x, b.z - node.z) < 60) standing++; });
          if (!standing) { out.unbuilt = (out.unbuilt || 0) + 1; continue; }
          out.near += standing;
          const h0 = S.heading, bangs0 = L.flags.carCrashes || 0;
          out.corners++; nextT = t + step;
          let after = -1, turnedHere = false, prev = null, hand = false;
          for (let i = 0; i < 60 * 12; i++) {
            // the monster truck steers freely (no junction rule): it is turned by hand from the corner until it has turned
            if (veh === "monster" && Math.hypot(S.x - node.x, S.z - node.z) < 14) hand = true;
            const steer = veh !== "monster" ? side * full : (hand && !turnedHere ? side * full : 0);
            S.touching = true; S.touchIsPoint = false; S.ctrlBank = steer; S.ctrlPitch = pull;
            L.update(1 / 60);
            if (S.exploding) break;
            if (!turnedHere && Math.abs(L.wrapPi(S.heading - h0)) > 1.3) { turnedHere = true; after = i + 90; }
            // the line the camera keeps clear: from him at its own eye (the monster's is high over its cab)
            const ey = S.y + (veh === "monster" ? L.TUNE.monster.cam.up * 0.6 : 1.6), p = cam.position;
            out.frames++;
            const bk = Math.hypot(p.x - S.x, p.z - S.z);
            if (bk < out.minBack) { out.minBack = bk; out.minAt = { t, i, up: +(p.y - S.y).toFixed(1), turned: turnedHere }; }
            if (prev && Math.hypot(p.x - prev[0], p.y - prev[1], p.z - prev[2]) > 20 && !out.bigAt) out.bigAt = { t, i, from: prev.map(v => Math.round(v)), to: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], him: [Math.round(S.x), Math.round(S.y), Math.round(S.z)], exploding: S.exploding };
            if (prev) { const j = Math.hypot(p.x - prev[0], p.y - prev[1], p.z - prev[2]); out.jump = Math.max(out.jump, j); if (j > 3) out.jumps++; }
            if (TRACE && +TRACE === t) (out.trace = out.trace || []).push([i, Math.round(S.x), +S.y.toFixed(1), Math.round(S.z), +S.speed.toFixed(1), +Math.hypot(p.x - S.x, p.z - S.z).toFixed(1), +(p.y - S.y).toFixed(1)]);
            prev = [p.x, p.y, p.z];
            // (the monster truck's high camera: never IN a head -- from up there one on the line is a small box in front of a big truck)
            const a = inside(p.x, p.y, p.z), bl = !a && blocked(S.x, ey, S.z, p.x, p.y, p.z), hd = veh === "monster" ? headIn(p.x, p.y, p.z) : headHit(S.x, ey, S.z, p.x, p.y, p.z);
            if (a) out.inside++;
            if (bl) out.blocked++;
            if (hd) out.head++;
            if ((a || bl || hd) && out.worst.length < 6) out.worst.push({ t, i, inside: a, head: hd, x: Math.round(S.x), z: Math.round(S.z), turned: turnedHere });
            if (heads.some(h => Math.hypot(h.x - S.x, h.z - S.z) < 30)) out.signalFrames++;
            if (after >= 0 && i >= after) break;
          }
          if (turnedHere) out.turned++;
          const nb = (L.flags.carCrashes || 0) - bangs0;
          if (nb && (out.bangAt || []).length < 3) (out.bangAt = out.bangAt || []).push({ t, x: Math.round(S.x), z: Math.round(S.z), turned: turnedHere, traffic: L.stTraffic.list.filter(o => o.alive && Math.hypot(o.wx - S.x, o.wz - S.z) < 12).map(o => [Math.round(o.wx), Math.round(o.wz), +(o.v || 0).toFixed(1)]) });
          out.bangs += nb;
          L.api.clearStick();
        }
        }
        out.minBack = +out.minBack.toFixed(1); out.jump = +out.jump.toFixed(1);
        return out;
      }, [city, veh, pull, TRACE]);
      const tag = `${r.city} ${r.veh}${r.veh === "corvette" ? " boosted" : ""}`;
      check(`corner camera ${tag}: on ${r.corners} held corners (${r.turned} turned through a right angle, buildings standing beside every one), the chase camera is never inside a building or a wall and none -- nor a signal head hanging over a junction -- ever stands between it and him -- ${r.frames} frames (${r.signalFrames} by a signal), ${r.inside} inside, ${r.blocked} blocked, ${r.head} through a signal head, nearest ${r.minBack} m behind (never on to his roof: at least 5), its biggest step in a frame ${r.jump} m (${r.jumps} frames over 3 m), ${r.bangs} bangs ${r.bangAt ? JSON.stringify(r.bangAt) : ""} ${JSON.stringify(r.worst)} nearest at ${JSON.stringify(r.minAt)} biggest at ${JSON.stringify(r.bigAt)} ${r.trace ? JSON.stringify(r.trace) : ""} (${r.tries} corners there, ${r.unbuilt || 0} with nothing standing yet; ${Math.round((Date.now() - t0) / 1000)} s in)`,
        r.corners >= (r.veh === "cybertruck" || r.veh === "monster" ? 8 : 60) && r.turned >= Math.ceil(r.corners * 0.75) && r.frames > 2000 && r.signalFrames > 100 && r.inside === 0 && r.blocked === 0 && r.head === 0 && r.bangs === 0 && r.minBack >= 5);
    }
  }
};
