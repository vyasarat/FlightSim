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
  steer: 0, boost: 0, offRoad: 0, lastCrash: 0,
  onRoad: false, lateral: 0, s: 0, roadY: 0,
  charging: 0, chargedAt: null, dust: 0, screen: null, screenArt: null,
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

// The centre screen: a moving map and an arrow. A graphic, never a glyph --
// there is not a letter or a numeral anywhere on it.
function carBuildScreen() {
  if (car.screen) return car.screen;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const cx = c.getContext("2d");
  const draw = (ang) => {
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
  };
  draw(0);
  const tex = new THREE.CanvasTexture(c);
  car.screenArt = { c, cx, draw, tex };
  car.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  car.screen.visible = false;
  scene.add(car.screen);
  return car.screen;
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
  carBuildScreen();
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
  // one finger: no throttle button, no gear, no speed steps
  el.throttleBtn.classList.add("hidden");
  el.rotateArrow.classList.remove("on");
  el.slowBtn.classList.add("hidden");
  el.fastBtn.classList.add("hidden");
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
  const roadMax = CAR.cruise * lerp(1, CAR.offRoadMax, car.offRoad) * boosting;
  const want = touching ? roadMax : 0;
  const rate = (want > state.speed ? CAR.accel : CAR.brake) * dt;
  state.speed += clamp(want - state.speed, -rate, rate);
  state.speed = clamp(state.speed, 0, CAR.cruise * CAR.boost * 1.05);
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
    if (!road.spur && road.y - gnd > CAR.railAt) {
      const lim = highway.halfW - 1.6;
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
    for (const w of vehicleModel.userData.wheels || []) w.rotation.x += state.speed * dt / CAR.wheelR;
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
    if (car.screen) car.screen.visible = false;
  } else {
    // the driver's seat: under the glass roof, behind the light bar
    const rx = -fz, rz = fx;
    camera.position.set(state.x + fx * 0.2 + rx * -0.85, state.y + CAR.bodyH * 1.05, state.z + fz * 0.2 + rz * -0.85);
    camera.rotation.set(-0.05, state.heading, -state.bank * DEG * 0.25);
    // the centre screen sits low and to his right, showing a map and an arrow
    if (car.screen) {
      car.screen.visible = true;
      // in his eyeline, just right of the wheel
      car.screen.position.set(
        state.x + fx * 1.15 + rx * 0.55, state.y + CAR.bodyH * 0.88, state.z + fz * 1.15 + rz * 0.55);
      car.screen.rotation.set(-0.22, state.heading, 0);
      if (car.screenArt && (frameCount % 6) === 0) {
        const road = typeof highway !== "undefined" && highway.built ? hwyNearest(state.x, state.z) : null;
        const rh = road ? Math.atan2(-road.fx, -road.fz) : state.heading;
        car.screenArt.draw(wrapPi(rh - state.heading));
        car.screenArt.tex.needsUpdate = true;
      }
    }
  }
}
