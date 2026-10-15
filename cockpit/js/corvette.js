"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE CORVETTE'S ROCKET BOOSTER (v159).
//
// The Corvette is a third body on the car, like the Cybertruck: car.js drives it
// -- lane-keep, the turn rule, the corner assist, the speed steps, both cities --
// and nothing here steers it. What is its own is the booster. His drag-up, the
// burst on every other car, lights it: held, it burns for as long as he holds it
// (no fuel, no cooldown, nothing that runs out) and drops out only when the drag
// falls back under `booster.release`, so a wobbling finger is one burn, one whoosh.
//
// WHAT IT DOES TO THE DRIVE: one thing. While it burns car.js aims him at
// cvSpeed() -- `over` times the TOP speed step's speed, whatever step he is on --
// going straight along the motorway; the top step's own through its end-turn; his
// own step's through a turn he holds and on a way on or off (cvTarget). In a city, a boost on the straight
// that is shed before every junction (cvCitySpeed, v160). Everything that slows a car still slows this one: the
// corner assist's cap, the end of the motorway's turn, off-road. The traffic's
// promises are made against his speed, whatever it is, so ahead of him it yields
// and outruns him at this speed too (road_checks and city_checks drive it).
//
// WHAT IT SHOWS: flames out of the four tail pipes (a white-blue core, a yellow
// middle and a long orange tail that grows with speed), a glow at the pipes and
// over the plume, a glow lying on the road behind, and a few sparks. From the
// driving seat they are behind him, so the rear-view mirror shows them. The chase
// camera drops back, the view widens and a roar sits over the engine.
//
// NOTHING HERE DRAWS FROM Math.random: the seeded traffic shares that stream, and
// a spark is not worth moving a car. The sparks have their own; what it builds --
// three.js draws one for every object's id -- is built inside vkQuiet.
// ---------------------------------------------------------------------------

const CORVETTE = TUNE.corvette;
const cv = {
  on: false, k: 0, camK: 0, t: 0, seed: 0x2c0be7,
  fx: null, flames: [], nozzles: [], plume: null, road: null, tips: null, tipsFor: null, rear: 0, roadY: 0,
  sparks: null, sparkPos: null, spark: [], sparkDue: 0,
  mirror: null, mirrorArt: null, mirrorK: -1,
};

// The booster's speed: well above the top step's.
function cvSpeed() { return TUNE.car.cruise * Math.max(...TUNE.car.speedSteps) * CORVETTE.booster.over; }
// The top speed step's speed: what the booster gives wherever its full speed does not go.
function cvTopStep() { return TUNE.car.cruise * Math.max(...TUNE.car.speedSteps); }
// THE BOOSTER'S SPEED IS THE MOTORWAY'S. Going straight along it, the full speed.
// Elsewhere it is less, still burning (cvTarget):
//   - the end-turn, and not lined up with the road (`alignTol` off his aim: a lane
//     change, the swing out of the U): the TOP STEP's speed, the speed the end-turn
//     is proven at. At 128 m/s he came out of the end-turn's U too fast to stay on
//     the road.
//   - a turn he is holding (an exit, a way in) and a way on or off: his own step's,
//     as on any car. At 128 the noisy hand held right for New York's way in and
//     left the motorway; at the top step's 85 it still ran wide off the far way
//     in's first bend, on some runs (v160).
//   - a city: a boost along each street, shed to his own step's speed before every
//     junction (cvCitySpeed, v160). Held at 128, and then at 85, the noisy hand
//     went wide into New York's walls on held corners; at each junction he is now
//     the car at his step, whose promises are proven.
function cvStraight(turning, road) {
  if (turning || !road || road.spur || road.street || car.onStreet) return false;
  const err = wrapPi(Math.atan2(-(road.aimX - state.x), -(road.aimZ - state.z)) - state.heading);
  return Math.abs(err) < CORVETTE.booster.alignTol;
}
// THE BOOSTER IN A CITY (v160): a real boost along a grid street, shed for every
// junction. Burning, he is driven at `city.over` times his own step's speed, but
// never faster than he can come back down to that step's speed, braking at
// `city.shed`, `city.margin` metres short of the junction ahead -- every
// junction, the ones he goes straight through too, since a held turn can be
// found at any of them. So at each junction he is exactly the car at his step:
// the speed the corner assist, the turn rule and a four-year-old's hand are
// proven at. Past it the boost comes back at `city.accel`. None on a corner, on a
// turn he holds, on a curving link, off the street, while the assist hands a
// corner's speed back, or while the turn he took is still spent (the finger that
// took it has not let go): there it is his step's, as before.
function cvCitySpeed(road, base) {
  const C = CORVETTE.city, st = road && road.street;
  if (!st || st.kind !== "grid" || !car.onStreet || road.corner || road.curve || road.holding || car.spent ||
      (typeof stPlan !== "undefined" && stPlan.giveBack > 0)) return base;
  const room = Math.max(0, road.toNode - C.margin);
  return Math.min(base * C.over, cvSpeed(), Math.sqrt(base * base + 2 * C.shed * room));
}
// What it drives him at short of its full speed (car.js; `base` is his own step's speed):
//   - along a city street, the boost shed before every junction (cvCitySpeed);
//   - a turn he holds on the motorway (an exit, a way in), a way on or off, off the
//     street in a city: his own step's. At the top step's 85 m/s a noisy hand held
//     right for New York's far way in went wide on the ramp's first bend (v160): so
//     he meets every exit as the car does, as he meets every city junction;
//   - the motorway's end-turn, and the motorway off his line: the top step's.
function cvTarget(road, base, holdingTurn) {
  if (road && road.street) return cvCitySpeed(road, base);
  if ((road && (road.spur || road.holding)) || car.onStreet || holdingTurn) return base;
  return cvTopStep();
}
// How far the camera has eased into the burn (0 outside the Corvette).
function cvCamK() { return vehBooster() ? cv.camK : 0; }
// The degrees it adds to the view (vehicle.js, updateFeel).
function cvFov() { return vehBooster() ? cv.camK * CORVETTE.cam.fov : 0; }
function cvRand() { cv.seed = (Math.imul(cv.seed, 1664525) + 1013904223) >>> 0; return cv.seed / 4294967296; }

// A frame of it. `want`: is he asking for it this frame. Returns whether it burns.
function cvUpdate(dt, want) {
  const B = CORVETTE.booster, R = CORVETTE.roar;
  const was = cv.on;
  cv.on = !!want && !state.exploding;
  if (cv.on && !was) {
    flags.cvBoosts = (flags.cvBoosts || 0) + 1;
    noiseBurst(R.whoosh.dur, R.whoosh.freq, R.whoosh.peak, 0);
    engSurge(0.8);
    cameraPunch(0.35);
  }
  cv.k += ((cv.on ? 1 : 0) - cv.k) * Math.min(1, (cv.on ? B.rate : B.fade) * dt);
  cv.camK += ((cv.on ? 1 : 0) - cv.camK) * Math.min(1, CORVETTE.cam.rate * dt);
  if (cv.k < 0.002) cv.k = 0;
  if (cv.camK < 0.002) cv.camK = 0;
  cv.t += dt;
  if (cv.on) flags.cvBurnTime = (flags.cvBurnTime || 0) + dt;
  setTone("cvRoar", "sawtooth", R.hz * (1 + cv.k * R.rise), R.gain * cv.k);
  cvDraw(dt);
  return cv.on;
}

// Out, everywhere: on every vehicle switch (state.js, applyVehicle).
function cvReset() {
  cv.on = false; cv.k = 0; cv.camK = 0;
  if (cv.fx) cv.fx.visible = false;
  if (cv.sparks) { cv.sparks.visible = false; for (const p of cv.spark) p.life = 0; }
  if (cv.mirror) cv.mirror.visible = false;
}

// ---- the flames ------------------------------------------------------------
// One cone, apex BACK (+Z: the model's nose is -Z), its base on the origin, so a
// scale along Z grows it out of the pipe.
// Each fades out along its length (an alpha ramp down the cone's v): seen side-on a
// flat-ended cone read as an orange plank laid across the verge (v159 render round 1).
let cvFadeTex = null;
function cvFade() {
  if (cvFadeTex) return cvFadeTex;
  const c = document.createElement("canvas");
  c.width = 4; c.height = 64;
  const cx = c.getContext("2d");
  // the canvas top is the cone's apex (v = 1): nothing there, all of it at the pipe
  const g = cx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "#000"); g.addColorStop(0.55, "#777"); g.addColorStop(1, "#fff");
  cx.fillStyle = g; cx.fillRect(0, 0, 4, 64);
  cvFadeTex = new THREE.CanvasTexture(c);
  return cvFadeTex;
}
// Additive: fire is light, and light needs no sorting -- drawn normally, the open,
// double-sided cones crossed each other and cut a straight line across the road.
function cvCone(r, len, color, opacity) {
  const g = new THREE.ConeGeometry(r, len, 12, 1, true);
  g.rotateX(Math.PI / 2);               // apex from +Y to +Z
  g.translate(0, 0, len / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
                                                             alphaMap: cvFade(), side: THREE.DoubleSide, fog: false,
                                                             blending: THREE.AdditiveBlending }));
  m.renderOrder = 6;
  return m;
}

// The road glow's own falloff, gone well inside the quad's edge (on the shared glow
// texture, filtered, a quad's edge can show).
function cvRoadTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(32, 32, 0, 32, 32, 28);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = "rgba(0,0,0,0)"; cx.fillRect(0, 0, 64, 64);
  cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function cvBuild() {
  const F = CORVETTE.flame;
  const cvSoft = cvRoadTex();
  const fx = new THREE.Group();
  fx.name = "corvetteBooster";
  for (let i = 0; i < 4; i++) {
    const set = new THREE.Group();
    // drawn outside in, so the core sits inside the tail it lights
    const tail = cvCone(F.tail[0], F.tail[1], F.tailColor, 0.78);
    const mid = cvCone(F.mid[0], F.mid[1], F.midColor, 0.9);
    const core = cvCone(F.core[0], F.core[1], F.coreColor, 1);
    tail.renderOrder = 6; mid.renderOrder = 7; core.renderOrder = 8;
    set.add(tail, mid, core);
    set.userData.parts = [tail, mid, core];
    fx.add(set);
    cv.flames.push(set);
    const nz = glowSprite(F.coreColor, F.nozzle, 0.95);
    nz.renderOrder = 9;
    fx.add(nz); cv.nozzles.push(nz);
  }
  cv.plume = glowSprite(F.tailColor, F.plume, 0.8);
  cv.plume.renderOrder = 5;
  fx.add(cv.plume);
  // the glow on the road behind: lying flat, additive, so it lights the tarmac
  const rg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: cvSoft, color: F.tailColor, transparent: true, opacity: F.roadOpacity,
                                  depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  rg.rotation.x = -Math.PI / 2;
  rg.renderOrder = 4;
  fx.add(rg);
  cv.road = rg;
  fx.visible = false;
  cv.fx = fx;

  // the sparks: one draw call, world space (they are left behind, not carried)
  const S = CORVETTE.sparks;
  cv.sparkPos = new Float32Array(S.count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(cv.sparkPos, 3));
  cv.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, size: S.size * 2, sizeAttenuation: true,
    color: 0xffc46a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  cv.sparks.frustumCulled = false;
  cv.sparks.visible = false;
  cv.sparks.renderOrder = 9;
  for (let i = 0; i < S.count; i++) cv.spark.push({ x: 0, y: -1e5, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  scene.add(cv.sparks);
}

// Where the four pipes are, in the body's own frame: measured off the imported
// model's "pipe" material vertex by vertex (Box3 boxes a mesh's own box, and this
// three.js build ignores the precise flag). Spread evenly across the pipes' width
// at their rearmost face. The built stand-in has no pipes: under its tail, middle.
function cvFindTips(model) {
  model.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9), all = new THREE.Box3();
  const v = new THREE.Vector3(), M = new THREE.Matrix4();
  let n = 0;
  model.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    M.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position, pipe = o.material && o.material.name === "pipe";
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(M);
      all.expandByPoint(v);
      if (pipe) { lo.min(v); hi.max(v); n++; }
    }
  });
  const roadY = TUNE.gearHeight - 0.6;   // updateVehicleModel stands the body this far under the road's height
  cv.roadY = roadY;
  cv.rear = all.max.z;
  if (!n) return [-0.45, -0.15, 0.15, 0.45].map((x) => new THREE.Vector3(x, roadY + 0.7, all.max.z));
  const w = hi.x - lo.x, y = (lo.y + hi.y) / 2;
  return [0, 1, 2, 3].map((i) => new THREE.Vector3(lo.x + (i + 0.5) * w / 4, y, hi.z));
}

function cvDraw(dt) {
  // (on its own stream: three.js draws Math.random for every object's id, and
  // the seeded traffic shares the stream -- vkQuiet, vehiclekit.js)
  if (!cv.fx) vkQuiet(0, cvBuild);
  const F = CORVETTE.flame, model = vehicleModel;
  if (model && (cv.fx.parent !== model || cv.tipsFor !== model.userData.imported)) {
    model.add(cv.fx);
    cv.tips = cvFindTips(model);
    cv.tipsFor = model.userData.imported;
  }
  const k = cv.k;
  const show = !!model && k > 0.01 && !state.exploding;
  cv.fx.visible = show;
  if (show) {
    // a longer tail the faster he goes; a flicker on every one, out of step
    const grow = Math.min(F.grow, 1 + F.perV * state.speed);
    for (let i = 0; i < 4; i++) {
      const tip = cv.tips[i], set = cv.flames[i];
      set.position.copy(tip);
      const fl = 1 + F.flicker * Math.sin(cv.t * F.hz * 6.283 + i * 1.9) + 0.5 * F.flicker * Math.sin(cv.t * F.hz * 3.7 + i * 0.7);
      const [tail, mid, core] = set.userData.parts;
      const fat = 0.55 + 0.45 * k;
      tail.scale.set(fat, fat, k * grow * fl);
      mid.scale.set(fat, fat, k * (0.5 + 0.5 * grow) * fl);
      core.scale.set(fat, fat, k * fl);
      cv.nozzles[i].position.copy(tip);
      cv.nozzles[i].material.opacity = 0.95 * k;
    }
    const len = F.tail[1] * grow * k;
    const mx = (cv.tips[0].x + cv.tips[3].x) / 2, my = cv.tips[0].y;
    cv.plume.position.set(mx, my, cv.tips[0].z + Math.min(len * 0.35, 1.5));
    cv.plume.scale.setScalar(F.plume * (0.6 + 0.4 * grow / F.grow) * k);
    cv.plume.material.opacity = 0.8 * k;
    const rl = F.road[1] * (0.6 + 0.4 * grow / F.grow);
    cv.road.position.set(mx, cv.roadY + 0.08, cv.rear + rl * 0.42);
    cv.road.scale.set(F.road[0], rl, 1);
    cv.road.material.opacity = F.roadOpacity * k;
  }
  cvSparks(dt, show && cv.on);
  cvMirror();
}

function cvSparks(dt, emit) {
  const S = CORVETTE.sparks;
  const live = state.viewChase && !state.exploding;
  if (emit && live && cv.tips) {
    cv.sparkDue += S.rate * cv.k * dt;
    const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
    const w = new THREE.Vector3();
    while (cv.sparkDue >= 1) {
      cv.sparkDue -= 1;
      const p = cv.spark.find((q) => q.life <= 0);
      if (!p) break;
      w.copy(cv.tips[Math.floor(cvRand() * 4) % 4]);
      vehicleModel.localToWorld(w);
      const sp = S.speed[0] + cvRand() * (S.speed[1] - S.speed[0]);
      p.x = w.x; p.y = w.y; p.z = w.z;
      p.vx = fx * state.speed * S.carry - fx * sp + (cvRand() - 0.5) * S.spread;
      p.vz = fz * state.speed * S.carry - fz * sp + (cvRand() - 0.5) * S.spread;
      p.vy = 1 + cvRand() * 3;
      p.life = S.life[0] + cvRand() * (S.life[1] - S.life[0]);
    }
  } else cv.sparkDue = 0;
  let any = false;
  for (let i = 0; i < cv.spark.length; i++) {
    const p = cv.spark[i];
    if (p.life > 0) {
      p.life -= dt;
      p.vy -= S.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      any = any || p.life > 0;
    }
    const alive = p.life > 0;
    cv.sparkPos[i * 3] = alive ? p.x : 0; cv.sparkPos[i * 3 + 1] = alive ? p.y : -1e5; cv.sparkPos[i * 3 + 2] = alive ? p.z : 0;
  }
  cv.sparks.visible = any && live;
  if (any) cv.sparks.geometry.attributes.position.needsUpdate = true;
}

// ---- the rear-view mirror ----------------------------------------------------
// From the driving seat the flames are behind him, so the mirror shows them: a
// face on the cabin's mirror (car.js, carBuildCabin), painted -- the road running
// away behind, and the four flames over it as the booster burns. No glyph, ever.
const CV_MIRROR_W = 128, CV_MIRROR_H = 32;
function cvMirror() {
  if (typeof car === "undefined" || !car.cabin) return;
  if (!cv.mirror) vkQuiet(0, cvMirrorBuild);
  cv.mirror.visible = true;
  cvMirrorPaint();
}
function cvMirrorBuild() {
  {
    const c = document.createElement("canvas");
    c.width = CV_MIRROR_W; c.height = CV_MIRROR_H;
    const tex = new THREE.CanvasTexture(c);
    // Its own mirror, in front of HIM: the cabin's own sits on the car's middle, and in
    // portrait that is off the edge of the screen (1.55 across). Up at the header,
    // a little inboard of his eye, a dark frame round the glass.
    const K = TUNE.car.cabin, M = CORVETTE.mirror;
    const m = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(M.w + 0.06, M.h + 0.05, 0.05), mattMat(TUNE.palette.ink));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.h), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
    glass.position.z = 0.03;
    m.add(frame, glass);
    m.position.set(K.seatX + M.inboard, K.roof + M.drop, M.z);
    m.rotation.x = M.tilt;
    m.name = "corvetteMirror";
    car.cabin.add(m);
    cv.mirror = m; cv.mirrorArt = { c, cx: c.getContext("2d"), tex };
  }
}
function cvMirrorPaint() {
  // repaint when the burn changes, and every few frames while it flickers
  const k = Math.round(cv.k * 20) / 20;
  if (k === cv.mirrorK && (k === 0 || frameCount % 3)) return;
  cv.mirrorK = k;
  const { cx, tex } = cv.mirrorArt, W = CV_MIRROR_W, H = CV_MIRROR_H;
  const sky = cx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#9fc3e6"); sky.addColorStop(0.5, "#c9dbea"); sky.addColorStop(0.5, "#5a5f66"); sky.addColorStop(1, "#3c4350");
  cx.fillStyle = sky; cx.fillRect(0, 0, W, H);
  // the road running away behind him, to a point in the middle
  cx.fillStyle = "#2f343b";
  cx.beginPath(); cx.moveTo(W * 0.5, H * 0.5); cx.lineTo(W * 0.92, H); cx.lineTo(W * 0.08, H); cx.closePath(); cx.fill();
  if (k > 0) {
    const F = CORVETTE.flame, fl = 1 + F.flicker * Math.sin(cv.t * F.hz * 6.283);
    const glow = cx.createRadialGradient(W / 2, H, 2, W / 2, H, H * 1.4 * k);
    glow.addColorStop(0, "rgba(255,180,58,0.85)"); glow.addColorStop(1, "rgba(255,122,26,0)");
    cx.fillStyle = glow; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const x = W * (0.38 + i * 0.08), h = H * 0.75 * k * fl;
      const flame = (w, hh, col) => { cx.fillStyle = col; cx.beginPath(); cx.ellipse(x, H, w, hh, 0, Math.PI, 2 * Math.PI); cx.fill(); };
      flame(5, h, "#ff7a1a"); flame(3.4, h * 0.7, "#ffd23e"); flame(1.8, h * 0.4, "#d8ecff");
    }
  }
  // the frame
  cx.strokeStyle = "#1f2328"; cx.lineWidth = 3; cx.strokeRect(1.5, 1.5, W - 3, H - 3);
  tex.needsUpdate = true;
}
