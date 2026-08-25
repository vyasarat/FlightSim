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
function cheer() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    synthBlip("triangle", f, f, 0.16, 0.32, i * 0.1);
    synthBlip("sine", f * 2, f * 2, 0.14, 0.1, i * 0.1);
  });
  noiseBurst(0.7, 1800, 0.14, 0.05);
  synthBlip("triangle", 1319, 1319, 0.4, 0.26, 0.44);
}
