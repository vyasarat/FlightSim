"use strict";
// WORKING RULES
// The two block cities: New York round the old spire ("skyline") and the
// California downtown ("downtown"). Generated in Blender by
// scripts/city/build_city.py -- never edited here: change the generator, run
// it, and it rewrites both GLBs and citydata.js together.
//
// Two halves, deliberately. The LAYOUT (citydata.js) is plain JS and loads
// with the page, so every building's solids and the sparkle spots over the
// cities are registered synchronously, in the same place and the same way the
// old box clusters were. The LOOK (models/city-*.glb) arrives later. Until it
// has, a building's solid reports itself hidden -- there is never a wall he
// cannot see. (Nothing here times off the clock, and nothing waits on it.)
//
// Instanced by type: per building type one InstancedMesh of the full model and
// one of its LOD1 (the tiers, no rooftop detail), tinted per instance from the
// palette, a draw call each. A building past CITY.nearDist of the camera is
// drawn from the LOD1 set; beyond CITY.lodDist of the whole district the lot
// swaps for a single merged LOD1 mesh -- one draw call for the far city.
//
// The ground (streets, crossings, sidewalks) is DRAPED on the terrain the
// chunks actually draw -- their own triangles, not terrainEff's curve, which
// the flat facets cut through -- and lifted a hand's breadth so it never
// z-fights.
//
// A building he crashes into shatters and comes back like any other: its proxy
// takes `visible` from collision.js and zeroes or restores its instance.
// ---------------------------------------------------------------------------
const CITY = { nearDist: 650, lodDist: 1000, sink: 0.8, groundLift: 0.3, sidewalkLift: 0.45, reassign: 0.3 };
const cities = {};

// The height of the ground as the chunks DRAW it: the same lattice and the same
// diagonal as buildChunk's PlaneGeometry (scene.js), so a street laid on it
// follows every facet instead of cutting under the convex ones.
function terrainMeshY(x, z) {
  const cs = TUNE.chunkSize, step = cs / TUNE.chunkSegments;
  const gx = (x + cs / 2) / step, gz = (z + cs / 2) / step;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const X0 = ix * step - cs / 2, Z0 = iz * step - cs / 2;
  const hb = terrainEff(X0, Z0 + step), hd = terrainEff(X0 + step, Z0);
  if (fx + fz <= 1) {
    const ha = terrainEff(X0, Z0);
    return ha + (hd - ha) * fx + (hb - ha) * fz;
  }
  const hc = terrainEff(X0 + step, Z0 + step);
  return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}

// Does a city stand here? The streamed towns, trees and tall landmarks ask, so
// none of them grows through a block.
function cityCovers(x, z, margin) {
  const m = margin || 0;
  for (const k in cities) {
    const c = cities[k], b = c.data.bounds;
    if (x < b[0] - m || x > b[2] + m || z < b[1] - m || z > b[3] + m) continue;
    for (const r of c.data.blocks) {
      if (x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m) return true;
    }
  }
  return false;
}

// The rotated, unturned footprint of a type: [halfW, halfD] after `rot` quarter turns.
function cityTurn(cx, cz, hw, hd, rot) {
  const c = Math.cos(rot * Math.PI / 2), s = Math.sin(rot * Math.PI / 2);
  const x = cx * c + cz * s, z = -cx * s + cz * c;
  return rot % 2 ? [x, z, hd, hw] : [x, z, hw, hd];
}

// A stand-in for a building's mesh, for the solids registry. collision.js asks
// it `visible` (no GLB yet, or shattered: not solid) and sets it on a shatter.
function cityProxy(c, i) {
  return {
    isCityProxy: true, userData: {}, get parent() { return c.group; },
    get visible() { return c.ready && !c.hidden[i]; },
    set visible(v) { c.hidden[i] = !v; cityShowBuilding(c, i); },
  };
}

// A tower's CROWN, as solids (v139). The generator writes only the tiers as
// solid; the crown it stands on the top one -- a spire, a mast, a glass cap --
// was drawn and was air. A helicopter coming down on a crowned tower settled
// INSIDE it. citydata.js says only how much taller than its top tier the type
// is, and that number names the crown, by build_city.py's own rules
// (`tiered`, `round_tower`): +30 a spire, +23 a mast, +8 a glass cap, +3 the
// round tower's plant box. Same [cx, cz, halfW, halfD, y0, y1] as a tier.
const CITY_CROWN_CACHE = new Map();
function cityCrown(T) {
  if (T.crown) return T.crown;                // written by the generator (build_city.py, from v139 on)
  if (CITY_CROWN_CACHE.has(T)) return CITY_CROWN_CACHE.get(T);
  let top = T.tiers[0];
  for (const t of T.tiers) if (t[5] > top[5]) top = t;
  const cx = top[0], cz = top[1], y = top[5], hw = top[2], hd = top[3], k = T.height - y, out = [];
  const near = v => Math.abs(k - v) < 0.5;
  if (near(30)) out.push([cx, cz, 4.5, 4.5, y, y + 7], [cx, cz, 3, 3, y + 7, y + 12], [cx, cz, 1, 1, y + 12, y + 26]);
  else if (near(23)) out.push([cx, cz, hw * 0.5, hd * 0.5, y, y + 5], [cx, cz, 0.4, 0.4, y + 5, y + 23]);
  else if (near(8)) out.push([cx, cz, hw * 0.7, hd * 0.7, y, y + 4], [cx, cz, hw * 0.4, hd * 0.4, y + 4, y + 8]);
  else if (near(3)) out.push([cx, cz, 1.5, 1.5, y, y + 3]);   // the gate fails a height step it cannot name
  CITY_CROWN_CACHE.set(T, out);
  return out;
}

// Called from buildRouteLandmarks with the landmark's group, BEFORE
// addRouteLandmark positions it: every building's base, its solids as pending
// entries (relative to the group, which is how addRouteLandmark reads them).
function cityRegister(key, g, ax, az) {
  const data = CITY_DATA[key];
  const gy = terrainEff(ax, az) - 0.5;        // where addRouteLandmark will stand the group
  const c = {
    key, data, group: g, ax, az, gy, ready: false, failed: false,
    base: [], hidden: [], near: [], farI: [], lod1: null, ground: null, far: null,
    t: 0, camX: 1e9, camZ: 1e9,
  };
  cities[key] = c;
  data.buildings.forEach((b, i) => {
    const T = data.types[b[0]];
    const w = T.tiers[0][2], d = T.tiers[0][3];
    const [, , hw, hd] = cityTurn(0, 0, w, d, b[3]);
    // stand it on the lowest corner of its footprint, sunk a little: the plinth
    // below the base is what fills the slope on the high side
    let lo = Infinity;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, terrainMeshY(b[1] + sx * hw, b[2] + sz * hd));
    const y = lo - CITY.sink;
    c.base.push(y);
    c.hidden.push(false);
    const proxy = cityProxy(c, i);
    for (const t of T.tiers.concat(cityCrown(T))) {
      const [cx, cz, thw, thd] = cityTurn(t[0], t[1], t[2], t[3], b[3]);
      g.userData.pending.push({ lx: b[1] + cx - ax, ly0: y + t[4] - gy, lz: b[2] + cz - az,
                                hw: thw, hd: thd, y1: y + t[5] - gy, mesh: proxy });
    }
  });
  return c;
}

const cityMat = artPaint(new THREE.MeshPhongMaterial({
  color: 0xffffff, shininess: 60, specular: 0x505860,
}), "city");
const cityFarMat = artPaint(new THREE.MeshPhongMaterial({
  color: 0xffffff, vertexColors: true, shininess: 60, specular: 0x505860,
}), "city");
const cityGroundMat = artPaint(new THREE.MeshPhongMaterial({
  color: 0xffffff, vertexColors: true, shininess: 0, specular: 0x000000,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
}), "city");
const CITY_GROUND_TINT = {};
CITY_GROUND_TINT[ART_LAYER.road] = TUNE.runwaySurfaceColor;
CITY_GROUND_TINT[ART_LAYER.asphalt] = TUNE.runwaySurfaceColor;
CITY_GROUND_TINT[ART_LAYER.concrete] = TUNE.palette.concrete;

// uv2.x (the atlas slot from Blender) -> the artLayerA attribute art.js reads
function citySlotAttr(geo) {
  const uv2 = geo.attributes.uv2;
  const a = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < a.length; i++) a[i] = uv2 ? Math.round(uv2.getX(i)) : ART_LAYER.concrete;
  geo.setAttribute("artLayerA", new THREE.BufferAttribute(a, 1));
  geo.deleteAttribute("uv2");
  return geo;
}

const cityM = new THREE.Matrix4(), cityQ = new THREE.Quaternion(), cityV = new THREE.Vector3();
const cityS = new THREE.Vector3(1, 1, 1), cityZero = new THREE.Matrix4().makeScale(0, 0, 0);
const cityUp = new THREE.Vector3(0, 1, 0), cityCol = new THREE.Color();

function cityMatrix(c, i, out) {
  const b = c.data.buildings[i];
  cityQ.setFromAxisAngle(cityUp, b[3] * Math.PI / 2);
  cityV.set(b[1] - c.ax, c.base[i] - c.gy, b[2] - c.az);
  return out.compose(cityV, cityQ, cityS);
}

function cityShowBuilding(c, i) {
  if (c.ready) cityAssign(c);
}

// Hand every standing building to its type's near or far set, by distance.
// Seven hundred buildings, a few times a second: nothing.
function cityAssign(c) {
  const D = c.data, p = camera.position, nd2 = CITY.nearDist * CITY.nearDist;
  for (const m of c.near) m.count = 0;
  for (const m of c.farI) m.count = 0;
  D.buildings.forEach((b, i) => {
    if (c.hidden[i]) return;
    const dx = b[1] - p.x, dz = b[2] - p.z;
    const m = dx * dx + dz * dz < nd2 ? c.near[b[0]] : c.farI[b[0]];
    m.setMatrixAt(m.count, cityMatrix(c, i, cityM));
    m.setColorAt(m.count, cityCol.setHex(b[4]));
    m.count++;
  });
  for (const m of c.near.concat(c.farI)) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.visible = m.count > 0 && !c.far;
  }
  c.camX = p.x; c.camZ = p.z;
}

function cityBuildMeshes(c, gltf) {
  const byName = {};
  gltf.scene.traverse(o => { if (o.isMesh) byName[o.name] = o; });
  const D = c.data, g = c.group;
  // the district's own sphere, relative to the group, for every instanced mesh:
  // three.js culls an InstancedMesh by its GEOMETRY's bound, which is one building
  let r = 0;
  const cx = (D.bounds[0] + D.bounds[2]) / 2 - c.ax, cz = (D.bounds[1] + D.bounds[3]) / 2 - c.az;
  for (const T of D.types) r = Math.max(r, T.height);
  r = Math.hypot(D.bounds[2] - D.bounds[0], D.bounds[3] - D.bounds[1], r * 2) / 2 + 10;
  const sphere = new THREE.Sphere(new THREE.Vector3(cx, 40, cz), r);

  const counts = D.types.map(() => 0);
  D.buildings.forEach(b => { counts[b[0]]++; });
  D.types.forEach((T, k) => {
    for (const [name, list, shadow] of [["T" + k, c.near, true], ["T" + k + "L", c.farI, false]]) {
      const geo = citySlotAttr(byName[name].geometry);
      geo.boundingSphere = sphere.clone();
      const im = new THREE.InstancedMesh(geo, cityMat, Math.max(1, counts[k]));
      im.castShadow = true; im.receiveShadow = shadow;
      // every set carries its colour buffer from the start: the shared material
      // is compiled WITH instance colours, and a set without one aborts the frame
      im.setColorAt(0, cityCol.setHex(0xffffff));
      im.count = 0;
      list[k] = im;
      g.add(im);
    }
  });

  // LOD1: every building's tiers merged into one mesh, the tint in its vertex colours
  {
    const pos = [], nor = [], uv = [], lay = [], col = [];
    const nm = new THREE.Matrix3(), p = new THREE.Vector3(), n = new THREE.Vector3();
    const lods = c.farI.map(m => m.geometry.toNonIndexed());
    D.buildings.forEach((b, i) => {
      const G = lods[b[0]];
      cityMatrix(c, i, cityM);
      nm.getNormalMatrix(cityM);
      cityCol.setHex(b[4]);
      const P = G.attributes.position, N = G.attributes.normal, U = G.attributes.uv, A = G.attributes.artLayerA;
      for (let v = 0; v < P.count; v++) {
        p.fromBufferAttribute(P, v).applyMatrix4(cityM); pos.push(p.x, p.y, p.z);
        n.fromBufferAttribute(N, v).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
        uv.push(U.getX(v), U.getY(v)); lay.push(A.getX(v));
        col.push(cityCol.r, cityCol.g, cityCol.b);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("artLayerA", new THREE.Float32BufferAttribute(lay, 1));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    c.lod1 = new THREE.Mesh(geo, cityFarMat);
    c.lod1.visible = false;
    g.add(c.lod1);
  }

  // the ground, draped
  {
    const geo = citySlotAttr(byName.ground.geometry);
    const P = geo.attributes.position, A = geo.attributes.artLayerA;
    const col = new Float32Array(P.count * 3);
    for (let v = 0; v < P.count; v++) {
      const wx = P.getX(v), wz = P.getZ(v);   // Blender wrote world coordinates
      const lift = P.getY(v) > 0.05 ? CITY.sidewalkLift : CITY.groundLift;
      P.setXYZ(v, wx - c.ax, terrainMeshY(wx, wz) + lift - c.gy, wz - c.az);
      cityCol.setHex(CITY_GROUND_TINT[A.getX(v)] || TUNE.palette.concrete);
      col[v * 3] = cityCol.r; col[v * 3 + 1] = cityCol.g; col[v * 3 + 2] = cityCol.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    c.ground = new THREE.Mesh(geo, cityGroundMat);
    c.ground.receiveShadow = true;
    g.add(c.ground);
  }
  c.ready = true;
  cityAssign(c);
}

function cityLoadAll() {
  if (typeof THREE.GLTFLoader !== "function") { for (const k in cities) cities[k].failed = true; return; }
  const loader = new THREE.GLTFLoader();
  for (const k in cities) {
    const c = cities[k];
    loader.load(c.data.glb, (gltf) => {
      try { cityBuildMeshes(c, gltf); } catch (e) { c.failed = true; console.warn("city: build failed", k, e); }
    }, undefined, () => { c.failed = true; });
  }
}

// Within lodDist of the district's edge: the instanced sets, re-sorted near/far
// every so often. Beyond it: the one merged mesh.
function cityUpdate(dt) {
  for (const k in cities) {
    const c = cities[k];
    if (!c.ready || !c.group.visible) continue;
    const b = c.data.bounds, p = camera.position;
    const dx = Math.max(b[0] - p.x, 0, p.x - b[2]), dz = Math.max(b[1] - p.z, 0, p.z - b[3]);
    const far = dx * dx + dz * dz > CITY.lodDist * CITY.lodDist;
    if (far !== c.far) {
      c.far = far;
      for (const m of c.near.concat(c.farI)) m.visible = !far && m.count > 0;
      c.lod1.visible = far;
    }
    c.t -= dt || 0;
    if (!far && (c.t <= 0 || Math.hypot(p.x - c.camX, p.z - c.camZ) > 60)) {
      c.t = CITY.reassign;
      cityAssign(c);
    }
  }
}

function citiesSettled() {
  for (const k in cities) if (!cities[k].ready && !cities[k].failed) return false;
  return true;
}
