"use strict";
// WORKING RULES
// Textures. Two atlases, both made by scripts/make_atlas.py and both sliced at
// load into texture arrays, so every tile repeats with real mipmaps and every
// painted material samples the same two textures -- no seams, no extra draws:
//
//   textures/atlas.webp         16 x 512 px MACRO tiles: the layout of a surface
//                               (windows, lane paint, a container's frame, deck
//                               plates), each at the real size ART_LAYER_INFO says
//   textures/atlas-detail.webp  16 x 256 px DETAIL tiles: pure material grain
//                               (brick courses, aggregate, corrugation, grit) at
//                               1-2 m, laid over the macro tile close up
//
// TILES REPEAT AT A REAL-WORLD SIZE, set once per atlas slot in ART_LAYER_INFO
// (asphalt 8 m, a facade 12 x 14 m = four 3 m bays by four 3.5 m floors, a
// container side 12 x 5 m), never as a fraction of whatever mesh they land on.
// A material may scale its slot (`mul`) only when the thing itself is scaled,
// like the cruise ship's deck-high windows.
//
// The palette sets the hue; the texture carries the detail. A tile is divided by
// its own mean and multiplied onto the material's colour, then its contrast is
// raised by the slot's `gain` -- so a slate tower is still slate, and a dark
// palette road still shows its grain and its paint. Detail is luminance only.
//
// Box-mapped in the shader: a face pointing up takes world XZ, a wall takes
// along-the-wall and up. The city GLBs and the carriageway bring their own UVs
// for the macro tile (preset "city", "road"); detail is always box-mapped in
// metres, so it never stretches. Macro fades with `fade`, detail by 220 m.
//
// Glass (the macro atlas's alpha) takes a sky reflection, is the only sun glint
// on a building, and lights up at night.
//
// THE READABILITY RULE: nothing he acts on is ever textured -- reticles, pad
// rings, catch-zone lights, signal heads, the fire, the scoop water, the buttons.
// They are MeshBasic and nothing here touches a material it is not handed. Paint
// is opt-in, one call per material, at the place that builds it.
//
// WebGL2 only (texture arrays). Without it, or before the atlases have arrived,
// `artOn` is 0 and every painted material draws exactly as it did before.
// ---------------------------------------------------------------------------

// The macro atlas slots, in make_atlas.py's order. That order is load-bearing.
const ART_LAYER = {
  glass: 0, brick: 1, office: 2, road: 3, concrete: 4, grass: 5, scrub: 6, sand: 7,
  mars: 8, moon: 9, corrugated: 10, container: 11, water: 12, asphalt: 13, roof: 14, deck: 15,
};
// The detail atlas slots (make_atlas.py's DETAIL list).
const ART_DETAIL = {
  brick: 0, concrete: 1, asphalt: 2, ribs: 3, nonskid: 4, grass: 5, sand: 6, dirt: 7,
  pebbles: 8, dust: 9, gravel: 10, stucco: 11, plate: 12,
};

// Per macro slot: [metres per tile u, v], contrast gain, and its detail:
// [detail slot, metres per detail tile, strength]. The road's u is the
// carriageway (17.5 m: two 7.5 m lanes and a shoulder) and it is UV-mapped.
const ART_LAYER_INFO = {
  glass:      { size: [12, 14],   gain: 1.0, detail: null },
  brick:      { size: [12, 14],   gain: 1.2, detail: ["brick", 2, 0.95] },
  office:     { size: [12, 14],   gain: 1.2, detail: ["concrete", 2, 0.6] },
  road:       { size: [17.5, 12], gain: 1.5, detail: ["asphalt", 2, 0.8] },
  concrete:   { size: [4, 4],     gain: 1.4, detail: ["concrete", 2, 0.7] },
  grass:      { size: [16, 16],   gain: 2.4, detail: ["grass", 2, 0.9] },
  scrub:      { size: [16, 16],   gain: 2.1, detail: ["dirt", 2, 0.9] },
  sand:       { size: [12, 12],   gain: 2.2, detail: ["sand", 2, 0.8] },
  mars:       { size: [16, 16],   gain: 1.8, detail: ["pebbles", 2, 0.9] },
  moon:       { size: [16, 16],   gain: 1.8, detail: ["dust", 2, 0.9] },
  corrugated: { size: [4, 4],     gain: 1.4, detail: ["ribs", 1, 0.6] },
  container:  { size: [12, 5],    gain: 1.5, detail: ["ribs", 1, 0.7] },
  water:      { size: [1, 1],     gain: 1.0, detail: null },
  asphalt:    { size: [8, 8],     gain: 1.5, detail: ["asphalt", 2, 0.8] },
  roof:       { size: [8, 8],     gain: 1.3, detail: ["gravel", 1, 0.7] },
  deck:       { size: [8, 8],     gain: 1.5, detail: ["nonskid", 1, 0.8] },
};
const ART_DETAIL_FADE = [25, 220];

// wall / top: macro slots. fade: [start, gone, strength]. glass: the alpha glaze
// is honoured. uv: the mesh brings macro UVs. attr: a per-vertex slot
// (`artLayerA`). world: walls mapped in world space (terrain, planets).
// mul: scales the slot's real size, for things that are themselves scaled.
const ART_PRESETS = {
  glass:      { wall: "glass", top: "roof", glass: 1, fade: [600, 1700, 1] },
  brick:      { wall: "brick", top: "roof", glass: 1, fade: [600, 1700, 1] },
  office:     { wall: "office", top: "roof", glass: 1, fade: [600, 1700, 1] },
  concrete:   { wall: "concrete", top: "concrete", fade: [500, 1500, 1] },
  roof:       { wall: "concrete", top: "roof", fade: [500, 1500, 1] },
  asphalt:    { wall: "asphalt", top: "asphalt", fade: [500, 1500, 1] },
  road:       { wall: "road", top: "road", uv: true, fade: [500, 1500, 1] },
  grass:      { wall: "grass", top: "grass", world: true, fade: [500, 1500, 1] },
  corrugated: { wall: "corrugated", top: "corrugated", fade: [500, 1500, 1] },
  container:  { wall: "container", top: "container", offset: [0.5, 0], fade: [600, 1600, 1] },
  deck:       { wall: "deck", top: "deck", fade: [600, 1600, 1] },
  hull:       { wall: "deck", top: "deck", mul: [3, 3], fade: [700, 1700, 1] },   // ship plates are big
  mars:       { wall: "mars", top: "mars", world: true, fade: [400, 1400, 1] },
  moon:       { wall: "moon", top: "moon", world: true, fade: [400, 1400, 1] },
  terrain:    { attr: true, world: true, fade: [400, 1400, 1] },
  city:       { uv: true, attr: true, glass: 1, fade: [600, 1700, 1] },
  vehicle:    { attr: true, glass: 1, fade: [300, 1000, 1] },
};

const art = {
  ready: false, failed: false, painted: 0,
  shared: {
    artTex: { value: null },
    artDetail: { value: null },
    artOn: { value: 0 },
    artMeans: { value: [] },
    artLayerInfo: { value: [] },
    artDetailInfo: { value: [] },
    artDetailFade: { value: new THREE.Vector2(ART_DETAIL_FADE[0], ART_DETAIL_FADE[1]) },
    artNight: { value: 0 },
    artSkyTop: { value: new THREE.Color(TUNE.skyTopColor) },
    artSkyLow: { value: new THREE.Color(TUNE.skyHorizonColor) },
  },
  waterNormal: null,
};
for (const [name, slot] of Object.entries(ART_LAYER)) {
  const I = ART_LAYER_INFO[name];
  art.shared.artMeans.value[slot] = new THREE.Vector3(1, 1, 1);
  art.shared.artLayerInfo.value[slot] = new THREE.Vector4(I.size[0], I.size[1], I.gain, 0);
  // w: the detail tile's mean luminance, filled in when it loads
  art.shared.artDetailInfo.value[slot] = I.detail
    ? new THREE.Vector4(ART_DETAIL[I.detail[0]], I.detail[1], I.detail[2], 0.6)
    : new THREE.Vector4(0, 1, 0, 0.6);
}
function artStandIn() {
  // a 1x1 white stand-in so each sampler is always bound to something
  const t = new THREE.DataTexture2DArray(new Uint8Array([255, 255, 255, 255]), 1, 1, 1);
  t.format = THREE.RGBAFormat; t.needsUpdate = true;
  return t;
}
art.shared.artTex.value = artStandIn();
art.shared.artDetail.value = artStandIn();

const ART_VERT_PARS = `
varying vec3 vArtW;
varying vec3 vArtP;
#if defined(ART_ATTR) || defined(ART_INST)
flat varying float vArtL;
#endif
#ifdef ART_ATTR
attribute float artLayerA;
#endif
#ifdef ART_INST
attribute float artLayerI;
#endif
#ifdef ART_UV
varying vec2 vArtUv;
#endif
`;
const ART_VERT_MAIN = `
{
  vec4 aw = vec4(transformed, 1.0);
  mat3 ar = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    aw = instanceMatrix * aw;
    ar = ar * mat3(instanceMatrix);
  #endif
  vArtW = (modelMatrix * aw).xyz;
  vArtP = ar * transformed;
  #ifdef ART_ATTR
    vArtL = artLayerA;
  #endif
  #ifdef ART_INST
    vArtL = artLayerI;
  #endif
  #ifdef ART_UV
    vArtUv = uv;
  #endif
}
`;
const ART_FRAG_PARS = `
uniform highp sampler2DArray artTex;
uniform highp sampler2DArray artDetail;
uniform float artOn;
uniform vec3 artMeans[16];
uniform vec4 artLayerInfo[16];
uniform vec4 artDetailInfo[16];
uniform vec2 artDetailFade;
uniform vec2 artLayer;
uniform vec2 artMul;
uniform vec2 artOffset;
uniform vec3 artFade;
uniform float artGlass;
uniform float artNight;
uniform vec3 artSkyTop;
uniform vec3 artSkyLow;
varying vec3 vArtW;
varying vec3 vArtP;
#if defined(ART_ATTR) || defined(ART_INST)
flat varying float vArtL;
#endif
#ifdef ART_UV
varying vec2 vArtUv;
#endif
`;
// Runs after specularmap_fragment: diffuseColor already carries the material,
// vertex and instance colours, and nothing has been lit yet.
const ART_FRAG_MAIN = `
if (artOn > 0.0) {
  vec3 an = normalize(cross(dFdx(vArtW), dFdy(vArtW)));
  bool artTop = abs(an.y) > 0.7;
  #ifdef ART_WORLD
    vec3 ap = vArtW;
    float vy = vArtW.y;
  #else
    vec3 ap = vArtP;
    #ifdef USE_INSTANCING
      float vy = vArtP.y;            // an instance's own height: floors line up with its base
    #else
      float vy = vArtW.y;
    #endif
  #endif
  // this face, in metres: world XZ on a top, along-the-wall and up on a wall
  vec2 at = normalize(vec2(-an.z, an.x) + 1e-5);
  vec2 mw = artTop ? vArtW.xz : vec2(dot(ap.xz, at), vy);
  float lay = artTop ? artLayer.y : artLayer.x;
  #ifdef ART_ATTR
    lay = vArtL;
  #endif
  #ifdef ART_INST
    if (!artTop) lay = vArtL;
  #endif
  int li = int(lay + 0.5);
  vec4 info = artLayerInfo[li];
  #ifdef ART_UV
    vec2 auv = vArtUv;
  #else
    vec2 auv = mw / (info.xy * artMul) + (artTop ? vec2(0.0) : artOffset);
  #endif
  vec4 atx = texture(artTex, vec3(auv, lay));
  #ifdef ART_WORLD
    // open ground is seen by the square kilometre: a second read of the same
    // tile, 2.7x larger and turned, keeps the repeat from showing as a grid
    atx.rgb = mix(atx.rgb, texture(artTex, vec3(auv.yx * 0.37 + 0.31, lay)).rgb, 0.5);
  #endif
  vec3 det = atx.rgb / max(artMeans[li], vec3(0.03));
  det = max(vec3(0.0), 1.0 + (det - 1.0) * info.z);
  float adist = distance(vArtW, cameraPosition);
  float ak = artOn * artFade.z * (1.0 - smoothstep(artFade.x, artFade.y, adist));
  float glz = artOn * artGlass * clamp((1.0 - atx.a) * 2.008, 0.0, 1.0);
  // the grain, close up: luminance only, never on glass
  vec4 dinf = artDetailInfo[li];
  float dl = dot(texture(artDetail, vec3(mw / dinf.y, dinf.x)).rgb, vec3(0.299, 0.587, 0.114)) / max(dinf.w, 0.05);
  float dk = dinf.z * (1.0 - smoothstep(artDetailFade.x, artDetailFade.y, adist)) * (1.0 - glz);
  det *= max(0.0, 1.0 + (dl - 1.0) * dk);
  diffuseColor.rgb *= max(vec3(0.0), mix(vec3(1.0), det, ak));
  specularStrength *= mix(1.0, glz, artGlass);
  if (glz > 0.01) {
    vec3 av = normalize(cameraPosition - vArtW);
    vec3 ar = reflect(-av, an);
    float fres = 0.3 + 0.7 * pow(1.0 - abs(dot(av, an)), 4.0);
    vec3 sky = ar.y > 0.0 ? mix(artSkyLow, artSkyTop, sqrt(ar.y)) : artSkyLow * 0.5;
    totalEmissiveRadiance += sky * glz * fres * 0.5 * (1.0 - artNight * 0.8);
    diffuseColor.rgb *= 1.0 - glz * 0.4;
    vec2 cell = floor(auv * (lay < 0.5 ? vec2(8.0, 4.0) : vec2(4.0, 4.0)));
    // a curtain wall is all glass: light fewer of its panes or the tower is one lamp
    float lit = step(lay < 0.5 ? 0.66 : 0.42, fract(sin(dot(cell + lay * 7.0, vec2(12.9898, 78.233))) * 43758.5453));
    totalEmissiveRadiance += vec3(1.0, 0.84, 0.52) * glz * artNight * lit;
  }
}
`;

function artOnBeforeCompile(shader) {
  const a = this.userData.art;
  Object.assign(shader.uniforms, art.shared, a.uniforms);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\n" + ART_VERT_PARS)
    .replace("#include <project_vertex>", "#include <project_vertex>\n" + ART_VERT_MAIN);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\n" + ART_FRAG_PARS)
    .replace("#include <specularmap_fragment>", "#include <specularmap_fragment>\n" + ART_FRAG_MAIN);
}

// Paint a lit material (Lambert or Phong) with a preset. Returns the material.
// opts: { mul, fade, instLayer } -- mul scales the slots' real sizes (for a
// thing that is itself scaled); instLayer: the geometry carries a per-instance
// `artLayerI` for its walls (the streamed towns).
function artPaint(mat, kind, opts) {
  if (!mat || !(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return mat;
  const P = ART_PRESETS[kind];
  if (!P) throw new Error("artPaint: no preset " + kind);
  const o = opts || {};
  const mul = o.mul || P.mul || [1, 1];
  const fd = o.fade || P.fade;
  const u = {
    artLayer: { value: new THREE.Vector2(ART_LAYER[P.wall] || 0, ART_LAYER[P.top] || 0) },
    artMul: { value: new THREE.Vector2(mul[0], mul[1]) },
    artOffset: { value: new THREE.Vector2((P.offset || [0, 0])[0], (P.offset || [0, 0])[1]) },
    artFade: { value: new THREE.Vector3(fd[0], fd[1], fd[2]) },
    artGlass: { value: P.glass || 0 },
  };
  mat.userData.art = { kind, uniforms: u };
  mat.defines = Object.assign({}, mat.defines || {});
  if (P.uv) mat.defines.ART_UV = "";
  if (P.attr) mat.defines.ART_ATTR = "";
  if (P.world) mat.defines.ART_WORLD = "";
  if (o.instLayer) mat.defines.ART_INST = "";
  mat.onBeforeCompile = artOnBeforeCompile;
  mat.needsUpdate = true;
  art.painted++;
  return mat;
}

// A painted copy, cached per colour + preset -- for builders that share
// materials by colour, so painting one never paints every user of that colour.
const artMatCache = {};
function artLam(color, kind) {
  const k = color + ":" + kind;
  if (!artMatCache[k]) artMatCache[k] = artPaint(new THREE.MeshLambertMaterial({ color }), kind);
  return artMatCache[k];
}
function artPhong(color, kind, shininess, spec) {
  const k = "p" + color + ":" + kind + ":" + shininess;
  if (!artMatCache[k]) {
    artMatCache[k] = artPaint(new THREE.MeshPhongMaterial({
      color, shininess: shininess || 0, specular: spec === undefined ? (shininess ? 0x3a4048 : 0x000000) : spec,
    }), kind);
  }
  return artMatCache[k];
}

// Which ground tile a terrain face gets. Same masks as terrainColorAt, so the
// tile changes where the colour does.
function artTerrainLayer(hy, wx, wz, vlw) {
  if (hy < TUNE.waterLevel + 1.4) return ART_LAYER.sand;
  // v147: the valley -- snow and rock alike take the asphalt tile's soft grey mottle (the colour, from the palette, says which)
  if ((vlw === undefined ? vlWeight(wx, wz) : vlw) > 0.5) return ART_LAYER.asphalt;
  if (desertMask(wz) > 0.45) return ART_LAYER.sand;
  if (canyonT(wz) > 0.25) return ART_LAYER.scrub;
  if (plainsMask(wz) > 0.35) return ART_LAYER.scrub;
  if (mountainGauss(wz) > 0.3 && hy > 30) return ART_LAYER.scrub;
  const t = (hy - TUNE.colorLowHeight) / (TUNE.colorHighHeight - TUNE.colorLowHeight);
  return t > 0.8 ? ART_LAYER.scrub : ART_LAYER.grass;
}

// Per frame: the glass reflects the sky it is under, and the lit windows
// follow the night mood.
function artUpdate() {
  if (!art.ready) return;
  const s = art.shared;
  s.artNight.value = (typeof state !== "undefined" && state.nightF) || 0;
  s.artSkyTop.value.copy(skyUniforms.topColor.value);
  s.artSkyLow.value.copy(skyUniforms.horizonColor.value);
}

// Slice an N x N atlas image into one texture array. Image rows run top-down;
// texture v runs bottom-up. Calls back with (data, per-slot mean [r, g, b]).
function artSlice(img, T, N) {
  const A = T * N;
  const c = document.createElement("canvas"); c.width = c.height = A;
  const cx = c.getContext("2d");
  cx.drawImage(img, 0, 0, A, A);
  const src = cx.getImageData(0, 0, A, A).data;
  const data = new Uint8Array(T * T * 4 * N * N);
  const means = [];
  for (let l = 0; l < N * N; l++) {
    const r = Math.floor(l / N), col = l % N;
    let sr = 0, sg = 0, sb = 0;
    for (let y = 0; y < T; y++) {
      const so = ((r * T + (T - 1 - y)) * A + col * T) * 4;
      data.set(src.subarray(so, so + T * 4), (l * T * T + y * T) * 4);
      for (let x = 0; x < T * 4; x += 16) { sr += src[so + x]; sg += src[so + x + 1]; sb += src[so + x + 2]; }
    }
    const n = T * T / 4 * 255;
    means.push([sr / n, sg / n, sb / n]);
  }
  const tex = new THREE.DataTexture2DArray(data, T, T, N * N);
  tex.format = THREE.RGBAFormat;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return { tex, data, means };
}

function artFetch(src, done) {
  const img = new Image();
  img.onerror = () => { art.failed = true; };
  img.onload = () => {
    try { done(img); } catch (e) { art.failed = true; console.warn("art: atlas failed", src, e); }
  };
  img.src = src;
}

// Called once from the end of scene.js, when the renderer and the sea exist.
// Nothing is switched on until BOTH atlases are in: half a texture set would
// draw every painted surface wrong for a frame.
function artLoad() {
  if (!renderer.capabilities.isWebGL2) { art.failed = true; return; }
  let pending = 2;
  const finish = () => {
    if (--pending > 0 || art.failed) return;
    art.shared.artOn.value = 1;
    art.ready = true;
  };
  artFetch("textures/atlas.webp", (img) => {
    const T = 512, { tex, data, means } = artSlice(img, T, 4);
    means.forEach((m, l) => art.shared.artMeans.value[l].set(m[0], m[1], m[2]));
    art.shared.artTex.value = tex;
    // the sea's ripple comes from the atlas too, anchored exactly as before:
    // the new map shares the old one's offset and repeat, which updateWater drives
    const wl = ART_LAYER.water;
    const wn = new THREE.DataTexture(data.slice(wl * T * T * 4, (wl + 1) * T * T * 4), T, T, THREE.RGBAFormat);
    wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
    wn.magFilter = THREE.LinearFilter;
    wn.minFilter = THREE.LinearMipmapLinearFilter;
    wn.generateMipmaps = true;
    wn.anisotropy = waterNormalTex.anisotropy;
    wn.offset = waterNormalTex.offset;
    wn.repeat = waterNormalTex.repeat;
    wn.needsUpdate = true;
    waterMat.normalMap = wn;
    art.waterNormal = wn;
    finish();
  });
  artFetch("textures/atlas-detail.webp", (img) => {
    const { tex, means } = artSlice(img, 256, 4);
    // each macro slot learns its detail tile's mean luminance, so the grain
    // averages to 1 and never darkens or lightens the surface it sits on
    for (const v of art.shared.artDetailInfo.value) {
      const m = means[Math.round(v.x)];
      v.w = m[0] * 0.299 + m[1] * 0.587 + m[2] * 0.114;
    }
    art.shared.artDetail.value = tex;
    finish();
  });
}
