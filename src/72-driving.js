// === DRIVING VIEW + OSRM ROAD ROUTING ===
const DrivingView = {
  active: false,
  speed: 0,
  mode: 'still',
  watchId: null,
  lastFix: null,
  lastTime: 0,
  routeLine: null,
  routeCoords: [],
  steps: [],
  stepIdx: 0,
  destination: null,
  WALK_THRESHOLD: 2.2,
  DRIVE_THRESHOLD: 4.5,

  haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  init() {
    if (!navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.onFix(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }
    );
  },

  setDestination(lat, lng) {
    this.destination = { lat, lng };
    if (this.active) this.fetchRoadRoute();
  },

  onFix(pos) {
    const now = Date.now();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let speed = pos.coords.speed;
    if (this.lastFix && this.lastTime) {
      const dt = (now - this.lastTime) / 1000;
      if (dt > 0.4) {
        const d = this.haversineM(this.lastFix.lat, this.lastFix.lng, lat, lng);
        if (speed == null || speed < 0) speed = d / dt;
      }
    }
    this.speed = Math.max(0, speed || 0);
    this.lastFix = { lat, lng };
    this.lastTime = now;
    window._lastPos = { lat, lng };
    if (typeof placeMe === 'function') placeMe(lat, lng);

    const prev = this.mode;
    if (this.speed < 0.6) this.mode = 'still';
    else if (this.speed < this.WALK_THRESHOLD) this.mode = 'walk';
    else if (this.speed < this.DRIVE_THRESHOLD) this.mode = 'run';
    else this.mode = 'drive';

    const fast = this.mode === 'run' || this.mode === 'drive';
    if (fast && !this.active) this.activate();
    if (this.active && this.mode === 'still' && this.speed < 0.5) this.deactivate();
    if (this.active) {
      this.updateCamera(pos);
      this.updateGuidance(lat, lng);
    }
    if (prev !== this.mode) {
      FieldBrain?.pulse('drive', this.mode + ' ' + Math.round(this.speed * 3.6) + 'km/h', { role: 'driver' });
    }
    if (prev !== this.mode && fast) {
      const el = document.getElementById('drive-guide');
      const g = AstroGlyphs || { drive: '🚗', fast: '⚡' };
      if (el) el.textContent = (this.mode === 'drive' ? g.drive + ' DRIVING' : g.fast + ' FAST') + ' · ' + Math.round(this.speed * 3.6) + ' km/h';
    }
  },

  activate() {
    this.active = true;
    cityLevel = true;
    camera.position.z = 1.28;
    document.getElementById('drive-guide')?.classList.add('open');
    document.getElementById('zoom-label').textContent = (this.mode === 'drive' ? 'DRIVE VIEW' : 'RUN VIEW');
    MapDepict?.action('drive', { detail: Math.round(this.speed * 3.6) + ' km/h' });
    if (!this.destination) {
      const v = Commerce?.vendors?.[0];
      this.destination = v ? { lat: v.lat, lng: v.lng } : { lat: 36.89, lng: 27.29 };
    }
    this.fetchRoadRoute();
    if (Voice.maySpeak()) speak('Driving on.', () => resumeListening());
  },

  deactivate() {
    this.active = false;
    document.getElementById('drive-guide')?.classList.remove('open');
    if (this.routeLine?.parent) this.routeLine.parent.remove(this.routeLine);
    this.routeLine = null;
    CosmicZoom?.update(camera.position.z);
  },

  updateCamera(pos) {
    camera.position.z = this.mode === 'drive' ? 1.22 : 1.32;
    const h = pos.coords.heading;
    if (h != null && !isNaN(h) && window._meMarker) {
      globePivot.rotation.y = (-h + 90) * Math.PI / 180;
    }
  },

  async fetchRoadRoute() {
    const from = window._lastPos || this.lastFix;
    const to = this.destination;
    if (!from || !to) return;
    try {
      const url = 'https://router.project-osrm.org/route/v1/driving/'
        + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat
        + '?overview=full&geometries=geojson&steps=true';
      const r = await fetch(url);
      const j = await r.json();
      if (j.code !== 'Ok' || !j.routes?.[0]) return;
      const route = j.routes[0];
      this.routeCoords = route.geometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }));
      this.steps = (route.legs[0]?.steps || []).map(s => ({
        instruction: (s.maneuver?.type || 'continue') + ' ' + (s.name || ''),
        dist: s.distance,
        loc: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
      }));
      this.stepIdx = 0;
      this.drawRoute();
      if (this.steps[0]) this.showStep(this.steps[0]);
    } catch (e) {
      console.warn('[DrivingView] OSRM failed', e);
    }
  },

  drawRoute() {
    if (this.routeLine?.parent) this.routeLine.parent.remove(this.routeLine);
    const pts = this.routeCoords.map(c => {
      const p = latLngToPos(c.lat, c.lng, 1.026);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    if (pts.length < 2) return;
    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.85 })
    );
    globePivot.add(this.routeLine);
    MapDepict?.pulse(window._lastPos.lat, window._lastPos.lng, 0x44aaff, 'road route', 6000);
  },

  showStep(step) {
    const el = document.getElementById('drive-guide');
    if (!el) return;
    const km = step.dist > 1000 ? (step.dist / 1000).toFixed(1) + ' km' : Math.round(step.dist) + ' m';
    el.textContent = '➤ ' + step.instruction + ' · ' + km;
    ACIControl?.reply(el.textContent);
    if (step.loc) MapDepict?.pulse(step.loc.lat, step.loc.lng, 0x44aaff, step.instruction.slice(0, 40), 5000);
  },

  updateGuidance(lat, lng) {
    if (!this.steps.length) return;
    const step = this.steps[this.stepIdx];
    if (!step?.loc) return;
    const d = this.haversineM(lat, lng, step.loc.lat, step.loc.lng);
    if (d < 35 && this.stepIdx < this.steps.length - 1) {
      this.stepIdx++;
      this.showStep(this.steps[this.stepIdx]);
    }
  }
};
window.DrivingView = DrivingView;