"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE BOOSTER ROCKET HE FLIES (v142).
//
// The v133 launch site's rocket, as a card beside the rocket in the picker: an
// orange core with two white side boosters. He launches it from THAT pad, beside
// the motorway (rocketPad answers the launch site while he is in it), and the
// set-piece's own stack steps aside: he is this rocket now, so its stack is
// hidden and it never counts down while he is in the heavy.
//
// THE PART HE LIKES is the boosters coming home, so it is not left to chance:
//   - the two side boosters let go BY THEMSELVES at `sepAlt` (below the core's
//     own first drop, so the order is always sides, then core);
//   - they flip engines-first, fly home and land upright on the launch site's
//     two landing pads, legs out, a puff of dust and a thud, a double boom on
//     the way down -- the set-piece's own flight, in the rocket's own scale;
//   - and the CAMERA GIVES IT TO HIM: from separation until both are down (and
//     a beat after) it leaves the rocket and watches the boosters, from the side
//     of the pads facing the road, both in the picture all the way down. The
//     rocket waits for him up there meanwhile -- held where it was, engine lit,
//     with the speed it had -- and then the camera swings back and the flight
//     goes on exactly as the rocket's: the core, the fairing, the second stage,
//     space, the Moon, Mars, the station, home.
// Nothing new to press. The boosters stand on their pads until the next stack.
// ---------------------------------------------------------------------------
const HV = TUNE.heavy;
const heavy = { boosters: [], watch: null, sepAt: null };
const hvQ = new THREE.Quaternion(), hvV = new THREE.Vector3(), hvNose = new THREE.Vector3(0, 0, -1);

function heavyActive() { return !!(state.vp && state.vp.heavy); }

// ---- the model: the Falcon stack (rocket.js) in the launch site's colours, and
// two side boosters strapped to it ----------------------------------------------
function heavyAddSides(g) {
  const P = TUNE.palette, p = g.userData.rocket;
  // the launch site's own paint: self-lit, so it reads orange and white at a distance, not olive
  const lit = c => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(LSITE.selfLight) });
  const orange = lit(P.fire);
  // the core: the launch site's orange
  p.booster.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xf2f4f7) o.material = orange; });
  const white = lit(P.white), slate = new THREE.MeshLambertMaterial({ color: P.slate });
  const R = 0.8, sides = [];
  for (const side of [-1, 1]) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 7.2, 14), white);
    body.rotation.x = Math.PI / 2; body.position.z = 3.9; b.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(R, 1.8, 14), white);
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.6; b.add(nose);
    for (const z of [1.6, 6.4]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.35, 14), slate); band.rotation.x = Math.PI / 2; band.position.z = z; b.add(band); }
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 0.8, 10), slate); bell.rotation.x = Math.PI / 2; bell.position.z = 7.9; b.add(bell);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.6), slate);
      fin.position.set(Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0.6); fin.rotation.z = a; b.add(fin);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 2.8), slate);
      leg.position.set(Math.cos(a) * (R + 0.08), Math.sin(a) * (R + 0.08), 6.3); leg.rotation.z = a;
      leg.userData.hvLeg = true; leg.userData.a = a; b.add(leg);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.4, 10), new THREE.MeshBasicMaterial({ color: 0xffb43a }));
    flame.rotation.x = -Math.PI / 2; flame.position.z = 9.4; flame.visible = false; b.add(flame);
    b.userData.flame = flame; b.userData.side = side;
    b.position.x = side * (0.95 + R + 0.12);
    g.add(b); sides.push(b);
  }
  p.sides = sides;
  p.mainFlame = g.userData.flame;
}

// ---- where the launch site's pad is: the stack stands on it -----------------
function heavyPad() {
  if (typeof lsite === "undefined" || !lsite.stack) return null;
  return { x: LSITE.x, z: LSITE.z, ground: lsite.padY };
}

// ---- the separation ----------------------------------------------------------------
function heavyCanSeparate() {
  return heavyActive() && state.phase === "AIRBORNE" && !state.exploding && rk.stage === 0 && !rk.sidesGone && !rk.onBody && rocketAlt() >= HV.sepAlt;
}
function heavySeparate() {
  const p = vehicleModel && vehicleModel.userData.rocket;
  if (!p || !p.sides) return false;
  vehicleModel.position.set(state.x, state.y, state.z);
  vehicleModel.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG);
  vehicleModel.updateMatrixWorld(true);
  const size = state.vp.size || 1;
  p.sides.forEach((part, i) => {
    const g = part.clone();
    part.updateMatrixWorld(true);
    g.applyMatrix4(part.matrixWorld);
    g.matrixAutoUpdate = true;
    g.visible = true;
    scene.add(g);
    castsShadow(g);
    const L = lsite.lzs[part.userData.side < 0 ? 0 : 1];
    // out to its own side, and the stack's way, halved
    const rx = Math.cos(state.heading) * part.userData.side, rz = -Math.sin(state.heading) * part.userData.side;
    heavy.boosters.push({
      g, flame: g.children[part.children.indexOf(part.userData.flame)],
      mode: "glide", t: 0, p0: g.position.clone(),
      v0: new THREE.Vector3(rk.vx * 0.5 + rx * HV.sepPush, rk.vy * 0.5, rk.vz * 0.5 + rz * HV.sepPush),
      q0: g.quaternion.clone(), lz: L, base: 7.9 * size, boomed: false, landed: false,
      x: g.position.x, y: g.position.y, z: g.position.z,
    });
  });
  rk.sidesGone = true;
  rocketApplyStages(vehicleModel);
  stageSep();
  heavy.watch = { t: 0, done: 0, wasTouching: state.touching };
  heavy.sepAt = { x: state.x, y: state.y, z: state.z };
  flags.heavySeparations = (flags.heavySeparations || 0) + 1;
  return true;
}

// One booster home: a curve from where it let go to the top of its landing burn
// (arriving straight down, engines first), then the burn on to the pad.
function heavyFlyBooster(b, dt) {
  const D = HV.glideT;
  if (b.mode === "glide") {
    b.t += dt;
    const u = clamp(b.t / D, 0, 1), burnV = 2 * HV.burnH / HV.burnT;
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const d00 = 6 * u * u - 6 * u, d10 = 3 * u * u - 4 * u + 1, d01 = -6 * u * u + 6 * u, d11 = 3 * u * u - 2 * u;
    const P1x = b.lz.x, P1y = b.lz.y + b.base + HV.burnH, P1z = b.lz.z;
    b.x = h00 * b.p0.x + h10 * D * b.v0.x + h01 * P1x;
    b.y = h00 * b.p0.y + h10 * D * b.v0.y + h01 * P1y + h11 * D * -burnV;
    b.z = h00 * b.p0.z + h10 * D * b.v0.z + h01 * P1z;
    hvV.set(d00 * b.p0.x + d10 * D * b.v0.x + d01 * P1x,
            d00 * b.p0.y + d10 * D * b.v0.y + d01 * P1y + d11 * D * -burnV,
            d00 * b.p0.z + d10 * D * b.v0.z + d01 * P1z);
    // engines first: the nose points back along where it is going -- over the
    // top of its arc that is the flip, and by the burn it is straight up
    hvV.negate().normalize();
    hvQ.setFromUnitVectors(hvNose, hvV);
    b.g.quaternion.copy(b.q0).slerp(hvQ, smoothstep(0, HV.flipT, b.t));
    b.g.position.set(b.x, b.y, b.z);
    b.flame.visible = b.t > HV.flipT * 0.4 && b.t < HV.flipT + 2;
    if (!b.boomed && u > HV.boomAt) { b.boomed = true; sonicBoom(); flags.heavyBooms = (flags.heavyBooms || 0) + 1; }
    if (u >= 1) { b.mode = "burn"; b.t = 0; b.g.quaternion.copy(Q_UPRIGHT); }
  } else if (b.mode === "burn") {
    b.t += dt;
    const k = clamp(b.t / HV.burnT, 0, 1), v0 = 2 * HV.burnH / HV.burnT;
    b.x = b.lz.x; b.z = b.lz.z;
    b.y = b.lz.y + b.base + HV.burnH - v0 * HV.burnT * (k - 0.5 * k * k);
    b.g.position.set(b.x, b.y, b.z);
    b.g.quaternion.copy(Q_UPRIGHT);
    b.flame.visible = true;
    const legs = smoothstep(HV.burnT - HV.legsT, HV.burnT - 0.3, b.t);
    for (const c of b.g.children) if (c.userData.hvLeg) { c.rotation.set(-legs * 0.5 * Math.cos(c.userData.a), legs * 0.5 * Math.sin(c.userData.a), c.userData.a); }
    if (k >= 1) heavyLand(b);
  }
}
function heavyLand(b) {
  b.mode = "landed"; b.landed = true; b.flame.visible = false;
  b.y = b.lz.y + b.base; b.g.position.y = b.y;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    wakePuff(b.x + Math.cos(a) * 6, b.lz.y + 0.5, b.z + Math.sin(a) * 6, 0xe6dccb, 1.1, 1.5, 1.2);   // small: the booster on its pad is what he looks at
  }
  boosterLand(); thunk();
  flags.heavyBoosterLandings = (flags.heavyBoosterLandings || 0) + 1;
}
function heavyClearBoosters() {
  for (const b of heavy.boosters) scene.remove(b.g);
  heavy.boosters.length = 0;
  heavy.watch = null;
}
// The tilt of a booster from upright, for the checks
function heavyBoosterTilt(b) {
  hvV.set(0, 0, -1).applyQuaternion(b.g.quaternion);
  return Math.acos(clamp(hvV.y, -1, 1)) / DEG;
}

// ---- the frame, called from updateRocket before anything else ----------------
// Returns true while the camera is watching the boosters: the rocket holds.
function heavyFrame(dt) {
  for (const b of heavy.boosters) heavyFlyBooster(b, dt);
  if (!heavyActive()) return false;
  if (heavyCanSeparate()) heavySeparate();
  const W = heavy.watch;
  if (!W) return false;
  W.t += dt;
  // his hand takes it back: a new touch on the screen (not the throttle he is
  // already holding) ends the watch and the rocket is his again at once
  if (state.touching && !W.wasTouching && W.t > 0.3) { heavy.watch = null; heavyUnhide(); flags.heavyWatchTaps = (flags.heavyWatchTaps || 0) + 1; return false; }
  W.wasTouching = state.touching;
  if (heavy.boosters.every(b => b.landed)) W.done += dt;
  if (W.done >= HV.watchHold || W.t > HV.glideT + HV.burnT + HV.watchHold + 4) { heavy.watch = null; heavyUnhide(); flags.heavyWatches = (flags.heavyWatches || 0) + 1; return false; }
  return true;
}
function heavyUnhide() {
  if (heavy.hidRace && typeof ev !== "undefined" && ev.race === heavy.hidRace) heavy.hidRace.g.visible = true;
  heavy.hidRace = null;
  if (heavy.hidRings && typeof ringsGroup !== "undefined") ringsGroup.visible = true;
  heavy.hidRings = false;
}
function heavyWatching() { return !!heavy.watch && heavyActive(); }

// The camera on the boosters. The two pads stand one behind the other along
// `camFrom` (from the road's side, a little), so in portrait -- tall and narrow
// -- the pair fills the height of the picture rather than overflowing its width.
// It backs off just far enough that both fit, measured with the lens's real
// horizontal and vertical field, and looks at the middle of them.
const hvMid = new THREE.Vector3(), hvR = new THREE.Vector3(), hvF = new THREE.Vector3();
const hvPads = [new THREE.Vector3(), new THREE.Vector3()];
function hvPadPt(b) { const i = heavy.boosters.indexOf(b), v = hvPads[i % 2]; return v.set(b.lz.x, b.lz.y, b.lz.z); }
function heavyCamera(dt) {
  camera.up.set(0, 1, 0);
  // the only rockets in the picture are the two coming home: the space event's
  // racing rocket (events.js), if it is flying beside him, steps out of it
  if (typeof ev !== "undefined" && ev.race && ev.race.g.visible) { ev.race.g.visible = false; heavy.hidRace = ev.race; }
  // ... and the flight's gate rings (one would hang across the picture, huge and near)
  if (typeof ringsGroup !== "undefined" && ringsGroup.visible) { ringsGroup.visible = false; heavy.hidRings = true; }
  if (Math.abs(camera.fov - HV.camFov) > 0.02) { camera.fov = HV.camFov; camera.updateProjectionMatrix(); }
  // what has to be in the picture: both boosters AND the pads they are coming down on
  const pts = [];
  // (the pads only once they are coming down near them: high on the arc, the
  // pads would push the camera so far back the boosters were specks)
  for (const b of heavy.boosters) { pts.push(b.g.position); if (b.g.position.y - b.lz.y < HV.padsBelow) pts.push(hvPadPt(b)); }
  hvMid.set(0, 0, 0);
  for (const p of pts) hvMid.add(p);
  hvMid.multiplyScalar(1 / Math.max(1, pts.length));
  const dir = HV.camFrom, dl = Math.hypot(dir[0], dir[1]);
  hvF.set(-dir[0] / dl, 0, -dir[1] / dl);                // the way it looks, on the flat
  hvR.set(-hvF.z, 0, hvF.x);                             // its right
  let across = 0, up = 0, deep = 0;
  for (const p of pts) {
    hvV.copy(p).sub(hvMid);
    across = Math.max(across, Math.abs(hvV.dot(hvR)));
    up = Math.max(up, Math.abs(hvV.y));
    deep = Math.max(deep, Math.abs(hvV.dot(hvF)));
  }
  const tv = Math.tan(HV.camFov * DEG / 2), th = tv * camera.aspect;
  // (with margin: the buttons stand in the picture's corners)
  const d = clamp(Math.max(HV.camNear, (across + 14) * HV.camMargin / th + deep, (up + 20) * HV.camMargin / tv + deep), HV.camNear, HV.camFar);
  camDesired.set(hvMid.x - hvF.x * d, hvMid.y + d * HV.camUp, hvMid.z - hvF.z * d);
  const gy = Math.max(terrainEff(camDesired.x, camDesired.z), TUNE.waterLevel) + 8;
  if (camDesired.y < gy) camDesired.y = gy;
  // it SWINGS there from wherever it was (it was on him): quick, so the parting is in it
  camera.position.lerp(camDesired, Math.min(1, HV.camLag * dt));
  camera.lookAt(hvMid);
}

// A new stack (a relaunch, a refit, the vehicle picked again): boosters and all.
function heavyReset() {
  heavyUnhide();
  heavyClearBoosters();
  rk.sidesGone = false;
}
