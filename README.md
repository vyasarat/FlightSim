# Little Pilot

A no-reading, no-failing flying game for a 4-year-old. Single-page Canvas 2D game,
vanilla JS, zero network calls after load. Spec lives outside the repo (Product Spec v1).

**Live:** https://flightsim.138.197.80.104.nip.io

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

1. ✅ Flight feel only — finger-position altitude control, pitch-from-velocity, ground bounce
2. Scrolling background + parallax
3. Rings, collection, sound effects
4. Runway landing sequence + stars
5. Procedural course generation + difficulty scaling
6. Hangar, plane unlocks, localStorage save
7. Environments, polish, particles

Tuning knobs live in the `TUNE` object at the top of the script in `index.html`.
