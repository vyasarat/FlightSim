"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE GIANT ROBOT (v218, stage 1 of 3: "it rises, he shoots it down, it rebuilds").
//
// A metal toy dinosaur as tall as a skyscraper rises out of the sea off New York and wades
// slowly up and down the coast. The plane's and the helicopter's missiles knock its armour
// plates off with sparks and a clang, and it staggers (unless he is inside its sweep: below);
// three glowing weak spots (the chest core, the wind-up key on its back, the gem on its head)
// take three plates at once. Damage is plates gone and lamps going out -- nothing else, no bar,
// no numeral. When the last plate goes it topples on to its side into the sea, all its lights
// out: a splash, fireworks, a victory horn; the pieces sink. After TUNE.titan.rebuild seconds it
// rises again whole.
//
// RULES THIS FILE KEEPS (titan_checks.js measures each)
//   * A machine. Balls, cylinders and boxes, bright toy colours, big round eyes, a scoop for a
//     jaw (no teeth), a wind-up key. Nothing rides it; nothing living is in it.
//   * Never on the city, never in a corridor: its path (TUNE.titan.path) is sea at least 6 m deep
//     at every sample, outside inCorridor(.., 300) at every yaw, 150 m or more from the droneship
//     and the net boat, 2.5 km or more from New York's city.
//   * An event-pool member ("coast", standing), its rebuild clock the pool's. Fly away beyond
//     watchR and it stops watching him and goes back to wading. It never starts to rise with him
//     nearer than clearR, and while it rises or falls nothing of it is solid.
//   * HOW THE PARENT'S TWO REQUIREMENTS MEET -- proposed to him, not his words. QUEUE.md TOP asks for
//     both "registered in the event pool" and "solid in the one registry"; the pool's events make
//     nothing solid. Proposed: it is solid only while up and drawn, and only where a wall blocks
//     nothing -- every live solid of it in sea 6 m deep or more, outside inCorridor(.., 300) (the road
//     corridor and the runway with its approach and climb-out), 150 m or more from the droneship and the
//     net boat; take-off, landing and the picker at New York work with it up (event_pool_checks,
//     titan_checks).
//   * Solid in the ONE registry (kind "robot"): capsules that follow its parts. Flown into, it is the
//     one wall law's bang and free reassembly (collision.js / flight.js, unchanged): measured, one bang,
//     back within 80 m of where it happened, outside it, and no second bang in 20 s hands-off. It
//     holds still while he is in pieces and for `grace` after, and it NEVER MOVES A SOLID WHILE HE IS
//     NEAR: within sweepR of any part's surface nothing that carries a solid moves -- no turn, step,
//     breath, tail swish, key turn or head turn (they run on `mclock`, which stops), and a hit's
//     stagger is skipped (its lamps blink instead).
//   * Rising and falling it is not solid, but a missile at what he can see of it (above the water) is
//     never let through: it glances off with sparks and a clank (tnShrug) and takes nothing.
//   * Pointing, not timing: a missile fired at it bends on to it (the meteor rule, events.js) -- to a
//     weak spot when its line passes within weakLock of one; a missile fired away from it (outside
//     lockDot) is left alone.
//   * STAGE 1 NEVER ATTACKS. It turns to face him and its eyes follow; nothing is thrown, swept or
//     fired. (Stage 2 can hang its attacks off tnStandDown and titan.calm.)
//   * One-shot sounds only: no setTone, so nothing of it can drone on after he leaves.
//   * Its own random stream (tnRnd); every three.js object it uses made at load inside vkQuiet, none
//     after (a whole cycle draws nothing from Math.random but its sounds' noise, audio.js's own).
//   * Hidden and not solid in dad mode (dadHideHis calls tnHide); stood down (tnStandDown, the hook
//     named) on a fresh start, a change of vehicle and an eject.
//   * The flat palette: unlit, shaded once at build (tnShade); never painted. Its weak spots are
//     unshaded lenses with pulsing glows; a lamp out is a dark stud; a plate gone shows its dark socket.
//   * He cannot miss it from the New York runway: the sea boils and it roars before it comes up; its
//     eyes, lamps and weak-spot glows are fog-free; and while it is rising or up and off his screen, he
//     in the plane or helicopter within arrowR (not on an engaged approach, not behind the cards, in the
//     rescue or dad mode) an edge arrow (#titanArrow: its head, button-sized, taking no taps) points to
//     it from the screen's edge above the dash -- or the clear place nearest that, never on a control,
//     the dials or the home arrow.
// ---------------------------------------------------------------------------
const TITAN = TUNE.titan;

const TN_SEED = 0x7177A;
let tnSeed = TN_SEED;
function tnRnd() { tnSeed = (tnSeed * 1664525 + 1013904223) >>> 0; return tnSeed / 4294967296; }

const titan = {
  built: false,
  phase: "sea",            // sea | rising | up | fall | down
  t: 0, clock: 0, mclock: 0, blinkT: 0,   // mclock: the clock its solid-carrying motions run on (held while he is near)
  x: 0, z: 0, y: 0, yaw: 0, seg: 1,  // where it stands, which way it faces, which end of the path it wades to
  points: 0, stagger: 0, staggerDir: 1, staggerSide: 1, segDir: 1, walk: 0,
  calm: 0, hold: false,    // calm: seconds it keeps still after a bang near it; hold: the harness's freeze
  watching: false, facing: false,
  step: 0, stepSide: 0, steamT: 0, roarT: 0,
  headYaw: 0, headPitch: 0, jaw: 0, roarJaw: 0,
  fallDir: -1, fallT: 0, splashed: false, fireT: 0, fires: 0, horned: false,
  g: null, parts: {}, recs: [], plates: [], lamps: [], weak: [], eyes: [],
  platesMesh: null, debris: [], debrisMesh: null, sparks: [], sparkPts: null, puffs: [], puffPts: null,
  member: null, arrowOn: false,
};

// ---- building -------------------------------------------------------------
// One mesh per moving part, vertex-coloured, one shared self-lit material: a part is one draw.
function tnKit() {
  const parts = [];
  return {
    add(color, geo, x, y, z, rx, ry, rz, sx, sy, sz) {
      const o = new THREE.Object3D();
      o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0);
      o.scale.set(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz);
      parts.push({ color, geo, obj: o });
    },
    // a lens: the palette colour itself, never shaded -- the weak spots and the key are the brightest things on it
    lit(color, geo, x, y, z, rx, ry, rz, sx, sy, sz) { this.add(color, geo, x, y, z, rx, ry, rz, sx, sy, sz); parts[parts.length - 1].lit = true; },
    // which: "lit" (the lenses only), "unlit" (all but), or everything
    build(mat, which) {
      const pos = [], nor = [], col = [];
      const v = new THREE.Vector3(), n = new THREE.Vector3(), n3 = new THREE.Matrix3(), c = new THREE.Color();
      for (const p of parts) {
        if ((which === "lit" && !p.lit) || (which === "unlit" && p.lit)) continue;
        const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
        p.obj.updateMatrix();
        n3.getNormalMatrix(p.obj.matrix);
        c.setHex(p.color);
        const P = g.attributes.position, N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(p.obj.matrix); pos.push(v.x, v.y, v.z);
          n.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.push(n.x, n.y, n.z);
          const k = p.lit ? 1 : tnShade(n.x, n.y, n.z);
          col.push(c.r * k, c.g * k, c.b * k);
        }
        g.dispose(); if (g !== p.geo) p.geo.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      out.computeBoundingSphere();
      const m = new THREE.Mesh(out, mat);
      m.castShadow = false; m.receiveShadow = false;
      return m;
    },
  };
}
// The flat palette: the colour, shaded once at build from a fixed light in the part's own frame (unlit
// MeshBasic at run time). Lit by the scene, the hemisphere's green ground turned its silver a mottled grey-green.
function tnShade(nx, ny, nz) {
  const L = TITAN.shadeDir, l = Math.hypot(L[0], L[1], L[2]);
  return clamp(TITAN.shadeLo + (1 - TITAN.shadeLo) * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / l) + TITAN.shadeUp * ny, 0, 1);
}
const tnBall = (seg) => new THREE.SphereGeometry(1, seg || 14, Math.max(6, Math.round((seg || 14) * 0.7)));
const tnCyl = (r0, r1, h, seg) => new THREE.CylinderGeometry(r0, r1, h, seg || 12);

// a cylinder from a to b (local points), radius r0 at a and r1 at b
function tnLimb(k, color, a, b, r0, r1, seg) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const geo = tnCyl(r1, r0, L, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
  const e = new THREE.Euler().setFromQuaternion(q);
  k.add(color, geo, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, e.x, e.y, e.z);
}
// a point on an ellipsoid (centre c, radii r) along a direction, and its normal
function tnOnEgg(c, r, d) {
  const l = Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = [c[0] + d[0] / l, c[1] + d[1] / l, c[2] + d[2] / l];
  const nx = (p[0] - c[0]) / (r[0] * r[0]), ny = (p[1] - c[1]) / (r[1] * r[1]), nz = (p[2] - c[2]) / (r[2] * r[2]);
  const nl = Math.hypot(nx, ny, nz);
  return { p, n: [nx / nl, ny / nl, nz / nl] };
}

function tnBuild() {
  const P = TUNE.palette, T = TITAN;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  // the lenses (weak spots, the key) on a material of their own: its colour dims them all at once when it falls
  const lensMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  titan.lensMat = lensMat;
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  root.userData.name = "titan";
  const parts = titan.parts;
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ---- the legs: pivots at the hips, feet under the water
  for (const side of [-1, 1]) {
    const lg = grp(root, side * 14, 48, 0);
    const k = tnKit();
    k.add(P.steel, tnBall(), 0, -10, 2, 0, 0, 0, 10.5, 15, 12);                 // the thigh
    k.add(P.slate, tnBall(10), 0, -24, 4, 0, 0, 0, 7.5);                        // the knee
    tnLimb(k, P.steel, [0, -24, 4], [0, -48, 0], 7, 6.5);                       // the shin
    k.add(P.slate, tnCyl(7.5, 7.5, 3, 12), 0, -40, 0.5);                        // a piston ring
    k.add(P.grey, new THREE.BoxGeometry(14, 7, 22), 0, -53, 4);                 // the foot
    for (const tx of [-4.5, 0, 4.5]) k.add(P.white, tnBall(8), tx, -54, 15, 0, 0, 0, 2.6);
    const m = k.build(mat); lg.add(m);
    parts["leg" + (side < 0 ? "L" : "R")] = lg;
  }
  // ---- the body: an egg, a white belly, little arms, the vents and the key
  const body = grp(root, 0, 52, 0);
  parts.body = body;
  {
    const k = tnKit();
    k.add(P.steel, tnBall(18), 0, 16, 0, 0, 0, 0, 21, 22, 32);
    k.add(P.white, tnBall(16), 0, 10, 12, 0, 0, 0, 16, 18, 22);                 // the belly
    k.add(P.steel, tnBall(14), 0, 24, 18, 0, 0, 0, 17, 17, 16);                 // the chest
    k.add(P.slate, tnCyl(8.6, 8.6, 2.4, 20), 0, 20, 33.4, Math.PI / 2, 0, 0);   // the core's rim
    k.lit(P.cyan, tnCyl(7, 7, 1.4, 20), 0, 20, 34.4, Math.PI / 2, 0, 0);       // the core: a weak spot, a lens of light
    for (const side of [-1, 1]) {
      tnLimb(k, P.steel, [side * 15, 18, 26], [side * 17, 10, 36], 4.2, 3.6, 10);   // little arms, toy-sized
      k.add(P.slate, tnBall(8), side * 15, 18, 26, 0, 0, 0, 5);
      k.add(P.white, tnBall(8), side * 17.5, 9, 37.5, 0, 0, 0, 4);               // round mitten hands
      k.add(P.slate, tnCyl(3, 3.4, 10, 10), side * 7, 38, -10);                 // the steam vents
      k.add(P.red, tnCyl(3.8, 3.8, 1.6, 10), side * 7, 43.4, -10);
    }
    for (let i = 0; i < 5; i++) k.add(P.warning, tnBall(10), 0, 37 - i * 1.6, 14 - i * 9, 0, 0, 0, 3.4, 3, 4);   // round spine bumps
    k.add(P.slate, tnCyl(2, 2, 12, 10), 0, 36, -18, -0.5, 0, 0);               // the key's shaft
    for (const [rx, ry, rz] of [[0, 0, 0]]) k.add(P.slate, tnCyl(3.2, 3.2, 2, 12), 0 + rx, 34 + ry, -16 + rz, -0.5, 0, 0);
    body.add(k.build(mat, "unlit")); body.add(k.build(lensMat, "lit"));
  }
  // the wind-up key turns: a part of its own
  const key = grp(body, 0, 41.5, -21);
  key.rotation.x = -0.5;
  parts.key = key;
  {
    const k = tnKit();
    // one solid paddle, no holes: two rings side by side read as "00" side-on, and nothing on it may look like a glyph
    k.lit(P.warning, tnBall(14), 0, 5, 0, 0, 0, 0, 10, 5.2, 1.8);
    k.lit(P.gold, tnBall(10), 0, 1.5, 0, 0, 0, 0, 2.8);
    key.add(k.build(lensMat));
  }
  // ---- the head on its neck: round, big eyes, a scoop of a jaw, an antenna
  const head = grp(body, 0, 36, 26);
  parts.head = head;
  {
    const k = tnKit();
    tnLimb(k, P.steel, [0, -8, -4], [0, 24, 6], 10.5, 9, 14);
    k.add(P.slate, tnCyl(10.8, 10.8, 2.4, 14), 0, 4, 0, 0.3, 0, 0);
    k.add(P.slate, tnCyl(10.2, 10.2, 2.4, 14), 0, 13, 3, 0.3, 0, 0);
    k.add(P.steel, tnBall(18), 0, 34, 12, 0, 0, 0, 15, 13, 19);                 // the head
    k.add(P.steel, tnBall(14), 0, 30, 27, 0, 0, 0, 11, 8, 11);                  // the snout
    for (const side of [-1, 1]) {
      k.add(P.white, tnBall(14), side * 8.6, 38.5, 24.5, 0, 0, 0, 6.6);         // big round eyes
      k.add(P.ink, tnBall(10), side * 9.6, 38.8, 30.2, 0, 0, 0, 3.4);           // ... their pupils
      k.add(P.ink, tnBall(8), side * 3.6, 32.5, 37.6, 0, 0, 0, 1.3);            // nostrils
      k.add(P.slate, tnBall(8), side * 13.6, 33, 6, 0, 0, 0, 3.2, 3.2, 1.6);     // bolts at the hinge
    }
    tnLimb(k, P.slate, [0, 45, 4], [0, 59, 1], 0.9, 0.7, 8);                    // the antenna
    k.add(P.warning, tnBall(10), 0, 60, 1, 0, 0, 0, 2.4);
    k.lit(P.green, tnBall(10), 0, 46.5, 12, 0, 0, 0, 3.8, 2.6, 3.8);           // the crest gem: a weak spot
    head.add(k.build(mat, "unlit")); head.add(k.build(lensMat, "lit"));
  }
  const jaw = grp(head, 0, 27, 14);
  parts.jaw = jaw;
  {
    const k = tnKit();
    k.add(P.white, tnBall(14), 0, -3, 11, 0, 0, 0, 10, 4.4, 13);
    k.add(P.red, tnBall(10), 0, -1.6, 12, 0, 0, 0, 7, 2.2, 9.5);                // a red toy mouth, no teeth
    jaw.add(k.build(mat));
  }
  // ---- the tail
  const tail = grp(body, 0, 8, -26);
  parts.tail = tail;
  {
    const k = tnKit();
    const A = TITAN.tailPts;
    for (let i = 0; i < A.length - 1; i++) {
      tnLimb(k, P.steel, A[i], A[i + 1], TITAN.tailR[i], TITAN.tailR[i + 1], 12);
      k.add(P.slate, tnBall(10), A[i + 1][0], A[i + 1][1], A[i + 1][2], 0, 0, 0, TITAN.tailR[i + 1] + 0.6);
    }
    k.add(P.warning, tnBall(10), A[A.length - 1][0], A[A.length - 1][1] + 1, A[A.length - 1][2] - 2, 0, 0, 0, 4.5);
    tail.add(k.build(mat));
  }
  scene.add(root);
  titan.g = root;
  root.visible = false;

  // ---- the armour plates: one instanced mesh, world-space, each plate riding its part
  const PL = [];
  const plate = (part, region, p, n, w, h) => PL.push({ part, region, p, n, w, h });
  for (const side of [-1, 1]) {
    const L = side < 0 ? "legL" : "legR";
    let e = tnOnEgg([0, -10, 2], [10.5, 15, 12], [side, 0.1, 0.1]); plate(L, "legs", e.p, e.n, 11, 13);
    e = tnOnEgg([0, -10, 2], [10.5, 15, 12], [0, 0.15, 1]); plate(L, "legs", e.p, e.n, 10, 12);
    plate(L, "legs", [0, -33, 8.4], [0, 0.1, 1], 8, 10);
    plate(L, "legs", [side * 7.6, -34, 2], [side, 0, 0.1], 7, 10);
  }
  for (const side of [-1, 1]) {
    for (const [dy, dz] of [[0.3, 0.35], [0.1, -0.2], [-0.25, 0.15]]) { const e = tnOnEgg([0, 16, 0], [21, 22, 32], [side, dy, dz]); plate("body", "body", e.p, e.n, 13, 13); }
    { const e = tnOnEgg([0, 16, 0], [21, 22, 32], [side * 0.45, 1, -0.55]); plate("body", "body", e.p, e.n, 11, 11); }
    { const e = tnOnEgg([0, 16, 0], [21, 22, 32], [side * 0.55, -0.6, -0.5]); plate("body", "body", e.p, e.n, 10, 10); }
  }
  { const e = tnOnEgg([0, 24, 18], [17, 17, 16], [0, 0.9, 0.5]); plate("body", "body", e.p, e.n, 12, 10); }
  for (const side of [-1, 1]) {
    let e = tnOnEgg([0, 34, 12], [15, 13, 19], [side, -0.25, 0.15]); plate("head", "head", e.p, e.n, 10, 9);
    e = tnOnEgg([0, 34, 12], [15, 13, 19], [side * 0.6, 0.55, -0.6]); plate("head", "head", e.p, e.n, 9, 9);
  }
  { const e = tnOnEgg([0, 30, 27], [11, 8, 11], [0, 1, 0.45]); plate("head", "head", e.p, e.n, 9, 8); }
  for (const side of [-1, 1]) for (const t of [0.2, 0.45, 0.72]) {
    const A = TITAN.tailPts, s = t * (A.length - 1), i = Math.min(A.length - 2, Math.floor(s)), f = s - i;
    const c = [lerp(A[i][0], A[i + 1][0], f), lerp(A[i][1], A[i + 1][1], f), lerp(A[i][2], A[i + 1][2], f)];
    const r = lerp(TITAN.tailR[i], TITAN.tailR[i + 1], f);
    plate("tail", "tail", [c[0] + side * (r + 0.4), c[1] + 1, c[2]], [side, 0.25, 0], Math.max(5, r * 1.5), Math.max(5, r * 1.6));
  }
  titan.plates = PL.map((q, i) => {
    const o = new THREE.Object3D();
    o.position.set(q.p[0], q.p[1], q.p[2]);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(q.n[0], q.n[1], q.n[2]));
    o.scale.set(q.w, q.h, 1.6);
    o.updateMatrix();
    // under each plate its socket: the dark frame and gear that show where a plate has gone
    const so = new THREE.Object3D();
    so.position.set(q.p[0] - q.n[0] * 0.5, q.p[1] - q.n[1] * 0.5, q.p[2] - q.n[2] * 0.5); so.quaternion.copy(o.quaternion);
    so.scale.set(q.w * 0.92, q.h * 0.92, 1.2); so.updateMatrix();
    return { part: q.part, region: q.region, local: o.matrix.clone(), socket: so.matrix.clone(), on: true, color: TITAN.plateColors[i % TITAN.plateColors.length], size: [q.w, q.h], world: new THREE.Matrix4() };
  });
  // a box, its faces shaded once (the flat palette, as the parts): the instance colour is the plate's
  const shadedBox = () => {
    const b = new THREE.BoxGeometry(1, 1, 1), N = b.attributes.normal, col = [];
    for (let i = 0; i < N.count; i++) { const k = tnShade(N.getX(i), N.getY(i), N.getZ(i)); col.push(k, k, k); }
    b.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return b;
  };
  const basic = () => new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  const pg = shadedBox();
  const pm = new THREE.InstancedMesh(pg, basic(), titan.plates.length);
  const cc = new THREE.Color();
  titan.plates.forEach((p, i) => { pm.setColorAt(i, cc.setHex(TUNE.palette[p.color])); });
  pm.castShadow = false; pm.receiveShadow = false;
  pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TITAN.poolR);    // a sphere round the robot, moved with it
  scene.add(pm);
  titan.platesMesh = pm;
  const sg = shadedBox();
  const sm = new THREE.InstancedMesh(sg, basic(), titan.plates.length);
  titan.plates.forEach((p, i) => { sm.setColorAt(i, cc.setHex(i % 2 ? TUNE.palette.slate : TUNE.palette.ink)); });
  sm.castShadow = false; sm.receiveShadow = false;
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TITAN.poolR);
  scene.add(sm);
  titan.socketsMesh = sm;

  // ---- debris: plates knocked off, chunks of the fall -- one instanced box
  const dg = shadedBox();
  const dm = new THREE.InstancedMesh(dg, basic(), TITAN.debris);
  for (let i = 0; i < TITAN.debris; i++) { dm.setColorAt(i, cc.setHex(TUNE.palette.steel)); titan.debris.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, wx: 0, wy: 0 }); }
  dm.castShadow = false;
  dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TITAN.poolR);
  dm.count = 0;
  scene.add(dm);
  titan.debrisMesh = dm;

  // ---- lamps: one Points draw, each lamp its own colour, out as the plates go
  const LP = [];
  const lamp = (part, p, color) => LP.push({ part, p, color });
  for (let i = 0; i < 8; i++) { const e = tnOnEgg([0, 16, 0], [21, 22, 32], [(i % 2 ? 1 : -1) * 0.5, 1, 0.75 - i * 0.2]); lamp("body", [e.p[0] + e.n[0], e.p[1] + e.n[1], e.p[2] + e.n[2]], i % 2 ? "cyan" : "warning"); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lamp("body", [Math.cos(a) * 10.5, 20 + Math.sin(a) * 10.5, 34.2], i % 2 ? "green" : "cyan"); }
  for (let i = 0; i < 6; i++) { const A = TITAN.tailPts, j = Math.min(A.length - 1, 1 + Math.floor(i / 2)), f = (i % 2) * 0.5; const p = A[j - 1], q = A[j]; lamp("tail", [0, lerp(p[1], q[1], f) + TITAN.tailR[j] + 1, lerp(p[2], q[2], f)], i % 2 ? "red" : "warning"); }
  for (const L of ["legL", "legR"]) { lamp(L, [0, -24, 12], "green"); lamp(L, [0, -46, 7.5], "red"); }
  for (const side of [-1, 1]) lamp("head", [side * 15.6, 30, 8], "cyan");
  lamp("head", [0, 47.5, 8], "warning");
  lamp("key", [0, 2, 0], "fire");
  for (const side of [-1, 1]) lamp("body", [side * 7, 45, -10], "red");
  titan.lamps = LP.slice(0, TITAN.lamps).map(q => ({ part: q.part, p: new THREE.Vector3(q.p[0], q.p[1], q.p[2]), color: new THREE.Color(TUNE.palette[q.color]), on: true }));
  titan.lampOff = new THREE.Color(TITAN.lampOff);
  {
    const n = titan.lamps.length, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TITAN.poolR);
    // plain blending, not additive: a yellow lamp added to a silver robot in daylight is white, and its going out
    // could not be seen. Plain, a lit lamp is its colour and a dead one is a dark stud.
    const lm = new THREE.Points(geo, new THREE.PointsMaterial({ map: fbStarTex(), size: TITAN.lampSize, sizeAttenuation: true, vertexColors: true,
      transparent: true, alphaTest: 0.05, depthWrite: false, fog: false }));
    scene.add(lm);
    titan.lampPts = lm;
  }

  // ---- the eyes and the weak spots: glows, fog-free, never painted
  for (const side of [-1, 1]) {
    const s = glowSprite(TITAN.eyeColor, TITAN.eyeSize, 0.95); s.visible = false; scene.add(s);
    titan.eyes.push({ s, part: "head", p: new THREE.Vector3(side * 9.6, 38.8, 32.5) });
  }
  for (const w of TITAN.weak) {
    const s = glowSprite(w.color, w.size, TITAN.weakOpacity); s.visible = false; scene.add(s);
    s.material.blending = THREE.NormalBlending;   // its colour, not white, against a silver body in daylight
    titan.weak.push({ name: w.name, region: w.region, part: w.part, p: new THREE.Vector3(w.at[0], w.at[1], w.at[2]), s, world: new THREE.Vector3() });
  }

  // ---- sparks and fireworks: one additive Points; steam and splash: one soft white Points
  // sparks and fireworks: a hard-edged star, PLAIN blending (the barge's rule, fireworksbarge.js: on a
  // daytime sky adding light only ever makes white); steam and spray: the soft glow, plain white
  const starTex = fbStarTex();
  const pts = (n, size, additive) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TITAN.poolR);
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: additive ? starTex : glowTex, size, sizeAttenuation: true, vertexColors: true, transparent: true,
      alphaTest: additive ? 0.05 : 0, blending: THREE.NormalBlending, depthWrite: false, fog: !additive, opacity: additive ? 1 : TITAN.puffOpacity }));
    scene.add(m);
    return m;
  };
  titan.sparkPts = pts(TITAN.sparks, TITAN.sparkSize, true);
  for (let i = 0; i < TITAN.sparks; i++) titan.sparks.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, grav: 0, drag: 0, shell: 0 });
  titan.puffPts = pts(TITAN.puffs, TITAN.puffSize, false);
  for (let i = 0; i < TITAN.puffs; i++) titan.puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grav: 0 });
  titan.sparkCursor = 0; titan.puffCursor = 0; titan.debrisCursor = 0;
  tnObj = new THREE.Object3D();

  // ---- the solids: one capsule per part, following it, in a region of their own
  const R = solidRegionOpen("titan");
  for (const c of TITAN.solids) {
    const proxy = new THREE.Object3D();
    proxy.visible = false;
    proxy.userData.noShatter = true;
    const rec = solidCapsule([0, -1e4, 0], [0, -1e4, 0], c.r, "robot");
    rec.mesh = proxy; rec.tn = c.region; rec.tnPart = c.part;
    rec.tnA = new THREE.Vector3(c.a[0], c.a[1], c.a[2]); rec.tnB = new THREE.Vector3(c.b[0], c.b[1], c.b[2]);
    titan.recs.push(rec);
  }
  solidRegionClose(R);
  // the records move: the region's box is the whole path and every way it can face
  const xs = TITAN.path.map(p => p[0]), zs = TITAN.path.map(p => p[1]);
  R.x0 = Math.min(...xs) - TITAN.reach - 20; R.x1 = Math.max(...xs) + TITAN.reach + 20;
  R.z0 = Math.min(...zs) - TITAN.reach - 20; R.z1 = Math.max(...zs) + TITAN.reach + 20;
  titan.region = R;

  titan.built = true;
  tnReset();
}

// ---- state ----------------------------------------------------------------
function tnPointsMax() { return titan.plates.length; }
function tnReset() {
  if (!titan.built) return;
  tnSeed = TN_SEED;
  const T = TITAN;
  titan.phase = "sea"; titan.t = 0;
  const h = T.path[T.home];
  titan.x = h[0]; titan.z = h[1]; titan.yaw = T.homeYaw * DEG; titan.seg = T.home + 1 < T.path.length ? T.home + 1 : T.home - 1; titan.segDir = titan.seg > T.home ? 1 : -1;
  titan.y = seaLevelAt(titan.x, titan.z);
  titan.stagger = 0; titan.calm = 0; titan.watching = false; titan.facing = false; titan.near = false; titan.leakT = 0; titan.foamT = 0;
  titan.headYaw = 0; titan.headPitch = 0; titan.jaw = 0; titan.roarJaw = 0;
  titan.walk = 0; titan.step = 0; titan.fallT = 0; titan.splashed = false; titan.steamT = 0; titan.roarT = 0;
  tnRepair();
  for (const d of titan.debris) d.life = 0;
  for (const s of titan.sparks) s.life = 0;
  for (const p of titan.puffs) p.life = 0;
  if (titan.member) titan.member.state.next = 0;
  tnPose(0);
  tnSolidOn(false);
  tnShow(false);
}
function tnRepair() {
  titan.points = tnPointsMax();
  for (const p of titan.plates) p.on = true;
  for (const l of titan.lamps) l.on = true;
  const P = titan.parts;
  for (const k in P) { P[k].userData.off = null; }
}
function tnUp() { return titan.phase === "up"; }
function tnStanding() { return titan.phase === "rising" || titan.phase === "up" || titan.phase === "fall"; }
function tnPlatesGone() { return titan.plates.filter(p => !p.on).length; }
function tnLampsLit() { return titan.lamps.filter(l => l.on).length; }

// on: it is there to be seen; body: and near enough that its body is not lost in the fog (past meshR only
// its fog-free lights are drawn -- the body would be the fog's own colour -- and it is not solid there)
function tnShow(on, body) {
  if (body === undefined) body = on;
  titan.g.visible = on && body;
  titan.platesMesh.visible = on && body && titan.phase !== "down";
  titan.socketsMesh.visible = on && body;
  titan.lampPts.visible = on;
  for (const e of titan.eyes) e.s.visible = on && e.lit;
  for (const w of titan.weak) w.s.visible = on && titan.phase === "up";
}
function tnSolidOn(on) {
  titan.solid = on;
  for (const r of titan.recs) r.mesh.visible = on;
}

// The harness's doors, and dad mode's.
function tnForce(what) {
  if (!titan.built) return;
  if (what === "up") { tnReset(); titan.phase = "up"; titan.t = 0; flags.tnRises = (flags.tnRises || 0) + 1; return; }
  if (what === "fall") {
    // (the harness's and the renders' door: every plate and lamp goes as it would have, one hit at a time)
    if (titan.phase === "up") { titan.points = 0; for (const p of titan.plates) p.on = false; for (const l of titan.lamps) l.on = false; tnStartFall(); }
    return;
  }
  // the pool's door: make it rise now (wherever he is), or, in pieces, rebuild now
  if (titan.member) titan.member.state.next = 0;
  if (titan.phase === "sea" || titan.phase === "down") tnStartRise();
}
function tnHide() {
  if (!titan.built) return;
  tnShow(false);
  tnSolidOn(false);
  titan.sparkPts.visible = false; titan.puffPts.visible = false; titan.debrisMesh.visible = false;
  tnArrow(false);
}
// Whatever it was doing to him, it stops: a fresh start, an eject. (Stage 1 has no attack to cancel;
// it forgets him, and keeps still for a moment.)
function tnStandDown(why) {
  if (!titan.built) return;
  titan.watching = false; titan.facing = false;
  titan.calm = Math.max(titan.calm, TITAN.grace);
  titan.lastStandDown = why || "other";
  tnArrow(false);
  flags.tnStandDowns = (flags.tnStandDowns || 0) + 1;
  const k = "tnStandDown_" + titan.lastStandDown; flags[k] = (flags[k] || 0) + 1;
}

// ---- sound: one-shots, by distance --------------------------------------
function tnHear() {
  const c = typeof camera !== "undefined" ? camera.position : state;
  return clamp(1 - Math.hypot(c.x - titan.x, c.y - titan.y - TITAN.hearY, c.z - titan.z) / TITAN.hearR, 0, 1);
}
function tnSound(kind) {
  const h = tnHear();
  if (h <= 0) return false;
  const g = TITAN.gain * h;
  if (kind === "roar") {
    // a toy horn growl: two honks and a rattle, not a scream
    synthBlip("sawtooth", 196, 150, 0.7, 0.2 * g, 0); synthBlip("square", 294, 220, 0.6, 0.07 * g, 0.03);
    synthBlip("sawtooth", 150, 247, 0.9, 0.2 * g, 0.6); synthBlip("square", 220, 330, 0.8, 0.06 * g, 0.62);
    noiseBurst(1.1, 420, 0.1 * g, 0.1);
  } else if (kind === "stomp") {
    synthBlip("sine", 72, 34, 0.45, 0.34 * g, 0); noiseBurst(0.3, 260, 0.14 * g, 0);
  } else if (kind === "steam") {
    noiseBurst(0.6, 3200, 0.05 * g, 0);
  } else if (kind === "clang") {
    synthBlip("square", 880, 520, 0.24, 0.17 * g, 0); synthBlip("triangle", 1320, 990, 0.4, 0.12 * g, 0.02); noiseBurst(0.2, 2600, 0.18 * g, 0);
  } else if (kind === "big") {
    synthBlip("square", 660, 330, 0.4, 0.2 * g, 0); synthBlip("triangle", 990, 495, 0.6, 0.15 * g, 0.03); noiseBurst(0.35, 1800, 0.25 * g, 0);
  } else if (kind === "weak") {
    // a weak spot: a bright bell-chime up and a bigger clang
    [[660, 0], [880, 0.08], [1320, 0.16]].forEach(([f, t]) => synthBlip("triangle", f, f * 1.5, 0.35, 0.18 * g, t));
    synthBlip("square", 520, 260, 0.5, 0.2 * g, 0); noiseBurst(0.45, 1400, 0.28 * g, 0);
  } else if (kind === "splash") {
    noiseBurst(1.8, 520, 0.6 * g, 0); synthBlip("sine", 60, 28, 1.3, 0.5 * g, 0); noiseBurst(1.2, 1600, 0.2 * g, 0.4);
  } else if (kind === "horn") {
    // the victory horn: a bright fanfare
    [[392, 0], [523, 0.18], [659, 0.36], [784, 0.54], [1047, 0.8]].forEach(([f, t]) => {
      synthBlip("triangle", f, f, t < 0.7 ? 0.2 : 0.9, 0.24 * g, t); synthBlip("square", f, f, t < 0.7 ? 0.18 : 0.8, 0.05 * g, t);
    });
    if (typeof cheer === "function" && h > 0.2) cheer();
  } else if (kind === "boom") {
    noiseBurst(0.45, 200, 0.4 * g, 0); synthBlip("sine", 85, 38, 0.5, 0.25 * g, 0); noiseBurst(0.9, 2600, 0.1 * g, 0.22);
  } else if (kind === "click") {
    synthBlip("square", 1400, 1400, 0.05, 0.08 * g, 0);
  }
  return true;
}

// ---- the pools --------------------------------------------------------------
function tnSpark(x, y, z, vx, vy, vz, life, color, grav, drag) {
  const P = titan.sparks;
  let p = null;
  for (let n = 0; n < 48; n++) {
    const q = P[titan.sparkCursor]; titan.sparkCursor = (titan.sparkCursor + 1) % P.length;
    if (q.life <= 0) { p = q; break; }
    if (!p || q.life < p.life) p = q;
  }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life;
  p.r = ((color >> 16) & 255) / 255; p.g = ((color >> 8) & 255) / 255; p.b = (color & 255) / 255;
  p.grav = grav === undefined ? 9.8 : grav; p.drag = drag || 0; p.shell = 0;
  return p;
}
function tnPuff(x, y, z, vx, vy, vz, life, grav) {
  const P = titan.puffs;
  let p = null;
  for (let n = 0; n < 48; n++) {
    const q = P[titan.puffCursor]; titan.puffCursor = (titan.puffCursor + 1) % P.length;
    if (q.life <= 0) { p = q; break; }
    if (!p || q.life < p.life) p = q;
  }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.grav = grav || 0;
  return p;
}
function tnDebris(x, y, z, vx, vy, vz, sx, sy, sz, color, life) {
  const D = titan.debris;
  let d = D.find(q => q.life <= 0);
  if (!d) { d = D[titan.debrisCursor]; titan.debrisCursor = (titan.debrisCursor + 1) % D.length; }
  d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.sx = sx; d.sy = sy; d.sz = sz; d.life = life || 6;
  d.rx = tnRnd() * 6; d.ry = tnRnd() * 6; d.rz = 0; d.wx = (tnRnd() - 0.5) * 5; d.wy = (tnRnd() - 0.5) * 5;
  d.color = color;
  return d;
}
const tnColor = new THREE.Color();
function tnSplashRing(x, z, n, speed, up, life) {
  const y = seaLevelAt(x, z);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + tnRnd() * 0.3, v = speed * (0.6 + tnRnd() * 0.6);
    tnPuff(x + Math.cos(a) * 3, y + 1, z + Math.sin(a) * 3, Math.cos(a) * v, up * (0.6 + tnRnd() * 0.8), Math.sin(a) * v, life * (0.7 + tnRnd() * 0.5), TITAN.puffGrav);
  }
}
function tnFirework(x, y, z) {
  const T = TITAN, c1 = TUNE.palette[T.fireColors[Math.floor(tnRnd() * T.fireColors.length)]], c2 = TUNE.palette[T.fireColors[Math.floor(tnRnd() * T.fireColors.length)]];
  for (let i = 0; i < T.fireStars; i++) {
    const u = tnRnd() * 2 - 1, a = tnRnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), v = lerp(T.fireSpeed[0], T.fireSpeed[1], tnRnd());
    tnSpark(x, y, z, Math.cos(a) * r * v, u * v, Math.sin(a) * r * v, lerp(1.6, 2.4, tnRnd()), i % 2 ? c1 : c2, 4, 1.1);
  }
  flags.tnFireworks = (flags.tnFireworks || 0) + 1;
  tnSound("boom");
}

// ---- the pose: every part from the clock ------------------------------------
const tnV = new THREE.Vector3(), tnV2 = new THREE.Vector3(), tnV3 = new THREE.Vector3(), tnM = new THREE.Matrix4(), tnZero = new THREE.Matrix4().makeScale(0, 0, 0);
function tnPose(dt) {
  const T = TITAN, P = titan.parts, g = titan.g, ph = titan.phase;
  // the rise: `announce` seconds of the sea boiling over it first, then up out of it
  const rise = ph === "rising" ? clamp((titan.t - T.announce) / (T.riseTime - T.announce), 0, 1) : ph === "sea" || ph === "down" ? 0 : 1;
  const ease = 1 - Math.pow(1 - rise, 2.4);
  let y = titan.y - T.wadeDepth - (1 - ease) * T.sink;    // it wades shin-deep: the sea is at its shins
  // wading: the legs swing, the body bobs, the tail swishes
  const walk = titan.walk || 0;
  const sw = Math.sin(titan.step * Math.PI) * walk;
  // every movement that carries a solid runs on `mclock`, which stops while he is inside its sweep (updateTitan)
  P.legL.rotation.x = sw * T.legSwing * DEG; P.legR.rotation.x = -sw * T.legSwing * DEG;
  P.legL.rotation.z = 0; P.legR.rotation.z = 0;   // (the fall splays them: every pose starts from standing)
  const breathe = Math.sin(titan.mclock * 1.3) * 0.6;
  P.body.position.y = 52 + Math.abs(Math.cos(titan.step * Math.PI)) * walk * 1.6 + breathe * 0.4;
  P.tail.rotation.y = Math.sin(titan.mclock * 0.9) * T.tailSwish * DEG;
  P.tail.rotation.x = Math.sin(titan.mclock * 0.7) * 3 * DEG;
  P.key.rotation.y = titan.mclock * T.keyRate;
  // a stagger: rocked back, the head thrown
  // (not while he is inside its sweep: then a hit blinks its lamps and throws sparks, and nothing of it swings)
  // (its clock holds while he is near -- updateTitan -- so a stagger under way when he comes near holds its pose)
  const s = titan.stagger > 0 ? Math.sin((1 - titan.stagger / T.stagger) * Math.PI) : 0;
  P.body.rotation.x = -s * T.staggerDeg * DEG * titan.staggerDir + breathe * 0.4 * DEG;
  P.body.rotation.z = s * 3 * DEG * titan.staggerSide;
  P.head.rotation.order = "YXZ";
  P.head.rotation.y = titan.headYaw;
  P.head.rotation.x = -titan.headPitch - s * 10 * DEG;
  P.head.rotation.z = 0;
  P.jaw.rotation.x = (titan.roarJaw + s * 0.5) * T.jawDeg * DEG;
  g.position.set(titan.x, y, titan.z);
  g.rotation.y = titan.yaw;
  g.rotation.x = 0; g.rotation.z = 0;
  for (const k of ["legL", "legR", "head", "tail", "jaw", "key"]) { P[k].userData.base = P[k].userData.base || P[k].position.clone(); }
  for (const k of ["legL", "legR", "head", "tail", "jaw", "key"]) P[k].position.copy(P[k].userData.base);
  P.body.position.x = 0; P.body.position.z = 0;
  // the fall: it tips over, and comes apart as it goes
  if (ph === "fall" || ph === "down") {
    const ft = ph === "down" ? 1 : clamp(titan.fallT / T.fallTime, 0, 1);
    const tip = Math.min(1, Math.pow(ft, T.fallPow) * 1.1);
    g.rotation.z = titan.fallDir * tip * T.fallDeg * DEG;   // over on to its side: seen from him a topple, not a nod
    const sep = clamp((ft - T.breakAt) / (1 - T.breakAt), 0, 1), sp = sep * sep;
    P.head.position.y += sp * 18; P.head.position.x -= sp * 16 * titan.fallDir; P.head.position.z += sp * 10;
    P.head.rotation.x += sp * 0.6;
    P.head.rotation.z += sp * T.headRoll;          // it lands on its side, not sat up on the pile
    P.tail.position.z -= sp * 18; P.tail.rotation.x -= sp * 0.8;
    P.legL.rotation.z = -sp * 0.9; P.legR.rotation.z = sp * 0.9;
    P.legL.position.x -= sp * 10; P.legR.position.x += sp * 10;
    P.body.position.y += sp * 6;
    P.jaw.rotation.x += sp * 0.9;
    if (ph === "down") y = titan.y - T.wadeDepth - Math.min(T.sink, titan.t * T.sinkRate) - 8;
    else y -= tip * 8;
    g.position.y = y;
  }
  g.updateMatrixWorld(true);
}

// every capsule, plate, lamp and glow follows the part it rides
function tnFollow() {
  const P = titan.parts;
  for (const r of titan.recs) {
    const m = P[r.tnPart].matrixWorld;
    tnV.copy(r.tnA).applyMatrix4(m); tnV2.copy(r.tnB).applyMatrix4(m);
    const c = r.cap, rr = c.r;
    c.a[0] = tnV.x; c.a[1] = tnV.y; c.a[2] = tnV.z; c.b[0] = tnV2.x; c.b[1] = tnV2.y; c.b[2] = tnV2.z;
    r.x = (tnV.x + tnV2.x) / 2; r.z = (tnV.z + tnV2.z) / 2;
    r.hw = Math.abs(tnV.x - tnV2.x) / 2 + rr; r.hd = Math.abs(tnV.z - tnV2.z) / 2 + rr;
    r.y0 = Math.min(tnV.y, tnV2.y) - rr; r.y1 = Math.max(tnV.y, tnV2.y) + rr;
  }
  const pm = titan.platesMesh, sm = titan.socketsMesh;
  titan.plates.forEach((p, i) => {
    p.world.multiplyMatrices(P[p.part].matrixWorld, p.local);
    pm.setMatrixAt(i, p.on ? p.world : tnZero);
    tnM.multiplyMatrices(P[p.part].matrixWorld, p.socket); sm.setMatrixAt(i, tnM);
  });
  pm.instanceMatrix.needsUpdate = true; sm.instanceMatrix.needsUpdate = true;
  const pos = titan.lampPts.geometry.attributes.position.array, col = titan.lampPts.geometry.attributes.color.array;
  // all its lights go out when it falls: lamps, eyes (tnShow), weak-spot glows and lenses (below)
  const lit = titan.phase === "up" || titan.phase === "rising";
  const blink = (titan.stagger > 0 || titan.blinkT > 0) && Math.sin(titan.clock * 40) > 0;
  titan.lamps.forEach((l, i) => {
    tnV.copy(l.p).applyMatrix4(P[l.part].matrixWorld);
    pos[i * 3] = tnV.x; pos[i * 3 + 1] = tnV.y; pos[i * 3 + 2] = tnV.z;
    const c = l.on && lit && !(blink && i % 3 === 0) ? l.color : titan.lampOff;   // out: a dark stud, so its going shows
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  });
  titan.lampPts.geometry.attributes.position.needsUpdate = true;
  titan.lampPts.geometry.attributes.color.needsUpdate = true;
  const T = TITAN, frac = titan.points / tnPointsMax();
  for (const e of titan.eyes) {
    e.s.position.copy(tnV.copy(e.p).applyMatrix4(P.head.matrixWorld));
    e.lit = titan.phase === "up" || titan.phase === "rising" && titan.t > tnHeadUpAt();   // out the moment it falls
    const dim = frac < 1 / 3 ? T.eyeDim : 1;
    e.s.scale.setScalar(T.eyeSize * dim * (titan.stagger > 0 ? 0.7 : 1));
  }
  const pulse = T.weakPulse[0] + (T.weakPulse[1] - T.weakPulse[0]) * (0.5 + 0.5 * Math.sin(titan.clock * T.weakRate));
  const lensOn = titan.phase === "up" || (titan.phase === "rising" && titan.t > tnHeadUpAt());
  titan.lensMat.color.setHex(lensOn ? 0xffffff : T.lensOff);
  for (const w of titan.weak) {
    w.world.copy(w.p).applyMatrix4(P[w.part].matrixWorld);
    w.s.position.copy(w.world);
    w.flash = Math.max(0, (w.flash || 0) - (titan.dtLast || 0) / T.weakFlashTime);
    w.s.scale.setScalar(TITAN.weak.find(q => q.name === w.name).size * pulse * (1 + T.weakFlash * w.flash));
  }
  // the pools' culling spheres stand where it stands
  for (const o of [titan.platesMesh, titan.socketsMesh, titan.debrisMesh, titan.lampPts, titan.sparkPts, titan.puffPts]) o.geometry.boundingSphere.center.set(titan.x, titan.y + 60, titan.z);
}

// ---- hits ---------------------------------------------------------------------
// From updateMissiles (traffic.js): a missile inside a robot record's box. The box is loose round a
// capsule, so its exact shape decides; true means it hit, and the hit is counted here.
function tnMissileHit(b, x, y, z, m) {
  if (titan.phase !== "up" || !solidTest(b, x, y, z, TITAN.hitPad)) return false;
  // a weak spot: hit near it -- or hit near enough by a missile that was locked on to it (he pointed at it)
  let weak = null;
  for (const w of titan.weak) {
    const d = w.world.distanceTo(tnV.set(x, y, z));
    if (d < TITAN.weakR || (m && m.tnLock === w && d < TITAN.weakR * TITAN.weakLockHit)) { weak = w; break; }
  }
  const n = weak ? TITAN.weakMul : 1;
  const region = weak ? weak.region : b.tn;
  flags.tnHits = (flags.tnHits || 0) + 1;
  if (weak) flags.tnWeakHits = (flags.tnWeakHits || 0) + 1;
  for (let k = 0; k < n && titan.points > 0; k++) tnKnockPlate(region, x, y, z);
  // sparks, a clang, a stagger -- and it rocks away from where it was hit
  const sc = TITAN.sparkColors;
  for (let i = 0; i < (weak ? TITAN.hitSparks * 2 : TITAN.hitSparks); i++) {
    const u = tnRnd() * 2 - 1, a = tnRnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), v = 14 + tnRnd() * 22;
    tnSpark(x, y, z, Math.cos(a) * r * v, u * v + 8, Math.sin(a) * r * v, 0.6 + tnRnd() * 0.7, TUNE.palette[sc[i % sc.length]], 14, 0.6);
  }
  const fx = Math.sin(titan.yaw), fz = Math.cos(titan.yaw);
  titan.staggerDir = ((state.x - titan.x) * fx + (state.z - titan.z) * fz) >= 0 ? 1 : -1;
  titan.staggerSide = tnRnd() < 0.5 ? -1 : 1;
  // inside his sweep a hit does not rock it (that would swing its parts at him): the stagger is SKIPPED,
  // and its lamps blink instead
  if (titan.near) { titan.blinkT = TITAN.stagger; flags.tnStaggersSkipped = (flags.tnStaggersSkipped || 0) + 1; }
  else { titan.stagger = TITAN.stagger; flags.tnStaggers = (flags.tnStaggers || 0) + 1; }
  if (weak) {
    // a weak spot looks it: its glow flares, a burst of its own colour and a wide ring, three plates, its own sound
    const wc = TITAN.weak.find(q => q.name === weak.name).color;
    weak.flash = 1;
    for (let i = 0; i < TITAN.weakRing; i++) { const a = i / TITAN.weakRing * Math.PI * 2; tnSpark(x, y, z, Math.cos(a) * TITAN.weakRingSpeed, (tnRnd() - 0.5) * 6, Math.sin(a) * TITAN.weakRingSpeed, 1.2, wc, 2, 0.8); }
    for (let i = 0; i < TITAN.weakBurst; i++) {
      const u = tnRnd() * 2 - 1, a = tnRnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), v = 20 + tnRnd() * 26;
      tnSpark(x, y, z, Math.cos(a) * r * v, u * v + 6, Math.sin(a) * r * v, 0.8 + tnRnd() * 0.8, wc, 10, 0.5);
    }
    for (let i = 0; i < TITAN.weakPuffs; i++) { const a = i / TITAN.weakPuffs * Math.PI * 2; tnPuff(x, y, z, Math.cos(a) * TITAN.weakRingSpeed, (tnRnd() - 0.3) * 8, Math.sin(a) * TITAN.weakRingSpeed, 1.4, 0); }
  }
  tnSound(weak ? "weak" : "clang");
  if (titan.points <= 0) tnStartFall();
  return true;
}
function tnKnockPlate(region, x, y, z) {
  let best = null, bd = Infinity;
  for (const pass of [0, 1]) {
    for (const p of titan.plates) {
      if (!p.on || (pass === 0 && p.region !== region)) continue;
      p.world.decompose(tnV, tnQ, tnS);
      const d = tnV.distanceToSquared(tnV2.set(x, y, z));
      if (d < bd) { bd = d; best = p; }
    }
    if (best) break;
  }
  titan.points = Math.max(0, titan.points - 1);
  // the lamps go out with the plates, the furthest-from-the-core first
  const lit = Math.round(titan.lamps.length * titan.points / tnPointsMax());
  for (let i = titan.lamps.length - 1; i >= 0 && tnLampsLit() > lit; i--) if (titan.lamps[i].on) titan.lamps[i].on = false;
  if (!best) return;
  best.on = false;
  best.world.decompose(tnV, tnQ, tnS);
  tnV2.set(0, 0, 1).applyQuaternion(tnQ);
  const v = 10 + tnRnd() * 8;
  tnDebris(tnV.x, tnV.y, tnV.z, tnV2.x * v + (tnRnd() - 0.5) * 6, 10 + tnRnd() * 10, tnV2.z * v + (tnRnd() - 0.5) * 6,
    best.size[0], best.size[1], 1.6, TUNE.palette[best.color], 8);
  flags.tnPlates = (flags.tnPlates || 0) + 1;
}
const tnQ = new THREE.Quaternion(), tnS = new THREE.Vector3();

// Pointing, not timing: a missile pointed at it bends on to it -- a weak spot its line passes near first.
// (The meteor shower's rule, events.js meteorsUpdate: within lockR, and inside lockDot of its line. From
// 400 m every part of it is inside a few degrees, so WHICH part is chosen by how near the missile's line
// passes it: a weak spot within weakLock metres of the line wins; otherwise the part the line passes nearest.)
function tnBend(dt) {
  const T = TITAN;
  if (titan.phase !== "up" || typeof missiles === "undefined") return;
  for (const m of missiles) {
    if (!m.alive) continue;
    // a pooled missile fired again: its lock and its mark are its new flight's
    if (m.tnLife === undefined || m.life > m.tnLife) { m.tnBent = false; m.tnLock = null; }
    m.tnLife = m.life;
    const sp = Math.hypot(m.vx, m.vy, m.vz);
    if (sp < 1) continue;
    const ux = m.vx / sp, uy = m.vy / sp, uz = m.vz / sp;
    let best = null, bestPerp = Infinity, weak = null;
    const aim = (x, y, z, w) => {
      const dx = x - m.x, dy = y - m.y, dz = z - m.z, d = Math.hypot(dx, dy, dz);
      if (d > T.lockR || d < 1) return;
      const along = dx * ux + dy * uy + dz * uz;
      if (along / d < T.lockDot) return;                    // behind it, or off to the side: let it go
      const perp = Math.hypot(dx - ux * along, dy - uy * along, dz - uz * along);
      if (w) { if (perp < T.weakLock && (!weak || perp < weak.perp)) weak = { dx, dy, dz, d, perp, w }; return; }
      if (perp < bestPerp) { bestPerp = perp; best = { dx, dy, dz, d }; }
    };
    if (m.tnLock) aim(m.tnLock.world.x, m.tnLock.world.y, m.tnLock.world.z, m.tnLock);   // a lock holds while it can
    if (!weak) for (const w of titan.weak) aim(w.world.x, w.world.y, w.world.z, w);
    if (!weak) for (const r of titan.recs) aim((r.cap.a[0] + r.cap.b[0]) / 2, (r.cap.a[1] + r.cap.b[1]) / 2, (r.cap.a[2] + r.cap.b[2]) / 2, null);
    const t = weak || best;
    if (!t) continue;
    m.tnLock = weak ? weak.w : null;
    const k = Math.min(1, T.lockRate * dt);
    const nx = ux + (t.dx / t.d - ux) * k, ny = uy + (t.dy / t.d - uy) * k, nz = uz + (t.dz / t.d - uz) * k;
    const nl = Math.hypot(nx, ny, nz) || 1;
    m.vx = nx / nl * sp; m.vy = ny / nl * sp; m.vz = nz / nl * sp;
    m.mesh.rotation.set(Math.asin(clamp(m.vy / sp, -1, 1)), Math.atan2(-m.vx, -m.vz), 0, "YXZ");
    m.tnBent = true;
  }
}

// ---- the phases ---------------------------------------------------------------
function tnStartRise() {
  const T = TITAN;
  if (titan.phase === "down" || titan.phase === "fall") { const h = T.path[T.home]; titan.x = h[0]; titan.z = h[1]; }
  titan.y = seaLevelAt(titan.x, titan.z);
  titan.roared = false;
  titan.walk = 0; titan.stagger = 0; titan.headYaw = 0; titan.headPitch = 0; titan.near = false;
  titan.phase = "rising"; titan.t = 0;
  tnRepair();
  flags.tnRises = (flags.tnRises || 0) + 1;
}
function tnStartFall() {
  const T = TITAN;
  titan.phase = "fall"; titan.fallT = 0; titan.t = 0; titan.splashed = false; titan.fires = 0; titan.fireT = 0; titan.horned = false;
  titan.stagger = 0;
  tnSolidOn(false);       // from its first frame the fall is not a wall
  // away from him: backwards if he is in front of it, forwards if behind
  // over on to a side (a roll about its own fore-and-aft line): the side away from him, and seaward when he
  // is square in front (it faces him, so he usually is). (lx, lz): where its top goes for fallDir +1
  const lx = -Math.cos(titan.yaw), lz = Math.sin(titan.yaw);
  const away = (state.x - titan.x) * lx + (state.z - titan.z) * lz;
  titan.fallDir = Math.abs(away) > T.fallSideM ? (away > 0 ? -1 : 1) : (lz >= 0 ? 1 : -1);
  flags.tnFallsStarted = (flags.tnFallsStarted || 0) + 1;
  tnSound("big");
}
function tnSplash() {
  titan.splashed = true;
  const T = TITAN, fx = -Math.cos(titan.yaw) * titan.fallDir, fz = Math.sin(titan.yaw) * titan.fallDir;   // the side it went over to
  // where it lands: along the way it fell
  const lx = titan.x + fx * T.splashAt, lz = titan.z + fz * T.splashAt;
  titan.landX = lx; titan.landZ = lz;
  tnSplashRing(lx, lz, T.splashPuffs, T.splashSpeed, T.splashUp, T.splashLife);
  tnSplashRing(titan.x, titan.z, Math.round(T.splashPuffs / 2), T.splashSpeed * 0.7, T.splashUp * 1.3, T.splashLife);
  // the column is THERE the moment it lands -- the whole height of it at once, then falling back
  for (let i = 0; i < T.splashColumn; i++) {
    const h = tnRnd(), sw = T.columnW * (1 - h * 0.5);
    tnPuff(lx + (tnRnd() - 0.5) * sw, seaLevelAt(lx, lz) + h * T.columnH, lz + (tnRnd() - 0.5) * sw, (tnRnd() - 0.5) * 10, 6 + tnRnd() * 10, (tnRnd() - 0.5) * 10, T.splashLife * (0.8 + tnRnd() * 0.6), T.columnGrav);
  }
  // and the junk of it, flying
  for (let i = 0; i < T.fallChunks; i++) {
    const a = tnRnd() * Math.PI * 2, v = 8 + tnRnd() * 16;
    tnDebris(lx + (tnRnd() - 0.5) * 40, seaLevelAt(lx, lz) + 10 + tnRnd() * 30, lz + (tnRnd() - 0.5) * 40, Math.cos(a) * v, 14 + tnRnd() * 18, Math.sin(a) * v,
      3 + tnRnd() * 6, 3 + tnRnd() * 6, 3 + tnRnd() * 6, TUNE.palette[T.plateColors[i % T.plateColors.length]], 7);
  }
  flags.tnSplashes = (flags.tnSplashes || 0) + 1;
  tnSound("splash");
  const d = Math.hypot(state.x - lx, state.z - lz);
  if (typeof shakeAmp !== "undefined" && d < T.shakeR) shakeAmp = Math.max(shakeAmp, T.shake * (1 - d / T.shakeR));
}

function tnDist() { return Math.hypot(state.x - titan.x, state.z - titan.z); }
// the moment its head breaks the surface (its eyes come on)
function tnHeadUpAt() { const T = TITAN; return T.announce + (T.riseTime - T.announce) * T.eyesAt; }
// how far he is from the nearest of its parts' surfaces (its capsules), metres
function tnGap() {
  let best = Infinity;
  for (const r of titan.recs) {
    const c = r.cap, ax = c.a[0], ay = c.a[1], az = c.a[2], bx = c.b[0] - ax, by = c.b[1] - ay, bz = c.b[2] - az;
    const l2 = bx * bx + by * by + bz * bz || 1e-9;
    const t = clamp(((state.x - ax) * bx + (state.y - ay) * by + (state.z - az) * bz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(state.x - ax - bx * t, state.y - ay - by * t, state.z - az - bz * t) - c.r);
  }
  return best;
}
// where a leg meets the sea (its foam): the point on its capsule's axis at the water's height
function tnLegAtSea(r, sea, out) {
  const c = r.cap, dy = c.b[1] - c.a[1];
  if (Math.abs(dy) < 1e-3 || (sea - c.a[1]) * (sea - c.b[1]) > 0) return null;
  const t = (sea - c.a[1]) / dy;
  return out.set(c.a[0] + (c.b[0] - c.a[0]) * t, sea, c.a[2] + (c.b[2] - c.a[2]) * t);
}
// Rising, or falling, it is not solid -- and a missile he fires at what he can SEE of it still meets it: it
// glances off with sparks and a clank (it shrugs it off: its armour is closed while it rises, and down it goes
// anyway), never flies through. Only above the water.
function tnShrug(dt) {
  if (typeof missiles === "undefined") return;
  const sea = seaLevelAt(titan.x, titan.z);
  for (const m of missiles) {
    if (!m.alive || m.y <= sea) continue;
    let hit = false;
    for (let k = 0; k <= 2 && !hit; k++) {
      const f = k * dt / 2, x = m.x + m.vx * f, y = m.y + m.vy * f, z = m.z + m.vz * f;   // this frame's flight ahead of it
      for (const r of titan.recs) if (y > sea && solidTest(r, x, y, z, TITAN.hitPad)) { hit = true; tnV.set(x, y, z); break; }
    }
    if (!hit) continue;
    m.alive = false; m.mesh.visible = false;
    triggerExplosion(tnV.x, tnV.y, tnV.z, 0.35, true);
    for (let i = 0; i < TITAN.shrugSparks; i++) { const a = tnRnd() * Math.PI * 2, u = tnRnd(); tnSpark(tnV.x, tnV.y, tnV.z, Math.cos(a) * 16 * u, 6 + tnRnd() * 14, Math.sin(a) * 16 * u, 0.5 + tnRnd() * 0.5, TUNE.palette.white, 12, 0.5); }
    tnSound("clang");
    flags.tnShrugs = (flags.tnShrugs || 0) + 1;
  }
}
function tnShooter() { const k = vehKind(); return k === "plane" || k === "heli"; }

function updateTitan(dt) {
  if (!titan.built) return;
  const T = TITAN;
  titan.clock += dt;
  titan.t += dt;
  titan.dtLast = dt;
  // NEAR, decided first, before anything moves this frame: he is within sweepR of a part's surface
  titan.near = titan.phase === "up" && tnGap() < TITAN.sweepR;
  if (!titan.near) titan.mclock += dt;
  titan.blinkT = Math.max(0, titan.blinkT - dt);
  const d = tnDist();
  const homeD = Math.hypot(state.x - T.path[T.home][0], state.z - T.path[T.home][1]);
  const busy = state.exploding || (typeof menuOpen === "function" && menuOpen());
  const sea = seaLevelAt(titan.x, titan.z);
  // a bang near it: it holds still while he is in pieces and a moment after (he comes back where it happened,
  // by the one wall law's own rule: over the capsule he hit, collision.js / flight.js)
  if (state.exploding && d < T.reach + T.clearAbove) titan.calm = Math.max(titan.calm, T.grace);
  titan.calm = Math.max(0, titan.calm - dt);
  const ph = titan.phase;
  if (ph === "sea") {
    if (titan.member && evpDue(titan.member, dt) && homeD < T.wakeR && d > T.clearR) tnStartRise();
  } else if (ph === "rising") {
    // ANNOUNCED: the sea boils and steams over it, and it roars, before its head breaks the surface
    if (!titan.roared && titan.t > T.roarAt) { titan.roared = true; if (tnSound("roar")) flags.tnRoars = (flags.tnRoars || 0) + 1; titan.roarJaw = 1; flags.tnAnnounces = (flags.tnAnnounces || 0) + 1; }
    if (titan.t < T.riseTime && Math.floor(titan.clock * T.boilRate) !== Math.floor((titan.clock - dt) * T.boilRate)) {
      const boil = titan.t < T.announce ? 1 : 0.6;
      for (let i = 0; i < T.boilPuffs * boil; i++) { const a = tnRnd() * Math.PI * 2, r = tnRnd() * T.boilR; tnPuff(titan.x + Math.cos(a) * r, sea + 1, titan.z + Math.sin(a) * r, Math.cos(a) * 4, 8 + tnRnd() * 14, Math.sin(a) * 4, 2.4, 1.5); }
      if (titan.t < T.announce) tnSpark(titan.x + (tnRnd() - 0.5) * 30, sea + 2, titan.z + (tnRnd() - 0.5) * 30, 0, 18, 0, 1, TUNE.palette.cyan, 6, 0.4);
    }
    if (titan.t >= T.riseTime) {
      titan.phase = "up"; titan.t = 0;
      flags.tnUps = (flags.tnUps || 0) + 1;
    }
  } else if (ph === "up") {
    // he is near and can shoot: it turns to face him and stops wading; otherwise it wades
    titan.watching = d < T.watchR && !busy && !(typeof eject !== "undefined" && eject.active);
    titan.facing = titan.watching && d < T.faceR && tnShooter();
    // NEVER A PART SWUNG INTO HIM: inside its sweep it holds every joint where it is -- no turn, no step,
    // no head, no stagger -- so anything he meets there is a wall he flew into, never one that came at him
    if (!titan.near) titan.stagger = Math.max(0, titan.stagger - dt);
    const still = titan.hold || titan.calm > 0 || titan.stagger > 0 || titan.near;
    let want = titan.yaw, walk = 0;
    if (!still) {
      if (titan.facing) want = Math.atan2(state.x - titan.x, state.z - titan.z);
      else {
        let p = T.path[titan.seg], dx = p[0] - titan.x, dz = p[1] - titan.z, dl = Math.hypot(dx, dz);
        if (dl < 3) {
          // the end of a leg: back the other way along the path
          if (titan.seg >= T.path.length - 1) titan.segDir = -1;
          else if (titan.seg <= 0) titan.segDir = 1;
          titan.seg += titan.segDir;
          p = T.path[titan.seg]; dx = p[0] - titan.x; dz = p[1] - titan.z; dl = Math.hypot(dx, dz);
        }
        want = Math.atan2(dx, dz);
        const turn = Math.abs(wrapPi(want - titan.yaw));
        if (turn < T.walkTurnDeg * DEG && dl >= 3) {
          walk = 1;
          const v = T.wade * dt / dl;
          titan.x += dx * Math.min(1, v); titan.z += dz * Math.min(1, v);
          titan.y = seaLevelAt(titan.x, titan.z);
        }
      }
      const dy = wrapPi(want - titan.yaw), mx = T.turnRate * DEG * dt;
      titan.yaw += clamp(dy, -mx, mx);
      if (Math.abs(dy) > T.treadDeg * DEG) walk = Math.max(walk, 0.5);   // turning, it treads
    }
    // while he is near: no step, no ease to standing -- the legs hold exactly where they are
    if (!titan.near) titan.walk = lerp(titan.walk || 0, walk, Math.min(1, dt * 3));
    if (titan.walk > 0.05 && !titan.near) {
      const s0 = Math.floor(titan.step);
      titan.step += dt / T.stepTime * titan.walk;
      if (Math.floor(titan.step) !== s0) {
        tnSound("stomp");
        const side = Math.floor(titan.step) % 2 ? 1 : -1, fx = Math.cos(titan.yaw), fz = -Math.sin(titan.yaw);
        tnSplashRing(titan.x + fx * side * 14, titan.z + fz * side * 14, 10, 6, 4, 1.6);
        flags.tnStomps = (flags.tnStomps || 0) + 1;
      }
    }
    // the eyes follow him: the head turns, within its reach (not inside its sweep)
    if (titan.watching && !titan.near) {
      const lx = state.x - titan.x, lz = state.z - titan.z;
      const rel = wrapPi(Math.atan2(lx, lz) - titan.yaw);
      const hy = (camera.position.y - (titan.y + T.eyeHeight)) / Math.max(30, Math.hypot(lx, lz));
      titan.headYaw += clamp(clamp(rel, -T.headYaw * DEG, T.headYaw * DEG) - titan.headYaw, -T.headYawRate * dt, T.headYawRate * dt);
      titan.headPitch += clamp(clamp(Math.atan(hy), -T.headPitch * DEG, T.headPitch * DEG) - titan.headPitch, -T.headPitchRate * dt, T.headPitchRate * dt);
    } else if (!titan.near) {
      titan.headYaw *= Math.exp(-dt); titan.headPitch *= Math.exp(-dt);
    }
    // steam from the vents; now and then a roar
    titan.steamT -= dt;
    if (titan.steamT <= 0) {
      titan.steamT = T.steamEvery * (0.7 + tnRnd() * 0.6);
      for (const side of [-1, 1]) {
        tnV.set(side * 7, 46, -10).applyMatrix4(titan.parts.body.matrixWorld);
        for (let i = 0; i < 5; i++) tnPuff(tnV.x, tnV.y + i * 2, tnV.z, (tnRnd() - 0.5) * 3, 9 + tnRnd() * 5, (tnRnd() - 0.5) * 3, 1.6, -1);
      }
      tnSound("steam");
    }
    titan.roarT -= dt;
    if (titan.roarT <= 0) {
      titan.roarT = T.roarEvery * (0.8 + tnRnd() * 0.4);
      if (titan.watching && tnSound("roar")) { flags.tnRoars = (flags.tnRoars || 0) + 1; titan.roarJaw = 1; }
    }
    // where plates have gone it leaks: a spit of sparks or a wisp of steam from a bare socket
    titan.leakT = (titan.leakT || 0) - dt;
    if (titan.leakT <= 0) {
      titan.leakT = T.leakEvery;
      const gone = titan.plates.filter(q => !q.on);
      if (gone.length) {
        const q = gone[Math.floor(tnRnd() * gone.length)];
        q.world.decompose(tnV, tnQ, tnS);
        tnV2.set(0, 0, 1).applyQuaternion(tnQ);
        if (tnRnd() < 0.5) for (let i = 0; i < 6; i++) tnSpark(tnV.x, tnV.y, tnV.z, tnV2.x * 8 + (tnRnd() - 0.5) * 6, 4 + tnRnd() * 6, tnV2.z * 8 + (tnRnd() - 0.5) * 6, 0.6, TUNE.palette.warning, 12, 0.4);
        else tnPuff(tnV.x + tnV2.x * 3, tnV.y, tnV.z + tnV2.z * 3, tnV2.x * 3, 5, tnV2.z * 3, 1.2, -1);
      }
    }
    // solid while it stands -- but never switched on round him
    if (!titan.solid && !tnInside() && titan.g.visible) tnSolidOn(true);
  } else if (ph === "fall") {
    titan.fallT += dt;
    if (!titan.splashed && titan.fallT >= T.fallTime) tnSplash();
    if (titan.splashed) {
      titan.fireT -= dt;
      if (titan.fires < T.fireBursts && titan.fireT <= 0) {
        titan.fireT = T.fireEvery;
        const a = tnRnd() * Math.PI * 2, r = tnRnd() * T.fireSpread;
        tnFirework((titan.landX + titan.x) / 2 + Math.cos(a) * r, titan.y + lerp(T.fireY[0], T.fireY[1], tnRnd()), (titan.landZ + titan.z) / 2 + Math.sin(a) * r);
        titan.fires++;
      }
      if (!titan.horned && titan.fallT >= T.fallTime + T.hornAfter) {
        titan.horned = true;
        flags.tnHorns = (flags.tnHorns || 0) + 1;
        tnSound("horn");
      }
      if (titan.fires >= T.fireBursts && titan.horned) {
        titan.phase = "down"; titan.t = 0;
        flags.tnFalls = (flags.tnFalls || 0) + 1;
        if (titan.member) evpRearm(titan.member, T.rebuild);
      }
    }
  } else if (ph === "down") {
    // in pieces, sinking out of sight; the pool's clock runs wherever he is, and it never rebuilds round him
    if (titan.member && evpDue(titan.member, dt) && d > T.clearR && homeD < T.wakeR) {
      tnStartRise();
      flags.tnRebuilds = (flags.tnRebuilds || 0) + 1;
      for (let i = 0; i < 6; i++) tnSound("click");
    }
  }
  titan.roarJaw = Math.max(0, titan.roarJaw - dt * 0.7);
  tnPose(dt);
  tnFollow();
  if (titan.phase !== "up" && titan.solid) tnSolidOn(false);
  // drawn near enough, and never in dad mode (dad mode does not run this; dadHideHis hides it)
  const camD = Math.hypot(camera.position.x - titan.x, camera.position.z - titan.z);
  const shown = titan.phase !== "sea" && !(titan.phase === "down" && titan.t * T.sinkRate > T.sink) && camD < T.drawR;
  const body = camD < T.meshR;
  tnShow(shown, body);
  if (titan.solid && !(shown && body)) tnSolidOn(false);
  // foam round each leg where it meets the sea; a wake as it wades
  if (shown && (titan.phase === "up" || (titan.phase === "rising" && titan.t > tnHeadUpAt()))) {
    titan.foamT = (titan.foamT || 0) - dt;
    if (titan.foamT <= 0) {
      titan.foamT = T.foamEvery;
      for (const r of titan.recs) {
        if (r.tnPart !== "legL" && r.tnPart !== "legR") continue;
        if (!tnLegAtSea(r, sea, tnV3)) continue;
        const n = titan.walk > 0.3 ? T.foamPuffs + 2 : T.foamPuffs;
        for (let i = 0; i < n; i++) { const a = tnRnd() * Math.PI * 2; tnPuff(tnV3.x + Math.cos(a) * T.foamR, sea + 0.5, tnV3.z + Math.sin(a) * T.foamR, Math.cos(a) * 3, 1.5 + tnRnd() * 2, Math.sin(a) * 3, 1.3, 2); }
      }
    }
  }
  if (shown && (titan.phase === "rising" && titan.t > tnHeadUpAt() || titan.phase === "fall")) tnShrug(dt);
  tnBend(dt);
  tnPools(dt, camD < T.drawR);
}

// is he inside any of its capsules now (it waits to be solid until he is not)
function tnInside() {
  for (const r of titan.recs) if (solidTest(r, state.x, state.y, state.z, TITAN.insidePad)) return true;
  return false;
}

function tnPools(dt, near) {
  // sparks: fall, fade, gone under the sea
  const sp = titan.sparkPts.geometry, pos = sp.attributes.position.array, col = sp.attributes.color.array;
  let n = 0;
  const sea = seaLevelAt(titan.x, titan.z);   // the one answer to how high the water is here
  for (const p of titan.sparks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < sea) { p.life = 0; continue; }
    const k = p.life / p.max;
    if (k < 0.25 && Math.sin(titan.clock * 40 + p.x * 3) < 0) continue;
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
    col[n * 3] = p.r; col[n * 3 + 1] = p.g; col[n * 3 + 2] = p.b;
    n++;
  }
  titan.spN = n;
  sp.setDrawRange(0, n);
  if (n) { sp.attributes.position.needsUpdate = true; sp.attributes.color.needsUpdate = true; }
  titan.sparkPts.visible = near && n > 0;
  // steam and spray
  const pg = titan.puffPts.geometry, pp = pg.attributes.position.array, pc = pg.attributes.color.array;
  let m = 0;
  for (const p of titan.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.vy -= p.grav * dt; p.vx *= Math.exp(-0.6 * dt); p.vz *= Math.exp(-0.6 * dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < sea - 1) { p.life = 0; continue; }
    // white to the end (a fading colour on plain blending is grey smoke): a puff's last moments thin out instead
    if (p.life / p.max < 0.2 && Math.sin(titan.clock * 23 + p.x * 1.7) < 0) continue;
    pp[m * 3] = p.x; pp[m * 3 + 1] = p.y; pp[m * 3 + 2] = p.z;
    pc[m * 3] = 0.96; pc[m * 3 + 1] = 0.98; pc[m * 3 + 2] = 1;
    m++;
  }
  titan.puffN = m;
  pg.setDrawRange(0, m);
  if (m) { pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true; }
  titan.puffPts.visible = near && m > 0;
  // debris
  const dm = titan.debrisMesh;
  let c = 0;
  for (let i = 0; i < titan.debris.length; i++) {
    const d = titan.debris[i];
    if (d.life > 0) {
      d.life -= dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.wx * dt; d.ry += d.wy * dt;
      if (d.y < sea - 2) {
        if (d.vy < -4) tnSplashRing(d.x, d.z, 6, 4, 5, 1.2);
        d.life = 0;
      }
    }
  }
  // compacted: live pieces first (their colours re-written in that order)
  for (let i = 0; i < titan.debris.length; i++) {
    const d = titan.debris[i];
    if (d.life <= 0) continue;
    tnObj.position.set(d.x, d.y, d.z); tnObj.rotation.set(d.rx, d.ry, 0); tnObj.scale.set(d.sx, d.sy, d.sz); tnObj.updateMatrix();
    dm.setMatrixAt(c, tnObj.matrix); dm.setColorAt(c, tnColor.setHex(d.color));
    c++;
  }
  dm.count = c;
  if (c) { dm.instanceMatrix.needsUpdate = true; if (dm.instanceColor) dm.instanceColor.needsUpdate = true; }
  dm.visible = near && c > 0;
}
let tnObj = null;   // made at load, inside vkQuiet (an Object3D draws Math.random for its id)

// ---- the edge arrow: where it is, while it is up and off his screen ---------------
const tnProj = new THREE.Vector3();
// At the screen's real edge, along the bearing to it, a margin in -- and never on a control or on the home
// arrow: slid along that edge to the nearest clear place, and only if the whole edge is taken, walked in.
function tnArrow(on, theta) {
  const e = el.titanArrow;
  if (!e) return;
  titan.arrowOn = !!on;
  e.classList.toggle("on", !!on);
  if (!on) return;
  titan.arrowTheta = theta;
  const W = window.innerWidth, H = window.innerHeight, w = e.offsetWidth || 96, pad = TITAN.arrowMargin;
  const hw = w / 2 * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta)));   // the pointer's square, turned by the bearing: its box
  // never over the dash (its dials) and never on a control or on the home arrow
  const dash = el.dash && el.dash.offsetHeight ? el.dash.getBoundingClientRect() : null;
  const floor = dash ? dash.top : H;
  const home = el.homeArrow && el.homeArrow.classList.contains("on") ? (el.homeArrow.querySelector("svg") || el.homeArrow).getBoundingClientRect() : null;
  const blocked = (px, py) => {
    const L = px - hw, T0 = py - hw, R = px + hw, B = py + hw;
    if (B > floor - pad) return true;
    if (typeof btnRectBlocked === "function" && btnRectBlocked(L - pad, T0 - pad, R + pad, B + pad)) return true;
    return !!home && L < home.right + pad && R > home.left - pad && T0 < home.bottom + pad && B > home.top - pad;
  };
  const p = tnArrowPlace(theta, W, floor, w, blocked);
  titan.arrowHow = p.how;
  e.style.left = p.x + "px";
  e.style.top = p.y + "px";
  e.querySelector(".tnPoint").style.transform = `rotate(${theta * 180 / Math.PI}deg)`;
}
// Where it goes, worked out alone (the harness drives it with blocked() of its own making): along the bearing
// to the edge of the screen above the dash, a margin in; if that is blocked, slid along that edge to the
// nearest clear place; then walked in along the bearing; and last, the clear place nearest that edge point.
// how: "edge" | "slid" | "walked" | "grid" | "none"
function tnArrowPlace(theta, W, H, w, blocked) {
  const T = TITAN, cx = W / 2, cy = H / 2, hw = w / 2 * (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta))), m = T.arrowMargin + hw, step = T.arrowStep;
  const sx = Math.sin(theta), sy = -Math.cos(theta);
  const tx = Math.abs(sx) > 1e-6 ? ((sx > 0 ? W - m : m) - cx) / sx : Infinity, ty = Math.abs(sy) > 1e-6 ? ((sy > 0 ? H - m : m) - cy) / sy : Infinity;
  const t = Math.min(tx, ty), side = tx < ty;     // side: on the left or right edge (slides up and down)
  const x = cx + sx * t, y = cy + sy * t;
  if (!blocked(x, y)) return { x, y, how: "edge" };
  const lo = m, hi = side ? H - m : W - m;
  for (let k = 1; k * step < hi; k++) for (const sg of [1, -1]) {
    const v = (side ? y : x) + sg * k * step;
    if (v < lo || v > hi) continue;
    const px = side ? x : v, py = side ? v : y;
    if (!blocked(px, py)) return { x: px, y: py, how: "slid" };
  }
  for (let r = t - step; r > 0; r -= step) { const px = cx + sx * r, py = cy + sy * r; if (!blocked(px, py)) return { x: px, y: py, how: "walked" }; }
  let bd = Infinity, bx = x, by = y, how = "none";
  for (let gy = hw; gy <= H - hw; gy += T.arrowGrid) for (let gx = hw; gx <= W - hw; gx += T.arrowGrid) {
    const dd = (gx - x) * (gx - x) + (gy - y) * (gy - y);
    if (dd < bd && !blocked(gx, gy)) { bd = dd; bx = gx; by = gy; how = "grid"; }
  }
  return { x: bx, y: by, how };
}
// asked once a frame from updateHud (main.js), after the camera has moved
function tnUpdateArrow() {
  if (!titan.built) return;
  const want = (titan.phase === "rising" || titan.phase === "up") && tnShooter() && !state.exploding && !state.engaged &&
    !(typeof menuOpen === "function" && menuOpen()) && !(typeof eject !== "undefined" && eject.active) &&
    !(typeof dadHere === "function" && dadHere()) && tnDist() < TITAN.arrowR;
  if (!want) { tnArrow(false); return; }
  camera.updateMatrixWorld();
  tnProj.set(titan.x, titan.y + TITAN.top * 0.55, titan.z).project(camera);
  const behind = tnProj.z > 1;
  let sx = tnProj.x, sy = tnProj.y;
  if (behind) { sx = -sx; sy = -sy; if (Math.abs(sx) < 1e-3 && Math.abs(sy) < 1e-3) sy = -1; }
  if (!behind && Math.abs(sx) < TITAN.arrowInView && Math.abs(sy) < TITAN.arrowInView) { tnArrow(false); return; }
  tnArrow(true, Math.atan2(sx, sy));
}
// is the robot (its middle) on his screen
function tnOnScreen() {
  camera.updateMatrixWorld();
  tnProj.set(titan.x, titan.y + TITAN.top * 0.55, titan.z).project(camera);
  return tnProj.z < 1 && Math.abs(tnProj.x) < 0.95 && Math.abs(tnProj.y) < 0.95;
}

// three.js draws Math.random for every object it makes: built on the kit's own stream, and the
// kit's seed put back, the seeded traffic sees the stream it saw before the robot existed.
{ const s0 = vkSeed; try { vkQuiet(0, tnBuild); } finally { vkSeed = s0; } }
// a standing event on the coast: its clock is its rebuild, and the pool's door makes it rise
titan.member = evpRegister({ name: "coast", policy: "standing", members: [{ key: "titan", state: titan.clockState = { next: 0 }, gap: TITAN.rebuild, force: () => tnForce() }] }).members[0];
