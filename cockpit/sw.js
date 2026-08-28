const CACHE_NAME = "little-pilot-cockpit-v55";
const ASSETS = [
  "./",
  "./index.html",
  "./three.min.js",
  "./js/tune.js",
  "./js/terrain.js",
  "./js/scene.js",
  "./js/landing.js",
  "./js/scenery.js",
  "./js/traffic.js",
  "./js/landmarks.js",
  "./js/audio.js",
  "./js/hud.js",
  "./js/explosion.js",
  "./js/vehicle.js",
  "./js/collision.js",
  "./js/state.js",
  "./js/input.js",
  "./js/flight.js",
  "./js/rocket.js",
  "./js/recovery.js",
  "./js/rover.js",
  "./js/station.js",
  "./js/main.js",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // cache: "reload" bypasses the HTTP cache so a long-cached three.min.js
    // can't survive a CACHE_NAME bump.
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("little-pilot-cockpit-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      // Only cache good responses: a transient 404/502 must not become permanent.
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
