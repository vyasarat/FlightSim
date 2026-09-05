"use strict";
// ---------------------------------------------------------------------------
// Atmosphere. Everything here is a billboard or a colour: there is no
// post-processing stack in this game and there is not going to be one, because
// a full-screen bloom pass costs more on an iPad than everything below put
// together. Glow is additive sprites, haze is fog, and both are free enough to
// leave on all the time.
//
// One shared soft round texture does all of it -- sun, halo, engine bells,
// fire, pad lights -- so every glow in the game is one material family and one
// texture upload.
// ---------------------------------------------------------------------------

const SKYT = TUNE.sky;

// A soft radial dot, drawn once. Additive blending means the middle blows out
// to white on its own, which is exactly what a light looks like.
const glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.00, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.85)");
  g.addColorStop(0.45, "rgba(255,255,255,0.30)");
  g.addColorStop(0.75, "rgba(255,255,255,0.07)");
  g.addColorStop(1.00, "rgba(255,255,255,0)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

// The one glow material family. `fog:false` because a glow is a light, not a
// surface -- fogging it makes it grey out at exactly the distance he is most
// likely to be looking for it from.
function glowSprite(color, size, opacity) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity: opacity === undefined ? 1 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  m.scale.setScalar(size || 1);
  return m;
}

// Many small glows for the price of one draw call: pad lights, beacons, a
// runway edge. Positions are world-space and set once.
function glowField(points, color, size, opacity) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    arr[i * 3] = points[i].x; arr[i * 3 + 1] = points[i].y; arr[i * 3 + 2] = points[i].z;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    map: glowTex, color, size: size || 6, sizeAttenuation: true,
    transparent: true, opacity: opacity === undefined ? 0.9 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const p = new THREE.Points(geo, mat);
  // Deliberately LEFT frustum-culled. These fields are static and often behind
  // him; drawing the Mars pad ring while he is looking the other way was pure
  // fill for nothing. The bounding sphere is grown by the sprite size so points
  // at the edge do not pop.
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius += (size || 6) * 2;
  return p;
}

// ---------------------------------------------------------------------------
// The sun. A disc and a halo, pinned in the sun's direction at a fixed distance
// so it reads as infinitely far away, plus one wider bloom that only comes up
// in the cockpit -- from outside the aeroplane you are not looking down a lens.
// ---------------------------------------------------------------------------
const sunDisc = glowSprite(SKYT.sunColor, 1, 1);
const sunHalo = glowSprite(SKYT.haloColor, 1, SKYT.haloOpacity);
const sunLens = glowSprite(SKYT.lensColor, 1, 0);
for (const s of [sunHalo, sunLens, sunDisc]) { s.renderOrder = 3; scene.add(s); }

// ---------------------------------------------------------------------------
// A thin high layer above the cumulus: one big soft plane that drifts. It costs
// a single transparent quad and it is what stops the sky reading as a bare
// gradient when he is up high.
// ---------------------------------------------------------------------------
const cirrusTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, 256, 256);
  // a few soft streaks, wrapped
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 256, w = 40 + Math.random() * 150, h = 3 + Math.random() * 9;
    const x = Math.random() * 256;
    const g = cx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${0.10 + Math.random() * 0.16})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(x + w / 2, y, w / 2, h, 0, 0, Math.PI * 2);
    cx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(SKYT.cirrusRepeat, SKYT.cirrusRepeat);
  return t;
})();
const cirrus = new THREE.Mesh(
  new THREE.PlaneGeometry(SKYT.cirrusSpan, SKYT.cirrusSpan),
  new THREE.MeshBasicMaterial({ map: cirrusTex, transparent: true, opacity: 0, depthWrite: false, fog: false })
);
cirrus.rotation.x = Math.PI / 2;      // faces down at him
cirrus.renderOrder = 2;
cirrus.frustumCulled = false;
scene.add(cirrus);

// ---------------------------------------------------------------------------
// Stars that actually twinkle. One draw call: each star carries its own phase
// and rate, and the shader does the rest. A PointsMaterial cannot vary opacity
// per point, so this is the only way to get it without 700 objects.
// ---------------------------------------------------------------------------
function twinkleStars(geo) {
  const n = geo.attributes.position.count;
  const phase = new Float32Array(n), rate = new Float32Array(n), mag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    phase[i] = Math.random() * Math.PI * 2;
    rate[i] = SKYT.twinkleRate[0] + Math.random() * (SKYT.twinkleRate[1] - SKYT.twinkleRate[0]);
    mag[i] = 0.55 + Math.random() * 0.45;         // not every star is the same size
  }
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("rate", new THREE.BufferAttribute(rate, 1));
  geo.setAttribute("mag", new THREE.BufferAttribute(mag, 1));
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: SKYT.starSize }, uDepth: { value: SKYT.twinkleDepth } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float phase; attribute float rate; attribute float mag;
      uniform float uTime; uniform float uSize; uniform float uDepth;
      varying float vA;
      void main() {
        vA = 1.0 - uDepth + uDepth * (0.5 + 0.5 * sin(uTime * rate + phase));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * mag * (0.7 + 0.6 * vA);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = dot(d, d);
        if (r > 0.25) discard;
        float soft = 1.0 - smoothstep(0.04, 0.25, r);
        gl_FragColor = vec4(vec3(1.0), soft * vA * uOpacity);
      }
    `,
  });
}
const starTwinkleMat = twinkleStars(starsGeo);
stars.material = starTwinkleMat;

// ---------------------------------------------------------------------------
// Speed streaks. A ring of soft radial lines on a quad pinned to the camera,
// so it costs one transparent draw call and only when he is actually going
// fast. Cockpit only: from outside the aeroplane there is no air rushing past
// your face.
// ---------------------------------------------------------------------------
const linesTex = (() => {
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, N, N);
  cx.strokeStyle = "rgba(255,255,255,0.9)";
  cx.lineCap = "round";
  for (let i = 0; i < 54; i++) {
    const a = Math.random() * Math.PI * 2;
    const r0 = 40 + Math.random() * 60, r1 = r0 + 26 + Math.random() * 60;
    cx.globalAlpha = 0.10 + Math.random() * 0.30;
    cx.lineWidth = 1 + Math.random() * 2.2;
    cx.beginPath();
    cx.moveTo(N / 2 + Math.cos(a) * r0, N / 2 + Math.sin(a) * r0);
    cx.lineTo(N / 2 + Math.cos(a) * r1, N / 2 + Math.sin(a) * r1);
    cx.stroke();
  }
  return new THREE.CanvasTexture(c);
})();
const speedLines = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: linesTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false })
);
speedLines.position.z = -1.2;          // just in front of the near plane
speedLines.scale.setScalar(1.5);
speedLines.renderOrder = 20;
speedLines.frustumCulled = false;
speedLines.visible = false;
camera.add(speedLines);

function updateSpeedLines(dt) {
  const L = TUNE.camera.lines;
  const cru = state.vp && state.vp.cruiseSpeed ? state.vp.cruiseSpeed : 60;
  const sp = clamp((state.speed / cru - L.from) / (1.25 - L.from), 0, 1);
  const want = state.viewChase ? 0 : sp * L.gain;
  speedLines.material.opacity += (want - speedLines.material.opacity) * Math.min(1, 5 * dt);
  speedLines.visible = speedLines.material.opacity > 0.006;
  if (speedLines.visible) {
    speedLines.rotation.z += dt * 0.12;
    speedLines.scale.setScalar(1.5 - sp * L.alt);
  }
}

// ---------------------------------------------------------------------------
const skyTmp = new THREE.Vector3();
let skyClock = 0;

function updateAtmosphere(dt) {
  skyClock += dt;
  const sf = state.spaceF;

  // ---- the sun, pinned in its own direction a long way off
  const D = SKYT.sunDistance;
  skyTmp.copy(camera.position).addScaledVector(sunDir, D);
  const daylight = clamp(1 - state.nightF, 0, 1);
  const airless = typeof rk !== "undefined" && rk && rk.onBody && rk.onBody.name === "moon";
  for (const s of [sunDisc, sunHalo, sunLens]) s.position.copy(skyTmp);
  sunDisc.scale.setScalar(D * SKYT.sunSize);
  sunHalo.scale.setScalar(D * SKYT.haloSize * (airless ? 0.45 : 1));
  sunLens.scale.setScalar(D * SKYT.lensSize);
  sunDisc.material.opacity = daylight;
  // in thick air the halo is wide and soft; in vacuum there is nothing to scatter it
  sunHalo.material.opacity = SKYT.haloOpacity * daylight * (airless ? 0.25 : lerp(1, 0.45, sf));
  // the lens flare belongs to the camera, not the world: only from inside
  const wantLens = state.viewChase ? 0 : SKYT.lensOpacity * daylight;
  sunLens.material.opacity += (wantLens - sunLens.material.opacity) * Math.min(1, 6 * dt);
  const sunUp = sunDir.y > -0.05 || airless || sf > 0.5;
  sunDisc.visible = sunHalo.visible = sunUp;
  sunLens.visible = sunUp && sunLens.material.opacity > 0.01;

  // ---- the high layer, drifting
  const wantCirrus = SKYT.cirrusOpacity * clamp(1 - sf * 1.6, 0, 1) * daylight * clamp(1 - state.rainF, 0.25, 1);
  cirrus.material.opacity += (wantCirrus - cirrus.material.opacity) * Math.min(1, 2 * dt);
  cirrus.visible = cirrus.material.opacity > 0.004;
  if (cirrus.visible) {
    cirrus.position.set(camera.position.x, SKYT.cirrusAlt, camera.position.z);
    cirrusTex.offset.x = (skyClock * SKYT.cirrusDrift) % 1;
    cirrusTex.offset.y = (skyClock * SKYT.cirrusDrift * 0.35) % 1;
  }

  updateSpeedLines(dt);

  // ---- stars
  starTwinkleMat.uniforms.uTime.value = skyClock;
  starTwinkleMat.uniforms.uOpacity.value = starTwinkleMat.opacity;   // flight.js drives it on stars.material
}

// ---- the haze on another world -------------------------------------------
const hazeCol = new THREE.Color();
let hazeF = 0, hazeNear = 0, hazeFar = 0, hazeInit = false;
function applyBodyHaze(dt) {
  const onBody = typeof rk !== "undefined" && rk && rk.onBody && !rk.onBody.dock ? rk.onBody.name : null;
  const F = onBody && SKYT.fog[onBody] ? SKYT.fog[onBody] : null;
  const want = F ? 1 : 0;
  hazeF += (want - hazeF) * Math.min(1, 1.6 * dt);
  if (hazeF < 0.002) return;
  if (F) {
    if (!hazeInit) { hazeCol.setHex(F.color); hazeNear = F.near; hazeFar = F.far; hazeInit = true; }
    hazeCol.lerp(hazeTmp.setHex(F.color), Math.min(1, 2 * dt));
    hazeNear += (F.near - hazeNear) * Math.min(1, 2 * dt);
    hazeFar += (F.far - hazeFar) * Math.min(1, 2 * dt);
  } else hazeInit = false;
  scene.fog.color.lerp(hazeCol, hazeF);
  scene.fog.near = lerp(scene.fog.near, hazeNear, hazeF);
  scene.fog.far = lerp(scene.fog.far, hazeFar, hazeF);
  skyUniforms.horizonColor.value.lerp(hazeCol, hazeF * 0.75);
}
const hazeTmp = new THREE.Color();
