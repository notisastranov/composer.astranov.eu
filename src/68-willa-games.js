// === WILLA GAMES — demo players · κρυφτό/housekeeping · pyramid · multi-domain warfare ===
const WillaGames = {
  _timer: null,
  _demo: [],
  _units: [],
  _pyramids: [],
  active: null,

  // Twelve Olympians — same roster as Grok Heavy / Council of Thirteen (minus Astranov 13th seat)
  OLYMPIAN_AGENTS: [
    { id: 'god-zeus', name: 'Zeus', domain: 'sovereignty & order', emoji: '⚡', lat: 40.085, lng: 22.358, role: 'seeker', hidden: false },
    { id: 'god-hera', name: 'Hera', domain: 'community & bonds', emoji: '👑', lat: 37.638, lng: 21.630, role: 'housekeeping', hidden: false },
    { id: 'god-poseidon', name: 'Poseidon', domain: 'infrastructure & flow', emoji: '🌊', lat: 36.62, lng: 27.85, role: 'housekeeping', hidden: false },
    { id: 'god-demeter', name: 'Demeter', domain: 'resources & economy', emoji: '🌾', lat: 38.033, lng: 23.542, role: 'housekeeping', hidden: false },
    { id: 'god-athena', name: 'Athena', domain: 'wisdom & strategy', emoji: '🦉', lat: 37.971, lng: 23.726, role: 'seeker', hidden: false },
    { id: 'god-apollo', name: 'Apollo', domain: 'truth & clarity', emoji: '☀️', lat: 38.482, lng: 22.501, role: 'seeker', hidden: false },
    { id: 'god-artemis', name: 'Artemis', domain: 'protection of the vulnerable', emoji: '🏹', lat: 36.48, lng: 28.12, role: 'hider', hidden: true },
    { id: 'god-ares', name: 'Ares', domain: 'enforcement & conflict', emoji: '⚔️', lat: 37.074, lng: 22.430, role: 'seeker', hidden: false },
    { id: 'god-aphrodite', name: 'Aphrodite', domain: 'harmony & relationships', emoji: '💫', lat: 34.756, lng: 32.408, role: 'hider', hidden: true },
    { id: 'god-hephaestus', name: 'Hephaestus', domain: 'the craft & the build', emoji: '🔨', lat: 39.916, lng: 25.250, role: 'housekeeping', hidden: false },
    { id: 'god-hermes', name: 'Hermes', domain: 'communication & exchange', emoji: '🪽', lat: 37.92, lng: 22.88, role: 'hider', hidden: true },
    { id: 'god-dionysus', name: 'Dionysus', domain: 'culture & freedom', emoji: '🍇', lat: 37.103, lng: 25.376, role: 'hider', hidden: true },
  ],

  // Twelve Titans (Cronians) — red team · led by Kronos
  TITAN_AGENTS: [
    { id: 'titan-kronos', name: 'Kronos', domain: 'time & sovereignty', emoji: '⏳', lat: 39.52, lng: 22.12, role: 'seeker', team: 'red', hidden: false },
    { id: 'titan-rhea', name: 'Rhea', domain: 'flow & motherhood', emoji: '🌙', lat: 35.48, lng: 24.05, role: 'housekeeping', team: 'red', hidden: false },
    { id: 'titan-oceanus', name: 'Oceanus', domain: 'world ocean & currents', emoji: '🌀', lat: 36.05, lng: 29.55, role: 'seeker', team: 'red', hidden: false },
    { id: 'titan-tethys', name: 'Tethys', domain: 'fresh water & springs', emoji: '💧', lat: 38.72, lng: 26.12, role: 'housekeeping', team: 'red', hidden: false },
    { id: 'titan-hyperion', name: 'Hyperion', domain: 'light & dawn', emoji: '🌅', lat: 41.02, lng: 25.88, role: 'seeker', team: 'red', hidden: false },
    { id: 'titan-theia', name: 'Theia', domain: 'sight & shining ore', emoji: '✨', lat: 37.52, lng: 26.98, role: 'hider', team: 'red', hidden: true },
    { id: 'titan-coeus', name: 'Coeus', domain: 'intelligence & axis', emoji: '🧭', lat: 40.62, lng: 23.02, role: 'seeker', team: 'red', hidden: false },
    { id: 'titan-phoebe', name: 'Phoebe', domain: 'prophecy & moonlight', emoji: '🌑', lat: 35.18, lng: 25.72, role: 'hider', team: 'red', hidden: true },
    { id: 'titan-crius', name: 'Crius', domain: 'constellations & seasons', emoji: '⭐', lat: 39.88, lng: 20.28, role: 'seeker', team: 'red', hidden: false },
    { id: 'titan-mnemosyne', name: 'Mnemosyne', domain: 'memory & archives', emoji: '📜', lat: 38.18, lng: 21.72, role: 'hider', team: 'red', hidden: true },
    { id: 'titan-iapetus', name: 'Iapetus', domain: 'mortality & craft', emoji: '⚒️', lat: 36.88, lng: 21.62, role: 'hider', team: 'red', hidden: true },
    { id: 'titan-themis', name: 'Themis', domain: 'divine law & order', emoji: '⚖️', lat: 37.38, lng: 25.12, role: 'seeker', team: 'red', hidden: false },
  ],

  WILLA_UNIT_MAP: {
    'god-zeus': { unit: 'spaceforce', domain: 'air', team: 'blue' },
    'god-hera': { unit: 'ground', domain: 'ground', team: 'blue' },
    'god-poseidon': { unit: 'navy', domain: 'sea', team: 'blue' },
    'god-demeter': { unit: 'ground', domain: 'ground', team: 'blue' },
    'god-athena': { unit: 'airfighter', domain: 'air', team: 'blue' },
    'god-apollo': { unit: 'airfighter', domain: 'air', team: 'blue' },
    'god-artemis': { unit: 'spy', domain: 'fpv', team: 'blue' },
    'god-ares': { unit: 'ground', domain: 'ground', team: 'blue' },
    'god-aphrodite': { unit: 'spy', domain: 'ground', team: 'blue' },
    'god-hephaestus': { unit: 'drone', domain: 'ground', team: 'blue' },
    'god-hermes': { unit: 'drone', domain: 'fpv', team: 'blue' },
    'god-dionysus': { unit: 'seals', domain: 'underwater', team: 'blue' },
  },

  TITAN_UNIT_MAP: {
    'titan-kronos': { unit: 'spaceforce', domain: 'air', team: 'red' },
    'titan-rhea': { unit: 'ground', domain: 'ground', team: 'red' },
    'titan-oceanus': { unit: 'navy', domain: 'sea', team: 'red' },
    'titan-tethys': { unit: 'seals', domain: 'underwater', team: 'red' },
    'titan-hyperion': { unit: 'airfighter', domain: 'air', team: 'red' },
    'titan-theia': { unit: 'spy', domain: 'ground', team: 'red' },
    'titan-coeus': { unit: 'spy', domain: 'fpv', team: 'red' },
    'titan-phoebe': { unit: 'drone', domain: 'fpv', team: 'red' },
    'titan-crius': { unit: 'drone', domain: 'ground', team: 'red' },
    'titan-mnemosyne': { unit: 'spy', domain: 'ground', team: 'red' },
    'titan-iapetus': { unit: 'ground', domain: 'ground', team: 'red' },
    'titan-themis': { unit: 'airfighter', domain: 'air', team: 'red' },
  },

  PYRAMID_SITES: [
    { id: 'pyr-giza', name: 'Giza Great Pyramid', lat: 29.9792, lng: 31.1342, height: '146 m' },
    { id: 'pyr-rhodes', name: 'Rhodes acropolis', lat: 36.4412, lng: 28.2225, height: 'local marker' },
    { id: 'pyr-chichen', name: 'Chichen Itza', lat: 20.6843, lng: -88.5678, height: 'El Castillo' },
  ],



  DOMAIN_ALT: {
    air: 1.06, fpv: 1.07, ground: 1.025, sea: 1.02, underwater: 1.015,
  },

  TEAM_COLOR: { blue: 0x1a6fd4, red: 0xff2244 },
  OLYMPUS_BLUE: 0x0a2d6b,
  OLYMPUS_GLOW: 0x1565c0,

  init() {
    if (this._timer) return;
    setTimeout(() => this.boot(), 2800);
    this._timer = setInterval(() => this._tick(), 3500);
  },

  boot() {
    CosmicZoom?.trackISS?.();
    AciCli?.print?.('◎ Solar view · ISS live · 12 Olympians 🔵 · 12 Cronians 🔴 · kryfto · pyramid · willa', 'dim');
  },

  _buildOlympians(game) {
    return this.OLYMPIAN_AGENTS.map(g => ({
      ...g,
      team: 'blue',
      demo: true,
      agent: 'grok-heavy',
      game: game || 'lobby',
      t: Date.now(),
    }));
  },

  _buildTitans(game) {
    return this.TITAN_AGENTS.map(g => ({
      ...g,
      team: 'red',
      demo: true,
      agent: 'cronian',
      game: game || 'lobby',
      t: Date.now(),
    }));
  },

  _buildAllDemo(game) {
    return [...this._buildOlympians(game), ...this._buildTitans(game)];
  },

  getDemoRedTeam() {
    const fromDemo = (this._demo || []).filter(u => u.team === 'red');
    if (fromDemo.length) return fromDemo;
    const fromUnits = (this._units || []).filter(u => u.team === 'red');
    if (fromUnits.length) return fromUnits;
    return this._buildTitans(this.active === 'kryfto' ? 'kryfto' : 'lobby');
  },

  _buildWillaRoster() {
    const blue = this.OLYMPIAN_AGENTS.map(g => {
      const w = this.WILLA_UNIT_MAP[g.id] || { unit: 'unit', domain: 'ground', team: 'blue' };
      return { ...g, ...w, demo: true, agent: 'grok-heavy', t: Date.now() };
    });
    const red = this.TITAN_AGENTS.map(g => {
      const w = this.TITAN_UNIT_MAP[g.id] || { unit: 'unit', domain: 'ground', team: 'red' };
      return { ...g, ...w, demo: true, agent: 'cronian', t: Date.now() };
    });
    return [...blue, ...red];
  },

  wantsPyramid(line) {
    const low = String(line || '').toLowerCase();
    return /\b(pyramid|πυραμίδ|πυραμιδ|pyramids)\b/.test(low)
      && /\b(game|play|start|find|hunt|ξεκίνα|παιχνίδι)\b/.test(low)
      || /^(pyramid|pyramids)\b/.test(low);
  },

  wantsWilla(line) {
    const low = String(line || '').toLowerCase().replace(/\s+/g, ' ');
    return /\b(willa\s*game|willagame|willa\s*war|willa)\b/.test(low)
      || /\b(airfighters?|space\s*force|navy|seals?|spies|multi\s*domain)\b.*\b(game|war|battle|drone)/.test(low);
  },

  ensureDemoPlayers(mode) {
    const real = (window.others || []).filter(u => !u.demo);
    if (real.length) return real;
    if (!this._demo.length || mode === 'kryfto' || mode === 'lobby') {
      this._demo = this._buildAllDemo(mode === 'kryfto' ? 'kryfto' : 'lobby');
    }
    AstranovPresence?._applyOthers?.(this._demo);
    TelemachosPilot?.refreshTeamStatus?.({ quiet: true });
    return this._demo;
  },

  mergeLivePlayers(users) {
    const real = (users || []).filter(u => !u.demo);
    if (real.length) return real;
    if (this.active === 'kryfto' && this._demo.length) return this._demo;
    if (this.active === 'willa' && this._units.length) {
      return this._units.filter(u => u.unit !== 'drone' && u.unit !== 'spy').map(u => ({
        id: u.id, name: u.name, lat: u.lat, lng: u.lng, emoji: u.emoji, demo: true, game: 'willa', team: u.team,
      }));
    }
    return this._demo.length ? this._demo : [];
  },

  startKryftoDemo() {
    this.active = 'kryfto';
    AstranovPresence.game = 'kryfto';
    this.ensureDemoPlayers('kryfto');
    window.hidden = false;
    const others = window.others || [];
    others.forEach(u => {
      const tag = u.hidden ? 'hidden' : (u.role || 'agent');
      if (u.hidden) return;
      const color = u.team === 'red' ? this.TEAM_COLOR.red : u.agent === 'grok-heavy' ? this.OLYMPUS_GLOW : 0x3d9eff;
      MapDepict?.pulse?.(u.lat, u.lng, color, (u.emoji || '⚡') + ' ' + u.name + ' · ' + tag, 16000);
    });
    const p = window._lastPos || { lat: 36.44, lng: 28.22 };
    MapDepict?.action?.('play', { lat: p.lat, lng: p.lng, detail: 'κρυφτό · housekeeping demo' });
    MapDepict?.pulse?.(p.lat, p.lng, 0x1a6fd4, 'ΚΡΥΦΤΟ DEMO', 18000);
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
    GlobeDeck?.setTitle?.('ΚΡΥΦΤΟ · DEMO');
    GlobeDeck?.setPreview?.('◎ 12 Olympians 🔵 · 12 Cronians 🔴 · hide · seek');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    AciCli?.print('◎ κρυφτό · 12 Olympians 🔵 · 12 Cronians 🔴 (Kronos leads red)', 'ok');
    ACIControl?.reply('Blue gods vs red titans — hide to vanish · players to list all 24');
    FieldBrain?.pulse?.('play', 'kryfto demo', { role: 'client', props: { players: others.length + 1, demo: true } });
  },

  startPyramid() {
    this.active = 'pyramid';
    AstranovPresence.game = 'pyramid';
    this._pyramids = this.PYRAMID_SITES.map(s => ({ ...s }));
    GlobeEntity?.unregisterType?.('pyramid');
    this._pyramids.forEach((site, i) => {
      GlobeEntity?.register?.({
        id: 'pyr-' + site.id,
        type: 'pyramid',
        lat: site.lat,
        lng: site.lng,
        title: '🔺 ' + site.name,
        description: 'Pyramid hunt #' + (i + 1) + ' · fly here · tap marker',
        urgency: 2,
        color: 0xffdd44,
        onTap: (e) => {
          const p = latLngToPos(e.lat, e.lng, 1.04);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), 1.82);
          ACIControl?.reply('Pyramid · ' + site.name + ' — find all ' + this._pyramids.length + ' apex markers');
        },
      });
      MapDepict?.pulse?.(site.lat, site.lng, 0xffdd44, '🔺 ' + site.name, 20000);
    });
    GlobeDeck?.expand?.('Pyramid hunt');
    GlobeDeck?.setPreview?.('🔺 Find ' + this._pyramids.length + ' pyramids on the globe');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    AciCli?.print('◎ PYRAMID GAME · ' + this._pyramids.length + ' sites marked', 'ok');
    ACIControl?.reply('Pyramid hunt — fly to golden markers · Giza · Rhodes · Chichen Itza');
    FieldBrain?.pulse?.('play', 'pyramid hunt', { role: 'client', props: { sites: this._pyramids.length } });
  },

  startWilla() {
    this.active = 'willa';
    AstranovPresence.game = 'willa';
    this._units = this._buildWillaRoster();
    this._renderWillaUnits();
    GlobeDeck?.expand?.('Willa game');
    GlobeDeck?.setPreview?.('⚔ Willa · air · sea · ground · space · spies · drones');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    const nBlue = this._units.filter(u => u.team === 'blue').length;
    const nRed = this._units.filter(u => u.team === 'red').length;
    AciCli?.print('◎ WILLA GAME · ' + nBlue + ' Olympians 🔵 · ' + nRed + ' Cronians 🔴 · multi-domain warfare', 'ok');
    ACIControl?.reply('Willa — gods vs titans · Kronos leads red · air · sea · ground · space · spies · drones');
    FieldBrain?.pulse?.('play', 'willa game', { role: 'client', props: { units: this._units.length } });
    TelemachosPilot?.refreshTeamStatus?.({ quiet: true });
  },

  _renderWillaUnits() {
    GlobeEntity?.unregisterType?.('unit');
    GlobeEntity?.unregisterType?.('drone');
    GlobeEntity?.unregisterType?.('spy');
    this._units.forEach(u => {
      const isDrone = u.unit === 'drone';
      const isSpy = u.unit === 'spy';
      const type = isDrone ? 'drone' : isSpy ? 'spy' : 'unit';
      const dom = TelemachosPilot?.DOMAINS?.[u.domain] || {};
      const isOlympian = u.agent === 'grok-heavy';
      const teamColor = isOlympian ? this.OLYMPUS_BLUE : (this.TEAM_COLOR[u.team] || 0x3d9eff);
      const alt = u.alt || this.DOMAIN_ALT[u.domain] || 1.028;
      GlobeEntity?.register?.({
        id: 'willa-' + u.id,
        type,
        lat: u.lat,
        lng: u.lng,
        altitude: alt,
        title: (u.emoji || '⚔') + ' ' + u.name,
        description: (u.domain || u.unit || '') + ' · ' + (dom.label || u.domain)
          + ' · ' + (u.agent === 'cronian' ? 'Cronian titan' : 'Grok Heavy'),
        urgency: u.team === 'red' ? 3 : 2,
        color: teamColor,
        olympian: isOlympian,
        flag: isOlympian,
        icon: u.emoji || dom.emoji || '⚔',
        data: { unit: u },
        onTap: (e) => {
          const p = latLngToPos(e.lat, e.lng, alt);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), u.domain === 'air' || u.domain === 'fpv' ? 4.4 : 1.82);
          ACIControl?.reply(u.name + ' · ' + u.unit + ' · ' + u.domain + ' domain');
        },
      });
      MapDepict?.pulse?.(u.lat, u.lng, teamColor, u.emoji + ' ' + u.name, 14000);
    });
    AstranovPresence?._applyOthers?.(this.mergeLivePlayers([]));
  },

  _tick() {
    if (this.active === 'kryfto' && this._demo.length) {
      this._demo.forEach(u => {
        if (u.hidden) return;
        const prevLat = u._prevLat ?? u.lat;
        const prevLng = u._prevLng ?? u.lng;
        u.lat += (Math.random() - 0.5) * 0.004;
        u.lng += (Math.random() - 0.5) * 0.004;
        u.t = Date.now();
        if (u.agent === 'grok-heavy' && (u.role === 'seeker' || u.domain)) {
          if (Math.abs(u.lat - prevLat) > 0.0003 || Math.abs(u.lng - prevLng) > 0.0003) {
            MapDepict?.arc?.(prevLat, prevLng, u.lat, u.lng, this.OLYMPUS_GLOW, 18000);
          }
        }
        u._prevLat = u.lat;
        u._prevLng = u.lng;
      });
      if (!(window.others || []).some(o => !o.demo)) {
        AstranovPresence?._applyOthers?.(this._demo);
      }
    }
    if (this.active === 'willa' && this._units.length) {
      this._units.forEach(u => {
        const drift = u.domain === 'sea' || u.domain === 'underwater' ? 0.006 : 0.003;
        const prevLat = u._prevLat ?? u.lat;
        const prevLng = u._prevLng ?? u.lng;
        u.lat += (Math.random() - 0.5) * drift;
        u.lng += (Math.random() - 0.5) * drift;
        if (u.agent === 'grok-heavy') {
          const moved = Math.abs(u.lat - prevLat) > 0.0004 || Math.abs(u.lng - prevLng) > 0.0004;
          if (moved && (u.domain === 'air' || u.domain === 'fpv' || u.unit === 'spaceforce')) {
            MapDepict?.arc?.(prevLat, prevLng, u.lat, u.lng, this.OLYMPUS_GLOW, 24000);
          }
          if (u.unit === 'spaceforce' && Math.random() < 0.07) {
            const tipLat = u.lat + (Math.random() - 0.5) * 0.35;
            const tipLng = u.lng + (Math.random() - 0.5) * 0.35;
            MapDepict?.arc?.(u.lat, u.lng, tipLat, tipLng, this.OLYMPUS_GLOW, 20000);
            MapDepict?.pulse?.(tipLat, tipLng, this.OLYMPUS_GLOW, u.name + ' · launch', 14000);
          }
        }
        u._prevLat = u.lat;
        u._prevLng = u.lng;
      });
      this._renderWillaUnits();
    }
  },

  listStatus() {
    if (this.active === 'pyramid') {
      return this._pyramids.map((s, i) => (i + 1) + '. ' + s.name).join(' · ');
    }
    if (this.active === 'willa') {
      const blue = this._units.filter(u => u.team === 'blue').map(u => u.emoji + ' ' + u.name);
      const red = this._units.filter(u => u.team === 'red').map(u => u.emoji + ' ' + u.name);
      return '🔵 ' + blue.join(' · ') + ' · 🔴 ' + red.join(' · ');
    }
    const gods = (window.others || []).filter(u => u.agent === 'grok-heavy');
    const titans = (window.others || []).filter(u => u.agent === 'cronian');
    if (gods.length || titans.length) {
      const parts = [];
      if (gods.length) parts.push('🔵 ' + gods.map(u => u.emoji + ' ' + u.name).join(' · '));
      if (titans.length) parts.push('🔴 ' + titans.map(u => u.emoji + ' ' + u.name).join(' · '));
      return parts.join(' · ');
    }
    return (window.others || []).length + ' demo/live players';
  },
};

window.WillaGames = WillaGames;