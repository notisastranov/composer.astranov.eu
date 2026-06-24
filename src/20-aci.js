// === ASTRANOV COLLECTIVE INTELLIGENCE (ACI) — FINAL ===
// Synthesized from all AI specs: pure globe + three modes + council + self-evolving neurons.
// Single API: /functions/v1/aci (think | evolve | log | teach | stats | seed)
const ACI = {
  name: 'Astranov Collective Intelligence',
  url: 'https://lkoatrkhuigdolnjsbie.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
  neurons: [],
  history: [],
  thinkMode: '',
  evolving: false,
  heartbeat: null,
  lastPulse: 0,

  async headers() {
    if (window.Auth?.authHeaders) return Auth.authHeaders();
    return { 'Content-Type': 'application/json', apikey: this.key, Authorization: 'Bearer ' + this.key };
  },

  api(body) {
    return this.headers().then(h => fetch(this.url + '/functions/v1/aci', {
      method: 'POST', headers: h, body: JSON.stringify(body || {})
    })).then(r => r.json().catch(() => ({}))).catch(() => ({}));
  },

  _logQueue: [],
  _logTimer: null,
  feed(action, detail) {
    this._logQueue.push({ action, detail: detail || '', ts: Date.now() });
    if (!this._logTimer) {
      this._logTimer = setTimeout(() => {
        const batch = this._logQueue.splice(0, 8);
        this._logTimer = null;
        if (batch.length) this.api({ mode: 'log', action: 'batch', detail: batch.map(b => b.action + ':' + b.detail).join('; ').slice(0, 600) });
      }, 30000);
    }
  },

  spawnNeuron(lat, lng, strength, principle) {
    const pos = latLngToPos(lat, lng, 1.035);
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.85 })
    );
    n.position.set(pos.x, pos.y, pos.z);
    n.userData = { strength: strength || 1, id: 'neuron-' + Date.now() + Math.random(), principle: principle || '' };
    earth.add(n);
    this.neurons.push(n);
    if (window.AIGraphics) AIGraphics.spawnEffect(n.position, 0x00ffaa, 10, 20);
    return n;
  },

  syncNeuronsFromPrinciples(principles) {
    if (!Array.isArray(principles) || !principles.length) return;
    const seeds = [
      { lat: 36.22, lng: 28.12 }, { lat: 40, lng: 20 }, { lat: -15, lng: 45 },
      { lat: 55, lng: -30 }, { lat: 10, lng: -75 }, { lat: -35, lng: 140 }
    ];
    principles.slice(0, seeds.length).forEach((p, i) => {
      const s = seeds[i];
      const str = typeof p === 'string' ? 1.2 : (p.strength || p.importance || 1.2);
      const text = typeof p === 'string' ? p : (p.content || '');
      this.spawnNeuron(s.lat, s.lng, str, text);
    });
  },

  async think(prompt) {
    if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} }
    window._aciAbort = new AbortController();
    const up = window._lastPos || { lat: 36.22, lng: 28.12 };
    MapDepict.action('think', { lat: up.lat, lng: up.lng, detail: prompt.slice(0, 60) });
    const h = await this.headers();
    const r = await fetch(this.url + '/functions/v1/aci', {
      method: 'POST', headers: h,
      body: JSON.stringify({ mode: 'think', prompt, history: this.history.slice(-8), aci_mode: this.thinkMode || undefined }),
      signal: window._aciAbort.signal
    }).then(res => res.json().catch(() => ({}))).catch(err => (err.name === 'AbortError' ? { aborted: true } : {}));
    if (r.aborted) return '';
    const text = r.text || r.response || 'Το Astranov συγκεντρώνεται.';
    this.history.push({ role: 'user', content: prompt });
    this.history.push({ role: 'assistant', content: text });
    if (this.history.length > 20) this.history = this.history.slice(-20);
    this.feed('think', prompt.slice(0, 80));
    this.pulse(1.4);
    return text;
  },

  async teach(content) {
    const tLat = 36.2 + (Math.random() - 0.5) * 4;
    const tLng = 28.1 + (Math.random() - 0.5) * 4;
    MapDepict.action('teach', { lat: tLat, lng: tLng, detail: content.slice(0, 50) });
    await this.api({ mode: 'teach', content });
    this.feed('teach', content.slice(0, 120));
    this.spawnNeuron(tLat, tLng, 1.4, content);
    return true;
  },

  async evolve(reason) {
    if (this.evolving) return null;
    this.evolving = true;
    MapDepict.action('evolve', { detail: reason || 'collective' });
    try {
      const r = await this.api({ mode: 'evolve', activity: reason || 'user-triggered' });
      const births = Math.max(1, Math.min(4, Number(r.brain && r.brain.new_neurons) || 1));
      for (let i = 0; i < births; i++) {
        this.spawnNeuron((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 160, 1.1 + Math.random() * 0.4);
      }
      if (r.principles && r.principles.length) this.syncNeuronsFromPrinciples(r.principles);
      if (window.AIGraphics) AIGraphics.spawnEffect(new THREE.Vector3(0, 1.2, 0), 0x00ff88, 35, 45);
      const avg = this.neurons.length ? this.neurons.reduce((s, n) => s + (n.userData.strength || 1), 0) / this.neurons.length : 1;
      idleRoll = 0.00035 * (0.5 + avg * 0.35);
      this.pulse(2.0);
      console.log('%c[ACI FINAL] evolved', 'color:#00ff88', r);
      return r;
    } finally { this.evolving = false; }
  },

  async init() {
    await this.api({ mode: 'seed' });
    const stats = await this.api({ mode: 'stats' });
    if (stats.principles && stats.principles.length) {
      this.syncNeuronsFromPrinciples(stats.principles.map(p => p.content || p));
    } else {
      [{ lat: 36.22, lng: 28.12 }, { lat: 40, lng: 20 }, { lat: -15, lng: 45 }, { lat: 55, lng: -30 }]
        .forEach(s => this.spawnNeuron(s.lat, s.lng, 1.2));
    }
    this.attachHeartbeat();
    console.log('%c[ACI] Collective Intelligence ready — evolve on voice/command only', 'color:#00ddff', stats);
  },

  attachHeartbeat() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.008, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.75 })
    );
    ring.position.set(0.75, -0.55, -1.2);
    camera.add(ring);
    this.heartbeat = ring;
  },

  pulse(scale) {
    this.lastPulse = Date.now();
    if (this.heartbeat) this.heartbeat.scale.set(scale, scale, scale);
  },

  tick() {
    if (!this.heartbeat) return;
    const t = Date.now() / 500;
    const base = 0.85 + Math.sin(t) * 0.12;
    const boost = (Date.now() - this.lastPulse < 2000) ? 0.25 : 0;
    this.heartbeat.scale.set(base + boost, base + boost, base + boost);
    this.heartbeat.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.2 + boost;
  }
};
window.AstranovCollectiveIntelligence = ACI;

const SB_URL = ACI.url;
const SB_KEY = ACI.key;
const sbHeaders = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });

// ── ACI CONTROL (text + buttons — you command the collective) ──
const ACIControl = {
  init() {
    const input = document.getElementById('aci-input');
    const send = () => this.handle(input.value.trim());
    document.getElementById('aci-send').onclick = send;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    const mic = document.getElementById('aci-mic');
    mic.onclick = () => {
      if (Voice.speaking) { userIntervene(); startVoiceOptions(); return; }
      startVoiceOptions();
    };
    const stopBtn = document.getElementById('aci-stop');
    if (stopBtn) stopBtn.onclick = () => userIntervene();
    document.getElementById('aci-order').onclick = () => Commerce.orderPitogyra();
    document.getElementById('aci-vhf').onclick = () => Comms.startVHF();
    document.getElementById('aci-call').onclick = () => Comms.startPhone();
  },
  reply(text) {
    const el = document.getElementById('aci-reply');
    if (el) el.textContent = (text || '').slice(0, 220);
  },
  async handle(text) {
    if (!text) return;
    const low = text.toLowerCase();
    ACIControl.reply('…');
    if (/^(stop|σταμάτα|σταματα|pause|διακοπή)/.test(low)) { userIntervene(); return; }
    if (/^(cli|terminal|console)$/.test(low)) { AciCli.toggle(); return; }
    if (/^(login|sign in|google|σύνδεση)/.test(low)) { Auth.signInGoogle(); return; }
    if (/^(logout|sign out|αποσύνδεση)/.test(low)) { Auth.signOut(); return; }
    if (/telecom|sat radio|satellite radio|ασύρματος/.test(low)) { Comms.startTelecomms(); return; }
    if (/pitogyra|πιτογυρ|μπίρ|τσιγαρ|order|παραγγελ/.test(low)) {
      await Commerce.orderPitogyra();
      return;
    }
    if (/vhf|radio|ασυρμ/.test(low)) { Comms.startVHF(); return; }
    if (/phone|call|τηλέφων|κλήση|video/.test(low)) {
      if (/video|βίντεο/.test(low)) { MapDepict.action('video', { detail: 'Αξαδίνα' }); startOrbitalVideoCall('Αξαδίνα'); }
      else Comms.startPhone();
      return;
    }
    if (/news|νέα|ειδήσει/.test(low)) { NewsFeed.flash(); return; }
    if (/vendor|κατάστη|shop/.test(low)) { await Commerce.loadVendors(); Commerce.announceVendors(); return; }
    if (/evolve|neuron|collective|εξέλιξη/.test(low)) {
      await ACI.evolve('user-command');
      ACIControl.reply('Collective evolved. Council judged. Neurons updated.');
      speak('Η collective intelligence εξελίχθηκε. Neurons updated.', () => {});
      return;
    }
    const ans = await ACI.think(text);
    if (!ans) return;
    ACIControl.reply(ans);
    speak(ans.slice(0, 260), () => {});
  }
};
