"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- DAD MODE'S AIRCRAFT (v154). The historical missions' shared flight.
//
// Dad mode only, and built from what dadmode.js already promises: nothing exists until a
// mission is entered, nothing is saved, nothing draws Math.random (dadRand / dadQuiet).
//
// ONE MODEL FOR EVERY AEROPLANE that is not the F-35 (dadFly keeps the jet): the stick is
// the jet's -- bank is an ATTITUDE (release levels the wings), pitch is a RATE (release
// holds the nose) -- and the speed is energy: thrust, less drag (k v^2), less gravity along
// the path. With no thrust it glides at the ratio its drag gives it (`ld` at `vbg`), and
// under `vStall` the nose falls on its own. A profile is a plain object (TUNE.dad.air.*):
//   vbg, ld        best-glide speed (m/s) and the glide ratio there: k = g / (ld vbg^2)
//   thrust         m/s^2 at full power (0 for a glider); `m.thr` 0..1 scales it
//   vStall, vMax   the nose falls under vStall; never faster than vMax
//   pitchRateDeg, pitchExpo, bankLimitDeg, rollRate, turnMul, gMax
// The mission says what the thrust is each frame (m.thrust, m/s^2), so a rocket's chambers,
// a dead pair of engines and a full-power take-off are all the same model.
// ---------------------------------------------------------------------------
function dadAirK(P) { return 9.81 / (P.ld * P.vbg * P.vbg); }
function dadAirFly(dt, P, m) {
  const g = 9.81;
  const touching = !m.over && state.touching && !menuOpen() && !m.auto;
  let cb = touching ? state.ctrlBank : 0, cp = touching ? state.ctrlPitch : 0;
  if (m.stick) { cb = m.stick.bank; cp = m.stick.pitch; }   // a mission's own hands (an autopilot on rails)
  const bankT = cb * P.bankLimitDeg;
  state.bank += (bankT - state.bank) * Math.min(1, P.rollRate * dt);
  const v = Math.max(20, state.speed), pr = state.pitch * DEG;
  let w = P.turnMul * g * Math.tan(clamp(state.bank, -80, 80) * DEG) / v;
  let q = Math.sign(cp) * Math.pow(Math.abs(cp), P.pitchExpo) * P.pitchRateDeg * DEG;
  // too slow to hold the nose: it falls, harder the slower
  if (state.speed < P.vStall) q -= (P.vStall - state.speed) / P.vStall * 25 * DEG;
  const load = (qq, ww) => Math.hypot(v * qq + g * Math.cos(pr), v * ww * Math.cos(pr)) / g;
  if (load(q, w) > P.gMax) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (load(q * mid, w * mid) > P.gMax) hi = mid; else lo = mid; }
    q *= lo; w *= lo;
  }
  state.pitch = clamp(state.pitch + q / DEG * dt, -85, 85);
  state.heading -= w * dt;
  m.q = q / DEG;
  m.load = load(q, w);
  // energy: thrust, drag, and gravity along the path; a hard pull bleeds a little more
  const k = dadAirK(P);
  state.speed += ((m.thrust || 0) - k * state.speed * state.speed - g * Math.sin(state.pitch * DEG) - Math.max(0, m.load - 1.5) * 0.4) * dt;
  state.speed = clamp(state.speed, 5, P.vMax);
  const f = dadFwd(dadTmpF);
  forward.copy(f);
  state.x += f.x * state.speed * dt;
  state.y += f.y * state.speed * dt;
  state.z += f.z * state.speed * dt;
}
// the level speed full power holds: where thrust meets drag
function dadAirLevel(P, thrust) { return Math.sqrt(thrust / dadAirK(P)); }

// ---- cameras: behind and above along the flight path (a dive looks down the dive), or
// the seat. `back`, `up` and `look` in metres; `eye` the seat's offset in the airframe.
const dadAirCamPos = new THREE.Vector3(), dadAirCamLook = new THREE.Vector3();
function dadAirCamera(dt, o) {
  o = o || {};
  const m = dad.m, f = dadFwd(dadTmpF), sh = m ? m.shake : 0;
  if (state.exploding) { camera.up.set(0, 1, 0); camera.lookAt(state.x, state.y, state.z); return; }
  if (state.viewChase) {
    const pr = state.pitch * DEG, back = o.back || 40, up = o.up || 10, look = o.look || 80;
    const ux = Math.sin(state.heading) * Math.sin(pr), uy = Math.cos(pr), uz = Math.cos(state.heading) * Math.sin(pr);
    dadAirCamPos.set(state.x - f.x * back + ux * up, state.y - f.y * back + uy * up, state.z - f.z * back + uz * up);
    if (!dad.cam) { camera.position.copy(dadAirCamPos); dad.cam = true; }
    camera.position.lerp(dadAirCamPos, 1 - Math.exp(-(o.stiff || 10) * dt));
    const gy = Math.max(terrainEff(camera.position.x, camera.position.z), TUNE.waterLevel) + 1.5;
    if (camera.position.y < gy) camera.position.y = gy;
    dadAirCamLook.set(state.x + f.x * look, state.y + f.y * look + (o.lookUp || 2), state.z + f.z * look);
    if (o.lookAt) dadAirCamLook.lerp(o.lookAt, o.lookK || 0);
    camera.up.set(ux, uy, uz);
    camera.lookAt(dadAirCamLook);
    camera.rotateZ(-state.bank * DEG * 0.4);
  } else {
    const e = o.eye || [0, 1, -3];
    camera.up.set(0, 1, 0);
    camera.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ");
    camera.position.set(state.x, state.y, state.z);
    camera.translateX(e[0]); camera.translateY(e[1]); camera.translateZ(e[2]);
  }
  if (sh > 0) {
    camera.position.x += (dadRand() - 0.5) * 1.2 * sh; camera.position.y += (dadRand() - 0.5) * 0.9 * sh; camera.position.z += (dadRand() - 0.5) * 1.2 * sh;
    camera.rotateZ((dadRand() - 0.5) * 0.03 * sh);
  }
}
// the aircraft's own body, posed where he is (the shared model, the F-35, is hidden)
function dadAirPose(body, o) {
  if (vehicleModel) vehicleModel.visible = false;
  if (!body) return;
  body.visible = (state.viewChase || (o && o.alwaysShown)) && !state.exploding;
  body.position.set(state.x, state.y, state.z);
  body.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG, "YXZ");
  const props = body.userData.props;
  if (props && dad.m) for (const p of props) p.rotation.z += (dad.m.propRpm === undefined ? 30 : dad.m.propRpm) * 0.016;
}

// ---- a target marker for any mission: a diamond on it with its distance, or, behind him or
// off the screen, an arrow at the edge pointing to it (v152's, made once for every mission)
function dadMarkMake(parent) {
  const mk = (cls, p) => dadEl("div", { class: cls }, p || parent);
  const tgt = mk("dadTgt"); mk("dadTgtGem", tgt); const td = mk("dadTgtD", tgt);
  const arr = mk("dadTgtArrow"), head = mk("dadTgtArrowHead", arr), ad = mk("dadTgtArrowD", arr);
  head.innerHTML = '<svg viewBox="0 0 40 40"><path d="M39 20L22 7V15H3V25H22V33Z" fill="#ff5ad2"/></svg>';
  const v = new THREE.Vector3();
  const M = { on: null, ang: 0,
    update(p, dist, label) {
      if (!p) { tgt.style.display = "none"; arr.style.display = "none"; M.on = null; return; }
      camera.updateMatrixWorld();
      v.set(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse);
      const behind = v.z > 0, cx = v.x, cy = v.y;
      v.set(p.x, p.y, p.z).project(camera);
      const Wd = innerWidth, Ht = innerHeight, txt = label || (dist >= 1000 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m");
      if (!behind && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.86) {
        M.on = true; tgt.style.display = "block"; arr.style.display = "none";
        tgt.style.transform = "translate(" + Math.round((v.x + 1) / 2 * Wd) + "px," + Math.round((1 - v.y) / 2 * Ht) + "px)";
        if (td.textContent !== txt) td.textContent = txt;
      } else {
        M.on = false; tgt.style.display = "none"; arr.style.display = "block";
        const l = Math.hypot(cx, cy) || 1, dx = cx / l, dy = -cy / l, inset = 80;
        const k = Math.min((Wd / 2 - inset) / Math.max(1e-3, Math.abs(dx)), (Ht / 2 - inset) / Math.max(1e-3, Math.abs(dy)));
        M.ang = Math.atan2(dy, dx);
        arr.style.transform = "translate(" + Math.round(Wd / 2 + dx * k) + "px," + Math.round(Ht / 2 + dy * k) + "px)";
        head.style.transform = "rotate(" + M.ang.toFixed(3) + "rad)";
        if (ad.textContent !== txt) ad.textContent = txt;
      }
    } };
  return M;
}

// Shared builders for the mission aircraft (dad mode). Original low-poly shapes in the
// game's style, palette colours only, no insignia or nose art. Every builder returns a
// Group with the nose toward -z, the wings along x, y up, origin at the centre of gravity,
// sized in metres. `props` collects the propeller discs so the mission can spin them.
function dadMatsFor(cols) {
  const out = {};
  for (const k in cols) out[k] = new THREE.MeshLambertMaterial({ color: cols[k], flatShading: true });
  return out;
}
function dadBox(g, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }
function dadCyl(g, r0, r1, len, mat, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg || 10), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
}
// a tapered wing panel: root at x0 (chord c0), tip at x1 (chord c1), leading edge swept back `sweep` metres
function dadWing(g, x0, x1, c0, c1, sweep, t, mat, y, z) {
  const geo = new THREE.BoxGeometry(1, t, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const tip = p.getX(i) > 0, c = tip ? c1 : c0;
    p.setX(i, tip ? x1 : x0);
    p.setZ(i, p.getZ(i) * c + (tip ? sweep : 0));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.position.set(0, y, z); g.add(m); return m;
}
function dadProp(g, props, r, mat, x, y, z) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshBasicMaterial({ color: 0x1f2328, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  disc.position.set(x, y, z); g.add(disc);
  const blades = new THREE.Group(); blades.position.set(x, y, z + 0.02);
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, r * 2, 0.05), mat); b.rotation.z = k * Math.PI / 3; blades.add(b); }
  g.add(blades);
  props.push(blades);
  return blades;
}

// LANCASTER-STYLE heavy bomber (the Type 464 "special" of 617 Squadron): 21 m long, 31 m span,
// four engines in nacelles, twin oval fins, the mid-upper turret faired over, the bomb doors
// gone and the drum slung between two arms under the belly. Night scheme: slate over ink.
function dadBuildLancaster() {
  const M = dadMatsFor({ top: TUNE.palette.slate, under: TUNE.palette.ink, glass: TUNE.palette.night, metal: TUNE.palette.grey, drum: TUNE.palette.steel });
  const g = new THREE.Group(), props = [];
  dadCyl(g, 1.05, 0.9, 15, M.top, 0, 0, 0.5, 12);                // the fuselage
  dadCyl(g, 0.9, 0.35, 5.2, M.top, 0, 0.15, 10.4, 10);            // tapering to the tail
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), M.glass); nose.scale.set(1, 1, 1.4); nose.position.set(0, -0.05, -7.4); g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass); canopy.scale.set(1, 0.9, 2); canopy.position.set(0, 0.85, -4.6); g.add(canopy);
  const tailT = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), M.glass); tailT.position.set(0, 0.2, 13.1); g.add(tailT);
  // the wing: centre section and two tapered panels, the engines along it
  dadBox(g, 7, 0.5, 5.2, M.top, 0, -0.1, -0.8);
  dadWing(g, 3.4, 15.6, 5.2, 2.0, 1.4, 0.4, M.top, -0.1, -0.8);
  dadWing(g, -3.4, -15.6, 5.2, 2.0, 1.4, 0.4, M.top, -0.1, -0.8);
  for (const sx of [-7.9, -3.6, 3.6, 7.9]) {
    dadCyl(g, 0.62, 0.5, 4.2, M.under, sx, -0.15, -2.6, 10);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), M.metal); sp.rotation.x = -Math.PI / 2; sp.position.set(sx, -0.15, -5.0); g.add(sp);
    dadProp(g, props, 1.95, M.under, sx, -0.15, -4.75);
  }
  // the tail: tailplane and its two oval fins at the tips
  dadWing(g, 0.4, 5.3, 2.6, 1.6, 0.6, 0.25, M.top, 0.35, 11.6);
  dadWing(g, -0.4, -5.3, 2.6, 1.6, 0.6, 0.25, M.top, 0.35, 11.6);
  for (const sx of [-5.1, 5.1]) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 14), M.top);
    fin.rotation.z = Math.PI / 2; fin.scale.set(1, 1, 0.75); fin.position.set(sx, 0.75, 12.0); g.add(fin);
  }
  // the drum, slung crosswise between two V arms under the belly
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 1.52, 14), M.drum);
  drum.rotation.z = Math.PI / 2; drum.position.set(0, -1.45, -0.4); g.add(drum);
  for (const sx of [-0.95, 0.95]) { const a = dadBox(g, 0.12, 1.1, 0.5, M.metal, sx, -1.0, -0.4); a.rotation.x = 0.0; }
  g.userData.props = props; g.userData.drum = drum;
  return g;
}
