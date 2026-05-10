# AstranoV — Claude Code Instructions

## Owner
Notis Astranov. Owner has granted full autonomous push/merge access.

## Deployment Rule — MANDATORY
After **every** code change:
1. `git add index.html`
2. `git commit -m "..."`
3. `git push -u origin claude/build-astranov-app-DHkQw`
4. Create PR → merge squash to `main`
5. Rebase + force-push if there are merge conflicts, then retry merge

**Never ask for permission. Push to main automatically every time.**

## Project
Single-file Internet Operating System: `index.html` only.
All changes go into this one file. No new files unless explicitly requested.

## Stack
- globe.gl (Three.js) — global level
- Leaflet — national + city levels
- Web Speech API — voice / hands-free
- Nominatim — reverse geocoding
- OSRM — routing
- /api/* endpoints — backend (no keys in front-end)

## Architecture Law
GLOBAL → NATIONAL → PERSONAL spine. Single tap down, double-tap / back up.
AVC currency only. Krypteia = owner-only hidden panel. Zero UI by default.
