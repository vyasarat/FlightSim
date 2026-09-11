"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- TRAFFIC SIGNALS.
//
// A junction on every exit spur, and nowhere on the open motorway. The spurs
// are the surface roads: the seven roads the car can actually leave the highway
// onto -- the two airports, the demolition site, the lake, the plains city, the
// desert, and the harbour coast road over the drawbridge. The interchange ramps
// are elevated loops the car cannot drive, so they get nothing.
//
// A JUNCTION IS A CROSSROADS, not a light on a stick. He stops at a red and a
// stream of cars crosses in front of him, and that is what a traffic light IS
// to a four-year-old: the reason to wait is visible. Each one has a cross
// street with its own cars, four heads on masts, and a painted stop line on
// every approach.
//
// AMBER BLINKS BEFORE RED. Every set-piece in this game gets a wind-up and no
// bang is ever unannounced; a junction is the same rule at junction scale, so
// a red is never the first he knows about it.
//
// LANE-KEEP NEVER BRAKES FOR A RED. Stopping is his choice and the only choice
// he has to make out here: finger off and he stops, finger held and he goes
// through. Running one is not a mistake and costs him nothing -- it starts the
// chase, which is a thing to be in.
//
// ZERO TEXT, here as everywhere: three lamps, no arrows, no words, no numerals.
// ---------------------------------------------------------------------------

const LT = TUNE.lights;

const lights = {
  built: false, g: null, junctions: [],
  lampMesh: null, carMesh: null, glow: null,
  ran: 0,                     // how many reds he has gone through, ever
};

// ---- one junction ---------------------------------------------------------
// `phase` runs 0..5: main green, main amber, all red, cross green, cross amber,
// all red. The spur is "main"; the street crossing it is "cross".
const LT_PHASES = ["mainGreen", "mainAmber", "allRedA", "crossGreen", "crossAmber", "allRedB"];
function ltPhaseTime(p) {
  if (p === 0 || p === 3) return LT.green;
  if (p === 1 || p === 4) return LT.amber;
  return LT.allRed;
}
// What an approach sees. `main` is the spur, `cross` is the street.
function ltAspect(j, main) {
  const p = j.phase;
  if (main) return p === 0 ? "green" : p === 1 ? "amber" : "red";
  return p === 3 ? "green" : p === 4 ? "amber" : "red";
}

function ltBuild() {
  if (lights.built || typeof highway === "undefined" || !highway.built) return;
  const C = TUNE.palette;
  const g = new THREE.Group();
  const conc = mattMat(C.concrete), steel = metalMat(C.grey, 24);
  const tarmac = mattMat(TUNE.runwaySurfaceColor);
  const paint = new THREE.MeshBasicMaterial({ color: TUNE.runwayPaintColor });

  const masts = [], arms = [], boxes = [];
  const lampPts = [];

  for (const ex of highway.exits) {
    const sp = ex.spur;
    if (!sp || sp.length < 4) continue;
    // WHERE ALONG THE SPUR IS MEASURED, not assumed. A fixed fraction put the
    // lake junction in the lake and ran the harbour one off the quay into the
    // water -- the spurs go to places, and some of those places are wet. So the
    // spur is scanned for a spot where the whole cross street is dry and the
    // ground under it is flat enough to lay a road on, and a spur with no such
    // spot gets no junction rather than a bad one.
    const total = sp[sp.length - 1].s;
    const at = (f) => {
      const want = total * f;
      let i = 1; while (i < sp.length - 1 && sp[i].s < want) i++;
      const a = sp[i - 1], b = sp[i];
      const t = clamp((want - a.s) / Math.max(1e-3, b.s - a.s), 0, 1);
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
               fx: (b.x - a.x) / l, fz: (b.z - a.z) / l };
    };
    const score = (q, len) => {
      let wet = 0, drop = 0;
      const rx0 = -q.fz, rz0 = q.fx;
      for (let k = -1; k <= 1; k += 0.08) {
        const cx = q.x + rx0 * k * len / 2, cz = q.z + rz0 * k * len / 2;
        const h = terrainEff(cx, cz);
        if (h < TUNE.waterLevel + 1.5) wet++;
        drop = Math.max(drop, Math.abs(h - q.y));
      }
      return { wet, drop };
    };
    // A short cross street rather than none. The lake spur drives INTO a lake,
    // so a full-length one reaches water wherever it is put; two thirds of one
    // still reads as a crossroads and still has somewhere to queue.
    let pick = null, pickScore = null, crossLen = 0;
    for (const scale of LT.crossScales) {
      const len = LT.crossLen * scale;
      for (let f = LT.scan[0]; f <= LT.scan[1] + 1e-6; f += LT.scanStep) {
        const q = at(f), sc = score(q, len);
        if (sc.wet > 0 || sc.drop > LT.maxDrop) continue;
        if (!pickScore || sc.drop < pickScore.drop) { pick = q; pickScore = sc; crossLen = len; }
      }
      if (pick) break;
    }
    if (!pick) continue;                 // no junction here rather than a wet one
    const x = pick.x, z = pick.z, y = pick.y;
    const fx = pick.fx, fz = pick.fz;    // along the spur
    const rx = -fz, rz = fx;             // across it

    const j = {
      to: ex.to, x, y, z, fx, fz, rx, rz, crossLen,
      phase: Math.floor(Math.random() * LT_PHASES.length),
      t: Math.random() * LT.green,
      blink: 0, cars: [], lamps: [], awake: false,
    };

    // the cross street, laid flat across the spur
    const cross = [];
    for (let k = -1; k <= 1; k += 0.25) {
      cross.push({ x: x + rx * k * crossLen / 2, z: z + rz * k * crossLen / 2,
                   y: Math.max(terrainEff(x + rx * k * crossLen / 2, z + rz * k * crossLen / 2),
                               TUNE.waterLevel) + HW.clearance,
                   fx: rx, fz: rz });
    }
    // the middle of the street sits at the spur's own height, so the two
    // surfaces meet rather than one stepping over the other
    for (let k = 0; k < cross.length; k++) {
      const d = Math.abs(k - (cross.length - 1) / 2) / ((cross.length - 1) / 2);
      cross[k].y = lerp(y, cross[k].y, smoothstep(0.25, 1, d));
    }
    // Tapered at both ends: a cross street that stops dead in a field reads as a
    // slab someone left there. Narrowing it to nothing says "it goes on".
    for (let k = 0; k < cross.length; k++) {
      const d = Math.abs(k - (cross.length - 1) / 2) / ((cross.length - 1) / 2);
      cross[k].w = LT.crossW * (1 - smoothstep(0.62, 1, d));
    }
    {
      const left = cross.map(q => ({ ...q })), right = cross.map(q => ({ ...q }));
      const strip = new THREE.Group();
      // one quad per segment, its own width at each end
      const pos = [], idx = [];
      for (let k = 0; k < cross.length; k++) {
        const q = cross[k], qx = -q.fz, qz = q.fx;
        pos.push(q.x + qx * -q.w, q.y + 0.02, q.z + qz * -q.w);
        pos.push(q.x + qx * q.w, q.y + 0.02, q.z + qz * q.w);
        if (k < cross.length - 1) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, tarmac); m.receiveShadow = true;
      strip.add(m); g.add(strip);
      void left; void right;
    }
    j.cross = cross;

    // stop lines: a painted bar on each of the four approaches
    for (const [dx, dz, w] of [[fx, fz, HW.spurW], [-fx, -fz, HW.spurW],
                               [rx, rz, LT.crossW], [-rx, -rz, LT.crossW]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.06, 1.1), paint);
      bar.position.set(x - dx * LT.stopLine, y + 0.09, z - dz * LT.stopLine);
      bar.rotation.y = Math.atan2(dx, dz);
      g.add(bar);
    }

    // four heads: one facing each approach, on a mast with an arm over the road
    for (const [ax, az, main] of [[-fx, -fz, true], [fx, fz, true], [-rx, -rz, false], [rx, rz, false]]) {
      const half = main ? HW.spurW : LT.crossW;
      const side = main ? rx : fx, sideZ = main ? rz : fz;
      const mx = x - ax * (LT.stopLine + 2) + side * (half + 2.5);
      const mz = z - az * (LT.stopLine + 2) + sideZ * (half + 2.5);
      const hy = y + LT.mastH;
      masts.push({ w: LT.mastR * 2, h: LT.mastH, d: LT.mastR * 2, x: mx, y: y + LT.mastH / 2, z: mz });
      const armDir = Math.atan2(-side, -sideZ);
      arms.push({ w: LT.armLen, h: LT.mastR * 1.6, d: LT.mastR * 1.6,
                  x: mx - side * LT.armLen / 2, y: hy, z: mz - sideZ * LT.armLen / 2, ry: armDir });
      const hx = mx - side * LT.armLen, hz = mz - sideZ * LT.armLen;
      boxes.push({ w: LT.headW, h: LT.headH, d: 0.7, x: hx, y: hy - LT.headH / 2 - 0.3, z: hz,
                   ry: Math.atan2(ax, az) });
      // three lamps down the head, top to bottom: red, amber, green
      for (let k = 0; k < 3; k++) {
        const ly = hy - 0.3 - LT.headH * (0.2 + k * 0.3);
        j.lamps.push({ x: hx - ax * 0.42, y: ly, z: hz - az * 0.42, k, main });
        lampPts.push(new THREE.Vector3(hx - ax * 0.42, ly, hz - az * 0.42));
      }
    }

    // the cross street's own traffic
    for (let k = 0; k < LT.cars; k++) {
      j.cars.push({ side: k % 2 ? 1 : -1, u: (Math.random() - 0.5) * crossLen,
                    speed: lerp(LT.carSpeed[0], LT.carSpeed[1], Math.random()), truck: k % 4 === 0 });
    }
    lights.junctions.push(j);
  }

  if (masts.length) g.add(new THREE.Mesh(mergeBoxes(masts), steel));
  if (arms.length) g.add(new THREE.Mesh(mergeBoxes(arms), steel));
  if (boxes.length) g.add(new THREE.Mesh(mergeBoxes(boxes), mattMat(LT.colors.dark)));

  // Every lamp in the world is ONE instanced mesh and one glow field: there are
  // twelve per junction and seven junctions, and eighty-four little spheres is
  // not eighty-four draw calls.
  const n = lights.junctions.reduce((a, j) => a + j.lamps.length, 0);
  lights.lampMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(LT.lampR, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), Math.max(1, n));
  lights.lampMesh.frustumCulled = false;
  g.add(lights.lampMesh);
  // THE HALO IS WHAT MAKES IT READ. A 0.8 m sphere at a hundred metres is three
  // pixels; the additive billboard is what every light in this game uses to be
  // visible at range, and it is the same shared texture. A Points material has
  // ONE colour, so there are three fields -- red, amber, green -- and each frame
  // a lamp's position is written into its own colour's field and parked out of
  // sight in the other two. Three draw calls for every signal in the world.
  lights.glows = {};
  for (const [name, hex] of [["red", LT.colors.red], ["amber", LT.colors.amber], ["green", LT.colors.green]]) {
    const f = glowField(lampPts.map(() => new THREE.Vector3(0, -9999, 0)), hex, LT.glow, 0.95);
    f.frustumCulled = false;
    lights.glows[name] = f;
    g.add(f);
  }
  lights.lampCount = lampPts.length;

  // and every cross-street car in the world is one more
  lights.carMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.2, 2.1, 7.0), metalMat(C.steel, 40),
    Math.max(1, lights.junctions.length * LT.cars));
  lights.carMesh.frustumCulled = false;
  lights.carMesh.castShadow = true;
  lights.carMesh.userData.noSolid = true;   // traffic is never a wall
  g.add(lights.carMesh);

  castsShadow(g, false);
  scene.add(g);
  lights.g = g;
  lights.built = true;
}

// ---- the frame ------------------------------------------------------------
const ltDummy = new THREE.Object3D();
const ltColor = new THREE.Color();

function ltUpdate(dt) {
  if (!lights.built) return;
  const visible = state.spaceF < 0.4 && !(typeof rk !== "undefined" && rk && rk.onBody);
  lights.g.visible = visible;
  if (!visible) return;

  let li = 0, ci = 0;
  const gpos = { red: lights.glows.red.geometry.attributes.position.array,
                 amber: lights.glows.amber.geometry.attributes.position.array,
                 green: lights.glows.green.geometry.attributes.position.array };
  for (const j of lights.junctions) {
    const d = Math.hypot(state.x - j.x, state.z - j.z);
    j.awake = d < LT.range;
    // The cycle runs whether or not he is watching -- a junction he arrives at
    // must already be part-way through, not waiting to start for him.
    j.t -= dt;
    if (j.t <= 0) { j.phase = (j.phase + 1) % LT_PHASES.length; j.t = ltPhaseTime(j.phase); }
    j.blink += dt * LT.blinkHz;

    // lamps
    const on = { main: ltAspect(j, true), cross: ltAspect(j, false) };
    for (const lamp of j.lamps) {
      const asp = lamp.main ? on.main : on.cross;
      const wantK = asp === "red" ? 0 : asp === "amber" ? 1 : 2;
      let lit = lamp.k === wantK;
      if (lit && asp === "amber") lit = Math.sin(j.blink * Math.PI * 2) > -0.2;   // the wind-up
      ltDummy.position.set(lamp.x, lamp.y, lamp.z);
      ltDummy.scale.setScalar(j.awake ? 1 : 0.001);
      ltDummy.updateMatrix();
      if (li < lights.lampMesh.count) {
        lights.lampMesh.setMatrixAt(li, ltDummy.matrix);
        const which = lamp.k === 0 ? "red" : lamp.k === 1 ? "amber" : "green";
        ltColor.setHex(lit ? LT.colors[which] : LT.colors.dark);
        lights.lampMesh.setColorAt(li, ltColor);
        const shown = lit && j.awake;
        for (const name of ["red", "amber", "green"]) {
          const arr = gpos[name], o = li * 3;
          if (shown && name === which) { arr[o] = lamp.x; arr[o + 1] = lamp.y; arr[o + 2] = lamp.z; }
          else { arr[o] = 0; arr[o + 1] = -9999; arr[o + 2] = 0; }
        }
        li++;
      }
    }

    // cross traffic: it runs, and it QUEUES at its own red
    const crossGo = on.cross === "green" || on.cross === "amber";
    for (const c of j.cars) {
      if (!j.awake) continue;
      // `u` is metres along the cross street from the middle; each side runs
      // toward the middle from its own end and wraps round at the far one.
      // Distance to ITS stop line, and the sign is load-bearing: a car with
      // side +1 runs from +u toward -u and meets the line at +stopLine, so it is
      // approaching while `u` is still bigger than that. Backwards, this went to
      // zero only once the car was already through the junction, and nothing
      // ever stopped for anything.
      const toStop = c.side > 0 ? (c.u - LT.stopLine) : (-LT.stopLine - c.u);
      let sp = c.speed;
      if (!crossGo && toStop > 0 && toStop < 60) sp *= clamp(toStop / 26, 0, 1);
      // and it queues behind whatever is already stopped in its own lane
      for (const o of j.cars) {
        if (o === c || o.side !== c.side) continue;
        const gapAhead = (o.u - c.u) * -c.side;
        if (gapAhead > 0 && gapAhead < LT.queueGap) sp = Math.min(sp, o.sp || 0);
      }
      c.sp = sp;
      c.u -= sp * c.side * dt;
      if (Math.abs(c.u) > j.crossLen / 2) c.u = c.side * j.crossLen / 2;
      const lane = c.side * (LT.crossW * 0.45);
      const wx = j.x + j.rx * c.u + j.fx * lane;
      const wz = j.z + j.rz * c.u + j.fz * lane;
      ltDummy.position.set(wx, j.y + 1.15, wz);
      ltDummy.rotation.set(0, Math.atan2(j.rx * -c.side, j.rz * -c.side), 0);
      ltDummy.scale.setScalar(c.truck ? 1.2 : 1);
      ltDummy.updateMatrix();
      if (ci < lights.carMesh.count) lights.carMesh.setMatrixAt(ci++, ltDummy.matrix);
      c.wx = wx; c.wz = wz;
    }
  }

  // park what is not in use rather than leaving stale matrices standing about
  ltDummy.position.set(0, -9999, 0); ltDummy.rotation.set(0, 0, 0);
  ltDummy.scale.setScalar(0.001); ltDummy.updateMatrix();
  for (let k = li; k < lights.lampMesh.count; k++) lights.lampMesh.setMatrixAt(k, ltDummy.matrix);
  for (let k = ci; k < lights.carMesh.count; k++) lights.carMesh.setMatrixAt(k, ltDummy.matrix);
  lights.lampMesh.instanceMatrix.needsUpdate = true;
  if (lights.lampMesh.instanceColor) lights.lampMesh.instanceColor.needsUpdate = true;
  lights.carMesh.instanceMatrix.needsUpdate = true;
  for (const name of ["red", "amber", "green"]) lights.glows[name].geometry.attributes.position.needsUpdate = true;

  ltWatchCar(dt);
}

// ---------------------------------------------------------------------------
// Did he just go through one?
//
// Measured as a CROSSING, not as a position: the signed distance to the stop
// line, this frame against last. Testing "is he past the line and is it red"
// fires every frame he sits beyond it, and testing a radius fires when he
// drives past the junction on the cross street.
// ---------------------------------------------------------------------------
function ltStopLineSigned(j) {
  // positive: still approaching. Along whichever of the four arms he is on.
  const dx = state.x - j.x, dz = state.z - j.z;
  const along = dx * j.fx + dz * j.fz, across = dx * j.rx + dz * j.rz;
  const onSpur = Math.abs(across) < Math.abs(along) ? false : true;
  // the arm he is on is the axis he is furthest out along
  if (!onSpur) return { d: (Math.abs(along) - LT.stopLine) * Math.sign(along || 1), main: true, lat: across };
  return { d: (Math.abs(across) - LT.stopLine) * Math.sign(across || 1), main: false, lat: along };
}

function ltNearest() {
  let best = null, bd = Infinity;
  for (const j of lights.junctions) {
    const d = Math.hypot(state.x - j.x, state.z - j.z);
    if (d < bd) { bd = d; best = j; }
  }
  return bd < LT.range ? best : null;
}

// What he can see from the driving seat: the junction he is approaching, its
// aspect, and how far the stop line is. The car reads this; nothing else does.
function ltAhead() {
  const j = ltNearest();
  if (!j) return null;
  const dx = state.x - j.x, dz = state.z - j.z;
  const along = dx * j.fx + dz * j.fz, across = dx * j.rx + dz * j.rz;
  const main = Math.abs(along) >= Math.abs(across);
  const axis = main ? along : across;
  const fwd = -Math.sin(state.heading) * (main ? j.fx : j.rx) +
              -Math.cos(state.heading) * (main ? j.fz : j.rz);
  const toLine = -Math.sign(fwd || 1) * axis - LT.stopLine;   // positive: short of it
  return { j, main, aspect: ltAspect(j, main), toLine,
           lat: Math.abs(main ? across : along) };
}

let ltLastTo = null, ltLastJ = null;
function ltWatchCar(dt) {
  const isCar = typeof vehKind === "function" && vehKind() === "car";
  if (!isCar || state.exploding) { ltLastTo = null; ltLastJ = null; return; }
  const a = ltAhead();
  if (!a || a.lat > (a.main ? HW.spurW : LT.crossW) + 4) { ltLastTo = null; ltLastJ = null; return; }
  const was = ltLastJ === a.j ? ltLastTo : null;
  ltLastJ = a.j; ltLastTo = a.toLine;
  if (was === null || was === undefined) return;
  // crossed the line this frame, going forward, on a red, and actually moving
  if (was > 0 && a.toLine <= 0 && a.aspect === "red" && state.speed > LT.runSpeed) {
    lights.ran++;
    flags.redsRun = (flags.redsRun || 0) + 1;
    ltFlash();
    if (typeof policeStart === "function") policeStart(a.j);
  }
}

// The camera. A flash and a chirp, and that is the whole of the telling-off:
// there is no message, nothing is deducted, and nothing is on screen.
function ltFlash() {
  el.flash.classList.add("on");
  setTimeout(() => el.flash.classList.remove("on"), 110);
  if (typeof shutter === "function") shutter();
  if (typeof synthBlip === "function") synthBlip("square", 1180, 1180, 0.07, 0.10, 0);
}

// ---- the test surface's questions ------------------------------------------
function ltJunctionCount() { return lights.junctions.length; }
function ltStateOf(i) {
  const j = lights.junctions[i];
  if (!j) return null;
  return { to: j.to, x: j.x, z: j.z, phase: LT_PHASES[j.phase], t: +j.t.toFixed(2),
           main: ltAspect(j, true), cross: ltAspect(j, false),
           stopped: j.cars.filter(c => (c.sp || 0) < 0.5).length, cars: j.cars.length };
}
function ltForce(i, phase) {
  const j = lights.junctions[i];
  if (!j) return false;
  j.phase = LT_PHASES.indexOf(phase);
  if (j.phase < 0) j.phase = 0;
  j.t = ltPhaseTime(j.phase);
  return true;
}
