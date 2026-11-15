"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE GIANT ROBOT (v218, stage 1: "it rises, he shoots it down, it rebuilds"; v219, stage 2: its
// three attacks, THE ATTACKS below. The boat's part is parked by the parent, QUEUE.md section 10).
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
//     NEAR: within sweepR of any part's surface nothing that carries a LIVE solid moves -- no turn, step,
//     breath, tail swish, key turn or head turn (they run on `mclock`, which stops), and a hit's
//     stagger is skipped (its lamps blink instead). THE ONE EXCEPTION (v219), ANNOUNCED: the tail swipe
//     swings the tail at him on purpose -- and for all of it, from the flash until the tail is home and
//     he is clear of it, the tail's record is OFF the registry (titan.tailOff): through all that time the
//     tail is PASSABLE -- not a wall, and not a hit -- except from minLead to its end (5.5-6.9 s after the
//     flash), when the swipe's own test can bang him. Its coil goes away from the mark; and once the swipe is
//     called off or done, while he is within sweepR of it, it HOLDS -- it goes home only once he is clear,
//     never toward or through him. Everything unannounced still holds still.
//   * Rising and falling it is not solid, but a missile at what he can see of it (above the water) is
//     never let through: it glances off with sparks and a clank (tnShrug) and takes nothing.
//   * Pointing, not timing: a missile fired at it bends on to it (the meteor rule, events.js) -- to a
//     weak spot when its line passes within weakLock of one; a missile fired away from it (outside
//     lockDot) is left alone.
//   * One-shot sounds only: no setTone, so nothing of it can drone on after he leaves (every voice of an attack
//     is over within a second: the wind-up 0.88 s, the swipe 1.0 s; the beam's charge is short blips from its frame).
//
// THE ATTACKS (v219; the parent's words: "it turns to face him, and every attack is announced -- eyes flash, a
// wind-up roar -- and can be dodged by steering: a tail swipe, a thrown boulder of scrap, a slow sweeping eye beam.
// A hit on him is a bang and a free reassembly where it happened. Nothing taken away. It never attacks while he is
// behind the picker or just reassembled." Every number is TUNE.titan.atk; titan_checks.js sections 10-18 measure each.)
//   * ONLY PROVOKED: his first hit on it this life, or him coming within provokeR of its middle from outside it.
//     Rebuilt, it has forgotten. AN ATTACK THAT HITS HIM SATISFIES IT: provoked again only by his next missile hit, or
//     by him going out beyond provokeR and coming back in -- left hands-off where it got him, nothing comes again.
//   * ONLY THE PLANE AND THE HELICOPTER, in the air, within startR, and never: behind the cards, in the rescue, in dad
//     mode, in pieces, landing (an engaged approach he is lined up on, within atk.landLat of the runway's line:
//     tnAtkLanding), on the ground, within atk.calm (15 s) after ANY reassembly of his or a
//     stand-down, within atk.gap of the last one (which runs on behind the cards), within afterCards of the cards
//     shutting, while it staggers or keeps still, or held (the harness's freeze).
//     tnAtkWhyNot names the rule that holds it back.
//   * IT STARTS ONLY WHERE HE CAN SEE IT: its middle on his screen, and the mark -- or three dots of its path -- too.
//     (So from his seat, hovering dead still behind it, no tail: its mark would be his own eye.)
//   * EVERY ONE ANNOUNCED: at the flash its eyes flash yellow and white, bigger, and the wind-up roar plays; the MARK
//     -- a striped ring, yellow and white, turned to him, its stripes turning, closing in to its true size as the
//     strike comes -- stands where his straight-line flight puts him at the strike, and bright yellow dots (the same
//     size on his screen at any range) run to it. The mark is fixed at the flash and never re-aimed. The ring is never
//     drawn round his own eye: from his SEAT it is gone with his eye within ringNearHide of its radii, whole by
//     ringNearFull (a hovering helicopter IS its own mark: there the dots running from it to him say it is aimed at
//     him); from the CHASE view the ring round him is the picture, gone only with the camera inside it. A tail swipe
//     he can no longer be shown -- switched to his seat mid-swipe: its ring round his eye, its path beside him -- is
//     called off ("unseen") at any moment of it, wind-up or strike. And after an attack HITS him, what is left of that
//     bang near him when he is put back (its debris and smoke boxes, its crash smoke) is cleared, within smokeClearR.
//   * NOTHING OF IT CAN BANG HIM SOONER THAN minLead (5.5 s) AFTER THE FLASH -- its own test runs only from then.
//     The boulder: 3.0 s gathering scrap in its hands, 2.8 s on its arc to the mark. The beam: 3.0 s charging at its
//     eyes (a glow), then a bright bar from them SWEEPING in the upright plane through its eyes and the mark: on at
//     the sea in front of it, its tip walking out across the water (steam where it touches) and up to the mark at
//     6.0 s, held 0.7 s. Not across a fan -- a sideways sweep puts one side of every dodge into it; in the upright
//     plane any sideways steer is clear of it, and climbing is clear (it never goes past the mark). The tail: only
//     when his mark is low and close behind or beside it; 4.0 s coiling AWAY from the mark, lifted, then a sweep
//     through it (at 5.9 s) and on. Pointing, not timing: any steer away from the mark is safe; flying straight on,
//     hands-off, is hit. (The parent, 2026-11-15: a steer begun within 3 s of the flash must escape -- measured, every
//     attack, plane and helicopter, east end and home, begun at 2.5 and 3.0 s; begun later he may be hit, and that is fine.)
//   * WHAT BANGS HIM IS THE THING ITSELF: the boulder's ball (r + pad), the beam's bar from its eyes to its tip, the
//     tail's own capsule. Not the registry: a moving wall is what the registry is not for, and its law shoves a
//     hovering helicopter where the parent's rule says a hit is a bang. A hit is the mid-air's own bang (traffic.js):
//     in pieces where it happened, put back there by the one bang branch (flight.js) -- raised over its head, the wall
//     law's over-the-top rule (top + clearAbove: 188 m over the sea), so the straight line he comes back on clears it.
//     One bang size for both (atk.bang). A missile he puts into the tail through a swipe -- off the registry -- is
//     still a hit on it (tnTailMissiles), and knocks the swipe out of its wind-up like any hit.
//   * NEVER A LOOP: a hit satisfies it (above); after any other reassembly no flash for atk.calm. Any bang of his calls
//     an attack under way off the first frame it sees him in pieces.
//   * HIS COUNTER-MOVE: his missile hitting it during a wind-up knocks it out of it (it staggers -- or, him inside its
//     sweep, blinks -- and the attack is called off).
//   * GIVEN UP VISIBLY, never fired at nothing: flown beyond giveUpR while it winds up, behind the cards, on the
//     ground, landing (as above), in pieces, a tail swipe he can no longer see -- the boulder crumbles into junk, the eyes stop flashing, a wah-wah, and
//     its ring and dots shrink away in `abandon` s. A stand-down, dad mode or its fall end it at once.
//   * One attack at a time; every piece made once at load (the boulder, the ring, the dots, the beam, one glow).
//     Bright toy colours, no red wash: the eyes flash yellow, the ring is yellow and white, the beam pale cyan.
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
  // (v219) the attacks: provoked this life; the attack under way (one at a time); no flash while atkCalm or
  // atkGap runs; which kind next (atkN alternates the boulder and the beam; atkPick, the harness's, chooses)
  provoked: false, atk: null, atkCalm: 0, atkGap: 0, atkN: 0, atkPick: null, wasEx: false,
  tailBlend: 0, tailYaw: 0, tailPitch: 0, tailOff: false,   // the tail in a swipe: how far its pose is the swipe's; its record off
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
  tail.rotation.order = "YXZ";   // (v219) its lift is its own elevation, whichever way it has swung
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

  tnAtkBuild(mat);
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
  titan.provoked = false; titan.wasOutside = true; titan.atkCalm = 0; titan.atkGap = 0; titan.atkN = 0; titan.wasEx = false; titan.wasMenu = false;
  tnAtkStop("reset", false);
  titan.tailBlend = 0; titan.tailOff = false;
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
  for (const r of titan.recs) r.mesh.visible = on && !(r.tnPart === "tail" && titan.tailOff);
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
  tnAtkStop("hidden", false);
  tnShow(false);
  tnSolidOn(false);
  titan.sparkPts.visible = false; titan.puffPts.visible = false; titan.debrisMesh.visible = false;
  tnArrow(false);
}
// Whatever it was doing to him, it stops: a fresh start, a change of vehicle, an eject. It forgets him, keeps
// still for a moment, and (v219) an attack under way is gone at once -- he is somewhere else, or under the
// canopy (update() runs nothing of the world then, so nothing of it may be left to finish) -- and no flash for
// its calm time.
function tnStandDown(why) {
  if (!titan.built) return;
  titan.watching = false; titan.facing = false;
  titan.calm = Math.max(titan.calm, TITAN.grace);
  tnAtkStop("standDown", false);
  titan.atkCalm = Math.max(titan.atkCalm, TITAN.atk.calm);
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
  flags["tnSnd_" + kind] = (flags["tnSnd_" + kind] || 0) + 1;   // (v219) every one-shot it plays, by kind: the checks hear what it says
  if (kind === "windup") {
    // (v219) an attack's announcement: a toy wind-up -- a ratchet of clicks rising, then two bright honks
    // (every part of it over within 0.9 s: a given-up attack leaves nothing of its voice for long)
    for (let i = 0; i < 6; i++) synthBlip("square", 900 + i * 110, 900 + i * 110, 0.04, 0.07 * g, i * 0.07);
    synthBlip("sawtooth", 220, 440, 0.55, 0.16 * g, 0.05); synthBlip("square", 330, 660, 0.5, 0.06 * g, 0.07);
    synthBlip("sawtooth", 294, 392, 0.3, 0.18 * g, 0.58);
  } else if (kind === "throw") {
    noiseBurst(0.7, 900, 0.22 * g, 0); synthBlip("sine", 300, 120, 0.6, 0.12 * g, 0);
  } else if (kind === "hum") {
    synthBlip("sine", 520 + (titan.atk ? titan.atk.t : 0) * 160, 560 + (titan.atk ? titan.atk.t : 0) * 160, 0.18, 0.07 * g, 0);
  } else if (kind === "zap") {
    synthBlip("triangle", 1200, 600, 0.5, 0.14 * g, 0); synthBlip("sine", 880, 660, 0.5, 0.08 * g, 0.02);
  } else if (kind === "swipe") {
    noiseBurst(1.0, 700, 0.24 * g, 0); synthBlip("sine", 160, 80, 0.8, 0.14 * g, 0);
  } else if (kind === "fizzle") {
    // given up or knocked out of it: a deflating toy, wah-wah, short
    synthBlip("square", 420, 260, 0.22, 0.09 * g, 0); synthBlip("square", 300, 120, 0.3, 0.09 * g, 0.22);
  } else if (kind === "thud") {
    noiseBurst(0.6, 420, 0.3 * g, 0); synthBlip("sine", 80, 40, 0.5, 0.25 * g, 0);
  } else if (kind === "roar") {
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
  // (v219) a tail swipe: the ANNOUNCED exception to "nothing swung while he is near" -- its record is off the
  // registry for all of it (titan.tailOff), and only the swipe's own test, after minLead, can bang him
  if (titan.tailBlend > 0) {
    const b = titan.tailBlend;
    P.tail.rotation.y = lerp(P.tail.rotation.y, titan.tailYaw, b);
    P.tail.rotation.x = lerp(P.tail.rotation.x, titan.tailPitch, b);
  }
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
  // (v219) an attack's wind-up: the eyes FLASH, yellow and white, bigger -- the announcement
  const flash = tnAtkFlashing(), fOn = flash && Math.floor(titan.clock * T.atk.flashHz * 2) % 2 === 0;
  for (const e of titan.eyes) {
    e.s.position.copy(tnV.copy(e.p).applyMatrix4(P.head.matrixWorld));
    e.lit = titan.phase === "up" || titan.phase === "rising" && titan.t > tnHeadUpAt();   // out the moment it falls
    const dim = frac < 1 / 3 ? T.eyeDim : 1;
    e.s.scale.setScalar(T.eyeSize * (flash ? T.atk.eyeFlash : dim) * (titan.stagger > 0 ? 0.7 : 1));
    e.s.material.color.setHex(flash ? (fOn ? TUNE.palette.warning : 0xffffff) : T.eyeColor);
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
  // (v219) his hit provokes it -- and knocks it out of a wind-up: his counter-move, and it shows (tnAtkAbandon)
  if (!titan.provoked) { titan.provoked = true; flags.tnProvoked_hit = (flags.tnProvoked_hit || 0) + 1; }
  if (titan.atk && titan.atk.on && titan.atk.stage === "wind") tnAtkAbandon("hit");
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

// (v219) Through a tail swipe the tail is off the registry -- so the missiles' registry test (traffic.js) does not see
// it -- yet a missile he puts into it must not fly through: its own capsule is tested here, a hit like any other
// (it knocks the swipe out of its wind-up as a hit anywhere does)
function tnTailMissiles() {
  if (!titan.tailOff || titan.phase !== "up" || typeof missiles === "undefined") return;
  const r = tnTailRec();
  for (const m of missiles) {
    if (!m.alive || !solidTest(r, m.x, m.y, m.z, TITAN.hitPad)) continue;
    if (!tnMissileHit(r, m.x, m.y, m.z, m)) continue;
    m.alive = false; m.mesh.visible = false;
    triggerExplosion(m.x, m.y, m.z, TA.tailBoom, state.exploding);
    flags.missileHits = (flags.missileHits || 0) + 1;
    flags.tnTailHits = (flags.tnTailHits || 0) + 1;
  }
}

// ---- the phases ---------------------------------------------------------------
function tnStartRise() {
  const T = TITAN;
  if (titan.phase === "down" || titan.phase === "fall") { const h = T.path[T.home]; titan.x = h[0]; titan.z = h[1]; }
  titan.y = seaLevelAt(titan.x, titan.z);
  titan.roared = false;
  titan.walk = 0; titan.stagger = 0; titan.headYaw = 0; titan.headPitch = 0; titan.near = false;
  titan.provoked = false; titan.wasOutside = true;   // (v219) rebuilt, it has forgotten him
  titan.phase = "rising"; titan.t = 0;
  tnRepair();
  flags.tnRises = (flags.tnRises || 0) + 1;
}
function tnStartFall() {
  const T = TITAN;
  titan.phase = "fall"; titan.fallT = 0; titan.t = 0; titan.splashed = false; titan.fires = 0; titan.fireT = 0; titan.horned = false;
  titan.stagger = 0;
  tnAtkStop("fall", true);   // (v219) an attack dies with it: a boulder in its hands crumbles, the rest goes
  titan.tailBlend = 0; titan.tailOff = false;
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
    triggerExplosion(tnV.x, tnV.y, tnV.z, TITAN.shrugBoom, true);
    for (let i = 0; i < TITAN.shrugSparks; i++) { const a = tnRnd() * Math.PI * 2, u = tnRnd(); tnSpark(tnV.x, tnV.y, tnV.z, Math.cos(a) * TITAN.shrugSpread * u, 6 + tnRnd() * 14, Math.sin(a) * TITAN.shrugSpread * u, 0.5 + tnRnd() * 0.5, TUNE.palette.white, 12, 0.5); }
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
  // (v219) his bangs, wherever: an attack under way is called off the first frame it sees him in pieces
  // (tnAtkUpdate, "bang": he is never put back together into a strike), and nothing flashes for atk.calm after he is back
  if (!state.exploding && titan.wasEx) {
    titan.atkCalm = Math.max(titan.atkCalm, TA.calm);
    // put back together after an attack HIT: what is left of that bang near him -- its debris and smoke boxes
    // (explosion.js), its crash smoke (landmarks.js) -- goes, so nothing of it hangs across his view as he flies on
    // (readability beats realism; every other bang keeps its debris as ever)
    if (titan.atkHitPending) { titan.atkHitPending = false; tnClearBangNear(); }
  }
  // ... and only that bang: the mark lives while he is in pieces, never past it (a reset that puts him back unseen by
  // this edge -- a fresh start, the picker -- must not leave it to clear some later bang of his)
  if (!state.exploding) titan.atkHitPending = false;
  titan.wasEx = !!state.exploding;
  // the cards shut: never a flash on the frame they close (atk.afterCards); the gap and calm run on behind them
  const menuNow = typeof menuOpen === "function" && menuOpen();
  if (titan.wasMenu && !menuNow) titan.atkGap = Math.max(titan.atkGap, TA.afterCards);
  titan.wasMenu = menuNow;
  titan.atkCalm = Math.max(0, titan.atkCalm - dt);
  titan.atkGap = Math.max(0, titan.atkGap - dt);
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
    // (v219) provoked by nearness (his first hit provokes it too, tnMissileHit); then its attacks
    if (d > TA.provokeR) titan.wasOutside = true;
    if (!titan.provoked && titan.wasOutside && tnShooter() && d < TA.provokeR) { titan.provoked = true; titan.wasOutside = false; flags.tnProvoked_near = (flags.tnProvoked_near || 0) + 1; }
    tnAtkUpdate(dt, d);
    // NEVER A PART SWUNG INTO HIM: inside its sweep it holds every joint where it is -- no turn, no step,
    // no head, no stagger -- so anything he meets there is a wall he flew into, never one that came at him
    if (!titan.near) titan.stagger = Math.max(0, titan.stagger - dt);
    const still = titan.hold || titan.calm > 0 || titan.stagger > 0 || titan.near || !!(titan.atk && titan.atk.on);   // (v219) it holds still to attack
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
    // (not while it attacks: far off, its fogged steam drifting past its head read as grey smoke from its eyes)
    if (titan.steamT <= 0 && !(titan.atk && titan.atk.on)) {
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
  if (titan.phase !== "up") tnAtkTail(dt);
  tnPose(dt);
  tnFollow();
  tnAtkPieces(dt);
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
  tnTailMissiles();
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
      // (v219) into water it sinks with a splash; on LAND it comes to rest on the ground (it fell through the land,
      // out of sight, before: the boulder's junk on the beach was never seen)
      if (tnIsWater(d.x, d.z)) {
        if (d.y < sea - 2) { if (d.vy < -4) tnSplashRing(d.x, d.z, 6, 4, 5, 1.2); d.life = 0; }
      } else {
        const g = terrainEff(d.x, d.z) + d.sy * 0.5;
        if (d.y < g) { const k = TITAN.debrisRest; d.y = g; d.vx *= k; d.vz *= k; d.vy = 0; d.wx *= k; d.wy *= k; }
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

// ---- v219: THE ATTACKS ----------------------------------------------------------------
// (the rules are the header's "THE ATTACKS"; every number is TUNE.titan.atk)
const TA = TITAN.atk;
const tnAtkV = new THREE.Vector3(), tnAtkV2 = new THREE.Vector3(), tnAtkV3 = new THREE.Vector3(), tnAtkMi = new THREE.Matrix4();
const tnAtkUp = new THREE.Vector3(0, 1, 0);
const tnAtkMk = { x: 0, y: 0, z: 0, th: 0, rho: 0, qy: 0, beta: 0 };
const tnAtkRp = new THREE.Vector3();
// made once, at load, inside vkQuiet with the rest of it: the scrap boulder, the mark's ring, the dotted path, the
// beam, and one glow (the beam's charge and tip, the tail's tip) -- one attack at a time, so one of each
function tnAtkBuild(mat) {
  const P = TUNE.palette;
  // the boulder: a ball of a machine's junk -- bright plates, a pipe, a cog -- never a rock with a face
  {
    const k = tnKit();
    k.add(P.steel, new THREE.IcosahedronGeometry(0.92, 1), 0, 0, 0);
    // (bright toy plates all over it: from far off it reads as a ball of coloured junk, not a dark rock)
    const bits = [[P.red, 0.8, 0.25, 0.3, 0.3, 0.2], [P.warning, -0.6, 0.55, -0.4, -0.5, 0.9], [P.blue, 0.1, -0.85, 0.35, 1.1, 0.3],
                  [P.green, -0.4, -0.3, 0.85, 0.2, -0.7], [P.cyan, 0.55, 0.6, -0.55, 0.8, 0.5], [P.fire, -0.85, -0.2, -0.3, -0.3, 1.4],
                  [P.warning, 0.2, 0.9, 0.3, 1.2, 0.1], [P.red, -0.3, -0.6, -0.75, 0.6, 2.0], [P.green, 0.9, -0.3, -0.2, 0.1, 1.6]];
    for (const [c, x, y, z, rx, ry] of bits) k.add(c, new THREE.BoxGeometry(0.95, 0.7, 0.3), x, y, z, rx, ry, 0);
    k.add(P.steel, tnCyl(0.16, 0.16, 1.1, 8), 0.75, -0.55, -0.35, 0.6, 0, 0.9);    // a pipe sticking out
    k.add(P.warning, tnCyl(0.42, 0.42, 0.18, 10), -0.2, 0.95, 0.25, 0.4, 0, 0.2);  // a cog
    const m = k.build(mat);
    m.visible = false; scene.add(m);
    titan.boulder = m;
  }
  // the mark: a striped ring, yellow and white, turned to face him; its radius is what can bang him
  {
    const g = new THREE.TorusGeometry(1, TA.ringTube, 8, TA.ringSeg);
    const pos = g.attributes.position, col = [];
    const cw = new THREE.Color(P.warning), cl = new THREE.Color(0xffffff);
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getY(i), pos.getX(i)), s = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? cw : cl;
      col.push(s.r, s.g, s.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, depthWrite: false }));
    m.renderOrder = 5; m.visible = false; scene.add(m);
    titan.atkRing = m;
  }
  // the dotted path: where it will go, to the ring
  {
    const n = TA.beads, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setDrawRange(0, 0);
    // (pixel-sized, not world-sized: as big at 700 m as at 70 m, and never a blob round his own eye)
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, size: TA.beadPx, sizeAttenuation: false, vertexColors: true,
      transparent: true, depthWrite: false, fog: false, blending: THREE.NormalBlending }));
    m.frustumCulled = false; m.renderOrder = 5; m.visible = false; scene.add(m);
    titan.atkBeads = m;
  }
  // the beam: a bright bar from its eyes, base at its origin, grown along +y to the length it has reached
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: TUNE.palette.cyan, fog: false, transparent: true, opacity: TA.beam.opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 5; m.visible = false; scene.add(m);
    titan.atkBeam = m;
  }
  { const s = glowSprite(TITAN.eyeColor, TA.glowStart[0], TA.glowStart[1]); s.visible = false; scene.add(s); titan.atkGlow = s; }
}
function tnAtkPieces3() { return [titan.boulder, titan.atkRing, titan.atkBeads, titan.atkBeam, titan.atkGlow]; }
function tnAtkShown() { return titan.built && tnAtkPieces3().some(o => o.visible); }
function tnAtkFlashing() { const A = titan.atk; return !!(A && A.on && A.stage === "wind"); }
// he is in the air in something that shoots (ask the vehicle first, the phase last)
function tnAloft() { return tnShooter() && (state.phase === "AIRBORNE" || state.phase === "CLIMB_AWAY"); }
// his velocity: what "straight on" means for each
function tnHisVel(out) {
  if (vehKind() === "heli") return out.set(heli.vx || 0, heli.vy || 0, heli.vz || 0);
  const sp = state.speed, p = state.pitch * DEG, h = state.heading;
  return out.set(-Math.sin(h) * Math.cos(p) * sp, Math.sin(p) * sp, -Math.cos(h) * Math.cos(p) * sp);
}
function tnAtkLead(kind) { const K = TA[kind]; return kind === "boulder" ? K.wind + K.fly : kind === "beam" ? K.wind + K.reach : K.hitAt; }
function tnAtkLiveTo(kind) { const K = TA[kind]; return kind === "boulder" ? K.liveTo : kind === "beam" ? K.wind + K.reach + K.hold : K.end; }
function tnTailRec() { return titan.recs.find(r => r.tnPart === "tail"); }
function tnAtkHitR(kind) { return kind === "boulder" ? TA.boulder.r + TA.boulder.pad : kind === "beam" ? TA.beam.r + TA.beam.pad : tnTailRec().cap.r + TA.tail.pad; }
// the tail's resting elevation (its capsule's axis), from its points
function tnTailRestElev() { const A = TITAN.tailPts[TITAN.tailPts.length - 1]; return Math.atan2(A[1], -A[2]); }
// THE MARK: where his straight-line flight puts him at the strike, if this attack can reach it there
function tnAtkMarkFor(kind, out) {
  tnHisVel(tnAtkV); const lead = tnAtkLead(kind);
  out.x = state.x + tnAtkV.x * lead; out.y = state.y + tnAtkV.y * lead; out.z = state.z + tnAtkV.z * lead;
  const sea = seaLevelAt(titan.x, titan.z), K = TA.tail;
  if (kind === "tail") {
    // in the body's frame, from the tail's pivot: how far out, which way round (0 = straight back), how high
    const P = titan.parts;
    tnAtkMi.copy(P.body.matrixWorld).invert();
    tnAtkV2.set(out.x, out.y, out.z).applyMatrix4(tnAtkMi).sub(P.tail.position);
    out.rho = Math.hypot(tnAtkV2.x, tnAtkV2.z); out.th = Math.atan2(-tnAtkV2.x, -tnAtkV2.z); out.qy = tnAtkV2.y;
    out.beta = Math.atan2(tnAtkV2.y, out.rho) - tnTailRestElev();
    const h = out.y - sea;
    if (out.rho < K.inner || out.rho > K.reach || Math.abs(out.th) > K.sector * DEG) return null;
    if (h < K.minH || h > K.maxH || out.beta < K.pitchMin * DEG || out.beta > K.pitchMax * DEG) return null;
    return out;
  }
  const dh = Math.hypot(out.x - titan.x, out.z - titan.z), h = out.y - sea;
  if (dh < TA.markMin || dh > TA.markMax || out.y - tnGround(out.x, out.z) < TA.markSea || h > TA.markTop) return null;
  return out;
}
// the eyes' middle, world
function tnEyeMid(out) { return out.copy(titan.eyes[0].s.position).add(titan.eyes[1].s.position).multiplyScalar(0.5); }
// a point along an attack's path to its mark, u from 0 (it) to 1 (the mark)
function tnAtkPath(A, u, out) {
  if (A.kind === "boulder") {
    const h = TA.boulder.arc * Math.hypot(A.mx - A.p0x, A.mz - A.p0z);
    return out.set(A.p0x + (A.mx - A.p0x) * u, A.p0y + (A.my - A.p0y) * u + 4 * h * u * (1 - u), A.p0z + (A.mz - A.p0z) * u);
  }
  if (A.kind === "beam") { tnEyeMid(out); return out.set(out.x + (A.mx - out.x) * u, out.y + (A.my - out.y) * u, out.z + (A.mz - out.z) * u); }
  const th = A.thS + (A.thE - A.thS) * u, P = titan.parts;
  return out.set(-Math.sin(th) * A.rho, A.qy, -Math.cos(th) * A.rho).add(P.tail.position).applyMatrix4(P.body.matrixWorld);
}
// the ring's drawn radius: what bangs, never under ringMinFrac of its distance from his eye, closing in from
// ringStart times that over the wind-up to it at the strike
function tnAtkRingR(A) {
  const camD = camera.position.distanceTo(tnAtkRingPos(A, tnAtkRp));
  if (A.ringShrink > 0) return A.ringShrink;
  const close = Math.min(1, A.t / tnAtkLead(A.kind));
  return Math.max(A.hitR, camD * TA.ringMinFrac) * lerp(TA.ringStart, 1, close);
}
// how much of the ring may be drawn: none with his eye within ringNearHide of its radii (a hovering helicopter IS its
// own mark -- the ring would be a slab round his eye), all of it from ringNearFull
function tnAtkRingFade(A) {
  const P = tnAtkRingPos(A, tnAtkRp);
  let camD = camera.position.distanceTo(P);
  const R = tnAtkRingR(A);
  // the chase view: the camera behind him, the ring round HIM is what he should see -- gone only with the camera inside it
  if (state.viewChase) return clamp((camD / R - TA.ringNearHideChase) / (TA.ringNearFullChase - TA.ringNearHideChase), 0, 1);
  // (from his seat his eye IS where he is -- the camera easing in after a switch of view must not show it him meanwhile)
  camD = Math.min(camD, Math.hypot(state.x - P.x, state.y - P.y, state.z - P.z));
  return clamp((camD / R - TA.ringNearHide) / (TA.ringNearFull - TA.ringNearHide), 0, 1);
}
// the beam's tip, f from 0 (on) to 1 (at the mark): in the upright plane through its eyes (where they were as it came
// on) and the mark -- on the sea startAt of the way out, across the water to under the mark by seaUntil, then up to it
function tnBeamTip(A, f, out) {
  // (over the GROUND: on the water's surface, or over land on the land -- never under it)
  const K = TA.beam;
  if (f < K.seaUntil) { const h = lerp(K.startAt, 1, f / K.seaUntil), x = A.ex + (A.mx - A.ex) * h, z = A.ez + (A.mz - A.ez) * h; return out.set(x, tnGround(x, z), z); }
  return out.set(A.mx, lerp(tnGround(A.mx, A.mz), A.my, (f - K.seaUntil) / (1 - K.seaUntil)), A.mz);
}
// the ground under a point: the land, or the water's surface (water is terrainEff under seaLevelAt, nothing else)
function tnGround(x, z) { return Math.max(terrainEff(x, z), seaLevelAt(x, z)); }
function tnIsWater(x, z) { return terrainEff(x, z) < seaLevelAt(x, z); }
// the boulder past its mark, tt s on: on along its arc's own velocity, falling under g -- the one place it is written
function tnBoulderFall(A, tt, out) {
  const K = TA.boulder, h = K.arc * Math.hypot(A.mx - A.p0x, A.mz - A.p0z);
  return out.set(A.mx + (A.mx - A.p0x) / K.fly * tt, A.my - 4 * h / K.fly * tt - 0.5 * K.g * tt * tt, A.mz + (A.mz - A.p0z) / K.fly * tt);
}
// would this attack's path to its mark go under ground or through a solid (anything but the robot)? -- its arc, its
// line from the eyes, its beam's walk over the ground -- past pathSkip from its middle (its own hands and head)
function tnAtkPathClear(A) {
  const n = TA.beads, c = TA.pathClear, pts = [];
  // its points (past pathSkip from its middle): the arc or the line -- and the beam's walk over the ground
  for (let i = 1; i <= n; i++) { tnAtkPath(A, i / n, tnAtkV3); if (Math.hypot(tnAtkV3.x - titan.x, tnAtkV3.z - titan.z) >= TA.pathSkip) pts.push([tnAtkV3.x, tnAtkV3.y, tnAtkV3.z, c]); }
  if (A.kind === "beam") {
    tnEyeMid(tnAtkV2); A.ex = tnAtkV2.x; A.ez = tnAtkV2.z;
    for (let i = 0; i <= n; i++) { tnBeamTip(A, i / n, tnAtkV3); if (Math.hypot(tnAtkV3.x - titan.x, tnAtkV3.z - titan.z) >= TA.pathSkip) pts.push([tnAtkV3.x, tnAtkV3.y + TA.tipLift, tnAtkV3.z, -1]); }
    A.ex = undefined; A.ez = undefined;
  }
  flags.tnPathEvals = (flags.tnPathEvals || 0) + 1;
  // under the ground (the walk sits on it: only its line and arc are asked)
  for (const p of pts) if (p[3] >= 0 && p[1] < tnGround(p[0], p[2]) + c) return false;
  if (!pts.length) return true;
  // through a solid: ONE walk of the registry for the whole path, each record first tested against the path's box
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
  const m = TA.pathBox;
  let hit = false;
  flags.tnPathWalks = (flags.tnPathWalks || 0) + 1;
  forEachSolid(b => {
    if (hit || b.tn || isSolidHidden(b)) return;
    if (b.x + b.hw < x0 - m || b.x - b.hw > x1 + m || b.z + b.hd < z0 - m || b.z - b.hd > z1 + m || b.y1 < y0 - m || b.y0 > y1 + m) return;
    for (const p of pts) { flags.tnPathTests = (flags.tnPathTests || 0) + 1; if (solidTest(b, p[0], p[1], p[2], c)) { hit = true; return; } }
  }, (x0 + x1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0) / 2 + m);
  return !hit;
}
// where the ring is DRAWN: at the mark -- or, from his SEAT with his eye too near the mark for it to be a ring (a
// hovering helicopter IS its mark), slid back along the line from the mark to its eyes until it is ringNearFull of its
// radii from his eye, never nearer the robot than ringSlideMin -- the boulder and the beam. Drawing only: the mark and
// the test do not move.
function tnAtkRingPos(A, out) {
  out.set(A.mx, A.my, A.mz);
  A.ringShrink = 0;
  if (state.viewChase || A.kind === "tail") return out;   // (the tail's path runs beside him: no line to slide along)
  const eye = camera.position, close = Math.min(1, A.t / tnAtkLead(A.kind));
  const R = A.hitR * lerp(TA.ringStart, 1, close), want = TA.ringNearFull * R;
  if (eye.distanceTo(out) >= want) return out;
  tnEyeMid(tnAtkV3); tnAtkV3.sub(out);
  const L = Math.max(0, tnAtkV3.length() - TA.ringSlideMin); tnAtkV3.normalize();
  let lo = 0, hi = L;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (eye.distanceTo(tnAtkV2.copy(out).addScaledVector(tnAtkV3, m)) < want) lo = m; else hi = m; }
  out.addScaledVector(tnAtkV3, hi);
  // no room to slide it far enough (him near the robot): as far as there is, and SMALLER -- ringNearFull of its own
  // radii from his eye, so its band is the same share of his screen. Never absent.
  const d = eye.distanceTo(out);
  if (d < want) A.ringShrink = d / TA.ringNearFull;
  return out;
}
// where the boulder sits in its hands, world
function tnAtkHand(out) { const h = TA.boulder.hand; return out.set(h[0], h[1], h[2]).applyMatrix4(titan.parts.body.matrixWorld); }
// is this attack's mark -- or enough of its path -- on his screen as it would start
function tnAtkSeenNow(A) {
  camera.updateMatrixWorld();
  const inside = (v) => { v.project(camera); return v.z < 1 && Math.abs(v.x) < TA.seenEdge && Math.abs(v.y) < TA.seenEdge; };
  // the ring counts only where it is drawn (not round his own eye: tnAtkRingFade)
  if (tnAtkRingFade(A) > TA.ringSeenFade && inside(tnAtkV3.copy(tnAtkRingPos(A, tnAtkRp)))) return true;
  let n = 0;
  for (let i = 1; i < TA.beads; i++) { tnAtkPath(A, i / TA.beads, tnAtkV3); if (tnAtkV3.distanceTo(camera.position) < TA.beadNear) continue; if (inside(tnAtkV3)) n++; }
  return n >= TA.seenDots;
}
function tnAtkStart(kind, mk) {
  const A = titan.atk || (titan.atk = {});
  A.on = true; A.kind = kind; A.stage = "wind"; A.t = 0; A.ta = 0; A.why = ""; A.hit = false; A.humT = 0; A.firstLive = -1; A.splashed = false; A.lastGap = undefined; A.ex = undefined; A.ez = undefined; A.struck = false;
  A.mx = mk.x; A.my = mk.y; A.mz = mk.z; A.hitR = tnAtkHitR(kind);
  tnAtkHand(tnAtkV); A.p0x = tnAtkV.x; A.p0y = tnAtkV.y; A.p0z = tnAtkV.z;
  if (kind === "tail") {
    const K = TA.tail, s = mk.th >= 0 ? 1 : -1;
    A.rho = mk.rho; A.qy = mk.qy; A.beta = mk.beta; A.th = mk.th;
    A.thS = clamp(mk.th - s * K.swing * DEG, -K.sector * DEG, K.sector * DEG);   // it coils to the side away from him ...
    A.thE = mk.th + (mk.th - A.thS) * (K.end - K.hitAt) / (K.hitAt - K.wind);     // ... and sweeps through his mark and on
    titan.tailOff = true;
    const r = tnTailRec(); if (r) r.mesh.visible = false;
  } else titan.atkN++;
  // readability beats realism: the smoke of one of his own bangs (landmarks.js startSmoke, dark faceted puffs that rise
  // for ~10 s where he went to pieces) is cleared round him and its mark -- nothing hides what it is about to do
  if (typeof smokeSources !== "undefined") {
    const near = (x, z) => Math.hypot(x - state.x, z - state.z) < TA.smokeClearR || Math.hypot(x - A.mx, z - A.mz) < TA.smokeClearR;
    for (let i = smokeSources.length - 1; i >= 0; i--) if (near(smokeSources[i].x, smokeSources[i].z)) smokeSources.splice(i, 1);
    for (const p of smokePuffs) if (p.life > 0 && near(p.mesh.position.x, p.mesh.position.z)) { p.life = 0; p.mesh.visible = false; flags.tnSmokeCleared = (flags.tnSmokeCleared || 0) + 1; }
  }
  flags.tnAttacks = (flags.tnAttacks || 0) + 1;
  flags["tnAtk_" + kind] = (flags["tnAtk_" + kind] || 0) + 1;
  flags.tnAtkFlashes = (flags.tnAtkFlashes || 0) + 1;
  titan.roarJaw = 1;
  if (tnSound("windup")) flags.tnAtkRoars = (flags.tnAtkRoars || 0) + 1;
  return true;
}
// may it start one now, and which
// why it may not start one now ("" = it may): the first rule that holds it back
function tnAtkWhyNot(d) {
  if (d === undefined) d = tnDist();
  if (titan.phase !== "up") return "not up";
  if (titan.hold) return "held";
  if (typeof dadHere === "function" && dadHere()) return "dad";
  if (!tnShooter()) return "not a plane or helicopter";
  if (typeof eject !== "undefined" && eject.active) return "eject";
  if (typeof menuOpen === "function" && menuOpen()) return "picker";
  if (state.exploding) return "in pieces";
  if (!tnAloft()) return "on the ground";
  if (tnAtkLanding()) return "landing";
  if (!titan.provoked) return "not provoked";
  if (titan.atk && titan.atk.on) return "one under way";
  if (titan.atkCalm > 0) return "calm";
  if (titan.atkGap > 0) return "gap";
  if (titan.calm > 0) return "still";
  if (titan.stagger > 0) return "staggering";
  if (d > TA.startR) return "far";
  if (!tnOnScreen()) return "off his screen";   // it starts only where he can see it
  return "";
}
function tnAtkMaybe(d) {
  const no = tnAtkWhyNot(d);
  titan.atkNo = no;
  if (no) return;
  const A = titan.atk || (titan.atk = { on: false });
  const tryKind = (k) => {
    // the tail: only once it is home and back on the registry (a held tail never snaps to rest beside him)
    if (k === "tail" && (titan.tailOff || titan.tailBlend > 0)) return false;
    // a kind refused for its path is not asked again for refuseFor s
    titan.refusedT = titan.refusedT || {};
    if ((titan.refusedT[k] || 0) > titan.clock) return false;
    const mk = tnAtkMarkFor(k, tnAtkMk);
    if (!mk) return false;
    // (seen as it would be: the mark, or three dots of its path, on his screen)
    const was = { kind: A.kind, t: A.t, hitR: A.hitR, mx: A.mx, my: A.my, mz: A.mz, p0x: A.p0x, p0y: A.p0y, p0z: A.p0z, rho: A.rho, qy: A.qy, thS: A.thS, thE: A.thE };
    A.kind = k; A.t = 0; A.hitR = tnAtkHitR(k); A.mx = mk.x; A.my = mk.y; A.mz = mk.z; tnAtkHand(tnAtkV); A.p0x = tnAtkV.x; A.p0y = tnAtkV.y; A.p0z = tnAtkV.z;
    if (k === "tail") { const s = mk.th >= 0 ? 1 : -1; A.rho = mk.rho; A.qy = mk.qy; A.thS = clamp(mk.th - s * TA.tail.swing * DEG, -TA.tail.sector * DEG, TA.tail.sector * DEG); A.thE = mk.th; }
    let seen = tnAtkSeenNow(A);
    if (seen && k !== "tail" && !tnAtkPathClear(A)) { seen = false; titan.refusedT[k] = titan.clock + TA.refuseFor; flags.tnAtkRefused = (flags.tnAtkRefused || 0) + 1; }
    Object.assign(A, was);
    return seen && tnAtkStart(k, mk);
  };
  if (titan.atkPick ? titan.atkPick === "tail" : true) if (tryKind("tail")) return;
  if (titan.atkPick === "tail") { titan.atkNo = "no tail mark"; return; }
  if (titan.near) { titan.atkNo = "near (no tail mark)"; return; }
  if (Math.abs(wrapPi(Math.atan2(state.x - titan.x, state.z - titan.z) - titan.yaw)) > TA.faceDeg * DEG) { titan.atkNo = "not facing him"; return; }
  const first = titan.atkPick || (titan.atkN % 2 ? "beam" : "boulder");
  if (tryKind(first)) return;
  if (!titan.atkPick && tryKind(first === "boulder" ? "beam" : "boulder")) return;
  titan.atkNo = "no mark it can reach and he can see";
}
// given up, or knocked out of it: visibly -- the boulder crumbles into junk, the eyes stop flashing, a wah-wah,
// and its ring and dots shrink away. Nothing of it can bang him from this frame.
function tnAtkAbandon(why) {
  const A = titan.atk;
  if (!A || !A.on || A.stage === "abandon" || A.stage === "done") return;
  A.stage = "abandon"; A.ta = 0; A.why = why;
  flags.tnAtkAbandons = (flags.tnAtkAbandons || 0) + 1;
  flags["tnAtkAbandon_" + why] = (flags["tnAtkAbandon_" + why] || 0) + 1;
  if (A.kind === "boulder") tnAtkCrumble();
  tnSound("fizzle");
}
function tnAtkCrumble() {
  const b = titan.boulder;
  if (!b.visible) return;
  const p = b.position, s = b.scale.x, P = TUNE.palette, cs = TITAN.plateColors;
  const C = TA.crumble;
  for (let i = 0; i < C.bits; i++) {
    const a = tnRnd() * Math.PI * 2, v = 6 + tnRnd() * 10;
    tnDebris(p.x + Math.cos(a) * s * 0.5, p.y, p.z + Math.sin(a) * s * 0.5, Math.cos(a) * v, 4 + tnRnd() * 8, Math.sin(a) * v,
      s * 0.4, s * 0.3, s * 0.25, P[cs[i % cs.length]], 6);
  }
  for (let i = 0; i < C.sparks; i++) { const a = tnRnd() * Math.PI * 2, u = tnRnd(); tnSpark(p.x, p.y, p.z, Math.cos(a) * C.spread * u, 4 + tnRnd() * 10, Math.sin(a) * C.spread * u, 0.6, P.warning, 12, 0.5); }
  b.visible = false;
}
// at once, nothing animated: a stand-down, dad mode, a reset, its fall (visible: a boulder in its hands crumbles)
function tnAtkStop(why, visible) {
  const A = titan.atk;
  if (A && A.on) {
    flags["tnAtkStop_" + why] = (flags["tnAtkStop_" + why] || 0) + 1;
    if (visible && A.kind === "boulder") tnAtkCrumble();
    A.on = false; A.stage = "off";
    titan.atkGap = Math.max(titan.atkGap, TA.gap);
  }
  if (titan.built) for (const o of tnAtkPieces3()) o.visible = false;
}
// a strike reached him: the ordinary bang -- the mid-air's own lines (traffic.js updateTraffic): in pieces where it
// happened, put back there by the one bang branch (flight.js), which lifts him over any solid he is above
function tnAtkHitHim() {
  const A = titan.atk;
  flags.tnAtkHits = (flags.tnAtkHits || 0) + 1;
  flags["tnAtkHit_" + A.kind] = (flags["tnAtkHit_" + A.kind] || 0) + 1;
  A.hit = true; A.stage = "done"; A.ta = 0; flags.tnAtkStruckThrough = (flags.tnAtkStruckThrough || 0) + 1;
  if (A.kind === "boulder") tnAtkCrumble();
  titan.atkHitAt = { x: state.x, y: state.y, z: state.z, t: A.t, kind: A.kind };
  triggerExplosion(state.x, state.y, state.z, TA.bang);   // (one size: the helicopter's bang as big as the plane's)
  state.exploding = true;
  state.explodeTimer = TUNE.reassembleDelay;
  safePos.x = state.x; safePos.z = state.z;
  // ... where it happened -- and over its head (the wall law's own over-the-top rule, as a bang into it comes back,
  // collision.js), so the straight line he is put back on clears it: hands-off, a second bang must not follow
  // (top + clearAbove over its standing sea: 188 m with today's numbers)
  safePos.y = Math.max(state.y, Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) + TA.overGround, titan.y + TITAN.top + TITAN.clearAbove);
  if (typeof shakeAmp !== "undefined") shakeAmp = Math.max(shakeAmp, TA.shake);
  titan.wasEx = true;
  // SATISFIED: it got him. Provoked again only by his next hit on it, or by him coming in from outside provokeR
  titan.provoked = false; titan.wasOutside = tnDist() > TA.provokeR;
  flags.tnSatisfied = (flags.tnSatisfied || 0) + 1;
  titan.atkHitPending = true;
}
function tnClearBangNear() {
  const r = TA.smokeClearR, near = (x, y, z) => Math.hypot(x - state.x, y - state.y, z - state.z) < r;
  if (typeof parts !== "undefined") for (const p of parts) if (p.alive && p.life > 0 && near(p.px, p.py, p.pz)) { p.life = 0; flags.tnBangCleared = (flags.tnBangCleared || 0) + 1; }
  if (typeof smokeSources !== "undefined") {
    for (let i = smokeSources.length - 1; i >= 0; i--) if (near(smokeSources[i].x, smokeSources[i].y, smokeSources[i].z)) smokeSources.splice(i, 1);
    for (const p of smokePuffs) if (p.life > 0 && near(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) { p.life = 0; p.mesh.visible = false; }
  }
}
// its clock: start one, wind it up, strike, finish -- run before its pose (the tail's swipe is a pose)
function tnAtkUpdate(dt, d) {
  const A = titan.atk;
  if (!A || !A.on) { tnAtkMaybe(d); tnAtkTail(dt); return; }
  A.t += dt;
  const K = TA[A.kind];
  const busy = (typeof menuOpen === "function" && menuOpen()) ? "picker" : state.exploding ? "bang" : !tnShooter() ? "vehicle" : !tnAloft() ? "ground" : tnAtkLanding() ? "landing" : "";
  if (A.stage === "wind") {
    const why = busy || (d > TA.giveUpR ? "far" : "") || (tnAtkTailUnseen(A) ? "unseen" : "");
    if (why) tnAtkAbandon(why);
    else {
      if (A.kind === "boulder" && Math.floor(A.t * 6) !== Math.floor((A.t - dt) * 6)) {
        // scrap gathering in its hands: sparks and clanks
        const p = titan.boulder.position;
        for (let i = 0; i < 4; i++) { const a = tnRnd() * Math.PI * 2; tnSpark(p.x, p.y, p.z, Math.cos(a) * 10, 4 + tnRnd() * 8, Math.sin(a) * 10, 0.5, TUNE.palette.warning, 10, 0.5); }
        if (Math.floor(A.t * 2) !== Math.floor((A.t - dt) * 2)) tnSound("click");
      }
      if (A.kind === "beam") { A.humT -= dt; if (A.humT <= 0) { A.humT = K.humEvery; tnSound("hum"); } }
      if (A.t >= K.wind) {
        A.stage = "strike";
        flags.tnAtkStrikes = (flags.tnAtkStrikes || 0) + 1;
        if (A.kind === "boulder") { tnAtkHand(tnAtkV); A.p0x = tnAtkV.x; A.p0y = tnAtkV.y; A.p0z = tnAtkV.z; tnSound("throw"); }
        else if (A.kind === "beam") { tnEyeMid(tnAtkV); A.ex = tnAtkV.x; A.ez = tnAtkV.z; A.struck = true; tnSound("zap"); }
        else tnSound("swipe");
      }
    }
  } else if (A.stage === "strike") {
    if (busy) tnAtkAbandon(busy);
    else if (tnAtkTailUnseen(A)) tnAtkAbandon("unseen");
    else if (A.kind === "boulder") {
      // past the mark, on down into the sea: a thud and a splash, and it is over
      const u = (A.t - K.wind) / K.fly;
      if (u > 1) {
        const tt = A.t - K.wind - K.fly, p = tnBoulderFall(A, tt, tnAtkV2);
        // down on the GROUND under it -- water (terrainEff under seaLevelAt): a splash; land: a thud and junk
        if (p.y < tnGround(p.x, p.z) || tt > K.sinkAfter) {
          if (!A.splashed) {
            A.splashed = true;
            if (tnIsWater(p.x, p.z)) { const S = K.splash; tnSplashRing(p.x, p.z, S[0], S[1], S[2], S[3]); flags.tnBoulderSplash = (flags.tnBoulderSplash || 0) + 1; }
            else {
              const gy = tnGround(p.x, p.z), P = TUNE.palette, cs = TITAN.plateColors;
              for (let i = 0; i < K.landJunk; i++) { const a = tnRnd() * Math.PI * 2, v = 4 + tnRnd() * 6; tnDebris(p.x, gy + 2, p.z, Math.cos(a) * v, 4 + tnRnd() * 5, Math.sin(a) * v, K.r * 0.35, K.r * 0.25, K.r * 0.2, P[cs[i % cs.length]], 4); }
              flags.tnBoulderLand = (flags.tnBoulderLand || 0) + 1;
            }
            tnSound("thud");
          }
          A.stage = "done"; A.ta = 0; titan.boulder.visible = false; flags.tnAtkStruckThrough = (flags.tnAtkStruckThrough || 0) + 1;
        }
      }
    } else if (A.t >= tnAtkLiveTo(A.kind)) { A.stage = "done"; A.ta = 0; flags.tnAtkStruckThrough = (flags.tnAtkStruckThrough || 0) + 1; }
  } else if (A.stage === "abandon" || A.stage === "done") {
    A.ta += dt;
    if (A.ta >= TA.abandon) { A.on = false; A.stage = "off"; titan.atkGap = Math.max(titan.atkGap, TA.gap); }
  }
  tnAtkTail(dt);
}
// how far he is from the tail capsule's surface
function tnTailGap() {
  const c = tnTailRec().cap, ax = c.a[0], ay = c.a[1], az = c.a[2], bx = c.b[0] - ax, by = c.b[1] - ay, bz = c.b[2] - az;
  const l2 = bx * bx + by * by + bz * bz || 1e-9, s = clamp(((state.x - ax) * bx + (state.y - ay) * by + (state.z - az) * bz) / l2, 0, 1);
  return Math.hypot(state.x - ax - bx * s, state.y - ay - by * s, state.z - az - bz * s) - c.r;
}
// (round 3) a tail swipe he can no longer be shown -- switched to his SEAT mid-swipe, its ring round his eye hidden and
// its path beside him -- is called off (visibly), at ANY moment of it, wind-up or strike: nothing comes at him that he
// cannot see. (Before round 6 only before minLead: switched to the seat after 5.5 s, the swipe still hit him.)
// (From the chase view the ring is round him; steered away there, the strike still comes and misses)
function tnAtkTailUnseen(A) {
  return A.kind === "tail" && !state.viewChase && !tnAtkSeenNow(A);
}
// the tail's swipe pose: coiled away from his mark over the wind-up (lifted), then swept through it; after, home
function tnAtkTail(dt) {
  const A = titan.atk, K = TA.tail;
  const swiping = A && A.on && A.kind === "tail" && (A.stage === "wind" || A.stage === "strike");
  if (swiping) {
    const t = A.t;
    titan.tailBlend = Math.min(1, t / TA.tailIn);
    if (t <= K.wind) {
      const e = smoothstep(0, 1, t / K.wind);
      titan.tailYaw = A.thS * e;
      titan.tailPitch = A.beta * e + K.lift * Math.sin(Math.PI * Math.min(1, t / K.wind));
    } else {
      titan.tailYaw = A.thS + (A.th - A.thS) * (t - K.wind) / (K.hitAt - K.wind);
      titan.tailPitch = A.beta;
    }
  } else if (titan.tailBlend > 0) {
    // called off or done: home -- but never toward or through him. While he is within sweepR of it, it HOLDS its pose
    // (off the registry, not a hit: passable), and goes home only once he is clear
    if (tnTailGap() < TITAN.sweepR) flags.tnTailHeld = (flags.tnTailHeld || 0) + 1;
    else titan.tailBlend = Math.max(0, titan.tailBlend - dt / K.back);
  }
  // home, and him not inside it: the tail is a wall again
  if (!swiping && titan.tailBlend === 0 && titan.tailOff) {
    const r = tnTailRec();
    if (!r || !solidTest(r, state.x, state.y, state.z, TITAN.insidePad)) { titan.tailOff = false; if (r) r.mesh.visible = !!titan.solid; }
  }
}
// every piece where it belongs this frame -- and the one test that can bang him: the thing itself, after minLead
function tnAtkPieces(dt) {
  const A = titan.atk, on = !!(A && A.on) && titan.phase === "up";
  const ring = titan.atkRing, beads = titan.atkBeads, beam = titan.atkBeam, glow = titan.atkGlow, bo = titan.boulder;
  if (!on) { for (const o of tnAtkPieces3()) o.visible = false; return; }
  const K = TA[A.kind], fade = A.stage === "abandon" || A.stage === "done" ? Math.max(0, 1 - A.ta / TA.abandon) : 1;
  const pulse = 1 + TA.ringPulse * Math.sin(titan.clock * Math.PI * 2 * TA.ringPulseHz);
  // the ring, facing his camera, its stripes turning; closing in toward its true size as the strike comes (a closing
  // iris: "keep out"); never smaller on his screen than ringMinFrac of its distance -- and never round his own eye
  const strikeOver = A.stage === "strike" && A.t > tnAtkLead(A.kind) + TA.strikeOver;
  const near = tnAtkRingFade(A);
  ring.visible = fade > 0.02 && near > 0.02 && !strikeOver && !A.hit;
  if (ring.visible) {
    ring.position.copy(tnAtkRingPos(A, tnAtkRp)); ring.lookAt(camera.position); ring.rotateZ(titan.clock * TA.ringSpin);
    ring.scale.setScalar(tnAtkRingR(A) * pulse * (TA.ringFadeFloor + (1 - TA.ringFadeFloor) * fade));
    ring.material.opacity = fade * near;
  }
  // the dotted path: all of it while it winds up; striking, only what is still ahead of the strike. Bright yellow
  // pixel-sized dots, none within beadNear of his eye
  let from = 0;
  if (A.stage === "strike") from = clamp((A.t - K.wind) / ((A.kind === "tail" ? K.end : tnAtkLead(A.kind)) - K.wind), 0, 1);
  const n = TA.beads, pos = beads.geometry.attributes.position.array, col = beads.geometry.attributes.color.array;
  tnColor.setHex(TUNE.palette.warning);
  beads.material.size = state.viewChase ? TA.beadPx : TA.beadPxSeat;
  let m = 0;
  if (!A.hit && fade > 0.02) for (let i = 1; i <= n; i++) {
    const u = i / n;
    if (u < from) continue;
    tnAtkPath(A, u, tnAtkV2);
    if (tnAtkV2.distanceTo(camera.position) < TA.beadNear) continue;
    pos[m * 3] = tnAtkV2.x; pos[m * 3 + 1] = tnAtkV2.y; pos[m * 3 + 2] = tnAtkV2.z;
    const k = (0.75 + 0.25 * Math.max(0, Math.sin(titan.clock * TA.beadPulse * Math.PI * 2 - u * 8))) * fade;
    col[m * 3] = tnColor.r * k; col[m * 3 + 1] = tnColor.g * k; col[m * 3 + 2] = tnColor.b * k;
    m++;
  }
  beads.geometry.setDrawRange(0, m);
  beads.geometry.attributes.position.needsUpdate = true; beads.geometry.attributes.color.needsUpdate = true;
  beads.visible = m > 0;
  // the boulder: gathering in its hands, then on its arc, then on down
  bo.visible = false;
  if (A.kind === "boulder" && !A.hit && (A.stage === "wind" || A.stage === "strike")) {
    if (A.stage === "wind") {
      tnAtkHand(tnAtkV);
      const g = Math.min(1, 0.15 + A.t / K.grow);
      bo.position.copy(tnAtkV); bo.position.y += Math.sin(A.t * TA.boulderBob[0]) * TA.boulderBob[1];
      bo.scale.setScalar(K.r * g);
    } else {
      const u = (A.t - K.wind) / K.fly;
      if (u <= 1) tnAtkPath(A, u, bo.position);
      else {
        tnBoulderFall(A, A.t - K.wind - K.fly, bo.position);
      }
      bo.scale.setScalar(K.r);
    }
    bo.rotation.set(A.t * TA.boulderSpin[0], A.t * TA.boulderSpin[1], 0);
    bo.visible = true;
  }
  // the beam: charging at its eyes (a glow), then a bar from its eyes SWEEPING in the upright plane through them and
  // the mark -- on at the sea in front of it, its tip walking out across the water (steam where it touches) and up
  // to the mark, held, faded
  beam.visible = false; glow.visible = false;
  const G = TA.glow;
  if (A.kind === "beam" && !A.hit) {
    tnEyeMid(tnAtkV);
    if (A.stage === "wind") {
      glow.visible = true; glow.position.copy(tnAtkV); glow.scale.setScalar(G.charge[0] + G.charge[1] * Math.min(1, A.t / K.wind) * pulse);
      glow.material.color.setHex(TITAN.eyeColor);
    } else if (fade > 0.02 && A.struck) {   // (a wind-up called off never shows a bar)
      tnBeamTip(A, clamp((A.t - K.wind) / K.reach, 0, 1), tnAtkV3);
      tnAtkV2.copy(tnAtkV3).sub(tnAtkV);
      const L = tnAtkV2.length();
      if (L > 0.5) {
        beam.visible = true;
        beam.position.copy(tnAtkV);
        beam.quaternion.setFromUnitVectors(tnAtkUp, tnAtkV2.normalize());
        beam.scale.set(K.r, L, K.r);
        beam.material.opacity = K.opacity * fade;
        glow.visible = true; glow.position.copy(tnAtkV3); glow.scale.setScalar(G.tip * pulse * fade);
        glow.material.color.setHex(0xffffff);
        // steam where it touches the water (the pooled puffs)
        A.steamT = (A.steamT || 0) - dt;
        if (A.stage === "strike" && tnIsWater(tnAtkV3.x, tnAtkV3.z) && tnAtkV3.y <= tnGround(tnAtkV3.x, tnAtkV3.z) + 0.5 && A.steamT <= 0) {
          A.steamT = K.steamEvery;
          tnPuff(tnAtkV3.x, tnAtkV3.y + 1, tnAtkV3.z, (tnRnd() - 0.5) * 4, 10 + tnRnd() * 8, (tnRnd() - 0.5) * 4, TA.steamLife, -1);
        }
      }
    }
  }
  if (A.kind === "tail" && (A.stage === "wind" || A.stage === "strike") && !A.hit) {
    const c = tnTailRec().cap;
    glow.visible = true; glow.position.set(c.b[0], c.b[1], c.b[2]); glow.scale.setScalar(G.tail * pulse);
    glow.material.color.setHex(TUNE.palette.warning);
  }
  // THE TEST. Only once minLead has run from the flash, only while it strikes, and only the thing itself: the
  // boulder's ball, the beam's bar from its eyes to its tip, the tail's own capsule
  if (A.stage !== "strike" || A.t < TA.minLead || A.t > tnAtkLiveTo(A.kind) || state.exploding || !tnAloft()) return;
  if (A.firstLive < 0) A.firstLive = A.t;
  let d = Infinity;
  if (A.kind === "boulder") d = bo.visible ? bo.position.distanceTo(tnAtkV.set(state.x, state.y, state.z)) - (K.r + K.pad) : Infinity;
  else if (A.kind === "beam") {
    if (beam.visible) {
      tnEyeMid(tnAtkV); const L = beam.scale.y;
      tnAtkV2.set(0, 1, 0).applyQuaternion(beam.quaternion);
      const px = state.x - tnAtkV.x, py = state.y - tnAtkV.y, pz = state.z - tnAtkV.z;
      const s = clamp(px * tnAtkV2.x + py * tnAtkV2.y + pz * tnAtkV2.z, 0, L);
      d = Math.hypot(px - tnAtkV2.x * s, py - tnAtkV2.y * s, pz - tnAtkV2.z * s) - (K.r + K.pad);
    }
  } else {
    const r = tnTailRec(), c = r.cap, ax = c.a[0], ay = c.a[1], az = c.a[2], bx = c.b[0] - ax, by = c.b[1] - ay, bz = c.b[2] - az;
    const l2 = bx * bx + by * by + bz * bz || 1e-9, s = clamp(((state.x - ax) * bx + (state.y - ay) * by + (state.z - az) * bz) / l2, 0, 1);
    d = Math.hypot(state.x - ax - bx * s, state.y - ay - by * s, state.z - az - bz * s) - (c.r + K.pad);
  }
  A.lastGap = d;
  if (d < 0) tnAtkHitHim();
}

// ---- the edge arrow: where it is, while it is up and off his screen ---------------
const tnProj = new THREE.Vector3(), tnProj2 = new THREE.Vector3(), tnProj3 = new THREE.Vector3();
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
  // (v219) and, in the chase view, never on his own aircraft: its disc on the screen, arrowPlaneR metres round him
  let me = null;
  if (state.viewChase) {
    camera.updateMatrixWorld();
    tnProj.set(state.x, state.y, state.z).project(camera);
    if (tnProj.z < 1) {
      const mx = (tnProj.x + 1) / 2 * W, my = (1 - tnProj.y) / 2 * H;
      tnProj2.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(TITAN.arrowPlaneR).add(tnProj3.set(state.x, state.y, state.z)).project(camera);
      const r = Math.max(TITAN.arrowPlaneMinPx, Math.hypot((tnProj2.x + 1) / 2 * W - mx, (1 - tnProj2.y) / 2 * H - my));
      me = { x: mx, y: my, r };
    }
  }
  titan.arrowMe = me;
  const blocked = (px, py) => {
    const L = px - hw, T0 = py - hw, R = px + hw, B = py + hw;
    if (B > floor - pad) return true;
    if (me && L < me.x + me.r + pad && R > me.x - me.r - pad && T0 < me.y + me.r + pad && B > me.y - me.r - pad) return true;
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
  const want = (titan.phase === "rising" || titan.phase === "up") && tnShooter() && !state.exploding && !tnLanding() &&
    !(typeof menuOpen === "function" && menuOpen()) && !(typeof eject !== "undefined" && eject.active) &&
    !(typeof dadHere === "function" && dadHere()) && tnDist() < TITAN.arrowR;
  if (!want) { tnArrow(false); return; }
  camera.updateMatrixWorld();
  tnProj.set(titan.x, titan.y + TITAN.top * 0.55, titan.z).project(camera);
  const behind = tnProj.z > 1;
  let sx = tnProj.x, sy = tnProj.y;
  // BEHIND him, the projection mirrored -- and (v219) never pointing UP: behind is the bottom edge or a side, in the
  // seat as in the chase view (the mirror alone put a robot behind and below the seat's eye on the TOP edge)
  if (behind) { sx = -sx; sy = -Math.abs(sy); if (Math.abs(sx) < 1e-3 && Math.abs(sy) < 1e-3) sy = -1; }
  if (!behind && Math.abs(sx) < TITAN.arrowInView && Math.abs(sy) < TITAN.arrowInView) { tnArrow(false); return; }
  tnArrow(true, Math.atan2(sx, sy));
}
// (v219 round 3) for its ATTACKS (starting one, calling one off), landing is an engaged approach he is LINED UP on --
// within atk.landLat of the runway's line. Engaged far off the line, flying at the robot near home, he is not
// landing, and its attacks go on (the approach engages there from the north: every attack on the prop near home was
// called off). NOT "or low" (tnLanding, the arrow's rule): its attacks come at 50-120 m, so "low" called every one
// at home off too. No flight assist is touched: this only reads approachData.
function tnAtkLanding() {
  if (!state.engaged) return false;
  const ad = state.approachData;
  return !ad || Math.abs(ad.lat) < TA.landLat;
}
// (v219) committed to landing: on an engaged approach AND low on it (the glide). Engaged far out and high -- as
// he is when put back together over the robot facing New York -- the arrow still points at it.
function tnLanding() {
  return !!state.engaged && state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel) < TITAN.arrowLandAgl;
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
