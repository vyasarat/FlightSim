"use strict";
// ---------------------------------------------------------------------------
// Where things come down: the sea off each airport.
//
//   - A droneship (a barge with a big painted deck) waits offshore. A booster
//     dropped while the launch was tilting seaward flies to it and lands on the
//     deck; otherwise it comes back to the pad side.
//   - The fairing halves pop small chutes and drift to a recovery boat with a
//     net, which catches them with a splash.
//   - After the capsule's parachute landing a recovery ship (at sea) or a
//     flatbed truck (on land) comes, a crane lifts the capsule aboard, and the
//     ride to the pad *is* the refit -- nothing teleports.
// ---------------------------------------------------------------------------

const RECOVERY = [];   // per airport: { idx, barge:{x,z,deckY,mesh}, netBoat:{x,z,mesh}, ship, truck }

function buildRecoveryFleet() {
  for (let idx = 0; idx < AIRPORTS.length; idx++) {
    const ap = AIRPORTS[idx];
    const m = idx === 0 ? 1 : -1;           // apron side; the pad is on -m; the sea is beyond the runway's outboard end
    const seaSign = idx === 0 ? 1 : -1;     // NY: sea at +z, CA: sea at -z
    const bx = -m * 700, bz = ap.cz + seaSign * 1500;
    const deckY = TUNE.waterLevel + 2.6;
    // droneship: hull, deck with a big painted target circle, four thruster pods
    const barge = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(54, 3, 90), lam(0x3c4350)); hull.position.y = TUNE.waterLevel + 1.1; barge.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(52, 0.4, 88), lam(0x8a93a0)); deck.position.y = deckY - 0.2; barge.add(deck);
    const ring = new THREE.Mesh(new THREE.RingGeometry(14, 17, 40), new THREE.MeshLambertMaterial({ color: 0xe0483e, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = deckY + 0.05; barge.add(ring);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 26), lam(0xffd23e)); cross.position.y = deckY + 0.06; barge.add(cross);
    const cross2 = cross.clone(); cross2.rotation.y = Math.PI / 2; barge.add(cross2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), lam(0x2a2e34)); pod.position.set(sx * 25, TUNE.waterLevel + 0.8, sz * 43); barge.add(pod);
    }
    barge.position.set(bx, 0, bz);
    scene.add(barge);
    addSolidBox(bx, TUNE.waterLevel - 0.5, bz, 27, 45, deckY, hull);
    // recovery boat with a net between four posts, a little inshore of the barge
    const nbx = bx + m * 220, nbz = bz - seaSign * 260;
    const netBoat = makeBoat(0xf2f4f7);
    netBoat.scale.setScalar(1.6);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshLambertMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    net.rotation.x = -Math.PI / 2; net.position.set(0, 5.5, 3); netBoat.add(net);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 5), lam(0x3c3a36)); post.position.set(sx * 4.4, 3, 3 + sz * 4.4); netBoat.add(post);
    }
    netBoat.position.set(nbx, TUNE.waterLevel, nbz);
    netBoat.rotation.y = seaSign > 0 ? Math.PI : 0;
    scene.add(netBoat);
    // recovery ship: long hull, wheelhouse, crane with a hook
    const ship = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 22), lam(0x2f3a48)); sh.position.y = 1.0; ship.add(sh);
    const sd = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 21), lam(0xb0b6bf)); sd.position.y = 2.5; ship.add(sd);
    const wh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4), lam(0xf2f4f7)); wh.position.set(0, 4.2, 7.5); ship.add(wh);   // wheelhouse at the bow: the chase camera sits astern
    const crane = new THREE.Group(); crane.position.set(0, 2.7, -6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 8, 8), lam(0xffd23e)); post.position.y = 4; crane.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 12), lam(0xffd23e)); arm.position.set(0, 7.8, 4); crane.add(arm);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 4), lam(0x23282f)); cable.position.set(0, 7.5, 9.5); crane.add(cable);
    ship.add(crane);
    ship.userData = { crane, cable };
    ship.visible = false;
    scene.add(ship);
    // flatbed truck with a small crane (for landings on land)
    const truck = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.6), lam(0xffd23e)); cab.position.set(0, 2.1, 6.5); truck.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.6, 12), lam(0x3c4350)); bed.position.set(0, 1.4, -2); truck.add(bed);
    for (const [sx, sz] of [[-1, -5.5], [1, -5.5], [-1, 4], [1, 4], [-1, 7], [1, 7]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 10), lam(0x1f2328)); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 2, 0.8, sz); truck.add(wheel);
    }
    const tcrane = new THREE.Group(); tcrane.position.set(0, 1.7, -7);
    const tpost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 7, 8), lam(0xffd23e)); tpost.position.y = 3.5; tcrane.add(tpost);
    const tarm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 12), lam(0xffd23e)); tarm.position.set(0, 7, 4); tcrane.add(tarm);
    const tcable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 4), lam(0x23282f)); tcable.position.set(0, 6.5, 9); tcrane.add(tcable);
    truck.add(tcrane);
    truck.userData = { crane: tcrane, cable: tcable };
    truck.visible = false;
    scene.add(truck);
    RECOVERY.push({ idx, m, seaSign, barge: { x: bx, z: bz, deckY, mesh: barge }, netBoat: { x: nbx, z: nbz, mesh: netBoat }, ship, truck });
  }
}
buildRecoveryFleet();

// The booster's landing target, chosen at the drop: the barge if the stack was
// tilting toward the sea, otherwise a spot beside the pad.
function boosterTargetFor(vx, vz) {
  const r = RECOVERY[state.originIdx];
  if (!r) return null;
  const toSeaX = r.barge.x - state.x, toSeaZ = r.barge.z - state.z;
  const seaward = (vx * toSeaX + vz * toSeaZ) > 0 && Math.hypot(vx, vz) > 3;
  if (seaward) return { x: r.barge.x, z: r.barge.z, y: r.barge.deckY, barge: true };
  const pad = rocketPad(state.originIdx);
  if (state.vp.starship) { const C = TUNE.rocketTune.catch; return { x: pad.x, z: pad.z + C.dz, y: AIRPORTS[state.originIdx].elev + C.armY, catch: true }; }
  return { x: pad.x - r.m * 60, z: pad.z + 30, y: AIRPORTS[state.originIdx].elev, barge: false };
}
function fairingBoatFor() {
  const r = RECOVERY[state.originIdx];
  return r ? r.netBoat : null;
}

// ---- the recovery ride (called after a parachute landing instead of the timer)
let ride = null;
function startRecovery() {
  const r = RECOVERY[state.originIdx];
  if (!r) { rk.refitT = RK.refitDelay; return; }
  const overWater = terrainEff(state.x, state.z) < TUNE.waterLevel - 0.2;
  const v = overWater ? r.ship : r.truck;
  const pad = rocketPad(state.originIdx);
  // the vehicle comes from off to the side, pauses beside the capsule, and leaves toward the pad
  const ax = state.x, az = state.z;
  const dx = pad.x - ax, dz = pad.z - az, d = Math.max(1, Math.hypot(dx, dz));
  const ux = dx / d, uz = dz / d;                    // toward the pad
  const from = { x: ax - ux * 260 + uz * 40, z: az - uz * 260 - ux * 40 };
  const beside = { x: ax + uz * 9, z: az - ux * 9 };
  // the ship stays on the water: it heads for the pad but stops short of the shore; the
  // truck stays on land the same way (it will not drive into the sea)
  let run = 220;
  for (let d = 10; d <= 220; d += 10) {
    const tx = ax + ux * d + uz * 9, tz = az + uz * d - ux * 9;
    const wet = terrainEff(tx, tz) < TUNE.waterLevel - 0.3;
    if (wet !== overWater) { run = Math.max(10, d - 30); break; }
  }
  const to = { x: ax + ux * run + uz * 9, z: az + uz * run - ux * 9 };
  const groundY = overWater ? TUNE.waterLevel : Math.max(terrainEff(ax, az), TUNE.waterLevel);
  ride = { r, v, overWater, t: 0, from, beside, to, groundY, capX: ax, capZ: az, capY: state.y, done: false,
    heading: Math.atan2(ux, uz), deckY: overWater ? 2.7 : 1.7 };
  v.visible = true;
  v.position.set(from.x, groundY, from.z);
  v.rotation.y = ride.heading;
  ride.v.userData.crane.rotation.y = 0;
  if (overWater) boatHorn(); else toot();
  flags.recoveries = (flags.recoveries || 0) + 1;
}
const RIDE = { arrive: 3, lift: 2, carry: 3.5 };
function updateRecovery(dt) {
  if (!ride) return false;
  ride.t += dt;
  const { v } = ride;
  const t = ride.t;
  const ease = (a) => a * a * (3 - 2 * a);
  let vx, vz;
  if (t < RIDE.arrive) {
    const k = ease(clamp(t / RIDE.arrive, 0, 1));
    vx = ride.from.x + (ride.beside.x - ride.from.x) * k; vz = ride.from.z + (ride.beside.z - ride.from.z) * k;
    if (ride.overWater && (t % 0.12) < dt) for (const sd of [-1, 1]) wakePuff(vx - Math.sin(ride.heading) * 13 + Math.cos(ride.heading) * sd * 3.5, TUNE.waterLevel + 0.2, vz - Math.cos(ride.heading) * 13 - Math.sin(ride.heading) * sd * 3.5, 0xe8f6ff, 0.6, 1.2, 0.7);
  } else if (t < RIDE.arrive + RIDE.lift) {
    vx = ride.beside.x; vz = ride.beside.z;
    const k = ease(clamp((t - RIDE.arrive) / RIDE.lift, 0, 1));
    // crane swings over the capsule, the capsule rises and comes over the bed
    v.userData.crane.rotation.y = -Math.PI / 2 * Math.sin(k * Math.PI);
    const lift = Math.sin(k * Math.PI) * 7;
    const endY = ride.groundY + ride.deckY + rocketHalfLen();
    state.x = ride.capX + (vx - ride.capX) * k; state.z = ride.capZ + (vz - ride.capZ) * k;
    state.y = ride.capY + (endY - ride.capY) * k + lift;
    if (k > 0.98 && !ride.hooked) { ride.hooked = true; clang(); }
  } else if (t < RIDE.arrive + RIDE.lift + RIDE.carry) {
    const k = ease(clamp((t - RIDE.arrive - RIDE.lift) / RIDE.carry, 0, 1));
    vx = ride.beside.x + (ride.to.x - ride.beside.x) * k; vz = ride.beside.z + (ride.to.z - ride.beside.z) * k;
    state.x = vx; state.z = vz; state.y = ride.groundY + ride.deckY + rocketHalfLen();
    if (ride.overWater && (t % 0.12) < dt) for (const sd of [-1, 1]) wakePuff(vx - Math.sin(ride.heading) * 13 + Math.cos(ride.heading) * sd * 3.5, TUNE.waterLevel + 0.2, vz - Math.cos(ride.heading) * 13 - Math.sin(ride.heading) * sd * 3.5, 0xe8f6ff, 0.6, 1.2, 0.7);
  } else {
    v.visible = false;
    ride = null;
    rocketRefit();
    return true;
  }
  // the deck rides the water; the truck rides the ground under it
  ride.groundY = ride.overWater ? TUNE.waterLevel : Math.max(terrainEff(vx, vz), TUNE.waterLevel);
  if (t >= RIDE.arrive + RIDE.lift) state.y = ride.groundY + ride.deckY + rocketHalfLen();
  v.position.set(vx, ride.groundY, vz);
  v.rotation.y = ride.heading;
  if (ride.t > RIDE.arrive) v.userData.cable.scale.y = 1;
  return true;
}
function recoveryActive() { return !!ride; }
function cancelRecovery() { if (ride) { ride.v.visible = false; ride = null; } }
