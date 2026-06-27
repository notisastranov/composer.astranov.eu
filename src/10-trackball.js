// Globe gestures — primary UI (Google Earth / Maps style). CLI is secondary.
const canvas = renderer.domElement;
const TRACK_SENS = 0.0028;
const ZOOM_MIN = 1.05;
const ZOOM_MAX = 18;
const ZOOM_SMOOTH = 0.09;

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
  trackVelX = dx * TRACK_SENS * 0.18;
  trackVelY = dy * TRACK_SENS * 0.18;
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
    ZoomTiers?.stepOut?.();
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
    ZoomTiers?.stepIn?.();
    MapDepict?.setHud('Zoom in', 'double-tap');
    lastTapAt = 0;
    return;
  }
  lastTapAt = now;
  lastTapX = clientX;
  lastTapY = clientY;
}

function zoomBy(delta) {
  const factor = Math.exp((delta || 0) * ZOOM_SMOOTH);
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.position.z * factor));
  camera.position.z = next;
  camera.lookAt(0, 0, 0);
  CosmicZoom.update(camera.position.z);
  CityMap?.onCamera?.(camera.position.z, CosmicZoom?.level);
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
  const dy = e.deltaMode === 1 ? e.deltaY * 1.2 : e.deltaY;
  if (ZoomTiers) ZoomTiers.onWheel(dy);
  else {
    const scale = e.deltaMode === 1 ? 0.035 : 0.00022;
    zoomAt(e.clientX, e.clientY, e.deltaY * scale, { zoomOnly: true });
  }
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
    const pinchDelta = (pinchDist - d) * 0.35;
    if (ZoomTiers) ZoomTiers.onPinch(pinchDelta);
    else zoomAt(midX, midY, pinchDelta * 0.006, { zoomOnly: true });
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
  ZoomTiers?.stepIn?.();
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
      const entity = GlobeEntity?.entities?.get('me');
      if (entity) { GlobeEntity.activate(entity); return; }
      const up = window._lastPos || { lat: 36.22, lng: 28.12 };
      MapDepict?.zoomToUser?.(GlobeControl?.Z?.national || 1.82);
      return;
    }
  }

  const intersects = raycaster.intersectObject(earth);
  if (intersects.length > 0) {
    flyToPoint(intersects[0].point, ZoomTiers?.tierZ?.('global') || 2.55);
    MapDepict.action('explore', { detail: 'tap' });
  }
}

function flyToPoint(point, targetZ = 1.82, opts) {
  opts = opts || {};
  const dir = point.clone().normalize();
  const toY = -Math.atan2(dir.x, dir.z);
  const toX = Math.max(-0.85, Math.min(0.85, -Math.asin(Math.max(-1, Math.min(1, dir.y))) * 0.45));
  let dy = toY - globePivot.rotation.y;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZ));
  if (ZoomTiers) {
    const near = ZoomTiers.TIERS.reduce((best, t) =>
      Math.abs(t.z - z) < Math.abs(best.z - z) ? t : best, ZoomTiers.TIERS[0]);
    ZoomTiers._index = ZoomTiers.indexOf(near.id);
  }
  const fromZ = camera.position.z;
  window._globeFly = {
    fromY: globePivot.rotation.y,
    fromX: globePivot.rotation.x,
    fromZ,
    toY: globePivot.rotation.y + dy,
    toX,
    toZ: z,
    t0: performance.now(),
    dur: opts.dur || GlobeControl?.flyDuration?.(fromZ, z) || 1400,
    tierId: ZoomTiers?.current?.()?.id,
    onDone: typeof opts.onDone === 'function' ? opts.onDone : null,
  };
}

function focusOnGlobePoint(point, targetZ) {
  flyToPoint(point, targetZ || GlobeControl?.Z?.national || 1.82);
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
  CityMap?.onCamera?.(camera.position.z, CosmicZoom?.level);
  if (p >= 1) {
    const tid = f.tierId;
    const done = f.onDone;
    window._globeFly = null;
    if (f.onTier && tid && ZoomTiers) {
      const i = ZoomTiers.indexOf(tid);
      if (i >= 0) ZoomTiers._index = i;
      ZoomTiers._apply(ZoomTiers.current());
    } else if (tid && ZoomTiers) {
      const i = ZoomTiers.indexOf(tid);
      if (i >= 0) ZoomTiers._index = i;
      ZoomTiers._apply(ZoomTiers.current());
    } else {
      cityLevel = camera.position.z <= 1.55;
      CityMap?.onCamera?.(camera.position.z, CosmicZoom?.level);
    }
    try { done?.(); } catch (_) {}
  }
}

function waitForGlobeFly(timeout = 9000) {
  return new Promise(resolve => {
    if (!window._globeFly) return resolve();
    const t0 = performance.now();
    const id = setInterval(() => {
      tickGlobeFly();
      if (!window._globeFly || performance.now() - t0 > timeout) {
        clearInterval(id);
        resolve();
      }
    }, 16);
  });
}
window.tickGlobeFly = tickGlobeFly;
window.waitForGlobeFly = waitForGlobeFly;

function showGestureHint() {
  if (sessionStorage.getItem('astranov-gesture-hint')) return;
  const el = document.createElement('div');
  el.id = 'gesture-hint';
  el.textContent = 'Drag to spin · Scroll/pinch steps zoom tiers · Double-tap zoom in';
  el.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);padding:8px 14px;background:rgba(0,4,12,0.88);border:1px solid rgba(26,111,212,0.45);border-radius:20px;font:12px system-ui;color:#3d9eff;text-shadow:0 0 8px rgba(26,111,212,0.45);z-index:44;pointer-events:none;opacity:1;transition:opacity 1.2s';
  document.body.appendChild(el);
  sessionStorage.setItem('astranov-gesture-hint', '1');
  setTimeout(() => { el.style.opacity = '0'; }, 3200);
  setTimeout(() => { el.remove(); }, 4500);
}
setTimeout(showGestureHint, 600);