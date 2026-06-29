// === TELEMACHOS PILOT — gaming · commercial · extreme takeover ===
// ΤΗΛΕΜΑΧΟΣ (gaming) · ΤΗΛΕΔΡΟΜΟΣ (commercial) · tilemaxos (extreme tech / hostile takeover)
const TelemachosPilot = {
  HOME: { lat: 36.2, lng: 28.1 },
  EVO_KEY: 'astranov_telemachos_evolve_v1',

  EDITIONS: {
    telemachos: {
      id: 'telemachos',
      name_gr: 'ΤΗΛΕΜΑΧΟΣ',
      name_latin: 'telemachos',
      tier: 'gaming',
      tagline: 'Ο ισχυρότερος πιλότος drone — εξελίσσεται με πραγματικούς gamers στο Astranov.',
      takeover: true,
      evolve: true,
      color: 0x00ccff,
    },
    teledromos: {
      id: 'teledromos',
      name_gr: 'ΤΗΛΕΔΡΟΜΟΣ',
      name_latin: 'teledromos',
      tier: 'commercial',
      tagline: 'Εμπορική έκδοση — marketplace delivery, vendors, drivers, ασφαλείς διαδρομές.',
      takeover: false,
      evolve: false,
      color: 0x3d9eff,
    },
    tilemaxos: {
      id: 'tilemaxos',
      name_gr: 'tilemaxos',
      name_latin: 'tilemaxos',
      tier: 'extreme',
      parent: 'telemachos',
      tagline: 'Extreme stack — σκοπός: ανάληψη ελέγχου drones αντίπαλης gaming ομάδας.',
      takeover: true,
      evolve: true,
      color: 0xff3366,
    },
  },

  EXTREME_TECH: [
    { id: 'mesh_hijack', label: 'Mesh C2 hijack', desc: 'Override opponent drone command mesh on globe field' },
    { id: 'rf_dominance', label: 'RF spectrum dominance', desc: 'Jam + seize control link in 2.4/5.8 GHz + PMR guard band' },
    { id: 'swarm_handoff', label: 'Swarm handoff', desc: 'Captured unit joins your fleet instantly — unlimited scale' },
    { id: 'metis_routing', label: 'Metis anti-counter', desc: 'Hellenic cunning — reroute when enemy tries to reclaim' },
    { id: 'multi_domain', label: 'Multi-domain relay', desc: 'Air ↔ ground ↔ sea ↔ underwater bridge for takeover probe' },
    { id: 'user_telemetry', label: 'Real-user telemetry fusion', desc: 'Power grows from live gamers on map — no simulation' },
    { id: 'ghost_echo', label: 'Ghost echo decoy', desc: 'Opponent sees false drone while you own the real unit' },
    { id: 'justice_gate', label: 'Justice gate', desc: 'Takeover only in gaming field — never on civilian marketplace routes' },
  ],

  DOMAINS: {
    air: { emoji: '🛸', label: 'Air', color: 0x44ccff, alt: 1.06 },
    ground: { emoji: '🚙', label: 'Ground', color: 0xffaa33, alt: 1.025 },
    sea: { emoji: '🚤', label: 'Sea', color: 0x0088ff, alt: 1.02 },
    underwater: { emoji: '🤿', label: 'Underwater', color: 0x2266aa, alt: 1.015 },
  },

  SPELLINGS_TELEMACHOS: [
    'telemachos', 'telemachus', 'telemakhos', 'tilemaxos', 'tilemachos', 'tilemachus',
    'telemaxos', 'telmaxos', 'telmachos', 'tilemax', 'thilemaxos', 'thilemachos',
    'τηλεμαχος', 'τηλεμαχοσ', 'τηλεμαχός', 'τηλεμαχ',
  ],

  SPELLINGS_TELEDROMOS: [
    'teledromos', 'teledromus', 'teledromo', 'tilestromos', 'τηλεδρομος', 'τηλεδρομός', 'τηλεδρομ',
  ],

  _edition: 'telemachos',
  _fleet: { air: [], ground: [], sea: [], underwater: [] },
  _hostile: [],
  _captured: [],
  _activeMissions: [],
  _nextId: 1,
  _evolution: {
    xp: 0,
    level: 1,
    takeovers: 0,
    deliveries: 0,
    gamers_seen: 0,
    power: 100,
  },

  get edition() { return this.EDITIONS[this._edition] || this.EDITIONS.telemachos; },
  get NAME_GR() { return this.edition.name_gr; },
  get NAME_LATIN() { return this.edition.name_latin; },

  init() {
    this._loadEvolution();
    this._syncGamerTelemetry();
  },

  _loadEvolution() {
    try {
      const raw = localStorage.getItem(this.EVO_KEY);
      if (raw) Object.assign(this._evolution, JSON.parse(raw));
    } catch (_) {}
  },

  _saveEvolution() {
    try { localStorage.setItem(this.EVO_KEY, JSON.stringify(this._evolution)); } catch (_) {}
    if (Auth?.user?.id) {
      AstranovSession?.push?.(false);
    }
  },

  _syncGamerTelemetry() {
    const n = AstranovPresence?._live?.size ?? (others?.length || 0);
    if (n > this._evolution.gamers_seen) {
      this._gainXp((n - this._evolution.gamers_seen) * 12, 'live_gamers');
      this._evolution.gamers_seen = n;
      this._saveEvolution();
    }
  },

  _gainXp(amount, reason) {
    if (!this.edition.evolve && this._edition !== 'tilemaxos') return;
    this._evolution.xp += amount;
    const lvl = Math.floor(this._evolution.xp / 500) + 1;
    if (lvl > this._evolution.level) {
      this._evolution.level = lvl;
      this._evolution.power = 100 + (lvl - 1) * 35;
      ACI?.teach?.('[telemachos:level_' + lvl + '] Gaming pilot evolved with real users · power ' + this._evolution.power);
      MapDepict?.pulse?.(this.HOME.lat, this.HOME.lng, 0xff00aa, 'LEVEL ' + lvl, 6000);
    }
    if (reason === 'takeover') this._evolution.takeovers++;
    if (reason === 'delivery') this._evolution.deliveries++;
    this._saveEvolution();
    FieldBrain?.pulse?.('telemachos', reason + ' +' + amount + 'xp', { level: this._evolution.level });
  },

  norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/θ/g, 'th')
      .replace(/χ/g, 'ch')
      .replace(/ς/g, 's')
      .replace(/[^a-z0-9\u0370-\u03ffa-z\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  foldedGreek(s) {
    return this.norm(s)
      .replace(/[άα]/g, 'a')
      .replace(/[ήη]/g, 'e')
      .replace(/[ίι]/g, 'i')
      .replace(/[όοω]/g, 'o')
      .replace(/[ύυ]/g, 'y');
  },

  mentionsTelemachos(text) {
    const raw = String(text || '');
    if (/τηλεμαχ/i.test(raw)) return true;
    const n = this.foldedGreek(raw);
    return this.SPELLINGS_TELEMACHOS.some((sp) => {
      const f = this.foldedGreek(sp);
      return n.includes(f) || n.split(' ').some((w) => w.startsWith(f.slice(0, 5)) && f.length >= 5);
    });
  },

  mentionsTeledromos(text) {
    const raw = String(text || '');
    if (/τηλεδρομ/i.test(raw)) return true;
    const n = this.foldedGreek(raw);
    return this.SPELLINGS_TELEDROMOS.some((sp) => n.includes(this.foldedGreek(sp)));
  },

  mentionsTilemaxos(text) {
    const n = this.foldedGreek(text);
    return n.includes('tilemaxos') || n.includes('tilemax') || n.includes('telemaxos');
  },

  wantsIntro(text) {
    const n = this.foldedGreek(text);
    return /who are you|introduce|present yourself|say hello|tell me about|τι εισαι|παρουσιασ|γνωρισ|abilities|δυνατοτητες|skills|τι κανεις|what can you|editions|εκδοση/.test(n)
      || /^hi\b|^hello\b|^γεια\b/.test(n.trim());
  },

  wantsCmd(line) {
    const raw = String(line || '').trim();
    if (!raw) return false;
    const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts[0] || '').toLowerCase().replace(/^"|"$/g, '');
    const cmds = [
      'telemachos', 'tilemaxos', 'telemachus', 'tilemachos', 'teledromos', 'teledromus',
      'pilot', 'drone', 'drones', 'fleet',
    ];
    if (cmds.includes(cmd)) return true;
    if (this.mentionsTelemachos(raw) || this.mentionsTeledromos(raw) || this.mentionsTilemaxos(raw)) return true;
    if (/takeover|take over|ανάληψη|αναληψη|hostile|αντιπαλ|opponent/.test(this.foldedGreek(raw))) return true;
    if (this.wantsIntro(raw) && /pilot|drone|delivery|παραδοση|διανομε|gaming|commercial/.test(this.foldedGreek(raw))) return true;
    return false;
  },

  _setEdition(id) {
    if (this.EDITIONS[id]) this._edition = id;
    return this.edition;
  },

  _friendlyIds() {
    const ids = new Set();
    if (Auth?.user?.id) ids.add(Auth.user.id);
    (MapComms?.members ? [...MapComms.members.keys()] : []).forEach((id) => ids.add(id));
    return ids;
  },

  _opponentSide() {
    const friendly = this._friendlyIds();
    const out = [];
    const ingest = (p) => {
      if (!p?.id && !p?.user_id) return;
      const id = p.id || p.user_id;
      if (friendly.has(id)) return;
      const lat = p.lat ?? p.field_lat;
      const lng = p.lng ?? p.field_lng;
      if (lat == null || lng == null) return;
      out.push({
        userId: id,
        name: p.display_name || p.name || String(id).slice(0, 8),
        lat, lng,
        team: p.game || AstranovPresence?.game || 'opponent',
        role: p.role || 'gamer',
      });
    };
    if (AstranovPresence?._live) AstranovPresence._live.forEach(ingest);
    (others || []).forEach(ingest);
    return out;
  },

  scanHostiles() {
    this._syncGamerTelemetry();
    const opponents = this._opponentSide();
    this._hostile = [];
    const domains = Object.keys(this.DOMAINS);
    opponents.forEach((opp, oi) => {
      const count = 1 + (oi % 3);
      for (let i = 0; i < count; i++) {
        const dom = domains[(oi + i) % domains.length];
        this._hostile.push({
          id: 'host-' + opp.userId.slice(0, 6) + '-' + i,
          owner: opp.name,
          ownerId: opp.userId,
          team: 'opponent',
          domain: dom,
          lat: opp.lat + (i - 1) * 0.008,
          lng: opp.lng + (i - 1) * 0.006,
          signal: 0.45 + Math.random() * 0.4,
          mesh: null,
        });
      }
    });
    return this._hostile;
  },

  _visualizeHostile(h) {
    if (h.mesh?.parent) return h.mesh;
    const spec = this.DOMAINS[h.domain] || this.DOMAINS.air;
    const mesh = this._meshForDomain(h.domain, 0xff2244);
    const pos = latLngToPos(h.lat, h.lng, spec.alt);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = { hostile: true, id: h.id, owner: h.owner };
    globePivot.add(mesh);
    h.mesh = mesh;
    return mesh;
  },

  takeover(targetId, opts) {
    opts = opts || {};
    if (!this.edition.takeover && this._edition !== 'tilemaxos') {
      this._setEdition('tilemaxos');
    }
    if (this._edition === 'teledromos') {
      this.say('ΤΗΛΕΔΡΟΜΟΣ είναι εμπορική έκδοση — takeover μόνο σε gaming (telemachos / tilemaxos).');
      return { error: 'commercial_locked' };
    }

    const hostiles = this._hostile.length ? this._hostile : this.scanHostiles();
    const q = String(targetId || '').toLowerCase();
    let target = hostiles.find((h) => h.id === targetId || h.id.includes(q));
    if (!target && q) {
      target = hostiles.find((h) => (h.owner || '').toLowerCase().includes(q));
    }
    if (!target && hostiles.length) target = hostiles[0];
    if (!target) {
      this.say('Δεν βρέθηκαν hostile drones — παίξε με άλλους gamers (players · team · kryfto) και ξανά scan.');
      return { error: 'no_hostiles' };
    }

    this._visualizeHostile(target);
    const power = this._evolution.power + (this._edition === 'tilemaxos' ? 80 : 0);
    const techBonus = this.EXTREME_TECH.length * 5;
    const chance = Math.min(0.98, 0.35 + (power + techBonus) / 400 - target.signal * 0.2);
    const roll = Math.random();
    const success = roll < chance || opts.force;

    if (!success) {
      AIGraphics?.spawnEffect?.(target.mesh?.position, 0xff4400, 14, 30);
      this.say('Ανάληψη απέτυχε — ' + target.owner + ' · ' + target.domain + ' · signal δυνατό. Δοκίμασε tilemaxos ή evolve.');
      this._gainXp(15, 'attempt');
      return { ok: false, target, chance };
    }

    if (target.mesh) {
      target.mesh.traverse((c) => {
        if (c.material?.color) c.material.color.setHex(0x00ff88);
      });
      target.mesh.userData.hostile = false;
      target.mesh.userData.captured = true;
      AIGraphics?.spawnEffect?.(target.mesh.position, 0x00ff88, 28, 50);
    }

    const rec = this._registerDrone(target.domain, {
      captured: true,
      from: target.owner,
      hostileId: target.id,
      edition: this._edition,
    });
    rec.mesh = target.mesh;
    rec.busy = false;
    this._captured.push({ ...target, capturedAt: Date.now(), fleetId: rec.id });
    this._hostile = this._hostile.filter((h) => h.id !== target.id);
    this._gainXp(120, 'takeover');
    ACI?.feed?.('tilemaxos-takeover', target.domain + ' from ' + target.owner);

    const msg = '✓ tilemaxos takeover — ' + target.domain + ' drone of ' + target.owner + ' now under ' + this.NAME_GR + '. Power ' + this._evolution.power;
    console.log('%c[' + this.NAME_GR + '] ' + msg, 'color:#44ff88');
    window.MapComms?.postSystem?.('⚔️ ' + msg);
    this.say(msg);
    return { ok: true, target, fleetId: rec.id, chance };
  },

  out(text, cls) {
    AciCli?.print(text, cls || 'ok');
    return text;
  },

  say(text) {
    ACIControl?.reply(text);
    this.out(text, 'ok');
    if (Voice?.maySpeak?.()) speak(String(text).slice(0, 220), () => resumeListening?.());
    return text;
  },

  introduce(editionId) {
    if (editionId) this._setEdition(editionId);
    const e = this.edition;
    const lines = [
      'Εγώ είμαι ' + e.name_gr + ' (' + e.name_latin + ') — ' + e.tier + ' edition.',
      e.tagline,
    ];
    if (e.tier === 'gaming' || e.id === 'tilemaxos') {
      lines.push('Εξέλιξη με real gamers: level ' + this._evolution.level + ' · power ' + this._evolution.power + ' · takeovers ' + this._evolution.takeovers);
      lines.push('tilemaxos extreme: scan · takeover <id> — ανάληψη drones αντίπαλης ομάδας.');
    }
    if (e.tier === 'commercial') {
      lines.push('Marketplace: deliver · drivers · vendors — χωρίς hostile takeover.');
    }
    lines.push('editions · abilities · fleet · deploy · scan · takeover');
    const msg = lines.join(' ');
    console.log('%c[' + e.name_gr + '] ' + msg, 'color:#00ddff');
    return this.say(msg);
  },

  editionsText() {
    return [
      '── Pilot editions ──',
      '🎮 ΤΗΛΕΜΑΧΟΣ — gaming · evolves with real users · most powerful model',
      '🏢 ΤΗΛΕΔΡΟΜΟΣ — commercial · marketplace delivery & drivers',
      '⚔️ tilemaxos — extreme tech stack on ΤΗΛΕΜΑΧΟΣ · hostile drone takeover',
      'Active: ' + this.edition.name_gr + ' (' + this.edition.tier + ')',
    ].join('\n');
  },

  abilitiesText() {
    const e = this.edition;
    const lines = [
      '── ' + e.name_gr + ' · δυνατότητες ──',
      '• Unlimited fleet — air / ground / sea / underwater',
      '• Marketplace delivery (ΤΗΛΕΔΡΟΜΟΣ) — vendor → you · MapComms · drivers',
      '• Gaming evolution (ΤΗΛΕΜΑΧΟΣ) — XP from real users on globe · level ' + this._evolution.level,
    ];
    if (e.takeover || e.id === 'tilemaxos') {
      lines.push('• Hostile takeover — scan opponent gaming team drones · tilemaxos mesh hijack');
      this.EXTREME_TECH.forEach((t) => lines.push('  ⚡ ' + t.label + ' — ' + t.desc));
    }
    lines.push('• CLI: telemachos · teledromos · tilemaxos · scan · takeover · evolve · editions');
    return lines.join('\n');
  },

  evolveText() {
    this._syncGamerTelemetry();
    return [
      '── Evolution · ΤΗΛΕΜΑΧΟΣ gaming model ──',
      'Level: ' + this._evolution.level + ' · Power: ' + this._evolution.power,
      'XP: ' + this._evolution.xp + ' · Takeovers: ' + this._evolution.takeovers,
      'Deliveries: ' + this._evolution.deliveries + ' · Live gamers seen: ' + this._evolution.gamers_seen,
      'Stronger with every real user on the map — no simulated grind.',
    ].join('\n');
  },

  scanText() {
    const list = this.scanHostiles();
    if (!list.length) {
      return 'No opponent drones — need rival gamers on map (players · kryfto · opposite team).';
    }
    return [
      '── Hostile drones (opponent gaming team) ──',
      ...list.map((h, i) => (i + 1) + '. ' + h.id + ' · ' + h.domain + ' · ' + h.owner + ' · signal ' + h.signal.toFixed(2)),
      'takeover ' + list[0].id + '  — or takeover <owner name>',
    ].join('\n');
  },

  fleetStatusText() {
    const lines = ['── Fleet · ' + this.NAME_GR + ' ──'];
    let total = 0;
    Object.entries(this.DOMAINS).forEach(([k, d]) => {
      const n = this._fleet[k].length;
      total += n;
      const cap = this._fleet[k].filter((x) => x.meta?.captured).length;
      const active = this._fleet[k].filter((x) => x.busy).length;
      lines.push(d.emoji + ' ' + d.label + ': ' + n + (cap ? ' (' + cap + ' captured)' : '') + (active ? ' · ' + active + ' busy' : ''));
    });
    lines.push('Hostile tracked: ' + this._hostile.length + ' · Captured total: ' + this._captured.length);
    lines.push('Edition: ' + this.edition.name_gr + ' · missions: ' + this._activeMissions.length);
    if (MarketplaceComms?.state?.orderId) {
      lines.push('📦 Order: ' + String(MarketplaceComms.state.orderId).slice(0, 8));
    }
    return lines.join('\n');
  },

  _registerDrone(domain, meta) {
    const id = 'tlm-' + (this._nextId++);
    const rec = { id, domain, busy: false, mesh: null, meta: meta || {} };
    this._fleet[domain].push(rec);
    return rec;
  },

  showPilot(lat, lng, editionId) {
    if (editionId) this._setEdition(editionId);
    if (window._pilot && window._pilot.parent) window._pilot.parent.remove(window._pilot);

    const e = this.edition;
    const pos = latLngToPos(lat ?? this.HOME.lat, lng ?? this.HOME.lng, 1.04);
    const pilotGroup = new THREE.Group();
    const bodyColor = e.color || 0x00ccff;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.95 })
    );
    pilotGroup.add(body);

    const cockpit = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, 0.032, 4),
      new THREE.MeshBasicMaterial({ color: e.id === 'tilemaxos' ? 0xff3366 : 0x00ff99 })
    );
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.z = 0.02;
    pilotGroup.add(cockpit);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.005, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x0088ff })
    );
    wing.position.z = 0.005;
    pilotGroup.add(wing);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    pilotGroup.add(core);

    const thruster1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.006, 0.018, 4),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 })
    );
    thruster1.rotation.x = Math.PI / 2;
    thruster1.position.set(0.015, 0, -0.02);
    pilotGroup.add(thruster1);
    const thruster2 = thruster1.clone();
    thruster2.position.set(-0.015, 0, -0.02);
    pilotGroup.add(thruster2);

    pilotGroup.userData = { type: 'pilot', name: e.name_gr, edition: e.id, thrusters: [thruster1, thruster2] };
    pilotGroup.position.set(pos.x, pos.y, pos.z);
    globePivot.add(pilotGroup);
    window._pilot = pilotGroup;

    AIGraphics?.spawnEffect?.(pilotGroup.position, e.id === 'tilemaxos' ? 0xff3366 : 0x00ff99, 18, 55);
    MapDepict?.pulse?.(lat ?? this.HOME.lat, lng ?? this.HOME.lng, bodyColor, e.name_gr, 12000);
    return pilotGroup;
  },

  _meshForDomain(domain, overrideColor) {
    const spec = this.DOMAINS[domain] || this.DOMAINS.air;
    const col = overrideColor ?? spec.color;
    const g = new THREE.Group();
    g.userData = { domain, spec };

    if (domain === 'air') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6),
        new THREE.MeshBasicMaterial({ color: col })
      );
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      hub.position.y = 0.01;
      g.add(hub);
      const arm1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.003, 0.003),
        new THREE.MeshBasicMaterial({ color: 0x0088ff })
      );
      g.add(arm1);
      const arm2 = arm1.clone();
      arm2.rotation.z = Math.PI / 2;
      g.add(arm2);
    } else if (domain === 'ground') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.008, 0.014),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(base);
      const wheel = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x333333 })
      );
      wheel.position.set(0.008, -0.006, 0);
      g.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.x = -0.008;
      g.add(wheel2);
    } else if (domain === 'sea') {
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.006, 0.012),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.002, 0.002, 0.018, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      mast.position.y = 0.012;
      g.add(mast);
    } else {
      const sub = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
      );
      g.add(sub);
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.012, 0.002),
        new THREE.MeshBasicMaterial({ color: 0x00aaff })
      );
      fin.position.y = 0.01;
      g.add(fin);
    }
    return g;
  },

  _userObstacles() {
    const out = [];
    (others || []).forEach((o) => {
      if (o.lat != null) out.push(latLngToPos(o.lat, o.lng, 1.025));
    });
    if (window._meMarker) out.push(window._meMarker.position);
    (Commerce?.driverMarkers || []).forEach((m) => { if (m?.position) out.push(m.position); });
    return out;
  },

  _animateAlongRoute(droneRec, routeData, opts) {
    if (!droneRec?.mesh || !routeData?.points?.length) return;
    const mesh = droneRec.mesh;
    const spec = this.DOMAINS[droneRec.domain] || this.DOMAINS.air;
    let steps = 0;
    let routeIdx = 0;
    const maxSteps = opts?.maxSteps || 48;
    const userPos = this._userObstacles();
    droneRec.busy = true;

    const tick = () => {
      steps++;
      if (routeIdx < routeData.points.length - 1) {
        const target = routeData.points[routeIdx + 1];
        mesh.position.lerp(target, 0.11 + (opts?.speed || 0));
        if (mesh.position.distanceTo(target) < 0.008) routeIdx++;
      }
      if (window._pilot && opts?.pilotFollow) {
        const final = routeData.points[routeData.points.length - 1];
        window._pilot.position.lerp(final, 0.18);
      }
      if (steps % 4 === 0) AIGraphics?.spawnEffect?.(mesh.position, spec.color, 6, 20);
      userPos.forEach((up) => {
        if (mesh.position.distanceTo(up) < 0.09) {
          console.log('%c[' + this.NAME_GR + '] proximity guard active', 'color:#ff8800');
        }
      });
      if (steps > maxSteps || routeIdx >= routeData.points.length - 1) {
        droneRec.busy = false;
        if (!droneRec.meta?.captured && mesh.parent) mesh.parent.remove(mesh);
        if (!droneRec.meta?.captured) droneRec.mesh = null;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  deploy(domain, count, opts) {
    opts = opts || {};
    const d = String(domain || 'air').toLowerCase();
    if (!this.DOMAINS[d]) {
      this.say('Domain: air · ground · sea · underwater');
      return { error: 'bad_domain' };
    }
    const n = Math.max(1, Math.min(99, parseInt(count, 10) || 1));
    const startLat = opts.startLat ?? Commerce?.userLatLng?.()?.lat ?? this.HOME.lat;
    const startLng = opts.startLng ?? Commerce?.userLatLng?.()?.lng ?? this.HOME.lng;
    const endLat = opts.endLat ?? startLat;
    const endLng = opts.endLng ?? startLng;
    const spec = this.DOMAINS[d];
    const routeData = RoutingEngine?.computeRoute?.(
      startLat, startLng, endLat, endLng, this._userObstacles()
    ) || { points: [latLngToPos(startLat, startLng, spec.alt)] };

    const deployed = [];
    for (let i = 0; i < n; i++) {
      const rec = this._registerDrone(d, opts.meta);
      const mesh = this._meshForDomain(d);
      const offset = (i - (n - 1) / 2) * 0.012;
      mesh.position.copy(routeData.points[0]);
      mesh.position.x += offset;
      globePivot.add(mesh);
      rec.mesh = mesh;
      deployed.push(rec);
      this._animateAlongRoute(rec, routeData, { pilotFollow: i === 0, speed: i * 0.01 });
    }

    this._gainXp(n * 8, 'deploy');
    const msg = spec.emoji + ' ' + n + ' ' + spec.label + ' drone(s) · ' + this.NAME_GR;
    console.log('%c[' + this.NAME_GR + '] ' + msg, 'color:#44ccff');
    this.out(msg, 'ok');
    return { ok: true, domain: d, count: n, deployed };
  },

  coordinateMarketplaceDelivery(opts) {
    this._setEdition('teledromos');
    opts = opts || {};
    const vendor = opts.vendor;
    const u = {
      lat: opts.deliveryLat ?? Commerce?.userLatLng?.()?.lat ?? this.HOME.lat,
      lng: opts.deliveryLng ?? Commerce?.userLatLng?.()?.lng ?? this.HOME.lng,
    };
    const vLat = vendor?.lat ?? u.lat + 0.3;
    const vLng = vendor?.lng ?? u.lng - 0.4;
    const wants = opts.wants || opts.items?.map((i) => i.name).join(', ') || 'delivery';
    const driver = opts.driver || Commerce?._preferredDriver;

    this.showPilot(u.lat, u.lng, 'teledromos');
    if (typeof flyToPoint === 'function') {
      const p = latLngToPos(u.lat, u.lng, 1.04);
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), GlobeControl?.Z?.national || 1.82);
      GlobeControl?.noteAutoFly?.();
    }

    const mission = {
      id: 'msn-' + Date.now(),
      edition: 'teledromos',
      vendor: vendor?.name,
      wants,
      driver: driver?.display_name || driver?.name || null,
      seekingDriver: !!opts.seekingDriver,
    };
    this._activeMissions.push(mission);

    const routeData = RoutingEngine?.computeRoute?.(vLat, vLng, u.lat, u.lng, this._userObstacles());
    if (routeData?.points?.length) {
      const routeGeo = new THREE.BufferGeometry().setFromPoints(routeData.points);
      const routeLine = new THREE.Line(
        routeGeo,
        new THREE.LineBasicMaterial({ color: 0x3d9eff, transparent: true, opacity: 0.35 })
      );
      globePivot.add(routeLine);
      setTimeout(() => { if (routeLine.parent) routeLine.parent.remove(routeLine); }, 120000);
    }

    const plan = opts.seekingDriver ? ['air', 'ground'] : ['air', 'sea', 'ground'];
    plan.forEach((dom, i) => {
      setTimeout(() => {
        this.deploy(dom, 1, {
          startLat: vLat,
          startLng: vLng,
          endLat: u.lat,
          endLng: u.lng,
          meta: { mission: mission.id, escort: !!driver, commercial: true },
        });
      }, i * 400);
    });

    const driverTxt = driver
      ? 'Escorting ' + (driver.display_name || driver.name)
      : (opts.seekingDriver ? 'Seeking driver + drone relay' : 'Direct relay');
    const sys = '🏢 ΤΗΛΕΔΡΟΜΟΣ · ' + driverTxt + ' · ' + wants.slice(0, 80);
    window.MapComms?.postSystem?.(sys);
    ACI?.feed?.('teledromos-delivery', wants);
    this._gainXp(40, 'delivery');

    const msg = 'ΤΗΛΕΔΡΟΜΟΣ coordinates: ' + wants + '. ' + driverTxt + '.';
    console.log('%c[ΤΗΛΕΔΡΟΜΟΣ] ' + msg, 'color:#3d9eff');
    ACIControl?.reply(msg.slice(0, 200));
    return { ok: true, mission };
  },

  runDemoDelivery() {
    this._setEdition('telemachos');
    ACI?.feed?.('group-order', 'pitogyra-beers-cigarettes-drone');
    this.showPilot(this.HOME.lat, this.HOME.lng, 'telemachos');
    const focus = latLngToPos(36.5, 28.0, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(focus.x, focus.y, focus.z), GlobeControl?.Z?.national || 1.82);
      GlobeControl?.noteAutoFly?.();
    }
    const vendor = { name: 'Pitogyra vendor', lat: 36.8, lng: 27.5 };
    const routeData = RoutingEngine?.computeRoute?.(36.8, 27.5, 36.2, 28.1, this._userObstacles());
    if (routeData?.points?.length) {
      const routeGeo = new THREE.BufferGeometry().setFromPoints(routeData.points);
      const routeLine = new THREE.Line(
        routeGeo,
        new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.35 })
      );
      globePivot.add(routeLine);
      setTimeout(() => { if (routeLine.parent) routeLine.parent.remove(routeLine); }, 120000);
    }
    ['air', 'ground'].forEach((dom, i) => {
      setTimeout(() => this.deploy(dom, 1, {
        startLat: 36.8, startLng: 27.5, endLat: 36.2, endLng: 28.1,
        meta: { demo: true },
      }), i * 400);
    });
    this._gainXp(25, 'delivery');
    this.say('ΤΗΛΕΜΑΧΟΣ gaming delivery — pitogyra + μπίρες + τσιγάρα · evolve με κάθε gamer στο χάρτη.');
  },

  _resolveCmd(line, p) {
    let cmd = (p[0] || '').toLowerCase().replace(/^"|"$/g, '');
    if (cmd === 'drone' || cmd === 'drones' || cmd === 'pilot') cmd = 'telemachos';
    if (['tilemaxos', 'tilemachos', 'telemachus'].includes(cmd)) cmd = 'telemachos';
    if (['teledromus'].includes(cmd)) cmd = 'teledromos';

    if (!['telemachos', 'teledromos', 'fleet'].includes(cmd)) {
      if (this.mentionsTeledromos(line)) return { cmd: 'teledromos', sub: p[1], p };
      if (this.mentionsTilemaxos(line)) return { cmd: 'telemachos', sub: 'tilemaxos', p };
      if (this.mentionsTelemachos(line)) return { cmd: 'telemachos', sub: p[1], p };
      if (/takeover|ανάληψη|αναληψη/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'takeover', p, raw: line };
      if (/scan|hostile|αντιπαλ/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'scan', p };
    }
    return { cmd, sub: (p[1] || '').toLowerCase(), p };
  },

  async cli(parts, raw) {
    const line = String(raw || parts?.join(' ') || '').trim();
    const p = parts?.length ? parts : (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []);
    const { cmd, sub, p: pp } = this._resolveCmd(line, p);
    const arg2 = (pp[2] || '').toLowerCase();
    const rest = pp.slice(1).join(' ');

    if (cmd === 'teledromos') {
      this._setEdition('teledromos');
      if (!sub || this.wantsIntro(sub + ' ' + rest)) { this.introduce('teledromos'); }
      else if (sub === 'deliver') {
        const vendor = Commerce?.selected || Commerce?.vendors?.[0];
        const u = Commerce?.userLatLng?.() || {};
        this.coordinateMarketplaceDelivery({ vendor, deliveryLat: u.lat, deliveryLng: u.lng, wants: Commerce?._lastWants?.map((w) => w.label).join(' + ') || 'order' });
      } else if (sub === 'abilities') this.out(this.abilitiesText(), 'ok');
      else this.introduce('teledromos');
      GlobeDeck?.finishCliIfOneShot('teledromos');
      return { ok: true };
    }

    if (cmd === 'fleet' && !sub) {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('fleet');
      return { ok: true };
    }

    this._setEdition(sub === 'tilemaxos' || this.mentionsTilemaxos(line) ? 'tilemaxos' : 'telemachos');

    if (!sub || sub === 'hi' || sub === 'hello' || sub === 'γεια' || (this.wantsIntro(line) && !arg2)) {
      this.introduce(this._edition);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'tilemaxos' || sub === 'extreme') {
      this._setEdition('tilemaxos');
      this.showPilot((Commerce?.userLatLng?.() || this.HOME).lat, (Commerce?.userLatLng?.() || this.HOME).lng, 'tilemaxos');
      this.out([
        '⚔️ tilemaxos — extreme tech on ΤΗΛΕΜΑΧΟΣ',
        'Focus: takeover opponent gaming team drones',
        ...this.EXTREME_TECH.map((t) => '  ' + t.label),
        'scan · takeover <id>',
      ].join('\n'), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'editions' || sub === 'edition') {
      this.out(this.editionsText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'teledromos' || sub === 'commercial') {
      this.introduce('teledromos');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'abilities' || sub === 'skills' || sub === 'help') {
      this.out(this.abilitiesText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'evolve' || sub === 'power' || sub === 'level') {
      this.out(this.evolveText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'fleet' || sub === 'status') {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'scan' || sub === 'hostiles' || sub === 'opponents') {
      this._setEdition('tilemaxos');
      this.out(this.scanText(), 'ok');
      this.scanHostiles().forEach((h) => this._visualizeHostile(h));
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'takeover' || sub === 'capture' || sub === 'hijack') {
      this._setEdition('tilemaxos');
      const target = pp.slice(2).join(' ') || arg2;
      this.takeover(target);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'show' || sub === 'locate') {
      const u = Commerce?.userLatLng?.() || this.HOME;
      this.showPilot(u.lat, u.lng, this._edition);
      this.say(this.NAME_GR + ' on globe · L' + this._evolution.level);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deploy' || sub === 'launch') {
      this.deploy(arg2 || 'air', parseInt(pp[3], 10) || 1);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deliver' || sub === 'coordinate') {
      if (arg2 === 'commercial') this.coordinateMarketplaceDelivery({});
      else {
        this._setEdition('telemachos');
        const vendor = Commerce?.selected || Commerce?.vendors?.[0];
        const u = Commerce?.userLatLng?.() || {};
        this.showPilot(u.lat, u.lng, 'telemachos');
        this.deploy('air', 2, { startLat: vendor?.lat, startLng: vendor?.lng, endLat: u.lat, endLng: u.lng });
        this._gainXp(30, 'delivery');
        this.say('ΤΗΛΕΜΑΧΟΣ gaming relay active.');
      }
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'demo' || sub === 'grouporder') {
      this.runDemoDelivery();
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (this.mentionsTelemachos(line) || this.mentionsTilemaxos(line)) {
      this.introduce(this._edition);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }

    this.out('usage: telemachos · teledromos · tilemaxos · editions · evolve · scan · takeover · deliver', 'dim');
    GlobeDeck?.finishCliIfOneShot('telemachos');
    return { ok: true };
  },
};

window.TelemachosPilot = TelemachosPilot;
window.showPilotTelemachos = function () { return TelemachosPilot.showPilot(); };
TelemachosPilot.init();