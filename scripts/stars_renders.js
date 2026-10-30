"use strict";
// v210's evidence: the star shower on Mars, as he would play it. Portrait and
// landscape, both views:
//
//   node scripts/stars_renders.js [root]
//
//   falling      3.4 s into a shower: the first star in its last, slow stretch down in front of him
//                (above that it is higher than either view looks), the others still coming in
//   landed       all seven down: the first right in front of him, glowing, its beam up
//   beams-far    facing the two furthest: under the curve, only their beams over it
//   ring         four caught: the ring of stars spinning over his rover
//   windup       the seventh caught: the ring spun up and lifting
//   burst        the show: the stars bursting into fireworks in front of him
//   big-star     after the show: the big star in the sky, the gold falling from it
//   drone        from the little drone, hovering over a star it is about to catch
//
// Writes evidence/stars/<portrait|landscape>/<scene>-<chase|cockpit>.png.
const fs = require("fs"), path = require("path");
const { launch, openGame, serve } = require("./art_rig.js");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const OUT = path.resolve(__dirname, "..", "evidence", "stars");
const PORT = 8187;

// installed once per page: Mars, the rover out near the pad, and the helpers every scene uses
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
  const S = L.mars.stars, M = L.MB.stars;
  const e1 = V(1, 0, 0).cross(L.mars.n).normalize();
  const P = {
    b, V, S, M,
    put(p, f) {
      const n = V(p.x - b.x, p.y - b.y, p.z - b.z).normalize(), R = b.r + 0.9;
      L.rover.x = b.x + n.x * R; L.rover.y = b.y + n.y * R; L.rover.z = b.z + n.z * R;
      L.rover.n.copy(n); L.rover.f.copy(f).addScaledVector(n, -f.dot(n)).normalize();
      L.rover.h = 0; L.rover.vh = 0; L.rover.speed = 0;
    },
    // where he waits for the shower: 30 m out from the pad, facing on out
    start() { const p = marsWalk(L.mars.x, L.mars.y, L.mars.z, e1, 30); P.put(p, e1); P.at = p; P.f = L.rover.f.clone(); },
    padHold() { if (L.mars.phase === "armed") L.mars.phase = "idle"; L.mars.wentOut = false; },
    shower() { L.mars.cargoPhase = "down"; S.t = 0; },
    facing(s) { const v = V(s.x - L.rover.x, s.y - L.rover.y, s.z - L.rover.z); return v; },
  };
  P.start();
  window.__P = P;
  window.__hold = () => {};
  window.__step = (n) => { for (let i = 0; i < n; i++) { P.padHold(); window.__hold(); L.update(1 / 60); } };
}

const SCENES = {
  "falling": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(175);              // + the 30 every scene steps: 3.4 s
  },
  "landed": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
  },
  "beams-far": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    const far = P.S.list[P.M.count - 1];
    const f = P.facing(far);
    window.__hold = () => { P.put(P.at, f); };
  },
  "ring": () => {
    const P = window.__P, L = window.__lp;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    for (let k = 0; k < 4; k++) { const s = P.S.list[k]; window.__hold = () => P.put(s, P.f); window.__step(20); }
    const s3 = P.S.list[3];
    window.__hold = () => { P.put(s3, P.f); L.rover.speed = 0; };
    window.__step(60);
  },
  "windup": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    for (const s of P.S.list) { window.__hold = () => P.put(s, P.f); window.__step(20); }
    const last = P.S.list[P.M.count - 1];
    window.__hold = () => P.put(last, P.f);
    window.__step(Math.round(60 * P.M.windup * 0.4) - 20);
  },
  "burst": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    for (const s of P.S.list) { window.__hold = () => P.put(s, P.f); window.__step(20); }
    const last = P.S.list[P.M.count - 1];
    window.__hold = () => P.put(last, P.f);
    for (let i = 0; i < 60 * 8 && P.S.bursts < 4; i++) window.__step(1);
    window.__step(8);
  },
  "big-star": () => {
    const P = window.__P;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    for (const s of P.S.list) { window.__hold = () => P.put(s, P.f); window.__step(20); }
    const last = P.S.list[P.M.count - 1];
    window.__hold = () => P.put(last, P.f);
    for (let i = 0; i < 60 * 10 && P.S.phase !== "rest"; i++) window.__step(1);
    window.__step(60);
  },
  "drone": () => {
    const P = window.__P, L = window.__lp, b = P.b;
    window.__hold = () => { P.put(P.at, P.f); };
    P.shower(); window.__step(60 * 8);
    const s = P.S.list[2], dr = L.mars.drone;
    dr.x = L.rover.x; dr.y = L.rover.y; dr.z = L.rover.z;
    L.marsDronePress();
    const M = P.M, save = M.droneCatchR;
    M.droneCatchR = 0;                       // just short of catching it, for the look of it
    const n = P.V(s.x - b.x, s.y - b.y, s.z - b.z).normalize();
    const back = P.V(L.rover.x - s.x, L.rover.y - s.y, L.rover.z - s.z).normalize();
    window.__hold = () => {
      const q = marsWalk(s.x, s.y, s.z, back, 26), qn = q.dir;
      dr.x = b.x + qn.x * (b.r + 14); dr.y = b.y + qn.y * (b.r + 14); dr.z = b.z + qn.z * (b.r + 14);
      dr.h = 14; dr.vh = 0; dr.speed = 0; dr.home = false; dr.grace = 1;
      dr.f.copy(back).negate().addScaledVector(qn, back.dot(qn)).normalize();
    };
    window.__last = () => { M.droneCatchR = save; };
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
            window.__step(30);
            for (let i = 0; i < 3; i++) { window.__paint(); window.__hold(); }
            if (window.__last) window.__last();
            const S = L.mars.stars;
            return { phase: S.phase, stars: S.list.map(s => s.st[0]).join(""), caught: S.caught, bursts: S.bursts,
                     big: S.big.visible, drone: L.marsDroneActive(), calls: L.renderer.info.render.calls };
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
