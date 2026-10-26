"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- LONDON, ACROSS THE SEA (v197, the boy's idea, the parent's yes).
//
// The ground (the crossing, the islands, the white cliffs, the Thames) is terrain.js's
// ldShape: water is still `terrainEff < seaLevelAt` and nothing else. This file stands
// what is ON it: the landmarks, the ships, the lighthouse, the whale, Big Ben's clock and
// bong, the big wheel, the red phone boxes, and London's airport (AIRPORTS[2]).
//
//   - NOTHING HERE MOVES NEW YORK OR CALIFORNIA. Everything is built on this file's own
//     random stream (ldQuiet), so three.js's uuid draws leave the seeded traffic, spawns and
//     checks exactly where they were; and nothing that runs per frame touches Math.random or
//     terrain.js's rnd() -- the whale and the ships have their own (ldRun). Its materials are
//     its own too: borrowing lam()'s or artLam()'s cache would change what a later file builds.
//   - ITS SOLIDS ARE A REGION (solids.js): one registry, but a question asked in New York
//     never walks London's records.
//   - ZERO TEXT: the clock faces have tick marks and hands, never numerals; no sponsor on the
//     wheel; nothing readable anywhere.
//   - NOTHING LIVING: the whale carries noSolid/noShatter like the harbour's; the sentry boxes
//     stand empty; the lions and the figure on the column are statues.
//   - THE LANDMARKS STAY STANDING. Each is solid (the wall law: a bang and a free reassembly
//     where it happened) and its roof is ground to land a helicopter on, but a blast never
//     hides it (noShatter): Big Ben is there when he comes back.
//   - Every landmark is merged per material: a handful of draw calls each, not hundreds.
//   - GAME TIME ONLY. Big Ben's hands and bong, the wheel, the ships and the beam run off the
//     dt the frame hands in, never the wall clock.
// ---------------------------------------------------------------------------
const LD = TUNE.london;
const ldn = {
  built: false, landmarks: {}, region: null, mats: {},
  clock: 0, bongAt: LD.bigBen.first, strikes: [], bongs: 0,
  eye: null, eyeA: 0, caps: null, hands: null, faces: [],
  ships: [], beam: null, beamA: 0,
  whale: { g: null, up: 0, next: LD.whale.first, x: 0, z: 0, heading: 0 },
  phone: [], tbLeaves: [], airportIdx: 2,
  decks: {}, city: null, roads: {}, corridor: [],    // v198: the bridges' decks, London's street city, its links and the ground they claim
};

// ---- the random streams ------------------------------------------------------------------
let ldSeed = 0x4c4f4e44, ldRunSeed = 0x54484d53;
function ldRand() { ldSeed = (ldSeed * 1664525 + 1013904223) >>> 0; return ldSeed / 4294967296; }
function ldRun() { ldRunSeed = (ldRunSeed * 1664525 + 1013904223) >>> 0; return ldRunSeed / 4294967296; }
// Build on our own stream, and draw NOTHING from the real one afterwards: London did not
// exist in v196, so v196's stream is exactly what the rest of the page must see.
function ldQuiet(fn) {
  const R = Math.random;
  Math.random = ldRand;
  try { return fn(); } finally { Math.random = R; }
}

// ---- materials: London's own, by what they are ------------------------------------------
function ldMat(kind) {
  if (ldn.mats[kind]) return ldn.mats[kind];
  let m;
  if (kind === "glass") m = artPaint(new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 70, specular: 0x6a7480 }), "glass");
  else if (kind === "stone") m = artPaint(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), "concrete");
  else if (kind === "lamp") m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  else m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });   // paint, gold, the clock faces
  ldn.mats[kind] = m;
  return m;
}

// ---- the builder: parts merged per material, solids in world coordinates -----------------
const ldM4 = new THREE.Matrix4(), ldQt = new THREE.Quaternion(), ldEu = new THREE.Euler();
const ldV3 = new THREE.Vector3(), ldS3 = new THREE.Vector3(), ldN3 = new THREE.Matrix3(), ldCol = new THREE.Color();
const ldPv = new THREE.Vector3(), ldNv = new THREE.Vector3();
// A landmark: its origin on the ground at (x, z); everything inside is in metres from there.
function ldBegin(name, x, z, y) {
  return { name, x, z, y: y === undefined ? terrainEff(x, z) : y, parts: {}, solids: [], tris: 0 };
}
// one primitive: `color` a hex, or a function of its world point (bands, spirals)
function ldAdd(B, geo, color, kind, x, y, z, rx, ry, rz, sx, sy, sz) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  ldEu.set(rx || 0, ry || 0, rz || 0);
  ldM4.compose(ldV3.set(x, y, z), ldQt.setFromEuler(ldEu), ldS3.set(sx || 1, sy || 1, sz || 1));
  ldN3.getNormalMatrix(ldM4);
  const P = B.parts[kind] || (B.parts[kind] = { pos: [], nor: [], col: [] });
  const A = g.attributes.position, N = g.attributes.normal;
  if (typeof color !== "function") ldCol.setHex(color);
  for (let i = 0; i < A.count; i++) {
    ldPv.fromBufferAttribute(A, i).applyMatrix4(ldM4);
    ldNv.fromBufferAttribute(N, i).applyMatrix3(ldN3).normalize();
    P.pos.push(ldPv.x, ldPv.y, ldPv.z); P.nor.push(ldNv.x, ldNv.y, ldNv.z);
    if (typeof color === "function") ldCol.setHex(color(ldPv.x + B.x, ldPv.y + B.y, ldPv.z + B.z, i));
    P.col.push(ldCol.r, ldCol.g, ldCol.b);
  }
  B.tris += A.count / 3;
  if (g !== geo) g.dispose();
  geo.dispose();
}
function ldBox(B, w, h, d, color, kind, x, y, z, ry, rx, rz) {
  ldAdd(B, new THREE.BoxGeometry(w, h, d), color, kind, x, y + h / 2, z, rx, ry, rz);
}
function ldCyl(B, rT, rB, h, seg, color, kind, x, y, z, rx, rz, ry) {
  ldAdd(B, new THREE.CylinderGeometry(rT, rB, h, seg), color, kind, x, y + h / 2, z, rx, ry, rz);
}
function ldSph(B, r, color, kind, x, y, z, sx, sy, sz, wseg, hseg, phi) {
  ldAdd(B, new THREE.SphereGeometry(r, wseg || 12, hseg || 8, 0, Math.PI * 2, 0, phi || Math.PI), color, kind, x, y, z, 0, 0, 0, sx, sy, sz);
}
// a pyramid roof: four sides from w x d to a point h up
function ldPyr(B, w, d, h, color, kind, x, y, z) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  ldAdd(B, g, color, kind, x, y + h / 2, z, 0, 0, 0, w, h, d);
}
// a primitive placed by its own axes: `ax` its x, `ay` its y, `az` its z (unit, right-handed)
function ldAddAxes(B, geo, color, kind, x, y, z, ax, ay, az) {
  geo.applyMatrix4(ldM4.makeBasis(ldPv.set(ax[0], ax[1], ax[2]), ldNv.set(ay[0], ay[1], ay[2]), ldV3.set(az[0], az[1], az[2])));
  ldAdd(B, geo, color, kind, x, y, z);
}
// a clock face's frame: n its outward normal on the ground; right and up as seen from outside
function ldCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function ldFaceAxes(nx, nz, a) {
  const rx = nz, rz = -nx, s = Math.sin(a), c = Math.cos(a);
  return { radial: [rx * s, c, rz * s], tangent: [rx * c, -s, rz * c], n: [nx, 0, nz] };
}
// solid boxes in the landmark's frame; `top` false: not somewhere to stand (a mast, a spire)
function ldSolid(B, x, y0, z, hw, hd, y1, kind) {
  B.solids.push({ x, y0, z, hw, hd, y1, kind: kind || "building" });
}
// The landmark's meshes, one per material, added under `parent`; its solids registered.
function ldFinish(B, parent) {
  const g = new THREE.Group();
  g.position.set(B.x, B.y, B.z);
  g.userData.noShatter = true;
  g.userData.ldName = B.name;
  let main = null;
  for (const kind of Object.keys(B.parts)) {
    const P = B.parts[kind];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ldMat(kind));
    m.castShadow = kind !== "lamp"; m.receiveShadow = kind !== "lamp";
    m.userData.noShatter = true;
    g.add(m);
    main = main || m;
  }
  (parent || scene).add(g);
  for (const s of B.solids) {
    const rec = addSolidBox(B.x + s.x, B.y + s.y0, B.z + s.z, s.hw, s.hd, B.y + s.y1, main, s.kind);
    rec.ld = B.name;
  }
  ldn.landmarks[B.name] = { g, x: B.x, y: B.y, z: B.z, tris: Math.round(B.tris), solids: B.solids.length, main };
  return g;
}

const LC = TUNE.palette;
const LDC = {
  stone: 0xd9c27e, stoneLight: 0xe8d9a6, white: LC.white, grey: LC.grey, slate: LC.slate, ink: LC.ink,
  gold: LC.gold, red: LC.red, blue: 0x5d9bd5, lead: 0x6e7a80, glass: 0x9fb8cc, night: LC.night, green: 0x3f8f5a,
  bronze: 0x5b4a33, sea: LC.sea, concrete: LC.concrete, steel: LC.steel,
};

// ===========================================================================================
// THE LANDMARKS
// ===========================================================================================

// Big Ben (the Elizabeth Tower): a stone shaft, the clock stage with four faces -- tick
// marks and hands, no numerals -- the belfry, and the spire. The hands run on game time:
// the minute hand goes round once between bongs and stands at the top when Big Ben bongs.
function ldBigBen() {
  const [x, z] = LD.at.bigBen, B = ldBegin("bigBen", x, z);
  const S = LDC.stone;
  ldBox(B, 12, 61, 12, S, "stone", 0, -6, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ldBox(B, 1.6, 55, 1.6, LDC.stoneLight, "stone", sx * 5.6, 0, sz * 5.6);
  for (let k = 0; k < 6; k++) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    // tall dark lancet windows up the shaft: it reads as a tower, not a post
    ldBox(B, nz ? 1.2 : 0.3, 4.5, nx ? 1.2 : 0.3, LDC.slate, "plain", nx * 6.05 + nz * 2.2, 10 + k * 7.5, nz * 6.05 + nx * 2.2);
    ldBox(B, nz ? 1.2 : 0.3, 4.5, nx ? 1.2 : 0.3, LDC.slate, "plain", nx * 6.05 - nz * 2.2, 10 + k * 7.5, nz * 6.05 - nx * 2.2);
  }
  ldBox(B, 13.6, 1.2, 13.6, LDC.stoneLight, "stone", 0, 55, 0);
  ldBox(B, 13, 14, 13, S, "stone", 0, 56, 0);                     // the clock stage
  ldBox(B, 14, 1, 14, LDC.gold, "plain", 0, 70, 0);
  ldBox(B, 11, 8, 11, S, "stone", 0, 71, 0);                       // the belfry
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const o of [-2.6, 0, 2.6]) ldBox(B, nz ? 1.4 : 0.4, 5, nx ? 1.4 : 0.4, LDC.ink, "plain", nx * 5.55 + nz * o, 72.5, nz * 5.55 + nx * o);
  }
  ldPyr(B, 11.5, 11.5, 16, LDC.slate, "plain", 0, 79, 0);          // the spire roof
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    ldCyl(B, 0, 0.7, 6, 4, LDC.gold, "plain", sx * 5.4, 79, sz * 5.4);
  }
  ldCyl(B, 0.15, 0.5, 6, 6, LDC.gold, "plain", 0, 93.5, 0);
  // the four faces: a pale disc in a gold ring, twelve ticks; the hands are their own mesh
  const R = 4.7, cy = 63;
  const faces = [];
  for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const fx = nx * 6.55, fz = nz * 6.55, F0 = ldFaceAxes(nx, nz, 0);
    // a disc's axis is its y: stand it on the face's normal
    ldAddAxes(B, new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.3, 28), LDC.gold, "plain", nx * 6.5, cy, nz * 6.5, F0.tangent, F0.n, ldCross(F0.tangent, F0.n));
    ldAddAxes(B, new THREE.CylinderGeometry(R, R, 0.3, 28), 0xf6f0dc, "lamp", fx, cy, fz, F0.tangent, F0.n, ldCross(F0.tangent, F0.n));
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, big = k % 3 === 0, F = ldFaceAxes(nx, nz, a), rr = R - 0.8;
      ldAddAxes(B, new THREE.BoxGeometry(big ? 0.55 : 0.3, big ? 1.4 : 0.8, 0.2), LDC.ink, "plain",
        fx + nx * 0.2 + F.radial[0] * rr, cy + F.radial[1] * rr, fz + nz * 0.2 + F.radial[2] * rr, F.tangent, F.radial, F.n);
    }
    faces.push({ x: x + fx + nx * 0.35, y: B.y + cy, z: z + fz + nz * 0.35, nx, nz });
  }
  ldSolid(B, 0, -1, 0, 6.6, 6.6, 79);
  ldSolid(B, 0, 79, 0, 4.5, 4.5, 89, "pillar");
  const g = ldFinish(B);
  // the hands: eight, one instanced mesh; turned every frame by ldClockHands
  const hand = new THREE.BoxGeometry(1, 1, 0.25);
  hand.translate(0, 0.5, 0);
  const hands = new THREE.InstancedMesh(hand, ldMat("plain"), 8);
  hands.setColorAt(0, ldCol.setHex(LDC.ink));
  for (let i = 1; i < 8; i++) hands.setColorAt(i, ldCol.setHex(LDC.ink));
  hands.userData.noShatter = true;
  hands.frustumCulled = false;
  scene.add(hands);
  ldn.hands = hands; ldn.faces = faces;
  return g;
}
const ldHandM = new THREE.Matrix4(), ldHandA = new THREE.Vector3(), ldHandB = new THREE.Vector3(), ldHandC = new THREE.Vector3();
// The minute hand goes round once between bongs and stands at the top as Big Ben strikes;
// the hour hand creeps a twelfth of the way round each time.
function ldClockPhase() {
  const T = LD.bigBen.every;
  return 1 - (ldn.bongAt - ldn.clock) / T;    // 0 just after a bong, running to 1 at the next
}
function ldClockHands() {
  if (!ldn.hands) return;
  const ph = clamp(ldClockPhase(), 0, 1);
  const mA = ph * Math.PI * 2, hA = (ldn.bongs / LD.bigBen.strikes + ph) / 12 * Math.PI * 2 + Math.PI * 2 / 3;
  let i = 0;
  for (const f of ldn.faces) {
    for (const [a, len, w, out] of [[mA, 4.0, 0.32, 0.12], [hA, 2.6, 0.55, 0.0]]) {
      const F = ldFaceAxes(f.nx, f.nz, a);
      ldHandA.set(F.tangent[0] * w, F.tangent[1] * w, F.tangent[2] * w);
      ldHandB.set(F.radial[0] * len, F.radial[1] * len, F.radial[2] * len);
      ldHandC.set(F.n[0], F.n[1], F.n[2]);
      ldHandM.makeBasis(ldHandA, ldHandB, ldHandC);
      ldHandM.setPosition(f.x + f.nx * out, f.y, f.z + f.nz * out);
      ldn.hands.setMatrixAt(i++, ldHandM);
    }
  }
  ldn.hands.instanceMatrix.needsUpdate = true;
}

// The Houses of Parliament along the river: a long stone front with a forest of pinnacles,
// the central tower's spire, and the Victoria Tower at the far end.
function ldParliament() {
  const [x, z] = LD.at.parliament, B = ldBegin("parliament", x, z);
  const S = LDC.stone, L = 132, D = 44, H = 22;
  ldBox(B, L, H + 6, D, S, "stone", 0, -6, 0);
  ldBox(B, L - 4, 5, D - 8, LDC.slate, "plain", 0, H, 0);                    // the slate roofs
  for (let k = 0; k < 22; k++) {
    const px = -L / 2 + 3 + k * (L - 6) / 21;
    for (const sz of [-1, 1]) {
      ldCyl(B, 0, 0.8, 7, 4, LDC.stoneLight, "stone", px, H, sz * (D / 2 - 0.6));
    }
    // the windows' bays down the river front
    for (const fl of [5, 12]) ldBox(B, 2.2, 4.5, 0.4, LDC.slate, "plain", px, fl, -D / 2 - 0.1);
  }
  // the central tower: an octagon and its spire
  ldCyl(B, 6.5, 7, 40, 8, S, "stone", 0, H, 0);
  ldCyl(B, 0, 6.5, 22, 8, LDC.slate, "plain", 0, H + 40, 0);
  ldSolid(B, 0, -1, 0, L / 2, D / 2, H + 5);
  ldSolid(B, 0, H + 5, 0, 6.5, 6.5, H + 40);
  ldFinish(B);
  // the Victoria Tower: square, the tallest stone tower, gold-tipped corners
  const [vx, vz] = LD.at.victoriaTower, V = ldBegin("victoriaTower", vx, vz);
  ldBox(V, 20, 86, 20, S, "stone", 0, -6, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    ldBox(V, 3, 82, 3, LDC.stoneLight, "stone", sx * 9.5, 0, sz * 9.5);
    ldCyl(V, 0, 1.6, 9, 4, LDC.gold, "plain", sx * 9.5, 82, sz * 9.5);
  }
  for (let k = 0; k < 5; k++) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ldBox(V, nz ? 4 : 0.4, 8, nx ? 4 : 0.4, LDC.slate, "plain", nx * 10.1, 14 + k * 13, nz * 10.1);
  }
  ldBox(V, 0.5, 14, 0.5, LDC.white, "plain", 0, 80, 0);                      // the flagpole (no flag: nothing to read)
  ldSolid(V, 0, -1, 0, 10, 10, 80);
  ldFinish(V);
}

// The big wheel on the south bank: a white rim on spokes, an A-frame on the land side, and
// its glass capsules, turning slowly and always upright. No sponsor, nothing written.
function ldEye() {
  const [x, z] = LD.at.eye, E = LD.eye, B = ldBegin("eye", x, z);
  const hubY = E.r + 6;
  // the A-frame: two legs from the land side up to the hub, and the hub
  for (const sx of [-1, 1]) {
    const fx = sx * 26, fz = -40, len = Math.hypot(fx, hubY, fz);
    const geo = new THREE.CylinderGeometry(1.1, 1.6, len, 8);
    // stand it on its foot and lean it to the hub
    const dir = new THREE.Vector3(-fx, hubY, -fz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    ldAdd(B, geo, LDC.white, "plain", fx + dir.x * len / 2, dir.y * len / 2, fz + dir.z * len / 2, e.x, e.y, e.z);
    B.solids.push({ x: fx / 2, y0: 0, z: fz / 2, hw: Math.abs(fx) / 2 + 2, hd: Math.abs(fz) / 2 + 2, y1: 6, kind: "pillar" });
  }
  ldCyl(B, 3, 3, 8, 12, LDC.steel, "plain", 0, hubY, -4, Math.PI / 2);
  ldBox(B, 6, 3, 10, LDC.concrete, "stone", 0, -4, -38);                      // the foot of the frame
  const g = ldFinish(B);
  // the rim and the spokes turn: their own group, about the hub, in the x-y plane
  const W = new THREE.Group();
  W.position.set(x, B.y + hubY, z);
  const R = { name: "eyeWheel", x: 0, z: 0, y: 0, parts: {}, solids: [], tris: 0 };
  const segs = 64;
  for (let k = 0; k < segs; k++) {
    const a = k / segs * Math.PI * 2, a1 = (k + 1) / segs * Math.PI * 2, am = (a + a1) / 2;
    const len = 2 * E.r * Math.sin(Math.PI / segs) + 0.2;
    for (const rr of [E.r, E.r - 3.2]) {
      ldAdd(R, new THREE.BoxGeometry(len, 0.9, 1.2), LDC.white, "plain", Math.cos(am) * rr, Math.sin(am) * rr, 0, 0, 0, am + Math.PI / 2);
    }
    if (k % 2 === 0) ldAdd(R, new THREE.BoxGeometry(0.4, 3.2, 0.4), LDC.white, "plain", Math.cos(am) * (E.r - 1.6), Math.sin(am) * (E.r - 1.6), 0, 0, 0, am + Math.PI / 2);
  }
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2;
    ldAdd(R, new THREE.BoxGeometry(0.22, E.r - 3, 0.22), LDC.steel, "plain", Math.cos(a) * (E.r - 3) / 2, Math.sin(a) * (E.r - 3) / 2, (k % 2 ? 1.5 : -1.5), 0, 0, a - Math.PI / 2);
  }
  for (const kind of Object.keys(R.parts)) {
    const P = R.parts[kind], geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ldMat(kind));
    m.castShadow = true; m.userData.noShatter = true;
    W.add(m);
  }
  W.userData.noShatter = true;
  scene.add(W);
  // the capsules: glass eggs on the outside of the rim, one instanced mesh
  const capGeo = new THREE.SphereGeometry(1, 10, 7);
  capGeo.scale(1.6, 1.4, 3.2);
  const caps = new THREE.InstancedMesh(capGeo, artPaint(new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70, specular: 0x6a7480 }), "glass"), E.capsules);
  for (let i = 0; i < E.capsules; i++) caps.setColorAt(i, ldCol.setHex(0xdfe9f2));
  caps.frustumCulled = false;
  caps.userData.noShatter = true;
  scene.add(caps);
  // the rim is round, so turning it never moves it: its solid stands still -- a ring of
  // oriented boxes round the hub -- and the capsules, which do move, are scenery on it
  const main = W.children[0];
  for (let k = 0; k < 24; k++) {
    const a = (k + 0.5) / 24 * Math.PI * 2, len = 2 * E.r * Math.sin(Math.PI / 24) + 1;
    const cx = x + Math.cos(a) * (E.r - 1.6), cy = B.y + hubY + Math.sin(a) * (E.r - 1.6);
    const u = [-Math.sin(a), Math.cos(a), 0], v = [Math.cos(a), Math.sin(a), 0], w = [0, 0, 1];
    const b = solidBox3(cx, cy, z, u, v, w, len / 2, 2.2, 2.6, "pillar");
    b.mesh = main; b.ld = "eye";
  }
  ldn.eye = { W, caps, x, y: B.y + hubY, z, r: E.r };
  return g;
}
const ldCapM = new THREE.Matrix4();   // (a plain matrix: an Object3D would draw a uuid off the real stream)
function ldEyeTurn(dt) {
  const E = ldn.eye;
  if (!E) return;
  ldn.eyeA = (ldn.eyeA + LD.eye.turn * dt) % (Math.PI * 2);
  E.W.rotation.z = ldn.eyeA;
  const n = LD.eye.capsules;
  for (let i = 0; i < n; i++) {
    const a = ldn.eyeA + i / n * Math.PI * 2;
    // always upright, the long way along the axle
    ldCapM.makeTranslation(E.x + Math.cos(a) * (E.r + 2.2), E.y + Math.sin(a) * (E.r + 2.2), E.z);
    E.caps.setMatrixAt(i, ldCapM);
  }
  E.caps.instanceMatrix.needsUpdate = true;
}

// Trafalgar Square: the column on its pedestal, four lions, two fountains; and the arch
// over the start of the Mall.
function ldNelson() {
  const [x, z] = LD.at.nelson, B = ldBegin("nelson", x, z);
  ldBox(B, 90, 7, 70, 0xc9c2ae, "stone", 0, -6.7, 0);                        // the square's paving
  ldBox(B, 18, 2, 18, LDC.grey, "stone", 0, 0.3, 0);
  ldBox(B, 8.5, 10, 8.5, LDC.grey, "stone", 0, 2.3, 0);
  for (const [nx, nz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    // a lion: a couched statue, all bronze, on its own plinth -- a statue, not an animal
    const lx = nx * 7.2, lz = nz * 7.2;
    ldBox(B, 3, 1.4, 6, LDC.grey, "stone", lx, 2.3, lz);
    ldBox(B, 2.4, 1.6, 5, LDC.bronze, "plain", lx, 3.7, lz);
    ldBox(B, 2.2, 2.2, 1.8, LDC.bronze, "plain", lx, 4.6, lz - nz * 1.8);
  }
  ldCyl(B, 2.1, 2.4, 40, 12, 0xbfc3c7, "stone", 0, 12.3, 0);
  ldBox(B, 5.2, 3, 5.2, LDC.bronze, "plain", 0, 52.3, 0);
  ldCyl(B, 0.9, 1.1, 4.2, 8, LDC.slate, "plain", 0, 55.3, 0);                // the statue on top
  ldSph(B, 0.8, LDC.slate, "plain", 0, 60.1, 0);
  for (const sx of [-1, 1]) {
    ldCyl(B, 9, 9.5, 1.2, 18, LDC.grey, "stone", sx * 28, 0.3, -6);
    ldCyl(B, 8.2, 8.2, 0.3, 18, LDC.sea, "plain", sx * 28, 1.25, -6);
    ldCyl(B, 0.5, 1.2, 4, 8, LDC.grey, "stone", sx * 28, 1.5, -6);
  }
  ldSolid(B, 0, 0.3, 0, 9, 9, 2.3, "building");
  ldSolid(B, 0, 2.3, 0, 4.3, 4.3, 12.3);
  ldSolid(B, 0, 12.3, 0, 2.4, 2.4, 59, "pillar");
  ldFinish(B);
  // Admiralty Arch: one long block with three openings; the Mall runs through the middle one
  const [ax, az] = LD.at.arch, A = ldBegin("arch", ax, az);
  ldBox(A, 18, 26, 14, LDC.stoneLight, "stone", -21, -6, 0);
  ldBox(A, 18, 26, 14, LDC.stoneLight, "stone", 21, -6, 0);
  ldBox(A, 24, 6, 14, LDC.stoneLight, "stone", 0, 14, 0);
  ldBox(A, 62, 1.2, 15, LDC.stone, "stone", 0, 20, 0);
  for (const sx of [-1, 1]) ldBox(A, 4, 8, 14.2, LDC.slate, "plain", sx * 21, 0, 0);   // the side arches, dark
  ldSolid(A, -21, -1, 0, 9, 7, 21.2); ldSolid(A, 21, -1, 0, 9, 7, 21.2);
  ldSolid(A, 0, 14, 0, 12, 7, 21.2);
  ldFinish(A);
}

// The Mall, red from the arch to the palace, with plane trees down both sides; the
// Victoria Memorial; Buckingham Palace; and its sentry boxes, standing empty.
function ldPalace() {
  const [mx, mz0, mz1] = LD.at.mall, M = ldBegin("mall", mx, (mz0 + mz1) / 2);
  const n = Math.ceil((mz1 - mz0) / 9);
  for (let k = 0; k < n; k++) {
    const za = mz0 + (mz1 - mz0) * k / n, zb = mz0 + (mz1 - mz0) * (k + 1) / n;
    // draped piece by piece on the ground the chunks draw, its top a few centimetres over the
    // street's (v198: he drives up it, and the car stands at the street's height)
    const ya = terrainMeshY(mx, za), yb = terrainMeshY(mx, zb), ym = Math.max(ya, yb);
    ldBox(M, 20, 0.4, zb - za + 0.05, 0xb5443a, "plain", 0, ym + CITY.groundLift + 0.03 - 0.4 - M.y, (za + zb) / 2 - M.z);
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) {
    const tz = mz0 + 14 + k * (mz1 - mz0 - 28) / 13 - M.z, tx = sx * 15;
    const gy = terrainEff(mx + tx, M.z + tz) - M.y;
    ldCyl(M, 0.4, 0.55, 5, 6, 0x6b4f35, "plain", tx, gy - 0.5, tz);
    ldSph(M, 3.6, 0x3f8f45, "plain", tx, gy + 7, tz, 1, 1.15, 1, 8, 6);
  }
  ldFinish(M);
  const [vx, vz] = LD.at.memorial, V = ldBegin("memorial", vx, vz);
  ldCyl(V, 15, 16, 7, 24, 0xe8e2d0, "stone", 0, -6, 0);
  ldCyl(V, 11, 12, 1.5, 24, LDC.white, "stone", 0, 1, 0);
  ldBox(V, 6, 12, 6, LDC.white, "stone", 0, 2.5, 0);
  ldCyl(V, 0.8, 1.2, 3.2, 8, LDC.gold, "plain", 0, 14.5, 0);                // the gilded figure on top
  ldSph(V, 0.7, LDC.gold, "plain", 0, 18.3, 0);
  for (const sx of [-1, 1]) ldBox(V, 3.2, 0.3, 0.8, LDC.gold, "plain", sx * 1.6, 17.2, 0, 0, 0, sx * 0.5);   // its wings
  ldSolid(V, 0, 0, 0, 12, 12, 2.5);
  ldSolid(V, 0, 2.5, 0, 3, 3, 14.5);
  ldFinish(V);
  const [px, pz] = LD.at.palace, P = ldBegin("palace", px, pz);
  const W = 112, D = 30, H = 24;
  ldBox(P, W, H + 6, D, 0xe3dcc8, "stone", 0, -6, 0);
  ldBox(P, W + 1, 1.4, D + 1, LDC.stoneLight, "stone", 0, H, 0);            // the balustrade
  for (const sx of [-1, 1]) ldBox(P, 22, H + 6, 70, 0xe3dcc8, "stone", sx * (W / 2 - 11), -6, D / 2 + 30);   // the wings
  ldBox(P, 34, H + 3, 5, 0xeee9da, "stone", 0, -3, -D / 2 - 2.5);           // the centre front
  ldPyr(P, 30, 4.5, 4, 0xeee9da, "stone", 0, H, -D / 2 - 2.5);              // its pediment
  for (let k = 0; k < 6; k++) ldCyl(P, 0.9, 0.9, 16, 10, LDC.white, "stone", -12.5 + k * 5, 4, -D / 2 - 5.6);
  for (let fl = 0; fl < 3; fl++) for (let k = 0; k < 18; k++) {
    const wx = -W / 2 + 4 + k * (W - 8) / 17;
    if (Math.abs(wx) < 17) continue;
    ldBox(P, 2, 3.6, 0.4, LDC.slate, "plain", wx, 3 + fl * 7, -D / 2 - 0.1);
  }
  ldBox(P, 0.4, 10, 0.4, LDC.white, "plain", 0, H + 1.4, 0);                // a flagpole, and its flag: colour, no device
  ldBox(P, 0.1, 3.2, 5, LDC.red, "plain", 0, H + 8, 2.6);
  // the forecourt: railings with gilded gates, and four sentry boxes, empty
  ldBox(P, W + 30, 0.6, 26, 0xd9cfb0, "plain", 0, -0.4, -D / 2 - 18);
  for (let k = 0; k <= 40; k++) {
    const rx = -(W + 24) / 2 + k * (W + 24) / 40;
    ldBox(P, 0.25, 3, 0.25, LDC.ink, "plain", rx, 0, -D / 2 - 31);
  }
  ldBox(P, W + 24, 0.3, 0.3, LDC.ink, "plain", 0, 2.7, -D / 2 - 31);
  for (const sx of [-1, 1]) ldBox(P, 1.2, 4.5, 1.2, LDC.gold, "plain", sx * 6, 0, -D / 2 - 31);
  for (const sx of [-1.5, -0.5, 0.5, 1.5]) {
    const bx = sx * 22, bz = -D / 2 - 9;
    ldBox(P, 1.6, 2.8, 1.6, LDC.ink, "plain", bx, 0, bz);
    ldPyr(P, 1.9, 1.9, 1, LDC.red, "plain", bx, 2.8, bz);
    ldBox(P, 1.0, 2.1, 0.1, 0x4a4f55, "plain", bx, 0.2, bz - 0.81);         // the open front: nobody in it
  }
  ldSolid(P, 0, -1, 0, W / 2, D / 2, H + 1.4);
  for (const sx of [-1, 1]) ldSolid(P, sx * (W / 2 - 11), -1, D / 2 + 30, 11, 35, H);
  ldSolid(P, 0, -1, -D / 2 - 2.5, 17, 2.5, H + 3);
  ldSolid(P, 0, 0, -D / 2 - 31, (W + 24) / 2, 0.4, 3, "wall");
  for (const sx of [-1.5, -0.5, 0.5, 1.5]) ldSolid(P, sx * 22, 0, -D / 2 - 9, 0.8, 0.8, 3.8, "pillar");
  ldFinish(P);
}

// St Paul's: the great dome on its colonnaded drum, the lantern and its golden cross-ball,
// the nave and transept, and the two west towers facing the way in (+z).
function ldStPauls() {
  const [x, z] = LD.at.stPauls, B = ldBegin("stPauls", x, z);
  const S = 0xe4e0d4, L = LDC.lead;
  ldBox(B, 30, 32, 150, S, "stone", 0, -6, 0);                               // the nave, west front at +z
  ldBox(B, 76, 32, 30, S, "stone", 0, -6, -10);                              // the transept
  ldBox(B, 31, 1.2, 151, LDC.stoneLight, "stone", 0, 26, 0);
  ldBox(B, 28, 4, 148, L, "plain", 0, 26.5, 0);                              // the lead roofs
  ldBox(B, 74, 4, 28, L, "plain", 0, 26.5, -10);
  ldCyl(B, 6, 6, 4, 6, S, "stone", 0, 26, -70);                              // the east apse
  // the dome
  const dz = -10;
  ldCyl(B, 19, 19, 13, 24, S, "stone", 0, 30, dz);
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2;
    ldCyl(B, 0.7, 0.7, 11, 6, LDC.white, "stone", Math.cos(a) * 20.5, 31, dz + Math.sin(a) * 20.5);
  }
  ldCyl(B, 21.5, 21.5, 1.4, 24, LDC.stoneLight, "stone", 0, 42.2, dz);
  ldCyl(B, 15.5, 16, 8, 24, S, "stone", 0, 43.4, dz);
  ldSph(B, 17, L, "plain", 0, 51.4, dz, 1, 1.05, 1, 24, 10, Math.PI / 2);
  for (let k = 0; k < 16; k++) {
    // the dome's ribs: what makes it read as a dome and not a ball
    const a = k / 16 * Math.PI * 2;
    ldAdd(B, new THREE.TorusGeometry(17.1, 0.35, 4, 12, Math.PI / 2), LDC.stoneLight, "stone", 0, 51.4, dz, 0, a, 0, 1, 1.05, 1);
  }
  ldCyl(B, 3, 3.4, 9, 10, S, "stone", 0, 68.5, dz);
  ldCyl(B, 0, 3.4, 4, 10, L, "plain", 0, 77.5, dz);
  ldSph(B, 1.3, LDC.gold, "plain", 0, 82.5, dz);
  ldBox(B, 0.5, 4, 0.5, LDC.gold, "plain", 0, 83.4, dz);
  ldBox(B, 2.2, 0.5, 0.5, LDC.gold, "plain", 0, 85.6, dz);
  // the west front: two towers and the portico between them
  for (const sx of [-1, 1]) {
    ldBox(B, 10, 52, 10, S, "stone", sx * 13, -6, 70);
    ldCyl(B, 3.6, 4.2, 6, 10, S, "stone", sx * 13, 46, 70);
    ldSph(B, 3.6, L, "plain", sx * 13, 52, 70, 1, 1.4, 1, 10, 6, Math.PI / 2);
    ldBox(B, 0.4, 4, 0.4, LDC.gold, "plain", sx * 13, 57, 70);
  }
  for (let k = 0; k < 6; k++) ldCyl(B, 0.9, 0.9, 13, 10, LDC.white, "stone", -10 + k * 4, 0, 77);
  ldPyr(B, 26, 5, 6, S, "stone", 0, 26, 76);
  ldSolid(B, 0, -1, 0, 15, 75, 30.5);
  ldSolid(B, 0, -1, -10, 38, 15, 30.5);
  ldSolid(B, 0, 30, dz, 20, 20, 52);
  ldSolid(B, 0, 52, dz, 12, 12, 66);
  ldSolid(B, 0, 66, dz, 3.4, 3.4, 86, "pillar");
  for (const sx of [-1, 1]) ldSolid(B, sx * 13, -1, 70, 5, 5, 57);
  ldFinish(B);
}

// London Bridge: plain and modern, three concrete spans on two piers. Its deck is 9 m over
// the water, so a boat goes under it.
function ldDeckY() { return TUNE.waterLevel + 9; }
function ldLondonBridge() {
  const [x, z] = LD.at.londonBridge, B = ldBegin("londonBridge", x, z, ldDeckY());
  // (v198: 20 wide, not 26 -- it carries the street at z 14260, and the bank's buildings stand
  // 10 m off that street's line)
  const L = 236, W = 20;
  ldn.decks.londonBridge = [x - L / 2, x + L / 2];
  ldBox(B, L, 2.4, W, LDC.concrete, "stone", 0, -2.4, 0);
  ldBox(B, L, 0.3, W - 6, 0x5e636b, "plain", 0, 0, 0);                        // the carriageway
  for (const sz of [-1, 1]) ldBox(B, L, 1.1, 0.5, LDC.grey, "stone", 0, 0, sz * (W / 2 - 0.3));
  for (const px of [-36, 36]) {
    ldBox(B, 8, 20, W - 2, LDC.concrete, "stone", px, -22.4, 0);
  }
  ldSolid(B, 0, -2.4, 0, L / 2, W / 2, 0.3, "bridge");
  for (const px of [-36, 36]) ldSolid(B, px, -22.4, 0, 4, W / 2 - 1, -2.4, "pillar");
  ldFinish(B);
}

// TOWER BRIDGE, the hero: two stone towers standing in the river with their pointed turrets,
// the high walkways between them, the blue bascules (in two leaves, their own meshes: the
// next release opens them), and the blue suspension chains down to the shore towers.
function ldTowerBridge() {
  const [x, z] = LD.at.towerBridge, deck = ldDeckY(), B = ldBegin("towerBridge", x, z, deck);
  const S = 0xd6cdb4, BL = LDC.blue, half = 31, tw = 18, td = 26, top = 42, arch = 9;   // (v198: deeper, the arch a street wide)
  ldn.tbHalf = half;                // each leaf's length: the river code stands its upright wall by it (v199)
  for (const sx of [-1, 1]) {
    const tx = sx * (half + tw / 2);
    ldBox(B, tw + 6, 22, td + 6, LDC.grey, "stone", tx, -22, 0);            // the pier in the river
    // (v198: two columns and the stone over a real arch -- he drives through it now)
    for (const sz of [-1, 1]) ldBox(B, tw, top, td / 2 - arch, S, "stone", tx, 0, sz * (td / 2 + arch) / 2);
    ldBox(B, tw, top - 9, 2 * arch, S, "stone", tx, 9, 0);
    ldBox(B, tw, 0.3, 2 * arch - 1, 0x5e636b, "plain", tx, 0, 0);              // the road through it
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
      ldBox(B, 4.4, top + 4, 4.4, 0xe6dec8, "stone", tx + cx * (tw / 2 - 1.6), 0, cz * (td / 2 - 1.6));
      ldPyr(B, 5.2, 5.2, 9, LDC.slate, "plain", tx + cx * (tw / 2 - 1.6), top + 4, cz * (td / 2 - 1.6));
      ldCyl(B, 0, 0.3, 3, 4, LDC.gold, "plain", tx + cx * (tw / 2 - 1.6), top + 13, cz * (td / 2 - 1.6));
    }
    ldPyr(B, tw - 2, td - 2, 7, LDC.slate, "plain", tx, top, 0);
    // the arch's lining, dark, so it reads as a way through (v198: a street's two lanes wide), and the gothic windows
    for (const sz of [-1, 1]) ldBox(B, tw + 0.2, 9, 0.3, LDC.slate, "plain", tx, 0, sz * (arch + 0.1));
    ldBox(B, tw + 0.2, 0.4, 2 * arch, LDC.slate, "plain", tx, 8.6, 0);
    for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) {
      ldBox(B, 2.4, 6, 0.3, LDC.slate, "plain", tx - 4 + k * 4, 14 + 9, sz * (td / 2 + 0.05));
      ldBox(B, 2.4, 5, 0.3, LDC.slate, "plain", tx - 4 + k * 4, 14, sz * (td / 2 + 0.05));
    }
    ldSolid(B, tx, -22, 0, tw / 2 + 3, td / 2 + 3, 0, "pillar");
    // a tower stands either side of the road, which goes through its arch: two solids, not one
    for (const sz of [-1, 1]) ldSolid(B, tx, 0, sz * (td / 2 + arch) / 2, tw / 2, (td / 2 - arch) / 2, top, "pillar");
    ldSolid(B, tx, 9, 0, tw / 2, td / 2, top + 4);
  }
  // the high walkways, between the towers' tops
  for (const sz of [-1, 1]) {
    ldBox(B, 2 * half, 4, 3.4, BL, "plain", 0, top - 8, sz * 7);
    ldBox(B, 2 * half, 0.6, 3.8, LDC.white, "plain", 0, top - 4.2, sz * 7);
    for (let k = 0; k < 8; k++) ldBox(B, 0.4, 4, 3.5, LDC.white, "plain", -half + 3.5 + k * (2 * half - 7) / 7, top - 8, sz * 7);
    ldSolid(B, 0, top - 8, sz * 7, half, 1.7, top - 4, "bridge");
  }
  // the side spans: the deck to the shore towers, and the chains that carry them
  const shore = 128;
  for (const sx of [-1, 1]) {
    const x0 = sx * (half + tw), x1 = sx * shore, len = Math.abs(x1 - x0);
    ldBox(B, len, 2, 22, LDC.grey, "stone", (x0 + x1) / 2, -2, 0);
    ldBox(B, len, 0.3, 15, 0x5e636b, "plain", (x0 + x1) / 2, 0, 0);
    ldSolid(B, (x0 + x1) / 2, -2, 0, len / 2, 11, 0.3, "bridge");
    // the shore tower: the road goes through it under an arch (v198: the street runs on to the bank)
    const sxc = x1 + sx * 7;
    for (const sz of [-1, 1]) {
      ldBox(B, 14, 16, 12 - arch, S, "stone", sxc, -6, sz * (12 + arch) / 2);
      ldSolid(B, sxc, -6, sz * (12 + arch) / 2, 7, (12 - arch) / 2, 10);
    }
    ldBox(B, 14, 4, 2 * arch, S, "stone", sxc, 6, 0);                           // over the arch
    for (const sz of [-1, 1]) ldBox(B, 14.2, 6, 0.3, LDC.slate, "plain", sxc, 0, sz * (arch + 0.1));   // its lining
    ldBox(B, 14, 1.8, 2 * arch, LDC.grey, "stone", sxc, -1.5, 0);              // the road through it
    ldBox(B, 14.1, 0.3, 2 * arch - 1, 0x5e636b, "plain", sxc, 0, 0);
    ldSolid(B, sxc, 6, 0, 7, arch, 10);
    ldSolid(B, sxc, -1.5, 0, 7, arch, 0.3, "bridge");
    ldPyr(B, 14, 24, 5, LDC.slate, "plain", sxc, 10, 0);
    // the chain: down in a curve from the tower's shoulder to the shore tower
    const n = 10;
    for (const sz of [-1, 1]) for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const cx0 = x0 + (x1 - x0) * t0, cx1 = x0 + (x1 - x0) * t1;
      const yc = t => 30 * (1 - t) * (1 - t) + 2 * t * (1 - t) * 4 + 9 * t * t;
      const y0 = yc(t0), y1 = yc(t1), seg = Math.hypot(cx1 - cx0, y1 - y0);
      ldAdd(B, new THREE.BoxGeometry(seg, 1.4, 1.2), BL, "plain", (cx0 + cx1) / 2, (y0 + y1) / 2, sz * 11, 0, 0, Math.atan2(y1 - y0, cx1 - cx0));
      if (k % 2 === 1) ldBox(B, 0.3, (y0 + y1) / 2, 0.3, BL, "plain", (cx0 + cx1) / 2, 0, sz * 11);
    }
  }
  ldn.decks.towerBridge = [x - shore - 14, x + shore + 14];
  const g = ldFinish(B);
  // the bascules: two leaves, each hinged at its tower; blue, white-edged, the road on top
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(x + sx * half, deck, z);
    const L = { name: "tbLeaf", x: 0, y: 0, z: 0, parts: {}, solids: [], tris: 0 };
    ldBox(L, half, 1.8, 18, BL, "plain", -sx * half / 2, -1.8, 0);
    ldBox(L, half, 0.3, 14, 0x5e636b, "plain", -sx * half / 2, 0, 0);
    for (const sz of [-1, 1]) ldBox(L, half, 1.1, 0.5, LDC.white, "plain", -sx * half / 2, 0, sz * 8.8);
    for (const kind of Object.keys(L.parts)) {
      const P = L.parts[kind], geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, ldMat(kind)); m.castShadow = true; m.receiveShadow = true; m.userData.noShatter = true;
      leaf.add(m);
    }
    leaf.userData.noShatter = true;
    scene.add(leaf);
    const sb = addSolidBox(x + sx * half / 2, deck - 1.8, z, half / 2, 9, deck + 0.3, leaf.children[0], "bridge");
    sb.ld = "towerBridge";
    ldn.tbLeaves.push({ g: leaf, sx, solid: sb });
  }
  return g;
}

// The Tower of London: the White Tower with its four capped turrets, inside two rings of
// walls with their round towers, on the north bank by Tower Bridge.
function ldTower() {
  const [x, z] = LD.at.tower, B = ldBegin("tower", x, z);
  const W = 0xeeece4;
  ldBox(B, 32, 33, 36, W, "stone", 0, -6, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const round = sx > 0 && sz < 0;
    const tx = sx * 15, tz = sz * 17;
    if (round) ldCyl(B, 4.2, 4.2, 37, 12, W, "stone", tx, -2, tz);
    else ldBox(B, 7, 37, 7, W, "stone", tx, -2, tz);
    // the ogee caps: a lead dome under a gold vane
    ldSph(B, 3.6, LDC.lead, "plain", tx, 35, tz, 1, 1.6, 1, 10, 6, Math.PI / 2);
    ldBox(B, 0.3, 3.5, 0.3, LDC.gold, "plain", tx, 40.5, tz);
  }
  for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) ldBox(B, 2.2, 4.5, 0.3, LDC.slate, "plain", -9 + k * 6, 13, sz * 18.05);
  for (let k = 0; k < 4; k++) ldBox(B, 32.4, 1, 1, 0xd8d4c6, "stone", 0, 26.5, -18 + k * 12);   // the battlements' line
  ldSolid(B, 0, -1, 0, 16, 18, 27);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ldSolid(B, sx * 15, 27, sz * 17, 3.5, 3.5, 37, "pillar");
  // the walls: inner (higher) and outer, each a square ring with towers along it
  const ring = (half, h, t, color, towers) => {
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = nx * half, cz = nz * half, along = nz ? 2 * half + t : t, across = nz ? t : 2 * half + t;
      ldBox(B, along, h + 6, across, color, "stone", cx, -6, cz);
      for (let k = 0; k < 9; k++) {   // crenellations
        const o = -half + (k + 0.5) * (2 * half) / 9;
        ldBox(B, nz ? 3 : t + 0.2, 1.2, nz ? t + 0.2 : 3, color, "stone", cx + (nz ? o : 0), h, cz + (nx ? o : 0));
      }
      B.solids.push({ x: cx, y0: -1, z: cz, hw: along / 2, hd: across / 2, y1: h + 1.2, kind: "wall" });
      for (let k = 0; k < towers; k++) {
        const o = -half + k * (2 * half) / (towers - 1);
        const tx = cx + (nz ? o : 0), tz = cz + (nx ? o : 0);
        ldCyl(B, 5, 5.4, h + 10, 12, color, "stone", tx, -6, tz);
        B.solids.push({ x: tx, y0: -1, z: tz, hw: 5.4, hd: 5.4, y1: h + 4, kind: "wall" });
      }
    }
  };
  ring(56, 10, 4, 0xd8d0b8, 4);
  ring(74, 6, 3, 0xcbc2a6, 3);
  ldBox(B, 152, 0.4, 152, 0x6aa84f, "plain", 0, -0.3, 0);                    // the green between, the old moat's lawn
  ldFinish(B);
}

// The Shard: a glass spire tapering from the south bank, its top breaking into splinters.
function ldShard() {
  const [x, z] = LD.at.shard, B = ldBegin("shard", x, z), H = 232;
  const col = (wx, wy, wz) => 0xb8cddd;
  ldAdd(B, new THREE.CylinderGeometry(3.5, 29, H, 8, 1), col, "glass", 0, H / 2 - 6, 0, 0, Math.PI / 8, 0);
  // the splinters: four thin glass blades standing proud of the point, leaning apart
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    ldAdd(B, new THREE.BoxGeometry(5, 22, 0.6), 0xd5e3ee, "glass", Math.cos(a) * 2.6, H - 6 + 6, Math.sin(a) * 2.6, 0, -a + Math.PI / 2, Math.cos(a) * 0.08);
  }
  for (let k = 0; k < 8; k++) {
    const y0 = k * (H - 30) / 8, y1 = (k + 1) * (H - 30) / 8, r = 29 - (26 * ((y0 + y1) / 2 + 6)) / H;
    ldSolid(B, 0, y0 - 1, 0, r * 0.85, r * 0.85, y1, k < 7 ? "building" : "pillar");
  }
  ldSolid(B, 0, H - 30, 0, 5, 5, H + 6, "pillar");
  ldFinish(B);
}

// The Gherkin: a rounded glass bullet with dark diagonals spiralling up it.
function ldGherkin() {
  const [x, z] = LD.at.gherkin, B = ldBegin("gherkin", x, z), H = 165;
  const prof = [];
  for (let k = 0; k <= 22; k++) {
    const t = k / 22, y = t * H;
    const r = t < 0.42 ? lerp(21, 27, Math.sin(t / 0.42 * Math.PI / 2)) : 27 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2)));
    prof.push(new THREE.Vector2(Math.max(r, 0.01), y));
  }
  const geo = new THREE.LatheGeometry(prof, 32);
  const spiral = (wx, wy, wz) => {
    const a = Math.atan2(wz - z, wx - x), y = wy - B.y;
    const u = (a / (Math.PI * 2) * 6 + y / 28) % 1;
    return (u + 1) % 1 < 0.42 ? 0x2f3a48 : 0x9fb8cc;
  };
  ldAdd(B, geo, spiral, "glass", 0, -4, 0);
  for (let k = 0; k < 7; k++) {
    const y0 = k * H / 7, y1 = (k + 1) * H / 7, t = (y0 + y1) / 2 / H;
    const r = t < 0.42 ? 24 : 27 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2)));
    ldSolid(B, 0, y0 - 1, 0, r * 0.78, r * 0.78, y1 - 4, k < 6 ? "building" : "dome");
  }
  ldFinish(B);
}

// The red telephone boxes, in pairs on the squares: one merged mesh, each a small solid.
function ldPhoneBoxes() {
  const spots = [[-468, 15590], [-476, 15590], [-872, 15665], [-880, 15665], [-855, 15720], [-1196, 14690], [-1204, 14690],
                 [-952, 14010], [-960, 14010], [-690, 14240], [-560, 15545], [-1290, 14090]];
  const CB = LD.cityBox, B = ldBegin("phoneBoxes", (CB.x0 + CB.x1) / 2, (CB.z0 + CB.z1) / 2, 0);
  for (const [wx, wz] of spots) {
    const gy = terrainEff(wx, wz), px = wx - B.x, pz = wz - B.z;
    ldBox(B, 1.3, 2.4, 1.3, LDC.red, "plain", px, gy - 0.4, pz);
    ldBox(B, 1.45, 0.35, 1.45, LDC.red, "plain", px, gy + 2.0, pz);
    ldSph(B, 0.7, LDC.red, "plain", px, gy + 2.35, pz, 1, 0.45, 1, 8, 4, Math.PI / 2);
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ldBox(B, nz ? 0.9 : 0.06, 1.3, nx ? 0.9 : 0.06, 0xd8e6ee, "plain", px + nx * 0.66, gy + 0.6, pz + nz * 0.66);
    }
    ldSolid(B, px, gy - 0.4, pz, 0.7, 0.7, gy + 2.6, "pillar");
    ldn.phone.push({ x: wx, z: wz });
  }
  ldFinish(B);
}

// ===========================================================================================
// THE CROSSING: the ships, the lighthouse, the whale
// ===========================================================================================
function ldShipMesh(k) {
  const B = { name: "ship" + k, x: 0, y: 0, z: 0, parts: {}, solids: [], tris: 0 };
  const L = 120 + k * 25, W = 18;
  const hull = [LC.night, 0x2b4fb0, 0x3c4350][k % 3];
  ldBox(B, L, 9, W, hull, "plain", 0, -5, 0);
  ldBox(B, L + 0.4, 2, W + 0.4, LC.red, "plain", 0, -5, 0);                   // the red below the waterline, at it
  ldAdd(B, new THREE.CylinderGeometry(0.5, W / 2, 16, 4, 1), hull, "plain", -L / 2 - 7.5, -0.5, 0, 0, Math.PI / 4, Math.PI / 2, 1, 1, 0.75);
  ldBox(B, 18, 12, W - 2, LC.white, "plain", L / 2 - 14, 4, 0);              // the bridge, aft
  ldBox(B, 22, 1, W, LC.white, "plain", L / 2 - 14, 15.6, 0);
  ldCyl(B, 2, 2.4, 8, 10, LC.red, "plain", L / 2 - 8, 16, 0);
  const cc = [LC.red, LC.blue, 0xffd23e, 0x36c46a, LC.rust, LC.steel];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) for (let h = 0; h < 2 + ((i + j + k) % 2); h++) {
    ldBox(B, 12, 2.6, 5.4, cc[(i * 3 + j + h + k) % cc.length], "plain", -L / 2 + 14 + i * 13, 4 + h * 2.6, -6 + j * 6);
  }
  const g = new THREE.Group();
  for (const kind of Object.keys(B.parts)) {
    const P = B.parts[kind], geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ldMat(kind)); m.castShadow = true;
    m.userData.noSolid = true; m.userData.noShatter = true;
    g.add(m);
  }
  g.userData.noSolid = true; g.userData.noShatter = true;
  return { g, len: L };
}
function ldShips() {
  const S = LD.ships;
  for (let k = 0; k < S.n; k++) {
    const { g, len } = ldShipMesh(k);
    const dir = k % 2 ? -1 : 1;
    const ship = { g, len, dir, z: S.lanes[k], x: (k - 1) * 900 };
    g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;   // her bow (-x in her own frame) the way she sails
    g.position.set(ship.x, TUNE.waterLevel, ship.z);
    scene.add(g);
    ldn.ships.push(ship);
  }
}
function ldShipsMove(dt) {
  const S = LD.ships;
  for (const s of ldn.ships) {
    s.x += s.dir * S.speed * dt;
    // round again where nobody can see it happen: past the span, beyond the fog
    if (s.x > S.span) s.x -= 2 * S.span; else if (s.x < -S.span) s.x += 2 * S.span;
    s.g.position.set(s.x, TUNE.waterLevel + Math.sin(ldn.clock * 0.6 + s.z) * 0.15, s.z);
  }
}

function ldLighthouse() {
  const R = LD.islands.find(i => i.kind === "rock"), B = ldBegin("lighthouse", R.x, R.z), H = LD.lighthouse.h;
  const bands = (wx, wy) => (Math.floor((wy - B.y) / 5) % 2 ? LC.red : LC.white);
  ldCyl(B, 3.2, 4.6, H + 4, 14, bands, "plain", 0, -4, 0);
  ldCyl(B, 4.6, 4.6, 0.8, 14, LC.ink, "plain", 0, H, 0);                    // the gallery
  ldCyl(B, 2.4, 2.4, 3.6, 10, 0xfff2b0, "lamp", 0, H + 0.8, 0);             // the lamp room, lit
  ldCyl(B, 0, 2.9, 2.6, 10, LC.red, "plain", 0, H + 4.4, 0);
  ldBox(B, 6, 4, 5, LC.white, "plain", 6.5, -1, 3);                          // the keeper's store
  ldPyr(B, 6.4, 5.4, 2, LC.red, "plain", 6.5, 3, 3);
  ldSolid(B, 0, -2, 0, 4.4, 4.4, H + 7);
  ldSolid(B, 6.5, -1, 3, 3, 2.5, 3);
  ldFinish(B);
  // the beam: two long soft blades turning round the lamp, and the lamp's own glow
  const beam = new THREE.Group();
  beam.position.set(R.x, B.y + H + 2.6, R.z);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  ldn.beamMat = mat;
  for (const s of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 160, 10, 1, true), mat);
    cone.rotation.z = s * Math.PI / 2;
    cone.position.x = s * 80;
    cone.userData.noSolid = true;
    beam.add(cone);
  }
  if (typeof glowSprite === "function") { const gl = glowSprite(0xfff2b0, 16, 0.85); beam.add(gl); }
  scene.add(beam);
  ldn.beam = beam;
}

// The whale, out on the crossing: the harbour's own whale (seaWhaleBuild), on London's own
// timetable and stream. Off his beam, a long way off, in deep water; nothing can reach it.
function ldWhaleBuild() {
  ldn.whale.g = seaWhaleBuild();
}
function ldWhaleUpdate(dt) {
  const W = ldn.whale, C = SE.whale, LW = LD.whale;
  if (!W.g) return;
  if (W.up > 0) {
    W.up -= dt;
    const k = 1 - W.up / C.riseTime, arc = Math.sin(k * Math.PI);
    W.g.visible = true;
    W.g.position.set(W.x, TUNE.waterLevel - C.len * 0.9 + arc * C.height, W.z);
    W.g.rotation.set(-Math.PI * 0.5 + (k - 0.5) * C.roll, W.heading, Math.sin(k * Math.PI) * 0.3);
    if (W.up <= 0) {
      W.g.visible = false;
      splashAt(W.x, TUNE.waterLevel, W.z, 3.2);
      for (let i = 0; i < 12; i++) wakePuff(W.x + (ldRun() - 0.5) * 26, TUNE.waterLevel + 1, W.z + (ldRun() - 0.5) * 26, 0xf2f4f7, 3.2, 8, 1.6);
      flags.ldWhaleBreaches = (flags.ldWhaleBreaches || 0) + 1;
    }
    return;
  }
  // only out on the open crossing
  if (state.z < LD.seaFull || state.z > LD.coast.z - 300) return;
  W.next -= dt;
  if (W.next > 0) return;
  W.next = lerp(LW.every[0], LW.every[1], ldRun());
  const a = state.heading + (ldRun() < 0.5 ? 1 : -1) * (Math.PI / 3 + ldRun() * Math.PI / 3);
  const d = lerp(LW.dist[0], LW.dist[1], ldRun());
  const wx = state.x - Math.sin(a) * d, wz = state.z - Math.cos(a) * d;
  if (terrainEff(wx, wz) > TUNE.waterLevel - C.minDepth) { W.next = C.retry; return; }
  W.x = wx; W.z = wz; W.heading = ldRun() * Math.PI * 2; W.up = C.riseTime;
  for (let i = 0; i < 5; i++) wakePuff(wx + (ldRun() - 0.5) * 5, TUNE.waterLevel + 3 + i * 2, wz + (ldRun() - 0.5) * 5, 0xf2f4f7, 2.0, 7, 1.4);
}

// ===========================================================================================
// BIG BEN'S BONG: every `every` game seconds, `strikes` strokes `gap` apart, heard within
// `hear` metres of the tower and quieter with distance. Counted whether or not the audio runs.
// ===========================================================================================
function ldBongSound(gain) {
  if (!audioCtx || audioCtx.state !== "running" || gain <= 0) return;
  const t = audioCtx.currentTime;
  // a bell's partials: hum, the strike note, and its bright inharmonic ring, decaying
  for (const [f, a, d] of [[82.4, 0.42, 6.5], [164.8, 0.5, 4.8], [197.5, 0.22, 3.6], [247, 0.18, 3], [412, 0.1, 1.6], [659, 0.05, 0.9]]) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, a * gain * 0.5), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + d + 0.1);
  }
}
function ldBongUpdate(dt) {
  const BB = LD.bigBen, [bx, bz] = LD.at.bigBen;
  if (ldn.clock >= ldn.bongAt) {
    ldn.bongAt += BB.every;
    for (let i = 0; i < BB.strikes; i++) ldn.strikes.push(ldn.clock + i * BB.gap);
  }
  while (ldn.strikes.length && ldn.strikes[0] <= ldn.clock) {
    ldn.strikes.shift();
    const d = Math.hypot(camera.position.x - bx, camera.position.z - bz);
    ldn.bongs++;
    flags.bigBenBongs = (flags.bigBenBongs || 0) + 1;
    if (d < BB.hear) { flags.bigBenHeard = (flags.bigBenHeard || 0) + 1; ldBongSound(1 - d / BB.hear); }
  }
}

// ===========================================================================================
// THE AIRPORT, the city, and the region
// ===========================================================================================
function ldBuild() {
  if (ldn.built) return;
  const before = scene.children.length;
  ldQuiet(() => {
    ldn.region = solidRegionOpen("london");
    ldBigBen(); ldParliament(); ldEye(); ldNelson(); ldPalace(); ldStPauls();
    ldLondonBridge(); ldTowerBridge(); ldTower(); ldShard(); ldGherkin(); ldPhoneBoxes();
    ldShips(); ldLighthouse(); ldWhaleBuild();
    // London's airport: the same runway, terminal, tower and hangars as the other two
    const n0 = scene.children.length;
    scRunway(AIRPORTS[ldn.airportIdx]);
    // its painted marks are instanced, and an instanced mesh is culled by its geometry's sphere --
    // at the world's origin, so from every race venue they were "in view" (QUEUE: the other two's are too)
    const ap = AIRPORTS[ldn.airportIdx];
    for (const o of scene.children.slice(n0)) if (o.isInstancedMesh) { o.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, ap.elev, ap.cz), TUNE.runwayLength / 2 + 40); o.frustumCulled = true; }
    buildAirport(ldn.airportIdx, { noSpot: true, noPad: true, apronHome: true });
    // the generated city, if the generator has made one (city.js; scripts/city/)
    // (its anchor, "london", stands whether or not: the survey looks for it to know what is London's own)
    {
      const g = new THREE.Group();
      g.userData.art = "glass"; g.userData.trackSolids = true; g.userData.pending = [];
      const B = LD.cityBox, ax = (B.x0 + B.x1) / 2, az = (B.z0 + B.z1) / 2;
      const has = typeof CITY_DATA !== "undefined" && !!CITY_DATA.ldn;
      if (has) cityRegister("ldn", g, ax, az);
      addRouteLandmark(g, ax, az, "london");
      if (has) ldCityLoadWhenAlone();
    }
    // (v198) its streets, now that every landmark a street must clear stands
    ldStreets();
    // (v199) the river: Tower Bridge's gates and upright leaves (on its street), the tall ship, the boats
    ldTbBuild(); ldTallShip(); ldRiverBoats();
    solidRegionClose(ldn.region);
  });
  ldn.added = scene.children.slice(before);   // everything London stood in the scene (its checks ask)
  ldn.built = true;
}

// London's city loads on London's stream (city.js cityLoad's `rand`), and that stream stands in
// for Math.random through the whole parse -- so it starts only once nothing else is loading: the
// other two cities and the art atlas settled. Polled on a timer, not a frame: nothing about the
// game is timed by it, and the harness waits for every city before it runs one.
function ldCityLoadWhenAlone() {
  const others = () => Object.keys(cities).every(k => k === "ldn" || cities[k].ready || cities[k].failed);
  if (others() && (art.ready || art.failed)) { cityLoad(cities.ldn, ldRand); return; }
  setTimeout(ldCityLoadWhenAlone, 50);
}

// Where nothing streamed may stand: on a landmark's ground (trees) or anywhere in the city (towns)
function ldCovers(x, z, m) {
  if (z < LD.cityBox.z0 - 400 || z > LD.cityBox.z1 + 400) return false;
  for (const k in ldn.landmarks) {
    const L = ldn.landmarks[k];
    if (!L.box) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      forEachSolid(b => { if (b.ld === k) { x0 = Math.min(x0, b.x - b.hw); x1 = Math.max(x1, b.x + b.hw); z0 = Math.min(z0, b.z - b.hd); z1 = Math.max(z1, b.z + b.hd); } }, L.x, L.z, 400);
      L.box = x0 < x1 ? [x0, z0, x1, z1] : [L.x, L.z, L.x, L.z];
    }
    const b = L.box;
    if (k === "phoneBoxes") continue;
    if (x > b[0] - m - 12 && x < b[2] + m + 12 && z > b[1] - m - 12 && z < b[3] + m + 12) return true;
  }
  const [mx, mz0, mz1] = LD.at.mall;
  return Math.abs(x - mx) < 22 + m && z > mz0 - m && z < mz1 + m;
}
function ldInCity(x, z) { return ldCityW(x, z) > 0.5 && z > LD.cityBox.z0; }

// ===========================================================================================
// DRIVING LONDON (v198). The street graph is New York's (streets.js), read off the generated
// layout; London adds what it has that they have not:
//   - TRAFFIC KEEPS LEFT (the parent, 2026-10-26), and so does he: a London road's lane is
//     LEFT of its middle (a negative `lo`), and everything that asks a lane -- his lane-keep,
//     the corner's path, the traffic, a reassembly -- asks `lo`. The turn rule and every assist
//     are New York's, unchanged.
//   - THE TWO BRIDGES ARE STREETS: each stands on a street's own line and carries it over the
//     river, junction to junction, up on to the deck and down again. They are his: the traffic
//     stays in the grid, as it stays off every link.
//   - THE WAY IN IS FROM THE AIRPORT, round the runway's far end (no road crosses a runway).
//     It is London's `goal`: hands-off, the loop goes back to it, as New York's goes out on to
//     the motorway. At the apron it ends, and lane-keep turns him round.
//   - THE RIVER'S EDGE HOLDS HIM LIKE A RAIL: off the road he can never drive into the Thames.
//   - London has no motorway, so off every road the pull is to London's nearest road, never
//     back across the sea (car.js asks ldNear).
// Built on London's own stream, after its landmarks (whose solids a street must clear).
// ===========================================================================================
const LDD = LD.drive;
function ldStreets() {
  if (typeof stBuildGrid !== "function" || !streets.built || streets.cities.ldn || typeof CITY_DATA === "undefined" || !CITY_DATA.ldn) return;
  const city = stBuildGrid("ldn");
  for (const r of city.roads) r.lo = -Math.abs(r.lo);
  city.left = true;
  city.noSignals = true;      // no traffic lights in this release: nothing queues, nothing is run, no chase across London
  city.kerbStep = LDD.kerbStep;   // its ground is flat: the kerbs in longer runs (three times New York's blocks)
  ldn.city = city;
  const g = new THREE.Group();
  const tarmac = artPaint(mattMat(TUNE.runwaySurfaceColor), "road");
  const skirt = artPaint(mattMat(LDC.concrete), "concrete");
  const sk = [];
  ldPave(city, g);
  for (const k in LDD.bridges) ldn.roads[k] = ldBridgeRoad(city, g, tarmac, sk, k);
  ldn.roads.airport = ldAirportRoad(city, g, tarmac, sk);
  if (sk.length) g.add(new THREE.Mesh(ldSkirtGeo(sk), skirt));
  stBuildPolicy(city);
  stBuildPaint(city, g);
  streets.g.add(g);
  streets.paths = null;
  hwyIndexAdd(ldn.corridor);
  if (typeof car !== "undefined") car.rejoinPts = null;
}

// THE PAVING UNDER THE STREETS AT THE EDGES. The generator paves what lies in its blocks, half a
// street from each side; where one side is the river, a park or the city's edge -- a block with
// nothing built on it, or no block at all -- that half (and the corner of the junction) was never
// laid, and a bus drove on the grass. So those streets get a sheet of tarmac their whole width, a
// few centimetres UNDER the city's own: where that exists it covers this, and this shows only
// where it does not. One mesh, one draw; only the streets that need it, for the triangles.
function ldPave(city, g) {
  const pos = [], uv = [], idx = [], P = LDD.pave, D = city.data;
  const built = D.blocks.map(b => D.buildings.some(q => q[1] > b[0] && q[1] < b[2] && q[2] > b[1] && q[2] < b[3]));
  const near = (u, v) => Math.abs(u - v) < 0.5;
  // is the block on this side of the street there, with something on it?
  const side = (r, sgn) => {
    const a = r.pts[0], b = r.pts[r.pts.length - 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const ew = near(a.z, b.z);
    return D.blocks.some((k, i) => built[i] && (ew ? near(sgn > 0 ? k[1] : k[3], a.z) && mx > k[0] && mx < k[2]
                                                   : near(sgn > 0 ? k[0] : k[2], a.x) && mz > k[1] && mz < k[3]));
  };
  ldn.paved = 0;
  for (const r of city.roads) {
    if (r.kind !== "grid" || (side(r, 1) && side(r, -1))) continue;
    ldn.paved++;
    const a = r.pts[0], b = r.pts[r.pts.length - 1], L = r.len, fx = (b.x - a.x) / L, fz = (b.z - a.z) / L;
    const w = r.halfW + P.over, n = Math.max(1, Math.ceil(L / P.step)), cols = P.cols;
    const o0 = pos.length / 3;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= cols; j++) {
      const u = -w + 2 * w * j / cols, x = a.x + fx * L * i / n - fz * u, z = a.z + fz * L * i / n + fx * u;
      pos.push(x, terrainMeshY(x, z) + CITY.groundLift - P.under, z);
      uv.push(u / 17.5, L * i / n / 12);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < cols; j++) {
      const q = o0 + i * (cols + 1) + j;
      idx.push(q, q + cols + 1, q + 1, q + 1, q + cols + 1, q + cols + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = artPaint(mattMat(TUNE.runwaySurfaceColor), "road");
  mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 2;
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  g.add(m);
  ldn.pave = m;
}

// A link's height off the ground at each end: the street's own, draped (stRoadY).
function ldStreetY(x, z) { return terrainMeshY(x, z) + CITY.groundLift; }

// A bridge: from the junction on one bank, up on to the deck, across, and down to the
// junction on the other. On the deck the bridge's own carriageway is the road surface; on
// the land each side, a strip of tarmac with a skirt down to the ground.
function ldBridgeRoad(city, g, tarmac, sk, key) {
  const [x0, x1, z] = LDD.bridges[key], deck = ldn.decks[key];
  const a = city.nodeMap.get(stKey(x0, z)), b = city.nodeMap.get(stKey(x1, z));
  if (!a || !b || !deck) return null;
  const top = ldDeckY() + 0.3, ya = ldStreetY(x0, z), yb = ldStreetY(x1, z);
  const n = Math.ceil((x1 - x0) / LDD.step), pts = [];
  for (let k = 0; k <= n; k++) {
    const x = lerp(x0, x1, k / n);
    // Off the junction it climbs straight to the deck's height and stays there across the bank:
    // the city's lawns are draped only at their corners, and one spanning the bank's slope stands
    // well over the ground between them -- but never over its highest corner, which is under the deck
    const out = Math.min(x - x0, x1 - x);
    const y = lerp(x - x0 < x1 - x ? ya : yb, top, smoothstep(LDD.kerbFrom - LDD.rise / 2, LDD.kerbFrom + LDD.rise / 2, out));
    pts.push({ x, z, y });
  }
  stDirs(pts);
  for (const part of [pts.filter(p => p.x <= deck[0] + LDD.step), pts.filter(p => p.x >= deck[1] - LDD.step)]) {
    if (part.length < 2) continue;
    stStrip(part.map(p => ({ ...p, y: p.y + 0.04 })), part.map(() => LDD.bridgeHalfW), tarmac, g);
    sk.push(part);
  }
  ldn.corridor.push(...pts);
  const r = stRoad({ city: "ldn", kind: "link", pts, halfW: LDD.bridgeHalfW, lo: -ST.laneNarrow, drape: false, railed: true });
  r.bridge = key;
  stAttach(a, r, true); stAttach(b, r, false);
  city.links.push(r);
  return r;
}

// The way in from the airport: north from the apron's end, round the runway's far end, west
// into the grid's corner. Its apron end is a dead end, with a turnaround.
function ldAirportRoad(city, g, tarmac, sk) {
  const A = LDD.airport, [tx, tz] = A.to, node = city.nodeMap.get(stKey(tx, tz));
  if (!node) return null;
  const pts = [];
  const zArc = tz - A.r, cx = A.x - A.r;
  for (let z = A.z0; z < zArc; z += LDD.step) pts.push({ x: A.x, z });
  const na = Math.ceil(A.r * Math.PI / 2 / LDD.step);
  for (let k = 0; k <= na; k++) { const th = (k / na) * Math.PI / 2; pts.push({ x: cx + A.r * Math.cos(th), z: zArc + A.r * Math.sin(th) }); }
  const nx = Math.ceil((cx - tx) / LDD.step);
  for (let k = 1; k <= nx; k++) pts.push({ x: lerp(cx, tx, k / nx), z: tz });
  stDirs(pts);
  const L = pts[pts.length - 1].s, yEnd = ldStreetY(tx, tz);
  for (const p of pts) p.y = lerp(Math.max(terrainEff(p.x, p.z), TUNE.waterLevel) + ST.linkLift, yEnd, smoothstep(L - A.ease, L, p.s));
  stStrip(pts, pts.map(() => A.halfW), tarmac, g);
  sk.push(pts);
  ldn.corridor.push(...pts);
  const r = stRoad({ city: "ldn", kind: "link", pts, halfW: A.halfW, lo: -ST.laneNarrow, drape: false });
  r.goal = true;
  stAttach(stNodeAt(city, pts[0].x, pts[0].z), r, true);
  stAttach(node, r, false);
  city.links.push(r);
  return r;
}

// The skirt under a raised strip: its two edges down to the ground, one merged mesh.
function ldSkirtGeo(parts) {
  const pos = [], idx = [];
  for (const pts of parts) for (const side of [-1, 1]) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], w = side * LDD.bridgeHalfW;
      const x = p.x - p.fz * w, z = p.z + p.fx * w;
      const o = pos.length / 3;
      pos.push(x, p.y + 0.04, z, x, Math.min(p.y, Math.max(terrainEff(x, z), TUNE.waterLevel)) - 0.6, z);
      if (i > 0) idx.push(o - 2, o - 1, o, o - 1, o + 1, o);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Is this somewhere London answers for -- the far side of the crossing? (car.js: the
// pull back on to a road, a reassembly with nowhere else to go)
function ldNear(x, z) { return ldn.built && z > LD.coast.z - LD.coast.reach; }

// THE RIVER'S EDGE. A car off every road that would roll on to the water is held at the
// edge as a rail holds him: it slides along it, never a bang, never in. (On a bridge he
// is on a road and over the water by design.)
function ldEmbank(px, pz) {
  if (!ldNear(state.x, state.z)) return false;
  const wet = (x, z) => terrainEff(x, z) < seaLevelAt(x, z) + LDD.embank;
  if (!wet(state.x, state.z) || wet(px, pz)) return false;
  if (!wet(state.x, pz)) state.z = pz;                 // along the edge, x-wise
  else if (!wet(px, state.z)) state.x = px;            // ... or z-wise
  else { state.x = px; state.z = pz; }
  flags.ldEmbankHolds = (flags.ldEmbankHolds || 0) + 1;
  return true;
}

// A car started in London: on the way in from the airport, in its lane, bound for the city.
function ldCarStartAt() {
  const r = ldn.roads.airport;
  if (!r) return null;
  const q = {};
  stPointAt(r, LDD.startS, 1, r.lo, q);
  return { x: q.x, z: q.z, y: stRoadY(r, q.x, q.z, LDD.startS), heading: Math.atan2(-q.fx, -q.fz), road: r };
}

// ===========================================================================================
// THE THAMES (v199). Tower Bridge OPENS: for the tall ship going up to her berth above it (where a
// real one is moored) and back down, and for him, sailing up to it in the speedboat. The set-piece
// loop: giant obvious thing -- the bridge across the river; the wind-up -- bells, the red lamps
// flashing, the gates coming down; the payoff -- the leaves rising, the ship sliding through with
// her horn; the free reset -- the leaves down behind her, the gates up.
//   - NEVER TRAPPED. It does not begin while his car is between the gates, or so close to one that
//     he could not stop; and while it is not down, the gate holds him -- a speed-only hold, like the
//     corner assist (`ldGateCap`, asked by streets.js): a held finger stops at the gate and goes on
//     when it lifts. There is no queue on the bridge to drive into: the traffic stays in the grid.
//   - A RAISED LEAF IS STILL A WALL: its flat solid goes and an upright one stands at its hinge, for
//     the aeroplanes and the helicopter. The ship waits below the bridge until it is up.
//   - The boats on the river are machines and scenery: not solid, as the ships at sea are; they ease
//     off when his boat is ahead of them, and pass under both bridges.
// ===========================================================================================
const LDR = LD.river;
const ldRv = { x: 0, hw: 0, fx: 0, fz: 1 };
// The river's middle at z, its half-width and its way upstream: between the mouth and Westminster
// the Thames runs up z (its points are listed from upstream down).
function ldRiverMid(z, out) {
  const P = LD.thames.pts;
  out = out || ldRv;
  for (let i = P.length - 1; i > 0; i--) {
    const a = P[i], b = P[i - 1];
    if (z < a[1] || z > b[1]) continue;
    const t = (z - a[1]) / (b[1] - a[1] || 1), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    out.x = a[0] + dx * t; out.hw = a[2] + (b[2] - a[2]) * t; out.fx = dx / l; out.fz = dz / l;
    return out;
  }
  const e = P[P.length - 1]; out.x = e[0]; out.hw = e[2]; out.fx = 0; out.fz = 1;
  return out;
}

// ---- Tower Bridge: its gates, its upright leaves, its state ---------------------------------
// Built by ldTowerBridge's caller, on London's stream, inside its solids' region.
function ldTbBuild() {
  const [x, z] = LD.at.towerBridge, deck = ldDeckY(), half = ldn.tbHalf;
  const T = ldn.tb = { state: "down", t: 0, open: 0, gate: 0, x, z, half, lamps: [], arms: [], up: [], asks: "" };
  // the leaves standing up: a wall at each hinge, there only while they are (isSolidHidden: its
  // stand-in mesh is invisible while they are down)
  for (const L of ldn.tbLeaves) {
    const stand = new THREE.Object3D();
    stand.visible = false;
    const hx = x + L.sx * half;
    const sb = addSolidBox(hx - L.sx * 4.5, deck - 2, z, 4.5, 9, deck + half, stand, "bridge");
    sb.ld = "towerBridge"; sb.liftWall = true;     // (a wall across the road only while the road is up)
    T.up.push(stand);
  }
  // the gates: out past each shore tower, an arm across each carriageway and a post of red lamps
  const shore = ldn.decks.towerBridge, r = ldn.roads.towerBridge;
  if (!r) return;
  T.gateX = [shore[0] - LDR.gateOut, shore[1] + LDR.gateOut];
  T.gateS = T.gateX.map(gx => gx - r.pts[0].x);
  T.gapS = [x - half - r.pts[0].x, x + half - r.pts[0].x];
  const armMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  ldn.tbLampOn = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  ldn.tbLampOff = new THREE.MeshBasicMaterial({ color: 0x5a1b16 });
  const W = LDD.bridgeHalfW;
  for (const gx of T.gateX) {
    const gy = stRoadY(r, gx, z, gx - r.pts[0].x);
    for (const sz of [-1, 1]) {
      // the arm: red and white bands, pivoting at the kerb, standing up when the bridge is down
      const B = { name: "tbGate", x: 0, y: 0, z: 0, parts: {}, solids: [], tris: 0 };
      for (let k = 0; k < 6; k++) ldBox(B, 0.35, 0.35, (W - 0.6) / 6, k % 2 ? LC.white : LC.red, "plain", 0, -0.175, -sz * (k + 0.5) * (W - 0.6) / 6);
      const P = B.parts.plain, geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
      const arm = new THREE.Mesh(geo, armMat);
      arm.userData.noSolid = true; arm.userData.noShatter = true;
      const piv = new THREE.Group();
      piv.position.set(gx, gy + 1.1, z + sz * (W + 0.2));
      piv.add(arm);
      piv.userData.sz = sz;
      scene.add(piv);
      T.arms.push(piv);
      // its post and two lamps
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 0.4), ldMat("plain"));
      post.position.set(gx, gy + 1.3, z + sz * (W + 0.7));
      post.userData.noSolid = true;
      scene.add(post);
      for (const k of [0, 1]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), ldn.tbLampOff);
        lamp.position.set(gx + (k ? 0.35 : -0.35), gy + 2.35, z + sz * (W + 0.7));
        lamp.userData.noSolid = true;
        scene.add(lamp);
        T.lamps.push({ m: lamp, k, post });
      }
    }
  }
}

// Is the bridge shut to the road? (anything but down: the gates are coming down, down, or going up)
function ldTbShut() { return !!ldn.tb && ldn.tb.state !== "down"; }

// How far, along his way, to where the gate stops him -- from his road on the bridge, or from the
// street before it with the bridge as his plan -- or null if the bridge is not on his way.
function ldGateDist(road, dir, s, toGo, turn) {
  const T = ldn.tb, r = ldn.roads.towerBridge;
  if (!T || !r || !T.gateS) return null;
  const k = LDR.stopShort;
  if (road === r) {
    const stop = dir > 0 ? T.gateS[0] - k : T.gateS[1] + k, d = (stop - s) * dir;
    if (d >= -1) return d;
    // already past it (he cannot be: it does not begin with him there): stop short of the gap
    const gap = dir > 0 ? T.gapS[0] - k : T.gapS[1] + k, g = (gap - s) * dir;
    return g >= -1 ? g : null;
  }
  if (turn && turn.arm && turn.arm.road === r) return toGo + (stArmDir(turn.arm) > 0 ? T.gateS[0] - k : r.len - T.gateS[1] - k);
  return null;
}
// THE GATE HOLDS HIM (streets.js asks, on a London street): speed-only, to a stop at the gate, while
// the bridge is shut. It decides nothing -- not his turn, not his road -- and lets go when it opens.
function ldGateCap(road, dir, s, toGo, turn) {
  if (!ldTbShut()) return Infinity;
  const d = ldGateDist(road, dir, s, toGo, turn);
  if (d === null) return Infinity;
  return Math.sqrt(2 * LDR.carBrake * Math.max(0, d));
}
// May it begin? Not with his car between the gates, nor coming at a gate too fast to stop for it.
function ldTbCarClear() {
  if (typeof carActive !== "function" || !carActive() || state.exploding) return true;
  const r = ldn.roads.towerBridge, T = ldn.tb;
  if (!r || !T.gateS || typeof stPlan === "undefined") return true;
  const p = stProject(r, state.x, state.z);
  const m = LDR.betweenMargin;
  if (p.d < r.halfW + m && p.s > T.gateS[0] - LDR.stopShort - m && p.s < T.gateS[1] + LDR.stopShort + m) return false;
  const road = stPlan.road;
  if (!road) return true;
  const q = stProject(road, state.x, state.z), toGo = stPlan.dir > 0 ? road.len - q.s : q.s;
  const d = ldGateDist(road, stPlan.dir, q.s, toGo, stPlan.turn);
  if (d === null) return true;
  return d > state.speed * state.speed / (2 * LDR.carBrake) + LDR.clearMargin;
}

// Who is asking for it: the ship on her way through, or his boat coming up to it.
function ldTbAsks() {
  const T = ldn.tb, S = ldn.tship, why = [];
  if (S && (S.state === "in" || S.state === "out")) {
    const bow = S.z + S.dir * LDR.ship.len / 2, stern = S.z - S.dir * LDR.ship.len / 2;
    const toBridge = (T.z - bow) * S.dir, pastStern = (stern - T.z) * S.dir;
    if (toBridge < LDR.ship.ask && pastStern < LDR.ship.clearPast) why.push("ship");
  }
  if (typeof boatActive === "function" && boatActive() && !state.exploding && boatOnWater()) {
    const R = ldRiverAt(state.x, state.z), dz = state.z - T.z;
    const coming = Math.sign(-Math.cos(state.heading)) === -Math.sign(dz) && state.speed > 1;
    // (far enough out that it is up before he arrives at the speed he is going: bells, gates, the lift)
    const reach = Math.max(LDR.boatTrigger, state.speed * (LDR.open.warn + LDR.open.rise + LDR.boatLead));
    // (sitting still beside it, after a while he no longer asks: it never stays up for good, with a car at the gate)
    T.boatIdle = state.speed < 1 ? (T.boatIdle || 0) + (ldn.dt || 0) : 0;
    if (R.d < R.hw && Math.abs(dz) < reach && (coming || Math.abs(dz) < LDR.boatClear) && T.boatIdle < LDR.boatLinger) why.push("boat");
  }
  T.asks = why.join("+");
  return why.length > 0;
}

function ldTbUpdate(dt) {
  const T = ldn.tb;
  if (!T) return;
  ldn.dt = dt;
  const O = LDR.open, want = ldTbAsks();
  const was = T.state;
  if (T.state === "down") {
    if (want && ldTbCarClear()) { T.state = "warn"; T.t = O.warn; ldTbBells(); flags.tbOpens = (flags.tbOpens || 0) + 1; }
  } else if (T.state === "warn") {
    T.gate = Math.min(1, T.gate + dt / O.warn);
    T.t -= dt;
    if (!want) T.state = "settle", T.t = 0;
    else if (T.t <= 0) { T.state = "rise"; ldTbHydraulics(); }
  } else if (T.state === "rise") {
    T.open = Math.min(1, T.open + dt / O.rise);
    if (T.open >= 1) { T.state = "up"; flags.tbUp = (flags.tbUp || 0) + 1; }
  } else if (T.state === "up") {
    if (!want) { T.state = "fall"; ldTbHydraulics(); }
  } else if (T.state === "fall") {
    if (want) T.state = "rise";
    T.open = Math.max(0, T.open - dt / O.fall);
    if (T.open <= 0) { T.state = "settle"; T.t = O.settle; thunk(); noiseBurst(0.4, 130, 0.14, 0); }
  } else if (T.state === "settle") {
    T.gate = Math.max(0, T.gate - dt / O.settle);
    T.t -= dt;
    if (T.t <= 0 && T.gate <= 0) T.state = "down";
  }
  // the leaves, and what is solid of them
  const a = T.open * O.angle;
  for (let i = 0; i < ldn.tbLeaves.length; i++) {
    const L = ldn.tbLeaves[i];
    L.g.rotation.z = -L.sx * a;
    // one or the other, never neither: flat while it is low, upright from `wallAt` up (a half-raised
    // leaf is a wall to the aeroplanes, on one side of the line or the other)
    L.g.children[0].userData.noSolid = T.open >= O.wallAt;
    if (T.up[i]) T.up[i].visible = T.open >= O.wallAt;
  }
  // the gates: arms from upright (bridge down) to across the road; the lamps flash while shut
  for (const piv of T.arms) piv.rotation.x = piv.userData.sz * (1 - T.gate) * Math.PI / 2;
  const flash = T.state !== "down" && Math.sin(ldn.clock * 8) > 0;
  for (const L of T.lamps) L.m.material = T.state !== "down" && flash === (L.k === 0) ? ldn.tbLampOn : ldn.tbLampOff;
  if (was !== T.state) flags.tbState = T.state;
}
function ldTbBells() {
  if (Math.hypot(state.x - ldn.tb.x, state.z - ldn.tb.z) > LD.bigBen.hear) return;
  for (let i = 0; i < 8; i++) synthBlip("triangle", 900, 680, 0.16, 0.05, i * 0.34);
  for (let i = 0; i < 8; i++) synthBlip("triangle", 1200, 920, 0.13, 0.03, 0.09 + i * 0.34);
}
function ldTbHydraulics() {
  if (Math.hypot(state.x - ldn.tb.x, state.z - ldn.tb.z) > LD.bigBen.hear) return;
  noiseBurst(1.8, 300, 0.09, 0);
  synthBlip("sawtooth", 44, 62, 2.2, 0.06, 0.05);
}

// ---- the tall ship ---------------------------------------------------------------------------
// Three masts and white sails: far too tall for the bridge closed, which is the whole point. Up the
// river to her berth above Tower Bridge, a while there, and back down; then away, and again.
function ldTallShipMesh() {
  const B = { name: "tallShip", x: 0, y: 0, z: 0, parts: {}, solids: [], tris: 0 };
  const L = LDR.ship.len, W = LDR.ship.beam;
  ldBox(B, W, 9, L, LC.night, "plain", 0, -3, 0);                              // the hull, her bow at +z: high-sided
  ldBox(B, W + 0.2, 1.4, L + 0.2, LC.white, "plain", 0, 3.4, 0);               // the white band
  ldBox(B, W + 0.3, 1.2, L + 0.3, LC.red, "plain", 0, -3.4, 0);                // the red at the waterline
  ldAdd(B, new THREE.CylinderGeometry(0.2, W / 2, 12, 4, 1), LC.night, "plain", 0, 0.5, L / 2 + 5.5, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.7);
  ldBox(B, W - 1, 0.4, L - 2, 0x9a7b4f, "plain", 0, 6, 0);                     // her deck
  ldBox(B, 9, 3, 13, 0x9a7b4f, "plain", 0, 6.4, -L / 2 + 10);                  // the deckhouse aft
  ldCyl(B, 0.35, 0.45, 26, 6, 0x7a5a36, "plain", 0, 6, L / 2 + 1, Math.PI / 2 - 0.35);  // the bowsprit
  // (her masts clear the high walkways -- 43 m over the water -- with the leaves up: LDR.ship.mastMax)
  const hm = LDR.ship.mastMax - 6;
  for (const [mz, h] of [[L * 0.28, hm - 4], [0, hm], [-L * 0.26, hm - 6]]) {
    ldCyl(B, 0.5, 0.8, h, 8, 0x7a5a36, "plain", 0, 6, mz);
    for (let k = 0; k < 4; k++) {
      const y = 12 + k * (h - 12) / 4.2, w = 24 - k * 4;
      ldBox(B, w, 0.45, 0.45, 0x7a5a36, "plain", 0, y + 7.6, mz);                // the yard
      ldBox(B, w - 1.4, 7.2, 0.4, 0xf5f2e8, "plain", 0, y + 0.4, mz + 0.5);      // the sail under it
    }
    ldBox(B, 2.4, 1.4, 0.15, LC.red, "plain", 0, 6 + h, mz);                      // a pennant
  }
  const g = new THREE.Group();
  for (const kind of Object.keys(B.parts)) {
    const P = B.parts[kind], geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ldMat(kind)); m.castShadow = true;
    m.userData.noShatter = true;
    g.add(m);
  }
  g.userData.noShatter = true;
  return g;
}
const ldShipLine = { x: 0, hw: 0, fx: 0, fz: 1 };
// her own clock and nothing else: game time, never the wall clock, never the page's random stream
// SHE IS SOLID, in the one registry, as the harbour's ferry is: two boxes that turn and move with her --
// her hull, and her masts and sails over it -- so the one law meets her (a bang over a vehicle's crawl,
// a shove under it) and boatReassemble clears him of her.
function ldTallShip() {
  const g = ldTallShipMesh(), H = LDR.ship;
  scene.add(g);
  // boxes over the water [from, to, half-width, half-length]: her hull, then her rigging in two, the
  // lower as wide as her lowest yards and the upper as her topsails -- never air that is a wall
  const solids = H.solids.map(([y0, y1, hw, hl]) => {
    const b = solidBox3(0, TUNE.waterLevel + (y0 + y1) / 2, H.from, [1, 0, 0], [0, 1, 0], [0, 0, 1], hw, (y1 - y0) / 2, hl, "ship");
    b.mesh = g.children[0]; b.ld = "tallShip";
    return b;
  });
  ldn.tship = { g, z: H.from, dir: 1, state: "away", t: 4, v: 0, honked: false, solids };
  ldTallShipPose();
}
function ldTallShipPose() {
  const S = ldn.tship, R = ldRiverMid(S.z);
  S.x = R.x;
  S.g.position.set(R.x, TUNE.waterLevel, S.z);
  S.g.rotation.y = Math.atan2(R.fx * S.dir, R.fz * S.dir);
  if (S.solids) for (const b of S.solids) hbFerryPose(b, S.x, S.z, S.g.rotation.y);
}
function ldTallShipMove(dt) {
  const S = ldn.tship, H = LDR.ship, T = ldn.tb;
  if (!S) return;
  if (S.state === "away" || S.state === "moor") {
    S.t -= dt; S.v = 0;
    if (S.t <= 0) { S.state = S.state === "away" ? "in" : "out"; S.dir = S.state === "in" ? 1 : -1; S.honked = false; }
  } else {
    // she slows on her way to the bridge and waits below it until it is up; then on
    const bow = S.z + S.dir * H.len / 2, toBridge = (T.z - bow) * S.dir;
    let want = H.speed;
    // and she never sails into his boat: in her path ahead of her bow, she brakes in time to stop
    // `giveWay` short of him (and goes on when he moves out of her way)
    const mine = typeof boatActive === "function" && boatActive() && !state.exploding;
    if (mine) {
      const ahead = (state.z - bow) * S.dir;
      // (her line is the river's middle -- measured where HE is: the river bends between them)
      const line = ldRiverMid(state.z, ldShipLine);
      if (ahead > -2 && Math.abs(state.x - line.x) < H.beam / 2 + H.giveLane) want = Math.min(want, Math.sqrt(2 * H.decel * Math.max(0, ahead - H.giveWay)));
    }
    if (toBridge > 0 && T.open < 1) want = toBridge < H.holdAt ? 0 : Math.min(want, H.speed * clamp((toBridge - H.holdAt) / (H.slowAt - H.holdAt), 0.15, 1));
    // and in to her berth, and out to sea, slowly at the end
    const end = S.state === "in" ? H.berth : H.from, left = (end - S.z) * S.dir;
    want = Math.min(want, Math.max(H.creep, left * H.arrive));
    S.v += clamp(want - S.v, -H.decel * dt, H.accel * dt);
    S.z += S.dir * S.v * dt;
    if (!S.honked && toBridge < H.horn && toBridge > 0) { S.honked = true; if (Math.hypot(state.x - S.x, state.z - S.z) < LD.bigBen.hear) hbHorn(S.x, TUNE.waterLevel + 20, S.z, 120, 1.6); }
    if (left <= 0.5) { S.z = end; S.state = S.state === "in" ? "moor" : "away"; S.t = S.state === "moor" ? H.moor : H.away; if (S.state === "away") flags.tbShipRoundTrips = (flags.tbShipRoundTrips || 0) + 1; }
  }
  ldTallShipPose();
}

// ---- the boats on the river ------------------------------------------------------------------
function ldRiverBoatMesh(kind) {
  const B = { name: "riverBoat", x: 0, y: 0, z: 0, parts: {}, solids: [], tris: 0 };
  if (kind === "tour") {          // a long white river bus with a blue deckhouse and windows all along it
    ldBox(B, 6, 2.4, 26, LC.white, "plain", 0, -1.2, 0);
    ldBox(B, 6.2, 0.5, 26.2, 0x2b4fb0, "plain", 0, -1.4, 0);
    ldBox(B, 4.8, 2.2, 17, 0x2b4fb0, "plain", 0, 1.2, -1);
    ldBox(B, 4.9, 1.0, 16, 0x1b2430, "plain", 0, 1.9, -1);
    ldBox(B, 5.2, 0.3, 18, LC.white, "plain", 0, 3.4, -1);
  } else if (kind === "tug") {    // a red-and-black tug, its wheelhouse and funnel
    ldBox(B, 6, 2.6, 15, LC.red, "plain", 0, -1.3, 0);
    ldBox(B, 6.2, 0.8, 15.2, LC.ink, "plain", 0, -1.5, 0);
    ldBox(B, 4, 3, 5, LC.white, "plain", 0, 1.3, 2);
    ldBox(B, 4.1, 0.9, 5.1, 0x1b2430, "plain", 0, 3.1, 2);
    ldCyl(B, 0.8, 0.9, 2.6, 8, LC.ink, "plain", 0, 1.3, -2.5);
  } else {                        // a Thames sailing barge: a brown hull and a big red-brown sail
    ldBox(B, 5, 2.2, 20, 0x5b4a33, "plain", 0, -1.1, 0);
    ldCyl(B, 0.2, 0.25, 5.4, 6, 0x3a2f22, "plain", 0, 1.1, 1);
    ldBox(B, 0.2, 4.4, 9, 0xa04a2a, "plain", 0, 1.6, -3.5);
  }
  const g = new THREE.Group();
  for (const k of Object.keys(B.parts)) {
    const P = B.parts[k], geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(P.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ldMat(k)); m.castShadow = true;
    m.userData.noSolid = true; m.userData.noShatter = true;
    g.add(m);
  }
  g.userData.noSolid = true; g.userData.noShatter = true;
  return g;
}
function ldRiverBoats() {
  ldn.rboats = LDR.boats.map(([z, side, v, kind], i) => {
    const g = ldRiverBoatMesh(kind);
    scene.add(g);
    return { g, z, side, v, cur: v, dir: i % 2 ? -1 : 1 };
  });
}
function ldRiverBoatsMove(dt) {
  if (!ldn.rboats) return;
  const mine = typeof boatActive === "function" && boatActive() && !state.exploding;
  for (const b of ldn.rboats) {
    // easing off when his boat is ahead of it on its side of the river
    let want = b.v;
    if (mine) {
      const ahead = (state.z - b.z) * b.dir, R = ldRiverMid(b.z), bx = R.x + b.side * b.dir;
      if (ahead > 0 && ahead < LDR.boatYield && Math.abs(state.x - bx) < LDR.boatLane) want = 0;
    }
    b.cur += clamp(want - b.cur, -LDR.boatDecel * dt, LDR.boatAccel * dt);
    b.z += b.dir * b.cur * dt;
    if (b.z > LDR.boatSpan[1]) { b.z = LDR.boatSpan[1]; b.dir = -1; }
    if (b.z < LDR.boatSpan[0]) { b.z = LDR.boatSpan[0]; b.dir = 1; }
    const R = ldRiverMid(b.z), x = R.x + b.side * b.dir;   // keeping to its own side going each way, through the bridges' middle spans
    b.x = x;
    b.g.position.set(x, TUNE.waterLevel, b.z);
    b.g.rotation.y = Math.atan2(R.fx * b.dir, R.fz * b.dir);
  }
}

// His speedboat, started in London: on the river below Tower Bridge, its bow up the river.
function ldBoatStart() {
  const [x, z] = LDR.boatStart, R = ldRiverMid(z, {});
  return { x, z, heading: Math.atan2(-R.fx, -R.fz) };
}

// ===========================================================================================
// STARTING IN LONDON: the globe (input.js) asks this
// ===========================================================================================
// Which vehicles can start in London: the ones that fly from a runway, (v198) the cars and (v199)
// the speedboat -- on the Thames. (The yacht stays in California: its lock and garage are there.)
function ldCanStart(vp) {
  vp = vp || state.vp;
  return !!vp && !vp.rocket && !vp.monster && !vp.bigBoat && !vp.sledRide && !vp.crane && (!vp.car || !!ldn.roads.airport);
}
function ldStart() {
  spawnForTakeoff(ldn.airportIdx, 0);
  // Big Ben bongs soon after he arrives, then on its own clock
  if (ldn.bongAt - ldn.clock > LD.bigBen.first) ldn.bongAt = ldn.clock + LD.bigBen.first;
}

// The globe button and its screen: three cities and the way back. Up only where the vehicle
// picker could open (parked, still), for a vehicle that can start in London; its slot is the
// slow button's, which is up only in flight.
function ldGlobeShows() {
  if (!ldCanStart() || menuOpen() || state.exploding) return false;
  if (typeof raceOn === "function" && raceOn()) return false;
  if (typeof dadActive === "function" && dadActive()) return false;
  if (typeof eject !== "undefined" && eject.active) return false;
  return pickerCanOpen();
}
// Where the globe stands (buttons.js asks; the CSS class says so on the button itself)
// (portrait: under the view button, or in a car low on the right; landscape: the top row, as index.html draws it)
function ldGlobeSlot() { return innerHeight <= innerWidth ? "topRow" : state.vp && (state.vp.car || state.vp.boat) ? "highRight" : "topRight3"; }
function ldGlobeOpen() {
  if (!ldGlobeShows()) return;
  releaseThrottle();
  for (const c of document.querySelectorAll(".cityCard")) {
    const k = c.dataset.city, at = k === "ny" ? 0 : k === "ca" ? 1 : k === "ldn" ? ldn.airportIdx : -1;
    c.classList.toggle("sel", at === state.originIdx);
  }
  el.screenGlobe.classList.remove("hiddenS");
}
function ldGlobePick(city) {
  el.screenGlobe.classList.add("hiddenS");
  if (city === "back") return;
  try {
    if (city === "ldn") localStorage.setItem("lp.start", "ldn");
    else { localStorage.removeItem("lp.start"); localStorage.setItem("lp.dir", city === "ca" ? "1" : "0"); }
  } catch (err) {}
  if (city === "ldn") ldStart();
  else spawnForTakeoff(city === "ca" ? 1 : 0, city === "ca" ? 1 : 0);
  flags.globeStarts = (flags.globeStarts || 0) + 1;
}
function ldGlobeWire() {
  el.globeBtn = document.getElementById("globeBtn");
  el.screenGlobe = document.getElementById("screenGlobe");
  if (!el.globeBtn || !el.screenGlobe) return;
  el.globeBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.globeBtn); ldGlobeOpen(); });
  for (const c of document.querySelectorAll(".cityCard")) {
    c.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); ldGlobePick(c.dataset.city); });
  }
}

// Out over the sea in a plane, the way he is pointing says where he is going: toward Britain,
// London is the destination -- its rings, the strip and the go button are London's; back
// toward America, New York's. Only what the HUD points at changes; never the controls.
function ldHeading(dt) {
  if (vehKind() !== "plane" || state.phase !== "AIRBORNE" || state.exploding) return;
  if (state.z < LD.seaFrom || state.z > LD.coast.z) return;
  const c = Math.cos(state.heading);                 // -1: flying +z, toward London
  if (c < -LD.toward && state.destIdx !== ldn.airportIdx) { state.destIdx = ldn.airportIdx; state.dirIdx = 1; placeRings(); }
  else if (c > LD.toward && state.destIdx === ldn.airportIdx) { state.destIdx = 0; state.dirIdx = 0; placeRings(); }
}

function ldUpdate(dt) {
  if (!ldn.built) return;
  dt = dt || 0;
  ldn.clock += dt;
  ldBongUpdate(dt);
  ldHeading(dt);
  // the rest is only worth doing within sight of it
  const cz = camera.position.z;
  if (cz > LD.seaFrom - 2000) {
    ldShipsMove(dt);
    if (ldn.beam) { ldn.beamA = (ldn.beamA + LD.lighthouse.beam * dt) % (Math.PI * 2); ldn.beam.rotation.y = ldn.beamA; ldn.beamSpun = (ldn.beamSpun || 0) + LD.lighthouse.beam * dt; ldn.beamMat.opacity = lerp(0.04, 0.24, state.nightF || 0); }
    ldWhaleUpdate(dt);
  }
  if (cz > LD.cityBox.z0 - 2500) { ldEyeTurn(dt); ldClockHands(); }
  // the river runs whether he is near or not: the ship keeps her own timetable
  ldTallShipMove(dt); ldTbUpdate(dt);
  if (cz > LD.cityBox.z0 - 2500) ldRiverBoatsMove(dt);
  if (el.globeBtn) el.globeBtn.classList.toggle("inCar", ldGlobeSlot() === "highRight");
  ldCull(dt);
}
// Like cullLandmarks: what is past the fog is not drawn -- and, hidden, its solids are not
// asked either (isSolidHidden). The camera far plane alone would draw London from the sea.
let ldCullT = 0;
function ldCull(dt) {
  ldCullT -= dt;
  if (ldCullT > 0) return;
  ldCullT = LD.cullEvery;
  const max2 = TUNE.fogFar * TUNE.fogFar * 2.1, px = state.x, pz = state.z;
  const near = (x, z, r) => { const dx = x - px, dz = z - pz, d = Math.sqrt(dx * dx + dz * dz) - (r || 0); return d * d < max2 || d < 0; };
  for (const k in ldn.landmarks) { const L = ldn.landmarks[k]; L.g.visible = near(L.x, L.z, k === "phoneBoxes" ? 1600 : 150); }
  if (ldn.eye) { const v = near(ldn.eye.x, ldn.eye.z, 70); ldn.eye.W.visible = v; ldn.eye.caps.visible = v; }
  if (ldn.hands) ldn.hands.visible = ldn.landmarks.bigBen.g.visible;
  for (const s of ldn.ships) s.g.visible = near(s.x, s.z, 80);
  if (ldn.beam) ldn.beam.visible = near(ldn.beam.position.x, ldn.beam.position.z, 160);
  for (const t of ldn.tbLeaves) t.g.visible = ldn.landmarks.towerBridge.g.visible;
  if (ldn.tship) ldn.tship.g.visible = near(ldn.tship.x || 0, ldn.tship.z, 80);
  if (ldn.rboats) for (const b of ldn.rboats) b.g.visible = near(b.x || 0, b.z, 30);
  if (ldn.tb) { const v = ldn.landmarks.towerBridge.g.visible; for (const a of ldn.tb.arms) a.visible = v; for (const L of ldn.tb.lamps) { L.m.visible = v; L.post.visible = v; } }
}

ldBuild();
ldGlobeWire();
