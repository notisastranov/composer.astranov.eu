# AstranoV — Claude Code Instructions

## Owner
Notis Astranov. Owner has granted full autonomous push/merge access.

## Deployment Rule — MANDATORY
After **every** code change:
1. `git add index.html` (and any supabase/* files changed)
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
- Supabase Edge Functions — backend (no keys in front-end)

## Architecture Law — GLOBAL → NATIONAL → PERSONAL
Single tap down, double-tap / back up.
AVC currency only. Krypteia = owner-only hidden panel.

---

## CELESTIAL CIRCLES UI LAW — NEVER VIOLATE

AstranoV is a **planetary Internet Operating System**. The globe and space are permanent and untouchable. Every other element of the UI is a **celestial circle** — a floating, draggable, pinch-scalable circular gadget that appears when needed and dissolves when it is not.

There are no rectangles in the AstranoV UI. No square pop-ups, no modals, no sheets, no toolbars, no tab bars, no ribbons, no boxed content. Anything that used to be one of those — chat windows, vendor menus, posts, notifications, search results, payments, settings, Krypteia — is a circle. The circle is the universal carrier.

### The Four Primordial Circles
These exist by default at app boot:

1. **Economics Circle** (top-left, green glow) — wallet, AVC balance, recent ledger, micro-graph of balance over time. Replaces the wallet widget.
2. **Radar Circle** (top-right, amber glow) — active orders, nearby vendors, delivery ETAs, pulsing dot when activity. Replaces the radar widget.
3. **AI Circle** (bottom-right, violet glow) — Collective Intelligence heartbeat, provider chips orbiting the rim, mic in the center, locks/auto state. Replaces the CIC ring.
4. **View Circle** (white-blue glow, spawned on demand) — the universal content carrier. Used for ANY chat, vendor menu, post, video, search result, message, photo, settings panel, Krypteia tool. The app is allowed to spawn as many View Circles as needed, each independently positioned, sized, scrollable, and dismissible.

The app itself may instantiate new circle types at runtime through the same primitive (`Circles.spawn({type:'custom', glow:'#hex', content:...})`).

### Anatomy of a Celestial Circle
- Frosted glass interior (`backdrop-filter: blur(28px)`), thin rim, type-specific glow color
- A radial mask fades content near the curved edge so the text inside reads cleanly
- A rim-arc shows scroll position in lieu of any scrollbar
- A subtle outside label (small caps, ≤10px) names the circle's purpose — never a chrome bar
- A drag handle is NOT a separate element — the outer ~12% of the radius is the drag rim

### Unified Gesture Contract — identical on every circle
- **One finger, interior (< 88% of radius from center):** scrolls the content vertically
- **One finger, rim (≥ 88% of radius from center):** drags the entire circle anywhere on screen
- **Two fingers, pinch:** scales the *content* inside (zoom). When the content scale would shrink below ~0.6, the *circle itself* begins to shrink instead; when it would grow above ~1.4, the *circle itself* grows. Threshold values are tunable but the principle is invariant: pinch never feels stuck.
- **Tap outside, or pinch all the way down:** the circle collapses toward its spawn-origin coordinate and dissolves
- **Long-press on rim:** "pin" the circle so it persists across navigation (otherwise it auto-dismisses when not in focus for 30s, unless it is a primordial circle)

### Positioning & Layout
- Circles always float on top of the globe — never docked, never anchored to an edge
- Default positions are remembered per-circle in `localStorage` (`av_circle_pos_<id>`)
- When a new circle is spawned without a position, it auto-places in the largest empty quadrant
- Circles never auto-arrange or snap to grid — the user's drag positions are sovereign
- Two circles may be dragged near each other to "constellation-link" (visual: a faint connecting line, semantic: linked context, e.g. a vendor circle next to a payment circle)

### What Claude must NOT do
- NEVER create rectangular DOM containers for transient content. Use `Circles.spawn(...)`.
- NEVER add a permanent tab bar, nav bar, footer, sidebar, ribbon, or toolbar — the four primordials plus on-demand View Circles ARE the navigation.
- NEVER use modals, alerts, prompts, sheets, drawers, or any framework primitive that imposes a rectangle. Replace with a View Circle.
- NEVER let a circle's content escape the radial mask — text must be readable inside the circle, not clipped by it.
- NEVER cover the globe with opaque pixels. All circles are translucent and the globe must remain visible through them.
- NEVER break the gesture contract: every circle, including future ones the app creates, must support the same one-finger / two-finger semantics.
- NEVER reintroduce close-button chrome inside circles — close is implicit (tap outside, or pinch-collapse).

### Retired concepts (kept here so they don't sneak back)
- ~~`#multi` bottom rectangular panel~~ — gone. Replaced by View Circles.
- ~~`#tray-trigger` swipe-up tray with Feed/Radar/Wallet/You buttons~~ — gone. Navigation is the four primordials.
- ~~Atari-style emoji buttons (💰 Wallet, 📡 Radar)~~ — gone. Circles display data, not labels.
- CIC ring is NOT in the tray — it's always floating independently

---

## Collective Intelligence Cycle (CIC)
- Always-on floating ring (bottom-right, `#cic-float`)
- Astranov C.I. node = orchestrator, always first, always pulsing
- Free cycle for all users: Groq → Gemini → GPT-4o mini
- Owner gets Claude Opus first, then free cycle
- Tap node = lock to that provider; tap again = Auto
- Tap center mic = toggle hands-free
- Tap ring background = open C.I. chat
- Returns `provider` + `via` on every response

## Memory Law
- `ai_memory.is_private = false` → public context (sent to AI)
- `ai_memory.is_private = true` → private (NEVER sent to any AI, never stored with personal data)
- Owner can toggle privacy per-entry via Krypteia → Memory

## Security Law
- No API keys in index.html ever
- Owner identity verified server-side only (Supabase auth token → profiles.is_owner)
- Never trust client-sent `owner` flag
- Krypteia actions filtered server-side before response

## JS Safety Law
- Always `node --check` extracted script block before committing
- Never use `\'` inside template literals — use `JSON.stringify()` for dynamic strings in onclick
- Wrap all CDN-dependent init (Globe, Leaflet) in try-catch
- Never let an error in one init function kill the rest of the app
