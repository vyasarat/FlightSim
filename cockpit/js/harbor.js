"use strict";
// WORKING RULES
// The Californian port. It is scenery with moving parts: a breakwater and a
// lighthouse, a marina, a container terminal with two working gantry cranes, a
// drawbridge on the coast road, a ferry on a loop, a tug, a floating ski jump
// and a buoyed channel out to sea. Nothing in here is ever required, nothing
// can be lost, and nothing living is hittable -- the gulls are scenery under
// the same rule as the birds in ambient.js.
//
// WHERE IT IS, and why it is not where the brief said. The brief asked for it
// "at the existing harbour depression"; that depression is at the NEW YORK end,
// under the suspension bridges. Everything this harbour is for is Californian
// -- the burning rig the water cannon fights, the carrier the channel runs past
// -- so it is built at the California end and the New York depression is
// untouched. It sits EAST of the airport because the airport's flatten mask
// reaches x = +-550 and would pull any dredging back up to runway height.
//
// THE GROUND CAME FIRST. terrain.js dredges the basin, lays a barrier spit
// across the coast and then cuts the mouth back through the spit, in that
// order, so the mouth is the only way in by water and the drawbridge is the
// only way across by land. Everything here is built to those numbers; move one
// in TUNE.harbor and the terrain and the structures move together.
//
// DRAW CALLS. three.js batches nothing on its own and this rig under-prices
// draw calls against the iPad, so everything that does not move is merged into
// one mesh per material and the containers are one instanced mesh. Only the
// things that actually move -- cranes, ferry, bridge leaves, beam -- are their
// own objects.

const HB = TUNE.harbor;

const harbor = {
  g: null, built: false,
  solids: [],            // every box the boat can hit; also pushed into staticSolids
  clock: 0,
  lighthouse: null,      // { beam, glow, t }
  cranes: [],            // { g, trolley, spreader, box, t }
  ferry: null,           // { g, s, hornT, x, z, heading }
  tug: null,
  ramp: null,            // { x, z, fx, fz, ring }
  bridge: null,          // { leaves:[], beacons:[], deckY, open, t, state }
  buoys: [],
  gulls: null,
  road: null,            // the drivable coast spur, also registered in highway.exits
  near: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// A merged mesh from box specs, in the harbour's own world coordinates. Uses
// car.js's carMergeBoxes -- harbor.js loads after car.js precisely so it can.
function hbMerge(specs, mat, solidY) {
  const m = new THREE.Mesh(carMergeBoxes(specs), mat);
  m.castShadow = true;
  m.receiveShadow = false;
  harbor.g.add(m);
  return m;
}

// Register a box as something solid: the boat crashes into it, and so does
// anything flying. One record, two lists, so the two can never disagree.
function hbSolid(x, y0, z, hw, hd, y1, mesh) {
  const b = { x, y0, z, hw, hd, y1, mesh };
  harbor.solids.push(b);
  staticSolids.push(b);
  return b;
}

// ---------------------------------------------------------------------------
// The bridge profile. The coast road runs flat along the spit and lifts over
// the mouth; the road strip, the spur the car drives and the bridge structure
// all read this one function, so they cannot drift apart.
// ---------------------------------------------------------------------------
const HB_ROAD_Z = -6745;
const HB_ROAD_Y = HB.spit.y + 0.6;
const HB_DECK_Y = 19;
const HB_TOWER_X = [1150, 1450];
function hbRoadY(x) {
  const [a, b] = HB_TOWER_X;
  if (x >= a && x <= b) return HB_DECK_Y;
  const ramp = 470;                     // how far the approach takes to climb
  const d = x < a ? a - x : x - b;
  if (d >= ramp) return HB_ROAD_Y;
  return lerp(HB_DECK_Y, HB_ROAD_Y, smoothstep(0, 1, d / ramp));
}

// ---------------------------------------------------------------------------
function hbBuild() {
  if (harbor.built) return;
  const C = TUNE.palette, W = TUNE.waterLevel;
  const g = new THREE.Group();
  g.visible = false;          // updateHarbor turns it on when he is near enough
  harbor.g = g;
  scene.add(g);

  const conc = mattMat(C.concrete);
  const steel = metalMat(C.grey, 34);
  const white = mattMat(C.white);
  const dark = mattMat(C.slate);
  const rust = mattMat(C.rust);
  const bed = W - HB.depth;             // the dredged bottom: quays stand on it

  hbBuildQuays(conc, dark, bed);
  hbBuildBreakwater(conc, dark, white);
  hbBuildTerminal(conc, steel, white, rust, bed);
  hbBuildMarina(conc, white, dark, bed);
  hbBuildFuelDock(conc, white, bed);
  hbBuildBridge(conc, steel, dark);
  hbBuildRoad(dark);
  hbBuildFerry(white, dark);
  hbBuildTug(rust, dark, white);
  hbBuildRamp(white);
  hbBuildBuoys();
  hbBuildGulls();

  harbor.built = true;
}

// ---- quays: the concrete edge of the basin ---------------------------------
function hbBuildQuays(conc, dark, bed) {
  const Q = HB.quayY;
  const box = (x, z, w, d, top) => ({ w, h: top - bed, d, x, y: (top + bed) / 2, z });
  const specs = [];
  const T = HB.terminal, M = HB.marina;
  // the terminal quay, along the head of the basin
  specs.push(box(T.x, T.z, T.quayW, T.quayD, HB.quayY));
  hbSolid(T.x, bed, T.z, T.quayW / 2, T.quayD / 2, Q);
  // the marina's shore wall on the east side, and the west wall opposite the
  // terminal. Both run INTO the beach: a quay that stops short of the shore is
  // a raft, and from the air that is exactly what these two looked like.
  specs.push(box(1910, -6300, 200, 500, HB.quayY));
  hbSolid(1910, bed, -6300, 100, 250, Q);
  specs.push(box(640, -6420, 180, 380, HB.quayY));
  hbSolid(640, bed, -6420, 90, 190, Q);
  hbMerge(specs, conc);
  // a dark kerb along every water edge, so the quay reads as an edge rather than
  // as a step in a flat grey plane
  const kerb = [];
  kerb.push({ w: T.quayW, h: 1.1, d: 2.4, x: T.x, y: HB.quayY - 0.2, z: T.z - T.quayD / 2 + 1.2 });
  kerb.push({ w: 2.4, h: 1.1, d: 500, x: 1910 - 100 + 1.2, y: HB.quayY - 0.2, z: -6300 });
  kerb.push({ w: 2.4, h: 1.1, d: 380, x: 640 + 90 - 1.2, y: HB.quayY - 0.2, z: -6420 });
  hbMerge(kerb, dark);

  // bollards, so the edge reads as an edge rather than a step in the ground
  const bol = [];
  for (let x = T.x - T.quayW / 2 + 20; x <= T.x + T.quayW / 2 - 20; x += 40) {
    bol.push({ w: 1.6, h: 2.0, d: 1.6, x, y: HB.quayY + 1, z: T.z - T.quayD / 2 + 3 });
  }
  hbMerge(bol, dark);
}

// ---- breakwater: two armoured arms and the lighthouse ----------------------
function hbBuildBreakwater(conc, dark, white) {
  const B = HB.breakwater, W = TUNE.waterLevel;
  const base = W - 9;
  const specs = [], armour = [];
  const arms = [[B.x[0], B.gap[0]], [B.gap[1], B.x[1]]];
  for (const [x0, x1] of arms) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    specs.push({ w, h: B.armY - base, d: B.armW, x: cx, y: (B.armY + base) / 2, z: B.z });
    hbSolid(cx, base, B.z, w / 2, B.armW / 2, B.armY);
    // armour blocks tumbled down the seaward face: the thing that makes a mole
    // read as a mole rather than as a wall standing in the water
    for (let i = 0; i < B.blocks; i++) {
      const t = (i + 0.5) / B.blocks;
      const s = 5 + hashSalt(i, Math.round(cx), 3) * 4;
      armour.push({ w: s, h: s, d: s, x: lerp(x0 + 6, x1 - 6, t), y: W + 1.2,
                    z: B.z - B.armW / 2 - 4 - hashSalt(i, 7, 4) * 5,
                    ry: hashSalt(i, 11, 5) * 1.6, rz: 0.2 });
    }
  }
  hbMerge(specs, conc);
  hbMerge(armour, dark);

  // The lighthouse: a tapered tower, a lamp room, and a beam that sweeps. The
  // beam is an additive cone on the shared glow language -- there is no
  // post-processing stack in this game and there is not going to be one -- so it
  // reads at noon as well as at night, which is what "works at any time of day"
  // has to mean when the game is almost always in sunshine.
  const L = HB.lighthouse;
  const lg = new THREE.Group();
  lg.position.set(L.x, TUNE.waterLevel, L.z);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(L.r * 0.62, L.r, L.h, 12), white);
  tower.position.y = L.h / 2 + 4; lg.add(tower);
  // three red bands, the way a real one is marked -- and the only red out here
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(L.r * 0.78, L.r * 0.86, 3.2, 12), mattMat(TUNE.palette.red));
    band.position.y = 10 + i * 9; lg.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(L.r * 1.25, L.r * 1.25, 1.2, 12), mattMat(TUNE.palette.slate));
  gallery.position.y = L.h + 4; lg.add(gallery);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(L.lampR, L.lampR, 4.2, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
  lampRoom.position.y = L.h + 6.6; lg.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(L.lampR * 1.3, 3.4, 10), mattMat(TUNE.palette.ink));
  cap.position.y = L.h + 10.4; lg.add(cap);

  const beam = new THREE.Mesh(new THREE.ConeGeometry(L.beamW, L.beamLen, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: L.beamColor, transparent: true, opacity: L.beamOpacity,
      depthWrite: false, fog: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2;        // lying down, pointing along +x of its own group
  beam.position.set(L.beamLen / 2, L.h + 6.6, 0);
  const spin = new THREE.Group();
  spin.position.y = 0; spin.add(beam);
  lg.add(spin);
  const glow = glowSprite(0xfff0b0, L.lampR * 5, 0.55);
  glow.position.y = L.h + 6.6; lg.add(glow);
  castsShadow(lg);
  beam.castShadow = false; glow.castShadow = false;
  harbor.g.add(lg);
  harbor.lighthouse = { spin, beam, glow, t: 0 };
  hbSolid(L.x, TUNE.waterLevel, L.z, L.r * 1.4, L.r * 1.4, L.h + 10, tower);
}

// ---- container terminal ----------------------------------------------------
function hbBuildTerminal(conc, steel, white, rust, bed) {
  const T = HB.terminal, C = TUNE.palette;

  // --- the ship alongside: hull, house, and a hold full of boxes
  const S = T.ship;
  const sg = new THREE.Group();
  sg.position.set(S.x, 0, S.z);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(S.len, 22, S.beam), mattMat(C.rust));
  hull.position.y = TUNE.waterLevel + 5; sg.add(hull);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(S.len + 0.6, 5, S.beam + 0.6), mattMat(C.ink));
  boot.position.y = TUNE.waterLevel - 3.5; sg.add(boot);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, S.beam / 2, 26, 6), mattMat(C.rust));
  bow.rotation.z = Math.PI / 2; bow.position.set(S.len / 2 + 12, TUNE.waterLevel + 5, 0); sg.add(bow);
  const house = new THREE.Mesh(new THREE.BoxGeometry(26, 22, S.beam * 0.7), white);
  house.position.set(-S.len / 2 + 26, TUNE.waterLevel + 27, 0); sg.add(house);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 12, 8), mattMat(C.slate));
  funnel.position.set(-S.len / 2 + 12, TUNE.waterLevel + 32, 0); sg.add(funnel);
  castsShadow(sg);
  harbor.g.add(sg);
  hbSolid(S.x, TUNE.waterLevel - 6, S.z, S.len / 2, S.beam / 2, TUNE.waterLevel + 16, hull);
  hbSolid(S.x - S.len / 2 + 26, TUNE.waterLevel + 16, S.z, 13, S.beam * 0.35, TUNE.waterLevel + 38, house);

  // --- the containers. One instanced mesh with per-instance colour: seven
  // stacks on the quay plus a deck load on the ship is 120-odd boxes and one
  // draw call. Blocky and bright on purpose -- they are the thing he will
  // recognise the port by from a mile up.
  const cols = [C.red, C.blue, C.green, C.warning, C.cyan, C.rust, C.steel];
  const cells = [];
  for (let s = 0; s < T.stacks; s++) {
    const sx = T.x - T.quayW / 2 + 46 + s * ((T.quayW - 92) / (T.stacks - 1));
    const high = 2 + Math.floor(hashSalt(s, 5, 6) * 3);
    for (let r = 0; r < 3; r++) for (let h = 0; h < high; h++) {
      cells.push([sx, HB.quayY + T.containerH * (h + 0.5), T.z - 34 + r * (T.containerW + 1.2), 0]);
    }
  }
  for (let i = 0; i < 22; i++) {
    cells.push([S.x - S.len / 2 + 60 + (i % 11) * 16, TUNE.waterLevel + 19 + Math.floor(i / 11) * T.containerH,
                S.z - 8 + (i % 3) * 7, 0]);
  }
  const cgeo = new THREE.BoxGeometry(T.containerL, T.containerH, T.containerW);
  const cmesh = new THREE.InstancedMesh(cgeo, mattMat(0xffffff), cells.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < cells.length; i++) {
    dummy.position.set(cells[i][0], cells[i][1], cells[i][2]);
    dummy.updateMatrix();
    cmesh.setMatrixAt(i, dummy.matrix);
    cmesh.setColorAt(i, col.setHex(cols[Math.floor(hashSalt(i, 3, 7) * cols.length) % cols.length]));
  }
  cmesh.instanceMatrix.needsUpdate = true;
  if (cmesh.instanceColor) cmesh.instanceColor.needsUpdate = true;
  cmesh.castShadow = true;
  harbor.g.add(cmesh);

  // --- two gantry cranes, straddling the quay and reaching over the ship.
  // Each runs one loop for ever: trolley out over the hold, spreader down, a
  // box picked up, trolley back, spreader down, box away. It is never asked
  // for and it never stops.
  for (let i = 0; i < T.cranes; i++) {
    const cx = T.x - 100 + i * 200;
    const cg = new THREE.Group();
    cg.position.set(cx, 0, 0);
    const legZ = [T.z + T.quayD / 2 - 14, T.z - T.quayD / 2 + 14];
    const frame = [];
    for (const lz of legZ) for (const sx of [-9, 9]) {
      frame.push({ w: T.craneLegW, h: T.craneH, d: T.craneLegW, x: sx, y: T.craneH / 2 + HB.quayY, z: lz });
    }
    // the boom: back over the quay, forward over the ship
    const boomZ0 = T.z + 40, boomZ1 = S.z - S.beam / 2 - 26;
    frame.push({ w: 3.4, h: 3.4, d: boomZ0 - boomZ1, x: -9, y: T.craneH + HB.quayY, z: (boomZ0 + boomZ1) / 2 });
    frame.push({ w: 3.4, h: 3.4, d: boomZ0 - boomZ1, x: 9, y: T.craneH + HB.quayY, z: (boomZ0 + boomZ1) / 2 });
    frame.push({ w: 24, h: 3, d: 3, x: 0, y: T.craneH + HB.quayY, z: boomZ1 + 2 });
    frame.push({ w: 24, h: 3, d: 3, x: 0, y: T.craneH + HB.quayY, z: boomZ0 - 2 });
    // the A-frame that holds the boom up
    frame.push({ w: 3, h: 26, d: 3, x: -9, y: T.craneH + HB.quayY + 13, z: T.z });
    frame.push({ w: 3, h: 26, d: 3, x: 9, y: T.craneH + HB.quayY + 13, z: T.z });
    const fm = new THREE.Mesh(carMergeBoxes(frame), metalMat(TUNE.palette.warning, 26));
    fm.castShadow = true;
    cg.add(fm);
    for (const lz of legZ) hbSolid(cx, HB.quayY, lz, 11, T.craneLegW, T.craneH + HB.quayY, fm);

    const trolley = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 8), metalMat(TUNE.palette.slate, 30));
    trolley.position.set(0, T.craneH + HB.quayY - 3.4, boomZ1 + 20);
    trolley.castShadow = true; cg.add(trolley);
    const spreader = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, T.containerW + 2), mattMat(TUNE.palette.ink));
    spreader.add(bar);
    const box = new THREE.Mesh(new THREE.BoxGeometry(T.containerL, T.containerH, T.containerW),
      mattMat(cols[i % cols.length]));
    box.position.y = -T.containerH / 2 - 0.6;
    box.castShadow = true;
    spreader.add(box);
    cg.add(spreader);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 5), mattMat(TUNE.palette.ink));
    cg.add(rope);
    harbor.g.add(cg);
    harbor.cranes.push({ g: cg, trolley, spreader, box, rope, cx,
                         z0: boomZ0 - 24, z1: boomZ1 + 20, top: T.craneH + HB.quayY - 5.4,
                         t: i * T.craneCycle * 0.5 });
  }
}

// ---- the marina ------------------------------------------------------------
function hbBuildMarina(conc, white, dark, bed) {
  const M = HB.marina, C = TUNE.palette;
  const deck = TUNE.waterLevel + 1.4;
  const pier = [], piles = [];
  // the main walkway, running north-south
  pier.push({ w: 10, h: 1.2, d: 400, x: 1700, y: deck, z: -6370 });
  hbSolid(1700, TUNE.waterLevel - 1, -6370, 5, 200, deck + 0.6);
  for (let z = -6560; z <= -6180; z += 40) piles.push({ w: 1.2, h: 9, d: 1.2, x: 1700, y: TUNE.waterLevel - 2, z });
  // the fingers
  for (let i = 0; i < M.fingers; i++) {
    const fz = -6420 + i * M.spacing;
    pier.push({ w: M.fingerLen, h: 1.1, d: M.fingerW, x: 1700 - M.fingerLen / 2 - 5, y: deck, z: fz });
    hbSolid(1700 - M.fingerLen / 2 - 5, TUNE.waterLevel - 1, fz, M.fingerLen / 2, M.fingerW / 2, deck + 0.5);
    piles.push({ w: 1.1, h: 8, d: 1.1, x: 1700 - M.fingerLen - 4, y: TUNE.waterLevel - 2, z: fz });
  }
  // the big berth, for something with a lot more freeboard (stage 2)
  pier.push({ w: 150, h: 1.4, d: 9, x: 1690, y: deck, z: M.bigBerth[1] });
  hbSolid(1690, TUNE.waterLevel - 1, M.bigBerth[1], 75, 4.5, deck + 0.7);
  hbMerge(pier, white);
  hbMerge(piles, dark);

  // A dozen parked boats: machines, generic, no names on any of them. One
  // instanced hull with per-instance colour and one instanced wheelhouse, so the
  // whole marina is two draw calls. They are COLOURED and they are big, because
  // the first pass made them small and white and they were invisible from the
  // air against a white pier -- the harbour looked like an empty car park.
  const cols = [C.red, C.blue, C.green, C.warning, C.cyan, C.white, C.steel];
  const hullGeo = new THREE.BoxGeometry(1, 3.4, 1);
  const houseGeo = new THREE.BoxGeometry(1, 2.8, 1);
  const hullMesh = new THREE.InstancedMesh(hullGeo, mattMat(0xffffff), M.boats);
  const houseMesh = new THREE.InstancedMesh(houseGeo, white, M.boats);
  const d3 = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < M.boats; i++) {
    const finger = i % M.fingers;
    const side = i < M.fingers * 2 ? -1 : 1;
    const fz = -6420 + finger * M.spacing;
    const len = lerp(M.boatLen[0], M.boatLen[1], hashSalt(i, 21, 8));
    const bx = 1700 - 22 - (i >= M.fingers * 2 ? M.fingerLen * 0.5 : M.fingerLen * 0.14);
    const bz = fz + side * (M.fingerW / 2 + M.boatBeam / 2 + 1.6);
    d3.position.set(bx, TUNE.waterLevel + 0.9, bz);
    d3.scale.set(len, 1, M.boatBeam);
    d3.updateMatrix(); hullMesh.setMatrixAt(i, d3.matrix);
    hullMesh.setColorAt(i, col.setHex(cols[Math.floor(hashSalt(i, 23, 9) * cols.length) % cols.length]));
    d3.position.set(bx - len * 0.14, TUNE.waterLevel + 3.9, bz);
    d3.scale.set(len * 0.34, 1, M.boatBeam * 0.72);
    d3.updateMatrix(); houseMesh.setMatrixAt(i, d3.matrix);
    hbSolid(bx, TUNE.waterLevel - 1.2, bz, len / 2, M.boatBeam / 2, TUNE.waterLevel + 2.6);
  }
  hullMesh.instanceMatrix.needsUpdate = true;
  if (hullMesh.instanceColor) hullMesh.instanceColor.needsUpdate = true;
  houseMesh.instanceMatrix.needsUpdate = true;
  hullMesh.castShadow = true; houseMesh.castShadow = true;
  harbor.g.add(hullMesh); harbor.g.add(houseMesh);
}

// ---- the fuel dock ---------------------------------------------------------
function hbBuildFuelDock(conc, white, bed) {
  const F = HB.fuel, C = TUNE.palette;
  const deck = TUNE.waterLevel + 1.6;
  hbMerge([{ w: F.w, h: 1.3, d: F.d, x: F.x, y: deck, z: F.z },
           { w: 1.2, h: 9, d: 1.2, x: F.x - F.w / 2 + 2, y: TUNE.waterLevel - 2, z: F.z },
           { w: 1.2, h: 9, d: 1.2, x: F.x + F.w / 2 - 2, y: TUNE.waterLevel - 2, z: F.z }], white);
  hbSolid(F.x, TUNE.waterLevel - 1, F.z, F.w / 2, F.d / 2, deck + 0.7);
  // two pumps and a canopy: no wordmark, no logo, same rule as the liveries
  hbMerge([{ w: 1.8, h: 3.4, d: 1.6, x: F.x - 6, y: deck + 2.2, z: F.z },
           { w: 1.8, h: 3.4, d: 1.6, x: F.x + 6, y: deck + 2.2, z: F.z }], mattMat(C.red));
  hbMerge([{ w: F.w * 0.8, h: 0.5, d: F.d * 0.8, x: F.x, y: deck + 6.4, z: F.z },
           { w: 0.9, h: 5, d: 0.9, x: F.x - 9, y: deck + 3.6, z: F.z },
           { w: 0.9, h: 5, d: 0.9, x: F.x + 9, y: deck + 3.6, z: F.z }], mattMat(C.steel));
}

// ---- the drawbridge --------------------------------------------------------
// Built closed. It is a road bridge in stage 1 and a set-piece in stage 2; the
// leaves are hung from their hinge pivots now so that lifting them later is one
// rotation each and nothing has to be rebuilt.
function hbBuildBridge(conc, steel, dark) {
  const C = TUNE.palette;
  const [ax, bx] = HB_TOWER_X;
  const towers = [], deckSpecs = [];
  for (const tx of HB_TOWER_X) {
    towers.push({ w: 30, h: HB_DECK_Y + 22, d: 34, x: tx, y: (HB_DECK_Y + 22) / 2 + TUNE.waterLevel - 12, z: HB_ROAD_Z });
    hbSolid(tx, TUNE.waterLevel - 12, HB_ROAD_Z, 15, 17, HB_DECK_Y + 26);
    // The counterweight house, and a pair of towers standing well above the
    // deck. Without them the whole bridge read from the air as a white plank
    // laid across the gap: it needs something tall enough to say "this lifts".
    towers.push({ w: 20, h: 16, d: 24, x: tx, y: HB_DECK_Y + 11, z: HB_ROAD_Z });
    for (const sz of [-1, 1]) {
      towers.push({ w: 6, h: 26, d: 6, x: tx, y: HB_DECK_Y + 15, z: HB_ROAD_Z + sz * 13 });
      towers.push({ w: 6, h: 3, d: 32, x: tx, y: HB_DECK_Y + 27, z: HB_ROAD_Z });
    }
  }
  hbMerge(towers, conc);

  // the approach spans, on piers
  for (const [x0, x1] of [[820, ax], [bx, 1780]]) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const xa = lerp(x0, x1, t0), xb = lerp(x0, x1, t1);
      const ya = hbRoadY(xa), yb = hbRoadY(xb);
      deckSpecs.push({ w: xb - xa + 0.4, h: 1.6, d: 16, x: (xa + xb) / 2, y: (ya + yb) / 2,
                       z: HB_ROAD_Z, rz: Math.atan2(yb - ya, xb - xa) });
      const py = (ya + yb) / 2;
      deckSpecs.push({ w: 4, h: py - (TUNE.waterLevel - 6), d: 5, x: (xa + xb) / 2,
                       y: (py + TUNE.waterLevel - 6) / 2, z: HB_ROAD_Z });
    }
  }
  hbMerge(deckSpecs, conc);

  // the two leaves, each hung on its own hinge at the tower face
  const leaves = [];
  const half = (bx - ax) / 2;
  for (const [i, tx] of HB_TOWER_X.entries()) {
    const sign = i === 0 ? 1 : -1;      // which way the leaf reaches
    const pivot = new THREE.Group();
    pivot.position.set(tx + sign * 13, HB_DECK_Y, HB_ROAD_Z);
    const span = half - 13;
    const leaf = new THREE.Mesh(carMergeBoxes([
      { w: span, h: 2.4, d: 18, x: sign * span / 2, y: 0, z: 0 },              // the deck
      { w: span, h: 3.4, d: 1.6, x: sign * span / 2, y: 2.6, z: -8.6 },        // its two trusses
      { w: span, h: 3.4, d: 1.6, x: sign * span / 2, y: 2.6, z: 8.6 },
      { w: span, h: 1.0, d: 1.0, x: sign * span / 2, y: 4.6, z: -8.6 },
      { w: span, h: 1.0, d: 1.0, x: sign * span / 2, y: 4.6, z: 8.6 },
    ]), metalMat(C.steel, 30));
    leaf.castShadow = true;
    pivot.add(leaf);
    harbor.g.add(pivot);
    leaves.push({ pivot, sign });
  }

  // the beacons and the bells: the wind-up, so nothing ever bangs unannounced
  const beacons = [];
  for (const [i, tx] of HB_TOWER_X.entries()) {
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x5a1b16, fog: false }));
      lamp.position.set(tx + (i === 0 ? -1 : 1) * 16, HB_DECK_Y + 5.5, HB_ROAD_Z + sx * 9);
      harbor.g.add(lamp);
      beacons.push(lamp);
    }
  }
  harbor.bridge = { leaves, beacons, deckY: HB_DECK_Y, open: 0, want: 0, state: "shut", t: 0, hornT: 0 };
}

// ---- the coast road, and the spur that reaches it --------------------------
// The road strip is scenery; the SPUR is a record pushed into highway.exits, and
// that one line is what makes the car able to drive here. car.js's lane keep
// walks every exit's spur looking for the nearest road, so a hand-built polyline
// in that array is a road as far as the car is concerned -- no change to the
// highway builder at all.
function hbBuildRoad(dark) {
  const tarmac = mattMat(TUNE.runwaySurfaceColor);
  const pts = [];
  const at = hwySampleAt(highway.length * 0.965);
  const rx = -at.fz, rz = at.fx;
  // leave the carriageway on a quarter turn, the way every other spur does
  const seg = 10;
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const out = Math.sin(t * Math.PI / 2) * 260;
    const fwd = t * 200;
    pts.push({ x: at.x + rx * out + at.fx * fwd, z: at.z + rz * out + at.fz * fwd });
  }
  // then a long easy run east along the shore and onto the spit
  const tail = [[120, -6420], [430, -6600], [700, HB_ROAD_Z], [1000, HB_ROAD_Z],
                [1300, HB_ROAD_Z], [1600, HB_ROAD_Z], [1900, HB_ROAD_Z], [2140, -6640]];
  const from = pts[pts.length - 1];
  for (let i = 0; i < tail.length; i++) {
    const a = i === 0 ? [from.x, from.z] : tail[i - 1];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      pts.push({ x: lerp(a[0], tail[i][0], t), z: lerp(a[1], tail[i][1], t) });
    }
  }
  // heights: the road deck at the junction, the ground along the shore, and the
  // bridge profile over the mouth -- whichever is higher, so it never sinks
  for (let k = 0; k < pts.length; k++) {
    const t = k / (pts.length - 1);
    const ground = Math.max(terrainEff(pts[k].x, pts[k].z), TUNE.waterLevel) + HW.clearance;
    const base = k <= seg ? lerp(at.y, ground, smoothstep(0, HW.spurDescend, k / seg)) : ground;
    pts[k].y = Math.max(base, Math.abs(pts[k].z - HB_ROAD_Z) < 220 ? hbRoadY(pts[k].x) : -Infinity);
  }
  let run = 0;
  pts[0].s = 0; pts[0].fx = at.fx; pts[0].fz = at.fz;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x, dz = pts[k].z - pts[k - 1].z, l = Math.hypot(dx, dz) || 1;
    pts[k].fx = dx / l; pts[k].fz = dz / l;
    run += l; pts[k].s = run;
  }
  // The strip is drawn only where there is no bridge deck under it: the bridge
  // builds its own. Drawing both put two coplanar surfaces at the same height
  // and the pair z-fought the length of the span.
  const onLand = pts.filter(p => !(p.x > 800 && p.x < 1800 && Math.abs(p.z - HB_ROAD_Z) < 40));
  harbor.g.add(hwyStrip(onLand, -HW.spurW, HW.spurW, 0, tarmac));

  // `railed`: this spur crosses water on a bridge, which no other spur does, so
  // it gets the main road's guardrail rule (car.js). Without it he can steer off
  // the side of the drawbridge and into the harbour.
  const rec = { s: 0.965, side: 1, icon: "wave", to: "harbor", railed: true,
                x: at.x, z: at.z, y: at.y, spur: pts, bx: at.x, bz: at.z };
  highway.exits.push(rec);
  harbor.road = rec;
}

// ---- the ferry, on a loop for ever ----------------------------------------
function hbBuildFerry(white, dark) {
  const F = HB.ferry, C = TUNE.palette;
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(F.beam, 5, F.len), mattMat(C.blue));
  hull.position.y = 1.4; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(F.beam + 1, 0.6, F.len), white);
  deck.position.y = 4.1; g.add(deck);
  const house = new THREE.Mesh(new THREE.BoxGeometry(F.beam * 0.8, 5.5, F.len * 0.4), white);
  house.position.y = 7.2; g.add(house);
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(F.beam * 0.5, 3, F.len * 0.18), mattMat(C.steel));
  bridgeDeck.position.set(0, 11.4, -F.len * 0.06); g.add(bridgeDeck);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 4.6, 8), mattMat(C.warning));
  funnel.position.set(0, 12.4, F.len * 0.12); g.add(funnel);
  castsShadow(g);
  harbor.g.add(g);
  harbor.ferry = { g, s: 0, hornT: F.hornEvery * 0.6, x: F.route[0][0], z: F.route[0][1], heading: 0,
                   solid: hbSolid(F.route[0][0], TUNE.waterLevel - 2, F.route[0][1], F.beam, F.len / 2, TUNE.waterLevel + 8, hull) };
}

// ---- the tug, idling ------------------------------------------------------
function hbBuildTug(rust, dark, white) {
  const T = HB.tug, C = TUNE.palette;
  const g = new THREE.Group();
  g.position.set(T.x, 0, T.z);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(T.beam, 4.6, T.len), mattMat(C.red));
  hull.position.y = 1.1; g.add(hull);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(T.beam + 0.4, 2, T.len + 0.4), mattMat(C.ink));
  boot.position.y = -1.2; g.add(boot);
  const house = new THREE.Mesh(new THREE.BoxGeometry(T.beam * 0.7, 4.4, T.len * 0.3), white);
  house.position.set(0, 5.4, -1); g.add(house);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 4, 8), mattMat(C.ink));
  funnel.position.set(0, 8.4, 2.5); g.add(funnel);
  for (const sz of [-1, 1]) {
    const fender = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 6, 10), mattMat(C.ink));
    fender.rotation.x = Math.PI / 2;
    fender.position.set(0, 2.2, sz * (T.len / 2 - 0.6)); g.add(fender);
  }
  castsShadow(g);
  harbor.g.add(g);
  harbor.tug = { g, y0: 0 };
  hbSolid(T.x, TUNE.waterLevel - 2, T.z, T.beam / 2, T.len / 2, TUNE.waterLevel + 6, hull);
}

// ---- the floating ski jump -------------------------------------------------
// Amber ring language, exactly like the Mars jumps: a big obvious ramp with a
// hoop over the lip, so what to do with it needs no explaining.
function hbBuildRamp(white) {
  const R = HB.ramp, C = TUNE.palette;
  const g = new THREE.Group();
  // it faces away from the mouth, so coming out of the harbour lines him up
  const fx = R.x - HB.cx, fz = R.z - (-6740);
  const l = Math.hypot(fx, fz) || 1;
  const heading = Math.atan2(fx / l, fz / l);
  g.position.set(R.x, TUNE.waterLevel, R.z);
  g.rotation.y = heading;
  const pontoon = new THREE.Mesh(new THREE.BoxGeometry(R.w + 6, 3, R.len + 8), mattMat(C.warning));
  pontoon.position.y = -0.8; g.add(pontoon);
  const slope = new THREE.Mesh(new THREE.BoxGeometry(R.w, 1.2, R.len), white);
  slope.rotation.x = -R.deg * DEG;
  slope.position.set(0, R.rise / 2, 0);
  g.add(slope);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, R.len), mattMat(C.red));
    rail.rotation.x = -R.deg * DEG;
    rail.position.set(sx * (R.w / 2 + 0.5), R.rise / 2 + 1.4, 0);
    g.add(rail);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R.ringR, 0.55, 8, 22),
    new THREE.MeshBasicMaterial({ color: C.warning, fog: false }));
  ring.position.set(0, R.rise + R.ringR * 0.75, -R.len / 2 - 4);
  ring.rotation.x = -0.35;
  g.add(ring);
  castsShadow(g);
  harbor.g.add(g);
  // the ramp is NOT a solid: hitting it is the point of it
  harbor.ramp = { g, ring, x: R.x, z: R.z, heading,
                  fx: -Math.sin(heading), fz: -Math.cos(heading) };
}

// ---- the buoyed channel ----------------------------------------------------
function hbBuildBuoys() {
  const B = HB.buoys;
  const geo = new THREE.CylinderGeometry(B.r * 0.5, B.r, B.h, 7);
  const mats = [new THREE.MeshLambertMaterial({ color: TUNE.palette.red }),
                new THREE.MeshLambertMaterial({ color: TUNE.palette.green })];
  const pts = [[], []];
  // walk the path at a fixed spacing, dropping a pair either side
  let carry = 0;
  for (let i = 1; i < B.path.length; i++) {
    const a = B.path[i - 1], b = B.path[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const nx = -dz / l, nz = dx / l;
    for (let d = carry; d < l; d += B.spacing) {
      const t = d / l;
      const px = a[0] + dx * t, pz = a[1] + dz * t;
      pts[0].push([px + nx * B.half, pz + nz * B.half]);
      pts[1].push([px - nx * B.half, pz - nz * B.half]);
    }
    carry = (carry - l) % B.spacing + B.spacing;
  }
  const dummy = new THREE.Object3D();
  for (let s = 0; s < 2; s++) {
    const mesh = new THREE.InstancedMesh(geo, mats[s], pts[s].length);
    for (let i = 0; i < pts[s].length; i++) {
      dummy.position.set(pts[s][i][0], TUNE.waterLevel + B.h * 0.35, pts[s][i][1]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.userData.noSolid = true;      // a buoy is a marker, never a wall
    harbor.g.add(mesh);
    harbor.buoys.push({ mesh, pts: pts[s] });
  }
}

// ---- gulls -----------------------------------------------------------------
// Scenery, under exactly the rule the birds in ambient.js follow: never a
// target, never solid, never shatterable, and nothing can ever happen to them.
// They circle the breakwater and are flown straight through.
function hbBuildGulls() {
  const G = HB.gulls;
  const mesh = new THREE.InstancedMesh(birdGeo,
    new THREE.MeshLambertMaterial({ color: TUNE.palette.white, side: THREE.DoubleSide }), G.count);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.userData.noSolid = true;
  mesh.userData.noShatter = true;
  harbor.g.add(mesh);
  const birds = [];
  for (let i = 0; i < G.count; i++) {
    birds.push({
      a: hashSalt(i, 31, 9) * Math.PI * 2,
      r: G.r * (0.45 + hashSalt(i, 33, 10) * 0.9),
      y: lerp(G.y[0], G.y[1], hashSalt(i, 35, 11)),
      w: lerp(G.speed[0], G.speed[1], hashSalt(i, 37, 12)) / G.r,
      cx: HB.breakwater.gap[0] + hashSalt(i, 39, 13) * 700 - 200,
      cz: HB.breakwater.z + 60,
      flap: 5 + hashSalt(i, 41, 14) * 3,
    });
  }
  harbor.gulls = { mesh, birds, dummy: new THREE.Object3D(), t: 0 };
}

// ---------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------
function updateHarbor(dt) {
  if (!harbor.built) return;
  const d = Math.hypot(state.x - HB.cx, state.z - (-6600));
  const near = d < HB.visibleRange;
  if (near !== harbor.near) { harbor.near = near; harbor.g.visible = near; }
  if (!near) return;
  harbor.clock += dt;

  // the lighthouse turns whatever the time of day
  const L = harbor.lighthouse;
  if (L) {
    L.spin.rotation.y += dt * HB.lighthouse.rpm * 0.105;
    const face = Math.cos(L.spin.rotation.y);   // brightest when it sweeps past him
    L.glow.material.opacity = 0.45 + 0.45 * Math.abs(face);
    L.beam.material.opacity = HB.lighthouse.beamOpacity * (0.5 + 0.5 * Math.abs(face));
  }

  hbUpdateCranes(dt);
  hbUpdateFerry(dt);
  hbUpdateBridge(dt);
  hbUpdateGulls(dt);

  if (harbor.tug) {
    harbor.tug.g.position.y = Math.sin(harbor.clock * 0.9) * HB.tug.bob;
    harbor.tug.g.rotation.z = Math.sin(harbor.clock * 0.7) * 0.02;
  }
  if (harbor.ramp) {
    const k = 0.86 + 0.14 * Math.sin(harbor.clock * 2.2);
    harbor.ramp.ring.scale.setScalar(k);
    harbor.ramp.g.position.y = TUNE.waterLevel + Math.sin(harbor.clock * 1.1) * 0.4;
  }
  hbAudio(dt);
}

// One loop each, for ever: out over the hold, down, up, back, down, up.
function hbUpdateCranes(dt) {
  const T = HB.terminal;
  for (const c of harbor.cranes) {
    c.t = (c.t + dt) % T.craneCycle;
    const u = c.t / T.craneCycle;
    // four quarters: travel out, lower+raise, travel back, lower+raise
    let z, lift;
    if (u < 0.25) { z = lerp(c.z0, c.z1, u / 0.25); lift = 0; }
    else if (u < 0.5) { z = c.z1; lift = Math.sin(((u - 0.25) / 0.25) * Math.PI); }
    else if (u < 0.75) { z = lerp(c.z1, c.z0, (u - 0.5) / 0.25); lift = 0; }
    else { z = c.z0; lift = Math.sin(((u - 0.75) / 0.25) * Math.PI); }
    c.trolley.position.z = z;
    const drop = 6 + lift * (c.top - HB.quayY - 14);
    c.spreader.position.set(0, c.top - drop, z);
    c.rope.position.set(0, c.top - drop / 2, z);
    c.rope.scale.y = Math.max(0.2, drop);
    // the box rides up and down with it, and is put down at each end
    c.box.visible = !(lift > 0.86);
  }
}

// The route is fixed, so it is measured once rather than rebuilt sixty times a
// second into a fresh array that the collector then has to take away again.
let hbFerrySegs = null, hbFerryTotal = 0;
function hbFerryRoute() {
  if (hbFerrySegs) return hbFerrySegs;
  const F = HB.ferry;
  hbFerrySegs = [];
  hbFerryTotal = 0;
  for (let i = 0; i < F.route.length; i++) {
    const a = F.route[i], b = F.route[(i + 1) % F.route.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    hbFerrySegs.push({ a, b, l });
    hbFerryTotal += l;
  }
  return hbFerrySegs;
}
function hbUpdateFerry(dt) {
  const F = HB.ferry, f = harbor.ferry;
  if (!f) return;
  const segs = hbFerryRoute(), total = hbFerryTotal;
  f.s = (f.s + F.speed * dt) % total;
  let s = f.s;
  for (const sg of segs) {
    if (s <= sg.l) {
      const t = s / sg.l;
      f.x = lerp(sg.a[0], sg.b[0], t);
      f.z = lerp(sg.a[1], sg.b[1], t);
      const want = Math.atan2(-(sg.b[0] - sg.a[0]), -(sg.b[1] - sg.a[1]));
      f.heading += wrapPi(want - f.heading) * Math.min(1, 1.6 * dt);
      break;
    }
    s -= sg.l;
  }
  f.g.position.set(f.x, TUNE.waterLevel + Math.sin(harbor.clock * 1.3) * 0.25, f.z);
  f.g.rotation.y = f.heading;
  f.solid.x = f.x; f.solid.z = f.z;
  f.hornT -= dt;
  if (f.hornT <= 0) { f.hornT = F.hornEvery; hbHorn(f.x, TUNE.waterLevel + 10, f.z, 150, 1.1); }
}

// Stage 1 leaves it shut; stage 2 drives `want`. The animation lives here now so
// that the two stages cannot end up with two different bridges.
function hbUpdateBridge(dt) {
  const b = harbor.bridge;
  if (!b) return;
  b.open += clamp(b.want - b.open, -0.5 * dt, 0.28 * dt);
  const ang = b.open * 1.16;            // ~66 degrees fully up
  for (const lf of b.leaves) lf.pivot.rotation.z = -lf.sign * ang;
  const warn = b.want > 0 || b.open > 0.01;
  const on = warn && (Math.sin(harbor.clock * 9) > 0);
  for (const [i, lamp] of b.beacons.entries()) {
    lamp.material.color.setHex(warn && (on === (i % 2 === 0)) ? 0xff3b30 : 0x5a1b16);
  }
}

function hbUpdateGulls(dt) {
  const G = harbor.gulls;
  if (!G) return;
  G.t += dt;
  for (let i = 0; i < G.birds.length; i++) {
    const b = G.birds[i];
    b.a += b.w * dt;
    const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
    G.dummy.position.set(x, b.y + Math.sin(G.t * 0.7 + i) * 1.6, z);
    G.dummy.rotation.set(0, Math.atan2(-Math.sin(b.a), -Math.cos(b.a)) + Math.PI / 2, Math.sin(G.t * b.flap) * 0.5);
    G.dummy.scale.setScalar(1.5);
    G.dummy.updateMatrix();
    G.mesh.setMatrixAt(i, G.dummy.matrix);
  }
  G.mesh.instanceMatrix.needsUpdate = true;
}

// ---- sound ----------------------------------------------------------------
// Water slapping the hulls, the crane motors, and a gull now and then. All of
// it falls away with distance through the shared positional bus.
let hbGullT = 4;
function hbAudio(dt) {
  const A = HB.audio;
  const d = Math.hypot(state.x - HB.cx, state.z - (-6450));
  const near = clamp(1 - d / 1400, 0, 1);
  setTone("hbCrane", "sawtooth", 62, near * A.craneGain * (0.6 + 0.4 * Math.sin(harbor.clock * 1.7)));
  hbGullT -= dt;
  if (hbGullT <= 0 && near > 0.25) {
    hbGullT = lerp(A.gullEvery[0], A.gullEvery[1], Math.random());
    synthBlip("sawtooth", 1250, 780, 0.16, 0.030 * near, 0);
    synthBlip("sawtooth", 1150, 700, 0.14, 0.024 * near, 0.22);
  }
}

// A ship's horn: low, long, and it carries. Used by the ferry now and by the
// yacht and the cruise ship later.
function hbHorn(x, y, z, hz, dur) {
  synthBlip("sawtooth", hz, hz * 0.97, dur, 0.11, 0);
  synthBlip("sine", hz * 0.5, hz * 0.5, dur * 1.05, 0.09, 0.02);
  synthBlip("sine", hz * 2, hz * 1.94, dur * 0.6, 0.035, 0.03);
}

hbBuild();
