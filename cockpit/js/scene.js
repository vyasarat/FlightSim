"use strict";
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

const SPACE_TOP = new THREE.Color(0x04050d);
const SPACE_HOR = new THREE.Color(0x0b1024);
// Sky moods for the sky button: sun / rain / snow / night. Night reuses the
// space palette for the dome and stars; rain and snow are grey and pale.
const SKY_MOODS = [
  { top: null, hor: null, fogNear: null, fogFar: null, sun: 1, hemi: 1 },
  { top: new THREE.Color(0x5f6c7a), hor: new THREE.Color(0x98a3ae), fogNear: 260, fogFar: 950, sun: 0.45, hemi: 0.75 },
  { top: new THREE.Color(0xb3c1cf), hor: new THREE.Color(0xe7edf2), fogNear: 380, fogFar: 1150, sun: 0.75, hemi: 0.95 },
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
  color: 0xffffff, size: 2.2, sizeAttenuation: false,
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 5), lamSafe(0xd8b04a));
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
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 20, 12), lamSafe(0xcfd6df));
  station.add(core);
  for (const sy of [-6.5, 6.5]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 5), lamSafe(0x9aa2ad));
    arm.position.y = sy;
    station.add(arm);
    for (const sx of [-10.5, 10.5]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 7.5), lamSafe(0x2a4f9e));
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
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x2a3140 });
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

// Water wins ties against shallow shore terrain instead of flickering.
const waterMat = new THREE.MeshLambertMaterial({ color: 0x3f7fbf, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.y = TUNE.waterLevel;
scene.add(waterMesh);

{
  const asphaltMat = new THREE.MeshLambertMaterial({ color: TUNE.runwaySurfaceColor });
  const paintMat = new THREE.MeshBasicMaterial({ color: TUNE.runwayPaintColor });
  const dashCount = Math.floor(TUNE.runwayLength / 95) - 1;
  const stripesPerEnd = 6;
  for (const ap of AIRPORTS) {
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(TUNE.runwayWidth, 0.4, TUNE.runwayLength),
      asphaltMat
    );
    surface.position.set(0, ap.elev + 0.1, ap.cz);
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
  }
}

const cLow = new THREE.Color(TUNE.colorLow);
const cMid = new THREE.Color(TUNE.colorMid);
const cHigh = new THREE.Color(TUNE.colorHigh);
const cSand = new THREE.Color(TUNE.sandColor);
const cSnow = new THREE.Color(0xf4f8fb);
const cRock = new THREE.Color(0xb5522e);
const cFarmA = new THREE.Color(0x9ec46a);
const cFarmB = new THREE.Color(0xc9b978);
const cPlains = new THREE.Color(0xc4b478);
const cDesert = new THREE.Color(0xe0c48f);
const tmpColor = new THREE.Color();

const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 1.0,
  metalness: 0.0
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
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = tmpColor.r * j;
      colors[(f + v) * 3 + 1] = tmpColor.g * j;
      colors[(f + v) * 3 + 2] = tmpColor.b * j;
    }
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();

  const mesh = new THREE.Mesh(flat, terrainMat);
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
