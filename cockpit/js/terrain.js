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
  if (lk > 0) h -= lk * 14;
  h -= coastDrop(z);
  const harborZ = ROUTE_HALF() - 420 * ROUTE_SCALE();
  if (Math.abs(x) < 2400 && Math.abs(z - harborZ) < 320) {
    const hd = Math.max(0, 1 - Math.abs(Math.abs(z - harborZ) - 60) / 130);
    h -= hd * 9;
  }
  return h;
}

const AIRPORTS = [
  { cz: ROUTE_HALF(), elev: Math.max(shapedTerrain(0, ROUTE_HALF()), TUNE.waterLevel + 2) },
  { cz: -ROUTE_HALF(), elev: Math.max(shapedTerrain(0, -ROUTE_HALF()), TUNE.waterLevel + 2) }
];

function flattenMask(x, z) {
  let m = 0;
  for (let i = 0; i < AIRPORTS.length; i++) {
    const nx = Math.max(Math.abs(x) - TUNE.runwayWidth * 0.5 - 40, 0) / TUNE.flattenMargin;
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
