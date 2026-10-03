"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE LAUNCH SITE (v133).
//
// A rocket the height of a skyscraper stands on a pad beside the motorway, east
// of it, past the lakes. Point at it from inside `armR` -- the car coming down
// the road, the plane, the helicopter, anything -- and it goes: big numerals
// 5-4-3-2-1, the engines light on the pad, a cloud rolls out of the flame trench
// and it climbs away, leaning east, away from the road. Twenty-odd seconds up,
// its two white side boosters let go, flip engines-first, fly home and land
// upright on their own two pads with a double sonic boom. Then a fresh stack
// rises out of the pad, the arms swing back, and it is ready to go again.
//
// The set-piece loop, as every one runs it: the giant obvious thing (the
// tallest thing on the plains), one aim (pointing at it), a wind-up (the
// numerals, the arms swinging away, the rumble), a payoff (liftoff, and the
// boosters coming home), and a free reset. Nothing to press, nothing to miss:
// look away and it simply waits.
//
// RULES THIS FILE KEEPS
//   * It is something he POINTS at: inside armR and nose within coneDeg of it.
//     Driving away from it with it behind him does nothing (the check drives it).
//   * No unannounced bang: the ignition boom is the end of a 5-4-3-2-1.
//   * The cloud never reaches the road. The flame trench runs north-south, the
//     road's edge is under 100 m west, and every puff drifts EAST;
//     launchsite_checks samples every puff against hwyCorridorDist.
//     Readability beats realism -- if it ever gets near the road, the cloud
//     goes, not the road.
//   * Solid wherever it is, in the one registry: the stack is a capsule (kind
//     "pillar") that FOLLOWS it -- on the pad, rising out of it, and climbing
//     -- and each booster is one too, from separation until it sinks back into
//     its pad. Nothing visible is ever flown through. The plinth, the landing
//     pads and the tower are solid always.
//   * It shares the one big numeral, and never fights for it: a police
//     pull-over or the picker opening takes it back (the countdown stands down
//     and the rocket simply waits; nothing is lost).
//   * Its own random stream (lsRnd): the show never shifts the game's `rnd()`
//     for anything else.
//   * Its own cloud pool, ONE instanced draw for every puff of it, so the
//     launch never starves the shared wake pool of the boats and the planes.
// ---------------------------------------------------------------------------
const LSITE = TUNE.launchSite;

const LS_SEED = 0x51A7E;
let lsSeed = LS_SEED;
function lsRnd() { lsSeed = (lsSeed * 1664525 + 1013904223) >>> 0; return lsSeed / 4294967296; }

const lsite = {
  g: null, stack: null, core: null, coreFlame: null, coreGlow: null,
  padY: 0, stackH: 0,
  arms: [], beacon: null,
  pairs: [], boosters: [],     // two pairs: one on the stack, one landed or spare
  solid: null,                 // the stack's record in the registry
  phase: "armed",              // armed | count | ignite | climb | rest | restack
  t: 0, tt: 0, clock: 0,
  flying: false, alt: 0, speed: 0, tilt: 0,
  x: 0, y: 0, z: 0,            // the stack's base, world
  sep: false, booms: [], trailT: 0,
  lastLandings: [], lastLandDist: [],
};

// ---- geometry: merge many parts into one mesh per colour ------------------
// three.js batches nothing itself, and a rocket is a pile of cylinders.
function lsMerge(parts) {
  const pos = [], nor = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), n3 = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    p.obj.updateMatrix();
    n3.getNormalMatrix(p.obj.matrix);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.obj.matrix); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.push(n.x, n.y, n.z);
    }
    g.dispose(); if (g !== p.geo) p.geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
// A little builder: add(colour, geometry, x, y, z, rx, ry, rz), then build(group)
// makes one mesh per colour.
function lsKit() {
  const by = new Map(), tmp = () => new THREE.Object3D();
  return {
    add(color, geo, x, y, z, rx, ry, rz) {
      const o = tmp(); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0);
      if (!by.has(color)) by.set(color, []);
      by.get(color).push({ geo, obj: o });
    },
    build(group, mat) {
      const out = [];
      for (const [color, parts] of by) {
        const m = new THREE.Mesh(lsMerge(parts), mat ? mat(color) : lam(color));
        group.add(m); out.push(m);
      }
      return out;
    },
  };
}
const lsCyl = (r0, r1, h, seg) => new THREE.CylinderGeometry(r0, r1, h, seg || 14);
// The rocket's own paint: the palette colour, with a share of it as its own
// light. Lit like the scenery, its shaded side went grey a kilometre out and the
// orange core and the white boosters stopped being orange and white.
const lsPaintCache = {};
function lsPaint(color) {
  if (!lsPaintCache[color]) {
    const c = new THREE.Color(color);
    lsPaintCache[color] = new THREE.MeshLambertMaterial({ color, emissive: c.multiplyScalar(LSITE.selfLight) });
  }
  return lsPaintCache[color];
}

// ---- the flame: an outer and an inner cone, pointing down from y = 0 --------
function lsFlame(group, spots, r, len) {
  const P = TUNE.palette;
  const outer = lsKit(), inner = lsKit();
  for (const [x, z] of spots) {
    outer.add(P.flame, new THREE.ConeGeometry(r, len, 10), x, -len / 2, z, Math.PI, 0, 0);
    inner.add(0xfff4d6, new THREE.ConeGeometry(r * 0.55, len * 0.6, 8), x, -len * 0.3, z, Math.PI, 0, 0);
  }
  const f = new THREE.Group();
  const flat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92, depthWrite: false });
  outer.build(f, flat); inner.build(f, flat);
  const glow = glowSprite(P.flame, len * 1.6, 0.95);
  glow.position.y = -len * 0.25;
  f.add(glow);
  f.userData.glow = glow; f.userData.glowSize = len * 1.6;
  f.visible = false;
  group.add(f);
  return f;
}

// ---- one side booster: origin at the nozzle exit, nose up -----------------
function lsBuildBooster(side) {
  const P = TUNE.palette;
  const g = new THREE.Group();
  const k = lsKit();
  k.add(P.white, lsCyl(1.9, 1.9, 56), 0, 3 + 28, 0);
  k.add(P.white, new THREE.ConeGeometry(1.9, 6, 14), 0, 59 + 3, 0);
  k.add(P.slate, lsCyl(1.95, 1.95, 1.6), 0, 50, 0);
  k.add(P.slate, lsCyl(1.95, 1.95, 1.6), 0, 12, 0);
  k.add(P.slate, lsCyl(1.0, 1.7, 3, 10), 0, 1.5, 0);
  // four grid fins at the top, which is what makes it a booster that flies home
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    k.add(P.slate, new THREE.BoxGeometry(2.4, 0.3, 1.6), Math.cos(a) * 2.6, 56, Math.sin(a) * 2.6, 0, -a, 0);
  }
  const body = k.build(g, lsPaint)[0];
  // the legs: four struts hinged at the bottom, folded up the body until the end
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const hinge = new THREE.Group();
    hinge.position.set(Math.cos(a) * 2.2, 4, Math.sin(a) * 2.2);
    hinge.rotation.y = -a;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.7), lsPaint(P.slate));
    leg.position.y = 4.5;
    hinge.add(leg);
    g.add(hinge);
    legs.push(hinge);
  }
  const flame = lsFlame(g, [[0, 0]], 1.5, 16);
  const solid = solidCapsule([0, -1e4, 0], [0, -1e4, 0], 1, "pillar");
  solid.mesh = body; solid.ls = true;
  body.userData.noSolid = true; body.userData.noShatter = true;
  return { g, side, legs, flame, body, solid, mode: "stack", t: 0, x: 0, y: 0, z: 0, tiltDeg: 0, landed: false,
           lzX: 0, lzZ: 0, lzY: 0, p0: null, v0: null, q0: new THREE.Quaternion() };
}
function lsLegs(b, k) {
  // folded: lying up the body. Out: swung down and out, 145 degrees from up.
  for (const h of b.legs) { h.rotation.z = -k * 2.5; h.visible = k > 0; }
}

function lsBuildStack() {
  const P = TUNE.palette;
  const s = new THREE.Group();
  const k = lsKit();
  // the core: orange, four engine bells under it
  k.add(P.fire, lsCyl(4.2, 4.2, 62, 18), 0, 4 + 31, 0);
  k.add(P.slate, lsCyl(4.25, 4.25, 1.2, 18), 0, 66, 0);
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) k.add(P.slate, lsCyl(0.6, 1.3, 4, 10), x, 2, z);
  // the upper stage, the capsule and its escape tower
  k.add(P.white, lsCyl(3.4, 4.2, 3, 18), 0, 66 + 1.5, 0);
  k.add(P.white, lsCyl(3.4, 3.4, 12, 18), 0, 69 + 6, 0);
  k.add(P.white, lsCyl(1.3, 3.1, 5, 16), 0, 81 + 2.5, 0);
  k.add(P.red, lsCyl(0.45, 0.45, 8, 6), 0, 86 + 4, 0);
  k.add(P.red, new THREE.ConeGeometry(0.9, 2, 8), 0, 95, 0);
  const meshes = k.build(s, lsPaint);
  lsite.core = meshes[0];
  lsite.core.userData.noShatter = true;
  lsite.stackH = 96;
  lsite.coreFlame = lsFlame(s, [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]], 1.6, 26);
  return s;
}

function lsBuildTower(g, padTop) {
  const P = TUNE.palette;
  const k = lsKit();
  const tx = 19, H = 108, half = 6;   // in the tower's own frame: scaled by `size` with its group
  for (const [cx, cz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) k.add(P.rust, new THREE.BoxGeometry(1.4, H, 1.4), tx + cx, padTop + H / 2, cz);
  for (let y = 8; y < H; y += 8) {
    k.add(P.rust, new THREE.BoxGeometry(half * 2, 0.8, 0.8), tx, padTop + y, -half);
    k.add(P.rust, new THREE.BoxGeometry(half * 2, 0.8, 0.8), tx, padTop + y, half);
    k.add(P.rust, new THREE.BoxGeometry(0.8, 0.8, half * 2), tx - half, padTop + y, 0);
    k.add(P.rust, new THREE.BoxGeometry(0.8, 0.8, half * 2), tx + half, padTop + y, 0);
    // a cross-brace on the two faces he sees
    const d = Math.hypot(half * 2, 8);
    k.add(P.rust, new THREE.BoxGeometry(0.5, d, 0.5), tx - half, padTop + y - 4, 0, Math.atan2(half * 2, 8) * ((y / 8) % 2 ? 1 : -1), 0, 0);
  }
  k.add(P.slate, new THREE.BoxGeometry(half * 2 + 2, 3, half * 2 + 2), tx, padTop + H + 1.5, 0);
  k.add(P.rust, lsCyl(0.3, 0.3, 18, 6), tx, padTop + H + 12, 0);
  k.build(g);
  // the swing arms: hinged at the tower's west face, reaching the stack
  lsite.arms = [];
  for (const [y, len] of [[58, 13], [84, 14.5]]) {
    const hinge = new THREE.Group();
    hinge.position.set(tx - half, padTop + y, 2.5);
    const ak = lsKit();
    ak.add(P.steel, new THREE.BoxGeometry(len, 2.4, 3), -len / 2, 0, 0);
    ak.add(P.steel, new THREE.BoxGeometry(3, 3.2, 3.6), -len + 1.5, 0, 0);
    ak.build(hinge);
    g.add(hinge);
    lsite.arms.push(hinge);
  }
  const beacon = glowSprite(P.red, 16, 0.9);
  beacon.position.set(tx, padTop + H + 22, 0);
  g.add(beacon);
  lsite.beacon = beacon;
  return { tx, H, half };
}

function lsBuild() {
  const P = TUNE.palette, T = LSITE;
  const g = new THREE.Group();
  g.userData.name = "launchSite";
  // the plinth stands over the highest ground under it, so it is never buried
  let hi = -1e9, lo = 1e9;
  for (let dx = -T.padHalf; dx <= T.padHalf; dx += 6) for (let dz = -T.padHalf; dz <= T.padHalf; dz += 6) {
    const h = terrainEff(T.x + dx, T.z + dz); hi = Math.max(hi, h); lo = Math.min(lo, h);
  }
  const padY = hi + T.padRise;
  lsite.padY = padY;
  g.position.set(T.x, 0, T.z);
  const plinthH = padY - (lo - 3);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(T.padHalf * 2, plinthH, T.padHalf * 2), artLam(P.concrete, "concrete"));
  plinth.userData.noShatter = true;    // a bang against the tower must not blast the whole pad away
  plinth.position.set(0, padY - plinthH / 2, 0);
  g.add(plinth);
  // the flame trench: a dark slot north-south under the stack, out to both edges
  const trench = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, T.padHalf * 2 + 0.2), lam(P.ink));
  trench.position.set(0, padY + 0.05, 0);
  g.add(trench);
  const rails = lsKit();
  for (const sx of [-6, 6]) rails.add(P.warning, new THREE.BoxGeometry(0.8, 0.35, T.padHalf * 2 + 0.3), sx, padY + 0.1, 0);
  rails.build(g, c => lam(c));
  const towerG = new THREE.Group();
  towerG.position.y = padY; towerG.scale.setScalar(T.size);
  g.add(towerG);
  const tw = lsBuildTower(towerG, 0);
  // the two landing pads: a grey disc, a yellow ring and a white cross
  const lzs = [];
  for (const [lx, lz] of T.lz) {
    let lhi = -1e9, llo = 1e9;
    for (let a = 0; a < 12; a++) for (const rr of [0, T.lzR * 0.6, T.lzR]) {
      const h = terrainEff(lx + Math.cos(a / 12 * Math.PI * 2) * rr, lz + Math.sin(a / 12 * Math.PI * 2) * rr);
      lhi = Math.max(lhi, h); llo = Math.min(llo, h);
    }
    const top = lhi + 0.8, dh = top - (llo - 3);
    const disc = new THREE.Mesh(lsCyl(T.lzR, T.lzR + 1.5, dh, 28), artLam(P.concrete, "concrete"));
    disc.userData.noShatter = true;
    disc.position.set(lx - T.x, top - dh / 2, lz - T.z);
    g.add(disc);
    // one yellow mark: a ring and a cross in it
    const mark = lsKit();
    mark.add(P.warning, new THREE.TorusGeometry(T.lzR * 0.72, 0.9, 6, 36), lx - T.x, top + 0.15, lz - T.z, -Math.PI / 2, 0, 0);
    mark.add(P.warning, new THREE.BoxGeometry(T.lzR * 0.9, 0.3, 3), lx - T.x, top + 0.12, lz - T.z);
    mark.add(P.warning, new THREE.BoxGeometry(3, 0.3, T.lzR * 0.9), lx - T.x, top + 0.12, lz - T.z);
    mark.build(g);
    lzs.push({ x: lx, z: lz, y: top, disc, dh });
  }
  // T-0: a white ring racing out across the pad
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, padY + 0.6, 0); ring.visible = false;
  g.add(ring);
  lsite.ring = ring;
  castsAndReceives(g);
  scene.add(g);
  lsite.g = g;
  lsite.lzs = lzs;

  // ---- the solids: one registry, marked as ours (`ls`) so the check can tell
  const b0 = addSolidBox(T.x, lo - 3, T.z, T.padHalf, T.padHalf, padY, plinth, "pad"); b0.ls = true;
  const bt = addSolidBox(T.x + tw.tx * T.size, padY, T.z, (tw.half + 0.7) * T.size, (tw.half + 0.7) * T.size, padY + (tw.H + 3) * T.size, plinth, "building"); bt.ls = true;
  for (const L of lzs) { const b = addSolidBox(L.x, L.y - L.dh, L.z, T.lzR, T.lzR, L.y, L.disc, "pad"); b.ls = true; }

  // ---- the stack, and two pairs of boosters (one flies, the other waits)
  const stack = lsBuildStack();
  stack.scale.setScalar(T.size);
  lsite.stackH *= T.size;
  castsAndReceives(stack);
  scene.add(stack);
  lsite.stack = stack;
  for (let p = 0; p < 2; p++) {
    const pair = [lsBuildBooster(1), lsBuildBooster(-1)];
    for (const b of pair) { b.g.scale.setScalar(T.size); castsAndReceives(b.g); b.g.visible = false; scene.add(b.g); }
    lsite.pairs.push(pair);
  }
  lsite.boosters = lsite.pairs[0];
  const sc = solidCapsule([T.x, padY + 2, T.z], [T.x, padY + lsite.stackH - 6, T.z], 7.5 * T.size, "pillar");
  sc.mesh = lsite.core; sc.ls = true;
  lsite.solid = sc;

  // ---- the cloud: one instanced draw for every puff of the show
  const N = T.puffs;
  // lit, but with enough of its own light that the shaded side still reads as
  // cloud and not as a heap of grey rocks
  const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x6a6a6a, transparent: true, opacity: 0.9, depthWrite: false }), N);
  pm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pm.setColorAt(0, new THREE.Color(0xffffff));
  pm.count = 0;
  pm.frustumCulled = false;
  scene.add(pm);
  lsite.puffMesh = pm;
  lsite.puffs = [];
  for (let i = 0; i < N; i++) lsite.puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r0: 1, r1: 2, r: 0, c: 0xffffff });
  lsite.puffCursor = 0;

  lsReset();
}

// ---- the cloud pool -------------------------------------------------------
function lsPuff(x, y, z, vx, vy, vz, r0, r1, life, color) {
  let p = lsite.puffs.find(q => q.life <= 0);
  if (!p) { p = lsite.puffs[lsite.puffCursor]; lsite.puffCursor = (lsite.puffCursor + 1) % lsite.puffs.length; }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.r0 = r0; p.r1 = r1; p.r = r0; p.life = p.max = life; p.c = color || 0xffffff;
}
const lsTmpO = new THREE.Object3D(), lsTmpC = new THREE.Color();
function lsUpdatePuffs(dt) {
  const pm = lsite.puffMesh;
  let n = 0;
  const drag = Math.exp(-dt * 0.9);
  for (const p of lsite.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.vx *= drag; p.vz *= drag; p.vy *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = 1 - p.life / p.max;
    // grows, then thins away over its last quarter (shrinking reads as fading
    // and keeps every puff in one draw)
    p.r = lerp(p.r0, p.r1, Math.sqrt(k)) * (k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.85 : 1);
    lsTmpO.position.set(p.x, p.y, p.z);
    lsTmpO.scale.setScalar(p.r);
    lsTmpO.updateMatrix();
    pm.setMatrixAt(n, lsTmpO.matrix);
    pm.setColorAt(n, lsTmpC.setHex(p.c));
    n++;
  }
  pm.count = n;
  if (n) { pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true; }
}
function lsPuffsLive() { return lsite.puffs.filter(p => p.life > 0).map(p => ({ x: p.x, y: p.y, z: p.z, r: p.r })); }

// ---- state ----------------------------------------------------------------
function lsStackSolid() { return !!(lsite.solid && !isSolidHidden(lsite.solid)); }

// A capsule record in the registry, moved to where its thing is now. solidQuery
// walks the registry every time it is asked, so a record that moves is simply
// where it is the next time anyone asks.
function lsCapsuleSet(rec, ax, ay, az, bx, by, bz, r) {
  rec.cap.a[0] = ax; rec.cap.a[1] = ay; rec.cap.a[2] = az;
  rec.cap.b[0] = bx; rec.cap.b[1] = by; rec.cap.b[2] = bz; rec.cap.r = r;
  rec.x = (ax + bx) / 2; rec.z = (az + bz) / 2;
  rec.hw = Math.abs(ax - bx) / 2 + r; rec.hd = Math.abs(az - bz) / 2 + r;
  rec.y0 = Math.min(ay, by) - r; rec.y1 = Math.max(ay, by) + r;
}
// The stack: base to nose along its lean. With the boosters on it is as fat as
// the three of them; without, it is the core.
function lsSolidStack() {
  const T = LSITE, h = lsite.stackH - 6 * T.size;
  const ux = Math.sin(lsite.tilt), uy = Math.cos(lsite.tilt);
  lsCapsuleSet(lsite.solid, lsite.x + ux * 2, lsite.y + uy * 2, lsite.z, lsite.x + ux * h, lsite.y + uy * h, lsite.z,
    (lsite.sep ? 5 : 7.5) * T.size);
}
// A booster: solid from separation until it sinks back into its pad.
function lsSolidBooster(b) {
  const live = b.mode === "glide" || b.mode === "burn" || b.mode === "landed";
  b.body.userData.noSolid = !live;
  if (!live) return;
  lsV.set(0, 1, 0).applyQuaternion(b.g.quaternion);
  const L = 60 * LSITE.size;
  lsCapsuleSet(b.solid, b.g.position.x + lsV.x * 3, b.g.position.y + lsV.y * 3, b.g.position.z + lsV.z * 3,
    b.g.position.x + lsV.x * L, b.g.position.y + lsV.y * L, b.g.position.z + lsV.z * L, 2.6 * LSITE.size);
}
// Someone else's countdown is on the one big numeral (the police pulling him
// over), or the picker is up: the launch stands down rather than fight it.
function lsNumBusy() {
  if (typeof menuOpen === "function" && menuOpen()) return true;
  // a chase is not a countdown -- only the pull-over at its end is
  return typeof police !== "undefined" && !!police.active && police.state === "pullover";
}

function lsSeatBoosters(pair) {
  for (const b of pair) {
    b.mode = "stack"; b.landed = false; b.t = 0; b.tiltDeg = 0;
    b.g.visible = true; b.flame.visible = false;
    lsLegs(b, 0);
  }
}
function lsPlaceStack(y) {
  const T = LSITE;
  lsite.x = T.x; lsite.y = y; lsite.z = T.z; lsite.tilt = 0;
  lsite.stack.position.set(T.x, y, T.z);
  lsite.stack.rotation.set(0, 0, 0);
  lsite.stack.visible = true;
  for (const b of lsite.boosters) if (b.mode === "stack") {
    b.g.position.set(T.x, y, T.z + b.side * 6.3 * T.size);
    b.g.quaternion.set(0, 0, 0, 1);
  }
}

function lsReset() {
  if (!lsite.stack) return;
  lsite.phase = "armed";
  lsite.t = 0; lsite.tt = 0; lsite.flying = false; lsite.alt = 0; lsite.speed = 0; lsite.tilt = 0;
  lsite.sep = false; lsite.boomed = false; lsite.booms = [];
  lsite.boosters = lsite.pairs[0];
  lsite.ring.visible = false;
  if (el.bigNum.classList.contains("sky")) { countdownClear(); el.bigNum.classList.remove("sky"); }
  for (const b of lsite.pairs[1]) { b.mode = "spare"; b.g.visible = false; b.landed = false; }
  lsSeatBoosters(lsite.boosters);
  lsPlaceStack(lsite.padY);
  lsSeed = LS_SEED;                 // the same cloud every time, whatever ran before
  lsSolidStack();
  for (const b of lsite.pairs.flat()) lsSolidBooster(b);
  lsite.coreFlame.visible = false;
  for (const a of lsite.arms) a.rotation.y = 0;
  for (const p of lsite.puffs) p.life = 0;
  lsite.puffMesh.count = 0;
  setTone("lsRoar", "sawtooth", LSITE.roarHz, 0);
  setTone("lsRoar2", "triangle", LSITE.roarHz * 1.5, 0);
}

function lsHear() {
  return clamp(1 - Math.hypot(state.x - lsite.x, state.y - lsite.y, state.z - lsite.z) / LSITE.hearR, 0, 1);
}

// Is he pointing at it? Inside armR (3-D, so a rocket in orbit above it is not
// "near"), not right on top of it, and his nose within coneDeg of it.
function lsAimed() {
  if (state.exploding || (typeof menuOpen === "function" && menuOpen()) || eject.active) return false;
  const T = LSITE;
  const dx = T.x - state.x, dz = T.z - state.z, dy = lsite.padY + 40 - state.y;
  const d = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
  if (d > T.armR || dh < T.innerR) return false;
  if (lsNumBusy()) return false;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  return (dx * fx + dz * fz) / dh > Math.cos(T.coneDeg * DEG);
}

function lsStart() {
  lsite.phase = "count";
  lsite.t = LSITE.count;
  flags.lsCountdowns = (flags.lsCountdowns || 0) + 1;
}
// The harness's way in: start the countdown wherever he is.
function lsForce() { if (lsite.phase === "armed") lsStart(); }

function lsIgnite() {
  const T = LSITE;
  lsite.phase = "ignite";
  lsite.t = T.holdDown;
  lsite.coreFlame.visible = true;
  lsite.coreFlame.scale.set(1, 0.3, 1);
  for (const b of lsite.boosters) { b.flame.visible = true; b.flame.scale.set(1, 0.3, 1); }
  const hear = lsHear();
  if (hear > 0) { bigBoom(lsite.x, lsite.padY + 5, lsite.z); liftoffRoar(); }
  const d = Math.hypot(state.x - lsite.x, state.z - lsite.z);
  shakeAmp = Math.max(shakeAmp, T.shake * clamp(1 - d / T.shakeR, 0, 1));
  lsite.ring.visible = true; lsite.ring.userData.t = 0;
  flags.lsIgnitions = (flags.lsIgnitions || 0) + 1;
}

// The cloud out of the trench, both ways along it (north and south), every puff
// drifting east -- away from the road, never towards it.
function lsTrenchCloud(n, strength) {
  const T = LSITE;
  for (let i = 0; i < n; i++) {
    const dir = lsRnd() < 0.5 ? -1 : 1;
    const sp = T.cloudOut * (0.55 + lsRnd() * 0.6) * strength;
    lsPuff(T.x + 2 + lsRnd() * 8, lsite.padY + 2 + lsRnd() * 3, T.z + dir * (T.padHalf - 6),
      T.cloudDrift * (0.6 + lsRnd() * 0.8), 2 + lsRnd() * 5, dir * sp, 5 + lsRnd() * 3, 15 + lsRnd() * 7, T.cloudLife * (0.7 + lsRnd() * 0.5),
      lsRnd() < 0.3 ? 0xdfe3ea : 0xf7f8fa);
  }
}

function lsSeparate() {
  const T = LSITE;
  lsite.sep = true;
  flags.lsSeparations = (flags.lsSeparations || 0) + 1;
  if (lsHear() > 0) stageSep();
  // where they part: a white burst you can see from the road
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    lsPuff(lsite.x + Math.cos(a) * 6, lsite.y + T.size * 40 + Math.sin(a) * 6, lsite.z + Math.sin(a) * 9,
      Math.cos(a) * 10, Math.sin(a) * 6, Math.sin(a) * 16, 5, 16, 2.8, 0xffffff);
  }
  const up = new THREE.Vector3(Math.sin(lsite.tilt), Math.cos(lsite.tilt), 0);
  T.lz.forEach(([lx, lzz], i) => {
    const b = lsite.boosters[i];
    b.mode = "glide"; b.t = 0;
    b.p0 = new THREE.Vector3(b.g.position.x, b.g.position.y, b.g.position.z);
    // the stack's velocity, halved (a booster that kept all of it would sail
    // a kilometre past the top of its arc), plus a shove outwards
    b.v0 = up.clone().multiplyScalar(lsite.speed * 0.5).add(new THREE.Vector3(0, 0, b.side * T.sepPush));
    b.q0.copy(b.g.quaternion);
    const L = lsite.lzs[i];
    b.lzX = L.x; b.lzZ = L.z; b.lzY = L.y;
  });
}

const lsQa = new THREE.Quaternion(), lsQb = new THREE.Quaternion(), lsY = new THREE.Vector3(0, 1, 0), lsV = new THREE.Vector3();
function lsUpdateBooster(b, dt) {
  const T = LSITE;
  if (b.mode === "glide") {
    b.t += dt;
    const u = clamp(b.t / T.glideT, 0, 1), D = T.glideT;
    const burnV = 2 * T.burnH / T.burnT;
    // Hermite from where it let go to the top of the landing burn, arriving
    // straight down at the burn's own speed
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const d00 = 6 * u * u - 6 * u, d10 = 3 * u * u - 4 * u + 1, d01 = -6 * u * u + 6 * u, d11 = 3 * u * u - 2 * u;
    const P1x = b.lzX, P1y = b.lzY + T.burnH, P1z = b.lzZ;
    b.x = h00 * b.p0.x + h10 * D * b.v0.x + h01 * P1x;
    b.y = h00 * b.p0.y + h10 * D * b.v0.y + h01 * P1y + h11 * D * -burnV;
    b.z = h00 * b.p0.z + h10 * D * b.v0.z + h01 * P1z;
    lsV.set(d00 * b.p0.x + d10 * D * b.v0.x + d01 * P1x,
            d00 * b.p0.y + d10 * D * b.v0.y + d01 * P1y + d11 * D * -burnV,
            d00 * b.p0.z + d10 * D * b.v0.z + d01 * P1z);
    // engines first: the nose turns to point back along where it is going --
    // over the top of its arc that is a flip, and by the burn it is straight up
    lsV.negate().normalize();
    lsQb.setFromUnitVectors(lsY, lsV);
    lsQa.copy(b.q0).slerp(lsQb, smoothstep(0, T.flipT, b.t));
    b.g.quaternion.copy(lsQa);
    b.g.position.set(b.x, b.y, b.z);
    // the boostback burn, briefly, as it comes round
    b.flame.visible = b.t > T.flipT * 0.4 && b.t < T.flipT + 2.2;
    if (b.flame.visible) b.flame.scale.set(0.8, 0.7, 0.8);
    if (u >= 1) { b.mode = "burn"; b.t = 0; b.g.quaternion.set(0, 0, 0, 1); }
  } else if (b.mode === "burn") {
    b.t += dt;
    const k = clamp(b.t / T.burnT, 0, 1), v0 = 2 * T.burnH / T.burnT;
    const fallen = v0 * T.burnT * (k - 0.5 * k * k);
    b.x = b.lzX; b.z = b.lzZ; b.y = b.lzY + T.burnH - fallen;
    b.g.position.set(b.x, b.y, b.z);
    b.g.quaternion.set(0, 0, 0, 1);
    b.flame.visible = true;
    const s = 0.7 + 0.5 * (1 - k);
    b.flame.scale.set(s, s, s);
    lsLegs(b, smoothstep(T.burnT - T.legsT, T.burnT - 0.4, b.t));
    if (k >= 1) lsLand(b);
  } else if (b.mode === "sink") {
    b.t += dt;
    b.g.position.y = b.lzY - smoothstep(0, T.restack, b.t) * 70;
    if (b.t >= T.restack) { b.mode = "spare"; b.g.visible = false; }
  }
  if (b.mode !== "stack" && b.mode !== "spare") {
    lsV.set(0, 1, 0).applyQuaternion(b.g.quaternion);
    b.tiltDeg = Math.acos(clamp(lsV.y, -1, 1)) / DEG;
  }
}

function lsLand(b) {
  b.mode = "landed"; b.landed = true; b.flame.visible = false;
  b.y = b.lzY; b.g.position.y = b.lzY;
  lsLegs(b, 1);
  lsV.set(0, 1, 0).applyQuaternion(b.g.quaternion);
  b.tiltDeg = Math.acos(clamp(lsV.y, -1, 1)) / DEG;
  lsite.lastLandings.push(b.tiltDeg);
  lsite.lastLandDist.push(Math.round(Math.hypot(b.x - b.lzX, b.z - b.lzZ) * 10) / 10);
  flags.lsBoosterLandings = (flags.lsBoosterLandings || 0) + 1;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    lsPuff(b.x + Math.cos(a) * 4, b.lzY + 1, b.z + Math.sin(a) * 4, Math.cos(a) * 14, 1.5, Math.sin(a) * 14, 3, 9, 2.6, 0xe6dccb);
  }
  if (lsHear() > 0) { boosterLand(); thunk(); }
}

function updateLaunchSite(dt) {
  if (!lsite.stack) return;
  const T = LSITE;
  lsite.clock += dt;
  const d = Math.hypot(state.x - T.x, state.z - T.z);
  const near = d < TUNE.fogFar * 1.45;
  lsite.g.visible = near;

  // the tower's beacon: a slow blink, hurrying through the countdown
  const rate = lsite.phase === "count" ? 6 : 1.1;
  lsite.beacon.material.opacity = Math.sin(lsite.clock * rate * Math.PI) > -0.2 ? 0.95 : 0.12;

  const ph = lsite.phase;
  if (ph === "armed") {
    for (const a of lsite.arms) a.rotation.y *= Math.exp(-dt * 1.5);
    // a wisp of vapour off the core now and then: it is fuelled and waiting
    if (near && lsRnd() < dt * 1.6) lsPuff(T.x + (lsRnd() - 0.5) * 6, lsite.padY + 40 + lsRnd() * 30, T.z + (lsRnd() - 0.5) * 6, 2, 1, 0, 1.5, 5, 2.5, 0xf7f8fa);
    if (lsAimed()) lsStart();
  } else if (ph === "count") {
    if (lsNumBusy()) {
      // the police or the picker want the numeral: stand down, the rocket waits
      countdownClear(); el.bigNum.classList.remove("sky");
      setTone("lsRoar", "sawtooth", T.roarHz, 0);
      lsite.phase = "armed";              // the arms ease back in (armed, below)
      flags.lsStandDowns = (flags.lsStandDowns || 0) + 1;
      lsUpdatePuffs(dt);
      return;
    }
    lsite.t -= dt;
    // the numeral goes up into the sky for this one: at the middle of the
    // screen it stood exactly where the rocket stands, dead ahead
    el.bigNum.classList.add("sky");
    countdownTo(lsite.t, T.count);
    // the arms swing away, and the venting thickens
    const k = smoothstep(T.count, 1.2, lsite.t);
    for (const a of lsite.arms) a.rotation.y = -k * 1.25;
    if (lsRnd() < dt * 8) lsPuff(T.x + (lsRnd() - 0.5) * 10, lsite.padY + 3, T.z + (lsRnd() - 0.5) * 30, 0, 3, 0, 3, 9, 2, 0xf7f8fa);
    const h = lsHear();
    setTone("lsRoar", "sawtooth", T.roarHz, T.roar * 0.35 * h * (1 - lsite.t / T.count));
    if (lsite.t <= 0) { countdownClear(); el.bigNum.classList.remove("sky"); lsIgnite(); }
  } else if (ph === "ignite") {
    lsite.t -= dt;
    const k = 1 - lsite.t / T.holdDown;
    lsite.coreFlame.scale.set(1, 0.3 + 0.7 * k, 1);
    for (const b of lsite.boosters) b.flame.scale.set(1, 0.3 + 0.7 * k, 1);
    lsTrenchCloud(Math.ceil(dt * 40), 0.6 + k * 0.6);
    const h = lsHear();
    setTone("lsRoar", "sawtooth", T.roarHz, T.roar * h);
    setTone("lsRoar2", "triangle", T.roarHz * 1.5, T.roar * 0.6 * h);
    if (lsite.t <= 0) {
      lsite.phase = "climb"; lsite.tt = 0; lsite.speed = 0; lsite.tilt = 0;
      lsite.flying = true; lsite.trailT = 0;
      flags.lsLiftoffs = (flags.lsLiftoffs || 0) + 1;
    }
  } else if (ph === "climb") {
    lsite.tt += dt;
    const tt = lsite.tt;
    if (lsite.flying) {
      lsite.speed += (T.accel + T.accelGain * tt) * dt;
      if (tt > T.pitchStart) lsite.tilt = Math.min(T.pitchMax * DEG, lsite.tilt + T.pitchRate * DEG * dt);
      lsite.x += Math.sin(lsite.tilt) * lsite.speed * dt;
      lsite.y += Math.cos(lsite.tilt) * lsite.speed * dt;
      lsite.alt = lsite.y - lsite.padY;
      lsite.stack.position.set(lsite.x, lsite.y, lsite.z);
      lsite.stack.rotation.z = -lsite.tilt;
      const fl = 1 + Math.min(2.2, tt * 0.12);
      lsite.coreFlame.scale.set(1 + Math.sin(lsite.clock * 40) * 0.05, fl, 1);
      // the boosters ride along until they let go
      if (!lsite.sep) for (const b of lsite.boosters) {
        lsV.set(0, 0, b.side * 6.3 * T.size);
        b.g.position.set(lsite.x + lsV.x, lsite.y, lsite.z + lsV.z);
        b.g.rotation.set(0, 0, -lsite.tilt);
        b.flame.scale.set(1, fl, 1);
      }
      if (lsite.alt < 70) lsTrenchCloud(Math.ceil(dt * 30), 1 - lsite.alt / 70);
      // the smoke column behind the climb
      lsite.trailT -= dt;
      if (lsite.trailT <= 0 && lsite.alt < T.trailTop) {
        lsite.trailT = T.trailEvery;
        lsPuff(lsite.x - Math.sin(lsite.tilt) * 20, lsite.y - Math.cos(lsite.tilt) * 20, lsite.z,
          (lsRnd() - 0.5) * 3, 0, (lsRnd() - 0.5) * 3, 4, 12 + lsRnd() * 5, T.trailLife, 0xf2f4f7);
      }
      const h = lsHear();
      const fade = clamp(1 - tt / 40, 0, 1);
      setTone("lsRoar", "sawtooth", T.roarHz, T.roar * h * fade);
      setTone("lsRoar2", "triangle", T.roarHz * 1.5, T.roar * 0.6 * h * fade);
      if (tt < T.climbShakeT) shakeAmp = Math.max(shakeAmp, T.climbShake * clamp(1 - d / T.shakeR, 0, 1) * (1 - tt / T.climbShakeT));
      if (!lsite.sep && tt >= T.sepT) lsSeparate();
      if (tt >= T.coreGone) { lsite.flying = false; lsite.stack.visible = false; }
    }
    for (const b of lsite.boosters) lsUpdateBooster(b, dt);
    // the double sonic boom, as they come down through it
    if (lsite.sep && !lsite.boomed && lsite.boosters[0].mode === "glide" && lsite.boosters[0].t > T.glideT * T.boomAt) {
      lsite.boomed = true;
      lsite.booms = [0, T.boomGap];
    }
    for (let i = lsite.booms.length - 1; i >= 0; i--) {
      lsite.booms[i] -= dt;
      if (lsite.booms[i] <= 0) { lsite.booms.splice(i, 1); if (lsHear() > 0) sonicBoom(); }
    }
    if (lsite.boosters.every(b => b.landed)) { lsite.phase = "rest"; lsite.t = T.rest; }
  } else if (ph === "rest") {
    lsite.t -= dt;
    if (lsite.flying) {   // still climbing, far off: keep it going until the restack
      lsite.speed += (T.accel + T.accelGain * lsite.tt) * dt; lsite.tt += dt;
      lsite.x += Math.sin(lsite.tilt) * lsite.speed * dt; lsite.y += Math.cos(lsite.tilt) * lsite.speed * dt;
      lsite.alt = lsite.y - lsite.padY;
      lsite.stack.position.set(lsite.x, lsite.y, lsite.z);
    }
    if (lsite.t <= 0) lsRestackBegin();
  } else if (ph === "restack") {
    lsite.t -= dt;
    const k = smoothstep(0, T.restack, T.restack - lsite.t);
    lsPlaceStack(lsite.padY - (1 - k) * (lsite.stackH + 2));
    for (const a of lsite.arms) a.rotation.y = -(1 - k) * 1.25;
    for (const b of lsite.pairs.flat()) if (b.mode === "sink") lsUpdateBooster(b, dt);
    if (lsite.t <= 0) {
      lsPlaceStack(lsite.padY);
      lsite.phase = "armed";
      flags.lsRestacks = (flags.lsRestacks || 0) + 1;
      if (lsHear() > 0) chime();
    }
  }
  // the solids go where the things are
  if (ph === "climb" || ph === "rest" || ph === "restack" || ph === "ignite") lsSolidStack();
  for (const b of lsite.pairs.flat()) lsSolidBooster(b);
  // the engine glow never shrinks to nothing: far off, it grows with distance
  // so a climbing rocket stays a bright star all the way up
  for (const [f, o] of [[lsite.coreFlame, lsite.stack], ...lsite.pairs.flat().map(b => [b.flame, b.g])]) {
    if (!f.visible) continue;
    const dc = Math.hypot(o.position.x - camera.position.x, o.position.y - camera.position.y, o.position.z - camera.position.z);
    // round, whatever the flame's own length is doing to its group
    const gs = f.userData.glowSize * Math.max(1, dc / T.glowSee);
    f.userData.glow.scale.set(gs / f.scale.x, gs / f.scale.y, 1);
  }
  if (lsite.ring.visible) {
    const t = (lsite.ring.userData.t += dt);
    const r = 10 + t * 170;
    lsite.ring.scale.set(r, r, 1);
    lsite.ring.material.opacity = 0.85 * Math.max(0, 1 - t / 1.4);
    if (t > 1.4) lsite.ring.visible = false;
  }
  lsUpdatePuffs(dt);
}

// A fresh stack rises out of the pad with the waiting pair of boosters on it;
// the pair that just landed sinks into its pads and becomes the spare.
function lsRestackBegin() {
  const T = LSITE;
  lsite.phase = "restack";
  lsite.t = T.restack;
  lsite.flying = false; lsite.sep = false; lsite.boomed = false; lsite.booms = [];
  lsite.coreFlame.visible = false;
  setTone("lsRoar", "sawtooth", T.roarHz, 0);
  setTone("lsRoar2", "triangle", T.roarHz * 1.5, 0);
  for (const b of lsite.boosters) { b.mode = "sink"; b.t = 0; }
  const next = lsite.pairs[0] === lsite.boosters ? lsite.pairs[1] : lsite.pairs[0];
  lsite.boosters = next;
  lsSeatBoosters(next);
  lsPlaceStack(lsite.padY - lsite.stackH - 2);
}

// Streamed trees and towns keep off the site (scenery.js asks).
function lsCovers(x, z, extra) {
  const T = LSITE;
  const r = T.clearR + (extra || 0);
  if ((x - T.x) * (x - T.x) + (z - T.z) * (z - T.z) < r * r) return true;
  for (const [lx, lz] of T.lz) if ((x - lx) * (x - lx) + (z - lz) * (z - lz) < (T.lzR + 30 + (extra || 0)) ** 2) return true;
  return false;
}

lsBuild();
