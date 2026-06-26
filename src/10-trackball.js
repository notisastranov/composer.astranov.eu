// Globe gestures — primary UI (Google Earth / Maps style). CLI is secondary.
const canvas = renderer.domElement;
const TRACK_SENS = 0.0048;
const ZOOM_MIN = 1.15;
const ZOOM_MAX = 22;

let pinchDist = 0;
let pinching = false;
let lastTapAt = 0;
let lastTapX = 0;
let lastTapY = 0;
let pressTimer = null;
let pressStartX = 0;
let pressStartY = 0;

function trackballMove(clientX, clientY) {
  const dx = clientX - px;
  const dy = clientY - py;
  px = clientX;
  py = clientY;
  globePivot.rotation.y += dx * TRACK_SENS;
  globePivot.rotation.x += dy * TRACK_SENS;
  globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
  trackVelX = dx * TRACK_SENS * 0.38;
  trackVelY = dy * TRACK_SENS * 0.38;
}

function trackballStart(clientX, clientY) {
  window._globeFly = null;
  GlobeControl?.userTookGlobe?.('drag');
  drag = true;
  dragging = true;
  px = clientX;
  py = clientY;
  pressStartX = clientX;
  pressStartY = clientY;
  trackVelX = 0;
  trackVelY = 0;
  canvas.classList.add('dragging');
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    if (!drag) return;
    zoomAt(pressStartX, pressStartY, 0.85);
    MapDepict?.setHud('Zoom out', 'long-press');
  }, 750);
}

function trackballEnd(clientX, clientY, opts) {
  clearTimeout(pressTimer);
  drag = false;
  canvas.classList.remove('dragging');
  setTimeout(() => { dragging = false; }, 100);
  if (!opts?.skipTap && clientX != null && clientY != null) registerTap(clientX, clientY);
}

function registerTap(clientX, clientY) {
  const now = Date.now();
  if (now - lastTapAt < 340 && Math.hypot(clientX - lastTapX, clientY - lastTapY) < 36) {
    zoomAt(clientX, clientY, -0.65);
    MapDepict?.setHud('Zoom in', 'double-tap');
    lastTapAt = 0;
    return;
  }
  lastTapAt = now;
  lastTapX = clientX;
  lastTapY = clientY;
}

function zoomBy(delta) {
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.position.z + delta));
  camera.position.z = next;
  camera.lookAt(0, 0, 0);
  CosmicZoom.update(camera.position.z);
}

function zoomAt(clientX, clientY, delta, opts) {
  const zoomOnly = opts && opts.zoomOnly;
  if (!zoomOnly) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(earth);
    if (hits.length) {
      const dir = hits[0].point.clone().normalize();
      const pull = delta > 0 ? 0.04 : -0.06;
      globePivot.rotation.y += dir.x * pull;
      globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x + dir.y * pull));
    }
  }
  zoomBy(delta);
}
window.zoomBy = zoomBy;
window.zoomAt = zoomAt;

function onWheelZoom(e) {
  e.preventDefault();
  trackVelX = 0;
  trackVelY = 0;
  const scale = e.deltaMode === 1 ? 0.06 : 0.0018;
  zoomAt(e.clientX, e.clientY, e.deltaY * scale, { zoomOnly: true });
}

canvas.addEventListener('mousedown', e => { if (e.button === 0) trackballStart(e.clientX, e.clientY); });
window.addEventListener('mouseup', e => { if (drag) trackballEnd(e.clientX, e.clientY); });
canvas.addEventListener('mousemove', e => {
  if (!drag) return;
  if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > 12) clearTimeout(pressTimer);
  trackballMove(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', onWheelZoom, { passive: false });
container.addEventListener('wheel', onWheelZoom, { passive: false });

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    if (drag) trackballEnd(null, null, { skipTap: true });
    clearTimeout(pressTimer);
    pinching = true;
    drag = false;
    dragging = false;
    trackVelX = 0;
    trackVelY = 0;
    pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    e.preventDefault();
    return;
  }
  if (pinching) return;
  if (e.touches.length === 1) {
    e.preventDefault();
    trackballStart(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    if (!pinchDist) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinching = true;
      if (drag) trackballEnd(null, null, { skipTap: true });
      return;
    }
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    zoomAt(midX, midY, (pinchDist - d) * 0.006, { zoomOnly: true });
    pinchDist = d;
    return;
  }
  if (pinching) return;
  if (drag && e.touches.length === 1) {
    e.preventDefault();
    if (Math.hypot(e.touches[0].clientX - pressStartX, e.touches[0].clientY - pressStartY) > 14) {
      clearTimeout(pressTimer);
    }
    trackballMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) {
    pinchDist = 0;
    pinching = false;
  }
  if (e.touches.length === 0 && drag) {
    const t = e.changedTouches[0];
    trackballEnd(t ? t.clientX : null, t ? t.clientY : null);
  }
});

canvas.addEventListener('dblclick', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, -0.7);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

container.addEventListener('click', onGlobeClick);

function globeClickTargets() {
  if (window.GlobeEntity?.clickTargets) {
    const t = GlobeEntity.clickTargets();
    if (t.length) return t;
  }
  const targets = [];
  if (window._meMarker) targets.push(window._meMarker);
  if (window.Commerce?.markers) targets.push(...Commerce.markers);
  globePivot.children.forEach(c => {
    if (c.userData?.globeEntity || c.userData?.name || c.userData?.vendor || c.userData?.type === 'me' || c.userData?.type === 'pilot' || c.userData?.type === 'post') {
      if (!targets.includes(c)) targets.push(c);
    }
  });
  return targets;
}

function onGlobeClick(e) {
  if (dragging) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const markerHits = raycaster.intersectObjects(globeClickTargets(), true);
  if (markerHits.length > 0) {
    const hit = markerHits[0].object;
    const entity = GlobeEntity?.pickFromHit?.(hit);
    if (entity) {
      GlobeEntity.activate(entity);
      return;
    }
    const root = hit.userData?.vendor ? hit : (hit.parent?.userData?.vendor ? hit.parent : hit);
    const ud = root.userData || hit.userData || {};
    if (ud.vendor && Commerce?.openVendor) { Commerce.openVendor(ud.vendor); return; }
    if (ud.type === 'me' || root === window._meMarker) {
      const up = window._lastPos || { lat: 36.22, lng: 28.12 };
      CityLife?.dropIn?.(up.lat, up.lng, { openShops: true });
      return;
    }
  }

  const intersects = raycaster.intersectObject(earth);
  if (intersects.length > 0) {
    flyToPoint(intersects[0].point, 1.45);
    cityLevel = true;
    MapDepict.action('explore', { detail: 'tap' });
  }
}

function flyToPoint(point, targetZ = 1.55) {
  const dir = point.clone().normalize();
  window._globeFly = {
    fromY: globePivot.rotation.y,
    fromX: globePivot.rotation.x,
    fromZ: camera.position.z,
    toY: -Math.atan2(dir.x, dir.z),
    toX: Math.max(-1.25, Math.min(1.25, -Math.asin(Math.max(-1, Math.min(1, dir.y))) * 0.7)),
    toZ: targetZ,
    t0: performance.now(),
    dur: 520
  };
}

function focusOnGlobePoint(point) {
  flyToPoint(point, 1.45);
  cityLevel = true;
}

function tickGlobeFly() {
  const f = window._globeFly;
  if (!f) return;
  const p = Math.min(1, (performance.now() - f.t0) / f.dur);
  const ease = 1 - Math.pow(1 - p, 3);
  globePivot.rotation.y = f.fromY + (f.toY - f.fromY) * ease;
  globePivot.rotation.x = f.fromX + (f.toX - f.fromX) * ease;
  camera.position.z = f.fromZ + (f.toZ - f.fromZ) * ease;
  camera.lookAt(0, 0, 0);
  CosmicZoom.update(camera.position.z);
  if (p >= 1) window._globeFly = null;
}
window.tickGlobeFly = tickGlobeFly;

function showGestureHint() {
  if (sessionStorage.getItem('astranov-gesture-hint')) return;
  const el = document.createElement('div');
  el.id = 'gesture-hint';
  el.textContent = 'One finger drag · Pinch or scroll zoom · Tap to fly';
  el.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);padding:8px 14px;background:rgba(0,12,24,0.82);border:1px solid rgba(0,180,255,0.35);border-radius:20px;font:12px system-ui;color:#9fd;z-index:44;pointer-events:none;opacity:1;transition:opacity 1.2s';
  document.body.appendChild(el);
  sessionStorage.setItem('astranov-gesture-hint', '1');
  setTimeout(() => { el.style.opacity = '0'; }, 3200);
  setTimeout(() => { el.remove(); }, 4500);
}
setTimeout(showGestureHint, 600);