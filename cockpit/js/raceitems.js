"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE POWER-UPS (v187). "Racing is just circling the track", he said; the
// parent asked for a race where something happens every few seconds. All of it original.
//
// THE BOXES. Rows of glowing gift boxes across the road (`RC.items`), spread round every
// lap. A car whose body crosses a box takes it -- he AIMS at one, as at a pad; nothing is
// timed -- and the box is back a few seconds later. One item at a time: a box taken while
// he holds one is only a box.
//
// THE ONE BUTTON. The parent's exception (CLAUDE.md): one big pulsing button, bottom-left,
// showing the item's picture -- no words -- and a tap uses it. It is up only while he holds
// something (`raceItemShows`, buttons.js). The stick is another finger's: tapping it never
// lifts the steer.
//
// THE ITEMS, the same for every car, his and theirs:
//   boost  -- a rocket push past his speed for a couple of seconds;
//   shield -- a bubble round the car that takes the next hit and pops;
//   ball   -- a bouncing ball that rolls ahead, finds the car in front and spins it out;
//   oil    -- a slick dropped behind; the car that drives into it spins out;
//   giant  -- the car grows huge for about six seconds; a car it meets bounces off it.
// Further back, better items (`odds`), so a race stays close: nothing at the front is a giant.
//
// A SPIN-OUT IS NEVER A BANG. About a second: the body turns once round, the speed is cut
// to `spin.keep` and comes back as it always does. The racer keeps its line and the road;
// the camera behind him stays behind him (only the body turns), and the seat sways. Nothing
// stops a race, nobody is stuck, nothing explodes -- the giant, the ball and the slick are
// toys, and nothing living is ever hit.
//
// THE RIVALS PLAY TOO, on the race's own stream (rcRnd): they steer for boxes, and use what
// they get after a moment -- a ball when someone is ahead in reach, a slick when someone is
// close behind -- and that someone may be him.
//
// NOTHING NEW IN PLAY: every mesh here is pooled at load, on the kit's quiet stream, so a
// race makes no three.js object and draws nothing from Math.random.
// ---------------------------------------------------------------------------
const RCI = TUNE.race.items;
const rcItV = new THREE.Vector3(), rcItM = new THREE.Matrix4(), rcItQ = new THREE.Quaternion(), rcItS = new THREE.Vector3(), rcItC = new THREE.Color();
const rcItP = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, tz: -1, lx: -1, ly: 0, lz: 0, kh: 0 };
const RCI_MAXROWS = 12;
const RCI_COLS = [0xffd23e, 0x5ff1ff, 0x36c46a, 0xe0483e, 0xff7a1a, 0x2b6fd1];   // (the palette's brightest: a box steps through them)

// ---- the pools, built once at load ---------------------------------------------------------
function rcItBuild() {
  const it = race.it = { rows: [], balls: [], oils: [], bubbles: [], used: 0, boxMesh: null, ribbonMesh: null, glow: null };
  const n = RCI_MAXROWS * RCI.lats.length, B = RCI.box;
  // a gift box: the box (its colour per box, cycling) and its ribbon (white), unlit -- it glows
  it.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(B, B, B), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), n);
  const rib = new THREE.BufferGeometry().copy(new THREE.BoxGeometry(B * 1.04, B * 1.04, B * 0.22));
  const rib2 = new THREE.BoxGeometry(B * 0.22, B * 1.04, B * 1.04);
  it.ribbonMesh = new THREE.InstancedMesh(rcItMergeGeos([rib, rib2]), new THREE.MeshBasicMaterial({ color: 0xf2f4f7 }), n);
  it.boxMesh.setColorAt(0, rcItC.set(0xffffff));       // (before the count goes to 0: r128 sizes the colours by it)
  for (const m of [it.boxMesh, it.ribbonMesh]) { m.count = 0; m.frustumCulled = false; m.userData.noSolid = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
  // a soft glow round each (the shared texture, additive)
  const gp = new Float32Array(n * 3);
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  it.glow = new THREE.Points(gg, new THREE.PointsMaterial({ map: glowTex, color: 0xffd23e, size: B * 3.2, sizeAttenuation: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  it.glow.frustumCulled = false; it.glow.userData.noSolid = true; it.glow.visible = false; scene.add(it.glow);
  // balls: yellow and red in bands, smooth, unlit -- a toy, not a rock
  const bg = new THREE.IcosahedronGeometry(RCI.ball.r, 3), bc = [];
  const pa = bg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / RCI.ball.r, band = Math.floor((y + 1) * 2.5) % 2; rcItC.set(band ? 0xe0483e : 0xffd23e); bc.push(rcItC.r, rcItC.g, rcItC.b); }
  bg.setAttribute("color", new THREE.Float32BufferAttribute(bc, 3));
  const bm = new THREE.MeshBasicMaterial({ vertexColors: true });
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(bg, bm); m.visible = false; m.userData.noSolid = true; scene.add(m); it.balls.push({ on: false, m, s: 0, lat: 0, t: 0 }); }
  // oil: a dark pool with a sheen ring, flat on the deck
  const og = rcItMergeGeos([new THREE.CircleGeometry(RCI.oil.r, 20)]), ring = new THREE.RingGeometry(RCI.oil.r * 0.55, RCI.oil.r * 0.75, 20);
  const om = new THREE.MeshBasicMaterial({ color: 0x1f2328, transparent: true, opacity: 0.92, depthWrite: false });
  const rm = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9, depthWrite: false });   // (a warning-yellow sheen: dark on dark asphalt did not read)
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group(), a = new THREE.Mesh(og, om), b = new THREE.Mesh(ring, rm);
    a.rotation.x = b.rotation.x = -Math.PI / 2; b.position.y = 0.02; g.add(a, b); g.visible = false; g.userData.noSolid = true;
    scene.add(g); it.oils.push({ on: false, m: g, s: 0, lat: 0, t: 0 });
  }
  // bubbles: clear in the middle, bright at the rim (from inside too: a ring round his view, never a veil)
  const sm = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0x5ff1ff) }, uA: { value: 1 } },
    // (the game's depth buffer is logarithmic: a shader of its own carries the chunks, as race.js's do)
    vertexShader: `varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vV;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float f = 1.0 - abs(dot(vN, vV)); gl_FragColor = vec4(uCol, uA * (0.1 + 0.85 * pow(f, 2.0))); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const sg = new THREE.SphereGeometry(1, 24, 16);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(sg, sm); m.visible = false; m.userData.noSolid = true; m.renderOrder = 3; scene.add(m); it.bubbles.push(m); }
}
function rcItMergeGeos(list) {
  // (a few small, non-indexed copies into one: the ribbon's two bands, a disc)
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

// ---- the rows, laid for the track a race is run on ---------------------------------------------
// evenly round the lap, each moved to the nearest place clear of a jump, the grid, a pad and a shortcut
function rcItOK(T, s) {
  const L = T.len;
  if (s < RCI.clearGrid || s > L - RCI.clearGrid) return false;
  if (rcAt(s).dune) return false;
  for (const p of race.pads) { const d = Math.abs(((p.s - s) % L + L * 1.5) % L - L / 2); if (d < RCI.clearPad) return false; }
  for (const sc of T.sc || []) {
    const a = sc.sa + sc.gore - sc.hold - RCI.clearSc, b = Math.max(sc.sb, sc.sa + sc.gore) + RCI.clearSc;
    if (((s - a) % L + L) % L < b - a) return false;
  }
  return true;
}
function rcItRows() {
  const it = race.it, T = race.track, L = T.len, n = Math.min(RCI_MAXROWS, RCI.rows);
  it.rows = [];
  for (let k = 0; k < n; k++) {
    const want = L * (k + 0.5) / n;
    let s = null;
    for (let d = 0; d < L / (2 * n); d += 5) { if (rcItOK(T, want + d)) { s = want + d; break; } if (rcItOK(T, want - d)) { s = want - d; break; } }
    if (s === null) continue;
    it.rows.push({ s, off: false, boxes: RCI.lats.map(lat => ({ lat, down: 0 })) });
  }
}

// ---- in and out of a race ----------------------------------------------------------------------
function rcItReset() {
  const it = race.it;
  if (!it) return;
  for (const b of it.balls) { b.on = false; b.m.visible = false; }
  for (const o of it.oils) { o.on = false; o.m.visible = false; }
  for (const m of it.bubbles) m.visible = false;
  if (el.raceBubble) { el.raceBubble.classList.add("hidden"); el.raceBoostFx.classList.add("hidden"); }
  it.rows = []; it.used = 0;
  it.boxMesh.count = it.ribbonMesh.count = 0; it.glow.visible = false;
  race.things = []; race.itLog = { got: 0, used: 0, rivalsUsed: 0, hitHim: 0, blocked: 0, spins: 0, bounces: 0 };
  if (el.raceItemBtn) { el.raceItemBtn.classList.add("hidden"); el.raceItemBtn.dataset.item = ""; }
}
function rcItStart() {
  rcItReset();
  rcItRows();
  for (const r of race.racers) rcItRacer(r);
}
function rcItRacer(r) {
  r.item = null; r.itemShuf = 0; r.itemQueued = false; r.itemWait = 0; r.itemHeld = 0;
  r.spinT = 0; r.spinA = 0; r.shieldT = 0; r.giantT = 0; r.giantK = 1; r.itBoostT = 0;
  r.wid0 = r.wid; r.len0 = r.len;
}
// something happened to him: what the per-lap count is made of
// ONE footprint for every car, as a pad has (RC.footW): what it catches, and what catches it, is the same whatever
// he drives -- by its own width the monster truck took more boxes and more balls. A giant's is its growth's.
function rcItFoot(r) { return RC.footW * (r.giantK || 1); }
// (two at once -- a box and the pad beside it, a ball and its spin -- are one thing to him)
function rcThing(k) {
  if (!race.on || !race.things) return;
  const t = race.t - (race.raceT0 || 0), last = race.things[race.things.length - 1];
  if (last && t - last.t < RCI.thingGap) { (last.also = last.also || []).push(k); return; }   // (one moment, but what made it counts)
  race.things.push({ t, k });
}

// ---- an item: drawn by place, given, used --------------------------------------------------------
function rcItDraw(f) {
  const O = RCI.odds, a = f <= 0.5 ? O.first : O.middle, b = f <= 0.5 ? O.middle : O.last, u = f <= 0.5 ? f * 2 : (f - 0.5) * 2;
  let x = rcRnd(), last = null;
  for (const k of RCI.kinds) { const w = lerp(a[k] || 0, b[k] || 0, u); if (w <= 0) continue; last = k; x -= w; if (x <= 0) return k; }
  return last;
}
function rcItPlaceF(r) {
  const P = racePlaces(), n = Math.max(1, P.length - 1);
  return P.indexOf(r) / n;
}
function rcItGive(r, kind) {
  r.item = kind; r.itemHeld = 0;
  r.itemShuf = 0; r.itemQueued = false;
  if (!r.isHim) r.itemWait = lerp(RCI.ai.wait[0], RCI.ai.wait[1], rcRnd());
}
// his button's tap
function raceItemUse() {
  const him = race.him;
  if (!race.on || !him || !him.item || race.phase !== "race") return false;
  if (him.itemShuf > 0) { him.itemQueued = true; return true; }   // (tapped while its pictures shuffle: kept, and used as they settle -- a tap is never lost)
  rcItUse(him);
  return true;
}
function rcItUse(r) {
  const k = r.item;
  if (!k) return;
  r.item = null;
  const I = RCI, him = race.him;
  if (r.isHim) { race.it.used++; race.itLog.used++; rcThing("use"); flags.raceItems = (flags.raceItems || 0) + 1; }
  else { race.itLog.rivalsUsed++; if (him && Math.abs(rcGap(r.s, him.s)) < I.near && !him.done) rcThing("near"); }
  if (k === "boost") { r.itBoostT = I.boost.time; if (r.isHim) { engSurge(1); cameraPunch(0.6); rcWhoosh(); } }
  else if (k === "shield") { r.shieldT = I.shield.time; if (r.isHim) synthBlip("sine", 300, 900, 0.35, 0.16, 0); }
  else if (k === "giant") { r.giantT = I.giant.time; if (r.isHim) { synthBlip("sawtooth", 70, 260, 0.9, 0.2, 0); cameraPunch(0.5); } }
  else if (k === "ball") {
    const b = race.it.balls.find(x => !x.on) || race.it.balls[0];
    const P = racePlaces(), i = P.indexOf(r);
    let tgt = null;
    for (let j = i - 1; j >= 0; j--) if (!P[j].done) { tgt = P[j]; break; }
    Object.assign(b, { on: true, s: r.s + r.len / 2 + I.ball.r + 0.5, lat: r.lat, t: 0, from: r, tgt, v: Math.max(I.ball.v, r.v * I.ball.overThrower), path: r.path });
    b.m.visible = true;
    if (r.isHim || (him && Math.abs(rcGap(r.s, him.s)) < I.near)) synthBlip("square", 520, 260, 0.18, 0.12, 0);
  } else if (k === "oil") {
    const o = race.it.oils.find(x => !x.on) || race.it.oils.reduce((a, x) => (x.t > a.t ? x : a));
    Object.assign(o, { on: true, s: r.s - r.len / 2 - I.oil.behind - I.oil.r, lat: r.lat, t: 0, from: r });
    o.m.visible = true;
    if (r.isHim) synthBlip("sine", 180, 90, 0.3, 0.14, 0);
  }
}

// ---- hit: a spin-out, unless a bubble or a giant takes it ------------------------------------------
function rcItHit(r, by) {
  const him = race.him;
  if (r.giantT > 0) return;                                  // (a giant shrugs it off)
  if (r.shieldT > 0) {
    r.shieldT = 0;
    rcItBurst(r, 0x5ff1ff, 8);
    if (r.isHim) { race.itLog.blocked++; rcThing("bubble"); synthBlip("sine", 900, 300, 0.25, 0.18, 0); }
    return;
  }
  if (r.spinT > 0) return;
  r.spinT = RCI.spin.time; r.spinA = 0;
  r.v *= RCI.spin.keep; r.latV = 0;
  r.boosting = false; r.burstT = 0; r.padT = 0; r.itBoostT = 0;
  rcItBurst(r, 0xffd23e, RCI.spin.burst, 1);   // (the hero cue: a ring of bright puffs bursting off the car that spins -- seen at 50 m)
  if (r.isHim) {
    race.itLog.spins++; if (by && by !== r) race.itLog.hitHim++;
    rcThing("spin"); flags.raceSpins = (flags.raceSpins || 0) + 1;
    boing(); synthBlip("triangle", 1400, 500, 0.7, 0.1, 0); cameraPunch(0.5);
  } else if (him && Math.abs(rcGap(r.s, him.s)) < RCI.near) { boing(); if (by === him) rcThing("hitThem"); }
}
function rcItBurst(r, col, n, big) {
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2, c = big && k % 2 ? 0xf2f4f7 : col;
    rcPoint(r.s + Math.cos(a) * r.len * 0.5, r.lat + Math.sin(a) * r.wid * 0.6, rcItP);
    rcPuff(rcItP.x, rcItP.y + (big ? 1.4 : 0.8), rcItP.z, c, big ? 1.0 : 0.5, big ? 3 : 1.6, big ? 0.9 : 0.5, 0.95);
  }
}

// ---- every frame ---------------------------------------------------------------------------------
// before they move: a giant's size, a spin's turn, the timers
function rcItBefore(dt) {
  const G = RCI.giant;
  for (const r of race.racers) {
    if (r.wid0 === undefined) rcItRacer(r);
    if (r.itBoostT > 0) r.itBoostT -= dt;
    if (r.shieldT > 0) r.shieldT -= dt;
    if (r.itemShuf > 0) { r.itemShuf -= dt; if (r.itemShuf <= 0 && r.itemQueued) { r.itemQueued = false; if (race.phase === "race") rcItUse(r); } }
    if (r.item) r.itemHeld += dt;
    // giant: grows over `grow` s, and back
    if (r.giantT > 0) r.giantT -= dt;
    const kMax = Math.min(G.scale, G.maxWid / r.wid0);
    r.giantK = r.giantT > 0 ? 1 + (kMax - 1) * smoothstep(0, 1, Math.min(1, (G.time - r.giantT) / G.grow)) * (r.giantT < G.grow ? smoothstep(0, 1, r.giantT / G.grow) : 1) : 1;
    r.wid = r.wid0 * r.giantK; r.len = r.len0 * r.giantK;
    // spinning: the body turns once round over the spin
    if (r.spinT > 0) {
      r.spinT = Math.max(0, r.spinT - dt);
      r.spinA = Math.PI * 2 * smoothstep(0, 1, 1 - r.spinT / RCI.spin.time);
      r.latV *= Math.max(0, 1 - RCI.spin.latDamp * dt);
      if (r.spinT === 0) r.spinA = 0;
    }
  }
}
// what an item does to the speed a racer aims for (race.js rcSpeedTo)
function rcItSpeed(r, want) {
  if (r.spinT > 0) return Math.min(want, r.v);               // (no push while it spins: the speed comes back after)
  return want * (r.itBoostT > 0 ? RCI.boost.gain : 1) * (r.giantT > 0 ? RCI.giant.gain : 1);
}
// where a rival steers: a box, if it has nothing (race.js rcAI)
function rcItAim(r, aim) {
  if (r.item || r.path || !race.it) return aim;
  const L = race.track.len;
  for (const row of race.it.rows) {
    if (row.off) continue;
    const d = rcAhead(row.s, r.s);
    if (d > 0 && d < RC.ai.padSee) {
      if (r.boxFor !== row) { r.boxFor = row; r.boxGo = rcRnd() < RCI.ai.boxP; }
      if (r.boxGo) { let best = null; for (const b of row.boxes) if (!b.down && (!best || Math.abs(b.lat - aim) < Math.abs(best.lat - aim))) best = b; if (best) return best.lat; }
    }
  }
  void L;
  return aim;
}
// after they moved: boxes caught, rivals' items, balls and slicks
function rcItAfter(dt, going) {
  const it = race.it, L = race.track.len, him = race.him;
  // boxes: crossed this frame by a body over one
  for (const row of it.rows) {
    for (const b of row.boxes) if (b.down > 0) b.down -= dt;
    if (row.off || !going) continue;
    for (const r of race.racers) {
      if (r.path || r.done) continue;
      const prev = r.itPrevS === undefined ? r.s : r.itPrevS;
      const d = rcAhead(row.s, prev);
      if (!(d <= r.s - prev + 0.01 && r.s >= prev)) continue;
      for (const b of row.boxes) {
        if (b.down > 0 || Math.abs(r.lat - b.lat) >= (RCI.box + rcItFoot(r)) / 2) continue;
        b.down = RCI.rearm;
        rcPoint(row.s, b.lat, rcItP);
        for (let k = 0; k < 5; k++) rcPuff(rcItP.x, rcItP.y + RCI.boxUp, rcItP.z, k % 2 ? 0xffd23e : 0x5ff1ff, 0.45, 2, 0.5, 0.9);
        if (!r.item) {
          rcItGive(r, rcItDraw(rcItPlaceF(r)));
          if (r.isHim) { r.itemShuf = RCI.shuffle; race.itLog.got++; rcThing("box"); chime(); }
        } else if (r.isHim) synthBlip("triangle", 900, 1200, 0.12, 0.1, 0);
        break;
      }
    }
  }
  for (const r of race.racers) r.itPrevS = r.s;
  // the rivals use theirs
  if (going) for (const r of race.racers) {
    if (r.isHim || !r.item || r.done) continue;
    r.itemWait -= dt;
    if (r.itemWait > 0) continue;
    const late = r.itemHeld > RCI.ai.holdMax;
    if (r.item === "ball") {
      const P = racePlaces(), i = P.indexOf(r), ahead = i > 0 ? P[i - 1] : null;
      if (late || (ahead && rcGap(ahead.s, r.s) > 0 && rcGap(ahead.s, r.s) < RCI.ai.ballSee)) rcItUse(r);
    } else if (r.item === "oil") {
      if (late || race.racers.some(o => o !== r && rcGap(r.s, o.s) > 0 && rcGap(r.s, o.s) < RCI.ai.oilSee)) rcItUse(r);
    } else if (r.item === "boost") { if (late || Math.abs(rcAt(r.s).kh) < 0.002) rcItUse(r); }
    else rcItUse(r);
  }
  // balls
  const BL = RCI.ball;
  for (const b of it.balls) {
    if (!b.on) continue;
    b.t += dt;
    if (b.tgt && !b.tgt.done && !b.tgt.path) b.lat += clamp(b.tgt.lat - b.lat, -BL.latRate * dt, BL.latRate * dt);
    b.s += b.v * dt;
    b.lat = clamp(b.lat, -RC.width / 2 + BL.r, RC.width / 2 - BL.r);
    let hit = null;
    for (const r of race.racers) {
      if ((r === b.from && b.t < BL.grace) || r.path || (r.air && r.y - rcPoint(r.s, r.lat, rcItP).y > BL.overAir)) continue;
      if (Math.abs(rcGap(r.s, b.s)) < RCI.footL / 2 + BL.r && Math.abs(r.lat - b.lat) < rcItFoot(r) / 2 + BL.r) { hit = r; break; }
    }
    if (hit) { rcItHit(hit, b.from); b.on = false; b.m.visible = false; continue; }
    if (b.t > BL.life) { rcPoint(b.s, b.lat, rcItP); rcPuff(rcItP.x, rcItP.y + 1, rcItP.z, 0xffd23e, 0.5, 1.5, 0.5, 0.9); b.on = false; b.m.visible = false; continue; }
    rcPoint(b.s, b.lat, rcItP);
    b.m.position.set(rcItP.x, rcItP.y + BL.r + Math.abs(Math.sin(b.t * BL.hopF)) * BL.hop, rcItP.z);
    b.m.rotation.set(b.t * 9, 0, 0);
  }
  // slicks
  const OL = RCI.oil;
  for (const o of it.oils) {
    if (!o.on) continue;
    o.t += dt;
    if (o.t > OL.life) { o.on = false; o.m.visible = false; continue; }
    for (const r of race.racers) {
      if ((r === o.from && o.t < OL.grace) || r.path || r.air || r.spinT > 0) continue;
      if (Math.abs(rcGap(r.s, o.s)) < RCI.footL / 2 + OL.r * OL.catchK && Math.abs(r.lat - o.lat) < rcItFoot(r) / 2 + OL.r * OL.catchK) {
        rcItHit(r, o.from); o.on = false; o.m.visible = false; break;
      }
    }
    if (!o.on) continue;
    rcPoint(o.s, o.lat, rcItP);
    o.m.position.set(rcItP.x + rcItP.nx * 0.12, rcItP.y + rcItP.ny * 0.12, rcItP.z + rcItP.nz * 0.12);   // (over the deck by a hand's width: no polygon offset, which beat the depth test and drew it over his car)
    rcItV.set(rcItP.nx, rcItP.ny, rcItP.nz);
    o.m.quaternion.setFromUnitVectors(rcV1.set(0, 1, 0), rcItV);
    const fade = Math.min(1, (OL.life - o.t) / 1.5);
    o.m.scale.setScalar(Math.max(0.05, fade));
  }
  void him; void L;
}
// a giant meets a car: the car bounces off, the giant keeps going (race.js rcContacts asks)
function rcItGiantMeet(A, B, sg, overlap) {
  const G = RCI.giant, ga = A.giantT > 0 && A.giantK > G.knockAt, gb = B.giantT > 0 && B.giantK > G.knockAt;
  if (ga === gb) return false;
  const big = ga ? A : B, small = ga ? B : A, side = small === A ? sg : -sg;
  small.lat += side * (overlap + 0.1);
  small.latV = side * RCI.giant.bounceV;
  if (!small.bounceT || small.bounceT < race.t - G.knockEvery) {
    small.v *= RCI.giant.knock;
    small.bounceT = race.t;
    if (small.isHim) { race.itLog.bounces++; rcThing("bounce"); rcBump(0.45); boing(); }
    else if (big.isHim) { rcThing("bounce"); boing(); }
  }
  return true;
}

// ---- what is drawn ---------------------------------------------------------------------------------
function rcItDrawFrame() {
  const it = race.it;
  if (!it) return;
  const B = RCI.box, t = race.t;
  let n = 0;
  const gp = it.glow.geometry.attributes.position.array;
  for (const row of it.rows) {
    if (row.off) continue;
    for (const b of row.boxes) {
      if (b.down > 0) continue;
      rcPoint(row.s, b.lat, rcItP);
      const y = rcItP.y + RCI.boxUp + Math.sin(t * 2.4 + b.lat) * RCI.bob;
      // (v190) never drawn round the camera: a chase camera passing through a box filled the screen with it
      if (Math.hypot(camera.position.x - rcItP.x, camera.position.y - y, camera.position.z - rcItP.z) < RCI.camClear) continue;
      rcItQ.setFromAxisAngle(rcItV.set(0, 1, 0), t * RCI.spinRate + b.lat);
      rcItM.compose(rcItS.set(rcItP.x, y, rcItP.z), rcItQ, rcItV.set(1, 1, 1));
      it.boxMesh.setMatrixAt(n, rcItM); it.ribbonMesh.setMatrixAt(n, rcItM);
      it.boxMesh.setColorAt(n, rcItC.setHex(RCI_COLS[(Math.floor(t * RCI.colStep + b.lat / 8 + row.s / 97) % RCI_COLS.length + RCI_COLS.length) % RCI_COLS.length]));
      gp[n * 3] = rcItP.x; gp[n * 3 + 1] = y; gp[n * 3 + 2] = rcItP.z;
      n++;
    }
  }
  it.boxMesh.count = it.ribbonMesh.count = n;
  it.boxMesh.instanceMatrix.needsUpdate = it.ribbonMesh.instanceMatrix.needsUpdate = true;
  if (it.boxMesh.instanceColor) it.boxMesh.instanceColor.needsUpdate = true;
  it.glow.geometry.setDrawRange(0, n); it.glow.geometry.attributes.position.needsUpdate = true;
  it.glow.visible = n > 0 && race.phase !== "podium";
  // a rocket boost burns out of the back: small flame puffs, for whoever is near the camera
  const cx = camera.position.x, cz = camera.position.z;
  for (const r of race.racers) {
    if (!(r.itBoostT > 0) || !r.mesh || Math.hypot(r.mesh.position.x - cx, r.mesh.position.z - cz) > RC.spray.near) continue;
    r.flameK = (r.flameK || 0) + 1;
    for (const sd of [-0.25, 0.25]) {
      if (r.path) rcScPoint(r.path, r.u - r.len * 0.55, r.lat + sd * r.wid, rcItP); else rcPoint(r.s - r.len * 0.55, r.lat + sd * r.wid, rcItP);
      rcPuff(rcItP.x, rcItP.y + 0.7 * r.giantK, rcItP.z, r.flameK % 2 ? 0xff7a1a : 0xffd23e, 0.45 * r.giantK, 0.4, 0.28, 0.95);
    }
  }
  // bubbles round whoever has one
  let k = 0;
  for (const r of race.racers) {
    if (!(r.shieldT > 0) || !r.mesh || k >= it.bubbles.length || race.phase === "podium" || (r.isHim && !state.viewChase)) continue;   // (his, from the seat: the ring round the glass)
    // round the body as it is DRAWN: a model's origin is not its middle (his SUV's sits metres under it)
    const m = it.bubbles[k++], K = RCI.shield.k;
    rcItBodyBox(r.mesh);
    rcItBox.getCenter(m.position); rcItBox.getSize(rcItS);
    r.mesh.updateMatrixWorld(true); r.mesh.matrixWorld.decompose(rcItV, m.quaternion, rcItV2);
    const L = Math.max(rcItS.x, rcItS.z), W = Math.min(rcItS.x, rcItS.z);   // (its box is the world's: along and across, whichever way it faces)
    m.scale.set(W * 0.5 * K + 0.6, rcItS.y * 0.5 * K + 0.6, L * 0.5 * K);
    m.visible = true;
  }
  for (; k < it.bubbles.length; k++) it.bubbles[k].visible = false;
}
// the box of what is drawn of a body: its visible meshes only (the Corvette carries a hidden SUV, and its flames)
const rcItBox = new THREE.Box3(), rcItBox2 = new THREE.Box3(), rcItV2 = new THREE.Vector3();
function rcItBodyBox(m) {
  m.updateMatrixWorld(true);
  rcItBox.makeEmpty();
  m.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== m; p = p.parent) if (!p.visible) return;
    if (o.userData.cvFx || (o.material && (o.material.visible === false || o.material.blending === THREE.AdditiveBlending))) return;
    // (a rival from the traffic kit is one instance at the identity, under its group: its matrixWorld places it)
    o.geometry.boundingBox || o.geometry.computeBoundingBox();
    rcItBox2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    rcItBox.union(rcItBox2);
  });
  if (rcItBox.isEmpty()) rcItBox.setFromCenterAndSize(m.position, rcItV2.set(3.4, 2, 7.6));
  return rcItBox;
}
// the seat sways while he spins (the chase camera stays behind him: only his body turns)
function rcItSeatYaw(r) { return r && r.spinT > 0 ? Math.sin(r.spinA) * RCI.spin.seatYaw : 0; }

// ---- the button ----------------------------------------------------------------------------------
function raceItemShows() { return race.on && race.phase === "race" && !!(race.him && race.him.item) && !menuOpen(); }
function rcItHud() {
  const b = el.raceItemBtn, him = race.him;
  if (!b || !him) return;
  let show = him.item || "";
  if (him.item && him.itemShuf > 0) show = RCI.kinds[Math.floor(race.t * 12) % RCI.kinds.length];   // (the pictures shuffle, then settle)
  if (b.dataset.item !== show) b.dataset.item = show;
  b.classList.toggle("shuffling", !!(him.item && him.itemShuf > 0));
  // (from his seat his own bubble and his own boost are at the edge of the glass: neither is in front of him)
  const seat = !state.viewChase && race.phase === "race";
  el.raceBubble.classList.toggle("hidden", !(him.shieldT > 0 && seat));
  el.raceBoostFx.classList.toggle("hidden", !(him.itBoostT > 0 && seat));
}
el.raceItemBtn = document.getElementById("raceItemBtn");
el.raceBubble = document.getElementById("raceBubble");
el.raceBoostFx = document.getElementById("raceBoostFx");
el.raceItemBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); pressFlash(el.raceItemBtn); raceItemUse(); });
{ const s0 = vkSeed; try { vkQuiet(0, rcItBuild); } finally { vkSeed = s0; } }
