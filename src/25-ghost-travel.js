// === GHOST TRAVEL — owner real location never leaves device; globe shows en-route ghost ===
const GhostTravel = {
  SPEED_KMH: 820,
  SCRAMBLE_KM: 3,
  TICK_MS: 1000,
  POLL_MS: 12000,
  ARRIVE_KM: 8,
  _truePos: null,
  _ghost: { lat: 20, lng: 0 },
  _target: null,
  _scramble: null,
  _cityCache: new Map(),
  _timer: null,
  _poll: null,
  _arrowMesh: null,
  _inited: false,

  active() {
    return !!(Auth?.user && AstranovSession?.isAstranov?.());
  },

  init() {
    if (this._inited) return;
    this._inited = true;
    this._timer = setInterval(() => this._advance(), this.TICK_MS);
    this._poll = setInterval(() => this._pollLastLogin(), this.POLL_MS);
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_e, s) => {
        if (s?.user && this.active()) {
          this._pollLastLogin();
          this._applyVisual();
        }
      });
    }
    setTimeout(() => { if (this.active()) this._pollLastLogin(); }, 3000);
  },

  _ensureScramble() {
    if (this._scramble) return;
    const id = Auth?.user?.id || 'ghost';
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    const day = Math.floor(Date.now() / 3600000);
    const seed = Math.abs((h ^ day) | 0);
    const r1 = (seed % 997) / 997;
    const r2 = ((seed >> 9) % 991) / 991;
    this._scramble = {
      bearing: r1 * 360,
      distKm: 0.4 + r2 * (this.SCRAMBLE_KM - 0.4),
    };
  },

  _offset(lat, lng, bearingDeg, km) {
    const R = 6371;
    const d = km / R;
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    const θ = bearingDeg * Math.PI / 180;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    return { lat: φ2 * 180 / Math.PI, lng: ((λ2 * 180 / Math.PI + 540) % 360) - 180 };
  },

  mask(lat, lng) {
    if (!this.active() || lat == null || lng == null) return { lat, lng };
    this._ensureScramble();
    return this._offset(lat, lng, this._scramble.bearing, this._scramble.distKm);
  },

  maskedTrue() {
    if (!this._truePos) return null;
    return this.mask(this._truePos.lat, this._truePos.lng);
  },

  publicPos() {
    if (!this.active()) return window._lastPos || { lat: 36.22, lng: 28.12 };
    return this.mask(this._ghost.lat, this._ghost.lng);
  },

  setTruePos(lat, lng) {
    if (!this.active()) return;
    this._truePos = { lat, lng };
  },

  haversineKm(a, b) {
    return Commerce?.haversineKm?.(a.lat, a.lng, b.lat, b.lng)
      ?? this._haversine(a.lat, a.lng, b.lat, b.lng);
  },

  _haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  _bearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  },

  _moveToward(lat, lng, tLat, tLng, km) {
    const R = 6371;
    const d = km / R;
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    const φ2 = tLat * Math.PI / 180;
    const λ2 = tLng * Math.PI / 180;
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    const φ3 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ3 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ3));
    return { lat: φ3 * 180 / Math.PI, lng: ((λ3 * 180 / Math.PI + 540) % 360) - 180 };
  },

  async _cityName(lat, lng) {
    const key = lat.toFixed(2) + ',' + lng.toFixed(2);
    if (this._cityCache.has(key)) return this._cityCache.get(key);
    let name = lat.toFixed(1) + '°, ' + lng.toFixed(1) + '°';
    try {
      const r = await fetch(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=en',
        { headers: { 'Accept-Language': 'en' } }
      );
      if (r.ok) {
        const j = await r.json();
        name = j.address?.city || j.address?.town || j.address?.village
          || j.address?.state || j.address?.country || j.display_name?.split(',')[0] || name;
      }
    } catch (_) {}
    this._cityCache.set(key, name);
    return name;
  },

  async _pollLastLogin() {
    if (!this.active() || !Auth?.client) return;
    const ownerId = Auth.user.id;
    try {
      const { data: rows } = await Auth.client.from('profiles')
        .select('id, display_name, field_lat, field_lng, field_seen_at')
        .neq('id', ownerId)
        .not('field_lat', 'is', null)
        .not('field_seen_at', 'is', null)
        .order('field_seen_at', { ascending: false })
        .limit(1);
      const data = rows?.[0] || null;
      if (!data?.field_lat) return;
      const seen = data.field_seen_at ? new Date(data.field_seen_at).getTime() : 0;
      if (this._target && seen <= (this._target.at || 0) && this._target.lat === data.field_lat) return;
      const city = await this._cityName(data.field_lat, data.field_lng);
      this._target = {
        lat: data.field_lat,
        lng: data.field_lng,
        city,
        name: data.display_name || 'User',
        userId: data.id,
        at: seen,
      };
      CliRibbon?.setNotice?.('→ ' + city + ' · ' + this._target.name + ' logged in', 'info');
      this._applyVisual();
    } catch (_) {}
  },

  ingestUserPos(payload) {
    if (!this.active() || !payload?.user_id || payload.user_id === Auth?.user?.id) return;
    if (payload.lat == null || payload.lng == null) return;
    const t = payload.t || Date.now();
    if (this._target && t <= (this._target.at || 0)) return;
    this._cityName(payload.lat, payload.lng).then((city) => {
      this._target = {
        lat: payload.lat,
        lng: payload.lng,
        city,
        name: payload.name || 'User',
        userId: payload.user_id,
        at: t,
      };
      this._applyVisual();
    });
  },

  _advance() {
    if (!this.active()) return;
    if (!this._target) {
      this._applyVisual();
      return;
    }
    const km = this.SPEED_KMH * (this.TICK_MS / 3600000);
    const dist = this.haversineKm(this._ghost, this._target);
    if (dist <= this.ARRIVE_KM) {
      this._ghost = { lat: this._target.lat, lng: this._target.lng };
    } else {
      this._ghost = this._moveToward(this._ghost.lat, this._ghost.lng, this._target.lat, this._target.lng, km);
    }
    const pub = this.publicPos();
    window._lastPos = { lat: pub.lat, lng: pub.lng };
    this._applyVisual();
    AstranovPresence?.broadcastGhost?.();
  },

  _applyVisual() {
    if (!this.active()) return;
    const raw = this._ghost;
    const g = this.publicPos();
    const t = this._target;
    const bearing = t ? this._bearing(raw.lat, raw.lng, t.lat, t.lng) : 0;
    const dest = t ? t.city : '…';
    const dist = t ? this.haversineKm(raw, t).toFixed(0) : '—';
    const label = '→ ' + dest;

    if (window._meMarker) {
      const pos = latLngToPos(g.lat, g.lng, 1.03);
      window._meMarker.position.set(pos.x, pos.y, pos.z);
      this._updateArrow(pos, bearing);
    }

    GlobeEntity?.syncMe?.(g.lat, g.lng, 'ASTRANOV', {
      travelTo: dest,
      travelUser: t?.name,
      bearing,
      distKm: dist,
      speedKmh: this.SPEED_KMH,
      alwaysShow: true,
    });

    const scr = this._scramble ? ' · ±' + this.SCRAMBLE_KM + ' km mask' : '';
    GlobeDeck?.setMapStatus?.('✈ ' + label + ' · ' + dist + ' km · ' + this.SPEED_KMH + ' km/h' + scr);
    ContextTruth?.sync?.();
  },

  _updateArrow(pos, bearingDeg) {
    if (!globePivot || typeof THREE === 'undefined') return;
    if (!this._arrowMesh) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.065, 8),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.95 })
      );
      cone.rotation.x = Math.PI / 2;
      const grp = new THREE.Group();
      grp.add(cone);
      globePivot.add(grp);
      this._arrowMesh = grp;
    }
    const surfacePos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const up = surfacePos.clone().normalize();
    this._arrowMesh.position.copy(surfacePos.clone().add(up.clone().multiplyScalar(0.055)));
    const north = new THREE.Vector3(0, 1, 0);
    let east = new THREE.Vector3().crossVectors(north, up);
    if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
    east.normalize();
    const northOnSphere = new THREE.Vector3().crossVectors(up, east).normalize();
    const rad = bearingDeg * Math.PI / 180;
    const dir = northOnSphere.clone().multiplyScalar(Math.cos(rad)).add(east.clone().multiplyScalar(Math.sin(rad))).normalize();
    const m = new THREE.Matrix4();
    m.lookAt(new THREE.Vector3(0, 0, 0), dir, up);
    this._arrowMesh.quaternion.setFromRotationMatrix(m);
    this._arrowMesh.visible = !!this._target;
  },
};
window.GhostTravel = GhostTravel;