"use strict";
// ---------------------------------------------------------------------------
// THE LEAVING MATRIX (Track B, step 1): every mode he can be in x every way out
// of it, and what each way out leaves behind.
//
// Modelled on solidity_checks.js. The bug class behind REVIEW.md's Track B is
// one shape: he LEAVES something -- picks another vehicle, ejects, relaunches,
// bangs, starts a race, takes the globe, takes the mode's own way out, or is
// simply switched to a fresh start -- and a piece of what he left stays: a tone
// droning on, a numeral nothing is counting, a button for a state he is no
// longer in, a model left hidden (or left drawn). This asks all of them about
// all of them, and PRINTS THE MATRIX.
//
// ROWS are the modes: every row of VEHICLE_CONTRACT (vehicles.js) -- a check
// holds the table to the contract, so a new row with no matrix row is red --
// put in a state where its probes have something to see (a plane in a dive has
// its whistle up, a car at speed its tyres, the sled and the crane mid-count a
// numeral), plus the modes that are not contract rows (the toy track, a police
// pull-over, a demolition counting over a plane, a car in London) and the seat
// view of the three vehicles that have a scene-level seat (the car's cabin, the
// boat's helm, the yacht's bridge). Each row PROVES it arrived (its vehKind()
// and its own state: docked, racing, counting, on the rail ...); a setup that
// did not arrive is a failure, never a pass.
//
// COLUMNS are the exits. Whether an exit is OFFERED is ASKED OF THE GAME in
// that state -- the button's own when() in buttons.js, eject.js's own control,
// the contract's vehSolid() -- never a table here; the SET of cells it does not
// offer is pinned (NA_PIN), so an exit hidden or newly offered turns it red.
//   picker    the menu (or picker) button, a different card, the direction card
//   eject     ejectStart, judged by audit_eject.js's verdict
//   bang      him, at cruise, inside the nearest solid that blocks his class:
//             the one wall law's own crash, and its free reassembly
//   race      the flag and a track card;  globe  the globe and the other city
//   relaunch  the choice made through the game's own cards (and globe), the page
//             RELOADED, the storage the game wrote carried across the harness's
//             wipe, lpRestoreChoice -- and then he carries on through the cards
//   own       the mode's own way out where the game has one (the race's exit,
//             dad mode's exit; vehicles.js: "the way out is its own EXIT")
//   switch    a fresh start from the mode: what every cell's clean start does
//             (dad mode's own exit if he is in it, applyVehicle, spawnForTakeoff)
// Each exit must be SEEN TO HAPPEN; one that did not is a failure of its own.
//
// THE FOUR LEFTOVERS, each named by WHAT is left (a tone's name, a button's id,
// a model part), read once things have settled (SETTLE frames) -- for the
// picker, the eject and the bang also DURING (behind the cards; under the
// canopy; in pieces, frame by frame from the bang to the reassembly), and the
// reading must have been taken -- and read again at the NEXT clean start (what
// an exit leaves for whatever he does next), and for a relaunch after he
// carries on:
//   T  a tone above zero that nothing owns. Every voice writer is stamped; a
//      voice up and not written for HOLD frames is HELD -- setTone keeps its last
//      gain for ever (audio.js:298), so up and unwritten is left over by
//      definition. A VEHICLE tone is up only in its vehicle (TONE_OWNER, each
//      from its setTone call site). A SOURCE tone (a siren, a set-piece's roar)
//      is owned while it is written AND its source is running (SOURCE_STATE:
//      the police active, the set-piece out of "armed"). The remaining world
//      tones (the harbour crane, the sea plane, the per-launch events, rain)
//      are scaled by distance by their writer every frame: owned while written
//      -- a tone of those that follows him after he has left by a jump is NOT
//      judged here. The engine is engKeyFor()'s and must be written; the
//      ambient bed is the room. Every page's audio context must be running
//      before a T reading counts.
//   N  a numeral on the screen (any visible digit outside the altimeter's, the
//      parent's v138 exception): #bigNum only while one of its writers
//      (COUNTERS, one per file that writes it) says it is counting, and it must
//      TICK; the race's HUD in a race, dad's HUD in dad mode.
//   B  a stray button: visible while its own when() in buttons.js, computed
//      fresh, says not; or visible and not declared in buttons.js. (The two
//      `null` when()s -- ejectBtn, magnetBtn -- are their modules' own.)
//   M  a hidden model: one player vehicle; his drawn (chase view, or the three
//      drawn from their own seats); nothing of a mode he LEFT still drawn.
//
// KNOWN names each leftover that is there today, with the QUEUE id that will fix
// it (or "new: ..."). The failing set must EQUAL KNOWN: a second, different
// leftover in a known cell is red, and a known one that has gone is red ("fixed:
// remove from KNOWN"). A throw, or a page whose audio did not start, is never
// excusable.
//
// THE CLEAN START IS SEEN TO TAKE: after it he is the parked prop, nothing up,
// and every mode a row uses is off (race, toy track, police, dad, the station,
// the rover, the drone, sled, crane, monster, heli, boat, car) -- a miss is
// "fresh start did not take", never excusable. What only the harness's hand
// clears is RECORDED as the last exit's leftover first (a card screen still up,
// a rescue still running, him still in pieces); the demolition is re-armed
// after the reading. LIMIT, stated: the shattered pieces are put back by hand
// (the game restores them on its own clock, which a 2 s settle may not reach).
// After the picker, a race, the globe and the mode's own exit, "happened" also
// asks that the mode he LEFT is off; the eject and the bang give him his mode
// back by design.
//
// Portrait (820x1180) runs every exit; landscape (1180x820) the switch, the
// picker and the eject. One page per row and orientation; the state each cell
// starts from is the clean start that judged the cell before it.
// ---------------------------------------------------------------------------
const fs = require("fs"), path = require("path");
const EJ = require("./audit_eject.js");   // (v215) an eject is seen to run, not taken on its word

const SETTLE = 120;     // frames after an exit before the leftovers are read (2 s)
const HOLD = 10;        // a tone not written for this many frames is being held, not driven
const FROZEN = 75;      // a numeral unchanged this long (1.25 s; a count ticks every 1 s) is not being counted
const CLEAN = 40;       // frames of the clean start before its reading
const MID_EXITS = ["picker", "eject", "bang"];

// ---- the rows. kind: what vehKind() must say. card/dir/dest/city: the choice he makes through the game's own
// cards before a relaunch. exits: the columns this row runs (default every one).
const SEAT_EXITS = ["switch", "picker", "eject"];
const MODES = [
  { id: "plane",       kind: "plane",      card: "prop",        say: "the prop in a dive (its whistle up)" },
  { id: "planeParked", kind: "plane",      card: "prop",        say: "the prop parked on the runway (the picker button and the globe)" },
  { id: "planeDemo",   kind: "plane",      card: "prop",        say: "the prop over the demolition, counting" },
  { id: "heli",        kind: "heli",       card: "helicopter",  say: "the helicopter flying" },
  { id: "car",         kind: "car",        card: "car",         say: "the SUV at speed on the motorway (tyres up)" },
  { id: "carSeat",     kind: "car",        card: "car",         say: "the SUV at speed, from the driving seat (its cabin drawn)", exits: SEAT_EXITS },
  { id: "cybertruck",  kind: "cybertruck", card: "cybertruck",  say: "the Cybertruck at speed" },
  { id: "corvette",    kind: "corvette",   card: "corvette",    say: "the Corvette on its booster (its roar up)" },
  { id: "police",      kind: "car",        card: "car",         say: "the SUV pulled over by the police (their count up)" },
  { id: "london",      kind: "car",        card: "car", city: "ldn", say: "the SUV parked in London (the globe back)" },
  { id: "track",       kind: "car",        card: "car",         say: "the SUV on the giant toy track, off the lift (its rattle up)" },
  { id: "race",        kind: "race",       card: "car",         say: "a race under way" },
  { id: "monster",     kind: "monster",    card: "monster",     say: "the monster truck in the arena" },
  { id: "sled",        kind: "sled",       card: "sled",        say: "the rocket sled mid-count" },
  { id: "crane",       kind: "crane",      card: "crane",       say: "the crane mid-count" },
  { id: "boat",        kind: "boat",       card: "speedboat",   say: "the speedboat under way (its hull up)" },
  { id: "boatSeat",    kind: "boat",       card: "speedboat",   say: "the speedboat under way, from the helm", exits: SEAT_EXITS },
  { id: "yacht",       kind: "yacht",      card: "yacht",       say: "the yacht under way (her hull up)" },
  { id: "yachtSeat",   kind: "yacht",      card: "yacht",       say: "the yacht under way, from her bridge", exits: SEAT_EXITS },
  { id: "rocket",      kind: "rocket",     card: "rocket",      say: "the rocket climbing (its roar up)" },
  { id: "rover",       kind: "rover",      card: "rocket", dest: "moon",    say: "the rover driving on the Moon" },
  { id: "drone",       kind: "drone",      card: "starship", dest: "mars",  say: "the drone flying on Mars" },
  { id: "astro",       kind: "astro",      card: "rocket", dest: "station", say: "the astronaut in the station" },
  { id: "dad",         kind: "dad",        card: "prop",        say: "dad mode's Canyon Strike (the parent's)" },
];
// each row's OWN voice, which the before-reading must hear (else "no tone after" means nothing); a row with
// none says why in NO_OWN_TONE
const OWN_TONE = {
  plane: "tone:dive", planeDemo: "tone:demo", heli: "engine:heli", car: "tone:carTyre", carSeat: "tone:carTyre",
  cybertruck: "tone:carTyre", corvette: "tone:cvRoar", police: "tone:policeSiren", track: "tone:trkRattle", race: "tone:raceCrowd",
  monster: "engine:car", sled: "tone:sledRoar", crane: "tone:crRumble", boat: "tone:boatHull", boatSeat: "tone:boatHull",
  yacht: "tone:yachtHull", yachtSeat: "tone:yachtHull", rocket: "rocket", rover: "tone:rover", drone: "tone:rover", astro: "tone:fans",
  dad: "engine:jet",
};
const NO_OWN_TONE = {
  planeParked: "parked and still: the engine voice is at its floor (engines.js engUpdate: out 0.0002 under level 0.015) and nothing else of the plane sounds",
  london: "parked and still in the car: no tyres (car.js:1190 needs speed > 2), the engine at its floor",
};
// contract rows with no matrix row, and why (none today: the check below turns a new contract row red)
const LEFT_OUT = {};
const EXITS = ["switch", "picker", "eject", "bang", "race", "globe", "own", "relaunch"];
const LANDSCAPE_EXITS = ["switch", "picker", "eject"];
const KINDS = ["tone", "numeral", "button", "model"];
const KLETTER = { tone: "T", numeral: "N", button: "B", model: "M" };
const PORTRAIT = [820, 1180], LANDSCAPE = [1180, 820];
const exitsOf = (m, orient) => (m.exits || EXITS).filter(x => (orient === "portrait" ? EXITS : LANDSCAPE_EXITS).includes(x));

// Every tone the game names, and who owns it, from its setTone call site (the classification check holds this to
// the source: a name in neither list is red).
const TONE_OWNER = {
  stall: "plane", dive: "plane",                         // flight.js:357-363
  boatHull: "boat", boatCannon: "boat",                  // boat.js:190, :446, :497
  carTyre: "car*",                                       // car.js:860, :1190 (every car: vehIsCar)
  cvRoar: "booster",                                     // corvette.js:116 (vehBooster)
  yachtHull: "yacht",                                    // yacht.js:248, :578
  rover: "rover|drone",                                  // rover.js:361, marsbase.js:983 (the drone uses it too)
  srBurst: "sled",                                       // sledride.js:108
  crRumble: "crane", crHum: "crane",                     // crane.js:183-336 (its lot is drawn only while he is in it)
  trkRattle: "track", trkWhir: "track",                  // track.js:751-1124
  fans: "astro",                                         // station.js:240-538
  raceCrowd: "race",                                     // race.js:1393, :2581 (+ the surfaces' tones, TUNE.race.surfaces[].tone)
  dad: "dad",                                            // dadmode.js, dad_*.js: every name starting "dad"
};
// a world tone with a source that is running or not: owned only while it is (asked in the page, SOURCE_STATE)
const SOURCE_TONES = ["policeSiren", "policeSirenB", "demo", "lsRoar", "lsRoar2", "sledRoar"];
// world tones their writer scales by his distance every frame: owned while written (see the header)
const DISTANCE_TONES = ["hbCrane", "seaPlane", "evRace", "evComet", "mtRoar"];   // (mtRoar: the arena truck idles, heard by distance, monstertruck.js:503)
// Every file that writes the big numeral (countdownTo / setBigNum); its "am I counting?" is asked in the page
const COUNTER_FILES = ["crane.js", "fireworksbarge.js", "launchsite.js", "monstertruck.js", "rocketsled.js", "lock.js",
                       "police.js", "marsbase.js", "race.js", "setpieces.js"];

// ---- what is left today. Key: "<mode>/<exit>[<point>]/<kind>/<what>", optionally "<orientation>:" first.
// <point>: "" after the exit, ":mid" during it, ":next" at the next clean start, ":on" after he carries on.
// <kind>: tone | numeral | button | model, or "ran" (the exit did not happen / the mode was not reached / the
// during-reading was not taken), with <what> the leftover's name or the reason.
// (Q-3, fixed in v217: the picker's hold quiets his vehicle's motion voices -- audio.js audioHoldStill, checked in engine_sound_checks)
const HUD7 = "HUD-7 (B3/B5): the bang branch never calls engUpdate -- the engine voice holds its pre-crash level through the bang (flight.js:405-460)";
const Q6 = "Q-6 (B3): the bang branch never calls btnUpdateAll -- the buttons of before the bang stay up in pieces (flight.js:405-460)";
const RACE_TYRE = "Q-16 (new): a race started from a car at speed keeps the car's tyre tone at its last gain for the whole race -- rcStartRace (race.js:1297-1345) silences the horn, the police and its own tones, not carTyre, and its only writer, updateCar (car.js:1190), does not run in a race (vehicles.js:172)";
const DEAD_EJECT = "Q-15 (new): the eject button is offered (eject.js:29-31 updateEjectControl does not exclude it) but ejectStart refuses -- no TUNE.eject.families entry (tune.js:2215-2242; eject.js:110) -- a button that does nothing";
const TRACK_SOLID = "Q-20 (new): on the giant toy track vehSolid() says solid (vehicles.js:127, every car) but nothing there asks the registry -- car.js:865 hands the frame to trackUpdate first; the track's bangs are its own (a fall, track.js:975). REVIEW finding 18: the track is not a contract row";
const REASSEMBLY_FRAME = "Q-17 (new): on the frame he is put back together his model is not drawn (in every vehicle the bang branch serves) -- the bang branch poses the model (flight.js:432, hidden while exploding) BEFORE it reassembles him (flight.js:437-458) and returns, so that frame is drawn without him: a one-frame blink";
const STALE_BODY = "Q-18 (new): leaving the Moon, Mars or the station for any other vehicle keeps that body's ambient bed -- rk.onBody is cleared only when the vehicle is a rocket (state.js:250-252, in spawnForTakeoff; applyVehicle, state.js:126-176, never clears it), and currentBedName asks rk.onBody before anything else (audio.js:563): the prop on the runway plays the Moon's (or Mars's) bed, and every other reader of rk.onBody sees a body he is not on";
const EJECT_FRAME = "Q-19 (new): on the frame he bangs, the eject button is still drawn -- updateEjectControl (eject.js:24-31) runs at the top of update() (flight.js:371) before the bang that frame, and the bang branch does not call it again (the Q-6 family: B3)";
const KNOWN = {
  "plane/bang:mid/button/ejectBtn": EJECT_FRAME,
  "planeDemo/bang:mid/button/ejectBtn": EJECT_FRAME,
  "heli/bang:mid/button/ejectBtn": EJECT_FRAME,
  "car/bang:mid/button/ejectBtn": EJECT_FRAME,
  "cybertruck/bang:mid/button/ejectBtn": EJECT_FRAME,
  "corvette/bang:mid/button/ejectBtn": EJECT_FRAME,
  "police/bang:mid/button/ejectBtn": EJECT_FRAME,
  "london/bang:mid/button/ejectBtn": EJECT_FRAME,
  "boat/bang:mid/button/ejectBtn": EJECT_FRAME,
  "yacht/bang:mid/button/ejectBtn": EJECT_FRAME,
  "rocket/bang:mid/button/ejectBtn": EJECT_FRAME,
  "rover/switch/tone/bed:moon": STALE_BODY,
  "rover/picker/tone/bed:moon": STALE_BODY,
  "rover/picker:next/tone/bed:moon": STALE_BODY,
  "rover/eject:next/tone/bed:moon": STALE_BODY,
  "drone/switch/tone/bed:mars": STALE_BODY,
  "drone/picker/tone/bed:mars": STALE_BODY,
  "drone/picker:next/tone/bed:mars": STALE_BODY,
  "drone/eject:next/tone/bed:mars": STALE_BODY,
  "astro/switch/tone/bed:moon": STALE_BODY,
  "astro/picker/tone/bed:moon": STALE_BODY,
  "astro/picker:next/tone/bed:moon": STALE_BODY,
  "plane/bang:mid/tone/engine:prop": HUD7,
  "plane/bang:mid/button/fastBtn": Q6,
  "plane/bang:mid/button/slowBtn": Q6,
  "plane/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "planeDemo/bang:mid/tone/engine:prop": HUD7,
  "planeDemo/bang:mid/button/fastBtn": Q6,
  "planeDemo/bang:mid/button/slowBtn": Q6,
  "planeDemo/bang:mid/button/skipBtn": Q6,
  "planeDemo/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "heli/bang:mid/tone/engine:heli": HUD7,
  "heli/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "car/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "car/race/tone/tone:carTyre": RACE_TYRE,
  "cybertruck/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "cybertruck/race/tone/tone:carTyre": RACE_TYRE,
  "corvette/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "corvette/race/tone/tone:carTyre": RACE_TYRE,
  "police/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "london/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "boat/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "yacht/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "rocket/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "track/bang/ran/no bang": TRACK_SOLID,
  "monster/eject/ran/ejectStart returned false": DEAD_EJECT,
  "yacht/eject/ran/ejectStart returned false": DEAD_EJECT,
  "yachtSeat/eject/ran/ejectStart returned false": DEAD_EJECT,
};
// the cells the game does not offer, by name (portrait / landscape): an exit hidden or newly offered moves it
const NA_PIN = {
  portrait: [
    "astro/bang", "astro/eject", "astro/globe", "astro/own", "astro/race", "boat/globe", "boat/own", "boat/race",
    "car/globe", "car/own", "corvette/globe", "corvette/own", "crane/bang", "crane/eject", "crane/globe", "crane/own",
    "crane/race", "cybertruck/globe", "cybertruck/own", "dad/bang", "dad/eject", "dad/globe", "dad/picker", "dad/race",
    "drone/bang", "drone/globe", "drone/own", "drone/race", "heli/globe", "heli/own", "heli/race", "london/own",
    "monster/bang", "monster/globe", "monster/own", "plane/globe", "plane/own", "plane/race", "planeDemo/globe", "planeDemo/own",
    "planeDemo/race", "planeParked/bang", "planeParked/own", "planeParked/race", "police/own", "race/bang", "race/eject", "race/globe",
    "race/race", "rocket/globe", "rocket/own", "rocket/race", "rover/bang", "rover/globe", "rover/own", "rover/race",
    "sled/bang", "sled/eject", "sled/globe", "sled/own", "sled/race", "track/globe", "track/own", "track/race",
    "yacht/globe", "yacht/own", "yacht/race"],
  landscape: [
    "astro/eject", "crane/eject", "dad/eject", "dad/picker", "race/eject", "sled/eject"],
};

// ===========================================================================
// in the page
// ===========================================================================
async function install(cfg) {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const { HOLD, FROZEN, SETTLE, CLEAN, TONE_OWNER, SOURCE_TONES, DISTANCE_TONES } = cfg;
  // A live audio context, as a tap gives one (engine_sound_checks does the same): without it setTone returns
  // before it makes a voice. The resume is AWAITED (no clock), and the state is returned: the caller fails every
  // cell on a page whose context is not running.
  try {
    unlockAudio();
    if (audioCtx && audioCtx.state !== "running") await audioCtx.resume();
    startEngine();
  } catch (e) {}
  // CSS transitions and animations run on the REAL clock, which the harness does not keep: a numeral switched
  // on reads opacity 0 for 0.18 s of wall time, however many frames have run. Off, what is read is where each
  // element is going -- the same answer every run.
  if (!document.getElementById("lmNoAnim")) {
    const s = document.createElement("style"); s.id = "lmNoAnim";
    s.textContent = "*, *::before, *::after { transition: none !important; animation: none !important; }";
    document.head.appendChild(s);
  }
  // ---- the voice stamps: every writer of a continuous voice, wrapped, so a voice up and unwritten is SEEN to be
  // held. (Top-level function declarations are window properties: the game's own calls go through the wrapper.
  // It records the frame and calls the original -- nothing else.)
  if (!window.__lmStamp) {
    const S = window.__lmStamp = {};
    const wrap = (name, key) => {
      const f = window[name];
      if (typeof f !== "function") return;
      window[name] = function () { S[key(arguments)] = frameCount; return f.apply(this, arguments); };
    };
    wrap("setTone", a => "tone:" + a[0]);
    wrap("setRolling", () => "roll"); wrap("setRain", () => "rain");
    wrap("setRocketEngine", () => "rocket"); wrap("setReentryRoar", () => "reentry");
    wrap("setCarHorn", () => "horn"); wrap("engUpdate", () => "engine");
  }
  const S = window.__lmStamp;
  const KINDS = ["tone", "numeral", "button", "model"];
  const step = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); L.update(1 / 60); } };
  const press = (e, type) => e && e.dispatchEvent(new PointerEvent(type || "pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
  const tap = (e) => { press(e, "pointerdown"); press(e, "pointerup"); };
  const shownObj = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const onScreen = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains("hiddenS"); };

  // ---- is it SEEN: drawn (no display:none / visibility:hidden / near-zero opacity up its tree), a size, and not
  // under a picker screen (the cards cover the HUD: what is under them he cannot see or press)
  function seen(e) {
    if (!e || !e.isConnected) return false;
    for (let p = e; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || +cs.opacity < 0.05) return false;
    }
    if (getComputedStyle(e).visibility === "hidden") return false;
    const r = e.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2)) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
      const t = document.elementFromPoint(cx, cy);
      if (t && !e.contains(t) && t.closest && t.closest('[id^="screen"]')) return false;
    }
    return true;
  }

  // ---- T: the tones
  const owns = (tok) => {
    const k = vehKind();
    if (tok === "car*") return vehIsCar() && !(typeof trk !== "undefined" && trk.on);
    if (tok === "booster") return vehBooster();
    if (tok === "track") return vehIsCar() && typeof trk !== "undefined" && trk.on;
    if (tok === "dad") return typeof dadActive === "function" && dadActive();
    if (tok === "race") return raceOn();
    return tok.split("|").includes(k);
  };
  // a source tone's source, running (police.js:142-176; each set-piece's phase, "armed" being at rest)
  const SOURCE_STATE = {
    // a chase is his only while he is in a car (police.js:135-140 policeCan / policeHolds)
    policeSiren: () => police.active && policeHolds(), policeSirenB: () => police.active && policeHolds(),
    demo: () => demo.phase !== "armed",
    lsRoar: () => lsite.phase !== "armed", lsRoar2: () => lsite.phase !== "armed",
    sledRoar: () => sled.phase !== "armed",
  };
  const surfTones = {};
  for (const k in (L.TUNE.race && L.TUNE.race.surfaces) || {}) { const T = L.TUNE.race.surfaces[k].tone; if (T) surfTones[T[0]] = true; }
  function toneOwner(n) {
    if (TONE_OWNER[n]) return TONE_OWNER[n];
    if (n.startsWith("dad")) return "dad";
    if (surfTones[n]) return "race";
    if (SOURCE_TONES.includes(n)) return "source";
    if (DISTANCE_TONES.includes(n)) return "world";
    return null;
  }
  function voices() {
    const out = [];
    const age = (key) => S[key] === undefined ? Infinity : frameCount - S[key];
    for (const n in tones) out.push({ v: "tone:" + n, n, level: Math.max(0, tones[n].last), age: age("tone:" + n), owner: toneOwner(n) });
    if (rollNodes) out.push({ v: "roll", level: Math.max(0, rollNodes.last || 0) * 0.22, age: age("roll"), owner: "plane|heli" });
    if (rainNodes) out.push({ v: "rain", level: Math.max(0, rainNodes.last) * 0.12, age: age("rain"), owner: "world" });
    if (rocketNodes) out.push({ v: "rocket", level: Math.max(0, rocketNodes.last) * 0.55, age: age("rocket"), owner: "rocket*" });
    if (reentryNodes) out.push({ v: "reentry", level: Math.max(0, reentryNodes.last) * 0.5, age: age("reentry"), owner: "rocket*" });
    if (hornNodes) out.push({ v: "horn", level: hornNodes.on ? L.TUNE.car.horn.gain : 0, age: age("horn"), owner: "horn" });
    const e = engState();
    if (e.up) out.push({ v: "engine:" + e.key, level: e.out > 0.01 ? e.idle + e.high : 0, age: age("engine"), owner: "engine", key: e.key });
    return out;
  }
  function strayTones() {
    const bad = [];
    for (const x of voices()) {
      if (!(x.level > 0.002)) continue;
      let mine;
      if (x.owner === "world") mine = true;
      else if (x.owner === "source") { try { mine = !!SOURCE_STATE[x.n](); } catch (e) { mine = false; } }
      else if (x.owner === "rocket*") mine = !!(state.vp && state.vp.rocket);
      else if (x.owner === "horn") mine = carHornCan();
      else if (x.owner === "engine") mine = engKeyFor() === x.key;
      else if (x.owner) mine = owns(x.owner);
      else mine = false;
      const held = x.age > HOLD;
      if (!mine || held) bad.push({ id: x.v, d: `${x.v}=${+x.level.toFixed(3)}${held ? " held " + (x.age === Infinity ? "ever" : x.age + "f") : ""}${!mine ? " not his (" + (x.owner || "unclassified") + ")" : ""}` });
    }
    return bad;
  }
  // the ambient bed is the room he is in: a Moon or Mars bed is his only on that body in the rocket's modes
  // (audio.js currentBedName asks rk.onBody before anything else)
  function strayBed() {
    const n = currentBedName();
    if ((n === "moon" || n === "mars") && !(state.vp && state.vp.rocket && rk.onBody)) return [{ id: "bed:" + n, d: `the ${n} bed in the ${state.vehicleKey} (rk.onBody still ${rk.onBody && rk.onBody.name})` }];
    return [];
  }
  const anyTone = () => voices().filter(x => x.level > 0.002).map(x => x.v);

  // ---- N: the numerals
  const COUNTERS = {
    "crane.js": () => cr.phase === "count",
    "fireworksbarge.js": () => fbarge.phase === "count",
    "launchsite.js": () => lsite.phase === "count",
    "monstertruck.js": () => mtruck.phase === "count",
    "rocketsled.js": () => sled.phase === "count",
    "lock.js": () => lock.state === "warn",
    "police.js": () => police.active && police.state === "pullover" && policeHolds(),
    "marsbase.js": () => !!rk.onBody && (mars.phase === "count" || mars.cargoPhase === "count"),
    "race.js": () => raceOn(),
    "setpieces.js": () => demo.phase === "charging" || !!tcatch.counting || carrier.state === "count",
  };
  const counting = () => Object.keys(COUNTERS).filter(f => { try { return COUNTERS[f](); } catch (e) { return false; } });
  function numeralsUp() {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!/\d/.test(n.nodeValue)) continue;
      const e = n.parentElement;
      if (!e || e.closest("#altDigits, script, style, [id^='screen']")) continue;   // the altimeter is the parent's v138 exception
      if (!seen(e)) continue;
      const host = e.closest("#bigNum") ? "bigNum" : e.closest("#raceHud") ? "raceHud" : e.closest("#dadHud") ? "dadHud" : (e.closest("[id]") || {}).id || e.tagName;
      out.push({ host, text: n.nodeValue.trim() });
    }
    return out;
  }
  function strayNumerals(tick) {
    const bad = [], up = numeralsUp(), who = counting();
    for (const u of up) {
      if (u.host === "bigNum") { if (!who.length) bad.push({ id: "bigNum", d: `bigNum "${u.text}" and nothing counting` }); }
      else if (u.host === "raceHud") { if (!raceOn()) bad.push({ id: "raceHud", d: `raceHud "${u.text}" out of a race` }); }
      else if (u.host === "dadHud") { if (!(typeof dadActive === "function" && dadActive())) bad.push({ id: "dadHud", d: `dadHud "${u.text}" out of dad mode` }); }
      else bad.push({ id: u.host, d: `${u.host} "${u.text}"` });
    }
    // ... and a numeral that is counted ticks: watched FROZEN more frames, it changes or goes
    if (tick && up.some(u => u.host === "bigNum") && !bad.length) {
      const t0 = el.bigNum.textContent;
      step(FROZEN);
      if (seen(el.bigNum) && el.bigNum.classList.contains("on") && el.bigNum.textContent === t0) bad.push({ id: "bigNum frozen", d: `bigNum "${t0}" frozen ${FROZEN}f (${counting().join(",") || "nothing"} counting)` });
    }
    return bad;
  }

  // ---- B: the buttons
  function strayButtons() {
    const bad = [];
    for (const id in L.BUTTONS) {
      const b = L.BUTTONS[id];
      if (!b.when) continue;
      let w = false;
      try { w = !!b.when(); } catch (e) { w = false; }
      if (!w && seen(el[id] || document.getElementById(id))) bad.push({ id, d: id });
    }
    // the two whose when() is null are their modules' own: judged by that module's rule
    const ejSupported = !astroActive() && !srActive() && !crActive() && !dadActive() && !raceOn();   // eject.js:29-30
    if (!(eject.active || (ejSupported && !menuOpen() && !st.exploding)) && seen(el.ejectBtn)) bad.push({ id: "ejectBtn", d: "ejectBtn up where eject.js:29-31 hides it" });
    if (!(toyWorld.held && twMagnetOn() && !menuOpen()) && seen(el.magnetBtn)) bad.push({ id: "magnetBtn", d: "magnetBtn up where toyworld.js:586 hides it" });
    for (const e of document.querySelectorAll('[id$="Btn"], button')) {
      if (e.id && L.BUTTONS[e.id]) continue;
      if (e.closest('[id^="screen"]')) continue;
      if (seen(e)) { const n = "undeclared " + (e.id || e.className || e.tagName); bad.push({ id: n, d: n }); }
    }
    return bad;
  }
  const buttonsUp = () => Object.keys(L.BUTTONS).filter(id => seen(el[id] || document.getElementById(id)));

  // ---- M: the models
  function modelProblems() {
    const bad = [], k = vehKind(), vm = L.vehicleModel;
    const b = (id, d) => bad.push({ id, d: d || id });
    const ms = L.vehPlayerModels();
    if (ms.length !== 1) b("player models", "player models: " + ms.length);
    const quiet = st.exploding || eject.active || (typeof heavyWatching === "function" && heavyWatching());
    if (!quiet) {
      // (in the cockpit view his own body is not drawn, by design -- vehicle.js updateVehicleModel -- except the three
      // drawn from their own seats: the monster truck, the sled and the crane)
      if ((state.viewChase || ["monster", "sled", "crane"].includes(k)) && (!vm || !shownObj(vm))) b("his model hidden", `his ${state.vehicleKey} (${k}) hidden`);
      if (k === "rover" && !(rover.mesh && shownObj(rover.mesh))) b("rover hidden", "the rover he drives hidden");
      if (k === "drone" && !(mars.drone && shownObj(mars.drone.g))) b("drone hidden", "the drone he flies hidden");
    }
    const onBody = (n) => !!(state.vp && state.vp.rocket && rk.onBody && (!n || rk.onBody.name === n));
    if (car.cabin && shownObj(car.cabin) && !state.vp.car) b("cabin left standing", "the car's cabin left standing");
    if (boat.helm && shownObj(boat.helm) && k !== "boat") b("helm left standing", "the boat's helm left standing");
    if (yacht.bridgeG && shownObj(yacht.bridgeG) && k !== "yacht") b("bridge left standing", "the yacht's bridge left standing");
    if (rover.mesh && shownObj(rover.mesh) && !onBody()) b("rover left out");
    if (mars.drone && mars.drone.g && shownObj(mars.drone.g) && !onBody("mars")) b("drone left out");
    if (astro.group && shownObj(astro.group) && !(onBody() && rk.onBody.dock)) b("station interior left drawn");
    if (eject.pool && shownObj(eject.pool.root) && !eject.active) b("eject seat left drawn");
    return bad;
  }

  function measure(tick) {
    return { tone: strayTones().concat(strayBed()), numeral: strayNumerals(tick), button: strayButtons(), model: modelProblems(),
             at: { kind: vehKind(), key: state.vehicleKey, menu: menuOpen(), exploding: !!st.exploding, eject: !!eject.active, chase: !!state.viewChase } };
  }
  // the union of several readings, by what is left (the first description kept)
  function merge(list) {
    const out = { tone: [], numeral: [], button: [], model: [], reads: list.length };
    for (const m of list) for (const k of ["tone", "numeral", "button", "model"]) for (const x of m[k]) if (!out[k].some(y => y.id === x.id)) out[k].push(x);
    return out;
  }
  function probes() {
    return { tones: anyTone(), numerals: numeralsUp().map(u => u.host + ":" + u.text), buttons: buttonsUp(),
             // his body drawn -- or, from his seat, the seat's own (the cabin, the helm, the bridge)
             model: !!(L.vehicleModel && shownObj(L.vehicleModel)) || (vehKind() === "rover" && !!rover.mesh && shownObj(rover.mesh)) || (vehKind() === "drone" && shownObj(mars.drone.g)) ||
                    (!state.viewChase && [car.cabin, boat.helm, yacht.bridgeG].some(g => g && shownObj(g))) };
  }

  // ---- the clean start: a JUDGED exit. Whatever the last cell left him in, this is what a fresh start does to it
  // (dad mode's own exit, then applyVehicle and spawnForTakeoff, the picker's own two), and its reading is the
  // last cell's ":next" -- or the mode's "switch" when the last thing done was setting the mode up.
  // (Harness-only, and said so: an eject is let run out, the screens are put away, the demolition re-armed.)
  function closeScreens() {
    for (const id of ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"]) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); }
  }
  function cleanStart(seat) {
    return guard(() => {
      // what the last exit left that only the harness's own hand would clear, RECORDED before it is cleared:
      // a card screen still up (it hides every button and numeral from seen()), a rescue still running, him in pieces
      const pre = { tone: [], numeral: [], button: [], model: [] };
      for (const id of ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"]) if (onScreen(id)) pre.button.push({ id: "screen left open: " + id, d: id + " still up" });
      if (eject.active) pre.model.push({ id: "eject still running", d: "the rescue still running at the next start" });
      if (st.exploding) pre.model.push({ id: "still in pieces", d: "still exploding at the next start" });
      L.api.clearStick(); L.api.setThrottle(false);
      if (eject.active) { let n = 0; while (eject.active && n++ < 60 * 40) L.update(1 / 60); }
      if (typeof dadActive === "function" && dadActive()) dadExit();   // dad mode's own exit, the game's
      closeScreens();
      // (harness, a limit: the shattered pieces are put back by hand -- the game restores them on its own clock,
      // shatterRestoreDelay, which a 2 s settle may not reach; the clean start is not judged on them)
      if (L.restoreShattered) L.restoreShattered();
      st.exploding = false; st.explodeTimer = 0;
      try { localStorage.removeItem("lp.start"); } catch (e) {}
      L.api.setVehicle("prop"); L.api.spawnAt(0, 0);   // the fresh start: applyVehicle and spawnForTakeoff, the game's
      step(CLEAN);
      const m = measure(false);
      for (const k of ["tone", "numeral", "button", "model"]) m[k].push(...pre[k]);
      // ... and it must be SEEN to have taken: the plane, parked, nothing up, and every mode a row uses off
      const on = [];
      if (vehKind() !== "plane" || state.vehicleKey !== "prop") on.push("vehKind " + vehKind());
      if (!vehParked()) on.push("not parked");
      if (menuOpen()) on.push("a screen up");
      if (st.exploding) on.push("in pieces");
      if (eject.active) on.push("eject");
      const flags = { race: raceOn(), "toy track": trk.on, police: police.active, dad: dadActive(), station: astroActive(),
                      rover: roverActive(), drone: marsDroneActive(), sled: srActive(), crane: crActive(), monster: !!(state.vp && state.vp.monster),
                      heli: heliActive(), boat: !!(state.vp && state.vp.boat), car: vehIsCar() };
      for (const k in flags) if (flags[k]) on.push(k);
      // (only now, after the reading: the demolition a row set off is world state, re-armed so the next row starts the same)
      L.demoReset();
      L.api.setView(!seat);
      return { read: m, notFresh: on };
    });
  }
  // the mode he LEFT is off: no flag of a mode any row uses still on, and (for the exits that change what he is in)
  // not the kind he was
  function stillOn(rowKind, exit) {
    const on = [];
    if (raceOn() && exit !== "race") on.push("race");
    if (dadActive()) on.push("dad");
    if (trk.on) on.push("toy track");
    if (police.active) on.push("police");
    if (astroActive()) on.push("station");
    if (roverActive()) on.push("rover");
    if (marsDroneActive()) on.push("drone");
    if (["picker", "race", "own"].includes(exit) && vehKind() === rowKind) on.push("still " + rowKind);
    return on;
  }
  // a throw inside a cell is that cell's failure ("threw"), and the matrix goes on
  function guard(fn) {
    try { return fn(); } catch (e) { return { threw: String(e && e.message || e).slice(0, 160), stack: String(e && e.stack || "").slice(0, 400) }; }
  }

  // ---- the rows' setups, and each one's proof that he got there
  const finger = (n, x, y) => step(n, () => L.api.setStick(x || 0, y || 0));
  const numUp = () => el.bigNum.classList.contains("on");
  const SETUP = {
    plane() { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(20); finger(40, 0, -1); st.pitch = -30; step(4); },
    planeParked() { L.api.setVehicle("prop"); L.api.spawnAt(0, 0); step(30); },
    planeDemo() {
      // over the demolition block (it counts only where it is drawn, setpieces.js updateDemolition), and set off
      L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0);
      st.x = L.demo.x; st.z = L.demo.z + 900; st.heading = 0; step(30);
      demoTrigger();
      for (let i = 0; i < 60 * 12 && !numUp(); i++) L.update(1 / 60);
    },
    heli() { L.api.setVehicle("helicopter"); L.api.spawnAt(0, 0); step(10); heli.vertical = 1; step(120); heli.vertical = 0; step(30); },
    car() { L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10); finger(60 * 6); },
    carSeat() { SETUP.car(); L.api.setView(false); step(10, () => L.api.setStick(0, 0)); },
    cybertruck() { L.api.setVehicle("cybertruck"); L.api.spawnAt(0, 0); step(10); finger(60 * 6); },
    corvette() { L.api.setVehicle("corvette"); L.api.spawnAt(0, 0); step(10); finger(60 * 4); finger(40, 0, 0.95); },
    police() {
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(30); finger(60 * 6);
      L.policeStart(null); finger(60 * 3); L.api.clearStick();
      for (let i = 0; i < 60 * 25 && L.police.state !== "pullover"; i++) L.update(1 / 60);
      for (let i = 0; i < 60 * 8 && !numUp(); i++) L.update(1 / 60);
    },
    london() { L.api.setVehicle("car"); L.ldStart(); L.api.clearStick(); step(60); },
    track() {
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      const p = L.tkLiftPad(); st.x = p.x; st.z = p.z; st.y = L.terrainEff(p.x, p.z); st.speed = 0;
      L.api.clearStick(); step(1);
      for (let i = 0; i < 60 * 25 && (L.trk.lift || !L.trk.on); i++) { L.api.setStick(0, 0.9); L.update(1 / 60); }
      finger(60 * 2, 0, 0.9);
    },
    race() {
      L.api.setVehicle("car"); L.api.spawnAt(0, 0); step(10);
      const card = [...document.querySelectorAll(".trackCard")].find(c => c.dataset.track !== "back");
      L.rcStartRace(card.dataset.track);
      for (let i = 0; i < 60 * 12 && L.race.phase !== "race"; i++) { L.api.setStick(0, 0); L.update(1 / 60); }
      finger(60 * 3);
    },
    monster() { L.api.setVehicle("monster"); L.api.spawnAt(0, 0); step(10); finger(60 * 3); },
    sled() {
      L.api.setVehicle("sled"); L.api.spawnAt(0, 0); closeScreens(); step(10);
      L.api.setThrottle(true); for (let i = 0; i < 60 && sled.phase !== "count"; i++) L.update(1 / 60);
      L.api.setThrottle(false);
      for (let i = 0; i < 60 * 3 && !numUp(); i++) L.update(1 / 60);
      step(40);   // into the count: its roar rises from zero (rocketsled.js:592, x (1 - t/count))
    },
    crane() {
      L.api.setVehicle("crane"); L.api.spawnAt(0, 0); closeScreens(); step(90);
      L.api.setThrottle(true); step(2); L.api.setThrottle(false);
      for (let i = 0; i < 60 * 3 && !numUp(); i++) L.update(1 / 60);
      step(40);   // into the count: its rumble rises from zero (crane.js:267, x (1 - t/count))
    },
    boat() { L.api.setVehicle("speedboat"); L.api.spawnAt(1, 1); step(10); finger(60 * 4); },
    boatSeat() { SETUP.boat(); L.api.setView(false); step(10, () => L.api.setStick(0, 0)); },
    yacht() { L.api.setVehicle("yacht"); L.api.spawnAt(1, 1); step(10); finger(60 * 4); },
    yachtSeat() { SETUP.yacht(); L.api.setView(false); step(10, () => L.api.setStick(0, 0)); },
    rocket() { L.api.setVehicle("rocket"); L.api.placeOnRunway(); step(10); L.api.setThrottle(true); step(60 * 5); },
    rover() {
      L.api.setVehicle("rocket"); L.api.placeOnRunway();
      const b = L.BODIES.find(q => q.name === "moon");
      st.dest = "moon"; st.phase = "TAXI"; L.rk.stage = 3; L.rk.onBody = b;
      st.x = b.x; st.y = b.y + b.r + 10; st.z = b.z;
      step(1); L.roverDeploy(); step(40);
      L.api.setThrottle(true); step(60 * 2);
    },
    drone() {
      L.api.setVehicle("starship"); L.api.placeOnRunway();
      const b = L.BODIES[1];
      st.dest = b.name; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
      const nn = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
      st.x = b.x + nn.x * (b.r + 12); st.y = b.y + nn.y * (b.r + 12); st.z = b.z + nn.z * (b.r + 12);
      st.exploding = false; step(1);
      if (!L.mars.g && L.marsBuild) L.marsBuild();
      L.roverDeploy(); step(30);
      const dr = L.mars.drone; dr.x = L.rover.x; dr.y = L.rover.y; dr.z = L.rover.z;   // called from beside the rover (as solidity_checks does)
      L.marsDronePress(); step(60 * 2);
    },
    astro() {
      L.api.setVehicle("rocket"); L.api.placeOnRunway(); step(5);
      const b = L.BODIES.find(q => q.name === "station");
      st.dest = "station"; st.exploding = false; st.phase = "AIRBORNE"; L.rk.onBody = null; L.rk.launchedFromBody = false; L.rk.stage = 3;
      L.rocketApplyStages(L.vehicleModel);
      st.x = b.x; st.y = b.y - 200; st.z = b.z; st.pitch = 90; st.spaceF = 1; L.rk.vx = L.rk.vz = 0; L.rk.vy = 25;
      for (let i = 0; i < 60 * 40 && !L.rk.onBody; i++) L.update(1 / 60);
      step(1); L.enterStation(); step(30);
      L.api.setThrottle(true); step(60);
    },
    dad() { L.dadEnter(); step(60); },
  };
  const air = () => st.phase === "AIRBORNE" || st.phase === "CLIMB_AWAY";
  const PROOF = {
    plane: () => air() && st.pitch < -10,
    planeParked: () => vehParked(),
    planeDemo: () => demo.phase === "charging" && numUp(),
    heli: () => air(),
    car: () => st.speed > 10 && !trk.on, carSeat: () => st.speed > 10 && !state.viewChase && !!car.cabin && shownObj(car.cabin),
    cybertruck: () => st.speed > 10, corvette: () => st.speed > 10 && cv.k > 0,
    police: () => police.state === "pullover" && numUp(),
    london: () => !!L.ldNear(st.x, st.z) && vehParked(),
    track: () => trk.on && !trk.lift,
    race: () => race.phase === "race",
    monster: () => st.speed > 1,
    sled: () => sled.phase === "count" && numUp(), crane: () => cr.phase === "count" && numUp(),
    boat: () => st.speed > 2, boatSeat: () => st.speed > 2 && !state.viewChase && !!boat.helm && shownObj(boat.helm),
    yacht: () => st.speed > 1, yachtSeat: () => st.speed > 1 && !state.viewChase && !!yacht.bridgeG && shownObj(yacht.bridgeG),
    rocket: () => air() && st.y - rk.groundHere > 20,
    rover: () => roverActive() && Math.abs(rover.speed) > 0.3,
    drone: () => marsDroneActive(),
    astro: () => astroActive() && !!rk.onBody && !!rk.onBody.dock,
    dad: () => dadActive() && !!dad.m,
  };

  // ---- the exits. OFFERED: asked of the game. RUN: does it, says whether it happened (and why not), reads
  const B = (id) => { try { return !!L.BUTTONS[id].when(); } catch (e) { return false; } };
  const OFFERED = {
    switch: () => true,                                                         // a fresh start is always there
    picker: () => B("menuBtn") || B("vehBtn"),
    eject: () => !el.ejectBtn.classList.contains("hidden") && !eject.active,   // eject.js owns its button (updateEjectControl)
    // the contract: can a wall bang him here -- and can he reach one: a plane on the ground is held to its runway's
    // centreline by the flight model (flight.js; solidity_checks' own note), so no wall is in reach of a parked plane
    bang: () => vehSolid() && !menuOpen() && !(vehKind() === "plane" && !air()),
    race: () => B("raceBtn"),
    globe: () => B("globeBtn"),
    own: () => B("raceExitBtn") || B("dadExitBtn"),
    relaunch: () => true,                                                       // the iPad's own act, not a control
  };
  function setup(mode) {
    return guard(() => {
      SETUP[mode]();
      step(1);
      const kind = vehKind();
      let ok = false;
      try { ok = !!PROOF[mode](); } catch (e) { ok = false; }
      const offered = {};
      for (const x in OFFERED) { try { offered[x] = !!OFFERED[x](); } catch (e) { offered[x] = false; } }
      return { kind, ok, offered, before: probes(), at: { phase: st.phase, speed: +st.speed.toFixed(1), chase: !!state.viewChase } };
    });
  }
  function pickCard(key) {
    tap(document.querySelector(`.vehCard[data-v="${key}"]`));
    if (onScreen("screenDir")) press(document.querySelector('.dirCard[data-d="0"]'));
    if (onScreen("screenDest")) press(document.querySelector(".destCard"));
  }
  // he carries on from the cards: the lit vehicle, the direction he had, the lit destination
  function carryOn(dir) {
    const card = document.querySelector(".vehCard.sel") || document.querySelector(`.vehCard[data-v="${state.vehicleKey}"]`);
    if (onScreen("screenVehicle")) tap(card);
    if (onScreen("screenDir")) press(document.querySelector(`.dirCard[data-d="${dir === "1" ? 1 : 0}"]`));
    if (onScreen("screenDest")) press(document.querySelector(".destCard.sel") || document.querySelector(".destCard"));
    step(SETTLE);
    return !menuOpen();
  }
  const RUN = {
    picker() {
      const from = state.vehicleKey, to = from === "prop" ? "car" : "prop";
      const viaMenu = B("menuBtn");
      press(viaMenu ? el.menuBtn : el.vehBtn);
      const opened = menuOpen(), mids = [];
      step(90);
      if (opened && menuOpen()) mids.push(measure(false));
      pickCard(to);
      step(SETTLE);
      const why = !opened ? "cards did not open" : state.vehicleKey !== to ? "vehicle not changed" : menuOpen() ? "cards still up" : null;
      return { why, mids, proof: { via: viaMenu ? "menuBtn" : "vehBtn", opened, from, to, now: state.vehicleKey } };
    },
    eject() {
      const f0 = L.flags.ejections || 0, c0 = eject.cycles;
      const started = ejectStart();
      const activeAtStart = eject.active, phases = eject.active ? [eject.phase] : [], mids = [];
      let n = 0;
      while (eject.active && n < 60 * 40) {
        L.update(1 / 60); n++;
        if (eject.active && phases[phases.length - 1] !== eject.phase) phases.push(eject.phase);
        if (eject.active && n % 60 === 0) mids.push(measure(false));   // under the canopy, once a second
      }
      const e = { started, activeAtStart, phases, secs: +(n / 60).toFixed(2), ended: !eject.active,
                  cycles: eject.cycles - c0, counted: (L.flags.ejections || 0) - f0, returned: !!(eject.last && eject.last.returned) };
      step(SETTLE);
      return { eject: e, mids, why: started !== true ? "ejectStart returned false" : null, proof: e };
    },
    bang() {
      // a real bang through the one wall law: him, at cruise, inside the nearest solid that blocks his class
      const cls = vehSolidClass(), cruise = state.vp.cruiseSpeed || 40;
      let best = null, bd = Infinity;
      L.forEachSolid(b => {
        if (b.o3 || b.cap || b.ramp || b.toy || b.moving || b.car !== undefined || b.park) return;
        if (!L.solidBlocks(b, cls) || (b.mesh && b.mesh.visible === false) || L.isSolidHidden(b)) return;
        if (!(b.hw > 3 && b.hd > 3 && b.y1 - b.y0 > 6)) return;
        const d = Math.hypot(b.x - st.x, b.z - st.z);
        if (d < bd) { bd = d; best = b; }
      }, st.x, st.z, 2000);
      if (!best) return { why: "no solid in reach", mids: [] };
      const wasX = st.x, wasZ = st.z, inAir = air();
      st.x = best.x; st.z = best.z + best.hd - 1;
      st.y = inAir ? Math.min(best.y1 - 2, Math.max(best.y0 + 3, st.y)) : Math.max(best.y0, L.terrainEff(st.x, st.z));
      st.heading = 0; st.speed = cruise;
      if (vehKind() === "heli") { heli.vx = 0; heli.vz = -cruise; heli.altitude = st.y; }
      // frame by frame from the bang: read on the frame it happens (a car's bang is over on the next: carCrash's
      // explodeTimer is 0), every 15 frames while he is in pieces, and on the frame he is put back together
      let saw = false, n = 0, k = 0;
      const mids = [];
      for (; n < 60 && !saw; n++) { st.speed = Math.max(st.speed, cruise); L.update(1 / 60); if (st.exploding) saw = true; }
      if (saw) {
        mids.push(measure(false));
        while (st.exploding && k < 60 * 12) { L.update(1 / 60); k++; if (st.exploding && k % 15 === 0) mids.push(measure(false)); }
        if (!st.exploding) mids.push(measure(false));
      }
      const back = saw && !st.exploding;
      step(SETTLE);
      return { why: !saw ? "no bang" : !back ? "not reassembled" : null, mids,
               proof: { at: [Math.round(best.x), Math.round(best.z)], from: Math.round(Math.hypot(best.x - wasX, best.z - wasZ)), exploded: saw, reassembled: back, inPieces: k } };
    },
    race() {
      press(el.raceBtn);
      const open = onScreen("screenRace");
      const card = [...document.querySelectorAll(".trackCard")].find(c => c.dataset.track !== "back");
      press(card);
      const on = raceOn();
      step(SETTLE);
      return { why: !open ? "track picker did not open" : !on ? "race not on" : onScreen("screenRace") ? "track picker still up" : null, proof: { open, on, track: card && card.dataset.track, phase: L.race.phase } };
    },
    globe() {
      const was = { x: st.x, z: st.z, ldn: !!L.ldNear(st.x, st.z) };
      press(el.globeBtn);
      const open = onScreen("screenGlobe");
      const city = was.ldn ? "ny" : "ldn";
      press(document.querySelector(`.cityCard[data-city="${city}"]`));
      const d = Math.hypot(st.x - was.x, st.z - was.z), ldnNow = !!L.ldNear(st.x, st.z);
      step(SETTLE);
      return { why: !open ? "globe did not open" : !(d > 1000 && ldnNow !== was.ldn) ? "did not move city" : onScreen("screenGlobe") ? "globe still up" : null, proof: { open, city, moved: Math.round(d), ldnNow } };
    },
    own() {
      const which = B("raceExitBtn") ? "raceExitBtn" : "dadExitBtn";
      press(el[which] || document.getElementById(which));
      step(SETTLE);
      const out = which === "raceExitBtn" ? !raceOn() : !dadActive();
      const after = measure(true);
      // dad mode's exit lands on the vehicles (dadmode.js:342): he carries on from there too
      const picker = menuOpen(), on = picker ? carryOn("0") : true;
      return { why: !out ? (which === "raceExitBtn" ? "still in the race" : "still in dad mode") : !on ? "did not carry on" : null,
               after, on: picker ? measure(true) : null, proof: { which, picker } };
    },
  };

  function cell(mode, exit) {
    return guard(() => {
      const s = setup(mode);
      if (s.threw) return s;
      if (!s.ok || !s.offered[exit]) return { setup: s };
      L.api.clearStick(); L.api.setThrottle(false);   // the finger comes off before he leaves: what is left is the exit's
      const r = RUN[exit]();
      // (the eject and the bang give him back the mode he was in, by design: for them "left" is not asked)
      if (!r.why && ["picker", "race", "globe", "own"].includes(exit)) { const on = stillOn(s.kind, exit); if (on.length) r.why = "did not leave (" + on.join(", ") + ")"; }
      const after = r.after || measure(true);
      return { setup: s, why: r.why, eject: r.eject, proof: r.proof, mid: r.mids ? merge(r.mids) : null, after, on: r.on || null };
    });
  }
  // a relaunch: the choice made through the game's own cards and globe (it saves them), then the mode -- the caller
  // reloads the page and hands back what the game had saved; the page restores it and he carries on
  function relaunchBefore(mode, row) {
    return guard(() => {
      el.menuBtn && press(el.menuBtn);
      if (!menuOpen()) { closeScreens(); el.screenVehicle.classList.remove("hiddenS"); }
      tap(document.querySelector(`.vehCard[data-v="${row.card}"]`));
      if (onScreen("screenDir")) press(document.querySelector('.dirCard[data-d="0"]'));
      if (onScreen("screenDest")) press(document.querySelector(`.destCard[data-dest="${row.dest || "moon"}"]`));
      step(10);
      if (row.city === "ldn") { press(el.globeBtn); press(document.querySelector('.cityCard[data-city="ldn"]')); step(10); }
      const s = setup(mode);
      if (s.threw) return s;
      const saved = {};
      for (const k of ["lp.vehicle", "lp.dir", "lp.dest", "lp.start"]) { const v = localStorage.getItem(k); if (v !== null) saved[k] = v; }
      return { setup: s, saved };
    });
  }
  function relaunchAfter(saved) {
    return guard(() => {
      // the harness wipes storage on every page load (its init script); what the game wrote is put back as it was
      for (const k in saved) localStorage.setItem(k, saved[k]);
      const r0 = L.flags.repositioned || 0;
      L.lpRestoreChoice();
      const why = [];
      if (state.vehicleKey !== saved["lp.vehicle"]) why.push("vehicle not restored");
      if (String(state.dirIdx) !== saved["lp.dir"] && saved["lp.start"] !== "ldn") why.push("direction not restored");
      if (saved["lp.dest"] && state.dest !== saved["lp.dest"]) why.push("destination not restored");
      if (saved["lp.start"] === "ldn" && state.originIdx !== ldn.airportIdx) why.push("London not restored");
      if (!((L.flags.repositioned || 0) > r0)) why.push("no fresh start");
      if (!onScreen("screenVehicle")) why.push("not on the vehicles");
      step(SETTLE);
      const after = measure(true);
      const on = carryOn(saved["lp.dir"]);
      if (!on) why.push("did not carry on");
      const still = stillOn("", "relaunch"); if (still.length) why.push("did not leave (" + still.join(", ") + ")");
      return { why: why.join("; ") || null, after, on: measure(true),
               proof: { vehicle: state.vehicleKey, dir: state.dirIdx, dest: state.dest, origin: state.originIdx, saved } };
    });
  }

  // ---- the probes' own proof: one of each leftover put there by hand, every arm of every probe
  function selfTest() {
    const out = { audio: audioCtx ? audioCtx.state : null };
    const c0 = cleanStart(false); out.clean = !c0.threw && KINDS.every(k => !c0.read[k].length) && !c0.notFresh.length;
    const has = (list, id) => list.some(x => x.id === id);
    // T: a plane's tone (his), written once and then held; a boat's tone written every frame in a plane (not his);
    // a siren written with no police
    setTone("lmProbe", "sine", 300, 0.05); TONE_OWNER.lmProbe = "plane";
    step(HOLD + 2); out.toneHeld = has(strayTones(), "tone:lmProbe");
    setTone("lmProbe", "sine", 300, 0); delete TONE_OWNER.lmProbe;
    step(3); setTone("boatHull", "triangle", 90, 0.05); out.toneNotHis = has(strayTones(), "tone:boatHull");          // written this frame
    setTone("policeSiren", "sine", 600, 0.05); out.toneSourceGone = has(strayTones(), "tone:policeSiren");             // written, no police
    setTone("boatHull", "triangle", 90, 0); setTone("policeSiren", "sine", 600, 0); step(2);
    // N: a numeral nothing counts; a numeral its owner says it counts and nobody moves (the demolition "charging"
    // far away, where it does not draw it: setpieces.js updateDemolition)
    setBigNum(7); out.numeral = has(strayNumerals(false), "bigNum"); setBigNum(null);
    demo.phase = "charging"; demo.t = 100; setBigNum(5); out.numeralFrozen = has(strayNumerals(true), "bigNum frozen");
    L.demoReset(); setBigNum(null);
    // B: a race button shown out of a race, and a button buttons.js has never heard of
    el.raceExitBtn.classList.remove("hidden"); out.button = has(strayButtons(), "raceExitBtn"); el.raceExitBtn.classList.add("hidden");
    const fake = document.createElement("button"); fake.id = "lmProbeBtn"; fake.style.cssText = "position:fixed;left:40%;top:40%;width:60px;height:60px";
    document.body.appendChild(fake); out.undeclared = has(strayButtons(), "undeclared lmProbeBtn"); fake.remove();
    // M: his model hidden; the car's cabin left standing in a plane
    L.vehicleModel.visible = false; out.model = has(modelProblems(), "his model hidden"); step(1);
    carBuildCabin(); car.cabin.visible = true; out.cabin = has(modelProblems(), "cabin left standing"); carHideCabin();
    // T: the horn sounding in a plane (not his: carHornCan)
    setCarHorn(true); out.horn = has(strayTones(), "horn"); setCarHorn(false);
    // B: the two null-when buttons up where their modules would hide them
    el.magnetBtn.classList.remove("hidden"); out.magnet = has(strayButtons(), "magnetBtn"); el.magnetBtn.classList.add("hidden");
    st.exploding = true; el.ejectBtn.classList.remove("hidden"); out.ejectBtn = has(strayButtons(), "ejectBtn"); st.exploding = false; step(1);   // up in pieces
    // a clean start that did not take: the toy track left on through it (trackReset made a no-op for the one call)
    const realReset = window.trackReset; window.trackReset = () => {}; trk.on = true;
    const c2 = cleanStart(false); window.trackReset = realReset; trackReset();
    out.notFresh = !c2.threw && c2.notFresh.includes("toy track"); out.notFreshSaw = c2.notFresh;
    // a card screen left up for the next start: recorded before it is put away
    el.screenRace.classList.remove("hiddenS"); const c3 = cleanStart(false); out.screenLeft = !c3.threw && has(c3.read.button, "screen left open: screenRace");
    const c1 = cleanStart(false); out.cleanAfter = !c1.threw && KINDS.every(k => !c1.read[k].length) && !c1.notFresh.length;
    return out;
  }

  window.__lm = { cleanStart, setup, cell, relaunchBefore, relaunchAfter, selfTest, measure, voices, counting,
                  contract: () => Object.keys(L.VEHICLE_CONTRACT), audio: () => audioCtx ? audioCtx.state : null };
  return { audio: audioCtx ? audioCtx.state : null };
}

// ===========================================================================
// in node
// ===========================================================================
const CFG = { HOLD, FROZEN, SETTLE, CLEAN, TONE_OWNER, SOURCE_TONES, DISTANCE_TONES };

// one row x orientation: its page, its cells in order, every clean start judged as the last thing's leftover
async function runRow({ newPage, orient, size, m, out }) {
  const { page, ctx } = await newPage(size[0], size[1]);
  const exits = exitsOf(m, orient), seat = /Seat$/.test(m.id);
  let audio = (await page.evaluate(install, CFG)).audio;
  const cells = [];   // { exit, status: "ran"|"na"|"skip", ... }
  const readings = [], integrity = [];
  const fail = (exit, what) => integrity.push({ orient, mode: m.id, exit, what });
  const read = (exit, pt, r) => { if (r) readings.push({ orient, mode: m.id, exit, pt, r }); };
  const audioOk = (exit) => { if (audio !== "running") fail(exit, "audio not running (" + audio + ")"); };
  // the page's first clean start, then the mode set up, and the clean start after it is the mode's "switch"
  let prev = { exit: "fresh", pt: "" };
  const clean = async () => {
    const c = await page.evaluate((s) => window.__lm.cleanStart(s), seat);
    if (c.threw) fail(prev.exit, "threw: " + c.threw);
    else {
      read(prev.exit, prev.pt, c.read);
      if (c.notFresh.length) fail(prev.exit, "fresh start did not take (" + c.notFresh.join(", ") + ")");
    }
  };
  await clean();
  const s0 = await page.evaluate((id) => window.__lm.setup(id), m.id);
  if (s0.threw) fail("switch", "threw: " + s0.threw);
  else if (s0.kind !== m.kind || !s0.ok) fail("switch", `mode not reached (vehKind ${s0.kind}, want ${m.kind}; ${JSON.stringify(s0.at)})`);
  cells.push({ exit: "switch", status: "ran", setup: s0 });
  audioOk("switch");
  prev = { exit: "switch", pt: "" };
  await clean();
  for (const x of exits) {
    if (x === "switch") continue;
    if (!s0.offered || !s0.offered[x]) { cells.push({ exit: x, status: "na" }); continue; }
    audioOk(x);
    if (x === "relaunch") {
      const b = await page.evaluate(([id, row]) => window.__lm.relaunchBefore(id, row), [m.id, m]);
      if (b.threw) { fail(x, "threw: " + b.threw); cells.push({ exit: x, status: "ran" }); continue; }
      if (b.setup.kind !== m.kind || !b.setup.ok) fail(x, `mode not reached (vehKind ${b.setup.kind})`);
      await page.reload({ timeout: 120000 });
      await page.waitForFunction(() => !!window.__lp, null, { timeout: 60000 });
      await page.waitForFunction(() => !window.__lp.artReady || window.__lp.artReady(), null, { timeout: 60000 });
      audio = (await page.evaluate(install, CFG)).audio;
      audioOk(x);
      const a = await page.evaluate((sv) => window.__lm.relaunchAfter(sv), b.saved);
      if (a.threw) fail(x, "threw: " + a.threw);
      else { if (a.why) fail(x, a.why); read(x, "", a.after); read(x, ":on", a.on); }
      cells.push({ exit: x, status: "ran", proof: a.proof });
    } else {
      const c = await page.evaluate(([id, x]) => window.__lm.cell(id, x), [m.id, x]);
      if (c.threw) { fail(x, "threw: " + c.threw); cells.push({ exit: x, status: "ran" }); }
      else if (!c.setup.ok || c.setup.kind !== m.kind) { fail(x, `mode not reached (vehKind ${c.setup.kind})`); cells.push({ exit: x, status: "ran" }); }
      else if (!c.setup.offered[x]) { fail(x, "offered at the first setup, not at this one"); cells.push({ exit: x, status: "ran" }); }
      else {
        if (c.why) fail(x, c.why);
        if (x === "eject" && !c.why && !EJ.ran(c.eject)) fail(x, "rescue did not run through (audit_eject.js)");
        if (MID_EXITS.includes(x) && !c.why && !(c.mid && c.mid.reads > 0)) fail(x, "mid not read");
        read(x, "", c.after); if (c.mid) read(x, ":mid", c.mid); read(x, ":on", c.on);
        cells.push({ exit: x, status: "ran", proof: c.proof || c.eject });
      }
    }
    prev = { exit: x, pt: ":next" };
    await clean();
  }
  await ctx.close().catch(() => {});
  out.cells.push(...cells.map(c => ({ orient, mode: m.id, ...c })));
  out.readings.push(...readings); out.integrity.push(...integrity);
}

// every failing key: "<mode>/<exit><pt>/<kind>/<what>" (readings), "<mode>/<exit>/ran/<what>" (integrity)
function failingKeys(out, orient) {
  const keys = new Map();
  for (const g of out.readings.filter(q => q.orient === orient)) for (const k of KINDS) for (const x of g.r[k] || []) keys.set(`${g.mode}/${g.exit}${g.pt}/${k}/${x.id}`, x.d);
  for (const f of out.integrity.filter(q => q.orient === orient)) keys.set(`${f.mode}/${f.exit}/ran/${f.what.replace(/ \(.*$/, "")}`, f.what);
  return keys;
}
const NEVER_EXCUSED = /\/ran\/(threw|audio not running|fresh start did not take|did not leave|mode not reached|mid not read)/;
function knownFor(out, orient) {
  const k = new Map();
  for (const [key, why] of Object.entries(KNOWN)) {
    if (NEVER_EXCUSED.test(key)) continue;
    const m = key.match(/^(portrait|landscape):(.*)$/);
    if (m) { if (m[1] === orient) k.set(m[2], why); continue; }
    const [mode, ex] = key.split("/"), exit = ex.replace(/:.*$/, "");
    const ranHere = out.cells.some(c => c.orient === orient && c.mode === mode && c.exit === exit && c.status === "ran");
    if (ranHere || orient === "portrait") k.set(key, why);
  }
  return k;
}

function table(out, orient) {
  const w = 10, cols = orient === "portrait" ? EXITS : LANDSCAPE_EXITS;
  const F = failingKeys(out, orient);
  let s = "mode".padEnd(12) + cols.map(x => x.padStart(w)).join("") + "\n";
  for (const m of MODES) {
    s += m.id.padEnd(12);
    for (const x of cols) {
      const c = out.cells.find(q => q.orient === orient && q.mode === m.id && q.exit === x);
      let t;
      if (!c) t = "-";
      else if (c.status === "na") t = "n/a";
      else {
        const ks = [...F.keys()].filter(k => k.split("/")[0] === m.id && k.split("/")[1].replace(/:.*/, "") === x);
        t = KINDS.map(kd => ks.some(k => k.split("/")[2] === kd && !k.split("/")[1].includes(":mid")) ? KLETTER[kd]
                         : ks.some(k => k.split("/")[2] === kd) ? KLETTER[kd].toLowerCase() : ".").join("");
        if (ks.some(k => k.split("/")[2] === "ran")) t = "X" + t;
      }
      s += t.padStart(w);
    }
    s += "\n";
  }
  return s;
}

// the source's own list of tone names and numeral writers, to hold the two classifications to the code
function sourceInventory() {
  const dir = path.join(__dirname, "..", "cockpit", "js");
  const tones = new Set(), writers = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/setTone\("([A-Za-z0-9_]+)"/g)) tones.add(m[1]);
    // a writer calls countdownTo / setBigNum (their own definitions are not calls)
    const calls = src.replace(/function (setBigNum|countdownTo|countdownClear)\([^)]*\)\s*\{[^\n]*/g, "");
    if (/\b(countdownTo|setBigNum)\(/.test(calls)) writers.add(f);
  }
  return { tones: [...tones].sort(), writers: [...writers].sort() };
}

module.exports = async function leaveMatrixChecks({ newPage, check }) {
  const t0 = Date.now();

  // ---- 0. the probes see what they are for: one of each leftover put there by hand, every arm
  let contract = [];
  {
    const { page, ctx } = await newPage(PORTRAIT[0], PORTRAIT[1]);
    await page.evaluate(install, CFG);
    const st = await page.evaluate(() => window.__lm.selfTest());
    contract = await page.evaluate(() => window.__lm.contract());
    check("leave: the probes see a leftover put there by hand, every arm -- a tone held, a tone written but not his, a siren with no police, the horn in a plane; a numeral nothing counts, one counted and frozen; a button out of its state, one buttons.js never declared, the magnet and eject buttons where their modules hide them; his model hidden, the car's cabin left standing; a card screen left up for the next start, and a fresh start that did not take (the toy track left on) -- on a live audio context, from a clean start that reads clean",
      st.audio === "running" && st.clean && st.toneHeld && st.toneNotHis && st.toneSourceGone && st.numeral && st.numeralFrozen &&
      st.button && st.undeclared && st.model && st.cabin && st.horn && st.magnet && st.ejectBtn && st.notFresh && st.screenLeft && st.cleanAfter, st);
    await ctx.close().catch(() => {});
  }

  // ---- 0b. the classifications cover the code, and the rows cover the contract
  {
    const inv = sourceInventory();
    const unclassified = inv.tones.filter(n => !TONE_OWNER[n] && !SOURCE_TONES.includes(n) && !DISTANCE_TONES.includes(n) && !n.startsWith("dad"));
    const writersOff = inv.writers.filter(f => !COUNTER_FILES.includes(f)).concat(COUNTER_FILES.filter(f => !inv.writers.includes(f)).map(f => "stale " + f));
    check(`leave: every tone the game names has an owner here (vehicle, source, distance or dad), and every file that writes the big numeral has its "am I counting?" -- read from cockpit/js, so a new one cannot hide`,
      unclassified.length === 0 && writersOff.length === 0, { tones: inv.tones.length, unclassified, writersOff, writers: inv.writers });
    const rowKinds = new Set(MODES.map(m => m.kind));
    const uncovered = contract.filter(k => !rowKinds.has(k) && !LEFT_OUT[k]);
    const stale = Object.keys(LEFT_OUT).filter(k => !contract.includes(k) || rowKinds.has(k));
    check("leave: every row of the vehicle contract (VEHICLE_CONTRACT) is a row of the matrix, or is named in LEFT_OUT with why -- a new vehicle cannot be left out of the matrix by forgetting",
      contract.length > 10 && uncovered.length === 0 && stale.length === 0, { contract, uncovered, stale });
  }

  // ---- 1. the matrix: every row, both ways up, one page each
  const out = { cells: [], readings: [], integrity: [] };
  const only = (process.env.LEAVE_ONLY || "").split(",").filter(Boolean);   // LEAVE_ONLY=heli,race: those rows (iterating; the pins go red)
  for (const [orient, size] of [["portrait", PORTRAIT], ["landscape", LANDSCAPE]]) {
    for (const m of MODES.filter(q => !only.length || only.includes(q.id))) await runRow({ newPage, orient, size, m, out });
  }
  for (const orient of ["portrait", "landscape"]) {
    console.log(`\nLEAVING MATRIX -- ${orient} ${(orient === "portrait" ? PORTRAIT : LANDSCAPE).join("x")}\n` + table(out, orient));
  }
  console.log("  T tone  N numeral  B button  M model -- upper case: left over after the exit, at the next clean start or after he carries on; lower: only DURING it (behind the cards, under the canopy, in pieces); . clean; X it did not happen (or the mode was not reached); n/a not offered; - not run");
  const F = {}, K = {};
  for (const orient of ["portrait", "landscape"]) { F[orient] = failingKeys(out, orient); K[orient] = knownFor(out, orient); }
  for (const orient of ["portrait", "landscape"]) for (const [key, d] of F[orient]) console.log(`  ${orient.padEnd(9)} ${(K[orient].has(key) ? "known " : "NEW   ") + key.padEnd(52)} ${d}`);

  // ---- 2. the verdicts: one per exit and leftover; what is left must be KNOWN's exactly
  const verdict = (exit, kind) => {
    const NEW = [], fixed = [], held = [];
    for (const orient of ["portrait", "landscape"]) {
      const inScope = (key) => key.split("/")[1].replace(/:.*/, "") === exit && key.split("/")[2] === kind;
      for (const [key] of F[orient]) if (inScope(key)) (K[orient].has(key) ? held : NEW).push(orient + " " + key);
      for (const [key] of K[orient]) if (inScope(key) && !F[orient].has(key)) fixed.push(orient + " " + key);
    }
    return { NEW, fixed, held };
  };
  const NAME = { tone: "no tone above zero that nothing owns", numeral: "no numeral nothing is counting", button: "no button its own when() does not want", model: "no hidden model: his drawn, nothing he left still drawn" };
  const WHEN = { picker: "behind the cards, afterwards and at the next start", eject: "under the canopy, afterwards and at the next start", bang: "in pieces (frame by frame to the reassembly), afterwards and at the next start",
                 relaunch: "on the reloaded page's cards and after he carries on, and at the next start", own: "afterwards, after he carries on, and at the next start", switch: "at the fresh start from the mode" };
  for (const exit of EXITS) {
    for (const kind of KINDS) {
      const v = verdict(exit, kind);
      check(`leave: ${exit} -- ${NAME[kind]}, ${WHEN[exit] || "afterwards and at the next start"} (${LANDSCAPE_EXITS.includes(exit) ? "both ways up" : "portrait"}; what is left == KNOWN)`,
        v.NEW.length === 0 && v.fixed.length === 0,
        { cells: out.cells.filter(c => c.exit === exit && c.status === "ran").length, NEW: v.NEW, "fixed: remove from KNOWN": v.fixed, known: v.held });
    }
  }
  {
    const v = { NEW: [], fixed: [] };
    for (const orient of ["portrait", "landscape"]) {
      for (const [key] of F[orient]) if (key.split("/")[2] === "ran" && !K[orient].has(key)) v.NEW.push(orient + " " + key);
      for (const [key] of K[orient]) if (key.split("/")[2] === "ran" && !F[orient].has(key)) v.fixed.push(orient + " " + key);
    }
    const fresh = [...F.portrait.keys(), ...F.landscape.keys()].filter(k => k.split("/")[1] === "fresh");
    check("leave: every row REACHED its mode (vehKind and its own state) and every exit the game offers HAPPENED (the eject through audit_eject.js's verdict, the bang exploded and reassembled, the pick changed the vehicle, the race on, the globe moved him, the relaunch restored vehicle, direction and destination and he carried on), every DURING reading was taken, every page's audio ran, nothing threw, and every fresh page started clean (what fails == KNOWN; a throw or dead audio never is)",
      v.NEW.length === 0 && v.fixed.length === 0 && fresh.length === 0, { NEW: v.NEW, "fixed: remove from KNOWN": v.fixed, freshPage: fresh });
  }

  // ---- 3. the probes read something BEFORE the exits: else "nothing after" means nothing
  {
    const sw = out.cells.filter(c => c.orient === "portrait" && c.exit === "switch" && c.setup && c.setup.before);
    const b = (c) => c.setup.before;
    const ownMissing = sw.filter(c => !NO_OWN_TONE[c.mode] && !b(c).tones.includes(OWN_TONE[c.mode])).map(c => `${c.mode} (want ${OWN_TONE[c.mode]}, heard ${b(c).tones.join(" ") || "nothing"})`);
    const listed = MODES.filter(m => !OWN_TONE[m.id] === !NO_OWN_TONE[m.id]).map(m => m.id);   // exactly one of the two
    const withTone = sw.filter(c => b(c).tones.includes(OWN_TONE[c.mode])).map(c => c.mode);
    const withNum = sw.filter(c => b(c).numerals.some(n => n.startsWith("bigNum"))).map(c => c.mode);
    const noModel = sw.filter(c => !b(c).model).map(c => c.mode);
    const noBtn = sw.filter(c => !b(c).buttons.length).map(c => c.mode);
    const wantNum = ["planeDemo", "police", "sled", "crane"];
    check("leave: the probes read something before he leaves -- every row's OWN voice up (OWN_TONE: the dive, the tyres, the booster, the siren, the rattle, the crowd, the hulls, the roar, the rover, the fans, the engines; NO_OWN_TONE says why where there is none), a numeral up in the four wind-ups, his model drawn and his buttons up in every mode",
      (only.length || sw.length === MODES.length) && !ownMissing.length && !listed.length &&
      wantNum.every(m => only.length && !only.includes(m) || withNum.includes(m)) && !noModel.length && !noBtn.length,
      { ownMissing, notListedOnce: listed, withTone, withNum, noModel, noBtn, heard: Object.fromEntries(sw.map(c => [c.mode, b(c).tones])) });
  }

  // ---- 4. n/a is the game's answer, and the set is pinned
  {
    const na = (o) => out.cells.filter(c => c.orient === o && c.status === "na").map(c => `${c.mode}/${c.exit}`).sort();
    const nP = na("portrait"), nL = na("landscape");
    const diff = (a, pin) => pin ? { notOfferedNow: a.filter(x => !pin.includes(x)), offeredNow: pin.filter(x => !a.includes(x)) } : { unpinned: a };
    const dP = diff(nP, NA_PIN.portrait), dL = diff(nL, NA_PIN.landscape);
    console.log(`  n/a (the game does not offer it there): portrait ${nP.length}, landscape ${nL.length}\n    portrait: ${JSON.stringify(nP)}\n    landscape: ${JSON.stringify(nL)}`);
    const same = (d) => d.notOfferedNow && !d.notOfferedNow.length && !d.offeredNow.length;
    check("leave: the exits NOT offered are the game's own answer (each button's when(), eject.js's control, vehSolid()), and the SET of them is pinned (NA_PIN): an exit hidden, or one newly offered, is red",
      same(dP) && same(dL), { portrait: dP, landscape: dL, counts: [nP.length, nL.length] });
  }
  const ran = out.cells.filter(c => c.status === "ran").length;
  console.log(`  leave matrix: ${ran} cells run (${out.cells.length} with n/a), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (process.env.LEAVE_OUT) fs.writeFileSync(process.env.LEAVE_OUT, JSON.stringify(out, null, 1));
};
module.exports.install = install;
module.exports.KNOWN = KNOWN;
