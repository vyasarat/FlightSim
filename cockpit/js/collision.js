"use strict";
// Pieces hidden by a shatter (player crash or missile hit). They restore on
// their own timer so a missile-shattered building never lingers as an invisible
// wall waiting for the *player* to crash. A hidden piece is also skipped by
// collision so nothing solid is ever invisible.
const hiddenPieces = [];
const hiddenTownIdx = new Set();
let shatterTimer = 0;
const MAX_HIDDEN_PIECES = 24;

function isSolidHidden(b) {
  if (b.mesh) return b.mesh.visible === false || (b.mesh.parent && b.mesh.parent.visible === false);
  if (b.idx !== undefined) return hiddenTownIdx.has(b.idx);
  return false;
}

function shatterAround(px, py, pz) {
  forEachSolid(b => {
    if (hiddenPieces.length >= MAX_HIDDEN_PIECES) return;
    if (isSolidHidden(b)) return;
    const dx = Math.max(b.x - b.hw - px, px - (b.x + b.hw), 0);
    const dz = Math.max(b.z - b.hd - pz, pz - (b.z + b.hd), 0);
    const dy = Math.max(b.y0 - py, py - b.y1, 0);
    if (dx * dx + dz * dz + dy * dy > 70 * 70) return;
    if (b.mesh) {
      b.mesh.visible = false;
      hiddenPieces.push({ kind: "mesh", mesh: b.mesh });
    } else if (b.idx !== undefined) {
      const m = new THREE.Matrix4();
      buildingInst.getMatrixAt(b.idx, m);
      hiddenPieces.push({ kind: "town", idx: b.idx, mat: m, gen: buildingGen });
      hiddenTownIdx.add(b.idx);
      dummyObj.position.set(0, -9999, 0);
      dummyObj.scale.setScalar(0.001);
      dummyObj.updateMatrix();
      buildingInst.setMatrixAt(b.idx, dummyObj.matrix);
      buildingInst.instanceMatrix.needsUpdate = true;
    }
  });
  if (hiddenPieces.length) shatterTimer = TUNE.shatterRestoreDelay;
}

function restoreShattered() {
  for (const h of hiddenPieces) {
    if (h.kind === "mesh") h.mesh.visible = true;
    else {
      // Skip if the town instance pool was rebuilt underneath us (idx now belongs
      // to a different building); rebuildBuildings already wrote a fresh matrix.
      if (h.gen === buildingGen && hiddenTownIdx.has(h.idx)) {
        buildingInst.setMatrixAt(h.idx, h.mat);
        buildingInst.instanceMatrix.needsUpdate = true;
      }
    }
  }
  hiddenPieces.length = 0;
  hiddenTownIdx.clear();
  shatterTimer = 0;
}

function updateShatter(dt) {
  if (shatterTimer <= 0) return;
  shatterTimer -= dt;
  if (shatterTimer <= 0) restoreShattered();
}

function resolveSolidWalls() {
  if (state.exploding || (state.phase !== "AIRBORNE" && state.phase !== "CLIMB_AWAY")) return;
  flags.wallChecks = (flags.wallChecks || 0) + 1;
  const PRAD = 3;
  let hit = null;
  forEachSolid(b => {
    if (hit) return;
    if (isSolidHidden(b)) return;
    const ex = b.hw + PRAD, ez = b.hd + PRAD;
    if (!(state.x > b.x - ex && state.x < b.x + ex &&
          state.z > b.z - ez && state.z < b.z + ez)) return;
    if (!(state.y > b.y0 - PRAD && state.y < b.y1 + PRAD)) return;
    // Push direction points OUT of the face the plane is nearest to.
    const pens = [
      { d: (b.x + ex) - state.x, nx: 1, nz: 0, ny: 0 },
      { d: state.x - (b.x - ex), nx: -1, nz: 0, ny: 0 },
      { d: (b.z + ez) - state.z, nx: 0, nz: 1, ny: 0 },
      { d: state.z - (b.z - ez), nx: 0, nz: -1, ny: 0 },
      { d: (b.y1 + PRAD) - state.y, nx: 0, nz: 0, ny: 1 },
      { d: state.y - (b.y0 - PRAD), nx: 0, nz: 0, ny: -1 },
    ];
    let best = pens[0];
    for (const q of pens) if (q.d < best.d) best = q;
    hit = { b, best };
  });
  if (!hit) return;
  flags.wallHits = (flags.wallHits || 0) + 1;
  const { best } = hit;
  const vx = -Math.sin(state.heading) * Math.cos(state.pitch * DEG) * state.speed;
  const vz = -Math.cos(state.heading) * Math.cos(state.pitch * DEG) * state.speed;
  const vy = Math.sin(state.pitch * DEG) * state.speed + (state.airVy || 0);
  shatterAround(state.x, state.y, state.z);
  triggerExplosion(state.x, state.y, state.z, clamp(state.speed / 80, 0, 1));
  state.exploding = true;
  state.explodeTimer = TUNE.reassembleDelay;
  safePos.x = state.x + (best.nx || 0) * 30;
  safePos.z = state.z + (best.nz || 0) * 30;
  safePos.y = Math.max(
    Math.max(terrainEff(safePos.x, safePos.z), TUNE.waterLevel) + 60,
    state.y + 40,
    best.ny ? hit.b.y1 + 40 : -Infinity
  );
}
