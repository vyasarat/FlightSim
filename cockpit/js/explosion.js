"use strict";
const debrisMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({}),
  TUNE.debrisCount
);
debrisMesh.setColorAt(0, tmpColor.setHex(0xffffff));   // a multiplier, not a paint: it stays 1.0
debrisMesh.visible = false;
debrisMesh.frustumCulled = false;
scene.add(debrisMesh);

const parts = [];
const FIRE_COLS = [0xff9a2a, 0xffd23e, 0xff7a1a];
const SMOKE_COL = 0x565b63;
const METAL_COL = 0x2f3a48;
for (let i = 0; i < TUNE.debrisCount; i++) {
  parts.push({ alive: false, kind: i % 3, life: 0, maxLife: 1, size: 1,
    px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rvx: 0, rvy: 0 });
}

const fireballs = [];
for (let i = 0; i < 5; i++) {
  const fb = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff8c2a : 0xffd23e, transparent: true, opacity: 0, fog: false })
  );
  fb.visible = false;
  scene.add(fb);
  fireballs.push(fb);
}
// One additive flash that rides the biggest live fireball. Explosions are the
// loudest thing in the game and they were pure geometry before this.
const blastGlow = glowSprite(TUNE.sky.blastGlowColor, 1, 0);
blastGlow.visible = false;
scene.add(blastGlow);

let shakeAmp = 0;
let rumble = 0; // runway rumble while rolling; separate from explosion shake

// `small`: a visible pop only (fireballs + soft sound) -- no debris reset, no
// camera shake. Used for a missile reaching the end of its range so a distant
// self-destruct can't hijack a reassemble animation that's mid-flight.
function triggerExplosion(nx, ny, nz, intensity, small) {
  if (small) {
    for (const fb of fireballs) {
      fb.visible = true;
      fb.position.set(nx, ny + 2, nz);
      fb.position.x += (rnd() - 0.5) * 8;
      fb.userData.t = 0;
      fb.userData.dur = 0.35 + rnd() * 0.2;
    }
    noiseBurst(0.25, 400, 0.3, 0);
    return;
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.alive = true;
    p.kind = i % 3;
    p.maxLife = (p.kind === 1 ? 1.9 : 1.3) + rnd() * 0.7;
    p.life = p.maxLife;
    const sp = (16 + rnd() * 34) * (0.7 + intensity * 0.5);
    const th = rnd() * Math.PI * 2;
    const up = p.kind === 1 ? 0.6 + rnd() * 0.5 : rnd() * 1.2 - 0.15;
    const side = Math.sqrt(Math.max(0, 1 - up * up));
    p.px = nx; p.py = ny; p.pz = nz;
    p.vx = Math.cos(th) * side * sp;
    p.vz = Math.sin(th) * side * sp;
    p.vy = Math.abs(up) * sp;
    p.rx = rnd() * Math.PI; p.ry = rnd() * Math.PI;
    p.rvx = (rnd() - 0.5) * 9; p.rvy = (rnd() - 0.5) * 9;
    p.size = p.kind === 1 ? 1.6 + rnd() * 1.6 : 0.7 + rnd() * 1.3;
  }
  for (const fb of fireballs) {
    fb.visible = true;
    fb.position.set(nx, ny + 2, nz);
    fb.position.x += (rnd() - 0.5) * 8;
    fb.userData.t = 0;
    fb.userData.dur = 0.5 + rnd() * 0.25;
  }
  debrisMesh.visible = true;
  // shake falls off with distance so a missile hit 500 m away doesn't rattle the cockpit
  const dist = Math.hypot(nx - state.x, ny - state.y, nz - state.z);
  shakeAmp = Math.max(shakeAmp, clamp(1 - dist / 260, 0.08, 1));
  bigBoom(nx, ny, nz);
  flags.exploded++;
  const groundY = Math.max(terrainEff(nx, nz), TUNE.waterLevel);
  startSmoke(nx, Math.max(ny, groundY), nz, 8);
  if (ny - groundY < 6 && terrainEff(nx, nz) > TUNE.waterLevel + 0.2) placeCrater(nx, groundY, nz);
}

function updateExplosion(dt, homePos, seeking) {
  // Nothing burning, nothing to home in on: skip the 26 matrix writes.
  if (!debrisMesh.visible && !fireballs.some(fb => fb.visible)) { if (blastGlow.visible) blastGlow.visible = false; return; }
  {
    // the flash follows whichever fireball is currently brightest
    let best = null;
    for (const fb of fireballs) if (fb.visible && (!best || fb.material.opacity > best.material.opacity)) best = fb;
    blastGlow.visible = !!best && best.material.opacity > 0.02;
    if (blastGlow.visible) {
      blastGlow.position.copy(best.position);
      blastGlow.scale.setScalar(best.scale.x * TUNE.sky.blastGlowScale);
      blastGlow.material.opacity = best.material.opacity * TUNE.sky.blastGlowOpacity;
    }
  }
  let anyAlive = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.alive || p.life <= 0) {
      if (p.alive) p.alive = false;
      dummyObj.position.set(0, -9999, 0);
      dummyObj.scale.setScalar(0.001);
      dummyObj.rotation.set(0, 0, 0);
      dummyObj.updateMatrix();
      debrisMesh.setMatrixAt(i, dummyObj.matrix);
      continue;
    }
    anyAlive = true;
    p.life -= dt;
    if (seeking && p.life < 0.55) {
      p.px += (homePos.x - p.px) * Math.min(1, 9 * dt);
      p.py += (homePos.y - p.py) * Math.min(1, 9 * dt);
      p.pz += (homePos.z - p.pz) * Math.min(1, 9 * dt);
    } else {
      const grav = p.kind === 2 ? -30 : (p.kind === 1 ? 5 : -9);
      p.vy += grav * dt;
      p.vx *= 1 - Math.min(1, 1.1 * dt);
      p.vz *= 1 - Math.min(1, 1.1 * dt);
      p.px += p.vx * dt; p.py += p.vy * dt; p.pz += p.vz * dt;
    }
    p.rx += p.rvx * dt; p.ry += p.rvy * dt;
    const fade = clamp(p.life / 0.4, 0, 1);
    dummyObj.position.set(p.px, p.py, p.pz);
    dummyObj.rotation.set(p.rx, p.ry, 0);
    dummyObj.scale.setScalar(Math.max(0.01, p.size * (p.kind === 1 ? (2 - p.life / p.maxLife) : fade)));
    dummyObj.updateMatrix();
    debrisMesh.setMatrixAt(i, dummyObj.matrix);
    tmpColor.setHex(p.kind === 0 ? FIRE_COLS[i % FIRE_COLS.length] : (p.kind === 1 ? SMOKE_COL : METAL_COL));
    debrisMesh.setColorAt(i, tmpColor);
  }
  debrisMesh.instanceMatrix.needsUpdate = true;
  if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
  if (!anyAlive && !seeking) debrisMesh.visible = false;
  for (const fb of fireballs) {
    if (!fb.visible) continue;
    fb.userData.t += dt;
    const tt = fb.userData.t / fb.userData.dur;
    if (tt >= 1) { fb.visible = false; fb.material.opacity = 0; continue; }
    fb.scale.setScalar(3 + tt * 16);
    fb.material.opacity = 0.9 * (1 - tt);
  }
}
