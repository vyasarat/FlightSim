"use strict";
// v209's evidence: the sleepy rover on Mars, as he would find it. Portrait and
// landscape, both views:
//
//   node scripts/pal_renders.js [root]
//
//   asleep-drone   asleep, its blink lit, seen from the little drone at hover 45 m off
//   asleep-far     asleep, its blink lit, from his rover 140 m out
//   asleep-near    asleep, 32 m off, just outside where it wakes: shut, dusty
//   waking         half awake: panels half open, the dust coming off
//   awake          awake, its eyes lit, looking at him
//   following      awake, trundling along with him at 8 m/s
//   spin           he stopped beside it: its happy spin, a third of the way round
//
// Writes evidence/pal/<portrait|landscape>/<scene>-<chase|cockpit>.png.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const OUT = path.resolve(__dirname, "..", "evidence", "pal");
const PORT = 8186;

// installed once per page: Mars, the rover out, and the helpers every scene uses
function install() {
  const L = window.__lp, st = L.state;
  performance.now = () => window.__simTime;
  L.api.skipScreens();
  L.api.setVehicle("starship"); L.api.placeOnRunway();
  const b = L.BODIES[1];
  st.dest = "mars"; st.phase = "TAXI"; L.rk.onBody = b; L.rk.stage = 1;
  const n0 = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
  st.x = b.x + n0.x * (b.r + 12); st.y = b.y + n0.y * (b.r + 12); st.z = b.z + n0.z * (b.r + 12);
  L.update(1 / 60);
  L.roverDeploy(); L.update(1 / 60);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pl = L.mars.pal, H = pl.home;
  const hn = V(H.x - b.x, H.y - b.y, H.z - b.z).normalize();
  const fromBase = V(L.mars.x - H.x, L.mars.y - H.y, L.mars.z - H.z);
  fromBase.addScaledVector(hn, -fromBase.dot(hn)).normalize();
  const side = hn.clone().cross(fromBase).normalize();
  const P = {
    b, V, pl, H, hn, fromBase, side, toward: fromBase.clone().negate(),
    // d metres from its spot on the base's side, s metres to one side
    at(d, s = 0) {
      return hn.clone().multiplyScalar(b.r).addScaledVector(fromBase, d).addScaledVector(side, s)
        .normalize().multiplyScalar(b.r).add(V(b.x, b.y, b.z));
    },
    put(p, f) {
      const n = V(p.x - b.x, p.y - b.y, p.z - b.z).normalize(), R = b.r + 0.9;
      L.rover.x = b.x + n.x * R; L.rover.y = b.y + n.y * R; L.rover.z = b.z + n.z * R;
      L.rover.n.copy(n); L.rover.f.copy(f).addScaledVector(n, -f.dot(n)).normalize();
      L.rover.h = 0; L.rover.vh = 0; L.rover.speed = 0;
    },
    padHold() { if (L.mars.phase === "armed") L.mars.phase = "idle"; L.mars.wentOut = false; },
    blinkOn() { pl.clock = 0.2; },
    asleep() {
      if (L.marsDroneActive()) marsDroneLand();
      pl.state = "sleep"; pl.t = 0; pl.spin = 0; pl.hop = 0; pl.roll = 0; pl.speed = 0;
      pl.x = H.x; pl.y = H.y; pl.z = H.z; pl.f.copy(H.f); pl.yaw = 0; pl.pitch = -0.5;
      marsPalPose(0);
    },
  };
  window.__P = P;
  window.__hold = () => {};
  window.__step = (n) => { for (let i = 0; i < n; i++) { P.padHold(); L.update(1 / 60); window.__hold(); } };
}

const SCENES = {
  "asleep-drone": () => {
    const P = window.__P, L = window.__lp, b = P.b;
    P.asleep();
    P.put(P.at(70), P.toward);
    const dr = L.mars.drone;
    dr.x = L.rover.x; dr.y = L.rover.y; dr.z = L.rover.z;
    L.marsDronePress();
    const p = P.at(45), n = P.V(p.x - b.x, p.y - b.y, p.z - b.z).normalize();
    window.__hold = () => {
      dr.x = b.x + n.x * (b.r + 14); dr.y = b.y + n.y * (b.r + 14); dr.z = b.z + n.z * (b.r + 14);
      dr.h = 14; dr.vh = 0; dr.speed = 0; dr.home = false; dr.grace = 1;
      // a little off its nose, as he would come in: dead ahead, the drone itself hides it in the chase view
      dr.f.copy(P.toward).addScaledVector(P.side, 0.35).addScaledVector(n, -P.toward.dot(n)).normalize();
      L.rover.speed = 0; P.blinkOn();
    };
  },
  "asleep-far": () => {
    const P = window.__P, L = window.__lp;
    P.asleep();
    window.__hold = () => { P.put(P.at(140), P.toward); P.blinkOn(); };
  },
  "asleep-near": () => {
    const P = window.__P, L = window.__lp, MP = L.MB.pal;
    P.asleep();
    MP.wakeR = 0;                                  // just outside where it would wake, for the look of it shut
    window.__hold = () => { P.put(P.at(32, 4), P.toward); };
  },
  "waking": () => {
    const P = window.__P, L = window.__lp, MP = L.MB.pal;
    P.asleep();
    window.__wakeR = MP.wakeR; MP.wakeR = 0;    // asleep while the camera settles; the scene wakes it at the end
    window.__hold = () => { P.put(P.at(14, 4), P.toward); };
    window.__last = () => {
      MP.wakeR = window.__wakeR;
      window.__step(Math.round(60 * MP.wakeTime * 0.5));
    };
  },
  "awake": () => {
    const P = window.__P, L = window.__lp;
    P.asleep();
    window.__hold = () => { P.put(P.at(16, 3), P.toward); L.rover.speed = 0; };
  },
  "following": () => {
    const P = window.__P, L = window.__lp;
    P.asleep();
    // across in front of its spot at 8 m/s (its cruise is 11): he wakes it passing, it starts behind
    // him and overtakes, and from about 11 s it rides 11-13 m ahead (inside its leash to about 14 s)
    let i = 0;
    window.__hold = () => { P.put(P.at(12, -50 + 8 * (i++ / 60)), P.side); L.rover.speed = 8; };
    window.__step(60 * 11);
  },
  "spin": () => {
    const P = window.__P, L = window.__lp;
    P.asleep();
    window.__hold = () => { P.put(P.at(9, 3), P.toward); L.rover.speed = 0; };
    window.__step(60 * 4);                         // wake it and let it settle beside him
    window.__last = () => {
      const pl = P.pl, d0 = L.flags.marsPalDances || 0;
      for (let i = 0; i < 60 * 25 && (L.flags.marsPalDances || 0) === d0; i++) window.__step(1);
      window.__step(Math.round(60 * L.MB.pal.danceTime / 3));
    };
  },
};

(async () => {
  const srv = serve(ROOT, PORT);
  const browser = await launch();
  const errors = [];
  const report = {};
  try {
    for (const [orient, w, h] of [["portrait", 820, 1180], ["landscape", 1180, 820]]) {
      fs.mkdirSync(path.join(OUT, orient), { recursive: true });
      for (const name of Object.keys(SCENES)) {
        for (const chase of [true, false]) {
          const pg = await openGame(browser, PORT, { width: w, height: h, errors });
          await pg.evaluate(install);
          const info = await pg.evaluate(({ src, chase }) => {
            const L = window.__lp;
            window.__last = null;
            L.api.setView(chase);
            eval("(" + src + ")")();
            window.__step(150);
            if (window.__last) window.__last();
            for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
            const pl = window.__P.pl, r = L.rover;
            return { state: pl.state, k: +pl.k.toFixed(2), blink: pl.glow.visible, drone: L.marsDroneActive(),
                     calls: L.renderer.info.render.calls, gap: +Math.hypot(pl.x - r.x, pl.y - r.y, pl.z - r.z).toFixed(1), spin: +(pl.spin || 0).toFixed(2) };
          }, { src: SCENES[name].toString(), chase });
          const file = path.join(OUT, orient, `${name}-${chase ? "chase" : "cockpit"}.png`);
          await pg.screenshot({ path: file });
          report[`${orient}/${name}-${chase ? "chase" : "cockpit"}`] = info;
          console.log("shot", orient, name, chase ? "chase" : "cockpit", JSON.stringify(info));
          await pg.close();
        }
      }
    }
  } finally {
    await browser.close(); srv.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log(errors.length ? "page errors:\n" + errors.join("\n") : "no page errors");
})();
