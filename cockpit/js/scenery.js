"use strict";
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
function makeCloud() {
  const g = new THREE.Group();
  const puffs = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < puffs; i++) {
    const r = 18 + rnd() * 26;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
    puff.position.set((rnd() - 0.5) * 70, (rnd() - 0.5) * 14, (rnd() - 0.5) * 50);
    puff.scale.y = 0.55;
    g.add(puff);
  }
  return g;
}

const clouds = [];
for (let i = 0; i < TUNE.cloudCount; i++) clouds.push(makeCloud());

function respawnCloud(c, px, pz, hx, hz, ahead) {
  const d = TUNE.cloudRespawnAhead[0] + rnd() * (TUNE.cloudRespawnAhead[1] - TUNE.cloudRespawnAhead[0]);
  const lat = (rnd() - 0.5) * 2 * TUNE.cloudLateralSpread;
  const base = ahead ? d : rnd() * TUNE.fogFar;
  c.position.set(
    px + hx * base - hz * lat,
    TUNE.cloudAltitudeMin + rnd() * (TUNE.cloudAltitudeMax - TUNE.cloudAltitudeMin),
    pz + hz * base + hx * lat
  );
}

function inCorridor(x, z, extra) {
  for (let i = 0; i < AIRPORTS.length; i++) {
    if (Math.abs(x) < TUNE.runwayWidth / 2 + 35 + extra
      && Math.abs(z - AIRPORTS[i].cz) < TUNE.runwayLength / 2 + TUNE.ringStartDistance + extra) {
      return true;
    }
  }
  return false;
}

const trunkInst = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.5, 0.75, 4, 5),
  new THREE.MeshLambertMaterial({ color: TUNE.treeTrunkColor }),
  TUNE.treeMaxInstances
);
const canopyInst = new THREE.InstancedMesh(
  new THREE.ConeGeometry(3.4, 9.5, 7),
  new THREE.MeshLambertMaterial({ color: 0xffffff }),
  TUNE.treeMaxInstances
);
canopyInst.setColorAt(0, tmpColor.setHex(TUNE.treeCanopyColor));

const buildingInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  new THREE.MeshLambertMaterial({ color: 0xffffff }),
  TUNE.buildingMaxInstances
);
buildingInst.setColorAt(0, tmpColor.setHex(0xcfc4ae));

const buildingBoxes = [];

const BUILDING_PALETTE = [0xcfc4ae, 0xc7a186, 0xb9b0a0, 0xd8cdb4, 0xa89880, 0xc2b8a4];
scene.add(trunkInst, canopyInst, buildingInst);

const towerProto = (() => {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const red = new THREE.MeshLambertMaterial({ color: 0xd63a2f });
  const mk = (rTop, rBot, h, y, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8), mat);
    m.position.y = y;
    g.add(m);
  };
  mk(7, 9, 8, 4, white);
  mk(3.4, 4.4, 30, 23, red);
  mk(3.0, 3.4, 26, 51, white);
  mk(2.4, 3.0, 24, 76, red);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), white);
  ball.position.y = 93;
  g.add(ball);
  const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xff4030, fog: false });
  const blinker = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), blinkerMat);
  blinker.position.y = 101;
  // Found by name after clone(): Group.clone() JSON-copies userData, so a Mesh
  // reference stored there would become a dead plain object.
  blinker.name = "blinker";
  g.add(blinker);
  return g;
})();

const bridgeProto = (() => {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: 0x9aa2ad });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(360, 5, 18), steel);
  g.add(deck);
  for (const sx of [-115, 115]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 14), steel);
    pylon.position.set(sx, -16, 0);
    g.add(pylon);
  }
  for (const sz of [-9.4, 9.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(360, 2.2, 2), steel);
    rail.position.set(0, 4.4, sz);
    g.add(rail);
  }
  return g;
})();

const landmarkCells = new Map();
const blinkers = [];
const dummyObj = new THREE.Object3D();

function placeLandmark(cellX, cellZ) {
  const cxw = cellX * TUNE.landmarkGrid, czw = cellZ * TUNE.landmarkGrid;
  const isTower = hashSalt(cellX, cellZ, 91) < 0.5;
  let lx = cxw + (hashSalt(cellX, cellZ, 92) - 0.5) * TUNE.landmarkGrid * 0.5;
  let lz = czw + (hashSalt(cellX, cellZ, 93) - 0.5) * TUNE.landmarkGrid * 0.5;
  if (Math.abs(lx) < 1700 && Math.abs(lz) < 1700) return null;
  if (inCorridor(lx, lz, 200)) return null;
  const proto = isTower ? towerProto : bridgeProto;
  const inst = proto.clone();
  const solids = [];
  if (isTower) {
    const gy = terrainEff(lx, lz);
    if (gy < TUNE.waterLevel + 1) return null;
    inst.position.set(lx, gy, lz);
    const bl = inst.getObjectByName("blinker");
    if (bl) { inst.userData.blinker = bl; blinkers.push(bl); }
    solids.push({ x: lx, z: lz, hw: 5, hd: 5, y0: gy, y1: gy + 101 });   // the shaft; the ball is small
  } else {
    let deckY = TUNE.waterLevel + 15;
    let overWater = true;
    for (let s = -1; s <= 1; s += 0.5) {
      if (terrainEff(lx + s * 140, lz) > TUNE.waterLevel + 2.5) overWater = false;
    }
    if (!overWater) deckY = terrainEff(lx, lz) + 15;
    inst.position.set(lx, deckY, lz);
    inst.rotation.y = (hashSalt(cellX, cellZ, 94) < 0.5 ? 0 : Math.PI / 2);
    const rot = Math.abs(inst.rotation.y) > 0.1;
    if (rot) {
      solids.push({ x: lx, z: lz, hw: 10, hd: 185, y0: deckY - 4, y1: deckY + 7 });
      solids.push({ x: lx, z: lz - 115, hw: 7, hd: 7, y0: deckY - 31, y1: deckY - 1 });
      solids.push({ x: lx, z: lz + 115, hw: 7, hd: 7, y0: deckY - 31, y1: deckY - 1 });
    } else {
      solids.push({ x: lx, z: lz, hw: 185, hd: 10, y0: deckY - 4, y1: deckY + 7 });
      solids.push({ x: lx - 115, z: lz, hw: 7, hd: 7, y0: deckY - 31, y1: deckY - 1 });
      solids.push({ x: lx + 115, z: lz, hw: 7, hd: 7, y0: deckY - 31, y1: deckY - 1 });
    }
  }
  scene.add(inst);
  streamedSolids.set(cellX + "," + cellZ, solids);
  return inst;
}

function syncLandmarks(px, pz) {
  const grid = TUNE.landmarkGrid;
  const ccx = Math.round(px / grid), ccz = Math.round(pz / grid);
  const R = Math.ceil((TUNE.sceneryRadius + 400) / grid);
  const need = new Set();
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const cx = ccx + dx, cz = ccz + dz;
      const k = cx + "," + cz;
      if (hashSalt(cx, cz, 90) >= TUNE.landmarkChance) continue;
      need.add(k);
      if (!landmarkCells.has(k)) {
        const inst = placeLandmark(cx, cz);
        landmarkCells.set(k, inst);
      } else if (landmarkCells.get(k) === null) {
        landmarkCells.set(k, placeLandmark(cx, cz));
      }
    }
  }
  for (const [k, inst] of landmarkCells) {
    if (!need.has(k)) {
      if (inst) {
        scene.remove(inst);
        const bi = blinkers.indexOf(inst.userData.blinker);
        if (bi >= 0) blinkers.splice(bi, 1);
      }
      streamedSolids.delete(k);
      landmarkCells.delete(k);
    }
  }
}

function rebuildTrees(px, pz) {
  const cs = TUNE.treeCell;
  const R = Math.ceil(TUNE.sceneryRadius / cs);
  const ccx = Math.round(px / cs), ccz = Math.round(pz / cs);
  let ti = 0;
  outer:
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const cx = ccx + dx, cz = ccz + dz;
      if (hashSalt(cx, cz, 41) >= TUNE.treeDensity) continue;
      const n = 1 + Math.floor(hashSalt(cx, cz, 42) * TUNE.treeMaxPerCell);
      for (let k = 0; k < n; k++) {
        if (ti >= TUNE.treeMaxInstances) break outer;
        const wx = (cx + hashSalt(cx * 5 + k, cz, 43)) * cs;
        const wz = (cz + hashSalt(cx, cz * 5 + k, 44)) * cs;
        if (flattenMask(wx, wz) > 0.02) continue;
        if (inCorridor(wx, wz, 40)) continue;
        const gy = terrainEff(wx, wz);
        if (gy < TUNE.waterLevel + 1.6) continue;
        const palm = pFromNY(wz) < 0.055;
        const s = 0.8 + hashSalt(cx + k, cz - k, 45) * 0.9;
        const sy = s * (0.9 + hashSalt(cx, cz, 47) * 0.5) * (palm ? 1.75 : 1);
        dummyObj.position.set(wx, gy - 0.3, wz);
        dummyObj.rotation.set(0, hashSalt(cx, cz, 46) * Math.PI * 2, 0);
        dummyObj.scale.set(palm ? s * 0.5 : s, sy, palm ? s * 0.5 : s);
        dummyObj.updateMatrix();
        trunkInst.setMatrixAt(ti, dummyObj.matrix);
        canopyInst.setMatrixAt(ti, dummyObj.matrix);
        if (palm) {
          dummyObj.position.y = gy + sy * 4;
          dummyObj.scale.set(s * 1.2, s * 0.5, s * 1.2);
          dummyObj.updateMatrix();
          canopyInst.setMatrixAt(ti, dummyObj.matrix);
        }
        tmpColor.setHex(palm ? 0x2f7a3f : TUNE.treeCanopyColor).multiplyScalar(0.82 + hashSalt(cx - k, cz + k, 48) * 0.4);
        canopyInst.setColorAt(ti, tmpColor);
        ti++;
      }
    }
  }
  trunkInst.count = ti;
  canopyInst.count = ti;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
}

// Bumped on every rebuild: a hidden town entry from an older generation refers
// to an index that now belongs to a different building and must not restore.
let buildingGen = 0;
function rebuildBuildings(px, pz) {
  buildingGen++;
  if (typeof hiddenTownIdx !== "undefined") {
    hiddenTownIdx.clear();
    for (let i = hiddenPieces.length - 1; i >= 0; i--) if (hiddenPieces[i].kind === "town") hiddenPieces.splice(i, 1);
  }
  const grid = TUNE.townGrid;
  const R = Math.ceil(TUNE.sceneryRadius / grid);
  const ccx = Math.round(px / grid), ccz = Math.round(pz / grid);
  let bi = 0;
  buildingBoxes.length = 0;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (bi >= TUNE.buildingMaxInstances) break;
      const cx = ccx + dx, cz = ccz + dz;
      if (hashSalt(cx, cz, 61) >= TUNE.townChance) continue;
      const tcx = (cx + 0.5 + (hashSalt(cx, cz, 62) - 0.5) * 0.6) * grid;
      const tcz = (cz + 0.5 + (hashSalt(cx, cz, 63) - 0.5) * 0.6) * grid;
      if (inCorridor(tcx, tcz, 60)) continue;
      const n = TUNE.townBuildingsMin + Math.floor(hashSalt(cx, cz, 64) * (TUNE.townBuildingsMax - TUNE.townBuildingsMin + 1));
      for (let k = 0; k < n; k++) {
        if (bi >= TUNE.buildingMaxInstances) break;
        const ang = hashSalt(cx * 7 + k, cz, 65) * Math.PI * 2;
        const rad = (0.25 + hashSalt(cx * 7 + k, cz * 7 + k, 66) * 0.75) * grid * 0.33;
        const wx = tcx + Math.cos(ang) * rad;
        const wz = tcz + Math.sin(ang) * rad;
        if (flattenMask(wx, wz) > 0.02 || inCorridor(wx, wz, 40)) continue;
        if (Math.abs(wx - 340) < 14) continue;   // the freight line runs along x=340
        const gy = terrainEff(wx, wz);
        if (gy < TUNE.waterLevel + 1.8) continue;
        const w = 8 + hashSalt(cx + k, cz, 67) * 14;
        const d = 8 + hashSalt(cx, cz + k, 68) * 14;
        const hgt = 6 + hashSalt(cx + k, cz - k, 69) * 20;
        const rotIdx = Math.round(hashSalt(cx, cz, 70) * 4);
        dummyObj.position.set(wx, gy - 0.3, wz);
        dummyObj.rotation.set(0, rotIdx * Math.PI / 2 + (hashSalt(cx, cz, 71) - 0.5) * 0.2, 0);
        dummyObj.scale.set(w, hgt, d);
        dummyObj.updateMatrix();
        buildingInst.setMatrixAt(bi, dummyObj.matrix);
        tmpColor.setHex(BUILDING_PALETTE[Math.floor(hashSalt(cx + k, cz + k, 72) * BUILDING_PALETTE.length)]);
        buildingInst.setColorAt(bi, tmpColor);
        // Collider follows the visual quarter-turn: odd turns swap the x/z extents.
        const hw = (rotIdx % 2 ? d : w) / 2, hd = (rotIdx % 2 ? w : d) / 2;
        buildingBoxes.push({ x: wx, z: wz, hw, hd, y0: gy - 0.3, y1: gy - 0.3 + hgt, top: gy - 0.3 + hgt, idx: bi });
        bi++;
      }
    }
  }
  buildingInst.count = bi;
  buildingInst.instanceMatrix.needsUpdate = true;
  if (buildingInst.instanceColor) buildingInst.instanceColor.needsUpdate = true;
}

let scenCenterX = null, scenCenterZ = null;
function updateScenery(px, pz, force) {
  if (!force && scenCenterX !== null) {
    const dx = px - scenCenterX, dz = pz - scenCenterZ;
    if (dx * dx + dz * dz < TUNE.sceneryRebuildDist * TUNE.sceneryRebuildDist) return;
  }
  scenCenterX = px;
  scenCenterZ = pz;
  rebuildTrees(px, pz);
  rebuildBuildings(px, pz);
  syncLandmarks(px, pz);
}

const streamedSolids = new Map();
