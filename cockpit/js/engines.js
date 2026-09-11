"use strict";
// ---------------------------------------------------------------------------
// WORKING RULES -- THE ENGINE VOICE.
//
// Every engine in the game is TWO LOOPS crossfaded by how hard he is working
// it: an idle loop and a high loop. That is the whole model, and it is the model
// whether the loops are sampled recordings or the placeholders this file
// synthesises today.
//
// WHY IT IS BUILT BEFORE THE RECORDINGS EXIST. The clips are CC0 files that will
// live in `cockpit/audio/engines/<key>-idle.*` and `-high.*`. Everything around
// them -- the crossfade curve, the pitch travel, the per-view filtering, the
// idle wobble, the doppler bend, the gain staging -- is the part that takes
// tuning against the kid, and none of it depends on where the loops came from.
// So the graph is real now, driven by synthesised loops built to the same shape,
// and a clip arriving is one fetch and nothing else. `engLoaded()` says which
// keys are running on real audio, and a harness check asserts the two sound
// paths are the same path.
//
// WHAT IS NOT HERE. The rocket keeps its own synthesised bass
// (`setRocketEngine`) -- a Merlin is not a two-loop crossfade and never was --
// and the ambient beds are untouched. This replaces the single sawtooth
// oscillator that every other vehicle shared.
//
// GAIN STAGING. `TUNE.audio.engines.master` is deliberately well under what the
// old oscillator ran at: an engine is the floor the events happen over, not a
// thing competing with them. Cockpit view is quieter still and low-passed --
// he is inside -- with the wind and tyre layer up to compensate; chase is open
// and fuller.
// ---------------------------------------------------------------------------

const ENG = TUNE.audio.engines;
const engBus = { ready: false, voices: {}, cur: null, loaded: {}, ctxRate: 0, duck: 1 };

// Something louder than the engine is happening: stand down under it. The siren
// uses this. An engine is the floor, and the floor gets out of the way.
function engDuck(x) { engBus.duck = clamp(x, 0, 1); }

// ---- the placeholder loops ------------------------------------------------
// A loop, not a tone: one second of a harmonic stack with a little noise and a
// slow amplitude wander, rendered into a buffer whose ends match so it can run
// for ever without a seam. Exactly what a real clip has to be, which is the
// point -- the graph downstream cannot tell them apart.
function engSynthLoop(ctx, spec, secs) {
  const rate = ctx.sampleRate, len = Math.round(rate * secs);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  // Every partial gets a whole number of cycles in the buffer, so the loop point
  // is seamless by construction rather than by crossfade.
  const base = spec.hz;
  const cycles = Math.max(1, Math.round(base * secs));
  const f0 = cycles / secs;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate, ph = 2 * Math.PI * f0 * t;
    let v = 0;
    for (let h = 0; h < spec.harm.length; h++) v += spec.harm[h] * Math.sin(ph * (h + 1));
    // breath: a band of noise shaped by the same envelope, so it moves with the
    // note instead of sitting behind it as hiss
    v += (Math.random() * 2 - 1) * spec.noise;
    // one whole slow wander per buffer: seamless for the same reason
    v *= 1 + spec.wander * Math.sin(2 * Math.PI * t / secs);
    d[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  return buf;
}

// ---- a voice ---------------------------------------------------------------
function engBuildVoice(key) {
  const ctx = audioCtx;
  const spec = ENG.voices[key];
  if (!ctx || !spec) return null;
  const mk = (layer) => {
    const src = ctx.createBufferSource();
    src.buffer = engSynthLoop(ctx, spec[layer], ENG.loopSeconds);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    src.start(ctx.currentTime + Math.random() * 0.05);   // never phase-locked to each other
    return { src, g, synth: true };
  };
  const idle = mk("idle"), high = mk("high");
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = ENG.chase.lp;
  const out = ctx.createGain();
  out.gain.value = 0;
  idle.g.connect(lp); high.g.connect(lp);
  lp.connect(out); out.connect(masterGain);
  return { key, idle, high, lp, out, level: -1, wob: Math.random() * 6.283, doppler: 0 };
}

// A real clip replaces the placeholder buffer in place: the crossfade, filter
// and gain it feeds are untouched, which is the drop-in this file exists for.
function engSwapBuffer(v, layer, buf) {
  const ctx = audioCtx, L = v[layer];
  if (!ctx || !L) return;
  try { L.src.stop(); } catch (err) {}
  L.src.disconnect();
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  src.playbackRate.value = L.src.playbackRate.value;
  src.connect(L.g);
  src.start();
  L.src = src; L.synth = false;
}

// Which recordings exist, from `audio/engines/index.json`.
//
// A MANIFEST RATHER THAN A PROBE. Asking for a clip that is not there to see
// whether it is there costs a 404 in the console for every voice, every launch
// -- and a console error is a thing the harness rightly refuses to ignore. So
// the manifest is a real file that ships empty, and a voice with no recording
// yet costs one line of JSON and nothing else. Dropping the two files in and
// adding the key is the whole of it.
const engHave = { list: null };
function engLoadManifest() {
  if (engHave.list) return;
  engHave.list = [];
  fetch("audio/engines/index.json")
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      engHave.list = (j && Array.isArray(j.clips)) ? j.clips : [];
      for (const key in engBus.voices) engTryLoad(key);   // anything already built
    })
    .catch(() => {});
}

function engTryLoad(key) {
  if (!engHave.list || engHave.list.indexOf(key) < 0) return;
  if (engBus.loaded[key] !== undefined) return;
  engBus.loaded[key] = false;
  for (const layer of ["idle", "high"]) {
    fetch(`audio/engines/${key}-${layer}.${ENG.ext}`)
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(b => {
        if (!b || !audioCtx) return;
        return audioCtx.decodeAudioData(b).then(buf => {
          const v = engBus.voices[key];
          if (!v) return;
          engSwapBuffer(v, layer, buf);
          engBus.loaded[key] = true;
        });
      })
      .catch(() => {});
  }
}

// Which recording this vehicle runs on. Named for the CLIP, not the card, so
// the two airliners share one and a second airliner costs nothing: the files
// are `audio/engines/<key>-idle` and `-high`.
const ENG_KEY = {
  prop: "prop", fighter: "jet",
  airlinerDelta: "airliner", airlinerEmirates: "airliner",
  helicopter: "heli", car: "car", speedboat: "boat", yacht: "yacht",
};
function engKeyFor() {
  // The rocket's modes are not engines with a throttle curve: the rover, the
  // drone and the astronaut are silent here and the stack keeps its own bass.
  const k = typeof vehKind === "function" ? vehKind() : "plane";
  if (k === "rocket" || k === "rover" || k === "drone" || k === "astro") return null;
  return ENG_KEY[state.vehicleKey] || null;
}

// ---------------------------------------------------------------------------
// The frame. `level` is 0..1-and-a-bit: how hard he is working it. The crossfade
// and the pitch both come off it, and nothing else does.
// ---------------------------------------------------------------------------
function engUpdate(level, dt) {
  if (!audioCtx || audioCtx.state !== "running" || !masterGain) return;
  const key = engKeyFor();
  // silence whatever is not his any more, without tearing it down: switching
  // vehicle is common and rebuilding a graph mid-session clicks
  for (const k in engBus.voices) {
    if (k !== key) engBus.voices[k].out.gain.setTargetAtTime(0, audioCtx.currentTime, 0.12);
  }
  engBus.cur = key;
  if (!key) return;
  if (!engBus.voices[key]) {
    const v = engBuildVoice(key);
    if (!v) return;
    engBus.voices[key] = v;
    engLoadManifest();
    engTryLoad(key);
  }
  const v = engBus.voices[key], spec = ENG.voices[key];
  const t = audioCtx.currentTime;
  const n = clamp(level, 0, 1.2);

  // ---- idle wobble. A held idle that never moves is a drone, and a drone is
  // the thing he stops hearing and then only hears when it goes.
  v.wob += dt * ENG.wobble.rate * (1 + n);
  const wob = 1 + Math.sin(v.wob) * ENG.wobble.depth * (1 - Math.min(1, n * 1.6));

  // ---- the crossfade. Equal-power, so the middle does not dip.
  const x = clamp((n - ENG.xfade[0]) / (ENG.xfade[1] - ENG.xfade[0]), 0, 1);
  const gIdle = Math.cos(x * Math.PI / 2), gHigh = Math.sin(x * Math.PI / 2);
  const view = state.viewChase ? ENG.chase : ENG.cockpit;
  const master = ENG.master * spec.gain * view.gain * engBus.duck;
  const wantIdle = gIdle * master * wob, wantHigh = gHigh * master;
  const wantOut = n <= 0.015 ? 0.0002 : 1;
  v.idle.g.gain.setTargetAtTime(wantIdle, t, 0.10);
  v.high.g.gain.setTargetAtTime(wantHigh, t, 0.10);
  v.out.gain.setTargetAtTime(wantOut, t, 0.15);

  // ---- pitch. Modest on purpose: a loop dragged two octaves stops being an
  // engine and starts being a siren.
  const bend = 1 + v.doppler * ENG.doppler;
  const rate = lerp(ENG.pitch[0], ENG.pitch[1], Math.min(1, n)) * bend;
  v.idle.src.playbackRate.setTargetAtTime(rate * wob, t, 0.12);
  v.high.src.playbackRate.setTargetAtTime(rate, t, 0.12);
  const wantLp = lerp(view.lp * 0.75, view.lp, Math.min(1, n));
  if (v.doppler !== 0) v.doppler *= Math.max(0, 1 - dt * 2.2);

  // ---- the view. Inside is muffled and quieter with the wind and tyres up;
  // outside is open. The same voice, filtered, not a second one.
  v.lp.frequency.setTargetAtTime(wantLp, t, 0.2);

  // What the model just DECIDED, beside what the graph is currently at. Every
  // parameter above is a `setTargetAtTime` ramp on the audio clock, and the
  // harness runs twelve seconds of game in a sixth of a real one -- so the live
  // values are always mid-ramp there and say nothing about the model. These are
  // the numbers the checks read.
  v.want = { idle: wantIdle, high: wantHigh, out: wantOut, rate, lp: wantLp, x };
}

// A hint, not a simulation: a short bend when something surges. The afterburner
// and the speedboat are the two that have somewhere to surge from.
function engSurge(amount) {
  const v = engBus.voices[engBus.cur];
  if (v) v.doppler = clamp(amount, -1, 1);
}

function engLoaded(key) { return key === undefined ? { ...engBus.loaded } : !!engBus.loaded[key]; }
function engVoiceKeys() { return Object.keys(ENG.voices); }
// What the harness reads: the live graph, whichever kind of loop is in it.
function engState() {
  const v = engBus.voices[engBus.cur];
  if (!v) return { key: engBus.cur, up: false };
  const w = v.want || {};
  return {
    key: v.key, up: true,
    // the model's decisions
    idle: +(w.idle || 0).toFixed(6), high: +(w.high || 0).toFixed(6),
    rate: +(w.rate || 1).toFixed(4), lp: Math.round(w.lp || 0),
    out: +(w.out || 0).toFixed(4), x: +(w.x || 0).toFixed(3),
    // and where the graph has actually got to
    liveIdle: +v.idle.g.gain.value.toFixed(6), liveHigh: +v.high.g.gain.value.toFixed(6),
    sampled: !v.idle.synth && !v.high.synth,
  };
}
