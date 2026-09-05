"use strict";

// ---------------------------------------------------------------------------
// Flat-with-facets, everywhere, in one place. The alternative was chasing a
// couple of hundred material literals across fourteen files and then losing to
// the next one somebody adds. The two lit materials default to flatShading from
// here on; anything that genuinely wants smooth still gets it by asking.
//
// This must run before the first material in the game is built, which is why it
// is the first thing in the first file that builds one.
// ---------------------------------------------------------------------------
for (const name of ["MeshLambertMaterial", "MeshPhongMaterial"]) {
  const Orig = THREE[name];
  const Wrapped = function (params) { return new Orig(Object.assign({ flatShading: true }, params || {})); };
  Wrapped.prototype = Orig.prototype;     // three.js dispatches on .isMeshXMaterial, never instanceof
  THREE[name] = Wrapped;
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(TUNE.skyHorizonColor, TUNE.fogNear, TUNE.fogFar);

// Near plane 0.6 (nothing renders closer: the HUD is DOM) + logarithmic depth
// buffer: with 0.05..6000 the depth buffer had no precision at distance, so
// ground paint, building bases and the water plane z-fought (shimmered).
const camera = new THREE.PerspectiveCamera(TUNE.fov, window.innerWidth / window.innerHeight, 0.6, 6000);
camera.rotation.order = "YXZ";
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TUNE.maxPixelRatio));
// Soft shadows, one tight box that follows him. PCFSoft costs a few taps per lit
// fragment; the map itself is small and only what is near him is ever drawn into it.
renderer.shadowMap.enabled = !!TUNE.light.shadow.on;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft ignores shadow.radius, and costs more for a softness we cannot dial
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.id = "gl";
document.body.appendChild(renderer.domElement);

const skyGeo = new THREE.SphereGeometry(3000, 24, 12);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(TUNE.skyTopColor) },
    horizonColor: { value: new THREE.Color(TUNE.skyHorizonColor) },
    exponent: { value: TUNE.skyCurveExponent }
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      vec3 dir = normalize(vWorldPosition - cameraPosition);
      float h = max(dir.y, 0.0);
      gl_FragColor = vec4(mix(horizonColor, topColor, pow(h, exponent)), 1.0);
    }
  `
});
const skyUniforms = skyMat.uniforms;
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

const hemiLight = new THREE.HemisphereLight(TUNE.hemiSkyColor, TUNE.hemiGroundColor, TUNE.hemiIntensity);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff3d6, TUNE.sunIntensity);
sunLight.position.set(400, 1000, 250);
scene.add(sunLight);
scene.add(sunLight.target);

// ---------------------------------------------------------------------------
// The sun rig. One directional light at a real angle, and one small shadow box
// that rides along with him -- so a shadow costs the same whether he is over an
// empty field or in the middle of the base, and nothing beyond the box is ever
// drawn into the map at all.
// ---------------------------------------------------------------------------
{
  const S = TUNE.light.shadow;
  sunLight.castShadow = !!S.on;
  sunLight.shadow.mapSize.set(S.mapSize, S.mapSize);
  sunLight.shadow.radius = S.softRadius;
  sunLight.shadow.bias = S.bias;
  const sc = sunLight.shadow.camera;
  sc.left = -S.radius; sc.right = S.radius; sc.top = S.radius; sc.bottom = -S.radius;
  // Tight. The light stands depth/2 away and everything worth shadowing is inside
  // the box, so the depth range only has to span the box -- give it 1 to 1530 and
  // the map has no precision left and the ground stipples itself with acne.
  sc.near = Math.max(1, S.depth * 0.5 - S.radius * 2.2);
  sc.far = S.depth * 0.5 + S.radius * 2.2;
  sc.updateProjectionMatrix();
}

let shadowR = TUNE.light.shadow.radius;         // the box resizes to the scale he is working at
const sunDir = new THREE.Vector3(0, 1, 0);      // unit vector FROM the ground TOWARD the sun
const sunFocus = new THREE.Vector3();
const sunTmp = new THREE.Vector3(), sunTmp2 = new THREE.Vector3(), sunTmp3 = new THREE.Vector3();

// Where the sun stands. On Earth it is a fixed bearing; on a sphere it is set
// against the local up, so "low sun, long shadows" means the same thing on Mars
// as it does at home.
function sunDirection(elevDeg, up) {
  const el = elevDeg * DEG, az = TUNE.light.sunAzimDeg * DEG;
  if (!up) return sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  sunTmp.set(0, 1, 0);
  if (Math.abs(up.y) > 0.9) sunTmp.set(1, 0, 0);
  sunTmp2.copy(sunTmp).cross(up).normalize();       // east
  sunTmp3.copy(up).cross(sunTmp2).normalize();      // north
  return sunDir.copy(up).multiplyScalar(Math.sin(el))
    .addScaledVector(sunTmp2, Math.sin(az) * Math.cos(el))
    .addScaledVector(sunTmp3, Math.cos(az) * Math.cos(el))
    .normalize();
}

// Keep the box on what he is actually looking at, and snap it to whole texels --
// without the snap the shadow edges crawl and sparkle as he moves.
// What scale is he working at? A rover on Mars and an airliner on final want
// wildly different boxes, and he is only ever inside one of them.
function shadowRadiusWanted() {
  const S = TUNE.light.shadow;
  if (typeof roverActive === "function" && roverActive()) return S.radiusClose;
  if (typeof marsDroneActive === "function" && marsDroneActive()) return S.radiusClose;
  if (typeof astroActive === "function" && astroActive()) return S.radiusClose;
  if (state.vp && state.vp.heli) return S.radiusMid;
  if (state.phase === "TAXI" || state.phase === "ROLL") return S.radiusMid;
  return S.radius;
}

function updateSunRig() {
  const S = TUNE.light.shadow;
  const want = shadowRadiusWanted();
  if (Math.abs(want - shadowR) > 0.05) {
    shadowR += (want - shadowR) * Math.min(1, S.radiusRate * (1 / 60));
    const sc = sunLight.shadow.camera;
    sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR;
    sc.near = Math.max(1, S.depth * 0.5 - shadowR * 2.2 - 40);
    sc.far = S.depth * 0.5 + shadowR * 2.2 + 40;
    sc.updateProjectionMatrix();
  }
  // the bias has to follow the box: it is a texel-sized offset, not a fixed one
  sunLight.shadow.normalBias = (shadowR * 2 / S.mapSize) * S.normalBiasTexels;
  camera.getWorldDirection(sunTmp);
  sunFocus.copy(camera.position).addScaledVector(sunTmp, shadowR * 0.55);
  const texel = (shadowR * 2) / S.mapSize;
  sunFocus.set(Math.round(sunFocus.x / texel) * texel,
               Math.round(sunFocus.y / texel) * texel,
               Math.round(sunFocus.z / texel) * texel);
  sunLight.target.position.copy(sunFocus);
  sunLight.position.copy(sunFocus).addScaledVector(sunDir, S.depth * 0.5);

  // Only the chunks actually inside the box pay for a shadow lookup. A fragment
  // in a chunk a kilometre away can only ever come back "lit", but it still runs
  // the whole test -- and the ground is most of the screen, so that is the single
  // biggest bill in the pass. Three.js keys the shader on receiveShadow per mesh,
  // so switching it off out there really does buy the cheaper one.
  const reach = shadowR + TUNE.chunkSize;
  for (const m of chunks.values()) {
    const near = Math.abs(m.position.x - sunFocus.x) < reach && Math.abs(m.position.z - sunFocus.z) < reach;
    if (m.receiveShadow !== near) m.receiveShadow = near;
  }
}

// ---------------------------------------------------------------------------
// Light moods. Earth is a warm 44-degree sun with a good blue fill. Mars is
// cold, dim and low -- long shadows, pinkish bounce. The Moon is a hard white
// sun with almost no fill, so its shadows go properly black. Space is unchanged
// bar the fill, and casts nothing: there is no ground out there to catch it.
// Everything crossfades, so crossing from one to another is never a hard cut.
// ---------------------------------------------------------------------------
const lightMood = {
  sun: new THREE.Color(TUNE.light.earth.sun), sunI: TUNE.light.earth.sunI,
  sky: new THREE.Color(TUNE.light.earth.sky), ground: new THREE.Color(TUNE.light.earth.ground),
  hemiI: TUNE.light.earth.hemiI, shadow: 1, elev: TUNE.light.earth.elev,
};
const moodTarget = { sun: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color() };
const moodUp = new THREE.Vector3();

function currentLightEnv() {
  if (typeof rk !== "undefined" && rk && rk.onBody) return rk.onBody.name === "mars" ? "mars" : "moon";
  if (state.spaceF > 0.55) return "space";
  return "earth";
}

function updateLightMood(dt, weatherW, weatherMood) {
  const L = TUNE.light;
  const env = currentLightEnv();
  const M = L[env] || L.earth;
  const k = Math.min(1, L.blend * dt);
  moodTarget.sun.setHex(M.sun); moodTarget.sky.setHex(M.sky); moodTarget.ground.setHex(M.ground);
  lightMood.sun.lerp(moodTarget.sun, k);
  lightMood.sky.lerp(moodTarget.sky, k);
  lightMood.ground.lerp(moodTarget.ground, k);
  lightMood.sunI += (M.sunI - lightMood.sunI) * k;
  lightMood.hemiI += (M.hemiI - lightMood.hemiI) * k;
  lightMood.shadow += (M.shadow - lightMood.shadow) * k;
  lightMood.elev += (M.elev - lightMood.elev) * k;

  // the weather moods still multiply on top: rain really is dimmer
  sunLight.color.copy(lightMood.sun);
  sunLight.intensity = lightMood.sunI * lerp(1, weatherMood.sun, weatherW);
  hemiLight.color.copy(lightMood.sky);
  hemiLight.groundColor.copy(lightMood.ground);
  hemiLight.intensity = lightMood.hemiI * lerp(1, weatherMood.hemi, weatherW);
  // nothing out there to catch a shadow, so do not spend a pass drawing one
  sunLight.castShadow = !!TUNE.light.shadow.on && lightMood.shadow > 0.5;

  // on a sphere the sun is set against the local up, so a low sun means the same
  // thing on Mars as it does at home
  if (env === "mars" || env === "moon") {
    const b = rk.onBody;
    moodUp.set(camera.position.x - b.x, camera.position.y - b.y, camera.position.z - b.z).normalize();
    sunDirection(lightMood.elev, moodUp);
  } else {
    sunDirection(lightMood.elev, null);
  }
}

// Marking things up. Casters are deliberately few: the vehicle he is flying, the
// things he lands on and drives round, and the structures big enough to throw a
// shadow worth seeing. Everything else just receives.
function castsShadow(obj, on) {
  if (!obj) return obj;
  const v = on !== false;
  obj.traverse((o) => { if (o.isMesh) o.castShadow = v; });
  return obj;
}
function receivesShadow(obj, on) {
  if (!obj) return obj;
  const v = on !== false;
  obj.traverse((o) => { if (o.isMesh) o.receiveShadow = v; });
  return obj;
}
function castsAndReceives(obj) { castsShadow(obj); receivesShadow(obj); return obj; }

// ---- the one lit material family -------------------------------------------
// Phong, not Standard: it is a fraction of the cost on a tablet, it lights per
// fragment (so shadows land smoothly on big low-poly faces, which Lambert cannot
// do -- Lambert lights per vertex), and it has the specular we want on metal.
function metalMat(color, shininess, spec) {
  return new THREE.MeshPhongMaterial({
    color, flatShading: true,
    shininess: shininess === undefined ? 42 : shininess,
    specular: spec === undefined ? 0x4a5058 : spec,
  });
}
function mattMat(color) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 0, specular: 0x000000 });
}

const SPACE_TOP = new THREE.Color(0x04050d);
const SPACE_HOR = new THREE.Color(0x0b1024);
// Sky moods for the sky button: sun / rain / snow / night. Night reuses the
// space palette for the dome and stars; rain and snow are grey and pale.
const SKY_MOODS = [
  { top: null, hor: null, fogNear: null, fogFar: null, sun: 1, hemi: 1 },
  { top: new THREE.Color(0x5f6c7a), hor: new THREE.Color(0x9a9ea6), fogNear: 260, fogFar: 950, sun: 0.45, hemi: 0.75 },
  { top: new THREE.Color(0xb3c1cf), hor: new THREE.Color(0xf2f4f7), fogNear: 380, fogFar: 1150, sun: 0.75, hemi: 0.95 },
  { top: new THREE.Color(0x070a18), hor: new THREE.Color(0x1a2240), fogNear: 700, fogFar: 2000, sun: 0.12, hemi: 0.3 },
];
// Precipitation: a box of points that rides with the camera and wraps.
const PRECIP_N = 1400;
const precipGeo = new THREE.BufferGeometry();
const precipPos = new Float32Array(PRECIP_N * 3);
for (let i = 0; i < PRECIP_N; i++) { precipPos[i * 3] = (Math.random() - 0.5) * 220; precipPos[i * 3 + 1] = Math.random() * 120 - 30; precipPos[i * 3 + 2] = (Math.random() - 0.5) * 220; }
precipGeo.setAttribute("position", new THREE.BufferAttribute(precipPos, 3));
// soft round sprite so drops and flakes aren't hard squares
const precipTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.6, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = g; cx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); return t;
})();
const precipMat = new THREE.PointsMaterial({ color: 0xdde8f2, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, map: precipTex, alphaTest: 0.05 });
const precip = new THREE.Points(precipGeo, precipMat);
precip.frustumCulled = false;
scene.add(precip);
const SKY_TOP_BASE = new THREE.Color(TUNE.skyTopColor);
const SKY_HOR_BASE = new THREE.Color(TUNE.skyHorizonColor);

const starsGeo = new THREE.BufferGeometry();
{
  const pts = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random());
    const r = 2700;
    pts[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pts[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.9 + 60;
    pts[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  starsGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
}
const starsMat = new THREE.PointsMaterial({
  color: 0xf2f4f7, size: 2.2, sizeAttenuation: false,
  transparent: true, opacity: 0, fog: false
});
const stars = new THREE.Points(starsGeo, starsMat);
skyDome.add(stars);

const earthMesh = new THREE.Mesh(
  new THREE.SphereGeometry(3200, 32, 24),
  new THREE.MeshBasicMaterial({ color: 0x2a66c9, transparent: true, opacity: 0, fog: false })
);
scene.add(earthMesh);

// A satellite (no living things in this game): gold body, two solar wings, a dish.
const satellite = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 5), metalMat(0xd8b04a, 60, 0x6a5c2a));
  satellite.add(body);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 4), lamSafe(0x1c3d8f));
    wing.position.x = s * 8.5;
    satellite.add(wing);
  }
  const dish = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 12, 1, true), lamSafe(0xf2f4f7));
  dish.position.set(0, 3.4, 0);
  satellite.add(dish);
}
satellite.position.set(420, TUNE.spaceAltitude + 320, -900 * ROUTE_SCALE() || -900);
satellite.visible = false;
scene.add(satellite);

const station = new THREE.Group();
{
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 20, 12), metalMat(0xc9ced6, 55));
  station.add(core);
  for (const sy of [-6.5, 6.5]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 5), metalMat(0x9a9ea6, 48));
    arm.position.y = sy;
    station.add(arm);
    for (const sx of [-10.5, 10.5]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 7.5), lamSafe(0x2b4fb0));
      panel.position.set(sx, sy, 0);
      panel.scale.x = 0.25;   // folded until something docks
      station.add(panel);
      station.userData.panels = station.userData.panels || [];
      station.userData.panels.push(panel);
    }
  }
  // docking port on the core's top: a ring that glows when he is near; window strips that light up when docked
  const portMat = new THREE.MeshBasicMaterial({ color: 0x5ff1ff, transparent: true, opacity: 0.35 });
  const port = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.5, 8, 24), portMat);
  port.rotation.x = Math.PI / 2; port.position.y = 10.4;
  station.add(port);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x2f3a48 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 0.3), lightMat);
    w.position.set(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6); w.rotation.y = -a; station.add(w);
  }
  station.userData.portMat = portMat; station.userData.lightMat = lightMat; station.userData.portY = 10.4;
}
station.position.set(-380, TUNE.rocketTune.gravityFade + 1100, -1400 * (ROUTE_SCALE() || 1));   // above the gravity band so the docking magnet is the only pull
station.visible = false;
scene.add(station);

function lamSafe(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// ---------------------------------------------------------------------------
// The sea. A flat blue plane is the single loudest "this is a toy" signal in
// the game, and the carrier and the burning rig both sit on it.
//
// It stays ONE quad. Rippling real vertices over 8000 units would need a mesh
// dense enough to cost more than everything else in this pass put together, so
// the ripple lives in a tiling normal map that scrolls -- two layers at
// different speeds and scales so it never reads as one sliding sheet. That
// buys a real specular sun path off the actual sun direction for the price of
// a texture lookup.
// ---------------------------------------------------------------------------
const waterNormalTex = (() => {
  const N = 128;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const cx = c.getContext("2d");
  const img = cx.createImageData(N, N);
  // A tileable height field of crossed swells, differenced into a normal map.
  // The frequencies have to be whole numbers for the tile to wrap, but three of
  // them in a row reads as a grid from the air -- so this is six waves running
  // at unrelated angles with unrelated phases, which is enough to stop the eye
  // finding the repeat at any altitude he actually flies at.
  const WAVES = [
    [2, 1, 0.55, 0.0], [1, 3, 0.40, 1.7], [3, 2, 0.30, 3.1],
    [5, 1, 0.18, 5.2], [1, 5, 0.15, 2.4], [4, 4, 0.12, 0.8],
  ];
  const h = (x, y) => {
    const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2;
    let a = 0;
    for (const [fx, fy, amp, ph] of WAVES) a += Math.sin(u * fx + v * fy + ph) * amp;
    return a;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = h((x + 1) % N, y) - h((x - 1 + N) % N, y);
      const dy = h(x, (y + 1) % N) - h(x, (y - 1 + N) % N);
      const s = TUNE.water.bump;
      let nx = -dx * s, ny = -dy * s, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(TUNE.water.repeat, TUNE.water.repeat);
  // without anisotropy the sea crawls with moire wherever it meets the horizon
  t.anisotropy = Math.min(TUNE.water.anisotropy, renderer.capabilities.getMaxAnisotropy());
  return t;
})();

// Water wins ties against shallow shore terrain instead of flickering.
const waterMat = new THREE.MeshPhongMaterial({
  color: TUNE.water.color,
  specular: TUNE.water.specular,
  shininess: TUNE.water.shininess,
  normalMap: waterNormalTex,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
waterMat.normalScale.set(TUNE.water.normalScale, TUNE.water.normalScale);
const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.y = TUNE.waterLevel;
scene.add(waterMesh);

// The second layer: the same map at a different scale and speed, so the surface
// never reads as one sheet sliding past. Driven in updateWater below.
let waterClock = 0;
function updateWater(dt) {
  if (!waterMesh.visible) return;
  waterClock += dt;
  const W = TUNE.water;
  waterNormalTex.offset.set((waterClock * W.driftX) % 1, (waterClock * W.driftY) % 1);
  // The plane follows him, so the texture has to be anchored in the WORLD or the
  // whole sea slides along with the aeroplane and the illusion dies instantly.
  waterNormalTex.offset.x += (waterMesh.position.x / W.tileWorld) % 1;
  waterNormalTex.offset.y -= (waterMesh.position.z / W.tileWorld) % 1;
  const agl = Math.abs(camera.position.y - TUNE.waterLevel);
  const fade = 1 - smoothstep(W.normalFade[0], W.normalFade[1], agl);
  waterMat.normalScale.set(W.normalScale * fade, W.normalScale * fade);
}

{
  const asphaltMat = mattMat(TUNE.runwaySurfaceColor);
  const paintMat = new THREE.MeshBasicMaterial({ color: TUNE.runwayPaintColor });
  const dashCount = Math.floor(TUNE.runwayLength / 95) - 1;
  const stripesPerEnd = 6;
  for (const ap of AIRPORTS) {
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(TUNE.runwayWidth, 0.4, TUNE.runwayLength),
      asphaltMat
    );
    surface.position.set(0, ap.elev + 0.1, ap.cz);
    surface.receiveShadow = true;
    scene.add(surface);

    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.08, 20), paintMat, dashCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      dummy.position.set(0, ap.elev + 0.42, ap.cz + TUNE.runwayLength / 2 - 60 - i * 95);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    scene.add(dashes);

    const stripeGeo = new THREE.BoxGeometry(2.6, 0.08, 24);
    const stripes = new THREE.InstancedMesh(stripeGeo, paintMat, stripesPerEnd * 2);
    let si = 0;
    for (const endZ of [ap.cz + TUNE.runwayLength / 2 - 26, ap.cz - TUNE.runwayLength / 2 + 26]) {
      for (let k = 0; k < stripesPerEnd; k++) {
        dummy.position.set((k - (stripesPerEnd - 1) / 2) * 8, ap.elev + 0.42, endZ);
        dummy.updateMatrix();
        stripes.setMatrixAt(si++, dummy.matrix);
      }
    }
    scene.add(stripes);

    // Edge lines down both sides. Real runways have them and they make the strip
    // read as a strip from the air; numerals and letters are of course out.
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.08, TUNE.runwayLength - 40),
        paintMat
      );
      edge.position.set(sx * (TUNE.runwayWidth / 2 - 2.2), ap.elev + 0.42, ap.cz);
      scene.add(edge);
    }
    // a centre line the full length, between the existing dashes
    const centre = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.08, TUNE.runwayLength - 120),
      new THREE.MeshBasicMaterial({ color: TUNE.runwayPaintColor, transparent: true, opacity: 0.35 })
    );
    centre.position.set(0, ap.elev + 0.41, ap.cz);
    scene.add(centre);
  }
}

const cLow = new THREE.Color(TUNE.colorLow);
const cMid = new THREE.Color(TUNE.colorMid);
const cHigh = new THREE.Color(TUNE.colorHigh);
const cSand = new THREE.Color(TUNE.sandColor);
const cSnow = new THREE.Color(0xf2f4f7);
const cRock = new THREE.Color(0xb5522e);
const cFoam = new THREE.Color(TUNE.water.foamColor);
const cFarmA = new THREE.Color(0x9ec46a);
const cFarmB = new THREE.Color(0xd9c27e);
const cPlains = new THREE.Color(0xc4b478);
const cDesert = new THREE.Color(0xd9c27e);
const tmpColor = new THREE.Color();

// Per-fragment, and deliberately matt: the ground never glints. Phong here is
// both cheaper than Standard and the only one of the three that puts a smooth
// shadow across a big flat-shaded triangle.
const terrainMat = new THREE.MeshPhongMaterial({
  vertexColors: true,
  flatShading: true,
  shininess: 0,
  specular: 0x000000,
});

function buildChunk(cx, cz) {
  const cs = TUNE.chunkSize;
  const geo = new THREE.PlaneGeometry(cs, cs, TUNE.chunkSegments, TUNE.chunkSegments);
  geo.rotateX(-Math.PI / 2);
  const ox = cx * cs, oz = cz * cs;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainEff(pos.getX(i) + ox, pos.getZ(i) + oz));
  }

  const flat = geo.toNonIndexed();
  geo.dispose();
  const fp = flat.attributes.position;
  const colors = new Float32Array(fp.count * 3);
  const hSpan = TUNE.colorHighHeight - TUNE.colorLowHeight;
  const shoreLo = TUNE.waterLevel - 1.2;
  const shoreHi = TUNE.waterLevel + 1.4;
  for (let f = 0; f < fp.count; f += 3) {
    const hy = (fp.getY(f) + fp.getY(f + 1) + fp.getY(f + 2)) / 3;
    if (hy < shoreHi) {
      tmpColor.copy(cSand).multiplyScalar(hy < shoreLo ? 0.78 : lerp(0.85, 1.02, smoothstep(shoreLo, shoreHi, hy)));
    } else {
      const t = clamp((hy - TUNE.colorLowHeight) / hSpan, 0, 1);
      if (t < 0.5) tmpColor.copy(cLow).lerp(cMid, t * 2);
      else tmpColor.copy(cMid).lerp(cHigh, (t - 0.5) * 2);
    }
    const wx = ox + fp.getX(f), wz = oz + fp.getZ(f);
    const j = 1 + (hash2(Math.round(fp.getX(f)), Math.round(fp.getZ(f))) - 0.5) * 2 * TUNE.colorJitter;
    if (mountainGauss(wz) > 0.3 && hy > 46) {
      tmpColor.lerp(cSnow, smoothstep(46, 66, hy));
    }
    const ct = canyonT(wz);
    if (ct > 0.1) tmpColor.lerp(cRock, Math.min(0.9, ct * 1.6));
    const fm = farmMask(wz);
    if (fm > 0 && hy > TUNE.waterLevel + 2) {
      tmpColor.lerp(valueNoise(wx / 260 + 55, wz / 200) > 0.5 ? cFarmA : cFarmB, fm * 0.75);
    }
    const pm = plainsMask(wz);
    if (pm > 0 && hy > TUNE.waterLevel + 2) tmpColor.lerp(cPlains, pm * 0.55);
    const dm = desertMask(wz);
    if (dm > 0) tmpColor.lerp(cDesert, dm * 0.8);
    // foam: a bright line exactly where the sea meets the land, which is what
    // makes a coast read as a coast rather than as two colours meeting
    const foam = 1 - Math.min(1, Math.abs(hy - TUNE.waterLevel) / TUNE.water.foamBand);
    if (foam > 0) tmpColor.lerp(cFoam, foam * foam * 0.75);
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = tmpColor.r * j;
      colors[(f + v) * 3 + 1] = tmpColor.g * j;
      colors[(f + v) * 3 + 2] = tmpColor.b * j;
    }
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();

  const mesh = new THREE.Mesh(flat, terrainMat);
  mesh.receiveShadow = false;   // switched on per frame, only for the few near him
  mesh.position.set(ox, 0, oz);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

const chunks = new Map();
let lastCellX = null, lastCellZ = null;

// Chunks needed but not yet built, nearest-first. Drained a few per frame so a
// cell crossing (up to 11 new chunks) never stalls one frame.
const chunkQueue = [];
const CHUNKS_PER_FRAME = 2;
let chunkNeed = new Set();

function updateChunks(px, pz, buildAllNow) {
  const cs = TUNE.chunkSize;
  const ccx = Math.round(px / cs), ccz = Math.round(pz / cs);
  if (ccx !== lastCellX || ccz !== lastCellZ) {
    if (Math.abs(ccx - lastCellX) > 1 || Math.abs(ccz - lastCellZ) > 1) buildAllNow = true;
    lastCellX = ccx;
    lastCellZ = ccz;
    chunkNeed = new Set();
    chunkQueue.length = 0;
    for (let dx = -TUNE.chunkRadius; dx <= TUNE.chunkRadius; dx++) {
      for (let dz = -TUNE.chunkRadius; dz <= TUNE.chunkRadius; dz++) {
        const k = (ccx + dx) + "," + (ccz + dz);
        chunkNeed.add(k);
        if (!chunks.has(k)) chunkQueue.push({ k, cx: ccx + dx, cz: ccz + dz, d: dx * dx + dz * dz });
      }
    }
    chunkQueue.sort((a, b) => a.d - b.d);
    for (const [k, m] of chunks) {
      if (!chunkNeed.has(k)) {
        scene.remove(m);
        m.geometry.dispose();
        chunks.delete(k);
      }
    }
  }
  let budget = buildAllNow ? Infinity : CHUNKS_PER_FRAME;
  while (chunkQueue.length && budget-- > 0) {
    const q = chunkQueue.shift();
    if (chunks.has(q.k) || !chunkNeed.has(q.k)) continue;
    const m = buildChunk(q.cx, q.cz);
    chunks.set(q.k, m);
    scene.add(m);
  }
}
