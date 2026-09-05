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

  // The helicopter's own model (js/heli.js). Tuned against the plane's feel:
  // immediate but smoothed, nothing to fight, and hovering is the safe state.
  // One finger, and the stick means exactly what it means in the plane -- drag up
  // to go up. A finger on the screen flies it forward; taking the finger off stops
  // it and holds the height. Deliberate and heavy, never darty.
  // Point-to-go. He touches a place and it goes there -- a stick cannot say
  // "up and forward and round" at once to a four-year-old, but a finger on the
  // fire can. One finger, always; letting go is always a hover.
  heli: {
    cruise: 36, approach: 0.55,     // speed eases off with the distance left to run
    hoverAgl: 26,                   // it hovers this high over the spot he touched
    landRadius: 34,                 // ... but settles onto one this close, instead of hovering
    arriveDist: 60,                 // "there" for the purposes of arriving
    turnRate: 35, turnAccel: 3.0, yawGain: 2.2, bankDeg: 22,
    edgeYawBand: 0.18, edgeYawRate: 34,   // a finger at the screen edge spins it round
    climb: 12, maxSink: 6, vAccel: 2.2, vGain: 0.5,
    liftKick: 2.0,                  // on the ground, any touch gets it off the deck
    accel: 2.0, hoverDamp: 3.0,     // finger off: stopped in about a second
    levelRate: 2.5, noseDeg: 10,
    jobRadius: 120, jobBrake: 3.5,  // by the fire or its water it settles for him. This has to
                                    // sit INSIDE firefight.dropR, or the assist stops him too far
                                    // out to do the job it stopped him for.
    waterFloor: 5,                  // it hovers this far over the sea and never sets down on it
                                    // (sitting on the water would end the flight and hide the bucket)
    stopBelow: 0.4,
    pickRange: 3000, pickStep: 30,  // how far it looks for what he touched, and how finely
    // A shallow ray grazes the crest in front of him and dips under the ground for
    // a moment before coming out the other side. Taken at face value that put the
    // target forty metres away when he was pointing at the sea a kilometre off --
    // so he stopped, or landed, on the field instead of setting out over the water.
    // A crossing only counts if the ray STAYS under for this many more steps.
    // Nothing in this game is ever stuck. If he is holding a finger on somewhere
    // far off and the helicopter is not actually getting there, it stops trying to
    // be clever and simply flies at it.
    stallTime: 2.0, stallSpeed: 3,
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
  firefight: {                      // the burning rig off the coast, and the water bucket
    rig: { x: -550, z: -6900 },     // just off the coast: about 35 s in the helicopter, on open
                                    // water clear of the approach corridor, the pad, the recovery
                                    // fleet and the carrier
    deckY: 26, legH: 30,            // the platform stands this high on its legs
    flames: 9, flameH: 22, flicker: 7,
    smokePuffs: 26, smokeH: 300, smokeRise: 26, smokeSize: 20,   // the column, seen from a long way off
    scoopAlt: 40,                   // this low over open water and the bucket can go down
    scoopRadius: 400,               // ... and only this near the rig does the helicopter brake for
                                    // it. Open sea further out is just sea: it flies straight over
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

  vehicles: {
    prop:             { cruiseSpeed: 60, turnRateDeg: 18, pitchLimitDeg: 30, bankLimitDeg: 45, accel: 16, capped: true, size: 1.0, hasGear: true },
    helicopter:       { cruiseSpeed: 36, turnRateDeg: 55, pitchLimitDeg: 22, bankLimitDeg: 26, accel: 10, capped: true, size: 1.05, hasGear: false, heli: true },   // its own model: TUNE.heli
    rocket:           { cruiseSpeed: 112, turnRateDeg: 8, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.1, hasGear: false, hidden: false, rocket: true },
    starship:         { cruiseSpeed: 112, turnRateDeg: 7, pitchLimitDeg: 90, bankLimitDeg: 40, accel: 26, capped: false, size: 1.25, hasGear: false, hidden: false, rocket: true, starship: true },
    airlinerDelta:    { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    airlinerJetblue:  { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    airlinerEmirates: { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, capped: true, size: 1.85, hasGear: true },
    fighter:          { cruiseSpeed: 95, turnRateDeg: 22, pitchLimitDeg: 38, bankLimitDeg: 50, accel: 22, capped: true, size: 1.25, hasGear: true }
  },

  vehicleColors: {
    prop:             ["#e0483e", "#f2f4f7"],
    helicopter:       ["#20a39e", "#f2f4f7"],
    rocket:           ["#b8bec9", "#d71920"],
    starship:         ["#c9ced6", "#1f2328"],
    airlinerDelta:    ["#0b4ea2", "#d0342c"],
    airlinerJetblue:  ["#1c75bc", "#e8edf4"],
    airlinerEmirates: ["#c9a227", "#d71920"],
    fighter:          ["#6b7280", "#e0483e"]
  }
};

const DEG = Math.PI / 180;
