"use strict";
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(ix, iz) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function hashSalt(ix, iz, salt) {
  return hash2(ix + salt * 7919, iz - salt * 104729);
}

let seed = 987654321;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function rawHeight(x, z) {
  return valueNoise(x / TUNE.hillWavelength, z / TUNE.hillWavelength) * TUNE.hillAmplitude
       + valueNoise(x / TUNE.midWavelength + 37.2, z / TUNE.midWavelength + 91.7) * TUNE.midAmplitude
       + valueNoise(x / TUNE.microWavelength + 512.1, z / TUNE.microWavelength + 77.3) * TUNE.microAmplitude
       - TUNE.hillAmplitude * 0.5;
}

const ROUTE_HALF = () => TUNE.routeLength / 2;
const ROUTE_SCALE = () => TUNE.routeLength / 12000;
const pFromNY = z => clamp((ROUTE_HALF() - z) / TUNE.routeLength, -0.3, 1.3);

function mountainGauss(z) {
  const zc = -1500 * ROUTE_SCALE();
  const w = 430 * ROUTE_SCALE();
  const d = (z - zc) / w;
  return Math.exp(-d * d);
}

function canyonT(z) {
  const zc = -3800 * ROUTE_SCALE();
  const half = 150 * ROUTE_SCALE();
  return clamp(1 - Math.abs(z - zc) / half, 0, 1);
}

function lakeShape(x, z) {
  const cx = -350 * ROUTE_SCALE(), cz = 1800 * ROUTE_SCALE();
  const rx = 640 * ROUTE_SCALE(), rz = 420 * ROUTE_SCALE();
  const nx = (x - cx) / rx, nz = (z - cz) / rz;
  return (nx * nx + nz * nz < 1) ? smoothstep(0.3, 1, nx * nx + nz * nz) : 0;
}

function coastDrop(z) {
  const edge = ROUTE_HALF() + 500 * ROUTE_SCALE();
  const over = Math.max(z - edge, -(z + edge));
  return over <= 0 ? 0 : smoothstep(0, 700 * ROUTE_SCALE(), over) * 16;
}

function desertMask(z) {
  const p = pFromNY(z);
  return smoothstep(0.70, 0.76, p) * (1 - smoothstep(0.84, 0.90, p));
}

function farmMask(z) {
  const p = pFromNY(z);
  return smoothstep(0.24, 0.30, p) * (1 - smoothstep(0.42, 0.48, p));
}

function plainsMask(z) {
  const p = pFromNY(z);
  return smoothstep(0.30, 0.38, p) * (1 - smoothstep(0.50, 0.56, p));
}

// ---------------------------------------------------------------------------
// The Californian harbour: a bay behind a barrier spit.
//
// One smooth mask per region, applied IN ORDER, because the order is the whole
// design: dredge the water, lay the spit across the coast on top of it, then cut
// the mouth back through the spit. Doing the mouth in the same pass as the basin
// (which is where this started) let the two feathers overlap along the whole
// length of the spit and washed it away -- the bay drained straight out to sea
// and the drawbridge stood over open water with nothing to hold back.
//
// `feather` is metres of beach outside the rectangle, so nothing here has an
// edge: the terrain mesh samples every 13 m and a hard step reads as a cliff.
function hbRect(x, z, r) {
  const f = r.feather;
  const dx = Math.max(r.x[0] - x, x - r.x[1]);
  const dz = Math.max(r.z[0] - z, z - r.z[1]);
  const d = Math.max(dx, dz);
  if (d <= 0) return 1;
  if (d >= f) return 0;
  return 1 - smoothstep(0, f, d);
}
function harborHeight(x, z, h) {
  const HB = TUNE.harbor;
  // cheap reject: everything below is inside this box
  if (x < 300 || x > 2400 || z < -7600 || z > -5400) return h;   // the rim reaches -5480
  const deep = TUNE.waterLevel - HB.depth;
  const wBasin = Math.max(hbRect(x, z, HB.basin), hbRect(x, z, HB.outer));
  if (wBasin > 0) h = lerp(h, deep, wBasin);
  const wSpit = hbRect(x, z, HB.spit);
  if (wSpit > 0) h = lerp(h, HB.spit.y, wSpit);
  const wMouth = Math.max(hbRect(x, z, HB.mouth), hbRect(x, z, HB.channel));
  if (wMouth > 0) h = lerp(h, deep, wMouth);

  // ---- and then the lock, in the same order and for the same reason: raise the
  // headland the dock is cut into, THEN cut the dock and the chamber back
  // through it. The dock's water stands six metres above the harbour's, so the
  // ground beside it has to stand higher than that or the dock reads as a puddle
  // sitting on top of a field.
  //
  // The two floors are cut to DIFFERENT depths, and that is the whole trick.
  // The dock's floor is left ABOVE the global sea, so the world's own water
  // plane never appears in it -- the only thing that fills the dock is the
  // dock's own raised surface, and if the lock never ran it would simply be a
  // dry basin. The chamber's floor goes BELOW the global sea, because the
  // chamber has to hold water at both heights. The south approach is ordinary
  // harbour water; the north approach belongs to the dock.
  const LK = TUNE.lock;
  const wRim = hbRect(x, z, LK.rim);
  if (wRim > 0) h = lerp(h, LK.rim.y, wRim);
  const dockFloor = TUNE.waterLevel + LK.lift - LK.dockDepth;
  const chamberFloor = TUNE.waterLevel - LK.chamberDepth;
  const wDock = Math.max(hbRect(x, z, LK.dock), hbRect(x, z, LK.approachN));
  if (wDock > 0) h = lerp(h, dockFloor, wDock);
  const wChamber = Math.max(hbRect(x, z, LK.chamber), hbRect(x, z, LK.approachS));
  if (wChamber > 0) h = lerp(h, chamberFloor, wChamber);
  return h;
}

function shapedTerrain(x, z) {
  let h = rawHeight(x, z);
  h *= 1 - desertMask(z) * 0.62;
  if (mountainGauss(z) > 0.01) {
    h += mountainGauss(z) * (48 + valueNoise(x / 460 + 91, z / 260) * 78) * TUNE.continentCompression;
  }
  const ct = canyonT(z);
  if (ct > 0) {
    h -= ct * ct * 72 * TUNE.continentCompression;
    h += valueNoise(x / 90 + 7, z / 55) * ct * 6;
  }
  const lk = lakeShape(x, z);
  if (lk > 0) h -= lk * 26;
  h -= coastDrop(z);
  const harborZ = ROUTE_HALF() - 1420 * ROUTE_SCALE();  // under the NY bridges, clear of the airport
  if (Math.abs(x) < 2400 && Math.abs(z - harborZ) < 320) {
    const hd = Math.max(0, 1 - Math.abs(Math.abs(z - harborZ) - 60) / 130);
    h -= hd * 9;
  }
  return harborHeight(x, z, h);
}

const AIRPORTS = [
  { cz: ROUTE_HALF(), elev: Math.max(shapedTerrain(0, ROUTE_HALF()), TUNE.waterLevel + 2) },
  { cz: -ROUTE_HALF(), elev: Math.max(shapedTerrain(0, -ROUTE_HALF()), TUNE.waterLevel + 2) }
];

function flattenMask(x, z) {
  let m = 0;
  for (let i = 0; i < AIRPORTS.length; i++) {
    const nx = Math.max(Math.abs(x) - TUNE.runwayWidth * 0.5 - 40 - TUNE.apronWidth, 0) / TUNE.flattenMargin;
    const dzAbs = Math.abs(z - AIRPORTS[i].cz);
    const nz = Math.max(dzAbs - (TUNE.runwayLength * 0.5 + 60), 0) / TUNE.flattenMargin;
    m = Math.max(m, 1 - smoothstep(0, 1, Math.max(nx, nz)));
  }
  return m;
}

function onAnyRunwayRect(x, z) {
  for (let i = 0; i < AIRPORTS.length; i++) {
    if (Math.abs(x) <= TUNE.runwayWidth / 2 + 12 &&
        Math.abs(z - AIRPORTS[i].cz) <= TUNE.runwayLength / 2 + 12) return true;
  }
  return false;
}

function terrainEff(x, z) {
  const m = flattenMask(x, z);
  if (m <= 0.001) return shapedTerrain(x, z);
  let best = AIRPORTS[0];
  let bd = Math.abs(z - AIRPORTS[0].cz);
  for (let i = 1; i < AIRPORTS.length; i++) {
    const d = Math.abs(z - AIRPORTS[i].cz);
    if (d < bd) { bd = d; best = AIRPORTS[i]; }
  }
  return shapedTerrain(x, z) * (1 - m) + best.elev * m;
}

// ---------------------------------------------------------------------------
// HOW HIGH IS THE WATER HERE.
//
// CLAUDE.md's rule is that water is `terrainEff < waterLevel` and nothing else,
// and the reason is that water defined in two places drifts apart from the
// ground under it. The lock needs a second height -- a lock with one water level
// is not a lock -- so rather than add a second definition this GENERALISES the
// one that exists: there is still exactly one answer to "how high is the water",
// it just takes a position now. Everything that floats, rests on, or splashes
// into water asks this; the open sea, the rockets and the ambient beds keep
// using the constant, because for them it is the same number everywhere.
//
// `lockLevelAt` lives in js/lock.js, which loads long after this file -- hence
// the guard. Before it exists (and everywhere it declines) the answer is the
// world's own sea, so the harbour behaves exactly as it always did.
function seaLevelAt(x, z) {
  if (typeof lockLevelAt === "function") {
    const y = lockLevelAt(x, z);
    if (y !== null) return y;
  }
  return TUNE.waterLevel;
}
