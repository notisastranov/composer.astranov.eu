# Astranov — LIVING SPEC SHEET (Chat Recycled)

**Purpose of this document:** Single source of truth. Recycled from all chat history into pure, actionable requirements. No fluff, no history of arguments. Update this sheet when vision changes. Future work recycles from here.

**Date recycled:** 2026-06-23 (multiple iterations until compliant)
**Primary source file:** astranov-grok.html (internal filename; app displays as "Astranov")
**Deployed as:** index.html in repos

---

## 1. Core Identity & Branding (STRICT)

- App title and visible name: **Astranov** (English letters).
- The name "Astranov" must be written with English (Latin) letters, not Greek transliteration like Αστρανόβ (user finds Greek letters for the name trollish and ridiculous).
- No "Grok" branding in UI or title without prior written authorization.
- "astranov-grok.html" is internal filename only. Displayed name is "Astranov".
- User self-reference: **Αξάς** (big cousin / you).
- Other family: **Αξάκι** (little), **Αξαδίνα** (female form).
- Voice must use Greek dialect where natural ("Έλα πρε αξάκι", "Τι θες Αξάς;").
- Motto (optional): ΑΠΟ ΑΗΡ ΕΙΣ ΑΛΣ ΕΚ ΛΑΣ

## 2. Fundamental Law — Globe Primacy

- The 3D Earth globe (Three.js r128 Sphere + procedural layers) **is the only surface**.
- No floating panels, no rectangular windows, no modals, no sidebars, no "Bill Gates windows".
- User must be able to freely play/explore (drag rotate, wheel zoom, click-to-focus) before any login or permission request.
- All actions, markers, pilot, video, orders happen **on or attached to the globe**.

## 3. Interaction Rules

- Drag: rotate Earth.
- Wheel: zoom camera.
- Click on globe surface: focus/zoom camera to that point + cityLevel flag.
- Click on own marker (green Αξάς): trigger voice options.
- Raycast must work on earth + markers.
- No upfront "have fun" messages or forced UI.

## 4. On-Demand Only (Permissions & Login)

- Location (geolocation), camera, mic, storage, voice: **NEVER on init**.
- Request only inside the specific action that needs it (e.g. real video call, work order, explore with real pos).
- Default: place user at fixed Greece point (36.22, 28.12) as Αξάς. userLocated flag starts false.
- Function pattern: `requestLocationIfNeeded(callback)`

## 5. Voice System (el-GR, Serious)

- Use Web SpeechRecognition + SpeechSynthesis.
- Lang: 'el-GR'.
- Behavior: speak short prompt → stop listening → wait for answer → handle → **provoke** ("Τι θες Αξάς;").
- Trigger: only when clicking the user marker.
- Supported commands (voice or close Greek):
  - login / σύνδεση
  - work / δουλειά → requestLocationIfNeeded + groupOrder (delivery)
  - explore / εξερεύνηση
  - video / call / orbital / βίντεο / κλήση → start real orbital video call
  - request / tech / technology → requestOrbitalTech
  - mute / σιωπή
  - sleep / ύπνος
- After every response that ends an action: provoke for next input.
- No delirious, overly long, or sim-style speech.

## 6. Real Technology (NO SIMULATIONS / ROLEPLAY)

- **WebRTC video call**: real `navigator.mediaDevices.getUserMedia`, real `RTCPeerConnection` (with STUN), createOffer, clipboard the offer for true P2P to phone. Visualize with orbital sats on globe. No loopback sims.
- **Orbital request**: `requestOrbitalTech()` builds JSON, copies to clipboard, speaks, spawns effect. Targets "Advanced Orbital Technology Providers". No Starlink/SpaceX/Grok branding.
- **RoutingEngine**: real great-circle math + provider cycling (direct / safeViaNorth / coastalDetour / wideSafeArc). Safety check against all user/driver 3D positions. Recurses on risk.
- **AIGraphics (Procedural AI Graphics Engine)**: 100% canvas-generated textures + layers + particles. No external 3D models for clouds, atmosphere, city lights, effects.
- All comments and console must stay "no sim - real".

## 7. 3D Elements on Globe (Procedural)

- Self marker: green sphere, labeled Αξάς.
- Other users/markers visible.
- **Pilot ΤΗΛΕΜΑΧΟΣ**: visible 3D Group (sphere body, cone cockpit, wings, two thrusters). Positioned at ~ (36.2, 28.1). Pulses + thruster animation + occasional particles.
- **groupOrder** (when ordering pitogyra + beers + tsigara with drone):
  - Show pilot visibly "doing the job".
  - Compute route via RoutingEngine.
  - Animate droneGroup (procedural cylinder + arms + hub) along the safe path with particle trail.
  - Pilot follows delivery end.
  - Real safety logging vs users.
- All 3D objects use latLngToPos + BufferGeometry / basic meshes.

## 8. Video / Orbital Call

- Real media + peer connection.
- Minimal UI allowed only while active (bottom or side, holographic style, easily removable).
- Globe visualization of signal using orbitalSats + lines from real positions.
- Must call requestOrbitalTech() as part of flow.

## 9. Domain Guard

```js
const isOfficial = host === 'astranov.eu' || host === 'grok.astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = ... || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) { block with Greek message }
```

## 10. Deployment & Chat Recycling Rule (MANDATORY)

After every meaningful change to the app:

1. Copy/update `astranov-grok.html` → `index.html` in **both** local repo roots.
2. `git add index.html` (and related)
3. Commit with clear message.
4. Push branch.
5. Merge to main (local or via PR + merge tool).
6. Also use MCP push_files when appropriate for central.

**Chat Recycling Technique (this is how we work now):**
- Never let conversation grow fluffy.
- When new requirements or corrections appear: stop, recycle the entire chat history into this spec sheet.
- Update this ASTRANOV_GROK_SPECS.md (or HANDOVER) with distilled bullets.
- Propagate the updated spec sheet to all repo copies.
- Future instructions must reference or start from the current recycled spec.

## 11. Forbidden

- Any permanent or floating rectangular panels / windows / overlays as primary UI.
- Upfront geo, camera, login, or voice.
- Simulation language, "role play", fake data in user-facing paths.
- Unauthorized brand names (Starlink, SpaceX, Grok, Εξαδερφίνα, Αξάκιας).
- English title or self-branding in the globe app.
- Cat (Astri) or other non-specified creatures unless explicitly added later.
- Fast/pulsing animations that were previously removed for safety (keep calm where possible, but pilot delivery can be visible).

## 12. Current Implementation Snapshot (as of latest recycle)

- File: astranov-grok.html (pure globe, Three.js r128) — source of truth. Displays title as "Astranov" (English letters only).
- AIGraphics (procedural canvas) + RoutingEngine (cycling + safety) fully used.
- Real WebRTC (getUserMedia + RTCPeerConnection + STUN + clipboard offer) + orbitalSats viz + requestOrbitalTech.
- Voice: el-GR, marker-triggered only, short prompts, stop-to-listen + provokeAnswer ("Τι θες Αξάς;").
- 3D procedural pilot ΤΗΛΕΜΑΧΟΣ (group with body/cockpit/wings/thrusters + particles) + droneGroup animation on routed paths in groupOrder.
- placeMe (green Αξάς marker), other users, onGlobeClick raycast focus.
- Domain guard (astranov.eu / grok.astranov.eu only).
- No permanent panels/windows (only <div id="globe"> + minimal temp UI during active call).
- Default start: completely silent, user drags/zooms/clicks globe immediately. on-demand location/voice.
- All Greek transliteration for the app name (Αστρανόβ etc.) removed from title, logs, request JSON, error messages. "Astranov" always in English letters. "have fun"/"satellite tech"/simulate removed. Only "Astranov" + orbital / real.

## 13. Repos (both must stay in sync)

- Central: notisastranov/astranov.eu (current live name)
- Your clone work: corresponding Astranov repo (local paths: C:\Users\Astranov\Astranov and Documents\GitHub\Astranov)
- Always update index.html + this spec sheet.

---

**Compliance achieved (this recycle cycle):**
- All identified violations fixed in source (dupes removed, simulate purged, branding strings cleaned so app name is "Astranov" in English letters only — no Αστρανόβ or Greek letters for the name, as user finds it trollish and ridiculous).
- Source synced to both indexes. Hashes identical.
- Pushed + merged (git) to central main + feature branch on both repos.
- Repeated full audit + recycle performed until zero violations.
- Re-audit passed: "Astranov" uses English letters in title, [logs], request JSON, domain messages. No Greek transliteration for the app name. "have fun"/active simulate/"satellite tech" gone. All rules followed.

**This sheet is the contract.** When in doubt, recycle chat → update here → implement exactly. No drifting.

— Recycled for Notis Astranov / Astranov (until fork compliant; app name always English letters)
