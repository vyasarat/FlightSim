// ---------------------------------------------------------------------------
// Turn the raw downloaded models into something a four-year-old's iPad can hold.
//
//   node scripts/build_models.js
//
// Reads models-src/*.src.glb (gitignored, 105 MB of them) and writes the small
// processed models the game actually loads, into cockpit/models/.
//
// The raw files are 346k triangles (car) and 1.24M (fighter). Neither is
// shippable: the fighter alone is 90 MB, and the service worker caches every
// asset for offline play. Everything below exists to get them under 25k
// triangles and a couple of megabytes while keeping the silhouette, which is
// the only thing he will recognise.
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dedup, weld, simplify, prune, flatten, join, textureCompress, clearNodeTransform } = require("@gltf-transform/functions");
const sharp = require("sharp");
const { MeshoptSimplifier } = require("meshoptimizer");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "models-src");
const OUT = path.join(ROOT, "cockpit", "models");

// Tesla Stealth Grey: a dark, near-neutral grey that reads almost gunmetal in
// shade and lifts to a mid grey in direct sun -- darker and flatter than the old
// Midnight Silver Metallic.
//
// TWO ADJUSTMENTS, both because of how this scene is lit rather than taste:
//   * metalness stays LOW. There is no environment map in this game, and a
//     metallic PBR material with nothing to reflect loses its diffuse term and
//     renders essentially black. At 0.55 the car was black; at 0.10 it is grey.
//   * the authored base is lifted a little above the paint's nominal value,
//     because one directional light and a hemisphere fill deliver far less
//     energy than the daylight the real colour is quoted under.
const PALETTE = {
  body:  { base: [0.400, 0.404, 0.416, 1], metallic: 0.10, roughness: 0.44 },
  glass: { base: [0.090, 0.105, 0.125, 0.62], metallic: 0.0, roughness: 0.10, alpha: "BLEND" },
  tyre:  { base: [0.075, 0.080, 0.090, 1], metallic: 0.0, roughness: 0.95 },
  trim:  { base: [0.150, 0.158, 0.170, 1], metallic: 0.15, roughness: 0.55 },
  lamp:  { base: [0.900, 0.930, 1.000, 1], metallic: 0.0, roughness: 0.30, emissive: [0.55, 0.58, 0.65] },
  tail:  { base: [0.850, 0.130, 0.100, 1], metallic: 0.0, roughness: 0.30, emissive: [0.45, 0.04, 0.03] },
};

// Classify an original material by name. Anything unrecognised becomes body,
// which is exactly what "bake to a single stealth-grey material" asks for.
function classify(name, mat) {
  const n = (name || "").toLowerCase();
  if (/rubber|tyre|tire|wheel_?black/.test(n)) return "tyre";
  if (/glass|window|windshield|windscreen|screen|transmission/.test(n)) return "glass";
  if (mat && mat.getExtension && mat.getExtension("KHR_materials_transmission")) return "glass";
  if (/tail|rear_?red|back_red|brake/.test(n)) return "tail";
  if (/light|lamp|headl|led/.test(n)) return "lamp";
  if (/chrome|iron|metal|steel|trim|grill|mirror/.test(n)) return "trim";
  return "body";
}

// The Cybertruck's own paint. Brushed stainless is LIGHT and nearly flat: the
// Model Y's metalness rule holds (no environment map), and the base sits well
// above the stealth grey so the two cars are told apart from the chase camera.
// Its glass is OPAQUE: the source has no cabin behind it, and a see-through pane
// over an empty shell reads as a hole. Its rims are aero covers, a mid grey.
const CYBER_PALETTE = {
  body: { base: [0.600, 0.615, 0.635, 1], metallic: 0.10, roughness: 0.50 },
  tint: { base: [0.070, 0.082, 0.100, 1], metallic: 0.0, roughness: 0.12 },
  rim:  { base: [0.300, 0.315, 0.335, 1], metallic: 0.10, roughness: 0.55 },
};

// v159: the Corvette's. Torch red, lifted the way the stealth grey was (one sun
// and a sky fill deliver less than the daylight the paint is quoted under), low
// metalness for the same reason. Its glass is opaque (no cabin behind it), its
// rims carbon-dark, its tail pipes bright steel so the flames have a mouth.
const CORVETTE_PALETTE = {
  body: { base: [0.780, 0.060, 0.045, 1], metallic: 0.10, roughness: 0.40 },
  tint: { base: [0.060, 0.070, 0.085, 1], metallic: 0.0, roughness: 0.12 },
  trim: { base: [0.055, 0.058, 0.064, 1], metallic: 0.10, roughness: 0.60 },
  rim:  { base: [0.300, 0.310, 0.330, 1], metallic: 0.10, roughness: 0.50 },
  pipe: { base: [0.700, 0.715, 0.735, 1], metallic: 0.10, roughness: 0.35 },
};

async function build(name, targetTris, opts = {}) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const inPath = path.join(SRC, opts.src || `${name}.src.glb`);
  const outPath = path.join(OUT, `${name}.glb`);
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  const countTris = () => {
    let t = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      t += idx ? idx.getCount() / 3 : (p.getAttribute("POSITION")?.getCount() || 0) / 3;
    }
    return Math.round(t);
  };
  const before = { tris: countTris(), bytes: fs.statSync(inPath).size,
                   mats: root.listMaterials().length, tex: root.listTextures().length };

  // ---- 0. regions: triangles of one source material that belong in another
  // bucket, picked by where they sit (source world space, centroid). Split off
  // into a material of their own, which `opts.materials` then maps.
  for (const rule of opts.regions || []) {
    const moved = doc.createMaterial(rule.name);
    let n = 0;
    for (const node of root.listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const M = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial(); if (!mat || mat.getName() !== rule.from) continue;
        const pos = prim.getAttribute("POSITION"), idx = prim.getIndices(); if (!idx) continue;
        const keep = [], take = [], v = [0, 0, 0], c = [0, 0, 0];
        for (let t = 0; t < idx.getCount(); t += 3) {
          c[0] = c[1] = c[2] = 0;
          for (let j = 0; j < 3; j++) {
            pos.getElement(idx.getScalar(t + j), v);
            for (let r = 0; r < 3; r++) c[r] += (M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r]) / 3;
          }
          (rule.test(c[0], c[1], c[2]) ? take : keep).push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2));
        }
        if (!take.length) continue;
        n += take.length / 3;
        const mk = (a) => doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(a)).setBuffer(idx.getBuffer());
        prim.setIndices(mk(keep));
        const twin = prim.clone().setIndices(mk(take)).setMaterial(moved);
        mesh.addPrimitive(twin);
      }
    }
    console.log(`  region ${rule.name}: ${n} triangles out of ${rule.from}`);
    if (!n) throw new Error(`${name}: region ${rule.name} matched nothing`);
  }

  // ---- 0b. islands (v159): in the materials named, every connected piece
  // smaller than `below` (its box's diagonal, source units) goes. Raised
  // lettering is a scatter of small separate pieces, one per letter, and baking
  // to a flat colour keeps its SHAPE -- so a word moulded into the trim is still
  // a word. Connected by position, not by index: a seam split for normals or UVs
  // is still one piece.
  if (opts.islands) {
    const I = opts.islands, q = (x) => Math.round(x / I.weld);
    let dropped = 0, pieces = 0;
    for (const node of root.listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const M = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial(); if (!mat || !I.materials.some((s) => mat.getName().includes(s))) continue;
        const pos = prim.getAttribute("POSITION"), idx = prim.getIndices(); if (!idx) continue;
        const n = pos.getCount(), w = new Float64Array(n * 3), v = [0, 0, 0];
        const key = new Map(), root_ = new Int32Array(n);
        const find = (a) => { while (root_[a] !== a) { root_[a] = root_[root_[a]]; a = root_[a]; } return a; };
        for (let i = 0; i < n; i++) {
          pos.getElement(i, v);
          for (let r = 0; r < 3; r++) w[i * 3 + r] = M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r];
          const k = q(w[i * 3]) + "," + q(w[i * 3 + 1]) + "," + q(w[i * 3 + 2]);
          root_[i] = i;
          if (key.has(k)) root_[i] = find(key.get(k)); else key.set(k, i);
        }
        for (let t = 0; t < idx.getCount(); t += 3) {
          const a = find(idx.getScalar(t)), b = find(idx.getScalar(t + 1)), c = find(idx.getScalar(t + 2));
          root_[b] = a; root_[find(c)] = a;
        }
        const lo = new Map(), hi = new Map();
        for (let i = 0; i < n; i++) {
          const r = find(i);
          if (!lo.has(r)) { lo.set(r, [1e9, 1e9, 1e9]); hi.set(r, [-1e9, -1e9, -1e9]); }
          const L = lo.get(r), H = hi.get(r);
          for (let a = 0; a < 3; a++) { L[a] = Math.min(L[a], w[i * 3 + a]); H[a] = Math.max(H[a], w[i * 3 + a]); }
        }
        const small = new Set();
        for (const [r, L] of lo) { const H = hi.get(r); pieces++; if (Math.hypot(H[0] - L[0], H[1] - L[1], H[2] - L[2]) < I.below) small.add(r); }
        const keep = [];
        for (let t = 0; t < idx.getCount(); t += 3) {
          if (small.has(find(idx.getScalar(t)))) { dropped++; continue; }
          keep.push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2));
        }
        prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(keep)).setBuffer(idx.getBuffer()));
      }
    }
    console.log(`  islands: ${dropped} triangles in pieces under ${I.below} dropped (${pieces} pieces looked at)`);
  }

  // ---- 1. bake every material down to the small palette, BEFORE simplifying:
  // fewer materials means fewer primitives, which means `join` can merge them
  // and the simplifier gets whole surfaces instead of islands.
  //
  // `opts.materials` names the bucket for each source material outright, for a
  // model whose materials are called "Material.004" and so tell `classify`
  // nothing; one it does not name is an error, never quietly body.
  // `opts.materialsBy` does the same by PART of the name, first match wins, for a
  // model whose names are long and carry the part in the middle (v159); and a
  // part mapped to "drop" is taken out of the model altogether.
  const kindOf = (mat) => {
    if (opts.materialsBy) {
      const nm = (mat && mat.getName()) || "";
      const hit = opts.materialsBy.find(([part]) => nm.includes(part));
      if (!hit) throw new Error(`${name}: source material "${nm}" is not in its map`);
      return hit[1];
    }
    if (!opts.materials) return classify(mat && mat.getName(), mat);
    const k = mat && opts.materials[mat.getName()];
    if (!k) throw new Error(`${name}: source material "${mat && mat.getName()}" is not in its map`);
    return k;
  };
  const pal = { ...PALETTE, ...(opts.palette || {}) };
  const buckets = new Map();
  const report = {};
  for (const mat of root.listMaterials()) {
    const kind = kindOf(mat);
    report[kind] = (report[kind] || 0) + 1;
    if (kind !== "drop" && !buckets.has(kind)) {
      const spec = pal[kind];
      const nm = doc.createMaterial(kind)
        .setBaseColorFactor(spec.base)
        .setMetallicFactor(spec.metallic)
        .setRoughnessFactor(spec.roughness)
        .setDoubleSided(false);
      if (spec.alpha) { nm.setAlphaMode(spec.alpha); }
      if (spec.emissive) nm.setEmissiveFactor(spec.emissive);
      buckets.set(kind, nm);
    }
  }
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const old = p.getMaterial();
    if (old && kindOf(old) === "drop") { p.dispose(); continue; }
    p.setMaterial(buckets.get(kindOf(old)) || buckets.get("body"));
  }
  // every original material, and every texture with it, is now unreferenced
  for (const mat of root.listMaterials()) if (![...buckets.values()].includes(mat)) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();

  // ---- 2. simplify.
  //
  // `weld` compares every attribute, so a model with per-face normals has two
  // vertices per triangle and nothing to weld -- and meshopt then sees a
  // disconnected soup and collapses nothing at all, silently ignoring the ratio.
  // That is exactly what the fighter was: 1.24M triangles, 2.0 verts each, and a
  // simplify pass that did nothing. Dropping normals and UVs first lets it weld
  // on position, and we do not need either: the models are baked to flat colours
  // and the house style is flat shading anyway.
  if (opts.stripAttrs) {
    for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) {
      pr.setAttribute("NORMAL", null);
      pr.setAttribute("TEXCOORD_0", null);
      pr.setAttribute("TEXCOORD_1", null);
      pr.setAttribute("TANGENT", null);
      pr.setAttribute("COLOR_0", null);
    }
  }
  // `bake` (v159): every node's transform goes INTO its vertices, so the model the
  // game loads is all identity nodes. The Corvette's wheels carry a 1.5-degree
  // camber on their nodes, and this three.js build boxes a rotated mesh by its own
  // box (Box3's precise flag is ignored): the body was stood 9 cm off the road on
  // its loose box. A mesh two nodes share is copied first, or baking one moves both.
  if (opts.bake) {
    await doc.transform(flatten());
    for (const n of root.listNodes()) {
      const mesh = n.getMesh(); if (!mesh) continue;
      if (mesh.listParents().filter((p) => p.propertyType === "Node").length > 1) {
        const m2 = mesh.clone();
        for (const p of m2.listPrimitives()) {
          for (const sem of p.listSemantics()) p.setAttribute(sem, p.getAttribute(sem).clone());
          if (p.getIndices()) p.setIndices(p.getIndices().clone());
        }
        n.setMesh(m2);
      }
    }
    for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
  }
  await doc.transform(
    dedup(),
    flatten(),
    join(),
    weld({ tolerance: opts.weld ?? 0.0001 }),
  );
  const welded = countTris();
  const ratio = Math.min(1, targetTris / Math.max(1, welded));
  await doc.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio, error: opts.error ?? 0.008, lockBorder: false }),
    // Normals are NOT recomputed here. They must be rebuilt after simplifying --
    // the simplifier keeps the normal of every vertex it spares while moving the
    // surface between them, which showed as creases down the car's doors and a
    // body a shade darker than the source everywhere. But this library's
    // normals() writes FLAT ones and unwelds to do it, which tripled the file and
    // is the wrong answer for a car anyway. The game recomputes smooth normals
    // when it loads the model instead (TUNE.models.car.smooth) -- see models.js.
    prune(),
    dedup(),
  );

  await io.write(outPath, doc);
  const after = { tris: countTris(), bytes: fs.statSync(outPath).size,
                  mats: root.listMaterials().length, tex: root.listTextures().length };
  console.log(`\n${name}`);
  console.log(`  materials bucketed: ${JSON.stringify(report)}`);
  console.log(`  triangles ${before.tris.toLocaleString()} -> welded ${welded.toLocaleString()} -> ${after.tris.toLocaleString()}  (target ${targetTris.toLocaleString()}, ratio ${ratio.toFixed(4)})`);
  console.log(`  size ${(before.bytes/1048576).toFixed(1)} MB -> ${(after.bytes/1048576).toFixed(2)} MB`);
  console.log(`  materials ${before.mats} -> ${after.mats}   textures ${before.tex} -> ${after.tex}`);
  return after;
}

// ---------------------------------------------------------------------------
// THE AIRLINERS ARE A DIFFERENT JOB, AND THE LIVERY IS WHY.
//
// Everything above bakes materials down to a six-colour palette and throws every
// texture away, because a Model Y and an F-35 are shapes he recognises and the
// house style is flat. The airliners are the opposite: he recognises them by the
// TAIL. A grey A350 and a grey 777 are the same aeroplane to a four-year-old, so
// the livery is the whole point and nothing here may flatten it.
//
// So this path keeps materials and textures and pays for them instead:
//
//   * NO `flatten()` AND NO `join()`. Both collapse the node hierarchy, and the
//     hierarchy is load-bearing here -- the landing gear and the engines have to
//     stay their own nodes so the gear can retract and roll and the heat haze
//     can anchor to a nacelle. Merging them into one mesh would save a draw call
//     and cost the gear.
//   * NORMALS AND TANGENTS GO, UVs STAY. Dropping normals is what lets `weld`
//     join on position and gives the simplifier a connected surface (the lesson
//     the fighter taught); dropping TEXCOORD_0 would take the livery with it.
//     The game rebuilds smooth normals on load, as it does for the car.
//   * THE TEXTURES ARE THE FILE. The A350 is ten megabytes and twenty thousand
//     triangles -- practically all of it is one 4096x4096 PNG. Resized to 1024
//     and re-encoded as JPEG it is a fraction of that and still legibly Delta
//     from the cockpit, which is the only distance that matters.
// ---------------------------------------------------------------------------
async function buildLivery(srcFile, outName, targetTris, opts = {}) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const inPath = path.join(SRC, srcFile);
  const outPath = path.join(OUT, `${outName}.glb`);
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  const countTris = () => {
    let t = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      t += idx ? idx.getCount() / 3 : (p.getAttribute("POSITION")?.getCount() || 0) / 3;
    }
    return Math.round(t);
  };
  const before = { tris: countTris(), bytes: fs.statSync(inPath).size,
                   mats: root.listMaterials().length, tex: root.listTextures().length,
                   nodes: root.listNodes().length };

  for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) {
    pr.setAttribute("NORMAL", null);
    pr.setAttribute("TANGENT", null);
    pr.setAttribute("COLOR_0", null);
  }
  await doc.transform(dedup(), weld({ tolerance: opts.weld ?? 0.0001 }));
  const welded = countTris();
  const ratio = Math.min(1, targetTris / Math.max(1, welded));
  if (ratio < 1) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: opts.error ?? 0.004, lockBorder: true }));
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [opts.tex ?? 1024, opts.tex ?? 1024], quality: opts.quality ?? 82 }),
    prune(), dedup(),
  );

  await io.write(outPath, doc);
  const after = { tris: countTris(), bytes: fs.statSync(outPath).size,
                  mats: root.listMaterials().length, tex: root.listTextures().length,
                  nodes: root.listNodes().length };
  console.log(`\n${outName}  (livery kept)`);
  console.log(`  triangles ${before.tris.toLocaleString()} -> welded ${welded.toLocaleString()} -> ${after.tris.toLocaleString()} (target ${targetTris.toLocaleString()})`);
  console.log(`  size ${(before.bytes/1048576).toFixed(1)} MB -> ${(after.bytes/1048576).toFixed(2)} MB`);
  console.log(`  materials ${before.mats} -> ${after.mats}   textures ${before.tex} -> ${after.tex}   nodes ${before.nodes} -> ${after.nodes}`);
  const named = root.listNodes().map(n => n.getName()).filter(n => /gear|wheel|engine|nacelle|fan|spoiler/i.test(n));
  console.log(`  nodes kept for the rig: ${named.length ? named.join(", ") : "(none matched)"}`);
  return after;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await MeshoptSimplifier.ready;
  const only = process.env.ONLY;
  // The car's numbers are NOT the fighter's, and the reason is the shape.
  //
  // At 24k triangles with the default 0.008 error bound the car came back
  // dented -- it looked like it had been in a crash. That bound is RELATIVE to
  // the model, so on a 9.2 m car it let the simplifier move a panel by seven
  // centimetres, while the surviving vertices kept the normals of a surface
  // that was no longer there. A car body is one big smooth reflection and shows
  // every millimetre of that; the fighter is faceted by design and hides it,
  // which is why the same settings flattered one and wrecked the other.
  //
  // Rendering the unsimplified 346k car proved the source was clean, so this is
  // decimation damage and nothing else. 60k with a 0.001 bound is smooth again
  // at 1.4 MB, and it is one draw call either way.
  const carTris  = +(process.env.CAR_TRIS  || 60000);
  const carError = +(process.env.CAR_ERROR || 0.001);
  if (!only || only === "car") await build("car", carTris, { error: carError });
  if (!only || only === "fighter") await build("fighter", 22000, { stripAttrs: true, weld: 0.001 });
  // v146: the Cybertruck. A 7.4k-triangle source, and 5.8k of that is tyre
  // tread; the body is 251 flat facets the simplifier must leave alone. So the
  // fighter's path -- normals stripped, faceted is the whole look -- with a tight
  // error bound that takes the tread down and cannot move a crease. Its eight
  // materials are named "Material".."Material.007", so they are mapped by hand
  // from a render with each one painted its own colour. NO LETTERING: the file
  // has no textures, and none of its pieces is a word -- the smallest are the
  // door handles, the charge-port door, rim spokes and lamps (rendered close).
  if (!only || only === "cybertruck") await build("cybertruck", 4500, {
    src: "tesla_cybertruck.glb", stripAttrs: true, weld: 0.0005, error: 0.002, palette: CYBER_PALETTE,
    // The bed's cover is in the same dark gloss as the glass, and from the chase
    // camera -- behind and above, where he sees it most -- that turned the whole
    // truck into a black box. Readability beats realism: the cover is steel, and
    // its dark rails (Material.003) still edge it. It is the one piece of
    // Material.002 behind the cabin (z < 0.2) and above the tail (y > 1.0).
    regions: [{ name: "cover", from: "Material.002", test: (x, y, z) => z < 0.2 && y > 1.0 }],
    materials: {
      "cover": "body", "Material": "body", "Material.001": "tint", "Material.002": "tint", "Material.003": "trim",
      "Material.004": "lamp", "Material.005": "tail", "Material.006": "tyre", "Material.007": "rim",
    },
  });
  // v159: the Corvette. A 400k-triangle source with a full cabin and engine bay,
  // 47 textures and the maker's names on it. What goes: the cabin, the engine
  // (all but its four tail pipes, which the rocket booster's flames come out of),
  // the badges, the plate, the calliper badges -- every texture with them, so no
  // painted word survives -- and, in the black trim, every piece under 16 cm,
  // which is the raised lettering across the tail and on the doors and the two emblems, nose and tail (a word
  // moulded into the trim is still a word once it is baked flat). The glass is
  // OPAQUE, as on the Cybertruck: with the cabin gone, see-through glass shows a
  // hole. Source units are 100 m (the car is 0.0465 long), nose at +Z.
  const CV = "cChevrolet_CorvetteC8ZR1_2024";
  if (!only || only === "corvette") await build("corvette", 22000, {
    src: "2025_chevrolet_corvette_zr1.glb", bake: true, stripAttrs: true, weld: 0.0002, error: 0.0015, palette: CORVETTE_PALETTE,
    islands: { materials: ["Coloured_Material", "Grille", "SpecularTint", "Textured"], below: 0.0016, weld: 0.000002 },
    regions: [
      // the four tail pipes: the Engine's triangles right at the tail and low
      { name: "pipes", from: CV + "EngineA_Material1", test: (x, y, z) => z < -0.0212 && y < 0.0055 },
      // the light material is both ends: the back half of it is the tail lamps
      { name: "taillamp", from: CV + "LightA_Material1", test: (x, y, z) => z < -0.012 },
    ],
    materialsBy: [
      ["pipes", "pipe"], ["taillamp", "tail"],
      ["Paint_Material", "body"], ["red_glass", "tail"], ["LightA_Material", "lamp"],
      ["Window_Material", "tint"],
      ["Wheel1A_3DCarbon2", "rim"], ["Wheel1A_3D_3DWheel1A", "tyre"],
      ["Carbon1_Material", "trim"], ["Base_Material", "trim"], ["Coloured_Material", "trim"], ["Grille", "trim"],
      ["SpecularTint", "trim"], ["TexturedA", "trim"], ["CalliperA_Zone", "trim"], ["cphong1", "trim"],
      ["EngineA_Material", "drop"], ["InteriorA_Material", "drop"], ["InteriorTilling", "drop"], ["emis", "drop"],
      ["BadgeA_Material", "drop"], ["ManufacturerPlate", "drop"], ["CalliperBadge", "drop"],
    ],
  });
  // The two airliners: livery kept, hierarchy kept, textures paid for.
  if (!only || only === "airlinerDelta")
    await buildLivery("delta_airlines_airbus_a350-900.glb", "airliner-delta", 20000, { tex: 1024 });
  if (!only || only === "airlinerEmirates")
    await buildLivery("emirates_boeing_777-200.glb", "airliner-emirates", 20000, { tex: 1024 });
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
