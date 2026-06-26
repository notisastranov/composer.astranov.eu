// === SUPER SPACE UI — brain-located media on Earth · orbit · planets · galaxy ===
// Works with SuperCli (deck) + SuperVoice (mic) as the third UI layer.
const SuperSpace = {
  realm: 'earth',
  placement: null,
  _screen: null,
  _halo: null,
  _lastQuery: '',

  ZOOM: { earth: 2.2, orbit: 4.4, leo: 4.4, solar: 8, system: 8, galaxy: 16 },

  PLANET_KEYS: {
    mercury: 'Mercury', ερμής: 'Mercury', ερμης: 'Mercury',
    venus: 'Venus', αφροδίτη: 'Venus', αφροδιτη: 'Venus',
    mars: 'Mars', άρης: 'Mars', αρης: 'Mars',
    jupiter: 'Jupiter', δίας: 'Jupiter', διας: 'Jupiter',
    saturn: 'Saturn', κρόνος: 'Saturn', κρονος: 'Saturn',
  },

  init() {
    this.syncHud();
  },

  syncTriUi(kind, detail) {
    const d = (detail || '').slice(0, 120);
    if (kind === 'locate') {
      GlobeDeck?.setPreview('SuperSpace · ' + d);
      AciCli?.print('◎ SuperSpace · ' + d, 'map');
    }
    if (kind === 'video') {
      SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
    }
    AciCoders?.observeActivity?.('superspace', kind + ':' + d);
  },

  parseBrainJson(text) {
    const s = String(text || '');
    const m = s.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    try {
      const j = JSON.parse(m[0]);
      if (!j.realm) return null;
      return {
        realm: String(j.realm).toLowerCase(),
        lat: typeof j.lat === 'number' ? j.lat : parseFloat(j.lat),
        lng: typeof j.lng === 'number' ? j.lng : parseFloat(j.lng),
        planet: j.planet || '',
        label: j.label || j.planet || j.realm,
        zoom: j.zoom || j.realm,
        source: 'brain',
        confidence: 0.92,
      };
    } catch { return null; }
  },

  heuristicPlace(text) {
    const low = String(text || '').toLowerCase();
    if (/galaxy|milky way|galax|universe|cosmos|deep space|black hole|σύμπαν|συμπαν|galactic/.test(low)) {
      return { realm: 'galaxy', zoom: 'galaxy', label: 'Galaxy · deep space', confidence: 0.92 };
    }
    for (const [key, name] of Object.entries(this.PLANET_KEYS)) {
      if (low.includes(key)) {
        return { realm: 'system', planet: name, zoom: 'system', label: name, confidence: 0.88 };
      }
    }
    if (/moon|σελήνη|σεληνη|lunar|apollo/.test(low)) {
      return { realm: 'orbit', zoom: 'orbit', label: 'Moon · near-Earth', useMoon: true, confidence: 0.86 };
    }
    if (/iss|space station|starlink|satellite|δορυφόρο|δορυφορο|orbital|leo\b|nasa\s+live|spacex|διεθνής διαστημικός/.test(low)) {
      return {
        realm: 'orbit', zoom: 'orbit', label: /iss/.test(low) ? 'ISS' : 'Low Earth orbit',
        useIss: /iss|space station|διεθνής/.test(low), confidence: 0.86,
      };
    }
    if (/sun\b|solar flare|ηλιος|ήλιος|helios/.test(low)) {
      return { realm: 'system', planet: 'Sun', zoom: 'system', label: 'Sun', confidence: 0.84 };
    }
    const cities = SuperCli?.CITIES || {};
    for (const [name, c] of Object.entries(cities)) {
      if (low.includes(name)) {
        return { realm: 'earth', lat: c[0], lng: c[1], zoom: 'earth', label: name, confidence: 0.82 };
      }
    }
    if (/greece|ελλάδ|ελλαδ|rhodes|ρόδο|ροδο|athens|αθήνα|αθηνα|crete|κρήτη/.test(low)) {
      return { realm: 'earth', lat: 36.44, lng: 28.22, zoom: 'earth', label: 'Greece', confidence: 0.75 };
    }
    if (/africa|asia|europe|america|australia|antarctica/.test(low)) {
      const zones = {
        africa: [0, 20], asia: [34, 100], europe: [50, 10],
        america: [40, -100], australia: [-25, 135], antarctica: [-80, 0],
      };
      for (const [z, ll] of Object.entries(zones)) {
        if (low.includes(z)) return { realm: 'earth', lat: ll[0], lng: ll[1], zoom: 'earth', label: z, confidence: 0.7 };
      }
    }
    const u = window._lastPos || { lat: 36.22, lng: 28.12 };
    return { realm: 'earth', lat: u.lat, lng: u.lng, zoom: 'earth', label: 'Earth · you', confidence: 0.35, source: 'default' };
  },

  async brainPlace(text) {
    if (!ACI?.think) return null;
    const prompt = 'Locate this media in the cosmos. Text: "' + String(text).slice(0, 220)
      + '". Reply ONLY compact JSON keys: realm (earth|orbit|system|galaxy), lat, lng, planet, label, zoom. No prose.';
    try {
      const r = await ACI.think(prompt);
      return this.parseBrainJson(r);
    } catch { return null; }
  },

  async decidePlacement(query, meta) {
    const text = [query, meta?.title, meta?.channel].filter(Boolean).join(' · ');
    this._lastQuery = text;
    let p = this.heuristicPlace(text);
    if (p.confidence < 0.72) {
      GlobeDeck?.setThinking(true, 'Brain locating in space…');
      const brain = await this.brainPlace(text);
      GlobeDeck?.setThinking(false);
      if (brain) p = { ...p, ...brain };
      else p.source = p.source || 'heuristic';
    } else {
      p.source = 'heuristic';
    }
    return p;
  },

  zoomTo(level) {
    const z = this.ZOOM[(level || 'earth').toLowerCase()] || this.ZOOM.earth;
    window._globeFly = {
      fromY: globePivot.rotation.y,
      fromX: globePivot.rotation.x,
      fromZ: camera.position.z,
      toY: globePivot.rotation.y,
      toX: globePivot.rotation.x,
      toZ: z,
      t0: performance.now(),
      dur: 1100,
    };
    CosmicZoom?.update(z);
    this.realm = level;
    return z;
  },

  clearScreen() {
    if (this._screen?.parent) this._screen.parent.remove(this._screen);
    if (this._halo?.parent) this._halo.parent.remove(this._halo);
    this._screen = null;
    this._halo = null;
  },

  _makeScreen(color) {
    this.clearScreen();
    const group = new THREE.Group();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.09),
      new THREE.MeshBasicMaterial({ color: color || 0xff3355, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
    );
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    frame.position.z = -0.002;
    group.add(frame);
    group.add(plane);
    group.userData = { type: 'superspace-screen', billboard: true };
    this._screen = group;
    return group;
  },

  placeScreenAtVector(vec, label, color) {
    const g = this._makeScreen(color);
    g.position.copy(vec);
    g.lookAt(0, 0, 0);
    globePivot.add(g);
    MapDepict?.pulse?.(0, 0, color || 0xff4466, '▶ ' + (label || 'media'), 10000);
    if (label && vec) {
      const lat = Math.asin(Math.max(-1, Math.min(1, vec.y / vec.length()))) * 180 / Math.PI;
      const lng = Math.atan2(vec.z, -vec.x) * 180 / Math.PI - 180;
      if (Math.abs(lat) <= 90) MapDepict?.pulse?.(lat, lng, color || 0xff4466, label, 10000);
    }
  },

  placeScreenAtLatLng(lat, lng, label, r) {
    const rad = r || 1.065;
    const pos = latLngToPos(lat, lng, rad);
    this.placeScreenAtVector(new THREE.Vector3(pos.x, pos.y, pos.z), label, 0xff4466);
  },

  placeScreenAtPlanet(planetName) {
    const name = String(planetName || '');
    let target = null;
    if (CosmicZoom?.planets) {
      target = CosmicZoom.planets.find(p => (p.userData?.name || '').toLowerCase() === name.toLowerCase());
    }
    if (target && CosmicZoom.solarGroup) {
      const world = new THREE.Vector3();
      target.getWorldPosition(world);
      this.placeScreenAtVector(world.clone().multiplyScalar(1.05), name, 0xffaa44);
      return;
    }
    if (name === 'Sun' && CosmicZoom?.solarGroup?.children?.[0]) {
      const sun = CosmicZoom.solarGroup.children[0];
      this.placeScreenAtVector(sun.position.clone(), 'Sun', 0xffdd44);
    }
  },

  placeScreenOrbit(opts) {
    if (opts?.useIss && CosmicZoom?.issMarker) {
      const v = CosmicZoom.issMarker.position.clone();
      this.placeScreenAtVector(v, 'ISS', 0x44ffcc);
      return;
    }
    if (opts?.useMoon) {
      const u = window._lastPos || { lat: 0, lng: 0 };
      this.placeScreenAtLatLng(u.lat + 2, u.lng + 2, 'Moon', 1.07);
      return;
    }
    const u = window._lastPos || { lat: 36.22, lng: 28.12 };
    this.placeScreenAtLatLng(u.lat, u.lng, opts?.label || 'LEO', 1.08);
  },

  placeScreenGalaxy() {
    this.clearScreen();
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.35, 32),
      new THREE.MeshBasicMaterial({ color: 0xaa88ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    halo.position.set(0, 0.5, -2);
    halo.lookAt(camera.position);
    scene.add(halo);
    this._halo = halo;
  },

  updateHud(p) {
    const el = document.getElementById('superspace-hud');
    if (!el) return;
    if (!p) { el.innerHTML = ''; el.classList.remove('open'); return; }
    el.classList.add('open');
    const src = p.source === 'brain' ? 'brain' : (p.source || 'heuristic');
    el.innerHTML = '<div class="ss-title">SuperSpace UI</div>'
      + '<div class="ss-row"><b>Realm</b> ' + this.esc(p.realm) + '</div>'
      + '<div class="ss-row"><b>Locate</b> ' + this.esc(p.label || '—') + '</div>'
      + '<div class="ss-row"><b>Brain</b> ' + src + (p.confidence ? ' · ' + Math.round(p.confidence * 100) + '%' : '') + '</div>'
      + '<div class="ss-tri">SuperCli + SuperVoice + SuperSpace</div>';
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  syncHud() {
    this.updateHud(this.placement);
  },

  async applyPlacement(p, meta) {
    if (!p) return;
    this.placement = p;
    this.realm = p.realm;
    this.updateHud(p);
    this.zoomTo(p.zoom || p.realm);

    if (p.realm === 'earth' && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      const pos = latLngToPos(p.lat, p.lng, 1.04);
      if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), 1.5);
      GlobeControl?.noteAutoFly?.();
      this.placeScreenAtLatLng(p.lat, p.lng, p.label);
    } else if (p.realm === 'orbit') {
      this.placeScreenOrbit(p);
    } else if (p.realm === 'system') {
      this.placeScreenAtPlanet(p.planet || p.label);
    } else if (p.realm === 'galaxy') {
      this.placeScreenGalaxy();
    }

    const msg = (p.label || p.realm) + ' · ' + p.realm + (p.source === 'brain' ? ' · brain' : '');
    this.syncTriUi('locate', msg);
    if (meta?.title) this.syncTriUi('video', meta.title);
    FieldBrain?.pulse?.('superspace', msg, { role: 'client', props: { realm: p.realm, source: p.source } });
    if (voiceSessionActive && Voice.maySpeak()) {
      speak('Located in ' + (p.label || p.realm) + '.', () => resumeListening?.());
    }
    return p;
  },

  async locateForMedia(query, meta) {
    const p = await this.decidePlacement(query, meta);
    await this.applyPlacement(p, meta);
    AciCli?.print('brain placed video · ' + (p.label || p.realm) + ' [' + p.realm + ']', 'ok');
    return p;
  },

  async locateText(text) {
    const p = await this.decidePlacement(text, { title: text });
    await this.applyPlacement(p, { title: text });
    return p;
  },

  stop() {
    this.clearScreen();
    this.placement = null;
    this.updateHud(null);
  },

  tick() {
    if (this._screen?.userData?.billboard) {
      this._screen.lookAt(camera.position);
    }
    if (this._halo) this._halo.lookAt(camera.position);
  },

  status() {
    return {
      realm: this.realm,
      placement: this.placement,
      query: this._lastQuery,
      triUi: ['SuperCli', 'SuperVoice', 'SuperSpace'],
    };
  },
};
window.SuperSpace = SuperSpace;