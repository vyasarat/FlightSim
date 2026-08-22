# Little Pilot

A no-reading, no-failing flying game for a 4-year-old. Single-page Canvas 2D game,
vanilla JS, zero network calls after load. Spec lives outside the repo (Product Spec v1).

**Live:**
- 2D side-scroller: https://flightsim.138.197.80.104.nip.io
- 3D cockpit build: https://flightsim.138.197.80.104.nip.io/cockpit/

The two builds are independent PWA shells (each has its own manifest/sw.js), so either
URL can be added to the Home Screen separately for A/B testing.
3D development happens on the `cockpit-3d` branch and merges into `main` to deploy;
the branch is kept on origin.

## Stack & hosting

Same droplet as XDeck / Allergy Tracker (`138.197.80.104`, `ubuntu-s-1vcpu-1gb-nyc3-01`).
Pure static site — nginx serves `/var/www/flightsim`, no backend, no PM2.

| Piece | Where |
|---|---|
| Repo | `git@github.com:vyasarat/FlightSim.git` |
| Checkout on droplet | `/root/flightsim` |
| Served from | `/var/www/flightsim` |
| nginx config | `/etc/nginx/sites-available/flightsim` (copy in `deploy/nginx-flightsim.conf`) |
| TLS | Let's Encrypt via certbot (`flightsim.138.197.80.104.nip.io`), auto-renews |

## Deploy

SSH into the droplet and run the deploy script (pulls latest main + syncs to web root):

```
ssh root@138.197.80.104 'bash /root/flightsim/deploy/deploy.sh'
```

Rollback:

```
ssh root@138.197.80.104 'cd /root/flightsim && git checkout $(cat /tmp/flightsim-previous-rev) && bash deploy/deploy.sh'
```

First-time provisioning on a fresh droplet: clone repo, copy `deploy/nginx-flightsim.conf`
to `/etc/nginx/sites-available/flightsim`, symlink into `sites-enabled`, reload nginx.
Certbot already manages the cert; if missing: `certbot --nginx -d flightsim.138.197.80.104.nip.io`.

## iPad install

1. Open the URL in Safari.
2. Share → **Add to Home Screen** (fullscreen icon, no browser chrome).
3. Settings → Accessibility → Guided Access to lock him in.

Service worker caches everything on first load — works offline after that.
Bump `CACHE_NAME` in `sw.js` when shipping asset changes.

## Build stages (per spec)

2D build (repo root): stages 1 ✅, 2–7 pending.

3D cockpit build (`cockpit/`, branch `cockpit-3d`): stage 1 = flight feel only
(drag = bank/pitch with ±30°/±45° clamps, release auto-levels, constant speed,
terrain contact bounces). Tuning knobs in the `TUNE` object at the top of the
script in `cockpit/index.html`. Three.js r128 is vendored — no CDN.
