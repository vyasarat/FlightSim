"use strict";
const TUNE = {
  fov: 72,
  maxPixelRatio: 1.5,
  cruiseSpeed: 60,

  pitchLimitDeg: 30,
  bankLimitDeg: 45,
  dragRangeX: 0.42,
  dragRangeY: 0.38,
  controlResponse: 4.0,
  autoLevelResponse: 1.6,


  terrainClearance: 8,

  hillAmplitude: 18,
  hillWavelength: 350,
  midAmplitude: 6,
  midWavelength: 120,
  microAmplitude: 1.5,
  microWavelength: 40,

  chunkSize: 320,
  chunkSegments: 24,
  chunkRadius: 5,

  fogNear: 950,                  // art sprint: the city 1.2 km off reads through it
  fogFar: 1560,                  // the terrain edge is >= 1600 m out (chunkRadius 5 x 320)
  skyTopColor: 0x4a90d9,
  skyHorizonColor: 0xcfe8f7,
  skyCurveExponent: 0.55,

  sunIntensity: 0.75,
  hemiIntensity: 0.85,
  hemiSkyColor: 0xbfd9ff,
  hemiGroundColor: 0x6f8f57,

  // ---- Lighting (js/scene.js). One directional sun at a real angle with a tight
  // shadow box that follows him, plus a hemisphere fill so shaded sides are never
  // black. Readability first: nothing here may make a thing he needs darker.
  light: {
    // ACES filmic on the LIT surfaces only (scene.js). Unlit things -- lamps,
    // reticles, pad rings, signal heads, fire, glows -- are never tone-mapped, and
    // neither is the sky, because three.js fogs AFTER the tone map and the fog
    // has to meet the sky it fades into.
    // OFF: this palette is authored in display space (no linear workflow), so the
    // film curve bleaches it -- the sea goes grey-teal, the red plane salmon
    // (evidence/art/exposure-sheet.jpg, art sprint). Doing it properly means
    // converting every colour to linear and relighting; that is not a switch.
    toneMap: { on: false, exposure: 1.0 },
    sunAzimDeg: 133,                   // a real angle: shadows fall across the runway, not down it
                                       // (the elevation is passed in to sunDirection, not read from here)
    shadow: {
      on: true,
      mapSize: 1024,                   // sized for an iPad, not a desktop
      // Half-width of the box that follows him. One size cannot do both jobs: at
      // 165 m a 3 m rover is eleven texels across and its shadow comes out as a
      // staircase, and at 25 m an airliner has no shadow at all. So the box
      // resizes to the scale of whatever he is actually in. Cheaper than cascades
      // and there is only ever one thing to look at.
      radius: 165,                     // flying
      radiusMid: 70,                   // on the ground at home, or in the helicopter
      radiusClose: 45,                 // out in the rover, the drone or the suit
      radiusRate: 2.5,                 // how fast it resizes (per second) so it never pops
      depth: 1200,                     // how far back the light stands
      bias: -0.0004, normalBiasTexels: 2.6,   // in texels, not metres: the box resizes, so a fixed bias
                                       // either stripes the ground or lifts the shadow clean off it
      softRadius: 2.0,                 // PCF blur width: soft edges without a blur pass
    },
    // Per-environment moods. `sunI` / `hemiI` are absolute; the weather moods in
    // SKY_MOODS still multiply on top of these.
    earth: { sun: 0xfff1d4, sunI: 1.02, sky: 0xbfd9ff, ground: 0x6f8f57, hemiI: 0.50, shadow: 1, elev: 44 },
    mars:  { sun: 0xffe9d8, sunI: 1.00, sky: 0xffeee2, ground: 0xd49a78, hemiI: 0.84, shadow: 1, elev: 38 },
    moon:  { sun: 0xf2f4f7, sunI: 1.30, sky: 0xa8b2c6, ground: 0x646b7d, hemiI: 0.22, shadow: 1, elev: 34 },
    space: { sun: 0xf2f4f7, sunI: 1.05, sky: 0x0b1024, ground: 0x04050d, hemiI: 0.12, shadow: 0, elev: 44 },
    blend: 2.2,                        // how fast a mood crossfades (per second)
  },

  // ---- Camera and feel (js/vehicle.js). None of this touches the flight model:
  // it is all how the picture moves, never where the aeroplane is.
  camera: {
    fovSpeed: 5.5,               // degrees added between a hover and cruise. Readability caps
                                 // this: every degree wider makes the thing he is aiming at smaller,
                                 // and the brief's own second law says he has to be able to see it.
    fovRate: 2.2,                // how fast the field of view eases
    fovPunchMax: 9,              // a catapult or a lift-off punch, on top
    punchDecay: 2.6,
    bobRate: 0.9, bobAmp: 0.45,  // a slow breath on the chase camera, faster when quick
    leanBank: 0.35,              // how much of his bank the camera leans (unchanged)
    // Shake: a curve, not a ramp, and capped so a bang can never hide the thing
    // he is aiming at. `gamma` above 1 makes it fall away fast and then linger.
    shakeDecay: 2.4, shakeGamma: 1.7, shakeCap: 0.62,
    shakeChase: [9, 7, 9], shakeCockpit: [11, 9, 11],
    hitStop: 0.05,               // seconds the MODEL freezes on a solid hit (the world does not)
    nod: 5.5, nodDecay: 4.0,     // the camera dips when he puts it down
    settle: 0.55, settleRate: 9, // ... and the aeroplane settles on its gear
    lines: { from: 0.55, gain: 0.5, alt: 0.35 },   // speed streaks: only fast, only in the cockpit
  },

  // ---- Sound (js/audio.js). One master and a gain per layer, so anything can be
  // pulled down without touching the mix around it. Nothing here is harsh: every
  // bed is filtered noise or a low tone, and the compressor still catches peaks.
  audio: {
    master: 0.6,
    rocket: 1.0, event: 1.0, bed: 1.0,
    // The ambient bed, one per place he can be. `cut` is the lowpass corner in
    // Hz -- low is a rumble, high is a hiss.
    beds: {
      ground:   { gain: 0.030, cut:  380, thumpRate: 0,   thump: 0 },
      car:      { gain: 0.055, cut:  900, thumpRate: 0,   thump: 0 },    // tyres and wind, not an engine
      sea:      { gain: 0.075, cut:  620, thumpRate: 0.34, thump: 0.45 }, // the harbour: a wash with a slow swell in it
      wind:     { gain: 0.085, cut: 1400, thumpRate: 0,   thump: 0 },   // aloft, and it grows with speed
      heli:     { gain: 0.115, cut:  520, thumpRate: 12,  thump: 0.55 }, // rotor wash: a beat, not a drone
      airliner: { gain: 0.070, cut:  240, thumpRate: 0,   thump: 0 },    // cabin hum
      space:    { gain: 0.016, cut:  120, thumpRate: 0.28, thump: 0.8 }, // near silence, breathing
      mars:     { gain: 0.055, cut:  700, thumpRate: 0.5, thump: 0.35 }, // thin dust wind
      moon:     { gain: 0.006, cut:  100, thumpRate: 0,   thump: 0 },    // no air: almost nothing
    },
    bedBlend: 1.4,               // how fast one bed crossfades into another
    bedInside: 1.45,             // the bed comes up in the cockpit, where the engine goes down
    windFromSpeed: 0.55,         // how much of the wind bed comes from airspeed
    windFromAlt: [60, 900],      // ... and how much from being high up
    // Positional sound: how far away before it is inaudible, and how wide the pan
    falloff: 900, panWidth: 260,

    // ---- THE ENGINE VOICE (js/engines.js). Two loops per vehicle -- idle and
    // high -- crossfaded by how hard he is working it. The loops are synthesised
    // placeholders today and CC0 recordings when they land; everything here
    // describes the graph around them and does not change when they do.
    //
    // `master` is deliberately well under what the old single oscillator ran at.
    // An engine is the floor the events happen over, not a thing competing with
    // them: the horn, the horns of ships, the fireworks and the bells all have to
    // come through it without being turned up to.
    engines: {
      master: 0.055,
      ext: "m4a",                  // what the recordings will be
      loopSeconds: 1.0,            // placeholder loop length; a real clip sets its own
      xfade: [0.18, 0.82],         // where idle hands over to high, equal-power between
      pitch: [0.88, 1.16],         // playbackRate travel -- modest, or it is a siren
      wobble: { rate: 0.8, depth: 0.07 },   // so a held idle is never a flat drone
      doppler: 0.05,               // the bend an afterburner or a boat surge puts in
      cockpit: { lp: 1100, gain: 0.62 },    // inside: muffled and quieter
      chase:   { lp: 5400, gain: 1.0 },     // outside: open
      // Per vehicle: the level of its recording, and the timbre the placeholder
      // is built from until that arrives. `hz` is the loop's fundamental, `harm`
      // its partials, `noise` its breath, `wander` its slow amplitude drift.
      voices: {
        prop:     { gain: 1.00, idle: { hz:  58, harm: [1, .55, .30, .14], noise: .05, wander: .10 },
                                high: { hz: 104, harm: [1, .62, .38, .22, .12], noise: .07, wander: .06 } },
        jet:      { gain: 0.90, idle: { hz:  72, harm: [1, .30, .50, .22], noise: .22, wander: .08 },
                                high: { hz: 138, harm: [1, .40, .60, .36, .20], noise: .34, wander: .05 } },
        airliner: { gain: 0.85, idle: { hz:  46, harm: [1, .42, .18, .09], noise: .18, wander: .09 },
                                high: { hz:  88, harm: [1, .50, .26, .14], noise: .28, wander: .05 } },
        heli:     { gain: 0.95, idle: { hz:  40, harm: [1, .70, .34, .16], noise: .10, wander: .14 },
                                high: { hz:  76, harm: [1, .78, .44, .26, .12], noise: .14, wander: .08 } },
        car:      { gain: 0.70, idle: { hz:  64, harm: [1, .22, .10], noise: .04, wander: .08 },
                                high: { hz: 150, harm: [1, .30, .16, .08], noise: .06, wander: .04 } },
        boat:     { gain: 0.90, idle: { hz:  52, harm: [1, .46, .24, .11], noise: .08, wander: .12 },
                                high: { hz: 118, harm: [1, .54, .30, .18], noise: .12, wander: .06 } },
        yacht:    { gain: 0.80, idle: { hz:  28, harm: [1, .60, .30, .15], noise: .06, wander: .16 },
                                high: { hz:  52, harm: [1, .66, .36, .20], noise: .09, wander: .09 } },
      },
    },
  },

  // ---- Traffic signals (js/lights.js) -------------------------------------
  // Junctions on the SURFACE ROADS, never on the open motorway: the seven exit
  // spurs are the roads the car can actually leave the highway onto, and each
  // of them gets one crossroads with lights, a stop line and a cross street
  // with its own traffic queueing at its own red.
  lights: {
    scan: [0.20, 0.80], scanStep: 0.02,   // the stretch of spur searched for a site
    // ON THE MAIN LINE TOO, roughly this far apart, so a coast-to-coast crossing
    // meets several. Sited by the same measurement rule as the spurs, and never
    // inside an interchange, a bore or a bridge -- a signalled crossroads on a
    // viaduct is not a thing, and a crossroads in a tunnel is less of one.
    // The scan is wide because a third of the route is bridge or bore: a slot
    // that lands on a viaduct steps along until it finds ground.
    highwaySpacing: 1500, highwayScan: 560, highwayStep: 30,
    highwayKeepOut: 420,         // clear of an interchange centre
    boreKeepOut: 300,            // ... and of a tunnel mouth: a signalled crossroads
                                 // seventy metres before a portal puts a head at
                                 // windscreen height across the approach to it
    // The motorway keeps the long green: he should sail through most of them and
    // meet a red now and then, not stop at every one.
    highwayGreen: 23, highwayCross: 6,
    maxDrop: 12,                 // the most the cross street may fall over its length
    crossLen: 260, crossW: 13,   // the cross street, at full length
    crossScales: [1, 0.7, 0.5],  // ... and what it shrinks to rather than not fitting
    // How far before the middle each stop line is -- and it is NOT one number.
    // Each approach has to stop clear of the road it is crossing, so a cross
    // street waiting at a motorway stops `highway.halfW` back and the motorway
    // stops clear of the cross street. One shared 11 m put the cross street's
    // stop line, and the masts that go with it, inside the motorway's outer lane
    // with the heads at windscreen height.
    stopGap: 4.5,
    // The head hangs CLEAR of what drives under it. A 6 m head on an 8.2 m mast
    // put its underside 1.9 m above the road -- below the roof of a 2.6 m car and
    // well below a 4.4 m lorry. The halo is what makes a lamp read at distance,
    // not the size of the box around it, so the head shrinks and the mast grows.
    mastH: 9.8, mastR: 0.32, headW: 2.1, headH: 3.9, lampR: 0.6,
    armLen: 5.2,                 // the head hangs out over the carriageway
    // One cycle. Amber BLINKS before red -- the wind-up every set-piece has, at
    // the scale of a junction, so a red is never the first he knows of it.
    green: 9.5, amber: 3.0, allRed: 1.2, blinkHz: 3.2,
    cars: 10, carSpeed: [11, 16], carGap: 9, queueGap: 7.5,
    range: 900,                  // beyond this a junction sleeps
    glow: 13,                    // the lamp billboard: what makes a lit lamp read at range
    colors: { red: 0xff3b30, amber: 0xffb020, green: 0x36c46a, dark: 0x1a1d22 },
    runSpeed: 8,                 // below this, crossing a red is not running it
  },

  // ---- The police (js/police.js) ------------------------------------------
  // Two cars, and they are MACHINES: the officer never leaves his seat, nothing
  // is ever aimed at anybody, and being caught costs him nothing at all. The
  // whole of it is a chase that ends by itself.
  police: {
    trailAhead: 14, trailWeave: 2.2,   // in a city: how far along his trail they aim, and how wide they weave
    cars: 2,
    spawnBehind: 70, spawnSide: 26,
    speedOver: 1.18,             // how much faster than him they can manage when close
    // AND A CEILING, which is what makes "outrun them" a real thing he can do.
    // The car cruises at 46 and its speed steps scale that to 64 and 85, so at
    // the step he starts on they are always faster and always there, one step up
    // he pulls away, and two he is simply gone. Without a cap the rubber band is
    // unbeatable and the only way out is to wait, which is half a mechanic.
    topSpeed: 58,
    // Close enough to be BESIDE him rather than a pair of dots astern: the lead
    // car draws almost level and the second sits in his mirror.
    hold: [12, 28],
    weave: { amp: 2.6, rate: 0.9 },
    // Reachable, and that matters: at his top speed step he opens about thirty
    // metres a second on them, so this is a dozen seconds of going fast -- the
    // quick way out, against the slow one of simply waiting `maxChase` out.
    giveUpDist: 400,
    // A BACKSTOP, not a mechanic. Outrunning them is the win and being caught is
    // the scene; this only exists so there is no chase he can be stuck in, so it
    // is long enough that he will almost always have ended it himself first.
    maxChase: 180,
    caughtSpeed: 4.5, caughtTime: 1.6,   // stopped this long with them on him
    lightHz: 7.5, sirenHz: [520, 700], sirenRate: 1.35, sirenGain: 0.05,
    duck: 0.55,                  // how far the engine and bed duck under a siren
    crashChance: 0.5,            // per second, when one is near something solid
    resumeIn: 1.2,               // after HIS crash, how long before they are back on him
    pullOver: { angle: 38, gap: 9, count: 3, hold: 1.1, leave: 2.6 },
    // Never the same scheme twice running -- an event pool, policy "once",
    // exactly like the space programme's draw.
    schemes: {
      blackWhite: { body: 0x20242b, panel: 0xf2f4f7, bar: [0xff3b30, 0x3aa0ff] },
      blueWhite:  { body: 0x1c4f9c, panel: 0xf2f4f7, bar: [0xff3b30, 0xf2f4f7] },
      silverBlue: { body: 0xb9c0c9, panel: 0x1c4f9c, bar: [0x3aa0ff, 0xffd23e] },
      cream:      { body: 0xe8e0cc, panel: 0x2f7a3f, bar: [0x36c46a, 0xff3b30] },
    },
  },

  // ---- Ambient life (js/ambient.js). Nothing here is a target, solid, or
  // reachable. The birds live under the same rule as the astronaut: they are
  // fine because nothing can happen to them. Make them hittable and they have to
  // become paper planes, the way the old ones did.
  ambient: {
    birdCount: 42, birdsPerFlock: 7, birdSize: 2.2, birdColor: 0x2f3a48,
    spawn: [260, 700], despawn: 1500, alt: [40, 130], speed: [14, 22],
    spread: 5.5, scareRadius: 220,     // he gets nowhere near before they peel off
    spawnArc: 1.1,                     // radians either side of his nose: he has to be able to SEE them
    // Cruise altitude in this world, not in the real one: at 1600-2300 m they sat
    // 40 degrees above the horizon and were never once in frame. Just above the
    // horizon from his own cruise height is where an airliner actually reads.
    highJets: 3, highAlt: [620, 1000], highSpeed: 150,
    highSpawn: [1400, 3400], highDespawn: 5000,
    trailLength: 900, trailWidth: 7, trailOpacity: 0.30,
    flagRate: 4.2, flagWave: 0.55,
    radarRpm: 5.5,                     // the carrier's and the rig's dishes
    marsDustEvery: 2.4,                // a plume drifts past this often out there
  },

  // ---- Imported bodies (js/models.js). Built by scripts/build_models.js from
  // the raw downloads; `length` is the box the hand-built body occupied, so
  // swapping the model moves nothing else. `yaw` flips a model whose nose came
  // out pointing the wrong way.
  models: {
    car:     { file: "models/car.glb",     length: 9.2,  yaw: Math.PI, lift: 0, smooth: true },   // tail-first; `smooth`: rebuild normals after decimation
    // v146: the Cybertruck. At the Model Y's own scale (its 5.68 m against the Y's
    // 4.75 m), so it is the bigger of the two the way it is on a real road. Not
    // `smooth`: it is faceted by design, and rebuilt normals would round its creases.
    // `cabinLift`: the driving seat's cabin rises with the eye, which is eyeFrac of the
    // body's measured height -- 3.65 m against the Y's 3.18, so 0.72 * 0.47 = 0.34 m.
    cybertruck: { file: "models/cybertruck.glb", length: 11.0, yaw: Math.PI, lift: 0, cabinLift: 0.34 },   // nose-at-+Z in the source
    fighter: { file: "models/fighter.glb", length: 16.0, yaw: Math.PI, lift: 0, burner: true },   // tail-first; `burner`: find the nozzle and light it
    // The two hulls (scripts/build_boats.js). `lift` sits the waterline where
    // the game's waterline is: an imported hull stands on its keel, and the game
    // places every body with its lowest point on the surface, so without a lift
    // the whole boat floats on top of the sea like a bath toy.
    // `yaw`: this hull arrives bow-at-+Z, and the rig's own taper test says so.
    // `lift`: measured, not guessed. A model's lowest point is its PROPELLERS,
    // more than a metre below the keel, so sitting "the bottom" on the waterline
    // left the whole boat standing clear of the sea on its drives.
    // The two airliners. DROP-IN BODIES: the collision box, the spawn origin,
    // gearHeight and the interior camera anchor all come from TUNE.vehicles and
    // are untouched -- only the body drawn in chase view changes. `length` is the
    // real aeroplane's, so the rig fits each into the box the built body had.
    // NO `yaw` ON THESE TWO: `autoOrient` measures it instead. An airliner's
    // bounding box is nearly square -- a 777 is 63.7 m long with a 60.9 m span --
    // so "the long axis is the fuselage" is decided by centimetres and put the
    // 777 sideways across the runway. modelAircraftAxis reads the fin, the wing
    // sweep and the engine pods, and only acts when all three agree.
    // `smooth`: normals are stripped in the build and rebuilt on load.
    // `length` IS THE BOX IT REPLACES, NOT THE REAL AEROPLANE. These are drop-in
    // bodies: the hand-built airliner is 31.5 m long in this world and everything
    // around it -- the chase camera distance, the collision box, the interior
    // anchor -- is tuned to that. Fitted to the real A350's 66.8 m the model was
    // more than twice the size of the body it replaced, and the chase camera,
    // which sits 30 x vp.size behind, ended up inside its own tail.
    airlinerDelta:    { file: "models/airliner-delta.glb",    length: 31.5, autoOrient: true, lift: 0, smooth: true, gearFromWheels: true },
    airlinerEmirates: { file: "models/airliner-emirates.glb", length: 31.5, autoOrient: true, lift: 0, smooth: true, gearFromWheels: true },
    speedboat: { file: "models/speedboat.glb", length: 9.6,  yaw: Math.PI, lift: -0.67, smooth: true },
    yacht:     { file: "models/yacht.glb",     length: 52.0, yaw: Math.PI, lift: -3.5, smooth: true },
  },

  // ---- The afterburner (js/models.js). The fighter's nozzle is found by
  // geometry -- the rearmost point on the model's own centreline -- and this is
  // what gets built on it. Everything is additive and there is no bloom: the
  // brightness has to come from the layers themselves.
  //
  // `idle` is why it is never fully out. A jet sitting on the deck with a cold
  // black hole where its engine should be reads as broken rather than parked.
  burner: {
    // How close to the centreline a vertex must be to count as the engine. This
    // has to be TIGHT. At 0.22 it admitted the horizontal stabilators, which
    // reach 1.6 m further aft than the nozzle does, and the burner came out
    // glowing on the tailplane root instead of the exhaust. Nothing on this
    // model's true centreline goes past the nozzle, so the narrow window is
    // what makes the test mean anything.
    axisFrac: 0.075,
    // The mouth is measured from a THIN ring right at the back. Taking a deeper
    // slice measured the rear fuselage instead of the exhaust and came back with
    // a nozzle three times its real size.
    lipFrac: 0.008,             // how far ahead of the rearmost point the ring reaches
    mouthFrac: 0.06,            // and how far off-axis it may spread
    color: 0xffb43a, coreColor: 0xbfe8ff, diamondColor: 0xf2f4f7,
    // Nested cones, widest and faintest on the outside. Radii and lengths are
    // multiples of the measured nozzle, so this works on any nozzle it finds.
    layers: [
      { r: 1.25, len: 7.6, opacity: 0.20, color: 0xff7a1a },
      { r: 0.92, len: 5.2, opacity: 0.30, color: 0xffb43a },
      { r: 0.62, len: 3.2, opacity: 0.42, color: 0xffd23e },
    ],
    coreR: 0.44, coreLen: 1.9, coreOpacity: 0.85,
    diamonds: 3, diamondR: 0.26, diamondOpacity: 0.40,
    glow: 4.2, glowOpacity: 0.75,
    idle: 0.30,                 // the floor it never drops below in the air
    response: 4.5,              // how fast it spools up and down
    flicker: 0.16,
  },

  // ---- The highway (js/highway.js). One continuous divided road from the New
  // York airport to the California airport, built from a spline through control
  // points chosen so it passes the things he already knows: out over the harbour
  // on a bridge, past the mid-route city, along the lake shore, across the
  // plains beside the freight train, through the mountains in a tunnel, over the
  // canyon on a long bridge, down the desert and into the coast city.
  //
  // Bridges and tunnels are NOT authored. The height profile is smoothed the way
  // a real road is graded, and wherever the graded road ends up well above the
  // ground it becomes a bridge on piers, and wherever the ground ends up well
  // above the road it becomes a tunnel. Move a control point and the structures
  // follow.
  highway: {
    // [z, x], New York (+z) to California (-z)
    // Every one of these was checked against the solids already in the world:
    // the first draft ran straight through the farm silo, the plains silo and
    // the New York apron furniture. The harness now asserts the clearance.
    // v129: and both ENDS ran over an airport -- New York's first 500 m along
    // its taxiway and apron, California's along its apron's edge
    // (roadCrossings, streets.js). They now pass outside the terminal side.
    route: [
      [6200, 330], [5900, 328], [5500, 322], [5100, 285], [4200, 380], [3300, 150], [2400, 250],
      [1800, 330], [900, 360], [0, 300], [-1080, 250], [-1500, 240], [-2400, 200],
      [-3330, 120], [-3800, 60], [-4520, -170], [-4920, -250], [-5400, -330], [-6200, -330],
    ],
    step: 40,                    // metres between centreline samples
    laneW: 7.5, lanes: 2,        // two lanes each way
    medianW: 6, shoulder: 2.5,
    grade: 26,                   // samples in the height-smoothing window
    maxSlope: 0.045,             // 4.5%%: steep enough to feel like a road, shallow
                                 // enough to cut through the mountain instead of climbing it
    clearance: 2.5,              // road sits this far above the ground it follows
    deckMin: 11,                 // and this far above the water on a bridge
    bridgeAt: 6, tunnelAt: 9,    // height differences that make a bridge or a tunnel
    pierEvery: 3, pierW: 5,
    railH: 1.2, railT: 0.5,
    // TWIN BORES, one per carriageway. A single tube wide enough for a divided
    // highway is 52 m across and its crown stands 37 m over the road -- taller
    // than the mountain it is supposed to be inside, so it came out of the
    // hillside like a pipe. Two 12 m bores need 17 m of cover and fit under
    // nearly the whole run.
    // 10.5 clears a 17.5 m carriageway with the pair standing 1.25 m apart, so
    // the headwall has a real centre pier between the two arches.
    tunnelR: 10.5, tunnelSeg: 2,
    // The bore is cut out of the heightfield and a lid laid back over the cut.
    // `boreCut` clears the tube, `boreBlend` is how far the cut feathers back
    // into the hillside, and the lid overhangs the feather by `boreLidOver` so
    // there is no seam where its triangles meet the terrain chunk's.
    // The cut is FULL DEPTH to `boreCut` and only then feathers. The lining is
    // opaque, so anything outside it is invisible from in there -- but a terrain
    // triangle can only be outside it if BOTH its ends are, and the terrain mesh
    // has a 13 m vertex spacing. So the full-depth part has to reach a good cell
    // past the outside of the bores (23.75 m) or a single triangle spans the
    // lining and slices through it, which is what put wedges of hillside inside
    // the tunnel.
    boreCut: 38, boreBlend: 58, boreLidOver: 16, boreLidLift: 0.3, boreLidStep: 9,
    portalW: 9, portalT: 5, portalRise: 11, portalLamps: 4,
    boreLampEvery: 3,            // crown lamps, every N centreline samples
    // Exits: s is 0..1 along the road. `icon` picks the board silhouette.
    exits: [
      { s: 0.10, side: 1, icon: "plane", to: "nyAirport" },
      { s: 0.22, side: -1, icon: "tower", to: "demolition" },
      { s: 0.38, side: 1, icon: "wave", to: "lake" },
      { s: 0.55, side: -1, icon: "tower", to: "midPlains", charge: true },
      { s: 0.72, side: 1, icon: "wave", to: "desert", charge: true },
      { s: 0.90, side: -1, icon: "plane", to: "caAirport" },
    ],
    // Nothing streamed -- tree, town building or landmark -- stands within
    // `clearHalf` of any carriageway, spur or ramp. The road half-width is about
    // 24 m, so this leaves a verge you can see across rather than a hedge.
    clearHalf: 72,
    clearCell: 128,              // the corridor index's bucket size
    clearMaxExtra: 200,          // the widest extra clearance any caller may ask for
    // the motorway's two ends are turnarounds (car.js): the speed comes off over
    // `zone` metres, and `turnAt` from the end lane-keep takes him round on to
    // the other carriageway, aiming `back` metres behind him
    endTurn: { zone: 260, turnAt: 30, speed: 7, brake: 14, back: 40 },
    spurLen: 320, spurW: 16, spurCapture: 3.2,   // spur capture radius, in road widths
    spurDescend: 0.55,           // fraction of the spur spent coming down from the deck to
                                 // the ground. Without it the blend is smoothstep(0, undefined)
                                 // and every road vertex becomes NaN.
    boardH: 16, boardW: 22,
    charge: { stalls: 4, canopyW: 34, canopyD: 22, canopyH: 9, pulse: 2.2, seconds: 10 },
    interchange: { at: [0.16, 0.78], ramps: 4, r: 150, rise: 26, deckT: 2.2, pillarR: 3.4, clear: 9 },
                                 // `clear`: a ramp never comes down to road level.
                                 // Its loop is centred ON the carriageway, so ends
                                 // at deck height laid a 14 m concrete strip and a
                                 // 1.2 m guardrail straight across the lane.
                                 // NOT 0.045/0.955. The road starts beside the
                                 // runway, so four and a half percent along it is
                                 // still inside the runway's own length -- and a
                                 // 150 m ramp loop centred there put concrete
                                 // pillars up to fifteen metres tall on the
                                 // centreline, with a ramp deck two and a half
                                 // metres over it. These sites clear the runways
                                 // AND the ring corridor beyond each end -- a
                                 // 150 m ramp loop reaches the centreline from a
                                 // long way off, and the approach is as much his
                                 // road as the runway is.
    traffic: { count: 70, range: 1800, keepOut: 260, follow: 90, speed: [49, 64], truckEvery: 4, respawn: 2.5,
               // the car AHEAD of him in his lane yields: from yieldReach it moves
               // over if it can and speeds up, and by yieldMatch it runs faster than he does
               yieldReach: 160, yieldMatch: 45, laneChange: 1.4,
               // a car closer than keepBack behind him drops back, dropBack m/s per metre short
               keepBack: 25, dropBack: 1.2 },
                                 // above TUNE.car.cruise on purpose: lane-keep with no
                                 // steering must never rear-end its own lane
  },

  // ---- The city streets (js/streets.js): both block cities, driveable.
  city: {
    hashCell: 64,                // the street lookup's bucket
    wideHalf: 10,                // a street this half-wide has two lanes and parking
    laneWide: 3.75, laneNarrow: 3.5,   // lane centres from the centreline: wide / narrow street
    capture: 8,                  // this far past a street's kerb he is still "on" it
    offStreetReach: 45,          // ... and from this far off one (the square) it is still the road that pulls him back
    endSlack: 14,                // ... and this far past its end, while he crosses the junction
    headPenalty: 18,             // metres a road loses for pointing across him
    straightDeg: 30,             // an arm within this of dead ahead is "straight on"
    edgePad: 3,                  // a street is dropped if a solid comes this close to its lanes
    // THE CORNER ASSIST, speed-only (see streets.js and CLAUDE.md). Weaken it as
    // he gets better at corners: a smaller dist, a lower brake, a higher speed.
    approach: 150,               // a full steer held this close to a junction (or anywhere in the block
                                 // leading to it) is the turn there; the assist brakes only as it needs to
    approachCos: 0.95,           // he is driving along the street (not pointing off it) inside this of its line (18 deg)
    commitIn: 4,                 // ... and it is committed this far into the junction; short of it, letting go is straight on
    cornerSpeed: 6.5,            // the speed it lets him take the corner at: the car turns on
                                 // an 8 m circle here, inside turnR with room for lag
    lateBrake: 140,              // a turn held too late for cornerBrake: as hard as the corner needs, up to this
    cornerBrake: 60,             // how hard it sheds speed on the approach (m/s^2): from the
                                 // window's edge it can take a corner from up to the 1.4 step
    uturnSpeed: 3.2,             // a turnaround at a dead end
    rejoinSpeed: 8, rejoinCos: 0.8,   // hands-off back on to a street from off it, across its line
    rejoinAlong: 13,             // ... and along it, over the parked cars: under TUNE.car.crashSpeed
    giveBackTime: 2.4, giveBackAccel: 16,   // and how fast it hands the speed back after
    turnR: 11,                   // the fillet a corner is driven on
    forcedMargin: 22,            // hands-off: brake this much earlier than the physics needs
    turnAhead: 6, turnLook: 0.8,   // lane-keep's aim round a corner (along a street it aims as on the motorway)
    pursuitGain: 1.15,           // on a street lane-keep is pure pursuit; a touch over 1 takes up the steer lag
    pathIn: 70, pathOut: 60, exitSlack: 3,
    handoff: 60,                 // within this of the grid a city spur is the planner's
    linkLift: 1.2,               // a link road rides this far above the ground it follows
    signalEvery: [3, 3],         // signals at every third avenue by every third street
    mastOut: 2.2,                // a signal mast stands this far onto the pavement
    zebraGap: 1.0, zebraLen: 3.2, zebraW: 0.6,
    kerbW: 0.45, kerbH: 0.12, kerbStep: 6,
    parkEvery: 9.5, parkedPct: 55, parkOut: 1.7, parkClear: 9, parkedDrawn: 220, parkedRange: 360,
    reassembleReach: 160,
    // A crash comes back on the road he was on, where it happened: only out of a
    // junction's box (the cross street's half-width and this), and never on the
    // motorway end of a city ramp (this far back from the carriageway's centre).
    reassembleClear: 3, reassembleRampEnd: 60,
    levelTol: 5,                 // a raised road more than this above or below him is not his road
    levelCatch: 2.5,             // ... and one he is not on already must be within this to pick him up
    // THE WAYS IN AND OUT (streets.js, stBuildRamps). A ramp is a one-lane road
    // `halfW` each side of its middle; it leaves the kerb over `taperLen`, and a
    // flyover sweeps over the motorway on `sweepR` -- a circle the car follows at
    // the top speed step -- climbing at no more than `grade` to stand `clear`
    // over whatever it crosses (a lorry is 4.5 m).
    ramp: {
      halfW: 10, step: 8, ease: 90, joinClear: 60, taperLen: 90, k: 110, sweepR: 150, sweepOut: 45, farTaper: 140, leaveStraight: 40, outLand: 36, outTaper: 120, runOut: 90, mergeDeg: 20,
      mergeZone: 150,
      spanMax: 260,            // two crossings closer than this are one deck: it does not dip between them
      gradeLimit: 0.09,        // no way in or out is steeper than this anywhere (city_checks.js)          // round a merge two ramps share they CONVERGE: there they meet level, not over each other
      leave: 120, flat: 25, flatJunction: 12, grade: 0.045, gradeMax: 0.065, clear: 7.6, sag: 1.5, deckT: 1.4, parapet: 1.1, pierEvery: 28,
      // the approach: the lane painted from the gantry to where the ramp leaves,
      // and the first stretch of the ramp with it
      laneColor: 0x2b4fb0, paintOn: 160, arrowEvery: 34, arrowLen: 9, arrowW: 3.4, arrowLean: 22,
      // the gantry: across the whole road, `gantryBack` before the ramp leaves
      // the ramp assist (speed-only): the car's own turn rate, a margin under it,
      // and how hard it may slow for a bend ahead
      safeMargin: 0.85, safeBrake: 22,
      holdReach: 30,             // a chosen ramp he is on holds him this far from its middle while he swings over
      chooseEarly: 420,          // a held right this far before the gantry already means that ramp: he sees it from 300 m+
      gantryBack: 170, gantryOut: 5, beamY: 9.5, panelW: 20, panelH: 13, iconScale: 1.7,
      panelColor: 0x1c4f9c, lampColor: 0xfff2c4,
    },
    trailStep: 4, trailMax: 220,
    wake: 700,                   // his distance from a city's edge at which it comes alive
    fountain: { r: 7, jetH: 8, splashCool: 1.6 },
    // New York's bridge: up from the north-east corner, along the deck, round
    // at the far end. California's boulevard: downtown to the coast road.
    bridge: { from: [-76, 4427], halfW: 9, endBack: 30 },
    boulevard: { from: [506, -5542], toZ: -6641, halfW: 10 },
    ny: { manholes: 9, steamEvery: 0.45, steamRange: 260 },
    traffic: {
      count: 64, range: 620, keepOut: 110, speed: [11, 17], accel: 5, brake: 11,
      turnSpeed: 6.5, decide: 45, straightP: 0.6, stopGap: 2.5, lineBack: 0.6, queueGap: 9, bumperStop: 1.4,
      boxR: 12, yieldT: 3.2, resHold: 2.6, respawn: 2.5, parkedBack: 6,
      spawnClear: 26,            // a car is placed at least this far from either end of its street
      // the three promises (streets.js): ahead of him in his lane it outruns him
      // from yieldReach, faster than he is by yieldMatch; behind, it holds his speed
      yieldReach: 150, yieldMatch: 40, yieldAccel: 60, follow: 70,
      shed: 30,                  // how fast a car sheds the speed it only had to outrun him
      behindMargin: 15,          // a car more than this behind him on the ground is not 'ahead of him in his lane'
      chainT: 4.5,               // how many seconds of his road ahead the promises look along
      closeT: 1.6, closeGap: 18, // this close ahead of him it keeps ahead even when he is slow
      claimT: 11,                // how far ahead (in seconds of him) a junction is his to claim
      guardT: 1.2, guardGap: 14, guardLat: 4.5,   // the net: in front of him, this close, this wide
      turnClearT: 4,             // a turning car needs this much longer to clear a junction
    },
  },

  // ---- The car (js/car.js). A stealth-grey electric SUV: the silhouette, the
  // paint, the glass roof and the light bar, and nothing else -- no badge, no
  // wordmark, same rule as the airline liveries.
  car: {
    cruise: 46,                  // set from the road length for a ~4.5 minute crossing
    accel: 11, brake: 16, offRoadMax: 0.45,
    boost: 1.5, boostTime: 2.2,  // drag up: an EV's instant shove
    steerRate: 34,               // degrees per second at full lock, at cruise
    // 5, and not faster. A quicker actuator measured 17 ms to visible yaw instead
    // of 33, which is one frame against two and nothing he can feel -- and it
    // made the hands-off lane-keep overshoot enough to be captured by the lake
    // spur and driven into the lake. Both numbers beat the 100 ms the response
    // needs to hit; only one of them keeps a coast-to-coast crossing clean.
    steerAccel: 5,
    // Lane keep: the whole point. He holds a finger down and the car drives
    // itself coast to coast; steering overrides it, and letting go hands it back.
    // Pure pursuit, not closest-point. A proportional controller on the nearest
    // point lags on every curve, and on this road the lag grew past a lane width
    // and walked him across the median. Aiming at a point a second and a half
    // ahead, on the lane he is nearest, holds the line through anything.
    // THE ASSIST YIELDS ON A TIMER, NOT ON A THRESHOLD. `override: 0.75` meant a
    // light steer was outvoted by the road -- at 30% of stick he asked for 10
    // degrees a second and the car turned the OTHER WAY, and at 50% he lost
    // three quarters of it. That is the "unresponsive, fighting me" feel, and it
    // is not the steering: raw response was already 33 ms and a lane change in
    // under a second. So the moment he steers at all the assist fades out over
    // `yieldIn` and stays out; it only comes back `holdOff` after he lets go.
    laneKeep: { lookAhead: 1.5, minAhead: 30, gain: 3.4, offRoadGain: 1.4,
                yieldIn: 0.15, holdOff: 0.5, fadeBack: 0.45 },
                                 // out in 0.15 s, then held out for 0.5 s after
                                 // he lets go, then back over 0.45 s
    deadzone: 0.06,              // small: past this he has proportional authority at once
    // THE ONE STEERING RULE (car.js): below this fraction of the drag range the
    // stick is not steering at all -- lane-keep holds the lane, straight on --
    // and at or past it it is, and held on an approach it is the turn he takes.
    fullSteer: 0.7,
    liftGrace: 0.4,              // a finger off the glass this briefly has not let go of a turn
    centreBelow: 0.3,            // a turn done is spent until the stick is back under this (or lifted)
    relatchFor: 1.0,             // after a lift under liftGrace, this long to find the drag again: the hold stands
    // The car gets its own drag range, because the aeroplanes' is tuned with him
    // and is not to be touched. Measured against the WIDTH, which is the
    // dimension his thumb actually travels: the shared one is a fraction of
    // min(w,h), and in portrait that is the width, so full lock took 42% of the
    // screen. This is 26% of it, in both orientations.
    dragRangeX: 0.26,
    // A car turns TIGHTER slowly, not looser. The old grip curve halved the rate
    // below 16 m/s, which is backwards for the two places he needs it -- junctions
    // and exits. `rollAt` is the only thing left of it: a stopped car does not
    // steer, because it is not rolling.
    lowSpeedTurn: 1.45, rollAt: 2.5,
    onRoadHalf: 24,              // this far from the centreline still counts as on the road
    mergeLook: 260,              // the last this-many metres of a way on: traffic makes room for him
    laneClear: 16,               // taking a chosen exit, he moves over only with no car within this, alongside
    // Leaving the road must be a slope, not a cliff, and a step in the deck must
    // be taken at once. He drove underground without all three of these.
    shoulderBlend: 26,           // metres of ramp between the deck and the ground
    suspension: 7,               // how fast he settles when the ground falls away
    settleMax: 1.2,              // a drop bigger than this is a step, not a crest
    railAt: 4,                   // a deck this high above the ground has a rail that holds him
    crashSpeed: 18,              // below this a contact is a bump, not a bang
    railReach: 8,                // the guardrail holds him within this of a raised road's edge
    // OFF THE ROAD, the pull-back aims at the nearest road IN FRONT of him (car.js,
    // carRejoinTarget): a city street ahead beats the motorway behind. A road
    // counts as ahead inside `cone` (cosine) of his nose; a point off to the side
    // costs `turnCost` times its distance more; nothing past `reach` counts, and
    // with nothing ahead the nearest road is the answer, as it always was. Within
    // `near` of it the ordinary lane-keep has him. Re-picked every `every`
    // seconds, and a new pick must beat the old by `stick` to replace it.
    rejoin: { cone: 0.5, turnCost: 1.5, reach: 1500, near: 40, every: 0.25, stick: 1.25, sample: 15 },
    // A bang off-road comes back where it happened, this far back from the wall,
    // bounced off it -- the same rule as everything else, not the motorway.
    reassembleBack: 7,
    crashDebounce: 0.9,          // seconds of GAME time between bangs, driven by the frame
    bodyL: 9.2, bodyW: 4.2, bodyH: 2.6,
    camChase: [17, 6.5], camLag: 5,
    // The cartoon on the centre screen: a paper plane flying a figure of eight.
    // A figure of eight closes on itself, so the loop has no seam to jump at.
    screenPlay: { loop: 5.5, trail: 14, trailStep: 0.010, every: 3 },
    // The driver's seat, as fractions of the body's OWN measured height -- the
    // imported body is 3.18 m tall where the built box was 2.6, so anchoring
    // these to a constant put his eye in the headlining and the screen level
    // with it. A real driver's eye is about 0.72 of the roof, the centre screen
    // a little below that.
    eyeFrac: 0.72,
    // The cabin the imported body does not have (js/car.js). Metres above the
    // road and forward of the car's origin, with -Z forward, measured against
    // the real body: it is 3.18 m tall here, so a driver's eye lands at 2.28
    // and the dash shelf just under two.
    cabin: {
      halfWidth: 1.92, dashTop: 1.72, roof: 3.00, floor: 1.02,
      seatX: -0.85,                // he sits this far off centre
      screen: [-0.18, 1.98, -1.90],// centre screen, standing on the dash
      wheelTurn: 2.4,              // the wheel turns further than the road wheels, as a real one does
    },
    wheelR: 0.95,             // fallback only: the imported body measures its own
    wheelLock: 26,            // degrees the front wheels visibly turn at full stick
    tyreGain: 0.05, windGain: 0.06,
    // Speed steps. The top one is a genuine 85 km/h-feeling run and the lane
    // keep still holds it: `laneKeep.lookAhead` is a TIME, so the aim point
    // slides further ahead as he speeds up and the pursuit stays stable. The
    // burst multiplies on top of whichever step he is on, so drag-up is still
    // a shove at every speed.
    speedSteps: [0.55, 0.78, 1.0, 1.4, 1.85],
    // ---- the horn (js/car.js).
    //
    // The car's drag-up is already the burst, so the horn takes the contextual
    // slot the car has never used. Two notes, because a two-tone is what a car
    // says and one note is what a lorry says. Tap plays the pair once; holding
    // sustains the second note for as long as he holds it, which is the whole
    // joy of a horn and the reason it is press-and-hold rather than a toggle.
    horn: {
      // A compact EV, not a bus: two clean tones a major third apart, high, with
      // nothing underneath them. The old pair were sawtooths at 370 and 294 --
      // every harmonic and a fat low fundamental -- on an 80 ms swell.
      hz: [400, 500], bite: 0.16, highpass: 330,
      tap: 0.4, attack: 0.008, release: 0.05,
      gain: 0.13, sustainMax: 4.0, // it cannot be held down forever
      // Who answers, and how far away they can hear it.
      trafficRange: 220, trafficChance: 0.45, trafficDelay: [0.35, 0.9],
      seaRange: 2600,             // the yacht and the cruise ship, from the harbour spur
      seaDelay: 1.1,
      replyCooldown: 2.4,         // one answer per honk, not a chorus
      // Honking on the approach starts the drawbridge's bells and beacons early.
      // It never opens the bridge by itself and never skips the wind-up: it only
      // brings the wind-up forward, so a honk is answered and nothing is skipped.
      bridgeRange: 620,
    },
  },

  // ---- The palette. Every colour in the game snaps to one of these unless it
  // is a livery (airliners keep their own) or a signal lamp. This is not a new
  // scheme -- each one was already the dominant value for its role; the job was
  // pulling 238 near-duplicate literals down onto them, so a dome and the dune
  // behind it are no longer two different greys that were never meant to differ.
  palette: {
    white:    0xf2f4f7, steel:  0xc9ced6, grey:      0x8a93a0, slate: 0x3c4350,
    ink:      0x1f2328, night:  0x2f3a48, concrete:  0x9a9ea6,
    grassMid: 0x67a34e, grassHigh: 0xa8a06b, sand: 0xd9c27e,
    rust:     0xb5522e, warning: 0xffd23e, gold:     0xd4a72c,
    fire:     0xff7a1a, flame:  0xffb43a, red:       0xe0483e,
    green:    0x36c46a, cyan:   0x5ff1ff, blue:      0x2b4fb0, sea: 0x2f74b8,
  },

  // ---- The sea (js/scene.js). One quad, and a scrolling normal map doing all
  // the work: real ripple geometry over 8000 units would cost more than the rest
  // of the polish put together.
  water: {
    color: 0x2f74b8, specular: 0x8fc4e8, shininess: 70,
    bump: 3.2,                  // how steep the generated wave normals are
    repeat: 60,                 // tiles across the 8000-unit quad
    tileWorld: 8000 / 60,       // world size of one tile: the anchor maths needs it
    // Ripple strength has to fall off with height or the sea turns into white
    // static from altitude: every micro-facet catches the sun and the whole lot
    // reads as noise. Near the deck it is water; from a mile up it is a smooth
    // sheet with one broad sun path on it, which is what it looks like.
    normalScale: 0.5, normalFade: [70, 700],
    anisotropy: 4,              // the horizon crawls with moire without it
    driftX: 0.010, driftY: 0.006,
    foamBand: 1.1,              // how far above the waterline the foam colour reaches
    foamColor: 0xf2f4f7,
  },

  // ---- Atmosphere (js/sky.js). Billboards and fog only: a full-screen bloom
  // costs more on an iPad than every glow in the game put together.
  sky: {
    sunDistance: 2400,                 // where the sun billboard is pinned (it reads as infinity)
    sunSize: 0.030, sunColor: 0xfff6e0,
    haloSize: 0.15, haloColor: 0xffd9a0, haloOpacity: 0.46,
    lensSize: 0.34, lensColor: 0xffe6b8, lensOpacity: 0.26,   // cockpit only: from outside there is no lens
    cirrusAlt: 900, cirrusSpan: 9000, cirrusRepeat: 5,
    cirrusOpacity: 0.55, cirrusDrift: 0.004,
    starSize: 2.6, twinkleRate: [0.7, 2.6], twinkleDepth: 0.55,
    // Additive glows. Every one of these is a billboard on the same texture as
    // the sun, so the whole lot is one material family and one upload.
    engineGlowColor: 0xffb43a, engineGlowRocket: 13, engineGlowPlane: 3.2, engineGlowOpacity: 0.8,
    fireGlowColor: 0xff8a2a, fireGlowSize: 85, fireGlowOpacity: 0.62,
    blastGlowColor: 0xffd070, blastGlowScale: 5.5, blastGlowOpacity: 0.85,
    padLightColor: 0xffd23e, padLightSize: 9, padLightOpacity: 0.75,
    // Heat haze off the pad: no post-processing, so it is a wide soft billboard
    // that breathes rather than a real distortion. It reads as air, not as a bug.
    heatColor: 0xffd9a8, heatSize: 34, heatOpacity: 0.18, heatRate: 5.5,
    // Per-environment haze. The Moon has no air, so it gets none at all and its
    // horizon stays knife-sharp; Mars gets a dusty pink one that hides the
    // seam where the sphere falls away.
    fog: {
      mars: { color: 0xd98a5c, near: 260, far: 2100 },
      moon: { color: 0x0a0c14, near: 6000, far: 20000 },
    },
  },


  colorLow: 0x7cbf58,
  colorMid: 0x67a34e,
  colorHigh: 0xa8a06b,
  colorLowHeight: -4,
  colorHighHeight: 10,
  colorJitter: 0.085,   // a little more variation so big flat fields are not one solid colour

  cloudCount: 14,
  cloudAltitudeMin: 120,
  cloudAltitudeMax: 260,
  cloudRespawnAhead: [900, 1500],
  cloudLateralSpread: 800,

  boingVolume: 0.5,

  brakeDecel: 12,
  rotateSpeed: 44,
  rotateStickThreshold: 0.35,
  rotateStickTime: 0.12,
  liftoffPitchDeg: 11,
  liftoffHoldTime: 1.1,
  gearHeight: 3.2,

  runwayLength: 1400,
  runwayWidth: 60,
  flattenMargin: 260,
  apronWidth: 220,           // flat ground beside the runway for the terminal complex
  waterLevel: -3.5,

  approachEngageDist: 1500,
  alignStartDist: 500,
  alignHeadingGain: 1.6,
  alignHeadingMaxRateDeg: 10,
  alignLateralGain: 0.15,
  alignRollMaxBiasDeg: 14,
  approachSpeed: 34,
  autoThrottleResponse: 0.9,
  ringCount: 10,
  ringStartDistance: 1250,
  ringRadius: 26,
  ringPulseRate: 2.2,
  touchdownLatTolMult: 3.5,
  touchdownHeadingTolDeg: 30,
  touchdownClearance: 2.6,
  climbAwayPitchDeg: 14,
  climbAwayTime: 3.0,

  sceneryRebuildDist: 256,
  sceneryRadius: 1450,
  treeCell: 100,
  treeDensity: 0.55,
  treeMaxPerCell: 3,
  treeMaxInstances: 1100,
  townGrid: 700,
  townChance: 0.28,
  townBuildingsMin: 8,
  townBuildingsMax: 18,
  buildingMaxInstances: 160,
  landmarkGrid: 2600,
  landmarkChance: 0.4,

  sandColor: 0xd9c27e,
  treeTrunkColor: 0x7a5230,
  treeCanopyColor: 0x3e8f4a,
  runwaySurfaceColor: 0x565b63,
  runwayPaintColor: 0xf2f4f7,

  hudPitchPixelsPerDeg: 2.2,
  asiMaxSpeed: 80,
  altMaxMeters: 400,

  homeIndicatorDistance: 300,
  homeIndicatorSize: 40,

  // rocket (see js/rocket.js) -- loosely a Falcon 9: booster, fairing, second stage, capsule
  rocketTune: {
    thrust: [26, 18, 18, 12],       // per stage index: booster, stage 2 (fairing on), stage 2 (fairing off), capsule
    fuel: [70, 140],                // seconds of burn for booster and second stage (capsule is unlimited)
    stageAlt: [450, 1100, 2600],    // drop allowed above these altitudes: booster, fairing, second stage
    gravity: 7, gravityFade: 2400,  // Earth pull at the ground, gone above this height
    drag: 0.05, maxSpeed: 280,
    turnRateDeg: 38,
    igniteTime: 1.4,                // hold the throttle this long on the pad before liftoff
    landSpeed: 90,                  // the outer bound: faster than this on contact is always a crash
    // The landing envelope. A landing only counts if he arrives the way a rocket
    // should: nose near vertical (so the engines are down), coming down slowly, not
    // sliding sideways, and over somewhere a rocket lands. Anything else -- nose
    // first, on its side, too fast, or nowhere near a pad -- is a crash, and a crash
    // costs nothing. Widen these to make landing easier, narrow them as he improves.
    landMaxTiltDeg: 25,             // how far the nose may be off vertical
    landMaxVspeed: 22,              // how fast he may be coming down (the assist settles at assistDescent)
    landMaxHspeed: 16,              // ... and how much he may be sliding sideways
    landPadR: 95,                   // the pad counts out to here; likewise the deck and the tower
    landDeckR: 30, landCatchR: 45,
    assistRange: 2.2,               // landing assist engages within this many radii of a body
    assistEarthAgl: 220,            // ... and within this height of the ground at home
    assistDescent: 14,              // the assisted descent speed near the surface
    // The assist may stand him up, but only as fast as this and only if there is room
    // to finish before he arrives. Far out it will turn him the whole way round, so
    // coasting in still works; on short final it can tidy a lean and no more, so a
    // rocket diving at the ground stays diving at the ground -- and crashes.
    assistUprightRateDeg: 45,
    assistMaxTiltDeg: 180,          // it never begins a turn from beyond this (180 = from anywhere)
    skipOut: 220,                   // the go button drops him this far out from a body (or the top of the docking rings)
    altMax: 12000,
    // the capsule's way home (Dragon style): blunt-body drag in the air, plasma while
    // fast, a drogue then the mains (button below chuteAlt, pop by themselves below
    // chuteAutoAlt), a float down, and a refit on the pad a few seconds after touchdown
    capsuleDrag: 0.14,
    reentryAlt: 1900, reentrySpeed: 70,
    chuteAlt: [700, 350], chuteAutoAlt: [450, 170],
    chuteSink: [30, 9], chuteDrift: 9,
    refitDelay: 4,
    deorbitAlt: 2300,               // the deorbit starts here (plasma from reentryAlt down)
    satAlt: 1400,                   // satellite button above this height (as the capsule)
    pad: { dx: 200, dz: 0, mountH: 4 },   // launch complex on the far side of the runway; the rocket stands on the mount
    catch: { dz: -30, armY: 44 },         // the catch tower's arms: where a Super Heavy booster is caught (relative to the pad)
    starship: { thrust: [32, 22], fuel: [70], stageAlt: [450] },   // Super Heavy + Ship: one drop
    moon: { x: 1500, y: 7000, z: -2500, r: 520, g: 2.2 },
    mars: { x: -2600, y: 10800, z: 3200, r: 680, g: 3.0 },
  },

  // Space events (js/events.js). Every rocket launch draws ONE of six and stages it
  // in its phase of flight -- never the same one twice in a row. An event is never
  // required and never blocks: ignored, it just does not happen this flight.
  events: {
    eventChance: 1.0,               // how often a launch draws an event at all (1 = every launch)
    minStandoff: 45,                // events laid out around him assume at least this much
                                    // camera standoff, so the cockpit view frames them too
    race: {                         // ascent: a second rocket climbs alongside
      startAlt: 90,                 // it lights up once he is this high
      // Offsets in the chase camera's terms -- further down the view, off to one
      // side, and higher or lower than him. The height drifts up and down: a rubber
      // band, never a finish line. Keeps it framed however he is pointing.
      far: 55, side: 40, upBase: 10, upSwing: 40, bob: 0.32,
      plume: 2.4,                   // its plume is drawn long so it reads from over there
      stageAlt: 1500,               // its booster separates here (late: the big stack is the show)
      parkAlt: 3200,                // above this it stops burning and parks in orbit, glinting
      debrisLife: 9, debrisSpin: 1.4,
      rumbleFreq: 40, rumbleGain: 0.05, rumbleFar: 900,
    },
    meteors: {                      // orbit: glowing rocks to shoot
      count: 22, interval: 0.5,     // how many, and how often one arrives
      speed: 58, size: 3.2,         // slow enough to aim at, and well inside a missile's reach
      ahead: 190, pass: 80, range: 330,   // where they cross in front of him, and how far out they start
      hitR: 30,                     // generous: a dozen easy hits, not three hard ones
      // pointing, not timing: a missile fired at a rock bends onto it, so he never
      // has to lead a crossing target -- aiming the nose at it is enough
      lockR: 300, lockDot: 0.55, lockRate: 4.5,
      trail: 0.09, whooshDist: 190,
      chunks: 8, chunkSpeed: 24, chunkLife: 3.2, chunkSize: 0.55,
      volume: 0.22,
    },
    comet: {                        // orbit: one enormous comet, tail across the sky
      r: 34, tail: 1100, tailR: 95,
      speed: 62, dist: 820, life: 55,
      coat: 44, coatR: 13,          // the glitter it leaves on the rocket, until recovery
      freq: 52, gain: 0.05, hearDist: 1400,
    },
    impacts: {                      // Moon surface: meteors thump down around the rover
      count: 7, interval: 4.0,
      speed: 90, from: 320,         // they come in from this high above the surface
      near: [14, 42],               // ... and land this close (the Moon's horizon is ~50 m off)
      craterR: 6.5, dust: 14, shake: 0.5,
      popR: 7,                      // drive this close to a glowing crater and it bursts
    },
    escort: {                       // reentry: his fireball is one of many
      count: 16, interval: 0.18,
      spread: 70, ahead: 150, drift: 26, life: 4.0, size: 5.0,
    },
    fireworks: {                    // recovery: a barrage over the landing site
      // The whole barrage must fit inside the shortest wait there is -- an upright
      // landing at home refits after rocketTune.refitDelay -- or the show gets cut
      // off halfway by the fresh stack rolling out.
      count: 14, interval: 0.24, spread: 70, height: 42, puffs: 20, size: 7.0, burst: 22,
    },
  },

  // The helicopter's own model (js/heli.js).
  // Helicopter only: tap-to-travel plus sequential altitude adjustment.
  toyWorld: {
    finish: { rotorIdle: 12, rotorFlight: 34, rotorResponse: 3, rotorOpacity: .045,
      winchResponse: 6, dustHeight: 32, dustOpacity: .24, dustResponse: 4 },
    visibleRange: 2200,
    colors: [0xe0483e, 0xffd23e, 0x36c46a, 0x5ff1ff, 0x2b4fb0],
    playground: {
      x: 330, z: 520, radius: 110, floorRadius: 104, objects: 9,
      cable: 10, cableMax: 64, hookDepth: 3.5, winchSpeed: 36, attachFlash: 1.2, pickupR: 22, pickupHeight: 6, previewR: 55, pickupSpeed: 28,
      dwell: 0.25, releaseDelay: 2, leaveR: 28, recycleAfter: 45,
      gravity: 18, drag: 4, maxSpeed: 22, deliveryR: 23, deliveryTime: 5,
      craneH: 56, craneX: 114, craneZ: -48, craneArmLength: 100, craneArmX: -40, craneHookX: -66, buildPieces: 12, danceTime: 7, buildReveal: 0.7, danceHop: 3, danceSway: 0.12, displayX: 90, displayZ: -72, cranePark: -1.6,
    },
    slide: { x: -4, z: -37, exitX: 48, exitZ: -45, height: 12, radius: 22, width: 22, bend: 0, lip: .42,
      segments: 12, settle: .6, duration: 3.5, exitCooldown: 1.2, demoPeriod: 18, demoHop: 18 },
    greeting: { reach: 50, leave: 90, maxHeight: 115, duration: 4, turnRate: 2, faceDeadzone: 8, lift: 12, sway: 0.5 },
    garden: { count: 3, x: 60, z: 60, dx: 40, dz: -10, radius: 18, height: 20,
      reach: 24, leave: 35, maxHeight: 115, spin: 7, response: 3, glowTime: 3, notes: [440, 550, 660] },
    wash: { x: -135, z: 525, gateW: 48, gateH: 32, length: 56,
      entryR: 34, duration: 8, repeatDelay: 3, bubbles: 56, openOffset: 90,
      // HOW CLOSE HE HAS TO BE FOR THE BUTTON TO EXIST. It had no distance
      // gate at all: the only conditions were "parked and still", which a boat
      // sitting in the harbour lock two kilometres away satisfies exactly. So
      // the car wash offered itself in the middle of a lock, and pressing it
      // would have dragged the boat back to the airport. Every other contextual
      // button in the game is gated on a radius -- the cannon on cannonRadius,
      // the tender garage on its own, the Mars drone on callR -- and this is
      // that radius. Far enough to see the arch and drive to it, nowhere near
      // the coast.
      buttonR: 620 },
    welcome: { duration: 5, clearance: 58, hornRange: 240, replyDelay: 0.45, cooldown: 2.5 },
    trails: { capacity: 1200, life: 36, every: 0.055, size: 8,
      cloudR: 54, cloudY: 105, cloudZ: 380, cloudSide: 120, gap: 210, rainbowR: 76 },
  },

  heli: {
    cruise: 90, approach: 1.1,     // speed eases off with the distance left to run
    hoverAgl: 26,                   // initial takeoff height for a destination tap
    landingBrakeH: 24,              // slow horizontal travel on the last metres of a descent
    arriveDist: 4,                  // stop and clear the destination inside this radius
    // A HELICOPTER CAN NEVER BE STUCK, for the same reason a boat cannot: if it
    // has been going for `stallAfter` seconds and has not got `stallProgress`
    // metres closer, it lets the spot go and hovers where it is. Fifty runs from
    // random coastal and inland points all arrived, so nothing needs this today
    // -- which is exactly when to put it in, because the old report of one
    // hanging over land could never be reproduced and there was no floor under it.
    stallAfter: 14, stallProgress: 12,
    turnRate: 85, turnAccel: 4.0, yawGain: 2.8, bankDeg: 12,
    dragDeadzone: 8, horizontalAccel: 42, horizontalBrake: 64,
    terrainLookahead: 1.2, terrainClearance: 8, cameraBack: 52, cameraHeight: 34,
    cameraLookAhead: 20, cameraGroundLook: 55, cameraRopeLook: 0.4, cameraResponse: 4, cameraAimResponse: 3,
    headingRange: 1400, altitudeLead: 24, // sky touches set a horizontal bearing; altitude buttons lead the height hold
    climb: 16, maxSink: 6, vAccel: 4.0, vGain: 1.2,
    liftKick: 2.0,                  // on the ground, any touch gets it off the deck
    accel: 2.8,                    // desired-velocity smoothing; acceleration/braking capped above
    levelRate: 2.5, noseDeg: 6,
    waterFloor: 5,                  // it hovers this far over the sea and never sets down on it
                                    // (sitting on the water would end the flight and hide the bucket)
    // v139: it lands on anything solid (heliFloorAt). A top up to floorTol over the
    // skids still counts as under them -- one frame's descent, a kerb. Coming down
    // while still faster than landCreep, it looks landLook seconds ahead and holds
    // landHold over whatever stands there, so a descent meets a roof, never a side.
    // Anything in the way it cannot come down on (a sphere landMargin wider than
    // the wall law's, at a look-ahead point) slows it to landCreep instead.
    // A top narrower than floorMinHalf each way (a mast, an antenna) is a wall, not a floor.
    floorMinHalf: 2.5, rotorClear: 6.5, floorTol: 1.0, landCreep: 6, landLook: [0.3, 0.7, 1.2, 1.8], landHold: 2, landMargin: 4,
    pickRange: 3000, pickStep: 30,  // how far it looks for what he touched, and how finely
    // A shallow ray grazes the crest in front of him and dips under the ground for
    // a moment before coming out the other side. Taken at face value that put the
    // target forty metres away when he was pointing at the sea a kilometre off --
    // so he stopped, or landed, on the field instead of setting out over the water.
    // A crossing only counts if the ray STAYS under for this many more steps.
    grazeSteps: 6, grazeMargin: 4,   // ... and only if it comes back out by a real margin:
                                    // meeting a flat sea almost edge-on re-emerges by centimetres,
                                    // and that is a genuine arrival, not a graze
    // Speed steps. It is a POINT-TO-GO vehicle, so the step scales only the
    // cruise cap in `Math.min(cruise, dist * approach)`. The arrival taper is
    // the other half of that expression and is untouched: he still eases into
    // the spot he touched, he simply crosses the map to it faster.
    speedSteps: [0.5, 0.75, 1.0, 1.4, 1.8],
  },
  // ---- The surface buggy (js/rover.js). Its drive numbers used to be two bare
  // literals in the middle of the model; they are here now because the speed
  // steps have to multiply them and a step list beside a number nobody can find
  // is worse than no step list at all.
  // ---- THE GIANT TOY TRACK (js/track.js). A spline of TYPED SECTIONS in a graph
  // of segments: lengthen it by adding sections, never by editing geometry. Each
  // section is laid in the frame the one before it ended in (forward +z, up +y,
  // +x LEFT), so a section's own numbers are all it knows. A fork's two branches
  // start where its stem ends and must END in the same place: the stunt is laid
  // to come back to the safe one's line (sbends that cancel, and the same length
  // along). `approach` is how far before a fork a FULL steer must be held (the
  // city's turn rule, car.js).
  track: {
    site: { x: -560, z: -4130, heading: 90 },   // the tower's foot; heading as the game's (forward = -sin, -cos)
    ds: 0.5,                     // metres between samples
    width: 6.4, wallH: 1.6, wallT: 0.5, deckT: 0.7,   // car-width, walled: the SUV is 4.2 wide
    towerH: 40,
    clipEvery: 14, legEvery: 12, // blue connector clips, blue legs
    ringR: 9,                    // the amber ring over the gap
    liftR: 24, liftTime: 3.5,    // the foot of the lift, and the ride up
    // the way off: an exit lane peeling right off the start deck under a gantry
    // (the motorway's icon), taken like every exit -- a full steer held through
    // the deck. Its road back merges into the carriageway that brought him,
    // `back.lead` metres before the track's own exit mouth, so the two never cross.
    leave: { gantryAt: 7, back: { lead: 210, out: 200, fwd: 150, taper: 0.4 } },
    reassemble: 1.6,             // seconds in pieces
    rattleEvery: 1.4,            // metres per plastic click (it clicks faster the faster he goes)
    physics: {
      g: 9.8,
      motorAccel: 6.5, motorSpeed: 30,   // his finger: the push, and the speed it pushes toward on the flat
      roll: 0.22, drag: 0.0011,          // rolling and air
      boostAccel: 26, boostMax: 46,      // the spinning rollers
      // v140: THE SPEED STEPS work here, the car's own pair (speed.js). A step
      // scales the speed his finger pushes toward; above the middle step it
      // also pushes harder and the rollers throw him faster, up to stepBoostMax
      // times. Below it the rollers ease off only to stepBoostMin: they are what
      // gets him round the loops, and a slow step is not a fall every lap.
      stepBoostMin: 0.85, stepBoostMax: 1.3,
      // Every kicker (and the ski-jump) CAPS his speed at its own `capV` as he climbs it -- a
      // brake in the rollers, speed only -- so the fastest step still lands on
      // the far side, and never flies past the whole landing.
      kickerBrake: 30,
      // A loop PUSHES him round and never pulls: he peels off once what it would
      // have to pull with passes `grip` g. It is an assist, and weakens as he learns.
      grip: 0.18,
    },
    cam: { back: 15, up: 5.5, lag: 5, upLag: 4.5,
           jump: { back: 10, side: 28, up: -1 } },        // off a jump: out to his RIGHT (+side), level with him: him against the sky, the gap under him
    // v140: the sign before every fork that has somewhere to go -- a blue gantry
    // over the stem `ahead` metres before the fork's approach, an arrow each way
    // and the ride that way drawn on it (a loop, a jump, a corkscrew). Big, so
    // he sees the choice coming from far off.
    sign: { ahead: 15, h: 9, panel: 9 },   // the chase rides the track behind him; the seat is the car's own
    net: { start: 5, len: 84, w: 48, drop: 7, farH: 17, flight: 3.6, arc: 48 },
    // v140: a toy car he is closing on, within `yieldR` ahead, OUTRUNS him by
    // `yieldMatch` -- the motorway's promise (fast is his; a held finger never
    // bangs). With the speed steps and a longer course he caught them every lap.
    cars: { count: 3, spacing: 150, speed: 27, hold: 32, touch: 7.5, back: 3, yieldR: 90, yieldMatch: 4 },
    exit: { lead: 130, out: 220, fwd: 90, boardBack: 110 },    // its road: the mouth, the sweep off, the board before it
    props: {
      sofa: { w: 58, d: 24, seat: 7, back: 11, arm: 9 },
      shelf: { w: 66, h: 38, d: 10, gap: 3, clear: 5 },
      lamp: { stemR: 2.2, footR: 10, shadeR: 17, shadeH: 13, over: 18 },
    },
    segments: [
      // the start deck: where the lift leaves him and the net throws him back,
      // and the fork for the way off (a full steer held right, through the deck)
      { id: "deck", from: "tower", fork: { safe: "main0", stunt: "exit", approach: 12 }, sections: [
        { type: "straight", len: 12 },
      ] },
      { id: "exit", from: "deck", leave: true, sections: [            // the exit lane, down beside the tower
        { type: "sbend", len: 24, shift: -10 },
        { type: "spiral", turns: 0.5, radius: 18, rise: -20, dir: -1, bank: 10 },
        { type: "straight", len: 110, climb: -17.5 },
        { type: "straight", len: 16 },
      ] },
      { id: "main0", from: "deck", fork: { safe: "A_safe", stunt: "A_stunt", approach: 42 }, sections: [
        { type: "drop", len: 60, height: 30 },                 // the launch: steep in the middle
        { type: "straight", len: 22 },
        { type: "turn", angle: -180, radius: 38, bank: 32 },   // banked round (- = right)
        { type: "straight", len: 4 },
        { type: "booster", len: 14 },                          // stopped before the loop, it still gets him round
        { type: "loop", radius: 15, offset: 9 },
        { type: "straight", len: 46 },
      ] },
      { id: "A_safe", from: "main0", merge: "main1", sections: [
        { type: "straight", len: 150 },
      ] },
      { id: "A_stunt", from: "main0", merge: "main1", sections: [   // the double corkscrew
        { type: "sbend", len: 35, shift: -14 },
        { type: "corkscrew", len: 80, turns: 2, radius: 6 },
        { type: "sbend", len: 35, shift: 14 },
      ] },
      { id: "main1", from: "A_safe", fork: { safe: "B_safe", stunt: "B_stunt", approach: 36 }, sections: [
        { type: "turn", angle: 180, radius: 36, bank: 30 },    // and round again, the other way: a snake
        { type: "straight", len: 12 },
        { type: "shelf", len: 28 },                            // through the bookshelf
        { type: "straight", len: 12 },
        { type: "booster", len: 28 },
        { type: "straight", len: 40 },
      ] },
      { id: "B_safe", from: "main1", merge: "main2", sections: [
        { type: "straight", len: 210 },
      ] },
      { id: "B_stunt", from: "main1", merge: "main2", sections: [   // the gap jump
        { type: "sbend", len: 35, shift: -14 },
        { type: "kicker", len: 14, rise: 3.2, lipSlope: 0.14, capV: 40 },
        { type: "gap", len: 26, dy: -0.8 },
        { type: "landing", len: 70, fall: 8 },
        { type: "straight", len: 30, climb: 5.6 },
        { type: "sbend", len: 35, shift: 14 },
      ] },
      { id: "main2", from: "B_safe", fork: { safe: "C_safe", stunt: "C_jump", left: "C_loop", approach: 50 }, sections: [
        { type: "straight", len: 12 },
        { type: "hump", len: 90, height: 16 },                 // over the sofa
        { type: "straight", len: 14 },
        { type: "spiral", turns: 1.25, radius: 26, rise: 24, dir: -1, bank: 16 },   // round the lamp
        { type: "straight", len: 10 },
        { type: "booster", len: 22 },
        { type: "straight", len: 130 },                        // a long straight: the sign, then fork C, three ways
      ] },
      // FORK C (v140). Hands-off: straight on. Held left: a loop. Held right: the
      // middle-sized jump. Every branch is 220 m along and comes back on the line.
      { id: "C_safe", from: "main2", merge: "main3", sections: [
        { type: "straight", len: 220 },
      ] },
      { id: "C_loop", from: "main2", merge: "main3", sections: [
        { type: "sbend", len: 40, shift: 16 },
        { type: "straight", len: 70 },
        { type: "booster", len: 16 },
        { type: "loop", radius: 14, offset: 8 },
        { type: "straight", len: 54 },
        { type: "sbend", len: 40, shift: -24 },              // back on the line only at the very end
      ] },
      { id: "C_jump", from: "main2", merge: "main3", sections: [
        { type: "sbend", len: 35, shift: -16 },
        { type: "booster", len: 16 },
        { type: "kicker", len: 16, rise: 4.5, lipSlope: 0.3, capV: 34 },
        { type: "gap", len: 36, dy: -1 },
        { type: "landing", len: 60, fall: 9.5 },
        { type: "straight", len: 22, climb: 6 },
        { type: "sbend", len: 35, shift: 16 },
      ] },
      { id: "main3", from: "C_safe", fork: { safe: "D_safe", stunt: "D_jump", left: "D_loop", approach: 50 }, sections: [
        { type: "drop", len: 46, height: 22 },
        { type: "straight", len: 14 },
        { type: "booster", len: 20 },
        { type: "straight", len: 120 },                        // the sign, then fork D
      ] },
      // FORK D: the big ones. Held left: a tall loop. Held right: the big jump.
      { id: "D_safe", from: "main3", merge: "main4", sections: [
        { type: "straight", len: 300 },
      ] },
      { id: "D_loop", from: "main3", merge: "main4", sections: [
        { type: "sbend", len: 45, shift: 18 },
        { type: "straight", len: 110 },
        { type: "booster", len: 20 },
        { type: "loop", radius: 18, offset: 9 },
        { type: "straight", len: 80 },
        { type: "sbend", len: 45, shift: -27 },
      ] },
      { id: "D_jump", from: "main3", merge: "main4", sections: [
        { type: "sbend", len: 40, shift: -18 },
        { type: "booster", len: 20 },
        { type: "kicker", len: 20, rise: 7, lipSlope: 0.45, capV: 36 },
        { type: "gap", len: 52, dy: -2 },
        { type: "landing", len: 80, fall: 14 },
        { type: "straight", len: 48, climb: 9 },
        { type: "sbend", len: 40, shift: 18 },
      ] },
      { id: "main4", from: "D_safe", sections: [
        { type: "straight", len: 10 },
        { type: "booster", len: 26 },
        { type: "straight", len: 14 },
        { type: "loop", radius: 14, offset: 9 },               // the triple loop
        { type: "straight", len: 6 },
        { type: "loop", radius: 13, offset: 9 },
        { type: "straight", len: 6 },
        { type: "loop", radius: 12, offset: 9 },
        { type: "straight", len: 26 },
        { type: "ski", len: 34, rise: 9, lipSlope: 0.75, capV: 31 },   // and into the net
      ] },
    ],
  },

  // ---- THE ONE WALL LAW (solids.js, collision.js). Every vehicle asks the one
  // registry; these are the only things that differ between them. `r` is the
  // body radius the registry inflates every solid by; `crawl` is the speed at
  // or under which a solid is a SHOVE and over which it is a bang and a free
  // reassembly. The rocket never crawls into anything: its landing envelope
  // (landMax*) says what counts as arriving and everything else is a crash.
  // The car's and the boat's crawls are their old crash speeds, unchanged.
  solid: {
    r:     { plane: 3, heli: 3, rocket: 3, car: 3, cybertruck: 3, boat: 4.5, yacht: 17, rover: 2.2, drone: 1.6, astro: 1, monster: 5.5, sled: 5, crane: 12, dad: 4 },
    crawl: { plane: 12, heli: 12, rocket: -1, car: 18, cybertruck: 18, boat: 20, yacht: 6, rover: 6, drone: 7, astro: 99, monster: 99, sled: 99, crane: 99, dad: -1 },   // the monster never bangs at any speed
    // v147: the parent's jet in dad mode (dadmode.js). Its own rules: anything solid at
    // any speed is a crash that ENDS the mission (crawl -1) -- dad mode is exempt from
    // the free reassembly, and nothing of it exists outside dad mode.
    // v145: the wrecking-ball crane (crane.js) never moves: parked on its lot for good, it
    // is not solid (its contract's solid() is false) and nothing can drive into it. Its
    // radius is its tracks' half-length, and its crawl is "never a bang, at any speed".
    // v144: the rocket sled he rides (sledride.js) is rail-locked and not solid (its contract's solid() is
    // false): nothing can stand on the rail in front of him. Its radius is the sled's half-width, and its
    // crawl is the monster's "never a bang, at any speed". The set-piece's own sidestep (sledClearPath)
    // never reads it while he rides -- he IS that sled.
    reassemble: 1.6,             // seconds a rover or drone stays in pieces
    backOff: 7,                  // metres it comes back from the thing it hit
  },

  rover: {
    cruise: 14, reverse: 6,
    // the toy ramps are SURFACES (solids.js): he drives up them and the lip's
    // slope is the launch -- at cruise about the throw the old trigger gave
    ramp: { len: 7.6, rise: 2.2, w: 6, lipSlope: 0.72 },
    stepUp: 0.8,                 // a ledge higher than this is a wall, not a slope
    speedSteps: [0.6, 0.8, 1.0, 1.5, 2.1],   // it is a buggy on an empty world: let it go
  },

  // ---- set-pieces. Each one is the same loop: a giant obvious thing, one aim or
  // one pulsing button, a visible wind-up, a huge payoff, and a free reset that
  // comes round on its own. Only machines and structures are ever wrecked.
  demolition: {                     // a condemned block, mid-route, with a reticle on one tower
    x: 300, f: 0.46,                // where it stands (f = fraction of half the route, +ve = NY side)
    towers: 7, blockR: 96,
    towerW: 15, towerH: [44, 98],
    reticleR: 20, reticleRate: 2.4,
    beaconRate: 1.6, beaconFast: 8, // hazard beacons: the idle blink, and the wind-up blink
    hitR: 46,                       // a missile landing this near a tower sets it off (generous: he is four)
    charge: 3.0,                    // the wind-up: rumble, fast beacons, 3-2-1
    foldDelay: 0.5, foldTime: 1.6,  // the domino gap, and how long one tower takes to go down
    dust: 16, dustLife: 2.4, dustRise: 5,
    rumble: 0.4, rumbleFreq: 34,
    rebuild: 10, riseTime: 1.8,     // ... and then the whole block stands itself back up
    alarmMuteRadius: 240,           // no crash alarm inside the fence: the numerals are the
                                    // only lead-in there, and he is meant to fly straight at it
  },
  // ---- The launch site (js/launchsite.js): a giant rocket beside the motorway
  // that blasts off when he points at it, and whose two side boosters fly home
  // and land on their own pads. Nothing to press and nothing to miss.
  launchSite: {
    x: 398, z: -450,                // the pad: 125 m east of the motorway, between it and the
                                    // railway -- nearly dead ahead from the driving seat, and
                                    // clear of the spur junction's signal heads
    lz: [[565, -510], [575, -680]], // the boosters' landing pads, over the railway (+z booster -> the first)
    size: 1.3,                      // the rocket and its tower, over a 96 m stack: a skyscraper
    padHalf: 36, padRise: 2.5,      // the plinth, and how far its top stands over the highest ground under it
    lzR: 21,                        // a landing pad's radius
    clearR: 150,                    // no streamed tree or town inside this of the pad
    armR: 1400, coneDeg: 42,        // he is this close AND pointing within this of it: the countdown starts
    innerR: 150,                    // ... and no closer than this (on top of it, it would go off around him)
    count: 5,                       // 5-4-3-2-1
    holdDown: 1.4,                  // engines lit on the pad before it lets go
    accel: 3.4, accelGain: 0.22,    // m/s^2 off the pad, growing this much a second
    pitchStart: 9, pitchRate: 1.1, pitchMax: 32,   // the lean over, east, away from the road (deg, deg/s)
    sepT: 18,                       // the side boosters let go this long after liftoff
    sepPush: 22,                    // m/s, outward: wide enough to see them part from the road
    flipT: 3,                       // seconds for a booster to turn engines-first
    glideT: 13,                     // seconds from separation to the top of the landing burn
    burnH: 150, burnT: 7,           // the landing burn: from this high, this long
    legsT: 3,                       // the legs swing out over the last of it
    coreGone: 75,                   // the core is out of sight by then and stops being drawn
    rest: 7, restack: 4.5,          // landed, then a fresh stack rises out of the pad
    // the show
    roar: 0.28, roarHz: 36,         // the rumble tone at the pad, falling off with distance
    hearR: 3200,                    // beyond this the launch is silent
    shake: 0.42, shakeR: 2200,      // the ignition shake, falling to nothing at shakeR
    climbShake: 0.12, climbShakeT: 6, // a rumble through the first seconds of the climb
    puffs: 180,                     // one instanced pool of cloud for the whole show
    cloudOut: 30, cloudLife: 6,     // ignition cloud: m/s outward along the trench, seconds
    cloudDrift: 9,                  // ... and every puff of it drifts east, away from the road
    trailEvery: 0.12, trailLife: 9, // the smoke column behind the climb
    trailTop: 2600,                 // no trail above this (it is out of the fog by then)
    boomAt: 0.55, boomGap: 0.4,     // the double sonic boom: this far through the boosters' glide, this far apart
    selfLight: 0.35,                // the rocket's paint carries this share of its own colour as light
    glowSee: 900,                   // past this the engine glow grows with distance, so it never shrinks to nothing
  },
  // ---- The rocket sled (js/rocketsled.js): a rocket on a rail in the desert,
  // west of the motorway. Point at it and it blasts off down the rail, smashes
  // through a giant wall of toy bricks, pops its parachutes, and the wall flies
  // back together while the sled rolls home.
  rocketSled: {
    n: [79, -2550], s: [28, -3150], // the rail, north end (the start) to south end: 110 m west of the
                                    // road's centre all the way, so it is in the windscreen
    railY: 10,                      // the rail's top: level, on an embankment over the ground
    bankW: 8,                       // the embankment's width
    wallAt: 400,                    // the wall stands this far down the rail from the start
    wallCols: 7, wallRows: 8,       // giant toy bricks, ...
    wallShift: 2.5,                 // ... the wall standing this many bricks WEST of the rail, away from the road
    brick: [10, 6, 5],              // ... each this big (w, h, d): a wall 75 m wide and 48 m tall
    clearR: 60,                     // no streamed tree or town within this of the rail, the wall or the bricks' field
    armR: 1100, innerR: 100, coneDeg: 42,   // he is this close to the WALL, not closer than innerR, and pointing at it
    carView: 480,                   // ... in the car: the sled outruns him, so it arms when its smash will land
                                    // this far ahead of him at the speed he is going -- inside the windscreen,
                                    // whichever way he is driving and at any speed step
    count: 3,                       // 3-2-1, with the start tower's lights going red-amber-green
    accel: 40, burn: 3,             // m/s^2 for this long: 0 to 120 m/s
    smashKeep: 0.75,                // the share of its speed it keeps through the wall
    chuteDecel: 30,                 // m/s^2 under the parachutes
    rest: 2,                        // stopped, then it rolls home
    homeSpeed: 40,                  // m/s, back up the rail
    rebuildT: 2.6, rebuildStagger: 0.9,   // the bricks fly back: each takes rebuildT, starting over rebuildStagger
    // the bricks in the air
    throwFwd: [26, 52], throwUp: [20, 36], throwSide: 20,  // m/s; sideways is biased WEST, away from the road
    westBias: 0.75,                 // ... this share of the sideways throw always goes west
    eastMax: 0,                     // ... and none of it goes east, towards the road
    brickBounce: 0.35, brickFriction: 3.5, gravity: 22,
    // the show
    roar: 0.26, roarHz: 44, hearR: 2600,
    shake: 0.35, shakeR: 1400,
    puffs: 120, trailEvery: 0.03, trailLife: 3.5,
    selfLight: 0.3,
    size: 2.6,                      // the sled, over a 12 m sled: 31 m of it
    reticleR: 13, reticleRate: 2.4, // the pulsing target on both faces of the wall, as the demolition's
    clearAhead: 80, clearSpeed: 40, // anything sitting still on the rail this far ahead is stepped aside, west, this fast
  },
  // ---- The fireworks barge (js/fireworksbarge.js): a barge of mortar racks on
  // the great lake, just west of the motorway. Point at it and every rack goes.
  fireworksBarge: {
    x: 130, z: 1800,                // on the lake's east water, 7 m deep, inside the target boats' orbit and clear of it
    hullL: 46, hullW: 16, hullH: 3.2, deck: 1.6,   // the hull, and how far its deck stands over the water
    armR: 1300, innerR: 120, coneDeg: 42,   // he is this close, no closer than innerR, and pointing at it
    carView: 1150,                  // in the car it arms by his speed: the first shells burst this far ahead
    count: 3,
    // the show: [seconds after the first launch, shells] -- a build, then the finale
    volleys: [[0, 1], [0.5, 1], [1, 1], [1.8, 3], [2.8, 2], [3.6, 4], [4.8, 3], [5.8, 5], [7, 4], [8.2, 8], [8.8, 8], [9.4, 10]],
    shellSpeed: [62, 72], fuse: [1.9, 2.3],        // up, and how long until it bursts (~105-125 m: in the windscreen)
    drift: 3,                       // m/s every shell leans WEST, away from the road
    burstSpeed: [40, 58], willowSpeed: [24, 33],  // the stars' speed out of a burst
    stars: 110, starLife: [1.6, 2.4], willowLife: [2.8, 3.6],
    starDrag: 1.1, starGravity: 5,
    sparks: 4200,                   // one Points draw for every star and trail spark of the show
    starSize: 11, shellSize: 14,
    flashes: 10, flashSize: 70, flashLife: 0.35, flashOpacity: 0.7,
    shellGravity: 9.8, trailEvery: 0.03, shellsMax: 40,
    drawFog: 1.45,                  // drawn within this many fog-distances
    rest: 3,                        // after the last star, then armed again
    hearR: 3000, boomGain: 0.5, soundsPerSec: 14,  // the finale is many bangs: no more than this many a second
    reticleR: 14, reticleRate: 2.4, reticleY: 34,  // the target over the barge, turning to face him
  },
  // ---- The monster truck (js/monstertruck.js): a loop of dirt west of the
  // motorway on the plains. Point at it and the truck roars off, jumps a ramp,
  // lands on a row of six junk cars and squashes them flat, then drives round
  // the loop home -- and the cars pop back up.
  // v142: THE BOOSTER ROCKET HE FLIES (heavy.js): the launch site's rocket, its
  // two side boosters peeling off by themselves and flown home to the site's
  // pads while the camera watches them.
  heavy: {
    sepAlt: 380,                    // the side boosters let go here: under the core's own first drop (stageAlt[0])
    sepPush: 16,                    // m/s outward as they part
    flipT: 2.5, glideT: 10,         // seconds to turn engines-first, and from separation to the top of the landing burn
    burnH: 110, burnT: 6, legsT: 2.5,   // the landing burn: from this high over the pad, this long; the legs over its end
    boomAt: 0.55,                   // the sonic boom this far through the glide
    watchHold: 2.5,                 // the camera stays on the landed pair this long before it goes back to him
    // the watching camera: no nearer or further than this, this high for its distance, looking from this way
    // (along the line of the two pads, a little from the road's side), a narrow lens, and how fast it swings there
    camNear: 90, camFar: 800, camUp: 0.12, camFrom: [-0.3, 1], camFov: 34, camLag: 4.5, camMargin: 1.35, padsBelow: 260,
  },

  // v144: THE ROCKET SLED HE RIDES (sledride.js): the set-piece's own sled
  // (TUNE.rocketSled), run for him from the start tower by his go. Its rail, its
  // speed, its smash and its chutes are all the set-piece's numbers; these are
  // only his two cameras and the burst, which is a show and never changes the run.
  sledRide: {
    // the seat: on top of the nose, this far ahead of the sled's middle and this high
    // over its rail shoes, looking down the rail a little nose-down; one kick of the
    // field of view as the run starts, and one as the nose goes through the wall --
    // there the bricks fill the screen, and the wider view shows them as a burst
    // (cameraPunch, the catapult's own: once each, never a shake)
    seat: { fwd: 12, up: 10.5, pitch: 4, launchPunch: 1, smashPunch: 1 },
    // the chase: behind and HIGH (v144 render round 1: from 42 m up the middle chute --
    // a 10 m disc 26 m up, 57 m behind the sled -- hung between the camera and the
    // sled). From here the line to the sled's back clears that canopy's top by ~7 m
    // even trailing at speed (the lag is quick so it never trails far), and it looks
    // down over the chutes' fan and the smoke at the red sled, the wall in the picture
    // above it; it looks at a point this far down the rail and this low under it
    // (low enough that a burst's flame stays clear of the dashboard).
    // Once the chutes are out it eases out to the EAST side -- the road's side, away
    // from where the bricks fly -- `side` m across, `sideBack` m behind the sled and
    // `sideUp` m up, looking at a point `sideLookBack` m behind the sled and
    // `sideLookUp` m up: the sled in profile with its canopies streaming behind it,
    // nothing between him and it. It eases back behind as they pack, at `sideRate`.
    chase: { back: 120, up: 90, look: 150, lookUp: -30, lag: 8,
             side: 90, sideBack: 30, sideUp: 35, sideLookBack: 30, sideLookUp: 10, sideRate: 2 },
    // the burst: a drag up past `pitch` during the run -- the flame this much longer
    // and fatter, eased in at `rate`, and a roar of its own. It ends only when the drag
    // falls back under `release`, so a wobbling finger is one burst, one whoosh.
    // (From the seat the flame is behind him: there the burst is its sound.)
    // (its voice: a sawtooth at `hz`, rising by `hzRise` of itself as the flame grows, and a whoosh as it lights)
    burst: { pitch: 0.35, release: 0.2, flame: 1.8, wide: 1.3, rate: 8, roar: 0.22, hz: 66, hzRise: 0.3,
             whoosh: { dur: 0.5, freq: 380, peak: 0.35 } },
  },

  // v145: THE WRECKING-BALL CRANE (crane.js): a giant yellow crawler crane parked on its
  // own lot beside the demolition district, three blocks of empty towers in a fan in
  // front of it. A drag turns it (the crane's own control, approved 2026-10-08), go is
  // a 3-2-1, then the ball swings by itself and the aimed block folds like dominoes,
  // away from the crane, and stands back up. Nothing here is solid or counted.
  crane: {
    // THE LOT. Beside the demolition block (TUNE.demolition), not inside it: everything
    // -- the crane, every tower fallen flat, the ball's arc, every piece -- stays more
    // than blockR + hitR + 60 m from the block's middle, more than clearHalf + clearMaxExtra
    // from every carriageway, spur and ramp, and off every airport's pad, approach and
    // runway line (crane_checks samples all of it). `baseDeg` is the way the tracks face
    // and the middle block's bearing (a heading: forward is (-sin, -cos)).
    // West of the motorway, 470 m from the block's middle, facing west-north-west away
    // from the road: the probe that chose it found every point of the fan (the crane, the
    // rows out to 280 m, 15 m either side) 360+ m from the road's corridor, off the
    // airports, dry, and within 3.3 m of level.
    at: [-200, 2710], baseDeg: 112.5,
    groups: [-50, 0, 50],           // the three blocks' bearings off baseDeg, degrees (turning means something)
    perGroup: 5,                    // towers in each block's domino row
    spacing: 28,                    // middle to middle along the row
    towerW: 12, towerD: 22,         // a slab: this thick along the row, this wide across it
    towerH: [52, 66],               // heights, each its own
    sink: 1,                        // each stands this far into the ground
    restDeg: 62,                    // a fallen tower lies at this, on the next one (over 60 by the check): two
                                    // at the same lean touch at acos(towerW / spacing), 64.6 -- any further is through
                                    // it (62 keeps a metre clear as the last one swings past); crLeanCap holds
                                    // every frame of the fall and the rise to its top on the next one's face
    lastDeg: 86,                    // ... and the last one flat on the ground
    fallT: 2.4,                     // seconds for a tower to go from standing to its rest (accelerating)
    // THE CRANE (metres; its own frame, forward -z). The boom pivots on the upper works
    // at (0, pivotY, -pivotF) and stands at boomDeg; the ball hangs `cable` under its tip.
    pivotY: 7, pivotF: 4, boomLen: 80, boomDeg: 58, boomW: 2.8, cable: 50, ballR: 6,
    // THE SWING, by itself, after go: the 3-2-1 (count), the ball drawn back `backDeg`
    // slowly over `windT`, a held breath (`holdT`), then the swing forward over
    // `swingT`, faster and faster (`swingPow`), to `hitDeg` -- where its face meets the
    // aimed block's first tower (the first tower stands exactly there). After the hit it
    // swings back and settles (`settleT`, `settleHz`).
    // backDeg stays under the boom: the cable hangs 90 - boomDeg = 32 degrees off the boom's
    // line, so drawn back 40 the ball went through it (crane_checks measures the sphere clear).
    count: 3, backDeg: 22, windT: 3.0, holdT: 0.3, swingT: 1.6, swingPow: 1.8, hitDeg: 45,
    settleT: 0.9, settleHz: 0.35,
    riseSettle: 3,                  // ... and while they stand back up, what swing is left dies at this (per second)
    // THE HOIST: after the hit the cable reels in to `hoistCable` (from `hoistDelay` s, over
    // `hoistT`), so from the cab the ball rides up above the falling row instead of standing
    // in front of it; it pays back out over `payT` while they stand up. Never shorter than
    // keeps the ball `boomClear` m off the boom's lattice (crCableMin).
    hoistCable: 16, hoistDelay: 0.3, hoistT: 1.2, payT: 2.6, boomClear: 0.4,
    downT: 2.6,                     // all down: this long, dust settling, before they stand up
    riseT: 2.2, riseGap: 0.22,      // standing back up: each takes riseT, the last first, riseGap apart
    // THE AIM: a drag across `slewDeg` per second at a full drag, nothing under `slewDead`;
    // let go, the magnet eases it on to the nearest block at `magnet` (per second); it
    // turns no further than `slewMarginDeg` past the outer blocks; and once go is pressed
    // it settles on the aimed block at `lockRate` while it counts.
    slewDeg: 34, slewDead: 0.1, magnet: 3, slewMarginDeg: 25, lockRate: 6,
    reticleR: 8, reticleRate: 2.4,  // the pulsing ring on the aimed block, where the ball will hit
    reticlePulse: 0.14,             // ... swelling and shrinking by this much of its size
    // THE PIECES: from the monster truck's debris pool (TUNE.monster.debris, its cap).
    // hitPieces at the ball's hit, landPieces where each tower lands; speeds in m/s.
    hitPieces: 40, landPieces: 14, pieceSpeed: [5, 13], pieceUp: [3, 10], pieceSize: [1.4, 3.4],
    pieceSpread: 5,                 // m/s sideways, at most, for the pieces off the ball's hit
    // ... which are bigger than a landing's and bright, so they read against a grey tower
    // (TUNE.palette: warning, fire, white, sand), from across the ball's face out to hitRim x ballR
    hitPieceSize: [2.4, 4.8], hitColours: [0xffd23e, 0xff7a1a, 0xf2f4f7, 0xd9c27e], hitRim: 1.3,
    dust: 6, dustSize: 4.5, dustRise: 4, dustLife: 3,
    rumble: 0.2, rumbleHz: 46,      // the wind-up's growl (a tone), and the slew's hum
    hum: 0.06, humHz: 70,
    // THE CAMERAS. The seat: a toy's high cab, left of the boom and behind the slew ring,
    // ABOVE the line from the resting ball to the ring (from 10.5 m up the ball stood
    // in front of the ring: crane_checks measures the two discs apart, aiming and
    // counting), `pitch` degrees down and turned `yaw` degrees toward the boom, so the
    // ring sits mid-windscreen with the ball under it and the falling row clear of it.
    // The chase: behind, out to the right and above,
    // looking at a point down the aimed row (`look` m out, `lookUp` m up), easing at `lag`.
    seat: { side: -10, up: 42, fwd: -6, pitch: -4, yaw: -6 },
    chase: { back: 95, side: 70, up: 62, look: 140, lookUp: 26, lag: 3 },
    selfLight: 0.3,
  },

  // v141: THE MONSTER TRUCK HE DRIVES (monster.js) -- not the set-piece below,
  // which stays as it is. About three times the SUV. Anywhere, on or off road,
  // steering freely; it never bangs: what it meets is crushed or knocked flying
  // and pops back once he has gone, and what is too big to crush stops it.
  monster: {
    scale: 1.7,                     // over the 7 m set-piece model: 12 m long, ~9.5 m tall, 3 m wheels
    cruise: 24, burst: 34, reverse: 7, accel: 9, brake: 7, coast: 2.5,   // m/s and m/s^2
    turnRate: 70, turnInPlace: 40,  // degrees a second at full steer: rolling, and stopped
    steerDead: 0.08,                // a hand resting on the glass does not steer
    gravity: 12,                    // in the air: a cartoon's, a high arc
    step: 3.2,                      // it rolls up on to anything this much higher than its wheels
    hullR: 5.5, hullH: 9,           // its body against what it meets: a column this wide and tall
    crushH: 22,                     // anything up to this tall is crushed; taller stops it (a shove)
    crushMinV: 0,                   // ... at ANY speed (v143): instant on contact -- stopped against a house, the first push goes through it
    crushSlow: 0.85,                // its speed after each crush
    landCrush: 6,                   // landing from a jump at this sink rate crushes what it lands on
    popR: 140, popAfter: 5,         // what it crushed pops back once he is this far off, after this long
    debris: 140, debrisLife: 2.4,   // the pieces that fly off a crush (one instanced draw)
    burstMin: 24, burstMax: 70,     // ... this many from one thing crushed, scaled by its size (the smallest still a burst)
    debrisClear: 10,                // ... and none starts nearer his cab than this
    quietAfterCrush: 4,             // no set-piece countdown starts for this long after a crush (v143)
    // the chase; the seat (11.5 m up in the cab, 5 m back, 8 degrees down, a wide lens); and, pulled in by a building
    // behind it, the chase as near as it must come and up over the cab
    cam: { back: 30, up: 13, lag: 4.5, look: 22, eye: 11.5, seatBack: 5, seatPitch: 8, seatFov: 84, minPull: 0.12, pullRise: 16 },
    speedSteps: [0.6, 0.8, 1.0, 1.3, 1.6],
  },

  monsterTruck: {
    n: [258, 880], s: [230, 420],   // the jump leg, north (the start) to south, ~95 m west of the road; the return leg runs west of it
    loopR: 40,                      // the two U-turns' radius: the return leg is 2 x loopR west
    trackW: 32, dirtY: 0.25,        // the dirt track, and how far it stands over the ground
    runUp: 110,                     // metres of run-up before the ramp
    rampLen: 60, rampRise: 30,      // the ramp: a 27 degree lip, as tall as a ten-storey block
    cars: 5, carGap: 17, carsAt: 346,    // five junk cars, nose to tail, starting this far along
    carScale: 3.6,                  // the junk cars, over a 4 m car: 15 m buses' worth -- the truck still a fifth bigger than five of them
    squash: 0.32,                   // a squashed car is this tall
    truckScale: 9,                  // the truck, over its 7 m model: 63 m long and 55 m tall -- a tower block on wheels
    accel: 10, topSpeed: 52,        // m/s^2 and m/s up to the lip
    gravity: 15,                    // in the air (a cartoon's: a high arc that comes down soon)
    brake: 22, returnSpeed: 14,     // after the cars, and round the loop home
    rest: 1.5, popDelay: 0.5, popTime: 0.45,  // stopped at the far end; the cars pop up this far apart, each taking popTime
    airT: 4.0,                      // seconds in the air, for arming: from the lip to the cars
    crushReach: 2.2,                // a car under the truck within this x truckScale of its middle is squashed
    clearAhead: 40, clearSpeed: 30, // anything sitting still on the track this far ahead is stepped off it, this fast
    armR: 1100, innerR: 90, coneDeg: 42,
    carView: 310,                   // (unused by the car now: kept so a test holding it off still reads)
    carArmR: 2000,                  // the car arms only within this of the landing (at the top speed step he covers 1.2 km before it lands)
    monsterQuiet: 650,              // v141: in his own monster truck nearer the landing than this, it does not arm (he is in the arena himself)
    landBearing: 18, landBearingR: 12,   // ... on his RIGHT less: he sits on the left, and the buttons and the map screen are there                // in the car it arms so that, at the landing, the truck is this many
                                    // degrees off his nose -- in the open windscreen, whichever way he drives
    count: 3,
    reticleR: 14, reticleRate: 2.4, reticleY: 42,
    hearR: 2400, roar: 0.22, roarHz: 52,
    shake: 0.3, shakeR: 900,
    puffs: 90, selfLight: 0.3,
    drawFog: 1.45,
  },
  // ---- The lock, and the dock it leads to (js/lock.js).
  //
  // A lock only means anything if the two waters are at DIFFERENT HEIGHTS, and
  // this game has one sea plane at TUNE.waterLevel. So rather than assert a
  // difference that is not there, the far side is a new place: an impounded dock
  // cut into the headland north of the harbour, held six metres up, whose only
  // way in or out by water is the chamber. The lift is then honestly earned --
  // and being six metres up is the payoff, because from in there he can see over
  // the spit.
  //
  // HOW THE SECOND WATER LEVEL IS ALLOWED TO EXIST. CLAUDE.md says water is
  // `terrainEff < waterLevel` and nothing else, and the reason for that rule is
  // that water defined in two places drifts apart from the ground. So this does
  // not add a second definition -- it GENERALISES the one there is. `seaLevelAt`
  // in terrain.js is now the single answer to "how high is the water here", and
  // it returns TUNE.waterLevel everywhere except over this dock and this
  // chamber. Flotation, the hull's resting height and the wake all ask it. The
  // rule still holds; it just takes a position now.
  //
  // WHAT THAT MEANS FOR THE GROUND, and it is the whole trick:
  //   * the DOCK floor sits ABOVE the global sea (waterLevel + lift - dockDepth),
  //     so the world's own water plane does not appear there at all -- the only
  //     thing that fills it is the dock's own raised surface.
  //   * the CHAMBER floor sits BELOW the global sea, because it has to hold
  //     water at both heights.
  //   * the RIM has to stand clear above waterLevel + lift or the dock's water
  //     would read as a puddle sitting on top of a field.
  // Cut in that order, after the harbour, exactly as the harbour is cut.
  //
  // It is never the way anywhere. The harbour mouth under the drawbridge is
  // still wide open and still the way to sea; the lock leads only to the dock,
  // and the dock is somewhere to go rather than somewhere he has to pass.
  lock: {
    lift: 6,                          // how much higher the dock is than the harbour
    dockDepth: 4,                     // water in the dock, once it is full
    chamberDepth: 5,                  // ... and under the chamber at the LOW level
    // The chamber is FIFTY METRES WIDE and a hundred and forty long. That is
    // five beams and nearly three lengths of the yacht, which is absurd for a
    // real lock and exactly right for a four-year-old lining a ship up on a gap.
    chamber:   { x: [1425, 1475], z: [-6030, -5890], feather: 26 },
    approachS: { x: [1425, 1475], z: [-6110, -6030], feather: 26 },
    approachN: { x: [1425, 1475], z: [-5890, -5836], feather: 26 },
    dock:      { x: [1250, 1750], z: [-5820, -5600], feather: 60 },
    rim:       { x: [1170, 1830], z: [-6040, -5480], feather: 110, y: 9.0 },
    gateS: -6030, gateN: -5890,       // where the two gates stand
    wallY: 7.4, wallT: 9,             // the chamber's masonry: top height and thickness
    gateH: 15, gateT: 1.8,            // a gate leaf, and how thick it is
    gateOpenDeg: 82,                  // how far back the leaves swing against the walls
    gateTime: 3.4,                    // seconds for a gate to swing
    fillTime: 7.0,                    // ... and for the water to change level
    warn: 2.6,                        // bells and beacons before anything moves
    nearGate: 130,                    // this close and the gate on his side opens itself
    insideMargin: 16,                 // he must be this clear of both gate lines to be "in"
    idleReset: 26,                    // sitting in the chamber doing nothing: it lets him back out
    beacons: 4, sillLamps: 8,
    // the dock, once he is up there
    quayY: 5.6, boats: 4, sheds: 2,
    stacks: 4,                        // a few container stacks on the wharf
  },

  // ---- The speedboat (js/boat.js). The same one-finger stick as the car, and
  // one thing only a boat can do: the water cannon. Nothing here is a timing
  // window -- the cannon is gated on where the bow is POINTING, not on how long
  // a button was held at the right instant.
  boat: {
    cruise: 42,                  // fast enough for the harbour to go past
    accel: 16, drag: 13,         // it accelerates hard and coasts a long way
    burst: 1.45, burstTime: 1.8, // drag up: the bow lifts and it goes
    steerRate: 46, steerAccel: 4.5,
    bankDeg: 16,                 // it banks INTO the turn, the opposite of the car
    hullR: 4.5,                  // the hull's own radius, for bumps and bangs
    crashSpeed: 20,              // below this a contact is a bump, not a bang
    crashDebounce: 0.9,          // seconds of GAME time between bangs, driven by the frame
    draft: 0.6,                  // this much water under it counts as floating
    planeAt: 20,                 // it comes up on the plane above this
    planeRate: 2.2, bowRise: 7, trim: 1.5, planeLift: 0.55,
    bob: 0.12,                   // how much it heaves when he lets go. Small: a hull this
                                 // shallow visibly swamps itself at anything bigger, and the
                                 // rocking he actually reads is the roll, not the heave.
    // NEVER STUCK. A beached hull slides itself back to the water; the delay is
    // long enough to see what happened and short enough that it is never a wait.
    // The rings are searched in order until one finds water. One ring is not
    // enough: 115 m up a beach every sample was sand and the hull sat there.
    beachedMax: 0.25, beachProbe: 22, beachRings: [22, 55, 130, 300, 650],
    refloat: 24, refloatDelay: 1.0, strandedAfter: 5,
    gravity: 19,                 // ... while it is off the ramp
    slapGain: 0.05,
    // The water cannon. `cannonAim` is the dot product the bow has to reach for
    // the water to be going anywhere near the fire -- about 40 degrees of slop,
    // which is a lot, because he is four.
    // `cannonRadius` is where the BUTTON appears -- far enough out that he can
    // see it and drive in. `cannonReach` (+ slack) is how close the water
    // actually gets there, so the button is an invitation and the arc is honest.
    cannonRadius: 260, cannonReach: 90, cannonSlack: 25, cannonPuffs: 4,
    cannonAim: 0.76, cannonSheet: 1.6,
    camChase: [22, 8], camLag: 5,
    speedSteps: [0.55, 0.78, 1.0, 1.4, 1.85],   // top step ~78 m/s: the harbour really moves
    // ---- THE STERN PLUME, which used to look like smoke.
    //
    // There was a "rooster tail" here: one white sphere a few metres astern,
    // climbing nine metres a second and growing to a five-metre ball. The chase
    // camera sits twenty-two metres astern and eight up, looking forward -- so
    // that ball went up through the middle of the shot and sat there. It read as
    // an engine on fire rather than as water, and it hid the thing he was
    // steering. Readability beats realism, so it is gone.
    //
    // What replaces it is deliberately almost nothing, because it was carrying
    // no spectacle: the bow wave and the side wake already say "fast". A single
    // low, translucent puff at the transom, at idle only, below the chase
    // camera's sightline and behind the helm's -- and above `plumeMaxSpeed`
    // nothing at all, which is the speed at which he is actually looking where
    // he is going.
    plumeMaxSpeed: 12,          // above this: no plume, at all
    plumeEvery: 0.42,           // seconds between wisps -- sparse on purpose
    plumeSize: 0.55, plumeRise: 0.5, plumeLife: 0.7,
    plumeBack: 6.5, plumeY: 0.5,// astern of centre, and above the waterline
    // The side wake, which stays -- but it is no longer a wall.
    //
    // Three numbers were wrong together, and only the third one is obvious once
    // you look at a screenshot instead of a number. It CLIMBED (7.2 m/s for a
    // second and a half, straight up through the sightline). It was HUGE (a
    // puff grows to 2.2x its size, so 2.9 became a six-metre ball). And it was
    // emitted only ELEVEN METRES behind a boat the chase camera sits twenty-two
    // behind -- so a six-metre ball sat nine metres in front of the lens and
    // filled the bottom of the frame, with the boat somewhere behind it.
    //
    // `[base, plane]` pairs: the value at rest, and how much full plane adds.
    // Lower, smaller, and thrown wider, so the wake is plainly there, off both
    // quarters, and the middle of the shot is empty.
    wakeRise: [1.2, 1.6], wakeLife: [0.7, 0.3],
    wakeSize: [1.1, 0.7], wakeSpread: [3.2, 5.5],
    // The helm. Metres above the WATERLINE, with -Z forward, measured against the
    // real hull: it is a low offshore boat and its screen tops out barely a metre
    // above the sea, so an eye at car height floated above its own windscreen.
    helm: { width: 2.2, dashTop: 1.02, seatX: -0.40, eyeY: 1.42, eyeZ: 0.30, wheelTurn: 2.2 },
  },

  // ---- The yacht (js/yacht.js). Everything about it is weight: slow away, slow
  // to turn, a long time to stop, and a bow wave you can see from the shore.
  //
  // DRAG UP IS THE HORN, not a burst. Fifty metres of ship has no burst to give,
  // and the horn is the thing a four-year-old will press over and over -- the
  // whole harbour answers it.
  //
  // Its one boat-only thing is that IT IS A PLACE: a helipad on the stern the
  // helicopter can land on while she is under way, and a garage in the transom
  // that swallows the speedboat. Both are a vehicle inside a vehicle, and
  // neither is ever required.
  yacht: {
    len: 52, beam: 9.4, draft: 2.4,
    cruise: 17, accel: 2.0, drag: 1.4,
    steerRate: 9, steerAccel: 1.1, bankDeg: 4,
    hullR: 17,                        // she leans on a pier; she does not explode against it
    bob: 0.10,
    // Her berth is on the WEST wall, not among the small craft. Fifty-two metres
    // does not fit in a marina: laid alongside the big pier she overlapped both
    // it and the main walkway, the hull collision pushed her off both at once,
    // and she spent the whole of her first run being shoved gently back and
    // forth between them. Real ports put ships like her on their own wall for
    // exactly this reason. She points at the harbour mouth, worked out at spawn
    // rather than written down, so moving the mouth moves her with it.
    berth: [860, -6360],
    // She CANNOT BEACH. A probe ahead and off each bow finds the shoal and adds a
    // nudge toward the deeper side, so he feels a big ship not wanting to go
    // somewhere -- which is what a big ship is like -- and is never told off.
    shallow: 60, shallowTurn: 20,
    // ... and it stands down for the harbour mouth, which is shallow water on
    // both sides on purpose. `dot` is about 32 degrees of slop either way.
    gap: { range: 900, dot: 0.85, half: 230 },
    horn: { hz: 82, dur: 2.6, cooldown: 3.2, replyDelay: 0.9, range: 1100, echo: 0.55 },
    anchor: { idleTime: 3, dropTime: 1.6 },
    // Measured against the real hull: her main deck is 6.6 m above the waterline
    // and her transom 26 m aft of the middle.
    pad:    { x: 0, z: 16, y: 6.9, r: 7.4, lamps: 10 },
    // `y` is the HINGE, at the foot of the transom, and `openTilt` is how far
    // past horizontal the ramp dips so it actually reaches the water.
    garage: { z: 25.5, y: 1.6, w: 7, h: 4.6, openTilt: 0.22, doorTime: 2.4, radius: 90, reach: 12 },
    bridge: { trigger: 430, warn: 3.5 },
    bridgeView: { eyeY: 11.2, eyeZ: 6, seatX: 0, seatZ: -4, width: 7,
                  dashTop: 10.4, wheelTurn: 2.0, radarRpm: 14, radarRange: 900 },
    camChase: [95, 34], camLag: 3,
    hullGain: 0.045,
    speedSteps: [0.6, 0.8, 1.0, 1.45, 1.9],   // fifty-two metres at 32 m/s, which is a sight
    // Her stern plume, on the same terms as the speedboat's and for the same
    // reason. Her transom is 26 m aft and the chase camera 95 m aft and 34 up:
    // anything that climbs from back there crosses the shot. She gets one wisp
    // at a manoeuvring crawl and nothing once she is under way.
    plumeMaxSpeed: 5,
    plumeEvery: 0.55, plumeSize: 1.1, plumeRise: 0.4, plumeLife: 0.9,
    plumeBack: 26, plumeY: 1.2,
    // HER WAKE HAD TO COME DOWN TOO, and the bridge view is what proved it.
    // A puff grows to 2.2x its size, so a 4.6 became a TEN-METRE ball -- and the
    // bow wave is thrown from 26 m ahead of centre while the bridge camera sits
    // 6 m abaft it. Twenty of those, ten metres across, standing thirty metres
    // dead ahead, turned the whole wheelhouse view into white fog: the horizon
    // was a smudge and the harbour behind it was gone. Halved and thrown wider,
    // the bow wave still says "this is fifty metres of ship" and it does it off
    // her shoulders, where he can see past it.
    // `[base, k]` where k is her speed as a fraction of cruise.
    bowSize: [1.4, 0.9], bowSpread: [6, 0.9], bowLife: 1.1,
    sternSize: [1.6, 1.4], sternLife: 1.2,
  },

  // ---- Things to do at sea (js/seaevents.js). Five of them, and every one obeys
  // the rules the space events obey: never required, never blocking, and it
  // never takes anything away. The jet-ski is rubber-banded like the rival
  // rocket, so there is no winner and nothing to lose by being slow.
  seaEvents: {
    range: 4200,                     // the lot switches off beyond this
    ski: {
      minSpeed: 18, channelR: 320,   // he has to be moving, and in the channel
      startBehind: 90, side: 26,     // it comes past him from astern, off his beam
      leadSwing: 22, weave: 0.55,    // ... and then noses ahead and drops back
      band: 0.9, accel: 26, turn: 3.2,
      maxTime: 75, cooldown: 25,
    },
    whale: {
      len: 9, beam: 3.2, height: 16, riseTime: 2.6, roll: 1.1,
      dist: [220, 420], minDepth: 8, every: [22, 48],
      retry: 1.5,                    // a spot in the shallows costs a moment, not a whole turn
    },
    cruise: {
      len: 240, beam: 34, decks: 4, lightSize: 9, hornHz: 58, speed: 12,
      callTime: 7,                   // the wind-up: two horns before anything appears
      stayTime: 70, gap: [110, 190], first: 45,
      // In from the open sea, through the breakwater gap, and alongside in the
      // inner harbour west of the container ship -- which is where 240 m of ship
      // actually fits. Berthing her ON the container quay put her bow through
      // the ship already tied up there.
      path: [[1300, -8300], [1300, -7300], [1300, -6900], [1180, -6560], [940, -6470]],
    },
    carrierWake: { radius: 900, every: 16, width: 240, stand: 70, puffs: 22, roll: 9 },
    crane: { radius: 130, time: 3.6, deckZ: -14, deckY: 7.2 },

    // ---- three more, because the harbour is the third place he can lose a
    // whole session in and five things to find is not enough. All three are
    // MACHINES, all three are scenery that moves -- `noSolid`, like the ferry
    // and the road traffic, so none of them can ever become a wall in front of
    // him -- and all three obey the same rules the first five do: never
    // required, never blocking, never takes anything away.

    // THE SEAPLANE. It comes in over the breakwater, puts down on the water in
    // a sheet of spray, taxis, turns, and takes off again. The spray on
    // touchdown is its one hero effect. Announced by its own engine a long way
    // out, so it is never a thing that simply appears.
    plane: {
      first: 30, gap: [70, 130],
      // Big enough to READ. At fourteen metres it was a speck against the
      // breakwater; everything else out here is a set-piece you can see from
      // the far side of the harbour, and it has to be one too.
      len: 20, span: 26, floatDrop: 2.8,
      cruiseY: 120, approachY: 34,    // where it circles, and where the descent starts
      speed: 62, taxiSpeed: 9, climb: 16,
      runIn: 1400, runOut: 1600,      // how far out it starts and how far it goes before vanishing
      x: 1300,                        // it uses the buoyed channel, like everything else here
      touchZ: -7200, taxiTime: 7, turnTime: 4,
      sprayEvery: 0.05, sprayPuffs: 5,
      engineHz: [90, 210],
    },

    // THE SUBMARINE. A boil of water, then the hull comes up out of it with the
    // sea sheeting off, a klaxon, a run on the surface, and it goes down again.
    // The rise is the hero effect and the boil is the wind-up: nothing this big
    // arrives in this game without announcing itself first.
    sub: {
      first: 95, gap: [120, 210],
      len: 78, beam: 11, sailH: 9, sailL: 16,
      x: 900, z: [-8100, -7500],      // out past the breakwater, in deep water
      boilTime: 3.2, riseTime: 4.5, runTime: 26, diveTime: 4.0,
      deep: 26,                       // how far under it sits when it is down
      speed: 9, boilPuffs: 5, sheetPuffs: 7,
      klaxonHz: 300, klaxonDur: 0.9,
    },

    // THE FIREBOAT. Moored off the terminal, and every so often it puts on a
    // display: three monitors that elevate and throw tall arcs of water. It is
    // the water cannon's language, which he already knows from the speedboat,
    // done by something else and much bigger.
    fire: {
      first: 55, gap: [80, 150],
      x: 1690, z: -6640,              // clear of the marina fingers and the fairway
      len: 22, beam: 7,
      monitors: 3, reach: 90, arcH: 40,
      // The jets are the fireboat's OWN instanced droplets, not the shared
      // wakePuff pool. Three arcs at nine puffs every 0.07 s is three hundred
      // and eighty a second into a pool of sixty-four -- it would have starved
      // every splash in the harbour and strobed its own arcs. One instanced
      // mesh is one draw call and owes nothing to anybody.
      drops: 26, dropSize: 1.7, scroll: 0.55,
      windUp: 2.4, showTime: 16,      // the horn and the monitors coming up, then the display
      hornHz: 150, hornDur: 1.2,
    },
  },

  // ---- The harbour (js/harbor.js, and the ground it stands on in js/terrain.js).
  //
  // WHERE IT IS. The brief said "California, at the existing harbour
  // depression", and those are two different places: the depression that was
  // already in the terrain is at the NEW YORK end, under the suspension
  // bridges. Everything the harbour is supposed to connect to is Californian --
  // the burning rig at (-550, -6900), the carrier at (-900, -8100), the buoy
  // channel that runs past both -- so it is built at the California end and the
  // New York depression is left exactly as it was.
  //
  // It sits EAST of the airport because the airport's flatten mask reaches
  // x = +-550 and would quietly pull any dredging back up to runway height.
  //
  // The shape is a real one: a bay behind a barrier spit, with the coast road
  // running along the spit and lifting on a drawbridge over the entrance. The
  // terrain does four things in order -- dredge the basin and the outer
  // harbour, raise the spit across the whole coast, then cut the mouth back
  // through the spit -- so the mouth is the only way in and out by water, and
  // the road is the only way across by land.
  harbor: {
    // the coast road's way round the runway (harbor.js hbBuildRoad): it crosses
    // the runway's line `pastEnd` beyond the north threshold, and runs down the
    // strip at `stripX` between the runway (x 30) and the city (x 180)
    road: { pastEnd: 200, out: 420, fwd: 80, lead: 80, stripX: 120 },
    cx: 1300,                        // the mouth's centreline: channel, drawbridge and buoys all share it
    depth: 15,                       // dredged this far below the waterline
    basin:   { x: [700, 1900], z: [-6660, -6070], feather: 70 },
    outer:   { x: [760, 1840], z: [-7120, -6830], feather: 70 },
    spit:    { x: [420, 2260], z: [-6820, -6670], feather: 46, y: 5.5 },
    mouth:   { x: [1180, 1420], z: [-6880, -6600], feather: 26 },
    channel: { x: [1110, 1490], z: [-7460, -6840], feather: 80 },

    // ---- the built harbour
    quayY: 4.2,                      // deck height of every quay, dock and mole
    breakwater: {
      z: -7120, armY: 6.5, armH: 13, armW: 46,
      gap: [1130, 1470],             // the way through, wider than the mouth so the run in is forgiving
      x: [700, 1900],
      blocks: 9,                     // armour blocks along the seaward face, per arm
    },
    // The beam is NORMALLY blended, not additive, and that is the whole reason it
    // reads at noon. Additive can only add light, and against this game's bright
    // sky there is nowhere left to go -- the same lesson the jet's afterburner
    // taught. The lamp itself stays additive, because a lamp really is light.
    lighthouse: { x: 1090, z: -7120, h: 44, r: 6.0, beamLen: 340, beamW: 30, rpm: 4.5, lampR: 3.6,
                  beamColor: 0xfff0b0, beamOpacity: 0.20 },
    marina: {
      x: 1560, z: -6300,             // the east side of the basin
      fingers: 4, fingerLen: 92, fingerW: 6, spacing: 44,
      // Bigger and coloured than the first pass, because from the air the white
      // ones were invisible against a white pier. Machines, generic, no names.
      boats: 12, boatLen: [11, 17], boatBeam: 4.4,
      bigBerth: [1720, -6520],       // where the yacht lies (stage 2)
      spawn: [1500, -6200],          // the speedboat, nose out
    },
    terminal: {
      // The quay has to REACH THE SHORE. At 130 m deep it stopped 70 m short of
      // the beach and read from the air as a grey raft moored in the middle of
      // the harbour with cranes on it, which is the sort of thing that makes a
      // world look unfinished rather than stylised.
      x: 980, z: -6120,              // the head of the basin
      quayW: 460, quayD: 210,
      cranes: 2, craneSpan: 150, craneH: 62, craneLegW: 4, craneRail: 190,
      stacks: 7, containerL: 12, containerW: 5, containerH: 5,
      ship: { x: 980, z: -6262, len: 260, beam: 38, y: 15 },
      craneCycle: 11,                // seconds for one container up-across-down-back
    },
    fuel: { x: 800, z: -6560, w: 34, d: 14 },
    ferry: {
      // a loop between the terminal side and the marina side, for ever
      route: [[860, -6480], [1660, -6420], [1660, -6180], [860, -6220]],
      len: 42, beam: 13, speed: 9, deckY: 5.5, hornEvery: 46,
    },
    tug: { x: 760, z: -6200, len: 26, beam: 10, bob: 0.5 },   // tucked out of the fairway the yacht uses
    ramp: {                          // the floating ski jump, out in the outer harbour
      x: 1620, z: -6960, w: 26, len: 46, rise: 9, deg: 22,
      ringR: 11,                     // the amber ring, in the language every other jump uses
      hitR: 20, minSpeed: 16,
      kick: 9.5, kickPerSpeed: 0.30, spin: 1.9,
      airborneAt: 0.9, maxAir: 6,
      flipAt: 0.9, flipTime: 1.0,
    },
    // The buoy channel: out through the mouth, past the rig, on toward the
    // carrier. Every leg is a pair of buoys, one each side.
    buoys: {
      path: [[1300, -7060], [1300, -7420], [900, -7700], [200, -7800], [-500, -7960], [-880, -8080]],
      spacing: 200, half: 90, r: 2.2, h: 6.5,
    },
    gulls: { count: 14, r: 260, y: [16, 54], speed: [7, 13] },   // scenery: not solid, not shatterable, never a target
    // Cars on the coast road, so the drawbridge has something to keep waiting.
    // They QUEUE rather than vanish: the queue is half of what makes the lift
    // worth watching.
    roadTraffic: { count: 8, x: [300, 2200], speed: [16, 24], queue: 150 },
    visibleRange: 3400,              // the whole thing hides beyond this
    audio: { slapGain: 0.05, craneGain: 0.035, gullEvery: [7, 15] },
  },

  firefight: {                      // the burning rig off the coast, and the water bucket
    rig: { x: -550, z: -6900 },     // just off the coast: about 35 s in the helicopter, on open
                                    // water clear of the approach corridor, the pad, the recovery
                                    // fleet and the carrier
    deckY: 26, legH: 30,            // the platform stands this high on its legs
    flames: 9, flameH: 22, flicker: 7,
    smokePuffs: 26, smokeH: 300, smokeRise: 26, smokeSize: 20,   // the column, seen from a long way off
    scoopAlt: 40,                   // this low over open water and the bucket can go down
    scoopTime: 1.4,
    dropR: 150,                     // this near the rig and the same button becomes DROP
    drops: 3,                       // three of them put it out
    sheet: 24, sheetLife: 1.5, sheetFall: 26,
    steam: 20, steamLife: 2.2, steamRise: 14,
    relight: 22, relightGlow: 3.5,  // it comes back on its own, announced by a glow
    bucketDrop: 14,                 // how far the bucket hangs below him
  },

  carrier: {                        // the carrier off the California coast
    at: { x: -900, z: -8100 },      // open sea, clear of the approach, the pad and the fleet
    deckY: 20, deckL: 300, deckW: 78, hullW: 62,
    angleDeg: 9,                    // the landing strip runs a little off the ship's axis
    // The trap is generous on purpose: he is four, and a miss is only a loop-around.
    trapAlt: 30, trapHeadingDeg: 45, arrestTime: 1.1,
    catX: -19, cat2X: 15, catZ: 60, // the two catapults, forward on the deck
    countFrom: 3,                   // the wind-up before the shove
    shoveSpeed: 100, shoveTime: 1.6,
    steam: 26, steamLife: 1.6,
    crew: 12, crewWave: 3.2,
    jets: 4,                        // parked on the deck, plus a helicopter aft
    aiEvery: 16, aiCount: 3, aiSpeed: 95,   // the other jets go off cat 2 on their own
    alarmMuteRadius: 320,
  },

  marsBase: {                       // Mars is a place, not a patch of red ground
    domes: 3, domeR: 15,
    masts: 3, mastH: 26,
    parked: 3,                      // a row of Starships already standing there
    astros: 5,                      // tiny, and nothing can ever happen to them
    dunes: 10, duneR: [22, 46],
    spread: 130,                    // how far the base sprawls from the pad
    padR: 26, padLights: 14,        // the lit pad: it is drawn around wherever he came down
    armDist: 70, triggerR: 22,      // drive out this far, then back inside this, and it takes him home
    padCount: 3,                    // the countdown on the pad before he goes
    // things to DO out there, all of them Mars-only
    jumps: {
      count: 4, dist: [175, 260],     // sculpted ramps out on the dunes, well clear of `spread`
      w: 13, len: 20, rise: 5,
      ringR: 7.5,                     // marked in the pad's own language, angled up
      minSpeed: 5, hitR: 6, groundish: 2.5,   // rolling fast on Mars it is half-airborne on its own bumps
      lipSlope: 0.62,                 // the lip's slope IS the throw now: he drives up it (~4 s of Mars air)
      spin: 2.2,                      // how fast it tumbles in the air
      airborneAt: 1.2, maxAir: 14,    // properly off the ground / a hard stop, so it can never spin for ever
      dust: 16, dustLife: 2.0,
      flipTime: 1.1,                  // a bad landing rolls it, and it rights itself
      flipAt: 1.1,                    // ... if it came down more than this far off level
    },
    boulders: {
      count: 12, cairns: 3, cairnRocks: 3,
      dist: [55, 120], r: [1.6, 3.2],   // in among the domes, but clear of the lit pad
      shoveR: 3.4, shove: 7, shovePerSpeed: 1.0,
      drag: 0.5, bounce: 0.75,        // Hot Wheels, not physics: cheap and satisfying
      resetDist: 260,                 // drive away and come back and it is all set up again
    },
    drone: {
      parkAngle: 3.28, parkDist: 80,  // it sits beside the garage (which is at spread*0.5, 3.4)
      callR: 22,                      // drive this close and the button comes up
      cruise: 22, approach: 0.6, accel: 2.0, hoverDamp: 3.0,
      turnRate: 70, turnAccel: 4.0,
      hoverH: 14, minH: 2.2, maxH: 220,
      vGain: 0.7, vRate: 9, vAccel: 2.5,
      landR: 9,                       // this near the rover and it settles beside it
      graceTime: 1.6,                 // ... but not in the first moments, with the rover still underneath
      rotor: 26,                      // how fast the blades spin
      modelScale: 0.55,               // scale audit: it read bigger than the rover it scouts for
      stallTime: 2.0, stallSpeed: 2,  // never stuck, same guarantee as the helicopter
      // Point-to-go, exactly like the big helicopter: the step scales the cruise
      // cap and leaves the approach taper alone.
      speedSteps: [0.6, 0.8, 1.0, 1.5, 2.0],
    },
    boost: 6,                       // ... and it keeps his throttle in this long after lift-off,
                                    // or Mars simply pulls him straight back down onto the pad
    cargoDelay: 12,                 // once he is out driving, the cargo ship is announced
    cargoCount: 5,
    cargoFrom: 700, cargoSpeed: 80, cargoOffset: 130,
    cargoLegs: 1.2, dust: 28, dustLife: 2.8, dustRise: 7,
  },

  towerCatch: {                     // the Starship booster, caught by the tower arms
    catchR: 14,                     // how far off centre the arms will still take it
    armIdle: 0.55, armWide: 0.98, armClosed: 0.08, armRate: 1.8,
    inboundAlt: 300,                // the show starts when the booster is this far above the arms
    countFrom: 5,                   // big numerals from here down to 1
    glowR: 15, glowH: 26,           // the catch-zone glow the booster drops into
    swayAmp: 0.055, swayRate: 2.2, swayDamp: 0.5,
    sweepRate: 2.6, sweepTime: 6,   // the tower lights sweep after a catch
    hornDelay: 0.9,
  },

  glideSlope: 0.085,
  glideBand: 9,
  minFlyingSpeed: 18,
  skipOutDistance: 1450,
  aimMarkerDistance: 320,

  routeLength: 12000,
  continentCompression: 1.0,

  spaceAltitude: 900,
  spaceBlendBand: 260,
  otherVehicleCeiling: 520,

  // The fixed-wing steps. Tuned with him, so they stay as they are; every other
  // vehicle now has a list of its own beside its own numbers (js/speed.js says
  // why, and what the multipliers are multiplying).
  speedSteps: [0.45, 0.7, 1.0, 1.3],
  missileCount: 4,
  missileCooldown: 0.45,
  missileSpeed: 95,
  missileLife: 4.0,
  trafficCount: 6,
  trafficRespawnDelay: 4.0,
  trainSpeed: 22,

  // rewards & feel (see README "Rewards")
  ringNotes: [392, 440, 494, 523, 587, 659, 698, 784, 880, 988, 1047, 1175],
  flareAgl: 10,
  flareSink: 3.0,
  shatterRestoreDelay: 6.0,
  craterFade: 20,
  gateRearm: 30,
  gateGreenTime: 5,
  wingmanDist: 70,
  wingmanHold: 3.0,
  wingmanCooldown: 20,
  crashWarnTime: 2.2,
  gearWarnAgl: 25,
  climbOutAgl: 15,
  flareStartAgl: 30,         // over the runway, descend from here into the flare band           // must reach this AGL after liftoff before a landing can count
  keyStickRamp: 4.0,

  debrisCount: 26,
  reassembleDelay: 2.0,

  eject: {
    frameTime: 0.4, open: 0.9, launch: 1.1, unfold: 0.6, descent: 7, celebrate: 1, returnTime: 1.2,
    lift: 18, clearanceMargin: 10, seatScale: 2, transitHeight: 60, fallTime: 3.8, fallGravity: 15, emptySpeed: 32, emptyLift: 12,
    hatchAngle: 1.8, canopyPop: 5, rotorSlide: 6, rotorLift: 1.5, rotorFold: 0.92,
    emptyRoll: 0.16, emptyPitch: 0.7, emptyPitchRate: 0.1, clearFraction: 0.45,
    seatSide: 4, landingDrift: 10, celebrationHop: 0.35, sway: 0.045,
    cameraRate: 3, cameraMin: 32, cameraMax: 95, cameraEmptyWeight: 0.4, cameraFrameMargin: 0.82, cameraImpactHold: 1.3, fastRate: 3.5,
    families: {
      prop: { opening: 1, hatch: 'canopy', seat: 'spring', front: 0.6, roof: 1.2, color: 0xffd23e },
      fighter: { opening: 0.7, hatch: 'pop', seat: 'rocket', front: 4, roof: 0.9, color: 0xe0483e },
      airliner: { opening: 1.2, hatch: 'door', seat: 'rescue', front: 4, roof: 1.05, color: 0xffd23e },
      helicopter: { opening: 1.4, hatch: 'door', seat: 'spring', front: 0.4, roof: 1.7, color: 0x20a39e },
      rocket: { opening: 1.1, hatch: 'capsule', seat: 'capsule', front: 0, roof: 0, color: 0xf2f4f7 },
      starship: { opening: 1.3, hatch: 'capsule', seat: 'capsule', front: 0, roof: 0, color: 0xb8bec8 },
      rover: { opening: 1, hatch: 'panel', seat: 'spring', front: 0, roof: 1.6, color: 0xffd23e },
      drone: { opening: 1.4, hatch: 'panel', seat: 'capsule', front: 0, roof: 1.6, color: 0xd4a72c },
      // The car ejects like a fighter, which is the whole joke. `roof` is big
      // because it is measured from the MODEL's origin and the car's model sits
      // a whole gearHeight below its reference point: the roof is 3.18 m above
      // the road and the model origin is 2.6 m below it, so the seat clears the
      // glass at 5.9. Without an entry here ejectStart simply returned false and
      // the button did nothing at all.
      car: { opening: 1, hatch: 'panel', seat: 'rocket', front: 0.4, roof: 5.9, color: 0xe0483e },
      // v146: the Cybertruck ejects as the car does, through its own taller roof:
      // 2.6 m of origin under the road, the body's measured 3.66 m, and the same clearance.
      cybertruck: { opening: 1, hatch: 'panel', seat: 'rocket', front: 0.4, roof: 6.4, color: 0xe0483e },
      // And the boat, for the same reason the car needed an entry: without one
      // `ejectStart` returns false and the button sits there doing nothing.
      // `roof` is measured from the MODEL's origin, which for a boat sits a
      // gearHeight below the waterline, so the open cockpit at 1.0 m above the
      // sea is 3.6 m above the origin. It comes down under a canopy on its own
      // life raft, which the seat has always carried.
      speedboat: { opening: 1, hatch: 'panel', seat: 'spring', front: 0.5, roof: 3.6, color: 0xe0483e }
    }
  },

  // ---- v147: THE VALLEY (terrain.js shapes it, valley.js furnishes it). A winding
  // snow valley cut west through the mountain range, ending in a snow bowl between
  // jagged peaks with a concrete bunker in it. It is part of HIS world: he can fly
  // it, and the bunker is solid and never breaks. Everything here sits west of
  // x = -1650, kilometres clear of the motorway, its tunnel, the railway and both
  // cities (valley.js's vlClearOfEverything says how far, and the harness asserts it).
  // Sized off the film's stills: a floor ten-odd wingspans wide, walls twenty-plus
  // high, and the jets a wingspan or two off the snow.
  valley: {
    x0: -2600,                   // the mouth: the valley opens to the east here
    xb: -10900,                  // the bowl's centre (west end)
    zc: -1500,                   // the range's spine (terrain.js mountainGauss)
    // the centreline winds: z = zc + sum of a * sin(2 pi (x0 - x) / L + p)
    wind: [[300, 3300, 0.0], [110, 1300, 1.9]],
    floorHalf: 85,               // half-width of the snow floor, metres
    floorVary: 30,               // ... give or take, along the valley
    wallRun: 210,                // horizontal run of a wall, floor to crest (~55 degrees at its steepest)
    wallWobble: 45,              // the walls snake a little either side of the floor
    floorY: [26, 70],            // floor height at the mouth and at the bowl
    ridge: 290,                  // crest height over the floor
    jag: 120,                    // and jagged peaks on top of that
    halfZ: 1150,                 // how far north and south of the spine the massif reaches
    rampX: 900,                  // metres over which it rises out of the range, at both ends
    westPad: 1400,               // how far the massif runs on past the bowl before it ramps down
    bowlR: 230,                  // the bowl's flat snow floor
    bowlRim: 470,                // ... rising to the needles at this radius
    needles: 11, needleH: 170, needleR: 70,   // the rock spires around the rim
    // colours, all from the palette: snow, rock, the pines (grassMid, darkened)
    rockSlope: 1.9,              // rise over run past which the snow cannot hold: rock
    pineBelow: 190,              // pines only this far above the floor
    pineCell: 26, pineChance: 0.55, pineMax: 6000, pineSegs: 10,
    pineShade: 0.42,             // grassMid times this: the film's dark blue-green
    // the bunker: a squat concrete block in the bowl, its vent hatch tilted up on top.
    // `vent` is the hatch's centre over the block, in the block's own frame.
    bunker: { w: 16, d: 12, h: 4.2, ventW: 3.2, ventL: 5.0, ventH: 2.2, ventTilt: 0.42 },
  },

  // ---- v147: DAD MODE (dadmode.js). The parent's, behind a code; the kid rules do
  // not apply inside it and nothing of it may appear outside it. One mission, "Canyon
  // Strike". None of these numbers is read anywhere else, and the kid's fighter row
  // below is never touched: the dad jet flies on its own profile, built from `jet`.
  dad: {
    code: "1986",
    wrongMax: 3, lockout: 60,    // three wrong tries lock the pad for this many seconds
    jet: {
      cruise: 150, min: 95, max: 235, accel: 0.55, gravity: 0.75,   // m/s; how hard it drives to cruise, how much a climb or dive trades
      bankLimitDeg: 82, rollRate: 5.5,                               // attitude in roll: release levels the wings
      pitchRateDeg: 38, pitchExpo: 2.6,                              // rate in pitch: release HOLDS the nose (fine aim near the middle)
      turnMul: 2.1,                                                  // turn rate = turnMul * g tan(bank) / v
      gMax: 9.5, gGrey: 6.5, gBlack: 10.5,                           // the pull is limited to gMax; grey-out from gGrey
      ceiling: 820, size: 1.25,
      touchAgl: 1.2,               // dad's crash height: the jet's belly ON the ground (his game's is terrainClearance, 8 m, never used here)
    },
    clock: 150,                  // seconds to the target
    health: 100,
    // the hidden ceiling (v149: 200 ft, was 100): under it the radar never locks and the guns never hit
    radar: { agl: 60.96, arm: 0.7, lock: 2.2, cool: 3.5, alertMul: 0.5 },   // 200 ft; seconds above it to a lock, then to a launch
    sam: { speed: 290, turnDeg: 34, life: 11, fuse: 14, damage: 55, launchGap: 0.6 },
    flares: { count: 8, decoyRange: 1400, life: 3.2, cooldown: 0.5 },
    // v148: being shot at is unmissable. `scale` sizes the mounts so they read on a ridge;
    // a gun opens up inside `fireRange` (it can only hit inside `range`), and with no line
    // of sight it fires blind, its stream into the sky across his nose (`ahead`: the share
    // of a sighted stream led across the nose, not at him). Flak within `nearMiss` shakes;
    // a blind gun bursts its flak over him. Under the radar's ceiling, 200 ft (`radar.agl`), he is
    // HIDDEN: tracers and flak still fly round and above him, and nothing hits.
    guns: { count: 9, range: 950, fireRange: 1500, burst: 1.6, gap: 2.2, rof: 14, tracer: 620, spread: 0.035, hitChance: 0.035, damage: 6,
            flakEvery: 0.45, flakSpread: 26, flakHit: 10, nearMiss: 45, exposedAgl: 70, scale: 3.2, ahead: 0.7,
            wallAt: 0.55 },   // dug into the wall face this far up its run, in sight of the floor
    siteScale: 2.2,
    // his missiles: six, kept for the SAM sites and the radar (a gun only when nothing else is in the cone)
    missiles: { count: 6, speed: 260, turnDeg: 60, life: 6, lockCone: 0.42, range: 2200, cooldown: 0.8 },
    // v151: the F-35's cannon. Held, unlimited, short range. Rounds on a target add up: a gun
    // goes after `kill.gun` seconds of fire on it, a SAM site after `kill.site`. It hurts
    // nothing else -- the bunker only sparks (the bombs are the only way in).
    cannon: { range: 1000, rof: 45, speed: 1100, spread: 0.005, muzzle: [2.4, 1.4],   // muzzle: metres left of and under the nose line
               hitR: { gun: 9, site: 12 }, kill: { gun: 1.0, site: 2.5 } },
    bombs: { count: 4, range: 3000, armAgl: 60, steer: 34, life: 20, holdRateDeg: 7 },   // v152: armed inside 3 km (was 2.6)
    // v152: the attack's cues. The target marker from `markR` out (the whole pop-up, the valley's
    // exit and the bowl); RELEASE while the laser is locked, the slant range inside [slantMin,
    // slantMax] and the dive between diveMin and diveMax degrees; the pull-up cue under `pullSlant`
    // in the dive, or once the last bomb he means to drop is away
    attack: { markR: 4000, slantMin: 450, slantMax: 1000, diveMin: 20, diveMax: 60, pullSlant: 430 },
    ventR: 1.5,                  // the vent's hit radius: "a target three metres wide"
    cruiseMissiles: { count: 5, speed: 280, alt: 420, delay: 1.2, gap: 0.5, at: 0.4 },   // `at`: their target, this fraction of the way up the valley
    start: { back: 160, agl: 22 },
    // v148: the plant goes in stacked bursts (seconds after the hit, height over the vent,
    // size), a column that climbs `columnFor` seconds, `debris` thrown out, and a snow
    // cloud rolling out across the bowl floor at `surge` m/s for `surgeFor` seconds.
    plant: { bursts: [[0.35, 18, 4], [0.8, 40, 4.5], [1.3, 70, 5], [1.9, 105, 4]], columnFor: 30, debris: 28, surge: 55, surgeFor: 9 },
    escape: 12,                  // seconds he must live after the plant goes, with nothing close behind, to be out
    results: { hold: 2.5 },      // seconds of the aftermath before the card
  },

  vehicles: {
    prop:             { cruiseSpeed: 60, turnRateDeg: 18, pitchLimitDeg: 30, bankLimitDeg: 45, accel: 16, capped: true, size: 1.0, hasGear: true },
    helicopter:       { cruiseSpeed: 90, turnRateDeg: 55, pitchLimitDeg: 22, bankLimitDeg: 26, accel: 10, capped: true, size: 1.05, hasGear: false, heli: true },   // its own model: TUNE.heli
    rocket:           { cruiseSpeed: 112, turnRateDeg: 8, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.1, hasGear: false, hidden: false, rocket: true },
    starship:         { cruiseSpeed: 112, turnRateDeg: 7, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.25, hasGear: false, hidden: false, rocket: true, starship: true },
    heavy:            { cruiseSpeed: 112, turnRateDeg: 8, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.5, hasGear: false, hidden: false, rocket: true, heavy: true },   // v142: the launch site's rocket (heavy.js)
    airlinerDelta:    { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    airlinerEmirates: { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    fighter:          { cruiseSpeed: 95, turnRateDeg: 22, pitchLimitDeg: 38, bankLimitDeg: 50, accel: 22, capped: true, size: 1.25, hasGear: true },
    car:              { cruiseSpeed: 46, turnRateDeg: 34, pitchLimitDeg: 10, bankLimitDeg: 8, accel: 11, capped: true, size: 1.0, hasGear: false, car: true },  // its own model: TUNE.car
    cybertruck:       { cruiseSpeed: 46, turnRateDeg: 34, pitchLimitDeg: 10, bankLimitDeg: 8, accel: 11, capped: true, size: 1.0, hasGear: false, car: true, cybertruck: true },  // v146: drives AS the car (car.js, TUNE.car); only its body is its own
    monster:          { cruiseSpeed: 24, turnRateDeg: 70, pitchLimitDeg: 40, bankLimitDeg: 8, accel: 9, capped: true, size: 1.0, hasGear: false, monster: true },  // its own model and rules: TUNE.monster
    sled:             { cruiseSpeed: 120, turnRateDeg: 0, pitchLimitDeg: 0, bankLimitDeg: 0, accel: 40, capped: true, size: 1.0, hasGear: false, sledRide: true },  // v144: the set-piece's rail and run (sledride.js, TUNE.sledRide)
    crane:            { cruiseSpeed: 1, turnRateDeg: 34, pitchLimitDeg: 0, bankLimitDeg: 0, accel: 0, capped: true, size: 1.0, hasGear: false, crane: true },  // v145: parked for good; its own rules (crane.js, TUNE.crane); cruiseSpeed is nominal, it never moves
    speedboat:        { cruiseSpeed: 42, turnRateDeg: 46, pitchLimitDeg: 12, bankLimitDeg: 18, accel: 16, capped: true, size: 1.0, hasGear: false, boat: true },  // its own model: TUNE.boat
    // Stage 2. Shelved from TUNE alone, so the card exists and does not render,
    // and the model rig can still inspect the hull before it ships.
    yacht:            { cruiseSpeed: 17, turnRateDeg: 9,  pitchLimitDeg: 6,  bankLimitDeg: 6,  accel: 3,  capped: true, size: 1.0, hasGear: false, boat: true, bigBoat: true }
  },

  vehicleColors: {
    prop:             ["#e0483e", "#f2f4f7"],
    helicopter:       ["#20a39e", "#f2f4f7"],
    car:              ["#4a4f55", "#c9ced6"],   // stealth grey; no badge, no wordmark
    cybertruck:       ["#8a93a0", "#c9ced6"],   // v146: brushed steel; no badge, no wordmark
    monster:          ["#2b6fd1", "#ffd23e"],   // the set-piece truck's blue and yellow
    sled:             ["#e0483e", "#ffd23e"],   // the set-piece sled's red and yellow
    crane:            ["#ffd23e", "#1f2328"],   // the crane's yellow and its ball's black
    rocket:           ["#b8bec9", "#d71920"],
    starship:         ["#c9ced6", "#1f2328"],
    heavy:            ["#f2f4f7", "#e0483e"],
    airlinerDelta:    ["#0b4ea2", "#d0342c"],
    airlinerEmirates: ["#c9a227", "#d71920"],
    fighter:          ["#6b7280", "#e0483e"],
    speedboat:        ["#f2f4f7", "#e0483e"],
    yacht:            ["#f2f4f7", "#d9c27e"]
  }
};

const DEG = Math.PI / 180;
