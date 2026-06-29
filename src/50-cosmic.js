// ── COSMIC ZOOM: Earth → satellites → solar system → galaxy ──
const CosmicZoom = {
  level: 'system',
  solarGroup: null,
  galaxyPts: null,
  satGroup: null,
  issMarker: null,
  _issTarget: null,
  _issLastFetch: 0,
  orbitLines: [],
  leoRings: [],
  meshRing: null,
  planets: [],

  makeDashedOrbit(radius, color, opacity, parent, opts) {
    opts = opts || {};
    const segs = opts.segments || 40;
    const tilt = opts.tilt || 0;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wobble = Math.sin(a * (opts.wobble || 1)) * tilt;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, wobble, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity,
      dashSize: opts.dash || 0.05,
      gapSize: opts.gap || 0.09,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    line.visible = false;
    line.userData = { type: 'orbit-line', body: opts.body || '' };
    if (parent) parent.add(line);
    this.orbitLines.push(line);
    return line;
  },

  init() {
    this.solarGroup = new THREE.Group();
    this.solarGroup.visible = false;
    scene.add(this.solarGroup);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffcc33 })
    );
    sun.userData = { name: 'Sun', desc: 'G-type star · system barycenter' };
    this.solarGroup.add(sun);

    const planetDefs = [
      { n: 'Mercury', desc: 'Rocky · 88-day orbit · 167°C avg', c: 0xaaaaaa, r: 0.04, dist: 0.7, sp: 0.004 },
      { n: 'Venus', desc: 'Cloud cover · 225-day orbit', c: 0xddbb88, r: 0.06, dist: 1.0, sp: 0.003 },
      { n: 'Mars', desc: 'Red desert · 687-day orbit', c: 0xff6644, r: 0.05, dist: 1.5, sp: 0.0025 },
      { n: 'Jupiter', desc: 'Gas giant · 12-year orbit', c: 0xccaa77, r: 0.12, dist: 2.2, sp: 0.0015 },
      { n: 'Saturn', desc: 'Rings (not shown) · 29-year orbit', c: 0xddcc99, r: 0.1, dist: 3.0, sp: 0.001 },
    ];
    planetDefs.forEach((p, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(p.r, 10, 10),
        new THREE.MeshBasicMaterial({ color: p.c })
      );
      m.userData = { dist: p.dist, speed: p.sp, phase: i, name: p.n, desc: p.desc };
      this.solarGroup.add(m);
      this.planets.push(m);
      this.makeDashedOrbit(p.dist, p.c, 0.16, this.solarGroup, { body: p.n, tilt: 0.04 * (i % 3), dash: 0.04, gap: 0.1 });
    });

    const gPos = [];
    for (let i = 0; i < 4000; i++) {
      const arm = (i % 4) * 0.4;
      const t = Math.random() * Math.PI * 2;
      const rad = 8 + Math.random() * 25 + arm * 3;
      gPos.push(Math.cos(t) * rad, (Math.random() - 0.5) * 2, Math.sin(t) * rad);
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
    this.galaxyPts = new THREE.Points(
      gGeo,
      new THREE.PointsMaterial({ color: 0xaaccff, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.35 })
    );
    this.galaxyPts.visible = false;
    scene.add(this.galaxyPts);

    this.satGroup = new THREE.Group();
    globePivot.add(this.satGroup);
    this.spawnStarlinkShell();
    this.leoRings = [
      this.makeDashedOrbit(1.052, 0x336699, 0.1, this.satGroup, { body: 'LEO shell 1', tilt: 0.03, dash: 0.03, gap: 0.12 }),
      this.makeDashedOrbit(1.062, 0x4488bb, 0.14, this.satGroup, { body: 'LEO shell 2', tilt: 0.05, wobble: 2, dash: 0.035, gap: 0.11 }),
      this.makeDashedOrbit(1.072, 0x55aacc, 0.1, this.satGroup, { body: 'ISS / Starlink', tilt: 0.08, dash: 0.04, gap: 0.1 }),
    ];
    this.issOrbit = this.leoRings[2];
    this.trackISS();
    setInterval(() => this.trackISS(), 20000);
  },

  spawnStarlinkShell() {
    const count = 48;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const shell = i % 3;
      const r = 1.052 + shell * 0.01 + (i % 7) * 0.001;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.003, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.5 })
      );
      m.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      m.userData = { orb: i * 0.01, r, name: 'Starlink', desc: 'LEO broadband · shell ' + (shell + 1), idx: i };
      this.satGroup.add(m);
    }
    const iss = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc })
    );
    iss.userData = { type: 'iss', name: 'ISS', desc: 'International Space Station · ~400 km' };
    this.satGroup.add(iss);
    this.issMarker = iss;
  },

  registerOrbitalSats(sats) {
    if (!sats?.length || this.meshRing) return;
    this.meshRing = this.makeDashedOrbit(1.58, 0x8899ff, 0.12, scene, {
      body: 'Astranov mesh',
      tilt: 0.12,
      wobble: 3,
      dash: 0.05,
      gap: 0.12,
    });
    sats.forEach((sat, i) => {
      sat.userData = sat.userData || {};
      sat.userData.name = 'Relay ' + (i + 1);
      sat.userData.desc = 'Orbital mesh · global comms path';
      if (sat.material) {
        sat.material.transparent = true;
        sat.material.opacity = 0.65;
      }
    });
    this._orbitalSats = sats;
  },

  async trackISS() {
    let lat = null;
    let lng = null;
    try {
      const r = await fetch('https://api.open-notify.org/iss-now.json');
      const j = await r.json();
      if (j.iss_position) {
        lat = parseFloat(j.iss_position.latitude);
        lng = parseFloat(j.iss_position.longitude);
      }
    } catch (_) {}
    if (lat == null) {
      try {
        const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const j = await r.json();
        if (j.latitude != null) {
          lat = +j.latitude;
          lng = +j.longitude;
        }
      } catch (_) {}
    }
    if (lat == null || lng == null || !this.issMarker) return;
    this._issTarget = { lat, lng, t: Date.now() };
    this._issLastFetch = Date.now();
    this.issMarker.userData.lat = lat;
    this.issMarker.userData.lng = lng;
    this.issMarker.userData.desc = 'ISS · live ' + lat.toFixed(2) + '° ' + lng.toFixed(2) + '° · ~400 km';
    const p = latLngToPos(lat, lng, 1.065);
    if (!this._issTarget.from) {
      this.issMarker.position.set(p.x, p.y, p.z);
      this._issTarget.from = { x: p.x, y: p.y, z: p.z };
    }
    this.updateGuide(this.level, camera?.position?.z || 7.2);
  },

  _lerpIss() {
    if (!this.issMarker || this._issTarget?.lat == null) return;
    const tgt = latLngToPos(this._issTarget.lat, this._issTarget.lng, 1.065);
    const m = this.issMarker.position;
    m.x += (tgt.x - m.x) * 0.18;
    m.y += (tgt.y - m.y) * 0.18;
    m.z += (tgt.z - m.z) * 0.18;
  },

  updateGuide(level, camZ) {
    const el = document.getElementById('cosmic-guide');
    if (!el) return;
    if (level === 'earth' && camZ < 3.4) {
      if (CityMap?.active) {
        el.innerHTML = '<div class="cg-title">City map</div>'
          + '<div class="cg-item"><b>Satellite</b> — buildings & streets · pinch to zoom closer</div>'
          + '<div class="cg-item"><b>Live</b> — friends · drivers · OSRM routing when driving</div>'
          + '<div class="cg-item"><i>Zoom out to return to globe · theme 🌙/☀️</i></div>';
      }
      return;
    }
    let html = '';
    if (level === 'orbit') {
      html = '<div class="cg-title">Near-Earth orbit</div>'
        + '<div class="cg-item"><b>ISS</b> — crew station · live position · ~90 min orbit</div>'
        + '<div class="cg-item"><b>Starlink</b> — LEO broadband constellation (sampled)</div>'
        + '<div class="cg-item"><b>Dashed rings</b> — altitude shells · semi-transparent guides</div>'
        + '<div class="cg-item"><b>Mesh relays</b> — Astranov orbital connectivity</div>';
    } else if (level === 'system') {
      const iss = this.issMarker?.userData;
      html = '<div class="cg-title">Solar system (scaled view)</div>'
        + '<div class="cg-item"><b>Sun</b> — G-type star · system center</div>';
      if (iss?.lat != null) {
        html += '<div class="cg-item"><b>ISS</b> — live ' + iss.lat.toFixed(2) + '° · ' + iss.lng.toFixed(2) + '° · zoom in for orbit</div>';
      } else {
        html += '<div class="cg-item"><b>ISS</b> — tracking live position…</div>';
      }
      this.planets.forEach(p => {
        const ud = p.userData;
        html += '<div class="cg-item"><b>' + ud.name + '</b> — ' + (ud.desc || '') + '</div>';
      });
      html += '<div class="cg-item"><i>Dashed paths = discrete orbits · Earth shows real ISS</i></div>';
    } else if (level === 'galaxy') {
      html = '<div class="cg-title">Galaxy view</div>'
        + '<div class="cg-item"><b>Star field</b> — discrete points · spiral arm hint</div>'
        + '<div class="cg-item"><b>Earth</b> — hidden at this scale · zoom in to return</div>';
    }
    el.innerHTML = html;
  },

  setOrbitVisibility(level) {
    const showLeo = level === 'orbit';
    const showSolar = level === 'system';
    const showMesh = level === 'orbit' || level === 'system';
    this.leoRings.forEach(r => { if (r) r.visible = showLeo; });
    this.orbitLines.forEach(line => {
      if (!line.parent) return;
      if (line.parent === this.solarGroup) line.visible = showSolar;
    });
    if (this.meshRing) this.meshRing.visible = showMesh;
  },

  update(camZ, opts) {
    opts = opts || {};
    let level = opts.cosmic || 'earth';
    let label = opts.label || 'GLOBAL';
    if (!opts.tier) {
      if (camZ > 14) { level = 'galaxy'; label = 'GALAXY'; }
      else if (camZ > 5.5) { level = 'system'; label = 'SOLAR SYSTEM'; }
      else if (camZ > 4.8) { level = 'orbit'; label = 'ORBIT'; }
      else {
        level = 'earth';
        const tier = window.ZoomTiers?.current?.();
        label = tier?.label || (camZ > 2.2 ? 'GLOBAL' : camZ > 1.55 ? 'NATIONAL' : 'CITY');
      }
    }
    if (level !== this.level) this.level = level;
    const zl = document.getElementById('zoom-label');
    if (zl && !DrivingView?.active) {
      if (CityMap?.active) {
        const tier = window.ZoomTiers?.current?.();
        const tierLabel = tier?.id === 'neighborhood' ? 'NEIGHBORHOOD MAP' : 'CITY MAP';
        zl.textContent = tierLabel + ' · satellite · streets · friends · drivers';
      } else {
        const hint = level === 'orbit' ? ' · ISS · Starlink' : level === 'system' ? ' · planets' : label === 'GLOBAL' ? ' · ☀ day/night' : '';
        zl.textContent = label + hint;
      }
    }
    CityMap?.onCamera?.(camZ, level);
    this.updateGuide(level, camZ);
    this.setOrbitVisibility(level);

    globePivot.visible = camZ < 12;
    if (this.solarGroup) this.solarGroup.visible = level === 'system';
    if (this.galaxyPts) this.galaxyPts.visible = level === 'galaxy';
    if (this.satGroup) this.satGroup.visible = camZ < 10;
    if (this.issMarker) this.issMarker.visible = camZ < 10;
    this._lerpIss();

    if (this.solarGroup?.visible) {
      const t = Date.now() * 0.001;
      this.solarGroup.children.forEach((c, i) => {
        if (i === 0 || !c.userData.dist) return;
        const a = t * c.userData.speed * 200 + c.userData.phase;
        c.position.set(Math.cos(a) * c.userData.dist, Math.sin(a * 0.3) * 0.2, Math.sin(a) * c.userData.dist);
      });
    }

    if (this.satGroup && level === 'orbit') {
      const t = Date.now() * 0.0003;
      this.satGroup.children.forEach(c => {
        if (c.userData.type === 'iss') return;
        if (c.userData.orb == null) return;
        c.visible = c.userData.idx % 4 === 0;
        const a = t + c.userData.orb * 50;
        const r = c.userData.r;
        c.position.x = r * Math.cos(a);
        c.position.z = r * Math.sin(a);
      });
      if (this.issMarker) this.issMarker.visible = true;
    } else if (this.satGroup) {
      this.satGroup.children.forEach(c => {
        if (c.userData.orb != null) c.visible = false;
      });
    }

    if (this._orbitalSats && (level === 'orbit' || level === 'system')) {
      this._orbitalSats.forEach(s => { s.visible = level === 'orbit'; });
    } else if (this._orbitalSats) {
      this._orbitalSats.forEach(s => { s.visible = false; });
    }
  },
};
window.CosmicZoom = CosmicZoom;