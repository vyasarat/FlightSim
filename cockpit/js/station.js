"use strict";
// ---------------------------------------------------------------------------
// Inside the station. Docked, the slot button shows a hatch: tap it and he
// floats through as the astronaut. Zero g, the game's usual controls: hold the
// throttle to push off along where he is looking, drag to look / steer (drag
// up = look up), and he coasts until he bonks softly off the padded walls.
// Three modules with handrails, lockers and blinking panels, and the Cupola at
// the end with the Earth rolling past its windows. Things to do, all pointing:
// nudge the floating objects back into their lockers, fly into a switch panel
// to light a module, drink the floating water blob. Tap the button again and he
// flies himself back to the hatch and into the capsule seat. Both views work.
//
// The interior is its own little world parked well above the station (hidden
// unless he is inside), so nothing outside has to change.
// ---------------------------------------------------------------------------

const ASTRO = { r: 2.0, halfLen: 15, bodyR: 0.55, thrust: 2.6, drag: 0.35, turn: 1.8, maxSpeed: 3.5 };
const astro = {
  mode: "none",                 // none | inside | leaving
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,   // interior-local, +z along the tube toward the Cupola
  yaw: 0, pitch: 0, t: 0,
  mesh: null, group: null, origin: new THREE.Vector3(), built: false,
  objects: [], lockers: [], switches: [], blob: null, blinkers: [],
  f: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0),
};
const asTmp = new THREE.Vector3(), asTmp2 = new THREE.Vector3(), asQ = new THREE.Quaternion();

function stationInteriorOrigin() {
  const b = BODIES.find(q => q.name === "station");
  return astro.origin.set(b.x, b.y + 1400, b.z);   // above the station, out of everyone's way
}

// suit = true: the white EVA suit with backpack and gloves (the helmet is added by the
// spacewalk). Inside the station he wears a polo shirt and trousers, like a real crew.
function buildAstronaut(suit) {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f7 });
  const grey = new THREE.MeshLambertMaterial({ color: 0xb8bec8 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c9a5 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23282f });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2b4fb0 });
  const shirt = suit ? white : new THREE.MeshLambertMaterial({ color: 0x2b4fb0 });
  const pants = suit ? white : new THREE.MeshLambertMaterial({ color: 0x6b7078 });
  const hands = suit ? white : skin;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.95, 12), shirt); g.add(torso);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), shirt); shoulders.position.y = 0.42; g.add(shoulders);
  if (suit) { const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), grey); pack.position.set(0, 0.05, -0.35); g.add(pack); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin); head.position.y = 0.7; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), suit ? white : new THREE.MeshLambertMaterial({ color: 0x3a2a1a })); hair.position.y = 0.72; g.add(hair);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), dark); eye.position.set(sx * 0.08, 0.72, 0.19); g.add(eye);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.7, 8), suit ? white : skin); arm.position.set(sx * 0.42, 0.05, 0.1); arm.rotation.z = sx * 0.5; arm.rotation.x = -0.4; g.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.095, 0.3, 8), shirt); sleeve.position.set(sx * 0.36, 0.22, 0.02); sleeve.rotation.z = sx * 0.5; sleeve.rotation.x = -0.4; g.add(sleeve);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hands); glove.position.set(sx * 0.58, -0.22, 0.3); g.add(glove);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.75, 8), pants); leg.position.set(sx * 0.16, -0.75, 0.05); leg.rotation.x = 0.25; g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), suit ? dark : new THREE.MeshLambertMaterial({ color: 0xf2f4f7 })); boot.position.set(sx * 0.16, -1.12, 0.18); g.add(boot);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 10, Math.PI), dark); smile.position.set(0, 0.64, 0.2); smile.rotation.z = Math.PI; g.add(smile);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), suit ? blue : new THREE.MeshLambertMaterial({ color: 0xffd23e })); patch.position.set(-0.18, 0.2, 0.31); g.add(patch);
  g.visible = false;
  return g;
}

function buildInterior() {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: 0xe9ecef, side: THREE.BackSide });
  const rib = new THREE.MeshLambertMaterial({ color: 0x9aa2ad });
  const rail = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2f3a48 });
  const R = ASTRO.r, L = ASTRO.halfLen;
  // the tube: three modules end to end
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L * 2, 20, 1, true), wall);
  tube.rotation.x = Math.PI / 2; g.add(tube);
  const endCap = new THREE.Mesh(new THREE.CircleGeometry(R, 20), new THREE.MeshLambertMaterial({ color: 0xdfe3e8 }));
  endCap.position.z = -L; g.add(endCap);   // the hatch end
  for (let z = -L + 2.5; z < L; z += 2.5) { const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.06, 6, 24), rib); ring.position.z = z; g.add(ring); }
  for (const a of [0.5, 2.6, 3.6, 5.8]) {   // handrails along the walls
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, L * 2 - 2, 6), rail);
    h.position.set(Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25), 0); h.rotation.x = Math.PI / 2; g.add(h);
  }
  // lockers (each a coloured door with a glowing ring: the home of one floating object), panels, a treadmill, sleeping bags
  const lockerColors = [0xe0483e, 0xffd23e, 0x36c46a, 0x5ff1ff];
  astro.lockers = [];
  lockerColors.forEach((c, i) => {
    const z = -9 + i * 6, a = 1.2 + (i % 2) * Math.PI;
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.3), dark);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.06), new THREE.MeshLambertMaterial({ color: c }));
    door.position.z = 0.18; box.add(door);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35 }));
    ring.position.z = 0.24; box.add(ring);
    const px = Math.cos(a) * (R - 0.15), py = Math.sin(a) * (R - 0.15);
    box.position.set(px, py, z);
    box.lookAt(0, 0, z);
    g.add(box);
    astro.lockers.push({ mesh: box, ring, x: Math.cos(a) * (R - 0.9), y: Math.sin(a) * (R - 0.9), z, color: c, full: false });
  });
  astro.blinkers = [];
  for (let i = 0; i < 12; i++) {   // blinking panels
    const z = -13 + i * 2.3, a = 4.2 + (i % 3) * 0.5;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.08), new THREE.MeshLambertMaterial({ color: 0x3c4350 }));
    panel.position.set(Math.cos(a) * (R - 0.1), Math.sin(a) * (R - 0.1), z); panel.lookAt(0, 0, z); g.add(panel);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: [0x5ff1ff, 0x7cff5a, 0xffd23e, 0xff7ab8][i % 4] }));
    lamp.position.set(0.25, 0.1, 0.06); panel.add(lamp);
    astro.blinkers.push({ lamp, phase: i * 0.37 });
  }
  const tread = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 1.8), dark); tread.position.set(0, -R + 0.25, 4); g.add(tread);
  for (const [sx, c] of [[-1, 0x36c46a], [1, 0x4a90d9]]) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.3), new THREE.MeshLambertMaterial({ color: c })); bag.position.set(sx * (R - 0.35), 0.2, -4); bag.rotation.y = sx * Math.PI / 2; g.add(bag); }
  // module lights: three panels on the ceiling, dim until he flies into their switch
  astro.switches = [];
  astro.moduleLights = [];
  for (let m = 0; m < 3; m++) {
    const z = -10 + m * 10;
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x3a3f47 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 6), lightMat); strip.position.set(0, R - 0.12, z); g.add(strip);
    const pl = new THREE.PointLight(0xfff2d0, 0, 14, 1.5); pl.position.set(0, R - 0.5, z); g.add(pl);
    astro.moduleLights.push({ mat: lightMat, light: pl, on: false });
    const swMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.08), swMat);
    const a = 0.2; sw.position.set(Math.cos(a) * (R - 0.1), Math.sin(a) * (R - 0.1), z + 3); sw.lookAt(0, 0, z + 3); g.add(sw);
    astro.switches.push({ mesh: sw, mat: swMat, x: Math.cos(a) * (R - 0.7), y: Math.sin(a) * (R - 0.7), z: z + 3, idx: m });
  }
  // the Cupola: a dome of window frames at the +z end, and the Earth outside it
  const dome = new THREE.Group(); dome.position.z = L;
  const frame = new THREE.MeshLambertMaterial({ color: 0xcfd6df });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), frame);
    bar.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.9); bar.rotation.x = -0.35 * Math.cos(a); bar.rotation.y = 0.35 * Math.sin(a); dome.add(bar);
  }
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.12, 8, 30), frame); dome.add(domeRing);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R - 0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fc7ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  glass.rotation.x = Math.PI / 2; dome.add(glass);
  g.add(dome);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 28), new THREE.MeshLambertMaterial({ color: 0x3f8fe0, emissive: 0x0b2a55 }));
  earth.position.set(0, -150, L + 520);
  for (let i = 0; i < 9; i++) {   // continents and cloud caps
    const th = hashSalt(i, 21, 1) * Math.PI * 2, ph = (hashSalt(i, 21, 2) - 0.5) * 2.4;
    const land = new THREE.Mesh(new THREE.SphereGeometry(420 + 1.5, 16, 8, 0, Math.PI * 2, 0, 0.5 + hashSalt(i, 21, 3) * 0.5), new THREE.MeshLambertMaterial({ color: i % 3 === 0 ? 0xf2f4f7 : 0x5aa64a, emissive: i % 3 === 0 ? 0x444444 : 0x123a10 }));
    land.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)));
    earth.add(land);
  }
  g.add(earth);
  astro.earth = earth;
  const sun = new THREE.PointLight(0xfff6e0, 1.2, 60, 1.2); sun.position.set(0, 0.5, L - 2); g.add(sun);
  const fill = new THREE.PointLight(0xdfe8ff, 0.8, 40, 1.2); fill.position.set(0, 0.5, -L + 3); g.add(fill);
  // the hatch (back to the capsule) at the -z end: a round door with a glowing ring
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshLambertMaterial({ color: 0x8a93a0 })); hatch.position.z = -L + 0.02; g.add(hatch);
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 8, 30), new THREE.MeshBasicMaterial({ color: 0x5ff1ff })); hatchRing.position.z = -L + 0.05; g.add(hatchRing);
  astro.hatchRing = hatchRing;
  // the airlock: a red ring on the wall of module three -- float into it for a spacewalk
  const aa = 3.9, ax = Math.cos(aa) * (R - 0.15), ay = Math.sin(aa) * (R - 0.15);
  const airDoor = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshLambertMaterial({ color: 0x6b7078 })); airDoor.position.set(ax, ay, 8); airDoor.lookAt(0, 0, 8); g.add(airDoor);
  const airRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 30), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); airRing.position.set(ax, ay, 8); airRing.lookAt(0, 0, 8); g.add(airRing);
  astro.airlock = { x: Math.cos(aa) * (R - 0.75), y: Math.sin(aa) * (R - 0.75), z: 8, ring: airRing };
  // floating things and their lockers
  astro.objects = [];
  const mk = (geo, color, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    g.add(m);
    astro.objects.push({ mesh: m, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, locker: astro.lockers[i], home: false, r: 0.3 });
  };
  mk(new THREE.SphereGeometry(0.28, 12, 10), 0xe0483e, 0);           // ball
  mk(new THREE.BoxGeometry(0.5, 0.12, 0.14), 0xffd23e, 1);           // wrench
  mk(new THREE.BoxGeometry(0.45, 0.35, 0.25), 0x36c46a, 2);          // bag
  mk(new THREE.TorusGeometry(0.2, 0.08, 8, 16), 0x5ff1ff, 3);        // a ring toy
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.7 }));
  g.add(blob);
  astro.blob = { mesh: blob, x: 0.4, y: 0.3, z: 7, gone: 0 };
  g.visible = false;
  scene.add(g);
  astro.group = g;
  astro.mesh = buildAstronaut(false);
  g.add(astro.mesh);
  astro.built = true;
}
function scatterObjects() {
  astro.objects.forEach((o, i) => {
    o.home = false; o.mesh.visible = true;
    const a = i * 1.7, rr = 0.6 + (i % 2) * 0.5;
    o.x = Math.cos(a) * rr; o.y = Math.sin(a) * rr; o.z = -8 + i * 5.5;
    o.vx = (rnd() - 0.5) * 0.3; o.vy = (rnd() - 0.5) * 0.3; o.vz = (rnd() - 0.5) * 0.3;
  });
  for (const l of astro.lockers) { l.full = false; l.ring.material.opacity = 0.35; }
  astro.allHomeT = 0;
}

function stationCanEnter() {
  return !!(state.vp && state.vp.rocket && state.phase === "TAXI" && rk.onBody && rk.onBody.dock && !state.exploding && astro.mode === "none");
}
function astroActive() { return astro.mode !== "none"; }
function enterStation() {
  if (!stationCanEnter()) return false;
  if (!astro.built) buildInterior();
  stationInteriorOrigin();
  astro.group.position.copy(astro.origin);
  astro.group.visible = true;
  astro.mode = "inside";
  astro.x = 0; astro.y = 0; astro.z = -ASTRO.halfLen + 2.5;
  astro.vx = astro.vy = 0; astro.vz = 0.4;
  astro.yaw = 0; astro.pitch = 0; astro.t = 0;
  scatterObjects();
  camera.position.set(astro.origin.x + astro.x, astro.origin.y + astro.y + 0.9, astro.origin.z + astro.z - 2.8);   // no lerp in from a kilometre away
  for (const m of astro.moduleLights) { m.on = false; m.mat.color.setHex(0x3a3f47); m.light.intensity = 0; }
  astro.blob.gone = 0; astro.blob.mesh.visible = true;
  el.hatchBtn.dataset.mode = "eva";
  if (typeof keys !== "undefined") keys.clear();
  chirp(); noiseBurst(0.5, 600, 0.2, 0);   // the hatch hiss
  flags.stationEntries = (flags.stationEntries || 0) + 1;
  return true;
}
function leaveStation() {
  if (astro.mode === "eva") { astro.mode = "evaReturn"; toot(); return true; }   // outside: back to the airlock first
  if (astro.mode !== "inside") return false;
  astro.mode = "leaving";
  toot();
  return true;
}
// The go button while he is out of the seat: all the way back to the capsule from anywhere.
function leaveStationAll() {
  if (astro.mode === "inside") return leaveStation();
  if (astro.mode === "eva" || astro.mode === "evaReturn") { astro.exitAfter = true; if (astro.mode === "eva") leaveStation(); return true; }
  return false;
}
// The slot button: docked -> go inside; inside -> spacewalk; outside -> back inside.
function toggleHatch() {
  if (astro.mode === "none") return enterStation();
  if (astro.mode === "inside") { evaStart(); return true; }
  if (astro.mode === "eva") return leaveStation();
  return false;
}
function astroReset() {
  astro.mode = "none";
  if (astro.group) astro.group.visible = false;
  if (eva.mesh) { eva.mesh.visible = false; eva.tether.visible = false; eva.tool.visible = false; }
  if (el.hatchBtn) el.hatchBtn.dataset.mode = "in";
  setTone("fans", "sine", 120, 0);
}
function astroFinishLeave() {
  astro.mode = "none";
  astro.group.visible = false;
  el.hatchBtn.dataset.mode = "in";
  setTone("fans", "sine", 120, 0);
  chirp();
  flags.stationExits = (flags.stationExits || 0) + 1;
}

function updateAstronaut(dt) {
  if (astro.mode === "eva" || astro.mode === "evaReturn") { updateEva(dt); return; }
  astro.t += dt;
  const A = ASTRO;
  // facing from yaw/pitch; drag up = look up
  let yawIn = 0, pitchIn = 0, push = 0;
  if (astro.mode === "leaving") {
    // fly himself to the hatch: the velocity is steered straight at it, so it always arrives
    asTmp.set(0 - astro.x, 0 - astro.y, (-A.halfLen + 1.2) - astro.z);
    const d = asTmp.length();
    if (d < 1.0) { astroFinishLeave(); return; }
    asTmp.normalize();
    const wantYaw = Math.atan2(asTmp.x, asTmp.z), wantPitch = Math.asin(clamp(asTmp.y, -1, 1));
    astro.yaw += wrapPi(wantYaw - astro.yaw) * Math.min(1, 4 * dt);
    astro.pitch += (wantPitch - astro.pitch) * Math.min(1, 4 * dt);
    const v = Math.min(A.maxSpeed, 0.8 + d * 0.5);
    astro.vx += (asTmp.x * v - astro.vx) * Math.min(1, 4 * dt); astro.vy += (asTmp.y * v - astro.vy) * Math.min(1, 4 * dt); astro.vz += (asTmp.z * v - astro.vz) * Math.min(1, 4 * dt);
  } else {
    yawIn = -clamp(state.ctrlBank, -1, 1); pitchIn = clamp(state.ctrlPitch, -1, 1);
    push = state.throttleHeld ? 1 : 0;
    astro.yaw += yawIn * A.turn * dt;
    astro.pitch = clamp(astro.pitch + pitchIn * A.turn * 0.8 * dt, -1.2, 1.2);
  }
  const cp = Math.cos(astro.pitch);
  astro.f.set(Math.sin(astro.yaw) * cp, Math.sin(astro.pitch), Math.cos(astro.yaw) * cp);
  if (push) { astro.vx += astro.f.x * A.thrust * dt; astro.vy += astro.f.y * A.thrust * dt; astro.vz += astro.f.z * A.thrust * dt; }
  const k = 1 - Math.min(1, A.drag * dt);
  astro.vx *= k; astro.vy *= k; astro.vz *= k;
  let sp = Math.hypot(astro.vx, astro.vy, astro.vz);
  if (sp > A.maxSpeed) { const q = A.maxSpeed / sp; astro.vx *= q; astro.vy *= q; astro.vz *= q; sp = A.maxSpeed; }
  astro.x += astro.vx * dt; astro.y += astro.vy * dt; astro.z += astro.vz * dt;
  // the padded walls: a soft bonk and a bounce
  const rr = Math.hypot(astro.x, astro.y), lim = A.r - A.bodyR;
  if (rr > lim) {
    const nx = astro.x / rr, ny = astro.y / rr, vn = astro.vx * nx + astro.vy * ny;
    astro.x = nx * lim; astro.y = ny * lim;
    if (vn > 0) { astro.vx -= vn * nx * 1.4; astro.vy -= vn * ny * 1.4; if (vn > 0.6) { noiseBurst(0.08, 180, 0.22, 0); flags.astroBonks = (flags.astroBonks || 0) + 1; } }
  }
  const zl = A.halfLen - 0.9;
  if (astro.z > zl) { astro.z = zl; if (astro.vz > 0) { astro.vz *= -0.4; noiseBurst(0.08, 180, 0.2, 0); } }
  if (astro.z < -zl) { astro.z = -zl; if (astro.vz < 0) { astro.vz *= -0.4; noiseBurst(0.08, 180, 0.2, 0); } }
  // things to do
  for (const o of astro.objects) {
    if (o.home) continue;
    o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    const orr = Math.hypot(o.x, o.y), olim = A.r - 0.4;
    if (orr > olim) { const nx = o.x / orr, ny = o.y / orr, vn = o.vx * nx + o.vy * ny; o.x = nx * olim; o.y = ny * olim; if (vn > 0) { o.vx -= vn * nx * 1.6; o.vy -= vn * ny * 1.6; } }
    if (Math.abs(o.z) > zl) { o.z = Math.sign(o.z) * zl; o.vz *= -0.6; }
    o.mesh.rotation.x += dt * 0.7; o.mesh.rotation.y += dt * 0.5;
    // a nudge: he bumps it and it drifts away from him
    const dx = o.x - astro.x, dy = o.y - astro.y, dz = o.z - astro.z, d = Math.hypot(dx, dy, dz);
    if (d < A.bodyR + o.r + 0.15) {
      const s = Math.max(0.9, sp * 0.9);
      o.vx = dx / Math.max(d, 0.01) * s; o.vy = dy / Math.max(d, 0.01) * s; o.vz = dz / Math.max(d, 0.01) * s;
      o.x = astro.x + dx / Math.max(d, 0.01) * (A.bodyR + o.r + 0.2); o.y = astro.y + dy / Math.max(d, 0.01) * (A.bodyR + o.r + 0.2);
      if ((astro.t - (o.lastTap || -1)) > 0.3) { synthBlip("sine", 520, 420, 0.08, 0.15, 0); o.lastTap = astro.t; }
    }
    // home: the locker takes it
    const l = o.locker;
    if (Math.hypot(o.x - l.x, o.y - l.y, o.z - l.z) < 1.1) {
      o.home = true; l.full = true; l.ring.material.opacity = 1;
      o.mesh.position.set(l.x, l.y, l.z); o.vx = o.vy = o.vz = 0;
      chime(); flags.stationTidy = (flags.stationTidy || 0) + 1;
    }
    o.mesh.position.set(o.x, o.y, o.z);
  }
  if (astro.objects.every(o => o.home)) {
    if (!astro.allHomeT) { astro.allHomeT = astro.t; fanfare(); confettiBurst(); flags.stationTidyAll = (flags.stationTidyAll || 0) + 1; }
    else if (astro.t - astro.allHomeT > TUNE.gateRearm) scatterObjects();   // and out they float again
  }
  for (const s of astro.switches) {
    const m = astro.moduleLights[s.idx];
    if (!m.on && Math.hypot(astro.x - s.x, astro.y - s.y, astro.z - s.z) < 0.9) {
      m.on = true; m.mat.color.setHex(0xfff2d0); m.light.intensity = 1.6; s.mat.color.setHex(0x7cff5a);
      chime(); flags.stationLights = (flags.stationLights || 0) + 1;
    }
  }
  const bl = astro.blob;
  if (bl.gone > 0) { bl.gone -= dt; if (bl.gone <= 0) { bl.mesh.visible = true; } }
  else {
    bl.x += Math.sin(astro.t * 0.4) * 0.15 * dt; bl.y += Math.cos(astro.t * 0.3) * 0.15 * dt;
    bl.mesh.position.set(bl.x, bl.y, bl.z);
    bl.mesh.scale.setScalar(1 + 0.08 * Math.sin(astro.t * 3));
    if (Math.hypot(astro.x - bl.x, astro.y - bl.y, astro.z - bl.z) < A.bodyR + 0.3) {
      bl.gone = 20; bl.mesh.visible = false;
      synthBlip("sine", 300, 140, 0.25, 0.25, 0); noiseBurst(0.15, 900, 0.12, 0.05);   // gulp
      flags.stationGulps = (flags.stationGulps || 0) + 1;
    }
  }
  for (const b of astro.blinkers) b.lamp.visible = ((astro.t + b.phase) % 1.6) < 0.9;
  astro.airlock.ring.material.opacity = 1; astro.airlock.ring.scale.setScalar(1 + 0.06 * Math.sin(astro.t * 4));
  if (astro.mode === "inside" && Math.hypot(astro.x - astro.airlock.x, astro.y - astro.airlock.y, astro.z - astro.airlock.z) < 0.9) { evaStart(); return; }
  astro.hatchRing.material.opacity = 0.6 + 0.4 * Math.sin(astro.t * 3);
  astro.earth.rotation.y += dt * 0.02;
  // the model
  const m = astro.mesh;
  m.visible = state.viewChase;
  m.position.set(astro.x, astro.y, astro.z);
  asQ.setFromEuler(new THREE.Euler(-astro.pitch * 0.6, astro.yaw, 0, "YXZ"));
  m.quaternion.copy(asQ);
  m.rotation.z += Math.sin(astro.t * 0.9) * 0.05;
  // sounds: the fans while he pushes
  setTone("fans", "sine", 110 + sp * 20, push ? 0.05 : 0);
  setEngine(0); setRocketEngine(0, 1);
  forward.copy(astro.f);
}
function astroCamera(dt) {
  if (astro.mode === "eva" || astro.mode === "evaReturn") { evaCamera(dt); return; }
  const o = astro.origin;
  camera.up.set(0, 1, 0);
  if (state.viewChase) {
    camDesired.set(o.x + astro.x - astro.f.x * 2.8, o.y + astro.y + 0.9 - astro.f.y * 2.8, o.z + astro.z - astro.f.z * 2.8);
    // stay inside the tube
    const cx = camDesired.x - o.x, cy = camDesired.y - o.y, cr = Math.hypot(cx, cy), cl = ASTRO.r - 0.35;
    if (cr > cl) { camDesired.x = o.x + cx / cr * cl; camDesired.y = o.y + cy / cr * cl; }
    camDesired.z = clamp(camDesired.z, o.z - ASTRO.halfLen + 0.4, o.z + ASTRO.halfLen - 0.4);
    camera.position.lerp(camDesired, Math.min(1, 6 * dt));
    lookV.set(o.x + astro.x + astro.f.x * 3, o.y + astro.y + 0.3 + astro.f.y * 3, o.z + astro.z + astro.f.z * 3);
  } else {
    camera.position.set(o.x + astro.x + astro.f.x * 0.25, o.y + astro.y + 0.62, o.z + astro.z + astro.f.z * 0.25);
    lookV.set(camera.position.x + astro.f.x * 10, camera.position.y + astro.f.y * 10, camera.position.z + astro.f.z * 10);
  }
  camera.lookAt(lookV);
}

// ===========================================================================
// The spacewalk. Inside module three there is a red airlock ring: float into
// it and he is outside the real station in his suit and helmet, on a glowing
// tether that never lets him drift off (past its length it reels him back).
// Same controls. Jobs, all pointing: fly into the glowing orange battery on the
// truss and a new one slides in (that side of the station lights up), bump the
// stuck solar array and it unfolds, catch the drifting wrench and it clips to
// his belt. The button flies him back to the airlock and inside.
// ===========================================================================
const EVA = { tether: 60, thrust: 3.2, drag: 0.25, maxSpeed: 5 };
const eva = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, anchor: new THREE.Vector3(), mesh: null, helmet: null, tether: null, battery: null, oldBattery: null, tool: null, toolHeld: false, stuck: null, jets: [], t: 0 };
function evaWorldAnchor() {
  const s = station.position;
  return eva.anchor.set(s.x + 6.5, s.y - 2, s.z);   // the airlock, on the core's side
}
function buildEva() {
  eva.mesh = buildAstronaut(true);
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c, emissive: 0x3a2a08 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshLambertMaterial({ color: 0xf2f4f7 })); helmet.position.y = 0.7; eva.mesh.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, -0.9, 1.8, 0.9, 1.3), gold); visor.position.y = 0.7; eva.mesh.add(visor);
  for (const sx of [-1, 1]) { const jet = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xbfe9ff })); jet.position.set(sx * 0.2, -0.3, -0.5); jet.rotation.x = -Math.PI / 2; jet.visible = false; eva.mesh.add(jet); eva.jets.push(jet); }
  eva.mesh.visible = false;
  scene.add(eva.mesh);
  eva.tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x5ff1ff }));
  eva.tether.visible = false; scene.add(eva.tether);
  // the jobs live on the station itself
  const s = station;
  const batMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0x6a2a00 });
  eva.battery = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), batMat); eva.battery.position.set(-12, 6.5, 1.6); s.add(eva.battery);
  eva.batteryDone = false;
  eva.tool = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.2), new THREE.MeshLambertMaterial({ color: 0xffd23e })); eva.tool.visible = false; scene.add(eva.tool);
  eva.toolPos = new THREE.Vector3();
}
function evaStart() {
  if (!eva.mesh) buildEva();
  const a = evaWorldAnchor();
  eva.x = a.x + 2.5; eva.y = a.y; eva.z = a.z; eva.vx = 0.6; eva.vy = 0; eva.vz = 0; eva.t = 0;
  astro.yaw = Math.PI / 2; astro.pitch = 0;
  astro.mode = "eva";
  astro.group.visible = false;
  eva.mesh.visible = true; eva.tether.visible = true;
  // jobs re-arm for every walk
  eva.batteryDone = false; eva.battery.visible = true; eva.battery.material.color.setHex(0xff7a1a); eva.battery.material.emissive.setHex(0x6a2a00);
  eva.toolHeld = false; eva.tool.visible = true; eva.toolPos.set(a.x + 14, a.y + 6, a.z + 8); eva.toolVel = new THREE.Vector3(-0.15, -0.05, -0.1);
  if (station.userData.panels && station.userData.panels.length) { eva.stuck = station.userData.panels[3]; eva.stuck.scale.x = 0.4; eva.stuckDone = false; }
  camera.position.set(eva.x - 3, eva.y + 1, eva.z);
  el.hatchBtn.dataset.mode = "back";
  noiseBurst(0.6, 500, 0.25, 0); chirp();
  flags.spacewalks = (flags.spacewalks || 0) + 1;
}
function evaFinish() {
  astro.mode = "inside";
  eva.mesh.visible = false; eva.tether.visible = false; eva.tool.visible = false;
  for (const j of eva.jets) j.visible = false;
  astro.group.visible = true;
  astro.x = astro.airlock.x * 0.6; astro.y = astro.airlock.y * 0.6; astro.z = astro.airlock.z; astro.vx = -astro.airlock.x * 0.3; astro.vy = -astro.airlock.y * 0.3; astro.vz = 0;
  astro.yaw = Math.atan2(-astro.airlock.x, 0.01); astro.pitch = 0;
  camera.position.set(astro.origin.x + astro.x, astro.origin.y + astro.y + 0.9, astro.origin.z + astro.z - 2.8);
  el.hatchBtn.dataset.mode = "eva";
  noiseBurst(0.5, 600, 0.2, 0); chirp();
  flags.spacewalkReturns = (flags.spacewalkReturns || 0) + 1;
  if (astro.exitAfter) { astro.exitAfter = false; leaveStation(); }
}
function updateEva(dt) {
  eva.t += dt;
  const a = evaWorldAnchor();
  let push = 0;
  if (astro.mode === "evaReturn") {
    // the tether reels him straight to the airlock: velocity steered at it, never a circle
    asTmp.set(a.x - eva.x, a.y - eva.y, a.z - eva.z);
    const d = asTmp.length();
    if (d < 2.2) { evaFinish(); return; }
    asTmp.normalize();
    const wantYaw = Math.atan2(asTmp.x, asTmp.z), wantPitch = Math.asin(clamp(asTmp.y, -1, 1));
    astro.yaw += wrapPi(wantYaw - astro.yaw) * Math.min(1, 4 * dt);
    astro.pitch += (wantPitch - astro.pitch) * Math.min(1, 4 * dt);
    const v = Math.min(EVA.maxSpeed, 1 + d * 0.4);
    eva.vx += (asTmp.x * v - eva.vx) * Math.min(1, 4 * dt); eva.vy += (asTmp.y * v - eva.vy) * Math.min(1, 4 * dt); eva.vz += (asTmp.z * v - eva.vz) * Math.min(1, 4 * dt);
    push = 1;
  } else {
    astro.yaw += -clamp(state.ctrlBank, -1, 1) * ASTRO.turn * dt;
    astro.pitch = clamp(astro.pitch + clamp(state.ctrlPitch, -1, 1) * ASTRO.turn * 0.8 * dt, -1.3, 1.3);
    push = state.throttleHeld ? 1 : 0;
  }
  const cp = Math.cos(astro.pitch);
  astro.f.set(Math.sin(astro.yaw) * cp, Math.sin(astro.pitch), Math.cos(astro.yaw) * cp);
  if (push) { eva.vx += astro.f.x * EVA.thrust * dt; eva.vy += astro.f.y * EVA.thrust * dt; eva.vz += astro.f.z * EVA.thrust * dt; }
  const k = 1 - Math.min(1, EVA.drag * dt);
  eva.vx *= k; eva.vy *= k; eva.vz *= k;
  // the tether: past its length it reels him gently back
  asTmp.set(eva.x - a.x, eva.y - a.y, eva.z - a.z);
  const td = asTmp.length();
  if (td > EVA.tether) { asTmp.normalize(); const pull = (td - EVA.tether) * 0.8 + 1.5; eva.vx -= asTmp.x * pull * dt * 3; eva.vy -= asTmp.y * pull * dt * 3; eva.vz -= asTmp.z * pull * dt * 3; if (!eva.tugged) { eva.tugged = true; synthBlip("sine", 200, 140, 0.2, 0.2, 0); } } else eva.tugged = false;
  let sp = Math.hypot(eva.vx, eva.vy, eva.vz);
  if (sp > EVA.maxSpeed) { const q = EVA.maxSpeed / sp; eva.vx *= q; eva.vy *= q; eva.vz *= q; sp = EVA.maxSpeed; }
  eva.x += eva.vx * dt; eva.y += eva.vy * dt; eva.z += eva.vz * dt;
  // keep out of the station's core (a soft bump)
  const s = station.position, cdx = eva.x - s.x, cdz = eva.z - s.z, cr = Math.hypot(cdx, cdz);
  if (cr < 5.2 && Math.abs(eva.y - s.y) < 11) { const nx = cdx / Math.max(cr, 0.01), nz = cdz / Math.max(cr, 0.01); eva.x = s.x + nx * 5.2; eva.z = s.z + nz * 5.2; const vn = eva.vx * nx + eva.vz * nz; if (vn < 0) { eva.vx -= vn * nx * 1.3; eva.vz -= vn * nz * 1.3; noiseBurst(0.08, 180, 0.2, 0); } }
  // jobs
  station.updateMatrixWorld();
  if (!eva.batteryDone) {
    asTmp.setFromMatrixPosition(eva.battery.matrixWorld);
    if (asTmp.distanceTo(new THREE.Vector3(eva.x, eva.y, eva.z)) < 1.8) {
      eva.batteryDone = true;
      eva.battery.material.color.setHex(0xf2f4f7); eva.battery.material.emissive.setHex(0x3a3a3a);
      if (station.userData.lightMat) station.userData.lightMat.color.setHex(0xfff2b0);
      chime(); clang(); confettiBurst();
      flags.evaBattery = (flags.evaBattery || 0) + 1;
    }
  }
  if (eva.stuck && !eva.stuckDone) {
    asTmp.setFromMatrixPosition(eva.stuck.matrixWorld);
    if (asTmp.distanceTo(new THREE.Vector3(eva.x, eva.y, eva.z)) < 4) { eva.stuckDone = true; chime(); flags.evaArray = (flags.evaArray || 0) + 1; }
  }
  if (eva.stuck && eva.stuckDone) eva.stuck.scale.x += (1 - eva.stuck.scale.x) * Math.min(1, 1.5 * dt);
  if (!eva.toolHeld) {
    eva.toolPos.addScaledVector(eva.toolVel, dt);
    // it always drifts back toward him eventually
    asTmp.set(eva.x - eva.toolPos.x, eva.y - eva.toolPos.y, eva.z - eva.toolPos.z); const tdist = asTmp.length();
    if (tdist > 20) eva.toolVel.addScaledVector(asTmp.normalize(), 0.25 * dt);
    eva.tool.position.copy(eva.toolPos); eva.tool.rotation.x += dt; eva.tool.rotation.y += dt * 0.7;
    if (tdist < 1.2) { eva.toolHeld = true; chime(); flags.evaTool = (flags.evaTool || 0) + 1; }
  }
  // the model, the tether, the jets
  const m = eva.mesh;
  m.visible = state.viewChase;
  m.position.set(eva.x, eva.y, eva.z);
  asQ.setFromEuler(new THREE.Euler(-astro.pitch * 0.6, astro.yaw, 0, "YXZ")); m.quaternion.copy(asQ);
  for (const j of eva.jets) j.visible = push > 0 && state.viewChase;
  if (eva.toolHeld) { eva.tool.visible = state.viewChase; eva.tool.position.set(eva.x, eva.y, eva.z).addScaledVector(astro.f, -0.1); eva.tool.position.y -= 0.3; eva.tool.quaternion.copy(asQ); }
  const pts = eva.tether.geometry.attributes.position.array;
  pts[0] = a.x; pts[1] = a.y; pts[2] = a.z; pts[3] = eva.x; pts[4] = eva.y - 0.3; pts[5] = eva.z;
  eva.tether.geometry.attributes.position.needsUpdate = true;
  setTone("fans", "sine", 90 + sp * 15, push ? 0.05 : 0);
  setEngine(0); setRocketEngine(0, 1);
  forward.copy(astro.f);
}
function evaCamera(dt) {
  camera.up.set(0, 1, 0);
  if (state.viewChase) {
    camDesired.set(eva.x - astro.f.x * 4.5, eva.y + 1.4 - astro.f.y * 4.5, eva.z - astro.f.z * 4.5);
    camera.position.lerp(camDesired, Math.min(1, 6 * dt));
    lookV.set(eva.x + astro.f.x * 4, eva.y + 0.4 + astro.f.y * 4, eva.z + astro.f.z * 4);
  } else {
    camera.position.set(eva.x + astro.f.x * 0.3, eva.y + 0.7, eva.z + astro.f.z * 0.3);
    lookV.set(camera.position.x + astro.f.x * 10, camera.position.y + astro.f.y * 10, camera.position.z + astro.f.z * 10);
  }
  camera.lookAt(lookV);
}
