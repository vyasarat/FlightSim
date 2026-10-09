"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE ROCKET SLED (v134).
//
// A straight rail on an embankment in the desert, west of the motorway, south
// of the mountain tunnel. A red rocket sled waits at its north end beside a
// start tower with three big lamps. Point at it from inside `armR` -- the car
// coming out of the tunnel, the plane, the helicopter -- and the lamps go red,
// amber, green under 3-2-1, and it blasts off down the rail at 120 m/s,
// smashes straight through a giant wall of toy bricks, pops three parachutes
// and stops before the end of the rail. Then it rolls home, and as it passes
// back through the gap every brick flies back into its place.
//
// The set-piece loop: the giant obvious thing (a rocket on a rail, a wall of
// bricks taller than a house), one aim (pointing at it), the wind-up (the
// lamps and the numerals, the roar spooling), the payoff (the run and the
// smash), and the free reset (the wall rebuilds itself, the sled comes home).
// Nothing to press, nothing to miss.
//
// RULES THIS FILE KEEPS
//   * Nothing living: the sled has no driver and no cockpit, and the wall is
//     toy bricks.
//   * It is something he POINTS at -- the wall, which both ways of driving
//     come at -- and he must be able to SEE it: inside the mountain tunnel
//     (hwyBoreCeiling) it never starts. In the car it arms by his SPEED
//     (carView + speed x sledToWall): the sled outruns him, so it goes when its
//     smash will land ~480 m ahead, inside his windscreen, at any speed step.
//   * No unannounced bang: the smash is the end of a run that a 3-2-1 began.
//   * Bricks fly WEST, away from the road (westBias); none of them, and no puff
//     of the sled's smoke, ever lands in the road's corridor -- the check
//     samples every one of them.
//   * Every brick comes back exactly into its slot. Nothing is lost. A brick
//     lying in the sand is a toy in the scenery, never solid -- like the
//     smoke, the sparks and the debris of every bang -- so nothing he flies
//     through there is a wall he could not see coming.
//   * Solid where it stands: the embankment, the start tower, the wall (until
//     it is smashed, and again once it is rebuilt) and the sled itself, whose
//     capsule follows it down the rail.
//   * It shares the one big numeral and never fights for it: it does not start
//     while any other countdown is showing, and stands down for a police
//     pull-over or the picker.
//   * Its own random stream, its own puff pool, the bricks one instanced draw.
//   * v144: he can RIDE it (sledride.js, the sled card). While he does, it is
//     the same set-piece run for him: his go starts it instead of his pointing
//     (`sled.ridden`), its own sled is not drawn (his vehicle is a copy of it),
//     and it steps nobody aside. The wall stands west of the rail (wallShift),
//     so its target is not where his nose hits: while he rides, the two rings
//     stand on the rail's line instead, on what he is about to smash. Getting
//     on and getting off are both a fresh sledReset with the rings put where
//     they belong (sledSetRidden), so with nobody riding it is exactly the
//     set-piece it was.
// ---------------------------------------------------------------------------
const SLED = TUNE.rocketSled;

const SLED_SEED = 0x5ED;
let sledSeed = SLED_SEED;
function sledRnd() { sledSeed = (sledSeed * 1664525 + 1013904223) >>> 0; return sledSeed / 4294967296; }

const sled = {
  g: null, sledG: null, body: null, flame: null, chutes: [], lamps: [],
  brickMesh: null, bricks: [], wall: null, wallSolid: null, solid: null,
  puffMesh: null, puffs: [], puffCursor: 0,
  phase: "armed",                 // armed | count | run | chute | rest | home
  t: 0, d: 0, v: 0, len: 0, dirX: 0, dirZ: -1, x: 0, y: 0, z: 0,
  smashed: false, chuteOut: false, rebuilding: false, rebuildT: 0,
  trailT: 0, clatter: 0, flashT: 0, clock: 0,
};

const sledPaintCache = {};
function sledPaint(color) {
  if (!sledPaintCache[color]) {
    const c = new THREE.Color(color);
    sledPaintCache[color] = new THREE.MeshLambertMaterial({ color, emissive: c.multiplyScalar(SLED.selfLight) });
  }
  return sledPaintCache[color];
}

// where along the rail -> world
function sledAt(d) {
  const T = SLED;
  return { x: T.n[0] + sled.dirX * d, z: T.n[1] + sled.dirZ * d };
}
function sledWallWorld() {
  const T = SLED, p = sledAt(T.wallAt);
  // the wall's centre stands west of the rail (`across` is +west)
  const sh = T.wallShift * T.brick[0];
  return { x: p.x + sled.dirZ * sh, y: T.railY, z: p.z - sled.dirX * sh, rx: p.x, rz: p.z,
           halfW: (T.wallCols + 0.5) * T.brick[0] / 2, top: T.railY + T.wallRows * T.brick[1] };
}

function sledBuildVehicle() {
  const P = TUNE.palette;
  const s = new THREE.Group();
  const k = lsKit();
  const S = SLED.size;   // the sled is drawn in metres of a 12 m sled, then scaled
  // slipper shoes on the two rails
  for (const x of [-1.2, 1.2]) for (const z of [-3.5, 3.5]) k.add(P.slate, new THREE.BoxGeometry(0.6 * S, 0.7 * S, 1.6 * S), x * S, 0.35 * S, z * S);
  k.add(P.red, new THREE.BoxGeometry(3 * S, 2.2 * S, 10 * S), 0, 1.9 * S, 0);
  k.add(P.white, new THREE.ConeGeometry(1.55 * S, 5 * S, 14), 0, 1.9 * S, 7.5 * S, Math.PI / 2, 0, 0);
  k.add(P.warning, new THREE.BoxGeometry(0.3 * S, 2.6 * S, 2.6 * S), -1.1 * S, 4.0 * S, -3.6 * S);
  k.add(P.warning, new THREE.BoxGeometry(0.3 * S, 2.6 * S, 2.6 * S), 1.1 * S, 4.0 * S, -3.6 * S);
  k.add(P.warning, new THREE.BoxGeometry(3.1 * S, 0.5 * S, 1.2 * S), 0, 2.2 * S, 3.2 * S);   // a stripe across the body
  for (const [x, y] of [[-0.9, 1.4], [0.9, 1.4], [0, 2.6]]) k.add(P.slate, lsCyl(0.55 * S, 0.9 * S, 1.6 * S, 10), x * S, y * S, -5.6 * S, -Math.PI / 2, 0, 0);
  const meshes = k.build(s, sledPaint);
  sled.body = meshes.find(m => m.material === sledPaint(P.red)) || meshes[0];
  sled.body.userData.noShatter = true;
  // the flame: three cones out of the back, and one glow
  const fl = new THREE.Group();
  const outer = lsKit(), inner = lsKit();
  for (const [x, y] of [[-0.9, 1.4], [0.9, 1.4], [0, 2.6]]) {
    outer.add(P.flame, new THREE.ConeGeometry(0.85 * S, 9 * S, 10), x * S, y * S, -6.4 * S - 4.5 * S, -Math.PI / 2, 0, 0);
    inner.add(0xfff4d6, new THREE.ConeGeometry(0.45 * S, 5 * S, 8), x * S, y * S, -6.4 * S - 2.5 * S, -Math.PI / 2, 0, 0);
  }
  const flat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92, depthWrite: false });
  outer.build(fl, flat); inner.build(fl, flat);
  const glow = glowSprite(P.flame, 26, 0.95);
  glow.position.set(0, 2 * S, -9 * S);
  fl.add(glow);
  fl.visible = false;
  s.add(fl);
  sled.flame = fl;
  // three parachutes: a canopy and its lines each, packed until the smash
  sled.chutes = [];
  const chuteCols = [P.red, P.white, P.warning];
  for (let i = 0; i < 3; i++) {
    const cg = new THREE.Group();
    // a wide, shallow dome -- an umbrella, not a ball -- with a white band round it
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), sledPaint(chuteCols[i]));
    canopy.scale.set(1, 0.55, 1);
    canopy.rotation.x = -Math.PI / 2;          // its open side faces the sled
    const band = new THREE.Mesh(new THREE.TorusGeometry(10, 0.7, 6, 24), sledPaint(i === 1 ? P.red : P.white));
    canopy.add(band);
    cg.add(canopy);
    const lk = lsKit();
    for (let j = 0; j < 4; j++) {
      const a = j / 4 * Math.PI * 2 + Math.PI / 4;
      const rx = Math.cos(a) * 9.6, ry = Math.sin(a) * 9.6, len = Math.hypot(rx, ry, 22);
      const o = new THREE.Object3D();
      o.position.set(rx / 2, ry / 2, 11);
      o.lookAt(0, 0, 22); o.rotateX(Math.PI / 2);
      lk.add(P.slate, new THREE.CylinderGeometry(0.22, 0.22, len, 4), o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z);
    }
    lk.build(cg);
    cg.visible = false;
    s.add(cg);
    sled.chutes.push(cg);
  }
  return s;
}

// A giant toy brick: a box with eight studs on top, one geometry for all.
function sledBrickGeo() {
  const [w, h, d] = SLED.brick;
  const parts = [{ geo: new THREE.BoxGeometry(w, h, d), obj: new THREE.Object3D() }];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const o = new THREE.Object3D();
    o.position.set((i - 1.5) * w / 4, h / 2 + 0.3, (j - 0.5) * d / 2);
    parts.push({ geo: new THREE.CylinderGeometry(0.62, 0.62, 0.6, 10), obj: o });
  }
  return lsMerge(parts);
}

function sledFloor(x, z) {
  // on the embankment or the wall's base the floor is the rail's top; else the ground
  const T = SLED;
  const rx = x - T.n[0], rz = z - T.n[1];
  const along = rx * sled.dirX + rz * sled.dirZ, across = rx * sled.dirZ - rz * sled.dirX;
  const w = sledWallWorld();
  const onBank = along > -4 && along < sled.len + 4 && Math.abs(across) < T.bankW / 2;
  const onBase = Math.abs(along - T.wallAt) < T.brick[2] / 2 + 4 && Math.abs(across - T.wallShift * T.brick[0]) < w.halfW + 5;
  return (onBank || onBase) ? T.railY : terrainEff(x, z);
}

function sledBuild() {
  const P = TUNE.palette, T = SLED;
  const dx = T.s[0] - T.n[0], dz = T.s[1] - T.n[1];
  sled.len = Math.hypot(dx, dz);
  sled.dirX = dx / sled.len; sled.dirZ = dz / sled.len;
  const ax = sled.dirZ, az = -sled.dirX;            // across the rail
  const yaw = Math.atan2(sled.dirX, sled.dirZ);     // local +z down the rail
  const g = new THREE.Group();
  g.userData.name = "rocketSled";
  // the embankment: one long concrete box under the whole rail
  let lo = 1e9;
  for (let d = 0; d <= sled.len; d += 10) { const p = sledAt(d); lo = Math.min(lo, terrainEff(p.x, p.z)); }
  const bankH = T.railY - (lo - 2);
  const mid = sledAt(sled.len / 2);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(T.bankW, bankH, sled.len + 8), artLam(P.concrete, "concrete"));
  bank.position.set(mid.x, T.railY - bankH / 2, mid.z); bank.rotation.y = yaw;
  bank.userData.noShatter = true;
  g.add(bank);
  // the two rails, and a yellow stripe down the middle
  const rk = lsKit();
  for (const off of [-1.7, 1.7]) rk.add(P.steel, new THREE.BoxGeometry(0.5, 0.5, sled.len + 6), mid.x + ax * off, T.railY + 0.25, mid.z + az * off, 0, yaw, 0);
  rk.add(P.warning, new THREE.BoxGeometry(0.6, 0.06, sled.len), mid.x, T.railY + 0.03, mid.z, 0, yaw, 0);
  rk.build(g);
  // the wall's base: a concrete apron across the rail
  const w = sledWallWorld();
  const baseH = T.railY - (Math.min(terrainEff(w.x - ax * w.halfW, w.z - az * w.halfW), terrainEff(w.x + ax * w.halfW, w.z + az * w.halfW), terrainEff(w.x, w.z)) - 2);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w.halfW * 2 + 10, baseH, T.brick[2] + 8), artLam(P.concrete, "concrete"));
  base.position.set(w.x, T.railY - baseH / 2 - 0.02, w.z); base.rotation.y = yaw;
  base.userData.noShatter = true;
  g.add(base);
  // the start tower: a blockhouse west of the rail with three big lamps facing the road
  const n = sledAt(0);
  const tx = n.x + ax * 16, tz = n.z + az * 16;      // (ax, az) points west
  const tk = lsKit();
  tk.add(P.grey, new THREE.BoxGeometry(9, 6, 9), tx, terrainEff(tx, tz) + 3, tz);
  tk.add(P.slate, new THREE.BoxGeometry(1.4, 22, 1.4), tx, terrainEff(tx, tz) + 11, tz);
  tk.add(P.ink, new THREE.BoxGeometry(4.5, 19, 4.5), tx, terrainEff(tx, tz) + 20.5, tz);
  tk.build(g);
  sled.lamps = [];
  [P.red, P.flame, P.green].forEach((c, i) => {
    const y = terrainEff(tx, tz) + 26 - i * 6;
    const disc = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a2f38 }));
    disc.position.set(tx, y, tz);
    g.add(disc);
    const glow = glowSprite(c, 30, 0);
    glow.position.set(tx, y, tz);
    g.add(glow);
    sled.lamps.push({ disc, glow, color: c });
  });
  castsAndReceives(g);
  scene.add(g);
  sled.g = g;

  // ---- solids, marked as ours (`sled`)
  const sb = solidBox3(mid.x, T.railY - bankH / 2, mid.z, [ax, 0, az], [0, 1, 0], [sled.dirX, 0, sled.dirZ], T.bankW / 2, bankH / 2, sled.len / 2 + 4, "wall");
  sb.mesh = bank; sb.sled = true;
  const bb = solidBox3(w.x, T.railY - baseH / 2, w.z, [ax, 0, az], [0, 1, 0], [sled.dirX, 0, sled.dirZ], w.halfW + 5, baseH / 2, T.brick[2] / 2 + 4, "wall");
  bb.mesh = base; bb.sled = true;
  const tb = addSolidBox(tx, terrainEff(tx, tz) - 1, tz, 4.5, 4.5, terrainEff(tx, tz) + 31, bank, "building"); tb.sled = true;

  // ---- the bricks: one instanced draw, a colour each
  const cols = [P.red, 0x3b7bff, P.warning, P.green, P.white, P.fire];   // a toy blue, brighter than the palette's navy
  const N = T.wallCols * T.wallRows;
  // a little of their own light, so the toy colours stay toy-bright on the shaded side
  const bm = new THREE.InstancedMesh(sledBrickGeo(), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a3a3a }), N);
  bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bm.frustumCulled = false;
  bm.userData.noShatter = true;
  const qWall = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-az, ax));
  sled.bricks = [];
  for (let r = 0; r < T.wallRows; r++) for (let c = 0; c < T.wallCols; c++) {
    // `off` is across the rail from its centreline, +west
    const off = (c - (T.wallCols - 1) / 2 + (r % 2 ? 0.5 : 0) + T.wallShift) * T.brick[0];
    const slot = { x: w.rx + ax * off, y: T.railY + T.brick[1] * (r + 0.5), z: w.rz + az * off, q: qWall.clone() };
    const i = sled.bricks.length;
    bm.setColorAt(i, new THREE.Color(cols[(r * 3 + c * 5) % cols.length]));
    sled.bricks.push({ i, slot, off, row: r, x: slot.x, y: slot.y, z: slot.z, q: slot.q.clone(),
      vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, mode: "wall", t: 0, delay: 0, from: null });
  }
  castsAndReceives(bm);
  scene.add(bm);
  sled.brickMesh = bm;
  // the standing wall is one solid box; flying bricks are not walls
  const ws = solidBox3(w.x, T.railY + T.wallRows * T.brick[1] / 2, w.z, [ax, 0, az], [0, 1, 0], [sled.dirX, 0, sled.dirZ],
    w.halfW, T.wallRows * T.brick[1] / 2, T.brick[2] / 2, "wall");
  ws.mesh = bm; ws.sled = true;
  sled.wallSolid = ws;

  // ---- the sled, and its capsule
  const sv = sledBuildVehicle();
  sv.rotation.y = yaw;
  castsAndReceives(sv);
  scene.add(sv);
  sled.sledG = sv;
  const sc = solidCapsule([0, -1e4, 0], [0, -1e4, 0], 1, "pillar");
  sc.mesh = sled.body; sc.sled = true;
  sled.solid = sc;
  // the target: a pulsing red ring on both faces of the wall, as the demolition's
  sled.reticles = [];
  for (const side of [-1, 1]) {
    const ret = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(T.reticleR, 1.1, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
    ret.add(ring);
    for (const [rx, ry] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(rx ? 5 : 1.2, ry ? 5 : 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
      tick.position.set(rx * (T.reticleR + 2.6), ry * (T.reticleR + 2.6), 0);
      ret.add(tick);
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
    ret.add(dot);
    ret.position.set(w.x - sled.dirX * side * (T.brick[2] / 2 + 1.2), T.railY + T.wallRows * T.brick[1] * 0.55, w.z - sled.dirZ * side * (T.brick[2] / 2 + 1.2));
    ret.rotation.y = yaw;
    ret.userData.home = ret.position.clone();     // v144: where it stands for everyone but a rider
    scene.add(ret);
    sled.reticles.push(ret);
  }
  // the smash's flash
  const flash = glowSprite(0xfff4d6, 60, 0);
  flash.position.set(w.x, T.railY + 10, w.z);
  scene.add(flash);
  sled.flash = flash;

  // ---- its own smoke
  const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x6a6a6a, transparent: true, opacity: 0.88, depthWrite: false }), T.puffs);
  pm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pm.setColorAt(0, new THREE.Color(0xffffff));
  pm.count = 0;
  pm.frustumCulled = false;
  scene.add(pm);
  sled.puffMesh = pm;
  for (let i = 0; i < T.puffs; i++) sled.puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r0: 1, r1: 2, r: 0, c: 0xffffff });

  sledReset();
}

// ---- smoke ------------------------------------------------------------------
function sledPuff(x, y, z, vx, vy, vz, r0, r1, life, color) {
  let p = sled.puffs.find(q => q.life <= 0);
  if (!p) { p = sled.puffs[sled.puffCursor]; sled.puffCursor = (sled.puffCursor + 1) % sled.puffs.length; }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.r0 = r0; p.r1 = r1; p.r = r0; p.life = p.max = life; p.c = color || 0xffffff;
}
function sledUpdatePuffs(dt) {
  const pm = sled.puffMesh;
  let n = 0;
  const drag = Math.exp(-dt * 1.2);
  for (const p of sled.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.vx *= drag; p.vy *= drag; p.vz *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = 1 - p.life / p.max;
    p.r = lerp(p.r0, p.r1, Math.sqrt(k)) * (k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.85 : 1);
    lsTmpO.position.set(p.x, p.y, p.z); lsTmpO.scale.setScalar(p.r); lsTmpO.rotation.set(0, 0, 0); lsTmpO.updateMatrix();
    pm.setMatrixAt(n, lsTmpO.matrix);
    pm.setColorAt(n, lsTmpC.setHex(p.c));
    n++;
  }
  pm.count = n;
  if (n) { pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true; }
}
function sledPuffsLive() { return sled.puffs.filter(p => p.life > 0).map(p => ({ x: p.x, y: p.y, z: p.z, r: p.r })); }
function sledBricksLive() {
  const h = SLED.brick[0] / 2;
  return sled.bricks.filter(b => b.mode !== "wall").map(b => ({ x: b.x, y: b.y, z: b.z, r: h }));
}

// ---- bricks -----------------------------------------------------------------
const sledQ = new THREE.Quaternion(), sledAxis = new THREE.Vector3();
function sledWriteBricks() {
  const bm = sled.brickMesh;
  for (const b of sled.bricks) {
    lsTmpO.position.set(b.x, b.y, b.z);
    lsTmpO.quaternion.copy(b.q);
    lsTmpO.scale.set(1, 1, 1);
    lsTmpO.updateMatrix();
    bm.setMatrixAt(b.i, lsTmpO.matrix);
  }
  bm.instanceMatrix.needsUpdate = true;
  if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
}
function sledSlotError() {
  let e = 0;
  for (const b of sled.bricks) e = Math.max(e, Math.hypot(b.x - b.slot.x, b.y - b.slot.y, b.z - b.slot.z), b.q.angleTo(b.slot.q));
  return e;
}
function sledWallSolid() { return !!(sled.wallSolid && !isSolidHidden(sled.wallSolid)); }

function sledSmash() {
  const T = SLED;
  sled.smashed = true;
  for (const r of sled.reticles) r.visible = false;
  sled.brickMesh.userData.noSolid = true;      // it is in pieces: no longer a wall
  flags.sledSmashes = (flags.sledSmashes || 0) + 1;
  const w = sledWallWorld();
  for (const b of sled.bricks) {
    b.mode = "fly";
    // straight down the rail, harder the nearer the sled's path; up; and sideways,
    // which is mostly WEST (away from the road) and only ever a little east
    const centre = 1 - Math.min(1, Math.abs(b.off - T.wallShift * T.brick[0]) / w.halfW);
    const fwd = lerp(T.throwFwd[0], T.throwFwd[1], sledRnd() * 0.6 + centre * 0.4);
    const up = lerp(T.throwUp[0], T.throwUp[1], sledRnd());
    const side = T.throwSide * sledRnd() * (sledRnd() < T.westBias ? -1 : T.eastMax);
    b.vx = sled.dirX * fwd + side; b.vz = sled.dirZ * fwd; b.vy = up;
    b.wx = (sledRnd() - 0.5) * 8; b.wy = (sledRnd() - 0.5) * 8; b.wz = (sledRnd() - 0.5) * 8;
  }
  const hear = sledHear(w.x, w.y, w.z);
  if (hear > 0) { bigBoom(w.x, w.y + 8, w.z); clang(); }
  const dd = Math.hypot(state.x - w.x, state.z - w.z);
  shakeAmp = Math.max(shakeAmp, T.shake * clamp(1 - dd / T.shakeR, 0, 1));
  sled.flashT = 0.6;
  for (let i = 0; i < 16; i++) {
    const a = sledRnd() * Math.PI * 2;
    sledPuff(w.x + Math.cos(a) * w.halfW * sledRnd(), T.railY + sledRnd() * 12, w.z + Math.sin(a) * 4,
      -Math.abs(Math.cos(a)) * 6, 3 + sledRnd() * 4, sled.dirZ * 10, 4, 12, 2.4, 0xefe3cc);
  }
}

function sledUpdateBricks(dt) {
  const T = SLED;
  let moving = false, done = 0, total = 0;
  for (const b of sled.bricks) {
    // a brick lying on the rail is nudged off it, west, by the sled coming through
    if (b.mode === "rest" && Math.abs(sled.v) > 1) {
      const rx = b.x - sled.x, rz = b.z - sled.z;
      const along = rx * sled.dirX + rz * sled.dirZ, across = rx * sled.dirZ - rz * sled.dirX;
      if (Math.abs(along) < 14 && Math.abs(across) < T.bankW / 2 + 3) {
        b.mode = "fly"; b.vx = -8 - sledRnd() * 4; b.vy = 6 + sledRnd() * 3; b.vz = sled.dirZ * Math.sign(sled.v) * 4;
        b.wx = (sledRnd() - 0.5) * 6; b.wz = (sledRnd() - 0.5) * 6;
      }
    }
    if (b.mode === "fly" || b.mode === "rest") {
      if (b.mode === "fly") {
        moving = true;
        b.vy -= T.gravity * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        const floor = sledFloor(b.x, b.z) + T.brick[1] / 2;
        if (b.y < floor) {
          b.y = floor;
          if (b.vy < -4) {
            b.vy = -b.vy * T.brickBounce;
            if (sled.clatter <= 0 && sledHear(b.x, b.y, b.z) > 0) { synthBlip("square", 220 + sledRnd() * 200, 120, 0.08, 0.06, 0); sled.clatter = 0.06; }
          } else b.vy = 0;
          // friction on the ground
          const hv = Math.hypot(b.vx, b.vz), slow = Math.max(0, hv - T.brickFriction * 9.8 * dt);
          if (hv > 0) { b.vx *= slow / hv; b.vz *= slow / hv; }
          b.wx *= 0.9; b.wy *= 0.9; b.wz *= 0.9;
          if (hv < 0.5 && Math.abs(b.vy) < 0.5) { b.mode = "rest"; b.vx = b.vz = b.vy = 0; }
        }
        const wl = Math.hypot(b.wx, b.wy, b.wz);
        if (wl > 1e-4) { sledAxis.set(b.wx / wl, b.wy / wl, b.wz / wl); sledQ.setFromAxisAngle(sledAxis, wl * dt); b.q.premultiply(sledQ); }
      }
    } else if (b.mode === "back") {
      moving = true;
      total++;
      b.t += dt;
      const k = smoothstep(0, T.rebuildT, b.t - b.delay);
      b.x = lerp(b.from.x, b.slot.x, k); b.z = lerp(b.from.z, b.slot.z, k);
      b.y = lerp(b.from.y, b.slot.y, k) + Math.sin(k * Math.PI) * 14;
      b.q.copy(b.from.q).slerp(b.slot.q, k);
      if (k >= 1) { b.mode = "wall"; b.x = b.slot.x; b.y = b.slot.y; b.z = b.slot.z; b.q.copy(b.slot.q); }
    }
    if (b.mode === "wall") done++;
  }
  if (sled.clatter > 0) sled.clatter -= dt;
  if (moving || sled.rebuilding) sledWriteBricks();
  if (sled.rebuilding && done === sled.bricks.length) {
    sled.rebuilding = false; sled.smashed = false;
    sled.brickMesh.userData.noSolid = false;
    for (const r of sled.reticles) r.visible = true;
    flags.sledRebuilds = (flags.sledRebuilds || 0) + 1;
    if (sledHear(sled.wallSolid.x, SLED.railY, sled.wallSolid.z) > 0) chime();
  }
}

function sledRebuild() {
  if (sled.rebuilding) return;
  sled.rebuilding = true;
  const T = SLED;
  for (const b of sled.bricks) {
    if (b.mode === "wall") continue;
    b.mode = "back"; b.t = 0;
    // the bottom row first, then up: a wall builds from the ground
    b.delay = b.row / T.wallRows * T.rebuildStagger + sledRnd() * 0.15;
    b.from = { x: b.x, y: b.y, z: b.z, q: b.q.clone() };
  }
  if (sledHear(sled.x, sled.y, sled.z) > 0) boing();
}

// ---- state ------------------------------------------------------------------
// from its middle to the tip of its nose
function sledNose() { return 10 * SLED.size; }
function sledPlace() {
  const T = SLED, p = sledAt(sled.d);
  sled.x = p.x; sled.y = T.railY + 0.5; sled.z = p.z;
  sled.sledG.position.set(sled.x, sled.y, sled.z);
  // its capsule, nose to tail
  const S = SLED.size, h = 7 * S, cy = sled.y + 1.9 * S;
  const r = sled.solid.cap;
  r.a[0] = sled.x - sled.dirX * h; r.a[1] = cy; r.a[2] = sled.z - sled.dirZ * h;
  r.b[0] = sled.x + sled.dirX * h; r.b[1] = cy; r.b[2] = sled.z + sled.dirZ * h;
  r.r = 1.6 * S;
  const rec = sled.solid;
  rec.x = sled.x; rec.z = sled.z; rec.hw = Math.abs(sled.dirX) * h + r.r; rec.hd = Math.abs(sled.dirZ) * h + r.r;
  rec.y0 = cy - r.r; rec.y1 = cy + r.r;
}

function sledReset() {
  if (!sled.sledG) return;
  sledSeed = SLED_SEED;
  sled.phase = "armed"; sled.t = 0; sled.d = 0; sled.v = 0;
  sled.smashed = false; sled.chuteOut = false; sled.rebuilding = false; sled.flashT = 0;
  for (const b of sled.bricks) { b.mode = "wall"; b.x = b.slot.x; b.y = b.slot.y; b.z = b.slot.z; b.q.copy(b.slot.q); b.vx = b.vy = b.vz = 0; }
  sledWriteBricks();
  sled.brickMesh.userData.noSolid = false;
  sled.flame.visible = false;
  for (const c of sled.chutes) c.visible = false;
  for (const p of sled.puffs) p.life = 0;
  sled.puffMesh.count = 0;
  sled.flash.material.opacity = 0;
  sledLamps(-1);
  sledPlace();
  for (const r of sled.reticles) r.visible = true;
  setTone("sledRoar", "sawtooth", SLED.roarHz, 0);
  if (el.bigNum.classList.contains("sky") && sled.counting) { countdownClear(); el.bigNum.classList.remove("sky"); }
  sled.counting = false;
}

// v144: on or off the sled (sledride.js). A fresh start at home either way, and
// the target where it belongs: on the rail's line while he rides it -- where his
// nose hits the wall -- and exactly back where it was built when he leaves.
function sledSetRidden(on) {
  sled.ridden = on;
  sledReset();
  const w = sledWallWorld();
  for (const r of sled.reticles) {
    r.position.copy(r.userData.home);
    if (on) { r.position.x += w.rx - w.x; r.position.z += w.rz - w.z; }
  }
}

function sledLamps(k) {
  // -1 all dark; 0 red; 1 red+amber; 2 green only
  sled.lamps.forEach((L, i) => {
    const on = k === 2 ? i === 2 : (k >= 0 && i <= k && i < 2);
    L.glow.material.opacity = on ? 0.95 : 0;
    L.disc.material.color.setHex(on ? L.color : 0x2a2f38);
  });
}

function sledHear(x, y, z) {
  return clamp(1 - Math.hypot(state.x - x, state.y - y, state.z - z) / SLED.hearR, 0, 1);
}

function sledBusy() {
  if (typeof menuOpen === "function" && menuOpen()) return true;
  return typeof police !== "undefined" && !!police.active && police.state === "pullover";
}

function sledAimed() {
  if (state.exploding || eject.active || sledBusy()) return false;
  // someone else's countdown is on the one numeral, or is about to be: wait for it
  if (spCountBusy("rocketSled")) return false;
  // in the mountain tunnel he cannot see it
  if (typeof hwyBoreCeiling === "function" && hwyBoreCeiling(state.x, state.z) !== null) return false;
  const T = SLED, w = sledWallWorld();
  // what he points at is the wall: it is what both ways of driving come at,
  // and where the payoff lands
  const dx = w.x - state.x, dz = w.z - state.z, dy = w.y - state.y;
  const d = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
  const R = typeof vehIsCar === "function" && vehIsCar() ? T.carView + Math.abs(state.speed) * sledToWall() : T.armR;
  if (d > R || dh < T.innerR) return false;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  return (dx * fx + dz * fz) / dh > Math.cos(T.coneDeg * DEG);
}

function sledStart() {
  sled.phase = "count"; sled.t = SLED.count; sled.counting = true;
  flags.sledCountdowns = (flags.sledCountdowns || 0) + 1;
}
// From the first numeral to the smash, in seconds.
function sledToWall() {
  const T = SLED, dist = T.wallAt - T.brick[2] / 2 - sledNose(), burnD = 0.5 * T.accel * T.burn * T.burn;
  return T.count + (dist <= burnD ? Math.sqrt(2 * dist / T.accel) : T.burn + (dist - burnD) / (T.accel * T.burn));
}
function sledForce() { if (sled.phase === "armed") sledStart(); }

function updateRocketSled(dt) {
  if (!sled.sledG) return;
  const T = SLED;
  sled.clock += dt;
  // v144: he has just got on it (sledride.js), or just got off: either way a fresh start at home
  const ridden = typeof srActive === "function" && srActive();
  if (ridden !== !!sled.ridden) sledSetRidden(ridden);
  const near = Math.hypot(state.x - sled.x, state.z - sled.z) < TUNE.fogFar * 1.45;
  sled.g.visible = near;
  sled.sledG.visible = near && !sled.ridden;      // riding it, the sled drawn is his own
  sled.brickMesh.visible = near;
  for (const r of sled.reticles) {
    r.visible = near && !sled.smashed && !sled.rebuilding;
    r.scale.setScalar(1 + Math.sin(sled.clock * SLED.reticleRate) * 0.12);
  }
  const ph = sled.phase;

  if (ph === "armed") {
    if (sled.ridden ? srGo() : sledAimed()) sledStart();   // riding it, only his go starts it
  } else if (ph === "count") {
    if (sledBusy()) {
      countdownClear(); el.bigNum.classList.remove("sky"); sled.counting = false;
      sledLamps(-1); setTone("sledRoar", "sawtooth", T.roarHz, 0);
      sled.phase = "armed";
      flags.sledStandDowns = (flags.sledStandDowns || 0) + 1;
    } else {
      sled.t -= dt;
      el.bigNum.classList.add("sky");
      const n = countdownTo(sled.t, T.count);
      sledLamps(n === 3 ? 0 : n === 2 ? 1 : n === 1 ? 1 : -1);
      setTone("sledRoar", "sawtooth", T.roarHz, T.roar * 0.3 * sledHear(sled.x, sled.y, sled.z) * (1 - sled.t / T.count));
      if (sled.t <= 0) {
        countdownClear(); el.bigNum.classList.remove("sky"); sled.counting = false;
        sledLamps(2);
        sled.phase = "run"; sled.t = 0; sled.v = 0;
        sled.flame.visible = true;
        flags.sledRuns = (flags.sledRuns || 0) + 1;
        if (sledHear(sled.x, sled.y, sled.z) > 0) { liftoffRoar(); noiseBurst(0.8, 300, 0.4, 0); }
      }
    }
  } else if (ph === "run" || ph === "chute") {
    sled.t += dt;
    if (ph === "run" && sled.t < T.burn) sled.v += T.accel * dt;
    if (ph === "run" && sled.t >= T.burn) sled.flame.visible = false;
    if (ph === "chute") sled.v = Math.max(0, sled.v - T.chuteDecel * dt);
    sled.d += sled.v * dt;
    if (sled.d > sled.len - 10) { sled.d = sled.len - 10; sled.v = 0; }   // a backstop that the tuning never reaches
    // through the wall
    if (!sled.smashed && sled.d + sledNose() >= T.wallAt - T.brick[2] / 2) {
      sledSmash();
      sled.v *= T.smashKeep;
      sled.phase = "chute"; sled.t = 0;
      sled.flame.visible = false;
    }
    if (sled.phase === "chute" && !sled.chuteOut && sled.t > 0.35) {
      sled.chuteOut = true;
      for (const c of sled.chutes) c.visible = true;
      flags.sledChutes = (flags.sledChutes || 0) + 1;
      if (sledHear(sled.x, sled.y, sled.z) > 0) chutePop(true);
    }
    // the flame and its smoke
    if (sled.flame.visible) {
      sled.flame.scale.set(1, 1, 1 + Math.sin(sled.clock * 50) * 0.08 + Math.min(1, sled.t) * 0.4);
      sled.trailT -= dt;
      while (sled.trailT <= 0) {
        sled.trailT += T.trailEvery;
        sledPuff(sled.x - sled.dirX * 7 * T.size, sled.y + 1.9 * T.size, sled.z - sled.dirZ * 7 * T.size, -2 - sledRnd() * 3, 1 + sledRnd() * 2, 0, 2, 6 + sledRnd() * 3, T.trailLife, 0xf2f4f7);
      }
    }
    // the roar, pitched by whether it is coming or going (a little Doppler)
    const vr = ((state.x - sled.x) * sled.dirX + (state.z - sled.z) * sled.dirZ) / Math.max(1, Math.hypot(state.x - sled.x, state.z - sled.z)) * sled.v;
    const hz = T.roarHz * clamp(1 + vr / 340, 0.6, 1.6);
    setTone("sledRoar", "sawtooth", hz, sled.flame.visible ? T.roar * sledHear(sled.x, sled.y, sled.z) : 0);
    // the chutes stream out behind and sway
    if (sled.chuteOut) sled.chutes.forEach((c, i) => {
      // a fan: left and right low, the middle one high, so all three show from any side
      const sw = Math.sin(sled.clock * 3 + i) * 1.5;
      c.position.set((i - 1) * 24 + sw, i === 1 ? 26 : 12, -6.5 * T.size - 32 - (i === 1 ? 8 : 0));
      c.lookAt(sled.sledG.localToWorld(lsV.set(0, 2, -8)));
    });
    if (sled.phase === "chute" && sled.v <= 0) { sled.phase = "rest"; sled.t = T.rest; }
  } else if (ph === "rest") {
    sled.t -= dt;
    if (sled.t <= 0) {
      for (const c of sled.chutes) c.visible = false;      // packed, and it rolls home
      sled.chuteOut = false;
      sled.phase = "home"; sled.from = sled.d;
    }
  } else if (ph === "home") {
    // back up the rail: easing off at both ends
    const left = sled.d;
    const v = Math.min(T.homeSpeed, Math.max(3, left * 0.6), Math.max(3, (sled.from - left) * 0.6 + 3));
    sled.d = Math.max(0, sled.d - v * dt);
    sled.v = -v;
    // once it is back through the gap, the wall flies back together behind it
    if (!sled.rebuilding && sled.smashed && sled.d + sledNose() < T.wallAt - T.brick[2] / 2 - 10) sledRebuild();
    if (sled.d <= 0 && !sled.rebuilding && !sled.smashed) {
      sled.d = 0; sled.v = 0; sled.phase = "armed";
      sledLamps(-1);
      flags.sledHomes = (flags.sledHomes || 0) + 1;
    }
  }
  sledPlace();
  sledClearPath(dt);
  sledUpdateBricks(dt);
  if (sled.flashT > 0) {
    sled.flashT -= dt;
    sled.flash.material.opacity = Math.max(0, sled.flashT / 0.6);
    sled.flash.scale.setScalar(60 + (0.6 - sled.flashT) * 140);
  }
  sledUpdatePuffs(dt);
}

// Something sitting still on the rail ahead of the moving sled (a helicopter
// hovering low over it) is stepped sideways off it, west, before the sled gets
// there -- not bulldozed down the rail by the capsule's nose into the wall. At
// speed it is his to fly into, and the capsule is a bang like any other solid.
function sledClearPath(dt) {
  if (sled.ridden || Math.abs(sled.v) < 1 || state.exploding) return;   // riding it, he is the sled
  if (typeof vehCrawl === "function" && Math.abs(state.speed) > vehCrawl()) return;
  const T = SLED, S = T.size;
  const rx = state.x - sled.x, rz = state.z - sled.z;
  const along = (rx * sled.dirX + rz * sled.dirZ) * Math.sign(sled.v);
  const across = rx * sled.dirZ - rz * sled.dirX;          // +west
  const half = 1.6 * S + (typeof vehSolidR === "function" ? vehSolidR() : 3) + 2;
  if (along < -7 * S || along > T.clearAhead || Math.abs(across) >= half || state.y > sled.y + 4 * S + 4) return;
  const step = Math.min(half - across, T.clearSpeed * dt);
  state.x += sled.dirZ * step; state.z += -sled.dirX * step;
  flags.sledSidesteps = (flags.sledSidesteps || 0) + 1;
}

// Streamed trees and towns keep off the rail, the wall and where the bricks land.
function sledCovers(x, z, extra) {
  const T = SLED;
  const rx = x - T.n[0], rz = z - T.n[1];
  const along = rx * sled.dirX + rz * sled.dirZ, across = rx * sled.dirZ - rz * sled.dirX;
  const r = T.clearR + (extra || 0);
  // `across` is positive WEST of the rail, where the bricks fly
  return along > -r && along < sled.len + r && across > -r && across < r + 80;
}

// three.js draws Math.random for every object it makes; built on the kit's own
// stream (vkQuiet, 0 draws back), the seeded traffic sees the stream it saw before
// this set-piece existed.
vkQuiet(0, () => sledBuild());
spCountRegister("rocketSled", () => sled.phase === "count");
