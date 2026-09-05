"use strict";
// Three optional toys, with fixed pools. Only machines and loose toy cargo;
// nothing here is registered as a living target or a collision wall.
const TW = TUNE.toyWorld;
const toyWorld = {
  root: new THREE.Group(), yards: [], washes: [], clouds: [], objects: [],
  held: null, candidate: null, dwell: 0, dropX: 0, dropZ: 0, dropLock: false, wash: null, washCooldown: 0,
  clock: 0, soundT: 0, lastVehicle: null, lastSpawn: -1, lastLanding: 0,
  trailColor: -1, rainbow: false, trailHead: 0, trailTime: 0, trailCount: 0,
};
const twGeo = {
  box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(1, 8, 6),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  ring: new THREE.TorusGeometry(1, .07, 6, 32),
};
const twMats = new Map();
function twMat(c) {
  if (!twMats.has(c)) twMats.set(c, new THREE.MeshPhongMaterial({ color: c }));
  return twMats.get(c);
}
function twPart(parent, shape, color, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(twGeo[shape], twMat(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m);
  return m;
}
// Batch identical static siblings. Their parent may still animate (brushes,
// crane, cargo); individually revealed build pieces are deliberately left alone.
function twBatchParts(root) {
  for (const child of [...root.children]) if (child.isGroup) twBatchParts(child);
  const batches = new Map();
  for (const m of root.children) {
    if (!m.isMesh || m.isInstancedMesh || !m.visible) continue;
    const key = m.geometry.id + ":" + m.material.id;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(m);
  }
  for (const meshes of batches.values()) {
    if (meshes.length < 3) continue;
    const inst = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
    // r128 has no aggregate instance bounds. Airport parents already distance-cull.
    inst.frustumCulled = false;
    meshes.forEach((m, i) => { m.updateMatrix(); inst.setMatrixAt(i, m.matrix); root.remove(m); });
    root.add(inst);
  }
}

function twSound(freq) {
  if (toyWorld.soundT > 0 || menuOpen()) return;
  toyWorld.soundT = .7;
  synthBlip("sine", freq, freq * 1.3, .22, .12, 0);
}
function twNearYard() {
  return toyWorld.yards.find(y => Math.hypot(state.x - y.x, state.z - y.z) < TW.playground.radius + 65);
}
function twMagnetOn() {
  return heliActive() && !state.exploding && bucket.state === "empty" &&
    (!!toyWorld.held || (!!twNearYard() && state.phase === "AIRBORNE"));
}
function twBuildWorld() {
  if (toyWorld.yards.length) return; // one owned pool for the lifetime of this scene
  const P = TW.playground, W = TW.wash, C = TUNE.palette;
  AIRPORTS.forEach((ap, idx) => {
    const side = idx === 0 ? 1 : -1, x = side * P.x, z = ap.cz + side * P.z;
    const y = Math.max(terrainEff(x, z), TUNE.waterLevel) + 1;
    const g = new THREE.Group(); g.position.set(x, y, z); toyWorld.root.add(g);
    const yard = { g, x, y, z, side, idx, delivery: null, build: [], built: 0, lightT: 0 };
    toyWorld.yards.push(yard);
    twPart(g, 'cylinder', C.sand, 0, -2, 0, P.floorRadius, 4, P.floorRadius);
    // Low colored edge blocks, an open entrance, and oversized cargo silhouettes.
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      twPart(g, 'box', TW.colors[k % 5], Math.cos(a) * 98, 1, Math.sin(a) * 98, 12, 2, 5);
    }
    yard.pad = { x: x + side * 48, y: y + .4, z: z - side * 45 };
    twPart(g, 'cylinder', C.blue, side * 48, .3, -side * 45, P.deliveryR, .6, P.deliveryR);
    const halo = twPart(g, 'ring', C.warning, side * 48, .8, -side * 45, P.deliveryR, P.deliveryR, P.deliveryR); halo.rotation.x = Math.PI / 2;
    // A giant horseshoe magnet on the crane invites the matching helicopter toy.
    const crane = new THREE.Group(); crane.position.set(side * 78, 0, -side * 48); g.add(crane);
    twPart(crane, 'box', C.warning, 0, P.craneH / 2, 0, 6, P.craneH, 6);
    for (let k = 0; k < 5; k++) {
      const brace = twPart(crane, 'box', C.ink, 0, 6 + k * 10, 3.2, 8, 1, 1); brace.rotation.z = k % 2 ? -.6 : .6;
    }
    const arm = new THREE.Group(); arm.position.y = P.craneH; crane.add(arm);
    twPart(arm, 'box', C.warning, -side * 22, 0, 0, 60, 5, 5);
    twPart(arm, 'box', C.slate, side * 12, -4, 0, 10, 9, 10);
    const hook = new THREE.Group(); hook.position.x = -side * 30; arm.add(hook);
    twPart(hook, 'cylinder', C.ink, 0, -12, 0, .35, 24, .35);
    twPart(hook, 'box', C.red, 0, -25, 0, 10, 3, 4);
    for (const sign of [-1, 1]) twPart(hook, 'box', C.red, sign * 4, -29, 0, 3, 7, 4);
    yard.arm = arm; yard.hook = hook;
    yard.lamp = twPart(crane, 'ball', C.cyan, 0, P.craneH + 5, 0, 3, 3, 3);
    // A playful cargo robot grows on a small wheeled float, in a bounded display.
    const build = new THREE.Group(); build.position.set(side * 47, 0, -side * 82); g.add(build); yard.buildGroup = build;
    twPart(build, 'box', C.slate, 0, 2, 0, 32, 3, 18);
    for (const sx of [-12, 12]) for (const sz of [-7, 7]) twPart(build, 'ball', C.ink, sx, 2, sz, 3, 3, 3);
    const robot = [[-9,8],[9,8],[-9,15],[9,15],[-9,22],[0,22],[9,22],[-18,22],[18,22],[-5,30],[5,30],[0,37]];
    for (let k = 0; k < P.buildPieces; k++) {
      const at = robot[k % robot.length];
      const m = twPart(build, 'box', TW.colors[k % 5], at[0], at[1], 0, 7.5, 6.5, 9);
      m.visible = false; yard.build.push(m);
    }
    yard.face = new THREE.Group(); build.add(yard.face); yard.face.visible = false;
    for (const sx of [-5, 5]) twPart(yard.face, 'ball', C.ink, sx, 31, 4.7, 1.2, 1.2, .6);
    for (let k = 0; k < P.objects; k++) {
      const kind = k % 3, color = TW.colors[k % 5], og = new THREE.Group(); toyWorld.root.add(og);
      const w = kind === 2 ? 14 : 8, h = kind === 1 ? 5 : 8, d = kind === 2 ? 7 : (kind === 1 ? 12 : 8);
      twPart(og, 'box', color, 0, 0, 0, w, h, d);
      if (kind === 1) {
        twPart(og, 'box', C.cyan, 0, h / 2 + 1, -1, 6, 3, 5);
        for (const sx of [-4, 4]) for (const sz of [-4, 4]) twPart(og, 'ball', C.ink, sx, -1.5, sz, 1.8, 1.8, 1.8);
      } else if (kind === 2) {
        for (let j = -5; j <= 5; j += 5) twPart(og, 'box', C.steel, j, 0, d / 2 + .1, .5, h - 1, .2);
      } else {
        twPart(og, 'ball', C.white, 0, h / 2 + .2, 0, 2, .8, 2);
      }
      const ox = x + (k % 3 - 1) * 26 - side * 18, oz = z + (Math.floor(k / 3) - 1) * 23 + side * 20;
      const obj = { g: og, yard, kind, w, h, d, homeX: ox, homeZ: oz, x: ox, y: y + h / 2, z: oz,
        vx: 0, vy: 0, vz: 0, lock: false, cooldown: 0, away: 0, delivering: false, tilt: 0 };
      og.position.set(obj.x, obj.y, obj.z); toyWorld.objects.push(obj);
    }
    // Wash on the other side of the starting area, clear of runway and launch pad.
    const wx = side * W.x, wz = ap.cz + side * W.z;
    const wy = Math.max(terrainEff(wx, wz), TUNE.waterLevel) + .6;
    const wg = new THREE.Group(); wg.position.set(wx, wy, wz); toyWorld.root.add(wg);
    const wash = { g: wg, x: wx, y: wy, z: wz, side, idx, brushes: [] }; toyWorld.washes.push(wash);
    twPart(wg, 'box', C.cyan, 0, -.6, 0, W.gateW + 28, 1, W.length + 24);
    for (const sx of [-1, 1]) twPart(wg, 'box', C.blue, sx * (W.gateW / 2 + 6), W.gateH / 2, 0, 7, W.gateH, W.length);
    twPart(wg, 'box', C.cyan, 0, W.gateH, 0, W.gateW + 20, 5, W.length);
    for (const sx of [-1, 1]) {
      const brush = new THREE.Group(); brush.position.set(sx * (W.gateW / 2 + 1), W.gateH / 2 - 2, 0); wg.add(brush);
      twPart(brush, 'cylinder', C.white, 0, 0, 0, 5, W.gateH - 6, 5);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        const bristle = twPart(brush, 'box', k % 2 ? C.red : C.warning, Math.cos(a) * 4, 0, Math.sin(a) * 4, 3, W.gateH - 7, 3);
        bristle.rotation.y = -a;
      }
      wash.brushes.push(brush);
    }
    // Bubble silhouette over the entrance and broad chevrons on the floor.
    for (const [bx, by, r] of [[-9, 6, 6], [2, 9, 8], [13, 4, 5]]) twPart(wg, 'ball', C.white, bx, W.gateH + by, side * 18, r, r, r);
    for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) {
      const arrow = twPart(wg, 'box', C.warning, sx * 4, .2, side * (W.length / 2 + 6 + k * 9), 10, .3, 2);
      arrow.rotation.y = sx * side * .5;
    }
    // The open spray apron is the safe alternative for airliners and rockets.
    twPart(wg, 'cylinder', C.steel, -side * W.openOffset, -.5, 0, 48, 1, 48);
    for (const sx of [-1, 1]) twPart(wg, 'box', C.cyan, -side * W.openOffset + sx * 42, 12, 0, 3, 24, 3);
    twBuildColorClouds(ap, side);
  });
  const magnet = new THREE.Group(); toyWorld.root.add(magnet); toyWorld.magnet = magnet;
  twPart(magnet, 'cylinder', C.ink, 0, -P.cable / 2, 0, .12, P.cable, .12);
  twPart(magnet, 'box', C.red, 0, -P.cable, 0, 5, 1.5, 2);
  for (const sx of [-1, 1]) {
    twPart(magnet, 'box', C.red, sx * 2, -P.cable - 1.6, 0, 1.3, 3, 2);
    twPart(magnet, 'box', C.white, sx * 2, -P.cable - 3, 0, 1.3, 1, 2);
  }
  magnet.visible = false;
  toyWorld.highlight = twPart(toyWorld.root, 'ring', C.warning, 0, 0, 0, 12, 12, 12);
  toyWorld.highlight.rotation.x = -Math.PI / 2; toyWorld.highlight.visible = false;
  // One instanced bubble draw, reused by both washes; no particles allocated in flight.
  const bubbleMat = new THREE.MeshPhongMaterial({ color: C.white, transparent: true, opacity: .48, depthWrite: false });
  toyWorld.bubbles = new THREE.InstancedMesh(twGeo.ball, bubbleMat, W.bubbles);
  toyWorld.bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); toyWorld.bubbles.frustumCulled = false; toyWorld.bubbles.visible = false;
  toyWorld.root.add(toyWorld.bubbles);
  twBuildTrail(); twBatchParts(toyWorld.root); scene.add(toyWorld.root);
}

function twObjectHome(o) {
  o.x = o.homeX; o.z = o.homeZ; o.y = o.yard.y + o.h / 2;
  o.vx = o.vy = o.vz = o.tilt = o.away = 0; o.delivering = false; o.lock = false; o.cooldown = 1;
  o.g.visible = true; o.g.position.set(o.x, o.y, o.z); o.g.rotation.set(0, 0, 0);
}
function twRelease() {
  const o = toyWorld.held;
  if (!o) return false;
  toyWorld.held = null; o.lock = true; o.cooldown = TW.playground.releaseDelay;
  o.vx = -Math.sin(state.heading) * Math.min(state.speed * .12, 6);
  o.vz = -Math.cos(state.heading) * Math.min(state.speed * .12, 6); o.vy = 0;
  toyWorld.dropX = state.x; toyWorld.dropZ = state.z; toyWorld.dropLock = true;
  toyWorld.dwell = 0; flags.magnetDrops = (flags.magnetDrops || 0) + 1; twSound(280);
  return true;
}
function twUpdateMagnet(dt) {
  const P = TW.playground, active = twMagnetOn() && !menuOpen();
  if (toyWorld.held && !active) twRelease();
  if (toyWorld.dropLock && Math.hypot(state.x - toyWorld.dropX, state.z - toyWorld.dropZ) > P.leaveR) toyWorld.dropLock = false;
  let best = null, bestD = P.previewR;
  for (const o of toyWorld.objects) {
    o.cooldown = Math.max(0, o.cooldown - dt);
    const d = Math.hypot(state.x - o.x, state.z - o.z);
    if (o.lock && d > P.leaveR && o.cooldown === 0) o.lock = false;
    if (active && !toyWorld.held && !o.lock && !o.delivering && o.cooldown === 0 && d < bestD && Math.abs(state.y - P.cable - o.y) < P.pickupHeight + 18) { best = o; bestD = d; }
  }
  if (best !== toyWorld.candidate) toyWorld.dwell = 0;
  toyWorld.candidate = best;
  toyWorld.highlight.visible = !!best;
  if (best) {
    toyWorld.highlight.position.set(best.x, best.y + best.h / 2 + 1, best.z);
    toyWorld.highlight.scale.setScalar(Math.max(best.w, best.d) * .85 + Math.sin(toyWorld.clock * 2) * .5);
    if (!toyWorld.dropLock && bestD < P.pickupR && state.speed < P.pickupSpeed && Math.abs(state.y - P.cable - best.y) < P.pickupHeight) toyWorld.dwell += dt;
    else toyWorld.dwell = 0;
    if (toyWorld.dwell >= P.dwell) {
      toyWorld.held = best; best.vx = best.vy = best.vz = 0; best.tilt = 0;
      toyWorld.highlight.visible = false; flags.magnetPickups = (flags.magnetPickups || 0) + 1; twSound(550);
    }
  }
  toyWorld.magnet.visible = active;
  toyWorld.magnet.position.set(state.x, state.y, state.z);
  const o = toyWorld.held;
  if (o) {
    o.x = state.x; o.z = state.z;
    o.y = Math.max(twFloor(o.x, o.z) + o.h / 2, state.y - P.cable - 3 - o.h / 2);
    o.g.position.set(o.x, o.y, o.z); o.g.rotation.set(0, state.heading, 0);
  }
  el.magnetBtn.classList.toggle('hidden', !active || !o);
}
function twFloor(x, z) {
  const yard = toyWorld.yards.find(y => Math.hypot(x - y.x, z - y.z) < TW.playground.floorRadius);
  return yard ? yard.y : Math.max(terrainEff(x, z), TUNE.waterLevel);
}
function twUpdateCargo(dt) {
  const P = TW.playground, step = Math.min(dt, .05);
  for (const o of toyWorld.objects) {
    if (o === toyWorld.held || o.delivering) continue;
    const oldBottom = o.y - o.h / 2;
    o.vy -= P.gravity * step; o.x += o.vx * step; o.z += o.vz * step; o.y += o.vy * step;
    o.vx *= Math.exp(-P.drag * step); o.vz *= Math.exp(-P.drag * step);
    let floor = twFloor(o.x, o.z);
    for (const b of toyWorld.objects) {
      if (b === o || b === toyWorld.held || b.delivering) continue;
      const dx = o.x - b.x, dz = o.z - b.z, top = b.y + b.h / 2;
      const overlap = Math.abs(dx) < (o.w + b.w) * .43 && Math.abs(dz) < (o.d + b.d) * .43;
      if (!overlap) continue;
      if (oldBottom >= top - .8 && o.vy <= 0) floor = Math.max(floor, top);
      else if (Math.abs(o.y - b.y) < (o.h + b.h) * .48) {
        const len = Math.hypot(dx, dz) || 1, nx = len === 1 && dx === 0 ? 1 : dx / len;
        const push = Math.min(P.maxSpeed, 4 + Math.abs(o.vy) * .2);
        // Separate both bodies; pushing the neighbour toward us keeps them
        // overlapping and produces an endless wobble instead of a settled toy.
        b.vx -= nx * push * step * 4; b.vz -= dz / len * push * step * 4;
        o.x += nx * step * 2; o.z += dz / len * step * 2; b.tilt = Math.min(1.3, .35 + Math.abs(o.vy) * .035);
      }
    }
    if (o.y - o.h / 2 <= floor) { o.y = floor + o.h / 2; o.vy = 0; }
    o.vx = clamp(o.vx, -P.maxSpeed, P.maxSpeed); o.vz = clamp(o.vz, -P.maxSpeed, P.maxSpeed);
    o.tilt *= Math.exp(-2 * step);
    o.g.position.set(o.x, o.y, o.z); o.g.rotation.z = o.tilt;
    if (Math.hypot(o.x - o.homeX, o.z - o.homeZ) > P.radius * 2) o.away += dt; else o.away = 0;
    if (o.away > P.recycleAfter) twObjectHome(o);
    const yard = o.yard;
    if (!yard.delivery && o.lock && Math.hypot(o.x - yard.pad.x, o.z - yard.pad.z) < P.deliveryR && o.y < yard.y + 18 && Math.abs(o.vy) < 1) {
      yard.delivery = { o, t: 0, x: o.x, y: o.y, z: o.z }; o.delivering = true;
      flags.magnetDeliveries = (flags.magnetDeliveries || 0) + 1;
    }
  }
  for (const yard of toyWorld.yards) {
    yard.arm.rotation.y = Math.sin(toyWorld.clock * .25) * .08;
    const d = yard.delivery;
    if (d) {
      d.t += dt; const t = Math.min(1, d.t / P.deliveryTime);
      yard.arm.rotation.y = Math.sin(t * Math.PI) * -.6 * yard.side;
      d.o.g.position.set(lerp(d.x, yard.x + yard.side * 47, t), d.y + Math.sin(t * Math.PI) * 38, lerp(d.z, yard.z - yard.side * 82, t));
      yard.lamp.scale.setScalar(3 + Math.sin(t * Math.PI) * 2);
      if (t >= 1) {
        const part = yard.build[yard.built % yard.build.length]; part.visible = true;
        part.material = twMat(TW.colors[yard.built % TW.colors.length]); yard.built++; yard.face.visible = yard.built >= 11;
        twObjectHome(d.o); yard.delivery = null; yard.lightT = 2; twSound(740);
      }
    }
    yard.lightT = Math.max(0, yard.lightT - dt);
    yard.buildGroup.rotation.z = Math.sin(yard.lightT * 5) * .025 * yard.lightT;
  }
}

// Face the invitation at helicopter spawn; planes and rockets keep their headings.
function twFacePlayground() {
  const yard = toyWorld.yards[state.originIdx];
  if (yard) state.heading = Math.atan2(-(yard.x - state.x), -(yard.z - state.z));
}
function twWashRestore(run) {
  if (!run) return;
  for (const [mat, color] of run.finishMats) mat.emissive.copy(color);
}
function twWashBusy() { return !!toyWorld.wash; }
function twWashCan() { return !toyWorld.wash && toyWorld.washCooldown <= 0 && pickerCanOpen() && !menuOpen(); }
function twWashStart(wash) {
  if (!twWashCan()) return false;
  wash = wash || toyWorld.washes[state.originIdx];
  const bounds = new THREE.Box3().setFromObject(vehicleModel), size = bounds.getSize(new THREE.Vector3());
  const open = state.vp.rocket || size.x > TW.wash.gateW - 10 || size.y > TW.wash.gateH - 7;
  const finishMats = new Map();
  vehicleModel.traverse(m => {
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]))
      if (mat && mat.emissive && !finishMats.has(mat)) finishMats.set(mat, mat.emissive.clone());
  });
  const exit = { x: state.x, y: state.y, z: state.z, heading: state.heading };
  if (!state.vp.rocket && Math.hypot(state.x - wash.x, state.z - wash.z) < TW.wash.entryR) {
    exit.x = wash.x; exit.z = wash.z - wash.side * (TW.wash.length / 2 + TW.wash.entryR + 15);
    exit.y = terrainEff(exit.x, exit.z) + TUNE.gearHeight; exit.heading = wash.side === 1 ? 0 : Math.PI;
  }
  toyWorld.wash = { exit, finishMats, site: wash, t: 0, open, rocket: !!state.vp.rocket,
    from: { x: state.x, y: state.y, z: state.z, heading: state.heading }, key: state.vehicleKey };
  releaseAllInputs(); twRelease(); twSound(360);
  flags.washEntries = (flags.washEntries || 0) + 1;
  return true;
}
function twWashGuide(dt) {
  const run = toyWorld.wash;
  if (!run) return;
  const W = TW.wash, site = run.site, t = clamp(run.t / W.duration, 0, 1), smooth = v => v * v * (3 - 2 * v);
  // Rockets get a mobile spray around the pad. Oversized aircraft use the open
  // apron beside the arch. Only the small planes pass between the brushes.
  if (!run.rocket) {
    const x = site.x + (run.open ? -site.side * W.openOffset : 0);
    const z = site.z + site.side * lerp(W.length * .7, -W.length * .7, clamp((t - .25) * 2, 0, 1));
    const f = t < .25 ? smooth(t * 4) : t > .75 ? smooth((1 - t) * 4) : 1;
    const endpoint = t > .75 ? run.exit : run.from;
    state.x = lerp(endpoint.x, x, f); state.z = lerp(endpoint.z, z, f);
    state.y = Math.max(terrainEff(state.x, state.z) + TUNE.gearHeight, lerp(endpoint.y, site.y + TUNE.gearHeight, f));
    state.heading = run.from.heading + wrapPi(site.side === 1 ? -run.from.heading : Math.PI - run.from.heading) * f;
  }
  state.speed = 0; state.throttleHeld = false; state.pitch = run.rocket ? 90 : 0; state.bank = 0;
  state.phase = 'TAXI'; state.airVy = 0; setEngine(.12); setRolling(0);
  if (t >= 1) {
    state.x = run.exit.x; state.y = run.exit.y; state.z = run.exit.z; state.heading = run.exit.heading;
    site.waitExit = true;
    twWashRestore(run); toyWorld.wash = null; toyWorld.washCooldown = W.repeatDelay; toyWorld.bubbles.visible = false;
    releaseAllInputs(); if (heliActive()) heliReset(); twSound(820);
    flags.washCompletions = (flags.washCompletions || 0) + 1;
  }
}
const twBubbleDummy = new THREE.Object3D();
function twUpdateWash(dt) {
  toyWorld.washCooldown = Math.max(0, toyWorld.washCooldown - dt);
  for (const w of toyWorld.washes) if (Math.hypot(state.x - w.x, state.z - w.z) > TW.wash.entryR + 12) w.waitExit = false;
  for (const w of toyWorld.washes) for (const brush of w.brushes) brush.rotation.y += dt * (toyWorld.wash && toyWorld.wash.site === w ? 4 : .3);
  const run = toyWorld.wash;
  toyWorld.bubbles.visible = !!run;
  if (run) {
    run.t += dt;
    // Foam visibly gathers, sweeps across the aircraft, then thins for the reveal.
    const f = clamp(run.t / TW.wash.duration, 0, 1), envelope = Math.sin(f * Math.PI);
    // A brief clean sheen appears as the foam parts, then restores the livery.
    const sheen = Math.max(0, Math.sin(clamp((f - .6) / .4, 0, 1) * Math.PI)) * .3;
    for (const [mat, color] of run.finishMats) mat.emissive.copy(color).addScalar(sheen);
    const span = run.rocket ? 14 : (run.open ? 48 : 22);
    for (let i = 0; i < TW.wash.bubbles; i++) {
      const a = i * 2.399, rise = (i * .37 + run.t * 3) % 22;
      twBubbleDummy.position.set(state.x + Math.cos(a) * span * (.4 + (i % 5) * .12), state.y + rise - 2, state.z + Math.sin(a) * span);
      twBubbleDummy.scale.setScalar(Math.max(.001, envelope * (1.2 + i % 4)));
      twBubbleDummy.updateMatrix(); toyWorld.bubbles.setMatrixAt(i, twBubbleDummy.matrix);
    }
    toyWorld.bubbles.instanceMatrix.needsUpdate = true;
  } else if (heliActive() && twWashCan()) {
    const w = toyWorld.washes.find(w => !w.waitExit && Math.hypot(state.x - w.x, state.z - w.z) < TW.wash.entryR);
    if (w) twWashStart(w);
  }
  el.washBtn.classList.toggle('hidden', !twWashCan());
  if (run) {
    for (const id of ['throttleBtn', 'gearBtn', 'missileBtn', 'vehBtn', 'heliUpBtn', 'heliDownBtn', 'heliHoverBtn', 'washBtn']) el[id].classList.add('hidden');
  }
}

function twHorn() {
  if (toyWorld.soundT > 0 || menuOpen()) return;
  const a = airports.find(a => Math.hypot(state.x, state.z - a.cz) < TW.welcome.hornRange + TUNE.runwayLength / 2);
  if (!a) return;
  twSound(330); toyWorld.soundT = TW.welcome.cooldown; a.twReply = TW.welcome.replyDelay; a.twReplyLeft = 1.2;
}
function twWelcome(idx) {
  const a = airports.find(a => a.idx === idx);
  if (!a) return;
  a.twWelcome = TW.welcome.duration;
  apronVehiclesTo(idx, true);
  for (const [i, v] of a.vehicles.entries()) {
    // Existing vehicles are decorative, not solids; remain outside every wing
    // and outside the runway itself even when the player starts the next roll.
    v.x = a.m * 95; v.z = state.z + (i ? -40 : 40);
    v.tx = a.m * TW.welcome.clearance; v.tz = state.z + (i ? -18 : 18);
  }
  flags.welcomeParades = (flags.welcomeParades || 0) + 1;
}
function twUpdateWelcome(dt) {
  const landed = (flags.touchdown || 0) + (flags.heliLandings || 0);
  if (landed > toyWorld.lastLanding && !state.vp.rocket) {
    const a = airports.find(a => Math.abs(state.z - a.cz) < TUNE.runwayLength / 2 + 50 && Math.abs(state.x) < 95);
    if (a) twWelcome(a.idx);
  }
  toyWorld.lastLanding = landed;
  for (const a of airports) {
    if (a.twWelcome > 0) {
      a.twWelcome -= dt;
      for (const v of a.vehicles) v.tx = a.m * TW.welcome.clearance;
      for (const [i, v] of a.vehicles.entries()) v.mesh.rotation.z = Math.sin(toyWorld.clock * 5 + i) * .07;
      if (a.twWelcome <= 0 || state.throttleHeld || state.phase === 'ROLL' || state.phase === 'AIRBORNE') {
        a.twWelcome = 0; apronVehiclesTo(a.idx, false);
        for (const v of a.vehicles) { v.mesh.rotation.z = 0; v.x = a.m * Math.max(TW.welcome.clearance, Math.abs(v.x)); }
      }
    }
    if (a.twReply > 0) {
      a.twReply -= dt;
      if (a.twReply <= 0) { synthBlip('square', 260, 310, .2, .08, 0); flags.truckReplies = (flags.truckReplies || 0) + 1; }
    }
    if (a.twReplyLeft > 0) {
      a.twReplyLeft -= dt;
      for (const v of a.vehicles) v.mesh.rotation.x = Math.sin(a.twReplyLeft * 8) * .08;
    } else for (const v of a.vehicles) v.mesh.rotation.x = 0;
  }
}

function twBuildColorClouds(ap, side) {
  const T = TW.trails;
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); toyWorld.root.add(g);
    const rainbow = k === 3, x = k % 2 ? -T.cloudSide : T.cloudSide;
    const z = ap.cz + side * (T.cloudZ - k * T.gap), y = ap.elev + T.cloudY + k * 22;
    g.position.set(x, y, z);
    if (rainbow) {
      for (let c = 0; c < TW.colors.length; c++) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(T.rainbowR - c * 6, 3.5, 5, 28, Math.PI), twMat(TW.colors[c])); g.add(arc);
      }
    } else {
      const mat = new THREE.MeshBasicMaterial({ color: TW.colors[k], transparent: true, opacity: .38, depthWrite: false });
      for (let j = 0; j < 5; j++) {
        const puff = new THREE.Mesh(twGeo.ball, mat); puff.position.set((j - 2) * 18, j % 2 * 12, 0); puff.scale.set(25, 19, 18); g.add(puff);
      }
      const ring = twPart(g, 'ring', TW.colors[k], 0, 0, 0, T.cloudR, T.cloudR, T.cloudR); ring.material = twMat(TW.colors[k]);
    }
    toyWorld.clouds.push({ g, x, y, z, color: k, rainbow, inside: false });
  }
}
function twBuildTrail() {
  const T = TW.trails, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T.capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(T.capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('born', new THREE.BufferAttribute(new Float32Array(T.capacity).fill(-1000), 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { now: { value: 0 }, life: { value: T.life }, pointSize: { value: T.size } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float born; uniform float now; uniform float life; uniform float pointSize; varying vec3 tint; varying float fade;
      void main(){ float age=now-born; fade=age>=0.0&&age<life ? pow(1.0-age/life,0.7)*0.65 : 0.0;
      tint=color; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p;
      #include <logdepthbuf_vertex>
      gl_PointSize=fade>0.0 ? clamp(pointSize*500.0/max(1.0,-p.z),1.0,32.0) : 0.0; }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      varying vec3 tint; varying float fade; void main(){float r=length(gl_PointCoord-vec2(.5)); if(r>.5||fade<=0.0) discard;
      #include <logdepthbuf_fragment>
      gl_FragColor=vec4(tint,fade*(1.0-smoothstep(.25,.5,r)));}`,
  });
  toyWorld.trail = new THREE.Points(geo, mat); toyWorld.trail.frustumCulled = false; toyWorld.root.add(toyWorld.trail);
}
const twTrailTint = new THREE.Color();
function twUpdateTrails(dt) {
  const T = TW.trails, flying = state.phase === 'AIRBORNE' && !state.exploding && !state.vp.rocket && !menuOpen();
  for (const c of toyWorld.clouds) {
    c.g.visible = Math.hypot(state.x - c.x, state.z - c.z) < TW.visibleRange;
    const inside = flying && Math.hypot(state.x - c.x, state.y - c.y, state.z - c.z) < (c.rainbow ? T.rainbowR : T.cloudR);
    if (inside && !c.inside) {
      toyWorld.trailColor = c.color; toyWorld.rainbow = c.rainbow;
      flags.trailColors = (flags.trailColors || 0) + 1; if (c.rainbow) flags.rainbowTrails = (flags.rainbowTrails || 0) + 1;
      twSound(c.rainbow ? 800 : 500 + c.color * 70);
    }
    c.inside = inside;
    c.g.scale.setScalar(1 + Math.sin(toyWorld.clock * .8 + c.color) * .025);
  }
  toyWorld.trailTime += dt;
  if (flying && toyWorld.trailColor >= 0 && state.speed > 3 && toyWorld.trailTime >= T.every) {
    toyWorld.trailTime = 0;
    const i = toyWorld.trailHead, geo = toyWorld.trail.geometry;
    geo.attributes.position.setXYZ(i, state.x + Math.sin(state.heading) * 8, state.y - 1, state.z + Math.cos(state.heading) * 8);
    twTrailTint.setHex(TW.colors[toyWorld.rainbow ? Math.floor(toyWorld.trailCount / 5) % TW.colors.length : toyWorld.trailColor % TW.colors.length]);
    geo.attributes.color.setXYZ(i, twTrailTint.r, twTrailTint.g, twTrailTint.b);
    geo.attributes.born.setX(i, toyWorld.clock);
    for (const a of Object.values(geo.attributes)) a.needsUpdate = true;
    toyWorld.trailHead = (i + 1) % T.capacity; toyWorld.trailCount++;
  }
  toyWorld.trail.material.uniforms.now.value = toyWorld.clock;
}
function twResetTrip() {
  twRelease(); twWashRestore(toyWorld.wash); toyWorld.wash = null; toyWorld.bubbles.visible = false; toyWorld.candidate = null; toyWorld.dwell = 0; toyWorld.dropLock = false;
  // Existing colored strokes fade naturally; the next vehicle chooses its own color.
  toyWorld.trailColor = -1; toyWorld.rainbow = false;
  for (const a of airports) { if (a.twWelcome > 0) apronVehiclesTo(a.idx, false); a.twWelcome = 0; }
}
function updateToyWorld(dt) {
  toyWorld.clock += dt; toyWorld.soundT = Math.max(0, toyWorld.soundT - dt);
  if (state.vehicleKey !== toyWorld.lastVehicle || flags.repositioned !== toyWorld.lastSpawn) {
    twResetTrip(); toyWorld.lastVehicle = state.vehicleKey; toyWorld.lastSpawn = flags.repositioned;
  }
  if (state.exploding && toyWorld.wash) { twWashRestore(toyWorld.wash); toyWorld.wash = null; toyWorld.bubbles.visible = false; }
  for (const y of toyWorld.yards) y.g.visible = Math.hypot(state.x - y.x, state.z - y.z) < TW.visibleRange;
  for (const w of toyWorld.washes) w.g.visible = Math.hypot(state.x - w.x, state.z - w.z) < TW.visibleRange;
  twUpdateCargo(dt); twUpdateMagnet(dt); twUpdateWash(dt); twUpdateWelcome(dt); twUpdateTrails(dt);
}
function twControlsLate() {
  el.magnetBtn.classList.toggle('hidden', !toyWorld.held || !twMagnetOn() || menuOpen());
  if (twMagnetOn()) { el.bucketBtn.classList.add('hidden'); if (bucket.g) bucket.g.visible = false; }
  if (toyWorld.wash) for (const id of ['throttleBtn', 'gearBtn', 'missileBtn', 'vehBtn', 'heliUpBtn', 'heliDownBtn', 'heliHoverBtn', 'washBtn']) el[id].classList.add('hidden');
}
// Input listeners are installed once. Replays only reset records in the pools.
el.magnetBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!menuOpen()) twRelease(); });
el.washBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); twWashStart(); });
twBuildWorld();
