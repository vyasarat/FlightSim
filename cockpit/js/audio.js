"use strict";
let audioCtx = null;
let masterGain = null;
let engineNodes = null;

function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    // Boom stacks three sources (~1.65 peak); keep headroom so crashes don't clip.
    masterGain.gain.value = 0.6;
    // A crash boom on top of engine + rolling + alarm can exceed 1.0; the
    // compressor keeps it loud without clipping.
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    masterGain.connect(comp);
    comp.connect(audioCtx.destination);
  }
  // iOS reports "interrupted" (not "suspended") after a call / Siri / lock.
  // Either way: resume, and start the engine only once the context is running.
  if (audioCtx.state !== "running") {
    audioCtx.resume().then(startEngine).catch(() => {});
  } else {
    startEngine();
  }
}

function startEngine() {
  if (engineNodes || !audioCtx || audioCtx.state !== "running") return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = TUNE.engineFreqIdle;
  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = TUNE.engineFilterFreq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(TUNE.engineGainIdle, t + 0.8);
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = TUNE.engineLfoRate;
  const lfoG = audioCtx.createGain();
  lfoG.gain.value = TUNE.engineGainIdle * 0.25;
  lfo.connect(lfoG);
  lfoG.connect(g.gain);
  o.connect(lp);
  lp.connect(g);
  g.connect(masterGain);
  o.start(t);
  lfo.start(t);
  engineNodes = { o, lfo, g };
}

let lastEngineNorm = 1;
function setEngine(speedNorm) {
  speedNorm = clamp(speedNorm, 0, 1.15);
  const unchanged = Math.abs(speedNorm - lastEngineNorm) < 0.003;
  lastEngineNorm = speedNorm;
  if (!engineNodes || !audioCtx || audioCtx.state !== "running" || unchanged) return;
  const t = audioCtx.currentTime;
  const off = speedNorm <= 0.02;
  const gainTarget = off ? 0.0004 : lerp(TUNE.engineGainIdle, TUNE.engineGainMax, speedNorm);
  const freqTarget = off ? TUNE.engineFreqIdle * 0.55 : lerp(TUNE.engineFreqIdle, TUNE.engineFreqMax, speedNorm);
  engineNodes.o.frequency.setTargetAtTime(freqTarget, t, 0.18);
  engineNodes.g.gain.setTargetAtTime(gainTarget, t, 0.22);
}

function synthBlip(type, f0, f1, dur, peak, when) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const t = audioCtx.currentTime + (when || 0);
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(masterGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBurst(dur, freq, peak, when) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const t = audioCtx.currentTime + (when || 0);
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 0.9;
  const g = audioCtx.createGain();
  g.gain.value = peak;
  src.connect(bp);
  bp.connect(g);
  g.connect(masterGain);
  src.start(t);
}

function boing() {
  synthBlip("triangle", 300, 75, 0.34, TUNE.boingVolume, 0);
  synthBlip("sine", 600, 150, 0.34, TUNE.boingVolume * 0.36, 0);
}
function gearSound(down) {
  noiseBurst(0.22, down ? 700 : 900, 0.25, 0);
  if (down) {
    synthBlip("sine", 160, 70, 0.3, 0.32, 0.04);
    synthBlip("square", 300, 300, 0.05, 0.12, 0.18);
  } else {
    synthBlip("sine", 110, 320, 0.3, 0.26, 0.03);
    synthBlip("square", 260, 260, 0.05, 0.1, 0.16);
  }
}
function chirp() {
  synthBlip("sine", 950, 950, 0.07, 0.35, 0);
  synthBlip("sine", 720, 720, 0.09, 0.35, 0.09);
  noiseBurst(0.1, 2400, 0.12, 0);
}
function boomSound() {
  noiseBurst(0.55, 180, 0.65, 0);
  synthBlip("sawtooth", 130, 26, 0.5, 0.5, 0);
  synthBlip("sine", 70, 22, 0.6, 0.5, 0.02);
}
function whoosh() {
  synthBlip("sine", 110, 540, 0.28, 0.22, 0);
  noiseBurst(0.2, 1200, 0.12, 0.02);
}
function ringNote(i) {
  const f = TUNE.ringNotes[Math.min(i, TUNE.ringNotes.length - 1)];
  synthBlip("triangle", f, f, 0.18, 0.3, 0);
  synthBlip("sine", f * 2, f * 2, 0.12, 0.08, 0);
}
function landingChord() {
  [523, 659, 784].forEach((f, i) => synthBlip("triangle", f, f, 0.5, 0.22, i * 0.03));
}
function fanfare() {
  [659, 784, 1047].forEach((f, i) => synthBlip("triangle", f, f, 0.14, 0.3, i * 0.09));
  synthBlip("triangle", 1319, 1319, 0.32, 0.26, 0.3);
}
function alarmBeep() {
  synthBlip("square", 880, 660, 0.14, 0.18, 0);
}
// Rolling-tyre rumble: one looped noise source whose gain follows ground speed
// and cuts at liftoff. Created lazily, never recreated.
let rollNodes = null;
function setRolling(norm) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (!rollNodes) {
    const len = audioCtx.sampleRate * 1.5;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 260;
    const g = audioCtx.createGain();
    g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(masterGain);
    src.start();
    rollNodes = { g, lp };
  }
  const n = clamp(norm, 0, 1);
  if (Math.abs(n - (rollNodes.last || 0)) < 0.004) return;   // no automation spam when unchanged
  rollNodes.last = n;
  rollNodes.g.gain.setTargetAtTime(n * 0.22, audioCtx.currentTime, 0.08);
  rollNodes.lp.frequency.setTargetAtTime(200 + n * 500, audioCtx.currentTime, 0.1);
}
// ---- per-thing sounds: every target and reaction has its own voice so he
// hunts for all of them.
function toot() {
  synthBlip("square", 220, 220, 0.32, 0.22, 0);
  synthBlip("square", 330, 330, 0.32, 0.16, 0);
  synthBlip("square", 220, 220, 0.28, 0.2, 0.42);
}
function gong() {
  synthBlip("sine", 330, 320, 1.4, 0.3, 0);
  synthBlip("sine", 660, 640, 1.0, 0.12, 0);
  synthBlip("triangle", 990, 980, 0.5, 0.08, 0);
  noiseBurst(0.12, 3000, 0.15, 0);
}
function clang() {
  synthBlip("square", 900, 500, 0.22, 0.2, 0);
  synthBlip("sawtooth", 1400, 700, 0.14, 0.1, 0);
  noiseBurst(0.18, 2400, 0.22, 0);
}
function splash() {
  noiseBurst(0.55, 600, 0.35, 0);
  noiseBurst(0.35, 1800, 0.18, 0.05);
  synthBlip("sine", 260, 90, 0.4, 0.14, 0);
}
function flutter() {
  for (let i = 0; i < 4; i++) noiseBurst(0.08, 1600 + i * 300, 0.16, i * 0.07);
}
function deepPop() {
  synthBlip("sine", 140, 40, 0.5, 0.4, 0);
  noiseBurst(0.3, 300, 0.3, 0);
}
function sciFi() {
  synthBlip("sawtooth", 1400, 200, 0.5, 0.18, 0);
  synthBlip("square", 700, 2200, 0.4, 0.1, 0.05);
}
function rustle() {
  noiseBurst(0.35, 2600, 0.22, 0);
  noiseBurst(0.2, 4000, 0.12, 0.12);
}
const ROUTE_SCALE_NOTES = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880];
function routeNote(i) {
  const f = ROUTE_SCALE_NOTES[Math.min(i, ROUTE_SCALE_NOTES.length - 1)];
  synthBlip("triangle", f, f, 0.22, 0.24, 0);
}
// Continuous tones (stall wobble, dive whistle, rain): one oscillator each,
// created lazily, driven by gain so silence costs nothing.
const tones = {};
function setTone(name, type, freq, gain) {
  if (!audioCtx || audioCtx.state !== "running") return;
  let t = tones[name];
  if (!t) {
    const o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = audioCtx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(masterGain); o.start();
    t = tones[name] = { o, g, last: -1 };
  }
  if (Math.abs(gain - t.last) < 0.002 && gain === 0) return;
  t.last = gain;
  t.o.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
  t.g.gain.setTargetAtTime(gain, audioCtx.currentTime, 0.08);
}
let rainNodes = null;
function setRain(level) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (!rainNodes) {
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.5;
    const g = audioCtx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
    rainNodes = { g, last: -1 };
  }
  if (Math.abs(level - rainNodes.last) < 0.003) return;
  rainNodes.last = level;
  rainNodes.g.gain.setTargetAtTime(level * 0.12, audioCtx.currentTime, 0.3);
}
function chime() {
  [880, 1175, 1760].forEach((f, i) => synthBlip("triangle", f, f, 0.5, 0.22, i * 0.06));
  synthBlip("sine", 3520, 3520, 0.4, 0.06, 0.1);
}
function fireworkSound(when) {
  synthBlip("sine", 400, 1500, 0.9, 0.08, when);           // whistle up
  noiseBurst(0.5, 700, 0.4, when + 0.95);                  // pop
  noiseBurst(0.7, 2500, 0.18, when + 1.0);                 // crackle
}
function boatHorn() {
  synthBlip("sawtooth", 110, 108, 0.7, 0.2, 0);
  synthBlip("square", 165, 163, 0.7, 0.08, 0);
}
function squeak() {
  synthBlip("sine", 900, 1300, 0.12, 0.14, 0);
  synthBlip("sine", 1300, 900, 0.12, 0.12, 0.13);
}
function shutter() {
  noiseBurst(0.04, 3000, 0.3, 0);
  synthBlip("square", 1800, 900, 0.05, 0.12, 0.03);
  noiseBurst(0.05, 2200, 0.25, 0.09);
}
function cheer() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    synthBlip("triangle", f, f, 0.16, 0.32, i * 0.1);
    synthBlip("sine", f * 2, f * 2, 0.14, 0.1, i * 0.1);
  });
  noiseBurst(0.7, 1800, 0.14, 0.05);
  synthBlip("triangle", 1319, 1319, 0.4, 0.26, 0.44);
}
