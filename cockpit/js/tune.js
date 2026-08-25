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

  colorLow: 0x7cbf58,
  colorMid: 0x67a34e,
  colorHigh: 0xa8a06b,
  colorLowHeight: -4,
  colorHighHeight: 10,
  colorJitter: 0.06,

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
  ringStartAltitude: 230,
  ringRadius: 26,
  ringPulseRate: 2.2,
  touchdownLatTolMult: 3.5,
  touchdownHeadingTolDeg: 30,
  touchdownClearance: 2.6,
  climbAwayPitchDeg: 14,
  climbAwayTime: 3.0,
  climbAwayBankCapDeg: 10,

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
  homeIndicatorSize: 48,

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

  explodeDescentRate: 26,
  explodeAngleDeg: 20,
  explodeBuildingSpeed: 34,
  debrisCount: 26,
  reassembleDelay: 2.0,

  vehicles: {
    prop:             { cruiseSpeed: 60, turnRateDeg: 18, pitchLimitDeg: 30, bankLimitDeg: 45, accel: 16, hoverSpeed: 0, capped: true, size: 1.0, hasGear: true },
    helicopter:       { cruiseSpeed: 30, turnRateDeg: 27, pitchLimitDeg: 22, bankLimitDeg: 35, accel: 10, hoverSpeed: 6, capped: true, size: 1.05, hasGear: false, hidden: true },
    rocket:           { cruiseSpeed: 112, turnRateDeg: 8, pitchLimitDeg: 48, bankLimitDeg: 40, accel: 26, hoverSpeed: 0, capped: false, size: 1.1, hasGear: false, hidden: true },
    airlinerDelta:    { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, hoverSpeed: 0, capped: true, size: 1.85, hasGear: true },
    airlinerJetblue:  { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, hoverSpeed: 0, capped: true, size: 1.85, hasGear: true },
    airlinerEmirates: { cruiseSpeed: 54, turnRateDeg: 9, pitchLimitDeg: 25, bankLimitDeg: 38, accel: 12, hoverSpeed: 0, capped: true, size: 1.85, hasGear: true },
    fighter:          { cruiseSpeed: 95, turnRateDeg: 22, pitchLimitDeg: 38, bankLimitDeg: 50, accel: 22, hoverSpeed: 0, capped: true, size: 1.25, hasGear: true }
  },

  vehicleColors: {
    prop:             ["#e0483e", "#f2f4f7"],
    helicopter:       ["#20a39e", "#f2f4f7"],
    rocket:           ["#b8bec9", "#d71920"],
    airlinerDelta:    ["#0b4ea2", "#d0342c"],
    airlinerJetblue:  ["#1c75bc", "#e8edf4"],
    airlinerEmirates: ["#c9a227", "#d71920"],
    fighter:          ["#6b7280", "#e0483e"]
  }
};

const DEG = Math.PI / 180;
