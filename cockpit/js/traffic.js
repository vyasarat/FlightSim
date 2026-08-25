"use strict";
const traffic = [];
const trafficPalette = [0x0b4ea2, 0x1c75bc, 0xc9a227, 0x8a97a8];
function makeTrafficModel(colorHex) {
  const g = new THREE.Group();
  const mA = new THREE.MeshLambertMaterial({ color: colorHex });
  const mB = new THREE.MeshLambertMaterial({ color: 0xdfe8f2 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 13, 10), mA);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), mA);
  nose.position.z = -6.7;
  g.add(nose);
  for (const sx of [-3.4, 3.4]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.16, 1.9), mB);
    wing.position.set(sx, -0.3, -0.5);
    wing.rotation.y = sx > 0 ? -0.4 : 0.4;
    g.add(wing);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 1.5), mB);
  fin.position.set(0, 1.5, 6.4);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.1), mB);
  stab.position.set(0, 0.4, 6.6);
  g.add(stab);
  return g;
}

function spawnTraffic(t, farFromPlayer) {
  const px = state ? state.x : 0, pz = state ? state.z : 0;
  let placed = false;
  for (let tries = 0; tries < 40; tries++) {
    t.heading = Math.random() < 0.5 ? 0 : Math.PI;
    t.x = (Math.random() - 0.5) * 1400;
    t.z = (Math.random() * 2 - 1) * (ROUTE_HALF() + 400);
    t.y = TUNE.waterLevel + 90 + Math.random() * 140;
    if (t.y < terrainEff(t.x, t.z) + 45) continue;
    // Never spawn head-on inside the landing corridor / ring tunnel.
    if (inCorridor(t.x, t.z, 300)) continue;
    const dx = t.x - px, dz = t.z - pz;
    if (farFromPlayer && dx * dx + dz * dz < 700 * 700) continue;
    placed = true;
    break;
  }
  // Every candidate was rejected: park it mid-route, well off the centreline and high.
  if (!placed) { t.x = 600; t.z = 0; t.y = Math.max(terrainEff(t.x, t.z), TUNE.waterLevel) + 200; }
  t.speed = 30 + Math.random() * 26;
  t.phase = Math.random() * Math.PI * 2;
  t.alive = true;
  t.respawn = 0;
  t.mesh.visible = true;
}

function initTraffic() {
  for (let i = 0; i < TUNE.trafficCount; i++) {
    const mesh = makeTrafficModel(trafficPalette[i % trafficPalette.length]);
    mesh.scale.setScalar(1.35);
    scene.add(mesh);
    const t = { mesh, x: 0, y: 0, z: 0, heading: 0, speed: 40, phase: 0, alive: true, respawn: 0, bank: 0 };
    traffic.push(t);
    spawnTraffic(t, false);
    if (Math.abs(t.z - ROUTE_HALF()) < 1500 || Math.abs(t.z + ROUTE_HALF()) < 1500) spawnTraffic(t, true);
  }
}

function killTraffic(t, px, py, pz) {
  t.alive = false;
  t.mesh.visible = false;
  t.respawn = TUNE.trafficRespawnDelay;
  triggerExplosion((t.x + px) / 2, (t.y + py) / 2, (t.z + pz) / 2, 1, state.exploding);
}

function updateTraffic(dt, px, py, pz) {
  for (const t of traffic) {
    if (!t.alive) {
      t.respawn -= dt;
      if (t.respawn <= 0) spawnTraffic(t, true);
      continue;
    }
    t.x += -Math.sin(t.heading) * t.speed * dt;
    t.z += -Math.cos(t.heading) * t.speed * dt;
    const groundNow = Math.max(terrainEff(t.x, t.z), TUNE.waterLevel);
    if (t.y < groundNow + 40) t.y += 30 * dt;
    // Never transit the ring tunnel at glide altitude: side-slip out and climb.
    if (inCorridor(t.x, t.z, 100)) {
      t.x += (t.x >= 0 ? 1 : -1) * 25 * dt;
      if (t.y < groundNow + 260) t.y += 30 * dt;
    }
    if (Math.abs(t.z) > ROUTE_HALF() + 900) {
      spawnTraffic(t, true);
      continue;
    }
    t.bank = Math.sin(performance.now() * 0.0003 + t.phase) * 0.14;
    t.mesh.position.set(t.x, t.y, t.z);
    t.mesh.rotation.set(0, t.heading, t.bank);
  }

  if ((state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY") && !state.exploding) {
    for (const t of traffic) {
      if (!t.alive) continue;
      const dx = t.x - state.x, dy = t.y - state.y, dz = t.z - state.z;
      if (dx * dx + dy * dy + dz * dz < 13 * 13) {
        killTraffic(t, state.x, state.y, state.z);
        flags.midairs++;
        state.exploding = true;
        state.explodeTimer = TUNE.reassembleDelay;
        safePos.x = state.x;
        safePos.z = state.z;
        safePos.y = Math.max(state.y, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + 60);
      }
    }
  }
}

const missiles = [];
const missileGeoBody = new THREE.CylinderGeometry(0.22, 0.22, 2.4, 8);
const missileGeoNose = new THREE.ConeGeometry(0.22, 0.8, 8);
const missileMatBody = new THREE.MeshLambertMaterial({ color: 0xd8dde4 });
const missileMatFlame = new THREE.MeshBasicMaterial({ color: 0xffb43a });
for (let i = 0; i < TUNE.missileCount; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(missileGeoBody, missileMatBody);
  g.add(body);
  const nose = new THREE.Mesh(missileGeoNose, missileMatBody);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.55;
  g.add(nose);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 8), missileMatFlame);
  flame.rotation.x = Math.PI / 2;
  flame.position.z = 1.9;
  g.add(flame);
  g.visible = false;
  scene.add(g);
  missiles.push({ mesh: g, alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
}

function fireMissile() {
  if (state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY") return;
  if (state.missileCooldown > 0 || state.exploding) return;
  const m = missiles.find(mm => !mm.alive);
  if (!m) return;
  state.missileSide *= -1;
  const hr = state.heading;
  const sideX = Math.cos(hr) * 2.6 * state.missileSide;
  const sideZ = -Math.sin(hr) * 2.6 * state.missileSide;
  m.x = state.x + sideX;
  m.y = state.y - 0.5;
  m.z = state.z + sideZ;
  const sp = state.speed + TUNE.missileSpeed;
  m.vx = -Math.sin(hr) * sp;
  m.vz = -Math.cos(hr) * sp;
  m.vy = Math.sin(state.pitch * DEG) * sp;
  m.life = TUNE.missileLife;
  m.alive = true;
  m.mesh.visible = true;
  m.mesh.rotation.set(state.pitch * DEG, hr, 0, "YXZ");
  state.missileCooldown = TUNE.missileCooldown;
  flags.missiles++;
  noiseBurst(0.25, 1400, 0.2, 0);
  synthBlip("sawtooth", 400, 900, 0.3, 0.14, 0);
}

function updateMissiles(dt) {
  state.missileCooldown = Math.max(0, state.missileCooldown - dt);
  for (const m of missiles) {
    if (!m.alive) continue;
    m.life -= dt;

    const speed = Math.hypot(m.vx, m.vy, m.vz);
    const sub = Math.min(6, Math.max(1, Math.ceil((speed * dt) / 2)));
    const sdt = dt / sub;
    let boomed = false;
    let hitX = m.x, hitY = m.y, hitZ = m.z;

    for (let st = 0; st < sub && !boomed; st++) {
      m.x += m.vx * sdt;
      m.y += m.vy * sdt;
      m.z += m.vz * sdt;
      hitX = m.x; hitY = m.y; hitZ = m.z;

      if (m.y <= Math.max(terrainEff(m.x, m.z), TUNE.waterLevel)) { boomed = true; break; }

      forEachSolid(b => {
        if (boomed || isSolidHidden(b)) return;
        if (m.x > b.x - b.hw - 1 && m.x < b.x + b.hw + 1 &&
            m.z > b.z - b.hd - 1 && m.z < b.z + b.hd + 1 &&
            m.y > b.y0 - 1.5 && m.y < b.y1 + 1.5) {
          boomed = true;
          if (b.car !== undefined) shootTrainCar(b.car, m.x, m.y, m.z);
          else shatterAround(m.x, m.y, m.z);
        }
      });
      if (boomed) break;

      for (const t of traffic) {
        if (!t.alive) continue;
        const dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z;
        if (dx * dx + dy * dy + dz * dz < 14 * 14) {
          boomed = true;
          t.alive = false;
          t.mesh.visible = false;
          t.respawn = TUNE.trafficRespawnDelay;
          flags.shootdowns++;
          break;
        }
      }
      if (boomed) break;
      for (const t of targets) {
        if (!t.alive) continue;
        const dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z;
        if (dx * dx + dy * dy + dz * dz < t.r * t.r) {
          boomed = true;
          killTarget(t, m.x, m.y, m.z);
          break;
        }
      }
    }

    const expired = m.life <= 0;
    if (boomed || expired || m.life <= 0) {
      m.alive = false;
      m.mesh.visible = false;
      if (boomed) {
        // While the player is reassembling, a full boom would hijack the debris.
        triggerExplosion(hitX, hitY, hitZ, 0.8, state.exploding);
        flags.missileHits++;
      } else if (expired) {
        triggerExplosion(m.x, m.y, m.z, 0.35, true);
      }
    } else {
      m.mesh.position.set(m.x, m.y, m.z);
    }
  }
}
