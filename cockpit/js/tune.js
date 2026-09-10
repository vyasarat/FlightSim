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

  fogNear: 700,
  fogFar: 1450,
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
    sunElevDeg: 44, sunAzimDeg: 133,   // a real angle: shadows fall across the runway, not down it
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
    engine: 1.0, rocket: 1.0, event: 1.0, bed: 1.0,
    // The ambient bed, one per place he can be. `cut` is the lowpass corner in
    // Hz -- low is a rumble, high is a hiss.
    beds: {
      ground:   { gain: 0.030, cut:  380, thumpRate: 0,   thump: 0 },
      car:      { gain: 0.055, cut:  900, thumpRate: 0,   thump: 0 },    // tyres and wind, not an engine
      wind:     { gain: 0.085, cut: 1400, thumpRate: 0,   thump: 0 },   // aloft, and it grows with speed
      heli:     { gain: 0.115, cut:  520, thumpRate: 12,  thump: 0.55 }, // rotor wash: a beat, not a drone
      airliner: { gain: 0.070, cut:  240, thumpRate: 0,   thump: 0 },    // cabin hum
      space:    { gain: 0.016, cut:  120, thumpRate: 0.28, thump: 0.8 }, // near silence, breathing
      mars:     { gain: 0.055, cut:  700, thumpRate: 0.5, thump: 0.35 }, // thin dust wind
      moon:     { gain: 0.006, cut:  100, thumpRate: 0,   thump: 0 },    // no air: almost nothing
    },
    bedBlend: 1.4,               // how fast one bed crossfades into another
    windFromSpeed: 0.55,         // how much of the wind bed comes from airspeed
    windFromAlt: [60, 900],      // ... and how much from being high up
    // Positional sound: how far away before it is inaudible, and how wide the pan
    falloff: 900, panWidth: 260,
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
    fighter: { file: "models/fighter.glb", length: 16.0, yaw: Math.PI, lift: 0, burner: true },   // tail-first; `burner`: find the nozzle and light it
    // The two hulls (scripts/build_boats.js). `lift` sits the waterline where
    // the game's waterline is: an imported hull stands on its keel, and the game
    // places every body with its lowest point on the surface, so without a lift
    // the whole boat floats on top of the sea like a bath toy.
    // `yaw`: this hull arrives bow-at-+Z, and the rig's own taper test says so.
    // `lift`: measured, not guessed. A model's lowest point is its PROPELLERS,
    // more than a metre below the keel, so sitting "the bottom" on the waterline
    // left the whole boat standing clear of the sea on its drives.
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
    route: [
      [6200, 105], [5900, 100], [5200, 180], [4200, 380], [3300, 150], [2400, 250],
      [1800, 330], [900, 360], [0, 300], [-1080, 250], [-1500, 240], [-2400, 200],
      [-3330, 120], [-3800, 60], [-4520, -170], [-4920, -250], [-5400, -300], [-6200, -280],
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
    dashEvery: 4,                // centreline dashes, every N samples
    tunnelR: 26, tunnelSeg: 2,
    // Exits: s is 0..1 along the road. `icon` picks the board silhouette.
    exits: [
      { s: 0.10, side: 1, icon: "plane", to: "nyAirport" },
      { s: 0.22, side: -1, icon: "tower", to: "demolition" },
      { s: 0.38, side: 1, icon: "wave", to: "lake" },
      { s: 0.55, side: -1, icon: "tower", to: "midPlains", charge: true },
      { s: 0.72, side: 1, icon: "wave", to: "desert", charge: true },
      { s: 0.90, side: -1, icon: "plane", to: "caAirport" },
    ],
    spurLen: 320, spurW: 16, spurCapture: 3.2,   // spur capture radius, in road widths
    spurDescend: 0.55,           // fraction of the spur spent coming down from the deck to
                                 // the ground. Without it the blend is smoothstep(0, undefined)
                                 // and every road vertex becomes NaN.
    boardH: 16, boardW: 22,
    charge: { stalls: 4, canopyW: 34, canopyD: 22, canopyH: 9, pulse: 2.2, seconds: 10 },
    interchange: { at: [0.045, 0.955], ramps: 4, r: 150, rise: 26, deckT: 2.2, pillarR: 3.4 },
    traffic: { count: 70, range: 1800, keepOut: 260, follow: 90, speed: [49, 64], truckEvery: 4, respawn: 2.5 },
                                 // above TUNE.car.cruise on purpose: lane-keep with no
                                 // steering must never rear-end its own lane
  },

  // ---- The car (js/car.js). A stealth-grey electric SUV: the silhouette, the
  // paint, the glass roof and the light bar, and nothing else -- no badge, no
  // wordmark, same rule as the airline liveries.
  car: {
    cruise: 46,                  // set from the road length for a ~4.5 minute crossing
    accel: 11, brake: 16, offRoadMax: 0.45,
    boost: 1.5, boostTime: 2.2,  // drag up: an EV's instant shove
    steerRate: 34,               // degrees per second at full lock
    steerAccel: 5,
    // Lane keep: the whole point. He holds a finger down and the car drives
    // itself coast to coast; steering overrides it, and letting go hands it back.
    // Pure pursuit, not closest-point. A proportional controller on the nearest
    // point lags on every curve, and on this road the lag grew past a lane width
    // and walked him across the median. Aiming at a point a second and a half
    // ahead, on the lane he is nearest, holds the line through anything.
    laneKeep: { lookAhead: 1.5, minAhead: 30, gain: 3.4, offRoadGain: 1.4, override: 0.75 },
                                 // `override`: how much stick fully overrides the assist
    onRoadHalf: 24,              // this far from the centreline still counts as on the road
    // Leaving the road must be a slope, not a cliff, and a step in the deck must
    // be taken at once. He drove underground without all three of these.
    shoulderBlend: 26,           // metres of ramp between the deck and the ground
    suspension: 7,               // how fast he settles when the ground falls away
    settleMax: 1.2,              // a drop bigger than this is a step, not a crest
    railAt: 4,                   // a deck this high above the ground has a rail that holds him
    crashSpeed: 18,              // below this a contact is a bump, not a bang
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
    whineHz: [55, 320], tyreGain: 0.05, windGain: 0.06,
  },

  // ---- The palette. Every colour in the game snaps to one of these unless it
  // is a livery (airliners keep their own) or a signal lamp. This is not a new
  // scheme -- each one was already the dominant value for its role; the job was
  // pulling 238 near-duplicate literals down onto them, so a dome and the dune
  // behind it are no longer two different greys that were never meant to differ.
  palette: {
    white:    0xf2f4f7, steel:  0xc9ced6, grey:      0x8a93a0, slate: 0x3c4350,
    ink:      0x1f2328, night:  0x2f3a48, concrete:  0x9a9ea6,
    grassLow: 0x7cbf58, grassMid: 0x67a34e, grassHigh: 0xa8a06b, sand: 0xd9c27e,
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

  engineFreqIdle: 46,
  engineFreqMax: 84,
  engineGainIdle: 0.03,
  engineGainMax: 0.095,
  engineFilterFreq: 300,
  engineLfoRate: 9,
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
      entryR: 34, duration: 8, repeatDelay: 3, bubbles: 56, openOffset: 90 },
    welcome: { duration: 5, clearance: 58, hornRange: 240, replyDelay: 0.45, cooldown: 2.5 },
    trails: { capacity: 1200, life: 36, every: 0.055, size: 8,
      cloudR: 54, cloudY: 105, cloudZ: 380, cloudSide: 120, gap: 210, rainbowR: 76 },
  },

  heli: {
    cruise: 90, approach: 1.1,     // speed eases off with the distance left to run
    hoverAgl: 26,                   // initial takeoff height for a destination tap
    landingBrakeH: 24,              // slow horizontal travel on the last metres of a descent
    arriveDist: 4,                  // stop and clear the destination inside this radius
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
    pickRange: 3000, pickStep: 30,  // how far it looks for what he touched, and how finely
    // A shallow ray grazes the crest in front of him and dips under the ground for
    // a moment before coming out the other side. Taken at face value that put the
    // target forty metres away when he was pointing at the sea a kilometre off --
    // so he stopped, or landed, on the field instead of setting out over the water.
    // A crossing only counts if the ray STAYS under for this many more steps.
    grazeSteps: 6, grazeMargin: 4,   // ... and only if it comes back out by a real margin:
                                    // meeting a flat sea almost edge-on re-emerges by centimetres,
                                    // and that is a genuine arrival, not a graze
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
    engineHz: [70, 400], slapGain: 0.05,
    // The water cannon. `cannonAim` is the dot product the bow has to reach for
    // the water to be going anywhere near the fire -- about 40 degrees of slop,
    // which is a lot, because he is four.
    // `cannonRadius` is where the BUTTON appears -- far enough out that he can
    // see it and drive in. `cannonReach` (+ slack) is how close the water
    // actually gets there, so the button is an invitation and the arc is honest.
    cannonRadius: 260, cannonReach: 90, cannonSlack: 25, cannonPuffs: 4,
    cannonAim: 0.76, cannonSheet: 1.6,
    camChase: [22, 8], camLag: 5,
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
    engineHz: [30, 52], hullGain: 0.045,
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
    groundR: 420,                   // a rust floor laid over the planet under the base: the sphere
                                    // itself shades out almost white this close up
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
      kick: 3.2, kickPerSpeed: 0.42,  // how hard it throws him (~4 s of Mars air)
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
      // And the boat, for the same reason the car needed an entry: without one
      // `ejectStart` returns false and the button sits there doing nothing.
      // `roof` is measured from the MODEL's origin, which for a boat sits a
      // gearHeight below the waterline, so the open cockpit at 1.0 m above the
      // sea is 3.6 m above the origin. It comes down under a canopy on its own
      // life raft, which the seat has always carried.
      speedboat: { opening: 1, hatch: 'panel', seat: 'spring', front: 0.5, roof: 3.6, color: 0xe0483e }
    }
  },

  vehicles: {
    prop:             { cruiseSpeed: 60, turnRateDeg: 18, pitchLimitDeg: 30, bankLimitDeg: 45, accel: 16, capped: true, size: 1.0, hasGear: true },
    helicopter:       { cruiseSpeed: 90, turnRateDeg: 55, pitchLimitDeg: 22, bankLimitDeg: 26, accel: 10, capped: true, size: 1.05, hasGear: false, heli: true },   // its own model: TUNE.heli
    rocket:           { cruiseSpeed: 112, turnRateDeg: 8, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.1, hasGear: false, hidden: false, rocket: true },
    starship:         { cruiseSpeed: 112, turnRateDeg: 7, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.25, hasGear: false, hidden: false, rocket: true, starship: true },
    airlinerDelta:    { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    airlinerJetblue:  { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    airlinerEmirates: { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    fighter:          { cruiseSpeed: 95, turnRateDeg: 22, pitchLimitDeg: 38, bankLimitDeg: 50, accel: 22, capped: true, size: 1.25, hasGear: true },
    car:              { cruiseSpeed: 46, turnRateDeg: 34, pitchLimitDeg: 10, bankLimitDeg: 8, accel: 11, capped: true, size: 1.0, hasGear: false, car: true },  // its own model: TUNE.car
    speedboat:        { cruiseSpeed: 42, turnRateDeg: 46, pitchLimitDeg: 12, bankLimitDeg: 18, accel: 16, capped: true, size: 1.0, hasGear: false, boat: true },  // its own model: TUNE.boat
    // Stage 2. Shelved from TUNE alone, so the card exists and does not render,
    // and the model rig can still inspect the hull before it ships.
    yacht:            { cruiseSpeed: 17, turnRateDeg: 9,  pitchLimitDeg: 6,  bankLimitDeg: 6,  accel: 3,  capped: true, size: 1.0, hasGear: false, boat: true, bigBoat: true }
  },

  vehicleColors: {
    prop:             ["#e0483e", "#f2f4f7"],
    helicopter:       ["#20a39e", "#f2f4f7"],
    car:              ["#4a4f55", "#c9ced6"],   // stealth grey; no badge, no wordmark
    rocket:           ["#b8bec9", "#d71920"],
    starship:         ["#c9ced6", "#1f2328"],
    airlinerDelta:    ["#0b4ea2", "#d0342c"],
    airlinerJetblue:  ["#1c75bc", "#e8edf4"],
    airlinerEmirates: ["#c9a227", "#d71920"],
    fighter:          ["#6b7280", "#e0483e"],
    speedboat:        ["#f2f4f7", "#e0483e"],
    yacht:            ["#f2f4f7", "#d9c27e"]
  }
};

const DEG = Math.PI / 180;
