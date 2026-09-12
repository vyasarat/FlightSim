"use strict";
// WORKING RULES
// The yacht. Same finger as the speedboat and the car -- down goes, left and
// right steer -- and everything else about it is weight: slow to start, slow to
// turn, a long time to stop, and a bow wave you can see from the shore.
//
// THE RULE FOR BOATS says each hull gets one thing only that hull can do. The
// speedboat's is the water cannon. The yacht's is that IT IS A PLACE: a moving
// helipad on the stern that the helicopter can land on under way, and a garage
// in the transom that swallows the speedboat whole. Both are the same idea --
// a vehicle inside a vehicle -- and neither is ever required.
//
// IT EXISTS WHETHER OR NOT HE IS IN IT. That is the whole reason this file has a
// world object as well as a flight model: the helicopter has to be able to land
// on a yacht he is not driving, and the speedboat has to be able to drive into
// one. `yacht.x/z/heading` is the truth; when he is aboard it follows him, and
// when he is not it keeps whatever it had.
//
// DRAG UP IS THE HORN, not a burst -- a fifty-metre ship has no burst. It is
// deep, it is long, and the other boats answer it.
//
// NEVER STUCK, and it cannot even beach: shallow water turns it away before it
// gets there, gently and without a word, and the drawbridge always opens.

const YT = TUNE.yacht;

const yacht = {
  g: null, built: false,
  x: 0, z: 0, heading: 0, speed: 0, steer: 0,
  aboard: false,          // is he driving it
  bob: 0,
  anchor: 0, anchorDown: false, idle: 0,
  hornT: 0, replyT: 0,
  tender: false,          // the speedboat is in the garage
  door: 0, doorWant: 0,
  padRing: null, padGroup: null,
  garageDoor: null,
  bridgeG: null, bridgeWheel: null, bridgeRadar: null,
  heliOn: false,          // the helicopter is sitting on the pad
  bridgeArmed: false,
};

function yachtActive() { return !!(state.vp && state.vp.bigBoat); }
// Her water level where she actually is: inside the lock's chamber and up in
// the dock it is not TUNE.waterLevel (js/lock.js, seaLevelAt in terrain.js).
function yachtSeaY() { return seaLevelAt(state.x, state.z); }

// Lying at her berth she points at the way out, and the way out is read from
// TUNE rather than written down beside it -- move the mouth and she turns.
// Is she going for the gap, or already in it? `aimed` is a bearing test with a
// lot of slop in it, because he is four and lining a fifty-metre ship up on a
// gap is not something he should have to do accurately.
function yachtMouthGap() {
  const M = TUNE.harbor.mouth, C = TUNE.harbor.channel;
  const mx = TUNE.harbor.cx, mz = (M.z[0] + M.z[1]) / 2;
  const dx = mx - state.x, dz = mz - state.z, d = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const aimed = d < YT.gap.range && (fx * dx + fz * dz) / d > YT.gap.dot;
  const inside = Math.abs(state.x - mx) < YT.gap.half && state.z < M.z[1] && state.z > C.z[0];
  return { aimed, inside, d };
}
function yachtHeadingToMouth(x, z) {
  const mx = TUNE.harbor.cx, mz = (TUNE.harbor.mouth.z[0] + TUNE.harbor.mouth.z[1]) / 2;
  return Math.atan2(-(mx - x), -(mz - z));
}

// ---------------------------------------------------------------------------
// The world object
// ---------------------------------------------------------------------------
function yachtBuild() {
  if (yacht.built) return;
  const g = new THREE.Group();
  scene.add(g);
  yacht.g = g;
  yacht.x = YT.berth[0];
  yacht.z = YT.berth[1];
  yacht.heading = yachtHeadingToMouth(yacht.x, yacht.z);
  yachtAttachBody();

  // The helipad, drawn in the pad language every landing place in this game uses:
  // a ring on the deck with lamps round it. It moves because it is a child of
  // the yacht, so a moving landing target costs nothing extra.
  const pad = new THREE.Group();
  pad.position.set(YT.pad.x, YT.pad.y, YT.pad.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(YT.pad.r, 28), mattMat(TUNE.palette.slate));
  disc.rotation.x = -Math.PI / 2;
  pad.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(YT.pad.r * 0.72, YT.pad.r * 0.86, 32),
    new THREE.MeshBasicMaterial({ color: TUNE.palette.warning, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  pad.add(ring);
  const cross = new THREE.Mesh(mergeBoxes([
    { w: YT.pad.r * 0.9, h: 0.08, d: 1.2, x: 0, y: 0.07, z: 0 },
    { w: 1.2, h: 0.08, d: YT.pad.r * 0.9, x: 0, y: 0.07, z: 0 },
  ]), new THREE.MeshBasicMaterial({ color: TUNE.palette.white, fog: false }));
  pad.add(cross);
  const lamps = [];
  for (let i = 0; i < YT.pad.lamps; i++) {
    const a = (i / YT.pad.lamps) * Math.PI * 2;
    lamps.push(new THREE.Vector3(Math.cos(a) * YT.pad.r * 0.94, 0.4, Math.sin(a) * YT.pad.r * 0.94));
  }
  pad.add(glowField(lamps, TUNE.palette.warning, TUNE.sky.padLightSize * 0.6, TUNE.sky.padLightOpacity));
  g.add(pad);
  yacht.padGroup = pad;
  yacht.padRing = ring;

  // The transom garage door, HINGED ALONG ITS BOTTOM EDGE, which is the whole
  // trick: the group sits at the hinge and the leaf hangs aft of it, so one
  // rotation about X takes it from standing up as the transom to lying down as
  // a ramp into the water. Rotating the leaf on its own instead left it as a
  // slab floating a metre and a half astern of the ship.
  const door = new THREE.Group();
  door.position.set(0, YT.garage.y, YT.garage.z);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(YT.garage.w, 0.35, YT.garage.h), mattMat(TUNE.palette.sand));
  leaf.position.z = YT.garage.h / 2;              // aft of the hinge
  door.add(leaf);
  door.rotation.x = -Math.PI / 2;                 // shut: standing up
  g.add(door);
  yacht.garageDoor = door;

  yacht.lastX = yacht.x; yacht.lastZ = yacht.z;
  yacht.built = true;
  yachtPlace();
}

// The body: the imported hull if it has arrived, a built one until it does.
function yachtAttachBody() {
  if (!yacht.g) return;
  if (yacht.body) { yacht.g.remove(yacht.body); yacht.body = null; }
  const imported = typeof modelInstance === "function" ? modelInstance("yacht") : null;
  const body = imported || buildYachtModel();
  body.rotation.order = "YXZ";
  // the imported body is placed by updateVehicleModel through gearHeight; here it
  // is a child of the yacht group, so it carries the same offset itself
  body.position.y = -TUNE.gearHeight + 0.6;
  castsShadow(body);
  yacht.g.add(body);
  yacht.body = body;
}

// The fallback. A missing model is a cosmetic downgrade, never a broken game.
function buildYachtModel() {
  const C = TUNE.palette, g = new THREE.Group();
  const L = YT.len, W = YT.beam;
  const white = metalMat(C.white, 40, 0x9aa4b0);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(W, 7, L), white);
  hull.position.y = 4.4; g.add(hull);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 3, L + 0.3), mattMat(C.ink));
  boot.position.y = 1.6; g.add(boot);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, W / 2, 9, 6), white);
  bow.rotation.x = -Math.PI / 2; bow.position.set(0, 4.4, -L / 2 - 4); g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.4, L * 0.92), mattMat(C.sand));
  deck.position.y = 8.1; g.add(deck);
  const house = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 4.6, L * 0.44), white);
  house.position.set(0, 10.6, -L * 0.06); g.add(house);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 2.0, L * 0.4), mattMat(C.night));
  glass.position.set(0, 11.4, -L * 0.06); g.add(glass);
  const fly = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 2.6, L * 0.24), white);
  fly.position.set(0, 14.2, -L * 0.10); g.add(fly);
  for (const sx of [-1, 1]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), mattMat(C.steel));
    mast.position.set(sx * 1.6, 18, -L * 0.10); g.add(mast);
  }
  g.rotation.order = "YXZ";
  return g;
}

function yachtPlace() {
  if (!yacht.g) return;
  yacht.g.position.set(yacht.x, seaLevelAt(yacht.x, yacht.z) + yacht.bob, yacht.z);
  yacht.g.rotation.set(0, yacht.heading, 0);
  // Never while he is driving her -- vehicleModel is already drawing her then --
  // and never from the other side of the country.
  yacht.g.visible = !yacht.aboard &&
    Math.hypot(state.x - yacht.x, state.z - yacht.z) < HB.visibleRange;
}

// Where the helipad is in the world, and whether a point is over it. heli.js
// asks this every frame, so it must be cheap and must never throw.
// Local to world. A three.js rotation of h about Y sends local (x, 0, z) to
// (x cos h + z sin h, 0, -x sin h + z cos h) -- and local -Z is forward, which
// is the check: (0,0,-1) comes out as (-sin h, -cos h), the heading vector.
// Getting the sign of the z terms wrong puts the helipad off the wrong quarter
// of the ship, and everything that lands on it lands in the sea.
function yachtLocal(lx, lz) {
  const s = Math.sin(yacht.heading), c = Math.cos(yacht.heading);
  return { x: yacht.x + lx * c + lz * s, z: yacht.z - lx * s + lz * c };
}
function yachtPadWorld() {
  if (!yacht.built) return null;
  const p = yachtLocal(YT.pad.x, YT.pad.z);
  return { x: p.x, z: p.z, y: seaLevelAt(p.x, p.z) + yacht.bob + YT.pad.y, r: YT.pad.r };
}
// The deck height under a point, or null if that point is not over the pad.
function yachtPadUnder(x, z) {
  const p = yachtPadWorld();
  if (!p) return null;
  return Math.hypot(x - p.x, z - p.z) <= p.r ? p : null;
}

// ---------------------------------------------------------------------------
// Driving it
// ---------------------------------------------------------------------------
function yachtSpawn() {
  yachtBuild();
  yacht.aboard = true;
  state.x = yacht.x = YT.berth[0];
  state.z = yacht.z = YT.berth[1];
  state.heading = yacht.heading = yachtHeadingToMouth(yacht.x, yacht.z);
  state.y = yachtSeaY();
  state.speed = 0; state.pitch = 0; state.bank = 0; state.phase = "TAXI";
  state.airVy = 0;
  yacht.steer = 0; yacht.idle = 0; yacht.anchor = 0; yacht.anchorDown = false;
  yachtBuildBridge();
  yachtPlace();
  thunk();
}

function yachtReassemble() {
  // It cannot really crash -- nothing it can hit is harder than it is -- but the
  // shared explosion path can still land here, and when it does it comes back at
  // its own berth, facing out, with nothing lost.
  state.x = yacht.x = YT.berth[0];
  state.z = yacht.z = YT.berth[1];
  state.heading = yacht.heading = yachtHeadingToMouth(yacht.x, yacht.z);
  state.y = yachtSeaY(); state.speed = 0; state.pitch = 0; state.bank = 0;
  yacht.steer = 0;
  yachtPlace();
}

function updateYacht(dt) {
  el.rotateArrow.classList.remove("on");
  state.phase = "TAXI";
  yachtBuild();
  yacht.aboard = true;

  // decided before anything can return early, so it can never sit over a button
  // he needs: the same rule the rover and the astronaut taught this codebase
  yachtUpdateGarageButton();

  if (state.exploding) { setEngine(0); setTone("yachtHull", "triangle", 55, 0); return; }

  const touching = state.touching && !menuOpen();
  const bank = touching ? clamp(state.ctrlBank, -1, 1) : 0;
  const pitch = touching ? clamp(state.ctrlPitch, -1, 1) : 0;

  // ---- drag up is the HORN. A ship this size has no burst to give.
  if (pitch > 0.45 && touching && yacht.hornT <= 0) yachtHorn();
  if (yacht.hornT > 0) yacht.hornT -= dt;
  if (yacht.replyT > 0) { yacht.replyT -= dt; if (yacht.replyT <= 0) yachtHornReplies(); }

  // ---- the anchor. Finger off for three seconds while stopped and it goes
  // down with a chain roar and a splash; finger on and it comes up. Pure ritual:
  // nothing is unlocked, nothing is required, nothing is prevented.
  if (!touching && state.speed < 0.4) yacht.idle += dt; else yacht.idle = 0;
  if (!yacht.anchorDown && yacht.idle > YT.anchor.idleTime) yachtDropAnchor();
  if (yacht.anchorDown && touching) yachtRaiseAnchor();
  yacht.anchor += clamp((yacht.anchorDown ? 1 : 0) - yacht.anchor, -dt / YT.anchor.dropTime, dt / YT.anchor.dropTime);

  // ---- speed. Slow to start, slow to stop, and the anchor holds it.
  const step = spdMul();   // scales the target and the cap only (js/speed.js)
  const want = (touching && !yacht.anchorDown) ? YT.cruise * step : 0;
  const rate = (want > state.speed ? YT.accel : YT.drag) * dt;
  state.speed += clamp(want - state.speed, -rate, rate);
  state.speed = clamp(state.speed, 0, YT.cruise * step);
  if (state.speed < 0.03) state.speed = 0;

  // ---- steering: heavy, and it only bites once she is making way
  const cmd = bank * YT.steerRate;
  yacht.steer += (cmd - yacht.steer) * Math.min(1, YT.steerAccel * dt);
  const bite = clamp(state.speed / (YT.cruise * 0.3), 0, 1);

  // SHALLOW WATER TURNS HER AWAY. She cannot beach, and she is never told off
  // for trying: a probe ahead and to each bow finds the shoal and adds a nudge
  // toward the deeper side. He feels a big ship not wanting to go somewhere,
  // which is exactly what a big ship is like.
  //
  // ... EXCEPT IN THE GAP. A channel is a place where shallow water on both
  // sides is the whole point, and the harbour mouth is 240 m wide between two
  // stone spits. Left switched on there, the avoidance did its job perfectly and
  // turned her away from the only way out: she sailed up and down the basin for
  // ever, politely refusing the gap she was aimed at. So it stands down while
  // she is lined up on the mouth, and while she is in it.
  let nudge = 0;
  const gapC = yachtMouthGap();
  if (state.speed > 0.5 && !gapC.aimed && !gapC.inside) {
    const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
    const look = YT.shallow + state.speed * 3;
    const deep = (ax, az) => (terrainEff(state.x + ax, state.z + az) < seaLevelAt(state.x + ax, state.z + az) - YT.draft ? 1 : 0);
    const rx = -fz, rz = fx;
    const ahead = deep(fx * look, fz * look);
    const port = deep(fx * look * 0.7 - rx * YT.shallow, fz * look * 0.7 - rz * YT.shallow);
    const stbd = deep(fx * look * 0.7 + rx * YT.shallow, fz * look * 0.7 + rz * YT.shallow);
    if (!ahead || !port || !stbd) {
      // + is "starboard is the deeper side". Both bows equally shallow and she
      // still has to commit to one, or she drives straight on into it while the
      // two sides cancel each other out.
      const turn = (stbd - port) || 1;
      nudge = turn * YT.shallowTurn * (ahead ? 1 : 1.6);
    }
  }
  state.heading -= (yacht.steer * bite + nudge) * DEG * dt;
  const wantBank = (yacht.steer / YT.steerRate) * YT.bankDeg * bite;
  state.bank += (wantBank - state.bank) * Math.min(1, 2.2 * dt);

  // ---- move
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  state.x += fx * state.speed * dt;
  state.z += fz * state.speed * dt;
  forward.set(fx, 0, fz);
  yacht.bob = Math.sin(performance.now() * 0.0009) * YT.bob;
  state.y = yachtSeaY() + yacht.bob;
  state.airVy = 0;
  state.pitch += (state.speed / YT.cruise * 0.8 - state.pitch) * Math.min(1, 2 * dt);

  yacht.x = state.x; yacht.z = state.z; yacht.heading = state.heading;
  yachtPlace();

  yachtBump();
  yachtWake(dt, fx, fz);
  yachtPlume(dt, fx, fz);   // outside yachtWake, which returns early below 1.2 m/s
  yachtDrawbridge(dt);
  yachtDoor(dt);
  yachtSound();
}

// Bumping. She is fifty metres of steel: she does not explode against a pier,
// she leans on it and stops. Nothing is lost either way.
function yachtBump() {
  for (const b of harbor.solids) {
    if (isSolidHidden(b)) continue;
    if (b.y1 < TUNE.waterLevel - 0.5) continue;
    const ex = b.hw + YT.hullR, ez = b.hd + YT.hullR;
    if (!(state.x > b.x - ex && state.x < b.x + ex && state.z > b.z - ez && state.z < b.z + ez)) continue;
    const dx = state.x - b.x, dz = state.z - b.z;
    if (Math.abs(dx) / ex > Math.abs(dz) / ez) state.x = b.x + Math.sign(dx || 1) * ex;
    else state.z = b.z + Math.sign(dz || 1) * ez;
    if (state.speed > 3) { noiseBurst(0.35, 90, 0.16, 0); rumble = Math.max(rumble, 0.22); }
    state.speed *= 0.55;
    return;
  }
}

let yachtWakeT = 0;
function yachtWake(dt, fx, fz) {
  if (state.speed < 1.2) return;
  yachtWakeT -= dt;
  if (yachtWakeT > 0) return;
  // SHE WAS EATING THE WHOLE PUFF POOL. Four puffs every 0.10 s living up to
  // 2.2 s is seventy-odd live puffs, and `wakePuffs` is sixty-four -- so she
  // recycled her own oldest ones mid-life (they vanished rather than faded) and
  // starved every other splash in the scene: the whale, the jet-ski, the
  // droneship. Slower emission and a shorter stern life keeps her under forty
  // and leaves the rest of the harbour its spray back.
  yachtWakeT = 0.16;
  const rx = -fz, rz = fx;
  const k = clamp(state.speed / YT.cruise, 0, 1);
  // the bow wave, which is the thing that says "this is heavy" -- thrown off her
  // shoulders rather than straight ahead, so the wheelhouse can see past it
  const bowOut = YT.beam * YT.bowSpread[1] + YT.bowSpread[0];
  for (const s of [-1, 1]) {
    wakePuff(state.x + fx * YT.len * 0.42 + rx * s * bowOut, yachtSeaY() + 0.6,
      state.z + fz * YT.len * 0.42 + rz * s * bowOut, 0xf2f4f7,
      YT.bowSize[0] + k * YT.bowSize[1], 1.6, YT.bowLife);
    wakePuff(state.x - fx * YT.len * 0.5 + rx * s * (YT.beam * 0.7 + k * 8), yachtSeaY() + 0.4,
      state.z - fz * YT.len * 0.5 + rz * s * (YT.beam * 0.7 + k * 8), 0xf2f4f7,
      YT.sternSize[0] + k * YT.sternSize[1], 1.2, YT.sternLife);
  }
}

// Her stern wisp, on the speedboat's terms. She never had a rising plume to cut
// -- her wake hugs the water and the bridge camera looks forward from 6 m abaft
// centre, so her transom 26 m further aft was never in either shot. This is the
// same faint thing the speedboat gets, for the same reason and at the same
// manoeuvring crawl, so the two boats say the same thing when idling.
let yachtPlumeT = 0;
function yachtPlume(dt, fx, fz) {
  yachtPlumeT -= dt;
  if (state.speed > YT.plumeMaxSpeed || state.speed < 0.4) return;
  if (yachtPlumeT > 0) return;
  yachtPlumeT = YT.plumeEvery;
  wakePuff(state.x - fx * YT.plumeBack, yachtSeaY() + YT.plumeY, state.z - fz * YT.plumeBack,
    0xf2f4f7, YT.plumeSize, YT.plumeRise, YT.plumeLife);
}

// ---------------------------------------------------------------------------
// The horn, and the replies
// ---------------------------------------------------------------------------
function yachtHorn() {
  yacht.hornT = YT.horn.cooldown;
  // Under a gantry crane, a honk is a request: it puts a container on her
  // foredeck, and the next honk takes it off again. Nowhere else does a honk do
  // anything but make a noise, and it always makes the noise.
  if (typeof seaCraneHonked === "function") seaCraneHonked();
  yacht.replyT = YT.horn.replyDelay;
  hbHorn(state.x, state.y + 14, state.z, YT.horn.hz, YT.horn.dur);
  // the breakwater throws it back: the same note again, quieter and late
  synthBlip("sine", YT.horn.hz * 0.99, YT.horn.hz * 0.96, YT.horn.dur * 0.8, 0.035, YT.horn.echo);
  flags.yachtHorns = (flags.yachtHorns || 0) + 1;
}
function yachtHornReplies() {
  // everything else afloat within earshot answers, each in its own voice
  const heard = [];
  if (harbor.ferry) heard.push({ x: harbor.ferry.x, z: harbor.ferry.z, hz: 150 });
  if (harbor.tug) heard.push({ x: HB.tug.x, z: HB.tug.z, hz: 210 });
  if (typeof cruise !== "undefined" && cruise && cruise.g) heard.push({ x: cruise.x, z: cruise.z, hz: 62 });
  let n = 0;
  for (const h of heard) {
    if (Math.hypot(state.x - h.x, state.z - h.z) > YT.horn.range) continue;
    hbHorn(h.x, TUNE.waterLevel + 8, h.z, h.hz, 1.1);
    n++;
  }
  flags.yachtReplies = (flags.yachtReplies || 0) + n;
}

// ---------------------------------------------------------------------------
// The anchor
// ---------------------------------------------------------------------------
function yachtDropAnchor() {
  yacht.anchorDown = true;
  noiseBurst(1.4, 520, 0.16, 0);                 // the chain running out
  for (let i = 0; i < 5; i++) synthBlip("square", 190 + i * 20, 120, 0.08, 0.05, i * 0.12);
  splashAt(state.x - Math.sin(state.heading) * -YT.len * 0.45,
           yachtSeaY(), state.z - Math.cos(state.heading) * -YT.len * 0.45, 1.4);
  flags.yachtAnchors = (flags.yachtAnchors || 0) + 1;
}
function yachtRaiseAnchor() {
  yacht.anchorDown = false;
  yacht.idle = 0;
  noiseBurst(1.0, 380, 0.12, 0);
  synthBlip("square", 120, 200, 0.5, 0.06, 0);
  flags.yachtAnchorsUp = (flags.yachtAnchorsUp || 0) + 1;
}

// ---------------------------------------------------------------------------
// The drawbridge set-piece
//
// One loop, like every other set-piece: giant obvious thing, one approach, a
// visible wind-up, a huge payoff, a free reset. The bells and the beacons are
// the build -- nothing in this game moves that big without announcing itself
// first -- and the spans come back down behind him on their own.
// ---------------------------------------------------------------------------
function yachtDrawbridge(dt) {
  const b = harbor.bridge;
  if (!b) return;
  const d = Math.hypot(state.x - HB.cx, state.z - HB_ROAD_Z);
  const coming = d < YT.bridge.trigger;
  if (coming && !yacht.bridgeArmed) {
    yacht.bridgeArmed = true;
    b.state = "warn";
    b.t = YT.bridge.warn;
    hbBridgeBells();
    flags.bridgeLifts = (flags.bridgeLifts || 0) + 1;
  }
  if (yacht.bridgeArmed && d > YT.bridge.trigger * 1.25) {
    yacht.bridgeArmed = false;
    b.want = 0;                       // and it lowers itself behind him, for free
  }
  if (b.state === "warn") {
    b.t -= dt;
    if (b.t <= 0) { b.state = "lifting"; b.want = 1; hbBridgeHydraulics(); }
  }
}

// ---------------------------------------------------------------------------
// The tender garage
// ---------------------------------------------------------------------------
function yachtGarageMouth() { return yachtLocal(0, YT.garage.z + YT.garage.reach); }
// In the speedboat: near the transom, the button means "drive in".
// In the yacht, with the tender aboard: the same button means "launch it".
function yachtGarageCan() {
  if (state.exploding) return false;
  if (yachtActive()) return yacht.tender;
  if (typeof boatActive === "function" && boatActive() && yacht.built && !yacht.tender) {
    const m = yachtGarageMouth();
    return Math.hypot(state.x - m.x, state.z - m.z) < YT.garage.radius;
  }
  return false;
}
function yachtUpdateGarageButton() {
  el.garageBtn.dataset.mode = yachtActive() ? "out" : "in";
}
function yachtGaragePress() {
  if (!yachtGarageCan()) return false;
  if (yachtActive()) yachtLaunchTender(); else yachtTakeTender();
  return true;
}
function yachtTakeTender() {
  yacht.tender = true;
  yacht.doorWant = 1;
  hbBridgeHydraulics();
  thunk();
  flags.tenderIn = (flags.tenderIn || 0) + 1;
  // he is aboard the ship now, and the ship is under way with his boat inside it
  applyVehicle("yacht");
  state.x = yacht.x; state.z = yacht.z; state.heading = yacht.heading;
  state.y = yachtSeaY(); state.speed = 0;
  yacht.aboard = true;
  yachtPlace();
  setTimeout(() => { yacht.doorWant = 0; }, YT.garage.doorTime * 1000);
}
function yachtLaunchTender() {
  yacht.tender = false;
  yacht.doorWant = 1;
  hbBridgeHydraulics();
  flags.tenderOut = (flags.tenderOut || 0) + 1;
  const m = yachtGarageMouth();
  applyVehicle("speedboat");
  state.x = m.x + (yacht.x - m.x) * -0.4;
  state.z = m.z + (yacht.z - m.z) * -0.4;
  state.y = yachtSeaY();
  state.heading = yacht.heading + Math.PI;
  state.speed = 6;
  yacht.aboard = false;
  yachtPlace();
  splashAt(state.x, yachtSeaY(), state.z, 1.5);
  setTimeout(() => { yacht.doorWant = 0; }, YT.garage.doorTime * 1000);
}
function yachtDoor(dt) {
  if (!yacht.garageDoor) return;
  yacht.door += clamp(yacht.doorWant - yacht.door, -dt / YT.garage.doorTime, dt / YT.garage.doorTime);
  // shut is upright; open is a ramp lying aft, dipping into the water
  yacht.garageDoor.rotation.x = lerp(-Math.PI / 2, YT.garage.openTilt, yacht.door);
}

// ---------------------------------------------------------------------------
// Carrying things. Runs LATE, after the flight model has had its say, for the
// same reason the carrier deck does: otherwise whatever is standing on the deck
// simply falls through it.
// ---------------------------------------------------------------------------
function yachtLate(dt) {
  if (!yacht.built) return;
  if (!yacht.aboard) yachtPlace();
  // the helicopter, parked on the pad, goes where the ship goes
  if (typeof heliActive === "function" && heliActive() && !state.exploding) {
    const pad = yachtPadUnder(state.x, state.z);
    const resting = pad && state.y <= pad.y + TUNE.gearHeight + 0.6;
    if (resting && state.phase === "TAXI") {
      const dx = yacht.x - yacht.lastX, dz = yacht.z - yacht.lastZ;
      state.x += dx; state.z += dz;
      state.y = pad.y + TUNE.gearHeight;
      if (!yacht.heliOn) { yacht.heliOn = true; chirp(); flags.heliOnYacht = (flags.heliOnYacht || 0) + 1; }
    } else if (yacht.heliOn && (!pad || state.phase !== "TAXI")) {
      yacht.heliOn = false;
    }
  } else {
    yacht.heliOn = false;
  }
  yacht.lastX = yacht.x; yacht.lastZ = yacht.z;
  if (yacht.padRing) {
    const k = 0.9 + 0.1 * Math.sin(performance.now() * 0.003);
    yacht.padRing.scale.setScalar(k);
  }
}

// ---------------------------------------------------------------------------
function yachtSound() {
  const n = clamp(state.speed / YT.cruise, 0, 1);
  // Fifty metres of ship: the diesels are the shared two-loop voice at the yacht's
  // own pitch, and the hull is its own thing.
  setEngine(n);
  setTone("yachtHull", "triangle", 55 + n * 30, state.speed > 1 ? YT.hullGain * n : 0);
}

// ---------------------------------------------------------------------------
// The wheelhouse. A wide screen, the wheel, and a radar that sweeps. There is
// no text on the radar and there never will be: it is a green sweep over rings,
// which is a picture of where things are, not a readout.
// ---------------------------------------------------------------------------
const YACHT_RADAR_PX = 128;
function yachtBuildBridge() {
  if (yacht.bridgeG) return yacht.bridgeG;
  const C = TUNE.palette, K = YT.bridgeView;
  const g = new THREE.Group();
  const dash = mattMat(C.night), top = mattMat(C.steel), hard = mattMat(C.slate);
  const glass = new THREE.MeshPhongMaterial({ color: 0x1b2430, flatShading: true, shininess: 90,
    specular: 0x8fa4bb, transparent: true, opacity: 0.22 });

  g.add(new THREE.Mesh(mergeBoxes([
    { w: K.width, h: 0.2, d: 2.2, x: 0, y: K.dashTop, z: K.seatZ - 1.9 },       // the console top
    { w: K.width, h: 1.0, d: 0.18, x: 0, y: K.dashTop - 0.6, z: K.seatZ - 2.9 },
  ]), top));
  g.add(new THREE.Mesh(mergeBoxes([
    { w: K.width + 1.2, h: 1.1, d: 0.2, x: 0, y: K.dashTop - 0.9, z: K.seatZ + 1.6 },
    { w: 0.2, h: 1.1, d: 4.0, x: -K.width / 2, y: K.dashTop - 0.9, z: K.seatZ - 0.4 },
    { w: 0.2, h: 1.1, d: 4.0, x: K.width / 2, y: K.dashTop - 0.9, z: K.seatZ - 0.4 },
    { w: K.width + 1.4, h: 0.25, d: 4.4, x: 0, y: K.dashTop + 2.0, z: K.seatZ - 0.6 },   // the headlining
  ]), dash));
  const wind = new THREE.Mesh(new THREE.BoxGeometry(K.width * 0.98, 1.6, 0.1), glass);
  wind.position.set(0, K.dashTop + 1.0, K.seatZ - 3.0);
  wind.rotation.x = -0.18;
  g.add(wind);

  const wheel = new THREE.Group();
  wheel.position.set(K.seatX, K.dashTop + 0.2, K.seatZ - 1.5);
  wheel.rotation.x = -0.55;
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 18), mattMat(C.ink)));
  wheel.add(new THREE.Mesh(mergeBoxes([
    { w: 0.62, h: 0.06, d: 0.06, x: 0, y: 0, z: 0 },
    { w: 0.06, h: 0.62, d: 0.06, x: 0, y: 0, z: 0 },
    { w: 0.2, h: 0.2, d: 0.08, x: 0, y: 0, z: 0.01 },
  ]), hard));
  g.add(wheel);
  yacht.bridgeWheel = wheel;

  // the radar: a canvas, redrawn every few frames, and never a glyph on it
  const c = document.createElement("canvas");
  c.width = c.height = YACHT_RADAR_PX;
  const cx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  screen.position.set(K.seatX + 0.95, K.dashTop + 0.32, K.seatZ - 1.75);
  screen.rotation.x = -0.5;
  g.add(screen);
  yacht.bridgeRadar = { c, cx, tex, a: 0 };

  g.visible = false;
  scene.add(g);
  yacht.bridgeG = g;
  return g;
}
function yachtHideBridge() { if (yacht.bridgeG) yacht.bridgeG.visible = false; }

function yachtDrawRadar(dt) {
  const R = yacht.bridgeRadar;
  if (!R) return;
  R.a += dt * YT.bridgeView.radarRpm * 0.105;
  if ((frameCount % 4) !== 0) return;
  const cx = R.cx, S = YACHT_RADAR_PX, m = S / 2;
  cx.fillStyle = "#06140c"; cx.fillRect(0, 0, S, S);
  cx.strokeStyle = "#1c5c33"; cx.lineWidth = 1.5;
  for (const r of [0.28, 0.56, 0.84]) { cx.beginPath(); cx.arc(m, m, m * r, 0, Math.PI * 2); cx.stroke(); }
  cx.beginPath(); cx.moveTo(m, 4); cx.lineTo(m, S - 4); cx.moveTo(4, m); cx.lineTo(S - 4, m); cx.stroke();
  // the sweep
  cx.save(); cx.translate(m, m); cx.rotate(R.a);
  cx.fillStyle = "rgba(60,220,110,0.30)";
  cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, m - 3, -0.55, 0); cx.closePath(); cx.fill();
  cx.strokeStyle = "#5cf08a"; cx.lineWidth = 2;
  cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(m - 3, 0); cx.stroke();
  cx.restore();
  // real contacts, in the ship's own frame: the harbour's solids and the ferry
  const range = YT.bridgeView.radarRange;
  const blip = (wx, wz, size) => {
    const dx = wx - state.x, dz = wz - state.z;
    const s = Math.sin(-state.heading), co = Math.cos(-state.heading);
    const rx = dx * co - dz * s, rz = dx * s + dz * co;
    if (Math.hypot(rx, rz) > range) return;
    cx.fillStyle = "#8dffb4";
    cx.fillRect(m + (rx / range) * m - size / 2, m + (rz / range) * m - size / 2, size, size);
  };
  for (const b of harbor.solids) if (b.y1 > TUNE.waterLevel) blip(b.x, b.z, 3);
  if (harbor.ferry) blip(harbor.ferry.x, harbor.ferry.z, 4);
  R.tex.needsUpdate = true;
}

function yachtCamera(dt) {
  camera.up.set(0, 1, 0);
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  if (state.viewChase) {
    camDesired.set(state.x - fx * YT.camChase[0], state.y + YT.camChase[1], state.z - fz * YT.camChase[0]);
    camera.position.lerp(camDesired, Math.min(1, YT.camLag * dt));
    lookV.set(state.x + fx * 40, state.y + 8, state.z + fz * 40);
    camera.lookAt(lookV);
    camera.rotateZ(-state.bank * DEG * 0.3);
    yachtHideBridge();
  } else {
    const K = YT.bridgeView, rx = -fz, rz = fx;
    camera.position.set(state.x + fx * -K.eyeZ + rx * K.seatX, state.y + K.eyeY, state.z + fz * -K.eyeZ + rz * K.seatX);
    camera.rotation.set(-0.04, state.heading, -state.bank * DEG * 0.3);
    const b = yachtBuildBridge();
    b.visible = true;
    b.position.set(state.x, state.y, state.z);
    b.rotation.set(0, state.heading, 0);
    if (yacht.bridgeWheel) yacht.bridgeWheel.rotation.z = -(yacht.steer / YT.steerRate) * K.wheelTurn;
    yachtDrawRadar(dt);
  }
}
