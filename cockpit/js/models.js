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
// ---------------------------------------------------------------------------
// WHICH WAY IS THE NOSE, measured rather than guessed.
//
// Three facts hold for every aeroplane in this game, and the test only trusts an
// answer all three agree on:
//
//   FIN      the highest part of the model is the vertical stabiliser, and it is
//            at the BACK. So the topmost cluster sits behind the centroid.
//   SWEEP    wings sweep back, so the wingtips (the widest vertices) sit behind
//            the wing root.
//   ENGINES  the engines hang below the wings and AHEAD of the fin.
//
// It tries both horizontal axes and both directions, scores the four candidates,
// and returns the turn that puts the nose at -Z. `agree` is false when the three
// disagree, and the caller then falls back rather than picking one -- a wrong
// answer here points an aeroplane backwards down a runway.
// ---------------------------------------------------------------------------
function modelAircraftAxis(scene) {
  const pts = [];
  const v = new THREE.Vector3();
  scene.updateWorldMatrix(true, true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));    // a sample is plenty
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      pts.push(v.x, v.y, v.z);
    }
  });
  const n = pts.length / 3;
  if (n < 200) return null;

  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i*3]; cy += pts[i*3+1]; cz += pts[i*3+2]; }
  cx /= n; cy /= n; cz /= n;

  // mean position of the highest / lowest / most lateral slices
  const pick = (key, frac, cmp) => {
    const idx = [...Array(n).keys()].sort((a, b) => cmp(key(a), key(b)));
    const take = Math.max(8, Math.floor(n * frac));
    let sx = 0, sy = 0, sz = 0;
    for (let k = 0; k < take; k++) { const i = idx[k]; sx += pts[i*3]; sy += pts[i*3+1]; sz += pts[i*3+2]; }
    return { x: sx / take, y: sy / take, z: sz / take };
  };
  const yOf = i => pts[i*3+1];
  const desc = (a, b) => b - a, asc = (a, b) => a - b;
  const top = pick(yOf, 0.02, desc);        // the fin
  const low = pick(yOf, 0.06, asc);         // gear and engine pods

  const score = (ax, sign) => {
    // `ahead` is the coordinate along the candidate forward direction
    const along = i => sign * (ax === "x" ? pts[i*3] : pts[i*3+2]);
    const lat   = i => Math.abs((ax === "x" ? pts[i*3+2] : pts[i*3]) - (ax === "x" ? cz : cx));
    const cAlong = sign * (ax === "x" ? cx : cz);
    const topAlong = sign * (ax === "x" ? top.x : top.z);
    const lowAlong = sign * (ax === "x" ? low.x : low.z);
    // FIN: behind the centroid
    const fin = topAlong < cAlong;
    // SWEEP: the widest vertices sit behind the ones near the centreline
    const idx = [...Array(n).keys()].sort((a, b) => lat(b) - lat(a));
    const tipTake = Math.max(8, Math.floor(n * 0.02));
    let tip = 0; for (let k = 0; k < tipTake; k++) tip += along(idx[k]); tip /= tipTake;
    let root = 0, rootN = 0;
    const span = lat(idx[0]);
    for (let i = 0; i < n; i++) if (lat(i) < span * 0.12) { root += along(i); rootN++; }
    root = rootN ? root / rootN : cAlong;
    const sweep = tip < root;
    // ENGINES: the low cluster is ahead of the fin
    const engines = lowAlong > topAlong;
    return { fin, sweep, engines, agree: fin && sweep && engines };
  };

  const cands = [
    { ax: "z", sign: -1, turn: 0 },                 // nose already at -Z
    { ax: "z", sign:  1, turn: Math.PI },
    { ax: "x", sign: -1, turn: -Math.PI / 2 },
    { ax: "x", sign:  1, turn:  Math.PI / 2 },
  ];
  let best = null;
  for (const c of cands) {
    const r = score(c.ax, c.sign);
    const votes = (r.fin ? 1 : 0) + (r.sweep ? 1 : 0) + (r.engines ? 1 : 0);
    const out = { ...c, ...r, votes };
    if (!best || out.votes > best.votes) best = out;
  }
  return best;
}

function modelPrepare(key, scene) {
  const cfg = MODELS[key];
  const g = new THREE.Group();
  g.add(scene);

  // 1. orient: the long horizontal axis becomes Z, and the nose points -Z.
  //
  // THE OLD TEST WAS `size.x > size.z`, AND ON AN AIRLINER THAT IS A COIN FLIP.
  // A 777 is 63.7 m long with a 60.9 m span and an A350 66.8 m with 64.8 m: the
  // bounding box is very nearly square, so "the long axis is the fuselage" is
  // decided by centimetres. It put the 777 sideways across the runway. The taper
  // test in the rig was no better -- it reported that model's nose end as 0.76 m
  // wide, which is a nose-cone tip rather than a tailplane, because the file is
  // 38 separate nodes and the sample found the wrong one.
  //
  // So the axis and the direction are MEASURED now, from three facts about every
  // aeroplane ever built, and all three have to agree (modelAircraftAxis below).
  // `yaw` remains as an explicit override for a model the geometry cannot read.
  // Always MEASURE (it is cheap and once per model, and the harness reads it),
  // but only ACT on it for a model that opts in. A car has no fin and no swept
  // wing, so the three tests mean nothing to it: the car, the fighter and the
  // two hulls keep exactly the path they had.
  scene.updateWorldMatrix(true, true);
  let bb = new THREE.Box3().setFromObject(scene);
  let size = bb.getSize(new THREE.Vector3());
  const orient = modelAircraftAxis(scene);
  if (cfg.autoOrient && orient && orient.agree) {
    scene.rotation.y += orient.turn;
  } else if (size.x > size.z) {
    scene.rotation.y += Math.PI / 2;
  }
  scene.updateWorldMatrix(true, true);
  if (cfg.yaw) { scene.rotation.y += cfg.yaw; scene.updateWorldMatrix(true, true); }
  g.userData.orient = orient;

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
  //
  // A BOAT follows the car's rule, not the aircraft's, and then sinks itself.
  // state.y is the waterline for a boat exactly as it is the road surface for
  // the car, so the hull's bottom belongs at gearHeight - wheelDrop; `lift` then
  // pushes it under by the draft. Using the aircraft rule floated the whole hull
  // on top of the sea like a bath toy.
  const vp = TUNE.vehicles[key] || {};
  const wheelDrop = vp.hasGear ? 1.9 * (vp.size || 1) : 0.6;
  const localBottom = (vp.car || vp.boat) ? (TUNE.gearHeight - wheelDrop) : -wheelDrop;
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
  //
  // `smooth` rebuilds the normals. The offline simplifier keeps the normal of
  // every vertex it spares while moving the surface between them, so a decimated
  // body is lit as a surface that is no longer there: the car came back with
  // creases down its doors and a shade darker than its own source everywhere. It
  // is not a triangle budget -- at 82k with a bound of 0.0003 the creases were
  // still there, and they went the moment the normals were rebuilt. The geometry
  // is welded and shares 0.77 vertices per triangle, so this gives a genuinely
  // smooth body rather than facets. The fighter does not ask for it: its normals
  // were stripped in the build and faceting is the whole look of the thing.
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (cfg.smooth && o.geometry) o.geometry.computeVertexNormals();
    o.castShadow = true;
    o.receiveShadow = false;
    const m = o.material;
    if (m && m.transparent) { m.depthWrite = false; m.side = THREE.DoubleSide; }
  });
  // 5. wheels: only the car has them, and only if they can be found
  if (vp.car) { try { modelSplitWheels(g); } catch (e) { console.warn("models: wheel split failed", e && e.message); } }
  if (cfg.burner) { try { modelBuildBurner(g); } catch (e) { console.warn("models: burner failed", e && e.message); } }
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

  // The count before any surgery, so the check that no hole opens up in the
  // bodywork is an invariant of THIS model rather than a number written down
  // once and stale the next time the model is rebuilt.
  const triCount = () => {
    let t = 0;
    g.traverse((o) => { if (o.isMesh && o.geometry) { const q = o.geometry; t += (q.index ? q.index.count : q.attributes.position.count) / 3; } });
    return t;
  };
  g.userData.trisBefore = triCount();

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
  g.userData.trisAfter = triCount();
  console.log("models: wheels", order.map((w) => w.parts.size + "p").join("/"), "r=" + g.userData.wheelR.toFixed(2));
}

// ---------------------------------------------------------------------------
// The engine.
//
// The fighter arrives as a single silent mesh, so the nozzle has to be found the
// same way the wheels were: by geometry. The exhaust is the rearmost thing on
// the centreline, so the candidates are the vertices in the last few per cent of
// the model's length that are close to its axis -- that excludes the tails and
// the stabilators, which reach just as far back but are nowhere near the middle.
//
// The plume is additive billboards and cones on one shared texture, like every
// other glow in this game. There is no post-processing stack and there is not
// going to be one: a full-screen bloom costs more on an iPad than all of them
// together.
function modelBuildBurner(g) {
  const B = TUNE.burner;
  g.updateWorldMatrix(true, true);
  const gInv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const box = new THREE.Box3().setFromObject(g);
  const len = box.max.z - box.min.z, halfW = (box.max.x - box.min.x) / 2;
  const axis = Math.min(halfW * B.axisFrac, len * 0.06);
  const v = new THREE.Vector3();
  let best = null;
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const M = new THREE.Matrix4().multiplyMatrices(gInv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (Math.abs(v.x - (box.min.x + box.max.x) / 2) > axis) continue;
      if (!best || v.z > best.z) best = v.clone();
    }
  });
  if (!best) { console.warn("models: no nozzle found"); return; }
  // the ring around that rearmost point, which gives the nozzle's centre and size
  const near = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const M = new THREE.Matrix4().multiplyMatrices(gInv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (best.z - v.z > len * B.lipFrac || v.z > best.z + 1e-4) continue;
      if (Math.hypot(v.x - best.x, v.y - best.y) > len * B.mouthFrac) continue;
      near.push(v.clone());
    }
  });
  const c = new THREE.Vector3();
  for (const p of near) c.add(p);
  if (near.length) c.multiplyScalar(1 / near.length); else c.copy(best);
  let r = 0;
  for (const p of near) r = Math.max(r, Math.hypot(p.x - c.x, p.y - c.y));
  r = Math.max(r, len * 0.02);

  const burner = new THREE.Group();
  burner.name = "burner_root";
  burner.position.set(c.x, c.y, best.z);
  const add = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const cone = (radius, length, mat) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 14, 1, true), mat);
    m.rotation.x = Math.PI / 2;      // apex points aft, base sits on the nozzle
    m.position.z = length / 2;
    return m;
  };
  // The outer flame is NOT additive, and that is the whole reason it reads as
  // fire. Additive can only ever add light, so against this game's bright sky an
  // orange plume came out as a white smear -- the sky is already near the top of
  // the range and there is nowhere left to go. A normally-blended translucent
  // cone can be warmer than what is behind it.
  //
  // And it is LAYERED. One cone, however well coloured, is a hard-edged orange
  // spike: it reads as a traffic cone stuck to the back of the jet. Three nested
  // cones of falling opacity and rising length hide each other's silhouettes and
  // give the soft taper that makes it fire. The hot core, the shock diamonds and
  // the nozzle glow stay additive, because those really are light.
  const parts = {};
  B.layers.forEach((L, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: L.color, transparent: true, opacity: L.opacity,
      depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    const m = cone(r * L.r, r * L.len, mat);
    m.name = "burner_flame" + i;
    burner.add(m);
    parts["flame" + i] = m;
  });
  const core = cone(r * B.coreR, r * B.coreLen, add(B.coreColor, B.coreOpacity));
  core.name = "burner_core";
  burner.add(core);

  // shock diamonds: the bright knots down the middle of a real afterburner.
  // One mesh for all of them -- they are three quads, not three draw calls.
  const dia = [];
  for (let i = 0; i < B.diamonds; i++) {
    const t = (i + 1) / (B.diamonds + 1);
    const s = r * B.diamondR * (1 - t * 0.55);
    dia.push({ w: s * 2, h: s * 2, d: s * 0.5, x: 0, y: 0, z: r * B.layers[0].len * t * 0.8 });
  }
  // mergeBoxes lives in car.js, which loads after this file -- fine, because
  // nothing here runs until a model has finished downloading, but guarded so a
  // missing helper costs the diamonds rather than the whole engine.
  if (typeof mergeBoxes === "function") {
    const knots = new THREE.Mesh(mergeBoxes(dia), add(B.diamondColor, B.diamondOpacity));
    knots.name = "burner_knots";
    burner.add(knots);
  }

  const glow = glowSprite(B.color, r * B.glow, B.glowOpacity);
  glow.name = "burner_glow";
  glow.position.z = r * 0.35;
  burner.add(glow);

  burner.visible = false;
  g.add(burner);
  g.userData.nozzleR = r;
  console.log("models: nozzle r=" + r.toFixed(2) + " at z=" + best.z.toFixed(2) + " from " + near.length + " pts");
}

// The burner is driven every frame from throttle and speed. It is deliberately
// never fully off while he is flying: an F-35 sitting on the deck with a cold
// black hole where its engine is looks broken, so it idles.
function updateModelBurner(dt) {
  const m = vehicleModel;
  if (!m || !m.userData.burner) return;
  const B = TUNE.burner, b = m.userData.burner;
  const flying = state.phase === "AIRBORNE" || state.speed > 2;
  b.root.visible = flying && !state.exploding;
  if (!b.root.visible) return;
  const throttle = state.throttleHeld ? 1 : 0;
  const fast = clamp(state.speed / ((state.vp.cruiseSpeed || 90) * 0.9), 0, 1.15);
  const want = B.idle + (1 - B.idle) * clamp(0.45 * fast + 0.55 * throttle, 0, 1);
  b.level += (want - b.level) * Math.min(1, B.response * dt);
  const flicker = 1 + (Math.random() - 0.5) * B.flicker;
  b.root.scale.set(1, 1, b.level * flicker);
  for (let i = 0; i < B.layers.length; i++) {
    const f = b["flame" + i];
    if (f) f.material.opacity = B.layers[i].opacity * b.level;
  }
  if (b.core) b.core.material.opacity = B.coreOpacity * (0.4 + 0.6 * b.level);
  if (b.knots) b.knots.material.opacity = B.diamondOpacity * Math.max(0, b.level - 0.45) / 0.55;
  if (b.glow) {
    b.glow.material.opacity = B.glowOpacity * b.level;
    const s = (m.userData.nozzleR || 1) * B.glow * (0.85 + 0.3 * Math.random()) * (0.6 + 0.4 * b.level);
    b.glow.scale.set(s, s, 1);
  }
}

// Wheel groups survive cloning by NAME: Object3D.copy runs userData through
// JSON, so an object reference stored there would not come back.
function modelFindBurner(g) {
  const root = g.getObjectByName("burner_root");
  if (!root) return;
  const b = {
    root, level: 0,
    core: g.getObjectByName("burner_core"),
    knots: g.getObjectByName("burner_knots"),
    glow: g.getObjectByName("burner_glow"),
  };
  for (let i = 0; i < TUNE.burner.layers.length; i++) b["flame" + i] = g.getObjectByName("burner_flame" + i);
  g.userData.burner = b;
}

function modelFindWheels(g, key) {
  const all = [];
  g.traverse((o) => { if (o.name && o.name.indexOf("wheel_") === 0) all.push(o); });
  if (!all.length) return;
  g.userData.wheels = all;
  g.userData.wheelsFront = all.filter((o) => o.name.charAt(6) === "F");   // "wheel_FL"

  // AN IMPORTED BODY'S GEAR DOES NOT RETRACT UNLESS IT IS ASKED TO. The built
  // bodies hand updateVehicleModel a `gear` group and it folds that away with
  // state.gearAnim; an imported one never had one, so the fighter's wheels have
  // always stayed down. That is its existing behaviour and it stays -- only a
  // model whose TUNE entry asks (`gearFromWheels`) gets the wheels gathered into
  // a group and handed over, which is the airliners and nothing else.
  const cfg = MODELS[key];
  if (!cfg || !cfg.gearFromWheels) return;
  const gearGroup = new THREE.Group();
  gearGroup.name = "gear_imported";
  g.add(gearGroup);
  for (const w of all) {
    // keep its world placement while re-parenting: the wheel groups sit at the
    // model's own origin, so this is a straight hand-over, not a transform.
    gearGroup.attach(w);
  }
  g.userData.gear = gearGroup;
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
        // The yacht is a place in the world as well as a thing he drives, and
        // the world copy is built long before the download lands. Without this
        // she keeps her block-built stand-in for ever while the boat he steps
        // into is the real hull -- two different ships with one name.
        if (key === "yacht" && typeof yachtAttachBody === "function" && yacht.built) yachtAttachBody();
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
  g.userData.trisBefore = proto.userData.trisBefore;
  g.userData.trisAfter = proto.userData.trisAfter;
  g.userData.nozzleR = proto.userData.nozzleR;
  modelFindWheels(g, key);
  modelFindBurner(g);
  return g;
}

modelsPreload();
