// === CITY MAP — satellite + streets when zoomed to city level ===
const CityMap = {
  ENTER_Z: 1.38,
  EXIT_Z: 1.48,
  active: false,
  map: null,
  _ready: false,
  _center: { lat: 36.44, lng: 28.22 },
  _layers: {},
  _markers: {},
  _route: null,
  _driverTimer: null,
  _syncTimer: null,

  init() {
    if (!window.L) {
      console.warn('[CityMap] Leaflet not loaded');
      return;
    }
    let el = document.getElementById('city-map');
    if (!el) {
      el = document.createElement('div');
      el.id = 'city-map';
      document.body.appendChild(el);
    }
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    this._buildLayers();
    AstranovTheme?.registerMap?.(this);
    this.map.setView([this._center.lat, this._center.lng], 14);
    this._ready = true;
    this._driverTimer = setInterval(() => this._tickDrivers(), 2800);
    this._syncTimer = setInterval(() => this._syncMarkers(), 1200);
  },

  _buildLayers() {
    const sat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, attribution: 'Esri' }
    );
    const streets = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, opacity: 0.42, attribution: '© OSM' }
    );
    const darkStreets = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM' }
    );
    const brightStreets = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM' }
    );
    this._layers = { sat, streets, darkStreets, brightStreets };
    this._applyBaseLayers();
  },

  _applyBaseLayers() {
    if (!this.map) return;
    Object.values(this._layers).forEach(l => { try { this.map.removeLayer(l); } catch (_) {} });
    const mode = AstranovTheme?.mode || 'dark';
    if (mode === 'bright') {
      this._layers.sat.addTo(this.map);
      this._layers.brightStreets.addTo(this.map);
    } else {
      this._layers.sat.addTo(this.map);
      this._layers.streets.addTo(this.map);
    }
  },

  onThemeChange() {
    this._applyBaseLayers();
  },

  camZToZoom(camZ) {
    const z = Math.max(1.02, Math.min(1.38, camZ));
    const t = (1.38 - z) / (1.38 - 1.02);
    return Math.round(12 + t * 7);
  },

  globeCenterLatLng() {
    const v = new THREE.Vector3(0, 0, 1);
    const q = globePivot.quaternion.clone();
    q.invert();
    v.applyQuaternion(q);
    const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * 180 / Math.PI;
    let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng };
  },

  flyTo(lat, lng, zoom) {
    this._center = { lat, lng };
    if (this.map) this.map.setView([lat, lng], zoom || 15, { animate: true });
  },

  onCamera(camZ, level) {
    if (!this._ready) return;
    const earth = (level || CosmicZoom?.level || 'earth') === 'earth';
    const driving = !!DrivingView?.active;
    const shouldEnter = earth && (camZ <= this.ENTER_Z || driving);
    const shouldExit = !earth || (camZ > this.EXIT_Z && !driving);

    if (shouldEnter && !this.active) this._enter(camZ);
    else if (shouldExit && this.active) this._exit();
    else if (this.active) this._syncView(camZ);
  },

  _enter(camZ) {
    this.active = true;
    cityLevel = true;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.add('active');
    if (globe) globe.classList.add('city-map-active');
    const c = window._lastPos || this.globeCenterLatLng();
    this._center = c;
    this.map.setView([c.lat, c.lng], this.camZToZoom(camZ), { animate: false });
    this._syncMarkers();
    this._syncRoute();
    CityLife?._updateChip?.(
      (CityLife?.nearbyVendors?.(c.lat, c.lng) || []).length,
      Object.keys(this._markers).filter(k => k.startsWith('drv_')).length
    );
    const chip = document.getElementById('city-life-chip');
    if (chip) {
      chip.classList.add('open');
      chip.innerHTML = '<b>City map</b> · satellite · streets · friends · drivers · routing';
    }
    AciCli?.print?.('◎ City map — satellite · navigation · live drivers', 'ok');
  },

  _exit() {
    this.active = false;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.remove('active');
    if (globe) globe.classList.remove('city-map-active');
    EarthRealism?._hudTimer && (EarthRealism._hudTimer = 0);
  },

  _syncView(camZ) {
    const c = DrivingView?.active && window._lastPos
      ? window._lastPos
      : (window._lastPos || this.globeCenterLatLng());
    this._center = c;
    const lz = this.camZToZoom(camZ);
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    const cur = this.map.getCenter();
    if (Math.abs(cur.lat - c.lat) > 0.0004 || Math.abs(cur.lng - c.lng) > 0.0004) {
      this.map.panTo([c.lat, c.lng], { animate: false });
    }
  },

  _icon(emoji, color) {
    return L.divIcon({
      className: 'city-map-pin',
      html: '<span style="background:' + color + ';border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.45)">' + emoji + '</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  },

  _setMarker(id, lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    const prev = this._markers[id];
    if (prev) {
      prev.setLatLng([lat, lng]);
      return prev;
    }
    const m = L.marker([lat, lng], {
      icon: this._icon(opts.emoji || '◎', opts.color || 'rgba(0,140,220,0.9)'),
      title: opts.title || id,
    });
    if (opts.onClick) m.on('click', opts.onClick);
    m.addTo(this.map);
    this._markers[id] = m;
    return m;
  },

  _syncMarkers() {
    if (!this.active || !this.map) return;
    const me = window._lastPos;
    if (me) {
      this._setMarker('me', me.lat, me.lng, {
        emoji: '📍', color: 'rgba(0,200,255,0.95)', title: me?.name || 'You',
        onClick: () => GlobeEntity?.entities?.get('me') && GlobeEntity.activate(GlobeEntity.entities.get('me')),
      });
    }
    (window.others || []).forEach((u, i) => {
      this._setMarker('friend_' + (u.id || i), u.lat, u.lng, {
        emoji: u.emoji || '👤', color: 'rgba(255,170,50,0.92)', title: u.name,
      });
    });
    (Commerce?.vendors || []).forEach((v, i) => {
      if (v.lat == null) return;
      this._setMarker('shop_' + (v.id || i), v.lat, v.lng, {
        emoji: '🏪', color: 'rgba(255,140,40,0.9)', title: v.name || 'Shop',
        onClick: () => Commerce?.openVendor?.(v),
      });
    });
  },

  async _tickDrivers() {
    if (!this.active) return;
    const u = window._lastPos || this._center;
    const drivers = Commerce?.fetchNearbyDrivers
      ? await Commerce.fetchNearbyDrivers(u.lat, u.lng)
      : [];
    Commerce?.showDriversOnGlobe?.(drivers);
    const seen = new Set();
    drivers.forEach((d, i) => {
      const lat = d.lat ?? d.latitude ?? (u.lat + (Math.random() - 0.5) * 0.01);
      const lng = d.lng ?? d.longitude ?? (u.lng + (Math.random() - 0.5) * 0.01);
      const id = 'drv_' + (d.id || i);
      seen.add(id);
      this._setMarker(id, lat, lng, {
        emoji: '🚗', color: 'rgba(80,180,255,0.92)', title: d.display_name || 'Driver',
      });
    });
    Object.keys(this._markers).forEach(k => {
      if (k.startsWith('drv_') && !seen.has(k)) {
        this.map.removeLayer(this._markers[k]);
        delete this._markers[k];
      }
    });
  },

  setRoute(coords) {
    this._routeCoords = coords || [];
    this._syncRoute();
  },

  _syncRoute() {
    if (!this.map) return;
    if (this._route) {
      this.map.removeLayer(this._route);
      this._route = null;
    }
    const coords = this._routeCoords || DrivingView?.routeCoords || [];
    if (!coords.length || !this.active) return;
    const latlngs = coords.map(c => [c.lat, c.lng]);
    this._route = L.polyline(latlngs, {
      color: AstranovTheme?.mode === 'bright' ? '#0066cc' : '#44ccff',
      weight: 5,
      opacity: 0.88,
    }).addTo(this.map);
  },
};
window.CityMap = CityMap;