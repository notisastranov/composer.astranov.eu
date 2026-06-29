// === TELEMACHOS PILOT — drone commander for marketplace delivery ===
// ΤΗΛΕΜΑΧΟΣ (tilemaxos) · unlimited air · ground · sea · underwater fleet
const TelemachosPilot = {
  NAME_GR: 'ΤΗΛΕΜΑΧΟΣ',
  NAME_LATIN: 'tilemaxos',
  HOME: { lat: 36.2, lng: 28.1 },

  DOMAINS: {
    air: { emoji: '🛸', label: 'Air', color: 0x44ccff, alt: 1.06 },
    ground: { emoji: '🚙', label: 'Ground', color: 0xffaa33, alt: 1.025 },
    sea: { emoji: '🚤', label: 'Sea', color: 0x0088ff, alt: 1.02 },
    underwater: { emoji: '🤿', label: 'Underwater', color: 0x2266aa, alt: 1.015 },
  },

  SPELLINGS: [
    'telemachos', 'telemachus', 'telemakhos', 'tilemaxos', 'tilemachos', 'tilemachus',
    'telemaxos', 'telmaxos', 'telmachos', 'tilemax', 'thilemaxos', 'thilemachos',
    'τηλεμαχος', 'τηλεμαχοσ', 'τηλεμαχός', 'τηλεμαχ',
  ],

  _fleet: { air: [], ground: [], sea: [], underwater: [] },
  _activeMissions: [],
  _nextId: 1,

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

  mentionsName(text) {
    const raw = String(text || '');
    if (/τηλεμαχ/i.test(raw)) return true;
    const n = this.foldedGreek(raw);
    return this.SPELLINGS.some((sp) => {
      const f = this.foldedGreek(sp);
      return n.includes(f) || n.split(' ').some((w) => w.startsWith(f.slice(0, 5)) && f.length >= 5);
    });
  },

  wantsIntro(text) {
    const n = this.foldedGreek(text);
    return /who are you|introduce|present yourself|say hello|tell me about|τι εισαι|παρουσιασ|γνωρισ|abilities|δυνατοτητες|skills|τι κανεις|what can you/.test(n)
      || /^hi\b|^hello\b|^γεια\b/.test(n.trim());
  },

  wantsCmd(line) {
    const raw = String(line || '').trim();
    if (!raw) return false;
    const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts[0] || '').toLowerCase().replace(/^"|"$/g, '');
    if (['telemachos', 'tilemaxos', 'telemachus', 'tilemachos', 'pilot', 'drone', 'drones', 'fleet'].includes(cmd)) return true;
    if (this.mentionsName(raw)) return true;
    if (this.wantsIntro(raw) && /pilot|drone|delivery|παραδοση|διανομε/.test(this.foldedGreek(raw))) return true;
    return false;
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

  introduce() {
    const msg = [
      'Εγώ είμαι ο Πιλότος ' + this.NAME_GR + ' (' + this.NAME_LATIN + ') — γιος της Αθηνάς, σύμβουλος παράδοσης στο Astranov marketplace.',
      'Ελέγχω απεριόριστα drones: αέρα 🛸 · χερσαίο 🚙 · θάλασσα 🚤 · υποβρύχιο 🤿.',
      'Συντονίζω με οδηγούς delivery, vendors και εσένα — ασφαλείς διαδρομές, χωρίς ψεύτικα καταστήματα.',
      'Γράψε: telemachos abilities · fleet · deploy air 3 · deliver · show',
    ].join(' ');
    console.log('%c[' + this.NAME_GR + '] ' + msg, 'color:#00ddff');
    return this.say(msg);
  },

  abilitiesText() {
    return [
      '── ' + this.NAME_GR + ' · δυνατότητες ──',
      '• Unlimited fleet — air / ground / sea / underwater drones (real map routes)',
      '• Marketplace delivery — vendor → you, sync με drivers & MapComms cloud',
      '• Safe routing — RoutingEngine avoids users & drivers on globe',
      '• Multi-drone missions — escort driver ή direct last-mile',
      '• CLI (any spelling): telemachos · tilemaxos · τηλεμαχος · pilot · drone',
      '• Commands: abilities · fleet · deploy <domain> [n] · deliver · coordinate · show',
    ].join('\n');
  },

  fleetStatusText() {
    const lines = ['── Fleet · ' + this.NAME_GR + ' ──'];
    let total = 0;
    Object.entries(this.DOMAINS).forEach(([k, d]) => {
      const n = this._fleet[k].length;
      total += n;
      const active = this._fleet[k].filter((x) => x.busy).length;
      lines.push(d.emoji + ' ' + d.label + ': ' + n + ' deployed' + (active ? ' · ' + active + ' on mission' : ''));
    });
    lines.push('Σύνολο: ' + total + ' drones · missions: ' + this._activeMissions.length);
    if (MarketplaceComms?.state?.orderId) {
      lines.push('📦 Active order: ' + String(MarketplaceComms.state.orderId).slice(0, 8));
    }
    return lines.join('\n');
  },

  _registerDrone(domain, meta) {
    const id = 'tlm-' + (this._nextId++);
    const rec = { id, domain, busy: false, mesh: null, meta: meta || {} };
    this._fleet[domain].push(rec);
    return rec;
  },

  showPilot(lat, lng) {
    if (window._pilot && window._pilot.parent) window._pilot.parent.remove(window._pilot);

    const pos = latLngToPos(lat ?? this.HOME.lat, lng ?? this.HOME.lng, 1.04);
    const pilotGroup = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.95 })
    );
    pilotGroup.add(body);

    const cockpit = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, 0.032, 4),
      new THREE.MeshBasicMaterial({ color: 0x00ff99 })
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

    pilotGroup.userData = { type: 'pilot', name: this.NAME_GR, thrusters: [thruster1, thruster2] };
    pilotGroup.position.set(pos.x, pos.y, pos.z);
    globePivot.add(pilotGroup);
    window._pilot = pilotGroup;

    AIGraphics?.spawnEffect?.(pilotGroup.position, 0x00ff99, 18, 55);
    MapDepict?.pulse?.(lat ?? this.HOME.lat, lng ?? this.HOME.lng, 0x00ddff, this.NAME_GR, 12000);
    return pilotGroup;
  },

  _meshForDomain(domain) {
    const spec = this.DOMAINS[domain] || this.DOMAINS.air;
    const g = new THREE.Group();
    g.userData = { domain, spec };

    if (domain === 'air') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6),
        new THREE.MeshBasicMaterial({ color: spec.color })
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
        new THREE.MeshBasicMaterial({ color: spec.color })
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
        new THREE.MeshBasicMaterial({ color: spec.color })
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
        new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.85 })
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
          console.log('%c[' + this.NAME_GR + '] ⚠️ Proximity guard — user/driver protected', 'color:#ff8800');
        }
      });
      if (steps > maxSteps || routeIdx >= routeData.points.length - 1) {
        droneRec.busy = false;
        if (mesh.parent) mesh.parent.remove(mesh);
        droneRec.mesh = null;
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

    const msg = spec.emoji + ' ' + n + ' ' + spec.label + ' drone(s) deployed · route ' + (routeData.provider || 'direct');
    console.log('%c[' + this.NAME_GR + '] ' + msg, 'color:#44ccff');
    this.out(msg, 'ok');
    return { ok: true, domain: d, count: n, deployed };
  },

  coordinateMarketplaceDelivery(opts) {
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

    this.showPilot(u.lat, u.lng);
    if (typeof flyToPoint === 'function') {
      const p = latLngToPos(u.lat, u.lng, 1.04);
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), GlobeControl?.Z?.national || 1.82);
      GlobeControl?.noteAutoFly?.();
    }

    const mission = {
      id: 'msn-' + Date.now(),
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
        new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.35 })
      );
      globePivot.add(routeLine);
      setTimeout(() => { if (routeLine.parent) routeLine.parent.remove(routeLine); }, 120000);
    }

    const plan = opts.seekingDriver
      ? ['air', 'ground']
      : ['air', 'sea', 'ground'];
    plan.forEach((dom, i) => {
      setTimeout(() => {
        this.deploy(dom, 1, {
          startLat: vLat,
          startLng: vLng,
          endLat: u.lat,
          endLng: u.lng,
          meta: { mission: mission.id, escort: !!driver },
        });
      }, i * 400);
    });

    const driverTxt = driver
      ? 'Escorting driver ' + (driver.display_name || driver.name)
      : (opts.seekingDriver ? 'Broadcasting to field drivers + drone last-mile' : 'Direct drone relay');
    const sys = '🛸 ' + this.NAME_GR + ' · ' + driverTxt + ' · ' + wants.slice(0, 80);
    window.MapComms?.postSystem?.(sys);
    ACI?.feed?.('telemachos-delivery', wants);

    const msg = this.NAME_GR + ' coordinates delivery: ' + wants + '. ' + driverTxt + '.';
    console.log('%c[' + this.NAME_GR + '] ' + msg, 'color:#00ddff');
    ACIControl?.reply(msg.slice(0, 200));
    return { ok: true, mission };
  },

  runDemoDelivery() {
    ACI?.feed?.('group-order', 'pitogyra-beers-cigarettes-drone');
    this.showPilot(this.HOME.lat, this.HOME.lng);
    const focus = latLngToPos(36.5, 28.0, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(focus.x, focus.y, focus.z), GlobeControl?.Z?.national || 1.82);
      GlobeControl?.noteAutoFly?.();
    }
    this.coordinateMarketplaceDelivery({
      vendor: { name: 'Pitogyra vendor', lat: 36.8, lng: 27.5 },
      deliveryLat: 36.2,
      deliveryLng: 28.1,
      wants: 'πιτογύρα + μπίρες + τσιγάρα',
      items: [{ name: 'πιτογύρα' }, { name: 'μπίρες' }, { name: 'τσιγάρα' }],
    });
    this.say('Αναλαμβάνω παράδοση pitogyra + μπίρες + τσιγάρα — drones σε ασφαλή διαδρομή.');
  },

  async cli(parts, raw) {
    const line = String(raw || parts?.join(' ') || '').trim();
    const p = parts?.length ? parts : (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []);
    let cmd = (p[0] || '').toLowerCase().replace(/^"|"$/g, '');
    let sub = (p[1] || '').toLowerCase();
    const rest = p.slice(1).join(' ');

    if (!['telemachos', 'tilemaxos', 'telemachus', 'tilemachos', 'pilot', 'drone', 'drones', 'fleet'].includes(cmd)) {
      if (this.mentionsName(line) || this.wantsIntro(line)) {
        if (this.wantsIntro(line) && !sub) {
          this.introduce();
          GlobeDeck?.finishCliIfOneShot('telemachos');
          return { ok: true };
        }
        if (/abilities|skills|δυνατοτητες|τι κανεις|what can/.test(this.foldedGreek(line))) {
          this.out(this.abilitiesText(), 'ok');
          GlobeDeck?.finishCliIfOneShot('telemachos');
          return { ok: true };
        }
        this.introduce();
        GlobeDeck?.finishCliIfOneShot('telemachos');
        return { ok: true };
      }
    }

    if (cmd === 'fleet' || cmd === 'drones' && !sub) {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('fleet');
      return { ok: true };
    }

    if (cmd === 'drone' || cmd === 'drones') cmd = 'telemachos';
    if (['tilemaxos', 'telemachus', 'tilemachos', 'pilot'].includes(cmd)) cmd = 'telemachos';

    sub = (p[1] || '').toLowerCase();
    const arg2 = (p[2] || '').toLowerCase();

    if (!sub || sub === 'hi' || sub === 'hello' || sub === 'γεια' || this.wantsIntro(sub + ' ' + rest)) {
      this.introduce();
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'abilities' || sub === 'skills' || sub === 'help') {
      this.out(this.abilitiesText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'fleet' || sub === 'status') {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'show' || sub === 'locate') {
      const u = Commerce?.userLatLng?.() || this.HOME;
      this.showPilot(u.lat, u.lng);
      this.say(this.NAME_GR + ' on globe · ' + u.lat.toFixed(2) + ', ' + u.lng.toFixed(2));
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deploy' || sub === 'launch') {
      const dom = arg2 || 'air';
      const n = parseInt(p[3], 10) || 1;
      this.deploy(dom, n);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deliver' || sub === 'coordinate' || sub === 'mission') {
      const vendor = Commerce?.selected || Commerce?.vendors?.[0];
      const u = Commerce?.userLatLng?.() || {};
      this.coordinateMarketplaceDelivery({
        vendor,
        deliveryLat: u.lat,
        deliveryLng: u.lng,
        wants: Commerce?._lastWants?.map((w) => w.label).join(' + ') || 'marketplace order',
        driver: Commerce?._preferredDriver,
        seekingDriver: !Commerce?._preferredDriverId,
      });
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'demo' || sub === 'grouporder') {
      this.runDemoDelivery();
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }

    this.out('usage: telemachos · abilities · fleet · deploy air 3 · deliver · show · demo', 'dim');
    GlobeDeck?.finishCliIfOneShot('telemachos');
    return { ok: true };
  },
};

window.TelemachosPilot = TelemachosPilot;
window.showPilotTelemachos = function () { return TelemachosPilot.showPilot(); };