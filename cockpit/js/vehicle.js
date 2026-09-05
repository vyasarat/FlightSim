"use strict";
let vehicleModel = null;
const camDesired = new THREE.Vector3();
const lookV = new THREE.Vector3();
const aimWorld = new THREE.Vector3();
const aimTmp = new THREE.Vector3();
const camFwd = new THREE.Vector3();

function buildVehicleModel(key) {
  if (vehicleModel) {
    scene.remove(vehicleModel);
    vehicleModel.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    vehicleModel = null;
  }
  const cols = TUNE.vehicleColors[key];
  const cA = parseInt(cols[0].slice(1), 16);
  const cB = parseInt(cols[1].slice(1), 16);
  const mA = new THREE.MeshLambertMaterial({ color: cA });
  const mB = new THREE.MeshLambertMaterial({ color: cB });
  const mW = new THREE.MeshLambertMaterial({ color: 0xf2f4f7 });
  const darkM = new THREE.MeshLambertMaterial({ color: 0x1f2328 });
  const glassM = new THREE.MeshLambertMaterial({ color: 0xbfeaff });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    g.add(m);
    return m;
  };

  if (key === "helicopter") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 9), mA);
    body.scale.set(1.15, 1.05, 1.7);
    body.position.z = -0.4;
    g.add(body);
    add(new THREE.SphereGeometry(0.85, 10, 8), glassM, 0, 0.25, -1.6);
    add(new THREE.CylinderGeometry(0.22, 0.28, 4.6, 8), mA, 0, 0.1, 2.6, Math.PI / 2);
    add(new THREE.BoxGeometry(0.14, 1.5, 0.8), mA, 0, 0.75, 4.7);
    add(new THREE.BoxGeometry(0.12, 0.08, 3.4), darkM, -0.65, -1.35, 0.2);
    add(new THREE.BoxGeometry(0.12, 0.08, 3.4), darkM, 0.65, -1.35, 0.2);
    const rotor = new THREE.Group();
    rotor.position.y = 1.85;
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6), darkM));
    rotor.add(new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.06, 0.42), darkM));
    rotor.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 9.4), darkM));
    g.add(rotor);
    g.userData.rotor = rotor;
    const tr = add(new THREE.BoxGeometry(0.06, 1.7, 0.28), darkM, 0.16, 0.75, 4.7);
    g.userData.tailRotor = tr;
  } else if (key === "rocket") {
    buildRocketStack(g, { mA, mB, glassM });
  } else if (key === "starship") {
    buildStarshipStack(g, { mA, mB, glassM });
  } else if (key === "fighter") {
    const fus = add(new THREE.CylinderGeometry(0.75, 0.55, 11, 10), mA, 0, 0, 0, Math.PI / 2);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.4, 10), mA);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -6.8;
    g.add(nose);
    for (const sx of [-3.2, 3.2]) {
      const wing = add(new THREE.BoxGeometry(4.6, 0.14, 2.6), mA, sx, -0.2, 0.6);
      wing.rotation.y = sx > 0 ? -0.55 : 0.55;
    }
    const tail = add(new THREE.BoxGeometry(0.14, 2.6, 1.6), mB, 0, 1.4, 4.6);
    for (const sx of [-1.6, 1.6]) {
      add(new THREE.BoxGeometry(2.4, 0.12, 1.2), mA, sx, 0.2, 4.8);
    }
    add(new THREE.SphereGeometry(0.55, 10, 8), glassM, 0, 0.55, -3.6);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0xffb43a }));
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = 6.6;
    g.add(flame);
    g.userData.flame = flame;
  } else if (key.startsWith("airliner")) {
    const fus = add(new THREE.CylinderGeometry(1.05, 1.05, 13.4, 12), mA, 0, 0, 0, Math.PI / 2);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 9), mA);
    nose.position.z = -6.7;
    g.add(nose);
    const tailCone = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.6, 12), mA);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.z = 8.0;
    g.add(tailCone);
    add(new THREE.BoxGeometry(11.4, 0.16, 2.0), mB, 0, -0.35, -0.6).rotation.y = 0.42;
    add(new THREE.BoxGeometry(11.4, 0.16, 2.0), mB, 0, -0.35, 0.6).rotation.y = -0.42;
    add(new THREE.BoxGeometry(0.16, 2.9, 1.5), mB, 0, 1.5, 6.4);
    add(new THREE.BoxGeometry(4.4, 0.12, 1.1), mA, 0, 0.4, 6.6);
    for (const sx of [-2.6, 2.6]) {
      add(new THREE.CylinderGeometry(0.38, 0.38, 1.5, 8), darkM, sx, -0.75, -1.4, Math.PI / 2);
    }
  } else {
    const fus = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 9), mA);
    fus.scale.set(0.95, 0.95, 2.9);
    g.add(fus);
    add(new THREE.BoxGeometry(7.2, 0.16, 1.5), mB, 0, -0.15, -0.3);
    add(new THREE.BoxGeometry(0.14, 1.35, 0.95), mA, 0, 0.85, 2.5);
    add(new THREE.BoxGeometry(3.1, 0.1, 0.9), mB, 0, 0.15, 2.6);
    const propDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 14),
      new THREE.MeshBasicMaterial({ color: 0x3c4350, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    propDisc.position.set(0, 0, -3.05);
    g.add(propDisc);
    g.userData.propDisc = propDisc;
  }

  // landing gear group (planes only)
  let gearGroup = null;
  if (TUNE.vehicles[key].hasGear) {
    gearGroup = new THREE.Group();
    const strutMat = darkM;
    for (const sx of [-0.85, 0.85]) {
      add.call(g, new THREE.BoxGeometry(0.16, 1.5, 0.22), strutMat, sx * 1.2, -1.15, 0);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), darkM);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx * 1.2, -1.9, 0);
      gearGroup.add(wheel);
    }
    const noseStrut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.2), strutMat);
    noseStrut.position.set(0, -1.05, -2.2);
    gearGroup.add(noseStrut);
    const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10), darkM);
    noseWheel.rotation.x = Math.PI / 2;
    noseWheel.position.set(0, -1.7, -2.2);
    gearGroup.add(noseWheel);
    g.add(gearGroup);
    g.userData.gear = gearGroup;
  }

  g.scale.setScalar(TUNE.vehicles[key].size || 1);
  g.rotation.order = "YXZ";
  scene.add(g);
  castsShadow(g);            // the one shadow he looks for: his own, on the runway
  // whatever burns gets a glow: one sprite, additive, on the shared glow texture
  if (g.userData.flame) {
    const gl = glowSprite(TUNE.sky.engineGlowColor, 1, 0);
    gl.position.copy(g.userData.flame.position);
    g.add(gl);
    g.userData.engineGlow = gl;
    const heat = glowSprite(TUNE.sky.heatColor, 1, 0);
    heat.position.copy(g.userData.flame.position);
    g.add(heat);
    g.userData.padHeat = heat;
  }
  vehicleModel = g;
}

function updateVehicleModel(dt) {
  if (!vehicleModel) return;
  const chaseVisible = state.viewChase && !state.exploding;
  vehicleModel.visible = chaseVisible;
  if (!chaseVisible) return;
  const wheelDrop = state.vp.hasGear ? 1.9 * (state.vp.size || 1) : 0.6;
  if (state.vp.rocket) vehicleModel.position.set(state.x, state.y, state.z);   // the stack is centred on the reference point
  else vehicleModel.position.set(state.x, state.y - TUNE.gearHeight + wheelDrop, state.z);
  if (vehicleModel.userData.baseScale === undefined) vehicleModel.userData.baseScale = vehicleModel.scale.x;
  const bs = vehicleModel.userData.baseScale;
  let sx = 1, sy = 1;
  if (state.squashTimer > 0) { const t = state.squashTimer / 0.35; sy = 1 - 0.22 * Math.sin(t * Math.PI); sx = 1 + 0.1 * Math.sin(t * Math.PI); }
  if (state.popTimer > 0) { const t = 1 - state.popTimer / 0.45; const k = 1 + 0.45 * Math.sin(t * Math.PI) * (1 - t); sx *= k; sy *= k; }
  if (feel.hitStop > 0) return;   // hit-stop: the MODEL holds, the flight model does not
  vehicleModel.scale.set(bs * sx, bs * sy, bs * sx);
  vehicleModel.rotation.set(state.pitch * DEG, state.heading, -state.bank * DEG);
  if (vehicleModel.userData.rotor) vehicleModel.userData.rotor.rotation.y += dt * 26;
  if (vehicleModel.userData.propDisc) vehicleModel.userData.propDisc.rotation.z += dt * 40;
  if (vehicleModel.userData.flame) {
    vehicleModel.userData.flame.scale.y = 0.8 + Math.random() * 0.5;
    vehicleModel.userData.flame.visible = state.vp.rocket ? (state.throttleHeld && rk.fuel[rocketTank()] > 0 && (state.phase === "AIRBORNE" || rk.igniteT > 0.6)) : state.speed > 2;
  }
  if (vehicleModel.userData.engineGlow) {
    const f = vehicleModel.userData.flame, gl = vehicleModel.userData.engineGlow;
    gl.visible = f.visible;
    if (gl.visible) {
      const r = state.vp.rocket ? TUNE.sky.engineGlowRocket : TUNE.sky.engineGlowPlane;
      gl.scale.setScalar(r * (0.85 + Math.random() * 0.3));
      gl.material.opacity = TUNE.sky.engineGlowOpacity;
      gl.position.z = f.position.z + r * 0.1;
    }
    // heat haze, and only where there is air and ground to bounce it off: on the
    // pad and low down, never in orbit
    const heat = vehicleModel.userData.padHeat;
    const low = state.vp.rocket && f.visible && state.spaceF < 0.3 &&
      (state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel)) < 260;
    const wantHeat = low ? TUNE.sky.heatOpacity * (0.7 + 0.3 * Math.sin(performance.now() * 0.001 * TUNE.sky.heatRate)) : 0;
    heat.material.opacity += (wantHeat - heat.material.opacity) * Math.min(1, 5 * dt);
    heat.visible = heat.material.opacity > 0.005;
    if (heat.visible) {
      heat.scale.setScalar(TUNE.sky.heatSize * (0.9 + 0.2 * Math.sin(performance.now() * 0.0013 * TUNE.sky.heatRate)));
      heat.position.z = f.position.z + TUNE.sky.heatSize * 0.25;
    }
  }
  if (vehicleModel.userData.plumeLight) {
    const on = vehicleModel.userData.flame.visible && state.nightF > 0.3;
    vehicleModel.userData.plumeLight.intensity = on ? 4 * state.nightF : 0;
    vehicleModel.userData.plumeLight.position.z = vehicleModel.userData.flame.position.z + 1;
  }
  if (vehicleModel.userData.gear) {
    const a = clamp(state.gearAnim, 0.001, 1);
    vehicleModel.userData.gear.scale.y = a;
    vehicleModel.userData.gear.visible = a > 0.03;
  }
}

// ---------------------------------------------------------------------------
// Feel. Every value here moves the picture and nothing else: the flight model
// never sees any of it.
// ---------------------------------------------------------------------------
const feel = {
  fov: TUNE.fov, punch: 0,      // field of view, and the kick off a catapult
  bob: 0,                        // a slow breath on the chase camera
  hitStop: 0,                    // the model freezes; the world keeps going
  nod: 0, settle: 0, settleV: 0, // the dip and the bounce when he puts it down
  wasDown: true,
};

// A brief widening: the catapult, and a rocket coming off the pad.
function cameraPunch(amount) {
  feel.punch = Math.min(TUNE.camera.fovPunchMax, feel.punch + (amount || 1) * TUNE.camera.fovPunchMax);
}
// The model stops dead for a couple of frames. The aeroplane does not.
function cameraHitStop(scale) {
  feel.hitStop = Math.max(feel.hitStop, TUNE.camera.hitStop * (scale || 1));
}
// A dip of the nose when the wheels touch, and a settle on the gear.
function cameraNod(strength) {
  const C = TUNE.camera;
  feel.nod = Math.max(feel.nod, C.nod * (strength === undefined ? 1 : strength));
  feel.settleV = -C.settle * (strength === undefined ? 1 : strength);
}

function updateFeel(dt) {
  const C = TUNE.camera;
  // ---- field of view: wider the faster he goes, plus whatever punched it
  const sp = state.vp && state.vp.cruiseSpeed ? clamp(state.speed / state.vp.cruiseSpeed, 0, 1.25) : 0;
  feel.punch = Math.max(0, feel.punch - C.punchDecay * dt * Math.max(0.4, feel.punch));
  const wantFov = TUNE.fov + C.fovSpeed * sp + feel.punch;
  feel.fov += (wantFov - feel.fov) * Math.min(1, C.fovRate * dt);
  if (Math.abs(camera.fov - feel.fov) > 0.02) { camera.fov = feel.fov; camera.updateProjectionMatrix(); }

  feel.bob += dt * C.bobRate * (0.6 + sp);
  if (feel.hitStop > 0) feel.hitStop -= dt;
  feel.nod = Math.max(0, feel.nod - C.nodDecay * dt * Math.max(0.5, feel.nod));
  // the settle is a little spring, so it bounces once and stops
  feel.settleV += (-feel.settle * C.settleRate - feel.settleV * 5.5) * dt;
  feel.settle += feel.settleV * dt;

  // ---- touchdown: the wheels arriving is the moment worth feeling
  const down = state.phase === "TAXI" || state.phase === "ROLL";
  if (down && !feel.wasDown && !state.exploding) cameraNod(clamp(Math.abs(state.airVy || 0) / 8, 0.35, 1));
  feel.wasDown = down;
}

// Shake, on a curve. Linear decay made every bang feel the same size; a gamma
// above one drops it fast and then lets it linger, which is what a real one
// does. Capped, because a bang must never hide the thing he is aiming at.
function shakeNow() {
  const C = TUNE.camera;
  return Math.min(C.shakeCap, Math.pow(clamp(shakeAmp, 0, 1), C.shakeGamma) + rumble);
}

function applyCamera(dt) {
  if (state.vp.rocket) { if (marsDroneActive()) marsDroneCamera(dt); else if (roverActive()) roverCamera(dt); else if (astroActive()) astroCamera(dt); else rocketCamera(dt); return; }
  camera.up.set(0, 1, 0);
  if (state.viewChase) {
    const vs = state.vp.size || 1;
    const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
    const C = TUNE.camera;
    const bob = Math.sin(feel.bob) * C.bobAmp;
    camDesired.set(state.x - fx * 30 * vs, state.y + 11 * vs + 3 + bob + feel.settle, state.z - fz * 30 * vs);
    // A little positional lag makes banks feel heavy; the camera also leans a
    // fraction of the bank so a turn reads as a turn.
    camera.position.lerp(camDesired, Math.min(1, 4 * dt));
    lookV.set(state.x + fx * 26, state.y + 2 - feel.nod * 0.5, state.z + fz * 26);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG * C.leanBank);
    camera.rotateX(-feel.nod * DEG);
    const sh = shakeNow();
    camera.position.x += (Math.random() - 0.5) * C.shakeChase[0] * sh;
    camera.position.y += (Math.random() - 0.5) * C.shakeChase[1] * sh;
    camera.position.z += (Math.random() - 0.5) * C.shakeChase[2] * sh;
  } else {
    const C = TUNE.camera;
    const sh = shakeNow();
    camera.position.set(
      state.x + (Math.random() - 0.5) * C.shakeCockpit[0] * sh,
      state.y + (Math.random() - 0.5) * C.shakeCockpit[1] * sh + feel.settle,
      state.z + (Math.random() - 0.5) * C.shakeCockpit[2] * sh
    );
    camera.rotation.set(state.pitch * DEG - feel.nod * DEG, state.heading, -state.bank * DEG);
  }
}
