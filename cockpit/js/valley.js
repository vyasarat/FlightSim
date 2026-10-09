"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE VALLEY (v147).
//
// A winding snow valley cut west through the mountain range, ending in a bowl of
// snow between needles of rock, with a concrete bunker in it. terrain.js shapes
// the ground (vlShape, inside shapedTerrain, so every reader of the ground agrees);
// this file furnishes it: the pines, the bunker and the dark track to its door.
//
// IT IS HIS WORLD TOO. He can fly down it in anything, and the bunker is a solid
// like any other -- a bang and a free reassembly at cruise, and it never breaks
// (noShatter): no text on it, nothing on it to shoot. Dad mode (dadmode.js) flies a
// mission down this valley and builds its own things on top; none of that is here.
//
// CLEAR OF EVERYTHING. The whole of it lies west of x = -1650 in the mountain band:
// the motorway crosses the range at x = 240, the railway at 460, New York's blocks
// stop at -961 and California's are 3 km south. Streamed trees, towns and landmarks
// keep out of it (vlCovers, scenery.js), and dadmode_checks.js measures the distances.
//
// Built at load on vkQuiet's own random stream, which is then put back, so the
// seeded stream every other check depends on does not move by a single draw.
// ---------------------------------------------------------------------------
const vl = { built: false, bunker: null, vent: null, pines: [], track: null, solid: null, centre: null };

// Inside the valley's massif, with `pad` metres to spare: nothing streamed stands here.
function vlCovers(x, z, pad) {
  const V = TUNE.valley, p = pad || 0;
  return x < -1650 + p && x > V.xb - V.westPad - V.rampX - 50 - p && Math.abs(z - V.zc) < V.halfZ * 1.1 + p;
}

// Where the bunker stands, and its vent: the point a bomb has to find. Bowl floor,
// a little off the bowl's centre toward the far side, square to the world.
function vlBunkerAt() {
  const b = vlBowlCentre();
  return { x: b.x - 40, z: b.z + 10 };
}

// A tiny merge, positions and normals only: the pine is two cones in one geometry.
function vlMergeGeos(geos) {
  const pos = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g !== g0) g.dispose();
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function vlBuildPines() {
  const V = TUNE.valley;
  const geo = vlMergeGeos([
    new THREE.ConeGeometry(3.6, 10, 6).translate(0, 5.5, 0),
    new THREE.ConeGeometry(2.6, 8, 6).translate(0, 10.5, 0),
    new THREE.ConeGeometry(1.5, 5, 6).translate(0, 14.5, 0),
  ]);
  const col = new THREE.Color(TUNE.palette.grassMid).multiplyScalar(V.pineShade);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  // segments along the valley, each culled by its own sphere
  const xE = -1700, xW = V.xb - V.westPad;
  const seg = (xE - xW) / V.pineSegs;
  const lists = [];
  for (let i = 0; i < V.pineSegs; i++) lists.push([]);
  const bk = vlBunkerAt(), bc = vlBowlCentre();
  const cs = V.pineCell;
  let total = 0;
  for (let cx = Math.floor(xW / cs); cx <= Math.ceil(xE / cs); cx++) {
    for (let cz = Math.floor((V.zc - V.halfZ) / cs); cz <= Math.ceil((V.zc + V.halfZ) / cs); cz++) {
      if (total >= V.pineMax) break;
      if (hashSalt(cx, cz, 147) >= V.pineChance) continue;
      const x = (cx + hashSalt(cx, cz, 148)) * cs, z = (cz + hashSalt(cx, cz, 149)) * cs;
      if (vlWeight(x, z) < 0.6) continue;
      // in clumps: the film's slopes are forest in bands and patches, never an even fuzz
      if (valueNoise(x / 260 + 13.3, z / 260 + 2.1) < 0.47) continue;
      const h = terrainEff(x, z);
      if (h - vlFloorY(x) > V.pineBelow) continue;
      if (vlSlopeAt(x, z) > V.rockSlope * 0.8) continue;
      // the bowl stays an open snowfield round the bunker, as in the stills
      if (Math.hypot(x - bc.x, z - bc.z) < V.bowlR * 0.95) continue;
      // and the valley's own floor is mostly open snow: a few trees, not a wood
      const d = Math.abs(z - vlCenterZ(x));
      if (d < V.floorHalf * 0.8 && hashSalt(cx, cz, 150) > 0.25) continue;
      const k = Math.min(V.pineSegs - 1, Math.max(0, Math.floor((xE - x) / seg)));
      lists[k].push({ x, y: h - 0.6, z, s: 0.8 + hashSalt(cx, cz, 151) * 0.75, r: hashSalt(cx, cz, 152) * 6.283, t: hashSalt(cx, cz, 153) });
      total++;
    }
  }
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  for (const L of lists) {
    if (!L.length) continue;
    const m = new THREE.InstancedMesh(geo, mat, L.length);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    L.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.r, 0);
      dummy.scale.set(p.s, p.s * (0.9 + p.t * 0.4), p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, c.copy(col).multiplyScalar(0.8 + p.t * 0.4));
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y + 24);
    });
    // three.js culls an InstancedMesh by its geometry's sphere -- one tree at the
    // origin -- so each segment is given the sphere of its own trees
    const cxm = (minX + maxX) / 2, cym = (minY + maxY) / 2, czm = (minZ + maxZ) / 2;
    m.geometry = geo.clone();
    m.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cxm, cym, czm),
      Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 20);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = false; m.receiveShadow = false;
    m.userData.vlPines = true;
    scene.add(m);
    vl.pines.push(m);
  }
  vl.pineCount = total;
}

// The bunker: a squat concrete block half-sunk in the snow, its vent's housing tilted
// up on the roof with dark slats across it (the film's grille), a slab ramp down to
// its door, and the dark track the trucks left across the bowl.
function vlBuildBunker() {
  const V = TUNE.valley, B = V.bunker, at = vlBunkerAt();
  // stand it on the lowest corner of its footprint so no edge floats
  let gy = Infinity;
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) gy = Math.min(gy, terrainEff(at.x + sx * B.w / 2, at.z + sz * B.d / 2));
  const base = gy - 1.0;
  const g = new THREE.Group();
  g.position.set(at.x, base, at.z);
  const concrete = artPaint(new THREE.MeshLambertMaterial({ color: TUNE.palette.grey, flatShading: true }), "concrete");
  const dark = new THREE.MeshLambertMaterial({ color: TUNE.palette.slate, flatShading: true });
  const slat = new THREE.MeshLambertMaterial({ color: TUNE.palette.ink, flatShading: true });
  const body = new THREE.Mesh(mergeBoxes([
    { w: B.w, h: B.h + 1, d: B.d, x: 0, y: (B.h + 1) / 2, z: 0 },
    // the chamfered shoulders either side (the film's sloped flanks)
    { w: 3.2, h: 3.2, d: B.d * 0.92, x: -B.w / 2 - 0.6, y: 1.4, z: 0, rz: 0.75 },
    { w: 3.2, h: 3.2, d: B.d * 0.92, x: B.w / 2 + 0.6, y: 1.4, z: 0, rz: -0.75 },
    // the ramp slab down to the door, east side
    { w: 4.2, h: 0.8, d: 7, x: 0, y: 1.2, z: B.d / 2 + 2.6, rx: 0.28 },
  ]), concrete);
  g.add(body);
  // the vent's housing: a box tilted up on the roof, its top the grille
  const ventG = new THREE.Group();
  ventG.position.set(0, B.h + 1, -B.d * 0.12);
  ventG.rotation.x = -B.ventTilt;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(B.ventW + 0.8, B.ventH, B.ventL), dark);
  housing.position.y = B.ventH / 2;
  ventG.add(housing);
  const slats = [];
  for (let i = 0; i < 9; i++) slats.push({ w: 0.22, h: 0.32, d: B.ventL * 0.9, x: -B.ventW / 2 + 0.2 + i * (B.ventW - 0.4) / 8, y: B.ventH + 0.14, z: 0 });
  const grille = new THREE.Mesh(mergeBoxes(slats), slat);
  ventG.add(grille);
  g.add(ventG);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.noShatter = true; } });
  scene.add(g);
  g.updateMatrixWorld(true);
  vl.bunker = g; vl.ventGroup = ventG; vl.base = base;
  // the vent's centre in the world: the top of the grille, the point he has to find
  const vc = new THREE.Vector3(0, B.ventH + 0.2, 0);
  ventG.localToWorld(vc);
  const vn = new THREE.Vector3(0, 1, 0).applyQuaternion(ventG.getWorldQuaternion(new THREE.Quaternion()));
  vl.vent = { x: vc.x, y: vc.y, z: vc.z, nx: vn.x, ny: vn.y, nz: vn.z };
  // solid like any building: a bang and a free reassembly at cruise, a shove at a crawl
  vl.solid = addSolidBox(at.x, base, at.z, B.w / 2 + 1.6, B.d / 2 + 1, base + B.h + 1 + B.ventH + 1.6, body, "building");
  // the track across the bowl to its door: a dark ribbon on the snow
  const pts = [];
  const bc = vlBowlCentre();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = at.x + 4 + t * (V.bowlR * 1.05) * 0.55;
    const z = at.z + B.d / 2 + 6 + t * V.bowlR * 0.8 + Math.sin(t * 7.5) * 14;
    pts.push([x, z]);
  }
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 1.3, nz = dx / l * 1.3;
    const y0 = terrainEff(x0, z0) + 0.25, y1 = terrainEff(x1, z1) + 0.25;
    pos.push(x0 - nx, y0, z0 - nz, x1 - nx, y1, z1 - nz, x1 + nx, y1, z1 + nz,
             x0 - nx, y0, z0 - nz, x1 + nx, y1, z1 + nz, x0 + nx, y0, z0 + nz);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  tg.computeVertexNormals();
  vl.track = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: TUNE.palette.slate, side: THREE.DoubleSide }));
  vl.track.receiveShadow = true;
  scene.add(vl.track);
  vl.centre = bc;
}

function vlBuild() {
  if (vl.built) return;
  vlBuildPines();
  vlBuildBunker();
  vl.built = true;
}

// On the kit's stream, then the kit's own seed put back: not one draw moves anywhere.
(function vlBuildQuiet() {
  const s = vkSeed;
  try { vkQuiet(0, () => vlBuild()); } finally { vkSeed = s; }
})();
