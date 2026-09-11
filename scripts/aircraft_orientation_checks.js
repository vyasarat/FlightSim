"use strict";
// ---------------------------------------------------------------------------
// WHICH WAY IS THE AEROPLANE POINTING.
//
// The rig's old taper test decided this by measuring which end of a model is
// blunt, and it lied: it called the 777's nose end 0.76 m wide -- a nose-cone
// tip, not a twenty-metre tailplane -- because that file is 38 separate nodes
// and its sample found the wrong one. Acting on it put the 777 sideways across
// the runway and the A350 nose-first into the chase camera.
//
// These checks cannot lie the same way, because they do not ask about the FILE.
// They ask about the aeroplane as it is actually standing in the world, and they
// ask three independent questions that all have to agree:
//
//   FIN      the highest cluster of the model is the vertical stabiliser, and it
//            is at the back -- so it must lie BEHIND the centroid along the
//            direction the aeroplane is facing.
//   NOSE     after three seconds of throttle the model's forward-most extent
//            must lead along the direction it is actually travelling.
//   WIDTH    the span across the heading must exceed the span along it for a
//            wide-body, which catches the 90-degree error the bounding box
//            could not (a 777 is 63.7 m long with a 60.9 m span, so "the long
//            axis is the fuselage" is decided by centimetres).
//
// Both views, every aeroplane -- the prop and the fighter included, as the
// regression the two imported airliners earned.
// ---------------------------------------------------------------------------

const AIRCRAFT = ["prop", "fighter", "airlinerDelta", "airlinerEmirates"];

module.exports = async function aircraftOrientationChecks({ newPage, check }) {
  const { page } = await newPage(1180, 820);
  await page.evaluate(() => { window.__lp.noRender = true; });

  const r = await page.evaluate((KEYS) => {
    const L = window.__lp, st = L.state;
    const out = {};

    // Every vertex of the drawn body, in world space.
    const cloud = (m) => {
      const pts = [], v = new THREE.Vector3();
      m.updateWorldMatrix(true, true);
      m.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || o.visible === false) return;
        const pos = o.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          pts.push(v.clone());
        }
      });
      return pts;
    };
    const mean = (arr) => arr.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / arr.length);

    for (const key of KEYS) {
      const o = out[key] = {};
      for (const chase of [true, false]) {
        const tag = chase ? "chase" : "cockpit";
        L.api.skipScreens();
        L.api.setVehicle(key); L.api.placeOnRunway(); L.api.setView(chase);
        for (let i = 0; i < 30; i++) L.update(1 / 60);
        let m = L.vehicleModel;
        if (!m) { o[tag] = { ok: false, why: "no model" }; continue; }
        // the cockpit view hides the body; measure it regardless
        const wasVisible = m.visible; m.visible = true;
        let pts = cloud(m);
        m.visible = wasVisible;
        if (pts.length < 50) { o[tag] = { ok: false, why: "no vertices" }; continue; }

        const fwd = new THREE.Vector3(-Math.sin(st.heading), 0, -Math.cos(st.heading));
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const c = mean(pts);
        const along = q => (q.x - c.x) * fwd.x + (q.z - c.z) * fwd.z;
        const across = q => (q.x - c.x) * right.x + (q.z - c.z) * right.z;

        // FIN: highest 2% sits behind the centroid
        const top = [...pts].sort((a, b) => b.y - a.y).slice(0, Math.max(8, Math.floor(pts.length * 0.02)));
        const finAlong = along(mean(top));

        // WIDTH: span across the heading vs along it
        let aMin = 1e9, aMax = -1e9, xMin = 1e9, xMax = -1e9;
        for (const q of pts) {
          const a = along(q), x = across(q);
          if (a < aMin) aMin = a; if (a > aMax) aMax = a;
          if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        }
        o[tag] = { finBehind: finAlong < 0, finAlong: +finAlong.toFixed(2),
                   spanAcross: +(xMax - xMin).toFixed(1), spanAlong: +(aMax - aMin).toFixed(1) };
      }

      // NOSE LEADS: three seconds of throttle, then the forward-most extent must
      // lead along the direction it is actually MOVING, not the direction we
      // assumed. A backwards aeroplane fails this even if its fin test passed.
      L.api.setVehicle(key); L.api.placeOnRunway(); L.api.setView(true);
      const z0 = st.z, x0 = st.x;
      for (let i = 0; i < 60 * 3; i++) { L.api.setThrottle(true); L.update(1 / 60); }
      L.api.setThrottle(false);
      const vx = st.x - x0, vz = st.z - z0;
      const moved = Math.hypot(vx, vz);
      const m2 = L.vehicleModel;
      const was = m2.visible; m2.visible = true;
      const pts2 = cloud(m2);
      m2.visible = was;
      const c2 = mean(pts2);
      const ux = vx / (moved || 1), uz = vz / (moved || 1);
      let lead = -1e9, trail = 1e9;
      for (const q of pts2) {
        const a = (q.x - c2.x) * ux + (q.z - c2.z) * uz;
        if (a > lead) lead = a;
        if (a < trail) trail = a;
      }
      const topM = [...pts2].sort((a, b) => b.y - a.y).slice(0, Math.max(8, Math.floor(pts2.length * 0.02)));
      const finM = mean(topM);
      const finAlongV = (finM.x - c2.x) * ux + (finM.z - c2.z) * uz;
      o.moving = { moved: +moved.toFixed(1), finBehindVelocity: finAlongV < 0, finAlong: +finAlongV.toFixed(2),
                   lead: +lead.toFixed(1), trail: +trail.toFixed(1) };
    }
    return out;
  }, AIRCRAFT);
  await page.close();

  for (const key of AIRCRAFT) {
    const o = r[key];
    const wide = key.startsWith("airliner");
    const both = ["chase", "cockpit"].every(t => o[t] && o[t].finBehind);
    check(`orientation: ${key}'s fin is behind its centroid along the runway heading, in both views`,
      both, JSON.stringify({ chase: o.chase, cockpit: o.cockpit }));
    check(`orientation: ${key} leads with its nose along the direction it is actually travelling`,
      o.moving && o.moving.moved > 20 && o.moving.finBehindVelocity, JSON.stringify(o.moving));
    if (wide) {
      // the 90-degree error the bounding box could not catch
      check(`orientation: ${key} is not sideways -- its span across the heading exceeds its span along it`,
        o.chase && o.chase.spanAcross > o.chase.spanAlong * 0.85,
        JSON.stringify({ across: o.chase.spanAcross, along: o.chase.spanAlong }));
    }
  }
};
