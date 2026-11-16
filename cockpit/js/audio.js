"use strict";
// WORKING RULES (moved here from CLAUDE.md)
// TUNE.audio has the master and a gain per layer. The ambient bed (beds.*) is
// one looping brown-noise source whose gain, lowpass corner and beat are chosen
// by where he is; currentBedName() decides. Big events are stacks, not samples
// (bigBoom, catapultSound, fireHiss). sfxPlace(x,y,z) gives a pan and a falloff
// off the camera. The vehicle keys are `helicopter` and
// `airlinerDelta`/`airlinerEmirates` -- there is no "heli" or "airliner".
let audioCtx = null;
let masterGain = null;
// (v217) the voices the picker's hold quieted, and how to put each back (audioHoldStill, below). Every voice
// writer calls audioHeldWrote first: a voice its owner writes is the owner's again, and is never put back.
let audioHeld = null, audioHolding = false;
function audioHeldWrote(key) { if (audioHeld && !audioHolding) delete audioHeld.v[key]; }

function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    // Boom stacks three sources (~1.65 peak); keep headroom so crashes don't clip.
    masterGain.gain.value = TUNE.audio.master;
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

// The engine used to be ONE sawtooth oscillator shared by every vehicle that
// was not the rocket, with the car, the boat and the yacht each running a
// second oscillator of their own beside it. It is two crossfaded loops per
// vehicle now (js/engines.js), which is the same model whether the loops are
// synthesised or recorded -- see that file. `startEngine` still exists because
// it is where the rocket's graph gets built inside the unlock gesture.
function startEngine() {
  if (!audioCtx || audioCtx.state !== "running") return;
  ensureRocketNodes();
}

// How hard he is working it, 0..1-and-a-bit. Every vehicle says this and nothing
// else; js/engines.js turns it into a voice once a frame. Keeping the name and
// the signature is deliberate -- sixteen call sites across twelve files say
// exactly the right thing already.
let engineLevel = 0;
function setEngine(speedNorm) {
  engineLevel = clamp(speedNorm, 0, 1.2);
}
function engineLevelNow() { return engineLevel; }

// ---------------------------------------------------------------------------
// A ONE-SHOT CLEANS UP AFTER ITSELF.
//
// Every voice in this file that is fired and forgotten -- a blip, a noise burst,
// the low tail of a bang -- connects itself into the graph and used to stay
// connected for the rest of the session. Thirty minutes of ordinary play left
// three and a half thousand finished nodes hanging off the master gain, and not
// one of them ever went away: a real-time settle of forty seconds after a burst
// of six hundred did not release a single one.
//
// `onended` fires when the source stops, which is the moment the whole little
// chain behind it is finished with.
// ---------------------------------------------------------------------------
function sfxOneShot(src, chain) {
  src.onended = () => { for (const n of chain) { try { n.disconnect(); } catch (e) {} } };
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
  sfxOneShot(o, [o, g]);
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
  src.stop(t + dur + 0.05);      // it would end on its own; this is what gives it an `onended`
  sfxOneShot(src, [src, bp, g]);
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
// ---------------------------------------------------------------------------
// THE CAR HORN.
//
// It sounded like a bus, and it was three things at once: two SAWTOOTH voices
// (every harmonic, including a fat low one), a fundamental at 294 Hz, and
// `setTone`'s 80 ms smoothing on both ends, which gave it a soft swell and a
// long fade. A Model Y is the opposite of all three -- a short, high, clean
// two-tone that starts and stops.
//
// So: triangles at 400 and 500 Hz (a triangle is nearly a sine with just enough
// edge), a whisper of square for the bite, and a HIGH-PASS that removes what
// little low energy is left, on an envelope of eight milliseconds up and fifty
// down. Held, it simply stays on -- high and clean, never a drone, because
// there is nothing low in it to drone with.
let hornNodes = null;
function ensureHorn() {
  if (hornNodes || !audioCtx || audioCtx.state !== "running") return;
  const H = TUNE.car.horn;
  const g = audioCtx.createGain();
  g.gain.value = 0;
  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = H.highpass; hp.Q.value = 0.7;
  const oscs = [];
  const mk = (type, hz, level) => {
    const o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = hz;
    const og = audioCtx.createGain(); og.gain.value = level;
    o.connect(og); og.connect(hp); o.start();
    oscs.push({ o, hz, type });
  };
  mk("triangle", H.hz[0], 1.0);
  mk("triangle", H.hz[1], 0.85);
  mk("square", H.hz[1], H.bite);      // the edge, and only the edge
  hp.connect(g); g.connect(masterGain);
  hornNodes = { g, hp, oscs, on: false };
}
function setCarHorn(on) {
  audioHeldWrote("horn");
  ensureHorn();
  if (!hornNodes || !audioCtx) return;
  const H = TUNE.car.horn, t = audioCtx.currentTime;
  if (on === hornNodes.on) return;
  hornNodes.on = on;
  const p = hornNodes.g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(Math.max(0.0001, p.value), t);
  if (on) p.linearRampToValueAtTime(H.gain, t + H.attack);
  else p.linearRampToValueAtTime(0.0001, t + H.release);
}
// What the harness reads: every voice in it, and the envelope it runs on.
function carHornVoices() {
  ensureHorn();
  if (!hornNodes) return null;
  return { hz: hornNodes.oscs.map(o => o.o.frequency.value),
           types: hornNodes.oscs.map(o => o.type),
           highpass: hornNodes.hp.frequency.value,
           attack: TUNE.car.horn.attack, release: TUNE.car.horn.release,
           tap: TUNE.car.horn.tap, on: hornNodes.on };
}

let rollNodes = null;
function setRolling(norm) {
  audioHeldWrote("roll");
  if (!audioCtx || audioCtx.state !== "running") {
    if (rollNodes && norm <= 0 && rollNodes.last !== 0) { audioHush(rollNodes.g); rollNodes.last = 0; }   // (v213)
    return;
  }
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
// (v213) A SILENCE IS NEVER DROPPED. Asked for while the context is not running -- the iPad
// locked, a call, Siri, and the first tap after (its resume is async) -- a ramp to 0 was skipped
// by the early return, and the voice came back at its old level with nobody left to silence it:
// dad mode's engines, the race's crowd, droning on in his game. So a silence is written straight
// into the gain, which needs no running clock.
function audioHush(g) { g.gain.cancelScheduledValues(0); g.gain.value = 0; }
// (v224, B5) TONE OWNERSHIP. Every setTone stamps the frame it was written on (frameCount, the game's own counter,
// never the wall clock) -- unless it is the picker's hold or the sweep writing it (audioHolding, toneSweeping):
// those are not its owner. A tone named in TONES_OWNED is owned PER FRAME: its one writer writes it on every frame he should hear it,
// so on a frame it was not written nobody wants it, and the frame's audio tail (audioFrame, AUDIO_TAILS.sweep)
// sends it to zero through setTone's own 0.08 s ramp -- the same silence its writer would have written, so no click.
// One tone per release (QUEUE B5). Each one's writer is surveyed first: it must write every frame it is audible.
//   carTyre (v224, Q-16)  updateCar (car.js) writes it on every frame it runs -- the bang and the toy track at 0,
//                         else from his speed -- and nothing else does above zero. A race (rcUpdate) never runs it, and
//                         the tyres held their last gain under the whole race.
const TONES_OWNED = ["carTyre"];
const toneStamp = {};
// frameCount is input.js's (it loads after this file), and a tone written while the page loads -- applyVehicle's
// silences, before input.js has run -- is written before frame 0: that read would be its temporal dead zone
function toneFrameNow() { try { return frameCount; } catch (e) { return -1; } }
let toneSweeping = false;
function audioSweepOwned() {
  toneSweeping = true;   // the sweep is not the tone's owner: no stamp. Its write IS a write to the hold (audioHeldWrote):
  for (const n of TONES_OWNED) {   // a swept tone is forgotten, never put back by audioHoldResume
    const t = tones[n];
    if (!t || !(t.last > 0) || toneStamp[n] === frameCount) continue;
    setTone(n, t.o.type, t.o.frequency.value, 0);
    flags.tonesSwept = (flags.tonesSwept || 0) + 1;
  }
  toneSweeping = false;
}
function setTone(name, type, freq, gain) {
  audioHeldWrote("tone:" + name);
  if (!audioHolding && !toneSweeping) toneStamp[name] = toneFrameNow();
  if (!audioCtx || audioCtx.state !== "running") {
    const t = tones[name];
    if (t && gain <= 0 && t.last !== 0) { audioHush(t.g); t.last = 0; }
    return;
  }
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
  if (!audioCtx || audioCtx.state !== "running") {
    if (rainNodes && level <= 0 && rainNodes.last !== 0) { audioHush(rainNodes.g); rainNodes.last = 0; }   // (v213)
    return;
  }
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
function thunk() {
  // the door closing: a soft, low, entirely un-alarming thud
  synthBlip("sine", 130, 62, 0.16, 0.30, 0);
  noiseBurst(0.09, 190, 0.16, 0);
}
function chime() {
  [880, 1175, 1760].forEach((f, i) => synthBlip("triangle", f, f, 0.5, 0.22, i * 0.06));
  synthBlip("sine", 3520, 3520, 0.4, 0.06, 0.1);
}
// `pop`: seconds from the whistle to the bang -- the show passes the moment its sky opens (the race's podium,
// TUNE.race.podium.fw.pop), so the two can never drift apart; the world's shows keep the 0.95 they always had
function fireworkSound(when, pop = 0.95) {
  synthBlip("sine", 400, 1500, 0.9, 0.08, when);           // whistle up
  noiseBurst(0.5, 700, 0.4, when + pop);                   // pop
  noiseBurst(0.7, 2500, 0.18, when + pop + 0.05);          // crackle
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
// Rocket engine: a deep roar (low-passed noise) over a sub-bass rumble, with
// crackle at full thrust. Thins to a soft hum in space (no air to carry it).
let rocketNodes = null;
let audioRetryT = 0;
function ensureRocketNodes() {
  if (rocketNodes || !audioCtx || audioCtx.state !== "running") return;
  {
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220; lp.Q.value = 0.7;
    const roar = audioCtx.createGain(); roar.gain.value = 0;
    src.connect(lp); lp.connect(roar); roar.connect(masterGain); src.start();
    const src2 = audioCtx.createBufferSource(); src2.buffer = buf; src2.loop = true;
    const hp = audioCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
    const crackle = audioCtx.createGain(); crackle.gain.value = 0;
    src2.connect(hp); hp.connect(crackle); crackle.connect(masterGain); src2.start();
    const sub = audioCtx.createOscillator(); sub.type = "sine"; sub.frequency.value = 38;
    const subG = audioCtx.createGain(); subG.gain.value = 0;
    sub.connect(subG); subG.connect(masterGain); sub.start();
    const wob = audioCtx.createOscillator(); wob.type = "sine"; wob.frequency.value = 7;   // slow throb on the sub
    const wobG = audioCtx.createGain(); wobG.gain.value = 6;
    wob.connect(wobG); wobG.connect(sub.frequency); wob.start();
    rocketNodes = { roar, crackle, subG, lp, last: -1, lastSpace: -1 };
  }
}
function setRocketEngine(level, inSpace) {
  audioHeldWrote("rocket");
  if (!audioCtx) return;
  if (audioCtx.state !== "running") {
    // iOS can leave the context suspended / interrupted after a lock or a call:
    // keep asking for it while he wants sound, at most once a second
    if (level > 0 && performance.now() - audioRetryT > 1000) { audioRetryT = performance.now(); audioCtx.resume().then(startEngine).catch(() => {}); }
    return;
  }
  ensureRocketNodes();
  if (!rocketNodes) return;
  const n = clamp(level, 0, 1), sp = clamp(inSpace, 0, 1);
  if (Math.abs(n - rocketNodes.last) < 0.004 && Math.abs(sp - rocketNodes.lastSpace) < 0.01) return;
  rocketNodes.last = n; rocketNodes.lastSpace = sp;
  const t = audioCtx.currentTime;
  const air = 1 - sp * 0.75;
  rocketNodes.roar.gain.setTargetAtTime(n * 0.55 * air, t, 0.12);
  rocketNodes.lp.frequency.setTargetAtTime(160 + n * 320 - sp * 120, t, 0.15);
  rocketNodes.crackle.gain.setTargetAtTime(n > 0.85 ? (n - 0.85) * 1.2 * air : 0, t, 0.1);
  rocketNodes.subG.gain.setTargetAtTime(n * 0.5 * air, t, 0.12);
}
let reentryNodes = null;
function setReentryRoar(level) {
  audioHeldWrote("reentry");
  if (!audioCtx || audioCtx.state !== "running") {
    if (reentryNodes && level <= 0 && reentryNodes.last !== 0) { audioHush(reentryNodes.g); audioHush(reentryNodes.lfoG); reentryNodes.last = 0; }   // (v213)
    return;
  }
  if (!reentryNodes) {
    if (level <= 0) return;
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.6;
    const g = audioCtx.createGain(); g.gain.value = 0;
    const lfo = audioCtx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 9;   // the buffeting
    const lfoG = audioCtx.createGain(); lfoG.gain.value = 0;
    lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
    reentryNodes = { g, bp, lfoG, last: -1 };
  }
  const n = clamp(level, 0, 1);
  if (Math.abs(n - reentryNodes.last) < 0.004) return;
  reentryNodes.last = n;
  const t = audioCtx.currentTime;
  reentryNodes.g.gain.setTargetAtTime(n * 0.5, t, 0.15);
  reentryNodes.lfoG.gain.setTargetAtTime(n * 0.18, t, 0.15);
  reentryNodes.bp.frequency.setTargetAtTime(380 + n * 500, t, 0.2);
}
function chutePop(mains) {
  noiseBurst(0.22, mains ? 600 : 900, mains ? 0.5 : 0.35, 0);
  synthBlip("sine", mains ? 260 : 340, mains ? 150 : 200, 0.35, 0.22, 0.02);
  rustle();
  if (mains) { noiseBurst(0.5, 1400, 0.18, 0.25); synthBlip("triangle", 880, 880, 0.18, 0.18, 0.5); synthBlip("triangle", 1175, 1175, 0.25, 0.18, 0.68); }
}
function satBeep() {
  [1400, 1800, 2200].forEach((f, i) => synthBlip("sine", f, f, 0.09, 0.2, 0.1 + i * 0.16));
  noiseBurst(0.6, 2400, 0.1, 0.05);
  synthBlip("triangle", 660, 660, 0.3, 0.16, 0.7);
}
function sonicBoom() {
  noiseBurst(0.12, 110, 0.75, 0);
  noiseBurst(0.12, 110, 0.6, 0.17);
  synthBlip("sine", 48, 30, 0.35, 0.3, 0);
}
function stageSep() {
  noiseBurst(0.18, 500, 0.4, 0);
  synthBlip("square", 220, 120, 0.2, 0.2, 0);
  noiseBurst(0.6, 2200, 0.16, 0.15);   // hiss of the pushers
}
function liftoffRoar() {
  noiseBurst(1.6, 160, 0.5, 0);
  synthBlip("sawtooth", 60, 40, 1.4, 0.3, 0);
}
function boosterLand() {
  noiseBurst(0.4, 300, 0.3, 0);
  synthBlip("sine", 90, 50, 0.5, 0.25, 0.05);
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

// ===========================================================================
// Polish pass 5. Everything below is mix and texture: no sound here decides
// anything, and every one of them no-ops safely until the context is unlocked.
// ===========================================================================

const AU = TUNE.audio;

// ---- positional: a pan and a falloff for anything that happens out in the
// world rather than in his own cockpit. Distance is measured from the camera,
// because that is where he is listening from.
function sfxPlace(x, y, z) {
  if (x === undefined || typeof camera === "undefined") return null;
  const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > AU.falloff) return { gain: 0, pan: 0 };
  // right-hand side of the screen is positive pan: project onto the camera's own right
  const fwd = sfxTmpA, right = sfxTmpB;
  camera.getWorldDirection(fwd);
  right.set(fwd.z, 0, -fwd.x).normalize();
  const pan = clamp((dx * right.x + dz * right.z) / AU.panWidth, -1, 1);
  return { gain: 1 - d / AU.falloff, pan };
}
const sfxTmpA = new THREE.Vector3(), sfxTmpB = new THREE.Vector3();

// A pan stage for one sound. Returns the node to connect into.
function sfxBus(place, layer) {
  const g = audioCtx.createGain();
  g.gain.value = (place ? place.gain : 1) * (layer === undefined ? AU.event : layer);
  if (place && audioCtx.createStereoPanner) {
    const p = audioCtx.createStereoPanner();
    p.pan.value = place.pan;
    g.connect(p); p.connect(masterGain);
    g.__sfxChain = [g, p];
  } else {
    g.connect(masterGain);
    g.__sfxChain = [g];
  }
  return g;
}

// ---- the ambient bed -------------------------------------------------------
// One looping noise source and one low oscillator, filtered and gated. Which
// bed is playing is decided by where he is, and they crossfade.
let bedNodes = null;
function ensureBed() {
  if (bedNodes || !audioCtx || audioCtx.state !== "running") return;
  const len = Math.floor(audioCtx.sampleRate * 2.5);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  // brown-ish noise: white noise is a hiss, and a hiss is harsh
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.2;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 500; lp.Q.value = 0.4;
  const g = audioCtx.createGain();
  g.gain.value = 0.0001;
  // the beat: rotor wash and the slow breath in space are the same node
  const lfo = audioCtx.createOscillator();
  lfo.type = "sine"; lfo.frequency.value = 0.3;
  const lfoG = audioCtx.createGain();
  lfoG.gain.value = 0;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(masterGain);
  src.start(); lfo.start();
  bedNodes = { src, lp, g, lfo, lfoG, level: 0, cut: 500, thump: 0 };
}

// Which room he is in. ASK THE VEHICLE, then the phase -- in that order, and
// the order is the bug this fixes. Every surface vehicle writes
// `phase = "TAXI"` as a way of saying "not flying", so a boat fell through to
// the `phase === "TAXI"` line and spent the whole harbour listening to the
// APRON RUMBLE of an airport two thousand metres inland. The phase is the last
// question asked now, and only the aeroplane ever reaches it.
function currentBedName() {
  if (typeof rk !== "undefined" && rk && rk.onBody) return rk.onBody.name === "mars" ? "mars" : "moon";
  if (state.spaceF > 0.55) return "space";
  const k = typeof vehKind === "function" ? vehKind() : "plane";
  if ((typeof vehIsCar === "function" && vehIsCar()) || k === "monster") return "car";   // the SUV, the Cybertruck (v146), the monster truck
  if (k === "heli") return "heli";
  if (k === "boat" || k === "yacht") return "sea";
  if (k === "sled") return "wind";     // v144: on the rocket sled it is the air rushing past, never the apron
  if (k === "crane") return "wind";    // v145: the crane stands out in the open country, never on an apron
  // the keys are airlinerDelta / airlinerEmirates, never "airliner"
  if (state.vehicleKey && state.vehicleKey.indexOf("airliner") === 0) return "airliner";
  if (state.phase === "TAXI" || state.phase === "ROLL") return "ground";
  return "wind";
}

function updateAmbientAudio(dt) {
  if (!audioCtx || audioCtx.state !== "running") return;
  ensureBed();
  if (!bedNodes) return;
  const name = currentBedName();
  const B = AU.beds[name] || AU.beds.ground;
  let gain = B.gain;
  if (name === "wind") {
    // aloft the wind grows with how fast and how high he is going
    const agl = state.y - Math.max(terrainEff(state.x, state.z), TUNE.waterLevel);
    const alt = clamp((agl - AU.windFromAlt[0]) / (AU.windFromAlt[1] - AU.windFromAlt[0]), 0, 1);
    const sp = clamp(state.speed / (state.vp ? state.vp.cruiseSpeed : 60), 0, 1.3);
    gain *= 0.45 + AU.windFromSpeed * sp + 0.5 * alt;
  }
  // Inside, the engine is muffled and turned down (js/engines.js), so the wind
  // and the tyres come UP to fill the room -- which is what being in a cabin
  // actually sounds like, and it keeps the total where it was.
  gain *= state.viewChase ? 1 : AU.bedInside;
  if (typeof police !== "undefined" && police.active) gain *= TUNE.police.duck;
  const k = Math.min(1, AU.bedBlend * dt);
  bedNodes.level += (gain * AU.bed - bedNodes.level) * k;
  bedNodes.cut += (B.cut - bedNodes.cut) * k;
  bedNodes.thump += (B.thump - bedNodes.thump) * k;
  const t = audioCtx.currentTime;
  bedNodes.g.gain.setTargetAtTime(Math.max(0.00005, bedNodes.level), t, 0.25);
  bedNodes.lp.frequency.setTargetAtTime(bedNodes.cut, t, 0.3);
  bedNodes.lfoG.gain.setTargetAtTime(bedNodes.level * bedNodes.thump, t, 0.3);
  if (B.thumpRate) bedNodes.lfo.frequency.setTargetAtTime(B.thumpRate, t, 0.4);
}

// ---- the frame's audio (v217, B2) -------------------------------------------
// update() brings the sound up to date in ONE place per way through it, and
// they are not the same: AUDIO_TAILS names what each does, in the order it does
// it -- the bed for wherever he is, then the horn's tones, then the engine voice
// from whatever setEngine was last told (here rather than inside setEngine
// because the crossfade, the wobble and the doppler decay all need dt, and
// sixteen call sites do not have one).
//   frame  update()'s own tail: the bed, the horn, the engine
//   eject  under the canopy: the horn (carHornCan() is false there, so it goes
//          off) and the engine (ejectStart set it to 0, and only engUpdate moves
//          the voice -- v213: it droned at cruise for the whole rescue); the bed
//          is not brought up to date
//   hold   behind the picker (v212's hold, menuOpen() && !vehParked()): the bed
//          and the engine; the horn is not brought up to date -- and (v217,
//          Q-3) his vehicle's motion voices go quiet (audioHoldStill); the
//          frame tail puts back what nothing has written since (audioHoldResume)
// The bang branch has no audio tail of its own (HUD-7: the engine is not moved
// there) -- it is not a row here until that is fixed.
//   (v224, B5) `sweep`: the tones owned per frame (TONES_OWNED) that nobody wrote this frame go to zero, LAST in
// the tail -- after the hold's resume, so what the resume puts back is the owner's arguments, and a tone its
// owner did not write is swept even so. Per way through update():
//   frame  yes: every writer has run (the vehicle's update, the world's, the hold's resume); nothing after
//          audioFrame in update() writes an owned tone (the controls and HUD, the fx, the explosion's free pieces)
//   eject  yes: under the canopy nothing drives what he left (ejectStart silenced every tone already)
//   hold   no: behind the picker the hold owns his motion voices (audioHoldStill quiets and remembers them; a
//          sweep there would only repeat it)
//   bang   no tail at all, so no sweep: in pieces nothing of his vehicle is written and its voices go on as they
//          were (HUD-7's family, a change of its own). A car is in pieces for ONE frame (carCrash's explodeTimer 0:
//          the next frame reassembles him) and its tyres are written again the frame after; v224's survey measured
//          that one unwritten frame per bang and nothing else. The fixed-wing wall-bang frame, the same: no sweep.
const AUDIO_TAILS = {
  frame: { bed: true,  horn: true,  still: false, resume: true,  sweep: true },
  eject: { bed: false, horn: true,  still: false, resume: false, sweep: true },
  hold:  { bed: true,  horn: false, still: true,  resume: false, sweep: false },
};
// (v217, Q-3) Behind the picker nothing he is in moves (flight.js, v212's hold), and a vehicle's motion voices
// are written only by its own update, which the hold does not run: the dive whistle, the tyres, the hull, the
// booster's roar, the track's rattle, the crane's rumble and the rocket's roar held their last gain under the
// cards. Each goes to 0 through its OWN writer (setTone's 0.08 s ramp, the roll's, the rocket's, the horn's
// release), so nothing pops, and nothing is built that is not there yet -- a silent voice is left alone, and
// no graph is made (they draw on the random stream when they are).
//   WHAT WAS QUIETED IS PUT BACK. Most of these are rewritten by their owner every frame, but not all: the
// crane's rumble is written in its count and wind-up and then HELD, on purpose, through the swing and the fall
// until the towers are down (crane.js); the boat's hull holds through a jump. So the hold remembers each voice
// it quieted, as its writer's own arguments, and on the first frame that runs update()'s own tail it writes
// back every one that nothing has written since (audioHeldWrote, in every writer: a voice its owner wrote
// again is the owner's, and is left as the owner set it). Nothing of a vehicle he has left comes back:
// applyVehicle and spawnForTakeoff forget the lot (audioHoldForget), and so does a change of mode under the
// cards (vehKind()) -- the race, the globe. The eject and every fresh start write their own silence first.
//   What the hold does not touch: the ambient bed (where he is has not changed), the engine voice (v212's hold
// has always moved it from its last level), the rain (updateSky still runs) and the world's tones whose
// writers run before the hold every frame (updateEvents and updateSetpieces, flight.js:384: the demolition,
// the harbour, the launch site, the sled's roar, the arena truck, the seaplane, the rocket events). Two world
// voices DO hold behind the cards, and are not this release's: the police siren (police.js:207-208, written
// only from updatePolice, which the hold skips) and the race's crowd and surface tones (race.js:2579-2581,
// written from the race's own update). Every tone applyVehicle silences (state.js VEHICLE_TONES) is here;
// engine_sound_checks holds the two lists together.
const HELD_STILL = ["stall", "dive", "carTyre", "cvRoar", "boatHull", "boatCannon", "yachtHull", "rover", "srBurst",
                    "trkRattle", "trkWhir", "crRumble", "crHum", "fans"];
function audioHoldStill() {
  if (!audioHeld) audioHeld = { kind: typeof vehKind === "function" ? vehKind() : "", v: {} };
  const H = audioHeld.v;
  audioHolding = true;
  for (const n of HELD_STILL) {
    const t = tones[n];
    if (!t || !(t.last > 0)) continue;
    const type = t.o.type, freq = t.o.frequency.value, gain = t.last;
    if (!H["tone:" + n]) H["tone:" + n] = () => setTone(n, type, freq, gain);
    setTone(n, type, freq, 0);
  }
  if (rollNodes && rollNodes.last > 0) { const n = rollNodes.last; if (!H.roll) H.roll = () => setRolling(n); setRolling(0); }
  if (rocketNodes && rocketNodes.last > 0) {
    const n = rocketNodes.last, sp = rocketNodes.lastSpace;
    if (!H.rocket) H.rocket = () => setRocketEngine(n, sp);
    setRocketEngine(0, sp);
  }
  if (reentryNodes && reentryNodes.last > 0) { const n = reentryNodes.last; if (!H.reentry) H.reentry = () => setReentryRoar(n); setReentryRoar(0); }
  if (hornNodes && hornNodes.on) { if (!H.horn) H.horn = () => setCarHorn(true); setCarHorn(false); }
  audioHolding = false;
}
// the first frame of update()'s own tail after a hold: back, whatever nobody has written since
function audioHoldResume() {
  const A = audioHeld;
  audioHeld = null;
  if (!A || (typeof vehKind === "function" && vehKind() !== A.kind)) return;
  audioHolding = true;   // (v224) a voice put back is not its owner writing it: no stamp, so an owned tone is still swept
  for (const k in A.v) A.v[k]();
  audioHolding = false;
}
function audioHoldForget() { audioHeld = null; }
function audioFrame(dt, tail) {
  const T = AUDIO_TAILS[tail];
  if (T.still) audioHoldStill();
  if (T.bed) updateAmbientAudio(dt);
  if (T.horn) carUpdateHorn(dt);   // the horn's TONES; whether its button exists is the table's (buttons.js)
  engUpdate(engineLevelNow(), dt);
  if (T.resume && audioHeld) audioHoldResume();
  if (T.sweep) audioSweepOwned();
}

// ---- layered events --------------------------------------------------------
// A single sample is what a toy sounds like. Every big thing in the game is a
// stack now: a body, a texture, and a tail.

// boom + crackle + debris tinkle + a low rumble that outlasts them both
function bigBoom(x, y, z) {
  // The bang itself goes first and unguarded: boomSound no-ops on its own when
  // there is no context, and it stays the one call that means "something blew
  // up" for anything watching from outside.
  boomSound();
  if (!audioCtx || audioCtx.state !== "running") return;
  const place = sfxPlace(x, y, z);
  if (place && place.gain <= 0) return;
  // crackle: three short bright bursts, staggered
  for (let i = 0; i < 3; i++) noiseBurst(0.12 + Math.random() * 0.1, 900 + Math.random() * 1400, 0.11, 0.05 + i * 0.07);
  // debris tinkle
  for (let i = 0; i < 4; i++) synthBlip("triangle", 1400 + Math.random() * 1200, 700, 0.09, 0.05, 0.12 + i * 0.06);
  // the tail: a long low sine that decays well after the bang
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  o.type = "sine"; o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(22, t + 1.6);
  const g = sfxBus(place, AU.event);
  const gg = audioCtx.createGain();
  gg.gain.setValueAtTime(0.0001, t);
  gg.gain.linearRampToValueAtTime(0.34, t + 0.04);
  gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  o.connect(gg); gg.connect(g);
  o.start(t); o.stop(t + 1.9);
  sfxOneShot(o, [o, gg].concat(g.__sfxChain || [g]));
}

// steam + clank + roar, in that order, which is what a catapult actually is
function catapultSound() {
  noiseBurst(0.55, 2600, 0.16, 0);          // steam
  noiseBurst(0.5, 1800, 0.10, 0.06);
  synthBlip("square", 220, 90, 0.09, 0.20, 0.16);   // the clank of the shuttle
  synthBlip("sawtooth", 90, 150, 0.9, 0.26, 0.18);  // the roar as it goes
  noiseBurst(0.8, 320, 0.20, 0.2);
}

// a crackle bed for the fire, and a hiss when water lands on it
function fireHiss() {
  noiseBurst(1.1, 2200, 0.20, 0);
  noiseBurst(0.8, 900, 0.13, 0.05);
  synthBlip("sine", 320, 120, 0.5, 0.07, 0.05);
}
