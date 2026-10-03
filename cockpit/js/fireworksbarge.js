"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE FIREWORKS BARGE (v135).
//
// A red barge stacked with racks of mortar tubes floats on the east water of
// the great lake, just west of the motorway, strung with bulbs, a red target
// ring turning over it. Point at it from inside `armR` -- the car on the
// motorway, the plane, the helicopter -- and after 3-2-1 every rack goes: a
// build of single shells, then bigger and bigger volleys, then a finale of
// thirty at once. Peonies, rings and gold willows, each with a white flash and
// a boom. Then it rests and is ready again. Nothing to press, nothing to miss.
//
// RULES THIS FILE KEEPS
//   * It is something he POINTS at. In the car it arms by his speed, so the
//     first shells burst ahead of him, in the windscreen, at any speed step.
//   * No unannounced bang: every boom comes after a 3-2-1.
//   * Nothing reaches the road: every shell leans WEST, away from it; no star
//     ever comes within the road's corridor (the check samples every one).
//   * Readability: the show is in the sky over the water; nothing of it is
//     ever on the road or between him and the road.
//   * Its own random stream; every star and trail spark is ONE Points draw;
//     the finale's bangs are rate-limited so it never becomes a wall of noise.
//   * The barge is solid (kind "ship"); nothing on it is living.
//   * It shares the one big numeral through spCountBusy, and stands down for a
//     police pull-over or the picker.
// ---------------------------------------------------------------------------
const FBARGE = TUNE.fireworksBarge;

const FB_SEED = 0xF1BE;
let fbSeed = FB_SEED;
function fbRnd() { fbSeed = (fbSeed * 1664525 + 1013904223) >>> 0; return fbSeed / 4294967296; }

const fbarge = {
  g: null, y: 0, reticle: null, solid: null,
  phase: "armed",               // armed | count | show | rest
  t: 0, clock: 0, next: 0, fired: 0, shells: [], flashes: [],
  sparks: null, sp: null, spN: 0,
  sounds: 0, soundT: 0,
};

const FB_COLORS = [0xff4040, 0xffd040, 0x40ff70, 0x5a9cff, 0xff60d0, 0xffffff, 0x60f0ff, 0xff9020];

// A hard-edged star: a solid disc with a thin soft rim, so it reads as a
// coloured dot at any distance rather than a smear.
function fbStarTex() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function fbBuild() {
  const P = TUNE.palette, T = FBARGE;
  const g = new THREE.Group();
  g.userData.name = "fireworksBarge";
  const y = seaLevelAt(T.x, T.z);      // the one answer to how high the water is here
  fbarge.y = y;
  const k = lsKit();
  // the hull, its deck, a rail all round
  k.add(P.red, new THREE.BoxGeometry(T.hullW, T.hullH, T.hullL), 0, y + T.deck - T.hullH / 2, 0);
  k.add(P.slate, new THREE.BoxGeometry(T.hullW - 1, 0.4, T.hullL - 1), 0, y + T.deck + 0.2, 0);
  k.add(P.warning, new THREE.BoxGeometry(T.hullW + 0.2, 0.5, 0.5), 0, y + T.deck + 1.2, T.hullL / 2);
  k.add(P.warning, new THREE.BoxGeometry(T.hullW + 0.2, 0.5, 0.5), 0, y + T.deck + 1.2, -T.hullL / 2);
  k.add(P.warning, new THREE.BoxGeometry(0.5, 0.5, T.hullL), T.hullW / 2, y + T.deck + 1.2, 0);
  k.add(P.warning, new THREE.BoxGeometry(0.5, 0.5, T.hullL), -T.hullW / 2, y + T.deck + 1.2, 0);
  // racks of mortar tubes, four rows of six, every tube a toy colour
  const tubeCols = [P.red, P.blue, P.green, P.warning, P.fire, P.cyan];
  fbarge.tubes = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const tx = (c - 2.5) * 2.2, tz = -14 + r * 7;
    k.add(tubeCols[(r + c) % tubeCols.length], lsCyl(0.8, 0.8, 3.2, 10), tx, y + T.deck + 2, tz);
    k.add(P.ink, lsCyl(0.55, 0.55, 0.1, 10), tx, y + T.deck + 3.65, tz);
    fbarge.tubes.push({ x: tx, z: tz });
  }
  k.add(P.white, new THREE.BoxGeometry(5, 3.5, 5), 0, y + T.deck + 1.75, 18);   // the little firing hut
  k.add(P.slate, new THREE.BoxGeometry(5.6, 0.5, 5.6), 0, y + T.deck + 3.75, 18);
  const meshes = k.build(g, sledPaint);
  fbarge.hull = meshes[0];
  fbarge.hull.userData.noShatter = true;
  // a string of bulbs round the rail
  const bulbs = [];
  for (let i = 0; i <= 12; i++) {
    bulbs.push(new THREE.Vector3(-T.hullW / 2 + T.hullW * i / 12, y + T.deck + 1.7, T.hullL / 2));
    bulbs.push(new THREE.Vector3(-T.hullW / 2 + T.hullW * i / 12, y + T.deck + 1.7, -T.hullL / 2));
  }
  for (let i = 1; i < 24; i++) {
    bulbs.push(new THREE.Vector3(T.hullW / 2, y + T.deck + 1.7, -T.hullL / 2 + T.hullL * i / 24));
    bulbs.push(new THREE.Vector3(-T.hullW / 2, y + T.deck + 1.7, -T.hullL / 2 + T.hullL * i / 24));
  }
  const field = glowField(bulbs, 0xffe9a8, 3.5, 0.95);
  g.add(field);
  g.position.set(T.x, 0, T.z);
  castsAndReceives(g);
  scene.add(g);
  fbarge.g = g;
  const sb = addSolidBox(T.x, y - T.hullH, T.z, T.hullW / 2, T.hullL / 2, y + T.deck + 4, fbarge.hull, "ship");
  sb.fb = true;
  fbarge.solid = sb;

  // the target: a red ring with yellow ticks, turned to face him
  const ret = new THREE.Group();
  ret.add(new THREE.Mesh(new THREE.TorusGeometry(T.reticleR, 1.1, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  for (const [rx, ry] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(rx ? 5 : 1.2, ry ? 5 : 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
    tick.position.set(rx * (T.reticleR + 2.6), ry * (T.reticleR + 2.6), 0);
    ret.add(tick);
  }
  ret.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false })));
  ret.position.set(T.x, y + T.reticleY, T.z);
  scene.add(ret);
  fbarge.reticle = ret;

  // every star and trail spark: one Points draw. NOT additive: this is a
  // daytime sky, where adding light to blue only ever makes white. Plain
  // blending keeps a red star red against it; a fading star shrinks its colour
  // towards the sky's instead of going dark.
  const N = T.sparks;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({ map: fbStarTex(), size: T.starSize, sizeAttenuation: true, vertexColors: true,
    transparent: true, alphaTest: 0.05, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  fbarge.sparks = pts;
  fbarge.sp = [];
  for (let i = 0; i < N; i++) fbarge.sp.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, gg: 1, b: 1, drag: 1, grav: 0 });
  fbarge.spCursor = 0;
  // the shells on their way up: one more Points draw, bigger
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FBARGE.shellsMax * 3), 3));
  sgeo.setDrawRange(0, 0);
  const smat = new THREE.PointsMaterial({ map: glowTex, size: T.shellSize, sizeAttenuation: true, color: 0xfff2c0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const shellPts = new THREE.Points(sgeo, smat);
  shellPts.frustumCulled = false;
  scene.add(shellPts);
  fbarge.shellPts = shellPts;
  // the flashes: a white bloom at every burst
  fbarge.flashes = [];
  for (let i = 0; i < T.flashes; i++) {
    const f = glowSprite(0xffffff, T.flashSize, 0);
    f.visible = false;
    scene.add(f);
    fbarge.flashes.push({ s: f, t: 0 });
  }
  fbReset();
}

function fbReset() {
  if (!fbarge.g) return;
  fbSeed = FB_SEED;
  fbarge.phase = "armed"; fbarge.t = 0; fbarge.next = 0; fbarge.fired = 0;
  fbarge.shells.length = 0;
  for (const p of fbarge.sp) p.life = 0;
  fbarge.sparks.geometry.setDrawRange(0, 0);
  fbarge.shellPts.geometry.setDrawRange(0, 0);
  for (const f of fbarge.flashes) { f.t = 0; f.s.visible = false; }
  fbarge.reticle.visible = true;
  if (el.bigNum.classList.contains("sky") && fbarge.counting) { countdownClear(); el.bigNum.classList.remove("sky"); }
  fbarge.counting = false;
}

function fbHear() {
  return clamp(1 - Math.hypot(state.x - FBARGE.x, state.y - fbarge.y, state.z - FBARGE.z) / FBARGE.hearR, 0, 1);
}
function fbBusy() {
  if (typeof menuOpen === "function" && menuOpen()) return true;
  return typeof police !== "undefined" && !!police.active && police.state === "pullover";
}
// From the first numeral to the first burst, in seconds.
function fbToFirstBurst() { const T = FBARGE; return T.count + (T.fuse[0] + T.fuse[1]) / 2; }

function fbAimed() {
  if (state.exploding || eject.active || fbBusy()) return false;
  if (spCountBusy("fireworksBarge")) return false;
  const T = FBARGE;
  const dx = T.x - state.x, dz = T.z - state.z, dy = fbarge.y - state.y;
  const d = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
  const R = typeof vehKind === "function" && vehKind() === "car" ? T.carView + Math.abs(state.speed) * fbToFirstBurst() : T.armR;
  if (d > R || dh < T.innerR) return false;
  const fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  return (dx * fx + dz * fz) / dh > Math.cos(T.coneDeg * DEG);
}
function fbStart() {
  fbarge.phase = "count"; fbarge.t = FBARGE.count; fbarge.counting = true;
  flags.fbCountdowns = (flags.fbCountdowns || 0) + 1;
}
function fbForce() { if (fbarge.phase === "armed") fbStart(); }

// ---- the show -----------------------------------------------------------------
function fbSpark(x, y, z, vx, vy, vz, life, color, drag, grav) {
  let p = null;
  for (let n = 0; n < 64; n++) {            // a free one near the cursor, else the oldest-ish one there
    const q = fbarge.sp[fbarge.spCursor];
    fbarge.spCursor = (fbarge.spCursor + 1) % fbarge.sp.length;
    if (q.life <= 0) { p = q; break; }
    if (!p || q.life < p.life) p = q;
  }
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life;
  p.r = ((color >> 16) & 255) / 255; p.gg = ((color >> 8) & 255) / 255; p.b = (color & 255) / 255;
  p.drag = drag; p.grav = grav;
}

function fbLaunch() {
  const T = FBARGE;
  const tube = fbarge.tubes[Math.floor(fbRnd() * fbarge.tubes.length)];
  const sp = lerp(T.shellSpeed[0], T.shellSpeed[1], fbRnd());
  // every shell leans west, away from the road, and a little either way along the lake
  fbarge.shells.push({ x: T.x + tube.x, y: fbarge.y + T.deck + 3.6, z: T.z + tube.z,
    vx: -T.drift * (0.4 + fbRnd() * 0.8), vy: sp, vz: (fbRnd() - 0.5) * 14, t: 0,
    fuse: lerp(T.fuse[0], T.fuse[1], fbRnd()), trail: 0 });
  fbarge.fired++;
  flags.fbShells = (flags.fbShells || 0) + 1;
  fbSound("launch");
}

function fbBurst(s) {
  const T = FBARGE;
  const kind = fbRnd();
  const c1 = FB_COLORS[Math.floor(fbRnd() * FB_COLORS.length)];
  const c2 = fbRnd() < 0.4 ? FB_COLORS[Math.floor(fbRnd() * FB_COLORS.length)] : c1;
  if (kind < 0.55) {
    // a peony: a sphere of stars
    for (let i = 0; i < T.stars; i++) {
      const u = fbRnd() * 2 - 1, a = fbRnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const v = lerp(T.burstSpeed[0], T.burstSpeed[1], fbRnd());
      fbSpark(s.x, s.y, s.z, Math.cos(a) * r * v + s.vx * 0.3, u * v + s.vy * 0.3, Math.sin(a) * r * v + s.vz * 0.3,
        lerp(T.starLife[0], T.starLife[1], fbRnd()), i % 2 ? c1 : c2, T.starDrag, T.starGravity);
    }
  } else if (kind < 0.8) {
    // a ring, tipped towards him
    const tilt = fbRnd() * 0.8;
    for (let i = 0; i < T.stars; i++) {
      const a = i / T.stars * Math.PI * 2, v = T.burstSpeed[1];
      const x = Math.cos(a) * v, y0 = Math.sin(a) * v;
      fbSpark(s.x, s.y, s.z, x, y0 * Math.cos(tilt), y0 * Math.sin(tilt), lerp(T.starLife[0], T.starLife[1], fbRnd()), c1, T.starDrag, T.starGravity);
    }
    for (let i = 0; i < 24; i++) fbSpark(s.x, s.y, s.z, (fbRnd() - 0.5) * 12, (fbRnd() - 0.5) * 12, (fbRnd() - 0.5) * 12, 1.2, 0xffffff, T.starDrag, T.starGravity);
  } else {
    // a gold willow: slow stars that hang and fall
    for (let i = 0; i < T.stars; i++) {
      const u = fbRnd() * 2 - 1, a = fbRnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const v = lerp(T.willowSpeed[0], T.willowSpeed[1], fbRnd());
      fbSpark(s.x, s.y, s.z, Math.cos(a) * r * v, u * v + 6, Math.sin(a) * r * v,
        lerp(T.willowLife[0], T.willowLife[1], fbRnd()), 0xffc23a, T.starDrag * 1.4, T.starGravity * 2.2);
    }
  }
  const f = fbarge.flashes.find(q => q.t <= 0) || fbarge.flashes[0];
  f.t = T.flashLife; f.s.visible = true; f.s.position.set(s.x, s.y, s.z); f.s.material.color.setHex(c1);
  flags.fbBursts = (flags.fbBursts || 0) + 1;
  fbarge.lastBurst = { x: s.x, y: s.y, z: s.z };
  fbSound("boom");
}

function fbSound(kind) {
  const h = fbHear();
  if (h <= 0) return;
  const T = FBARGE;
  if (fbarge.sounds >= T.soundsPerSec * 0.25) return;   // the finale: a roar of bangs, not a wall of them
  fbarge.sounds++;
  if (kind === "launch") { synthBlip("sine", 150, 70, 0.18, 0.18 * h, 0); synthBlip("sine", 600, 1700, 1.6, 0.035 * h, 0.05); }
  else { noiseBurst(0.45, 180, T.boomGain * h, 0); synthBlip("sine", 85, 38, 0.5, 0.3 * h, 0); noiseBurst(0.9, 2600, 0.12 * h, 0.22); }
}

function updateFireworksBarge(dt) {
  if (!fbarge.g) return;
  const T = FBARGE;
  fbarge.clock += dt;
  const near = Math.hypot(state.x - T.x, state.z - T.z) < TUNE.fogFar * T.drawFog;
  fbarge.g.visible = near;
  fbarge.soundT -= dt;
  if (fbarge.soundT <= 0) { fbarge.soundT = 0.25; fbarge.sounds = 0; }
  // the target turns to face him and pulses; it goes while the show is on
  const r = fbarge.reticle;
  r.visible = near && fbarge.phase === "armed";
  if (r.visible) {
    r.lookAt(camera.position.x, r.position.y, camera.position.z);
    r.scale.setScalar(1 + Math.sin(fbarge.clock * T.reticleRate) * 0.12);
  }
  const ph = fbarge.phase;
  if (ph === "armed") {
    if (fbAimed()) fbStart();
  } else if (ph === "count") {
    if (fbBusy()) {
      countdownClear(); el.bigNum.classList.remove("sky"); fbarge.counting = false;
      fbarge.phase = "armed";
      flags.fbStandDowns = (flags.fbStandDowns || 0) + 1;
    } else {
      fbarge.t -= dt;
      el.bigNum.classList.add("sky");
      countdownTo(fbarge.t, T.count);
      if (fbarge.t <= 0) {
        countdownClear(); el.bigNum.classList.remove("sky"); fbarge.counting = false;
        fbarge.phase = "show"; fbarge.t = 0; fbarge.next = 0; fbarge.fired = 0;
        flags.fbShows = (flags.fbShows || 0) + 1;
      }
    }
  } else if (ph === "show" || ph === "rest") {
    fbarge.t += dt;
    if (ph === "show") {
      while (fbarge.next < T.volleys.length && T.volleys[fbarge.next][0] <= fbarge.t) {
        for (let i = 0; i < T.volleys[fbarge.next][1]; i++) fbLaunch();
        fbarge.next++;
      }
      if (fbarge.next >= T.volleys.length && !fbarge.shells.length && !fbarge.sp.some(p => p.life > 0)) { fbarge.phase = "rest"; fbarge.t = 0; }
    } else if (fbarge.t >= T.rest) {
      fbarge.phase = "armed";
      flags.fbRests = (flags.fbRests || 0) + 1;
    }
  }
  // shells up
  const sp = fbarge.shellPts.geometry.attributes.position.array;
  let ns = 0;
  for (let i = fbarge.shells.length - 1; i >= 0; i--) {
    const s = fbarge.shells[i];
    s.t += dt;
    s.vy -= T.shellGravity * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.trail -= dt;
    if (s.trail <= 0) { s.trail = T.trailEvery; fbSpark(s.x, s.y, s.z, (fbRnd() - 0.5) * 3, -6, (fbRnd() - 0.5) * 3, 0.45, 0xffb060, 2, 0); }
    if (s.t >= s.fuse) { fbBurst(s); fbarge.shells.splice(i, 1); continue; }
    if (ns < T.shellsMax) { sp[ns * 3] = s.x; sp[ns * 3 + 1] = s.y; sp[ns * 3 + 2] = s.z; ns++; }
  }
  fbarge.shellPts.geometry.setDrawRange(0, ns);
  if (ns) fbarge.shellPts.geometry.attributes.position.needsUpdate = true;
  // stars: compacted into the front of the buffer, brightness as colour
  const pos = fbarge.sparks.geometry.attributes.position.array, col = fbarge.sparks.geometry.attributes.color.array;
  let n = 0;
  for (const p of fbarge.sp) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < fbarge.y) { p.life = 0; continue; }          // into the lake
    const k = p.life / p.max;
    // full colour, then a crackle of twinkling at the end -- a twinkle is the star
    // GONE for a moment, never darkened (on a blue sky dark is grey, not gone)
    if (k < 0.3 && Math.sin(fbarge.clock * 40 + p.x * 3) < 0) continue;
    const b = 1;
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
    col[n * 3] = p.r * b; col[n * 3 + 1] = p.gg * b; col[n * 3 + 2] = p.b * b;
    n++;
  }
  fbarge.spN = n;
  fbarge.sparks.geometry.setDrawRange(0, n);
  if (n) { fbarge.sparks.geometry.attributes.position.needsUpdate = true; fbarge.sparks.geometry.attributes.color.needsUpdate = true; }
  for (const f of fbarge.flashes) {
    if (f.t <= 0) continue;
    f.t -= dt;
    f.s.material.opacity = Math.max(0, f.t / T.flashLife) * T.flashOpacity;
    f.s.scale.setScalar(T.flashSize * (1 - f.t));
    if (f.t <= 0) f.s.visible = false;
  }
}

function fbSparksLive() {
  const out = [];
  for (const p of fbarge.sp) if (p.life > 0) out.push({ x: p.x, y: p.y, z: p.z });
  for (const s of fbarge.shells) out.push({ x: s.x, y: s.y, z: s.z });
  return out;
}

// three.js draws Math.random for every object it makes; built on the kit's own
// stream (vkQuiet, 0 draws back), the seeded traffic sees the stream it saw before
// this set-piece existed.
vkQuiet(0, () => fbBuild());
spCountRegister("fireworksBarge", () => fbarge.phase === "count");
