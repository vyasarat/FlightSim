"use strict";
// WORKING RULES
// A stealth-grey electric SUV. Inspired-by only: the silhouette, the paint, the
// glass roof and the light bar. No badge, no wordmark, no logo -- the same rule
// the airline liveries follow.
//
// One finger, and the same stick semantics as everything else: finger down =
// drive, drag left/right = steer, drag up = a burst. There is no new button and
// no new HUD.
//
// LANE KEEP is the whole feature. It does not count lanes or time button holds:
// it simply steers toward the centre of the nearest lane of the nearest road,
// and hands control straight back the moment he steers himself. Because a spur
// is a road too, holding a steer toward an exit makes the spur become the
// nearest road and the assist follows him onto it -- taking the exit falls out
// of the same rule instead of needing a timer. Off the road it pulls him back
// toward the nearest road, gently, so he can never be stranded.

const CAR = TUNE.car;

const car = {
  steer: 0, boost: 0, offRoad: 0, lastCrash: 0, wheelSpin: 0,
  onRoad: false, lateral: 0, s: 0, roadY: 0,
  charging: 0, chargedAt: null, dust: 0, screen: null, screenArt: null, cabin: null, cabinWheel: null,
  screenPlaying: false, screenT: 0,
  hornHeld: false, hornT: 0, hornSustain: 0, hornReplyCool: 0,
};

function carActive() { return !!(state.vp && state.vp.car); }

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------
function buildCarModel() {
  const C = TUNE.palette;
  const g = new THREE.Group();
  const L = CAR.bodyL, W = CAR.bodyW, H = CAR.bodyH;
  const grey = metalMat(0x6a7078, 60, 0x9aa4b0);          // stealth grey, lifted enough to read against tarmac
  const glass = new THREE.MeshPhongMaterial({ color: 0x1b2430, flatShading: true, shininess: 90,
    specular: 0x8fa4bb, transparent: true, opacity: 0.78 });
  const dark = mattMat(C.ink);

  // a crossover silhouette: long cabin, fast roofline, short overhangs
  const lower = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.62, L), grey);
  lower.position.y = H * 0.52; g.add(lower);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.5, L * 0.56), grey);
  cabin.position.set(0, H * 0.98, -L * 0.03); g.add(cabin);
  // the glass roof, one continuous pane from screen to tailgate
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, 0.12, L * 0.52), glass);
  roof.position.set(0, H * 1.24, -L * 0.03); g.add(roof);
  for (const [sx] of [[-1], [1]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, H * 0.42, L * 0.5), glass);
    side.position.set(sx * W * 0.46, H * 1.0, -L * 0.03); g.add(side);
  }
  const wind = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, H * 0.46, 0.12), glass);
  wind.position.set(0, H * 1.0, L * 0.24); wind.rotation.x = -0.42; g.add(wind);

  // the light bar: one continuous strip across the nose, and one across the tail
  const barMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff, fog: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.22, 0.2), barMat);
  bar.position.set(0, H * 0.66, L * 0.5); g.add(bar);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.22, 0.2), tailMat);
  tail.position.set(0, H * 0.7, -L * 0.5); g.add(tail);
  g.userData.lightBar = bar; g.userData.tailBar = tail;

  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(CAR.wheelR, CAR.wheelR, 0.7, 12), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * W * 0.5, CAR.wheelR, sz * L * 0.31);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// The centre screen. Two things live on it, and neither is ever a glyph: a
// moving map with an arrow, and -- behind a play triangle -- a little cartoon
// that loops.
//
// The play triangle is the button. There is no wordmark and no logo on it: the
// same rule the airline liveries follow, and the same reason the whole game has
// no text. A triangle in a rounded box is a thing a four-year-old already knows
// how to press, and it needs no reading at all.
const CAR_SCREEN_PX = 128;
function carBuildScreen() {
  if (car.screen) return car.screen;
  const c = document.createElement("canvas");
  c.width = c.height = CAR_SCREEN_PX;
  const cx = c.getContext("2d");

  // ---- the map: the road ahead, and which way it bends
  const drawMap = (ang) => {
    cx.fillStyle = "#11161d"; cx.fillRect(0, 0, 128, 128);
    cx.save(); cx.translate(64, 74); cx.rotate(ang);
    cx.strokeStyle = "#2f6fd0"; cx.lineWidth = 9; cx.lineCap = "round";
    cx.beginPath(); cx.moveTo(0, 190); cx.lineTo(0, -190); cx.stroke();
    cx.strokeStyle = "#4a86e8"; cx.lineWidth = 2; cx.setLineDash([8, 12]);
    cx.beginPath(); cx.moveTo(0, 190); cx.lineTo(0, -190); cx.stroke();
    cx.setLineDash([]);
    cx.strokeStyle = "#243447"; cx.lineWidth = 5;
    for (const off of [-46, 46]) { cx.beginPath(); cx.moveTo(off, 190); cx.lineTo(off, -190); cx.stroke(); }
    cx.restore();
    cx.fillStyle = "#eaf2ff";
    cx.beginPath(); cx.moveTo(64, 62); cx.lineTo(56, 84); cx.lineTo(64, 78); cx.lineTo(72, 84); cx.closePath(); cx.fill();
    drawPlayBadge();
  };

  // the press-me corner: a rounded box with a triangle in it
  const drawPlayBadge = () => {
    const x = 88, y = 88, w = 32, h = 25, r = 7;
    cx.fillStyle = "rgba(12,16,22,0.78)";
    cx.beginPath();
    cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h); cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y); cx.closePath(); cx.fill();
    cx.strokeStyle = "rgba(234,242,255,0.35)"; cx.lineWidth = 1.5; cx.stroke();
    cx.fillStyle = "#eaf2ff";
    cx.beginPath(); cx.moveTo(x + 11, y + 6); cx.lineTo(x + 23, y + 12.5); cx.lineTo(x + 11, y + 19); cx.closePath(); cx.fill();
  };

  // ---- the cartoon: a paper plane flying a figure of eight, for ever.
  //
  // A figure of eight because it closes on itself: there is no seam where the
  // loop restarts. And every single thing here is a pure function of t -- the
  // clouds wrap a whole number of times per loop, and the trail is worked out
  // backwards from t rather than accumulated frame by frame. An accumulated
  // trail would have made the picture depend on how often it happened to be
  // drawn, which is both a frame-rate bug and a seam in the loop.
  const path = (u) => {
    const a = u * Math.PI * 2;
    return [64 + 42 * Math.sin(a), 66 - 24 * Math.sin(2 * a),
            42 * Math.cos(a), -48 * Math.cos(2 * a)];
  };
  const drawPlay = (t) => {
    const P = CAR.screenPlay, u = (t % P.loop) / P.loop;
    const g = cx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#8fd0f2"); g.addColorStop(1, "#d8eefb");
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
    cx.fillStyle = "#ffd23e";
    cx.beginPath(); cx.arc(20, 20, 11, 0, Math.PI * 2); cx.fill();
    // clouds: `laps` is a whole number, so they are back where they started
    cx.fillStyle = "rgba(255,255,255,0.92)";
    for (const [cy, laps, sc] of [[36, 2, 1], [92, 1, 0.75]]) {
      const cxp = ((u * laps) % 1) * 168 - 20;
      for (const [dx, dy, r] of [[0, 0, 9], [10, -4, 11], [21, 1, 8]]) {
        cx.beginPath(); cx.arc(cxp + dx * sc, cy + dy * sc, r * sc, 0, Math.PI * 2); cx.fill();
      }
    }
    // the trail, worked out backwards along the path
    cx.strokeStyle = "rgba(255,255,255,0.85)"; cx.lineWidth = 3; cx.lineCap = "round";
    let prev = null;
    for (let i = P.trail; i >= 0; i--) {
      const q = path(((u - i * P.trailStep) % 1 + 1) % 1);
      if (prev) {
        cx.globalAlpha = (1 - i / P.trail) * 0.9;
        cx.beginPath(); cx.moveTo(prev[0], prev[1]); cx.lineTo(q[0], q[1]); cx.stroke();
      }
      prev = q;
    }
    cx.globalAlpha = 1;
    // the paper plane itself, pointing where it is going
    const [px, py, vx, vy] = path(u);
    cx.save(); cx.translate(px, py); cx.rotate(Math.atan2(vy, vx));
    cx.fillStyle = "#f2f4f7";
    cx.beginPath(); cx.moveTo(13, 0); cx.lineTo(-9, -8); cx.lineTo(-4, 0); cx.lineTo(-9, 8); cx.closePath(); cx.fill();
    cx.fillStyle = "#c9ced6";
    cx.beginPath(); cx.moveTo(13, 0); cx.lineTo(-9, 8); cx.lineTo(-4, 0); cx.closePath(); cx.fill();
    cx.restore();
  };

  drawMap(0);
  const tex = new THREE.CanvasTexture(c);
  car.screenArt = { c, cx, draw: drawMap, drawPlay, tex };
  // Sized and placed like the real one. The first version was a 1.5 m panel a
  // metre from his eye, which blanked the right third of the windscreen: at that
  // distance it subtended more than thirty degrees and he was driving past it.
  car.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.55),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  return car.screen;
}

// A tap on the screen itself starts and stops the cartoon. It is raycast
// against that one plane, so it can only ever be a tap on the screen -- every
// other touch in the cabin is still the stick, and driving is untouched.
const carTapRay = new THREE.Raycaster(), carTapNdc = new THREE.Vector2();
function carScreenTap(clientX, clientY) {
  if (!carActive() || state.viewChase || eject.active || state.exploding) return false;
  if (!car.screen || !car.cabin || !car.cabin.visible) return false;
  const r = renderer.domElement.getBoundingClientRect();
  carTapNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  carTapRay.setFromCamera(carTapNdc, camera);
  // Raycaster does not refresh world matrices, and the cabin is placed during
  // the update rather than the render -- so without this the ray is tested
  // against wherever the screen was last DRAWN, not where it is.
  car.screen.updateWorldMatrix(true, false);
  if (!carTapRay.intersectObject(car.screen, false).length) return false;
  car.screenPlaying = !car.screenPlaying;
  car.screenT = 0;
  synthBlip("sine", car.screenPlaying ? 620 : 480, car.screenPlaying ? 980 : 360, 0.12, 0.05, 0);
  return true;
}

// ---------------------------------------------------------------------------
// The cabin.
//
// The imported body is an exterior model: it has no interior at all, so from the
// driver's seat he was sitting inside an empty shell with the map floating in
// mid-air where a dashboard should have been. This builds the dashboard, the
// wheel, the pillars, the doors and the console that the shell is missing.
//
// It is drawn ONLY from the driver's seat, and the exterior body is hidden then,
// so the two never overlap and nothing here is ever seen from outside.
//
// Everything static is merged into three meshes -- one per material -- rather
// than left as eighteen boxes. three.js batches nothing on its own, and this
// rig under-prices draw calls compared with the iPad, which is the machine that
// has to hold sixty frames.
function carMergeBoxes(specs) {
  const pos = [], nor = [];
  const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  const t = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), n3 = new THREE.Matrix3();
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const b of specs) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
    e.set(b.rx || 0, b.ry || 0, b.rz || 0);
    m.compose(t.set(b.x, b.y, b.z), q.setFromEuler(e), one);
    n3.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.push(n.x, n.y, n.z);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function carBuildCabin() {
  if (car.cabin) return car.cabin;
  const C = TUNE.palette, K = CAR.cabin;
  const g = new THREE.Group();
  const HALF = K.halfWidth, TOP = K.dashTop, ROOF = K.roof, FLOOR = K.floor;

  // the soft furniture: doors, seat, console, pillars, header
  // Everything here is kept LOW and THIN on purpose. The first version was
  // built to realistic proportions and the windscreen came out as a letterbox:
  // a fat A-pillar a metre from his eye ate a quarter of the frame, and the
  // wheel sat above his sightline instead of under it. He has to see the road.
  const shell = [
    { w: 0.13, h: 0.80, d: 3.2, x: -HALF, y: 1.80, z: -0.10 },        // door cards, tops below his eye
    { w: 0.13, h: 0.80, d: 3.2, x:  HALF, y: 1.80, z: -0.10 },
    { w: 0.24, h: 0.11, d: 1.2, x: -HALF + 0.15, y: 2.00, z: -0.35 }, // armrests
    { w: 0.24, h: 0.11, d: 1.2, x:  HALF - 0.15, y: 2.00, z: -0.35 },
    { w: 0.84, h: 0.55, d: 2.0, x: 0, y: 1.35, z: 0.00 },             // centre console
    { w: 1.10, h: 0.20, d: 1.05, x: 0.88, y: 1.28, z: -0.15 },        // the empty seat beside him
    { w: 1.10, h: 1.10, d: 0.18, x: 0.88, y: 1.88, z: 0.40, rx: -0.16 },
    // No A-pillars. They were built and then taken out again: a free-standing
    // post cannot line up with the imported body's own glass, so it read as a
    // slab hanging in the middle of the windscreen rather than as a frame. The
    // header and the door tops frame the view perfectly well, and losing them
    // gave the road back a quarter of the width.
    { w: 3.95, h: 0.18, d: 0.45, x: 0, y: ROOF, z: -1.15 },           // header
  ];
  // One flat shelf all the way to the glass. There was a raised cowl at the
  // windscreen base to begin with, and from a driver's eye you looked straight
  // under its lip: a black notch across the middle of the car where the road
  // should have been. A single surface has no underside to see.
  const shelf = [
    { w: 3.95, h: 0.11, d: 1.55, x: 0, y: TOP, z: -2.48 },
  ];
  const hardParts = [
    { w: 3.95, h: 0.58, d: 0.13, x: 0, y: 1.44, z: -1.70 },           // the dash face
    { w: 0.16, h: 0.16, d: 0.50, x: K.seatX, y: 1.48, z: -1.62, rx: -0.30 }, // column
    { w: 0.62, h: 0.15, d: 0.08, x: 0, y: ROOF - 0.13, z: -1.08 },    // mirror
  ];

  // The shelf is the LIGHTEST thing in here, and that is deliberate. In ink it
  // read as a hole in the middle of the car rather than a surface, and the
  // screen standing on it looked like it was floating in front of the road. It
  // is the one surface he needs to read as solid, so it gets the light grey and
  // everything else stays back. The floor is dark because nothing down there
  // needs reading. There is no chrome vent strip: at this size it came out as a
  // hard white line straight across the frame and looked like a fault.
  const soft = mattMat(C.night), hard = mattMat(C.slate), top = mattMat(C.grey);
  const floor = [{ w: 3.85, h: 0.10, d: 3.00, x: 0, y: FLOOR, z: -1.00 }];
  for (const [specs, mat] of [[shell, soft], [hardParts, hard], [shelf, top], [floor, mattMat(C.ink)]]) {
    const m = new THREE.Mesh(carMergeBoxes(specs), mat);
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
  }

  // The steering wheel, which turns. It is the one moving thing in here, and it
  // is feedback rather than a control: he steers by dragging, and the wheel
  // shows him what his finger just did.
  const wheel = new THREE.Group();
  // Its top arc sits just under the dash line, which is where a driver sees it.
  // At 0.36 m and eye height it was a hoop across the middle of the road.
  wheel.position.set(K.seatX, 1.58, -1.40);
  wheel.rotation.x = -0.34;
  const rimMat = mattMat(C.ink);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.05, 7, 18), rimMat);
  wheel.add(rim);
  const spokes = new THREE.Mesh(carMergeBoxes([
    { w: 0.52, h: 0.06, d: 0.06, x: 0, y: 0, z: 0 },
    { w: 0.06, h: 0.26, d: 0.06, x: 0, y: -0.15, z: 0 },
    { w: 0.22, h: 0.22, d: 0.08, x: 0, y: 0, z: 0.01 },
  ]), hard);
  wheel.add(spokes);
  g.add(wheel);
  car.cabinWheel = wheel;

  // and the centre screen, standing on the dash where it belongs
  const sc = carBuildScreen();
  sc.position.set(K.screen[0], K.screen[1], K.screen[2]);
  sc.rotation.x = -0.22;
  sc.visible = true;
  g.add(sc);

  g.visible = false;
  scene.add(g);
  car.cabin = g;
  return g;
}

function carHideCabin() {
  if (car.cabin) car.cabin.visible = false;
}

// ---------------------------------------------------------------------------
// Where the road is
// ---------------------------------------------------------------------------
// Nearest road (the main line or any spur -- a spur is a road too, which is what
// makes taking an exit fall out of the same rule), plus an aim point that far
// AHEAD along it, offset onto the lane he is nearest.
function carRoadTarget() {
  if (typeof highway === "undefined" || !highway.built) return null;
  const n = hwyNearest(state.x, state.z);
  if (!n) return null;
  const LK = CAR.laneKeep;
  const ahead = Math.max(LK.minAhead, state.speed * LK.lookAhead);

  let best = { lateral: n.lateral, y: n.y, fx: n.fx, fz: n.fz, s: n.s, spur: null,
               dist: Math.abs(n.lateral) };
  for (const ex of highway.exits) {
    for (let i = 1; i < ex.spur.length; i++) {
      const a = ex.spur[i - 1], b = ex.spur[i];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((state.x - a.x) * dx + (state.z - a.z) * dz) / l2, 0, 1);
      const px = a.x + dx * t, pz = a.z + dz * t;
      const d = Math.hypot(state.x - px, state.z - pz);
      if (d < best.dist && d < HW.spurW * HW.spurCapture) {
        const l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l;
        best = { lateral: (state.x - px) * (-fz) + (state.z - pz) * fx,
                 y: lerp(a.y, b.y, t), fx, fz, s: a.s + l * t, spur: ex, dist: d };
      }
    }
  }

  // which way along this road is he travelling?
  const fwdDot = -Math.sin(state.heading) * best.fx + -Math.cos(state.heading) * best.fz;
  best.dir = fwdDot >= 0 ? 1 : -1;
  const off = carLaneCentre(best.lateral, !!best.spur);
  best.laneOff = off;

  // the aim point, `ahead` metres along the road in the direction of travel
  let ax, az;
  if (best.spur) {
    const sp = best.spur.spur;
    const want = clamp(best.s + ahead * best.dir, 0, sp[sp.length - 1].s);
    let i = 1; while (i < sp.length - 1 && sp[i].s < want) i++;
    const a = sp[i - 1], b = sp[i];
    const t = clamp((want - a.s) / Math.max(1e-3, b.s - a.s), 0, 1);
    ax = lerp(a.x, b.x, t); az = lerp(a.z, b.z, t);
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    ax += (-(b.z - a.z) / l) * off; az += ((b.x - a.x) / l) * off;
  } else {
    const q = hwySampleAt(clamp(best.s + ahead * best.dir, 0, highway.length));
    ax = q.x + (-q.fz) * off; az = q.z + q.fx * off;
  }
  best.aimX = ax; best.aimZ = az;
  return best;
}

// which lane centre is nearest, in metres from the road centreline
function carLaneCentre(lat, onSpur) {
  if (onSpur) return 0;
  const half = HW.medianW / 2;
  const dir = lat >= 0 ? 1 : -1;
  let bestOff = dir * (half + HW.laneW * 0.5), bestD = Infinity;
  for (let k = 0; k < HW.lanes; k++) {
    const off = dir * (half + HW.laneW * (k + 0.5));
    const d = Math.abs(lat - off);
    if (d < bestD) { bestD = d; bestOff = off; }
  }
  return bestOff;
}

// ---------------------------------------------------------------------------
function carSpawn(originIdx) {
  const idx = originIdx === undefined ? state.originIdx : originIdx;
  // On the on-ramp, in the near lane, nose the way he is going. It used to spawn
  // in a parking bay 34 m off the road, which is outside onRoadHalf -- so he
  // started off-road, at 45% speed, with only the weak off-road assist to find
  // his way on. Never start him somewhere he has to get himself out of.
  const fromCA = idx === 1;
  const end = hwySampleAt(fromCA ? highway.length - 140 : 140);
  const dir = fromCA ? -1 : 1;               // CA end drives back up the road
  const rx = -end.fz, rz = end.fx;
  const off = dir * (HW.medianW / 2 + HW.laneW * 0.5);
  state.x = end.x + rx * off;
  state.z = end.z + rz * off;
  state.y = end.y;
  state.heading = Math.atan2(-end.fx * dir, -end.fz * dir);
  state.speed = 0; state.pitch = 0; state.bank = 0; state.phase = "TAXI";
  car.steer = 0; car.boost = 0; car.offRoad = 0; car.charging = 0; car.chargedAt = null;
  carBuildCabin();
  thunk();
}

function carCrash() {
  if (state.exploding || performance.now() - car.lastCrash < 900) return;
  car.lastCrash = performance.now();
  triggerExplosion(state.x, state.y + 1.2, state.z, 1);
  cameraHitStop(1.2);
  state.exploding = true;
  state.explodeTimer = 0;
  flags.carCrashes = (flags.carCrashes || 0) + 1;
}

// Put him back on the road, pointing the way he was going. Nothing is lost.
function carReassemble() {
  const n = hwyNearest(state.x, state.z);
  if (!n) return;
  const rx = -n.fz, rz = n.fx;
  // Keep the direction he was travelling. Deriving it from which side of the
  // road he happened to land on turned him round after a crash, and he drove
  // back the way he came for the rest of the trip.
  const fwdDot = -Math.sin(state.heading) * n.fx + -Math.cos(state.heading) * n.fz;
  const dir = fwdDot >= 0 ? 1 : -1;
  const off = dir * (HW.medianW / 2 + HW.laneW * 0.5);
  state.x = highway.pts[n.i].x + rx * off;
  state.z = highway.pts[n.i].z + rz * off;
  state.y = n.y;
  state.heading = Math.atan2(-n.fx * dir, -n.fz * dir);
  state.speed = 0; car.steer = 0; car.boost = 0;
  flags.carReassembles = (flags.carReassembles || 0) + 1;
}

// ---------------------------------------------------------------------------
function updateCar(dt) {
  // one finger: no throttle button and no gear. The speed steps ARE up -- they
  // are taps, not a second finger -- and js/speed.js decides them once a frame.
  el.throttleBtn.classList.add("hidden");
  el.rotateArrow.classList.remove("on");
  el.gearBtn.classList.add("hidden");
  state.phase = "TAXI";

  if (state.exploding) { setTone("carWhine", "sawtooth", 60, 0); return; }

  const touching = state.touching && !menuOpen();
  const bank = touching ? clamp(state.ctrlBank, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;

  // ---- the road under him
  const road = carRoadTarget();
  car.onRoad = !!road && Math.abs(road.lateral) < CAR.onRoadHalf;
  car.lateral = road ? road.lateral : 0;
  car.roadY = road ? road.y : 0;
  const wantOff = car.onRoad ? 0 : 1;
  car.offRoad += (wantOff - car.offRoad) * Math.min(1, 3 * dt);

  // ---- speed. Finger down drives; off eases to a stop. Off-road is slower.
  const LK = CAR.laneKeep;
  if (pitch > 0.45 && touching && car.boost <= 0 && state.speed > CAR.cruise * 0.3) {
    car.boost = CAR.boostTime;
    cameraPunch(0.55);
    synthBlip("sine", 260, 1200, 0.45, 0.16, 0);
    flags.carBoosts = (flags.carBoosts || 0) + 1;
  }
  if (car.boost > 0) car.boost -= dt;
  const boosting = car.boost > 0 ? CAR.boost : 1;
  // The speed step scales the target and the cap. Lane keep is untouched and
  // still holds at the top step: `laneKeep.lookAhead` is a TIME, so the aim
  // point slides further ahead as he goes faster and the pursuit stays stable.
  const step = spdMul();
  const roadMax = CAR.cruise * step * lerp(1, CAR.offRoadMax, car.offRoad) * boosting;
  const want = touching ? roadMax : 0;
  const rate = (want > state.speed ? CAR.accel : CAR.brake) * dt;
  state.speed += clamp(want - state.speed, -rate, rate);
  state.speed = clamp(state.speed, 0, CAR.cruise * step * CAR.boost * 1.05);
  if (state.speed < 0.05) state.speed = 0;

  // ---- steering. His stick first; the assist only when he is not using it.
  // The stick DOMINATES the assist rather than switching it off. With the assist
  // off entirely, holding a steer at an exit just drove him into the field: he
  // left the main line, never picked the spur up, and the exit was unreachable
  // by the only gesture the brief gives him. Blending means holding right pulls
  // him across, the spur becomes the nearest road, and the assist then follows
  // it -- so "hold longer at an exit and you take the exit" falls out.
  let cmd = bank * CAR.steerRate;
  const steering = Math.abs(bank) > 0.08;
  if (road) {
    // Pure pursuit: aim at a point on his lane a second or so ahead. A positive
    // steer command turns the nose right, and heading DECREASES to the right, so
    // the command is the negated bearing error.
    const want = Math.atan2(-(road.aimX - state.x), -(road.aimZ - state.z));
    const hErr = wrapPi(want - state.heading);
    const gain = car.onRoad ? LK.gain : LK.offRoadGain;
    const assist = clamp(-hErr / DEG * gain, -CAR.steerRate, CAR.steerRate);
    const w = Math.min(1, Math.abs(bank) / LK.override);
    cmd = bank * CAR.steerRate * w + assist * (1 - w);
  }
  car.steer += (cmd - car.steer) * Math.min(1, CAR.steerAccel * dt);
  // it steers only when it is rolling, like a car
  const grip = clamp(state.speed / (CAR.cruise * 0.35), 0, 1);
  state.heading -= car.steer * DEG * dt * grip;
  state.bank += ((car.steer / CAR.steerRate) * 6 - state.bank) * Math.min(1, 6 * dt);

  // ---- move
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  state.x += fx * state.speed * dt;
  state.z += fz * state.speed * dt;
  forward.set(fx, 0, fz);

  // ---- height.
  //
  // He drove underground, and it took three separate fixes. The support used to
  // snap between the road deck and the terrain the instant `onRoad` flipped, and
  // those are up to 17 m apart on an embankment. So: the support BLENDS across
  // the shoulder; rising ground is followed instantly while only falling ground
  // is eased (a car crests a hill, it does not sink into it) and a drop too big
  // to be a crest is taken at once; and where the deck is well above the ground
  // the guardrail actually holds him, so he cannot leave a bridge at all.
  const gnd = Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
  let support = gnd;
  if (road) {
    const off = clamp((Math.abs(road.lateral) - CAR.onRoadHalf) / CAR.shoulderBlend, 0, 1);
    support = lerp(road.y, gnd, off);
    // `railed`: the harbour spur is the only spur that crosses water, on the
    // drawbridge, and without the main road's guardrail he can steer off the
    // side of the span and into the sea. Every other spur runs on the ground and
    // never asks for one.
    if ((!road.spur || road.spur.railed) && road.y - gnd > CAR.railAt) {
      const lim = (road.spur ? HW.spurW : highway.halfW) - 1.6;
      if (Math.abs(road.lateral) > lim) {
        const rx = -road.fz, rz = road.fx, sgn = Math.sign(road.lateral);
        const push = Math.abs(road.lateral) - lim;
        state.x -= rx * sgn * push; state.z -= rz * sgn * push;
        support = road.y; car.onRoad = true;
        if (state.speed > 6) noiseBurst(0.06, 260, 0.10, 0);
      }
    }
  }
  car.dbg = { support, roadY: road ? road.y : null, lateral: road ? road.lateral : null,
              gnd, spur: !!(road && road.spur), onRoad: car.onRoad };
  const drop = support - state.y;
  if (drop > 0) state.y = support;
  else if (drop < -CAR.settleMax) state.y = support;
  else state.y += drop * Math.min(1, CAR.suspension * dt);
  state.airVy = 0;

  // off-road is bumpy and dusty
  if (car.offRoad > 0.4 && state.speed > 4) {
    rumble = Math.max(rumble, 0.12 * car.offRoad);
    car.dust -= dt;
    if (car.dust <= 0) {
      car.dust = 0.09;
      wakePuff(state.x - fx * 4, state.y + 0.4, state.z - fz * 4, 0xc9b98a, 1.1, 3, 1.1);
    }
  }

  // ---- traffic and walls
  const hit = hwyTrafficNear(state.x, state.z, 5.2);
  if (hit) {
    if (state.speed > CAR.crashSpeed) { hwyKnockTraffic(hit); carCrash(); }
    else { state.speed *= 0.4; hwyKnockTraffic(hit); noiseBurst(0.12, 220, 0.2, 0); }
  }
  resolveSolidWalls();

  // ---- charging stalls: a ritual, nothing tracked
  for (const c of highway.charges) {
    const d = Math.hypot(state.x - c.x, state.z - c.z);
    if (d < 16 && state.speed < 6) {
      if (car.chargedAt !== c) {
        car.chargedAt = c; c.t = HW.charge.seconds; car.charging = HW.charge.seconds;
        chime(); flags.carCharges = (flags.carCharges || 0) + 1;
      }
    } else if (car.chargedAt === c && d > 26) car.chargedAt = null;
  }
  if (car.charging > 0) car.charging -= dt;

  // ---- the model
  if (vehicleModel) {
    const lb = vehicleModel.userData.lightBar, tb = vehicleModel.userData.tailBar;
    if (lb) {
      const pulse = car.charging > 0 ? (0.35 + 0.65 * Math.abs(Math.sin(performance.now() * 0.004))) : 1;
      lb.material.color.setScalar(0.55 + 0.45 * pulse);
      if (tb) tb.material.color.setRGB(0.6 + 0.4 * (touching ? 0.2 : 1), 0.12, 0.1);
    }
    // Wheels. Rolling, not sliding: the top of the wheel travels the way the car
    // does, and the nose is -Z, so forward motion is a NEGATIVE turn about X.
    // The fronts also steer, on a "YXZ" group so the yaw stays outside the spin.
    const wheels = vehicleModel.userData.wheels || [];
    if (wheels.length) {
      const wr = vehicleModel.userData.wheelR || CAR.wheelR;
      car.wheelSpin = (car.wheelSpin - state.speed * dt / wr) % (Math.PI * 2);
      const lock = -(car.steer / CAR.steerRate) * CAR.wheelLock * DEG;
      const fronts = vehicleModel.userData.wheelsFront;
      for (const w of wheels) {
        w.rotation.x = car.wheelSpin;
        if (fronts) w.rotation.y = fronts.indexOf(w) >= 0 ? lock : 0;
      }
    }
  }

  // ---- sound: an EV whine that rises with speed, tyres, and wind
  const n = clamp(state.speed / CAR.cruise, 0, 1.4);
  setTone("carWhine", "sawtooth", lerp(CAR.whineHz[0], CAR.whineHz[1], n), state.speed > 0.2 ? 0.035 : 0);
  setTone("carTyre", "triangle", 90 + n * 40, state.speed > 2 ? CAR.tyreGain * n : 0);
  setEngine(0);
}

// ---------------------------------------------------------------------------
function carCamera(dt) {
  camera.up.set(0, 1, 0);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  if (state.viewChase) {
    camDesired.set(state.x - fx * CAR.camChase[0], state.y + CAR.camChase[1], state.z - fz * CAR.camChase[0]);
    camera.position.lerp(camDesired, Math.min(1, CAR.camLag * dt));
    lookV.set(state.x + fx * 18, state.y + 1.6, state.z + fz * 18);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG * 0.3);
    carHideCabin();
  } else {
    // The driver's seat. The cabin is one group standing at the car's own
    // origin, so the eye, the dash, the wheel and the screen are all fixed
    // relative to each other and only the group moves.
    const K = CAR.cabin, rx = -fz, rz = fx;
    const bodyH = (vehicleModel && vehicleModel.userData.height) || CAR.bodyH * 1.22;
    camera.position.set(state.x + fx * 0.2 + rx * K.seatX, state.y + bodyH * CAR.eyeFrac, state.z + fz * 0.2 + rz * K.seatX);
    camera.rotation.set(-0.05, state.heading, -state.bank * DEG * 0.25);
    const cab = carBuildCabin();
    cab.visible = true;
    cab.position.set(state.x, state.y, state.z);
    cab.rotation.y = state.heading;
    // the wheel shows him what his finger just did
    if (car.cabinWheel) car.cabinWheel.rotation.z = -(car.steer / CAR.steerRate) * CAR.wheelLock * DEG * K.wheelTurn;
    // The centre screen: the moving map, or the cartoon he has pressed play on.
    // Both are graphics and neither is ever a glyph. The cartoon redraws three
    // times as often as the map, because a map that steps is fine and a plane
    // that steps is not.
    if (car.screenArt) {
      if (car.screenPlaying) {
        car.screenT += dt;
        if ((frameCount % CAR.screenPlay.every) === 0) {
          car.screenArt.drawPlay(car.screenT);
          car.screenArt.tex.needsUpdate = true;
        }
      } else if ((frameCount % 6) === 0) {
        const road = typeof highway !== "undefined" && highway.built ? hwyNearest(state.x, state.z) : null;
        const rh = road ? Math.atan2(-road.fx, -road.fz) : state.heading;
        car.screenArt.draw(wrapPi(rh - state.heading));
        car.screenArt.tex.needsUpdate = true;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// THE HORN
//
// WORKING RULES. The car's drag-up is already the launch burst, so the horn
// takes the contextual control the car has never had. It is a SMALL icon beside
// eject rather than a big pulsing round button, because it is not a set-piece
// invitation -- it is a thing he can do whenever he likes, the way a horn is,
// and the round slots are for things that only exist somewhere.
//
// TAP PLAYS THE PAIR ONCE, HOLD SUSTAINS IT. Both notes sound together (a real
// two-tone horn is a dyad, not a sequence); `tap` is how long the pair rings on
// its own, and holding simply keeps the same two tones up until he lets go or
// `sustainMax` runs out. There is no timing in it and nothing to get wrong.
//
// IT IS ANSWERED, AND NOTHING IS EVER REQUIRED OF HIM. Traffic honks back some
// of the time; the yacht and the cruise ship answer from the harbour spur where
// he can hear them across the water; and near the drawbridge the bells and
// beacons come on early. None of those blocks anything, none can be lost, and
// none of them has to happen for him to get anywhere -- the same three rules
// the sea events obey.
// ---------------------------------------------------------------------------
function carHornCan() { return carActive() && !state.exploding && !eject.active; }

function carHornPress() {
  if (!carHornCan()) return;
  const H = CAR.horn;
  car.hornHeld = true;
  car.hornT = Math.max(car.hornT, H.tap);
  car.hornSustain = 0;
  flags.carHorns = (flags.carHorns || 0) + 1;
  carHornReplies();
}

function carHornRelease() { car.hornHeld = false; }

// Who hears it. One answer per honk, on a cooldown, so leaning on the button
// never turns into a chorus.
function carHornReplies() {
  const H = CAR.horn;
  if (car.hornReplyCool > 0) return;
  car.hornReplyCool = H.replyCooldown;

  // ---- the drawbridge: the wind-up comes forward, the bridge does not lift.
  // Honking can never open it -- that would make the horn a thing he has to
  // press to get across -- it only brings the bells and beacons on, and if a
  // lift was already counting down it starts sooner.
  if (typeof hbBridgeHonked === "function") hbBridgeHonked(state.x, state.z, H.bridgeRange);

  // ---- traffic, occasionally: a shorter, higher, quieter honk back.
  if (typeof hwyTrafficNear === "function" && hwyTrafficNear(state.x, state.z, H.trafficRange)
      && Math.random() < H.trafficChance) {
    const d = lerp(H.trafficDelay[0], H.trafficDelay[1], Math.random());
    setTimeout(() => {
      synthBlip("sawtooth", H.hz[0] * 1.18, H.hz[0] * 1.16, 0.30, 0.055, 0);
      synthBlip("sawtooth", H.hz[1] * 1.18, H.hz[1] * 1.16, 0.30, 0.040, 0);
    }, d * 1000);
  }

  // ---- the big ships answer from the water. A car horn and a ship's horn an
  // octave and a half below it is the whole joke, and the harbour spur is the
  // one bit of road where he is close enough to both to hear it.
  let ship = null;
  if (typeof yacht !== "undefined" && yacht.x !== undefined) ship = { x: yacht.x, z: yacht.z, hz: YT.horn.hz, dur: YT.horn.dur };
  if (typeof sea !== "undefined" && sea.cruise && sea.cruise.state !== "away" && sea.cruise.state !== "calling") {
    const dc = Math.hypot(state.x - sea.cruise.x, state.z - sea.cruise.z);
    const dy = ship ? Math.hypot(state.x - ship.x, state.z - ship.z) : Infinity;
    if (dc < dy) ship = { x: sea.cruise.x, z: sea.cruise.z, hz: SE.cruise.hornHz, dur: 3.0 };
  }
  if (ship && Math.hypot(state.x - ship.x, state.z - ship.z) < H.seaRange) {
    setTimeout(() => hbHorn(ship.x, TUNE.waterLevel + 16, ship.z, ship.hz, ship.dur), H.seaDelay * 1000);
  }
}

// The two tones, and the button. Driven from the tail of update() rather than
// from updateCar, so that leaving the car -- or exploding in it, which returns
// out of updateCar early -- can never leave a horn sounding.
function carUpdateHorn(dt) {
  const H = CAR.horn;
  if (car.hornReplyCool > 0) car.hornReplyCool -= dt;
  if (car.hornT > 0) car.hornT -= dt;
  if (car.hornHeld) {
    car.hornSustain += dt;
    if (car.hornSustain > H.sustainMax) car.hornHeld = false;   // it cannot be leaned on forever
  } else {
    car.hornSustain = 0;
  }
  const on = carHornCan() && (car.hornHeld || car.hornT > 0);
  setTone("carHornA", "sawtooth", H.hz[0], on ? H.gain : 0);
  setTone("carHornB", "sawtooth", H.hz[1], on ? H.gain * 0.8 : 0);
  if (!carHornCan()) { car.hornHeld = false; car.hornT = 0; }
  el.hornBtn.classList.toggle("hidden", !carHornCan());
  el.hornBtn.classList.toggle("pressed", on);
}
