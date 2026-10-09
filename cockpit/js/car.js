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
// toward the nearest road IN FRONT of him, gently, so he can never be stranded
// -- and driving across the fields at a city, the city is where it takes him,
// not the motorway behind him (carRejoinTarget).
//
// A BANG COMES BACK ON THE ROAD HE WAS ON, where it happened: the street, the
// ramp, the boulevard, the carriageway -- or, off every road, the spot itself.
// Never on some other road because it happened to be the nearest.

const CAR = TUNE.car;

const car = {
  steer: 0, boost: 0, offRoad: 0, wheelSpin: 0,
  onRoad: false, lateral: 0, s: 0, roadY: 0,
  charging: 0, chargedAt: null, dust: 0, screen: null, screenArt: null, cabin: null, cabinWheel: null,
  screenPlaying: false, screenT: 0,
  hornHeld: false, hornT: 0, hornSustain: 0, hornReplyCool: 0, crashCool: 0,
  crashX: null, crashZ: null, crashOn: null, crashNx: 0, crashNz: 0,
  road: null, rejoin: null, rejoinT: 0, rejoinPts: null,
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
// mergeBoxes moved to js/scene.js and is now `mergeBoxes`. It was never the
// car's: the harbour, the lock, the boat, the yacht and the models rig all use
// it, and harbor.js had a comment saying it loaded after car.js "precisely so
// it can" -- a load order that existed because a general helper was living in a
// vehicle.
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
    const m = new THREE.Mesh(mergeBoxes(specs), mat);
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
  const spokes = new THREE.Mesh(mergeBoxes([
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
// OFF THE ROAD: WHICH ROAD TAKES HIM BACK. The nearest road in the direction he
// is facing -- the motorway, a spur, or a city street -- scored by distance and
// by how far off his nose it lies. Nothing ahead: null, and the nearest road
// answers as it always did. Every road is sampled once, into one flat list.
function carRejoinPoints() {
  const n = (typeof streets !== "undefined" && streets.roads) ? streets.roads.length : 0;
  if (car.rejoinPts && car.rejoinPts.roads === n) return car.rejoinPts;
  const R = CAR.rejoin, xs = [], zs = [], kind = [];
  const add = (x, z, k) => { xs.push(x); zs.push(z); kind.push(k); };
  for (const p of highway.pts) add(p.x, p.z, 0);
  // never a road in the air -- a flyover, a bridge deck: he would arrive under it
  const up = (x, z, y) => y - Math.max(terrainEff(x, z), TUNE.waterLevel) > 3;
  for (const ex of highway.exits) for (let i = 2; i < ex.spur.length; i++) {
    const p = ex.spur[i];
    if (!up(p.x, p.z, p.y)) add(p.x, p.z, 1);
  }
  if (n) for (const r of streets.roads) {
    if (r.kind !== "grid" && r.kind !== "link") continue;
    const m = Math.max(1, Math.round(r.len / R.sample));
    const q = {};
    for (let k = 0; k <= m; k++) {
      const s = r.len * k / m;
      stPointAt(r, s, 1, 0, q);
      if (!r.drape && up(q.x, q.z, stRoadY(r, q.x, q.z, s))) continue;
      add(q.x, q.z, 2);
    }
  }
  car.rejoinPts = { roads: n, xs: Float32Array.from(xs), zs: Float32Array.from(zs), kind: Uint8Array.from(kind) };
  return car.rejoinPts;
}

function carRejoinTarget(dt) {
  const R = CAR.rejoin;
  car.rejoinT -= dt || 0;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const score = (x, z) => {
    const dx = x - state.x, dz = z - state.z, d = Math.hypot(dx, dz) || 1e-3;
    const c = (dx * fx + dz * fz) / d;
    return (c < R.cone || d > R.reach) ? Infinity : d * (1 + R.turnCost * (1 - c));
  };
  if (car.rejoin && car.rejoinT > 0) { car.rejoin.d = Math.hypot(car.rejoin.x - state.x, car.rejoin.z - state.z); return car.rejoin; }
  car.rejoinT = R.every;
  const P = carRejoinPoints();
  let bi = -1, bs = Infinity;
  for (let i = 0; i < P.xs.length; i++) {
    const sc = score(P.xs[i], P.zs[i]);
    if (sc < bs) { bs = sc; bi = i; }
  }
  // the old pick holds unless the new one is clearly better: no dithering
  // between two roads at about the same distance
  if (car.rejoin) {
    const old = score(car.rejoin.x, car.rejoin.z);
    if (old < Infinity && old <= bs * R.stick) bi = -2;
  }
  if (bi === -1) { car.rejoin = null; return null; }
  if (bi >= 0) car.rejoin = { x: P.xs[bi], z: P.zs[bi], kind: ["road", "spur", "street"][P.kind[bi]], d: 0 };
  car.rejoin.d = Math.hypot(car.rejoin.x - state.x, car.rejoin.z - state.z);
  return car.rejoin;
}

// ---------------------------------------------------------------------------
// Nearest road (the main line or any spur -- a spur is a road too, which is what
// makes taking an exit fall out of the same rule), plus an aim point that far
// AHEAD along it, offset onto the lane he is nearest.
function carRoadTarget(steer01, dt) {
  if (typeof highway === "undefined" || !highway.built) return null;
  // A city street (streets.js) is a road too, and there the planner answers:
  // which road he is on, the junction ahead, the corner. A city's spurs are the
  // motorway's until he is near the grid, then the planner's.
  if (typeof stCarNear === "function" && stCarNear(state.x, state.z, state.y)) {
    const handsOff = (car.yield === undefined || car.yield >= 1) && !(Math.abs(steer01 || 0) > 0);
    const st = stCarTarget(state.x, state.z, state.heading, state.speed, steer01 || 0, handsOff, dt || 0);
    if (st) {
      const k = st.street.kind;
      const node = st.street.a || st.street.b;
      const near = node && Math.hypot(state.x - node.x, state.z - node.z) < TUNE.city.handoff;
      if (k === "grid" || k === "link" || near) { car.onSpurRoad = false; car.onStreet = true; car.rejoin = null; return st; }
    }
  }
  car.onStreet = false;
  const n = hwyNearest(state.x, state.z);
  if (!n) return null;
  const LK = CAR.laneKeep;
  const ahead = Math.max(LK.minAhead, state.speed * LK.lookAhead);

  // An exit is HIS to take. Measured from the centreline, a spur's mouth comes
  // within the outer lane's 14 m, and that is what lets a held steer pick the
  // spur up while he is still on the carriageway -- the exit gesture. But with
  // no hand on the stick at all, the same sum let every exit capture the car at
  // the slow step (too slow to be past before it bit): it ran the spur to its
  // end, turned round and met the traffic coming back. So hands-off on the main
  // line, the carriageway counts as distance zero and no spur can win; once he
  // has steered onto a spur, the old sum holds until he is back on the main line.
  const handsOff = (car.yield === undefined || car.yield >= 1) && !car.onSpurRoad;
  // A road he is not level with is not his: on a flyover over the motorway the
  // motorway is under him, not beside him (streets.js, ST.levelTol).
  const lvl = typeof ST !== "undefined" ? ST.levelTol : Infinity;
  const mainOff = Math.abs(n.y - state.y) > lvl;
  let best = { lateral: n.lateral, y: n.y, fx: n.fx, fz: n.fz, s: n.s, spur: null,
               dist: handsOff ? Math.max(0, Math.abs(n.lateral) - highway.halfW) : Math.abs(n.lateral) };
  const mainDist = best.dist;
  if (mainOff) best.dist = Infinity;
  // A city's way off is taken from its LANE: he has to have moved over toward
  // it, as for any exit, not merely touched the stick in the lane beside it.
  const laneDist = Math.abs(n.lateral - carLaneCentre(n.lateral, false));
  const hx = -Math.sin(state.heading), hz = -Math.cos(state.heading);

  // THE EXIT GESTURE, at a city's way off: the same rule as a turn in the city.
  // A FULL steer right (`CAR.fullSteer` of the drag range) held on its painted
  // approach -- from a little before the gantry to where the ramp has left the
  // kerb -- takes that ramp: lane-keep takes the lane and then the ramp, and the
  // held finger reads as hands-off while it does, so he is never steered into
  // the verge. Let go before the ramp is his and he goes straight on. Nothing
  // latches and nothing is remembered: a light touch, or none, never takes it.
  // (`steer01` arrives as his hold: zero below a full steer.)
  const heldRight = (steer01 || 0) > 0;
  const approach = (ex) => {
    const g = ex.gantry;
    if (!g || Math.sign(n.lateral) !== g.c || (hx * n.fx + hz * n.fz) * g.c < 0.5) return false;
    const along = (n.s - g.s) * g.c;                             // metres past the gantry
    return along > -ST.ramp.chooseEarly && along < (ex.spur[0].hs - g.s) * g.c + ST.ramp.taperLen;
  };
  let choice = car.exitChoice || null;
  // (once the ramp is his, the spent hold keeps it: the finger has not moved)
  const keeps = heldRight || (car.spent && car.spurRec === choice);
  if (choice && (!keeps || (car.spurRec !== choice && !approach(choice)))) choice = null;
  if (!choice && heldRight && !mainOff) {
    for (const ex of highway.exits) if (approach(ex)) { choice = ex; break; }
  }
  car.exitChoice = choice;

  for (const ex of highway.exits) {
    const on = car.spurRec === ex;
    if (choice && ex !== choice) continue;
    // A way ON is never taken from the carriageway itself.
    if (ex.out && !on && Math.abs(n.lateral) < highway.halfW && !mainOff) continue;
    for (let i = 1; i < ex.spur.length; i++) {
      const a = ex.spur[i - 1], b = ex.spur[i];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((state.x - a.x) * dx + (state.z - a.z) * dz) / l2, 0, 1);
      if (i === 1 && t <= 0) continue;                 // short of its mouth: still the motorway
      if (Math.abs(lerp(a.y, b.y, t) - state.y) > (on ? lvl : ST.levelCatch)) continue;
      // Only the way it runs: a spur's direction of travel is away from the
      // motorway, a way on's toward it -- and it leaves the motorway going one
      // way along it. Taken against either, lane-keep drove the spur backwards
      // to its mouth, or took the other carriageway's exit across the median.
      if (!on) {
        const sg = ex.out ? -1 : 1;
        if ((dx * n.fx + dz * n.fz) * sg * (hx * n.fx + hz * n.fz) < 0) continue;
        if ((dx * hx + dz * hz) * sg < 0.2 * Math.sqrt(l2)) continue;
      }
      const px = a.x + dx * t, pz = a.z + dz * t;
      const d = Math.hypot(state.x - px, state.z - pz);
      const vs = choice ? (best.spur ? best.dist : Infinity)     // the chosen ramp's nearest point, not its last
        : ex.fromLane && !on && !mainOff && !handsOff ? Math.min(best.dist, laneDist) : best.dist;
      // a chosen ramp is taken where it is, beside him, not from fifty metres
      // back -- and once taken, held while he is still swinging over to it
      const reach = choice ? (on ? ST.ramp.holdReach : ST.ramp.halfW + 8) : HW.spurW * HW.spurCapture;
      if (d < vs && d < reach) {
        const l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l;
        best = { lateral: (state.x - px) * (-fz) + (state.z - pz) * fx,
                 y: lerp(a.y, b.y, t), fx, fz, s: a.s + l * t, spur: ex, dist: d };
      }
    }
  }
  if (!best.spur) best.dist = mainDist;
  car.spurRec = best.spur;
  // the choice made: to the outer lane until the ramp leaves, then down it,
  // for as long as the hold that chose it lasts
  if (choice) best.holding = true;

  // which way along this road is he travelling?
  const fwdDot = -Math.sin(state.heading) * best.fx + -Math.cos(state.heading) * best.fz;
  best.dir = fwdDot >= 0 ? 1 : -1;
  // (the move across to the exit lane waits while a car is beside him in it:
  // the assist is making this lane change, so it must not make it into a car)
  const outerLane = Math.sign(n.lateral) * (HW.medianW / 2 + HW.laneW * 1.5);
  const off = choice && !best.spur && !carLaneBusy(Math.sign(n.lateral), HW.lanes - 1, n.s, outerLane, n.lateral)
    ? outerLane : carLaneCentre(best.lateral, !!best.spur);
  best.laneOff = off;

  // the aim point, `ahead` metres along the road in the direction of travel
  let ax, az;
  if (best.spur) {
    const sp = best.spur.spur;
    // a city's ramp bends as a street's corner does, and is aimed along as one:
    // from 1.5 s the pursuit cut the inside of a flyover's peel at the top step
    const look = best.spur.city ? Math.max(TUNE.city.turnAhead, Math.min(ahead, state.speed * TUNE.city.turnLook)) : ahead;
    const want = clamp(best.s + look * best.dir, 0, sp[sp.length - 1].s);
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
  // THE MOTORWAY'S ENDS ARE TURNAROUNDS. The road stops, and a finger held
  // straight drove him off the end at cruise -- in California into the building
  // a hundred metres on. So, as at the city's one dead end (the bridge deck),
  // the road ending is taken round: the speed comes off on the approach, and in
  // the last metres lane-keep turns him back into the other carriageway's lane.
  // Speed-only, and only while he is not steering; hands on, it is his.
  if (!best.spur) {
    const E = HW.endTurn, toEnd = best.dir > 0 ? highway.length - best.s : best.s;
    if (toEnd < E.zone) {
      best.cap = Math.sqrt(E.speed * E.speed + 2 * E.brake * Math.max(0, toEnd - E.turnAt));
      if (toEnd < E.turnAt) {
        const q = hwySampleAt(best.s - best.dir * E.back), o = -best.laneOff;
        best.aimX = q.x + (-q.fz) * o; best.aimZ = q.z + q.fx * o; best.endTurn = true;
      }
    }
  }
  car.onSpurRoad = !!best.spur;
  // on a city's ramp, the speed its bends ahead allow (streets.js, the ramp
  // assist) -- and from the moment he has chosen one, on the way to it: at the
  // top step the ramp's mouth swings out faster than the car can follow
  const rampRec = best.spur && best.spur.city ? best.spur : choice;
  if (rampRec) {
    const sp = rampRec.spur, reach = state.speed * state.speed / (2 * ST.ramp.safeBrake) + 40;
    // how far along the ramp he is; short of its mouth, how far short
    const at = rampRec === best.spur ? best.s * best.dir
      : -Math.max(0, (sp[0].hs - n.s) * (rampRec.gantry ? rampRec.gantry.c : 1));
    const dir = rampRec === best.spur ? best.dir : 1;
    let cap = Infinity;
    for (const p of sp) {
      const d = p.s * dir - at;
      if (d < -5 || d > reach || !(p.vSafe < Infinity)) continue;
      cap = Math.min(cap, Math.sqrt(p.vSafe * p.vSafe + 2 * ST.ramp.safeBrake * Math.max(0, d)));
    }
    best.cap = cap;
  }
  // on the last of a way on, the motorway's traffic sees him in its outer lane
  // and makes room, as it does for him anywhere in his lane
  car.merging = best.spur && best.spur.out && best.s < CAR.mergeLook ? carMergeSide(best.spur) : 0;
  // OFF THE ROAD, the pull-back aims at the road in front of him. Only the AIM
  // moves: the height, the shoulder and the guardrail stay the nearest road's,
  // because that is the ground he is actually beside. It used to be the nearest
  // road, full stop -- so driving across the fields at a city, every time he
  // let go the car swung round and took him back to the motorway behind him.
  const offRoad = best.spur ? best.dist > HW.spurW + 4 : Math.abs(best.lateral) > CAR.onRoadHalf + 4;
  const T = offRoad ? carRejoinTarget(dt) : null;
  if (!offRoad) car.rejoin = null;
  if (T && T.d > CAR.rejoin.near) { best.aimX = T.x; best.aimZ = T.z; best.rejoin = T; }
  return best;
}

// Is there a car in lane `lane` of his carriageway, alongside him? Only asked
// while he is still short of that lane: once he is in it, it is his.
function carLaneBusy(side, lane, s, laneLat, lat) {
  if (Math.abs(lat - laneLat) < HW.laneW * 0.5) return false;
  for (const t of highway.traffic) {
    if (!t.alive || t.dir !== side || Math.abs((t.laneF === undefined ? t.lane : t.laneF) - lane) > 0.5) continue;
    if (Math.abs(t.s - s) < CAR.laneClear) return true;
  }
  return false;
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
// Which carriageway a way on joins: the sign of its lateral offset. The city
// ramps write `lat` on their samples; the toy track's road back (track.js)
// writes none, and `lat || 1` read that as the +1 carriageway every time -- so
// on the -1 carriageway the traffic in the lane he was joining never saw him,
// and a car coming up level hit him at the merge. Where a road has no `lat`,
// ask the motorway where its last sample, the join, actually is. Asked once.
function carMergeSide(rec) {
  const lat0 = rec.spur[0].lat;
  if (lat0 !== undefined) return Math.sign(lat0) || 1;
  if (rec.mergeSide === undefined) {
    const e = rec.spur[rec.spur.length - 1], n = hwyNearest(e.x, e.z);
    rec.mergeSide = Math.sign(n.lateral) || 1;
  }
  return rec.mergeSide;
}

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
  car.yield = 1; car.assistOff = 0;      // the assist is back the moment he is
  car.exitChoice = null; car.spurRec = null; car.lastHeld = 0; car.liftT = 0; car.spent = 0; car.arrived = null;
  if (typeof stPlan !== "undefined") { stPlan.road = null; stPlan.turn = null; }
  carBuildCabin();
  thunk();
}

function carCrash(nx, nz) {
  // A countdown the frame drives, not a wall-clock stamp -- see boatCrash for
  // what the old form did: with `lastCrash` starting at 0 it compared the age of
  // the page for the first nine hundred milliseconds, so the car could not crash
  // at all in that window, and never at all under the harness's compressed time.
  if (state.exploding || car.crashCool > 0) return;
  car.crashCool = CAR.crashDebounce;
  // WHERE IT HIT, remembered here, because the shared reassembly does not know.
  // Every vehicle's reassembly begins by teleporting to `safePos`, which only
  // the AEROPLANE ever writes -- so the car came back wherever the last plane
  // crashed, then snapped to the road nearest THAT. Crash at one end of the
  // coast road after a flight and he reappeared at the other end. The boat has
  // always kept its own crash position for exactly this reason.
  car.crashX = state.x; car.crashZ = state.z;
  // ... and the ROAD it happened on, which the nearest road is not: from the
  // boulevard the nearest was the motorway 800 m away, and on a city ramp the
  // carriageway beside it. The planner's street is his road even when the bang
  // was on the pavement against the building.
  const r = car.road;
  car.crashOn = !r ? { off: true }
    : r.street ? { street: r.street }
    : r.spur && r.dist < HW.spurW + 12 ? { spur: r.spur }
    : !r.spur && Math.abs(r.lateral) < CAR.onRoadHalf + 12 ? { main: true } : { off: true };
  car.crashNx = nx || 0; car.crashNz = nz || 0;
  triggerExplosion(state.x, state.y + 1.2, state.z, 1);
  cameraHitStop(1.2);
  state.exploding = true;
  state.explodeTimer = 0;
  flags.carCrashes = (flags.carCrashes || 0) + 1;
}

// A wall, at speed, is a bang. At a crawl it is a shove -- the same two outcomes
// as touching traffic, at the same threshold, so nudging a quay at kerb speed
// never costs him the drive. Called by resolveSolidWalls through the contract;
// returning true keeps it off the shared explode-to-safePos path, which only an
// aeroplane can come back from.
function carWallHit(push, hit) {
  // a parked car is knocked spinning either way, as it always was
  if (hit && hit.b && hit.b.park && typeof stKnock === "function") stKnock(hit.b.park);
  // (Only when a crash CAN happen: inside the crash debounce carCrash returns
  // at once, and a wall at speed then did nothing at all -- he drove on through
  // it. Inside the debounce, a wall is a shove at any speed.)
  if (state.speed > CAR.crashSpeed && car.crashCool <= 0 && !state.exploding) {
    shatterAround(state.x, state.y, state.z);
    carCrash(push.nx, push.nz);
    return true;
  }
  state.x += (push.nx || 0) * 2.5;
  state.z += (push.nz || 0) * 2.5;
  state.speed *= 0.35;
  car.boost = 0;
  noiseBurst(0.12, 220, 0.2, 0);
  return true;
}

// Put him back on the road he was on, where it happened, pointing the way he
// was going. Nothing is lost.
function carReassemble() {
  // From where it HIT, not from wherever the shared safePos left him.
  const fromX = car.crashX !== null ? car.crashX : state.x;
  const fromZ = car.crashZ !== null ? car.crashZ : state.z;
  const on = car.crashOn || {};
  const nx = car.crashNx, nz = car.crashNz;
  car.crashX = car.crashZ = null; car.crashOn = null; car.crashNx = car.crashNz = 0;
  car.rejoin = null; car.exitChoice = null; car.spurRec = null; car.lastHeld = 0; car.spent = 0; car.arrived = null;
  const settle = () => { state.speed = 0; car.steer = 0; car.boost = 0; car.yield = 1; car.assistOff = 0;
                         flags.carReassembles = (flags.carReassembles || 0) + 1; };
  // A city street -- or a city ramp, which is the planner's road near the grid
  // and a highway spur further out: either way the same road. Off the street
  // in a city (the square, a pavement), the nearest street.
  const street = typeof stReassembleAt !== "function" ? null
    : on.street ? stReassembleAt(fromX, fromZ, state.heading, on.street)
    : on.spur && on.spur.street ? stReassembleAt(fromX, fromZ, state.heading, on.spur.street)
    : on.off ? stReassembleAt(fromX, fromZ, state.heading) : null;
  if (street) {
    state.x = street.x; state.z = street.z; state.y = street.y; state.heading = street.heading;
    stPlan.road = street.road; stPlan.dir = street.dir; stPlan.turn = null;
    car.onSpurRoad = street.road.kind === "exit";
    settle();
    if (street.road.city) flags.carReassemblesCity = (flags.carReassemblesCity || 0) + 1;
    return;
  }
  // Any other spur: on it, in its middle, facing along it.
  if (on.spur && carReassembleOnSpur(on.spur, fromX, fromZ)) { car.onSpurRoad = true; settle(); return; }
  // Off every road: where it happened, a little back from the wall and bounced
  // off it -- unless that is water or inside something, and then the road.
  if (on.off && carReassembleOffRoad(fromX, fromZ, nx, nz)) {
    settle();
    flags.carReassemblesOffRoad = (flags.carReassemblesOffRoad || 0) + 1;
    return;
  }
  const n = hwyNearest(fromX, fromZ);
  if (!n) return;
  const rx = -n.fz, rz = n.fx;
  // Keep the direction he was travelling. Deriving it from which side of the
  // road he happened to land on turned him round after a crash, and he drove
  // back the way he came for the rest of the trip.
  const fwdDot = -Math.sin(state.heading) * n.fx + -Math.cos(state.heading) * n.fz;   // heading survives the bang
  const dir = fwdDot >= 0 ? 1 : -1;
  const off = dir * (HW.medianW / 2 + HW.laneW * 0.5);
  // where it happened along the road, not the sample before it
  const q = hwySampleAt(n.s);
  state.x = q.x + rx * off;
  state.z = q.z + rz * off;
  state.y = n.y;
  state.heading = Math.atan2(-n.fx * dir, -n.fz * dir);
  settle();
}

// On a highway spur, at the point nearest the bang, off the carriageway it
// leaves from and short of the pad it ends in.
function carReassembleOnSpur(ex, x, z) {
  const sp = ex.spur;
  let bi = 1, bt = 0, bd = Infinity;
  for (let i = 1; i < sp.length; i++) {
    const a = sp[i - 1], b = sp[i];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
    const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const len = sp[sp.length - 1].s;
  const s = clamp(lerp(sp[bi - 1].s, sp[bi].s, bt), Math.min(len / 2, highway.halfW + 20), Math.max(len / 2, len - 8));
  let i = 1; while (i < sp.length - 1 && sp[i].s < s) i++;
  const a = sp[i - 1], b = sp[i], t = clamp((s - a.s) / Math.max(1e-3, b.s - a.s), 0, 1);
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1, fx = (b.x - a.x) / l, fz = (b.z - a.z) / l;
  const dir = (-Math.sin(state.heading) * fx + -Math.cos(state.heading) * fz) >= 0 ? 1 : -1;
  state.x = lerp(a.x, b.x, t); state.z = lerp(a.z, b.z, t); state.y = lerp(a.y, b.y, t);
  state.heading = Math.atan2(-fx * dir, -fz * dir);
  return true;
}

// Off every road: at the spot, backed off the wall along its normal and
// heading bounced off it, so the first thing in front of him is not the wall
// again. False if the spot is water or inside a solid.
function carReassembleOffRoad(x, z, nx, nz) {
  const back = CAR.reassembleBack;
  let hx = -Math.sin(state.heading), hz = -Math.cos(state.heading);
  let px, pz;
  if (nx || nz) {
    const d = hx * nx + hz * nz;
    if (d < 0) { hx -= 2 * d * nx; hz -= 2 * d * nz; }
    px = x + nx * back; pz = z + nz * back;
  } else { px = x - hx * back; pz = z - hz * back; }
  if (terrainEff(px, pz) < seaLevelAt(px, pz)) return false;
  let inside = false;
  forEachSolid(b => {
    if (!inside && Math.abs(px - b.x) < b.hw + 4 && Math.abs(pz - b.z) < b.hd + 4) inside = true;
  });
  if (inside) return false;
  state.x = px; state.z = pz;
  state.y = Math.max(terrainEff(px, pz), TUNE.waterLevel);
  state.heading = Math.atan2(-hx, -hz);
  return true;
}

// ---------------------------------------------------------------------------
function updateCar(dt) {
  if (car.crashCool > 0) car.crashCool -= dt;
  // one finger: no throttle button and no gear. The speed steps ARE up -- they
  // are taps, not a second finger -- and js/speed.js decides them once a frame.
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";

  if (state.exploding) { setEngine(0); setTone("carTyre", "triangle", 90, 0); return; }
  // the giant toy track (track.js): on it, it drives him; at the foot of its
  // lift, it takes him up
  if (typeof trk !== "undefined") {
    if (!trk.on && trackCanBoard()) trackBoard();
    if (trk.on) { setTone("carTyre", "triangle", 90, 0); trackUpdate(dt); return; }
  }

  const touching = state.touching && !menuOpen();
  // The car's own drag range. `state.ctrlBank` is measured against the shared
  // one, which is tuned with him for the aeroplanes and is not to be touched, so
  // the car scales it: `CAR.dragRangeX` is the fraction of the SCREEN WIDTH his
  // thumb travels for full lock, and this converts between the two.
  const range = (TUNE.dragRangeX * Math.min(window.innerWidth, window.innerHeight)) /
                (CAR.dragRangeX * window.innerWidth);
  const bank = touching ? clamp(state.ctrlBank * range, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;

  // ---- THE ONE STEERING RULE, the same on every road (CLAUDE.md). Below
  // `fullSteer` of his drag range the stick does not steer: that is a hand
  // resting on the glass, a wobble, a drift -- and lane-keep holds his lane,
  // straight on through every junction. At or past it he steers, and a full
  // steer held on a junction's approach, or an exit's, is the turn he takes.
  // Nothing is remembered between junctions; letting go is straight on. The
  // one allowance is a finger LIFTED (not recentred) for under `liftGrace`:
  // a four-year-old's finger comes off the glass, and that is not a choice.
  //
  // A TURN DONE IS SPENT. The full steer that took a corner, an exit or a ramp
  // holds him on the road it took him to for as long as the finger stays where
  // it is: it reads as hands-off, lane-keep drives, and it is no one's choice of
  // the next junction. It is his again only once the finger lifts or the stick
  // comes back under `centreBelow` -- the next turn is a fresh full steer.
  const full = Math.abs(bank) >= CAR.fullSteer;
  car.liftT = touching ? 0 : (car.liftT || 0) + dt;
  // A lift is a real lift only past `liftGrace`. A finger that comes off the
  // glass for a moment lands again at the middle of its NEW drag, so for
  // `relatchFor` after it touches down the stick reading centred is the finger
  // finding its way back, not letting go -- of a turn it is holding or of one
  // it has done. (Without it, a blip sixteen metres from a corner dropped the
  // hold on touch-down, the drag came back too late to be a choice, and the
  // full steer went through raw at 33 m/s.) A full steer either way ends it.
  if (!touching) car.relatch = car.liftT <= CAR.liftGrace ? CAR.relatchFor : 0;
  else if (car.relatch > 0) car.relatch = full ? 0 : car.relatch - dt;
  const finding = touching && car.relatch > 0;
  if (car.spent) {
    if (!touching) { if (car.liftT > CAR.liftGrace) car.spent = 0; }
    else if (full ? Math.sign(bank) !== car.spent : !finding && Math.abs(bank) < CAR.centreBelow) car.spent = 0;
  }
  const spent = !!car.spent;
  if (full && !spent) car.lastHeld = Math.sign(bank);
  else if (spent || (touching && !finding) || car.liftT > CAR.liftGrace) car.lastHeld = 0;
  const dz = CAR.deadzone;
  const mag = full && !spent ? Math.max(0, (Math.abs(bank) - dz) / (1 - dz)) : 0;
  let steer01 = Math.sign(bank) * mag;
  let steering = mag > 0;
  const hold = spent ? 0 : full ? steer01 : (car.lastHeld || 0);

  // ---- the road under him
  const road = carRoadTarget(hold, dt);
  // the turn is done: a street's corner behind him, or on to an exit's spur or
  // a city ramp with the steer that took it still held. (Only the steer that
  // TOOK the spur: `arrived` is the one he last came on to, so a full steer
  // made later along it is his to make.)
  const onSpur = road && road.spur && car.onSpurRoad ? road.spur : null;
  const arrived = onSpur && onSpur !== car.arrived;
  car.arrived = onSpur;
  if (!spent && full && road && (road.turned || arrived)) {
    car.spent = Math.sign(bank);
    // and the spur it took is held as chosen, or at its mouth the motorway
    // beside it -- nearer, and the spent finger reading as hands-off -- took
    // him back
    if (arrived && !car.exitChoice) car.exitChoice = onSpur;
  }
  // on a city street, the street's own width is the road; the motorway's 24 m
  // would call the whole of the square "on the road"
  // (and a city's ramps are one lane: their own width too, not a spur's)
  const rampHalf = road && road.spur && road.spur.halfW;
  // (on a corner he is measured against the street he is leaving: the corner
  // itself is road, or every turn read as leaving it)
  car.onRoad = !!road && (!!road.corner || Math.abs(road.lateral) < (road.street ? road.street.halfW + 2 : rampHalf ? rampHalf + 2 : CAR.onRoadHalf));
  car.lateral = road ? road.lateral : 0;
  car.roadY = road ? road.y : 0;
  const wantOff = car.onRoad ? 0 : 1;
  car.offRoad += (wantOff - car.offRoad) * Math.min(1, 3 * dt);

  // ---- speed. Finger down drives; off eases to a stop. Off-road is slower.
  const LK = CAR.laneKeep;
  if (pitch > 0.45 && touching && car.boost <= 0 && state.speed > CAR.cruise * 0.3) {
    car.boost = CAR.boostTime;
    engSurge(0.8);              // the bend that says something just let go
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
  let want = touching ? roadMax : 0;
  // THE CORNER ASSIST (streets.js), speed-only: near a junction, with a turn
  // held into a street that is there -- or the road ending ahead of him -- it
  // sheds speed so the corner fits, and hands it back on the way out.
  const cap = road && road.cap !== undefined ? road.cap : Infinity;
  const cornering = touching && cap < want;
  if (cornering) want = cap;
  const giveBack = road && road.street && typeof stPlan !== "undefined" && stPlan.giveBack > 0;
  const up = giveBack ? Math.max(CAR.accel, TUNE.city.giveBackAccel) : CAR.accel;
  const down = cornering && state.speed > want
    ? Math.max(CAR.brake, road && !road.spur && !road.street ? HW.endTurn.brake
               : road && road.spur ? TUNE.city.ramp.safeBrake : Math.max(TUNE.city.cornerBrake, road && road.capBrake || 0)) : CAR.brake;
  const rate = (want > state.speed ? up : down) * dt;
  state.speed += clamp(want - state.speed, -rate, rate);
  state.speed = clamp(state.speed, 0, CAR.cruise * step * CAR.boost * 1.05);
  if (state.speed < 0.05) state.speed = 0;

  // LANE-KEEP NEVER BRAKES FOR A RED, and that is deliberate. Stopping at a
  // signal is the one decision out here that is HIS: finger off and he coasts
  // to a stop at the line, finger held and he goes through it. Making the
  // assist stop for him would turn the only choice on the road into scenery --
  // and running one is not a mistake, it is how the chase starts.

  // ---- steering. His stick first; the assist only when he is not using it.
  // A full steer is his, whole: the assist fades out on a timer rather than
  // being blended with it. The one exception is a turn he has chosen -- a full
  // steer held toward a street on the approach to a junction, or toward a way
  // off on its approach -- where lane-keep drives the turn he chose and the held
  // finger reads as hands-off until the turn is done or he lets go.
  const chosen = road && road.holding;
  if (chosen) { steer01 = 0; steering = false; car.yield = 1; car.assistOff = 0; }

  // THE ASSIST YIELDS, ON A TIMER. The moment he steers it fades out over
  // `yieldIn`; it only starts coming back `holdOff` after he lets go. He never
  // feels the road pulling against him, and letting go still walks him home.
  car.yield = car.yield === undefined ? 1 : car.yield;
  if (steering) { car.yield = Math.max(0, car.yield - dt / LK.yieldIn); car.assistOff = LK.holdOff; }
  else {
    car.assistOff = Math.max(0, (car.assistOff || 0) - dt);
    if (car.assistOff <= 0) car.yield = Math.min(1, car.yield + dt / LK.fadeBack);
  }

  let cmd = steer01 * CAR.steerRate;
  if (road && car.yield > 0) {
    // Pure pursuit: aim at a point on his lane a second or so ahead. A positive
    // steer command turns the nose right, and heading DECREASES to the right, so
    // the command is the negated bearing error.
    const want = Math.atan2(-(road.aimX - state.x), -(road.aimZ - state.z));
    const hErr = wrapPi(want - state.heading);
    const gain = car.onRoad ? LK.gain : LK.offRoadGain;
    let assist = clamp(-hErr / DEG * gain, -CAR.steerRate, CAR.steerRate);
    // On a CURVE the motorway never has -- a city corner, a ramp, the bridge's
    // link, a city's ramps, and the grid street whose aim is already up it
    // (at the top step the motorway's law swung him off a ramp's far edge) -- pure pursuit:
    // the turn rate that arc to the aim point needs, as
    // the steer THIS car needs for it at this speed. A heading error held on a
    // tight curve saturates the other law: it overshot the cross street, and
    // coming down the bridge ramp at cruise it cut the curve on to the centre
    // line beside the oncoming queue. Along a straight grid street it is the
    // motorway's law, so the street feels like the motorway (feel_compare.js).
    if (((road.street && (road.corner || road.curve)) || (road.spur && road.spur.city)) && car.onRoad && state.speed > 0.5) {
      const Ld = Math.max(4, Math.hypot(road.aimX - state.x, road.aimZ - state.z));
      const yaw = 2 * state.speed * Math.sin(hErr) / Ld;                    // rad/s, + is left
      const rate = clamp(state.speed / CAR.rollAt, 0, 1) * lerp(CAR.lowSpeedTurn, 1, clamp(state.speed / CAR.cruise, 0, 1));
      assist = clamp(-yaw / DEG / Math.max(0.2, rate) * TUNE.city.pursuitGain, -CAR.steerRate, CAR.steerRate);
    }
    // His command is never reduced -- the assist is only ADDED to it, and only
    // by however much of itself is left. Blending the two is what let the road
    // outvote him, and at a light steer actually reverse him.
    cmd = clamp(cmd + assist * car.yield, -CAR.steerRate, CAR.steerRate);
  }
  car.steer += (cmd - car.steer) * Math.min(1, CAR.steerAccel * dt);
  // A car turns tighter slowly and wider fast, and it does not steer at all
  // standing still -- because it is not rolling, not because it has lost grip.
  const rolling = clamp(state.speed / CAR.rollAt, 0, 1);
  const tight = lerp(CAR.lowSpeedTurn, 1, clamp(state.speed / CAR.cruise, 0, 1));
  state.heading -= car.steer * DEG * dt * rolling * tight;
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
    const off = clamp((Math.abs(road.lateral) - (rampHalf ? rampHalf + 2 : CAR.onRoadHalf)) / CAR.shoulderBlend, 0, 1);
    support = lerp(road.y, gnd, off);
    // `railed`: the harbour spur is the only spur that crosses water, on the
    // drawbridge, and without the main road's guardrail he can steer off the
    // side of the span and into the sea. Every other spur runs on the ground and
    // never asks for one.
    const railed = road.street ? road.railHalf > 0 : (!road.spur || road.spur.railed);
    if (railed && road.y - gnd > CAR.railAt) {
      const lim = (road.street ? road.railHalf : road.spur ? (rampHalf || HW.spurW) : highway.halfW) - 1.6;
      // The rail holds him AT the road's edge, and only there. Without the upper
      // bound, anywhere off-road in ground lower than the nearest road -- the
      // square in New York, 850 m from the motorway -- read as "past the rail"
      // and the clamp pushed him the whole way on to it in one frame.
      if (Math.abs(road.lateral) > lim && Math.abs(road.lateral) < lim + CAR.railReach) {
        const rx = -road.fz, rz = road.fx, sgn = Math.sign(road.lateral);
        const push = Math.abs(road.lateral) - lim;
        state.x -= rx * sgn * push; state.z -= rz * sgn * push;
        support = road.y; car.onRoad = true;
        if (state.speed > 6) noiseBurst(0.06, 260, 0.10, 0);
      }
    }
  }
  car.road = road;
  car.dbg = { rejoin: road && road.rejoin ? road.rejoin.kind : null, support, roadY: road ? road.y : null, lateral: road ? road.lateral : null,
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
  // the motorway's traffic only when he is down on the motorway, not over it
  const hwyLevel = Math.abs(hwyNearest(state.x, state.z).y - state.y) < (typeof ST !== "undefined" ? ST.levelTol : Infinity);
  const hit = hwyLevel ? hwyTrafficNear(state.x, state.z, 5.2) : null;
  if (hit) {
    if (state.speed > CAR.crashSpeed) { hwyKnockTraffic(hit); carCrash(); }
    else { state.speed *= 0.4; hwyKnockTraffic(hit); noiseBurst(0.12, 220, 0.2, 0); }
  }
  // the city's traffic and its parked cars: the same two outcomes, box against box
  const cityHit = car.onStreet && typeof stTouching === "function" ? stTouching(state.x, state.z, state.heading) : null;
  if (cityHit && !state.exploding) {
    if (state.speed > CAR.crashSpeed) { stKnock(cityHit); carCrash(); }
    else { state.speed *= 0.4; stKnock(cityHit); noiseBurst(0.12, 220, 0.2, 0); }
  }
  // On a raised link -- the bridge ramp and deck -- the deck he is driving on is
  // a solid box under him, and a box under him is ground, not a wall.
  // ... and so is a raised ramp's, whichever of the two is driving him on it.
  const raised = road && ((road.street && !road.street.drape) || (road.spur && road.spur.city));
  resolveSolidWalls(raised ? state.y : undefined);

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
  // The motor is the shared two-loop voice now (js/engines.js); the TYRES are
  // still its own thing, because they are road noise and not an engine.
  setEngine(n);
  setTone("carTyre", "triangle", 90 + n * 40, state.speed > 2 ? CAR.tyreGain * n : 0);
}

// ---------------------------------------------------------------------------
function carCamera(dt) {
  if (typeof trk !== "undefined" && trk.on) { trackCamera(dt); return; }   // upside down with him
  camera.up.set(0, 1, 0);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  if (state.viewChase) {
    // In the tunnel the chase camera DUCKS. It normally rides higher than the
    // crown of a bore, and from up there it is outside the lining looking down
    // through the roof at the car -- the tunnel disappears at exactly the moment
    // he is inside it.
    const duck = typeof hwyBoreCeiling === "function" ? hwyBoreCeiling(state.x, state.z) : null;
    const camY = duck === null ? state.y + CAR.camChase[1]
                               : Math.min(state.y + CAR.camChase[1], duck);
    camDesired.set(state.x - fx * CAR.camChase[0], camY, state.z - fz * CAR.camChase[0]);
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
    // The cabin rises with the eye on a taller body (v146: the Cybertruck), so he
    // sits in it exactly as he sits in the SUV -- the eye is a fraction of the
    // body's height, and the dash, pillars and roof are written in metres. Only
    // once its own body has arrived: until then he is in the SUV's built stand-in,
    // and his eye is at the SUV's height.
    const ownBody = vehicleModel && vehicleModel.userData.imported === state.vehicleKey;
    const lift = (ownBody && TUNE.models[state.vehicleKey] && TUNE.models[state.vehicleKey].cabinLift) || 0;
    cab.position.set(state.x, state.y + lift, state.z);
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
        const onSt = car.onStreet && typeof stPlan !== "undefined" && stPlan.road;
        const road = onSt ? null : typeof highway !== "undefined" && highway.built ? hwyNearest(state.x, state.z) : null;
        let rh = road ? Math.atan2(-road.fx, -road.fz) : state.heading;
        if (onSt) {
          const p = stProject(stPlan.road, state.x, state.z);
          rh = Math.atan2(-p.fx * stPlan.dir, -p.fz * stPlan.dir);
        }
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
      // the answer is the same voice, shorter and quieter and a little higher
      synthBlip("triangle", H.hz[0] * 1.18, H.hz[0] * 1.16, 0.22, 0.05, 0);
      synthBlip("triangle", H.hz[1] * 1.18, H.hz[1] * 1.16, 0.22, 0.036, 0);
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
  setCarHorn(on);
  if (!carHornCan()) { car.hornHeld = false; car.hornT = 0; }
  el.hornBtn.classList.toggle("pressed", on);
}
