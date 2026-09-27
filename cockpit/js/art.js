"use strict";
// WORKING RULES
// Textures. One atlas (textures/atlas.webp, made by scripts/make_atlas.py): a
// 4 x 4 grid of seamless 512 px tiles, sliced at load into ONE texture array so
// every tile repeats with real mipmaps and every textured material samples the
// same texture -- one bind, no seams at tile edges, no extra draw calls.
//
// The palette stays the palette. A tile is divided by its own mean colour and
// multiplied onto the material's colour, so it only ever adds DETAIL: a slate
// tower is still slate, a red silo still red. Nothing is re-coloured by this.
//
// Box-mapped, in the shader: a face that points up takes the tile in world XZ,
// a wall takes it along the wall and up. No UVs needed on the old geometry,
// windows stay window-sized however a box is scaled, and the city GLBs are the
// one thing that brings its own UVs (preset "city").
//
// Detail fades out with distance (`fade`): mipmaps stop the shimmer, the fade
// stops a far hillside reading as noise. Glass (the atlas's alpha) takes a sky
// reflection, the only sun glint on a building, and lights up at night.
//
// THE READABILITY RULE: nothing he acts on is ever textured -- reticles, pad
// rings, catch-zone lights, signal heads, the fire, the scoop water, the buttons.
// They are MeshBasic and nothing here touches a material it is not handed. Paint
// is opt-in, one call per material, at the place that builds it.
//
// WebGL2 only (texture arrays). Without it, or before the atlas has arrived,
// `artOn` is 0 and every painted material draws exactly as it did before.
// ---------------------------------------------------------------------------

// The atlas slots, in make_atlas.py's order. That order is load-bearing.
const ART_LAYER = {
  glass: 0, brick: 1, office: 2, road: 3, concrete: 4, grass: 5, scrub: 6, sand: 7,
  mars: 8, moon: 9, corrugated: 10, container: 11, water: 12, asphalt: 13, roof: 14, deck: 15,
};

// wall / top: atlas slots. scale: metres per tile [wall u, wall v, top u, top v].
// fade: [start, gone, strength]. glass: whether the alpha glaze is honoured.
const ART_PRESETS = {
  glass:      { wall: "glass", top: "roof", scale: [12, 14, 16, 16], glass: 1, fade: [450, 1500, 1] },
  brick:      { wall: "brick", top: "roof", scale: [12, 14, 16, 16], glass: 1, fade: [350, 1300, 1] },
  office:     { wall: "office", top: "roof", scale: [12, 14, 16, 16], glass: 1, fade: [400, 1400, 1] },
  concrete:   { wall: "concrete", top: "concrete", scale: [10, 10, 10, 10], fade: [220, 900, 0.9] },
  roof:       { wall: "concrete", top: "roof", scale: [10, 10, 16, 16], fade: [220, 900, 0.9] },
  asphalt:    { wall: "asphalt", top: "asphalt", scale: [14, 14, 14, 14], fade: [180, 800, 0.9] },
  corrugated: { wall: "corrugated", top: "corrugated", scale: [8, 8, 8, 8], fade: [250, 1000, 0.9] },
  container:  { wall: "container", top: "container", scale: [12, 5, 12, 5], offset: [0.5, 0], fade: [260, 1000, 1] },
  deck:       { wall: "deck", top: "deck", scale: [16, 16, 16, 16], fade: [260, 1100, 0.9] },
  mars:       { wall: "mars", top: "mars", scale: [26, 26, 26, 26], world: true, fade: [160, 900, 1] },
  moon:       { wall: "moon", top: "moon", scale: [26, 26, 26, 26], world: true, fade: [160, 900, 1] },
  terrain:    { attr: true, world: true, scale: [26, 26, 26, 26], fade: [140, 820, 0.85] },
  city:       { uv: true, attr: true, glass: 1, fade: [450, 1500, 1] },
};

const art = {
  ready: false, failed: false, painted: 0,
  shared: {
    artTex: { value: null },
    artOn: { value: 0 },
    artMeans: { value: [] },
    artNight: { value: 0 },
    artSkyTop: { value: new THREE.Color(TUNE.skyTopColor) },
    artSkyLow: { value: new THREE.Color(TUNE.skyHorizonColor) },
  },
  waterNormal: null,
};
for (let i = 0; i < 16; i++) art.shared.artMeans.value.push(new THREE.Vector3(1, 1, 1));
{
  // a 1x1 white stand-in so the sampler is always bound to something
  const t = new THREE.DataTexture2DArray(new Uint8Array([255, 255, 255, 255]), 1, 1, 1);
  t.format = THREE.RGBAFormat; t.needsUpdate = true;
  art.shared.artTex.value = t;
}

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
uniform float artOn;
uniform vec3 artMeans[16];
uniform vec2 artLayer;
uniform vec4 artScale;
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
  float lay;
  vec2 auv;
  #ifdef ART_UV
    auv = vArtUv;
    lay = artLayer.x;
  #else
    #ifdef ART_WORLD
      vec3 ap = vArtW;
      float vy = vArtW.y;
    #else
      vec3 ap = vArtP;
      #ifdef USE_INSTANCING
        float vy = vArtP.y;          // an instance's own height: floors line up with its base
      #else
        float vy = vArtW.y;
      #endif
    #endif
    if (artTop) {
      auv = vArtW.xz / artScale.zw;
      lay = artLayer.y;
    } else {
      vec2 t = normalize(vec2(-an.z, an.x) + 1e-5);
      auv = vec2(dot(ap.xz, t) / artScale.x + artOffset.x, vy / artScale.y + artOffset.y);
      lay = artLayer.x;
    }
  #endif
  #ifdef ART_ATTR
    lay = vArtL;
  #endif
  #ifdef ART_INST
    if (!artTop) lay = vArtL;
  #endif
  vec4 atx = texture(artTex, vec3(auv, lay));
  vec3 det = atx.rgb / max(artMeans[int(lay + 0.5)], vec3(0.03));
  float adist = distance(vArtW, cameraPosition);
  float ak = artOn * artFade.z * (1.0 - smoothstep(artFade.x, artFade.y, adist));
  diffuseColor.rgb *= mix(vec3(1.0), det, ak);
  float glz = artOn * artGlass * clamp((1.0 - atx.a) * 2.008, 0.0, 1.0);
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
// opts: { scale, fade, instLayer } -- instLayer: the geometry carries a
// per-instance `artLayerI` for its walls (the streamed towns).
function artPaint(mat, kind, opts) {
  if (!mat || !(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return mat;
  const P = ART_PRESETS[kind];
  if (!P) throw new Error("artPaint: no preset " + kind);
  const o = opts || {};
  const sc = o.scale || P.scale || [10, 10, 10, 10];
  const fd = o.fade || P.fade;
  const u = {
    artLayer: { value: new THREE.Vector2(ART_LAYER[P.wall] || 0, ART_LAYER[P.top] || 0) },
    artScale: { value: new THREE.Vector4(sc[0], sc[1], sc[2], sc[3]) },
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
function artTerrainLayer(hy, wx, wz) {
  if (hy < TUNE.waterLevel + 1.4) return ART_LAYER.sand;
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

// Called once from the end of scene.js, when the renderer and the sea exist.
function artLoad() {
  if (!renderer.capabilities.isWebGL2) { art.failed = true; return; }
  const img = new Image();
  img.onerror = () => { art.failed = true; };
  img.onload = () => {
    try {
      const T = 512, N = 4, A = T * N;
      const c = document.createElement("canvas"); c.width = c.height = A;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, A, A);
      const src = cx.getImageData(0, 0, A, A).data;
      const data = new Uint8Array(T * T * 4 * N * N);
      for (let l = 0; l < N * N; l++) {
        const r = Math.floor(l / N), col = l % N;
        let sr = 0, sg = 0, sb = 0;
        for (let y = 0; y < T; y++) {
          // image rows run top-down; texture v runs bottom-up
          const so = ((r * T + (T - 1 - y)) * A + col * T) * 4;
          const d0 = (l * T * T + y * T) * 4;
          data.set(src.subarray(so, so + T * 4), d0);
          for (let x = 0; x < T * 4; x += 16) { sr += src[so + x]; sg += src[so + x + 1]; sb += src[so + x + 2]; }
        }
        const n = T * T / 4 * 255;
        art.shared.artMeans.value[l].set(sr / n, sg / n, sb / n);
      }
      const tex = new THREE.DataTexture2DArray(data, T, T, N * N);
      tex.format = THREE.RGBAFormat;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
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

      art.shared.artOn.value = 1;
      art.ready = true;
    } catch (e) {
      art.failed = true;
      console.warn("art: atlas failed", e);
    }
  };
  img.src = "textures/atlas.webp";
}
