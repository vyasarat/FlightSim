"use strict";
const el = {};
["hud", "pillarL", "pillarR", "brow", "dash", "asiDial", "aiDial", "altDial",
 "aiBall", "altDigits", "rotateArrow", "throttleBtn", "fx", "homeArrow",
 "screenVehicle", "screenDir", "screenDest", "progressStrip", "viewBtn", "gearBtn", "slowBtn", "glideGuide", "skipBtn", "fastBtn", "missileBtn", "aimMarker", "vehBtn", "alarm", "wingman", "camBtn", "photo", "photoImg", "flash", "stageBtn", "satBtn", "chuteBtn", "reentryGlow", "roverBtn", "hatchBtn", "bigNum", "bucketBtn", "catBtn"].forEach(id => {
  el[id] = document.getElementById(id);
});
el.homeArrow.style.setProperty("--home-sz", TUNE.homeIndicatorSize + "px");

(function buildDialTicks() {
  const svgNS = "http://www.w3.org/2000/svg";
  for (const dialId of ["asiDial", "altDial"]) {
    const dial = el[dialId];
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    for (let i = 0; i <= 8; i++) {
      const ang = (-120 + (i / 8) * 240 - 90) * Math.PI / 180;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", 50 + Math.cos(ang) * 39);
      line.setAttribute("y1", 50 + Math.sin(ang) * 39);
      line.setAttribute("x2", 50 + Math.cos(ang) * 46);
      line.setAttribute("y2", 50 + Math.sin(ang) * 46);
      line.setAttribute("stroke", "#8b93a0");
      line.setAttribute("stroke-width", i % 2 === 0 ? "2.6" : "1.4");
      svg.appendChild(line);
    }
    dial.appendChild(svg);
  }
  const asiNeedle = document.createElement("div");
  asiNeedle.className = "needle";
  el.asiDial.appendChild(asiNeedle);
  const asiCap = document.createElement("div");
  asiCap.className = "dial-cap";
  el.asiDial.appendChild(asiCap);
  const altNeedle = document.createElement("div");
  altNeedle.className = "needle red";
  el.altDial.appendChild(altNeedle);
  const altCap = document.createElement("div");
  altCap.className = "dial-cap";
  el.altDial.appendChild(altCap);
  el.asiNeedle = asiNeedle;
  el.altNeedle = altNeedle;
})();

const STRIP_DOTS = [0.985, 0.955, 0.9, 0.78, 0.72, 0.55, 0.42, 0.3, 0.185, 0.09, 0.04, 0.01];
const stripDots = [];
(function buildStrip() {
  for (const f of STRIP_DOTS) {
    const d = document.createElement("div");
    d.className = "dot";
    d.style.left = (f * 100) + "%";
    el.progressStrip.appendChild(d);
    stripDots.push({ el: d, f });
  }
  const marker = document.createElement("div");
  marker.className = "marker";
  marker.innerHTML = '<svg viewBox="0 0 20 20"><path d="M10 2 L17 16 L10 12.5 L3 16 Z" fill="#f2f4f7" stroke="#23282f" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  el.progressStrip.appendChild(marker);
  el.stripMarker = marker;
})();
let lastStripP = -1;

function updateStrip() {
  const oCz = AIRPORTS[state.originIdx].cz;
  const dCz = AIRPORTS[state.destIdx].cz;
  const pr = clamp((oCz - state.z) / (oCz - dCz), 0, 1);
  if (Math.abs(pr - lastStripP) < 0.0015) return;
  lastStripP = pr;
  const northbound = state.dirIdx === 1;
  const shown = northbound ? 1 - pr : pr;
  el.stripMarker.style.left = (shown * 100) + "%";
  el.stripMarker.style.transform = northbound ? "scaleX(-1)" : "none";
  let passed = 0;
  for (const d of stripDots) {
    const fShown = northbound ? 1 - d.f : d.f;
    const p = fShown <= pr;
    d.el.classList.toggle("passed", p);
    if (p) passed++;
  }
  // each landmark passed plays the next note of the scale
  if (passed > stripNotesPlayed && stripNotesPlayed >= 0 && state.phase === "AIRBORNE") routeNote(passed - 1);
  stripNotesPlayed = passed;
}
let stripNotesPlayed = -1;   // -1: first update just syncs (no note on spawn)

const fxCanvas = el.fx;
const fxCtx = fxCanvas.getContext("2d");
let confetti = [];

function resizeFx() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fxCanvas.width = Math.round(window.innerWidth * dpr);
  fxCanvas.height = Math.round(window.innerHeight * dpr);
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function confettiBurst() {
  const colors = ["#e0483e", "#ffd23e", "#36c46a", "#3aa0ff", "#ff7ab8", "#ffffff"];
  for (let i = 0; i < 140; i++) {
    confetti.push({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 160,
      vy: 120 + Math.random() * 260,
      size: 6 + Math.random() * 9,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 9,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 3.4
    });
  }
}

function sparkleBurst() {
  const colors = ["#ffd23e", "#ffffff", "#fff2a8"];
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 260;
    confetti.push({
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
      size: 5 + Math.random() * 6, rot: a, vr: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)], life: 1.3
    });
  }
}

let fxDirty = false;
function updateFx(dt) {
  if (!confetti.length) {
    if (fxDirty) { fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight); fxDirty = false; }
    return;
  }
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  fxDirty = true;
  const next = [];
  for (const p of confetti) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 210 * dt;
    p.rot += p.vr * dt;
    if (p.life > 0 && p.y < window.innerHeight + 40) {
      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      fxCtx.restore();
      next.push(p);
    }
  }
  confetti = next;
}
