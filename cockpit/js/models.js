"use strict";
// WORKING RULES
// Imported GLB bodies for the car and the fighter, decimated by
// scripts/build_models.js from raw downloads that were 11 MB and 90 MB.
//
// The contract with the rest of the game is that NOTHING ELSE MOVES: each model
// is scaled and oriented to the exact bounding box the hand-built body had, its
// wheels sit on y=0, its nose points at -Z like every other model in this game,
// and its origin is the same spawn origin the flight code already uses. So the
// collision box, the spawn point, the camera anchors and the interior offsets
// all keep working untouched.
//
// Loading is async and the game does not wait for it: until a model arrives the
// vehicle keeps its built geometry, and the moment it lands the current vehicle
// is rebuilt. A missing or broken file is therefore a cosmetic downgrade, never
// a broken game.

const MODELS = TUNE.models;
const modelStore = {};        // key -> prepared prototype Object3D
const modelState = {};        // key -> "loading" | "ready" | "failed"

function modelPrototype(key) { return modelStore[key] || null; }

// Fit a loaded scene into the box the built body occupied.
function modelPrepare(key, scene) {
  const cfg = MODELS[key];
  const g = new THREE.Group();
  g.add(scene);

  // 1. orient: the long horizontal axis becomes Z, and the nose points -Z
  scene.updateWorldMatrix(true, true);
  let bb = new THREE.Box3().setFromObject(scene);
  let size = bb.getSize(new THREE.Vector3());
  if (size.x > size.z) { scene.rotation.y += Math.PI / 2; scene.updateWorldMatrix(true, true); }
  if (cfg.yaw) { scene.rotation.y += cfg.yaw; scene.updateWorldMatrix(true, true); }

  // 2. scale to the target length
  bb = new THREE.Box3().setFromObject(scene);
  size = bb.getSize(new THREE.Vector3());
  const s = cfg.length / Math.max(0.001, size.z);
  scene.scale.multiplyScalar(s);
  scene.updateWorldMatrix(true, true);

  // 3. centre it, and stand it on the ground
  bb = new THREE.Box3().setFromObject(scene);
  const c = bb.getCenter(new THREE.Vector3());
  scene.position.x -= c.x;
  scene.position.z -= c.z;
  // Sit it on the ground THROUGH the offset the game already applies.
  // updateVehicleModel places every model at state.y - gearHeight + wheelDrop,
  // because the hand-built bodies carried their wheels below their origin. An
  // imported model has its lowest point AT the origin, so without this it floats
  // by the whole wheelDrop -- 1.9 m on a geared aircraft.
  //
  // updateVehicleModel places every model at  state.y - gearHeight + wheelDrop.
  // For an AIRCRAFT, state.y is the reference height with the gear extended, so
  // the ground is state.y - gearHeight and the body's bottom belongs at
  // -wheelDrop in local space. For the CAR, state.y is the road surface itself,
  // so its bottom belongs at gearHeight - wheelDrop instead. Using the aircraft
  // rule for the car buried it by a whole gearHeight and left only its roof
  // showing above the tarmac.
  const vp = TUNE.vehicles[key] || {};
  const wheelDrop = vp.hasGear ? 1.9 * (vp.size || 1) : 0.6;
  const localBottom = vp.car ? (TUNE.gearHeight - wheelDrop) : -wheelDrop;
  scene.position.y -= bb.min.y;
  scene.position.y += localBottom;
  scene.position.y += cfg.lift || 0;
  scene.updateWorldMatrix(true, true);

  // What the interior view needs: the real height of this body above the road.
  // The car's cabin anchors were written against the hand-built box (bodyH 2.6)
  // and the imported body is 3.18 m tall, which put the driver's eye 0.45 m
  // under the headlining. Measured, not assumed.
  bb = new THREE.Box3().setFromObject(scene);
  g.userData.height = bb.max.y - bb.min.y;

  // 4. house rules: everything casts, nothing is a wall, glass stays glass
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    const m = o.material;
    if (m && m.transparent) { m.depthWrite = false; m.side = THREE.DoubleSide; }
  });
  // 5. wheels: only the car has them, and only if they can be found
  if (vp.car) { try { modelSplitWheels(g); } catch (e) { console.warn("models: wheel split failed", e && e.message); } }
  g.userData.imported = key;
  return g;
}

// ---------------------------------------------------------------------------
// Wheels, found by geometry.
//
// The build joins primitives by material, so all four wheels arrive as a single
// "tyre" mesh and the rims are mixed into the body. Nothing in the file names
// them either -- the source nodes are Object_2..Object_43 -- so they are found
// by shape: the tyre material's triangles fall into four corner clusters, each
// cluster defines a cylinder about the model's X axis (the axle), and every
// triangle in the WHOLE model that lies inside one of those cylinders -- rims,
// brake discs, hub caps -- is moved into that wheel's group.
//
// Capture tests the whole triangle, and the cylinder is never wider or fatter
// than the tyre that defined it. That is what keeps the arch above the wheel and
// the well behind it on the body: a straddling triangle is left alone, so no
// hole can open up in the bodywork.
function modelSplitWheels(g) {
  const meshes = [];
  g.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  if (!meshes.length) return;
  const gInv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const mtx = new Map();
  for (const m of meshes) { m.updateWorldMatrix(true, false); mtx.set(m, new THREE.Matrix4().multiplyMatrices(gInv, m.matrixWorld)); }

  // triangles of a mesh, in g space
  const tri = new THREE.Vector3(), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  function each(m, fn) {
    const pos = m.geometry.attributes.position, idx = m.geometry.index, M = mtx.get(m);
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
      va.fromBufferAttribute(pos, ia).applyMatrix4(M);
      vb.fromBufferAttribute(pos, ib).applyMatrix4(M);
      vc.fromBufferAttribute(pos, ic).applyMatrix4(M);
      fn(t, ia, ib, ic, va, vb, vc);
    }
  }

  const box = new THREE.Box3().setFromObject(g), mid = box.getCenter(new THREE.Vector3());

  // 1. the tyre material's triangles, split into four corners
  const corners = { "--": [], "-+": [], "+-": [], "++": [] };
  for (const m of meshes) {
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || mat.name !== "tyre") continue;
    each(m, (t, ia, ib, ic, a, b, c) => {
      tri.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      corners[(tri.x < mid.x ? "-" : "+") + (tri.z < mid.z ? "-" : "+")].push([a.clone(), b.clone(), c.clone()]);
    });
  }
  const keys = Object.keys(corners).filter((k) => corners[k].length > 20);
  if (keys.length !== 4) { console.warn("models: wheels not found (" + keys.length + " clusters)"); return; }

  // 2. each corner becomes a cylinder about X: axial span from the tyre itself,
  //    radius in the Y-Z plane from its own centre.
  const wheels = keys.map((k) => {
    const b = new THREE.Box3();
    for (const t of corners[k]) { b.expandByPoint(t[0]); b.expandByPoint(t[1]); b.expandByPoint(t[2]); }
    const c = b.getCenter(new THREE.Vector3());
    let r = 0;
    for (const t of corners[k]) for (const v of t) r = Math.max(r, Math.hypot(v.y - c.y, v.z - c.z));
    return { key: k, centre: c, r, minX: b.min.x, maxX: b.max.x, parts: new Map() };
  });
  function wheelOf(a, b, c) {
    for (const w of wheels) {
      let ok = true;
      for (const v of [a, b, c]) {
        if (v.x < w.minX - 1e-4 || v.x > w.maxX + 1e-4) { ok = false; break; }
        if (Math.hypot(v.y - w.centre.y, v.z - w.centre.z) > w.r * 1.02) { ok = false; break; }
      }
      if (ok) return w;
    }
    return null;
  }

  // 3. move every captured triangle out of its mesh and into the wheel
  const nrm = new THREE.Vector3();
  for (const m of meshes) {
    const geo = m.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
    const M = mtx.get(m), N = new THREE.Matrix3().getNormalMatrix(M);
    const keep = [];
    let moved = 0;
    each(m, (t, ia, ib, ic, a, b, c) => {
      const w = wheelOf(a, b, c);
      if (!w) { keep.push(ia, ib, ic); return; }
      moved++;
      let part = w.parts.get(m.material);
      if (!part) { part = { p: [], n: [] }; w.parts.set(m.material, part); }
      for (const [v, i] of [[a, ia], [b, ib], [c, ic]]) {
        part.p.push(v.x - w.centre.x, v.y - w.centre.y, v.z - w.centre.z);
        if (nor) { nrm.fromBufferAttribute(nor, i).applyMatrix3(N).normalize(); part.n.push(nrm.x, nrm.y, nrm.z); }
      }
    });
    if (!moved) continue;
    if (!keep.length) { if (m.parent) m.parent.remove(m); continue; }
    if (idx) geo.setIndex(keep);
    else { geo.setIndex(keep); }
    geo.computeBoundingSphere();
  }

  // 4. hang them off the root, named so a clone can find them again
  const order = wheels.slice().sort((a, b) => a.centre.z - b.centre.z);   // nose is -Z, so front first
  for (const [i, w] of order.entries()) {
    const grp = new THREE.Group();
    grp.position.copy(w.centre);
    grp.rotation.order = "YXZ";                       // steer first, then spin on the steered axle
    grp.name = "wheel_" + (i < 2 ? "F" : "R") + (w.centre.x < mid.x ? "L" : "R");
    for (const [mat, part] of w.parts) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(part.p, 3));
      if (part.n.length === part.p.length) bg.setAttribute("normal", new THREE.Float32BufferAttribute(part.n, 3));
      else bg.computeVertexNormals();
      const mesh = new THREE.Mesh(bg, mat);
      mesh.castShadow = true;
      grp.add(mesh);
    }
    g.add(grp);
  }
  g.userData.wheelR = order.reduce((a, w) => a + w.r, 0) / order.length;
  console.log("models: wheels", order.map((w) => w.parts.size + "p").join("/"), "r=" + g.userData.wheelR.toFixed(2));
}

// Wheel groups survive cloning by NAME: Object3D.copy runs userData through
// JSON, so an object reference stored there would not come back.
function modelFindWheels(g) {
  const all = [];
  g.traverse((o) => { if (o.name && o.name.indexOf("wheel_") === 0) all.push(o); });
  if (!all.length) return;
  g.userData.wheels = all;
  g.userData.wheelsFront = all.filter((o) => o.name.charAt(6) === "F");   // "wheel_FL"
}

function modelsPreload() {
  if (typeof THREE.GLTFLoader !== "function") { console.warn("models: no GLTFLoader"); return; }
  const loader = new THREE.GLTFLoader();
  for (const key of Object.keys(MODELS)) {
    const cfg = MODELS[key];
    modelState[key] = "loading";
    loader.load(cfg.file, (gltf) => {
      try {
        modelStore[key] = modelPrepare(key, gltf.scene);
        modelState[key] = "ready";
        flags.modelsLoaded = (flags.modelsLoaded || 0) + 1;
        // if he is already in this vehicle, swap the body in underneath him
        if (state.vehicleKey === key && typeof buildVehicleModel === "function") buildVehicleModel(key);
      } catch (e) {
        modelState[key] = "failed";
        console.warn("models: could not prepare", key, e && e.message);
      }
    }, undefined, (err) => {
      modelState[key] = "failed";
      console.warn("models: could not load", cfg.file, err && err.message);
    });
  }
}

// A fresh instance for the vehicle model. Materials are shared on purpose --
// there is only ever one of each vehicle on screen.
function modelInstance(key) {
  const proto = modelPrototype(key);
  if (!proto) return null;
  const g = proto.clone(true);
  g.userData.imported = key;
  g.userData.wheelR = proto.userData.wheelR;
  g.userData.height = proto.userData.height;
  modelFindWheels(g);
  return g;
}

modelsPreload();
