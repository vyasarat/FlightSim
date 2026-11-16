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
  { id: "planeTitan",  kind: "plane",      card: "prop",        say: "the prop beside the giant robot, just after a missile hit it (v218)" },
  { id: "heliTitan",   kind: "heli",       card: "helicopter",  say: "the helicopter beside the giant robot, just after a missile hit it (v218)" },
  { id: "planeTitanAttack", kind: "plane",  card: "prop",        say: "the prop flying at the giant robot, its boulder winding up at him -- the mark, the dotted path, the scrap in its hands (v219)" },
  { id: "heliTitanAttack",  kind: "heli",   card: "helicopter",  say: "the helicopter hovering before the giant robot, its eye beam winding up at him -- the mark, the dotted line, the charge (v219)" },
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
  plane: "tone:dive", planeDemo: "tone:demo", heli: "engine:heli", planeTitan: "engine:prop", heliTitan: "engine:heli", planeTitanAttack: "engine:prop", heliTitanAttack: "engine:heli", car: "tone:carTyre", carSeat: "tone:carTyre",
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
  crRumble: "crane", crHum: "crane",                     // crane.js:184-339 (its lot is drawn only while he is in it)
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
// (Q-6, fixed in v220: the bang recomputes every button -- flight.js FRAME_TAILS.bang, checked in slot_checks "buttons in pieces")
// (Q-18, fixed in v222: a change to anything but the rocket clears rk.onBody -- state.js LEAVE row `body`, checked below in "leave a body (Q-18)")
const HUD7 = "HUD-7 (B3/B5): the bang branch never calls engUpdate -- the engine voice holds its pre-crash level through the bang (flight.js:405-460)";
// (Q-16, fixed in v224: a tone owned per frame and not written this frame is swept to zero -- audio.js TONES_OWNED, carTyre; checked in engine_sound_checks "tone ownership")
const DEAD_EJECT = "Q-15 (new): the eject button is offered (eject.js:29-31 updateEjectControl does not exclude it) but ejectStart refuses -- no TUNE.eject.families entry (tune.js:2215-2242; eject.js:110) -- a button that does nothing";
const TRACK_SOLID = "Q-20 (new): on the giant toy track vehSolid() says solid (vehicles.js:127, every car) but nothing there asks the registry -- car.js:865 hands the frame to trackUpdate first; the track's bangs are its own (a fall, track.js:975). REVIEW finding 18: the track is not a contract row";
const REASSEMBLY_FRAME = "Q-17 (new): on the frame he is put back together his model is not drawn (in every vehicle the bang branch serves) -- the bang branch poses the model (flight.js:432, hidden while exploding) BEFORE it reassembles him (flight.js:437-458) and returns, so that frame is drawn without him: a one-frame blink";
const EJECT_FRAME = "Q-19 (new): on the frame he bangs, the eject button is still drawn -- updateEjectControl (eject.js:24-31) runs at the top of update() (flight.js:371) before the bang that frame, and the bang branch does not call it again (the Q-6 family: B3)";
const KNOWN = {
  "plane/bang:mid/button/ejectBtn": EJECT_FRAME,
  "planeDemo/bang:mid/button/ejectBtn": EJECT_FRAME,
  "heli/bang:mid/button/ejectBtn": EJECT_FRAME,
  "planeTitan/bang:mid/button/ejectBtn": EJECT_FRAME,
  "heliTitan/bang:mid/button/ejectBtn": EJECT_FRAME,
  "planeTitanAttack/bang:mid/button/ejectBtn": EJECT_FRAME,
  "heliTitanAttack/bang:mid/button/ejectBtn": EJECT_FRAME,
  "car/bang:mid/button/ejectBtn": EJECT_FRAME,
  "cybertruck/bang:mid/button/ejectBtn": EJECT_FRAME,
  "corvette/bang:mid/button/ejectBtn": EJECT_FRAME,
  "police/bang:mid/button/ejectBtn": EJECT_FRAME,
  "london/bang:mid/button/ejectBtn": EJECT_FRAME,
  "boat/bang:mid/button/ejectBtn": EJECT_FRAME,
  "yacht/bang:mid/button/ejectBtn": EJECT_FRAME,
  "rocket/bang:mid/button/ejectBtn": EJECT_FRAME,
  "plane/bang:mid/tone/engine:prop": HUD7,
  "plane/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "planeDemo/bang:mid/tone/engine:prop": HUD7,
  "planeDemo/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "heli/bang:mid/tone/engine:heli": HUD7,
  "planeTitan/bang:mid/tone/engine:prop": HUD7,
  "planeTitan/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "heliTitan/bang:mid/tone/engine:heli": HUD7,
  "heliTitan/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "planeTitanAttack/bang:mid/tone/engine:prop": HUD7,
  "planeTitanAttack/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "heliTitanAttack/bang:mid/tone/engine:heli": HUD7,
  "heliTitanAttack/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "heli/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "car/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "cybertruck/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
  "corvette/bang:mid/model/his model hidden": REASSEMBLY_FRAME,
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
    "drone/bang", "drone/globe", "drone/own", "drone/race", "heli/globe", "heli/own", "heli/race", "heliTitan/globe", "heliTitan/own", "heliTitan/race", "heliTitanAttack/globe", "heliTitanAttack/own", "heliTitanAttack/race", "london/own",
    "monster/bang", "monster/globe", "monster/own", "plane/globe", "plane/own", "plane/race", "planeDemo/globe", "planeDemo/own",
    "planeDemo/race", "planeParked/bang", "planeParked/own", "planeParked/race", "planeTitan/globe", "planeTitan/own", "planeTitan/race", "planeTitanAttack/globe", "planeTitanAttack/own", "planeTitanAttack/race", "police/own", "race/bang", "race/eject", "race/globe",
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
    // (v218) the giant robot: its edge arrow up where nothing wants it (behind the cards, in the rescue, in dad mode,
    // in something that cannot shoot, or with the robot not up), and any of its solids live where it is not drawn
    if (typeof titan !== "undefined" && titan.built) {
      const wantArrow = (titan.phase === "rising" || titan.phase === "up") && (k === "plane" || k === "heli") && !menuOpen() && !eject.active && !dadActive() && !st.exploding;
      if (!wantArrow && seen(el.titanArrow)) b("titan arrow left up", "the giant robot's arrow up with " + titan.phase + " in the " + state.vehicleKey);
      if (titan.recs.some(r => !isSolidHidden(r)) && !(titan.g.visible && titan.phase === "up")) b("titan solid while hidden", "a giant robot solid live while it is " + titan.phase + (titan.g.visible ? "" : ", not drawn"));
      // (v219) its attacks: one under way (winding up or striking) where nothing may attack him -- behind the cards, in
      // the rescue, in dad mode, in pieces, in something that cannot shoot -- or any piece of one (the boulder, the
      // ring, the dotted path, the beam, its glow) drawn with no attack on at all; and its tail off the registry with
      // no swipe on and none coming home
      const A = titan.atk, wantAtk = titan.phase === "up" && (k === "plane" || k === "heli") && !menuOpen() && !eject.active && !dadActive() && !st.exploding;
      if (A && A.on && (A.stage === "wind" || A.stage === "strike") && !wantAtk) b("titan attack under way", "the giant robot's " + A.kind + " " + A.stage + " with " + (st.exploding ? "him in pieces" : menuOpen() ? "the cards up" : eject.active ? "him in the rescue" : "him in the " + state.vehicleKey));
      if (!(A && A.on) && L.tnAtkShown()) b("titan attack piece left drawn", "a piece of the giant robot's attack drawn with no attack on");
      if (titan.tailOff && !(A && A.on && A.kind === "tail") && titan.tailBlend === 0 && !solidTest(L.tnTailRec(), st.x, st.y, st.z, L.TUNE.titan.insidePad)) b("titan tail left off", "the giant robot's tail off the registry, home, with him clear of it");
    }
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
    // (v218) beside the giant robot, a missile just into it: up, watching him, staggering
    planeTitan() { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(5); titanShot("plane"); },
    heliTitan() { SETUP.heli(); titanShot("heli"); },
    // (v219) an attack winding up at him: he flies (or hovers) at it, it facing him, provoked (here the harness's
    // flag: provocation is titan_checks' to prove), the kind chosen (titan.atkPick) -- run until its eyes flash, then on
    // a second into the wind-up
    planeTitanAttack() { titanAttack("plane", "boulder"); },
    heliTitanAttack() { SETUP.heli(); titanAttack("heli", "beam"); },
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
      step(40);   // into the count: its rumble rises from zero (crane.js:271, x (1 - t/count))
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
  // him 450 m off the robot's side at its body's height, pointed at it, a missile fired by the button, the hit seen
  function titanShot(veh) {
    L.tnForce("up"); step(2);
    const r = titan.recs.find(q => q.tnPart === "body"), c = { x: (r.cap.a[0] + r.cap.b[0]) / 2, y: (r.cap.a[1] + r.cap.b[1]) / 2, z: (r.cap.a[2] + r.cap.b[2]) / 2 };
    const yaw = titan.yaw + Math.PI / 2, x = c.x + Math.sin(yaw) * 450, z = c.z + Math.cos(yaw) * 450, h = Math.atan2(-(c.x - x), -(c.z - z));
    st.x = x; st.z = z; st.y = c.y; st.heading = h; st.pitch = 0; st.bank = 0; st.phase = "AIRBORNE"; st.missileCooldown = 0;
    if (veh === "heli") { heli.altitude = c.y; heli.vy = 0; heli.target = null; const v = L.TUNE.heli.cruise * 0.8; heli.vx = -Math.sin(h) * v; heli.vz = -Math.cos(h) * v; st.speed = v; }
    else { st.speed = st.vp.cruiseSpeed; st.engaged = false; st.approachData = null; st.gearDown = false; }
    const h0 = L.flags.tnHits || 0;
    tap(el.missileBtn);
    for (let i = 0; i < 60 * 5 && (L.flags.tnHits || 0) === h0; i++) { if (veh === "heli") { st.y = c.y; heli.altitude = c.y; } L.update(1 / 60); }
    titan.tnRowHit = (L.flags.tnHits || 0) - h0;
  }
  function titanAttack(veh, kind) {
    if (veh === "plane") { L.api.setVehicle("prop"); L.api.teleportAirborne(1200, 0, 320, 0); step(5); }
    const E = L.TUNE.titan.path[L.TUNE.titan.path.length - 1];
    L.tnForce("up"); titan.x = E[0]; titan.z = E[1]; titan.y = L.seaLevelAt(titan.x, titan.z); titan.yaw = Math.PI / 2; step(2);
    const sea = L.seaLevelAt(titan.x, titan.z);
    if (veh === "plane") { st.x = titan.x + 820; st.z = titan.z + 40; st.y = sea + 90; st.heading = Math.PI / 2; st.pitch = 0; st.bank = 0; st.speed = st.vp.cruiseSpeed; st.phase = "AIRBORNE"; st.engaged = false; }
    else { st.x = titan.x + 420; st.z = titan.z; st.y = sea + 70; heli.altitude = st.y; heli.vx = heli.vz = heli.vy = 0; heli.target = null; st.heading = Math.PI / 2; st.phase = "AIRBORNE"; }
    titan.provoked = true; titan.atkPick = kind;
    const f0 = L.flags.tnAtkFlashes || 0;
    for (let i = 0; i < 60 * 4 && (L.flags.tnAtkFlashes || 0) === f0; i++) { if (veh === "heli") heli.vx = heli.vz = 0; L.update(1 / 60); }
    for (let i = 0; i < 60; i++) { if (veh === "heli") heli.vx = heli.vz = 0; L.update(1 / 60); }
    titan.atkPick = null;
  }
  const air = () => st.phase === "AIRBORNE" || st.phase === "CLIMB_AWAY";
  const PROOF = {
    plane: () => air() && st.pitch < -10,
    planeParked: () => vehParked(),
    planeDemo: () => demo.phase === "charging" && numUp(),
    heli: () => air(),
    planeTitan: () => air() && titan.phase === "up" && titan.watching && titan.tnRowHit === 1 && titan.stagger > 0,
    heliTitan: () => air() && titan.phase === "up" && titan.watching && titan.tnRowHit === 1 && titan.stagger > 0,
    planeTitanAttack: () => air() && !!titan.atk && titan.atk.on && titan.atk.kind === "boulder" && titan.atk.stage === "wind" && titan.boulder.visible && titan.atkRing.visible,
    heliTitanAttack: () => air() && !!titan.atk && titan.atk.on && titan.atk.kind === "beam" && titan.atk.stage === "wind" && titan.atkGlow.visible && titan.atkRing.visible,
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

// ---------------------------------------------------------------------------
// (v222) THE LEAVE TABLE'S ORDER, PINNED. state.js's LEAVE_AT says which rows each place runs and in what order;
// the gate (gate 20) holds the names and the header grid to it, but not the ORDER -- and the order is behaviour
// (eventsSpawn draws from the stream; the three places disagree on it on purpose). Every row is wrapped to say
// that it ran, and where; each place is driven the way the game drives it; the rows are put back as they were.
// The expected lists are written out in node (LEAVE_ORDER), never read from LEAVE_AT.
function leaveOrderInPage() {
  const L = window.__lp;
  L.noRender = true;
  const press = (e, type) => e && e.dispatchEvent(new PointerEvent(type || "pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
  const orig = {}, log = [], out = {};
  for (const k of Object.keys(LEAVE)) {
    orig[k] = LEAVE[k];
    LEAVE[k] = function (at) { log.push(k + "@" + at); return orig[k].apply(this, arguments); };
  }
  const take = (name, fn) => { log.length = 0; try { fn(); out[name] = log.slice(); } catch (e) { out[name] = ["threw: " + e.message]; } };
  try {
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); L.api.skipScreens(); L.update(1 / 60);
    L.api.setVehicle("car");                                   // from something else, so each change is a change
    take("vehicle:plane", () => L.api.setVehicle("prop"));     // applyVehicle, to a non-boat non-rocket
    take("vehicle:boat", () => L.api.setVehicle("speedboat"));
    take("vehicle:rocket", () => L.api.setVehicle("rocket"));
    L.api.setVehicle("prop");
    take("start", () => L.api.spawnAt(0, 0));                  // spawnForTakeoff
    L.api.skipScreens(); L.update(1 / 60);
    take("picker", () => press(el.menuBtn));                   // openPickerAnywhere, by the menu button
    out.pickerOpened = !el.screenVehicle.classList.contains("hiddenS");
    L.api.skipScreens();
  } finally {
    for (const k of Object.keys(orig)) LEAVE[k] = orig[k];
  }
  out.unwrapped = Object.keys(orig).every(k => LEAVE[k] === orig[k]) && Object.keys(LEAVE).length === Object.keys(orig).length;
  return out;
}

// ---------------------------------------------------------------------------
// (v222, Q-18) OFF A BODY. In the rocket on the Moon, on Mars or docked at the station, then away by each route he
// has: the menu, a vehicle card (read behind the direction screen) and a direction card; the fresh-start switch
// the matrix drives (applyVehicle, spawnForTakeoff); from the Moon, dad mode. Afterwards rk.onBody is null and the
// ambient bed (currentBedName) is, sample for sample over five seconds, what the SAME route gives from the rocket
// on its Earth pad -- a delta against the place he went to, not a list of names. And where he must STAY: the menu
// opened on the body and put away (by the harness's hand: the game's picker only closes by a card) leaves him
// there, bed and all; the rocket card alone keeps him there; the rocket card and a direction card are a pad start.
function bodyLeaveInPage(arg) {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const step = (n) => { for (let i = 0; i < n; i++) L.update(1 / 60); };
  const press = (e, type) => e && e.dispatchEvent(new PointerEvent(type || "pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
  const tap = (e) => { press(e, "pointerdown"); press(e, "pointerup"); };
  const onScreen = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains("hiddenS"); };
  const closeScreens = () => { for (const id of ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"]) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); } };
  const on = () => rk.onBody ? rk.onBody.name : null;
  // (v223, Q-26) the PICTURE: the motorway and its signal heads drawn (highway.js updateHighway, lights.js ltUpdate),
  // the light environment and its values (scene.js updateLightMood), the fog and the body's haze (flight.js updateSky,
  // sky.js applyBodyHaze), the ambient birds and the high jets (ambient.js) -- each read as the game left it
  const rgb = (c) => [c.r, c.g, c.b];
  // the signal heads' group hangs off the scene, not the motorway's: a frame that skips ltUpdate leaves it drawn as it
  // was, frozen. So "the heads" is drawn AND driven: ltUpdate seen to run this frame (wrapped here, put back at the end)
  const ltReal = window.ltUpdate; let ltRan = -1;
  window.ltUpdate = function () { ltRan = frameCount; return ltReal.apply(this, arguments); };
  const pic = () => ({
    hwy: !!(highway.built && highway.g.visible), heads: !!(lights.built && lights.g.visible && ltRan === frameCount), env: currentLightEnv(),
    birds: !!birdMesh.visible, jets: highJets.filter(j => j.g.visible).length,
    sunI: sunLight.intensity, hemiI: hemiLight.intensity, sun: rgb(sunLight.color), sky: rgb(hemiLight.color), ground: rgb(hemiLight.groundColor),
    shadow: !!sunLight.castShadow, fogNear: scene.fog.near, fogFar: scene.fog.far, fog: rgb(scene.fog.color), haze: hazeF, spaceF: state.spaceF,
  });
  const snap = () => ({ body: on(), bed: currentBedName(), key: state.vehicleKey, pic: pic() });
  function fresh() {
    L.api.clearStick(); L.api.setThrottle(false);
    if (typeof dadActive === "function" && dadActive()) dadExit();
    closeScreens();
    try { localStorage.removeItem("lp.start"); } catch (e) {}
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); closeScreens(); step(30);
  }
  // in the rocket, on its Earth pad or on a body -- placed as the leaving matrix's rover, drone and astro rows place it
  function putOn(where) {
    fresh();
    L.api.setVehicle("rocket"); L.api.placeOnRunway(); closeScreens(); step(5);
    if (where === "station") {
      const b = BODIES.find(q => q.name === "station");
      st.dest = "station"; st.exploding = false; st.phase = "AIRBORNE"; rk.onBody = null; rk.launchedFromBody = false; rk.stage = 3;
      L.rocketApplyStages(L.vehicleModel);
      st.x = b.x; st.y = b.y - 200; st.z = b.z; st.pitch = 90; st.spaceF = 1; rk.vx = rk.vz = 0; rk.vy = 25;
      for (let i = 0; i < 60 * 40 && !rk.onBody; i++) L.update(1 / 60);
    } else if (where !== "earth") {
      const b = BODIES.find(q => q.name === where);
      st.dest = where; st.phase = "TAXI"; rk.stage = 3; rk.onBody = b;
      const n = where === "mars" ? new THREE.Vector3(0.62, 0.5, 0.6).normalize() : new THREE.Vector3(0, 1, 0);
      st.x = b.x + n.x * (b.r + 10); st.y = b.y + n.y * (b.r + 10); st.z = b.z + n.z * (b.r + 10);
    }
    step(60);
    return snap();
  }
  // five seconds of play after he is away: the bed and rk.onBody every half second, from the first second on
  function play() { const s = []; for (let i = 1; i <= 300; i++) { L.update(1 / 60); if (i >= 60 && i % 30 === 0) s.push(snap()); } return s; }
  const ROUTES = {
    // the menu button, the vehicle card (read behind the direction screen), the direction card
    menu(to) {
      press(el.menuBtn); const opened = onScreen("screenVehicle");
      step(30); tap(document.querySelector(`.vehCard[data-v="${to}"]`));
      step(30); const card = Object.assign(snap(), { dirUp: onScreen("screenDir") });
      press(document.querySelector('.dirCard[data-d="0"]'));
      if (onScreen("screenDest")) press(document.querySelector(".destCard.sel") || document.querySelector(".destCard"));
      return { opened, card, away: snap(), up: ["screenVehicle", "screenDir", "screenDest"].filter(onScreen) };
    },
    // the matrix's switch: applyVehicle and spawnForTakeoff, the game's own two
    switch(to) { L.api.setVehicle(to); L.api.spawnAt(0, 0); closeScreens(); return { away: snap(), up: [] }; },
    // (v223, Q-26) the vehicle card's London branch (input.js: started in London AND near it, a vehicle that can start
    // there starts there). HARNESS-STAGED: his start is set to London by hand -- a rocket's start is never London (the
    // globe and the London branch both refuse a rocket, ldCanStart) -- so this asks only that from a body the branch is
    // not taken (he is nowhere near London) and he goes on through the direction screen, as from the Earth pad
    london(to) {
      st.originIdx = ldn.airportIdx;
      const r = ROUTES.menu(to);
      return Object.assign(r, { staged: true });
    },
    // dad mode (the parent's: its own exit brings him back on the vehicles)
    dad() {
      dadEnter(); step(60); const inDad = snap();
      dadExit(); closeScreens(); step(5);
      return { inDad, away: snap(), up: [] };
    },
  };
  const out = { leave: [], stay: [] };
  for (const where of arg.bodies) {
    for (const [route, to, extra] of arg.routes[where].map(q => q.concat(false)).concat((arg.extra[where] || []).map(q => q.concat(true)))) {
      const ref = putOn("earth"), refRun = ROUTES[route](to), refPlay = play();
      const before = putOn(where), run = ROUTES[route](to), after = play();
      out.leave.push({ where, route, to, extra, ref, refRun, refBeds: refPlay.map(s => s.bed), refPics: refPlay.map(s => s.pic), before, run, after });
    }
    // the stays: the menu put away, the rocket card alone, then a direction card (a pad start)
    {
      const before = putOn(where), p0 = { x: st.x, y: st.y, z: st.z };
      press(el.menuBtn); const opened = onScreen("screenVehicle"); step(60);
      L.api.skipScreens(); step(120);
      const moved = Math.hypot(st.x - p0.x, st.y - p0.y, st.z - p0.z);
      out.stay.push({ where, kind: "menu put away", before, opened, after: snap(), moved: +moved.toFixed(2) });
    }
    {
      const before = putOn(where);
      press(el.menuBtn); step(30); tap(document.querySelector('.vehCard[data-v="rocket"]')); step(30);
      const card = snap();
      press(document.querySelector('.dirCard[data-d="0"]'));
      if (onScreen("screenDest")) press(document.querySelector(".destCard.sel") || document.querySelector(".destCard"));
      step(60);
      const pad = rocketPad(0), dPad = Math.hypot(st.x - pad.x, st.z - pad.z);
      out.stay.push({ where, kind: "rocket again", before, card, after: snap(), dPad: +dPad.toFixed(1), up: ["screenVehicle", "screenDir", "screenDest"].filter(onScreen) });
    }
  }
  fresh();
  window.ltUpdate = ltReal;
  return out;
}

// ---------------------------------------------------------------------------
// (v223, Q-21) THE MENU MID-CHASE. A chase (police.js) starts when he runs a red in a car; the menu button is up
// all the while. Behind the cards nothing runs updatePolice (it is called from updateHighway, after the picker's
// hold), so the chase stayed on and its siren held its last gain, unwritten, for as long as he sat on the cards
// -- and the engine stayed ducked under it. Driven by touch from the chase (the menu button, then a car card and
// a direction card); the chase itself started as police_checks starts one (policeStart, the red's own call).
// And where it must STAY: a bang mid-chase is not a leaving (CLAUDE.md: a chase is never ended by crashing), and
// the menu opened with no chase ends nothing.
async function chaseMenuInPage() {
  const L = window.__lp, st = L.state;
  L.noRender = true;
  const step = (n) => { for (let i = 0; i < n; i++) L.update(1 / 60); };
  const press = (e, type) => e && e.dispatchEvent(new PointerEvent(type || "pointerdown", { bubbles: true, cancelable: true, pointerId: 7, clientX: 0, clientY: 0 }));
  const tap = (e) => { press(e, "pointerdown"); press(e, "pointerup"); };
  const onScreen = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains("hiddenS"); };
  const closeScreens = () => { for (const id of ["screenVehicle", "screenDir", "screenDest", "screenRace", "screenGlobe"]) { const e = document.getElementById(id); if (e) e.classList.add("hiddenS"); } };
  // the siren's writes, stamped (put back at the end)
  // (v224, Q-27b) ... and each write above zero, and the police cars and the numeral in every reading
  const setToneReal = window.setTone, wrote = {}, hot = {};
  window.setTone = function (n, type, f, g) { wrote[n] = frameCount; if (g > 0) hot[n] = frameCount; return setToneReal.apply(this, arguments); };
  const tone = (n) => tones[n] ? Math.max(0, tones[n].last) : 0;
  const siren = () => ({ siren: +tone("policeSiren").toFixed(4), sirenB: +tone("policeSirenB").toFixed(4), written: wrote.policeSiren === frameCount,
                         chase: !!police.active, duck: +engBus.duck.toFixed(3), cards: onScreen("screenVehicle"),
                         cars: !!(police.g && police.g.visible), num: el.bigNum.textContent || "", state: police.state });
  const series = (n) => { const s = []; for (let i = 1; i <= n; i++) { L.update(1 / 60); if (i % 30 === 0) s.push(siren()); } return s; };
  const drive = (n) => { for (let i = 0; i < n; i++) { L.api.setStick(0, 0); L.update(1 / 60); } };
  function inCar() {
    L.api.clearStick(); L.api.setThrottle(false); closeScreens();
    try { localStorage.removeItem("lp.start"); } catch (e) {}
    L.api.setVehicle("car"); L.api.spawnAt(0, 0); closeScreens(); step(10);
    drive(60 * 6);
  }
  function chase() { inCar(); L.policeStart(null); drive(60 * 3); return siren(); }
  // (v224, Q-27b) the siren's writes after frame f0 (the press: policeStop's own silence is written on it, outside
  // update): any at all, and any above zero. A car stopped at a pull-over is PARKED, so behind the cards the whole
  // frame runs (no hold) and updatePolice, with no chase, writes the siren at zero every frame -- that is the
  // silence's owner; a write above zero would be the chase back
  const writesSince = (f0) => ({ any: (wrote.policeSiren || -1) > f0 || (wrote.policeSirenB || -1) > f0,
                                 hot: (hot.policeSiren || -1) > f0 || (hot.policeSirenB || -1) > f0 });
  // the menu by touch, four seconds on the cards; then the cards put away (skipScreens: no start, nothing picked)
  function menuBehind(before, extra) {
    const e0 = flags.policeEnded || 0;
    L.api.clearStick(); press(el.menuBtn);
    const f0 = frameCount, opened = onScreen("screenVehicle"), parked = vehParked();
    const behind = series(60 * 4), writes = writesSince(f0);
    closeScreens();
    return Object.assign({ before, opened, parked, behind, writes, ended: (flags.policeEnded || 0) - e0, exploding: st.exploding }, extra || {});
  }
  const out = {};
  try {
    try { unlockAudio(); if (audioCtx && audioCtx.state !== "running") await audioCtx.resume(); startEngine(); } catch (e) {}
    out.audio = audioCtx ? audioCtx.state : null;
    // ---- the leaving: the menu mid-chase, four seconds on the cards, then a car card and a direction card
    {
      const before = chase(), e0 = flags.policeEnded || 0;
      L.api.clearStick(); press(el.menuBtn);
      // (v225, Q-28) opened and parked MEASURED on the press, as menuBehind does, never handed in as literals
      const f0 = frameCount, opened = onScreen("screenVehicle"), parked = vehParked(), behind = series(60 * 4), writes = writesSince(f0);
      tap(document.querySelector('.vehCard[data-v="car"]')); step(10);
      press(document.querySelector('.dirCard[data-d="0"]'));
      const after = series(60 * 2);
      out.menu = { before, opened, parked, behind, writes, after, ended: (flags.policeEnded || 0) - e0, up: ["screenVehicle", "screenDir", "screenDest"].filter(onScreen) };
    }
    // ---- a stay: a bang mid-chase (him, at speed, inside the nearest solid that blocks a car -- the leaving matrix's bang)
    {
      const before = chase(), e0 = flags.policeEnded || 0, cls = vehSolidClass();
      let best = null, bd = Infinity;
      L.forEachSolid(b => {
        if (b.o3 || b.cap || b.ramp || b.toy || b.moving || b.car !== undefined || b.park) return;
        if (!L.solidBlocks(b, cls) || (b.mesh && b.mesh.visible === false) || L.isSolidHidden(b)) return;
        if (!(b.hw > 3 && b.hd > 3 && b.y1 - b.y0 > 6)) return;
        const d = Math.hypot(b.x - st.x, b.z - st.z);
        if (d < bd) { bd = d; best = b; }
      }, st.x, st.z, 2000);
      let banged = false;
      if (best) {
        st.x = best.x; st.z = best.z + best.hd - 1; st.y = Math.max(best.y0, L.terrainEff(st.x, st.z)); st.heading = 0; st.speed = state.vp.cruiseSpeed || 40;
        for (let n = 0; n < 60 && !banged; n++) { L.update(1 / 60); if (st.exploding) banged = true; }
        for (let n = 0; n < 60 * 10 && st.exploding; n++) L.update(1 / 60);
      }
      const back = !st.exploding;
      const after = series(60 * 2);
      out.bang = { before, banged, back, after, ended: (flags.policeEnded || 0) - e0, solid: !!best };
      L.policeStop(false);
    }
    // ---- a stay: the menu opened in the car with no chase ends nothing
    {
      inCar(); const e0 = flags.policeEnded || 0, was = police.active;
      press(el.menuBtn); const opened = onScreen("screenVehicle"); step(60);
      out.noChase = { was, opened, ended: (flags.policeEnded || 0) - e0, chase: !!police.active, key: state.vehicleKey };
      closeScreens();
    }
    // ---- (v224, Q-27b) four more chases the menu ends, each in the state he is really in
    out.more = {};
    // the pull-over's 3-2-1: finger off, the car stops, they catch him, and the shared numeral counts
    {
      const before0 = chase();
      L.api.clearStick();
      for (let n = 0; n < 60 * 15 && !(police.state === "pullover" && el.bigNum.textContent); n++) L.update(1 / 60);
      out.more.pullover = menuBehind(siren(), { chaseBefore: before0 });
    }
    // in pieces mid-chase: the menu on the frame he is in pieces (the picker's rows: `pieces`, then `police`)
    {
      const before0 = chase(), cls = vehSolidClass();
      let best = null, bd = Infinity;
      L.forEachSolid(b => {
        if (b.o3 || b.cap || b.ramp || b.toy || b.moving || b.car !== undefined || b.park) return;
        if (!L.solidBlocks(b, cls) || (b.mesh && b.mesh.visible === false) || L.isSolidHidden(b)) return;
        if (!(b.hw > 3 && b.hd > 3 && b.y1 - b.y0 > 6)) return;
        const d = Math.hypot(b.x - st.x, b.z - st.z);
        if (d < bd) { bd = d; best = b; }
      }, st.x, st.z, 2000);
      let banged = false;
      if (best) {
        st.x = best.x; st.z = best.z + best.hd - 1; st.y = Math.max(best.y0, L.terrainEff(st.x, st.z)); st.heading = 0; st.speed = state.vp.cruiseSpeed || 40;
        for (let n = 0; n < 60 && !banged; n++) { L.api.setStick(0, 0); L.update(1 / 60); if (st.exploding) banged = true; }
      }
      const inPieces = st.exploding, chaseInPieces = !!police.active;
      out.more.pieces = menuBehind(siren(), { chaseBefore: before0, banged, inPieces, chaseInPieces, solid: !!best });
    }
    // a chase begun at a REAL red: the motorway's first crossroads held red, crossed at speed (ltWatchCar's own call)
    {
      inCar();
      const j = lights.junctions[0], r0 = flags.redsRun || 0;
      j.phase = 2; j.t = 999;
      st.x = j.x - j.fx * 60; st.z = j.z - j.fz * 60; st.y = j.y;
      st.heading = Math.atan2(-j.fx, -j.fz); st.speed = 30; st.exploding = false;
      for (let n = 0; n < 60 * 10 && !police.active; n++) { L.api.setStick(0, 0); L.update(1 / 60); st.speed = Math.max(st.speed, 30); }
      const fromRed = police.active && police.from === j, reds = (flags.redsRun || 0) - r0;
      drive(60 * 2);
      out.more.red = menuBehind(siren(), { fromRed, reds });
    }
    // a chase in a city: New York's streets, on a long grid street's lane, at the speed he drives there
    {
      inCar();
      const C = streets.cities.ny, road = C.roads.filter(q => q.kind === "grid" && q.len > 90).sort((a, b) => b.len - a.len)[2], q = {};
      stPointAt(road, 10, 1, road.lo, q);
      st.x = q.x; st.z = q.z; st.heading = Math.atan2(-q.fx, -q.fz);
      st.y = stSurfaceAt(q.x, q.z) ?? L.terrainEff(q.x, q.z); st.speed = 12; st.exploding = false;
      car.yield = 1; car.steer = 0; car.crashCool = 0; car.assistOff = 0;
      stPlan.road = road; stPlan.dir = 1; stPlan.turn = null; stTrail.pts.length = 0; stTrail.lastX = null;
      drive(60 * 2);
      const started = L.policeStart(null);
      drive(60 * 2);
      out.more.city = menuBehind(siren(), { started, onStreet: !!car.onStreet, road: stPlan.road ? stPlan.road.kind : null });
    }
  } finally {
    window.setTone = setToneReal;
    L.api.clearStick(); closeScreens();
    if (police.active) L.policeStop(false);
    L.api.setVehicle("prop"); L.api.spawnAt(0, 0); closeScreens(); step(10);
  }
  return out;
}

// ===========================================================================
// in node
// ===========================================================================
const CFG = { HOLD, FROZEN, SETTLE, CLEAN, TONE_OWNER, SOURCE_TONES, DISTANCE_TONES };

// (v222) each place's rows, in the order it runs them: written out, never read from state.js
const LEAVE_ORDER = {
  "vehicle:plane":  ["monster", "robot", "crane", "heavy", "heli", "track", "corvette", "rocketRoar", "cabin", "helm", "yacht", "cannon", "tones", "audioHold",
                     "reentry", "reentryRoar", "rocketButtons", "rover", "astro", "recovery", "body"],
  "vehicle:boat":   ["monster", "robot", "crane", "heavy", "heli", "track", "corvette", "rocketRoar", "cabin", "helm", "yacht", "tones", "audioHold",
                     "reentry", "reentryRoar", "rocketButtons", "rover", "astro", "recovery", "body"],
  "vehicle:rocket": ["monster", "robot", "crane", "heavy", "heli", "track", "corvette", "rocketRoar", "cabin", "helm", "yacht", "cannon", "tones", "audioHold"],
  "start":          ["audioHold", "race", "demo", "robot", "police", "track", "events", "towerCatch", "carrier", "heli"],
  "picker":         ["throttle", "keys", "finger", "stick", "pieces", "rover", "astro", "recovery", "heli", "cannon", "horn", "race", "police"],   // (v223: police, Q-21)
};
const LEAVE_ORDER_SAY = {
  "vehicle:plane": "a vehicle change to a plane (applyVehicle: not a boat, not a rocket)", "vehicle:boat": "a vehicle change to a boat",
  "vehicle:rocket": "a vehicle change to a rocket", start: "a fresh start (spawnForTakeoff)", picker: "the menu button (openPickerAnywhere)",
};
// (v222, Q-18) the routes off each body: [route, the card he picks]
const BODY_ROUTES = {
  moon:    [["menu", "prop"], ["menu", "car"], ["switch", "prop"], ["switch", "car"], ["dad", null]],
  mars:    [["menu", "prop"], ["menu", "car"], ["switch", "prop"], ["switch", "car"]],
  station: [["menu", "prop"], ["menu", "car"], ["switch", "prop"], ["switch", "car"]],
};
// (v223, Q-26) and the routes 0d did not measure: away to the speedboat and the helicopter, the vehicle card's London
// branch (harness-staged: see ROUTES.london), dad mode from Mars and the station
const BODY_ROUTES_MORE = {};
for (const b of ["moon", "mars", "station"]) {
  BODY_ROUTES_MORE[b] = [["menu", "speedboat"], ["menu", "helicopter"], ["switch", "speedboat"], ["switch", "helicopter"], ["london", "car"]];
  if (b !== "moon") BODY_ROUTES_MORE[b].push(["dad", null]);
}
const BODY_BED = { moon: "moon", mars: "mars", station: "moon" };   // currentBedName on each (the station has no bed of its own: pinned as it is, Q-26)
// (v223, Q-26) the picture after he is away, against the same route from the Earth pad: what is ON or OFF (the
// motorway, its signal heads, the light environment, the birds, the high jets) at every half second from the first
// second on; the eased values (the light, the fog, the haze, the space blend) at the last two readings, within EASE_TOL
// -- the game eases the light and the haze home (TUNE.light.blend, sky.js applyBodyHaze), so a reading in the first
// seconds may differ by the ease alone
const PIC_ONOFF = ["hwy", "heads", "env", "birds", "jets", "shadow"];
const PIC_EASED = ["sunI", "hemiI", "sun", "sky", "ground", "fogNear", "fogFar", "fog", "haze", "spaceF"];
// relative to the reference's value (absolute under 1). The space blend eases home at 1.4/s (flight.js frameWorld), so by
// the fresh-start route the fog's far edge is still 1.2% out at 4.5 s (1578 m for 1560): an ease. A body left behind is
// out by far more -- the Moon's light (sunI 1.30, hemiI 0.22 for Earth's ~1.0), its haze (fog to 20 km), Mars's (2.1 km)
const EASE_TOL = 0.03;
function picDiff(got, ref) {
  const out = [];
  for (let i = 0; i < Math.min(got.length, ref.length); i++) {
    for (const k of PIC_ONOFF) if (got[i][k] !== ref[i][k]) out.push(`${(i + 2) / 2} s ${k}: ${got[i][k]} (from the Earth pad ${ref[i][k]})`);
  }
  for (let i = Math.max(0, got.length - 2); i < Math.min(got.length, ref.length); i++) {
    for (const k of PIC_EASED) {
      const a = [].concat(got[i][k]), b = [].concat(ref[i][k]);
      if (a.some((v, j) => !(Math.abs(v - b[j]) <= EASE_TOL * Math.max(1, Math.abs(b[j]))))) out.push(`${(i + 2) / 2} s ${k}: ${a.map(v => +v.toFixed(3)).join(",")} (from the Earth pad ${b.map(v => +v.toFixed(3)).join(",")})`);
    }
  }
  if (got.length !== ref.length || got.length < 2) out.push(`${got.length} readings, ${ref.length} from the Earth pad`);
  return out;
}

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
    // a writer calls countdownTo / setBigNum / numShow (their own definitions are not calls; v226: numShow is the
    // owned digit the lock and the race write,
    // and spCountStep, the shared count step the barge's numeral goes through)
    const calls = src.replace(/function (setBigNum|countdownTo|countdownClear|numShow|spCountStep)\([^)]*\)\s*\{[^\n]*/g, "");
    if (/\b(countdownTo|setBigNum|numShow|spCountStep)\(/.test(calls)) writers.add(f);
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

  // ---- 0c. (v222) the LEAVE table's order, pinned: each place runs exactly its rows, in exactly this order
  {
    const { page, ctx } = await newPage(PORTRAIT[0], PORTRAIT[1]);
    const o = await page.evaluate(leaveOrderInPage);
    for (const [name, want] of Object.entries(LEAVE_ORDER)) {
      const place = name.split(":")[0], got = o[name] || [];
      const rows = got.map(x => x.split("@")[0]), wrongAt = got.filter(x => x.split("@")[1] !== place);
      check(`leave order: ${LEAVE_ORDER_SAY[name]} runs its LEAVE rows in exactly the pinned order, each told its place, and the rows are put back unwrapped`,
        JSON.stringify(rows) === JSON.stringify(want) && !wrongAt.length && o.unwrapped && (place !== "picker" || o.pickerOpened),
        { got: rows, want, wrongAt, unwrapped: o.unwrapped, pickerOpened: o.pickerOpened });
    }
    await ctx.close().catch(() => {});
  }

  // ---- 0d. (v222, Q-18) off a body, the body is gone: rk.onBody, and the bed is the new place's; on it, he stays
  {
    const { page, ctx } = await newPage(PORTRAIT[0], PORTRAIT[1]);
    const r = await page.evaluate(bodyLeaveInPage, { bodies: Object.keys(BODY_ROUTES), routes: BODY_ROUTES, extra: BODY_ROUTES_MORE });
    const BODY_BEDS = ["moon", "mars"];
    const BODY_SAY = { moon: "the Moon", mars: "Mars", station: "the station" };
    // one route's body and bed (v222's judge, unchanged), into bad
    const judgeBody = (c, bad) => {
      const where = c.where, tag = `${c.route}${c.to ? " to " + c.to : ""}`;
      if (c.before.body !== where || c.before.key !== "rocket" || c.before.bed !== BODY_BED[where]) bad.push(`${tag}: not on ${where} in the rocket first (${JSON.stringify({ body: c.before.body, bed: c.before.bed, key: c.before.key })})`);
      if (c.ref.body !== null || c.ref.key !== "rocket") bad.push(`${tag}: the reference not on the Earth pad (${JSON.stringify({ body: c.ref.body, key: c.ref.key })})`);
      if (c.run.up.length || c.refRun.up.length) bad.push(`${tag}: screens still up (${c.run.up.concat(c.refRun.up).join(", ")})`);
      if (c.route === "menu" || c.route === "london") {
        if (!c.run.opened) bad.push(`${tag}: the menu did not open`);
        if (!c.run.card.dirUp) bad.push(`${tag}: the direction screen not up after the vehicle card${c.route === "london" ? " (the London branch taken from a body)" : ""}`);
        if (c.run.card.key !== c.to || c.run.card.body !== null) bad.push(`${tag}: behind the direction screen, in the ${c.run.card.key}, rk.onBody is ${c.run.card.body} (the vehicle card takes him off the body)`);
        if (c.route === "london" && (!c.refRun.card.dirUp || !c.run.staged)) bad.push(`${tag}: from the Earth pad the direction screen not up either, or not staged`);
      }
      if (c.route === "dad" && (c.run.inDad.body !== null || BODY_BEDS.includes(c.run.inDad.bed))) bad.push(`${tag}: in dad mode rk.onBody is ${c.run.inDad.body}, the bed ${c.run.inDad.bed}`);
      const want = c.route === "dad" ? "rocket" : c.to;
      if (c.run.away.key !== want || c.run.away.body !== null) bad.push(`${tag}: away, in the ${c.run.away.key}, rk.onBody is ${c.run.away.body}`);
      const beds = c.after.map(s => s.bed), bodies = c.after.filter(s => s.body !== null).map(s => s.body);
      if (bodies.length) bad.push(`${tag}: rk.onBody still set during play (${bodies.join(", ")})`);
      if (beds.some(b => BODY_BEDS.includes(b)) || JSON.stringify(beds) !== JSON.stringify(c.refBeds)) bad.push(`${tag}: the bed over five seconds was ${beds.join(" ")}; from the Earth pad the same route gives ${c.refBeds.join(" ")}`);
    };
    for (const where of Object.keys(BODY_ROUTES)) {
      const bad = [];
      for (const c of r.leave.filter(q => q.where === where && !q.extra)) judgeBody(c, bad);
      check(`leave a body (Q-18): from the rocket on ${BODY_SAY[where]}, away to the plane and the SUV by the menu, a vehicle card and a direction card, and by a fresh start${where === "moon" ? ", and into dad mode" : ""} -- rk.onBody is null from the vehicle card on, and for five seconds of play the ambient bed is what the same route gives from the Earth pad, never the body's`,
        r.leave.some(q => q.where === where && !q.extra) && bad.length === 0, { bad, routes: r.leave.filter(q => q.where === where && !q.extra).map(q => ({ route: q.route, to: q.to, beds: q.after.map(s => s.bed).join(" "), ref: q.refBeds.join(" ") })) });
    }
    // (v223, Q-26) the routes v222 did not drive: the same judge
    for (const where of Object.keys(BODY_ROUTES_MORE)) {
      const bad = [], cs = r.leave.filter(q => q.where === where && q.extra);
      for (const c of cs) judgeBody(c, bad);
      check(`leave a body (Q-26): from the rocket on ${BODY_SAY[where]}, away to the speedboat and the helicopter by the menu, a vehicle card and a direction card, and by a fresh start; by the vehicle card with his start in London (harness-staged: the London branch is not taken from a body, the direction screen comes up as from the Earth pad)${where === "moon" ? "" : "; into dad mode and out"} -- rk.onBody is null from the vehicle card on, and for five seconds of play the ambient bed is what the same route gives from the Earth pad`,
        cs.length === BODY_ROUTES_MORE[where].length && bad.length === 0, { bad, routes: cs.map(q => ({ route: q.route, to: q.to, beds: q.after.map(s => s.bed).join(" "), ref: q.refBeds.join(" ") })) });
    }
    // (v223, Q-26) and the PICTURE, every route off each body: what the same route gives from the Earth pad
    for (const where of Object.keys(BODY_ROUTES)) {
      const bad = [], cs = r.leave.filter(q => q.where === where);
      for (const c of cs) {
        const tag = `${c.route}${c.to ? " to " + c.to : ""}`;
        for (const d of picDiff(c.after.map(s => s.pic), c.refPics)) bad.push(`${tag}: ${d}`);
        // ... and the reference is Earth's picture, so equal means Earth: the motorway and its heads drawn in a car (the
        // plane's runway has the motorway in the world too), the Earth light, the birds
        const last = c.refPics[c.refPics.length - 1] || {};
        // (v224, Q-27a) ... and its signal heads drawn and DRIVEN, and the high jets out (all three of them on Earth at
        // any height: ambient.js updateHighJets hides them only in space or on a body) -- else a probe that stops seeing
        // the call (the ltUpdate wrap) reads false on both sides and "equal" passes
        if (last.env !== "earth" || !last.birds || !last.hwy || !last.heads || !(last.jets > 0)) bad.push(`${tag}: the reference itself is not Earth's picture (${JSON.stringify({ env: last.env, birds: last.birds, hwy: last.hwy, heads: last.heads, jets: last.jets })})`);
      }
      check(`leave a body (Q-26): from the rocket on ${BODY_SAY[where]}, by every route above, the PICTURE for five seconds is what the same route gives from the Earth pad -- the motorway and its signal heads drawn, the light environment Earth's, the birds and the high jets out, from the first second; the light, the fog, the haze and the space blend eased home by the last second`,
        cs.length === BODY_ROUTES[where].length + BODY_ROUTES_MORE[where].length && bad.length === 0,
        { bad: bad.slice(0, 12), nBad: bad.length, off: bad.reduce((o, b) => { const [t, d] = b.split(": "), k = (/ s (\w+)$/.exec(d) || [, d.slice(0, 40)])[1]; (o[t] = o[t] || []).includes(k) || o[t].push(k); return o; }, {}), routes: cs.map(q => { const p = q.after[q.after.length - 1].pic; return `${q.route}${q.to ? ">" + q.to : ""}: hwy ${p.hwy} heads ${p.heads} ${p.env} birds ${p.birds} sunI ${+p.sunI.toFixed(2)} fog ${Math.round(p.fogNear)}-${Math.round(p.fogFar)}`; }) });
    }
    {
      const bad = [];
      for (const s of r.stay) {
        const tag = `${s.where}, ${s.kind}`;
        if (s.before.body !== s.where || s.before.key !== "rocket") { bad.push(`${tag}: not on it first (${JSON.stringify(s.before)})`); continue; }
        if (s.kind === "menu put away") {
          if (!s.opened) bad.push(`${tag}: the menu did not open`);
          if (s.after.body !== s.where || s.after.key !== "rocket" || s.after.bed !== s.before.bed || s.moved > 5) bad.push(`${tag}: ${JSON.stringify(s.after)}, moved ${s.moved} m (want: still on it, in the rocket, the ${s.before.bed} bed, where he was)`);
        } else {
          if (s.card.body !== s.where || s.card.key !== "rocket" || s.card.bed !== s.before.bed) bad.push(`${tag}: after the rocket card alone ${JSON.stringify(s.card)} (want: still on it, the ${s.before.bed} bed)`);
          if (s.after.body !== null || s.after.key !== "rocket" || s.dPad > 30 || BODY_BEDS.includes(s.after.bed) || s.up.length) bad.push(`${tag}: after the direction card ${JSON.stringify(s.after)}, ${s.dPad} m from the pad, screens ${s.up.join(",") || "none"} (want: a pad start)`);
        }
      }
      check("leave a body (Q-18), where he STAYS: on the Moon, on Mars and at the station, the menu opened and put away leaves him there in the rocket, bed and all, where he was; the rocket card alone keeps him there; the rocket card and a direction card are a pad start, as ever",
        r.stay.length === 6 && bad.length === 0, { bad, stays: r.stay.map(s => `${s.where} ${s.kind}: ${s.after.body} ${s.after.bed}`) });
    }
    await ctx.close().catch(() => {});
  }

  // ---- 0e. (v223, Q-21) the menu mid-chase ends the chase: no siren held behind the cards; a bang does not end it
  {
    const { page, ctx } = await newPage(PORTRAIT[0], PORTRAIT[1]);
    const r = await page.evaluate(chaseMenuInPage);
    const m = r.menu || {}, b = r.bang || {}, n = r.noChase || {};
    {
      const bad = [];
      if (r.audio !== "running") bad.push(`audio ${r.audio}`);
      if (!m.before || !m.before.chase || !(m.before.siren > 0.002) || !m.before.written) bad.push(`no chase, or no siren, before the menu (${JSON.stringify(m.before)})`);
      const behind = m.behind || [];
      if (behind.length !== 8) bad.push(`${behind.length} readings behind the cards`);
      behind.forEach((s, i) => { if (!s.cards || s.chase || s.siren > 0 || s.sirenB > 0 || s.duck !== 1) bad.push(`${(i + 1) / 2} s behind the cards: ${JSON.stringify(s)}`); });
      (m.after || []).forEach((s, i) => { if (s.chase || s.siren > 0 || s.sirenB > 0) bad.push(`${(i + 1) / 2} s after the direction card: ${JSON.stringify(s)}`); });
      if (m.ended !== 1 || (m.up || []).length) bad.push(`chase ended ${m.ended} times, screens up ${(m.up || []).join(",")}`);
      check("leave a chase (Q-21): the menu opened mid-chase, by touch, ends it -- for four seconds on the cards no siren (both voices at zero, from the first half-second), the chase over and the engine no longer ducked under it; a car card and a direction card after, still none",
        bad.length === 0, { bad: bad.slice(0, 10), before: m.before, behind: (m.behind || []).map(s => `${s.siren}/${s.sirenB} chase ${s.chase} duck ${s.duck}`).join("; ") });
    }
    {
      const bad = [];
      if (!b.solid || !b.banged || !b.back) bad.push(`the bang: solid ${b.solid}, banged ${b.banged}, back ${b.back}`);
      if (!b.before || !b.before.chase) bad.push(`no chase before the bang`);
      (b.after || []).forEach((s, i) => { if (!s.chase || !s.written) bad.push(`${(i + 1) / 2} s after the reassembly: ${JSON.stringify(s)}`); });
      if (b.ended !== 0) bad.push(`the bang ended the chase (${b.ended})`);
      if (!n.opened || n.was || n.ended !== 0 || n.chase || n.key !== "car") bad.push(`the menu with no chase: ${JSON.stringify(n)}`);
      check("leave a chase (Q-21), where it STAYS: a bang mid-chase is not a leaving -- reassembled, the chase goes on, its siren written every frame (CLAUDE.md: never ended by crashing); and the menu opened in the car with no chase ends nothing",
        bad.length === 0, { bad, bangAfter: (b.after || []).map(s => `${s.siren} chase ${s.chase} written ${s.written}`).join("; "), noChase: n });
    }
    // (v224, Q-27b) the menu ends every chase he can be in: the motorway's (above), the pull-over's 3-2-1, in pieces,
    // one begun at a real red, one in a city. Behind the cards: the chase over, no siren, the police cars hidden, the
    // numeral gone, and the siren not written again (moving: not at all, the hold; stopped at the pull-over he is
    // parked, the frame runs, and only its owner's silence is written)
    {
      const mo = r.more || {}, bad = [];
      const judge = (tag, c, want) => {
        if (!c) { bad.push(`${tag}: not run`); return; }
        if (!c.opened) bad.push(`${tag}: the menu did not open`);
        if (c.ended !== 1) bad.push(`${tag}: the chase ended ${c.ended} times`);
        const bh = c.behind || [];
        if (bh.length !== 8) bad.push(`${tag}: ${bh.length} readings behind the cards`);
        bh.forEach((s, i) => { if (!s.cards || s.chase || s.siren > 0 || s.sirenB > 0 || s.cars || s.num !== "" || s.duck !== 1) bad.push(`${tag}, ${(i + 1) / 2} s behind the cards: ${JSON.stringify(s)}`); });
        if (!c.writes || c.writes.hot) bad.push(`${tag}: the siren written above zero behind the cards`);
        if (!c.parked && c.writes && c.writes.any) bad.push(`${tag}: moving, and the siren written at all behind the cards (nothing should run it there)`);
        if (want.parked !== undefined && c.parked !== want.parked) bad.push(`${tag}: parked ${c.parked} behind the cards, want ${want.parked}`);
        if (c.exploding) bad.push(`${tag}: still in pieces behind the cards`);
      };
      judge("motorway", m.behind ? { opened: m.opened, ended: m.ended, behind: m.behind, writes: m.writes, parked: m.parked } : null, { parked: false });
      const p = mo.pullover;
      if (!p || p.before.state !== "pullover" || !/^[1-3]$/.test(p.before.num) || !p.before.chase || !p.before.cars) bad.push(`pull-over: not caught with the numeral up before the menu (${JSON.stringify(p && p.before)})`);
      judge("pull-over", p, { parked: true });
      const q = mo.pieces;
      if (!q || !q.solid || !q.banged || !q.inPieces || !q.chaseInPieces) bad.push(`pieces: not in pieces mid-chase at the menu (${JSON.stringify(q && { solid: q.solid, banged: q.banged, inPieces: q.inPieces, chase: q.chaseInPieces })})`);
      judge("pieces", q, {});
      const rd = mo.red;
      if (!rd || !rd.fromRed || rd.reds !== 1 || !rd.before.chase || !(rd.before.siren > 0.002)) bad.push(`red: no chase from the red's own call before the menu (${JSON.stringify(rd && { fromRed: rd.fromRed, reds: rd.reds, before: rd.before })})`);
      judge("red", rd, { parked: false });
      const cy = mo.city;
      if (!cy || !cy.started || !cy.onStreet || cy.road !== "grid" || !cy.before.chase || !(cy.before.siren > 0.002)) bad.push(`city: no chase on a New York street before the menu (${JSON.stringify(cy && { started: cy.started, onStreet: cy.onStreet, road: cy.road, before: cy.before })})`);
      judge("city", cy, { parked: false });
      check("leave a chase (Q-27b): the menu, by touch, ends the chase in every state he is in -- on the motorway, during the pull-over's 3-2-1, in pieces mid-chase, begun at a real red, in a city -- and for four seconds behind the cards the chase is over, both siren voices at zero, the police cars hidden, the numeral gone, the engine unducked, and the siren never written above zero again (moving: not written at all)",
        bad.length === 0, { bad: bad.slice(0, 12), nBad: bad.length,
          cases: Object.fromEntries(Object.entries(mo).map(([k, c]) => [k, c && { parked: c.parked, ended: c.ended, writes: c.writes, before: c.before && `${c.before.state} siren ${c.before.siren} num '${c.before.num}' cars ${c.before.cars}`, behind0: c.behind && c.behind[0] && JSON.stringify(c.behind[0]) }])) });
    }
    await ctx.close().catch(() => {});
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
