// ---------------------------------------------------------------------------
// The two hulls: models-src/speedboat.glb and models-src/yacht.glb, turned into
// something a four-year-old's iPad can hold.
//
//   node scripts/build_boats.js            (both)
//   ONLY=yacht node scripts/build_boats.js
//
// Same contract as scripts/build_models.js -- decimate, bake to the house
// palette, strip anything that reads as a word -- but it does NOT classify by
// material NAME, because neither of these files names anything. The speedboat's
// 43 materials are called "pasted__pasted__phongE7"; the yacht has exactly one
// material for the whole ship.
//
// So they are classified by COLOUR instead, and that turns out to be the honest
// way round anyway: a material's base colour is what it looks like, and a name
// is only a guess about what it looks like.
//
//   * the SPEEDBOAT carries its colours in 43 baseColorFactors -- white hull,
//     a red flash, black trim, tinted glass -- so each factor is snapped to the
//     nearest bucket and the material is thrown away.
//   * the YACHT is one material with a 4096x4096 base colour map doing all the
//     work: white hull, teak decks, dark glass. Baking that to a single colour
//     would give a featureless white lozenge, so the texture is SAMPLED instead
//     -- once per triangle, at the UV centroid -- and the mesh is split into one
//     primitive per bucket. The picture survives; the texture does not.
//
// TEXT. The speedboat's only two textures are a "SPEEDBOAT" wordmark decal
// down each flank. This game renders no words anywhere, so they go, and the
// two materials wearing them fall back to hull white.
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dedup, weld, simplify, prune, flatten, join } = require("@gltf-transform/functions");
const { MeshoptSimplifier } = require("meshoptimizer");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "models-src");
const OUT = path.join(ROOT, "cockpit", "models");

// The house palette, in the same shape scripts/build_models.js uses. Metalness
// stays low for the same reason it does there: there is no environment map in
// this game, and a metallic PBR material with nothing to reflect renders black.
const P = TUNE_PALETTE();
function TUNE_PALETTE() {
  // kept in sync with TUNE.palette by eye -- this script does not load the game
  return {
    white: [0.949, 0.957, 0.969], steel: [0.788, 0.808, 0.839], grey: [0.541, 0.576, 0.627],
    slate: [0.235, 0.263, 0.314], ink: [0.122, 0.137, 0.157], night: [0.184, 0.227, 0.282],
    sand: [0.851, 0.761, 0.494], gold: [0.831, 0.655, 0.173], warning: [1.0, 0.824, 0.243],
    red: [0.878, 0.282, 0.243], blue: [0.169, 0.310, 0.690], cyan: [0.373, 0.945, 1.0],
    sea: [0.184, 0.455, 0.722],
  };
}
const mat = (rgb, metallic, roughness, extra) =>
  Object.assign({ base: [rgb[0], rgb[1], rgb[2], 1], metallic, roughness }, extra || {});

// A white hull with one red flash and black trim: bold, and it reads at the
// distance he will usually see it from -- which is the whole test.
const BOAT_PALETTE = {
  hull:   mat(P.white, 0.05, 0.42),
  deck:   mat(P.steel, 0.05, 0.60),
  accent: mat(P.red, 0.05, 0.45),
  amber:  mat(P.warning, 0.0, 0.45),
  trim:   mat(P.grey, 0.18, 0.50),
  dark:   mat(P.ink, 0.0, 0.70),
  teak:   mat(P.sand, 0.0, 0.72),
  glass:  { base: [0.106, 0.145, 0.196, 0.66], metallic: 0.0, roughness: 0.10, alpha: "BLEND" },
  lamp:   mat(P.white, 0.0, 0.30, { emissive: [0.55, 0.58, 0.65] }),
};

// ---------------------------------------------------------------------------
// Colour -> bucket. One function, used both for a material's baseColorFactor
// and for a pixel sampled out of a texture, so the two paths cannot disagree.
//
// It is written as a set of tests in order rather than a nearest-colour search
// on purpose: nearest-colour put the teak decks in "amber" (a signal colour that
// pulses on this game's buttons) and the tinted glass in "dark".
function bucketOf(r, g, b, a) {
  if (a !== undefined && a < 0.92) return "glass";
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx <= 0.001 ? 0 : (mx - mn) / mx;
  if (mx < 0.16) return "dark";                       // black trim, rubber, shadowed inlets
  if (sat < 0.13) {                                   // greys, by value
    if (mx > 0.72) return "hull";
    if (mx > 0.42) return "deck";
    return "trim";
  }
  const hue = hueOf(r, g, b);
  if (hue < 18 || hue >= 345) return "accent";        // red
  // Orange. A signal flash is BOTH saturated and near full brightness; teak is
  // saturated and only three-quarters bright, which is the whole difference
  // between them. Testing saturation alone sent a third of the yacht's decks to
  // the red bucket and gave it a scarlet foredeck.
  if (hue < 50) return (sat > 0.75 && mx > 0.90) ? "accent" : "teak";
  if (hue < 70) return mx > 0.90 ? "amber" : "teak";
  if (hue < 190) return "deck";                       // greens: nothing on either hull is green
  return "glass";                                     // blues: tinted screens and the boot stripe
}
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-6) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
// A glTF baseColorFactor is LINEAR; a PNG is sRGB. The buckets above were
// chosen against sRGB values, so linear factors are converted rather than the
// thresholds being fudged twice.
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// ---------------------------------------------------------------------------
function countTris(root) {
  let t = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    t += idx ? idx.getCount() / 3 : (p.getAttribute("POSITION")?.getCount() || 0) / 3;
  }
  return Math.round(t);
}

function makeBucketMaterials(doc) {
  const made = new Map();
  return (kind) => {
    if (made.has(kind)) return made.get(kind);
    const spec = BOAT_PALETTE[kind] || BOAT_PALETTE.hull;
    const m = doc.createMaterial(kind)
      .setBaseColorFactor(spec.base)
      .setMetallicFactor(spec.metallic)
      .setRoughnessFactor(spec.roughness)
      .setDoubleSided(false);
    if (spec.alpha) m.setAlphaMode(spec.alpha);
    if (spec.emissive) m.setEmissiveFactor(spec.emissive);
    made.set(kind, m);
    return m;
  };
}

// Decode a texture once, small. 512 is far more than a per-triangle centroid
// sample needs and keeps the whole thing in a couple of megabytes.
async function decodeTexture(tex, size) {
  const raw = await sharp(Buffer.from(tex.getImage()))
    .resize(size, size, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  return { data: raw, size };
}
function sampleTexture(img, u, v) {
  const S = img.size;
  const wrap = (t) => { t = t - Math.floor(t); return t; };
  const x = Math.min(S - 1, Math.floor(wrap(u) * S));
  const y = Math.min(S - 1, Math.floor(wrap(1 - v) * S));   // glTF v points down
  const i = (y * S + x) * 4;
  return [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255, img.data[i + 3] / 255];
}

// ---------------------------------------------------------------------------
// The textured path: split one primitive into one primitive per bucket, by
// sampling the base colour map at each triangle's UV centroid.
async function splitByTexture(doc, root, bucketMat, report) {
  const img = new Map();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const src = prim.getMaterial();
      const tex = src && src.getBaseColorTexture();
      const uv = prim.getAttribute("TEXCOORD_0");
      if (!tex || !uv) { prim.setMaterial(bucketMat("hull")); continue; }
      if (!img.has(tex)) img.set(tex, await decodeTexture(tex, 512));
      const tx = img.get(tex);

      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : uv.getCount();
      const groups = new Map();
      const uvA = [0, 0], uvB = [0, 0], uvC = [0, 0];
      for (let t = 0; t < n; t += 3) {
        const ia = idx ? idx.getScalar(t) : t;
        const ib = idx ? idx.getScalar(t + 1) : t + 1;
        const ic = idx ? idx.getScalar(t + 2) : t + 2;
        uv.getElement(ia, uvA); uv.getElement(ib, uvB); uv.getElement(ic, uvC);
        const [r, g, b] = sampleTexture(tx, (uvA[0] + uvB[0] + uvC[0]) / 3, (uvA[1] + uvB[1] + uvC[1]) / 3);
        const kind = bucketOf(r, g, b);
        report[kind] = (report[kind] || 0) + 1;
        let arr = groups.get(kind);
        if (!arr) { arr = []; groups.set(kind, arr); }
        arr.push(ia, ib, ic);
      }
      // the first bucket keeps this primitive; the rest get siblings that share
      // its attribute accessors, so nothing is duplicated but the index buffer
      const kinds = [...groups.keys()];
      for (let k = 1; k < kinds.length; k++) {
        const p2 = doc.createPrimitive().setMaterial(bucketMat(kinds[k]));
        for (const name of prim.listSemantics()) p2.setAttribute(name, prim.getAttribute(name));
        p2.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(groups.get(kinds[k]))));
        mesh.addPrimitive(p2);
      }
      prim.setMaterial(bucketMat(kinds[0]));
      prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(groups.get(kinds[0]))));
    }
  }
}

// The untextured path: each material's own base colour picks its bucket.
function bakeByColour(root, bucketMat, report) {
  const pick = new Map();
  for (const m of root.listMaterials()) {
    const f = m.getBaseColorFactor();
    // a material wearing a texture in THIS file is a decal (the wordmark), and
    // its factor is plain white -- so it falls to the hull, which is right
    const kind = bucketOf(toSrgb(f[0]), toSrgb(f[1]), toSrgb(f[2]), f[3]);
    pick.set(m, kind);
    report[kind] = (report[kind] || 0) + 1;
  }
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const old = p.getMaterial();
    p.setMaterial(bucketMat(pick.get(old) || "hull"));
  }
}

// ---------------------------------------------------------------------------
// Per-model bucket overrides. The classifier is honest about what a colour IS;
// this says what it should BE on this particular hull. There is no teak on a
// speedboat -- the tan band the source paints down its flanks is a boot stripe,
// and in this game's palette a boot stripe is the red flash the picker card
// promises. On the yacht the same bucket really is teak decking.
const REMAP = {
  speedboat: { teak: "accent" },
};

async function build(name, targetTris, opts) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const inPath = path.join(SRC, `${name}.glb`);
  const outPath = path.join(OUT, `${name}.glb`);
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  const before = { tris: countTris(root), bytes: fs.statSync(inPath).size,
                   mats: root.listMaterials().length, tex: root.listTextures().length };
  const extras = root.getAsset().extras || {};

  const remap = REMAP[name] || {};
  const rawMat = makeBucketMaterials(doc);
  const bucketMat = (kind) => rawMat(remap[kind] || kind);
  const report = {};
  if (opts.byTexture) await splitByTexture(doc, root, bucketMat, report);
  else bakeByColour(root, bucketMat, report);

  // every original material, and every texture with it (the wordmark included),
  // is now unreferenced
  const keep = new Set(root.listMaterials().filter((m) => BOAT_PALETTE[m.getName()]));
  for (const m of root.listMaterials()) if (!keep.has(m)) m.dispose();
  for (const t of root.listTextures()) t.dispose();

  // UVs and per-face normals defeat `weld`, exactly as they did on the fighter:
  // nothing welds, meshopt sees a disconnected soup and silently collapses
  // nothing. The models are flat-shaded palette colours now, so neither is
  // wanted; the game recomputes normals on load where a hull needs them smooth.
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    p.setAttribute("TEXCOORD_0", null);
    p.setAttribute("TEXCOORD_1", null);
    p.setAttribute("TANGENT", null);
    p.setAttribute("COLOR_0", null);
    if (opts.stripNormals) p.setAttribute("NORMAL", null);
  }
  await doc.transform(dedup(), flatten(), join(), weld({ tolerance: opts.weld ?? 0.0001 }));
  const welded = countTris(root);
  const ratio = Math.min(1, targetTris / Math.max(1, welded));
  if (ratio < 0.999) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: opts.error ?? 0.004, lockBorder: false }));
  }
  await doc.transform(prune(), dedup());

  // the licence travels with the geometry, as it does for the car and the jet
  root.getAsset().extras = extras;
  await io.write(outPath, doc);
  const after = { tris: countTris(root), bytes: fs.statSync(outPath).size,
                  mats: root.listMaterials().length, tex: root.listTextures().length };
  console.log(`\n${name}`);
  console.log(`  buckets: ${JSON.stringify(report)}`);
  console.log(`  triangles ${before.tris.toLocaleString()} -> welded ${welded.toLocaleString()} -> ${after.tris.toLocaleString()}  (target ${targetTris.toLocaleString()}, ratio ${ratio.toFixed(4)})`);
  console.log(`  size ${(before.bytes / 1048576).toFixed(1)} MB -> ${(after.bytes / 1048576).toFixed(2)} MB`);
  console.log(`  materials ${before.mats} -> ${after.mats}   textures ${before.tex} -> ${after.tex}`);
  console.log(`  licence: ${extras.license || "?"} / ${extras.author || "?"}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await MeshoptSimplifier.ready;
  const only = process.env.ONLY;
  // The speedboat is 96k triangles of deck fittings and comes down hard; the
  // yacht is already an 8.5k low-poly hull and is not simplified at all --
  // decimating it would only cost it the window mullions it is made of.
  if (!only || only === "speedboat") await build("speedboat", 20000, { stripNormals: true, weld: 0.002, error: 0.004 });
  if (!only || only === "yacht") await build("yacht", 25000, { byTexture: true, weld: 0.0006 });
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
