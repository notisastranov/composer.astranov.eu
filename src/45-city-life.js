// === CITY LIFE — real-user scenarios: locate → city → shops · drivers · friends · news ===
const CityLife = {
  CITY_ZOOM: 1.42,
  NEARBY_KM: 12,
  _friendTimer: null,
  _lastDrop: null,

  init() {
    this._startFriendMotion();
  },

  userPos() {
    return window._lastPos || { lat: 36.44, lng: 28.22 };
  },

  ensureEarthView() {
    if (CosmicZoom) CosmicZoom.level = 'earth';
    CosmicZoom?.update?.(this.CITY_ZOOM);
    cityLevel = true;
  },

  flyToCity(lat, lng, label) {
    this.ensureEarthView();
    const p = latLngToPos(lat, lng, 1.04);
    if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(p.x, p.y, p.z), this.CITY_ZOOM);
    GlobeControl?.engageFollow?.('locate');
    GlobeControl?.noteAutoFly?.();
    MapDepict?.pulse?.(lat, lng, 0x00ffcc, label || 'Your city', 14000);
  },

  nearbyVendors(lat, lng) {
    const list = Commerce?.vendors || [];
    return list.filter(v => v.lat != null && Commerce.haversineKm(lat, lng, v.lat, v.lng) <= this.NEARBY_KM);
  },

  async dropIn(lat, lng, opts) {
    opts = opts || {};
    window._lastPos = { lat, lng };
    userLocated = true;
    this._lastDrop = { lat, lng, t: Date.now() };
    this.flyToCity(lat, lng, opts.label || 'Your city');
    CityMap?.flyTo?.(lat, lng, CityMap?.camZToZoom?.(this.CITY_ZOOM));

    if (Commerce?.loadVendors) await Commerce.loadVendors();
    const nearby = this.nearbyVendors(lat, lng);
    if (nearby.length) {
      Commerce.vendors = nearby.concat((Commerce.vendors || []).filter(v => !nearby.includes(v))).slice(0, 40);
    }
    Commerce?.showOnGlobe?.();
    GlobeEntity?.syncVendors?.(Commerce.vendors);

    const drivers = Commerce?.fetchNearbyDrivers ? await Commerce.fetchNearbyDrivers(lat, lng) : [];
    Commerce?.showDriversOnGlobe?.(drivers);
    this._pulseFriends();
    this._showLocalNews(lat, lng);
    this._updateChip(nearby.length, drivers.length);

    CityMap?.onCamera?.(camera?.position?.z ?? CityLife.CITY_ZOOM, 'earth');
    const msg = nearby.length + ' shops · ' + drivers.length + ' drivers · ' + (window.others?.length || 0) + ' friends nearby';
    GlobeDeck?.setPreview('🏙 ' + msg);
    AciCli?.print('◎ City view · ' + msg, 'ok');
    ACIControl?.reply('City level — tap a shop on globe or type: order groceries · scenario list');
    FieldBrain?.pulse?.('city', msg, { role: 'client', props: { lat, lng, shops: nearby.length } });

    if (opts.openShops && nearby.length) {
      GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
      await Commerce?.showPicker?.();
    }
    return { vendors: nearby, drivers, lat, lng };
  },

  _pulseFriends() {
    (window.others || []).forEach(u => {
      MapDepict?.pulse?.(u.lat, u.lng, 0xffaa33, (u.emoji || '') + ' ' + u.name, 15000);
    });
  },

  _showLocalNews(lat, lng) {
    NewsFeed?.fetch?.();
    const item = (NewsFeed?.items || [])[0] || 'News near you';
    MapDepict?.action?.('news', { lat, lng, detail: item.slice(0, 55), worldLat: lat, worldLng: lng });
    if (!GlobeDeck?.thinking) GlobeDeck?.setPreview('📰 ' + item.slice(0, 72));
  },

  _updateChip(shops, drivers) {
    const el = document.getElementById('city-life-chip');
    if (!el) return;
    el.classList.add('open');
    el.innerHTML = '<b>City</b> · ' + shops + ' shops · ' + drivers + ' drivers · friends live';
  },

  _startFriendMotion() {
    if (this._friendTimer) return;
    this._friendTimer = setInterval(() => this._tickFriends(), 3500);
  },

  _tickFriends() {
    if (Auth?.user || !(window.others || []).length) return;
    const friends = window.others || [];
    friends.forEach((u) => {
      u.lat += (Math.random() - 0.5) * 0.0012;
      u.lng += (Math.random() - 0.5) * 0.0012;
    });
    window.others = friends;
    GlobeEntity?.syncFriends?.(friends);
    if (CityMap?.active) CityMap._syncMarkers?.();
  },

  async locateAndDropIn() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      GlobeDeck?.setMapStatus('Locating…');
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          placeMe(lat, lng, { quiet: false, fly: true, zoom: this.CITY_ZOOM, cityDrop: true });
          const r = await this.dropIn(lat, lng);
          resolve(r);
        },
        err => reject(err),
        { enableHighAccuracy: true, timeout: 14000, maximumAge: 30000 }
      );
    });
  },

  SCENARIOS: {
    wake: async () => {
      AciCli?.print('scenario · wake — news on globe', 'cmd');
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      await CityLife.dropIn(u.lat, u.lng, { label: 'Morning' });
    },
    news: async () => {
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      CityLife._showLocalNews(u.lat, u.lng);
    },
    youtube: async (q) => {
      await GlobeVideo?.find?.(q || 'interesting places earth documentary');
    },
    locate: async () => { await CityLife.locateAndDropIn(); },
    city: async () => {
      const u = CityLife.userPos();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    friends: async () => {
      CityLife._pulseFriends();
      AciCli?.print((window.others || []).map(u => u.name + ' · ' + u.lat.toFixed(3)).join(' · '), 'ok');
    },
    drivers: async () => {
      const u = CityLife.userPos();
      const d = await Commerce?.fetchNearbyDrivers?.(u.lat, u.lng);
      Commerce?.showDriversOnGlobe?.(d);
      AciCli?.print(d.length ? d.map(x => (x.display_name || 'Driver')).join(' · ') : 'no active drivers — order to summon', 'ok');
    },
    shops: async () => {
      const u = CityLife.userPos();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    groceries: async () => { await Commerce?.smartOrder?.('pitogyra mpironia tsigareta'); },
    order: async (rest) => { await Commerce?.smartOrder?.(rest || 'pitogyra beer'); },
    reviews: async (rest) => {
      const q = rest || 'best restaurant near me';
      AciCli?.print('brain · reviews · ' + q, 'dim');
      const r = await ACI?.think?.('Summarize Google-style reviews for: ' + q + '. Short bullet list, best pick.');
      ACIControl?.reply(r || 'No reviews');
    },
    task: async (rest) => {
      await AciCoders?.handleMessage?.(rest || 'find best grocery offer near me and assign driver');
    },
    assign: async (rest) => {
      if (rest) await FieldBrain?.claimDelivery?.(rest);
      else AciCli?.print('usage: scenario assign <order_id>', 'err');
    },
    explore: async () => {
      const u = CityLife.userPos();
      MapDepict?.action?.('explore', { lat: u.lat, lng: u.lng, detail: 'things to do' });
      ACIControl?.reply('Drag globe · tap shops · type order or youtube');
    },
    list: async () => {
      const names = Object.keys(CityLife.SCENARIOS).filter(k => k !== 'list').join(' · ');
      AciCli?.print('scenarios: ' + names, 'ok');
    },
  },

  async run(name, rest) {
    const key = (name || 'list').toLowerCase();
    const fn = this.SCENARIOS[key];
    if (!fn) {
      AciCli?.print('unknown scenario — try: scenario list', 'err');
      return { error: 'unknown' };
    }
    try {
      await fn(rest);
      return { ok: true, scenario: key };
    } catch (e) {
      AciCli?.print('scenario error: ' + (e.message || e), 'err');
      return { error: e.message };
    }
  },

  listScenarios() {
    return Object.keys(this.SCENARIOS).filter(k => k !== 'list');
  },
};
window.CityLife = CityLife;